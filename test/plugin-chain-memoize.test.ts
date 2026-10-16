import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import {V, po} from '../src/plugin-chain-memoize-source.js';
import {oOn} from '../src/plugin-chain-records.js';

interface Cache {
  size: number;
  get(key: unknown): unknown;
  set(key: unknown, value: unknown): Cache;
  has(key: unknown): boolean;
  delete(key: unknown): boolean;
  clear(): void;
}
interface Memo {
  (...args: any[]): any;
  cache: Cache;
}
interface Memoize {
  (make: (...args: any[]) => any, resolver?: ((...args: any[]) => any) | null): Memo;
  Cache: new (entries?: [unknown, unknown][]) => Cache;
}
const memoize = po as unknown as Memoize;

// Source chunk-ae84tp6z.js [707,5355), zero-based UTF-16. Run only the owned copy.
function isolatedMemoize(setup: string): Memoize {
  const source = readFileSync(new URL('../src/plugin-chain-memoize-source.ts', import.meta.url), 'utf8');
  // The copy is the source bodies plus one generated export list; the test runs the bodies alone.
  const boundary = /\nexport \{ ([^}]+) \};\s*$/;
  const listed = boundary.exec(source);
  assert.ok(listed, 'the product module ends with its generated export list');
  // `V` and `po` are the chain's; the rest are the helpers the W45-14 lodash copies read out of here.
  assert.deepEqual(listed[1].split(', '),
    ['V', 'po', 'nie', 'rie', 'nIr', '_U', 'aA', 'bG', 'iYe', 'Hwe', 'Qpt', 'RDt', 'TDt', 'Zpt']);
  const body = source.replace(boundary, '');
  return runInNewContext(`${setup}\n${body}\npo;`, {}, {timeout: 1000}) as Memoize;
}

test('memoize preserves keyed results, receiver, resolver, invalidation and the chain holder', () => {
  assert.equal(V, po);
  const calls: unknown[][] = [];
  const memo = memoize((...args) => { calls.push(args); return args[1]; });
  assert.equal(memo('undefined', undefined), undefined);
  assert.equal(memo('undefined', 'ignored'), undefined);
  assert.equal(memo('null', null), null);
  assert.equal(memo('null', 'ignored'), null);
  assert.equal(memo('zero', 0), 0);
  assert.equal(memo('zero', 10), 0);
  assert.deepEqual(calls, [['undefined', undefined], ['null', null], ['zero', 0]]);
  assert.equal(memo.cache.delete('zero'), true);
  assert.equal(memo('zero', 10), 10);
  memo.cache.clear();
  assert.equal(memo('undefined', 'fresh'), 'fresh');

  let count = 0;
  const byName = memoize(
    function(this: {prefix: string}, name: string, value: string) { count++; return this.prefix + value; },
    function(this: {prefix: string}, name: string) { return this.prefix + name.toLowerCase(); },
  );
  assert.equal(byName.call({prefix: 'a:'}, 'KEY', 'one'), 'a:one');
  assert.equal(byName.call({prefix: 'a:'}, 'key', 'two'), 'a:one');
  assert.equal(byName.call({prefix: 'b:'}, 'key', 'two'), 'b:two');
  assert.equal(count, 2);
  assert.throws(() => memoize(null as never), {name: 'TypeError', message: 'Expected a function'});
  assert.throws(() => memoize(() => 1, 'bad' as never), {name: 'TypeError', message: 'Expected a function'});
  assert.equal(memoize(() => 1, null)(), 1);

  const key = {};
  const held = oOn() as WeakMap<object, unknown>;
  try {
    held.set(key, 'held frame');
    assert.equal(oOn().get(key), 'held frame');
    assert.equal(oOn(), held);
  } finally {
    held.delete(key);
  }
});

test('MapCache distinguishes key kinds and honors cache replacement', () => {
  const object = {}, symbol = Symbol('key');
  const cache = new memoize.Cache([['1', 'string'], [1, 'number'], [1, 'updated']]);
  const entries: [unknown, unknown][] = [[object, 'object'], [symbol, 'symbol'], [NaN, 'nan'],
    [null, 'null'], [undefined, 'undefined key'], ['__proto__', 'proto'], ['absent value', undefined]];
  for (const [key, value] of entries) assert.equal(cache.set(key, value), cache);
  assert.equal(cache.size, 9);
  assert.equal(cache.get('1'), 'string');
  assert.equal(cache.get(1), 'updated');
  for (const [key, value] of entries) {
    assert.equal(cache.has(key), true);
    assert.equal(cache.get(key), value);
  }
  assert.equal(cache.has('unseen'), false);
  assert.equal(cache.delete(object), true);
  assert.equal(cache.delete(object), false);
  assert.equal(cache.size, 8);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.has('__proto__'), false);
  cache.set('after clear', 7);
  assert.equal(cache.get('after clear'), 7);

  const DefaultCache = memoize.Cache;
  try {
    memoize.Cache = Map as unknown as Memoize['Cache'];
    const memo = memoize((value: string) => value.toUpperCase());
    assert.equal(memo('a'), 'A');
    assert.equal(memo.cache instanceof Map, true);
    memo.cache = new DefaultCache([['a', 'replaced']]);
    assert.equal(memo('a'), 'replaced');
    assert.equal(memo('b'), 'B');
  } finally {
    memoize.Cache = DefaultCache;
  }
});

test('native detection rejects ordinary and masked constructors while fallback caches keep their contract', () => {
  const setups = [
    'Map = function FakeMap() { throw new Error("ordinary Map was used"); }; Object.create = function fakeCreate() { throw new Error("ordinary create was used"); };',
    'globalThis["__core-js_shared__"] = {keys: {IE_PROTO: "mask.memo"}}; Map = new Proxy(Map, {construct() { throw new Error("masked Map was used"); }}); Object.create = new Proxy(Object.create, {apply() { throw new Error("masked create was used"); }}); Map["Symbol(src)_1.memo"] = true; Object.create["Symbol(src)_1.memo"] = true;',
    '',
  ];
  for (const setup of setups) {
    const fresh = isolatedMemoize(setup);
    const first = {}, second = {};
    let calls = 0;
    const memo = fresh((key: unknown) => { calls++; return key === second ? 'second' : undefined; });
    assert.equal(memo(first), undefined);
    assert.equal(memo(first), undefined);
    assert.equal(memo(second), 'second');
    assert.equal(calls, 2);
    assert.equal(memo.cache.size, 2);
    assert.equal(memo.cache.delete(first), true);
    assert.equal(memo(second), 'second');
    memo.cache.set('__proto__', 'stored proto');
    assert.equal(memo('__proto__'), 'stored proto');
    memo.cache.set('empty', undefined);
    assert.equal(memo.cache.has('empty'), true);
    assert.equal(memo('empty'), undefined);
    assert.equal(calls, 2);
    memo.cache.clear();
    assert.equal(memo(second), 'second');
    assert.equal(calls, 3);
  }
});
