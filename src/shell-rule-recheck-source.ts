// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { vS } from "./bash-parser-source.js";
import { m0 } from "./shell-reading-merge-source.js";
// chunk-m00pavz3.js m [967,1007), UTF-16; sha256 be22ac1da36bddc48d37bece138ab4894d56a9d4139439f8c16af0ab5d893ef5
var m=new Set(["program","list","pipeline"]);
// chunk-m00pavz3.js E [1008,1051), UTF-16; sha256 d0d85c14f84c4d3f58f03c4cbdaef5e80cb0830bdf919979c50cee3a9520d4ba
var E=new Set(["&&","||","|",";","&","|&",`
`]);
// chunk-m00pavz3.js D0 [1052,1058), UTF-16; sha256 7ddf33f32b7490744472a8acab3b5aee746014474fab84c2edb92232d6446c88
var D0=1e4;
// chunk-m00pavz3.js P [1059,1066), UTF-16; sha256 9f07f801d49c2558b46c97ea51acf0655e44f4033a476f6a15e681bdc7098f77
var P=65536;
// chunk-m00pavz3.js U [1067,1071), UTF-16; sha256 6b77267eaa3536fa0b7f1d24e7d1c4433314d1499eb2b962acce902a38ecbfd7
var U=16;
// chunk-m00pavz3.js Kg [1072,1477), UTF-16; sha256 b3f4c2b6c83031fad9667b1437766a5e21667b48b454a15054a5edf134c2945e
function Kg(e){if(!e)return[];if(e.length>D0)return[e];let t=vS().parse(e);if(!t)return[e];let r=[],s=(i)=>{if(E.has(i.type)||i.type==="comment")return;if(i.type==="redirected_statement"){for(let n of i.children)if(!n.type.endsWith("_redirect"))s(n);return}if(m.has(i.type)){for(let n of i.children)s(n);return}r.push(i.text)};return s(t.type==="ERROR"&&t.children[0]?.type==="program"?t.children[0]:t),r}
// chunk-m00pavz3.js ost [1831,1914), UTF-16; sha256 b2c882951c1f719b9c5d2c3ee7a284c61222edd9b71f0c9efd9fb069f0dddc9b
function ost(e){if(!e||e.length>D0)return[];let t=vS().parse(e);return t?Emr(t):[]}
// chunk-m00pavz3.js Emr [1914,2193), UTF-16; sha256 605b99daf328a2ab4e63ad608f92858473d848a975eff582479e65cdf38a4416
function Emr(e){let t=[],r=P,s=U,i=!1,n=(o)=>{if(i)return;if(o.type==="command")t.push(o.text),r-=o.text.length;let u=vmr(o);if(u!==null)s-=1,r-=u.length;if(r<0||s<0){i=!0;return}if(u!==null){let f=vS()?.parse(u);if(f)n(f);return}for(let f of o.children)n(f)};return n(e),i?[]:t}
// chunk-m00pavz3.js vmr [2193,2427), UTF-16; sha256 4ad013a326ae6457c8f124eb99a77b9af5beb42a098be2431df5a909cca9def3
function vmr(e){if(e.type!=="expansion"&&e.type!=="ERROR")return null;let t=e.text;if(!/^\$\{[ \t\n|]/.test(t))return null;let r=t.endsWith("}")?t.length-1:t.length;return t.slice(2,r).trim().replace(/^\|/,"").replace(/;$/,"").trim()}
export function createShellRuleRecheck(Gre, dA) {
const ki = { name: "Bash" };
// chunk-sfn1dbxq.js $cn [3253132,3253708), UTF-16; sha256 724ee7599692796f6c6d2c7aa85f60073db9bb760955e046a46c5ff1be9f1743
function $cn(e,n,r){if(e.behavior!=="ask"||m0(e))return e;if(Gre(r,ki,"ask").size===0&&Gre(r,ki,"deny").size===0)return e;let s=new Set([n.command,...Kg(n.command),...e.decisionReason?.type==="subcommandResults"?e.decisionReason.reasons.keys():[],...ost(n.command)]),h;for(let y of s){let{matchingDenyRules:b,matchingAskRules:w}=dA({...n,command:y},r,"prefix");if(b[0]!==void 0)return{behavior:"deny",message:`Permission to use ${ki.name} with command ${n.command} has been denied.`,decisionReason:{type:"rule",rule:b[0]}};h??=w[0]}return h===void 0?e:{...e,matchedAskRule:h}}
return $cn;
}
// chunk-sfn1dbxq.js cPn/WA/SWr/bWr/wWr/wJe/vWr/vJe [4243293,4244283), UTF-16.
var cPn=(e,n,r)=>({isError:e!==0,message:e!==0?`Command failed with exit code ${e}`:void 0}),WA=(e)=>(n,r,s)=>({isError:n>=2,message:n===1?e:void 0}),SWr=new Map([["grep",WA("No matches found")],["rg",WA("No matches found")],["egrep",WA("No matches found")],["fgrep",WA("No matches found")],["find",WA("Some directories were inaccessible")],["diff",WA("Files differ")],["test",WA("Condition is false")],["[",WA("Condition is false")]]);function bWr(e){let n=vWr(Kg(e).at(-1)||e);if(n==="git"){let s=wWr(e);if(s==="diff"||s==="grep")return WA(s==="grep"?"No matches found":"Files differ")}let r=SWr.get(n);return r!==void 0?r:cPn}function wWr(e){let r=Kg(e).at(-1)||e;return wJe(r.trim().split(/\s+/))}function wJe(e){if(e[0]!=="git")return;for(let n=1;n<e.length;n++){let r=e[n];if(r.startsWith("-")){if(r==="-C"||r==="-c")n++;continue}return r}return}function vWr(e){return e.trim().split(/\s+/)[0]||""}function vJe(e,n,r,s){let y=bWr(e)(n,r,s);return{isError:y.isError,message:y.message}}
export { Kg, Emr, vJe };
