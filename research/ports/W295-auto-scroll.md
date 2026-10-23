# W295 Auto-scroll

Status: verified locally, 2026-10-23.

## Task card

- Entry: Config Auto-scroll, default true; local transcript scrolling, output growth and bottom affordance.
- Shape: one terminal-owned viewport with explicit sticky state, fixed position, content-height high-water mark, user-away latch and unseen-message boundary.
- Source: rMe/pee/ybt/Sbt/bbt, p4, native OT viewport, Us growth calculation, nmt/Vc indicator and Config hs/D6 chain.
- Method: copy obtainable helper bodies and adapt native node/ref/store ownership to the existing transcript renderer. Keep the source's sticky/fixed distinction and force-bottom paths.
- Targets: new scroll owner, TuiTerminal, native pill renderer, Config/settings/session/startup/reload/live bindings and runtime display identity readers.
- CLI: owned loopback streaming response, manual scroll, Config off/on, existing sticky retention, fixed bottom on incremental scroll, forced bottom, draft/submit, reload/restart and cleanup.
- Checks: at most three new regression groups; source comparison, affected tests, check/build, compiled PTY and bounded independent review.
- Constraints: local-only functions, no account/subscription/OAuth traffic, no push and no commit attribution. Keep original extracted files unchanged.
- Host fallback: apply_patch is absent (command lookup exit1); dedicated Edit/Write tools perform manual edits.

## Source preflight

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
All ranges below use zero-based UTF-16 code units and half-open intervals. Module digests were checked against extracted-v2/manifest.json before implementation. Recovered application entrypoints remain inert.

| Module | SHA-256 | Relevant bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | rMe [130997,131148), pee [131148,131363), ybt [131363,131524), Sbt [131524,131640), bbt [131640,132084), rI key routing [126888,130997), p4 [1333944,1336535), submit repin at1490513, prompt onEdit at1686902 |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | vWe [7247,31899), W/G [8208,8318), autoScroll row [24065,24243), onChange [24168,24242), literal inAppSelection producer [37501,38693) |
| chunk-js2bhabe.js | f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de | hs [1114,1499), D6 [1499,1554), legacy autoScroll settings key at863 |
| chunk-bk5ct2gw.js | efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | true default at558597, fP [120895,121185) |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | optional boolean autoScrollEnabled schema at273529 |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | Hhe [1133554,1133604), Fvn at91100, C5r [91058,91100) |
| chunk-3gz7s57c.js | 9d44818f1c5a17e8ddddbce66694eab43a75e489d8afbeaf0369756daf2e378b | uIe [11363,11607), Dv [28427,28622), Av [28622,28754), iLo [28941,29232), nmt [29232,37785), pill predicate [31126,31380), OT props [32327,32433), Vc [41715,43141) |
| chunk-6x3scwgf.js | db830997e9e573f4e51e1bc73ab09b1f550928c0078ce2803e609951b593cac6 | OT/K [993,3947), scrollTo [1537,1740), scrollBy [1953,2147), scrollToBottom [2148,2375), isSticky [2770,2871) |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | Us [282894,292074), growth/high-water [286619,287168), retained position/render clamp [287168,287950) |
| chunk-3c5vzz43.js | 347697a0ed5b1cac607d2b1f64804c5dbd13087c6d6742a53237ab21947ca54c | Xw [753,1088) |
| chunk-ax7r0qj7.js | 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e | I [798,839) |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | wU [118298,118419) |
| chunk-d65c1ax2.js | 09a0da30950cdb96d06fd28d9663cdff90510fbf763f4e9c077ad011cb132a8b | n4t [6327,6376), r4t [6376,6427), first-observed mouse store |

The Config row shares inAppSelection:true with Copy on select. Its label chooses Auto-scroll when Hhe's maple_sundial gate is false. The setting uses the ordinary merged-settings reader hs and userSettings writer D6, unlike Copy on select's global-only Ce preference. A higher authored project/local/explicit layer keeps precedence after a user write.

Source scrollTo explicitly clears sticky, pending deltas, anchors and the height high-water mark. scrollToBottom enters sticky regardless of followGrowth. Us follows existing sticky even with followGrowth=false. For nonsticky positions it follows only when growth is enabled, height has not shrunk, and the retained position reached the prior high-water bottom. Closing Config changes the flag without immediately unpinning. Incremental scroll that reaches bottom uses rMe, so off fixes the current maximum; explicit bottom and jumpToNew force sticky. p4's nonforce repin guards edits, submission, own user rows and below-transcript slot changes. User scroll-away blocks the empty-to-typed edit repin; own submission may still repin when enabled.

