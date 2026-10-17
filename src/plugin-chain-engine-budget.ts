// The engine's drawn-budget transforms and their noted-warning handlers, the second slice of the
// `gno` closure measured by W140. The copied bodies live in ./plugin-chain-engine-budget-source.ts;
// this module is the typed seam around them.
//
// Source, chunk-n3ykh62m.js (module digest 2a0e605d…), with three value helpers from
// chunk-nyce03br.js (digest 6a5164eb…). The slice is the path a rendered tree takes when the
// engine's own drawing budget decides how much of it reaches the terminal:
//
//   Rur  [270375,270825) — the budget state: six readings/writers over one counter pair, where a
//        held string spends only what fits, `field` spends through `ne`, and `shown` cuts at the
//        boundary, reports the tail once through `markOf`, and flips `isCut`.
//   Tur  [268980,270363) — the tree clip itself. Code/Markdown text goes through `shown`; a Client
//        whose key, module and props do not fit becomes an empty Text; Button/Select/Svg/Image/Input
//        and Box keys spend through the same budget; a Link whose href does not fit becomes an empty
//        Text; Box/Text/Link children are walked with identity preserved.
//   Nss  [270825,270929) — run `Tur` over one tree with a fresh budget and report `{written,drawn}`
//        only when anything was cut.
//   zss  [281200,281622) — clip a drawn tree's props against the input's props: a value is rewritten
//        only when it costs more than the original, own strings past OAt are replaced by the input's
//        value and reported through `own`, and a cut budget reports through `cut`.
//   Wss/Gss [280306,280532)/[280532,280596) — the two own-props/text-cut problem descriptions.
//   qss/Uss/Bss/iIn/pno/fIn — the noted-warning handlers: borderStyle, plain Code, plain Link, and
//        the plain `ui.render` problem lines, deduplicated through DAt's key and the terminal seam's
//        s5t/Iye.
//   DAt/JAe [_ur/Sur/bur/wur] — the dedupe key (module inventory + component + requestId + detail)
//        and the module descriptor (`load`/`lead`) the warning carries.
//
// The helpers this slice reads (`ZAe`, `IL`, `Nrt`, `y$`, `Q4t`, `cN`, `rQt`, `ESe`, `Ro`, `Dt`, `B`,
// `$A`, `ne`, `it`, `GPn`, `j3e`, `kAt`, `Iye`, `s5t`, `sIn`) are imports from copies earlier
// packages landed; the plan in research/ports/W142-engine-draw-budget-handlers.plan.json carries
// the exact block provenance.
import {
  Tur, Rur, Nss, zss, Wss, Gss, qss, Uss, Bss, DAt, JAe,
  _ur, Sur, bur, wur, iIn, pno, Dur, aIn, lIn, fIn, Cur, lno, n5t, cno,
  Aur, OAt, Mur, t5t, iD, eIt, Iws,
} from './plugin-chain-engine-budget-source.js';

/** A tree node as the engine sees it. The copied walkers only read these fields. */
export interface BudgetNode {
  type: string;
  props?: Record<string, unknown>;
  hover?: Record<string, unknown>;
  children?: unknown;
  [key: string]: unknown;
}

/** The input a `ui.render` handler is called with, as far as this slice reads it. */
export interface BudgetInput {
  component: string;
  requestId: string;
  surface: string;
  props?: Record<string, unknown>;
  [key: string]: unknown;
}

/** A budget's written/drawn counters. */
export interface DrawnCounts {
  written: number;
  drawn: number;
}

/** The drawn budget state built by `Rur`. */
export interface DrawnBudget {
  written(): number;
  drawn(): number;
  isCut(): boolean;
  isHeld(characters: number): boolean;
  markOf(characters: number): string;
  field(text: string): boolean;
  shown(text: string, separator: string): string;
}

/** One plain Code problem as the engine reports it. */
export interface PlainCodeProblem {
  ordinal: number;
  path?: string;
  problem: string;
}

/** One plain Link problem as the engine reports it. */
export interface PlainLinkProblem {
  ordinal: number;
  problem: string;
}

/** What `zss` reports while clipping props. */
export interface ClipSink {
  cut(report: DrawnCounts): void;
  own(names: string[]): void;
}

