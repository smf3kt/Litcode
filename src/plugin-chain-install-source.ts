// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { lIt, D } from './plugin-chain-host.js';
import { He } from './plugin-chain-source.js';

// chunk-sfn1dbxq.js the record an installed environment becomes [1829037,1829052) 15 units sha256 96c20fd67c3cbc9f6d9f6a604af612d77254dbb3e095db8e8488dcc4fe7b3c59
var bGt=(e)=>e;

// chunk-sfn1dbxq.js the hook surface a registered pattern list answers as [1829052,1829624) 572 units sha256 d76a9af84046af6c65b0fdca770db4733ba3db8833c3a1cf6311345fc01b43da
function wGt(e,n){let r=new Map;function s(y){let b=r.get(y);if(b===void 0)b=e.flatMap((w,M)=>lIt(w.pattern,y,n)?[M]:[]),r.set(y,b);return b}let h=(y,b=[])=>s(y).flatMap((w)=>{let M=e[w];return M===void 0||b.includes(w)?[]:[M]});return{patterns:D(e.map((y)=>y.pattern)),registrationsFor:s,hooks:(y,b)=>h(y,b).length>0,catches:(y,b,w)=>h(y,b).some((M)=>M.caught===!0&&(M.matcher===void 0||w?.(M.matcher)!==!1)),hasCatch:(y)=>e[y]?.caught===!0,matcherFor:(y,b)=>{let w;for(let[M,z]of h(y,b).entries()){if(z.matcher===void 0)return;w=M===0?z.matcher:[w,z.matcher]}return w}}}

// chunk-sfn1dbxq.js unloaded environment gate [1829624,1829702) 78 units sha256 27d2e6a6b7dc1944b898d25899412e25b75b8d5f0e6c8fdf2dd40f99c7e94cbf
function w3(e,n,r){return e().kind==="unloaded"?Promise.reject(new He(n)):r()}


export { bGt, wGt, w3 };
