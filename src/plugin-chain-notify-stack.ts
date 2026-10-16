// The host toast method and the stack it keeps (W45-32). W45-26 took the `$.ui.toast` floor and its
// admission policy, W45-27 the bar's ledger, W45-28/29 its stored read and write, W45-30 the store's
// readers and W45-31 the clock driver; this package takes the other end of the same path — the host
// side that receives a plugin's toast, stacks it, trims it, arms the timer for it and reports the
// ones that leave before they were ever drawn.
//
// The copied bodies live in ./plugin-chain-notify-stack-source.ts (17 blocks, 2,268 units, three
// modules; ranges and per-block digests in research/ports/W45-notify-stack-blocks.plan.json). What
// stays here is the types and names a surface reads, and three notes the copy depends on:
//
//  * The stack is a plugin-state value under `Pye(IF)` = `{plugin: "engine", key: "toasts"}`
//    (chunk-sfn1dbxq.js `Ope` is the bar's own key, "bar-toasts"): `bu` reads it, `bh` writes it
//    back only when the trimmed stack differs from what it read (`$P`).
//  * `yvt` is the source's own id generator, `import{randomUUID as yvt}from"crypto"`; the copy
//    imports node:crypto's `randomUUID`.
//  * `g` inside `EEe` is the feature recorder (chunk-2hb5361r.js `function g(e,r){i("tengu_feature_ok",
//    {...r,feature_name:d(e)})}`), bound here to the host seam's `featureUsed`.
//
// The plugin label `Nle` is copied together with its sanitiser: `Mde` resolves through
// ./plugin-chain-plugin-label.ts to the copied body (W45-36), and the tab and ESC-sequence expander
// under it is copied too (W45-37), reusing the tokenizer this product already carried. Nothing on
// this path is a boundary any more, so a plugin's label is drawn whatever the id contains.
import { Pye } from './plugin-chain-notify-store-source.js';
import { it } from './plugin-chain-host.js';
import { createToastClock } from './plugin-chain-registry-state.js';
import {
  EEe, IF, MF, Nle, PF, RF, SKr, See, TC, aV, bh, bu, cI, fee, wee, yee, $P,
} from './plugin-chain-notify-stack-source.js';

/** One entry of the stack (`bh`'s element): the id the toast was given, the plugin it belongs to and
 *  the label that plugin is drawn under, where it sits and when it leaves. */
export interface ToastStackEntry {
  id: string;
  owner: string;
  plugin: string;
  isManaged: boolean;
  text: string;
  shownAt: number;
  leavesAt: number;
  phase: string;
  /** Set while the toast is held; the fold adds the held time to `leavesAt` (`MF`). */
  heldAt?: number;
}

/** What the host toast method receives (`EEe(h)`): the plugin, its text and how long it may stay. */
export interface ToastRequest {
  plugin: string;
  text: string;
  timeoutMs: number;
}

/** The toast clock the registry carries (`it().toastClock`): the timer the last push armed, and
 *  whether the bar is paused. The source's registry builds it with `edo()` and never leaves it
 *  unset, so the copied `TC` — `() => it().toastClock` — can read `pausedAt` on every push;
 *  `bindToastClock` is what a surface binds it with. */
export interface ToastClockHandle {
  pending?: { unref?: () => void };
  pausedAt?: number;
}

/** How long a toast stays in its leaving phase after its deadline passes (`RF`). */
export const TOAST_LEAVING_MS: number = RF;
/** How long a plugin may hold a toast before its deadline is re-based (`PF`). */
export const TOAST_HOLD_REBASE_MS: number = PF;
/** The label a plugin whose name resolves to nothing gets (`SKr`). */
export const PLUGIN_LABEL_FALLBACK: string = SKr;
/** The frozen array a stack read returns when the store holds no array (`fee`). */
export const EMPTY_TOAST_STACK: readonly ToastStackEntry[] = fee;
/** The plugin-state pair the stack is stored under (`IF`). */
export const TOAST_STACK_KEY: { plugin: string; key: string } = IF;

