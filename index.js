/**
 * dsh-archived-sessions — Host half.
 *
 * Registers two authenticated exact HTTP routes used by the Settings page:
 *
 *   POST /api/archived-sessions/inspect  → resolve the on-disk log location (read-only)
 *   POST /api/archived-sessions/delete   → permanently remove the session log directory
 *
 * DSH has no session-deletion API, so this plugin removes the per-session
 * JSONL directory documented by `dsh-session-persistence-jsonl`
 * (`<root>/<--cwd-->/<sessionId>/session[.vN].jsonl[.zstd]`) and then drops the
 * id from the durable archive set. The webServer routes are exact path matches
 * that bypass the Connection `/api` fallback, so every request is admitted
 * through `ctx.connection.requestRejection` before any work happens.
 *
 * @module dsh-archived-sessions
 */

import { lstat, readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const inject = ['webServer'];

/** Package name whose `config.root` names the persistence root when configured. */
const PERSISTENCE_ENTRY = '@deepseek-ai/dsh-session-persistence-jsonl';

/** Session ids are safe single path segments; anything else is refused. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** A persisted generation file (`session.jsonl`, `session.v4.jsonl.zstd`, …). */
const SESSION_LOG_PATTERN = /^session(?:\.[A-Za-z0-9_-]+)?\.jsonl(?:\.zstd)?(?:\.bak\d*)?$/;

const BODY_LIMIT_BYTES = 8 * 1024;
const ARCHIVE_READ_TIMEOUT_MS = 4000;

/** Sessions whose deletion is currently running, keyed by id. */
const inFlight = new Set();

// ---------------------------------------------------------------------------
// Helpers (exported for the fixture test)
// ---------------------------------------------------------------------------

/**
 * Validate a caller-supplied session id as one safe path segment.
 * @param {unknown} value candidate id.
 * @returns {string | null} the id, or null when it is not usable.
 */
export function validateSessionId(value) {
  if (typeof value !== 'string') return null;
  if (!SESSION_ID_PATTERN.test(value)) return null;
  if (value === '.' || value === '..') return null;
  return value;
}

/**
 * Candidate session-persistence roots, most authoritative first. The registry
 * itself exposes no root, so a configured persistence entry wins, then the
 * desktop default under DSH_HOME, then a plain `~/.dsh/sessions` fallback.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @returns {string[]} absolute, de-duplicated candidate roots.
 */
export function candidateSessionRoots(ctx) {
  const roots = [];
  try {
    const configEditor = ctx.get?.('configEditor');
    const rows = typeof configEditor?.configuration === 'function' ? configEditor.configuration() : [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const entry = row?.entry;
      const name = entry?.name ?? entry?.options?.name;
      if (name !== PERSISTENCE_ENTRY) continue;
      const root = row?.override?.root ?? row?.inherited?.root ?? entry?.config?.root ?? entry?.options?.config?.root;
      if (typeof root === 'string' && root.trim() !== '' && isAbsolute(root)) roots.push(root);
    }
  } catch {
    // A minimal host without the configuration editor still uses the defaults.
  }
  const home = typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : join(homedir(), '.dsh');
  roots.push(join(home, 'sessions'));
  roots.push(join(homedir(), '.dsh', 'sessions'));
  return [...new Set(roots.map((root) => resolve(root)))];
}

/**
 * Find every session-log directory for one id under the candidate roots.
 * A match must be a real directory named exactly after the id, live inside its
 * root, and contain at least one persisted generation file.
 * @param {readonly string[]} roots candidate persistence roots.
 * @param {unknown} rawId caller-supplied session id.
 * @returns {Promise<{ invalid: boolean, matches: string[] }>} matches, absolute.
 */
export async function findSessionLogs(roots, rawId) {
  const sessionId = validateSessionId(rawId);
  if (sessionId === null) return { invalid: true, matches: [] };
  const matches = [];
  for (const root of roots) {
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = join(root, entry.name, sessionId);
      const rel = relative(root, candidate);
      if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) continue;
      let stat;
      try {
        stat = await lstat(candidate);
      } catch {
        continue;
      }
      if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
      let files;
      try {
        files = await readdir(candidate, { withFileTypes: true });
      } catch {
        continue;
      }
      if (!files.some((file) => file.isFile() && SESSION_LOG_PATTERN.test(file.name))) continue;
      matches.push(candidate);
    }
  }
  return { invalid: false, matches: [...new Set(matches)] };
}

/**
 * Recursively count regular files and bytes inside one directory.
 * @param {string} dir absolute directory.
 * @returns {Promise<{ files: number, bytes: number }>} the totals.
 */
export async function measureTree(dir) {
  let files = 0;
  let bytes = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    let stat;
    try {
      stat = await lstat(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const nested = await measureTree(full);
      files += nested.files;
      bytes += nested.bytes;
    } else if (stat.isFile()) {
      files += 1;
      bytes += stat.size;
    }
  }
  return { files, bytes };
}

