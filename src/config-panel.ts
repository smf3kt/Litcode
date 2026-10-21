import type { SessionConfig } from './session.js';
import { cellWidth, createEditorState, reduceEditorWithUndo, type EditorAction } from './terminal.js';
import { InputUndo } from './tui-input-undo.js';
import { Keymap, chordSequence } from './tui-keys.js';
import { jsx } from './tui-jsx.js';
import { n, s } from './tui-base-components.js';
import { te } from './tui-symbols.js';

export const TIME_FORMATS = ['auto', '12-hour', '24-hour', '24-hour-utc'] as const;
/** BE, chunk-a60ee1ne.js 765, minus default/plan/bypassPermissions, prefixed by Z's two. */
export const PERMISSION_MODE_OPTIONS = ['default', 'plan', 'acceptEdits', 'auto', 'dontAsk'] as const;
export type PermissionModeSetting = typeof PERMISSION_MODE_OPTIONS[number];
export type ConfigUpdate =
  | { id: 'autoCompact' | 'verbose' | 'progressBar' | 'reduceMotion' | 'thinking' | 'turnDuration'; value: boolean }
  | { id: 'editor'; value: 'normal' | 'vim' }
  | { id: 'permissionMode'; value: PermissionModeSetting }
  | { id: 'timeFormat'; value: typeof TIME_FORMATS[number] }
  | { id: 'askUserQuestionTimeout'; value: 'never' | '60s' | '5m' | '10m' }
  | { id: 'dialogExpiry'; value: 'default' | 'never' | '60s' | '5m' | '10m' };
export type ConfigRowId = ConfigUpdate['id'] | 'theme' | 'model';
type Row = { id: ConfigRowId; label: string } & (
  | { kind: 'boolean'; value: boolean }
  | { kind: 'enum'; value: string; options: readonly string[] }
  | { kind: 'picker'; value: string; options?: readonly string[] }
);
export interface ConfigPanelState { query: string; cursor: number; focus: ConfigRowId; mode: 'search' | 'list' }
export type ConfigPanelValues = Pick<SessionConfig, 'model' | 'thinking' | 'theme' | 'editorMode' | 'timeFormat'
  | 'verbose' | 'terminalProgressBarEnabled' | 'permissions' | 'autoCompactEnabled' | 'prefersReducedMotion' | 'showTurnDuration' | 'askUserQuestionTimeout' | 'dialogExpiry'>;
export interface ConfigPanelInput { config: ConfigPanelValues; hidden: readonly ConfigRowId[]; state?: ConfigPanelState }
export interface ConfigPanelHost {
  input: ConfigPanelInput;
  change(update: ConfigUpdate): Promise<ConfigPanelInput>;
}
export type ConfigPanelEffect = { kind: 'close' } | { kind: 'open'; id: 'theme' | 'model' | 'timeFormat' }
  | { kind: 'change'; update: ConfigUpdate };

/** Vc, dag4qhha [16553,16761), UTF-16; clips only the displayed prefix, retaining the full query. */
function clipQuery(text: string, columns: number): string {
  if (cellWidth(text) <= columns) return text;
  const limit = Math.max(1, columns - 1);
  let width = 0, end = 0;
  while (end < text.length) {
    const code = text.charCodeAt(end), size = code >= 0xd800 && code <= 0xdbff ? 2 : 1;
    const next = cellWidth(text.slice(end, end + size));
    if (width + next > limit) break;
    width += next; end += size;
  }
  return text.slice(0, end) + '…';
}

const themeNames: Record<string, string> = { auto: 'Auto (match terminal)', dark: 'Dark mode', light: 'Light mode',
  'dark-daltonized': 'Dark mode (colorblind-friendly)', 'light-daltonized': 'Light mode (colorblind-friendly)',
  'dark-ansi': 'Dark mode (ANSI colors only)', 'light-ansi': 'Light mode (ANSI colors only)' };

