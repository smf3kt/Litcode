// W45-38 probe: measure the bar's mount layer off the ported bodies before the regression asserts it.
// Prints the selectors' answers, the effect's arming and cancelling, the pane read and the hold's two
// transitions; also recomputes the two copied blocks against the chunk they came from.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { bindPluginState, barStateKey, emptyLedger, readStoredLedger } from '../src/plugin-chain-notify.js';
import { appendStoredToast } from '../src/plugin-chain-notify-write.js';
import { isBarHidden } from '../src/plugin-chain-notify-clock.js';
import {
  barClockDriverChanged, barNotificationKeys, createBarClockDriver, holdPaneToasts, mountBarClockDriver,
  readPaneHold, storedToastKeys,
} from '../src/plugin-chain-bar-mount.js';
import { YAt, gro } from '../src/plugin-chain-bar-mount-source.js';
import type { BarClock, BarState, BarStore } from '../src/plugin-chain-notify-clock.js';

const NOW = 1_000_000;
const KEY = 'plugin-toast-1:fixture-p';
const TOAST = { key: KEY, plugin: 'fixture-p', text: 'hello', timeoutMs: 4000 };
const state = (over: Partial<BarState> = {}): BarState =>
  ({ notifications: { current: TOAST, queue: [] }, diffPanelVisible: false, paneHoldsToasts: false, ...over });

const bar = (() => {
  let current = state();
  const updaters: Array<(s: BarState) => BarState> = [];
  const store: BarStore = { getState: () => current, setState: (u) => { updaters.push(u); current = u(current); } };
  return { store, updaters, state: () => current };
})();
const clock = (() => {
  const armed: { ms: number; fire: () => void }[] = [];
  const cancelled: number[] = [];
  let now = NOW;
  const c: BarClock = { now: () => now, setTimeout: (fn, ms) => { armed.push({ ms, fire: fn }); return () => { cancelled.push(ms); }; } };
  return { c, armed, cancelled, advance: (ms: number) => { now += ms; } };
})();
const stored = new Map<string, { value: unknown; version: number }>();
const off = bindPluginState({
  values: {
    getState: () => ({ get: (k: string) => stored.get(k) }),
    setState: (u) => { for (const [k, v] of u(new Map(stored))) stored.set(k, v); },
  },
  versionFloor: 0,
  readersOf: new Map(),
});
const values = () => ({ get: (k: string) => stored.get(k) });

console.log('notificationKeys plain      ', JSON.stringify(barNotificationKeys(state())));
console.log('notificationKeys current+queue', JSON.stringify(barNotificationKeys(state({ notifications: { current: { key: 'a' }, queue: [{ key: 'b' }, { key: 'c' }] } }))));
console.log('notificationKeys null current', JSON.stringify(barNotificationKeys(state({ notifications: { current: null, queue: [{ key: 'a' }] } }))));
console.log('notificationKeys empty      ', JSON.stringify(barNotificationKeys(state({ notifications: { current: null, queue: [] } }))));
console.log('storedToastKeys empty       ', JSON.stringify(storedToastKeys(values())));

appendStoredToast({ key: KEY, plugin: 'fixture-p', text: 'hello', ms: 1500 });
appendStoredToast({ key: 'plugin-toast-2:fixture-p', plugin: 'fixture-p', text: 'again', ms: 1500 });
console.log('storedToastKeys two         ', JSON.stringify(storedToastKeys(values())));

const deps = { clock: {}, store: {}, notificationKeys: 'a', hidden: false, storedToastKeys: 'a' };
console.log('changed null->deps          ', barClockDriverChanged(null, deps));
console.log('changed equal               ', barClockDriverChanged(deps, { ...deps }));
console.log('changed hidden undefined    ', barClockDriverChanged(deps, { ...deps, hidden: undefined }));
console.log('hidden for bare state       ', isBarHidden({ notifications: { current: null, queue: [] } }));

