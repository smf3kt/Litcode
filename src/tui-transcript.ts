/**
 * Transcript viewport for the full-screen interaction layer.
 *
 * Adapted from the recovered transcript viewer (`chunk-3gz7s57c.js`
 * [167400,168900), SHA-256 9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b,
 * zero-based UTF-16 coordinates); its scroll command names come from the
 * `Transcript` and `Scroll` contexts of the key registry.
 *
 * What is carried over: the seven scroll increments (line, half page, full
 * page, page, top, bottom), the `transcript:toggleShowAll` collapse, the
 * bounded render prefix, and the two-rows-of-overscan window. What is
 * rewritten, with the reason: the recovered viewer is a React component that
 * lays out its rows through the vendored Yoga engine and holds its state in
 * `useState` memo slots. This earlier reducer adaptation remains while W44
 * ports the full renderer. Assistant messages now use source re/M's grapheme
 * masking with a Node width/wrap host; details are in the W44 port record.
 * The recovered viewer's second
 * output region (`{transcript, progress}`) is not modelled here, because this
 * product renders its live progress on the status line instead.
 */

import { cellWidth } from './terminal.js';
import { wrapMessageText } from './tui-wrap.js';

export type TranscriptEntryKind = 'user' | 'assistant' | 'system' | 'tool' | 'error';

export interface TranscriptEntry {
  kind: TranscriptEntryKind;
  text: string;
  /** A model message has one two-cell speaker gutter, including wrapped rows. */
  speaker?: boolean;
  /** Cumulative source stays separate from formatted selection text. */
  markdown?: string;
  streaming?: boolean;
  messageKey?: string;
  hideTrailingLine?: boolean;
  duration?: import('./tui-progress.js').TurnDuration;
}

export interface TranscriptState {
  entries: TranscriptEntry[];
  /** Index of the first visible rendered line. */
  offset: number;
  /** `transcript:toggleShowAll`: collapsed keeps the tail of long entries. */
  showAll: boolean;
}

export type TranscriptScrollCommand = 'lineUp' | 'lineDown' | 'halfPageUp' | 'halfPageDown'
  | 'fullPageUp' | 'fullPageDown' | 'pageUp' | 'pageDown' | 'top' | 'bottom';

export type TranscriptAction =
  | { type: 'append'; entry: TranscriptEntry }
  | { type: 'scroll'; command: TranscriptScrollCommand }
  | { type: 'toggleShowAll' }
  | { type: 'clear' }
  | { type: 'reveal' };

/** Collapsed entries longer than this keep their last lines, as the recovered tail view does. */
export const COLLAPSED_ENTRY_LINES = 12;
/** The recovered viewer keeps two screens of overscan around the viewport. */
export const OVERSCAN_ROWS = 2;

export function createTranscriptState(entries: readonly TranscriptEntry[] = []): TranscriptState {
  return { entries: [...entries], offset: 0, showAll: false };
}

/** One rendered row with the coordinates selection needs. */
export interface RenderedRow {
  text: string;
  /** True when this row was produced by wrapping the previous row's logical line. */
  continuation: boolean;
  /** Leading cells that belong to the entry's hanging indent, not to its text. */
  indent: number;
  ansi?: string;
  end?: number;
  elidedSeparator?: boolean;
}

/** Wrap one entry to the given width; every entry keeps its own hanging indent. */
export type EntryRowRenderer = (entry: TranscriptEntry, columns: number) => RenderedRow[];

export function wrapEntryRows(entry: TranscriptEntry, columns: number, renderer?: EntryRowRenderer): RenderedRow[] {
  const width = Math.max(8, Math.floor(columns));
  if ((entry.markdown !== undefined || entry.duration !== undefined) && renderer) return renderer(entry, width);
  if (entry.speaker) {
    const rows: RenderedRow[] = [];
    // Recovered vu(..., 'wrap') uses hard:true, trim:false with word wrapping.
    for (const paragraph of entry.text.replace(/\r\n?/g, '\n').split('\n')) {
      for (const [index, text] of wrapMessageText(paragraph, width - 2).split('\n').entries()) {
        rows.push({ text: '  ' + text, continuation: index > 0, indent: 2 });
      }
    }
    if (rows.length) rows[0] = { ...rows[0]!, text: '● ' + rows[0]!.text.slice(2) };
    return rows;
  }
  const indent = entry.kind === 'user' ? '> ' : entry.kind === 'tool' ? '  ' : '';
  const prefix = entry.kind === 'error' ? '! ' : entry.kind === 'system' ? '- ' : indent;
  const rows: RenderedRow[] = [];
  const push = (text: string, continuation: boolean) => {
    rows.push({ text, continuation, indent: cellWidth(prefix) });
  };
  for (const paragraph of entry.text.replace(/\r\n?/g, '\n').split('\n')) {
    let row = prefix;
    let used = cellWidth(prefix);
    if (paragraph === '') { push(prefix.trimEnd(), false); continue; }
    let wrapped = false;
    for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(paragraph)) {
      // Resolve tab stops before writing: render and selection share literal cell positions.
      const parts = segment === '\t' ? Array<string>(8 - used % 8).fill(' ') : [segment];
      for (const part of parts) {
        const cells = cellWidth(part);
        if (used + cells > width) {
          push(row, wrapped);
          wrapped = true;
          row = ' '.repeat(prefix.length); used = prefix.length;
        }
        row += part; used += cells;
      }
    }
    push(row, wrapped);
  }
  return rows;
}

