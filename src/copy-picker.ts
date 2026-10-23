import type { CopyPickerRow } from './copy-command.js';
import { settingsWindow } from './config-panel.js';
import { cellWidth, type EditorAction } from './terminal.js';
import { Keymap, chordSequence } from './tui-keys.js';
import { jsx } from './tui-jsx.js';
import { n, s } from './tui-base-components.js';
import { te } from './tui-symbols.js';

export type CopyPickerEffect = { kind: 'cancel' } | { kind: 'select'; value: string; write: boolean };

// Nr/Wse, ax7r0qj7 [5182,5312), UTF-16; only display text passes through this closure.
const Wse = /[\x00-\x08\x0E-\x1F\x7F-\x9F]/g;
function Nr(t: string) { return t.replace(Wse, '').replace(/\s+/g, ' ').trim(); }
// l/c, 70nf72b4 [903,957)/[1391,1422), UTF-16.
const vje = 300;
function c(o: number, n: number) { return n - o < vje; }
function l(o: { isWindowActivation: boolean }, n: number, r: number) { return o.isWindowActivation || c(n, r); }

/** Be/tn, c283tj3z [18528,22085), 0wtqg4zf [7642,12509), UTF-16. */
export class CopyPicker {
  private index = 0;
  private start: number | null = null;
  private height = 1;
  private readonly keys = new Keymap();
  private readonly cancellations = new Map<string, { at: number; timer: ReturnType<typeof setTimeout> }>();
  private pending: string | undefined;
  private readonly mountedAt = Date.now();
  private edgePress = { at: Number.NEGATIVE_INFINITY, row: -1 };
  private activationArmed = false;
  private lastActivationInputTime = Number.NEGATIVE_INFINITY;
  readonly rows: readonly CopyPickerRow[];

  constructor(rows: readonly CopyPickerRow[], private readonly changed: () => void) {
    this.rows = rows.map(row => ({ ...row, label: Nr(row.label), meta: row.meta.map(Nr).filter(Boolean),
      ...(row.description === undefined ? {} : { description: Nr(row.description) }) }));
  }
  // aS/so, 70nf72b4 [957,1312), 0wtqg4zf [2932,3232), UTF-16.
  dropsClick(row: number, isWindowActivation: boolean): boolean {
    const now = Date.now();
    return l({ isWindowActivation }, this.mountedAt, now)
      || row === this.edgePress.row && now - this.edgePress.at < 1000;
  }
  pressEdge(row: number): void { this.edgePress = { row, at: Date.now() }; }
  // Os.handleFocus/consumeWindowActivationLatch/Ax, 06azbynj [237674,238371)/[242075,244661), UTF-16.
  private focusedAt = Number.NEGATIVE_INFINITY;
  windowFocus(focused: boolean): void {
    if (!focused || Date.now() - this.lastActivationInputTime >= 400) this.activationArmed = true;
    if (focused) this.focusedAt = Date.now();
  }
  activationInput(): boolean {
    this.lastActivationInputTime = Date.now();
    const armed = this.activationArmed; this.activationArmed = false;
    return armed && Date.now() - this.focusedAt < 400;
  }
  get focusIndex(): number { return this.index; }
  get guide(): string {
    return this.pending === undefined ? 'Enter copy / w write to file / Esc cancel' : `Press ${this.pending} again to cancel`;
  }
  close(): void {
    for (const { timer } of this.cancellations.values()) clearTimeout(timer);
    this.cancellations.clear(); this.pending = undefined; this.keys.reset();
  }
  focus(index: number): void { this.index = Math.max(0, Math.min(this.rows.length - 1, index)); }
  private window(scroll = 0) {
    return settingsWindow(this.rows.map(row => row.description ? 2 : 1), this.height, this.index, this.start, scroll);
  }
  page(delta: -1 | 1): void {
    const window = this.window();
    if (window.fits) return;
    if (this.height === 1) { this.focus(this.index + delta); return; }
    const line = Math.max(0, Math.min(window.starts.at(-1)! - 1,
      (window.starts[this.index] ?? 0) + delta * (window.end - window.start)));
    let target = 0;
    while (target + 1 < this.rows.length && window.starts[target + 1]! <= line) target++;
    this.focus(delta > 0 ? Math.max(target, this.index + 1) : Math.min(target, this.index - 1));
  }
  scroll(delta: -1 | 1): void {
    const window = this.window(delta);
    this.start = window.start;
    this.focus(Math.max(window.first, Math.min(window.after - 1, this.index)));
  }
  edge(last: boolean): void { this.start = null; this.focus(last ? this.rows.length - 1 : 0); }
  accept(write = false, index = this.index): CopyPickerEffect | undefined {
    const row = this.rows[index];
    if (row) { this.focus(index); return { kind: 'select', value: row.value, write }; }
    return;
  }

