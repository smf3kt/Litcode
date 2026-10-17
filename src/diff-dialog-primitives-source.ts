// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-a8pz28bf.js sha256 f9c6096cc6bc2515885e7c00fbd8ee4d10a5844e4375ea0923205dd4bc3b1f58
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as r, w, n, b } from './plugin-chain-react-surface.js';

// chunk-ax7r0qj7.js I: singular/plural word selection [798,839) 41 units sha256 49db02fcab0494d90ecfc8e3faf29e5b634fe87c6485070c069b39f24946888a
function I(t,n,e=n+"s"){return t===1?n:e}

// chunk-a8pz28bf.js Ib: added/removed diff stat label [1139,1603) 464 units sha256 f4cba6359e71151590517bcc7598fdd21dab4632996b46d2b7d3cb2d2d4324e6
function Ib(d){let s=w(10),{added:o,removed:i,bold:l}=d;if(o===0&&i===0){return null}let c;if(s[0]!==o||s[1]!==l)c=o>0&&r(n,{color:"diffAddedWord",bold:l,children:["+",o]}),s[0]=o,s[1]=l,s[2]=c;else c=s[2];const b=o>0&&i>0&&" ";let u;if(s[3]!==l||s[4]!==i)u=i>0&&r(n,{color:"diffRemovedWord",bold:l,children:["-",i]}),s[3]=l,s[4]=i,s[5]=u;else u=s[5];let x;if(s[6]!==c||s[7]!==b||s[8]!==u)x=r(n,{children:[c,b,u]}),s[6]=c,s[7]=b,s[8]=u,s[9]=x;else x=s[9];return x}


export { I, Ib };
