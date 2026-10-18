import fs from 'node:fs';
import path from 'node:path';
import { collectGitDiff, GitDiffDataController, GitDiffPrimeStore, primeGitDiff, type GitDiffBaseMode } from './git-diff-data.js';
import { _0, rxe } from './diff-panel-source.js';
import { DiffPanelContext, type DiffPanelHost } from './diff-panel-host.js';
import { Xe, nativeElement } from './plugin-chain-react-hooks.js';
import { gs } from './plugin-chain-registry-stores-source.js';
import { u } from './plugin-chain-press-button-host.js';
import { Zy } from './plugin-chain-press-button-source.js';
import { l, P as ProjectContext } from './plugin-chain-session-context-source.js';
import { sx } from './plugin-chain-app-state-source.js';
import { eE, systemMarkdownClock, SelectionInstanceContext } from './plugin-chain-markdown-host.js';
import type { TerminalSelectionInstance } from './plugin-chain-markdown-host.js';
import { Zm } from './plugin-chain-input-field-source.js';
import { TerminalSizeContext, RenderSettingsContext } from './tui-component-host.js';
import { NativeKeybindings } from './tui-native-keys.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { saveDiffDisplaySetting } from './theme-settings.js';
import { permissionDecision } from './permissions.js';
import { st, withDiffCollection } from './git-diff-collector-host.js';
import type { Session } from './session.js';
import type { ToolDefinition } from './tools.js';

const readTool = { schema: { name: 'read_file' }, readOnly: true } as ToolDefinition;

export class DiffPanel {
  readonly keys = new NativeKeybindings();
  private readonly store;
  private readonly project;
  private controller: GitDiffDataController;
  private readonly prime = new GitDiffPrimeStore();
  private readonly unsubscribe: () => void;
  private columns = 80;
  private autoTimer: ReturnType<typeof setTimeout> | undefined;
  private openPreference: boolean | undefined;
  private readonly host: DiffPanelHost;
  private readonly sourceSession;
  private shown = false;
  private disposed = false;
  private opening: AbortController | undefined;
  private refreshKey = 0;
  private base: 'session' | 'uncommitted' | 'branch' = 'session';
  private readonly userDir: string;

