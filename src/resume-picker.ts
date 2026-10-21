/**
 * The interactive `/resume` picker. Every string and key below is recovered; the offsets are
 * zero-based UTF-16 code units into the named module.
 *
 * | Module | SHA-256 | Range | Contents |
 * | --- | --- | --- | --- |
 * | `chunk-er09v3xa.js` | `f026decc1a34748d4ef11cab0a3116e299f2039f57757758f89137e50e051be9` | `Jln` 9331 | the picker component |
 * | ↳ | | 16048 / 16185 | `Resume session` and the `(i of n)` / `Refreshing…` title |
 * | ↳ | | 16618 | `No sessions match "<query>".` |
 * | ↳ | | 16873 | `No conversations found in this project.` |
 * | ↳ | | 17035 | `Rename session:` |
 * | ↳ | | 17969 | `Press <key> again to exit` |
 * | ↳ | | `Lt` 8855 / `Dt` 9186 | the row label and description builders |
 * | ↳ | | `Eo` 8517 / `Sn` 8302 | the search snippet and its dimmed frame |
 * | ↳ | | `wo` 19966 | fork grouping by session id |
 * | ↗ | | `Ue` entry 27KB in `chunk-14ept3y3.js` | list, search, load-more, preview, rename |
 * | `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | `non` 12412 | the `time · count` description |
 * | `chunk-gsnbskq4.js` | `d3a5291c4b2208b78602b8cfe03d071dfd32c076a70bbd9cbe0276068ca300ee` | `p4` | the title precedence |
 *
 * The source component is a full panel: search-as-you-type, fork groups with left/right expand,
 * all-projects / branch / worktree filters, a preview page, rename, background-session attach and
 * load-more paging. This host has one workspace, no branch or worktree metadata in its session
 * summary and no background-session surface, so those branches are out; the list, filter, fork
 * grouping, search mode, empty/no-match text and the select/cancel keys are ported. Preview and
 * rename stay out of this record until their host callbacks exist.
 */

import { cellWidth, createEditorState, type EditorAction } from './terminal.js';

/** `Jln` 16048. */
export const RESUME_PICKER_TITLE = 'Resume session';
/** `Jln` 16873, the `showAllProjects === false` arm (`T ? ... : ...`). */
export const RESUME_EMPTY_TEXT = 'No conversations found in this project.';
/** `Jln` 16618. */
export const resumeNoMatchText = (query: string): string => `No sessions match "${query}".`;
/** `Jln` 17969, the cancel hint while a second press is pending. */
export const resumeExitHint = (keyName: string): string => `Press ${keyName} again to exit`;

/** A local session row, reduced to the fields the recovered row builders read. */
export interface ResumeSession {
  id: string;
  title?: string;
  updated: string;
  active?: boolean;
  parent?: { id: string };
}

/** One stored conversation message, as the preview page reads it back (`mAe`). */
export interface ResumePreviewMessage { role: 'user' | 'assistant'; text: string }
export interface ResumePreview { messages: readonly ResumePreviewMessage[]; messageCount: number }

export interface ResumePickerInput {
  logs: readonly ResumeSession[];
  /** The session the CLI is in; the source filters it out (`q` in `Jln` and `q` in `filterResumableSessions`). */
  currentId?: string;
  /** Fixed clock for tests; the product passes the wall clock. */
  now?: number;
  /**
   * `mAe` for a row whose summary carries no messages: read the target journal back for the
   * preview page. A reader failure leaves the page empty rather than closing the panel.
   */
  preview?: (log: ResumeSession) => ResumePreview;
  /** `Pz`: append the custom title to the target journal. Throws keep the rename form open. */
  rename?: (log: ResumeSession, title: string) => void;
}

export interface ResumePickerOptions {
  query?: string;
  expanded?: ReadonlySet<string>;
  currentId?: string;
  now?: number;
}

export type ResumePickerRow =
  | { kind: 'group'; key: string; log: ResumeSession; label: string; description: string; childCount: number }
  | { kind: 'log'; key: string; log: ResumeSession; label: string; description: string; child: boolean };

/** `p4` with the local summary fields: custom title, then the short id. */
export function resumeSessionName(log: ResumeSession): string {
  return (log.title ?? log.id.slice(0, 8)).trim();
}

