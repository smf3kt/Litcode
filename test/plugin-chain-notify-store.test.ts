// The bar's stored state (W45-28). The copied bodies are src/plugin-chain-notify-store-source.ts
// (`a8`/`Ope`/`Pye`/`TWt`/`SEt` and the lazy-memo accessor `p` they use) and the zod binding behind
// the schema is src/plugin-chain-notify-schema.ts. `TWt` is a `var` holding the accessor, not the
// schema: calling it builds the schema once. These tests pin the key the ledger is kept under, what
// the schema accepts and drops, and what the read falls back to.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { it } from '../src/plugin-chain-host.js';
import {
  BAR_STATE_PLUGIN,
  barStateKey,
  bindPluginState,
  currentPluginState,
  emptyLedger,
  parseStoredLedger,
  readStoredLedger,
  storedLedgerSchema,
} from '../src/plugin-chain-notify.js';
import type { BarLedger, LedgerToast } from '../src/plugin-chain-notify.js';

const KEY = 'plugin-toast-1:fixture-bar';
const toast: LedgerToast = {
  key: KEY, plugin: 'fixture-bar', text: 'hi', isManaged: false, leftMs: 4000, wasShown: false, lentMs: 0, untoldMs: 0,
};
const ledger: BarLedger = { toasts: [toast], at: 0, slot: { key: KEY, endsAt: 4000, shown: KEY } };

/** A plugin-state store holding the given entries, the shape `s_().values` is read through. */
function store(entries: Record<string, unknown>) {
  return {
    values: {
      getState: () => ({ get: (key: string) => (key in entries ? { value: entries[key], version: 1 } : undefined) }),
      setState: () => {},
    },
  };
}

test('the bar\'s state key and the schema behind it', () => {
  assert.equal(BAR_STATE_PLUGIN, 'engine');
  assert.equal(barStateKey(), 'engine\u0000bar-toasts');
  // `TWt` is the memoized accessor: calling it is what builds the schema, and it builds the same one.
  assert.equal(storedLedgerSchema(), storedLedgerSchema());
});

test('the schema keeps a ledger\'s fields, drops what it does not declare, and refuses a wrong shape', () => {
  assert.deepEqual(parseStoredLedger(ledger), ledger);
  // `slot` is optional: a ledger without one parses, and one without the key at all.
  assert.deepEqual(parseStoredLedger({ toasts: [], at: 5 }), { toasts: [], at: 5 });
  // An undeclared member is dropped, not carried through.
  assert.deepEqual(parseStoredLedger({ toasts: [], at: 5, extra: true }), { toasts: [], at: 5 });
  // A toast missing a field, a number where a string belongs, and a non-ledger are all refusals.
  assert.equal(parseStoredLedger({ toasts: [{ key: KEY }], at: 0 }), undefined);
  assert.equal(parseStoredLedger({ toasts: [{ ...toast, key: 1 }], at: 0 }), undefined);
  assert.equal(parseStoredLedger({ toasts: [{ ...toast, leftMs: 'soon' }], at: 0 }), undefined);
  assert.equal(parseStoredLedger({ toasts: 'nope' }), undefined);
  assert.equal(parseStoredLedger(undefined), undefined);
  assert.equal(parseStoredLedger(null), undefined);
});

test('the ledger the append path writes parses: the round-trip the store depends on', () => {
  // `lLs` (chunk-sfn1dbxq.js [1694273,1694442)) appends
  // `{key, plugin, text, isManaged: sOn(plugin), leftMs: ms, wasShown: !1, lentMs: 0, untoldMs: 0}`,
  // and `SEt` parses what the store holds with this schema. If the schema refused any of those
  // fields — the two booleans above all — every read would fall back to the empty ledger and the
  // store would hold nothing at all.
  const appended = { ...emptyLedger(), toasts: [{ ...toast, isManaged: true, wasShown: true }] };
  assert.deepEqual(parseStoredLedger(appended), appended);
});

test('the read parses the store\'s value and falls back to the empty ledger', () => {
  const off = bindPluginState(store({ [barStateKey()]: ledger }));
  try {
    assert.equal(currentPluginState() !== null, true);
    assert.deepEqual(readStoredLedger(), ledger);
  } finally {
    off();
  }

  // Nothing parseable under the key: the empty frozen ledger, the same value every read.
  const offBad = bindPluginState(store({ [barStateKey()]: { toasts: 'nope' } }));
  try {
    assert.equal(readStoredLedger(), emptyLedger());
  } finally {
    offBad();
  }

  // The key absent altogether: an empty ledger too.
  const offAbsent = bindPluginState(store({}));
  try {
    assert.deepEqual(readStoredLedger(), { toasts: [], at: 0, slot: undefined });
  } finally {
    offAbsent();
  }

  // Unbinding restores what was bound before: the source's own store, which `s()` always installs as
  // `pluginState` (W45-35). A read with nothing else bound is the empty ledger, never a dereference
  // of null — the registry is never without a store.
  assert.equal(currentPluginState(), it().pluginState);
  assert.notEqual(it().pluginState, null);
  assert.deepEqual(readStoredLedger(), { toasts: [], at: 0, slot: undefined });
});
