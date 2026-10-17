# W149 AbovePrompt field/select state layer

Package W149-01. Source: `chunk-tvdq3hrk.js` sha256
`d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5` (7 blocks) and
`chunk-kjfwbh4w.js` sha256 `67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858`
(1 block). Total 8 blocks, 491 UTF-16 units, unresolved 0.

The select keyboard (`C0`/`nK`/`uK`/`lK`) reads three per-site stores and dispatches through
`ui.input`. This slice carries those stores, the key and generation helpers, and the terminal
input dispatch; the keyboard itself stays with the component work.

## Ported ranges

| Symbol | Module | Range | Units | Public name |
| --- | --- | --- | --- | --- |
| `A5t` | chunk-tvdq3hrk.js | [2954,2990) | 36 | `fieldTexts` |
| `C5t` | chunk-tvdq3hrk.js | [2990,3026) | 36 | `pickedValues` |
| `T5t` | chunk-tvdq3hrk.js | [3026,3062) | 36 | `siteGenerations` |
| `qAt` | chunk-tvdq3hrk.js | [3062,3092) | 30 | `siteKey` |
| `KAt` | chunk-tvdq3hrk.js | [3092,3145) | 53 | `siteGeneration` |
| `Xrt` | chunk-tvdq3hrk.js | [3145,3216) | 71 | `withoutKeys` |
| `mro` | chunk-tvdq3hrk.js | [3216,3373) | 157 | `forgetSiteFields` |
| `nDr` | chunk-kjfwbh4w.js | [45567,45639) | 72 | `inputFromTerminal` |

The public names are the source's own: `chunk-24k7d6mw.js` imports these seven symbols from
`chunk-tvdq3hrk.js` and re-exports them through its export table as `fieldTexts`, `pickedValues`,
`siteGenerations`, `siteKey`, `siteGeneration`, `withoutKeys` and `forgetSiteFields`;
`chunk-kjfwbh4w.js` exports `inputFromTerminal`. `mro` is also called by `R5t`, the pane-close
function, as `mro("Pane", e)`, so the "forget" is not select-only.

## Behavior

The three stores are `bs()` single-slot holders (`Ge` is the identity memo in this build, so the
`(e) => e.set(void 0)` initializer never runs) and start undefined.

`siteKey(plugin, element)` is `${plugin}\0${element}`.

`siteGeneration(plugin, element)` reads the generation map, defaulting to 0 for an unknown site.

`withoutKeys(map, keys)` copies the map and deletes each named key; the source map is untouched.

`forgetSiteFields(plugin, element)` computes the site key, reads the next generation
(`current + 1`), removes that key from both the field-texts and picked-values maps (replacing an
undefined store with an empty map), and stores the bumped generation. Other sites are untouched.

`inputFromTerminal(request)` calls `Ohe(\`ui.input ${plugin}\`, UPn({...request,
surface:"terminal"}))`: it dispatches through the `ui.input` site for the element the plugin
holds, forces the terminal surface, and settles quietly (a rejection is logged, not thrown).

## Files

- `src/plugin-chain-above-prompt-select-source.ts` (generated, `@ts-nocheck`) and block ledger
- `src/plugin-chain-above-prompt-select.ts` typed seam
- `test/plugin-chain-above-prompt-select.test.ts` 7 tests
- Plan `research/ports/W149-above-prompt-select.plan.json`
- Evidence `research/ports/W149-above-prompt-select-evidence.json`

Generation: `blocks 8 missing 0 units 491`; `source-undeclared-scan` → `unresolved 0`.

## Verification

Focused 9/9 (7 new plus the two scan gates); full 2318/2318; `tsc --noEmit` 0; `npm run build` 0;
`npm run notices` 0; identity
`61334785e54c04ba44f6d925934077f53e277b6d97ed2d78a87362faa0d3a430`.

Tests cover the NUL site key, the empty and round-tripped stores, the generation default and stored
read, `withoutKeys` copy semantics, `forgetSiteFields` clearing one site while bumping its
generation from 2 to 3 and leaving a sibling site intact, the fresh-site bump from 0 to 1, and
`inputFromTerminal` settling for a plugin that holds no input element.

## Remaining

The select keyboard (`C0`/`nK`/`uK`/`lK`) and `NFe` remain for C-2, together with fast mode, diff
and attachments/footer.
