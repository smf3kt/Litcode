// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-stnaz0rq.js sha256 dfc19e4c0816c91916156f7e915efa0fbbd4092a388951756023e84573166b53
//   chunk-6ejn7q9s.js sha256 e652d11d8941d479b41f93f296877a1bc0544c549ddd6b9999f681192effbfee
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { t, it } from './plugin-chain-host.js';
import { iRe, lUn } from './plugin-chain-matchers.js';
import { ga, cze } from './plugin-chain-entry.js';
import { l } from './plugin-chain-source.js';

// chunk-stnaz0rq.js chain-name hook gate [714,841) 127 units sha256 b8bf1209e1808f08267b6ae8c6d2af104b68c31dc78c7859b7229c5ee9e0fb1d
function Jl(o,e,s){let t=e&&iRe(o);return(s??it().loadedModules).some((r)=>r.hooks(o)&&(e===void 0||lUn(r.matcherFor(o),e,t)))}

// chunk-6ejn7q9s.js counting walk [108477,108540) 63 units sha256 d24828c06c5e5dba40dc1ed04b4e315898b602063119ecc348654f1c7465881e
function Wt(e,n){let r=0;for(;r<e;r+=1)if(!n(r))break;return r}

// chunk-6ejn7q9s.js draft span difference [108540,108946) 406 units sha256 3b1bdddd9e86e304422b6bb67e48a8713429af3ffa7c01f29e8b5021492afbcf
function yBe(e,n){if(e.text===n.text)return{start:n.cursor,end:n.cursor,inputText:""};let r=Wt(Math.min(e.cursor,n.cursor,e.text.length,n.text.length),(h)=>e.text.charCodeAt(h)===n.text.charCodeAt(h)),s=Wt(Math.min(e.text.length,n.text.length)-r,(h)=>e.text.charCodeAt(e.text.length-1-h)===n.text.charCodeAt(n.text.length-1-h));return{start:r,end:e.text.length-s,inputText:n.text.slice(r,n.text.length-s)}}

// chunk-6ejn7q9s.js same draft check [120138,120250) 112 units sha256 f6f7b605cf8d32e5874938005a737183c2aaac0f2a8a9ea2476ab7f30f833cdb
var Yo=(e,n)=>e.text===n.text&&e.cursor===n.cursor&&e.start===n.start&&e.end===n.end&&e.inputText===n.inputText;

// chunk-6ejn7q9s.js edit core [120250,120332) 82 units sha256 0cb9402754db44dae86a54afd466700675304fffbd144d85e7624937ed44c4b0
var Qo=(e,n)=>({name:"core",isCore:!0,budgetMs:0,run:async(r)=>Yo(r,e)?n:cze(r)});

// chunk-6ejn7q9s.js composer origin [120332,120373) 41 units sha256 0f8b31d0836d7132899bd2b329275612d58fe1a95c878c9226e49d243a9d8f47
var vLt=Object.freeze({kind:"composer"});

// chunk-6ejn7q9s.js key into the edit key [120373,120591) 218 units sha256 6aab504666caec5557139f8ca5adc555389557170d7d8e35d3e0cbd37fcf782d
function Xo(e){let n=[...e.key].length===1,r=e.name!==""&&!n;if(!n&&!r)return;let s=e.key===" ",h=r?e.name:s?"space":e.key;return Object.freeze({key:h,...e.ctrl&&{ctrl:!0},...e.shift&&{shift:!0},...e.meta&&{meta:!0}})}

// chunk-6ejn7q9s.js edit key [120591,120673) 82 units sha256 96c5168fa31217719f29ccb6a3cd949adaffbe0a1e2f35590f5b7cc917f3abf9
function Jo(e){let n=e.key===void 0?void 0:Xo(e.key);return n===void 0?{}:{key:n}}

// chunk-6ejn7q9s.js recorded edit into the chain event [120673,120776) 103 units sha256 4f340f4d51ae75f12800aa6256c28c40f89d1e113e89a1f802652863c1148375
var Zo=(e)=>({origin:vLt,...Jo(e),text:e.before.text,cursor:e.before.cursor,...yBe(e.before,e.after)});

