// The notification bar's ledger core (W45-27). The copied bodies are
// src/plugin-chain-notify-source.ts and the seam around them is src/plugin-chain-notify.ts. The
// bar's clock driver (`TK`, chunk-24k7d6mw.js) runs exactly what `tickLedger` wraps: split the
// stored notifications with `sLs` (the ui seam's `splitToastQueue`), merge the previous ledger with
// the stored one (`cLs`), hand the split to the tick (`aLs`), then report `lost`, refresh the
// notifications with `texts` (`pLs`) and schedule `nextTickDelayMs`. These tests pin what that
// driver reads back.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { chainRecords, clearChainRecords } from '../src/plugin-chain-host.js';
import { DEFAULT_TOAST_TIMEOUT_MS, splitToastQueue } from '../src/plugin-chain-ui.js';
import {
  UNTOLD_MS_LIMIT,
  ageOneTick,
  emptyLedger,
  handOutTime,
  isToastCutShort,
  keptToasts,
  laidOutTexts,
  lentTime,
  managedFirst,
  mergeQueued,
  nextTickDelayMs,
  refreshTexts,
  reportLostTime,
  runningSlot,
  tickLedger,
  withChangedText,
} from '../src/plugin-chain-notify.js';
import type { BarLedger, BarNotifications, LedgerToast } from '../src/plugin-chain-notify.js';

const toast = (key: string, leftMs: number, extra: Partial<LedgerToast> = {}): LedgerToast => ({
  key, plugin: 'fixture-bar', text: key, isManaged: false, leftMs, wasShown: false, lentMs: 0, untoldMs: 0, ...extra,
});
// The bar only ever sees plugin toasts: the split drops every other key.
const keyOf = (id: string) => 'plugin-toast-' + id + ':fixture-bar';
const stored = (ledgerToast: LedgerToast): BarLedger => ({ toasts: [ledgerToast], at: 0, slot: void 0 });
const notifications = (current: BarNotifications['current'], queue: BarNotifications['queue'] = []): BarNotifications =>
  ({ current, queue });
/** The split the tick reads, built the way the driver builds it. */
const split = (n: BarNotifications, isHidden = false) => splitToastQueue(n, isHidden, DEFAULT_TOAST_TIMEOUT_MS);
const slot = (shown?: string) => ({ key: 'k1', endsAt: 4000, shown });

test('the tick shows a stored toast, ages it with its slot, and drops it from the slot', () => {
  const one = notifications({ key: keyOf('k1'), timeoutMs: 4000 });
  const storedK1 = stored(toast(keyOf('k1'), 4000));

  // First tick: the toast is on screen and its slot ends 4000 ms in.
  const t0 = tickLedger(emptyLedger(), storedK1, split(one), 0);
  assert.deepEqual(t0.ledger, {
    toasts: [toast(keyOf('k1'), 4000, { wasShown: true })],
    at: 0,
    slot: { key: keyOf('k1'), endsAt: 4000, shown: keyOf('k1') },
  });
  assert.deepEqual([...t0.texts], [[keyOf('k1'), keyOf('k1')]], 'the laid-out text is the toast\'s own');
  assert.deepEqual(t0.lost, []);

  // One second later the toast has aged by the slot's elapsed time, and the slot stands. The store
  // holds what the last tick wrote (`xYr(we.ledger)`), so the tick merges against its own ledger.
  const t1 = tickLedger(t0.ledger, t0.ledger, split(one), 1000);
  assert.deepEqual(t1.ledger, {
    toasts: [toast(keyOf('k1'), 3000, { wasShown: true })],
    at: 1000,
    slot: { key: keyOf('k1'), endsAt: 4000, shown: keyOf('k1') },
  });

  // Past its time the toast keeps its place in the ledger (the queue still holds it) but is no
  // longer the one shown.
  const t5 = tickLedger(t1.ledger, t1.ledger, split(one), 5000);
  assert.deepEqual(t5.ledger, {
    toasts: [toast(keyOf('k1'), 0, { wasShown: true })],
    at: 5000,
    slot: { key: keyOf('k1'), endsAt: 4000, shown: undefined },
  });

  // The next tick is scheduled for the shown toast's own end, and only while it runs out before
  // its slot does.
  assert.equal(nextTickDelayMs({ toasts: [toast('k1', 3000)], at: 1000, slot: slot('k1') }), undefined);
  assert.equal(nextTickDelayMs({ toasts: [toast('k1', 2000)], at: 1000, slot: slot('k1') }), 3000);
  assert.equal(nextTickDelayMs({ toasts: [toast('k1', 3000)], at: 1000, slot: { key: 'k1', endsAt: 4000 } }), undefined);
});

test('the tick with nothing stored gives the slot again, and the merge keeps stale time', () => {
  const one = notifications({ key: keyOf('k1'), timeoutMs: 4000 });

  // No stored toast: nothing is shown, and the slot slides forward a slot at a time.
  const t0 = tickLedger(emptyLedger(), emptyLedger(), split(one), 0);
  assert.deepEqual(t0.ledger, { toasts: [], at: 0, slot: { key: keyOf('k1'), endsAt: 4000, shown: undefined } });
  const t4 = tickLedger(t0.ledger, emptyLedger(), split(one), 4000);
  assert.deepEqual(t4.ledger, { toasts: [], at: 4000, slot: { key: keyOf('k1'), endsAt: 8000, shown: undefined } });

  // `cLs`: a toast the store no longer holds keeps its remaining time ahead of the fresh ones.
  const held = tickLedger(emptyLedger(), stored(toast(keyOf('k1'), 4000)), split(one), 0).ledger;
  const merged = mergeQueued(held, stored(toast(keyOf('k9'), 700)));
  assert.deepEqual(merged.toasts.map((t: LedgerToast) => t.key), [keyOf('k1'), keyOf('k9')]);
  // Nothing stale to keep: the stored ledger comes back as it was.
  assert.deepEqual(mergeQueued({ toasts: [toast(keyOf('k1'), 1)], at: 0, slot: void 0 }, stored(toast(keyOf('k1'), 700))).toasts.map((t: LedgerToast) => t.key), [keyOf('k1')]);

  // `emptyLedger` is the source's frozen empty: the same value every call.
  assert.deepEqual(emptyLedger(), { toasts: [], at: 0, slot: undefined });

  // The split drops what is not a plugin toast, so a non-plugin key never reaches the tick.
  assert.deepEqual(split(notifications({ key: 'app-note' })).current, undefined);
  assert.deepEqual(split(notifications({ key: 'plugin-toast-1:fixture-bar', timeoutMs: 3000 })).current,
    { key: 'plugin-toast-1:fixture-bar', ms: 3000 });
});

