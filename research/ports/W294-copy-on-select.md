# W294 Copy on select

Status: verified locally on 2026-10-23.

## Task card

- Entry: Config's Copy on select row, default true. Completed selections copy once and retain highlight. Ctrl+C clears an auto-copied selection without another write.
- Shape: one selection observer over the transcript and native facades, one live user preference, one copied-text cache, terminal-owned cleanup.
- Method: copy xBe's subscription callback and its key and text dependencies. Adapt React hook ownership to the existing TuiTerminal and OSC52 boundary.
- Targets: selection-copy source, native selection facade, Config, runtime, session, startup, reload and terminal bindings.
- CLI chain: response, drag/release, exact OSC52 bytes, retained highlight/draft, Ctrl+C, Config, stash, transcript, active-turn interruption, reload and restart.
- Checks: source hashes and AST comparison, three new regressions, affected tests, check/build, compiled CLI and independent review.
- Constraints: local functions only, no account or subscription traffic, no push or commit attribution. Magpie routing remains unchanged.
- Gate: the source passes inAppSelection:true. The timestamps row keeps its false-default source gate.

## Source identity

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
All ranges are zero-based UTF-16 code units, half-open. The verifier checks each used module against extracted-v2/manifest.json before parsing.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-qh0w98pn.js | a6f4555b23f747a11e952695c27895a1f2c76e2cf92396754242e9c23fdd8472 | QLt [3815,4061), RBe [4579,4715), Vln [4719,5223), xBe [5223,5742), callback [5401,5730), PBe [5742,5833) |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | vWe [7247,31899), G [8266,8318), row [23905,24064), inAppSelection:true producer [37501,38693) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | lbt [124140,124299), rI [126888,130997), physical-key callback [130317,130928), GZ [141280,142056), footer flags [768900,768948), footer push [769064,769330) |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | selected text [343861,343960), copyNoClear [343960,344079), copy [344079,344249), clear [344249,344379), notify [346129,346216); existing copied selection closure [214541,224374) |
| chunk-1r9zp6s1.js | 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e | facade wC [26659,27318) |
| chunk-kexg5hxg.js | ff0c3b2de749b1a99560e47932f3e6f8976b4128d678bf28189128944cadd3f4 | environment helpers [7479,7706), P6e [7870,8206), terminal sets [8210,8411), pye [9493,9683), yxn [9683,9717), mt/_xn [10057,10253) |
| chunk-eb9r2hbv.js | 3b1f83a5d1fcec7a1aa8a7d0adf139d8643ace6755985b79f19ddc1e7de22abe | existing ra [720,803), AZ [991,1071) |
| chunk-yvnhkg35.js | ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d | Fse [6703,6878), ITo [6878,7089), xt [7089,9042), Z [12597,12692) |
| chunk-5dxmnnh1.js | e606440bafb72dea60a46e063e4923a299c7071c6560e7fc58e0d2a45a135cfb | existing Nx class [814,1981), R [1981,2103) |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | existing key registry [1964,6000) |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | ce/Ce/Ri/xi global settings chain recorded in W293; copyOnSelect key at560202 |

## Port and host adaptations

src/tui-selection-copy.ts copies QLt, lbt, AZ, ITo, xt and Z. The xBe subscription callback retains its exact control flow with only clipboard_write telemetry removed. Hook refs and effects become one terminal-owned observer. The verifier erases TypeScript types and compares these seven AST bodies. Refs reset on a drag or empty selection. A completed selection calls copySelectionNoClear once, then caches the returned nonblank text. Later selection changes invalidate that cache without recopying. Changing the preference alone emits no selection event.

Native copySelectionNoClear now writes through W37's OSC52 boundary before returning its selected text, matching the source's side-effect order. The transcript facade uses its existing wrap-aware text extractor and the same writer. Whitespace is checked after this call. Empty legacy text still clears on explicit copy and redraws the cleared cells. This retains the preexisting 100000 UTF-8-byte cap and tmux/screen framing. A failed bounded write reports the error and retains the span for a later action.

TuiTerminal owns both facades. Legacy state assignments notify the observer; native changes use subscribeToSelectionChange. Renderer construction installs that subscription even when a dialog or search created the renderer first. Native notifications caused by clearing an inactive facade do not invalidate a live legacy cache. Each new selection resets the source latch before release. Node removal clears scoped native selection. Resize, layout-setting changes, editor handoff, search, dialogs, session rebind and close clear or suspend ownership. Transcript entry and exit clear the legacy frame coordinates because the host changes timestamp rows between these views.

The physical-key adapter runs rI's selection handling before context actions, as well as for typed dispatch. Ctrl+C copies or clears the cache before transcript exit, Vim or Global interruption. QLt preserves Escape, wheel/page scrolling, Ctrl+Home/End and modified selection navigation; lbt preserves transcript scroll keys. Ordinary registered actions clear the text selection. The source's IDE-selection deletion provider has no separate local counterpart and is not introduced here. With no span, existing composer and interruption owners receive their keys. Disabled auto-copy paints ctrl+c to copy using the existing footer allocation.

The source Config row writes global Ce and its live snapshot, defaulting to true without a remote flag. This host stores that global preference in user/settings.json through the existing queued atomic writer. The loader projects it from the user layer after ordinary settings merge. Project, local and explicit settings documents do not override this user-global field. Invalid user values fail the normal boolean boundary. Startup, strict session metadata, resume, reload deletion, live Config application and terminal binding consume the same field. All three runtime identity readers exclude it from tool/connection identity. Full session identity retains the field under its existing contract.

