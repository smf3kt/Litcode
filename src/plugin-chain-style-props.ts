// The style-prop validators and the value budget (W45-64). The copied bodies live in
// ./plugin-chain-style-props-source.ts; this module is the host seam around them. Two things sit here,
// and they are two halves of one answer: what a plugin's prop is allowed to be (`sQt` and the six name
// sets beside it), and how a value that is the wrong shape or too large is described back to the plugin
// author (`cN`, the walk budget `Ro`/`ca`/`un`, the walker `Dt` and its entry `cQt`).
//
// Source, chunk-nyce03br.js. What a prop name is measured against — six sets and one table:
//
//   var Ubr=new Set(["dimColor","bold","italic","underline","strikethrough","inverse","borderDimColor"]);
//
// [2097,2198) 101 units, the text styles;
//
//   var rQt=new Set(PFs);var Cgo=new Set(["color","backgroundColor","borderColor"]);
//
// [2208,2288) 80, the border names — the same table the W44 tui border copy carries, made into a Set
// here rather than copied a second time — and the three colour names;
//
//   var Rgo=new Set(["flexGrow","flexShrink","gap","columnGap","rowGap","margin","marginX","marginY","marginTop","marginBottom","marginLeft","marginRight","padding","paddingX","paddingY","paddingTop","paddingBottom","paddingLeft","paddingRight"]);var olt=new Set(["top","left","right","bottom"]);
//
// [2523,2815) 292, the nineteen flex and spacing names and the four sides;
//
//   var xgo={flexDirection:new Set(["row","column","row-reverse","column-reverse"]),flexWrap:new Set(["nowrap","wrap","wrap-reverse"]),alignItems:new Set(["flex-start","center","flex-end","stretch"]),alignSelf:new Set(["flex-start","center","flex-end","auto"]),justifyContent:new Set(["flex-start","center","flex-end","space-between","space-around","space-evenly"]),overflow:new Set(["visible","hidden"]),display:new Set(["flex","none"]),position:new Set(["relative","absolute"]),wrap:new Set(["wrap","end","middle","truncate-end","truncate","truncate-middle","truncate-start"]),borderStyle:rQt};
//
// [2815,3407) 592, the table a name is looked up in — ten props whose value is a word from a fixed list,
// and the last entry shares `rQt`'s own Set rather than listing the border names again;
//
//   var slt=1e4;var oQt=new Set(["width","height","minWidth","minHeight"]);
//
// [4004,4075) 71, the tolerance four numeric rules are measured against, and the four sizes;
//
//   function sQt(e,t){let o=xgo[e];if(o!==void 0)return typeof t==="string"&&o.has(t)?void 0:`must be one of ${[...o].join(", ")}`;if(oQt.has(e)){if(typeof t==="number")return Number.isFinite(t)&&t>=0&&t<=slt?void 0:`must be a finite number between 0 and ${slt}`;return typeof t==="string"&&/^\d{1,3}%$/.test(t)?void 0:"must be a number or a percentage"}if(Rgo.has(e))return typeof t==="number"&&Number.isFinite(t)&&Math.abs(t)<=slt?void 0:`must be a finite number within ${slt}`;if(olt.has(e))return typeof t==="number"&&Number.isInteger(t)&&Math.abs(t)<=slt?void 0:`must be an integer within ${slt} (character cells)`;if(Cgo.has(e))return typeof t==="string"&&/^[#a-zA-Z0-9_().,% -]{1,40}$/.test(t)?void 0:"must be a color (a theme key, a name, or hex)";if(Ubr.has(e))return typeof t==="boolean"?void 0:"must be a boolean";return"has no value rule"}
//
// [4140,4987) 847. The order of those six lookups is the whole behaviour: the table first, then the
// sizes, the spacing names, the sides, the colours and the styles, and anything else answers that it has
// no rule — including a name this chain knows elsewhere (`key`, `options`, `autoFocus` are not style
// props and get the same sentence as gibberish). Only a sentence is answered or nothing at all, and the
// sentence is the reason alone: the caller prefixes the site and the prop name.
//
// How a value is described back. Three bounds, the largest list length a plugin may claim, and the
// describer itself:
//
//   var Ybr=1e5;
//
// [5978,5990) 12, how many characters a walked value may serialize to;
//
//   var ESe=32;var AFe=20000;
//
// [6016,6041) 25, how deep it may nest and how many values it may hold;
//
//   function cN(e){if(e===null)return"null";let t=typeof e==="object";return Array.isArray(e)?"an array":t?"an object":`a ${typeof e}`}
//
// [6041,6172) 131, the short shape — note the article is written out unconditionally, so a string is
// "a string" but an array is "an array": the phrase is `a <what it is>`, and `null` is its own word;
//
//   var Vs=4294967295;
//
// [6340,6358) 18, and
//
//   function B(e){let t=e.length,r=typeof t!=="bigint"&&typeof t!=="symbol"?Math.max(Math.trunc(Number(t))||0,0):void 0;if(r===void 0||r>Vs)throw new He(`a plugin's list claims a length no list has (got ${r??`a ${typeof t}`})`);return r}
//
// [6358,6591) 233. This is the one body in the package that refuses instead of describing: a list whose
// `length` is not a length (a bigint, a symbol, or more than 4294967295) is an error, not a sentence.
// Everything else is coerced — a string `length` is a number, a fraction is truncated, a negative and a
// `NaN` are both zero — so only the two cases that cannot be a length at all throw. It is also the only
// import this package needs from the chain: `He` is the error class, already carried by the runner copy.
//
// The budget, its three bounds, and what a walk costs:
//
//   function*fa(e){if(Array.isArray(e)){let t=B(e);for(let o=0;o<t;o+=1)yield[1,e[o]];return}for(let[t,o]of Object.entries(e))yield[t.length+4,o]}
//
// [87341,87483) 142, the generator the walker visits a value's children with, charging one character per
// array element and a key's own length plus four for an object member;
//
//   var F$n=Ybr;var Xbr=ESe;var Jbr=AFe;var Ro=()=>({nodes:0,chars:0,path:new Set,done:new Map});
//
// [87483,87576) 93. The three bounds are re-exported under their own names and a fresh budget is four
// fields: the two counters, the path it is on (a cycle is a value that is its own ancestor), and the cost
// already measured for a value it has finished — which is what keeps a value that appears twice from
// being walked twice, and is why a repeated child is not a cycle;
//
//   function ca(e){if(e.nodes>Jbr)return`holds more than ${Jbr} values`;return e.chars>F$n?`serializes to more than ${F$n} characters`:void 0}
//
// [87576,87714) 138. Values are counted before characters, so a value that is both too wide and too long
// answers the count;
//
//   function un(e){switch(typeof e){case"boolean":return 5;case"string":return e.length+2;case"number":return String(e).length;default:return e===null?5:void 0}}
//
// [87714,87871) 157, what a scalar costs: a boolean and `null` are five characters, a string pays for its
// quotes, and a number pays for its own text — and anything else answers nothing, which is the walker's
// signal that the value has to be walked rather than counted;
//
//   function Dt(e,t,o){if(t>Xbr)return`nests deeper than ${Xbr}`;let r=typeof e==="object"?o.done.get(e):void 0;o.nodes+=r?.nodes??1,o.chars+=r?.chars??un(e)??2;let n=ca(o);if(n!==void 0||r!==void 0)return n;if(typeof e==="number"&&!Number.isFinite(e))return`holds ${String(e)}`;if(un(e)!==void 0)return;if(e===void 0)return"holds undefined (an array hole, a missing value)";if(typeof e!=="object"||e===null)return`holds ${cN(e)}`;if(o.path.has(e))return"holds a cycle";let s=Object.getPrototypeOf(e);if(!(Array.isArray(e)||s===null||Object.getPrototypeOf(s)===null))return"holds an object that is not plain (a class instance)";let p={nodes:o.nodes-1,chars:o.chars-2};o.path.add(e);for(let[a,f]of fa(e)){o.chars+=a;let m=Dt(f,t+1,o);if(m!==void 0)return m}o.path.delete(e),o.done.set(e,{nodes:o.nodes-p.nodes,chars:o.chars-p.chars});return}
//
// [87871,88707) 836. The order of the checks is the answer to a value that is wrong in two ways at once:
// too deep beats everything, then the budget and a value already seen, then a number that is not finite
// (checked before the scalar cost, since `un` would happily count `NaN`'s three characters), then a
// scalar, then `undefined`, then a non-object, then a cycle, then an object that is not plain — a value
// whose prototype chain is deeper than one plain level, which is how a class instance and a Map are
// described. `undefined` is named as an array hole because that is where it usually comes from: a
// missing value in a prop object reads the same way;
//
//   var cQt=(e)=>Dt(e,0,Ro());
//
// [88772,88798) 26. That is the whole entry: depth zero and a fresh budget, so one call is one walk.
//
// Two names are imported rather than copied. `He` is the error `B` throws, the chain runner's own class.
// `PFs` is the border prop table in ./tui-border.ts — `new Set(PFs)` is the Set `sQt` consults and the
// Set `xgo.borderStyle` is, so the border names are one table read twice rather than a list written out
// a third time. Two further statements of the same module sit inside this package's span and are
// referenced by nothing in it (`Ago` between the first two blocks, `B3e` between the sizes and the
// colours), so the span is split around them rather than carrying them for free.
import type { WalkBudget } from './plugin-chain-registry-state.js';
import {
  ca, cN, cQt, Dt, fa, Jbr, F$n, Xbr, B, Ro, sQt, un, AFe, Ybr, ESe, Vs, Cgo, olt, oQt, Rgo, rQt, slt, Ubr, xgo,
} from './plugin-chain-style-props-source.js';

