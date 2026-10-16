// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-ed7zyzrn.js sha256 4754249b16c2900a23735b1a90afb10583cde0e9c816f3d46b2c13c33fbfc2c7
//   chunk-bk5ct2gw.js sha256 efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Nl } from './plugin-chain-host.js';
import { $A, He, l, Ge, L } from './plugin-chain-source.js';

// chunk-ed7zyzrn.js matcher context [2334,2418) 84 units sha256 d1870c3d40e6b4b3993e316eeadefdfd6d88e63b121c94b8203302be67c4d80a
function iRe(o){let t=A(o),r=f.get()??to;return t===void 0?void 0:{table:r,paths:t}}

// chunk-ed7zyzrn.js matcher runner [4815,5465) 650 units sha256 9bfc78a738ed6e2807d589c5f36a6fbfad18345e9304cfb2308a6fe612d675f7
function EQt(o,t,r=""){let e;if(Array.isArray(o))return Array.prototype.some.call(o,(n)=>(e=EQt(n,t,r),e!==void 0)),e;if(Array.isArray(t))return Array.prototype.some.call(t,(n)=>(e=EQt(o,n,r),e!==void 0)),e;if(!HFe(o))return;if(t===null)return{path:r,kind:"null"};switch(typeof t){case"string":return{path:r,kind:"string"};case"number":return{path:r,kind:"number"};case"boolean":return{path:r,kind:"boolean"};case"bigint":return{path:r,kind:"bigint"};case"object":break;case"undefined":case"symbol":case"function":return}for(let n of Object.keys(o)){if(!Object.hasOwn(t,n))continue;if(e=EQt(o[n],t[n],r===""?n:`${r}.${n}`),e!==void 0)return e}return}

// chunk-ed7zyzrn.js matcher result [5465,5844) 379 units sha256 f2f9cd8c2a372a7ddff177cea442f378cd6f3e19e5187c23f3462806d3e34c50
function dho(o,t,r){let e=r.path.split(".").at(-1)??r.path;return`hooks module ${o}: on('${t}') matcher at ${r.path} is a nested object, but e.${r.path} is a ${r.kind} there, which an object matcher can never match (a matcher has no operator keys); the hook will not run for it. A ${r.kind} is matched by the literal value or, as a string, by a RegExp, e.g. { ${e}: /^prefix/ }`}

// chunk-ed7zyzrn.js worker-hop matcher [8279,8325) 46 units sha256 1cdb6aa30c0ded626bc40f25b2ece03f0fd28b1f29af5a38505b46c5d0513333
var aUn=(o,t,r)=>l(o,t,{test:()=>!0,names:r});

// chunk-ed7zyzrn.js pinned-keys matcher [8440,8524) 84 units sha256 94bb965c7d78fb132f2d90accf6dc8a8cbd9f4234bf09c98357b8db1a9c11d8d
var lUn=(o,t,r)=>Object.entries(t).every(([e,n])=>b(o,{field:e,value:n},r&&H(r,e)));

// chunk-ed7zyzrn.js ordinary matcher [8712,8754) 42 units sha256 d983a058e93371dd16d15a71855fd1602097163ca2bc6feae8366b3ad02ee999
var Slt=(o,t,r)=>l(o,t,{test:Xo,names:r});

// chunk-ed7zyzrn.js matcher input context [1567,1592) 25 units sha256 57852e48cc662a3fb7f4022320647a42860a1bf46e224b943f8e785d1631b5b7
var to=Object.freeze({});

// chunk-ed7zyzrn.js matcher cache slot [3521,3547) 26 units sha256 501c3171d39637412b832f71730e7d3177b5eee9272fa7dd521fd8a1e6173e48
var HFe=(o)=>$A(o)&&!i(o);

// chunk-ed7zyzrn.js matcher invocation [7750,7996) 246 units sha256 a1128f7268f0afe5ee1e762accaf3faa7b7339df40f2e39b6c59f0a6c5c484df
function Xo(o,t){if(t.length>y)return Nl().log(`matcher: a value of ${t.length} characters is past the ${y} a RegExp matcher reads; it matches, so the hook decides`),!0;if(k(a(o).flags))o.lastIndex=0;return RegExp.prototype.exec.call(o,t)!==null}

// chunk-ed7zyzrn.js matcher result marker [5844,5855) 11 units sha256 5f884715509691c4e135a2f39362f6620911e55c8651b405571481291f9bc998
var uho=32;

// chunk-ed7zyzrn.js named path selection [1436,1567) 131 units sha256 d782ff92602f9f40d47b1c13c382699450491b0e56b643e27c330b787ea83343
function H(o,t){return o.paths.some((e)=>e[0]===t)?{table:o.table,paths:o.paths.filter((e)=>e[0]===t).map((e)=>e.slice(1))}:void 0}