function rootOf(log: ResumeSession, byId: ReadonlyMap<string, ResumeSession>): string {
  let current = log;
  const seen = new Set<string>([current.id]);
  while (current.parent !== undefined) {
    const parent = byId.get(current.parent.id);
    if (parent === undefined || seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
  }
  return current.id;
}

/** `wo` 19966: group by conversation family, newest first inside each group. */
export function groupResumeSessions(logs: readonly ResumeSession[], currentId?: string): Map<string, ResumeSession[]> {
  const byId = new Map(logs.map(log => [log.id, log]));
  const groups = new Map<string, ResumeSession[]>();
  for (const log of logs) {
    if (log.id === currentId) continue;
    const key = rootOf(log, byId);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [log]); else list.push(log);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  }
  return groups;
}

/** `nt`: the list filter matches the title and the branch/tag/PR tokens; this host matches title and id. */
export function filterResumeSessions(logs: readonly ResumeSession[], query: string): ResumeSession[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...logs];
  return logs.filter(log => resumeSessionName(log).toLowerCase().includes(needle)
    || log.id.toLowerCase().includes(needle));
}

/** `rw`/`non` 12412 with the local fields: a short relative time. */
export function resumeRelativeTime(updated: string, now = Date.now()): string {
  const then = new Date(updated).getTime();
  const seconds = Math.round((then - now) / 1000);
  const magnitude = Math.abs(seconds);
  const [value, unit] = magnitude < 60 ? [seconds, 'second']
    : magnitude < 3600 ? [Math.round(seconds / 60), 'minute']
      : magnitude < 86_400 ? [Math.round(seconds / 3600), 'hour']
        : magnitude < 604_800 ? [Math.round(seconds / 86_400), 'day']
          : magnitude < 2_592_000 ? [Math.round(seconds / 604_800), 'week']
            : magnitude < 31_536_000 ? [Math.round(seconds / 2_592_000), 'month']
              : [Math.round(seconds / 31_536_000), 'year'];
  return new Intl.RelativeTimeFormat('en-US', { style: 'short', numeric: seconds <= 0 ? 'always' : 'auto' })
    .format(value, unit as Intl.RelativeTimeFormatUnit);
}

/** `mo` 8234: collapse whitespace, then truncate with the recovered ellipsis rule (`ct`). */
export function resumeClip(text: string, width: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (width <= 0) return '';
  if (cellWidth(flat) <= width) return flat;
  if (width <= 1) return '…';
  let used = 0, out = '';
  for (const character of flat) {
    const next = cellWidth(character);
    if (used + next > width - 1) break;
    out += character; used += next;
  }
  return out + '…';
}

/** `Lt` 8855: title, the fork suffix on a group header, clipped to the remaining width. */
export function resumeRowLabel(log: ResumeSession, width: number, options: { group?: boolean; child?: boolean;
  childCount?: number } = {}): string {
  const indent = options.child ? 4 : options.group && (options.childCount ?? 0) > 0 ? 2 : 0;
  const suffix = options.group && (options.childCount ?? 0) > 0
    ? ` (+${options.childCount} other ${options.childCount === 1 ? 'session' : 'sessions'})` : '';
  return resumeClip(resumeSessionName(log), width - indent - suffix.length) + suffix;
}

/** `Dt` 9186: the child indent plus `non`'s time token. */
export function resumeRowDescription(log: ResumeSession, now = Date.now(), child = false): string {
  return `${child ? '    ' : ''}${resumeRelativeTime(log.updated, now)}`;
}

function rowsOf(logs: readonly ResumeSession[], options: ResumePickerOptions, width: number): ResumePickerRow[] {
  const groups = groupResumeSessions(logs, options.currentId);
  const expanded = options.expanded ?? new Set<string>();
  const rows: ResumePickerRow[] = [];
  for (const [key, list] of groups) {
    const [first, ...rest] = list as [ResumeSession, ...ResumeSession[]];
    const group = rest.length > 0;
    if (group) {
      rows.push({ kind: 'group', key: `log:${first.id}`, log: first,
        label: resumeRowLabel(first, width, { group, childCount: rest.length }),
        description: resumeRowDescription(first, options.now), childCount: rest.length });
    } else {
      rows.push({ kind: 'log', key: `log:${first.id}`, log: first, child: false,
        label: resumeRowLabel(first, width), description: resumeRowDescription(first, options.now) });
    }
    if (group && !expanded.has(key)) continue;
    for (const log of rest) {
      rows.push({ kind: 'log', key: `log:${log.id}`, log, child: true,
        label: resumeRowLabel(log, width, { child: true }), description: resumeRowDescription(log, options.now, true) });
    }
  }
  return rows;
}

