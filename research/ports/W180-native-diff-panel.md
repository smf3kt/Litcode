# W180 native diff panel

Status: verified for the local fullscreen sidebar usage chain. Date: 2026-10-18. C-2 remains Partial.

The fullscreen TTY `/diff` toggles the recovered Git sidebar beside the conversation and composer. W173 verified the separate inline dialog in isolation. Its historical completion claim is now limited to that component chain.

## Source identity

All ranges below are zero-based UTF-16 half-open intervals. Each copied block records the module SHA-256, range and body SHA-256 in its adjacent `src/*-blocks.json`. The final verification checks module bytes against those digests and requires the exact block text in the product file. The recovered application entrypoints remain inert.

| Module | SHA-256 | Owners and ranges |
| --- | --- | --- |
| chunk-kexg5hxg.js | ff0c3b2de749b1a99560e47932f3e6f8976b4128d678bf28189128944cadd3f4 | Context qt [3534,3699), element Tc [3700,4072), hooks [4439,5085). |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | HostConfig [177956,180869), pointer events/hit test, selection [214541,224374), Vd [250176,250654). Adapted Aje scroll carry [322746,323670), extraction/copy [343861,344379), color/focus [345248,345978), selection subscription [346023,346129), pointer selection [350700,351231). |
| chunk-bwyexfny.js | 35fae44d02574c1e366e2c50484d2ce75e87a0b017d91b0e5a8a6ca4bc8ff647 | GFt [1998,2124), Jmt [2143,3552), Lc [3552,3579), ZD [3579,3835). |
| chunk-frj2b06g.js | 1f4f2bc8200dcb30a20f5dfea1c04546696e503b3adf71412ec65c98a119f00e | Handler ordering and dispatch Yt [7157,11338). |
| chunk-6ccen3s8.js | 4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d | Shared chord resolver [36598,38706), existing copied key table. |
| chunk-8256f27w.js | e15ddd3aab2f08007efc3791272cfd487f473ff4796714ff783a3bc17f22a3fc | Fullscreen s and inline r dispatcher [5320,5641). |
| chunk-xmvfy87k.js | fabe23b454accb5fcb9390965e13cd815400518e90b86cb9550d55aae113ade0 | K [1883,2290), Wcn [2589,2736), WKn [2736,3956), eligibility/auto-open/toggle [6434,7624), MMr [7743,7878), base preferences [7919,8196). |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | Width _0 [462495,462544), h7 [1664288,1666412), sidebar and controls [1666412,1678857), S_e [1656579,1657226), x_e [1662474,1662799). A4 selection methods [1486702,1487552), Hlt [1488693,1488828), prompt gate [1492693,1492930), queue capture [1495002,1495142), queued consumption [1422149,1422376), footer selection [870500,872050), footer actions [888000,889650), dismiss [892200,892650). |
| chunk-wzat8kak.js | 2624613a5b7fad1c3bf28dac9c3473ac5be30c4294b53f4cd162afe084c2289e | Minimum and automatic widths [766,785), 110 and 144 columns. |
| chunk-j8hqhz0c.js | 484244ab875460f17f03ba710c6297940ac16c3742592218c4c05af8d9815891 | uxn/helpers [19725,23871), merge/rebase guard [29373,29664), base/untracked [30153,32005), merge-base preference [33547,33868). Host map parser/cache [5002,5768), explicit base ref [34177,34308). |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | Diff attachment Oyn [3669357,3669904), text wrapper [4438375,4438416), 2000-unit bound [4454587,4454667), message converter [4460985,4461259). File-history reducer [4728518,4730433), pre-write Fet [4731316,4732048), shell touch [4343060,4343760), shell read classifier [4329025,4329121). |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | Ledger sessionStartTime [25663,25703), logical anchor [26610,26770), R1e [80421,80477). |
| chunk-qh0w98pn.js | a6f4555b23f747a11e952695c27895a1f2c76e2cf92396754242e9c23fdd8472 | Existing copied mr [34940,46581) and Qs [7830,8512). Vim and composer share painted width. |

The six new source files contain 29 copied regions and 40,073 UTF-16 units. Their complete source maps also cover the generated/test classifiers, path truncator, subscribed scroll handle, delayed spinner, progress bar, selection identity and path sanitation. Existing pBe/H4, OT, themes, reconciler, layout, paint, key tables and hooks are reused.

## Integration and host adaptations

`nativeElement` translates the existing source element records into native React elements. Function wrappers are cached by source function identity. Original props reach the source function before its returned tree is converted, preserving child-type inspection. Real dispatcher hooks hold state, refs, layout effects and passive effects. The isolated runner retains its established explicit contracts. Actual React contexts retain `defaultValue` for those isolated consumers.

