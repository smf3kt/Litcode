import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
/**
 * Full-screen interaction layer.
 *
 * W44 ports the recovered React reconciler/HostConfig, JavaScript layout,
 * tree painter, screen pools and frame diff from chunk-06azbynj.js (SHA-256
 * 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd).
 * TuiRenderer owns that chain; Node CellSegmenter/width/wrap are explicit host
 * adaptations. TuiDocumentRenderer paints the copied Markdown components,
 * theme and highlighter into transcript cells; copied input/footer components
 * frame the owned editor. The footer's permission-mode chip is ported
 * (`tui-footer-source.ts`); its task, agent, voice, artifact and IDE branches
 * have no local source and remain unported.
 * Complete provenance and remaining differences are recorded in W44.
 *
 * Other ports include the mode sequences (`tui-modes.ts`, a copy), the
 * keybinding registry and its context layering (`tui-keys.ts`, copied tables),
 * the kill ring (`kill-ring.ts`, a copy), and the transcript viewport contract
 * (`tui-transcript.ts`, adapted). Input rows and visual navigation use copied
 * Si/Lt/Ct measurement; raw insertion and submission remain owned transitions.
 *
 * The class implements the same surface `TerminalInput` exposes, so the
 * interactive loop can drive either one without knowing which it has.
 */

import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { Writable, type Readable } from 'node:stream';
import { formatHookTerminalSequence } from './hook-terminal.js';
import { reduceKillRing } from './kill-ring.js';
import { TerminalModeController, type MouseTracking } from './tui-modes.js';
import { Keymap, chordForAction, chordSequence, contextStack, type TuiContext } from './tui-keys.js';
import type { TerminalMouseEvent } from './terminal-mouse.js';
import {
  createSelection, dragSpan, lineSpan, moveSelectionColumn, reduceSelection, selectionColumn,
  selectionTextFromRows, wordSpan,
  type SelectionAnchor, type SelectionRow, type SelectionState,
} from './tui-selection.js';
import { composerEditRelay, type ChainRelayKey, type ComposerEditRelay } from './plugin-chain-relay.js';
import { externalMode, modeChip, modeColorSlot } from './tui-footer-source.js';
import { PROMPT_BORDER_SLOT, effectiveSessionColor, sessionColorSlot, type SessionColor } from './session-color.js';
import { effectivePermissionPolicy } from './permissions.js';
import { paintedDecorations, normalizedRuns, highlightRows, type DecorationRun, type PaintedDecorations, type PromptSegment } from './tui-input-decorations.js';
import { composerHighlights } from './tui-input-highlights.js';
import { Art } from './tui-input-highlights-source.js';
import { osc52Payload } from './clipboard-osc52.js';
import { layoutEngine } from './tui-layout.js';
import { renderPreviewMarkdown } from './tui-markdown.js';
import { TuiRenderer, type FooterPart, type PromptLine } from './tui-renderer.js';
import { DiffPanel } from './diff-panel.js';
import { DiffSelectionOwner } from './diff-selection.js';
import { randomUUID } from 'node:crypto';
import { TuiDocumentRenderer } from './tui-document-renderer.js';
import { Welcome, welcomeDensity } from './tui-welcome.js';
import { clt, tLo } from './tui-stream-preview.js';
import { Zqn, l$t } from './tui-preview-visibility.js';
import { layoutInput } from './tui-input-navigation.js';
import { InputUndo } from './tui-input-undo.js';
import { InputPaste, expandPastedText, referencedPastes, type InputSnapshot } from './tui-input-paste.js';
import { ThemeState, parseTheme, themeChoices, type ThemeSetting, type BuiltinTheme } from './tui-theme-state.js';
import { SystemThemeMonitor } from './tui-system-theme.js';
import { CustomThemeCatalog } from './tui-custom-themes.js';
import { ThemeEditor, themeFileWriter } from './theme-editor.js';
import { ThinkingProgress, type AgentProgressEvent, type TurnDuration } from './tui-progress.js';
import { ProgressCompletion } from './tui-progress-completion.js';
import type { TaskRecord } from './tasks.js';
import { progressTime, type ProgressDisplaySettings } from './tui-progress-settings.js';
import { createThemeColorComponents } from './tui-theme-color-components.js';
import { S1 } from './tui-theme-colors.js';
import { acceptEmojiQuery, inlineEmojiCompletion } from './tui-emoji.js';
import { FileIndex } from './tui-file-index.js';
import { agentSuggestionRows } from './tui-agent-suggestions.js';
import { combinedAtRows } from './tui-at-suggestions.js';
import { templateArgumentRows } from './tui-mcp-suggestions.js';
import {
  atQuery, applyFileSuggestion, commonPrefix, directorySuggestionRows, fileSuggestionRows,
  listWorkingDirectory, shapeAtDisplayText, FILE_SUGGESTION_LIMIT, type AtQuery,
} from './tui-file-suggestions.js';
import { ge } from './tui-color.js';

/** The sixteen ANSI foreground names a theme slot can name (the source's own `be` table). */
const ANSI_FOREGROUND: Readonly<Record<string, number>> = {
  black: 30, red: 31, green: 32, yellow: 33, blue: 34, magenta: 35, cyan: 36, white: 37,
  blackBright: 90, redBright: 91, greenBright: 92, yellowBright: 93, blueBright: 94,
  magentaBright: 95, cyanBright: 96, whiteBright: 97,
};

const SLOT_RGB = /^rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)$/;
const SLOT_ANSI256 = /^ansi256\(\s?(\d+)\s?\)$/;
const SLOT_HEX = /[a-f\d]{6}|[a-f\d]{3}/i;

/**
 * The source's `zye` foreground branch (chunk-3cynezh1.js): `ansi:<name>`, `#rgb`, `#rrggbb`,
 * `ansi256(n)` and `rgb(r,g,b)`. Those are the same five spellings `HK` lets a theme override
 * carry, so a custom theme's hex override paints instead of being dropped.
 */
function slotForeground(slot: string | undefined): string {
  if (slot === undefined || (ge as unknown as { level: number }).level <= 0) return '';
  if (slot.startsWith('ansi:')) {
    const code = ANSI_FOREGROUND[slot.slice(5)];
    return code === undefined ? '' : `\u001b[${code}m`;
  }
  if (slot.startsWith('#')) {
    const match = SLOT_HEX.exec(slot);
    let digits = match ? match[0] : '000000';
    if (digits.length === 3) digits = [...digits].map(digit => digit + digit).join('');
    const value = Number.parseInt(digits, 16);
    return `\u001b[38;2;${value >> 16 & 255};${value >> 8 & 255};${value & 255}m`;
  }
  if (slot.startsWith('ansi256')) {
    const match = SLOT_ANSI256.exec(slot);
    return match ? `\u001b[38;5;${Number(match[1])}m` : '';
  }
  const rgb = SLOT_RGB.exec(slot);
  return rgb ? `\u001b[38;2;${Number(rgb[1])};${Number(rgb[2])};${Number(rgb[3])}m` : '';
}

/** `P0e`: a directory listing is reused for fifteen seconds. */
const DIRECTORY_LISTING_TTL = 15_000;
/** The walk fallback stops here, which is the source's own entry budget order of size. */
const FILE_INDEX_ENTRY_LIMIT = 20_000;
/** Directories the walk never descends into, matching the source's ripgrep globs. */
const WALK_SKIP = new Set(['.git', '.svn', '.hg', '.bzr', '.jj', '.sl']);

/** `A`/`X`: one `git ls-files` run, or undefined when the workspace is not a repository. */
async function gitPathList(args: readonly string[], cwd: string): Promise<string[] | undefined> {
  return new Promise(resolve => {
    execFile('git', [...args], { cwd, timeout: 10_000, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        if (error) { resolve(undefined); return; }
        resolve(String(stdout).split('\n').filter(line => line.length > 0));
      });
  });
}

/** `z`: the bounded directory walk that stands in for the source's ripgrep listing. */
function walkWorkspace(root: string, limit: number): string[] {
  const found: string[] = [];
  const queue: string[] = [''];
  while (queue.length > 0 && found.length < limit) {
    const relative = queue.shift()!;
    const absolute = relative === '' ? root : path.join(root, relative);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(absolute, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (found.length >= limit) break;
      const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (WALK_SKIP.has(entry.name)) continue;
        queue.push(child);
      } else if (entry.isFile()) found.push(child);
    }
  }
  return found;
}

import { acceptanceText, commandSuggestions, emojiRows, maxVisibleSuggestions, suggestionMaxColumnWidth,
  suggestionRowHeight, suggestionRowOwners, suggestionRowSegments, suggestionRowWindow,
  suggestionsEmptyMessage, TUI_COMMANDS, type CommandSuggestion,
  type TuiCommand } from './tui-autocomplete.js';
import { te as symbols } from './tui-symbols.js';
import { editExternal, openExternalFile, type EditorHandoff, type ExternalEditorResult } from './external-editor.js';
import { InputVim, type EditorMode, type VimBridge } from './tui-vim.js';
import { vimKey } from './tui-vim-keys.js';
import { InputGestures } from './tui-input-gestures.js';
import { TerminalFocus } from './tui-focus.js';
import { afkCountdown, afkTimeoutSettings, type AfkTimeoutSettings } from './tui-afk.js';
import { StatusLine } from './tui-statusline.js';
import { InputHistory } from './tui-input-history.js';
import { HistorySearch, type SearchSnapshot } from './tui-history-search.js';
import { ScopedPicker, type PickerScope, type ScopePickerSnapshot } from './tui-scope-picker.js';
import { captureClipboardImage } from './clipboard.js';
import { QuestionImages, readQuestionImage } from './question-images.js';
import { QUESTION_NOTES_ONLY } from './interaction-tools.js';
/** Source HI() gate for the picker: see research/ports/W44-scope-picker-copies.json entryEvidence. */
const SOURCE_PICKER_OWNS_HISTORY_SEARCH = true;
import { jde } from './tui-statusline-components.js';
import { jsx } from './tui-jsx.js';
import { s, n, Do } from './tui-base-components.js';
import { Tde } from './tui-source-chrome.js';
import {
  createTranscriptState, layoutTranscript, reduceTranscript, renderedTranscriptRows, transcriptLines, wrapEntry,
  wrapEntryRows,
  type TranscriptEntry, type TranscriptScrollCommand, type TranscriptState, type RenderedRow,
} from './tui-transcript.js';
import {
  cellWidth, createEditorState, questionPreviewText, reduceEditor, reduceEditorWithUndo, TerminalKeyDecoder,
  type EditorAction, type EditorCommand, type EditorPolicy, type EditorState, type Keybindings, type TerminalCallbacks,
  type TerminalPromptAnswer, type TerminalPromptGroup, type TerminalPromptGroupAnswer,
  type TerminalPromptRequest,
} from './terminal.js';

export interface TuiOptions extends EditorPolicy, TerminalCallbacks {
  input: Readable & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (raw: boolean) => unknown };
  output: Writable & { isTTY?: boolean; columns?: number; rows?: number };
  /** Slash commands offered above the composer; defaults to the local command table. */
  commands?: readonly TuiCommand[];
  /** The agent types the `@` list offers, as `agent-` rows. */
  agentTypes?: readonly import('./tui-agent-suggestions.js').AgentSuggestionSource[];
  /** The connected servers' resources and templates, loaded once on the first `@` draft.
   *  Catalog mode only; without it the MCP families stay empty. */
  mcpCatalog?: (signal: AbortSignal) => Promise<{
    resources: Readonly<Record<string, readonly import('./tui-at-suggestions.js').McpResource[]>>;
    templates: Readonly<Record<string, readonly import('./tui-at-suggestions.js').McpTemplate[]>>;
  }>;
  prompt?: string;
  continuationPrompt?: string;
  history?: readonly string[];
  keybindings?: Keybindings;
  mouseTracking?: MouseTracking;
  synchronizedUpdate?: boolean;
  /** Rows kept for the prompt box; the recovered app grows it with the draft. */
  promptRows?: number;
  prefersReducedMotion?: boolean;
  showTurnDuration?: boolean;
  showMessageTimestamps?: boolean;
  /** `/focus`: the brief transcript holds the streaming preview while tools run. */
  briefTranscript?: boolean;
  progressSettings?: ProgressDisplaySettings;
  maxProseWidth?: number;
  syntaxHighlightingDisabled?: boolean;
  theme?: ThemeSetting;
  /** Version shown by the startup header. */
  version?: string;
  userDir?: string;
  workspace?: string;
  plugins?: import('./plugins.js').PluginConfig;
  /** Trusted host/test clipboard dependency for question image paste. */
  clipboard?: import('./clipboard.js').ClipboardOptions;
}

type TuiEvents = {
  submit: [text: string, attachment?: import('./terminal.js').PromptDiffSelection]; interrupt: []; exit: []; pasteRejected: [bytes: number]; inputError: [error: Error];
  action: [action: string];
};

export type TuiScreen = 'chat' | 'transcript' | 'search' | 'dialog';

interface ActiveDialog {
  request: TerminalPromptRequest;
  themeEditor?: ThemeEditor;
  busy?: boolean;
  editor: EditorState;
  undo: InputUndo;
  index: number;
  selected: Set<number>;
  scroll: number;
  followFocus: boolean;
  error?: string;
  /**
   * Grouped questions run as a sequence of steps plus a review page, copied
   * from the recovered tabbed question flow whose last tab reviews every
   * answer. `step` is the group index, or `groups.length` for the review page.
   */
  step: number;
  /** One entry per completed group, keyed by the group's key. */
  answers: Map<string, TerminalPromptGroupAnswer>;
  /**
   * Recovered `a3` notes: per-question free text drawn under the choices and
   * attached to the answer annotation. Kept apart from the Other answer text.
   */
  notes: Map<string, string>;
  notesEditor: EditorState;
  notesUndo: InputUndo;
  notesEditing: boolean;
  /** Recovered `hwe`: one image map per question key, owned by this dialog. */
  images: QuestionImages;
  /** The in-flight clipboard capture, aborted when the dialog settles. */
  imageCapture?: AbortController;
  /** Source `ko`: the option focus moved during this step. */
  optionTouched: boolean;
  /** The request's `adjust` axis position; only read when the request has one. */
  adjustIndex: number;
  finish(answer?: TerminalPromptAnswer): void;
}

/** One dialog's AFK clock, copied from the recovered `Zbe` component state. */
interface DialogAfk {
  target: ActiveDialog;
  settings: AfkTimeoutSettings;
  fullSeconds: number;
  remainingSeconds: number;
  showCountdown: boolean;
  fired: boolean;
  /** Source `Le`: the last tick at which the terminal was focused. */
  base: number;
  /** Source `Ip()`: the last answer interaction. */
  lastInteraction: number;
  timer: ReturnType<typeof setInterval>;
}

const SEPARATOR = '─';
/** Recovered `J` annotation notes bound, shared with the answer admission. */
const NOTES_MAX_CHARS = 8192;

export class TuiTerminal extends EventEmitter<TuiEvents> {
  readonly isTTY: boolean;
  /** Committed output (model text, command output) is appended to the transcript. */
  readonly outputStream: Writable;
  /** Status lines are held on the status row instead of scrolling the transcript. */
  readonly statusStream: Writable;

  private readonly modes: TerminalModeController;
  private renderer: TuiRenderer | undefined;
  private diffPanel: DiffPanel | undefined;
  private diffPointer: { column: number; row: number; moved: boolean } | undefined;
  private readonly diffSelection = new DiffSelectionOwner(() => this.render());
  private diffAttachmentFocused = false;
  private documentRenderer: TuiDocumentRenderer | undefined;
  private welcomeRenderer: TuiDocumentRenderer | undefined;
  private welcomeRows: string[] = [];
  private welcomeKey = '';
  private readonly messageRows = new WeakMap<TranscriptEntry, { columns: number; maxProseWidth?: number;
    syntaxHighlightingDisabled?: boolean; theme: BuiltinTheme; themeGeneration: number; progressGeneration: number;
    stamp?: string; rows: RenderedRow[] }>();
  private readonly renderEntryRows = (entry: TranscriptEntry, columns: number): RenderedRow[] => {
    const document = entry.markdown !== undefined || entry.duration !== undefined;
    if (document && entry.streaming && !Zqn(this.prefersReducedMotion, this.windowsTerminal)) return [];
    if (entry.duration && !this.showTurnDuration) return [];
    const stamp = this.entryStamp(entry);
    const cached = this.messageRows.get(entry);
    if (cached?.columns === columns && cached.maxProseWidth === this.maxProseWidth
      && cached.syntaxHighlightingDisabled === this.syntaxHighlightingDisabled
      && cached.theme === this.theme.current && cached.themeGeneration === this.theme.generation
      && cached.progressGeneration === this.progressGeneration && cached.stamp === stamp) return cached.rows;
    this.documentRenderer ??= new TuiDocumentRenderer();
    const body = entry.duration ? this.documentRenderer.renderElement(jsx(ProgressCompletion, {message:entry.duration, formatTime:this.timeFormatter.format}, entry.duration.uuid), columns,
      {theme:this.theme.current, themeOverrides:this.theme.overrides}) : document ? this.documentRenderer.renderMarkdown(entry.markdown ?? entry.text, columns,
      { speaker: entry.speaker, streaming: entry.streaming, messageKey: entry.messageKey,
        hideTrailingLine: entry.hideTrailingLine, maxProseWidth: this.maxProseWidth,
        syntaxHighlightingDisabled: this.syntaxHighlightingDisabled, theme: this.theme.current,
        themeOverrides: this.theme.overrides }) : wrapEntryRows(entry, columns);
    // Source `Va`: the stamp is its own dim row above the message, so it never reflows the body.
    const stampRows = stamp === '' ? [] : document
      ? this.documentRenderer.renderElement(jsx(n, {dimColor:true, children:stamp}, 'stamp'),
        columns, {theme:this.theme.current, themeOverrides:this.theme.overrides})
      : [{ text: stamp, continuation: false, indent: 0 }];
    const rows = [...stampRows, ...body];
    this.messageRows.set(entry, { columns, maxProseWidth: this.maxProseWidth,
      syntaxHighlightingDisabled: this.syntaxHighlightingDisabled, theme: this.theme.current,
      themeGeneration: this.theme.generation, progressGeneration:this.progressGeneration, stamp, rows });
    return rows;
  };

  /**
   * Source `Os` decides which messages carry a stamp and `Va` which clock it shows: the transcript
   * viewer stamps both user and assistant messages, the live chat screen stamps only assistant
   * messages and only with the setting on, and the setting promotes the short time to the full
   * date-and-zone stamp.
   */
  private entryStamp(entry: TranscriptEntry): string {
    if (entry.timestamp === undefined || entry.duration !== undefined) return '';
    const transcript = this.screen === 'transcript';
    const stampable = entry.kind === 'assistant' ? transcript || this.showMessageTimestamps
      : entry.kind === 'user' && transcript;
    if (!stampable || entry.text === '') return '';
    const clock = this.showMessageTimestamps ? this.timeFormatter.stamp : this.timeFormatter.short;
    return typeof clock === 'function' ? clock(entry.timestamp) : '';
  }
  private readonly keys = new Keymap();
  private readonly wheelKeys = new Keymap();
  private readonly decoder: TerminalKeyDecoder;
  private escapeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly outputDecoder = new StringDecoder('utf8');
  private readonly statusDecoder = new StringDecoder('utf8');
  private readonly originalRaw: boolean;
  private readonly originalPaused: boolean;
  private started = false;
  private closed = false;
  private changedRaw = false;
  private drawnRows = 0;
  private cursorRow = 0;
  private cursorColumn = 0;

