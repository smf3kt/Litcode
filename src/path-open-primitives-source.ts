// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
function createPathOpenPrimitives({ Pe, T, ai, zut, wGn }) {
// chunk-bf3z2ftn.js QHt [8336,8667), UTF-16; sha256 4568cb3d75f575298d440671755068ed3f1a873496e33cf3dc5e7b815884cea7
async function QHt(e,n,r,i,o){o?.throwIfAborted();let s=i?Z3(e,n,r):Pe(e,n|ai);if(!o)return s;let u,d=new Promise((p,h)=>{u=()=>h(o.reason??Error("aborted")),o.addEventListener("abort",u,{once:!0})});try{return await Promise.race([s,d])}catch(p){throw s.then((h)=>h.close(),()=>{}),p}finally{if(u)o.removeEventListener("abort",u)}}
// chunk-bf3z2ftn.js Z3 [8920,9027), UTF-16; sha256 7d54b7a05061db1bb64868692ac751f4f9ee8bff6ea84a74f49fbc537841fbb5
async function Z3(e,n,r){if(r!=="macos"||await wGn())return Pe(e,n|ai);return Pe(e,n&~T.O_NOFOLLOW|zut|ai)}
return { QHt, Z3 };
}
function createPathOpenCapability({ X, m, ai, zut, f, E }) {
// chunk-8pet3bvp.js wGn [3034,3275), UTF-16; sha256 afce3d145ff56377c135d8e078bc65a1a2a006896ee013646062b78848f726fb
async function wGn(){if(f.noFollowAny==="untried")try{await(await X("/",m.O_RDONLY|m.O_DIRECTORY|m.O_NONBLOCK|zut|ai)).close(),f.noFollowAny="works"}catch(e){f.noFollowAny=E(e)==="EINVAL"?"rejected":"works"}return f.noFollowAny==="rejected"}
return { wGn };
}
export { createPathOpenPrimitives, createPathOpenCapability };