/** The recovered list, filter and fork-grouping chain over the local summaries. */
export function resumePickerRows(input: ResumePickerInput, options: ResumePickerOptions = {}, width = 80): ResumePickerRow[] {
  const visible = filterResumeSessions(input.logs, options.query ?? '');
  return rowsOf(visible, { ...options, currentId: options.currentId ?? input.currentId,
    now: options.now ?? input.now }, width);
}

/** `Jln` 17969 guide line, reduced to the keys this host implements. */
export function resumePickerGuide(mode: 'list' | 'search' | 'rename' | 'preview'): string {
  if (mode === 'search') return 'Type to Search / Enter select / Esc clear';
  if (mode === 'rename') return 'Enter save / Esc cancel';
  if (mode === 'preview') return 'Enter resume / Esc cancel';
  return 'Type to search / Enter select / Esc cancel';
}

/** `p4(I, "Enter new session name")`: the current title, else the input placeholder. */
export function resumeRenamePlaceholder(log: ResumeSession | undefined): string {
  return log === undefined ? 'Enter new session name' : resumeSessionName(log);
}

/**
 * `Jln`'s state machine over the ported surface: free-text search, list focus, fork expansion,
 * the search/list mode pair and the preview/rename pages. The all-projects/branch/worktree
 * filters and load-more paging stay out because the local summary carries none of those fields.
 */
export class ResumePicker {
  private readonly input: ResumePickerInput;
  private editor = createEditorState();
  private mode: 'list' | 'search' | 'preview' | 'rename' = 'list';
  private expanded = new Set<string>();
  private focus = 0;
  private previewLog: ResumeSession | undefined;
  private previewData: ResumePreview | undefined;
  private renameLog: ResumeSession | undefined;
  private renameEditor = createEditorState();
  private renameFailure: string | undefined;
  width = 80;

  constructor(input: ResumePickerInput) {
    this.input = input;
    if (input.currentId !== undefined) {
      // The first row is the newest family; keep the list-focus contract at index 0.
      this.focus = 0;
    }
  }

  get query(): string { return this.editor.text; }
  get cursor(): number { return this.editor.cursor; }
  get searching(): boolean { return this.mode === 'search'; }
  get previewing(): boolean { return this.mode === 'preview'; }
  get renaming(): boolean { return this.mode === 'rename'; }
  get modeName(): 'list' | 'search' | 'preview' | 'rename' { return this.mode; }
  get rows(): ResumePickerRow[] { return resumePickerRows(this.input, {
    query: this.editor.text, expanded: this.expanded, now: this.input.now }, this.width); }
  get focused(): ResumePickerRow | undefined { return this.rows[this.focus]; }
  get focusIndex(): number { return this.focus; }
  get rowCount(): number { return this.rows.length; }
  get empty(): boolean { return this.input.logs.length === 0; }
  get noMatch(): boolean { return this.rows.length === 0 && this.input.logs.length > 0 && this.query.trim() !== ''; }

  get previewSession(): ResumeSession | undefined { return this.previewLog; }
  get preview(): ResumePreview { return this.previewData ?? { messages: [], messageCount: 0 }; }
  get renameValue(): string { return this.renameEditor.text; }
  get renameCursor(): number { return this.renameEditor.cursor; }
  get renameError(): string | undefined { return this.renameFailure; }
  get renamePlaceholder(): string { return resumeRenamePlaceholder(this.renameLog); }
  get now(): number | undefined { return this.input.now; }