test('the bodies beside the tick keep the bar\'s time accounts', () => {
  assert.equal(UNTOLD_MS_LIMIT, 50);

  // Managed toasts are laid out ahead of the rest.
  assert.deepEqual(managedFirst([toast('a', 1), toast('b', 1, { isManaged: true })]).map((t: LedgerToast) => t.key), ['b', 'a']);

  // `handOutTime`: the queue's time is taken from the front, what cannot be told is settled at the
  // 50 ms limit and reported lost with the time it had.
  const keeps = handOutTime(managedFirst([toast('a', 4000), toast('b', 1000)]), 1000);
  assert.deepEqual(keeps.kept.map((t: LedgerToast) => [t.key, t.leftMs, t.untoldMs]), [['a', 1000, 0], ['b', 0, 0]]);
  assert.deepEqual(keeps.lost.map((t: LedgerToast) => [t.key, t.leftMs, t.untoldMs]), [['a', 3000, 3000], ['b', 1000, 1000]]);
  const loses = handOutTime(managedFirst([toast('a', 4000), toast('b', 1000)]), 0);
  assert.deepEqual(loses.kept.map((t: LedgerToast) => [t.key, t.leftMs]), [['a', 0], ['b', 0]]);
  assert.deepEqual(loses.lost.map((t: LedgerToast) => [t.key, t.leftMs]), [['a', 4000], ['b', 1000]]);
  const untold = handOutTime(managedFirst([toast('a', 5, { untoldMs: 100 })]), 0);
  assert.deepEqual(untold.kept.map((t: LedgerToast) => [t.key, t.leftMs, t.untoldMs]), [['a', 0, 0]]);
  assert.deepEqual(untold.lost.map((t: LedgerToast) => [t.key, t.leftMs]), [['a', 105]]);

  // `ageOneTick` ages by the slot's elapsed time, `lentTime` by what one toast lent another.
  assert.deepEqual(
    ageOneTick({ toasts: [toast(keyOf('a'), 1000)], at: 100, slot: { key: keyOf('a'), endsAt: 1100 } }, split(notifications({ key: keyOf('a') })), 200)
      .map((t: LedgerToast) => t.leftMs),
    [900],
  );
  assert.equal(lentTime(toast('k1', 3000), slot('k1'), 1000).leftMs, 2000);
  assert.equal(lentTime(toast('k2', 3000), slot('k1'), 1000).leftMs, 3000);

  // The next ledger keeps the toasts still in the queue, and `runningSlot` is undefined with no
  // current toast.
  assert.deepEqual(keptToasts([toast('a', 1), toast('b', 2)], [{ key: 'b' }], new Set(['b'])).map((t: LedgerToast) => t.key), ['b']);
  assert.deepEqual(runningSlot(toast('k1', 1), 4000, 'k1'), { key: 'k1', endsAt: 4000, shown: 'k1' });
  assert.equal(runningSlot(undefined, 4000, undefined), undefined);

  // `laidOutTexts` reads each laid-out toast's own text by its place in the queue.
  assert.deepEqual([...laidOutTexts([toast('a', 1), toast('b', 1)], [{ text: 'x' }])], [['a', 'x']]);

  // Cut-short: shown to its plugin, or the managed toast losing its place.
  assert.equal(isToastCutShort({ toasts: [toast('k1', 1)] }, 'k1', false), false);
  assert.equal(isToastCutShort({ toasts: [toast('k1', 1, { wasShown: true })] }, 'k1', false), true);

  // A changed text replaces the entry's own, and an unchanged one comes back as it was.
  const entry = { key: 'k1', text: 'old' };
  assert.deepEqual(withChangedText(entry, new Map([['k1', 'new']])), { key: 'k1', text: 'new' });
  assert.equal(withChangedText(entry, new Map([['k1', 'old']])), entry);
  assert.equal(withChangedText(entry, new Map()), entry);

  // The notification refresh applies what the tick laid out, and hands the same bag back when no
  // text changed.
  const bag = notifications({ key: 'k1', text: 'old' } as never);
  const refreshed = refreshTexts(bag, new Map([['k1', 'new']]));
  assert.equal((refreshed.current as { text: string }).text, 'new');
  const held = notifications({ key: 'k1', text: 'held' } as never);
  assert.equal(refreshTexts(held, new Map([['k1', 'held']])), held, 'no changed text means the same bag');

  // A toast the bar had no time for logs its own line.
  clearChainRecords();
  reportLostTime({ key: 'kx', plugin: 'fixture-bar', leftMs: 7 });
  assert.deepEqual(
    chainRecords().filter((r) => r.kind === 'log').map((r) => (r as { message: string }).message),
    ['$.ui.toast (fixture-bar): kx lost 7 ms of its time, the notification bar having no toast time left for it'],
  );
});
