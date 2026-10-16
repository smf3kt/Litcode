// The raster leaf problems (W45-62). The copied bodies live in ./plugin-chain-raster-sites-source.ts;
// this module is the host seam around them. These are the two checks a Raster or an Image site is
// admitted by — the leaf half of the site tree's problem table (`tno`), which the walker reads as
// `tno[type](leaf) ?? ano(leaf, depth) ?? lur(...)` — and they are the reader of everything ported
// since W45-58: the mount `tF`/`Xto` from W45-60, the cell decoder `fur` and the ImageSource shape
// `Mss` from W45-58.
//
// Source, chunk-n3ykh62m.js. How a problem names the site it is about:
//
//   var our=40;function IL(e){let n=String(e).replace(y$,"?");return n.length<=our?n:`${ne(n,our)}...`}var RAt=1e4;
//
// [233219,233330) 111 units. The allowed-keys predicate and the checks both leaves run before their own:
//
//   var QAe=(e,n)=>Object.keys(e).every((r)=>n.includes(r));
//
// [233808,233864) 56, then
//
//   var EVe=(e)=>L(e)&&typeof e.plugin==="string"&&e.plugin!=="";function xye(e,n){let r=typeof n==="string";if(n!==void 0&&!r)return`${e} must be a string`;if(r&&n.length>RAt)return`${e} longer than ${RAt} characters`;return r&&QT(n)?`${e} holds a control character`:void 0}var XPn=(e,n)=>e.map((r)=>xye(r,n[r])).find((r)=>r!==void 0);
//
// [235650,235982) 332, then `ace`, the same check without the length cap — the one an alt or a label
// goes through, where `xye` is the one a key does:
//
//   function ace(e,n){let r=typeof n==="string";if(n!==void 0&&!r)return`${e} must be a string`;return r&&QT(n)?`${e} holds a control character`:void 0}
//
// [237337,237485) 148. What an Image is checked against, and that check:
//
//   var H_=255;var $_=255;var tL=(e,n)=>Kbr(e,n,{columns:H_,rows:$_});
//
// [242738,242804) 66. The two leaf problems themselves:
//
//   function Bto(e){let{props:n,children:r,image:s}=e;if(!L(n))return"Image props must be { source, columns, rows, alt }";if(r!==void 0)return"Image takes no children";let{source:h,columns:y,rows:b,alt:w,key:R,...T}=n,[P]=Object.keys(T);if(P!==void 0)return`Image prop "${P}" is not allowed (no hover or onPress; a press goes on an enclosing Button)`;if(typeof w!=="string")return"Image alt must be a string";if(R!==void 0&&(typeof R!=="string"||R===""))return"Image key must be a non-empty string when given";let M=R===void 0?"Image":`Image "${IL(R)}"`,z=ace("alt",n.alt)??xye("key",R)??tL(y,b)??Mss(h)??(EVe(s)?void 0:"is not stamped by a plugin of this chain");return z===void 0?void 0:`${M} ${z}`}
//
// [245596,246293) 697, then the picker a Raster's props go through:
//
//   function Gto(e,n){if(!L(e))return;let{key:r}=e;return typeof r==="string"&&r!==""&&QAe(e,n)?{...e,key:r}:void 0}
//
// [247200,247312) 112, and the Raster leaf problem:
//
//   function Jto(e){let{raster:n,children:r}=e,s=Gto(e.props,Xto);if(s===void 0)return"Raster props must be { key, columns, rows, cells }, key a non-empty string, and nothing else (no hover or onPress yet)";if(r!==void 0)return"Raster takes no children";let{key:h,columns:y,rows:b}=s,w=XPn(["key"],s)??tF(y,b)??fur(s.cells,Number(y),Number(b)).problem??(EVe(n)?void 0:"is not stamped by a plugin of this chain");return w===void 0?void 0:`Raster "${IL(h)}" ${w}`}
//
// [257143,257601) 458.
//
// What the two leaves share is the shape of a problem, not a shared function: both build a sentence out
// of a label and the first check that objected, and the checks are tried in the same order, the stamp
// last. Where they differ is the source's own and is kept: a Raster's props pass through `Gto`, so a
// stray key is refused by the picker with one sentence, while an Image destructures its five known
// props and *names the leftover key it found* — because a press belongs on an enclosing Button, and the
// message says so. A Raster's cells go through `fur`, whose own `.problem` is the sentence; an Image's
// source goes through `Mss`, which answers the sentence itself. `IL` is what truncates a key in a
// message, replacing whatever `y$` matches — the run of tabs, newlines and escapes that pattern is —
// with a question mark before the cut.
import type { ImageLeafInput, LeafProblem, RasterLeafInput } from './plugin-chain-registry-state.js';
import {
  $_, Bto, H_, IL, Jto, QAe, RAt, XPn, ace, EVe, Gto, our, tL, xye,
} from './plugin-chain-raster-sites-source.js';
import { Xto } from './plugin-chain-raster-cells-source.js';

