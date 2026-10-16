// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The three classic hook sites the source writes by hand (classic.PreToolUse, tool.call, tool.check)
// and the rules they share with the copies already in the product: `C`, `L`, `Me`, `er`, `m$`, `we` from
// the runner copy, `g$`, `se` from the classic copy, `re` from the sites copy, `ua` (the memoized
// map-values its settle uses) from the lodash map-values copy, and crypto's `randomUUID` under the
// source's own alias. The stack has files of its own because both it and this closure declare an `L`.
import { randomUUID as mu } from 'node:crypto';
import { C, L, Me, er, m$, we } from './plugin-chain-source.js';
import { g$, se } from './plugin-chain-classic-source.js';
import { re } from './plugin-chain-sites-source.js';
import { ua } from './plugin-chain-lodash-mapvalues-source.js';

// chunk-m4qpskd4.js Qws: the permission decisions a classic answer may name [48214,48245) 31 units sha256 4086cc9666ef0da1645e678a50bd8ff537466bfb3809f045aae3f794e7cfe488
var Qws=["allow","ask","deny"];

// chunk-nyce03br.js declares oIt, Zbr, oo, W3e, W$n, ewr, … [7376,7551) 175 units sha256 f4651049998c198b51be0f8fa5759d75ff045f8b9e36280f3d2ffaf3f9d7b427
var oIt="anthropic/sources",Zbr=["claude/plugins",oIt],oo=[oIt],W3e="com.anthropic/sources-relay",W$n=mu(),ewr="com.anthropic/plugin-meta-cut",alt=262144,Hws="claude/omitted";

// chunk-nyce03br.js declares Dgo [7551,7609) 58 units sha256 f8432242e3061534fbbaffd412dd5d76f95e32df8e0be7d5b31c71f7cb80da0b
function Dgo(e){return new TextEncoder().encode(e).length}

// chunk-nyce03br.js declares twr [7609,8001) 392 units sha256 247a9180950768e29e0ac1b5eae9ad67f2749844d558e51bc69f61ee250a9624
function twr(e){if(e===void 0)return;if(!L(e))return"a requestMeta that is not an object";let t=0;for(let[o,r]of Object.entries(e)){if(!oo.includes(o))return`a requestMeta key a hook may not set (it may set ${oo.join(", ")})`;if(typeof r!=="string")return`a requestMeta value that is not a string (under ${o})`;t+=Dgo(r)}return t>alt?`a requestMeta of ${t} bytes (the most is ${alt})`:void 0}

// chunk-nyce03br.js declares Gs [16307,16335) 28 units sha256 3aa21e8edc905d6cfaa4b6d29a5568fc07d2a05b688307ea0c8b9a32301603b7
var Gs=(e,t)=>er(e)!==er(t);

// chunk-nyce03br.js declares vgo [16335,16391) 56 units sha256 6287383ca83aae91e2095186db343fdf6a8e0b2dba2158c19c5b6b3286970900
function vgo(e){let{isError:t,...o}=e;return t===!0?e:o}

// chunk-nyce03br.js declares vt [16583,16728) 145 units sha256 ac61b3f76e3870d836c530c1de64332e4cd288b33982b7649f0526097ae38cef
function vt(e,t){let o=new Map;for(let r of e)o.set(r,(o.get(r)??0)+1);for(let r of t){let n=o.get(r)??0;if(n===0)return!1;o.set(r,n-1)}return!0}

// chunk-nyce03br.js declares mr [17366,17397) 31 units sha256 eec0aa77eab875c109b1581b9294db06311e6e1b9649454f315d0d9ae86ce0a2
var mr=Object.freeze(Array(1));

// chunk-nyce03br.js declares io [18260,18608) 348 units sha256 deeea453b1839508cd58c202332df73f98a0f825263817580c7012e14c4e399e
function io(e,t){if(e!==void 0&&!g$(e))return"a context that is not a list of texts";let o=e===void 0?[]:g$(e)??[];if(o.some((s)=>s===""))return"a context with an empty entry";return t.every((s)=>vt(o,g$(s)??[]))?void 0:"a context without an entry a hook below attached (a hook adds to the context its next gave it; it may not leave an entry out)"}

