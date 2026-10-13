import { EventEmitter } from 'node:events';
import { createInterface, type Interface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { Writable, type Readable } from 'node:stream';
import { formatHookTerminalSequence } from './hook-terminal.js';
import { MAX_MOUSE_REPORT_CHARS, parseTerminalMouse, type TerminalMouseEvent } from './terminal-mouse.js';

export const MAX_PASTE_BYTES = 256 * 1024;

export type EditorCommand = 'left' | 'right' | 'up' | 'down' | 'home' | 'end' | 'wordLeft' | 'wordRight'
  | 'backspace' | 'delete' | 'newline' | 'submit' | 'interrupt' | 'eof' | 'search'
  | 'extendLeft' | 'extendRight' | 'extendUp' | 'extendDown' | 'extendLineStart' | 'extendLineEnd'
  | 'selectionCopy';
export type EditorAction = { type: EditorCommand } | { type: 'insert' | 'paste'; text: string }
  | { type: 'running'; value: boolean } | { type: 'pasteRejected'; bytes: number } | TerminalMouseEvent
  | { type: 'key'; sequence: string; command?: EditorCommand };
export interface EditorState {
  text: string;
  /** UTF-16 offset, always on a grapheme boundary. */
  cursor: number;
  history: string[];
  historyIndex: number;
  historyDraft: string;
  running: boolean;
  interruptRequested: boolean;
}
export interface EditorPolicy {
  idleInterrupt?: 'clear-or-exit' | 'clear' | 'exit';
  historyLimit?: number;
  maxPasteBytes?: number;
}
export type EditorEffect = { type: 'submit'; text: string } | { type: 'interrupt' } | { type: 'exit' }
  | { type: 'pasteRejected'; bytes: number };

export function createEditorState(history: readonly string[] = []): EditorState {
  return { text: '', cursor: 0, history: history.map(cleanInput), historyIndex: history.length, historyDraft: '',
    running: false, interruptRequested: false };
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function previousBoundary(text: string, cursor: number): number {
  let previous = 0;
  for (const part of segmenter.segment(text)) {
    if (part.index >= cursor) break;
    previous = part.index;
  }
  return previous;
}
function nextBoundary(text: string, cursor: number): number {
  for (const part of segmenter.segment(text)) if (part.index > cursor) return part.index;
  return text.length;
}
function boundaryAtOrAfter(text: string, offset: number): number {
  for (const part of segmenter.segment(text)) if (part.index >= offset) return part.index;
  return text.length;
}

/** Approximate wcwidth, treating combining/ZWJ emoji as a single displayed cluster. */
export function cellWidth(text: string): number {
  let width = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (/^[\p{Mark}‍︎️\u0000-\u001f\u007f-\u009f]+$/u.test(segment)) continue;
    if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u.test(segment)
      && !segment.includes('︎')) { width += 2; continue; }
    const code = segment.codePointAt(0)!;
    width += code >= 0x1100 && (code <= 0x115f || code === 0x2329 || code === 0x232a
      || (code >= 0x2e80 && code <= 0xa4cf && code !== 0x303f)
      || (code >= 0xac00 && code <= 0xd7a3) || (code >= 0xf900 && code <= 0xfaff)
      || (code >= 0xfe10 && code <= 0xfe19) || (code >= 0xfe30 && code <= 0xfe6f)
      || (code >= 0xff00 && code <= 0xff60) || (code >= 0xffe0 && code <= 0xffe6)
      || (code >= 0x20000 && code <= 0x3fffd)) ? 2 : 1;
  }
  return width;
}

