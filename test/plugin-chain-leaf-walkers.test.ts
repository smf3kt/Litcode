// The leaf table and the walkers that read it (W45-69). The bodies are the copy's
// src/plugin-chain-leaf-walkers-source.ts — chunk-n3ykh62m.js [236820,237297) `Dto`, [237297,237337)
// `vVe`, [238357,238438) `J4t`, [238917,239033) `Q4t`, [259180,259284) `tno`, [259284,259432) `nno`,
// [259432,259514) `IAt`, [259514,259714) `rno`, [259714,260226) `ono`, [262308,262627) `ano`,
// chunk-34bv7wfw.js [9299,11040) `tso`, chunk-f606a53w.js [7703,7802) `HN`, chunk-kcwp0ct0.js
// [17539,17627) `Int`, chunk-ax7r0qj7.js [3561,3652) `Lt`, chunk-nyce03br.js [5956,6041) the two
// constants. Assertions are written from the measurement probes .audit/w45-69-probe{,b}.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  diffHunks, diffReadFor, duplicateLeafKey, emittedLines, expandLeadingTabs, flattenLeafText,
  countOccurrences, hunkGutterWidth, LEAF_LINE_CAP, LEAF_TABLE, LEAF_WRAP_WIDTH, leafHeight, leafText,
  parseUnifiedDiff, sanitizeLeafText, SOURCE_BODIES, textWidthWithin,
} from '../src/plugin-chain-leaf-walkers.js';

/** The diff every diff case below is written against: one hunk, one context line, two added, and the
 *  parser's own no-newline marker line at the end. */
const DIFF = [
  '--- a/x', '+++ b/x', '@@ -1,2 +1,3 @@', ' a', '-b', '+c', '+d', '\\ No newline at end of file',
].join('\n');

/** A leaf of one type with the props a case hands it. */
const leaf = (type: string, props: Record<string, unknown> = {}) => ({ type, props });

test('the leaf table names the nine types, each mapped to the check that refuses a bad one', () => {
  assert.deepEqual(Object.keys(LEAF_TABLE).sort(), [
    'Button', 'Client', 'Code', 'Image', 'Input', 'Markdown', 'Raster', 'Select', 'Svg',
  ], 'the table covers every leaf type the tree can draw');
  assert.equal(Object.values(LEAF_TABLE).every((check) => typeof check === 'function'), true);
  const refused: Record<string, string> = {
    Button: 'Button props must be { key, label }, both strings, hotkey a digit or a letter, action a keybinding action, dimColor a boolean, variant "primary" or "secondary", role "dismiss" and autoFocus true',
    Client: 'Client props must be { key, module }, both non-empty strings, and any of props, width, height, flexGrow',
    Code: 'Code source must be a string',
    Image: 'Image alt must be a string',
    Input: 'Input props must be { key } and any of label, placeholder, value, submitLabel, autoFocus',
    Markdown: 'Markdown text must be a string',
    Raster: 'Raster props must be { key, columns, rows, cells }, key a non-empty string, and nothing else (no hover or onPress yet)',
    Select: 'Select props must be { key, options } and any of label, value, autoFocus',
    Svg: 'Svg source must be a non-empty string',
  };
  for (const [type, problem] of Object.entries(refused)) {
    assert.equal(LEAF_TABLE[type](leaf(type)), problem,
      'measured: an empty-props leaf of this type is refused with the sentence its own check gives');
  }
});

test('a leaf contributes its own text, and a button\'s children win over its label', () => {
  assert.deepEqual(leafText(leaf('Svg', { alt: 'A' })), ['A'], 'measured: a Svg contributes its alt');
  assert.deepEqual(leafText(leaf('Button', { label: 'L' })), ['L'], 'measured: a Button without children its label');
  assert.deepEqual(leafText({
    type: 'Button', props: { label: 'L' }, children: ['a', { children: ['b', 'c'] }],
  }), ['abc'], 'measured: with children it is the children joined, not the label');
  assert.deepEqual(leafText(leaf('Input', { label: 'L' })), ['L']);
  assert.deepEqual(leafText(leaf('Input')), [''], 'measured: an Input without a label contributes the empty string');
  assert.deepEqual(leafText(leaf('Markdown', { text: 'x' })), [], 'measured: any other type contributes nothing');
});

