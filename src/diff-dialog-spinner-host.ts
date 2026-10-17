// The spinner's host bindings (W171). Three recovered names reach surfaces this build does not
// keep:
//
//   - `bg` (chunk-r0g20c30.js sha256 fc765811…, [755,823) 68u, body dac8fea5…) returns true for a
//     truthy setting and otherwise consults the remote `tengu_cedar_marsh` gate. The product keeps
//     local features only, so `bg` returns the setting itself.
//   - `Wo` (chunk-7n39kxwj.js sha256 d61cd8ea…, [1540,1576) 36u, body d9532139…) applies a selector
//     to the app state. `SpinnerSettings` is the local settings context `Wo` selects from.
//   - `a` is the environment object `HIe` and `LIe` read (`TERM`, and the full-repaint flag).
import { Ae, qt } from './plugin-chain-react-hooks.js';

export interface SpinnerSettingsState {
  settings: { prefersReducedMotion: boolean };
}

/** The local app-state slice the reduced-motion selector reads. */
export const SpinnerSettings = qt<SpinnerSettingsState>({
  settings: { prefersReducedMotion: false },
});

/** Source `Wo`: apply the selector to the mounted settings state. */
export function Wo<T>(selector: (state: SpinnerSettingsState) => T): T {
  return selector(Ae(SpinnerSettings));
}

/** Source `bg`: reduced motion when the setting is on; the remote gate is not part of this build. */
export function bg(value: unknown): boolean {
  return Boolean(value);
}

function envBool(name: string): boolean {
  const raw = process.env[name];
  if (raw === undefined) return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

/** The two environment reads the animation clock and the frame picker make. */
export const a = {
  TERM: process.env.TERM ?? '',
  CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT: envBool('CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT'),
};
