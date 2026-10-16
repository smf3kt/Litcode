// The host toast method and the stack it keeps (W45-32). The copied bodies are
// src/plugin-chain-notify-stack-source.ts (17 blocks, 2,268 units, three modules; ranges and
// per-block digests in research/ports/W45-notify-stack-blocks.plan.json); the seam is
// src/plugin-chain-notify-stack.ts. These tests pin what the stack does: the read, the cap, the
// fold, the write, the timer and the undrawn report — and, now that W45-36 has ported the label
// sanitiser and W45-37 the tab expander under it, the label a stacked toast is drawn under.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import {
  EMPTY_TOAST_STACK, PLUGIN_LABEL_FALLBACK, TOAST_HOLD_REBASE_MS, TOAST_LEAVING_MS, TOAST_STACK_KEY,
  armToastTimer, bindToastClock, drawnToastIds, foldToastStack, hostToast, listEquals, pluginLabel,
  readToastStack, reportUndrawnToast, toastStackStateKey, trimToastStack, writeToastStack,
} from '../src/plugin-chain-notify-stack.js';
import type { ToastStackEntry } from '../src/plugin-chain-notify-stack.js';
import { ACn as MAX_WAITING_TOASTS } from '../src/plugin-chain-toast-source.js';

const NOW = 1_000_000;

const entry = (over: Partial<ToastStackEntry> = {}): ToastStackEntry => ({
  id: 'a', owner: 'plugin-a', plugin: 'plugin-a', isManaged: false, text: 'hello',
  shownAt: NOW, leavesAt: NOW + 4000, phase: 'shown', ...over,
});

/** The plugin-state store the stack lives in, as the write half binds it. */
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
  return { stored, off, value: () => stored.get(toastStackStateKey())?.value };
}

/** A fake timer so the arming, the cancelling and the unref are all observable. */
function withFakeTimers<T>(run: (armed: number[], unrefs: () => number) => T): T {
  const armed: number[] = [];
  let unrefs = 0;
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((_: () => void, ms: number) => {
    armed.push(ms);
    return { unref: () => { unrefs += 1; } } as unknown as NodeJS.Timeout;
  }) as typeof globalThis.setTimeout;
  try {
    return run(armed, () => unrefs);
  } finally {
    globalThis.setTimeout = real;
  }
}

test('the stack reads as the frozen empty array until a store holds one', () => {
  assert.equal(TOAST_LEAVING_MS, 240);
  assert.equal(TOAST_HOLD_REBASE_MS, 30000);
  assert.equal(MAX_WAITING_TOASTS, 50);
  assert.deepEqual(TOAST_STACK_KEY, { plugin: 'engine', key: 'toasts' });
  assert.equal(toastStackStateKey(), 'engine\u0000toasts');
  assert.equal(PLUGIN_LABEL_FALLBACK, 'unnamed');
  // The reader goes through the plugin-state store (`s_()`), so even the empty read needs one bound.
  const store = makeStateStore();
  try {
    assert.equal(readToastStack(), EMPTY_TOAST_STACK, 'no value under the key, so the frozen array');
    store.stored.set(toastStackStateKey(), { value: [entry()], version: 1 });
    assert.deepEqual(readToastStack().map((toast) => toast.id), ['a']);
    store.stored.set(toastStackStateKey(), { value: 'not an array', version: 2 });
    assert.equal(readToastStack(), EMPTY_TOAST_STACK, 'a value that is no array reads as the frozen one');
  } finally {
    store.off();
  }
});

test('the shallow list equality is identity, then length, then element by element', () => {
  assert.equal(listEquals([1, 2], [1, 2]), true);
  assert.equal(listEquals([1, 2], [2, 1]), false);
  assert.equal(listEquals([1], [1, 2]), false);
  assert.equal(listEquals(undefined, undefined), true);
  assert.equal(listEquals([1], undefined), false);
  assert.equal(listEquals(undefined, [1]), false);
});