  setWidth(width: number): void { this.width = Math.max(20, width); }
  clamp(): void { const count = this.rows.length; this.focus = count === 0 ? 0 : Math.min(this.focus, count - 1); }
  search(): void { this.mode = 'search'; }
  list(): void { this.mode = 'list'; }
  /** `G(I)` + `C="preview"`: open the focused row's stored conversation. */
  openPreview(): void {
    const row = this.focused;
    if (row === undefined) return;
    this.previewLog = row.log;
    try { this.previewData = this.input.preview?.(row.log) ?? { messages: [], messageCount: 0 }; }
    catch { this.previewData = { messages: [], messageCount: 0 }; }
    this.mode = 'preview';
  }
  /** `Ct`'s `onExit`: back to the list, discarding the rendered page. */
  closePreview(): void { this.previewLog = undefined; this.previewData = undefined; this.mode = 'list'; }
  /** ctrl+r: the input starts empty (`te("")`); the placeholder carries the current name. */
  beginRename(): void {
    const row = this.focused;
    if (row === undefined) return;
    this.renameLog = row.log;
    this.renameEditor = createEditorState();
    this.renameFailure = undefined;
    this.mode = 'rename';
  }
  /** Esc in the rename form (`confirm:no` with `isActive`): list, value dropped. */
  cancelRename(): void { this.renameLog = undefined; this.renameEditor = createEditorState(); this.renameFailure = undefined; this.mode = 'list'; }
  renameInsert(text: string): void {
    this.renameEditor = { ...this.renameEditor,
      text: this.renameEditor.text.slice(0, this.renameEditor.cursor) + text + this.renameEditor.text.slice(this.renameEditor.cursor),
      cursor: this.renameEditor.cursor + text.length };
  }
  renameBackspace(): void {
    if (this.renameEditor.cursor === 0) return;
    this.renameEditor = { ...this.renameEditor,
      text: this.renameEditor.text.slice(0, this.renameEditor.cursor - 1) + this.renameEditor.text.slice(this.renameEditor.cursor),
      cursor: this.renameEditor.cursor - 1 };
  }
  renameReduce(action: EditorAction): void {
    if (action.type === 'insert') { this.renameInsert(action.text); return; }
    if (action.type === 'backspace') { this.renameBackspace(); return; }
  }
  /**
   * `bt`: write the trimmed value through `Pz`, then return to the list. An empty value only
   * returns; a writer failure keeps the form open with its message.
   */
  submitRename(): { log: ResumeSession; title: string } | undefined {
    const log = this.renameLog;
    const title = this.renameEditor.text.trim();
    if (log === undefined) { this.cancelRename(); return undefined; }
    if (title === '') { this.cancelRename(); return undefined; }
    try { this.input.rename?.(log, title); }
    catch (error) {
      this.renameFailure = error instanceof Error ? error.message : String(error);
      return undefined;
    }
    log.title = title;
    this.cancelRename();
    return { log, title };
  }
  clear(): void { this.editor = { ...this.editor, text: '', cursor: 0 }; this.focus = 0; this.mode = 'list'; }
  move(delta: number): void {
    const count = this.rows.length;
    if (count === 0) return;
    this.focus = Math.max(0, Math.min(count - 1, this.focus + delta));
    this.mode = 'list';
  }
  focusedKey(): string | undefined { return this.focused?.key; }
  focusKey(key: string): void {
    const index = this.rows.findIndex(row => row.key === key);
    if (index >= 0) this.focus = index;
  }
  /** Left collapses, right expands the focused fork group (`Lt`'s `rt` hint). */
  expand(direction: 'left' | 'right'): void {
    const row = this.focused;
    if (row === undefined || row.kind !== 'group') return;
    const byId = new Map(this.input.logs.map(log => [log.id, log]));
    const root = (() => {
      let current = row.log;
      const seen = new Set<string>([current.id]);
      while (current.parent !== undefined) {
        const parent = byId.get(current.parent.id);
        if (parent === undefined || seen.has(parent.id)) break;
        seen.add(parent.id); current = parent;
      }
      return current.id;
    })();
    if (direction === 'right') this.expanded.add(root); else this.expanded.delete(root);
    this.clamp();
  }
  /** Inserts typed text; a printable key moves the panel into search mode (`kt`). */
  insert(text: string): void {
    this.mode = 'search';
    this.editor = { ...this.editor, text: this.editor.text.slice(0, this.editor.cursor) + text + this.editor.text.slice(this.editor.cursor),
      cursor: this.editor.cursor + text.length };
    this.focus = 0;
  }
  backspace(): void {
    if (this.editor.cursor === 0) return;
    this.editor = { ...this.editor, text: this.editor.text.slice(0, this.editor.cursor - 1) + this.editor.text.slice(this.editor.cursor),
      cursor: this.editor.cursor - 1 };
    this.focus = 0;
  }
  reduce(action: EditorAction): void {
    if (action.type === 'insert') { this.insert(action.text); return; }
    if (action.type === 'backspace') { this.backspace(); return; }
  }
  get editorState(): typeof this.editor { return this.editor; }
}
