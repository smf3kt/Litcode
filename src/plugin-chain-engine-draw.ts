// The engine's draw transforms, the first slice of the `gno` closure measured by W140. The copied
// bodies live in ./plugin-chain-engine-draw-source.ts; this module is the typed seam around them.
//
// Source, chunk-n3ykh62m.js. Four passes the engine runs on a hook-returned tree before anything is
// painted, each in the pipeline's own order:
//
//   nIn  [267031,267454) — a Box's borderStyle is dispatched when QPn reports it is not one of the
//        known border names: the prop leaves props, `onBorder(value)` sees it, and a hover that also
//        carries a borderStyle loses it. A value from the border table stays untouched. Only
//        Box/Text/Link children are walked, and a subtree is rebuilt only when a child changed.
//   dno  [270929,271294) — the engine drops a Box's `key` when xAt reports a problem with it (a
//        usable key stays), after the same identity-preserving walk. An engine node stops both
//        passes.
//   kur  [267903,268419) — a Link whose href tIn refuses becomes the Text eIn builds (its children,
//        else its label, else its displayed href); the problems are ordinal-numbered from 1 in draw
//        order and reported together only when at least one exists.
//   vur  [267454,267903) — a Code leaf is numbered from 1; one whose diff vVe refuses is reported
//        (path shortened by IL) and loses `format`/`startLine`, leaving the plain source.
//
// The helpers these four read (`xAt`, `ZAe`, `IL`, `Mrt`, `cN`, `rQt`, `vVe`) are imports from
// copies earlier packages landed; the plan in research/ports/W141-engine-draw-blocks.plan.json
// carries the exact block provenance.
import { nIn, dno, kur, vur } from './plugin-chain-engine-draw-source.js';

/** A tree node as the engine sees it. The copied walkers only read these fields. */
export interface DrawNode {
  type: string;
  props?: Record<string, unknown>;
  children?: unknown;
  hover?: Record<string, unknown>;
  [key: string]: unknown;
}

/** One link or Code problem, numbered from 1 in draw order. */
export interface DrawProblem {
  ordinal: number;
  problem: string;
  path?: string;
}

/** Source `nIn`: dispatch a Box borderStyle QPn flags, taking it out of props and hover. */
export function borderStyleIntoHover<T extends DrawNode>(tree: T, onBorder: (style: string) => void): T {
  return nIn(tree, onBorder) as T;
}

/** Source `dno`: drop a Box key xAt rejects; a usable key stays and other types are untouched. */
export function removeDrawnKey<T extends DrawNode>(tree: T): T {
  return dno(tree) as T;
}

/** Source `kur`: rewrite every Link the surface refuses into the Text `eIn` builds. */
export function validateLinks<T extends DrawNode>(
  tree: T,
  surface: string,
  onProblems: (problems: DrawProblem[]) => void,
): T {
  return kur(tree, surface, onProblems) as T;
}

/** Source `vur`: number Code leaves and strip a refused diff down to its source. */
export function measureCodeRows<T extends DrawNode>(
  tree: T,
  onProblems: (problem: DrawProblem) => void,
): T {
  return vur(tree, onProblems) as T;
}
