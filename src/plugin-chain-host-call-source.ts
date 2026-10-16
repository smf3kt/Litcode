// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The module-to-host call path: a plugin method call funnels into `Hze`, which asks the chain its
// handlers, waits out a module whose hooks are still loading, and falls back to the call table's own
// action (`bottom`) — with a defensive copy of the arguments for the twelve names in `Cme`.
// `tIt` is that copier, with `U$n` (the well-formed-string normalizer) and its two budget constants;
// `TDe` is the copier as the entry path calls it; `ls`/`YPn` are the async-local store the call runs
// inside. `Yc`/`hf` measure and repair lone surrogates the way the runtime's own String methods do.
import { N5t } from './plugin-chain-classic-raise-source.js';
import { He, L, Ooe, aP, $A } from './plugin-chain-source.js';
import { P0, aJ } from './plugin-chain-records.js';
import { Z$n } from './plugin-chain-host.js';
import { iD } from './plugin-chain-sites-source.js';
import { AsyncLocalStorage as jD } from 'node:async_hooks';
// Port: `ls` is a second `AsyncLocalStorage` instance, as it is in the source (chunk-n3ykh62m.js
// imports its own `jD` from `async_hooks`); the runner copy carries another one (`Ve`) for the
// dispatch pause, which is a different job.

// chunk-sfn1dbxq.js the twelve names whose answer is copied before the default action [1842414,1842591) 177 units sha256 8298fb95be0c9d27bc155947c10319f838156fa8e144e9640b4f9cd11c2280af
var Cme=new Set(["ui.open","ui.toast","ui.notify","ui.status","ui.log","ui.notice","ui.ask","tool.register","command.register","agent.register","prompt.fill","prompt.suggest"]);

// chunk-sfn1dbxq.js declares Hze, the module-to-host call raiser [1842591,1843388) 797 units sha256 43e945e4b9baf113a76912a1df13d7c94a32a07a5b1bae15b7ba20e0715eb9fb
async function Hze({event:e,args:n,caller:r,bottom:s,raise:h}){let y=P0(e,r.origin,{raise:h}),b=r.scopeHolder?.scope;if(y.length===0&&s)return YPn(b,()=>s.run(n,r));let w=N5t({event:e,e:n,origin:r.origin},r.signal);if(w!==void 0)return await w,Hze({event:e,args:n,caller:r,bottom:s,raise:h});let M=Z$n(e)&&!L(n),z=Cme.has(e);if(M)throw new He(`${r.plugin}: $.${e}: its input is no object, which the hooks on it (${y.map((he)=>he.name).join(", ")}) take as e; pass one`);let X=await YPn(b,()=>aP({e:n,handlers:y,site:Ooe(e,h),signal:r.signal,origin:aJ(r.origin),bottom:s&&(async(he)=>{let _e=z?TDe(he):he,ke=s.check?.(_e,r);if(ke!==void 0)throw new He(`${e}: ${ke} (host check)`);return{value:await s.run(_e,r)}})}));if(X.deny!==void 0)throw new He(`${r.plugin}: $.${e}: ${X.deny}`);return X.value}

// chunk-nyce03br.js the copier depth and node budgets [6016,6041) 25 units sha256 694367aa93c3e79af2a62de2770810412f1a22be9ee0ea503fc87d7992316302
var ESe=32;var AFe=20000;

// chunk-nyce03br.js the copier budget multiplier [6303,6313) 10 units sha256 d4a737c1c0166289cd800ddeb27c70465395d57d7549dbbefb19b8c8e06a6208
var $$n=4;

// chunk-nyce03br.js declares U$n, the well-formed-string normalizer [6313,6340) 27 units sha256 0f5bde9e3424dee0584d59e18be9445396b0ae332aa65d3e346ed82d5edcc57e
var U$n=(e)=>Yc(e)?e:hf(e);

// chunk-nyce03br.js declares tIt, the structural copier [6770,7275) 505 units sha256 ec0abe7d9be49f40ee0cda5da0388a662f01bb9a54074a19b6d61fd607cd65a2
function tIt(e,t){if(typeof e==="string")return U$n(e);if(!Array.isArray(e)&&!$A(e))return e;if(t.copies.has(e))return t.copies.get(e);if(t.depth>=ESe*$$n||t.nodes>=AFe*$$n)return e;let r=Array.isArray(e)?iD(e).map((a,f)=>[String(f),a]):Object.entries(e);t.copies.set(e,e),t.nodes+=1,t.depth+=1;let n=r.map(([a,f])=>[t.isKeyed?U$n(a):a,tIt(f,t)]);t.depth-=1;let s=n.some(([a,f],m)=>a!==r[m]?.[0]||f!==r[m]?.[1]),i=Array.isArray(e)?n.map(([,a])=>a):Object.fromEntries(n),p=s?i:e;return t.copies.set(e,p),p}

// chunk-ax7r0qj7.js the lone-surrogate patterns and the native String bindings [1850,2243) 393 units sha256 ffeb48ff42483d2356b5f1db7892e1c393ac46c16a079f992e03f0c44cd190b2
var m=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,a=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,l=typeof String.prototype.isWellFormed==="function"?Function.prototype.call.bind(String.prototype.isWellFormed):void 0,g=typeof String.prototype.toWellFormed==="function"?Function.prototype.call.bind(String.prototype.toWellFormed):void 0;

// chunk-ax7r0qj7.js declares Yc and hf, the well-formed test and repair [2243,2353) 110 units sha256 5c1353619095729e1a089954fa381857320dc994f2679384a0933790fe230d7b
function Yc(t){if(l)return l(t);return!m.test(t)}function hf(t){if(g)return g(t);return t.replace(a,"\uFFFD")}

// chunk-n3ykh62m.js the call path's async-local store [232741,232755) 14 units sha256 ae6915b933d0aeefb26ff4d3366cb73cb24b2d7e1756d40ab89c9965507a3d98
var ls=new jD;

// chunk-n3ykh62m.js declares YPn, running a call inside that store [232946,232979) 33 units sha256 250692740b44bcf3cc83a76ecd8800be34701ee3b073842e2ab19e6b3cca56b6
var YPn=(e,n)=>e?ls.run(e,n):n();

// chunk-n3ykh62m.js declares TDe, the copier as the entry path calls it [266967,267031) 64 units sha256 9e17c39c7f00f56f18758946ab8bc9609d4fead69f3b3e0784f9bb3052588c0a
var TDe=(e)=>tIt(e,{copies:new Map,nodes:0,depth:0,isKeyed:!1});


export { Cme, Hze, ESe, AFe, $$n, m, a, l, g, Yc, hf, U$n, tIt, ls, YPn, TDe };
