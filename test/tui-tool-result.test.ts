import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toolResultRows } from '../src/tui-tool-result.js';

const rows = (text: string) => toolResultRows({ id: '1', name: 'search', input: {}, content: text, isError: false }, false, 80);

test('read and listing results keep their recovered summaries and hide truncation markers', () => {
  const read = toolResultRows({ id: 'r', name: 'read_file', input: {}, isError: false,
    content: 'first\nsecond\n[read_file: output truncated; file continues]' }, false, 80);
  assert.deepEqual(read.map(row => row.text), ['  ⎿  Read 2 lines']);
  const blank = toolResultRows({ id: 'b', name: 'read_file', input: {}, isError: false,
    content: 'first\n\nthird\n[read_file: output truncated; file continues]' }, false, 80);
  assert.deepEqual(blank.map(row => row.text), ['  ⎿  Read 3 lines']);
  const finalNewline = toolResultRows({ id: 'n', name: 'read_file', input: {}, isError: false,
    content: 'first\nsecond\n' }, false, 80);
  assert.deepEqual(finalNewline.map(row => row.text), ['  ⎿  Read 2 lines']);
  const listing = toolResultRows({ id: 'l', name: 'list_files', input: {}, isError: false,
    content: 'a.ts\nb.ts\n[list_files: listing truncated at 2 entries]' }, false, 80);
  assert.deepEqual(listing.map(row => row.text), ['  ⎿  Found 2 files (ctrl+o)']);
});

test('verbose listings add the content under the five-cell margin', () => {
  const detailed = toolResultRows({ id: 's', name: 'search', input: {}, isError: false,
    content: 'a.ts:1:alpha\na.ts:2:beta' }, true, 80);
  assert.deepEqual(detailed.map(row => row.text),
    ['  ⎿  Found 2 lines', '     a.ts:1:alpha', '     a.ts:2:beta']);
  assert.deepEqual(rows('').map(row => row.text), ['  ⎿  Found 0 lines']);
});

test('errors keep ten lines plus the expand hint, and the transcript screen shows the rest', () => {
  const content = Array.from({ length: 13 }, (_, index) => `line ${index}`).join('\n');
  const collapsed = toolResultRows({ id: 'e', name: 'read_file', input: {}, content, isError: true }, false, 80);
  assert.equal(collapsed.length, 11);
  assert.equal(collapsed[0]!.text, '  ⎿  Error: line 0');
  assert.equal(collapsed.at(-1)!.text, '     … +3 lines (ctrl+o)');
  const eleven = Array.from({ length: 11 }, (_, index) => `line ${index}`).join('\n');
  assert.equal(toolResultRows({ id: 'e', name: 'read_file', input: {}, content: eleven, isError: true },
    false, 80).at(-1)!.text, '     … +1 line (ctrl+o)');
  const detailed = toolResultRows({ id: 'e', name: 'read_file', input: {}, content, isError: true }, true, 80);
  assert.equal(detailed.length, 13);
  assert.equal(detailed.at(-1)!.text, '     line 12');
  assert.equal(toolResultRows({ id: 'c', name: 'search', input: {}, content: 'Cancelled: stopped', isError: true },
    false, 80)[0]!.text, '  ⎿  Cancelled: stopped');
});

test('unported successful tools keep no rows of their own', () => {
  assert.deepEqual(toolResultRows({ id: 'b', name: 'run_command', input: {}, content: 'ok', isError: false }, true, 80), []);
});
