import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  fieldTexts,
  forgetSiteFields,
  inputFromTerminal,
  pickedValues,
  siteGeneration,
  siteGenerations,
  siteKey,
  withoutKeys,
} from '../src/plugin-chain-above-prompt-select.js';

beforeEach(() => {
  fieldTexts.set(undefined);
  pickedValues.set(undefined);
  siteGenerations.set(undefined);
});

test('the site key joins plugin and element with a NUL', () => {
  assert.equal(siteKey('p', 'e'), 'p\u0000e');
  assert.notEqual(siteKey('p', 'a'), siteKey('p', 'b'));
});

test('the stores start empty and hold what is set', () => {
  assert.equal(fieldTexts.get(), undefined);
  assert.equal(pickedValues.get(), undefined);
  assert.equal(siteGenerations.get(), undefined);
  const texts = new Map([['p\u0000e', new Map([['h', 'hello']])]]);
  fieldTexts.set(texts);
  assert.equal(fieldTexts.get(), texts);
  assert.equal(fieldTexts.get()?.get(siteKey('p', 'e'))?.get('h'), 'hello');
  fieldTexts.set(undefined);
  assert.equal(fieldTexts.get(), undefined);
});

test('a site generation reads 0 until it is stored', () => {
  assert.equal(siteGeneration('p', 'e'), 0);
  siteGenerations.set(new Map([[siteKey('p', 'e'), 4]]));
  assert.equal(siteGeneration('p', 'e'), 4);
  assert.equal(siteGeneration('p', 'other'), 0);
});

test('withoutKeys drops the named keys and leaves the source map alone', () => {
  const source = new Map([
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ]);
  const without = withoutKeys(source, ['b']);
  assert.deepEqual([...without], [['a', 1], ['c', 3]]);
  assert.deepEqual([...source], [['a', 1], ['b', 2], ['c', 3]]);
  assert.notEqual(without, source);
  assert.deepEqual([...withoutKeys(source, [])], [...source]);
  assert.deepEqual([...withoutKeys(source, ['a', 'b', 'c'])], []);
});

test('forgetSiteFields clears one site and bumps its generation', () => {
  const key = siteKey('p', 'e');
  const other = siteKey('p', 'f');
  fieldTexts.set(new Map([
    [key, new Map([['h', 'text']])],
    [other, new Map([['h2', 'kept']])],
  ]));
  pickedValues.set(new Map([
    [key, new Map([['h', 7]])],
    [other, new Map([['h2', 8]])],
  ]));
  siteGenerations.set(new Map([[key, 2]]));

  forgetSiteFields('p', 'e');

  assert.equal(siteGeneration('p', 'e'), 3);
  assert.equal(siteGeneration('p', 'f'), 0);
  assert.deepEqual([...fieldTexts.get()!.keys()], [other]);
  assert.deepEqual([...pickedValues.get()!.keys()], [other]);
  assert.equal(fieldTexts.get()!.get(other)!.get('h2'), 'kept');
});

test('forgetSiteFields bumps a fresh site from 0 to 1 and leaves other sites alone', () => {
  fieldTexts.set(new Map([[siteKey('q', 'a'), new Map([['h', 'x']])]]));
  pickedValues.set(new Map([[siteKey('q', 'a'), new Map([['h', 1]])]]));

  forgetSiteFields('q', 'z');

  assert.equal(siteGeneration('q', 'z'), 1);
  assert.deepEqual([...siteGenerations.get()!], [[siteKey('q', 'z'), 1]]);
  assert.deepEqual([...fieldTexts.get()!.keys()], [siteKey('q', 'a')]);
  assert.deepEqual([...pickedValues.get()!.keys()], [siteKey('q', 'a')]);
  assert.equal(fieldTexts.get()!.has(siteKey('q', 'z')), false);
});

test('inputFromTerminal settles for a plugin that holds no input element', async () => {
  const settled = inputFromTerminal({ plugin: 'missing', handle: 'h', element: 'e' });
  assert.equal(typeof settled.then, 'function');
  assert.equal(await settled, undefined);
});