/**
 * Remove every given session-log directory, measuring first and reporting
 * per-path failures instead of aborting the whole batch.
 * @param {readonly string[]} paths absolute session directories.
 * @returns {Promise<{ removed: string[], failures: Array<{ path: string, message: string, code?: string }>, files: number, bytes: number }>} outcome.
 */
export async function removeSessionLogs(paths) {
  const removed = [];
  const failures = [];
  let files = 0;
  let bytes = 0;
  for (const dir of paths) {
    let measured = { files: 0, bytes: 0 };
    try {
      measured = await measureTree(dir);
    } catch {
      // The directory may have vanished between discovery and measurement.
    }
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 2 });
      removed.push(dir);
      files += measured.files;
      bytes += measured.bytes;
    } catch (error) {
      failures.push({
        path: dir,
        message: error instanceof Error ? error.message : String(error),
        ...(typeof error?.code === 'string' ? { code: error.code } : {}),
      });
    }
  }
  return { removed, failures, files, bytes };
}

/**
 * Read the durable archive set once from the workspace controller stream.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @returns {Promise<Set<string> | null>} the set, or null when unverifiable.
 */
export async function readArchivedSessionIds(ctx) {
  const controller = ctx.get?.('workspaceController');
  if (!controller || typeof controller.follow !== 'function') return null;
  try {
    const signal = AbortSignal.timeout(ARCHIVE_READ_TIMEOUT_MS);
    for await (const frame of controller.follow(signal)) {
      if ((frame?.type === 'baseline' || frame?.type === 'replace') && frame.value) {
        return new Set(Array.isArray(frame.value.archivedSessionIds) ? frame.value.archivedSessionIds : []);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

/**
 * Write one JSON response.
 * @param {import('node:http').ServerResponse} res response.
 * @param {number} status HTTP status.
 * @param {object} payload JSON body.
 */
function sendJson(res, status, payload) {
  if (res.writableEnded) return;
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

/**
 * Read and parse a bounded JSON request body.
 * @param {import('node:http').IncomingMessage} req request.
 * @returns {Promise<unknown>} parsed body.
 */
async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > BODY_LIMIT_BYTES) {
      throw Object.assign(new Error('request body too large'), { code: 'invalid-request' });
    }
    chunks.push(chunk);
  }
  if (total === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('request body is not valid JSON'), { code: 'invalid-request' });
  }
}

/**
 * Admit one request through the Connection trust/browser-authentication fence.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {import('node:http').ServerResponse} res response.
 * @returns {boolean} true only when the request may proceed.
 */
function authorize(ctx, req, res) {
  const connection = ctx.get?.('connection');
  if (!connection || typeof connection.requestRejection !== 'function') {
    sendJson(res, 503, {
      ok: false,
      code: 'connection-unavailable',
      message: 'The Connection service is not available, so this route refuses every request.',
    });
    return false;
  }
  let rejection;
  try {
    rejection = connection.requestRejection({ headers: req.headers });
  } catch (error) {
    sendJson(res, 503, {
      ok: false,
      code: 'connection-unavailable',
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
  if (rejection !== undefined) {
    sendJson(res, rejection, {
      ok: false,
      code: rejection === 403 ? 'forbidden' : 'unauthenticated',
      message: rejection === 403 ? 'Request origin is not trusted.' : 'Authentication is required.',
    });
    return false;
  }
  return true;
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {string} sessionId candidate id.
 * @returns {boolean} whether a live session or agent holds the id.
 */
function isSessionLive(ctx, sessionId) {
  try {
    const sessions = ctx.get?.('sessions');
    if (typeof sessions?.get === 'function' && sessions.get(sessionId)) return true;
  } catch {
    // Ignore and check the agent registry.
  }
  try {
    const agents = ctx.get?.('agents');
    if (typeof agents?.get === 'function' && agents.get(sessionId)) return true;
  } catch {
    // Neither registry is authoritative; absence means not live.
  }
  return false;
}

/**
 * Reject non-POST requests explicitly.
 * @returns {boolean} true when handled.
 */
function rejectMethod(req, res) {
  if (req.method === 'POST') return false;
  res.setHeader('allow', 'POST');
  sendJson(res, 405, { ok: false, code: 'method-not-allowed', message: 'Use POST.' });
  return true;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * Read-only route handler (exported for the fixture test).
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {import('node:http').ServerResponse} res response.
 */
export async function handleInspect(ctx, req, res) {
  if (!authorize(ctx, req, res)) return;
  if (rejectMethod(req, res)) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, code: 'invalid-request', message: error.message });
    return;
  }
  const sessionId = validateSessionId(body?.sessionId);
  if (sessionId === null) {
    sendJson(res, 400, { ok: false, code: 'invalid-request', message: 'A valid sessionId is required.' });
    return;
  }
  const { matches } = await findSessionLogs(candidateSessionRoots(ctx), sessionId);
  let files = 0;
  let bytes = 0;
  for (const dir of matches) {
    try {
      const measured = await measureTree(dir);
      files += measured.files;
      bytes += measured.bytes;
    } catch {
      // Report the path even when its size cannot be measured.
    }
  }
  sendJson(res, 200, {
    ok: true,
    sessionId,
    found: matches.length > 0,
    paths: matches,
    files,
    bytes,
    live: isSessionLive(ctx, sessionId),
  });
}

/**
 * Destructive route handler (exported for the fixture test).
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 * @param {import('node:http').IncomingMessage} req request.
 * @param {import('node:http').ServerResponse} res response.
 */
export async function handleDelete(ctx, req, res) {
  if (!authorize(ctx, req, res)) return;
  if (rejectMethod(req, res)) return;
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { ok: false, code: 'invalid-request', message: error.message });
    return;
  }
  if (body?.confirm !== true) {
    sendJson(res, 400, { ok: false, code: 'invalid-request', message: 'confirm: true is required.' });
    return;
  }
  const sessionId = validateSessionId(body?.sessionId);
  if (sessionId === null) {
    sendJson(res, 400, { ok: false, code: 'invalid-request', message: 'A valid sessionId is required.' });
    return;
  }
  if (inFlight.has(sessionId)) {
    sendJson(res, 409, { ok: false, code: 'delete-busy', message: 'A deletion for this session is already running.' });
    return;
  }
  inFlight.add(sessionId);
  try {
    if (isSessionLive(ctx, sessionId)) {
      sendJson(res, 409, {
        ok: false,
        code: 'session-active',
        message: 'This session still has a live session or agent; stop it before deleting.',
      });
      return;
    }
    const archived = await readArchivedSessionIds(ctx);
    if (archived === null) {
      sendJson(res, 409, {
        ok: false,
        code: 'state-unavailable',
        message: 'The archived-session state could not be verified, so the deletion was refused.',
      });
      return;
    }
    if (!archived.has(sessionId)) {
      sendJson(res, 409, {
        ok: false,
        code: 'session-not-archived',
        message: 'This session is no longer archived.',
      });
      return;
    }
    const { matches } = await findSessionLogs(candidateSessionRoots(ctx), sessionId);
    const removal = matches.length > 0
      ? await removeSessionLogs(matches)
      : { removed: [], failures: [], files: 0, bytes: 0 };
    let unarchived = false;
    if (removal.failures.length === 0) {
      try {
        const registry = ctx.get?.('workspaceRegistry');
        if (typeof registry?.unarchiveSession === 'function') {
          await registry.unarchiveSession(sessionId);
          unarchived = true;
        }
      } catch (error) {
        ctx.logger?.warn?.(`[archived-sessions] unarchive after delete failed for ${sessionId}: ${error?.message ?? error}`);
      }
    }
    if (removal.failures.length > 0) {
      sendJson(res, 500, {
        ok: false,
        code: 'delete-failed',
        message: removal.failures.map((failure) => failure.message).join('; '),
        sessionId,
        found: matches.length > 0,
        removed: removal.removed,
        failures: removal.failures,
        files: removal.files,
        bytes: removal.bytes,
        unarchived,
      });
      return;
    }
    ctx.logger?.info?.(
      `[archived-sessions] deleted ${sessionId}: ${removal.removed.length} dir(s), ${removal.files} file(s), ${removal.bytes} byte(s)`,
    );
    sendJson(res, 200, {
      ok: true,
      sessionId,
      found: matches.length > 0,
      removed: removal.removed,
      files: removal.files,
      bytes: removal.bytes,
      unarchived,
    });
  } catch (error) {
    ctx.logger?.warn?.(`[archived-sessions] delete failed for ${sessionId}: ${error?.stack ?? error}`);
    sendJson(res, 500, {
      ok: false,
      code: 'delete-failed',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    inFlight.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// Plugin entry
// ---------------------------------------------------------------------------

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 */
export function apply(ctx) {
  const mount = (path, handler, label) => {
    ctx.effect(
      () => ctx.webServer.register({
        kind: 'exact',
        path,
        handler: (req, res) => {
          Promise.resolve(handler(req, res)).catch((error) => {
            ctx.logger?.warn?.(`[archived-sessions] ${label} handler failed: ${error?.stack ?? error}`);
            sendJson(res, 500, {
              ok: false,
              code: 'internal-error',
              message: error instanceof Error ? error.message : String(error),
            });
          });
        },
      }),
      `archived-sessions: ${label}`,
    );
  };
  mount('/api/archived-sessions/inspect', (req, res) => handleInspect(ctx, req, res), 'inspect route');
  mount('/api/archived-sessions/delete', (req, res) => handleDelete(ctx, req, res), 'delete route');
}