  /** iq/c, am9mebpw [1563,1917), 9pedrxny [1220,1611), UTF-16; each chord owns its timer. */
  private interrupt(name: string): CopyPickerEffect | undefined {
    const now = Date.now(), previous = this.cancellations.get(name);
    if (previous !== undefined) clearTimeout(previous.timer);
    if (previous !== undefined && now - previous.at <= 800) {
      this.cancellations.delete(name); this.pending = undefined;
      return { kind: 'cancel' };
    }
    this.pending = name;
    const timer = setTimeout(() => { this.pending = undefined; this.cancellations.delete(name); this.changed(); }, 800);
    timer.unref?.(); this.cancellations.set(name, { at: now, timer });
    return;
  }

  key(action: EditorAction): CopyPickerEffect | undefined {
    if (action.type === 'mouse' || action.type === 'paste') return;
    const sequence = action.type === 'key' ? action.sequence : chordSequence(action);
    if (action.type === 'insert' && action.text === 'w' || sequence === 'w') return this.accept(true);
    const sequences = action.type === 'insert' ? [...action.text] : sequence === undefined ? [] : [sequence];
    for (const key of sequences) {
      const result = this.keys.push(key, ['Global', 'Select']);
      if (result.kind !== 'match') continue;
      switch (result.match.action) {
        case 'app:interrupt': return this.interrupt('Ctrl-C');
        case 'app:exit': return this.interrupt('Ctrl-D');
        case 'select:cancel': return { kind: 'cancel' };
        case 'select:accept': return this.accept();
        case 'select:next': this.focus(this.index + 1); break;
        case 'select:previous': this.focus(this.index - 1); break;
        case 'select:first': this.edge(false); break;
        case 'select:last': this.edge(true); break;
        case 'select:pageDown': this.page(1); break;
        case 'select:pageUp': this.page(-1); break;
      }
    }
    return;
  }

  /** Vn/Fo, 0wtqg4zf [19681,22985), UTF-16; native JSX replaces compiler memo slots. */
  render(columns: number, height: number, paint: (tree: unknown) => string[]): {
    lines: string[]; hits: Map<number, number>; edges: Map<number, boolean>;
  } {
    this.height = Math.max(1, height);
    const metaRows = this.rows.filter(row => row.meta.some(Boolean));
    const width = Math.min(50, Math.max(0, ...metaRows.map(row => cellWidth(row.label))));
    const facts = Math.max(0, ...metaRows.map(row => cellWidth(row.meta.filter(Boolean).join(' · '))));
    const available = columns - 2 - 3;
    const room = available - Math.min(width, Math.max(Math.ceil(available / 2), available - facts));
    const join = (meta: readonly string[], limit: number) => meta.filter(Boolean).map((_, index, all) => all.slice(0, index + 1).join(' · '))
      .findLast((value, index) => index === 0 || cellWidth(value) <= limit) ?? '';
    const factsWidth = width + facts > available && available < 12 ? 0
      : Math.min(room, Math.max(0, ...metaRows.map(row => cellWidth(join(row.meta, room)))));
    const nameWidth = Math.min(width, available - factsWidth);
    const window = this.window();
    if (this.start !== null) this.start = window.start;
    const lines: string[] = [], hits = new Map<number, number>(), edges = new Map<number, boolean>();
    const more = (count: number, last: boolean) => {
      // Qe places unreserved hints outside the item viewport; the fixed modal keeps that item visible.
      if (count <= 0 || this.height < 3) return;
      edges.set(lines.length, last);
      lines.push(...paint(jsx(n, { dimColor: true, wrap: 'truncate-end',
        children: `  ${last ? te.arrowDown : te.arrowUp} ${count} more` }, undefined)));
    };
    more(window.first, false);
    for (let index = window.first; index < window.after; index++) {
      const row = this.rows[index]!, focused = this.index === index;
      const meta = factsWidth > 0 && row.meta.some(Boolean) ? join(row.meta, factsWidth) : undefined;
      const body = jsx(s, { flexDirection: 'row', noSelect: true, children: [
        jsx(n, { color: focused ? 'suggestion' : undefined, children: focused ? `${te.pointer} ` : '  ' }, 'pointer'),
        jsx(s, { flexDirection: 'column', flexGrow: 1, flexShrink: 1, children: [
          jsx(s, { children: [jsx(s, { flexShrink: meta === undefined ? 1 : 0,
            width: meta === undefined ? undefined : Math.max(0, nameWidth), marginRight: meta === undefined ? 0 : 3,
            children: jsx(n, { color: focused ? 'suggestion' : undefined, wrap: 'truncate-end', children: row.label }, undefined) }, 'label'),
            meta === undefined ? null : jsx(s, { flexShrink: 1, maxWidth: Math.max(0, factsWidth),
              children: jsx(n, { dimColor: true, wrap: 'truncate-end', children: meta }, undefined) }, 'meta')] }, 'row'),
          row.description ? jsx(n, { color: 'inactive', wrap: 'truncate-end', children: row.description }, 'description') : null,
        ] }, 'body'),
      ] }, row.value);
      for (const line of paint(body).slice(0, window.heights[index])) { hits.set(lines.length, index); lines.push(line); }
    }
    for (let spare = 0; spare < window.spare; spare++) lines.push('');
    more(this.rows.length - window.after, true);
    return { lines: lines.slice(0, this.height), hits, edges };
  }
}
