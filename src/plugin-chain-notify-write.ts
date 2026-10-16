// The notification bar's write half (W45-29). W45-27 took the ledger's arithmetic and W45-28 the key it
// is stored under, the schema and the read; this module is the other end: the toast append, the
// write-or-skip, and the plugin-state store's own set that both go through. The copied bodies live in
// ./plugin-chain-notify-write-source.ts (ranges and per-block digests in
// research/ports/W45-notify-write-blocks.plan.json).
//
// Where the write sits in the source: the host's toast method queues a toast, and the bar's clock driver
// (`TK`) calls `xYr(we.ledger)` (chunk-24k7d6mw.js [478823,…)) to keep the ledger it just laid out.
// `lLs` is the other entrance — a toast added straight to the stored ledger, with `isManaged` from the
// plugin's seat — and both end in `o5t`, the store's set.
//
// What is not here: the fold scheduler `vb` ends with (see plugin-chain-notify-store-runtime.ts), the
// `TK` clock driver and the host toast method's stacked path (`EEe`, chunk-24k7d6mw.js [173176,…)).
import {
  Ee, OFe, Zws, jde, lLs, o5t, sOn, vb, xYr,
} from './plugin-chain-notify-write-source.js';
import type { BarLedger } from './plugin-chain-notify.js';

/** One toast as the append path takes it: the key it was added under, its plugin, its text and the
 *  milliseconds the plugin asked for (`lLs` stores that as `leftMs`). */
export interface StoredToastInput {
  key: string;
  plugin: string;
  text: string;
  ms: number;
}

/** The seats that count as managed (`Zws`, `["prepend","append"]`): a toast whose plugin sits in one of
 *  them is engine-owned, which is what the bar lays out first (`Fpe`, W45-27). */
export const MANAGED_SEATS: readonly string[] = Zws;

/** The JSON-character ceiling the store's set enforces (`jde`, 4194304). */
export const STATE_VALUE_MAX_CHARS: number = jde;

/** A plugin's seat (`Ee`): its module record's tier, else the seat table, else "user". */
export function pluginSeat(plugin: string): string {
  return Ee(plugin) as string;
}

/** Whether a plugin's seat is one of `MANAGED_SEATS` (`sOn`) — the `isManaged` a stored toast carries. */
export function isManagedPlugin(plugin: string): boolean {
  return sOn(plugin) as boolean;
}

/** The store's set (`o5t`): JSON round-trip the value under `STATE_VALUE_MAX_CHARS`, take the next
 *  version from the stored one and the store's floor, write it frozen, and return the version. */
export function setStoredState(key: string, value: unknown): number {
  return o5t(key, value) as number;
}

/** Tell a key's readers it changed (`vb`). Nothing happens while the store's `readersOf` holds no reader
 *  for the key, which is every store this product builds today. */
export function notifyStateReaders(key: string): void {
  vb(key);
}

/** Append a toast to the stored ledger (`lLs`): the stored ledger, one toast longer, written back. */
export function appendStoredToast(toast: StoredToastInput): void {
  lLs(toast);
}

/** Keep a ledger (`xYr`): write it unless it and the stored one are both empty. A failed write logs
 *  `$.ui.toast: the bar's toasts were not kept: <reason>` and leaves the store alone. */
export function writeStoredLedger(ledger: BarLedger): void {
  xYr(ledger);
}

/** The deep freeze the stored value goes through (`OFe` over `cho`/`O`): every reachable node frozen,
 *  arrays and plain objects walked, deeper than `PQt` refused with a RangeError. */
export function deepFreezeValue<T>(value: T): T {
  return OFe(value) as T;
}

// The bodies beside the write, re-exported under the names a surface reads them by. Each is the source
// body verbatim from ./plugin-chain-notify-write-source.ts:
//
//   · `freezeWalk` (`cho`, value, seen) — walk the value with `freezeCursor` and freeze its leaves.
//   · `freezeCursor` (`O`, value, seen, below) — the walk's cursor over arrays and plain objects.
export {
  cho as freezeWalk,
  O as freezeCursor,
} from './plugin-chain-notify-write-source.js';