  constructor(private readonly session: Session, private readonly changed: () => void,
    private readonly attach: DiffPanelHost['attachSelection']) {
    this.userDir = session.config.configSources?.userDir ?? defaultUserDir();
    try {
      const file = path.join(this.userDir, 'settings.json');
      const stat = fs.lstatSync(file);
      if (stat.isFile() && !stat.isSymbolicLink()) {
        const bytes = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
        if (!bytes.overflow) {
          const settings = JSON.parse(bytes.buffer.toString('utf8'));
          if (settings.diffSidebarBaseMode === 'branch' || settings.diffSidebarBaseMode === 'uncommitted') this.base = settings.diffSidebarBaseMode;
          if (typeof settings.diffSidebarOpen === 'boolean') this.openPreference = settings.diffSidebarOpen;
        }
      }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    this.project = { cwd: session.config.workspace };
    this.sourceSession = { id: session.id, project: this.project, subscribe: (_listener: () => void) => () => {} };
    this.refreshKey = session.fileHistory.trackSequence;
    this.store = gs({ fileHistory: session.fileHistory, todos: {}, panelFileView: null,
      diffPanelVisible: false, settings: { prefersReducedMotion: session.config.prefersReducedMotion ?? false },
      toolPermissionContext: { denied: (file: string) => this.denied(file) } }, undefined);
    this.controller = this.createController(false);
    this.unsubscribe = session.subscribeFileHistory(() => {
      this.refreshKey = session.fileHistory.trackSequence;
      this.store.setState((state: any) => ({ ...state, fileHistory: session.fileHistory }));
      if (this.shown) this.controller.setRefreshKey(this.refreshKey);
      else this.scheduleAutoOpen();
    });
    const owner = this;
    this.host = {
      store: this.store,
      get data() { return owner.controller.view; },
      get baseMode() { return owner.base; },
      cycleBase: mode => this.cycleBase(mode), close: () => this.hide(), denied: file => this.denied(file),
      attachSelection: selection => this.attach(selection),
    };
  }

  get sessionId(): string { return this.session.id; }
  get visible(): boolean { return this.shown; }
  width(columns: number): number { return this.shown && columns >= 110 ? _0(columns) as number : 0; }
  setColumns(columns: number): void {
    if (this.columns === columns) return;
    this.columns = columns; this.scheduleAutoOpen();
  }

  /** Vcn/ge, chunk-xmvfy87k.js [6916,7624) UTF-16. Prime before the panel mounts. */
  async toggle(columns: number): Promise<string> {
    if (this.shown || this.opening) { this.hide(); return 'Diff panel hidden'; }
    if (columns < 110) return 'Resize your terminal to at least 110 columns to show the diff panel';
    if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = undefined; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([this.open(true), new Promise<string>(resolve => {
        timer = setTimeout(() => resolve('Diff panel shown'), 2000);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }

  refresh(): void {
    if (!this.disposed && this.shown) this.controller.refresh();
  }

  hide(): void {
    if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = undefined; }
    this.opening?.abort(); this.opening = undefined;
    this.openPreference = false;
    saveDiffDisplaySetting('diffSidebarOpen', false, this.userDir);
    this.shown = false;
    this.controller.setEnabled(false);
    this.changed();
  }

  private createController(enabled: boolean): GitDiffDataController {
    return new GitDiffDataController({ cwd: this.project.cwd, baseMode: this.base, enabled,
      store: this.prime, refreshKey: this.refreshKey,
      collect: (cwd, mode, signal) => collectGitDiff(cwd, mode, signal, this.session.startedAt),
      onChange: () => this.changed() });
  }

  private async open(manual: boolean): Promise<string> {
    const abort = new AbortController(); this.opening = abort;
    try {
      const repository = await withDiffCollection({ cwd: this.project.cwd, sessionStart: this.session.startedAt },
        () => st('git', ['--no-optional-locks', 'rev-parse', '--is-inside-work-tree'], { cwd: this.project.cwd, abortSignal: abort.signal }));
      if (abort.signal.aborted || this.disposed) return 'Diff panel hidden';
      if (repository.code !== 0) return 'Diff panel is available in a Git repository';
      await primeGitDiff(this.prime, this.project.cwd, this.base, this.refreshKey, abort.signal,
        (cwd, mode, signal) => collectGitDiff(cwd, mode, signal, this.session.startedAt));
      if (abort.signal.aborted || this.disposed) return 'Diff panel hidden';
      if (manual) {
        this.openPreference = true;
        saveDiffDisplaySetting('diffSidebarOpen', true, this.userDir);
      }
      this.controller.dispose(); this.controller = this.createController(true);
      this.shown = true; this.controller.start(); this.changed();
      return 'Diff panel shown';
    } catch (error) {
      if (!abort.signal.aborted) throw error;
      return 'Diff panel hidden';
    } finally { if (this.opening === abort) this.opening = undefined; }
  }

  /** h7/HMr, chunk-24k7d6mw.js [1664288,1666412), chunk-xmvfy87k.js [6556,6651) UTF-16. */
  private scheduleAutoOpen(): void {
    if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = undefined; }
    if (this.disposed || this.shown || this.opening || this.openPreference === false
      || !this.session.fileHistory.trackedFiles.size || this.columns < (this.openPreference === true ? 110 : 144)) return;
    this.autoTimer = setTimeout(() => {
      this.autoTimer = undefined;
      void this.open(false).catch(() => {});
    }, 150);
    this.autoTimer.unref?.();
  }

  element(width: number, columns: number, rows: number, appContext: unknown, selection: TerminalSelectionInstance): unknown {
    let element: unknown = Xe(rxe, { width, minCol: columns - width, onAskAboutSelection: this.attach });
    const contexts: Array<[unknown, unknown]> = [
      [DiffPanelContext, this.host], [u, this.keys], [Zy, appContext], [eE, systemMarkdownClock],
      [SelectionInstanceContext, selection],
      [Zm, { columns: width, rows }], [TerminalSizeContext, { columns: width, rows }],
      [RenderSettingsContext, { syntaxHighlightingDisabled: this.session.config.syntaxHighlightingDisabled ?? false }],
      [l, this.sourceSession], [ProjectContext, { get: () => this.project, subscribe: this.sourceSession.subscribe }], [sx, this.store],
    ];
    for (const [context, value] of contexts.reverse()) element = Xe(context, { value, children: element });
    return nativeElement(element);
  }

  close(): void {
    this.disposed = true; this.opening?.abort(); this.opening = undefined;
    if (this.autoTimer) clearTimeout(this.autoTimer);
    this.autoTimer = undefined; this.unsubscribe(); this.controller.dispose(); this.keys.close();
  }

  private cycleBase(mode: string): GitDiffBaseMode {
    const modes = ['session', 'uncommitted', 'branch'] as const;
    const next = modes[(modes.indexOf(mode as typeof modes[number]) + 1) % modes.length]!;
    saveDiffDisplaySetting('diffSidebarBaseMode', next, this.userDir);
    this.base = next; this.controller.setBaseMode(next); this.changed();
    return next;
  }

  private denied(file: string): boolean {
    const relative = path.relative(this.project.cwd, file);
    return [file, relative].some(candidate => permissionDecision(this.session.config.permissions, readTool,
      { path: candidate }, this.session.permissionUpdates).decision === 'deny');
  }
}
