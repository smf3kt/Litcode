// The bar's mount layer (W45-38): the effect `JFe` mounts over the clock tick, its dependency array,
// and the pane hold `XFe` keeps. The copied body is src/plugin-chain-bar-mount-source.ts (`YAt` and
// `gro`, 2 blocks, 101 units, chunk-tvdq3hrk.js — ranges and per-block digests in
// research/ports/W45-bar-mount-blocks.plan.json); the seam is src/plugin-chain-bar-mount.ts, over the
// tick ported in W45-31.
//
// The expectations are the source's own behaviour, read off the two hook bodies and measured in
// .audit/w45-38-probe.mts before any assertion was written: the two selectors join the keys of the
// notification list and of the stored ledger, the effect ticks on mount and hands back the canceller,
// and the pane hold raises `paneHoldsToasts` on the way in and clears it and drains the queue on the
// way out.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindPluginState, barStateKey, emptyLedger, readStoredLedger } from '../src/plugin-chain-notify.js';
import type { BarLedger } from '../src/plugin-chain-notify.js';
import { appendStoredToast } from '../src/plugin-chain-notify-write.js';
import { isBarHidden } from '../src/plugin-chain-notify-clock.js';
import type { BarClock, BarState, BarStore } from '../src/plugin-chain-notify-clock.js';
import {
  barClockDriverChanged, barNotificationKeys, createBarClockDriver, holdPaneToasts, mountBarClockDriver,
  readPaneHold, storedToastKeys,
} from '../src/plugin-chain-bar-mount.js';
import { YAt, gro } from '../src/plugin-chain-bar-mount-source.js';

const NOW = 1_000_000;
const KEY = 'plugin-toast-1:fixture-p';
const TOAST = { key: KEY, plugin: 'fixture-p', text: 'hello', timeoutMs: 4000 };

const state = (over: Partial<BarState> = {}): BarState =>
  ({ notifications: { current: TOAST, queue: [] }, diffPanelVisible: false, paneHoldsToasts: false, ...over });

/** The bar's state store, keeping every updater it is handed so a test can run one itself. */
function makeStore(initial: BarState) {
  let current = initial;
  const updaters: Array<(state: BarState) => BarState> = [];
  const store: BarStore = {
    getState: () => current,
    setState: (update) => { updaters.push(update); current = update(current); },
  };
  return { store, updaters, state: () => current };
}

/** A clock whose `setTimeout` records the delay and returns the canceller, so a tick's arming and
 *  cancelling are both observable without real timers. */
function makeClock(start: number) {
  const armed: { ms: number; fire: () => void }[] = [];
  const cancelled: number[] = [];
  let now = start;
  const clock: BarClock = {
    now: () => now,
    setTimeout: (fn, ms) => { armed.push({ ms, fire: fn }); return () => { cancelled.push(ms); }; },
  };
  return { clock, armed, cancelled, advance: (ms: number) => { now += ms; } };
}

/** A plugin-state store, so the tick's stored read and write have a real store behind them. */
function makeStateStore() {
  const stored = new Map<string, { value: unknown; version: number }>();
  const off = bindPluginState({
    values: {
      getState: () => ({ get: (key: string) => stored.get(key) }),
      setState: (update) => { for (const [key, value] of update(new Map(stored))) stored.set(key, value); },
    },
    versionFloor: 0,
    readersOf: new Map(),
  });
  return { off, values: () => ({ get: (key: string) => stored.get(key) }) };
}

test('the two keys the effect watches are the joined keys of the notification list and the ledger', () => {
  assert.equal(barNotificationKeys(state()), KEY);
  assert.equal(barNotificationKeys(state({
    notifications: { current: { key: 'a' }, queue: [{ key: 'b' }, { key: 'c' }] },
  })), 'a b c');
  assert.equal(barNotificationKeys(state({ notifications: { current: null, queue: [{ key: 'a' }] } })), ' a',
    'an empty slot contributes the empty string `join` gives `undefined`');
  assert.equal(barNotificationKeys(state({ notifications: { current: null, queue: [] } })), '');

  const store = makeStateStore();
  try {
    assert.equal(storedToastKeys(store.values()), '', 'nothing stored yet');
    appendStoredToast({ key: KEY, plugin: 'fixture-p', text: 'hello', ms: 1500 });
    appendStoredToast({ key: 'plugin-toast-2:fixture-p', plugin: 'fixture-p', text: 'again', ms: 1500 });
    assert.equal(storedToastKeys(store.values()), `${KEY} plugin-toast-2:fixture-p`,
      'the stored ledger\'s toasts, in order');
  } finally {
    store.off();
  }
});

