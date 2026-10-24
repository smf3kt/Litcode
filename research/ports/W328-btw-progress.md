# W328 side-question progress

Status: verified locally,2026-10-24. One local package after W327. Local commit,no coauthor/no push.

## Task card and checkpoint

Entry: /btw QUESTION opens a cancellable waiting panel immediately,shows owned request retry progress,then returns through existing answer/history/copy/fork consumers. Errors stay in the Btw surface. Piped/line behavior retains its direct result path.
Data: request-local ModelRetry events;SideQuestionProgress with pending/retry state and one subscription;typed closed/answer/error outcome for the waiting owner. A captured request controller and existing readDialog own cancellation,not nested withTurn calls.
Mode: adapt source we/$e/We/He/kmt to current SDK and existing ActiveDialog. Reuse recovered HIe frames already ported. Keep SDK retry decisions,attempt limits,delays and error values unchanged.
Targets: provider optional per-request retry observer,Agent.askSideQuestion handoff,side-question progress body,terminal/TUI wait host,interactive admission,compiled driver and three new regression groups.
Validation: actual held-request baseline;pending Escape closes its transport;429 with explicit retry-after countdown to answer,400error,next main turn,side journal absence,prior f path,exit/locks;affected/check/build,source comparisons,independent review/identity.
Blocking: acquire source and owner closure and actual baseline before product edits. Independent: one bounded read-only modal-owner question. Shared state: one outer turn,captured request signal,modal-owned80ms clock/subscription. One main writer closes the coupled chain before another package.

## Source acquired before product changes

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units. Acorn selections are manifest-verified;recovered entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-qskwh3r4.js | 502871b1307a183388e1c2d295749e7a64d266b330b49fbe4e155e4e899ed588 | we [17437,24938);sr [28150,28827);We [24938,25024);Re [25024,25146);qe [25146,25206);dt [26212,26512);$e [26512,27477);He [27477,27639);it/at/Le at[17232,17236)/[17237,17241)/[17247,17251) |
| chunk-d3s5r8h5.js | 202506d3996b4fffe72418c623c884a93169f9352a17331ba6268b2e2eb4e2db | kmt [1698,4364);x [4364,4895);N [4895,5648);T [5648,5727). Earlier W260 coordinates are historical and not reused as current bounds. |
| chunk-grnv57x2.js | c6ef84713a536737ff492f3a6a11b289d9e84bfbb9d94170e77616b9ca9e22d8 | bie [975,3264);uses HIe frame selection already ported in tui-progress-source. |
| chunk-80m1br2r.js | fd204b217ca334768085a00c2177349e8466c17a95be7a80045bff44413c056e | ts [799,994),error text renderer. |

we mounts before the one tool-free kmt call. Its80ms frame advances while neither answer nor error exists. $e displays Answering... with bie,or He(status) plus ceil(max(0,retryAt-now)/1000),retryAttempt/maxRetries. We stores retryAt=Date.now()+retryInMs. He maps429to Rate limited,529to API overloaded,401/403to Authentication failed,otherwise API error. Cleanup aborts an explicitly dismissed pending request and leaves unrelated owners untouched. Settled nonsynthetic exchanges join only side history;copy/fork gates retain W326.

## Explicit host adaptations

The existing modal clones display data and owns its own finish/abort cleanup. One waiting modal reads request-local retry state with a modal-owned clock and hands off to the existing answer modal on settlement. Source's same-mounted-component answer transition adapts to this existing host;main/side execution concurrency,step-aside/re-adoption,remote/coordinator dispatch and source fallback-model behavior remain separate.

The gateway SDK0.133.0 owns retry decisions and sleep. Public request middleware runs per HTTP attempt and exposes X-Stainless-Retry-Count. Use per-request middleware only when onRetry is supplied;it observes status/retry headers or transport failure without changing response bytes/headers,request credentials,timeout,maxRetries or SDK errors. Explicit valid retry-after-ms/retry-after yields the corresponding SDK retry interval. SDK randomized fallback delay is private and emits no callback,so it stays unknown and displays retrying/attempt without a fabricated countdown. No new retry loop or model fallback is introduced.

SDK source client.ts exact UTF-16 bodies: shouldRetry[58933,60311),retryRequest[60315,62103),calculateDefaultRetryTimeoutMillis[62107,62650). Host reads src/provider.ts,Agent.askSideQuestion,interactive withTurn/readDialog and Tui prompt/finish. The host question confirms nested withTurn would overwrite turnController;keep one outer turn.

## Baseline

node scripts/smoke-btw-progress-cli.mjs --baseline exits0 against unchanged product/build. Owned HTTP request remains held,no Btw/Answering panel exists until the response arrives;then the ordinary answer panel works. Journal omits side text,locks release. Evidence JOB_TMP/w328-cli-red.txt. JOB_TMP is /Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

apply_patch remains absent,confirmed again at closure;dedicated Write/Edit fallback follows W327.

## Implementation and provenance comparisons

