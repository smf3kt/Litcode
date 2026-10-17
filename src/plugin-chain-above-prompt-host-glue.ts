// The AbovePrompt host-glue seam (W155). Copied bodies live in
// ./plugin-chain-above-prompt-host-glue-source.ts:
//
//   - chunk-ejnyhzsc.js [668,697) 29 units — `QY`/`Mmt`, the two host context tokens;
//   - chunk-pxjy4t8j.js [1298,1856) 558 units — `sa`, the active-overlay registration;
//   - chunk-t8vb436n.js [764,975) 211 units — `us`, the keybinding display text.
//
// Total 3 blocks, 798 UTF-16 units. `F` (the frame invalidator) and `vot` (the fallback event) are
// host bindings in ./plugin-chain-above-prompt-host.ts; the app state context `sx` and the
// keybinding service `Lc` are reused from their seams.
import { QY, sa, us } from './plugin-chain-above-prompt-host-glue-source.js';
import type { SurfaceContext } from './plugin-chain-react-hooks.js';

/** Source `QY`: the host's pane measurement getter (`() => number | null`). A render mounts the
 *  value; the AbovePrompt body calls it to read the pane's drawn height. */
export const paneMeasureContext = QY as SurfaceContext<(() => number | null) | null>;

/** Source `sa`: register an active overlay in the app state while mounted and active, and discard
 *  the previous frame at the moment it becomes active. */
export function useActiveOverlay(name: string, active = true): void {
  sa(name, active);
}

/** Source `us`: the keybinding's display text for an action and context, or `fallback` when no
 *  service is mounted. The source reports the fallback once (reason `action_not_found` when the
 *  service exists, `no_context` when it does not) and answers `""` for an action the service
 *  renders as keyless. */
export function keyDisplayText(action: string, context: string, fallback: string): string {
  return us(action, context, fallback) as string;
}

export { bindPrevFrameInvalidator } from './plugin-chain-above-prompt-host.js';