Vln's OSC52 arm uses the copied grapheme counter and local terminal detection. P6e is adapted only for the host platform and absent attached-terminal context. Native clipboard helpers, tmux-buffer probing and native-only coaching stay excluded. The existing Nx dependency preserves the VS Code1.123/1.124 Unicode warning and its6000ms timeout; normal OSC52 feedback uses4000ms. The keyed status notice owns expiry and close cleanup. These are terminal requests; system clipboard acceptance is not claimed.

## Verification

- npm run check and npm run build: exit0.
- Affected tests:153/153, exit0. Command: node --import tsx --test --test-reporter=tap --test-concurrency=4 --test-timeout=20000 test/tui.test.ts test/selection-copy.test.ts test/config-panel.test.ts test/runtime-resources.test.ts test/terminal.test.ts test/spinner-tips.test.ts.
- Three new regression groups cover latch/cache/whitespace/byte bounds/native effects, real input and screen-cell ownership, and user settings/reload/session binding. Existing Config pagination and runtime-owner regressions were updated without dropping their original assertions.
- Compiled .audit/w294-copy-on-select.mjs:29/29, four owned loopback requests, exit0. It verifies exact Unicode and ordinary text, release timing, retained draft/highlight, copy dedup, live user writes with unrelated keys, project-layer exclusion, stash and transcript cleanup, active-request interruption, reload, restart, process exit and journal locks.
- Existing compiled .audit/w233-config-panel.mjs:35/35, exit0 at the same content identity.
- Source .audit/w294-source-compare.mjs:11 module hashes, seven copied AST bodies, literal Config gate and six adapted character comparisons, exit0. The comparison report is $CLAUDE_JOB_DIR/tmp/w294-source-comparison.json. Character diff digests are observer-feedback99ca538ef53a36c4eac496413bf87d36c0045c561afd72a36883218435999c02, physical-keye3915ecfa85f6089106839b9a320d404cefe2a0be57097f809f15b97e3ae6e81, native-copyb345583058821711f4043eb9a494c51a64b379a6e84a873073b043644a7f4a6c, config-row6f52262cd0fa530174f54763c4d3c8c3995559055aad4631b7f747131409d9e6, settings-consumers679363b32559461e633dd65308d1ae198c6012a5a358bc2d27445f2a1ca1106a and footere22fd630641524b54d5b9dc502640db71e9a616dc28027b9bfca5e37a6e62ec5.
- Independent review reproduced five defects across two passes. Each was repaired against its source owner: empty-text teardown, transcript Ctrl+C priority, ordinary registered-action invalidation, empty-copy repaint and Escape view-exit coordinates. The permanent regression failed before both repair rounds. Final independent probes pass12 input scenarios and2 residual-boundary cases. No confirmed scoped defect remains. Reviewed tui.ts SHA-256 is01de9bec38d8bc98c12f85cc0a8a0d6d722e1dc30a9c177099a28f954db7936c; selection-copybb0ccc6a78c3f1de53695cdbd76d394a93d91bd1dd5a762c3f2514273f88e84e; renderer71507fc8c1f0886c6fd509bf40d040dbed6ce93b6a01d9aa173380445c43d6e3.
- Scoped comment review suggests zero deletions and zero code reshapes. Added comments retain S-7 provenance; no new type or lint suppressions.
- Full suite, package smoke and live Magpie:not_run. W283's known full-suite CLI-effort mismatch remains the baseline. Paid upstream calls:0.

Delivery identity is14735b9e248939d8febe51b368278052f0957b0e4df1fc194beb29b3bb4ab8f8. Inputs6912a377a4ffd3ba5d952e962c7a82b17dc42f97cf72f0b812f7fa5f3022be7e; tests6c476dea1f5f5d103dd9aa2b9f66b9774cb628301d773a89bdf310d526831a8d; builda01e8097e4db98faecbab81a47eb33d966bc6f4a1b55f9eb2e7300c4ef7f585e. The shared identity script records829 input,303 validation and590 build files. Counts are inventories, not completion percentages.

Logs are in $CLAUDE_JOB_DIR/tmp: w294-affected-delivery.log, w294-check-delivery.log, w294-build-delivery.log, w294-source-delivery.log, w294-cli-delivery3.log/json, w294-config-delivery.log, w294-independent-final-boundaries-fixed.log and w294-independent-repair-recheck-final.log. All owned PTY/CLI processes and journal locks were checked released.

## Rework and remaining boundary

Initial corrections covered nullable renderer reads after extraction, Config's new-row pagination, xterm's numeric inverse flag and a clipped feedback assertion. The final compiled Escape probe needed to wait beyond the standalone-Escape decoder deadline before sending another CSI sequence. Exact clipboard and highlight assertions remain. apply_patch is absent from this host, so manual edits use dedicated Edit/Write tools. Rework is also recorded in the existing ignored research/question.md. Its unrelated historical contents remain outside this commit.

S-1/S-7 bind exact source ranges before edits and compare copies/host adaptations. S-2 retains draft, settings, request and pagination contracts. S-3 checks rendered cells and copied graphemes separately. S-4 owns selection cache, subscriptions, feedback expiry and frame teardown. S-5 waits for the right screen and decoder boundary. S-6 updates all config and runtime readers. The five review repairs fit these existing rules.

The earlier blanket claim that copy-on-select sits behind a false-default remote flag is superseded. Notifications, terminal tab status, prompt suggestions, auto-scroll, copy-full-response and source-gated timestamps still require their own consumer preflight. No account, subscription, OAuth or vendor network surface was added. Product-wide TUI parity remains Partial.