  private editor: EditorState;
  /** Slash-command suggestion state, re-derived from the draft whenever it is read. */
  private autocompleteIndex = 0;
  private autocompleteForText = '';
  private autocompleteDismissedText: string | undefined;
  /** The suggestion band's screen rows, so the pointer can hit-test a row. */
  private autocompleteBand: { top: number; owners: readonly number[] } | undefined;
  /** The suggestion each drawn band line belongs to, from `suggestionRowOwners`. */
  private autocompleteOwners: readonly number[] = [];
  /** First suggestion the band is currently showing, from `suggestionWindow`. */
  private autocompleteWindowStart = 0;
  /** The composer edit relay: the recovered `prompt.edit` hook, inert until a module hooks it. */
  private readonly editRelay: ComposerEditRelay;
  /** The runs a chain answer painted over the draft, held to the text they were painted for. */
  private readonly decorations: PaintedDecorations;
  /** Source snapshot buffer is cleared on submit/stash and owns its pending timer. */
  private readonly undo = new InputUndo();
  /** Source `lf = R(kn)` and `Er = R(!1)` (`chunk-24k7d6mw.js` 819244): the editor mode the undo
   *  buffer is baselined on, and whether a Vim INSERT run is already open. */
  private undoEditorMode: 'normal' | 'vim' | undefined;
  private undoGesture = false;
  private readonly pasteOwner = new InputPaste();
  private readonly gestures = new InputGestures();
  private gestureHandling = false;
  private stashedDraft: InputSnapshot | undefined;
  private editorController: AbortController | undefined;
  private editorTask: Promise<ExternalEditorResult> | undefined;
  private editorDialog: ActiveDialog | undefined;
  private editorSuspended = false;
  /** Per-terminal focus state; close releases its rendering/clock subscribers. */
  private readonly focus = new TerminalFocus();
  private readonly inputHistory = new InputHistory(error => this.setStatus(`History: ${String(error)}`));
  private historyBinding = 0;
  private readonly vim = new InputVim();
  private vimEnabled = false;
  private vimHandling = false;
  /** Multi-click sequence state, copied from the recovered pointer handler. */
  private clickCountValue = 0;
  private lastClick: { time: number; line: number; column: number; screen: TuiScreen } | undefined;
  private screen: TuiScreen = 'chat';
  private transcript: TranscriptState;
  /** One provider response owns this cumulative raw source; end/close releases it. */
  private assistantMessage: { index?: number; source: string; key: string; startedAt: number } | undefined;
  private messageSequence = 0;
  private prefersReducedMotion: boolean | undefined;
  private showTurnDuration = true;
  /** Source `showMessageTimestamps`: stamp each message with its arrival time. */
  private showMessageTimestamps = false;
  /** Source `briefTranscript`: the fold that holds the in-flight preview during tool use. */
  private briefTranscript = false;
  /** `/color`'s pick; `Mk`'s banner row exists only while this is set. */
  private sessionColor: SessionColor | undefined;
  private progressSettings: ProgressDisplaySettings = {};
  private progressGeneration = 0;
  private timeFormatter = progressTime({});
  private maxProseWidth: number | undefined;
  private syntaxHighlightingDisabled: boolean | undefined;
  private readonly theme: ThemeState;
  /** Auto-theme query/mode owner follows saved or preview theme; close releases it. */
  private systemTheme: SystemThemeMonitor | undefined;
  /** User catalog and directory watcher are rebound with the session and closed here. */
  private customThemes: CustomThemeCatalog | undefined;
  private themeUserDir: string | undefined;
  private readonly windowsTerminal = l$t();
  private readonly previewStore = tLo();
  /** Source coalescer owns one cancel function; completion/new response/close dispose it. */
  private readonly previewCoalescer = clt({
    scheduleTimeout: (flush: () => void, milliseconds: number) => {
      const timer = setTimeout(() => {
        if (this.closed) return;
        try { flush(); } catch (error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
      }, milliseconds);
      return () => clearTimeout(timer);
    },
    onFlush: (text: string | null) => {
      const displayed = Zqn(this.prefersReducedMotion, this.windowsTerminal) ? text : null;
      this.previewStore.setRaw(displayed);
      if (!this.closed && this.assistantMessage && displayed !== null) this.paintAssistantPreview();
    },
  });
  /** Source progress clock and task expiry callbacks belong to this terminal. */
  private readonly progress = new ThinkingProgress(() => {
    if (this.closed) return;
    try {this.render();} catch (error) {this.onError(error instanceof Error ? error : new Error(String(error)));}
  });
  private progressRenderer: TuiDocumentRenderer | undefined;
  private progressHeight = 0;
  private completedDuration: string | undefined;
  /** Source status-line owner and document rows share this terminal's mount lifetime. */
  private readonly statusLine = new StatusLine();
  private statusLineSetting: import('./tui-statusline.js').StatusLineSetting | undefined;
  private statusLineText: string | undefined;
  private statusLineRenderer: TuiDocumentRenderer | undefined;
  private statusLineRows: string[] = [];
  private statusLineKey = '';
  /** The session's effective permission mode, the input to the footer's mode chip. */
  private permissionMode: string | undefined;
  private unsubscribePermissions: (() => void) | undefined;
  private selection: SelectionState = createSelection();
  private dialog: ActiveDialog | undefined;
  /** The grouped question dialog's AFK countdown, when the host enables it. */
  private afk: DialogAfk | undefined;
  private status = '';
  private running = false;
  /** Composer gates `dg()` and `C7t()`: on until the session settings say otherwise. */
  private workflowKeywordAvailable = true;
  private workflowKeywordTriggerEnabled = true;
  /** Source `Kl().emojiCompletionEnabled !== false`: the `:name:` typeahead is on by default. */
  private emojiCompletionEnabled = true;
  /** The `@path` index (`mnn`), filled in the background from the workspace's file list. */
  private readonly fileIndex = new FileIndex();
  private fileIndexStarted = false;
  /** The directory listings an explicit `@./path` asks for, cached for the source's TTL. */
  private readonly directoryListings = new Map<string, { at: number; entries: { name: string; isDirectory: boolean }[] }>();
  /** The connected servers' `@` catalog, read once in the background on the first `@`. */
  private mcpCatalogStarted = false;
  private mcpCatalogAbort: AbortController | undefined;
  private mcpResources: Readonly<Record<string, readonly import('./tui-at-suggestions.js').McpResource[]>> = {};
  private mcpResourceTemplates: Readonly<Record<string, readonly import('./tui-at-suggestions.js').McpTemplate[]>> = {};
  /** `Zi`: the per-draft dismissal the alt+w toggle sets. */
  private workflowKeywordDismissed = false;
  /** The keyed notice `workflow-keyword-ignored`, shown on the one status row this terminal has. */
  /** The one status-row notice this terminal shows, with the owner that may clear it. */
  private statusNoticeOwner: string | undefined;
  private statusNoticeText: string | undefined;
  private statusNoticeTimer: ReturnType<typeof setTimeout> | undefined;
  private sourceSearch: HistorySearch | undefined;
  private sourcePicker: ScopedPicker | undefined;
  private pickerQuery = createEditorState();
  private readonly pickerUndo = new InputUndo();
  private queryEditor = createEditorState();
  private readonly queryUndo = new InputUndo();
  private searchSessionId = '';
  private searchQuery = '';
  private searchIndex = -1;
  private searchDraft: InputSnapshot = {text:'',cursor:0,pastedContents:{}};

  constructor(private readonly options: TuiOptions) {
    super();
    this.vimEnabled=options.editorMode==='vim';this.vim.setRemaps(options.vimInsertModeRemaps);
    this.undoEditorMode=this.vimEnabled?'vim':'normal';
    this.vim.onModeChange=()=>{this.undoGesture=false;};
    this.prefersReducedMotion = options.prefersReducedMotion;
    this.showTurnDuration = options.showTurnDuration !== false;
    this.showMessageTimestamps = options.showMessageTimestamps === true;
    this.briefTranscript = options.briefTranscript === true;
    this.progressSettings = structuredClone(options.progressSettings ?? {});
    this.timeFormatter = progressTime(this.progressSettings);
    this.progress.setVerbs(this.progressSettings.spinnerVerbs);
    this.progress.setReducedMotion(options.prefersReducedMotion === true);
    this.focus.subscribe(() => {
      this.progress.setFocused(this.focus.focused);
      if (!this.focus.focused && this.selection.dragging) this.selection = reduceSelection(this.selection, { type: 'end' });
      if (!this.focus.focused && this.diffPointer) {
        this.renderer?.endNativeSelection(); this.diffPointer = undefined;
      }
      this.render();
    });
    this.maxProseWidth = options.maxProseWidth;
    this.syntaxHighlightingDisabled = options.syntaxHighlightingDisabled;
    this.theme = new ThemeState(options.theme);
    this.isTTY = Boolean(options.input.isTTY && options.output.isTTY && options.input.setRawMode);
    this.originalRaw = Boolean(options.input.isRaw);
    this.originalPaused = options.input.readableFlowing !== true;
    this.editor = createEditorState(options.historyLimit === 0 ? []
      : options.history?.slice(-Math.max(1, options.historyLimit ?? 100)));
    this.transcript = createTranscriptState();
    // The composer's edit relay (research/ports/W45-chain-runner.md#slice-3): the copied `cue` hook
    // with this product's composer as its host. It records nothing until a loaded module hooks
    // `prompt.edit`, and from then on a rewrite the chain answers with lands in the draft here.
    // The host's `carry` and `paint` are the source's own bindings: the edit is offered to the painted
    // runs first, and an answer's runs are normalized against the text they answered before they are
    // stored (`fS=(fp,qN)=>M.paint(Rke(fp,qN))`, chunk-24k7d6mw.js [831394,831404)).
    this.decorations = paintedDecorations(() => this.editor.text, () => this.render());
    this.editRelay = composerEditRelay({
      read: () => ({ text: this.editor.text, cursor: this.editor.cursor }),
      commit: box => {
        this.replaceDraft({ ...this.editor, text: box.text, cursor: box.cursor });
        this.publishDraft();
        this.render();
      },
      carry: edit => this.decorations.carry(edit.before, edit.after),
      paint: (runs, text) => this.decorations.paint(normalizedRuns(runs as readonly DecorationRun[], text)),
      report: message => this.setStatus(message),
    });
    this.decoder = new TerminalKeyDecoder(options.keybindings, options.maxPasteBytes, true,true);
    this.modes = new TerminalModeController({ output: options.output,
      mouseTracking: options.mouseTracking ?? 'full',
      synchronizedUpdate: options.synchronizedUpdate ?? true });
    this.subscribe(options);
    this.outputStream = new Writable({
      write: (chunk, _encoding, callback) => {
        try { this.write(this.outputDecoder.write(chunk)); callback(); } catch (error) { callback(error as Error); }
      },
      final: callback => {
        try { const tail = this.outputDecoder.end(); if (tail) this.write(tail); callback(); }
        catch (error) { callback(error as Error); }
      },
    });
    this.statusStream = new Writable({
      write: (chunk, _encoding, callback) => {
        try { this.setStatus(this.statusDecoder.write(chunk)); callback(); } catch (error) { callback(error as Error); }
      },
      final: callback => {
        try { const tail = this.statusDecoder.end(); if (tail) this.setStatus(tail); callback(); }
        catch (error) { callback(error as Error); }
      },
    });
  }

  subscribe(callbacks: TerminalCallbacks): () => void {
    if (callbacks.onSubmit) this.on('submit', callbacks.onSubmit);
    if (callbacks.onInterrupt) this.on('interrupt', callbacks.onInterrupt);
    if (callbacks.onExit) this.on('exit', callbacks.onExit);
    if (callbacks.onAction) this.on('action', callbacks.onAction);
    return () => {
      if (callbacks.onSubmit) this.off('submit', callbacks.onSubmit);
      if (callbacks.onInterrupt) this.off('interrupt', callbacks.onInterrupt);
      if (callbacks.onExit) this.off('exit', callbacks.onExit);
      if (callbacks.onAction) this.off('action', callbacks.onAction);
    };
  }

  get state(): Readonly<EditorState> { return { ...this.editor, history: [...this.editor.history],
    pastedContents:structuredClone(this.editor.pastedContents),historyPastes:structuredClone(this.editor.historyPastes),
    historyDraftPastes:structuredClone(this.editor.historyDraftPastes),killRing: structuredClone(this.editor.killRing) }; }
  async bindInputHistory(session: import('./session.js').Session): Promise<void> {
    const generation = ++this.historyBinding;
    this.sourceSearch?.close(); this.sourceSearch = undefined;
    this.sourcePicker?.close(); this.sourcePicker = undefined;
    this.queryUndo.clear(); this.queryEditor = createEditorState();
    this.pickerUndo.clear(); this.pickerQuery = createEditorState();
    if (this.screen === 'search') this.screen = 'chat';
    this.searchSessionId = session.id;
    const entries = await this.inputHistory.bind(session);
    if (this.closed || generation !== this.historyBinding) return;
    const limit = Math.max(0, this.options.historyLimit ?? 100), selected = entries.slice(-limit);
    this.editor = { ...this.editor, history: limit ? selected.map(entry => entry.display) : [],
      historyPastes: limit ? selected.map(entry => entry.pastedContents) : [], historyIndex: limit ? selected.length : 0,
      historyDraft: this.editor.text, historyDraftPastes: structuredClone(this.editor.pastedContents) };
    this.render();
  }
  async flushInputHistory(): Promise<void> { await this.inputHistory.finish(); }
  bindDiffPanel(session: import('./session.js').Session): void {
    if (this.diffPanel?.sessionId === session.id) return;
    this.diffPanel?.close();
    this.diffPointer = undefined; this.diffSelection.dismiss(); this.diffAttachmentFocused = false;
    this.renderer?.clearNativeSelection();
    this.diffPanel = new DiffPanel(session, () => {
      if (!this.closed) {
        try { this.render(); } catch (error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
      }
    }, selection => this.diffSelection.set(selection));
  }
  async toggleDiffPanel(): Promise<string> {
    if (!this.diffPanel) throw new Error('Diff panel has no bound session');
    return this.diffPanel.toggle(this.options.output.columns ?? 80);
  }
  restoreDiffSelection(attachment: import('./terminal.js').PromptDiffSelection): void {
    if (attachment.sessionId === this.diffPanel?.sessionId) this.diffSelection.restore(attachment.promptUuid, attachment.selection);
  }
  bindStatusLine(session: import('./session.js').Session): void {
    this.statusLineSetting = session.config.statusLine;
    this.statusLineText = undefined; this.statusLineKey = '';
    this.unsubscribePermissions?.();
    const readMode = () => externalMode(effectivePermissionPolicy(session.config.permissions,
      session.permissionUpdates)?.mode ?? 'default');
    this.permissionMode = readMode();
    this.unsubscribePermissions = session.subscribePermissions(() => {
      if (this.closed) return;
      const mode = readMode();
      if (mode === this.permissionMode) return;
      this.permissionMode = mode;
      try { this.render(); } catch (error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
    });
    this.statusLine.bind(session, text => {
      if (this.closed) return;
      this.statusLineText = text; this.statusLineKey = '';
      try { this.render(); } catch (error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
    });
    this.render();
  }
  async flushStatusLine(): Promise<void> { await this.statusLine.flush(); }
  get currentScreen(): TuiScreen { return this.screen; }
  get transcriptState(): TranscriptState { return this.transcript; }

  /** Append one entry to the transcript, following the tail unless scrolled away. */
  append(entry: TranscriptEntry): void {
    const view = this.viewportSize();
    this.transcript = reduceTranscript(this.transcript,
      { type: 'append', entry: entry.timestamp === undefined ? { ...entry, timestamp: Date.now() } : entry },
      { rows: view.rows, total: this.transcriptTotal(view.columns) });
    this.render();
  }

  setStatus(text: string): void {
    // Status output arrives as whole lines; the row shows the newest one.
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(line => line.length > 0);
    this.status = lines.length ? lines.at(-1)! : this.status;
    this.render();
  }

  async editDraft(signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult> {
    if (!this.isTTY || !this.started || this.closed || this.running || this.dialog || this.editorController) return {content:null};
    this.sourceSearch?.cancel();
    this.sourcePicker?.cancel();
    const snapshot={text:this.editor.text,cursor:this.editor.cursor,pastedContents:structuredClone(this.editor.pastedContents)};
    const result = await this.handoffEditor(snapshot, signal, workspace);
    if(!this.closed&&!signal.aborted&&result.content!==null&&result.content!==snapshot.text){
      const text=result.content.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,'');
      this.pushUndo(snapshot.text,snapshot.cursor,snapshot.pastedContents,true);
      const pastedContents=referencedPastes(text,snapshot.pastedContents);
      this.replaceDraft({...this.editor,text,cursor:text.length,pastedContents,historyIndex:this.editor.history.length,
        historyDraft:text,historyDraftPastes:pastedContents});this.vim.reset();this.render();
    }
    return result;
  }

  /** `/keybindings` (`Zie`): the same handoff, opening one existing file instead of the draft. */
  async openFile(file: string, signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult> {
    if (!this.isTTY || !this.started || this.closed || this.running || this.dialog || this.editorController) return {content:null};
    this.sourceSearch?.cancel();
    this.sourcePicker?.cancel();
    const controller=new AbortController();this.editorController=controller;
    const handoff=this.editorHandoff();
    const task = openExternalFile(file,handoff,AbortSignal.any([signal,controller.signal]),workspace)
      .then(result => controller.signal.aborted ? {content:null} : result)
      .finally(() => {
        if(this.editorSuspended)handoff.resume();
        if(this.editorController===controller){this.editorController=undefined;this.editorTask=undefined;this.editorDialog=undefined;}
      });
    this.editorTask=task;
    return task;
  }

  private handoffEditor(snapshot: Parameters<typeof editExternal>[0], signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult> {
    const controller=new AbortController();this.editorController=controller;
    const handoff=this.editorHandoff();
    const task = editExternal(snapshot,handoff,AbortSignal.any([signal,controller.signal]),workspace)
      .then(result => controller.signal.aborted ? {content:null} : result)
      .finally(() => {
        if(this.editorSuspended)handoff.resume();
        if(this.editorController===controller){this.editorController=undefined;this.editorTask=undefined;this.editorDialog=undefined;}
      });
    this.editorTask=task;
    return task;
  }

  private editorHandoff(): EditorHandoff {
    const suspend=()=>{
      this.gestures.reset();this.vim.externalMutation();
      this.editorSuspended=true;this.options.input.off('data',this.onData);this.options.input.pause();
      if(this.escapeTimer){clearTimeout(this.escapeTimer);this.escapeTimer=undefined;}this.decoder.reset();this.keys.reset();
      this.selection=createSelection();this.progress.pause(true);this.progress.setVisible(false);this.statusLine.setActive(false);this.systemTheme?.setActive(false);
      this.modes.leave();this.options.input.setRawMode!(false);
    };
    const resume=()=>{
      if(this.closed)return;
      this.options.input.setRawMode!(true);this.options.input.on('data',this.onData);this.modes.enter();
      this.editorSuspended=false;this.progress.pause(this.dialog !== undefined);this.syncSystemTheme();
      this.noteAfkInteraction();
      this.renderer?.invalidate();this.options.input.resume();this.render();
    };
    return {suspend,resume};
  }

  /** a3/f3 callbacks, chunk-24k7d6mw.js [1146770,1147260)/[1154985,1155625), UTF-16. */
  private async editQuestion(dialog: ActiveDialog, owner: 'notes' | 'other'): Promise<void> {
    if (this.closed || this.editorController || this.dialog !== dialog || !this.isTTY) return;
    const question = this.notesStep(dialog);
    if (!question || (owner === 'notes' ? !dialog.notesEditing
      : !question.allowText || dialog.index !== question.choices?.length)) return;
    const state = owner === 'notes' ? dialog.notesEditor : dialog.editor;
    const oldText = state.text;
    this.editorDialog = dialog;
    try {
      // $j receives question text alone, without composer paste expansion or cursor hints.
      const result = await this.handoffEditor({text:oldText}, new AbortController().signal, this.options.workspace);
      if (this.closed || this.dialog !== dialog || this.notesStep(dialog) !== question) return;
      if (result.content === null) {if(result.error){dialog.error=result.error;this.render();}return;}
      if (result.content === oldText) return;
      const text = result.content;
      const limit = owner === 'notes' ? NOTES_MAX_CHARS : question.maxTextChars ?? dialog.request.maxTextChars ?? 32 * 1024;
      if (text.length > limit || Buffer.byteLength(text) > 32 * 1024) {
        dialog.error = `Answer exceeds ${limit} characters or 32768 bytes`; this.render(); return;
      }
      const next = {...state,text,cursor:text.length};
      if (owner === 'notes') {
        dialog.notesUndo.record(oldText,state.cursor,{immediate:true});
        dialog.notesEditor=next;this.storeNotes(dialog);
      } else {
        dialog.undo.record(oldText,state.cursor,{immediate:true});
        dialog.editor=next;this.storeMultiDialogAnswer(dialog);
      }
      dialog.error=undefined;this.render();
    } catch (error) {
      if (this.dialog === dialog && !this.closed) {dialog.error=String(error);this.render();}
    }
  }

  /**
   * Recovered `gEe`/`vae(Ac(tt()))`: an explicit paste chord captures one PNG
   * through the platform clipboard and stores it against the focused question.
   * The capture is cancellable and a stale result can never reach a later
   * dialog or question.
   */
  private async attachQuestionImage(dialog: ActiveDialog, question: TerminalPromptGroup | undefined): Promise<void> {
    if (this.closed || this.dialog !== dialog || !question || this.editorController || dialog.imageCapture) return;
    const workspace = this.options.workspace;
    if (workspace === undefined) { dialog.error = 'Image paste needs a workspace'; this.render(); return; }
    const controller = new AbortController();
    dialog.imageCapture = controller;
    try {
      const captured = await captureClipboardImage(workspace, controller.signal, this.options.clipboard);
      if (this.closed || this.dialog !== dialog || controller.signal.aborted || this.notesStep(dialog) !== question) {
        fs.rmSync(path.resolve(workspace, captured.path), { force: true });
        return;
      }
      const content = await readQuestionImage(path.resolve(workspace, captured.path));
      if (this.closed || this.dialog !== dialog || controller.signal.aborted || this.notesStep(dialog) !== question) {
        fs.rmSync(path.resolve(workspace, captured.path), { force: true });
        return;
      }
      dialog.images.add(question.key, { ...content, path: path.resolve(workspace, captured.path) });
      dialog.error = undefined;
    } catch (error) {
      if (this.dialog === dialog && !this.closed && !controller.signal.aborted) { dialog.error = String(error); }
    } finally {
      if (dialog.imageCapture === controller) dialog.imageCapture = undefined;
      if (this.dialog === dialog && !this.closed) this.render();
    }
  }

  setEditorMode(mode?: EditorMode,remaps?:Record<string,unknown>): void {
    if(this.vimEnabled!==(mode==='vim')){this.gestures.reset();this.vim.reset();}this.vimEnabled=mode==='vim';this.vim.setRemaps(remaps);this.render();
  }

  /** mr/Qs, chunk-qh0w98pn.js [34940,46581)/[7830,8512) UTF-16, share the painted input width. */
  private handleVim(action: EditorAction): boolean {
    const key=vimKey(action);if(!key)return false;this.vimHandling=true;const owner=this;
    const bridge:VimBridge={get text(){return owner.editor.text;},get cursor(){return owner.editor.cursor;},
      columns:this.conversationColumns()-2,
      change:(text,previous)=>{
        const raw=text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,'');
        if(raw===this.editor.text)return;
        this.pushUndo(previous?.value??this.editor.text,previous?.cursorOffset??this.editor.cursor,this.editor.pastedContents);
        const pastedContents=referencedPastes(raw,this.editor.pastedContents);
        this.editor={...this.editor,text:raw,pastedContents,historyIndex:this.editor.history.length,historyDraft:raw,historyDraftPastes:pastedContents};
      },offset:cursor=>{this.editor={...this.editor,cursor};},register:text=>expandPastedText(text,this.editor.pastedContents),
      fallback:event=>{if(action.type==='insert')this.dispatch({type:'insert',text:event.key});
        else if(action.type==='key'){if(action.command)this.dispatch({type:action.command});else if(/^[^\u0000-\u001f]+$/u.test(event.key))this.dispatch({type:'insert',text:event.key});}
        else this.dispatch(action);},undo:()=>this.dispatch({type:'undo'}),
      history:direction=>this.dispatch({type:direction<0?'up':'down'}),search:()=>this.enterSearch(),
    };
    try{this.vim.key(key,bridge);}finally{this.vimHandling=false;}this.render();return true;
  }

  private handleGesture(key:'interrupt'|'eof'|'escape'):void{
    this.gestureHandling=true;
    try{this.gestures.key(key,{text:this.editor.text,pastedContents:structuredClone(this.editor.pastedContents),
      clear:()=>{this.undo.clear();this.vim.reset();this.editor={...createEditorState(this.editor.history),historyPastes:this.editor.historyPastes,killRing:this.editor.killRing};},
      delete:()=>this.dispatch({type:'delete'}),exit:()=>{this.close();this.emit('exit');},
      history:(text,contents)=>{this.inputHistory.add({display:text,pastedContents:contents});const limit=Math.max(0,this.options.historyLimit??100);if(limit)this.editor={...this.editor,
        history:[...this.editor.history,text].slice(-limit),historyPastes:[...this.editor.historyPastes,structuredClone(contents)].slice(-limit)};},
      hint:()=>this.render()});}finally{this.gestureHandling=false;}
    this.render();
  }

  setRunning(running: boolean): void {
    this.running = running;
    if (!running) { this.progress.stop(); this.diffPanel?.refresh(); }
    this.dispatch({ type: 'running', value: running });
  }

  setProgress(event: AgentProgressEvent): void {
    if (this.closed) return;
    if (event.kind === 'start') this.progress.start(event.uuid, event.startedAt);
    else if (event.kind === 'phase') {
      if (!this.progress.mode(event.mode)) return;
      // Source `Ue`: while the fold holds, the streaming block is not rendered. The entry
      // painted before the tool started is taken back off the transcript; the source text
      // stays in `assistantMessage`, so the paint that ends the fold re-appends it.
      if (this.holdsFocusPreview()) this.hideStreamingPreview();
    }
    else {
      this.progress.stop();
      if (event.reason !== 'error' && event.reason !== 'aborted') this.restoreTurnDuration(event.duration);
    }
    this.render();
  }

  private hideStreamingPreview(): void {
    const message = this.assistantMessage;
    if (!message || message.index === undefined) return;
    const entries = this.transcript.entries.filter(entry => !(entry.streaming && entry.messageKey === message.key));
    if (entries.length === this.transcript.entries.length) return;
    this.transcript = { ...this.transcript, entries };
    message.index = undefined;
    this.selection = createSelection();
  }

  setShowTurnDuration(value?: boolean): void {
    const enabled = value !== false;
    if (enabled === this.showTurnDuration) return;
    this.showTurnDuration = enabled; this.selection = createSelection(); this.render();
  }

  setShowMessageTimestamps(value?: boolean): void {
    const enabled = value === true;
    if (enabled === this.showMessageTimestamps) return;
    this.showMessageTimestamps = enabled; this.selection = createSelection(); this.render();
  }

  /** Source `vNt`'s `focusFoldHoldsPreview`, live half: `/focus` toggles the fold. */
  setBriefTranscript(enabled: boolean): void {
    if (enabled === this.briefTranscript) return;
    this.briefTranscript = enabled;
    // Leaving focus re-paints the preview the fold was holding back.
    if (!enabled) this.paintAssistantPreview();
    this.render();
  }

  /**
   * The fold holds the in-flight preview while the turn is inside a tool call or the tail
   * line is still incomplete (`vNt`: `streamingToolUses > 0 || tailBlank`). The completed
   * paint in `endAssistantMessage` is never held, so the finished text always lands.
   */
  private holdsFocusPreview(): boolean {
    if (!this.briefTranscript || !this.running) return false;
    // Source `sc`: a hidden trailing line with no newline in the displayed text.
    const derived = this.previewStore.getDerived();
    return this.progress.hasActiveTools() || (derived.hideTrailingLine && !derived.displayedHasNewline);
  }

  /** `/color`: the banner row exists only while a colour is set, so this changes the layout. */
  setSessionColor(color: SessionColor | undefined): void {
    if (this.closed || color === this.sessionColor) return;
    this.sessionColor = color; this.selection = createSelection(); this.render();
  }

  setProgressSettings(settings: ProgressDisplaySettings): void {
    if (this.closed || JSON.stringify(this.progressSettings) === JSON.stringify(settings)) return;
    const view = this.viewportSize();
    const pinned = this.transcript.offset >= Math.max(0, this.transcriptTotal(view.columns) - view.rows);
    this.progressSettings = structuredClone(settings); this.timeFormatter = progressTime(this.progressSettings);
    this.progress.setVerbs(settings.spinnerVerbs); this.progressGeneration++;
    this.selection = createSelection();
    if (pinned) this.transcript = {...this.transcript, offset:Number.MAX_SAFE_INTEGER};
    this.render();
  }

  setTasks(tasks: readonly TaskRecord[]): void {
    if (this.closed) return;
    this.progress.tasks(tasks); this.render();
  }

  pauseProgress(paused: boolean): void {this.progress.pause(paused);}

  restoreTurnDuration(duration?: TurnDuration): void {
    if (!duration || this.closed || this.completedDuration === duration.uuid) return;
    this.completedDuration = duration.uuid;
    this.append({kind:'system', text:'', duration});
  }

  setKeybindings(keybindings: Keybindings = {}): void { this.gestures.reset();this.decoder.setKeybindings(keybindings); }

  setPrefersReducedMotion(value?: boolean): void {
    if (this.prefersReducedMotion === value) return;
    this.prefersReducedMotion = value;
    this.progress.setReducedMotion(value === true);
    this.previewStore.setRaw(Zqn(value, this.windowsTerminal) ? this.previewCoalescer.peek() : null);
    if (this.assistantMessage && this.previewStore.getDerived().displayed !== null) this.paintAssistantPreview();
    else { this.selection = createSelection(); this.render(); }
  }

  setMaxProseWidth(value?: number): void {
    if (this.maxProseWidth === value) return;
    const view = this.viewportSize();
    const pinned = this.transcript.offset >= Math.max(0, this.transcriptTotal(view.columns) - view.rows);
    this.maxProseWidth = value;
    this.selection = createSelection();
    if (pinned) this.transcript = { ...this.transcript, offset: Number.MAX_SAFE_INTEGER };
    this.render();
  }

  setSyntaxHighlightingDisabled(value?: boolean): void {
    if (this.syntaxHighlightingDisabled === value) return;
    const view = this.viewportSize();
    const pinned = this.transcript.offset >= Math.max(0, this.transcriptTotal(view.columns) - view.rows);
    this.syntaxHighlightingDisabled = value;
    this.selection = createSelection();
    if (pinned) this.transcript = { ...this.transcript, offset: Number.MAX_SAFE_INTEGER };
    this.render();
  }

  setEmojiCompletion(enabled: boolean): void {
    if (this.emojiCompletionEnabled === enabled) return;
    this.emojiCompletionEnabled = enabled;
    this.render();
  }

  /** The recovered reload voids the shared command and skill tables (`Nhr`/`Fhr`,
   *  chunk-3ph567jx.js 3862/3898) so the next render re-reads them. This host captures the
   *  composer's list once, so a rescan replaces it; the next draft re-suggests. */
  setCommands(commands: readonly TuiCommand[]): void {
    this.options.commands = commands;
    this.render();
  }

  setWorkflowKeywordSettings(settings: { available: boolean; triggerEnabled: boolean }): void {
    if (this.workflowKeywordAvailable === settings.available && this.workflowKeywordTriggerEnabled === settings.triggerEnabled) return;
    this.workflowKeywordAvailable = settings.available;
    this.workflowKeywordTriggerEnabled = settings.triggerEnabled;
    this.render();
  }

  /** Source `da`: dismiss or restore the keyword run for this draft. The handler only exists while
   *  `dg() && C7t()` and the draft holds a keyword run (`Pi.length > 0`), so an inactive press falls
   *  through to the next context. */
  private toggleWorkflowKeyword(): boolean {
    if (!this.workflowKeywordAvailable || !this.workflowKeywordTriggerEnabled) return false;
    if (Art(this.editor.text).length === 0) return false;
    this.workflowKeywordDismissed = !this.workflowKeywordDismissed;
    if (this.workflowKeywordDismissed) {
      // Source notice: `Ultracode keyword ignored for this prompt${display ? ` · ${display} to undo` : ''}`;
      // `us` returns the registry's own text, whose fallback here is the same literal the source passes.
      this.showWorkflowKeywordNotice('Ultracode keyword ignored for this prompt · alt+w to undo');
    } else {
      this.clearWorkflowKeywordNotice();
    }
    this.render();
    return true;
  }

  /**
   * Source notice key `workflow-keyword-ignored`, `timeoutMs: 5000`. This terminal has one status row
   * instead of a keyed notification queue, so the clear only removes the row while it still shows it.
   */
  private showWorkflowKeywordNotice(text: string): void {
    this.showStatusNotice('workflow-keyword', text, 5_000);
  }

  /** Source notice `pasted-text-unavailable`: `priority:"immediate"`, default 8000 ms timeout. */
  private showPasteGoneNotice(text: string): void {
    this.showStatusNotice('paste-gone', text, 8_000);
  }

  private showStatusNotice(owner: string, text: string, timeoutMs: number): void {
    this.statusNoticeOwner = owner;
    this.statusNoticeText = text;
    this.setStatus(text);
    if (this.statusNoticeTimer !== undefined) clearTimeout(this.statusNoticeTimer);
    this.statusNoticeTimer = setTimeout(() => {
      this.statusNoticeTimer = undefined;
      if (this.statusNoticeText !== text) return;
      this.statusNoticeOwner = undefined;
      this.statusNoticeText = undefined;
      if (this.status === text) { this.status = ''; this.render(); }
    }, timeoutMs);
    this.statusNoticeTimer.unref?.();
  }

  private clearWorkflowKeywordNotice(): void {
    this.clearStatusNotice('workflow-keyword');
  }

  private clearStatusNotice(owner: string): void {
    if (this.statusNoticeOwner !== owner) return;
    const text = this.statusNoticeText;
    if (this.statusNoticeTimer !== undefined) { clearTimeout(this.statusNoticeTimer); this.statusNoticeTimer = undefined; }
    this.statusNoticeOwner = undefined;
    this.statusNoticeText = undefined;
    if (text !== undefined && this.status === text) { this.status = ''; this.render(); }
  }

  /** Source input-store subscription: a draft that no longer holds a keyword run restores the gate. */
  private settleWorkflowKeyword(): void {
    if (!this.workflowKeywordDismissed) return;
    if (Art(this.editor.text).length !== 0) return;
    this.workflowKeywordDismissed = false;
    this.clearWorkflowKeywordNotice();
  }

  /** Every draft replacement passes the source subscription `ul`, not only reducer transitions. */
  private replaceDraft(next: EditorState): void {
    this.editor = next;
    this.settleWorkflowKeyword();
  }

  setTheme(value?: ThemeSetting): void {
    const view = this.viewportSize();
    const pinned = this.transcript.offset >= Math.max(0, this.transcriptTotal(view.columns) - view.rows);
    this.theme.reset(value);
    this.syncSystemTheme();
    this.selection = createSelection();
    if (pinned) this.transcript = { ...this.transcript, offset: Number.MAX_SAFE_INTEGER };
    this.render();
  }

  bindThemeCatalog(userDir?: string, workspace?: string, plugins?: import('./plugins.js').PluginConfig): void {
    if (!this.isTTY || !this.started || this.closed) return;
    this.customThemes ??= new CustomThemeCatalog(themes => {
      if (this.closed) return;
      const view = this.viewportSize();
      const pinned = this.transcript.offset >= Math.max(0, this.transcriptTotal(view.columns) - view.rows);
      this.theme.setCustomThemes(themes); this.selection = createSelection();
      if (pinned) this.transcript = { ...this.transcript, offset: Number.MAX_SAFE_INTEGER };
      this.render();
    }, message => { if (!this.closed) this.setStatus(message); });
    this.themeUserDir = userDir;
    this.customThemes.bind(userDir, workspace, plugins);
  }

  async getThemeChoices(): Promise<import('./terminal.js').TerminalPromptChoice[]> {
    await this.customThemes?.ready();
    return [...themeChoices, ...(this.customThemes?.choices() ?? []).map(choice => ({
      label: choice.label, value: choice.value, description: choice.origin }))];
  }

  async editCustomTheme(reference: string | undefined, pick: (theme: ThemeSetting) => Promise<void>, signal: AbortSignal): Promise<void> {
    await this.customThemes?.ready();
    if (signal.aborted || this.closed) return;
    const initial = reference?.startsWith('custom:') ? this.customThemes?.values.find(theme => theme.slug === reference.slice(7)) : undefined;
    if (reference && !initial) throw new Error('Custom theme was removed');
    const owner = new ThemeEditor(initial, this.theme.current, this.customThemes?.values ?? [], {
      save: themeFileWriter(this.themeUserDir),
      reload: async () => { await this.customThemes?.reload(); }, pick,
      preview: overrides => { if (!this.closed) { this.theme.setPreviewOverrides(overrides); this.render(); } },
      changed: () => { if (!this.closed) this.render(); },
    });
    try {
      const completion = this.prompt({title:'Theme editor', message:'', allowText:true, themePreview:true}, signal);
      if (this.dialog) { this.dialog.themeEditor = owner; this.dialog.editor = createEditorState();
        this.dialog.editor.text = owner.mode === 'name' ? owner.name : ''; this.dialog.editor.cursor = this.dialog.editor.text.length; this.render(); }
      await completion;
    } finally {
      owner.close(); await owner.flush();
      if (!this.closed) { await this.customThemes?.reload(); this.render(); }
    }
  }

  private syncSystemTheme(): void {
    if (!this.isTTY || !this.started || this.closed || this.editorSuspended) return;
    this.systemTheme ??= new SystemThemeMonitor(this.options.output, value => {
      if (this.closed) return;
      const view = this.viewportSize();
      const pinned = this.transcript.offset >= Math.max(0, this.transcriptTotal(view.columns) - view.rows);
      this.theme.setSystemTheme(value);
      this.selection = createSelection();
      if (pinned) this.transcript = { ...this.transcript, offset: Number.MAX_SAFE_INTEGER };
      this.render();
    }, error => this.onError(error));
    this.systemTheme.setActive(this.theme.automatic);
  }

  private previewDialogTheme(): void {
    if (!this.dialog?.request.themePreview) return;
    const value = parseTheme(this.dialogStep(this.dialog)?.choices?.[this.dialog.index]?.value);
    if (value) { this.theme.previewTheme(value); this.syncSystemTheme(); }
  }

  prompt(request: TerminalPromptRequest, signal: AbortSignal): Promise<TerminalPromptAnswer | undefined> {
    if (this.closed || signal.aborted) return Promise.resolve(undefined);
    if (this.dialog) return Promise.reject(new Error('Another interaction owns terminal input'));
    if (!this.isTTY || !this.started) return Promise.reject(new Error('Dialog needs an active terminal'));
    if (Buffer.byteLength(JSON.stringify(request)) > 256 * 1024 || (request.choices?.length ?? 0) > 100) {
      return Promise.reject(new Error('Dialog exceeds its display budget'));
    }
    this.sourceSearch?.cancel();
    this.sourcePicker?.cancel();
    // The `adjust` axis carries its own formatter, which structuredClone cannot copy, so the
    // plain fields are cloned and the axis is carried by reference.
    const { adjust: axis, ...plain } = request;
    const snapshot: TerminalPromptRequest = structuredClone(plain);
    if (axis !== undefined) snapshot.adjust = axis;
    this.gestures.reset();this.vim.externalMutation();
    this.progress.pause(true);
    if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = undefined; }
    this.decoder.discardPending();
    this.resetKillMode();
    const previousScreen = this.screen as Exclude<TuiScreen, 'dialog'>;
    return new Promise(resolve => {
      let settled = false;
      const finish = (answer?: TerminalPromptAnswer) => {
        if (settled) return;
        settled = true; signal.removeEventListener('abort', cancelled);
        // Source removal is in-memory only; this host also unlinks the private
        // attachments it captured for the dialog.
        dialog.imageCapture?.abort();
        void dialog.images.clear();
        const editorTask = this.editorDialog === dialog ? this.editorTask : undefined;
        if (editorTask) this.editorController?.abort();
        this.stopAfk();
        this.dialog?.themeEditor?.close();
        this.dialog?.undo.clear();
        if (snapshot.themePreview) { this.theme.cancelPreview(); this.syncSystemTheme(); }
        this.dialog = undefined; this.screen = previousScreen;
        this.progress.pause(false);
        if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = undefined; }
        this.decoder.discardPending(); this.keys.reset(); this.render();
        if (editorTask) void editorTask.then(() => resolve(answer), () => resolve(answer));
        else resolve(answer);
      };
      const cancelled = () => finish();
      this.keys.reset(); this.selection = createSelection();
      const first = snapshot.groups?.[0] ?? snapshot;
      const choices = first.choices?.length ?? 0;
      // Yn, fxx7hh8y [64476,66637), UTF-16: seed the input and its end cursor together.
      const initialText = snapshot.initialText ?? '';
      const dialog: ActiveDialog = { request: snapshot, editor: { ...createEditorState(), text: initialText, cursor: initialText.length }, undo: new InputUndo(),
        index: Math.max(0, Math.min(first.defaultIndex ?? 0, Math.max(0, choices - 1))),
        selected: new Set(), scroll: 0, followFocus: false, step: 0, answers: new Map(),
        notes: new Map(), notesEditor: createEditorState(), notesUndo: new InputUndo(),
        notesEditing: false, optionTouched: false, images: new QuestionImages(),
        adjustIndex: Math.max(0, snapshot.adjust?.values.indexOf(snapshot.adjust.initial) ?? 0), finish };
      this.dialog = dialog;
      this.screen = 'dialog'; signal.addEventListener('abort', cancelled, { once: true });
      if (signal.aborted) cancelled();
      else { this.startAfk(dialog, snapshot); this.previewDialogTheme(); this.render(); }
    });
  }

  /** Zero-width hook effects bypass text layout and never change the input draft. */
  writeTerminalSequence(sequence: string): void {
    const validated = formatHookTerminalSequence(sequence);
    if (this.isTTY && validated && this.started) {
      this.options.output.write(validated); this.renderer?.invalidate();
    }
  }

  /** The `copySelection` sink: a clipboard request the terminal receives byte for byte. */
  writeClipboard(payload: string): void {
    if (this.closed) return;
    this.options.output.write(payload);
  }

  start(): this {
    if (this.started || this.closed) return this;
    this.started = true;
    this.options.input.on('error', this.onError);
    try {
      if (this.isTTY) {
        if (!this.originalRaw) { this.changedRaw = true; this.options.input.setRawMode!(true); }
        this.options.input.on('data', this.onData);
        this.options.input.on('end', this.onEnd);
        this.options.input.on('close', this.onEnd);
        this.options.output.on('resize', this.onResize);
        this.modes.enter();
        this.render();
        this.options.input.resume();
        this.syncSystemTheme();
        this.bindThemeCatalog(this.options.userDir, this.options.workspace, this.options.plugins);
      }
    } catch (error) { this.close(); throw error; }
    return this;
  }

  /** Idempotent; restores the screen, the modes it set, and the input's raw state. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.sourceSearch?.close();this.sourceSearch=undefined;this.queryUndo.clear();this.queryEditor=createEditorState();
    this.sourcePicker?.close();this.sourcePicker=undefined;this.pickerUndo.clear();this.pickerQuery=createEditorState();
    this.editorController?.abort();this.gestures.reset();this.vim.close();this.focus.close();this.inputHistory.close();
    this.mcpCatalogAbort?.abort();
    this.editRelay.dispose();
    this.undo.clear();
    this.editor = {...this.editor,pastedContents:{},historyPastes:[],historyDraftPastes:{}};
    this.stashedDraft = undefined; this.searchDraft = {text:'',cursor:0,pastedContents:{}};
    this.diffPanel?.close(); this.diffPanel = undefined;
    this.diffPointer = undefined; this.diffSelection.dismiss(); this.diffAttachmentFocused = false;
    this.progress.close(); this.progressRenderer?.close();
    this.statusLine.close(); this.statusLineRenderer?.close(); this.statusLineRows = [];
    this.unsubscribePermissions?.(); this.unsubscribePermissions = undefined;
    this.welcomeRenderer?.close(); this.welcomeRenderer = undefined; this.welcomeRows = []; this.welcomeKey = '';
    this.assistantMessage = undefined;
    this.previewCoalescer.dispose();
    this.previewStore.setRaw(null);
    this.dialog?.finish();
    if (this.statusNoticeTimer !== undefined) { clearTimeout(this.statusNoticeTimer); this.statusNoticeTimer = undefined; }
    this.statusNoticeOwner = undefined; this.statusNoticeText = undefined;
    if (this.escapeTimer) clearTimeout(this.escapeTimer);
    this.decoder.reset(); this.keys.reset();
    this.options.input.off('data', this.onData);
    this.options.input.off('end', this.onEnd);
    this.options.input.off('close', this.onEnd);
    this.options.input.off('error', this.onError);
    this.options.output.off('resize', this.onResize);
    const restoreTerminal = () => {
      try {if (this.isTTY && this.started) this.modes.leave();}
      finally {
        try {if (this.changedRaw) {this.changedRaw=false;this.options.input.setRawMode!(this.originalRaw);}}
        finally {if (this.started && this.originalPaused) this.options.input.pause();}
      }
    };
    try {
      try { this.customThemes?.close(); }
      finally {
        try { this.systemTheme?.close(); }
        finally { try { this.documentRenderer?.close(); } finally { this.renderer?.close(); } }
      }
    } finally {
      if (this.editorTask) void this.editorTask.then(restoreTerminal, restoreTerminal);
      else restoreTerminal();
    }
  }

  beginAssistantMessage(): void {
    this.endAssistantMessage();
    this.previewCoalescer.clear();
    this.previewStore.setTransformed(null);
    this.previewStore.setRewrite(null);
    this.previewStore.setSalvage(null, false);
    this.assistantMessage = { source: '', key: String(++this.messageSequence), startedAt: Date.now() };
  }

  /** Raw text is retained immediately; source clt publishes the aggregate every 100ms. */
  writeAssistantText(text: string): void {
    if (!this.isTTY || !this.started || this.closed) { this.options.output.write(text); return; }
    if (!text) return;
    if (!this.assistantMessage) this.beginAssistantMessage();
    const message = this.assistantMessage!;
    message.source += text;
    this.progress.text(text);
    this.previewCoalescer.apply(() => message.source);
  }

  private paintAssistantPreview(completed = false): void {
    const message = this.assistantMessage;
    if (!message || !message.source || this.closed) return;
    if (!completed && this.holdsFocusPreview()) return;
    const displayed = completed ? message.source : this.previewStore.getDerived().displayed;
    if (!displayed) return;
    const view = this.viewportSize();
    const total = this.transcriptTotal(view.columns);
    const pinned = this.transcript.offset >= Math.max(0, total - view.rows);
    const entry: TranscriptEntry = { kind: 'assistant', text: renderPreviewMarkdown(displayed),
      markdown: displayed, speaker: true, timestamp: message.startedAt, ...(!completed ? { streaming: true, messageKey: message.key,
        hideTrailingLine: this.previewStore.getDerived().hideTrailingLine } : {}) };
    if (message.index === undefined) {
      message.index = this.transcript.entries.length;
      this.transcript = { ...this.transcript, entries: [...this.transcript.entries, entry] };
    } else {
      const entries = [...this.transcript.entries]; entries[message.index] = entry;
      this.transcript = { ...this.transcript, entries };
    }
    if (pinned) this.transcript = { ...this.transcript, offset: Number.MAX_SAFE_INTEGER };
    this.selection = createSelection();
    this.render();
  }

  endAssistantMessage(): void {
    this.previewCoalescer.dispose();
    try { this.paintAssistantPreview(true); }
    finally {
      this.assistantMessage = undefined;
      this.previewStore.setRaw(null);
    }
  }

  /** Append already-decoded command text; model deltas use writeAssistantText. */
  write(text: string): boolean {
    if (!this.isTTY || !this.started || this.closed) return this.options.output.write(text);
    if (text) this.append({ kind: 'assistant', text: text.replace(/\n$/, '') });
    return true;
  }

  /** A command result the dialog produced, not model prose: one system entry, line breaks kept. */
  writeNotice(text: string): void {
    if (!this.isTTY || !this.started || this.closed) { this.options.output.write(text.endsWith('\n') ? text : `${text}\n`); return; }
    if (text) this.append({ kind: 'system', text });
  }

  dispatch(action: EditorAction, sequence?: string): void {
    if (this.closed || this.editorSuspended || this.editorController) return;
    // Source `Er`/`at.enter()`: Enter on an open suggestion accepts it first. The
    // accepted draft ends with a space, so the follow-up submit passes this gate.
    if ((action.type === 'return' || action.type === 'submit') && !this.keys.pendingChord
      && (action.type !== 'return' || (!action.meta && !action.shift)) && this.autocompleteVisible()) {
      if (this.acceptAutocomplete(true)) return;
    }
    if (action.type === 'focus') { this.focus.set(action.focused); return; }
    if (action.type === 'search' && !this.sourceSearch?.snapshot.searching) { this.enterSearch(); return; }
    // The open picker owns the keyboard: source gLt handles its own keys and hands the rest to its
    // query editor, so no key that reaches dispatch while it is up may edit the draft or submit.
    // Same route shape as the line owner's `handleLinePicker` call.
    if (action.type !== 'running' && this.handleSourcePicker(action)) return;
    if (action.type !== 'running' && this.handleSourceSearch(action)) return;
    if(this.options.sourceInputGestures&&this.options.idleInterrupt===undefined&&!this.gestureHandling&&!this.editor.running
      &&!this.dialog&&(action.type==='interrupt'||action.type==='eof')){this.handleGesture(action.type);return;}
    if(action.type==='running'||action.type==='submit'||action.type==='return')this.gestures.reset();
    if(action.type==='paste')this.vim.externalMutation();
    if(this.vimEnabled&&!this.vimHandling&&!this.dialog&&action.type!=='running'
      &&!(action.type==='interrupt'&&this.editor.running)&&this.handleVim(action))return;
    const transition = reduceEditorWithUndo(this.editor, action, { ...this.options,
      navigationColumns: this.conversationColumns() - 2,
      undoPush: (text, cursor, pastedContents, ownSnapshot) => this.pushUndo(text, cursor, pastedContents, ownSnapshot),
      pasteOwner:this.pasteOwner,terminalRows:this.options.output.rows ?? 24 }, this.undo);
    if (transition.effects.some(effect => effect.type === 'submit')) this.inputHistory.add({display:this.editor.text,pastedContents:this.editor.pastedContents});
    const draftBefore = { text: this.editor.text, cursor: this.editor.cursor };
    // Source input subscription: a keystroke that completes a known `:name:` swaps the
    // whole shortcode for its glyph before anything else reads the draft.
    const inline = this.emojiCompletionEnabled
      ? inlineEmojiCompletion(transition.state.text, draftBefore.text, transition.state.cursor)
      : undefined;
    this.editor = inline === undefined ? transition.state
      : { ...transition.state, text: inline.text, cursor: inline.cursor };
    this.settleWorkflowKeyword();
    this.publishDraft();
    this.relayEdit(action, draftBefore, sequence);
    if(transition.effects.some(effect=>effect.type==='submit')||action.type==='interrupt'&&!this.editor.running)this.vim.reset();
    const submitted = transition.effects.find(effect => effect.type === 'submit');
    if (submitted) this.transcript = reduceTranscript(this.transcript,
      { type: 'append', entry: { kind: 'user', text: submitted.text, timestamp: Date.now() } },
      { rows: this.viewportSize().rows, total: this.transcriptTotal(this.viewportSize().columns) });
    this.render();
    for (const effect of transition.effects) {
      if (effect.type === 'exit') { this.close(); this.emit('exit'); }
      else if (effect.type === 'submit') {
        const promptUuid = randomUUID(), selection = this.diffSelection.take(effect.text, promptUuid);
        this.diffAttachmentFocused = false;
        this.emit('submit', effect.text, selection && this.diffPanel ? { sessionId: this.diffPanel.sessionId, promptUuid, selection } : undefined);
      }
      else if (effect.type === 'interrupt') this.emit('interrupt');
      else if (effect.type === 'pasteGone') this.showPasteGoneNotice(effect.text);
      else this.emit('pasteRejected', effect.bytes);
    }
  }

  /** The composer's publish clause for a draft that moved: runs painted over other text stop being
   *  this draft's, and the paint for the text being left is carried for the edit that follows. */
  private publishDraft(): void {
    this.decorations.publish(this.editor.text);
  }

  /**
   * Source `Du` (`chunk-24k7d6mw.js` 829450): the one undo push every composer edit goes through.
   * Switching editor mode clears the buffer and re-baselines it, and the push that did not change the
   * text is dropped. With Vim on, a NORMAL-mode edit is its own snapshot immediately, while an INSERT
   * run pushes its first edit immediately and lets the rest coalesce through the buffer's debounce
   * until the run ends (`Er.current = Xn` after every push). Without Vim every push coalesces.
   * `ownSnapshot` carries this product's two recorded adaptations that a wholesale draft replacement
   * is its own snapshot: the Return newline conversion (`W44-return-evidence.json`,
   * `adaptation.undo`) and the external-editor refold.
   */
  private pushUndo(text: string, cursor: number, pastedContents: EditorState['pastedContents'], ownSnapshot = false, continuesGesture = false): void {
    const mode = this.vimEnabled ? 'vim' : 'normal';
    if (mode !== this.undoEditorMode) {
      this.undo.clear();
      if (text !== this.editor.text) return;
      this.undoEditorMode = mode;
    }
    const immediate = ownSnapshot
      || (!continuesGesture && this.vimEnabled && (this.vim.mode !== 'INSERT' || !this.undoGesture));
    this.undo.record(text, cursor, { immediate }, pastedContents);
    this.undoGesture = this.vimEnabled;
  }

  /** Relay one key-driven edit to the chain (source `YHo.record`): only in the chat composer, only
   *  while a loaded module hooks `prompt.edit`, and only when the key actually changed the draft.
   *  Everything else the draft does — a submit clearing it, a recalled history entry, a restored
   *  draft — is not a key the chain has an event for, so it is not recorded. */
  private relayEdit(action: EditorAction, before: { text: string; cursor: number }, sequence?: string): void {
    if (!this.editRelay.isRecording() || this.screen !== 'chat') return;
    const key = this.editKey(action, sequence);
    if (!key) return;
    const after = { text: this.editor.text, cursor: this.editor.cursor };
    if (after.text === before.text && after.cursor === before.cursor) return;
    this.editRelay.record({ before, after, key });
  }

  /** The key event an edit is relayed under, in the shape `Xo` reads: a single printable character
   *  is the `key`; anything else is the named key, which for this product is the editor action the
   *  key resolved to (its own name for that key), or `paste`/`tab` for a multi-character insert. */
  private editKey(action: EditorAction, sequence?: string): ChainRelayKey | undefined {
    const raw = sequence ?? (action.type === 'insert' ? action.text : undefined);
    if (raw === undefined) return undefined;
    if ([...raw].length === 1 && /^[^\u0000-\u001f\u007f]+$/u.test(raw)) return { key: raw, name: '' };
    if (action.type === 'insert') return { key: '', name: raw === '\t' ? 'tab' : 'paste' };
    return { key: '', name: action.type };
  }

  private conversationColumns(): number {
    const columns = Math.max(20, this.options.output.columns ?? 80);
    return columns - (this.screen === 'chat' && !this.dialog ? this.diffPanel?.width(columns) ?? 0 : 0);
  }

  private viewportSize(): { columns: number; rows: number } {
    const columns = this.conversationColumns();
    const rows = Math.max(4, this.options.output.rows ?? 24);
    const promptRows = this.inputLayout(columns, rows).lines.length;
    return { columns, rows: Math.max(0, rows - promptRows - 3 - this.progressHeight - this.statusLineRows.length) };
  }

  private inputLayout(columns: number, rows: number) {
    const maximum = Math.max(1, Math.min(this.options.promptRows ?? Math.max(3, Math.floor(rows / 2) - 5), rows - 4));
    const body = layoutInput(this.editor, columns - 2, maximum,this.vimEnabled?{mode:this.vim.mode,anchor:this.vim.anchor}:undefined,this.focus.focused);
    // The composer's own highlights are built first (the `/btw` notice, the keyword rainbows, the
    // ghost text), then a chain answer's runs are overlaid on them, then the input maps the result onto
    // the rendered rows: `composerHighlights` is the source's span assembly and its `w9r` overlay, and
    // `highlightRows` is the input's own caret filter and segmentation.
    const rendered = body.lines.join('\n');
    const highlights = composerHighlights({
      value: this.editor.text, caret: this.editor.cursor, storeValue: this.editor.text,
      isModalOverlayActive: this.dialog !== undefined,
      workflowKeyword: this.workflowKeywordAvailable && this.workflowKeywordTriggerEnabled && !this.workflowKeywordDismissed,
    }, this.decorations.runs(this.editor.text));
    const lines: PromptLine[] = highlights.length === 0 ? body.lines
      : highlightRows(highlights, rendered, body.rowStartOffsets, this.editor.cursor)
          .map(row => (row.length === 0 ? '' : row));
    return { ...body, lines, cursorColumn: body.cursorColumn + 2 };
  }

  private transcriptTotal(columns: number): number {
    return transcriptLines(this.transcript, columns, this.renderEntryRows, this.welcomePreamble(columns)).length;
  }

  private contexts(): TuiContext[] {
    if (this.screen !== 'chat') return contextStack({ screen: this.screen });
    const native = this.diffPanel?.width(this.options.output.columns ?? 80)
      ? this.diffPanel.keys.activeContexts as TuiContext[] : [];
    // Source `nn(La,{context:"Autocomplete",isActive:ya&&!Wr})`: the list owns
    // Tab/Escape/arrows while it is visible, and the chat context keeps the rest.
    const autocomplete: TuiContext[] = this.autocompleteVisible() ? ['Autocomplete'] : [];
    return [...new Set([...autocomplete, ...(this.diffAttachmentFocused ? ['Footer' as const] : []), ...native, 'Chat', 'Scroll', 'Global'] as TuiContext[])];
  }

  /** Slash suggestions for the current draft, or an empty list outside command entry. */
  private autocompleteState(): { suggestions: CommandSuggestion[]; selected: number } {
    if (this.screen !== 'chat' || this.dialog || this.sourceSearch?.snapshot.searching) {
      return { suggestions: [], selected: -1 };
    }
    const text = this.editor.text;
    if (this.autocompleteDismissedText === text) return { suggestions: [], selected: -1 };
    // Source order: the `:name:` popup is tried first and falls through to the command
    // list, so a slash draft is unaffected while emoji completion is on.
    const emoji = this.emojiCompletionEnabled ? emojiRows(text, this.editor.cursor) : undefined;
    // Source order after the commands: an `@` draft asks the file index instead.
    const at = emoji === undefined ? atQuery(text, this.editor.cursor) : undefined;
    const suggestions = emoji ?? (at === undefined
      ? commandSuggestions(text, this.editor.cursor, this.options.commands ?? TUI_COMMANDS)
      : this.atSuggestionRows(at));
    if (text !== this.autocompleteForText) {
      const previous = suggestions[this.autocompleteIndex]?.id;
      const retained = previous === undefined ? -1
        : suggestions.findIndex(suggestion => suggestion.id === previous);
      this.autocompleteForText = text;
      this.autocompleteIndex = retained >= 0 ? retained : 0;
    }
    if (suggestions.length === 0) this.autocompleteIndex = 0;
    const selected = suggestions.length === 0 ? -1
      : Math.min(this.autocompleteIndex, suggestions.length - 1);
    return { suggestions, selected };
  }

  /** Source `SDs`/`jre`/`tse`/`ose`: the rows an `@` draft shows. An explicit `server:`
   *  partial lists that server's templates first; a file row searches the index; an explicit
   *  path lists one directory; `tse` merges the resource, template and agent rows in. */
  private atSuggestionRows(at: AtQuery): CommandSuggestion[] {
    const workspace = this.options.workspace ?? process.cwd();
    this.ensureMcpCatalog();
    const templates = templateArgumentRows(at.partial, this.mcpResourceTemplates);
    if (templates !== null) {
      return templates.map(row => ({
        id: row.id, name: row.displayText, insertName: row.displayText,
        displayText: row.displayText, description: row.description,
        kind: 'file' as const, executeOnAccept: false,
        metadata: { replacement: row.replacement, partial: row.partial },
      }));
    }
    if (at.explicit) {
      return directorySuggestionRows(at.partial, workspace,
        directory => this.directoryListing(directory)).map(row => ({
        id: row.id, name: row.displayText, insertName: row.displayText,
        displayText: row.displayText, description: row.description ?? '',
        kind: 'directory' as const, executeOnAccept: false,
      }));
    }
    this.ensureFileIndex(workspace);
    const files = fileSuggestionRows(query => this.fileIndex.search(query, FILE_SUGGESTION_LIMIT),
      at.partial, workspace, () => listWorkingDirectory(workspace));
    const agents = agentSuggestionRows(this.options.agentTypes ?? [], at.partial, true);
    // Source `tse` labels the whole combined list as one suggestion type, so every row
    // here accepts through the same splice.
    return combinedAtRows({ query: at.partial, showOnEmpty: true, files, agents,
      mcpResources: this.mcpResources,
      mcpResourceTemplates: this.mcpResourceTemplates }).map(row => ({
      id: row.id, name: row.displayText, insertName: row.displayText,
      displayText: row.displayText, description: row.description,
      kind: 'file' as const, executeOnAccept: false,
      ...(row.metadata === undefined ? {} : { metadata: row.metadata }),
    }));
  }

  /** `ose`'s companion: the source reads a live MCP store; the local render path is
   *  synchronous, so the listing is read once in the background and the band repaints when
   *  it lands. A failed listing leaves the MCP families empty rather than failing the list. */
  private ensureMcpCatalog(): void {
    const load = this.options.mcpCatalog;
    if (this.mcpCatalogStarted || load === undefined) return;
    this.mcpCatalogStarted = true;
    const controller = new AbortController();
    this.mcpCatalogAbort = controller;
    void load(controller.signal).then(listing => {
      if (this.closed) return;
      this.mcpResources = listing.resources;
      this.mcpResourceTemplates = listing.templates;
      if (this.started) this.render();
    }).catch(() => {});
  }

  /** `kDt`: one directory's entries, held for the source's fifteen-second TTL. The source
   *  caches per session asynchronously; the local render path is synchronous, so the
   *  listing is read here and only the TTL is kept. */
  private directoryListing(directory: string): readonly { name: string; isDirectory: boolean }[] {
    const now = Date.now();
    const cached = this.directoryListings.get(directory);
    if (cached !== undefined && now - cached.at < DIRECTORY_LISTING_TTL) return cached.entries;
    let entries: { name: string; isDirectory: boolean }[] = [];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
        .map(entry => ({ name: entry.name, isDirectory: entry.isDirectory() }));
    } catch { entries = []; }
    this.directoryListings.set(directory, { at: now, entries });
    return entries;
  }

  /** `q`/`ubn`: the index is built once, in the background, the first time an `@` needs it. */
  private ensureFileIndex(workspace: string): void {    if (this.fileIndexStarted) return;
    this.fileIndexStarted = true;
    void this.loadFileIndex(workspace);
  }

  private async loadFileIndex(workspace: string): Promise<void> {
    const tracked = await gitPathList(['-c', 'core.quotepath=false', 'ls-files'], workspace);
    const untracked = await gitPathList(
      ['-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard'], workspace);
    const paths = tracked ?? walkWorkspace(workspace, FILE_INDEX_ENTRY_LIMIT);
    this.fileIndex.loadFromFileList([...paths, ...untracked ?? []]);
    // The band can only appear once the index answers, so repaint when it lands.
    if (this.started && !this.closed) this.render();
  }

  private autocompleteVisible(): boolean {
    return this.autocompleteState().suggestions.length > 0;
  }

  private moveAutocomplete(step: number): void {
    const { suggestions, selected } = this.autocompleteState();
    if (suggestions.length === 0) return;
    this.autocompleteIndex = (selected + step + suggestions.length) % suggestions.length;
    this.render();
  }

  private dismissAutocomplete(): void {
    this.autocompleteDismissedText = this.editor.text;
    this.autocompleteForText = this.editor.text;
    this.autocompleteIndex = 0;
    this.render();
  }

  /**
   * The suggestion index under a 1-based screen row, or -1 outside the band.
   * Source `Oi`: a click resolves the row's id to an index and accepts it, which
   * is the fill-the-draft path rather than the submit path Enter takes.
   */
  private autocompleteRowAt(row: number): number {
    const band = this.autocompleteBand;
    if (!band || !this.autocompleteVisible()) return -1;
    return band.owners[row - 1 - band.top] ?? -1;
  }

  /** Source `LK`/`Xn`: replace the draft with `/<name> `; Enter also submits when the
   *  selected row is a local command or an argument-less prompt command. */
  private acceptAutocomplete(execute: boolean): boolean {
    const { suggestions, selected } = this.autocompleteState();
    const suggestion = suggestions[selected];
    if (!suggestion) return false;
    // Source `tE`: an emoji row replaces `:partial` with its glyph and a space, and never
    // submits, on either the accept key or Enter.
    if (suggestion.kind === 'file' || suggestion.kind === 'directory') {
      const at = atQuery(this.editor.text, this.editor.cursor);
      if (at === undefined) return false;
      const hasAtPrefix = at.token.startsWith('@');
      const typed = at.isQuoted ? at.token.slice(2).replace(/"$/, '').length
        : hasAtPrefix ? at.token.length - 1 : at.token.length;
      // Source: a template `replacement` metadata suppresses the shared-prefix fill and is
      // written verbatim; `partial` keeps the draft open.
      const hasReplacement = suggestions.some(row => row.metadata !== undefined);
      const common = hasReplacement ? '' : commonPrefix(suggestions.map(row => row.displayText));
      const replacement = suggestion.metadata !== undefined
        ? `${suggestion.metadata.replacement}${suggestion.metadata.partial ? '' : ' '}`
        : common.length > typed
          ? shapeAtDisplayText(common, { hasAtPrefix, isQuoted: at.isQuoted, isComplete: false })
          : shapeAtDisplayText(suggestion.displayText, { hasAtPrefix, isQuoted: at.isQuoted,
            needsQuotes: suggestion.displayText.includes(' '), isComplete: true });
      const applied = applyFileSuggestion(this.editor.text, at, replacement);
      const before = { text: this.editor.text, cursor: this.editor.cursor };
      this.editor = { ...this.editor, text: applied.text, cursor: applied.cursor };
      this.publishDraft();
      this.autocompleteForText = applied.text;
      this.autocompleteDismissedText = undefined;
      this.autocompleteIndex = 0;
      this.relayEdit({ type: 'insert', text: replacement }, before, '@');
      this.render();
      return true;
    }
    if (suggestion.kind === 'emoji') {
      const replaced = acceptEmojiQuery(this.editor.text, this.editor.cursor, suggestion.displayText);
      if (replaced === undefined) return false;
      const before = { text: this.editor.text, cursor: this.editor.cursor };
      this.editor = { ...this.editor, text: replaced.text, cursor: replaced.cursor };
      this.publishDraft();
      this.autocompleteForText = replaced.text;
      this.autocompleteDismissedText = undefined;
      this.autocompleteIndex = 0;
      this.relayEdit({ type: 'insert', text: suggestion.displayText }, before, ':');
      this.render();
      return true;
    }
    const text = acceptanceText(suggestion);
    const before = { text: this.editor.text, cursor: this.editor.cursor };
    this.editor = { ...this.editor, text, cursor: text.length };
    this.settleWorkflowKeyword();
    this.publishDraft();
    this.autocompleteForText = text;
    this.autocompleteDismissedText = undefined;
    this.autocompleteIndex = 0;
    this.relayEdit({ type: 'insert', text }, before, '/');
    if (execute && suggestion.executeOnAccept) {
      this.dispatch({ type: 'return', sequence: '\r', meta: false, shift: false });
      return true;
    }
    this.render();
    return true;
  }

  /** Rows `iEe` draws above the composer, including its no-match message. */
  private renderAutocompleteRows(columns: number, rows: number): string[] {
    const { suggestions, selected } = this.autocompleteState();
    if (suggestions.length === 0) {
      const message = suggestionsEmptyMessage(this.editor.text, this.editor.cursor, suggestions);
      this.autocompleteBand = undefined;
      return message === undefined ? [] : [`\u001b[2m${pad(`  ${message}`, columns)}\u001b[22m`];
    }
    const pointer = `${symbols.pointer} `;
    const pointerWidth = cellWidth(pointer);
    const widest = suggestionMaxColumnWidth(suggestions);
    // Source `iEe`: the budget is rows, and a row is one or two lines, so the window is
    // chosen from the heights rather than from a count of suggestions.
    const heights = suggestions.map(row => suggestionRowHeight(row, widest, columns, pointerWidth));
    const window = suggestionRowWindow(heights, maxVisibleSuggestions(rows), selected, this.autocompleteWindowStart);
    this.autocompleteWindowStart = window.start;
    const chosen = selected - window.start;
    const visible = suggestions.slice(window.start, window.end);
    const lines = suggestionRowSegments(visible, chosen, columns, pointer, widest);
    this.autocompleteOwners = suggestionRowOwners(heights.slice(window.start, window.end))
      .map(owner => owner + window.start);
    // Source `ze` colours the selected row with the `suggestion` slot, dims every other row,
    // and lets the skill and agent lanes keep their own colour either way. Each segment
    // opens its own state and resets, so the lane accents survive the row's dim.
    return lines.map((segments, line) => {
      const onSelected = this.autocompleteOwners[line] === selected;
      return segments.map(segment => {
        const opens: string[] = [];
        if (!onSelected) opens.push('\u001b[2m');
        const accent = segment.accent === undefined ? '' : slotForeground(this.themeSlot(segment.accent));
        if (accent !== '') opens.push(accent);
        else if (segment.dim) opens.push('\u001b[2m');
        else if (onSelected) opens.push(slotForeground(this.themeSlot('suggestion')));
        return opens.join('') + segment.text + '\u001b[0m';
      }).join('');
    });
  }

  /** The active palette value for a slot, with the session's overrides applied. */
  private themeSlot(name: string): string | undefined {
    return this.theme.overrides?.[name] ?? (S1(this.theme.current) as Record<string, string | undefined>)[name];
  }

  /**
   * `xzt`: the banner is `{text: he || agent || "", bgColor}` and is `null` when neither a
   * standalone-agent name, an agent chip nor a colour override gives it a reason. This host
   * has no title or agent chip on the composer yet, so only `/color` can create one.
   */
  private sessionBanner(): { text: string; color: string } | undefined {
    if (this.sessionColor === undefined) return undefined;
    return { text: '', color: sessionColorSlot(effectiveSessionColor({ userOverride: this.sessionColor }),
      PROMPT_BORDER_SLOT) };
  }

  private readonly onData = (chunk: string | Buffer) => {
    if (this.closed) return;
    if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = undefined; }
    let handedOff = false;
    for (const action of this.decoder.push(chunk)) {
      if (this.closed || this.editorController) return;
      if (action.type === 'terminalResponse') { this.systemTheme?.onResponse(action.response); continue; }
      if (action.type === 'focus') { this.focus.set(action.focused); continue; }
      if (handedOff) continue;
      if (!this.focus.focused && (action.type !== 'mouse' || action.action === 'press')) this.focus.set(true);
      if (this.dialog) {
        const owner = this.dialog;
        this.handleDialogAction(action.type==='return'?{type:action.meta||action.shift?'newline':'submit'}:action);
        if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; }
        continue;
      }
      if (this.handleSourceSearch(action)) continue;
      if(action.type==='return'&&(this.keys.pendingChord||this.screen!=='chat')){
        this.routeKey(action.sequence,action.meta||action.shift?'newline':'submit');continue;
      }
      if (action.type === 'mouse') { this.handleMouse(action); continue; }
      if (action.type === 'key') { this.routeKey(action.sequence, action.command); continue; }
      if (action.type === 'insert' && (this.screen === 'transcript' || this.keys.pendingChord || this.diffAttachmentFocused)) {
        for (const character of action.text) {
          if (this.closed || this.editorController) return;
          this.routeKey(character);
        }
        continue;
      }
      // Explicit local keybinding commands and paste keep their decoded intent.
      if (action.type.startsWith('extend') || action.type === 'selectionCopy') {
        this.routeKey(chordSequence(action)!);
      } else this.dispatch(action, action.type === 'insert' ? action.text : undefined);
    }
    if (!this.closed && this.decoder.pendingStandaloneEscape) {
      this.escapeTimer = setTimeout(() => {
        this.escapeTimer = undefined;
        this.decoder.flushEscape();
        if (!this.focus.focused) this.focus.set(true);
        if (this.dialog) this.handleDialogAction({ type: 'key', sequence: '\x1b' });
        else if (!this.handleSourceSearch({type:'key',sequence:'\x1b'})) this.routeKey('\x1b');
      }, 50);
      this.escapeTimer.unref?.();
    }
  };

  /**
   * The step the dialog is answering: the current group, or the whole request
   * when it is not grouped. `undefined` while the review page is showing.
   */
  private dialogStep(dialog: ActiveDialog): TerminalPromptRequest | TerminalPromptGroup | undefined {
    const groups = dialog.request.groups ?? [];
    if (!groups.length) return dialog.request;
    return dialog.step >= groups.length ? undefined : groups[dialog.step];
  }

  private handleThemeEditorAction(dialog: ActiveDialog, action: EditorAction): void {
    const owner = dialog.themeEditor!;
    const command = action.type === 'key' ? action.command : action.type;
    const sequence = action.type === 'key' ? action.sequence : '';
    const resetInput = (value = '') => {
      dialog.undo.clear(); dialog.editor = createEditorState();
      dialog.editor.text = value; dialog.editor.cursor = value.length; dialog.scroll = 0;
    };
    if (command === 'interrupt' || command === 'eof') { dialog.finish(); return; }
    if (sequence === '\x1b') {
      if (owner.token !== null) { owner.cancelValue(); resetInput(); this.render(); }
      else dialog.finish();
      return;
    }
    if (dialog.busy) return;
    const tokens = owner.filtered(dialog.editor.text);
    if (owner.mode === 'colors' && owner.token === null) {
      if (command === 'up' || command === 'down') {
        dialog.index = tokens.length ? (dialog.index + (command === 'up' ? -1 : 1) + tokens.length) % tokens.length : 0;
        this.render(); return;
      }
      if (sequence === '\t') {
        if (tokens[dialog.index]) owner.reset(tokens[dialog.index]!);
        this.render(); return;
      }
    }
    if (command === 'submit') {
      if (owner.mode === 'name') {
        if (!dialog.editor.text.trim()) { dialog.error = 'Enter a theme name'; this.render(); return; }
        owner.create(dialog.editor.text); resetInput(); dialog.busy = true;
        void owner.flush().then(() => { if (this.dialog === dialog) { dialog.busy = false; this.render(); } });
      } else if (owner.token !== null) {
        if (!owner.accept()) { dialog.error = 'Accepts rgb(r,g,b), #rrggbb, ansi256(n), or ansi:name'; this.render(); return; }
        resetInput(); this.render();
      } else if (tokens[dialog.index]) { owner.edit(tokens[dialog.index]!); resetInput(owner.value); this.render(); }
      return;
    }
    const editorAction = action.type === 'key' ? action.command ? {type:action.command} as EditorAction : undefined : action;
    if (!editorAction) return;
    const policy = {...this.options, maxPasteBytes:32768, navigationColumns:Math.max(20, this.options.output.columns ?? 80) - 2};
    const next = editorAction.type === 'undo' ? reduceEditorWithUndo(dialog.editor, editorAction, policy, dialog.undo)
      : reduceEditor(dialog.editor, editorAction, policy);
    if (next.state.text.length > 256 || Buffer.byteLength(next.state.text) > 1024 || next.effects.some(effect => effect.type === 'pasteRejected')) {
      dialog.error = 'Theme input exceeds its display budget'; this.render(); return;
    }
    if (editorAction.type !== 'undo' && next.state.text !== dialog.editor.text) dialog.undo.record(dialog.editor.text, dialog.editor.cursor);
    const changed = next.state.text !== dialog.editor.text;
    dialog.editor = next.state; dialog.error = undefined;
    if (owner.token !== null) owner.change(dialog.editor.text);
    else if (changed) dialog.index = 0;
    this.render();
  }

  private handleDialogAction(action: EditorAction): void {
    const dialog = this.dialog;
    if (!dialog || action.type === 'mouse') return;
    // Source presence records the interaction behind `Ip()`, so any key defers AFK.
    this.noteAfkInteraction();
    if (dialog.themeEditor) { this.handleThemeEditorAction(dialog, action); return; }
    if (dialog.request.themeEdit && action.type === 'key' && action.sequence === '\x05') {
      const selected = dialog.request.choices?.[dialog.index]?.value;
      if (selected?.startsWith('custom:')) dialog.finish({selected:[selected], themeEdit:true});
      return;
    }
    const command = action.type === 'key' ? action.command : action.type;
    const sequence = action.type === 'key' ? action.sequence : '';
    if (action.type !== 'key' && this.keys.pendingChord) this.keys.reset();
    if (action.type === 'externalEditor') {
      void this.editQuestion(dialog, dialog.notesEditing ? 'notes' : 'other');return;
    }
    if (action.type === 'key') {
      const binding = this.keys.push(sequence, ['Chat']);
      if (binding.kind === 'pending') return;
      if (binding.kind === 'match' && binding.match.action === 'chat:externalEditor') {
        // gEe [25027,31575), UTF-16, enables this action only on its focused input row.
        if (dialog.notesEditing) void this.editQuestion(dialog, 'notes');
        else void this.editQuestion(dialog, 'other');
        return;
      }
      if (binding.kind === 'match' && binding.match.action === 'chat:imagePaste') {
        // gEe registers the paste action only on the focused Other input; plain
        // option rows, notes and the review page never attach an image.
        const pasteStep = this.notesStep(dialog);
        const pasteChoices = pasteStep?.choices ?? [];
        const pasteTextEntry = pasteChoices.length === 0 || dialog.index === pasteChoices.length;
        if (pasteTextEntry) void this.attachQuestionImage(dialog, pasteStep);
        return;
      }
    }
    // Recovered `a3`: the notes input owns keys while it is open; Esc exits it,
    // and Enter saves the text and takes the focused/stored answer when present.
    if (dialog.notesEditing) { this.handleNotesAction(dialog, action, command, sequence); return; }
    if (command === 'interrupt' || command === 'eof' || sequence === '\x1b') { dialog.finish(); return; }
    // A read-only panel has no answer input: Enter picks the focused row when there is one,
    // and does nothing when the panel is only a record to read.
    if (dialog.request.readOnly === true && command === 'submit'
      && !(this.dialogStep(dialog)?.choices ?? []).length) return;
    // The review page owns its keys before any per-question handling, because
    // it has no choices of its own and would otherwise fall into text entry.
    if (this.handleReviewAction(dialog, action, command ?? '')) return;
    const step = this.dialogStep(dialog);
    const choices = step?.choices ?? [];
    const clarification = this.clarificationIndex(dialog);
    if (clarification !== undefined && dialog.index === clarification) {
      if (command === 'up' || sequence === '\x1b[Z') {
        dialog.index -= 1; dialog.followFocus = true; this.render();
      } else if (command === 'submit') this.clarifyDialog(dialog);
      return;
    }
    const textEntry = choices.length === 0 || dialog.index === choices.length;
    // The `adjust` axis moves with the arrows and never moves the selection, so it runs
    // before the list navigation and only while a row holds the focus (`KHe` clamps).
    const adjust = dialog.request.adjust;
    if (adjust !== undefined && !textEntry && (command === 'left' || command === 'right')) {
      const delta = command === 'left' ? -1 : 1;
      dialog.adjustIndex = Math.max(0, Math.min(adjust.values.length - 1, dialog.adjustIndex + delta));
      this.render(); return;
    }
    // The request's own keys take the focused row, the way the recovered picker's `s`
    // accepts a session-only pick while `enter` also makes it the default.
    const keyed = textEntry ? undefined : dialog.request.keys?.find(entry => action.type === 'insert' && action.text === entry.key);
    if (keyed !== undefined && !dialog.notesEditing && choices.length) {
      this.advanceDialog(dialog, { selected: [choices[dialog.index]!.value], key: keyed.key });
      return;
    }
    // Source `a3` binds plain `n` on the choice list to the notes input.
    if (!textEntry && action.type === 'insert' && action.text === 'n' && this.notesAvailable(dialog, step)) {
      this.enterNotes(dialog); return;
    }
    if (sequence === '\x1b[5~' || sequence === '\x1b[6~') {
      dialog.scroll = Math.max(0, dialog.scroll + (sequence === '\x1b[5~' ? -1 : 1) * Math.max(1, (this.options.output.rows ?? 24) - 4));
      dialog.followFocus = false; this.render(); return;
    }
    if (choices.length && (command === 'up' || command === 'down' || sequence === '\t' || sequence === '\x1b[Z')) {
      const count = choices.length + (step?.allowText ? 1 : 0) + (clarification === undefined ? 0 : 1);
      const delta = command === 'up' || sequence === '\x1b[Z' ? -1 : 1;
      const before = dialog.index;
      dialog.index = clarification === undefined ? (dialog.index + delta + count) % count
        : Math.max(0, Math.min(count - 1, dialog.index + delta));
      if (dialog.index !== before && dialog.index < choices.length) dialog.optionTouched = true;
      dialog.followFocus = true; this.previewDialogTheme(); this.render(); return;
    }
    if (choices.length && !textEntry && (command === 'home' || command === 'end'
      || command === 'logicalHome' || command === 'logicalEnd')) {
      const before = dialog.index;
      dialog.index = command === 'home' || command === 'logicalHome' ? 0 : choices.length - 1;
      if (dialog.index !== before) dialog.optionTouched = true;
      dialog.followFocus = true; this.previewDialogTheme(); this.render(); return;
    }
    if (command === 'submit') {
      if (textEntry) {
        const text = dialog.editor.text.trim();
        if (text) this.advanceDialog(dialog, { selected: step?.multiple
          ? [...dialog.selected].sort((a, b) => a - b).map(index => choices[index]!.value) : [], text });
        else { dialog.error = 'Enter an answer'; this.render(); }
      } else {
        const indices = step?.multiple ? [...dialog.selected].sort((a, b) => a - b) : [dialog.index];
        const other = step?.multiple && step.allowText ? dialog.editor.text.trim() : '';
        if (indices.length || other) this.advanceDialog(dialog, { selected: indices.map(index => choices[index]!.value),
          ...(other ? { text: other } : {}) });
        else { dialog.error = 'Space selects an option'; this.render(); }
      }
      return;
    }
    if (this.handleReviewAction(dialog, action, command ?? '')) return;
    if (!textEntry && action.type === 'insert' && action.text === ' ' && step?.multiple) {
      if (dialog.selected.has(dialog.index)) dialog.selected.delete(dialog.index); else dialog.selected.add(dialog.index);
      this.storeMultiDialogAnswer(dialog);
      dialog.error = undefined; this.render(); return;
    }
    if (step?.allowText && choices.length && (action.type === 'insert' || action.type === 'paste')) {
      dialog.index = choices.length; dialog.followFocus = true;
    }
    if (choices.length === 0 || dialog.index === choices.length) {
      // gEe: Backspace on an empty Other input removes the question's last image
      // before it touches the editor, and the removal is live-gated.
      const imageKey = dialog.request.groups?.[dialog.step]?.key;
      if (command === 'backspace' && dialog.editor.text === '' && imageKey !== undefined) {
        const last = dialog.images.last(imageKey);
        if (last !== undefined && dialog.images.remove(imageKey, last.id)) {
          if (last.path !== undefined) fs.rmSync(last.path, { force: true });
          dialog.error = undefined; this.render(); return;
        }
      }
      const limit = step?.maxTextChars ?? dialog.request.maxTextChars ?? 32 * 1024;
      const editorAction = action.type === 'key' ? action.command ? { type: action.command } as EditorAction
        : sequence === '\t' ? { type: 'insert', text: '    ' } as EditorAction : undefined : action;
      if (editorAction) {
        const policy = { ...this.options, maxPasteBytes: 32 * 1024,
          navigationColumns: Math.max(20, this.options.output.columns ?? 80) - 2 };
        const next = editorAction.type === 'undo' ? reduceEditorWithUndo(dialog.editor, editorAction, policy, dialog.undo)
          : reduceEditor(dialog.editor, editorAction, policy);
        if (next.state.text.length > limit) {
          dialog.error = `Answer exceeds ${limit} characters`;
        } else if (Buffer.byteLength(next.state.text) <= 32 * 1024 && !next.effects.some(effect => effect.type === 'pasteRejected')) {
          if (editorAction.type !== 'undo' && next.state.text !== dialog.editor.text)
            dialog.undo.record(dialog.editor.text, dialog.editor.cursor);
          dialog.editor = next.state; dialog.error = undefined;
          this.storeMultiDialogAnswer(dialog);
        } else dialog.error = 'Answer exceeds 32768 bytes';
      }
      this.render();
    }
  }

  private routeKey(sequence: string, command?: EditorCommand): void {
    if (this.closed) return;
    if ((!command || !['yank', 'yankPop', 'killLineStart', 'killLineEnd', 'killWordForward', 'killWordBackward', 'killWORDBackward'].includes(command))
      && !this.keys.pendingChord) this.resetKillMode();
    if(sequence==='\x1b'&&this.keys.pendingChord){this.handleKey(sequence,command);return;}
    // Source `ds` (autocomplete:dismiss): Escape closes the list before any gesture handling.
    if (sequence === '\x1b' && this.autocompleteVisible()) { this.dismissAutocomplete(); return; }
    if(sequence==='\x1b'&&this.options.sourceInputGestures&&this.screen==='chat'&&!this.vimEnabled&&!this.running){
      this.handleGesture('escape');return;
    }
    if (sequence!=='\x1b' && this.handleKey(sequence, command)) return;
    if(this.vimEnabled&&this.screen==='chat'&&!this.dialog&&!this.vimHandling
      && this.handleVim({type:'key',sequence,command}))return;
    if (sequence==='\x1b' && this.handleKey(sequence, command)) return;
    if (command) this.dispatch({ type: command }, sequence);
    else if (sequence === '\t') this.dispatch({ type: 'insert', text: '    ' }, sequence);
    else if (/^[^\u0000-\u001f\u007f]+$/u.test(sequence)) this.dispatch({ type: 'insert', text: sequence }, sequence);
  }

  private handleKey(sequence: string, command?: EditorCommand): boolean {
    if (command === 'newline') { this.dispatch({ type: command }, sequence); return true; }
    if (sequence === '\x1b[B' && this.diffSelection.pending && !this.editor.text) {
      this.diffAttachmentFocused = true; this.render(); return true;
    }
    // Source `Js` hardcodes ctrl+n/ctrl+p beside the registry's arrow bindings.
    if ((sequence === '\u000e' || sequence === '\u0010') && !this.keys.pendingChord
      && this.autocompleteVisible()) {
      this.moveAutocomplete(sequence === '\u000e' ? 1 : -1); return true;
    }
    const outcome = this.keys.push(sequence, this.contexts());
    if (outcome.kind === 'pending') return true;
    if (outcome.kind === 'none') {
      if (outcome.replay) {
        const replay = new TerminalKeyDecoder().push(outcome.replay);
        for (const action of replay) this.dispatch(action, action.type === 'insert' ? action.text : undefined);
        return this.handleKey(sequence, command);
      }
      return false;
    }
    if (outcome.match.action === 'history:previous' || outcome.match.action === 'history:next') return false;
    // Source Yt resolves against all mounted contexts before invoking the registered handler.
    if (this.screen === 'chat' && this.diffPanel?.width(this.options.output.columns ?? 80)
      && this.diffPanel.keys.dispatchAction(outcome.match.action)) { this.render(); return true; }
    return this.applyAction(outcome.match.action);
  }

  private handleMouse(event: TerminalMouseEvent): void {
    if (this.options.mouseTracking === 'off' || this.screen === 'search') return;
    const view = this.viewportSize();
    if (this.diffPanel?.width(this.options.output.columns ?? 80) && (event.col > view.columns || this.diffPointer)) {
      const column = event.col - 1, row = event.row - 1;
      if (event.action === 'wheelup' || event.action === 'wheeldown') {
        this.renderer?.wheel(column, row, event.action === 'wheelup' ? -1 : 1,
          { ctrl: event.ctrl, shift: event.shift, meta: event.meta });
      } else if ((this.options.mouseTracking ?? 'full') === 'full') {
        if (event.action === 'press' && (event.button & 3) === 0) {
          this.selection = createSelection();
          this.diffPointer = { column, row, moved: false };
          this.renderer?.selectNative('start', column, row, this.clickCount({ column, line: row }));
        } else if (this.diffPointer && (event.action === 'move' || event.action === 'release')) {
          const pointer = this.diffPointer;
          pointer.moved ||= column !== pointer.column || row !== pointer.row;
          this.renderer?.selectNative(event.action === 'release' ? 'end' : 'drag', column, row);
          if (event.action === 'release') {
            this.diffPointer = undefined;
            if (!pointer.moved && !this.renderer?.selectionInstance.hasTextSelection()) {
              this.renderer?.click(column, row, { ctrl: event.ctrl, shift: event.shift, alt: event.meta });
            }
          }
        }
      }
      this.render(); return;
    }
    if (event.action === 'press') this.renderer?.clearNativeSelection();
    const inside = event.col >= 1 && event.col <= view.columns
      && event.row >= 1 && event.row <= view.rows;
    if (event.action === 'wheelup' || event.action === 'wheeldown') {
      if (!inside) return;
      const outcome = this.wheelKeys.push(event.action, ['Scroll', 'Global']);
      if (outcome.kind === 'match') this.applyAction(outcome.match.action);
      return;
    }
    // The suggestion band is drawn above the composer, past the transcript rows, and
    // `viewportSize` does not subtract it, so it is hit-tested from its own geometry
    // before the transcript/selection split.
    if (event.action === 'press' && (event.button & 3) === 0) {
      const index = this.autocompleteRowAt(event.row);
      if (index >= 0) {
        this.autocompleteIndex = index;
        this.acceptAutocomplete(false);
        return;
      }
    }
    if ((this.options.mouseTracking ?? 'full') !== 'full') return;
    // Release outside the transcript still ends the drag.
    if (event.action === 'release') {
      const anchor = inside && (event.button & 3) === 0 ? this.anchorAt(event.col, event.row) : null;
      if (anchor) this.selection = reduceSelection(this.selection, { type: 'drag', at: anchor });
      this.selection = reduceSelection(this.selection, { type: 'end' });
      this.render(); return;
    }
    if (!inside || (event.button & 3) !== 0) return;
    const anchor = this.anchorAt(event.col, event.row);
    if (!anchor) return;
    if (event.action === 'press') {
      const clicks = this.clickCount(anchor);
      // A second press selects the word under the pointer, a third the whole row.
      const text = this.renderedRow(anchor.line);
      const span = text === undefined ? null
        : clicks === 2 ? wordSpan(text, anchor.column) : clicks >= 3 ? lineSpan(text) : null;
      if (span && clicks >= 2) {
        this.selection = reduceSelection(this.selection, { type: clicks >= 3 ? 'line' : 'word',
          at: anchor, low: { line: anchor.line, column: span.low }, high: { line: anchor.line, column: span.high } });
      } else this.selection = reduceSelection(this.selection, { type: 'start', at: anchor });
    } else if (event.action === 'move') {
      // While a multi-click span is active the moving end snaps to the word or
      // row under the pointer, which is what the recovered drag does.
      this.selection = this.selection.span
        ? dragSpan(this.selection, anchor, this.renderedRow(anchor.line))
        : reduceSelection(this.selection, { type: 'drag', at: anchor });
    }
    this.render();
  }

  /**
   * Multi-click counter copied from the recovered pointer handler: presses
   * within 500 ms and one cell of each other count as one click sequence, and
   * anything else resets it to a single click. The recovered handler also
   * clears the count whenever the press is consumed by something else first,
   * which here means any screen or overlay change.
   */
  private clickCount(anchor: SelectionAnchor): number {
    const now = Date.now();
    const last = this.lastClick;
    const repeat = last !== undefined && last.screen === this.screen && now - last.time < 500
      && Math.abs(anchor.column - last.column) <= 1 && Math.abs(anchor.line - last.line) <= 1;
    this.clickCountValue = repeat ? this.clickCountValue + 1 : 1;
    this.lastClick = { time: now, line: anchor.line, column: anchor.column, screen: this.screen };
    return this.clickCountValue;
  }

  /** Rendered text of one absolute transcript row, when it is on screen. */
  private renderedRow(line: number): string | undefined {
    const view = this.viewportSize();
    const viewport = layoutTranscript(this.transcript, view.columns, view.rows, this.renderEntryRows,
      this.welcomePreamble(view.columns));
    return viewport.lines[line - viewport.offset];
  }

  /** Map a terminal coordinate to the transcript line and cell it lands on. */
  private anchorAt(col: number, row: number): SelectionAnchor | null {
    const view = this.viewportSize();
    const viewport = layoutTranscript(this.transcript, view.columns, view.rows, this.renderEntryRows,
      this.welcomePreamble(view.columns));
    const text = viewport.lines[row - 1];
    if (text === undefined) return null;
    return { line: row - 1 + viewport.offset, column: selectionColumn(text, col - 1) };
  }

  private resetKillMode(): void {
    this.editor = { ...this.editor, killRing: reduceKillRing(this.editor.killRing, { type: 'interrupt' }) };
  }

  /** Actions with a local counterpart are handled; the rest are reported as unbound. */
  private applyAction(action: string): boolean {
    this.emit('action', action);
    // Source hands the open picker the whole keyboard: its Global shortcuts must not run while it
    // is up. Map the three that matter onto the picker's own actions and swallow the rest.
    if (this.sourcePicker?.snapshot.searching) {
      if (action === 'app:interrupt') return this.handleSourcePicker('historySearch:cancel');
      if (action === 'history:search') return this.handleSourcePicker('historySearch:next');
      if (action.startsWith('historySearch:')) return this.handleSourcePicker(action);
      return true;
    }
    if (action !== 'chat:defaultToNewerModel') this.resetKillMode();
    switch (action) {
      case 'footer:close':
        if (!this.diffAttachmentFocused) return false;
        this.diffAttachmentFocused = false; this.diffSelection.dismiss(); this.render(); return true;
      case 'footer:up': case 'footer:clearSelection':
        this.diffAttachmentFocused = false; this.render(); return true;
      case 'selection:copy': this.copySelection(); return true;
      case 'selection:extendLeft': this.extendSelection(-1, 0); return true;
      case 'selection:extendRight': this.extendSelection(1, 0); return true;
      case 'selection:extendUp': this.extendSelection(0, -1); return true;
      case 'selection:extendDown': this.extendSelection(0, 1); return true;
      case 'selection:extendLineStart': this.extendSelection(-Infinity, 0); return true;
      case 'selection:extendLineEnd': this.extendSelection(Infinity, 0); return true;
      case 'app:interrupt': this.dispatch({ type: 'interrupt' }); return true;
      case 'app:exit':
        if(this.options.sourceInputGestures)this.dispatch({type:'eof'});else{this.close();this.emit('exit');}return true;
      case 'app:toggleTranscript':
        this.screen = this.screen === 'transcript' ? 'chat' : 'transcript';
        this.render(); return true;
      case 'transcript:exit': this.screen = 'chat'; this.render(); return true;
      case 'transcript:toggleShowAll':
        this.selection = createSelection();
        this.transcript = reduceTranscript(this.transcript, { type: 'toggleShowAll' },
          { rows: this.viewportSize().rows, total: this.transcriptTotal(this.viewportSize().columns) });
        this.render(); return true;
      case 'scroll:lineUp': case 'scroll:lineDown': case 'scroll:halfPageUp': case 'scroll:halfPageDown':
      case 'scroll:fullPageUp': case 'scroll:fullPageDown': case 'scroll:pageUp': case 'scroll:pageDown':
      case 'scroll:top': case 'scroll:bottom': {
        this.transcript = reduceTranscript(this.transcript,
          { type: 'scroll', command: action.slice('scroll:'.length) as TranscriptScrollCommand },
          { rows: this.viewportSize().rows, total: this.transcriptTotal(this.viewportSize().columns) });
        this.render(); return true;
      }
      case 'history:search': this.enterSearch(); return true;
      case 'historySearch:next': if(this.handleSourcePicker(action))return true;if(this.sourceSearch?.snapshot.searching)this.sourceSearch.action(action);else this.nextSearchMatch();return true;
      case 'historySearch:accept': case 'historySearch:cancel': if(this.handleSourcePicker(action))return true;if(this.sourceSearch?.snapshot.searching)this.sourceSearch.action(action);else this.leaveSearch(false);return true;
      case 'historySearch:execute': if(this.sourceSearch?.snapshot.searching)this.sourceSearch.action(action);else this.leaveSearch(true);return true;
      case 'historySearch:cycleScope': return this.handleSourcePicker(action);
      case 'autocomplete:next': this.moveAutocomplete(1); return true;
      case 'autocomplete:previous': this.moveAutocomplete(-1); return true;
      case 'autocomplete:accept': return this.acceptAutocomplete(false);
      case 'autocomplete:dismiss': this.dismissAutocomplete(); return true;
      case 'chat:submit': this.dispatch({ type: 'submit' }); return true;
      case 'chat:newline': this.dispatch({ type: 'newline' }); return true;
      case 'chat:undo': this.dispatch({ type: 'undo' }); return true;
      case 'chat:clearInput':
        this.undo.clear();this.gestures.reset();this.vim.reset();
        this.replaceDraft({ ...createEditorState(this.editor.history), historyPastes:this.editor.historyPastes,
          running: this.editor.running, killRing: this.editor.killRing });
        this.render(); return true;
      case 'chat:stash': this.stashDraft(); return true;
      case 'chat:workflowKeywordToggle': return this.toggleWorkflowKeyword();
      case 'chat:modelPicker': case 'chat:thinkingToggle': case 'app:toggleTodos': case 'chat:externalEditor': return true;
      default: return false;
    }
  }

  private stashDraft(): void {
    const current = this.editor.text.trim() ? { text:this.editor.text,cursor:this.editor.cursor,
      pastedContents:structuredClone(this.editor.pastedContents) } : undefined;
    const restored = this.stashedDraft;
    if (!current && !restored) return;
    this.undo.clear();
    this.stashedDraft = current;this.gestures.reset();this.vim.reset();
    this.replaceDraft({ ...this.editor, text: restored?.text ?? '', cursor: restored?.cursor ?? 0,
      pastedContents:structuredClone(restored?.pastedContents ?? {}),
      historyIndex: this.editor.history.length, historyDraft: restored?.text ?? '',historyDraftPastes:structuredClone(restored?.pastedContents ?? {}) });
    this.setStatus(restored ? current ? 'drafts swapped' : 'draft restored' : 'draft stashed');
  }

  /** Move the selection focus by a line/cell delta, clamping to the transcript. */
  private extendSelection(dx: number, dy: number): void {
    if (this.renderer?.selectionInstance.hasTextSelection()) {
      const direction = !Number.isFinite(dx) ? dx < 0 ? 'lineStart' : 'lineEnd'
        : dy ? dy < 0 ? 'up' : 'down' : dx < 0 ? 'left' : 'right';
      this.renderer.selectionInstance.moveSelectionFocus(direction); this.render(); return;
    }
    const view = this.viewportSize();
    const lines = transcriptLines(this.transcript, view.columns, this.renderEntryRows, this.welcomePreamble(view.columns));
    if (!lines.length) return;
    const from = this.selection.focus ?? this.selection.anchor ?? this.anchorAt(1, 1)!;
    if (!this.selection.anchor) this.selection = reduceSelection(this.selection, { type: 'start', at: from });
    const line = Math.max(0, Math.min(from.line + dy, lines.length - 1));
    const text = lines[line]!;
    const column = !Number.isFinite(dx) ? selectionColumn(text, dx < 0 ? 0 : Infinity)
      : dy ? selectionColumn(text, from.column) : moveSelectionColumn(text, from.column, dx);
    this.selection = reduceSelection(this.selection, { type: 'extend', to: { line, column } });
    const viewport = layoutTranscript(this.transcript, view.columns, view.rows, this.renderEntryRows,
      this.welcomePreamble(view.columns));
    if (line < viewport.offset) this.transcript = { ...this.transcript, offset: line };
    else if (line >= viewport.offset + view.rows) this.transcript = { ...this.transcript, offset: line - view.rows + 1 };
    this.render();
  }

  /** Copy the span through OSC 52, then take it down as the recovered app does. */
  private copySelection(): void {
    const view = this.viewportSize();
    const rows = renderedTranscriptRows(this.transcript, view.columns, this.renderEntryRows, this.welcomePreamble(view.columns));
    const native = this.renderer?.selectionInstance;
    const text = native?.hasTextSelection() ? native.copySelectionNoClear()
      : selectionTextFromRows(this.selection, rows as readonly SelectionRow[]);
    if (!text) return;
    let payload: string;
    try { payload = osc52Payload(text); }
    catch (error) { this.setStatus((error as Error).message); return; }
    this.options.output.write(payload);
    native?.clearTextSelection();
    this.selection = reduceSelection(this.selection, { type: 'clear' });
    this.setStatus('copy request sent');
  }

  private ensureSourceSearch(): HistorySearch {
    return this.sourceSearch ??= new HistorySearch({
      read: () => this.inputHistory.readEntries(), sessionId: () => this.searchSessionId,allocator:this.pasteOwner.allocator,
      carriers: () => [this.editor.text,...this.editor.history,this.stashedDraft?.text ?? '',this.searchDraft.text],
      report: error => this.setStatus(`History: ${String(error)}`),
      changed: snapshot => this.publishSearch(snapshot),
      submit: entry => {
        if (this.closed) return;
        this.replaceDraft({...this.editor,text:entry.display,cursor:entry.display.length,pastedContents:structuredClone(entry.pastedContents)});
        this.dispatch({type:'submit'});
      },
    });
  }
  private publishSearch(snapshot: SearchSnapshot): void {
    if (this.closed || !this.sourceSearch) return;
    this.screen = snapshot.searching ? 'search' : 'chat';
    this.replaceDraft({...this.editor,text:snapshot.text,cursor:snapshot.cursor,pastedContents:snapshot.pastedContents});
    if (!snapshot.searching) {this.queryUndo.clear();this.queryEditor=createEditorState();}
    else if(snapshot.query!==this.queryEditor.text)this.sourceSearch.queryCursor=snapshot.query.length;
    this.render();
  }
  private handleSourceSearch(action: EditorAction): boolean {
    if (!this.sourceSearch?.snapshot.searching) return false;
    const sequence = action.type === 'key' ? action.sequence : action.type === 'return' ? action.sequence : '';
    const command = action.type === 'key' ? action.command : action.type;
    const operation = command === 'search' || sequence === '\u0012' ? 'historySearch:next'
      : command === 'interrupt' || sequence === '\u0003' ? 'historySearch:cancel'
      : sequence === '\x1b' || sequence === '\t' ? 'historySearch:accept'
      : command === 'submit' || command === 'return' ? 'historySearch:execute' : undefined;
    if (operation) {this.sourceSearch.action(operation);return true;}
    if (command === 'backspace' && this.sourceSearch.backspace()) return true;
    if (command === 'eof') {this.sourceSearch.cancel();return false;}
    const edit = action.type === 'key' ? action.command ? {type:action.command} as EditorAction : undefined : action;
    if (!edit || edit.type === 'mouse' || edit.type === 'terminalResponse') return true;
    const next = reduceEditorWithUndo(this.queryEditor,edit,{navigationColumns:Math.max(20,this.options.output.columns ?? 80),
      maxPasteBytes:this.options.maxPasteBytes,historyLimit:0},this.queryUndo);
    this.queryEditor = next.state;
    this.sourceSearch.queryCursor = this.queryEditor.cursor;
    this.sourceSearch.query(this.queryEditor.text);this.render();return true;
  }
  private ensureSourcePicker(): ScopedPicker {
    return this.sourcePicker ??= new ScopedPicker({
      read: scope => this.inputHistory.readTimestamped(scope),
      report: error => this.setStatus(`History: ${String(error)}`),
      changed: snapshot => this.publishPicker(snapshot),
    });
  }
  private publishPicker(snapshot: ScopePickerSnapshot): void {
    if (this.closed || !this.sourcePicker) return;
    this.screen = snapshot.searching ? 'search' : 'chat';
    // The picker owns the draft while it is open. Once it closes, a later cancel must not restore
    // the pre-picker draft over the row the user just accepted, so the draft is retired with it.
    if (!snapshot.searching) {this.pickerUndo.clear();this.pickerQuery=createEditorState();this.searchDraft={text:'',cursor:0,pastedContents:{}};}
    else if (snapshot.query !== this.pickerQuery.text) this.sourcePicker.queryCursor = this.pickerQuery.cursor;
    this.render();
  }
  /** Source Kse returns a scoped picker row only through onSelect; its resolver is awaited here. */
  private async applyPickerRow(): Promise<void> {
    const picker = this.sourcePicker;
    if (!picker) return;
    const entry = await picker.chosenEntry();
    if (!entry || this.closed) return;
    this.replaceDraft({...this.editor,text:entry.display,cursor:entry.display.length,pastedContents:structuredClone(entry.pastedContents)});
    this.render();
  }
  private handleSourcePicker(action: EditorAction | string): boolean {
    const picker = this.sourcePicker;
    if (!picker?.snapshot.searching) return false;
    if (typeof action === 'string') {
      if (action === 'historySearch:cycleScope') { picker.cycleScope(); return true; }
      if (action === 'historySearch:next') { picker.move(1); return true; }
      if (action === 'historySearch:cancel') { picker.cancel(); return true; }
      // Source gLt return/tab both call `onSelect(<focused row>)`; the HistorySearch table names
      // enter `historySearch:execute`, so both actions select into the prompt and never run it.
      if (action === 'historySearch:accept' || action === 'historySearch:execute') { if(picker.accept())void this.applyPickerRow(); return true; }
      return false;
    }
    const sequence = action.type === 'key' ? action.sequence : action.type === 'return' ? action.sequence : '';
    const command = action.type === 'key' ? action.command : action.type;
    if (command === 'search' || sequence === '\u0013') { picker.cycleScope(); return true; }
    if (command === 'interrupt' || sequence === '\u0003') { picker.cancel(); return true; }
    if (sequence === '\t' || sequence === '\x1b') { if(picker.accept())void this.applyPickerRow(); return true; }
    // Source gLt swallows return/tab when its window holds no row: no selection, no submit, no close.
    if (command === 'submit' || command === 'return') { if(picker.accept())void this.applyPickerRow(); return true; }
    // Source gLt with `direction:"up"` draws a bottom-anchored list: the up key advances the focus
    // index (the row above), so the picker's index delta follows the frame's mapping.
    if (command === 'up' || sequence === '\x1b[A' || sequence === '\x10') { picker.move(1); return true; }
    if (command === 'down' || sequence === '\x1b[B' || sequence === '\x0e') { picker.move(-1); return true; }
    if (sequence === '\x1b[5~') { picker.page(1); return true; }
    if (sequence === '\x1b[6~') { picker.page(-1); return true; }
    // Source gLt builds its query editor with `backspaceExitsOnEmpty:!1`.
    if (command === 'backspace' && this.pickerQuery.text === '') return true;
    const edit = action.type === 'key' ? action.command ? {type:action.command} as EditorAction : undefined : action;
    if (!edit || edit.type === 'mouse' || edit.type === 'terminalResponse') return true;
    const next = reduceEditorWithUndo(this.pickerQuery,edit,{navigationColumns:Math.max(20,this.options.output.columns ?? 80),
      maxPasteBytes:this.options.maxPasteBytes,historyLimit:0},this.pickerUndo);
    this.pickerQuery = next.state;
    picker.query(this.pickerQuery.text);this.render();return true;
  }
  private enterSearch(): void {
    if (this.inputHistory.bound) {
      // Source registers the scoped picker as the Global history:search action when the history
      // feature is on, and the async search hook registers the same action as inactive then. The
      // picker's screen output is not wired yet, so the overlay route stays opt-in: an input that
      // cannot render its own frame must not swallow the key that opens history search.
      if (SOURCE_PICKER_OWNS_HISTORY_SEARCH) {
      this.selection=createSelection();this.gestures.reset();this.vim.externalMutation();
      this.searchDraft={text:this.editor.text,cursor:this.editor.cursor,pastedContents:structuredClone(this.editor.pastedContents)};
      this.pushUndo(this.editor.text,this.editor.cursor,this.editor.pastedContents);
        // Source `_y` seeds query and caret from `initialQuery`, and its consumer passes the draft
        // (`e(Kse,{initialQuery: ee.value, …})`), so the picker opens pre-filtered by the draft.
        this.pickerUndo.clear();this.pickerQuery={...createEditorState(),text:this.editor.text,cursor:this.editor.text.length};
        this.ensureSourcePicker().begin(this.editor.text);return;
      }
      this.queryUndo.clear();this.queryEditor=createEditorState();
      this.ensureSourceSearch().open(this.searchDraft);return;
    }
    this.selection = createSelection();
    this.screen = 'search';
    this.searchQuery = ''; this.searchIndex = -1;
    this.searchDraft = {text:this.editor.text,cursor:this.editor.cursor,pastedContents:structuredClone(this.editor.pastedContents)};
    this.render();
  }

  private nextSearchMatch(): void {
    const history = this.editor.history;
    if (!this.searchQuery) { this.searchQuery = this.editor.text; }
    for (let index = (this.searchIndex < 0 ? history.length : this.searchIndex) - 1; index >= 0; index--) {
      if (history[index]!.includes(this.searchQuery)
        || expandPastedText(history[index]!,this.editor.historyPastes[index]).includes(this.searchQuery)) {
        this.searchIndex = index;
        if (this.editor.text !== history[index]) this.pushUndo(this.editor.text,this.editor.cursor,this.editor.pastedContents);
        this.replaceDraft({ ...this.editor, text:history[index]!,cursor:history[index]!.length,
          pastedContents:structuredClone(this.editor.historyPastes[index] ?? {}) });
        this.render(); return;
      }
    }
    this.searchIndex = -1;
    this.render();
  }

  private leaveSearch(execute: boolean): void {
    this.screen = 'chat';
    if (!execute) {
      if (this.editor.text !== this.searchDraft.text) this.pushUndo(this.editor.text,this.editor.cursor,this.editor.pastedContents);
      this.replaceDraft({ ...this.editor, ...this.searchDraft,pastedContents:structuredClone(this.searchDraft.pastedContents) });
    }
    this.searchQuery = ''; this.searchIndex = -1; this.searchDraft = {text:'',cursor:0,pastedContents:{}};
    this.render();
    if (execute) this.dispatch({ type: 'submit' });
  }

  private readonly onEnd = () => { if (!this.closed) { this.close(); this.emit('exit'); } };
  private readonly onError = (error: Error) => {
    this.close();
    try { this.emit('inputError', error); } finally { this.emit('exit'); }
  };
  private readonly onResize = () => {
    this.selection = createSelection(); this.diffPointer = undefined; this.renderer?.clearNativeSelection(); this.render();
  };

  /**
   * Records the answer for the current step. A grouped request advances to the
   * next group, or to the review page after the last one; an ungrouped request
   * settles immediately, which is the pre-existing behaviour.
   */
  private advanceDialog(dialog: ActiveDialog, answer: TerminalPromptAnswer): void {
    const adjust = dialog.request.adjust;
    const settled = adjust === undefined ? answer
      : { ...answer, adjusted: adjust.values[dialog.adjustIndex] ?? adjust.initial };
    const groups = dialog.request.groups ?? [];
    if (!groups.length) { dialog.finish(settled); return; }
    const group = groups[dialog.step];
    if (group) {
      const notes = dialog.notes.get(group.key)?.trim();
      const images = dialog.images.list(group.key);
      dialog.answers.set(group.key, { key: group.key, selected: answer.selected,
        ...(answer.text === undefined ? {} : { text: answer.text }),
        ...(notes ? { notes } : {}), ...(images.length ? { images } : {}) });
    }
    // Source `qr` (chunk-24k7d6mw.js [1170529)): one non-multi-select question hides the
    // submit tab, and its answer handler submits the whole request as soon as the answer is
    // taken (`!Gs && Va` at [1173330)), so the review page is never reached.
    if (groups.length === 1 && group !== undefined && !group.multiple) {
      dialog.finish({ selected: [], groups: [dialog.answers.get(group.key)!] });
      return;
    }
    dialog.step += 1;
    this.resetDialogStep(dialog);
  }

  /** Moves the dialog to `step` with a fresh editor, selection and scroll. */
  private resetDialogStep(dialog: ActiveDialog): void {
    const groups = dialog.request.groups ?? [];
    const group = groups[dialog.step];
    const source: TerminalPromptRequest | TerminalPromptGroup = group ?? dialog.request;
    const choices = source.choices?.length ?? 0;
    dialog.undo.clear();
    dialog.editor = createEditorState();
    dialog.index = Math.max(0, Math.min(source.defaultIndex ?? 0, Math.max(0, choices - 1)));
    dialog.selected = new Set();
    dialog.notesEditing = false; dialog.notesEditor = createEditorState(); dialog.notesUndo.clear();
    dialog.optionTouched = false;
    dialog.scroll = 0; dialog.followFocus = true; dialog.error = undefined;
    this.render();
  }

  /** The group whose notes UI is active, if the dialog is on a question step. */
  private notesStep(dialog: ActiveDialog): TerminalPromptGroup | undefined {
    const groups = dialog.request.groups ?? [];
    return dialog.step < groups.length ? groups[dialog.step] : undefined;
  }

  private clarificationIndex(dialog: ActiveDialog): number | undefined {
    const group = (dialog.request.groups ?? [])[dialog.step];
    if (!dialog.request.allowClarification || !group || !(group.choices?.length)) return undefined;
    return group.choices.length + (group.allowText ? 1 : 0);
  }

  /** f3 onChange updates multi-select answers before advancing, [1158935,1159164), UTF-16. */
  private storeMultiDialogAnswer(dialog: ActiveDialog): void {
    const group = (dialog.request.groups ?? [])[dialog.step];
    if (!group?.multiple) return;
    const choices = group.choices ?? [];
    const text = dialog.editor.text.trim();
    const images = dialog.images.list(group.key);
    dialog.answers.set(group.key, { key: group.key,
      selected: [...dialog.selected].sort((a, b) => a - b).map(index => choices[index]!.value),
      ...(text ? { text } : {}), ...(images.length ? { images } : {}) });
  }

  private clarifyDialog(dialog: ActiveDialog): void {
    const groups = (dialog.request.groups ?? []).flatMap(group => {
      const answer = dialog.answers.get(group.key);
      const notes = dialog.notes.get(group.key)?.trim();
      const images = dialog.images.list(group.key);
      if (!answer && !notes && !images.length) return [];
      return [{ key: group.key, selected: answer?.selected ?? [],
        ...(answer?.text === undefined ? {} : { text: answer.text }), ...(notes ? { notes } : {}),
        ...(images.length ? { images } : {}) }];
    });
    dialog.finish({ selected: [], clarify: true, groups });
  }

  /** `zet`: notes exist only for a single-select question that shows a preview. */
  private notesAvailable(dialog: ActiveDialog, step: TerminalPromptRequest | TerminalPromptGroup | undefined): boolean {
    if (!(dialog.request.groups ?? []).length || step === undefined || step.multiple === true) return false;
    return (step.choices ?? []).some(choice => choice.preview !== undefined);
  }

  private enterNotes(dialog: ActiveDialog): void {
    const key = this.notesStep(dialog)?.key;
    if (key === undefined) return;
    const value = dialog.notes.get(key) ?? '';
    dialog.notesEditing = true;
    dialog.notesEditor = { ...createEditorState(), text: value, cursor: value.length };
    dialog.notesUndo.clear();
    dialog.error = undefined;
    this.render();
  }

  /** Source `Le(co,{textInputValue})`: notes live outside the answer text. */
  private storeNotes(dialog: ActiveDialog): void {
    const key = this.notesStep(dialog)?.key;
    if (key === undefined) return;
    if (dialog.notesEditor.text.trim()) dialog.notes.set(key, dialog.notesEditor.text);
    else dialog.notes.delete(key);
  }

  private handleNotesAction(dialog: ActiveDialog, action: EditorAction,
    command: string | undefined, sequence: string): void {
    // Source `onExit`: Esc closes only the notes input; Ctrl+C still cancels.
    if (sequence === '\x1b' || command === 'escape') {
      this.storeNotes(dialog); dialog.notesEditing = false; this.render(); return;
    }
    if (command === 'interrupt' || command === 'eof') { dialog.finish(); return; }
    if (command === 'submit') { this.submitNotes(dialog); return; }
    const editorAction = action.type === 'key' ? command ? { type: command } as EditorAction
      : sequence === '\t' ? { type: 'insert', text: '    ' } as EditorAction : undefined : action;
    if (!editorAction) { this.render(); return; }
    const policy = { ...this.options, maxPasteBytes: 32 * 1024,
      navigationColumns: Math.max(20, this.options.output.columns ?? 80) - 2 };
    const next = editorAction.type === 'undo'
      ? reduceEditorWithUndo(dialog.notesEditor, editorAction, policy, dialog.notesUndo)
      : reduceEditor(dialog.notesEditor, editorAction, policy);
    if (next.state.text.length > NOTES_MAX_CHARS || Buffer.byteLength(next.state.text) > 32 * 1024
      || next.effects.some(effect => effect.type === 'pasteRejected')) {
      dialog.error = `Notes exceed ${NOTES_MAX_CHARS} characters`; this.render(); return;
    }
    if (editorAction.type !== 'undo' && next.state.text !== dialog.notesEditor.text) {
      dialog.notesUndo.record(dialog.notesEditor.text, dialog.notesEditor.cursor);
    }
    dialog.notesEditor = next.state; dialog.error = undefined;
    this.storeNotes(dialog);
    this.render();
  }

  /**
   * Source `ir` after the notes input closes: a moved option focus wins, then
   * the answer already stored for this question, then notes-only (the source
   * marker `cBt`, "(notes only)"); with neither, only the notes text is kept.
   */
  private submitNotes(dialog: ActiveDialog): void {
    this.storeNotes(dialog);
    dialog.notesEditing = false;
    const step = this.notesStep(dialog);
    const key = step?.key;
    if (!step || key === undefined) { this.render(); return; }
    const choices = step.choices ?? [];
    if (dialog.optionTouched && choices[dialog.index]) {
      this.advanceDialog(dialog, { selected: [choices[dialog.index]!.value] }); return;
    }
    const previous = dialog.answers.get(key)?.selected[0];
    const stored = previous === undefined ? undefined : choices.find(choice => choice.value === previous);
    if (stored) { this.advanceDialog(dialog, { selected: [stored.value] }); return; }
    if (dialog.notes.get(key)?.trim()) {
      this.advanceDialog(dialog, { selected: [], text: QUESTION_NOTES_ONLY }); return;
    }
    this.render();
  }

  /**
   * Starts the recovered `Zbe` clock for a grouped question dialog. The source
   * enables it only with a host timeout or `CLAUDE_AFK_TIMEOUT_MS`; it counts
   * idle time from dialog open, stays at full while the terminal is focused and
   * resets on any key. The answer is built synchronously here, so the source's
   * post-fire interaction checks collapse to clearing the clock.
   */
  private startAfk(dialog: ActiveDialog, request: TerminalPromptRequest): void {
    this.stopAfk();
    if (!request.groups?.length) return;
    const settings = afkTimeoutSettings(request.afkTimeoutMs);
    if (settings === undefined) return;
    const fullSeconds = Math.ceil(settings.timeoutMs / 1000);
    const initial = afkCountdown(settings, fullSeconds, 0);
    const state: DialogAfk = { target: dialog, settings, fullSeconds, remainingSeconds: initial.remainingSeconds,
      showCountdown: initial.showCountdown, fired: false, base: Date.now(), lastInteraction: 0,
      timer: setInterval(() => this.tickAfk(state), 1000) };
    state.timer.unref?.();
    this.afk = state;
  }

  private stopAfk(): void {
    if (this.afk) clearInterval(this.afk.timer);
    this.afk = undefined;
  }

  private noteAfkInteraction(): void {
    if (this.afk) this.afk.lastInteraction = Date.now();
  }

  private tickAfk(state: DialogAfk): void {
    if (this.afk !== state || this.dialog !== state.target || state.fired) return;
    const now = Date.now();
    // Zbe's GPe focus baseline survives handoff, where this host stops reading focus reports.
    if (this.editorController) {state.base = now;return;}
    // Source `GPe()===true`: a focused terminal keeps moving the baseline.
    if (this.focus.state === 'focused') state.base = now;
    const elapsedMs = now - Math.max(state.base, state.lastInteraction);
    if (elapsedMs >= state.settings.timeoutMs) {
      state.fired = true;
      const groups = state.target.request.groups ?? [];
      // Source `P3` receives the answers map as-is: only taken answers submit.
      const answers = groups.map(group => state.target.answers.get(group.key))
        .filter((answer): answer is TerminalPromptGroupAnswer => answer !== undefined);
      // `Zbe` hands its callback the timeout it fired on, and `P3` stores that
      // as `afkTimeoutMs`, so the marker is the configured idle threshold.
      state.target.finish({ selected: [], groups: answers, afkTimeoutMs: state.settings.timeoutMs });
      return;
    }
    const next = afkCountdown(state.settings, state.fullSeconds, elapsedMs);
    if (next.remainingSeconds === state.remainingSeconds && next.showCountdown === state.showCountdown) return;
    state.remainingSeconds = next.remainingSeconds;
    state.showCountdown = next.showCountdown;
    this.render();
  }

  /** The `ywe` countdown row, or undefined while it is not showing. */
  private dialogCountdown(): string | undefined {
    const afk = this.afk;
    if (!afk?.showCountdown || this.dialog !== afk.target) return undefined;
    return `auto-continue in ${afk.remainingSeconds}s · any key to stay`;
  }

  /** One extra frame row is reserved for the countdown while it shows. */
  private afkRows(): number {
    return this.dialogCountdown() === undefined ? 0 : 1;
  }

  /**
   * Review-page keys, copied from the recovered page: Enter submits and the
   * cancel label settles the whole request. Group navigation itself is handled
   * for every grouped step, because the recovered flow is tabbed and Left/Right
   * move between questions from any of them.
   */
  private handleReviewAction(dialog: ActiveDialog, action: EditorAction, command: string): boolean {
    const groups = dialog.request.groups ?? [];
    if (!groups.length) return false;
    const reviewing = dialog.step >= groups.length;
    if (command === 'left' || command === 'right') {
      const delta = command === 'left' ? -1 : 1;
      const from = reviewing ? groups.length : dialog.step;
      const next = Math.max(0, Math.min(groups.length - 1, from + delta));
      // Right on the last question goes to the review page, as the last tab does.
      if (reviewing && command === 'right') return true;
      // Source `bl` (chunk-24k7d6mw.js [1174081)): the hide-submit single question sets the
      // next-tab bound to 0, so Right never opens a review page for it.
      if (!reviewing && command === 'right' && groups.length === 1 && !groups[0]!.multiple) return true;
      if (!reviewing && command === 'right' && dialog.step === groups.length - 1) {
        dialog.step = groups.length; this.resetDialogStep(dialog); return true;
      }
      if (next === dialog.step && !reviewing) return true;
      dialog.step = next;
      const group = groups[next]!;
      const previous = dialog.answers.get(group.key);
      this.resetDialogStep(dialog);
      // Reopen the group with the answer it already has.
      if (previous) {
        const choices = group.choices ?? [];
        dialog.selected = new Set(previous.selected
          .map(value => choices.findIndex(choice => choice.value === value)).filter(index => index >= 0));
        if (previous.text) dialog.editor = { ...dialog.editor, text: previous.text };
      }
      this.render();
      return true;
    }
    if (!reviewing) return false;
    if (action.type === 'insert' || action.type === 'paste') return true;
    if (command === 'submit') {
      dialog.finish({ selected: [], groups: groups.map(group => dialog.answers.get(group.key)
        ?? { key: group.key, selected: [] }) });
      return true;
    }
    return true;
  }

  private renderDialog(columns: number, bodyRows: number): string[] {
    const dialog = this.dialog!;
    const clean = (text: string) => text.replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '');
    const oneLine = (text: string) => clean(text).replace(/[\t\n]/g, ' ');
    const groups = dialog.request.groups ?? [];
    const reviewing = groups.length > 0 && dialog.step >= groups.length;
    const group = reviewing ? undefined : groups[dialog.step];
    // A grouped step answers its own group; an ungrouped request is one step.
    const active: TerminalPromptRequest | TerminalPromptGroup = group ?? dialog.request;
    const title = reviewing ? (dialog.request.reviewTitle ?? 'Review your answers') : active.title ?? dialog.request.title;
    // Source `Ku` renders the countdown as its own row after the question body;
    // the dialog frame trades one content row for it.
    const countdown = this.dialogCountdown();
    const height = Math.max(0, bodyRows);
    const content: string[] = [];
    if (reviewing) {
      // Recovered page: a warning while questions are unanswered, then each
      // answered question with its value, then the submit prompt.
      const unanswered = groups.filter(item => {
        const answer = dialog.answers.get(item.key);
        return !answer || (!answer.selected.length && !answer.text);
      });
      if (unanswered.length) {
        content.push(...wrapEntry({ kind: 'error', text: 'You have not answered all questions' }, columns));
        content.push('');
      }
      for (const item of groups) {
        const answer = dialog.answers.get(item.key);
        content.push(...wrapEntry({ kind: 'assistant', text: oneLine(item.title ?? item.message) }, columns));
        const value = answer?.text ?? (answer?.selected.length ? answer.selected.join(', ') : '');
        content.push(...wrapEntry({ kind: 'system', text: `  ${value || '(no answer)'}` }, columns));
      }
      content.push('');
      content.push(...wrapEntry({ kind: 'assistant', text: 'Ready to submit your answers?' }, columns));
      dialog.scroll = Math.min(dialog.scroll, Math.max(0, content.length - height));
      const visible = content.slice(dialog.scroll, dialog.scroll + height);
      while (visible.length < height) visible.push('');
      const submit = dialog.request.submitLabel ?? 'Submit answers';
      const cancel = dialog.request.cancelLabel ?? 'Cancel';
      return [oneLine(title ?? 'Review'), ...visible, SEPARATOR.repeat(columns),
        pad(`[ ${submit} ]  [ ${cancel} ]`, columns),
        dialog.error ?? 'Enter submit / Esc cancel / Left Right edit a question',
        ...(countdown === undefined ? [] : [countdown])].map(line => pad(line, columns));
    }
    const choices = active.choices ?? [];
    const previews = choices.map(choice => questionPreviewText(choice.preview));
    const hasPreview = previews.some(preview => preview !== undefined);
    const previewText = previews[dialog.index] ?? 'No preview available';
    const body = wrapEntry({ kind: 'assistant', text: clean(active.message) }, columns);
    const questionRows = body.length;
    const previewColumn = hasPreview && columns >= PREVIEW_LIST_WIDTH + 4 + PREVIEW_MIN_WIDTH + 4
      && height - questionRows >= 4;
    const geometry = previewColumn ? previewGeometry(columns) : undefined;
    const bodyWidth = geometry?.listWidth ?? columns;
    const offsets: number[] = [];
    for (const [index, choice] of choices.entries()) {
      offsets.push(body.length);
      const marker = active.multiple ? (dialog.selected.has(index) ? '[x]' : '[ ]') : '   ';
      body.push(...wrapEntry({ kind: 'assistant', text: `${dialog.index === index ? '>' : ' '} ${marker} ${clean(choice.label)}` }, bodyWidth));
      if (choice.description) body.push(...wrapEntry({ kind: 'assistant', text: `    ${clean(choice.description)}` }, bodyWidth));
    }
    if (choices.length && active.allowText) {
      offsets.push(body.length); body.push(`${dialog.index === choices.length ? '>' : ' '} Other`);
    }
    const notesKey = group?.key;
    if (notesKey !== undefined && this.notesAvailable(dialog, active)) {
      const notes = dialog.notes.get(notesKey) ?? '';
      body.push('');
      body.push(dialog.notesEditing ? 'Notes:' : `Notes: ${oneLine(notes) || 'press n to add notes'}`);
    }
    const themeRows = new Map<number, string>();
    if (dialog.request.themePreview) {
      this.documentRenderer ??= new TuiDocumentRenderer();
      const sample = this.documentRenderer.renderMarkdown('Theme preview\n\nUse `sample` text.\n\n> Quote preview', columns,
        { theme: this.theme.current, themeOverrides: this.theme.overrides,
          syntaxHighlightingDisabled: this.syntaxHighlightingDisabled });
      body.push('');
      for (const row of sample) { themeRows.set(body.length, row.ansi); body.push(row.text); }
    }
    if (hasPreview) {
      const boxRows = geometry ? height - questionRows : height - body.length - 2;
      const box = previewBox(renderPreviewMarkdown(previewText), Math.max(1, boxRows - 3), geometry?.previewWidth ?? columns);
      if (geometry) {
        const optionRows = body.length - questionRows;
        for (let row = 0; row < Math.max(optionRows, box.length); row++) {
          body[questionRows + row] = pad(body[questionRows + row] ?? '', geometry.listWidth)
            + ' '.repeat(geometry.previewLeft - geometry.listWidth) + (box[row] ?? '');
        }
      } else body.push('', 'Preview:', ...box);
    }
    const clarification = this.clarificationIndex(dialog);
    if (clarification !== undefined) {
      offsets[clarification] = body.length + 1;
      body.push('', `${dialog.index === clarification ? '>' : ' '} Chat about this`);
    }
    const focused = offsets[dialog.index];
    // Follow focus after navigation; explicit page scrolling can explore a long body.
    if (dialog.followFocus && focused !== undefined && height > 0) {
      if (focused < dialog.scroll) dialog.scroll = focused;
      else if (focused >= dialog.scroll + height) dialog.scroll = focused - height + 1;
      dialog.followFocus = false;
    }
    dialog.scroll = Math.min(dialog.scroll, Math.max(0, body.length - height));
    const visible = body.slice(dialog.scroll, dialog.scroll + height);
    while (visible.length < height) visible.push('');
    const textEntry = choices.length === 0 || dialog.index === choices.length;
    const readOnly = dialog.request.readOnly === true;
    const answer = '> ' + (layoutInput(dialog.notesEditing ? dialog.notesEditor : dialog.editor,
      columns - 2, 1).lines[0] ?? '');
    const progress = groups.length ? `Question ${dialog.step + 1} of ${groups.length}` : undefined;
    // A read-only panel keeps its rows selectable but draws no input row of its own.
    const hint = readOnly ? (choices.length ? 'Enter next / Esc back / PgUp/PgDn' : 'Esc close / PgUp/PgDn')
      : dialog.notesEditing ? 'Notes · Enter save / Esc exit'
        : active.multiple ? 'Space toggle / Enter next / Esc cancel / PgUp/PgDn'
          : dialog.request.adjust?.guide ?? 'Enter next / Esc cancel / PgUp/PgDn';
    // The axis line sits under the selection, the way the recovered picker draws its
    // effort line between the list and the key guide.
    const axis = dialog.request.adjust;
    const axisLine = axis === undefined ? undefined : axis.label(axis.values[dialog.adjustIndex] ?? axis.initial);
    return [oneLine(title ?? 'Interaction'), ...visible, SEPARATOR.repeat(columns),
      readOnly && textEntry ? '' : textEntry || dialog.notesEditing ? answer : dialog.index === clarification ? 'Chat about this'
        : `Selected: ${oneLine(choices[dialog.index]?.label ?? '')}`,
      ...(axisLine === undefined ? [] : [axisLine]),
      dialog.error ?? (progress ? `${progress} · ${hint}` : hint),
      ...(countdown === undefined ? [] : [countdown])].map((line, row) =>
        row > 0 && row <= height ? themeRows.get(dialog.scroll + row - 1) ?? pad(line, columns) : pad(line, columns));
  }