// chunk-nyce03br.js declares ni [24689,24806) 117 units sha256 39f74726e0683818cec8caf91937eaa61dab660c4c910fa714ee82a018fa74ec
function ni(e,t,o){let r=er(t),n=o.filter((s)=>er(s.result)===r);return io(e,(n.length===0?o:n).map((s)=>s.context))}

// chunk-nyce03br.js declares si [25026,25114) 88 units sha256 ff69fe54ee994165ee37858cb115bf4b56373c50b14d59a372192e2b0bd242c3
var si=(e)=>(t,o)=>t[e]!==void 0&&o.some((r)=>r[e]===void 0)&&!o.some((r)=>r[e]===t[e]);

// chunk-nyce03br.js declares ft [25181,25321) 140 units sha256 4c7df0ac151a04df13b7ec7b819a76de8220269d6d728c53667373b8694761b6
function ft(e,...t){let o=new Set(t.flatMap((r)=>g$(r)??[]));return(g$(e)??[]).filter((r)=>!o.has(r)).reduce((r,n)=>Math.max(r,n.length),0)}

// chunk-nyce03br.js declares jt [42925,43074) 149 units sha256 a6e596b0e53546594d5f7e4f0b36827c4c1f7e5089a57b80d3c555812aeecfa5
function jt(e){let{keys:t,passed:o,received:r,explanation:n}=e,s=t.find((i)=>er(o[i])!==er(r[i]));if(s===void 0)return;return`a changed ${s} (${n})`}

// chunk-nyce03br.js declares Wn [103064,103154) 90 units sha256 1eba9b16075cbf09ad34ad8e5861b86a4042e2e0518793bb6f852d9e2347d476
function Wn(e,t){let{ceiling:o,...r}=e,{ceiling:n}=t;return n===void 0?r:{...r,ceiling:n}}

// chunk-nyce03br.js declares Vn [103154,103187) 33 units sha256 0f8fc2944328115ed278d5f1096df11199900b837f447c4f49566bd14180dafa
var Vn=(e)=>Qws.some((t)=>t===e);

// chunk-nyce03br.js declares wy [103187,103227) 40 units sha256 1c0e9643b3e63bf73be624a31d7e33bc331613e8f48d0101544f4353ed0de9a2
var wy=["tool","tool_use_id","agentId"];

// chunk-nyce03br.js declares je [103227,103246) 19 units sha256 212161c39a30cca98170a1fb161f7ae3189604710b65ffafe18d7b001c640e6c
var je="$shadowed";

// chunk-nyce03br.js declares j$n [103246,103268) 22 units sha256 a4777c68c2715a8d97c60c613d174e5dc2709d8b2bfb0ec99e14596cc896c62d
var j$n="requestMeta";

// chunk-nyce03br.js declares Gn [103268,103321) 53 units sha256 e485ed246426f88b08c4c82b086d3967782a28fb86036b593b078faf8b242113
var Gn=["tool","tool_use_id","agentId","consent",je];

// chunk-nyce03br.js declares Ay [103620,103642) 22 units sha256 d26326067f551faebf844b1fa9abbfff56e244eb72a2f219760d05032b30ecba
var Ay=["agentId",je];

// chunk-nyce03br.js declares Ude [103772,103888) 116 units sha256 86960d9a945f66478d85c0dbb7ed55b28a10f3fd75b0c3588a698a39c827bb97
function Ude(e){let{tool:t,tool_use_id:o,agentId:r,consent:n,requestMeta:s,[je]:i,...p}=e;return L(i)?{...p,...i}:p}

// chunk-nyce03br.js declares Vt [104050,104075) 25 units sha256 2a8e76577218e6fbdeef540a5a57f4241f489d18883360990cfd1f0aa96ef780
var Vt=(e,t)=>re(Gn,e,t);

// chunk-nyce03br.js declares zn [104075,104152) 77 units sha256 eecb9d4eec77addba3f7a7bb43440dd039324f87ec4cb8a79ee433f9789a0133
var zn=(e)=>L(e)?ua(e,(t,o)=>t===!1&&(o==="deny"||o==="ask"||o==="allow")):e;