function cleanInput(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '');
}
function lineStart(text: string, cursor: number): number { return text.slice(0, cursor).lastIndexOf('\n') + 1; }
function lineEnd(text: string, cursor: number): number {
  const end = text.indexOf('\n', cursor); return end < 0 ? text.length : end;
}
function wordBoundary(text: string, cursor: number, direction: -1 | 1): number {
  const parts = [...segmenter.segment(text)];
  let index = parts.findIndex(part => part.index >= cursor);
  if (index < 0) index = parts.length;
  const isWord = (i: number) => /[\p{Letter}\p{Number}_]/u.test(parts[i]?.segment ?? '');
  if (direction < 0) {
    while (index > 0 && !isWord(index - 1)) index--;
    while (index > 0 && isWord(index - 1)) index--;
  } else {
    while (index < parts.length && isWord(index)) index++;
    while (index < parts.length && !isWord(index)) index++;
  }
  return parts[index]?.index ?? text.length;
}
function cursorAtCell(text: string, start: number, end: number, column: number): number {
  let width = 0, cursor = start;
  for (const part of segmenter.segment(text.slice(start, end))) {
    const next = cellWidth(part.segment);
    if (width + next > column) break;
    width += next; cursor = start + part.index + part.segment.length;
  }
  return cursor;
}

/** Pure editor transitions; side effects are explicitly returned for the IO adapter. */
export function reduceEditor(state: EditorState, action: EditorAction, policy: EditorPolicy = {}): {
  state: EditorState; effects: EditorEffect[];
} {
  let next = { ...state };
  const effects: EditorEffect[] = [];
  const replace = (start: number, end: number, text: string) => {
    next.text = state.text.slice(0, start) + text + state.text.slice(end);
    next.cursor = boundaryAtOrAfter(next.text, start + text.length);
    next.historyIndex = state.history.length; next.historyDraft = next.text;
  };
  switch (action.type) {
    case 'insert': case 'paste': {
      const bytes = Buffer.byteLength(action.text);
      if (bytes > Math.min(MAX_PASTE_BYTES, policy.maxPasteBytes ?? MAX_PASTE_BYTES)) {
        effects.push({ type: 'pasteRejected', bytes }); break;
      }
      replace(state.cursor, state.cursor, cleanInput(action.text)); break;
    }
    case 'pasteRejected': effects.push(action); break;
    case 'left': next.cursor = previousBoundary(state.text, state.cursor); break;
    case 'right': next.cursor = nextBoundary(state.text, state.cursor); break;
    case 'home': next.cursor = lineStart(state.text, state.cursor); break;
    case 'end': next.cursor = lineEnd(state.text, state.cursor); break;
    case 'wordLeft': next.cursor = wordBoundary(state.text, state.cursor, -1); break;
    case 'wordRight': next.cursor = wordBoundary(state.text, state.cursor, 1); break;
    case 'backspace': replace(previousBoundary(state.text, state.cursor), state.cursor, ''); break;
    case 'delete': replace(state.cursor, nextBoundary(state.text, state.cursor), ''); break;
    case 'newline': replace(state.cursor, state.cursor, '\n'); break;
    case 'up': case 'down': {
      const start = lineStart(state.text, state.cursor), end = lineEnd(state.text, state.cursor);
      const column = cellWidth(state.text.slice(start, state.cursor));
      if (action.type === 'up' && start > 0) {
        const previous = lineStart(state.text, start - 1);
        next.cursor = cursorAtCell(state.text, previous, start - 1, column);
      } else if (action.type === 'down' && end < state.text.length) {
        next.cursor = cursorAtCell(state.text, end + 1, lineEnd(state.text, end + 1), column);
      } else {
        const index = Math.max(0, Math.min(state.history.length,
          state.historyIndex + (action.type === 'up' ? -1 : 1)));
        if (index === state.historyIndex) break;
        if (state.historyIndex === state.history.length) next.historyDraft = state.text;
        next.historyIndex = index;
        next.text = index === state.history.length ? next.historyDraft : state.history[index]!;
        // Keep repeated history browsing at the appropriate multiline boundary.
        next.cursor = action.type === 'up' ? lineEnd(next.text, 0) : next.text.length;
      }
      break;
    }
    case 'search': {
      const query = state.historyIndex === state.history.length ? state.text : state.historyDraft;
      for (let index = state.historyIndex - 1; index >= 0; index--) {
        if (state.history[index]!.includes(query)) {
          next.historyDraft = query; next.historyIndex = index; next.text = state.history[index]!;
          next.cursor = next.text.length; break;
        }
      }
      break;
    }
    case 'submit': {
      effects.push({ type: 'submit', text: state.text });
      const limit = Math.max(0, Math.floor(policy.historyLimit ?? 100));
      const history = state.text.trim() && state.history.at(-1) !== state.text
        ? [...state.history, state.text].slice(-Math.max(1, limit)) : [...state.history];
      next = { ...createEditorState(limit === 0 ? [] : history), running: state.running,
        interruptRequested: state.interruptRequested }; break;
    }
    case 'running': next.running = action.value; next.interruptRequested = false; break;
    case 'interrupt':
      if (state.running) {
        if (!state.interruptRequested) { next.interruptRequested = true; effects.push({ type: 'interrupt' }); }
      } else if (policy.idleInterrupt === 'exit' || (!state.text && policy.idleInterrupt !== 'clear')) {
        effects.push({ type: 'exit' });
      } else next = createEditorState(state.history);
      break;
    case 'eof': if (!state.running) effects.push({ type: 'exit' }); break;
  }
  return { state: next, effects };
}

