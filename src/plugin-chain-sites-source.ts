// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-btcaa7nx.js sha256 bd6433a1d0f3e3132f7826fcd967f1dc97ed0f19990ea0f865822d4af6e030e3
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// `Nl` is chunk-nyce03br.js's own logger declaration; its port lives in ./plugin-chain-host.ts and the
// copied bodies report through it exactly as they did in the source.
import { Nl, rse } from './plugin-chain-host.js';
// The shared helpers these sites close over are already copied verbatim into ./plugin-chain-source.ts
// from the same chunk; importing them keeps one copy of each body in the tree.
import { B, C, L, Me, er, fe, m$, ne, tT, we } from './plugin-chain-source.js';

// chunk-nyce03br.js iD: the hole-preserving array copy the site rules build their lists with [6678,6770) 92 units sha256 ff058a725b75b5486de57808fddb172f011a77af9f17e0d5acbd9879698f8976
function iD(e){let t=B(e),o=[];o.length=t;for(let r=0;r<t;r+=1)if(r in e)o[r]=e[r];return o}

// chunk-nyce03br.js at: the first index whose mapper returns a value [16200,16307) 107 units sha256 652b808517055571d67f6ae94220eb6e905dd010f8b0184286361985b67f3ac6
function at(e,t,o=B(e)){for(let r=0;r<o;r+=1){let n=r in e?t(e[r]):void 0;if(n!==void 0)return[r,n]}return}

// chunk-nyce03br.js At and fr: the truncation text and the kept/keptResult pair the argument checks return [16740,16959) 219 units sha256 48b74e79d9391b866becf34d5635d310e3d2c50dc5da4fc0f203c7c8c446e08f
var At=(e)=>`${ne(e,tT)}\u2026`;var fr=(e,t,o)=>({kept:{...e,...Object.fromEntries(o.map(([r,n])=>[r,At(n)]))},why:`${/^[aeiou]/u.test(t[0])?"an":"a"} ${t[0]} of ${t[1].length} characters, kept up to its first ${tT}`});

// chunk-nyce03br.js Ee: the changed-argument lookup the describe sites restore through [16959,17208) 249 units sha256 52ddd0b18cde94c048d902f31657d0a5b41a7bbe70e12ea17aeef690dee1eac4
function Ee(e,t,o){let r=o.map((i)=>new Map(Object.entries(i))),n=Object.entries(e).flatMap(([i,p])=>t.includes(i)&&typeof p==="string"&&p.length>tT&&!r.some((f)=>f.get(i)===p)&&At(p)!==p?[[i,String(p)]]:[]),[s]=n;return s===void 0?void 0:fr(e,s,n)}

// chunk-nyce03br.js re: the `a changed <field>` message [17208,17366) 158 units sha256 e1315c8e8aa4a157947d4f7e2da1a477eec49fd86cb744c6d6493875da70e1c2
function re(e,t,o){let r=e.find((n)=>er(t[n])!==er(o[n]));if(!r)return;return`a changed ${r} (the envelope is the engine's; a rewrite keeps ${e.join(", ")})`}

// chunk-nyce03br.js ur: the `no { text }` check [17397,17514) 117 units sha256 d71d2bd98a029982e7fbb27817358c8d0214a24f5d08080c9ee6c8336caff0cd
function ur(e,t){return e===null||typeof e==="string"?void 0:`no { text } (a string, or null to leave the ${t} out)`}

// chunk-nyce03br.js ao: the instruction-block ceiling [20175,20185) 10 units sha256 0a0451c405a397e2a10d43c8e4ebd6f4ca8cdcc976f42777989b5541dbc86f38
var ao=32;

// chunk-nyce03br.js lr: the instruction-file check [20185,20727) 542 units sha256 51a791c642085a3a75ad3338534d369f1586ff8f80f432ea7e916a1ee52ecc73
function lr(e,t){if(!L(e))return`an instruction file that is not { path, kind, content } (at ${t})`;let{path:o,kind:r,content:n,parent:s}=e;if(typeof o!=="string"||o==="")return`an instruction file without a path (at ${t})`;if(!(typeof r==="string"&&Jws.some((a)=>a===r)))return`an instruction file whose kind is not one of ${Jws.join(", ")} (${o})`;if(typeof n!=="string")return`an instruction file whose content is not a string (${o})`;return s===void 0||typeof s==="string"?void 0:`an instruction file whose parent is not a string (${o})`}

