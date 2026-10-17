# W148 AbovePrompt focus-seat layer

Package W148-01. Source: `chunk-24k7d6mw.js` sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` (4 blocks) and
`chunk-kjfwbh4w.js` sha256 `67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858`
(1 block). Total 5 blocks, 956 UTF-16 units, unresolved 0.

The AbovePrompt pane's selectable seats share four helpers and one key. The select keyboard
(`C0`/`nK`) is deferred: `nK` calls `inputFromTerminal`, which needs the `ui.input` dispatcher
(`UPn`, itself a closure over the site machinery), so it belongs in its own slice.

## Ported ranges

| Symbol | Module | Range | Units |
| --- | --- | --- | --- |
| `X1` | chunk-24k7d6mw.js | [450068,450435) | 367 |
| `eK` | chunk-24k7d6mw.js | [450474,450586) | 112 |
| `Ane` | chunk-24k7d6mw.js | [450967,451163) | 196 |
| `v0` | chunk-24k7d6mw.js | [451163,451414) | 251 |
| `cje` | chunk-kjfwbh4w.js | [45537,45567) | 30 |

## Behavior

`X1` returns `abovePrompt:next`, `abovePrompt:previous`, `abovePrompt:press` and the caller's
`abovePrompt:leave`. Next moves to `(index ?? -1) + 1 mod count`; previous to
`(index ?? 0) - 1 + count mod count`. Press dispatches a held Button through `TIe`
(pressFromTerminal), submits a held Input to the caller's `submit`, and does nothing for a null
index or another tag.

`eK` is a memoized callback over the seat list and report setter; it finds the first seat with the
same plugin and handle and reports its index, else reports nothing.

`Ane` memoizes a per-plugin registry. `reportSeat(plugin, seat)` adds the seat and returns an
unbind that removes only that seat; `seatsOf(plugin)` returns the Set or undefined.

`v0` snapshots seats of one tag by `${plugin}\0${element}`. On each effect run, a seat whose value
differs from the previous pass is collected, and `report` receives the key list only when non-empty;
the map is updated regardless.

`cje` is the NUL-joined key.

## Files

- `src/plugin-chain-above-prompt-seats-source.ts` (generated, `@ts-nocheck`) and block ledger
- `src/plugin-chain-above-prompt-seats.ts` typed seam
- `test/plugin-chain-above-prompt-seats.test.ts` 6 tests
- Plan `research/ports/W148-above-prompt-seats.plan.json`
- Evidence `research/ports/W148-above-prompt-seats-evidence.json`

Generation: `blocks 5 missing 0 units 956`; `source-undeclared-scan` → `unresolved 0`.

## Verification

Focused 8/8 (6 new plus the two scan gates); full 2311/2311; `tsc --noEmit` 0; `npm run build` 0;
`npm run notices` 0; identity
`8f0b66abec6f8d080424e77c583236f549229ae13f296b0e46e32b48440fc8f2`.

Tests cover the seat key, next/previous wrapping, Input submission and the null press no-op, the
seat-index callback with a miss, registry grouping and per-seat unbind, and the change watch both
reporting a changed Select value (ignoring a Button under the same plugin) and staying quiet when
values are unchanged.

## Remaining

The select keyboard (`C0`/`nK`/`uK`/`X1` wiring), `lK` context/target resolution, and `NFe` itself
remain for C-2, together with fast mode, diff and attachments/footer.
