// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3qabb19b.js sha256 ceb8c8490f39408310286cc14cacb1998192c8c34a80724882f988431f1bf5f2
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The `$` session read floor (W45-44): the entries that answer from the bound session, and the
// drawing-surface registry behind `session.surface`/`session.surfaces`. Every body is the module's
// text. `bI` (the bound session) is W45-24's host binding; `t` (the chain log) and the four
// process fallbacks `K`/`se`/`Ee`/`tt` come from the host seam; `Ge` and `D` from the copied chain
// source; `Oe` is W45-35's sources-change signal, which the drawing registry emits a detach on.
import { bI } from './plugin-chain-loader-source.js';
import { D, Ge } from './plugin-chain-source.js';
import { Oe } from './plugin-chain-registry-stores-source.js';
import { K, Ee, se, t, tt } from './plugin-chain-host.js';

// chunk-3qabb19b.js declares F, the count of a list's members a predicate answers for [673,732) 59 units sha256 8dfba6c6fce4cbf7879b76db23ff835a055481d92e7df90b4d119514b1d6a950
function F(n,e){let r=0;for(let t of n)r+=+!!e(t);return r}

// chunk-sfn1dbxq.js declares T9n, whether message content is tool results rather than a person's turn [492112,492181) 69 units sha256 ba15114fa71bc3bfc65ef35bf82c1c76baff209f3e05dee6cc430e8dbc9a5660
var T9n=(e)=>typeof e!=="string"&&e.some((n)=>n.type==="tool_result")

// chunk-tvdq3hrk.js declares ie, the drawing-session registry: attach keeps a client's viewport and answers, detach reports through the sources-change signal [2085,2727) 642 units sha256 384b0e691055cd9e950d8e3c580037051a464fac6db2de061230f965a82546f7
function ie(){let e=new Map,r=new Set,n=()=>[...e.values()],i=Oe();return{attach:(s)=>{let a=e.get(s.clientId);if(r.delete(s.clientId),a===void 0)return e.set(s.clientId,s),!0;if(s.viewport!==void 0||s.answers!==void 0)e.set(s.clientId,{...a,...s.viewport!==void 0&&{viewport:{...a.viewport,...s.viewport}},...s.answers!==void 0&&{answers:s.answers}});return!1},detach:(s)=>{let a=e.get(s);return e.delete(s),r.delete(s),i.emit(s),a},hasSurface:(s)=>n().some((a)=>a.surface===s),list:n,surfaces:()=>D(n().map((s)=>s.surface)),onDetach:(s)=>i.subscribe(s),missed:(s)=>{if(e.has(s))r.add(s)},heard:(s)=>void r.delete(s),isSilent:(s)=>r.has(s)}}

// chunk-tvdq3hrk.js declares gE, the registry instance every surface read goes through [2727,2792) 65 units sha256 cab05ddf3fb118d397397c19287007f685da8c619e67e93843f62d0c7459ab82
var gE=Ge(ie(),(e)=>{for(let r of e.list())e.detach(r.clientId)})

// chunk-sfn1dbxq.js declares Bpe, the session record the cwd/root/model/id entries answer with [1698766,1698968) 202 units sha256 66102dd181d07a30065193c57f36aa25e4ce59c4bf929be7e67aeea9d2d4b41b
async function Bpe(e,n){let r=bI();if(r===void 0)t(`$.session (${e}): no session bound; id, cwd and model answered from the process`);return{id:String(K()),cwd:n??se(),root:Ee(),model:r?.model()??tt()}}

// chunk-sfn1dbxq.js declares WAo, the user turns the session holds: not meta, not virtual, not tool results [1703496,1703695) 199 units sha256 a6a8c32d0f80801848aefae996a855b9b25795c3cd6036437a047b2a4b75004f
async function WAo(e){let n=bI();if(!n)return t(`$.session.turns (${e}): no session bound; 0`),0;return F(n.messages(),(r)=>r.type==="user"&&r.isMeta!==!0&&r.isVirtual!==!0&&!T9n(r.message.content))}

// chunk-sfn1dbxq.js declares Xte, the drawing surfaces: the terminal first when this process draws to one [450195,450316) 121 units sha256 daa73fd29b3dce563e7ec7f9efcc32cc8ba08c4e287d256253da9832962ddd83
function Xte(){let e=bI()?.surface==="terminal",n=gE.surfaces().filter((r)=>r!=="terminal");return e?["terminal",...n]:n}

// chunk-sfn1dbxq.js declares uMo, the surface a session draws to, or null [1820356,1820482) 126 units sha256 a1ce8557155f78df09674bc00b6b290b39a47ff764e7b447dc8b57f143a834ef
async function uMo(e){let n=Xte()[0]??null;if(n===null)t(`$.session.surface (${e}): no drawing session bound; null`);return n}

// chunk-sfn1dbxq.js declares cMo, every surface a session draws to [1820482,1820600) 118 units sha256 78dc365124bef07f50fa831d5e497e491352a45f4b971ff046f9d7a9d3ae31f0
async function cMo(e){let n=Xte();if(n.length===0)t(`$.session.surfaces (${e}): nothing attached draws; []`);return n}


export { F, T9n, ie, gE, Bpe, WAo, Xte, uMo, cMo };
