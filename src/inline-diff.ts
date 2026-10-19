// The inline diff dialog for the line-mode terminal (`--no-tui`).
//
// The recovered dispatch picks the presentation from the session and the request, not from the
// terminal width (`_5t`, chunk-n3ykh62m.js [670566,670666)): a local line-mode session takes the
// inline branch, and the full-screen panel stays the full-screen branch. This owner is that inline
// branch. Its data view is the local git-diff controller in `auto` mode — the same `PMr` local
// branch the panel host uses, without the panel's saved sidebar base mode.
//
// The element the source mounts is `si` (chunk-twzxjzbk.js [22672,28980)), already adapted as
// ./diff-dialog-dialog.ts for W173. This module supplies the host bindings W173 left to the caller:
// the data view, the key service, the app context with its focus manager, the store, the clock, the
// terminal size, the render settings, the selection instance and the session/project context.
import path from 'node:path';
import { collectGitDiff, GitDiffDataController, GitDiffPrimeStore, primeGitDiff } from './git-diff-data.js';
import { DiffDialog, DiffDialogDataContext, type DiffDialogData } from './diff-dialog-dialog.js';
import { VS } from './diff-dialog-tabs-source.js';
import { createScrollViewport, type ScrollViewport } from './diff-scroll-viewport.js';
import { Xe, nativeElement } from './plugin-chain-react-hooks.js';
import { gs } from './plugin-chain-registry-stores-source.js';
import { u } from './plugin-chain-press-button-host.js';
import { Zy } from './plugin-chain-press-button-source.js';
import { l, P as ProjectContext } from './plugin-chain-session-context-source.js';
import { sx } from './plugin-chain-app-state-source.js';
import { eE, systemMarkdownClock } from './plugin-chain-markdown-host.js';
import { Zm } from './plugin-chain-input-field-source.js';
import { TerminalSizeContext, RenderSettingsContext } from './tui-component-host.js';
import { NativeKeybindings } from './tui-native-keys.js';
import { TuiDocumentRenderer, type DocumentRow } from './tui-document-renderer.js';
import { withDiffCollection, st } from './git-diff-collector-host.js';
import { permissionDecision } from './permissions.js';
import type { Session } from './session.js';
import type { ToolDefinition } from './tools.js';
import { turnDiffMessages } from './turn-diff-messages.js';

const readTool = { schema: { name: 'read_file' }, readOnly: true } as ToolDefinition;

/** The contexts the dialog resolves keys in, most specific first. */
export const INLINE_DIFF_CONTEXTS = ['DiffDialog', 'Tabs', 'Select', 'Scroll', 'Global'] as const;

export class InlineDiffDialog {
  /** The contexts the input layer resolves this dialog's keys in, most specific first. */
  readonly contexts = INLINE_DIFF_CONTEXTS;
  /** The key service the dialog registers its own handlers on (`u`). */
  readonly keys = new NativeKeybindings();
  private readonly renderer = new TuiDocumentRenderer({ focus: true });
  private readonly store;
  private readonly project;
  private readonly sourceSession;
  private readonly prime = new GitDiffPrimeStore();
  private readonly unsubscribe: () => void;
  private controller: GitDiffDataController;
  private disposed = false;
  private opening: AbortController | undefined;
  private shown = false;
  private refreshKey = 0;
  private columns = 80;
  private rows = 24;
  private notice: string | null = null;
  // The modal host's viewport (`nmt` hands `Ga.modalViewport` to the modal content). The tabs
  // register their scroll box on it through `claimScrollBox`, and the dialog reads the handle back
  // through `Ffe()`; the claim value is the chrome height it reports, which only gates the box.
  private readonly viewport: ScrollViewport = createScrollViewport();
  private claimedChrome: number | null = null;
  private readonly claimScrollBox = (chrome: number | null): void => { this.claimedChrome = chrome; };

  constructor(private readonly session: Session, private readonly changed: () => void) {
    this.project = { cwd: session.config.workspace };
    this.sourceSession = { id: session.id, project: this.project, subscribe: (_listener: () => void) => () => {} };
    this.refreshKey = session.fileHistory.trackSequence;
    // The dialog's file list claims itself in `activeOverlays` while it is mounted (`sa`,
    // chunk-pxjy4t8j.js [1298,1856)), so the store it writes through starts with that collection.
    this.store = gs({ fileHistory: session.fileHistory, todos: {}, panelFileView: null,
      diffPanelVisible: false, activeOverlays: new Set<string>(),
      settings: { prefersReducedMotion: session.config.prefersReducedMotion ?? false },
      toolPermissionContext: { denied: (file: string) => this.denied(file) } }, undefined);
    this.controller = this.createController(false);
    this.unsubscribe = session.subscribeFileHistory(() => {
      this.refreshKey = session.fileHistory.trackSequence;
      this.store.setState((state: any) => ({ ...state, fileHistory: session.fileHistory }));
      if (this.shown) { this.controller.setRefreshKey(this.refreshKey); this.changed(); }
    });
  }