// chunk-nyce03br.js yr: an instruction file's path, or the empty string [20727,20799) 72 units sha256 1f61eeeb71d2e52f4227542f5b04b6313a3ff3772608b0fe11603f51cc8c489d
function yr(e){let t=L(e)?e.path:void 0;return typeof t==="string"?t:""}

// chunk-nyce03br.js Ct: the instructionFiles list check [20799,21103) 304 units sha256 03cb30120065fd369db4c3cbca818a3fd027a408a99ee3435115e52f9524642b
function Ct(e){if(e===void 0)return;if(!Array.isArray(e))return"instructionFiles that is not a list of { path, kind, content }";let t=B(e),o=new Set;for(let r=0;r<t;r+=1){let n=e[r],s=lr(n,r);if(s!==void 0)return s;let i=yr(n);if(o.has(i))return`two instruction files with the path ${i}`;o.add(i)}return}

// chunk-nyce03br.js gr: the prompt.context argument check [21103,21695) 592 units sha256 5121d6cf86b42b93edea2c233c6003f7524ee822a338e39ab747f9b308d88b0b
function gr(e){let{blocks:t}=e,o=Ct(e.instructionFiles);if(o!==void 0)return o;if(!Array.isArray(t))return"no { blocks } (a list of { name, text })";let r=B(t);if(r>ao)return`more than ${ao} blocks`;let n=new Set;for(let s=0;s<r;s+=1){let i=t[s];if(!(Object.hasOwn(t,s)&&L(i)))return`a block that is not { name, text } (at ${s})`;let{name:a,text:f}=i;if(typeof a!=="string"||a==="")return`a block without a name (at ${s})`;if(typeof f!=="string")return`a block whose text is not a string (${a})`;if(n.has(a))return`two blocks named ${a} (the engine keys the context by name)`;n.add(a)}return}

// chunk-nyce03br.js Zs: the instruction-file kind's label [21990,22160) 170 units sha256 50e9a08324873e877eed1ca62f16cbe7b0b6d150a468b8351bf18f537bc24d5f
function Zs(e){switch(e.kind){case"managed":return"Managed";case"user":return"User";case"project":return"Project";case"local":return"Local";case"memory":return"AutoMem"}}

// chunk-nyce03br.js kws: the element-by-element deep equality the prompt.context rules compare with [22265,22495) 230 units sha256 69e34f761311cf604daa4628f7c5984277e7d3c3099ee737b4cb69c9c16aa6b0
function kws(e,t){let o=B(e);if(o!==t.length)return!1;for(let r=0;r<o;r+=1){let n=e[r],s=t[r];if(!(!(r in e)||n!==void 0&&s!==void 0&&n.path===s.path&&n.kind===s.kind&&n.content===s.content&&n.parent===s.parent))return!1}return!0}

// chunk-btcaa7nx.js Loe: the auto-memory content reader the per-file text uses [1595,1628) 33 units sha256 9e780ee846ab2435727da0eaf6d11c8d8c78d0087d6c211d765b752083aa3e7b
function Loe(t){return rse(s(t))}

// chunk-btcaa7nx.js Sho and i: the dropped code points and the invisible-character pattern klt reads [1757,1838) 81 units sha256 0fe189971ffac106b9dea61bd7620c5c3f4707a96cd1f794d201f646fbd389a7
var Sho=new Set([8204,8205,65038,65039]),i=/^[\p{Cf}\p{Co}\p{Cn}\p{Cs}\p{DI}]$/u;

