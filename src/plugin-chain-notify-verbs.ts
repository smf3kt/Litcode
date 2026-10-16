// The toast module's remaining verbs (W45-33): the four public calls that sit beside the stack
// W45-32 ported — dismiss a toast, expire the stack now, hold or release one, and pause or resume the
// whole bar. With them, the module's exported surface this product can reach is complete except its
// clock factory `edo` (`createToastClock`, chunk-3ph567jx.js), which belongs with the registry's
// stores: `TC` reads `it().toastClock`, and the field is built by that factory.
//
// The copied bodies live in ./plugin-chain-notify-verbs-source.ts (4 blocks, 681 units, one module;
// ranges and per-block digests in research/ports/W45-notify-verbs-blocks.plan.json). Every free name
// they read is already ported — `bu`, `cI`, `bh`, `MF` from ./plugin-chain-notify-stack-source.js and
// the clock accessor `TC` — which is how the package's boundary was chosen (evidence:
// research/ports/W45-notify-verbs-evidence.json).
import { IEe, bee, dV, pvt } from './plugin-chain-notify-verbs-source.js';

/** What `dV` receives: the entry to hold or release. */
export interface ToastHold {
  id: string;
  isHeld: boolean;
}

/** What `bee` receives: whether the bar is paused. */
export interface ToastPause {
  isPaused: boolean;
}

/** Dismiss one toast (`IEe`): drop it from the stack, remember the id in `cI` so it is never reported
 *  as undrawn, and write — a stack that did not hold the id is left exactly as it was. */
export function dismissToast(id: string, now: () => number = Date.now): void {
  IEe(id, now);
}

/** Expire the stack now (`pvt`): fold it through `MF` and write the result through `bh`. */
export function expireToasts(now: () => number): void {
  pvt(now);
}

/** Hold or release one toast (`dV`): holding stamps `heldAt` and returns the entry to its shown
 *  phase; releasing drops `heldAt` and adds the held time to the deadline. The stack is written only
 *  when an entry actually changed. */
export function holdToast(change: ToastHold, now: () => number = Date.now): void {
  dV(change, now);
}

/** Pause or resume the bar (`bee`): the clock's `pausedAt` is set to now (or cleared), and every
 *  deadline — and every `heldAt` — moves by the time that passed since the clock last changed. A call
 *  that does not change the pause state writes nothing. */
export function pauseToasts(pause: ToastPause, now: () => number = Date.now): void {
  bee(pause, now);
}
