// Host bindings for the AbovePrompt host-glue seam (W155).
//
// Source `F` (chunk-pxjy4t8j.js [774,842) 68 units) is
//   `function F(){return oi().get(process.stdout)?.invalidatePrevFrame()}`
// — it reaches the render instance bound under the output stream and forces the previous frame to
// be discarded. This product's `oi` map holds terminal selection readers (./plugin-chain-markdown-
// host.ts), not the renderer, and the renderer's own `invalidate()` lives on the `TuiRenderer` the
// terminal host owns. The renderer is therefore bound here; with nothing bound the call is the
// source's own absent-instance no-op.
//
// Source `vot` (chunk-6ccen3s8.js [39124,39237) 113 units) reports the fallback event through the
// analytics dispatcher `i`. Its payload normalizers (`Ae`/`wn` and the known-action set they read)
// belong to that dispatcher's chunk; this product records events locally through the host's
// feature recorder, as the chain host already does for the other `tengu_*` events.
import { featureUsed } from './plugin-chain-host.js';

let prevFrameInvalidator: (() => void) | undefined;

/** Bind the host's frame invalidator (the terminal renderer's `invalidate`). Returns the unbind,
 *  which clears only the invalidator it set. */
export function bindPrevFrameInvalidator(invalidate: (() => void) | undefined): () => void {
  prevFrameInvalidator = invalidate;
  return () => {
    if (prevFrameInvalidator === invalidate) prevFrameInvalidator = undefined;
  };
}

/** Source `F`: discard the previous frame when an overlay becomes active. */
export function invalidatePrevFrame(): void {
  prevFrameInvalidator?.();
}

/** Source `vot`: record that a keybinding display fell back, with the action, context, fallback
 *  text and the source's reason (`action_not_found` or `no_context`). */
export function recordKeybindingFallback(
  action: unknown,
  context: unknown,
  fallback: unknown,
  reason: unknown,
): void {
  featureUsed('tengu_keybinding_fallback_used', {
    action: String(action),
    context: String(context),
    fallback: String(fallback),
    reason: String(reason),
  });
}
