// The wheel glue (W157c): the settings read that decides whether acceleration is on, the debug
// announcement, the state hook `AZ`, the event dispatch `CFe` and the handler factory `_Fe`.
//
// The copied bodies live in ./plugin-chain-wheel-glue-source.ts; the host facts they read are bound
// in ./plugin-chain-wheel-glue-host.ts, and the settings store itself is the product's
// ./plugin-chain-settings-store.ts (`fe`).
//
// Source: chunk-js2bhabe.js [777,1499) 722 units; chunk-z7whhrje.js [9339,9540) 201 units;
// chunk-24k7d6mw.js [126204,126611) 407, [126611,126843) 232, [444563,444675) 112 and
// [444845,444923) 78 units; chunk-wz8v981w.js [1438,1463) 25 units — zero-based UTF-16 half-open.
import {
  AZ,
  CFe,
  QO,
  _Fe,
  gbt,
  hs,
  mLr,
} from './plugin-chain-wheel-glue-source.js';
import type { JediTermWheelState, WheelState } from './plugin-chain-wheel-acceleration.js';

export {
  bindWheelSettingsHost,
  Gfe,
  type WheelSettingsHost,
} from './plugin-chain-wheel-glue-host.js';
export { bindSettingsStore, type SettingsStore } from './plugin-chain-settings-store.js';

/** Source `hs` answer: the winning value and where it came from. */
export interface SettingRead<T = unknown> {
  value: T;
  source: string;
}

/** Source `hs`: read `key` through the enabled source order, the legacy global config, then the
 *  fallback. */
export function readSetting<T>(key: string, fallback: T): SettingRead<T> {
  return hs(key, fallback) as SettingRead<T>;
}

/** Source `mLr`: whether the JetBrains command-block bug applies, latched on the wheel state. */
export function jbBugConfirmed(state: JediTermWheelState): boolean {
  return mLr(state as unknown as { bugConfirmed: boolean }) as boolean;
}

/** Source `gbt`: announce the chosen curve once and build the wheel state for the terminal. */
export function wheelStateFor(input: JediTermWheelState): WheelState {
  return gbt(input) as WheelState;
}

/** Source `AZ` result: one wheel event in, the rows it scrolls and the state that produced them. */
export interface WheelStepResult {
  rows: number;
  state: WheelState;
}

/** Source `AZ`: the per-render wheel state hook. Call it inside a component render; the returned
 *  function takes an event direction and a timestamp. */
export function useWheelState(): (direction: number, time: number) => WheelStepResult {
  return AZ() as unknown as (direction: number, time: number) => WheelStepResult;
}

/** Source `QO`: the internal stdin context's JediTerm field. */
export function useInternalJediTermInput(): { internal_jediTermInput: JediTermWheelState } {
  return QO() as { internal_jediTermInput: JediTermWheelState };
}

/** The event `CFe` reads. */
export interface WheelEventLike {
  deltaY: number;
  preventDefault(): void;
  stopPropagation(): void;
}

/** The scroll target `CFe` drives. */
export interface WheelScrollTarget {
  scrollBy(rows: number, options?: unknown): void;
}

/** Source `CFe`: one wheel event scrolls the target by the direction times the rows the state
 *  answered, then suppresses the terminal's own scroll. */
export function wheelDispatch(
  target: WheelScrollTarget,
  rows: (direction: number) => number,
  options: (event: WheelEventLike) => unknown,
): (event: WheelEventLike) => void {
  return CFe(target, rows, options) as (event: WheelEventLike) => void;
}

/** Source `_Fe`: the wheel handler for one scroll target — `AZ` in, `CFe` out. */
export function wheelHandler(
  target: WheelScrollTarget,
  options: (event: WheelEventLike) => unknown,
): (event: WheelEventLike) => void {
  return _Fe(target, options) as (event: WheelEventLike) => void;
}
