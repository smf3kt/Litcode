// The `$` table's `settings.read` (W45-53): what the entry's check and body reach. The copied bodies
// live in ./plugin-chain-settings-read-source.ts; this module is the host seam around them, and the
// settings store they read through is the bounded hook in ./plugin-chain-settings-store.ts.
//
// Source: the entry in the plugin-method table's literal (chunk-sfn1dbxq.js [2354546,2354605) 59
// units), taken verbatim:
//
//   "settings.read":{check:(n)=>yGo(n?.source),run:(n)=>hGo(n)},
//
// and the four bodies behind it, all in the same module:
//
//   var ZH=(e)=>e===void 0?void 0:Y(_(e));                                 [492416,492454)  38 units
//   var J9=Object.freeze({user:"userSettings",project:"projectSettings",
//                         local:"localSettings",flag:"flagSettings",policy:"policySettings"});  [2328610,2328746) 136 units
//   function hGo(e){…}                                                     [2328746,2328835)  89 units
//   function yGo(e){…}                                                     [2328835,2329021) 186 units
//
// What the ported bodies say, all measured from the source:
//  · `hGo` is the whole body: `e.source` selects the source — absent means the merged settings
//    (`ft()`), a name means that source's settings (`fe(J9[e.source])`) — and the answer is the
//    projection `ZH` of it, as a promise, with `{}` for a store that has nothing (`?? {}`).
//  · `ZH` is a copy, not a reference: `undefined` stays `undefined`, and anything else answers the
//    value's JSON round-trip through the same two helpers the store's parse leans on (`_` then `Y`).
//    So the caller gets its own object, and a value the JSON helpers cannot carry is the parse's own
//    error.
//  · `yGo` is the check: no argument, or a string naming one of `J9`'s keys, is admitted; anything
//    else is refused with the names it accepts and the type it got —
//    `takes { source } naming one of user, project, local, flag, policy (got <name-or-type>)`.
//  · `J9` is the map both read: the five source names to the settings files the store reads.
//
// This package binds the entry alone. The settings store itself — its cache, its file reads, the
// managed-settings gate and the watchers — is the next package, and ./plugin-chain-settings-store.ts
// records what it reaches.
import { J9, ZH, hGo, yGo } from './plugin-chain-settings-read-source.js';
import { raiseHostCall, type HostCallBottom, type HostCallCaller } from './plugin-chain-host-call.js';

export { bindSettingsStore, type SettingsStore } from './plugin-chain-settings-store.js';
export type { HostCallCaller };

/** Source `J9`: the five source names the entry accepts, mapped to the settings file each one names. */
export const SETTINGS_SOURCES: Readonly<Record<string, string>> = J9 as Readonly<Record<string, string>>;

/** Source `ZH`: the value's JSON copy — `undefined` stays `undefined`, anything else is copied. */
export function copySettingsValue<T>(value: T): T {
  return ZH(value) as T;
}

/** Source `yGo` as the entry calls it: the refusal text for the argument's `source`, or `undefined`.
 *  The entry passes `n?.source`, so an argument with no `source` is admitted. */
export function checkSettingsRead(args: unknown): string | undefined {
  return yGo((args as { source?: unknown } | undefined)?.source) as string | undefined;
}

/** Source `hGo`: the entry's body — the merged settings, or one source's, as a promise. The store is
 *  read (and the JSON copy taken) before the promise is built, so a store that throws does so
 *  synchronously, exactly as the source's own `Promise.resolve(ZH(…))` shape does. */
export function readSettings(args: unknown): Promise<Record<string, unknown>> {
  return hGo(args as { source?: string }) as Promise<Record<string, unknown>>;
}

/** The `settings.read` entry, exactly as the table's literal spells it. */
export function settingsReadEntry(): HostCallBottom {
  return { check: (n) => checkSettingsRead(n), run: (n) => readSettings(n) };
}

/** Raise one `$` `settings.read` call the way the plugin-method dispatcher does: the table entry is
 *  the chain's floor, so a plugin's hooks may answer first and `next()` reaches the floor. */
export async function raiseSettingsRead(request: {
  args: unknown;
  caller: HostCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: 'settings.read',
    args: request.args,
    caller: request.caller,
    bottom: settingsReadEntry(),
    raise: request.raise,
  });
}
