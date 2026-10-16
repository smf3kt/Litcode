// W45-52 probe 2: the check refusals through a chain with a handler, and the store-limit count.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import '../src/plugin-chain-registry.js';
import { installChainModule } from '../src/plugin-chain-host.js';
import { raiseStoreCall, STORE_CHAR_LIMIT } from '../src/plugin-chain-store.js';
import { bindPluginDataDir } from '../src/plugin-chain-store-path.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'w45-52-probe2-'));
bindPluginDataDir(() => root);
fs.mkdirSync(path.join(root, 'store'), { recursive: true });
const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = { plugin: 'tips', origin: ORIGIN };
const moduleWith = (event: string, handler: ChainHandler): ChainModule => ({
  name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler,
});
const passthrough = (name: string, event: string): ChainModule => moduleWith(event, {
  name, tier: 'user', run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => ({ value: await next(args) }),
} as ChainHandler);

const removers = ['store.get', 'store.set', 'store.delete'].map((e) => installChainModule(passthrough('fixture-store-' + e, e)));
try {
  for (const [event, args] of [['store.get', {}], ['store.get', { key: 1 }], ['store.set', { key: 'a' }], ['store.delete', {}]] as const) {
    try { console.log(event, JSON.stringify(args), '->', JSON.stringify(await raiseStoreCall({ event, args, caller }))); }
    catch (error: any) { console.log(event, JSON.stringify(args), '-> threw', error?.name, JSON.stringify(error?.message)); }
  }
} finally {
  for (const remove of removers) remove();
}

const size = STORE_CHAR_LIMIT;
try {
  await raiseStoreCall({ event: 'store.set', args: { key: 'a', value: 'z'.repeat(size) }, caller });
  console.log('a full-size value was accepted');
} catch (error: any) {
  console.log('full-size value ->', JSON.stringify(error?.message));
}
console.log('json text length would be:', JSON.stringify({ a: 'z'.repeat(size) }).length);

fs.rmSync(root, { recursive: true, force: true });