/** vWe, nybcbd9t [7247,31899), UTF-16; local row bodies and omitted consumers are recorded in W233. */
function rows({ config, hidden }: ConfigPanelInput): Row[] {
  const all: Row[] = [
    // vWe, nybcbd9t [12034,12244), UTF-16; Ze, bk5ct2gw [558575,558596) supplies true when absent.
    { id: 'autoCompact', label: 'Auto-compact', kind: 'boolean', value: config.autoCompactEnabled ?? true },
    { id: 'reduceMotion', label: 'Reduce motion', kind: 'boolean', value: config.prefersReducedMotion ?? false },
    { id: 'thinking', label: 'Thinking mode', kind: 'boolean', value: config.thinking },
    // vWe, nybcbd9t [20115,20201), UTF-16; Ze, bk5ct2gw [558427,559209) defaults false.
    { id: 'verbose', label: 'Verbose output', kind: 'boolean', value: config.verbose ?? false },
    // vWe, nybcbd9t [20202,20454), UTF-16; `y0` (3gz7s57c 138878) defaults it on.
    { id: 'progressBar', label: 'Terminal progress bar', kind: 'boolean', value: config.terminalProgressBarEnabled ?? true },
    { id: 'turnDuration', label: 'Show turn duration', kind: 'boolean', value: config.showTurnDuration ?? true },
    { id: 'timeFormat', label: 'Time format', kind: 'picker', value: config.timeFormat ?? 'auto', options: TIME_FORMATS },
    // vWe, nybcbd9t [21907,22578), UTF-16: settings default, not the live session mode.
    { id: 'permissionMode', label: 'Default permission mode', kind: 'enum',
      value: config.permissions?.defaultMode || 'default', options: PERMISSION_MODE_OPTIONS },
    { id: 'theme', label: 'Theme', kind: 'picker', value: themeNames[config.theme ?? 'dark'] ?? config.theme ?? 'dark' },
    { id: 'editor', label: 'Editor mode', kind: 'enum', value: config.editorMode ?? 'normal', options: ['normal', 'vim'] },
    { id: 'askUserQuestionTimeout', label: 'Question auto-continue timeout', kind: 'enum', value: config.askUserQuestionTimeout ?? 'never',
      options: ['never', '60s', '5m', '10m'] },
    { id: 'model', label: 'Model', kind: 'picker', value: config.model },
    { id: 'dialogExpiry', label: 'Dialog expiry', kind: 'enum', value: config.dialogExpiry ?? 'default',
      options: ['default', '60s', '5m', '10m', 'never'] },
  ];
  return all.filter(row => !hidden.includes(row.id));
}

/** mn/fn/Qe, 0wtqg4zf [7642,12509)/[15880,18925), UTF-16, specialized to the ungrouped field rows. */
function settingsWindow(rowHeights: readonly number[], height: number, cursor: number, preferred: number | null, scroll: number) {
  const overflow = rowHeights.reduce((sum, value) => sum + value, 0) > height;
  const visible = overflow ? Math.max(1, height - 2) : height;
  const marker = overflow && visible === height - 2 ? 1 : 0;
  const heights = rowHeights.map(value => Math.min(value, visible));
  const starts = [0];
  for (const value of heights) starts.push(starts.at(-1)! + value);
  const total = starts.at(-1)!, boundaries = new Set(starts), room = visible + 2 * marker;
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const isBoundary = (value: number) => value <= 0 || value >= total || boundaries.has(value);
  const nextBoundary = (value: number) => { let next = Math.min(value + 1, total); while (!isBoundary(next)) next++; return next; };
  const canStart = (value: number) => isBoundary(value) && !(value > 0 && value <= marker);
  const step = (value: number, delta: number) => {
    let next = value + delta;
    while (next > 0 && next < total && !canStart(next)) next += delta;
    return clamp(next, 0, total);
  };
  const endAt = (start: number) => {
    for (let end = Math.min(start + room, total); end > start; end--)
      if (isBoundary(end) && end - start + (start > 0 ? marker : 0) + (end < total ? marker : 0) <= room) return end;
    return nextBoundary(start);
  };
  let maxStart = 0;
  for (let start = total - 1; start >= 0; start--)
    if (canStart(start) && endAt(start) < total) { maxStart = step(start, 1); break; }
  const fit = (line: number, requested: number | null) => {
    let rowStart = line;
    while (!isBoundary(rowStart)) rowStart--;
    const rowEnd = nextBoundary(rowStart);
    let last = Math.min(rowStart, maxStart);
    while (!canStart(last)) last--;
    let first = rowStart <= 0 ? 0 : last;
    while (first < last && endAt(first) < rowEnd) first = step(first, 1);
    let earliest = Math.min(last, Math.max(0, rowEnd - room));
    while (earliest < last && (!canStart(earliest) || endAt(earliest) < rowEnd)) earliest++;
    let start = clamp(requested ?? earliest, Math.min(earliest, first), first);
    while (!canStart(start)) start--;
    return start;
  };
  let start = fit(starts[cursor] ?? 0, preferred);
  if (scroll !== 0) {
    for (let count = 0; count < Math.abs(scroll); count++) start = step(start, scroll < 0 ? -1 : 1);
    start = clamp(start, 0, maxStart);
    while (!canStart(start)) start--;
  }
  const end = endAt(start);
  const first = Math.max(0, starts.indexOf(start)), after = Math.max(first, starts.indexOf(end));
  return { start, end, first, after, heights, starts, fits: end - start >= total,
    spare: Math.max(0, room - (start > 0 ? marker : 0) - (end < total ? marker : 0) - end + start) };
}

