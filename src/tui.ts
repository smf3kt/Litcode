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
import { Keymap, chordForAction, chordSequence, contextStack, keyName, type TuiContext } from './tui-keys.js';
import { HELP_FOOTER_HINT, HELP_HINT_MIN_COLUMNS } from './help-panel.js';
import { STASH_HINT_TIMEOUT_MS, STASH_RESTORED, STASH_RESTORED_TIMEOUT_MS, StashHintGate,
  hasUsedStash, markStashUsed, stashHintText } from './tui-stash.js';
import { BASH_STDERR_TAG, BASH_STDOUT_TAG, SHELL_MODE_LABEL, bashInputText, bashPointerMark,
  drainedShellRow, readBashInput, readBashResult, switchedToBash, type ComposerMode } from './tui-bash-mode.js';
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
import { terminalProgressMux, terminalProgressSequence, terminalProgressSupported,
  type TerminalProgressState } from './terminal-progress.js';
import { paintedDecorations, normalizedRuns, highlightRows, type DecorationRun, type PaintedDecorations, type PromptSegment } from './tui-input-decorations.js';
import { composerHighlights } from './tui-input-highlights.js';
import { Art } from './tui-input-highlights-source.js';
import { QLt, lbt, copySelectionText, selectionAutoCopy, selectionCopyFeedback, type SelectionKey } from './tui-selection-copy.js';
import { layoutEngine } from './tui-layout.js';
import { renderPreviewMarkdown } from './tui-markdown.js';
import { TuiRenderer, footerElement, type FooterPart, type FooterStatus, type PromptLine } from './tui-renderer.js';
import { backgroundFooterLabel } from './tui-background.js';
import { backgroundTaskRequest } from './tasks-panel.js';
import { taskDetailFrame, taskDetailRunning, type BackgroundTaskDetail } from './task-details.js';
import { agentTranscriptEntries, type AgentTranscript, type AgentViewHost } from './agent-transcript.js';
import { DiffPanel } from './diff-panel.js';
import { DiffSelectionOwner } from './diff-selection.js';
import { randomUUID } from 'node:crypto';
import { TuiDocumentRenderer } from './tui-document-renderer.js';
import { Welcome, welcomeDensity, WELCOME_ART_ROWS } from './tui-welcome.js';
import { OwlAnimation } from './tui-owl.js';
import { clt, tLo } from './tui-stream-preview.js';
import { Zqn, l$t } from './tui-preview-visibility.js';
import { inputCursor, layoutInput } from './tui-input-navigation.js';
import { InputUndo } from './tui-input-undo.js';
import { InputPaste, expandPastedText, referencedPastes, type InputSnapshot } from './tui-input-paste.js';
import { ThemeState, parseTheme, themeChoices, type ThemeSetting, type BuiltinTheme } from './tui-theme-state.js';
import { SystemThemeMonitor } from './tui-system-theme.js';
import { CustomThemeCatalog } from './tui-custom-themes.js';
import { ThemeEditor, themeFileWriter } from './theme-editor.js';
import { ThinkingProgress, type AgentProgressEvent, type TurnDuration } from './tui-progress.js';
import { beginSpinnerTipsStartup, SpinnerTips } from './spinner-tips.js';
import { defaultUserDir } from './config.js';
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
import { ultracodeTagText, ultracodeRevealIndex, ultracodeRevealDone, topBorderText as composerBorderRecord,
  ULTRA_TAG_FRAME } from './tui-composer-tag.js';
import { historyBorderText } from './tui-history-position.js';
import { effortIndicator, MAX_EFFORT_NOTE, type EffortLevel } from './effort-command.js';
import { maxEffortReminderEnabled, maxEffortTip } from './switch-confirm.js';
import { ModelPicker, modelPickerGuide } from './model-picker.js';
import { CopyPicker, type CopyPickerEffect } from './copy-picker.js';
import { TerminalNotifications, type NotificationChannel, type LocalNotification } from './terminal-notifications.js';
import { DEFAULT_IDLE_NOTIF_THRESHOLD_MS, IdleNotifier } from './idle-notification.js';
import { TerminalTitle } from './terminal-title.js';
import { ResumePicker, resumePickerGuide, resumeRelativeTime, RESUME_EMPTY_TEXT, resumeNoMatchText } from './resume-picker.js';
import { ConfigPanel, type ConfigPanelEffect, type ConfigRowId } from './config-panel.js';

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
import { editExternal, openExternalFile, externalEditorCommand, type EditorHandoff, type ExternalEditorResult } from './external-editor.js';
import { Ub as editorDisplayName } from './tui-editor-name-source.js';
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
import { s, n } from './tui-base-components.js';
import {
  createTranscriptState, layoutTranscript, renderedTranscriptRows, transcriptLines, wrapEntry,
  wrapEntryRows,
  type TranscriptEntry, type TranscriptScrollCommand, type TranscriptState, type RenderedRow,
} from './tui-transcript.js';
import { TranscriptScroll } from './tui-scroll.js';
import { toolResultRows, type ToolDisplayResult } from './tui-tool-result.js';
import {
  cellWidth, createEditorState, questionPreviewText, reduceEditor, reduceEditorWithUndo, TerminalKeyDecoder,
  type EditorAction, type EditorCommand, type EditorPolicy, type EditorState, type Keybindings, type TerminalCallbacks,
  type TerminalPromptAnswer, type TerminalPromptGroup, type TerminalPromptGroupAnswer,
  type TerminalPromptQueue, type TerminalPromptRequest, type TerminalQueuedPrompt,
} from './terminal.js';
import { keyboardCohesion } from './diff-dialog-frame-host.js';
import { applyReturnGesture } from './tui-input-return.js';

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
  copyOnSelect?: boolean;
  preferredNotifChannel?: NotificationChannel;
  /** `messageIdleNotifThresholdMs`: the idle-prompt notification's delay; absent means 60000. */
  messageIdleNotifThresholdMs?: number;
  autoScrollEnabled?: boolean;
  /** `/focus`: the brief transcript holds the streaming preview while tools run. */
  briefTranscript?: boolean;
  /** The live Verbose output switch at construction; Config and `/reload` update it through `setVerbose`. */
  verbose?: boolean;
  /** The Config "Terminal progress bar" row; default on, updated through `setTerminalProgressBar`. */
  terminalProgressBar?: boolean;
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
  submit: [text: string, attachment?: import('./terminal.js').PromptDiffSelection, mode?: ComposerMode]; interrupt: []; exit: []; pasteRejected: [bytes: number]; inputError: [error: Error];
  action: [action: string];
};

export type TuiScreen = 'chat' | 'transcript' | 'search' | 'dialog';

interface ActiveDialog {
  request: TerminalPromptRequest;
  themeEditor?: ThemeEditor;
  modelPicker?: { owner: ModelPicker; hitRows: Map<number, number>; pressed?: number };
  copyPicker?: { owner: CopyPicker; hitRows: Map<number, number>;
    pressed?: { index: number; row: number; activation: boolean } };
  configPanel?: { owner: ConfigPanel; hits: Map<number, { id: ConfigRowId; valueColumn: number }>;
    pressed?: { kind: 'row'; id: ConfigRowId; value: boolean } | { kind: 'search' };
    searchRows: Set<number>; pending?: Promise<void> };
  resumePicker?: { owner: ResumePicker; hits: Map<number, number> };
  backgroundFocusLost?: boolean;
  backgroundDetail?: { snapshot: BackgroundTaskDetail | undefined; timer?: ReturnType<typeof setInterval> };
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
  /** Pt/he's clock belongs to this modal and is cleared by finish. */
  adjustClock?: { startedAt: number; timer: ReturnType<typeof setInterval> };
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
  private footerPointer: { column: number; row: number; moved: boolean } | undefined;
  private readonly diffSelection = new DiffSelectionOwner(() => this.render());
  private footerSelection: 'tasks' | 'ideSelection' | null = null;
  private documentRenderer: TuiDocumentRenderer | undefined;
  private welcomeRenderer: TuiDocumentRenderer | undefined;
  private welcomeRows: string[] = [];
  private welcomeKey = '';
  private readonly owl = new OwlAnimation(() => this.render());
  private readonly messageRows = new WeakMap<TranscriptEntry, { columns: number; maxProseWidth?: number;
    syntaxHighlightingDisabled?: boolean; theme: BuiltinTheme; themeGeneration: number; progressGeneration: number;
    stamp?: string; detailed?: boolean; rows: RenderedRow[] }>();
  private readonly renderEntryRows = (entry: TranscriptEntry, columns: number): RenderedRow[] => {
    const document = entry.markdown !== undefined || entry.duration !== undefined;
    if (document && entry.streaming && !Zqn(this.prefersReducedMotion, this.windowsTerminal)) return [];
    if (entry.duration && !this.showTurnDuration) return [];
    // jw, 3gz7s57c [167024,183767), UTF-16: the transcript screen forces detailed rows; the
    // live screen takes only the Verbose switch.
    const detailed = this.verbose || this.screen === 'transcript';
    // jw/Dd, 3gz7s57c [168313,168319)/[107529,107778), UTF-16; raw entries remain available.
    if (!detailed && entry.loopFireId !== undefined && this.foldedLoopFires.has(entry.loopFireId)) return [];
    const stamp = this.entryStamp(entry);
    const cached = this.messageRows.get(entry);
    if (cached?.columns === columns && cached.maxProseWidth === this.maxProseWidth
      && cached.syntaxHighlightingDisabled === this.syntaxHighlightingDisabled
      && cached.theme === this.theme.current && cached.themeGeneration === this.theme.generation
      && cached.progressGeneration === this.progressGeneration && cached.stamp === stamp
      && cached.detailed === detailed) return cached.rows;
    this.documentRenderer ??= new TuiDocumentRenderer();
    // Source `hXe`/`wp` (chunk-phg89898.js 3761/3801): a drained result row is its two stream
    // blocks, not one bracketed string; the input row is the command alone behind its `! `.
    const bash = this.bashEntryRows(entry, columns);
    const body = bash ?? (entry.tool ? toolResultRows(entry.tool, detailed, columns)
      : entry.duration ? this.documentRenderer.renderElement(jsx(ProgressCompletion, {message:entry.duration, formatTime:this.timeFormatter.format}, entry.duration.uuid), columns,
      {theme:this.theme.current, themeOverrides:this.theme.overrides}) : document ? this.documentRenderer.renderMarkdown(entry.markdown ?? entry.text, columns,
      { speaker: entry.speaker, streaming: entry.streaming, messageKey: entry.messageKey,
        hideTrailingLine: entry.hideTrailingLine, maxProseWidth: this.maxProseWidth,
        syntaxHighlightingDisabled: this.syntaxHighlightingDisabled, theme: this.theme.current,
        themeOverrides: this.theme.overrides }) : wrapEntryRows(entry, columns));
    // Source `Va`: the stamp is its own dim row above the message, so it never reflows the body.
    const stampRows = stamp === '' ? [] : document
      ? this.documentRenderer.renderElement(jsx(n, {dimColor:true, children:stamp}, 'stamp'),
        columns, {theme:this.theme.current, themeOverrides:this.theme.overrides})
      : [{ text: stamp, continuation: false, indent: 0 }];
    const rows = [...stampRows, ...body];
    this.messageRows.set(entry, { columns, maxProseWidth: this.maxProseWidth,
      syntaxHighlightingDisabled: this.syntaxHighlightingDisabled, theme: this.theme.current,
      themeGeneration: this.theme.generation, progressGeneration:this.progressGeneration, stamp, detailed, rows });
    return rows;
  };

  /**
   * Source `umt` (chunk-phg89898.js 3225) and `Qi`/`wXe` (chunk-crw1fpdp.js 3923): the two row
   * shapes a drained command leaves. `umt` reads the `<bash-input>` tag back out and paints the
   * command behind a `bashBorder` `! `; `wp` splits the result row into its `<bash-stdout>` and
   * `<bash-stderr>` blocks, and the stdout block keeps the code-block style the source gives it.
   * A row that carries neither tag falls through to the ordinary wrappers.
   */
  private bashEntryRows(entry: TranscriptEntry, columns: number): RenderedRow[] | undefined {
    const command = readBashInput(entry.text);
    if (command !== null) {
      return this.bashTagRows(`${bashPointerMark()}${command}`, 'bashMessageBackgroundColor', columns);
    }
    if (!entry.text.startsWith(`<${BASH_STDOUT_TAG}`) && !entry.text.startsWith(`<${BASH_STDERR_TAG}`)) return undefined;
    const { stdout, stderr } = readBashResult(entry.text);
    const rows = this.bashTagRows(stdout, 'bashMessageBackgroundColor', columns);
    const error = stderr.trim();
    if (error !== '') rows.push(...this.bashTagRows(error, 'bashMessageBackgroundColor', columns, 'error'));
    return rows;
  }

  /** One painted block: the source's `backgroundColor`, `paddingRight: 1` row over the body. */
  private bashTagRows(text: string, background: string, columns: number, color?: string): RenderedRow[] {
    const rendered = this.documentRenderer!.renderElement(jsx(n, { color, backgroundColor: background,
      children: text }, 'bash'), columns, { theme: this.theme.current, themeOverrides: this.theme.overrides });
    return rendered.map(row => ({ text: row.text, ansi: row.ansi, continuation: row.continuation,
      indent: row.indent, end: row.end, elidedSeparator: row.elidedSeparator }));
  }

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
  /** v1e.Ks/A4, 24k7d6mw [786385,786417)/[1487552,1487705), UTF-16. */
  private readonly openBackgroundTasks = () => { this.emit('action', 'chat:openTasks'); };

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
  /** The loop's editable input queue; absent in the bare line-style terminals. */
  private promptQueue: TerminalPromptQueue | undefined;
  /** Source `queueEditIndex`: the queued prompt the up arrow has selected, or null. */
  private queueEditIndex: number | null = null;
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
  /**
   * Source `nf`/`fl` (chunk-24k7d6mw.js 868097) and its producer `Bo(!0)` (839453): a collapsed
   * paste of at most `fVe` characters raises the footer's `paste again to expand` row for 8000 ms.
   */
  private showExpandPasteHint = false;
  private readonly pasteOwner = new InputPaste(visible => {
    this.showExpandPasteHint = visible;
    // The paste path repaints itself once the draft lands; the 8000 ms timer does not, so only
    // that late call needs a frame of its own.
    if (!this.closed && !this.pasteOwner.pasting) this.render();
  });
  private readonly gestures = new InputGestures();
  private gestureHandling = false;
  private stashedDraft: InputSnapshot | undefined;
  /** Source `Yc` (chunk-24k7d6mw.js 828570): the draft-length gate behind the stash tip. */
  private readonly stashHint = new StashHintGate();
  private editorController: AbortController | undefined;
  private editorTask: Promise<ExternalEditorResult> | undefined;
  private editorDialog: ActiveDialog | undefined;
  private editorSuspended = false;
  /** Per-terminal focus state; close releases its rendering/clock subscribers. */
  private readonly focus = new TerminalFocus();
  private lastInteraction = Date.now();
  private readonly notifications = new TerminalNotifications(text => this.options.output.write(text),
    () => this.isTTY && this.started && !this.closed && !this.editorSuspended);
  /**
   * `_$`'s owner-supplied side (chunk-24k7d6mw.js 1691362): the idle machine reads the live turn,
   * the interaction clock, the dialog screen, the loop and quota guards, and the background-agent
   * registry. The terminal owns all but the last three, which the session owner binds.
   */
  private idleOwner: { send(): void; hasPendingLoopWakeup(): boolean; liveBackgroundAgents(): boolean;
    subscribeBackgroundAgents(listener: () => void): () => void } | undefined;
  private readonly terminalTitle = new TerminalTitle(sequence => this.options.output.write(sequence));
  private titleSession: import('./session.js').Session | undefined;
  private unsubscribeTitle: (() => void) | undefined;
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
  private readonly transcriptScroll = new TranscriptScroll();
  /** im/am/WO, 24k7d6mw [398352,399172)/[1305590,1309198), UTF-16; clear on exit/rebind/close. */
  private agentView: { host: AgentViewHost; snapshot: AgentTranscript; transcript: TranscriptState; feedback?: string } | undefined;
  private agentSubmit: Promise<void> | undefined;
  // Lns, j8hqhz0c [44085,44378), UTF-16: the selected conversation supplies loading.
  private get visibleRunning(): boolean { return this.agentView ? this.agentView.snapshot.status === 'running' : this.running; }
  // Zee/gie, 24k7d6mw [210978,211342), 3gz7s57c [185681,188242), UTF-16.
  private get visibleTranscript(): TranscriptState { return this.agentView?.transcript ?? this.transcript; }
  // WO, 24k7d6mw [1305590,1309198), UTF-16; the native viewport stores only the selected projection.
  private set visibleTranscript(value: TranscriptState) {
    if (this.agentView) this.agentView.transcript = value; else this.transcript = value;
  }
  private scrollPointer: { column: number; row: number; moved: boolean } | undefined;
  private mouseSeen = false;
  /** One provider response owns this cumulative raw source; end/close releases it. */
  private assistantMessage: { index?: number; source: string; key: string; startedAt: number } | undefined;
  private messageSequence = 0;
  private prefersReducedMotion: boolean | undefined;
  private showTurnDuration = true;
  /** Source `showMessageTimestamps`: stamp each message with its arrival time. */
  private showMessageTimestamps = false;
  /** Source `briefTranscript`: the fold that holds the in-flight preview during tool use. */
  private briefTranscript = false;
  private verbose = false;
  /** `progressBar`/`terminalProgressBarEnabled`: write OSC 9;4 while the agent runs. */
  private terminalProgressEnabled = true;
  private terminalProgressState: TerminalProgressState = null;
  private lastTerminalProgress = '';
  /** `/color`'s pick; `Mk`'s banner row exists only while this is set. */
  private sessionColor: SessionColor | undefined;
  private progressSettings: ProgressDisplaySettings = {};
  private spinnerTips: SpinnerTips | undefined;
  private spinnerTipsUserDir = '';
  private readonly spinnerTipsPending = new Set<Promise<void>>();
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
  /** Source `showDrainedShellLine`: the live row a running drained command owns. */
  private drainedShell: (import('./tools.js').ShellProgress & { verbose: boolean }) | undefined;
  private completedDuration: string | undefined;
  // Dd, 3gz7s57c [107529,107778), UTF-16; membership lasts until the next fire or session handoff.
  private loopFireId: string | undefined;
  private readonly foldedLoopFires = new Set<string>();
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
  private selectionState: SelectionState = createSelection();
  private copyOnSelect = true;
  private readonly selectionCopy = selectionAutoCopy({
    getState: () => this.renderer?.selectionInstance.selection.anchor
      ? this.renderer.selectionInstance.selection : { isDragging: this.selection.dragging },
    hasSelection: () => this.hasTextSelection(),
    copySelectionNoClear: () => this.copySelectionNoClear(),
  }, () => ({ copyOnSelect: this.copyOnSelect }), text => this.selectionCopied(text));
  private get selection(): SelectionState { return this.selectionState; }
  private set selection(value: SelectionState) {
    if (value === this.selectionState) return;
    this.selectionState = value;
    if (value.anchor === null) {
      this.selectionCopy.reset();
      this.renderer?.clearNativeSelection();
    } else this.selectionChanged();
  }
  private dialog: ActiveDialog | undefined;
  /** The grouped question dialog's AFK countdown, when the host enables it. */
  private afk: DialogAfk | undefined;
  private status = '';
  private running = false;
  /** The completion stamp `_$` reads as `lastQueryCompletionTime`; 0 before the first finished turn. */
  private queryCompletionTime = 0;
  /** The turn count `_$` reads as `submitCount`; 0 before the first submitted turn. */
  private submittedTurns = 0;
  /** `_$` itself (chunk-24k7d6mw.js 76055); bound once the owner installs its send path. */
  private idleNotification: IdleNotifier | undefined;
  /** Composer gates `dg()` and `C7t()`: on until the session settings say otherwise. */
  private workflowKeywordAvailable = true;
  private workflowKeywordTriggerEnabled = true;
  /**
   * Source `Va`/`mn` and `ff=!Ii&&VC(Va,mn)` (chunk-24k7d6mw.js 866311/866374/893703): the
   * composer's top-border `ultracode` tag. `Ii` is `isBriefOnly && !viewingAgentTaskId`; this host
   * has no agent view, so the brief transcript stands in for it. `revealStart` is `oee`'s clock.
   */
  private ultracodeTagGates = { ultracode: false, workflows: true, modelSupportsUltracode: true };
  private ultraTagRevealStart: number | undefined;
  private ultraTagTimer: ReturnType<typeof setInterval> | undefined;
  /** Source `Kl().emojiCompletionEnabled !== false`: the `:name:` typeahead is on by default. */
  private emojiCompletionEnabled = true;
  /**
   * Source `bZ` (chunk-24k7d6mw.js 84911) and `QE` (815713): the composer's bash mode. A `!` typed
   * into an empty composer, or prepended with the caret at 0, turns the draft into a shell
   * command; submitting, Escape, or backspace/delete/ctrl+u at caret 0 returns it to prompt mode.
   * The draft carries no `!` itself, so the pointer (`uT`) and the border (`Rzt`) are the mode's
   * only surface on the row.
   */
  private composerMode: ComposerMode = 'prompt';
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
  /** `Ix` is the effect's dependency; expiry clears the active slot without changing that key. */
  private effortFeedbackLevel: EffortLevel | undefined;
  private effortFeedbackLabel: string | undefined;
  private effortFeedback: { text: string; timer: ReturnType<typeof setTimeout> } | undefined;
  private externalEditorHintCommand: string | undefined;
  private externalEditorHintEligible = false;
  private externalEditorHintTimer: ReturnType<typeof setTimeout> | undefined;
  /** Host-bound live background count and stop action for the kill chord. */
  private backgroundWorkProbe: (() => number) | undefined;
  private backgroundTasksProbe: (() => import('./tasks-panel.js').BackgroundTaskSnapshot) | undefined;
  private backgroundWorkStop: (() => void) | undefined;
  /** Source `go.current`: the last kill-chord press while a confirmation is armed. */
  private killAgentsArmed: number | undefined;
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
    this.copyOnSelect = options.copyOnSelect !== false;
    this.notifications.setChannel(options.preferredNotifChannel);
    this.transcriptScroll.setEnabled(options.autoScrollEnabled);
    this.briefTranscript = options.briefTranscript === true;
    this.verbose = options.verbose === true;
    this.terminalProgressEnabled = options.terminalProgressBar !== false;
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
    // Source `R(Io.length)` at the composer's mount: both counters start at the draft length.
    this.stashHint.observe(this.editor.text.length);
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
    if (this.searchSessionId !== session.id) this.clearAgentView();
    this.unsubscribeTitle?.(); this.titleSession = session;
    this.unsubscribeTitle = session.subscribeTitle(() => this.syncTerminalTitle());
    this.syncTerminalTitle();
    const generation = ++this.historyBinding;
    this.selection = createSelection();
    this.clearStatusNotice('selection-copied');
    this.setCopyOnSelect(session.config.copyOnSelect);
    this.setNotificationChannel(session.config.preferredNotifChannel);
    this.setAutoScrollEnabled(session.config.autoScrollEnabled);
    if (this.searchSessionId !== session.id) { this.transcriptScroll.reset(); this.scrollPointer = undefined; }
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
    this.diffPointer = undefined; this.diffSelection.dismiss(); this.footerSelection = null;
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

