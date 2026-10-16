import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chainRecords, clearChainRecords, installChainModule, setChainModuleSeat } from '../src/plugin-chain-host.js';
import type { PluginStateStore } from '../src/plugin-chain-host.js';
import { bindPluginState, emptyLedger, readStoredLedger } from '../src/plugin-chain-notify.js';
import { bindRenderVersions } from '../src/plugin-chain-notify-fold.js';
import {
  MANAGED_SEATS, STATE_VALUE_MAX_CHARS, appendStoredToast, deepFreezeValue, isManagedPlugin,
  notifyStateReaders, pluginSeat, setStoredState, writeStoredLedger,
} from '../src/plugin-chain-notify-write.js';

/** A plugin-state store in the shape `o5t` reads: `values.getState().get`, `values.setState`, the floor
 *  and the reader table. Every write is counted, so a skipped write is visible. The reader and fold
 *  fields are the ones the fold scheduler touches when `vb` finds a reader for the key (W45-30). */
const NOW = 1_000_000;
function store() {
  let state = new Map<string, { value: unknown; version: number }>();
  let writes = 0;
  const value: PluginStateStore = {
    values: {
      getState: () => ({ get: (key: string) => state.get(key) }),
      setState: (update) => { writes += 1; state = update(new Map(state)); },
    },
    versionFloor: 0,
    readersOf: new Map(),
    readers: new Map(),
    folds: {
      steady: { stale: new Set<string>(), pending: undefined, lastAt: NOW - 1000 },
      live: { stale: new Set<string>(), pending: undefined, lastAt: NOW - 1000 },
    },
    staleListeners: new Set(),
    bumps: 0,
  };
  return { value, writes: () => writes, state: () => state, floor: (n: number) => { value.versionFloor = n; } };
}

/** A render-version store in the registry shape, so a fold that runs inside a test has one to bump. */
function versions() {
  const state = new Map<string, number>();
  return {
    store: {
      getState: () => state,
      setState: (update: (current: Map<string, number>) => Map<string, number>) => {
        for (const [key, version] of update(new Map(state))) state.set(key, version);
      },
    },
  };
}

const logs = () => chainRecords().filter((record) => record.kind === 'log').map((record) => record.message);

test('the append path stores the toast with its seat\'s managed flag', () => {
  const fixture = store();
  const unbind = bindPluginState(fixture.value);
  try {
    // A plugin installed with the default tier is not managed; a seat of "prepend" is.
    installChainModule({ name: 'fixture-plain', hooks: () => false } as never);
    setChainModuleSeat('fixture-managed', 'prepend');
    clearChainRecords();

    appendStoredToast({ key: 'plugin-toast-1:fixture-plain', plugin: 'fixture-plain', text: 'hello', ms: 4000 });
    assert.deepEqual(readStoredLedger(), {
      toasts: [{
        key: 'plugin-toast-1:fixture-plain', plugin: 'fixture-plain', text: 'hello',
        isManaged: false, leftMs: 4000, wasShown: false, lentMs: 0, untoldMs: 0,
      }],
      at: 0,
    });
    assert.deepEqual([...fixture.state().keys()], ['engine\u0000bar-toasts']);
    assert.equal(fixture.state().get('engine\u0000bar-toasts')!.version, 1);

    appendStoredToast({ key: 'plugin-toast-2:fixture-managed', plugin: 'fixture-managed', text: 'managed', ms: 4000 });
    assert.deepEqual(readStoredLedger().toasts.map((toast) => [toast.key, toast.isManaged, toast.leftMs]),
      [['plugin-toast-1:fixture-plain', false, 4000], ['plugin-toast-2:fixture-managed', true, 4000]]);
    assert.equal(fixture.state().get('engine\u0000bar-toasts')!.version, 2);
    assert.deepEqual(logs(), []);
  } finally {
    unbind();
  }
});

test('the seat check reads the module record, the seat table and the fallback', () => {
  installChainModule({ name: 'fixture-plain', hooks: () => false } as never);
  setChainModuleSeat('fixture-managed', 'prepend');
  assert.deepEqual(MANAGED_SEATS, ['prepend', 'append']);
  assert.equal(pluginSeat('fixture-plain'), 'user');
  assert.equal(pluginSeat('fixture-managed'), 'prepend');
  assert.equal(pluginSeat('fixture-absent'), 'user');
  assert.equal(isManagedPlugin('fixture-plain'), false);
  assert.equal(isManagedPlugin('fixture-managed'), true);
  assert.equal(isManagedPlugin('fixture-absent'), false);
});

