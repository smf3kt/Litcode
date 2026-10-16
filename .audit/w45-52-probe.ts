// W45-52 probe: measure the store entry and dispatcher before anything is asserted about them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  bindStoreStorageId, checkStoreKey, checkStoreSet, checkStoreValue, raiseStoreCall,
  setStoreBackend, storeBackend, storeCallTable, storeEntry, STORE_CHAR_LIMIT, STORE_KEY_MAX_CHARS,
} from '../src/plugin-chain-store.js';
import { bindPluginDataDir, storeFilePath } from '../src/plugin-chain-store-path.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-52-probe-'));
bindPluginDataDir(() => root);
fs.mkdirSync(path.join(root, 'store'), { recursive: true });
const logs = () => chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}: ${r.message}`);
const caller = { plugin: 'tips', origin: [] };
const event = async (name: string, args: unknown) => {
  clearChainRecords();
  try {
    const value = await raiseStoreCall({ event: name as never, args, caller });
    console.log(`${name} ${JSON.stringify(args)} -> ok`, JSON.stringify(value));
  } catch (error: any) {
    console.log(`${name} ${JSON.stringify(args)} -> threw`, error?.name, JSON.stringify(error?.message));
  }
  const lines = logs();
  if (lines.length) console.log('   logs:', JSON.stringify(lines));
};

console.log('limits:', STORE_KEY_MAX_CHARS, STORE_CHAR_LIMIT);
console.log('checks: key({}) =', JSON.stringify(checkStoreKey({})), '| key({key:"a"}) =', JSON.stringify(checkStoreKey({ key: 'a' })));
console.log('checks: set({key:"a"}) =', JSON.stringify(checkStoreSet({ key: 'a' })), '| set({key:"a",value:{}}) =', JSON.stringify(checkStoreSet({ key: 'a', value: {} })));
console.log('checks: value("x") =', JSON.stringify(checkStoreValue('x')), '| value(undefined) =', JSON.stringify(checkStoreValue(undefined)), '| value(1) =', JSON.stringify(checkStoreValue(1)));
console.log('table names:', JSON.stringify(Object.keys(storeCallTable())), '| checks:', JSON.stringify(Object.entries(storeCallTable()).map(([k, v]) => [k, typeof v.check])));

await event('store.keys', {});
await event('store.get', { key: 'a' });
await event('store.set', { key: 'a', value: 'first' });
await event('store.get', { key: 'a' });
await event('store.keys', {});
await event('store.delete', { key: 'a' });
await event('store.get', { key: 'a' });

const file = storeFilePath('tips');
console.log('file:', file, '| mode:', (fs.statSync(file).mode & 0o777).toString(8), '| text:', JSON.stringify(fs.readFileSync(file, 'utf8')));
console.log('store dir:', JSON.stringify(fs.readdirSync(path.join(root, 'store'))));

await event('store.get', {});
await event('store.keys', { key: 'ignored' });
await event('store.get', { key: 'x'.repeat(257) });
await event('store.set', { key: 'a', value: 'y'.repeat(5000) });
await event('store.set', { key: 'a', value: { deep: true } });
await event('store.get', { key: 'a' });
await event('store.get', { key: 'toString' });

// The store's own limit: a value whose JSON is under the value limit but pushes the store over it.
const big = 'z'.repeat(STORE_CHAR_LIMIT - 10);
await event('store.set', { key: 'big', value: big });
await event('store.set', { key: 'big2', value: big });

// Concurrency: two sets racing on the same id.
clearChainRecords();
await Promise.all([
  raiseStoreCall({ event: 'store.set', args: { key: 'r1', value: 'one' }, caller }),
  raiseStoreCall({ event: 'store.set', args: { key: 'r2', value: 'two' }, caller }),
]);
await event('store.keys', {});

// The bound storage id, and the backend override.
bindStoreStorageId('tips', 'cc-plugin-tips@builtin');
await event('store.set', { key: 'bound', value: 'yes' });
console.log('bound file exists:', fs.existsSync(storeFilePath('cc-plugin-tips@builtin')));
bindStoreStorageId('tips', undefined);
const fake = { read: async () => ({ fake: '1' }), write: async () => {}, lock: async () => undefined };
setStoreBackend(fake as never);
console.log('backend after binding:', storeBackend() === (fake as never));
await event('store.get', { key: 'fake' });
setStoreBackend(undefined);
console.log('backend after unbinding:', storeBackend() === storeEntry);

// The store entry's own shapes.
console.log('entry keys:', JSON.stringify(Object.keys(storeEntry)));
const lock = await storeEntry.lock('tips');
console.log('lock handle type:', typeof lock, '| asyncDispose is itself:', (lock as never as { [k: symbol]: unknown })[Symbol.asyncDispose] === lock);
console.log('lock file beside the store:', JSON.stringify(fs.readdirSync(path.join(root, 'store')).filter((n) => n.endsWith('.lock'))));
await lock();
console.log('lock released; lock files:', JSON.stringify(fs.readdirSync(path.join(root, 'store')).filter((n) => n.endsWith('.lock'))));

fs.writeFileSync(storeFilePath('tips'), '{oops', 'utf8');
await event('store.get', { key: 'a' });
fs.writeFileSync(storeFilePath('tips'), '[1,2]', 'utf8');
await event('store.get', { key: 'a' });
fs.rmSync(storeFilePath('tips'));

console.log('assert import used:', typeof assert);
fs.rmSync(root, { recursive: true, force: true });
