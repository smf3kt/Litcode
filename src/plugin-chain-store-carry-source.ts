// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-nrk8z90j.js sha256 5650fa172647083d24e2d83889060a8915ecb0b4cf46154bbef490e700187ad3
//   chunk-mven2c2x.js sha256 e2f58e7f95f30e10bd73c8047084a1ba104ae00ebf4cbd223b5466085d79c170
//   chunk-886tf6ja.js sha256 593e2ed1380725f871cb3ad6b60ab6fb270bd985462dd6ee3bf5128e003fd30b
//   chunk-6q0v3ahc.js sha256 9f2fe4d5c1888abaf3ea717fdb9958f6aa762a5379409a41915ce6c8daf5bddc
//   chunk-gyf58rwf.js sha256 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The store's read and carry layer (W45-51): how the store reads its file, and what happens when
// the file is not there — the content is carried from the built-in twin of the same plugin in
// another session. Every block is the module's own text, located by the needle the module spells it
// with. The closure is 21 statements across five chunks: the read and carry bodies in the store's
// own module, the external-id map and its lookups in chunk-nrk8z90j.js, the id constant in
// chunk-mven2c2x.js, the ENOENT test in chunk-886tf6ja.js, the plain-object test in
// chunk-6q0v3ahc.js, and the parse helper with its disposable guard in chunk-gyf58rwf.js. W45-52
// added the JSON text helper `_` to that last group: it holds the same guard and reports its length
// through the same `Pe`, and it belongs in the module where both already resolve — the store entry's
// own copy has an unrelated `Pe` (the backend factory), so a second copy there would collide.
// Names that are already in the product are imported rather than copied a second time: `S` (the
// store file's path) from ./plugin-chain-store-path-source.ts, `E` from ./plugin-chain-fs-source.ts,
// and `l` and `t` from ./plugin-chain-source.ts and ./plugin-chain-host.ts. The one name whose own
// closure is a different subsystem — `wD`, the platform-id test inside the application's plugin
// table (its reach is 75,000 units of the application core) — is the bounded hook in
// ./plugin-chain-store-carry-boundaries.ts.
import { copyFile as Ct, link as Ot, mkdir as $t, readFile as ke, readFile as Pt, unlink as Et, writeFile as It } from 'fs/promises';
import { constants as bt } from 'fs';
import { dirname as Rt, join as gt } from 'path';
import { randomUUID as At } from 'crypto';
import { E } from './plugin-chain-fs-source.js';
import { l } from './plugin-chain-source.js';
import { t } from './plugin-chain-host.js';
import { S } from './plugin-chain-store-path-source.js';
import { wD } from './plugin-chain-store-carry-boundaries.js';

// chunk-tvdq3hrk.js declares ye, the candidate's store read: the file's text paired with the candidate's name, or undefined when the file is not there [16724,16841) 117 units sha256 0b3a7d084c269d1a55d0fea9eb3f2cb0ccc915ea906ac7d62670fb24b005b19d
async function ye(e){let r=await Pt(S(e),"utf8").catch((n)=>{if(W(n))return;throw n});return r===void 0?void 0:[e,r]}

// chunk-tvdq3hrk.js declares he, the carry itself: it picks the first candidate that has a store, writes it as `<file>.carry-<uuid>`, links it into place (copying when a link is refused) and removes the carry file — logging a concurrent carry at debug and any other failure at warn [16841,17404) 563 units sha256 a5577ab697629cea2fbfa33b30db2897c4741e4cc6abc2b0e52ff7593d8297b3
async function he(e){let r=await mR(e).reduce(async(m,c)=>await m??ye(c),Promise.resolve(void 0));if(r===void 0)return!1;let[n,i]=r,s=S(e),a=`${s}.carry-${At()}`;try{if(!L(Y(i)))return!1;return await $t(Rt(s),{recursive:!0}),await It(a,i,{flag:"wx"}),await Ot(a,s).catch(async(m)=>{if(E(m)==="EEXIST")throw m;await Ct(a,s,bt.COPYFILE_EXCL)}),!0}catch(m){let c=E(m)==="EEXIST";return t(`$.store (${e}): `+(c?`${n}'s store was carried by another session`:`could not carry ${n}'s store: ${l(m)}`),{level:c?"debug":"warn"}),c}finally{await Et(a).catch(()=>{return})}}

// chunk-tvdq3hrk.js declares vt, the read the store calls: the file's text, or — when it is missing and the carry succeeded — the text again [17444,17609) 165 units sha256 b0806211b3ea3038c6bfa9137f129c94ce9fb5bec001c0f4de95c6916677669a
async function vt(e,r){try{return await ke(r,"utf8")}catch(n){if(!W(n))throw n}if(!await he(e))return;try{return await ke(r,"utf8")}catch(n){if(W(n))return;throw n}}

// chunk-nrk8z90j.js declares A and I, the external plugin-id table: a short name to package id map, `external` keyed and remembered [8301,8728) 427 units sha256 865c5849b2265346be88a2675eeec026dc11ba164b2e34d73a5ea051e0152df7
var A=new Map,I=()=>{let e=A.get("external")??new Map([["responsive-mode","cc-plugin-responsive-mode"],["tips","cc-plugin-tips"],["mermaid","cc-plugin-mermaid"],["claude-test","cc-plugin-claude-test"],["agents-md","cc-plugin-agents-md"],["diff","cc-plugin-diff"],["telemetry","cc-plugin-telemetry"],["plugin-authoring","cc-plugin-plugin-authoring"],["sec-default","cc-plugin-sec-default"],...[]]);return A.set("external",e),e};

