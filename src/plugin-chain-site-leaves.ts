// The site leaves (W45-63). The copied bodies live in ./plugin-chain-site-leaves-source.ts; this module
// is the host seam around them. Four more of the site tree's leaf problems — Code, Input, Select and
// Svg — beside the Raster and the Image W45-62 ported, and the predicates and limits they share.
//
// Source, chunk-n3ykh62m.js. The three checks that are not about a leaf's own fields:
//
//   function TAt(e){return e===void 0||e===!0?void 0:"autoFocus is true or absent"}
//
// [233140,233219) 79 units, the hover-scope key:
//
//   function xAt(e){if(!(typeof e==="string"&&e!==""&&e.length<=RAt))return`Box key "${IL(e)}" is not a string of 1 to ${RAt} characters; it is dropped and names no hover scope`;return QT(e)?`Box "${IL(e)}" key holds a control character; it is dropped and names no hover scope`:void 0}
//
// [233330,233611) 281, and the press:
//
//   function wVe(e){return L(e)&&typeof e.plugin==="string"&&e.plugin!==""&&typeof e.handle==="number"&&Number.isInteger(e.handle)?void 0:"is not held by a plugin of this chain"}
//
// [233864,234038) 174. What the leaves are measured against:
//
//   var PAt=1e9;
//
// [236808,236820) 12, and
//
//   var ZAe=(e)=>typeof e==="string"&&e.trim()!=="";var JPn=4096;var uur=(e)=>e===void 0||typeof e==="number"&&Number.isFinite(e)&&e>0&&e<=JPn;
//
// [246992,247131) 139. The leaves themselves:
//
//   function Lto(e){let{props:n,children:r}=e;if(!L(n))return"Code props must be { source }";if(r!==void 0)return"Code takes no children";let{source:s,language:h,path:y,startLine:b,format:w,wrap:R,...T}=n,[P]=Object.keys(T);if(P!==void 0)return`Code prop "${P}" is not allowed`;if(typeof s!=="string")return"Code source must be a string";let M=ace("source",s)??xye("language",h)??xye("path",y);if(M!==void 0)return`Code ${M}`;if(!(b===void 0||typeof b==="number"&&Number.isSafeInteger(b)&&b>=1))return"Code startLine must be a positive integer";if(b!==void 0&&b>PAt)return`Code startLine is at most ${PAt}`;if(w!==void 0&&w!=="source"&&w!=="diff")return'Code format is "source" or "diff"';return R===void 0||R==="wrap"||R==="truncate-end"?void 0:'Code wrap is "wrap" or "truncate-end"'}
//
// [237485,238267) 782, and
//
//   var cur=["label","placeholder","value","submitLabel"];function jto(e){let{props:n,press:r}=e;if(!(L(n)&&Object.keys(n).every((w)=>w==="key"||w==="autoFocus"||cur.some((R)=>R===w)))||typeof n.key!=="string"||n.key==="")return"Input props must be { key } and any of label, placeholder, value, submitLabel, autoFocus";let{key:h}=n,y=cur.map((w)=>ace(w,n[w])).find((w)=>w!==void 0)??TAt(n.autoFocus)??wVe(r);if(y!==void 0)return`Input "${h}" ${y}`;return e.children===void 0?void 0:`Input "${h}" takes no children`}
//
// [246293,246804) 511, and
//
//   var mur=64;function Qto(e,n){if(!(L(e)&&typeof e.value==="string"&&Object.keys(e).every((b)=>b==="value"||b==="label")))return"options are { value: string, label?: string }";let s=e.value,h=n.has(s);n.add(s);let y=h?"is listed twice; values are unique":xye("value",s)??ace("label",e.label);return y===void 0?void 0:`option "${s}" ${y}`}function Zto(e){let{props:n,press:r}=e;if(!(L(n)&&typeof n.key==="string"&&n.key!==""&&QAe(n,["key","label","options","value","autoFocus"])))return"Select props must be { key, options } and any of label, value, autoFocus";let{key:h,options:y}=n,b=Array.isArray(y)&&y.length>0&&y.length<=mur,w=new Set,R=ace("label",n.label)??xye("value",n.value)??(b?y.map((T)=>Qto(T,w)).find((T)=>T!==void 0):`options must be 1 to ${mur} entries`)??TAt(n.autoFocus)??wVe(r)??(e.children===void 0?void 0:"takes no children");return R===void 0?void 0:`Select "${h}" ${R}`}var gur=131072;function eno(e){let{props:n,children:r}=e;if(!L(n))return"Svg props must be { source, alt }";if(r!==void 0)return"Svg takes no children";let{source:s,alt:h,width:y,height:b,isInteractive:w,...R}=n,[T]=Object.keys(R);if(T!==void 0)return`Svg prop "${T}" is not allowed`;if(typeof s!=="string"||s==="")return"Svg source must be a non-empty string";if(s.length>gur)return`Svg source longer than ${gur} characters`;if(typeof h!=="string")return"Svg alt must be a string";if(QT(h))return"Svg alt holds a control character";if(!uur(y)||!uur(b))return`Svg width and height are pixels, at most ${JPn}`;return w===void 0||typeof w==="boolean"?void 0:"Svg isInteractive is a boolean"}
//
// [257601,259180) 1,579.
//
// Where a leaf names the site is the source's own and is not uniform across the six. Code, Input, Select
// and Svg prefix almost every sentence with the site name, and Input and Select carry the key inside it.
// What they do not share is how they find a stray field: Code and Svg destructure their known props and
// name the leftover, the Raster goes through a picker and answers one sentence, and the Input sweeps its
// own key list with an `every` and never names a field at all. The Input is also the one leaf whose
// children sentence is checked *after* its fields, so a child is reported only once the props are sound.
import type { LeafInput, LeafProblem, PressableLeafInput } from './plugin-chain-registry-state.js';
import {
  cur, eno, gur, JPn, jto, Lto, mur, PAt, Qto, TAt, uur, wVe, xAt, ZAe, Zto,
} from './plugin-chain-site-leaves-source.js';

