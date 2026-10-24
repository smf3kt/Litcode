# W325 host identity and installation targets

Status: verified locally. User reports that LiTcode identifies as Codex; clarified trigger is a GPT model seeing ~/.codex and selecting that runtime for installation. Request facts and actual owned CLI effects are verified; real GPT behavior remains not_run. Loop and W323 remain paused.

## Task card

ID / subsystem: W325, host identity at the model request boundary.
Entry / outcome: LiTcode identifies its own CLI independently of its configured model; installation requests for this assistant use its actual user/project skill paths even when another CLI directory exists.
Source: Nl/mFn/u_s product identity and system assembly, FHn/Ug host environment facts and su path display. Existing config/loaders determine actual LiTcode directories.
Targets: DEFAULT_SYSTEM, Agent.request and one pure host-context formatter; existing exact request test plus up to three necessary regressions and actual compiled CLI request/effect driver.
Data shape: derive host context from Pick<SessionConfig, workspace/configSources/model>; model is a routing identifier, paths are quoted facts. No filesystem directory scanning or guessed runtime detection.
Mode: adapt source identity/environment framing to LiTcode names and current owners; installation guidance is the explicit user constraint. No response postprocessing or model-provider substitution.
Compatibility: append host facts at request time so original resumed metadata and custom prompts remain byte-identical while current host identity is present. Record this adapter difference from source recorded identity selection.
Validation: compiled owned loopback captures a neutral old request with missing identity, then proves corrected requests and a real skill marker at LiTcode path while an owned .codex fixture remains untouched; new/custom-userDir/original-resume cases,check/build,affected tests,independent review and content identity.
Delivery: one local package,no coauthor/no push; preserve unrelated changes and keep loop paused.

## Source evidence before product changes

Sample2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Coordinates are zero-based half-open UTF-16 code units. Manifest digests precede Acorn parsing; recovered entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-14rnebpd.js | d1ba8228f324b01eb984c0a09eed1095d0bb0e6ace7c295b0c0fdb03a17be810 | Nl main identity [275300,275362), literal [275303,275362); mFn [275593,275761) selects recorded/noninteractive identity; u_s [275761,275928) assembles identity and prompt pieces |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | Ug [114824,114914), FHn [118927,119601) serializes working directory/platform/Shell and optional environment facts |
| chunk-gyf58rwf.js | 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad | su [8978,9022) delegates path text sanitization; host uses JSON-quoted path literals instead |

Host diagnosis: DEFAULT_SYSTEM says only personal coding agent. buildSystem appends authored instructions/skill catalog; Agent.request sends config.system without product/path identity. Gateway inheritance carries endpoint/model/credential,not prompt. Main confirms the provider only transforms protocol/cache fields. No Codex identity literal exists in the inspected host-owned request code. The user's report establishes the model's directory-based inference; real GPT output and upstream gateway additions are not independently observed and will not be claimed fixed by a scripted model response.

LiTcode loaders use defaultUserDir or configSources.userDir,then user skills/agents; workspace .harness/skills and .harness/agents; plugin_install stores at workspace .harness/plugins. The formatter will describe these actual contracts and distinguish optional external settings files. The source product string is deliberately replaced with LiTcode under the standing product-neutral requirement. User's installation-target correction adds explicit guidance beyond the recovered identity literal.

## Throughput checkpoint

Blocking first steps. Acquire identity/environment bodies and actual directory readers; record task card and capture compiled missing-contract request before product edits.
Independent workstreams. One read-only workflow verifies request/inheritance/resume readers. Main owns recovered source and coupled implementation. Fresh correctness review follows final compiled validation.
Shared mutable state. Request context is a pure string derived from session config. No environment or user-home data is mutated. Owned fixture .codex lives under a private temporary root.
Smallest safe decomposition. One formatter called by Agent.request covers primary requests,prediction/compaction/side questions and resumed Agents. Existing custom prompt and journal remain unchanged.

## Validation

JOB_TMP means `/Users/mant1ssa/.claude/jobs/c9c17d97/tmp`. apply_patch is absent; established Write/Edit fallback applies.

`node scripts/smoke-host-identity-cli.mjs --baseline` captures one real compiled request before product changes. The system lacks Product:LiTcode and User skills directory facts; w325-cli-red.txt records that missing-contract observation. It does not fabricate a GPT response.

`npm run check` and `npm run build` pass,exit0,in w325-check.txt and w325-build.txt. Two new groups in test/host-context.test.ts verify quoted/default/custom-userDir/project paths and foreign-directory independence;actual Agent requests retain the original model/custom prompt and original resume metadata. The existing agent test keeps its complete original system as a prefix and verifies the added host block,while thinking/tools/messages assertions remain intact.

