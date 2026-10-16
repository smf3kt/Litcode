// The bar's mount layer (W45-38): the two effects the source's bar component runs over the ported
// clock tick, and the keys that decide when they run again.
//
// Source: the bar component in chunk-24k7d6mw.js — `JFe` [479208,479514) and the pane hold `XFe`
// [479518,479736). Both are React hooks, and this product has no React, so the seam keeps each body's
// own logic and takes the host layers as parameters:
//
//   `JFe` reads `h = on()` (the clock context), `T = kr()` (the store handle), makes the two refs
//   `M = R(void 0)` and `L = R(RYr)`, derives `ee = V((Te) => [Te.notifications.current,
//   ...Te.notifications.queue].map((Me) => Me?.key).join(" "))`, `he = V(Cj)` — the same state through
//   the hidden test in ./plugin-chain-notify-clock.ts — and `we = Re(s_().values, (Te) =>
//   SEt(Te).toasts.map((Me) => Me.key).join(" "))`, then mounts one effect:
//   `P(() => (TK({clock: h, store: T, pending: M, last: L}), () => M.current?.()), [h, T, ee, he, we])`.
//   So: one tick on mount, the canceller it armed on cleanup, and the whole thing again whenever one of
//   those five changes. The refs survive a dependency change and are dropped on unmount, which is why
//   the driver is created once per mounted bar and the ledger carries across.
//
//   `XFe` reads `h = Re(Ri(), gro)` (whether the shown pane holds toasts), `T = Mn()` (the store's
//   setter) and `{processQueue: M} = vo()`, then `P(() => { if (!h) return;
//   T((L) => L.paneHoldsToasts ? L : { ...L, paneHoldsToasts: !0 }); return () => {
//   T((L) => L.paneHoldsToasts ? { ...L, paneHoldsToasts: !1 } : L); M(); } }, [h, T, M])` — raise the
//   hold while a pane holds toasts, and on release clear it and drain the queue.
//
// The copied pane read is in ./plugin-chain-bar-mount-source.ts (`YAt` and `gro`, chunk-tvdq3hrk.js
// [7622,7723), 101 units). `TK` and `Cj` are already ported (W45-31), as are `SEt`/`RYr` (W45-28).
// What is left as the host boundary is the React subscription itself (`on`, `kr`, `V`, `Re`, `P`) and
// the queue drain `processQueue`, which comes from the notification context `vo`
// (chunk-356hrhz3.js [1735,5205), 3,470 units — it owns `addNotification` and `removeNotification` as
// well, and is the next package on the queue). Everything between them is the source's.
import { SEt } from './plugin-chain-notify-store-source.js';
import { emptyLedger } from './plugin-chain-notify.js';
import type { BarLedger } from './plugin-chain-notify.js';
import type { PluginStateStore } from './plugin-chain-host.js';
import { runClockTick } from './plugin-chain-notify-clock.js';
import type { BarClock, BarState, BarStore } from './plugin-chain-notify-clock.js';
import { gro } from './plugin-chain-bar-mount-source.js';

/** The two refs `JFe` makes before the tick (`M = R(void 0)`, `L = R(RYr)`), one pair per mounted bar:
 *  `pending` holds the canceller the last tick armed, `last` the ledger it left — the source's refs
 *  live as long as the component instance does, so a bar that re-mounts starts from the empty ledger. */
export interface BarClockDriver {
  pending: { current?: (() => void) | undefined };
  last: { current: BarLedger };
}

/** The five members of the source's dependency array, in order: the clock handle, the store handle, and
 *  the three values its two selectors and its hidden test derive off the state. */
export interface BarClockDriverDeps {
  clock: unknown;
  store: unknown;
  /** `ee`: the keys of the current notification and the queue, joined. */
  notificationKeys: string;
  /** `he`: `Cj(state)`, which is `undefined` when the state carries neither flag. */
  hidden: boolean | undefined;
  /** `we`: the keys of the stored ledger's toasts, joined. */
  storedToastKeys: string;
}

/** The pane state `gro` reads: how many placements the surface has, the panes it has open, and which
 *  one it is showing. */
export interface PaneHoldState {
  placements: number;
  open: Array<{ id: string; holdToasts?: boolean }>;
  shownId?: string | null;
}

/** The keys the bar's notification list holds (`ee`): the current toast's, then the queue's. A slot
 *  with nothing in it contributes the empty string `join` gives `undefined`. */
export function barNotificationKeys(state: BarState): string {
  const { current, queue } = state.notifications;
  return [current, ...queue].map((toast) => toast?.key).join(' ');
}

/** The keys the stored ledger holds (`we`): `SEt` of the store's own state, so it reads the same
 *  plugin-state entry `readStoredLedger` does, from the state a subscriber was handed. */
export function storedToastKeys(values: ReturnType<PluginStateStore['values']['getState']>): string {
  const ledger = SEt(values) as BarLedger;
  return ledger.toasts.map((toast) => toast.key).join(' ');
}

/** Whether the effect has to run again: React compares each member of `[h, T, ee, he, we]` with
 *  `Object.is`, so this is that comparison for a host with no dependency array of its own. `null` for
 *  the previous value is the mount, which always runs the effect. */
export function barClockDriverChanged(
  previous: BarClockDriverDeps | null,
  next: BarClockDriverDeps,
): boolean {
  if (previous === null) return true;
  return !Object.is(previous.clock, next.clock)
    || !Object.is(previous.store, next.store)
    || !Object.is(previous.notificationKeys, next.notificationKeys)
    || !Object.is(previous.hidden, next.hidden)
    || !Object.is(previous.storedToastKeys, next.storedToastKeys);
}

/** The refs a mounted bar ticks with (`M = R(void 0)`, `L = R(RYr)`). */
export function createBarClockDriver(): BarClockDriver {
  return { pending: { current: undefined }, last: { current: emptyLedger() } };
}

/** One run of the effect the bar mounts (`P`): tick the driver once, and hand back what the source
 *  returns — `() => M.current?.()`, the canceller the tick armed. The source runs this again when
 *  `barClockDriverChanged` says the five members changed, after the previous cleanup; the driver, and
 *  with it the ledger the last tick left, stays the caller's. The source never clears `M.current`, so
 *  a timer's canceller can run twice — `clearTimeout` on an already-cancelled handle is a no-op, and
 *  the product's clock (`mIr`) is that. */
export function mountBarClockDriver(driver: BarClockDriver, clock: BarClock, store: BarStore): () => void {
  runClockTick({ clock, store, pending: driver.pending, last: driver.last });
  return () => driver.pending.current?.();
}

/** Whether the pane a surface is showing holds the toasts (`gro`) — `Re(Ri(), gro)` in the source
 *  selects this off the panes store; here the store's state is the argument. */
export function readPaneHold(state: PaneHoldState): boolean {
  return gro(state) as boolean;
}

/** `XFe`'s effect: while a pane holds toasts, raise `paneHoldsToasts` — and where the state already
 *  carries it, keep the very same object, because the source's updater returns `L` untouched. On
 *  release, clear it and drain the queue (`processQueue`), in that order. A bar with no hold gets the
 *  inert cleanup the source's `if (!h) return;` gives it. */
export function holdPaneToasts(options: {
  holds: boolean;
  store: BarStore;
  drain: () => void;
}): () => void {
  if (!options.holds) return () => {};
  options.store.setState((state) => (state.paneHoldsToasts ? state : { ...state, paneHoldsToasts: true }));
  return () => {
    options.store.setState((state) => (state.paneHoldsToasts ? { ...state, paneHoldsToasts: false } : state));
    options.drain();
  };
}
