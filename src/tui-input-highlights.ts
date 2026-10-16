// The composer's prompt highlights: every producer that fills the input's `highlights` prop, the order
// they are pushed in, and the two rules that decide whether the overlay runs at all.
//
// Ported from the composer in chunk-24k7d6mw.js
// (sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31), zero-based UTF-16 ranges,
// one unit = one UTF-16 code unit:
//   the span assembly   [824770,825761)  991 units  sha256 939a02777167c07e49fa52464862c31ab774cb4db4d1d01fa8489d3937ac16c7
//   the overlay call    [826091,826184)   93 units  sha256 39816ec5c84dd3ad49775793f3b89264845b8bc47524be71473fb6fdef1860d9
//
// The producers are copied bodies in ./tui-input-highlights-source.ts: `YIt` and `fB` with the two
// rainbow palettes (ultrathink), `d3n` with its pattern (the `/btw` notice), `vMe` (slash-command runs),
// `Art` over `Qp`/`IE` (the workflow keyword), `j5r` (the spread producer, empty in this build), `ewe`
// (the caret highlight's width unit) and `pue` (the mark merge). The overlay `w9r` and the row mapping
// are the copied bodies in ./plugin-chain-decorations-source.ts.
//
// Names. The assembly is ported with readable names, each standing for the composer's own local:
//   Zd spans   wc merged   Ct isSearchingHistory   Mt historyMatch   Ft historyFailedMatch
//   Pt historyQuery   vn caret   Al warnings   Bd commands   pu mcpMentions   Iu teammateMentions
//   Nn ghost   Zr ultrathink   Sl ultraplan   Pi ultracode   bl spread   ai marks
//   fi value   Io renderedValue   Bn runs   ec caretActive   Goe() ultrathink gate   vz() ultraplan gate
//   dg()&&!Zi workflowKeyword gate
//
// The three gates are host configuration in the source, so they arrive as inputs. Their defaults are the
// source's own: `Goe()` is `k("tengu_turtle_carbon", !0)` and so is on, `vz()` needs the ultraplan flag
// and so is off. The `dg()&&!Zi` pair belongs to the workflow-keyword UI (its alt+w toggle and the
// `tengu_workflow_keyword_dismiss` notice), which this product does not carry, so its call site passes
// the gate off; the keyword runs themselves are copied and one flag away.
//
// A span's `shimmerColor` is the source's animated variant of its color. `w9r` clears it when a chain run
// supplies a color, and the input's glimmer path is what reads it; this product renders the static
// `color` only, the same divergence ./tui-input-decorations.ts records for the painted runs.
import { Art, d3n, ewe, fB, j5r, pue, vMe, YIt } from './tui-input-highlights-source.js';
import { w9r } from './plugin-chain-decorations-source.js';
import type { DecorationRun } from './tui-input-decorations.js';

/** A highlight span as the composer pushes it, before `pue` merges the marks in. */
export interface HighlightSpan extends DecorationRun {
  /** The animated variant of `color`, read by the input's glimmer path. */
  shimmerColor?: string;
}

/** One teammate mention: the source carries the theme color the teammate was given. */
export interface TeammateMention {
  start: number;
  end: number;
  themeColor?: string;
}

/**
 * The composer's own inputs. `value` is the text the highlights are matched against and `caret` an offset
 * in it; both live in the input store's value coordinates, the same ones the input's chain runs use.
 * `storeValue` is the store's own value (`Io`), which `value` matches except while a history search shows
 * a matched entry instead.
 */
export interface ComposerHighlightInput {
  value: string;
  caret: number;
  storeValue: string;
  isModalOverlayActive?: boolean;
  isSearchingHistory?: boolean;
  historyQuery?: string;
  historyMatch?: boolean;
  historyFailedMatch?: boolean;
  /** `kye(name, Jn)`: whether the draft's `/name` is a command this host knows. */
  knownCommand?: (name: string) => boolean;
  mcpMentions?: readonly DecorationRun[];
  teammateMentions?: readonly TeammateMention[];
  ghost?: { start: number; end: number } | null;
  ultraplan?: readonly DecorationRun[];
  marks?: readonly DecorationRun[];
  /** `Goe()`: the ultrathink rainbow. On by default, as the source's flag reads. */
  ultrathink?: boolean;
  /** `dg() && !Zi`: the workflow keyword's autoAccept run. */
  workflowKeyword?: boolean;
}