Model the Domain selects a discriminated pending/answer/error/closed state. SideQuestionProgress captures its request controller,retry callback,subscription set and settled promise. Tui preserves this trusted host object outside structuredClone,owns an80ms frame clock and subscription,and releases both on finish. Settlement closes only that modal and returns to the existing answer/error consumer;late callbacks have no mounted owner. Escape/Ctrl+C/Ctrl+D/Enter/Space use the source pending-close path. Interactive uses one outer withTurn around pending request/dialog and awaits cancellation before yielding ownership. Existing side history,synthetic filtering,copy and W326 fork gates stay in their original consumers.

Provider middleware is request-local and optional. Its callback passes through createProviderSlot,the existing credential wrapper and withUsageBudget using Parameters<ModelProvider['complete']> or contextual rest forwarding. This changes only delegation;credential refresh,account/subscription behavior and configured model routing are untouched. The first actual CLI diagnosed that explicit four-argument wrappers had dropped the new fifth callback;direct compiled GatewayProvider observed it while decoded CLI frames did not. The wrappers were read before the forwarding repair. One budget call remains one logical completion even when the SDK makes repeated HTTP attempts.

JOB_TMP/w328-source-compare.mjs manifest-verifies four recovered modules and creates13Acorn/TypeScript-bounded source/target diffs. All13were read and independently checked. The final report SHA-256 is caffbe157b1985d96ce3865d75e70fc65ea5cdae31baffd114c31b30e5617c46 after regenerating whole-file digests following the comment-coordinate correction. Its reviewed predecessor was4c22a677bc7f220e970e8cd76938b815bda39eb53e3a943371a1c37c7022fa0f. Bodies and target ranges below are unchanged. The copy/adapt relation preserves we's pending/settled/cleanup structure,We timestamp arithmetic,$e countdown,He status labels and kmt request-local retry handoff. The SDK observer is a host adaptation to its public per-attempt middleware;it does not replace SDK retry policy. Unknown jitter delay is explicit. Spinner text reuses source HIe glyph selection;theme intensity and the complete source element tree remain host renderer differences.

Target source coordinates below are zero-based half-open UTF-16 at final b5e673cd. Multiple source relations share one target body where lifecycle/rendering is coupled.

| Target body | Range | Body SHA-256 | Source relation |
| --- | --- | --- | --- |
| side-question-progress.ts SideQuestionProgress | [689,2499) | 6334413bac90c5f66b770a52d9a5596656a2a61dcfcecef276b06ae475644649 | we/We lifecycle adapt |
| side-question-progress.ts sideQuestionWaitingText | [2595,3291) | 33d81695df74da64d5542ed83c7a245133e227758e59b9e2989f368d6dfff2e2 | $e/He/bie text adapter |
| agent.ts askSideQuestion | [70558,71590) | de036affb6d1e1f42878b73a9e24ec1353af9fc550276c7ac6b1b289b8510cb1 | kmt observer handoff |
| provider.ts retryProgress | [1230,2711) | 74e6825b11248fb1e4420dcec3c3e2f7e1f9081b65ba1dee9c24fb2fc18bbb16 | kmt observer to SDK middleware adapt |
| login.ts createProviderSlot | [24755,25336) | 16b603f1361564d7d5cec019597084fa062a4d6d10cb39e7dfe83313a5352336 | host delegation adapt |
| structured-output.ts withUsageBudget | [25567,26683) | 457b4b2763ec6b382accd1a65b09ff15b27ed07a2eef765a91bf6f67e33ea226 | host delegation adapt |
| interactive.ts btw branch | [135301,140224) | 8a645fa4d8aad92c5b33daf9af403f97c6da0d20679f103c4f1c309910eb2f67 | we pending/result/error handoff |
| tui.ts pending mount | [109433,110394) | 86af7b60e6b2092d998e7d568bc03a2e141b6e64444806ab7fc392e9ec5e6533 | we owned clock/subscription |
| tui.ts pending close keys | [173843,174005) | ae99b886d2943b45720870d770d2b9420be74e4f0fd75a3acc259d2a3e94e7a4 | we.tt Enter/Space |
| interactive.ts error branch | [136868,137098) | 6f2f20f14601a93f6d5086d2813ca0d0b2eff83bc8e5a9c57a54fd13f1c5add2 | ts error text adapter |

SDK0.133.0 source SHA-256: src/client.ts c7e3eab00ef2894c112cf89f0913623cc3915552ee5cd50c4bd67db925923e89;src/core/middleware.ts b9644fa58477a1f25ce40ac977e40595db3a0b7dacb69a473cc82cf015fc8b8f;src/lib/MessageStream.ts86bcb2a761ebae8348531441192ac5a834897851244358b4f789ce1d5be6cc6b. These are existing pinned dependency files,never modified.

## Main validation

New3behavior groups pass within focused23/23. Affected10test files pass202/202,CLI core/advanced/migration/gateway/MCP suites46/46,check/build exit0. Check/build logs are JOB_TMP/w328-review-check.txt and w328-review-build.txt;affected/CLI logs w328-affected.txt and w328-cli-regressions.txt. No failures,skips or cancellations in those suites.