  /** p4.onUserRowLanded, 24k7d6mw [1333944,1336535), UTF-16; the terminal owns projected rows. */
  append(entry: TranscriptEntry): void {
    this.transcript = { ...this.transcript, entries: [...this.transcript.entries,
      { ...entry, timestamp: entry.timestamp ?? Date.now(), ...(this.loopFireId ? { loopFireId: this.loopFireId } : {}) }] };
    if (entry.kind === 'user') this.transcriptScroll.onUserRowLanded(false);
    this.render();
  }

  /** v/RRn/Dd, appb2dtz [16667,17235), sfn1dbxq [4502962,4503404), 3gz7s57c [107529,107778), UTF-16. */
  scheduledFire(marker: import('./loop-noop-fold.js').ScheduledFire): void {
    for (const id of marker.foldedFireIds ?? []) this.foldedLoopFires.add(id);
    this.loopFireId = marker.uuid;
    // gie, 3gz7s57c [185681,188242), UTF-16: hidden main markers preserve the focused child's selection.
    if (!this.agentView) this.selection = createSelection();
    this.append({ kind: 'system', text: marker.content, timestamp: Date.parse(marker.timestamp) });
  }

  resetLoopSpan(): void { this.loopFireId = undefined; }

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

  /** Zie/hx, 7tnkhv2k [3072,3957)/[2859,2908), UTF-16: the same selection opens existing files. */
  async openFile(file: string, signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult> {
    if (!this.isTTY || !this.started || this.closed || this.running || this.dialog || this.editorController) return {content:null};
    this.sourceSearch?.cancel();
    this.sourcePicker?.cancel();
    const controller=new AbortController();this.editorController=controller;
    const handoff=this.editorHandoff();
    const task = openExternalFile(file,handoff,AbortSignal.any([signal,controller.signal]),workspace,
      {command:this.externalEditorHintCommand})
      .then(result => controller.signal.aborted ? {content:null} : result)
      .finally(() => {
        if(this.editorSuspended)handoff.resume();
        if(this.editorController===controller){this.editorController=undefined;this.editorTask=undefined;this.editorDialog=undefined;}
      });
    this.editorTask=task;
    return task;
  }

  /** $j/Zie/hx, 7tnkhv2k [3072,3957)/[2859,2908), UTF-16: reuse the hint's mounted selection. */
  private handoffEditor(snapshot: Parameters<typeof editExternal>[0], signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult> {
    const controller=new AbortController();this.editorController=controller;
    const handoff=this.editorHandoff();
    const task = editExternal(snapshot,handoff,AbortSignal.any([signal,controller.signal]),workspace,
      {command:this.externalEditorHintCommand})
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
      this.editorSuspended=true;this.syncTerminalTitle();this.syncOwl(false);this.options.input.off('data',this.onData);this.options.input.pause();
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
        this.replaceDraft({...this.editor,text:raw,pastedContents,historyIndex:this.editor.history.length,historyDraft:raw,historyDraftPastes:pastedContents});
      },offset:cursor=>{this.editor={...this.editor,cursor};},register:text=>expandPastedText(text,this.editor.pastedContents),
      fallback:event=>{if(action.type==='insert')this.dispatch({type:'insert',text:event.key});
        else if(action.type==='key'){if(action.command)this.dispatch({type:action.command});else if(/^[^\u0000-\u001f]+$/u.test(event.key))this.dispatch({type:'insert',text:event.key});}
        else this.dispatch(action);},undo:()=>this.dispatch({type:'undo'}),
      history:direction=>this.dispatch({type:direction<0?'up':'down'}),search:()=>this.enterSearch(),
    };
    try{this.vim.key(key,bridge);}finally{this.vimHandling=false;}this.render();return true;
  }

  /** Source `Er` subscription: the loop hands the composer its editable queue. */
  bindPromptQueue(queue: TerminalPromptQueue): void {
    this.promptQueue = queue;
    this.render();
  }

  /** Jr/pz, 24k7d6mw at 435644 and [740155,740694), UTF-16: live owner readers. */
  bindBackgroundWork(probe: () => number, stop: () => void,
    tasks?: () => import('./tasks-panel.js').BackgroundTaskSnapshot): void {
    this.backgroundWorkProbe = probe;
    this.backgroundWorkStop = stop;
    this.backgroundTasksProbe = tasks;
    this.render();
  }

  /** pz's V(XVt) subscription, 24k7d6mw [740155,740694), UTF-16. */
  backgroundWorkChanged(): void {
    this.refreshBackgroundDialog();
    this.refreshAgentView();
    this.render();
  }

  // im/am/Zee/WO, 24k7d6mw [398352,399172)/[210978,211342)/[1305590,1309198), UTF-16.
  viewAgent(host: AgentViewHost): void {
    const snapshot = host.read();
    if (this.closed || snapshot === undefined) { host.release(); return; }
    this.clearAgentView();
    this.agentView = { host, snapshot, transcript: createTranscriptState(agentTranscriptEntries(snapshot)) };
    this.selection = createSelection(); this.scrollPointer = undefined;
    this.renderer?.selectionInstance.clearTextSelection(); this.selectionCopy.reset();
    this.transcriptScroll.reset(); this.transcriptScroll.repin(true);
    this.render();
  }

  // am/WO, 24k7d6mw [398888,399172)/[1305590,1309198), UTF-16.
  clearAgentView(): void {
    const view = this.agentView;
    if (view === undefined) return;
    this.agentView = undefined;
    view.host.release();
    this.selection = createSelection(); this.scrollPointer = undefined;
    this.renderer?.selectionInstance.clearTextSelection(); this.selectionCopy.reset();
    this.transcriptScroll.reset(); this.transcriptScroll.repin(true);
    if (!this.closed) this.render();
  }

  // Zee/OCe, 24k7d6mw [210978,211342)/[1501794,1502367), UTF-16.
  private refreshAgentView(): void {
    const view = this.agentView;
    if (view === undefined) return;
    const snapshot = view.host.read();
    if (snapshot === undefined) { this.clearAgentView(); return; }
    view.snapshot = snapshot;
    view.transcript = { ...view.transcript, entries: agentTranscriptEntries(snapshot) };
  }

  // N4.submitToAgent/JYe, 24k7d6mw [1497670,1498885)/[875160,878682), UTF-16.
  private submitToViewedAgent(): void {
    const view = this.agentView;
    if (view === undefined || this.agentSubmit !== undefined) return;
    const draft = { text: this.editor.text, cursor: this.editor.cursor,
      pastedContents: structuredClone(this.editor.pastedContents) };
    const transition = reduceEditor(this.editor, { type: 'submit' }, this.options);
    const submitted = transition.effects.find(effect => effect.type === 'submit');
    if (submitted === undefined) return;
    const current = () => !this.closed && this.agentView === view && this.editor.text === draft.text
      && this.editor.cursor === draft.cursor && JSON.stringify(this.editor.pastedContents) === JSON.stringify(draft.pastedContents);
    const work = view.host.submit(submitted.text, current).then(destination => {
      if (!destination || !current()) return;
      if (typeof destination === 'object') { view.feedback = destination.text; this.render(); return; }
      view.feedback = undefined;
      this.inputHistory.add({ display: draft.text, pastedContents: draft.pastedContents });
      this.undo.clear(); this.replaceDraft(transition.state); this.setComposerMode('prompt'); this.vim.reset();
      if (destination === 'main') this.transcript = { ...this.transcript, entries: [...this.transcript.entries,
        { kind: 'user', text: submitted.text, timestamp: Date.now() }] };
      this.refreshAgentView(); this.render();
    }).catch(error => { if (!this.closed) this.setStatus(error instanceof Error ? error.message : String(error)); })
      .finally(() => { if (this.agentSubmit === work) this.agentSubmit = undefined; });
    this.agentSubmit = work;
  }

  /** Source store subscription: a changed queue repaints the hint and clamps a stale index. */
  promptQueueChanged(): void {
    if (this.closed) return;
    this.syncQueueSelection();
    this.render();
  }

  /** Source `js`: the selection follows the queue, clearing at zero and clamping to the last row. */
  private syncQueueSelection(): void {
    if (this.queueEditIndex === null) return;
    const count = this.promptQueue?.snapshot().length ?? 0;
    if (count === 0) this.queueEditIndex = null;
    else if (this.queueEditIndex > count - 1) this.queueEditIndex = count - 1;
  }

  /**
   * Source `gpe`: the empty composer's placeholder. `Psr()` (`tengu_jiggly_mochi`) is false in this
   * artifact, so the send-now wording is unreachable, and the `queuedCommandUpHintCount` cap never
   * advances because this artifact has no writer for it.
   */
  private queuePlaceholder(): string | undefined {
    if (this.editor.text !== '' || (this.promptQueue?.snapshot().length ?? 0) === 0) return undefined;
    if (this.queueEditIndex !== null) return this.queueEditIndex === 0
      ? 'Press Enter to edit the selected message, or up again for history'
      : 'Press Enter to edit the selected message, or up again for an older one';
    return keyboardCohesion() ? 'Press up to select a queued message, then Enter to edit it'
      : 'Press up to edit queued messages';
  }

  /**
   * Source `Gv`/`bS`: up and down over the queued prompts. The gesture only runs with the caret on
   * the draft's first line and with the suggestion list not holding more than one row. With the
   * cohesion flag off, up pulls every editable queued prompt into the draft (`yS`) instead of
   * selecting one, and a failed pull falls through to ordinary history.
   */
  private handleQueueKey(direction: 'up' | 'down'): boolean {
    const queue = this.promptQueue;
    if (queue === undefined) return false;
    this.syncQueueSelection();
    const newline = this.editor.text.indexOf('\n');
    if (newline !== -1 && this.editor.cursor > newline) return false;
    if (this.autocompleteState().suggestions.length > 1) return false;
    const count = queue.snapshot().length;
    if (!keyboardCohesion()) {
      if (direction === 'down' || count === 0) return false;
      return this.popAllQueuedPrompts();
    }
    if (direction === 'up') {
      if (this.queueEditIndex === null) {
        if (count === 0) return false;
        this.queueEditIndex = count - 1;
        this.render(); return true;
      }
      if (this.queueEditIndex > 0) { this.queueEditIndex -= 1; this.render(); return true; }
      // The oldest row is the end of the selection; the source then runs history up.
      this.queueEditIndex = null; this.render(); return false;
    }
    if (this.queueEditIndex === null) return false;
    if (this.queueEditIndex < count - 1) this.queueEditIndex += 1;
    else this.queueEditIndex = null;
    this.render(); return true;
  }

  /** Source `Zm`: pull every editable queued prompt into the draft; false when nothing popped. */
  private popAllQueuedPrompts(): boolean {
    // `zMe(entry, value === "")`: the batch may include shell entries only into an empty draft.
    const pulled = this.promptQueue?.popAll(this.editor.text === '');
    if (pulled === undefined) return false;
    // Source `pi` (chunk-sfn1dbxq.js 235258): the pulled batch's mode is `bash` only when every
    // entry was one; the draft it lands in was empty on this path.
    this.setComposerMode(pulled.mode ?? 'prompt');
    this.replaceDraftFromQueue(pulled);
    return true;
  }

  /** Source `cg`/`dl`: the selected prompt replaces the draft and leaves the queue. */
  private popSelectedQueuedPrompt(): boolean {
    this.syncQueueSelection();
    const index = this.queueEditIndex;
    if (index === null) return false;
    // Source `zE`'s pull path (chunk-24k7d6mw.js 872404): a shell entry needs an empty draft,
    // because the pulled command has to land in a composer that is in bash mode.
    const modes = this.promptQueue?.modes?.();
    const mode = modes?.[index];
    if (mode === 'bash' && this.editor.text !== '') {
      this.queueEditIndex = null;
      this.showStatusNotice('queue-pull-needs-empty-input',
        'Clear the input to edit this queued shell command', 2_000);
      return true;
    }
    this.queueEditIndex = null;
    const pulled = this.promptQueue?.pop(index);
    // A stale index is the source's `stale_index` arm: the key is consumed but nothing submits.
    if (pulled === undefined) { this.render(); return true; }
    // Source `po(_c.mode)`: the pulled entry's own mode becomes the composer's.
    this.setComposerMode(pulled.mode ?? 'prompt');
    this.replaceDraftFromQueue(pulled);
    return true;
  }

  /** Source `Wct`: the pulled queue text goes above the draft; the caret follows the draft.
   *  Source `returnIdeSelection` restores the queued IDE selection; locally that is the diff
   *  attachment, and only while it still names the mounted diff panel's session. */
  private replaceDraftFromQueue(pulled: TerminalQueuedPrompt): void {
    // The same out-of-band replacement the paste path announces: Vim's anchor and undo snapshot
    // must not survive a pull that rewrote the draft under it.
    this.vim.externalMutation();
    const draft = this.editor.text;
    const queueText = pulled.text;
    const text = draft === '' ? queueText : `${queueText}\n${draft}`;
    const cursor = draft === '' ? text.length : queueText.length + 1 + this.editor.cursor;
    this.replaceDraft({ ...this.editor, text, cursor, historyIndex: this.editor.history.length,
      historyDraft: text, historyDraftPastes: this.editor.pastedContents });
    if (pulled.attachment !== undefined && (this.diffPanel === undefined
      || pulled.attachment.sessionId === this.diffPanel.sessionId))
      this.diffSelection.set(pulled.attachment.selection);
    else this.diffSelection.dismiss();
    this.publishDraft();
    this.render();
  }

  private handleGesture(key:'interrupt'|'eof'|'escape'):void{
    this.gestureHandling=true;
    try{this.gestures.key(key,{text:this.editor.text,pastedContents:structuredClone(this.editor.pastedContents),
      clear:()=>{this.undo.clear();this.vim.reset();this.replaceDraft({...createEditorState(this.editor.history),historyPastes:this.editor.historyPastes,killRing:this.editor.killRing});},
      delete:()=>this.dispatch({type:'delete'}),exit:()=>{this.close();this.emit('exit');},
      history:(text,contents)=>{this.inputHistory.add({display:text,pastedContents:contents});const limit=Math.max(0,this.options.historyLimit??100);if(limit)this.editor={...this.editor,
        history:[...this.editor.history,text].slice(-limit),historyPastes:[...this.editor.historyPastes,structuredClone(contents)].slice(-limit)};},
      hint:()=>this.render()});}finally{this.gestureHandling=false;}
    this.render();
  }

