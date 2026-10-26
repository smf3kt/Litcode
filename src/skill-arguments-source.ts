// @ts-nocheck
// Exact recovered declarations. Regenerate or verify with scripts/skill-argument-source.mjs.
import { vS } from "./bash-parser-source.js";

// chunk-zjewzgfh.js $e,ut,ft,ne,re [818,1068), UTF-16; sha256 8e0d064cb8f58a2bb4667fd809f0437629783a48baa636ba884c71c899ce3840
var $e=1e4,ut=new Set(["export","declare","typeset","readonly","local","unset","unsetenv"]),ft=new Set(["word","string","raw_string","number"]),ne=new Set(["command_substitution","process_substitution"]),re=new Set(["command","declaration_command"]);

// chunk-zjewzgfh.js nde [1631,2009), UTF-16; sha256 89a16dba960c35f0f8cc42a531e745ee0a01ee4b55ba956076d3b58f8e55efa0
function nde(e,t){let{type:r,children:s}=e;if(re.has(r))return e;if(r==="variable_assignment"&&t)return t.children.find((o)=>re.has(o.type)&&o.startIndex>e.startIndex)??null;if(r==="pipeline"){for(let o of s){let n=nde(o,e);if(n)return n}return null}if(r==="redirected_statement")return s.find((o)=>re.has(o.type))??null;for(let o of s){let n=nde(o,e);if(n)return n}return null}

// chunk-zjewzgfh.js DKe [2205,2790), UTF-16; sha256 b090817dc7031bb0c67afd55c05d20d2e39c718fbb0ec573759c53122a536620
function DKe(e){if(e.type==="declaration_command"){let s=e.children[0];return s&&ut.has(s.text)?[s.text]:[]}let t=[],r=!1;for(let s of e.children){if(s.type==="variable_assignment")continue;if(s.type==="command_name"||!r&&s.type==="word"){r=!0;let o=s.children[0]??s;if(o.type==="concatenation")t.push(o.children.some((n)=>ne.has(n.type))?o.text:o.children.map(G).join(""));else t.push(G(o));continue}if(ft.has(s.type))t.push(G(s));else if(s.type==="concatenation"){if(s.children.some((o)=>ne.has(o.type)))break;t.push(s.children.map(G).join(""))}else if(ne.has(s.type))break}return t}

// chunk-zjewzgfh.js G [2790,2878), UTF-16; sha256 bc1f85744909fea92b7d7a6d770b12b1fdc376448e8b34950502cfaa1b260ddf
function G(e){if(e.type==="word")return e.text.replace(/\\(.)/g,"$1");return pt(e.text)}

// chunk-zjewzgfh.js pt [2878,2986), UTF-16; sha256 d8f60fd9ee23d335791fd2882be45481c1864be5719f1f920f2220bdca1a04c3
function pt(e){return e.length>=2&&(e[0]==='"'&&e.at(-1)==='"'||e[0]==="'"&&e.at(-1)==="'")?e.slice(1,-1):e}

// chunk-m00pavz3.js D0 [1052,1058), UTF-16; sha256 7ddf33f32b7490744472a8acab3b5aee746014474fab84c2edb92232d6446c88
var D0=1e4;

// chunk-m00pavz3.js SE [4697,4822), UTF-16; sha256 bfd894fc9458f3a3a37e36f91d0f6113326db2c04016f693718f1f962bfa84fc
function SE(e){if(!e||e.length>D0)return[];let t=vS().parse(e);if(!t)return[];let r=nde(t,null);if(!r)return[];return DKe(r)}

// chunk-sfn1dbxq.js i5r [435128,435233), UTF-16; sha256 f5bc38654977e5e60ba4cdf522a2a59b837b488931646665fa452de102665fc6
function i5r(e){if(!e||!e.trim())return[];let n=SE(e);return n.length>0?n:e.split(/\s+/).filter(Boolean)}

// chunk-sfn1dbxq.js zH,rY [435100,435128), UTF-16; sha256 d2ea14751f568e8802cc545a9a94357cf39e2a614071f1020cfa0a4169b24603
var zH="\uFFFF",rY="\uFFFE";

// chunk-ax7r0qj7.js gl [677,739), UTF-16; sha256 6afca7885a6d64046cc2b6c86cedc7bee37203f59d18f398a0f74f34ada81a19
function gl(t){return t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}

// chunk-sfn1dbxq.js uHe [435534,436487), UTF-16; sha256 e915b9b8fee7ea8118d648b59497b21dd9c448fa6b264c53aac1f2bc98ce7ce4
function uHe(e,n,r=!0,s=[],h){if(n===void 0||n===null)return e;e=e.replaceAll(zH,"\uFFFD").replaceAll(rY,"\uFFFD");let y=(V)=>{let X=(V??"").replaceAll(zH,"\uFFFD").replaceAll(rY,"\uFFFD");return rY+(h?h(X):X).replaceAll("$",zH)+rY},b=i5r(n),w=s.map((V,X)=>({name:V,i:X})).filter((V)=>Boolean(V.name)).sort((V,X)=>X.name.length-V.name.length),M=["\\d","ARGUMENTS",...w.map(({name:V})=>`${gl(V)}(?![\\[\\w])`)].join("|");e=e.replace(new RegExp(`(?<!\\\\)\\\\\\$(?=${M})`,"g"),zH);let z=!1;for(let{name:V,i:X}of w)e=e.replace(new RegExp(`\\$${gl(V)}(?![\\[\\w])`,"g"),()=>(z=!0,y(b[X])));if(e=e.replace(/\$ARGUMENTS\[(\d+)\]/g,(V,X)=>{let he=parseInt(X,10);if(b[he]===void 0)return zH+V.slice(1);return z=!0,y(b[he])}),e=e.replace(/\$(\d+)(?!\w)/g,(V,X)=>{let he=parseInt(X,10);if(b[he]===void 0)return V;return z=!0,y(b[he])}),e=e.replaceAll("$ARGUMENTS",()=>(z=!0,y(n))),!z&&r&&n)e=e+`

ARGUMENTS: ${y(n)}`;return e.replaceAll(zH,"$").replaceAll(rY,"")}

export { i5r };

export function expandSourceSkill(body: string, args: string, append: boolean, names: readonly string[]): string {
  return uHe(body, args, append, names, undefined);
}