test('the cap drops the oldest toast of the largest group, recursing until the stack fits', () => {
  const under = Array.from({ length: 6 }, (_, i) => entry({ id: `t${i}`, owner: `p${i % 2}`, leavesAt: NOW + i }));
  assert.deepEqual(trimToastStack(under).map((toast) => toast.id), under.map((toast) => toast.id),
    'six toasts are under the cap, so nothing goes');

  // 26 for "big" (the even ids) against 25 for "small": the largest group loses its oldest member.
  const over = Array.from({ length: 51 }, (_, i) =>
    entry({ id: `t${i}`, owner: i % 2 === 0 ? 'big' : 'small', leavesAt: NOW + i }));
  const trimmed = trimToastStack(over);
  assert.equal(trimmed.length, 50);
  assert.deepEqual(over.map((toast) => toast.id).filter((id) => !trimmed.some((toast) => toast.id === id)), ['t0']);

  // A managed toast last makes the filter keep every entry, so the trim is no longer per-seat.
  const grown = [...over, entry({ id: 't51', owner: 'big', leavesAt: NOW + 51, isManaged: true })];
  const trimmed2 = trimToastStack(grown);
  assert.equal(trimmed2.length, 50);
  assert.deepEqual(grown.map((toast) => toast.id).filter((id) => !trimmed2.some((toast) => toast.id === id)),
    ['t0', 't2'], 'the second pass drops big\'s new oldest member');
});

test('the fold ages a spent toast into its leaving phase, drops a spent leaving one, and re-bases a held one', () => {
  const folded = foldToastStack([
    entry({ id: 'fresh', leavesAt: NOW + 1000 }),
    entry({ id: 'spent', leavesAt: NOW - 1 }),
    entry({ id: 'leaving', leavesAt: NOW - TOAST_LEAVING_MS - 1, phase: 'leaving' }),
    entry({ id: 'held', heldAt: NOW - TOAST_HOLD_REBASE_MS - 500, leavesAt: NOW + 100, phase: 'leaving' }),
  ], NOW);
  assert.deepEqual(folded, [
    entry({ id: 'fresh', leavesAt: NOW + 1000 }),
    { ...entry({ id: 'spent', leavesAt: NOW + TOAST_LEAVING_MS }), phase: 'leaving' },
    { ...entry({ id: 'held', leavesAt: NOW + 100 + TOAST_HOLD_REBASE_MS + 500, phase: 'leaving' }) },
  ], 'a held toast keeps the time it was held, and the leaving phase lasts one leaving window');
});

test('a write stores the trimmed stack, reports what left undrawn, and arms the next deadline', () => {
  const store = makeStateStore();
  const clock: { pending?: { unref?: () => void }; pausedAt?: number } = {};
  bindToastClock(clock);
  try {
    withFakeTimers((armed, unrefs) => {
      writeToastStack([entry({ id: 'one', leavesAt: NOW + 250 })], () => NOW);
      assert.deepEqual(store.value(), [entry({ id: 'one', leavesAt: NOW + 250 })],
        'the store holds exactly the entry, no wrapper');
      assert.deepEqual(chainRecords().map((record) => (record as { message?: string }).message), [],
        'a toast that is still up is not reported');
      assert.deepEqual(armed, [250], 'armed for the time the toast has left');
      assert.notEqual(clock.pending, undefined);
      assert.equal(unrefs(), 1, 'the handle is unref-ed so it does not hold the process open');

      // The same stack again: the store is left alone ($P), but the fold still arms.
      armed.length = 0;
      writeToastStack([entry({ id: 'one', leavesAt: NOW + 250 })], () => NOW);
      assert.deepEqual(armed, [250]);

      // A stack that no longer holds a toast the store had: the id leaves the stack, undrawn.
      clearChainRecords();
      writeToastStack([], () => NOW);
      assert.deepEqual(store.value(), []);
      assert.deepEqual(chainRecords().map((record) => (record as { message?: string }).message),
        ['$.ui.toast (plugin-a): one left the stack, never drawn']);

      // An id the bar drew is in `cI`; the writer deletes it there and stays quiet.
      drawnToastIds().add('two');
      store.stored.set(toastStackStateKey(), { value: [entry({ id: 'two' })], version: 3 });
      clearChainRecords();
      writeToastStack([], () => NOW);
      assert.deepEqual(chainRecords(), [], 'a toast that was drawn is not reported');
      assert.equal(drawnToastIds().has('two'), false, 'and its id is forgotten');
    });
  } finally {
    bindToastClock(null);
    store.off();
  }
});