// chunk-btcaa7nx.js klt: the invisible-character test the record filter drops on [1838,1962) 124 units sha256 e9921674edecb3730af52e70f0df90d09901ab7a1f22ed52d69b6324d1d8ed9d
function klt(t){let r=t.codePointAt(0);if(Sho.has(r)||r===9||r===10||r===13)return!1;return i.test(t)||r<32||r>=127&&r<=159}

// chunk-btcaa7nx.js s: the separator and invisible-character normalization the reader applies first [1962,2071) 109 units sha256 e2d38698d91b11b632d7ed4831fe1af14cb3534b228837cedad9cabedb9bdc43
function s(t){let r="";for(let n of t.replace(/\r\n?|[\u2028\u2029]/g,`
`)){if(klt(n))continue;r+=n}return r}

// chunk-nyce03br.js ti: the instruction-file kind's parenthesised note [22989,23378) 389 units sha256 12ff4084298029f33f5767e8334757d46b11ca507acbd6d966a95a8eef49543a
function ti(e){switch(e){case"Project":return" (project instructions, checked into the codebase)";case"Local":return" (user's private project instructions, not checked in)";case"AutoMem":return" (user's auto-memory, persists across conversations)";case"Managed":return" (organization-managed policy instructions)";case"User":return" (user's private global instructions for all projects)"}}

// chunk-m4qpskd4.js Jws: the instruction-file kinds, in order [47970,48024) 54 units sha256 aa123f0f25f0fbb2d73d06e7853982a0301cb755b6807d4dc8cb7ceebee3bafb
var Jws=["managed","user","project","local","memory"];

// chunk-nyce03br.js ei: the instruction preamble text [22786,22989) 203 units sha256 ee987e41aec33ae96b28889a4e25c0ce05c16a45b0a604a606c5178e2f73a87e
var ei="Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.";

// chunk-nyce03br.js Nbr: the per-file `Contents of` text [23378,23524) 146 units sha256 0541fbd8b7df728baa434f424c5d3f59e3f960f7bed30a42f3724dd95f4c047b
function Nbr(e){return e.map((t)=>`Contents of ${t.path}${ti(t.type)}:

`+(t.type==="AutoMem"?Loe(t.content).trim():t.content.trim())).join(`

`)}

// chunk-nyce03br.js EFe: the preamble joined to the file list [23524,23584) 60 units sha256 09263a24f8f50eb2f3db1c1a74e46a32e16b9c858c51d53874548704e5317947
function EFe(e){let t=Nbr(e);return t===""?"":`${ei}

${t}`}

// chunk-nyce03br.js pt: the file list mapped to { path, type, content } [23584,23672) 88 units sha256 bf1eb8a67db8d30573362453a6239dffb373b1988fde82d31a215a62fd5e3b83
function pt(e){return EFe(iD(e).map((t)=>({path:t.path,type:Zs(t),content:t.content})))}

// chunk-nyce03br.js fo: whether a value is an instruction-file list [23672,23727) 55 units sha256 11b008b4759d495bf3af663704fd0a82ade24fda5c6523a78df1249668b45a34
function fo(e){return Array.isArray(e)&&Ct(e)===void 0}

// chunk-nyce03br.js kr: the file list, or undefined [23727,23768) 41 units sha256 1efea1ac827b62a1e424475e25a61cd0045ce9c6bc55c14bbc4d9ed260bdf13c
function kr(e){return fo(e)?pt(e):void 0}

// chunk-nyce03br.js wr: the prompt.context measure [23768,24159) 391 units sha256 3b463296181c7899b031a2e6fad3ff5d3ab45c207d1de916934bf7f077dd80de
function wr(e,t,o){let r=new Map;for(let i of[t,...o].flatMap((p)=>p.blocks))r.set(i.name,(r.get(i.name)??new Set).add(i.text));let n=Array.isArray(e.blocks)?iD(e.blocks):[],s=kr(e.instructionFiles);return n.filter(L).flatMap(({name:i,text:p})=>{let a=r.get(String(i))?.has(String(p))===!0||i==="claudeMd"&&p===s;return typeof p==="string"&&!a?[p]:[]}).reduce((i,p)=>Math.max(i,p.length),0)}

