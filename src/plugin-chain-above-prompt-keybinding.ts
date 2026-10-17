// The AbovePrompt keybinding/registry seam (W154). Copied bodies live in
// ./plugin-chain-above-prompt-keybinding-source.ts:
//
//   - chunk-am9mebpw.js [777,1015) 238 units — `Ze`, the single-action binding hook;
//   - chunk-am9mebpw.js [1015,1357) 342 units — `nn`, the handler-table binding hook;
//   - chunk-tvdq3hrk.js [7723,7816) 93 units — `hro`, the next open pane id;
//   - chunk-tvdq3hrk.js [15201,15327) 126 units — `gpr`, the pending focus request consumer;
//   - chunk-k1caxvem.js [1405,1497) 92 units — `nI`/`Cje`/`T4n`, the default timer and the
//     external-store no-ops the debounce subscribes with;
//   - chunk-1r9zp6s1.js [23386,23672) 286 units — `HG`, the debounced callback.
//
// Total 6 blocks, 1,177 UTF-16 units. Reused, not recopied: the keybinding service `Lc` from the
// press-button seam, the pane store `Ri` and its focus setter `c9` from the client-host seam, and
// the clock context `eE` from the markdown host. The source's themed Box `var s=Tt` (chunk-1r9zp6s1
// [6827,6836)) is the body `tui-base-components.ts` already carries from the same module, so it is
// the same entity, not a new copy.
import {
  Ze,
  nn,
  hro,
  gpr,
  HG,
} from './plugin-chain-above-prompt-keybinding-source.js';

/** The options `Ze`/`nn` read; both default the context to `Global` and active to true. */
export interface KeybindingOptions {
  context?: string;
  isActive?: boolean;
}

/** Source `Ze`: register one action while mounted and active; the callback ref updates every
 *  render, while the registration is keyed by action, context and service. */
export function useKeybinding(
  action: string,
  handler: () => unknown,
  options: KeybindingOptions = {},
): void {
  Ze(action, handler, options);
}

/** Source `nn`: register one handler per key while mounted and active. The keys' sorted join is the
 *  re-registration signature, so a table with the same key set keeps its registrations. */
export function useKeybindings(
  handlers: Record<string, () => unknown>,
  options: KeybindingOptions = {},
): void {
  nn(handlers, options);
}

/** An open pane list as `hro` reads it. */
export interface OpenPaneState {
  open: readonly { id: string }[];
  focusedId: string | null;
}

/** Source `hro`: the id after the focused pane in the open list, or null at the end. */
export function nextOpenId(state: OpenPaneState): string | null {
  return hro(state) as string | null;
}

/** Source `gpr`: act on a pending focus request — accept focuses the pane through `c9`, otherwise
 *  the request is cleared. A null request is left alone. */
export function consumeFocusRequest(accept: unknown): void {
  gpr(accept);
}

/** The debounced function `HG` returns: the last call wins, and `cancel` drops the pending one. */
export interface DebouncedCallback<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
}

/** Source `HG`: debounce `callback` by `delayMs` on the clock context's timer (the host clock when
 *  mounted, the process timer otherwise). Unmount cancels the pending call. */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => unknown,
  delayMs: number,
): DebouncedCallback<A> {
  return HG(callback, delayMs) as DebouncedCallback<A>;
}