/**
 * The slash-command runs whose name this host knows (`vMe`, then the composer's own filter).
 */
function commandRuns(value: string, knownCommand: (name: string) => boolean): readonly DecorationRun[] {
  return (vMe(value) as readonly { start: number; end: number }[]).filter(run => knownCommand(value.slice(run.start + 1, run.end)));
}

/**
 * The span list the composer builds, after `pue` merges the marks in. Order is the source's: the history
 * search's query notice, the `/btw` notice, commands, MCP mentions, teammate mentions, ghost text, the
 * ultrathink rainbow, the spread runs, the ultraplan rainbow, the workflow keyword.
 */
export function composerBaseSpans(input: ComposerHighlightInput): readonly HighlightSpan[] {
  const caret = input.caret;
  const spans: HighlightSpan[] = [];
  if (input.isSearchingHistory && input.historyMatch && !input.historyFailedMatch) {
    spans.push({ start: caret, end: caret + (input.historyQuery ?? '').length, color: 'warning', priority: 20 });
  }
  for (const warning of d3n(input.value) as readonly DecorationRun[]) {
    spans.push({ start: warning.start, end: warning.end, color: 'warning', priority: 15 });
  }
  for (const command of commandRuns(input.value, input.knownCommand ?? (() => false))) {
    spans.push({ start: command.start, end: command.end, color: 'suggestion', priority: 5 });
  }
  for (const mention of input.mcpMentions ?? []) {
    spans.push({ start: mention.start, end: mention.end, color: 'suggestion', priority: 5 });
  }
  for (const mention of input.teammateMentions ?? []) {
    spans.push({ start: mention.start, end: mention.end, color: mention.themeColor, priority: 5 });
  }
  const ghost = input.ghost;
  if (ghost) spans.push({ start: ghost.start, end: ghost.end, color: undefined, dimColor: true, priority: 1 });
  if (input.ultrathink ?? true) {
    for (const run of YIt(input.value) as readonly DecorationRun[]) {
      for (let at = run.start; at < run.end; at += 1) {
        spans.push({ start: at, end: at + 1, color: fB(at - run.start), shimmerColor: fB(at - run.start, true), priority: 10 });
      }
    }
  }
  spans.push(...(j5r(input.value) as readonly DecorationRun[]));
  if (input.ultraplan) {
    for (const run of input.ultraplan) {
      for (let at = run.start; at < run.end; at += 1) {
        spans.push({ start: at, end: at + 1, color: fB(at - run.start), shimmerColor: fB(at - run.start, true), priority: 10 });
      }
    }
  }
  if (input.workflowKeyword) {
    for (const run of Art(input.value) as readonly DecorationRun[]) {
      for (let at = run.start; at < run.end; at += 1) spans.push({ start: at, end: at + 1, color: 'autoAccept', priority: 10 });
    }
  }
  return pue(spans, input.marks ?? []) as readonly HighlightSpan[];
}

/**
 * The `highlights` prop: the base spans, overlaid with the chain's runs unless the input is in the state
 * where the source hands the base spans over untouched (no runs, a history search, or a match value that
 * is not the rendered value). The overlay drops the base span holding the caret when the caret highlight
 * is active, and cuts that one cell out of it.
 */
export function composerHighlights(input: ComposerHighlightInput, runs: readonly DecorationRun[]): readonly HighlightSpan[] {
  const base = composerBaseSpans(input);
  if (runs.length === 0 || input.isSearchingHistory || input.value !== input.storeValue) return base;
  const caretActive = !input.isModalOverlayActive && !input.isSearchingHistory;
  const caretRange = caretActive
    ? { start: input.caret, end: input.caret + ewe(input.storeValue.slice(input.caret)).length }
    : undefined;
  return w9r(base, runs, caretRange) as readonly HighlightSpan[];
}
