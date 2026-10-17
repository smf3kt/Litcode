// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { xAt, ZAe } from './plugin-chain-site-leaves.js';
import { IL } from './plugin-chain-raster-sites.js';
import { Mrt } from './plugin-chain-walker.js';
import { cN, rQt } from './plugin-chain-style-props.js';
import { L } from './plugin-chain-source.js';
import { vVe } from './plugin-chain-leaf-walkers.js';

// chunk-n3ykh62m.js Box borderStyle moves into hover, recursively; W140 sector 1 [267031,267454) 423 units sha256 56d44faa8400a44f78d768bc1bd9eb8eadc856f2584841c13251533d97645f5b
function nIn(e,n){if(!(e.type==="Box"||e.type==="Text"||e.type==="Link"))return e;let{children:s}=e,h=s?.map((M)=>typeof M==="string"?M:nIn(M,n)),b=h!==void 0&&h.some((M,z)=>M!==s?.[z])?{...e,children:h}:e;if(b.type!=="Box"||b.props?.borderStyle===void 0)return b;let{borderStyle:w,...R}=b.props;if(!QPn("borderStyle",w))return b;n(w);let{borderStyle:T,...P}=b.hover??{};return{...b,props:R,...b.hover!==void 0&&{hover:P}}}

// chunk-n3ykh62m.js borderStyle prop rule used by nIn [247131,247200) 69 units sha256 a56a4157bdc3edf85580a5eb514c5ace1634d508e8fe87998b85999a77ac73cf
var QPn=(e,n)=>e==="borderStyle"&&!(typeof n==="string"&&rQt.has(n));

// chunk-n3ykh62m.js drawing key removal after the key check [270929,271294) 365 units sha256 d5aefa7699f6b864389bf15830130026699d00622e3746cddd07ff71103f58b2
function dno(e){if(e.type==="engine")return e;if(!(e.type==="Box"||e.type==="Text"||e.type==="Link"))return e;let{children:r}=e,s=r?.map((R)=>typeof R==="string"?R:dno(R)),y=s!==void 0&&s.some((R,T)=>R!==r?.[T])?{...e,children:s}:e;if(y.type!=="Box"||y.props?.key===void 0)return y;if(xAt(y.props.key)===void 0)return y;let{key:b,...w}=y.props;return{...y,props:w}}

// chunk-n3ykh62m.js link validation and rewrite to Text [267903,268419) 516 units sha256 675597b0b337b4fe57fc678a5383053e5fe024caf8af1e5219ffd66a915f7827
function kur(e,n,r){let s=0,h=[];function y(T){if(!(T.type==="Box"||T.type==="Text"||T.type==="Link"))return T;if(T.type==="Link")s+=1;let M=s,{children:z}=T,N=z?.map((te)=>typeof te==="string"?te:y(te)),X=N!==void 0&&N.some((te,de)=>te!==z?.[de])?{...T,children:N}:T;if(X.type!=="Link")return X;let Z=tIn(X.props.href,n);if(Z===void 0)return X;h.push({ordinal:M,problem:Z});let ee=eIn(X);return{type:"Text",children:N!==void 0&&N.length>0?N:ee===""?[]:[ee]}}let b=y(e),[w,...R]=h;if(w!==void 0)r([w,...R]);return b}

// chunk-n3ykh62m.js Code leaf row measurement and refused-diff cleanup [267454,267903) 449 units sha256 e23f9cfdab72d01ae34691f2d0c8da45cec597216aeb3c9fcca54551e58baccc
function vur(e,n){let r=0;function s(h){if(h.type==="Code"){r+=1;let{format:T,startLine:P,...M}=h.props,z=vVe(M.source,T);if(z?.kind!=="refused")return h;return n({ordinal:r,path:M.path===void 0?void 0:IL(M.path),problem:z.problem}),{...h,props:M}}if(!(h.type==="Box"||h.type==="Text"||h.type==="Link"))return h;let{children:b}=h,w=b?.map((T)=>typeof T==="string"?T:s(T));return w!==void 0&&w.some((T,P)=>T!==b?.[P])?{...h,children:w}:h}return s(e)}

// chunk-n3ykh62m.js the Text a replaced Link falls back to [260804,260971) 167 units sha256 cf96d894b5759b1b3c89323201c6c7310cbb88f15bb8c4ed6ea5af972be975dc
function eIn(e){let{children:n}=e,r=L(e.props)?e.props:{},s=Array.isArray(n)&&n.length>0,{href:h,label:y}=r,b=typeof y==="string",w=ZAe(h);return s?"":b?y:w?Mrt(h):""}

// chunk-n3ykh62m.js the link problem a non-terminal surface reports [262061,262308) 247 units sha256 4a568c8897ef3c5a53c0b056660693d45839987b9b62c5ad246ed1e28c62b811
function tIn(e,n){if(!ZAe(e))return`is ${typeof e==="string"?"blank":e===void 0?"absent":cN(e)}, not a string that names where it goes`;let s=n!=="terminal"?ino(e):void 0;return s===void 0?void 0:`${s}, and the ${n} surface is sent no other link`}

// chunk-n3ykh62m.js URL rules for a link drawn on a non-terminal surface [261557,262061) 504 units sha256 e94c100f7a6b32804b1ec4424a5c8a5a0dc2d4b8acf195db11a706de9d48fffb
function ino(e){if(/[^!-~]/.test(e))return"holds a character outside printable ASCII";if(!URL.canParse(e))return"is not a URL";let{protocol:n,hostname:r,username:s,password:h,href:y}=new URL(e);if(!(n==="https:"||n==="http:"&&r==="localhost"))return"is not https: (or http://localhost)";if(s!==""||h!=="")return"carries credentials (user@host)";if(e.includes("@"))return"holds a raw @";let w=e.replace(/^(https?:\/\/[^/?#]+)(?=[?#]|$)/,"$1/");return y===e||y===w?void 0:`is not in canonical form (${y})`}


export { nIn, dno, kur, vur, QPn, eIn, tIn };
