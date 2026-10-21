import { wrapMessageText } from './tui-wrap.js';
import type { RenderedRow } from './tui-transcript.js';

/**
 * Tool result rows for the live transcript.
 *
 * Adapted from the recovered result renderers: the shared gutter `$e`
 * (chunk-rrrfrwjr.js [1610,2287)), the error body `Jf` (chunk-6k07rctx.js
 * [1389,2637), first ten lines `wst` chunk-gsp4h9s8.js [619,625)), the count
 * formatter `xZ` (chunk-yn0pfn70.js [13795,13867)) and the count body `qa`
 * (chunk-phg89898.js [42163,43376)). Read's summary is `F`'s text branch
 * (chunk-c0zba9s1.js [9804,10796)). Coordinates are zero-based UTF-16.
 * The recovered tree renders through Yoga; this host emits the same text rows
 * with the gutter and five-cell content margin. Only the local tool families
 * with recovered bodies are rendered; other successful tools keep their
 * existing status-only presentation.
 */

export type ToolDisplayResult = {
  id: string;
  name: string;
  input: unknown;
  content: string;
  isError: boolean;
};

// `$e` [1610,2287): two spaces, U+23BF, space and NBSP, five cells.
const GUTTER = '  ' + String.fromCharCode(0x23bf) + ' ' + String.fromCharCode(0xa0);
// `qa`'s verbose header sibling O: NBSP, NBSP, U+23BF, space, NBSP.
const VERBOSE_GUTTER = String.fromCharCode(0xa0, 0xa0, 0x23bf, 0x20, 0xa0);
const CONTENT_MARGIN = '     ';
const ERROR_LINE_LIMIT = 10;

function logicalLines(text: string): string[] {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function resultLines(name: string, content: string): string[] {
  const marker = name === 'read_file' ? '[read_file:' : name === 'search' ? '[search:' : '[list_files:';
  return logicalLines(content).filter(line => !line.startsWith(marker));
}

function plural(count: number, label: string): string {
  return count === 0 || count > 1 ? label : label.slice(0, -1);
}

function wrap(logical: string, prefix: string, columns: number): RenderedRow[] {
  const width = Math.max(8, columns - prefix.length);
  const rows: RenderedRow[] = [];
  const parts = wrapMessageText(logical, width).split('\n');
  for (const [index, part] of parts.entries()) {
    rows.push({ text: (index === 0 ? prefix : ' '.repeat(prefix.length)) + part,
      continuation: index > 0, indent: prefix.length });
  }
  return rows;
}

function errorRows(content: string, detailed: boolean, columns: number): RenderedRow[] {
  const raw = content.replace(/<\/?error>/g, '').trim();
  const normalized = raw === '' ? 'Tool execution failed' : raw;
  // `Jf` shortens an unparsable call in the collapsed view; the expanded view keeps its text.
  const text = !detailed && normalized.startsWith('InputValidationError: ') ? 'Invalid tool parameters'
    : normalized.startsWith('Error: ') || normalized.startsWith('Cancelled: ') ? normalized : `Error: ${normalized}`;
  const lines = logicalLines(text);
  const shown = detailed ? lines : lines.slice(0, ERROR_LINE_LIMIT);
  const rows = shown.map((line, index) => wrap(line, index === 0 ? GUTTER : CONTENT_MARGIN, columns)).flat();
  if (!detailed && lines.length > ERROR_LINE_LIMIT) {
    const hidden = lines.length - ERROR_LINE_LIMIT;
    rows.push(...wrap(`… +${hidden} ${plural(hidden, 'lines')} (ctrl+o)`, CONTENT_MARGIN, columns));
  }
  return rows;
}

function countRows(count: number, label: string, contentLines: string[], detailed: boolean, columns: number): RenderedRow[] {
  const summary = `Found ${count} ${plural(count, label)}`;
  // `qa` collapsed children: the count, the optional secondary count, a space and `wu`'s
  // `(ctrl+o)` hint only when the count is positive.
  if (!detailed) return wrap(`${summary}${count > 0 ? ' (ctrl+o)' : ''}`, GUTTER, columns);
  return [
    ...wrap(summary, VERBOSE_GUTTER, columns),
    ...contentLines.map(line => wrap(line, CONTENT_MARGIN, columns)).flat(),
  ];
}

/** Source `F`'s text branch: `Read N line(s)` independent of the verbose switch. */
function readRows(content: string, columns: number): RenderedRow[] {
  // Source `F` prints the file tool's numLines, which counts every returned line including
  // blanks; the host's projection keeps the split's trailing empty segment for a final newline,
  // which is not an extra line.
  const lines = resultLines('read_file', content);
  if (lines.at(-1) === '') lines.pop();
  const count = lines.length;
  return wrap(`Read ${count} ${plural(count, 'lines')}`, GUTTER, columns);
}

export function toolResultRows(result: ToolDisplayResult, detailed: boolean, columns: number): RenderedRow[] {
  if (result.isError) return errorRows(result.content, detailed, columns);
  if (result.name === 'read_file') return readRows(result.content, columns);
  const family = result.name === 'search' ? 'search' : result.name === 'list_files' ? 'list_files' : undefined;
  if (family === undefined) return [];
  const contentLines = resultLines(family, result.content).filter(line => line !== '');
  return countRows(contentLines.length, family === 'search' ? 'lines' : 'files',
    contentLines, detailed, columns);
}