// chunk-nyce03br.js declares Ua [104152,104568) 416 units sha256 6eb1d39fd31c708c18bf1fcd03f50724c67d666f1116eb9d42cc0f1fd47b9e27
var Ua={event:"classic.PreToolUse",restoreArgument:(e,t)=>m$([je],e,t),checkArgument:Vt,settle:zn,check:C(({deny:e,ask:t,allow:o})=>{let r=typeof e==="string"||typeof t==="string";return!r&&(e!==void 0||t!==void 0)?"a deny or ask that is not a string":!r&&o!==void 0&&o!==!0?"an allow that is not true":void 0}),carry:(e,t,o)=>e.updatedInput===void 0&&typeof e.deny!=="string"&&Gs(t,o)?{...e,updatedInput:Ude(t)}:e};

// chunk-nyce03br.js declares Xn [104568,104838) 270 units sha256 5c954bba1e08705d2272240dca8f3f0795e78d15f708d04d260cd6715bdd3307
function Xn(e,t){let{isReadOnly:o,...r}=e;if(r.deny!==void 0||r.ref===void 0)return r;let n=t.findLast((p)=>p.ref===r.ref),s=er(r.result);return n!==void 0&&n.isReadOnly===!0&&(r.result===void 0||r.result===n.result||s!==void 0&&s===er(n.result))?{...r,isReadOnly:!0}:r}

// chunk-nyce03br.js declares Yn [104838,104873) 35 units sha256 1263d7b916288816da863f011ec3f42b938116336c6ef091b2dc6fe6f1889fc3
var Yn=(e,t)=>Vt(e,t)??twr(e[j$n]);

// chunk-nyce03br.js declares Jn [104873,104962) 89 units sha256 f75bb21239186cfcc988bd7706df133a22cc5453922a1139a15f27d4f556323b
function Jn(e){let t={...e};return t.context===void 0?t:{...t,context:g$(t.context)??mr}}

// chunk-nyce03br.js declares qn [104962,105113) 151 units sha256 46f4a09693abf733c78d22e68c7244c4caa542353ee4b379e4f60389d8c273d2
function qn(e){let{decision:t,reason:o,rule:r,hook:n}=e,s={decision:t};if(o!==void 0)s.reason=o;if(r!==void 0)s.rule=r;if(n!==void 0)s.hook=n;return s}

// chunk-nyce03br.js declares Ba [105113,105501) 388 units sha256 8adf57dcbb2022bfe77b916549d96bf682b2fd47da85cc466083066656a28edb
var Ba={event:"tool.call",restoreArgument:(e,t)=>m$([...Ay,j$n],e,t),checkArgument:Yn,pinnedKeys:wy,settle:Jn,stripResult:Xn,check:C((e,t,o)=>{let r=e.deny===void 0;return Me(e,"{ result }",(n)=>Object.hasOwn(n,"result"))??(r?ni(e.context,e.result,(o??[]).filter((n)=>n.deny===void 0)):void 0)}),measure:(e,t,o)=>ft(e.context,...o.map((r)=>r.context)),isLateRefusal:si("deny"),carry:vgo};

// chunk-nyce03br.js declares Qn [105501,105559) 58 units sha256 2dfbbd50ea76f27c2c278422a8dfc390939ab36fe1c63790cc74c915472a20de
var Qn=["tool","input","tool_use_id","agentId","ceiling"];

// chunk-nyce03br.js declares Zn [105559,105602) 43 units sha256 55ff5bf49f96decf4681c7f99710e87114f492743468444ed787e7a87b558af5
var Zn=["tool_use_id","agentId","ceiling"];

// chunk-nyce03br.js declares Ka [105602,106133) 531 units sha256 fea506a7d51e94649170eb2c75023f82a5218123a84632f5478670f84bdf0337
var Ka={event:"tool.check",restoreArgument:(e,t)=>m$(Zn,e,t),checkArgument:(e,t)=>jt({keys:Qn,passed:e,received:t,explanation:"the tool, its input and the call are the question and are pinned; a hook answers { decision }, it does not ask about another call"}),settle:qn,restoreResult:(e,t,o)=>Wn(e,o),check:C((e)=>{let{decision:t,reason:o,rule:r,hook:n}=e;if(!Vn(t))return`no { decision } (one of ${Qws.join(", ")})`;return[o,r,n].every((i)=>i===void 0||typeof i==="string")?void 0:"a reason, rule or hook that is not a string"})};


export { Ua, Ba, Ka, Vn, Qws, zn, Gn, Ude, Yn, Jn, qn, Xn, Wn, Vt, wy, je, j$n, Ay, Qn, Zn, twr, io, vt, jt, ni, si, ft, mr, Gs, vgo, oo, Dgo };
