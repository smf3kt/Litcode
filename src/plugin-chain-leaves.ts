// The Client, the Markdown and the Link (W45-65). The copied bodies live in
// ./plugin-chain-leaves-source.ts; this module is the host seam around them. These are the last three
// leaves of the site table whose dependencies are all inside the product: the Client, whose prop bag goes
// through the value budget W45-64 ported; the Markdown, whose pressable-link list has a check of its own;
// and the Link, whose href is measured twice — as written and percent-encoded.
//
// Source, chunk-n3ykh62m.js. The Client:
//
//   function Mto(e){let{props:n,client:r}=e;if(!(L(n)&&typeof n.key==="string"&&n.key!==""&&typeof n.module==="string"&&n.module!==""&&QAe(n,["key","module","props","width","height","flexGrow"])))return"Client props must be { key, module }, both non-empty strings, and any of props, width, height, flexGrow";let{key:h}=n,y=XPn(["key","module"],n);if(y!==void 0)return`Client "${h}" ${y}`;let w=n.props!==void 0?cQt(n.props):void 0;if(w!==void 0)return`Client "${h}" props ${w}`;for(let T of["width","height","flexGrow"]){let P=n[T];if(P===void 0)continue;let z=typeof P==="number"||typeof P==="string"?sQt(T,P):"must be a number or a string";if(z!==void 0)return`Client "${h}" ${T} ${z}`}if(!EVe(r))return`Client "${h}" is not stamped by a plugin of this chain`;return e.children===void 0?void 0:`Client "${h}" takes no children`}
//
// [235982,236808) 826 units. It is the one leaf here whose checks all come from other packages: the key
// and module are checked by the first-field problem, the prop bag by the value budget, the three numbers
// by the prop rules of that same W45-64 copy, and the stamp by the raster leaf's own predicate. The order
// is the answer — props shape, then the two keys, then the bag, then the three sizes, then the stamp,
// then children — and it was measured, so a bad width is reported even when a child is also there.
//
// The two limits and the two bodies the Markdown and its links are measured with:
//
//   var Lrt=2048;var pur=256;function zto(e){if(e===void 0)return;if(!Array.isArray(e))return`pressableLinks is ${cN(e)}, not a list of hrefs`;if(e.length>pur)return`pressableLinks names more than ${pur} links`;for(let n of e){if(typeof n!=="string"||n==="")return`pressableLinks holds ${cN(n)}, not an href`;if(n.length>Lrt)return`pressableLinks holds an href longer than ${Lrt} characters`;if(QT(n))return"pressableLinks holds an href with a control character"}return}function Vto(e){let{props:n,press:r,children:s}=e;if(!(L(n)&&QAe(n,["key","text","dimColor","pressableLinks"])))return"Markdown props must be { text }, a string, key a string, dimColor a boolean and pressableLinks a list of hrefs";if(s!==void 0)return"Markdown takes no children";let{key:y,text:b,dimColor:w,pressableLinks:R}=n;if(typeof b!=="string")return"Markdown text must be a string";if((y===void 0?void 0:xAt(y))!==void 0)return`Markdown key "${IL(y)}" is not a usable address`;let P=y===void 0?"Markdown":`Markdown "${IL(y)}"`,M=ace("text",b)??zto(R);if(M!==void 0)return`${P} ${M}`;if(w!==void 0&&typeof w!=="boolean")return`${P} dimColor is a boolean or absent`;if(r===void 0)return R!==void 0?`${P} names pressableLinks but answers no press (onLinkPress)`:void 0;let z=wVe(r);if(z!==void 0)return`${P} ${z}`;return y!==void 0?void 0:"Markdown answers its links (onLinkPress) but has no key, its address"}
//
// [247312,248693) 1,381 units: `Lrt` (13 units) is the href limit, `pur` (12) how many links a list may
// name, `zto` (441) checks the pressable-link list and `Vto` (915) is the Markdown leaf that calls it.
// `zto` answers sentences with no site name in them — the Markdown prefixes what it answers with — and it
// measures an href *as written* only, which is the one place it differs from the Link's own href check
// below. The Markdown is the only leaf here that names its own site through a variable: every sentence
// after the key is prefixed with `Markdown` when the leaf has no key and with `Markdown "<key>"` when it
// has one, the key scrubbed through the label scrubber in both the prefix and its own sentence. Three of
// its sentences are about the pairing of a press with the links it answers rather than about a field —
// the children, the links-without-a-press and the press-without-a-key — and the last two are the same
// pairing read from either side.
//
// The Link and the href encoder beside it:
//
//   var Nrt=(e)=>e.replace(/[^ -~]/gu,(n)=>encodeURIComponent(hf(n)));function sno(e){let{props:n}=e;if(!L(n))return"Link props must be { href }";let{href:r,label:s,...h}=n,[y]=Object.keys(h);if(y!==void 0)return`Link prop "${y}" is not allowed`;if(ZAe(r)&&(r.length>Lrt||Nrt(r).length>Lrt))return`Link href longer than ${Lrt} characters as written`;if(s!==void 0&&typeof s!=="string")return"Link label must be a string";if(s?.trim()==="")return"Link label is blank (leave it out to draw the URL)";return QT(s??"")?"Link label holds a control character (an escape sequence)":void 0}
//
// [260226,260804) 578 units. `Nrt` (66) percent-encodes every character outside printable ASCII and
// repairs a lone surrogate to U+FFFD first, through the host-call copy's `hf` — which is why `Nrt` of a
// lone high surrogate is `%EF%BF%BD` rather than a malformed escape. `sno` (512) guards its href check
// with the non-blank-string predicate, so an href that is not a string at all is not refused here:
// measured, `{ href: 1 }` and `{ href: "" }` are both admitted, the second because a blank href is not an
// address to measure rather than a mistake to name. A plain href of 2,048 characters fits and 2,049 does
// not; an accented href of 1,024 characters does not, because the second measurement is the encoded
// length rather than the written one.
//
// Every name these seven statements reach is imported rather than copied, and between them they draw on
// six copies already in the product: `L` from the chain runner, `cN`/`cQt`/`sQt` from the style-prop copy,
// `QT` from the blit copy, `EVe`/`XPn`/`QAe`/`ace`/`IL` from the raster leaf-problem copy,
// `wVe`/`xAt`/`ZAe` from the site-leaf copy, and `hf` from the host-call copy — the name the Link was
// held back for in W45-63, found already carried in W45-64.
import type { ClientLeafInput, LeafProblem, PressableLeafInput } from './plugin-chain-registry-state.js';
import { Mto, Nrt, pur, sno, Vto, zto, Lrt } from './plugin-chain-leaves-source.js';

