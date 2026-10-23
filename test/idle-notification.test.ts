import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_IDLE_NOTIF_THRESHOLD_MS, IdleNotifier } from '../src/idle-notification.js';

/** A manual clock and timer list, so each arm runs without waiting on wall time. */
function harness() {
  let now = 1_000, completion = 0, submits = 0, loading = false, interaction = 0;
  const timers: { at: number; callback: () => void; cancelled: boolean }[] = [];
  let dialog = false, loop = false, quota = false, agents = false;
  const listeners = new Set<() => void>();
  let sent = 0, threshold = 60_000;
  const host = {
    now: () => now,
    setTimeout: (callback: () => void, milliseconds: number) => {
      const timer = { at: now + milliseconds, callback, cancelled: false };
      timers.push(timer);
      return { cancel: () => { timer.cancelled = true; } };
    },
    snapshot: () => ({ isLoading: loading, submitCount: submits, lastQueryCompletionTime: completion }),
    lastInteractionTime: () => interaction,
    isDialogOnScreen: () => dialog,
    hasPendingLoopWakeup: () => loop,
    hasArmedQuotaAutoResume: () => quota,
    liveBackgroundAgents: () => agents,
    subscribeBackgroundAgents: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    thresholdMs: () => threshold,
    send: () => { sent += 1; },
  };
  const notifier = new IdleNotifier(host);
  return {
    notifier, host,
    get sent() { return sent; },
    get timerCount() { return timers.filter(timer => !timer.cancelled).length; },
    submit() { loading = true; submits += 1; notifier.refresh(); },
    complete(at = now) { loading = false; completion = at; notifier.refresh(); },
    advance(milliseconds: number) {
      now += milliseconds;
      for (const timer of timers) {
        if (timer.cancelled || timer.at > now) continue;
        timer.cancelled = true;
        timer.callback();
      }
    },
    setInteraction(value: number) { interaction = value; },
    setDialog(value: boolean) { dialog = value; },
    setLoop(value: boolean) { loop = value; },
    setQuota(value: boolean) { quota = value; },
    setAgents(value: boolean) { agents = value; listeners.forEach(listener => listener()); },
    setThreshold(value: number) { threshold = value; },
  };
}

test('the idle notification arms only after a completed turn and fires once per completion', () => {
  const h = harness();
  h.notifier.refresh();
  h.advance(120_000);
  assert.equal(h.sent, 0, 'no submitted turn, no notification');
  h.submit();
  h.advance(120_000);
  assert.equal(h.sent, 0, 'a running turn arms nothing');
  h.complete(1_000);
  h.advance(59_999);
  assert.equal(h.sent, 0);
  h.advance(1);
  assert.equal(h.sent, 1);
  h.advance(600_000);
  assert.equal(h.sent, 1, 'one notification per completion time');
  h.complete(700_000);
  h.advance(60_000);
  assert.equal(h.sent, 2);
  h.notifier.dispose();
});

test('input after the completion cancels the pending notification', () => {
  const h = harness();
  h.submit(); h.complete(1_000);
  h.setInteraction(1_500);
  h.advance(60_000);
  assert.equal(h.sent, 0);
  h.notifier.dispose();
});

test('an open dialog, an armed loop wakeup and an armed quota resume all suppress the notification', () => {
  for (const guard of ['dialog', 'loop', 'quota'] as const) {
    const h = harness();
    h.submit(); h.complete(1_000);
    if (guard === 'dialog') h.setDialog(true);
    if (guard === 'loop') h.setLoop(true);
    if (guard === 'quota') h.setQuota(true);
    h.advance(60_000);
    assert.equal(h.sent, 0, guard);
    h.notifier.dispose();
  }
});

test('a live background agent defers until the registry reports none, then re-arms', () => {
  const h = harness();
  h.submit(); h.complete(1_000);
  h.setAgents(true);
  h.advance(60_000);
  assert.equal(h.sent, 0);
  assert.equal(h.timerCount, 0, 'the pending timer is replaced by the registry subscription');
  h.setAgents(false);
  assert.equal(h.timerCount, 1, 'the subscription re-arms the timer');
  h.advance(60_000);
  assert.equal(h.sent, 1);
  h.notifier.dispose();
});

test('the configured threshold replaces the recovered 60000 default and the composer overlay suppresses', () => {
  const h = harness();
  h.setThreshold(5_000);
  h.submit(); h.complete(1_000);
  h.advance(4_999);
  assert.equal(h.sent, 0);
  h.advance(1);
  assert.equal(h.sent, 1);
  h.notifier.setLocalOverlayShowing(true);
  h.complete();
  h.advance(5_000);
  assert.equal(h.sent, 1, 'an overlay is not idle');
  h.notifier.setLocalOverlayShowing(false);
  h.advance(5_000);
  assert.equal(h.sent, 2, 'clearing the overlay re-arms the same completion');
  h.notifier.dispose();
  assert.equal(DEFAULT_IDLE_NOTIF_THRESHOLD_MS, 60_000);
});

test('a disposed notifier arms nothing', () => {
  const h = harness();
  h.submit(); h.complete(1_000);
  h.notifier.dispose();
  assert.equal(h.timerCount, 0);
  h.advance(120_000);
  assert.equal(h.sent, 0);
});
