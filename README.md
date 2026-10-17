# dsh-archived-sessions

A DeepSeek Harness Web GUI plugin that adds **Settings → Archived sessions**
(已归档会话): list every archived Session, restore it, or delete its persisted
log directory permanently.

## Install

This repository is a local DSH bundle. With DeepSeek Harness running, install it
from this directory:

```text
plugin_manager install_bundle { "target": "<absolute path to this repository>" }
```

The bundle's own `cordis.patch.yml` mounts the Host plugin; its `dsh.client`
manifest serves the Settings page. Open **Settings → Archived sessions** (reload
the page if the new Client artifact is not picked up yet).

> This repository contains no session data. The plugin only touches Session logs
> on disk when you confirm a permanent deletion.

## What it does

- **List and group** — reads the live `workspaces.list` archive set and the
  `sessions.list` snapshot through the Settings slot's standard `useWorkspaces` /
  `useSessions` hooks. Sessions are grouped by:
  1. the registered Workspace they belong to (sidebar order);
  2. otherwise by the directory recorded in the Session header (cwd) — a group
     whose Workspace registration was removed is badged **Workspace deleted**
     (工作区已删除);
  3. sessions with no recorded cwd;
  4. archived ids whose Session log no longer exists (**Unreadable archive
     records**), with restore disabled and a per-row **Clean up** action.
  Groups are collapsible, show their count and path, and the filter matches
  titles, directories, group paths, and session ids.
- **Restore** — calls the shipped Client `uiWorkspace.unarchiveSession`. A
  session whose Workspace registration is gone has no way back into it (the
  Host `create()` starts a Workspace with an empty session list and
  `insertSessionBefore()` only reorders already-accounted sessions), so it
  returns to the sidebar's **Ungrouped** list and stays fully usable; the page
  states that explicitly instead of pretending to re-home it.
- **Delete permanently** — asks the Host half for the on-disk log location, shows
  a second confirmation (files + size), then deletes the session log directory
  and drops the id from the durable archive set. The client session list is
  refreshed so the sidebar removes the row. For an unreadable record the Host
  reports `found: false` and only the stale archive marker is removed.
- **Batch actions** — every row has a checkbox, and every group header has its
  own **select-all** checkbox (with an indeterminate state when only part of
  that group is selected). The selection bar offers **Restore selected**,
  **Delete selected**, and **Clear**. Batch restore skips unreadable records and
  reports restored/failed/skipped counts; batch delete requires an inline
  confirmation and reports deleted/failed counts while keeping failed rows
  selected. Both run sequentially against the existing single-session routes, so
  no Host change is needed. The filter/count and selection bars are pinned with
  `position: sticky` at the top of the settings content, and buttons never wrap
  their labels.

## HTTP surface (Host half)

Both routes are exact `webServer` routes and authenticate every request through
`ctx.connection.requestRejection` before doing any work.

| Route | Body | Result |
|---|---|---|
| `POST /api/archived-sessions/inspect` | `{ "sessionId": "..." }` | `{ ok, found, paths, files, bytes, live }` — read-only |
| `POST /api/archived-sessions/delete` | `{ "sessionId": "...", "confirm": true }` | deletes the log directory and unarchives the id |

The delete route refuses a session that is still live, no longer archived, or
whose archive state cannot be verified (`409`).

## On-disk layout

DSH has no session-deletion API, so this plugin locates logs using the layout
documented by `dsh-session-persistence-jsonl`:

```text
<root>/--<normalized-cwd>--/<session-id>/session[.vN].jsonl[.zstd]
```

`<root>` comes from the configured persistence entry when present, then
`$DSH_HOME/sessions`, then `~/.dsh/sessions`. A match must be a real directory
named exactly after the session id, stay inside its root, and contain a
recognized generation file.

## What is kept

Only the session log directory is removed. Image/file attachments, projection
caches (`storages/session_projcache`), migration backups, and descendant
subagent logs are **not** deleted.

## Safety

Permanent deletion cannot be undone. The page requires an explicit second
confirmation and states the file count and size first. Live sessions and
unverifiable archive state are refused by the Host.

## Uninstall

Disable or remove the `dsh-archived-sessions` bundle from the profile's Plugin
settings; deleting the package does not touch any session logs.

## Development

Dependency-free checks:

```bash
node --check index.js
node --check client.js
npm test        # host fixture test, writes only to .tmp/
```

## Repository layout

| Path | Role |
|---|---|
| `index.js` | Host half: exact HTTP routes, auth fence, log discovery/removal |
| `client.js` | Browser half: Settings section, grouping, selection, batch actions |
| `cordis.patch.yml` | Bundle patch inserting the Host row |
| `locale/*.json` | Display metadata |
| `icon.svg` | Plugin icon |
| `test/verify-host.mjs` | Fixture test (12 checks) |
