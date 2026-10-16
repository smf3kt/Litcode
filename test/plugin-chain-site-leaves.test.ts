// The site leaves (W45-63). The bodies are the copy's src/plugin-chain-site-leaves-source.ts —
// chunk-n3ykh62m.js [233140,233219), [233330,233611), [233864,234038), [236808,236820), [237485,238267),
// [246293,246804), [246992,247131) and [257601,259180). Assertions are written from the measurement
// probes .audit/w45-63-probe{,b}.ts.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RAt } from '../src/plugin-chain-raster-sites.js';
import {
  checkAutoFocus, checkHoverKey, checkPress, CODE_MAX_START_LINE, codeLeafProblem, INPUT_FIELDS,
  inputLeafProblem, isNonBlankString, isPixelSide, optionProblem, SELECT_MAX_OPTIONS,
  selectLeafProblem, SVG_PIXEL_LIMIT, SVG_SOURCE_LIMIT, svgLeafProblem,
} from '../src/plugin-chain-site-leaves.js';

/** A press a leaf of this chain would be handed: a plugin that names one, and a whole-number handle. */
const PRESS = { plugin: 'p', handle: 1 };

test('the limits the four leaves are measured against are the source\'s own numbers', () => {
  assert.equal(CODE_MAX_START_LINE, 1e9);
  assert.equal(SVG_PIXEL_LIMIT, 4096);
  assert.equal(SVG_SOURCE_LIMIT, 131072);
  assert.equal(SELECT_MAX_OPTIONS, 64);
  assert.deepEqual(INPUT_FIELDS, ['label', 'placeholder', 'value', 'submitLabel']);
});

test('autoFocus is true or absent, and false is neither', () => {
  assert.equal(checkAutoFocus(undefined), undefined, 'absent is the default');
  assert.equal(checkAutoFocus(true), undefined);
  assert.equal(checkAutoFocus(false), 'autoFocus is true or absent', 'a false is answered, not ignored');
  assert.equal(checkAutoFocus(1), 'autoFocus is true or absent');
});

test('a hover-scope key that is wrong is dropped rather than refused', () => {
  assert.equal(checkHoverKey('k'), undefined);
  assert.equal(checkHoverKey('k'.repeat(RAt)), undefined, 'the limit itself fits');
  assert.equal(checkHoverKey(''), `Box key "" is not a string of 1 to ${RAt} characters; it is dropped and names no hover scope`);
  assert.equal(checkHoverKey(7), `Box key "7" is not a string of 1 to ${RAt} characters; it is dropped and names no hover scope`,
    'the label stringifies whatever it was given');
  assert.equal(checkHoverKey('k'.repeat(RAt + 1)),
    `Box key "${'k'.repeat(40)}..." is not a string of 1 to ${RAt} characters; it is dropped and names no hover scope`);
  assert.equal(checkHoverKey('a\x1bb'),
    'Box "a?b" key holds a control character; it is dropped and names no hover scope',
    'the two sentences are shaped differently, and the key is scrubbed in both');
});

test('a press must be held by a plugin of this chain', () => {
  assert.equal(checkPress(PRESS), undefined);
  assert.equal(checkPress({ plugin: 'p', handle: 1.5 }), 'is not held by a plugin of this chain',
    'a fractional handle is not a handle');
  assert.equal(checkPress({ plugin: 'p' }), 'is not held by a plugin of this chain');
  assert.equal(checkPress({ plugin: '', handle: 1 }), 'is not held by a plugin of this chain');
  assert.equal(checkPress(undefined), 'is not held by a plugin of this chain',
    'so a leaf that is handed no press at all is refused by this check');
});

test('a pixel side may be a fraction, and absent is not a refusal', () => {
  assert.equal(isPixelSide(undefined), true, 'a side that is not given is left to the default');
  assert.equal(isPixelSide(1), true);
  assert.equal(isPixelSide(1.5), true, 'measured: the check wants finite and positive, not whole');
  assert.equal(isPixelSide(SVG_PIXEL_LIMIT), true);
  assert.equal(isPixelSide(SVG_PIXEL_LIMIT + 1), false);
  assert.equal(isPixelSide(0), false);
  assert.equal(isPixelSide(-1), false);
  assert.equal(isPixelSide('1'), false);
});

test('a non-blank string is trimmed before it is judged', () => {
  assert.equal(isNonBlankString('a'), true);
  assert.equal(isNonBlankString(' a '), true);
  assert.equal(isNonBlankString('  '), false, 'whitespace is blank');
  assert.equal(isNonBlankString(''), false);
  assert.equal(isNonBlankString(1), false);
  assert.equal(isNonBlankString(undefined), false);
});

