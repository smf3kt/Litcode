// @ts-nocheck
// Exact UTF-16 source ranges and Node binding: research/ports/W288-live-model-description.md.
import { stripVTControlCharacters as pn } from 'node:util';
function ne(t,n){if(n<=0)return"";if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return WMt(r>=55296&&r<=56319?e.slice(0,-1):e)}
function WMt(t){if(typeof Buffer<"u")return Buffer.from(t,"utf16le").toString("utf16le");return x(t)}function x(t){let e=[];for(let r=0;r<t.length;r+=8192){let i=Math.min(r+8192,t.length),o=new Uint16Array(i-r);for(let u=r;u<i;u++)o[u-r]=t.charCodeAt(u);e.push(String.fromCharCode(...o))}return e.join("")}
var a=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
var l=typeof String.prototype.isWellFormed==="function"?Function.prototype.call.bind(String.prototype.isWellFormed):void 0;
function Gw(t){if(l&&l(t))return t;return t.replace(a,"")}
var Mt="\\p{Default_Ignorable_Code_Point}\\u2800",qy=`\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\u2028\\u2029${Mt}`;
var Wt=new RegExp(`[${qy}]+`,"gu");
function Bse(e){return Gw(pn(e)).replace(Wt," ")}function ti(e,n){let r=Bse(e);if(n?.drop)r=r.replace(n.drop,"");if(r=r.replace(/\s+/g," ").trim(),n?.maxCodeUnits!==void 0)r=ne(r,n.maxCodeUnits).trim();return r}
var I8e=255;
function AT(e){let n=ti(e,{drop:/[`<>]/g}).replace(/\]\(/g,"] (").replace(/!\[/g,"! [").replace(/\]\[/g,"] [").replace(/\]:/g,"] :");return ne(n,I8e).trim()}
export { AT };