/** Overrides map literal input sequences to commands; null unbinds a default key. */
export type Keybindings = Readonly<Record<string, EditorCommand | null>>;
const EDITOR_COMMANDS: readonly EditorCommand[] = ['left', 'right', 'up', 'down', 'home', 'end',
  'wordLeft', 'wordRight', 'backspace', 'delete', 'newline', 'submit', 'interrupt', 'eof', 'search',
  'extendLeft', 'extendRight', 'extendUp', 'extendDown', 'extendLineStart', 'extendLineEnd', 'selectionCopy'];

/** Validate a parsed local JSON keybinding map without reading settings files. */
export function decodeTerminalKeybindings(value: unknown): Keybindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Keybindings must be an object');
  const bindings: Record<string, EditorCommand | null> = Object.create(null);
  for (const [sequence, command] of Object.entries(value)) {
    if (!sequence || sequence.length > 64) throw new Error('Keybinding sequences must contain 1 to 64 characters');
    if (command !== null && !EDITOR_COMMANDS.includes(command as EditorCommand)) {
      throw new Error(`Unknown terminal command: ${String(command)}`);
    }
    bindings[sequence] = command as EditorCommand | null;
  }
  return bindings;
}
const DEFAULT_KEYS: Keybindings = {
  '\r': 'submit', '\n': 'submit', '\u0003': 'interrupt', '\u0004': 'eof', '\u0012': 'search',
  '\u007f': 'backspace', '\b': 'backspace', '\u0001': 'home', '\u0005': 'end',
  '\u0002': 'left', '\u0006': 'right', '\x1bb': 'wordLeft', '\x1bf': 'wordRight',
  '\x1b[A': 'up', '\x1b[B': 'down', '\x1b[C': 'right', '\x1b[D': 'left',
  '\x1bOA': 'up', '\x1bOB': 'down', '\x1bOC': 'right', '\x1bOD': 'left',
  '\x1b[H': 'home', '\x1b[F': 'end', '\x1bOH': 'home', '\x1bOF': 'end',
  '\x1b[1~': 'home', '\x1b[4~': 'end', '\x1b[7~': 'home', '\x1b[8~': 'end',
  '\x1b[3~': 'delete', '\x1b[1;5D': 'wordLeft', '\x1b[1;5C': 'wordRight',
  '\x1b[1;2D': 'extendLeft', '\x1b[1;2C': 'extendRight', '\x1b[1;2A': 'extendUp', '\x1b[1;2B': 'extendDown',
  '\x1b[1;2H': 'extendLineStart', '\x1b[1;2F': 'extendLineEnd',
  '\x1b[99;6u': 'selectionCopy', '\x1b[67;6u': 'selectionCopy', '\x1bc': 'selectionCopy',
  '\x1b\r': 'newline', '\x1b\n': 'newline', '\x1b[13;2u': 'newline',
  '\x1b[27;2;13~': 'newline', '\x1b[13;2~': 'newline', '\x1b[13u': 'submit',
};
const PASTE_START = '\x1b[200~', PASTE_END = '\x1b[201~';