  private renderThemeEditor(dialog: ActiveDialog, columns: number, rows: number): string[] {
    const owner = dialog.themeEditor!;
    const content: string[] = [];
    this.documentRenderer ??= new TuiDocumentRenderer();
    const colors = createThemeColorComponents(owner.overrides, S1(owner.base));
    const paint = (tree: unknown) => this.documentRenderer!.renderElement(tree, columns,
      {theme:this.theme.current, themeOverrides:this.theme.overrides}).map(row => row.ansi);
    const editing = owner.mode === 'name' || owner.token !== null;
    const title = owner.mode === 'name' ? owner.fork ? `Fork ${owner.name} to your themes` : 'New custom theme'
      : owner.token !== null ? owner.name : `${owner.name} · based on ${owner.base}`;
    if (owner.mode === 'name') content.push(`Name: ${dialog.editor.text}`, `Based on ${owner.base}`);
    else if (owner.token !== null) {
      content.push(`Color: ${owner.token}`, ...paint(jsx(s, {children:[
        jsx(colors.Swatch, {value:owner.valid ? owner.value : owner.preset(owner.token)}, undefined),
        jsx(n, {bold:true, children:' ' + owner.token}, undefined),
      ]}, undefined)), `Preset: ${owner.preset(owner.token)}`, `Value: ${dialog.editor.text}`);
    } else {
      content.push(`Filter color tokens: ${dialog.editor.text}`);
      const tokens = owner.filtered(dialog.editor.text);
      dialog.index = Math.min(dialog.index, Math.max(0, tokens.length - 1));
      const height = Math.max(1, rows - 14);
      const offset = Math.max(0, Math.min(dialog.index - Math.floor(height / 2), tokens.length - height));
      const items = tokens.slice(offset, offset + height).map((token, index) => jsx(s, {children:[
        jsx(n, {children:offset + index === dialog.index ? '> ' : '  '}, undefined),
        colors.renderItem(token, offset + index === dialog.index),
      ]}, token));
      const focused = tokens[dialog.index];
      content.push(...paint(jsx(s, {flexDirection:'column', children:items}, undefined)));
      if (!tokens.length) content.push(colors.empty(dialog.editor.text));
      if (focused) content.push(...paint(colors.renderPreview(focused)));
    }
    const sample = this.documentRenderer.renderMarkdown('Theme preview\n\nUse `sample` text.\n\n> Quote preview', columns,
      {theme:this.theme.current, themeOverrides:this.theme.overrides, speaker:true, syntaxHighlightingDisabled:this.syntaxHighlightingDisabled});
    const height = Math.max(0, rows - 4);
    const body = [...content.slice(0, Math.max(0, height - sample.length - 1)), '', ...sample.map(row => row.ansi)].slice(0, height);
    while (body.length < height) body.push('');
    const error = owner.error ?? dialog.error;
    const hint = dialog.busy ? 'Saving theme' : owner.mode === 'name' ? 'Enter continue / Esc cancel'
      : owner.token !== null ? 'Enter save / Esc cancel' : 'Enter edit / Tab reset / Esc done';
    return [pad(title, columns), ...body, SEPARATOR.repeat(columns),
      editing ? '> ' + (layoutInput(dialog.editor, columns - 2, 1).lines[0] ?? '') : `Filter: ${dialog.editor.text}`,
      pad(error ?? hint, columns)];
  }

