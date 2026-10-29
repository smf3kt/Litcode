// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { vS } from "./bash-parser-source.js";
import { E6 } from "./shell-analyser-source.js";
import { Un } from "./permission-rule-source.js";
import { xX } from "./shell-rule-matcher-source.js";
const i = () => {};
const ki = { name: "Bash" };
// chunk-3qabb19b.js D [883,919), UTF-16; sha256 e08913e4ba564b11551e01e87af4d4ba5f0fde1d9cce2dc2407afcc87d3df2bb
function D(n){return[...new Set(n)]}
// chunk-zjewzgfh.js $e [822,828), UTF-16; sha256 b536a7ee7363b600db68371fc249aa3b5e49e16fd7f466c17d0b4fff476ca396
var $e=1e4;
// chunk-zjewzgfh.js Yx [1273,1299), UTF-16; sha256 5cbd3cde29ae7f4c8596970b333a5f4be4f3486d4b825c7643c4a2c3bed574f2
var Yx=Symbol("parse-aborted");
// chunk-zjewzgfh.js w6 [1300,1631), UTF-16; sha256 ea6db9ea71d7575b3c49e8da8c83b06e3fbfead22e74b3148cd8c875ca8a585c
async function w6(e){if(!e)return null;if(e.length>$e)return i("tengu_tree_sitter_parse_abort",{cmdLength:e.length,panic:!1}),Yx;try{let t=vS().parse(e);if(t===null)return i("tengu_tree_sitter_parse_abort",{cmdLength:e.length,panic:!1}),Yx;return t}catch{return i("tengu_tree_sitter_parse_abort",{cmdLength:e.length,panic:!0}),Yx}}
// chunk-m00pavz3.js m [967,1007), UTF-16; sha256 be22ac1da36bddc48d37bece138ab4894d56a9d4139439f8c16af0ab5d893ef5
var m=new Set(["program","list","pipeline"]);
// chunk-m00pavz3.js E [1008,1051), UTF-16; sha256 d0d85c14f84c4d3f58f03c4cbdaef5e80cb0830bdf919979c50cee3a9520d4ba
var E=new Set(["&&","||","|",";","&","|&",`
`]);
// chunk-m00pavz3.js D0 [1052,1058), UTF-16; sha256 7ddf33f32b7490744472a8acab3b5aee746014474fab84c2edb92232d6446c88
var D0=1e4;
// chunk-m00pavz3.js x8t [2427,2524), UTF-16; sha256 39cc552a0ee46a2e6520bea0350ef2c728fbe662b9a98adb98c6f6cbc86f977b
function x8t(e){if(!e||e.length>D0)return null;let t=vS().parse(e);if(!t)return null;return W(t)}
// chunk-m00pavz3.js W [3826,4317), UTF-16; sha256 f4debd18a3ffdb139d5624ab85cc7c327c1906b7324494c4ae6faad6659d0725
function W(e){let t=[],r=!0,s=(i)=>{if(!r)return;if(E.has(i.type)||i.type==="comment")return;if(i.type==="redirected_statement"){for(let n of i.children){if(n.type.endsWith("_redirect")){if(R(n)){r=!1;return}continue}s(n)}return}if(m.has(i.type)){for(let n of i.children)s(n);return}if(i.type==="negated_command"){for(let n of i.children)if(n.type!=="!")s(n);return}if(i.type==="command"||i.type==="variable_assignment"){if(R(i)){r=!1;return}t.push(i.text);return}r=!1};return s(e),r?t:null}
// chunk-m00pavz3.js R [4317,4474), UTF-16; sha256 d1c2dc5e9510acdd86027d026dc019a6b71fbc7e0ea5a8e10b295bbc5d6a2e92
function R(e){let t=e.type==="command"||e.type==="variable_assignment";for(let r of e.children){if(r.type==="subshell"&&t)return!0;if(R(r))return!0}return!1}
// chunk-sfn1dbxq.js fTr [3207522,3208297), UTF-16; sha256 0225c17047b751f2a8de8c11eda3a1c86fe72973bd2e4d83fc7364c8ca3ecd17
async function fTr(e,n){if(n.length===0)return null;let r={span:e.command.trim(),group:n[0]??[],kind:"unverifiable"},s=await w6(e.command);if(s===Yx)return r;let h=s?E6(e.command,s):{kind:"simple",commands:[],bareAssignmentNames:[]};if(h.kind==="too-complex")return r;let y=x8t(e.command);if(y===null||y.length===0)return r;let b=D([...y,...h.commands.map((w)=>w.text)]);for(let w of n){let M=new Map;for(let z of w){let V=Un(z);if(V.toolName!==ki.name||V.ruleContent===void 0||V.ruleContent==="")continue;M.set(V.ruleContent,{source:"session",ruleBehavior:"allow",ruleValue:V})}for(let z of b){let V={...e,command:z};if(!(xX(V,M,"exact",{ruleBehavior:"allow"}).length>0||xX(V,M,"prefix",{ruleBehavior:"allow"}).length>0))return{span:z,group:w,kind:"unmatched"}}}return null}
export { fTr, w6, Yx };
