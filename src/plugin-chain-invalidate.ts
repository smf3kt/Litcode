// The invalidation calls (W45-42): what the plugin sources run after a folder, marketplace or builtin
// change made the tables they had derived stale.
//
// Source: chunk-sfn1dbxq.js, four bodies that each drop one source kind's derived tables and the slots
// the plugin registry keeps for it:
//
//   Hz()   [3393591,3393664)  xr().invalidateSkillDirs(); xr().markdownFiles.clear()
//   YCn()  [2476471,2476515)  it().hookRegistration=void 0
//   _7()   [2091587,2091664)  xr().agentDefinitions.clear(); xr().markdownFiles.clear(); $hr()
//   bCn()  [1706307,1706394)  xr().outputStyleDirStyles.clear(); xr().markdownFiles.clear(); Uhr()
//
// All four are copied verbatim into ./plugin-chain-invalidate-source.ts (4 blocks, 281 units). Every
// name they reach is already in the product: the source registry's accessor `xr` from W45-41's seam,
// the plugin registry's accessor `it` from ./plugin-chain-host.ts, and the two clears `$hr`/`Uhr` from
// W45-40's copy. Nothing here is rewritten or inferred.
//
// The family has two more members, and they are deliberately not ported yet. `VT()` [1675922,1675968)
// is `xr().invalidateCommands(),BEo()`, and `bM()` [1675968,1676004) is `VT(),Nhr(),Fhr(),Hz()`.
// `Nhr`, `Fhr` and `Hz` are ported, so `bM` is one unported callee away:
//
//   BEo()  chunk-x0dc37w9.js [93890,93942)  function BEo(){return MR(M()).shadowedHelperSources}
//
// and neither `BEo` nor the config record `M()` [86914,87558) it reads through is ported — the name
// `shadowedHelperSources` appears in no product file. Copying `VT` verbatim would need a `BEo` this
// product cannot supply, and inventing one (returning nothing, or an empty table) would decide for the
// source what "shadowed helper sources" means. So the two bodies wait for the helpers/config store,
// and the wrappers below are the four that stand on their own.
import { Hz, YCn, _7, bCn } from './plugin-chain-invalidate-source.js';

/** `Hz` — a skills-folder change: drop the skill dirs and the markdown files, nothing else. */
export function invalidateSkillSources(): void {
  Hz();
}

/** `YCn` — clear the plugin registry's hook-registration slot, so the next read re-registers. */
export function clearHookRegistration(): void {
  YCn();
}

/** `_7` — an agents change: drop the agent definitions and the markdown files, and the agents slot. */
export function invalidateAgentSources(): void {
  _7();
}

/** `bCn` — an output-styles change: drop the dir styles and the markdown files, and the styles slot. */
export function invalidateOutputStyleSources(): void {
  bCn();
}