test('an option is checked against the Set its caller threads through', () => {
  const seen = new Set<string>();
  assert.equal(optionProblem({ value: 'a' }, seen), undefined);
  assert.deepEqual([...seen], ['a'], 'the check records what it saw');
  assert.equal(optionProblem({ value: 'a' }, seen), 'option "a" is listed twice; values are unique',
    'the second sighting is the duplicate');
  assert.equal(optionProblem({ value: 'b', label: 1 }, new Set()), 'option "b" label must be a string');
  assert.equal(optionProblem({ value: 'a', extra: 1 }, new Set()), 'options are { value: string, label?: string }',
    'a stray key answers the shape sentence, which names no value');
  assert.equal(optionProblem('x', new Set()), 'options are { value: string, label?: string }');
  assert.equal(optionProblem({ value: 'a\x1bb' }, new Set()), 'option "a\x1bb" value holds a control character',
    'and this sentence carries the value as it stands — the option is not scrubbed the way a site label is');
});

test('a Code block is admitted with every field it admits', () => {
  assert.equal(codeLeafProblem({ props: { source: 'x' } }), undefined);
  assert.equal(codeLeafProblem({
    props: { source: 'x', language: 'ts', path: 'a.ts', startLine: 1, format: 'diff', wrap: 'truncate-end' },
  }), undefined, 'and the two enum fields at their other value');
});

test('a Code block names a stray prop, and checks its fields in order', () => {
  assert.equal(codeLeafProblem({ props: null }), 'Code props must be { source }');
  assert.equal(codeLeafProblem({ props: { source: 'x', hover: 1 } }), 'Code prop "hover" is not allowed');
  assert.equal(codeLeafProblem({ props: { source: 'x', children: 1 } }), 'Code prop "children" is not allowed',
    'a key inside the props is a prop, and it is named');
  assert.equal(codeLeafProblem({ props: { source: 'x' }, children: 1 }), 'Code takes no children',
    'the leaf\'s own children are a different sentence, and it is checked early here');
  assert.equal(codeLeafProblem({ props: { source: 'x', language: 1 } }), 'Code language must be a string');
  assert.equal(codeLeafProblem({ props: { source: 'a\x1bb' } }), 'Code source holds a control character',
    'the source goes through the label check, so it is not length-capped');
  assert.equal(codeLeafProblem({ props: { source: 'x', startLine: 0 } }), 'Code startLine must be a positive integer');
  assert.equal(codeLeafProblem({ props: { source: 'x', startLine: 1.5 } }), 'Code startLine must be a positive integer');
  assert.equal(codeLeafProblem({ props: { source: 'x', startLine: CODE_MAX_START_LINE + 1 } }),
    `Code startLine is at most ${CODE_MAX_START_LINE}`);
  assert.equal(codeLeafProblem({ props: { source: 'x', startLine: CODE_MAX_START_LINE } }), undefined,
    'the limit itself is a line a block may start at');
  assert.equal(codeLeafProblem({ props: { source: 'x', format: 'other' } }), 'Code format is "source" or "diff"');
  assert.equal(codeLeafProblem({ props: { source: 'x', source_extra: 1, wrap: 'other' } }),
    'Code prop "source_extra" is not allowed', 'the prop sweep runs before any field check');
});

test('an Input sweeps its own key list and names the field it refused', () => {
  assert.equal(inputLeafProblem({ props: { key: 'k' }, press: PRESS }), undefined);
  assert.equal(inputLeafProblem({
    props: { key: 'k', label: 'L', placeholder: 'p', value: 'v', submitLabel: 's', autoFocus: true }, press: PRESS,
  }), undefined);
  const props = 'Input props must be { key } and any of label, placeholder, value, submitLabel, autoFocus';
  assert.equal(inputLeafProblem({ props: {} }), props, 'no key at all');
  assert.equal(inputLeafProblem({ props: { key: '' } }), props);
  assert.equal(inputLeafProblem({ props: { key: 'k', hover: 1 } }), props,
    'the sweep refuses the props without naming which key it did not want');
  assert.equal(inputLeafProblem({ props: { key: 'k', label: 1 }, press: PRESS }), 'Input "k" label must be a string');
  assert.equal(inputLeafProblem({ props: { key: 'k', label: 1, placeholder: 2 }, press: PRESS }),
    'Input "k" label must be a string', 'the four fields are checked in the list\'s order');
  assert.equal(inputLeafProblem({ props: { key: 'k', autoFocus: false }, press: PRESS }),
    'Input "k" autoFocus is true or absent');
});

test('an Input checks its fields before its children and its press before both', () => {
  assert.equal(inputLeafProblem({ props: { key: 'k' }, children: 'x' }),
    'Input "k" is not held by a plugin of this chain', 'the press is checked before children');
  assert.equal(inputLeafProblem({ props: { key: 'k' }, press: PRESS, children: 'x' }), 'Input "k" takes no children',
    'the only sentence this leaf answers with that names no field');
  assert.equal(inputLeafProblem({ props: { key: 'k', label: 1 }, press: PRESS, children: 'x' }),
    'Input "k" label must be a string', 'a field beats the children sentence');
});

