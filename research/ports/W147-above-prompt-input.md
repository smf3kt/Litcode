# W147 AbovePrompt prompt-input digit confirmation

Package W147-01. Source: `chunk-24k7d6mw.js` sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` plus two small helpers from
`chunk-1r9zp6s1.js` and `chunk-rzab5p9a.js`. Three blocks, 1,625 UTF-16 code units, unresolved 0.

This is the C-2 AbovePrompt input slice: what happens when the prompt above the main input holds
one digit. It lands `Tp` and its hint table, the clock-now hook `Xa` and the due-window helper
`rc`, and it fixes the hook seam's effect semantics that this body exposed.

## Ported ranges

| Symbol | Module | Range | Units |
| --- | --- | --- | --- |
| `mne`, `Pm`, `bFe`, `h0`, `Tp` | chunk-24k7d6mw.js | [442163,443631) | 1,468 |
| `Xa`, `Uo` | chunk-1r9zp6s1.js | [24240,24305) | 65 |
| `IG`, `Oo`, `rc` | chunk-rzab5p9a.js | [714,806) | 92 |

## Behavior

`bFe` maps input-method characters to digits: `&`→1, `é`→2, `"`→3, `'`→4, `(`→5, `-`/`§`→6,
`è`→7, `_`→8, `ç`→9, `à`→0; other characters pass through NFKC. `Tp` confirms a digit two ways.

On Enter, the pre-dispatch handler proceeds only for a plain Return, while enabled and not yet
consumed; when a keybinding service exists it also requires the key to resolve to
`chat:submit`. It then rejects a mount window still running (600 ms default), an unchanged
input, or an input that is not one character. The hint or NFKC digit must pass `isValidDigit`;
then `once` is consumed, `onDigit` receives the digit and the handler returns true.

Separately, an effect watches the input: past the mount window, with one character whose NFKC
form is valid, it schedules `onDigit` after the 400 ms debounce; the cleanup cancels the timer.

`Xa` returns the mounted clock function from the source's `b4n` context or `Uo` (`Date.now`).
`rc` accepts a start whose age is in `[0, windowMs)`; for a start in the future it requires the
start not to exceed the real clock.

## Host token

The source reads `b4n`, a clock context declared in chunk-06azbynj.js. This build has no
provider for that token, so `plugin-chain-above-prompt-input-host.ts` declares `PromptClock` via
the existing `qt`; the unmounted default is the source's own `Uo`/`Date.now` fallback.

## Hook seam fix

`Ey` updates its handler ref with `en(()=>{t.handler=e})`, no dependency array. React runs such an
effect after every render; this seam's `en`/`P` defaulted the missing array to `[]` and ran it
once, so the pre-dispatch handler kept the first render's closure. The seam now distinguishes an
omitted array from an empty one: without deps the effect queues every render, and `EffectSlot.deps`
is optional. This is a correctness fix to match React and the source usage; the full suite passes
unchanged behavior elsewhere.

## Files

- `src/plugin-chain-above-prompt-input-source.ts` (generated, `@ts-nocheck`) and its block ledger
- `src/plugin-chain-above-prompt-input.ts` typed seam
- `src/plugin-chain-above-prompt-input-host.ts` the `PromptClock` token
- `test/plugin-chain-above-prompt-input.test.ts` 9 tests
- `src/plugin-chain-react-hooks.ts` effect-deps fix
- Plan `research/ports/W147-above-prompt-input.plan.json`
- Evidence `research/ports/W147-above-prompt-input-evidence.json`

Generation: `blocks 3 missing 0 units 1625`; `source-undeclared-scan` → `unresolved 0`.

## Verification

Focused 11/11 (9 new plus the two scan gates); full 2305/2305; `tsc --noEmit` 0; `npm run build`
0; `npm run notices` 0; identity
`307fee76829ca9611ab61bbfb99c8cd8c2ee8a1a61af5369bc7da99126cf2206`.

Tests cover every hint and the NFKC fallback, the four constants, due-window past/future edges,
the context/system clock, the Enter path (success, non-submit key, multi-character input, mount
window, once) through a mounted keybinding service, the debounce delivery, and cleanup on unmount.

## Remaining

The select-key subsystem (`C0`/`nK`/`uK`/`X1`/`lK`) and `NFe` itself remain for C-2, together
with fast mode, diff and attachments/footer.
