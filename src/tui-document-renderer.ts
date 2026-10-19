import { layoutEngine } from './tui-layout.js';
import { jsx } from './tui-jsx.js';
import { Gt, Lr, TE, ff, Rd, Cd, vs, go, Zd, Zt, ZDr, Wfe } from './tui-render-engine.js';
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
type HostNode = Omit<ReturnType<typeof Lr>, 'yogaNode' | 'focusManager' | 'onComputeLayout' | 'onRender'> & {
  yogaNode: ReturnType<typeof layoutEngine.Node.create>;
  focusManager: InstanceType<typeof ZDr>;
  onComputeLayout: () => void;
  onRender?: () => void;
};

export interface DocumentRendererOptions {
  /** Mount an interactive element: build the focus manager and app context `Zy` carries. */
  focus?: boolean;
}

/** Natural-height source tree for transcript rows; the visible owner diffs the viewport. */
export class TuiDocumentRenderer {
  private readonly styles = new Rd();
  private readonly config = layoutEngine.Config.create();
  private root: HostNode | null = null;
  private paint: ReturnType<typeof ff> | null = null;
  private readonly cache = createRenderCache();
  private container: ReturnType<typeof Gt.createContainer> | null = null;
  private needsMount = true;
  private readonly frameWriter = new Zd({ isTTY: false, stylePool: this.styles });
  private readonly layoutListeners = new Set<() => void>();
  private front = go(0, 0, this.styles, new Cd(), new vs());
  private back = go(0, 0, this.styles, this.front.screen.charPool, this.front.screen.hyperlinkPool);
  private columns = 0;
  private closed = false;
  private failure: unknown;
  private readonly interactive: boolean;

  /**
   * The app context a mounted interactive element reads through `Zy`. A renderer built for plain
   * document rows has no focus tree, so the fields answer the empty case; one built with `focus`
   * carries the real focus manager and root the recovered components expect.
   */
  readonly appContext: {
    focusManager: InstanceType<typeof ZDr> | null;
    rootNode: HostNode | null;
    subscribeLayout: (listener: () => void) => () => void;
    isHoverTracked: () => boolean;
    subscribeHoverTracked: (listener: () => void) => () => void;
    retainFinePointer: () => () => void;
  };

  constructor(options: DocumentRendererOptions = {}) {
    this.interactive = options.focus === true;
    this.appContext = {
      focusManager: null,
      rootNode: null,
      subscribeLayout: (listener: () => void) => {
        this.layoutListeners.add(listener);
        return () => { this.layoutListeners.delete(listener); };
      },
      isHoverTracked: () => false,
      subscribeHoverTracked: (_listener: () => void) => () => {},
      retainFinePointer: () => () => {},
    };
  }

  private readonly fail = (error: unknown): void => { this.failure ??= error; };

  /** Build the mounted root, its paint pass and a reconciler container on first use. */
  private ensureMounted(): void {
    if (!this.needsMount) return;
    this.needsMount = false;
    const root = Lr('ink-root', this.config) as unknown as HostNode;
    // A commit can land after `close()` freed the yoga node; the closed renderer has nothing to lay out.
    root.onComputeLayout = () => {
      if (this.closed || this.root !== root) return;
      root.yogaNode.calculateLayout(this.columns, undefined, 1);
    };
    if (this.interactive) {
      root.focusManager = new ZDr((node: unknown, event: unknown) => Wfe.dispatchDiscrete(node, event));
      root.onRender = () => { for (const listener of this.layoutListeners) listener(); };
    }
    this.root = root;
    this.paint = ff(root, this.styles);
    this.container = this.createContainer(root);
    this.appContext.focusManager = this.interactive ? root.focusManager : null;
    this.appContext.rootNode = this.interactive ? root : null;
  }

  private createContainer(root: HostNode) {
    const { fail } = this;
    return Gt.createContainer(root, 1, null, false, null, 'litcode-document', fail, fail, fail, fail);
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
    this.ensureMounted();
    this.columns = columns;
    const root = this.root!;
    root.yogaNode.setWidth(columns); root.yogaNode.setHeightAuto();
    const theme = options.theme ?? 'dark';
    const contexts = [
      [ThemeContext, { currentTheme: theme, resolvedTheme: i9t(S1(theme), options.themeOverrides), setThemeSetting: () => {} }],
      [TerminalSizeContext, { columns, rows: options.terminalRows ?? Number.MAX_SAFE_INTEGER }],
      [RenderSettingsContext, { syntaxHighlightingDisabled: options.syntaxHighlightingDisabled ?? false, maxProseWidth: options.maxProseWidth }],
      [SurfaceCapabilitiesContext, { hyperlinks: options.hyperlinks ?? false }],
      [RenderCacheContext, this.cache],
    ] as const;
    const element = contexts.reduceRight((children, [context, value]) => jsx(context.Provider, { value, children }, undefined), tree);
    Gt.updateContainerSync(element, this.container!, null, null); Gt.flushSyncWork();
    if (this.failure) { const error = this.failure; this.failure = undefined; throw error; }
    const next = this.paint!({ frontFrame: this.front, backFrame: this.back, isTTY: false,
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
    try {
      if (this.container !== null) { Gt.updateContainerSync(null, this.container, null, null); Gt.flushSyncWork(); }
    } finally {
      this.closed = true;
      if (this.root !== null) TE(this.root);
      this.root = null; this.paint = null; this.container = null;
      this.config.free();
    }
  }

  /** Drop the mounted tree so its effects clean up, keeping the renderer usable afterwards. */
  unmount(): void {
    if (this.closed) return;
    try {
      if (this.container !== null) { Gt.updateContainerSync(null, this.container, null, null); Gt.flushSyncWork(); }
    } finally {
      // A root that committed null takes no later tree, so the next render builds a fresh root,
      // paint pass and container; the old root's yoga nodes are freed with it.
      if (this.root !== null) TE(this.root);
      this.root = null; this.paint = null; this.container = null; this.needsMount = true;
      this.appContext.focusManager = null; this.appContext.rootNode = null;
      this.front = go(0, 0, this.styles, new Cd(), new vs());
      this.back = go(0, 0, this.styles, this.front.screen.charPool, this.front.screen.hyperlinkPool);
    }
  }
}