The host already projects rendered transcript rows and owns native reconciliation separately. The adapter will retain that renderer boundary. The source's observable/ref stores become direct terminal-owned calls. No remote agent-view or reveal provider exists in this host. Its existing transcript frame and selection paths remain local adapters. Unseen counting projects text/user/tool/duration entries into source-compatible message records; Dv/Av count consecutive visible assistant groups. Thinking-only and remote attachment branches have no corresponding rendered local entries. Telemetry counters and diagnostic logging are excluded. Source defaults and full functions remain the basis for each adapted branch.

## Port and adapter

src/tui-scroll.ts copies rMe, pee, ybt, Sbt, bbt, Dv and Av. The verifier erases TypeScript and compares their complete function bodies. hs reads the terminal-owned effective flag. Fvn is a no-op binding for the excluded scroll-cap counter. PageUp/PageDown use rI's half-viewport branch. Explicit bottom uses bbt's forced scrollToBottom. Wheel movement retains this host's one-row increment and uses the copied source direction branches. Acceleration and telemetry remain outside this package.

TranscriptScroll adapts OT's node state and Us's measured-height calculation to the existing synchronous rendered-row projection. It retains stickyScroll, fixed scrollTop, scrollHeightHwm, previous content and viewport heights, and pending delta. The projected offset is the visible clamp, while the node retains its higher fixed position across content shrink. Output never recovers stickiness merely because a shorter render put the visible offset at its temporary maximum. A later growth at the source's prior bottom can recover sticky when the setting permits it.

The p4 adapter owns the user-away latch, below-transcript slot, unread start and divider height. Terminal draft replacement, own submission, externally appended user rows, streaming replacements, layouts and frame changes use this owner. Modal and history-search transcript views measure it with their own current height. Rebinding another session resets the owner. Close releases retained entries and pointers. The source's absent reveal-ref, remote agent-view and away-summary services are not introduced. The existing pure transcript reducer remains available for its independent consumers; TuiTerminal no longer interprets MAX_SAFE_INTEGER as sticky.

Dv and Av count source-compatible assistant groups. The owner projects local assistant text, user/tool/system records and duration-as-progress records. It requires a visible unseen record before applying the source's minimum-one count. Growth of the same streaming entry changes height without inventing a new message. The source's full message UUID, attachment/thinking suppression and horizontal unseen-divider renderer remain outside this projected local transcript. The bottom pill uses the recorded divider height and count; this package does not claim that entire message model or virtualized transcript is copied.

ScrollPill adapts Vc's label, width fallbacks, platform/key hints, native hover, background and absolute placement. Xw's two-space padding is inlined over the existing native Text. The copied host chord formatter supplies readable bindings. Source telemetry clicks are excluded. The pill uses the native tree hit test, not a row-text click approximation. Its pointer state is cleared by overlay/search/editor handoff, target disappearance, new session, resize and close. A first press retains its painted label through release so the macOS mouse hint does not move the centered target midway through the click.

Config adds Auto-scroll after Copy on select. It writes autoScrollEnabled into the queued atomic user document, then reloads the effective merged value. Startup, strict metadata, resume, reload deletion, live Config and terminal binding consume that same optional boolean. All three runtime display fingerprints exclude it from tool and connection configuration. Default absence means true. Copy on select retains its separate user-global contract.

## Verification