/** The longest href the Link and the pressable-link list admit (`Lrt`), and how many links a list may
 *  name (`pur`). */
export const LINK_HREF_LIMIT = Lrt;
export const PRESSABLE_LINK_LIMIT = pur;

/** Source `Mto`: the sentence a Client site is refused with, or nothing when it is admitted. The stamp
 *  check is the raster leaves' own — a client that is not held by a plugin of this chain is refused
 *  before its children are looked at. */
export function clientLeafProblem(leaf: ClientLeafInput): LeafProblem {
  return (Mto as (leaf: ClientLeafInput) => LeafProblem)(leaf);
}

/** Source `zto`: the sentence a pressable-link list is refused with, or nothing. Not one of the site
 *  types — it answers with no site name, and the Markdown prefixes it. */
export function pressableLinksProblem(links: unknown): LeafProblem {
  return (zto as (links: unknown) => LeafProblem)(links);
}

/** Source `Nrt`: an href with every character outside printable ASCII percent-encoded, and a lone
 *  surrogate repaired first, so the result is always a well-formed escape. */
export function encodeHref(href: string): string {
  return (Nrt as (href: string) => string)(href);
}

/** Source `Vto`: the sentence a Markdown site is refused with, or nothing when it is admitted. Its
 *  sentences are prefixed with the key when it has one, and three of them are about the pairing of a
 *  press with the links it answers rather than about a field. */
export function markdownLeafProblem(leaf: PressableLeafInput): LeafProblem {
  return (Vto as (leaf: PressableLeafInput) => LeafProblem)(leaf);
}

/** Source `sno`: the sentence a Link site is refused with, or nothing when it is admitted. */
export function linkLeafProblem(leaf: { props?: unknown }): LeafProblem {
  return (sno as (leaf: { props?: unknown }) => LeafProblem)(leaf);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  leaves with the text. The seam's own names above are the ones a site check calls. */
export { Lrt, Mto, Nrt, pur, sno, Vto, zto };
