// The render-version and render-key layer (W45-87): what the terminal glue computes about a drawing
// before it asks the host renderer for an answer. The copied bodies live in
// ./plugin-chain-render-keys-source.ts; this module is the seam that names them.
//
// Source, chunk-n3ykh62m.js: `vA` [230241,230260) — the render event name; `rur`/`WPn`/`SVe`
// [230295,230559) — match a loading module by event and component, list the modules that hook the
// event, and their names; `GPn` [231248,231336) — the hooks that hook the event and match one
// component; `sur`/`iur` [238618,238917) — whether props hold a position or offset, and whether a
// drawn value draws anything; `wc` [271971,272059) — bump one store key; `kc`/`wH`/`kH`/`xc`
// [272105,272197) — the live-key suffix and the steady/live key; `Rb` [272964,272991) — whether a
// store key is a version key; `Tc` [273378,273603) — the render version; `$H` [273714,273791) —
// suffix a drawing key with its version; `MF` [273934,273997) — the render key; `s_`
// [273997,274025) — the registry's plugin state; `oIn` [273333,273358) — the viewport store key;
// `hno`/`yno`/`mIn`/`kVe` [284410,284770) — the memoized JSON id, the props key and the keyed
// render key; `$ur` [284974,285279) — the on-screen range or null; `Frt`/`LAt` [308406,308573) —
// whether any loaded module hooks the render event, and whether one matches this component.
// chunk-nyce03br.js: `olt` [2766,2815) — the offset prop names; `j3e` [6172,6303) — the message
// types; `Ioe` [25632,25662) — the engine sentinel. chunk-t175a0ke.js: `Omt` [961,976) — the
// static-frame store. chunk-tvdq3hrk.js: `l9` [7979,8014) — the viewport store. chunk-ed7zyzrn.js:
// `blt` [8524,8564) — one matcher field check. chunk-zf8k2z6n.js: `eA`/`at` [651,891) — the sha256
// shape and the sha256 id.
export {
  vA, rur, WPn, SVe, GPn, sur, iur,
  wc, kc, wH, kH, xc, Rb, oIn,
  Tc, $H, MF, s_, hno, yno, mIn, kVe,
  $ur, Frt, LAt, j3e, Ioe, Omt, l9, blt, eA, at, olt,
} from './plugin-chain-render-keys-source.js';

/** Source `vA`: the event every plugin render hooks (`ui.render`). */
export { vA as renderEventName } from './plugin-chain-render-keys-source.js';
/** Source `MF`: the render key — surface, component and request id. */
export { MF as renderKeyOf } from './plugin-chain-render-keys-source.js';
/** Source `kVe`: the render key suffixed with its version. */
export { kVe as renderKey } from './plugin-chain-render-keys-source.js';
/** Source `Tc`: the render version of a store, or the visible map's version string. */
export { Tc as renderVersion } from './plugin-chain-render-keys-source.js';
/** Source `mIn`: the props key — viewport columns, fullscreen and the props hash. */
export { mIn as propsKey } from './plugin-chain-render-keys-source.js';
/** Source `$ur`: the on-screen range a drawing reported, or null. */
export { $ur as onScreenRange } from './plugin-chain-render-keys-source.js';
/** Source `iur`: whether a drawn value draws anything. */
export { iur as drawsAnything } from './plugin-chain-render-keys-source.js';
/** Source `Frt`: whether any loaded module hooks the render event. */
export { Frt as renderEventHooked } from './plugin-chain-render-keys-source.js';
/** Source `LAt`: whether a loaded module hooks the render event and matches this component. */
export { LAt as renderEventHookedFor } from './plugin-chain-render-keys-source.js';