/** The length a key is cut to in a problem (`our`). */
export const KEY_LABEL_LIMIT = our;
/** The length a string field is refused past (`RAt`), the cap `xye` applies and `ace` does not. */
export const STRING_LIMIT = RAt;
/** The size an Image is checked against (`H_` by `$_`), 255 by 255 — the Raster's own default of 512 by
 *  256 is `DEFAULT_RASTER_COLUMNS`/`DEFAULT_RASTER_ROWS` in the W45-60 seam. */
export const IMAGE_COLUMNS = H_;
export const IMAGE_ROWS = $_;
/** The props a Raster site admits (`Xto`), the list `Gto` picks against. */
export const RASTER_SITE_FIELDS: readonly string[] = Xto;

/** Source `IL`: the label a problem names a site by. Whatever `y$` matches becomes a question mark and
 *  the text is cut to `KEY_LABEL_LIMIT` with an ellipsis when it does not fit. */
export function labelOf(value: unknown): string {
  return (IL as (value: unknown) => string)(value);
}

/** Source `QAe`: whether every own key of `value` is one of `allowed`. */
export function allowedKeys(value: object, allowed: readonly string[]): boolean {
  return (QAe as (value: object, allowed: readonly string[]) => boolean)(value, allowed);
}

/** Source `EVe`: whether a leaf is stamped by a plugin of this chain — `plugin` a non-empty string. */
export function isChainStamped(leaf: unknown): boolean {
  return (EVe as (leaf: unknown) => boolean)(leaf);
}

/** Source `xye`: a field that must be a string when given, within `STRING_LIMIT` characters and
 *  without a control character. */
export function checkString(field: string, value: unknown): LeafProblem {
  return (xye as (field: string, value: unknown) => LeafProblem)(field, value);
}

/** Source `ace`: the same check without the length cap. */
export function checkLabel(field: string, value: unknown): LeafProblem {
  return (ace as (field: string, value: unknown) => LeafProblem)(field, value);
}

/** Source `XPn`: the first problem found over a list of fields, in list order. */
export function firstFieldProblem(fields: readonly string[], source: Record<string, unknown>): LeafProblem {
  return (XPn as (fields: readonly string[], source: Record<string, unknown>) => LeafProblem)(fields, source);
}

/** Source `tL`: whether a size is a whole number of columns and rows within the Image limits. */
export function imageSizeProblem(columns: number, rows: number): LeafProblem {
  return (tL as (columns: number, rows: number) => LeafProblem)(columns, rows);
}

/** Source `Gto`: the props a Raster site may mount, picked against `RASTER_SITE_FIELDS` — a copy whose
 *  `key` is a non-empty string, or nothing when the object does not qualify. */
export function pickRasterProps(props: unknown): Record<string, unknown> | undefined {
  return (Gto as (props: unknown, allowed: readonly string[]) => Record<string, unknown> | undefined)(props, Xto);
}

/** Source `Jto`: the sentence a Raster site is refused with, or nothing when it is admitted. */
export function rasterLeafProblem(leaf: RasterLeafInput): LeafProblem {
  return (Jto as (leaf: RasterLeafInput) => LeafProblem)(leaf);
}

/** Source `Bto`: the sentence an Image site is refused with, or nothing when it is admitted. */
export function imageLeafProblem(leaf: ImageLeafInput): LeafProblem {
  return (Bto as (leaf: ImageLeafInput) => LeafProblem)(leaf);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  leaves with the text. The seam's own names above are the ones a site check calls. */
export { $_, Bto, H_, IL, Jto, QAe, RAt, XPn, ace, EVe, Gto, our, tL, xye };
