# W146 AbovePrompt content and chrome components

Package W146-01. Source: `chunk-24k7d6mw.js` sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`. 16 blocks, 2,722 UTF-16
code units, unresolved names 0 after the seam imports.

This is the second C-2 AbovePrompt slice. W145 carried the pane's pure layout and key core; this
package carries the pieces the component draws with: the content wrapper and its columns context,
the wheel mapping, the held edges and element-key bounds, the raised scroll wrapper, the toggle
and collapse chrome, the hidden-panel header, the focus index, the list rows and the more
indicator, and digit selection. `NFe` itself and the input/select key handling remain.

## Ported ranges

| Symbol | Range | Units | Role |
| --- | --- | --- | --- |
| `wFe` | [443631,443771) | 140 | wheel point from the cached layout |
| `j1` | [443771,443978) | 207 | held node top/bottom |
| `kFe` | [443978,444350) | 372 | element-key bounds walk |
| `TFe` | [444675,444845) | 170 | content wrapper + columns context |
| `xFe` | [444923,444956) | 33 | props merge |
| `W1` | [444956,444994) | 38 | floor clamp |
| `PFe` | [446991,447122) | 131 | raised scroll props |
| `OI` | [447619,448084) | 465 | toggle label |
| `b0` | [448084,448093) | 9 | collapse icon flag = 1 |
| `bne` | [448093,448285) | 192 | collapse handle |
| `K1` | [448295,448698) | 403 | hidden-panel header |
| `w0` | [449506,449633) | 127 | next focus index |
| `z1` | [449633,449682) | 49 | list rows |
| `Y1` | [449682,449785) | 103 | more indicator text |
| `J1` | [449785,450018) | 233 | more indicator component |
| `Rne` | [450018,450068) | 50 | digit select |

## Seams

The copied bodies import only names the product already carries:

- `Xe as e`, `s`, `n`, `N`, `R`, `Z`, `w`, `b` from `plugin-chain-react-hooks.ts` (the hook
  surface and the Box/Text tokens);
- `* as Sc` from `plugin-chain-press-button.ts`, where `_3n` is now also exported as
  `releaseInkFocus`. The source's `Sc` is chunk-kjfwbh4w's export table and `OI` reads exactly
  that entry, so exposing the export name keeps the copied call `Sc.releaseInkFocus(…)` verbatim;
- `KH` (ActionBox) from `plugin-chain-press-button-host.ts`;
- `TIe` (pressFromTerminal) from `plugin-chain-press-dispatch-source.ts`;
- `ddn` (site columns) from `plugin-chain-input-field-source.ts`;
- `S3n` (select option window) from `plugin-chain-select-field-source.ts`;
- `F4` from the W145 copy.

No body was rewritten.

## Files

- `src/plugin-chain-above-prompt-parts-source.ts` (generated, `@ts-nocheck`) and
  `src/plugin-chain-above-prompt-parts-source-blocks.json`
- `src/plugin-chain-above-prompt-parts.ts` typed seam
- `test/plugin-chain-above-prompt-parts.test.ts` 11 tests
- Plan `research/ports/W146-above-prompt-parts.plan.json`
- Evidence `research/ports/W146-above-prompt-parts-evidence.json`
- Adapter: `plugin-chain-press-button.ts` exports `_3n as releaseInkFocus`

Generation: `node scripts/copy-module-regions.mjs research/ports/W146-above-prompt-parts.plan.json
extracted-v2/modules/ src/plugin-chain-above-prompt-parts-source.ts` → `blocks 16 missing 0 units
2722`; `source-undeclared-scan` → `unresolved 0`.

## Verification

Focused 13/13 (11 new plus the two undeclared-scan gates); full 2296/2296; `tsc --noEmit` 0;
`npm run build` 0; `npm run notices` 0; identity
`6d39c0c65eee398e146dd855e17b078b43527daa7a8606843476cfa88da9a581`.

The tests cover the wheel mapping and its absent cases; held edges including index mismatch and
outside-root; the key walk's root exclusion, plugin strictness and unqualified match; the content
wrapper's negative margin and columns context; merge and clamp; the raised scroll offset with
memoization in the hook runtime; the toggle label's inverted/dim render prop; the collapse handle
and header text; every focus-index branch; list rows against the real select window; the indicator
join and component; and the digit select's no-op branches.

## Remaining

`NFe` and the input/select key subsystem (`Tp`, `C0`, `nK`, `uK`, `X1`, `lK`) stay for later C-2
slices. Fast mode, diff, attachments/footer are untouched.
