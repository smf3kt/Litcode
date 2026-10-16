// The `$` store's entry and dispatcher (W45-52). The ported bodies are
// src/plugin-chain-store-entry-source.ts and the four table entries sit verbatim in
// src/plugin-chain-store.ts (chunk-sfn1dbxq.js [2353939,2354294)). These tests call the seam the way
// the plugin-method dispatcher does (`raiseStoreCall({event, args, caller})`) and assert what the
// source really does: the store file's shape and mode, the four events, the own-key read, the two
// limits, the per-id queue, the bound storage id, the backend slot, the store's lock, and the
// refusals the entries carry — which only a chain with a handler can reach.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { chainRecords, clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { bindPluginDataDir, storeFilePath } from '../src/plugin-chain-store-path.js';
import {
  bindStoreStorageId, checkStoreKey, checkStoreSet, checkStoreValue, raiseStoreCall, setStoreBackend,
  storeBackend, storeCallTable, storeEntry, STORE_CHAR_LIMIT, STORE_KEY_MAX_CHARS,
} from '../src/plugin-chain-store.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-store-entry-'));
bindPluginDataDir(() => root);
fs.mkdirSync(path.join(root, 'store'), { recursive: true });

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'tips') => ({ plugin, origin: ORIGIN });
const call = (event: string, args: unknown, plugin = 'tips') =>
  raiseStoreCall({ event: event as never, args, caller: caller(plugin) });
const logs = (): string[] => chainRecords().filter((r) => r.kind === 'log').map((r) => r.message);
const storeDir = (): string[] => fs.readdirSync(path.join(root, 'store')).sort();

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

/** A handler whose `next` hands the call to the floor, which is where the entry's `check` runs. */
function passthrough(name: string, event: string): ChainModule {
  return moduleWith(event, {
    name,
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  } as ChainHandler);
}

after(() => fs.rmSync(root, { recursive: true, force: true }));

test('the table carries the four store names, with the checks the source gives them', () => {
  const table = storeCallTable();
  assert.deepEqual(Object.keys(table), ['store.get', 'store.set', 'store.delete', 'store.keys']);
  assert.equal(typeof table['store.get'].check, 'function');
  assert.equal(typeof table['store.set'].check, 'function');
  assert.equal(typeof table['store.delete'].check, 'function');
  assert.equal(table['store.keys'].check, undefined, 'keys carries no check');

  assert.equal(checkStoreKey({}), 'takes a key');
  assert.equal(checkStoreKey({ key: 'a' }), undefined);
  assert.equal(checkStoreSet({ key: 'a' }), 'value is not JSON data: undefined');
  assert.equal(checkStoreSet({ key: 'a', value: {} }), undefined);
  assert.equal(checkStoreSet({ key: 'a', value: 1 }), undefined, 'a number has JSON text');
  assert.equal(checkStoreValue('x'), undefined);
  assert.equal(checkStoreValue(undefined), 'value is not JSON data: undefined');
  assert.equal(STORE_KEY_MAX_CHARS, 256);
  assert.equal(STORE_CHAR_LIMIT, 4194304);
});

test('set, get, keys and delete round-trip through the store file', async () => {
  clearChainRecords();
  assert.deepEqual(await call('store.keys', {}), [], 'a store that is not there is empty');
  assert.equal(await call('store.get', { key: 'a' }), undefined);

  assert.equal(await call('store.set', { key: 'a', value: 'first' }), undefined);
  assert.deepEqual(logs(), ['$.store.set (tips): a']);
  assert.equal(await call('store.get', { key: 'a' }), 'first');
  assert.deepEqual(await call('store.keys', {}), ['a']);

  assert.equal(await call('store.delete', { key: 'a' }), undefined);
  assert.equal(await call('store.get', { key: 'a' }), undefined);
  assert.deepEqual(await call('store.keys', {}), []);

  const file = storeFilePath('tips');
  assert.equal(fs.readFileSync(file, 'utf8'), '{}\n', 'the store is two-space JSON with a trailing newline');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(storeDir(), ['tips.json'], 'the write leaves the store file and nothing else');
});

test('a stored value keeps its JSON shape, and only the store\'s own keys are keys', async () => {
  assert.equal(await call('store.set', { key: 'obj', value: { deep: true } }), undefined);
  assert.deepEqual(await call('store.get', { key: 'obj' }), { deep: true });
  assert.equal(await call('store.get', { key: 'toString' }), undefined, 'an inherited name is not a key');
  assert.equal(await call('store.delete', { key: 'toString' }), undefined, 'and deleting it writes nothing');
  await call('store.delete', { key: 'obj' });
});

test('a key over the limit is refused for every event but keys', async () => {
  const long = 'x'.repeat(STORE_KEY_MAX_CHARS + 1);
  await assert.rejects(
    () => call('store.get', { key: long }),
    /HooksError: tips: \$\.store\.get: the key is 257 characters, over the 256 limit/,
  );
  await assert.rejects(
    () => call('store.delete', { key: long }),
    /HooksError: tips: \$\.store\.delete: the key is 257 characters, over the 256 limit/,
  );
  await assert.rejects(
    () => call('store.set', { key: long, value: 'v' }),
    /HooksError: tips: \$\.store\.set: the key is 257 characters, over the 256 limit/,
  );
  clearChainRecords();
  assert.deepEqual(await call('store.keys', { key: long }), [], 'keys takes no key');
  assert.deepEqual(logs(), []);
});

