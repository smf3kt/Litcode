# W345 plugin runtime catalog

Status: verified locally with independent review, 2026-10-26. Parent396833a. Local closure only,no coauthor/no push.

## Task card

Entry / result: /plugin disable alpha -> /reload-plugins --force -> /plugin enable alpha -> /reload-plugins --force succeeds with the enabled MCP tool in the successor session's original metadata and accepted catalog.
Data shape: existing Runtime candidate and SessionConfig.tools,an array of pinned Messages tool schemas. The accepted replacement owns discovery and the successor journal. No new state type or runtime API.
Source: Yr force/warning gates,oL refresh adoption,q4 candidate diff and RTe.kn connection/catalog publication. Existing /reload already builds a candidate then pins its discovered tools before opening its successor.
Targets: src/interactive.ts applyConfig and the existing plugin-toggle behavioral group. Reuse existing actual compiled driver.
Mode: adapt source refreshed-state adoption to this host's existing successor-session transaction. Preserve the strict Agent/resume schema checks,old runtime on candidate failure,and hooks only after accepted replacement.
Validation: actual compiled baseline,existing plugin round-trip and failure controls,exact metadata assertions,affected Agent/MCP/config tests,check/build,compiled driver and independent review.
Completion: actual disable/re-enable and watcher chain pass,metadata matches accepted discovery,failed replacement leaves current ownership,owned transports/locks close,source comparison and identity recorded.

## Source evidence

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Ranges use zero-based half-open UTF-16 code units. Modules are verified against extracted-v2/manifest.json and read as inert data. No recovered application entrypoint executes.

- chunk-x876fw6t.js SHA-25682f072d959103651ec4007a02691e4b1883602213581c89d88809dca574beef2. Yr [16694,19097) returns the cache warning before applying unless forced,then calls oL and reports the applied loader counts.
- chunk-9yh2xzb7.js SHA-256a023ef8c88f31649cea4bd4c015b41bfc997756ed0296c6f31e8ee44f06749f4. oL [1781,3332) refreshes config/components and applyRefresh before hooks. q4 [3332,4231) compares active plugin MCP clients with proposed server identities.
- chunk-24k7d6mw.js SHA-2561d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31. Complete RTe.kn declarator [1562359,1572850),AST symbol/range verified,adopts the connected client with tools,commands,resources and templates before installing its handlers. RTe.Bn [1585446,1586735) preserves disabled/current identity and adopts successful enable through kn. These bodies publish current discovery rather than the previous tool snapshot.

W299 and W300 describe the existing host adaptation and strict resume contract. In current applyConfig,Session.open writes stale config.tools before the replacement runtime is constructed. On plugin re-enable,the fresh candidate discovers alpha/local but publishMcpCatalog(startup) compares it to metadata with no corresponding tool,so binding fails. Disabling happened to pass because no configured MCP server causes early omission. Ordinary /reload constructs the candidate and fills config.tools before Session.open;the same ownership order is required here. The repair prepares the replacement first and pins its exact tool projection before writing the new journal,with candidate cleanup on any pre-bind failure. It changes no strict comparison in Agent,Session or publishMcpCatalog.

## Baseline and throughput

JOB_TMP=/Users/mant1ssa/.claude/jobs/c9c17d97/tmp.

- Existing plugin-toggle group fails2/3 in w343-plugin-observation.txt at forced re-enable with Session tool schemas changed.
- Actual compiled node .audit/w299-plugin-toggle.mjs exits1 after25passed checks. w345-plugin-cli-baseline.txt shows apply enable failing at the same schema check. The existing driver's finally closes its owned CLI/transports and removes the private fixture.
- Baseline1856record aggregate b355a00d1b2be2e760e5a0d00305d65d38428e8ec9f9fa8875e486d8d9e0eecd in w345-baseline-identity.json.
- Source and current candidate/session/bind/accept/cleanup owners are read before edits. Main owns the coupled change in place. One fresh read-only reader follows the frozen final candidate. No worktree or broad fanout.
- Reuse the existing transaction and pinToolSchemas. No new permission exemption,transport retry,tool schema exception or deferred publication.

## Verification

