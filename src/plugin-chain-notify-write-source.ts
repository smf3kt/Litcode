// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nwffn64n.js sha256 55ad6416b53bf514959570f3629776420692340439c948db6a00954961d234eb
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-m4qpskd4.js sha256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae
//   chunk-2kdsvp3x.js sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2
//   chunk-ed7zyzrn.js sha256 4754249b16c2900a23735b1a90afb10583cde0e9c816f3d46b2c13c33fbfc2c7
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// W45-29: the notification bar's write half — the append (`lLs`), the write-or-skip (`xYr`) and the
// plugin-state store's own set (`o5t`) with the reader notification it ends with (`vb`), plus the
// plugin-seat check `sOn` (`Ee` over the host registry, `Zws` the seats that count as managed) and the
// deep freeze the stored value goes through (`cho`/`OFe` over the traversal `O`).
//
// `ko` is Node's own `isProxy` (`import{isProxy as ko}from"util/types"`, chunk-ed7zyzrn.js [2884,…)),
// the same binding src/plugin-chain-source.ts already uses for `O`'s sibling copy. `He`, `L`, `$A`, `l`
// and `t` are ported: the first four in src/plugin-chain-source.ts, the logger in
// src/plugin-chain-host.ts [311,…). `ls`, `Ci`, `_` and `Y` come from
// src/plugin-chain-notify-store-runtime.ts, each with the reason recorded there.
import { isProxy as ko } from 'util/types';
import { $A, He, L, l } from './plugin-chain-source.js';
import { it, t } from './plugin-chain-host.js';
import { Ope, Pye, SEt, s_ } from './plugin-chain-notify-store-source.js';
import { Ci, Y, _, ls } from './plugin-chain-notify-store-runtime.js';

// chunk-nwffn64n.js the freeze depth ceiling `PQt` (1e5) `O` throws on, taken with its neighbour `hR` because the declaration is one statement [615,635) 20 units sha256 71307797b6ddccf916cfd68d92132557e949094b340c51dcb7ce161a1b0bb5f5
var hR=4096,PQt=1e5;

// chunk-nyce03br.js `jde` = 4194304, the JSON-character ceiling the state store's set enforces [212618,212634) 16 units sha256 25ada96e210b32b1330c30138a752329aba7eaac0d1021498419984f11672779
var jde=4194304;

// chunk-m4qpskd4.js `Zws`, the seats that count as managed: `["prepend","append"]` [48497,48526) 29 units sha256 76f0d59f9d7e2cdbbc5e45aff03b74eeb08c1fc1cafb23745d3d7ff7bb759ae3
var Zws=["prepend","append"];

// chunk-2kdsvp3x.js `Ee`: a plugin's seat — its module record's tier, else the seat table, else "user" [37034,37144) 110 units sha256 28634df61216cb887a0e3c5c5c9981e522bb23248501463e30b0b07685b94b6e
function Ee(e){let{loadedModules:r,moduleSeats:n}=it();return r.find((s)=>s.name===e)?.tier??n.get(e)??"user"}

// chunk-2kdsvp3x.js `sOn`: whether the plugin's seat is one of `Zws` [37144,37182) 38 units sha256 fa6f6e7e06bad1b7d54b58d4771e359fe6c4ed28b010a48f3e8cf60ae714ed5b
var sOn=(e)=>Zws.some((r)=>r===Ee(e));

// chunk-ed7zyzrn.js `O`: the freeze walk's cursor over arrays and plain objects, bounded by `PQt` [2900,3169) 269 units sha256 8731edb83e5b41b1742ea0519d5c081955b01273f9f861d9ed73c603b51edab7
function O(o,t,r){if(typeof o!=="object"||!o||t.has(o))return r;if(ko(o))return r;let e=(r?.depth??0)+1;if(e>PQt)throw RangeError("data nested too deep to freeze");t.add(o);let n=Array.isArray(o);return n||$A(o)?{node:o,keys:n?[]:Object.keys(o),at:0,depth:e,below:r}:r}

// chunk-ed7zyzrn.js `cho` freezes every reachable node with that cursor, and `OFe` is `cho(o, new Set), o` [3169,3400) 231 units sha256 936979617aa43038183e551b71f9f966672ab1cb96a13c15f82df3b1fcb9c20e
function cho(o,t){let r=O(o,t,void 0);while(r!==void 0){let{node:e,keys:n,at:s}=r,c=Array.isArray(e);if(s<(c?e:n).length)r.at=s+1,r=O(c?e[s]:e[n[s]??""],t,r);else Object.freeze(e),r=r.below}}function OFe(o){return cho(o,new Set),o}

// chunk-n3ykh62m.js `vb`: tell a key's readers it changed — nothing to do while `readersOf` holds no reader [274916,274994) 78 units sha256 feabc35b5feda9e60d0f65215ba58606e23b808adddb347f12b515c00a73d38f
function vb(e){let n=s_().readersOf.get(e);if(n!==void 0&&n.size>0)Ci([...n])}

// chunk-n3ykh62m.js `o5t`: the state store's set — JSON round-trip under `jde`, next version from the value and the floor, the write inside `ls.exit`, then `vb` [275644,275983) 339 units sha256 9c686c9b4958301d4ddb0c22a4e66f176a86f8908ce78a99c17d4e3029d666e0
function o5t(e,n){let r=_(n);if(!(typeof r==="string"&&r.length<=jde))throw new He(`a value of state is JSON data of at most ${jde} characters`);let{values:h,versionFloor:y}=s_(),b=Math.max(h.getState().get(e)?.version??0,y)+1;return ls.exit(()=>{h.setState((w)=>{let R=new Map(w);return R.set(e,{value:OFe(Y(r)),version:b}),R}),vb(e)}),b}

// chunk-sfn1dbxq.js `lLs`: append a toast to the stored ledger with `isManaged` from the plugin's seat [1694273,1694442) 169 units sha256 e3c9d205e3b926d2962adc49b6221b0366b6a6f9e2fcb26b7043dd7ee60a91de
function lLs(e){let n=SEt();xYr({...n,toasts:[...n.toasts,{key:e.key,plugin:e.plugin,text:e.text,isManaged:sOn(e.plugin),leftMs:e.ms,wasShown:!1,lentMs:0,untoldMs:0}]})}

// chunk-sfn1dbxq.js `xYr`: write the ledger unless both it and the stored one are empty, and log when the write fails [1692719,1692909) 190 units sha256 16938cf7d1c3bee68567f9c728f45680fb07bdb7725087bb629e08fabf81bee9
function xYr(e){let n=[SEt(),e].every((r)=>r.toasts.length===0&&r.slot===void 0);try{if(!n)o5t(Pye(Ope),e)}catch(r){t(`$.ui.toast: the bar's toasts were not kept: ${l(r)}`,{level:"error"})}}


export { PQt, jde, Zws, Ee, sOn, O, cho, OFe, o5t, vb, lLs, xYr };
