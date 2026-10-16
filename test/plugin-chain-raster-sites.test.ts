// The raster leaf problems (W45-62). The bodies are the copy's src/plugin-chain-raster-sites-source.ts —
// chunk-n3ykh62m.js [233219,233330), [233808,233864), [235650,235982), [237337,237485), [242738,242804),
// [245596,246293), [247200,247312) and [257143,257601). Assertions are written from the measurement
// probes .audit/w45-62-probe{,b,c,d,e,f,g}.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  allowedKeys, checkLabel, checkString, firstFieldProblem, imageLeafProblem, imageSizeProblem,
  isChainStamped, IMAGE_COLUMNS, IMAGE_ROWS, KEY_LABEL_LIMIT, labelOf, pickRasterProps,
  rasterLeafProblem, RASTER_SITE_FIELDS, STRING_LIMIT,
} from '../src/plugin-chain-raster-sites.js';

/** One cell of the blit's wire shape: three 32-bit words — the code point, the foreground and the
 *  background. `fur` decodes these, so a Raster problem can only be reached with this beside it. */
const cell = (codePoint: number, foreground = 32768, background = 32768): string => {
  const bytes = Buffer.alloc(12);
  bytes.writeUInt32LE(codePoint, 0);
  bytes.writeUInt32LE(foreground, 4);
  bytes.writeUInt32LE(background, 8);
  return bytes.toString('base64');
};
const CELL_A = cell(0x41);

/** A PNG the source's own `Mss` admits: the signature, then an IHDR chunk whose width and height the
 *  check reads. Measured — the signature alone, the name alone, the length and name, and the name with
 *  its thirteen bytes all answer "has no IHDR header after its signature", so the check reads the
 *  length-prefixed chunk and not just the marker. */
const png = (width: number, height: number): string => {
  const be = (value: number) => [value >>> 24 & 255, value >>> 16 & 255, value >>> 8 & 255, value & 255];
  const name = [...'IHDR'].map((character) => character.charCodeAt(0));
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...be(13), ...name, ...be(width), ...be(height), 8, 6, 0, 0, 0, 0, 0, 0, 0,
  ]).toString('base64');
};

test('the bounds a problem works within are the source\'s own numbers', () => {
  assert.equal(KEY_LABEL_LIMIT, 40, 'a key is cut to 40');
  assert.equal(STRING_LIMIT, 10000, 'a string field is refused past 10000');
  assert.equal(IMAGE_COLUMNS, 255);
  assert.equal(IMAGE_ROWS, 255);
  assert.deepEqual(RASTER_SITE_FIELDS, ['key', 'columns', 'rows', 'cells'],
    'the Raster mount admits exactly the four fields the picker picks against');
});

test('a label scrubs what the pattern matches and is cut only past the limit', () => {
  assert.equal(labelOf('key'), 'key');
  assert.equal(labelOf('k'.repeat(KEY_LABEL_LIMIT)), 'k'.repeat(KEY_LABEL_LIMIT), 'a key at the limit fits');
  assert.equal(labelOf('k'.repeat(KEY_LABEL_LIMIT + 1)), `${'k'.repeat(KEY_LABEL_LIMIT)}...`,
    'one past the limit is cut and ellipsised');
  assert.equal(labelOf('a\tb'), 'a?b', 'what the scrubber matches becomes a question mark');
  assert.equal(labelOf('a\nb'), 'a?b');
  assert.equal(labelOf('a\x1bb'), 'a?b');
});

test('the allowed-keys predicate reads own keys only', () => {
  assert.equal(allowedKeys({ key: 'k', columns: 1 }, ['key', 'columns']), true);
  assert.equal(allowedKeys({ key: 'k', hover: 1 }, ['key', 'columns']), false);
  assert.equal(allowedKeys({}, ['key']), true, 'no keys is nothing to refuse');
});