test('the timer arms for the stack\'s next deadline, and not at all while paused or empty', () => {
  const store = makeStateStore();
  const clock: { pending?: { unref?: () => void }; pausedAt?: number } = {};
  bindToastClock(clock);
  try {
    withFakeTimers((armed) => {
      armToastTimer(() => NOW, () => {});
      assert.deepEqual(armed, [], 'no toast, no timer');

      store.stored.set(toastStackStateKey(), {
        value: [entry({ id: 'a', leavesAt: NOW + 400 }), entry({ id: 'b', leavesAt: NOW + 100 })],
        version: 1,
      });
      clock.pausedAt = NOW;
      armToastTimer(() => NOW, () => {});
      assert.deepEqual(armed, [], 'a paused bar arms nothing');

      clock.pausedAt = undefined;
      const fired: number[] = [];
      armToastTimer(() => NOW, () => { fired.push(NOW); });
      assert.deepEqual(armed, [100], 'the earliest deadline wins');
      assert.deepEqual(fired, [], 'arming does not run the fold');

      // A stack whose deadlines have passed still arms at least 1ms.
      armed.length = 0;
      store.stored.set(toastStackStateKey(), { value: [entry({ id: 'a', leavesAt: NOW - 5000 })], version: 2 });
      armToastTimer(() => NOW, () => {});
      assert.deepEqual(armed, [1]);
    });
  } finally {
    bindToastClock(null);
    store.off();
  }
});

test('an undrawn toast is reported on its own, and the push path stacks under the sanitised label', () => {
  clearChainRecords();
  reportUndrawnToast(entry({ id: 'gone' }));
  assert.deepEqual(chainRecords().map((record) => (record as { message?: string }).message),
    ['$.ui.toast (plugin-a): gone left the stack, never drawn']);

  // The label sanitiser is ported (W45-36) and so is the tab and ESC-sequence expander under it
  // (W45-37), so every label resolves and the push path runs.
  assert.equal(pluginLabel('engine'), 'engine');
  assert.equal(pluginLabel(42 as unknown as string), 'unnamed', 'a non-string is the unnamed policy');
  assert.equal(pluginLabel('a\tb'), 'a       b', 'a tab reaches the next eight-column stop');
  const store = makeStateStore();
  const clock: { pending?: { unref?: () => void }; pausedAt?: number } = {};
  bindToastClock(clock);
  try {
    hostToast({ plugin: 'engine', text: 'hi', timeoutMs: 4000 });
    const stacked = store.value() as Array<ToastStackEntry>;
    assert.deepEqual(stacked.map((toast) => [toast.owner, toast.plugin, toast.text, toast.phase]),
      [['engine', 'engine', 'hi', 'shown']], 'the toast is stacked under the sanitised label');
    assert.equal(stacked[0]!.leavesAt - stacked[0]!.shownAt, 4000);
    hostToast({ plugin: 'a\tb', text: 'hi', timeoutMs: 4000 });
    assert.equal((store.value() as Array<ToastStackEntry>).at(-1)!.plugin, 'a       b',
      'a plugin id carrying a tab stacks under its expanded label');
  } finally {
    bindToastClock(null);
    store.off();
  }
});
