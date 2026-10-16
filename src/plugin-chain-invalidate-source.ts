// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The invalidation calls (W45-42): the four bodies that drop the derived tables when the sources
// they came from change. Each body is the module's text; every name it reaches is already ported —
// the plugin registry's clears from W45-40, the plugin registry accessor `it` from the host, and the
// source registry accessor `xr` from W45-41's seam.
import { it } from './plugin-chain-host.js';
import { $hr, Uhr } from './plugin-chain-registry-reset-source.js';
import { xr } from './plugin-chain-sources-registry.js';

// chunk-sfn1dbxq.js declares Hz, the skill dirs and markdown files dropped after a skills-folder change [3393591,3393664) 73 units sha256 28f21d007ebd259c9c8e30ad08ef9ac661ef47f4abe708d308993c38fc3fc9e5
function Hz(){let e=xr();e.invalidateSkillDirs(),e.markdownFiles.clear()}

// chunk-sfn1dbxq.js declares YCn, the plugin registry's hook-registration slot cleared [2476471,2476515) 44 units sha256 58367362acfcee77a145c17cb580eeb8c990d6e218d99e7f55de39d1381da628
function YCn(){it().hookRegistration=void 0}

// chunk-sfn1dbxq.js declares _7, the agent definitions and markdown files dropped with the plugin registry's agents slot [2091587,2091664) 77 units sha256 2d585f35d9c5766eb8d1ff710d745f2f3c028bd811f03c8ea82fcccb0e48da5b
function _7(){xr().agentDefinitions.clear(),xr().markdownFiles.clear(),$hr()}

// chunk-sfn1dbxq.js declares bCn, the output-style dir styles and markdown files dropped with the plugin registry's output-styles slot [1706307,1706394) 87 units sha256 1f023200536760d3fc73a6a278d34d435e03b8d1822c18f5f0df05bd682278c1
function bCn(){let e=xr();e.outputStyleDirStyles.clear(),e.markdownFiles.clear(),Uhr()}


export { Hz, YCn, _7, bCn };
