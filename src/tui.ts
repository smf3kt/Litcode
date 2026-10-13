/**
 * Full-screen interaction layer.
 *
 * This is a rewrite, not a copy. The recovered application mounts a vendored
 * Ink fork — React plus `react-reconciler` HostConfig plus the Yoga layout
 * engine, `chunk-06azbynj.js`, 360288 bytes under SHA-256
 * 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd — and its
 * main interface module alone is `chunk-24k7d6mw.js` at 1716741 bytes, larger
 * than this entire product. Those modules are Bun bytecode-wrapped ESM served
 * from `/$bunfs/root/`, so running them would require a Bun-like host as well
 * as React and Yoga. Both conflict with this project's neutral, six-dependency,
 * Node-only surface (WORKFLOW.md section 1).
 *
 * What is ported instead: the mode sequences (`tui-modes.ts`, a copy), the
 * keybinding registry and its context layering (`tui-keys.ts`, copied tables),
 * the kill ring (`kill-ring.ts`, a copy), and the transcript viewport contract
 * (`tui-transcript.ts`, adapted). The frame composition below is new code and
 * reuses the existing cell-accurate editor layout from `terminal.ts`, so the
 * prompt keeps grapheme-correct wrapping.
 *
 * The class implements the same surface `TerminalInput` exposes, so the
 * interactive loop can drive either one without knowing which it has.
 */

import { EventEmitter } from 'node:events';
import { StringDecoder } from 'node:string_decoder';
import { Writable, type Readable } from 'node:stream';
import { formatHookTerminalSequence } from './hook-terminal.js';
import { createKillRing, nextYank, type KillRing } from './kill-ring.js';
import { TerminalModeController, type MouseTracking } from './tui-modes.js';
import { Keymap, contextStack, type TuiContext } from './tui-keys.js';
import type { TerminalMouseEvent } from './terminal-mouse.js';
import {
  createSelection, highlightSelection, moveSelectionColumn, reduceSelection, selectionColumn, selectionText,
  type SelectionAnchor, type SelectionState,
} from './tui-selection.js';
import { osc52Payload } from './clipboard-osc52.js';
import {
  createTranscriptState, layoutTranscript, reduceTranscript, transcriptLines,
  type TranscriptEntry, type TranscriptScrollCommand, type TranscriptState,
} from './tui-transcript.js';
import {
  cellWidth, createEditorState, layoutEditor, reduceEditor, TerminalKeyDecoder,
  type EditorAction, type EditorCommand, type EditorPolicy, type EditorState, type Keybindings, type TerminalCallbacks,
} from './terminal.js';

export interface TuiOptions extends EditorPolicy, TerminalCallbacks {
  input: Readable & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (raw: boolean) => unknown };
  output: Writable & { isTTY?: boolean; columns?: number; rows?: number };
  prompt?: string;
  continuationPrompt?: string;
  history?: readonly string[];
  keybindings?: Keybindings;
  mouseTracking?: MouseTracking;
  synchronizedUpdate?: boolean;
  /** Rows kept for the prompt box; the recovered app grows it with the draft. */
  promptRows?: number;
}

type TuiEvents = {
  submit: [text: string]; interrupt: []; exit: []; pasteRejected: [bytes: number]; inputError: [error: Error];
  action: [action: string];
};

export type TuiScreen = 'chat' | 'transcript' | 'search';

const SEPARATOR = '─';

export class TuiTerminal extends EventEmitter<TuiEvents> {
  readonly isTTY: boolean;
  /** Committed output (model text, command output) is appended to the transcript. */
  readonly outputStream: Writable;
  /** Status lines are held on the status row instead of scrolling the transcript. */
  readonly statusStream: Writable;

  private readonly modes: TerminalModeController;
  private readonly keys = new Keymap();
  private readonly wheelKeys = new Keymap();
  private readonly decoder: TerminalKeyDecoder;
  private escapeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly killRing: KillRing = createKillRing();
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
  private screen: TuiScreen = 'chat';
  private transcript: TranscriptState;
  private selection: SelectionState = createSelection();
  private status = '';
  private running = false;
  private searchQuery = '';
  private searchIndex = -1;
  private searchDraft = '';

