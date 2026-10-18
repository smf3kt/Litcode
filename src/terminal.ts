import { EventEmitter } from 'node:events';
import { createInterface, type Interface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { Writable, type Readable } from 'node:stream';
import { formatHookTerminalSequence } from './hook-terminal.js';
import { MAX_MOUSE_REPORT_CHARS, parseTerminalMouse, type TerminalMouseEvent } from './terminal-mouse.js';
import { inputCursor, layoutInput } from './tui-input-navigation.js';
import { inputKillRange, type InputKillCommand } from './tui-input-kill.js';
import { killRingHead, nextYank, reduceKillRing, type KillRingState } from './kill-ring.js';
import { InputUndo } from './tui-input-undo.js';
import { InputPaste, expandPastedText, referencedPastes, type PastedContents } from './tui-input-paste.js';
import { parseTerminalResponse } from './tui-response-source.js';
import { editExternal, type ExternalEditorResult } from './external-editor.js';
import { InputVim, type EditorMode, type VimBridge } from './tui-vim.js';
import { vimKey } from './tui-vim-keys.js';
import { applyReturnGesture } from './tui-input-return.js';
import { InputGestures } from './tui-input-gestures.js';
import { TerminalFocus } from './tui-focus.js';
import { InputHistory } from './tui-input-history.js';
import type { HistorySearch, SearchSnapshot } from './tui-history-search.js';
import { ne } from './plugin-chain-source.js';
import { previewSanitized, previewUnstableText } from './preview-sanitize.js';
import type { ScopedPicker } from './tui-scope-picker.js';
/** Source HI() gate for the picker: see research/ports/W44-scope-picker-copies.json entryEvidence. */
const SOURCE_PICKER_OWNS_HISTORY_SEARCH = true;
import type { TuiDocumentRenderer } from './tui-document-renderer.js';
import { ENABLE_FOCUS_EVENTS, DISABLE_FOCUS_EVENTS } from './tui-modes.js';

export const MAX_PASTE_BYTES = 256 * 1024;

export type EditorCommand = 'left' | 'right' | 'up' | 'down' | 'home' | 'end' | 'logicalHome' | 'logicalEnd' | 'wordLeft' | 'wordRight'
  | 'backspace' | 'delete' | 'newline' | 'submit' | 'interrupt' | 'eof' | 'search'
  | 'extendLeft' | 'extendRight' | 'extendUp' | 'extendDown' | 'extendLineStart' | 'extendLineEnd'
  | 'selectionCopy' | InputKillCommand | 'yank' | 'yankPop' | 'undo' | 'externalEditor';
export type TerminalResponse = { type: 'osc'; code: number; data: string }
  | { type: 'themeNotify'; dark: boolean } | { type: 'da1' | 'da2'; params: number[] }
  | { type: 'decrpm'; mode: number; status: number } | { type: 'kittyKeyboard'; flags: number }
  | { type: 'cursorPosition'; row: number; col: number } | { type: 'cellSize'; height: number; width: number }
  | { type: 'xtversion'; name: string } | { type: 'kittyGraphics'; id: number; message: string };
export type EditorAction = { type: EditorCommand } | { type: 'insert' | 'paste'; text: string }
  | {type:'return';sequence:string;meta:boolean;shift:boolean}
  | { type: 'terminalResponse'; response: TerminalResponse }
  | { type: 'focus'; focused: boolean }
  | { type: 'running'; value: boolean } | { type: 'pasteRejected'; bytes: number } | TerminalMouseEvent
  | { type: 'key'; sequence: string; command?: EditorCommand };
export interface EditorState {
  text: string;
  /** UTF-16 offset, always on a grapheme boundary. */
  cursor: number;
  history: string[];
  historyIndex: number;
  historyDraft: string;
  /** Source folded display and raw paste payloads travel together through editor snapshots. */
  pastedContents: PastedContents;
  historyPastes: PastedContents[];
  historyDraftPastes: PastedContents;
  running: boolean;
  interruptRequested: boolean;
  /** Ring text belongs to this input owner; intervening input resets only its mode. */
  killRing: KillRingState;
}
export interface EditorPolicy {
  idleInterrupt?: 'clear-or-exit' | 'clear' | 'exit';
  historyLimit?: number;
  maxPasteBytes?: number;
  /** Content width supplied by a TTY owner for copied visual-row navigation. */
  navigationColumns?: number;
  pasteOwner?: InputPaste;
  terminalRows?: number;
  sourceInputGestures?: boolean;
  editorMode?: EditorMode;
  vimInsertModeRemaps?: Record<string,unknown>;
}
export type EditorEffect = { type: 'submit'; text: string } | { type: 'interrupt' } | { type: 'exit' }
  | { type: 'pasteRejected'; bytes: number };

export function createEditorState(history: readonly string[] = []): EditorState {
  return { text: '', cursor: 0, history: history.map(cleanInput), historyIndex: history.length, historyDraft: '',
    pastedContents:{},historyPastes:history.map(()=>({})),historyDraftPastes:{},
    running: false, interruptRequested: false, killRing: { ring: [], mode: { type: 'idle' } } };
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
    const regional = segment.match(/\p{Regional_Indicator}/gu)?.length ?? 0;
    if (regional) { width += regional >= 2 ? 2 : 1; continue; }
    // Public Bun GraphemeState keeps bare text symbols narrow; VS16, keycaps,
    // emoji ZWJ/skin tone and default emoji presentation widen the cluster.
    if (segment.includes('⃣') || (/\p{Emoji}/u.test(segment)
      && (segment.includes('‍') || /\p{Emoji_Modifier}/u.test(segment)
        || (segment.includes('️') && !/^[0-9#*]/u.test(segment))
        || /\p{Emoji_Presentation}/u.test(segment) && !segment.includes('︎')))) {
      width += 2; continue;
    }
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
  if (action.type === 'terminalResponse' || action.type === 'focus') return { state, effects: [] };
  let next = { ...state };
  const killCommand = action.type === 'killLineStart' || action.type === 'killLineEnd'
    || action.type === 'killWordForward' || action.type === 'killWordBackward' || action.type === 'killWORDBackward';
  if (!killCommand && action.type !== 'yank' && action.type !== 'yankPop' && action.type !== 'running')
    next.killRing = reduceKillRing(state.killRing, { type: 'interrupt' });
  const effects: EditorEffect[] = [];
  const cursor = policy.navigationColumns === undefined ? undefined
    : inputCursor(state.text, policy.navigationColumns, state.cursor);
  const replace = (start: number, end: number, text: string) => {
    next.text = state.text.slice(0, start) + text + state.text.slice(end);
    next.cursor = boundaryAtOrAfter(next.text, start + text.length);
    next.historyIndex = state.history.length; next.historyDraft = next.text; next.historyDraftPastes = next.pastedContents;
  };
  switch (action.type) {
    case 'insert': case 'paste': {
      const bytes = Buffer.byteLength(action.text);
      if (bytes > Math.min(MAX_PASTE_BYTES, policy.maxPasteBytes ?? MAX_PASTE_BYTES)) {
        effects.push({ type: 'pasteRejected', bytes }); break;
      }
      if (action.type === 'paste' && policy.pasteOwner) {
        const pasted = policy.pasteOwner.paste(state, action.text, policy.terminalRows ?? 24);
        next = {...next,...pasted,historyIndex:state.history.length,historyDraft:pasted.text,
          historyDraftPastes:pasted.pastedContents};
      } else replace(state.cursor, state.cursor, cleanInput(action.text));
      break;
    }
    case 'killLineStart': case 'killLineEnd': case 'killWordForward': case 'killWordBackward': case 'killWORDBackward': {
      const range = inputKillRange(state.text, state.cursor, policy.navigationColumns ?? 80, action.type);
      next.killRing = reduceKillRing(state.killRing, { type: 'kill', text: expandPastedText(range.text,state.pastedContents), direction: range.direction });
      if (range.start !== range.end) replace(range.start, range.end, '');
      break;
    }
    case 'yank': case 'yankPop': {
      const pop = action.type === 'yankPop' ? nextYank(state.killRing) : undefined;
      if (action.type === 'yankPop' && !pop) break;
      const text = cleanInput(pop?.text ?? killRingHead(state.killRing));
      const bytes = Buffer.byteLength(text);
      if (bytes > Math.min(MAX_PASTE_BYTES, policy.maxPasteBytes ?? MAX_PASTE_BYTES)) {
        effects.push({ type: 'pasteRejected', bytes }); break;
      }
      if (!text) break;
      const start = pop?.start ?? state.cursor;
      replace(start, start + (pop?.length ?? 0), text);
      next.killRing = pop ? reduceKillRing(reduceKillRing(state.killRing, { type: 'yankPop' }),
        { type: 'updateYankLength', length: text.length })
        : reduceKillRing(state.killRing, { type: 'yank', start, length: text.length });
      break;
    }
    case 'pasteRejected': effects.push(action); break;
    case 'left': next.cursor = cursor?.left().offset ?? previousBoundary(state.text, state.cursor); break;
    case 'right': next.cursor = cursor?.right().offset ?? nextBoundary(state.text, state.cursor); break;
    case 'home': next.cursor = cursor?.startOfLine().offset ?? lineStart(state.text, state.cursor); break;
    case 'end': next.cursor = cursor?.endOfLine().offset ?? lineEnd(state.text, state.cursor); break;
    case 'logicalHome': next.cursor = lineStart(state.text, state.cursor); break;
    case 'logicalEnd': next.cursor = lineEnd(state.text, state.cursor); break;
    case 'wordLeft': next.cursor = cursor?.backwardWord().offset ?? wordBoundary(state.text, state.cursor, -1); break;
    case 'wordRight': next.cursor = cursor?.forwardWord().offset ?? wordBoundary(state.text, state.cursor, 1); break;
    case 'backspace': replace(cursor?.left().offset ?? previousBoundary(state.text, state.cursor), state.cursor, ''); break;
    case 'delete': replace(state.cursor, cursor?.right().offset ?? nextBoundary(state.text, state.cursor), ''); break;
    case 'newline': replace(state.cursor, state.cursor, '\n'); break;
    case 'up': case 'down': {
      const start = lineStart(state.text, state.cursor), end = lineEnd(state.text, state.cursor);
      const column = cellWidth(state.text.slice(start, state.cursor));
      const position = cursor?.getPosition();
      const measuredMove = cursor && (action.type === 'up' ? position!.line > 0
        : position!.line < cursor.measuredText.lineCount - 1);
      if (measuredMove) {
        next.cursor = action.type === 'up' ? cursor.up().offset : cursor.down().offset;
      } else if (!cursor && action.type === 'up' && start > 0) {
        const previous = lineStart(state.text, start - 1);
        next.cursor = cursorAtCell(state.text, previous, start - 1, column);
      } else if (!cursor && action.type === 'down' && end < state.text.length) {
        next.cursor = cursorAtCell(state.text, end + 1, lineEnd(state.text, end + 1), column);
      } else {
        const index = Math.max(0, Math.min(state.history.length,
          state.historyIndex + (action.type === 'up' ? -1 : 1)));
        if (index === state.historyIndex) break;
        if (state.historyIndex === state.history.length) {
          next.historyDraft = state.text; next.historyDraftPastes = state.pastedContents;
        }
        next.historyIndex = index;
        next.text = index === state.history.length ? next.historyDraft : state.history[index]!;
        next.pastedContents = structuredClone(index === state.history.length ? next.historyDraftPastes : state.historyPastes[index] ?? {});
        // Keep repeated history browsing at the appropriate multiline boundary.
        next.cursor = action.type === 'up' ? lineEnd(next.text, 0) : next.text.length;
      }
      break;
    }
    case 'search': {
      const query = state.historyIndex === state.history.length ? state.text : state.historyDraft;
      for (let index = state.historyIndex - 1; index >= 0; index--) {
        if (state.history[index]!.includes(query) || expandPastedText(state.history[index]!,state.historyPastes[index]).includes(query)) {
          next.historyDraft = query; next.historyDraftPastes = state.historyIndex === state.history.length ? state.pastedContents : state.historyDraftPastes;
          next.historyIndex = index; next.text = state.history[index]!; next.pastedContents = structuredClone(state.historyPastes[index] ?? {});
          next.cursor = next.text.length; break;
        }
      }
      break;
    }
    case 'return': {
      const gesture=applyReturnGesture(state.text,state.cursor,policy.navigationColumns??80,action);
      if(gesture.submitted)return reduceEditor(state,{type:'submit'},policy);
      next={...next,text:gesture.text,cursor:gesture.cursor,historyIndex:state.history.length,historyDraft:gesture.text};break;
    }
    case 'submit': {
      effects.push({ type: 'submit', text: expandPastedText(state.text,state.pastedContents) });
      const limit = Math.max(0, Math.floor(policy.historyLimit ?? 100));
      const add = state.text.trim() && (state.history.at(-1) !== state.text
        || JSON.stringify(state.historyPastes.at(-1) ?? {}) !== JSON.stringify(state.pastedContents));
      const history = add ? [...state.history,state.text].slice(-Math.max(1,limit)) : [...state.history];
      const historyPastes = add ? [...state.historyPastes,structuredClone(state.pastedContents)].slice(-Math.max(1,limit)) : [...state.historyPastes];
      next = { ...createEditorState(limit === 0 ? [] : history), historyPastes:limit === 0 ? [] : historyPastes,
        running: state.running, interruptRequested: state.interruptRequested, killRing: next.killRing }; break;
    }
    case 'running': next.running = action.value; next.interruptRequested = false; break;
    case 'interrupt':
      if (state.running) {
        if (!state.interruptRequested) { next.interruptRequested = true; effects.push({ type: 'interrupt' }); }
      } else if (policy.idleInterrupt === 'exit' || (!state.text && policy.idleInterrupt !== 'clear')) {
        effects.push({ type: 'exit' });
      } else next = { ...createEditorState(state.history), historyPastes:state.historyPastes, killRing: next.killRing };
      break;
    case 'eof': if (!state.running) effects.push({ type: 'exit' }); break;
  }
  if (next.text !== state.text) next.pastedContents = referencedPastes(next.text,next.pastedContents);
  if (next.historyIndex === next.history.length) next.historyDraftPastes = next.pastedContents;
  return { state: next, effects };
}

/** Source due owns snapshots/timers; the shared reducer still owns raw edits. */
export function reduceEditorWithUndo(state: EditorState, action: EditorAction, policy: EditorPolicy, undo: InputUndo): {
  state: EditorState; effects: EditorEffect[];
} {
  const transition = reduceEditor(state, action, policy);
  if (action.type === 'undo') {
    const snapshot = undo.undo();
    if (snapshot) {
      transition.state = { ...transition.state, text: snapshot.text, cursor: snapshot.cursorOffset,
        pastedContents:structuredClone(snapshot.pastedContents) as PastedContents,
        historyIndex: state.history.length, historyDraft: snapshot.text, historyDraftPastes:structuredClone(snapshot.pastedContents) as PastedContents };
    }
  } else if (transition.effects.some(effect=>effect.type==='submit') || action.type === 'interrupt' && !state.running) undo.clear();
  else if (transition.state.text !== state.text && action.type !== 'running')
    undo.record(state.text,state.cursor,action.type==='return'?{immediate:true}:undefined,state.pastedContents);
  return transition;
}

/** Overrides map literal input sequences to commands; null unbinds a default key. */
export type Keybindings = Readonly<Record<string, EditorCommand | null>>;
const EDITOR_COMMANDS: readonly EditorCommand[] = ['left', 'right', 'up', 'down', 'home', 'end', 'logicalHome', 'logicalEnd',
  'wordLeft', 'wordRight', 'backspace', 'delete', 'newline', 'submit', 'interrupt', 'eof', 'search',
  'killLineStart', 'killLineEnd', 'killWordForward', 'killWordBackward', 'killWORDBackward', 'yank', 'yankPop', 'undo',
  'extendLeft', 'extendRight', 'extendUp', 'extendDown', 'extendLineStart', 'extendLineEnd', 'selectionCopy', 'externalEditor'];

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
  '\u007f': 'backspace', '\b': 'backspace', '\u0001': 'logicalHome', '\u0005': 'logicalEnd',
  '\u0002': 'left', '\u0006': 'right', '\x1bb': 'wordLeft', '\x1bf': 'wordRight',
  '\u000b': 'killLineEnd', '\u0015': 'killLineStart', '\u0017': 'killWORDBackward',
  '\x1bd': 'killWordForward', '\x1b\u007f': 'killWordBackward', '\x1b\b': 'killWordBackward',
  '\u0019': 'yank', '\x1by': 'yankPop', '\u001f': 'undo', '\u0007':'externalEditor',
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
  /** Over-budget terminal strings drain through their terminator, never into text. */
  private discardingControl = false;
  private discardSequence = false;
  private discardPaste = false;
  private overrides: Keybindings;
  private preserveTab = false;
  setSearchInput(active: boolean): void { this.preserveTab = active; }
  constructor(keybindings: Keybindings = {}, private readonly maxPasteBytes = MAX_PASTE_BYTES,
    private readonly preserveKeys = false, private readonly frameReturn = false) {
    this.overrides = decodeTerminalKeybindings(keybindings);
    this.bindings = { ...DEFAULT_KEYS, ...this.overrides };
  }
  setKeybindings(keybindings: Keybindings = {}): void {
    this.overrides = decodeTerminalKeybindings(keybindings);
    this.bindings = { ...DEFAULT_KEYS, ...this.overrides };
  }
  get pendingEscape(): boolean {
    return !this.paste && !this.discardingControl && !/^\x1b(?:[\]P]|_G)/.test(this.buffer) && this.buffer.startsWith('\x1b');
  }
  get pendingStandaloneEscape(): boolean { return !this.paste && !this.discardingControl && this.buffer === '\x1b'; }
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
      if (this.discardingControl || /^\x1b(?:[\]P]|_G)/.test(this.buffer)) {
        const end = /\x07|\x1b\\|[\x18\x1a]/.exec(this.buffer);
        if (!end) {
          if (this.buffer.length > 256 || this.discardingControl) {
            this.discardingControl = true;
            this.buffer = this.buffer.endsWith('\x1b') ? '\x1b' : '';
          }
          break;
        }
        const length = end.index + end[0].length;
        if (!this.discardingControl && length <= 256) {
          const response = parseTerminalResponse(this.buffer.slice(0, length)) as TerminalResponse | null;
          if (response) actions.push({ type: 'terminalResponse', response });
        }
        this.buffer = this.buffer.slice(length);
        this.discardingControl = false; this.discardSequence = false; this.previousCR = false;
        continue;
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
      if (this.buffer.startsWith('\x1b[I') || this.buffer.startsWith('\x1b[O')) {
        actions.push({ type: 'focus', focused: this.buffer[2] === 'I' });
        this.buffer = this.buffer.slice(3); this.discardSequence = false; this.previousCR = false;
        continue;
      }
      const keys = Object.keys(this.bindings);
      if (keys.some(key => key.length > this.buffer.length && key.startsWith(this.buffer))) break;
      const key = keys.filter(key => this.buffer.startsWith(key)).sort((a, b) => b.length - a.length)[0];
      if (key) {
        const command = this.bindings[key];
        if (command && !(key === '\n' && this.previousCR)) {
          const plainReturn=key==='\r'||key==='\x1b[13u',modifiedReturn=command==='newline';
          emit(this.frameReturn&&!Object.hasOwn(this.overrides,key)&&(plainReturn||modifiedReturn)
            ? {type:'return',sequence:key,meta:key==='\x1b\r'||key==='\x1b\n',shift:modifiedReturn&&key!=='\x1b\r'&&key!=='\x1b\n'}
            : this.preserveKeys && !Object.hasOwn(this.overrides, key)
              ? { type: 'key', sequence: key, command } : { type: command });
        }
        this.discardSequence = false;
        this.previousCR = key === '\r'; this.buffer = this.buffer.slice(key.length); continue;
      }
      if (PASTE_START.startsWith(this.buffer) || keys.some(key => key.startsWith(this.buffer))) break;
      if (this.buffer.startsWith('\x1b')) {
        const sequence = /^(?:\x1b\[[0-?]*[ -/]*[@-~]|\x1bO.|\x1b[^\[O])/u.exec(this.buffer)?.[0];
        if (!sequence && this.buffer.length < 64) break;
        const response = sequence ? parseTerminalResponse(sequence) as TerminalResponse | null : null;
        if (response) actions.push({ type: 'terminalResponse', response });
        else if (this.preserveKeys && sequence) emit({ type: 'key', sequence });
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
        else if (character === '\t') actions.push(this.preserveTab ? {type:'key',sequence:'\t'} : { type: 'insert', text: '    ' });
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
    if (/^\x1b(?:[\]P]|_G)/.test(this.buffer)) { this.discardingControl = true; this.buffer = ''; }
    if (this.pendingEscape) this.buffer = '';
  }
  discardPending(): void {
    if (this.paste) { this.paste = []; this.discardPaste = true; }
    else if (this.buffer === '\x1b') this.buffer = '';
    else if (this.buffer) this.discardSequence = true;
  }
  reset(): void {
    this.buffer = ''; this.paste = undefined; this.pasteBytes = 0;
    this.pasteOverflow = false; this.discardingMouse = false; this.discardingControl = false;
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

export interface PromptDiffSelection {
  sessionId: string;
  promptUuid: string;
  selection: import('./diff-selection.js').DiffSelection;
}
export interface TerminalCallbacks {
  onSubmit?: (text: string, attachment?: PromptDiffSelection) => void;
  onInterrupt?: () => void;
  onExit?: () => void;
  onAction?: (action: string) => void;
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
  submit: [text: string]; interrupt: []; exit: []; pasteRejected: [bytes: number]; inputError: [error: Error]; action:[action:string]; historyError:[error:unknown];
};

/** In-memory editor. Queue submit events and route streamed writes through outputStream. */
export class TerminalInput extends EventEmitter<TerminalEvents> {
  readonly isTTY: boolean;
  readonly outputStream: Writable;
  private editor: EditorState;
  /** Pre-change snapshots and one pending source timer live until close. */
  private readonly undo = new InputUndo();
  private readonly pasteOwner = new InputPaste();
  private readonly gestures = new InputGestures();
  /** Focus store and subscribers live until this terminal closes. */
  private readonly focus = new TerminalFocus();
  private readonly inputHistory = new InputHistory(error => this.emit('historyError', error));
  private historyBinding = 0;
  private sourceSearch: HistorySearch | undefined;
  private SearchClass: typeof HistorySearch | undefined;
  private SearchDocument: typeof TuiDocumentRenderer | undefined;
  private PickerClass: typeof ScopedPicker | undefined;
  private linePicker: ScopedPicker | undefined;
  private queryEditor = createEditorState();
  private readonly queryUndo = new InputUndo();
  private searchSessionId = '';
  private searchRenderer: TuiDocumentRenderer | undefined;
  private gestureHandling = false;
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
  private editorController: AbortController | undefined;
  private editorSuspended = false;
  private readonly vim = new InputVim();
  private vimEnabled = false;
  private vimHandling = false;

  constructor(private readonly options: TerminalOptions) {
    super();
    this.isTTY = Boolean(options.input.isTTY && options.output.isTTY && options.input.setRawMode);
    this.originalRaw = Boolean(options.input.isRaw); this.originalPaused = options.input.readableFlowing !== true;
    this.editor = createEditorState(options.historyLimit === 0 ? []
      : options.history?.slice(-Math.max(1, options.historyLimit ?? 100)));
    this.decoder = new TerminalKeyDecoder(options.keybindings, options.maxPasteBytes,false,true);
    this.vimEnabled=options.editorMode==='vim';this.vim.setRemaps(options.vimInsertModeRemaps);
    this.focus.subscribe(() => this.render());
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
  async bindInputHistory(session: import('./session.js').Session): Promise<void> {
    const generation = ++this.historyBinding;
    this.sourceSearch?.close(); this.sourceSearch = undefined;
    this.linePicker?.close(); this.linePicker = undefined;
    this.queryUndo.clear(); this.queryEditor = createEditorState(); this.searchSessionId = session.id;
    this.decoder.setSearchInput(true);
    const entries = await this.inputHistory.bind(session);
    const [search,document,picker] = await Promise.all([import('./tui-history-search.js'),import('./tui-document-renderer.js'),import('./tui-scope-picker.js')]);
    if (this.closed || generation !== this.historyBinding) return;
    this.SearchClass=search.HistorySearch;this.SearchDocument=document.TuiDocumentRenderer;
    this.PickerClass=picker.ScopedPicker;
    const limit = Math.max(0, this.options.historyLimit ?? 100), selected = entries.slice(-limit);
    this.editor = { ...this.editor, history: limit ? selected.map(entry => entry.display) : [],
      historyPastes: limit ? selected.map(entry => entry.pastedContents) : [], historyIndex: limit ? selected.length : 0,
      historyDraft: this.editor.text, historyDraftPastes: structuredClone(this.editor.pastedContents) };
    this.render();
  }
  async flushInputHistory(): Promise<void> { await this.inputHistory.finish(); }
  get state(): Readonly<EditorState> { return { ...this.editor, history: [...this.editor.history],
    pastedContents:structuredClone(this.editor.pastedContents),historyPastes:structuredClone(this.editor.historyPastes),
    historyDraftPastes:structuredClone(this.editor.historyDraftPastes),killRing: structuredClone(this.editor.killRing) }; }
  subscribe(callbacks: TerminalCallbacks): () => void {
    if (callbacks.onSubmit) this.on('submit', callbacks.onSubmit);
    if (callbacks.onInterrupt) this.on('interrupt', callbacks.onInterrupt);
    if (callbacks.onExit) this.on('exit', callbacks.onExit);
    if (callbacks.onAction) this.on('action',callbacks.onAction);
    return () => {
      if (callbacks.onSubmit) this.off('submit', callbacks.onSubmit);
      if (callbacks.onInterrupt) this.off('interrupt', callbacks.onInterrupt);
      if (callbacks.onExit) this.off('exit', callbacks.onExit);
      if(callbacks.onAction)this.off('action',callbacks.onAction);
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
        this.options.output.write('\x1b[?2004h' + ENABLE_FOCUS_EVENTS);
        this.render(); this.options.input.resume();
      } else {
        this.rl = createInterface({ input: this.options.input, terminal: false, crlfDelay: Infinity });
        this.rl.on('line', this.onLine); this.rl.on('close', this.onEnd);
      }
    } catch (error) { this.close(); throw error; }
    return this;
  }
  async editDraft(signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult> {
    if (!this.isTTY || !this.started || this.closed || this.editor.running || this.editorController) return {content:null};
    this.sourceSearch?.cancel();
    const controller = new AbortController(); this.editorController = controller;
    const snapshot = {text:this.editor.text,cursor:this.editor.cursor,pastedContents:structuredClone(this.editor.pastedContents)};
    const suspend = () => {
      this.gestures.reset();this.vim.externalMutation();
      this.editorSuspended = true; this.options.input.off('data',this.onData);this.options.input.pause();
      if(this.escapeTimer){clearTimeout(this.escapeTimer);this.escapeTimer=undefined;}this.decoder.reset();
      this.clearPrompt();this.options.output.write(DISABLE_FOCUS_EVENTS + '\x1b[?2004l\x1b[0m\x1b[?25h');this.options.input.setRawMode!(false);
    };
    const resume = () => {
      if(this.closed)return;
      this.options.input.setRawMode!(true);this.options.input.on('data',this.onData);
      this.editorSuspended=false;this.options.output.write('\x1b[?2004h'+ENABLE_FOCUS_EVENTS);this.options.input.resume();this.render();
    };
    try {
      const result=await editExternal(snapshot,{suspend,resume},AbortSignal.any([signal,controller.signal]),workspace);
      if(!this.closed&&!signal.aborted&&!controller.signal.aborted&&result.content!==null&&result.content!==snapshot.text){
        const text=cleanInput(result.content);this.undo.record(snapshot.text,snapshot.cursor,{immediate:true},snapshot.pastedContents);
        const pastedContents=referencedPastes(text,snapshot.pastedContents);
        this.editor={...this.editor,text,cursor:text.length,pastedContents,historyIndex:this.editor.history.length,
          historyDraft:text,historyDraftPastes:pastedContents};this.vim.reset();this.render();
      }
      return result;
    } finally {if(this.editorSuspended)resume();if(this.editorController===controller)this.editorController=undefined;}
  }

  setEditorMode(mode?: EditorMode,remaps?:Record<string,unknown>): void {
    if(this.vimEnabled!==(mode==='vim')){this.gestures.reset();this.vim.reset();}this.vimEnabled=mode==='vim';this.vim.setRemaps(remaps);this.render();
  }

  private handleVim(action: EditorAction): boolean {
    const key=vimKey(action);if(!key)return false;
    this.vimHandling=true;
    const owner=this;
    const bridge:VimBridge={get text(){return owner.editor.text;},get cursor(){return owner.editor.cursor;},columns:this.inputColumns(),
      change:(text,previous)=>{
        const raw=cleanInput(text);if(raw===this.editor.text)return;
        this.undo.record(previous?.value??this.editor.text,previous?.cursorOffset??this.editor.cursor,{immediate:true},this.editor.pastedContents);
        const pastedContents=referencedPastes(raw,this.editor.pastedContents);
        this.editor={...this.editor,text:raw,pastedContents,historyIndex:this.editor.history.length,historyDraft:raw,historyDraftPastes:pastedContents};
      },offset:cursor=>{this.editor={...this.editor,cursor};},register:text=>expandPastedText(text,this.editor.pastedContents),
      fallback:event=>{if(action.type==='insert')this.dispatch({type:'insert',text:event.key});
        else if(action.type==='key'&&action.command)this.dispatch({type:action.command});else if(action.type!=='key')this.dispatch(action);},
      undo:()=>this.dispatch({type:'undo'}),history:direction=>this.dispatch({type:direction<0?'up':'down'}),search:()=>this.dispatch({type:'search'}),
    };
    try{this.vim.key(key,bridge);}finally{this.vimHandling=false;}this.render();return true;
  }

  private handleGesture(key:'interrupt'|'eof'|'escape'):void{
    const owner=this;this.gestureHandling=true;
    try{this.gestures.key(key,{text:this.editor.text,pastedContents:structuredClone(this.editor.pastedContents),
      clear:()=>{this.undo.clear();this.vim.reset();this.editor={...createEditorState(this.editor.history),historyPastes:this.editor.historyPastes,killRing:this.editor.killRing};},
      delete:()=>this.dispatch({type:'delete'}),exit:()=>{this.close();this.emit('exit');},
      history:(text,contents)=>{this.inputHistory.add({display:text,pastedContents:contents});const limit=Math.max(0,this.options.historyLimit??100);if(limit)this.editor={...this.editor,
        history:[...this.editor.history,text].slice(-limit),historyPastes:[...this.editor.historyPastes,structuredClone(contents)].slice(-limit)};},
      hint:()=>owner.render()});}finally{this.gestureHandling=false;}
    this.render();
  }

  private openSourceSearch(): void {
    if(!this.inputHistory.bound)return;
    this.sourceSearch ??= new this.SearchClass!({read:()=>this.inputHistory.readEntries(),sessionId:()=>this.searchSessionId,allocator:this.pasteOwner.allocator,
      carriers:()=>[this.editor.text,...this.editor.history],report:error=>this.emit('historyError',error),
      changed:snapshot=>this.publishSearch(snapshot),submit:entry=>{
        if(this.closed)return;this.editor={...this.editor,text:entry.display,cursor:entry.display.length,pastedContents:structuredClone(entry.pastedContents)};
        this.dispatch({type:'submit'});
      }});
    this.undo.record(this.editor.text,this.editor.cursor,{immediate:true},this.editor.pastedContents);
    this.queryUndo.clear();this.queryEditor=createEditorState();this.gestures.reset();this.vim.externalMutation();
    this.sourceSearch.open({text:this.editor.text,cursor:this.editor.cursor,pastedContents:structuredClone(this.editor.pastedContents)});
  }
  /** Source G4/HI route: the scoped picker owns history:search when the history is bound. */
  private openSourcePicker(): boolean {
    // Source HI() gate: an unfinished picker must not take ctrl+r away from the delivered search.
    if(!SOURCE_PICKER_OWNS_HISTORY_SEARCH)return false;
    if(!this.inputHistory.bound||!this.PickerClass)return false;
    this.linePicker ??= new this.PickerClass({read:(scope:import('./tui-scope-picker.js').PickerScope)=>this.inputHistory.readTimestamped(scope),
      report:(error:unknown)=>this.emit('historyError',error),changed:()=>this.render()});
    // Source `_y` seeds query and caret from `initialQuery`, and its consumer passes the draft
    // (`e(Kse,{initialQuery: ee.value, …})`), so the picker opens pre-filtered by the draft.
    this.queryUndo.clear();this.queryEditor={...createEditorState(),text:this.editor.text,cursor:this.editor.text.length};
    this.linePicker.begin(this.editor.text);
    return true;
  }
  private handleLinePicker(action:EditorAction|string): boolean {
    const picker=this.linePicker;
    if(!picker?.snapshot.searching)return false;
    if(typeof action==='string'){
      if(action==='historySearch:cycleScope'){picker.cycleScope();return true;}
      if(action==='historySearch:next'){picker.move(1);return true;}
      if(action==='historySearch:cancel'){picker.cancel();return true;}
      // Source gLt return/tab both call `onSelect(<focused row>)`; the HistorySearch table names
      // enter `historySearch:execute`, so both actions select into the prompt and never run it.
      if(action==='historySearch:accept'||action==='historySearch:execute'){this.acceptLinePicker();return true;}
      return false;
    }
    const sequence=action.type==='key'?action.sequence:action.type==='return'?action.sequence:'';
    const command=action.type==='key'?action.command:action.type;
    if(command==='search'||sequence==='\u0013'){picker.cycleScope();return true;}
    if(command==='interrupt'||sequence==='\u0003'){picker.cancel();return true;}
    if(sequence==='\t'||sequence==='\x1b'){this.acceptLinePicker();return true;}
    // Source gLt swallows return/tab when its window holds no row: no selection, no submit, no close.
    if(command==='submit'||command==='return'){this.acceptLinePicker();return true;}
    // Source gLt with `direction:"up"` draws a bottom-anchored list: the up key advances the focus
    // index (the row above), so the picker's index delta follows the frame's mapping.
    if(command==='up'||sequence==='\x1b[A'||sequence==='\x10'){picker.move(1);return true;}
    if(command==='down'||sequence==='\x1b[B'||sequence==='\x0e'){picker.move(-1);return true;}
    if(sequence==='\x1b[5~'){picker.page(1);return true;}
    if(sequence==='\x1b[6~'){picker.page(-1);return true;}
    // Source gLt builds its query editor with `backspaceExitsOnEmpty:!1`.
    if(command==='backspace'&&this.queryEditor.text==='')return true;
    const edit=action.type==='key'?action.command?{type:action.command} as EditorAction:undefined:action;
    if(!edit||edit.type==='mouse'||edit.type==='terminalResponse')return true;
    this.queryEditor=reduceEditorWithUndo(this.queryEditor,edit,{navigationColumns:this.columns(),maxPasteBytes:this.options.maxPasteBytes,
      historyLimit:0},this.queryUndo).state;
    picker.query(this.queryEditor.text);this.render();return true;
  }
  /** Source accept: the chosen row replaces the draft after its paste records resolve. */
  private acceptLinePicker(): boolean {
    const picker=this.linePicker;
    if(!picker?.accept())return false;
    void picker.chosenEntry().then((entry: import('./tui-input-history.js').InputHistoryEntry|undefined)=>{
      if(!entry||this.closed)return;
      this.editor={...this.editor,text:entry.display,cursor:entry.display.length,pastedContents:structuredClone(entry.pastedContents)};
      this.render();
    });
    return true;
  }
  private publishSearch(snapshot:SearchSnapshot): void {
    if(this.closed||!this.sourceSearch)return;
    this.editor={...this.editor,text:snapshot.text,cursor:snapshot.cursor,pastedContents:snapshot.pastedContents};
    if(snapshot.query!==this.queryEditor.text)this.queryEditor={...this.queryEditor,text:snapshot.query,cursor:snapshot.query.length};
    if(!snapshot.searching){this.queryUndo.clear();this.queryEditor=createEditorState();}
    else if(snapshot.query!==this.queryEditor.text)this.sourceSearch.queryCursor=snapshot.query.length;
    this.render();
  }
  private handleSourceSearch(action:EditorAction): boolean {
    if(!this.sourceSearch?.snapshot.searching)return false;
    const sequence=action.type==='key'?action.sequence:action.type==='return'?action.sequence:'';
    const command=action.type==='key'?action.command:action.type;
    const operation=command==='search'||sequence==='\u0012'?'historySearch:next'
      :command==='interrupt'||sequence==='\u0003'?'historySearch:cancel'
      :sequence==='\x1b'||sequence==='\t'?'historySearch:accept'
      :command==='submit'||command==='return'?'historySearch:execute':undefined;
    if(operation){this.sourceSearch.action(operation);return true;}
    if(command==='backspace'&&this.sourceSearch.backspace())return true;
    if(command==='eof'){this.sourceSearch.cancel();return false;}
    const edit=action.type==='key'?action.command?{type:action.command} as EditorAction:undefined:action;
    if(!edit||edit.type==='mouse'||edit.type==='terminalResponse')return true;
    this.queryEditor=reduceEditorWithUndo(this.queryEditor,edit,{navigationColumns:this.columns(),maxPasteBytes:this.options.maxPasteBytes,
      historyLimit:0},this.queryUndo).state;
    this.sourceSearch.queryCursor=this.queryEditor.cursor;
    this.sourceSearch.query(this.queryEditor.text);this.render();return true;
  }
  setRunning(running: boolean): void { this.dispatch({ type: 'running', value: running }); }
  setKeybindings(keybindings: Keybindings = {}): void { this.gestures.reset();this.decoder.setKeybindings(keybindings); }
  /** Zero-width hook effects bypass text layout and never change the input draft. */
  writeTerminalSequence(sequence: string): void {
    const validated = formatHookTerminalSequence(sequence);
    if (this.isTTY && validated) this.options.output.write(validated);
  }
  dispatch(action: EditorAction): void {
    if (this.closed || this.editorSuspended || this.editorController) return;
    if (action.type === 'focus') { this.focus.set(action.focused); return; }
    if(action.type!=='running'&&this.handleLinePicker(action))return;
    if(action.type!=='running'&&this.handleSourceSearch(action))return;
    if(action.type==='key'&&action.sequence==='\t'){this.dispatch({type:'insert',text:'    '});return;}
    if(action.type==='search'){if(this.inputHistory.bound){if(this.openSourcePicker())return;}if(this.inputHistory.bound){this.openSourceSearch();return;}}
    if(action.type==='externalEditor'){this.gestures.reset();this.emit('action','chat:externalEditor');return;}
    if(this.options.sourceInputGestures&&this.options.idleInterrupt===undefined&&!this.gestureHandling&&!this.editor.running
      &&(action.type==='interrupt'||action.type==='eof')){this.handleGesture(action.type);return;}
    if(action.type==='running'||action.type==='submit'||action.type==='return')this.gestures.reset();
    if(action.type==='paste')this.vim.externalMutation();
    if(this.vimEnabled&&!this.vimHandling&&action.type!=='running'
      &&!(action.type==='interrupt'&&this.editor.running)&&this.handleVim(action))return;
    const transition = reduceEditorWithUndo(this.editor, action, { ...this.options,
      navigationColumns: this.inputColumns(), pasteOwner:this.pasteOwner,
      terminalRows:this.options.output.rows ?? 24 }, this.undo);
    if (transition.effects.some(effect => effect.type === 'submit')) this.inputHistory.add({display:this.editor.text,pastedContents:this.editor.pastedContents});
    this.editor = transition.state;
    if(transition.effects.some(effect=>effect.type==='submit')||action.type==='interrupt'&&!this.editor.running)this.vim.reset();
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
    this.sourceSearch?.close();this.sourceSearch=undefined;this.queryUndo.clear();this.searchRenderer?.close();
    this.editorController?.abort();this.gestures.reset();this.vim.close();this.focus.close();this.inputHistory.close();
    this.undo.clear();
    this.editor = {...this.editor,pastedContents:{},historyPastes:[],historyDraftPastes:{}};
    if (this.escapeTimer) clearTimeout(this.escapeTimer);
    this.decoder.reset();
    this.options.input.off('data', this.onData); this.options.input.off('end', this.onEnd);
    this.options.input.off('close', this.onEnd); this.options.input.off('error', this.onError);
    this.options.output.off('resize', this.onResize);
    this.rl?.off('line', this.onLine); this.rl?.off('close', this.onEnd); this.rl?.close();
    try {
      if (this.isTTY && this.started) {
        this.clearPrompt(); this.restoreOutput();
        this.options.output.write(DISABLE_FOCUS_EVENTS + '\x1b[?2004l\x1b[0m\x1b[?25h');
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
    for (const action of this.decoder.push(chunk)) {
      if (action.type === 'focus') { this.focus.set(action.focused); continue; }
      if (action.type !== 'terminalResponse' && (action.type !== 'mouse' || action.action === 'press') && !this.focus.focused) this.focus.set(true);
      this.dispatch(action); if (this.closed || this.editorController) break;
    }
    if (this.decoder.pendingEscape && !this.closed) {
      this.escapeTimer = setTimeout(() => {
        const standalone=this.decoder.pendingStandaloneEscape;this.decoder.flushEscape();this.escapeTimer=undefined;
        if(standalone&&!this.focus.focused)this.focus.set(true);
        if(standalone&&this.handleSourceSearch({type:'key',sequence:'\x1b'}))return;
        if(standalone&&this.vimEnabled)this.handleVim({type:'key',sequence:'\x1b'});
        else if(standalone&&this.options.sourceInputGestures&&!this.editor.running)this.handleGesture('escape');
      },
        this.options.escapeTimeoutMs ?? 50);
      this.escapeTimer.unref();
    }
  };
  private columns(): number { return Math.max(2, this.options.output.columns ?? 80); }
  private inputColumns(): number {
    return Math.max(2, this.columns() - Math.max(cellWidth(this.options.prompt ?? '> '),
      cellWidth(this.options.continuationPrompt ?? '  ')));
  }
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
    if (!this.isTTY || !this.started || this.closed || this.editorSuspended) return;
    this.clearPrompt();
    const body = layoutInput(this.editor, this.inputColumns(), Math.max(1, (this.options.output.rows ?? 24) - 1),
      this.vimEnabled?{mode:this.vim.mode,anchor:this.vim.anchor}:undefined,this.focus.focused);
    const prompt = cleanInput(this.options.prompt ?? '> ').replace(/\n/g, '');
    const continuation = cleanInput(this.options.continuationPrompt ?? '  ').replace(/\n/g, '');
    const lines = body.lines.map((line, index) => (index === 0 && body.viewportStartRow === 0 ? prompt : continuation) + line);
    const cursorPrefix = body.cursorRow === 0 && body.viewportStartRow === 0 ? prompt : continuation;
    const picking=this.linePicker?.snapshot.searching===true;
    if(picking){
      lines.push(...this.linePicker!.styled(this.columns(),Math.max(4,(this.options.output.rows ?? 24)-lines.length-1)).map((row:{ansi:string})=>row.ansi));
    }
    const searching=this.sourceSearch?.snapshot.searching;
    if(!picking&&searching){
      this.searchRenderer ??= new this.SearchDocument!();
      const queryRows=this.searchRenderer.renderElement(this.sourceSearch!.element(),this.columns()).map(row=>row.ansi);
      lines.push(...queryRows);
    }else if(this.gestures.hint)lines.unshift(this.gestures.hint.slice(0,this.columns()));
    const frame = { ...body, lines,cursorRow:searching?lines.length-1:body.cursorRow+(this.gestures.hint?1:0),
      cursorColumn:searching?this.sourceSearch!.caretColumn(this.columns())
        :body.cursorColumn + cellWidth(cursorPrefix) };
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
export interface TerminalPromptChoice {
  label: string;
  value: string;
  description?: string;
  /** Text or Markdown source displayed when this option is focused. */
  preview?: string;
}

const PREVIEW_MAX_CHARS = 2000;
const PREVIEW_WITHHELD = '(preview cannot be shown in full — compare the option labels and descriptions instead)';

/**
 * The recovered full/empty/withheld split (`Yb` [14883,…), chunk-qq2mgstr.js):
 * `pn` refuses a preview the 2000-unit cut would change, the string is sanitised
 * through `pc`, tabs become one space, and a truncation marker or a mark run the
 * collapser still rewrites withholds the preview. The empty check is the host's
 * own plain-text filter.
 */
export function questionPreviewText(preview: string | undefined): string | undefined {
  if (preview === undefined) return undefined;
  if (ne(preview, PREVIEW_MAX_CHARS) !== preview) return PREVIEW_WITHHELD;
  const sanitized = previewSanitized(preview).replace(/\t/g, ' ');
  if (!sanitized.replace(/�/g, '').trim()) return undefined;
  if (previewUnstableText(sanitized)) return PREVIEW_WITHHELD;
  return sanitized;
}

/** One question inside a grouped request; answers are collected per group key. */
export interface TerminalPromptGroup {
  key: string;
  title?: string;
  message: string;
  choices?: readonly TerminalPromptChoice[];
  multiple?: boolean;
  allowText?: boolean;
  defaultIndex?: number;
  maxTextChars?: number;
}
export interface TerminalPromptRequest {
  title?: string;
  message: string;
  choices?: readonly TerminalPromptChoice[];
  multiple?: boolean;
  allowText?: boolean;
  defaultIndex?: number;
  maxTextChars?: number;
  /**
   * When present the request runs as a sequence of groups followed by a review
   * page, and the answer carries one entry per group. Copied from the recovered
   * question flow, whose last tab is a "Review your answers" page.
   */
  groups?: readonly TerminalPromptGroup[];
  /** Review-page wording; defaults match the recovered page. */
  reviewTitle?: string;
  submitLabel?: string;
  cancelLabel?: string;
  /** Trusted local theme chooser; focus previews are restored when it closes. */
  themePreview?: boolean;
  themeEdit?: boolean;
  /**
   * Host-supplied AFK timeout for a grouped question dialog, copied from the
   * recovered `afkTimeoutMs` prop (`hwe`, chunk-24k7d6mw.js [1168211)). The
   * environment `CLAUDE_AFK_TIMEOUT_MS` overrides it; `null` disables AFK
   * unless that environment value is present. The model input field of the
   * same name is refused (`host_field`) and never reaches this request.
   */
  afkTimeoutMs?: number | null;
  /** Recovered question action returning clarification feedback to the model. */
  allowClarification?: boolean;
}
export interface TerminalPromptAnswer {
  selected: string[];
  clarify?: true;
  themeEdit?: boolean;
  text?: string;
  /** Present for grouped requests: one answer per group, in group order. */
  groups?: readonly TerminalPromptGroupAnswer[];
}
export interface TerminalPromptGroupAnswer { key: string; selected: string[]; text?: string; notes?: string }

/** Shared line/full-screen surface; modal support is optional for legacy hosts. */
export interface TerminalSurface {
  readonly isTTY: boolean;
  readonly outputStream: Writable;
  subscribe(callbacks: TerminalCallbacks): () => void;
  start(): unknown;
  close(): void;
  setRunning(running: boolean): void;
  setProgress?(event: import('./tui-progress.js').AgentProgressEvent): void;
  setTasks?(tasks: readonly import('./tasks.js').TaskRecord[]): void;
  bindInputHistory?(session: import('./session.js').Session): Promise<void>;
  flushInputHistory?(): Promise<void>;
  bindStatusLine?(session: import('./session.js').Session): void;
  bindDiffPanel?(session: import('./session.js').Session): void;
  toggleDiffPanel?(): Promise<string>;
  restoreDiffSelection?(attachment: PromptDiffSelection): void;
  flushStatusLine?(): Promise<void>;
  pauseProgress?(paused: boolean): void;
  restoreTurnDuration?(duration?: import('./tui-progress.js').TurnDuration): void;
  beginAssistantMessage?(): void;
  writeAssistantText?(text: string): void;
  endAssistantMessage?(): void;
  setKeybindings(keybindings?: Keybindings): void;
  setPrefersReducedMotion?(value?: boolean): void;
  setShowTurnDuration?(value?: boolean): void;
  setProgressSettings?(settings: import('./tui-progress-settings.js').ProgressDisplaySettings): void;
  setMaxProseWidth?(value?: number): void;
  setSyntaxHighlightingDisabled?(value?: boolean): void;
  /** The composer's `dg()`/`C7t()` gates; the keyword run and its alt+w toggle exist only while both hold. */
  setWorkflowKeywordSettings?(settings: { available: boolean; triggerEnabled: boolean }): void;
  setTheme?(value?: import('./tui-theme-state.js').ThemeSetting): void;
  bindThemeCatalog?(userDir?: string, workspace?: string, plugins?: import('./plugins.js').PluginConfig): void;
  getThemeChoices?(): Promise<TerminalPromptChoice[]>;
  editCustomTheme?(reference: string | undefined, pick: (theme: import('./tui-theme-state.js').ThemeSetting) => Promise<void>,
    signal: AbortSignal): Promise<void>;
  writeTerminalSequence(sequence: string): void;
  setEditorMode?(mode?: import('./tui-vim.js').EditorMode,remaps?:Record<string,unknown>): void;
  editDraft?(signal: AbortSignal, workspace?: string): Promise<ExternalEditorResult>;
  prompt?(request: TerminalPromptRequest, signal: AbortSignal): Promise<TerminalPromptAnswer | undefined>;
}
