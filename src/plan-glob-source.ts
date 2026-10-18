// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W183-permission-destinations.md.
// Modules:
//   chunk-z6p21rxk.js sha256 2e9c002da378e738a825dbd5c30f9a6341a9cf2c1d7022d4e1bbec2dfacf72dd
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.


// chunk-z6p21rxk.js _Z [1100,1192) 92 units sha256 9e659b2b394341934bedd42ee8b512968620634059fd7046d9003e948dc1df37
function _Z(e,t){let n=t&&Object.hasOwn(t,e)?t[e]:void 0;return n!==void 0&&n!==e?[e,n]:[e]}

// chunk-z6p21rxk.js qW [1192,1294) 102 units sha256 e1df6698000a67df291ff7f322a37df8d76f148fde2b60cdf48c2aeed34d36cc
function qW(e,t){if(!t)return[];let n=[];for(let[r,o]of Object.entries(t))if(o===e)n.push(r);return n}

// chunk-z6p21rxk.js Yv [1294,1332) 38 units sha256 f34670997e2799d9962954539886ffdaefb1b7e6d86a7e95f169503599d0ec27
function Yv(e){return e.includes("*")}

// chunk-z6p21rxk.js JWn [1999,2027) 28 units sha256 655ff2ad573dda8405b60d0047bbbcffd6d03536b9a0ab3666285be113aaff42
function JWn(e){return p(e)}

// chunk-z6p21rxk.js p [1364,1710) 346 units sha256 96559c33ee9bcb60b607ffe6d3f2af97a06c248ed67b7f7402fae1e09f3b4217
function p(e){let t=e.split("*"),n=t[0]??"";if(t.length===1)return(i)=>n===i;let r=t.at(-1)??"",o,s=[];return(i)=>{let a=i.length-r.length;if(a<n.length||!i.startsWith(n)||!i.endsWith(r))return!1;o??=t.slice(1,-1).filter((l)=>l!=="");let u=n.length;for(let[l,f]of o.entries()){let d=(s[l]??=R(f))(i,u,a);if(d===-1)return!1;u=d+f.length}return!0}}

// chunk-z6p21rxk.js R [4557,5017) 460 units sha256 85fa96bbfcf5431bfd62718f36639b2f83e91e0ac5368679cefd72eaafd05838
function R(e){if(!e.includes(e.charAt(0),1))return(n,r,o)=>{let s=n.indexOf(e,r);return s+e.length>o?-1:s};let t=new Int32Array(e.length);for(let n=1,r=0;n<e.length;n++){while(r>0&&e.charCodeAt(n)!==e.charCodeAt(r))r=t[r-1]??0;if(e.charCodeAt(n)===e.charCodeAt(r))r++;t[n]=r}return(n,r,o)=>{for(let s=r,i=0;s<o;s++){while(i>0&&n.charCodeAt(s)!==e.charCodeAt(i))i=t[i-1]??0;if(n.charCodeAt(s)===e.charCodeAt(i))i++;if(i===e.length)return s-e.length+1}return-1}}


export { _Z, qW, Yv, JWn };
