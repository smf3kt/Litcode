import { Si, Lt } from './tui-input-cursor.js';
import type { EditorState, EditorLayout } from './terminal.js';
import { inputInvert } from './tui-focus-source.js';

/** Keep raw input offsets; source Lt's NFC normalization is a host difference. */
export function inputCursor(text: string, columns: number, offset: number) {
  const measured = new Lt(text, Math.max(1, Math.floor(columns) - 1));
  measured.text = text;
  return new Si(measured, offset);
}

/**
 * The draft offset each rendered prompt row starts at.
 *
 * Source `getRenderedRowStartOffsets(rows)` on the input state (chunk-f37m98yh.js sha256 207b107a452d54c8...,
 * [24224,24395) 171 units, body sha256 b3a5e35fc0949882...) is
 * `let {startLine, endLine} = this.getViewportLineRange(rows); return
 * this.measuredText.getWrappedLines().slice(startLine, endLine).map(line => line.displayStartOffset)`.
 * The store hands this list to the highlight row mapping (`S9r`) together with the rendered value, which
 * is `this.render(...)`'s string; the mapping turns a highlight's draft offsets into offsets in that
 * rendered string. Nothing here trims trailing blanks or stops at the caret: the rows are exactly the
 * viewport's wrapped lines, and what is painted over them is decided by the mapping and the caret filter.
 */
export function renderedRowStartOffsets(state: Pick<EditorState, 'text' | 'cursor'>, columns: number,
  maxRows: number): number[] {
  const cursor = inputCursor(state.text, columns, state.cursor);
  const rows = Math.max(1, Math.floor(maxRows));
  const { startLine, endLine } = cursor.getViewportLineRange(rows);
  return cursor.measuredText.getWrappedLines().slice(startLine, endLine)
    .map((line: { displayStartOffset: number }) => line.displayStartOffset);
}

export function layoutInput(state: Pick<EditorState, 'text' | 'cursor'>, columns: number,
  maxRows: number, vim?: {mode:string;anchor:number|null}, terminalFocused = true): EditorLayout & { viewportStartRow: number; rowStartOffsets: number[] } {
  const cursor = inputCursor(state.text, columns, state.cursor);
  const rows = Math.max(1, Math.floor(maxRows));
  const start = cursor.getViewportStartLine(rows);
  const position = cursor.getPosition();
  const lines = cursor.render(vim&&vim.mode!=='INSERT'?' ':'', '',
    (text:string)=>vim&&vim.mode!=='INSERT'?inputInvert(terminalFocused)(text):text,undefined,rows,
    vim?.anchor??undefined,vim?.mode==='VISUAL LINE',true).split('\n');
  return { lines, cursorRow: position.line - start, cursorColumn: position.column,
    hiddenRows: Math.max(0, cursor.measuredText.lineCount - rows), viewportStartRow: start,
    rowStartOffsets: renderedRowStartOffsets(state, columns, rows) };
}
