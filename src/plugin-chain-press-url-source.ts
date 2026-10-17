// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-j8hqhz0c.js sha256 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891
//   chunk-ae84tp6z.js sha256 901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f
//   chunk-d1ctn2b7.js sha256 70bbf5260219e26bc052c1de6725be60ff84458e4552c79757ace16c9f616bfd
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { et, tt, nt, a, Rn, se } from './plugin-chain-press-url-host.js';

// chunk-j8hqhz0c.js `IF` — absolute path to a file URL, refusing a UNC, dangerous or encoded-traversal path [46149,46315) 166 units sha256 f7b8c5922a21c9fcb8e366eece6d96d49a010d9892e86c8064cdb57cf0be0811
function IF(e){try{let n=lA(e),r=lA(nt(n));if(tl(n)||Bn(r)||Cot(n)||Cot(r))return null;let s=Rn(n);return s.hostname!==""||Yoo(s.href)?null:s.href}catch{return null}}

// chunk-j8hqhz0c.js `mxn` — normalize a local href to a file URL, keeping the query and fragment [46315,46756) 441 units sha256 ef5d82c5c28ee7057fa1232e8c277d2b7aa87d7f5dad22e9d0c4694d563bd6c6
function mxn(e){let n=/^file:/i.test(e);if(!n){if(!(e.startsWith("/")&&!Bn(e)))return e}let r=n?e.slice(5):e;if(r.startsWith("//")){if(r=r.slice(2),r==="localhost")r="/";else if(r.startsWith("localhost/"))r=r.slice(9)}let s=r.search(/[#?]/),o=s===-1?"":r.slice(s),i=s===-1?r:r.slice(0,s);if(i==="")return null;try{i=decodeURIComponent(i)}catch{}i=An(i);let u=tt(i)?i:nt(se(),i),p=IF(u);if(p===null)return null;let h=p+o;return Yoo(h)?null:h}

// chunk-j8hqhz0c.js `An` — strip a leading slash before a Windows drive letter [46756,46855) 99 units sha256 9644676c7ed2b68f1a47192658d785753055a2ce6e93885e2c7d1f3089b2b3d3
function An(e,n=tt){if(/^\/[A-Za-z]:(?=[\\/]|$)/.test(e)&&n(e.slice(1)))return e.slice(1);return e}

// chunk-ae84tp6z.js `Bn` — whether a path is a UNC or extended-length path [7436,7484) 48 units sha256 0cb9af02d0d6dd6042509d464440b555e562472c866d5a91df344df552b4b3e6
function Bn(t){return/^[\\/]{2}/.test(t)||zN(t)}

// chunk-ae84tp6z.js `zN` — whether a path is an extended-length path after normalization [22769,22836) 67 units sha256 d605d6e55755cd8073fdecac05d2793f41769c534f0d8d09b358d5b45e3eb8e9
function zN(t){return zt.test(t)||t.includes("??")&&zt.test(Xt(t))}

// chunk-ae84tp6z.js `zt` — the extended-length path prefix [22836,22861) 25 units sha256 8b68dda0adc5783173149a1075e35d52617263cf6cbc25bfac86edb046a1d428
var zt=/^[\\/]\?\?[\\/]/;

// chunk-ae84tp6z.js `Xt` — normalize a path with the Windows rules [22861,22916) 55 units sha256 c66fb84c6fa92680c8f30c8ee39c603d3873fa9d70759c96ae066815745c60bc
function Xt(t){return et.win32?et.win32.normalize(t):t}

// chunk-ae84tp6z.js `lA` — strip the extended-length prefix [14875,15025) 150 units sha256 2cc266b2e773a747761ea086d3848b906b135b6cabcca1a9639fc714acfeaee2
function lA(t){if(t.startsWith("\\\\?\\UNC\\"))return"\\\\"+t.slice(8);if(t.startsWith("\\\\?\\")&&t.length>=7&&t[5]===":")return t.slice(4);return t}

// chunk-ae84tp6z.js `tl` — whether a posix path is dangerous [11681,11730) 49 units sha256 a1ef7566d730b862d332c82c4c742d5856c8edf590571e100039461e32205a71
function tl(t){return Bn(t)||fa(t)||qP(t)||aw(t)}

// chunk-ae84tp6z.js `fa` — whether a path names a device [11361,11389) 28 units sha256 26d0cf49ce2baf85f5d1cc4a5c5a7e6144949e4adcffb829f71d4412cb139919
function fa(t){return qa(t)}

// chunk-ae84tp6z.js `qP` — whether a path is a Windows device path [12953,12981) 28 units sha256 294c1dcd6267030db307e8fee78d4336f860dee7b0e0420ef48ced9a2820175e
function qP(t){return qO(t)}

// chunk-ae84tp6z.js `aw` — whether a path escapes through a dot-dot segment [8134,8430) 296 units sha256 e0d33d95aae667fdb6f15e90160445fae5a79a513a859b4bb356bf49673e09cf
function aw(t){if(!/\/\.(?:vol|file|nofollow|resolve)(?:\/|$)/i.test(t))return!1;if(!t.startsWith("/"))return!1;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),e.length===1&&/^\.(?:vol|file|nofollow|resolve)$/i.test(n))return!0}return!1}

