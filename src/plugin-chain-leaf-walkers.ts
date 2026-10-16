// The leaf table and the walkers that read it (W45-69) — how tall a leaf is, what text it contributes and
// whether its key is drawn twice. The copied bodies live in ./plugin-chain-leaf-walkers-source.ts; this
// module is the seam around them. The site-table packages ported the nine leaf checks one at a time
// (W45-60..66); what was never carried is the table that names them and the three walkers the pane that
// draws leaves runs over a tree.
//
// Source, chunk-n3ykh62m.js. The table itself:
//
//   var tno={Button:Hto,Client:Mto,Code:Lto,Image:Bto,Input:jto,Markdown:Vto,Raster:Jto,Select:Zto,Svg:eno};
//
// [259180,259284) 104 units. `tno` — the leaf table: the nine leaf types, each mapped to the check that
// refuses a bad one. Every value is a body another package already ported, so the table is imported
// around rather than ported again; what it adds is the dispatch — a caller holding a leaf of unknown type
// reads its check out of here, which is why the table is the one statement in the module that names all
// nine at once.
//
// How tall a leaf is, and what text it contributes:
//
//   function rno(e){if(e.type==="Svg")return[e.props.alt];let n=e.type==="Button"?e.children??[]:[];if(n.length>0)return[Q4t(n).join("")];return e.type==="Button"||e.type==="Input"?[e.props.label??""]:[]}
//
// [259514,259714) 200 units. `rno` — the text a leaf contributes. A Svg contributes its alt, a Button its
// children joined (and its children win over its label when it has both), a Button or an Input its label,
// and every other type nothing at all. An Input without a label contributes the empty string rather than
// nothing, which is measured: the two answers are different inputs to the height below.
//
//   function ono(e){if(e.type==="Raster"||e.type==="Image")return e.props.rows;if(e.type==="Markdown")return Lt(e.props.text,`…`)+1;if(y>kFe)return y;let b=vVe(n,s),w=b?.kind==="hunks"?b.hunks:[],R=Math.max(0,w.length-1);if(h==="truncate-end")return y+R;let P=r===void 0||b?.kind==="refused"?0:r+y-1,M=P===0?0:String(P).length+2,z=w.reduce((N,V)=>Math.max(N,Int(V)),M);return 1+R+IAt(J4t(n),lQt-z)}
//
// [259714,260226) 512 units. `ono` — how tall a leaf is. A Raster or an Image answers its own row count, a
// Markdown its line count, and everything else one line plus the wrapped text it contributes. A Code leaf
// is the interesting case and the reason this package brings a diff parser: its own line count answers
// while it is under the cap, and past that the diff it holds decides — the hunks it adds, the gutter the
// line numbers take when the source starts at a known line, and whether the answer is the truncation. The
// body holds two line breaks, so the quote above is its head and tail with … for them; the copy is whole.
//
//   function ano(e,n){let{props:r}=e,h=(e.type==="Input"||e.type==="Select"||e.type==="Markdown"||e.type==="Client"||e.type==="Raster"||e.type==="Image")&&L(r)?r.key:void 0;if(typeof h!=="string")return;let y=`${e.type}\x00${h}`,b=n.has(y);return n.add(y),b?`${e.type} "${h}" is drawn twice; each takes its own key`:void 0}
//
// [262308,262627) 319 units. `ano` — is this keyed leaf drawn twice. Only the six types that carry a key
// are looked at, and only when the props really are an object and the key really is a string; the set is
// keyed by the type and the key together, so the same key under two types is not a duplicate, and the
// second sighting is refused with a sentence naming both.
//
// The diff reader the Code leaf's height needs, and the four one-statement helpers under the walkers:
//
//   function Dto(e){let n;try{n=tso(e)}catch(w){return{kind:"refused",problem:l(w)}}let r=n.flatMap((w)=>w.hunks).map((w)=>({...w,lines:w.lines.filter((R)=>!R.startsWith("\\"))})),s=r.findIndex(({oldStart:w,oldLines:R,newStart:T,newLines:P})=>![w,R,T,P].every((M)=>Number.isSafeInteger(M)&&M>=0&&M<=PAt)),h=r.length===0,y=h?"no @@ hunk header found":`hunk ${s+1} header is not @@ -a,b +c,d @@ within ${PAt} lines`;return h||s!==-1?{kind:"refused",problem:y}:{kind:"hunks",hunks:r}}
//
// [236820,237297) 477 units. `Dto` — a unified diff read back into hunks the way the height walker wants
// it: every hunk's backslash marker lines dropped (they are the parser's, not the reader's), each header checked
// to be `@@ -a,b +c,d @@` with all four numbers safe integers inside a billion lines, and a refusal that
// says which hunk failed and why when one is not. The refusal is a value, not an error.
//
//   var vVe=(e,n)=>n==="diff"?Dto(e):void 0;
//
// [237297,237337) 40 units. `vVe` — the reader a Code leaf asks for by format: the diff reader when the
// format says diff, and nothing otherwise, which is why a `source`-format Code leaf never pays for the
// parser.
//
//   var J4t=(e)=>Epe(HN(e)).replace(/[\u061c\u202a-\u202e\u2066-\u2069]/gu,"\uFFFD");
//
// [238357,238438) 81 units. `J4t` — the text a leaf contributes with the bidi controls and directional
// marks replaced by the replacement character, which is what keeps a right-to-left override inside a
// leaf's text from reordering the line it was drawn on.
//
//   var Q4t=(e)=>e.flatMap((n)=>{let r=typeof n==="string",s=!r&&"children"in n?n.children??[]:[];return r?[n]:Q4t(s)});
//
// [238917,239033) 116 units. `Q4t` — the strings under a list of children, flattened depth-first: a string
// contributes itself, an object contributes its own children, and anything else is measured rather than
// guessed — it throws, because a child is a string or an object and nothing else.
//
//   function nno(e,n){let r=0,s=0;for(let{index:h}of e.matchAll(/[\t\n\r]/gu))if(r+=h===s?0:ae(e.slice(s,h)),s=h+1,r>n)return r;return r+ae(e.slice(s))}
//
// [259284,259432) 148 units. `nno` — text measured up to a budget, counting what each line costs at the
// point the line ends and stopping as soon as the budget is passed. The stop is past the budget rather
// than at it, so the answer can exceed what was asked for by one line; that is measured.
//
//   function IAt(e,n){let r=Lt(e,`…`);return r>kFe?r:r+Math.floor(nno(e,n*(kFe+1))/n)}
//
// [259432,259514) 82 units. `IAt` — the emitted lines a string takes at a width: its own line count while
// it is under the cap, and its line count plus the wrapped remainder past it, where the remainder is the
// width measurement above divided by the width. The body holds one line break inside its template literal,
// so the quote above is its head and tail with … for the break; the copy keeps the body whole.
//
//   function tso(n){let e=n.split(/\n/),t=[],i=0;function l(){let…unk at line "+(f+1));return c}while(i<e.length)l();return t}
//
// [9299,11040) 1,741 units, chunk-34bv7wfw.js. `tso` — the unified-diff parser behind the reader. It walks
// the text once, reading file headers, index lines and hunks off the start of each line, counting a hunk's
// added and removed lines as it goes and refusing the whole parse when a count does not match the header.
// The copy keeps it whole and cites the range; the quote above is its head and tail, with … for the elision.
//
//   function HN(e){if(!e.includes("\t"))return e;return e.replace(/^\t+/gm,(n)=>"  ".repeat(n.length))}  [7703,7802) 99 units, chunk-f606a53w.js — leading tabs expanded, two spaces each.
//   var Int=(e)=>`+ ${Math.max(e.oldStart+e.oldLines-1,e.newStart+e.newLines-1,1)} `.length;
//   [17539,17627) 88 units, chunk-kcwp0ct0.js — the width a hunk's `+ N ` gutter takes.
//   function Lt(t,n,e=0){let r=0,i=t.indexOf(n,e);while(i!==-1)r++,i=t.indexOf(n,i+1);return r}
//   [3561,3652) 91 units, chunk-ax7r0qj7.js — how many times a needle occurs.
//   var lQt=40;var kFe=12;var Ybr=1e5;var B3e="AskUserQuestion";var ESe=32;var AFe=20000;
//   [5956,6041) 85 units, chunk-nyce03br.js — the wrap width and the line cap, declared in one statement
//   with four constants this copy does not use.
//
// The helpers the walkers read come from the copies that already carry them: `L` and `l` from the chain
// copy, the width `ae` from the text-clamp copy (it is `Bun.stringWidth`'s wrapper, and the chain copy has
// a same-named predicate that is not this function — measured before the import was written), `Epe` from
// the normalize copy, `PAt` and five of the nine leaf checks from the site-leaf copy, two from the raster
// copies, two from the leaf copy and the Button from its own.
import type { DiffHunk, DiffRead, LeafLike, LeafTable } from './plugin-chain-registry-state.js';
import {
  ano, Dto, HN, IAt, Int, J4t, Lt, nno, ono, Q4t, rno, tno, tso, vVe, lQt, kFe,
} from './plugin-chain-leaf-walkers-source.js';