// chunk-ed7zyzrn.js regex table lookup [2088,2130) 42 units sha256 d0928dc853f79af7e0c860d2dd1236c7cfdf5daffefd0bcf06c478226aeb3c93
var A=(o)=>Object.hasOwn(E,o)?E[o]:void 0;

// chunk-ed7zyzrn.js matcher input ceiling [2599,2611) 12 units sha256 7bff3247c732a530affd9f2da6ba5a73cfa4017e55ac2d1e4aa6425b778c20b8
var y=65536;

// chunk-ed7zyzrn.js regex-like object gate [3400,3521) 121 units sha256 194abb9feacdebc645ec074089c395e464ccbb6d4b055d710f6e3163090f233b
function i(o){if(typeof o!=="object"||!o)return!1;try{return Reflect.get(RegExp.prototype,"source",o),!0}catch{return!1}}

// chunk-ed7zyzrn.js regex source/flags reader [3864,3989) 125 units sha256 19ee1f055c24a4c94a561591243db8793cd8fd791247223244c1afaef6e4cfd2
var a=(o)=>({source:String(Reflect.get(RegExp.prototype,"source",o)),flags:String(Reflect.get(RegExp.prototype,"flags",o))});

// chunk-ed7zyzrn.js regex flag pick [6311,6369) 58 units sha256 7590df62e02d64cdc6a9a5a8452fb335ca6a2e6aa5c9c378704282dc746d3c5c
var k=(o)=>o.includes("g")?"g":o.includes("y")?"y":void 0;

// chunk-ed7zyzrn.js nested field matcher [8325,8440) 115 units sha256 1a5a03183250584a743dc4b660c95ff98c68f72b1c2263d9524645a4743a5e20
var b=(o,t,r)=>Array.isArray(o)?o.some((e)=>b(e,t,r)):!$A(o)||!Object.hasOwn(o,t.field)||aUn(o[t.field],t.value,r);

// chunk-ed7zyzrn.js event table [1592,2224) 632 units sha256 7bf6fe8449729edb70227919cac456d976406b7fd05b6bf56d9dc4c30ddc1086
var E=Object.freeze({"tool.call":[["tool"]],"tool.check":[["tool"]],"tool.describe":[["tool"]],"classic.PreToolUse":[["tool"]],"classic.PostToolUse":[["tool_name"]],"classic.PostToolUseFailure":[["tool_name"]],"classic.PermissionRequest":[["tool_name"]],"classic.PermissionDenied":[["tool_name"]],"classic.PostToolBatch":[["tool_calls","tool_name"]],"session.append":[["origin","tool"]],"session.compact":[["messages","toolUses","tool"]],"ui.render":[["props","tool"],["props","calls","tool"]]});var A=(o)=>Object.hasOwn(E,o)?E[o]:void 0;var f=Ge(Dy(),(o)=>o.set(null));function BFs(o){let t=o!==void 0&&o!==null;f.set(t?J(o):null)}

// chunk-bk5ct2gw.js single-slot holder (its only consumer is in this file) [643173,643231) 58 units sha256 136b3b2f20575e3191e687227f80b7a6050bcd3b29cfe68b5804d0401ed22c95
function Dy(){let e=null;return{get:()=>e,set:(n)=>{e=n}}}

// chunk-ed7zyzrn.js regex table holder [2130,2162) 32 units sha256 bfd25aff0fca62109996b23e2ca4f172713f649b6cc90f055ffdda59365ec096
var f=Ge(Dy(),(o)=>o.set(null));

// chunk-ed7zyzrn.js frozen string-valued table [1242,1307) 65 units sha256 c6016e6db4d7e44244e337146f03813c4da21b284cbef780fc4aa861e355921b
var J=(o)=>Object.freeze(TE(L(o)?o:{},(t)=>typeof t==="string"));

// chunk-ed7zyzrn.js table value mapping [1131,1242) 111 units sha256 1c0f363ae36680f2977f278f80d974d900a7af382e85487ba924636c24c0541f
function TE(o,t){let r=Object.create(null);for(let[e,n]of Object.entries(o))if(e!==wQt&&t(n,e))r[e]=n;return r}

// chunk-ed7zyzrn.js prototype key name [1111,1131) 20 units sha256 dd8e00d73c293ac30d392ed2461d72dd6099f8330e549deff47fb73933c4c388
var wQt="__proto__";


export { iRe, aUn, lUn, Slt, EQt, dho, to, HFe, Xo, uho, H, A, f, y, i, a, k, b, E, Dy, J, TE, wQt };
