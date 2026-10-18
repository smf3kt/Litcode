// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-gyf58rwf.js sha256 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad
//   chunk-j8hqhz0c.js sha256 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891
//   chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e
//   chunk-2bcyxj9q.js sha256 fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { isAbsolute as Fe, win32 as Ft } from 'node:path';
const F = 50; // source chunk-j8hqhz0c.js `F=50`: the per-file diff-list cap

// chunk-gyf58rwf.js Mt and qy: the hidden/control character class the diff-path guard tests [9236,9345) 109 units sha256 a55c495f2fcf11bea607ccd8c3d8b8ed1b1c7b4e8a1d2174ccdbcb6202cb7d9f
var Mt="\\p{Default_Ignorable_Code_Point}\\u2800",qy=`\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\u2028\\u2029${Mt}`

// chunk-j8hqhz0c.js L3t: control, format, separator and default-ignorable class [18883,18976) 93 units sha256 01139c3c0f8dfd08a66bc8dacd3dc7f6762f90e767ce0640df5565f8f589d1c4
var L3t=/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800]|(?!\u0020)\p{Zs}/u;

// chunk-j8hqhz0c.js Ct: lone surrogate class [19011,19028) 17 units sha256 3a95bb3edd492f41453f66ca060ba1cdb6c4643e17690e6c5ca50c3020c2df9b
var Ct=/\p{Cs}/u;

// chunk-j8hqhz0c.js Ccr: hidden or control characters [18976,19011) 35 units sha256 fcdad685fc17577221dbcf329d605f9d82f5b687369f00e1c95109a0944de513
function Ccr(e){return L3t.test(e)}

// chunk-j8hqhz0c.js N3t: hidden characters or lone surrogates [19028,19070) 42 units sha256 2c56b27c801e0fb42a9b5957b85e6d6f13e65acbc28ae23caefca9400574f308
function N3t(e){return Ccr(e)||Ct.test(e)}

// chunk-j8hqhz0c.js gkt: parse git --raw --numstat output into stats and per-file stats [25545,26152) 607 units sha256 5048402834bcde7f2584fcae5cea0c833a99b08d229e651a816de9640f9585c7
function gkt(e,n=F,r="all"){let s=e.trim().split(`
`).filter(Boolean),o=s.filter((b)=>b.startsWith(":")),i=s.filter((b)=>!b.startsWith(":")&&Lt(b,"\t")+1>=3),u=o.length>0&&o.length===i.length,p=0,h=0,S=0,T=new Map;for(let[b,R]of i.entries()){let y=R.split("\t"),A=y.slice(2).join("\t");if(r==="within-root"&&!xcr(A))continue;S++;let E=y[0],P=y[1],B=E==="-"||P==="-",G=B?0:parseInt(E??"0",10)||0,H=B?0:parseInt(P??"0",10)||0;if(p+=G,h+=H,T.size<n){let V=T.has(A);T.set(A,{added:G,removed:H,isBinary:B,isUntracked:!1,...u&&Kt(o[b],V)})}}return{stats:{filesCount:S,linesAdded:p,linesRemoved:h},perFileStats:T}}

// chunk-j8hqhz0c.js zt: raw status letter to status name [26152,26206) 54 units sha256 cb8cb8c95f0f8843aabd3c2bb27d71eaf630b95744dbad3acfc800305c698b99
var zt={A:"added",D:"removed",R:"renamed",C:"copied"};

// chunk-j8hqhz0c.js Kt: pair a raw status line with its numstat path [26206,26496) 290 units sha256 d8536cfd096ed3143eca3bda24a3c0fa6da7e79866fe815b9e588a49ca49fe02
function Kt(e,n){let[r,s,o]=e.split("\t"),i=r.slice(r.lastIndexOf(" ")+1)[0],u=zt[i]??"modified",p=re(o??s);if(n||p===void 0)return{status:u};if(o===void 0)return s.startsWith('"')?{status:u,newPath:p}:{status:u};let h=re(s);return h===void 0?{status:u}:{status:u,previousPath:h,newPath:p}}

// chunk-j8hqhz0c.js re: reject unsafe or hidden diff paths [26496,26671) 175 units sha256 8dfa8e5190cda8870ecc8172763d804f8e6e27b24779074acae5e9eab5f00d79
function re(e){let n=e.startsWith('"')?RAe(e.slice(1,-1)):e;return!N3t(n)&&!Pcr.test(n)&&!/\\|^[A-Za-z]:| => /.test(n)&&!Fe(n)&&n.split("/").every((s)=>j2(s)!=="..")?n:void 0}

