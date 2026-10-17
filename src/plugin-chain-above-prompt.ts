// The AbovePrompt pane's layout and key core (W145), the first slice of the pane the C-2 list
// named as unbound. The copied bodies live in ./plugin-chain-above-prompt-source.ts:
//
//   - `yne` [447421,447615): what the pane shows for a row budget and the tree's row count — the
//     window keeps one row for the cue when the tree overflows, and the body follows the settled
//     budget;
//   - `kne` [448698,448795), `NI` [448795,448921): the initial focus index and the key-context
//     name an Input/Select child raises;
//   - `G1` [448933,449175): the hotkey-to-press map a drawn tree carries, walked only through
//     non-Button, non-engine nodes;
//   - `Tne` [449175,449420), `F4` (chunk-1r9zp6s1.js [28549,28670)): whether every laid-out node
//     of the cue lies inside the window, measured from the content root;
//   - `_ne` [449420,449506): whether no content plugin is among a list of plugins;
//   - `vFe` [444350,444563), `pne` [447294,447421): the pane's scroll handlers and the merge that
//     adds them to the key bindings, aliasing the pane scroll actions to AbovePrompt next/previous;
//   - `wne` [448285,448295) 5 and `vne` [448921,448933) 150: the collapse-handle columns and the
//     row-settle debounce.
//
// The component that wires these to the renderer (`NFe` [456049,461905)) is the next slice; this
// one is pure so its semantics are testable without a terminal.
import {
  pne, yne, wne, kne, NI, vne, G1, Tne, _ne, vFe, F4,
} from './plugin-chain-above-prompt-source.js';

/** What the pane reads to size itself. */
export interface PaneWindowInput {
  budget: number;
  settledBudget: number;
  treeRows: number;
}

/** The pane's visible rows, overflow cue and body size. */
export interface PaneWindow {
  windowRows: number;
  hasCue: boolean;
  maxOffset: number;
  bodyRows: number;
}

/** Source `yne`: the pane window for a row budget and the tree's row count. */
export function paneWindow(input: PaneWindowInput): PaneWindow {
  return yne(input) as PaneWindow;
}

/** Source `kne`: the index of the first auto-focused child, or zero, or null for an empty list. */
export function autofocusIndex(items: readonly { isAutoFocus?: boolean }[]): number | null {
  return kne(items) as number | null;
}

/** Source `NI`: the key-context name an Input/Select child raises, else the fallback. */
export function promptContextName(element: { tag?: string } | null | undefined, fallback: string): string {
  return NI(element, fallback) as string;
}

/** Source `G1`: hotkey-to-press for every Button with a hotkey in a drawn tree. */
export function hotkeyBindings(tree?: unknown): Map<unknown, unknown> {
  return G1(tree) as Map<unknown, unknown>;
}

/** A laid-out node as `F4` reads it: a computed top and a parent chain. */
export interface LaidOutNode {
  parentNode?: LaidOutNode;
  yogaNode?: { getComputedTop(): number; getComputedHeight(): number };
}

/** Source `F4`: the node's top relative to `root`, or -1 when it is not a descendant. */
export function nodeTopWithin(node: LaidOutNode, root: LaidOutNode): number {
  return F4(node, root) as number;
}

/** What `Tne` reads about the cue. */
export interface CueInput {
  hasCue: boolean;
  content: LaidOutNode | null;
  offset: number;
  windowRows: number;
}

/** Source `Tne`: whether every laid-out cue node lies inside the visible window. */
export function cueFullyDrawn(input: CueInput, laidOut: ReadonlySet<LaidOutNode> | undefined): boolean {
  return Tne(input, laidOut) as boolean;
}

/** Source `_ne`: whether no content plugin appears among the plugins. */
export function pluginsOverlap(
  content: readonly { plugin: string }[],
  plugins: readonly { plugin: string }[],
): boolean {
  return _ne(content, plugins) as boolean;
}

/** The scroll callback `vFe` wraps. */
export type ScrollBy = (rows: number) => unknown;

/** What `vFe` needs to build the six pane scroll handlers. */
export interface ScrollConfig {
  bodyRows: number;
  contentRows: number;
  scrollBy: ScrollBy;
}

/** Source `vFe`: the pane's six scroll key handlers. */
export function scrollKeyHandlers(config: ScrollConfig): Record<string, () => unknown> {
  return vFe(config) as Record<string, () => unknown>;
}

/** Source `pne`: merge the pane scroll handlers into key bindings; inputs skip the aliases. */
export function paneKeyBindings(
  bindings: Record<string, unknown>,
  scroll: ScrollConfig,
  isInput: boolean,
): Record<string, unknown> {
  return pne(bindings, scroll, isInput) as Record<string, unknown>;
}

/** Source `wne`: the columns the collapse handle occupies. */
export const COLLAPSE_HANDLE_COLUMNS: number = wne;

/** Source `vne`: how long the pane waits before settling its rows. */
export const ROW_SETTLE_DEBOUNCE_MS: number = vne;
