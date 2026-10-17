// The pane scroll host and the `ui.scroll` dispatch (W157d). `RFe` owns one pane's offset: it
// follows the end while the reader stays there, clamps every move to the current max offset, and
// raises each person-initiated move through `xwt`. `xwt` runs the `ui.scroll` hook chain over the
// scroll site registered by the focus layer (`_z`/`ahe`) and falls back to the site's own commit
// (`PY`). The wheel helpers `wFe`/`vFe`, the key-row lookup `kFe` and the offset merge `PFe` are
// the companions the AbovePrompt and Pane components call.
//
// The copied bodies live in ./plugin-chain-pane-scroll-source.ts (RFe and xwt). The companions are
// exact copies of the same module/range in earlier packages and are reused: `wFe`/`j1`/`kFe`
// ([443631,443771), [443771,443978), [443978,444350)) and `xFe`/`W1`/`PFe` ([444923,444994),
// [446991,447122)) from ./plugin-chain-above-prompt-parts-source.ts; `vFe` ([444350,444563)) from
// ./plugin-chain-above-prompt-source.ts; `AFe`/`q1` from ./plugin-chain-above-prompt-local-source.ts.
// The `ui.scroll` chain pieces (`N5t`, `P0`, `fse`, `PY`) come from the existing dispatch seams.
//
// Source: chunk-24k7d6mw.js [444994,446991) 1,997 units (RFe);
// chunk-sfn1dbxq.js [476926,477331) 405 units (xwt) — zero-based UTF-16 half-open.
import { RFe, xwt } from './plugin-chain-pane-scroll-source.js';
import { PFe, kFe, wFe } from './plugin-chain-above-prompt-parts-source.js';
import { vFe } from './plugin-chain-above-prompt-source.js';

/** What `RFe` reads for one pane. `content` is the ref the key-row lookup walks. */
export interface PaneScrollInput {
  component: string;
  requestId: string;
  owner?: unknown;
  content: { current: unknown };
  bodyRows: number;
  contentRows: number;
  maxOffset: number;
}

/** The wheel options `wFe` derives from the pane's last layout: an event becomes a column/row
 *  pointer when it lands inside the cached layout, and undefined otherwise. */
export interface WheelPointerOptions {
  (event: { col?: number; row?: number }): { column: number; row: number } | undefined;
}

/** The scroll keys `vFe` maps for one pane. */
export interface ScrollKeyMap {
  'pane:scrollUp': () => void;
  'pane:scrollDown': () => void;
  'pane:pageUp': () => void;
  'pane:pageDown': () => void;
  'pane:top': () => void;
  'pane:bottom': () => void;
}

/** One `ui.scroll` request, as RFe raises it for a person's move. */
export interface ScrollDispatchRequest {
  input: {
    component: string;
    requestId: string;
    offset: number;
    by: number;
    bodyRows: number;
    contentRows: number;
    origin: { kind: string; name?: string };
    pointer?: unknown;
  };
  hookOrigin?: unknown;
  signal?: AbortSignal;
}

/** Source `xwt`: run the scroll hooks, then the site's own commit. `deny` names the reason the
 *  move was refused; its absence means the pane moved. */
export function dispatchScroll(request: ScrollDispatchRequest): Promise<{ deny?: string }> {
  return xwt(request) as Promise<{ deny?: string }>;
}

/** Source `RFe`: the pane scroll host. It returns the offset it settled on, the registry entry it
 *  registered, the raised version, the `scrollBy` the wheel handler calls and the `place` the
 *  registry hands to focus moves. */
export function paneScrollHost(input: PaneScrollInput): Record<string, unknown> {
  return RFe(input) as Record<string, unknown>;
}

/** Source `PFe`: merge the settled offset into the element's `scroll` prop. */
export function paneScrollProps(
  element: unknown,
  settled: { offset: number; raised: number },
): unknown {
  return PFe(element, settled) as unknown;
}

/** Source `wFe`: build the pointer options for the wheel handler from the pane's ref. */
export function wheelPointerOptions(ref: { current?: { cachedLayout?: unknown } | null }): WheelPointerOptions {
  return wFe(ref) as WheelPointerOptions;
}

/** Source `vFe`: the six scroll commands for one pane. */
export function scrollKeyMap(input: {
  bodyRows: number;
  contentRows: number;
  scrollBy: (rows: number) => void;
}): ScrollKeyMap {
  return vFe(input) as ScrollKeyMap;
}

/** Source `kFe`: the `{top, bottom}` rows of the element drawn under a key, or undefined. */
export function keyRows(
  node: unknown,
  elementKey: unknown,
  elementPlugin: unknown,
): { top: number; bottom: number } | undefined {
  return kFe(node, elementKey, elementPlugin) as { top: number; bottom: number } | undefined;
}