// chunk-j8hqhz0c.js xcr: within-root path guard [26671,26824) 153 units sha256 3efb6d8f296be353409e12afe672447202f1d8dd656e0a2b9218eba71a191b37
function xcr(e){let n=Yt(e);return n!==null&&n.every((r)=>!Fe(r)&&!Ft.isAbsolute(r)&&!/^[A-Za-z]:/.test(r)&&r.split(/[/\\{}]/).every((s)=>j2(s)!==".."))}

// chunk-j8hqhz0c.js Yt: split a rename/copy display path [26824,27662) 838 units sha256 562e11ecef387bf4ec0f8cf8ee62624ceec0857bfd50a9eb9b172d9b10ad7222
function Yt(e){if(e.startsWith('"')){let p=ee(e);if(p===-1)return null;let h=RAe(e.slice(1,p)),S=e.slice(p+1);if(S==="")return[h];let T=S.startsWith(" => ")?S.slice(4):null;if(T===null)return null;if(!T.startsWith('"'))return T.includes('"')||T.includes(" => ")?null:[h,T];return ee(T)===T.length-1?[h,RAe(T.slice(1,-1))]:null}let n=e.indexOf(" => ");if(n===-1)return e.includes('"')?null:[e];if(e.indexOf(" => ",n+1)!==-1)return null;let r=e.slice(0,n),s=e.slice(n+4);if(r.includes('"'))return null;if(s.startsWith('"'))return ee(s)===s.length-1?[r,RAe(s.slice(1,-1))]:null;if(s.includes('"'))return null;let o=[r,s],i=r.indexOf("{"),u=s.indexOf("}");if(r.indexOf("{",i+1)!==-1||s.indexOf("}",u+1)!==-1)return null;if(i!==-1&&u!==-1){let p=r.slice(0,i),h=s.slice(u+1);o.push(`${p}${r.slice(i+1)}${h}`,`${p}${s.slice(0,u)}${h}`)}return o}

// chunk-j8hqhz0c.js ee: closing quote of a C-quoted path [27662,27760) 98 units sha256 3ac1cecd5bb9d8e5f94ac156d9f6c43e1de213bea03de02cf4c583e4d8b0da65
function ee(e){for(let n=1;n<e.length;n++)if(e[n]==="\\")n++;else if(e[n]==='"')return n;return-1}

// chunk-j8hqhz0c.js Pcr: replacement-character and hidden-class test [27760,27801) 41 units sha256 13e4f1abf333a99f858d8ead4d8864dd96691e2f1212614161d24b9405f75591
var Pcr=new RegExp(`[${qy}\\uFFFD]`,"u");

// chunk-j8hqhz0c.js RAe: decode a C-quoted git path [27801,28189) 388 units sha256 7a93f568f98d3ace3ce64fb708de5fc4eee7b70410c4d9d4a931604fb2bf3f51
function RAe(e){let n=[],r=Array.from(e);for(let s=0;s<r.length;s++){let o=r[s];if(o!=="\\"){n.push(...Buffer.from(o,"utf8"));continue}let i=r[s+1]??"",u=r.slice(s+1,s+4).join("");if(/^[0-3][0-7]{2}$/.test(u)){n.push(parseInt(u,8)),s+=3;continue}let h={n:10,t:9,r:13,b:8,a:7,f:12,v:11,'"':34,"\\":92}[i];if(h!==void 0)n.push(h),s+=1;else n.push(92)}return Buffer.from(n).toString("utf8")}

// chunk-ax7r0qj7.js Lt: occurrence counter [3561,3652) 91 units sha256 f2d166a2dc29276ed4cfdc6420711b6f00ff1b565d208f3693098bcfc55c7714
function Lt(t,n,e=0){let r=0,i=t.indexOf(n,e);while(i!==-1)r++,i=t.indexOf(n,i+1);return r}

// chunk-2bcyxj9q.js j2: reduce a path segment's trailing spaces and dots [152766,152948) 182 units sha256 edbaa67f4b5ba81128a8acdca633d5f49ce32a302eb46da854821881bebdb503
function j2(e){let n=e.length;for(;;){let r=n;while(r>0&&e[r-1]===" ")r--;let s=e.slice(0,r);if(s==="."||s==="..")return s;let h=r;while(h>0&&e[h-1]===".")h--;if(h===n)return s;n=h}}


export { gkt, Kt, re, xcr, Yt, N3t, RAe, Pcr };