Affected command passes160/160 in w325-affected.txt: `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/host-context.test.ts test/agent.test.ts test/agent-lifecycle.test.ts test/context-panel.test.ts test/prompt-suggestions.test.ts test/runtime.test.ts test/reload.test.ts test/agent-registry.test.ts`. CLI command passes37/37 in w325-cli-tests.txt: `node --import tsx --test --test-concurrency=4 --test-timeout=20000 test/cli.test.ts test/cli-advanced.test.ts test/cli-gateway.test.ts test/cli-migration.test.ts`.

Actual compiled `node scripts/smoke-host-identity-cli.mjs` passes3owned loopback requests in w325-cli-green.txt,fixture JOB_TMP/host-identity-cli-M3K1lZ. The request keeps model gpt-identity-fixture,contains LiTcode identity and the custom user/project roots,and explains that another client directory does not select the host. Its scripted tool call actually writes chosen-user/skills/owned/SKILL.md;the foreign .codex fixture retains only its unchanged keep.txt. Original resume receives the same host context while the original metadata line stays byte-identical. All calls exit0 and release locks. This proves the request contract and actual tool effect,not autonomous GPT decision quality.

Full suite,real GPT/Magpie response,paid upstream and package smoke remain not_run. Paid calls0. No actual user .codex directory or installed content is modified.

## Source and target comparison

Three AST-bound literal source/target diffs compare Nl to HOST_IDENTITY,FHn/Ug to hostContext,and mFn/u_s to Agent.request. Manifest identities,exact source AST nodes,target method/variable ranges and body digests are stored in JOB_TMP/w325-source-comparison.json. All3diffs are read. These are explicit adapters rather than a copy of the complete source system builder. The source product/provider branches are neutralized;the user-requested installation distinction and actual config roots come from existing host loaders. Original recorded system remains in its journal while current host context is appended at the request boundary.

Source acquisition also verifies Gat [119601,119650) in chunk-sfn1dbxq.js,which joins its environment pieces. Path sanitizer su delegates to its source facade;the owned formatter uses JSON.stringify instead of copying that external helper tree. No unrelated platform/sandbox/account telemetry fields are invented.

## Content identity

`node scripts/identity.mjs --output JOB_TMP/w325-review-identity.json` records inputs861files,1e78fcad4af79b0d1ea380a047ac1ebe63ed6b9e059eeec0e8e140ba334c825e;validation329files,8db796cd259865115ef620b3176e5c8d6635568375a497afca019addbe8a430c;build615files,9d023b7d41194bc16dfd14faa63d7fdfe72d7de127c1684f26d9742bfcabb2ac. Combined1805file identity is80d2eaa8f01210d9eddf21ee062762b5defa7a613008c9262120844315d5388e. The compiled run reports that identity. README/research/audit docs are outside this inventory. Validation includes the user's existing skills-command change,which stays outside the package commit.

## Review and delivery

Independent correctness review in workflow wf_af666037-f26 reports0confirmed scoped defects. Its17/17host-context/Agent tests and actual compiled3request CLI chain pass,exit0,in JOB_TMP/w325-independent-tests.log and w325-independent-cli.log. The independent fixture host-identity-cli-oJBuCB writes its LiTcode skill,retains foreign .codex bytes and original metadata,and releases locks. Identity before/after matches80d2eaa8. Child configuration/role ownership is statically checked;custom-child and isolated-workspace CLI behavior remain unmeasured.

The read-only comment review reports one redundant host-behavior line,0MUST KILL and0suppressions,with required provenance retained and no confirmed attribution gap. Main removes that line from src/agent.ts and narrows README to requests built through Agent.request rather than all independent hook/classifier requests. Final rebuild passes,exit0,in JOB_TMP/w325-final-build.txt. Across the1805file inventory,only src/agent.ts and dist/agent.js change after independent review;TypeScript printing with removeComments confirms both retain identical executable syntax. JOB_TMP/w325-final-syntax.json records this transfer. Final identity in JOB_TMP/w325-final-identity.json is d011b9a195b88811ff50e10b245ce9ea253a87b2e9c48d926396fcf3c94e4466;inputs861files,558821677a0cc4a722f9f6fa7ea383cea1d13f4a06ce1d3aa3d8111cde2dab1c;validation329files,8db796cd259865115ef620b3176e5c8d6635568375a497afca019addbe8a430c;build615files,11e683f8dd4d57c2081798ad05d335d2c3ce84dc6dd017c200c67a2a6047da2a. No unchanged successful suite is repeated after that comment-only cleanup.

Main's scoped deslop pass retains required provenance and the recorded current-resume adapter reason. Model the Domain keeps context derived from existing SessionConfig with no independent host detector or state. No dependency or suppression is introduced. S-1/S-7 source precedes edits and three body diffs are read;S-2 preserves pinned model/prompt/metadata;S-3 quotes paths;S-4 adds no mutable owner;S-5 asserts actual bytes/requests/cleanup;S-6 updates the shared request consumer. Loop/W323 stay paused;local-only/no coauthor/no push.
