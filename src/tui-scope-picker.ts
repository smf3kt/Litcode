import { initializeScopePickerSource, scopePickerFramePropsFor } from './tui-scope-picker-source.js';
import { TuiDocumentRenderer, type DocumentRow } from './tui-document-renderer.js';
import { Mct } from './tui-input-paste-source.js';
import { expandPastedText, type InputSnapshot, type PastedContents } from './tui-input-paste.js';
import { layoutInput } from './tui-input-navigation.js';
import { layoutEngine } from './tui-layout.js';
import { Gt, Lr, TE } from './tui-render-engine.js';
import { en } from './tui-react-runtime.js';
import { jsx } from './tui-jsx.js';
import { s, n } from './tui-base-components.js';
import { cellWidth } from './terminal.js';
import type { InputHistoryEntry, InputHistoryTimestampedEntry } from './tui-input-history.js';

export type PickerScope = 'session' | 'project' | 'everywhere';
/** Source Kse cycle order (`$dr`); exported so hosts and tests can walk scopes deterministically. */
export const PICKER_SCOPE_ORDER: readonly PickerScope[] = ['session', 'project', 'everywhere'];
export interface ScopePickerSnapshot {
  searching: boolean; scope: PickerScope; query: string;
  status: 'scanning' | 'complete' | 'truncated' | 'failed' | null;
  items: readonly PickerRow[]; filtered: readonly PickerRow[];
  cursor: number;
}
interface PickerAPI {
  isSearching?: boolean;
  setHistoryQuery(value: string): void;
}
/** Source Kse wraps each scoped row with its display, fuzzy key and preview line. */
export interface PickerRow { entry: InputHistoryTimestampedEntry; display: string; lower: string; firstLine: string }
interface SourceState { items: PickerRow[]; status: string | null; scope: PickerScope; query: string; filtered: readonly PickerRow[] }

/** Source Kse runs on the recovered React engine; the frame is an owned host adaptation. */
/**
 * Owned picker controller for the terminal entry: it drives the scoped scan itself and renders
 * through the host, so the picker never depends on a React mount to advance. The source Kse
 * component and its `gLt` frame stay the reference for wording, order, caps and messages. Scope
 * selection lives in `InputHistory.readTimestamped`, which forwards the scope to the source reader
 * unchanged (`fss`); the reader filters on `project`/`session` and leaves `everywhere` unfiltered,
 * so cross-project rows reach the list and the caps stay in this scan (`$Lt`/`ULt` in source Kse).
 */
export class ScopedPicker {
  private open = false;
  private closed = false;
  private filterQuery = '';
  private scopeValue: PickerScope = 'everywhere';
  private cursor = 0;
  private pending: PickerRow | undefined;
  private rows: PickerRow[] = [];
  private status: ScopePickerSnapshot['status'] = null;
  private scanned = 0;
  private readonly scopes: readonly PickerScope[] = PICKER_SCOPE_ORDER;
  private scan: AbortController | undefined;
  private readonly converter = new TuiDocumentRenderer();
  /** Caret offset inside the filter query, tracked by the owning editor. */
  queryCursor = 0;

  constructor(private readonly options: {
    read(scope: PickerScope): AsyncGenerator<InputHistoryTimestampedEntry>;
    changed(snapshot: ScopePickerSnapshot): void;
    report(error: unknown): void;
  }) {}

  /** Scope currently scanned; the entry seam reads it directly instead of parsing the frame. */
  get scope(): PickerScope { return this.scopeValue; }
  get snapshot(): ScopePickerSnapshot {
    return { searching: this.open, scope: this.scopeValue, query: this.filterQuery, status: this.status,
      items: this.rows, filtered: this.filtered(), cursor: this.cursor };
  }
  get selection(): PickerRow | undefined { return this.filtered()[this.cursor]; }
  get visible(): readonly PickerRow[] { return this.filtered(); }

