// The AbovePrompt field/select state layer (W149): the three per-site stores the input and select
// fields share, keyed by the `${plugin}\0${element}` site key, plus the terminal input dispatch.
// Copied bodies live in ./plugin-chain-above-prompt-select-source.ts:
//
//   - chunk-tvdq3hrk.js [2954,2990) 36 units — `A5t`, the field-texts store (`fieldTexts`);
//   - [2990,3026) 36 units — `C5t`, the picked-values store (`pickedValues`);
//   - [3026,3062) 36 units — `T5t`, the site-generation store (`siteGenerations`);
//   - [3062,3092) 30 units — `qAt`, the site key (`siteKey`);
//   - [3092,3145) 53 units — `KAt`, a site's current generation (`siteGeneration`);
//   - [3145,3216) 71 units — `Xrt`, a map without the named keys (`withoutKeys`);
//   - [3216,3373) 157 units — `mro`, forget a site's texts and picked value and bump its
//     generation (`forgetSiteFields`);
//   - chunk-kjfwbh4w.js [45567,45639) 72 units — `nDr`, inputFromTerminal.
//
// Total 8 blocks, 491 UTF-16 units.
import { A5t, C5t, T5t, qAt, KAt, Xrt, mro, nDr } from './plugin-chain-above-prompt-select-source.js';

/** A source single-slot holder (`bs`): `set` replaces the value, `get` reads it. */
export interface StoreSlot<V> {
  set(value: V | undefined): void;
  get(): V | undefined;
}

/** A per-site store's map: site key to that site's values by seat key. */
export type SiteFields<V> = Map<string, Map<string, V>>;

/** The generation store's map: site key to how many times its fields were forgotten. */
export type SiteGenerations = Map<string, number>;

/** Source `A5t`: each field site's texts by seat key. */
export const fieldTexts = A5t as StoreSlot<SiteFields<string>>;

/** Source `C5t`: each select site's picked value by seat key. */
export const pickedValues = C5t as StoreSlot<SiteFields<unknown>>;

/** Source `T5t`: each site's generation, bumped when `forgetSiteFields` clears its fields. */
export const siteGenerations = T5t as StoreSlot<SiteGenerations>;

/** Source `qAt`: the site key. */
export function siteKey(plugin: string, element: string): string {
  return qAt(plugin, element) as string;
}

/** Source `KAt`: a site's current generation, 0 when its fields were never forgotten. */
export function siteGeneration(plugin: string, element: string): number {
  return KAt(plugin, element) as number;
}

/** Source `Xrt`: a copy of `map` without the named keys; the source map is unchanged. */
export function withoutKeys<V>(map: Map<string, V>, keys: Iterable<string>): Map<string, V> {
  return Xrt(map, keys) as Map<string, V>;
}

/** Source `mro`: forget a site's field texts and picked value, and bump its generation. */
export function forgetSiteFields(plugin: string, element: string): void {
  mro(plugin, element);
}

/** What `nDr` hands the ui.input dispatch; every field but `plugin` is forwarded as given. */
export interface InputFromTerminalRequest {
  plugin: string;
  [key: string]: unknown;
}

/** Source `nDr`: dispatch a ui.input for the element the plugin holds, settling quietly. */
export function inputFromTerminal(request: InputFromTerminalRequest): Promise<void> {
  return nDr(request) as Promise<void>;
}
