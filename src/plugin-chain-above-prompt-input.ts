// The AbovePrompt prompt input's single-digit confirmation (W147), the slice that turns a typed
// digit into the pane's selection action. Copied bodies live in
// ./plugin-chain-above-prompt-input-source.ts:
//
//   - chunk-24k7d6mw.js [442163,443631) 1,468 units — the digit hint map (`bFe`), its normalizer
//     `h0`, the two delays (400 ms debounce, 600 ms mount delay) and `Tp`, which confirms a digit
//     either on Enter (pre-dispatch, when the key did not resolve to `chat:submit`) or after the
//     debounce when the input becomes one valid character;
//   - chunk-1r9zp6s1.js [24240,24305) 65 units — `Xa` (the clock function from the `b4n` context,
//     `Date.now` when unmounted) and `Uo`;
//   - chunk-rzab5p9a.js [714,806) 92 units — `IG` 150, `Oo` 250 and `rc`, the due-window test.
//
// The source reads `b4n`, a clock context from chunk-06azbynj.js. This build has no provider for
// that token, so ./plugin-chain-above-prompt-input-host.ts declares one; without a mounted value
// `Xa` returns `Uo`, exactly the source fallback.
import {
  mne, Pm, bFe, h0, Tp, Xa, Uo, IG, Oo, rc,
} from './plugin-chain-above-prompt-input-source.js';

/** The hint map: a character the input method produced, to the digit it stands for. */
export const DIGIT_HINT_MAP: ReadonlyMap<string, string> = bFe as ReadonlyMap<string, string>;

/** Source `h0`: the hint for a character, else its NFKC form. */
export function digitHint(character: string): string {
  return h0(character) as string;
}

/** Source `mne`: how long the input waits before confirming one typed digit. */
export const DIGIT_CONFIRM_DEBOUNCE_MS: number = mne;

/** Source `Pm`: how long after mount Enter confirmation is ignored. */
export const DIGIT_MOUNT_DELAY_MS: number = Pm;

/** Source `IG`: the default due window. */
export const DUE_WINDOW_MS: number = IG;

/** Source `Oo`: the longer due window. */
export const DUE_WINDOW_LONG_MS: number = Oo;

/** Source `Xa`: the clock function from the clock context, or `Date.now` without one. */
export function clockNow(): () => number {
  return Xa() as () => number;
}

/** Source `Uo`: `Date.now` itself. */
export function systemNow(): number {
  return Uo() as number;
}

/** Source `rc`: whether `start` is inside `windowMs` of the current clock reading. */
export function dueWithin(
  now: () => number,
  start: number,
  windowMs: number = IG,
): boolean {
  return rc(now, start, windowMs) as boolean;
}

/** What `Tp` reads. */
export interface DigitPromptProps {
  inputValue: string;
  isValidDigit: (character: string) => boolean;
  onDigit: (digit: string) => void;
  enabled?: boolean;
  once?: boolean;
  enterConfirms?: boolean;
  debounceMs?: number;
  mountDelayMs?: number;
}

/** Source `Tp`: subscribe the prompt input's Enter and debounce digit confirmation. */
export function usePromptDigitConfirm(props: DigitPromptProps): void {
  Tp(props);
}