// chunk-nyce03br.js _t: the blocks-list copy the restores put back [24806,25026) 220 units sha256 a27ab69b66c727a7b26b01be320b57443fe3020cb2d815fb4a5cccee1525e5aa
function _t(e){if(!Array.isArray(e))return e;let t=B(e),o=[];for(let r=0;r<t;r+=1){if(!Object.hasOwn(e,r)){o.push(void 0);continue}let n=e[r];o.push(L(n)?Object.fromEntries(Object.keys(n).map((s)=>[s,n[s]])):n)}return o}

// chunk-nyce03br.js mo and ft: the restore-argument builder and the union of a list's keys [25114,25181) 67 units sha256 1b8b1afd6c6e76af464b60d800f2689e9a641b673a2429045d82c2d8cdada363
var mo=(e,t)=>(o,r)=>{let n=m$(e,o,r);return Ee(n,t,[r])?.kept??n};

// chunk-nyce03br.js mt and Er: the per-field measurer and the `{ value }` check it is built on [25395,25450) 55 units sha256 656be2a261952e03cdf842e671d0cd1d2ed393d14b12b16048f9b30d617d15c3
var mt=(e)=>(t,o,r)=>fe(t[e],o[e],...r.map((n)=>n[e]));

// chunk-nyce03br.js Sr: whether a suggestion entry is usable [25893,26158) 265 units sha256 73355e86ca53d5f4286a5f7eb147b74736a9dabbcd7b9166bead94b9e844880b
function Sr(e){return L(e)&&typeof e.text==="string"&&e.text!==""&&["string","undefined"].includes(typeof e.label)&&["string","undefined"].includes(typeof e.description)?void 0:"a suggestion that is not { text, label?, description? } (strings, the text not empty)"}

// chunk-nyce03br.js Or: the suggestions check [26158,26262) 104 units sha256 8a6d184d9c73021b6c90f9eb500e848e9c0b9fd57fc9d18b961e80dcd616ec90
function Or(e){let{suggestions:t}=e;return Array.isArray(t)?at(t,Sr)?.[1]:"no { suggestions } (a list)"}

// chunk-nyce03br.js vr: the suggestions restore [26262,26313) 51 units sha256 8559948885a41201e4811bbdbf77ec0311093cfcb92df4187e0965b41692ba61
var vr=(e)=>({...e,suggestions:_t(e.suggestions)});

// chunk-nyce03br.js ai: the prompt.autocomplete site [26313,26489) 176 units sha256 a67d712fb641c395b78b784d67ef37819c18d06bf1fe15a094c7431224acc486
var ai={event:"prompt.autocomplete",restoreArgument:we(["text","cursor","token","start"]),checkArgument:(e,t)=>re(["text","cursor","token","start"],e,t),settle:vr,check:C(Or)};

// chunk-nyce03br.js go: the command.describe argument check [30898,31169) 271 units sha256 216578e349b2acbdf322a874878e0dcf9b7e5b378adb84d3d079fa83aea3c663
function go(e){let{description:t,argumentHint:o,isHidden:r}=e;if(typeof t!=="string")return"no { description } (a string)";if(!(o===void 0||typeof o==="string"))return"an argumentHint that is not a string";return typeof r==="boolean"?void 0:"no { isHidden } (a boolean)"}

// chunk-nyce03br.js Pt: the command fields the check is applied to [31169,31207) 38 units sha256 0f195d9bd20d2af2c90aa1540b7ce411b29abed26a58fea3597e9e70b8510276
var Pt=["description","argumentHint"];

// chunk-nyce03br.js xi: the command.describe site [31207,31729) 522 units sha256 0fd6bb6cbd6f122ab969f25d08141e93109356f7830fdfc4d993b990dd371430
var xi={event:"command.describe",unappliedArgument:(e,t)=>Ee(e,Pt,[t])?.why,restoreArgument:mo(["provider"],Pt),checkArgument:(e,t)=>{if(e.command!==t.command)return"a changed command (the engine lists and caches by it)";if(e.immediate!==t.immediate)return"a changed immediate (read only: the command declares whether it runs mid-turn; next(e) passes it on)";return er(e.provider)===er(t.provider)?go(e):"a changed provider (pinned: who provides the command is a fact)"},check:C(go),keptResult:(e,t,o)=>Ee(e,Pt,[t,...o])};

