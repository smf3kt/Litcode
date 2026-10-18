// The host seam the Markdown leaf reads (W45-80). The leaf bodies live in
// ./plugin-chain-markdown-source.ts; this module supplies the three host bindings they ask for and
// nothing else. The source reads them from its bundle's shared module scope:
//
//   · `eE` — the clock context `on()` reads. The source declares it as `var eE=qt(null)` in
//     chunk-k1caxvem.js [2091,…), and `on` is `function on(){let o=Ae(eE);if(!o)throw Error("useClock
//     must be used within a ClockProvider");return o}` (chunk-1r9zp6s1.js [17969,18071)). The
//     provider is host state: this build takes it from the render's `contexts` map, so a caller
//     passes `new Map([[eE, clock]])` to `runComponent` exactly as a React tree would mount a
//     provider.
//   · `Gfe` — the selection context `wC` reads. The source declares it in chunk-z7whhrje.js, where
//     it is that chunk's context factory result; `wC` only calls `Ae(Gfe)` for hook order and
//     discards the value, so the default here is null and no caller needs to mount it.
//   · `oi()` — the per-host map of terminal selection readers. The source's body is
//     `At.of(B().host)` in chunk-kexg5hxg.js: a map keyed by the host's output stream. This build has
//     native component owner supplies its reader through SelectionInstanceContext. Isolated runs
//     use the explicit stream map or the source's no-instance branch.
import { Ae, qt } from './plugin-chain-react-hooks.js';

/** The clock the leaf's body reads: `now()` for the double-activation window, `setTimeout(fn, ms)`
 *  for the delayed press, and the token it returns must be callable to cancel the timer. */
export interface MarkdownClock {
  now(): number;
  setTimeout(fn: () => void, ms: number): () => void;
}

/** The terminal selection instance the map holds. The names are the ones `wC`'s instance branch
 *  calls on it; that branch wraps them under the shorter names a caller of `wC` sees. */
export interface TerminalSelectionInstance {
  copySelection(): string;
  copySelectionNoClear(): string;
  getSelectedText(): string;
  clearTextSelection(): void;
  hasTextSelection(): boolean;
  selection: unknown;
  subscribeToSelectionChange(onChange: () => void): () => void;
  moveSelectionFocus(direction: unknown): void;
  setSelectionBgColor(background: unknown): void;
}

/** Source `eE` (chunk-k1caxvem.js `var eE=qt(null)`): the clock context. A render mounts a
 *  `MarkdownClock` for it through the hook seam's `contexts` map; without one, `on()` throws the
 *  source's own "useClock must be used within a ClockProvider". */
export const eE = qt<MarkdownClock | null>(null);

/** Source `Gfe` (chunk-z7whhrje.js): the selection context. `wC` reads it for hook order and does
 *  not use the value, so its default stands in for any provider. */
export const Gfe = qt<unknown>(null);
export const SelectionInstanceContext = qt<TerminalSelectionInstance | null>(null);

const selectionReaders = new Map<unknown, TerminalSelectionInstance>();

/** Source `oi` resolves the current host's selection reader. */
export function oi(): Map<unknown, TerminalSelectionInstance> {
  const mounted = Ae(SelectionInstanceContext);
  return mounted ? new Map([[process.stdout, mounted]]) : selectionReaders;
}

/** Bind one selection reader under a stream key (the source keys by `process.stdout`). Returns the
 *  unbind, which removes only the reader it set. */
export function bindTerminalSelection(stream: unknown, selection: TerminalSelectionInstance): () => void {
  selectionReaders.set(stream, selection);
  return () => {
    if (selectionReaders.get(stream) === selection) selectionReaders.delete(stream);
  };
}

/** The system clock, for a render that mounts a clock provider without a fixture. */
export const systemMarkdownClock: MarkdownClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => {
    const timer = setTimeout(fn, ms);
    timer.unref?.();
    return () => clearTimeout(timer);
  },
};