test('a Select checks its key list, then its options, then the rest', () => {
  assert.equal(selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }] }, press: PRESS }), undefined);
  assert.equal(selectLeafProblem({
    props: { key: 'k', options: [{ value: 'a' }, { value: 'b' }], label: 'L', value: 'a', autoFocus: true }, press: PRESS,
  }), undefined);
  assert.equal(selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }], hover: 1 }, press: PRESS }),
    'Select props must be { key, options } and any of label, value, autoFocus');
  assert.equal(selectLeafProblem({ props: { key: 'k' }, press: PRESS }),
    `Select "k" options must be 1 to ${SELECT_MAX_OPTIONS} entries`);
  assert.equal(selectLeafProblem({ props: { key: 'k', options: [] }, press: PRESS }),
    `Select "k" options must be 1 to ${SELECT_MAX_OPTIONS} entries`);
  assert.equal(selectLeafProblem({ props: { key: 'k', options: new Array(SELECT_MAX_OPTIONS + 1).fill({ value: 'a' }) }, press: PRESS }),
    `Select "k" options must be 1 to ${SELECT_MAX_OPTIONS} entries`, 'and too many is the same sentence');
});

test('a Select threads one Set through its options, so a repeat is caught', () => {
  assert.equal(selectLeafProblem({
    props: { key: 'k', options: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] }, press: PRESS,
  }), undefined, 'distinct values pass');
  assert.equal(selectLeafProblem({
    props: { key: 'k', options: [{ value: 'a' }, { value: 'a' }] }, press: PRESS,
  }), 'Select "k" option "a" is listed twice; values are unique',
  'the duplicate is found against the values seen before it in the same list');
  assert.equal(selectLeafProblem({ props: { key: 'k', options: [{ value: 'a' }, 1] }, press: PRESS }),
    'Select "k" options are { value: string, label?: string }',
    'an option that is not an option answers the shape sentence, prefixed by the site');
});

test('a Select checks its label and value, then autoFocus, the press and children', () => {
  const base = { key: 'k', options: [{ value: 'a' }] };
  assert.equal(selectLeafProblem({ props: { ...base, label: 1 }, press: PRESS }), 'Select "k" label must be a string');
  assert.equal(selectLeafProblem({ props: { ...base, value: 1 }, press: PRESS }), 'Select "k" value must be a string');
  assert.equal(selectLeafProblem({ props: { ...base, autoFocus: false }, press: PRESS }),
    'Select "k" autoFocus is true or absent');
  assert.equal(selectLeafProblem({ props: base, press: {} }),
    'Select "k" is not held by a plugin of this chain');
  assert.equal(selectLeafProblem({ props: base, press: PRESS, children: 'x' }), 'Select "k" takes no children',
    'children are last here too, so the sentence is a bare "takes no children"');
});

test('an Svg is admitted with and without its optional sides', () => {
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a' } }), undefined);
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', width: 10, height: 20, isInteractive: true } }), undefined);
  assert.equal(svgLeafProblem({ props: { source: 'x'.repeat(SVG_SOURCE_LIMIT), alt: 'a' } }), undefined,
    'the source limit itself fits');
});

test('an Svg names a stray prop, then checks source, alt, the sides and isInteractive', () => {
  assert.equal(svgLeafProblem({ props: null }), 'Svg props must be { source, alt }');
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a' }, children: 1 }), 'Svg takes no children');
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', hover: 1 } }), 'Svg prop "hover" is not allowed',
    'a stray prop is named, the way the Image names one');
  assert.equal(svgLeafProblem({ props: { source: '', alt: 'a' } }), 'Svg source must be a non-empty string');
  assert.equal(svgLeafProblem({ props: { source: 'x'.repeat(SVG_SOURCE_LIMIT + 1), alt: 'a' } }),
    `Svg source longer than ${SVG_SOURCE_LIMIT} characters`);
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 1 } }), 'Svg alt must be a string');
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a\x1bb' } }), 'Svg alt holds a control character');
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', width: SVG_PIXEL_LIMIT + 1 } }),
    `Svg width and height are pixels, at most ${SVG_PIXEL_LIMIT}`,
    'the two sides share one sentence, so it cannot say which one is wrong');
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', height: 0 } }),
    `Svg width and height are pixels, at most ${SVG_PIXEL_LIMIT}`);
  assert.equal(svgLeafProblem({ props: { source: 'x', alt: 'a', isInteractive: 'yes' } }),
    'Svg isInteractive is a boolean', 'and it is checked after the sides');
});
