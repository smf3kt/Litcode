// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-2kdsvp3x.js sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2
//   chunk-kwp08k6x.js sha256 30dd63de691cb91bb82fe15f6073761e0e53c4b76025cd28c8e5274686773aab
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The generic classic raise: every classic hook event goes through `znr`, which folds the module
// handlers, the managed pass and the event core into the site the name maps to (`FDe`), after the
// async pre-gate (`Cro`/`N5t`) that waits for a module whose hooks are still loading. `le` is the
// source's own call entry for a classic event, and `fe` shapes the hook input it is handed.
// `Bde` is what the pre-gate rejects with when the signal aborted while it waited.
// `Q_t`/`die` are the gates the product path asks before raising at all, and `h7n` (with
// `cie`/`cU`/`p7n`/`Rkt`/`Pkt`/`lM`) is the fold from the chain answer to the record list a caller sees.
import { it } from './plugin-chain-host.js';
import { aP, L, He, Ke, Ye, wlt } from './plugin-chain-source.js';
import { ua } from './plugin-chain-lodash-mapvalues-source.js';
import { Bbr, Ewr } from './plugin-chain-classic-source.js';
import { P0, aJ, iOn } from './plugin-chain-records.js';
import { Jl } from './plugin-chain-relay-source.js';
// Port: the source's store (`it()`) hands the gate the loaded modules and the respawn set; in this
// product they are the host's own inventory and reload set, which are already imported above.
// Port: `He`/`Ke`/`Ye`/`wlt` are the source's chain error, its abort-error test, its abort error class and
// its abort message; all four are already byte-identical in the runner copy, so they are imported, not rewritten.
// Port: `K()` is the session id and `se()` the working directory; both are host values here, and a caller
// may hand both in through the payload `fe` spreads over them.
// Port: `pn` is `Bun.stripANSI` (chunk-gyf58rwf.js [9076,9110)); this product does not run on Bun, and
// the source's behaviour at its single call site (`p7n`) is only to drop escape sequences before
// reading the last line, so the host supplies the strip.
var K = () => '';
var se = () => '';
var pn = (e) => String(e).replace(/\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '');

// chunk-nyce03br.js declares Bde [123587,123677) 90 units sha256 dbce995599bedf6b16ec9755a93d0075c739769b73648d9109eb02a099e78bef
function Bde(e,t){return[t,e.reason].find((o)=>o instanceof Error&&Ke(o))??new Ye(wlt(e))}

// chunk-2kdsvp3x.js declares N5t [38835,38972) 137 units sha256 e31a53a34e62d6c8923a5943d9ac2b68d7dfae0ed8dc497b6a68de2545cb3bf1
function N5t(e,r){let n=it();return n.hooksRespawns.size>0&&n.loadedModules.some((i)=>i.link===void 0&&i.hooks(e.event))?iOn(e,r):void 0}

// chunk-2kdsvp3x.js declares Cro [38972,39124) 152 units sha256 fc4bc95cbebd2a273e5e5f4d94cc84d1b28562ebaa394124b32d903997f59d3d
function Cro(e,r){let s=e.event==="classic.SessionEnd"?void 0:N5t(e,r);return s!==void 0&&r!==void 0?s.catch((f)=>Promise.reject(r.aborted?Bde(r):f)):s}

// chunk-kwp08k6x.js declares fe [16626,16718) 92 units sha256 df032fef740a67378587142918b500fefcc4807ba96a56d5f2133d41a650fbd6
var fe=(e,r)=>({session_id:K(),transcript_path:"",cwd:se(),...L(r)?r:{},hook_event_name:e});

// chunk-kwp08k6x.js declares le [16718,17014) 296 units sha256 dea457ad78c5157913258f250646c9c9ef0d007e50ac6b0705420892c570e68a
function le(e,r){let n=e.slice(8);if(n==="PreToolUse")throw new He("$.classic.PreToolUse is no call on the engine's $: the engine raises it inside tool.call, so a test calls $.tool.call");if(!Gnr(n))throw new He(`$.${e} is no call on the engine's $`);return(i)=>znr({hookInput:fe(n,i),signal:r})}

// chunk-sfn1dbxq.js declares Gnr [556178,556225) 47 units sha256 53c3ac07265f0225a52fed50641f8831d586194b06b9f1596745ec471bd805f2
var Gnr=(e)=>e!=="PreToolUse"&&Ewr.includes(e);

