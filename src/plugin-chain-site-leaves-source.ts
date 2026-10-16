// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The site leaves (W45-63): the four leaf problems whose checks need nothing but what this product
// already carries — Code, Input, Select with its option check, and Svg — and the predicates and
// limits they share.
//
// Eight blocks, 3,557 units, 15 statements of chunk-n3ykh62m.js. The predicates are the W45-62
// leaf-problem copy's (`IL`, `RAt`, `QAe`, `ace`, `xye`), the control pattern is the W45-58 blit
// copy's `QT`, and `L` and the plan's four leaves are the chain-runner copy's. Three leaves of the
// same table are deliberately not here: they drag the path boundary or the error formatter in with
// them, and are recorded as the next package rather than half-carried.
import { L } from './plugin-chain-source.js';
import { QT } from './plugin-chain-ui-blit-source.js';
import { ace, IL, QAe, RAt, xye } from './plugin-chain-raster-sites-source.js';

// chunk-n3ykh62m.js `TAt`, the autoFocus check three leaves run: absent or exactly `true`, and anything else answers the sentence [233140,233219) 79 units sha256 9dfa3394aa99d2d4a11560670bd50550ca8bf8ac8deed7fb3fc2e70a872e0cc6
function TAt(e){return e===void 0||e===!0?void 0:"autoFocus is true or absent"}

// chunk-n3ykh62m.js `xAt`, the hover-scope key check: a non-empty string of at most `RAt`, without a control character, and each refusal says what happens instead — the key is dropped and names no scope [233330,233611) 281 units sha256 917b3618abeae2e66d493c83ac533c6edf4f38fe1cff532a7e91cd6167b8a456
function xAt(e){if(!(typeof e==="string"&&e!==""&&e.length<=RAt))return`Box key "${IL(e)}" is not a string of 1 to ${RAt} characters; it is dropped and names no hover scope`;return QT(e)?`Box "${IL(e)}" key holds a control character; it is dropped and names no hover scope`:void 0}

// chunk-n3ykh62m.js `wVe`, the press check: the leaf must be held by a plugin of this chain, which for a press means a plugin name and a whole-number handle [233864,234038) 174 units sha256 9e28b44c3b146c3fae5f1fc9bd3edd7657630d28beddcd974bdb51bed418ab28
function wVe(e){return L(e)&&typeof e.plugin==="string"&&e.plugin!==""&&typeof e.handle==="number"&&Number.isInteger(e.handle)?void 0:"is not held by a plugin of this chain"}

// chunk-n3ykh62m.js `PAt` (1e9), the line a Code block may start at [236808,236820) 12 units sha256 cff3a94e29e83d45c83903aaccc3a61f87ca68009e14ae4ce6be742bbc5ab428
var PAt=1e9;

// chunk-n3ykh62m.js `Lto`, the Code leaf problem: props are `{ source }` and any of language, path, startLine, format, wrap, with no other key and no children; source by `ace`, language and path by `xye`, then startLine as a positive safe integer within `PAt`, format one of source or diff, and wrap one of wrap or truncate-end — every sentence prefixed with `Code` [237485,238267) 782 units sha256 d4a6a78f2b7b5cae66ac4cda83c2121f5813e1f8185faaca5cf0508e30fd9cf7
function Lto(e){let{props:n,children:r}=e;if(!L(n))return"Code props must be { source }";if(r!==void 0)return"Code takes no children";let{source:s,language:h,path:y,startLine:b,format:w,wrap:R,...T}=n,[P]=Object.keys(T);if(P!==void 0)return`Code prop "${P}" is not allowed`;if(typeof s!=="string")return"Code source must be a string";let M=ace("source",s)??xye("language",h)??xye("path",y);if(M!==void 0)return`Code ${M}`;if(!(b===void 0||typeof b==="number"&&Number.isSafeInteger(b)&&b>=1))return"Code startLine must be a positive integer";if(b!==void 0&&b>PAt)return`Code startLine is at most ${PAt}`;if(w!==void 0&&w!=="source"&&w!=="diff")return'Code format is "source" or "diff"';return R===void 0||R==="wrap"||R==="truncate-end"?void 0:'Code wrap is "wrap" or "truncate-end"'}