/** The text-style prop names (`Ubr`), and the border, colour, spacing, side and size names beside it. */
export const TEXT_STYLE_PROPS: ReadonlySet<string> = Ubr;
export const BORDER_PROPS: ReadonlySet<string> = rQt;
export const COLOR_PROPS: ReadonlySet<string> = Cgo;
export const SPACING_PROPS: ReadonlySet<string> = Rgo;
export const SIDE_PROPS: ReadonlySet<string> = olt;
export const SIZE_PROPS: ReadonlySet<string> = oQt;
/** The props whose value is a word from a fixed list (`xgo`), keyed by prop name. `borderStyle` holds
 *  `BORDER_PROPS` itself, not a copy of it. */
export const PROP_RULES: Record<string, ReadonlySet<string>> = xgo;
/** The largest magnitude a numeric prop may have, and the bound a size is measured against (`slt`). */
export const NUMBER_TOLERANCE = slt;
/** How many characters a walked value may serialize to (`Ybr`), how deep it may nest (`ESe`), and how
 *  many values it may hold (`AFe`). The walker re-exports the same three as `F$n`, `Xbr` and `Jbr`. */
export const VALUE_CHAR_LIMIT = Ybr;
export const VALUE_DEPTH_LIMIT = ESe;
export const VALUE_NODE_LIMIT = AFe;
/** The largest length a plugin's list may claim (`Vs`). */
export const MAX_LIST_LENGTH = Vs;

