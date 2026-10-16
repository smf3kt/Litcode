// The notification bar's clock driver (W45-31): `TK`, the tick a surface runs on its own clock. W45-27
// took the ledger's arithmetic, W45-28/29 the stored read and write, W45-26 the toast split; this
// module is the body that puts them in order on a timer.
//
// The copied bodies live in ./plugin-chain-notify-clock-source.ts (ranges and per-block digests in
// research/ports/W45-notify-clock-blocks.plan.json). The source calls it from the bar component
// (chunk-24k7d6mw.js [479440,…): `P(() => (TK({clock: h, store: T, pending: M, last: L}), () =>
// M.current?.()), …)`), where `h` is the host's clock facade, `T` the bar's state store and `M`/`L`
// two refs. Nothing here is rewritten: the seam types that handle and names the two bodies.
//
// The clock contract is the source's own (`mIr`/`nS` in ./plugin-chain-stream-source.ts): `now()` and a
// `setTimeout(fn, ms)` that returns the canceller `TK` keeps in `pending.current` and calls before it
// writes — `L.current?.()` in the copied body.
import { Sqt } from './plugin-chain-toast-source.js';
import { Cj as barsHidden, TK } from './plugin-chain-notify-clock-source.js';
import type { BarLedger } from './plugin-chain-notify.js';

/** One toast as the bar's state holds it (`notifications.current` / `notifications.queue`). */
export interface BarToast {
  key: string;
  timeoutMs?: number;
}

/** The bar's own state, as much of it as the tick reads and writes. */
export interface BarState {
  notifications: { current: BarToast | null; queue: BarToast[] };
  /** `Cj` reads these two: while either holds, the bar counts as hidden. */
  diffPanelVisible?: boolean;
  paneHoldsToasts?: boolean;
  [field: string]: unknown;
}

/** The store the driver ticks (`M`): read for the queue, written back with the laid-out texts. */
export interface BarStore {
  getState: () => BarState;
  setState: (update: (state: BarState) => BarState) => void;
}

/** The clock the driver ticks on (`h`): `now()`, and a `setTimeout` whose return value cancels it —
 *  the source's own clock facade (`mIr`), whose `setTimeout` returns `() => clearTimeout(timer)`. */
export interface BarClock {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => () => void;
}

/** What one tick is given: the clock, the store, the ref holding the pending canceller, and the ref
 *  holding the ledger the last tick left. */
export interface BarTickHandle {
  clock: BarClock;
  store: BarStore;
  pending: { current?: (() => void) | undefined };
  last: { current: BarLedger };
}

/** The toast timeout a plugin that asked for none gets (`Sqt`, 4000) — the split's fallback. */
export const TOAST_FALLBACK_TIMEOUT_MS: number = Sqt;

/** Whether the bar counts as hidden (`Cj`): a diff panel is visible, or the pane holds toasts. */
export function isBarHidden(state: BarState): boolean {
  return barsHidden(state) as boolean;
}

/** One tick (`TK`): split the queue, tick the stored ledger against it, cancel the pending timer, write
 *  the ledger, report lost time, refresh the queue's texts, and arm the next tick at the delay the
 *  ledger gives (keeping only the first canceller). */
export function runClockTick(handle: BarTickHandle): void {
  TK(handle);
}

// The split the tick opens with (`sLs`), re-exported under the name a surface reads it by; its body is
// the toast module's (W45-26).
export { sLs as splitToastQueue } from './plugin-chain-toast-source.js';
