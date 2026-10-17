// The DiffDialog key hints (W167). Copied bodies live in ./diff-dialog-keyhint-source.ts:
//
//   - chunk-6ccen3s8.js [9546,10191)       645 units — `je`/`de`/`E1`, key records to display text;
//   - chunk-6ccen3s8.js [35212,35388)      176 units — `A9t`, the chord bound to an action;
//   - chunk-6ccen3s8.js [35924,36074)      150 units — `Ke`, the duplicate-binding test;
//   - chunk-6ccen3s8.js [36598,36731)      133 units — `V`, chord equality;
//   - chunk-6ccen3s8.js [37204,37333)      129 units — `eLe`, key-record equality;
//   - chunk-z3f0m1q8.js [771,1001)         230 units — `ma`, the display text and fallback event;
//   - chunk-nh8hd3rr.js [800,1044)         244 units — `pt`, the key hint component;
//   - chunk-fz2251t0.js [867,1269)         402 units — `y`/`C`/`Se`, the hint strip.
//
// Total 8 blocks, 2,109 UTF-16 units. `Lc` is reused from the press-button seam, `z` from W166, and
// `vot` from the AbovePrompt host seam. The React fragment and early-return sentinel the strip
// returns are host symbols in ./plugin-chain-react-surface.ts.
import { A9t, E1, Ke, Se, V, de, eLe, je, ma, pt } from './diff-dialog-keyhint-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';
import type { KeyBindingRecord } from './plugin-chain-keys-editor.js';

export type { KeyBindingRecord };

/** One flattened binding: the chord records `ma` looks up by action and context. */
export interface KeybindingRecord {
  action: string;
  context: string;
  chord: KeyBindingRecord[];
}

export interface KeyHintProps {
  action: string;
  context: string;
  fallback: string;
  description?: string;
  parens?: boolean;
  bold?: boolean;
}

export interface HintStripProps {
  children?: unknown;
}

/** Source `ma`: the chord bound to `action` in `context`, `fallback` when unbound, and `""` when a
 *  later duplicate binding shadows the action. An unbound action reports one fallback event. */
export function keyDisplay(action: string, context: string, fallback: string): string {
  return ma(action, context, fallback) as string;
}

/** Source `pt`: the resolved chord rendered through the W166 chord hint. */
export function KeyHint(props: KeyHintProps): unknown {
  return pt(props as never);
}

/** Source `Se`: the hint children joined by a dim middle dot, or null when every child is empty. */
export function HintStrip(props: HintStripProps): SurfaceElement | null {
  return Se(props as never) as SurfaceElement | null;
}

/** The copied bodies under their source names. */
export const SOURCE_BODIES = { je, de, E1, A9t, Ke, V, eLe, ma, pt, Se };
