// The dialog frame's host bindings (W170). Three recovered names reach product surfaces this build
// does not keep:
//
//   - `g` (chunk-2hb5361r.js [5466,5529) 63u, body 7320b43f…): the feature_ok analytics event.
//   - `f` (chunk-2hb5361r.js [5613,5697) 84u, body ecce759d…): the feature_sad analytics event.
//   - `_` (chunk-gyf58rwf.js [59764,59848) 84u, body a18934a7…): a Bun `ih` tagged-template
//     JSON.stringify. `stableKey` keeps the observable contract, plain JSON.stringify.
//
// `ik` (chunk-nhnx1tam.js [661,728) 67u, body 1597bf97…) reads a boolean environment flag;
// `keyboardCohesion` parses the same variable. `bC` (chunk-1r9zp6s1.js [23358,23383), body
// cec7fe1c…) is `Ae(Zy)`, the app context the dialog reads `exit` from. `Xa` (chunk-1r9zp6s1.js
// [24240,24273) 33u, body f2dee87c…) is `Ae(b4n) ?? Date.now()`; the product's clock context is
// `eE`, and the fallback is the same.
import { Ae } from './plugin-chain-react-hooks.js';
import { eE } from './plugin-chain-markdown-host.js';
import { Zy } from './plugin-chain-press-button-source.js';

/** Source `g`: the recovered body reports a feature success; local builds keep no telemetry. */
export function noteFeatureOk(_name: string, _props?: unknown): void {}

/** Source `f`: the recovered body reports a feature failure; local builds keep no telemetry. */
export function noteFeatureSad(_name: string, _code?: unknown, _props?: unknown): void {}

/** Source `_`: the JSON serialization the scope uses as its handler dependency key. */
export function stableKey(value: unknown, replacer?: unknown, space?: unknown): string {
  return JSON.stringify(value, replacer as never, space as never);
}

/** Source `ik`: the environment flag that keeps keybinding chords cohesive across scopes. */
export function keyboardCohesion(): boolean {
  const raw = process.env.CLAUDE_CODE_KB_COHESION_FIXES;
  if (raw === undefined) return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/** Source `bC`: the app context whose `exit` the cancel gesture resolves when no callback is given. */
export function focusExit(): { exit?: () => void } {
  return Ae(Zy) as unknown as { exit?: () => void };
}

/** Source `Xa`: the source returns a clock *function* (`Ae(b4n) ?? Uo`, where `Uo` is the Date.now
 *  function), and the gesture calls it per press. The product's mounted clock is `eE`; when it is
 *  absent the returned function falls back to Date.now at call time, as the source does. */
export function now(): () => number {
  const clock = Ae(eE);
  return clock === null || clock === undefined ? Date.now : () => clock.now();
}