// chunk-sfn1dbxq.js declares Q_t, the gate the product path asks before raising [556225,556265) 40 units sha256 4f307c05d317597278d434fdc2a774eed4a7bdaeedc021eeb3f6dad34b86e4b1
var Q_t=(e)=>Gnr(e)&&Jl(`classic.${e}`);

// chunk-sfn1dbxq.js declares FDe [556265,556293) 28 units sha256 678c5b40ee8c3e38012b9158329826343715d9173485e70b7de9ff888f7e17aa
var FDe=(e)=>`classic.${e}`;

// chunk-sfn1dbxq.js declares die, the plain per-event gate [556293,556325) 32 units sha256 82d6dabe11d1442f96a4bea0b6a037901e78800fb7d6694271da31dc872ab882
var die=(e)=>Jl(`classic.${e}`);

// chunk-sfn1dbxq.js declares lM, the drop-undefined fold the records use [557292,557326) 34 units sha256 b94547f6aff6209a581ceaa4afc214b57925c3ea0e4f20f9a7366154567924d5
var lM=(e)=>ua(e,(n)=>n===void 0);

// chunk-sfn1dbxq.js declares gkt, the text a hook answer blocks with [558335,558460) 125 units sha256 8d2c92f077bc7b054294acb1885a5d7b65fd91124aa00187a519e9470df5a579
function gkt(e){return e.block===void 0&&e.permissionDecision==="deny"?e.permissionDecisionReason??"Blocked by hook":e.block}

// chunk-sfn1dbxq.js declares znr, the generic raise itself [559965,560231) 266 units sha256 0c6d55c483297e47ff076fab92c599e3fb6386c30557761fa7571cfe45fa7cff
function znr(e){let{hookInput:n,managed:r,core:s,signal:h,origin:y}=e,b=FDe(n.hook_event_name),w=Cro({event:b,e:n,origin:y},h);return w!==void 0?w.then(()=>znr(e)):(()=>aP({e:n,handlers:[r,...P0(b,y),s].filter((V)=>V!==void 0),site:Bbr(b),signal:h,origin:aJ(y)}))()}

// chunk-sfn1dbxq.js declares Rkt, the blocked record [561742,561804) 62 units sha256 8e1fe6977ee42a284cba86991ab6e6d5696452e1072698f6cefb52d68e53dac0
var Rkt=(e,n)=>({command:e,succeeded:!1,output:n,blocked:!0});

// chunk-sfn1dbxq.js declares p7n, the last non-empty line of a hook's output [561804,561890) 86 units sha256 dd991bdac3d4e4d8c2c26babf20126b14d6eba94adee98e5fdb8734d94fe2df8
function p7n(e){return pn(e).split(`
`).map((n)=>n.trim()).filter(Boolean).at(-1)??""}

// chunk-sfn1dbxq.js declares cU, the first surviving output line [561890,562000) 110 units sha256 7e677e1af0d0cbbd3641fc41f87639aac83a1afcc7292555bde6c199f0e7a9f2
function cU(e){return e.filter((n)=>n.succeeded&&!n.answerHeld).map((n)=>p7n(n.output)).find((n)=>n.length>0)}

// chunk-sfn1dbxq.js declares cie, the block a record list stands for [562000,562127) 127 units sha256 5ec8d679a85003c9fe37b4147339875a597a10fb02ebd18c2c748dba3d143a86
function cie(e,n){let r=e.find((h)=>h.blocked),s=n==="WorktreeCreate";return lM({block:r?.output,worktreePath:s?cU(e):void 0})}

// chunk-sfn1dbxq.js declares Pkt, the worktree record [562402,562464) 62 units sha256 04a117a0c6762f4f76a1890c0fc643fd96fabd8b40efe2cbd595b968b350dc70
var Pkt=(e,n)=>({command:e,succeeded:!0,output:n,blocked:!1});

// chunk-sfn1dbxq.js declares h7n, the record list the raise folds to [562464,562773) 309 units sha256 38b817be829a8d9950ae55c2ee9ccf33c48fdf37b09e575d6939100673d3103c
function h7n(e,n,r){let s=cie(e,r.event),h=n.block===s.block,y=r.event!=="WorktreeCreate"||n.worktreePath===s.worktreePath,b=e.filter((z)=>(h||!z.blocked)&&(y||cU([z])===void 0)),w=h?void 0:n.block,M=y?void 0:n.worktreePath;return[...b,...w===void 0?[]:[Rkt(r.command,w)],...M===void 0?[]:[Pkt(r.command,M)]]}


export { fe, le, Gnr, FDe, N5t, Cro, znr, Q_t, die, lM, gkt, Rkt, p7n, cU, cie, Pkt, h7n, Bde };
