import '../src/plugin-chain-registry.js';
import {
  BAR_STATE_PLUGIN, barStateKey, parseStoredLedger, readStoredLedger, bindPluginState, storedLedgerSchema, emptyLedger,
} from '../src/plugin-chain-notify.js';

/** A plugin-state store holding one value under a key, the shape `s_().values` is read through. */
function store(entries: Record<string, unknown>) {
  return {
    values: {
      getState: () => ({
        get: (key: string) => (key in entries ? { value: entries[key], version: 1 } : undefined),
        setState: () => {},
      }),
    },
  };
}

console.log('plugin', JSON.stringify(BAR_STATE_PLUGIN), 'key', JSON.stringify(barStateKey()));
const ledger = {
  toasts: [{ key: 'plugin-toast-1:fixture-bar', plugin: 'fixture-bar', text: 'hi', isManaged: false, leftMs: 4000, wasShown: false, lentMs: 0, untoldMs: 0 }],
  at: 0,
  slot: { key: 'plugin-toast-1:fixture-bar', endsAt: 4000, shown: 'plugin-toast-1:fixture-bar' },
};
console.log('parse valid    ', JSON.stringify(parseStoredLedger(ledger)));
console.log('parse missing  ', parseStoredLedger(undefined));
console.log('parse malformed', parseStoredLedger({ toasts: [{ key: 1 }], at: 'x' }));
console.log('parse no slot  ', JSON.stringify(parseStoredLedger({ toasts: [], at: 5 })));
console.log('parse extra key', JSON.stringify(parseStoredLedger({ toasts: [], at: 5, extra: true })));
const off = bindPluginState(store({ [barStateKey()]: ledger }) as never);
console.log('read held      ', JSON.stringify(readStoredLedger()));
off();
const off2 = bindPluginState(store({ [barStateKey()]: { toasts: 'nope' } }) as never);
console.log('read bad       ', JSON.stringify(readStoredLedger()), readStoredLedger() === emptyLedger());
off2();
const off3 = bindPluginState(store({}) as never);
console.log('read absent    ', JSON.stringify(readStoredLedger()));
off3();
console.log('read unbound   ', JSON.stringify(readStoredLedger()));
console.log('schema type    ', (storedLedgerSchema() as { _zod?: { def?: { type?: string } } })?._zod?.def?.type ?? Object.keys(storedLedgerSchema() as object).slice(0, 4));
