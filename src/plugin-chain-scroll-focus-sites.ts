// The `ui.scroll` and `ui.focus` site descriptors (W45-71) — what a call of either name must
// carry, what a rewrite of one may not change, and what its answer must look like — registered into the
// host seam's site table as this module is evaluated. The copied bodies live in
// ./plugin-chain-scroll-focus-sites-source.ts.
//
// The registration is why this is its own module: `Mm` pairs an entry with `zd[name]` while the
// entries' copy is evaluated, so the two descriptors have to be in the table first, and the entries'
// copy imports this file above its own bodies for exactly that reason.
//
// The check and the two builders every site of this family shares, which the copies above already carry:
// `et(kind, answer, rest)` describes a refusal, `we(keys)` builds a restore-argument step and
// `C(check)` wraps the check that reads an answer. The two descriptors are built with them:
//
//   function pr(e,t,o){let{deny:r}=e;return r===void 0||typeof r==="string"&&r!==""?et("deny",e,o):"a deny that is not a non-empty string"}
//
// [15588,15723) 135 units, chunk-nyce03br.js. `pr` — the check both sites share: the answer may carry no `deny`, or one that is a non-empty string. An empty one is refused with `a deny that is not a non-empty string`, which is what keeps a silent refusal from reading as success.

//
//   var ro=({event:e,restored:t,checkArgument:o,check:r})=>({event:e,restoreArgument:we(t),checkArgument:o,check:C(r)});
//
// [16084,16200) 116 units, chunk-nyce03br.js. `ro` — the site builder: the event name, the restore-argument step over the names the site restores, the argument check, and the wrapped answer check.

//
//   function Vr(e,t){if(e!==void 0&&t===void 0)return"an element where the move named none (one of the engine's stops)";if(e===void 0&&t!==void 0)return"no element where the move named one (a rewrite names another)";return e===void 0||typeof e==="string"&&e!==""?void 0:"an element that is not a non-empty string"}
//
// [34850,35160) 310 units, chunk-nyce03br.js. `Vr` — the element check: an element where the move named none is one of the engine's stops, no element where it named one is a rewrite naming another, and anything that is not a non-empty string is refused outright.

//
//   var ko=["component","requestId","plugin","origin"];
//
// [35160,35211) 51 units, chunk-nyce03br.js. `ko` — the four names a focus call's envelope is made of, which a rewrite may not change.

//
//   var Ci=ro({event:"ui.focus",restored:[...ko,"element"],checkArgument:(e,t)=>re(ko,e,t)??Vr(e.element,t.element),check:pr});
//
// [35211,35334) 123 units, chunk-nyce03br.js. `Ci` — the `ui.focus` site: the envelope plus its element, the envelope-unchanged check followed by the element check, and the shared answer check.

//
//   var Po=["component","requestId","by","bodyRows","contentRows","origin","pointer"];
//
// [94084,94166) 82 units, chunk-nyce03br.js. `Po` — the seven names a scroll call's envelope is made of. The offset is not among them, which is measured: the site checks it and does not restore it.

//
//   var wa=ro({event:"ui.scroll",restored:Po,checkArgument:(e,t)=>{let o=h$(e.offset);return re(Po,e,t)??(o?void 0:"an offset that is not a whole row number (0 or more)")},check:pr});
//
// [94166,94345) 179 units, chunk-nyce03br.js. `wa` — the `ui.scroll` site: the offset must be a whole row number (0 or more), then the envelope-unchanged check, then the shared answer check.

//
// Both are registered under the names the host seam's table files them by, in the order the table lists
// them.
import { registerChainSite } from './plugin-chain-host.js';
import { Ci, ko, Po, pr, ro, Vr, wa } from './plugin-chain-scroll-focus-sites-source.js';

/** Source `Ci`: the `ui.focus` site descriptor. */
export const FOCUS_SITE = Ci;
/** Source `wa`: the `ui.scroll` site descriptor. */
export const SCROLL_SITE = wa;
/** Source `ko`: the names a focus call's envelope is made of. */
export const FOCUS_CALL_ARGUMENTS = ko;
/** Source `Po`: the names a scroll call's envelope is made of. */
export const SCROLL_CALL_ARGUMENTS = Po;

registerChainSite('ui.focus', Ci as never);
registerChainSite('ui.scroll', wa as never);

/** Source `pr`: the answer check both sites share — the refusal it answers, or nothing. */
export function siteAnswerCheck(answer: unknown, args: unknown, fromBelow: unknown): string | undefined {
  return pr(answer, args, fromBelow);
}

/** Source `Vr`: the element check — the refusal it answers, or nothing. */
export function elementCheck(next: unknown, previous: unknown): string | undefined {
  return Vr(next, previous);
}

/** Source `ro`: the site builder, for a site of this family that is not one of the two above. */
export function buildSite(spec: {
  event: string;
  restored: string[];
  checkArgument: (args: unknown, previous: unknown) => string | undefined;
  check: (answer: unknown, args: unknown, fromBelow: unknown) => string | undefined;
}): unknown {
  return ro(spec);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  descriptor with the source's own. */
export const SOURCE_BODIES = { pr, ro, Vr, ko, Ci, Po, wa };

export { Ci, ko, Po, pr, ro, Vr, wa };