test('a leaf is stamped only by a non-empty plugin string', () => {
  assert.equal(isChainStamped({ plugin: 'p' }), true);
  assert.equal(isChainStamped({ plugin: '' }), false, 'an empty name is not a stamp');
  assert.equal(isChainStamped({}), false);
  assert.equal(isChainStamped(null), false);
});

test('the string check caps its length where the label check does not', () => {
  assert.equal(checkString('key', undefined), undefined, 'a field that is not there is not this check\'s');
  assert.equal(checkString('key', 'ok'), undefined);
  assert.equal(checkString('key', 7), 'key must be a string');
  assert.equal(checkString('key', 'k'.repeat(STRING_LIMIT)), undefined, 'the cap itself is admitted');
  assert.equal(checkString('key', 'k'.repeat(STRING_LIMIT + 1)), `key longer than ${STRING_LIMIT} characters`);
  assert.equal(checkLabel('alt', 'a'.repeat(STRING_LIMIT + 5)), undefined, 'an alt has no cap');
  assert.equal(checkLabel('alt', 7), 'alt must be a string', 'it is the same check otherwise');
});

test('the control test is the pattern, not the sentence it answers with', () => {
  for (const value of ['a\x1bb', 'a\x00b', 'a\x7fb', 'a\ud800b', 'a\udc00b']) {
    assert.equal(checkString('key', value), 'key holds a control character', `${JSON.stringify(value)} is refused`);
  }
  for (const value of ['a\tb', 'a\nb', 'a😀b', 'a�b', 'a￼b']) {
    assert.equal(checkString('key', value), undefined, `${JSON.stringify(value)} is admitted`);
  }
  assert.equal(checkLabel('alt', 'a\x1bb'), 'alt holds a control character', 'the label check uses it too');
});

test('the field sweep answers the first problem in list order', () => {
  assert.equal(firstFieldProblem(['key'], { key: 'ok' }), undefined);
  assert.equal(firstFieldProblem(['key'], { key: 'a\x1bb' }), 'key holds a control character');
  assert.equal(firstFieldProblem(['a', 'b'], { a: 1, b: 2 }), 'a must be a string', 'the list order decides');
});

test('an Image size is checked against the 255 by 255 limits', () => {
  assert.equal(imageSizeProblem(1, 1), undefined);
  assert.equal(imageSizeProblem(IMAGE_COLUMNS, IMAGE_ROWS), undefined, 'the limits themselves are admitted');
  assert.equal(imageSizeProblem(IMAGE_COLUMNS + 1, 1), `columns must be a whole number from 1 to ${IMAGE_COLUMNS}`);
  assert.equal(imageSizeProblem(0, 1), `columns must be a whole number from 1 to ${IMAGE_COLUMNS}`);
  assert.equal(imageSizeProblem(1.5, 1), `columns must be a whole number from 1 to ${IMAGE_COLUMNS}`);
  assert.equal(imageSizeProblem(1, IMAGE_ROWS + 1), `rows must be a whole number from 1 to ${IMAGE_ROWS}`);
});

test('the Raster picker answers a copy, and only for a keyed well-formed object', () => {
  assert.deepEqual(pickRasterProps({ key: 'k', columns: 1, rows: 1, cells: 'x' }),
    { key: 'k', columns: 1, rows: 1, cells: 'x' });
  assert.equal(pickRasterProps({ key: '', columns: 1 }), undefined, 'an empty key is not a key');
  assert.equal(pickRasterProps({ key: 'k', hover: 1 }), undefined, 'a stray field is not picked');
  assert.equal(pickRasterProps(null), undefined);
  assert.deepEqual(RASTER_SITE_FIELDS, ['key', 'columns', 'rows', 'cells'], 'the picker is given this list');
});

test('a Raster is admitted when its props, frame and stamp all hold', () => {
  assert.equal(rasterLeafProblem({
    props: { key: 'k', columns: 1, rows: 1, cells: CELL_A }, raster: { plugin: 'p' },
  }), undefined);
  assert.equal(rasterLeafProblem({
    props: { key: 'k', columns: 2, rows: 1, cells: Buffer.concat([
      Buffer.from(CELL_A, 'base64'), Buffer.from(cell(0x42), 'base64'),
    ]).toString('base64') }, raster: { plugin: 'p' },
  }), undefined, 'a two-cell frame of printable code points passes too');
});