test('a leaf\'s children are flattened depth first, and anything else is measured rather than guessed', () => {
  assert.deepEqual(flattenLeafText(['a', { children: ['b', { children: ['c'] }] }, { children: [] }]),
    ['a', 'b', 'c'], 'measured: objects contribute their own children, in order, to the bottom');
  assert.throws(() => flattenLeafText([1]), {
    message: 'Cannot use \'in\' operator to search for \'children\' in 1',
  }, 'measured: a child that is neither a string nor an object throws rather than answering');
});

test('how tall a leaf is, in the lines it emits', () => {
  assert.equal(leafHeight(leaf('Raster', { rows: 7 })), 7, 'measured: a Raster answers its own row count');
  assert.equal(leafHeight(leaf('Markdown', { text: 'a\nb\nc' })), 3, 'measured: a Markdown its line count');
  assert.equal(leafHeight(leaf('Markdown', { text: 'a' })), 1);
  assert.equal(leafHeight({ type: 'Button', props: { label: 'x' }, children: ['hi there'] }), 1,
    'measured: everything else is one line plus the wrapped text it contributes');
  assert.equal(leafHeight(leaf('Svg', { alt: 'x' })), 1);
  assert.equal(leafHeight(leaf('Code', { source: 'a\nb\nc' })), 3, 'measured: a Code leaf its own line count');
  assert.equal(leafHeight(leaf('Code', { source: Array.from({ length: 20 }, () => 'x').join('\n') })), 20);
});

test('a Code leaf\'s height reads the diff it holds once the format says diff', () => {
  assert.equal(leafHeight(leaf('Code', { source: DIFF, format: 'diff' })), 9,
    'measured: the source lines plus the hunks the diff adds');
  assert.equal(leafHeight(leaf('Code', { source: DIFF, format: 'diff', wrap: 'truncate-end' })), 8,
    'measured: truncating the end drops the wrapped remainder');
  assert.equal(leafHeight(leaf('Code', { source: DIFF, format: 'diff', startLine: 100 })), 9,
    'measured: a known start line widens the gutter without changing the count here');
  assert.equal(leafHeight(leaf('Code', { source: DIFF, format: 'source' })), 9,
    'measured: a source-format Code leaf never pays for the parser');
});

test('a keyed leaf drawn twice is refused the second time, and only the second time', () => {
  const seen = new Set<string>();
  assert.equal(duplicateLeafKey(leaf('Input', { key: 'k' }), seen), undefined, 'the first sighting is admitted');
  assert.equal(duplicateLeafKey(leaf('Input', { key: 'k' }), seen),
    'Input "k" is drawn twice; each takes its own key', 'measured: the second is refused by name');
  assert.equal(duplicateLeafKey(leaf('Select', { key: 'k' }), seen), undefined,
    'measured: the same key under another type is not a duplicate');
  assert.equal(duplicateLeafKey(leaf('Input'), seen), undefined, 'a leaf with no key is never a duplicate');
  assert.equal(duplicateLeafKey(leaf('Svg', { key: 'k' }), seen), undefined,
    'measured: a type that carries no key is not looked at');
  assert.equal(duplicateLeafKey({ type: 'Input', props: { key: 5 } }, seen), undefined,
    'measured: a key that is not a string is not looked at either');
});

test('a diff is read back into hunks, with the parser\'s own marker lines dropped', () => {
  const read = diffHunks(DIFF);
  assert.equal(read.kind, 'hunks');
  assert.deepEqual(read, {
    kind: 'hunks',
    hunks: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 3, lines: [' a', '-b', '+c', '+d'] }],
  }, 'measured: the backslash marker is the parser\'s line, not the reader\'s');
});

