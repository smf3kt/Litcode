// The hover group (W45-83): the store the sites count themselves in, the member handle that keeps
// one group at a time, the override split and the two components that draw through it. The copied
// bodies live in ./plugin-chain-hover-source.ts; this module is the seam around them.
//
// Source, chunk-kjfwbh4w.js:
//   var Fe=()=>it().hoverGroups; [21290,21318) — the store accessor: the registry's own Map store.
//   var mt=(o,i)=>Fe().setState(…); [21318,21425) — adjust one key's count by `i`, dropping the key
//   when the count reaches zero.
//   function _t(){…} [21425,21619) — one member's `enter`/`leave`/`regroup`; a member counts in at
//   most one group at a time.
//   function Bt(o,i){…} [21619,21707) — `{plugin, scope}` when both are given.
//   function ft(o){…} [21707,21751) — the hover props minus `scope`.
//   function ut(o,i){…} [21755,22010) — subscribe to one group key: `isHot` from the store and the
//   enter/leave handlers, re-grouped when the key changes and left on unmount.
//   var Kt=["color","backgroundColor","borderColor"]; [22014,22063) — the color props `De` maps.
//   function De(o){…} [22063,22203) — copy the props, mapping named colors to hex through `Ckn`.
//   var _e=qt(!1); [22207,22221) — the scope-hovered context.
//   function jt(o,i,p){…} [22221,22436) — the overrides and handlers for one site: the group's own
//   hot state when it belongs to one, the enclosing scope otherwise.
//   function $t({…}){…} [22436,22764) — HoverScope: own hover state for a live scope, the group
//   subscription, the provider carrying its own hover state and the merged layout.
//   function Ut({…}){…} [22768,22928) — HoverStyled: a Text or Box with the resolved overrides.
//
// Source, chunk-5b7mmg84.js: `u4n`/`c` [720,758) — the no-op subscribe and the constant undefined
// source; `Re` [758,1288) — the store selector hook: `getSnapshot` through the selector, cached on
// the snapshot and selector identities, subscribed through the `PU` scheduler when one is mounted.
// Source, chunk-p16hdq43.js: `Dbr` [2431,2481) — the `plugin\0scope\0scope` store key.
export {
  Fe, mt, _t, Bt, ft, ut, Kt, De, _e, jt, $t, Ut, Re, Dbr, u4n, c,
} from './plugin-chain-hover-source.js';

/** Source `Fe`: the hover-group store (`it().hoverGroups`). */
export { Fe as hoverGroupsStore } from './plugin-chain-hover-source.js';
/** Source `mt`: adjust a group key's hover count, dropping it at zero. */
export { mt as adjustHoverGroup } from './plugin-chain-hover-source.js';
/** Source `_t`: one group member's enter/leave/regroup. */
export { _t as groupMember } from './plugin-chain-hover-source.js';
/** Source `Bt`: the `{plugin, scope}` group key of a site. */
export { Bt as groupOf } from './plugin-chain-hover-source.js';
/** Source `ft`: the hover overrides without their `scope`. */
export { ft as hoverOverridesOf } from './plugin-chain-hover-source.js';
/** Source `Kt`: the props `De` normalizes from a named color to hex. */
export { Kt as HEX_COLOR_PROPS } from './plugin-chain-hover-source.js';
/** Source `_e`: the scope-hovered context. */
export { _e as ScopeHovered } from './plugin-chain-hover-source.js';
/** Source `$t`: the HoverScope site component. */
export { $t as HoverScope } from './plugin-chain-hover-source.js';
/** Source `Ut`: the HoverStyled Text/Box site component. */
export { Ut as HoverStyled } from './plugin-chain-hover-source.js';
