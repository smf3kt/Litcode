// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { stripVTControlCharacters as pn } from 'node:util';
// chunk-ax7r0qj7.js ne [1128,1272), UTF-16; sha256 8342442e1da2530ab21d0582e8743df3285b005a06d2ba016d50bd10383cf592
function ne(t,n){if(n<=0)return"";if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return WMt(r>=55296&&r<=56319?e.slice(0,-1):e)}
// chunk-ax7r0qj7.js WMt/x [1544,1850), UTF-16; sha256 395dfa448621bdef4ab3fff7b7f07f26afd7e217aca0a1f6f658119e09098108
function WMt(t){if(typeof Buffer<"u")return Buffer.from(t,"utf16le").toString("utf16le");return x(t)}function x(t){let e=[];for(let r=0;r<t.length;r+=8192){let i=Math.min(r+8192,t.length),o=new Uint16Array(i-r);for(let u=r;u<i;u++)o[u-r]=t.charCodeAt(u);e.push(String.fromCharCode(...o))}return e.join("")}
// chunk-ax7r0qj7.js m/a/l/g/Yc/hf [1850,2353), UTF-16; sha256 1e0fa7e4714782a29d965ad91a438fe36f2be81ba739179928af18feb504ccc3
var m=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,a=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,l=typeof String.prototype.isWellFormed==="function"?Function.prototype.call.bind(String.prototype.isWellFormed):void 0,g=typeof String.prototype.toWellFormed==="function"?Function.prototype.call.bind(String.prototype.toWellFormed):void 0;function Yc(t){if(l)return l(t);return!m.test(t)}function hf(t){if(g)return g(t);return t.replace(a,"\uFFFD")}
// chunk-ax7r0qj7.js Gw [2353,2411), UTF-16; sha256 b093161e47534dbd9d20292ed4a5829d503bc10d1221616e8931eb30a17de292
function Gw(t){if(l&&l(t))return t;return t.replace(a,"")}
// chunk-ax7r0qj7.js _c [4917,5021), UTF-16; sha256 1a22a53300e41c8789791d72a986706204779f7a511b64409c86e73448eaed6e
function _c(t,n){if(t.length<=n)return t;let e=ne(t,n);return`${e}\u2026 [+${t.length-e.length} chars]`}
// chunk-gyf58rwf.js _r/mf [10666,10979), UTF-16; sha256 a0373e5b3806a802f8b1b841277a3fa6e2ed73f53fcba506c83b05fcba72dc3a
function _r(e){let n=e.replace(/[\p{Cf}\p{Co}\p{Cn}]/gu,"");return n=n.replace(/[\u200B-\u200F]/g,"").replace(/[\u202A-\u202E]/g,"").replace(/[\u2066-\u2069]/g,"").replace(/[\uFEFF]/g,"").replace(/[\uE000-\uF8FF]/g,""),n}function mf(e){let n=Gw(e);for(let r=0;r<10;r++){let s=_r(n);if(s===n)return n;n=s}return n}
// chunk-2bcyxj9q.js Ym/Fn/Co/$0 [166885,167101), UTF-16; sha256 665da40ca65f7c9b206efc36a2a8d062e119218c57c23bc8fce7ffae9f0d0503
var Ym=/[\x00-\x1f\x7f-\x9f\u061c\u2028\u2029\u202a-\u202e\u2066-\u2069\p{Co}\p{Cn}]/gu;function Fn(e){let n=pn(e),r=n===e?n:n+"\uFFFD";return mf(r.replace(Ym,"\uFFFD"))}var Co=160;function $0(e){return _c(Fn(e),Co)}
// chunk-2bcyxj9q.js sNe [238027,238395), UTF-16; sha256 533af4c6840e34372130decf456005f5a00a0177b56f68ab0f7679654644b16f
function sNe(e,n){if(!n.leafIsSymlink)return null;let r=n.unresolved?"a target that could not be determined":$0(n.landing);return{behavior:"deny",message:`Refusing to write ${$0(e)}: it is a symbolic link. Write to the link's target path instead: ${r}.`,decisionReason:{type:"other",reason:"Write target is a symbolic link"},...!n.unresolved&&{blockedPath:n.landing}}}
// chunk-2bcyxj9q.js Al [239532,239801), UTF-16; sha256 8c4c85e5ee60a4182b2f910e59e5240cfb0ad3cad2cafd0f3bc6d6b689214eda
function Al(e,n){return{behavior:"deny",message:`Refusing to ${e==="write to"?"write":"read"} ${$0(n)}: where it leads on disk could not be determined (a link on the way could not be examined, or the links do not resolve).`,decisionReason:{type:"other",reason:EDn(n)}}}
// chunk-2bcyxj9q.js EDn [239874,240035), UTF-16; sha256 d4bc8c2deedcf66959901a800cee8e3826cf154d0e2c56c8a3aa71b2a2dc24a8
function EDn(e){return`Where ${$0(e)} leads on disk could not be determined (a link or directory on the way could not be examined, or the links do not resolve)`}
export { Al, sNe };