/** Source `tno`: the leaf table — the nine leaf types, each mapped to the check that refuses a bad one.
 *  Every value is a body another package ported; this is the dispatch over them. */
export const LEAF_TABLE = tno as LeafTable;

/** Source `kFe`: the line cap a Code or Markdown leaf is measured against. */
export const LEAF_LINE_CAP = kFe;
/** Source `lQt`: the width text is wrapped at. */
export const LEAF_WRAP_WIDTH = lQt;

/** Source `ono`: how tall a leaf is, in emitted lines. */
export function leafHeight(leaf: LeafLike): number {
  return ono(leaf);
}

/** Source `rno`: the text a leaf contributes, as the parts it contributes — empty for a leaf that
 *  contributes none. */
export function leafText(leaf: LeafLike): string[] {
  return rno(leaf);
}

/** Source `Q4t`: the strings under a list of children, flattened depth-first. Throws on a child that is
 *  neither a string nor an object, because that is what the copied body does. */
export function flattenLeafText(children: readonly unknown[]): string[] {
  return Q4t(children);
}

/** Source `ano`: is this keyed leaf drawn twice — the first sighting answers nothing and adds the key to
 *  the set, the second answers the sentence naming the type and the key. */
export function duplicateLeafKey(leaf: LeafLike, seen: Set<string>): string | undefined {
  return ano(leaf, seen);
}