/** The plugin-state key the stack lives under (`Pye(IF)`), which `bu`/`bh` read and write. `IF`
 *  carries no `id`, the two-part form; the explicit `undefined` is the minified signature's. */
export function toastStackStateKey(): string {
  return Pye({ plugin: IF.plugin, key: IF.key, id: undefined }) as string;
}

/** The stack as stored (`bu`): the value under the key when it is an array, else the frozen empty one. */
export function readToastStack(): ToastStackEntry[] {
  return bu() as ToastStackEntry[];
}

/** The shallow list equality `bh` gates the store write on (`$P`). */
export function listEquals(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
  return $P(a, b) as boolean;
}

/** The per-plugin cap (`aV`): while a stack is longer than `ACn`, the largest group of non-managed
 *  toasts loses its oldest member, recursively. */
export function trimToastStack(entries: ToastStackEntry[]): ToastStackEntry[] {
  return aV(entries) as ToastStackEntry[];
}

/** The fold's transform (`MF`): a held toast's time is added to its deadline, a spent one leaves the
 *  stack, and one that just ran out gets `RF` more in its leaving phase. */
export function foldToastStack(entries: ToastStackEntry[], now: number): ToastStackEntry[] {
  return MF(entries, now) as ToastStackEntry[];
}

/** The stack writer (`bh`): trim, write the trimmed stack when it differs from the read one, report
 *  the entries that left without being drawn, then run the fold through `MF`. `now` is the source's
 *  own clock function (`() => number`), not a timestamp. */
export function writeToastStack(entries: ToastStackEntry[], now: () => number): void {
  bh(entries, now);
}

/** The push helper (`wee`): build the entry a plugin toast becomes — id from crypto's `randomUUID`,
 *  label from `Nle`, seat from `sOn`, deadlines from the toast clock — and write the stack. */
export function pushToast(request: ToastRequest, now: () => number = Date.now): void {
  wee(request, now);
}

/** The report for a toast that left the stack before it was drawn (`See`): the log line and the
 *  once-per-plugin notice. */
export function reportUndrawnToast(entry: ToastStackEntry): void {
  See(entry);
}

/** The timer arming (`yee`): one timer for the stack's next deadline, dropping the one before it,
 *  skipping while the bar is paused or the stack is empty, and unref-ing the handle. */
export function armToastTimer(now: () => number, run: () => void): void {
  yee(now, run);
}

/** The host toast method (`EEe`): remember the ids, push, and report whether the toast was stacked
 *  or the stack was already full. */
export function hostToast(request: ToastRequest): void {
  EEe(request);
}

/** The plugin label policy (`Nle`): the sanitiser's answer, or "unnamed" when it resolves to null. */
export function pluginLabel(plugin: string): string {
  return Nle(plugin) as string;
}

/** The ids that reached the bar (`cI`): the stack writer deletes an id from this set when it reports
 *  the toast as undrawn, so an id the bar drew is never reported. */
export function drawnToastIds(): Set<string> {
  return cI as Set<string>;
}

/** The clock handle the toast path arms (`it().toastClock`); a surface binds it with `bindToastClock`
 *  just as the fold's readers bind `renderVersions` and `panes`. */
export function toastClockHandle(): ToastClockHandle | null {
  return it().toastClock;
}

/** Bind a clock, or `null` to hand the registry a fresh one. The source's registry never carries a
 *  null clock — the copied `wee` reads `TC().pausedAt` on every push — so unbinding restores the
 *  factory's handle instead of leaving a state the source cannot reach. */
export function bindToastClock(handle: ToastClockHandle | null): void {
  it().toastClock = handle ?? createToastClock();
}

// The registry accessor the copied `TC` calls (`var TC=()=>it().toastClock;`), re-exported under the
// name a surface reads the clock handle by.
export { TC as toastClock };
