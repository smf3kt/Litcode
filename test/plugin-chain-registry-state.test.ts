// The plugin-state registry (W45-35). The copied literal is
// src/plugin-chain-registry-source.ts (3 blocks, 2,709 units; ranges and per-block digests in
// research/ports/W45-registry-blocks.plan.json), its two helpers
// src/plugin-chain-registry-stores-source.ts (3 blocks, 621 units), and the typed seam
// src/plugin-chain-registry-state.ts. These tests pin what the source's own factory builds and what
// the two stores under it do, read through the fields the registry installs rather than through the
// helpers themselves.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FDn } from '../src/plugin-chain-notify-fold-source.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import { toastClockHandle } from '../src/plugin-chain-notify-stack.js';
import { it } from '../src/plugin-chain-host.js';
import {
  createPluginRegistryState, createPluginStateStore, createToastClock,
} from '../src/plugin-chain-registry-state.js';

/** The shape `Oe()` builds, as the registry carries it. */
interface ChangeSignal {
  subscribe: (listener: (...args: unknown[]) => void) => () => void;
  emit: (...args: unknown[]) => void;
  clear: () => void;
}

const signalOf = (state = createPluginRegistryState()): ChangeSignal =>
  (state as unknown as Record<string, ChangeSignal>).hooksLeftOutByNameChanged!;

test('the registry literal is the source\'s: 89 fields, three signals, four stores, a Set of respawns', () => {
  const state = createPluginRegistryState();
  assert.equal(Object.keys(state).length, 89, 'the literal carries every field the source writes');
  // Spot the fields whose names the ported code reaches for by source name.
  for (const name of ['pluginLoad', 'hookRegistration', 'marketplaces', 'hiddenRegistryEntries',
    'releasedRegistryEntries', 'armedMonitorKeys', 'uiLogSink']) {
    assert.ok(name in state, `${name} is a field of the literal`);
  }
  const has = (value: unknown, member: string): boolean =>
    value !== null && typeof value === 'object' && typeof (value as Record<string, unknown>)[member] === 'function';
  const stores = Object.entries(state).filter(([, value]) => has(value, 'setState'))
    .map(([key]) => key).sort();
  assert.deepEqual(stores, ['hoverGroups', 'notices', 'panes', 'renderVersions'],
    'the four fields the source builds with gs(...)');
  const signals = Object.entries(state).filter(([, value]) => has(value, 'emit')).map(([key]) => key).sort();
  assert.deepEqual(signals, ['commandProducerDirsChanged', 'focusSiteDraws', 'hooksLeftOutByNameChanged'],
    'the three fields the source builds with Oe()');
  assert.equal(state.panes!.getState(), FDn, 'panes starts from the frozen empty value');
  assert.equal(Object.isFrozen(state.panes!.getState()), true);
  assert.deepEqual(state.renderVersions!.getState(), new Map());
  assert.equal(state.hooksRespawns instanceof Set, true,
    'hooksRespawns is the source\'s Set, which is what the ported N5t gates the respawn hop on');
  assert.equal(state.uiLogSink, null);
  assert.deepEqual(state.pendingUiLog, []);
});

test('two registries share the frozen panes value and nothing else', () => {
  const one = createPluginRegistryState();
  const two = createPluginRegistryState();
  assert.notEqual(one, two);
  assert.notEqual(one.loadedModules, two.loadedModules);
  assert.notEqual(one.moduleSeats, two.moduleSeats);
  assert.notEqual(one.registeredAgents, two.registeredAgents);
  assert.notEqual(one.hooksRespawns, two.hooksRespawns);
  assert.notEqual(one.pluginState, two.pluginState);
  assert.notEqual(one.panes, two.panes);
  assert.equal(one.panes!.getState(), two.panes!.getState(),
    'the empty panes value is frozen, so both registries read the same object');
});

