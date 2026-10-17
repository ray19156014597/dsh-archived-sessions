/**
 * dsh-archived-sessions — browser half.
 *
 * Hand-written `__ModuleLoader__` bundle (no build step): a Settings section
 * that lists every archived Session grouped by its registered Workspace or,
 * when that Workspace registration is gone, by the directory recorded in the
 * Session header. Restore uses `ctx.uiWorkspace.unarchiveSession` (a session
 * without a registered Workspace returns to the sidebar's "Ungrouped" list);
 * delete asks the Host half to remove the persisted log directory permanently.
 *
 * Visible text is routed through the Client locale service; styles use only
 * `--dsw-alias-*` theme tokens.
 */

window.__ModuleLoader__.load({
	id: 'dsh-archived-sessions',
	factory: (require) => {
		const React = require('react');
		const h = React.createElement;
		const NS = 'archivedSessions';

		// #region dictionaries
		const zh = {
			nav: '已归档会话',
			title: '已归档会话',
			description: '这里集中列出已归档的会话，按原工作区或原目录分组。可以恢复它们，或将其日志从磁盘彻底删除。',
			count: '共 {count} 个归档会话',
			filteredCount: '匹配 {count} 个',
			filterPlaceholder: '筛选标题、工作区、目录或会话 ID',
			refresh: '刷新',
			refreshing: '刷新中…',
			empty: '没有已归档的会话',
			emptyHint: '在侧栏会话菜单中归档会话后，它就会出现在这里。',
			untitled: '未命名会话',
			restore: '恢复',
			restoreAria: '恢复会话 {title}',
			restoreBusy: '恢复中…',
			delete: '删除',
			deleteAria: '彻底删除会话 {title}',
			cleanup: '清理记录',
			cleanupAria: '清理会话 {title} 的归档记录',
			cleanupNote: '将仅移除归档标记，不影响磁盘文件。',
			selectRow: '选择会话 {title}',
			selectGroup: '全选本组：{title}',
			selectGroupShort: '全选',
			selectionCount: '已选 {count} 项',
			batchRestore: '批量恢复',
			batchDelete: '批量删除',
			clearSelection: '清空',
			batchRestoring: '正在恢复 {done}/{total}…',
			batchDeleting: '正在删除 {done}/{total}…',
			batchRestoredOk: '已恢复 {count} 个会话。',
			batchRestoredPartial: '已恢复 {ok} 个，失败 {failed} 个。',
			batchRestoreSkipped: '（跳过 {skipped} 条无日志记录）',
			batchRestoreNothing: '所选会话都没有可读取的日志，无法恢复。',
			batchDeletedOk: '已彻底删除 {count} 个会话。',
			batchDeletedPartial: '已删除 {ok} 个，失败 {failed} 个。',
			batchDeleteConfirm: '将彻底删除所选 {count} 个会话的日志（其中 {stale} 条仅剩归档记录），此操作不可撤销。',
			batchDeleteConfirmNoStale: '将彻底删除所选 {count} 个会话的日志，此操作不可撤销。',
			confirmBatchDelete: '确认删除',
			batchRefreshHint: '会话列表刷新失败，请刷新页面同步侧栏。',
			orphanBadge: '工作区已删除',
			orphanHint: '该工作区已从工作区列表中移除；恢复后会话会出现在侧栏「未分组」，可正常打开继续使用。',
			staleGroup: '无法读取的归档记录',
			staleHint: '磁盘上已找不到这些会话的日志，仅剩归档记录；可逐条「清理记录」。',
			staleBadge: '日志缺失',
			staleRowTitle: '无法读取的会话',
			noCwdGroup: '无工作目录',
			noCwdHint: '这些会话没有记录工作目录；恢复后会出现在侧栏「未分组」。',
			collapseGroup: '折叠分组 {title}',
			expandGroup: '展开分组 {title}',
			restored: '已恢复「{title}」',
			restoredUngrouped: '已恢复「{title}」；该会话没有已注册的工作区，已放入侧栏「未分组」。',
			deleted: '已彻底删除「{title}」',
			cleaned: '已清理「{title}」的归档记录',
			inspectLoading: '正在读取日志信息…',
			confirmTitle: '彻底删除「{title}」？',
			confirmCleanupTitle: '清理这条归档记录？',
			confirmLogInfo: '将删除 {files} 个日志文件（{size}）。',
			confirmMissingLog: '磁盘上未找到该会话的日志文件，确认后将只清理归档记录。',
			confirmWarning: '此操作不可撤销；图片与文件附件不会一并删除。',
			confirmDelete: '彻底删除',
			cancel: '取消',
			deleting: '删除中…',
			liveWarning: '该会话仍处于运行状态，删除会被拒绝，请先停止它。',
			refreshFailed: '刷新失败：{message}',
			restoreFailed: '恢复失败：{message}',
			deleteFailed: '删除失败：{message}',
			refreshAfterDeleteFailed: '已删除，但会话列表刷新失败，请刷新页面同步侧栏。',
			sessionActive: '该会话仍在运行，请先停止后再删除。',
			notArchived: '该会话已不在归档中，列表已刷新。',
			attachmentNote: '说明：本插件只删除该会话的日志目录；附件、投影缓存与迁移备份会被保留。',
		};
		const en = {
			nav: 'Archived sessions',
			title: 'Archived sessions',
			description: 'Every archived session, grouped by its original workspace or directory. Restore one, or delete its logs from disk permanently.',
			count: '{count} archived session(s)',
			filteredCount: '{count} matching',
			filterPlaceholder: 'Filter by title, workspace, directory, or session ID',
			refresh: 'Refresh',
			refreshing: 'Refreshing…',
			empty: 'No archived sessions',
			emptyHint: 'Archive a session from its sidebar menu and it shows up here.',
			untitled: 'Untitled session',
			restore: 'Restore',
			restoreAria: 'Restore session {title}',
			restoreBusy: 'Restoring…',
			delete: 'Delete',
			deleteAria: 'Delete session {title} permanently',
			cleanup: 'Clean up',
			cleanupAria: 'Clean up the archive record of session {title}',
			cleanupNote: 'This only removes the archive record; files on disk are untouched.',
			selectRow: 'Select session {title}',
			selectGroup: 'Select all in {title}',
			selectGroupShort: 'All',
			selectionCount: '{count} selected',
			batchRestore: 'Restore selected',
			batchDelete: 'Delete selected',
			clearSelection: 'Clear',
			batchRestoring: 'Restoring {done}/{total}…',
			batchDeleting: 'Deleting {done}/{total}…',
			batchRestoredOk: 'Restored {count} session(s).',
			batchRestoredPartial: 'Restored {ok}, failed {failed}.',
			batchRestoreSkipped: '({skipped} unreadable record(s) skipped)',
			batchRestoreNothing: 'None of the selected sessions has a readable log, so nothing can be restored.',
			batchDeletedOk: 'Permanently deleted {count} session(s).',
			batchDeletedPartial: 'Deleted {ok}, failed {failed}.',
			batchDeleteConfirm: 'Permanently delete the logs of {count} selected session(s) ({stale} of them only have an archive record). This cannot be undone.',
			batchDeleteConfirmNoStale: 'Permanently delete the logs of {count} selected session(s). This cannot be undone.',
			confirmBatchDelete: 'Delete now',
			batchRefreshHint: 'The session list could not refresh; reload the page to sync the sidebar.',
			orphanBadge: 'Workspace deleted',
			orphanHint: 'This workspace was removed from the workspace list. Restored sessions appear under "Ungrouped" in the sidebar and remain usable.',
			staleGroup: 'Unreadable archive records',
			staleHint: 'No log files remain on disk for these sessions; only archive records are left. Clean them up individually.',
			staleBadge: 'Log missing',
			staleRowTitle: 'Unreadable session',
			noCwdGroup: 'No working directory',
			noCwdHint: 'These sessions recorded no working directory; restoring puts them under "Ungrouped".',
			collapseGroup: 'Collapse group {title}',
			expandGroup: 'Expand group {title}',
			restored: 'Restored "{title}"',
			restoredUngrouped: 'Restored "{title}"; it has no registered workspace, so it was placed under "Ungrouped".',
			deleted: 'Permanently deleted "{title}"',
			cleaned: 'Cleaned up the archive record of "{title}"',
			inspectLoading: 'Reading log information…',
			confirmTitle: 'Delete "{title}" permanently?',
			confirmCleanupTitle: 'Clean up this archive record?',
			confirmLogInfo: 'This removes {files} log file(s) ({size}).',
			confirmMissingLog: 'No log files were found on disk; confirming only clears the archive record.',
			confirmWarning: 'This cannot be undone. Image and file attachments are not removed.',
			confirmDelete: 'Delete permanently',
			cancel: 'Cancel',
			deleting: 'Deleting…',
			liveWarning: 'This session is still running; the deletion will be refused until it stops.',
			refreshFailed: 'Refresh failed: {message}',
			restoreFailed: 'Restore failed: {message}',
			deleteFailed: 'Delete failed: {message}',
			refreshAfterDeleteFailed: 'Deleted, but the session list could not refresh. Reload the page to sync the sidebar.',
			sessionActive: 'This session is still running. Stop it before deleting.',
			notArchived: 'This session is no longer archived; the list was refreshed.',
			attachmentNote: 'Note: only the session log directory is removed. Attachments, projection caches, and migration backups are kept.',
		};
		// #endregion

		// #region styles
		const CSS = [
			'.das-root{display:flex;flex-direction:column;gap:14px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}',
			'.das-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}',
			'.das-heading{min-width:0}',
			'.das-title{margin:0 0 4px;font-size:16px;font-weight:600;color:var(--dsw-alias-label-primary)}',
			'.das-description{margin:0;max-width:640px;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.6}',
			'.das-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
			'.das-sticky{position:sticky;top:0;z-index:5;display:flex;flex-direction:column;gap:14px;padding:6px 0 10px;background:var(--dsw-alias-bg-layer-2)}',
			'.das-group-head{display:flex;align-items:center;gap:8px}',
			'.das-group-select{display:inline-flex;align-items:center;gap:5px;flex:none;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px;cursor:pointer}',
			'.das-group-select input,.das-row-check input{width:14px;height:14px;margin:0;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}',
			'.das-selection{display:flex;flex-direction:column;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}',
			'.das-selection-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
			'.das-selection-count{font-size:12px;font-weight:500;white-space:nowrap}',
			'.das-selection-progress{font-size:11px;color:var(--dsw-alias-label-secondary);white-space:nowrap}',
			'.das-selection-actions{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}',
			'.das-batch-confirm{margin:0;border-radius:8px}',
			'.das-input{flex:1 1 220px;min-width:160px;height:30px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px}',
			'.das-input::placeholder{color:var(--dsw-alias-label-secondary)}',
			'.das-input:focus-visible,.das-button:focus-visible,.das-group-header:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
			'.das-count{white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:12px}',
			'.das-notice{padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);font-size:12px}',
			'.das-notice-error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
			'.das-notice-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}',
			'.das-groups{display:flex;flex-direction:column;gap:16px}',
			'.das-group{display:flex;flex-direction:column;gap:6px}',
			'.das-group-header{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:5px 4px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}',
			'.das-group-header:hover{background:var(--dsw-alias-bg-layer-2)}',
			'.das-chevron{flex:none;width:12px;font-size:10px;color:var(--dsw-alias-label-secondary);transition:transform .12s ease}',
			'.das-chevron-collapsed{transform:rotate(-90deg)}',
			'.das-group-title{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.das-group-count{flex:none;padding:0 7px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}',
			'.das-group-path{margin-left:auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px}',
			'.das-group-hint{margin:0 4px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary)}',
			'.das-badge{flex:none;padding:0 6px;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);line-height:18px;font-size:11px}',
			'.das-badge-warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 12%,transparent)}',
			'.das-list{list-style:none;margin:0;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}',
			'.das-item{border-top:1px solid var(--dsw-alias-border-l1)}',
			'.das-item:first-child{border-top:none}',
			'.das-row{display:flex;align-items:center;gap:12px;padding:10px 12px}',
			'.das-row-check{flex:none;display:flex;align-items:center}',
			'.das-row-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}',
			'.das-row-title{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
			'.das-row-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:11px}',
			'.das-mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;opacity:.75;word-break:break-all}',
			'.das-row-actions{display:flex;gap:6px;flex:none}',
			'.das-button{height:26px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer;white-space:nowrap;flex:none}',
			'.das-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}',
			'.das-button:disabled{opacity:.5;cursor:default}',
			'.das-danger{color:var(--dsw-alias-state-error-primary)}',
			'.das-danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}',
			'.das-danger-solid{color:#fff;background:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
			'.das-danger-solid:hover:not(:disabled){background:var(--dsw-alias-state-error-primary);filter:brightness(1.05)}',
			'.das-confirm{display:flex;flex-direction:column;gap:6px;margin:0 12px 10px;padding:10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}',
			'.das-confirm-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);word-break:break-word}',
			'.das-confirm-detail,.das-confirm-warning{font-size:11px;color:var(--dsw-alias-label-secondary)}',
			'.das-confirm-warning{color:var(--dsw-alias-state-warn-primary)}',
			'.das-path{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
			'.das-confirm-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:2px}',
			'.das-empty{padding:32px 16px;border:1px dashed var(--dsw-alias-border-l1);border-radius:10px;text-align:center;color:var(--dsw-alias-label-secondary)}',
			'.das-empty-title{margin-bottom:6px;font-size:13px;color:var(--dsw-alias-label-primary)}',
			'.das-loading{padding:18px 12px;color:var(--dsw-alias-label-secondary);font-size:12px}',
			'.das-footer{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6}',
		].join('\n');
		// #endregion

		// #region helpers
		function readLocaleId(ctx) {
			try {
				const snapshot = ctx.locale?.getSnapshot?.();
				return String(snapshot?.id ?? snapshot?.locale ?? '');
			} catch {
				return '';
			}
		}

		/**
		 * Build the section translator: the locale service binding when
		 * available, otherwise a local dictionary so the page still renders.
		 * @param ctx - client root context.
		 * @returns translate function.
		 */
		function createTranslator(ctx) {
			try {
				const bound = ctx.locale?.bind?.(NS);
				if (typeof bound === 'function') return bound;
			} catch {
				// Fall through to the local dictionary.
			}
			return (key, params) => {
				const dictionary = readLocaleId(ctx).toLowerCase().startsWith('en') ? en : zh;
				let text = dictionary[key] ?? zh[key] ?? key;
				if (params !== undefined && params !== null) {
					for (const [name, value] of Object.entries(params)) text = text.split('{' + name + '}').join(String(value));
				}
				return text;
			};
		}

		/**
		 * POST one JSON payload to an exact Host route and normalize failures.
		 * @param path - document-relative route path.
		 * @param payload - JSON body.
		 * @returns parsed JSON result.
		 */
		async function postJson(path, payload) {
			let response;
			try {
				response = await fetch(path, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(payload),
					cache: 'no-store',
					credentials: 'same-origin',
				});
			} catch (error) {
				const failure = new Error(error?.message || 'network error');
				failure.code = 'network-error';
				throw failure;
			}
			let data = null;
			try {
				data = await response.json();
			} catch {
				data = null;
			}
			if (!response.ok || data === null || data.ok !== true) {
				const failure = new Error(data?.message || ('HTTP ' + response.status));
				failure.code = data?.code || ('http-' + response.status);
				failure.status = response.status;
				throw failure;
			}
			return data;
		}

		function formatTime(value) {
			if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '';
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) return '';
			try {
				return date.toLocaleString(undefined, {
					year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
				});
			} catch {
				return date.toLocaleString();
			}
		}

		function formatBytes(bytes) {
			if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '0 B';
			const units = ['B', 'KB', 'MB', 'GB'];
			let value = bytes;
			let index = 0;
			while (value >= 1024 && index < units.length - 1) {
				value /= 1024;
				index += 1;
			}
			return (index === 0 || value >= 10 ? String(Math.round(value)) : value.toFixed(1)) + ' ' + units[index];
		}

		function errorMessage(error) {
			return error?.message || String(error);
		}

		/** Group key for one recorded working directory. */
		function normalizeCwd(cwd) {
			return String(cwd).replace(/[\\/]+$/, '').replace(/\//g, '\\').toLowerCase();
		}

		/** Last path segment, used as an orphan group's display name. */
		function baseName(cwd) {
			const trimmed = String(cwd).replace(/[\\/]+$/, '');
			const index = Math.max(trimmed.lastIndexOf('\\'), trimmed.lastIndexOf('/'));
			return index < 0 ? trimmed : trimmed.slice(index + 1);
		}

		const EMPTY_WORKSPACE_STATE = { items: [], archivedSessionIds: [], pinnedSessionIds: [], phase: 'ready' };
		const EMPTY_SESSION_STATE = { ids: [], byId: {}, phase: 'ready', projectionsBySession: {} };
		const useWorkspacesFallback = (selector) => selector(EMPTY_WORKSPACE_STATE);
		const useSessionsFallback = (selector) => selector(EMPTY_SESSION_STATE);

		/**
		 * One group's select-all checkbox, including its indeterminate state.
		 * @param props - checked, indeterminate, disabled, label, text, onChange.
		 * @returns React element.
		 */
		function GroupSelect(props) {
			const ref = React.useRef(null);
			React.useEffect(() => {
				if (ref.current !== null) ref.current.indeterminate = props.indeterminate === true;
			}, [props.indeterminate]);
			return h('label', { className: 'das-group-select', title: props.label }, [
				h('input', {
					key: 'input',
					ref,
					type: 'checkbox',
					checked: props.checked === true,
					disabled: props.disabled === true,
					'aria-label': props.label,
					onChange: props.onChange,
				}),
				h('span', { key: 'text' }, props.text),
			]);
		}
		// #endregion

		// #region component
		/**
		 * One Settings section: archived rows grouped by workspace or recorded
		 * directory, with restore and permanent delete.
		 * @param props - slot props plus the plugin's `services` face.
		 * @returns React element tree.
		 */
		function Section(props) {
			const services = props.services;
			const t = typeof props.t === 'function' ? props.t : services.tr;
			const useWorkspaces = typeof props.useWorkspaces === 'function' ? props.useWorkspaces : useWorkspacesFallback;
			const useSessions = typeof props.useSessions === 'function' ? props.useSessions : useSessionsFallback;
			const workspaceState = useWorkspaces((state) => state);
			const sessionState = useSessions((state) => state);

			const [query, setQuery] = React.useState('');
			const [busyId, setBusyId] = React.useState(null);
			const [confirmingId, setConfirmingId] = React.useState(null);
			const [inspectState, setInspectState] = React.useState({ status: 'idle' });
			const [notice, setNotice] = React.useState(null);
			const [removedIds, setRemovedIds] = React.useState([]);
			const [collapsedKeys, setCollapsedKeys] = React.useState([]);
			const [refreshing, setRefreshing] = React.useState(false);
			const [selectedIds, setSelectedIds] = React.useState([]);
			const [batch, setBatch] = React.useState(null);
			const [confirmingBatchDelete, setConfirmingBatchDelete] = React.useState(false);

			const archivedIds = Array.isArray(workspaceState?.archivedSessionIds) ? workspaceState.archivedSessionIds : [];
			const workspaceItems = Array.isArray(workspaceState?.items) ? workspaceState.items : [];
			const byId = sessionState?.byId ?? {};
			const phase = sessionState?.phase ?? workspaceState?.phase ?? 'ready';

			const groups = React.useMemo(() => {
				const membership = new Map();
				const orderOfWorkspace = new Map();
				workspaceItems.forEach((workspace, index) => {
					if (workspace === undefined || workspace === null) return;
					if (typeof workspace.workspaceId === 'string') orderOfWorkspace.set(workspace.workspaceId, index);
					for (const id of Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []) membership.set(id, workspace);
				});

				const seen = new Set();
				const buckets = new Map();
				const bucket = (key, factory) => {
					let found = buckets.get(key);
					if (found === undefined) {
						found = factory();
						buckets.set(key, found);
					}
					return found;
				};

				for (const rawId of archivedIds) {
					if (typeof rawId !== 'string' || seen.has(rawId) || removedIds.includes(rawId)) continue;
					seen.add(rawId);
					const summary = byId[rawId];
					if (summary !== undefined && summary?.origin === 'subagent') continue;
					const stale = summary === undefined && phase === 'ready';
					const workspace = membership.get(rawId);
					let target;
					if (stale) {
						target = bucket('stale', () => ({ key: 'stale', kind: 'stale', title: '', path: '', rows: [] }));
					} else if (workspace !== undefined) {
						const workspaceKey = 'ws:' + String(workspace.workspaceId ?? workspace.path ?? 'unknown');
						target = bucket(workspaceKey, () => ({
							key: workspaceKey,
							kind: 'workspace',
							workspaceId: workspace.workspaceId,
							title: workspace.title || workspace.path || '',
							path: workspace.path || '',
							rows: [],
						}));
					} else if (typeof summary?.cwd === 'string' && summary.cwd !== '') {
						const cwdKey = 'cwd:' + normalizeCwd(summary.cwd);
						target = bucket(cwdKey, () => ({ key: cwdKey, kind: 'orphan', title: baseName(summary.cwd), path: summary.cwd, rows: [] }));
					} else {
						target = bucket('nocwd', () => ({ key: 'nocwd', kind: 'nocwd', title: '', path: '', rows: [] }));
					}
					target.rows.push({
						id: rawId,
						title: summary?.displayTitle || summary?.title || '',
						updatedAt: typeof summary?.updatedAt === 'number' ? summary.updatedAt : 0,
						cwd: typeof summary?.cwd === 'string' ? summary.cwd : '',
						stale,
					});
				}

				const rank = (group) => (group.kind === 'workspace' ? 0 : group.kind === 'orphan' ? 1 : group.kind === 'nocwd' ? 2 : 3);
				const list = [...buckets.values()];
				list.sort((left, right) => {
					if (rank(left) !== rank(right)) return rank(left) - rank(right);
					if (left.kind === 'workspace') {
						const leftOrder = orderOfWorkspace.get(left.workspaceId);
						const rightOrder = orderOfWorkspace.get(right.workspaceId);
						return (leftOrder ?? 0) - (rightOrder ?? 0);
					}
					if (left.kind === 'orphan') return left.path.toLowerCase().localeCompare(right.path.toLowerCase());
					return 0;
				});
				for (const group of list) {
					group.rows.sort((left, right) => (right.updatedAt - left.updatedAt) || left.id.localeCompare(right.id));
				}
				return list;
			}, [archivedIds, byId, workspaceItems, removedIds, phase]);

			const totalRows = groups.reduce((sum, group) => sum + group.rows.length, 0);
			const normalizedQuery = query.trim().toLowerCase();
			const visibleGroups = React.useMemo(() => {
				if (normalizedQuery === '') return groups;
				const matches = [];
				for (const group of groups) {
					const haystack = (group.title + ' ' + group.path).toLowerCase();
					const rows = group.rows.filter(
						(row) => (row.title + ' ' + row.cwd + ' ' + row.id).toLowerCase().includes(normalizedQuery) || haystack.includes(normalizedQuery),
					);
					if (rows.length > 0) matches.push(Object.assign({}, group, { rows }));
				}
				return matches;
			}, [groups, normalizedQuery]);
			const visibleCount = visibleGroups.reduce((sum, group) => sum + group.rows.length, 0);

			const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
			const selectedRows = React.useMemo(
				() => groups.flatMap((group) => group.rows).filter((row) => selectedSet.has(row.id)),
				[groups, selectedSet],
			);
			const staleSelectedCount = selectedRows.filter((row) => row.stale).length;

			React.useEffect(() => {
				if (notice === null) return undefined;
				const timer = setTimeout(() => setNotice(null), 4000);
				return () => clearTimeout(timer);
			}, [notice]);

			React.useEffect(() => {
				setRemovedIds((previous) => {
					const next = previous.filter((id) => archivedIds.includes(id));
					return next.length === previous.length ? previous : next;
				});
			}, [archivedIds]);

			React.useEffect(() => {
				setSelectedIds((previous) => {
					const next = previous.filter((id) => archivedIds.includes(id));
					return next.length === previous.length ? previous : next;
				});
			}, [archivedIds]);

			React.useEffect(() => {
				setConfirmingBatchDelete(false);
			}, [selectedIds.length]);

			React.useEffect(() => {
				if (confirmingId === null) {
					setInspectState({ status: 'idle' });
					return undefined;
				}
				let cancelled = false;
				setInspectState({ status: 'loading' });
				services.inspect(confirmingId).then(
					(info) => { if (!cancelled) setInspectState({ status: 'ready', info }); },
					(error) => { if (!cancelled) setInspectState({ status: 'error', error }); },
				);
				return () => { cancelled = true; };
			}, [confirmingId, services]);

			React.useEffect(() => {
				if (confirmingId === null) return undefined;
				const onKeyDown = (event) => {
					if (event.key === 'Escape') {
						event.stopPropagation();
						setConfirmingId(null);
					}
				};
				document.addEventListener('keydown', onKeyDown);
				return () => document.removeEventListener('keydown', onKeyDown);
			}, [confirmingId]);

			const titleOf = (row) => (row.stale ? t('staleRowTitle') : (row.title || t('untitled')));

			const toggleGroup = (key) => {
				setCollapsedKeys((previous) => (
					previous.includes(key) ? previous.filter((item) => item !== key) : previous.concat(key)
				));
			};

			const clearSelection = () => {
				setSelectedIds([]);
				setConfirmingBatchDelete(false);
			};

			const toggleSelected = (id) => {
				if (batch !== null) return;
				setSelectedIds((previous) => (
					previous.includes(id) ? previous.filter((item) => item !== id) : previous.concat(id)
				));
			};

			const toggleGroupSelection = (group) => {
				if (batch !== null) return;
				const ids = group.rows.map((row) => row.id);
				setSelectedIds((previous) => {
					const all = ids.length > 0 && ids.every((id) => previous.includes(id));
					if (all) {
						const remove = new Set(ids);
						return previous.filter((id) => !remove.has(id));
					}
					return [...new Set(previous.concat(ids))];
				});
			};

			const restore = async (row, group) => {
				setBusyId(row.id);
				try {
					await services.restore(row.id);
					const ungrouped = group.kind === 'orphan' || group.kind === 'nocwd';
					setNotice({ kind: 'success', text: t(ungrouped ? 'restoredUngrouped' : 'restored', { title: titleOf(row) }) });
				} catch (error) {
					setNotice({ kind: 'error', text: t('restoreFailed', { message: errorMessage(error) }) });
				} finally {
					setBusyId(null);
				}
			};

			const remove = async (row) => {
				setBusyId(row.id);
				try {
					await services.remove(row.id);
					setRemovedIds((previous) => (previous.includes(row.id) ? previous : previous.concat(row.id)));
					setConfirmingId(null);
					const refreshed = await services.refreshSessions().catch(() => false);
					setNotice({
						kind: refreshed ? 'success' : 'warn',
						text: refreshed
							? t(row.stale ? 'cleaned' : 'deleted', { title: titleOf(row) })
							: t('refreshAfterDeleteFailed'),
					});
				} catch (error) {
					const code = error?.code;
					setNotice({
						kind: 'error',
						text: code === 'session-active'
							? t('sessionActive')
							: code === 'session-not-archived'
								? t('notArchived')
								: t('deleteFailed', { message: errorMessage(error) }),
					});
				} finally {
					setBusyId(null);
				}
			};

			const refresh = async () => {
				setRefreshing(true);
				try {
					const refreshed = await services.refreshSessions();
					if (!refreshed) throw new Error('session list refresh unavailable');
				} catch (error) {
					setNotice({ kind: 'error', text: t('refreshFailed', { message: errorMessage(error) }) });
				} finally {
					setRefreshing(false);
				}
			};

			const batchRestore = async () => {
				if (batch !== null) return;
				const targets = selectedRows.slice();
				const restorable = targets.filter((row) => !row.stale);
				const skipped = targets.length - restorable.length;
				if (restorable.length === 0) {
					setNotice({ kind: 'warn', text: t('batchRestoreNothing') });
					return;
				}
				setBatch({ kind: 'restore', done: 0, total: restorable.length });
				let ok = 0;
				const failed = [];
				for (let index = 0; index < restorable.length; index += 1) {
					const row = restorable[index];
					try {
						await services.restore(row.id);
						ok += 1;
						setRemovedIds((previous) => (previous.includes(row.id) ? previous : previous.concat(row.id)));
					} catch {
						failed.push(row.id);
					}
					setBatch({ kind: 'restore', done: index + 1, total: restorable.length });
				}
				setSelectedIds(failed);
				const base = failed.length === 0
					? t('batchRestoredOk', { count: ok })
					: t('batchRestoredPartial', { ok, failed: failed.length });
				setNotice({
					kind: failed.length === 0 ? 'success' : 'warn',
					text: base + (skipped > 0 ? ' ' + t('batchRestoreSkipped', { skipped }) : ''),
				});
				setBatch(null);
			};

			const batchRemove = async () => {
				if (batch !== null) return;
				const targets = selectedRows.slice();
				if (targets.length === 0) return;
				setConfirmingBatchDelete(false);
				setBatch({ kind: 'delete', done: 0, total: targets.length });
				let ok = 0;
				const failed = [];
				for (let index = 0; index < targets.length; index += 1) {
					const row = targets[index];
					try {
						await services.remove(row.id);
						ok += 1;
						setRemovedIds((previous) => (previous.includes(row.id) ? previous : previous.concat(row.id)));
					} catch {
						failed.push(row.id);
					}
					setBatch({ kind: 'delete', done: index + 1, total: targets.length });
				}
				setSelectedIds(failed);
				const refreshed = await services.refreshSessions().catch(() => false);
				const base = failed.length === 0
					? t('batchDeletedOk', { count: ok })
					: t('batchDeletedPartial', { ok, failed: failed.length });
				setNotice({
					kind: failed.length === 0 ? 'success' : 'warn',
					text: base + (refreshed ? '' : ' ' + t('batchRefreshHint')),
				});
				setBatch(null);
			};

			const renderConfirm = (row) => {
				const info = inspectState.status === 'ready' ? inspectState.info : null;
				const detail = inspectState.status === 'loading'
					? t('inspectLoading')
					: inspectState.status === 'error'
						? t('deleteFailed', { message: errorMessage(inspectState.error) })
						: info?.found
							? t('confirmLogInfo', { files: info.files, size: formatBytes(info.bytes) })
							: t('confirmMissingLog');
				const heading = row.stale ? t('confirmCleanupTitle') : t('confirmTitle', { title: titleOf(row) });
				return h('div', {
					className: 'das-confirm',
					role: 'group',
					'aria-label': heading,
				}, [
					h('div', { className: 'das-confirm-title', key: 'title' }, heading),
					h('div', { className: 'das-confirm-detail', key: 'detail' }, detail),
					info?.found && Array.isArray(info.paths) && info.paths.length > 0
						? h('div', { className: 'das-path', key: 'path', title: info.paths.join('\n') }, info.paths[0])
						: null,
					info?.live === true
						? h('div', { className: 'das-confirm-warning', key: 'live' }, t('liveWarning'))
						: null,
					h('div', { className: 'das-confirm-warning', key: 'warning' }, row.stale ? t('cleanupNote') : t('confirmWarning')),
					h('div', { className: 'das-confirm-actions', key: 'actions' }, [
						h('button', {
							type: 'button',
							className: 'das-button',
							key: 'cancel',
							autoFocus: true,
							disabled: busyId === row.id || batch !== null,
							onClick: () => setConfirmingId(null),
						}, t('cancel')),
						h('button', {
							type: 'button',
							className: 'das-button das-danger-solid',
							key: 'delete',
							disabled: busyId === row.id || batch !== null,
							onClick: () => remove(row),
						}, busyId === row.id ? t('deleting') : row.stale ? t('cleanup') : t('confirmDelete')),
					]),
				]);
			};

			const renderRow = (row, group) => {
				const title = titleOf(row);
				const confirmOpen = confirmingId === row.id;
				const busy = busyId === row.id;
				const disabled = busyId !== null || batch !== null;
				const actions = [];
				if (!row.stale) {
					actions.push(h('button', {
						type: 'button',
						className: 'das-button',
						key: 'restore',
						disabled,
						'aria-label': t('restoreAria', { title }),
						onClick: () => restore(row, group),
					}, busy ? t('restoreBusy') : t('restore')));
				}
				actions.push(h('button', {
					type: 'button',
					className: 'das-button das-danger',
					key: 'delete',
					disabled,
					'aria-expanded': confirmOpen,
					'aria-label': row.stale ? t('cleanupAria', { title }) : t('deleteAria', { title }),
					onClick: () => setConfirmingId(confirmOpen ? null : row.id),
				}, row.stale ? t('cleanup') : t('delete')));
				return h('li', { className: 'das-item', key: row.id }, [
					h('div', { className: 'das-row', key: 'row' }, [
						h('span', { className: 'das-row-check', key: 'check' }, h('input', {
							type: 'checkbox',
							checked: selectedSet.has(row.id),
							disabled: batch !== null,
							'aria-label': t('selectRow', { title }),
							onChange: () => toggleSelected(row.id),
						})),
						h('div', { className: 'das-row-main', key: 'main' }, [
							h('div', { className: 'das-row-title', title, key: 'title' }, title),
							h('div', { className: 'das-row-meta', key: 'meta' }, [
								row.stale ? h('span', { className: 'das-badge das-badge-warn', key: 'badge' }, t('staleBadge')) : null,
								row.updatedAt > 0 ? h('span', { key: 'time' }, formatTime(row.updatedAt)) : null,
								h('span', { className: 'das-mono', key: 'id' }, row.id),
							]),
						]),
						h('div', { className: 'das-row-actions', key: 'actions' }, actions),
					]),
					confirmOpen ? renderConfirm(row) : null,
				]);
			};

			const renderGroup = (group) => {
				const groupTitle = group.kind === 'nocwd'
					? t('noCwdGroup')
					: group.kind === 'stale'
						? t('staleGroup')
						: group.title || t('untitled');
				const hint = group.kind === 'orphan'
					? t('orphanHint')
					: group.kind === 'nocwd'
						? t('noCwdHint')
						: group.kind === 'stale'
							? t('staleHint')
							: '';
				const collapsed = normalizedQuery === '' && collapsedKeys.includes(group.key);
				const groupIds = group.rows.map((row) => row.id);
				const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selectedSet.has(id));
				const someGroupSelected = !allGroupSelected && groupIds.some((id) => selectedSet.has(id));
				return h('section', { className: 'das-group', key: group.key }, [
					h('div', { className: 'das-group-head', key: 'head' }, [
						h(GroupSelect, {
							key: 'select',
							checked: allGroupSelected,
							indeterminate: someGroupSelected,
							disabled: batch !== null,
							label: t('selectGroup', { title: groupTitle }),
							text: t('selectGroupShort'),
							onChange: () => toggleGroupSelection(group),
						}),
						h('button', {
							type: 'button',
							className: 'das-group-header',
							key: 'header',
							'aria-expanded': !collapsed,
							'aria-label': t(collapsed ? 'expandGroup' : 'collapseGroup', { title: groupTitle }),
							onClick: () => toggleGroup(group.key),
						}, [
							h('span', { className: 'das-chevron' + (collapsed ? ' das-chevron-collapsed' : ''), key: 'chevron', 'aria-hidden': 'true' }, '▾'),
							h('span', { className: 'das-group-title', key: 'title' }, groupTitle),
							group.kind === 'orphan' ? h('span', { className: 'das-badge das-badge-warn', key: 'orphan' }, t('orphanBadge')) : null,
							group.kind === 'stale' ? h('span', { className: 'das-badge das-badge-warn', key: 'stale' }, t('staleBadge')) : null,
							h('span', { className: 'das-group-count', key: 'count' }, String(group.rows.length)),
							group.path !== '' ? h('span', { className: 'das-group-path', key: 'path', title: group.path }, group.path) : null,
						]),
					]),
					!collapsed && hint !== '' ? h('p', { className: 'das-group-hint', key: 'hint' }, hint) : null,
					!collapsed ? h('ul', { className: 'das-list', key: 'list' }, group.rows.map((row) => renderRow(row, group))) : null,
				]);
			};

			const idle = phase === 'pending';

			return h('div', { className: 'das-root' }, [
				h('style', { key: 'css' }, CSS),
				h('div', { className: 'das-header', key: 'header' }, [
					h('div', { className: 'das-heading', key: 'heading' }, [
						h('h3', { className: 'das-title', key: 'title' }, t('title')),
						h('p', { className: 'das-description', key: 'description' }, t('description')),
					]),
					h('button', {
						type: 'button',
						className: 'das-button',
						key: 'refresh',
						disabled: refreshing,
						onClick: refresh,
					}, refreshing ? t('refreshing') : t('refresh')),
				]),
				h('div', { className: 'das-sticky', key: 'sticky' }, [
					h('div', { className: 'das-toolbar', key: 'toolbar' }, [
					h('input', {
						key: 'filter',
						className: 'das-input',
						type: 'search',
						value: query,
						placeholder: t('filterPlaceholder'),
						'aria-label': t('filterPlaceholder'),
						onChange: (event) => setQuery(event.target.value),
					}),
					h('span', { className: 'das-count', key: 'count' },
						normalizedQuery === ''
							? t('count', { count: totalRows })
							: t('filteredCount', { count: visibleCount })),
				]),
				notice !== null
					? h('div', {
						key: 'notice',
						className: 'das-notice' + (notice.kind === 'error' ? ' das-notice-error' : notice.kind === 'warn' ? ' das-notice-warn' : ''),
						role: 'status',
					}, notice.text)
					: null,
				selectedIds.length > 0 || batch !== null
					? h('div', { className: 'das-selection', key: 'selection' }, [
						h('div', { className: 'das-selection-row', key: 'row' }, [
							h('span', { className: 'das-selection-count', key: 'count' }, t('selectionCount', { count: selectedIds.length })),
							batch !== null
								? h('span', { className: 'das-selection-progress', key: 'progress', role: 'status' },
									batch.kind === 'restore'
										? t('batchRestoring', { done: batch.done, total: batch.total })
										: t('batchDeleting', { done: batch.done, total: batch.total }))
								: null,
							h('div', { className: 'das-selection-actions', key: 'actions' }, [
								h('button', {
									type: 'button',
									className: 'das-button',
									key: 'restore',
									disabled: batch !== null,
									onClick: batchRestore,
								}, t('batchRestore')),
								h('button', {
									type: 'button',
									className: 'das-button das-danger',
									key: 'delete',
									disabled: batch !== null,
									onClick: () => setConfirmingBatchDelete(true),
								}, t('batchDelete')),
								h('button', {
									type: 'button',
									className: 'das-button',
									key: 'clear',
									disabled: batch !== null,
									onClick: clearSelection,
								}, t('clearSelection')),
							]),
						]),
						confirmingBatchDelete && batch === null
							? h('div', {
								className: 'das-confirm das-batch-confirm',
								key: 'confirm',
								role: 'group',
								'aria-label': t('confirmBatchDelete'),
							}, [
								h('div', {
									className: 'das-confirm-title',
									key: 'title',
								}, t(
									staleSelectedCount > 0 ? 'batchDeleteConfirm' : 'batchDeleteConfirmNoStale',
									{ count: selectedRows.length, stale: staleSelectedCount },
								)),
								h('div', { className: 'das-confirm-warning', key: 'warning' }, t('confirmWarning')),
								h('div', { className: 'das-confirm-actions', key: 'buttons' }, [
									h('button', {
										type: 'button',
										className: 'das-button',
										key: 'cancel',
										onClick: () => setConfirmingBatchDelete(false),
									}, t('cancel')),
									h('button', {
										type: 'button',
										className: 'das-button das-danger-solid',
										key: 'confirm',
										onClick: batchRemove,
									}, t('confirmBatchDelete')),
								]),
							])
							: null,
					])
					: null,
				]),
				idle
					? h('div', { className: 'das-loading', key: 'loading' }, t('inspectLoading'))
					: visibleGroups.length === 0
						? h('div', { className: 'das-empty', key: 'empty' }, [
							h('div', { className: 'das-empty-title', key: 'title' }, t('empty')),
							h('div', { key: 'hint' }, t('emptyHint')),
						])
						: h('div', { className: 'das-groups', key: 'groups' }, visibleGroups.map(renderGroup)),
				h('div', { className: 'das-footer', key: 'footer' }, t('attachmentNote')),
			]);
		}
		// #endregion

		// #region plugin
		/**
		 * Client plugin body: dictionaries, the Settings section, and the
		 * Host-facing operations the section calls.
		 * @param ctx - client root context.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'archived-sessions: dictionaries');
			const tr = createTranslator(ctx);
			const services = {
				tr,
				restore: async (sessionId) => {
					const uiWorkspace = ctx.get('uiWorkspace');
					if (!uiWorkspace || typeof uiWorkspace.unarchiveSession !== 'function') {
						throw new Error('uiWorkspace.unarchiveSession is unavailable');
					}
					await uiWorkspace.unarchiveSession(sessionId);
				},
				inspect: (sessionId) => postJson('api/archived-sessions/inspect', { sessionId }),
				remove: (sessionId) => postJson('api/archived-sessions/delete', { sessionId, confirm: true }),
				refreshSessions: async () => {
					const sessions = ctx.get('sessions');
					if (!sessions || typeof sessions.refresh !== 'function') return false;
					await sessions.refresh();
					return true;
				},
			};
			const Bound = (slotProps) => h(Section, Object.assign({}, slotProps, { services }));
			ctx.slots.inject('settings.section', () => ctx.slots.register({
				name: 'settings.section',
				id: 'archived-sessions',
				order: 25,
				label: () => tr('nav'),
				locale: NS,
			}, Bound));
		}
		// #endregion

		return { inject: ['slots', 'locale'], apply };
	},
});
