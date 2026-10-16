// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
//   chunk-3qabb19b.js sha256 ceb8c8490f39408310286cc14cacb1998192c8c34a80724882f988431f1bf5f2
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The host toast method and the stack it keeps (W45-32): the bar's reader `bu`, the per-plugin
// cap `aV` (over `ACn`), the undrawn report `See`, the stack writer `bh` (gated by the shallow
// list equality `$P`), the push helper `wee`, the host method `EEe`, the timer arming `yee`, the
// fold transform `MF`, and the constants the plugin-state store under `Pye(IF)` is read and
// written through (`cI`, `RF`, `PF`, `fee`, `IF`, `TC`). `yvt` is the source's own id generator
// (`import{randomUUID as yvt}from"crypto"`); `Nle`/`SKr` are the plugin label policy.
import { randomUUID as yvt } from 'node:crypto';
import { featureUsed as g, it, t } from './plugin-chain-host.js';
import { Ge } from './plugin-chain-notify-fold-source.js';
import { Pye, a8, s_ } from './plugin-chain-notify-store-source.js';
import { o5t, sOn } from './plugin-chain-notify-write-source.js';
import { ACn, AQo } from './plugin-chain-toast-source.js';
import { CK, uMe } from './plugin-chain-ui-source.js';
import { Mde } from './plugin-chain-plugin-label.js';

// chunk-24k7d6mw.js declares cI, the id set the stack writer deletes from as it reports an undrawn toast [170752,170786) 34 units sha256 8e75a71f386acb88a349e4cfb4f5b3eb8efd0d276c05cbd33074ae926dbfeca4
var cI=Ge(new Set,(h)=>h.clear());

// chunk-24k7d6mw.js declares RF, how long a toast stays in its leaving phase (240ms) [170786,170797) 11 units sha256 65ed47e52508f44bf950a0be1fb9f7869d8c5e806443a5575547d9e16424c789
var RF=240;

// chunk-24k7d6mw.js declares PF, the hold that re-bases a toast's deadline (30000ms) [170797,170818) 21 units sha256 ca42dff9d537ea8f64efa7555a39317b82f65b6e4e6a10adf23958198683113b
var PF=30000;var MF=(

// chunk-24k7d6mw.js declares MF, the fold's stack transform: a held toast's time is added to its deadline, a spent one leaves, and a leaving one gets RF more [170818,171054) 236 units sha256 7d94f03ec2300932ba7076a7f9ec6bb5769b64446064fa1f193d1cb027d74a15
h,T)=>h.flatMap((M)=>{let{heldAt:L,...ee}=M,we=L!==void 0&&T-L>=PF?{...ee,leavesAt:M.leavesAt+(T-L)}:M,Te=we.heldAt===void 0&&we.leavesAt<=T,Me=Te&&we.phase==="leaving",Le=Te?{...we,phase:"leaving",leavesAt:T+RF}:we;return Me?[]:[Le]});

// chunk-24k7d6mw.js declares fee, the frozen empty stack a reader without a stored value gets [171054,171080) 26 units sha256 d3e85b4c1be195a44f1991389dfc7ba041c2cf039c6a72b40c99d3e681332097
var fee=Object.freeze([]);

// chunk-24k7d6mw.js declares IF, the plugin-state key the stack is stored under (`{plugin:a8,key:"toasts"}`) [171080,171111) 31 units sha256 a9cd7135f8d3ea468bbfa52ddabf729467bc2e4a3325b8ff825608047d86d5a2
var IF={plugin:a8,key:"toasts"}

// chunk-24k7d6mw.js declares bu, the stack reader: the stored value under Pye(IF) when it is an array, else the frozen empty stack [171112,171208) 96 units sha256 12504e7a08b63aa0ba3fe1fa3ea128cecb246ff2a46044224bf479557f9e297a
function bu(h=s_().values.getState()){let T=h.get(Pye(IF))?.value;return Array.isArray(T)?T:fee}

// chunk-24k7d6mw.js declares TC, the toast clock the host registry carries [171208,171235) 27 units sha256 ba8f0c48ec72a83277b1531e916380d50e225b1b5a79f7eecc65ead9a3ccf40c
var TC=()=>it().toastClock;

// chunk-24k7d6mw.js declares yee, which arms one timer for the stack's next deadline (dropping the one before it, skipping while paused or empty, and unref-ing the handle) [171235,171566) 331 units sha256 f708f2b740cdafe569feb66fcdf990a99cf11e9313fadfce174399ec7d720544
function yee(h,T){let M=TC();if(M.pending!==void 0)clearTimeout(M.pending),M.pending=void 0;let L=bu().map((he)=>(he.heldAt??he.leavesAt)+(he.heldAt===void 0?0:PF));if(M.pausedAt!==void 0||L.length===0)return;M.pending=setTimeout((he,we)=>{if(he===TC())he.pending=void 0,we()},Math.max(1,Math.min(...L)-h()),M,T),M.pending.unref()}

