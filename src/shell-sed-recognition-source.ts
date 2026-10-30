// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { vS } from "./bash-parser-source.js";
import { yit, lyr, cyr, dyr, GRt, zRt, mLn, gLn, uyr } from "./shell-analyser-source.js";
import { nde, y, SE } from "./shell-rule-matcher-source.js";
export function createShellSedRecognition(PA, O) {
// chunk-m00pavz3.js R8t [758,801), UTF-16; sha256 f475c5c1b7cb27a6ca933f3a88786289dfa5b906cc230f92b6985007de158fc1
function R8t(e){return cyr.test(e)||CHn(e)}
// chunk-m00pavz3.js CHn [801,901), UTF-16; sha256 5b3ff00f1fe74e8c03e632793fc6c470c7a7289106d4721817510f7724fd6487
function CHn(e){return yit.test(e)||lyr.test(e)||dyr.test(e)||mLn.test(e)||gLn.test(e)||uyr.test(e)}
// chunk-m00pavz3.js Nqe [901,963), UTF-16; sha256 3c5ec1a3bac36086744b6dba89619db14fdbe5c59d95255f15295f16ad6f4d52
function Nqe(e){return e.type==="ERROR"||e.children.some(Nqe)}
// chunk-m00pavz3.js D0 [1052,1058), UTF-16; sha256 7ddf33f32b7490744472a8acab3b5aee746014474fab84c2edb92232d6446c88
var D0=1e4;
// chunk-m00pavz3.js x [4826,4938), UTF-16; sha256 412c4951a36bcc16180430fc406370f780f93b9ef689e4a319efdc44cff8042c
var x=new Set(["command_substitution","process_substitution","expansion","simple_expansion","arithmetic_expansion"]);
// chunk-m00pavz3.js S [4939,5005), UTF-16; sha256 d9c7373f4256e4f13c7ecf4052fa7b004308c39db915e064caaf1fea6bb73667
function S(e){if(x.has(e.type))return!0;return e.children.some(S)}
// chunk-m00pavz3.js z [5172,5220), UTF-16; sha256 904d22f80e3139c59597528ebbcda3a7026083254a5622051232eafcc2f334a9
var z=new Set(["ansi_c_string","translated_string"]);
// chunk-m00pavz3.js N [5221,5287), UTF-16; sha256 56bc21d815608d03fcb29b9376e996d5c5fd3ecdac01da08a68486c2736e2f69
function N(e){if(z.has(e.type))return!0;return e.children.some(N)}
// chunk-m00pavz3.js v [5291,5452), UTF-16; sha256 f6437745c6ec5e57172baebbb70dadb666d41245a6432588ccde05b70ec952b8
var v=new Set(["<",">",">>","<<","<<-","<<<","<&",">&","&>","&>>",">|",">&-","<&-","file_descriptor","heredoc_start","heredoc_body","heredoc_content","heredoc_end"]);
// chunk-m00pavz3.js A [5453,5781), UTF-16; sha256 8278c7b9ee16d83d7f2a66fbda1c361a014f3bf7d0589536d6b90edf8a20b7d9
function A(e){if(e.type.endsWith("_redirect")){let t=e.children.filter((n)=>!v.has(n.type)),r=e.children.some((n)=>n.type===">&-"||n.type==="<&-"),s=!r&&e.children.some((n)=>n.type===">&"||n.type==="<&")&&t.some((n)=>y(n).startsWith("-")),i=e.type==="heredoc_redirect"||r||s?0:1;if(t.length>i)return!0}return e.children.some(A)}
// chunk-m00pavz3.js b [5781,6035), UTF-16; sha256 35ada3d21359a138d18f8b2c0bd97c5027a288c51514b9e305aeaac7e0b89563
function b(e){if(e.type==="heredoc_redirect"){let r=e.children.find((i)=>i.type==="heredoc_start")?.text??"";if(!(r.length>=2&&(r.startsWith("'")&&r.endsWith("'")||r.startsWith('"')&&r.endsWith('"')))||r.includes("\\"))return!0}return e.children.some(b)}
// chunk-m00pavz3.js K [7048,7098), UTF-16; sha256 93ba30a7c4ecdd408415cb37aaba98dd8782fcd1576e4588a61033a635ad2b5d
var K=new Set(["word","string","raw_string","number"]);
// chunk-m00pavz3.js Q [7099,7130), UTF-16; sha256 d1ed8171864b1deb3b1d725d87e8ea95488739e025cbaaf3afa0c2a69abe6c8b
var Q=/(?:^|[^\\])(?:\\\\)*[;|&<>]/;
// chunk-m00pavz3.js j [7131,7158), UTF-16; sha256 ca55887830c8e60e9f3d39cb087b510a7b53b2ee260e057f42ae7b1d58e1e3eb
var j=/(?:^|[^\\])(?:\\\\)*\\$/;
// chunk-m00pavz3.js w [7159,7544), UTF-16; sha256 7e023f4dbfb2aa86975d6b4f15feffff0df00c694d7eb0a407f1a4308123ad88
function w(e,t=!1){if(e.type==="concatenation")return e.children.every((r)=>w(r,t));if(e.type==="word"){if(GRt.test(e.text))return!1;if(Q.test(e.text)||j.test(e.text))return!1;if(t&&zRt.test(e.text))return!1;return!0}if(e.type==="string"||e.type==="raw_string"){let r=e.type==="raw_string"?"'":'"';return e.text.length>=2&&e.text.startsWith(r)&&e.text.endsWith(r)}return K.has(e.type)}
// chunk-m00pavz3.js L [7544,8291), UTF-16; sha256 2acccb7d50d726f775952c873c18bf2d5d0ca3f74792a4aea0a45ebee822f5a4
function L(e){let t=null,r=!1,s=!1;for(let i=0;i<e.length;i++){let n=e[i];if(t==="'"){if(n==="'")t=null;continue}if(t==='"'){if(n==="\\"&&i+1<e.length&&'$`"\\'.includes(e[i+1])){i++;continue}if(n==="`")return!0;if(n==="$"&&/[A-Za-z0-9_{(@*#?$!-]/.test(e[i+1]??""))return!0;if(n==='"')t=null;continue}if(n==="\\"){i++;continue}if(n==="`")return!0;if(n==="$"&&(e[i+1]==="'"||e[i+1]==='"'))return!0;if(n==="$"&&/[A-Za-z0-9_{(@*#?$!-]/.test(e[i+1]??""))return!0;if(n==="="&&e[i+1]==="(")return!0;if(n==="*"||n==="?"||n==="[")return!0;if(n==="'"||n==='"'){t=n;continue}if(n===`
`)return!1;if(n===" "||n==="\t"){r=!1,s=!1;continue}if(n==="{"){r=!0;continue}if(r&&(n===","||n==="."&&e[i+1]===".")){s=!0;continue}if(n==="}"&&r&&s)return!0}return t!==null}
// chunk-m00pavz3.js THn [8291,8842), UTF-16; sha256 d0d13983c2fcbca6be571b4294b84f62214c57fa8f39937d931104b43020a96b
function THn(e){if(!e||e.length>D0)return!0;if(R8t(e))return!0;if(L(e))return!0;let t=vS().parse(e);if(!t||Nqe(t))return!0;let r=t.children.filter((i)=>i.type!=="comment");if(r.length!==1||r[0].type!=="command"&&!(r[0].type==="redirected_statement"&&r[0].children.some((i)=>i.type==="command")))return!0;if(S(t)||N(t)||A(t)||b(t))return!0;let s=nde(t,null);if(!s)return!0;for(let i of s.children){if(i.type==="command_name"||i.type==="variable_assignment")continue;if(i.type.endsWith("_redirect"))continue;if(!w(i,/\s/.test(i.text)))return!0}return!1}
// chunk-sfn1dbxq.js tzr [4319170,4319253), UTF-16; sha256 68c6e4525a01b216d2657c50f5d5c311efc658a79094bf9c8015d57183259920
var tzr=new Set(["command_name","word","string","raw_string","number","concatenation"]);
// chunk-sfn1dbxq.js KMe [4319525,4321079), UTF-16; sha256 579573fab3b51702646b3bafde55c9a5ec95ea72ebde530194e90b90e6ffcd2e
function KMe(e){let n=e.trim();if(THn(n))return null;let s=vS()?.parse(n)?.children.filter(($e)=>$e.type!=="comment")??[];if(s.length!==1||s[0].type!=="command"||s[0].children.some(($e)=>!tzr.has($e.type)))return null;let h=SE(n);if(h[0]!=="sed")return null;let y=h.slice(1),b=!1,w=!1,M=null,z=null,V=0;while(V<y.length){let $e=y[V];if($e==="-i"||$e==="--in-place"){if(b=!0,V++,V<y.length){let Ve=y[V];if(typeof Ve==="string"&&!Ve.startsWith("-")&&(Ve===""||Ve.startsWith(".")))V++}continue}if($e.startsWith("-i")){b=!0,V++;continue}if($e==="-E"||$e==="-r"||$e==="--regexp-extended"){w=!0,V++;continue}if($e==="-e"||$e==="--expression"){if(V+1<y.length&&typeof y[V+1]==="string"){if(M!==null)return null;M=y[V+1],V+=2;continue}return null}if($e.startsWith("--expression=")){if(M!==null)return null;M=$e.slice(13),V++;continue}if($e.startsWith("-"))return null;if(M===null)M=$e;else if(z===null)z=$e;else return null;V++}if(!b||!M||!z)return null;if(PA(z,!0)||O()==="windows"&&/(?<!:)[\\/]{2,}[^ \t\r\n\f\v\\/]/.test(z))return null;if(!M.match(/^s\//))return null;let he=M.slice(2),_e={pattern:"",replacement:"",flags:""},ke="pattern",Se=0;while(Se<he.length){let $e=he[Se];if($e==="\\"&&Se+1<he.length){_e[ke]+=$e+he[Se+1],Se+=2;continue}if($e==="/"){if(ke==="pattern")ke="replacement";else if(ke==="replacement")ke="flags";else return null;Se++;continue}_e[ke]+=$e,Se++}if(ke!=="flags")return null;let{pattern:Re,replacement:Ae,flags:Pe}=_e;if(!/^[gpimIM1-9]*$/.test(Pe))return null;return{filePath:z,pattern:Re,replacement:Ae,flags:Pe,extendedRegex:w}}
return { KMe, THn };
}