  private render(): void {
    if (!this.isTTY || !this.started || this.closed || this.editorSuspended) return;
    const columns = Math.max(20, this.options.output.columns ?? 80);
    const rows = Math.max(4, this.options.output.rows ?? 24);
    this.diffPanel?.setColumns(columns);
    this.statusLine.setVimMode(this.vim.mode); this.statusLine.refresh();
    this.statusLine.setActive(this.dialog === undefined && this.screen === 'chat' && !this.gestures.hint);
    this.progress.setVisible(this.dialog === undefined);
    if (this.dialog) {
      if (this.dialog.themeEditor) {
        const frame = this.renderThemeEditor(this.dialog, columns, rows);
        const cursor = layoutInput(this.dialog.editor, columns - 2, 1).cursorColumn + 2;
        this.drawFrame(frame, columns, rows, rows - 2, cursor, !this.dialog.busy); return;
      }
      // The recovered host renders a pending dialog inside the chat frame rather than over the
      // whole screen: the transcript keeps the top, the dialog takes the body and the footer
      // stays at the bottom, so the surface never degenerates into a bare text screen.
      const afkRows = this.afkRows();
      // The transcript keeps the top third while the dialog keeps the rows it needs below it,
      // and the footer keeps the last row.
      const transcriptRows = Math.max(0, Math.min(Math.floor(rows / 3), rows - 14 - afkRows));
      const frame = this.renderDialog(columns, rows - 5 - afkRows - transcriptRows);
      const viewport = layoutTranscript(this.transcript, columns, transcriptRows, this.renderEntryRows,
        this.welcomePreamble(columns));
      const lines: string[] = [];
      for (let row = 0; row < transcriptRows; row++) {
        const rendered = viewport.rows[row];
        lines.push(rendered?.ansi ?? pad(rendered?.text ?? '', columns));
      }
      lines.push(...frame, ...this.footerRows(columns));
      const groups = this.dialog.request.groups ?? [];
      const reviewing = groups.length > 0 && this.dialog.step >= groups.length;
      const active = reviewing ? undefined : groups[this.dialog.step] ?? this.dialog.request;
      const choices = active?.choices ?? [];
      // The dialog's own answer row: last row when no countdown, one above it otherwise.
      const answerRow = transcriptRows + frame.length - 2 - afkRows;
      if (this.dialog.notesEditing) {
        const cursor = layoutInput(this.dialog.notesEditor, columns - 2, 1).cursorColumn + 2;
        this.drawFrame(lines, columns, rows, answerRow, cursor, true);
      } else if (this.dialog.request.readOnly === true) this.drawFrame(lines, columns, rows, answerRow, 0, false);
      else if (reviewing || !choices.length || this.dialog.index === choices.length) {
        const cursor = layoutInput(this.dialog.editor, columns - 2, 1).cursorColumn + 2;
        this.drawFrame(lines, columns, rows, answerRow, cursor, true);
      } else this.drawFrame(lines, columns, rows, answerRow, 0, false);
      return;
    }
    if (this.sourcePicker?.snapshot.searching) {
      const prompt = this.inputLayout(columns, rows);
      const rowsBudget = Math.max(4, rows - prompt.lines.length - 3);
      const pickerRows = this.sourcePicker.styled(columns, rowsBudget).map(row=>row.ansi);
      const listRows = pickerRows.slice(0, Math.max(0, pickerRows.length - 1));
      const target = rows - 1;
      this.renderer ??= new TuiRenderer(this.options.output,this.options.synchronizedUpdate ?? true);
      this.renderer.renderChat(listRows, prompt.lines, [pickerRows.at(-1) ?? ''], columns, rows, {row:target,
        column:prompt.cursorColumn,visible:true},
        this.running,undefined,this.theme.current,this.theme.overrides,[],[]);
      this.drawnRows=rows;this.cursorRow=0;this.cursorColumn=prompt.cursorColumn;return;
    }
    if (this.sourceSearch?.snapshot.searching) {
      const prompt = this.inputLayout(columns, rows);
      this.documentRenderer ??= new TuiDocumentRenderer();
      const queryDocument = this.documentRenderer.renderElement(this.sourceSearch.element(),columns,
        {theme:this.theme.current,themeOverrides:this.theme.overrides});
      const queryRows = queryDocument.map(row=>row.ansi);
      const height = Math.max(0,rows-prompt.lines.length-queryRows.length-3);
      const viewport=layoutTranscript(this.transcript,columns,height,this.renderEntryRows,this.welcomePreamble(columns));
      const frame=Array.from({length:height},(_,index)=>viewport.rows[index]?.ansi ?? pad('',columns));
      const target=rows-1;
      this.renderer ??= new TuiRenderer(this.options.output,this.options.synchronizedUpdate ?? true);
      this.renderer.renderChat(frame,prompt.lines,[queryRows.at(-1) ?? ''],columns,rows,{row:target,
        column:this.sourceSearch.caretColumn(columns),visible:true},
        this.running,undefined,this.theme.current,this.theme.overrides,[],queryRows.slice(0,-1));
      this.drawnRows=rows;this.cursorRow=0;this.cursorColumn=this.queryEditor.cursor;return;
    }
    const sidebarWidth = this.screen === 'chat' ? this.diffPanel?.width(columns) ?? 0 : 0;
    const conversationWidth = columns - sidebarWidth;
    const prompt = this.inputLayout(conversationWidth, rows);
    // Source `iEe` draws the suggestion list above the composer; the transcript shrinks with it.
    const hintRows = this.renderAutocompleteRows(conversationWidth, rows);
    // `Mk`'s banner is a row of its own above the box, so the transcript yields one more row
    // whenever it is drawn.
    const banner = this.sessionBanner();
    const bannerRows = banner === undefined ? 0 : 1;
    const statusRows = this.renderStatusLine(conversationWidth, rows, Math.max(0, rows - prompt.lines.length - 4 - bannerRows - hintRows.length));
    const progressRows = [...this.renderProgress(conversationWidth, rows,
      Math.max(0, rows - prompt.lines.length - 4 - bannerRows - statusRows.length - hintRows.length)), ...hintRows];
    const transcriptRows = Math.max(0, rows - prompt.lines.length - 3 - bannerRows - progressRows.length - statusRows.length);
    // The hint rows are the tail of `progressRows`, so they sit directly above the composer.
    this.autocompleteBand = hintRows.length === 0 ? undefined : {
      top: transcriptRows + progressRows.length - hintRows.length,
      owners: this.autocompleteOwners };
    const viewport = layoutTranscript(this.transcript, conversationWidth, transcriptRows, this.renderEntryRows,
      this.welcomePreamble(conversationWidth));

    const frame: string[] = [];
    for (let row = 0; row < transcriptRows; row++) {
      const rendered = viewport.rows[row];
      frame.push(rendered?.ansi ?? pad(rendered?.text ?? '', conversationWidth));
    }
    const target = transcriptRows + progressRows.length + bannerRows + 1 + prompt.cursorRow;
    this.renderer ??= new TuiRenderer(this.options.output, this.options.synchronizedUpdate ?? true, () => {
      if (!this.closed) {
        try { this.render(); } catch (error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
      }
    });
    this.renderer.renderChat(frame, prompt.lines,
      this.statusFooter(conversationWidth),
      columns, rows, { row: target, column: prompt.cursorColumn, visible: true }, this.running,
      { state: this.selection, offset: viewport.offset, rows: transcriptRows }, this.theme.current, this.theme.overrides, progressRows, statusRows,
      sidebarWidth ? { width: sidebarWidth, element: this.diffPanel!.element(sidebarWidth, columns, rows,
        this.renderer.appContext, this.renderer.selectionInstance) } : undefined, banner);
    this.drawnRows = rows; this.cursorRow = Math.max(0, rows - 1 - target); this.cursorColumn = prompt.cursorColumn;
  }

  /**
   * The startup header (`Hee`) leads the transcript's rendered rows without being
   * an entry, so it stays in the log and scrolls with it instead of vanishing on
   * the first keystroke. The density follows the transcript's own row budget.
   */
  private welcomePreamble(columns: number): RenderedRow[] {
    const density = welcomeDensity(this.viewportSize().rows);
    const version = this.options.version ?? '';
    const key = JSON.stringify([columns, density, version, this.theme.current, this.theme.overrides]);
    if (key !== this.welcomeKey) {
      this.welcomeRenderer ??= new TuiDocumentRenderer();
      this.welcomeRows = this.welcomeRenderer.renderElement(
        jsx(Welcome, { theme: this.theme.current, version, density }, undefined), columns,
        { theme: this.theme.current, themeOverrides: this.theme.overrides }).map(row => row.ansi);
      this.welcomeKey = key;
    }
    return this.welcomeRows.map(ansi => ({ text: plainRow(ansi, columns), continuation: false, indent: 0, ansi }));
  }

  private renderStatusLine(columns: number, rows: number, maximum: number): string[] {
    const shown = this.statusLineSetting && this.screen === 'chat' && !this.gestures.hint ? this.statusLineText : undefined;
    const padding = Math.max(0, Math.min(Math.floor(this.statusLineSetting?.padding ?? 0), Math.floor(columns / 2)));
    const key = JSON.stringify([shown, columns, rows, maximum, padding, this.theme.current, this.theme.overrides]);
    if (key !== this.statusLineKey) {
      this.statusLineRenderer ??= new TuiDocumentRenderer();
      this.statusLineRows = this.statusLineRenderer.renderElement(shown ? jsx(s, { paddingX: padding,
        children: jsx(jde, { text: shown }, undefined) }, undefined) : null, columns,
        {theme:this.theme.current,themeOverrides:this.theme.overrides,terminalRows:rows}).slice(0,maximum).map(row => row.ansi);
      this.statusLineKey = key;
    }
    return this.statusLineRows;
  }

  private renderProgress(columns: number, rows: number, maximum: number): string[] {
    if (!this.progress.running && !this.progress.hasTasks) {
      this.progressRenderer?.renderElement(null, columns); this.progressHeight = 0; return [];
    }
    this.progressRenderer ??= new TuiDocumentRenderer();
    const content = this.progressRenderer.renderElement(this.progress.element(columns), columns,
      {theme:this.theme.current, themeOverrides:this.theme.overrides, terminalRows:rows}).map(row => row.ansi);
    const visible = content.slice(0, maximum);
    this.progressHeight = visible.length;
    return visible;
  }

  private drawFrame(lines: readonly string[], columns: number, rows: number,
    row: number, column: number, visible: boolean): void {
    this.renderer ??= new TuiRenderer(this.options.output, this.options.synchronizedUpdate ?? true);
    this.renderer.render(lines, columns, rows, { row, column, visible });
  }

  /**
   * The footer as painted rows, for screens that compose their own frame instead of going
   * through `renderChat`. `Tde` is the same element `renderChat` uses, so the permission chip
   * keeps its slot colour.
   */
  private footerRows(columns: number): string[] {
    this.documentRenderer ??= new TuiDocumentRenderer();
    return this.documentRenderer.renderElement(jsx(Tde, { width: columns, left: this.statusFooter(columns).map((part, index) =>
      typeof part === 'string'
        ? jsx(Do, { dimColor: true, children: part }, String(index))
        : jsx(n, { color: part.color, children: part.text }, String(index))) }, undefined), columns,
      { theme: this.theme.current, themeOverrides: this.theme.overrides }).map(row => row.ansi);
  }

  private statusHints(): string {
    return this.screen === 'transcript'
      ? 'ctrl+o chat  ctrl+e all  j/k scroll  q close'
      : 'ctrl+o transcript  ctrl+r search  ctrl+c interrupt';
  }

  /**
   * The footer row. Source `LVe` leads it with the permission-mode chip (`DR`, `jy` here) and
   * gives the right side one indicator from the `Ei` priority chain; the interrupt branch is the
   * only one whose data this terminal has, so running shows its chord and idle keeps the local
   * hints.
   */
  private statusFooter(columns: number): Array<string | FooterPart> {
    if(this.gestures.hint)return [this.gestures.hint.slice(0,columns)];
    const attachment = this.diffSelection.pending;
    if (attachment) return [pad(`${this.diffAttachmentFocused ? '> ' : ''}${attachment.lineCount} ${attachment.lineCount === 1 ? 'line' : 'lines'} from diff${attachment.filePath ? ` in ${attachment.filePath}` : ''}`, columns)];
    const hints = this.statusLineSetting && this.screen === 'chat' ? ''
      : this.running && this.screen === 'chat'
        ? `${chordForAction('app:interrupt', 'Global', 'ctrl+c')} to interrupt`
        : this.statusHints();
    // The hints are the part a person needs when they are lost, so they keep as
    // much room as they need up to half the row, and status text is clipped
    // into what is left rather than allowed to push the hints off the screen.
    const shown = hints.slice(0, Math.min(hints.length, Math.floor(columns / 2)));
    const chip = this.permissionMode === undefined ? '' : modeChip(this.permissionMode);
    // The footer's parts render through `Se`, which joins them with ` · `.
    const chipWidth = chip === '' ? 0 : cellWidth(chip) + 3;
    const left = `${this.running ? 'running' : 'ready'}${this.vimEnabled&&!this.statusLineSetting?.hideVimModeIndicator&&this.vim.mode!=='NORMAL'&&this.screen!=='search'?' -- '+this.vim.mode+' --':''}${this.status ? `  ${this.status}` : ''}`
      .slice(0, Math.max(0, columns - shown.length - chipWidth - 1));
    const gap = Math.max(1, columns - chipWidth - cellWidth(left) - shown.length);
    const parts: Array<string | FooterPart> = [];
    if (chip !== '') parts.push({ text: chip, color: modeColorSlot(this.permissionMode!) });
    parts.push(left + ' '.repeat(gap) + shown);
    return parts;
  }
}

const PREVIEW_BOX = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', teeL: '├', teeR: '┤' };
const PREVIEW_LIST_WIDTH = 30;
const PREVIEW_MIN_WIDTH = 40;

function previewGeometry(columns: number): { listWidth: number; previewLeft: number; previewWidth: number } {
  const config = layoutEngine.Config.create();
  const root = layoutEngine.Node.create(config);
  const list = layoutEngine.Node.create(config);
  const preview = layoutEngine.Node.create(config);
  root.insertChild(list, 0); root.insertChild(preview, 1);
  try {
    root.setWidth(columns); root.setFlexDirection(2); root.setGap(2, 4);
    list.setWidth(PREVIEW_LIST_WIDTH);
    preview.setFlexGrow(1); preview.setFlexShrink(1); preview.setMinWidth(PREVIEW_MIN_WIDTH + 4);
    root.calculateLayout(columns, undefined, 1);
    return { listWidth: list.getComputedWidth(), previewLeft: preview.getComputedLeft(), previewWidth: preview.getComputedWidth() };
  } finally { root.freeRecursive(); config.free(); }
}

/** Adapted from Nbe: hard wrap, minimum inner width, borders and hidden count. */
export function previewBox(content: string, maxLines: number, maxWidth: number): string[] {
  maxWidth = Math.max(4, Math.floor(maxWidth));
  maxLines = Math.max(0, Math.floor(maxLines));
  const inner = Math.max(1, maxWidth - 4);
  const lines: string[] = [];
  for (const raw of content.split('\n')) {
    let row = '', used = 0;
    for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(raw)) {
      const cells = cellWidth(segment);
      if (used + cells > inner && row) { lines.push(row); row = ''; used = 0; }
      row += segment; used += cells;
    }
    lines.push(row);
  }
  const hidden = Math.max(0, lines.length - maxLines);
  const shown = hidden ? lines.slice(0, maxLines) : lines;
  const widest = shown.reduce((max, line) => Math.max(max, cellWidth(line)), 0);
  const width = Math.max(4, Math.min(Math.max(PREVIEW_MIN_WIDTH, widest) + 4, maxWidth));
  const text = width - 4;
  const row = (line: string) => `${PREVIEW_BOX.v} ${pad(line, text)} ${PREVIEW_BOX.v}`;
  const out = [`${PREVIEW_BOX.tl}${PREVIEW_BOX.h.repeat(width - 2)}${PREVIEW_BOX.tr}`, ...shown.map(row)];
  if (hidden) {
    const label = `${PREVIEW_BOX.h.repeat(3)} ✂ ${PREVIEW_BOX.h.repeat(3)} ${hidden} lines hidden `;
    const note = cellWidth(label) <= width - 2 ? label : `${hidden} hidden`;
    const shownNote = pad(note, Math.min(cellWidth(note), width - 2));
    out.push(`${PREVIEW_BOX.teeL}${shownNote}${PREVIEW_BOX.h.repeat(width - 2 - cellWidth(shownNote))}${PREVIEW_BOX.teeR}`);
  }
  out.push(`${PREVIEW_BOX.bl}${PREVIEW_BOX.h.repeat(width - 2)}${PREVIEW_BOX.br}`);
  return out;
}

/** The startup header leads the scrollable log, so it scrolls with the transcript. */
function plainRow(ansi: string, columns: number): string {
  return pad(ansi.replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, ''), columns);
}

/** Pad or clip a screen row at grapheme boundaries to keep the frame aligned. */
export function pad(line: string, columns: number): string {
  let text = '', width = 0;
  for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(line)) {
    const cells = cellWidth(segment);
    if (width + cells > columns) break;
    text += segment; width += cells;
  }
  return text + ' '.repeat(Math.max(0, columns - width));
}

export function createTuiTerminal(options: TuiOptions): TuiTerminal { return new TuiTerminal(options); }
