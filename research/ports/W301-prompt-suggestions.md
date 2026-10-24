# W301 prompt suggestions

Status: verified locally on 2026-10-24. The user resumed W301 ahead of W323, then requested a pause after W301 delivery. W323 remains pending at source preflight. The recurring loop is cancelled.

## Task card

ID / subsystem: W301, interactive prompt prediction.
Entry / result: after an eligible main model turn, predict a short next input; show on an empty composer; Right/Tab adopts into the draft without submitting; editing, new work, session replacement and close cancel pending work.
Source / dependencies: p2ct4tzw prediction/filter; 24k7d6mw Ore/suggestDraft/mse/JYe/DQe; sfn1dbxq F5/MC/c7o/ga; 4bw62nzm session owner; kyy5nfa1 unused backoff; nybcbd9t settings row; nyce03br publication site.
Targets / seams: Agent isolated provider request, interactive session lifetime, TUI input owner, existing settings/parser/reload and plugin chain.
Mode: copy the normalizer/script counts/filter; adapt recovered generation, state, lifetime, backoff and settings bodies to existing owners.
Differences: neutral prompt/environment; local rollout flag replaces remote feature service, default false; one tool-free request replaces a denied-tools fork; no vendor telemetry or account/service requests.
Actual CLI: owned loopback SSE plus compiled PTY, two assistant responses, prediction publication, Right/Tab draft adoption, input cancellation, config persistence and clean exit.
Checks: three new regression groups, affected tests, TypeScript check/build, independent correctness/comment review, source comparisons and content identity.
Completion: complete local chain and recorded evidence, exact-path local commit, no coauthor/no push.

## Source acquisition and identity

Artifact: Claude Code 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
All ranges are zero-based half-open UTF-16 code units. Acquired modules were checked against `extracted-v2/manifest.json` before parsing. Extracted entrypoints were never executed. The final manifest recheck covers all fifteen modules below.

The original nine-module generation/publication/display/acceptance/backoff closure and task card preceded product edits. Environment parsing, preference-layer fallback, hook-origin semantics, mounted Config state and child-submission ordering were acquired or refined during implementation and review before their respective repairs. They are retained as later dependency acquisitions, rather than described as part of the initial complete preflight.

| Module | SHA-256 | Read body / ranges |
| --- | --- | --- |
| chunk-p2ct4tzw.js | 4f88982b9b1517f39839925450d7f238e923623f179efc24b72e6ad3fe1547bf | R/A/T/L,y/b/w [1555,2161); qIe/Wun/Gun/zun/x/oNr/Y$o [2161,5190); O [5389,5622); M/I/W/N/q [5626,11008) |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | Ore/Ct [489702,491353); mse [569848,592289) Right/Tab tail; DQe [818061,853491), edit subscription [830000,830650); JYe [864213,907678), submit [875160,878682), YA/K2t before routing [875500,877400), display [881057,881087)/[894366,894381); suggestDraft [1499780,1500033); gpe [856156,857000) queue/default placeholder |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | _Oe [450106,450136); v9r [470190,470266); Hre/qht/c7o [470270,470671); F5 [2535884,2536130); MC [2544122,2548467); ga [3071820,3072764) |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | session suggestion class we [48523,48750) |
| chunk-5b2hxy2e.js | 46d7f73a2b28fd9493ecf37d85abc89acd020f6de7e2bdb83efe621811f12656 | Ga [65908,77691), main query completion trigger |
| chunk-nqc6v990.js | 261b35d99a3bb5aed676678c983f7c903da023ab3ad0c4117a3474d6b51e0738 | pr [3830,3899), simple/bare trigger exclusion |
| chunk-kyy5nfa1.js | 90b333511e6035e8d2c151a34a9ec9b7f200ca01526d7b92aea50ee61b09a3a4 | ce [847,900); E_t and i/u/hKo/age/$Jn/K2t/yKo/XGr/m/d/S/p/r [900,2265); outcome/reset [1284,1483) |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | vWe complete settings row [17552,17759); ue live app-state projection [37136,38694) |
| chunk-nyce03br.js | 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f | Ar [26489,26668); lo [26672,26957); prompt.suggest lo(name,isShown) registration at 110529 |
| chunk-qtksmp3x.js | 3f6f874b3563c30d289f53ada3f36a86ef29ae0b85c44a7cdca4f87df021c491 | promptSuggestionEnabled TN.catch schema property [41417,41484) |
| chunk-yvnhkg35.js | ce3689687897e987959f19ab07f98d79e5c925a8b15620dce02d29ba4943348d | Cs environment field [34324,34338) |
| chunk-phz47asr.js | 3d37bfa1a457f1e45fa115ea9002376a2549517043763e9cdb0d29e09e8d967d | i [716,757); s [893,947); M.triBool [1032,1168) |
| chunk-fdxhcr6b.js | 3c625e31827ca4ef7cc3a4691103fbbb3abbdd338778cbf70c0054f37359507b | Ne [615,757); Es [757,908), true/false spellings |
| chunk-2kdsvp3x.js | 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2 | aJ [39328,39441), optional hook-origin stack |
| chunk-js2bhabe.js | f196bcf7599a185ad08c73d32ce68b25130ce9db48d781138b1899a3f6e786de | hs [1114,1499), effective setting-layer lookup |