Actual compiled scripts/smoke-btw-progress-cli.mjs passes5owned loopback requests. It holds a side request while Btw/Answering is visible,closes it with Escape and observes transport close,shows429retry-after countdown with attempt1/2,receives answer,executes copy,shows400error,and then completes a normal main turn. Retry request bodies match;the cancelled question is absent from later side history. Side request and response text are absent from the parent journal;locks release. Source and compiled paths are not counted as real model validation. Existing scripts/smoke-btw-fork-cli.mjs passes7requests each with current/legacy agentTypes modes,including child file effect,retained task transcript and same-child continuation. Paid0;real upstream,full suite and package smoke are not_run.

## Independent review and final transfer

Correctness reviewer a6eb9f6afbc446c56 reports0confirmed scoped defects. It verifies13source comparisons and the three SDK ranges,passes focused9/9 and provider/login/budget31/31,then runs compiled progress5requests and fork7requests. Eight observed/unobserved SDK cases preserve request bodies,headers,attempt counts and final errors:400,429with x-should-retry:false,401forced,408,409,429,529and transport failure. Abort during a60000ms retry sleep settles after one HTTP attempt. Concurrent request observers remain separate while two budget calls account for four HTTP attempts. Compiled modal probes cover pre-settled handoff,Ctrl+C/D,teardown and late callbacks;interactive probes cover empty/error/synthetic answers,side history,parent journal and balanced turn ownership. Existing credential wrapper forwards text/thinking/retry as one tuple. Evidence JOB_TMP/w328-independent-{focused,provider,cli,fork,sdk,concurrency,delegation,modal,interactive,identity,source}.txt. Before/after captureIdentity deep-equals all1816frozen records at c8d83715;both protected user hashes and HEAD9ac8a860 remain unchanged.

Comment reviewer aa211804abbb8e8cd reports0deletions/restorations/suppressions and0files touched,with one stale Agent prose coordinate. After the correctness pass finishes,main changes only x at3457 to4364,matching the manifest-verified x[4364,4895). Final npm run build exits0. JOB_TMP/w328-comment-equivalence.mjs compares TypeScript-printed executable syntax for617source and617compiled files and proves all1234equal. Complete inventory comparison finds exactly src/agent.ts and dist/agent.js changed,each only by that comment numeral. Tests,drivers and all other product/build files match the reviewed candidate. Logs w328-final-build.txt and w328-coordinate-equivalence.json bind this transfer;successful behavior checks were not repeated without a new executable change. Deslop retains required provenance anchors and adds no casts,suppressions or cleanup rewrites.

## Incidents and standard check

Initial SDK Middleware import used a CommonJS .js subpath against the ESM stream signature,producing a dual-resolution type mismatch. Derive Middleware from Parameters<Anthropic['messages']['stream']> rather than casting it. Existing fake modal tests lacked the new pending step;they now settle that host object before retaining original answer assertions. A new raw ANSI-byte assertion missed an incrementally painted phrase;the existing xterm decoding method verifies visible text. A named ESM xterm import failed because the dependency is CommonJS;use the repository's createRequire pattern. A source-comparison selector used ESTree statement instead of TypeScript thenStatement;corrected script validates exact nodes. Guessed SDK core/client glob and tui-spinner path failed;inventory identified the actual owners. Broad CURRENT/FEATURES excerpts still encountered giant historical lines;use bounded fragments. The stale x coordinate is corrected after independent identity verification. These map to existing S-1/S-3/S-6/S-7 rules;no new duplicate rule.

S-1/S-7 acquire source before behavior changes and compare13bodies. S-2 retains SDK retry limits/headers,side-history gates,tool-free call and journal exclusion. S-3 separates ANSI frames from text. S-4 names request/modal/timer/subscription ownership and waits for cancellation. S-5 actual held/retry/error/recovery effects distinguish the new behavior from the baseline. S-6 forwards every provider callback through all wrappers and updates old/new modal drivers together. Independent review and final identity close this package;the wider side-question feature family remains Partial for the boundaries named above.

## Final content identity

scripts/identity.mjs freezes1816files at b5e673cdf8aefb78f92007f844e15ff8182efdd33e71cde8ce25f82ab26154b6. Inputs866 hash15a8da255847f82cdaff16ede5913d5e904c329ffb15494340911b0bf89a11c8;validation333 hashe5ed97623be3fd57413eda06b7bcc659213eea69d27e1648d3401c7460acb07d;build617 hash9cfb6015c85a66b03d9805209fee8e61a20d80ab21d8e9e83985ea1dbb711555. Sorted inventory is JOB_TMP/w328-final-identity.json. Its reviewed predecessor is c8d83715d1a2e79258819d258d74bf8efafa975771c26da4f229d8bd19e3e099,transferred through the comment-only executable-syntax proof above.

Protected unstaged files retain their initial SHA-256: .audit/w45-77-evidence.mjs9a3b57af640773f1283975e6ca49523407d8fb8469639817da5ab807b7b4d3aa;test/skills-command.test.ts995b1526bc74ab0d9f278bd61442c4254e3194e6528d12d18de75b5184404735. Their existing changes stay outside this package's explicit staging list.
