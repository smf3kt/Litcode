# W234 auto-compact setting

Status: verified locally and independently rechecked, 2026-10-21.

## Task card

- Entry is Config's Auto-compact row, currently absent after W233.
- Outcome is a persisted local boolean that controls automatic compaction while manual /compact and the existing /autocompact window remain usable.
- Source is vWe's row, its global writer and default, plus the actual automatic and manual compaction gates. A bounded reader owns that closure before product edits.
- Targets are config-panel, settings persistence/loading, session schema, reload, interactive application, Agent runtime and autocompact captions.
- Data is the recovered boolean, carried through the owned session config. No separate action framework is planned.
- Existing adaptation is the product's single compactAt window rather than the recovered per-model table. Gateway routing stays with Magpie.
- Acceptance uses compiled CLI Config toggle, actual count/summary requests, manual compact, reload/restart, errors and clean exits.
- Checks are 0-3 necessary regression groups, related tests, check/build, exact source comparisons, independent review and content identity.
- Scope remains local. Account, network subscriptions, OAuth, push and paid upstream calls remain excluded.

## Existing consumers

Agent.run compares token count with config.compactAt at its loop boundary and before attaching
media. compactContext calls the same compact body with trigger manual. The summary body invokes
PreCompact/PostCompact, requests a tool-free summary and checks that the summary frees context.
W214 owns the threshold command and its fixed-message chooser. W233 provides the Config list,
immediate atomic settings writer and successor-session apply path.

## Source gate

Artifact SHA-256 is c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Coordinates are zero-based UTF-16 half-open ranges. Source bodies were read as inert text,
module hashes checked, and declaration bounds checked with Acorn before product changes.

| Module and SHA-256 | Acquired body |
| --- | --- |
| chunk-nybcbd9t.js, 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | U2t/K [5051,6155), W [8208,8266), row [12034,12244) |
| chunk-js2bhabe.js, f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de | hs/D6 [1114,1554) |
| chunk-bk5ct2gw.js, efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1 | Ze [558427,559209), true default [558575,558596) |
| chunk-14rnebpd.js, d1ba8228f324b01eb984c0a09eed1095d0bb0e6ace7c295b0c0fdb03a17be810 | Gm/ef [317863,318021) |
| chunk-fdxhcr6b.js, 3c625e31827ca4ef7cc3a4691103fbbb3abbdd338778cbf70c0054f37359507b | Ne [615,757) |
| chunk-sfn1dbxq.js, 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | L$e [859411,859734), Mrr [863158,863237), gF [880227,880250), Rfo [1132121,1132437), Gur [2593055,2593868), jXr [2594155,2594246) |
| chunk-qy8qtapj.js, 978650286e1e00b449ef14aa30ebf9e19c1dab938c2be4ee698d788f7b2845a8 | compactManually [14510,15263), D [15263,19143) |
| chunk-5b2hxy2e.js, 46d7f73a2b28fd9493ecf37d85abc89acd020f6de7e2bdb83efe621811f12656 | yd blocked outcome [147582,148075), QH terminal completion [125441,126326) |
| chunk-agx4redd.js, cab9f4f64094d99c72ce9e0ba08b19e54674d00ab32ffaca90dfd9667af6a6de | status w [1174,1968), threshold setter $2t [1968,3167) |
| chunk-c27zz9xr.js, c53fa3e31a80e202f6222f8a2fce021df73abf4d53961da47286de0a6472e94d | dialog ue [15808,19858) |

The row id is autoCompact; the persisted user key is autoCompactEnabled. Missing means true.
D6 writes userSettings, not the legacy global writer. hs keeps explicit false and honors higher
settings layers. The panel reports accepted changes on close without rolling them back.
Gur returns before threshold evaluation when ef is false. Manual Rfo checks only DISABLE_COMPACT.
Ne accepts trimmed, case-insensitive 1/true/yes/on. The runtime env getters are live.
L$e keeps its blocked boundary independent from enable, with Mrr subtracting min(maxTokens,20000)
and L$e a further 3000 tokens. Manual finally releases compact status; existing Agent owns
signal and busy cleanup.