  /**
   * Source `_y({initialQuery})` seeds its query and caret from the consumer's `initialQuery`
   * (`[me,Q]=y(A)`, `[te,be]=y(A.length)`), and the consumer passes the current draft
   * (`e(Kse,{initialQuery: ee.value, …})`). Opening with an empty draft therefore behaves as
   * before while a non-empty draft pre-filters the list on open.
   */
  begin(initialQuery = ''): void {
    if (this.closed || this.open) return;
    this.open = true; this.cursor = 0;
    this.filterQuery = initialQuery; this.queryCursor = initialQuery.length;
    this.start(); this.publish();
  }
  query(value: string): void {
    if (this.closed || !this.open) return;
    this.filterQuery = value; this.cursor = 0; this.publish();
  }
  cycleScope(): boolean {
    if (this.closed || !this.open) return false;
    const index = this.scopes.indexOf(this.scopeValue);
    const next = this.scopes[(index + 1) % this.scopes.length]!;
    this.scan?.abort(); this.scan = undefined;
    this.scopeValue = next;
    this.cursor = 0; this.rows = []; this.status = null; this.publish(); this.start(); return true;
  }
  move(delta: number): void {
    const visible = this.filtered();
    if (!this.open || !visible.length) return;
    this.cursor = (this.cursor + delta + visible.length) % visible.length;
    this.publish();
  }
  /** Resolve the accepted row exactly as the host applies it. */
  async chosenEntry(): Promise<InputHistoryEntry | undefined> {
    const row = this.pending;
    if (!row) return undefined;
    return await row.entry.resolve();
  }
  /** Accept the row under the cursor; the caller resolves and applies the entry. */
  accept(): PickerRow | undefined {
    const row = this.selection;
    if (!this.open || !row) return undefined;
    this.open = false; this.scan?.abort(); this.scan = undefined;
    this.pending = row;
    this.publish(); return row;
  }
  cancel(): void {
    if (this.closed || (!this.open && !this.status)) return;
    this.open = false; this.scan?.abort(); this.scan = undefined;
    this.publish();
  }
  close(): void {
    if (this.closed) return;
    this.closed = true; this.scan?.abort(); this.scan = undefined;
    try { this.converter.close(); } catch (error) { this.options.report(error); }
  }
  /** Host rows: the same text the frame shows, carried as plain text for the host renderer. */
  frame(columns: number, rows: number): string[] {
    const pad = (text: string) => { let width = 0; let out = '';
      for (const part of text) { const cells = cellWidth(part); if (width + cells > columns) break; out += part; width += cells; }
      return out + ' '.repeat(Math.max(0, columns - width)); };
    const lines: string[] = [];
    const scopeNote = this.status === 'truncated' ? ` · newest ${this.rows.length.toLocaleString()} only` : '';
    lines.push(pad(`Search prompts · ${this.scopeValue}${scopeNote}${this.filterQuery ? `  Filter history… ${this.filterQuery}` : ''}`));
    const budget = Math.max(1, rows - 3);
    const list = this.filtered();
    const start = list.length > budget ? Math.max(0, Math.min(this.cursor - Math.floor(budget / 2), list.length - budget)) : 0;
    const visible = list.slice(start, start + budget);
    for (let index = 0; index < visible.length; index++) {
      const row = visible[index]!;
      const stamp = new Date(row.entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      lines.push(pad(`${start + index === this.cursor ? '>' : ' '} ${stamp.padEnd(8)} ${row.firstLine}`));
    }
    if (!visible.length) lines.push(pad(this.emptyMessage()));
    while (lines.length < rows - 1) lines.push(pad(''));
    lines.push(pad('Enter select · Ctrl+S scope · Esc cancel'));
    return lines.slice(0, rows);
  }
  /** Plain text rows converted by the shared document renderer, for hosts that want styled rows. */
  styled(columns: number, rows: number): DocumentRow[] {
    if (this.closed) return [];
    const text = this.frame(columns, rows);
    const tree = jsx(s, { flexDirection: 'column', width: columns, children:
      text.map((line, index) => jsx(n, { children: line || ' ' }, String(index))) }, undefined);
    return this.converter.renderElement(tree, columns, { theme: 'dark' });
  }
  private filtered(): readonly PickerRow[] {
    const needle = this.filterQuery.trim().toLowerCase();
    if (!needle) return this.rows;
    const scanning = this.status === 'scanning';
    const exact: PickerRow[] = [], fuzzy: PickerRow[] = [];
    for (const row of this.rows) {
      if (row.lower.includes(needle)) exact.push(row);
      else if (!scanning && isSubsequence(row.lower, needle)) fuzzy.push(row);
    }
    return exact.concat(fuzzy);
  }
  private emptyMessage(): string {
    const query = this.filterQuery.trim();
    switch (this.status) {
      case 'failed': return "Couldn't read prompt history";
      case 'scanning': return query ? 'Searching older prompts…' : 'No history yet';
      default: return query ? 'No matching prompts' : 'No history yet';
    }
  }
  private publish(): void {
    try { this.options.changed(this.snapshot); } catch (error) { this.options.report(error); }
  }
  /** Source scan: newest rows first, 16Mi counted units, a 100-row step that quadruples. */
  private start(): void {
    this.scan?.abort();
    const controller = new AbortController();
    this.scan = controller;
    this.rows = []; this.scanned = 0; this.status = 'scanning';
    const source = this.options.read(this.scopeValue)[Symbol.asyncIterator]();
    let step = 100, units = 0, truncated = false;
    const pump = (): void => {
      source.next().then(result => {
        if (controller.signal.aborted || this.closed || this.scan !== controller) { void source.return?.(undefined); return; }
        if (result.done) {
          this.status = truncated ? 'truncated' : 'complete';
          this.publish(); return;
        }
        const entry = result.value;
        const display = entry.display;
        const newline = display.indexOf('\n');
        this.rows.push({ entry, display, lower: display.toLowerCase(),
          firstLine: newline === -1 ? display : display.slice(0, newline) });
        this.scanned++;
        units += entry.textLength + 256;
        if (units >= 16777216) truncated = true;
        else if (this.rows.length >= step) { step *= 4; this.status = 'scanning'; this.publish(); }
        if (truncated) { this.status = 'truncated'; this.publish(); return; }
        pump();
      }, error => { this.fail(error, controller); });
    };
    pump();
  }
  private fail(error: unknown, controller: AbortController): void {
    if (controller.signal.aborted || this.closed) return;
    this.status = this.rows.length ? 'truncated' : 'failed';
    this.options.report(error); this.publish();
  }
}
function isSubsequence(text: string, needle: string): boolean {
  let position = 0;
  for (let index = 0; index < needle.length; index++) {
    const found = text.indexOf(needle.charAt(index), position);
    if (found === -1) return false;
    position = found + 1;
  }
  return true;
}

export class ScopePicker {
  private readonly document = new TuiDocumentRenderer();
  private themeName = 'dark';
  private themeOverrides: Record<string, string> | undefined;
  private api: PickerAPI | undefined;
  private pendingQuery = '';
  /** Stable component type: the source hooks live in the host document tree, never a second container. */
  private readonly host = () => {
    const api = this.source.Kse({
      initialQuery: this.pendingQuery,
      onSelect: (payload: { entry: InputHistoryTimestampedEntry }) => {
        this.chosen = { entry: payload.entry, display: payload.entry.display, lower: payload.entry.display.toLowerCase(), firstLine: payload.entry.display };
        this.options.changed(this.snapshot);
      },
      onCancel: () => { this.cancelled = true; this.options.changed(this.snapshot); },
    }) as unknown as PickerAPI;
    en(() => { this.api = api; this.options.changed(this.snapshot); }, undefined);
    return this.frameElement();
  };
  private readonly actions = new Map<string, () => void>();
  private readonly source;
  private open = false;
  private closed = false;
  private cursor = 0;
  private filterQuery = '';
  private last: SourceState = { items: [], status: 'scanning', scope: 'everywhere', query: '', filtered: [] };
  private filtered: readonly PickerRow[] = [];
  private chosen: PickerRow | undefined;
  private cancelled = false;
  private rows = 12;
  private rowsCache: DocumentRow[] = [];
  private rendering = false;
  private deferred = false;
  private columns = 80;
  /** Caret offset inside the filter query, tracked by the owning editor. */
  queryCursor = 0;
  private failure: unknown;