/** Incremental decoder: escape sequences, UTF-8, and paste delimiters may cross chunks. */
export class TerminalKeyDecoder {
  private readonly utf8 = new StringDecoder('utf8');
  private bindings: Keybindings;
  private buffer = '';
  private paste: string[] | undefined;
  private pasteBytes = 0;
  private pasteOverflow = false;
  private previousCR = false;
  private discardingMouse = false;
  private discardSequence = false;
  private discardPaste = false;
  private overrides: Keybindings;
  constructor(keybindings: Keybindings = {}, private readonly maxPasteBytes = MAX_PASTE_BYTES,
    private readonly preserveKeys = false) {
    this.overrides = decodeTerminalKeybindings(keybindings);
    this.bindings = { ...DEFAULT_KEYS, ...this.overrides };
  }
  setKeybindings(keybindings: Keybindings = {}): void {
    this.overrides = decodeTerminalKeybindings(keybindings);
    this.bindings = { ...DEFAULT_KEYS, ...this.overrides };
  }
  get pendingEscape(): boolean { return !this.paste && this.buffer.startsWith('\x1b'); }
  get pendingStandaloneEscape(): boolean { return !this.paste && this.buffer === '\x1b'; }
  push(chunk: string | Buffer): EditorAction[] {
    this.buffer += typeof chunk === 'string' ? chunk : this.utf8.write(chunk);
    const actions: EditorAction[] = [];
    while (this.buffer) {
      // A new input owner may discard an unfinished report, but still drains its framing.
      const discard = this.discardSequence;
      const emit = (action: EditorAction) => { if (!discard) actions.push(action); };
      if (this.paste) {
        const end = this.buffer.indexOf(PASTE_END);
        if (end < 0) {
          let suffix = Math.min(PASTE_END.length - 1, this.buffer.length);
          while (suffix && !PASTE_END.startsWith(this.buffer.slice(-suffix))) suffix--;
          this.appendPaste(this.buffer.slice(0, this.buffer.length - suffix));
          this.buffer = suffix ? this.buffer.slice(-suffix) : ''; break;
        }
        this.appendPaste(this.buffer.slice(0, end));
        if (!this.discardPaste) emit(this.pasteOverflow ? { type: 'pasteRejected', bytes: this.pasteBytes }
          : { type: 'paste', text: this.paste.join('') });
        this.paste = undefined; this.discardPaste = false; this.discardSequence = false;
        this.buffer = this.buffer.slice(end + PASTE_END.length); continue;
      }
      if (this.buffer.startsWith(PASTE_START)) {
        this.paste = []; this.pasteBytes = 0; this.pasteOverflow = false; this.previousCR = false;
        this.discardPaste = discard; this.discardSequence = false;
        this.buffer = this.buffer.slice(PASTE_START.length); continue;
      }
      // Mouse payload bytes belong to one report, even across chunks. An overlong
      // numeric prefix is drained to its final byte instead of becoming draft text.
      if (this.discardingMouse) {
        const tail = /^[0-9;-]*/.exec(this.buffer)![0].length;
        if (tail === this.buffer.length) { this.buffer = ''; break; }
        this.buffer = this.buffer.slice(tail + (/[Mm]/.test(this.buffer[tail]!) ? 1 : 0));
        this.discardingMouse = false; this.discardSequence = false; continue;
      }
      if (this.buffer.startsWith('\x1b[<')) {
        const report = /^\x1b\[<[0-9;-]*[Mm]/.exec(this.buffer)?.[0];
        if (report) {
          const event = parseTerminalMouse(report);
          if (event) emit(event);
          this.discardSequence = false;
          this.buffer = this.buffer.slice(report.length); this.previousCR = false; continue;
        }
        const prefix = /^\x1b\[<[0-9;-]*/.exec(this.buffer)![0];
        if (prefix.length === this.buffer.length && prefix.length <= MAX_MOUSE_REPORT_CHARS) break;
        this.buffer = this.buffer.slice(prefix.length);
        this.discardingMouse = prefix.length > MAX_MOUSE_REPORT_CHARS;
        this.previousCR = false; continue;
      }
      if (this.buffer.startsWith('\x1b[M')) {
        if (this.buffer.length < 6) break;
        const event = parseTerminalMouse(this.buffer.slice(0, 6));
        if (event) emit(event);
        this.discardSequence = false;
        this.buffer = this.buffer.slice(6); this.previousCR = false; continue;
      }
      const keys = Object.keys(this.bindings);
      if (keys.some(key => key.length > this.buffer.length && key.startsWith(this.buffer))) break;
      const key = keys.filter(key => this.buffer.startsWith(key)).sort((a, b) => b.length - a.length)[0];
      if (key) {
        const command = this.bindings[key];
        if (command && !(key === '\n' && this.previousCR)) {
          emit(this.preserveKeys && !Object.hasOwn(this.overrides, key)
            ? { type: 'key', sequence: key, command } : { type: command });
        }
        this.discardSequence = false;
        this.previousCR = key === '\r'; this.buffer = this.buffer.slice(key.length); continue;
      }
      if (PASTE_START.startsWith(this.buffer) || keys.some(key => key.startsWith(this.buffer))) break;
      if (this.buffer.startsWith('\x1b')) {
        const sequence = /^(?:\x1b\[[0-?]*[ -/]*[@-~]|\x1bO.|\x1b[^\[O])/u.exec(this.buffer)?.[0];
        if (!sequence && this.buffer.length < 64) break;
        if (this.preserveKeys && sequence) emit({ type: 'key', sequence });
        this.discardSequence = false;
        this.buffer = this.buffer.slice(sequence?.length ?? 1); this.previousCR = false; continue;
      }
      if (discard) { this.discardSequence = false; this.buffer = this.buffer.slice(1); continue; }
      // Batch ordinary text to avoid one render per character on rapid input.
      let end = 0;
      for (const character of this.buffer) {
        if (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
          || keys.some(key => key.startsWith(character))) break;
        end += character.length;
      }
      if (end) { actions.push({ type: 'insert', text: this.buffer.slice(0, end) }); this.buffer = this.buffer.slice(end); }
      else {
        const character = String.fromCodePoint(this.buffer.codePointAt(0)!);
        if (this.preserveKeys && character.charCodeAt(0) < 32) actions.push({ type: 'key', sequence: character });
        else if (character === '\t') actions.push({ type: 'insert', text: '    ' });
        else if (character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127) {
          actions.push({ type: 'insert', text: character });
        }
        this.buffer = this.buffer.slice(character.length);
      }
      this.previousCR = false;
    }
    return actions;
  }
  flushEscape(): void {
    if (this.buffer.startsWith('\x1b[<')) this.discardingMouse = true;
    if (this.pendingEscape) this.buffer = '';
  }
  discardPending(): void {
    if (this.paste) { this.paste = []; this.discardPaste = true; }
    else if (this.buffer === '\x1b') this.buffer = '';
    else if (this.buffer) this.discardSequence = true;
  }
  reset(): void {
    this.buffer = ''; this.paste = undefined; this.pasteBytes = 0;
    this.pasteOverflow = false; this.discardingMouse = false;
    this.discardPaste = false; this.discardSequence = false;
  }
  private appendPaste(text: string): void {
    if (this.discardPaste) return;
    this.pasteBytes += Buffer.byteLength(text);
    if (this.pasteBytes > Math.min(MAX_PASTE_BYTES, this.maxPasteBytes)) {
      this.pasteOverflow = true; this.paste = []; return;
    }
    if (!this.pasteOverflow && text) this.paste!.push(text);
  }
}

export interface EditorLayout { lines: string[]; cursorRow: number; cursorColumn: number; hiddenRows: number }

/** Build explicit screen rows to avoid relying on terminal autowrap cursor guesses. */
export function layoutEditor(state: Pick<EditorState, 'text' | 'cursor'>, columns = 80,
  prompt = '> ', continuationPrompt = '  ', maxRows = Number.MAX_SAFE_INTEGER): EditorLayout {
  const width = Math.max(2, Math.floor(columns));
  const lines = ['']; let row = 0, column = 0;
  let cursorRow = 0, cursorColumn = 0;
  const newRow = () => { lines.push(''); row++; column = 0; };
  const append = (text: string) => {
    for (const { segment } of segmenter.segment(text)) {
      const cells = cellWidth(segment);
      if (column + cells > width) newRow();
      lines[row] += segment; column += cells;
      if (column >= width) newRow();
    }
  };
  append(cleanInput(prompt).replace(/\n/g, ''));
  for (const part of segmenter.segment(state.text)) {
    if (part.segment !== '\n' && column + cellWidth(part.segment) > width) newRow();
    if (part.index === state.cursor) { cursorRow = row; cursorColumn = column; }
    if (part.segment === '\n') { newRow(); append(cleanInput(continuationPrompt).replace(/\n/g, '')); }
    else append(part.segment);
  }
  if (state.cursor === state.text.length) { cursorRow = row; cursorColumn = column; }
  const rows = Math.max(1, Math.floor(maxRows));
  const start = Math.max(0, Math.min(cursorRow, lines.length - rows));
  return { lines: lines.slice(start, start + rows), cursorRow: cursorRow - start,
    cursorColumn, hiddenRows: Math.max(0, lines.length - rows) };
}

export interface TerminalCallbacks {
  onSubmit?: (text: string) => void;
  onInterrupt?: () => void;
  onExit?: () => void;
}
export interface TerminalOptions extends EditorPolicy, TerminalCallbacks {
  input: Readable & { isTTY?: boolean; isRaw?: boolean; setRawMode?: (raw: boolean) => unknown };
  output: Writable & { isTTY?: boolean; columns?: number; rows?: number };
  prompt?: string;
  continuationPrompt?: string;
  history?: readonly string[];
  keybindings?: Keybindings;
  escapeTimeoutMs?: number;
}
type TerminalEvents = {
  submit: [text: string]; interrupt: []; exit: []; pasteRejected: [bytes: number]; inputError: [error: Error];
};

/** In-memory editor. Queue submit events and route streamed writes through outputStream. */
export class TerminalInput extends EventEmitter<TerminalEvents> {
  readonly isTTY: boolean;
  readonly outputStream: Writable;
  private editor: EditorState;
  private readonly decoder: TerminalKeyDecoder;
  private readonly originalRaw: boolean;
  private readonly originalPaused: boolean;
  private started = false;
  private closed = false;
  private changedRaw = false;
  private rl: Interface | undefined;
  private escapeTimer: ReturnType<typeof setTimeout> | undefined;
  private drawn = false;
  private cursorRow = 0;
  private outputColumn = 0;
  private separatedOutput = false;

  constructor(private readonly options: TerminalOptions) {
    super();
    this.isTTY = Boolean(options.input.isTTY && options.output.isTTY && options.input.setRawMode);
    this.originalRaw = Boolean(options.input.isRaw); this.originalPaused = options.input.readableFlowing !== true;
    this.editor = createEditorState(options.historyLimit === 0 ? []
      : options.history?.slice(-Math.max(1, options.historyLimit ?? 100)));
    this.decoder = new TerminalKeyDecoder(options.keybindings, options.maxPasteBytes);
    this.subscribe(options);
    const outputDecoder = new StringDecoder('utf8');
    this.outputStream = new Writable({
      write: (chunk, _encoding, callback) => {
        try { this.write(outputDecoder.write(chunk)); callback(); } catch (error) { callback(error as Error); }
      },
      final: callback => {
        try { const tail = outputDecoder.end(); if (tail) this.write(tail); callback(); }
        catch (error) { callback(error as Error); }
      },
    });
  }
  get state(): Readonly<EditorState> { return { ...this.editor, history: [...this.editor.history] }; }
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
  start(): this {
    if (this.started || this.closed) return this;
    this.started = true;
    this.options.input.on('error', this.onError);
    try {
      if (this.isTTY) {
        if (!this.originalRaw) { this.changedRaw = true; this.options.input.setRawMode!(true); }
        this.options.input.on('data', this.onData);
        this.options.input.on('end', this.onEnd); this.options.input.on('close', this.onEnd);
        this.options.output.on('resize', this.onResize);
        this.options.output.write('\x1b[?2004h');
        this.render(); this.options.input.resume();
      } else {
        this.rl = createInterface({ input: this.options.input, terminal: false, crlfDelay: Infinity });
        this.rl.on('line', this.onLine); this.rl.on('close', this.onEnd);
      }
    } catch (error) { this.close(); throw error; }
    return this;
  }
  setRunning(running: boolean): void { this.dispatch({ type: 'running', value: running }); }
  setKeybindings(keybindings: Keybindings = {}): void { this.decoder.setKeybindings(keybindings); }
  /** Zero-width hook effects bypass text layout and never change the input draft. */
  writeTerminalSequence(sequence: string): void {
    const validated = formatHookTerminalSequence(sequence);
    if (this.isTTY && validated) this.options.output.write(validated);
  }
  dispatch(action: EditorAction): void {
    if (this.closed) return;
    const transition = reduceEditor(this.editor, action, this.options);
    this.editor = transition.state;
    const submitted = transition.effects.find(effect => effect.type === 'submit');
    if (submitted?.type === 'submit' && this.isTTY && this.started) {
      this.clearPrompt(); this.separatedOutput = false;
      this.options.output.write(`${cleanInput(this.options.prompt ?? '> ')}${submitted.text.replace(/\n/g, '\r\n')}\r\n`);
      this.outputColumn = 0;
    }
    this.render();
    for (const effect of transition.effects) {
      if (effect.type === 'exit') { this.close(); this.emit('exit'); }
      else if (effect.type === 'submit') this.emit('submit', effect.text);
      else if (effect.type === 'interrupt') this.emit('interrupt');
      else this.emit('pasteRejected', effect.bytes);
    }
  }
  write(text: string): boolean {
    if (!this.isTTY || !this.started || this.closed) return this.options.output.write(text);
    this.clearPrompt(); this.restoreOutput();
    const normalized = text.replace(/\r?\n/g, '\r\n');
    const accepted = this.options.output.write(normalized);
    this.trackOutput(normalized);
    if (this.outputColumn >= this.columns()) { this.options.output.write('\r\n'); this.outputColumn = 0; }
    if (this.outputColumn > 0) { this.options.output.write('\r\n'); this.separatedOutput = true; }
    this.render(); return accepted;
  }
  /** Idempotent; restores the input's previous raw/paused state and removes owned listeners. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.escapeTimer) clearTimeout(this.escapeTimer);
    this.decoder.reset();
    this.options.input.off('data', this.onData); this.options.input.off('end', this.onEnd);
    this.options.input.off('close', this.onEnd); this.options.input.off('error', this.onError);
    this.options.output.off('resize', this.onResize);
    this.rl?.off('line', this.onLine); this.rl?.off('close', this.onEnd); this.rl?.close();
    try {
      if (this.isTTY && this.started) {
        this.clearPrompt(); this.restoreOutput();
        this.options.output.write('\x1b[?2004l\x1b[0m\x1b[?25h');
      }
    } finally {
      try {
        if (this.changedRaw) { this.changedRaw = false; this.options.input.setRawMode!(this.originalRaw); }
      } finally { if (this.started && this.originalPaused) this.options.input.pause(); }
    }
  }
  private readonly onLine = (text: string) => { this.emit('submit', text); };
  private readonly onEnd = () => { if (!this.closed) { this.close(); this.emit('exit'); } };
  private readonly onError = (error: Error) => {
    this.close();
    try { this.emit('inputError', error); } finally { this.emit('exit'); }
  };
  private readonly onResize = () => { this.clearPrompt(); this.render(); };
  private readonly onData = (chunk: string | Buffer) => {
    if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = undefined; }
    for (const action of this.decoder.push(chunk)) { this.dispatch(action); if (this.closed) break; }
    if (this.decoder.pendingEscape && !this.closed) {
      this.escapeTimer = setTimeout(() => { this.decoder.flushEscape(); this.escapeTimer = undefined; },
        this.options.escapeTimeoutMs ?? 50);
      this.escapeTimer.unref();
    }
  };
  private columns(): number { return Math.max(2, this.options.output.columns ?? 80); }
  private clearPrompt(): void {
    if (!this.drawn) return;
    this.options.output.write(`\r${this.cursorRow ? `\x1b[${this.cursorRow}A` : ''}\x1b[0J`);
    this.drawn = false;
  }
  private restoreOutput(): void {
    if (!this.separatedOutput) return;
    this.options.output.write(`\x1b[1A\r${this.outputColumn ? `\x1b[${this.outputColumn}C` : ''}`);
    this.separatedOutput = false;
  }
  private render(): void {
    if (!this.isTTY || !this.started || this.closed) return;
    this.clearPrompt();
    const frame = layoutEditor(this.editor, this.columns(), this.options.prompt ?? '> ',
      this.options.continuationPrompt ?? '  ', Math.max(1, (this.options.output.rows ?? 24) - 1));
    const up = frame.lines.length - 1 - frame.cursorRow;
    this.options.output.write(`\x1b[?25l${frame.lines.join('\r\n')}\r${up ? `\x1b[${up}A` : ''}`
      + `${frame.cursorColumn ? `\x1b[${frame.cursorColumn}C` : ''}\x1b[?25h`);
    this.cursorRow = frame.cursorRow; this.drawn = true;
  }
  private trackOutput(text: string): void {
    // SGR/OSC sequences do not occupy cells. Cursor-moving output is caller-owned.
    const visible = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '');
    for (const { segment } of segmenter.segment(visible)) {
      if (segment.includes('\n') || segment === '\r') this.outputColumn = 0;
      else if (segment === '\b') this.outputColumn = Math.max(0, this.outputColumn - 1);
      else if (segment === '\t') this.outputColumn = Math.min(this.columns(), this.outputColumn + 8 - this.outputColumn % 8);
      else {
        const cells = cellWidth(segment);
        if (this.outputColumn + cells > this.columns()) this.outputColumn = 0;
        this.outputColumn += cells;
      }
    }
  }
}

export function createTerminalInput(options: TerminalOptions): TerminalInput { return new TerminalInput(options); }
export const terminalIO = createTerminalInput;

/** Typed interaction request for terminal surfaces that can own a modal prompt. */
export interface TerminalPromptChoice { label: string; value: string; description?: string }
export interface TerminalPromptRequest {
  title?: string;
  message: string;
  choices?: readonly TerminalPromptChoice[];
  multiple?: boolean;
  allowText?: boolean;
  defaultIndex?: number;
  maxTextChars?: number;
}
export interface TerminalPromptAnswer { selected: string[]; text?: string }

/** Shared line/full-screen surface; modal support is optional for legacy hosts. */
export interface TerminalSurface {
  readonly isTTY: boolean;
  readonly outputStream: Writable;
  subscribe(callbacks: TerminalCallbacks): () => void;
  start(): unknown;
  close(): void;
  setRunning(running: boolean): void;
  setKeybindings(keybindings?: Keybindings): void;
  writeTerminalSequence(sequence: string): void;
  prompt?(request: TerminalPromptRequest, signal: AbortSignal): Promise<TerminalPromptAnswer | undefined>;
}