// chunk-24k7d6mw.js declares aV, the per-plugin cap: while a stack holds more than ACn, the largest non-managed group loses its oldest member, recursively [171566,171787) 221 units sha256 a51b76aee72b1a41522b223604be0ea78bbecfacd60e556fa5e069e409b43854
function aV(h){if(h.length<=ACn)return h;let T=h.at(-1)?.isManaged===!0,[M]=[...Map.groupBy(h.filter((L)=>T||!L.isManaged),(L)=>L.owner).values()].toSorted((L,ee)=>ee.length-L.length);return aV(h.filter((L)=>L!==M?.[0]))}

// chunk-24k7d6mw.js declares See, the report for a toast that left the stack before it was drawn (the log line and the once-per-plugin notice) [171787,172000) 213 units sha256 99801c7589ff45110bcef11a95e35dca38567b878448b6a7af7176ec7b15a738
function See(h){t(`$.ui.toast (${h.owner}): ${h.id} left the stack, never drawn`),CK({key:["toast undrawn",uMe(h.owner)].join(" "),lead:h.owner,text:"$.ui.toast: a toast left the stack before it was ever drawn"})}

// chunk-24k7d6mw.js declares bh, the stack writer: trim, write the trimmed stack when it differs from the reader's, report the entries that left undrawn, and run the fold through MF [172000,172257) 257 units sha256 7f75bda93d05bd2096ee127521f468eece2320c236285c1d9ce5932f5037471c
function bh(h,T){let M=aV(h),L=bu(),ee=new Set(M.map((we)=>we.id)),he=new Set(L.map((we)=>we.id));if(!$P(L,M))o5t(Pye(IF),M);L.concat(h.filter((we)=>!he.has(we.id))).filter((we)=>!ee.has(we.id)&&!cI.delete(we.id)).forEach(See),yee(T,()=>bh(MF(bu(),T()),T))}

// chunk-24k7d6mw.js declares wee, which builds the entry a plugin toast becomes (id from crypto's randomUUID, label from Nle, seat from sOn, deadlines from the toast clock) and writes the stack [172976,173176) 200 units sha256 fd390ea707196eb23cff291111bee6cba897d5af376ed73927f1245f254d16d2
function wee(h,T=Date.now){let M=T();bh([...bu(),{id:yvt(),owner:h.plugin,plugin:Nle(h.plugin),isManaged:sOn(h.plugin),text:h.text,shownAt:M,leavesAt:(TC().pausedAt??M)+h.timeoutMs,phase:"shown"}],T)}

// chunk-24k7d6mw.js declares EEe, the host toast method: remember the ids, push, and report whether the toast was stacked or the stack was full [173176,173443) 267 units sha256 18f1e6a5d5c683ee265c20d960745921d29cc4148dc3dabb55e5133b4bd3ca44
function EEe(h){let T=new Set(bu().map((ee)=>ee.id));wee(h);let M=bu().some((ee)=>!T.has(ee.id)),L=M?"stacked":"not stacked, the stack being full";if(M)AQo("toast stacked",h.plugin,()=>g("plugin_function_hooks_toast_stack"));t(`$.ui.toast: ${L} (${bu().length} up)`)}

// chunk-3qabb19b.js declares $P, the shallow list equality bh gates the store write on [732,883) 151 units sha256 766eb9b0a7e961e270d749dde4d904cf5711d3d243916471950b33bc40bf3c26
function $P(n,e){if(n===e)return!0;if(n===void 0||e===void 0||n.length!==e.length)return!1;for(let r=0;r<n.length;r++)if(n[r]!==e[r])return!1;return!0}

// chunk-sfn1dbxq.js declares SKr ("unnamed"), the label a plugin whose name cannot be resolved gets; the statement it shares with h3t (an unrelated bound-thread prompt) is taken whole so the declaration stays [4522274,4522361) 87 units sha256 0d2bc443a40e95d6553c827d62375c8875bf4d7f24c78e3f603c0f22bd583635
var h3t=`A message arrived in the bound thread while you were working:
`,SKr="unnamed";

// chunk-sfn1dbxq.js declares Nle, the plugin label policy: Mde's sanitized name, or "unnamed" when it resolves to null [4522361,4522420) 59 units sha256 423f86f0c47dab8c76b897fe1fb0b9856e9c54108f46578169396eb631861f77
function Nle(e){let n=Mde(e);return n===null?SKr:String(n)}


export { cI, RF, PF, MF, fee, IF, bu, TC, yee, aV, See, bh, wee, EEe, $P, SKr, Nle };
