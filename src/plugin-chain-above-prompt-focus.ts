// The AbovePrompt focus and scroll seam (W153): the focus ring, the active-context registration,
// the focusable-tree walk and the scroll clamp the pane's key handlers share. Copied bodies live in
// ./plugin-chain-above-prompt-focus-source.ts:
//
//   - chunk-sfn1dbxq.js [475702,475813) 111 units — `A9r`, the scroll-window clamp;
//   - [476169,476191) 22 units — `Xq`, the AbovePrompt request id;
//   - [476538,476681) 143 units — `fse`, the hookable focus dispatch bottom;
//   - [2334533,2335070) 537 units — `Lqt`, the ui.focus request builder;
//   - [2335070,2335123) 53 units — `Nqt`, the focus-site draw clears;
//   - [2336000,2336062) 62 units — `sZo`, the act-handler wrapper;
//   - [2336062,2336073) 11 units — `GQt`, the queued-act limit;
//   - [2336190,2338444) 2,254 units — `iZo`, the focus-ring hook;
//   - chunk-bwyexfny.js [3579,3835) 256 units — `ZD`, the active-context hook;
//   - chunk-6ejn7q9s.js [108086,108477) 391 units — `PYe`, the focusable-tree walk.
//
// Total 10 blocks, 3,840 UTF-16 units. Imports are the hook surface, W150's `Ihe`, the keybinding
// service `Lc`, the dispatch helper `Ohe`, the scroll-focus store/reader `Uet`/`IY`/`_z`, the
// lodash map alias `Di` (as `oo`), the pre-hook chain `N5t`, the record handlers `P0`, the source
// dispatch helpers `aP`/`Ooe`, the record origin helper `aJ`, and the host log/registry `it`/`t`.
import {
  A9r,
  Xq,
  sZo,
  iZo,
  ZD,
  PYe,
  Lqt,
  Nqt,
  GQt,
  fse,
} from './plugin-chain-above-prompt-focus-source.js';

/** A focusable the pane draws: a Button, Input or Select. */
export interface Focusable {
  tag?: string;
  plugin: string;
  handle?: string;
  element: string;
  isAutoFocus?: boolean;
  value?: unknown;
  options?: unknown;
}

/** The scroll window `A9r` clamps. */
export interface ScrollWindow {
  offset: number;
  bodyRows: number;
  top: number;
  bottom: number;
}

/** Source `A9r`: clamp the desired top so the window stays inside the viewport. */
export function clampScrollTop(window: ScrollWindow): number {
  return A9r(window) as number;
}

/** Source `Xq`: the AbovePrompt request id. */
export const ABOVE_PROMPT_REQUEST_ID = Xq as string;

/** Source `GQt`: the most acts that may queue behind one in-flight focus request. */
export const FOCUS_ACT_QUEUE_LIMIT = GQt as number;

/** The handler table `sZo` builds over: every entry wrapped so it calls `act`, except the ids the
 *  caller keeps as they are. */
export function actHandlers<T extends Record<string, unknown>>(
  host: { act(run: () => void): void },
  handlers: T,
  keep: readonly string[] = [],
): Record<string, unknown> {
  const bind = sZo as unknown as (
    host: { act(run: () => void): void },
    handlers: Record<string, unknown>,
    keep: string[],
  ) => Record<string, unknown>;
  return bind(host, handlers, keep as string[]);
}

/** A person's move request as `moveByPerson` reads it. */
export interface FocusMove {
  index: number | null;
  apply(): void;
}

/** What the focus-ring hook reads each render. */
export interface FocusRingInput {
  component: string;
  requestId: string;
  owner?: unknown;
  focusables: readonly Focusable[];
  isHeld: boolean;
  isHeldNow(): boolean;
  indexNow(): number | null;
  isEmptyNow(): boolean;
  land(index: number): void;
}

/** What the focus-ring hook answers. */
export interface FocusRing {
  act(run: () => void): void;
  moveByPerson(move: FocusMove): void;
  forget(): void;
}

/** Source `iZo`: the pane's focus ring. Registers the ring in the focus-site store for its lifetime,
 *  queues acts behind an in-flight request (up to 64), aborts outstanding work on forget/unmount,
 *  and auto-focuses the declared seat while held and empty. */
export function useFocusRing(input: FocusRingInput): FocusRing {
  return iZo(input) as FocusRing;
}

/** Source `ZD`: register a keybinding context while the hook is mounted and active. */
export function useActiveContext(name: string, active = true): void {
  ZD(name, active);
}

/** Source `PYe`: flatten an element tree into the focusable seats it draws. */
export function focusablesOf(element: unknown): Focusable[] {
  return PYe(element) as Focusable[];
}

/** Source `Nqt`: the focus-site store whose draw pass clears stale sites. */
export function focusSiteDrawStore(): { emit(): void; clear?(): void } {
  return Nqt() as { emit(): void; clear?(): void };
}

/** Source `Lqt`: raise a ui.focus request through the pre-hook chain and the handler table. */
export function raiseFocusRequest(input: unknown, signal?: AbortSignal): unknown {
  return Lqt({ input, signal });
}

/** Source `fse`: dispatch a hookable event through the handler table with a promise bottom. */
export function raiseFocusDispatch(request: unknown, bottom: (value: unknown) => unknown): unknown {
  return fse(request, bottom);
}
