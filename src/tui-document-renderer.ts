import { layoutEngine } from './tui-layout.js';
import { jsx } from './tui-jsx.js';
import { Gt, Lr, TE, ff, Rd, Cd, vs, go, Zd, Zt } from './tui-render-engine.js';
import { s, n, RenderCacheContext, createRenderCache } from './tui-base-components.js';
import { Ya, tDr } from './tui-markdown-components.js';
import { TerminalSizeContext, RenderSettingsContext, SurfaceCapabilitiesContext } from './tui-component-host.js';
import { ThemeContext } from './tui-theme.js';
import { S1 } from './tui-theme-colors.js';
import { i9t } from './tui-theme-overrides-source.js';

export interface DocumentRow {
  text: string;
  ansi: string;
  continuation: boolean;
  indent: number;
  end?: number;
  elidedSeparator?: boolean;
}
export interface DocumentOptions {
  speaker?: boolean;
  theme?: string;
  themeOverrides?: Record<string, string>;
  hyperlinks?: boolean;
  maxProseWidth?: number;
  syntaxHighlightingDisabled?: boolean;
  streaming?: boolean;
  messageKey?: string;
  hideTrailingLine?: boolean;
  terminalRows?: number;
}
type HostNode = Omit<ReturnType<typeof Lr>, 'yogaNode' | 'onComputeLayout'> & {
  yogaNode: ReturnType<typeof layoutEngine.Node.create>;
  onComputeLayout: () => void;
};

/** Natural-height source tree for transcript rows; the visible owner diffs the viewport. */
export class TuiDocumentRenderer {
  private readonly styles = new Rd();
  private readonly config = layoutEngine.Config.create();
  private readonly root = Lr('ink-root', this.config) as unknown as HostNode;
  private readonly paint = ff(this.root, this.styles);
  private readonly cache = createRenderCache();
  private readonly container;
  private readonly frameWriter = new Zd({ isTTY: false, stylePool: this.styles });
  private front = go(0, 0, this.styles, new Cd(), new vs());
  private back = go(0, 0, this.styles, this.front.screen.charPool, this.front.screen.hyperlinkPool);
  private columns = 0;
  private closed = false;
  private failure: unknown;

  constructor() {
    this.root.onComputeLayout = () => this.root.yogaNode.calculateLayout(this.columns, undefined, 1);
    const fail = (error: unknown) => { this.failure ??= error; };
    this.container = Gt.createContainer(this.root, 1, null, false, null, 'litcode-document', fail, fail, fail, fail);
  }

  get liveNodes(): number { return this.config.liveNodes; }

  renderMarkdown(text: string, columns: number, options: DocumentOptions = {}): DocumentRow[] {
    const body = jsx(s, { flexDirection: 'column', flexShrink: 1,
      children: options.streaming ? jsx(tDr, { children: text, hideTrailingLine: options.hideTrailingLine ?? false }, options.messageKey)
        : jsx(Ya, { children: text, capProseWidth: true }, options.messageKey) }, undefined);
    const tree = options.speaker ? jsx(s, { alignItems: 'flex-start', flexDirection: 'row', width: '100%',
      children: [jsx(s, { minWidth: 2, flexShrink: 0, children: jsx(n, { color: 'text',
        children: process.platform === 'darwin' ? '⏺' : '●' }, undefined) }, 'speaker'), body] }, undefined) : body;
    return this.renderElement(tree, columns, options);
  }

  renderElement(tree: unknown, columns: number, options: DocumentOptions = {}): DocumentRow[] {
    if (this.closed) throw new Error('Document renderer is closed');
    this.columns = columns;
    this.root.yogaNode.setWidth(columns); this.root.yogaNode.setHeightAuto();
    const theme = options.theme ?? 'dark';
    const contexts = [
      [ThemeContext, { currentTheme: theme, resolvedTheme: i9t(S1(theme), options.themeOverrides), setThemeSetting: () => {} }],
      [TerminalSizeContext, { columns, rows: options.terminalRows ?? Number.MAX_SAFE_INTEGER }],
      [RenderSettingsContext, { syntaxHighlightingDisabled: options.syntaxHighlightingDisabled ?? false, maxProseWidth: options.maxProseWidth }],
      [SurfaceCapabilitiesContext, { hyperlinks: options.hyperlinks ?? false }],
      [RenderCacheContext, this.cache],
    ] as const;
    const element = contexts.reduceRight((children, [context, value]) => jsx(context.Provider, { value, children }, undefined), tree);
    Gt.updateContainerSync(element, this.container, null, null); Gt.flushSyncWork();
    if (this.failure) { const error = this.failure; this.failure = undefined; throw error; }
    const next = this.paint({ frontFrame: this.front, backFrame: this.back, isTTY: false,
      terminalWidth: columns, terminalRows: Number.MAX_SAFE_INTEGER,
      prevFrameContaminated: true, overlayActive: false });
    this.back = this.front; this.front = next;
    const ansi = this.frameWriter.renderFullFrame(next)[0]?.content.split('\n') ?? [];
    const screen = next.screen;
    return Array.from({ length: screen.height }, (_, row) => {
      let plain = '';
      const nextWrap = row + 1 < screen.height ? screen.softWrap[row + 1] ?? 0 : 0;
      const end = nextWrap ? nextWrap >>> 16 : screen.width;
      for (let column = 0; column < end; column++) {
        const cell = Zt(screen, column, row);
        if (cell && cell.width !== 2 && cell.width !== 3) plain += cell.char;
      }
      const wrap = screen.softWrap[row] ?? 0;
      return { text: nextWrap ? plain : plain.trimEnd(), ansi: ansi[row] ?? '', continuation: wrap !== 0,
        indent: wrap !== 0 ? wrap & 32767 : options.speaker ? 2 : 0,
        ...(nextWrap ? { end: nextWrap >>> 16 } : {}),
        ...(wrap & 32768 ? { elidedSeparator: true } : {}) };
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { Gt.updateContainerSync(null, this.container, null, null); Gt.flushSyncWork(); }
    finally { TE(this.root); this.config.free(); }
  }
}