/** Source `Rur`: a fresh drawn budget. */
export function drawnBudget(): DrawnBudget {
  return Rur() as DrawnBudget;
}

/** Source `Tur`: clip one tree to the budget, preserving node identity where nothing changed. */
export function clipTreeToBudget<T extends BudgetNode>(tree: T, budget: DrawnBudget): T {
  return Tur(tree, budget) as T;
}

/** Source `Nss`: clip a tree with its own budget, reporting counters only when it cut something. */
export function clipDrawnTree<T extends BudgetNode>(tree: T, onCut: (counts: DrawnCounts) => void): T {
  return Nss(tree, onCut) as T;
}

/** Source `zss`: rewrite drawn props that cost more than the input's, reporting own/cut spend. */
export function clipDrawnProps<T extends BudgetNode>(
  tree: T,
  input: BudgetInput,
  sink: ClipSink,
): T {
  return zss(tree, input, sink) as T;
}

/** Source `DAt`: the dedupe key one noted warning is stored under. */
export function notedKey(input: BudgetInput, detail: string): string {
  return DAt(input, detail) as string;
}

/** Source `JAe`: the module descriptor (`load`/`lead`) a warning carries. */
export function moduleDescriptor(input: BudgetInput, origin?: readonly string[]): { load: string; lead: string } {
  return JAe(input, origin) as { load: string; lead: string };
}

/** Source `qss`: note a borderStyle the engine refused and drew without a border. */
export function noteBorderStyle(input: BudgetInput, style: unknown, origin?: readonly string[]): void {
  qss({ input, style, origin });
}

/** Source `Uss`: note a Code leaf drawn plain. */
export function notePlainCode(input: BudgetInput, drawnPlain: PlainCodeProblem, origin?: readonly string[]): void {
  Uss({ input, drawnPlain, origin });
}

/** Source `Bss`: note a Link drawn plain. */
export function notePlainLinks(input: BudgetInput, drawnPlain: PlainLinkProblem[], origin?: readonly string[]): void {
  Bss({ input, drawnPlain, origin });
}

/** Source `Wss`: note props rewritten because their own keys/strings exhausted the budget. */
export function noteOwnProps(input: BudgetInput, names: string[], origin?: readonly string[]): void {
  Wss({ input, names, origin });
}

/** Source `Gss`: note text drawn only up to its cut. */
export function noteTextCut(input: BudgetInput, clipped: DrawnCounts, origin?: readonly string[]): void {
  Gss({ input, clipped, origin });
}

/** Source `iIn`: note a detail under the input's own key with the descriptor's lead. */
export function noteDetail(input: BudgetInput, detail: string, text: string, origin?: readonly string[]): void {
  iIn({ input, origin }, detail, text);
}

export const borderProblem = fIn as (style: unknown) => string;
export const plainCodeLead = _ur as (problem: PlainCodeProblem) => string;
export const plainCodeProblem = Sur as (problem: PlainCodeProblem) => string;
export const plainLinkLead = bur as (problems: PlainLinkProblem[]) => string;
export const plainLinkProblem = wur as (problems: PlainLinkProblem[]) => string;
export const textCutLine = pno as (component: string, counts: DrawnCounts) => string;
export const charactersUnder = Dur as (value: unknown) => number;
export const propCost = aIn as (value: unknown, depth: number) => number;
export const clipPropValue = lIn as (value: unknown, budget: DrawnBudget) => unknown;
export const textFallback = Cur as (node: BudgetNode, strings: string[], budget: DrawnBudget) => BudgetNode;
export const clipNamedProps = lno as (node: BudgetNode, names: string[], budget: DrawnBudget) => BudgetNode;
export const clipSelectedProps = n5t as (props: Record<string, unknown>, names: string[], budget: DrawnBudget) => Record<string, unknown>;
export const dropUnfitKey = cno as (node: BudgetNode, budget: DrawnBudget) => BudgetNode;
export const cutTail = Aur as (characters: number, separator: string) => string;
export const DRAWN_LIMIT = OAt;
export const VALUE_LIMIT = Mur;
export const PROBLEM_LIMIT = t5t;
export const copyList = iD as <T>(list: ArrayLike<T>) => T[];
export const stringsUnder = eIt as (value: unknown) => string[];
export const clientPropsCost = Iws as (props: unknown) => number;
