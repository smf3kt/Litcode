// W45-31 measurements before any assertion: what one tick of the bar's clock driver does — the ledger
// it writes, the state it leaves, the texts it refreshes, the timer it arms and the one it cancels.
import { bindPluginState, emptyLedger, readStoredLedger } from '../src/plugin-chain-notify.js';
import type { BarLedger } from '../src/plugin-chain-notify.js';
import { appendStoredToast } from '../src/plugin-chain-notify-write.js';
import { TOAST_FALLBACK_TIMEOUT_MS, isBarHidden, runClockTick } from '../src/plugin-chain-notify-clock.js';
import type { BarClock, BarState, BarStore } from '../src/plugin-chain-notify-clock.js';

const NOW = 1_000_000;
const key = 'plugin-toast-1:fixture-p';
const toast = { key, plugin: 'fixture-p', text: 'hello', timeoutMs: 4000 };

function state(over: Partial<BarState> = {}): BarState {
  return { notifications: { current: toast, queue: [] }, diffPanelVisible: false, paneHoldsToasts: false, ...over };
}

function makeStore(initial: BarState) {
  let current = initial;
  const writes: string[] = [];
  const store: BarStore = {
    getState: () => current,
    setState: (update) => {
      const next = update(current);
      writes.push(next === current ? 'same' : JSON.stringify(next.notifications));
      current = next;
    },
  };
  return { store, writes, state: () => current };
}

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

const stored = new Map<string, { value: unknown; version: number }>();
const offState = bindPluginState({
  values: {
    getState: () => ({ get: (k: string) => stored.get(k) }),
    setState: (update) => { for (const [k, v] of update(new Map(stored))) stored.set(k, v); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});

console.log('fallback timeout:', TOAST_FALLBACK_TIMEOUT_MS, '| hidden tests:', isBarHidden(state()), isBarHidden(state({ diffPanelVisible: true })), isBarHidden(state({ paneHoldsToasts: true })));

// A toast the plugin appended straight to the stored ledger (W45-29), then a tick on the clock.
appendStoredToast({ key, plugin: 'fixture-p', text: 'hello', ms: 1500 });
const a = makeStore(state());
const aClock = makeClock(NOW);
const aPending: { current?: () => void } = {};
const aLast: { current: BarLedger } = { current: emptyLedger() };
runClockTick({ clock: aClock.clock, store: a.store, pending: aPending, last: aLast });
console.log('tick 1: stored before tick', JSON.stringify(readStoredLedger()));
console.log('tick 1: ledger', JSON.stringify(aLast.current));
console.log('tick 1: stored after tick', JSON.stringify(readStoredLedger()));
console.log('tick 1: state writes', JSON.stringify(a.writes), '| notifications', JSON.stringify(a.store.getState().notifications));
console.log('tick 1: armed', JSON.stringify(aClock.armed.map((entry) => entry.ms)), '| cancelled', JSON.stringify(aClock.cancelled), '| pending set', aPending.current !== undefined);

// Tick 2 at the armed delay: the pending canceller runs first, and the toast ages by the elapsed time.
const armedFirst = aClock.armed[0];
aClock.advance(1000);
armedFirst.fire();
console.log('tick 2: cancelled', JSON.stringify(aClock.cancelled), '| armed', JSON.stringify(aClock.armed.map((entry) => entry.ms)));
console.log('tick 2: ledger', JSON.stringify(aLast.current));
console.log('tick 2: stored leftMs', readStoredLedger().toasts.map((t) => t.leftMs));

// A bar with nothing to show: no timer armed at all.
const c = makeStore(state({ notifications: { current: null, queue: [] } }));
const cClock = makeClock(NOW);
const cPending: { current?: () => void } = {};
const cLast: { current: BarLedger } = { current: emptyLedger() };
runClockTick({ clock: cClock.clock, store: c.store, pending: cPending, last: cLast });
console.log('idle: armed', JSON.stringify(cClock.armed), '| pending set', cPending.current !== undefined, '| ledger', JSON.stringify(cLast.current));

// The texts the tick refreshes when the plugin's text changed since the queue was built.
const d = makeStore(state({ notifications: { current: { ...toast, text: 'rewritten' }, queue: [] } }));
const dClock = makeClock(NOW);
const dLast: { current: BarLedger } = { current: emptyLedger() };
runClockTick({ clock: dClock.clock, store: d.store, pending: {}, last: dLast });
console.log('texts: state writes', JSON.stringify(d.writes), '| notifications', JSON.stringify(d.store.getState().notifications));
offState();
