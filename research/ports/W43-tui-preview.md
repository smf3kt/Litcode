# W43 Choice preview

Status: verified (limited). Date: 2026-10-13. Product source and installed preview chains accepted; complete renderer parity remains pending.
Entry: model `ask_user_question` input -> schema validation -> host callback -> grouped terminal question -> focused preview -> answer review -> tool result. The line-input path displays each option's classified preview.

## Source preflight

The user requires source investigation before implementation. This resumed package revalidated the available extracted bodies, AST ranges, module identities and copied bodies before further product edits. The previous W35 claim that six dependencies or a Bun header precluded the layout engine was unsupported; it is corrected in W35 and the current matrix.

Sample: Claude Code 2.1.296, artifact SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Extraction manifest SHA-256 `272c14c9e4976fe3d4d6bd5ed8fe7a3dca3d427c4889c99e12a020f5b4e4e235`, 2609 modules, no source maps. Each module below matches its manifest decodedSha256. Acorn 8.15.0 parses the inert source without executing application entrypoints. Ranges are zero-based UTF-16 [start,end), including module headers; byte lengths are UTF-8.

| Module | Module SHA-256 | Module bytes | Body / role | UTF-16 range |
| --- | --- | --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | 1716741 | `QX` / `Nbe`, preview box and formatter call | [1140357,1140636) / [1140636,1143013) |
| same | same | same | `a3`, single-choice preview, 30-column options, gap 4, notes and input owner | [1145502,1153542) |
| same | same | same | `w3`, undefined / empty / withheld / full classification | [1164278,1164938) |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | 360288 | JavaScript layout core: enums, config, nodes, flex calculation, cache | [137919,164147) |
| chunk-n3ykh62m.js | 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac | 697926 | Markdown tokenizer / lexer / parser body | [411715,450354) |
| chunk-x3k1646w.js | 2f8e8b1c145d62e9b614863492fbed535bf183812602c8bfe2610f77f133c5c1 | 23346 | terminal Markdown formatter body | [1652,23249) |

Function anchors: `Kp` [140450,140930), `Hl` [140930,149324), `Or` [151142,151955), `Jp` [163456,163611); `ADe` [423948,434040), `EA` [434040,439765), `rce` [445262,449857), `Cm` [449872,449910); `FXe` [2213,2309), `qe` [11714,12676), `CFt` [13147,13360), `qH` [13564,13678), `Gt` [13678,19290). Layout and lexer closures use JavaScript builtins. The formatter imports the recovered lexer and explicit host bindings. The current frame host remains a separate adapter, with outstanding renderer dependencies below.

## Copy and adaptation

| Product file | Mode | Exact copied body bytes / SHA-256 | Host boundary |
| --- | --- | --- | --- |
| src/tui-layout.ts | copy | 26228 / 2634c58b4c27e540dbab5249f634f25f539b6c8522c758aaf29d9c8963462d01 | adds exports `layoutEngine` / `layoutEdges`; unchanged body |
| src/tui-markdown-lexer.ts | copy | 38639 / f083f546c3a66ca903139a46428910089cff4993eb31a7bf0003e4512366b860 | adds exports `ADe` / `EA` / `rce` / `Cm`; unchanged body |
| src/tui-markdown.ts | copy body + adapt bindings | 21597 / 6d9fcb3694f425b2a1855567d71aca40a0ff0e3ee8054dac3729704af283bbb9 | imports lexer and host bindings; wrapper invokes `CFt(text, 'plain', null)` and strips SGR |
| src/tui-markdown-host.ts | adapt | no whole-body copy claim | plain styling, width, environment, URL helpers, analysis/memory-tag filtering and service bindings |
| src/tui.ts | adapt preview / existing rewritten frame | no whole-body copy claim | uses copied layout core for 30-column list + gap 4 + flexible preview; box composes rows with grapheme widths |
| src/terminal.ts | adapt | no whole-body copy claim | maps full/empty/withheld previews to host strings; 2000 UTF-16-unit render cap and recovered withheld text |
| src/interaction-tools.ts / src/interactive.ts | adapt | no whole-body copy claim | advertises preview, validates at 8000 UTF-16 units, forwards through question groups and displays line fallback |

`@ts-nocheck` keeps recovered JavaScript spelling and bodies unchanged in the three copied modules; surrounding adapters remain typechecked. Source slices were compared against the product bodies and their digests on resumption.