- Existing plugin-toggle suite now passes3/3 in w345-plugin-repaired.txt. The strengthened original group then checks active successor metadata after disable and re-enable without removing any prior assertion or increasing a timeout.
- Affected8files pass86/86 in w345-affected.txt: plugin-toggle,reload-plugins,interactive,agent,mcp-management,runtime,reload,config-panel. Agent's changed-schema rejection and original resume fingerprint tests stay unchanged and pass.
- npm run check,npm run build and final npm run check exit0. Logs w345-check.txt,w345-build.txt,w345-final-check.txt. git diff --check exits0.
- Actual compiled W299 driver now passes42/42,zero model requests and released owned MCP processes/session locks in w345-plugin-cli.txt and w345-plugin-cli-result.json. The identical baseline failed after25checks at re-enable. Cache warnings retain old components;forced disable and re-enable update modules,commands and transports;fresh launch retains the desired disabled state.
- Full npm test exits0 at the candidate identity,3380/3380,zero failures,cancellations or skips. Log w345-full.txt,duration125193.575ms. This is the current full-suite result after W343,W344 and W345 repairs. Dependency notices remain the separate unclosed delivery item.

## Candidate identity

w345-candidate-identity.json binds1856records with aggregatec6fea7e84437b1e55993067b478a181e6d0247bad43820964b55a8431e073abf. Inputs886,cb5f45a1bf7f445dcdf285047cce137696692eeca713420a582688b8384eeac6;validation344,8e394a180fa86424cb83a187f4a6c999fba15afdb495ad0cdfd788dd3545b74a;build626,c560259a32cf3e2614cb6df91ea9a836301dace7666b48f2fe1b7cdd61178e18. Changes are interactive.ts,plugin-toggle.test.ts and the compiled interactive module.

## Source comparison

JOB_TMP/w345-source-compare.mjs verifies3manifest module digests and5exact Acorn symbol/type/ranges before generating source-target and old/new transaction character diffs. Both complete diffs are read. The source declares refresh/adoption before downstream use;the host adds its existing successor journal boundary and pins candidate.tools before Session.open. No whole-source copy is claimed. The target applyConfig body SHA-256 is2e15039881cde560e904fdae6174d9cdc95b5d48498ff626ddd3647601345046. Source-target character diff SHA-256f46a8acb731ea1a87c1e746984d4418c6faa2bf9a1a236704c675af6700f4aa4 and transaction-change diffc7023a713c9ece2801eeb33df724d3e624c8813ed1c3172005b1855a2f2134f5 are retained with w345-source-comparison.json. The source comment cites the owning Yr/oL ranges. New strict checks and tool-schema exemptions are0.

## Independent review

A fresh read-only reviewer finds no confirmed scoped product defect. Requested plugin-toggle,agent and mcp-management tests pass21/21,with0failures,cancellations or skips. The actual compiled W299 driver passes42/42with0modelrequests and its own MCP/session-lock cleanup assertions. Three manifest digests,five exact AST ranges,both complete character diffs and compiled/transpiled applyConfig AST match. All68prior assertions remain ordered,three assertions are added,and no suppression appears. Strict Agent,Session and runtime schema guards stay unchanged. All1856before/after records match c6fea7e8;only interactive source/test/build differ from baseline,and all three protected dirty hashes remain unchanged. The reviewer makes0repository edits and does not rerun build/full.

The reviewer's extra transaction probe initially exits1 on an incorrect original-fixture metadata expectation. That fixture writes empty pinned tools. It already proves candidate/process cleanup and unchanged old journal before reaching the mistaken expectation. Main corrects only the temporary probe to assert/capture the initial empty catalog and compare the retained catalog after each fault. Main's corrected compiled probe passes1/1with four scenarios:journal preparation,history carry,bind failure and post-await abort. Complete old journal bytes,old MCP/hooks continuity,new candidate cleanup and released successor locks pass. An ancestry-aware main scan confirms0ownedprocesses and0fixture directories;the reader's earlier one raw process match is not a leak verdict. Logs are w345-independent-tests.txt,w345-independent-cli.txt,w345-independent-transaction.txt,w345-transaction-corrected.txt and w345-independent-result.json. The same independent reader reviews the corrected script and main log,accepts the fixture-only correction and closes the qualification with0confirmed scoped product defects. This follow-up does not rerun the probe or claim independent process observation. Evidence w345-independent-probe-followup.json retains the original exit1 and the correction's ownership.
