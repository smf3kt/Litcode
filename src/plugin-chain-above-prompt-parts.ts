// The AbovePrompt pane's content and chrome components (W146), the second C-2 slice after the pure
// layout core. Copied bodies live in ./plugin-chain-above-prompt-parts-source.ts (chunk-24k7d6mw.js,
// 16 blocks, 2,722 UTF-16 units):
//
//   wFe [443631,443771)  wheel point from a cached layout;
//   j1  [443771,443978)  held node's top or bottom edge within the content;
//   kFe [443978,444350)  bounds of the first descendant with a matching element key;
//   TFe [444675,444845)  content wrapper: negative top margin plus the columns context;
//   xFe [444923,444956), W1 [444956,444994)  props merge and floor clamp;
//   PFe [446991,447122)  props with the scroll offset replaced (memoized);
//   OI  [447619,448084)  toggle label: click box + action box, blurs the focus on click;
//   b0  [448084,448093), bne [448093,448285)  the collapse icon flag and handle (`[-]`, absolute);
//   K1  [448295,448698)  hidden-panel header (`▸ plugin panel hidden · <shortcut> or click to show`);
//   w0  [449506,449633)  the next focus index;
//   z1  [449633,449682), Y1 [449682,449785), J1 [449785,450018)  list rows, the `↑ n more · ↓ m more`
//       text and its Text component;
//   Rne [450018,450068)  run a digit's select action when its validity check passes.
//
// The source's module namespace `Sc` is chunk-kjfwbh4w's export table; the one entry OI reads,
// `releaseInkFocus`, is surfaced by ./plugin-chain-press-button.ts under that export name, so the
// copied call `Sc.releaseInkFocus(…)` keeps its shape without rewriting the body.
import {
  wFe, j1, kFe, TFe, xFe, W1, PFe, w0, z1, Y1, J1, Rne, bne, K1, OI, b0,
} from './plugin-chain-above-prompt-parts-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';

/** A laid-out node as the source reads it: attributes, children and a yoga box. */
export interface LaidNode {
  nodeName?: string;
  attributes?: Record<string, unknown>;
  childNodes?: LaidNode[];
  parentNode?: LaidNode;
  yogaNode?: { getComputedTop(): number; getComputedHeight(): number };
}

/** A ref to a node whose cached layout the wheel handler maps against. */
export interface LayoutRef {
  current?: { cachedLayout?: { x: number; y: number } } | null;
}

/** What a wheel event carries for the mapping. */
export interface WheelPointEvent {
  col?: number;
  row?: number;
}

/** Source `wFe`: a wheel event's point relative to the cached layout, when both exist. */
export function wheelPointFromLayout(
  ref: LayoutRef,
): (event: WheelPointEvent) => { column: number; row: number } | undefined {
  return wFe(ref) as (event: WheelPointEvent) => { column: number; row: number } | undefined;
}

/** What `j1` reads about the held node. */
export interface HeldNode {
  index: number;
  node: LaidNode;
}

/** Source `j1`: the held node's top edge, its bottom edge, or -1 when it is not the held one. */
export function heldEdgeTop(
  held: HeldNode | null,
  content: LaidNode | null,
  edge: 'top' | 'bottom',
  index: number | null,
): number {
  return j1({ held, index, content }, edge) as number;
}

/** Source `kFe`: the first non-root descendant with `elementKey` (and plugin, when given). */
export function elementKeyBounds(
  root: LaidNode,
  elementKey: string,
  plugin?: string,
): { top: number; bottom: number } | undefined {
  return kFe(root, elementKey, plugin) as { top: number; bottom: number } | undefined;
}

/** Props of the content wrapper. */
export interface ContentWrapperProps {
  content: unknown;
  offset: number;
  keptColumns: number;
  columns: unknown;
  children: unknown;
}

/** Source `TFe`: the pane content wrapper. */
export function AbovePromptContent(props: ContentWrapperProps): SurfaceElement {
  return TFe(props) as SurfaceElement;
}

/** Source `xFe`: shallow merge, second wins. */
export function mergeProps(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
  return xFe(base, extra) as Record<string, unknown>;
}

/** Source `W1`: floor, clamped at zero. */
export function floorClamp(value: number): number {
  return W1(value) as number;
}

/** A drawn input whose scroll offset the wrapper replaces. */
export interface ScrollPropsInput {
  props: { scroll?: Record<string, unknown>; [key: string]: unknown };
  [key: string]: unknown;
}

/** Source `PFe`: the input with `props.scroll.offset` replaced, memoized on the input and raised tag. */
export function raisedScrollProps(input: ScrollPropsInput, offset: number, raised: unknown): ScrollPropsInput {
  return PFe(input, { offset, raised }) as ScrollPropsInput;
}

/** Props of the toggle label. */
export interface ToggleLabelProps {
  label: string;
  onAction: () => void;
  isHeld?: boolean;
}

/** Source `OI`: the toggle label. */
export function toggleLabel(props: ToggleLabelProps): SurfaceElement {
  return OI(props) as SurfaceElement;
}

/** Source `b0`: the collapse icon's absolute offset. */
export const COLLAPSE_ICON_FLAG: number = b0;

/** Props of the collapse handle. */
export interface CollapseHandleProps {
  onCollapse: () => void;
}

/** Source `bne`: the absolute `[-]` collapse handle. */
export function CollapseHandle(props: CollapseHandleProps): SurfaceElement {
  return bne(props) as SurfaceElement;
}

/** Props of the hidden-panel header. */
export interface ExpandedHeaderProps {
  shortcut: string;
  onExpand: () => void;
}

/** Source `K1`: the hidden-panel header. */
export function ExpandedHeader(props: ExpandedHeaderProps): SurfaceElement {
  return K1(props) as SurfaceElement;
}

/** Source `w0`: the next focus index, the band marker, zero, or null. */
export function nextFocusIndex(input: { focus: unknown; count: number }): number | 'band' | null {
  return w0(input) as number | 'band' | null;
}

/** Source `z1`: the list row count for a value (0 when the value is null). */
export function listRowsOf(value: unknown, options: unknown): number {
  return z1(value, options) as number;
}

/** Source `Y1`: the `↑ n more · ↓ m more` indicator text. */
export function moreIndicatorText(above: number, below: number): string {
  return Y1(above, below) as string;
}

/** Props of the more indicator. */
export interface MoreIndicatorProps {
  above: number;
  below: number;
}

/** Source `J1`: the more indicator as a dim Text. */
export function MoreIndicator(props: MoreIndicatorProps): SurfaceElement {
  return J1(props) as SurfaceElement;
}

/** Source `Rne`: when the node exists and its check passes, run the action and press the node. */
export function selectByDigit(
  node: { plugin: string; handle: string } | undefined,
  isValid: () => boolean,
  onDigit: () => void,
): void {
  Rne(node, isValid, onDigit);
}