// chunk-nyce03br.js It: the config.describe argument check [32975,33138) 163 units sha256 c418b177381255e17072ad773d102f33bf58669b534cf4eebd06e2bbb52ec745
function It(e,t){let o=e.key!==t.key,r=er(e.provider)!==er(t.provider);return(o?"a changed key (pinned)":void 0)??(r?"a changed provider (pinned: a fact)":void 0)}

// chunk-nyce03br.js xo: the config key check [33138,33412) 274 units sha256 1b7be7be00e2cd807c36c6b46e928b351fe9407595160320f1a131a3d4be33fe
function xo(e){let{label:t,description:o,isHidden:r}=e;if(!(typeof t==="string"&&t!==""))return"no { label } (a non-empty string)";if(typeof r!=="boolean")return"no { isHidden } (a boolean)";return o===void 0||typeof o==="string"?void 0:"a description that is not a string"}

// chunk-nyce03br.js Ht: the config fields the check is applied to [33412,33443) 31 units sha256 fbbb8cbad4c1710ecdb40d4a5f5000b7a66e5bb120961b79e4c63edad30c95bd
var Ht=["label","description"];

// chunk-nyce03br.js Ei: the config.describe site [33443,33641) 198 units sha256 33764662ddfa128ee4715d81c22afedb3c5f07e999a27465efde4727c437607b
var Ei={event:"config.describe",checkArgument:(e,t)=>It(e,t)??xo(e),unappliedArgument:(e,t)=>Ee(e,Ht,[t])?.why,restoreArgument:mo(["provider"],Ht),check:C(xo),keptResult:(e,t,o)=>Ee(e,Ht,[t,...o])};

// chunk-nyce03br.js Di: the attribution.text site [37791,38157) 366 units sha256 b2efbd4b48c81a110dfecfe368db3a94c892fb2743ef49944aa45c23767751b1
var Di={event:"attribution.text",checkArgument:(e,t)=>{let o=e.kind;if(typeof o!=="string")return"no { kind }";if(o!==t.kind)return"a changed kind (the hooks beneath match on it)";return typeof e.text==="string"?void 0:"no { text }"},measureArgument:(e,t)=>fe(e.text,t.text),check:C((e)=>typeof e.text==="string"?void 0:"no { text } (a string)"),measure:mt("text")};

// chunk-nyce03br.js Bi: the prompt.attachment site [38896,39361) 465 units sha256 86eab7d4120ba7950eb601b784e3e6383d2979013316ff1acdba1b6296ee2603
var Bi={event:"prompt.attachment",restoreArgument:we(["origin","agentId","detail"]),checkArgument:(e,t)=>{if(Object.hasOwn(e,"detail")&&!Object.hasOwn(t,"detail"))return"an added detail (the engine says which types carry one)";let r=re(["type","origin","agentId","detail"],e,t);if(r!==void 0)return r;return typeof e.text==="string"?void 0:"no { text } (a string)"},measureArgument:(e,t)=>fe(e.text,t.text),check:C((e)=>ur(e.text,"attachment")),measure:mt("text")};

// chunk-nyce03br.js Ki: the prompt.attachment settle [39361,39491) 130 units sha256 b06bcee4f92eb9335a3e47894b53079f9b2d62040cd8af4006bca1f91a26750d
function Ki(e){let t={...e},o={...t,blocks:_t(t.blocks)};if(t.instructionFiles)o.instructionFiles=_t(t.instructionFiles);return o}

// chunk-nyce03br.js To: the claudeMd block's text [39491,39563) 72 units sha256 29813cebb7325d43b1466db80298f8f9bf952b6cb01d33d1d6f74b077c50f87d
function To(e){return iD(e.blocks).find((t)=>t.name==="claudeMd")?.text}

