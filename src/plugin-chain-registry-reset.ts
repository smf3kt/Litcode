// The registry's invalidation surface (W45-40): the two reads and the five resets the plugin sources
// call when a source they were built from changes.
//
// Source: chunk-3ph567jx.js — the tail of the module W45-35 ported (`FDn`, `Zco`, `edo`, `s`). What is
// left there is the registry accessor's own machinery and the seven small bodies below:
//
//   class n{registry=s()}                     [3650,3671)  the per-host registry
//   var r=new q(()=>new n)                    [3671,3694)  the source's memo over it
//   function a(){return r.of(B().host)}       [3694,3729)
//   function it(){return a().registry}        [3729,3763)
//   · wms/$Dn/Nhr/Fhr/$hr/Uhr/UDn             [3763,4069)  the seven copied bodies
//
// The first four are the host boundary and are not copied: `it()` is `a().registry` under the memo
// `q(() => new n)`, i.e. one registry per host, and this product has one host for the process. Its
// ./plugin-chain-host.ts builds that registry lazily inside a function also named `it`, which is what
// the copied bodies below call, so the source's `it().<field>` and this product's `it().<field>` are
// the same expression. With those seven bodies copied, every declaration of chunk-3ph567jx.js is now
// either copied (W45-35 and this package) or recorded here as the host boundary.
//
// The copied bodies live in ./plugin-chain-registry-reset-source.ts (7 blocks, 306 units; ranges and
// per-block digests in research/ports/W45-registry-reset-blocks.plan.json).
//
// The source's own call sites, read out of chunk-sfn1dbxq.js so the combinations are not a guess:
//   · `bM()` = `VT(); Nhr(); Fhr(); Hz()` — the commands and the two skill slots, after the command
//     source is invalidated ([1675987,…)).
//   · `zLr(e,n)` = `D_(), Nhr(), $hr(), …, Uhr(), allOutputStyles.clear(), UDn()` — the plugin-source
//     re-read clears commands, agents, output styles and workflows ([3706942,…)).
//   · `_7()` = `agentDefinitions.clear(), markdownFiles.clear(), $hr()` ([2091658,…)).
//   · `bCn()` = `outputStyleDirStyles.clear(), markdownFiles.clear(), Uhr()` ([1706388,…)).
// Those compositions are the next package; this one is the seven bodies they are made of.
import { $Dn, $hr, Fhr, Nhr, Uhr, UDn, wms } from './plugin-chain-registry-reset-source.js';

/** Whether a name is a registered agent (`wms`): the registry's own map lookup. */
export function registeredAgentExists(name: string): boolean {
  return wms(name) as boolean;
}

/** Whether the plugin loader may read this host's cache only (`$Dn`, the `pluginLoadCacheOnly` slot). */
export function pluginLoadCacheOnly(): unknown {
  return $Dn();
}

/** `Nhr`: clear the commands slot, so its producers rebuild it. */
export function resetCommands(): void {
  Nhr();
}

/** `Fhr`: clear both skill slots (`skills` and `skillsV5`). */
export function resetSkills(): void {
  Fhr();
}

/** `$hr`: clear the agents slot. */
export function resetAgents(): void {
  $hr();
}

/** `Uhr`: clear the output styles slot. */
export function resetOutputStyles(): void {
  Uhr();
}

/** `UDn`: clear the workflows slot. */
export function resetWorkflows(): void {
  UDn();
}
