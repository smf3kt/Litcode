// The wheel acceleration curve (W157a). Copied bodies live in
// ./plugin-chain-wheel-acceleration-source.ts:
//
//   - chunk-z7whhrje.js [9007,9133) 126 units — `tgt`, the JediTerm wheel state factory;
//   - chunk-z7whhrje.js [9266,9339) 73 units — `VNo`, take and clear the pending arrow boost;
//   - chunk-z7whhrje.js [9540,9565) 25 units — the JediTerm bypass window `gLr`;
//   - chunk-24k7d6mw.js [124024,124140) 116 units — the window/flood constants;
//   - chunk-24k7d6mw.js [124299,124336) 37 units — the decay-curve constants;
//   - chunk-24k7d6mw.js [124336,126011) 1,675 units — `pbt`, one wheel step;
//   - chunk-24k7d6mw.js [126011,126204) 193 units — `fbt`, the state factory.
//
// Total 7 blocks, 2,245 UTF-16 units. The bodies are pure: `pbt` takes the state, the direction and
// the event time and answers the number of rows; `fbt` builds the state. The platform probe `uq`,
// the setting read `hs` and the acceleration wrapper `gbt`/`AZ`/`_Fe` are the next W157 step, where
// the host supplies the environment and the setting value.
import { tgt, fbt, pbt, VNo } from './plugin-chain-wheel-acceleration-source.js';

/** The JediTerm wheel state `tgt` builds. */
export interface JediTermWheelState {
  lastWheelTime: number;
  lastWheelDownTime: number;
  bugConfirmed: boolean;
  notified: boolean;
  trackpadGesture: boolean;
  pendingArrowBoost: number;
}

/** The wheel state `fbt` builds and `pbt` advances. */
export interface WheelState {
  time: number;
  mult: number;
  dir: number;
  useDecayCurve: boolean;
  frac: number;
  base: number;
  pendingFlip: boolean;
  wheelMode: boolean;
  burstCount: number;
  jbBypass: boolean;
  jediTerm: JediTermWheelState;
  wheelFlood: boolean;
  accelEnabled: boolean;
}

/** What `createWheelState` may override; the source's defaults stand for the rest. */
export interface WheelStateOptions {
  useDecayCurve?: boolean;
  base?: number;
  wheelFlood?: boolean;
  accelEnabled?: boolean;
  jediTerm?: JediTermWheelState;
}

/** Source `tgt`: the JediTerm wheel state. */
export function newJediTermWheelState(): JediTermWheelState {
  return tgt() as JediTermWheelState;
}

/** Source `fbt`: build the wheel state. Defaults are the source's: window mode, base 1, no flood,
 *  acceleration on, a fresh JediTerm state. */
export function createWheelState(options: WheelStateOptions = {}): WheelState {
  return fbt(
    options.useDecayCurve,
    options.base,
    options.wheelFlood,
    options.accelEnabled,
    options.jediTerm ?? (tgt() as JediTermWheelState),
  ) as WheelState;
}

/** Source `pbt`: advance one wheel event and answer the rows to scroll. `direction` is -1 for up
 *  and 1 for down; `time` is the event time in milliseconds. */
export function wheelStep(state: WheelState, direction: number, time: number): number {
  return pbt(state, direction, time) as number;
}

/** Source `VNo`: take the pending arrow boost and clear it. */
export function takeArrowBoost(state: JediTermWheelState): number {
  return VNo(state) as number;
}
