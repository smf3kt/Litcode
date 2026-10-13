/** Adapted anchor/focus transitions and inclusive cell spans; exact provenance is in research/ports/W37-tui-selection.md. */
import { cellWidth } from './terminal.js';

export interface SelectionAnchor {
  /** Zero-based rendered transcript row and terminal cell column. */
  line: number;
  column: number;
}
export interface SelectionState {
  anchor: SelectionAnchor | null;
  focus: SelectionAnchor | null;
  dragging: boolean;
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
  | { type: 'extend'; to: SelectionAnchor };

export function reduceSelection(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'start': return { anchor: { ...action.at }, focus: null, dragging: true };
    case 'drag':
      if (!state.dragging || !state.anchor) return state;
      if (!state.focus && compareAnchors(state.anchor, action.at) === 0) return state;
      return { ...state, focus: { ...action.at } };
    case 'end': return { ...state, dragging: false };
    case 'clear': return createSelection();
    case 'extend': return { anchor: state.anchor ?? { ...action.to }, focus: { ...action.to }, dragging: false };
  }
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
function cells(text: string): { start: number; end: number; cell: number; width: number }[] {
  let cell = 0;
  return Array.from(segmenter.segment(text), ({ segment, index }) => {
    const width = cellWidth(segment);
    const result = { start: index, end: index + segment.length, cell, width };
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
export function highlightSelection(state: SelectionState, text: string, line: number): string {
  const range = selectedRange(state, text, line);
  if (!range) return text;
  return text.slice(0, range[0]) + '\x1b[7m' + text.slice(...range) + '\x1b[27m' + text.slice(range[1]);
}