## Adapter decisions and usage chain

- The initial rollout gate remains false. `features.promptSuggestions:true` supplies the local rollout. `HARNESS_PROMPT_SUGGESTIONS` accepts the source true/false spellings and overrides rollout and preference at startup. `promptSuggestionEnabled` remains a separate live user preference. Config is available when local rollout or an explicit true environment opens availability. This is a local discoverability adaptation of the source rollout-only row. Mounted rows read live state, so an environment seed does not override later clicks.
- Eligibility keeps at least two assistant messages, no pending/error/aborted turn, no plan mode, no permission/form owner and the exact 10000 uncached/cache-creation token gate. Cache reads are excluded. Eligibility precedes backoff cadence advancement. Remote account rate-limit state has no local owner; the existing provider handles request errors.
- `Agent.predictPrompt` clones the parent's current system/model/messages/settings, adds neutralized source M, clears tools and sets tool choice to none. It does not append journal rows, run tools, emit main progress or change main usage. Source MC retains parent tools and can make denied-tool continuations; this host performs one tool-free complete. No new output cap is invented.
- `publishPromptSuggestion` uses the copied ga engine path and lo/Ar site, preserving payload origin. CLI has no hook-origin stack. The core checks session/generation and current composer before proposing. No plugin-facing Hze replacement is used.
- TUI keeps the source empty/generated/shown/accepted union. Only a visible empty prompt marks shown. Autocomplete, modal/search, agent view, focus, footer selection, queued input and editor handoff retain ownership. Queue placeholder priority preserves the existing host contract.
- Input edits abort generation but retain an already shown suggestion for submission outcome. Right/Tab fills the draft without submitting and preserves leading ! bash mode. Explicit acceptance or case-insensitive exact submission resets unused backoff. Main and child submit routes both settle the existing suggestion before command routing.
- Source 20-unused latch, 21 notice marker, 14-day firstStartTime gate and every-tenth eligible turn map to local settings through the existing serialized atomic write queue. Unknown fields and file mode survive. The absent firstStartTime fallback remains the source epoch. The negated age comparison preserves malformed-date NaN behavior. Session counters/controllers reset on handoff; persistent backoff is shared by user directory.
- Main ordinary prompts, bash continuations, local attachments and skills use the completion trigger. The prediction controller outlives its completed turn but is cancelled by input/new work/session replacement/exit. Late provider/publication results recheck ownership. Close awaits tracked prediction and settings work.
- Headless, child/peer/scheduled-event prediction producers, source background suggestedReply disk sidecars and false-gated plugin generation ownership remain separate. No account/subscription/OAuth service is added.

## Source and target comparison

JOB_TMP means `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`. `w301-source-compare.mjs` verifies source manifest digests and exact Acorn nodes, then selects target TypeScript declarations/methods/variables and writes body digests, target ranges and literal diffs. All seventeen groups have been read. Its six directly compared modules are a subset of the fifteen-module acquisition ledger.

| Target | Mode | Source / required adaptation |
| --- | --- | --- |
| scriptCounts, promptSuggestionWords, normalizePromptSuggestion, promptSuggestionRejection | copy | R/A/T/L/y/b/w/W/q. Mechanical naming/type/format changes; exact Unicode flag restored. |
| startup, eligibility and prediction instruction | adapt | Gun/zun/oNr/O/M. Neutral environment and names; existing Session/Message types and local rollout. |
| Agent.predictPrompt | adapt | I/N/F5/MC. Existing provider and parent request; one tool-free request and isolated result. |
| PromptSuggestionRun and persistent store | adapt | we/$Jn/K2t/yKo/XGr/m/d/S/p/r. Existing controller and serialized settings owner. |
| engine publication and interactive producer | adapt | Hre/qht/c7o/Y$o/oNr/Ga. Existing ga/core and post-turn session owner. |
| TUI display, acceptance and child outcome | adapt | Ore/suggestDraft/mse/JYe. Native draft/render/input ownership and submission routing. |
| preference write and live row | adapt | vWe/ue. Existing config model, atomic settings writer and live state. |