  setRunning(running: boolean): void {
    this.running = running;
    // `_$`'s turn snapshot (chunk-24k7d6mw.js 76055): a new submit bumps `submitCount`; a finished
    // turn stamps `lastQueryCompletionTime`, which is what re-arms the idle notification.
    if (running) this.submittedTurns += 1;
    else if (this.submittedTurns > 0) this.queryCompletionTime = Date.now();
    this.idleNotification?.refresh();
    this.spinnerTips?.setActive(running);
    if (!running) { this.progress.stop(); this.diffPanel?.refresh(); }
    this.dispatch({ type: 'running', value: running });
  }

  setProgress(event: AgentProgressEvent): void {
    if (this.closed) return;
    if (event.kind === 'start') { this.spinnerTips?.start(); this.progress.start(event.uuid, event.startedAt); }
    else if (event.kind === 'phase') {
      if (!this.progress.mode(event.mode)) return;
      // Source `Ue`: while the fold holds, the streaming block is not rendered. The entry
      // painted before the tool started is taken back off the transcript; the source text
      // stays in `assistantMessage`, so the paint that ends the fold re-appends it.
      if (this.holdsFocusPreview()) this.hideStreamingPreview();
    }
    else {
      this.progress.stop(); this.spinnerTips?.finish();
      if (event.reason !== 'error' && event.reason !== 'aborted') this.restoreTurnDuration(event.duration);
    }
    // `qa`/`om` (3gz7s57c [138656,139637)): any active agent work is indeterminate;
    // the idle state clears the terminal's progress indicator.
    this.setTerminalProgress(event.kind === 'start' ? 'indeterminate'
      : event.kind === 'finish' ? 'completed' : this.terminalProgressState);
    this.render();
  }

  /** `progressBar`'s live switch: disabling clears any indicator already on screen. */
  setTerminalProgressBar(enabled: boolean): void {
    if (enabled === this.terminalProgressEnabled) return;
    this.terminalProgressEnabled = enabled;
    if (!enabled) { if (this.lastTerminalProgress !== '') this.emitTerminalProgress('completed', 0, true); }
    else if (this.progress.running) this.emitTerminalProgress('indeterminate', 0, true);
    // `qa` recomputes on the enabled change; idle resolves to completed, which clears.
    else this.emitTerminalProgress('completed', 0, false);
  }

  /** One agent-progress state; the terminal gate and the live switch decide the write. */
  setTerminalProgress(state: TerminalProgressState, percent = 0): void {
    this.terminalProgressState = state;
    this.emitTerminalProgress(state, percent, false);
  }

  private emitTerminalProgress(state: TerminalProgressState, percent: number, force: boolean): void {
    if (!this.isTTY || (!force && !this.terminalProgressEnabled)) return;
    // `s7e` gates on the stdout TTY, which is the stream this writer uses.
    if (!terminalProgressSupported(this.options.output.isTTY === true)) return;
    const sequence = terminalProgressSequence(state, percent, { mux: terminalProgressMux() });
    if (sequence === this.lastTerminalProgress) return;
    this.lastTerminalProgress = sequence;
    this.options.output.write(sequence);
  }

  private hideStreamingPreview(): void {
    const message = this.assistantMessage;
    if (!message || message.index === undefined) return;
    const entries = this.transcript.entries.filter(entry => !(entry.streaming && entry.messageKey === message.key));
    if (entries.length === this.transcript.entries.length) return;
    this.transcript = { ...this.transcript, entries };
    message.index = undefined;
    // gie, 3gz7s57c [185681,188242), UTF-16: the hidden main projection has no selected child rows.
    if (!this.agentView) this.selection = createSelection();
  }