/** Source `IAt`: the emitted lines a string takes at a width. */
export function emittedLines(text: string, width: number): number {
  return IAt(text, width);
}

/** Source `nno`: text measured up to a budget, in the units the width helper counts. */
export function textWidthWithin(text: string, budget: number): number {
  return nno(text, budget);
}

/** Source `Dto`: a unified diff read back into hunks, or the refusal that says which header failed.
 *  The copied body's two answers come back with a plain `string` kind because nothing in the body pins
 *  the literals, so the alias names the two arms the source's own callers distinguish. */
const readDiff = Dto as (text: string) => DiffRead;

/** Source `vVe`: the reader a Code leaf asks for by format — the diff reader for a diff, nothing else. */
const readDiffForFormat = vVe as (text: string, format: string | undefined) => DiffRead | undefined;

/** Source `Dto`: a unified diff read back into hunks, or the refusal that says which header failed. */
export function diffHunks(text: string): DiffRead {
  return readDiff(text);
}

/** Source `vVe`: the reader a Code leaf asks for by format — the diff reader for a diff, nothing else. */
export function diffReadFor(text: string, format: string | undefined): DiffRead | undefined {
  return readDiffForFormat(text, format);
}

/** Source `tso`: the unified-diff parser behind the reader. Throws when a hunk's counts do not match its
 *  header, which is how a malformed diff is refused before `Dto` sees it. */
export function parseUnifiedDiff(text: string): Array<Record<string, unknown> & { hunks: DiffHunk[] }> {
  return tso(text);
}

/** Source `J4t`: leaf text with the bidi controls and directional marks replaced. */
export function sanitizeLeafText(text: string): string {
  return J4t(text);
}

/** Source `HN`: leading tabs expanded to two spaces each. */
export function expandLeadingTabs(text: string): string {
  return HN(text);
}

/** Source `Lt`: how many times a needle occurs in a string. */
export function countOccurrences(text: string, needle: string, from = 0): number {
  return Lt(text, needle, from);
}

/** Source `Int`: the width of a hunk's `+ N ` line-number gutter. */
export function hunkGutterWidth(hunk: DiffHunk): number {
  return Int(hunk);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own. */
export const SOURCE_BODIES = { ano, Dto, HN, IAt, Int, J4t, Lt, nno, ono, Q4t, rno, tno, tso, vVe, lQt, kFe };

export { ano, Dto, HN, IAt, Int, J4t, Lt, nno, ono, Q4t, rno, tno, tso, vVe, lQt, kFe };

export type { DiffHunk, DiffRead, LeafLike, LeafTable };
