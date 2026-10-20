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
import { _4n, jd, cq, ov, $C } from './tui-native-input-source.js';
import { Eg, Pd, xg, Kr, Kl, Rg, Ag, Ng, wg, kn, Hg, Lg, Vd, Bd, _g, Dg } from './tui-native-selection-source.js';
import { zye } from './tui-text-style.js';
import { composeBanner } from './session-color.js';

interface NativePoint { col: number; row: number }
interface NativeSelection {
  anchor: NativePoint | null;
  focus: NativePoint | null;
  scope?: { x1: number; x2: number; node: unknown };
  isDragging: boolean;
  anchorSpan: { lo: NativePoint; hi: NativePoint; kind: 'line' | 'word' } | null;
  scrolledOffAbove: string[];
  scrolledOffBelow: string[];
  scrolledOffAboveSW: boolean[];
  scrolledOffBelowSW: boolean[];
  virtualAnchorRow?: number;
  virtualFocusRow?: number;
  virtualAnchorCol?: number;
  virtualFocusCol?: number;
  lastPressHadAlt: boolean;
}
export interface FrameCursor { row: number; column: number; visible: boolean }
/** One prompt row: plain text, or the runs a chain answer painted over it. */
export type PromptLine = string | readonly PromptSegment[];
/** A footer part painted in a theme slot's colour instead of the dim default. */
export interface FooterPart { text: string; color?: string }
type HostNode = Omit<ReturnType<typeof Lr>, 'yogaNode' | 'focusManager' | 'onComputeLayout' | 'onRender'> & {
  yogaNode: ReturnType<typeof layoutEngine.Node.create>;
  focusManager: InstanceType<typeof ZDr>;
  onComputeLayout: () => void;
  onRender?: () => void;
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
  private readonly layoutListeners = new Set<() => void>();
  private rendering = false;
  private paintQueued = false;
  private readonly nativeSelection: NativeSelection = Eg();
  private readonly selectionListeners = new Set<() => void>();
  readonly selectionInstance = {
    copySelection: () => { const text = Hg(this.nativeSelection, this.front.screen); this.clearNativeSelection(); return text; },
    copySelectionNoClear: () => Hg(this.nativeSelection, this.front.screen) as string,
    getSelectedText: () => Hg(this.nativeSelection, this.front.screen) as string,
    clearTextSelection: () => this.clearNativeSelection(),
    hasTextSelection: () => kn(this.nativeSelection) as boolean,
    selection: this.nativeSelection,
    subscribeToSelectionChange: (listener: () => void) => { this.selectionListeners.add(listener); return () => { this.selectionListeners.delete(listener); }; },
    moveSelectionFocus: (direction: unknown) => this.moveNativeFocus(direction),
    setSelectionBgColor: (background: unknown) => {
      const painted = zye('\x00', background, 'background') as string;
      const split = painted.indexOf('\x00');
      this.styles.setSelectionBg(split <= 0 || split === painted.length - 1 ? null
        : { type: 'ansi', code: painted.slice(0, split), endCode: painted.slice(split + 1) });
    },
  };

  readonly appContext = {
    focusManager: this.root.focusManager,
    rootNode: this.root,
    subscribeLayout: (listener: () => void) => {
      this.layoutListeners.add(listener);
      return () => { this.layoutListeners.delete(listener); };
    },
    isHoverTracked: () => false,
    subscribeHoverTracked: (_listener: () => void) => () => {},
    retainFinePointer: () => () => {},
  };

  constructor(output: { write(text: string): unknown }, private readonly synchronized = true,
    private readonly changed?: () => void) {
    this.terminal = { stdout: output, stderr: output, tolerateDeadStdout: false, stdoutDead: false };
    this.root.focusManager = new ZDr((node: unknown, event: unknown) => Wfe.dispatchDiscrete(node, event));
    this.appContext.focusManager = this.root.focusManager;
    this.root.onComputeLayout = () => this.root.yogaNode.calculateLayout(this.columns, this.rows, 1);
    this.root.onRender = () => {
      for (const listener of this.layoutListeners) listener();
      if (this.rendering || this.closed || this.paintQueued || !this.changed) return;
      this.paintQueued = true;
      queueMicrotask(() => {
        this.paintQueued = false;
        if (!this.closed) this.changed?.();
      });
    };
    const fail = (error: unknown) => { this.failure ??= error; };
    this.container = Gt.createContainer(this.root, 1, null, false, null, 'litcode', fail, fail, fail, fail);
  }

  get frame(): readonly string[] { return this.snapshot; }
  get liveNodes(): number { return this.config.liveNodes; }

  renderElement(tree: unknown, columns: number, rows: number, cursor: FrameCursor): void {
    this.selection = undefined;
    this.renderTree(tree as ReturnType<typeof jsx>, columns, rows, cursor);
  }

  click(column: number, row: number, modifiers: { ctrl: boolean; shift: boolean; alt: boolean }): boolean {
    const cell = this.cell(column, row);
    return ov(this.root, new _4n(column, row, !cell?.char.trim(), cell?.hyperlink, false, modifiers));
  }

  wheel(column: number, row: number, delta: number, modifiers: { ctrl: boolean; shift: boolean; meta: boolean }): boolean {
    const target = cq(this.root, column, row);
    if (!target || !$C(target)) return false;
    const event = new jd(delta, { ...modifiers, col: column, row });
    Wfe.dispatchContinuous(target, event);
    return event.defaultPrevented;
  }

  /** Aje selection methods, chunk-06azbynj.js [350700,351231) UTF-16. */
  selectNative(phase: 'start' | 'drag' | 'end', column: number, row: number, clicks = 1): void {
    const state = this.nativeSelection;
    if (phase === 'start') {
      Pd(state, column, row, Vd(this.root, column, row));
      if (clicks === 2) Rg(state, this.front.screen, column, row);
      else if (clicks >= 3) Ag(state, this.front.screen, row);
    } else {
      if (state.anchorSpan) Ng(state, this.front.screen, column, row);
      else xg(state, column, row);
      if (phase === 'end') Kr(state);
    }
    this.notifyNativeSelection();
  }

  endNativeSelection(): void { Kr(this.nativeSelection); this.notifyNativeSelection(); }

  clearNativeSelection(): void {
    Kl(this.nativeSelection);
    this.notifyNativeSelection();
  }

  /** Aje.moveSelectionFocus, chunk-06azbynj.js [345476,345978) UTF-16. */
  private moveNativeFocus(direction: unknown): void {
    const { focus, scope } = this.nativeSelection;
    if (!focus) return;
    const { width, height } = this.front.screen;
    const left = scope ? scope.x1 : 0, right = (scope ? Math.min(scope.x2, width) : width) - 1;
    let { col, row } = focus;
    switch (direction) {
      case 'left': if (col > left) col--; else if (row > 0) { col = right; row--; } break;
      case 'right': if (col < right) col++; else if (row < height - 1) { col = left; row++; } break;
      case 'up': if (row > 0) row--; break;
      case 'down': if (row < height - 1) row++; break;
      case 'lineStart': col = left; break;
      case 'lineEnd': col = right; break;
    }
    if (col === focus.col && row === focus.row) return;
    wg(this.nativeSelection, col, row);
    this.notifyNativeSelection();
  }

  private notifyNativeSelection(): void {
    this.contaminated = true;
    for (const listener of this.selectionListeners) listener();
  }

  invalidate(): void { this.contaminated = true; this.diff.forceFullReset(); }

  render(lines: readonly string[], columns: number, rows: number, cursor: FrameCursor): void {
    this.selection = undefined;
    const children = Array.from({ length: rows }, (_, index) => this.rawRow(lines[index] ?? '', columns, String(index)));
    this.renderTree(jsx(s, { width: columns, height: rows, flexDirection: 'column',
      flexGrow: 0, flexShrink: 0, children }, undefined), columns, rows, cursor);
  }

  renderChat(transcript: readonly string[], prompt: readonly PromptLine[], footer: readonly (string | FooterPart)[],
    columns: number, rows: number, cursor: FrameCursor, running: boolean,
    selection?: { state: SelectionState; offset: number; rows: number }, theme = 'dark',
    themeOverrides?: Record<string, string>, progress: readonly string[] = [], statusLine: readonly string[] = [],
    sidebar?: { width: number; element: unknown },
    banner?: { text: string; color: string }): void {
    this.selection = selection;
    const conversationWidth = columns - (sidebar?.width ?? 0);
    // `Mk`: the composer's own rule, drawn above the box and painted in one colour. It is
    // absent until a session title, an agent chip or a `/color` pick gives it a reason.
    const bannerRow = banner === undefined ? undefined
      : jsx(s, { height: 1, flexShrink: 0, width: '100%',
        children: jsx(n, { color: banner.color, wrap: 'truncate-end',
          children: composeBanner(banner.text, conversationWidth) }, 'rule') }, 'banner');
    const input = jsx(s, { ...GE('prompt', false), width: '100%', alignItems: 'flex-start',
      children: [jsx(tH, { isLoading: running, isScreenReader: false }, 'pointer'),
        jsx(s, { flexGrow: 1, flexShrink: 1, flexDirection: 'column',
          children: prompt.map((line, index) => jsx(s, { height: 1, flexShrink: 0,
            children: this.promptRow(line) }, String(index))) }, 'draft')] }, 'input');
    const status = jsx(Tde, { width: conversationWidth, left: footer.map((part, index) =>
      typeof part === 'string'
        ? jsx(Do, { dimColor: true, children: part }, String(index))
        : jsx(n, { color: part.color, children: part.text }, String(index))) }, 'footer');
    const bannerHeight = bannerRow === undefined ? 0 : 1;
    const transcriptHeight = Math.max(0,
      rows - prompt.length - 3 - bannerHeight - progress.length - statusLine.length);
    const children = [jsx(s, { height: transcriptHeight, flexDirection: 'column', flexShrink: 0,
      children: Array.from({ length: transcriptHeight }, (_, index) =>
        this.rawRow(transcript[index] ?? '', conversationWidth, String(index))) }, 'transcript'),
      ...progress.map((line, index) => this.rawRow(line, conversationWidth, 'progress-' + index)),
      ...(bannerRow === undefined ? [] : [bannerRow]), input,
      ...statusLine.map((line, index) => this.rawRow(line, conversationWidth, 'status-line-' + index)), status];
    const conversation = jsx(s, { width: conversationWidth, height: rows, flexDirection: 'column',
      flexShrink: 0, children }, 'conversation');
    const tree = jsx(ThemeContext.Provider, { value: { currentTheme: theme, resolvedTheme: i9t(S1(theme), themeOverrides),
      setThemeSetting: () => {} }, children: jsx(s, { width: columns, height: rows,
        flexDirection: 'row', flexShrink: 0, children: [conversation, sidebar?.element] }, undefined) }, undefined);
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
    this.rendering = true;
    try {
      Gt.updateContainerSync(tree, this.container, null, null);
      Gt.flushSyncWork();
    } finally { this.rendering = false; }
    if (this.failure) { const error = this.failure; this.failure = undefined; throw error; }
    if (this.nativeSelection.scope) {
      let owner = this.nativeSelection.scope.node as { parentNode?: unknown } | null;
      while (owner && owner !== this.root) owner = (owner.parentNode ?? null) as typeof owner;
      if (owner !== this.root) this.clearNativeSelection();
    }
    const next = this.paint({ frontFrame: this.front, backFrame: this.back, isTTY: true,
      terminalWidth: columns, terminalRows: rows, altScreen: true,
      prevFrameContaminated: this.contaminated || resized || this.selection !== undefined || kn(this.nativeSelection), overlayActive: false });
    // Aje followScroll carry, chunk-06azbynj.js [322746,323670) UTF-16.
    const follow = next.followScroll as { delta: number; viewportTop: number; viewportBottom: number;
      viewportLeft: number; viewportRight: number } | null;
    const native = this.nativeSelection;
    if (follow && native.anchor && native.anchor.row >= follow.viewportTop && native.anchor.row <= follow.viewportBottom
      && (native.virtualAnchorCol ?? native.anchor.col) >= follow.viewportLeft
      && (native.virtualAnchorCol ?? native.anchor.col) <= follow.viewportRight) {
      const { delta, viewportTop: top, viewportBottom: bottom } = follow;
      const first = delta > 0 ? top : bottom + delta + 1, last = delta > 0 ? top + delta - 1 : bottom;
      const side = delta > 0 ? 'above' : 'below';
      if (native.isDragging) {
        if (kn(native)) Bd(native, this.front.screen, first, last, side);
        Dg(native, -delta, top, bottom);
      } else if (!native.focus || native.focus.row >= top && native.focus.row <= bottom
        && (native.virtualFocusCol ?? native.focus.col) >= follow.viewportLeft
        && (native.virtualFocusCol ?? native.focus.col) <= follow.viewportRight) {
        if (kn(native)) Bd(native, this.front.screen, first, last, side);
        _g(native, -delta, top, bottom, this.front.screen.width);
      }
    }
    if (kn(native)) Lg(next.screen, native, this.styles);
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
    finally {
      TE(this.root); this.config.free(); this.snapshot = []; this.cursor = undefined;
      Kl(this.nativeSelection); this.selectionListeners.clear(); this.layoutListeners.clear();
    }
  }
}