// chunk-n3ykh62m.js `cur`, the four fields an Input admits beside `key` and `autoFocus`, and `jto`, the Input leaf problem: the props are checked by an every-key sweep rather than a picker, then the four fields in list order, then autoFocus, then the press — and children last, so `Input "<key>" takes no children` is the one sentence with no field name in it [246293,246804) 511 units sha256 2ea7f957b7379a18185ca81fb54ea35fb27848dea1e0c7e9afb87e3dc4f2b2a6
var cur=["label","placeholder","value","submitLabel"];function jto(e){let{props:n,press:r}=e;if(!(L(n)&&Object.keys(n).every((w)=>w==="key"||w==="autoFocus"||cur.some((R)=>R===w)))||typeof n.key!=="string"||n.key==="")return"Input props must be { key } and any of label, placeholder, value, submitLabel, autoFocus";let{key:h}=n,y=cur.map((w)=>ace(w,n[w])).find((w)=>w!==void 0)??TAt(n.autoFocus)??wVe(r);if(y!==void 0)return`Input "${h}" ${y}`;return e.children===void 0?void 0:`Input "${h}" takes no children`}

// chunk-n3ykh62m.js the checks an Input and a Select share: `ZAe`, a string that is not blank once trimmed, `JPn` (4096), the pixel bound an Svg side is measured against, and `uur`, which admits an absent side and otherwise a finite positive number within `JPn` [246992,247131) 139 units sha256 777848f9b6edd252843c56f1f744c66da99ee6826b55e7dfb47d2dc20995ebf9
var ZAe=(e)=>typeof e==="string"&&e.trim()!=="";var JPn=4096;var uur=(e)=>e===void 0||typeof e==="number"&&Number.isFinite(e)&&e>0&&e<=JPn;

// chunk-n3ykh62m.js the Select and the Svg: `mur` (64), how many options a Select may hold; `Qto`, the option check — `{ value, label? }` and nothing else, a value that is a string and unique within the Set the caller threads through, a label by `ace` — whose sentence is `option "<value>" <problem>`; `Zto`, the Select leaf problem, which checks the key list, the label, the value, then the options through `Qto`, then autoFocus, the press and finally children; `gur` (131072), how long an Svg source may be; and `eno`, the Svg leaf problem — source, alt, width and height, with the size pair checked together against `JPn` and `isInteractive` last [257601,259180) 1579 units sha256 35411a1a8f53f618394623c9135c7f0b9e89f518d8f891fcdce86666b995c289
var mur=64;function Qto(e,n){if(!(L(e)&&typeof e.value==="string"&&Object.keys(e).every((b)=>b==="value"||b==="label")))return"options are { value: string, label?: string }";let s=e.value,h=n.has(s);n.add(s);let y=h?"is listed twice; values are unique":xye("value",s)??ace("label",e.label);return y===void 0?void 0:`option "${s}" ${y}`}function Zto(e){let{props:n,press:r}=e;if(!(L(n)&&typeof n.key==="string"&&n.key!==""&&QAe(n,["key","label","options","value","autoFocus"])))return"Select props must be { key, options } and any of label, value, autoFocus";let{key:h,options:y}=n,b=Array.isArray(y)&&y.length>0&&y.length<=mur,w=new Set,R=ace("label",n.label)??xye("value",n.value)??(b?y.map((T)=>Qto(T,w)).find((T)=>T!==void 0):`options must be 1 to ${mur} entries`)??TAt(n.autoFocus)??wVe(r)??(e.children===void 0?void 0:"takes no children");return R===void 0?void 0:`Select "${h}" ${R}`}var gur=131072;function eno(e){let{props:n,children:r}=e;if(!L(n))return"Svg props must be { source, alt }";if(r!==void 0)return"Svg takes no children";let{source:s,alt:h,width:y,height:b,isInteractive:w,...R}=n,[T]=Object.keys(R);if(T!==void 0)return`Svg prop "${T}" is not allowed`;if(typeof s!=="string"||s==="")return"Svg source must be a non-empty string";if(s.length>gur)return`Svg source longer than ${gur} characters`;if(typeof h!=="string")return"Svg alt must be a string";if(QT(h))return"Svg alt holds a control character";if(!uur(y)||!uur(b))return`Svg width and height are pixels, at most ${JPn}`;return w===void 0||typeof w==="boolean"?void 0:"Svg isInteractive is a boolean"}


export { TAt, xAt, wVe, PAt, Lto, cur, jto, ZAe, JPn, uur, mur, Qto, Zto, gur, eno };