`TuiRenderer` owns the reconciler root, layout subscriptions, pointer events, selection and front/back frames. Asynchronous commits schedule terminal repaint. The copied selection handles scope, soft wrapping, scroll carry, multi-click spans, extraction and paint. A selected scope must still reach the renderer root after reconciliation. Unmount clears it before replacement cells can be read. Native selection readers are bound through the per-renderer context, with explicit isolated bindings retained.

`DiffPanel` belongs to one session. It owns Git data, cancellation, a prime store, settings and registered native handlers. The terminal resolves composer and mounted sidebar chords once, then invokes the source-ordered handlers. This prevents the two consumers from separately holding Ctrl+X. Ordinary and Vim navigation use the narrowed composer width.

`collectGitDiff` now calls the copied uxn collector. HEAD, cached/unborn, branch and session selection precede hunk collection, so totals and hunks use the same revision. AsyncLocalStorage supplies cwd and the session start time. Git runs through the existing controlled environment and bounded Node process host. Pcr reuses the complete copied Unicode character class. Explicit base references preserve undefined/null/string semantics and checkout-map insertion order. Environment keys are neutralized to LITCODE_REPO_CHECKOUTS, LITCODE_BASE_REFS and LITCODE_BASE_REF. Per-collection parsing replaces source host-global map caches.

Panel opening primes data before mounting and the command returns after at most 2000 ms. A saved base is session, uncommitted or branch. Initial visibility remains conversation. Automatic opening requires tracked session files, 150 ms settling and the source width rule. Explicit false suppresses it, explicit true permits 110 columns, and absent preference requires 144. Closing aborts work and saves false. Narrowing hides the current sidebar; widening can mount it again.

The local session journal records the logical start and file-history touch/track events. Old journals fall back to file birth time. Resume restores both. Configuration, fork, rewind and workspace continuation inherit the logical start. Write/edit/notebook tools notify before mutation, and shell completion emits a touch. Tracking requires enabled local checkpoints and an existing snapshot. Source backup storage remains the existing local checkpoint subsystem. The source shell classifier is not available as a complete owned classifier, so the local shell host conservatively touches after every command; it can cause an extra local Git refresh. Session notifications retain the track sequence while the panel is hidden.

The copied A4 methods own an independent pending diff selection. Selection never edits the draft. A normal prompt consumes it into a queue entry containing the prompt UUID and originating session ID. Slash and bash input leave it pending. Execution and restoration check the session owner. The copied converter creates a separate meta user message with a 2000 UTF-16 unit text bound and path sanitation. A failure before recording that message restores the selection without replacing a newer one. Footer focus and removal use the existing footer keys.

Accounts, subscriptions, OAuth, remote-workspace transport and telemetry network calls are excluded by the user's local-only requirement. Source notification backlog draining has no corresponding held-notification queue here. Its host callback is inert. Modal/autocomplete state is handled by terminal subtree visibility. The progress bar uses the source default block variant; the unused pill capability probe stays false.

## Verification

The existing driver `scripts/smoke-tui-mouse.mjs --diff-panel` exercises the compiled CLI in a 160-column PTY. It toggles the sidebar, switches base, scrolls, selects five exact cells, verifies OSC52, closes while retaining the attachment, submits the unchanged draft and checks the next model request. The provider is an owned loopback SSE fixture. One model request, zero paid upstream calls. Terminal modes and session locks are released.

Three new regressions cover native state/context/ref/effect cleanup and selected-scope unmount, the sidebar with shared chords/Vim/selection/attachment/removal/auto-open/tool refresh/journal resume and queued cross-session isolation, and real Git HEAD/unborn/branch consistency. The affected seven-file suite passed 166 tests before final review fixes. Final checks and content identity are recorded in W180-native-diff-panel-evidence.json.

Independent review found four P2 regressions during implementation. Shared chord ownership and Vim width were corrected and independently confirmed. The later queued cross-session attachment and detached native selection findings were reproduced, fixed and independently reverified on the original probes. No findings remain from those reviewed scenarios. A read-only comment pass found four redundant lines; all four were removed. No generated provenance comments were removed.

S-1 through S-7 were checked. Failures and rework are in question.md. Source-copy verification is exact. Adapted methods were compared with their recovered branches and host differences above. The final full suite passed 2598/2598 with zero failures or skips. Check and build exited 0. Notices check exited 0 and retains its five pre-existing missing-text entries listed in the evidence. Final source/test/build identity is `e662b499f52b3c321d62112c4a98bdc73dc40af6aa5a048161563063dc55d8f5` (704 input, 230 validation and 483 build files). Complete shared UI rendering and inline dialog production mounting remain separate C-area work.
