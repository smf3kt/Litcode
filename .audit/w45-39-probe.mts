// W45-39 probe: measure the notification queue off the transcribed bodies before the regression
// asserts it. Prints the drain, the push, the remove and the mount effect, case by case.
import {
  NOTIFICATION_DEFAULT_TIMEOUT_MS, createNotificationQueue, notificationQueueSuppressed,
} from '../src/plugin-chain-notify-queue.js';
import type { Notification, NotificationQueueState } from '../src/plugin-chain-notify-queue.js';

const NOW = 1_000_000;
const state = (over: Partial<NotificationQueueState['notifications']> = {}): NotificationQueueState =>
  ({ notifications: { current: null, queue: [], pinned: [], ...over } });

function makeStore(initial: NotificationQueueState) {
  let current = initial;
  const writes: string[] = [];
  const store = {
    getState: () => current,
    setState: (update: (s: NotificationQueueState) => NotificationQueueState) => {
      const next = update(current);
      writes.push(next === current ? 'same' : 'changed');
      current = next;
    },
  };
  return { store, writes, state: () => current };
}
function makeClock(start: number) {
  const armed: { ms: number; fire: () => void }[] = [];
  const cancelled: number[] = [];
  let now = start;
  const clock = {
    setTimeout: (fn: () => void, ms: number) => { armed.push({ ms, fire: fn }); return () => { cancelled.push(ms); }; },
  };
  return { clock, armed, cancelled, at: () => now };
}
const note = (over: Partial<Notification> = {}): Notification => ({ key: 'n1', ...over });
const show = (s: NotificationQueueState) => JSON.stringify({
  current: s.notifications.current?.key ?? null,
  queue: s.notifications.queue.map((n) => n.key),
  pinned: s.notifications.pinned.map((n) => n.key),
});

console.log('suppressed', [
  notificationQueueSuppressed({ presentationContext: 'fullscreen', isScreenReaderEnabled: false }),
  notificationQueueSuppressed({ presentationContext: null }),
]);

// ── the drain ────────────────────────────────────────────────────────────────────────────────────
{
  const bar = makeStore(state());
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  queue.processQueue();
  console.log('drain empty      ', show(bar.state()), 'writes', bar.writes, 'armed', clock.armed.map((a) => a.ms));

  bar.store.setState((s) => ({ ...s, notifications: { ...s.notifications, queue: [note({ timeoutMs: 1500 })] } }));
  queue.processQueue();
  console.log('drain takes slot ', show(bar.state()), 'armed', clock.armed.map((a) => a.ms), 'pending', typeof queue.clearTimer.current);

  queue.processQueue();
  console.log('drain occupied   ', show(bar.state()), 'writes', bar.writes, 'armed', clock.armed.map((a) => a.ms));
}