test('a ledger is written only when it or the stored one has content', () => {
  const withStored = store();
  const unbindStored = bindPluginState(withStored.value);
  try {
    appendStoredToast({ key: 'plugin-toast-1:p', plugin: 'p', text: 'hi', ms: 1000 });
    const before = withStored.writes();
    clearChainRecords();
    writeStoredLedger(emptyLedger());
    assert.equal(withStored.writes() - before, 1, 'an empty ledger over a stored one is written');
    assert.deepEqual(readStoredLedger(), { toasts: [], at: 0 });
    assert.deepEqual(logs(), []);
  } finally {
    unbindStored();
  }

  const fresh = store();
  const unbindFresh = bindPluginState(fresh.value);
  try {
    writeStoredLedger(emptyLedger());
    assert.equal(fresh.writes(), 0, 'nothing to write and nothing stored: no write');
  } finally {
    unbindFresh();
  }
});

test('the store takes the next version from the stored value and the floor', () => {
  const fixture = store();
  const unbind = bindPluginState(fixture.value);
  try {
    assert.equal(STATE_VALUE_MAX_CHARS, 4194304);
    assert.equal(setStoredState('probe', { a: [{ b: 1 }] }), 1);
    fixture.floor(7);
    assert.equal(setStoredState('probe', 1), 8, 'the floor wins over the stored version');
    assert.equal(setStoredState('probe', 2), 9, 'then the stored version wins over the floor');

    assert.throws(() => setStoredState('big', 'x'.repeat(4194305)),
      /a value of state is JSON data of at most 4194304 characters/);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    assert.throws(() => setStoredState('circular', circular), /Converting circular structure to JSON/);
  } finally {
    unbind();
  }
});

test('the stored value is frozen all the way down', () => {
  const fixture = store();
  const unbind = bindPluginState(fixture.value);
  try {
    setStoredState('frozen', { a: [{ b: 1 }], c: 'text' });
    const stored = fixture.state().get('frozen')!.value as { a: { b: number }[]; c: string };
    assert.equal(Object.isFrozen(stored), true);
    assert.equal(Object.isFrozen(stored.a), true);
    assert.equal(Object.isFrozen(stored.a[0]), true);
    assert.equal(Object.isFrozen(stored.c), true, 'a primitive is not frozen by shape but the walk leaves it alone');

    const walked = deepFreezeValue({ a: [{ b: 1 }] }) as { a: { b: number }[] };
    assert.equal(Object.isFrozen(walked.a[0]), true, 'the walk reaches nested objects too');
  } finally {
    unbind();
  }
});

test('a failed write leaves the store alone and logs the line', () => {
  const fixture = store();
  const unbind = bindPluginState(fixture.value);
  try {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    clearChainRecords();
    const before = fixture.writes();
    writeStoredLedger({
      toasts: [{
        key: 'plugin-toast-1:p', plugin: 'p', text: circular as never,
        isManaged: false, leftMs: 1000, wasShown: false, lentMs: 0, untoldMs: 0,
      }],
      at: 0,
    });
    assert.equal(fixture.writes(), before, 'the store is untouched by a failed write');
    assert.equal(fixture.state().size, 0);
    const line = logs().find((message) => message.startsWith("$.ui.toast: the bar's toasts were not kept:"));
    assert.ok(line, `expected the not-kept line, saw ${JSON.stringify(logs())}`);
    assert.match(line, /Converting circular structure to JSON/);
  } finally {
    unbind();
  }
});

test('the reader notification is inert without a reader, and folds the readers the key has', () => {
  const fixture = store();
  const offVersions = bindRenderVersions(versions().store);
  const unbind = bindPluginState(fixture.value);
  try {
    notifyStateReaders('unwatched');
    assert.equal(fixture.writes(), 0, 'no reader for the key: nothing at all');
    assert.equal(fixture.value.folds!.steady.lastAt, NOW - 1000, 'no fold ran');

    // With a reader for the key, `vb` hands it to the fold scheduler (W45-30), which marks it stale in
    // its pace's fold and, the fold being past its interval, runs it.
    fixture.value.readersOf!.set('watched', new Set(['reader-1']));
    fixture.value.readers!.set('reader-1', { plugins: [], instance: { surface: 'remote', component: 'Status' } });
    notifyStateReaders('watched');
    // `vb` calls the scheduler with its own default clock, so the fold's `lastAt` is real time — far
    // above this fixture's `NOW`.
    assert.ok(fixture.value.folds!.steady.lastAt > NOW, 'the steady fold ran');
    assert.deepEqual([...fixture.value.folds!.steady.stale], [], 'and cleared its stale set');
    assert.equal(fixture.value.bumps, 1);
  } finally {
    unbind();
    offVersions();
  }
});
