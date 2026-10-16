// The settings merge layer (W45-55). The ported bodies are
// src/plugin-chain-settings-merge-source.ts — 52 statements, 4,033 units, all in
// chunk-3cynezh1.js at measured ranges: the lodash `mergeWith` internals (49 statements spanning
// [340302,343952)), plus `CHt` [428230,428266), `Y3` [428266,428518) and `ic` [428518,428637).
//
// What the source does with them is the whole point of the layer. Every settings source is folded
// into one object with `mergeWith(..., Y3)`: `bTr` (chunk-3cynezh1.js [428637,…)) opens with
// `MB(r,s,Y3)` on `e.store.pluginBase` and then calls `MB(r,$t(T,N,e),Y3)` once per source, and the
// per-source reader `Qnn` ([427468,…)) answers `MB(i||{},d,Y3)` for the flag file and
// `MB(c,i||{},Y3)` for the legacy local file. `Y3` is therefore the definition of "merge" for
// settings, and it is not lodash's default:
//
//   * `modelPicker` with a defined value is normalized by `ic` — the picker object spread with each
//     `options` array element spread in turn when that element is a plain object;
//   * two arrays concatenate and dedupe (`D([...target, ...source])`) — except `fallbackModel`,
//     which takes the source array outright;
//   * `extraKnownMarketplaces` and `managedMcpServers` take a one-level override (`{...target,
//     ...source}`) when both sides are plain objects, so their nested entries are replaced, not
//     merged;
//   * every other key returns `undefined`, which is how a customizer asks lodash for the default
//     deep merge.
//
// The reach behind this layer is not ported and this seam does not invent it: `Qnn` and `bTr` are
// 325,824 and 335,278 units of schema-driven reading, and the file reader `FB`/`$t` is inside them.
// `mergeSettings` is the seam a ported read path calls, exactly as `Qnn` calls `MB`.
//
// `localSettingsPath` (`vse`) belongs to the settings *source* layer, and this package extends that
// plan with it: src/plugin-chain-settings-source.ts re-exports it.

import { CHt, MB, Y3, ic } from './plugin-chain-settings-merge-source.js';

/** The customizer every settings merge runs with — the source's own `Y3`. */
export const settingsMergeCustomizer = Y3 as (
  targetValue: unknown, sourceValue: unknown, key: string,
) => unknown;

/**
 * Fold sources into `target` the way a settings read does: `mergeWith(target, ...sources, Y3)`.
 * `target` is mutated and returned, which is how the source accumulates — `bTr` starts from
 * `MB(r, e.store.pluginBase, Y3)` and keeps merging into the same `r`.
 */
export function mergeSettings<T extends object>(target: T, ...sources: unknown[]): T {
  return (MB as (target: unknown, ...rest: unknown[]) => T)(target, ...sources, settingsMergeCustomizer);
}

/**
 * The `modelPicker` normalizer `ic`: a plain-object picker is copied with its `options` array
 * elements copied in turn (each plain-object element spread, every other element left alone); a
 * value that is not a plain object is returned unchanged.
 */
export function normalizeModelPicker(value: unknown): unknown {
  return (ic as (value: unknown) => unknown)(value);
}

/**
 * The one-level override `CHt` the customizer uses for `extraKnownMarketplaces` and
 * `managedMcpServers`: a shallow spread, so a nested entry on the source side replaces the target's
 * entry instead of merging into it.
 */
export function shallowSettingsOverride(target: unknown, source: unknown): unknown {
  return (CHt as (target: unknown, source: unknown) => unknown)(target, source);
}
