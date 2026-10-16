// The notification queue owner (W45-39). The copied bodies are src/plugin-chain-notify-queue-source.ts
// (10 blocks, 773 units, two modules — ranges and per-block digests in
// research/ports/W45-notify-queue-blocks.plan.json); the seam is src/plugin-chain-notify-queue.ts,
// whose four closures are the source's own text with the React hook wrappers removed
// (.audit/w45-39-vo-identity.mjs recomputes that comparison and fails on any difference).
//
// The expectations are the source's behaviour, read off the transcribed bodies and measured in
// .audit/w45-39-probe.mts before any assertion was written: the drain takes the highest-priority
// entry only when the slot is free, the push has its own branches (pinned, immediate, held behind a
// diff panel, folded) and returns without draining on the immediate one, and the mount effect counts
// the surfaces and cancels the timer on the last unmount.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  NOTIFICATION_DEFAULT_TIMEOUT_MS, createNotificationQueue, notificationQueueSuppressed,
} from '../src/plugin-chain-notify-queue.js';
import type { Notification, NotificationQueueState, NotificationQueueStore } from '../src/plugin-chain-notify-queue.js';
import {
  C, D, F, I, XXe, Xmt, hEe, i4n, vps,
} from '../src/plugin-chain-notify-queue-source.js';

const NOW = 1_000_000;
const state = (over: Partial<NotificationQueueState['notifications']> = {}): NotificationQueueState =>
  ({ notifications: { current: null, queue: [], pinned: [], ...over } });
const note = (over: Partial<Notification> = {}): Notification => ({ key: 'n1', ...over });
const keys = (s: NotificationQueueState): string[] => [
  s.notifications.current?.key ?? '-', ...s.notifications.queue.map((each) => each.key),
];

/** The queue's store, keeping every write so a call's own write can be told from the drain's. */
function makeStore(initial: NotificationQueueState) {
  let current = initial;
  const writes: string[] = [];
  const store: NotificationQueueStore = {
    getState: () => current,
    setState: (update) => { const next = update(current); writes.push(next === current ? 'same' : 'changed'); current = next; },
  };
  return { store, writes, state: () => current, since: (mark: number) => writes.slice(mark) };
}

/** A clock that records what a timer was armed for and what was cancelled. */
function makeClock(start: number) {
  const armed: { ms: number; fire: () => void }[] = [];
  const cancelled: number[] = [];
  let now = start;
  const clock = {
    setTimeout: (fn: () => void, ms: number) => { armed.push({ ms, fire: fn }); return () => { cancelled.push(ms); }; },
  };
  return { clock, armed, cancelled, advance: (ms: number) => { now += ms; } };
}

function makeQueue(initial: NotificationQueueState, input: { diffPanelVisible?: boolean } = {}) {
  const bar = makeStore(input.diffPanelVisible ? { ...initial, diffPanelVisible: true } : initial);
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  return { bar, clock, queue };
}

test('the gate the suppression test reads is false in this build', () => {
  assert.equal(NOTIFICATION_DEFAULT_TIMEOUT_MS, 8000, '`S`');
  assert.equal(vps(), false, 'the capability probe is `!1`');
  assert.equal(i4n(), false, 'so the gate is a constant false');
  assert.equal(notificationQueueSuppressed({ presentationContext: 'fullscreen', isScreenReaderEnabled: false }), false);
  assert.equal(notificationQueueSuppressed({ presentationContext: null }), false);
  assert.equal(notificationQueueSuppressed({ presentationContext: 'fullscreen', isScreenReaderEnabled: true }), false);
  // Even a normaliser that always answers "fullscreen" cannot open the gate.
  assert.equal(notificationQueueSuppressed({ presentationContext: 'inline' }, () => 'fullscreen'), false);
});