const driver = createBarClockDriver();
console.log('driver last is empty ledger ', JSON.stringify(driver.last.current) === JSON.stringify(emptyLedger()));
const cleanup = mountBarClockDriver(driver, clock.c, bar.store);
console.log('after mount armed           ', JSON.stringify(clock.armed.map((e) => e.ms)));
console.log('after mount cancelled       ', JSON.stringify(clock.cancelled));
console.log('after mount ledger toasts   ', JSON.stringify(driver.last.current.toasts.map((t) => [t.key, t.leftMs])));
console.log('after mount ledger at       ', driver.last.current.at - NOW);
console.log('stored ledger equals driver ', JSON.stringify(readStoredLedger()) === JSON.stringify(driver.last.current));
console.log('bar updaters after mount    ', bar.updaters.length, JSON.stringify(bar.state().notifications.current?.key));
cleanup();
console.log('after cleanup cancelled     ', JSON.stringify(clock.cancelled));

clock.advance(1000);
clock.armed[0].fire();
console.log('after fire armed            ', JSON.stringify(clock.armed.map((e) => e.ms)));
console.log('after fire cancelled        ', JSON.stringify(clock.cancelled));
console.log('after fire ledger           ', JSON.stringify(driver.last.current.toasts.map((t) => t.leftMs)),
  'at', driver.last.current.at - NOW);
const beforeRerun = JSON.stringify(driver.last.current);
const second = mountBarClockDriver(driver, clock.c, bar.store);
console.log('re-run cancelled            ', JSON.stringify(clock.cancelled));
console.log('re-run armed                ', JSON.stringify(clock.armed.map((e) => e.ms)));
console.log('re-run kept the ledger      ', beforeRerun === JSON.stringify(driver.last.current) || JSON.stringify(driver.last.current.toasts.map((t) => t.leftMs)));
console.log('re-run ledger at            ', driver.last.current.at - NOW);
second();

console.log('pane hold shown holds       ', readPaneHold({ placements: 2, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }));
console.log('pane hold no placements     ', readPaneHold({ placements: 0, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }));
console.log('pane hold other pane holds  ', readPaneHold({ placements: 1, open: [{ id: 'a' }, { id: 'b', holdToasts: true }], shownId: 'a' }));
console.log('pane hold no shown pane     ', readPaneHold({ placements: 1, open: [{ id: 'a' }], shownId: 'b' }));
console.log('YAt misses                   ', YAt({ open: [{ id: 'a' }], shownId: 'a' }));
console.log('gro direct                   ', gro({ placements: 1, open: [{ id: 'a', holdToasts: true }], shownId: 'a' }));

const before = bar.updaters.length;
const inert = holdPaneToasts({ holds: false, store: bar.store, drain: () => { console.log('inert drained'); } });
console.log('hold inert updaters          ', bar.updaters.length - before);
inert();
let drained = 0;
const release = holdPaneToasts({ holds: true, store: bar.store, drain: () => { drained += 1; } });
console.log('hold raised flag             ', bar.state().paneHoldsToasts, 'updaters', bar.updaters.length - before);
const raisedState = bar.state();
console.log('re-raise keeps the object    ', bar.updaters[bar.updaters.length - 1](raisedState) === raisedState);
console.log('hidden while held            ', isBarHidden(bar.state()));
release();
console.log('release flag                 ', bar.state().paneHoldsToasts, 'drained', drained);
const downState = bar.state();
console.log('re-release keeps the object  ', bar.updaters[bar.updaters.length - 1](downState) === downState);

const chunk = readFileSync('extracted-v2/modules/chunk-tvdq3hrk.js', 'utf8');
for (const [name, a, b] of [['YAt', 7622, 7670], ['gro', 7670, 7723]] as const) {
  const text = chunk.slice(a, b);
  console.log(`${name} body sha256`, createHash('sha256').update(text).digest('hex'), JSON.stringify(text));
}
off();