  constructor(private readonly options: TuiOptions) {
    super();
    this.isTTY = Boolean(options.input.isTTY && options.output.isTTY && options.input.setRawMode);
    this.originalRaw = Boolean(options.input.isRaw);
    this.originalPaused = options.input.readableFlowing !== true;
    this.editor = createEditorState(options.historyLimit === 0 ? []
      : options.history?.slice(-Math.max(1, options.historyLimit ?? 100)));
    this.transcript = createTranscriptState();
    this.decoder = new TerminalKeyDecoder(options.keybindings, options.maxPasteBytes, true);
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
    return () => {
      if (callbacks.onSubmit) this.off('submit', callbacks.onSubmit);
      if (callbacks.onInterrupt) this.off('interrupt', callbacks.onInterrupt);
      if (callbacks.onExit) this.off('exit', callbacks.onExit);
    };
  }

  get state(): Readonly<EditorState> { return { ...this.editor, history: [...this.editor.history] }; }
  get currentScreen(): TuiScreen { return this.screen; }
  get transcriptState(): TranscriptState { return this.transcript; }

  /** Append one entry to the transcript, following the tail unless scrolled away. */
  append(entry: TranscriptEntry): void {
    const view = this.viewportSize();
    this.transcript = reduceTranscript(this.transcript, { type: 'append', entry },
      { rows: view.rows, total: this.transcriptTotal(view.columns) });
    this.render();
  }

  setStatus(text: string): void {
    // Status output arrives as whole lines; the row shows the newest one.
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(line => line.length > 0);
    this.status = lines.length ? lines.at(-1)! : this.status;
    this.render();
  }

  setRunning(running: boolean): void {
    this.running = running;
    this.dispatch({ type: 'running', value: running });
  }

  setKeybindings(keybindings: Keybindings = {}): void { this.decoder.setKeybindings(keybindings); }