test('the copied bodies answer as their source reads', () => {
  assert.deepEqual(Xmt, { immediate: 0, high: 1, medium: 2, low: 3 });
  assert.equal(D('anything'), 'queue', 'the queue class is the constant the source returns');
  assert.equal(C(note({ priority: 'high' }), note({ key: 'x' })), true, 'a non-immediate may requeue');
  assert.equal(C(note({ priority: 'immediate' }), note({ key: 'x' })), false);
  assert.equal(C(note({ priority: 'immediate', requeueOnPreempt: true }), note({ key: 'x' })), true);
  assert.equal(C(note({ priority: 'high' }), note({ key: 'x', invalidates: ['n1'] })), false,
    'unless the newcomer invalidates it');
  assert.equal(F([]), undefined);
  assert.equal(F([note({ key: 'a', priority: 'low' }), note({ key: 'b', priority: 'high' })])?.key, 'b');
  assert.equal(hEe(null, true), false, 'nothing to hold');
  assert.equal(hEe(note(), true), false, 'a diff panel holds what is not exempt');
  assert.equal(hEe(note(), false), true, 'with no panel, everything is held');
  assert.equal(hEe(note({ exemptFromDiffPanelHold: true }), true), true);
  const dropped = XXe(
    { current: note({ key: 'c' }), queue: [note({ key: 'q' })], pinned: [note({ key: 'p' })] }, 'q');
  assert.deepEqual([dropped.current?.key, dropped.queue.length, dropped.pinned.length], ['c', 0, 1]);
  assert.equal(XXe({ current: null, queue: [], pinned: [] }, 'q').current, null, 'an unknown key gives the same object');
  const holders = I();
  assert.deepEqual(holders, { clearTimer: { current: null }, mountCount: { current: 0 } });
});

test('the drain takes the highest-priority entry when the slot is free', () => {
  const { bar, clock, queue } = makeQueue(state({
    queue: [note({ key: 'a', priority: 'low', timeoutMs: 111 }), note({ key: 'b', priority: 'high', timeoutMs: 222 })],
  }));
  const mark = bar.writes.length;
  queue.processQueue();
  assert.deepEqual(keys(bar.state()), ['b', 'a'], 'the high-priority entry left the queue, the low one stayed');
  assert.deepEqual(clock.armed.map((entry) => entry.ms), [222], 'armed for the entry\'s own timeout');
  assert.deepEqual(bar.since(mark), ['changed']);
  assert.equal(typeof queue.clearTimer.current, 'function');
});

test('the drain does nothing while the slot is occupied', () => {
  const { bar, clock, queue } = makeQueue(state({
    current: note({ key: 'cur', priority: 'low' }),
    queue: [note({ key: 'a' }), note({ key: 'b', priority: 'immediate', timeoutMs: 50 })],
  }));
  const mark = bar.writes.length;
  queue.processQueue();
  assert.deepEqual(keys(bar.state()), ['cur', 'a', 'b'], 'not even an immediate entry preempts the slot here');
  assert.deepEqual(clock.armed, []);
  assert.deepEqual(bar.since(mark), ['same']);
});

test('the drain while a diff panel is up considers only what is exempt from the hold', () => {
  // With the slot free: the filter `Cj(state) ? queue.filter(exemptFromDiffPanelHold) : queue` is what
  // picks, so the held entry is invisible to `F` while the panel is up.
  const { bar, clock, queue } = makeQueue(state({
    queue: [note({ key: 'held' }), note({ key: 'exempt', exemptFromDiffPanelHold: true, timeoutMs: 400 })],
  }), { diffPanelVisible: true });
  queue.processQueue();
  assert.deepEqual(keys(bar.state()), ['exempt', 'held'], 'the exempt one moved, the held one did not');
  assert.deepEqual(clock.armed.map((entry) => entry.ms), [400]);
});

test('the drain of an empty bar writes nothing changed and arms nothing', () => {
  const { bar, clock, queue } = makeQueue(state());
  queue.processQueue();
  assert.deepEqual(bar.writes, ['same']);
  assert.deepEqual(clock.armed, []);
  assert.equal(queue.clearTimer.current, null);
});

test('a pinned notification lands in the pinned list and nothing else', () => {
  const { bar, clock, queue } = makeQueue(state());
  queue.addNotification(note({ key: 'pinned', pinned: true }));
  assert.deepEqual(keys(bar.state()), ['-']);
  assert.deepEqual(bar.state().notifications.pinned.map((each) => each.key), ['pinned']);
  assert.deepEqual(clock.armed, [], 'no slot, no timer');
});

test('an immediate notification takes the slot, requeues what it may and returns without draining', () => {
  const { bar, clock, queue } = makeQueue(state({ current: note({ key: 'plain' }) }));
  const mark = bar.writes.length;
  queue.addNotification(note({ key: 'imm', priority: 'immediate', timeoutMs: 2000 }));
  assert.deepEqual(keys(bar.state()), ['imm', 'plain'], 'the previous slot holder is requeued through `C`');
  assert.deepEqual(clock.armed.map((entry) => entry.ms), [2000]);
  assert.deepEqual(bar.since(mark), ['changed'], 'one write: the immediate branch returns before the drain');
});