## Adaptation decisions

Retain one optional boolean in SessionConfig and typed ConfigUpdate; do not serialize environment
values. The effective policy reads LLM_DISABLE_COMPACT and LLM_DISABLE_AUTO_COMPACT at use time,
neutral mappings of the two recovered disable variables. Config continues to show its authored
setting while command captions and automatic gates show the effective policy. Existing loader
merging supplies local precedence; after a user write, reload that one setting through the merged
loader so a higher authored value still wins. The pre-existing single compactAt host window,
512k default and window chooser remain W214 adaptations. PCT/window/vendor model experiments,
precomputation and overflow classifier are outside this package.

Adapt the two current automatic callers, including the host's attachment-precompact path. A disabled
automatic threshold is not a hard input ceiling; retain an independent Mrr/L$e capacity guard.
Manual compact and its summary circuit breaker stay separate. A summary must also fit capacity,
even when explicit compactAt exceeds it. Keep existing queued atomic user writes and successor-session
application. The compiled disabled-window-change probe exposed the W214 handler's in-place mutation;
$2t's apply_flag_settings event is now adapted through applyConfig, so the next turn uses a fresh
runtime owner. The recovered yd blocking_limit return is adapted through Agent.finish, producing
Prompt is too long and a durable turn_end; manual /compact remains reachable afterwards. A throw
at that point left this host awaiting a response and was corrected against QH's terminal outcome.
The summary capacity guard also returns the typed blocking_limit outcome; automatic callers finish
the pending turn and manual callers retain a retryable error. The original independent summary
probe showed that merely throwing here stranded the turn after append. No new dependency or
stateful scheduler is needed.

## Port map

All product bodies are adapt, not byte-copy. Settings and UI state use the existing local owners.

| Target | Acquired source | Adaptation |
| --- | --- | --- |
| config-panel.ts, config-panel-input.ts | vWe, U2t, Ze | Add the first boolean row to the existing source list with absent=true. |
| theme-settings.ts, interactive.ts Config callback | W, D6, hs | Existing per-file queue and atomic JSON writer; merged local loader preserves higher precedence. |
| runtime.ts, cli.ts, session.ts, reload.ts | U2t, hs, Ze | Optional validated boolean survives the local session snapshot without environment values. |
| compaction-policy.ts | Ne, Gm, ef, Mrr, L$e | Pure capacity helper and live neutral environment lookups. |
| Agent.run automatic callers | Gur, L$e, yd, QH | Existing single compactAt and attachment host branch; finish blocking_limit leaves manual recovery reachable. |
| Agent.compact and compactContext | L$e, yd, Rfo, manual b | Typed compacted/blocking_limit result, tool-free summary and manual gate. |
| interactive.ts threshold apply | $2t | apply_flag_settings becomes successor Session/runtime binding rather than an in-place mutation. |
| autocompact-command.ts captions | w, ue | Restore the disabled caption through the effective enable policy. |

## Throughput

One bounded source reader and one lead writer follow WORKFLOW section 6. The source reader owns
the recovered gate closure; the lead maps existing consumers and retains a compiled baseline.
Typed ConfigUpdate and the existing session config carry the boolean. Runtime fixtures prove
summary calls and saved bytes, rather than only observing a changed toggle label.

## Validation

Baseline compiled Config at HEAD 8d85356 has no autoCompact result. Final owned-loopback acceptance
uses the built CLI through expect and a 90x30 xterm decoder. The new driver passes 26 checks.
The existing Config driver passes 35, including Model/Theme/Time format and 20-column pointer
interaction. Both bind the exact final source, tests and build below. No paid or Magpie request
was made. Full-suite and package/archive acceptance are not run for this local settings package.

Commands, all exit 0:

- npm run check.
- npm run build.
- npx tsx --test --test-concurrency=2 test/autocompact-toggle.test.ts test/config-panel.test.ts test/autocompact-command.test.ts test/context-threshold.test.ts test/agent.test.ts test/agent-lifecycle.test.ts test/agent-output.test.ts test/runtime.test.ts test/reload.test.ts test/session.test.ts test/interactive.test.ts test/media.test.ts test/subagents.test.ts, 164/164.
- node .audit/w234-autocompact.mjs, 26/26.
- node .audit/w233-config-panel.mjs, 35/35.
- node .audit/w234-source-compare.mjs, eight AST-bound character comparisons, 61023 diff bytes.
- node .audit/w234-records.mjs CLI_RESULT CONFIG_RESULT SOURCE_EVIDENCE .audit/w234-evidence.json.

CLI evidence covers immediate false/true writes, malformed-file retry, current successor metadata,
restart/resume, both automatic callers, actual summary/no-summary requests, manual custom
instructions, neutral environment overrides, disabled caption, threshold change plus next turn,
held request cancellation, blocking_limit/manual recovery and oversized-summary/manual recovery.
All owned CLI processes exit 0 and release locks. Source comparisons are row, persistence,
admission, environment, automatic gates, manual body, threshold apply and captions. Target slices
are rehashed by the records helper against the current files.

Final identity 50e07b23ead569635351a5b3f6ad2e84f12f1e8f43e3b5d5b9709cd569e4c271.
Inputs 74192e40c419869a66b3a71c4c63aafef56c208e0305f669cc6279e2848a39fc, 794 files.
Validation 190df07b7a6ca60a0528a04a3d7b84f224962d36dcb787ad9484cfc988a8d072, 266 files.
Build 72bc2e57f2bc598c0b3c5f9d5d08888c5423070131f547e2adab882aa18d0c00, 555 files.

Durable evidence is .audit/w234-evidence.json. Raw logs and result.json files are in the job
scratch directory, w234-cli-ybFY4u and w233-cli-lobLhs. Intermediate d4e5b3b8, d6ce721e and cc6b74df results
remain historical evidence. One intermediate default-concurrency run canceled the existing
8-second effort test; its isolated rerun passes, and the final bounded-concurrency run passes
all 164 without altering its timeout or assertions.

Independent review reproduced blocked-turn recovery and post-summary capacity failures. The first
reviewer also verified seven actual CLI groups at d6ce721e, then its service ended with 502. Its
original source-bound inputs are retained. A fresh bounded reviewer passes 13 final checks at
50e07b23 with before/after identity stable, including all original seven groups, the oversized
summary terminal result, Config after block, failed manual retry, repaired manual summary plus
next task and fresh-input capacity recovery. All reviewed CLI processes exit 0 with locks removed.
Portable independent result is .audit/w234-review-evidence.json. Its rerunnable private driver is
w234-recovery-recheck.mjs under job w234-recheck.YHIYzp/tmp. No concrete failure remains in this
bounded recheck. The comment pass proposed two prose deletions, accepted, plus two provenance
qualifications, corrected; later capacity comments retain required source coordinates.

## Coding-standard check

S-1 binds the default, user destination, boolean parser, capacity math and blocked terminal outcome
to read source bodies and AST coordinates. S-2 preserves existing Config paging and window tests
by following the active successor journal. S-3 checks decoded physical frames. S-4 verifies modal,
request, session and lock ownership including cancellation and manual recovery. S-5 uses actual
request counts, saved bytes and durable terminal outcomes. S-6 threads one optional boolean across
all admission/read paths and migrates the existing Config driver. S-7 records all eight body diffs
and the existing single-window adaptation. Model the Domain guided the typed compacted/blocking_limit
result; Prove It Works guided the compiled request and recovery fixtures.

Remaining Config consumers, vendor model catalogues and account/remote registrations stay Partial
or Excluded as recorded in CURRENT. This package does not close the whole TUI feature family.