  get visible(): boolean { return this.shown; }

  /** Open the dialog against the session's git view. */
  async open(): Promise<string> {
    if (this.shown || this.opening) return 'Diff dialog is already open';
    const abort = new AbortController();
    this.opening = abort;
    try {
      const repository = await withDiffCollection({ cwd: this.project.cwd, sessionStart: this.session.startedAt },
        () => st('git', ['--no-optional-locks', 'rev-parse', '--is-inside-work-tree'],
          { cwd: this.project.cwd, abortSignal: abort.signal }));
      if (abort.signal.aborted || this.disposed) return '';
      if (repository.code !== 0) return 'The diff dialog is available in a Git repository';
      await primeGitDiff(this.prime, this.project.cwd, 'auto', this.refreshKey, abort.signal,
        (cwd, mode, signal) => collectGitDiff(cwd, mode, signal, this.session.startedAt));
      if (abort.signal.aborted || this.disposed) return '';
      this.controller.dispose();
      this.controller = this.createController(true);
      this.shown = true;
      this.notice = null;
      this.controller.start();
      this.changed();
      return '';
    } catch (error) {
      if (!abort.signal.aborted) throw error;
      return '';
    } finally { if (this.opening === abort) this.opening = undefined; }
  }

  /** Source `si`'s dismissal: the dialog reports its own message, which the caller displays. */
  dismiss(): void {
    if (!this.shown) return;
    this.opening?.abort();
    this.opening = undefined;
    this.shown = false;
    this.controller.setEnabled(false);
    // Unmount so the mounted tree's effects clean up — the file list removes itself from the
    // store's `activeOverlays` on teardown, and the renderer stays usable for a reopen.
    this.renderer.unmount();
    this.changed();
  }

  /** Resolve one raw key sequence against the dialog's contexts and run its action. */
  handleAction(action: string): boolean {
    if (!this.shown) return false;
    const handled = this.keys.dispatchAction(action);
    if (handled) this.changed();
    return handled;
  }

  /** The dialog's rows for the current view: natural height, painted rows only. */
  rowsFor(columns: number, terminalRows: number): string[] {
    this.columns = columns;
    this.rows = terminalRows;
    const rendered: DocumentRow[] = this.renderer.renderElement(this.element(), columns, { terminalRows });
    return rendered.map(row => row.ansi);
  }

  element(): unknown {
    let element: unknown = Xe(DiffDialog, { messages: turnDiffMessages(this.session.events),
      onDone: (message: string) => { this.notice = message; this.dismiss(); } });
    const contexts: Array<[unknown, unknown]> = [
      [DiffDialogDataContext, this.data()], [u, this.keys],
      [VS, { rows: this.rows, columns: this.columns, scrollViewport: this.viewport,
        claimScrollBox: this.claimScrollBox }],
      [Zy, this.renderer.appContext],
      [eE, systemMarkdownClock], [Zm, { columns: this.columns, rows: this.rows }],
      [TerminalSizeContext, { columns: this.columns, rows: this.rows }],
      [RenderSettingsContext, { syntaxHighlightingDisabled: this.session.config.syntaxHighlightingDisabled ?? false }],
      [l, this.sourceSession],
      [ProjectContext, { get: () => this.project, subscribe: this.sourceSession.subscribe }],
      [sx, this.store],
    ];
    for (const [context, value] of contexts.reverse()) element = Xe(context, { value, children: element });
    return nativeElement(element);
  }

  private data(): DiffDialogData {
    return { data: this.controller.view, notice: this.notice };
  }

  private createController(enabled: boolean): GitDiffDataController {
    return new GitDiffDataController({ cwd: this.project.cwd, baseMode: 'auto', enabled, store: this.prime,
      refreshKey: this.refreshKey,
      collect: (cwd, mode, signal) => collectGitDiff(cwd, mode, signal, this.session.startedAt),
      onChange: () => this.changed() });
  }

  private denied(file: string): boolean {
    const relative = path.relative(this.project.cwd, file);
    return [file, relative].some(candidate => permissionDecision(this.session.config.permissions, readTool,
      { path: candidate }, this.session.permissionUpdates).decision === 'deny');
  }

  /** The notice the dialog reported on dismissal, once. */
  takeNotice(): string | null { const notice = this.notice; this.notice = null; return notice; }

  close(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.opening?.abort();
    this.opening = undefined;
    this.shown = false;
    this.unsubscribe();
    this.controller.dispose();
    this.keys.close();
    this.renderer.close();
  }
}