// chunk-6ejn7q9s.js the default raise [120776,120880) 104 units sha256 a6d8ccf56429ba230a0836fb3fea663d9eda9953fd2c72c6f243020b18cf339e
function XOr(e,n){let r=Zo(e);return ga("prompt.edit",{signal:n,core:{"prompt.edit":Qo(r,e.after)}})(r)}

// chunk-6ejn7q9s.js clamped draft [120880,120961) 81 units sha256 d64dab9f02ecafbff412f7cdfd4c89835a563f75ab6f58d5e17d85045ae7e25f
var Dan=(e)=>({text:e.text,cursor:Math.max(0,Math.min(e.cursor,e.text.length))});

// chunk-6ejn7q9s.js batch key [121050,121202) 152 units sha256 5d8b73966a98f91215b5e54e0bf01f59653c5e6b52a48f7f82ffc0bedf35bf23
function er(e){let[n]=e,r=n?.before??{text:"",cursor:0},s=e.at(-1)?.after??r,h=e.length===1&&n?.key!==void 0;return{before:r,after:s,...h&&{key:n.key}}}

// chunk-6ejn7q9s.js rewrite onto the draft [121202,121468) 266 units sha256 71b36f0503c91df06ea68e33b8e92618a98d27d3372391455df32e284c253cfc
function tr(e,n){let{text:r}=cze({origin:vLt,text:e.text,cursor:e.cursor,...n}),s=n.inputText.length-(n.end-n.start),h=e.cursor>=n.end,y=!h&&e.cursor>n.start,b=h?e.cursor+s:y?n.start+n.inputText.length:e.cursor;return{text:r,cursor:Math.max(0,Math.min(b,r.length))}}

// chunk-6ejn7q9s.js span shifted onto a later draft [121468,121674) 206 units sha256 f92b0553dd289fee78f702a080982d6b52abdeb643812888b61fae3f39ff4741
function nr(e,n){if(n.start===n.end&&n.inputText===""||e.end<=n.start)return e;let s=n.inputText.length-(n.end-n.start);if(!(n.end<=e.start))return;return{start:e.start+s,end:e.end+s,inputText:e.inputText}}

// chunk-6ejn7q9s.js rebase an answer onto the draft [121674,121977) 303 units sha256 d4701c89691394e59d4d1e676567a7804799b3ab975d46cad8043b478828603b
function or(e,n,r){if(n.text===e.text&&n.cursor===e.cursor)return{};if(r.text===e.text&&r.cursor===e.cursor)return{box:Dan(n)};let y=yBe(e,r),w=y.end-y.start===e.text.length?void 0:nr(yBe(e,n),y);if(w===void 0)return{reason:"a rewrite no longer fits the draft (it moved meanwhile)"};return{box:tr(r,w)}}

// chunk-6ejn7q9s.js the composer edit relay [121977,122681) 704 units sha256 7f3024bf9e2d147ac4132fb6269f0171b2b46060abc12ec3a1f0cc644bb439c1
function YHo(e){let n=e.raise??XOr,r=e.later??queueMicrotask,s=e.report??((v)=>t(v)),h=new AbortController,y=!1,b=[],w,_=!1;function S(){if(_=!1,b.length===0||w!==void 0)return;let v=er(b);b=[],w=v,n(v,h.signal).then((M)=>C(v,M),(M)=>{s(`prompt.edit: ${l(M)}; the editor's edit stands`),C(v,v.after)})}function C(v,M){if(w=void 0,h.signal.aborted)return;let N=or(v.after,M,e.read());if(N.box!==void 0)e.commit(N.box);else if(N.reason!==void 0)s(`prompt.edit: ${N.reason}; the person's typing stands`);if(e.read().text===M.text)e.paint?.(M.decorations,M.text);S()}return{isRecording:()=>y,record:(v)=>{if(e.carry?.(v),b.push(v),!_&&w===void 0)_=!0,r(S)},setHooked:(v)=>{y=v},dispose:()=>{b=[],h.abort()}}}


export { Jl, vLt, Wt, yBe, Yo, Qo, Xo, Jo, Zo, XOr, Dan, er, tr, nr, or, YHo };