test('a Raster is refused by the picker before anything else', () => {
  const frame = { columns: 1, rows: 1, cells: CELL_A };
  const props = 'Raster props must be { key, columns, rows, cells }, key a non-empty string, and nothing else (no hover or onPress yet)';
  assert.equal(rasterLeafProblem({ props: frame, raster: { plugin: 'p' } }), props, 'no key at all');
  assert.equal(rasterLeafProblem({ props: { ...frame, key: '' }, raster: { plugin: 'p' } }), props);
  assert.equal(rasterLeafProblem({ props: { ...frame, key: 'k', hover: 1 }, raster: { plugin: 'p' } }), props,
    'a stray field is the picker\'s sentence, not a field check\'s');
  assert.equal(rasterLeafProblem({}), props, 'nothing to pick from');
});

test('a Raster\'s children, size, cells and stamp are checked in that order', () => {
  const props = { key: 'k', columns: 1, rows: 1, cells: CELL_A };
  assert.equal(rasterLeafProblem({ props, children: 'x', raster: { plugin: 'p' } }), 'Raster takes no children');
  assert.equal(rasterLeafProblem({ props: { ...props, columns: 600 }, raster: { plugin: 'p' } }),
    'Raster "k" columns must be a whole number from 1 to 512',
    'the size is checked against the default mount of 512 by 256, not the Image\'s 255 by 255');
  assert.equal(rasterLeafProblem({ props, raster: {} }), 'Raster "k" is not stamped by a plugin of this chain',
    'the stamp is last, so a well-formed frame is what reaches it');
  assert.match(rasterLeafProblem({ props: { key: 'k', columns: 1, rows: 1, cells: 'zz' }, raster: { plugin: 'p' } }) ?? '',
    /^Raster "k" cells must be the base64/, 'the decoder\'s own problem is the sentence');
});

test('a Raster problem names the site by the scrubbed, truncated key', () => {
  const props = (key: string) => ({ key, columns: 1, rows: 1, cells: CELL_A });
  const long = 'k'.repeat(KEY_LABEL_LIMIT + 1);
  assert.match(rasterLeafProblem({ props: props(long), raster: {} }) ?? '',
    new RegExp(`^Raster "${'k'.repeat(KEY_LABEL_LIMIT)}\\.\\.\\." is not stamped`));
  assert.match(rasterLeafProblem({ props: props('a\tb'), raster: {} }) ?? '', /^Raster "a\?b" is not stamped/,
    'the label scrubber runs even on a key the field check admits');
});

test('an Image is admitted when its source, alt, size and stamp all hold', () => {
  const source = { png: png(1, 1) };
  assert.equal(imageLeafProblem({ props: { source, alt: 'a', columns: 1, rows: 1 }, image: { plugin: 'p' } }), undefined);
  assert.equal(imageLeafProblem({ props: { source, alt: '', columns: 1, rows: 1 }, image: { plugin: 'p' } }), undefined,
    'an empty alt is a string, and this check only asks that it is one');
  assert.equal(imageLeafProblem({
    props: { source: { rgba: Buffer.alloc(4).toString('base64'), width: 1, height: 1 }, alt: 'a', columns: 1, rows: 1 },
    image: { plugin: 'p' },
  }), undefined, 'the rgba source shape passes the same chain');
});

test('an Image names the stray field it found, and says where a press goes', () => {
  const props = { source: { png: png(1, 1) }, alt: 'a', columns: 1, rows: 1 };
  assert.equal(imageLeafProblem({ props: { ...props, hover: 1 }, image: { plugin: 'p' } }),
    'Image prop "hover" is not allowed (no hover or onPress; a press goes on an enclosing Button)',
    'the leftover key is named — a Raster says one sentence, an Image names the field');
  assert.equal(imageLeafProblem({ props: { ...props, hover: 1, press: 2 }, image: { plugin: 'p' } }),
    'Image prop "hover" is not allowed (no hover or onPress; a press goes on an enclosing Button)',
    'the first leftover key in own-key order is the one named');
  assert.equal(imageLeafProblem({ props: null }), 'Image props must be { source, columns, rows, alt }');
  assert.equal(imageLeafProblem({ props, children: 'x', image: { plugin: 'p' } }), 'Image takes no children');
});

