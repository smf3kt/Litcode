// The plugin-state store's reactivity (W45-30): the fold scheduler `Ci` that `vb` (W45-29) hands a
// changed key's readers to, and the cluster it drives — the two paces (live/steady), the throttle that
// forces a throttled reader back to steady, the classifier that decides a reader's pace from its
// instance, the one-shot fold run, the stale/reader fan-out and the render-version bump.
//
// The copied bodies live in ./plugin-chain-notify-fold-source.ts (ranges and per-block digests in
// research/ports/W45-notify-fold-blocks.plan.json). Nothing here is rewritten: the seam only puts
// product-typed names on the copied bodies and binds the two registry stores they read.
//
// Where this sits in the source: a plugin-state write (`o5t`) ends in `vb`, which collects the key's
// readers and calls `Ci`. `Ci` marks each reader stale in its pace's fold and then either runs that
// fold or arms its timer for the rest of the interval; `MAt` resolves the stale keys to readers,
// bumps their render versions (`vi` over `it().renderVersions`) and hands their instances to the
// stores' stale listeners.
//
// What is not here: the `gs(...)` store factory the registry's own literal builds its stores with (this
// product's registry carries `null` until a surface binds one, as with `pluginState`), and `yNs`/`Uf` —
// the other pace machinery at the same site, which the fold scheduler does not use.
import {
  A_ as isThrottledAt, Ci, FDn, HAt, MAt, OL, Of as paceOf, P_, Ql, Rc, Ri, Wf, Zl,
  ec as throttleUntil, jf, vi, vc, Y4t, zf,
} from './plugin-chain-notify-fold-source.js';
import type { PluginStateFold, PluginStateReader, PluginStateStore, RegistryStore } from './plugin-chain-host.js';
import { it } from './plugin-chain-host.js';

/** The two paces a reader can fold at, with their intervals (`Wf` over `HAt`/`nc`): 100ms steady,
 *  34ms live. */
export const FOLD_INTERVAL_MS: Readonly<Record<'steady' | 'live', number>> = Wf as Record<'steady' | 'live', number>;

/** The interval a reader folds at when it is throttled back from live (`HAt`). */
export const STEADY_FOLD_INTERVAL_MS: number = HAt;

/** How long a throttled reader stays throttled (`P_`, 1000ms). */
export const READER_THROTTLE_MS: number = P_;

/** The suffix a render-version key carries (`Rc`, `"\x00state"`). */
export const RENDER_VERSION_SUFFIX: string = Rc;

/** The frozen initial panes state (`FDn`), the value a panes store starts from. */
export const INITIAL_PANES_STATE: unknown = FDn;

/** The throttle table (`Zl`) — every reader stamped until a time; `A_` reads it, `ec` writes it. */
export const readerThrottleTable: Map<unknown, number> = Zl as Map<unknown, number>;

/** Whether a reader is inside its throttle window at `now` (`A_`). */
export function isReaderThrottled(reader: unknown, now: number): boolean {
  return isThrottledAt(reader, now) as boolean;
}

/** Stamp readers as throttled until `now + READER_THROTTLE_MS` (`ec`). */
export function throttleReaders(reader: Iterable<unknown>, now: number = Date.now()): void {
  throttleUntil(reader, now);
}

/** A reader's pace (`Of`): "live" only when its instance is a terminal AbovePrompt (`Ql`), a
 *  PromptHint, or the pane the store shows (`Ri`), else "steady". */
export function readerPace(instance: unknown): 'live' | 'steady' {
  return paceOf(instance) as 'live' | 'steady';
}

/** Whether the AbovePrompt instance counts as live (`Ql` over the `Y4t` flag store). */
export function abovePromptReaderIsLive(): boolean {
  return Ql() as boolean;
}

/** The flag store behind `Ql` (`Y4t` itself, not a second `bs()`): a surface sets `true` to take the
 *  AbovePrompt reader off the live pace. Unset, `Ql()` is true and AbovePrompt folds live. */
export const abovePromptFlag = Y4t as { set: (value: unknown) => void; get: () => unknown };

/** A render-version key (`jf`): the key a bump is written under. */
export function renderVersionKey(key: string): string {
  return jf(key) as string;
}

/** The render-version store the bump writes into (`OL` → `it().renderVersions`). */
export function renderVersionsStore(): RegistryStore<Map<string, number>> | null {
  return OL() as RegistryStore<Map<string, number>> | null;
}

/** The panes store a reader's `requestId` is checked against (`Ri` → `it().panes`). */
export function panesStore(): RegistryStore<{ shownId?: string | null }> | null {
  return Ri() as RegistryStore<{ shownId?: string | null }> | null;
}

/** Bump render versions (`vi`): one counter per store, written under every `renderVersionKey`. */
export function bumpRenderVersions(keys: string[], store: PluginStateStore): void {
  vi(keys, store);
}

/** Fan a fold's readers out (`vc`): bump their keys, then hand every instance to the stale listeners. */
export function fireStaleListeners(readers: Map<string, PluginStateReader>, store: PluginStateStore): void {
  vc(readers, store);
}

/** Run one fold (`MAt`): drop its timer, stamp `lastAt`, resolve the stale set, clear it, fan out. */
export function runFold(pace: 'steady' | 'live', now: number): void {
  MAt(pace, now);
}

/** The scheduler itself (`Ci`): mark each reader stale in its pace's fold, then run or arm each touched
 *  fold. This is what `vb` calls with a changed key's readers. */
export function scheduleReaderFolds(readers: Iterable<string>, now: () => number = Date.now): void {
  Ci(readers, now);
}

/** The timer callback a fold's `pending` holds (`zf`), spelled out for tests that drive it by hand. */
export function runArmedFold(pace: 'steady' | 'live', now: () => number): void {
  zf(pace, now);
}

/** The fold a store keeps per pace (the shape `folds.steady`/`folds.live` have in the store's own
 *  literal), for a fixture building one. */
export type FoldQueue = PluginStateFold;

/** Bind the registry's render-version store for this process (the source's own literal builds one with
 *  `gs(new Map)`; this product has no store factory, so a surface binds a real store instead). */
export function bindRenderVersions(store: RegistryStore<Map<string, number>> | null): () => void {
  const previous = it().renderVersions;
  it().renderVersions = store as typeof previous;
  return () => { it().renderVersions = previous; };
}

/** Bind the registry's panes store for this process (source literal `panes: gs(FDn)`; see above). */
export function bindPanes(store: RegistryStore<{ shownId?: string | null }> | null): () => void {
  const previous = it().panes;
  it().panes = store as typeof previous;
  return () => { it().panes = previous; };
}
