import { layoutEngine } from './tui-layout.js';
import { jsx } from './tui-jsx.js';
import { Gt, Lr, TE, ff, Zd, Rd, Cd, vs, go, ZDr, Wfe, ef, Zt, po } from './tui-render-engine.js';
import { yLr } from './tui-render-output.js';
import { s, n, Do } from './tui-base-components.js';
import { GE, tH, Tde } from './tui-source-chrome.js';
import { ThemeContext } from './tui-theme.js';
import { S1 } from './tui-theme-colors.js';
import { i9t } from './tui-theme-overrides-source.js';
import { orderedSpan, type SelectionState } from './tui-selection.js';
import type { PromptSegment } from './tui-input-decorations.js';

export interface FrameCursor { row: number; column: number; visible: boolean }
/** One prompt row: plain text, or the runs a chain answer painted over it. */
export type PromptLine = string | readonly PromptSegment[];
type HostNode = Omit<ReturnType<typeof Lr>, 'yogaNode' | 'focusManager' | 'onComputeLayout'> & {
  yogaNode: ReturnType<typeof layoutEngine.Node.create>;
  focusManager: InstanceType<typeof ZDr>;
  onComputeLayout: () => void;
};

/**
 * TerminalSurface owner for the copied reconciler -> layout -> paint -> diff
 * chain. Root, front/back frames and layout nodes live until close(). Input
 * and terminal-mode ownership remain with TuiTerminal. Source owner ranges
 * and the explicit Node/native differences live in the W44 port record.
 */
export class TuiRenderer {
  private readonly styles = new Rd();
  private readonly chars = new Cd();
  private readonly links = new vs();
  private readonly config = layoutEngine.Config.create();
  private readonly root = Lr('ink-root', this.config) as unknown as HostNode;
  private readonly paint = ff(this.root, this.styles);
  private readonly diff = new Zd({ isTTY: true, stylePool: this.styles });
  private readonly container;
  private front = go(0, 0, this.styles, this.chars, this.links);
  private back = go(0, 0, this.styles, this.chars, this.links);
  private readonly terminal;
  private closed = false;
  private contaminated = true;
  private columns = 0;
  private rows = 0;
  private failure: unknown;
  private cursor: FrameCursor | undefined;
  private snapshot: string[] = [];
  private selection: { state: SelectionState; offset: number; rows: number } | undefined;

  constructor(output: { write(text: string): unknown }, private readonly synchronized = true) {
    this.terminal = { stdout: output, stderr: output, tolerateDeadStdout: false, stdoutDead: false };
    this.root.focusManager = new ZDr((node: unknown, event: unknown) => Wfe.dispatchDiscrete(node, event));
    this.root.onComputeLayout = () => this.root.yogaNode.calculateLayout(this.columns, this.rows, 1);
    const fail = (error: unknown) => { this.failure ??= error; };
    this.container = Gt.createContainer(this.root, 1, null, false, null, 'litcode', fail, fail, fail, fail);
  }

  get frame(): readonly string[] { return this.snapshot; }
  get liveNodes(): number { return this.config.liveNodes; }

  invalidate(): void { this.contaminated = true; this.diff.forceFullReset(); }

  render(lines: readonly string[], columns: number, rows: number, cursor: FrameCursor): void {
    this.selection = undefined;
    const children = Array.from({ length: rows }, (_, index) => this.rawRow(lines[index] ?? '', columns, String(index)));
    this.renderTree(jsx(s, { width: columns, height: rows, flexDirection: 'column',
      flexGrow: 0, flexShrink: 0, children }, undefined), columns, rows, cursor);
  }

  renderChat(transcript: readonly string[], prompt: readonly PromptLine[], footer: readonly string[],
    columns: number, rows: number, cursor: FrameCursor, running: boolean,
    selection?: { state: SelectionState; offset: number; rows: number }, theme = 'dark',
    themeOverrides?: Record<string, string>, progress: readonly string[] = [], statusLine: readonly string[] = []): void {
    this.selection = selection;
    const input = jsx(s, { ...GE('prompt', false), width: '100%', alignItems: 'flex-start',
      children: [jsx(tH, { isLoading: running, isScreenReader: false }, 'pointer'),
        jsx(s, { flexGrow: 1, flexShrink: 1, flexDirection: 'column',
          children: prompt.map((line, index) => jsx(s, { height: 1, flexShrink: 0,
            children: this.promptRow(line) }, String(index))) }, 'draft')] }, 'input');
    const status = jsx(Tde, { width: columns, left: footer.map((part, index) =>
      jsx(Do, { dimColor: true, children: part }, String(index))) }, 'footer');
    const transcriptHeight = Math.max(0, rows - prompt.length - 3 - progress.length - statusLine.length);
    const children = [jsx(s, { height: transcriptHeight, flexDirection: 'column', flexShrink: 0,
      children: Array.from({ length: transcriptHeight }, (_, index) =>
        this.rawRow(transcript[index] ?? '', columns, String(index))) }, 'transcript'),
      ...progress.map((line, index) => this.rawRow(line, columns, 'progress-' + index)), input,
      ...statusLine.map((line, index) => this.rawRow(line, columns, 'status-line-' + index)), status];
    const tree = jsx(ThemeContext.Provider, { value: { currentTheme: theme, resolvedTheme: i9t(S1(theme), themeOverrides),
      setThemeSetting: () => {} }, children: jsx(s, { width: columns, height: rows,
        flexDirection: 'column', flexShrink: 0, children }, undefined) }, undefined);
    this.renderTree(tree, columns, rows, cursor);
  }