test('a duplicate push is a no-op on the general path but re-takes the slot on the immediate one', () => {
  const { bar, queue } = makeQueue(state());
  queue.addNotification(note({ key: 'plain' }));
  assert.deepEqual(keys(bar.state()), ['plain'], 'the push queues it and the drain takes it');
  const mark = bar.writes.length;
  queue.addNotification(note({ key: 'plain' }));
  assert.deepEqual(bar.since(mark), ['same', 'same'], 'the guard returns the state unchanged, and the drain has nothing to do');

  const immediate = makeQueue(state());
  immediate.queue.addNotification(note({ key: 'imm', priority: 'immediate' }));
  const immMark = immediate.bar.writes.length;
  immediate.queue.addNotification(note({ key: 'imm', priority: 'immediate' }));
  assert.deepEqual(immediate.bar.since(immMark), ['changed'], 'the immediate branch replaces the slot with the newcomer');
});

test('a fold merges into the slot or into the queue entry the key names', () => {
  const fold = (a: Notification, b: Notification) => ({ ...a, text: b.text });
  const { bar, clock, queue } = makeQueue(state({ current: note({ key: 'n1', text: 'old' }) }));
  queue.addNotification(note({ key: 'n1', text: 'new', fold }));
  assert.equal(bar.state().notifications.current?.text, 'new');
  assert.deepEqual(clock.armed.map((entry) => entry.ms), [8000], 'the folded entry\'s own timeout, or `S`');

  queue.addNotification(note({ key: 'q', text: 'q1' }));
  queue.addNotification(note({ key: 'q', text: 'q2', fold }));
  assert.equal(bar.state().notifications.queue.find((each) => each.key === 'q')?.text, 'q2',
    'merged in place, not appended again');
  assert.equal(bar.state().notifications.queue.filter((each) => each.key === 'q').length, 1);
});

test('an immediate notification behind a diff panel is held and the drain refuses it', () => {
  const { bar, clock, queue } = makeQueue(state({ current: note({ key: 'cur' }) }), { diffPanelVisible: true });
  queue.addNotification(note({ key: 'imm', priority: 'immediate', timeoutMs: 3000 }));
  assert.deepEqual(keys(bar.state()), ['cur', 'imm'], 'it waits in the queue');
  assert.equal(bar.state().notifications.queue[0]?.heldDuringDiffPanel, true);
  assert.deepEqual(clock.armed, [], 'and nothing was armed for it');
});

test('removing a notification takes it out of wherever it is, and cancels the slot\'s timer with it', () => {
  const { bar, clock, queue } = makeQueue(state({
    current: note({ key: 'cur' }),
    queue: [note({ key: 'a' }), note({ key: 'b' })],
    pinned: [note({ key: 'p' })],
  }));
  queue.processQueue();
  const mark = bar.writes.length;
  queue.removeNotification('nope');
  assert.deepEqual(bar.since(mark), ['same', 'same'], 'an unknown key changes nothing, in the remove or in the drain');

  queue.removeNotification('a');
  assert.deepEqual(keys(bar.state()), ['cur', 'b']);
  queue.removeNotification('p');
  assert.deepEqual(bar.state().notifications.pinned.length, 0);

  const before = clock.cancelled.length;
  queue.removeNotification('cur');
  assert.deepEqual(keys(bar.state()), ['b'], 'the drain promotes the next entry into the freed slot');
  assert.equal(clock.cancelled.length, before, 'the slot\'s own timer was not pending, so nothing was cancelled');
});

test('the mount effect counts the surfaces, drains what is queued, and cancels on the last unmount', () => {
  const { bar, clock, queue } = makeQueue(state({ queue: [note({ key: 'q', timeoutMs: 700 })] }));
  const unmount = queue.mount();
  assert.equal(queue.mountCount.current, 1);
  assert.deepEqual(keys(bar.state()), ['q'], 'mounting drained the queue that was already there');
  assert.deepEqual(clock.armed.map((entry) => entry.ms), [700]);

  const second = queue.mount();
  assert.equal(queue.mountCount.current, 2);
  unmount();
  assert.equal(queue.mountCount.current, 1);
  assert.deepEqual(clock.cancelled, [], 'not the last surface: the timer stands');
  second();
  assert.equal(queue.mountCount.current, 0);
  assert.deepEqual(clock.cancelled, [700], 'the last unmount cancels it');
});

test('the mount effect of a bar with nothing queued drains nothing', () => {
  const { bar, clock, queue } = makeQueue(state());
  const unmount = queue.mount();
  assert.deepEqual(bar.writes, [], 'no drain at all');
  assert.deepEqual(clock.armed, []);
  unmount();
  assert.deepEqual(clock.cancelled, []);
});