  /** nmt/followGrowth, 3gz7s57c [29232,37785), UTF-16; the flag preserves existing sticky state. */
  setAutoScrollEnabled(value?: boolean): void {
    this.transcriptScroll.setEnabled(value);
    this.render();
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

  setNotificationChannel(value?: NotificationChannel): void { this.notifications.setChannel(value); }
  notifyLocal(notification: LocalNotification, signal: AbortSignal): Promise<string> { return this.notifications.send(notification, signal); }
  lastInteractionTime(): number { return this.lastInteraction; }
  /** `_$`'s `setLocalOverlayShowing`: this renderer's dialog screen and its keyed notices are the
   *  overlays that sit over the composer (chunk-24k7d6mw.js 1691779). */
  composerOverlayShowing(): boolean { return this.screen !== 'chat' || this.dialog !== undefined; }

  /**
   * Bind the idle-prompt machine's owner side and start it. `send` is the source's
   * `sendIdleNotification` (`YD({message:"Claude is waiting for your input",
   * notificationType:"idle_prompt"})`, chunk-24k7d6mw.js 1691362); `hasPendingLoopWakeup` is `BG`
   * (chunk-68g5e6vr.js 4875); `hasArmedQuotaAutoResume` is `tz` (chunk-9sq8whr4.js 3981), which has
   * no counterpart here because this host arms no quota auto-resume.
   */
  bindIdleNotification(owner: { send(): void; hasPendingLoopWakeup(): boolean; liveBackgroundAgents(): boolean;
    subscribeBackgroundAgents(listener: () => void): () => void }): void {
    this.idleOwner = owner;
    this.idleNotification?.dispose();
    this.idleNotification = new IdleNotifier({
      now: () => Date.now(),
      setTimeout: (callback, milliseconds) => {
        const timer = setTimeout(callback, milliseconds); timer.unref?.();
        return { cancel: () => clearTimeout(timer) };
      },
      snapshot: () => ({ isLoading: this.running, submitCount: this.submittedTurns,
        lastQueryCompletionTime: this.queryCompletionTime }),
      lastInteractionTime: () => this.lastInteraction,
      isDialogOnScreen: () => this.dialog !== undefined,
      hasPendingLoopWakeup: () => this.idleOwner?.hasPendingLoopWakeup() ?? false,
      hasArmedQuotaAutoResume: () => false,
      liveBackgroundAgents: () => this.idleOwner?.liveBackgroundAgents() ?? false,
      subscribeBackgroundAgents: listener => this.idleOwner?.subscribeBackgroundAgents(listener) ?? (() => {}),
      // `yEo` (chunk-24k7d6mw.js 1679555): `ce().messageIdleNotifThresholdMs`, default 60000.
      thresholdMs: () => this.options.messageIdleNotifThresholdMs ?? DEFAULT_IDLE_NOTIF_THRESHOLD_MS,
      send: () => this.idleOwner?.send(),
    });
  }

  setCopyOnSelect(value?: boolean): void {
    const enabled = value !== false;
    if (this.copyOnSelect === enabled) return;
    this.copyOnSelect = enabled;
    this.render();
  }

  /** Source `vNt`'s `focusFoldHoldsPreview`, live half: `/focus` toggles the fold. */
  setBriefTranscript(enabled: boolean): void {
    if (enabled === this.briefTranscript) return;
    const tagWasVisible = this.ultracodeTagVisible();
    this.briefTranscript = enabled;
    this.refreshEffortFeedback();
    // `Ii` is the `!` operand of the tag's gate, so leaving the fold starts the reveal afresh.
    if (!tagWasVisible && this.ultracodeTagVisible()) this.startUltracodeTagReveal();
    else if (tagWasVisible && !this.ultracodeTagVisible()) this.stopUltracodeTagReveal();
    // Leaving focus re-paints the preview the fold was holding back.
    if (!enabled) this.paintAssistantPreview();
    this.render();
  }

  /** `Te`'s live half: the Config row's switch turns full tool rows on or off in place. */
  setVerbose(enabled: boolean): void {
    if (enabled === this.verbose) return;
    this.verbose = enabled;
    this.selection = createSelection();
    this.render();
  }

  /** One finished tool call, shown as summary rows or detailed rows under the Verbose switch. */
  appendToolResult(result: ToolDisplayResult): void {
    this.append({ kind: 'tool', text: '', tool: result });
  }

  /**
   * Source `processBashCommand` 14067 and `Qi`/`wXe` (chunk-phg89898.js 3881): the result row a
   * drained command leaves. The command's own `<bash-input>` row went in at submit; this is the
   * `<bash-stdout>`/`<bash-stderr>` pair, which the row renderer splits back into its two streams.
   */
  appendBashResult(result: string): void {
    this.append({ kind: 'system', text: result });
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

  bindSpinnerTips(session: import('./session.js').Session): void {
    if (this.closed || !this.spinnerTips && !session.config.spinnerTipsLayers?.length) return;
    const userDir = path.resolve(session.config.configSources?.userDir ?? this.options.userDir ?? defaultUserDir());
    if (this.spinnerTipsUserDir !== userDir) {
      this.spinnerTips?.close();
      const retired = this.spinnerTips?.flush();
      if (retired) {
        this.spinnerTipsPending.add(retired);
        void retired.finally(()=>this.spinnerTipsPending.delete(retired));
      }
      this.spinnerTips = undefined; this.spinnerTipsUserDir = userDir;
      this.progress.tip(undefined);
    }
    if (!this.spinnerTips) {
      const history = beginSpinnerTipsStartup(userDir);
      this.spinnerTips = new SpinnerTips(()=>beginSpinnerTipsStartup(userDir), tip=>{ if (!this.closed) { this.progress.tip(tip); this.render(); } },
        message=>{ if (!this.closed) this.setStatus(message); });
      const startup = history.then(()=>{},error=>{ if (!this.closed) this.setStatus(`Spinner Tips history: ${String(error)}`); });
      this.spinnerTipsPending.add(startup);
      void startup.finally(()=>this.spinnerTipsPending.delete(startup));
      this.spinnerTips.setActive(this.running);
    }
    this.spinnerTips.bind(session.id, session.config.spinnerTipsEnabled, session.config.spinnerTipsLayers);
  }
  async flushSpinnerTips(): Promise<void> {
    await Promise.all([...this.spinnerTipsPending, this.spinnerTips?.flush()]);
  }

  setProgressSettings(settings: ProgressDisplaySettings): void {
    if (this.closed || JSON.stringify(this.progressSettings) === JSON.stringify(settings)) return;
    this.progressSettings = structuredClone(settings); this.timeFormatter = progressTime(this.progressSettings);
    this.progress.setVerbs(settings.spinnerVerbs); this.progressGeneration++;
    this.selection = createSelection();
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
    // `Eu()` short-circuits `oee`'s clock: with motion reduced the tag never reveals.
    if (value === true) this.stopUltracodeTagReveal();
    else if (this.ultracodeTagVisible()) this.startUltracodeTagReveal();
    this.progress.setReducedMotion(value === true);
    this.previewStore.setRaw(Zqn(value, this.windowsTerminal) ? this.previewCoalescer.peek() : null);
    if (this.assistantMessage && this.previewStore.getDerived().displayed !== null) this.paintAssistantPreview();
    else { this.selection = createSelection(); this.render(); }
  }

  setMaxProseWidth(value?: number): void {
    if (this.maxProseWidth === value) return;
    this.maxProseWidth = value;
    this.selection = createSelection();
    this.render();
  }

  setSyntaxHighlightingDisabled(value?: boolean): void {
    if (this.syntaxHighlightingDisabled === value) return;
    this.syntaxHighlightingDisabled = value;
    this.selection = createSelection();
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

  /**
   * The composer tag's live inputs: `Va` (`ultracode`), the `dg()` half of `ZI`, and this host's
   * stand-in for the model's `xhigh` support. The `oee` clock starts when the tag first has a
   * reason to draw and stops itself `vkt` frames later; the tag then stands plain.
   */
  setUltracodeTag(settings: { ultracode: boolean; workflows: boolean; modelSupportsUltracode?: boolean }): void {
    const next = { ultracode: settings.ultracode, workflows: settings.workflows,
      modelSupportsUltracode: settings.modelSupportsUltracode !== false };
    const same = this.ultracodeTagGates.ultracode === next.ultracode
      && this.ultracodeTagGates.workflows === next.workflows
      && this.ultracodeTagGates.modelSupportsUltracode === next.modelSupportsUltracode;
    if (same) return;
    const wasVisible = this.ultracodeTagVisible();
    this.ultracodeTagGates = next;
    this.refreshEffortFeedback();
    if (!this.ultracodeTagVisible()) { this.stopUltracodeTagReveal(); this.render(); return; }
    if (!wasVisible) this.startUltracodeTagReveal();
    this.render();
  }

  /** `ff = !Ii && VC(Va, mn)`: the brief transcript stands in for `isBriefOnly`. */
  private ultracodeTagVisible(): boolean {
    const { ultracode, workflows, modelSupportsUltracode } = this.ultracodeTagGates;
    return !this.briefTranscript && ultracode && workflows && modelSupportsUltracode;
  }

  private startUltracodeTagReveal(): void {
    this.stopUltracodeTagReveal();
    if (this.prefersReducedMotion) return;
    this.ultraTagRevealStart = Date.now();
    const timer = setInterval(() => {
      if (this.closed || this.ultraTagRevealStart === undefined) { this.stopUltracodeTagReveal(); return; }
      if (ultracodeRevealDone(this.ultraTagRevealStart, Date.now())) this.stopUltracodeTagReveal();
      this.render();
    }, ULTRA_TAG_FRAME);
    timer.unref?.();
    this.ultraTagTimer = timer;
  }

  private stopUltracodeTagReveal(): void {
    if (this.ultraTagTimer !== undefined) clearInterval(this.ultraTagTimer);
    this.ultraTagTimer = undefined;
    this.ultraTagRevealStart = undefined;
  }

  /** `bf=tRe??Vo`, chunk-24k7d6mw.js [853051,853071), UTF-16: history wins over the tag. */
  private composerBorderText(): ReturnType<typeof composerBorderRecord> | ReturnType<typeof historyBorderText> {
    if (this.screen === 'chat') {
      const history = historyBorderText(this.editor);
      if (history !== undefined) return history;
    }
    if (!this.ultracodeTagVisible()) return undefined;
    const index = ultracodeRevealIndex(this.ultraTagRevealStart, Date.now());
    const open = slotForeground(this.themeSlot('effortUltra'));
    const paint = (text: string) => open === '' ? text : open + text + '\u001b[39m';
    return composerBorderRecord([ultracodeTagText(true, index, paint)]);
  }

  /** `Ix` effect, chunk-24k7d6mw.js [894148,894249), UTF-16. */
  setEffortFeedback(level: EffortLevel): void {
    this.effortFeedbackLevel = level;
    if (this.refreshEffortFeedback()) this.render();
  }

  private refreshEffortFeedback(): boolean {
    const label = effortIndicator(this.briefTranscript ? undefined : this.effortFeedbackLevel,
      false, this.ultracodeTagVisible());
    if (label === this.effortFeedbackLabel) return false;
    this.effortFeedbackLabel = label;
    this.clearEffortFeedback();
    if (this.closed || label === undefined) return true;
    const timer = setTimeout(() => {
      this.effortFeedback = undefined;
      if (!this.closed) this.render();
    }, 10_000);
    timer.unref?.();
    this.effortFeedback = { text: label, timer };
    return true;
  }

  private clearEffortFeedback(): void {
    if (this.effortFeedback !== undefined) clearTimeout(this.effortFeedback.timer);
    this.effortFeedback = undefined;
  }
  /** WR's Uo/Ire effect, 24k7d6mw [481135,481165)/[722518,722821), UTF-16. */
  private refreshExternalEditorHint(): void {
    const eligible = this.editor.text.includes('\n') && Boolean(this.externalEditorHintCommand);
    if (eligible === this.externalEditorHintEligible) return;
    this.externalEditorHintEligible = eligible;
    this.clearExternalEditorHint();
    if (!eligible || this.closed) return;
    this.externalEditorHintTimer = setTimeout(() => {
      this.externalEditorHintTimer = undefined;
      if (!this.closed) this.render();
    }, 5_000);
    this.externalEditorHintTimer.unref?.();
  }

  private clearExternalEditorHint(): void {
    if (this.externalEditorHintTimer !== undefined) clearTimeout(this.externalEditorHintTimer);
    this.externalEditorHintTimer = undefined;
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

  /**
   * Source `Jr` (chunk-24k7d6mw.js 435644). The none arm reports immediately for 2000 ms; the
   * armed press keeps `go.current` so a second press within `mFe` stops the work.
   */
  private killAgents(): void {
    // The host probe can only count jobs; a malformed count takes the source's boolean none arm.
    if (!(this.backgroundWork() > 0)) {
      this.showStatusNotice('kill-agents-none', 'No background agents running', 2_000);
      return;
    }
    const now = Date.now();
    if (this.killAgentsArmed !== undefined && now - this.killAgentsArmed <= 3_000) {
      this.killAgentsArmed = undefined;
      this.clearStatusNotice('kill-agents-confirm');
      this.backgroundWorkStop?.();
      this.render();
      return;
    }
    this.killAgentsArmed = now;
    this.showStatusNotice('kill-agents-confirm',
      `Press ${chordForAction('chat:killAgents', 'Chat', 'ctrl+x ctrl+k')} again to stop background agents`, 3_000);
  }

  private backgroundWork(): number {
    try { return this.backgroundWorkProbe?.() ?? 0; } catch { return 0; }
  }

  private backgroundLabel(): string | undefined {
    if (this.screen !== 'chat') return;
    const snapshot = this.backgroundTasksProbe?.();
    return snapshot === undefined ? undefined : backgroundFooterLabel(snapshot);
  }

  /** rh/pf/Wp, 24k7d6mw [870856,871116)/[889030,889398), UTF-16; local rows only. */
  private moveFooter(direction: -1 | 1, leave = false): boolean {
    const items = this.footerItems();
    const index = this.footerSelection === null ? -1 : items.indexOf(this.footerSelection);
    const next = items[index + direction];
    if (next !== undefined) { this.footerSelection = next; this.render(); return true; }
    if (direction < 0 && leave) { this.footerSelection = null; this.render(); return true; }
    return false;
  }

  private footerItems(): Array<'tasks' | 'ideSelection'> {
    if (this.screen !== 'chat' || this.composerMode !== 'prompt' || this.gestures.hint
      || this.showExpandPasteHint && this.statusNoticeText === undefined) return [];
    if (this.diffSelection.pending) return ['ideSelection'];
    return this.backgroundLabel() === undefined ? [] : ['tasks'];
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

  /** Input-store subscriptions `ul` and Ire/WR, 24k7d6mw [481135,481165)/[864462,864475), UTF-16.
   * Text mutations share the selector even outside the reducer. */
  private replaceDraft(next: EditorState): void {
    // p4.onPromptEdit, 24k7d6mw [1333944,1336535), UTF-16; the edit subscription shares this owner.
    if (this.screen === 'chat' && !this.dialog) this.transcriptScroll.onPromptEdit(next.text, this.editor.text);
    if (next.text !== this.editor.text) this.footerSelection = null;
    this.editor = next;
    this.refreshExternalEditorHint();
    this.settleWorkflowKeyword();
  }

  setTheme(value?: ThemeSetting): void {
    this.theme.reset(value);
    this.syncSystemTheme();
    this.selection = createSelection();
    this.render();
  }

  bindThemeCatalog(userDir?: string, workspace?: string, plugins?: import('./plugins.js').PluginConfig): void {
    if (!this.isTTY || !this.started || this.closed) return;
    this.customThemes ??= new CustomThemeCatalog(themes => {
      if (this.closed) return;
      this.theme.setCustomThemes(themes); this.selection = createSelection();
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
      this.theme.setSystemTheme(value);
      this.selection = createSelection();
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
    this.footerPointer = undefined; this.renderer?.hover(-1, -1);
    this.sourcePicker?.cancel();
    // Formatter and settings callbacks retain their host ownership outside the cloned display data.
    // The resume picker's preview/rename callbacks are host closures too; only its rows are data.
    const { adjust: axis, configPanel, resumePicker, backgroundTasks, backgroundTaskDetail, ...plain } = request;
    const snapshot: TerminalPromptRequest = structuredClone(plain);
    if (backgroundTasks !== undefined) snapshot.backgroundTasks = backgroundTasks;
    if (backgroundTaskDetail !== undefined) snapshot.backgroundTaskDetail = backgroundTaskDetail;
    if (axis !== undefined) snapshot.adjust = axis;
    if (configPanel !== undefined) snapshot.configPanel = configPanel;
    if (resumePicker !== undefined) snapshot.resumePicker = { ...resumePicker, logs: structuredClone(resumePicker.logs) };
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
        if (dialog.adjustClock !== undefined) clearInterval(dialog.adjustClock.timer);
        if (dialog.backgroundDetail?.timer !== undefined) clearInterval(dialog.backgroundDetail.timer);
        // Source removal is in-memory only; this host also unlinks the private
        // attachments it captured for the dialog.
        dialog.imageCapture?.abort();
        void dialog.images.clear();
        const editorTask = this.editorDialog === dialog ? this.editorTask : undefined;
        if (editorTask) this.editorController?.abort();
        this.stopAfk();
        this.dialog?.themeEditor?.close();
        dialog.copyPicker?.owner.close();
        this.dialog?.undo.clear();
        if (snapshot.themePreview) { this.theme.cancelPreview(); this.syncSystemTheme(); }
        this.dialog = undefined; this.screen = previousScreen;
        this.progress.pause(false);
        if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = undefined; }
        this.decoder.discardPending(); this.keys.reset(); this.render();
        const pending = dialog.configPanel?.pending ?? editorTask;
        if (pending) void pending.then(() => resolve(answer), () => resolve(answer));
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
      if (snapshot.modelPicker !== undefined) dialog.modelPicker = {
        owner: new ModelPicker(snapshot.choices ?? [], snapshot.modelPicker), hitRows: new Map(),
      };
      if (snapshot.copyPicker !== undefined) dialog.copyPicker = {
        owner: new CopyPicker(snapshot.copyPicker.rows, () => { if (this.dialog === dialog) this.render(); }), hitRows: new Map(),
      };
      if (snapshot.configPanel !== undefined) {
        dialog.configPanel = { owner: new ConfigPanel(snapshot.configPanel.input), hits: new Map(), searchRows: new Set() };
        dialog.configPanel.owner.error = snapshot.initialText;
      }
      if (snapshot.resumePicker !== undefined) {
        dialog.resumePicker = { owner: new ResumePicker(snapshot.resumePicker), hits: new Map() };
      }
      if (snapshot.backgroundTaskDetail !== undefined) dialog.backgroundDetail = { snapshot: undefined };
      this.dialog = dialog;
      // kG/YG, 24k7d6mw [633300,637661)/[667173,670211); GD, n7mc1kmr [812,1038), UTF-16.
      if (dialog.backgroundDetail !== undefined) {
        this.refreshBackgroundDialog();
        if (this.dialog !== dialog) return;
        if (dialog.backgroundDetail.snapshot !== undefined && taskDetailRunning(dialog.backgroundDetail.snapshot)) {
          dialog.backgroundDetail.timer = setInterval(() => {
            if (this.dialog !== dialog) return;
            this.refreshBackgroundDialog(); this.render();
          }, 1000);
          dialog.backgroundDetail.timer.unref?.();
        }
      }
      // Pt/he, 76jkr621 [21105,21789), UTF-16: repaint from a modal-owned 100 ms clock.
      if (snapshot.adjust?.kind === 'slider') {
        const timer = setInterval(() => {
          if (this.dialog === dialog && !this.prefersReducedMotion) this.render();
        }, 100);
        timer.unref?.();
        dialog.adjustClock = { startedAt: Date.now(), timer };
      }
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
        this.externalEditorHintCommand = externalEditorCommand();
        this.refreshExternalEditorHint();
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
    this.clearAgentView();
    this.notifications.close(); this.terminalTitle.close(); this.owl.close();
    this.idleNotification?.dispose(); this.idleNotification = undefined;
    this.unsubscribeTitle?.(); this.unsubscribeTitle = undefined; this.titleSession = undefined;
    this.transcriptScroll.reset(); this.scrollPointer = undefined;
    this.selectionCopy.reset();
    // `qa`'s unmount cleanup clears the progress indicator before the screen is restored.
    if (this.lastTerminalProgress !== '') this.emitTerminalProgress('completed', 0, true);
    this.sourceSearch?.close();this.sourceSearch=undefined;this.queryUndo.clear();this.queryEditor=createEditorState();
    this.sourcePicker?.close();this.sourcePicker=undefined;this.pickerUndo.clear();this.pickerQuery=createEditorState();
    this.editorController?.abort();this.gestures.reset();this.vim.close();this.focus.close();this.inputHistory.close();
    this.mcpCatalogAbort?.abort();
    this.editRelay.dispose();
    this.undo.clear();
    this.editor = {...this.editor,pastedContents:{},historyPastes:[],historyDraftPastes:{}};
    this.stashedDraft = undefined; this.searchDraft = {text:'',cursor:0,pastedContents:{}};
    this.diffPanel?.close(); this.diffPanel = undefined;
    this.diffPointer = undefined; this.diffSelection.dismiss(); this.footerSelection = null;
    this.spinnerTips?.close(); this.progress.close(); this.progressRenderer?.close();
    this.statusLine.close(); this.statusLineRenderer?.close(); this.statusLineRows = [];
    this.unsubscribePermissions?.(); this.unsubscribePermissions = undefined;
    this.backgroundTasksProbe = undefined; this.backgroundWorkProbe = undefined; this.backgroundWorkStop = undefined;
    this.footerPointer = undefined;
    this.welcomeRenderer?.close(); this.welcomeRenderer = undefined; this.welcomeRows = []; this.welcomeKey = '';
    this.assistantMessage = undefined;
    this.loopFireId = undefined; this.foldedLoopFires.clear();
    this.previewCoalescer.dispose();
    this.previewStore.setRaw(null);
    this.dialog?.finish();
    if (this.statusNoticeTimer !== undefined) { clearTimeout(this.statusNoticeTimer); this.statusNoticeTimer = undefined; }
    this.statusNoticeOwner = undefined; this.statusNoticeText = undefined;
    this.pasteOwner.dispose();
    this.stopUltracodeTagReveal();
    this.clearEffortFeedback();
    if (this.escapeTimer) clearTimeout(this.escapeTimer);
    this.clearExternalEditorHint();
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
    this.syncTerminalTitle();
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
    const entry: TranscriptEntry = { kind: 'assistant', text: renderPreviewMarkdown(displayed),
      markdown: displayed, speaker: true, timestamp: message.startedAt,
      ...(this.loopFireId ? { loopFireId: this.loopFireId } : {}), ...(!completed ? { streaming: true, messageKey: message.key,
        hideTrailingLine: this.previewStore.getDerived().hideTrailingLine } : {}) };
    if (message.index === undefined) {
      message.index = this.transcript.entries.length;
      this.transcript = { ...this.transcript, entries: [...this.transcript.entries, entry] };
    } else {
      const entries = [...this.transcript.entries]; entries[message.index] = entry;
      this.transcript = { ...this.transcript, entries };
    }
    // gie, 3gz7s57c [185681,188242), UTF-16: main preview updates leave the child selection alone.
    if (!this.agentView) this.selection = createSelection();
    this.render();
  }

  endAssistantMessage(): void {
    this.previewCoalescer.dispose();
    try { this.paintAssistantPreview(true); }
    finally {
      this.assistantMessage = undefined;
      this.previewStore.setRaw(null);
      this.syncTerminalTitle();
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
    if (this.footerSelection !== null && !this.dialog) {
      const footerAction = action.type === 'submit' ? 'footer:openSelected'
        : action.type === 'down' ? 'footer:down' : action.type === 'up' ? 'footer:up'
          : action.type === 'left' ? 'footer:previous' : action.type === 'right' ? 'footer:next' : undefined;
      if (footerAction !== undefined) { this.applyAction(footerAction); return; }
    }
    // Source `Er`/`at.enter()`: Enter on an open suggestion accepts it first. The
    // accepted draft ends with a space, so the follow-up submit passes this gate.
    if ((action.type === 'return' || action.type === 'submit') && !this.keys.pendingChord
      && (action.type !== 'return' || (!action.meta && !action.shift)) && this.autocompleteVisible()) {
      if (this.acceptAutocomplete(true)) return;
    }
    // N4.submitToAgent, 24k7d6mw [1497670,1498885), UTF-16: route before main row/selection effects.
    if (this.agentView && !this.dialog && this.screen === 'chat' && (action.type === 'submit'
      || action.type === 'return' && !action.meta && !action.shift
        && applyReturnGesture(this.editor.text, this.editor.cursor, this.conversationColumns() - 2, action).submitted)) {
      this.submitToViewedAgent(); return;
    }
    if (action.type === 'focus') { this.focus.set(action.focused); return; }
    if (action.type === 'search' && !this.sourceSearch?.snapshot.searching) { this.enterSearch(); return; }
    // The open picker owns the keyboard: source gLt handles its own keys and hands the rest to its
    // query editor, so no key that reaches dispatch while it is up may edit the draft or submit.
    // Same route shape as the line owner's `handleLinePicker` call.
    if (action.type !== 'running' && this.handleSourcePicker(action)) return;
    if (action.type !== 'running' && this.handleSourceSearch(action)) return;
    if (!this.dialog && action.type !== 'running' && action.type !== 'terminalResponse' && action.type !== 'mouse') {
      const raw = sequence ?? (action.type === 'key' ? action.sequence : chordSequence(action)
        ?? (action.type === 'insert' ? action.text : undefined));
      if (raw !== undefined && this.selectionKey(raw, action.type === 'key' ? action.command : undefined)) return;
      if (action.type === 'paste' && this.hasTextSelection()) this.selection = createSelection();
    }
    if(this.options.sourceInputGestures&&this.options.idleInterrupt===undefined&&!this.gestureHandling&&!this.editor.running
      &&!this.dialog&&(action.type==='interrupt'||action.type==='eof')){this.handleGesture(action.type);return;}
    if(action.type==='running'||action.type==='submit'||action.type==='return')this.gestures.reset();
    if(action.type==='paste')this.vim.externalMutation();
    if(this.vimEnabled&&!this.vimHandling&&!this.dialog&&action.type!=='running'
      &&!(action.type==='interrupt'&&this.editor.running)&&this.handleVim(action))return;
    // Source `Gv`/`bS`/`cg`: the queue gestures sit in the input's own key handling, after the
    // suggestion list and the modal editor have taken their keys.
    if (this.screen === 'chat' && !this.dialog
      && (action.type === 'up' || action.type === 'down') && this.handleQueueKey(action.type)) return;
    if ((action.type === 'return' || action.type === 'submit') && this.screen === 'chat' && !this.dialog
      && !this.keys.pendingChord && keyboardCohesion() && this.queueEditIndex !== null
      && (action.type !== 'return' || (!action.meta && !action.shift))
      && this.popSelectedQueuedPrompt()) return;
    // bS/Yo/JA, 24k7d6mw [834853,835119)/[791954,796268)/[871891,871990), UTF-16.
    if (action.type === 'down' && this.screen === 'chat' && !this.dialog
      && this.editor.historyIndex === this.editor.history.length
      && this.editor.cursor > this.editor.text.lastIndexOf('\n')
      && this.autocompleteState().suggestions.length <= 1) {
      const cursor = inputCursor(this.editor.text, this.conversationColumns() - 2, this.editor.cursor);
      if (cursor.getPosition().line === cursor.measuredText.lineCount - 1 && this.moveFooter(1)) return;
    }
    // Source `QE` (chunk-24k7d6mw.js 815713): Escape, Delete, or Backspace/ctrl+u with the caret at
    // 0 leaves bash mode before the edit runs, so the key that emptied the command does not also
    // type into a prompt composer. The recovered handler reads a key event's `name`; this host's
    // reducer reads an `EditorCommand`, so Escape arrives as the interrupt command.
    if (this.composerMode === 'bash' && this.screen === 'chat' && !this.dialog && !this.keys.pendingChord
      && (this.editor.cursor === 0 || action.type === 'interrupt')
      && (action.type === 'interrupt' || action.type === 'delete' || action.type === 'backspace'
        || (action.type === 'killLineStart'))) {
      this.setComposerMode('prompt');
      if (action.type === 'interrupt') return;
    }
    const draftBefore = { text: this.editor.text, cursor: this.editor.cursor };
    // Source `bZ` (84911): a `!` typed or pasted into the empty composer, or prepended with the
    // caret at 0, switches to bash mode and never enters the value; `J1o` gates the prepend case on
    // the previous caret and a one-character growth.
    let modeAction = action;
    if (this.screen === 'chat' && !this.dialog
      && (action.type === 'insert' || action.type === 'paste') && this.composerMode === 'prompt') {
      if (this.editor.text === '' && action.text.startsWith('!')) {
        this.setComposerMode('bash');
        modeAction = { type: action.type, text: action.text.slice(1) };
      } else if (this.editor.cursor === 0 && action.text.startsWith('!')
        && switchedToBash({ nextValue: '!' + this.editor.text, value: this.editor.text,
          cursorOffset: 0, mode: this.composerMode })) {
        this.setComposerMode('bash');
        modeAction = { type: action.type, text: action.text.slice(1) };
      }
    }
    // Source `mSt`'s `setBash` unwind (84762): Backspace on an empty bash composer drops the mode
    // instead of deleting anything.
    if (this.composerMode === 'bash' && action.type === 'backspace' && this.editor.text === '') {
      this.setComposerMode('prompt');
      this.render();
      return;
    }
    const transition = reduceEditorWithUndo(this.editor, modeAction, { ...this.options,
      navigationColumns: this.conversationColumns() - 2,
      undoPush: (text, cursor, pastedContents, ownSnapshot) => this.pushUndo(text, cursor, pastedContents, ownSnapshot),
      pasteOwner:this.pasteOwner,terminalRows:this.options.output.rows ?? 24 }, this.undo);
    if (transition.effects.some(effect => effect.type === 'submit')) this.inputHistory.add({display:this.editor.text,pastedContents:this.editor.pastedContents});
    // Source input subscription: a keystroke that completes a known `:name:` swaps the
    // whole shortcode for its glyph before anything else reads the draft.
    const inline = this.emojiCompletionEnabled
      ? inlineEmojiCompletion(transition.state.text, draftBefore.text, transition.state.cursor)
      : undefined;
    this.replaceDraft(inline === undefined ? transition.state
      : { ...transition.state, text: inline.text, cursor: inline.cursor });
    // Source `ls`: a draft that moved by an edit drops the queued-row selection. The pull path
    // writes the draft outside this reducer and clears the index itself.
    if (this.queueEditIndex !== null && this.editor.text !== draftBefore.text) this.queueEditIndex = null;
    this.publishDraft();
    if (this.editor.text.length !== draftBefore.text.length) {
      // Source `cq` (chunk-24k7d6mw.js 830089): a typed change clears the tip row; the length
      // effect below may raise it again when this change is the shrink it watches for.
      this.clearStatusNotice('stash-hint');
      this.stashTip(this.editor.text.length);
    }
    this.relayEdit(action, draftBefore, sequence);
    if(transition.effects.some(effect=>effect.type==='submit')||action.type==='interrupt'&&!this.editor.running)this.vim.reset();
    const submitted = transition.effects.find(effect => effect.type === 'submit');
    // The mode the submit was typed in, read before the exit below returns the composer to prompt.
    const beforeMode = this.composerMode;
    // Source submit exit 1492848: the composer returns to prompt mode before anything reads the
    // emptied draft, so a bash submit leaves no `shell mode` row behind.
    if (submitted) this.setComposerMode('prompt');
    // Source submit path (chunk-24k7d6mw.js 1492930): once the prompt is accepted and it is not a
    // slash command, a stashed draft comes back into the emptied composer with `Draft restored`.
    if (submitted !== undefined && !submitted.text.trim().startsWith('/')) this.restoreStashedDraft();
    // p4.repin/onUserRowLanded, 24k7d6mw [1333944,1336535), UTF-16; own submissions may repin after user scrolling.
    if (submitted) {
      this.transcriptScroll.onUserRowLanded(true);
      this.transcript = { ...this.transcript, entries: [...this.transcript.entries,
        { kind: 'user', text: beforeMode === 'bash' ? bashInputText(submitted.text) : submitted.text, timestamp: Date.now() }] };
    }
    this.render();
    for (const effect of transition.effects) {
      if (effect.type === 'exit') { this.close(); this.emit('exit'); }
      else if (effect.type === 'submit') {
        const promptUuid = randomUUID(), selection = this.diffSelection.take(effect.text, promptUuid);
        this.footerSelection = null;
        this.emit('submit', effect.text, selection && this.diffPanel ? { sessionId: this.diffPanel.sessionId, promptUuid, selection } : undefined,
          beforeMode);
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
    const body = layoutInput(this.editor, columns - 2, maximum,this.vimEnabled?{mode:this.vim.mode,anchor:this.vim.anchor}:undefined,
      this.focus.focused, this.footerSelection === null);
    // Source text input: an empty draft draws its `placeholder` dim instead of the value.
    const queueHint = this.queuePlaceholder();
    if (queueHint !== undefined) {
      return { ...body, lines: [[{ text: queueHint, style: { dimColor: true } }]],
        cursorColumn: body.cursorColumn + 2 };
    }
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
    return transcriptLines(this.visibleTranscript, columns, this.renderEntryRows, this.welcomePreamble(columns)).length;
  }

  private contexts(): TuiContext[] {
    if (this.screen !== 'chat') return contextStack({ screen: this.screen });
    const native = this.diffPanel?.width(this.options.output.columns ?? 80)
      ? this.diffPanel.keys.activeContexts as TuiContext[] : [];
    // Source `nn(La,{context:"Autocomplete",isActive:ya&&!Wr})`: the list owns
    // Tab/Escape/arrows while it is visible, and the chat context keeps the rest.
    const autocomplete: TuiContext[] = this.autocompleteVisible() ? ['Autocomplete'] : [];
    return [...new Set([...autocomplete, ...(this.footerSelection !== null ? ['Footer' as const] : []), ...native, 'Chat', 'Scroll', 'Global'] as TuiContext[])];
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

  // RTe.kn/Bn, 24k7d6mw [1560490,1586785), UTF-16; a changed server replaces its resource surface.
  bindMcpCatalog(load?: TuiOptions['mcpCatalog']): void {
    this.mcpCatalogAbort?.abort(); this.mcpCatalogAbort = undefined; this.mcpCatalogStarted = false;
    this.mcpResources = {}; this.mcpResourceTemplates = {}; this.options.mcpCatalog = load;
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
      if (this.closed || controller.signal.aborted || this.mcpCatalogAbort !== controller) return;
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
      this.replaceDraft({ ...this.editor, text: applied.text, cursor: applied.cursor });
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
      this.replaceDraft({ ...this.editor, text: replaced.text, cursor: replaced.cursor });
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
    this.replaceDraft({ ...this.editor, text, cursor: text.length });
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
   * maps the selected local agent to its existing banner text slot (Zee [210978,211342), UTF-16).
   */
  private sessionBanner(): { text: string; color: string } | undefined {
    if (this.agentView) return { text: `Viewing agent ${this.agentView.snapshot.name ?? this.agentView.snapshot.id} (${this.agentView.snapshot.status})`, color: 'background' };
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
      // Id/Yd/Cx, 06azbynj [239213,239367)/[241153,241196), UTF-16; pointer motion without a pressed button is excluded.
      if (action.type !== 'terminalResponse' && action.type !== 'focus'
        && (action.type !== 'mouse' || !((action.button & 32) !== 0 && (action.button & 3) === 3))) this.lastInteraction = Date.now();
      if (action.type === 'terminalResponse') { this.systemTheme?.onResponse(action.response); continue; }
      if (action.type === 'focus') {
        this.dialog?.copyPicker?.owner.windowFocus(action.focused);
        this.focus.set(action.focused); continue;
      }
      if (handedOff) continue;
      if (!this.focus.focused && (action.type !== 'mouse' || action.action === 'press')) {
        this.dialog?.copyPicker?.owner.windowFocus(true);
        this.focus.set(true);
      }
      if (action.type !== 'mouse') this.dialog?.copyPicker?.owner.activationInput();
      if (this.dialog) {
        const owner = this.dialog;
        // The source's picker and thinking panels close from their own chord while open
        // (`fa(S8t)`/`Iu(w8t)`); a modal dialog otherwise consumes every key, so hand these two
        // chords back to the host that owns the live panel.
        if (action.type === 'key' && (action.sequence === '\x1bp' || action.sequence === '\x1bt')) {
          this.emit('action', action.sequence === '\x1bp' ? 'chat:modelPicker' : 'chat:thinkingToggle');
          this.decoder.discardPending(); handedOff = true;
          continue;
        }
        this.handleDialogAction(action.type==='return'?{type:action.meta||action.shift?'newline':'submit'}:action);
        if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; }
        continue;
      }
      if (this.handleSourceSearch(action)) continue;
      if(action.type==='return'&&(this.keys.pendingChord||this.screen!=='chat'||this.footerSelection!==null)){
        const owner = this.dialog;
        this.routeKey(action.sequence,action.meta||action.shift?'newline':'submit');
        if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; }
        continue;
      }
      if (action.type === 'mouse') {
        const owner = this.dialog;
        this.handleMouse(action);
        if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; }
        continue;
      }
      if (action.type === 'key') {
        const owner = this.dialog;
        this.routeKey(action.sequence, action.command);
        if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; }
        continue;
      }
      if (action.type === 'insert' && (this.screen === 'transcript' || this.keys.pendingChord || this.footerSelection !== null)) {
        for (const character of action.text) {
          if (this.closed || this.editorController) return;
          const owner: ActiveDialog | undefined = this.dialog;
          this.routeKey(character);
          if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; break; }
        }
        continue;
      }
      // Explicit local keybinding commands and paste keep their decoded intent.
      if (action.type.startsWith('extend') || action.type === 'selectionCopy') {
        this.routeKey(chordSequence(action)!);
      } else if (action.type === 'insert' && action.text === '?' && this.screen === 'chat'
        && this.editor.text === '') {
        // Source input handler (chunk-24k7d6mw.js 880989): an empty draft turns `?` into the help
        // panel before `typeText` runs; a non-empty draft still inserts the character.
        this.emit('action', 'app:toggleHelp');
      } else {
        const owner = this.dialog;
        this.dispatch(action, action.type === 'insert' ? action.text : undefined);
        if (this.dialog !== owner) { this.decoder.discardPending(); handedOff = true; }
      }
    }
    if (!this.closed && this.decoder.pendingStandaloneEscape) {
      this.escapeTimer = setTimeout(() => {
        this.escapeTimer = undefined;
        this.decoder.flushEscape();
        this.lastInteraction = Date.now();
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

  /** Oi/FFt/Yi, yygmb66g [31583,34355)/[40142,40513)/[41667,54367), UTF-16. */
  private handleModelPickerAction(dialog: ActiveDialog, action: EditorAction): void {
    const picker = dialog.modelPicker!;
    const owner = picker.owner;
    if (action.type === 'mouse') {
      if (this.options.mouseTracking === 'off' || action.col < 1 || action.col > (this.options.output.columns ?? 80)) return;
      const index = picker.hitRows.get(action.row - 1);
      if (action.action === 'wheelup' || action.action === 'wheeldown') {
        if (index !== undefined) { owner.scroll(action.action === 'wheelup' ? -1 : 1); this.render(); }
      } else if ((this.options.mouseTracking ?? 'full') === 'full' && (action.button & 3) === 0) {
        if (action.action === 'press') picker.pressed = index;
        else if (action.action === 'release') {
          const pressed = picker.pressed; picker.pressed = undefined;
          if (index !== undefined && index === pressed) dialog.finish(owner.accept(false, index));
        } else if (action.action === 'move' && index !== picker.pressed) picker.pressed = undefined;
      }
      return;
    }
    const command = action.type === 'key' ? action.command : action.type;
    const sequences = action.type === 'key' ? [action.sequence] : action.type === 'insert' ? [...action.text] : [];
    if (command === 'interrupt' || command === 'eof') { dialog.finish(); return; }
    if (command === 'left' || command === 'right') { owner.adjust(command); this.render(); return; }
    if (command === 'submit') { const answer = owner.accept(); if (answer) dialog.finish(answer); return; }
    for (const sequence of sequences) {
      if (sequence === 's') { const answer = owner.accept(true); if (answer) dialog.finish(answer); return; }
      if (/^[1-9]$/.test(sequence)) {
        const index = Number(sequence) - 1;
        if (owner.options[index]) dialog.finish(owner.accept(false, index));
        return;
      }
      const result = this.keys.push(sequence, ['Select']);
      if (result.kind !== 'match') continue;
      switch (result.match.action) {
        case 'select:next': owner.move(1); break;
        case 'select:previous': owner.move(-1); break;
        case 'select:pageDown': owner.page(1); break;
        case 'select:pageUp': owner.page(-1); break;
        case 'select:first': owner.focus(0); break;
        case 'select:last': owner.focus(owner.options.length - 1); break;
        case 'select:cancel': dialog.finish(); return;
        case 'select:accept': { const answer = owner.accept(); if (answer) dialog.finish(answer); return; }
      }
    }
    this.render();
  }

  /** bs/Co/Gl, dag4qhha [26517,31282), Qe field clicks czbq7s7d [1599,4413), UTF-16. */
  /** Jln, chunk-er09v3xa.js 9331: list focus, fork expand, search-as-you-type and select/cancel. */
  private handleResumePickerAction(dialog: ActiveDialog, action: EditorAction): void {
    const picker = dialog.resumePicker!.owner;
    if (action.type === 'mouse') return;
    const command = action.type === 'key' ? action.command : action.type;
    const sequence = action.type === 'key' ? action.sequence : '';
    // `Ct`: the preview page owns enter (resume) and confirm:no (back to the list).
    // List-mode triggers live at 14629 (space / ctrl+r); the rename input starts at 17035 and
    // its submit is `bt` at 13235.
    if (picker.previewing) {
      if (sequence === '\x1b' || command === 'interrupt' || command === 'eof') { picker.closePreview(); this.render(); return; }
      if (command === 'submit') {
        const log = picker.previewSession;
        if (log !== undefined) dialog.finish({ selected: [], resume: { id: log.id } });
      }
      return;
    }
    // The rename arm renders a focused text input; its `kt` returns immediately, so the input
    // owns typing, backspace, enter (`bt`) and the rename-scoped `confirm:no`.
    if (picker.renaming) {
      if (sequence === '\x1b' || command === 'interrupt' || command === 'eof') { picker.cancelRename(); this.render(); return; }
      if (command === 'submit') { picker.submitRename(); this.render(); return; }
      if (action.type === 'paste') {
        picker.renameInsert((action.text.split(/\r\n|\r|\n/, 2)[0] ?? '').trim()); this.render(); return;
      }
      if (action.type === 'insert') {
        if (/[^\x00-\x1f\x7f-\x9f]/.test(action.text)) { picker.renameInsert(action.text); this.render(); }
        return;
      }
      if (command === 'backspace') { picker.renameBackspace(); this.render(); return; }
      return;
    }
    // List-mode controls (`kt`): ctrl+r starts rename, space or ctrl+v opens the preview.
    if (command !== undefined && (sequence === '\x12' || command === 'search') && !picker.searching) {
      picker.beginRename(); this.render(); return;
    }
    if ((action.type === 'insert' && action.text === ' ' && !picker.searching) || (action.type === 'key' && sequence === '\x16')) {
      picker.openPreview(); this.render(); return;
    }
    if (action.type === 'paste') {
      picker.insert((action.text.split(/\r\n|\r|\n/, 2)[0] ?? '').trim());
      this.render(); return;
    }
    if (action.type === 'insert') {
      if (/[^\x00-\x1f\x7f-\x9f]/.test(action.text)) { picker.insert(action.text); this.render(); }
      return;
    }
    if (command === 'up') {
      if (picker.focusIndex === 0) picker.search(); else picker.move(-1);
      this.render(); return;
    }
    if (command === 'down') { picker.move(1); this.render(); return; }
    if (command === 'left' || command === 'right') { picker.expand(command); this.render(); return; }
    if (command === 'backspace') { picker.backspace(); this.render(); return; }
    if (sequence === '\x1b' || command === 'interrupt' || command === 'eof') {
      // `kt`: Escape in search clears the query and returns to the list; in the list it cancels.
      if (picker.searching) { picker.clear(); this.render(); } else dialog.finish();
      return;
    }
    if (command === 'submit') {
      const row = picker.focused;
      if (row !== undefined) dialog.finish({ selected: [], resume: { id: row.log.id } });
    }
  }

  private handleConfigPanelAction(dialog: ActiveDialog, action: EditorAction): void {
    const panel = dialog.configPanel!;
    const owner = panel.owner;
    let effect: ConfigPanelEffect | undefined;
    if (action.type === 'mouse') {
      if (this.options.mouseTracking === 'off' || action.col < 1 || action.col > (this.options.output.columns ?? 80)) return;
      const row = action.row - 1, hit = panel.hits.get(row);
      if (action.action === 'wheelup' || action.action === 'wheeldown') {
        panel.pressed = undefined;
        if (hit && !owner.busy) { owner.scroll(action.action === 'wheelup' ? -1 : 1); this.render(); }
        return;
      }
      if ((this.options.mouseTracking ?? 'full') !== 'full' || (action.button & 3) !== 0 || owner.busy) return;
      if (action.action === 'press') panel.pressed = hit
        ? { kind: 'row', id: hit.id, value: action.col - 1 >= hit.valueColumn }
        : panel.searchRows.has(row) ? { kind: 'search' } : undefined;
      else if (action.action === 'release') {
        const pressed = panel.pressed; panel.pressed = undefined;
        if (pressed?.kind === 'search' && panel.searchRows.has(row)) owner.search();
        else if (pressed?.kind === 'row' && hit?.id === pressed.id) {
          owner.focusRow(hit.id);
          if (pressed.value && action.col - 1 >= hit.valueColumn) effect = owner.activate();
        }
      } else if (action.action === 'move' && panel.pressed !== undefined) {
        if (panel.pressed.kind === 'search' ? !panel.searchRows.has(row) : hit?.id !== panel.pressed.id)
          panel.pressed = undefined;
      }
    } else effect = owner.key(action, this.options.output.columns ?? 80);
    if (effect?.kind === 'close' || effect?.kind === 'open') {
      dialog.finish({ selected: [], configPanel: { state: owner.state,
        ...(effect.kind === 'open' ? { open: effect.id } : {}) } });
      return;
    }
    if (effect?.kind === 'change') {
      owner.busy = true;
      const change = dialog.request.configPanel!.change;
      panel.pending = change(effect.update).then(input => {
        if (this.dialog === dialog) owner.update(input);
      }, error => { if (this.dialog === dialog) owner.error = error instanceof Error ? error.message : String(error); })
        .finally(() => { owner.busy = false; if (this.dialog === dialog) this.render(); });
    }
    this.render();
  }

  /** Be/tn/Qe, c283tj3z [18528,22085), 0wtqg4zf [15880,18925), UTF-16. */
  private handleCopyPickerAction(dialog: ActiveDialog, action: EditorAction): void {
    const picker = dialog.copyPicker!, owner = picker.owner;
    let effect: CopyPickerEffect | undefined;
    if (action.type === 'mouse') {
      if (this.options.mouseTracking === 'off' || action.col < 1 || action.col > (this.options.output.columns ?? 80)) return;
      const index = picker.hitRows.get(action.row - 1);
      if (action.action === 'wheelup' || action.action === 'wheeldown') {
        picker.pressed = undefined;
        if (index !== undefined) owner.scroll(action.action === 'wheelup' ? -1 : 1);
      } else if ((this.options.mouseTracking ?? 'full') === 'full' && (action.button & 3) === 0) {
        if (action.action === 'press') {
          const activation = owner.activationInput();
          picker.pressed = index === undefined ? undefined : { index, row: action.row, activation };
        } else if (action.action === 'release') {
          const pressed = picker.pressed; picker.pressed = undefined;
          if (index !== undefined && pressed?.index === index && pressed.row === action.row
            && !owner.dropsClick(action.row, pressed.activation)) {
            if (index < 0) { owner.edge(index === -2); owner.pressEdge(action.row); }
            else effect = owner.accept(false, index);
          }
        } else if (action.action === 'move' && index !== picker.pressed?.index) picker.pressed = undefined;
      }
    } else effect = owner.key(action);
    if (effect?.kind === 'cancel') { dialog.finish(); return; }
    if (effect?.kind === 'select') {
      dialog.finish({ selected: [effect.value], ...(effect.write ? { key: 'w' } : {}) }); return;
    }
    this.render();
  }

  private handleDialogAction(action: EditorAction): void {
    const dialog = this.dialog;
    if (!dialog) return;
    if (dialog.configPanel) { this.handleConfigPanelAction(dialog, action); return; }
    if (dialog.modelPicker) { this.handleModelPickerAction(dialog, action); return; }
    if (dialog.copyPicker) { this.handleCopyPickerAction(dialog, action); return; }
    if (dialog.resumePicker) { this.handleResumePickerAction(dialog, action); return; }
    if (action.type === 'mouse') return;
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
    // bj [1038,1312), chunk-n7mc1kmr.js, UTF-16: details own close/back/stop keys.
    if (dialog.backgroundDetail !== undefined) {
      this.refreshBackgroundDialog();
      if (this.dialog !== dialog) return;
      // kG.f, 24k7d6mw [633300,637661), UTF-16: only supported local-agent details expose f.
      if (dialog.backgroundDetail.snapshot?.kind === 'agent' && action.type === 'insert' && action.text === 'f'
        && dialog.request.keys?.some(key => key.key === 'f')) { dialog.finish({ selected: [], key: 'f' }); return; }
      if (command === 'left') { dialog.finish({ selected: [], key: 'back' }); return; }
      if (command === 'submit' || action.type === 'insert' && action.text === ' ') { dialog.finish(); return; }
    }
    // fLt.Kc, 24k7d6mw [682045,682255), UTF-16: a vanished focus consumes the next stop.
    if (dialog.request.backgroundTasks !== undefined && dialog.backgroundDetail === undefined) {
      this.refreshBackgroundDialog();
      if (action.type === 'insert' && action.text === 'x' && dialog.backgroundFocusLost) {
        dialog.backgroundFocusLost = false; this.render(); return;
      }
    }
    if (command === 'interrupt' || command === 'eof' || sequence === '\x1b') { dialog.finish(); return; }
    // A read-only panel has no answer input: Enter picks the focused row when there is one,
    // and does nothing when the panel is only a record to read.
    if (dialog.request.readOnly === true && command === 'submit'
      && !(this.dialogStep(dialog)?.choices ?? []).length) return;
    // The review page owns its keys before any per-question handling, because
    // it has no choices of its own and would otherwise fall into text entry.
    if (this.handleReviewAction(dialog, action, command ?? '')) return;
    const adjust = dialog.request.adjust;
    // It, 76jkr621 [22174,30123), UTF-16: the slider owns only its axis and accept keys.
    if (adjust?.kind === 'slider') {
      if (command === 'left' || command === 'right') {
        const delta = command === 'left' ? -1 : 1;
        dialog.adjustIndex = Math.max(0, Math.min(adjust.values.length - 1, dialog.adjustIndex + delta));
        this.render();
      } else if (command === 'submit') this.advanceDialog(dialog, { selected: [] });
      else {
        // Source `effortSlider:toggleUltracode` (chunk-76jkr621.js 22794): tab flips the
        // flag and leaves the dialog open; the axis answer reports it as `toggled`. The
        // decoder reports tab as a `key` action with an empty command, so match its sequence.
        if (adjust.toggle !== undefined
          && ((action.type === 'insert' && action.text === adjust.toggle.key)
            || (action.type === 'key' && sequence === '\t' && adjust.toggle.key === 'tab'))) {
          adjust.toggle = { ...adjust.toggle, on: !adjust.toggle.on };
          this.render(); return;
        }
        const keyed = dialog.request.keys?.find(entry => action.type === 'insert' && action.text === entry.key);
        if (keyed !== undefined) this.advanceDialog(dialog, { selected: [], key: keyed.key });
      }
      return;
    }
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
    if (adjust !== undefined && !textEntry && (command === 'left' || command === 'right')) {
      const delta = command === 'left' ? -1 : 1;
      dialog.adjustIndex = Math.max(0, Math.min(adjust.values.length - 1, dialog.adjustIndex + delta));
      this.render(); return;
    }
    // The request's own keys take the focused row, the way the recovered picker's `s`
    // accepts a session-only pick while `enter` also makes it the default. A read-only
    // panel with no rows has no input to own the keys, so `/btw` can bind browsing there.
    const readOnlyKeyed = dialog.request.readOnly === true && choices.length === 0;
    const keyed = textEntry && !readOnlyKeyed ? undefined : dialog.request.keys?.find(entry => action.type === 'insert' && action.text === entry.key);
    if (keyed !== undefined && !dialog.notesEditing && (choices.length || readOnlyKeyed)) {
      this.advanceDialog(dialog, { selected: choices.length ? [choices[dialog.index]!.value] : [], key: keyed.key });
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
      dialog.backgroundFocusLost = false;
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
      dialog.backgroundFocusLost = false;
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

  // rI/QLt, 24k7d6mw [126888,130997), qh0w98pn [3815,4061), UTF-16.
  private selectionKey(sequence: string, command?: EditorCommand): boolean {
    if (!this.hasTextSelection() || this.dialog || this.screen === 'search') return false;
    if (sequence === '\x03') { this.copySelection(true); return true; }
    if (command === 'selectionCopy' || sequence === '\x1b[99;6u' || sequence === '\x1b[67;6u' || sequence === '\x1bc') return false;
    const name = keyName(sequence), parts = name.split('+'), base = parts.at(-1);
    const modifier = /^\x1b\[\d+;(\d+)[ABCDHF]$/.exec(sequence);
    const bits = modifier ? Number(modifier[1]) - 1 : 0;
    const final = modifier ? sequence.at(-1) : undefined;
    const key: SelectionKey = {
      ctrl: parts.includes('ctrl') || !!(bits & 4), shift: parts.includes('shift') || !!(bits & 1),
      meta: parts.includes('meta') || !!(bits & 2), super: parts.includes('cmd') || !!(bits & 8),
      escape: sequence === '\x1b', pageUp: base === 'pageup', pageDown: base === 'pagedown',
      home: base === 'home' || final === 'H', end: base === 'end' || final === 'F',
      leftArrow: base === 'left' || final === 'D', rightArrow: base === 'right' || final === 'C',
      upArrow: base === 'up' || final === 'A', downArrow: base === 'down' || final === 'B',
    };
    if (command?.startsWith('extend')) key.shift = true;
    const character = sequence.length === 1 && sequence.charCodeAt(0) < 32
      ? String.fromCharCode(sequence.charCodeAt(0) + 96) : sequence;
    if (this.screen === 'transcript' && lbt(character, key)) return false;
    if (QLt(key)) this.selection = createSelection();
    return false;
  }

  private routeKey(sequence: string, command?: EditorCommand): void {
    if (this.closed || this.selectionKey(sequence, command)) return;
    if (this.footerSelection !== null && this.vimEnabled && this.vim.mode === 'NORMAL') {
      const action = sequence === 'h' ? 'footer:previous' : sequence === 'j' ? 'footer:down'
        : sequence === 'k' ? 'footer:up' : sequence === 'l' ? 'footer:next' : undefined;
      if (action !== undefined) { this.applyAction(action); return; }
    }
    if (this.footerSelection !== null && sequence === '\x1b' && !this.keys.pendingChord
      && this.handleKey(sequence, command)) return;
    if ((!command || !['yank', 'yankPop', 'killLineStart', 'killLineEnd', 'killWordForward', 'killWordBackward', 'killWORDBackward'].includes(command))
      && !this.keys.pendingChord) this.resetKillMode();
    if(sequence==='\x1b'&&this.keys.pendingChord){this.handleKey(sequence,command);return;}
    // Source escape keydown: a selected queued row clears on Escape, and the source's `chat:cancel`
    // handler declines while the selection is up, so the key stops here either way.
    if (sequence === '\x1b' && this.queueEditIndex !== null) {
      this.queueEditIndex = null; this.render(); return;
    }
    // Source `ds` (autocomplete:dismiss): Escape closes the list before any gesture handling.
    if (sequence === '\x1b' && this.autocompleteVisible()) { this.dismissAutocomplete(); return; }
    // kve, 24k7d6mw [1304882,1305454), UTF-16; transcript and input overlays retain Escape priority.
    if (sequence === '\x1b' && this.screen === 'chat' && this.agentView && !this.dialog) {
      // JYe inputOwnsEscape, 24k7d6mw [864995,865015)/[879594,880250), UTF-16.
      if (this.vimEnabled && this.vim.mode !== 'NORMAL') { this.handleVim({ type: 'key', sequence, command }); return; }
      if (this.composerMode === 'bash') { this.setComposerMode('prompt'); return; }
      this.agentView.host.escape(); return;
    }
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
    if (event.action !== 'press') this.mouseSeen = true;
    // Vc/Ax, 3gz7s57c [41715,43141), 06azbynj [242075,244661), UTF-16; noSelect keeps pill clicks out of copying.
    const pillHit = this.renderer?.scrollPillAt(event.col - 1, event.row - 1) === true;
    if ((pillHit || this.scrollPointer) && event.action !== 'wheelup' && event.action !== 'wheeldown') {
      const column = event.col - 1, row = event.row - 1;
      this.renderer?.hover(column, row);
      if (event.action === 'press' && (event.button & 3) === 0) {
        this.selection = createSelection(); this.scrollPointer = { column, row, moved: false };
      } else if (this.scrollPointer) {
        this.scrollPointer.moved ||= column !== this.scrollPointer.column || row !== this.scrollPointer.row;
        if (event.action === 'release') {
          const pointer = this.scrollPointer; this.scrollPointer = undefined;
          if (pillHit && !pointer.moved) this.renderer?.click(column, row, { ctrl: event.ctrl, shift: event.shift, alt: event.meta });
        }
      }
      this.render(); return;
    }
    // Ax, 06azbynj [242075,244661), UTF-16: release without a drag dispatches the native click.
    const footerRow = Math.max(4, this.options.output.rows ?? 24) - 1;
    const footerHit = event.row - 1 === footerRow && event.col >= 1 && event.col <= view.columns;
    if (footerHit || this.footerPointer) {
      if ((this.options.mouseTracking ?? 'full') !== 'full') return;
      const column = event.col - 1, row = event.row - 1;
      this.renderer?.hover(column, row);
      if (event.action === 'press' && (event.button & 3) === 0) {
        this.selection = createSelection();
        this.footerPointer = { column, row, moved: false };
        this.renderer?.selectNative('start', column, row, 1);
      } else if (this.footerPointer && (event.action === 'move' || event.action === 'release')) {
        const pointer = this.footerPointer;
        pointer.moved ||= column !== pointer.column || row !== pointer.row;
        this.renderer?.selectNative(event.action === 'release' ? 'end' : 'drag', column, row);
        if (event.action === 'release') {
          this.footerPointer = undefined;
          if (footerHit && !pointer.moved && !this.renderer?.selectionInstance.hasTextSelection())
            this.renderer?.click(column, row, { ctrl: event.ctrl, shift: event.shift, alt: event.meta });
        }
      }
      this.render(); return;
    }
    if ((this.options.mouseTracking ?? 'full') === 'full') this.renderer?.hover(event.col - 1, event.row - 1);
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
      if (outcome.kind === 'match') {
        const action = outcome.match.action;
        if (action.startsWith('scroll:')) {
          this.transcriptScroll.scroll(action.slice('scroll:'.length) as TranscriptScrollCommand, true);
          this.render();
        } else this.applyAction(action);
      }
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
    const viewport = layoutTranscript(this.visibleTranscript, view.columns, view.rows, this.renderEntryRows,
      this.welcomePreamble(view.columns));
    return viewport.lines[line - viewport.offset];
  }

  /** Map a terminal coordinate to the transcript line and cell it lands on. */
  private anchorAt(col: number, row: number): SelectionAnchor | null {
    const view = this.viewportSize();
    const viewport = layoutTranscript(this.visibleTranscript, view.columns, view.rows, this.renderEntryRows,
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
    // `e9` (chunk-24k7d6mw.js 887081): a non-empty draft is queued before the flush request, so
    // the loop sees it by the time the action reaches its subscriber. Its other non-empty arm is
    // image pastes (`_8t` 863568); this composer stores text pastes only.
    if (action === 'chat:sendNow') {
      if (this.sourcePicker?.snapshot.searching) { this.emit('action', action); return true; }
      this.resetKillMode();
      if (this.editor.text.trim() !== ''
        || Object.keys(referencedPastes(this.editor.text, this.editor.pastedContents)).length > 0)
        this.dispatch({ type: 'submit' });
      this.emit('action', action); return true;
    }
    if (action === 'app:interrupt' && !this.dialog && this.screen !== 'search' && this.hasTextSelection()) {
      this.copySelection(true); return true;
    }
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
        if (this.footerSelection !== 'ideSelection') return false;
        this.footerSelection = null; this.diffSelection.dismiss(); this.render(); return true;
      case 'footer:up': this.moveFooter(-1, true); return true;
      case 'footer:previous': this.moveFooter(-1); return true;
      case 'footer:next': this.moveFooter(1); return true;
      case 'footer:down':
        if (this.moveFooter(1)) return true;
        if (this.footerSelection !== 'tasks') return true;
      case 'footer:openSelected':
        if (this.footerSelection === 'tasks') {
          this.footerSelection = null; this.openBackgroundTasks(); this.render();
        }
        return true;
      case 'footer:clearSelection':
        this.footerSelection = null; this.queueEditIndex = null; this.render(); return true;
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
      // GZ/onExit, 24k7d6mw [141280,142056), UTF-16; legacy row anchors belong to the departing frame.
      case 'app:toggleTranscript':
        this.selection = createSelection();
        this.screen = this.screen === 'transcript' ? 'chat' : 'transcript';
        this.render(); return true;
      case 'transcript:exit':
        this.selection = createSelection(); this.screen = 'chat'; this.render(); return true;
      case 'transcript:toggleShowAll':
        this.selection = createSelection();
        this.visibleTranscript = { ...this.visibleTranscript, showAll: !this.visibleTranscript.showAll };
        this.render(); return true;
      case 'scroll:lineUp': case 'scroll:lineDown': case 'scroll:halfPageUp': case 'scroll:halfPageDown':
      case 'scroll:fullPageUp': case 'scroll:fullPageDown': case 'scroll:pageUp': case 'scroll:pageDown':
      case 'scroll:top': case 'scroll:bottom': {
        // rI/pee/bbt, 24k7d6mw [126888,132084), UTF-16; explicit bottom forces sticky.
        this.transcriptScroll.scroll(action.slice('scroll:'.length) as TranscriptScrollCommand);
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
      // `Bq` (chunk-24k7d6mw.js 886226): the queue-submit chord hands the draft back as a queued
      // submission; locally a queued prompt drains as soon as the loop is free.
      case 'chat:queueSubmit': this.dispatch({ type: 'submit' }); return true;
      case 'chat:newline': this.dispatch({ type: 'newline' }); return true;
      case 'chat:undo': this.dispatch({ type: 'undo' }); return true;
      // Source `yM` (chunk-24k7d6mw.js 881185): the clear chords bump a counter whose only
      // effect is `oi().get(process.stdout)?.forceRedraw()` (effect at 874706). The action map at
      // 887385 binds both `chat:clearInput` and `chat:clearScreen` to that one handler, so the
      // chords clear the screen and repaint; the draft, undo stack and modal state stay. Locally
      // `TuiRenderer.invalidate()` reproduces the alt-screen branch of that reset: full frame
      // reset, erase of the painted rows, then the repaint (src/tui-renderer.ts:193).
      case 'chat:clearInput': case 'chat:clearScreen':
        this.renderer?.invalidate(); this.render(); return true;
      // Source footer handler `Jr` (chunk-24k7d6mw.js 435644): `ane` (429125) counts running
      // background work. With none, the immediate `kill-agents-none` row lasts 2000 ms; otherwise
      // the first press arms the double-press confirmation for `mFe` (3000 ms) and a second press
      // inside that window clears it and stops the jobs.
      case 'chat:killAgents': this.killAgents(); return true;
      case 'chat:stash': this.stashDraft(); return true;
      case 'chat:workflowKeywordToggle': return this.toggleWorkflowKeyword();
      case 'chat:modelPicker': case 'chat:thinkingToggle': case 'app:toggleTodos': case 'chat:externalEditor': return true;
      default: return false;
    }
  }

  /**
   * Source `bZ`/`QE` (chunk-24k7d6mw.js 84305/815713): the composer's mode. Bash mode paints the
   * pointer `!` and the `bashBorder`, and its value carries no marker of its own. `replace` swaps
   * the draft in the same transition, so a typed `!` never enters the value.
   */
  private setComposerMode(mode: ComposerMode, replace?: string): void {
    const changed = mode !== this.composerMode;
    this.composerMode = mode;
    if (replace !== undefined) {
      this.undo.clear();
      this.replaceDraft({ ...this.editor, text: replace, cursor: replace.length,
        historyIndex: this.editor.history.length, historyDraft: replace, historyDraftPastes: this.editor.pastedContents });
      this.publishDraft();
    }
    if (changed) this.render();
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
    // Source `qq` (chunk-24k7d6mw.js 843876): the non-empty branch stashes, latches
    // `hasUsedStash` through `bJt`, clears the tip (`af`) and records `input_stash`. The
    // restored-draft branch pops the slot; the restore notice belongs to the submit and
    // post-command paths (`#s`), not to this chord, so the swap itself reports nothing.
    if (current) {
      this.clearStatusNotice('stash-hint');
      if (this.options.userDir !== undefined) {
        try { markStashUsed(this.options.userDir); } catch { /* a latch that cannot be written does not block the swap */ }
      }
    }
    // The source store notifies its subscribers after the swap; this terminal's composer is drawn
    // from the editor it just replaced, so the frame is repainted here.
    this.render();
  }

  /**
   * Source `Yc` (chunk-24k7d6mw.js 828570): a draft shrinking from at least 20 characters to at
   * most 5 raises `Tip: ctrl+s to stash` for `XS` (5000 ms), once, until a stash latches
   * `hasUsedStash`. `Pr` is the keyed notification store, which this terminal models as its one
   * status row; `Cl` is that row's clear.
   */
  private stashTip(length: number): void {
    if (!this.stashHint.observe(length)) return;
    if (this.options.userDir !== undefined && hasUsedStash(this.options.userDir)) return;
    this.showStatusNotice('stash-hint', stashHintText(chordForAction('chat:stash', 'Chat', 'ctrl+s')),
      STASH_HINT_TIMEOUT_MS);
  }

  /**
   * Source `#s` (chunk-24k7d6mw.js 1495345) and the submit path at 1492930: when a stashed draft
   * is waiting and the composer is empty, the slot is popped back into the draft and
   * `{key:"stash-restored",kind:"feedback",text:"Draft restored",priority:"high",timeoutMs:5000}`
   * is raised. Returns whether anything was restored.
   */
  restoreStashedDraft(notice = true): boolean {
    if (this.closed || this.stashedDraft === undefined || this.editor.text.trim() !== '') return false;
    const restored = this.stashedDraft;
    this.stashedDraft = undefined;
    this.undo.clear();
    this.replaceDraft({ ...this.editor, text: restored.text, cursor: restored.cursor,
      pastedContents:structuredClone(restored.pastedContents),
      historyIndex: this.editor.history.length, historyDraft: restored.text,
      historyDraftPastes:structuredClone(restored.pastedContents) });
    if (notice) this.showStatusNotice('stash-restored', STASH_RESTORED, STASH_RESTORED_TIMEOUT_MS);
    this.render();
    return true;
  }

  /** Move the selection focus by a line/cell delta, clamping to the transcript. */
  private extendSelection(dx: number, dy: number): void {
    if (this.renderer?.selectionInstance.hasTextSelection()) {
      const direction = !Number.isFinite(dx) ? dx < 0 ? 'lineStart' : 'lineEnd'
        : dy ? dy < 0 ? 'up' : 'down' : dx < 0 ? 'left' : 'right';
      this.renderer.selectionInstance.moveSelectionFocus(direction); this.render(); return;
    }
    const view = this.viewportSize();
    const lines = transcriptLines(this.visibleTranscript, view.columns, this.renderEntryRows, this.welcomePreamble(view.columns));
    if (!lines.length) return;
    const from = this.selection.focus ?? this.selection.anchor ?? this.anchorAt(1, 1)!;
    if (!this.selection.anchor) this.selection = reduceSelection(this.selection, { type: 'start', at: from });
    const line = Math.max(0, Math.min(from.line + dy, lines.length - 1));
    const text = lines[line]!;
    const column = !Number.isFinite(dx) ? selectionColumn(text, dx < 0 ? 0 : Infinity)
      : dy ? selectionColumn(text, from.column) : moveSelectionColumn(text, from.column, dx);
    this.selection = reduceSelection(this.selection, { type: 'extend', to: { line, column } });
    const viewport = layoutTranscript(this.visibleTranscript, view.columns, view.rows, this.renderEntryRows,
      this.welcomePreamble(view.columns));
    // rI/Mt, 24k7d6mw [126888,130997), UTF-16; selection scrolling leaves the sticky tail.
    if (line < viewport.offset) this.transcriptScroll.reveal(line);
    else if (line >= viewport.offset + view.rows) this.transcriptScroll.reveal(line - view.rows + 1);
    this.render();
  }

  private hasTextSelection(): boolean {
    return this.renderer?.selectionInstance.hasTextSelection() === true
      || this.selection.anchor !== null && this.selection.focus !== null;
  }

  private selectionChanged(): void {
    if (this.closed || this.dialog || this.screen === 'search' || this.editorSuspended || this.editorController) {
      this.selectionCopy.reset(); return;
    }
    try { this.selectionCopy.change(); }
    catch (error) { this.setStatus(error instanceof Error ? error.message : String(error)); }
  }

  private selectionCopied(text: string): void {
    const feedback = selectionCopyFeedback(text);
    this.showStatusNotice('selection-copied', feedback.text, feedback.timeoutMs);
  }

  private copySelectionNoClear(): string {
    const native = this.renderer?.selectionInstance;
    if (native?.hasTextSelection()) return native.copySelectionNoClear();
    const view = this.viewportSize();
    const rows = renderedTranscriptRows(this.visibleTranscript, view.columns, this.renderEntryRows, this.welcomePreamble(view.columns));
    const text = selectionTextFromRows(this.selection, rows as readonly SelectionRow[]);
    if (text) copySelectionText(text, payload => { this.options.output.write(payload); });
    return text;
  }

  // rI Ctrl+C, 24k7d6mw [126888,130997), UTF-16; cached auto-copy only clears and reports.
  private copySelection(cached = false): void {
    try {
      const text = cached ? this.selectionCopy.peek() ?? this.copySelectionNoClear() : this.copySelectionNoClear();
      this.selection = createSelection();
      if (text) this.selectionCopied(text);
      else this.render();
    } catch (error) { this.setStatus(error instanceof Error ? error.message : String(error)); }
  }

  private ensureRenderer(): TuiRenderer {
    if (!this.renderer) {
      this.renderer = new TuiRenderer(this.options.output, this.options.synchronizedUpdate ?? true, () => {
        if (!this.closed) {
          try { this.render(); } catch (error) { this.onError(error instanceof Error ? error : new Error(String(error))); }
        }
      });
      this.renderer.selectionInstance.subscribeToSelectionChange(() => {
        if (this.selection.anchor === null) this.selectionChanged();
      });
    }
    return this.renderer;
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
    if (this.dialog?.modelPicker) this.dialog.modelPicker.pressed = undefined;
    if (this.dialog?.copyPicker) this.dialog.copyPicker.pressed = undefined;
    if (this.dialog?.configPanel) this.dialog.configPanel.pressed = undefined;
    this.selection = createSelection(); this.diffPointer = undefined; this.footerPointer = undefined; this.scrollPointer = undefined;
    this.renderer?.hover(-1, -1); this.renderer?.clearNativeSelection(); this.render();
  };

  /**
   * Records the answer for the current step. A grouped request advances to the
   * next group, or to the review page after the last one; an ungrouped request
   * settles immediately, which is the pre-existing behaviour.
   */
  private advanceDialog(dialog: ActiveDialog, answer: TerminalPromptAnswer): void {
    const adjust = dialog.request.adjust;
    const settled = adjust === undefined ? answer
      : { ...answer, adjusted: adjust.values[dialog.adjustIndex] ?? adjust.initial,
        ...(adjust.toggle === undefined ? {} : { toggled: adjust.toggle.on }) };
    const groups = dialog.request.groups ?? [];
    if (!groups.length) {
      dialog.finish(dialog.request.backgroundTasks !== undefined && dialog.backgroundDetail === undefined
        ? { ...settled, backgroundTaskIndex: dialog.index } : settled);
      return;
    }
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

  /** bs/rS/Field, dag4qhha [40450,42182), qh0w98pn [55320,57047), czbq7s7d [1599,7850), UTF-16. */
  private renderConfigPanel(dialog: ActiveDialog, columns: number, rows: number): string[] {
    const panel = dialog.configPanel!, owner = panel.owner;
    this.documentRenderer ??= new TuiDocumentRenderer();
    const paint = (tree: unknown) => this.documentRenderer!.renderElement(tree, columns,
      { theme: this.theme.current, themeOverrides: this.theme.overrides }).map(row => row.ansi);
    const header = paint(jsx(n, { bold: true, color: 'remember', children: 'Config' }, undefined));
    const query = owner.queryDisplay(columns);
    const search = paint(jsx(s, { borderStyle: 'round', borderColor: owner.searching ? 'suggestion' : undefined,
      paddingX: 1, children: jsx(n, { dimColor: !owner.searching, wrap: 'truncate-end',
        children: `⌕ ${query.text || 'Search settings…'}` }, undefined) }, undefined));
    const guide = owner.searching ? 'Type to filter / Enter or Down select / Esc clear'
      : 'Enter/Space change / Left/Right adjust / / search / Esc close';
    const notice = owner.busy ? 'Saving settings…' : owner.error;
    const notices = notice === undefined ? [] : paint(jsx(n, { color: owner.error ? 'warning' : undefined,
      children: notice }, undefined));
    const height = Math.max(1, rows - header.length - search.length - notices.length - 5);
    const body = owner.render(columns, height, paint);
    panel.searchRows = new Set(search.map((_row, index) => header.length + index));
    panel.hits = new Map(body.hits.map(hit => [header.length + search.length + 1 + hit.row,
      { id: hit.id, valueColumn: hit.valueColumn }]));
    const frame = [...header, ...search, '', ...body.lines];
    while (frame.length < rows - notices.length - 3) frame.push('');
    frame.push(...notices, SEPARATOR.repeat(columns), pad(guide, columns), ...this.footerRows(columns));
    return frame;
  }

  /** uBe/Yi, 24k7d6mw [617998,624627), yygmb66g [41667,54367), UTF-16. */
  private renderModelPicker(dialog: ActiveDialog, columns: number, bodyRows: number): string[] {
    const picker = dialog.modelPicker!;
    const owner = picker.owner;
    const content: string[] = [];
    this.documentRenderer ??= new TuiDocumentRenderer();
    const paint = (tree: unknown) => this.documentRenderer!.renderElement(tree, columns,
      { theme: this.theme.current, themeOverrides: this.theme.overrides });
    const caption = paint(jsx(n, { dimColor: true, children: dialog.request.message }, undefined));
    const effort = paint(jsx(s, { flexDirection: 'column', children: owner.footer() }, undefined));
    const terminalRows = this.options.output.rows ?? 24;
    const minimumListRows = Math.min(2, owner.options.length) * 2 + (owner.options.length > 2 ? 1 : 0);
    const height = Math.max(0, Math.min(terminalRows - 5,
      Math.max(bodyRows, caption.length + effort.length + minimumListRows + 2)));
    const captionBudget = Math.max(0, height - effort.length - minimumListRows - 2);
    content.push(...caption.slice(0, captionBudget).map(row => row.ansi), '');
    const listBudget = Math.max(0, height - content.length - effort.length - 1);
    let visibleCount = Math.max(1, Math.min(10, Math.floor((terminalRows - 14) / 2), listBudget));
    let list = owner.render(columns, visibleCount);
    let renderedRows = list.rows.map(paint);
    while (visibleCount > 1 && renderedRows.reduce((total, rows) => total + rows.length, 0) > listBudget) {
      list = owner.render(columns, --visibleCount);
      renderedRows = list.rows.map(paint);
    }
    picker.hitRows.clear();
    for (const [index, rendered] of renderedRows.entries()) {
      const optionIndex = list.indices[index]!;
      for (const row of rendered) {
        if (content.length >= height - effort.length - 1) break;
        if (optionIndex >= 0) picker.hitRows.set(content.length + 1, optionIndex);
        content.push(row.ansi);
      }
    }
    content.push('', ...effort.map(row => row.ansi));
    const visible = content.slice(0, height);
    while (visible.length < height) visible.push('');
    const title = paint(jsx(n, { color: 'remember', bold: true, children: dialog.request.title ?? 'Select model' }, undefined));
    return [...title.map(row => row.ansi), ...visible, SEPARATOR.repeat(columns), '', pad(modelPickerGuide(dialog.request.modelPicker?.setDefault), columns)];
  }

  /** Jln, chunk-er09v3xa.js 9331, over this product's dialog frame. */
  private renderResumePicker(dialog: ActiveDialog, columns: number, bodyRows: number): string[] {
    const picker = dialog.resumePicker!.owner;
    picker.setWidth(Math.max(20, columns - 4));
    picker.clamp();
    this.documentRenderer ??= new TuiDocumentRenderer();
    const paint = (tree: unknown) => this.documentRenderer!.renderElement(tree, columns,
      { theme: this.theme.current, themeOverrides: this.theme.overrides }).map(row => row.ansi);
    if (picker.previewing) {
      // `Ct` (chunk-er09v3xa.js 2632; preview branch 15806): the preview page replaces the picker
      // frame. The source renders the stored messages through the transcript screen (`gie`, screen
      // "transcript", history "all"); this host has no free-standing transcript surface, so the
      // same messages are laid out as plain rows.
      const session = picker.previewSession;
      const data = picker.preview;
      const width = Math.max(10, columns - 4);
      const wrapped: string[] = [];
      for (const message of data.messages) {
        const text = message.text.trim();
        if (text === '') continue;
        const prefix = message.role === 'user' ? '> ' : '  ';
        for (const paragraph of text.split(/\r?\n/)) {
          if (paragraph === '') { wrapped.push(''); continue; }
          let line = '';
          for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(paragraph)) {
            if (cellWidth(line) + cellWidth(segment) > width - 2) { wrapped.push(prefix + line); line = segment; }
            else line += segment;
          }
          wrapped.push(prefix + line);
        }
        wrapped.push('');
      }
      const height = Math.max(1, bodyRows - 3);
      const visible = wrapped.slice(0, height);
      while (visible.length < height) visible.push('');
      const info = session === undefined ? '' :
        `${resumeRelativeTime(session.updated, picker.now)} · ${data.messageCount} messages`;
      return [...visible.map(row => pad(row, columns)), SEPARATOR.repeat(columns), '',
        pad(info, columns), pad(resumePickerGuide('preview'), columns)];
    }
    const title = paint(jsx(n, { bold: true, color: 'remember',
      children: dialog.request.title ?? 'Resume session' }, undefined));
    const search = paint(jsx(s, { borderStyle: 'round', borderColor: picker.searching ? 'suggestion' : undefined,
      paddingX: 1, children: jsx(n, { dimColor: !picker.searching, wrap: 'truncate-end',
        children: `⌕ ${picker.query || 'Type to search'}` }, undefined) }, undefined));
    const height = Math.max(1, bodyRows - title.length - search.length - 4);
    const rows = picker.rows;
    const visibleCount = Math.max(1, Math.floor(height / 2));
    const start = Math.max(0, Math.min(Math.max(0, rows.length - visibleCount),
      picker.focusIndex - Math.floor(visibleCount / 2)));
    const body: string[] = [];
    dialog.resumePicker!.hits.clear();
    if (picker.renaming) {
      body.push('  Rename session:', '');
      body.push(`  ${picker.renameValue === '' ? picker.renamePlaceholder : picker.renameValue}▏`);
      if (picker.renameError !== undefined) body.push('', `  ${picker.renameError}`);
    } else if (rows.length === 0) {
      body.push(picker.empty ? RESUME_EMPTY_TEXT : resumeNoMatchText(picker.query));
    } else {
      for (const [offset, row] of rows.slice(start, start + visibleCount).entries()) {
        const index = start + offset;
        body.push(`${index === picker.focusIndex ? '> ' : '  '}${row.label}`);
        body.push(`  ${row.description}`);
        dialog.resumePicker!.hits.set(title.length + search.length + 1 + body.length - 2, index);
      }
    }
    while (body.length < height) body.push('');
    return [...title, ...search, '', ...body.slice(0, height), SEPARATOR.repeat(columns), '',
      pad(resumePickerGuide(picker.modeName), columns)];
  }

  /** fLt focus id/index and V(tjt), 24k7d6mw [674472,675750)/[677240,678145), UTF-16. */
  // kG [633300,637661), same module/units: running-agent gate feeds the existing task-loss owner.
  // fLt/kG, 24k7d6mw [674472,675750)/[633300,637661), UTF-16: live refresh preserves available callbacks.
  private refreshBackgroundDialog(): void {
    const dialog = this.dialog, read = dialog?.request.backgroundTasks;
    if (dialog === undefined || read === undefined) return;
    if (dialog.backgroundDetail !== undefined) {
      const snapshot = dialog.request.backgroundTaskDetail?.();
      dialog.backgroundDetail.snapshot = snapshot;
      if (snapshot === undefined || !taskDetailRunning(snapshot)) {
        dialog.finish({ selected: [], key: 'gone' }); return;
      }
      const frame = taskDetailFrame(snapshot, Math.max(20, this.options.output.columns ?? 80));
      dialog.request.title = frame.title;
      dialog.request.message = frame.lines.join('\n');
      dialog.request.choices = undefined;
      dialog.request.readOnly = true;
      dialog.request.keys = [{ key: 'x', label: 'stop' },
        ...(snapshot.kind === 'agent' ? (dialog.request.keys ?? []).filter(key => key.key === 'f') : [])];
      return;
    }
    const previous = dialog.request.choices ?? [];
    const selected = previous[dialog.index]?.value;
    const next = backgroundTaskRequest(read());
    const choices = next.choices ?? [];
    const index = selected === undefined ? -1 : choices.findIndex(choice => choice.value === selected);
    if (selected !== undefined && index < 0) dialog.backgroundFocusLost = true;
    dialog.request.message = next.message;
    dialog.request.choices = next.choices;
    dialog.request.keys = next.keys;
    dialog.request.readOnly = next.readOnly;
    dialog.index = index < 0 ? Math.max(0, Math.min(dialog.index, choices.length - 1)) : index;
    if (selected !== choices[dialog.index]?.value) dialog.followFocus = true;
  }

  private renderCopyPicker(dialog: ActiveDialog, columns: number, bodyRows: number): string[] {
    const picker = dialog.copyPicker!, owner = picker.owner;
    this.documentRenderer ??= new TuiDocumentRenderer();
    const paint = (tree: unknown) => this.documentRenderer!.renderElement(tree, columns,
      { theme: this.theme.current, themeOverrides: this.theme.overrides }).map(row => row.ansi);
    const caption = paint(jsx(n, { dimColor: true, children: 'Select content to copy:' }, undefined));
    const height = Math.max(1, bodyRows - caption.length - 3);
    const body = owner.render(columns, height, paint);
    picker.hitRows = new Map([...body.hits].map(([row, index]) => [row + caption.length + 1, index]));
    for (const [row, last] of body.edges) if (row < height) picker.hitRows.set(row + caption.length + 1, last ? -2 : -1);
    return [...caption, '', ...body.lines, '', ...paint(jsx(n, { dimColor: true,
      wrap: 'truncate-end', children: owner.guide }, undefined))];
  }

  // kG.f, 24k7d6mw [633300,637661), UTF-16: advertise the mounted local-agent callback.
  private renderDialog(columns: number, bodyRows: number): string[] {
    const dialog = this.dialog!;
    if (dialog.resumePicker) return this.renderResumePicker(dialog, columns, bodyRows);
    if (dialog.modelPicker) return this.renderModelPicker(dialog, columns, bodyRows);
    if (dialog.copyPicker) return this.renderCopyPicker(dialog, columns, bodyRows);
    if (dialog.backgroundDetail?.snapshot !== undefined) {
      const frame = taskDetailFrame(dialog.backgroundDetail.snapshot, columns);
      const height = Math.max(0, bodyRows);
      dialog.scroll = Math.min(dialog.scroll, Math.max(0, frame.lines.length - height));
      const visible = frame.lines.slice(dialog.scroll, dialog.scroll + height);
      while (visible.length < height) visible.push('');
      return [frame.title, ...visible, SEPARATOR.repeat(columns), '',
        'Left go back / Esc Enter Space close / x stop / PgUp/PgDn'
          + (dialog.backgroundDetail.snapshot.kind === 'agent' && dialog.request.keys?.some(key => key.key === 'f') ? ' / f view agent' : '')]
        .map(line => pad(line, columns));
    }
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
    const axis = dialog.request.adjust;
    // It, 76jkr621 [22174,30123), UTF-16: draw the standalone scale without a choice/input row.
    if (axis?.kind === 'slider') {
      this.documentRenderer ??= new TuiDocumentRenderer();
      const frame = Math.floor((Date.now() - (dialog.adjustClock?.startedAt ?? Date.now())) / 100);
      const scale = this.documentRenderer.renderElement(
        axis.render(axis.values[dialog.adjustIndex] ?? axis.initial, frame, this.prefersReducedMotion === true,
          axis.toggle === undefined ? undefined : { toggle: axis.toggle.on }), columns,
        { theme: this.theme.current, themeOverrides: this.theme.overrides });
      const visible = ['', ...scale.map(row => row.ansi)].slice(0, height);
      while (visible.length < height) visible.push('');
      return [pad(oneLine(title ?? 'Interaction'), columns), ...visible, SEPARATOR.repeat(columns), '',
        pad(dialog.error ?? axis.guide ?? 'Enter confirm / Esc cancel', columns),
        ...(countdown === undefined ? [] : [pad(countdown, columns)])];
    }
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
    // A request key is advertised beside the navigation hint so the panel names every action it
    // accepts; the recovered panels carry their own key row and this host draws one hint line.
    const keyHint = (dialog.request.keys ?? []).map(entry => `${entry.key} ${entry.label}`).join(' / ');
    const hint = readOnly ? (choices.length ? 'Enter next / Esc back / PgUp/PgDn' : 'Esc close / PgUp/PgDn')
      : dialog.notesEditing ? 'Notes · Enter save / Esc exit'
        : active.multiple ? 'Space toggle / Enter next / Esc cancel / PgUp/PgDn'
          : dialog.request.adjust?.guide ?? 'Enter next / Esc cancel / PgUp/PgDn';
    // The axis line sits under the selection, the way the recovered picker draws its
    // effort line between the list and the key guide.
    const axisLine = axis === undefined ? undefined : axis.label(axis.values[dialog.adjustIndex] ?? axis.initial);
    return [oneLine(title ?? 'Interaction'), ...visible, SEPARATOR.repeat(columns),
      readOnly && textEntry ? '' : textEntry || dialog.notesEditing ? answer : dialog.index === clarification ? 'Chat about this'
        : `Selected: ${oneLine(choices[dialog.index]?.label ?? '')}`,
      ...(axisLine === undefined ? [] : [axisLine]),
      dialog.error ?? (progress ? `${progress} · ${hint}` : keyHint === '' ? hint : `${hint} / ${keyHint}`),
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

  // rV/_6/E6, 24k7d6mw [164310,165246)/[1293039,1293366)/[1301960,1304882), UTF-16.
  private syncTerminalTitle(): void {
    this.terminalTitle.update({ sessionTitle: this.titleSession?.title,
      fromRename: this.titleSession?.config.terminalTitleFromRename,
      focused: this.focus.focused,
      active: this.isTTY && this.started && !this.closed && !this.editorSuspended,
      activity: { isLoading: this.progress.running, isQueryActive: this.progress.running,
        topDialogWaitingFor: this.dialog?.request.titleWaitingFor,
        isShowingLocalJSXCommand: this.dialog?.request.titleOrigin === 'local-command',
        isResponseStreaming: this.assistantMessage !== undefined } });
  }

  private render(): void {
    // `_$`'s `setLocalOverlayShowing` (chunk-24k7d6mw.js 1691779) is called with the dialog and
    // overlay flags on every render of the owning frame; the machine ignores an unchanged value.
    this.idleNotification?.setLocalOverlayShowing(this.composerOverlayShowing());
    this.syncTerminalTitle();
    // nmt's modal selection teardown and Ax click admission, 3gz7s57c [29232,37785), 06azbynj [242075,244661), UTF-16.
    if (this.dialog || this.screen === 'search' || this.sourceSearch?.snapshot.searching
      || this.sourcePicker?.snapshot.searching || this.editorSuspended) this.scrollPointer = undefined;
    if (this.screen !== 'chat') this.footerPointer = undefined;
    if (this.footerSelection !== null && (this.dialog || this.sourceSearch?.snapshot.searching
      || this.sourcePicker?.snapshot.searching || !this.footerItems().includes(this.footerSelection))) this.footerSelection = null;
    if (!this.isTTY || !this.started || this.closed || this.editorSuspended) { this.syncOwl(false); return; }
    if (this.dialog || this.screen !== 'chat' || this.sourceSearch?.snapshot.searching
      || this.sourcePicker?.snapshot.searching) this.syncOwl(false);
    // A queue that changed without a repaint (the loop drained a row) still owns the selection.
    this.syncQueueSelection();
    const columns = Math.max(20, this.options.output.columns ?? 80);
    const rows = Math.max(4, this.options.output.rows ?? 24);
    this.diffPanel?.setColumns(columns);
    this.statusLine.setVimMode(this.vim.mode); this.statusLine.refresh();
    this.statusLine.setActive(this.dialog === undefined && this.screen === 'chat' && !this.gestures.hint);
    this.progress.setVisible(this.dialog === undefined);
    if (this.dialog) {
      if (this.dialog.configPanel) {
        const owner = this.dialog.configPanel.owner;
        const frame = this.renderConfigPanel(this.dialog, columns, rows);
        this.drawFrame(frame, columns, rows, 2, Math.min(columns - 3,
          owner.queryDisplay(columns).column), owner.searching);
        return;
      }
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
      let transcriptRows = Math.max(0, Math.min(Math.floor(rows / 3), rows - 14 - afkRows));
      const frame = this.renderDialog(columns, rows - 5 - afkRows - transcriptRows);
      if (this.dialog.modelPicker) {
        transcriptRows = Math.max(0, rows - frame.length - 1 - afkRows);
      }
      if (this.dialog.modelPicker) this.dialog.modelPicker.hitRows = new Map(
        [...this.dialog.modelPicker.hitRows].map(([row, index]) => [row + transcriptRows, index]));
      if (this.dialog.copyPicker) this.dialog.copyPicker.hitRows = new Map(
        [...this.dialog.copyPicker.hitRows].map(([row, index]) => [row + transcriptRows, index]));
      // Us, 06azbynj [286619,287950), UTF-16; a smaller modal viewport must measure the same sticky owner.
      this.visibleTranscript = { ...this.visibleTranscript, offset: this.transcriptScroll.layout(
        this.transcriptTotal(columns), transcriptRows, this.visibleTranscript.entries) };
      const viewport = layoutTranscript(this.visibleTranscript, columns, transcriptRows, this.renderEntryRows,
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
      } else if (this.dialog.modelPicker || this.dialog.copyPicker || this.dialog.request.readOnly === true || this.dialog.request.adjust?.kind === 'slider')
        this.drawFrame(lines, columns, rows, answerRow, 0, false);
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
      const renderer = this.ensureRenderer();
      renderer.renderChat(listRows, prompt.lines, [pickerRows.at(-1) ?? ''], columns, rows, {row:target,
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
      this.visibleTranscript = { ...this.visibleTranscript, offset: this.transcriptScroll.layout(
        this.transcriptTotal(columns), height, this.visibleTranscript.entries) };
      const viewport=layoutTranscript(this.visibleTranscript,columns,height,this.renderEntryRows,this.welcomePreamble(columns));
      const frame=Array.from({length:height},(_,index)=>viewport.rows[index]?.ansi ?? pad('',columns));
      const target=rows-1;
      const renderer = this.ensureRenderer();
      renderer.renderChat(frame,prompt.lines,[queryRows.at(-1) ?? ''],columns,rows,{row:target,
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
    const statusRows = [...(this.agentView?.feedback === undefined ? [] : [pad(this.agentView.feedback, conversationWidth)]),
      ...this.renderStatusLine(conversationWidth, rows, Math.max(0, rows - prompt.lines.length - 4 - bannerRows - hintRows.length))];
    const progressRows = [...this.renderProgress(conversationWidth, rows,
      Math.max(0, rows - prompt.lines.length - 4 - bannerRows - statusRows.length - hintRows.length)), ...hintRows];
    const transcriptRows = Math.max(0, rows - prompt.lines.length - 3 - bannerRows - progressRows.length - statusRows.length);
    // The hint rows are the tail of `progressRows`, so they sit directly above the composer.
    this.autocompleteBand = hintRows.length === 0 ? undefined : {
      top: transcriptRows + progressRows.length - hintRows.length,
      owners: this.autocompleteOwners };
    // p4/Us, 24k7d6mw [1333944,1336535), 06azbynj [286619,287950), UTF-16; one measured viewport owns the projection.
    this.transcriptScroll.onBelowTranscriptSlotChange(this.visibleRunning || progressRows.length > 0);
    const total = this.transcriptTotal(conversationWidth);
    this.visibleTranscript = { ...this.visibleTranscript,
      offset: this.transcriptScroll.layout(total, transcriptRows, this.visibleTranscript.entries) };
    this.syncOwl(!this.agentView && this.screen === 'chat' && transcriptRows >= WELCOME_ART_ROWS
      && this.visibleTranscript.offset === 0 && welcomeDensity(this.viewportSize().rows) === 'art');
    const viewport = layoutTranscript(this.visibleTranscript, conversationWidth, transcriptRows, this.renderEntryRows,
      this.welcomePreamble(conversationWidth));
    const pill = this.transcriptScroll.pill;
    if (pill === undefined) this.scrollPointer = undefined;

    const frame: string[] = [];
    for (let row = 0; row < transcriptRows; row++) {
      const rendered = viewport.rows[row];
      frame.push(rendered?.ansi ?? pad(rendered?.text ?? '', conversationWidth));
    }
    const target = transcriptRows + progressRows.length + bannerRows + 1 + prompt.cursorRow;
    const renderer = this.ensureRenderer();
    renderer.renderChat(frame, prompt.lines,
      width => this.statusFooter(width),
      columns, rows, { row: target, column: prompt.cursorColumn, visible: this.footerSelection === null }, this.visibleRunning,
      { state: this.selection, offset: viewport.offset, rows: transcriptRows }, this.theme.current, this.theme.overrides, progressRows, statusRows,
      sidebarWidth ? { width: sidebarWidth, element: this.diffPanel!.element(sidebarWidth, columns, rows,
        renderer.appContext, renderer.selectionInstance) } : undefined, banner, this.composerMode,
      this.composerBorderText(), this.footerStatus(), pill === undefined ? undefined : {
        count: pill.count, mouse: (this.options.mouseTracking ?? 'full') === 'full' && this.mouseSeen,
        onClick: () => { this.selection = createSelection(); this.transcriptScroll.jumpToNew(); this.render(); },
      });
    this.drawnRows = rows; this.cursorRow = Math.max(0, rows - 1 - target); this.cursorColumn = prompt.cursorColumn;
  }

  private syncOwl(visible: boolean): void {
    this.owl.update(visible && this.isTTY && this.started && !this.closed && !this.editorSuspended
      && this.focus.focused && !this.dialog && !this.hasTextSelection(),
    this.progress.running, this.prefersReducedMotion === true);
  }

  /**
   * The startup header (`Hee`) leads the transcript's rendered rows without being
   * an entry, so it stays in the log and scrolls with it instead of vanishing on
   * the first keystroke. The density follows the transcript's own row budget.
   */
  // c4 focused projection, 24k7d6mw [1330762,1333395), UTF-16: main welcome belongs to the main conversation.
  private welcomePreamble(columns: number): RenderedRow[] {
    if (this.agentView) return [];
    const density = welcomeDensity(this.viewportSize().rows);
    const version = this.options.version ?? '';
    const key = JSON.stringify([columns, density, version, this.theme.current, this.theme.overrides, this.owl.pose]);
    if (key !== this.welcomeKey) {
      this.welcomeRenderer ??= new TuiDocumentRenderer();
      this.welcomeRows = this.welcomeRenderer.renderElement(
        jsx(Welcome, { theme: this.theme.current, version, density, columns, pose: this.owl.pose }, undefined), columns,
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
    // Zee/Lns/gie, 24k7d6mw [210978,211342), j8hqhz0c [44085,44378), 3gz7s57c [185681,188242), UTF-16.
    if (this.agentView) return [];
    // Source `Y4` (chunk-24k7d6mw.js 1524370): the progress region holds every entry in the
    // store, so a drained shell's live row shares it with the agent's own progress.
    const drained = this.drainedShell === undefined ? [] : this.renderDrainedShell(columns, rows);
    const pinned = this.renderMaxEffortTip(columns);
    if (!this.progress.running && !this.progress.hasTasks) {
      this.progressRenderer?.renderElement(null, columns);
      this.progressHeight = drained.length + pinned.length;
      return [...drained, ...pinned].slice(0, maximum);
    }
    this.progressRenderer ??= new TuiDocumentRenderer();
    const content = this.progressRenderer.renderElement(this.progress.element(columns), columns,
      {theme:this.theme.current, themeOverrides:this.theme.overrides, terminalRows:rows}).map(row => row.ansi);
    const visible = [...drained, ...content, ...pinned].slice(0, maximum);
    this.progressHeight = visible.length;
    return visible;
  }

  /**
   * `FQ` (chunk-24k7d6mw.js 712145): while the session sits at `max` effort and the reminder is
   * on, a pinned row names the level and points at `/effort`. `kh` registers it as a pinned
   * notification keyed `max-effort`; this host has no notification store, so the row is drawn in
   * the progress band, which is where the pinned notifications land.
   */
  private renderMaxEffortTip(columns: number): string[] {
    if (this.screen !== 'chat' || this.effortFeedbackLevel !== 'max'
      || !maxEffortReminderEnabled()) return [];
    const text = maxEffortTip(MAX_EFFORT_NOTE);
    return [pad(text.length > columns ? text.slice(0, Math.max(0, columns - 1)) + '…' : text, columns)];
  }

  /**
   * Source `tTe` (chunk-24k7d6mw.js 1521987) with its body `fIe` (chunk-3yqee67r.js 1148): the
   * row a drained command owns while it runs. `tTe` puts the `<bash-input>` line first, which this
   * host already appended to the transcript at submit, so only `fIe`'s body and its three columns
   * are drawn here.
   */
  private renderDrainedShell(columns: number, rows: number): string[] {
    const snapshot = this.drainedShell!;
    const row = drainedShellRow({ ...snapshot, verbose: snapshot.verbose || this.verbose }, columns);
    this.progressRenderer ??= new TuiDocumentRenderer();
    const parts = row.running
      ? [jsx(n, { dimColor: true, children: 'Running\u2026 ' }, 'running'),
        ...(row.elapsed === null ? [] : [jsx(n, { dimColor: true, children: row.elapsed }, 'elapsed')])]
      : [jsx(n, { dimColor: true, children: row.text }, 'body'),
        jsx(s, { flexDirection: 'row', gap: 1, children: [
          ...(row.count === '' ? [] : [jsx(n, { dimColor: true, children: row.count }, 'count')]),
          ...(row.elapsed === null ? [] : [jsx(n, { dimColor: true, children: row.elapsed }, 'elapsed')]),
          ...(row.bytes === null ? [] : [jsx(n, { dimColor: true, children: row.bytes }, 'bytes')]),
        ] }, 'columns')];
    return this.progressRenderer.renderElement(jsx(s, { flexDirection: 'column', children: parts }, 'drained'),
      columns, { theme: this.theme.current, themeOverrides: this.theme.overrides, terminalRows: rows })
      .map(rendered => rendered.ansi);
  }

  /**
   * Source `showDrainedShellLine` (chunk-24k7d6mw.js 1372925): one row under the fixed
   * `drained-shell-line` id, replaced by the next command and removed when the command ends.
   */
  setDrainedShell(progress: import('./tools.js').ShellProgress | undefined): void {
    if (this.closed) return;
    const next = progress === undefined ? undefined
      : { ...progress, verbose: this.verbose };
    if (JSON.stringify(next) === JSON.stringify(this.drainedShell)) return;
    this.drainedShell = next;
    this.render();
  }

  private drawFrame(lines: readonly string[], columns: number, rows: number,
    row: number, column: number, visible: boolean): void {
    this.ensureRenderer().render(lines, columns, rows, { row, column, visible });
  }

  /** Hfe/hEe and D9, qfjvvwpv [11971,12618), 24k7d6mw [906888,907115), UTF-16. */
  private visibleFooterFeedback(): string | undefined {
    if (this.screen !== 'chat' || this.gestures.hint || this.statusNoticeText !== undefined
      || this.diffPanel?.visible || !this.dialog && this.autocompleteState().suggestions.length > 0) return;
    return this.externalEditorHintTimer === undefined ? this.effortFeedback?.text
      : `${chordForAction('chat:externalEditor', 'Chat', 'ctrl+g')} to edit in ${editorDisplayName(this.externalEditorHintCommand)}`;
  }

  /** WR/Pre/D9, 24k7d6mw [481073,481106)/[723972,724107)/[906888,907115), UTF-16. */
  private footerStatus(): FooterStatus {
    const visible = this.screen === 'chat' && !this.gestures.hint
      && (this.dialog !== undefined || this.autocompleteState().suggestions.length === 0);
    return { feedback: this.visibleFooterFeedback(), hasStash: visible && this.stashedDraft !== undefined };
  }

  private footerRows(columns: number): string[] {
    this.documentRenderer ??= new TuiDocumentRenderer();
    return this.documentRenderer.renderElement(
      footerElement(width => this.statusFooter(width), columns, this.footerStatus()), columns,
      { theme: this.theme.current, themeOverrides: this.theme.overrides }).map(row => row.ansi);
  }

  private statusHints(): string {
    return this.screen === 'transcript'
      ? 'ctrl+o chat  ctrl+e all  j/k scroll  q close'
      : 'ctrl+o transcript  ctrl+r search  ctrl+c interrupt';
  }

  /** LVe/pz/Lns, 24k7d6mw [768633,768681)/[770079,771241), j8hqhz0c [44085,44378), UTF-16. */
  private statusFooter(columns: number): Array<string | FooterPart> {
    if(this.gestures.hint)return [this.gestures.hint.slice(0,columns)];
    // Source `Fz` 760326: `if(Ct&&!Pt)` returns the dim `paste again to expand` row alone, before
    // the sparse/dense split and before the bash label, and `Pt` is the history-search flag. The
    // state is raised by the paste producer (`Bo(!0)`, 839453) for a collapse of at most `fVe`
    // characters and cleared after 8000 ms or by the expansion itself (`xl`, 821273). The source
    // keeps older status notices on the left; effort feedback owns the separate right column.
    if (this.showExpandPasteHint && this.screen !== 'search' && this.statusNoticeText === undefined) return ['paste again to expand'];
    // Source `Sce` 754626 and `LVe` 764050: bash mode replaces the row with its own label. The
    // dense footer paints `shell mode` dim and italic; this host's single footer row keeps the
    // label in the same `bashBorder` the sparse hint uses, so the mode reads the same either way.
    if (this.composerMode === 'bash' && this.screen === 'chat') return [{ text: SHELL_MODE_LABEL, color: 'bashBorder' }];
    const attachment = this.diffSelection.pending;
    if (attachment) return [pad(`${this.footerSelection === 'ideSelection' ? '> ' : ''}${attachment.lineCount} ${attachment.lineCount === 1 ? 'line' : 'lines'} from diff${attachment.filePath ? ` in ${attachment.filePath}` : ''}`, columns)];
    const background = this.backgroundLabel();
    const shortcuts = background === undefined && this.screen === 'chat' && !this.running && this.editor.text === ''
      && Math.floor(columns / 2) >= HELP_HINT_MIN_COLUMNS ? `${HELP_FOOTER_HINT}  ` : '';
    const taskHint = background === undefined || this.statusLineSetting && this.screen === 'chat' ? ''
      : this.footerSelection === 'tasks'
        ? `${chordForAction('footer:openSelected', 'Footer', 'enter')} to view tasks`
        : '↓ to manage';
    const taskHints = [this.running ? `${chordForAction('app:interrupt', 'Global', 'ctrl+c')} to interrupt` : '',
      taskHint].filter(Boolean).join(' · ');
    // Fz selection-copy, 24k7d6mw [768900,768948)/[769064,769330), UTF-16.
    const selectionHint = !this.copyOnSelect && this.hasTextSelection() && !this.dialog && this.screen !== 'search'
      ? 'ctrl+c to copy' : '';
    const hints = selectionHint || (this.statusLineSetting && this.screen === 'chat' ? ''
      : background !== undefined ? taskHints
        : this.running && this.screen === 'chat'
          ? `${chordForAction('app:interrupt', 'Global', 'ctrl+c')} to interrupt`
          : shortcuts + this.statusHints());
    const chip = this.permissionMode === undefined ? '' : modeChip(this.permissionMode);
    const chipWidth = chip === '' ? 0 : cellWidth(chip) + 3;
    const backgroundWidth = background === undefined ? 0 : cellWidth(background) + 3;
    const available = Math.max(0, columns - chipWidth - backgroundWidth);
    const shown = hints.slice(0, Math.min(hints.length, Math.floor(columns / 2), Math.max(0, available - 1)));
    const left = `${this.visibleRunning ? 'running' : 'ready'}${this.vimEnabled&&!this.statusLineSetting?.hideVimModeIndicator&&this.vim.mode!=='NORMAL'&&this.screen!=='search'?' -- '+this.vim.mode+' --':''}${this.status ? `  ${this.status}` : ''}`
      .slice(0, Math.max(0, available - shown.length - 1));
    const gap = Math.max(1, available - cellWidth(left) - shown.length);
    const parts: Array<string | FooterPart> = [];
    if (chip !== '') parts.push({ text: chip, color: modeColorSlot(this.permissionMode!) });
    if (background !== undefined) parts.push({ text: background, color: 'background',
      selected: this.footerSelection === 'tasks', onClick: this.openBackgroundTasks });
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