  /** One prompt row: a painted row keeps the line's own spans, an unpainted one the markdown text. */
  private promptRow(line: PromptLine) {
    if (typeof line === 'string') return jsx(Do, { children: line || ' ', wrap: 'truncate-end' }, undefined);
    return jsx(n, { wrap: 'truncate-end',
      children: line.map((segment, index) => jsx(n, { ...segment.style, children: segment.text }, String(index))) }, undefined);
  }

  private rawRow(text: string, columns: number, key: string) {
    return jsx('ink-raw-ansi', { rawText: text, rawWidth: columns, rawHeight: 1,
      style: { width: columns, height: 1, flexGrow: 0, flexShrink: 0 } }, key);
  }

  private renderTree(tree: ReturnType<typeof jsx>, columns: number, rows: number, cursor: FrameCursor): void {
    if (this.closed) return;
    const resized = columns !== this.columns || rows !== this.rows;
    this.columns = columns; this.rows = rows;
    this.root.yogaNode.setWidth(columns); this.root.yogaNode.setHeight(rows);
    Gt.updateContainerSync(tree, this.container, null, null);
    Gt.flushSyncWork();
    if (this.failure) { const error = this.failure; this.failure = undefined; throw error; }
    const next = this.paint({ frontFrame: this.front, backFrame: this.back, isTTY: true,
      terminalWidth: columns, terminalRows: rows, altScreen: true,
      prevFrameContaminated: this.contaminated || resized || this.selection !== undefined, overlayActive: false });
    if (this.selection) {
      const { state, offset, rows: transcriptRows } = this.selection;
      const span = orderedSpan(state);
      if (span) for (let row = 0; row < transcriptRows; row++) {
        const line = offset + row;
        if (line < span.start.line || line > span.end.line) continue;
        const start = line === span.start.line ? span.start.column : 0;
        const end = line === span.end.line ? span.end.column : columns - 1;
        for (let column = start; column <= Math.min(end, columns - 1); column++) {
          const cell = Zt(next.screen, column, row);
          if (cell) po(next.screen, column, row, this.styles.withInverse(cell.styleId));
        }
      }
    }
    if (this.contaminated || resized || next.layoutShifted) next.screen.damage = { x: 0, y: 0, width: columns, height: rows };
    // Source Aje compares alternate-screen frames from a homed cursor and parks
    // after painting; native input cursor declarations are applied last.
    const operations = ef(this.diff.render({ ...this.front, cursor: { x: 0, y: 0, visible: false } }, next, true));
    this.back = this.front; this.front = next;
    this.contaminated = false;
    this.snapshot = this.diff.renderFullFrame(next)[0]?.content.split('\n') ?? [];
    const moved = !this.cursor || this.cursor.row !== cursor.row || this.cursor.column !== cursor.column
      || this.cursor.visible !== cursor.visible;
    if (operations.length || moved) {
      // Full-frame construction ends with CR/LF; source Aje parks from the
      // final screen row. Drop only the final row advance in alternate screen.
      if (operations.at(-1)?.type === 'stdout' && operations.at(-1)?.content === '\n') operations.pop();
      const patches = operations.length ? [{ type: 'stdout', content: '\x1b[H' }, ...operations] : [];
      patches.push({ type: 'stdout', content: `\x1b[${Math.max(1, Math.min(rows, cursor.row + 1))};${Math.max(1, Math.min(columns, cursor.column + 1))}H` },
        { type: cursor.visible ? 'cursorShow' : 'cursorHide' });
      yLr(this.terminal, patches, !this.synchronized, rows);
      this.cursor = { ...cursor };
    }
  }

  cell(column: number, row: number): { char: string; width: number; styleId: number; hyperlink?: string } | undefined {
    return Zt(this.front.screen, column, row);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { Gt.updateContainerSync(null, this.container, null, null); Gt.flushSyncWork(); }
    finally { TE(this.root); this.config.free(); this.snapshot = []; this.cursor = undefined; }
  }
}
