// The local settings store (W45-56). W45-54 bounded this as a handle because the only field the
// settings-source bodies read was `localStoreProbes`; this package carries the store itself, so the
// handle's default is now the source's own instance rather than a stand-in.
//
// Source: `ji` — the store handle, chunk-wtch2p0g.js [3629,3667) 38 units:
//
//   function ji(){return Ixr.of(B().host)}
//
// The ported store is src/plugin-chain-local-store-source.ts: 12 blocks, 6,302 units, ten statements
// from chunk-4bw62nzm.js and the pin flag with its state from chunk-k1419ccf.js. `Ixr` is
// `new q(() => new F8e)` — one store per host, remembered in a `WeakMap` — and `F8e` is the store:
// `mergedSettings`, `perSource`, `parsedFiles`, the managed-read and listing caches,
// `repoTierFreeze`, `isLoadingFromDisk`, `pluginBase`, `epoch`, `localStoreProbes=new Ht`, and the
// methods that load, seed, invalidate and diff them. The eighty-eight further statements of that
// closure are the lodash comparison stack `M`/`Vn` pulls in, already carried by
// ./plugin-chain-lodash-internals-source.ts.
//
// `ji()` is called with no arguments by the copied settings-source bodies (`Q$s`, `fTr`), so the
// seam keeps that shape and answers the store for a bound host — by default one module-level host
// key, which is one store for the process, exactly as `Ixr`'s `WeakMap` would answer for one host
// object. A caller that owns the real host object binds it: the store then follows the host the way
// the source's `B().host` does.

import { Et, F8e, Gr, Ixr, XMt, j, nHs } from './plugin-chain-local-store-source.js';
import { Ht } from './plugin-chain-local-store-probes-source.js';

/** What the copied bodies read out of `ji()`: the store's probe cache. The real store satisfies this
 *  and much more, so a host may bind a narrower handle for a test. */
export interface LocalStoreHandle {
  localStoreProbes: Ht;
}

/** The host key the default store is remembered under — one object, so one store for the process. */
let hostKey: object = {};

/** Source `Ixr.of(host)`: the store for a host, built on first ask and remembered. */
export function localStore(host: object): F8e {
  return Ixr.of(host) as F8e;
}

let bound: LocalStoreHandle | undefined;

/** Source `ji`: the store the settings-source bodies reach the ownership probes through. */
export function ji(): LocalStoreHandle {
  return bound ?? localStore(hostKey);
}

/** Bind the handle `ji` answers with — the test seam. Binding nothing restores the real store. */
export function bindLocalStore(handle: LocalStoreHandle | undefined): void {
  bound = handle;
}

/** Point the default store at the host object the app owns, the way `B().host` does. */
export function bindLocalStoreHost(host: object): void {
  hostKey = host;
}

/**
 * Source `j`: whether the policy setting is pinned. The store consults it before it walks — with the
 * flag false, nothing is listed primed, no walk is counted, and a policy verdict can only be
 * `install` or `raced`.
 */
export function isPolicyPinned(): boolean {
  return j() as boolean;
}

/**
 * Source `nHs`: the pin setter. The first call pins the flag and answers `pinned`; a repeat of the
 * same value answers `unchanged`; a disagreeing value answers `conflict` and leaves the flag alone —
 * so the pin is **write-once per process**, which is why the suite asserts it last.
 */
export function setPolicyPin(pinned: boolean): 'pinned' | 'unchanged' | 'conflict' {
  return nHs(pinned) as 'pinned' | 'unchanged' | 'conflict';
}

/** Source `XMt`: a null or empty settings object answers null, and anything else is kept. */
export function normalizeEmptySettings(value: unknown): unknown {
  return XMt(value);
}

/** Source `Et`: the source snapshot the settings diff compares — `settings` and `unfiltered` each
 *  normalized, and `legacy` only when the entry carries one. Both must be objects or null: the
 *  source's own `XMt` calls `Object.keys` on them, so an entry without `unfiltered` throws
 *  (measured; the store's own entries always carry both). */
export function wrapSourceSnapshot(entry: unknown): unknown {
  return Et(entry);
}

/** Source `Gr`: the changed-source keys — the keys of both maps whose wrapped snapshots differ. */
export function changedSourceKeys(left: Map<unknown, unknown>, right: Map<unknown, unknown>): unknown[] {
  return Gr(left, right) as unknown[];
}

export { F8e, Ht };
