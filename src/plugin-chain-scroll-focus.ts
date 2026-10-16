// The `ui.scroll` and `ui.focus` call entries (W45-71) — the two site registries a plugin's call
// reaches, the key a site is filed under, the checks each call makes before anything moves, and the
// commit road with its refusal sentences. The copied bodies live in
// ./plugin-chain-scroll-focus-source.ts, and the two site descriptors they read come from
// ./plugin-chain-scroll-focus-sites.js, which this module imports first for its side effect: `Mm`
// reads the site out of the host seam's table while the copy is evaluated, so the descriptors have to be
// registered before that happens.
//
// A site is what the UI side registers when a plugin's element can be scrolled or can hold the keyboard:
// `{owner?, commit, isHeldNow?, holderNow?}`, filed under `component:requestId`.
//
// The two registries, the key they are filed under, and the two lookups:
//
//   var ahe=Ge(()=>it().scrollSites,(e)=>e().clear());
//
// [476191,476241) 50 units, chunk-sfn1dbxq.js. `ahe` — the scroll-site registry: `it().scrollSites`, read through the store wrapper `Ge`, whose second argument (the disposer) is dropped in this build.

//
//   var Uet=Ge(()=>it().focusSites,(e)=>e().clear());
//
// [475653,475702) 49 units, chunk-sfn1dbxq.js. `Uet` — the focus-site registry: `it().focusSites`, the same way.

//
//   var _z=(e,n)=>`${e}:${n}`;
//
// [476241,476267) 26 units, chunk-sfn1dbxq.js. `_z` — the key a site is filed under: the component and the request id joined by a colon, with nothing escaped, so a component that contains a colon is a key that cannot be told from a longer one.

//
//   var mse=(e)=>ahe().get(_z(e.component,e.requestId));
//
// [476681,476733) 52 units, chunk-sfn1dbxq.js. `mse` — the scroll site a call names, out of the registry above.

//
//   var iL=(e)=>Uet().get(_z(e.component,e.requestId));
//
// [479605,479656) 51 units, chunk-sfn1dbxq.js. `iL` — the focus site a call names, the same way.

//
// The two ownership checks, which are not the same check:
//
//   var pyt=(e,n)=>n.kind==="plugin"&&e.owner!==void 0&&e.owner!==n.name;
//
// [476009,476078) 69 units, chunk-sfn1dbxq.js. `pyt` — the scroll check: the call is refused only when the caller is a plugin and the site has an owner that is not that plugin. A site with no owner is every plugin's, and an editor call is never refused here.

//
//   var uyt=(e,n)=>n.origin.kind==="plugin"&&e.owner!==void 0&&e.owner!==n.origin.name&&n.plugin!==n.origin.name;
//
// [475544,475653) 109 units, chunk-sfn1dbxq.js. `uyt` — the focus check, which is about a forwarded call: it refuses when the caller is a plugin, the site has an owner other than the origin's plugin, and the caller is not that origin plugin itself. A plugin touching another plugin's site on its own behalf passes; the same plugin forwarding the call does not.

//
//   function XH(e,n){if(n.kind!=="plugin")return!1;let r=e.holderNow();return r!==void 0&&r!==n.name}
//
// [475447,475544) 97 units, chunk-sfn1dbxq.js. `XH` — the keyboard holder check: whether a plugin other than the caller holds the keyboard at this site right now.

//
// The two bodies and the two entries:
//
//   function PY(e){let n=mse(e);if(!n)return{deny:"no such site"};if(pyt(n,e.origin))return{deny:"not this plugin's site"};return n.commit(e.offset,e.origin)?{}:{deny:"the window moved meanwhile"}}
//
// [476733,476926) 193 units, chunk-sfn1dbxq.js. `PY` — `$.ui.scroll`: no such site, then not this plugin's site, then the site's own commit, answering `{}` when the window moved and the site's refusal when it did not.

//
//   var bse=Mm("ui.scroll",PY);
//
// [479578,479605) 27 units, chunk-sfn1dbxq.js. `bse` — the `ui.scroll` entry: the site out of the host seam's table and this body as its core handler.