Observed `Nbe`: CFt formatting, hard wrap to maxWidth - 4, minimum content width 40, box width min(max(40,widest) + 4,maxWidth), border glyphs and `--- scissors --- N lines hidden` rule. Original `a3` sets preview maxWidth = columns - 30 - 4 and maxLines = max(1,rows - 26). Host row budgets account for the existing frame, question rows and borders. Nodes/config are created per geometry calculation and freed in finally; existing dialog cancellation restores the prior input owner and draft.

## Remaining differences

- Full React reconciler, Ink host nodes and screen renderer are still unported. The copied JavaScript layout core currently serves preview geometry only. External dependencies are permitted; current absences are pending work.
- The formatter body is copied, but host bindings choose plain styling and null highlighting. Syntax highlighting, terminal themes, OSC8/artifact links, URL/path handling and terminal capability helpers still differ. Cache/service shims are explicit; this is no claim of full formatter dependency parity.
- Preview sanitation currently handles controls, replacement-only blank text, CRLF, tabs, render cap and truncation markers. The recovered Default_Ignorable/Cf and combining/zero-width run treatment remains to be ported.
- The row box adapts width/wrapping and clips at grapheme boundaries. Original `Nu`/`XFt` ANSI-aware helpers, minHeight/minContentWidth and exact complete renderer layout remain pending. Narrow screens stack preview below choices; the original a3 uses a row layout. The hidden rule is shortened on very narrow widths to retain the border.
- Notes, chat-about-design and external-editor/image-paste remain pending; `hideSubmitTab` is ported by [W175](W175-hide-submit-tab.md), the single-select preview annotation by [W176](W176-terminal-preview-annotation.md), and the AFK timeout by [W177](W177-afk-timeout.md). Current answer JSON keeps the existing host contract.
- Line input prints classified Markdown source; the focused full-screen path uses the copied formatter. Both installed CLI paths are accepted for the final identity, while their rendering contracts remain distinct.

## Validation

The earlier `W43-tui-preview-identity.json` and initial 1169-test result describe the initial implementation only. Final records: [identity](W43-tui-preview-final-identity.json) and [acceptance](W43-tui-preview-final-evidence.json).

- `npm run check`: exit 0. `npm run build` runs inside package acceptance and passes.
- `npm test`: exit 0, 1171/1171, zero failed/cancelled/skipped, 49908 ms. Includes 20 TUI and 21 interaction-tool tests, with three added regressions for focused preview/bounds, copied geometry/formatter and model-schema forwarding. Product/test bytes stayed unchanged afterward; documentation and validation drivers were finalized separately.
- `npm run smoke:package -- --tui-preview`: exit 0; 86-file offline package installs without dev runtime or extracted/research/source files. Installed wide 100x24, narrow 40x24 and line-input chains each exercise question -> answer/review where applicable -> plan approval -> approved write -> cancelled write -> exit; five owned SSE model calls per chain. Mode restoration, file effects, locks and secret-free journal pass.
- Compiled mouse/selection chain and `--actions`: exit 0, two and one owned model calls respectively; draft, copy, model/thinking/tasks/stash and cancellation hold.
- Final input identity: 139 files `20fa2b0f9bb0725a0e5ef8ea77edd3081ed71998e4f2d4c99c44456c7dd899b6`; tests: 94 files `278a834ab952cbde507ebdb52fe23a30ce1dfce3a126167f9ca71990254cece3`; build: 78 files `d2073b6f66b9601625a9a5ed7fd8a4ebae67b2d0a72a11c388a64ff3bc82da2d`; combined `775a2de2384e77e0d075acd78f749fe31a1cdd73c0ba91db481cb261c755c861`. Identity is unchanged after the final package build.
- Accepted archive SHA-256: `ae02549fff40706ee1f53b73fab49419024438182be2e3655c1a96b7b1b286af`; temporary archive/install were cleaned after verification. `git diff --check`: exit 0.

No paid upstream calls. Extracted sources remain inert and unchanged. Incidents Q-012 through Q-016 are tracked in question.md. S-1: ranges/outputs measured and exact failure inspected; S-2: prior assertions retained; S-3: copied Markdown handles source versus display; S-4: nodes/config and CLI/process/mode/lock owners released; S-5: stable frames and PTY newline normalization; S-6: schema/type/readers/TUI/line/drivers aligned; S-7: source preflight, exact bodies and remaining adaptations recorded. `apply_patch` is absent in this host, so manual edits used the dedicated Edit tool; mechanical source extraction and evidence generation used owned scripts.