  constructor(private readonly options: {
    read(scope: PickerScope): AsyncGenerator<InputHistoryTimestampedEntry>;
    changed(snapshot: ScopePickerSnapshot): void;
    report(error: unknown): void;
    allocator: Mct;
    resolve(entry: InputHistoryTimestampedEntry): Promise<InputHistoryEntry>;
  }) {
    this.source = initializeScopePickerSource({
      read: (scope: PickerScope) => options.read(scope),
      render: undefined, report: options.report,
      presentHost: {
        register: (action: string, callback: () => void, scope: { isActive?: boolean }) => {
          if (scope?.isActive === false) this.actions.delete(action); else this.actions.set(action, callback);
        },
        registerMany: (actions: Record<string, () => void>, scope: { isActive: boolean }) => {
          for (const [action, callback] of Object.entries(actions)) {
            if (scope?.isActive === false) this.actions.delete(action); else this.actions.set(action, callback);
          }
        },
        hint: () => 'ctrl+s',
        columns: () => this.columns,
      },
      setState: (value: SourceState) => {
        const previous = this.last;
        this.last = value; this.filtered = value.filtered;
        // The source publishes on every render pass; a publish raised by the mount that is
        // currently running must not re-enter it, so those changes are replayed afterwards.
        const changed = previous.query !== value.query || previous.scope !== value.scope
          || previous.status !== value.status || previous.filtered.length !== value.filtered.length
          || previous.filtered.some((row, index) => row !== value.filtered[index]);
        if (!changed) return;
        if (this.open) { try { this.options.changed(this.snapshot); } catch (error) { this.options.report(error); } }
      },
      emit: () => {}, ae: cellWidth, ct: (text: string, budget: number) => text.slice(0, Math.max(0, budget)),
      rw: (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      wy: () => null, stampWidth: 8, previewHeight: 6,
    });
    const fail = (error: unknown) => { this.failure ??= error; options.report(error); };
    void fail;
  }

  /** Source gLt element for the state the source picker last published. */
  private frameElement(): unknown {
    const state = this.last;
    const scope = (state.scope ?? 'everywhere') as PickerScope;
    return scopePickerFramePropsFor(this.source, {
      scope, status: state.status, label: state.items.length.toLocaleString(), query: state.query,
      text: '',
      items: state.filtered, cursor: this.cursor,
      hint: this.emptyMessage({ searching: this.open, scope, query: state.query,
        status: (state.status as ScopePickerSnapshot['status']) ?? null,
        items: state.items, filtered: state.filtered, cursor: this.cursor }),
      hintRows: this.rows,
    });
  }
  setTheme(theme: string, overrides?: Record<string, string>): void {
    this.themeName = theme; this.themeOverrides = overrides;
  }
  get snapshot(): ScopePickerSnapshot {
    return { searching: this.open, scope: this.scope, query: this.filterQuery, status: this.status,
      items: this.last.items, filtered: this.filtered, cursor: this.cursor };
  }
  get selection(): PickerRow | undefined { return this.filtered[this.cursor]; }
  get done(): { entry?: InputHistoryTimestampedEntry; cancelled: boolean } {
    return { ...(this.chosen ? { entry: this.chosen.entry } : {}), cancelled: this.cancelled };
  }

  private get scope(): PickerScope { return (this.scopeValue ?? 'everywhere') as PickerScope; }
  private scopeValue: PickerScope = 'everywhere';
  private get status(): ScopePickerSnapshot['status'] { return (this.last.status as ScopePickerSnapshot['status']) ?? null; }

  /** Same source contract as `ScopedPicker.begin`: the consumer's draft seeds the query on open. */
  begin(initialQuery = ''): void {
    if (this.closed || this.open) return;
    this.open = true; this.cursor = 0; this.filterQuery = initialQuery;
    this.pendingQuery = initialQuery; this.queryCursor = initialQuery.length;
    this.run(() => this.api?.setHistoryQuery(this.pendingQuery));
    // The host paints only while the picker is open, so publish the opening state here too.
    this.options.changed(this.snapshot);
  }
  query(value: string): void {
    if (this.closed || !this.open) return;
    this.filterQuery = value; this.cursor = 0;
    this.pendingQuery = value;
    this.run(() => this.api?.setHistoryQuery(value));
  }
  cycleScope(): boolean {
    const action = this.actions.get('historySearch:cycleScope');
    if (this.closed || !this.open || !action) return false;
    this.run(action); this.cursor = 0; return true;
  }
  move(delta: number): void {
    if (!this.open) return;
    const visible = this.filtered;
    if (!visible.length) return;
    this.cursor = (this.cursor + delta + visible.length) % visible.length;
    this.options.changed(this.snapshot);
  }
  accept(): boolean {
    const row = this.selection;
    if (!row) return false;
    this.open = false; this.chosen = row;
    this.options.changed(this.snapshot);
    return true;
  }
  async chosenEntry(): Promise<InputHistoryEntry | undefined> {
    const row = this.chosen;
    if (!row) return undefined;
    return this.options.resolve(row.entry);
  }
  cancel(): void {
    if (!this.open && this.cancelled) return;
    this.open = false; this.cancelled = true;
    this.options.changed(this.snapshot);
  }
  /** Host document rows for the overlay. */
  pick(columns: number, rows: number): DocumentRow[] {
    if (this.closed) return [];
    // A publish during the mount must not re-enter the same render pass.
    this.rendering = true;
    this.rows = rows; this.columns = columns;
    const tree = jsx(s, { flexDirection: 'column', width: columns, minHeight: rows, children: jsx(this.host, {}, 'picker') }, undefined);
    try {
      this.rowsCache = this.document.renderElement(tree, columns, { theme: this.themeName, themeOverrides: this.themeOverrides });
      return this.rowsCache;
    } finally {
      this.rendering = false;
    }
  }
  /** Plain-text projection of the same host render, used by the frame budget and snapshots. */
  frame(columns: number, rows: number): string[] {
    const pad = (text: string) => { let width = 0; let out = '';
      for (const part of (text as string)) { const cells = cellWidth(part); if (width + cells > columns) break; out += part; width += cells; }
      return out + ' '.repeat(Math.max(0, columns - width)); };
    return this.pick(columns, rows).slice(0, rows).map(row => pad(row.text));
  }
  private legacyFrame(columns: number, rows: number): string[] {
    const snapshot = this.snapshot;
    const pad = (text: string) => { let width = 0; let out = '';
      for (const part of (text as string)) { const cells = cellWidth(part); if (width + cells > columns) break; out += part; width += cells; }
      return out + ' '.repeat(Math.max(0, columns - width)); };
    const lines: string[] = [];
    const scopeNote = snapshot.status === 'truncated' ? ` · newest ${snapshot.items.length.toLocaleString()} only` : '';
    lines.push(pad(`Search prompts · ${snapshot.scope}${scopeNote}`));
    lines.push(pad(`Filter history… ${snapshot.query}`));
    const budget = Math.max(1, rows - 4);
    const visible = snapshot.filtered.slice(0, budget);
    for (let index = 0; index < visible.length; index++) {
      const row = visible[index]!;
      const stamp = new Date(row.entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const first = row.firstLine;
      lines.push(pad(`${index === snapshot.cursor ? '>' : ' '} ${stamp.padEnd(8)} ${first}`));
    }
    if (!visible.length) lines.push(pad(this.emptyMessage(snapshot)));
    while (lines.length < rows - 1) lines.push(pad(''));
    lines.push(pad('Enter select · Ctrl+S scope · Esc cancel'));
    return lines.slice(0, rows);
  }
  /** Source KLt mapping for the owned frame. */
  private emptyMessage(snapshot: ScopePickerSnapshot): string {
    if (!snapshot.status) return 'Loading…';
    const query = snapshot.query.trim();
    switch (snapshot.status) {
      case 'failed': return "Couldn't read prompt history";
      case 'scanning': return query ? 'Searching older prompts…' : 'No history yet';
      default: return query ? 'No matching prompts' : 'No history yet';
    }
  }
  private run(callback: () => void): void {
    Gt.flushSyncFromReconciler(callback); this.flush();
    this.publishDeferred();
  }
  /** Publish a change the mount had to hold; the next host-driven repaint picks it up. */
  private publishDeferred(): void {
    if (!this.deferred || this.rendering) return;
    this.deferred = false;
    if (!this.open || this.closed) return;
    try { this.options.changed(this.snapshot); } catch (error) { this.options.report(error); }
  }
  private flush(): void {
    Gt.flushSyncWork(); Gt.flushPassiveEffects(); Gt.flushSyncWork();
    if (this.failure) { const error = this.failure; this.failure = undefined; throw error; }
    this.readState();
  }
  private readState(): void { this.scopeValue = this.last.scope; }
  close(): void {
    if (this.closed) return;
    this.closed = true; this.actions.clear();
    try { this.document.close(); } catch (error) { this.options.report(error); }
  }
}
