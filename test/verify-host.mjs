/**
 * Fixture test for the Host half's session-log discovery and removal.
 *
 * Runs entirely inside this package folder:
 *   .tmp/verify-host-<pid>-<time>/
 *
 * Usage: node test/verify-host.mjs
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import {
  apply,
  candidateSessionRoots,
  findSessionLogs,
  handleDelete,
  handleInspect,
  measureTree,
  readArchivedSessionIds,
  removeSessionLogs,
  validateSessionId,
} from '../index.js';

const here = dirname(fileURLToPath(import.meta.url));
const base = join(here, '..', '.tmp', 'verify-host-' + process.pid + '-' + Date.now());

let passed = 0;

function ok(name) {
  passed += 1;
  console.log('PASS ' + name);
}

async function makeSession(root, project, id, files) {
  const dir = join(root, project, id);
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files ?? { 'session.v4.jsonl.zstd': 'hello' })) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

function makeRequest(body, method = 'POST') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  req.method = method;
  req.headers = {};
  return req;
}

function makeResponse() {
  return {
    statusCode: 0,
    headers: {},
    writableEnded: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(payload) {
      this.writableEnded = true;
      this.body = payload ?? '';
    },
  };
}

function makeHandlerCtx({ archivedId, live = false, connectionRejection, noController = false } = {}) {
  const calls = { unarchived: [] };
  return {
    calls,
    ctx: {
      get(name) {
        if (name === 'connection') return { requestRejection: () => connectionRejection };
        if (name === 'workspaceController') {
          if (noController) return undefined;
          return {
            follow: async function* () {
              yield { type: 'baseline', value: { archivedSessionIds: archivedId ? [archivedId] : [], pinnedSessionIds: [] } };
            },
          };
        }
        if (name === 'workspaceRegistry') {
          return {
            unarchiveSession: async (id) => {
              calls.unarchived.push(id);
            },
          };
        }
        if (name === 'sessions') return live ? { get: () => ({}) } : undefined;
        if (name === 'agents') return undefined;
        return undefined;
      },
      logger: { info() {}, warn() {} },
    },
  };
}

async function main() {
  await mkdir(base, { recursive: true });

  // --- id validation -------------------------------------------------------
  assert.equal(validateSessionId('session-abc'), 'session-abc');
  assert.equal(validateSessionId('9fda0e57-1f00-4d4d-9b1f-000000000000'), '9fda0e57-1f00-4d4d-9b1f-000000000000');
  for (const bad of ['', '.', '..', '../x', 'a/b', 'a b', 'a\nb', null, 12, '-leading']) {
    assert.equal(validateSessionId(bad), null, 'expected refusal for ' + JSON.stringify(bad));
  }
  ok('validateSessionId accepts safe ids and refuses traversal');

  // --- candidate roots -----------------------------------------------------
  const savedHome = process.env.DSH_HOME;
  process.env.DSH_HOME = join(base, 'home');
  try {
    const fakeCtx = {
      get(name) {
        if (name !== 'configEditor') return undefined;
        return {
          configuration: () => [
            { entry: { name: 'unrelated' }, override: {}, inherited: {} },
            {
              entry: { options: { name: '@deepseek-ai/dsh-session-persistence-jsonl' } },
              override: { root: join(base, 'custom-root') },
              inherited: {},
            },
          ],
        };
      },
    };
    const roots = candidateSessionRoots(fakeCtx);
    assert.equal(roots[0], resolve(join(base, 'custom-root')));
    assert.ok(roots.includes(resolve(join(base, 'home', 'sessions'))));
    assert.ok(candidateSessionRoots({ get: () => undefined }).length >= 1);
  } finally {
    if (savedHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = savedHome;
  }
  ok('candidateSessionRoots prefers the configured persistence root');

  // --- find / measure / remove --------------------------------------------
  const root = join(base, 'sessions');
  const project = '--E-x--';
  const id = 'session-11111111-2222-3333-4444-555555555555';
  const dir = await makeSession(root, project, id, { 'session.v4.jsonl.zstd': 'hello' });

  const found = await findSessionLogs([root], id);
  assert.equal(found.invalid, false);
  assert.deepEqual(found.matches, [dir]);
  assert.deepEqual(await measureTree(dir), { files: 1, bytes: 5 });

  const removal = await removeSessionLogs([dir]);
  assert.equal(removal.failures.length, 0);
  assert.deepEqual(removal.removed, [dir]);
  assert.equal(removal.files, 1);
  assert.equal(removal.bytes, 5);
  assert.equal(existsSync(dir), false);
  assert.deepEqual((await findSessionLogs([root], id)).matches, []);
  ok('find, measure, and remove one session log directory');

  // --- non-session directories are ignored --------------------------------
  const otherDir = await makeSession(root, project, 'session-99999999-0000-0000-0000-000000000000', { 'notes.txt': 'x' });
  assert.deepEqual((await findSessionLogs([root], 'session-99999999-0000-0000-0000-000000000000')).matches, []);
  assert.equal(existsSync(otherDir), true);
  ok('directories without a generation file are ignored');

  // --- duplicate copies across roots are all found ------------------------
  const rootB = join(base, 'second-root');
  const id2 = 'session-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const dirA = await makeSession(root, project, id2, { 'session.jsonl': 'a' });
  const dirB = await makeSession(rootB, '--E-y--', id2, { 'session.v3.jsonl.zstd': 'bb' });
  const matches = await findSessionLogs([root, rootB], id2);
  assert.equal(matches.matches.length, 2);
  const removal2 = await removeSessionLogs(matches.matches);
  assert.equal(removal2.failures.length, 0);
  assert.equal(removal2.files, 2);
  assert.equal(removal2.bytes, 3);
  assert.equal(existsSync(dirA), false);
  assert.equal(existsSync(dirB), false);
  ok('duplicate copies under multiple roots are removed together');

  // --- symlink refusal (may be unavailable on Windows) --------------------
  const id3 = 'session-ffffffff-0000-1111-2222-333333333333';
  const realDir = await makeSession(join(base, 'outside'), project, id3, { 'session.v4.jsonl.zstd': 'x' });
  try {
    await symlink(realDir, join(root, project, id3), 'junction');
    assert.deepEqual((await findSessionLogs([root], id3)).matches, []);
    ok('symlinked session directories are refused');
  } catch (error) {
    console.log('SKIP symlink test (link creation unavailable): ' + error.message);
  }

  // --- missing roots are harmless ----------------------------------------
  assert.deepEqual((await findSessionLogs([join(base, 'does-not-exist')], id)).matches, []);
  ok('missing candidate roots yield no matches');

  // --- archive-set read ---------------------------------------------------
  let followCalls = 0;
  const archived = await readArchivedSessionIds({
    get: (name) => (name === 'workspaceController'
      ? {
        follow: async function* () {
          followCalls += 1;
          yield { type: 'baseline', value: { archivedSessionIds: ['a', 'b'], pinnedSessionIds: [] } };
          throw new Error('must not be consumed further');
        },
      }
      : undefined),
  });
  assert.equal(followCalls, 1);
  assert.deepEqual([...archived], ['a', 'b']);
  assert.equal(await readArchivedSessionIds({ get: () => undefined }), null);
  ok('archived set reads only the first workspace baseline');

  // --- HTTP handlers ------------------------------------------------------
  const handlerHome = join(base, 'handler-home');
  const savedHome2 = process.env.DSH_HOME;
  process.env.DSH_HOME = handlerHome;
  try {
    const handlerRoot = join(handlerHome, 'sessions');
    const handlerId = 'session-abcdefab-1111-2222-3333-444455556666';
    const handlerDir = await makeSession(handlerRoot, '--E-handler--', handlerId, { 'session.v4.jsonl.zstd': 'hello!' });

    // Unauthenticated requests are refused before any file work.
    {
      const { ctx } = makeHandlerCtx({ archivedId: handlerId, connectionRejection: 401 });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId, confirm: true })), res);
      assert.equal(res.statusCode, 401);
      assert.equal(JSON.parse(res.body).code, 'unauthenticated');
      assert.equal(existsSync(handlerDir), true);
    }

    // Method and body validation.
    {
      const { ctx } = makeHandlerCtx({ archivedId: handlerId });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(undefined, 'GET'), res);
      assert.equal(res.statusCode, 405);
    }
    {
      const { ctx } = makeHandlerCtx({ archivedId: handlerId });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId })), res);
      assert.equal(res.statusCode, 400);
      assert.equal(JSON.parse(res.body).code, 'invalid-request');
    }
    {
      const { ctx } = makeHandlerCtx({ archivedId: handlerId });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: '../evil', confirm: true })), res);
      assert.equal(res.statusCode, 400);
    }

    // Live and non-archived sessions are refused.
    {
      const { ctx, calls } = makeHandlerCtx({ archivedId: handlerId, live: true });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId, confirm: true })), res);
      assert.equal(res.statusCode, 409);
      assert.equal(JSON.parse(res.body).code, 'session-active');
      assert.deepEqual(calls.unarchived, []);
      assert.equal(existsSync(handlerDir), true);
    }
    {
      const { ctx } = makeHandlerCtx({ archivedId: 'session-other' });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId, confirm: true })), res);
      assert.equal(res.statusCode, 409);
      assert.equal(JSON.parse(res.body).code, 'session-not-archived');
      assert.equal(existsSync(handlerDir), true);
    }
    {
      const { ctx } = makeHandlerCtx({ archivedId: handlerId, noController: true });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId, confirm: true })), res);
      assert.equal(res.statusCode, 409);
      assert.equal(JSON.parse(res.body).code, 'state-unavailable');
      assert.equal(existsSync(handlerDir), true);
    }
    ok('delete handler refuses unauthenticated, invalid, live, non-archived, and unverifiable requests');

    // Inspect is read-only and reports the resolved path.
    {
      const { ctx } = makeHandlerCtx({ archivedId: handlerId });
      const res = makeResponse();
      await handleInspect(ctx, makeRequest(JSON.stringify({ sessionId: handlerId })), res);
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.found, true);
      assert.deepEqual(body.paths, [handlerDir]);
      assert.equal(body.files, 1);
      assert.equal(body.bytes, 6);
      assert.equal(existsSync(handlerDir), true);
    }
    ok('inspect handler resolves the log directory without deleting it');

    // A confirmed deletion removes the directory and unarchives the id.
    {
      const { ctx, calls } = makeHandlerCtx({ archivedId: handlerId });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId, confirm: true })), res);
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.ok, true);
      assert.equal(body.found, true);
      assert.equal(body.files, 1);
      assert.equal(body.bytes, 6);
      assert.equal(body.unarchived, true);
      assert.deepEqual(calls.unarchived, [handlerId]);
      assert.equal(existsSync(handlerDir), false);
    }

    // A second deletion cleans the stale archive entry only.
    {
      const { ctx, calls } = makeHandlerCtx({ archivedId: handlerId });
      const res = makeResponse();
      await handleDelete(ctx, makeRequest(JSON.stringify({ sessionId: handlerId, confirm: true })), res);
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.body);
      assert.equal(body.found, false);
      assert.deepEqual(calls.unarchived, [handlerId]);
    }
    ok('delete handler removes logs, unarchives, and tolerates a stale entry');
  } finally {
    if (savedHome2 === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = savedHome2;
  }

  // --- route wiring -------------------------------------------------------
  const routes = [];
  apply({
    effect: (callback) => { callback(); },
    get: () => undefined,
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
    logger: {},
  });
  assert.deepEqual(routes.map((route) => route.path).sort(), [
    '/api/archived-sessions/delete',
    '/api/archived-sessions/inspect',
  ]);
  assert.ok(routes.every((route) => route.kind === 'exact'));
  ok('apply registers the two exact routes');

  console.log('\nAll ' + passed + ' checks passed.');
}

try {
  await main();
} catch (error) {
  console.error('\nFAILED:');
  console.error(error);
  process.exitCode = 1;
} finally {
  await rm(base, { recursive: true, force: true }).catch(() => {});
}
