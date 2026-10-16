// W45-29 measurements before any assertion: what the append path stores, what the write skips, what the
// store refuses, how the version and the freeze come out, and where the reader notification stops.
import { clearChainRecords, chainRecords, installChainModule, setChainModuleSeat } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import {
  appendStoredToast, isManagedPlugin, notifyStateReaders, pluginSeat, setStoredState, writeStoredLedger,
} from '../src/plugin-chain-notify-write.js';
import { emptyLedger, readStoredLedger } from '../src/plugin-chain-notify.js';

const makeStore = () => {
  let state = new Map<string, { value: unknown; version: number }>();
  let writes = 0;
  return {
    store: {
      values: {
        getState: () => ({ get: (key: string) => state.get(key) }),
        setState: (update: (m: Map<string, { value: unknown; version: number }>) => Map<string, { value: unknown; version: number }>) => { writes += 1; state = update(new Map(state)); },
      },
      versionFloor: 0,
      readersOf: new Map<string, Set<unknown>>(),
    },
    writes: () => writes,
    raw: () => state,
  };
};

const { store, writes, raw } = makeStore();
const unbind = bindPluginState(store as never);
clearChainRecords();

installChainModule({ name: 'fixture-plain', tier: 'user', hooks: () => false } as never);
setChainModuleSeat('fixture-managed', 'prepend');
console.log('seat plain:', JSON.stringify(pluginSeat('fixture-plain')));
console.log('seat managed:', JSON.stringify(pluginSeat('fixture-managed')));
console.log('seat absent:', JSON.stringify(pluginSeat('fixture-nothing')));
console.log('isManaged plain/managed/absent:', isManagedPlugin('fixture-plain'), isManagedPlugin('fixture-managed'), isManagedPlugin('fixture-nothing'));

appendStoredToast({ key: 'plugin-toast-1:fixture-plain', plugin: 'fixture-plain', text: 'hello', ms: 4000 });
console.log('logs after append:', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => r.message).slice(-4)));
console.log('after append writes:', writes(), 'ledger:', JSON.stringify(readStoredLedger()));
console.log('stored key/version:', JSON.stringify([...raw().entries()].map(([k, v]) => [k, v.version])));
console.log('value frozen:', Object.isFrozen(raw().values().next().value!.value));

appendStoredToast({ key: 'plugin-toast-2:fixture-managed', plugin: 'fixture-managed', text: 'managed', ms: 4000 });
console.log('after second append:', JSON.stringify(readStoredLedger().toasts.map((t) => [t.key, t.isManaged, t.leftMs, t.wasShown, t.lentMs, t.untoldMs])));

const before = writes();
writeStoredLedger(emptyLedger());
console.log('empty write with a non-empty store — writes:', writes() - before);
const store2 = makeStore();
const unbind2 = bindPluginState(store2.store as never);
writeStoredLedger(emptyLedger());
console.log('empty write with an empty store — writes:', store2.writes());

const version = setStoredState('probe', { a: [{ b: 1 }] });
console.log('setStoredState version:', version, 'frozen chain:', Object.isFrozen((store2.raw().get('probe')!.value as { a: unknown[] }).a), Object.isFrozen((store2.raw().get('probe')!.value as { a: { b: number }[] }).a[0]));
store2.store.versionFloor = 7;
console.log('version over the floor:', setStoredState('probe', 1), 'then:', setStoredState('probe', 2));

try { setStoredState('big', 'x'.repeat(4194305)); } catch (error) { console.log('over the ceiling:', (error as Error).name, (error as Error).message); }
const circular: Record<string, unknown> = {}; circular.self = circular;
try { setStoredState('circular', circular); } catch (error) { console.log('circular:', (error as Error).name, (error as Error).message.slice(0, 80)); }

clearChainRecords();
try { writeStoredLedger({ toasts: [{ key: 'k', plugin: 'p', text: circular as never, isManaged: false, leftMs: 1, wasShown: false, lentMs: 0, untoldMs: 0 }], at: 0 }); } catch (error) { console.log('writeStoredLedger threw:', (error as Error).message.slice(0, 60)); }
console.log('log lines:', JSON.stringify(chainRecords().filter((r) => r.kind === 'log').map((r) => r.message).slice(-3)));

const { store: store3, raw: raw3 } = makeStore();
const unbind3 = bindPluginState(store3 as never);
notifyStateReaders('quiet');
console.log('reader notification with no reader: returned');
store3.readersOf.set('watched', new Set([() => {}]));
try { notifyStateReaders('watched'); } catch (error) { console.log('with a reader:', (error as Error).message); }
console.log('probe store keys after reader test:', raw3().size);

unbind(); unbind2(); unbind3();