- npm run check and npm run build: exit0.
- Affected tests:153/153 across test/auto-scroll.test.ts, test/tui.test.ts, test/config-panel.test.ts, test/selection-copy.test.ts, test/runtime-resources.test.ts and test/terminal.test.ts. The affected150/150 run and new3/3 run use the same product input identity.
- Three new regression groups cover source sticky/fixed/HWM transitions and progress-only counts, real terminal output/pill/submit/modal/pointer/resize behavior, and Config merge/persistence/reload/session metadata.
- Existing Config pagination now reaches the added row and final page with three page actions. Existing prose/highlight tests assert real following output instead of the removed sentinel. Their raw source, selection and scrolled-position assertions remain. The contextual PageUp expectation follows the recovered half-viewport branch.
- Compiled .audit/w295-auto-scroll.mjs:23/23, three owned loopback requests, exit0. It verifies streaming scroll position, enabled/off sticky behavior, incremental versus forced bottom, native hover/click, actual retained draft, user file preservation, effective project precedence, reload, restart, zero exit and journal lock cleanup.
- Existing compiled .audit/w233-config-panel.mjs:35/35, exit0 at the same identity. It retains child picker, failure/retry, narrow layout, model/effort request and lock checks.
- Source .audit/w295-source-compare.mjs:13 module hashes, seven complete copied AST bodies, literal Config gate/default and five adapted character comparisons, exit0. Report: $CLAUDE_JOB_DIR/tmp/w295-source-comparison.json. Adapted diff digests are growth-owner4f7dd8e190ee3a2816b32b423585c332c8411d8be6330ae7d464964cef666d23, repin-dividerae0324dec6bc34dd36a6f69f273c40ab8cb4562c1ec9d038df70b18e82dca139, pillb9ef654ec5dd97dcbb573855754d0596651fce666e2e50ab42b44d9545af7aed, terminal6365e78b58ec627f3aedbade3ea9fe50b78e77000a9d25a62bbfe4b44e1cd5b9 and settings10f74b69f9f4dc0269acbf89d2a47f4c2994a3d31d2a741974c4fa7d279b2dc7.
- Independent review reproduced three defects: modal viewport tail loss, duration-only false unread count and a pending pill press crossing modal teardown. Each permanent regression failed before repair. Independent recheck confirms all three repaired, plus sticky/off/incremental/forced, user-away edit, own submit and shrink/regrow checks. Final log: w295-independent-probe-final2.log. Reviewed tui.ts SHA-256 b20924cee20f8ffaf149efd2d3b4ba928016da8cf4a0d64a53bbe92bdacea84f; scroll owner b4a6cab7cf98be2d57ff2444d78413d5d1de540cea6aaa1cedf451b3d170f96c; renderer d6fa27359e7e67a145375899dfa85e943c0f4f92473750925340bbcb2d4bf549; pill bde478b892af1ee41a3de3c4472b8614b52eb17d84a651f8c17597eeacbdc79e.
- Scoped independent comment review: zero deletions, zero new suppressions and zero MUST KILL flags. Source provenance comments remain under S-7. Working diff whitespace check passes.
- Full suite, package smoke and live Magpie: not_run. W283's known CLI-effort mismatch remains the full-suite baseline. Paid upstream calls:0.

Delivery identity: d22f5e4249421c8cdd1d40102db77e382e875b0f7c1e08283bdb708e10b75dde. Inputs c93d43c205b6c36a97b4509c7af70447155d7057a87f2a4439409cd67b3da5d5; tests 57385d798e92c872c0243fddf135fd36424959fd5356511e17314a835a4d6276; build 97d17938f541c84a86de2a50d2c4c1f235cf95e656beb33adf169a7f87887d0f. The shared inventory contains831 input,304 validation and592 build files. These counts are inventories, not completion percentages.

Logs under $CLAUDE_JOB_DIR/tmp: w295-check-delivery.log, w295-build-delivery.log, w295-scroll-delivery.log, w295-affected-repaired.log, w295-cli-delivery.log/json, w295-config-delivery.log, w295-source-delivery.log, w295-source-comparison.json and w295-delivery-identity.json. All owned verification processes exited. The compiled driver checks journal lock release and closes its streams/server in finally.

## Rework and remaining boundary

The initial affected run passed117/121. Source page increments and the new Config page were measured before updating their existing assertions. Old sticky-sentinel assertions now check the same user-visible following behavior. A new HWM expectation initially ignored the source's retained physical position; the regression now distinguishes stored position from visible clamp. A progress-only regression first placed the unread boundary before existing content; its setup now matches the independently reproduced source path. Native-tree inspection showed pass-through Box metadata lives in style. First-mouse label changes required preserving the pressed target. Permanent tests cover both defects.

The first compiled driver enabled Reduce motion, whose existing Zqn gate deliberately holds raw streaming previews until completion. The fixture now selects ordinary streaming mode. Later driver corrections match zero unread count during growth of an existing message and the Config inline label/value layout. These corrections changed the driver only. The final click assertion checks a real nonempty draft. Research/question.md records these rework causes locally without adding unrelated ignored history to this commit.

S-1/S-7 bind exact recovered bodies, module hashes and copied ASTs before edits. S-2 preserves original behavioral assertions while replacing stale representation checks. S-3 keeps rendered rows, raw assistant source and message counts separate. S-4 owns viewport/HWM/divider/pointer teardown and modal geometry. S-5 waits on actual streamed tails and authored settings. S-6 covers configuration, runtime fingerprints, all visible viewport consumers and drivers. The review findings fit these existing rules.

Auto-scroll's previous false-default gate claim is superseded. Remaining local notification/tab/selection consumers still need individual source preflight. Account, subscription, OAuth and vendor network services remain excluded. The feature family remains Partial.