/** bs/Gl/Co, dag4qhha [17007,42182), and field/list owners czbq7s7d/0wtqg4zf; UTF-16. */
export class ConfigPanel {
  private input: ConfigPanelInput;
  private editor = createEditorState();
  private readonly undo = new InputUndo();
  private readonly keys = new Keymap();
  private mode: 'search' | 'list';
  private focus: ConfigRowId;
  private start: number | null = null;
  private visible = 1;
  private painted: number[] = [];
  error: string | undefined;
  busy = false;

  constructor(input: ConfigPanelInput) {
    this.input = input;
    const state = input.state;
    this.editor = { ...this.editor, text: state?.query ?? '', cursor: state?.cursor ?? 0 };
    this.mode = state?.mode ?? 'search';
    this.focus = state?.focus ?? 'autoCompact';
    this.ensureFocus();
  }

  get state(): ConfigPanelState { return { query: this.editor.text, cursor: this.editor.cursor, focus: this.focus, mode: this.mode }; }
  get searching(): boolean { return this.mode === 'search'; }
  get query(): string { return this.editor.text; }
  get cursor(): number { return this.editor.cursor; }
  queryDisplay(columns: number): { text: string; column: number } {
    const text = clipQuery(this.query, Math.max(1, columns - 11));
    return { text, column: 2 + cellWidth('⌕ ' + text.slice(0, Math.min(this.cursor, text.length))) };
  }
  get focused(): Row | undefined { return this.filtered().find(row => row.id === this.focus); }

  private filtered(): Row[] {
    const query = this.query.toLowerCase();
    return rows(this.input).filter(row => !query || row.id.toLowerCase().includes(query)
      || row.label.toLowerCase().includes(query)
      || 'options' in row && row.options?.some(value => value.toLowerCase().includes(query)));
  }
  private ensureFocus(): void {
    if (!this.focused) this.focus = this.filtered()[0]?.id ?? 'autoCompact';
  }
  update(input: ConfigPanelInput): void { this.input = input; this.ensureFocus(); this.error = undefined; }
  private queryText(text: string, cursor = text.length): void {
    this.editor = { ...this.editor, text, cursor }; this.start = null;
    this.focus = this.filtered()[0]?.id ?? 'autoCompact'; this.error = undefined;
  }
  search(): void { this.mode = 'search'; }
  focusRow(id: ConfigRowId): void { this.focus = id; this.mode = 'list'; this.error = undefined; }
  move(delta: number): void {
    const list = this.filtered(), index = list.findIndex(row => row.id === this.focus);
    if (delta < 0 && index === 0) { this.mode = 'search'; return; }
    const row = list[Math.max(0, Math.min(list.length - 1, index + delta))];
    if (row) this.focusRow(row.id);
  }
  page(delta: -1 | 1): void {
    const list = this.filtered(), index = Math.max(0, list.findIndex(row => row.id === this.focus));
    const window = settingsWindow(this.painted, this.visible, index, this.start, 0);
    if (window.fits) return;
    const line = Math.max(0, Math.min(window.starts.at(-1)! - 1,
      (window.starts[index] ?? 0) + delta * (window.end - window.start)));
    let target = 0;
    while (target + 1 < list.length && window.starts[target + 1]! <= line) target++;
    const row = list[Math.max(0, Math.min(list.length - 1,
      delta > 0 ? Math.max(index + 1, target) : Math.min(index - 1, target)))];
    if (row) this.focusRow(row.id);
  }
  edge(last: boolean): void { const list = this.filtered(), row = last ? list.at(-1) : list[0]; if (row) this.focusRow(row.id); }
  scroll(delta: -1 | 1): void {
    if (this.searching) { this.mode = 'list'; return; }
    const list = this.filtered(), index = Math.max(0, list.findIndex(row => row.id === this.focus));
    const window = settingsWindow(this.painted, this.visible, index, this.start, delta);
    this.start = window.start;
    const row = list[Math.max(window.first, Math.min(window.after - 1, index))];
    if (row) this.focusRow(row.id);
  }