/** Source `sQt`: the reason a prop value is refused, or nothing when it is admitted. The reason names
 *  no site and no prop — the caller prefixes both. */
export function propProblem(name: string, value: unknown): string | undefined {
  return (sQt as (name: string, value: unknown) => string | undefined)(name, value);
}

/** Source `cN`: the short shape a value had, as the phrase `a <what it is>` — `null`, `an array` and
 *  `an object` being the three that are not written that way. */
export function shortDescription(value: unknown): string {
  return (cN as (value: unknown) => string)(value);
}

/** Source `B`: the length a plugin's list claims, coerced to a whole count, or the error `He` when the
 *  claim cannot be a length at all. */
export function listLength(list: { length?: unknown }): number {
  return (B as (list: { length?: unknown }) => number)(list);
}

/** Source `Ro`: an empty walk budget. One call to `valueProblem` builds its own; this is for a caller
 *  that walks a value itself through `walkProblem`. */
export function freshWalkBudget(): WalkBudget {
  return (Ro as () => WalkBudget)();
}

/** Source `fa`: the generator a walked value's children are visited with — each child beside the
 *  character cost of naming it. */
export function* valueEntries(value: object): Generator<[number, unknown], void, undefined> {
  yield* (fa as (value: object) => Generator<[number, unknown], void, undefined>)(value);
}

/** Source `ca`: the budget sentence a walk has earned so far, or nothing while it is inside. */
export function budgetProblem(budget: WalkBudget): string | undefined {
  return (ca as (budget: WalkBudget) => string | undefined)(budget);
}

/** Source `un`: what a scalar costs the budget in characters, or nothing when the value is not one of
 *  the four kinds the walker counts — the signal that it has to be walked. */
export function scalarCost(value: unknown): number | undefined {
  return (un as (value: unknown) => number | undefined)(value);
}

/** Source `Dt`: the reason a value is refused, spending the budget it is handed. Depth first, then the
 *  budget and a value already seen, then a number that is not finite, then a scalar, `undefined`, a
 *  non-object, a cycle, and an object that is not plain. */
export function walkProblem(value: unknown, depth: number, budget: WalkBudget): string | undefined {
  return (Dt as (value: unknown, depth: number, budget: WalkBudget) => string | undefined)(value, depth, budget);
}

/** Source `cQt`: the reason a plugin's prop value is refused, or nothing when it fits the budget — the
 *  walk at depth zero with a fresh one. This is what the Client, the Markdown and their neighbours call
 *  to describe props that were the wrong size rather than the wrong shape. */
export function valueProblem(value: unknown): string | undefined {
  return (cQt as (value: unknown) => string | undefined)(value);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  rules with the text. The seam's own names above are the ones a site check calls. */
export {
  AFe, B, Cgo, cN, cQt, ca, Dt, ESe, F$n, fa, Jbr, olt, oQt, Rgo, rQt, Ro, slt, sQt, Ubr, un, Vs, Xbr, xgo, Ybr,
};
