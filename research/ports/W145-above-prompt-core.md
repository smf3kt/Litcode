# W145 AbovePrompt pane layout and key core

Package W145-01. Source: `chunk-24k7d6mw.js` sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` (10 blocks) and
`chunk-1r9zp6s1.js` sha256 `444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e`
(1 block). Total 11 blocks, 1,473 UTF-16 code units, unresolved names 0.

The full component `NFe` [456049,461905) measures 5,856 units with 82 unresolved names; it is the
next slice. This package lands the part that imports nothing, so the pane's sizing and key
semantics are testable before the renderer is wired.

## Ported ranges

| Symbol | Range (UTF-16) | Units | Role |
| --- | --- | --- | --- |
| `vFe` | [444350,444563) | 213 | six pane scroll handlers |
| `pne` | [447294,447421) | 127 | merge scroll handlers into key bindings; alias to AbovePrompt next/previous outside inputs |
| `yne` | [447421,447615) | 194 | window rows, cue, max offset, body rows |
| `wne` | [448285,448295) | 10 | collapse handle columns = 5 |
| `kne` | [448698,448795) | 97 | first auto-focused index |
| `NI` | [448795,448921) | 126 | Input/Select key-context name |
| `vne` | [448921,448933) | 12 | row settle debounce = 150 ms |
| `G1` | [448933,449175) | 242 | hotkey-to-press map |
| `Tne` | [449175,449420) | 245 | cue fully laid out |
| `_ne` | [449420,449506) | 86 | content/plugin disjointness |
| `F4` | [28549,28670) in `chunk-1r9zp6s1.js` | 121 | yoga absolute top from a node to its content root |

## Behavior kept from source

- `yne` clamps the budget at 0, reserves one row for the cue only on overflow, and floors
  `bodyRows` at 0.
- `kne` returns null only for an empty list; a list without an auto-focus child yields 0.
- `G1` stops at Buttons (a Button's own hotkey is taken, its children are not walked) and skips
  engine subtrees; string children are ignored.
- `Tne` sums computed tops up to but excluding the content root, requires positive height, and
  rejects nodes outside the root (`F4` returns -1).
- `pne` merges in the source order: bindings, scroll handlers, then, only when the input flag is
  falsy, `pane:scrollUp/Down` become `abovePrompt:previous/next`.
- Constants stay literal: 5 columns, 150 ms.

## Files

- `src/plugin-chain-above-prompt-source.ts` (generated, `@ts-nocheck`), block ledger
  `src/plugin-chain-above-prompt-source-blocks.json`
- `src/plugin-chain-above-prompt.ts` typed seam
- `test/plugin-chain-above-prompt.test.ts` 13 tests
- Plan `research/ports/W145-above-prompt-core.plan.json`
- Evidence `research/ports/W145-above-prompt-core-evidence.json`

Generation: `node scripts/copy-module-regions.mjs research/ports/W145-above-prompt-core.plan.json
extracted-v2/modules/ src/plugin-chain-above-prompt-source.ts` → `blocks 11 missing 0 units 1473`;
`node scripts/source-undeclared-scan.mjs src/plugin-chain-above-prompt-source.ts` → `unresolved 0`.

## Verification

Focused (pane tests plus the undeclared-scan gate) 14/14; full 2285/2285; `tsc --noEmit` 0;
`npm run build` 0; `npm run notices` 0; identity
`b8af8bb64c8f6c54a839134efd67e151c1875599737958264ba5d21d88de9cc2`.

Tests assert source semantics: overflow/fit/negative-budget windows; empty/none/auto-focused lists;
Input, Select and fallback contexts; Button hotkey capture without recursion and with engine skip;
top sums; cue visibility; plugin disjointness; every scroll handler's argument; the merge order and
input-only suppression of the aliases; both constants.

## Remaining

`NFe` (the React component) and its data sources are still unported. C-2 remains open for fast
mode, diff, attachments/footer and the AbovePrompt component shell.