  /** Co/an and wn/xn, dag4qhha [26517,30080), czbq7s7d [11819,12442), UTF-16. */
  activate(direction: -1 | 1 = 1): ConfigPanelEffect | undefined {
    const row = this.focused;
    if (!row) return;
    if (row.id === 'theme' || row.id === 'model' || row.id === 'timeFormat')
      return direction > 0 ? { kind: 'open', id: row.id } : undefined;
    const value = row.kind === 'boolean' ? !row.value : row.kind === 'enum'
      ? row.options[(row.options.indexOf(row.value) + direction + row.options.length) % row.options.length] : undefined;
    switch (row.id) {
      case 'autoCompact': case 'verbose': case 'progressBar': case 'reduceMotion': case 'thinking': case 'turnDuration':
        if (typeof value === 'boolean') return { kind: 'change', update: { id: row.id, value } };
        return;
      case 'editor':
        if (value === 'normal' || value === 'vim') return { kind: 'change', update: { id: row.id, value } };
        return;
      case 'permissionMode':
        if (typeof value === 'string' && (PERMISSION_MODE_OPTIONS as readonly string[]).includes(value))
          return { kind: 'change', update: { id: row.id, value: value as PermissionModeSetting } };
        return;
      case 'askUserQuestionTimeout':
        if (value === 'never' || value === '60s' || value === '5m' || value === '10m')
          return { kind: 'change', update: { id: row.id, value } };
        return;
      case 'dialogExpiry':
        if (value === 'default' || value === 'never' || value === '60s' || value === '5m' || value === '10m')
          return { kind: 'change', update: { id: row.id, value } };
        return;
    }
  }

  /** _y/Gl, qh0w98pn [48154,53325), dag4qhha [30733,31282), UTF-16. */
  key(action: EditorAction, columns: number): ConfigPanelEffect | undefined {
    const command = action.type === 'key' ? action.command : action.type;
    const sequence = action.type === 'key' ? action.sequence : chordSequence(action);
    if (command === 'interrupt' || command === 'eof') return { kind: 'close' };
    if (this.busy) return;
    if (this.searching) {
      if (sequence === '\x1b') { if (this.query) this.queryText(''); else this.mode = 'list'; return; }
      if (command === 'submit' || command === 'down') { if (this.filtered().length) this.mode = 'list'; return; }
      if (command === 'up' || sequence === '\t') return;
      if (command === 'backspace' && !this.query) { this.mode = 'list'; return; }
      const edit: EditorAction | undefined = action.type === 'paste'
        ? { type: 'insert', text: action.text.split(/\r\n|\r|\n/, 2)[0] ?? '' }
        : action.type === 'key' ? action.command ? { type: action.command } : undefined : action;
      if (!edit) return;
      const previous = this.query;
      this.editor = reduceEditorWithUndo(this.editor, edit, { historyLimit: 0, maxPasteBytes: 32768,
        navigationColumns: Math.max(1, columns - 6) }, this.undo).state;
      if (previous !== this.query) { this.start = null; this.focus = this.filtered()[0]?.id ?? 'autoCompact'; }
      this.ensureFocus(); return;
    }
    if (command === 'submit') return this.activate();
    if (command === 'left' || command === 'right') return this.activate(command === 'left' ? -1 : 1);
    const sequences = action.type === 'insert' ? [...action.text] : sequence === undefined ? [] : [sequence];
    for (const key of sequences) {
      if (this.searching) { this.key({ type: 'insert', text: key }, columns); continue; }
      const result = this.keys.push(key, ['Settings']);
      if (result.kind === 'pending') continue;
      if (result.kind === 'match') {
        switch (result.match.action) {
          case 'confirm:no': return { kind: 'close' };
          case 'settings:search': this.mode = 'search'; this.queryText(''); continue;
          case 'select:previous': this.move(-1); continue;
          case 'select:next': this.move(1); continue;
          case 'select:pageUp': this.page(-1); continue;
          case 'select:pageDown': this.page(1); continue;
          case 'select:first': this.edge(false); continue;
          case 'select:last': this.edge(true); continue;
          case 'select:accept': return this.activate();
        }
      }
      if (key.length === 1 && key !== ' ' && !/[\x00-\x1f\x7f]/.test(key)) {
        this.mode = 'search'; this.queryText(key === '/' ? '' : key);
      }
    }
  }