// chunk-ae84tp6z.js `QPe` — the cached posix path parse [11855,12015) 160 units sha256 db0ca5399d41f0cc1dd882c3b72a0e80344d195dffb1021235b9344cbd0c4460
function QPe(t){if(!t.startsWith("/"))return null;if(t.length>Gt)return Lt(t);let e=I.get(t);if(e===void 0){if(e=Lt(t),I.size>=Bt)I.clear();I.set(t,e)}return e}

// chunk-ae84tp6z.js `qa` — whether the posix parser found anything [11779,11815) 36 units sha256 20f934ed9febf3c4b094be4afff897291ac3164913af3d1e9c1332f49d28a260
function qa(t){return QPe(t)!==null}

// chunk-ae84tp6z.js `GS` — the posix path danger scan [12414,12612) 198 units sha256 0b4dad4616331a2b2c940812e1736d099e67a10e639ddcf38c92770294b9afff
function GS(t){if(!t.startsWith("/"))return!1;let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}e.push(n)}return e.length===1&&e[0].toLowerCase()==="net"}

// chunk-ae84tp6z.js `qO` — the posix path segment scan [12612,12768) 156 units sha256 0b2b40c15fee71b9a3da6cddf82dccbd0d7f4d4e1860d55010e6fc9953130e01
function qO(t){if(!t.startsWith("/"))return!1;if(t.length>Gt)return Mt(t);let e=k.get(t);if(e===void 0){if(e=Mt(t),k.size>=Bt)k.clear();k.set(t,e)}return e}

// chunk-ae84tp6z.js `Mt` — the posix path parse [12768,12953) 185 units sha256 ae2d793b23f969646b4a45d68a6d706ba3e8bbdab116510b2c01ec848ffb6f7d
function Mt(t){let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),e.length===1&&e[0].toLowerCase()==="network")return!0}return!1}

// chunk-ae84tp6z.js `C` — one posix path segment check [8635,8745) 110 units sha256 645391b17f19980122f8148f31cfbcbc96e838705a529383cd05ec110f0ab2ff
function C(t){return t.length===2&&YR(t[0])==="net"||t.length===3&&YR(t[0])==="network"&&YR(t[1])==="servers"}

// chunk-ae84tp6z.js `YR` — whether a posix path is absolute [8993,9108) 115 units sha256 d104be4ed5b5a98f9b2ddaf558be293b37142fd509816691c5e40c2756145af5
function YR(t){return t.replace(/[\u200c-\u200f\u202a-\u202e\u206a-\u206f\ufeff]/g,"").toUpperCase().toLowerCase()}

// chunk-ae84tp6z.js `Lt` — the posix path parser [12015,12176) 161 units sha256 8316fff200862d351d23d68c54da443a4639a67d379ea07582d7e05a4bfcc885
function Lt(t){let e=[];for(let n of t.split("/")){if(n===""||n===".")continue;if(n===".."){e.pop();continue}if(e.push(n),C(e))return"/"+e.join("/")}return null}

// chunk-ae84tp6z.js `_m` — whether a posix path is dangerous [12981,13030) 49 units sha256 c4fea66b3fec196075dd7a7c15984ea69f684f59cfd99c8d710687c191f48134
function _m(t){return qa(t)||GS(t)||qO(t)||aw(t)}

// chunk-ae84tp6z.js `Bt`/`Gt`/`I`/`k` — the path parse cache bounds and tables [11815,11855) 40 units sha256 5cd509e8813f7a905d1be88428656187308f5572d555377e1a79a07b47fe9fd7
var Bt=1024,Gt=4096,I=new Map,k=new Map;