test('the effect runs on mount and again only when one of the five members changes', () => {
  const deps = { clock: {}, store: {}, notificationKeys: 'a', hidden: false, storedToastKeys: 'a' };
  assert.equal(barClockDriverChanged(null, deps), true, 'the mount always runs the effect');
  assert.equal(barClockDriverChanged(deps, { ...deps }), false, 'the same five values do not');
  assert.equal(barClockDriverChanged(deps, { ...deps, clock: {} }), true, 'a new clock handle');
  assert.equal(barClockDriverChanged(deps, { ...deps, store: {} }), true, 'a new store handle');
  assert.equal(barClockDriverChanged(deps, { ...deps, notificationKeys: 'b' }), true);
  assert.equal(barClockDriverChanged(deps, { ...deps, hidden: true }), true);
  assert.equal(barClockDriverChanged(deps, { ...deps, storedToastKeys: 'b' }), true);
  assert.equal(barClockDriverChanged(deps, { ...deps, hidden: undefined }), true,
    '`isBarHidden` answers undefined for a state that carries neither flag, and React compares with Object.is');
});

test('mounting the effect ticks once and hands back the canceller the tick armed', () => {
  const store = makeStateStore();
  try {
    appendStoredToast({ key: KEY, plugin: 'fixture-p', text: 'hello', ms: 1500 });
    const bar = makeStore(state());
    const clock = makeClock(NOW);
    const driver = createBarClockDriver();

    assert.deepEqual(driver.last.current, emptyLedger(), 'the ledger ref starts from the empty ledger');
    const cleanup = mountBarClockDriver(driver, clock.clock, bar.store);

    assert.deepEqual(readStoredLedger(), driver.last.current, 'the mounted tick laid the ledger out and wrote it');
    assert.deepEqual(driver.last.current.toasts.map((toast) => toast.leftMs), [1500]);
    assert.deepEqual(clock.armed.map((entry) => entry.ms), [1500], 'and armed the delay the ledger gives');

    cleanup();
    assert.deepEqual(clock.cancelled, [1500], 'the cleanup is `() => M.current?.()`: it cancels that timer');
  } finally {
    store.off();
  }
});

test('a dependency change re-runs the effect with the same driver, so the ledger carries across', () => {
  const store = makeStateStore();
  try {
    appendStoredToast({ key: KEY, plugin: 'fixture-p', text: 'hello', ms: 1500 });
    const bar = makeStore(state());
    const clock = makeClock(NOW);
    const driver = createBarClockDriver();

    const first = mountBarClockDriver(driver, clock.clock, bar.store);
    clock.advance(1000);
    clock.armed[0].fire();
    assert.equal(driver.last.current.at, NOW + 1000, 'the driver\'s ledger moved with the tick');
    assert.deepEqual(driver.last.current.toasts.map((toast) => toast.leftMs), [500]);

    first();
    const second = mountBarClockDriver(driver, clock.clock, bar.store);
    assert.equal(driver.last.current.at, NOW + 1000, 'the re-run ages the ledger it kept, it does not restart it');
    assert.deepEqual(driver.last.current.toasts.map((toast) => toast.leftMs), [500]);
    // The 1500 timer was cancelled by the tick that fired at it; the 500 canceller ran on the cleanup
    // and then again from the re-run's tick, because the source never clears `pending.current`.
    assert.deepEqual(clock.cancelled, [1500, 500, 500]);
    assert.deepEqual(clock.armed.map((entry) => entry.ms), [1500, 500, 500]);
    second();
  } finally {
    store.off();
  }
});