/** Wrap one entry to the given width, keeping only the text of each row. */
export function wrapEntry(entry: TranscriptEntry, columns: number): string[] {
  return wrapEntryRows(entry, columns).map(row => row.text);
}

/**
 * Rendered lines for the current state. `showAll` off collapses only the tail
 * of an over-long entry, so the newest output stays visible either way.
 */
export function transcriptLines(state: TranscriptState, columns: number, renderer?: EntryRowRenderer): string[] {
  return renderedTranscriptRows(state, columns, renderer).map(row => row.text);
}

export interface TranscriptViewport {
  lines: string[];
  rows: RenderedRow[];
  /** First rendered line index, after clamping. */
  offset: number;
  total: number;
  /** True when the view is not pinned to the newest output. */
  scrolled: boolean;
}

/** Rendered rows for the current state, with the wrap metadata selection needs. */
export function renderedTranscriptRows(state: TranscriptState, columns: number, renderer?: EntryRowRenderer): RenderedRow[] {
  const rows: RenderedRow[] = [];
  for (const entry of state.entries) {
    const wrapped = wrapEntryRows(entry, columns, renderer);
    if (!wrapped.length) continue;
    if (entry.speaker && rows.length) rows.push({ text: '', continuation: false, indent: 0 });
    if (!state.showAll && !entry.speaker && wrapped.length > COLLAPSED_ENTRY_LINES) {
      const hidden = wrapped.length - COLLAPSED_ENTRY_LINES;
      rows.push({ text: `  ... ${hidden} earlier lines (ctrl+e shows all)`.slice(0, Math.max(8, Math.floor(columns))),
        continuation: false, indent: 0 });
      rows.push(...wrapped.slice(-COLLAPSED_ENTRY_LINES));
      continue;
    }
    rows.push(...wrapped);
  }
  return rows;
}

export function layoutTranscript(state: TranscriptState, columns: number, rows: number, renderer?: EntryRowRenderer): TranscriptViewport {
  const rendered = renderedTranscriptRows(state, columns, renderer);
  const lines = rendered.map(row => row.text);
  const height = Math.max(1, Math.floor(rows));
  const total = lines.length;
  const maxOffset = Math.max(0, total - height);
  const offset = Math.max(0, Math.min(state.offset, maxOffset));
  return { lines: lines.slice(offset, offset + height), rows: rendered.slice(offset, offset + height), offset, total, scrolled: offset < maxOffset };
}

const PAGE = (rows: number) => Math.max(1, Math.floor(rows));

/**
 * Applies one scroll command. `rows` is the transcript region height, not the
 * terminal height, so half and full pages move by what the person can see.
 */
export function scrollTranscript(state: TranscriptState, command: TranscriptScrollCommand,
  rows: number, total: number): TranscriptState {
  const height = PAGE(rows);
  const maxOffset = Math.max(0, total - height);
  const clamp = (value: number) => Math.max(0, Math.min(value, maxOffset));
  switch (command) {
    case 'lineUp': return { ...state, offset: clamp(state.offset - 1) };
    case 'lineDown': return { ...state, offset: clamp(state.offset + 1) };
    case 'halfPageUp': return { ...state, offset: clamp(state.offset - Math.floor(height / 2)) };
    case 'halfPageDown': return { ...state, offset: clamp(state.offset + Math.floor(height / 2)) };
    case 'fullPageUp': case 'pageUp': return { ...state, offset: clamp(state.offset - height) };
    case 'fullPageDown': case 'pageDown': return { ...state, offset: clamp(state.offset + height) };
    case 'top': return { ...state, offset: 0 };
    case 'bottom': return { ...state, offset: maxOffset };
  }
}

export function appendEntry(state: TranscriptState, entry: TranscriptEntry): TranscriptState {
  return { ...state, entries: [...state.entries, entry] };
}

/**
 * Pure transition for one transcript action. New output follows the tail only
 * while the view is already pinned there, which matches the recovered viewer's
 * stickiness rather than always jumping to the newest line.
 */
export function reduceTranscript(state: TranscriptState, action: TranscriptAction,
  view: { rows: number; total: number }): TranscriptState {
  switch (action.type) {
    case 'append': {
      const pinned = state.offset >= Math.max(0, view.total - PAGE(view.rows));
      const next = appendEntry(state, action.entry);
      return pinned ? { ...next, offset: Number.MAX_SAFE_INTEGER } : next;
    }
    case 'scroll': {
      const offset = Math.max(0, Math.min(state.offset, view.total - PAGE(view.rows)));
      return scrollTranscript({ ...state, offset }, action.command, view.rows, view.total);
    }
    case 'toggleShowAll':
      return { ...state, showAll: !state.showAll, offset: Number.MAX_SAFE_INTEGER };
    case 'clear': return { ...state, entries: [], offset: 0 };
    case 'reveal': return { ...state, offset: Number.MAX_SAFE_INTEGER };
  }
}
