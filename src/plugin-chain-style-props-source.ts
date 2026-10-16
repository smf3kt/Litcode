// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The style-prop validators and the value describer (W45-64): what a plugin's props are checked by
// (`sQt` and the prop-name sets beside it) and how a value that failed is described in the sentence.
//
// Seventeen blocks, 3,794 units, 24 statements of chunk-nyce03br.js. Two names are imported rather
// than copied: `He`, the error a list length is refused with, and `PFs`, the border prop names — both
// already carried, by the chain-runner copy and the W44 tui border copy. Two statements of the same
// module sit inside this package's span and are referenced by nothing in it (`Ago` and `B3e`), so the
// spans are split around them rather than carrying them for free.
import { He } from './plugin-chain-source.js';
import { PFs } from './tui-border.js';

// chunk-nyce03br.js `Ubr`, the text-style prop names (dimColor, bold, italic, underline, strikethrough, inverse, borderDimColor). `Ago` (2) sits between this and the next block and is referenced by nothing here, so the run is split rather than taken whole. [2097,2198) 101 units sha256 6d7c18b0bdbb874beab776c3caede62dfa1a5e654a0fe1d17f9a25b058db0673
var Ubr=new Set(["dimColor","bold","italic","underline","strikethrough","inverse","borderDimColor"]);

// chunk-nyce03br.js `rQt`, the border prop names (`new Set(PFs)` — the border table the W44 tui copy already carries) and `Cgo`, the colour ones (color, backgroundColor, borderColor) [2208,2288) 80 units sha256 6147e1146a5ce27a7badc2b42a5bc76f19d3f6da610becd5dbc6b4b603bdc5a3
var rQt=new Set(PFs);var Cgo=new Set(["color","backgroundColor","borderColor"]);

// chunk-nyce03br.js `Rgo`, the flex and spacing prop names, and `olt`, the four sides [2523,2815) 292 units sha256 3ff3653232086cf599c8e79a584f9a381df8f5744805f08b1b6ad426d6a5ecd1
var Rgo=new Set(["flexGrow","flexShrink","gap","columnGap","rowGap","margin","marginX","marginY","marginTop","marginBottom","marginLeft","marginRight","padding","paddingX","paddingY","paddingTop","paddingBottom","paddingLeft","paddingRight"]);var olt=new Set(["top","left","right","bottom"]);

// chunk-nyce03br.js `xgo`, the per-prop validator table `sQt` looks a name up in — the largest single body of this package [2815,3407) 592 units sha256 1f9306940d8f4c087a2b5881cc060e31f9e3406b439b09831a7af1f4dd598b70
var xgo={flexDirection:new Set(["row","column","row-reverse","column-reverse"]),flexWrap:new Set(["nowrap","wrap","wrap-reverse"]),alignItems:new Set(["flex-start","center","flex-end","stretch"]),alignSelf:new Set(["flex-start","center","flex-end","auto"]),justifyContent:new Set(["flex-start","center","flex-end","space-between","space-around","space-evenly"]),overflow:new Set(["visible","hidden"]),display:new Set(["flex","none"]),position:new Set(["relative","absolute"]),wrap:new Set(["wrap","end","middle","truncate-end","truncate","truncate-middle","truncate-start"]),borderStyle:rQt};

// chunk-nyce03br.js `slt` (10000), the tolerance a number is compared with, and `oQt`, the size prop names (width, height, minWidth, minHeight) [4004,4075) 71 units sha256 d6a8aedd8810f28950cc1ecad491cefbdfe78aa491903272ebfaac55ae83a268
var slt=1e4;var oQt=new Set(["width","height","minWidth","minHeight"]);