test('a diff the reader cannot read comes back as a refusal rather than an error', () => {
  assert.deepEqual(diffHunks('not a diff'), { kind: 'refused', problem: 'no @@ hunk header found' },
    'measured: text with no hunk header at all');
  assert.deepEqual(diffHunks(''), { kind: 'refused', problem: 'no @@ hunk header found' });
  assert.deepEqual(diffHunks(['--- a/x', '+++ b/x', '@@ oops @@', ' a'].join('\n')),
    { kind: 'refused', problem: 'hunk 1 header is not @@ -a,b +c,d @@ within 1000000000 lines' },
    'measured: a header that is not a header names the hunk that failed');
  assert.deepEqual(diffHunks(['--- a/x', '+++ b/x', '@@ -1,1 +1,5 @@', ' a'].join('\n')),
    { kind: 'refused', problem: 'Added line count did not match for hunk at line 3' },
    'measured: the parser\'s own throw, caught by the reader and carried out as a refusal');
});

test('the parser behind the reader throws where the reader refuses, and keeps the marker line', () => {
  const hunks = parseUnifiedDiff(DIFF);
  assert.deepEqual(hunks[0].hunks[0].lines, [' a', '-b', '+c', '+d', '\\ No newline at end of file'],
    'measured: the parser keeps the marker line the reader drops');
  assert.throws(() => parseUnifiedDiff(['--- a/x', '+++ b/x', '@@ -1,1 +1,5 @@', ' a'].join('\n')), {
    message: 'Added line count did not match for hunk at line 3',
  }, 'measured: a hunk whose counts do not match its header is refused by the parser itself');
});

test('the reader a Code leaf asks for by format, and nothing for any other format', () => {
  assert.equal(diffReadFor(DIFF, 'diff')?.kind, 'hunks');
  assert.equal(diffReadFor('src', 'source'), undefined, 'measured: a source-format Code leaf is not parsed');
  assert.deepEqual(diffReadFor('src', 'diff'), { kind: 'refused', problem: 'no @@ hunk header found' },
    'measured: the format says diff, so the reader runs and refuses what it finds');
});

test('leaf text keeps a directional override from moving the line it was drawn on', () => {
  assert.equal(sanitizeLeafText('a‮b'), 'a�b', 'measured: the override becomes the replacement character');
  assert.equal(sanitizeLeafText('plain'), 'plain', 'and text without a mark is handed back unchanged');
  assert.equal(expandLeadingTabs('\tb'), '  b', 'measured: a leading tab expands to two spaces');
  assert.equal(expandLeadingTabs('a\tb'), 'a\tb', 'measured: a tab that is not leading is left alone');
  assert.equal(textWidthWithin('ab\tcd\nef', 2), 4,
    'measured: a tab counts for a stop\'s worth of width, and the reading stops past the budget');
});

test('the emitted lines a string takes at a width, and the gutter a hunk\'s numbers take', () => {
  assert.equal(emittedLines('a\nb\nc', 40), 2, 'measured: the line count while it is under the cap');
  assert.equal(emittedLines(Array.from({ length: 20 }, () => 'xxxx').join('\n'), 40), 19,
    'measured: past the cap, the line count plus the wrapped remainder');
  assert.equal(LEAF_WRAP_WIDTH, 40);
  assert.equal(LEAF_LINE_CAP, 12);
  assert.equal(countOccurrences('a\nb\nc', '\n'), 2, 'measured: how many times a needle occurs');
  assert.equal(countOccurrences('aaa', 'a'), 3);
  assert.equal(hunkGutterWidth({ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [] }), 4,
    'measured: the width of `+ N ` at the larger side\'s last line');
});

test('the source bodies under their own names answer what the ported call answers', () => {
  assert.equal(Object.keys(SOURCE_BODIES).length, 16);
  assert.deepEqual(SOURCE_BODIES.ono(leaf('Markdown', { text: 'a\nb\nc' })), leafHeight(leaf('Markdown', { text: 'a\nb\nc' })));
  assert.deepEqual(SOURCE_BODIES.rno(leaf('Svg', { alt: 'A' })), leafText(leaf('Svg', { alt: 'A' })));
  assert.deepEqual(SOURCE_BODIES.Dto(DIFF), diffHunks(DIFF));
  assert.equal(SOURCE_BODIES.kFe, LEAF_LINE_CAP);
  assert.equal(SOURCE_BODIES.lQt, LEAF_WRAP_WIDTH);
});
