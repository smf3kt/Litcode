// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-2bcyxj9q.js sha256 fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0
//   chunk-z6p21rxk.js sha256 2e9c002da378e738a825dbd5c30f9a6341a9cf2c1d7022d4e1bbec2dfacf72dd
//   chunk-3cynezh1.js sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { platform, homedir } from 'node:os';
const O = () => platform() === 'win32' ? 'windows' : platform();
const Tt = homedir, Re = '/';
import ignore from 'ignore';
const _a = {default: ignore};
const Ra = {compileErrorMessage: im};
const ho = () => {};
import path from 'node:path';
import { resolveChain } from './path-identity.js';
const _e = path.resolve, ie = () => undefined, t = () => {};
const FN = (_fs, value) => resolveChain(path.parse(value).root, value).path;

// chunk-2bcyxj9q.js path root syntax [219605,220384) 779 units sha256 deaec1d535d35776d0c722c04a0e7c9c9a212676a12d2218ca10d8db431eee7a
function tNe(e,n){if(O()==="windows"&&(e.startsWith("~\\")||e.startsWith("\\")&&e[1]!=="!"&&e[1]!=="#"))e=e.replaceAll("\\","/");if(e.startsWith(`${Re}${Re}`)){let s=e.slice(1);if(O()==="windows"&&s.match(/^\/[a-z]\//i)){let h=s[1]?.toUpperCase()??"C",y=s.slice(2),w=`${h}:\\`;return{relativePattern:y.startsWith("/")?y:"/"+y,root:w}}return{relativePattern:s,root:Re}}else if(O()==="windows"&&e.match(/^[A-Za-z]:[/\\]/)){let s=e[0].toUpperCase(),h=e.slice(2).replaceAll("\\","/");return{relativePattern:h.startsWith("/")?h:"/"+h,root:`${s}:\\`}}else if(e.startsWith(`~${Re}`))return{relativePattern:e.slice(1),root:Tt().normalize("NFC")};else if(e.startsWith(Re))return{relativePattern:e,root:n};let r=e;if(e.startsWith(`.${Re}`))r=e.slice(2);return{relativePattern:r,root:null}}

// chunk-2bcyxj9q.js pattern normalization [220384,220553) 169 units sha256 53965bfa4efff353f03c11aba11ae12196664c76acc86add83f4f5296040b578
function en(e){let n=e.replace(/\/{2,}/g,"/");if(/^\s*(?:\/\*\*)?$/.test(n))return n;return n.replace(/^\uFEFF([!#]?)/,(r,s)=>s?"\\"+s:"").replace(/^\uFEFF/,"[\uFEFF]")}

// chunk-2bcyxj9q.js recursive path pattern [220736,220876) 140 units sha256 5323df974064cac7f36a072ad5184760b7a66e7b83269db3df0f56e8ca267cab
function Wn(e,n){if(e.endsWith("/**")){let r=e.slice(0,-3);return/[^/]/.test(r)?r.includes("/")||!n||/^[!#]/.test(r)?r:"/"+r:"/**"}return e}

// chunk-2bcyxj9q.js invalid pattern disposition [220876,221216) 340 units sha256 7e00e682a0bfd2903e53051e2085a122dba268ececc24a32155a6bfaefb07004
function Vo(e,n){let r=Wn(e,n),s=!n&&/^!\s*$/.test(r)?"a negation of every path":po(r);if(s===null)return e;let h=e.startsWith("!")?"!":"",y=h?!n:n;if(ho("permission_rules",e,s,y?"dropping it":"matching the literal path it spells"),y)return null;let w=e.endsWith("/**")?"/**":"",b=e.slice(h.length,e.length-w.length);return h+kse(_rn(b))+w}

// chunk-2bcyxj9q.js ignore pattern validation [151454,151771) 317 units sha256 31227157051dffb1ee2561fb7bd2f7d6e7a6aec5b38390d9b0a81c0739fa275d
function ehr(e){return Ra.compileErrorMessage(e)}function im(e){try{return _a.default().add([e]).test("probe"),null}catch(n){return n instanceof Error?n.message:String(n)}}var sm=/^\s*$|^#|(?:^|[^\\])\\$/;function po(e){return sm.test(e)?"skipped by the ignore library (blank, comment, or trailing backslash)":ehr(e)}

// chunk-z6p21rxk.js literal pattern escaping [2118,2498) 380 units sha256 d7cd66439a7ef446518ed5f2e3e35fc98070b96d0d088bcf08f8ad156dabce07
function kse(e,t){let n=e.replaceAll("\\","\\\\").replace(/[[\]()|+^$]/g,(r)=>`\\${r}`);if(t?.escapeGlobs)n=n.replaceAll("*","\\*");if(n.startsWith("!")||n.startsWith("#"))n=`\\${n}`;return n=n.replace(/\s+$/,(r)=>Array.from(r,(o)=>`\\${o}`).join("")),n}function _rn(e){return e.replace(/\\([^])/g,(t,n)=>Srn(n)?n:t)}var m=/^[\\[\]!#()|+^$*?\s]$/;function Srn(e){return m.test(e)}

// chunk-3cynezh1.js shell wildcard sentinels [181722,181873) 151 units sha256 8de0eb82bd6e21755dd68f525dab55fb46778dc412afd57ce068c2dab899cba0
var Cg=new RegExp("\x00ESCAPED_STAR\x00","g"),Rg=new RegExp("\x00ESCAPED_BACKSLASH\x00","g"),Og=/\/(?:\*\*\/)+/g,Tg=new RegExp("\x00GLOBSTAR\x00","g");

// chunk-3cynezh1.js shell prefix [181873,181928) 55 units sha256 1190f0b634cc3d060c58655c8f99818791adcc126da6ee4baee0af3bd6cddd55
function Bxe(e){return e.match(/^(.+):\*$/)?.[1]??null}

// chunk-3cynezh1.js shell wildcard detection [181928,182090) 162 units sha256 d6a50ab3cb3e592e295ea37bb35221a4a921cdbc4a8a1ed68bbf5a04628ef878
function oko(e){if(e.endsWith(":*"))return!1;for(let n=0;n<e.length;n++)if(e[n]==="*"){let s=0,r=n-1;while(r>=0&&e[r]==="\\")s++,r--;if(s%2===0)return!0}return!1}

// chunk-3cynezh1.js shell wildcard matcher [182221,182861) 640 units sha256 3b5d045376695f786b03e7f1ecf5e919551ee31acbbeb1fcd8d3b5499442e9b6
function uZ(e,n,s=!1,r=!1){if(e.includes("\x00"))return!1;let i=e.trim(),d=r?i.replace(/[ \t]+/g," "):i,c=r?n.replace(/[ \t]+/g," "):n,g="",m=0;while(m<d.length){let T=d[m];if(T==="\\"&&m+1<d.length){let K=d[m+1];if(K==="*"){g+="\x00ESCAPED_STAR\x00",m+=2;continue}else if(K==="\\"){g+="\x00ESCAPED_BACKSLASH\x00",m+=2;continue}}g+=T,m++}let S=g.replace(/[.+?^${}()|[\]\\'"]/g,"\\$&").replace(Og,"\x00GLOBSTAR\x00").replaceAll("*",".*").replace(Tg,"/(?:.*/)?").replace(Cg,"\\*").replace(Rg,"\\\\"),b=(g.match(/\*/g)||[]).length;if(S.endsWith(" .*")&&b===1)S=S.slice(0,-3)+"( .*)?";let k="s"+(s?"i":"");return new RegExp(`^${S}$`,k).test(c)}

// chunk-3cynezh1.js shell rule variants [182861,183008) 147 units sha256 4320ed8f1ca2ba09f1a2c76181883b900a8d10961bdad8e16371b4103b247267
function jxe(e){let n=Bxe(e);if(n!==null)return{type:"prefix",prefix:n};if(oko(e))return{type:"wildcard",pattern:e};return{type:"exact",command:e}}

// chunk-2bcyxj9q.js physical twin literal prefix and glob tail [221216,221752) 536 units sha256 f9dc2d49396edfb0c4868ab368ece8218428aa670bd9168a52595cb78de3a65a
var xf=/(?:^|[^\\])(?:\\\\)*[*?[]/;function Cf(e,n){if(O()==="windows"||!n.startsWith("/"))return null;let r=n.slice(1).split("/"),s=0;while(s<r.length&&r[s]!==""&&!xf.test(r[s]))s++;if(s===0)return null;let h=_e(e,...r.slice(0,s).map(_rn)),y;try{y=FN(ie(),h)}catch(R){return t(`Could not resolve the physical twin of rule prefix ${h}: ${R}`),null}if(y===void 0||y===h||y===Re)return null;let w=r.slice(s),b=en(kse(y,{escapeGlobs:!0})+(w.length>0?"/"+w.join("/"):"")),P=Wn(b,!1);if(po(P)!==null||P!==b&&P+"/**"!==b)return null;return b}


export { tNe, en, Wn, Vo, kse, _rn, uZ, jxe, Cf };
