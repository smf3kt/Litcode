// The AbovePrompt focus-seat layer (W148): the handlers and bookkeeping the pane's selectable
// seats share. Copied bodies live in ./plugin-chain-above-prompt-seats-source.ts:
//
//   - chunk-24k7d6mw.js [450068,450435) 367 units — `X1`, the key handler map (next/previous wrap,
//     press a held Button or submit a held Input, leave);
//   - [450474,450586) 112 units — `eK`, the memoized seat-identity index;
//   - [450967,451163) 196 units — `Ane`, the per-plugin seat registry;
//   - [451163,451414) 251 units — `v0`, the effect that reports seat values changed under the same
//     key;
//   - chunk-kjfwbh4w.js [45537,45567) 30 units — `cje`, the `${plugin}\0${element}` seat key.
//
// Total 5 blocks, 956 UTF-16 units; imports only the hook surface, the press dispatch and the key
// builder's own dependency.
import { X1, eK, Ane, v0, cje } from './plugin-chain-above-prompt-seats-source.js';

/** A focusable seat as the key handlers read it. */
export interface FocusableSeat {
  tag?: string;
  plugin: string;
  element: string;
  value?: unknown;
  [key: string]: unknown;
}

/** The key bindings the prompt seat layer adds. */
export interface PromptKeyHandlers {
  'abovePrompt:next': () => void;
  'abovePrompt:previous': () => void;
  'abovePrompt:press': () => void;
  'abovePrompt:leave'?: () => void;
}

/** Source `cje`: the seat key. */
export function seatKey(plugin: string, element: string): string {
  return cje(plugin, element) as string;
}

/** What `X1` reads. */
export interface PromptKeyHandlerInput {
  focusables: readonly FocusableSeat[];
  focusIndexNow: () => number | null;
  focusByPerson: (index: number) => void;
  submit: (seat: FocusableSeat) => unknown;
  leave?: () => void;
}

/** Source `X1`: the prompt seat key handler map. */
export function promptKeyHandlers(input: PromptKeyHandlerInput): PromptKeyHandlers {
  return X1(input) as PromptKeyHandlers;
}

/** Source `eK`: a memoized callback that reports the index of a seat by plugin and handle. */
export function useSeatFocusIndex(
  seats: readonly FocusableSeat[],
  report: (index: number) => void,
): (seat: FocusableSeat) => void {
  return eK(seats, report) as (seat: FocusableSeat) => void;
}

/** The registry `Ane` returns. */
export interface SeatRegistry {
  reportSeat(plugin: string, seat: unknown): () => void;
  seatsOf(plugin: string): Set<unknown> | undefined;
}

/** Source `Ane`: the per-plugin seat registry. */
export function useSeatRegistry(): SeatRegistry {
  return Ane() as SeatRegistry;
}

/** Source `v0`: report seat keys whose value changed under the same plugin/element. */
export function useSeatChangeWatch(
  seats: readonly FocusableSeat[],
  tag: string,
  report: (keys: string[]) => void,
): void {
  v0(seats, tag, report);
}