/** The line a Code block may start at (`PAt`). */
export const CODE_MAX_START_LINE = PAt;
/** The pixel bound one Svg side is measured against (`JPn`), and how long its source may be (`gur`). */
export const SVG_PIXEL_LIMIT = JPn;
export const SVG_SOURCE_LIMIT = gur;
/** How many options a Select may hold (`mur`). */
export const SELECT_MAX_OPTIONS = mur;
/** The four fields an Input admits beside `key` and `autoFocus` (`cur`). */
export const INPUT_FIELDS: readonly string[] = cur;

/** Source `TAt`: autoFocus absent or exactly `true`, and anything else answers the sentence. */
export function checkAutoFocus(autoFocus: unknown): LeafProblem {
  return (TAt as (autoFocus: unknown) => LeafProblem)(autoFocus);
}

/** Source `xAt`: the hover-scope key check, whose refusals say the key is dropped rather than merely
 *  wrong — a scope is optional, so a bad one is discarded and not fatal. */
export function checkHoverKey(key: unknown): LeafProblem {
  return (xAt as (key: unknown) => LeafProblem)(key);
}

/** Source `wVe`: whether the press is held by a plugin of this chain, which needs a plugin name and a
 *  whole-number handle. */
export function checkPress(press: unknown): LeafProblem {
  return (wVe as (press: unknown) => LeafProblem)(press);
}

/** Source `ZAe`: a string that is not blank once trimmed. */
export function isNonBlankString(value: unknown): boolean {
  return (ZAe as (value: unknown) => boolean)(value);
}

/** Source `uur`: an absent side, or a finite positive number of pixels within `SVG_PIXEL_LIMIT`. */
export function isPixelSide(value: unknown): boolean {
  return (uur as (value: unknown) => boolean)(value);
}

/** Source `Qto`: one option checked against the Set the caller threads through, so a repeated value is
 *  caught on the second sighting. The sentence is `option "<value>" <problem>`. */
export function optionProblem(option: unknown, seen: Set<string>): LeafProblem {
  return (Qto as (option: unknown, seen: Set<string>) => LeafProblem)(option, seen);
}

/** Source `Lto`: the sentence a Code site is refused with, or nothing when it is admitted. */
export function codeLeafProblem(leaf: LeafInput): LeafProblem {
  return (Lto as (leaf: LeafInput) => LeafProblem)(leaf);
}

/** Source `jto`: the sentence an Input site is refused with, or nothing when it is admitted. */
export function inputLeafProblem(leaf: PressableLeafInput): LeafProblem {
  return (jto as (leaf: PressableLeafInput) => LeafProblem)(leaf);
}

/** Source `Zto`: the sentence a Select site is refused with, or nothing when it is admitted. */
export function selectLeafProblem(leaf: PressableLeafInput): LeafProblem {
  return (Zto as (leaf: PressableLeafInput) => LeafProblem)(leaf);
}

/** Source `eno`: the sentence an Svg site is refused with, or nothing when it is admitted. */
export function svgLeafProblem(leaf: LeafInput): LeafProblem {
  return (eno as (leaf: LeafInput) => LeafProblem)(leaf);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  leaves with the text. The seam's own names above are the ones a site check calls. */
export { cur, eno, gur, JPn, jto, Lto, mur, PAt, Qto, TAt, uur, wVe, xAt, ZAe, Zto };