  /** Field Qe/Xe, czbq7s7d [1599,7850), UTF-16: 32-cell label target, 12-cell value minimum. */
  render(columns: number, height: number, paint: (tree: unknown) => string[]): {
    lines: string[]; hits: Array<{ row: number; id: ConfigRowId; valueColumn: number }>;
  } {
    const list = this.filtered();
    const valueWidth = (row: Row) => row.kind === 'boolean' ? 5 : row.kind === 'enum'
      ? Math.max(...row.options.map(cellWidth)) + 4 : cellWidth(String(row.value)) + 2;
    const labelWidth = Math.min(Math.max(0, ...list.map(row => cellWidth(row.label))),
      Math.max(32, columns - 4 - Math.max(12, ...list.map(valueWidth))));
    const stacked = columns - 4 - labelWidth < 12;
    const rowLines = list.map(row => {
      const focused = !this.searching && row.id === this.focus;
      const label = jsx(n, { color: focused ? 'suggestion' : undefined, wrap: 'truncate-end', children: row.label }, undefined);
      const value = row.kind === 'enum' && focused ? `‹ ${row.value} ›`
        : row.kind === 'picker' ? `${row.value} ›` : String(row.value);
      return paint(jsx(s, { flexDirection: stacked ? 'column' : 'row', children: [
        jsx(s, { width: stacked ? undefined : labelWidth, marginRight: stacked ? 0 : 2, flexShrink: 0, children: label }, 'label'),
        jsx(s, { paddingLeft: stacked ? 2 : 0, children: jsx(n, { color: focused ? 'suggestion' : undefined,
          wrap: 'truncate-end', children: value }, undefined) }, 'value'),
      ] }, row.id));
    });
    this.painted = rowLines.map(lines => lines.length);
    this.visible = Math.max(1, height);
    const focusIndex = Math.max(0, list.findIndex(row => row.id === this.focus));
    const lines: string[] = [], hits: Array<{ row: number; id: ConfigRowId; valueColumn: number }> = [];
    if (!list.length) return { lines: paint(jsx(n, { dimColor: true, children: `No settings match "${this.query}"` }, undefined)).slice(0, height), hits };
    const window = settingsWindow(this.painted, this.visible, focusIndex, this.start, 0);
    if (this.start !== null) this.start = window.start;
    const overflow = this.painted.reduce((total, count) => total + count, 0) > height;
    if (overflow && window.first > 0) lines.push(`  ${te.arrowUp} ${window.first} more`);
    for (let index = window.first; index < window.after; index++) {
      const row = list[index]!;
      for (const [offset, line] of rowLines[index]!.slice(0, window.heights[index]).entries()) {
        hits.push({ row: lines.length, id: row.id, valueColumn: stacked ? offset > 0 ? 2 : columns : labelWidth + 2 });
        lines.push(line);
      }
    }
    for (let spare = 0; spare < window.spare; spare++) lines.push('');
    if (overflow) lines.push(window.after < list.length ? `  ${te.arrowDown} ${list.length - window.after} more` : '');
    return { lines: lines.slice(0, height), hits: hits.filter(hit => hit.row < height) };
  }
}
