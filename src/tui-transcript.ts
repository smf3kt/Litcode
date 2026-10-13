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
 * `useState` memo slots, which this product has no counterpart for; here the
 * viewport is a pure reducer plus an explicit row layout reusing the existing
 * cell-accurate wrapper from `terminal.ts`. The recovered viewer's second
 * output region (`{transcript, progress}`) is not modelled here, because this
 * product renders its live progress on the status line instead.
 */

import { cellWidth } from './terminal.js';

export type TranscriptEntryKind = 'user' | 'assistant' | 'system' | 'tool' | 'error';

export interface TranscriptEntry {
  kind: TranscriptEntryKind;
  text: string;
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

/** Wrap one entry to the given width; every entry keeps its own hanging indent. */
export function wrapEntry(entry: TranscriptEntry, columns: number): string[] {
  const width = Math.max(8, Math.floor(columns));
  const indent = entry.kind === 'user' ? '> ' : entry.kind === 'tool' ? '  ' : '';
  const prefix = entry.kind === 'error' ? '! ' : entry.kind === 'system' ? '- ' : indent;
  const rows: string[] = [];
  for (const paragraph of entry.text.replace(/\r\n?/g, '\n').split('\n')) {
    let row = prefix;
    let used = cellWidth(prefix);
    if (paragraph === '') { rows.push(prefix.trimEnd()); continue; }
    for (const { segment } of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(paragraph)) {
      // Resolve tab stops before writing: render and selection share literal cell positions.
      const parts = segment === '\t' ? Array<string>(8 - used % 8).fill(' ') : [segment];
      for (const part of parts) {
        const cells = cellWidth(part);
        if (used + cells > width) { rows.push(row); row = ' '.repeat(prefix.length); used = prefix.length; }
        row += part; used += cells;
      }
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Rendered lines for the current state. `showAll` off collapses only the tail
 * of an over-long entry, so the newest output stays visible either way.
 */
export function transcriptLines(state: TranscriptState, columns: number): string[] {
  const lines: string[] = [];
  for (const entry of state.entries) {
    const wrapped = wrapEntry(entry, columns);
    if (!state.showAll && wrapped.length > COLLAPSED_ENTRY_LINES) {
      const hidden = wrapped.length - COLLAPSED_ENTRY_LINES;
      lines.push(`  ... ${hidden} earlier lines (ctrl+e shows all)`.slice(0, Math.max(8, Math.floor(columns))));
      lines.push(...wrapped.slice(-COLLAPSED_ENTRY_LINES));
      continue;
    }
    lines.push(...wrapped);
  }
  return lines;
}

export interface TranscriptViewport {
  lines: string[];
  /** First rendered line index, after clamping. */
  offset: number;
  total: number;
  /** True when the view is not pinned to the newest output. */
  scrolled: boolean;
}

export function layoutTranscript(state: TranscriptState, columns: number, rows: number): TranscriptViewport {
  const lines = transcriptLines(state, columns);
  const height = Math.max(1, Math.floor(rows));
  const total = lines.length;
  const maxOffset = Math.max(0, total - height);
  const offset = Math.max(0, Math.min(state.offset, maxOffset));
  return { lines: lines.slice(offset, offset + height), offset, total, scrolled: offset < maxOffset };
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
