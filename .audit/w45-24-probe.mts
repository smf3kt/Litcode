// W45-24 probe: drive the ported ui.status/ui.log floors and print what each path produces, so the
// regression asserts measured text rather than assumed text.
import '../src/plugin-chain-registry.js';
import { chainRecords, clearChainRecords, installChainModule } from '../src/plugin-chain-host.js';
import { bindPluginSession, onPluginUiLog, raiseUiCall } from '../src/plugin-chain-ui.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-ui') => ({ plugin, origin: ORIGIN });
const logs = () => chainRecords().filter((r) => r.kind === 'log').map((r) => `${r.level}| ${r.message}`);

const writes: unknown[][] = [];
const session = { status: (plugin: string, text: string | undefined) => { writes.push([plugin, text]); } };

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

async function main() {
  clearChainRecords();

  // 1. No session bound.
  await raiseUiCall({ event: 'ui.status', args: { text: 'hello' }, caller: caller() });
  console.log('1 drop line   ', JSON.stringify(logs()));
  console.log('1 writes      ', JSON.stringify(writes));

  // 2/3. Bound session, text and cleared.
  const unbind = bindPluginSession(session);
  clearChainRecords();
  await raiseUiCall({ event: 'ui.status', args: { text: 'hello' }, caller: caller() });
  console.log('2 writes      ', JSON.stringify(writes), JSON.stringify(logs()));
  await raiseUiCall({ event: 'ui.status', args: {}, caller: caller() });
  console.log('3 writes      ', JSON.stringify(writes), JSON.stringify(logs()));

  // 4. ui.log transcript route, with a subscriber bound.
  clearChainRecords();
  const seen: unknown[] = [];
  const off = onPluginUiLog((record, state) => { seen.push([record, state]); });
  await raiseUiCall({ event: 'ui.log', args: { text: 'hi' }, caller: caller() });
  console.log('4 logs        ', JSON.stringify(logs()));
  console.log('4 sink        ', JSON.stringify(seen));

  // 5. ui.log debug route.
  clearChainRecords();
  await raiseUiCall({ event: 'ui.log', args: { text: 'dbg', to: 'debug' }, caller: caller() });
  console.log('5 logs        ', JSON.stringify(logs()));
  console.log('5 sink        ', JSON.stringify(seen));

  // 6. The length notice: over the terminal limit on the transcript route, once per plugin, and only
  //    while the notice gate (`aCe`, which needs an installed module in a non-TTY run) is open.
  const gate = installChainModule(moduleWith('ui.log', {
    name: 'fixture-notice',
    tier: 'user',
    run: async (args: unknown, next: (a: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  }));
  try {
    clearChainRecords();
    await raiseUiCall({ event: 'ui.log', args: { text: 'x'.repeat(2001) }, caller: caller() });
    console.log('6 notice      ', JSON.stringify(logs().filter((l) => l.includes('drawn up to'))));
    clearChainRecords();
    await raiseUiCall({ event: 'ui.log', args: { text: 'y'.repeat(2001) }, caller: caller() });
    console.log('6 second      ', JSON.stringify(logs().filter((l) => l.includes('drawn up to'))));
    clearChainRecords();
    await raiseUiCall({ event: 'ui.log', args: { text: 'x'.repeat(2001), to: 'debug' }, caller: caller() });
    console.log('6 debug long  ', JSON.stringify(logs().filter((l) => l.includes('drawn up to'))));
  } finally {
    gate();
  }
  off();

  // 7. Held lines flush to a late subscriber with the `again` state.
  clearChainRecords();
  await raiseUiCall({ event: 'ui.log', args: { text: 'held' }, caller: caller('fixture-held') });
  const flushed: unknown[] = [];
  const off2 = onPluginUiLog((record, state) => { flushed.push([record, state]); });
  console.log('7 flushed     ', JSON.stringify(flushed));
  off2();

  // 8. Checks, reached through a handler that opens the floor.
  const remove = installChainModule(moduleWith('ui.log', {
    name: 'fixture-open',
    tier: 'user',
    run: async (args: unknown, next: (a: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  }));
  try {
    for (const args of [{ text: 1 }, { text: 'ok', to: 'bogus' }]) {
      await raiseUiCall({ event: 'ui.log', args, caller: caller() }).then(
        (v) => console.log('8 accepted    ', JSON.stringify(args), JSON.stringify(v)),
        (e: Error) => console.log('8 refused     ', JSON.stringify(args), e.message),
      );
    }
  } finally {
    remove();
  }
  const removeStatus = installChainModule(moduleWith('ui.status', {
    name: 'fixture-open-status',
    tier: 'user',
    run: async (args: unknown, next: (a: unknown) => Promise<unknown>) => ({ value: await next(args) }),
  }));
  try {
    await raiseUiCall({ event: 'ui.status', args: { text: 1 }, caller: caller() }).then(
      (v) => console.log('8 status ok   ', JSON.stringify(v)),
      (e: Error) => console.log('8 status no   ', e.message),
    );
  } finally {
    removeStatus();
  }
  unbind();
}

await main();