Comparison labels are script-counts, normalizer, filters, startup, eligibility, prompt, provider, run-lifetime, backoff, backoff-store, publisher, producer, display-state, acceptance, settings-write, live-row and child-outcome. Report and sidecars remain at `JOB_TMP/w301-source-comparison.json`. No whole-application equivalence claim is made.

## Validation and candidate scope

- Before product edits, the compiled `node scripts/smoke-prompt-suggestions-cli.mjs --baseline` reaches two assistant replies with two owned requests and no prediction/ghost. The valid missing-feature baseline is `w301-cli-baseline2.txt`. Its earlier future-key setup failure is retained separately.
- Three new groups in `test/prompt-suggestions.test.ts` pass after the final date repair in `w301-focused-final.txt`. They cover exact filters/multilingual counts/cache gates/provider context/journal isolation/settings/backoff; actual engine publication/native ghost/Right/Tab/bash/modal/autocomplete/focus/queue/child outcome; and interactive cancellation on edit/new work/session/exit with lock cleanup.
- Affected command passes304/304 in `w301-affected5.txt`: `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/prompt-suggestions.test.ts test/config-panel.test.ts test/config.test.ts test/reload.test.ts test/runtime-resources.test.ts test/interactive.test.ts test/tui.test.ts test/terminal.test.ts test/agent-transcript.test.ts test/tui-stash.test.ts test/tui-bash-mode.test.ts test/plugin-chain.test.ts test/plugin-chain-relay.test.ts test/plugin-chain-cores.test.ts`. This run follows the child-outcome repair and precedes the final date-only repair.
- CLI regression command passes32/32 in `w301-cli-regression.txt`: `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/cli.test.ts test/cli-advanced.test.ts test/cli-migration.test.ts`. It retains that same pre-date-repair scope.
- Actual compiled `node scripts/smoke-prompt-suggestions-cli.mjs` passes8owned loopback requests in `w301-cli-final.txt`, fixture `JOB_TMP/prompt-suggestions-cli-cqXp0Q`. It checks two-response eligibility, tools[]/choice none, current ghost row, Right adoption with no auto-request, exact edited submission, Tab adoption, held prediction cancellation, Config false on disk, no disabled prediction, journal isolation, exit0 and zero locks. This run follows the child repair and precedes the date-only repair.
- Independent `w301-review-final-date.mjs` verifies the final date repair at `95c565ee...` and confirms only src/prompt-suggestions.ts and dist/prompt-suggestions.js changed from the reviewed child-repair identity. Seven compiled cases cover invalid/recent/absent dates, both sides of the14-day boundary, below-latch count and explicit true environment.
- `npm run check` and `npm run build` pass after the date repair in check8/build9 and again after provenance-only edits in `w301-delivery-check.txt` / `w301-delivery-build.txt`, exit0. Final TypeScript AST printing with comments removed matches all six edited source files and all614compiled JavaScript modules against the pre-provenance snapshot. Thus the final comments change bytes but preserve executable syntax; the complete successful PTY is not mechanically repeated.
- `git diff --check` passes. Main directly verifies no `.lock` rows in final main and independent CLI fixture directories. The smoke driver's finally owns and closes its child process group and HTTP server.
- Full suite, real Magpie and paid upstream are `not_run`. Paid calls0. Model requests above use owned loopback SSE or local scripted providers. Real credentials are neither read for these fixtures nor copied to evidence.

## Independent review and repairs

Correctness reviewer `a0a474da2aaa83ba0` independently reproduces four defect families. Source oNr puts eligibility before cadence; ue/vWe reads mounted app state; JYe YA/K2t settles outcome before main/child routing; $Jn uses the negation of an early age comparison. Main repairs each against those bodies. Independent replays verify first eligible turns2/12, live false-to-true Config with generation restored, one ignored child outcome with no revived main ghost, and seven compiled date/environment boundaries. The final verdict at exact `95c565ee45031d80fe23a34f4e9d0f77d7daec9dc994db024f7d0408fdd9b43f` has no open confirmed scoped correctness defect.

The review also runs actual compiled CLI8requests at its earlier `e7842539...` candidate. Cadence/live repairs bind `3d8fb3cd...`; child repair binds `1c205db1...`; date repair binds `95c565ee...`. Those results retain their respective scopes. Final provenance-only syntax transfer binds the delivery identity below without claiming a second independent full PTY at that new byte identity.

