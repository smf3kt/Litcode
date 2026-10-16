// The toast module's remaining verbs (W45-33). The copied bodies are
// src/plugin-chain-notify-verbs-source.ts (4 blocks, 681 units; ranges and per-block digests in
// research/ports/W45-notify-verbs-blocks.plan.json); the seam is src/plugin-chain-notify-verbs.ts.
// These tests pin what each verb does to the stack, what it writes, and which of them arm a timer.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { bindPluginState } from '../src/plugin-chain-notify.js';
import {
  bindToastClock, drawnToastIds, toastStackStateKey,
} from '../src/plugin-chain-notify-stack.js';
import type { ToastStackEntry } from '../src/plugin-chain-notify-stack.js';
import { dismissToast, expireToasts, holdToast, pauseToasts } from '../src/plugin-chain-notify-verbs.js';

const NOW = 1_000_000;

const entry = (over: Partial<ToastStackEntry> = {}): ToastStackEntry => ({
  id: 'a', owner: 'plugin-a', plugin: 'plugin-a', isManaged: false, text: 'hello',
  shownAt: NOW, leavesAt: NOW + 4000, phase: 'shown', ...over,
});

/** A fixture with a bound store, a bound clock and a fake timer, so every verb is observable. */
function fixture(stack: ToastStackEntry[]) {
  const stored = new Map<string, { value: unknown; version: number }>();
  const off = bindPluginState({
    values: {
      getState: () => ({ get: (key: string) => stored.get(key) }),
      setState: (update) => { for (const [key, value] of update(new Map(stored))) stored.set(key, value); },
    },
    versionFloor: 0,
    readersOf: new Map(),
  });
  stored.set(toastStackStateKey(), { value: stack, version: 1 });
  const clock: { pending?: { unref?: () => void }; pausedAt?: number } = {};
  bindToastClock(clock);
  const armed: number[] = [];
  const real = globalThis.setTimeout;
  globalThis.setTimeout = ((_: () => void, ms: number) => {
    armed.push(ms);
    return { unref: () => {} } as unknown as NodeJS.Timeout;
  }) as typeof globalThis.setTimeout;
  const write = (value: unknown) => stored.set(toastStackStateKey(), { value, version: 2 });
  return {
    clock,
    armed,
    write,
    /** The stack as stored: id, phase and the two timestamps the verbs move. */
    ids: () => (stored.get(toastStackStateKey())?.value as ToastStackEntry[] | undefined)?.map((toast) => toast.id),
    stack: () => stored.get(toastStackStateKey())?.value as ToastStackEntry[],
    done() {
      globalThis.setTimeout = real;
      bindToastClock(null);
      off();
    },
  };
}

test('dismiss drops the id, flags it in cI, and the next write consumes the flag', () => {
  const f = fixture([entry({ id: 'a' }), entry({ id: 'b' })]);
  try {
    drawnToastIds().clear();
    clearChainRecords();
    dismissToast('a', () => NOW);
    assert.deepEqual(f.ids(), ['b'], 'the dismissed toast is gone from the store');
    // `IEe` adds the id to `cI` and then writes; the write path deletes the ids the read stack lost
    // from `cI`, which is exactly how the dismissed toast escapes the undrawn report.
    assert.deepEqual([...drawnToastIds()], [], 'the flag is consumed by the write it triggered');
    assert.deepEqual(chainRecords().map((record) => (record as { message?: string }).message), [],
      'a dismissed toast is never reported as undrawn');
    assert.deepEqual(f.armed, [4000], 'armed for what is left of the surviving toast');

    f.armed.length = 0;
    dismissToast('missing', () => NOW);
    assert.deepEqual(f.ids(), ['b'], 'a stack without the id is left as it is');
    assert.deepEqual(f.armed, [], 'and nothing is written, so nothing is armed');
  } finally {
    f.done();
  }
});

test('expire folds the stack now and writes it', () => {
  const f = fixture([entry({ id: 'a', leavesAt: NOW - 1 }), entry({ id: 'b', leavesAt: NOW + 500 })]);
  try {
    expireToasts(() => NOW);
    assert.deepEqual(f.stack().map((toast) => [toast.id, toast.phase, toast.leavesAt]),
      [['a', 'leaving', NOW + 240], ['b', 'shown', NOW + 500]]);
    assert.deepEqual(f.armed, [240], 'the toast that just ran out holds the next deadline');
  } finally {
    f.done();
  }
});

test('hold stamps the entry, a second hold changes nothing, and releasing adds the held time', () => {
  const f = fixture([entry({ id: 'a', leavesAt: NOW + 4000 })]);
  try {
    holdToast({ id: 'a', isHeld: true }, () => NOW);
    assert.deepEqual(f.stack(), [entry({ id: 'a', leavesAt: NOW + 4000, heldAt: NOW })],
      'holding returns the entry to its shown phase and stamps the hold');
    assert.deepEqual(f.armed, [30000], 'the held toast folds at its hold limit');

    f.armed.length = 0;
    holdToast({ id: 'a', isHeld: true }, () => NOW + 10);
    assert.deepEqual(f.stack(), [entry({ id: 'a', leavesAt: NOW + 4000, heldAt: NOW })],
      'an entry that is already held is not re-stamped');
    assert.deepEqual(f.armed, [], 'and nothing is written');

    f.armed.length = 0;
    holdToast({ id: 'a', isHeld: false }, () => NOW + 3000);
    assert.deepEqual(f.stack(), [entry({ id: 'a', leavesAt: NOW + 7000 })],
      'releasing drops heldAt and adds the 3000ms it was held');
    assert.deepEqual(f.armed, [4000]);

    f.armed.length = 0;
    holdToast({ id: 'other', isHeld: false }, () => NOW + 4000);
    assert.deepEqual(f.armed, [], 'an id that is not held is not released twice');
  } finally {
    f.done();
  }
});

test('pause flips the clock, shifts every deadline by the time that passed, and resumes', () => {
  const f = fixture([entry({ id: 'a', leavesAt: NOW + 4000 }), entry({ id: 'b', leavesAt: NOW + 9000, heldAt: NOW })]);
  try {
    f.armed.length = 0;
    pauseToasts({ isPaused: true }, () => NOW);
    assert.equal(f.clock.pausedAt, NOW);
    assert.deepEqual(f.armed, [], 'the bar is paused, so no timer is armed for it');
    assert.deepEqual(f.stack().map((toast) => toast.leavesAt), [NOW + 4000, NOW + 9000],
      'pausing at the same instant shifts nothing');

    f.armed.length = 0;
    pauseToasts({ isPaused: true }, () => NOW + 1000);
    assert.equal(f.clock.pausedAt, NOW, 'pausing again is not a state change');
    assert.deepEqual(f.armed, []);

    f.armed.length = 0;
    pauseToasts({ isPaused: false }, () => NOW + 5000);
    assert.equal(f.clock.pausedAt, undefined, 'resuming clears the pause');
    assert.deepEqual(f.stack().map((toast) => [toast.leavesAt, toast.heldAt]),
      [[NOW + 9000, undefined], [NOW + 14000, NOW + 5000]], 'the 5000ms the bar was paused moves both');
    assert.deepEqual(f.armed, [4000], 'and the next deadline is armed again');
  } finally {
    f.done();
  }
});
