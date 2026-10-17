# W150 AbovePrompt select keyboard and field hooks

Package W150-01. Source: `chunk-24k7d6mw.js` sha256
`1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31`, `chunk-tvdq3hrk.js`
sha256 `d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5`,
`chunk-kjfwbh4w.js` sha256 `67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858`,
`chunk-sfn1dbxq.js` sha256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` and
`chunk-yygmb66g.js` sha256 `93220b26616034b337ff622aa95b4125688626cc0a1a883c473f2703565d60b0`.
Total 16 blocks, 5,032 UTF-16 units, unresolved 0.

## Ported ranges

| Symbol | Module | Range | Units | Public name |
| --- | --- | --- | --- | --- |
| `fpr` | chunk-tvdq3hrk.js | [6302,6379) | 77 | (internal) |
| `QT` | chunk-tvdq3hrk.js | [6379,6403) | 24 | (internal) |
| `k0` | chunk-24k7d6mw.js | [450586,450686) | 100 | `isTypedText` |
| `C0` | chunk-24k7d6mw.js | [451414,451598) | 184 | `useSiteFields` |
| `nK` | chunk-24k7d6mw.js | [451598,452484) | 886 | `useInputFields` |
| `rK` | chunk-24k7d6mw.js | [452484,452663) | 179 | `isFieldOwnKey` |
| `sK` | chunk-24k7d6mw.js | [452663,452750) | 87 | `isFieldText` |
| `lK` | chunk-24k7d6mw.js | [452750,453585) | 835 | `useKeysAheadOfRender` |
| `Ene` | chunk-24k7d6mw.js | [453782,453812) | 30 | `optionText` |
| `Nne` | chunk-24k7d6mw.js | [453812,453946) | 134 | `selectKeyHandlers` |
| `uK` | chunk-24k7d6mw.js | [453950,456049) | 2,099 | `useSelectFields` |
| `kNo` | chunk-kjfwbh4w.js | [45639,45712) | 73 | `selectFromTerminal` |
| `Ihe` | chunk-sfn1dbxq.js | [2336077,2336117) | 40 | `focusableAt` |
| `fd` | chunk-yygmb66g.js | [23446,23642) | 196 | `useControlledState` |
| `kd` | chunk-yygmb66g.js | [23642,23686) | 44 | (internal) |
| `Md` | chunk-yygmb66g.js | [23686,23730) | 44 | (internal) |

## Behavior

`k0` is typed text: no ctrl/meta/super/escape/tab/return and no control or separator character
(`/^[^\p{C}\p{Z}]+$/u`). `QT` tests that pattern; `rK` claims movement keys, delete, page keys and
the named ctrl/meta chords; `sK` claims non-empty text without those modifiers and without `QT`.

`C0` reads the site's generation once, initializes state from the site's map in the store (or an
empty map), and writes the map back on later effects while the generation is unchanged. It returns
the `[map, setter]` pair.

`nK` uses `C0` over the field-text store, keeps a ref copy and a submitted-key set, and prunes by
`v0` when Input seat values change. `fields.textOf` reads the state map; `fields.edit` sets the ref
and state and dispatches `ui.input` with kind `change`; `textNow` reads ref, then state, then the
caller's value, else `""`; `submit` guards a duplicate key, dispatches kind `submit`, then removes
the guard and clears the field only when the dispatch answered `undefined` and the value is still
the submitted one.

`lK` registers a pre-dispatch handler through `Ey`. It skips when the keybinding service or the
context is null, when a wheel arrives, or when the render is not behind. It resolves the key in the
current context and runs the context handler on a match; then, for a focused Select, it calls the
caller's `selectKeys`; a Global match stops it; for a focused Input it handles backspace, field
text and field-owned keys; finally it resolves the rendered context and returns true for a handler
there or for a focused Input taking field keys.

`Ene` returns `option.label ?? option.value`. `Nne` maps highlightNext/highlightPrevious to
`move(1)`/`move(-1)` and press to `press`.

`uK` uses `C0` over the picked-values store. The focused select is the focusable at the current
index with tag Select. State (`fd`) holds `{key, isOpen, highlight}`; the initial highlight is the
index of the option matching the picked value or the seat's own value. `Et` re-seeds when the key
changes. `Kt` wraps the highlight by `(highlight + delta + count) % max(1, count)` and opens on a
move when closed. `Xt` picks the highlighted option: closed or missing option opens; otherwise it
writes the picked value, closes, dispatches `selectFromTerminal`, and applies an answered value only
when it is still the picked one. `no` searches options after the highlight for a case-folded prefix.
`intercept` closes an open select on Ctrl+C, clears focus on Ctrl+C when closed, and routes typed
text through the prefix search. The returned `fields` cell is memoized over the picked map, seat,
open flag and highlight.

`kNo` settles `Ohe(\`ui.select ${plugin}\`, jPn({...request, surface:"terminal"}))`. `Ihe` reads a
list index, null for a null index or a miss. `fd` seeds state once from a value or initializer and
returns `[value, setter, getter]`; `kd`/`Md` are the function tests it reads.

## Files

- `src/plugin-chain-above-prompt-select-keys-source.ts` (generated, `@ts-nocheck`) and block ledger
- `src/plugin-chain-above-prompt-select-keys.ts` typed seam
- `test/plugin-chain-above-prompt-select-keys.test.ts` 12 tests
- Plan `research/ports/W150-above-prompt-select-keys.plan.json`
- Evidence `research/ports/W150-above-prompt-select-keys-evidence.json`

Generation: `blocks 16 missing 0 units 5032`; `source-undeclared-scan` → `unresolved 0`.

## Verification

Focused 14/14 (12 new plus the two scan gates); full 2330/2330; `tsc --noEmit` 0;
`npm run build` 0; `npm run notices` 0; identity
`40f60975bacd50dae8eb0bddbf4b47598c80e65c1bc4e7cc64d578cfae5cc474`.

Tests cover typed-text/own-key/field-text classification (including the source's `undefined`
returns from `rK`'s short-circuit), optionText, the select key handler map, focusableAt,
controlled-state seeding and updates, the input-field read/edit/submit path, a closed-select
intercept with no focus, Ctrl+C closing an open select, the pre-dispatch handler with wheel and
modified-key rejection, and the quiet terminal select dispatch.

## Remaining

`NFe` itself remains for C-2, together with fast mode, diff and attachments/footer.