// chunk-nyce03br.js qr: the deep-equality test the prompt.context rules compare with [39563,39625) 62 units sha256 3fd44dbfa7990afb22536b0f0cbf6856c2921825b19bd375f84cfd452adb4aa0
function qr(e,t){return e===void 0||t===void 0?e===t:kws(e,t)}

// chunk-nyce03br.js Qr: the claudeMd block map [39625,39774) 149 units sha256 c6207e93b443e7bd9c856ba415732a43ac6bbdedc3b231ce4a28edb6b4955fa7
function Qr(e,t){let o=iD(e);return o.some((n)=>n.name==="claudeMd")?o.map((n)=>n.name==="claudeMd"?{...n,text:t}:n):[{name:"claudeMd",text:t},...o]}

// chunk-nyce03br.js Wi: the instructionFiles restore field [39774,40289) 515 units sha256 315bcd5ec66cd4b151895ee9059ded00681042bb5337b3410b0c4f2361f1b93b
function Wi(e,t){if(t.instructionFiles===void 0)return{...e,instructionFiles:void 0};let o=e.instructionFiles??t.instructionFiles,r=To(e),n=r!==To(t),s=!qr(o,t.instructionFiles);if(!n&&s&&o!==void 0){let a=Qr(e.blocks,pt(o));return{...e,blocks:a,instructionFiles:o}}if(!n||o!==void 0&&r===pt(o))return{...e,instructionFiles:o};if(s)Nl().log("prompt.context: a hook changed the claudeMd text and the instruction files in one step; the text stands and the files read as unknown");return{...e,instructionFiles:void 0}}

// chunk-nyce03br.js Mt: the restore list [40289,40600) 311 units sha256 68c8ce43aa1325b9c477c7988714f48443bb657983bc5ccf482ec5ce679d3546
function Mt(e,t){let{blocks:o,instructionFiles:r}=e;if(!Array.isArray(o))return e;let n=B(o);for(let p=0;p<n;p+=1){let a=o[p];if(!(Object.hasOwn(o,p)&&L(a)&&typeof a.name==="string"&&typeof a.text==="string"))return e}if(!(r===void 0||fo(r)))return e;let i={blocks:o,instructionFiles:r};return{...e,...Wi(i,t)}}

// chunk-nyce03br.js Gi: the restore argument the site publishes [40600,40622) 22 units sha256 212d1427eb8d8f26c9388bd336e43614f4c9b4cc4a9964545973aadb15d74292
var Gi=(e,t)=>Mt(e,t);

// chunk-nyce03br.js zi: the restore result the site publishes [40622,40656) 34 units sha256 261bf2e41b1638ff965fc4b24b4ea449b239d78ac55323e100142f262df17eca
var zi=(e,t,o)=>Mt(e,t.at(-1)??o);

// chunk-nyce03br.js Yi: the prompt.context site [40656,40808) 152 units sha256 5c4a26a46bac3308dc64bbb65bd2768c24924008aca3129f7e4b83ec8e4a204a
var Yi={event:"prompt.context",restoreArgument:Gi,checkArgument:gr,measureArgument:(e,t)=>wr(e,t,[]),settle:Ki,restoreResult:zi,check:C(gr),measure:wr};

// chunk-nyce03br.js Qi: the prompt.section site [41072,41456) 384 units sha256 32cdd76039c992dbc1c32611f4ca8b1167e6477612ecc14151602390827a3189
var Qi={event:"prompt.section",checkArgument:(e,t)=>{if(typeof e.name!=="string")return"no { name }";if(e.name!==t.name)return"a changed name (the engine caches the section by it)";if(e.text===null)return;return typeof e.text==="string"?void 0:"a text that is neither a string nor null"},measureArgument:(e,t)=>fe(e.text,t.text),check:C((e)=>ur(e.text,"section")),measure:mt("text")};

