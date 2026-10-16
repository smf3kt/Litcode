// The notification bar's clock driver (W45-31). The copied bodies are
// src/plugin-chain-notify-clock-source.ts (`TK` and the hidden test `Cj`; ranges and per-block digests
// in research/ports/W45-notify-clock-blocks.plan.json); the seam is src/plugin-chain-notify-clock.ts.
// These tests pin what one tick does in order: the split, the ledger it ticks and writes, the state it
// leaves, the timer it cancels and the next one it arms.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bindPluginState, emptyLedger, readStoredLedger } from '../src/plugin-chain-notify.js';
import type { BarLedger } from '../src/plugin-chain-notify.js';
import { appendStoredToast } from '../src/plugin-chain-notify-write.js';
import { TOAST_FALLBACK_TIMEOUT_MS, isBarHidden, runClockTick } from '../src/plugin-chain-notify-clock.js';
import type { BarClock, BarState, BarStore } from '../src/plugin-chain-notify-clock.js';

const NOW = 1_000_000;
const KEY = 'plugin-toast-1:fixture-p';
const TOAST = { key: KEY, plugin: 'fixture-p', text: 'hello', timeoutMs: 4000 };

const state = (over: Partial<BarState> = {}): BarState =>
  ({ notifications: { current: TOAST, queue: [] }, diffPanelVisible: false, paneHoldsToasts: false, ...over });

/** The bar's state store, counting whether a write changed anything. */
function makeStore(initial: BarState) {
  let current = initial;
  const writes: string[] = [];
  const store: BarStore = {
    getState: () => current,
    setState: (update) => {
      const next = update(current);
      writes.push(next === current ? 'same' : 'changed');
      current = next;
    },
  };
  return { store, writes, state: () => current };
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

/** A plugin-state store holding whatever the write half appended, so `SEt`/`xYr` inside the tick have
 *  a real store behind them. */
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
  return off;
}

test('the bar counts as hidden while a diff panel is visible or the pane holds toasts', () => {
  assert.equal(TOAST_FALLBACK_TIMEOUT_MS, 4000);
  assert.equal(isBarHidden(state()), false);
  assert.equal(isBarHidden(state({ diffPanelVisible: true })), true);
  assert.equal(isBarHidden(state({ paneHoldsToasts: true })), true);
  // `o.diffPanelVisible || o.paneHoldsToasts` with no coercion: two absent flags give undefined.
  assert.equal(isBarHidden({ notifications: { current: null, queue: [] } }), undefined);
});

test('a tick lays the stored ledger out, writes it back and arms the delay the ledger gives', () => {
  const off = makeStateStore();
  try {
    // The plugin appended a 1500ms toast (W45-29) while the bar is showing a 4000ms one: the toast runs
    // out before the slot does, which is the case `dLs` gives a delay for.
    appendStoredToast({ key: KEY, plugin: 'fixture-p', text: 'hello', ms: 1500 });
    const fixture = makeStore(state());
    const clock = makeClock(NOW);
    const pending: { current?: () => void } = {};
    const last: { current: BarLedger } = { current: emptyLedger() };

    runClockTick({ clock: clock.clock, store: fixture.store, pending, last });

    assert.deepEqual(last.current, {
      toasts: [{
        key: KEY, plugin: 'fixture-p', text: 'hello', isManaged: false,
        leftMs: 1500, wasShown: true, lentMs: 0, untoldMs: 0,
      }],
      at: NOW,
      slot: { key: KEY, endsAt: NOW + 4000, shown: KEY },
    });
    assert.deepEqual(readStoredLedger(), last.current, 'the tick wrote the ledger it laid out');
    assert.deepEqual(fixture.writes, ['same'], 'nothing in the queue changed, so the state object is kept');
    assert.deepEqual(clock.armed.map((entry) => entry.ms), [1500], 'armed for the time the toast runs out');
    assert.notEqual(pending.current, undefined, 'the canceller is kept');

    // The next tick at that deadline cancels the armed timer first, ages the toast by the elapsed time
    // and arms the remainder.
    clock.advance(1000);
    clock.armed[0].fire();
    assert.deepEqual(clock.cancelled, [1500], 'the pending canceller ran before the tick continued');
    assert.deepEqual(clock.armed.map((entry) => entry.ms), [1500, 500]);
    assert.deepEqual(last.current.toasts.map((toast) => toast.leftMs), [500]);
    assert.equal(last.current.at, NOW + 1000);
    assert.deepEqual(readStoredLedger().toasts.map((toast) => toast.leftMs), [500]);
  } finally {
    off();
  }
});

test('a bar with nothing to show arms nothing', () => {
  const off = makeStateStore();
  try {
    const fixture = makeStore(state({ notifications: { current: null, queue: [] } }));
    const clock = makeClock(NOW);
    const pending: { current?: () => void } = {};
    const last: { current: BarLedger } = { current: emptyLedger() };

    runClockTick({ clock: clock.clock, store: fixture.store, pending, last });
    assert.deepEqual(clock.armed, []);
    assert.equal(pending.current, undefined);
    assert.deepEqual(last.current, { toasts: [], at: NOW, slot: undefined });
  } finally {
    off();
  }
});

test('a tick keeps the state object when the queue\'s texts did not change', () => {
  const off = makeStateStore();
  try {
    const fixture = makeStore(state());
    const last: { current: BarLedger } = { current: emptyLedger() };
    runClockTick({ clock: makeClock(NOW).clock, store: fixture.store, pending: {}, last });
    assert.deepEqual(fixture.writes, ['same']);
    assert.deepEqual(fixture.state().notifications.current, TOAST, 'the queue itself is untouched');
  } finally {
    off();
  }
});