Comment reviewer `a6c9ea26a45870224` reports0repository writes,0deletions,0new suppressions and no MUST KILL finding. It identifies missing module names and handler-local provenance in TUI,interactive,prediction startup/cadence and settings startup/parser/reload. Main fills them with the exact ledger ranges. The final diff pass retains required provenance and the explicit tool-free adapter reason. It introduces no behavior change after the independent correctness verdict.

Model the Domain keeps suggestion state as a discriminated union and retains existing Session/TUI/settings owners. Type System Discipline validates external preferences and published results at their boundaries. Sequence Work into Verifiable Units keeps one W301 chain through review and local delivery before any W323 implementation.

## Content identity

`node scripts/identity.mjs --output JOB_TMP/w301-delivery-identity.json` captures the rebuilt delivery candidate. The preceding independently reviewed candidate is `95c565ee...`. The six source-file and614compiled-module syntax comparisons establish the final comment-only transfer; validation bytes remain identical.

| Inventory | Files | SHA-256 |
| --- | --- | --- |
| Inputs | 858 | bd849880b5e3177dca90de95103b6717ad203a30223a88b33087fdc5f5af9034 |
| Validation | 328 | a84b815b544546bb546732344e094b33a9591d404d96b2c87c8afd8057157449 |
| Build | 614 | 5d717905b4cd7f80a5c5e2ab13ddde958d8a5b0443c5daaa77bd65d5866cbc18 |
| Combined | 1800 | e546f60d2764a515a8314d7b033664b3a558ed5a26f8b3202ec3fc86ac39965f |

Validation includes the user's existing skills-command test change. That file and `.audit/w45-77-evidence.mjs` remain outside this package commit. README/research/audit documentation is outside the shared product identity. This compact record preserves results and exact digests; large logs, comparison sidecars and full identity manifests remain in JOB_TMP.

## Research incidents and coding-standard check

Guessed filenames/globs, helper symbol-file collisions, unsupported class selectors and unquoted Y$o first obstruct source reads. Exact rg paths, module identity and Acorn nodes correct them. An oversized historical search and a guessed delivery audit filename are replaced by bounded exact reads. apply_patch is absent; the established dedicated Write/Edit fallback applies.

The first baseline authors a future strict feature key and fails at settings load. The corrected baseline omits it and proves missing behavior. The first regex copy loses /u; an initial legacy-pattern diagnosis temporarily uses new RegExp, but exact source comparison disproves that diagnosis and restores /u with multilingual cases. A filter test assumes a phrase the source does not reject; it is replaced by a phrase the recovered predicate actually covers. Typed fixtures add the real required limits and exhaustive Config case.

Actual CLI exposes omitted startup feature mapping, an origin object wrongly passed as ga hook-origin stack, and Config activation missing its new boolean id. Direct source paths supply the fixes. Two readiness/assertion checks match historical transcript text; they are narrowed to the current decoded composer row while exact submitted text/outcome assertions remain. Existing Config fixtures model rollout-off availability and retain their original paging purpose; the new enabled-row regression covers activation. Higher-layer invalid preference fallback follows TN.catch/hs before merge. All retry incidents remain in local question.md and scratch.

S-1 verifies sources, literal expectations, real compiled results and identity, retaining failed runs. S-2 preserves existing input/config contracts and source filters. S-3 separates ghost cells from exact draft and journal text. S-4 assigns controllers/counters to the session run, visible state to TUI and serialized persistence to the settings owner. S-5 uses decoded current rows,exact requests and locks rather than transcript substring readiness. S-6 covers schemas/layers/startup/reload/live Config/activation and both submit routes. S-7 records acquisition chronology, precise ranges and seventeen body diffs. Existing seven rules cover all incidents; no suppression or additional rule is added.

## Remaining and delivery

The local interactive prediction-to-composer chain is complete. The wider feature family remains Partial because headless/child/peer/scheduled producers,background suggestedReply sidecars,false-gated plugin ownership and complete renderer parity are separate. OAuth is excluded. Product names,prompts and output remain neutral. Magpie keeps routing/protocol ownership. Credentials stay out of evidence and sessions.

Delivery is an exact-path local commit on `work/w43-choice-preview`, with no coauthor and no push. The user's two unrelated tracked changes remain untouched. Per the latest instruction, work pauses after W301; W323 is retained only as pending source preflight. No recurring cron or dynamic wakeup is rearmed.