// chunk-nyce03br.js ea: the skill.prompt site [42107,42466) 359 units sha256 501607a1283daa4c6ca8d132f9136fdec8029faed65222e3df1dadb8da2fc172
var ea={event:"skill.prompt",checkArgument:(e,t)=>{let{skill:o,text:r}=e,n=typeof o==="string",s=o===t.skill;return n?s?typeof r==="string"?void 0:"no { text }":"a changed skill (the hooks beneath match on it)":"no { skill }"},measureArgument:(e,t)=>fe(e.text,t.text),check:C((e)=>typeof e.text==="string"?void 0:"no { text } (a string)"),measure:mt("text")};

// chunk-nyce03br.js Ra: the session.receive site [98416,99076) 660 units sha256 d562abea568f339e48db79fce27620f4f9718e95d78bd82668aebfdd52477c79
var Ra={event:"session.receive",restoreArgument:(e,t)=>m$(["agentId"],e,t),checkArgument:(e,t)=>{if(er(e.origin)!==er(t.origin))return"a changed origin (the bridge set it; next(e) passes it on)";if(er(e.event)!==er(t.event))return"a changed event (parsed from the delivery; next(e) passes it on)";if(e.agentId!==t.agentId)return"a changed agentId (the loop the delivery is for; next(e) passes it on)";return typeof e.text==="string"?void 0:"no { text } (a string)"},check:C((e)=>{let{consumed:t,text:o}=e;if(t===void 0)return typeof o==="string"?void 0:"neither { text } nor { consumed }";return typeof t==="string"?void 0:"a consumed that is not a string"})};

// chunk-nyce03br.js ja: the telemetry.mark site [100510,100604) 94 units sha256 b8057b842857b0959b3f1c542be3ca2231bab4a3de06e385b8bce081e7d7bc4d
var ja={event:"telemetry.mark",check:C((e)=>Me(e,"{ value }",(t)=>Object.hasOwn(t,"value")))};

// chunk-nyce03br.js La: the agent.offer site [100604,101162) 558 units sha256 e728aa7a01c4562dde6522edefe5384ca7621a2e9ab2f06cb45e0112fb1d0f63
var La={event:"agent.offer",restoreArgument:(e,t)=>m$(["provider"],e,t),checkArgument:(e,t)=>{if(typeof e.agent!=="string")return"no { agent }";if(e.agent!==t.agent)return"a changed agent (the hooks beneath match on it)";if(typeof e.description!=="string")return"no { description }";if(e.source!==t.source)return"a changed source (the hooks beneath match on it)";return er(e.provider)===er(t.provider)?void 0:"a changed provider (pinned: who provides the agent is a fact)"},check:C((e)=>typeof e.isOffered==="boolean"?void 0:"no { isOffered } (a boolean)")};

// chunk-nyce03br.js Wa: the tool.describe site [106133,107056) 923 units sha256 fded84ad4c4108b5451df8b224eb643f0a777f529e5107e645aceb433698dbb4
var Wa={event:"tool.describe",restoreArgument:(e,t)=>m$(["provider"],e,t),checkArgument:(e,t)=>{if(typeof e.tool!=="string")return"no { tool }";if(e.tool!==t.tool)return"a changed tool (the engine caches the description by it)";if(er(e.provider)!==er(t.provider))return"a changed provider (pinned: who provides the tool is a fact)";if(!(e.isDeferred===void 0||typeof e.isDeferred==="boolean"))return"an isDeferred that is not a boolean";return typeof e.description==="string"?void 0:"no { description }"},measureArgument:(e,t)=>fe(e.description,t.description),restoreResult:(e,t,o)=>{if(e.isDeferred!==void 0)return e;let n=t.at(-1)?.isDeferred??o.isDeferred;return n===void 0?e:{...e,isDeferred:n}},check:C((e)=>{if(typeof e.description!=="string")return"no { description } (a string)";return e.isDeferred===void 0||typeof e.isDeferred==="boolean"?void 0:"an isDeferred that is not a boolean"}),measure:mt("description")};


export { at, Ee, re, ur, gr, wr, mo, mt, Or, vr, go, Pt, It, xo, Ht, Ki, Gi, zi, ai, xi, Ei, Di, Bi, Yi, Qi, ea, Ra, ja, La, Wa, kws, ti, Loe, Jws, iD };
