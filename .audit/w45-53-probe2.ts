// W45-53 probe 2: the answer shapes `raiseSettingsRead` produces with and without a handler.
import '../src/plugin-chain-registry.js';
import { installChainModule } from '../src/plugin-chain-host.js';
import { bindSettingsStore, raiseSettingsRead } from '../src/plugin-chain-settings.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const caller = { plugin: 'tips', origin: Object.freeze([Object.freeze({ kind: 'plugin' })]) };
bindSettingsStore({ all: () => ({ merged: true }), one: () => ({}) });

console.log('no handler:', JSON.stringify(await raiseSettingsRead({ args: {}, caller })));

const moduleWith = (event: string, handler: ChainHandler): ChainModule => ({
  name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler,
});
const remove = installChainModule(moduleWith('settings.read', {
  name: 'fixture-settings-read',
  tier: 'user',
  run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => ({ value: await next(args) }),
} as ChainHandler));
try {
  console.log('with a passthrough handler:', JSON.stringify(await raiseSettingsRead({ args: {}, caller })));
} finally {
  remove();
  bindSettingsStore(undefined);
}