test('an Image\'s alt, key and size are checked before its source', () => {
  const source = { png: png(1, 1) };
  const props = { source, alt: 'a', columns: 1, rows: 1 };
  assert.equal(imageLeafProblem({ props: { ...props, alt: 1 }, image: { plugin: 'p' } }), 'Image alt must be a string');
  assert.equal(imageLeafProblem({ props: { ...props, key: '' }, image: { plugin: 'p' } }),
    'Image key must be a non-empty string when given');
  assert.equal(imageLeafProblem({ props: { source, alt: 'a' }, image: { plugin: 'p' } }),
    `Image columns must be a whole number from 1 to ${IMAGE_COLUMNS}`,
    'a missing size is refused, so an Image always states its columns and rows');
  assert.equal(imageLeafProblem({ props: { ...props, key: 'k' }, image: {} }),
    'Image "k" is not stamped by a plugin of this chain', 'the stamp is last here too');
});

test('the Image\'s own type checks are bare, and only its last four name the site', () => {
  const props = { source: { png: png(1, 1) }, alt: 'a', columns: 1, rows: 1 };
  // The four sentences the leaf answers with before it builds a label are the same with a key and
  // without one: the props sentence, the children sentence, the alt type, and the key type.
  assert.equal(imageLeafProblem({ props: null }), 'Image props must be { source, columns, rows, alt }');
  assert.equal(imageLeafProblem({ props: { ...props, key: 'k' }, children: 'x', image: { plugin: 'p' } }),
    'Image takes no children');
  assert.equal(imageLeafProblem({ props: { ...props, alt: 1, key: 'k' }, image: { plugin: 'p' } }),
    'Image alt must be a string');
  assert.equal(imageLeafProblem({ props: { ...props, key: '' }, image: { plugin: 'p' } }),
    'Image key must be a non-empty string when given');
  // A leftover prop is named as a prop, and a key does not change that.
  assert.equal(imageLeafProblem({ props: { ...props, children: 'x' }, image: { plugin: 'p' } }),
    'Image prop "children" is not allowed (no hover or onPress; a press goes on an enclosing Button)',
    'a key inside the props is a leftover prop, which is not the same as the leaf\'s own children');
  // From the alt check onward the site names itself by its key when it has one.
  assert.equal(imageLeafProblem({ props: { ...props, columns: 300 }, image: { plugin: 'p' } }),
    `Image columns must be a whole number from 1 to ${IMAGE_COLUMNS}`);
  assert.equal(imageLeafProblem({ props: { ...props, columns: 300, key: 'k' }, image: { plugin: 'p' } }),
    `Image "k" columns must be a whole number from 1 to ${IMAGE_COLUMNS}`);
  assert.equal(imageLeafProblem({ props: { ...props, alt: 'a\x1bb', key: 'k' }, image: { plugin: 'p' } }),
    'Image "k" alt holds a control character');
  assert.match(imageLeafProblem({ props: { ...props, columns: 300, key: 'k'.repeat(50) }, image: { plugin: 'p' } }) ?? '',
    new RegExp(`^Image "${'k'.repeat(KEY_LABEL_LIMIT)}\\.\\.\\." columns must be a whole number from 1 to ${IMAGE_COLUMNS}$`),
    'a key that reaches the label is cut to the limit and ellipsised');
  assert.equal(imageLeafProblem({ props: { ...props, alt: 1, key: 'k' }, image: { plugin: 'p' } }),
    'Image alt must be a string',
    'the alt type is answered before the label exists, so the key cannot appear beside it');
});