test('the pane read is the shown pane, and only while its placements hold toasts', () => {
  assert.equal(readPaneHold({ placements: 2, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }), true);
  assert.equal(readPaneHold({ placements: 0, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }), false,
    'no placements, no hold');
  assert.equal(readPaneHold({ placements: 1, open: [{ id: 'a' }, { id: 'b', holdToasts: true }], shownId: 'a' }),
    false, 'a pane that holds is not the one being shown');
  assert.equal(readPaneHold({ placements: 1, open: [{ id: 'a' }], shownId: 'b' }), false, 'no shown pane');
  assert.equal(readPaneHold({ placements: 1, open: [{ id: 'a', holdToasts: false }], shownId: 'a' }), false);
  assert.deepEqual(YAt({ open: [{ id: 'a' }], shownId: 'a' }), { id: 'a' }, 'the record itself, not a boolean');
  assert.equal(YAt({ open: [{ id: 'a' }], shownId: 'b' }), undefined, 'nothing open is the shown pane');
  assert.equal(gro({ placements: 1, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }), true,
    'the copied body answers the same as the seam');
});

test('the pane hold is raised while a pane holds, and its release clears it and drains the queue', () => {
  const bar = makeStore(state());
  let drained = 0;

  const inert = holdPaneToasts({ holds: false, store: bar.store, drain: () => { drained += 1; } });
  // The length, not a comparison against `[]`: `assert.deepEqual` is an assertion signature, so
  // comparing the array itself to an empty literal would narrow it to `never[]` for the rest of the test.
  assert.equal(bar.updaters.length, 0, 'no hold, no write');
  inert();
  assert.equal(drained, 0, 'and nothing to drain');

  const release = holdPaneToasts({ holds: true, store: bar.store, drain: () => { drained += 1; } });
  assert.deepEqual(bar.state().paneHoldsToasts, true);
  assert.equal(bar.updaters.length, 1);

  // A second raise while the flag is already up keeps the same object, as the source's updater does.
  const before = bar.state();
  assert.equal(bar.updaters[0](before), before);

  release();
  assert.equal(bar.state().paneHoldsToasts, false);
  assert.equal(drained, 1, 'the queue is drained once, after the flag is cleared');
  // And the release updater is a no-op where the flag is already down.
  const released = bar.state();
  assert.equal(bar.updaters[bar.updaters.length - 1](released), released);
});

test('the pane hold is one of the five members the clock effect watches', () => {
  const bar = makeStore(state());
  const deps = {
    clock: {}, store: bar.store, notificationKeys: KEY, hidden: isBarHidden(bar.state()), storedToastKeys: '',
  };
  assert.equal(deps.hidden, false);

  const release = holdPaneToasts({ holds: true, store: bar.store, drain: () => {} });
  const raised = { ...deps, hidden: isBarHidden(bar.state()) };
  assert.equal(raised.hidden, true, 'a held pane makes the bar count as hidden, which is `he` in the dep array');
  assert.equal(barClockDriverChanged(deps, raised), true);

  release();
  assert.equal(isBarHidden(bar.state()), false);
  assert.equal(barClockDriverChanged(raised, { ...deps, hidden: isBarHidden(bar.state()) }), true);
});

test('a mounted bar with nothing to show arms nothing and never throws on cleanup', () => {
  const store = makeStateStore();
  try {
    const bar = makeStore(state({ notifications: { current: null, queue: [] } }));
    const clock = makeClock(NOW);
    const driver = createBarClockDriver();

    const cleanup = mountBarClockDriver(driver, clock.clock, bar.store);
    assert.deepEqual(clock.armed, []);
    assert.equal(driver.pending.current, undefined);
    assert.deepEqual(driver.last.current, { toasts: [], at: NOW, slot: undefined });
    assert.deepEqual(bar.state().notifications.current, null);
    cleanup();
    assert.deepEqual(clock.cancelled, [], 'there was no timer to cancel');
  } finally {
    store.off();
  }
});

// The ledger ref is typed against the product's ledger, so this pins the shape `SEt` gives back.
test('the stored key list reads the same entry the ledger reader does', () => {
  const store = makeStateStore();
  const bar = makeStore(state());
  const clock = makeClock(NOW);
  try {
    appendStoredToast({ key: KEY, plugin: 'fixture-p', text: 'hello', ms: 1500 });
    mountBarClockDriver(createBarClockDriver(), clock.clock, bar.store);
    const ledger: BarLedger = readStoredLedger();
    assert.equal(storedToastKeys(store.values()), ledger.toasts.map((toast) => toast.key).join(' '));
    assert.equal(storedToastKeys(store.values()), KEY);
    assert.equal(store.values().get(barStateKey()) !== undefined, true, 'the entry is under the bar\'s own key');
  } finally {
    store.off();
  }
});