// The queue order the drain picks from: highest priority first (`F`), and the suppressed filter.
{
  const bar = makeStore(state({ queue: [note({ key: 'a', priority: 'low', timeoutMs: 111 }), note({ key: 'b', priority: 'high', timeoutMs: 222 })] }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  const before = bar.writes.length;
  queue.processQueue();
  console.log('drain free slot  ', show(bar.state()), 'armed', clock.armed.map((a) => a.ms), 'write', bar.writes[before]);
}
{
  const bar = makeStore(state({
    current: note({ key: 'cur', priority: 'low' }),
    queue: [note({ key: 'a', priority: 'low' }), note({ key: 'b', priority: 'high' })],
  }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  queue.processQueue();
  console.log('drain picks high ', show(bar.state()), 'armed', clock.armed.map((a) => a.ms));
}
{
  const bar = makeStore(state({
    current: note({ key: 'cur' }),
    queue: [note({ key: 'a' }), note({ key: 'b', exemptFromDiffPanelHold: true })],
  }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock, presentationContext: 'inline' });
  bar.store.setState((s) => ({ ...s, diffPanelVisible: true }));
  queue.processQueue();
  console.log('drain hidden slot', show(bar.state()), 'armed', clock.armed.length);
}

// ── the push ─────────────────────────────────────────────────────────────────────────────────────
{
  const bar = makeStore(state());
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  queue.addNotification(note({ key: 'pinned', pinned: true }));
  console.log('push pinned      ', show(bar.state()), 'armed', clock.armed.length);
  queue.addNotification(note({ key: 'plain' }));
  console.log('push plain       ', show(bar.state()));
  const plainBefore = bar.writes.length;
  queue.addNotification(note({ key: 'plain' }));
  console.log('push dup plain   ', show(bar.state()), 'push writes', bar.writes.slice(plainBefore, -1), 'drain write', bar.writes.at(-1));
  queue.addNotification(note({ key: 'imm', priority: 'immediate', timeoutMs: 2000 }));
  console.log('push immediate   ', show(bar.state()), 'armed', clock.armed.map((a) => a.ms));
  queue.addNotification(note({ key: 'imm2', priority: 'immediate' }));
  console.log('push immediate 2 ', show(bar.state()), 'armed', clock.armed.map((a) => a.ms));
  const writesBefore = bar.writes.length;
  queue.addNotification(note({ key: 'imm2', priority: 'immediate' }));
  console.log('push duplicate   ', show(bar.state()), 'push writes', bar.writes.slice(writesBefore, -1), 'drain write', bar.writes.at(-1));
}
{
  const bar = makeStore(state({ current: note({ key: 'cur' }) }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  bar.store.setState((s) => ({ ...s, diffPanelVisible: true }));
  queue.addNotification(note({ key: 'imm', priority: 'immediate', timeoutMs: 3000 }));
  console.log('push held hidden ', show(bar.state()),
    'held', bar.state().notifications.queue[0]?.heldDuringDiffPanel,
    'armed', clock.armed.map((a) => a.ms));
  const fired = bar.state().notifications.queue[0]?.key;
  clock.armed.at(-1)?.fire();
  console.log('held toast fires ', show(bar.state()), 'key then', fired, 'armed', clock.armed.map((a) => a.ms));
}
{
  const bar = makeStore(state({ current: note({ key: 'n1', text: 'old' }) }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  queue.addNotification(note({ key: 'n1', text: 'new', timeoutMs: 1200, fold: (a, b) => ({ ...a, text: b.text }) }));
  console.log('push folds cur   ', show(bar.state()), 'text', bar.state().notifications.current?.text,
    'armed', clock.armed.map((a) => a.ms));
  queue.addNotification(note({ key: 'q', text: 'q1' }));
  queue.addNotification(note({ key: 'q', text: 'q2', fold: (a, b) => ({ ...a, text: b.text }) }));
  console.log('push folds queue ', show(bar.state()), 'text', bar.state().notifications.queue.find((n) => n.key === 'q')?.text);
}
{
  const bar = makeStore(state({
    current: note({ key: 'cur' }),
    queue: [note({ key: 'a' }), note({ key: 'b', invalidates: ['a', 'cur'] })],
  }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  queue.removeNotification('nope');
  console.log('remove unknown   ', show(bar.state()), 'writes', bar.writes.at(-1));
  queue.removeNotification('a');
  console.log('remove queued    ', show(bar.state()));
  queue.removeNotification('cur');
  console.log('remove current   ', show(bar.state()), 'cancelled', clock.cancelled);
}

// ── the mount effect ─────────────────────────────────────────────────────────────────────────────
{
  const bar = makeStore(state({ queue: [note({ key: 'q', timeoutMs: 700 })] }));
  const clock = makeClock(NOW);
  const queue = createNotificationQueue({ store: bar.store, clock: clock.clock });
  const unmount = queue.mount();
  console.log('mount drains     ', show(bar.state()), 'count', queue.mountCount.current, 'armed', clock.armed.map((a) => a.ms));
  const unmount2 = queue.mount();
  console.log('second mount     ', 'count', queue.mountCount.current);
  unmount();
  console.log('first unmount    ', 'count', queue.mountCount.current, 'cancelled', clock.cancelled);
  unmount2();
  console.log('last unmount     ', 'count', queue.mountCount.current, 'cancelled', clock.cancelled);
}

console.log('default timeout  ', NOTIFICATION_DEFAULT_TIMEOUT_MS);