// chunk-nyce03br.js `sQt`, the prop validator: a name looked up in `xgo`, whose answer is either a sentence or a predicate that is run against the value — the table holds both, which is why the name is checked before the value [4140,4987) 847 units sha256 c9451f390d607e159e066206a0081fe9166ae1b667ff5ab281d87346767e3c95
function sQt(e,t){let o=xgo[e];if(o!==void 0)return typeof t==="string"&&o.has(t)?void 0:`must be one of ${[...o].join(", ")}`;if(oQt.has(e)){if(typeof t==="number")return Number.isFinite(t)&&t>=0&&t<=slt?void 0:`must be a finite number between 0 and ${slt}`;return typeof t==="string"&&/^\d{1,3}%$/.test(t)?void 0:"must be a number or a percentage"}if(Rgo.has(e))return typeof t==="number"&&Number.isFinite(t)&&Math.abs(t)<=slt?void 0:`must be a finite number within ${slt}`;if(olt.has(e))return typeof t==="number"&&Number.isInteger(t)&&Math.abs(t)<=slt?void 0:`must be an integer within ${slt} (character cells)`;if(Cgo.has(e))return typeof t==="string"&&/^[#a-zA-Z0-9_().,% -]{1,40}$/.test(t)?void 0:"must be a color (a theme key, a name, or hex)";if(Ubr.has(e))return typeof t==="boolean"?void 0:"must be a boolean";return"has no value rule"}

// chunk-nyce03br.js `Ybr` (1e5), how many characters a described value may serialize to. `B3e` ("AskUserQuestion") sits between this and the next block and is referenced by nothing here. [5978,5990) 12 units sha256 e0cf534fdee318de846b984e84bdcf62c13b9c2115b599c641f583caf6e3f493
var Ybr=1e5;

// chunk-nyce03br.js `ESe` (32), how deep the describer walks, and `AFe` (20000), how many values it may visit [6016,6041) 25 units sha256 694367aa93c3e79af2a62de2770810412f1a22be9ee0ea503fc87d7992316302
var ESe=32;var AFe=20000;

// chunk-nyce03br.js `cN`, the short description of a value — null, an array, an object, or `a <typeof>` — which is the sentence a leaf drops into its own when a prop had the wrong shape [6041,6172) 131 units sha256 d267c6da2b1c8d2f174218cf44d26b77973822e43b5cc76ce1b5a26dd8ebff25
function cN(e){if(e===null)return"null";let t=typeof e==="object";return Array.isArray(e)?"an array":t?"an object":`a ${typeof e}`}

// chunk-nyce03br.js `Vs`, the largest length a plugin's list may claim [6340,6358) 18 units sha256 d431d6dce13da18ff3c639d4be4ff4cf1a8a69ac6c614d1716da1912e22d46e5
var Vs=4294967295;

// chunk-nyce03br.js `B`, the list length a plugin declares, which throws `He` rather than answering when the claim is not a length any list has — the one body here that refuses instead of describing [6358,6591) 233 units sha256 40ad04b21693ce422b7dcd93dcf5be7cc2f82f29a53bd7da03abd35e7af6a674
function B(e){let t=e.length,r=typeof t!=="bigint"&&typeof t!=="symbol"?Math.max(Math.trunc(Number(t))||0,0):void 0;if(r===void 0||r>Vs)throw new He(`a plugin's list claims a length no list has (got ${r??`a ${typeof t}`})`);return r}

// chunk-nyce03br.js `fa`, the generator the describer walks with: an array yields each element under the key length one, an object yields its own keys at their own length plus four (`"key":` and the comma) [87341,87483) 142 units sha256 2a9d68c8f2cefe8e7a26e5dff793d1b31722987cd64c527e3355116726f2bb63
function*fa(e){if(Array.isArray(e)){let t=B(e);for(let o=0;o<t;o+=1)yield[1,e[o]];return}for(let[t,o]of Object.entries(e))yield[t.length+4,o]}

// chunk-nyce03br.js the budget and its three bounds: `F$n` (1e5 characters), `Xbr` (32 deep), `Jbr` (20000 values), and `Ro`, a fresh walk budget — a path Set for cycles and a done Map for values already seen [87483,87576) 93 units sha256 6617c850dd35fef358f55af06eadcd9723b193faec252ee85534d18195a739e2
var F$n=Ybr;var Xbr=ESe;var Jbr=AFe;var Ro=()=>({nodes:0,chars:0,path:new Set,done:new Map});

// chunk-nyce03br.js `ca`, the budget check: more than 20000 values answers `holds more than 20000 values`, more than 1e5 characters answers `serializes to more than 100000 characters`, and otherwise nothing [87576,87714) 138 units sha256 f360377fbe814caa935e8b6e8a24289895a6827a044fca79c7d7358bf7f58311
function ca(e){if(e.nodes>Jbr)return`holds more than ${Jbr} values`;return e.chars>F$n?`serializes to more than ${F$n} characters`:void 0}

// chunk-nyce03br.js `un`, what a scalar costs the budget: a boolean is 5 (`false`), a string its length plus two quotes, a number the length of its text, and null 5 — anything else answers nothing and is walked instead [87714,87871) 157 units sha256 5900f5b358dc03d554a601d7abd311b4cfbc36837ac4221e903ff215a3cff5a8
function un(e){switch(typeof e){case"boolean":return 5;case"string":return e.length+2;case"number":return String(e).length;default:return e===null?5:void 0}}

// chunk-nyce03br.js `Dt`, the describer itself: it walks the value against the budget, spending `un` on scalars and recursing through `fa`, tracking the path to cut a cycle and the done Map to cut a repeat, and answers either the serialized text or the budget sentence [87871,88707) 836 units sha256 d8035f090ec09aeea2d807167617f22ad22d05634f2254346931a9e6885fcf2a
function Dt(e,t,o){if(t>Xbr)return`nests deeper than ${Xbr}`;let r=typeof e==="object"?o.done.get(e):void 0;o.nodes+=r?.nodes??1,o.chars+=r?.chars??un(e)??2;let n=ca(o);if(n!==void 0||r!==void 0)return n;if(typeof e==="number"&&!Number.isFinite(e))return`holds ${String(e)}`;if(un(e)!==void 0)return;if(e===void 0)return"holds undefined (an array hole, a missing value)";if(typeof e!=="object"||e===null)return`holds ${cN(e)}`;if(o.path.has(e))return"holds a cycle";let s=Object.getPrototypeOf(e);if(!(Array.isArray(e)||s===null||Object.getPrototypeOf(s)===null))return"holds an object that is not plain (a class instance)";let p={nodes:o.nodes-1,chars:o.chars-2};o.path.add(e);for(let[a,f]of fa(e)){o.chars+=a;let m=Dt(f,t+1,o);if(m!==void 0)return m}o.path.delete(e),o.done.set(e,{nodes:o.nodes-p.nodes,chars:o.chars-p.chars});return}

// chunk-nyce03br.js `cQt`, the describer at its entry: `Dt(value, 0, Ro())` — depth zero and a fresh budget [88772,88798) 26 units sha256 da0dcc3366c26c08854fcbe0d928374a9d01313aaf757954881c159c9789934f
var cQt=(e)=>Dt(e,0,Ro());


export { Ubr, rQt, Cgo, Rgo, olt, xgo, slt, oQt, sQt, Ybr, ESe, AFe, cN, Vs, B, fa, F$n, Xbr, Jbr, Ro, ca, un, Dt, cQt };