// chunk-nrk8z90j.js declares m, the table's accessor [8728,8742) 14 units sha256 33cc92322ff0d56e848ac4a31f77db3ee840d430a636f05f8687e28e928ae25b
var m=()=>I();

// chunk-nrk8z90j.js declares g, the reverse lookup: the short names whose package id is this one [8769,8820) 51 units sha256 a28564e116f99a4264042cbf948d6467c2757c1f72c012931b45d54b46bebce4
var g=(e)=>[...m()].flatMap(([n,t])=>t===e?[n]:[]);

// chunk-nrk8z90j.js declares _d, CQt, hu, ha and Pi: the inline suffix, the built-in identifier for the skills package, and the `builtin`, `skills-dir` and `synced` tags [8941,9017) 76 units sha256 17c3f0b8bef50fe9de68ad4b42ce17db8c64c5bf589b45fce55c73b280e38101
var _d="inline",CQt=`${xQt}@${_d}`,hu="skills-dir",ha="synced",Pi="builtin";

// chunk-nrk8z90j.js declares R, the id split: the base of `<base>@<platform>`, but only when the platform half canonicalizes to the built-in tag [9399,9493) 94 units sha256 a1b09944d69633a6cb9375a888208d6467ac6912ebaa67265549a0b523df839b
function R(e){let n=e.lastIndexOf("@");return n>0&&AUn(e.slice(n+1))===Pi?e.slice(0,n):void 0}

// chunk-nrk8z90j.js declares mR, the candidate list the carry walks: the built-in twins of this id, most recent first [9765,9853) 88 units sha256 b5be029d2e1f071953b60d5faf9bdf814bb32a2daedb7321e6b7c2705ff80509
function mR(e){let n=R(e);return n===void 0?[]:h(n).map((t)=>`${t}@${Pi}`).toReversed()}

// chunk-nrk8z90j.js declares h, the lookup with a fallback to the normalized id when the id as written has no twin [9853,9907) 54 units sha256 b00054d278d4d6d8bdcc284d3d2bd21ac505dc685bab96cc4a988d1d5009ce5b
function h(e){let n=g(e);return n.length>0?n:g(_r(e))}

// chunk-nrk8z90j.js declares AUn, the platform canonicalizer: the lowercased id when the table knows it, the id as written otherwise [9907,9962) 55 units sha256 dc2575e019cd1758cc38a0909e86aaa9f2e4d55d9536b5c77958637adda5e4d4
function AUn(e){let n=e.toLowerCase();return wD(n)?n:e}

// chunk-nrk8z90j.js declares _r, the normalized form an id is looked up under when it has no twin as written [12751,12806) 55 units sha256 4a8fe78c350094291c9340e4bab68ae76f4650199d03f97b4886303614f2e5cc
function _r(e){return e.normalize("NFC").toLowerCase()}

// chunk-mven2c2x.js declares uRe and xQt, the package name the built-in identifier is built from [615,667) 52 units sha256 1e611e36ebcb103e215fa24a34cd49444c9b5cb07c63b4fcbb764198c3e68912
var uRe=["anthropic-skills"],xQt="anthropic-skills";

// chunk-886tf6ja.js declares W, whether an error is a missing file [7507,7544) 37 units sha256 8439c063340ce5b84a3647299d7b288005264d912e9522120edf677792960d6f
function W(n){return E(n)==="ENOENT"}

// chunk-6q0v3ahc.js declares L, whether a parsed value is a plain object [615,685) 70 units sha256 6b15874e28dd4114e956d748abc4d2d737a50907ee95cb2982bdcae8d5a4ab56
function L(n){return typeof n==="object"&&n!==null&&!Array.isArray(n)}

// chunk-gyf58rwf.js declares Xs, the no-op disposable the parse helper holds while it parses [59700,59730) 30 units sha256 972294fafda488d6b34fadabc4c009286f8a598cd6881dcf4582c5acbc3a088b
var Xs={[Symbol.dispose](){}};

// chunk-gyf58rwf.js declares Qs, that disposable's accessor [59730,59754) 24 units sha256 2ba5ddb21c0f0db285a013be400ed5567fd40951d50847c53c2540ec796fbdc2
function Qs(){return Xs}

// chunk-gyf58rwf.js declares ih, the accessor under the name the parse helper uses [59754,59764) 10 units sha256 470948aa64a5d6fb52387cd3d1c13ef625860edf4f25f3da1f3aa8092f5d8b61
var ih=Qs;

// chunk-gyf58rwf.js declares Y, the parse the carried content goes through, with the disposable held across it [60056,60154) 98 units sha256 235e3d3aa6c73b8a182b442559a919be0222c076fe480993e2083d7d42a5c0af
var Y=(e,n)=>{using r=ih`JSON.parse(${Pe(e)})`;return typeof n>"u"?JSON.parse(e):JSON.parse(e,n)};

// chunk-gyf58rwf.js declares Pe, the length the parse reports for its input [60348,60401) 53 units sha256 cdbd7d0cd0cdbb4822ddc801739eb72bb7d99c419a158068e063cbf70392eb14
function Pe(e){return typeof e==="string"?e.length:e}

// chunk-gyf58rwf.js declares `_`, the JSON text helper the store writes through and the value check measures with — it holds the same disposable guard as the parse, so it is copied here beside `ih` and `Pe` rather than in the store entry's own copy, where the store chunk's unrelated `Pe` (the backend factory) would collide with this one [59764,59848) 84 units sha256 a18934a7230cb0ac4961d42de90295e79a08a02f769e56da5f2925358865066e
function _(e,n,r){using s=ih`JSON.stringify(${Pe(e)})`;return JSON.stringify(e,n,r)}


export { ye, he, vt, mR, _, L, Y, W };