//
//   function IY(e){let n=iL(e);if(!n)return{deny:"no such site"};if(uyt(n,e))return{deny:"not this plugin's site"};if(!n.isHeldNow())return{deny:"that site does not hold the keyboard"};if(XH(n,e.origin))return{deny:"another plugin's element holds the keyboard"};let r=n.commit(e);return r===void 0?{}:{deny:r}}
//
// [479656,479962) 306 units, chunk-sfn1dbxq.js. `IY` — `$.ui.focus`: no such site, then a forwarded call from another plugin, then whether the site holds the keyboard at all, then whether another plugin's element holds it, and last the site's own commit, whose sentence is passed through as the refusal.

//
//   var vse=Mm("ui.focus",IY);
//
// [479962,479988) 26 units, chunk-sfn1dbxq.js. `vse` — the `ui.focus` entry, the same way.

//
// The entry builder is the entry seam's, so an entry is a hook site from the host seam's table plus a core
// handler; the store wrapper and the registry getter come from the runner copy and the host seam.
import type { PluginFocusSite, PluginScrollSite } from './plugin-chain-registry-state.js';
import './plugin-chain-scroll-focus-sites.js';
import { Mm } from './plugin-chain-entry.js';
import {
  _z, ahe, bse, iL, IY, mse, PY, pyt, Uet, uyt, vse, XH,
} from './plugin-chain-scroll-focus-source.js';

/** Source `bse`: the `ui.scroll` entry — the site and the core handler `PY`. */
export const SCROLL_ENTRY = bse;

/** Source `vse`: the `ui.focus` entry — the site and the core handler `IY`. */
export const FOCUS_ENTRY = vse;

/** Source `ahe`: the scroll-site registry, the same map the registry state holds. */
export function scrollSites(): Map<string, PluginScrollSite> {
  return ahe() as Map<string, PluginScrollSite>;
}

/** Source `Uet`: the focus-site registry, the same map the registry state holds. */
export function focusSites(): Map<string, PluginFocusSite> {
  return Uet() as Map<string, PluginFocusSite>;
}

/** Source `_z`: the key a site is filed under. */
export function siteKey(component: string, requestId: string): string {
  return _z(component, requestId);
}

/** Source `mse`: the scroll site a call names, or nothing when no site is filed under that key. */
export function scrollSiteFor(call: { component: string; requestId: string }): PluginScrollSite | undefined {
  return mse(call) as PluginScrollSite | undefined;
}

/** Source `iL`: the focus site a call names, or nothing when no site is filed under that key. */
export function focusSiteFor(call: { component: string; requestId: string }): PluginFocusSite | undefined {
  return iL(call) as PluginFocusSite | undefined;
}

/** Source `PY`: `$.ui.scroll` — the site's own commit, or the refusal that says why not. */
export function scrollCall(call: {
  component: string; requestId: string; offset: unknown; origin: { kind?: string; name?: string };
}): { deny?: string } {
  return PY(call) as { deny?: string };
}

/** Source `IY`: `$.ui.focus` — the site's own commit, or the refusal that says why not. */
export function focusCall(call: {
  component: string; requestId: string; plugin: string; origin: { kind?: string; name?: string };
}): { deny?: string } {
  return IY(call) as { deny?: string };
}

/** Source `pyt`: is this scroll call one the site refuses to let through. */
export function scrollCallIsForeign(site: PluginScrollSite, origin: { kind?: string; name?: string }): boolean {
  return pyt(site, origin);
}

/** Source `uyt`: is this focus call a forwarded one the site refuses to let through. */
export function focusCallIsForwarded(site: PluginFocusSite, call: { plugin: string; origin: { kind?: string; name?: string } }): boolean {
  return uyt(site, call);
}

/** Source `XH`: does another plugin's element hold the keyboard at this site. */
export function otherHolderHasKeyboard(site: PluginFocusSite, origin: { kind?: string; name?: string }): boolean {
  return XH(site, origin);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own. */
export const SOURCE_BODIES = { XH, uyt, Uet, pyt, ahe, _z, mse, PY, bse, iL, IY, vse, Mm };

export { XH, uyt, Uet, pyt, ahe, _z, mse, PY, bse, iL, IY, vse };

export type { PluginFocusSite, PluginScrollSite };
