// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The site descriptors themselves: what a `ui.scroll` or `ui.focus` call must carry, what a rewrite
// of one may not change, and what the answer must look like. The shared check and the two builders
// come from copies that already carry them.
import { C, h$, L, we } from './plugin-chain-source.js';
import { et } from './plugin-chain-override-sites-source.js';
import { re } from './plugin-chain-sites-source.js';

// chunk-nyce03br.js `pr` — the check every `ui.*` site shares: a `deny` that is absent, or a non-empty string [15588,15723) 135 units sha256 f15a38854af9ab2d212794e5387b1c57540c676068390df3fbd8a324efa41149
function pr(e,t,o){let{deny:r}=e;return r===void 0||typeof r==="string"&&r!==""?et("deny",e,o):"a deny that is not a non-empty string"}

// chunk-nyce03br.js `ro` — the site builder: the restored argument list, the argument check and the answer check [16084,16200) 116 units sha256 e68a5d587606874448c0b19d176381653cee222dbdadead66b98166de61903e9
var ro=({event:e,restored:t,checkArgument:o,check:r})=>({event:e,restoreArgument:we(t),checkArgument:o,check:C(r)});

// chunk-nyce03br.js `Vr` — the element check: an element where the move named none, no element where it named one, an element that is not a non-empty string [34850,35160) 310 units sha256 f59e2d26b04d236bb5be5db8f9e0a443e3f73a0f951d9df4c38638b5a2bda2a9
function Vr(e,t){if(e!==void 0&&t===void 0)return"an element where the move named none (one of the engine's stops)";if(e===void 0&&t!==void 0)return"no element where the move named one (a rewrite names another)";return e===void 0||typeof e==="string"&&e!==""?void 0:"an element that is not a non-empty string"}

// chunk-nyce03br.js `ko` — the focus call's argument names [35160,35211) 51 units sha256 fb608ade8d10b6e8ee2dd79649aa261ba425563fb2b6ba36fb31c7ee92d81808
var ko=["component","requestId","plugin","origin"];

// chunk-nyce03br.js `Ci` — the `ui.focus` site: its restored arguments, its argument check and the shared answer check [35211,35334) 123 units sha256 99eecd3a2720ac724d4de6bcab7e421ebeaeeb460fbaf49fece2a9bfd592f1b5
var Ci=ro({event:"ui.focus",restored:[...ko,"element"],checkArgument:(e,t)=>re(ko,e,t)??Vr(e.element,t.element),check:pr});

// chunk-nyce03br.js `Po` — the scroll call's argument names [94084,94166) 82 units sha256 507fc16afdef998f239e1fd6b30abd481b8cfe0931caa533c0e98630600e4721
var Po=["component","requestId","by","bodyRows","contentRows","origin","pointer"];

// chunk-nyce03br.js `wa` — the `ui.scroll` site: the whole-row offset check, the argument check and the shared answer check [94166,94345) 179 units sha256 0392f16d9f34fe39b4ab90d216b193be42644a848378e7a02a95b3e0a9794776
var wa=ro({event:"ui.scroll",restored:Po,checkArgument:(e,t)=>{let o=h$(e.offset);return re(Po,e,t)??(o?void 0:"an offset that is not a whole row number (0 or more)")},check:pr});


export { pr, ro, Vr, ko, Ci, Po, wa };
