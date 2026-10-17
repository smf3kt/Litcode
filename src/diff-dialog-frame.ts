// The DiffDialog frame (W170). Copied bodies live in five files:
//
//   - ./diff-dialog-frame-source.ts       chunk-g6j4g5k0.js [1411,6669) 5,258u and [6669,9123)
//     2,454u — the keybinding description table, the auto-hint component and builder, and `_e`, the
//     dialog frame itself;
//   - ./diff-dialog-frame-keys-source.ts  chunk-6ccen3s8.js [35388,35924) 536u — `Boo`, `e0n`, `yn`;
//   - ./diff-dialog-frame-scope-source.ts chunk-apky5tj5.js [935,2776) 1,841u plus chunk-06azbynj.js
//     [135432,135508) 76u and [135508,135682) 174u — the scope context, `ov`, `IU` and `ix`;
//   - ./diff-dialog-frame-exit-source.ts  chunk-9pedrxny.js [1035,1612) 577u and chunk-am9mebpw.js
//     [1553,1918) 365u — `Dmt` and the two-press gesture `iq`;
//   - ./diff-dialog-frame-box-source.ts   chunk-h26phfc2.js [849,1339) 490u — `es`, the border.
//
// Total 10 blocks, 11,875 UTF-16 units. Host bindings live in ./diff-dialog-frame-host.ts. The frame
// reads the tab viewport context from W169, the focus and keybinding contexts from the press-button
// source, and the hint/chord helpers from W166/W167.
import {
  Be, Ie, Ke, Oe, W, Ys, _e, fe, ie, me, zo,
} from './diff-dialog-frame-source.js';
import { Dmt } from './diff-dialog-frame-exit-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';

export interface DialogFrameProps {
  title: unknown;
  titleEnd?: unknown;
  subtitle?: unknown;
  children?: unknown;
  onCancel?: () => void;
  color?: string;
  hideInputGuide?: boolean;
  hideBorder?: boolean;
  inputGuide?: unknown;
  isCancelActive?: boolean;
  onInterrupt?: () => void;
  exitOnCtrlCD?: boolean;
}

export interface AutoHintProps {
  boundary?: { current: unknown };
  fallback?: unknown;
  order?: readonly string[];
  omit?: readonly string[];
  max?: number;
  maxWidth?: number;
}

export interface ExitEntriesOptions {
  onCancel?: () => void;
  onInterrupt?: () => void;
  isCancelActive?: boolean;
}

/** Source `_e`: the dialog frame — title and subtitle, cancel and interrupt entries, the measured
 *  header height, the viewport inset, the input guide, and the bordered focus scope. */
export function DialogFrame(props: DialogFrameProps): SurfaceElement {
  return _e(props as never) as SurfaceElement;
}

/** Source `ie`: the auto hint line — the boundary's bindings rendered as chord hints, or the
 *  fallback when nothing is bound. */
export function AutoHint(props: AutoHintProps): SurfaceElement | null {
  return ie(props as never) as SurfaceElement | null;
}

/** Source `Be`: the hint builder — walks the rendered scope chain and returns the hint text. */
export function buildHints(args: {
  ctx: unknown;
  activeElement: unknown;
  boundaryNode: unknown;
  rendered: unknown;
  order?: readonly string[];
  omit?: readonly string[];
  max?: number;
  maxWidth?: number;
}): { fellBack: boolean; text: string; hadEntryWithoutDescription: boolean } {
  return Be(args as never) as { fellBack: boolean; text: string; hadEntryWithoutDescription: boolean };
}

/** Source `Dmt`: the interrupt and exit entries with the pending exit state. */
export function useExitEntries(options: ExitEntriesOptions): {
  entries: { action: string; run: () => void }[];
  exitState: { pending: boolean; keyName: string | null };
} {
  return Dmt(options.onCancel, options.onInterrupt, options.isCancelActive) as never;
}

/** Source `Ke`: the descriptions the recovered action table gives each action. */
export const keybindingDescriptions = Ke as Record<string, { description: string } | undefined>;

/** Source `fe`: one action's description, with `command:` names taking their own text. */
export function keyDescription(action: string): { description: string } | undefined {
  return fe(action) as { description: string } | undefined;
}

/** Source `W`: the default cancel hint — Enter confirms, Esc cancels. */
export const cancelHint = W;

/** Source `Ie`: the default hint count. */
export const HINT_LIMIT = Ie;

/** Source `Oe`: the grouped action pairs that render as one shared hint. */
export const HINT_PAIRS = Oe;

/** The copied bodies under their source names. */
export const SOURCE_BODIES = {
  _e, ie, Be, me, Ke, fe, W, Ie, Oe, zo, Ys, Dmt,
};
