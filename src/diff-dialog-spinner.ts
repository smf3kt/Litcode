// The spinner (W171). Copied bodies live in three files:
//
//   - ./diff-dialog-spinner-source.ts        chunk-vew7ssxx.js [2002,2510) 508u (`Mr`), and
//     chunk-f7x3yeg4.js [26148,26747) 599u (`ui`) and [20212,20266) 54u (`mr`);
//   - ./diff-dialog-spinner-anim-source.ts   chunk-1r9zp6s1.js [22075,22541) 466u, [22541,22970)
//     429u and [22970,23354) 384u, plus [19734,19763) 29u; chunk-06azbynj.js [174030,174177) 147u
//     and [184065,184136) 71u; chunk-k1caxvem.js [876,975) 99u, [1257,1375) 118u and [1405,1497)
//     92u; chunk-z9nv3z8k.js [615,656) 41u;
//   - ./diff-dialog-spinner-frames-source.ts chunk-hyshef1z.js [661,1031) 370u.
//
// Total 14 blocks, 3,407 UTF-16 units. Host bindings live in ./diff-dialog-spinner-host.ts.
import {
  Io, LIe, N4, eg, ia, nt, vie, $e,
} from './diff-dialog-spinner-anim-source.js';
import { Mr, mr, ui } from './diff-dialog-spinner-source.js';
import { HIe, Vdn, d, f, l, p, T, y } from './diff-dialog-spinner-frames-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';

export interface SpinnerMessageProps {
  message: unknown;
  bold?: boolean;
  dimColor?: boolean;
  subtitle?: unknown;
}

/** Source `Mr`: the spinner glyph followed by its message, with an optional dim subtitle below. */
export function SpinnerMessage(props: SpinnerMessageProps): SurfaceElement {
  return Mr(props as never) as SurfaceElement;
}

/** Source `ui`: the spinner itself — a static dot under reduced motion or a screen reader,
 *  otherwise one frame of the animation cycle. */
export function Spinner(): SurfaceElement {
  return ui() as SurfaceElement;
}

/** Source `ia`: the animation clock. It returns the ref callback that starts measurement and the
 *  quantized frame time; a `null` interval pauses it. */
export function useAnimationFrame(interval?: number | null): [unknown, number] {
  return ia(interval as never) as [unknown, number];
}

/** Source `N4`: the visibility hook — the ref callback, the visible flag and the measured values. */
export function useVisibility(): [unknown, { isVisible: boolean }, boolean, boolean | null] {
  return N4() as never;
}

/** Source `$e`: whether the node's measured box is visible inside the terminal. */
export function isVisibleInViewport(node: unknown, viewport: unknown): boolean | null {
  return $e(node as never, viewport as never) as boolean | null;
}

/** Source `vie`: the scroll clamp the visibility test applies to ancestors. */
export function clampScroll(node: unknown): number | undefined {
  return vie(node as never) as number | undefined;
}

/** Source `HIe`: the frame cycle for the current terminal. */
export function spinnerFrames(): readonly string[] {
  return HIe() as readonly string[];
}

/** Source `Vdn`: the terminal-dependent non-reversed frame set picker. */
export const frameSetForTerminal = Vdn as () => readonly string[];

/** Source `mr`: the reduced-motion selector. */
export const reducedMotionSelector = mr as (state: { settings: { prefersReducedMotion: boolean } }) => boolean;

/** Source `eg`: the frame quantum in milliseconds. */
export const FRAME_QUANTUM = eg;

/** Source `Io` and `LIe`: the 480 ms repaint floor and its accessor. */
export const REPAINT_FLOOR = Io;
export const repaintInterval = LIe as (interval: number) => number;

/** The three frame sets and their reversed cycles. */
export const FRAME_SETS = { base: l, baseAlt: p, plain: T, cycles: d, cyclesAlt: f, cyclesPlain: y };

/** The copied bodies under their source names. */
export const SOURCE_BODIES = {
  Mr, ui, mr, ia, N4, $e, vie, HIe, Vdn, eg, Io, LIe, nt,
};