test('the plugin-state store starts empty, with the two fold queues and the counters', () => {
  const store = createPluginStateStore();
  assert.deepEqual(Object.keys(store).sort(),
    ['bumps', 'faultRuns', 'folds', 'mounted', 'readers', 'readersOf', 'staleListeners', 'values', 'versionFloor']);
  assert.deepEqual(store.values.getState(), new Map());
  assert.equal(store.values.getSnapshot, store.values.getState, 'the store reads its snapshot through one function');
  assert.deepEqual(store.readers, new Map());
  assert.deepEqual(store.readersOf, new Map());
  assert.equal(store.versionFloor, 0);
  assert.equal(store.bumps, 0);
  assert.deepEqual([...store.staleListeners!], []);
  assert.deepEqual(Object.keys(store.folds!), ['steady', 'live']);
  for (const pace of ['steady', 'live'] as const) {
    assert.deepEqual([...store.folds![pace].stale], []);
    assert.equal(store.folds![pace].lastAt, Number.NEGATIVE_INFINITY, 'no fold has run yet');
    assert.equal(store.folds![pace].pending, undefined);
  }
  assert.notEqual(store, createPluginStateStore(), 'each call builds its own');
});

test('the toast clock carries both fields, and the host seam hands back the source\'s own state', () => {
  const clock = createToastClock();
  assert.deepEqual(Object.keys(clock), ['pending', 'pausedAt'], 'both fields are written, not left off');
  assert.equal(clock.pending, undefined);
  assert.equal(clock.pausedAt, undefined);

  const registry = it();
  assert.equal(typeof registry.pluginState?.values.getState, 'function', 'the seam carries a real store');
  assert.deepEqual(registry.toastClock, clock, 'its clock is the factory\'s shape');
  assert.equal(registry.panes!.getState(), FDn);
  assert.deepEqual(registry.renderVersions!.getState(), new Map());
  // The ported `N5t` gates the respawn hop on `hooksRespawns.size`, which an array field would leave
  // undefined; the Set is live, so adding a respawn makes the gate true.
  assert.equal(registry.hooksRespawns instanceof Set, true);
  const respawn = Promise.resolve();
  registry.hooksRespawns.add(respawn);
  assert.equal(registry.hooksRespawns.size, 1);
  registry.hooksRespawns.delete(respawn);
  assert.equal(it(), registry, 'the same registry object comes back every call');
});

test('binding a store over the registry gives it the source\'s own back on release', () => {
  const registry = it();
  const original = registry.pluginState;
  assert.notEqual(original, null, 'the registry never starts without a store');
  const bound = createPluginStateStore();
  const off = bindPluginState(bound);
  try {
    assert.equal(it().pluginState, bound);
  } finally {
    off();
  }
  assert.equal(it().pluginState, original, 'the release puts the source\'s store back');
  assert.equal(toastClockHandle(), it().toastClock);
});

test('a store writes only on a real change, and the new value reaches its subscribers', () => {
  const state = createPluginRegistryState();
  const calls: string[] = [];
  state.panes!.setState((current) => current);
  const stop = state.panes!.subscribe!(() => calls.push('subscriber'));
  state.panes!.setState((current) => current);
  assert.deepEqual(calls, [], 'an update that returns the same value is a no-op');
  state.panes!.setState(() => ({ ...FDn, shownId: 'pane-a' }));
  assert.deepEqual(calls, ['subscriber'], 'the new value reaches the subscriber');
  assert.equal(state.panes!.getState().shownId, 'pane-a');
  stop();
  state.panes!.setState(() => ({ ...FDn, shownId: 'pane-b' }));
  assert.deepEqual(calls, ['subscriber'], 'an unsubscribed listener is not called again');
});

test('a change signal delivers to every listener, then throws what they threw', () => {
  const signal = signalOf();
  const heard: unknown[][] = [];
  signal.subscribe((...args) => heard.push(args));
  signal.emit('first');
  assert.deepEqual(heard, [['first']], 'a listener that returns is delivered and nothing is thrown');

  signal.subscribe(() => { throw new Error('second'); });
  signal.subscribe(() => { throw new RangeError('third'); });
  heard.length = 0;
  assert.throws(() => signal.emit('again'), (error: AggregateError) => {
    assert.equal(error.constructor, AggregateError);
    assert.equal(error.message, 'Signal listener(s) threw');
    assert.deepEqual(error.errors.map((each) => each.constructor), [Error, RangeError]);
    return true;
  });
  assert.deepEqual(heard, [['again']], 'the listeners that did not throw still heard the event');

  const lone = signalOf();
  lone.subscribe(() => { throw new TypeError('only'); });
  assert.throws(() => lone.emit(), { name: 'TypeError', message: 'only' },
    'a single throw is rethrown as itself, not wrapped');

  lone.clear();
  lone.emit();
  assert.deepEqual(heard, [['again']], 'a cleared signal has nothing left to deliver');
});
