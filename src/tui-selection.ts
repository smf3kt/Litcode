/** Adapted anchor/focus transitions and inclusive cell spans; exact provenance is in research/ports/W37-tui-selection.md. */
import { cellWidth } from './terminal.js';

export interface SelectionAnchor {
  /** Zero-based rendered transcript row and terminal cell column. */
  line: number;
  column: number;
}
/** The recovered selection keeps the span a multi-click produced, so a later drag extends by word or line. */
export type SelectionSpanKind = 'word' | 'line';
export interface SelectionSpan {
  kind: SelectionSpanKind;
  low: SelectionAnchor;
  high: SelectionAnchor;
}
export interface SelectionState {
  anchor: SelectionAnchor | null;
  focus: SelectionAnchor | null;
  dragging: boolean;
  span?: SelectionSpan;
}
export const createSelection = (): SelectionState => ({ anchor: null, focus: null, dragging: false });
export const hasSelection = (state: SelectionState): boolean => state.anchor !== null && state.focus !== null;

export function compareAnchors(left: SelectionAnchor, right: SelectionAnchor): number {
  if (left.line !== right.line) return left.line < right.line ? -1 : 1;
  if (left.column !== right.column) return left.column < right.column ? -1 : 1;
  return 0;
}
export function orderedSpan(state: SelectionState): { start: SelectionAnchor; end: SelectionAnchor } | null {
  if (!state.anchor || !state.focus) return null;
  return compareAnchors(state.anchor, state.focus) <= 0
    ? { start: state.anchor, end: state.focus } : { start: state.focus, end: state.anchor };
}
export type SelectionAction =
  | { type: 'start' | 'drag'; at: SelectionAnchor }
  | { type: 'end' | 'clear' }
  | { type: 'extend'; to: SelectionAnchor }
  | { type: 'word' | 'line'; at: SelectionAnchor; low: SelectionAnchor; high: SelectionAnchor };

/**
 * The recovered drag keeps the multi-click span and grows outward from it:
 * a drag past either end of the span moves that end and keeps the other, and
 * a drag inside the span keeps the span unchanged.
 */
function extendSpan(state: SelectionState, at: SelectionAnchor): SelectionState {
  const span = state.span;
  if (!span) return { ...state, focus: { ...at } };
  if (compareAnchors(at, span.low) < 0) return { ...state, anchor: { ...span.high }, focus: { ...at } };
  if (compareAnchors(at, span.high) > 0) return { ...state, anchor: { ...span.low }, focus: { ...at } };
  return { ...state, anchor: { ...span.low }, focus: { ...span.high } };
}

/**
 * The recovered `Ng` does not use the raw pointer cell while a multi-click span
 * is active: it re-resolves the word (or whole row) under the pointer and snaps
 * the moving end to that boundary, then keeps the far end of the original span.
 * A drag that stays inside the span leaves it untouched.
 */
export function dragSpan(state: SelectionState, at: SelectionAnchor, rowText: string | undefined): SelectionState {
  const span = state.span;
  if (!span || !state.dragging) return state;
  let low = at;
  let high = at;
  if (rowText !== undefined) {
    if (span.kind === 'word') {
      const word = wordSpan(rowText, at.column);
      if (word) { low = { line: at.line, column: word.low }; high = { line: at.line, column: word.high }; }
    } else {
      const line = lineSpan(rowText);
      low = { line: at.line, column: line.low };
      high = { line: at.line, column: line.high };
    }
  }
  if (compareAnchors(high, span.low) < 0) return { ...state, anchor: { ...span.high }, focus: { ...low } };
  if (compareAnchors(low, span.high) > 0) return { ...state, anchor: { ...span.low }, focus: { ...high } };
  return { ...state, anchor: { ...span.low }, focus: { ...span.high } };
}

export function reduceSelection(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'start': return { anchor: { ...action.at }, focus: null, dragging: true };
    case 'drag':
      if (!state.dragging || !state.anchor) return state;
      if (!state.span && !state.focus && compareAnchors(state.anchor, action.at) === 0) return state;
      return extendSpan(state, action.at);
    case 'end': return { ...state, dragging: false };
    case 'clear': return createSelection();
    case 'extend': return { anchor: state.anchor ?? { ...action.to }, focus: { ...action.to }, dragging: false };
    case 'word': case 'line': {
      const span: SelectionSpan = { kind: action.type, low: { ...action.low }, high: { ...action.high } };
      return { anchor: { ...action.low }, focus: { ...action.high }, dragging: true, span };
    }
  }
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function cells(text: string): { start: number; end: number; cell: number; width: number; segment: string }[] {
  let cell = 0;
  return Array.from(segmenter.segment(text), ({ segment, index }) => {
    const width = cellWidth(segment);
    const result = { start: index, end: index + segment.length, cell, width, segment };
    cell += width;
    return result;
  });
}

/** Snap either cell of a wide glyph to its start, keeping UTF-16 out of coordinates. */
export function selectionColumn(text: string, column: number): number {
  const parts = cells(text);
  const last = parts.at(-1);
  if (!last) return 0;
  const target = Math.max(0, Math.min(column, last.cell));
  return parts.find(part => target < part.cell + part.width)?.cell ?? last.cell;
}
export function moveSelectionColumn(text: string, column: number, direction: number): number {
  const parts = cells(text).filter(part => part.width > 0);
  const current = selectionColumn(text, column);
  return direction < 0 ? parts.filter(part => part.cell < current).at(-1)?.cell ?? 0
    : parts.find(part => part.cell > current)?.cell ?? current;
}