  /** Zero-width hook effects bypass text layout and never change the input draft. */
  writeTerminalSequence(sequence: string): void {
    const validated = formatHookTerminalSequence(sequence);
    if (this.isTTY && validated && this.started) this.options.output.write(validated);
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
      }
    } catch (error) { this.close(); throw error; }
    return this;
  }

  /** Idempotent; restores the screen, the modes it set, and the input's raw state. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.escapeTimer) clearTimeout(this.escapeTimer);
    this.decoder.reset(); this.keys.reset();
    this.options.input.off('data', this.onData);
    this.options.input.off('end', this.onEnd);
    this.options.input.off('close', this.onEnd);
    this.options.input.off('error', this.onError);
    this.options.output.off('resize', this.onResize);
    try {
      if (this.isTTY && this.started) this.modes.leave();
    } finally {
      try {
        if (this.changedRaw) { this.changedRaw = false; this.options.input.setRawMode!(this.originalRaw); }
      } finally { if (this.started && this.originalPaused) this.options.input.pause(); }
    }
  }

  /** Append already-decoded text; used by the transcript sink. */
  write(text: string): boolean {
    if (!this.isTTY || !this.started || this.closed) return this.options.output.write(text);
    if (text) this.append({ kind: 'assistant', text: text.replace(/\n$/, '') });
    return true;
  }

  dispatch(action: EditorAction): void {
    if (this.closed) return;
    const transition = reduceEditor(this.editor, action, this.options);
    this.editor = transition.state;
    const submitted = transition.effects.find(effect => effect.type === 'submit');
    if (submitted) this.transcript = reduceTranscript(this.transcript,
      { type: 'append', entry: { kind: 'user', text: submitted.text } },
      { rows: this.viewportSize().rows, total: this.transcriptTotal(this.viewportSize().columns) });
    this.render();
    for (const effect of transition.effects) {
      if (effect.type === 'exit') { this.close(); this.emit('exit'); }
      else if (effect.type === 'submit') this.emit('submit', effect.text);
      else if (effect.type === 'interrupt') this.emit('interrupt');
      else this.emit('pasteRejected', effect.bytes);
    }
  }

  private viewportSize(): { columns: number; rows: number } {
    const columns = Math.max(20, this.options.output.columns ?? 80);
    const rows = Math.max(4, this.options.output.rows ?? 24);
    const promptRows = Math.max(1, Math.min(this.options.promptRows ?? 1, rows - 3));
    return { columns, rows: rows - promptRows - 2 };
  }

  private transcriptTotal(columns: number): number { return transcriptLines(this.transcript, columns).length; }

  private contexts(): TuiContext[] {
    return this.screen === 'chat' ? ['Chat', 'Scroll', 'Global'] : contextStack({ screen: this.screen });
  }

  private readonly onData = (chunk: string | Buffer) => {
    if (this.closed) return;
    if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = undefined; }
    for (const action of this.decoder.push(chunk)) {
      if (this.closed) return;
      if (action.type === 'mouse') { this.handleMouse(action); continue; }
      if (action.type === 'key') { this.routeKey(action.sequence, action.command); continue; }
      if (action.type === 'insert' && (this.screen === 'transcript' || this.keys.pendingChord)) {
        for (const character of action.text) {
          if (this.closed) return;
          this.routeKey(character);
        }
        continue;
      }
      // Explicit local keybinding commands and paste keep their decoded intent.
      if (action.type.startsWith('extend') || action.type === 'selectionCopy') {
        this.routeKey(chordSequence(action)!);
      } else this.dispatch(action);
    }
    if (!this.closed && this.decoder.pendingStandaloneEscape) {
      this.escapeTimer = setTimeout(() => {
        this.escapeTimer = undefined;
        this.decoder.flushEscape(); this.routeKey('\x1b');
      }, 50);
      this.escapeTimer.unref?.();
    }
  };

  private routeKey(sequence: string, command?: EditorCommand): void {
    if (this.closed || this.handleKey(sequence, command)) return;
    if (command) this.dispatch({ type: command });
    else if (sequence === '\t') this.dispatch({ type: 'insert', text: '    ' });
    else if (/^[^\u0000-\u001f\u007f]+$/u.test(sequence)) this.dispatch({ type: 'insert', text: sequence });
  }

  private handleKey(sequence: string, command?: EditorCommand): boolean {
    if (command === 'newline') { this.dispatch({ type: command }); return true; }
    const outcome = this.keys.push(sequence, this.contexts());
    if (outcome.kind === 'pending') return true;
    if (outcome.kind === 'none') {
      if (outcome.replay) {
        const replay = new TerminalKeyDecoder().push(outcome.replay);
        for (const action of replay) this.dispatch(action);
        return this.handleKey(sequence, command);
      }
      return false;
    }
    if (outcome.match.action === 'history:previous' || outcome.match.action === 'history:next') return false;
    return this.applyAction(outcome.match.action);
  }

  private handleMouse(event: TerminalMouseEvent): void {
    if (this.options.mouseTracking === 'off' || this.screen === 'search') return;
    const view = this.viewportSize();
    const inside = event.col >= 1 && event.col <= view.columns
      && event.row >= 1 && event.row <= view.rows;
    if (event.action === 'wheelup' || event.action === 'wheeldown') {
      if (!inside) return;
      const outcome = this.wheelKeys.push(event.action, ['Scroll', 'Global']);
      if (outcome.kind === 'match') this.applyAction(outcome.match.action);
      return;
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
      this.selection = reduceSelection(this.selection, { type: 'start', at: anchor });
    } else if (event.action === 'move') {
      this.selection = reduceSelection(this.selection, { type: 'drag', at: anchor });
    }
    this.render();
  }

  /** Map a terminal coordinate to the transcript line and cell it lands on. */
  private anchorAt(col: number, row: number): SelectionAnchor | null {
    const view = this.viewportSize();
    const viewport = layoutTranscript(this.transcript, view.columns, view.rows);
    const text = viewport.lines[row - 1];
    if (text === undefined) return null;
    return { line: row - 1 + viewport.offset, column: selectionColumn(text, col - 1) };
  }

  /** Actions with a local counterpart are handled; the rest are reported as unbound. */
  private applyAction(action: string): boolean {
    this.emit('action', action);
    switch (action) {
      case 'selection:copy': this.copySelection(); return true;
      case 'selection:extendLeft': this.extendSelection(-1, 0); return true;
      case 'selection:extendRight': this.extendSelection(1, 0); return true;
      case 'selection:extendUp': this.extendSelection(0, -1); return true;
      case 'selection:extendDown': this.extendSelection(0, 1); return true;
      case 'selection:extendLineStart': this.extendSelection(-Infinity, 0); return true;
      case 'selection:extendLineEnd': this.extendSelection(Infinity, 0); return true;
      case 'app:interrupt': this.dispatch({ type: 'interrupt' }); return true;
      case 'app:exit': this.close(); this.emit('exit'); return true;
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
      case 'historySearch:next': this.nextSearchMatch(); return true;
      case 'historySearch:accept': case 'historySearch:cancel': this.leaveSearch(false); return true;
      case 'historySearch:execute': this.leaveSearch(true); return true;
      case 'chat:submit': this.dispatch({ type: 'submit' }); return true;
      case 'chat:newline': this.dispatch({ type: 'newline' }); return true;
      case 'chat:clearInput':
        this.editor = { ...createEditorState(this.editor.history), running: this.editor.running };
        this.render(); return true;
      case 'chat:undo': this.undoKill(); return true;
      default: return false;
    }
  }

  /** Move the selection focus by a line/cell delta, clamping to the transcript. */
  private extendSelection(dx: number, dy: number): void {
    const view = this.viewportSize();
    const lines = transcriptLines(this.transcript, view.columns);
    if (!lines.length) return;
    const from = this.selection.focus ?? this.selection.anchor ?? this.anchorAt(1, 1)!;
    if (!this.selection.anchor) this.selection = reduceSelection(this.selection, { type: 'start', at: from });
    const line = Math.max(0, Math.min(from.line + dy, lines.length - 1));
    const text = lines[line]!;
    const column = !Number.isFinite(dx) ? selectionColumn(text, dx < 0 ? 0 : Infinity)
      : dy ? selectionColumn(text, from.column) : moveSelectionColumn(text, from.column, dx);
    this.selection = reduceSelection(this.selection, { type: 'extend', to: { line, column } });
    const viewport = layoutTranscript(this.transcript, view.columns, view.rows);
    if (line < viewport.offset) this.transcript = { ...this.transcript, offset: line };
    else if (line >= viewport.offset + view.rows) this.transcript = { ...this.transcript, offset: line - view.rows + 1 };
    this.render();
  }

  /** Copy the span through OSC 52, then take it down as the recovered app does. */
  private copySelection(): void {
    const text = selectionText(this.selection, transcriptLines(this.transcript, this.viewportSize().columns));
    if (!text) return;
    let payload: string;
    try { payload = osc52Payload(text); }
    catch (error) { this.setStatus((error as Error).message); return; }
    this.options.output.write(payload);
    this.selection = reduceSelection(this.selection, { type: 'clear' });
    this.setStatus('copy request sent');
  }

  private enterSearch(): void {
    this.selection = createSelection();
    this.screen = 'search';
    this.searchQuery = ''; this.searchIndex = -1; this.searchDraft = this.editor.text;
    this.render();
  }

  private nextSearchMatch(): void {
    const history = this.editor.history;
    if (!this.searchQuery) { this.searchQuery = this.editor.text; }
    for (let index = (this.searchIndex < 0 ? history.length : this.searchIndex) - 1; index >= 0; index--) {
      if (history[index]!.includes(this.searchQuery)) {
        this.searchIndex = index;
        this.editor = { ...this.editor, text: history[index]!, cursor: history[index]!.length };
        this.render(); return;
      }
    }
    this.searchIndex = -1;
    this.render();
  }

  private leaveSearch(execute: boolean): void {
    this.screen = 'chat';
    if (!execute) this.editor = { ...this.editor, text: this.searchDraft, cursor: this.searchDraft.length };
    this.searchQuery = ''; this.searchIndex = -1;
    this.render();
    if (execute) this.dispatch({ type: 'submit' });
  }

  /** Repeating the last movement after a kill continues the ring, as emacs yank-pop does. */
  private undoKill(): void {
    const pop = nextYank(this.killRing.state);
    if (!pop) return;
    this.killRing.dispatch({ type: 'yankPop' });
    const replacement = this.killRing.state.ring[(this.killRing.state.mode as { index: number }).index] ?? '';
    const text = this.editor.text.slice(0, pop.start) + replacement + this.editor.text.slice(pop.start + pop.length);
    this.editor = { ...this.editor, text, cursor: pop.start + replacement.length };
    this.killRing.dispatch({ type: 'updateYankLength', length: replacement.length });
    this.render();
  }

  private readonly onEnd = () => { if (!this.closed) { this.close(); this.emit('exit'); } };
  private readonly onError = (error: Error) => {
    this.close();
    try { this.emit('inputError', error); } finally { this.emit('exit'); }
  };
  private readonly onResize = () => { this.selection = createSelection(); this.render(); };

  private render(): void {
    if (!this.isTTY || !this.started || this.closed) return;
    const columns = Math.max(20, this.options.output.columns ?? 80);
    const rows = Math.max(4, this.options.output.rows ?? 24);
    const promptRows = Math.max(1, Math.min(this.options.promptRows ?? 1, rows - 3));
    const transcriptRows = rows - promptRows - 2;
    const viewport = layoutTranscript(this.transcript, columns, transcriptRows);
    const prompt = layoutEditor(this.editor, columns, this.options.prompt ?? '> ',
      this.options.continuationPrompt ?? '  ', promptRows);

    // Rows: transcript, separator, prompt box, status. A short prompt box is
    // bottom-aligned so the draft never appears to float mid-screen.
    const frame: string[] = [];
    for (let row = 0; row < transcriptRows; row++) {
      frame.push(highlightSelection(this.selection, pad(viewport.lines[row] ?? '', columns), viewport.offset + row));
    }
    frame.push(SEPARATOR.repeat(columns));
    const promptStart = promptRows - prompt.lines.length;
    for (let row = 0; row < promptRows; row++) {
      frame.push(pad(row < promptStart ? '' : prompt.lines[row - promptStart]!, columns));
    }
    frame.push(pad(this.statusRow(columns), columns));

    const body = `\x1b[H${frame.map(line => `${line}\x1b[K`).join('\r\n')}`;
    // Writing the frame leaves the cursor on the status row; walk back to the
    // prompt row the editor reports.
    const target = transcriptRows + 1 + prompt.cursorRow;
    const cursorUp = Math.max(0, rows - 1 - target);
    this.options.output.write(this.modes.frame(body));
    this.options.output.write(`\x1b[${cursorUp}A\r${prompt.cursorColumn ? `\x1b[${prompt.cursorColumn}C` : ''}\x1b[?25h`);
    this.drawnRows = rows; this.cursorRow = cursorUp; this.cursorColumn = prompt.cursorColumn;
  }

  private statusRow(columns: number): string {
    const hints = this.screen === 'transcript'
      ? 'ctrl+o chat  ctrl+e all  j/k scroll  q close'
      : 'ctrl+o transcript  ctrl+r search  ctrl+c interrupt';
    // The hints are the part a person needs when they are lost, so they keep as
    // much room as they need up to half the row, and status text is clipped
    // into what is left rather than allowed to push the hints off the screen.
    const shown = hints.slice(0, Math.min(hints.length, Math.floor(columns / 2)));
    const left = `${this.running ? 'running' : 'ready'}${this.status ? `  ${this.status}` : ''}`
      .slice(0, Math.max(0, columns - shown.length - 1));
    const gap = Math.max(1, columns - left.length - shown.length);
    return left + ' '.repeat(gap) + shown;
  }
}

/**
 * Render one screen row. Callers pass lines that the cell-accurate layouts
 * already bounded to `columns`, so this only pads; an over-long line is
 * truncated rather than allowed to wrap and desynchronise the frame.
 */
export function pad(line: string, columns: number): string {
  let text = '', width = 0;
  for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(line)) {
    const cells = cellWidth(segment);
    if (width + cells > columns) break;
    text += segment; width += cells;
  }
  return text + ' '.repeat(Math.max(0, columns - width));
}

/** The raw sequence for an editor action, used to consult the chord registry. */
export function chordSequence(action: EditorAction): string | undefined {
  switch (action.type) {
    case 'left': return '\x1b[D'; case 'right': return '\x1b[C';
    case 'up': return '\x1b[A'; case 'down': return '\x1b[B';
    case 'home': return '\x1b[H'; case 'end': return '\x1b[F';
    case 'backspace': return '\x7f'; case 'delete': return '\x1b[3~';
    case 'newline': return '\n'; case 'submit': return '\r';
    case 'extendLeft': return '\x1b[1;2D'; case 'extendRight': return '\x1b[1;2C';
    case 'extendUp': return '\x1b[1;2A'; case 'extendDown': return '\x1b[1;2B';
    case 'extendLineStart': return '\x1b[1;2H'; case 'extendLineEnd': return '\x1b[1;2F';
    case 'selectionCopy': return '\x1b[99;6u';
    case 'interrupt': return '\u0003'; case 'eof': return '\u0004'; case 'search': return '\u0012';
    default: return undefined;
  }
}

export function createTuiTerminal(options: TuiOptions): TuiTerminal { return new TuiTerminal(options); }