test('a write that would push the store over its own limit is refused, and nothing is written', async () => {
  const file = storeFilePath('plugin-authoring');
  await assert.rejects(
    () => call('store.set', { key: 'a', value: 'z'.repeat(STORE_CHAR_LIMIT) }, 'plugin-authoring'),
    /HooksError: plugin-authoring: \$\.store\.set: the store would be 4194312 characters, over the 4194304 limit/,
  );
  assert.equal(fs.existsSync(file), false, 'a refused write leaves no store file');

  // A value the store can hold is written, and the file shows the shape it was published in.
  assert.equal(await call('store.set', { key: 'b', value: 'short' }, 'plugin-authoring'), undefined);
  assert.equal(fs.readFileSync(file, 'utf8'), '{\n  "b": "short"\n}\n');
});

test('two writes to one store do not interleave', async () => {
  await Promise.all([
    call('store.set', { key: 'r1', value: 'one' }, 'mermaid'),
    call('store.set', { key: 'r2', value: 'two' }, 'mermaid'),
  ]);
  assert.deepEqual((await call('store.keys', {}, 'mermaid') as string[]).sort(), ['r1', 'r2'], 'both writes landed');
});

test('the entries run against the storage id the context holds, and the plugin name otherwise', async () => {
  assert.equal(await call('store.set', { key: 'k', value: 'by-name' }, 'claude-test'), undefined);
  assert.equal(fs.existsSync(storeFilePath('claude-test')), true);

  bindStoreStorageId('claude-test', 'cc-plugin-claude-test@builtin');
  try {
    assert.equal(await call('store.set', { key: 'k', value: 'by-id' }, 'claude-test'), undefined);
    assert.equal(fs.existsSync(storeFilePath('cc-plugin-claude-test@builtin')), true, 'the bound id is the store');
    assert.deepEqual(await call('store.keys', {}, 'claude-test'), ['k']);
  } finally {
    bindStoreStorageId('claude-test', undefined);
  }
  assert.equal(await call('store.set', { key: 'k2', value: 'again' }, 'claude-test'), undefined);
  assert.deepEqual(await call('store.keys', {}, 'claude-test'), ['k', 'k2'], 'unbinding puts the plugin back on its name');
});

test('the backend slot replaces the store for the whole product and restores it', async () => {
  const seen: string[] = [];
  const fake = {
    read: async (id: string) => { seen.push(id); return { from: 'slot' }; },
    write: async () => {},
    lock: async () => undefined,
  };
  setStoreBackend(fake as never);
  try {
    assert.equal(storeBackend(), fake as never);
    assert.equal(await call('store.get', { key: 'from' }, 'diff'), 'slot');
    assert.deepEqual(seen, ['diff'], 'the fake was read with the plugin\'s own id');
  } finally {
    setStoreBackend(undefined);
  }
  assert.equal(storeBackend(), storeEntry, 'the store entry is back');
});

test('the store entry reads, writes and locks the way the dispatcher needs', async () => {
  assert.deepEqual(Object.keys(storeEntry), ['read', 'write', 'lock']);
  await storeEntry.write('telemetry', { a: 1 });
  assert.deepEqual(await storeEntry.read('telemetry'), { a: 1 });

  const handle = await storeEntry.lock('telemetry');
  assert.equal(typeof handle, 'function');
  assert.equal(handle[Symbol.asyncDispose], handle, 'the handle is its own disposable');
  assert.deepEqual(storeDir().filter((name) => name.endsWith('.lock')), ['telemetry.json.lock']);
  await handle();
  assert.deepEqual(storeDir().filter((name) => name.endsWith('.lock')), [], 'releasing removes the lock');
});

test('a store file that cannot be read or parsed is the store\'s own error', async () => {
  const file = storeFilePath('sec-default');
  fs.writeFileSync(file, '{oops', 'utf8');
  await assert.rejects(() => call('store.get', { key: 'a' }, 'sec-default'), /is malformed \(Expected property name/);
  fs.writeFileSync(file, '[1,2]', 'utf8');
  await assert.rejects(
    () => call('store.get', { key: 'a' }, 'sec-default'),
    /is malformed \(the JSON is not an object\)/,
  );
  fs.rmSync(file);
});

test('the entry refusals reach the caller through a chain that has a handler', async () => {
  const removers = ['store.get', 'store.set', 'store.delete']
    .map((event) => installChainModule(passthrough(`fixture-store-${event}`, event)));
  try {
    await assert.rejects(() => call('store.get', {}), /HooksError: store\.get: takes a key \(host check\)/);
    await assert.rejects(() => call('store.get', { key: 1 }), /HooksError: store\.get: takes a key \(host check\)/);
    await assert.rejects(() => call('store.set', { key: 'a' }), /HooksError: store\.set: value is not JSON data: undefined \(host check\)/);
    await assert.rejects(() => call('store.delete', {}), /HooksError: store\.delete: takes a key \(host check\)/);
  } finally {
    for (const remove of removers) remove();
  }
  assert.equal(await call('store.set', { key: 'after', value: 'ok' }, 'sec-default'), undefined, 'the chain is gone again');
});