// chunk-d1ctn2b7.js `vfr` — whether a file URL path is dangerous, after percent decoding [896,994) 98 units sha256 b120282b2711ff96cfadee8b8da5a86cf99408e865c262447187654f6f0a0873
function vfr(n,r=Xoo(n)){return Bn(n)||Cot(n)||uG.test(r[0])||r.map(Koo).some((e)=>Bn(e)||Cot(e))}

// chunk-d1ctn2b7.js `Cot` — whether a path names a dot-dot traversal [1010,1091) 81 units sha256 44b1f1ff9a98d4fc543673f8073d7fe30bf6b50b4283bb3c3bc5a465297985fc
function Cot(n){return _m(n)||_m(a.normalize(n).replace(u,"/"))||l(n)&&_m("/"+n)}

// chunk-d1ctn2b7.js `Yoo` — whether a file URL names a traversal [1163,1227) 64 units sha256 5533337c79fc885316d518646307db2fe34ac7fac52fc14eb1d3eb0ce7a6ffa1
function Yoo(n){let r=n.slice(7);return vfr(r)||vfr(r.slice(1))}

// chunk-d1ctn2b7.js `Xoo` — percent-decode a path for the traversal checks [1284,1560) 276 units sha256 d5044d50183b5cfd7193d70c6398bb2d3454be600c32be7b9d91a56935ee390d
function Xoo(n){if(!n.includes("%"))return[n,n];let r=new TextDecoder("utf-8",{fatal:!1,ignoreBOM:!0});return[n.replace(i,(e,t)=>{let o=t+e.length;return r.decode(s(e),{stream:f.test(n.slice(o,o+3))})}),n.replace(i,(e)=>Array.from(s(e),(t)=>String.fromCharCode(t)).join(""))]}

// chunk-d1ctn2b7.js `s` — percent bytes of one escape [1560,1640) 80 units sha256 606e06a0c7302db18c0ff1a26e478e5831cb96f1cfda29ddc99f0dabad49dec2
function s(n){return Uint8Array.from(n.slice(1).split("%"),(r)=>parseInt(r,16))}

// chunk-d1ctn2b7.js `Koo` — strip leading invisible characters [857,896) 39 units sha256 d6c290ec5614ec335778d28ff9a69012dd4a4a0db09e04910beeaaec5015e58c
function Koo(n){return n.replace(c,"")}

// chunk-d1ctn2b7.js `l` — whether a normalized posix path leaves its root [1091,1163) 72 units sha256 38f330d0c327f38522b05e24172e4cad8b268b2fe9f06a97e8a2ad56ccf71ea7
function l(n){let r=a.normalize(n);return r===".."||r.startsWith("../")}

// chunk-d1ctn2b7.js `c` — the leading invisible-character pattern [741,857) 116 units sha256 81a0c29675bb7450cba340aa1a601f70ed17dd35ba495fa9ece0914403f18fa5
var o0n=String.raw`\s\u2800\uFFF9-\uFFFB\p{Cc}\p{M}\p{Default_Ignorable_Code_Point}`,c=new RegExp(`^[${o0n}]+`,"u");

// chunk-d1ctn2b7.js `i`/`f` — the percent-escape pattern and the leading-escape test [1227,1284) 57 units sha256 459d0142b78d9482495e7020719eb9deb77c3e7593400fdb1f6cbf5007210db9
var i=/(?:%[0-9A-Fa-f]{2}){1,512}/g,f=/^%[0-9A-Fa-f]{2}/;

// chunk-d1ctn2b7.js `u` — the leading dot-dot pattern [994,1010) 16 units sha256 8e3468104606ca02b4d2e382bb5264531d94c0e60e64551e628fa646450c1441
var u=/^\.\.\//;

// chunk-ax7r0qj7.js `uG` — the control-character pattern [5178,5245) 67 units sha256 932e6769362f1fccc91d80ad0e41abf23798ff2abcd62f8794e573972f156c88
var Wse=/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g,uG=/[\x00-\x1F\x7F-\x9F]/;


export { mxn, An, IF, Bn, zN, zt, Xt, lA, tl, fa, qP, aw, QPe, qa, GS, qO, Mt, C, YR, Lt, _m, Bt, Gt, I, k, vfr, Cot, Yoo, Xoo, s, Koo, l, c, f, i, u, uG };