/**
 * Word characters, copied from the recovered `Z1` class: letters, numbers,
 * underscore, slash, dot, hyphen, plus, tilde and backslash. Spaces and every
 * other character form their own class, so a run of punctuation selects as one
 * word and a click on a space selects the run of spaces.
 */
const WORD_CHARACTER = /[\p{L}\p{N}_/.\-+~\\]/u;
const characterClass = (character: string): number => {
  if (character === ' ' || character === '') return 0;
  return WORD_CHARACTER.test(character) ? 1 : 2;
};

/** Inclusive cell span of the word under `column`, or null outside the text. */
export function wordSpan(text: string, column: number): { low: number; high: number } | null {
  const parts = cells(text);
  const target = selectionColumn(text, column);
  const hit = parts.find(part => part.cell === target);
  if (!hit) return null;
  const kind = characterClass(hit.segment);
  let low = target;
  let high = target;
  const at = (cell: number) => parts.find(part => part.cell === cell);
  for (let cell = target; cell > 0;) {
    const previous = at(moveSelectionColumn(text, cell, -1));
    if (!previous || previous.cell >= cell) break;
    if (characterClass(previous.segment) !== kind) break;
    low = previous.cell; cell = previous.cell;
  }
  for (;;) {
    const next = at(moveSelectionColumn(text, high, 1));
    if (!next || next.cell <= high) break;
    if (characterClass(next.segment) !== kind) break;
    high = next.cell;
  }
  return { low, high };
}

/** Inclusive cell span of the whole rendered row. */
export function lineSpan(text: string): { low: number; high: number } {
  const parts = cells(text).filter(part => part.width > 0);
  const last = parts.at(-1);
  return { low: 0, high: last ? last.cell : 0 };
}

/** Inclusive terminal cells become whole-grapheme string boundaries. */
function selectedRange(state: SelectionState, text: string, line: number): [number, number] | null {
  const span = orderedSpan(state);
  if (!span || line < span.start.line || line > span.end.line) return null;
  const from = line === span.start.line ? span.start.column : 0;
  const to = line === span.end.line ? span.end.column : Infinity;
  const selected = cells(text).filter(part => part.cell <= to && part.cell + part.width > from);
  return selected.length ? [selected[0]!.start, selected.at(-1)!.end] : null;
}
export function selectionText(state: SelectionState, lines: readonly string[]): string {
  const span = orderedSpan(state);
  if (!span) return '';
  const result: string[] = [];
  for (let row = Math.max(0, span.start.line); row <= span.end.line && row < lines.length; row++) {
    const text = lines[row]!;
    const range = selectedRange(state, text, row);
    result.push(range ? text.slice(...range).replace(/\s+$/, '') : '');
  }
  return result.join('\n');
}

/** Row metadata a soft-wrap-aware copy needs; `wrapEntryRows` produces it. */
export interface SelectionRow {
  text: string;
  continuation: boolean;
  indent: number;
}
/**
 * Copy text for rows that carry wrap metadata. A row produced by wrapping is
 * joined to the row above with no newline and its leading indent padding is
 * dropped, because that padding is a render artefact rather than entry text;
 * every other row starts a new line. This mirrors the recovered
 * `softWrap`-aware extraction, which walks the wrap continuation chain.
 */
export function selectionTextFromRows(state: SelectionState, rows: readonly SelectionRow[]): string {
  const span = orderedSpan(state);
  if (!span) return '';
  const parts: string[] = [];
  for (let row = Math.max(0, span.start.line); row <= span.end.line && row < rows.length; row++) {
    const meta = rows[row]!;
    const cellsOfRow = cells(meta.text);
    // A wrapped row's leading padding is a render artefact, so its text starts
    // after the indent and joins the row above; every other row keeps its own
    // prefix, because that prefix is part of the line the person sees.
    const startCell = meta.continuation ? meta.indent : 0;
    const fromCell = Math.max(startCell, row === span.start.line ? span.start.column : startCell);
    const toCell = row === span.end.line ? span.end.column : Infinity;
    const selected = cellsOfRow.filter(part => part.width > 0
      && part.cell + part.width > fromCell && part.cell <= toCell);
    const slice = selected.length ? meta.text.slice(selected[0]!.start, selected.at(-1)!.end) : '';
    // A row that continues into the next selected row keeps its trailing
    // whitespace: when the wrap point lands on a space, that space is real
    // text and dropping it would glue the two halves together. Only the last
    // row of a part trims, which is what removes trailing padding.
    const joinsNext = row < span.end.line && rows[row + 1]?.continuation === true;
    const text = joinsNext ? slice : slice.replace(/\s+$/, '');
    if (row > span.start.line && meta.continuation) parts[parts.length - 1] += text;
    else parts.push(text);
  }
  return parts.join('\n');
}
export function highlightSelection(state: SelectionState, text: string, line: number): string {
  const range = selectedRange(state, text, line);
  if (!range) return text;
  return text.slice(0, range[0]) + '\x1b[7m' + text.slice(...range) + '\x1b[27m' + text.slice(range[1]);
}
