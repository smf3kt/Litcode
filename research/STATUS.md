# Research and implementation status

2026-10-16 W58 local closure. TypeScript 7.0.2 reports 136 errors/64 files; three owned adapter regression groups pass. Full build and CLI remain unverified. [Evidence and remaining work](ports/W58-types.md).

Last updated: 2026-10-11. Recovery files and extracted application text remain research data. Current contracts were checked against ordinary repository source; no new REA analysis was needed. The 948/948 hooks/MCP suite, 879 and 759 are historical checkpoints. Continuous migration passed actual CLI fixtures, independent affected checks (earlier 156/156, final watcher/terminal 40/40 and session 22/22) and final TypeScript below. Counts overlap and are not added. Product migration remains incomplete.

## Goal and decisions

Build an independent personal coding harness by studying the locally installed Claude Code. The latest user request expands migration to its existing feature inventory while retaining the exclusions below. Own the task/tool loop, tools, recovery, context and local runtime. Magpie owns model routing and protocol translation; the official SDK is retained only as a configurable Messages gateway transport. FEATURES.md records per-family progress and differences; INTERACTIVE.md records the bounded command/runtime inventory.

User direction on 2026-10-10: rename credential configuration to LLM_API_KEY, support arbitrary configured model IDs, exclude OAuth, omit automatic vendor attribution/co-author trailers and hidden watermark insertion. These behaviors were not present in the independent implementation; explicit system constraints and byte-preserving response tests were added. The claim about Chinese-specific watermark behavior in the original product has not been independently established by this investigation.

The user requested feasibility analysis first, estimates for continuous AI-agent execution rather than human engineering time, and then explicitly started implementation. The initial planning estimate was 7-20 agent-hours for a runnable independent version, 15-44 agent-hours including stability work. These estimates have not been calibrated against the project's actual elapsed work.

The development host context override was changed from 272,000 to 356,000, then to 512,000 tokens on 2026-10-10. The latter change followed inspection of this project's host compaction metadata: eight automatic compactions, the latest four at approximately 323,000-325,000 input tokens, with 41.0 minutes of cumulative compaction duration across all eight (including the latest boundary at 2026-10-10T13:19:20.818Z). At that historical checkpoint, ~/.claude/settings.json set CLAUDE_CODE_MAX_CONTEXT_TOKENS=512000 and CLAUDE_CODE_AUTO_COMPACT_WINDOW was already 512000. A subsequently launched shell inherited those values; this historical observation is not evidence of the current host process state. Static source shows the auto window is capped by resolved model capacity, while MAX_CONTEXT_TOKENS participates in capacity fallback rather than overriding every known model. Subsequent static tracing found environment application at startup and specific refresh paths, while ordinary settings-file watching only refreshes configuration caches; a restart is required to guarantee that the main process uses the new values. For codex/gpt-6.1-sol, runtime catalog capacity takes precedence over the environment fallback. If the resolved window is 512000 and default compaction reserves apply, the estimated automatic threshold is 393600 tokens. Actual upstream 512k acceptance remains unverified. That is historical host-context research. The user subsequently requested a 1M context and compaction at 512k; current independent harness defaults are contextTokens=1000000 and compactAt=512000, separately configurable and pinned in each session. Earlier 356000/300000 defaults remain in historical snapshots. These settings do not prove upstream capacity; the new independent defaults passed the merged offline checks below.

Latest parent-reported host configuration sets both CLAUDE_CODE_MAX_CONTEXT_TOKENS and CLAUDE_CODE_AUTO_COMPACT_WINDOW to 1000000. This is a configuration-file change, not verification that the already-running host process reloaded it. Focused static research supersedes the earlier 393600 threshold estimate: w5 = resolved context/window - min(output maximum, 20000); with a configured percentage, the threshold is min(floor(w5 * percentage / 100), w5 - 13000), otherwise w5 - 13000. For a resolved 1000000 window and 128000 output maximum, w5=980000 and percentage=52.2449 yields floor(512000.02)=512000. The parent verified the targeted JSON keys: context/window=1000000 and percentage=52.2449. Actual running-process reload and new subagent/upstream capacity remain unverified; restarting the host and recovering the session ensures the next startup reads the configured values. A known runtime model catalog can still cap the resolved window. Static source anchors in chunk-sfn1dbxq.js (zero-based UTF-16, end exclusive) are w5 [863057,863156), O4 start 859186, Vl start 864052 and aE start 861173. These are source-reading findings, not runtime measurements; the module identity remains the recorded 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da digest. The independent harness's direct compactAt=512000 setting is separate from this host formula.

Gateway configuration: LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_AUTH (bearer/api-key), LLM_TOKEN_COUNTING (estimate/api), LLM_THINKING, LLM_PROMPT_CACHE and LLM_EAGER_TOOL_INPUT. Effort has five validated levels and request integration; the earlier feature flags and CLI surfaces passed the 759-test baseline, and the latest advanced surfaces passed the final 879/879 merged suite. No hardcoded default model ID. Optional capability fields default off. Credentials are read per process and excluded from session metadata; endpoint and capability settings are pinned in the session. Estimate mode uses a conservative UTF-8 byte budget and makes no count_tokens request. The gateway adapter explicitly supplies authentication/baseURL rather than allowing vendor environment defaults.

The initially proposed additional OpenAI protocol adapter was dropped following the user's clarification that Magpie handles protocol translation. There is no src/protocol.ts or additional provider dependency.

## Sample identity and evidence

| Property | Observation |
| --- | --- |
| Installed entry | `/Users/mant1ssa/.local/bin/claude` |
| Resolved executable | `/Users/mant1ssa/.local/share/claude/versions/2.1.296` |
| CLI version | `2.1.296 (Claude Code)` |
| Format | macOS arm64, little-endian 64-bit Mach-O, Bun standalone payload |
| SHA-256 | `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937` |
| REA evidence file | `claude-code-2.1.296-evidence.json` |
| REA Evidence ID | `ev_78cf3bf31c22d3848853e5f62e91086b0053fb6235864c106a8b3290f06a8bf4` |
| Evidence authority | shipped-artifact; observed; native-macos provider |

The REA record establishes native layout, not the later custom Node extraction or runtime feature execution. No recovered JavaScript was executed. The native analysis session has been closed. Personal credentials and historical user sessions were not used for this research.

Native layout anchors from the earlier investigation:

- `__BUN` segment file offset: 68,206,592; size: 171,769,856; VM address: `0x1042dc000`.
- `__bun` section size: 171,766,891.
- Raw graph base: 68,206,600 (section offset + 8).
- Trailer file offset: 239,973,467; offsets structure: 239,973,435.
- Graph byte count: 171,766,835.
- Module table relative offset: 171,609,622; byte length: 135,668.
- Record stride: 52; records: 2,609; entry id: 6; flags: 8,191.
- Six little-endian StringPointer pairs: name, contents, sourcemap, bytecode, module_info, bytecode_origin_path; followed by encoding, loader, module_format, side.

Format reference: https://raw.githubusercontent.com/oven-sh/bun/main/src/standalone_graph/StandaloneModuleGraph.rs . The inferred record layout is validated for this sample; compatibility with all Bun versions is unknown.

## Authoritative extraction and index

Use `extracted-v2/manifest.json` and `research-module-index-v3.json` for ongoing work.

Extraction verification performed on 2026-10-10:

- All 2,609 materialized module digests match their decodedSha256.
- All modules were compared directly to executable bytes at contentFileOffset/contentBytes and re-decoded according to their encoding; all match.
- 146 encoding=0 binary records preserve raw bytes exactly (rawSha256 equals decodedSha256).
- 2,447 encoding=1 records use Latin-1 to UTF-8 conversion.
- 16 encoding=2 records use UTF-16LE to UTF-8 conversion.
- Source sample SHA-256, record count and every raw module SHA-256 match the earlier extraction.
- Corrected materialization differs in exactly three binary JS-suffix resources and 16 UTF-16 documentation/text resources. Existing JavaScript text module coordinates are unchanged.
- No source maps were observed; bytecode and module metadata are validated/indexed, not decoded.

Static index: 2,366 successfully parsed text modules (cli plus 2,365 JavaScript modules), 0 parse failures. These three resources have encoding=0 and loader=5 and are recorded as skipped binary data:

| Resource | Raw SHA-256 |
| --- | --- |
| chart.umd.min.js | `bd2f410be835f42c3001faa320f78673904613b4f8ba5017b98024c8cc3c7ddf` |
| hljsBundle.generated.min.js | `d7749ea32a9646d5dfa844a610851c6d10d1c31059426a4d7de3e1f0f420afaa` |
| mermaid.min.js | `d98ea41d54f7d3253f244c7834baf3f322f2aaa9e09fa9205db627e58ebd84cf` |

Their loader representation remains unexplained; JS filenames alone do not establish readable source. Earlier `extracted/`, `research-module-index.json` and `research-module-index-v2.json` are retained historical outputs; the older index's three parse failures do not mean the new text extraction failed.

Acorn start/end coordinates are UTF-16 source string indices; end is exclusive. The index's bytes value counts UTF-8 text. Indexing is a marker/import/function projection and is not a complete call graph. Parent functions may include nested marker matches.

## Focused findings and migration ledger

Entry module `cli`:

- Module id: 6; original contents file offset: 186,681,699; contents length: 24,142.
- Raw/decoded SHA-256: `5ec1302ba8afecce27dd404105070c2cbb3048d7c3a6dbf9265d6500b7d50daa`.
- Bytecode length: 86,176.

Query-loop module `chunk-5b2hxy2e.js`:

- Module id: 643; original contents file offset: 203,698,024; text length: 199,470.
- Raw/decoded SHA-256: `46d7f73a2b28fd9493ecf37d85abc89acd020f6de7e2bdb83efe621811f12656`.
- Async generator `yd`: [127837, 197949), 70,112 source indices.
- Injected dependency seam around index 128314; `Il` around 110641 contains callModel/autocompact/uuid/now dependencies.
- Executor factory `Rl`: [109063, 109905).
- Mid-turn helper `pd`: [127217, 127668).
- Refusal-compaction helper `Qa`: [84630, 87642).
- Failure cleanup helper `rn`: [42616, 43272).
- Drain `En`: [141509, 141810); invariant/error finish `Pr`: [141810, 142755).
- Tombstone helper `be`: [148681, 148910); message normalization `Cn` around 141211.

PreTool hook marker in `chunk-sfn1dbxq.js`:

- Module id: 415; original contents file offset: 195,234,052; text length: 4,762,583.
- Raw/decoded SHA-256: `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`.
- Async generator `FHe`: [3060941, 3062119), marker `executePreToolHooks called`.

| Claim | Evidence and interpretation | Independent implementation |
| --- | --- | --- |
| Explicit executor lifecycle | Static getCompletedResults/getRemainingResults/discardAndAbortInFlight branches distinguish completed, started and queued operations | Journal tool_start before execution and individual durable tool_result records |
| Every call must receive a result | Static invariant/error drain and compensating result paths | assertPaired enforces adjacency, full batches, IDs and order |
| Recovery must account for uncertain effects | Static abandon/reset/tombstone bookkeeping motivates conservative recovery; full dependency semantics remain unknown | Reuse durable results; error-pair incomplete/queued calls without replay |
| Compaction needs failure control | Static compacted/failed/threw/rapid_refill_breaker_tripped candidates and autocompact_thrashing marker | Summary validation plus rapid-refill circuit breaker |
| Preserve complete response blocks | Official SDK/API contract for thinking/signature and tool messages | Save finalMessage content and response; summary starts fresh history |
| Tool execution has a preprocessing boundary | Static FHe hook marker | Tool-name permission check and PreToolUse hook precede tool effects; validated replacement input reaches execution |

This ledger states static observations and design inferences. Dynamic invocation, exact numeric thresholds and complete cross-chunk svt/Fir/$Ko dependencies remain unresolved. The independent implementation is not a runtime-equivalent reconstruction of all Claude Code features.

## Current implementation

- `src/provider.ts`: configurable GatewayProvider, Messages streaming transport, bearer/api-key auth, opt-in capability fields, API count or conservative local estimate, injected ModelProvider interface.
- `src/session.ts`: UUID JSONL journal, config fingerprint, fsync records, exclusive locks, incomplete-tail recovery, message projection.
- `src/agent.ts`, `src/tool-output.ts`: sequential tool batches, tool pairing, stop-reason gating, cancellation, interrupted-call reconciliation, turn limit, summary compaction and central final text-result maxOutputBytes checks (including hook replacements/custom tools). Truncation metadata fits the cap, oversized JSON stays valid and native media limits remain separate; focused limits integration passed 29/29; all eight helper units and output integration regressions are included in the final 879/879 passing suite.
- `src/tools.ts`: read_file, list_files, search, write_file, edit_file, opt-in run_command.
- `src/cli.ts`, `src/interactive.ts`, `src/sessions.ts`, `src/terminal.ts`: one-shot, TTY multiline/grapheme editor and streamed readline input; resume/continue, list/fork/clear/rewind, manual compact, model/permission transitions and offline demo. Structured headless I/O and keybinding CLI integration passed the 759-test baseline. New /context, /usage (/cost alias), /effort and actual question/plan/findings callbacks are included in the final 879/879 passing suite.
- `src/config.ts`, `src/runtime.ts`, `src/agent-types.ts`: cascade, bounded imports/YAML, conditional-rule pre-write retry, pinned skills/types, startup memory, schemas and lazy owner resources. Verified enabled installed plugins contribute skills/agents/hooks/MCP at startup or /reload; project/user/plugin agent precedence retains the shared 8 MiB text budget and 2 MiB file cap. Plugin discovery itself is inert; runtime owns later execution.
- `src/hooks.ts`, `src/async-hooks.ts`, `src/agent.ts`, lifecycle helpers and `src/permissions.ts`: 33 events, mixed groups, 1024 entry/definition caps, owner-journaled once and merged skill preflight. Script/callback/read-only MCP and new owning event contracts are recorded below and in HOOKS.md. Prompt uses one tool-free call; agent uses eight read-only calls/32 tools per batch. Stop/SubagentStop, pre-effect gates, permission recheck and durable tool_output remain. All resolver types share actual HookLifecycle capacity through timeout settlement.
- `src/tasks.ts`: persistent UUID strict-DAG tasks and atomic locks. New-session taskProjections defaults true: get/list hide the internal metadata namespace and completed blockers, derive reciprocal blocks and pending readiness; update addBlocks/removeBlocks writes dependent blockedBy edges in one mutation. Old absent flag preserves prior schema; original numeric IDs/Get/List visibility still differ.
- `src/mcp.ts`, `src/mcp-http.ts`, `src/mcp-client-requests.ts`, `src/mcp-subscriptions.ts`: existing stdio/HTTP/callback bounds retained (32 KiB input, 1 MiB result/frame, 16 actual connection callbacks until settlement). Opt-in subscriptions expose acknowledged URI mutations and bounded destructive polling, as detailed below. Stdio push and HTTP active POST SSE are distinct; MCP tasks/reconnect remain Partial, OAuth Excluded.
- `src/mcp-host.ts`, `src/runtime.ts`, `src/session.ts`, `src/cli.ts`, `src/interactive.ts`: pinned optional mcpClient roots/sampling/elicitation and CLI switches; resume retains original flags. Trusted callback factory rebinds for child/relocation. Sampling keeps fixed model/shared budget, server data quoting, no host system/history/tools, count < compactAt, maxTokens clamp and min(maxOutputBytes, 64 KiB) text cap. Host stages remain capped at 16 until actual settlement. Interactive form UI/hooks are integrated below; URL forms and sampling tool/media extensions remain gaps.
- `src/subagents.ts`, `src/agent-registry.ts`, `src/skill-runtime.ts`: separate child journals, general/explore/custom YAML types, names/model/effort selection, foreground/background, owner mailboxes and continuation. Agent fork inherits parent model/effort and a cloned paired prefix before the launching batch, omitting thinking/redacted_thinking. Synchronous and background context: fork skills also receive that prefix, scoped grants and hook overlays; fork_seed turn boundaries distinguish seeded history from a pending child turn. A trusted runtime factory creates a fresh worktree runtime with schemas matched to the allowed parent tools and journals outside the checkout in the parent workspace. Registry leases retain isolated state for completed-child mailbox continuation and close on owner teardown/stop/failure/history eviction; dirty or unmerged work is preserved with cleanup_error. Original hosted/type/fork/isolation semantics remain Partial.
- `src/workflow.ts`, `src/workflow-store.ts`: finite declarative DAG with new-session workflowPersistence default true. Lazy session-owned snapshots under .agent/workflows/OWNER store whole definitions/settings digest and bounded summaries; 128 runs, 2 MiB/snapshot. resume_from requires identical complete DAG/settings and creates a new run reusing completed tasks; failed/cancelled/skipped rerun. Crashed running effects remain unknown until explicit retry_interrupted. Owner locks/recovery guard and persistence failure abort protect scheduling; no child-session reattachment, automatic effect replay or script Workflow API. Old absent flag preserves ephemeral schema.
- `src/worktrees.ts`, `src/worktree-session.ts`, `src/workspace-session.ts`, `src/checkpoints.ts`, `src/rewind.ts`: existing owned Git/child/checkpoint contracts plus /worktree NAME and /worktree-exit for main-session relocation at completed boundaries. Verify owned checkout/return relationship, rebuild runtime, create new UUID, persist return workspace and retain checkout/branch on exit; nested entry and /cwd require exit first. No tmux. Explicit combined rewind retains exception rollback; automatic snapshots and crash recovery remain pending.
- `src/plugins.ts`: existing four opt-in tools/digests/locks/rollback plus optional manifest skills/agents directories and hooks/mcpServers JSON paths with wrappers and 512 KiB component caps. Enabled discovery verifies snapshots without executing them, scopes MCP names to plugin/server, merges plugin hooks before explicit layers and replaces complete servers from later explicit layers. New session or /reload pins components. Marketplace/publishing and complete original semantics remain Partial.
- `src/interaction-tools.ts`: ask_user_question, submit_plan and report_findings use validated JSON, readOnly flags, bounded serialized callbacks, timeout/cancellation and output limits. Interactive CLI supplies actual callbacks; submit_plan returns approved without changing permission mode. Headless ask/plan without callbacks produces paired errors; findings returns complete validated JSON.
- `src/media.ts`, `src/clipboard.ts`, `src/lsp.ts`, `src/web.ts`, `src/web-search.ts`, `src/memory.ts`, `src/auto-memory.ts`: native blocks and configured LSP/web/memory plus explicit PNG clipboard intake/cleanup below. Opt-in model memory policy and bounded snapshots remain; model fact selection awaits real use. Hosted search depends on configuration.
- `src/notebooks.ts`: nbformat 4 read/edit, validated sources/IDs, type conversion, metadata preservation, 8 MiB file cap and atomic writes.
- `src/background.ts`: session-only process jobs and command/WebSocket Monitor, bounded tails/queues/history, connection/close diagnostics, message size/rate caps, cancellation and process/socket cleanup. Old journals retain their exact command-only Monitor schema on runtime rebuild.
- `src/scheduler.ts`: five-field local cron, one-year search, DST progression, seven-day expiry, separate dynamic wakeup and injectable clocks/timers. Subsequent optional schedulerJitter contract is below; default timing remains exact.
- `test/runtime-events.test.ts`: ownership/schema resume, child controls, clear cleanup, idle delivery and slash-event injection regression tests.
- `test/cli-gateway.test.ts`, `test/migration-integration.test.ts`, `test/cli-advanced.test.ts` and module regressions: actual CLI and Agent paths over owned loopback HTTP/SSE/WebSocket fixtures, schema snapshots, pairing, resume, cancellation, lifecycle and permissions. Default new-session source tool pool is 46 without configured MCP/LSP/search backends or plugin enablement: the previous 43 plus question/plan/findings. agentTypes enhances the existing agent schema without adding a tool; plugins.enabled adds four. Feature gates, configured backends and older pinned snapshots change the inventory.
- `test/agent-types.test.ts`, `test/plugins.test.ts`, `test/interaction-tools.test.ts`, child/skill/runtime and interactive regressions cover the latest advanced contracts and passed the final 879/879 merged suite. Focused checks also passed registry/subagents 45/45, actual Git isolation 10/10, skills 26/26, external storage 17/17, tool-output helper 8/8 and limits integration 29/29. Fork seed boundaries, lease cleanup, workspace directory guards and central output bounds are included; the earlier 837-test failing run remains historical.

Gateway changes exposed configuration key-order normalization during journal schema parsing: it changed the JSON-based fingerprint on resume. Validation now preserves original parsed key order; CLI round-trip exercises the fix.

Recent fixes:

1. SDK request namespace alias changed to MessageCreateParamsNonStreaming; helper still streams.
2. CLI fixture tool-use responses include caller:{type:'direct'}.
3. Temporary demo path is canonicalized with realpathSync (macOS /var versus /private/var).
4. Extraction decoding is controlled by encoding, not suffix.
5. Indexer classifies binary JS-suffix records separately and records coordinate semantics.
6. In-flight ripgrep abort state is propagated; stderr retained bytes obey cap.
7. Earlier fixes cover dash-leading search patterns, .agent exclusions, pre-abort side effects, literal replacement dollars, UTF-8 truncation, streamed reads and Shell process-group cleanup.

## Historical merged verification and baselines

Verified baseline before the latest advanced features: on 2026-10-11, the parent verified the then-assembled tree after the earlier source workers held their changes:

- `npm run check`: exit 0; `/private/tmp/cc-reverse-final-check.log`.
- `node --import tsx --test --test-timeout=20000 test/*.test.ts`: 759 tests, 759 passed, 0 failed, cancelled or skipped; 17,751.799125 ms; `/private/tmp/cc-reverse-full-final.log`.
- CLI help: exit 0. Offline demo: exit 0, three scripted model calls, write/read paired, final end_turn; `/private/tmp/cc-reverse-demo-final.log`.
- Included regressions: actual CLI HTTP/SSE/WebSocket, configured search, native media blocks, keybinding TTY, JSON/stream-json/schema/token budgets, skill approvals/background completion, lazy resource identity, once-only idle subscriptions, bounded agent hooks, lifecycle pre-effect gates, transformed-output recovery and pinned conditional imports.

The earlier 605-test checkpoint is historical. The first merged pass found 9 failures among 744 tests; fixes covered macOS user-directory aliases, Poll control filtering, repeated same-owner skill tool identity, factory schema expectations and an async fixture's directly reaped PID. The final passing suite includes these regressions. These are offline contracts, with scripted providers and owned local peers.

Final advanced verification on 2026-10-11, parent-confirmed after source freeze:

- Full offline suite: 879 tests, 879 passed, zero failed/cancelled/skipped, 20,931.425375 ms; /private/tmp/cc-reverse-full-merged-final.log.
- Final npm run check: exit 0; /private/tmp/cc-reverse-merged-final-check.log.
- CLI help: exit 0; /private/tmp/cc-reverse-help-merged.log. Offline demo: exit 0, three scripted calls, paired write/read and end_turn; /private/tmp/cc-reverse-demo-merged.log.
- Included cases: eight tool-output helper units, two custom/post-hook output journal/resume integrations, two exact 511999/512000 context-threshold tests, external storage 17/17 and all advanced child/skill/plugin/interaction regressions. Focused registry/subagents 45/45, actual Git isolation 10/10, skills 26/26 and limits integration 29/29 also passed.

Both cleanup audit items are resolved and merged-verified: registry active workers remain present through shared environmentClosing and completed-child stop/concurrent get(wait) observes that same cleanup promise; standalone environment.close preserves a successful end_turn summary plus checkout path/cleanup_error when dirty work is retained. Seeded foreground/registry agents and synchronous skills record fork_seed boundaries, with registry journal-budget accounting.

Agent.result centrally applies boundToolContent to aggregate final text results, including custom tools and post-hook replacements: maxOutputBytes defaults to 24,000 UTF-8 bytes and includes omission metadata. Truncation keeps a complete UTF-8 prefix; oversized JSON gets an explicit truncated/originalBytes/preview envelope when it fits. Smaller valid-JSON fallbacks are used for tiny caps (1-2 bytes yields 0), so not every result carries a truncation label. Image/PDF blocks retain separate media limits. Exact boundary regressions show input >= compactAt triggers compaction at the default 512000, while 511999 does not.

Historical intermediate results remain distinct: the first advanced run had 837 tests, 835 passed, one failed and one cancelled before the fork seed-boundary fix. External storage tests initially lived at NEWtest/session-storage.test.ts outside the default glob and found regular-file workspace acceptance (16/17); the guard was fixed and the tests moved into test/session-storage.test.ts before the final suite. Neither intermediate result describes the final assembled tree.

Research verification remains unchanged: all 2,609 corrected extraction modules matched original executable bytes; index parsed=2,366, skipped binary=3, failures=0. Node v26.10.0 with tsx 4.20.6 has emitted DEP0205 for module.register in historical runs. No real upstream model request, deployment-window validation, hosted-provider verification or full-product equivalence has been performed.

## Historical hooks/MCP final verification

Parent-confirmed after all source workers held changes on 2026-10-11:

- npm test: 948 tests, 948 passed, 0 failed/cancelled/skipped, 29,344.12325 ms; /private/tmp/cc-reverse-hooks-mcp-final-tests.log. Standard test command now sets --test-concurrency=4 and keeps --test-timeout=20000 to bound concurrent child-process fixtures without extending their deadlines.
- npm run check: exit 0; /private/tmp/cc-reverse-hooks-mcp-final-check.log.
- CLI help and offline demo: exit 0; /private/tmp/cc-reverse-hooks-mcp-help.log and /private/tmp/cc-reverse-hooks-mcp-demo.log. Demo completed three scripted calls, paired write/read and end_turn.
- Focused evidence: hooks 66, hook journal/owner 5, merged skill preflight 31, MCP transport/runtime/host integration 120/120 at concurrency 2 (including handler 18), final host 21/21 and CLI 5/5. Earlier integrated 81 and host 19 checks preceded final fixes; focused runs overlap and must not be summed into a full-suite total.
- Audit closure in the final source: validate merged hook counts before skill effects; reserve 16 direct callback slots/ids until actual completion; separately retain 16 host-factory approval/count/provider/elicitation stages until actual settlement, including noncooperative abort cases. Current default no-backend/no-plugin tool pool remains 46.

The first hooks/MCP full wave is intermediate evidence: 944 tests, 931 passed, five failed, eight cancelled, 501,979.134125 ms; /private/tmp/cc-reverse-hooks-mcp-full.log. That run preceded fixture/concurrency stabilization and final callback-capacity regressions. A bounded-concurrency-4 recheck passed 78/78 with zero failures/cancellations/skips in 13,803.478166 ms (/private/tmp/cc-reverse-wave-timeout-recheck.log); the final 948 suite supersedes the first wave. The prior 879/879 result remains its own source checkpoint rather than validation of the newer source.

## User attachment continuation

2026-10-11: user requested actual-use validation and only a few necessary regressions. Implemented /attach PATH [--pages RANGE] PROMPT and one-shot --attach PATH/--pages RANGE. Paths are workspace-relative; interactive paths accept quotes and escaped spaces. Agent.run keeps prompt hooks on text, reads one file with the active turn signal and journals native media bytes with the accepted prompt/context. features.media=false gates intake; existing 10 MiB/file and PDF selection bounds apply. No new default tools or OAuth paths.

Before journaling the attachment, count the new request alone and then with existing history. Oversized new input fails without a user media record. If prior history fills the budget, compact only that completed history, mark the boundary and recheck before adding media; a failed recheck leaves completed history resumable. Default byte-based estimate includes base64, so the threshold may admit substantially less than the file cap. Resize/reencode and full image decode remain gaps; clipboard was added in the later continuous migration below.

Actual CLI smoke passed via scripts/smoke-media.mjs (npm run smoke:media): one-shot PNG byte identity; resume after deleting the original image; interactive selected PDF page 2; invalid path followed by a successful task; clean journal lock release. Three real CLI gateway requests reached the owned loopback Messages SSE server. This is local wire/runtime evidence, not upstream media comprehension. Added only three high-value regressions (hooks/image/reopen, prior-history compact/PDF, overflow/invalid/cancel), with existing interactive checks 9/9 passed in 946.741584 ms. TypeScript passed. Logs: /private/tmp/cc-reverse-media-cli-smoke.log, /private/tmp/cc-reverse-media-tests.log, /private/tmp/cc-reverse-media-check.log. Full suite was not rerun; 948/948 remains the pre-attachment baseline.

## Continuous migration contracts and verification

2026-10-11 parent-confirmed continuation uses actual CLI fixtures plus necessary affected regressions. Final results below are distinct from the historical 948/879/759 full-suite baselines and prior media/memory/reload/rewind records. No new full suite was run; overlapping focused counts stay separate.

Current additional contracts superseding older pending descriptions:

- Hook script is a synchronous shell command. Callback names resolve only through a trusted RuntimeOptions.hookCallbacks registry, with no settings-driven JavaScript imports. Read-only namespaced mcp_tool checks input permissions and executes directly without recursive hooks. Prompt/agent/callback/MCP stages share a cap of 16 per actual HookLifecycle, retaining slots across timeout until underlying settlement. Notification observes runtime events between turns; explicit local idle subscriptions fire TeammateIdle and may gate that notification turn. DirectoryAdded observes /cwd or worktree relocation. HOOKS.md records consumer differences.
- mcpClient.elicitation and --mcp-elicitation opt in to active interactive user-task form JSON UI, at most three attempts, :decline/:cancel and Elicitation/ElicitationResult hooks. --mcp-elicitation requires --interactive. Startup/idle/headless/absent callbacks cancel; aborted/error paths do not guarantee ElicitationResult dispatch. Per-connection and host-factory 16-stage bounds remain separate.
- features.mcpSubscriptions defaults false and requires advertised subscribe. ExplicitURI mutation/polling keeps32subscriptions/4096bytesURI/128updates32KiB/dropcounts. Stdio push;HTTPdefault activePOST SSE,additional mcpNotificationStream flag enables ownedGET under the later finite contract. Historical noGET checks retain default scope;no reconnect/replay/persistence/autoRefetch. MCPtasks/samplingextensions remain gaps.
- Enabled installed plugins now contribute agents as well as skills, hooks and namespaced MCP configs at startup/reload. Discovery remains inert; runtime owns later execution. Project/user/plugin type precedence and pinned resume snapshots remain intact.
- /paste-image uses macOS PNGf or Linux Wayland/X11 PNG, 10 MiB/5s read, private .harness/attachments store (128 files/64 MiB) and identity-checked post-task cleanup. Owned fixture validation exercises the actual CLI with zero real user clipboard reads; Windows clipboard and image decode/resize remain gaps.
- /agents and /mcp display pinned catalogs/adapter limits; /rename TITLE journals a title and /sessions [QUERY] searches title/model/UUID. /resume UUID switches at a completed boundary to the target original config/runtime, retaining its UUID; different gateways require restarting CLI with --resume, unfinished target turns require /continue. /tasks directly calls permission-gated task_list; /diff NAME [OFFSET] calls permission-gated paged checkpoint_diff; /workflows checks workflow_get permissions and lists bounded owner runs including saved snapshots through a lazy helper. Inspection adds no tool schema or model call. /cwd and worktree relocation strip thinking/redacted_thinking from copied messages and response blocks consistently; original journals remain intact.

Optional watcher: --watch-config requires --interactive; watchConfig is optional/pinned and absent by default. src/config-watch.ts bounds fs.watch to 64 handles, 2048 entries, 2048 instruction paths, skill depth 3 and 250ms debounce, with missing-root sentinels. bindConfigWatch obtains loaded instruction/conditionalRule/import paths, including ancestors/nested files, and watches settings/keybindings/catalogs/explicit settings/plugin index while skipping runtime data. Changes queue /reload after completion; transitions rebind, exit closes handles. Reload validates/reset keys and applies them atomically, retaining pending paste/draft/history; bad config preserves the previous runtime. Actual fs.watch and expect PTY verification passed below. Full recursive discovery, unloaded dynamic imports/plugin bytes and managed policy remain gaps.

Session continuation: /model, /effort and permission transitions strip thinking/redacted_thinking from copied messages/response blocks, preserve/reindex checkpoints and retain original journals. Reload/fork/relocation/rewind copy titles within retained history boundaries; listing ignores newline-uncommitted titles. Final session regressions passed 22/22; actual CLI model switch/title inheritance passed.

Final npm run smoke:config-watch-cli exited 0; /private/tmp/cc-reverse-config-watch-cli.log. Owned loopback SSE handled 8 requests; actual macOS /usr/bin/expect PTY exercised keybinding hot reload/draft retention. Observed reloadAfterTurn, changed/importedInstructions, ttyKeybindings, modelSwitch, titleInherited, invalidConfigOnce, oldRuntimeUsable, toolCatalogReloaded, memoryIgnored and locksReleased. Earlier /usr/bin/script failed with tcgetattr/ioctl on pipe stdin and was replaced; only expect established successful PTY execution.

Final independent verification records:

| Check | Result and absolute log |
| --- | --- |
| TypeScript | Final npm run check exit 0 after correcting a missing fixture citations field; /private/tmp/cc-reverse-continuous-final-check.log |
| Earlier affected checks | 156/156, 0 failed/cancelled/skipped, 6853.133083 ms; /private/tmp/cc-reverse-continuous-focused.log; predates watcher/session final changes |
| Final watcher/terminal checks | 40/40 terminal/keybindings/watch/reload/interactive/runtime-lazy, 0 failed/cancelled/skipped, 8294.026917 ms; /private/tmp/cc-reverse-config-watch-tests.log |
| Final session checks | 22/22, 0 failed/cancelled/skipped, 1488.547583 ms; /private/tmp/cc-reverse-session-transition-tests.log |
| Watcher/PTY CLI | npm run smoke:config-watch-cli exit 0, 8 owned requests, final flags above; /private/tmp/cc-reverse-config-watch-cli.log |
| Full suite | Not rerun; historical 948/948 remains the full-suite baseline. None of the focused totals are additive |

Actual CLI and transport smoke results (all passed with owned local fixtures, no real upstream model requests):

| Path | Observed behavior/count | Absolute log |
| --- | --- | --- |
| Workflow resume | Original owner reopened, completed task A called once, retried B twice, full settings/provenance and locks retained | /private/tmp/cc-reverse-workflow-cli.log |
| Plugins | Install/inert discovery, pinned agent/skill, command/script/readOnly MCP startup hooks, stdio handshake, /agents /mcp /rename/session search; 0 model/network calls | /private/tmp/cc-reverse-plugin-components-cli.log |
| Form | Interactive accept, invalid-answer retry, capabilities and elicitation hooks; 2 model calls | /private/tmp/cc-reverse-mcp-form-cli.log |
| Clipboard | PNGf provider via owned preload, actual CLI/journal image bytes, title/search, attachment/lock cleanup; 1 owned request, 0 host clipboard reads | /private/tmp/cc-reverse-clipboard-cli.log |
| Tasks | 15 CLI operations, reciprocal edges/readiness, cycle rollback/deletion consistency and UUID store | /private/tmp/cc-reverse-task-projections-cli.log |
| Main worktree | Actual Git entry/exit/reentry, checkout/branch/source edits/local HEAD kept, locks released; 0 model calls | /private/tmp/cc-reverse-worktree-session-cli.log |
| MCP subscriptions | Actual stdio push, exact URI/unsubscribe/close; 0 automatic reads. HTTP claim remains active POST SSE only | /private/tmp/cc-reverse-mcp-subscriptions-smoke.log |
| Memory/reload recheck | Memory write/next-turn retrieval/cycle refresh, instructions/skills/tools, nested pre-write and failed-reload retention; 10 owned requests | /private/tmp/cc-reverse-continuous-memory-cli.log |
| Rewind recheck | Checkpoint, stale-preview preservation, restored/deleted files, branch/next task/locks; 5 owned requests | /private/tmp/cc-reverse-continuous-rewind-cli.log |

## Subsequent optional scheduler timing source

Local /cron calls readOnly cron_list after an allow input-policy decision, displaying bounded current-session jobs without model calls/schema changes. Enhanced npm run smoke:scheduler-cli exited0 with cronInspection true,6 owned SSE requests and prior jitter/event/delete/lock flags retained; /private/tmp/cc-reverse-scheduler-cli.log. Latest rewind CLI after journal/title changes also exited0,5 requests and all checkpoint/stale/file/branch/continuation/lock flags retained; /private/tmp/cc-reverse-continuous-rewind-cli.log.

After the verified continuous checkpoint above, features.schedulerJitter was added as an optional setting pinned only when supplied; absent/false keeps exact legacy timing, and reload applies current settings. Runtime passes it to LocalScheduler. The independent SHA-256(jobUUID:nominal) fraction delays recurring cron by at most min(10% of next nominal interval,15min); one-shot nominal minute00/30 may run up to90s early, clamped strictly after its creation baseline. Other one-shots/dynamic wakeups stay exact. No durable schedule store or original binary algorithm equivalence is claimed.

Independent scheduler checks passed52/52,0 failed/cancelled/skipped,1870.712083ms; /private/tmp/cc-reverse-scheduler-tests.log. npm run check exited0; /private/tmp/cc-reverse-scheduler-check.log. Final npm run smoke:scheduler-cli exited0; /private/tmp/cc-reverse-scheduler-cli.log: schedulerJitterPinned, cronTools, scheduledTurn, recurringJitterBounded, cancelled and locksReleased all true,6 owned loopback SSE requests using a controlled clock preload. The earlier4-request one-shot smoke is superseded by this enhanced actual CLI result. These checks are separate from earlier156/40/22 totals; no full suite or real upstream request was added.

## Remaining boundaries and next actions

Final reconnect/current package passed52 files,temporary offline production install,compiled help/demo,devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0 (/private/tmp/cc-reverse-mcp-reconnect-package.log). Current dist includes explicit reconnect,Stop guard,dynamic/plugin watches,managed fields,worktree removal and terminal sync/async/child/mux contracts. All exact source checkpoints above remain independently scoped;no fullsuite or wholeproduct migration completion is claimed.

Explicit MCP reconnect:interactive /mcp-reconnect at completion clones pinned config,reuses ConfigChange/reload branch transition without disk load,prepares new runtime/tool schemas before old resource cleanup. Failedinitialize leaves oldconnection/session usable;successful swap closes oldowner background/children/queues/subscriptions/logging along with HTTP session. No effect replay/automatic retry/per-server replacement. Actual source CLI4 owned requests passed (/private/tmp/cc-reverse-mcp-reconnect-cli.log),explicitReconnect/failedReconnectRetained/pinnedConfigUsed/changedSchemaJournaled/oldSessionClosed/noEffectReplay/locksReleased true. Compiledsameflags+compiledCLI4 passed (/private/tmp/cc-reverse-mcp-reconnect-compiled-cli.log). Existing interactive/runtimeevent16/16 passed980.517542ms (/private/tmp/cc-reverse-mcp-reconnect-tests.log);check/build exit0 (/private/tmp/cc-reverse-mcp-reconnect-check.log,/private/tmp/cc-reverse-mcp-reconnect-build.log). New smoke is actualCLI;no new unitcase/fullsuite/upstream/OAuth claim.

Final Stop guard reload follow-up:authored settings cap changes apply on /reload,otherwise stored cap retains;existing reload2/2 passed384.68325ms (/private/tmp/cc-reverse-stop-cap-reload-tests.log). Final check exit0 and package refreshed52 files/offline install/compiled help/demo/devRuntimeAbsent/extractedSamplesExcluded/upstream0 (/private/tmp/cc-reverse-stop-cap-check.log,/private/tmp/cc-reverse-stop-cap-package.log). Current dist includes Stop guard and all prior terminal/worktree/managed/watch additions;private/local scope remains.

Consecutive Stop guard:settings/newCLI stopHookBlockCap0..1024 default8,0disabled,absent legacy journals retain maxTurns. Inert original chunk-5b2hxy2e.js observes stopHookBlockingCount increment/default8 excess/tool reset. Independent durable stop_hook_count with hookId written before feedback,recovered saved decision consumes once;tool-bearing response resets0,compaction retains task count. Ninth block returns stop_hook_limit with headless2,custom naming/no vendorenv. Source npm run smoke:stop-cap-cli passed15 owned requests (/private/tmp/cc-reverse-stop-cap-cli.log),defaultEight/customTwo/disabledRetainsTurnLimit/durableCounts/jsonParseable/locksReleased true;compiled sameflags+compiledCLI15 (/private/tmp/cc-reverse-stop-cap-compiled-cli.log). Initial driver expected exit0 but CLI correctly emitted2;assertion aligned with existing noncompletion contract,code unchanged. Lifecycle24/24 passed1375.4655ms (/private/tmp/cc-reverse-stop-cap-tests.log),one new recovery/tool-reset case;existing storage/registry60/60 passed2621.683875ms (/private/tmp/cc-reverse-stop-cap-consumers.log). Check/build exit0 (/private/tmp/cc-reverse-stop-cap-check.log,/private/tmp/cc-reverse-stop-cap-build.log). Counts independent,no fullsuite/realupstream.

Final dynamic watcher package passed52 files,temporary offline production install,compiled help/demo,devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0 (/private/tmp/cc-reverse-dynamic-watch-package.log). Current dist and compiled CLI include observed main instruction/import path watches;historical plugin/managed/worktree/terminal package results retain their own scope.

Final compiled dynamic watcher actualCLI passed13 owned requests with dynamicImportWatch and all previous watcher/PTY flags,compiledCLI true (/private/tmp/cc-reverse-dynamic-watch-compiled-cli.log). Source and compiled counts are independent. Same-workspace paths process-local only;unvisited/new files and child callbacks remain uncovered.

Dynamic instruction watch: AgentEvents.instructionFiles reports actual main-Agent dynamic loadPathInstructions files/imports;interactive keeps at most2048 deduplicated process-local paths and adds them to ConfigWatcher.addInstructionPaths. Existing shared64handles/2048paths,realpath/missing sentinels and250ms debounce apply. Same-workspace rebind retains paths,relocation clears;resume re-discovers on access. Only observed file changes trigger existing completed-boundary reload;unvisited/new instruction files and child-only observations remain gaps. No persistent catalog or file evaluation in watcher.

Source enhanced npm run smoke:config-watch-cli passed13 owned SSE requests (/private/tmp/cc-reverse-dynamic-watch-cli.log),dynamicImportWatch plus all previous reloadAfterTurn/instructions/TTY/model/title/lineage/rules/picker/rollback/memory/locks flags. Deep read_tool returned imported context;edited import queued reload and repeated actual file read saw new content. Existing watcher/reload/lifecycle27/27 passed10178.657916ms (/private/tmp/cc-reverse-dynamic-watch-tests.log);existing case extended,no new unitcase. Check/build exit0 (/private/tmp/cc-reverse-dynamic-watch-check.log,/private/tmp/cc-reverse-dynamic-watch-build.log). Historical watcher9-call result retains pre-dynamic scope;counts independent,no fullsuite/real upstream.

Final compiled plugin content CLI passed all enhanced sourceflags plus compiledCLI,0 model/network calls (/private/tmp/cc-reverse-plugin-watch-compiled-cli.log). Final package passed52 files,temporary offline install,compiled help/demo,devRuntimeAbsent/extractedSamplesExcluded/upstream0 (/private/tmp/cc-reverse-plugin-watch-package.log). Current dist includes bounded verified plugin content watch and earlier managed/terminal/worktree contracts. Private/local macOS Node26 validation;no hosted provider or fullproduct proof.

Verified plugin content watch: config returns transient watchDirectories for installed components and explicit pluginDirs;interactive watch binds these realpath roots without journaling extra paths. Content mode recurses depth3,64handles/2048entries shared,ignores existing runtime directories,and queues reload on any relevant file bytes/rename. No recovered/plugin code executes in watcher;normal loader revalidates installation digest. Already pinned conditional imports,including unselected paths,were already covered;dynamic nested/new-import discovery remains a gap.

Actual enhanced plugin CLI passed0 model/network requests (/private/tmp/cc-reverse-plugin-watch-cli.log):all prior inert install/skills/agents/hooks/MCP/journal/display flags plus pluginBytesWatched/tamperReloadRetained/restoredDigestReloaded true. Existing watcher/config69/69 passed9722.503708ms (/private/tmp/cc-reverse-plugin-watch-tests.log),only existing watcher case expanded for content bytes. Check/build exit0 (/private/tmp/cc-reverse-plugin-watch-check.log,/private/tmp/cc-reverse-plugin-watch-build.log). ManagedCLI recheck passed3 owned calls/allflags after watcher changes (/private/tmp/cc-reverse-plugin-watch-managed-cli.log),separate counts. Actual real filesystem macOS Node26;no fullrecursive/fullproduct claim.

Final managed package passed52 files,compiled help/demo,temporary offline production install,devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0 (/private/tmp/cc-reverse-managed-package.log). Current dist includes explicit managed field precedence plus terminal and worktree follow-ups;private/local macOS Node26 scope retained. Feature table now reflects completed finite contracts rather than earlier blanket managed/terminal gaps.

Independent explicit managed-settings contract: bounded local JSON supports only allowShell,permissions,features,mcpClient,rejects other/unknown nested keys;loader keeps managedSettings separately and effective settings overlay. Session managedPolicy optional snapshot plus managedSettingsFile path;allowShell/permissions whole replacements,features/client authored booleans field overrides. Startup final CLI override pass and reload final override pass enforce it;system/agent catalogs see managed feature values. /permissions and /plan report pinned mode before new-session effects. External explicit file watcher uses existing64handle limits. Invalid/missing file reload keeps old runtime;direct resume uses stored policy even after deletion,and supplied managed flag is resume-locked. Feature omissions retain ordinary behavior;no OS registry/system-path discovery/remote signature/provider credential policy.

Actual source npm run smoke:managed-cli passed3 owned SSE requests (/private/tmp/cc-reverse-managed-cli.log):managedOverrides/deniedEffect/permissionCommandsPinned/watchedExternalPolicy/invalidReloadRetained/pinnedResumeWithoutFile/locksReleased true. Actual compiled script sameflags+compiledCLI passed3 (/private/tmp/cc-reverse-managed-compiled-cli.log). Config/reload69/69 passed1829.428084ms (/private/tmp/cc-reverse-managed-config-tests.log);one new essential precedence case plus expanded existing reload case. Existing storage/skill/registry87/87 passed3550.913917ms (/private/tmp/cc-reverse-managed-consumers.log);check/build exit0 (/private/tmp/cc-reverse-managed-check.log,/private/tmp/cc-reverse-managed-build.log). Existing watchCLI9 owned calls passed all previous watcher/TTY/rules/picker flags (/private/tmp/cc-reverse-managed-watch-cli.log),distinct from managed3. Counts stay independent,no fullsuite/real upstream/OAuth.

Final worktree session-only3/3 passed1115.692334ms,including locked journal,dirty failure rollback,unmerged commit preservation and explicit discard (/private/tmp/cc-reverse-worktree-remove-session-tests.log). Final package passed52 files,temporary offline production install,compiled help/demo,devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0 (/private/tmp/cc-reverse-worktree-remove-package.log). Current dist includes terminal sync/async/child/mux output and explicit worktree exit removal;private/local macOS Node26 evidence only. The40/40 run predates the extra unmerged assertion in that existing case;totals remain independent.

Explicit /worktree-exit --remove [--discard-changes]: verifies return ownership,prepares relocated session,closes old runtime+journal,starts returned session,archives checkout .agent under origin .agent/worktree-history/NAME-UUID and invokes owned remove. Archive real directories/checkout identities checked,scan16-depth/10000-entry bound and any .lock preserves checkout. Failed dirty/unmerged removal restores history when unchanged checkout remains;current CLI stays returned. Existing manager verifies registration,dirty/ignored/unmerged state and branch expected OID deletion. Normal exit remains keep. Archived history is preserved data,not picker-integrated;cross-process new-lock race,power-loss archive recovery and real tmux worktree flow remain gaps.

Actual source smoke:worktrees and compiled script passed (/private/tmp/cc-reverse-worktree-remove-cli.log,/private/tmp/cc-reverse-worktree-remove-compiled-cli.log):entry/exit/reentry/keep,explicitRemove/historyArchived,dirtyFailureReturned/dirtyHistoryRestored/explicitDiscard,sourceEditKept/localHEAD/locksReleased true,modelCalls0. Check/build exit0 (/private/tmp/cc-reverse-worktree-remove-check.log,/private/tmp/cc-reverse-worktree-remove-build.log). Worktree/session/relocation40/40 passed9931.682875ms (/private/tmp/cc-reverse-worktree-remove-tests.log);one new necessary archive test plus existing tests. Initial new fixture model empty failed before effects;explicit fixture model corrected. Subsequent session-only3/3 includes unmerged-commit preservation,separate log /private/tmp/cc-reverse-worktree-remove-session-tests.log;duration pending exact read. Earlier plain keep smoke retains scope,no fullsuite/paid calls.

Final child compiled actualCLI passed13 owned calls with all source child/resume/headless flags and compiledCLI (/private/tmp/cc-reverse-child-terminal-compiled-cli.log). Existing migration integration/skill44/44 passed2899.615333ms (/private/tmp/cc-reverse-child-terminal-integration.log),separate from child62/62. Final child-source package passed52 files,temporary offline install/help/demo/devRuntimeAbsent/extractedSamplesExcluded/upstream0 (/private/tmp/cc-reverse-child-terminal-package.log). Current dist matches child forwarding;private/local-only scope retained.

Current child terminal delivery: ChildHookOptions callback wired into legacy,registry initial/resume and foreground skill constructors;runtime passes it to model/user skill routes. Async child results save terminalSequences before forwarding;failed append suppresses terminal effects while retaining observer notification/error tracking. Runtime owner scope captured by callback prevents old-owner/rebuilt generation delivery,validates whole fields,keeps terminal-only FIFO queue capped50 events/65536 serialized bytes and counts drops. Interactive drains effects ahead of ordinary events at completed boundaries,journals hook_terminal then writes and continues without model prompt. Bound checks drop whole effects,including JSON-escape expansion. Main async notifications retain prior data/model semantics;child terminal events introduce no model turn.

Actual node scripts/smoke-hook-terminal-cli.mjs --children passed (/private/tmp/cc-reverse-child-terminal-cli.log):registry/legacy/foreground/background skill actual ExpectPTY,sync+async effects,12 child+12 parent durable records,terminalOnlyNoModelTurn/modelHistoryClean/pipedResumeSilent/headlessChildJson/locksReleased true,13 owned loopback SSE calls. Earlier10-call run preceded resume/headless coverage. Existing callback boundary smoke passed4 in-process calls (/private/tmp/cc-reverse-child-terminal-callbacks.log),distinct from actualCLI. Runtime/registry/events62/62 passed2390.094583ms (/private/tmp/cc-reverse-child-terminal-tests.log);earlier61 total preceded one new byte-cap/stale-generation test. Check/build exit0 (/private/tmp/cc-reverse-child-terminal-check.log,/private/tmp/cc-reverse-child-terminal-build.log). Event union consumers were corrected to narrow optional prompt rather than adding synthetic prompts. No fullsuite/realupstream claim.

Storage/editor existing35/35 passed752.42125ms (/private/tmp/cc-reverse-hook-terminal-journal-editor.log). Initial run used absent session.test.ts and inherited TMUX exposed the old bare-OSC editor assertion;actual session-storage.test.ts plus environment-aware emitted-byte assertion passed. These existing tests are independent from parser2/2 and child62/62.

Final compiled mux CLI passed (/private/tmp/cc-reverse-hook-terminal-mux-compiled-cli.log):compiledCLI/muxEncoding:tmux,all enhanced PTY/async/resume/JSON flags,3 owned requests. Canonical journal fields stay unwrapped;only the TTY output sink encodes passthrough.

Current mux-source package passed (/private/tmp/cc-reverse-hook-terminal-mux-package.log):52 files,compiled help/demo,temporary offline production install,devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0. Dist matches the corrected formatter;private/local macOS Node26 scope retained.

Terminal mux encoding: original OI observation chunk-kexg5hxg.js:11 was read as data. Independent formatHookTerminalSequence validates before doubling ESC and adding tmux/screen DCS,TMUX precedence,env values never emitted. Both startup/interactive sinks use it,canonical journal remains capped4096 bytes/sequence. Source CLI controlled-env PTY tmux/screen each passed3 owned requests (/private/tmp/cc-reverse-hook-terminal-tmux-cli.log,/private/tmp/cc-reverse-hook-terminal-screen-cli.log),all async/resume/JSON/locks flags. Parser existing2/2 passed200.483042ms (/private/tmp/cc-reverse-hook-terminal-mux-tests.log). Initial Pick/weak optional ProcessEnv typing failed TS2739/TS2559;explicit TMUX/STY default object corrected it,final check/build exit0 (/private/tmp/cc-reverse-hook-terminal-mux-check.log,/private/tmp/cc-reverse-hook-terminal-mux-build.log). Actual multiplexer decoding remains untested despite installed tmux/screen;child forwarding remains a gap. Earlier gap statements are historical.

Final async terminal source: RuntimeEvent notification carries optional hookTerminal metadata and serializes completion.result without terminalSequences. Interactive completed-boundary drain appends hook_terminal before TTY dispatch, with actual completion id/event and bounded sequences, avoiding synthetic hook verdicts. Resume keeps data without replay; model notification excludes raw sequence field. Owner queue eviction/release semantics stay in-memory and unchanged. Child forwarding/tmux/screen remain gaps;prior synchronous-only notes are historical.

Final compiled async PTY/resume/JSON smoke exited0 (/private/tmp/cc-reverse-hook-terminal-async-compiled-cli.log):compiledCLI and all enhanced source flags true,3 separate owned SSE requests. This confirms the final dedicated-event code in dist rather than the earlier synchronous-only compile.

Final async-source package verification exited0 (/private/tmp/cc-reverse-hook-terminal-async-package.log):52 files,temporary offline production install,installed help/demo,devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0. Current dist is refreshed;historical synchronous and GET packaging logs remain separate. The package stays private and local.

Enhanced actual npm run smoke:hook-terminal-cli exited0 (/private/tmp/cc-reverse-hook-terminal-async-cli.log): all earlier PTY/startup/prompt/exit/suppression/invalid/reopen/pipe/JSON/lock flags plus asyncBoundaryDelivery/modelHistoryClean true,3 owned SSE requests. Runtime/async ownership28/28 passed,907.43775ms (/private/tmp/cc-reverse-hook-terminal-async-tests.log). TypeScript/build exit0 (/private/tmp/cc-reverse-hook-terminal-async-check.log,/private/tmp/cc-reverse-hook-terminal-async-build.log). Initial enhanced fixture saw repeated UserPromptSubmit for the runtime event and was corrected to distinguish that prompt,without changing Agent event semantics. Dedicated hook_terminal journal was then revalidated by the final source CLI. These checks retain separate historical counts;no real upstream request/fullsuite claim.

2026-10-11 synchronous hook terminal output: src/hook-terminal.ts plus shared applyJsonOutput retain ordered terminalSequences before the PreCompact early return. Accept complete BEL/OSC0/1/2/9/99/777 only, strip payload controls, enforce OSC9 progress restrictions,4096 UTF-8 bytes for input/normalized output and128 entries/32768 aggregate bytes. Invalid fields drop; aggregate overflow diagnostics remain display data. Agent journal persists optional arrays before TTY callback delivery, independent of suppressOutput; terminal raw sink revalidates and leaves editor draft/cursor intact. Headless and piped interactive sessions omit sinks; recovered records never replay terminal effects. Uniform ST normalization is independent; tmux/screen wrapping,async/child forwarding and full original consumer equivalence remain gaps. PreCompact raw context stays unchanged.

Current hook source build exited0 (/private/tmp/cc-reverse-hook-terminal-build.log). Compiled launcher actual PTY/resume/JSON smoke exited0 (/private/tmp/cc-reverse-hook-terminal-compiled-cli.log),compiledCLI plus all source-smoke flags true,2 separate owned SSE requests. Shared existing hooks47/47 passed,2620.69375ms (/private/tmp/cc-reverse-hook-terminal-existing-hooks.log). These checks are independent of parser2/2 and lifecycle/editor41/41; no combined/full-suite total is inferred.

Final post-hook package smoke exited0 (/private/tmp/cc-reverse-hook-terminal-package.log):52 files,compiledCLI/binHelp/offlineInstall/packagedDemo/devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0. The extra compiled file is hook-terminal.js; earlier51-file GET and packaging checks keep their historical scope. Temporary offline install remains private/local; current dist includes both GET status integration and synchronous terminal effects.

Actual npm run smoke:hook-terminal-cli exit0 (/private/tmp/cc-reverse-hook-terminal-cli.log): realPTY/startupPromptExit/orderedOnce/suppressionIndependent/invalidSequencesDropped/journalReopened/pipedSilent/jsonParseable/modelHistoryClean/locksReleased true,2 owned loopback SSE model requests. Initial driver ran before helper source landed; a subsequent resume driver incorrectly passed --user-dir, then corrected to use stored settings and LF for pipe input. Final essential parser tests2/2,143.18375ms (/tmp/cc-reverse-hook-terminal-tests.log); existing lifecycle/editor checks41/41,1118.742042ms (/private/tmp/cc-reverse-hook-terminal-consumers.log); npm run check exit0 (/private/tmp/cc-reverse-hook-terminal-check.log). Counts are independent,full suite was not rerun,real upstream calls0.

2026-10-11 Post-GET currentdist: build exit0 (/private/tmp/cc-reverse-mcp-stream-build.log),compiledbin CLI exit0 (/private/tmp/cc-reverse-mcp-stream-compiled-cli.log),3 owned calls with compiledCLI/streamInspection/GETidle/close/pinned/locks true,POSTlogfalse. CurrentGET-source npm run smoke:package exit0 (/private/tmp/cc-reverse-mcp-stream-package.log):51files,compiledCLI/binHelp/offlineInstall/packagedDemo/devRuntimeAbsent/extractedSamplesExcluded true,upstreamRequests0. Temporarylocal install only,no publish/global install;macOSNode26 actualruntime,Node>=22 remains declaration. Source/check/public/compiled/package results are distinct. Currentsubscriptions/logging defaultPOST-only;explicit flag enablesownedGET,historical noGET/testtotals retain scope.

Final HTTP GET notifications: optional features.mcpNotificationStream(default absent/false) retains oldPOST-only/noGET evidence. One owned GET SSE starts asynchronously after initialized without waitingheaders,sameURL/session/protocol/auth/redirect restrictions. Header/readidle uses requestTimeoutMs(default30s),frame/line/chunk bounded parser avoids whole-stream retention;handshake still bounded. 404/405 unavailable,204/EOF ended,failedPOST remains usable,no retry/reconnect/replay. Id-less logging/resource/toolsdirty/cancel notifications only;allid-bearing RPC ignored,no tool/callback invocation. Runtime notificationStreams getter forwards snapshots and /mcp emits optional states only with enabledHTTP. Close abortsreader/waits<=1s.

Parent final npm run check exit0 (/private/tmp/cc-reverse-mcp-stream-status-check.log). Actual npm run smoke:mcp-notification-cli exit0 (/private/tmp/cc-reverse-mcp-stream-status-cli.log),3 owned requests with continuousGetLog/idleNotification/streamClosed/streamInspection/journalPinned/locks true and activePostSseLog false. Public boundary npm run smoke:mcp-notification exit0 (/private/tmp/cc-reverse-mcp-stream-public.log): ownedHttpGetPush passed,idleLogs/resources/postConcurrent/closeReader true,gets1. Earlier CLI/check logs retain pre-inspection checkpoint scope. Worker reported2/2 essential and48/48 related HTTP/logging/subscription checks via inline output only;no persisted worker logs or known durations,so none are fabricated. Counts overlap/remain independent,no new fullsuite/upstream claim.

Current combined tree final npm run check exited0,confirmed by completion and read of /private/tmp/cc-reverse-migration-current-check.log. This closes TypeScript verification after the implementation batches above;no additional fullsuite total is inferred. Subsequent changes in this documentation pass affect only the four ledgers. The verified private51-file package includes README;source stayed unchanged after build/install/demo checks,so documentation edits triggered no extra build. Owned demo temporary files were read/verified before cleanup.

Compiled packaging final: tsconfig.build.json emits src-only to dist;bin/personal-harness.mjs imports compiled CLI,package bin personal-harness/files bin+dist+README/private:true/engines>=22. Actual macOSNode26 npm run smoke:package exit0 (/private/tmp/cc-reverse-package-cli.log): temporary npm pack,offline --omit=dev --ignore-scripts install,installed bin --help/--demo,compiledCLI/offlineInstall/packagedDemo/devRuntimeAbsent/extractedSamplesExcluded true,51files,0 upstream requests. Packaged demo checks hello write/read,three scripted calls,pairing/locks and owned temporary cleanup. npm run check exit0 (/private/tmp/cc-reverse-package-check.log). Initial smoke only expected the wrong stdout phrase although demo itself passed;final assertion corrected. No publishing/global install/userGit/sample/session-data packaging;Node>=22 is declared,macOSNode26 is the actual observed runtime. Counts remain separate,no new fullsuite.

Nested rules final: listRules loads Markdown recursively through depth3 (root0),aggregate2048entries,deterministic pathsort and realpathseen loop dedup. Deeper directories or directorysymlink escapes raise ConfigError;existing filealias behavior remains. Watchmode rules follows same depth3/64handles/2048enumeration and refreshes on directoryrename,while loadedpaths/imports retain exact watches. Final70/70 passed,0 failed/cancelled/skipped,8965.706875ms (/private/tmp/cc-reverse-nested-rules-tests.log);npm run check exit0 (/private/tmp/cc-reverse-nested-rules-check.log). Actual expectPTY npm run smoke:config-watch-cli exit0 (/private/tmp/cc-reverse-nested-rules-cli.log),9 owned SSE requests with nestedRuleDiscovery and all previous watch/picker/lineage flags true,covering new nestedrule creation then update. Initial69/70 reflected an obsolete expectation that new nested rules stay ignored;updated notification and unrelated-import checks passed. Historical8-request checkpoints remain separate;no new fullsuite or upstream requests. Deeper discovery/unloadedimports/plugin-byte watch/managedpolicy remain gaps.

Final skill-agent routing: optional SkillInfo.agent/YAML agent requires context:fork and a name up to128; sessions pin it compatibly. resolveChildLaunch resolves builtins/general/explore/custom types before shell/journal effects. Authored typebody/model/effort/maxTurns/scope enter execution; explicit skillmodel/effort override,inherit keeps parent,toolscope is type∩parent∩skillgrant,maxTurns bounded. Typeisolation needs registry/owned worktree;foreground/background retain API contracts. Independent68/68 passed,0 failed/cancelled/skipped,3226.551625ms (/private/tmp/cc-reverse-skill-agent-tests.log);npm run check exit0 (/private/tmp/cc-reverse-skill-agent-check.log). Final actual npm run smoke:skill-agent-cli exit0 (/private/tmp/cc-reverse-skill-agent-cli.log),6 owned SSE requests across foreground/background/worktree invocations with typeModel/body/effort/toolIntersection/actualRead/background/worktree/cleanup/locks true and temporaryGit HEAD unchanged. Earlier2-request fixture is superseded;counts remain independent,no new fullsuite/upstream verification. Full originalinline/typealiases remain gaps.

Finite session picker: /resume[UUID|QUERY] opens UUID or searches title/model/id/parentUUID excluding current. Single match auto-opens,multiple matches show at most20. Full selectionPrompt header/choices/footer must fit maxOutputBytes; overflow asks for a narrower query,never truncates selectable entries. Number/:cancel shares terminal ownership; original same-gateway/locks/reconfigure/continue contracts remain. Final rerun after full-prompt budget correction: expectPTY npm run smoke:config-watch-cli exit0,8 owned SSE requests with sessionPicker/pickerCancellation and previous flags (/private/tmp/cc-reverse-session-picker-cli.log); npm run check exit0 (/private/tmp/cc-reverse-session-picker-check.log). No new mirrored tests/full suite; complete originalTUI remains a gap.

Child/skill callback propagation: trusted runtime registry reaches registry child lifecycle/continuation,legacy subagent and user/model foreground skills. Child async ownership and independent HookLifecycle/once remain; no JSON code import,persisted function or new flag. Final50/50,0 failed/cancelled/skipped,1989.057833ms (/private/tmp/cc-reverse-child-callback-tests.log) and npm run check exit0 (/private/tmp/cc-reverse-child-callback-check.log) passed. Final npm run smoke:child-callbacks exit0 (/private/tmp/cc-reverse-child-callback-smoke.log) exercises public runtime boundary rather than CLI: child,mailboxContinuationOnce,foregroundSkill,backgroundSkill,independentLifecycles,locksReleased true;4 owned scripted provider calls,three independent once callbacks. Fixture typing/mailbox argument errors were corrected before these final runs. No paid/upstream requests; totals remain separate from overlapping prior checks.

Subsequent session lineage: optional branch journal metadata contains direct-parent source UUID,workspace,source event-index boundary and reason fork/rewind/reload/configuration/relocation. It stays outside model messages. New branches append one direct relationship without copying ancestor branch records; grandparent metadata remains in parent logs and old logs stay compatible. listSessions outputs/searches parent UUID; history-only /rewind0 creates empty copied history without file restore. Relocation writes branch before its context marker,retaining completion turn_end as the tail.

Final lineage22/22 passed,0 failed/cancelled/skipped,1640.564ms (/private/tmp/cc-reverse-session-lineage-tests.log); npm run check exit0 (/private/tmp/cc-reverse-session-lineage-check.log). Actual npm run smoke:config-watch-cli exit0 (/private/tmp/cc-reverse-session-lineage-cli.log),8 owned SSE requests with watch/model/title/branchLineage flags; expect PTY asserted fork/rewind0/parent search. Initial2 legacy tail assertions failed before branch placement and expectation updates; final passing evidence supersedes that intermediate run. This new22 remains separate from prior session22 (1488.547583ms) and all overlapping totals; no new full suite.

Subsequent MCP logging: optional features.mcpLogging is pinned only when supplied (default absent/false), reload follows settings. Advertised logging enables mcp_logging_set_level and readOnly mcp_logging_notifications. Eight levels;128entries/32KiB queue,16KiB notification/data,4KiB metadata,1KiB logger,depth16/nodes2048; invalid/oversized/evicted logs increment dropped. Explicit acknowledgement sets server level; destructive local polling retains undelivered logs under small output caps and makes no server request. Stdio push and active HTTP POST SSE only; no GET/reconnect/replay/persistence/autoaction,close clears queue.

Final independent logging verification:2/2 essential regressions,0 failed/cancelled/skipped,366.575417ms (/private/tmp/cc-reverse-mcp-logging-tests.log); affected legacy82/82,0 failed/cancelled/skipped,4962.689625ms (/private/tmp/cc-reverse-mcp-logging-affected.log). npm run smoke:mcp-logging exit0 (/private/tmp/cc-reverse-mcp-logging-stdio.log),stdioPush/setLevel/inertJson/explicitPoll/closeClear true,dropped1. Actual HTTP npm run smoke:mcp-logging-cli exit0 (/private/tmp/cc-reverse-mcp-logging-cli.log),3 owned SSE requests with setLevel/activePostSseLog/explicitPoll/journalPinned/locks true. npm run check exit0 (/private/tmp/cc-reverse-mcp-logging-check.log). Earlier worker13/13 was an overlapping focused checkpoint,not a new suite total. No full suite or upstream verification added; prior948/156/40/22/52/37 records remain distinct.

Subsequent hook display batch: hook_result journals optional systemMessages/suppressOutput and reopens them. Control-cleaned status shares maxOutputBytes including generated prefix/suffix/usual CLI newline, tiny budgets suppress display; trusted consumer extra framing is excluded. Suppression preserves context/results and gates SessionEnd/Notification/TeammateIdle display; startup reaches stderr. Final37/37 passed,0 failed/cancelled/skipped,1394.564375ms (/private/tmp/cc-reverse-hook-display-tests.log); npm run check exit0 (/private/tmp/cc-reverse-hook-display-check.log). Actual npm run smoke:plugins exit0 (/private/tmp/cc-reverse-hook-display-cli.log),hookDisplaySuppressed/hookDisplayJournal/sessionEndDisplay true,ordered context retained,0 model/network calls. terminalSequence/full consumers remain gaps. Results supersede the pre-budget correction run and stay separate from156/40/22/52; no full suite was added.

2026-10-11 memory/configuration batch: pinned autoMemory/--auto-memory opt-in uses a normal-turn maintenance policy and fresh bounded memory data (<=16000 UTF-8 bytes, catalog and short bodies, exact SHA dedup, data authority). Permission ask/deny skips corresponding automatic reads; normal model tool writes keep existing permissions/hooks/hash checks. No separate extraction calls. dynamicInstructions defaults on for new CLI sessions and discovers accessed-path ancestor instructions/imports within 64 KiB, checking workspace/reserved paths and feeding pre-write retry. Old optional fields remain absent on old sessions.

/reload reads local sources, refreshes instructions/catalogs/hooks/MCP/LSP/features/plugins/memory and rebuilds runtime at completion, retaining provider/budgets and dropping signed thinking. Invalid config retains the old runtime. This historical memory/reload checkpoint predates watcher/keybinding hot reload; their later contracts and separate verification appear above. Original journals stay intact.

Actual CLI npm run smoke:memory-reload passed memory write/next-turn retrieval, A-B-A memory snapshot refresh, changed instructions/skills/tool-pool reload, nested pre-write instruction retry, failed-reload continuation and lock cleanup; 10 requests used owned loopback SSE. Reviewed fixes compare only the latest memory marker and reset removed settings to fresh defaults while preserving recorded CLI overrides. Four necessary new checks plus affected existing CLI/interactive/attachments/rewind checks: 19/19 pass, 0 fail/cancel, 1880.014583 ms; TypeScript passed. Logs /private/tmp/cc-reverse-memory-reload-cli.log, /private/tmp/cc-reverse-memory-reload-tests.log, /private/tmp/cc-reverse-memory-reload-check.log. No real upstream calls; autonomous memory fact selection/merge quality remains unverified. Full suite not rerun. OAuth excluded.

2026-10-11 unified rewind continuation: explicit /checkpoint NAME persists a checkpoint association in the session journal at the current completed-turn boundary (0 for initial history). /rewind N --files produces a bounded complete preview; --apply TOKEN compares recomputed file/checkpoint/history digests, stops owned background resources, restores ordinary files and commits a new session under the checkpoint lock. The original session journal is retained. File effects roll back if branch commit throws; partial branches are removed. Added ordinary files are explicitly shown and removed; directory/symlink changes are shown and preserved. Associations survive resume and ordinary fork with re-indexed boundaries. Original history-only /rewind remains available.

Actual CLI verification via npm run smoke:rewind passed: checkpoint, two coding turns, stale-preview preservation, fresh-preview apply, file restoration, added-file removal, branched model history, continued task and lock cleanup. Five requests used an owned loopback Messages SSE gateway. Three necessary new regressions cover combined success/reopen, stale file/history and post-write branch commit failure; existing affected checks included, 26/26 passed (1609.299042 ms). TypeScript passed. Logs: /private/tmp/cc-reverse-rewind-cli-smoke.log, /private/tmp/cc-reverse-rewind-tests.log, /private/tmp/cc-reverse-rewind-check.log. Full suite was not rerun. Runtime rollback is established; process-death/power-loss transaction recovery and automatic per-turn snapshots remain pending. No OAuth changes.

Near-term:

1. Run a small real-model coding task once the user chooses deployment and measurement budget; validate model availability, thinking/tool field support and context window.
2. Assess tool success, recovery accuracy, token usage and compaction quality on representative tasks.
3. Investigate further only the cross-chunk dependencies needed for the next feature; preserve exact module identities and distinguish static candidates from observed behavior.

Implementation limits to keep visible:

- File path checks are not an OS sandbox against concurrent hostile filesystem replacement or hard-link aliases.
- Shell cleanup covers its process group, not descendants that deliberately detach to another group/session.
- Journal content is not encrypted or automatically redacted; schemas are structural checks rather than a full Anthropic protocol validator.
- Public config/events objects are not deeply immutable; full write/fsync failure combinations are not exhaustively tested.
- Compaction model calls are excluded from displayed task modelCalls; an almost-full service window can make the summary request itself too large.
- edit_file reads the target text in memory; very large editable files need a future input-size policy.
- Local media/LSP/web/memory/checkpoints/worktrees/agents/mailboxes/Workflow and MCP have runtime paths. Full TUI/headless, original type/fork/isolation, script Workflow, marketplace/publishing/full plugin semantics, model memory quality, automatic rewind snapshots/crash recovery, MCP tasks/reconnect/sampling extensions, image resize and Windows clipboard remain gaps. Historical 759/879 checks apply to their recorded source checkpoints; hosted connectors/remote features require actual backends.
- Background/scheduler/agent registries are ephemeral. Workflow execution stays process-local with explicit owner snapshots. Clear/fork cancels old resources; child tools exclude parent controls. Optional cron jitter has the subsequent independent contract above; original timing equivalence and persistence remain gaps. Events enter between turns; one-shot exit closes jobs/skills.
- Hooks retain finite independent event paths;newCLI Stop/SubagentStop has durable default8 continuation guard above,old absent journals keep legacy maxTurns. Batch/lifecycle/SessionEnd payloads and full consumers differ. Original JavaScript script semantics,physical once removal/skill teardown and full consumer equivalence remain incomplete. See HOOKS.md.
- Skills use bounded YAML/permissions and independent grant/hook child execution;contextfork routing and terminal forwarding have the finite contracts above. /reload refreshes catalogs/conditional snapshots/keys;bounded watchers track loaded/unselected pinned imports,verified plugin bytes and explicit managed file. Full originalinline/typealiases,deeper/dynamic-new import discovery,OS managed discovery and remote signed policy remain gaps.
- SessionStart context on --continue follows recovered results; configuration/instruction/skill/memory/agent bytes share 8 MiB. MCP stdio keeps 2024-11-05 (form as opt-in extension), HTTP negotiates modern versions. Explicit roots/base sampling, interactive forms/hooks and bounded subscriptions have the contracts above. Tasks/reconnect, sampling tools/media and URL elicitation remain gaps; OAuth remains Excluded.
- Hosted remote/cloud peers, routines/runners, artifacts/design/projects/connectors/files/push require real providers. No local implementation or fixture is claimed to supply those backends.
- A full REA JavaScript application graph request timed out after 1,840 seconds without returning Evidence. Focused source inventories remain available; no whole-application graph/equivalence claim is made.

No git repository, commit or PR was created. The original executable and historical extraction remain unchanged.

## Automatic main-session checkpoint continuation (2026-10-11)

The opt-in `automaticCheckpoints` setting captures initial/completed main-session boundaries before a new task prompt and after `turn_end`; aborted completion skips the final capture. Persisted explicit or automatic associations deduplicate the same boundary across resume. Child sessions and unfinished tool turns skip capture. A session permits at most 128 automatic associations; existing 2 MiB/file, 32 MiB/snapshot and 2000-entry limits apply. Errors report through status while preserving the task result. This supersedes the historical explicit-only gap for this finite main-session contract. Workspace-wide retention/GC, capture-before-association crash recovery and restore power-loss transactions remain open.

Actual source and compiled CLI drivers each passed automatic capture without `/checkpoint`, two write turns, stale preview preservation, file/history rewind, removal of a new file, continued task, journal resume and lock release; each made 5 requests to an owned loopback Messages SSE gateway. Logs: `/private/tmp/cc-reverse-auto-checkpoint-cli.log` and `/private/tmp/cc-reverse-auto-checkpoint-compiled-cli.log`. Necessary rewind/checkpoint/lifecycle regressions passed 45/45, zero failures, 2121.791333 ms (`/private/tmp/cc-reverse-auto-checkpoint-tests.log`), including one added boundary deduplication/resume/child-exclusion case. Build and final typecheck exited 0 (`/private/tmp/cc-reverse-auto-checkpoint-build.log`, `/private/tmp/cc-reverse-auto-checkpoint-final-check.log`). No full suite or paid upstream calls were run for this continuation.

Current private package smoke also exited 0 (`/private/tmp/cc-reverse-auto-checkpoint-package.log`): 52 files, compiled installed launcher help/demo, offline production installation, absent dev runtime and excluded extracted samples; upstream requests 0. No publish or global install occurred. Runtime observations remain macOS/Node26; Node >=22 is the declared package engine range.

## Indexed skill argument continuation (2026-10-11)

Static evidence was reused from FEATURES.md and inert `extracted-v2/modules/chunk-sfn1dbxq.js` helper `uHe`: numeric `$ARGUMENTS[n]` selects a zero-based argument before plain raw arguments. The independent shared `expandSkill` now matches indexed/raw/legacy forms in one pass, preserves missing indexed tokens and leaves inserted argument text unscanned. Existing whitespace tokenization and one-based `$1`..`$9` remain; shell quote parsing is a separate gap. This changes expansion for existing pinned skill bodies when resumed under the new binary.

Source actual CLI passed all three previous child routing paths plus main inline and model-issued `skill`, verifying zero-based indices, missing-token preservation, literal `$1`, current quote-as-character behavior, actual file reads, worktree cleanup and released locks; 9 owned loopback SSE requests (`/private/tmp/cc-reverse-skill-index-cli.log`). Only the existing expansion regression was extended; configuration checks passed 67/67, zero failures, 2094.286875 ms (`/private/tmp/cc-reverse-skill-index-tests.log`). Typecheck/build exited 0 (`/private/tmp/cc-reverse-skill-index-check.log`, `/private/tmp/cc-reverse-skill-index-build.log`). The previous 6-request skill routing driver remains historical; no full suite or paid upstream calls were run.

Compiled actual CLI passed the same indexed argument and five-route driver, 9 owned local requests (`/private/tmp/cc-reverse-skill-index-compiled-cli.log`). Both implementations preserved temporary Git HEAD and released checkout/session locks. Further static tracing reports original parser-backed quote grouping with whitespace fallback, protected missing-index tokens and an appended `ARGUMENTS:` suffix when no replacement succeeds; only indexed selection/preservation was migrated here. Existing missing legacy positions remain empty and automatic argument appending remains pending.

## Explicit authored inline skill commands (2026-10-11)

Optional `features.skillInlineCommands` is parsed, stored and accepted by managed feature policy. CLI only writes an authored value; reload spreads the settings into its normal feature reconstruction. Authored `!`-backtick directives without shell/command metadata now enter `expandedBody` through runtime-aware main, interactive and model-tool dispatch. Absent/false retains old literal behavior; existing explicit metadata still executes under its prior contract. Whole-group permission/grant preflight runs before any shell effect, default /bin/sh and existing deadline/output limits apply, and substituted arguments/output never introduce a second directive pass. Shell effects still lack an independent durable effect journal; crash recovery and full original shell parsing remain open.

Only one existing opt-in regression was extended. Skill lifecycle checks passed 27/27, zero failures, 1778.694917 ms (`/private/tmp/cc-reverse-skill-inline-tests.log`). Existing reload/runtime/session storage checks passed 36/36, zero failures, 991.237917 ms (`/private/tmp/cc-reverse-skill-inline-consumers.log`); counts overlap other checkpoints and remain separate. Typecheck/build exited 0 (`/private/tmp/cc-reverse-skill-inline-check.log`, `/private/tmp/cc-reverse-skill-inline-build.log`). Actual CLI verification initially passed an invalid --user-dir resume override, then expected error exit1 where the existing headless runtime returns2; only the driver was corrected. Final interactive driver results are recorded below. No paid upstream calls or recovered-code execution occurred.

Final source and compiled actual inline-command drivers each passed 8 owned loopback SSE requests, including interactive input, metadata-free expansion, model-issued skill calls, pinned resume after disk setting changes, disabled literal behavior, shell gate, whole-group denial before marker creation, literal injected directives and managed override. Logs: `/private/tmp/cc-reverse-skill-inline-cli.log`, `/private/tmp/cc-reverse-skill-inline-compiled-cli.log`. The interactive extension initially supplied an empty positional task; removing that driver argument matched the CLI contract. Final private package smoke passed 52 files, installed compiled help/demo, offline production installation, dev-runtime absence and excluded extraction data; upstream requests0 (`/private/tmp/cc-reverse-skill-inline-package.log`). Earlier7-request results are superseded by the8-request interactive extension.

## Quote-aware skill argument continuation (2026-10-11)

Optional pinned/managed `features.skillQuotedArguments` now selects a linear text tokenizer for single/double quote groups, adjacent segments, empty quoted arguments and escape processing. Incomplete quotes/trailing escapes fall back to the prior whitespace path. The original static helpers used a shell parser with whitespace fallback; this independent finite text contract does not claim full AST equivalence. Raw `$ARGUMENTS` remains byte-preserved and replacement text is unscanned. CLI inline, child foreground/background/worktree, model tool and authored command preflight/execution all receive the same setting. Absent/false preserves old splitting.

Source and compiled actual five-route drivers passed9 owned loopback SSE requests each (`/private/tmp/cc-reverse-skill-quoted-cli.log`, `/private/tmp/cc-reverse-skill-quoted-compiled-cli.log`). Compiled absent-flag driver independently passed9 requests (`/private/tmp/cc-reverse-skill-quoted-legacy-cli.log`). Only the existing shared expansion regression was extended; config/skill/reload checks passed96/96, zero failures,2626.337625ms (`/private/tmp/cc-reverse-skill-quoted-tests.log`). Typecheck/build exited0 (`/private/tmp/cc-reverse-skill-quoted-check.log`, `/private/tmp/cc-reverse-skill-quoted-build.log`). Counts overlap earlier checks; no new full suite or paid upstream run.

Compiled authored inline-command driver with quoted arguments also passed8 owned requests, including pinned resume, interactive input and managed override (`/private/tmp/cc-reverse-skill-quoted-inline-cli.log`). Final private package check passed52 files, installed compiled launcher help/demo, offline production installation, dev-runtime absence and excluded extraction samples; upstream requests0 (`/private/tmp/cc-reverse-skill-quoted-package.log`). Final source change after the typecheck/build was comment relocation only; runtime bytes were already validated.

## Automatic snapshot association retry (2026-10-11)

Automatic names now combine the session UUID with a20-hex-character random suffix, staying within the64-character manifest limit. A capture can survive a failed association append; a subsequent attempt captures current files under a fresh name rather than permanently colliding with the previous count-based name or binding its stale contents. Orphan manifests are preserved. This resolves retry poisoning, not an atomic file/journal transaction or global orphan GC.

One existing automatic regression was extended with an injected association failure, changed workspace, reopened journal and a fresh successful capture while verifying orphan byte preservation. Existing rewind/checkpoint checks passed21/21, zero failures,1277.860917ms (`/private/tmp/cc-reverse-auto-retry-tests.log`). Actual source and compiled CLI with a valid old-count-name collision passed5 owned loopback requests each; both previewed the second boundary, preserved the old manifest and completed joint rewind/continued task/resume/lock release (`/private/tmp/cc-reverse-auto-retry-cli.log`, `/private/tmp/cc-reverse-auto-retry-compiled-cli.log`). Typecheck/build exited0 (`/private/tmp/cc-reverse-auto-retry-check.log`, `/private/tmp/cc-reverse-auto-retry-build.log`). Current private package smoke passed52 files and all existing offline/install/compiled help/demo/exclusion flags; upstream0 (`/private/tmp/cc-reverse-auto-retry-package.log`). No new full suite, publish or paid upstream calls.

## Unused skill argument fallback (2026-10-11)

The inert original uHe helper was read in a bounded excerpt: its default argument fallback appends ARGUMENTS when no substitution succeeded and input is nonempty. Optional pinned/managed `features.skillArgumentFallback` now provides that finite local behavior. Indexed missing positions remain literal; raw or present positional replacements mark consumption, including an empty quoted argument. Existing one-based missing positions retain their empty local behavior. Default absent/false remains unchanged. Inline execution calculates the fallback once from the original body and appends only its suffix to final instructions; commands and each prose segment use expansion without fallback, preventing suffix duplication or extra shell text. Empty skill bodies retain the prior empty return. Original named parameter/escape-marker/legacy numeric forms remain gaps.

Source and compiled five-route actual CLI each passed9 owned loopback SSE requests (`/private/tmp/cc-reverse-skill-fallback-cli.log`, `/private/tmp/cc-reverse-skill-fallback-compiled-cli.log`), including unchanged missing indices plus raw argument suffix across main/foreground/background/worktree/model invocation. Existing shared expansion and inline-output regression cases were extended; config/skill checks passed94/94, zero failures,2451.247625ms (`/private/tmp/cc-reverse-skill-fallback-tests.log`). Typecheck/build exited0 (`/private/tmp/cc-reverse-skill-fallback-check.log`, `/private/tmp/cc-reverse-skill-fallback-build.log`). Counts are independent of earlier overlapping groups; no new full suite or paid upstream requests.

Compiled inline fallback actual CLI passed9 owned requests, including a literal `; touch fallback-marker` suffix in final instructions while the marker remained absent, plus existing interactive/resume/managed/model checks (`/private/tmp/cc-reverse-skill-fallback-inline-cli.log`). Final private package passed52 files, offline installation, compiled installed help/demo, absent development runtime and excluded extracted samples; upstream0 (`/private/tmp/cc-reverse-skill-fallback-package.log`). No publication or global installation occurred.

## Extended numeric and escaped skill arguments (2026-10-11)

Original inert uHe evidence already showed zero-based numeric forms and a protected escaped-dollar pass. Optional pinned/managed `features.skillExtendedArguments` now provides zero-based $0/$1/multi-digit forms, preserved absent positions and single-backslash ARGUMENTS/numeric escape protection. Local substitution remains single-pass without inserted-text rescanning. Absent/false retains one-based $1..$9. Independent quote grouping, raw arguments, unused-argument fallback and inline-command expansion compose through the shared helper. Named parameters, exact original parser and all original escape forms remain incomplete.

Actual source and compiled five-route CLI passed9 owned loopback SSE requests each (`/private/tmp/cc-reverse-skill-extended-cli.log`, `/private/tmp/cc-reverse-skill-extended-compiled-cli.log`); compiled legacy mode separately passed9 (`/private/tmp/cc-reverse-skill-extended-legacy-cli.log`). Only the existing argument regression was extended; config/skill checks passed94/94, zero failures,2513.580209ms (`/private/tmp/cc-reverse-skill-extended-tests.log`). Typecheck/build exited0 (`/private/tmp/cc-reverse-skill-extended-check.log`, `/private/tmp/cc-reverse-skill-extended-build.log`). These groups overlap earlier checks; no new full suite or paid upstream calls.

Compiled extended/quoted inline CLI passed8 owned requests, including authored numeric command expansion, escaped prose, interactive/model invocation, pinned resume and managed override (`/private/tmp/cc-reverse-skill-extended-inline-cli.log`). Final private package check passed52 files, installed compiled help/demo, offline production installation, dev-runtime absence and excluded extracted samples; upstream0 (`/private/tmp/cc-reverse-skill-extended-package.log`). No publish/global install occurred.

## Named skill argument continuation (2026-10-11)

Bounded inert original excerpts established frontmatter `arguments` -> $oe -> argumentNames, passed to uHe in declaration order. Local loading now accepts a whitespace string or array of at most128 unique ASCII identifiers up to128 chars, stores optional `argumentNames` in session schema and applies longest-first named substitution with word/bracket boundary guards and single-backslash literal protection. Missing named positions become empty as in the recovered helper. Replacement values stay unscanned. Names reach plain/user/model/child/inline execution and preflight context budgets. Original permissive filtering, duplicate/nonidentifier behavior and source aliases remain separate gaps.

Source and compiled five-route CLI each passed9 local SSE requests (`/private/tmp/cc-reverse-skill-named-cli.log`, `/private/tmp/cc-reverse-skill-named-compiled-cli.log`), verifying longest names, protected suffixes/escapes, quote grouping and actual tool routing. Final config/skill regression group passed94/94, zero failures,2540.520584ms (`/private/tmp/cc-reverse-skill-named-final-tests.log`), including extended existing malformed-field/expansion cases; initial94/94,2492.687291ms predates budget-name propagation and added malformed headers. Final typecheck/build exited0 (`/private/tmp/cc-reverse-skill-named-final-check.log`, `/private/tmp/cc-reverse-skill-named-final-build.log`). Source inline/interactive/resume/model/managed driver passed8 local requests (`/private/tmp/cc-reverse-skill-named-inline-cli.log`). All counts stay independent, no new full suite or paid upstream calls.

Compiled named inline/interactive/resume/model/managed CLI passed8 owned requests (`/private/tmp/cc-reverse-skill-named-inline-compiled-cli.log`). Final private package smoke passed52 files, installed compiled help/demo, offline production installation, absent dev runtime and excluded extracted samples; upstream0 (`/private/tmp/cc-reverse-skill-named-package.log`). No publication/global installation occurred.

## Authored skill aliases and namespaced slash (2026-10-11)

Original inert excerpts showed alias-bearing command catalogs and full colon names; independent authored `aliases` is a local design contract, not proof that original YAML accepts that same field. The loader/session pin up to32 unique ASCII slash names of at most128chars each; self aliases drop. Exact names win, unique aliases resolve, ambiguity yields a full-name diagnostic. Slash accepts nonempty colon-separated segments, enabling namespaced user invocations. Model skill lookup shares resolution; skill eligibility checks remain on the selected definition. System skill catalog and interactive /skills now display aliases. Built-in interactive commands retain precedence, and automatic plugin namespace/display alias derivation remains pending.

Source/compiled actual five-route drivers each passed9 owned requests (`/private/tmp/cc-reverse-skill-alias-cli.log`, `/private/tmp/cc-reverse-skill-alias-compiled-cli.log`). Source/compiled interactive alias/catalog/inline/model/resume/managed drivers each passed8 (`/private/tmp/cc-reverse-skill-alias-interactive-cli.log`, `/private/tmp/cc-reverse-skill-alias-interactive-compiled-cli.log`). Existing config/runtime regressions passed84/84, zero failures,2133.701292ms (`/private/tmp/cc-reverse-skill-alias-tests.log`), before display-only additions; final typecheck/build exited0 (`/private/tmp/cc-reverse-skill-alias-final-check.log`, `/private/tmp/cc-reverse-skill-alias-final-build.log`). Private package passed52 files and all installed compiled help/demo/offline/dev-exclusion/sample-exclusion flags; upstream0 (`/private/tmp/cc-reverse-skill-alias-package.log`). No new full suite or paid upstream calls/publication.

## Installed plugin skill namespaces (2026-10-11)

Optional pinned/managed `features.pluginSkillNamespaces` is applied by config loading after effective policy merge: verified installed plugin skills become PLUGIN:NAME, with the previous short name added to bounded aliases. Project/user exact names and explicit pluginDirs retain their own names; full-name conflicts follow existing first-source precedence. Multiple installed same-name skills now survive the catalog; short-name ambiguity yields an error before any model call. Names/aliases/body stay fixed in resumed session config. Absent/false retains old discovery, keeping prior plugin snapshots compatible. This is an independent finite namespace contract; full original source/builtin/synced collision semantics remain incomplete.

Source and compiled actual drivers installed two inert plugins with the same indexed skill, exercised both full names alongside a project exact short name, then removed that project name and verified ambiguity without further model requests. Each passed11 owned loopback requests (`/private/tmp/cc-reverse-plugin-namespace-final-cli.log`, `/private/tmp/cc-reverse-plugin-namespace-compiled-cli.log`). Earlier source11-request log predates added ambiguity check. Existing config/runtime regressions passed84/84, zero failures,2244.024791ms (`/private/tmp/cc-reverse-plugin-namespace-tests.log`), with one existing installed-precedence case extended. Typecheck/build exited0 (`/private/tmp/cc-reverse-plugin-namespace-check.log`, `/private/tmp/cc-reverse-plugin-namespace-build.log`). Default compiled plugin/hook/MCP/watch driver passed0 model/network calls (`/private/tmp/cc-reverse-plugin-namespace-legacy-cli.log`). Private package passed52 files and all offline/compiled/help/demo/exclusion flags, upstream0 (`/private/tmp/cc-reverse-plugin-namespace-package.log`). No full suite, paid upstream or publication.

## Custom agent type aliases and schema-cycle fix (2026-10-11)

Independent agent YAML accepts whitespace-string/array aliases, up to32 unique names128chars each, following existing type-name syntax and reserving fork/explore/general. Typed catalogs pin aliases; resolveChildLaunch prefers exact types, then unique aliases, and rejects ambiguous aliases. Skill agent routing and model-issued subagent_type share this lookup. CLI/reload system catalogs and /agents show aliases. This is a local authored contract; full original builtin/provider/remote alias semantics remain gaps.

The first isolated agent-types import failed with ReferenceError Cannot access agentTypesSchema before initialization through agent-types -> config -> session -> agent-types. Session schema now uses z.lazy for that catalog, retaining deferred validation and breaking initialization-time access. Final existing agent-types/subagents/skill regression group passed43/43, zero failures,1974.1265ms (`/private/tmp/cc-reverse-agent-alias-final-tests.log`); initial29/30 pass/failure remains in `/private/tmp/cc-reverse-agent-alias-tests.log`. Final check/build exited0 (`/private/tmp/cc-reverse-agent-alias-final-check.log`, `/private/tmp/cc-reverse-agent-alias-final-build.log`). Only existing alias load/invalid/launch cases were extended.

Actual source/compiled drivers passed12 owned local SSE requests each (`/private/tmp/cc-reverse-agent-alias-model-cli.log`, `/private/tmp/cc-reverse-agent-alias-model-compiled-cli.log`), covering foreground/background/worktree skill aliases plus model Agent alias with expected child model/body/effort/scope and lock/checkout cleanup. Earlier9-request runs lacked model Agent exercise and remain historical. Current private package passed52 files, installed compiled help/demo, offline production installation, dev-runtime absence and sample exclusion; upstream0 (`/private/tmp/cc-reverse-agent-alias-package.log`). No full suite, paid upstream or publication.

## Combined practical skill verification (2026-10-11)

After the above source changes, the compiled installed-plugin namespace + named/quoted arguments + custom agent-alias driver passed14 owned local SSE requests (`/private/tmp/cc-reverse-skill-combined-cli.log`). It exercised foreground/background/worktree skill routing, model skill and Agent calls, retained two installed same-name skills, preserved project exact-name precedence and diagnosed short-name ambiguity without an extra call. The compiled inline-command + authored aliases + named/quoted args + unused fallback driver independently passed9 (`/private/tmp/cc-reverse-skill-combined-inline-cli.log`), including interactive catalog/invocation, pinned resume, managed override, whole-group preflight and fallback outside shell execution. Counts remain separate and overlap earlier checks. Latest production source build and private package evidence remain the agent-alias final build/package; only the test driver request-count assertion and documentation changed afterward. OAuth remains excluded and model requests remain owned local fixtures.

## Same-workspace child instruction watching (2026-10-11)

ChildHookOptions/skill options now forward Agent instructionFiles callbacks from legacy children, registry launch/resume and foreground fork skills; background/isolated skill uses registry callbacks. Runtime captures the parent owner generation and accepts only watch-enabled identical-workspace discoveries. Deduplicated pending paths are bounded2048/65536 raw UTF8 bytes,4096 each; released/closed generations drop late callbacks and different worktree roots skip forwarding. Cached tools preserve callback identity. Completed-boundary `instruction_paths` events only update the watcher and never enter model prompts or trigger model turns. No durable path catalog is added, and headless does not bind a watcher.

Actual source and compiled watcher/PTY drivers passed23 owned local SSE requests each, including a child-only deep AGENTS/import read, import edit -> parent reload, child re-read of updated content, previous main dynamic paths, nested rules, failed-config retention, model/title/lineage, keybindings and session picker (`/private/tmp/cc-reverse-child-watch-cli.log`, `/private/tmp/cc-reverse-child-watch-compiled-cli.log`). Source log predates the added result childImportWatch label but includes its assertions; compiled log includes it. One necessary owner/dedup regression was added. Final runtime/resources/events/registry group passed63/63, zero failures,2413.429375ms (`/private/tmp/cc-reverse-child-watch-final-tests.log`); the first new-case run failed because its config carried an empty pinned tool list, corrected to actual runtime schemas. Initial62/62 predates that case. Final typecheck/build exited0 (`/private/tmp/cc-reverse-child-watch-complete-check.log`, `/private/tmp/cc-reverse-child-watch-final-build.log`). Current private package passed52 files/all offline installed compiled help/demo/exclusion flags, upstream0 (`/private/tmp/cc-reverse-child-watch-package.log`). No new full suite/paid upstream/publication.

## Durable discovered instruction watch paths (2026-10-11)

New optional `instruction_watch` journal records hold workspace identity and absolute discovered paths, max2048 entries,4096bytes/path and65536 serialized path-array bytes. Main/child discoveries deduplicate the live catalog, append before watcher registration, and restore matching-workspace records during bind/resume. Reload/configuration/fork/history rewind copy relevant records; file+history rewind copies records within its history boundary. Records stay outside model messages/context digests and never execute content. Existing logs without the event retain old behavior. The interactive producer caps cumulative live paths; per-record journal validation and restore bounds apply. Isolated worktree child paths, newly created/unvisited files and exhaustive recursive discovery remain gaps.

Source/compiled actual watcher+PTY+restart drivers passed28 owned local SSE requests each (`/private/tmp/cc-reverse-watch-persist-cli.log`, `/private/tmp/cc-reverse-watch-persist-compiled-cli.log`). After CLI exit, resume of a journal carrying child-only discovered import paths detected a file edit and reloaded without a fresh discovery task; subsequent child read observed updated content. Existing session-storage/rewind/interactive checks passed27/27, zero failures,1717.867958ms (`/private/tmp/cc-reverse-watch-persist-tests.log`), with one existing journal round-trip case extended to assert metadata preservation, relative-path rejection and unchanged messages. Typecheck/build exited0 (`/private/tmp/cc-reverse-watch-persist-check.log`, `/private/tmp/cc-reverse-watch-persist-build.log`). Private package passed52 files/all installed compiled help/demo/offline/dev-exclusion/sample-exclusion flags, upstream0 (`/private/tmp/cc-reverse-watch-persist-package.log`). No full suite, paid upstream or publication.

## New instructions in registered workspace directories (2026-10-11)

ConfigWatcher adds a filtered instructions scope to each registered workspace-local instruction/import parent. Only HARNESS.md/AGENTS.md names trigger changes; unrelated siblings stay ignored, external imports remain exact-file scopes, and existing watcher/entry/depth/confinement bounds apply. A restored durable path registration re-creates that scope, so a newly created sibling instruction is detected without another tool discovery. Completely unregistered directories and isolated child worktrees remain outside this finite contract.

Source/compiled actual watcher+PTY+restart driver passed33 owned local SSE requests each (`/private/tmp/cc-reverse-new-instruction-cli.log`, `/private/tmp/cc-reverse-new-instruction-compiled-cli.log`). After resuming child-only discovered paths, creating HARNESS.md caused reload; a following child read saw the new instruction. Existing watcher cases passed2/2, zero failures,10346.1405ms (`/private/tmp/cc-reverse-new-instruction-tests.log`), with only the existing dynamic case extended. Typecheck/build exited0 (`/private/tmp/cc-reverse-new-instruction-check.log`, `/private/tmp/cc-reverse-new-instruction-build.log`). Private package passed52 files/all offline installed compiled help/demo/exclusion flags, upstream0 (`/private/tmp/cc-reverse-new-instruction-package.log`). No full suite, paid upstream or publication.

## Absent instruction candidates in visited directories (2026-10-11)

loadPathInstructions now accepts an optional candidate observer. After successful bounded discovery it reports canonical HARNESS.md/AGENTS.md paths in each visited legal ancestor, even when absent. Agent reports the union of candidates and actual files/imports once. Existing main and same-workspace child path queues, durable instruction_watch registration, completion-boundary reload and restored watcher scopes apply. Candidates are metadata only; actual instruction content still requires a file read. Reserved directories, realpath confinement, ancestor/import depth and text budgets remain; watcher64 handles/2048 entries and live catalog2048 paths/64KiB remain. Unvisited directories and isolated child worktrees stay unresolved.

Actual source CLI passed43 owned loopback SSE requests (/private/tmp/cc-reverse-empty-instruction-cli.log). Compiled CLI independently passed43 with compiledCLI and emptyDirectoryDiscovery true (/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/empty-instruction-compiled-cli.log). Both exercised existing watcher/PTY/restart/picker flows plus first read of empty/deep/file.txt, later AGENTS.md creation, automatic reload and subsequent child observation of its content. Existing config/runtime-resources checks passed77/77, zero failures,2260.117375ms (/private/tmp/cc-reverse-empty-instruction-tests.log); only the existing owner/dedup expectation gained the absent candidate. Typecheck/build exited0 (/private/tmp/cc-reverse-empty-instruction-check.log,/private/tmp/cc-reverse-empty-instruction-build.log). Current private package passed52 files, compiled installed help/demo, offline install, development/sample exclusions and upstreamRequests0 (/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/empty-instruction-package.log). No new full suite, paid upstream or publication. Job temporary logs last until job cleanup; exact results are retained here.

## PostCompact bounded display consumer (2026-10-11)

Agent.hook now displays PostCompact additionalContext through the same suppression, control cleanup and shared UTF8 maxOutputBytes budget as systemMessages. Prefix, truncation suffix and usual newline count toward that budget. compact() no longer emits a second raw context loop. Original hook_result values, committed compact epoch and independent terminalSequence delivery retain their existing contracts.

Source and compiled actual Expect PTY drivers each passed9 owned loopback SSE calls across visible, hidden and96-byte modes, confirming combined budget, control cleanup, intact UTF8, retained journal text, independent terminal delivery and exclusion from the next model request (/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/post-compact-cli.log,/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/post-compact-compiled-cli.log). One existing manual-compaction case was expanded; selected regression passed1/1, zero failures,687.913334ms (/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/post-compact-tests.log). Typecheck/build exited0 (post-compact-check.log,post-compact-build.log in the same job tmp directory). Current private offline package passed52 files, installed compiled help/demo, exclusions and upstreamRequests0 (post-compact-package.log). No full suite/paid upstream/publication; exact results retained here after temporary log cleanup. Notification/TeammateIdle context already honors suppression but still has a separate raw display path to migrate.

## Notification and TeammateIdle bounded display (2026-10-11)

Agent.hook now includes Notification and TeammateIdle additionalContext in its shared systemMessages display budget, with suppressOutput, control cleanup, intact UTF8 truncation and prefix/suffix/newline accounting. Interactive removes the prior raw output loops. Idle blocked/stopRequested gating is unchanged; raw hook_result content remains journaled, and event display context stays outside model messages. This supersedes the separate raw display path noted in the PostCompact checkpoint above.

Final actual source/compiled Expect PTY each passed21 owned loopback SSE calls (/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/event-display-cli.log,/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/event-display-compiled-cli.log). Child launch, message continuation and notify_when_idle exercised Notification plus TeammateIdle in visible/hidden/96-byte modes; shared budget, control cleanup, UTF8, raw journal preservation and released locks passed. The blocked idle prompt never appeared in any model request. One necessary notification/idle case was added beside the expanded compaction case; selected checks passed2/2, zero failures,1009.093583ms (event-display-tests.log in the same job tmp directory). Typecheck/build exited0 (event-display-check.log,event-display-build.log). Current private package passed52 files, installed compiled help/demo, offline install/exclusions and upstreamRequests0 (event-display-package.log); this package run preceded documentation-only edits. No new full suite/paid upstream/publication. Temporary logs expire with job cleanup; exact outcomes are retained here. Full original display/raw userDisplayMessage, physical once removal and script semantics remain partial.

## Plain PostCompact stdout display (2026-10-11)

Static inert source inspection reconfirmed avt at chunk-sfn1dbxq.js near byte2932807: the original builds command-labeled success/failure userDisplayMessage strings from raw output, including empty success outcomes. Module SHA256 matches the retained manifest identity4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da. No recovered code was executed. Independent runHooks now appends trimmed successful, complete non-JSON command stdout to PostCompact additionalContext. JSON objects retain the existing structured protocol; original raw JSON formatting, command outcome labels and empty success messages remain differences. Text uses the unified bounded display consumer, remains in hook_result and stays outside the committed summary epoch.

Final source/compiled actual Expect PTY each passed12 owned loopback SSE calls, adding plain output with control bytes and multibyte text to the preceding visible/hidden/96-byte modes (/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/raw-post-compact-cli.log,/Users/mant1ssa/.claude/jobs/e5a509ce/tmp/raw-post-compact-compiled-cli.log). rawPostCompact/sharedDisplayBudget/controlCleanup/utf8Intact/journalPreserved/modelHistoryClean/locksReleased flags passed; plain text has no fabricated terminalSequence. Existing hooks/compaction cases were extended, with the earlier notification regression retained; selected3/3 passed, zero failures,1009.972792ms (raw-post-compact-tests.log in the same directory). Typecheck/build exited0 (raw-post-compact-check.log,raw-post-compact-build.log). Final private offline package passed52 files, installed compiled help/demo, development/sample exclusions and upstreamRequests0 (raw-post-compact-package.log), after README/HOOKS updates and before final research-only ledger edits. No full suite/paid upstream/publication. Exact outcomes are retained here after job log cleanup. Overall migration remains Partial; OAuth stays Excluded.

## MCP connection lifecycle migration (2026-10-11)

Source-first subsystem policy: port recovered implementations where practical, replace necessary host interfaces, preserve neutral product names/prompts/output, and keep provenance in research. Avoid broad re-analysis and repeated verification; validate complete usage chains with a few necessary regressions.

Static original reconnection chain: chunk-24k7d6mw.js RTe/Nn at1583734 handles manual per-server shared attempts; chunk-q74be6rg.js control mcp_reconnect at23587/25435/25993. chunk-sb190ksj.js Jo/rh at152901/152764 clears cache, connects and discovers; Tn/qt/Yc at116849/117070/117277 dispose replaced and late connections. chunk-8sj9gbsq.js UMo/de at8755/10045 owns headless recovery and _fe at3225 validates result ownership. Original remote fast retries are5 attempts,immediate then1/2/4/8s;headless additionally has8 slow rounds, startup and next-turn policies differ. Static consecutive transport error threshold3 and session-expiry recovery were observed. These are inert source findings under the retained artifact/index identity; no sample execution. Exact slow phases, SDK stream retry and persistent discovery remain separate.

ManagedMcpClient now owns stable adapter closures, transport generation/state, deduplicated replacement, cancellation and retry timers. Stdio failures mark disconnected;HTTP session404 or3 consecutive fetch/500/502/503/504 errors trigger fast recovery. Replacement prepares initialize/tools-list and validates aggregate bounds/collisions before commit;failure retains old client. This deliberate prepare-before-close adaptation differs from original clear-before-dial. Manual reconnect cancels pending automatic timers;close aborts active preparation and disposes its late candidate. Automatic retries stop on auth/protocol/nonretryable failure and never replay tools. Other server connections and runtime registries remain intact. Replacement resets that transport subscriptions/logging;replay/re-subscribe is absent. Dynamic catalogs observe replacement, while published schema/readOnly guards validate the current inventory at the call submission point. CLI /mcp-reconnect SERVER and permission-gated model mcp_reconnect share the manager; /mcp exposes state/generation/attempts. Existing no-argument whole-runtime reconfigure remains available.

Source scoped actualCLI passed14 owned loopback SSE requests (mcp-lifecycle-cli.log), compiled independently14 (mcp-lifecycle-compiled-cli.log), under /Users/mant1ssa/.claude/jobs/e5a509ce/tmp/. Two configured servers verified failed replacement, retained peer, same journal, model reconnect, expired session, automatic retry/recovery, changed-schema guard, one-time call effects and lock cleanup. Original whole reconnect sourceCLI separately passed4 requests (mcp-lifecycle-all-cli.log). Transport/catalog/subscription/logging checks passed80/80,zero failures,5500.387625ms (mcp-lifecycle-existing-tests.log);one essential concurrent replacement regression and the existing stdio-crash case were extended. Initial79-check run had3 failures because closed state used the disconnected error text; implementation now distinguishes closed/disconnected, tests unchanged. Final typecheck/build exited0 (mcp-lifecycle-check.log,mcp-lifecycle-build.log). Consumer/package final outcomes follow below. No paid upstream/OAuth/publication. Temporary logs expire with job cleanup; recorded results remain here.

Final lifecycle consumers passed23/23,zero failures,921.314625ms (mcp-lifecycle-consumers.log in the same job tmp directory). Private offline package passed52 files,installed compiled help/demo,devRuntimeAbsent/extractedSamplesExcluded and upstreamRequests0 (mcp-lifecycle-package.log). Product src/bin/README scan returned zero case-insensitive sample-brand matches; SDK dependency identifiers remain accurate, research provenance is retained. Package check preceded final configuration comment and HTTP limit wording corrections; final build refresh records mcp-lifecycle-build.log. Overall migration remains Partial:startup partial connection handling,slow retries,GET stream reopening,subscription restoration and automatic published schema replacement still differ from original lifecycle. No paid upstream or publication.

## Standard workflow replan (2026-10-11)

2026-10-11 workflow replan: reviewed LITCODE_WORKFLOW_AUDIT.md alongside FEATURES/STATUS/HOOKS/MONITOR/INTERACTIVE and current provider/index/test paths. Standard execution now lives in WORKFLOW.md, current audit/work-package state in research/CURRENT.md, and concise agent instructions in AGENTS.md. Header isolation and reported tool-count regressions precede provenance verification, Magpie integration and complete subsystem ports. Document links/fences passed; no product fixes, new full-suite or upstream verification were performed for this documentation task. Audit1000/997/3 remains a reported checkpoint, distinct from historical948 and later focused tests.

## W01 gateway boundary and baseline (2026-10-11)

Document-driven parallel work verified gateway environment-header isolation and repaired three incidental MCP tool-count assertions. Full current suite passed1003/1003, check/build and compiled gateway5/5 passed, offline package passed54files. Native SDK pollution was independently reproduced. Content/build identity and finite contracts are retained in [ports/W01.md](ports/W01.md) and its persistent evidence; real Magpie/upstream remain not_run.

## W02 source provenance and first ledger (2026-10-11)

Parallel verifier/index work accepted the complete2609-record source chain and generated research-module-index-v4.json(schema3). Final independent index check covers2366 parsed modules,3 binary skips,1266 recorded function ranges and zero missing eligible-source records; parse failures0. Six essential regressions and typecheck/build passed. Two compiled skill argument routes passed9 owned requests each; one incompatible smoke-switch combination is retained as a failed fixture attempt. Source/build identity, source verification and exact rewrite provenance live in [ports/W02.md](ports/W02.md), keeping historical ports unreviewed.

## W05 finite subscription/GET recovery (2026-10-11)

Opt-in pinned mcpRecovery now restores acknowledged URI state on candidate transports before atomic adoption and reopens transient same-session GET notifications under a finite lifetime budget. Source/compiled actualCLI each passed12 owned requests,5generations,7GET; peer/journal/cleanup/no-effect-replay verified. MCP138/138 and full1015/1015 passed; check/build and52file offline package passed. Exact source differences, temporary diagnostics, remaining startup/slow/persistence boundaries and durable identity are consolidated in [ports/W05-recovery.md](ports/W05-recovery.md). Real Magpie management source remains unlocated in bounded search and upstream remains not_run.

## Local recovery and delivery checkpoint (2026-10-11)

W04 realSIGKILL checkpoint/workflow chains, W05 startup degradation/slow retry, W06 used skills/once consumers and W07 private LiTcode coding/source delivery accepted under finite contracts. Current1021/1021, MCP141/141, check/build and compiledCLI chains passed; private56file package and independently rebuilt50module source identical. Source differences, residual ownership windows and external Magpie/license/remote requirements are in ports/W04-crash-recovery.md, ports/W05-startup.md, ports/W06-skills-hooks.md and ports/W07-local-delivery.md; shared persistent identity is ports/local-completion-evidence.json. Git/worktree initialized by explicit user request; no external publication.

## Magpie bounded cold-start launcher (2026-10-11)

Explicit command-start after ECONNREFUSED, shared root/model deadline, owned process-group cleanup, signal cancellation and pinned equal-form resume validation passed actualCLI smoke three groups. Existing launcher compiledoffline handoff and realMagpie0.1.1109 healthy-start suppression passed,0new modelcalls. macOS app cold-start and route/credential mutation remain unverified. Exact targets/receipts are ports/W03-cold-start-evidence.json; contract and usage are ports/W03-launcher.md.

## Installed gateway launcher distribution (2026-10-11)

litcode-magpie now ships in private57file runtime and production-only offline installation. Installed help/discovery/pinnedresume/compileddemo/coldstart/cancellation passed owneddrivers; deadstarter descendants reaped,0modelcalls. Fresh178files source offlineinstall/check/build matches50modules. Prior archives retained as prior identities; latest persistent inventory is ports/W03-installed-launcher-evidence.json, artifacts release/launcher-runtime and release/litcode-source-launcher. Actualapplicationcoldstart/route/rotation andpublicationdecisions remain pending.

## MCP durable subscription checkpoint (2026-10-12)

Opt-in session journal subscription binding passed compiled process restart/SIGKILL, pinned resume, cancellation/fork isolation and restore failure acceptance:3groups,37owned local requests. Final1027/1027, check/build and58file production installation passed. Remote-ack journal failure poisons replay; pending-close cleanup and direct-owner guards have regressions. Current identity, rewrite provenance and finite durability limits are consolidated in [ports/W05-persistence.md](ports/W05-persistence.md); prior records retain their version scopes.

## MCP sampling image input (2026-10-12)

Explicit pinned/managed samplingImages now reuses owned media header validation and constructs native Messages image blocks without altering bytes. Source host/CLI28/28, compiled CLI7local requests, final1029/1029, check/build and58file installed package passed. Only2tests added; existing cancellation/output/budget contracts reused. Source schema evidence, explicit rewrite boundary, identity and residual audio/array/pixel-decoding gaps are in [ports/W05-sampling-images.md](ports/W05-sampling-images.md).

## Recovered MCP foreground tasks (2026-10-12)

Adapted recovered driveMcpTask and integrated pinned/managed mcpTasks with HTTP/stdio, existing roots/form input callbacks, bounded polling/retries, cached answers and independent cancellation. Source/compiled actual task chains passed completion/malformed/unsupported/abort/close/legacy/resume,3owned CLI model requests. Check/build and59file installed package passed. Final suite and precise source/dependency coordinates reside in [ports/W05-tasks.md](ports/W05-tasks.md). Standard tasks/result, background reattachment and real remote task service equivalence remain separate.

## Sampling mixed block arrays (2026-10-12)

Opt-in pinned/managed samplingArrays accepts bounded nonempty text/image arrays through stdio and HTTP, with original block order and image attachment indices. Single-block host behavior remains; text results/shared budget/abort contracts reused. Actual compiled mixed CLI7local requests passed pin/resume/legacy/managed/budget; three regressions added. Source mapping, final baseline/package/source delivery and intermediate fixture failures consolidated in [ports/W05-sampling-arrays.md](ports/W05-sampling-arrays.md).

## Standard MCP task requestor (2026-10-12)

Explicit pinned/managed standard task mode negotiates2025-11-25, checks server capability+tool taskSupport, reads get/result with correlated roots/form POST stream callbacks and ends pending task-owned callbacks on release. Source/compiled standard and legacy extension chains passed; full1036/1036, check/build and60file install passed. Provenance, review refinements, finite requestor coverage and final identity are consolidated in [ports/W05-standard-tasks.md](ports/W05-standard-tasks.md). GET-only input delivery/task receivers/list/background reattachment remain separate.

## GET related task inputs (2026-10-12)

Standard task plus notification-stream gates now dispatch correlated roots/form requests from GET through existing ownership/validation/deadlines and bounded POST replies. One combined ownership/cancellation/close regression and actual compiled CLI exercise cover the finite chain; provenance and final results in [ports/W05-get-task-inputs.md](ports/W05-get-task-inputs.md). Historical notification-only and standard-task distribution records retain their original scopes.

## Durable HTTP task recovery (2026-10-12)

Pinned persistence/recovery/standard-task gates record creation and bounded result under an owned session journal. Explicit local handle retrieval opens a fresh authenticated HTTP session without replay, cached results survive crashes; missing/expired handles remain unresolved, retrieval abort preserves remote work. Compiled SIGKILL/continue/retrieve/cache chain and three regression groups cover the finite contract. Source rewrite rationale and final identity in [ports/W05-durable-tasks.md](ports/W05-durable-tasks.md).

## MCP audio sampling input (2026-10-12)

The recovered sampling branch stores audio bytes and returns a bounded text reference; it never emits a native audio block. The owned host conversion adds signature-checked containers with declared-MIME agreement, 16 KiB per-clip and 4-clip bounds under the shared 32 KiB request cap, and a private attachment store shared with the clipboard path; an unavailable store degrades to text. Compiled CLI chain, focused host suites and the 1042/1042 baseline bind the finite contract. Source adaptation rationale and final identity in [ports/W05-sampling-audio.md](ports/W05-sampling-audio.md).

## GET client request dispatch (2026-10-12)

The recovered SSE handler hands every message to one shared dispatch and suppresses reconnection once a request was seen. This package copies that: an opt-in owned GET stream serves every client request under the existing POST callback, ownership, cancellation and bounded-reply contract, leaves notification-only streams on the finite reopen budget, and keeps unconfigured methods at a bounded -32601. Transport regression, actual CLI chains and the 1043/1043 baseline bind the finite contract. Provenance and final identity in [ports/W05-get-dispatch.md](ports/W05-get-dispatch.md).

## GET stream resume (2026-10-12)

The recovered transport keeps the last SSE event id, replays it as last-event-id on the reconnect request and prefers a server retry value over its own backoff. This package copies that shape under the existing five-reopen budget and the rule that a stream carrying a client request is never reopened. A replay dedupe was implemented and then removed: the recovered transport has none, and it broke the real CLI standard/durable chain that reuses a request id. Provenance and final identity in [ports/W05-get-resume.md](ports/W05-get-resume.md).

## Sampling content metadata (2026-10-12)

The recovered sampling schema puts annotations and _meta on text/image/audio/tool blocks and _meta on messages, widens the request content union with tool_use/tool_result, and offers tools/toolChoice on the params, while its result union stays text/image/audio. This package copies the metadata shape as validated inert data: an offset ISO lastModified, a role-checked audience, a 0..1 priority and record _meta pass the transport and are then dropped when the host rebuilds the quoted provider request, so server metadata never reaches the model or the journal. Because no recovered result shape can carry tool use, tools, toolChoice and tool blocks are refused at the shape check and the limits text says so. The 1047/1047 baseline and the source/compiled CLI chains bind the finite contract. Provenance and final identity in [ports/W05-sampling-blocks.md](ports/W05-sampling-blocks.md).

## Image API limits (2026-10-12)

The recovered client carries a fixed image contract: 2000x2000 dimensions, a 5242880-byte base64 cap and the raw budget 3932160 that encodes to exactly that, with a 1568 floor for model-supplied limits and a refusal that asks the user to resize manually when compression fails. It satisfies the contract by decoding, re-encoding to webp/png and downscaling through the runtime's built-in image codec, which this Node runtime has no counterpart for: createImageBitmap, OffscreenCanvas, getImageData, createCanvas, node-canvas, @napi-rs and the usual JS codec names have zero hits, and pngjs appears only as a packer. The package therefore ports the limit data and enforces the base64 budget at the boundary, refuses with both byte counts and the recovered manual-resize guidance, reports over-target dimensions instead of refusing them (2000px is the many-image constraint the recovered client satisfies by downscaling) and records base64Bytes in metadata. The 1048/1048 baseline, the focused media/clipboard groups and the real CLI attachment chain bind the finite contract. No resize or re-encode is claimed. Provenance and final identity in [ports/W05-image-limits.md](ports/W05-image-limits.md).

## stdio re-dial on next use (2026-10-12)

The recovered client never runs a background dial loop for stdio: a fatal child failure closes the transport, deletes the connection cache and leaves the next use to dial a fresh process through the memoized dial factory, while explicit reconnect paths do a full disconnect and fresh dial. This package copies that lifecycle shape into the existing single owner of transport replacement: with the recovery opt-in, a disconnected managed stdio client attempts exactly one replacement inside the next tool call or catalog request, adopting the candidate only after the catalog revalidates against the collision and byte limits, and it never replays the call that already failed. The pinned-metadata check runs after the dial, so a server whose schema changed cannot serve the definition the caller saw. The connect-time probe restart is not ported (single protocol version, no probe). Three actual-CLI modes of the new driver bind the contract, and the 1049/1049 baseline holds. Provenance and final identity in [ports/W05-stdio-redial.md](ports/W05-stdio-redial.md).

## list_changed immediate refetch (2026-10-12)

The recovered client owns tools-list refreshing itself: its connection options leave transport auto-refresh off with zero debounce and install a handler that refetches on `notifications/tools/list_changed`, registering one refetch handler per server, while prompt and resource handlers stay empty. This package moves that refetch into the dynamic catalog that already observes the notification, reusing its serialized refresh queue: the affected server is refetched in the background at once, passes are coalesced per server with exactly one follow-up when a change lands during a pass, a failed pass is swallowed and leaves the server dirty for the next explicit use instead of retrying on a timer, and closing or aborting the connection stops the work. The pre-existing fail-closed `ensureFresh` guard stays as the last resort. The parked post-reopen re-run is bound to the `subscriptions/listen` re-listen stream this harness does not implement; refresh-on-replacement and dirty-at-use already cover that guarantee. A new actual-CLI driver (source and compiled) shows an idle GET-stream notification producing exactly one extra `tools/list` before any model request, with the changed tool then searchable and callable, and the 1051/1051 baseline holds. Provenance and final identity in [ports/W05-list-changed-refetch.md](ports/W05-list-changed-refetch.md).

## Skill inline shell: fenced blocks and the once-hook audit (2026-10-12)

The recovered client extracts authored shell in two forms before any substitution: a fenced ```! block (always scanned) and an inline `!`cmd`` span (scanned when the body contains "!`", and requiring a line start or whitespace), normalizing each command with a trim and CRLF fold, validating it against the target tool's input schema and replacing the raw span with its output. This package copies the fenced form into a single helper shared by the executor and by execution detection, so a body is reported executable exactly when a directive would run; both forms are preflighted as one group and executed in document order, and a span already inside a block is skipped so a block never runs twice. This runtime keeps its wider inline match (a mid-word span such as `value=!`cmd`` also counts), its quote-group argument parser instead of the recovered internal bash parser, and sequential execution. Hook `once` needed no change: the recovered flag is declared for every hook type but read only where skill hooks are registered, removal fires on success only, and the registry is an in-memory per-session map, whereas this runtime applies the flag to every hook and persists a pre-start claim in the journal. A new actual-CLI mode (`smoke:skill-fenced-cli`, source and compiled) binds the fenced contract, and the 1052/1052 baseline holds. Provenance and identity in [ports/W06-skill-inline-fenced.md](ports/W06-skill-inline-fenced.md).

## Remaining subsystem dispositions (2026-10-12)

The items still open after the W05/W06 packages are now decided rather than pending. Next-turn background redial is superseded: the recovered policy is off by default, keyed to a connection-table row model with turn counters, and this runtime already recovers automatically within one bounded round budget per transport lifetime; a second dialer would duplicate the single transport-replacement owner. Parked list_changed refetch has no basis here because it is driven by a `subscriptions/listen` re-listen response, and the guarantee it protects is already met by refresh-on-replacement plus the immediate refetch on the notification. The recovered shell-AST argument splitter is not ported: it is an internal bash parser of substantial size whose observable delta is limited to shell-grammar edge cases, so the tested quote-group contract stays. `mcp serve` plus a server-side task receiver has no recovered source basis and stays out of scope. Full pixel decoding needs a codec this project does not carry. The 2283 uncited modules stay an open, quantified gap named by the ledger rather than assigned a share. Every claim cites verified coordinates in [ports/remaining-dispositions.md](ports/remaining-dispositions.md).

## Unreviewed corpus characterisation (2026-10-12)

The ledger left 2283 uncited modules (33.4 MB) as a bare number. This pass characterises that remainder with byte evidence only, all of it reproducible from the ledger generator: banner length, a U+0000 binary test, sixteen literal markers recorded with their first offset, and a validated import-specifier grammar. The result: 2265 of the uncited modules import only runtime builtins (and none import a sibling chunk by name, since the bundler inlines them), external packages across the whole set are just ajv, ws, ajv-formats, inspector and the bundle naming itself, and the marker families cover roughly fifty modules - the largest of which are vendored libraries (validation, protobuf, OTLP, syntax grammars, terminal UI, cloud identity, DOM parsing) or deliberately out-of-scope cloud and UI surfaces. The pass also corrected a false lead: the `// @bun @bytecode` banner covers 2362 of 2365 modules and does not mean undecodable bytecode; the text after it is the readable source every port record quotes. One module, `chunk-2rxk8n7w.js`, is an in-scope candidate (the protocol method names and the SDK reconnect constants the stdio re-dial record replaces), recorded without editing any verified record. The honest remainder is 2231 uncited modules with no marker. See [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md).

A second slice applied the same method to the next twenty-five uncited modules by size (ranks 21-45, 3,271,635 bytes). It found three in-scope modules: `chunk-x0dc37w9.js` carries the `settings_policy_helpers_per_os` and `remote_consent_missing` names, which makes the per-OS managed-settings policy helpers and the remote-consent state one subsystem rather than two; `chunk-8jhea020.js` carries refusal outcome records next to the permission-decision surface; and `chunk-4bw62nzm.js` carries the policy-install race/deferred handling. Five further modules are recorded as candidates with no ownership claim (plugin loading, task notifications, permission-decision reasons, an OS-specific command table, and the workflow journal), and the rest are vendored libraries, recovered UI or build metadata.

A third slice covered ranks 46-70 (2,052,421 bytes). Twenty of its twenty-five rows needed no new judgement - six are the same build-constants module, four are bundler import tables or recovered UI panels, and the rest are vendored libraries, hosted surfaces or recovered report text. It added two in-scope candidates: the cloud metadata-address table in `chunk-nvrxq9nn.js` (Alibaba, Azure and link-local addresses feeding `agent_proxy_init`), and - the more significant find - the shell-reading analyser behind permission matching in `chunk-zjewzgfh.js`. That module is not the argument splitter this project already decided not to port, which lives in `chunk-m00pavz3.js`; it enumerates the alternate readings of a command (`pyr`, `[7547,7897)`, exhaustive up to three varying positions and bounded beyond that) and refuses to check an ambiguous one, returning `too-complex` with a `differential` flag for lone surrogates, control characters, Unicode and backslash-escaped whitespace, zsh `~[` directory syntax, zsh `=cmd` expansion, zsh numeric-range globs, and unmodelled node types. Nothing in `src/` does this, so it is recorded as an open in-scope gap and carried in CURRENT as the next candidate work package. The remainder after three slices is 2181 uncited modules with no marker; removing it needs per-module reading, which is what the slices do.

That figure has since been superseded by a bookkeeping correction rather than by more reading: the ledger was scanning its own generated `-evidence.json` files as citing records, so a package's evidence file could cite the modules that package had ported and inflate the count. After excluding those derived artifacts and adding the refusal record's citations, the regenerated ledger reported 29 port-backed, 61 narrative-only and 2275 uncited modules, of which 2225 carry no marker; the permission-readings and policy-helper records then moved two more modules out of the narrative column, so the current figures are 31 / 59 / 2275 / 2225. The slices' own tables and byte totals are unchanged; only the totals move. See [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md).

A fourth slice covered ranks 71-95 of the uncited list (1,376,177 bytes, 61,473 down to 49,498). The first attempt at it ranked all 2,365 modules instead of the uncited set and re-covered twenty of slice three's rows, which is how the ranking rule got pinned: the uncited list is stable between passes because this characterisation file, like the other generated records, is excluded from the ledger's citation scan, so the bands are contiguous and share no module. The band is mostly settled material - six vendored libraries (two OpenTelemetry, zod, jose, AWS SDK core, ajv), seven hosted or external surfaces, two OAuth clients the standing rule already excludes, two modules of the background/daemon family, two recovered UI panels - with three new candidates recorded and no ownership claim: auto-mode environment gathering and its own classifier in `chunk-fmjcnmvh.js`, foreign agent-config import and translation in `chunk-zha4hbcb.js`, and the plugin marketplace CLI in `chunk-9nek920x.js`. It also disposed slice three's two open candidates. `chunk-nvrxq9nn.js` is the `ccr-agent-proxy` cloud-sandbox egress proxy and is external: it needs cloud-issued `AGENT_PROXY_URL` and `AGENT_PROXY_AUTH_TOKEN`, a session token from the container path `/run/ccr/session_token`, and the cloud relay whose status route is `/__agentproxy/status`, while `src/` has no proxy transport at all - the only matches for `proxy` are `new Proxy` in `src/runtime.ts` and a header-name filter in `src/mcp-http.ts` - so its NO_PROXY address tables have no local consumer. `chunk-gyf58rwf.js` had been read as redaction and Markdown link rewriting, and that reading was wrong: it is a credential-pattern table and a path link-chain resolver. The resolver is the next work package, carried as W09 in CURRENT, because this runtime resolves a path once and checks the prefix rather than walking the chain, capping its length, refusing a chain that surfaces a network path, or verifying the identity of the file it then reads. The remainder after four slices is still 2225 uncited modules with no marker, unchanged on purpose: recording a module in the characterisation file does not make it port-backed. See [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md).

## Model refusal notice (2026-10-12)

The recovered client reads a refusal off a streamed message in one place: the stop reason is `refusal` and the policy category and explanation come from the provider's stop details, which reach the response through the `message_delta` accumulator. It then builds a warning record (`A_n`, `chunk-40cepjpq.js` [37113,37473)) whose fields are the content, the original model, the request id, the API refusal category and explanation and the refused message uuid, and it leaves the tool calls of that message unrun - either by ending the turn or, in the recovered retry path, by materializing them as error results and re-sending once with a notice. This package ports the detection and the no-fallback record as a new `refusal` journal kind carrying the model and the optional category, explanation and request id, prints one warning line with the same detail, and ends the turn; the tool-call skip owed no new code because the existing loop already refuses to run tools when the stop reason is not `tool_use`. The explanation is flattened to one line and bounded because journal records reject control characters, and a refusal with no stop details still records. The recovered same-model retry, fallback chain with its consent prompt, and retraction of the refused turn are deliberately not ported, so the retry's "continuing once" notice text is not reused. Verified by two unit cases and a real-CLI smoke (`npm run smoke:refusal-cli`, source and compiled) against an owned SSE gateway emitting a refusal with stop details after a tool call: one model request, the tool never run, one `refusal` record and one skipped-call error result. Full suite 1054/1054; identity 110/82/55 files, merged 7e1f968a… (recomputed because the digest covers `scripts/`, which this package also corrected), reproduced by an independent offline rebuild. Provenance in [ports/W01-refusal-notice.md](ports/W01-refusal-notice.md).

## Sound permission matching over shell readings (2026-10-12)

A command line is not one string to the shell, so a rule that matches only the literal text can permit a command whose real effect is different. The recovered client answers this by enumerating the readings of a command and checking each one: `pyr` (`chunk-zjewzgfh.js` [7547,7897)) builds the set, enumerating all `2**e` combinations when at most three positions vary and otherwise returning a bounded sample explicitly marked incomplete; `DTr` (`chunk-sfn1dbxq.js` [3234534,3234900)) merges the results and returns the first `deny` among the baseline and the readings, keeps an unaccepted baseline `ask`, and falls through to a `too-complex` outcome when the set was not exhaustive and the strictest reading is not an ask. Two call sites consume it, the permission wrapper `ior` [3253708,...) and a write-path caller [3246078,...).

This package ports the invariant rather than the parser: a rule that constrains a command is now evaluated against every reading of that command - de-quoted and unescaped forms, per-segment splits on `;`, `&&`, `||`, `|` and newline, and the bodies of command substitutions, each one level further - so a denial reached from any reading denies the call, and a reading set that cannot be completed (a substitution, parameter expansion, unquoted variable, tilde or glob is present, or the bound of 16 is hit) never passes on the strength of one reading but becomes an ask instead. A rule with no `command` constraint cannot depend on how the shell reads the line, so it is untouched, which is what keeps default policies, mode prompts and `path` rules identical; a baseline denial is never softened and `bypass` keeps its meaning. The recovered bash lexer and its `Lcn` strictness ordering are not ported - the first is the argument splitter already decided not-ported, and the second does not change which safety rule applies. Verified by four unit cases and a real-CLI smoke (`npm run smoke:shell-readings-cli`, source and compiled) in which `echo 'denied' > marker.txt` is refused under a rule on `echo denied*` and creates no file, while the control command `echo fine > marker.txt` runs and writes it. Full suite 1058/1058; identity 112/83/56 files, merged 210b3e85…, reproduced by an independent offline rebuild. Provenance in [ports/W01-permission-readings.md](ports/W01-permission-readings.md).

## A credential shape is redacted from text the harness passes on (2026-10-12)

The last recorded item was not a candidate at all, it turned out: slice three's reading of that module was corrected in slice four, which found it held two subsystems, and the smaller one went first. The other half now lands.

The runtime already redacted text it re-emits, but only one way: for every secret in the session's own configuration it replaced the raw and URL-encoded spellings, on the query, each citation's title and snippet, and each citation URL - where a URL that changes under redaction is dropped rather than rewritten. A provider token the session was never configured with went through untouched. The recovered module holds the second way: 64 entries that recognize a credential by the shape its provider published. The precise half - 52 prefix-anchored formats, from an AWS access key and a Google API key through the eleven GitLab tokens, the Slack family, a SendGrid token, an npm token, a Postman key and a Stripe key - is now carried, and the existing helper returns through it.

The twelve contextual entries are deliberately not carried, and the reason is this surface's own behaviour rather than taste: a citation whose URL changes under redaction is dropped, so a pattern that matches an ordinary `user:password@host` URL, the word before an equals sign, or a loose JWT would silently discard legitimate search results. Shape recognition here has to be a credential rather than a guess, and a case asserts the absence so that re-adding one is a decision rather than drift. Two smaller choices follow the same logic: the captured span is replaced rather than the whole match, because several patterns carry a trailing boundary and replacing all of it would eat the delimiter; and the token is the one this surface already writes, since one string can carry a known-secret and a shape redaction together.

Five cases on the table itself - every family has a sample that matches its own id, the surroundings survive, ordinary text and near-misses are untouched, the ambiguous entries are absent, and the compiled table carries no state between calls - plus an end-to-end case over the search fixture. The full suite is 1116/1116. Detail and coordinates: ports/W19-credential-shapes.md.

## A third candidate reclassified, and the recorded candidates run out (2026-10-12)

The seventh corpus candidate is the last one the reading pass recorded, and reading it whole closes it the same way as the third and the fifth. It was recorded as external instruction-file imports behind a forward-scoped consent dialog. The module is the dialog: it asks "Allow external CLAUDE.md file imports?", explains that the project's instruction files import files outside the working directory and that this must never be allowed for third-party repositories, lists the imports it found, and says that a yes covers the ones the project adds later. Everything it gates is a surface this runtime does not have, because an import that leaves the working directory is refused rather than asked about - at configuration time by the nested-import visitor, and at tool time by the path confinement that rejects an absolute path outright. Nothing in the source prompts for out-of-workspace file access.

The reusable half is the shape rather than the dialog: a capability a checkout asks for, granted only by a person, where one yes stands for what that checkout adds later. That shape already landed here on the surface where this runtime has it - the project-declared MCP server approval holds a server until the person approves it and takes the one standing switch from the user's own layer. Adding this dialog instead would widen what can be read, not narrow it, which is new product scope rather than a rule landing on an existing surface.

Two things were corrected while recording this. The corpus note cited the containment rule at a line that now addresses the installed-plugin index recheck; the throw is a few dozen lines below it, and both the note and the candidate's own record now say so. And the corpus file gains a table at its end listing all nine recorded candidates with their dispositions, so the reading pass and the disposition of each candidate it produced can be read in one place.

The recorded candidate list is now empty: five ported as packages and three reclassified, with every reclassified module read whole first and the local check that decided it written down. What remains in the backlog is the long tail of routine local work and the three items that need input from outside this repository. Detail: ports/unreviewed-corpus.md.

## A candidate reclassified as a rule without a local surface, again (2026-10-12)

Reading the fifth corpus candidate whole for a port attempt changed what it is, the same way the third one changed. It was recorded as plugin admission under managed settings - a managed source must vouch for a plugin, and a source not read whole does not vouch. The module is not an admission gate. It is a tier-seating pass: for every plugin the managed settings enable, it decides whether that plugin's hooks load in the organization's tier or the user's, and it withholds the organization's tier, with a warning naming which condition failed, when the plugin does not load in place from the local folder its marketplace is registered from, when the source it is registered from is named only by a managed source the session does not vouch for - remote managed settings the server has not confirmed, or a document the user's own account can write - and when no managed source names that source at all.

The half that generalises is the one the module states outright: a managed settings source that was not read whole, because of a load error or a plugin key it could not apply, does not count as having spoken. That property already holds here, more strongly. The one managed settings file is read as required, its keys are an allowlist, and the layer reader throws on a missing required file, an oversize file, invalid JSON and a non-object - so a source that cannot be read whole stops the configuration rather than being treated as silent. There is no rule missing.

The seating half has nothing to land on. This runtime has no plugin tier, no marketplace registration, no list of enabled plugins and no remote managed settings source; its plugins are inert local directory snapshots discovered from a store index by digest, and the plugin configuration is a single `enabled` switch with size limits. Nothing carries an organization identity to seat or withhold. The principle underneath - a source the governed party can write must not count as the governing party's policy - is already enforced where it applies here: a project layer cannot approve its own MCP servers.

So the candidate is recorded as a rule without a local surface rather than as a pending port, and the corpus narrative's band sentence, which still said the band recorded no new candidate while its own table marked one, now agrees with the table. No product source changed, so the suite, the build and the package are unchanged. Detail: ports/unreviewed-corpus.md, slice nineteen.

## A memory that disagrees with an instruction file reaches one of three verdicts (2026-10-12)

The fourth candidate is ported, and like the sixth it is half a rule: the recovered module both decides what to do when a memory and an instruction file describe different procedures and runs an unattended consolidation pass that asks the question. Only the deciding half has a surface here.

The local memory instructions already asked for maintenance in the current conversation, already merged duplicates on write, already required the digest of a fresh read before an update and already said that current user instructions take precedence over remembered preferences. What they did not say is what to do when a memory and an instruction file disagree about *how* to do something - the precedence sentence names a winner for directives, not a reconciliation for a stale procedure. Maintenance now has to reach one of three verdicts rather than leave the disagreement unstated: the memory is stale and is deleted or rewritten, the instruction file may be stale and the memory carries the annotation and the user is told, or there is no conflict and the memory stays.

The annotation is one exported constant quoted into the instruction text, so the literal a person will search for and the text the model reads cannot drift apart. Two rewrites were needed because this rule lands in a conversation rather than an unattended run: "do not edit CLAUDE.md during a dream" becomes conditional on the user asking for that edit, since editing an instruction file can be exactly what the user wanted, and "list it in your summary" becomes telling the user, because there is no summary artifact here. The recovered em dash is a hyphen, since every file in this project is ASCII, and the wording is otherwise unchanged.

The consolidation pass itself is not ported. The gates, the throttle, the lock, the forked subagent with its read-only tool list and the settle step all exist to bound a background run, and this runtime has no scheduled or background agent pass to hang them on - porting them would mean building that surface first. The two memory-item states that skip a run were already covered here in a different spelling: an unreadable entry raises its own error and a record that moved raises the digest conflict the write path already enforces.

One case, three in the file; the full suite is 1110/1110. Detail and coordinates: ports/W16-memory-contradiction.md.

## A bypass request from root outside a sandbox is refused (2026-10-12)

The sixth candidate is ported, and it is half a rule: the recovered module both refuses the mode that skips every check under root and asks for a bypass consent that only holds if the settings write persisted. Only the first half has a surface here.

The bypass mode exists so a person can tell the harness to stop asking. It stops meaning that when the process is root, because the tools then act as the machine's owner rather than as the person who typed the command, and a workspace-relative path is no longer a boundary between them. The recovered product refuses the mode outright instead of warning, since a warning about a mode that already skipped the checks is read too late. That refusal now happens as the permissions are resolved, before the workspace is locked, before MCP admission and before the first request.

Being root inside a container is a different situation - there the process is already the sandbox's owner - so the test is root *outside* a deliberate sandbox. The recovered predicate exempts on two environment flags of its own; here the signals are the container marker files Docker and Podman leave behind plus one explicit opt-in, because this runtime has no bubblewrap wrapper to name. Windows needs no platform test: the uid source does not exist there, so the uid is undefined rather than zero and nothing is refused. A marker that cannot be read counts as absent, so a permission error cannot become an exemption.

Two decisions differ from the recovered code on purpose. The refusal is returned as a value that the CLI turns into the exit, because a rule that only exists as an exit code cannot be asserted; and the settings-level spelling of the request is dropped rather than carried, because no local settings layer produces it and an unreachable true branch is exactly the mistake a guard like this exists to catch.

The recovered module's other two exports are not ported: the policy gate needs a policy source these settings layers do not carry, and the consent dialog with its persist-after-consent check guards a surface this runtime does not have. Five cases, including a real CLI run that preloads a uid of 0 and asserts the refusal before anything starts; the full suite is 1109/1109. Detail and coordinates: ports/W15-bypass-guard.md.

## An attachment refuses a credentials path and a second link (2026-10-12)

The seventh candidate is ported, and it is the smallest of the three: the recovered product refuses an attachment by category, and two of those categories had no counterpart here.

The media reader already refused an escaping path, a symlinked path, a reserved directory, a non-regular file, an oversized file, a file that moved between validation and read, and a file that grew during the read - so the recovered reason union maps onto it almost one for one, and the members that were missing were a credentials-shaped name and a file with more than one hard link. Both are now refusals with their own reason: a name or folder that credentials are kept under is refused before the filesystem is touched and quotes the segment that matched, with a checked-in sample exempt so that the documentation telling a person how to write the real file still reads; and a second link is refused on the opened handle, because the validated path is not the only way to those bytes.

The recovered credential sets are large internal constants of a 697 KB module. The readable core is transcribed with the recovered spellings and the host-specific members - this runtime's own settings and state files, a host credentials file named by an environment variable, the platform keychain directories - are recorded as not ported rather than guessed at, because none of them names a file a person would hand this runtime as an attachment.

Three cases were added to the media tests, twelve in the file; the full suite is 1104/1104. No CLI smoke, for the reason recorded with the package. Detail and coordinates: ports/W14-attachment-refusals.md.

## A candidate reclassified as a rule without a local surface (2026-10-12)

Reading the third corpus candidate whole for a port attempt changed what it is. It was recorded as entry-level vetting of a Git directory, and the vetting rules are real - per-entry dispositions with `commondir`, `gitdir` and `reftable` refused outright, an entry cap, and refusals for an unknown entry, an index that is not a regular file or has more than one link, an entry whose kind does not match, a Git directory with no config or HEAD, a linked or oversized objects entry, and `objects/info/alternates`, plus a config rewritten to an allowlist with two keys forced false. But they are not a rule about inspecting a Git directory; they are the gates on copying a discovered repository's Git directory into a temporary directory so git can read it without touching the original. The module is a workspace-diff materialiser.

This runtime has no surface that reads a repository it did not create: there is no diff anywhere in `src/`, git is invoked only by the worktree manager for registration, and the other Git references merely bound ancestor traversal or reserve the name. The half of the rule that does have a counterpart is already covered, because the worktree manager's `checkFile` refuses a non-regular file, a symlink and a link count other than one for the Git file and the backlink of a worktree this runtime created.

Porting the vetting would therefore mean building the diff capability it guards first, which is new product scope rather than a rule landing on a surface this runtime already owns. It is recorded as a rule without a local surface, and it no longer counts as a pending port - the honest outcome of reading a candidate, and the same disposition the review reached for the cloud-metadata module.

## A write verifies what it wrote (2026-10-12)

The first candidate from the corpus review is ported, and like the ninth it turned out to be larger than the review's one-line reading: the recovered write path verifies the bytes it produced, re-checks the directory before publishing, tolerates a filesystem that cannot flush, and logs each step so a reader can tell which one failed.

The rule that matters is that an atomic rename is not evidence that a write happened. The rename says the name points at new bytes; it says nothing about how many arrived, and a network drive or a sync client can accept a write, report success and leave fewer bytes behind. So the content is staged in a temporary file beside the target, flushed, measured on the descriptor against what was handed in, and only then renamed - and a short write is refused rather than published, because a truncated file under the real name is worse than no write at all. The directory that will receive the rename is identified before the temporary file is created and checked again immediately before the rename, so a directory replaced while the write was in flight cannot take it. When the content is whole but cannot be published, the temporary file is kept and its path is named in the error, so a retry does not have to redo the work.

Four writers exist in this runtime and only two of them write content a caller handed in, so the rule lands once in a shared writer that `write_file`, `edit_file` and `notebook_edit` delegate to; the checkpoint and task writers keep their own, because they write harness-owned state under a lock and already carry their own verification and commit hooks.

Nine unit cases and one integration case cover the chain; the full suite is 1101/1101. No CLI smoke was added, and the reason is recorded with the package: the tool layer already drives `write_file` end to end and asserts the no-leftovers property, while the behaviours that changed are only observable from inside the write. Detail and coordinates: ports/W13-verified-write.md.

## Project-declared MCP servers are admitted, not configured (2026-10-12)

The ninth candidate from the corpus review is ported, and the recovered surface turned out to be larger than the review's one-line reading of it - which is the reason the review records a candidate rather than a conclusion.

The recovered product treats a server named by a file the checkout owns as a decision with three outcomes, not two: one function returns `approved`, `rejected` or `pending`, the stored answer is read in an order that makes a rejection outrank everything and an approval outrank a blanket switch, and a startup step asks about exactly the servers whose state is `pending`. Two behaviours in that step were ported because they are the ones that matter when something goes wrong: settings that cannot be read **skip** admission rather than granting it, and a choice that cannot be saved says so and returns next startup instead of being lost silently. The blanket switch is only ever read from a scope the product has decided to honour, which is why this runtime - having no scope gates to consult - accepts it from the user layer alone and refuses it by name when a project layer sets it.

The port keeps the recovered decision model and answers, and rewrites its storage, because the recovered product stores the answers as two name lists inside the settings it also reads them from. Here an answer is a canonical digest of the declared server bound to the real path of the workspace, in a user-directory file the checkout cannot write, so editing a server's command asks again and approving a name in one checkout never admits it in another. The interactive dialog, the two automatic approval routes and the plugin-contributed half of the collector are not ported, each for a reason recorded with it.

One fixture changed and no product behaviour regressed: the MCP CLI cases declared their own fixture server in the workspace's settings file, which is now a project layer and is correctly held, so the fixture declares it in the user layer. Sixteen unit cases and a six-run real-CLI smoke cover the chain; the full suite is 1091/1091. Detail and coordinates: ports/W12-mcp-server-approval.md.

## Corpus review complete (2026-10-12)

The final band, ranks 2221-2267, is the remainder: 47 modules and 2,241 bytes, 697 down to 615, the noise floor where only four modules carry content and seven have a zero-byte body. With it the review has read the uncited set end to end - all 2267 uncited modules, in thirty-four contiguous bands of a hundred ranks, from the largest module down to the seven that are nothing but a re-export. No unread module remains and there is no next band.

The pass produced nine recorded-but-unported candidates: post-write size verification on the file write path with a preserving temp-file fallback; entry-level vetting of a Git directory; the memory contradiction verdict and consolidation pass; plugin admission under managed settings where an unread source does not vouch; the bypass-permission guard under root or sudo; workspace-external instruction imports behind a forward-scoped consent dialog; an attachment refused for a credential-shaped name or more than one hard link; a project-declared MCP server held until the user approves it; and the same MCP consent rule seen from a second, first-party side. The eighth of those is now landed, so eight candidates remain open. Reading changed nothing in the ledger and was not supposed to: the corpus file is not a citation source, so the port-backed / narrative-only / uncited figures move only when a port package cites the module it actually reads - which is what the landing above did, taking three modules out of the uncited set and leaving it at 2264.

## Corpus slice thirty-three (2026-10-12)

Ranks 2121-2220 of the uncited list (13,023 bytes, 773 down to 699) - the seventeenth 100-rank band and the bottom of the corpus by size, where every module is below 800 bytes and the band's whole byte mass is smaller than one module of slice four - at 35.6% import text, with only 18 modules carrying content, ten of those only through state-name markers, and eighty-two carrying nothing of their own: a single import statement or a state-name constant with no body. It reads as ninety-two modules with no characterising literal, four hosted surfaces, three with local counterparts and one product surface without a local counterpart.

No candidate: everything readable is either a hosted surface (routines, remote tool calls and probes, upload authorisation), a state name, or a local surface this runtime already owns (settings application reporting, the memory tool surface, web fetch admission).

## Corpus slice thirty-two (2026-10-12)

Ranks 2021-2120 of the uncited list (21,119 bytes, 890 down to 773) - the sixteenth 100-rank band and the smallest in the review - at 27.6% import text, with only 19 modules carrying content, eleven of those only through state-name markers, and eighty-one carrying nothing of their own. Eighty-one of the hundred modules are aggregators of two or three imports and a re-export, the highest share the review has seen, so almost the whole band has no body to read. It reads as ninety-two modules with no characterising literal, four with local counterparts, one hosted surface, one pure code leaf, one product surface without a local counterpart and one vendored package.

No candidate and nothing new: a permission mode reported as disabled by settings belongs to the W01 family and to the surface the bypass-guard candidate from slice twenty-one concerns, deferred tool loading is a surface this runtime already has, and the remaining rows are a theme name, a command rename notice, an XHTML namespace and a vendored UI guard.

## Corpus slice thirty-one (2026-10-12)

Ranks 1921-2020 of the uncited list (35,171 bytes, 1,041 down to 895) - the fifteenth 100-rank band and the first entirely below one kilobyte - at 25.0% import text, with 40 modules carrying content, twenty-two of those only through state-name markers, and sixty carrying nothing of their own. Every module in the band is a fragment: hosted session and remote-control states, permissions and goals, terminal and deep-link handling, and single constants. It reads as eighty-two modules with no characterising literal, eight hosted surfaces, five with local counterparts, two product surfaces without a local counterpart, two pure code leaves and one rule guarding a surface this runtime does not have.

No candidate: a machine identity read that reports an unsupported platform guards a surface this runtime does not have, and every other reading either belongs to a hosted surface or repeats a local one. Two rows extend open families: narrower-command guidance for PowerShell and for the POSIX tools (the W01 permission family) and deep-link handling that names the OS protocol handler's argument (the W09/W10 vetting family).

## Corpus slice thirty (2026-10-12)

Ranks 1821-1920 of the uncited list (50,996 bytes, 1,209 down to 1,046) - the fourteenth 100-rank band and the last of the above-one-kilobyte modules - at 27.5% import text, with 39 modules carrying content, eighteen of those only through state-name markers, and sixty-one carrying nothing of their own. The band covers permission message fragments, organization MCP policy, launch ancestry and path text, skills bookkeeping, and the hosted machine-identity, powerup, whiteboard and prompt-bundle surfaces. It reads as seventy-nine modules with no characterising literal, eleven with local counterparts, eight hosted surfaces, one product surface without a local counterpart and one vendored package.

No candidate, and one reading deliberately left open: a session that is not signed in or not authorized to write carries two message fragments, one saying the session cannot write and one naming the deny and ask rules, and the polarity of the second cannot be established from an isolated constant, so it stays an open reading rather than becoming a rule. Three rows extend open families: path character vetting and launch ancestry are the W09 family, permission rule description templates are the W01 family, and an organization MCP policy that blocks a tool is the managed-settings family recorded since slice nineteen.

## Corpus slice twenty-nine (2026-10-12)

Ranks 1721-1820 of the uncited list (69,906 bytes, 1,424 down to 1,209) - the thirteenth 100-rank band and the last of the above-one-kilobyte prose - at 24.9% import text, with only 35 modules carrying content, eleven of those only through state-name markers, and sixty-five carrying nothing of their own. The band covers policy and managed-settings reporting, daemon and background bookkeeping, cross-session messaging, Windows command resolution, and single-purpose hosted surfaces. It reads as seventy-six modules with no characterising literal, twelve with local counterparts, nine hosted surfaces, two pure code leaves and one product surface without a local counterpart.

No candidate of its own, but one corroboration: a first-party design MCP server that also requires consent applies the same rule the ninth candidate records from the project-declaration side, so the recovered client asks before connecting an MCP server in more than one place while this runtime connects every declared server without asking. One row extends the managed-settings family recorded since slice nineteen: the Windows policy registry keys and the in-WSL programme-files path are settings sources this runtime reads from its own layer list instead.

## Corpus slice twenty-eight (2026-10-12)

Ranks 1621-1720 of the uncited list (92,032 bytes, 1,647 down to 1,425) - the twelfth 100-rank band and the under-1.7-kilobyte remainder - at 30.3% import text, with 40 modules carrying content, ten of those only through state-name markers, and sixty carrying nothing of their own. The band covers hosted artifact, design and connector surfaces, browser and device tool naming, agent and subagent reporting, and the tail of the MCP, plugin and background-job plumbing. It reads as seventy modules with no characterising literal, fifteen hosted surfaces, nine with local counterparts, two product surfaces without a local counterpart, two rules guarding surfaces this runtime does not have, one vendored package and one candidate.

The ninth candidate: a project-declared MCP server is held until the user approves it, while this runtime connects a server declared by a workspace-controlled settings layer with no approval step. The covered half is the layered settings read that includes the workspace's own `.harness/settings.json` and the schema-parsed `mcpServers` that reaches the connect call; the uncovered half is any approval before such a declaration is connected, and no awaiting-approval state or per-server project admission exists in the local source. Two rows extend open families instead: unattended serving consent, which organization or user settings can force off, completes the attestation family slice twenty-seven named over a surface this runtime does not have, and a goal restored on resume belongs to the goal surface it also lacks.

## Corpus slice twenty-seven (2026-10-12)

Ranks 1521-1620 of the uncited list (119,654 bytes, 1,968 down to 1,651) - the eleventh 100-rank band and the under-two-kilobyte tail - at 35.4% import text, where the aggregator share climbs back as the prose runs out, with 50 modules carrying content, thirteen of those only through state-name markers, and fifty carrying nothing of their own. The band covers MCP dialling and tool discovery, GitHub CLI and plugin directory handling, shell allow rules, usage-limit reporting, and the hosted connector, tunnel, voice and device surfaces. It reads as sixty-three modules with no characterising literal, sixteen with local counterparts, thirteen hosted surfaces, two vendored packages, two modules excluded with credentials or OAuth, two pure code leaves, one product surface without a local counterpart and one rule guarding a surface this runtime does not have.

No candidate. A tool host attestation gate that counts unattested served calls and can raise a configuration exception guards a surface this runtime does not have, and an answer discarded for arriving implausibly fast after the question is one literal over an intake the runtime could plausibly own but far too little text to make a rule. Two rows extend open families: shell allow rules carrying a dangerous-prefix notion (the W01 permission family) and a managed-settings value reported as set by the organization (the family recorded since slice nineteen).

## Corpus slice twenty-six (2026-10-12)

Ranks 1421-1520 of the uncited list (157,862 bytes, 2,451 down to 1,970) - the tenth 100-rank band and the last of the two-kilobyte-and-under prose - at 22.9% import text, with 65 modules carrying content, twenty-one of those only through state-name markers, and thirty-five carrying nothing of their own. The band covers terminal integration and clipboard transports, session colour and teammate bookkeeping, login and subscription surfaces, startup phase ordering, and the hosted bridge, fleet and dev-intent surfaces. It reads as fifty-six modules with no characterising literal, twenty-six with local counterparts, twelve hosted surfaces, two rules guarding surfaces this runtime does not have, one module excluded with OAuth, one vendored package, one pure code leaf and one product surface without a local counterpart.

No candidate, and two rules that could have become one closed on the local read: a unix control socket refused when its directory cannot be set up or its path is not a usable local address guards a surface this runtime does not have, because it runs no unix-socket server, and a CA certificate loader that skips a settings-sourced `NODE_EXTRA_CA_CERTS` value guards a surface it does not have either, because the local source never reads a CA certificate configuration. One module extends the managed-settings family recorded since slice nineteen: the startup phase ordering names the remote managed-settings load among the passes it sequences.

## Corpus slice twenty-five (2026-10-12)

Ranks 1321-1420 of the uncited list (213,929 bytes, 3,176 down to 2,451) - the ninth 100-rank band and the first entirely below three kilobytes - at 22.2% import text, with 67 modules carrying content, twenty-one of those only through state-name markers, and thirty-three carrying nothing of their own. The band covers request parameters and tool input validation, repository trust and permission mode plumbing, transcript and session bookkeeping, plugin fetch and prompt overrides, and the hosted bridge, device, vitals and workshop surfaces. It reads as fifty-four modules with no characterising literal, twenty-two with local counterparts, sixteen hosted surfaces, four excluded with credentials or OAuth, one vendored package, one pure code leaf, one product surface without a local counterpart and one candidate.

The eighth candidate: an attachment path refused when its name is credential-shaped or when it has more than one hard link, over a read path this runtime already owns. The covered half confines the path inside the workspace, opens with `O_NOFOLLOW`, refuses a non-regular file, caps the size and re-verifies device and inode before returning bytes; the uncovered half is the credential-shaped-name refusal and the hard-link refusal, neither of which appears in the local source. Two rows extend open families instead of adding candidates: an MCP policy cold start that waits on remote managed settings and times out, the managed-settings family recorded in slices nineteen, twenty and twenty-three, and an approval stored against the exact arguments it was granted for, which describes a surface this runtime does not have because it decides each call statelessly and keeps no approval store.

## Corpus slice twenty-four (2026-10-12)

Ranks 1221-1320 of the uncited list (293,424 bytes, 3,982 down to 3,180), the eighth 100-rank band, the smallest module sizes in the corpus so far and the lowest import-text share since slice eighteen at 18.2%, with 80 modules carrying content - twelve of those only through state-name markers - and twenty carrying nothing of their own. The most product-shaped band yet: settings validation and provenance, keybindings and interactive session plumbing, MCP elicitation, plugin tips, and the hosted bridge, fleet and device surfaces. It reads as thirty-two modules with local counterparts, thirty-two with no characterising literal, twenty-five hosted surfaces, four pure code leaves, three vendored packages, two product surfaces without a local counterpart and two modules excluded with credentials or OAuth.

No candidate, and two rules that looked like candidates closed out once the local source was read: a worktree registration path refused unless it is an absolute local path - rejecting `\\server\share`, `//server/share` and `/net/host` forms and any NUL - is already covered, because this runtime refuses a NUL byte or replacement character in path text and rejects a network filesystem by its `statfs` type; and an approval recorded against an input digest had no local approval store to compare with and too little of its own text to make a rule. One module extends the managed-settings family recorded in slices nineteen and twenty: a settings source that was not read is reported as not read rather than assumed default.

## Corpus slice twenty-three (2026-10-12)

Ranks 1121-1220 of the uncited list (383,570 bytes, 4,765 down to 3,988), the seventh 100-rank band and the lowest import-text share since slice fourteen at 36.1%, with 69 modules carrying content - twelve of those only through state-name markers - and thirty-one carrying nothing of their own. The interaction and runtime-plumbing layer: permission and dialog plumbing, skill and plugin surfaces, session and bridge bookkeeping, and the vendored AWS and smithy clients. It reads as thirty-two modules with local counterparts, forty-three with no characterising literal, fifteen hosted surfaces, four product surfaces without a local counterpart, three vendored packages, one pure code leaf and one rule that guards a surface this runtime does not have.

One candidate, the seventh this review has recorded: the recovered client resolves a workspace-external instruction import only after the user accepts a consent dialog, and accepting once covers imports the project adds later, where this runtime refuses the same import outright with a containment error from its instruction-file visitor. The covered half is that containment rule with its reserved-tree and depth checks; the uncovered half is the consent path and its forward scoping. Two further modules extend families already open: settings provenance reported by source including managed settings, and a Git invocation hardened with two more options over the six this runtime already sets and its scrubbed `GIT_*` environment, where the two extra options have no local effect surface because the runtime's only output-using Git commands are `rev-parse` and `status -z`.

## Corpus slice twenty-two (2026-10-12)

Ranks 1021-1120 of the uncited list (437,757 bytes, 5,231 down to 4,767), the sixth 100-rank band and the smallest in bytes so far, at 57.7% import text with 46 modules carrying content and fifty-four carrying nothing of their own. The small helper and hosted-adjacent layer: session and rename bookkeeping, plugin cache refresh, deep links, cloud containers and vitals, and the vendored AWS credential providers. It reads as sixteen modules with local counterparts, sixty with no characterising literal, fourteen hosted surfaces, three modules excluded with credentials or OAuth, two vendored AWS credential providers, two product surfaces without a local counterpart, two pure code leaves and one rule that guards a surface this runtime does not have.

No candidate of its own, and four modules extend families already open or ported: deny rules judged by the effect a command accomplishes rather than its spelling (the family the permission-readings package vetted), a deep-link path refused for parent-directory segments and for invisible or bidirectional characters (the W09/W10 vetting family, on a surface this runtime does not have), a published home file whose source was exchanged underneath it (the identity family W09 ported), and a peer file transfer whose path must stay inside its spool (containment again). One further module applies the adverse-on-doubt shape this runtime already uses: a local file that could not be examined requires a live human.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 1121 with about twelve bands left.

## Corpus slice twenty-one (2026-10-12)

Ranks 921-1020 of the uncited list (509,866 bytes, 6,309 down to 5,236), the fifth 100-rank band and the smallest modules yet, at 50.6% import text with 61 modules carrying content. It is command and tool surface work: the keybinding, brief, focus and goal commands, the scheduled-wakeup and loop tools, permission prompts and their wording, and the bridge and teleport paths. It reads as thirty-five modules with local counterparts, forty-three with no characterising literal of their own, sixteen hosted surfaces, two vendored packages, two product surfaces without a local counterpart and one module excluded with credentials.

The candidate is the bypass-permission guard, the sixth this review has recorded. The recovered client refuses bypass under root or sudo privileges outright, and separately records that a bypass consent accepted in the moment does not hold when user settings do not persist it. Verified locally before recording: `src/cli.ts` accepts `--permission-mode bypass`, `src/interactive.ts` documents `/permissions MODE`, `src/permissions.ts` returns `allow` for every call in that mode, and no privileged-uid check exists anywhere in `src/`, so neither half of the recovered rule is implemented on a surface this runtime owns. Three further modules extend families already open: a skill bundle extraction that refuses a path escaping its own directory, worktree and repository state that must be verified before use with submodules explicitly unverifiable, and diff warnings when a git command can move the working tree.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 1021 with about thirteen bands left.

## Corpus slice twenty (2026-10-12)

Ranks 821-920 of the uncited list (618,698 bytes, 7,391 down to 6,379), the fourth 100-rank band, at 48.4% import text with 62 modules carrying content, twelve of those only through state-name markers. This is the session-plumbing layer: cross-session messages and their holds, session naming and titles, subagent forks, connector-registry tools and the managed-settings gates that switch features off. It reads as twenty-three modules with local counterparts, fifty with no characterising literal of their own, eighteen hosted surfaces, four vendored packages, two modules excluded with OAuth or identity-provider login, one shipped skill text, one product surface without a local counterpart and one recovered UI module.

No candidate of its own, and two modules corroborate the slice nineteen candidate from a different subsystem: a code review is switched off when this machine's managed settings could not be read, and a tips file named by remote managed settings is ignored when it is a network path. Three further pointers: the peer-message wording marks the same data-not-user-instructions boundary this runtime states in its own words, cross-session message holds carry release, expiry and duplicate states, and a subagent fork carries a depth cap. The band also contains two near-duplicate pairs - an identity-provider login pair and a vendored fetch error pair - continuing the pattern earlier slices recorded.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 921 with about fourteen bands left.

## Corpus slice nineteen (2026-10-12)

Ranks 721-820 of the uncited list (772,295 bytes, 9,249 down to 7,411), the third 100-rank band, at 35.4% import text with 81 modules carrying content. This is the band where the client's plugin, daemon, bridge and agent-swarm plumbing sits: thirty modules with local counterparts, thirty-two with no literal of their own (nineteen with nothing at all, thirteen with state-name markers only), eighteen hosted surfaces, five recovered UI components, four vendored packages, three external surfaces, two modules excluded with OAuth, two product surfaces without a local counterpart, two shipped skill texts and one pure code leaf.

The candidate is plugin admission under managed settings. The recovered client seats a plugin outermost only when a managed settings source lists or enables it on this machine, refuses to seat one that managed `prependPlugins` does not list, and treats a managed settings source that was **not read whole** - a load error - as not vouching. Verified locally before recording: `src/config.ts` reads a single managed settings file and takes only `allowShell`, `permissions`, `features` and `mcpClient` from it, then admits plugins from `settings.plugins` by schema and discovery, with no rule that a managed source must vouch for a plugin and no treatment of a partially read managed source as unable to vouch. Two pointers into the Git family slice fifteen opened: a repository git config that could not be read in full or carries a conditional include must be reported rather than used, and Git directory entries are classified (alternates, a linked worktree, a handler that leads nowhere).

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 821 with about fifteen bands left.

## Corpus slice eighteen (2026-10-12)

Ranks 621-720 of the uncited list (1,027,709 bytes, 12,645 down to 9,254), the second 100-rank band, and the shape reverses at the same width: only 21.0% of it is import text and 93 of the 100 modules carry readable content, against 60 aggregators in slice seventeen, so the aggregator share is a property of a band rather than a trend. Several of these modules are mechanisms this session itself runs - the goal proposal, the `/goal` command text, the loop skill's own prompt bundle, the subagent hand-back text and the cross-session inbound gate.

The band reads as 48 modules with local counterparts, 23 hosted surfaces (artifact database reads and publish pins, bridge peer listing, staged cloud MCP calls, the agent proxy token handoff, browser native messaging, computer use, the model catalog with its pinned-key verification, artifact comment-reply handoff, remote workspace diffs, Vertex probing, SDK-hosted session delivery, trusted devices, the gateway's load-test mode, the remote session view, admin-pinned configuration and policy acceptance), 8 vendored packages, 6 modules excluded with credentials or OAuth, 3 shipped skill or product texts, 3 product surfaces without a local counterpart, 1 recovered UI module and 8 with no characterising literal.

No candidate of its own, and four pointers into work already open or ported: the plugin copy integrity rule (a source swapped for a non-regular file mid-copy, an in-place write refused because the target has another name, the original target restored) extends the write-path candidate slice fourteen recorded; the file identity checks that run after a path check extend the family W09 ported; the permission modules that state concrete rule bounds and that fail closed when a check cannot run extend the family the permission-readings package vetted; and the three shipped skill texts are the embedded text this project ports as skill content rather than runtime logic.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 721 with about sixteen bands left.

## Corpus slice seventeen (2026-10-12)

Ranks 521-620 of the uncited list (1,332,357 bytes, 14,575 down to 12,761), the first band read at 100 ranks rather than 50, a method decision recorded with the slice: slice sixteen showed that most of a 50-module band is mechanical to dispose - one import-share measurement and one literal scan per module, verifiable from the ledger - while the readable modules are as deep as before, so doubling the band keeps the depth of reading and halves the number of passes. Sixty of the hundred modules are dependency aggregators (58 at 95% or more import statements, two carrying a single one-word marker) and the band is 70.1% import text, so 40 modules carry its readable content.

Those forty are twenty modules with local counterparts (syntax highlighting with a per-grammar work bound, skills under safe mode, session stop semantics, working-directory addition, MCP task-worker wake scheduling, plugin auto-update policy, hook editing validation, daemon scheduled tasks, external terminal launch, cd bookkeeping with a stale-environment notice, tool result persistence, git URL guards, the inflate error surface, the project-instruction loader, sensitive-value redaction, a helper's integrity and interpreter check, the read-before-edit precondition, Windows path guards, file identity by serial and Git submodule state inspection), thirteen hosted surfaces (plugin directory, fast-mode credit accounting, self-hosted runner administration, promotional offers, cloud transcripts and device-attached hooks, design-system reads, managed-agent task start, IDE integration, hook forwarding, hosted skill MCP loading, guest passes, artifact decisions), two vendored AWS packages, two modules excluded with credentials (device keys, and login with trusted-device re-enrolment), one product surface without a local counterpart (an onboarding survey) and one recovered UI component.

The band records no candidate of its own, and two of its modules point into work already open: the Git submodule state inspection extends the Git-directory candidate slice fifteen recorded, and the file-serial identity checks extend the identity family W09 ported. Two further pointers: the git URL guard applies the W09/W10 vetting family to a URL rather than a path, and the project-instruction loader is the one whose imports W10 vets, so the loader itself is this runtime's own.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 621 with about seventeen bands left.

## Corpus slice sixteen (2026-10-12)

Ranks 471-520 of the uncited list (749,472 bytes, 15,467 down to 14,608), continuing directly below slice fifteen's boundary. This is the thinnest band the review has read: 77.2% of it is import text, 39 of the 50 modules are 85% or more import statements, and 34 carry no characterising literal of their own, so only sixteen modules say anything at all. Those sixteen are eight modules with local counterparts (a subtask command, workflow launch status, plugin and skill re-discovery after trust, cross-session and agent listing, permission deny context, the hook event catalogue, settings seeding, and managed-settings source labels), four hosted surfaces (the live preview tunnel with its liveness policy, the Remote Control bridge, artifact read refusals and the cloud review), one product surface without a local counterpart (fast mode gating), one vendored AWS SDK SSO client and one module excluded with credentials.

The band's candidate is the memory rule set. The recovered client reaches an explicit contradiction verdict between a remembered fact and an instruction file - asking which of the two is current - and runs a consolidation pass over the memory store that skips a newer record and an unreadable item by name. The local statement of coverage: `src/memory.ts` and `src/auto-memory.ts` already merge duplicate facts on write, carry a hash-conflict read-again path, and state that current user instructions take precedence over remembered preferences, so precedence is covered while the contradiction verdict and the consolidation pass are not. Two pointers rather than work: settings seeding across the config layers with a seed-absence record, adjacent to the layer mechanism the policy-helper package ported, and the deny-context rule, which this runtime's own permission decisions express differently.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 521 with about thirty-five bands left.

## Corpus slice fifteen (2026-10-12)

Ranks 421-470 of the uncited list (803,148 bytes, 16,542 down to 15,478), continuing directly below slice fourteen's boundary and using the extraction rule that slice recorded. Eighteen dependency aggregators, sixteen modules with local counterparts, twelve hosted surfaces (a remote-session-only command, the browser extension tool set and its enablement request, subscription quota auto-resume, the bridge tool-host helper, cloud queued notifications, the send-file hand-off, the session tunnel, the artifact database tool, organization-policy usage attribution and artifact file reads), one product surface without a local counterpart (an end-conversation tool), one recovered welcome screen, one module excluded with credentials and one candidate. The candidate is entry-level vetting of a Git directory - an unknown `.git` entry, a symlinked or hardlinked `.git/index`, a `.git` without `config` or `HEAD`, and a symlinked or oversized `.git/objects` entry are each refused - and the honest statement of local coverage is that the worktree code verifies the registration identity it created (device and inode, the resolved Git directory and its backlink, the common directory) while structure is never inspected. One pointer rather than work: the path and link vetting family appears a third time, now for plugin eval paths with automounter and network-reachability refusals, the strongest corroboration yet that it is a repeated invariant of the recovered client.

The import-list trend recorded with slice fourteen deepens here: 62.5% of this band is import text and eighteen of its fifty modules carry no characterising literal of their own, so most of a band's byte mass is its dependency list and the remaining logic is what a pass reads.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 471 with about thirty-six bands left.

## Corpus slice fourteen (2026-10-12)

Ranks 371-420 of the uncited list (858,355 bytes, 17,837 down to 16,545), continuing directly below slice thirteen's boundary. Sixteen dependency aggregators, sixteen modules with local counterparts, ten hosted surfaces (device MCP consent in a cloud session, the desktop app entry, artifact authorship notes, a remote frame tunnel under an organization network policy, managed remote mounts, hosted privacy settings, durable artifact triggers, Remote Control policy gates, telemetry to a named hosted intake and turn relay/handoff bookkeeping), four product surfaces without a local counterpart (feedback drafts, issue drafting, HTML preview generation and a session recap command), one recovered UI panel, one vendored copy of the AWS auth scheme provider, one module excluded with credentials, and one candidate: the file write path's post-write size verification together with a fallback that preserves content at a temp path when the in-place write fails, which is a rule about a surface this runtime owns - it writes and edits files in place and verifies none of it afterwards. Two adjacent findings stay pointers rather than candidates: the link-vetting rule set appears a second time in this band applied to plugin command sources, which corroborates the family the link-vetting package ported, and the hosted settings review store sits on top of the config source layers the policy-helper package ported while its staging half needs a proposal surface this runtime does not have.

This band also corrected the review's own extraction method, and that correction is the more transferable result. The recovered modules are minified onto effectively one line, so skipping the `/$bunfs/root/chunk-*.js` dependency list line by line discarded the entire body of any module whose dependency list shared that line and reported it as a module with no literals at all. Skipping the list per match instead showed that 28 of these 50 modules are 80% or more import statements - one is 99.9% - and that the band is 57.7% import text, so at this depth rank by size measures the dependency list rather than the logic, and a large uncited module is no longer evidence of a large unreviewed subsystem. Both notes are recorded with the slice.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, the regenerated ledger keeps the digests `feac2940…` and `4dc6ca75…`, and the review continues at rank 421 with about thirty-seven bands left.

## Corpus slice thirteen (2026-10-12)

Ranks 321-370 of the uncited list (940,949 bytes, 19,629 down to 17,899), continuing directly below slice twelve's boundary. It is the runtime's own plumbing again: twenty-five modules with local counterparts, nine pure code leaves, seven hosted surfaces (artifact permission prompts, cloud session setup, browser tools, live replication, container plugin directories, billing and artifact probing), four recovered UI components, three vendored or polyfill modules (an HTML sanitizer, a second copy of the AWS auth scheme provider and a timing polyfill), one product surface without a local counterpart (a stored deep-link preference with an issue link) and one rule that guards a surface this runtime does not have: a URL scheme allowlist refusing `javascript:`, `data:` and `vbscript:`, which no tool here can reach because nothing takes a URL from the model. It is the closest thing to a candidate in the band and it is not one. Also worth recording for later passes: this band contains a near-duplicate pair, two modules that share almost the same MCP task metadata literals, the first such pair the review has found.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, and the review continues at rank 371 with about thirty-eight bands left.

## Corpus slice twelve (2026-10-12)

The first 50-rank band, on ranks 271-320 of the uncited list (1,045,813 bytes, 21,613 down to 19,670), continuing directly below slice eleven's boundary with the widened width recorded with slice eleven. It is dominated by things this runtime already owns: twenty-three modules with local counterparts, eleven pure code leaves with no characterising literal, seven product surfaces without a local counterpart (voice transcription, the installer path, IDE command listing, tips panels, consent telemetry, the plugin-and-CLI source dialog and upload chunking limits), five hosted surfaces, two vendored libraries (the AWS SDK auth scheme provider and ajv) and two excluded with credentials. No candidate is recorded, and two modules are named as near misses rather than work: one opens its output directory with `O_NOFOLLOW` and caps at 8 MiB and 5 GiB, which is this runtime's own family of rules against a different output surface, and one states what a session is told when something would stay on the machine, which this runtime states in its own words. The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked, and the review continues at rank 321 with about thirty-nine bands left.

## Corpus slice eleven (2026-10-12)

An eleventh slice covered ranks 246-270 of the uncited list (556,327 bytes, 23,195 down to 21,646), continuing directly below slice ten's boundary. It is mostly plumbing and copies of what this runtime already does: thirteen modules whose surfaces exist here (a CLI runner, resume, the interactive exit flow, settings fields, settings validation, plugin entry paths, message preprocessing, a debug logger, attachment rendering, id routing, skill loading, a value helper and the message list), two vendored libraries (graceful-fs and the AWS SDK's STS client), three hosted or vendor surfaces (remote environments, billing and the desktop download), two excluded with authentication (session credential state and secure storage), two product surfaces with no local counterpart (the auto-updater's state file and the recovered workflow-authoring guidance, which is prompt text) and three pure code leaves recorded as undetermined. No candidate is recorded.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked. One method decision is recorded with this slice and applies from slice twelve: bands widen from 25 to 50 ranks. Eleven bands have shown that the per-module work is identical at either width, every module in a band still gets its own literal evidence and disposition, bands stay contiguous, and halving the number of remaining passes matters more than keeping the width uniform with the earlier slices. The review continues at rank 271 with about forty bands left.

## Corpus slice ten (2026-10-12)

A tenth slice covered ranks 221-245 of the uncited list (594,435 bytes, 24,699 down to 23,207), continuing directly below slice nine's boundary, and it is the thinnest band so far: ten modules whose surfaces this runtime already owns (the memory directory, a download writer, teammate messaging, a subprocess helper, MCP status labels, environment and path configuration, runtime detection, a file watcher, tool-source filtering and a text transform), three vendored or utility modules (an invisible-character stripper, a Markdown lexer and type-inspection helpers), four recovered UI components, two prompt texts, two modules with no local counterpart (a sibling-chunk path helper for the bundled layout, which is a property of the recoverable artifact rather than of a product surface, and a daemon peer-uid check on a control socket this runtime does not serve), two excluded with authentication and two pure code leaves that carry no literal of sixteen characters or more and are recorded as undetermined rather than guessed at. No candidate is recorded.

The reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked and the review continues at rank 246. At 25 modules per band and roughly 2267 uncited modules in the set, this review is a long series rather than a package: about eighty more bands at the current rate, each independent and each adding characterisation rather than port evidence. That is stated in CURRENT so the remaining work is not mistaken for a short tail.

## Corpus slice nine (2026-10-12)

A ninth slice covered ranks 196-220 of the uncited list (660,212 bytes, 28,085 down to 24,699), continuing directly below slice eight's boundary. It is the permission, plugin and session-lifecycle band: eleven hosted, vendor or server-dependent surfaces (unix-domain late binding, browser and IDE capability flags, the teleport and device-enrollment dialog registry, a connectivity probe, brief image scaling, credential setup, browser automation, cloud review, a `gh` scope probe, organization plugin search and Bedrock credential setup), eleven modules whose surfaces this runtime already owns (the notification contract, directory tracking, MCP configuration, permission-rule rendering, a temp and symlink helper, tool-approval change tracking, workspace command running, the workflow dialog, coordinator-and-member relay formatting, settings resolution and provider model-id mapping), one vendored Markdown and HTML renderer and two recovered product surfaces with no local counterpart: a refusal of a marketplace name that looks like one of Anthropic's, and terminal recording management.

No candidate is recorded, and the impersonation refusal is the only rule in the band that would have been worth reusing: this runtime has no marketplace whose name could impersonate anything. As with slice eight, the reviewed modules are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), which is not a citation source for the ledger, so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked and the review continues at rank 221.

## Corpus slice eight (2026-10-12)

An eighth slice covered ranks 171-195 of the uncited list (735,478 bytes, 31,115 down to 28,168), continuing directly below slice seven's boundary. It is largely this runtime's own subject matter seen from the inside: thirteen modules whose surfaces already exist here (context accounting, MCP call transport with a TTL, execution-environment detection, terminal capability detection, the ask-the-user contract, cache thresholds, permission-mode availability, Windows-shaped path classification, MCP identity changes, a string and escape scanner, thinking status, a bundled research workflow and hosted git-URL validation), three recovered UI panels, two rendering and data tables (the terminal diagram renderer and the asset MIME map) and seven hosted or server-dependent surfaces (Remote Control, the design-system service, synced-file request signing, the device bridge, feature eligibility gating, the self-hosted runner and the SDK-host bridge).

No candidate is recorded. Two modules are pointers rather than work: one is a bundled research workflow, which shows what the recovered workflow surface was used for rather than how it works, and another is a member of the Windows path-classification family whose `kzn` rules W09 declined because this host makes them unreachable. To avoid counting reviewed-but-unported modules as cited, this slice names them only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md), which is not a citation source for the ledger, so the totals stay at 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked and the review continues at rank 196.

## Corpus slice seven (2026-10-12)

A seventh slice covered ranks 146-170 of the uncited list (845,223 bytes, 36,014 down to 31,722), continuing directly below slice six's boundary. It splits between product UI and the SDK's own plumbing: six hosted or server-dependent surfaces (the browser-control tool, moving a session to the cloud, the self-hosted release surface, cloud autofix, the unattended cloud responder, and a private config writer excluded as credential-adjacent), thirteen modules whose surfaces this runtime already owns (the teammate launcher, poll-event validation, the sandbox panel, served-image re-encoding, model and effort selection, diagnostics, effort caps, two path helpers, read-size thresholds, the skills panel, task observers and HTTP plumbing), two recovered CLI and copy surfaces, one vendored INI parser, one generated model catalog, and one pure code leaf with no literal of eight characters or more in 33,064 characters of body, recorded as undetermined rather than guessed at.

No candidate is recorded. One module is worth naming for a different reason: `chunk-patq2z05.js` is the ancestry-aware path resolver, which is where the `launchAncestry` and `unreadableAncestry` options W09 deliberately did not port come from - this runtime has no launch context to adopt a path into. Naming it here, and naming slice six's two reusable-but-surface-less modules, moves three modules out of the uncited set and into the prose count without adding port evidence, which is why the ledger now reads 33 backed / 65 narrative-only / 2267 uncited / 2217 unmarked. See [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md).

## Corpus slice six (2026-10-12)

A sixth slice covered ranks 121-145 of the uncited list (962,864 bytes, 40,582 down to 36,019), continuing directly below slice five's boundary. It is the control-protocol and product-UI band: fifteen hosted or server-dependent surfaces (the browser-extension bridge, the MCPB installer, the plugin CLI, artifact comments, connector import, URL-credential policy, Remote Control notices, cloud routines, page publishing, the model switch, the artifact database, git credential brokering, Ultrareview, Remote Control servers and unix-domain peer messaging), three vendored libraries (msgpack, commander, and the Unicode confusable and invisible-character tables), one recovered usage-limit dialog, five modules whose surfaces this runtime already owns (the tool-host schema and error layer, the interactive action registry, the image cache, the slug and frontmatter helpers, and the permission glob compiler) and one that reads images without keeping a cache. No module in the band carries a marker and none imports a sibling chunk by name.

No candidate is recorded from this slice, and the reason is worth stating because two modules look reusable at first: `chunk-2kdsvp3x.js` validates MCPB zip entries against path traversal, declared size and a compression ratio, and `chunk-bt8cr7rw.js` verifies a unix-domain peer's launch ancestry with a start token. Both are rules this runtime would want if it had the surface, and it has neither a bundle ingestion path nor a unix-domain peer, so porting either would mean building the surface first. The remainder after six slices is 2217 uncited modules with no marker. See [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md).

## Corpus slice five and the include link vetting candidate (2026-10-12)

A fifth slice covered ranks 96-120 of the uncited list (1,119,349 bytes, 47,719 down to 41,435), continuing directly below slice four's boundary. It is the most external band of the five: eleven hosted or server-dependent surfaces (a cloud session's git environment, Remote Control, artifacts and their REPL, the control protocol, the self-hosted runner, cloud plugins, login and gateway auth, the git proxy, and remote settings), four recovered UI panels, two vendored libraries, two product distribution and compliance modules, one MCP tool annex, one settings-review surface, one worktree-registration vetting surface and two with local counterparts. No module in the band is port-backed by this pass; recording one here is not port evidence.

One in-scope candidate is recorded. `chunk-pn44qc66.js` (45,078 bytes) decides which local settings, instruction and agent-memory files are safe to hand to a cloud session, and its purpose is external, but the vetting it applies is a rule set this runtime can use because it reads the same class of files locally. The rules are `link chain too long to vet` and `too_many_links` along `EMLINK`/`ENAMETOOLONG`, `link body is not valid UTF-8`, `link body climbs out of a directory it entered`, `hard_link`, `alias_unreadable`, `home_unvettable`, `outside_root`, `not_regular_file` and `symlink_not_sent`. `src/config.ts` resolves `@file.md` instruction imports and de-duplicates by `realpath`, so an import whose link chain leaves the directory the import walked into is read like any other, a chain of any length is followed, and the body's encoding is not checked before it is treated as instructions. That is the W09 resolver's family one layer up, at the include rather than at the tool, and it was carried in CURRENT as W10; [W10](ports/W10-include-link-vetting.md) has since ported three of those rules and is recorded below. The remainder after five slices is unchanged at 2220 uncited modules with no marker at that point; slice six moved two of its reviewed modules (the MCPB validator and the unix-domain ancestry check) into the prose count by naming them here, and slice seven moved a third, which is why this file's later section reads 2217. See [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md).

## Instruction imports vetted through their link chain (2026-10-12)

An instruction file is read as instructions, so a link on the way to one decides what a session is told. This runtime resolved each `@file.md` import and de-duplicated it by realpath, which normalizes away the one property the recovered client checks for: a link body that enters a directory and then climbs back out of it. The recovered vetting is `async function On(e)` in `chunk-pn44qc66.js`, bounded by a local `Un=32` and driven by three text-level rules - a body that is not valid UTF-8 ([11462, ...)), a body that climbs out of a directory it entered ([11603, ...), the predicate itself being `$n` [12206, ...)), and a chain past the bound ([11808, ...)) - over a separator set `Tn` [9802, ...) that counts both separators only on the backslash platform.

This package ports those three rules and leaves the rest of the function where it belongs. `vetLinkChain` refuses `not-utf8`, `climbs-out`, `cycle` and `too-long`; `config.ts` calls it before reading any instruction file, in the nested-import reader, the root-file reader and `loadPathInstructions`' `visit`, and a refusal arrives as a `ConfigError` on the tool call that triggered the load rather than as a startup failure. The recovered walk returns `false` on a repeated state so its caller can count a chain it will not send, and this runtime has no such caller, so a repeat is refused by name as a cycle; the encoding rule is a fatal decode of the raw body rather than a replacement-character test on decoded text; and both separators count everywhere, so a body that is only a path on another platform is not a path here. The `true`/`false` send verdict and the counters the caller fills from it (`symlink_not_sent`, `too_many_links`), along with `home_unvettable` and `outside_root`, are verdicts about a cloud handoff and are not ported. Verified by five unit cases and a real-CLI smoke (`npm run smoke:link-vetting-cli`, source and compiled) in which the control reads an import reached through a link inside its own directory and the imported text reaches the second request, while the same import through a link that climbs fails the read with "climbs out of a directory it entered" and never reaches a request. Full suite 1075/1075; identity 118/86/59 files, merged e4b6b8eb…, reproduced by an independent offline rebuild. Provenance in [ports/W10-include-link-vetting.md](ports/W10-include-link-vetting.md).

## Bounded path link chains with an identity (2026-10-12)

A workspace path is not one string to the filesystem: every symlink on the way to the target is a hop the kernel takes on the caller's behalf, and this runtime followed each segment with its own `realpath` call, so the chain was resolved but never counted, never diagnosed, and never tied to the bytes that were then read. The recovered client resolves the chain itself. `function*He` in `chunk-gyf58rwf.js` walks a resolved prefix and carries the remaining segments as text, re-splitting a link's target onto the remainder, under a local bound `m=64`; a chain past the bound is refused through a factory that builds `ELOOP: symbolic link chain too long to vet`, a repeated link-plus-remainder state returns without resolving, `Un` decides whether an unreadable ancestor may count as verified, `kzn` rejects text that cannot be trusted as written, and `Spt="ERR_SYMLINK_TO_NETWORK_PATH"` names what a chain that surfaces a network path earns. The two entry points also return the hops followed, the end state, and a `dev`/`ino`/`ctimeNs` identity, with `noFileSeen` when only a link was ever observed.

This package ports the walk onto this runtime's own path model. The 64-hop bound is kept, deliberately different from the kernel's own limit so a chain between the two is refused here by name. A loop is refused with the same code rather than falling back to a direct realpath, because that fallback serves an unreadable-ancestry policy this runtime does not have. The unreadable-ancestor verdict is a refusal rather than a marker, and network landings are refused by reading the landing path's filesystem type, since the recovered predicates live in an imported module and cover Windows device and UNC forms. The identity is the recovered triple with the byte length added, checked against the open handle for a read and against a re-stat before an overwrite. The Windows path forms apply only on Windows; the `launchAncestry`, `surfaceNetworkRaw`, `unreadableAncestry` and `literalLinkText` switches, the `openDirNoFollow` fallback, the `/dev/fd` special case and the internal sentinel protocol are not ported. Every existing refusal keeps its message, so an escaping link still reports that it escapes the workspace and the reserved `.agent` directory is still refused lexically and after resolution. Verified by eight unit cases and a real-CLI smoke (`npm run smoke:path-chain-cli`, source and compiled) where a three-link chain reads its target, a seventy-one-hop chain fails with "too long to vet" without its target content reaching the result, and an escaping link fails with "escapes the workspace" without the outside content reaching it. One regression appeared during the port and was fixed: the read stream was built with autoClose disabled and its descriptor was then closed in the same `finally`, so it was double-closed and surfaced as EBADF in the read and session-storage suites. Full suite 1070/1070; identity 116/85/58 files, merged 117588b2…, reproduced by an independent offline rebuild. Provenance in [ports/W09-path-chain.md](ports/W09-path-chain.md).

## Managed settings helper with local governance tiers (2026-10-12)

A managed-settings helper reads policy from outside the workspace, so its input can change under a session, disappear, or go bad between reads. The recovered client wraps it in three tiers: while the helper is healthy its output governs; a failed refresh applies a static default payload when one exists and otherwise keeps the last successful output; and a structurally invalid document is not a failure to fall back from at all but is refused. The tiers live in one closure in `chunk-x0dc37w9.js` (`refresh_fell_back_to_default` [56766,...), `refresh_failed` and the recovery notice [57556,...), `serving="helper"` [57600,...)), the read mechanisms are declared as `$n=new Set(["plist","hklm","file"])` [57936,57966), structural validity is decided by `Kn` [58702,58830) and classified by `vEo` [58830,59016) against the platform list `LB=["macos","linux","windows","wsl"]` (chunk-3cynezh1.js [201689,201727)), and the remote branch `Gn` [58176,58557) is what decides whether a refusal is enforced when the command starts no session.

This package ports the tiers, not the mechanisms. `--policy-helper` opts in, optionally with `--policy-helper-interval`; the static default payload is the session's own managed policy, which is what `--managed-settings` already supplies, so the existing once-read path keeps its fatal semantics and a session without the flag is unchanged. A helper document that is unreadable, missing or not JSON is `helper_failed` and may be replaced by another tier; one that parses but is not a usable managed policy is `policy_invalid` and is refused, leaving the governing tier and its policy alone. Warnings fire once per transition, a refresh error is reported rather than ending the session, and the timer is unref'd and cleared on abort. The `plist` and `hklm` mechanisms, the per-platform tiers and remote consent with its refusal enforcement are not ported: they need a macOS system domain, the Windows registry or an external service, so they are External here. Verified by four unit cases and a real-CLI smoke (`npm run smoke:policy-helper-cli`, source and compiled) in which the same flags deny a write under the default tier when no document exists, allow it when a valid document governs, and keep it denied when the document is refused. Full suite 1062/1062; identity 114/84/57 files, merged 43cd0aeb…, reproduced by an independent offline rebuild. Provenance in [ports/W08-policy-helper.md](ports/W08-policy-helper.md).

## Slice four's three candidates disposed (2026-10-12)

The reading pass' closing disposition table carried nine candidates, and slice four had recorded three more of its own that no section had settled: auto-mode environment gathering, the foreign-config import, and the plugin marketplace CLI. All three were read whole on 2026-10-12, and all three turned out to be something other than the label, in the same way slice three's redaction reading turned out to be a credential table and a path resolver.

The first is the auto-mode environment pre-gather and the rule report it hands the classifier: a home-directory repository walk behind a cache-and-vendor skip list with `visit-budget` and `repo-cap` bounds and `home-unreadable`/`network-home` verdicts, `gh` visibility probes that drop `GH_TOKEN` from the environment first, and a classifier (`Ut`) that judges whether a command or a permission rule's content is destructive or credential-shaped - whose only consumer reads the project's `permissions.allow` list out of the auto-mode configuration and reports on it. The second copies commands, skills, agents, themes, monitors and workflows out of a `.codex/`, `.cursor/` or `.gemini/` directory into this client's config tree, marking each import so a later run does not append twice, refusing a source or target under a symbolic link, bounding its link walk at 40 hops, and warning about shell blocks whose `!` marker, backticked argument or `{{args}}` placeholder could assemble an executing command. The third is the plugin and marketplace command line: `plugin init`, `plugin validate` and `plugin tag`, plus the marketplace add and update flow, where an add can be refused by policy.

All three are reclassified `ruleWithoutLocalSurface`: this runtime has no auto mode, no classifier, no environment pre-gather and no surface that reports its own permission rules; no foreign configuration to import; and no plugin command line or marketplace client. The halves that would have had a home already belong to open families - a command's destructive meaning to W01's family, as slice twenty-seven recorded for the shell allow rules' dangerous-prefix notion; a credential-shaped name to W14's and W19's family; the bounded link-chain walk to W09's and W10's; shell-block marker and argument-substitution safety to W06's; and the manifest check already holds here in a stronger form, as a load-time strict schema refusal rather than a warning. The three are named only in [ports/unreviewed-corpus.md](ports/unreviewed-corpus.md) and its evidence file, both of which the ledger excludes from its citation scan, so the totals stay at 43 backed / 64 narrative-only / 2258 uncited and the digests `9a5e31b3…` and `6034bd4b…` are unchanged.

Nine further modules carry the word "candidate" in an early slice's disposition column without ever being named as one, and the review's closing claim that no recorded candidate stands open did not cover them. They are settled in a new section of the same file: one is provenance only (the MCP protocol SDK surface slice one recorded for a later record revision), two are reclassified `ruleWithoutLocalSurface` (the plugin install/update/uninstall surface with its marketplace policy blocks, and the safety-check classifier's ask reasons for served commands), and the rest belong to open families or to surfaces this runtime does not have - MCP server approval wording that W12 already ported, a hosted artifact surface, the background daemon and worktree-removal surface, remote-io and the carried-Writes capability - with one design difference (this runtime grants `acceptEdits` by tool and never auto-approves a shell command by analysing it) and one workflow contract already stated here (the run-time restrictions a workflow script carries). **No port package results from any of the nine**, and they are named only in the corpus file and its evidence file, so the counts and digests above are unchanged by them too.

## Historical ports and behavioural contracts reviewed (2026-10-12)

W02 recorded that the earlier whole-project ports remained unreviewed, and that no copied-source percentage was claimed. The tool surface is the enumerable part of it, so the review takes `research/FEATURES.md`'s registered tool source inventory - its object names, modules and ranges, quoted unmodified - and resolves every row on both sides: the source module against `research-module-index-v4.json`, and the local side by finding the tool declaration that carries that role, with the local file's digest recomputed from disk.

Nineteen rows cover the inventory. Thirteen resolve on both sides: the read/write/edit family, glob/grep/notebook, web fetch with MCP search and refresh, plan submission and asking, the four task tools, LSP and findings, the two worktree tools, monitor, the three cron tools, wakeup with notifications and MCP refresh, and the three memory tools. Three are partial: the skill surface is invoked by name and declares no tool object, `TodoWrite` has none, and neither the workflow poll nor the remote trigger does. Two record a local surface without a tool object (plan mode is a mode switch, and the agent registry has no listing tool), and one - peer-to-peer send - has no counterpart at all. Where the products differ the row says so instead of forcing a correspondence.

Two limits are recorded with it: no copied-source percentage is claimed, and no classification in the historical reports is restated or upgraded by this pass. The same treatment covers the four focused behavioural contracts FEATURES records in prose - the original task storage, agent launch, the monitor transport, and the MCP selector that chooses between its two protocol shapes - and all four bind on both sides (durable uuid storage with dependency edges and projections; subagent type, effort and worktree isolation with the fork start kind; command and WebSocket jobs; protocol-version negotiation with the standard-tasks gate). They are written as an evidence file rather than a `research/ports/*.md` record because the ledger counts every module a record there names as port-backed, and this is an identity review rather than a port - so the totals stay at 43 backed / 64 narrative-only / 2258 uncited and the digests `9a5e31b3…` and `6034bd4b…` are unchanged, verified by regenerating the ledger. Detail: [ports/historical-ports-review-evidence.json](ports/historical-ports-review-evidence.json).

## Stale current-state wording corrected (2026-10-12)

Two status lines still said the management surface was unverified after W25 had
read it: the FEATURES gateway row and the top of W03-live both listed "route
mutation" as an unverified thing, and W03-launcher's tail did the same. The
gateway serves a session's route as a GET-only per-session value, so route
switching is not a management write there at all, and credential issuance lives
in the application's own caller-key API rather than on the gateway port. All
three now say that, and name the two things that really are unexercised - the
application cold start and credential issuance through the application - as the
user's action.

Three smaller corrections came with it. W03-launcher's package figures (57 files
from 178 source, 50-module rebuild) are landing-time values and now say so;
`remaining-dispositions` carried the ledger's tier counts as present tense
(25 port-backed / 57 narrative / 2283 uncited at 33.4 MB) and now gives those as
landing-time figures beside the current 43 / 64 / 2258 at 29.4 MB; and the two
evidence files nothing linked - `W03-launcher-evidence.json` and
`remaining-dispositions-evidence.json` - are now linked from their own records,
so all 39 files under `research/ports/` that end in `-evidence.json` have an
inbound link.

The same pass reached the W05 family's landing-time gap lists. Five records
(W05-persistence's closing paragraph and the `Remaining:` line in the recovery,
tasks, get-task-inputs and durable-tasks records) named items that later W05
packages went on to close - startup degradation and the slow reconnect rounds,
the standard task/result protocol, durable reattachment, stdio re-dial, audio
input, and the parked refetch and automatic next-turn scheduling that
`remaining-dispositions.md` decides. Each now says which of its own list has
since landed and leaves the genuinely open part standing: lost-event replay, the
task receiver/list/progress/outputSchema surface, URL elicitation, external
receiver retention, real remote service equivalence and the `subscriptions/listen`
parked refetch. No package's original run record was rewritten.

Two records from the gateway packages carried the same kind of landing-time
claim about paid upstream. W01's blockers line and its remaining line said real
Magpie/paid upstream were `not_run`, and W02 said the management/rotation route
was `not_run`; both are true of those packages but read as current. W01 now
records that the real gateway path was exercised later, by W03-live's approved
acceptance with its two paid Messages requests, and W02 records that the
management and rotation question was settled without a write at all - a GET-only
per-session route, no credential route on the port.

Documentation only: no product source, test or build input changed, so the suite
was not re-run and the ledger is byte-identical (`9a5e31b3…` JSON, `6034bd4b…`
markdown, 43 reviewed of 2365). The 255 local links across `research/` all
resolve.

## URL elicitation and the completion notice (2026-10-12)

The MCP client's own limits said "no URL elicitation", and both FEATURES rows
listed URL elicitation as a gap. The recovered client serves two request members
from one `elicitation/create`: the form, and a URL member carrying a message, an
`elicitationId` and a URL, whose answer collects nothing. Completion is a second
notification with its own parameter, which the recovered host forwards to the
session as a notice.

The port keeps the union rather than a mode flag, so reading a form's
`requestedSchema` now requires narrowing on the mode; the capability object
becomes `{form:{},url:{}}`; both hook payloads carry `mode`, and URL mode also
carries `url` and `elicitation_id`. Three rewrites are deliberate and recorded:
a URL is refused if it holds control characters (this terminal prints the URL
for the person to open rather than handing it to a window), an `elicitationId`
must be non-empty (otherwise a later notice cannot be correlated), and URL mode
accepts no result content (the recovered result schema is mode-independent, but
this runtime's result is a schema-checked object map with no schema to check
against).

Running the form smoke to validate the port showed it had stopped exercising
anything: its fixture server was declared in the checkout's own
`.harness/settings.json`, which the project-declared-server admission holds
unconnected until a person answers, so the CLI never contacted it. The
pre-change driver fails the same way on the previous commit, so nine drivers had
been inert since that package landed; all nine now declare the fixture server in
the user layer, which is configuration, leaving permissions, features, hooks and
`mcpClient` where they were. Every one passes again in source and compiled form,
and the driver that tests the decision itself is untouched.

Suite 1119/1119; package 70 files with 0 upstream requests; identity 123 input /
90 validation / 63 build, merged `06d67404…`. Detail and coordinates:
ports/W27-url-elicitation.md.

## Progress tokens and the tool-call idle deadline (2026-10-12)

A tool call that asks for progress now carries one minted token in its `_meta`,
and each `notifications/progress` naming that token is routed back to the call
that owns it: it moves that call's idle deadline and is reported to a host
observer, while the call's total deadline keeps running and ends it regardless.
The idle deadline defaults to the request deadline, so nothing changes for a
host that sets no `toolIdleTimeoutMs`. A notification naming an unknown, absent
or malformed token is dropped rather than raised, because a late report must not
count towards this runtime's transport-failure threshold, and a token over 128
bytes or a message over 4096 bytes is inert before it reaches any handler.

The recovered host asks the bundled client for exactly this
(`resetTimeoutOnProgress:!0` with an idle timeout and a `maxTotalTimeout`, and an
inert `onprogress`), and the client mints the token only for a call that passed a
progress handler. This runtime's own transports had neither the token nor the
per-call deadline, so both were ported; the port keeps the update instead of
discarding it, so a host can render it. The recovered host's other half - a
caller's `_meta.progressToken` as the destination for a streamed command, with a
30-second heartbeat emitter - has no local surface and is recorded as such: this
runtime's `monitor` streams its lines into a bounded queue read with
`read_notifications`, so no call can be refused for lacking an output
destination. Landing the package also exposed a defect it had to fix: the HTTP
transport rebuilds its settings from a fixed field list, so a new option that is
not written into that list is silently dropped.

Suite 1127/1127; package 71 files with 0 upstream requests; identity 124 input /
91 validation / 64 build, merged `068753af…`. Detail and coordinates:
ports/W28-progress-tokens.md.

## Lost-event replay and subscription reconciliation, disposed (2026-10-12)

The one named behavioural gap left without a recorded decision was lost-event
replay for resource subscriptions. It now has one. A resource update in the
recovered protocol is a bare notification carrying a URI and nothing else, and
the recovered client's answer to a dropped stream is to re-listen: the re-listen
response is a change report (three list-changed flags plus the server's own
subscription set) and the client re-runs the refetch for each list the server
reports as changed. Nothing in the sample buffers, re-sends, or asks a server to
re-announce a single update, and the specification defines no such request.

So an update lost while the stream is down is stale-known in this runtime, and
the resume paths it does ship are the recovered equivalents it can honour: the
event-id GET stream, a catalog refresh before a replacement is adopted, and the
immediate refetch on the notification itself. The second half of the same
response - a server declaring which URIs it considers subscribed - is disposed
as no transport basis, and deliberately not followed even where it could be: a
journaled restart makes the client's own acknowledged desire authoritative and
requires a candidate transport to satisfy it before adoption, so a server cannot
widen or shrink the set by asserting it.

No product source, test, or build input changed, so the suite and package
identity above still hold. Detail and coordinates: ports/remaining-dispositions.md
items 7 and 8.

## MCP tool output contracts (2026-10-12)

A tool whose server declared an output schema is now held to it. A successful
result must carry structured content that satisfies the declared contract, or the
call fails with the code the recovered client raises for the same failure:
-32600 when the tool declares a schema and answers successfully with no
structured content, -32602 when the content does not match, with the first
violation appended. An error result is passed through, because a server reports
its own failures there, and a tool with no declared contract is unchecked.

The validator is bounded and dependency-free: type, enum, const, allOf, anyOf,
oneOf, not, a local $ref, properties, required, additionalProperties, items,
minItems, maxItems, uniqueItems, minimum, maximum, exclusive bounds, multipleOf,
minLength, maxLength and pattern, to depth 32. Any other keyword is ignored, which
is what the specification asks of a validator that does not know it, so a
contract written only in the rest is accepted rather than guessed at; the
connection's limits name the enforced list and the depth.

The declared contract is also part of what a pinned tool must still match after a
catalog refresh, so a server cannot swap a tool's result contract under a call the
model already chose. The standard-task resume path had to learn which tool it is
resuming, which it takes from its own journal entry rather than from the task
handle, which does not name one.

Suite 1130/1130; package 72 files with 0 upstream requests; identity 125 input /
92 validation / 65 build, merged `f8dab819…`. Detail and coordinates:
ports/W30-output-schema.md.

## Local backlog closed (2026-10-12)

Every locally executable item on the backlog is now either landed or decided, and
the two that remain need a person rather than a port.

The uncited-corpus figure is a reviewed remainder, not pending work. Thirty-four
contiguous bands read all 2267 modules of the uncited list down to the seven that
are nothing but a re-export; no unread module remains, and the candidate table
disposes all twelve candidates the pass recorded - eight landed as port packages
and four reclassified as rules without a local surface - along with the nine
further "candidate" marks the early slices used. The one place that still read as
open was slice fifteen's prose, which proposed entry-level Git-directory vetting;
a later pass read that module whole and found it is a workspace-diff materialiser
rather than an inspector, so the prose now carries the same disposition as the
table without naming the module here, which would move it out of the uncited tier
without adding evidence. What can still move the ledger is a package that ports a module and cites
it, which is why the corpus review and the dispositions name modules only where
the ledger excludes them.

The audit table holds no open local item: A01 and A03 to A08 are resolved, A02
waits on the application's own administrative surface for credential issuance and
rotation (a window this side cannot open), and A09 waits on the project's licence
and remote decision. Neither is a port.

No product source, test or build input changed, so the suite and identity in the
previous package still hold. Detail: ports/unreviewed-corpus.md's candidate table,
ports/remaining-dispositions.md item 6, and CURRENT's audit rows.

## Licence and publication (2026-10-12)

The project is MIT and publishes to GitHub, by the user's decision: the standard
licence text rather than a word-for-word check against the canonical file, and no
`Co-Authored-By` line in commit messages from here on. `LICENSE` carries the
standard MIT text under the project's own copyright line, and `package.json`
moves from `UNLICENSED` to `MIT` while keeping `private: true` so an accidental
publish to the npm registry stays blocked.

The published tree is this runtime's own source, its tests, its build
configuration and its provenance records. No recovered artefact is tracked -
`extracted*/`, `.agent/`, `dist/` and `node_modules/` are all gitignored - so what
goes out is the implementation and the notes about where its behaviour came from.

The second half of the Magpie management item is closed as not-a-requirement
rather than as work in progress: gateway compatibility is complete, and rotating
the credential is an action the application's own administrative surface takes,
not something this harness implements or needs.

Publishing found one thing worth fixing: GitHub's push protection refused the
first push because the credential-shape test carried an OpenAI-shaped literal, so
that fixture is now assembled from its parts - the value the test sees is the same
and the file no longer carries a key-shaped string.

Suite 1130/1130; package 73 files with 0 upstream requests, one more than before
because npm packs `LICENSE` automatically; identity 125 input / 92 validation /
65 build, merged `0774755c…`. Published at https://github.com/smf3kt/litcode
(public, MIT detected, main, snapshot commit a1c5107). Detail and coordinates:
ports/W32-licence-and-publication-evidence.json.

## W33 - bare invocation, version and install

A fresh installation could not be driven the way a harness normally is: the shipped
bin needed a task or an explicit `--interactive`, there was no `--version`, and a bare
invocation without a terminal printed the usage and exited 1 as an argument error.

Now the bare invocation decides by terminal instead of by a flag. With a terminal it
starts the interactive session; without one it prints the usage and exits 0. The options
that already name a command - `--demo`, `--continue`, `--resume`, `--list-sessions`, the
two MCP approval flags and a positional task - are never read as an empty call, and the
two flags that need interaction (`--mcp-elicitation`, `--watch-config`) accept the implied
one while still refusing when no terminal is attached. `--version`/`-v` report the package
version from the manifest beside the compiled entry, before any credential check. A
missing credential now names `LLM_API_KEY` and points at `--demo`.

Verified by installing the packed tarball globally: `litcode`, `litcode-magpie` and
`personal-harness` all resolve on PATH, `litcode --version` prints 0.1.0, a bare `litcode`
on a real terminal prints the session id, the workspace and the prompt line and exits on
`/exit` without spending a model call, and `litcode --demo` completes offline. The terminal
test needs a PTY, and macOS `script` refuses to start when its own stdin is a socket - the
shape Node gives a spawned child - so the case runs behind a shell pipeline and skips where
no PTY can be had.

Suite 1133/1133 (three new cases); package 73 files, 0 upstream requests; identity 125 input
/ 92 validation / 65 build, merged `b9210f58...`. The interactive banner still reads
`Personal harness.`, which is the legacy name the session prompt carries; renaming it is a
separate change. Detail: ports/W33-bare-invocation.md.
## W34 - tracking an installed client's gateway configuration

The credential had to be stated twice: once for the client already configured on the
machine, again as LLM_API_KEY for this harness. A live run now fills whatever this
harness was not told from that client's own settings - its `env` block and its
top-level `model`, with the process environment filling gaps - under stated bounds,
and reads nothing beyond that file.

Explicit values still win, in this order: a flag, an LLM_* variable, this harness's
own settings file, then inheritance. A borrowed credential is used only for the
endpoint the client itself named; pointing `--base-url` somewhere else means it is not
borrowed, and the failure names both endpoints. The default `auth` follows the variable
the credential came from, so a key-variable credential is not sent as a bearer token.
One stderr line reports each source, naming the variable and the file and never a
value; no credential reaches a session or a journal. `--inherit-gateway` /
`--no-inherit-gateway` and LLM_INHERIT_GATEWAY control it, and a resumed session keeps
its pinned endpoint and borrows only a credential for that endpoint. The launcher now
shares the reader instead of comparing the environment itself.

Verified with a stripped environment: `env -i ... litcode` on a PTY, with no LLM_* or
ANTHROPIC_* variable present, inherited all three fields from the client settings file,
opened the session and exited on /exit with 0 model calls. No live model call was made
in this package. Suite 1148/1148 (11 unit and 4 CLI cases new); package 74 files, 0
upstream requests; identity 126 input / 93 validation / 66 build, merged `47a942eb...`.
Detail: ports/W34-gateway-inheritance.md.
## W35 - full-screen interaction layer

The interactive session gained an opt-in full-screen layer that implements the same
terminal surface as the line editor, so the loop drives either one. The DEC private mode
constants and their formatters, the chord -> `context:action` binding tables and the kill
ring reducer are copies of the recovered modules; the transcript viewport is adapted (the
ten scroll commands, `toggleShowAll`, the bounded render prefix) and the frame is
rewritten, because the recovered interface is a 360288-byte vendored React+Ink+Yoga
application whose main module alone is 1716741 bytes of Bun bytecode ESM, larger than this
product. The layer owns the alternate screen, bracketed paste, focus events, synchronized
update, the scroll mouse profile and the cursor, restoring each on exit, and it resolves
keys through a context stack where multi-key chords stay pending or hand their bytes back
to the editor. Suite 1153/1153 (5 new, one driving the shipped CLI under a real PTY);
check and build clean; identity 131 input / 94 validation / 71 build, merged `3b1f2ac0...`.
Detail: ports/W35-tui.md.

## W36 - mouse reports and transcript wheel routing (2026-10-13)

SGR/X10 framing and the wheel-to-viewport chain are verified by 25 affected regressions, compiled CLI/PTY with two owned SSE requests, typecheck/build and an 80-file offline installation. Identity and exact source coordinates: [ports/W36-tui-mouse.md](ports/W36-tui-mouse.md). The interactive family remains Partial; work pauses here at the user's request.

## W37 - transcript selection and OSC52 (2026-10-13)

Drag/keyboard selection, grapheme-aligned highlights and bounded clipboard requests now form one compiled CLI chain. Final 1158/1158, 28 affected regressions, check/build, PTY and 82-file offline installation pass. Source ranges, adaptations, three review fixes and final identity: [W37 record](ports/W37-tui-selection.md). Terminal acceptance/native clipboard and broader interaction gaps retain their explicit limits.

## W38 - default full screen and contextual input (2026-10-13)

Bare terminal invocation now chooses the full screen, with explicit/dumb/pipe line fallback. Context keys reach transcript/search handlers and paste/overrides retain intent. 1160/1160, 44 affected checks, compiled bare-PTY and offline package pass. [W38 evidence](ports/W38-tui-default.md).

## W39 - modal questions, plans and permission (2026-10-13)

Separate modal input now handles typed choices/Other and confirmation/text prompts, restores drafts, and drains unfinished paste across owner changes. 1162/1162, compiled question-plan-file approval/cancellation chain and 82-file offline install pass. [W39 source and evidence](ports/W39-tui-dialogs.md).

## W40 - common session actions (2026-10-13)

Meta+P/bare `/model` opens a local model picker, Meta+T and `/thinking [on|off]` reuse the configuration-branch lifecycle, Ctrl+T opens the tasks panel and Ctrl+S stashes/swaps the draft. 1164/1164, compiled picker/thinking/stash/tasks chain with one local model request, mouse and dialog chain regressions and 82-file offline install pass. [W40 source and evidence](ports/W40-tui-actions.md).

## W41 - multi-click selection and soft-wrap copy (2026-10-13)

A double click selects the word under the pointer through the recovered character class, a triple click selects the whole row, a drag keeps the span the click sequence produced, and a screen change or distant press restarts the sequence. Copying rejoins soft-wrapped rows while an explicit newline keeps its own line and prefix. 1166/1166, 16 local tests, compiled mouse chain and 82-file offline install pass. [W41 source and evidence](ports/W41-tui-multiclick.md).

## W42 - grouped questions and the review page (2026-10-13)

A multi-question request walks each question and then reviews every answer before submitting, with Left/Right moving between questions and the last question opening the review page with Right. 1168/1168, 18 local tests and all three compiled smoke chains pass. [W42 source and evidence](ports/W42-tui-groups.md).

## W43 - choice previews and recovered layout/Markdown cores (2026-10-13)

Model schema and question callback now carry focused previews through the modal/review/result chain and line input. JavaScript layout core, Markdown lexer and formatter bodies are copied verbatim with explicit plain host adapters. 1171/1171, check/build, mouse/actions regressions and 86-file offline installation with wide/narrow/line preview chains pass; final identity `775a2de2…`. Complete React/Ink renderer and remaining preview host contracts stay Partial. [W43 source, differences and evidence](ports/W43-tui-preview.md).

## W44 - cumulative assistant messages and Unicode wrap adaptation (2026-10-13)

Streaming fragments now share one Markdown message per provider response; long model messages remain complete. The copied ANSI tokenizer and source re/M adaptation preserve grapheme boundaries and original text through soft-wrap copy. 1172/1172, 57 affected tests, check/build, mouse and installed wide/narrow SSE chains pass; 88-file global installation has 83 matching runtime files, identity `96ff6d8f…`. Complete renderer/theme/footer remain Partial. The timed-out REA service's 100% CPU residual was identified and cleared after ownership verification. [W44 source, differences and evidence](ports/W44-tui-renderer.md).

## W44 - original renderer and visual components (2026-10-13)

Original reconciler/Ink/layout/cells/diff/output and Box/Text/ANSI/theme/Markdown/highlighter chain now drives messages; copied input borders/pointer/footer frame the owned editor. 273+407 exact fragments,1174/1174,125-file offline package and global120 runtime files verified; installed wide/narrow heading/code/Unicode chains pass. Historical identity`9c9c1417…`; original tDr frozen-prefix/open-fence state subsequently integrated,visual418fragments,1174/1174 and installed9212-character stream pass,latest identity`f1266d06…` ([stream evidence](ports/W44-stream-evidence.json)). Complete native/input/footer/pacing behavior stays Partial. [W44 slice and remaining gate](ports/W44-tui-renderer.md), [compact evidence](ports/W44-renderer-evidence.json).

## W44 - source preview pacing and cleanup (2026-10-13)

Original100ms clt/dlt and tLo/Vx store now gate the unfinished final line; completion/cancel/failure settle full text, close cancels timers, and deferred rendering errors release terminal ownership.1175/1175,42 terminal tests,126-file offline package and global121 runtime matches pass; installed preview/narrow handshake/9212-character chains verified. Identity`8479f4db…`, archive`51753327…`; [compact pacing evidence](ports/W44-pacing-evidence.json), [slice and remaining gate](ports/W44-tui-renderer.md). Native/full input/footer/visibility-policy gaps remain Partial.

## W44 - terminal exit cancels the active turn (2026-10-14)

Terminal end/close/input-error and deferred-render-error now cancel the owned active turn before runtime/session release; queued terminal commands end with that owner, piped line commands keep their drain contract.50/50 affected tests,1176/1176 full,126-file offline package and global121 runtime matches pass; injected actual CLI failure exits0 with stream/mode/lock cleanup, SIGTERM remains130. Identity`94a2fdf6…`, archive`47794c25…`; [input-close evidence](ports/W44-input-close-evidence.json), Q-027/S-4 updated.

## W44 - source preview visibility and pinned settings (2026-10-14)

Copied Zqn/l$t reduced-motion/WT_SESSION policy now follows settings, durable session snapshots, reload/removal reset, resume and terminal consumption; hidden live previews retain complete final bodies.63/63 affected tests,1177/1177 full,127-file offline package and global122 runtime matches pass; ordinary/WT environment40-column five-stage CLI chains verified. Identity`985ff8df…`, archive`75b4caff…`; [visibility evidence](ports/W44-visibility-evidence.json), [slice and remaining gate](ports/W44-tui-renderer.md). Native Windows execution and remaining focus-fold/hold/tool-use/transform policies stay Partial; Q-028 is recorded under existing S-1.

## W44 - original measured input navigation (2026-10-14)

Si/Lt/Ct and row/word/placeholder closure copied exactly10 declarations/19178 bytes; TUI, line TTY and modal text share measured rows/caret. Raw Unicode remains an explicit host adaptation; visual navigation and logical-line commands are distinct.47/47 terminal,1180/1180 full,130-file offline package and global125 runtime matches pass; both40-column CLI modes verify five exact durable submissions. Identity`8cf691ab…`, archive`fc3b443f…`; [input evidence](ports/W44-input-evidence.json), [source and acceptance](ports/W44-tui-renderer.md). Q-029/S-5 updated; full BFt/Vim/undo/confirmation/decorations/footer remain Partial.

## W44 - source kill/yank usage chain (2026-10-14)

Existing Si/ring ports now receive real visual-line/word/WORD/placeholder kills and head/cycle yank commands in TUI, line TTY and modal owners; raw Unicode, interruption, budget and owner boundaries verified.50/50 terminal,1183/1183 full,131-file offline package and global126 runtime matches pass; both40-column CLI modes verify five exact durable submissions. Final identity`d2c55b7f…`, archive`540a90ad…`; [kill evidence](ports/W44-kill-evidence.json), [source and acceptance](ports/W44-tui-renderer.md). Only driver complete-record polling changed after full tests; affected offline/global chains reverified with unchanged product/build/archive. Q-030/S-1/S-5 updated; full undo/Vim/confirmation/decorations/footer stay Partial.

## W44 - copied input undo snapshots (2026-10-14)

Original due copied unchanged1 declaration/975 bytes;50 snapshots/1000ms debounce/branch truncation now serve TUI, line TTY and modal text with exact raw caret restoration, history consumers and owner/timer cleanup.53/53 terminal,1186/1186 full,133-file offline package and global128 runtime matches pass; both40-column CLI modes verify five exact durable submissions and pending-snapshot SIGTERM exit130. Identity`f01f3309…`, archive`0a8b8c42…`; [undo evidence](ports/W44-undo-evidence.json), [source and acceptance](ports/W44-tui-renderer.md). Q-031/S-1 updated; full Vim gesture/editRelay/attachments/confirmation/decorations/footer stay Partial.

## W44 - source prose width settings (2026-10-14)

Source maxProseWidth optional integer >=40/catch(undefined) now serves settings/session pinning/reload/reset/resume and terminal context/cache; five existing Markdown copies cap prose while code/tables stay full width and raw/copy remain exact.50/50 affected,1188/1188 full,100-column six-phase compiled/offline/global CLI,133-file package and global128 runtime matches pass. Identity`117f53a7…`, archive`c16b8a2d…`; [prose evidence](ports/W44-prose-evidence.json), [source and acceptance](ports/W44-tui-renderer.md#prose-width-acceptance-2026-10-14). S-1–S-7 reviewed without a new incident; full native text/input/footer/preview and custom theme/settings UI remain Partial.

## W44 - source highlighting setting (2026-10-14)

Strict optional syntaxHighlightingDisabled now serves settings/session pinning/reload/reset/resume and original document/cache consumers;6 existing exact declaration bodies reused. Source code colors toggle for streamed/final/frozen rows, dim language labels and other Markdown styles/raw/copy remain exact.52/52 affected,1190/1190 full,100-column five-phase compiled/offline/global CLI,133-file package and global128 runtime matches pass. Identity`002d9263…`, archive`6230558d…`; [highlight evidence](ports/W44-highlight-evidence.json), [source and acceptance](ports/W44-tui-renderer.md#syntax-highlighting-setting-acceptance-2026-10-14). S-1–S-7 reviewed without a new incident; standalone diff/native/input/footer/preview and custom hosts remain Partial.

## W44 - source built-in theme lifecycle (2026-10-14)

Copied16 theme snippets/926bytes; six built-ins/auto env fallback now serve settings/session/reload/reset/resume, dual-renderer contexts/cache and /theme focus-preview/cancel/atomic-save/restart.54/54 affected,1192/1192 full,100-column five-phase compiled/offline/global chain,136-file package/global131runtime match. Identity`015ec3e2…`, archive`0a7740b1…`; [theme evidence](ports/W44-theme-evidence.json), [source and acceptance](ports/W44-tui-renderer.md#built-in-theme-acceptance-2026-10-14). Q-032 driver error-case/pipe-entry fixes bind unchanged product/validation/build with installed rechecks. Live OSC/custom/plugin themes and full native/input/footer/preview/diff remain Partial.

## W44 - source auto system-theme responses (2026-10-14)

Copied13 fragments/5286bytes; OSC11/DA1/CSI?997 query/response/notification chain now updates auto theme cache and both renderers, isolates terminal replies from drafts/modals, and cancels pending modes/timers on manual switch/close.61/61 terminal,1195/1195 full,direct/mux-environment compiled/offline/global chains,139-file package/global134runtime match. Identity`10ab2014…`, archive`adbfd5d9…`; [system-theme evidence](ports/W44-system-theme-evidence.json), [source and acceptance](ports/W44-tui-renderer.md#system-theme-acceptance-2026-10-14). Q033/Q034 and S1/S5 updated; real mux/daemon/attacher/custom/native/full UI remain Partial.

## W44 - source user custom-theme catalog (2026-10-14)

Copied15 fragments/26825bytes including the full22450-byte watcher; userDir/themes load/filter/sort/serial/watch now serves custom chooser, base/overrides, both renderers/cache and saved/reload/resume lifecycle. Edit/invalid/delete/recreate, exact draft/raw and pending-close chains pass. Final56/56 affected,check/build/notices,compiled/offline custom chain,143-file package/global138runtime match; identity`f466fb34…`, archive`ece23c62…`. Full1197/1197/all-UI acceptance retains pre-import-cleanup identity`e8e3ffc0…`/archive`53b66d11…`; imports/non-import AST equal, bytes changed and affected chains revalidated. [Evidence](ports/W44-custom-theme-evidence.json), [acceptance](ports/W44-tui-renderer.md#user-custom-theme-acceptance-2026-10-14). Q035/Q036 and S1/S6 updated; plugin/editor/storageV5/native/full UI remain Partial.

## W44 - source installed-plugin themes (2026-10-14)

Copied4 declarations/644bytes with15 exact dependencies reused; verified enabled local plugins/default or declared paths now serve namespace/source choices, sorted stable user-first catalog, both renderers, reload/disable/resume and cleanup.79/79 affected,1199/1199 full,check/build/notices,compiled/offline/global plugin lifecycle plus user-theme hot-refresh pass;144-file package/global139runtime and README match. Identity`f6e1e57b…`, archive`3a4b882f…`; [evidence](ports/W44-plugin-theme-evidence.json), [acceptance](ports/W44-tui-renderer.md#plugin-theme-acceptance-2026-10-14). Q037/Q038 and S1/S5 updated; post-full driver-only status prefix fix keeps product/validation/build identity. Original marketplace/per-plugin activation/remote catalog/editor/storageV5/native/full UI remain Partial.

## W44 - source custom-theme editing (2026-10-14)

Copied12 bodies/1505bytes for edit/preview/save/reset/cancel/name/slug; /theme New/Ctrl+E and plugin fork now feed user atomic files/catalog, shared config-session selection and dual contexts/cache while preserving draft/raw and cancellation.2/2 focused,66/66 affected,1201/1201 full,check/build/notices,compiled editor/actions,offline four-theme chains and global141runtime/README match.146-file archive`6c0d84d4…`, identity`6e536832…`; [evidence](ports/W44-theme-editor-evidence.json), [acceptance](ports/W44-tui-renderer.md#theme-editor-acceptance-2026-10-14). Q039/S1 updated. Original editor widget layout/storageV5/full UI remain Partial.

## W44 - source theme color components (2026-10-14)

Copied8 bodies/declarators770bytes for literal swatches/custom label/item/current-preset previews into the existing source tree/context and modal owner.67/67 related,1202/1202 full,check/build/notices,100/40-column compiled/offline/global editing and cancellation chains pass;147-file archive`9c8c6f19…`, global142runtime/README match, identity`a0d378eb…`. [Evidence](ports/W44-theme-color-evidence.json), [acceptance](ports/W44-tui-renderer.md#theme-editor-color-components-acceptance-2026-10-14). Q040/Q041/Q042/S3/S4 updated, ANSI and active-height plain-export fixes revalidated on final identity; full gLt/wr/container/storageV5 remains Partial.

## W44 - source thinking progress (2026-10-14)

User-priority animation/elapsed/completed-time/task summary copied82 fragments27686bytes into Agent/SDK phase events, source progress tree/clock, durable duration/recovery and task mutation/watch owners.3/3 focused,109/109 related,1205/1205 full,check/build/notices,100/40-column compiled/offline/global with RGB shimmer/task updates/settings resume/cancel/error/close pass;154-file archive`72e292fc…`, global149runtime/README match, identity`c351b413…`. [Evidence](ports/W44-progress-evidence.json), [acceptance](ports/W44-tui-renderer.md#thinking-progress-acceptance-2026-10-14). Q043/Q044/Q045/S1-S7 reviewed; mouse scroll/selection/copy revalidated on compiled/global after driver-only viewport change. Custom time/verbs/team-cloud/retry/budget and remaining full UI stay Partial.

## W44 - source progress display settings (2026-10-14)

35 bodies4920bytes plus18 reused dependencies now carry spinnerVerbs/timeFormat/timeZone through pinned settings/reload/removal/resume and completion cache.2 new regressions,3/3 focused,74/74 related,1207/1207 full;100/40-column compiled/offline/global settings and thinking chains pass.156-file archive`f8c71451…`, global151runtime/README match, identity`73077af3…`; [evidence](ports/W44-progress-settings-evidence.json), [acceptance](ports/W44-tui-renderer.md#progress-display-settings-acceptance-2026-10-14). S1-S7 checked; no failed run. Original widgets and remaining full UI stay Partial.

## W44 - source collapsed text paste (2026-10-14)

38 bodies7101bytes now carry source folding/IDs/repeat expansion through undo/history/search/stash/submission/close in TUI and line TTY.3/3 focused,78/78 related,1210/1210 full; compiled/offline/global folded paste/editing/undo/kill-yank eight chains pass.Final reviewed158-file archive`c35ea9ef…`, global153runtime/README match, identity`a2c8cad6…`; [evidence](ports/W44-paste-reviewed-evidence.json), [acceptance](ports/W44-tui-renderer.md#collapsed-text-paste-acceptance-2026-10-14). Q046–50/S1-S7 checked; independent review's stale payload/raw-ring/raw-search gaps fixed and3 probes plus all checks rerun; earliera44020db/9c346514 remains historical. Remaining full input/UI stays Partial.

## W44 - source external editor handoff (2026-10-14)

16copy+2await adaptations3095bytes carry original resolver/argv/file/refold/newline through Ctrl+G/chord, cooked terminal/owned child, draft undo/error/cancel/close.3/3 focused,93/93 related,1213/1213 full and40column compiled/offline/global TUI/line editor plus paste pass.160file archive`4bd718ad…`, global155runtime/README match, identity`1fbd93c3…`; [evidence](ports/W44-external-editor-evidence.json), [acceptance](ports/W44-tui-renderer.md#external-editor-acceptance-2026-10-14). Q051–54/S1-S7 checked; descendant cancellation and same-batch input fixed and independently verified. Initial54313c9c…/29925079… stays historical; full UI remains Partial.

## W44 - source Vim input modes (2026-10-14)

133records131copy2NFC adaptations40648bytes now connect complete motion/operator/count/textobjects/find/visual/register/dot/remap source through TUI/line raw editing and settings/session/reload/resume plus copied editorrow/redirect.3focused98related1216full,40column compiled/offline/global9submissions per mode and editor/paste regression chains pass;164filearchive`46864d05…`,global159runtime/README match,identity`1fcc1fa6…`. [Evidence](ports/W44-vim-evidence.json), [acceptance](ports/W44-tui-renderer.md#vim-input-acceptance-2026-10-14). Independent Q057 cancellation/remapowner gaps fixed and17source17compiled probes pass. Initial26782a28/10c7f224 remains historical; complete native/BFt/footer/Config/attacher UI stays Partial.

## W44 - source BFt Return gestures (2026-10-14)

3exactcopies326bytes retainbackslash-beforemodifier/newline/plainsubmitthroughownedrootframing/rawcursor/atomicundo/Vimdot,modalplain/override/bareLF/contextregistry.2focused86related1218full,compiledTUI7line6exactsubmissions and166fileoffline/global return/Vim/paste6chains pass;161runtime/README match,identity`b2d0ca2a…`,archive`86c57936…`. [Evidence](ports/W44-return-evidence.json),[acceptance](ports/W44-tui-renderer.md#bft-return-gesture-acceptance-2026-10-14). Q058 independentsearchEntercontextfixedandoriginalsource/compiledprobe passed;initial5b6e6196/bae09566historical,fullBFt/native/UIstillPartial.

## W44 - source double-key confirmation (2026-10-14)

7exact1080bytes retainiq800ms/BFt firstclear/secondexit/emptyCtrlDdelete/doubleEscapehistory throughactualCLIownedtimers/hints/rawpasteandVim/modal/runningcancelowners.3focused89related1221full,compiled40col4submitspermodeexit0,168fileoffline/global10inputchains pass;163runtime/README match,identity`d2cfbe38…`,archive`469fecff…`. [Evidence](ports/W44-gesture-evidence.json),[acceptance](ports/W44-tui-renderer.md#double-key-exit-and-clear-acceptance-2026-10-14). Q059independent20colhint/chordcancelbugsfix/sourcecompiledprobespass;twooldmigrationTTYexitdriversandeditorframewaitupdatedwithoriginalintentpreserved. Fullleftarrow/editRelay/native/footer remainPartial.

## W44 - source terminal focus (2026-10-14)

8exact468bytes/7observations now connect CSI focus reports/perterminal state to Vim inverse/sourceclock/drag release/regain/modal/chord/editor handoff/close.3new regressions85related1224full,40columncompiled3submitspermode and170fileoffline/global focus-Vim-editor6chains pass;165runtime/README match,identity`e093e416…`,archive`84140dc6…`. [Evidence](ports/W44-focus-evidence.json),[acceptance](ports/W44-tui-renderer.md#terminal-focus-acceptance-2026-10-14). Independent same-batch modal trailingreport defect fixed,9source3compiledprobes pass;Q060/source/build/evidence bound,35logs/noownedprocess. Native/daemon/voice/fullUI remainPartial.

## W44 - source custom status line (2026-10-14)

23exact6864bytes/8obs5modules connect originalhsr300ms/refresh/abort/schema/usage/multilineANSI throughfixedsettings/reload/remove/resume/ownedcommandJSON/footergeometry/modal/editor/closeflush.3new126related1227full,40columnCLIexactdraft and175fileoffline/globalstatusline+focus3chains pass;170runtime/README match,identity`ba223f49…`,archive`6dca8053…`. [Evidence](ports/W44-statusline-evidence.json),[acceptance](ports/W44-tui-renderer.md#custom-status-line-acceptance-2026-10-14). IndependentsameSessionbind/enableconditionalgapsfixed,originalowner9/UI5groupspass,Q061/30logs/noownedprocess. NativeUF/trust/cost/rates/git/fullfooter remainexplicitadaptersandPartial.

## W44 - source persistent input history (2026-10-14)

63 exact bodies18876bytes/13obs6modules connect source WE/parser/cache/filter/read through TUI/line submit/doubleEscape/startup/session binding/project100/raw recall/search/exitflush.119related1230full,compiled cross-process restart and179fileoffline/global history+gesture4chains pass;174runtime/README match,identity`832313e6…`,archive`dd512a8f…`. [Evidence](ports/W44-history-evidence.json),[acceptance](ports/W44-tui-renderer.md#persistent-input-history-acceptance-2026-10-14). Q062 independent write-recovery/oldowner/crashlock defects fixed and two probe groups reverified; full global selector/native storage/unavailable-paste UI remain Partial.

## W44 - source prompt-line global history search (2026-10-14)

8exact+1adapt4709bytes/9obs6modules carry source Dre/Ere/SVe into the recovered React tree: global cross-project async read, casefold, dedup, next/accept/cancel/execute, empty-query snapshot and shared paste-ID rebase across TUI and line.3new1233full,40column compiled two-process6submission and pending-searchSIGTERM130,181fileoffline/global4chains,176runtime/README match;identity`8896fef5…`,archive`9c744fda…`. [Evidence](ports/W44-history-search-evidence.json),[acceptance](ports/W44-tui-renderer.md#prompt-line-global-search-acceptance-2026-10-14). Independent review defects (end-of-text caret, TUI custom search command) fixed; Kse scoped picker remains.

## W44 - scoped history picker entry (2026-10-14, in progress)

Kse scoped picker is wired into both terminal owners behind `SOURCE_PICKER_OWNS_HISTORY_SEARCH` (now true in `tui.ts` and `terminal.ts`): ctrl+r route, scope cycle, typed filter, accept into the prompt draft, cancel keeping the draft. Two product defects fixed in the same pass: an identifier shadowing bug in `ScopedPicker` (`filtered` field vs `filtered()` method) and `ctrl+c` bypassing `handleSourcePicker` through the global binding table. `test/picker-entry.test.ts` 1/1 in both modes; picker/terminal/tui suites 76/76; `tsc --noEmit` clean.

Resolved: the folded-paste recall defect recorded here (the accepted row not landing in the prompt because the picker's row array was smaller than the snapshot it reported) no longer reproduces. `test/input-history.test.ts` passes 3/3 in this tree, including `both terminal owners restore folded raw history across restart, search and double-Escape clear`, and the whole file passes inside the full 1,285/1,285 run W45-8 recorded. See [Q-066](question.md) and [Eleventh step](ports/W44-tui-renderer.md).


## W45-17 - classic.PostToolBatch on the batch boundary (2026-10-15)

The batch event has its call site, and the package added no copy at all: W45-16 already holds the raise, so what was left was the source's own site, its hook input and its rule. The source raises the batch in `Hkn` (chunk-sfn1dbxq.js [3062957,3063491)), gated on the configured-hooks registry, with `{...session, hook_event_name: "PostToolBatch", tool_calls}`; the entries are its caller's own `{tool_name, tool_input, tool_use_id, tool_response}` (chunk-5b2hxy2e.js [123669,124114)), and unlike the single events the batch input carries no `_X` tool aliases. That caller also carries the rule the product now follows: `if (N.blockingError || N.preventContinuation)` a batch block is discarded and logged with the source's sentence, because the turn already ended by a tool result and no model re-invoke follows.

`src/agent.ts` raises the event beside the native `PostToolBatch` hook, pushes the answer's `additionalContexts` through that hook's own context message, and logs the discard. The classic event names now live as `CLASSIC_POST_TOOL_USE`/`CLASSIC_POST_TOOL_USE_FAILURE`/`CLASSIC_POST_TOOL_BATCH` in `src/plugin-chain-classic-raise.ts`.

Measured, then asserted: the hook input's exact key set; the gate open only while a module's pattern names the event (a batch turn with nothing hooked logs nothing); one batch of two calls reaching the hook as two ordered entries with their own results; the context message; and that a blocking answer leaves `run` returning `end_turn` with the trailing reason reading `preventContinuation` — the source's own fallback chain, not an invented default.

Verification: check / build / notices pass; `verify-chain-copies` still passes over the same 21 plans (nothing added); `test/plugin-chain-classic-batch.test.ts` is 3/3; the full suite is 1,314/1,314; all eleven W45 compiled drivers exit 0, the new one `.audit/w45-17-compiled.mjs` printing `W45PostToolBatchCompiled.v1`. Identity `96183297…` (inputs 193c4f39 / 297, validation 73286c90 / 117, build 060d2531 / 209). Evidence: `research/ports/W45-classic-batch-evidence.json`.

## W45-16 - the generic classic raise (2026-10-15)

Every classic hook event other than `PreToolUse` now has a raise point, and the tool path uses it for `classic.PostToolUse` and `classic.PostToolUseFailure`. The source had the whole mechanism: the product's hook runner asks `Q_t(name)` (`Gnr(name) && Jl("classic." + name)`, chunk-sfn1dbxq.js [556225,556265)) and then calls `Ikt` ([562773,563154)), which names the site with `FDe`, waits out a module whose hooks are still loading through `Cro`/`N5t`, dispatches with `aP`, and folds the answer with `h7n` ([562464,562773)) into the record list its caller reads. `le`/`fe` are the same pair on the chain's test surface, `gkt` resolves a block's text, and `Bde` is what the pre-gate rejects with after an abort.

Copied: 18 blocks / 2,095 UTF-16 units over four modules, 16 exports, in `src/plugin-chain-classic-raise-source.ts`. One body is adapted, and the reason is the one W45-15 already recorded for `m_t`: `Ikt` builds its outer arms with `xkt` over `e.runClassicHooks` (the engine's configured-hook runner, which answers with per-hook records), while this product's configured hooks are ./hooks.ts's and answer with one aggregate `HookResult` that has already run before the chain event is raised. So `raiseClassicEvent` in `src/plugin-chain-classic-raise.ts` is `Ikt`'s body with those two arms as inputs, raising through the copied `znr` and folding with `h7n`; `xkt`/`mkt`/`QY`/`ckt` are not copied, which also keeps lodash's `omit` out of the closure. The one measured difference (`znr` passes one origin to both the pre-gate and the dispatch where `Ikt` passes `void 0` to the gate, reaching only the pre-gate's diagnostic text) is written in the seam's header. Two small ports: `pn` is `Bun.stripANSI`, and `K`/`se` are the session id and cwd, which ./agent.ts hands in through the payload.

Measured, then asserted: the gate opens only for an event a module's pattern names and never for `PreToolUse`; a `{block}` answer folds to `[{command: 'classic.PostToolUse hook', succeeded: false, output: <block>, blocked: true}]` with `gkt` returning the same text, while `{updatedToolOutput}` folds to `[]` with `block` undefined; a post hook's rewrite lands as the tool result in the same message with its context as `Hook context:` text, and a failure hook's block leaves the tool's own error text in place and adds the feedback.

Verification: check / build / notices pass; `verify-chain-copies` passes over 21 plans with the new copy at 18 blocks / 2,095 units / sha256 `b459423a…`; the copy scans 0 undeclared; `test/plugin-chain-classic-raise.test.ts` is 3/3; the full suite is 1,311/1,311; the ten W45 compiled drivers exit 0, the new one `.audit/w45-16-compiled.mjs` printing `W45ClassicRaiseCompiled.v1` against `dist/`. Identity `44af8e35…` (inputs 25389244 / 297, validation 8a740f93 / 116, build 60d741f6 / 209). Package record: [W45-chain-runner.md](ports/W45-chain-runner.md), evidence `research/ports/W45-classic-raise-evidence.json`.

## W45-15 - the classic PreToolUse raise point (2026-10-15)

The first raise point Q-088 named is landed, so a plugin module that hooks `classic.PreToolUse` is asked before a tool runs. The source already had the bridge, so none was invented: `tool.call`'s core **is** the classic raise. `Mo = (e, r = RFe()) => Jl("classic.PreToolUse") ? {"tool.call": ke(e, r)} : {}` (chunk-kwp08k6x.js [17723,17793)) is the gate; `ke` [17439,17723) builds the envelope with `rIt` and dispatches `$go(i, P0("classic.PreToolUse", e), {signal, origin: aJ(e), bottom})`, taking a denial through `xe` [17196,17365) and a rewrite through `ye` [17365,17439); `$go` (chunk-nyce03br.js [121822,121896)) is `(e, t, o = {}) => aP({e, handlers: t, site: zd["classic.PreToolUse"], ...o})`, the product's own executor with the product's own registered site table; `mDe` (chunk-sfn1dbxq.js [504309,504681)) says what an answer means for its caller. Thirteen blocks / 1,700 UTF-16 units over three modules are the new copy, with the envelope (`Da`/`No`/`rIt`) and the record (`RFe`/`CFe`/`a8`) it needs. `zd` comes from the host, where it is already the registered table, so the dispatcher's body is copied unchanged.

The host seam is src/plugin-chain-tool-raise.ts, and it follows `m_t` (chunk-sfn1dbxq.js [504681,505531), 850 units): its managed and settings slots become inputs because this product dispatches settings hooks in ./hooks.ts, and the module handlers are the part of `m_t`'s list the product has. The answer joins the agent's existing permission path, so a deny, an ask and a rewrite behave as the native hook's do. One port: `xe`'s sentence ends in `Pet("deny")`, the source's text lookup in the unported catalog, so the word is the host's.

Three measurements each changed an assertion. The envelope keeps `tool_use_id: undefined` when the call has no id rather than dropping the key. Raising with no module hooking the event throws the source's own `no implementation for classic.PreToolUse`, because `$go` passes no core and the chain's bottom has none, which is why the product gates on `Jl`, the source's own gate. And `mDe`'s deny arm returns early, so a denial carries the reason and the context but drops `updatedInput`. check/build/notices pass, 20 plans and 40 files regenerate byte-identically, the new copy scans 0 undeclared, `test/plugin-chain-tool-raise.test.ts` 3/3 (including the agent's tool path under a denial and under a rewrite), full 1,308/1,308, `.audit/w45-15-compiled.mjs` (`W45ToolRaiseCompiled.v1`) green against `dist/` beside the eight earlier drivers, all nine exit 0. Identity `9e2093c2...`. [Package record](ports/W45-chain-runner.md#w45-15-landed-the-classic-pretooluse-raise-point-2026-10-15), [evidence](ports/W45-tool-raise-evidence.json). [Q-088](question.md) narrows: the other classic events and the `ui.`/`env.`/`state.` value events are still raised by nothing.

## W45-14 - the three hand-written classic sites and their lodash stack (2026-10-15)

The last three names of the source's site table are landed, so the registered count goes from 108 to 111 and [Q-087](question.md) closes. These are the classic sites the source writes by hand and the generated family excludes by construction: `classic.PreToolUse` (`Ua`, chunk-nyce03br.js [104152,104568), 416 units), `tool.call` (`Ba`, [105113,105501), 388 units) and `tool.check` (`Ka`, [105602,106133), 531 units). Each one pins the tool call rather than the hook's own message. `classic.PreToolUse` guards the call envelope (`Gn` is `["tool", "tool_use_id", "agentId", "consent", $shadowed]`, not `tool_name`) and refuses a malformed `deny`/`ask` or an `allow` that is not `true`; `tool.call` pins `tool`/`tool_use_id`/`agentId`, refuses an answer that is neither a result nor a denial, keeps a shadowed result only when a read-only hook beneath answered the same one, and is the one site with `measure`; `tool.check` refuses anything but the three decisions and refuses a hook that asks about another call instead of answering.

Their rules close over lodash, which W45-12 could only describe as still expanding. Measured now: the closure is memoize over map-values, and it is four copies over four modules, 203 blocks / 16,173 UTF-16 units. `src/plugin-chain-classic-sites-source.ts` (32 blocks / 4,236 units, chunk-nyce03br.js plus `Qws` from chunk-m4qpskd4.js), `src/plugin-chain-lodash-memoize-source.ts` (20 blocks / 1,231 units), `src/plugin-chain-lodash-internals-source.ts` (146 blocks / 10,343 units) and `src/plugin-chain-lodash-mapvalues-source.ts` (5 blocks / 363 units). The chain's own memoize copy stays single; its export list widened from `V`/`po` to fourteen names so the lodash copies read those bodies from it instead of copying them again.

Two ports are in the internals copy, both the free CommonJS `module` object the bundle supplies twice: an ESM copy has none, so `typeof _ === "object"` is false, which selects the arm the module takes when it is not CommonJS-loaded, and the `isBuffer` check resolves to its always-false arm. One wiring mistake is recorded: the cross-chunk names were first imported under a single module that does not export them, which the undeclared-name scan cannot catch because an import counts as declared, and only a measured run did. Adding these three changes no product behaviour beyond the registration. check/build/notices pass, 19 plans over 28 modules and 38 files regenerate byte-identically, all five copies scan 0 undeclared, focused chain files 12/12 with the new `test/plugin-chain-classic-sites.test.ts` at 3/3, full 1,305/1,305, compiled driver `.audit/w45-classic-sites-compiled.mjs` green against `dist/` beside the seven earlier ones. Identity `4dd43d51...`. [Package record](ports/W45-chain-runner.md#w45-14-landed-the-three-hand-written-classic-sites-and-the-lodash-stack-beneath-them-2026-10-15), [evidence](ports/W45-classic-sites-evidence.json). [Q-088](question.md) records what stays open: nothing in the product raises a classic hook event or a value event, so a plugin answering these names has no dispatcher.

## W45-13 - the seven value sites the table overrides by hand (2026-10-15)

The names W45-12 skipped now carry the descriptor the source actually holds for them. `zd` is `{...co(Q$n, se), ...co(HFs, Bbr), "ui.open": Ni, "ui.close": Hi, "ui.blit": oa, "env.get": Si, "env.set": Oi, "state.get": Pa, "state.set": Ha, …}` (chunk-nyce03br.js [110271,111415)), and object-literal order means the later hand-written key wins. The registration now says that out loud: the two generated families are spread first, the seven are registered after them in the table's own column order, and the skip list is gone. The observable difference is the `checkArgument` (and, for `state.set`, a `restoreArgument`) the generated value site does not carry; the registered total is 108.

The new part is the argument rules. `ui.open` pins the pane id. `ui.close` chains four refusals: the id shape through `ZPt` with its 64-character limit `jbr`, a changed id, a missing origin, and an origin that is not the engine's (`Rt`). `ui.blit` pins requestId, key and whether a source was given at all. `env.get`/`env.set` pin the variable name (`Nt`), `state.get` pins the plugin/key/id reference (`Bt`), and `state.set` pins ifVersion and previous (`Fn`) and restores the two keys a rewrite drops. The two setters check their answer with `Er` rather than the generated check, because `Er` appends `et("deny", e, o)`: a `deny` that arrives after the `next()` beneath the hook was answered is refused with `a deny after its next() was answered (deny in place of next)`. That clause is reachable only through the setters, so it is copied with them. Fifteen blocks / 2,052 UTF-16 units of one module are the new generated copy src/plugin-chain-override-sites-source.ts (15 exports, 0 undeclared over 25 declared).

One measurement is recorded because the first probe read as a no-op: `we(keys)` is `(t, o) => m$(keys, t, o)` and `m$` restores a key only when the passed object does not own it, so passing both keys returns the object unchanged. The regression asserts both halves, a dropped key filled back and a key the rewrite owns left alone. The two files that asserted the old state (`test/plugin-chain-classic.test.ts` and `.audit/w45-chain-classic-compiled.mjs`, which pinned 101 and the seven as unregistered) were updated with the package. check/build/notices pass, 15 plans over 26 modules regenerate byte-identically, focused 9/9 across the three chain-site files, full 1,302/1,302, compiled driver `.audit/w45-chain-override-sites-compiled.mjs` green against `dist/`. [Package record](ports/W45-chain-runner.md#w45-13-landed-the-seven-value-sites-the-table-overrides-by-hand-2026-10-15), [evidence](ports/W45-chain-override-sites-evidence.json). The three classic hand-written sites are all that remains in [Q-087](question.md), and nothing raises these seven events yet.

## W45-12 - the two generated site families (2026-10-15)

The site table now holds the two families the source generates rather than writes out, so the registered count goes from thirteen to a hundred and one. The source folds name lists into sites (`zd = {...co(Q$n, se), ...co(HFs, Bbr), …}`, `co` at chunk-nyce03br.js [25838,25893)): `Q$n` is the 63 value events (chunk-m4qpskd4.js [45862,46732)) and `HFs` the 32 classic hook events ([47457,47506)), and `HFs` already excludes `classic.PreToolUse` by construction (`HFs = ao.filter(e => e !== "classic.PreToolUse")`, `ao = Ewr.map(e => "classic." + e)`). A value site is `{event, check}`, its check requiring `value` or `deny` (`se` at [25533,25619)); a classic site adds `checkArgument` (`Bbr` at [30837,30898)), which pins the twelve-key envelope `Mr` ([28437,28615)) and refuses a rewrite of any key the engine owns, while `check` runs the result rules (`Ur` at [30750,30837), the wrong-type sweep `Dr`, the `permissionDecision` rule `$r` and the updated-permission checks `Lr`/`Fr`). Nineteen blocks / 4,579 UTF-16 units of four modules are the new generated copy src/plugin-chain-classic-source.ts (20 exports, 0 undeclared over 38 declared).

The ten sites the source's own partition leaves out stay out, and the registration skips the seven value events the source's table overrides by hand (`ui.open`, `ui.close`, `ui.blit`, `env.get`, `env.set`, `state.get`, `state.set`) by name rather than giving them a generated descriptor the source does not hold for those names; the three hand-written sites (`classic.PreToolUse`, `tool.call`, `tool.check`) drag the lodash `pickBy`/`baseIteratee` subtree and wait for a package that takes it as its subject. Both are recorded in [Q-087](question.md). These names are not reachable through `ga` at all: `tht` carries the engine's own thirty-eight chain names, no `classic.*` and no value event, so the source's hooks subsystem hands `zd[name]` to `aP` directly. The regression and the compiled driver assert that shape rather than assume it. One tool fix is structural: the closure probe had three times reported an `import … from "/$bunfs/root/…"` statement as a declaration offset, and a copied one never resolves (it once produced `Identifier 'Vn' has already been declared`); `.audit/w45-11-missing.mjs` now classifies those candidates and prints `IMPORT <name> from <spec>` instead of a copyable range.

check/build/notices pass, 14 plans over 26 modules regenerate byte-identically, focused `test/plugin-chain-classic.test.ts` 3/3, full 1,299/1,299, compiled driver `.audit/w45-chain-classic-compiled.mjs` green against `dist/`. [Package record](ports/W45-chain-runner.md#w45-12-landed-the-two-generated-site-families-2026-10-15), [evidence](ports/W45-chain-classic-evidence.json). No product consumer dispatches these 88 sites yet, and the ten excluded names still find no site beneath their chains.

## W45-11 - the twelve chains whose cores this product can answer (2026-10-15)

The registry carried one chain name; it now carries thirteen, and each of the twelve new ones is the source's own core paired with the source's own site. The source's `yyt()` table lists twenty-seven names whose default answer is the engine's own; this package lands the twelve that answer from their argument and need no surface the product lacks: `agent.offer` (`{isOffered: true}`), `command.describe` / `config.describe` / `tool.describe` (their three-field projections through `COe` / `wre` / the inline literal), `prompt.autocomplete` (`{suggestions: []}`), `telemetry.mark` (`{value: void 0}`), `prompt.context` (the two lists handed back), and the five that return `{text: e.text}` through `HT` and its table `Cht` (`prompt.section`, `prompt.attachment`, `skill.prompt`, `attribution.text`, `session.receive`). Sixteen blocks / 1,282 UTF-16 units of chunk-sfn1dbxq.js are the new generated copy src/plugin-chain-cores-source.ts (16 exports, 0 undeclared).

The sites came with them because the source builds the pair: `Mm(e, n)` is `{site: zd[e], core: {name: "core", isCore: !0, budgetMs: 0, run: async (r) => n(r)}}`, so a core registered without its site is a chain with no argument rules and no result check. All twelve descriptors are copied range for range, with the rules their closure needs (57 blocks / 12,327 units of three modules into src/plugin-chain-sites-source.ts, 34 exports, 0 undeclared).

Registration order is load-bearing: `Mm` reads `zd[name]` when it is called and the copied cores call it at module scope, so `src/plugin-chain-sites-registration.ts` registers the twelve sites in a module of its own and `src/plugin-chain-registry.ts` imports it one line above the cores. Ten helpers the sites close over are already verbatim in src/plugin-chain-source.ts from the same chunk, so they are imported rather than copied twice (seven were added to that plan's exports, and the copier's export check needed a fix for `m$`, whose trailing `$` breaks `\b`). One host port: `rse` (chunk-m7864yc0.js [2196,2237)) is `z().neutralize(e)` and this product has no auto-memory provider, so it hands the text `Loe` already normalized through. check/build/notices pass, 13 plans and 26 copy files regenerate byte-identically, focused `test/plugin-chain-cores.test.ts` 3/3, full 1,296/1,296, compiled driver `.audit/w45-chain-cores-compiled.mjs` green against `dist/`. [Package record](ports/W45-chain-runner.md#w45-11-landed-the-twelve-chains-whose-cores-this-product-can-answer-2026-10-15), [evidence](ports/W45-chain-cores-evidence.json). The other fifteen cores and thirty-four sites stay open ([Q-086](question.md)), and nothing in the agent loop raises these twelve events yet.

## W45-10 - the composer's own highlight producers (2026-10-15)

The composer now builds the spans a chain answer's runs are painted over, in the source's own order, and `w9r` is back on the prompt path with the base spans it was written for. `composerBaseSpans` (src/tui-input-highlights.ts) ports the assembly [824770,825761) (991 units sha256 939a02777167c07e...) — the history-search query notice at 20, the `/btw` notice at 15, slash-command and MCP-mention suggestions at 5, teammate mentions with their theme colors, the ghost span dim at 1, the ultrathink rainbow per cell at 10, the spread runs, the ultraplan rainbow, the workflow keyword's `autoAccept` — and merges the marks with `pue`; `composerHighlights` ports the overlay call [826091,826184) (93 units sha256 39816ec5c84dd3ad...) including its three pass-through states and the caret range cut one grapheme wide by `ewe`. Eight blocks / 2,815 UTF-16 units of six modules are a new generated copy, src/tui-input-highlights-source.ts (15 exports, 0 undeclared). The four locals that drove the reading (`Ct`/`Pt`/`Mt`/`Ft`) were named from the component's own props [818309,818385) and the store selectors at 818823 rather than guessed. The gates stay inputs with the source's defaults (`Goe()` on, `vz()` off; the workflow-keyword pair off because its toggle UI is unported), and the registries the assembly reads (`Ndr`, `kye`/`Ls`, the MCP and teammate registries, the spellcheck marks) are inputs rather than ports. check/build/notices pass, 11 plans and 22 copy files regenerate byte-identically, focused 13/13, full 1,293/1,293, compiled driver `.audit/w45-highlights-producers-compiled.mjs` green against `dist/`. [Package record](ports/W45-chain-runner.md#w45-10-landed-the-composer-s-own-highlight-producers-2026-10-15), [evidence](ports/W45-highlights-producers-evidence.json). The per-character shimmer stays unrendered and `/btw` itself is still unported ([Q-083](question.md)).

## W45-9 - the highlight row mapping (2026-10-15)

A painted run now reaches the rendered rows the way the source does it, and the two inventions W45-8 left are gone. The input's own `getRenderedRowStartOffsets` (chunk-f37m98yh.js [24224,24395)) reports the draft offset each rendered row starts at; the input component filters the runs by the caret (`dimColor || cursorOffset < start || cursorOffset >= end`), maps them onto the rendered value with `S9r` (chunk-sfn1dbxq.js [463623,464165)), segments that value with `b9r` and the ANSI-preserving `Hht` class ([464391,465607)) and splits it on its newlines into styled rows. The tokenizer the segmenter walks (`_ns`) and the width tables it reports are a new generated copy, src/tui-sgr-tokens-source.ts (9 blocks / 3620 units); the row mapping and the segmenter joined src/plugin-chain-decorations-source.ts (now 6 blocks / 6089 units); `pn` is a Bun builtin in the source, so src/tui-ansi-strip.ts stands in with Node's stripVTControlCharacters. Divergences recorded: the React components are not ported as components, the leading pill shift and the per-character shimmer are not ported, and `w9r` is off this path because the app's base spans are unported. check/build/notices pass, 10 plans and 20 copy files regenerate byte-identically, focused 6/6, related 71/71, full 1,286/1,286, compiled driver `.audit/w45-highlights-compiled.mjs` green against `dist/`. [Package record](ports/W45-chain-runner.md#w45-9-landed-the-highlight-row-mapping-2026-10-15), [evidence](ports/W45-highlights-evidence.json). The composer's highlight producers (ultrathink and the other keyword spans, spellcheck marks, `pue`'s merge) were uncopied at this point; W45-10 closed that gap (see above).

## W45-8 - the painted decorations (2026-10-15)

A `prompt.edit` answer's `decorations` now reach the composer rows. The composer keeps two paint slots (`#y` shown, `#h` carried): `paint` [486016,486148) bets an answer's runs on the draft it answered, the publish clause's two sentences [482300,482690) move them to the carried slot when the draft moves without them, and `carryPaint` [486148,486354) rebases them across the edit that follows with `Rke(a7o(M.runs, yBe(h, T)), T.text)`; the relay binds both at the host ([831323,831404)), where `paint` is handed `Rke`-normalized runs. An answer with no runs clears the paint. Four blocks, 4,331 UTF-16 units of decoration geometry and the `w9r` span overlay landed as src/plugin-chain-decorations-source.ts (21 exports, 0 undeclared); the closure resolved to product homes that already exist (`D`/`nQt`, `ra`, `SCt`, `HK`), so the runner plan gained two exports only. `PaintedDecorations` carries the source's rules, `inputLineRanges` measures the draft range every rendered prompt row draws, and `paintPromptLine` splits a row into its runs, dropping the boundary tail the overlay reaches past. Four divergences are recorded (caller-supplied draft/repaint, the row as its own base span, the clamped tail, no markdown re-rendering inside a run). check/build/notices pass, 9 plans and 18 copy files regenerate byte-identically, focused 5/5, related 49/49, full 1,285/1,285, compiled driver `.audit/w45-decorations-compiled.mjs` green against `dist/`, identity `aa74a158…`. [Package record](ports/W45-chain-runner.md#w45-8-landed-the-painted-decorations-2026-10-15), [evidence](ports/W45-decorations-evidence.json). The app draft renderer's base spans and its markdown-aware row mapper remain uncopied.

## W45-7 - the module loads at install (2026-10-15)

The chain module of an installed plugin now loads inside the install and unloads inside the removal, so the window W45-6 recorded (a raise dispatching before the config read's dynamic import resolved) is closed at the source's own point: `vVe` (chunk-sfn1dbxq.js [2391122,…)) admits with `Re = await tGe(n, z)` in a try whose catch rolls back the chain's admission and rethrows [2392440,2392470). `reconcileChainHooksModules` in `src/plugins.ts` recomputes the store's declarations after each transaction and awaits `adoptPluginHooksModules`, so an install returns with the module loaded and a removal returns with it unloaded; the chain is still imported dynamically. Removal ports the source's sentence: `CVo` [2394700,2395092) hands the names that left to `iF` [2390389,2390919), which retires each record and logs `hooks modules unloaded: <labels> (plugin disabled or uninstalled)`. Three divergences are recorded rather than papered over: a changed module path unloads and reloads here where the source displaces in place and keeps the record's seat; this product keys by plugin name where the source uses the registry key; and a failed load reports to the caller where the source throws out of the admission after rolling back its own state. check/build/notices pass, copy regeneration is byte-identical, the focused suite is 7/7, the full suite 1,280/1,280, and the compiled driver shows `loadedByInstall: true`, `unloadLogged: true`, `adopted: []` after the removal. Identity `d145bf0b...`. [Package record](ports/W45-chain-runner.md#w45-7-landed-the-module-loads-at-install-2026-10-15), [evidence](ports/W45-install-load-evidence.json).

## W45-6 - the plugin hooks module (2026-10-15)

An installed plugin's chain module now reaches the chain. The surface is the source's: the plugin's hooks file may carry a `modules` array (`PGn`, chunk-sfn1dbxq.js [269575,269666)), `aEn` ([4054979,4056182)) returns it, and `aUr` ([4056182,4056874)) resolves the single entry into `plugin.modulePath` — two entries load neither with the source's own sentence, an escape is `path-traversal`, a missing file is `path-not-found`, and the plugin loads either way. Discovery exposes `hooksModulePath` / `hooksModuleProblem`; a config read hands the chain `{name, modulePath, path}`; the chain loads the module in process, answers a `prompt.edit` dispatch with it, and unloads it when the plugin leaves. `Fv` is back to the source's builtin lookup (empty here), and `loadChainModuleFileInto` applies `X3e`'s two refusals before reading. The first draft invented a `plugin.json` `hooksModule` field, a manifest-read path and an installed-plugin `Fv`; all three were replaced, and the reading is recorded. Also fixed: a config read that declares nothing still reconciles (so removals unload), `pluginHooksModulesSettled` waits until the pending promise stops moving, and the un-realpathed plugin-theme fixture behind W45-5's retained `/var` failure now realpaths its root — the full suite is green. check/build/notices pass, 16 copy files regenerate byte-identically, focused 6/6 and 8/8, related 101/101, full 1,279/1,279, compiled driver green against `dist/`. Identity `24098070...`. [Package record](ports/W45-chain-runner.md#w45-6-landed-the-plugin-hooks-module-2026-10-15), [evidence](ports/W45-hooks-module-evidence.json).

## W45-5 - hooks module loader (2026-10-15)

The copied loader now loads a plugin module file into the product's in-process environment host: `tGe`, `IN`, the registration checks `iWt`/`tWt`/`rWt`, the label `D5t` and the module inventory, 31 blocks and 4,999 UTF-16 units over five modules in src/plugin-chain-loader-source.ts. The environment hosts the loader names (`_Ko`/`l6o`/`lIo`/`dIo`/`vJt`/`Ygo`/`aZo`) are bounded ports with their reasons recorded, so the closure settled at 4,999 units instead of the 1,492,161 a port-the-hosts reading produced. Eight plans and their ledgers regenerate byte-identically, unresolved identifiers are 0, focused 8/8 (real module files on disk, dispatch, two modules folded in one hop, composer relay hook/unhook), chain 36/36, related 107/107, full suite 1,273 with two load- or environment-sensitive failures unrelated to this package retained. Identity `aef8b529...`. The independent review returned and its findings were checked against the source and applied: the host now folds *every* environment a dispatch names through the copied `aP` (it had run only the first, silently dropping a second plugin), and the plugin-facing continuation is the callable handle the source builds (`next(e)`, `next.to(e, tiers)`) rather than an invented `next.call(e)`. The VM/worker environment runtime, `rWt`'s advice and a product command that installs a chain module remain pending. [Package record](ports/W45-chain-runner.md#w45-5-the-hooks-module-loader-2026-10-15), [evidence](ports/W45-loader-evidence.json).

## W45 - complete memoize dependency (2026-10-15)

The copied chain cache now includes native detection and all Hash/ListCache/MapCache dependencies, 2 blocks and 4,648 UTF-16 units. Seven source/ledger pairs regenerate exactly; 29 focused tests pass, affected tests remain 161/162 with the existing `/var` failure, and five compiled CLI submissions plus twelve chain calls pass. Both independent validation findings were fixed and reprobed. Final identity `3f27d43a...`; runtime/installer and decoration painting remain pending. [Package record](ports/W45-chain-runner.md#memoize-dependency-completion-2026-10-15), [evidence](ports/W45-chain-memoize-evidence.json).

## API references

- https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/main/helpers.md
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls
- https://platform.claude.com/docs/en/build-with-claude/preserved-thinking
- https://platform.claude.com/docs/en/build-with-claude/compaction
- https://platform.claude.com/docs/en/build-with-claude/compaction-thinking-blocks
- https://platform.claude.com/docs/en/build-with-claude/context-editing
- https://platform.claude.com/docs/en/build-with-claude/token-counting
- https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript

The project uses the stable SDK surface. Previously researched beta features (thinking-binding-controls-2026-08-01, compact-2026-09-04, context-management-2025-06-27) were not enabled.

## W45-18 — the two permission-side classic events (2026-10-15)

Goal: give the last two classic call sites a product raise, or record why one cannot have one.

Read first: `dze` (chunk-sfn1dbxq.js [3063858,3064190)) with its input schema `aK`
(chunk-r2vtj1kh.js [192753,192908)) and its consumer `sxr` ([3317869,3319984)); `I9r`
([3063491,3063858)) with **its** input schema `hK` ([193916,194055)) and its single caller
([2288685,2289127)); the source's denial-kind mapping `mze` ([1006956,1007251)); the two answer schemas
(chunk-n3ykh62m.js [395544,395771) and [395412,395472)); and the `duration_ms` declaration
(chunk-r2vtj1kh.js [193030,193147)).

The caller measurement changed the package. The draft raised `classic.PermissionDenied` on every denial;
the source raises it only for an auto-mode classifier denial and classes every other denial as a kind that
raises nothing. The call was removed, the event name and its exact input shape recorded beside the deny
path in `src/agent.ts`, and a regression locks the rule: with the event hooked and `classicEventRaised`
true, a `permissions.deny` denial calls the handler zero times and the rule's own text still reaches the
model. `classic.PermissionRequest` landed on the approval path, raised after the native hook with the
source's own fields and folded on `permissionRequestResult` — `deny` blocks with
`message || "Permission denied by hook"`, `allow` carries `updatedInput` through the same permission
re-check a rewritten native answer goes through. `updatedPermissions`, `interrupt`, `permission_suggestions`
and `mcp_server` stay recorded as differences, each for a missing product surface.

The same reading found a W45-16 gap: both post events declare `duration_ms`, and that site never sent it.
The classic post input now measures the tool's own call.

Verification: check / build / notices pass; `verify-chain-copies` still passes over the same 21 plans
(nothing added); `test/plugin-chain-permission.test.ts` is 3/3, the focused set 24/24, the full suite
1,317/1,317; all twelve W45 compiled drivers exit 0, the new one `.audit/w45-18-compiled.mjs` printing
`W45PermissionCompiled.v1`. Identity `82806551…` (inputs e3bd2e99 / 297, validation 53f9298f / 118, build
60a50e5e / 209). Evidence: `research/ports/W45-permission-evidence.json`, and
[工作包](ports/W45-chain-runner.md#w45-18-landed-the-two-permission-side-events-one-raised-and-one-measured-shut-2026-10-15).

Q-094: the fixtures that spawn a child were budgeted its boot, so a loaded host killed them before they ran. Three cases failed while W45-28's records were written — test/lsp.test.ts (`timeouts cancel requests…`, a 3s wait behind a 150ms request timeout), test/mcp-progress.test.ts (`MCP request "initialize" … timed out after 90ms`) and scripts/smoke-magpie-startup.mjs's 100ms startup deadline (`starter PID marker missing: 8-deadline-100.pid`). All three reproduce at the committed baseline (detached worktree `dca9c20`: lsp 15/16, mcp-progress 7/8) and the request log of the LSP fixture came back empty when the wait gave up, which is what named the cause: `requestTimeoutMs` and `--startup-timeout-ms` also cover the fixture's own spawn and handshake, and a spawned `node` costs 150-170ms here. A probe child that reads a line and appends to a file answered in 11-12ms at load 39-77, ruling out starvation. Fixes are budgets only — lsp `waitFor` 3s -> 15s and fixtures 150/150/200 -> 2000; mcp-progress's child parameterized with a never-answering variant and budgets scaled as step < idle < total (200 / 500-700 / 900-2000), test ceilings 5s -> 20s; the startup driver's deadlines 100/300 -> 750/1500 behind one constant the report now reads (it was hardcoded). Two more sites of the same class (mcp-subscriptions 100, mcp-logging 200) went to 2000; in-process fixtures kept theirs. Verified under 30 concurrent CPU load generators (load 43-90): lsp 16/16, mcp-progress 8/8, the startup driver `passed`, full suite 1341/1341, packaged smoke 229 files with zero upstream requests. Evidence: `research/ports/W45-load-budgets-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-71: the `ui.scroll` and `ui.focus` call path, and the recovered-source index. A plugin that asks a site to scroll or to take the keyboard now has the whole road in the product: the two site descriptors the call is held to before it reaches the site (a whole-row offset that is checked and never restored; an element that may not appear where the move named none nor vanish where it named one; an envelope a rewrite may not change; and an answer whose refusal must be a non-empty string, so a silent refusal cannot read as success), the two registries the UI side files sites in under `component:requestId`, the ownership checks (a plugin may not touch a site another plugin owns, and a plugin forwarding another's call is refused where the same plugin calling on its own behalf is not), the keyboard holder checks, and the commit road whose refusal is the site's own sentence. The descriptors are their own module because the order they evaluate in is part of the behaviour: `Mm` pairs an entry with the site table entry while the entries are built, so the product's registry imports the descriptors first and registers both cores. The package is 19 blocks and 2,051 units over two chunks and two copies, adds no host boundary, and changes outside itself only where the product had to be wired — the registry, and three suites that count the site table, which is 113 now and says why. It also adds the recovered-source index (`scripts/source-index.mjs`, `research/ports/W45-source-index.json`): every chunk the product draws from, the statements it carries and the statements still missing, measured against the bundle's own layout rather than the package layout, with a digest of the covered statements in the source's order so a chunk can be reassembled from the copies and compared with the module it came out of. Evidence: `research/ports/W45-scroll-focus-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-70: the `$` call dispatcher. A plugin's `$.<name>(...)` call now has its own road in the product: the dispatcher reads the call table's entry, copies the arguments when the call carries a reference (so a hook cannot reach the object the plugin still holds), and runs the gate the call table's own steps sit behind. The gate is four rules — the caller's hooks module must be loaded and must have declared the call, the call must not be withheld, no hooks module behind it may be unadmitted, and a clock call is exempt from the last, because a plugin that is not yet admitted can still ask the time. The refusal a plugin hears is its own mistake in its own name (`p: $.ui.log refused: …`) except when the call was withheld, where the host says which module removed it and says so once per first segment. Two scan rules hold a declared module to what it declared: the environment variable an `env.get`/`env.set` call names must be in the scan's reads or writes, and the `{plugin, key}` a `state.get`/`state.set` call passes must be a reference the scan lists. Past the gate the call table does three things in a measured order — `raise`, then `stamp`, then the call itself — and an event the value-event catalog holds goes through the funnel instead, with a two-segment `interface.call` taking the funnel's own road. The package is 21 blocks and 4,182 units over three modules, it adds no host boundary (14 names imported from seven copies that already carry them), and it changes exactly one artifact outside itself: the runner copy's export list gained the override-dispatcher getter `swr`. Two names two other copies also declare (`Xt`, `Yo`) were decided by reading both bodies rather than by the name: this module means the environment name list and the plain-or-JSON name writer, so both are copied rather than imported. Evidence: `research/ports/W45-call-dispatch-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-69: the leaf table and the walkers that read it. The nine leaf checks were ported one at a time by the site-table packages; what was never carried is the table that names them and the three walkers the pane that draws leaves runs over a tree. The table is the dispatch: nine leaf types, each mapped to the check that refuses a bad one, every value a body another package already ported, so a caller holding a leaf of unknown type reads its own check out of the table. The walkers are what a tree costs to draw — the text a leaf contributes (a Svg's alt, a Button's children joined and winning over its label, an Input's label, the empty string when an Input has none), the height it takes (a Raster's or an Image's rows, a Markdown's lines, one line plus its wrapped text for everything else, and for a Code leaf past the twelve-line cap the diff it holds, read by a parser of its own), and the duplicate check that refuses the second leaf to take a key. The parser is the largest body here, and the reader over it drops the parser's marker lines and answers a refusal value rather than throwing, so a malformed diff costs the pane a sentence rather than an exception. The package is 15 blocks and 4,183 units over five modules, and it adds no host boundary and changes no other package's artifact: the nine checks, the two string helpers, the width helper and the error describer are read by name out of the copies that already carry them — 14 names over seven copies. One name two copies both declare (`ae`) was resolved by measurement rather than by name: the walker means the text-clamp copy's width helper, not the runner copy's plugin-state predicate. Evidence: `research/ports/W45-leaf-walkers-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-68: the keybinding module's row reader. With this the module is complete: the tables a Button is measured against (W45-66), the editor a keybindings file is read through (W45-67) and the reader a table is drawn from are all in the product. The reader answers one row per binding and hands each chord to the editor's splitter as the row is built, so a row carries keys rather than the string the file wrote, and it copies the action as it stands — `null` included, because unbinding a default is a row like any other. On the product's own defaults, the call the source's own caller makes, that is 226 rows over 27 contexts. The mapper beside it is what a freshly read file passes through: each block's bindings mapped value-wise, and the six legacy action names replaced by the names they are read as, with everything else left where it was — `null` included, since the check refuses it before the map is consulted. What the mapper calls is this chunk's own lodash `mapValues`: three statements whose guarded write keeps a key literally named `__proto__` a property of the answer instead of its prototype. The package is 5 blocks and 395 units, and it adds no host boundary — the helpers it needs are read out of copies that already carry them, and the one edit it makes to another package's artifact is the single export the internals copy needed to publish, recorded with that copy's new digest rather than made silently. Walking that map-values' closure naively is 153 statements and 10,660 units; 150 of them were already carried. Evidence: `research/ports/W45-keybinding-rows-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-67: the keybinding editor. The module is now complete but for its row reader: W45-66 took the tables a Button is measured against and this package takes the check a keybindings file is read through — the key parser, the chord splitter, the six legacy action names and the check that reads them, the 29 contexts and theirs, the action-or-command check, the reserved keys for the platform the build runs on, and the two schemas with the runtime checks that ask them. Two differences are worth the reading they took. The parser is not the comparison normaliser one package over: `Ye` folds `meta` into `alt` so two spellings of one key compare equal, while `mJ` keeps `meta` and `super` apart because a binding is stored as flags. And the runtime schema is genuinely weaker than the file schema — a context outside the 29, an action outside the 174 and a legacy name all pass it — because the values were checked once, when the file was read; the two checks that ask it answer `true` for an empty document and `false` for one bad block in two. The package is 15 blocks and 3,091 units over two modules, and it adds one boundary of the same kind as the fs boundary W45-46 bound: the seven names the copied bodies reach their bundled zod by are bound to the zod this product already depends on, each one read off the call site that uses it and made observable by a suite that writes a keybindings document through both schemas. Evidence: `research/ports/W45-keybinding-editor-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-66: the Button, and the keybinding tables it reads. The site table is complete — nine leaves, all of them in the product — and the Button came in last because it is the only leaf whose check reaches outside the table. An action is refused twice: once when the engine does not know the name, quoted back with its serializer, and once when the engine holds it alone, with the reason the reserved-key table carries. Both answers come from the keybinding module, whose ten statements are the defaults per context, the 174 action names, the seven reserved keys, the key normaliser with its alias table, and the two membership checks — `dcs(e){return pe.has(e)}` and the `acs` that crosses the reserved keys with the default bindings and finds exactly two actions, the two the Button's own sentence names. Reading the source turned up the difference that matters most for callers: a Button must be held by a plugin at all, because the press check it runs last is the shared predicate and that predicate refuses an absent press, where the Link's href check is guarded and admits one. The package is 13 blocks and 15,898 units over four modules, and it adds no host hook of its own: the platform header reads the platform through `O`, the boundary W45-46 already bound, and the only other reach is the runtime global the version comparison uses, which the copied body keeps verbatim, the scanner now knows by name, and the Windows suite installs as a fixture to prove the copied header calls through to it. Evidence: `research/ports/W45-button-keys-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-65: the Client, the Markdown and the Link. The three site leaves W45-63 measured and held out are now in, and with them the site table holds one unported leaf. Every one of the fourteen names they reach comes from a copy already carried — six of them, from the chain runner through the host-call copy that turned out to hold the Link's URI helper — so the package is three blocks and 2,785 units of pure leaf. The Client is checked entirely by other packages: the first-field problem names its keys, the W45-64 value budget describes its prop bag, that copy's prop rules measure its three numbers, and the raster leaves' own predicate stamps it — a stamp being a plugin name and nothing else. The Markdown is the one leaf that names its own site through a variable, prefixing with `Markdown "<key>"` when it has a key and `Markdown` alone when it has not, and leaving three of its sentences unprefixed even then: the props, the children, and both halves of the pairing between a press and the links it answers — a press needs a key whatever else the leaf carries. Its pressable-link list is a check of its own, and it measures an href as written where the Link measures it twice, as written and percent-encoded: a plain href of 2,048 characters fits and 2,049 does not, and an accented href of 1,024 does not either. The Link's own href check is guarded by the non-blank-string predicate, so an href that is not a string at all is not refused there, and its encoder percent-encodes everything outside the range that starts at a space and ends at the tilde, repairing a lone surrogate to U+FFFD before encoding it. The queue was corrected by measurement rather than restated: the Button's version subsystem is 430 statements and 127,575 units over sixteen modules with file-system, os, path and crypto edges, so it is walked in pieces. Two findings came out of the run itself — the `ne` helper the Markdown's closure reached is the runner copy's own statement, so nothing was copied twice, and a pre-existing flake in the lockfile regression block was reproduced in isolation and shown to be the library's per-path lock map orphaning a displaced holder's timer, which the source's own default then throws. Evidence: `research/ports/W45-client-markdown-link-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-64: the style-prop validators and the value budget. The dependency W45-63 named as held out — the error formatter behind the Client and the Markdown — is now carried whole: measured at exactly the 24 statements and 3,794 units that record predicted, across seventeen runs of chunk-nyce03br.js. A prop name is looked up in a fixed order — the ten-prop enum table, then the four sizes, the nineteen spacing names, the four sides, the three colours and the seven text styles — and anything else answers `has no value rule`, including props this chain knows elsewhere. The three numeric rules differ in ways reading them together hides: a size is `0 ≤ v ≤ 10000`, a spacing is a magnitude (`|v| ≤ 10000`, so a negative is admitted where a negative size is not), and a side must be a whole number of cells. A colour is a character class rather than a list, so a theme key, a name and a hex are one rule. A prop value that failed is described by a walk with a budget of 100,000 characters, 32 levels and 20,000 values, and the order of its checks is the behaviour: depth first, then the budget, then a value already seen, then a number that is not finite — before it is counted, since `NaN` would otherwise cost three characters — then a scalar, `undefined`, a non-object, a cycle, and an object whose prototype chain is deeper than one plain level. A value already walked is not a cycle; it is charged its stored cost again, which is why one call builds one budget. The list-length guard is the one body here that throws rather than describes. Two names are imported and never re-copied: the error class from the runner copy and the border table from the W44 tui copy, where `new Set(PFs)` is the Set `borderStyle` itself is. Two statements inside the package's own span are referenced by nothing and are asserted absent. The queue is corrected as measured: the Link's URI helper is already carried by the host-call copy, so only the version table behind the Button and the leaves behind their own helpers remain. Evidence: `research/ports/W45-style-props-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-63: the site leaves. Four more of the site tree's leaf problems, each with the shape W45-62 measured and each answering in its own order. Code names the leftover prop and checks its fields through the label and capped-string checks, then a start line within a billion and two enums. Input sweeps its own key list with an `every` and never names a field, checks its four fields in list order, then autoFocus, then the press, and its children only after all of that. Select checks the same key list, then label and value, then between one and 64 options — each through an option check threaded one Set, so a repeated value is caught on its second sighting — then autoFocus, the press and children. Svg names its leftover like the Image does and measures both sides with one sentence. The shared predicates are small and were measured rather than assumed: autoFocus must be exactly `true` or absent and a `false` is answered; a press needs a plugin name and a whole-number handle, so a leaf handed none is refused; a pixel side may be a fraction; and a hover-scope key that is wrong is dropped rather than refused, with two differently shaped sentences saying so. Eight blocks, 3,557 units, 15 statements, every dependency imported from a copy already carried. Three leaves of the same table were measured and deliberately held out — the Button and the Client drag a version table and an error formatter in with them, and Markdown and Link drag the formatter and a URI helper — and the record asserts the copy does not carry them or their helpers, so none of them can be half-taken later. Evidence: `research/ports/W45-site-leaves-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-62: the raster leaf problems. A leaf problem is a sentence about a leaf or nothing at all, and the two raster ones share the shape rather than a function. The Raster sends its props through a picker — a key that is a non-empty string and nothing else — so a stray field is refused there, in one sentence, and the field is never named; then no children, the key sweep, the default size check of 512 by 256, the cell decoder whose own problem is the message, and the stamp last. The Image destructures its five known props and *names* the leftover it found, because a press belongs on an enclosing Button, then answers the alt and key type sentences bare — the label does not exist yet — and from the alt check onward prefixes the message with its own key. Both share the label, which scrubs what the line pattern matches and cuts a key to 40 with an ellipsis, and the string check capped at 10,000 beside the uncapped one an alt goes through. Eight blocks, 1,980 units, 14 statements. The measurement corrected three first drafts: the control test admits a tab, a newline, a paired surrogate and the replacement characters while refusing an escape, a NUL, a DEL and a lone surrogate, so the message overstates what the pattern covers and the port keeps the pattern; an Image's alt and key type sentences carry no key at all; and a leftover prop inside the props is a different sentence from the leaf's own children. Evidence: `research/ports/W45-raster-sites-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-61: the raster surface engine. A frame is a flat array of cells, three entries each — a code point and two 24-bit colours — and `_b` reads it into the keys a row is made of, one key per colour *change* rather than per cell, each key a foreground and a background narrowed to four bits a channel and packed together. `gNs` builds a surface over `lb`'s state: `beginPaint` bumps the paint counter, resets `lastSgr` to the both-sides reset `ESC[39mESC[49m`, then walks the frame — a key the surface already holds only has its `lastPaint` touched, while anything else takes a free slot or the stalest one, admitted through the token row W45-60 ported at a cost of nothing for a fresh slot and 1024 for a reused one. `sgrOf` answers a key's escape: the held entry's, else the entry the nearest-slot matcher chose (recorded as an alias), else the last escape the surface emitted; `size()` is how many keys it holds and `standing()` reports `progressing`, `waiting` or `complete`, with the measured boundary that the matcher stops once a paint has evaluated 131,072 slots. Ten blocks, 4,374 units: seven runs of chunk-n3ykh62m.js and the three statements of the CSI helper in chunk-yn0pfn70.js, which is **ported rather than bound** — its closure measured three statements and no imports, so the source body was obtainable. Everything else comes from copies already carried: the cell stride, colour grammar and no-colour sentinel from the W45-58 blit copy, the bucket and encoder from W45-60, `Ge` from the chain-runner copy — each asserted not to be declared here, and the two constants derived from the copy rather than written as literals. Evidence: `research/ports/W45-raster-surface-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-60: the raster cell encoder and the admission bucket — what a surface paints a frame with, and what admits it. Eleven blocks, 1,209 units, ten of them runs of chunk-n3ykh62m.js and the last `Kbr`, the whole-number size check, in the chain-runner module. A cell is eight words: a flag and three channels for the foreground, then the same four for the background, written by `$f` from one packed pair whose low half is the foreground (`mc`) and whose high half is the background (`dc`), with the sentinel `ys` marking the side it is passed as. A frame is admitted by `Sb`, which refills the row against a clock (160 tokens a second over a 1000 ms base, capped at 4096, never backwards), records the clock, and admits only when `tokens - cost >= 1` — spending exactly one token however large the cost is, so the cost is a reserve to be left behind rather than a price, and a refused frame spends nothing. The row lives in the host registry as `rasterAdmission`, built on the first read by `mb`; the source hands the memoizer an invalidator, but `Ge` is `function Ge(t,e){return t}` — the chain-runner copy's own body, an identity in this build — so that invalidator is dropped by the source itself and the accessor has no reset. `tF` checks a key and size against the default 512 by 256 through `Kbr`, whose only free name is `h$`, a body the chain-runner copy already carries and W45-58 exported. The engine's own neighbours — `nb`, `fc`, `Ff`, `pc`, `Sc`, `gb`, `hb` — sit inside these runs and are deliberately not copied; the record asserts both that they are still statements of the module and that their bodies are absent from the copy. Evidence: `research/ports/W45-raster-cells-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-59: the mount side of the raster surface — what fills the two registries the ui.blit entry reads. Two blocks, 541 units, and each is a pair of adjacent statements in its module: `Yto` (the register helper, chunk-n3ykh62m.js [256712,256899) 187 units) with `hNs` ([256899,257058) 159 units), which calls it against `hs()` with the row `{rasters: new Set, windowStart: 0, blits: 0}`; and `ELs` (chunk-sfn1dbxq.js [1869519,1869676) 157 units — the statement immediately after W45-58's last block) with `vLs` ([1869676,1869714) 38 units), which does the same for `Yj()` and `{images: new Set, …}`. The register helper builds the row through `freshSite()` only when the key holds none, writes the same row object back on every later mount, and answers an unregister that takes the key only once the set has emptied and the map still holds that row — so a row's rate window and blit count survive a remount, and a row someone else has replaced is left alone. Both writers key their row with `e5t`, the NUL-joined plugin/requestId/key the blit computes, so a mount and a blit agree on the row. The registries and the key are imports of the W45-58 copy rather than copies a second time, and the element shapes are typed from the registry-state rows that package added. Evidence: `research/ports/W45-raster-mount-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-58: the `$` table's ui.blit entry. The source's table literal is `"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}` (chunk-sfn1dbxq.js [2353695,2353752) 57 units), and the entry is two floors: `bFo` sends an argument whose `source` is a plain object to the Image run and everything else to the Raster run. Seven blocks, 7,852 units: four contiguous runs of chunk-n3ykh62m.js (the base64 ratio and decoder, the ImageSource shapers, the rest of the ImageSource machinery including the validator, and the whole Raster side), the Image side and its selector in chunk-sfn1dbxq.js, the NUL separator in chunk-p16hdq43.js and the control-character pattern in chunk-tvdq3hrk.js. Both runs answer `{deny: text}` instead of throwing — no mounted row for the key (naming the other plugin that holds one), a size the mounted element does not have, more than 120 blits a second, or cells that are not the base64 of exactly the cells the size needs — and a blit that lands paints every mounted element of the size and answers `{}`. `$ne`, the location policy that opens the ImageSource run, is not copied: ./plugin-chain-fs-boundaries.ts has answered it for `$.fs` since W45-46 and quotes it, and the closure it would drag in is Bun's own namespace layer. Two carried bodies were exported rather than copied a second time: `h$` and `b3` were blocks of ./plugin-chain-source.ts without being exported. The seam gained the entry, the event name and a set of descriptive re-exports, and the registry-state typing gained the two mounted-site rows the runs read. One measured hole is asserted as the source's own: the Image path reports only the first mounted element's answer. The tick also repaired a defect this product's own W45-57 record introduced — 106 escaped code spans and a duplicated entry line in the coding standard — and the record script now asserts both. Evidence: `research/ports/W45-ui-blit-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-57: the `$` table's ui.notify entry. The source's table literal is `"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}` (chunk-sfn1dbxq.js [2353653,2353694) 41 units) and all three bodies are now ported: `Dzo` reads the text through `LVe` and, when a title is present, insists it is a string; `Fzo` fills an absent title with the plugin name; `Nzo` reads the committed flag `wn()` first — once the surface is committed it answers `no-surface` without asking the session — then calls the session's `notify` and maps the channel it answers with: five send channels answer `{isSent, channel}`, `disabled` and `none`/`no_method_available` answer their reasons, and `error` throws the source's own error class. Two statements in chunk-r2vtj1kh.js carry the flag. No new boundary: `LVe` is in the same copy, `bI` and `t` come from copies the ui seam already imports, and `He` has been in ./plugin-chain-source.ts since W45-2x. This package also models the `stamp` field the seam had only recorded: the plugin-facing dispatcher `G2e` applies `raise` then `stamp` then `run`, so a check sees the raw argument and a run the stamped one, while `Hze` — the path `raiseUiCall` mirrors — never reads it, which the suite asserts rather than assumes. Two measurements corrected the draft: the error class a failed write throws reports its `name` as `HooksError` (its constructor is `He`), and the raise path with no hooks runs the floor without consulting the check. A third is asserted as the source's own hole: `qQt`'s switch has no default, so a channel name it does not know answers `undefined` and the log line then throws a `TypeError`. Evidence: `research/ports/W45-ui-notify-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-56: the local settings store. Every settings read mutates one store per host — `Ixr` is `new q(() => new F8e)`, the factory class remembered in a `WeakMap` — and this package carries it: `mergedSettings`, `perSource`, the `parsedFiles` map with its `primedFiles` companion, the managed-read and listing caches, `repoTierFreeze`, `isLoadingFromDisk`, `pluginBase`, the `epoch`, `localStoreProbes=new Ht`, and the methods that load, seed, invalidate and diff them. 13 whole top-level statements, 6,401 units: ten from chunk-4bw62nzm.js and the policy pin with its state and setter from chunk-k1419ccf.js. The closure is 98 statements, but 88 of them (7,556 units) are the lodash comparison stack the product already carries, so the store imports them rather than copying them a second time — the only change on that side is one export, `M`. No new boundary, and one retired: the handle W45-54 introduced as a seam stood in for the single field the settings-source bodies read, and `ji()` now answers the real store, so that package's default is the source's own instance. Two measurements corrected the first draft: the install verdict reads its threshold only *past* the walk check, so an unpinned store cannot answer `raced` on a threshold alone, and `primedFolderListing` is gated on the pin rather than on a prior walk. The pin itself is write-once per process — `pinned`, then `unchanged`, then `conflict` with the flag left alone — which is why the suite and the compiled driver both assert it last. Evidence: `research/ports/W45-local-store-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-55: the settings merge layer. Every settings source is folded into one object with `mergeWith(..., Y3)`: `bTr` opens with `MB(r, e.store.pluginBase, Y3)` and merges each source into the same accumulator, and `Qnn` answers `MB(i||{}, d, Y3)` for the flag file and `MB(c, i||{}, Y3)` for the legacy local one. `Y3` is what "merge" means per key, and it is not lodash's default: `modelPicker` with a defined value is normalized by `ic` — the picker spread, its plain-object `options` elements spread in turn — two arrays concatenate and deduplicate under *any* key except `fallbackModel`, which takes the source array outright, and `extraKnownMarketplaces`/`managedMcpServers` take a one-level override; everything else returns `undefined`, which asks lodash for the default deep merge. 52 whole top-level statements, 4,033 units, all in chunk-3cynezh1.js: the 49 lodash-merge internals statements plus `CHt`, `Y3` and `ic`. No new boundary — every free name the bodies close over resolves to a copy the product already carries — but the package closed a defect W45-14 left behind: its closure followed declaration use, so a class whose methods are assigned on its prototype came across as a constructor alone, and `new k1e` had no `.get`. The merge layer hit it on the first nested object (`TypeError: c.get is not a function`), and the fix is four blocks, 784 units: the five stack prototype assignments, their method bodies and aliases, the `Fn` sentinel with the SetCache methods, and the SetCache prototype. Statement order turned out to be load-bearing in these copies — the aliases are `var`s, so a prototype assignment ordered before its method body keeps `undefined` — and the ledger now asserts the source order. Measured before asserted, with three corrections: the array union is not keyed, `ic` is a one-level shallow spread, and an array target with an object source keeps its elements and takes the source's keys as own properties (`JSON.stringify` hides that). Evidence: `research/ports/W45-settings-merge-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-54: the settings source → file layer. `GW(source, ctx)` resolves every settings read to its file — user settings are the `.claude` directory joined with the settings file name, project and local are the resolved directory joined with `.claude/settings.json` and `.claude/settings.local.json`, policy is `managed-settings.json` inside the managed directory, and flag is the context's flag path — while `Ynn` is the directory behind that, and answers the *cwd* for a policy source (measured; the managed directory is reached through `m_`). The local-settings decision is `RN`/`pTr`/`Z$s`: the canonical git root wins over the session cwd only when the root, its `.git` entry and its `.claude` entry are all owned by the current user, and the three warn lines it writes when it keeps the store where it is are the source's own. 36 whole top-level statements, 7,881 units across five chunks, plus the local store's probe cache `Ht` in its own 549-unit copy. Two boundaries, both recorded: the local store handle (`ji` is `Ixr.of(B().host)` and `Ixr` is the whole store class) — but its default is the source's own probe cache, so the probes are real and no refusal is needed — and the config context, whose ~30 fields the copied bodies read five of. The fs facade `ie()` and the realpath cache came with the copy rather than bounding, because the source text is obtainable. Measured before asserted: every source's file and directory, `TO` being a relative path rather than a name, the strict `===null` guard that makes `cwd: null` and `cwd: undefined` behave differently, the managed-settings cache, the ownership gate's three answers with their warn texts, the probe cache remembering answers but not throws, and the probes being read through the handle. Evidence: `research/ports/W45-settings-source-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-53: the `$` table's `settings.read`. The entry is one table fragment — `check:(n)=>yGo(n?.source)`, `run:(n)=>hGo(n)` — and the body behind it reads `e.source`: absent means the merged settings through `ft()`, a name means that source's file through `fe(J9[source])`, either way projected through `ZH`, which is a JSON copy rather than the store's own object, and answered as a promise with `{}` for a store that has nothing. The check admits no argument, an argument with no source, or a string naming one of the five keys (`user`/`project`/`local`/`flag`/`policy`), and refuses the rest with the list and the type it got. Four whole top-level statements, 449 units, all in chunk-sfn1dbxq.js; the ranges are explicit because that module's top-level map cannot be walked reliably — the same limitation W45-51 recorded for its 60k-line chunk. The settings store the body reads through is the next package, not this one: `fe` and `ft` are quoted verbatim in src/plugin-chain-settings-store.ts and a hook stands in their place, with the unported reach (`CT`, `Tp`, `y9e`, `M`, `yg`) named there. Unlike W45-48 and W45-51 the source has no negative branch here, so the refusal text is this seam's own and is recorded as such rather than presented as source behaviour. Measured first, then asserted: the five names, the check's three admitted and three refused shapes, the argument's `source` being what is read, the copy semantics (including a property whose value is `undefined` disappearing from the answer), the synchronous circular-structure throw, the file name and order the store is asked in, the chain's no-handler short-circuit past the check, and the body's own unguarded failure on an absent argument. Evidence: `research/ports/W45-settings-read-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-52: the store entry and its dispatcher. The four table entries — `store.get`, `store.set`, `store.delete`, `store.keys` — hand their event to `JAt`, which puts the dispatcher behind a serial queue per storage id; the dispatcher checks the key length, reads through the store entry, takes the store's lock for set and delete, holds the whole store to 4,194,304 characters, logs the key it wrote, and wraps anything the backend throws in the hooks error class. The store entry itself is `{read, write, lock}`: W45-51's read and carry, W45-50's atomic writer at 0600 after W45-48's directory, and W45-49's lock beside the store file with the options `pt` — which makes the store subsystem complete from the plugin surface to the file. 18 whole top-level statements, 2,343 units across four chunks; the four entries are table fragments and are ported verbatim into the seam with their spans quoted. Measured first, then asserted: the file's shape and mode, the own-key read, both limits with their exact counts, two writes not interleaving, the storage id the context holds against the plugin name, the backend slot replacing and restoring the store, the lock handle and its file, the two malformed-store texts, and the entry checks — which only a chain with a handler can reach, because with no handler the call short-circuits to `run`. One plan grew: the JSON text helper `_` joined the store-carry copy (it shares the parse's guard and length reporter, and this package's own module has an unrelated `Pe`), so that copy is now 21 blocks / 2,217 units and exports `_`, `L` and `Y`. Evidence: `research/ports/W45-store-entry-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-51: the store's read and carry layer. The store's `Se.read` calls `vt(id, S(id))`, so this package took the read with the carry behind it: 20 whole top-level statements, 2,133 units, across five chunks. When the store file is not there, its content is carried from the same plugin's built-in twin — `cc-plugin-tips@builtin` from `tips@builtin`, found through the short-name to package-id table — by writing the text as `<file>.carry-<uuid>`, linking that into place and removing it again. Text that parses to something other than a plain object is refused silently; a link refused because another session carried the store first is reported at debug and answers true; anything else that fails is reported at warn. Every branch was measured first, including both answers of the one hook this package bounds: `wD`, the platform-id test inside the application's plugin table, whose closure is more than 75,000 units of the application core — unbound it answers the test's own negative branch, so an uppercase platform half is used as written. Two honest limitations are in the record: that hook's absence, and that `mR`'s `toReversed()` cannot be observed ordering anything because the shipped table maps one short name to each package id. The store entry itself (`Se` with `He`, the lock and the write) is the next package. Evidence: `research/ports/W45-store-carry-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-50: the atomic file writer. The store's `Se.write` calls `vn(file, text, 0600)`, so this package took `vn` (63 units) and the body it calls, `Ope` (2,167 units), with the helpers they need: 34 whole top-level statements, 6,509 units, across chunk-1t033v1j.js and one error class from chunk-886tf6ja.js. The write stages the contents beside the target and publishes by rename, falling back to an in-place arm when the rename cannot cross a device or the staged create is refused — and raising the source's own error, with nothing left behind, when a caller refuses the publish. Everything was measured first: the mode the call leaves, the cleaned-up staging area, the refused-publish error's name and message, the once-attempted rename this build's inert retry helper implies, the in-place rewrite after EXDEV, a symlink target replaced rather than followed, and the read-only-directory fallback. Two honesty notes are in the record: the in-place "other names (a hard link)" refusal is unreachable in this bundle because the gate flag is false and its only setter is outside the closure, and the acorn check that catches a needle resolved as a function instead of a statement — six blocks here — is now part of the record script. Evidence: `research/ports/W45-atomic-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-49: the lockfile library. W45-48 named it the store family's first precondition, and this package took it whole: chunk-c6qwr3kc.js is one module whose closure for this slice is its entire body — proper-lockfile, the product's three wrappers over it, and the vendored dependencies the lock runs through (graceful-fs, retry, signal-exit). Sixteen statements, 22,356 units, and the closure was computed rather than guessed: an acorn walk seeded from the store's own imports shows nothing outside those sixteen is referenced. One name is bound instead of copied — `Le`, the bundle's require, quoted from the runtime chunk and answered by `createRequire`. Everything was measured before it was asserted: the handle is its own release with `Symbol.asyncDispose` attached, a live lock is refused ELOCKED, a waiter wins only because of the retry schedule, a stale lock is taken over, and a release with nothing to remove is logged rather than thrown. Two first-version slips were caught by the artifacts: the driver's log helper yields messages without the level prefix, and the seam first typed the handle with a `release` property the library does not have. Evidence: `research/ports/W45-lockfile-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-48: the `$` store's file layer. W45-47 measured the store family as three packages away, and this package took the one layer of it that stands alone: how a plugin's store file is named (`ue` — safe ids verbatim, anything else sanitized, cut to 64 characters and given the first 12 hex digits of the id's sha256, with `.`, `..` and the Windows device names always hashed), where it lives (`S` — the data directory, `store`, the name), the directory made recursively at 0700 (`xe`), and the touch that logs rather than throws (`St`). Eight blocks, 574 units, one module, and this is also the first plan located by needle: the plan names each declaration the way the module spells it, so the ranges are computed by the generator and re-read by the record instead of transcribed. The one name the layer cannot carry is the data directory `bl()`, whose body reads the configuration directory — the config/home subsystem — so all four of its bodies are quoted verbatim and the hook refuses rather than guessing a path when unbound. Two first-version assertions were wrong and were caught: `..` sanitizes to two underscores, and `???` keeps its underscores rather than falling back to `plugin`. Evidence: `research/ports/W45-store-path-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-47: `$` ui.selection, and the literal's remaining-entry audit. One entry was ready — `"ui.selection":{run:u2t}`, 24 units of table text over the copied 53-unit body `()=>Promise.resolve(bI()?.selection?.read())` — and it cost no new import, no new source file and no new build input, because the ui copy already imported `bI`. Its shape is the slice's odd one: no `check`, so no argument is ever refused, and the floor is the body itself. The rest of the literal is blocked, and this package measured each blocker instead of discovering it later: the store family waits on a lockfile library (chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (chunk-1t033v1j.js, 12,458 bytes) and a data directory; `settings.read` on the settings store; `http.fetch` on its request runner; `ui.copy` on a clipboard encoder and the surface catalog; `ui.blit` on the image and raster registries; `fs.ancestors` on the tool-context roots; `state.*` on the scope accessors. One finding is recorded for whoever takes `ui.copy`: table entries can carry `stamp` as well as `check` and `run`. Evidence: `research/ports/W45-ui-selection-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-47: `$` ui.selection, and the literal's remaining-entry audit. One entry was ready — `"ui.selection":{run:u2t}`, 24 units of table text over the copied 53-unit body `()=>Promise.resolve(bI()?.selection?.read())` — and it cost no new import, no new source file and no new build input, because the ui copy already imported `bI`. Its shape is the slice's odd one: no `check`, so no argument is ever refused, and the floor is the body itself. The rest of the literal is blocked, and this package measured each blocker instead of discovering it later: the store family waits on a lockfile library (chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (chunk-1t033v1j.js, 12,458 bytes) and a data directory; `settings.read` on the settings store; `http.fetch` on its request runner; `ui.copy` on a clipboard encoder and the surface catalog; `ui.blit` on the image and raster registries; `fs.ancestors` on the tool-context roots; `state.*` on the scope accessors. One finding is recorded for whoever takes `ui.copy`: table entries can carry `stamp` as well as `check` and `run`. Evidence: `research/ports/W45-ui-selection-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-47: `$` ui.selection, and the literal's remaining-entry audit. One entry was ready — `"ui.selection":{run:u2t}`, 24 units of table text over the copied 53-unit body `()=>Promise.resolve(bI()?.selection?.read())` — and it cost no new import, no new source file and no new build input, because the ui copy already imported `bI`. Its shape is the slice's odd one: no `check`, so no argument is ever refused, and the floor is the body itself. The rest of the literal is blocked, and this package measured each blocker instead of discovering it later: the store family waits on a lockfile library (chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (chunk-1t033v1j.js, 12,458 bytes) and a data directory; `settings.read` on the settings store; `http.fetch` on its request runner; `ui.copy` on a clipboard encoder and the surface catalog; `ui.blit` on the image and raster registries; `fs.ancestors` on the tool-context roots; `state.*` on the scope accessors. One finding is recorded for whoever takes `ui.copy`: table entries can carry `stamp` as well as `check` and `run`. Evidence: `research/ports/W45-ui-selection-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-47: `$` ui.selection, and the literal's remaining-entry audit. One entry was ready — `"ui.selection":{run:u2t}`, 24 units of table text over the copied 53-unit body `()=>Promise.resolve(bI()?.selection?.read())` — and it cost no new import, no new source file and no new build input, because the ui copy already imported `bI`. Its shape is the slice's odd one: no `check`, so no argument is ever refused, and the floor is the body itself. The rest of the literal is blocked, and this package measured each blocker instead of discovering it later: the store family waits on a lockfile library (chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (chunk-1t033v1j.js, 12,458 bytes) and a data directory; `settings.read` on the settings store; `http.fetch` on its request runner; `ui.copy` on a clipboard encoder and the surface catalog; `ui.blit` on the image and raster registries; `fs.ancestors` on the tool-context roots; `state.*` on the scope accessors. One finding is recorded for whoever takes `ui.copy`: table entries can carry `stamp` as well as `check` and `run`. Evidence: `research/ports/W45-ui-selection-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-47: `$` ui.selection, and the literal's remaining-entry audit. One entry was ready — `"ui.selection":{run:u2t}`, 24 units of table text over the copied 53-unit body `()=>Promise.resolve(bI()?.selection?.read())` — and it cost no new import, no new source file and no new build input, because the ui copy already imported `bI`. Its shape is the slice's odd one: no `check`, so no argument is ever refused, and the floor is the body itself. The rest of the literal is blocked, and this package measured each blocker instead of discovering it later: the store family waits on a lockfile library (chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (chunk-1t033v1j.js, 12,458 bytes) and a data directory; `settings.read` on the settings store; `http.fetch` on its request runner; `ui.copy` on a clipboard encoder and the surface catalog; `ui.blit` on the image and raster registries; `fs.ancestors` on the tool-context roots; `state.*` on the scope accessors. One finding is recorded for whoever takes `ui.copy`: table entries can carry `stamp` as well as `check` and `run`. Evidence: `research/ports/W45-ui-selection-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-46: the `$` filesystem floor. The family turned out to be one body with five entries: `fs.read` (`hzt`), `fs.write` (`_zt`), `fs.list` (`gzt`), `fs.exists` (the one inline entry object, ported as its own arrow) and `fs.stat` (`yzt`) all run `HE` — 1,819 units that resolve the path against the caller's cwd, check the location policy, and then read (64 KiB chunks, a 4 MiB limit, base64 for `as:"bytes"`), write (a 4 MiB limit refused before the disk is touched, directories made first), probe, stat (following a link whose target is reachable, `realPath` only on request) or list (sorted, with kinds). Two names inside that body are not carried: `$ne`, the location policy, and `O`, the platform. Rather than approximate them, the seam quotes each verbatim from its module, names the unported closure, and binds a hook — and the record re-reads the quoted text so the boundary cannot drift. Everything was measured before it was asserted, and three first-version mistakes were caught by the assertions: the bytes form is an object carrying `base64` rather than a string, the port reads its process cwd through the bound `se()` rather than live `process.cwd()`, and an entry check runs only when a handler is in the chain, so a bad path with no handler reaches `path.resolve` and throws its own `TypeError`. `fs.ancestors` and the four `store.*` entries are recorded as not ready with their exact reach. Evidence: `research/ports/W45-fs-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-45: the `$` clock and env floors. The session floor's neighbours split cleanly: the clock and env families stand alone, and `state.*` does not — its bodies reach `Jf` and `KD`, the scope accessors Q-086 is about, and neither is in the product, so it is recorded as not ready rather than started. Ten bodies (1,158 units, two modules) give six entries: `clock.now` (`cDo`), the one entry object `vme` that `clock.sleep`, `clock.after` and `clock.every` all share, and the two env entries over `s2t`/`pFo`/`gFo`. The only cross-package name they need is the abortable wait `Q`, which W45-22 already carried with its clock — so this package imports it, and the record asserts the reuse by reading the stream source's export line and its body rather than describing it. Measured before asserted: `clock.now` answers the process clock and not the injectable one; the wait runs on the caller's own signal and rejects with exactly what `pwr` makes of the reason (an Error as it stands, a string's text, a bare abort's DOMException, and `wait aborted` only when a signal carries no reason at all); a finite ms is all the check asks for, so `-1` and `1.5` pass; `USER_TYPE` is always `external`; and `env.set` with no value unsets the variable. The driver's first version attached an already-aborted signal to something other than the caller and measured a full second of waiting, which is how the caller-signal contract was confirmed instead of assumed. Evidence: `research/ports/W45-clock-env-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-44: the `$` session read floor. W45-43 left the table beyond the ui floors as the next sliceable item, so this package started by scanning all 62 entries structurally — span and names for each — and then asked of every one whether its callees are already in the product. Seven are: `session.cwd`, `session.root`, `session.model` and `session.id` through `Bpe`, `session.turns` through `WAo`, and `session.surface`/`session.surfaces` through `uMo`/`cMo` over `Xte`. Nine bodies, 1,601 units from three modules, none of which needed a callee this port lacks — the drawing registry behind the surface reads is self-contained, and it reports a detach on the same sources-change signal W45-35 ported. The four process fallbacks (`K`, `se`, `Ee`, `tt`) are a host boundary: their bodies reach the session record, the process config, the ambient cwd store and the model a command asked for, and this port has none of those surfaces, so the seam header quotes all four verbatim with chunk and range, and the record re-reads each range and fails if a quoted body is not the module slice. Measured before asserted: the four no-session log lines read back out of the chain log; only `model` asks the bound session first while id, cwd and root come from the process; a caller's own cwd wins; six messages in, two turns out; `"terminal"` leads the surface list only for a terminal session; and the registry's own attach-merge, detach report, silence marks and dedupe. The four entries with subsystems behind them — `session.messages` (`PAo`, the conversation store), `session.repo` (`MAo`, the git work tree), `session.authorize` and `session.compact` — are named from the table and asserted unbound in product code, so binding one later fails this record's check. Evidence: `research/ports/W45-session-floor-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-43: the documentation artifact, and a queue correction. The W45-38 and W45-39 record writers were built through shell heredocs, so the escape their template literals needed for a backtick reached the documents: 1,146 inline code spans across four files carry a literal backslash. The cleanup removes exactly those backslashes, checking position by position that nothing else moves, and refuses to write if the only difference is not those removals; a guard scans the W45 evidence documents and the record fails on anything but zero, so a future writer that reintroduces the escape fails at record time instead of at review time. The same tick re-read the two queue items it stands in for and demoted both: the config record behind `BEo` is built from about twenty accessors whose nine field names appear in no product file, and the reload behind `zLr`/`sc` waits on a load pipeline (`Xs`, `X6o`, `jN`, `PPr`, `xas`, `lvo`, `Pxs`) that is unported too, so both are subsystems rather than packages. The record asserts those absences, which means the day the product grows them the verdict expires by itself. No product file, test or build output changed: the tree identity is still `554cb016…`, which is why this package re-runs no sweep and why W45-42's 1436 tests / 1436 pass / 0 fail stands. Evidence: `research/ports/W45-doc-spans-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-42: the invalidation calls. W45-41 named this family, and reading the six bodies showed that four stand on their own: `Hz` (skill dirs and markdown files), `YCn` (the plugin registry's hook-registration slot), `_7` (agent definitions with the markdown files and the agents slot) and `bCn` (output-style dir styles with the markdown files and the styles slot). All four are copied verbatim, 281 units, with no new callee: `$hr` and `Uhr` come from W45-40's copy, `it` from the host and `xr` from W45-41's seam. The other two are blocked and the block is read from the source rather than assumed: `VT()` is `xr().invalidateCommands(),BEo()`, and `BEo` is `MR(M()).shadowedHelperSources` in chunk-x0dc37w9.js, where `M()` is the per-host config record; `shadowedHelperSources` appears in no product file, so supplying a `BEo` that returns nothing would decide for the source what shadowed helper sources mean. The record re-reads both bodies and asserts the name is still absent, so the day that store is ported the record's own check fails and the pair moves back into scope. Measured before asserted, with every watched name seeded: each call moves exactly its own names and nothing else, a second call changes nothing more, the skills call also clears the current source kind's conditional tables while leaving its refused names, the command table survives all four because its invalidation is the blocked one, and the hook call leaves the markdown files alone while the three source calls drop them. Evidence: `research/ports/W45-invalidate-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-41: the source registry. Following W45-40's five clears to their callers showed that most of what the plugin-source re-read drops is not the plugin registry at all: `xr().invalidateCommands()`, `xr().markdownFiles.clear()`, the agent, output-style and workflow tables. `xr()` is chunk-qm4226vk.js, a 3,516-unit module that is one class: the store of everything derived from folders, marketplaces and builtins — seven load caches, the command tables behind three `void 0` fields and four Maps, the skill tables (one of them weak), a per-source-kind dynamic-skill state keyed by the module constant `"cli"`, and two live signals reusing the ported `Oe()`. Four declarations are copied verbatim (2,728 units), and the accessor with its per-host memo is the host boundary: the seam builds the singleton lazily under the source's own name and offers a factory for isolated stores. Measured before asserted: the cold store's eighteen empty Maps, four arrays, two Sets and four genuinely weak containers (a string key throws); the three command tables `undefined`; `invalidateCommands` emptying exactly its four Maps while `markdownFiles` keeps its entry; `invalidateSkillDirs` clearing the current key's conditional tables and doing nothing when the key has no state; `clearLoadCaches` as the command invalidation plus the eight derived tables; `evictDynamicSkillState` deleting only the `p1:` prefix so `p1x:one` survives; and the weak-keyed memo answering one build for two calls. Evidence: `research/ports/W45-sources-registry-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-40: the registry's invalidation surface, and the end of chunk-3ph567jx.js. W45-35 copied that module's registry literal and left the accessor's own machinery plus seven small bodies; the seven are pure and copied verbatim (306 units over one module — the two reads `wms`/`$Dn` and the five slot clears `Nhr`/`Fhr`/`$hr`/`Uhr`/`UDn`), and the four statements of the accessor are recorded as the host boundary instead: the source builds one registry per host under a memo keyed by a context value, and this port has one host and already builds the same state lazily inside a function carrying the source's own name. The seam header quotes that range and an audit script asserts the quote equals the module text. With that, the module has no unported declarations left, and the check is derived rather than asserted: every top-level statement must fall inside a range some ledger records or inside the boundary, and only the module's imports and its export list do not. Measured before asserted: each reset moves its own slots and no sentinel field, a repeat is a no-op, the four compositions the source's call sites build clear the union of their parts, and the registry literal carries all seven fields with all seven unset, which is why the resets are correct on a cold registry. Next is the plugin-source re-read that calls them. Evidence: `research/ports/W45-registry-reset-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-39: the notification queue owner. The source's `vo` hook is the object every surface takes from the notification context, carrying `processQueue`, `addNotification` and `removeNotification`; ten bodies around it are pure and copied verbatim (773 units over two modules — the suppression gate whose capability probe answers `!1`, the holder factory, the drop, the diff-panel exemption and the three priority helpers), and the hook's own five pieces are transcribed rather than rewritten: the seam keeps the hook's local names so each closure body is the module's text, and a new audit script extracts both sides, strips the hook wrappers and the two parameter annotations, and fails on any difference (all four closures identical, the suppression expression identical and equal case by case). The drain's hidden test `Cj` stays W45-31's copy; the store, the clock, the provider's holders and the two context values arrive as parameters, and `p4n`'s chain ends in a host capability this product does not have, so the default presentation is the caller's. Measured before asserted: the gate is closed, the drain picks the highest priority only into a free slot and refuses everything while a diff panel holds non-exempt entries, the push has four branches (pinned, immediate with its early return, held behind a panel, folded) and two duplicate paths that write differently, and the mount effect cancels the timer only on the last unmount. Evidence: `research/ports/W45-notify-queue-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-38: the bar's mount layer, the effect that puts the ported tick on a host. The source mounts it from the bar component `JFe`, which reads a clock context, a store handle, makes two refs and re-runs on `[h, T, ee, he, we]`; this product has no React, so src/plugin-chain-bar-mount.ts keeps the body's logic and takes the host layers as parameters — the two selectors' joined keys, React's per-member `Object.is` comparison, the driver's two refs, and `XFe`'s raise/clear-and-drain pair for the pane hold. Nothing was copied twice: `TK`/`Cj` (W45-31) and `SEt`/`RYr` (W45-28) are already ported and the record script asserts each declaration where it lives; the two bodies still missing — `YAt` and `gro`, the shown-pane read the hold selects with — are copied verbatim (2 blocks, 101 units). Measured before asserted: the keys join as the source joins them, mounting ticks once and hands back `M.current?.()`, a dependency change re-runs the effect over the same driver so the ledger carries across, and the hold writes nothing when no pane holds, clears before it drains, and keeps the same state object when the flag is already up. The queue drain itself (`processQueue`, from the notification context `vo`, 3,470 units) is the next package. Evidence: `research/ports/W45-bar-mount-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-37: the tab and ESC-sequence expander, the last boundary on the label path. Five blocks (890 units) of chunk-bf3z2ftn.js — `Epe` the entry, `mCo` the expander, `ht` the tokenizer entry, `yt` the token reader and `mt` the C1 replacement — join the normalise copy, and the ESC state machine they drive is not copied at all: src/tui-ansi-tokenizer.ts already carries `twe` and `L` byte-identical to the module, and a new audit script recomputes that comparison so the reuse is measured. The three throwing stubs and their seam file are gone; a plugin id carrying a tab is now drawn at the next eight-column stop instead of refused, and the regression and the compiled driver assert the expanded label. This tick also corrected a claim its predecessor got wrong: W45-36 recorded `check: pass` from a run that predated its own test file, and this package's re-run found one TS7006 in it, now fixed and described where it was claimed. Evidence: `research/ports/W45-tab-expander-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-36: the plugin label sanitiser. Forty-five blocks (4579 units) over five modules close the boundary W45-32 left: `Mde` and the whole display pipeline under it — the code-point predicate chain that turns every invisible a plugin id can carry into U+FFFD, the eight-mark budget, the trim, the fold that drops the variation selectors and replaces the controls, and the grapheme-budget preview with its 24-column first-line clamp. The label path is live: `pluginLabel('engine')` is `engine` and the host toast stacks under it, where the push used to throw. The one block still missing is the tab and ESC-sequence expander, and the label path can reach it only through a tab, because the fold above it has already replaced every ESC-class byte. The port also fixed a silent defect it uncovered: `bindToastClock(null)` handed the registry a null clock that the copied push reads on every call, so unbinding now restores the factory's handle. Evidence: `research/ports/W45-label-text-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-35: the plugin-state registry. Six blocks (3,330 units) over three modules put the source's own registry in place of this product's hand-written ten-field stand-in: `Zco` the plugin-state store, `edo` the toast clock, `s` the 89-field literal, `gs` the store and `Oe` the change signal under them, `Ein` the async-resource binder. The registry now always carries a real store, real panes and a real clock, and its `hooksRespawns` is the source's Set — an array there had left the ported respawn gate reading `.size` as undefined. It is built on the first `it()` call, because `s()` reads constants out of chunks that import this seam back; the eager version answered `getState() === undefined` for panes, which the new regression caught. The host lookup the source wraps around it (`q`/`B`/`Wi` into the application host) stays open with its ranges recorded. Evidence: `research/ports/W45-registry-state-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-33: the toast module's remaining verbs. Four blocks (681 units) in the module W45-32 took the stack from: `IEe` dismissToast, `pvt` expireToasts, `dV` holdToast and `bee` pauseToasts. Every free name they read was already ported, which is how the boundary was chosen. A dismiss flags the id in `cI` and the write it triggers consumes the flag, so a dismissed toast is never reported undrawn; an expire folds and writes; a hold stamps or releases and adds the held time back to the deadline; a pause moves every deadline and every hold by the time that passed while the bar was stopped. Only the clock factory `edo` (chunk-3ph567jx.js) is left of this module's reachable surface, and it belongs with the registry's stores. Evidence: `research/ports/W45-notify-verbs-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-32: the host toast stack. Seventeen blocks (2,268 units) over three modules: the stack reader `bu`, the toast clock `TC`, the timer arming `yee`, the per-plugin cap `aV`, the undrawn report `See`, the stack writer `bh`, the push helper `wee` and the host toast method `EEe`, with the constants, the fold transform `MF`, the shallow list equality `$P` and the plugin label policy (`Nle`/`SKr`). A write trims the stack, stores it under `Pye(IF)` when the list differs, reports what left undrawn unless the bar drew it, folds, and arms one timer for the next deadline. The label sanitiser `Mde` is not ported: ./plugin-chain-plugin-label.ts throws naming the block, and no caller reaches it yet. Evidence: `research/ports/W45-notify-stack-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-31: the bar's clock driver. `TK` [478764,479204) is the tick a surface runs on its clock, ported with the hidden test it feeds the split (`Cj`, `diffPanelVisible || paneHoldsToasts`, no coercion). One tick splits the store's queue, ticks the stored ledger against it, cancels the timer the previous tick armed, writes the ledger back through `xYr`, reports the time each toast lost, refreshes the queue's texts (keeping the same state object when nothing changed) and arms the next tick at the deadline `dLs` gives through the clock's own `setTimeout` — whose return value is the canceller `pending.current` holds, the contract of the source's own clock facade (`mIr`/`nS`). Evidence: `research/ports/W45-notify-clock-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-30: the plugin-state store's reactivity. The fold scheduler `Ci` and the cluster it drives are ported (20 blocks, 1,781 units over five modules): the two paces and their intervals (live 34ms, steady 100ms), the 1000ms throttle that forces a reader back to steady, the classifier that reads a reader's pace from its instance, the one-shot fold run, the stale/reader fan-out and the render-version bump. `Ci` is what `vb` calls, so W45-29's explicit "not ported" boundary is closed: the stub in `plugin-chain-notify-store-runtime.ts` is replaced by the real body and both places that asserted the throw now assert the scheduling. The registry gains `renderVersions` and `panes` (the source's own `gs(...)` literal, bound by the seam here since this product has no store factory) and the plugin-state store gains the fields the scheduler touches. Evidence: `research/ports/W45-notify-fold-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-29: the notification bar's write half. Eleven blocks (1,489 units) across four modules carry it: the append (`lLs`, `isManaged` from the plugin's seat), the write-or-skip (`xYr`, which writes unless both ledgers are empty and logs when the write fails), the state store's set (`o5t`: JSON round-trip under `jde`, version from the stored value and the floor, the write inside `ls.exit`, then `vb`), the reader notification (`vb`) and the seat check (`Ee`/`sOn` over `Zws`), with the deep freeze (`O`/`cho`/`OFe`) the stored value goes through. Four names are facilities rather than logic and are bound in one hand-written module: `ls` is the source's own `AsyncLocalStorage`, `_`/`Y` are the JSON round-trip, and `Ci` — the fold scheduler — is not ported and throws with the reader count, which is this package's boundary. The port surfaced a real interface defect from W45-28: `setState` was typed inside `getState()`'s return while the source body calls it on `values` itself, so the first write failed at runtime; the type is corrected in the source and both fixtures. Evidence: `research/ports/W45-notify-write-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-28: the notification bar's stored state. Seven blocks (863 units) carry the key it is kept under (`a8` "engine", `Ope`, `Pye` → `engine\x00bar-toasts`), the schema of the stored ledger (`TWt`, whose own lazy-memo accessor `p`/`RTr` is copied verbatim — binding it to `z.lazy` fails at once) and the read (`SEt`), which parses what the store holds and falls back to the frozen empty ledger. The schema's six minified builders are bound to the product's zod in one documented module, each with the extracted declaration that identifies it; the boolean is settled by the append path's round-trip. The registry gains `pluginState` from the source's own literal. The write half and the `TK` driver are the next package. Evidence: `research/ports/W45-notify-store-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-27: the notification bar's ledger core. Sixteen blocks (2,897 units) of chunk-sfn1dbxq.js carry the bar's whole time account without the store: `aLs` is one tick — age by the running slot (`PWt`), hand the queue's time out and lose what no waiting toast can hold over `a3` (`CWt`), lay out what is kept (`AWt`/`OWt`/`MWt`) — with `RWt`/`IWt`/`RYr` the ledger shape, `cLs` the merge with the store, `dLs` the next delay, `pLs`/`u1e` the text a plugin changed, `iLs` the cut-short test and `uLs` the lost-time line. The store half (`Ope`/`TWt`/`SEt`/`xYr`/`lLs`) and the `TK` driver stay with the bar and are recorded with their ranges. Evidence: `research/ports/W45-notify-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-26: the `$` table's `ui.toast` floor and the admission policy behind it. The floor is `Kxo` — the same `Vyt` gate as `ui.status`, around `session.toast(plugin, BDe(text), timeoutMs)` — and its `check` bounds a present `timeoutMs` to whole milliseconds 1..60000. Six blocks (1,265 units) carry the policy: key naming `sI`/`gLs`, the 50-per-plugin cap `ACn`/`DWt`, the decision `hLs`, the queue split `sLs`, the give-way report `mLs` and the once-per-spelling notice `AQo`, plus `yro`/`F2e`/`fLs`/`Sqt`. The bar itself (store, zod schema, the `TK` clock driver) is the host surface's and is recorded as the next package with its integration site. Evidence: `research/ports/W45-toast-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-25: the custom-theme loader's reader path is closed (Q-093). The scan W45-24 left behind found four names `src/tui-custom-theme-source.ts` reaches and never declares — the paging driver (`Wi`/`Yf`), the namespace-key table (`Fe`, with `r`/`f`/`h`) and the error text (`gt`/`i`) — reachable only when the loader is handed a reader, which no test did. Three contiguous ranges (3,499 units) are spliced verbatim, the ledger gains a repeatable verifier (`records 14 bad 0`) and two regressions drive `load(reader)` end to end. Evidence: `research/ports/W45-theme-reader-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-24: the `$` call table's ui.status and ui.log floors are ported (src/plugin-chain-ui-source.ts, 14 blocks / 1,490 units, plus the two table entries taken verbatim as arrows with their range cited), and the host registry they exposed is fixed. `Vyt` gates every ui write on a session bound in `DT`, `LWt` writes or clears the status line, `ui.log` routes to the transcript sink or the debug log and notices an over-long text once per plugin, and the two `check` refusals only reach a caller through a handler that opens the floor. Driving it found that `it()` returned a fresh object per call, so the sink `mce`/`GCn` write was lost (Q-092, fixed against chunk-3ph567jx.js's own shape). The scan also reported four free names in src/tui-custom-theme-source.ts, an untracked copy with no plan (Q-093, next package). Evidence: `research/ports/W45-ui-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-23: the copy-gap scan (scripts/source-undeclared-scan.mjs) is scope-aware. It used to count every declaration at any depth as file-wide, so a local inside one copied function satisfied a free name in another — which is how W45-22 shipped an undeclared `a8` behind a green scan. Resolving references against a scope chain surfaced three real gaps (`a8`, `ep`/`z3e` in the streaming copy, `x` in the runner copy), each closed by plan edits rather than by copying a body twice, and two false-positive classes (class declarations, an off-by-one from stripping the pragma line). Evidence: `research/ports/W45-scan-evidence.json`, and
[工作包](ports/W45-chain-runner.md).

W45-22: the streaming half of the module-to-host call path is copied — chunk-sfn1dbxq.js's `aGe` entry (929 units) plus the streaming dispatch family (9,074), the clock (563) and the streaming record family (1,645, appended to the records copy), behind `raiseStreamingHostCall` in src/plugin-chain-stream-call.ts. The layout follows the source's module graph because the two `Q`s are different functions; a refused answer is skipped to the layer below rather than thrown; status fields, `CHECK`, the three withheld-result texts and the check-refusal text are asserted, and the native-provider field `ChainModule.streamLinks` is a product addition. Evidence: `research/ports/W45-stream-call-evidence.json`, and
[工作包](ports/W45-chain-runner.md#w45-22-landed-the-streaming-half-of-the-call-path-2026-10-15).

W45-20: the module-to-host call path (the `ui.*`/`env.*`/`state.*` value events' raise) is copied — 11 blocks / 2,155 UTF-16 units over four modules into src/plugin-chain-host-call-source.ts, behind `raiseHostCall`/`hostCallCopied` in src/plugin-chain-host-call.ts. Every `Hze` caller in the source is the plugin-call dispatcher, and the engine's own status and log writes take other paths, so the package adds no product raise point; the `TDe` placeholder is retired and the four `_yt` names now copy their answer. Verified: 22 copy plans regenerate byte-identically, full 1,320/1,320, compiled driver `W45HostCallCompiled.v1` green, packaged-CLI smoke passes with zero upstream requests. Identity `a3ea88c7…`; see [W45 host-call evidence](ports/W45-host-call-evidence.json).

## W59 verified partial compiler repair

136 to 4 diagnostics, three owned fixtures passed, independent review completed. Full build remains blocked. [W59 record](ports/W59-compile.md).

## W60 remaining compiler errors closed

4 to 0 diagnostics; `tsc --noEmit` exits 0. Three ant-only branches whose modules are absent from every inventory now fail explicitly at their original call sites instead of the W59 `null` fold silently succeeding. One owned fixture passed; independent review dispatched. Full build and CLI acceptance remain pending. [W60 record](ports/W60-compile.md).

## W61 phase-2 package 1: non-coding slash commands stripped

75 files / 8,242 lines deleted from the base plus 171 registration lines; `tsc --noEmit` exits 0; four fixtures pass. Deferred: auth cluster, chrome cluster, 33 in-place CLI blocks, the referenced services set. [W61 record](ports/W61-phase2-commands.md).

## W62 phase-2 package 2: login/auth surface and upgrade stripped

8 files deleted (938 lines), 7 host cuts (+6/-956); tsc exits 0; four fixtures pass. services/oauth and ConsoleOAuthFlow kept with recorded reasons. Independent review not run (rate-limited). [W62 record](ports/W62-phase2-auth.md).

## W63 phase-2 package 3: Claude-in-Chrome cluster stripped

13 files deleted (2,167 lines), 14 host cuts (+14/-3,211); tsc exits 0; four fixtures pass. utils/computerUse kept as its own cluster. Five quarantined source maps byte-verified. Independent review not run (rate-limited). [W63 record](ports/W63-phase2-chrome.md).

## W64 phase-2 package 4: Computer Use cluster stripped

17 files deleted (2,679 lines), 9 host cuts plus the @ant/* vendor block (+5/-2,895); tsc exits 0; four fixtures pass. Three quarantined source maps byte-verified. Independent review not run (rate-limited). [W64 record](ports/W64-phase2-computeruse.md).

## W65 wave A: org-pushed settings network removed

New directive: drop the account/subscription network, keep local only. Wave A deletes the org settings surface (services/remoteManagedSettings, settingsSync, teamMemorySync; 12 files, 3,963 lines) plus 11 host cuts (+7/-3,982); tsc exits 0; four fixtures pass. policySettings resolves from local sources only. One protocol slip recorded: the three dirs were deleted before the bak quarantine; exposure bounded to one file, its dump-state text recovered into .audit/w65-source-baks/. Independent review not run (rate-limited). [W65 record](ports/W65-account-network.md).

## W65 waves B-C: grove/remote review and the usage-limits cluster removed

Wave B (`3e4e3f0`) removes the grove onboarding gate, the metrics opt-out check and the remote review surface (15 files, +2/-1,753), keeping the local /review command. Wave C (`35c180c`) removes the usage/quota/credit cluster: the limits engine and its hook, the rate-limit message builder, the mock-limits harness, the usage/referral/overage-credit endpoints, extra-usage billing, the /usage, /extra-usage and /rate-limit-options screens, the logo upsells, and the onOpenRateLimitOptions prop chain drilled through five components — 21 files / 3,267 lines deleted, 31 host files cut (+25/-4,358). A 429 is the generic rejection again; check1mAccess reduces to !is1mContextDisabled(); hasConsoleBillingAccess keeps the local terms only (recorded adaptation). tsc exits 0; four fixtures pass; the wave-C bak quarantine ran before deletion (two files, byte-verified). Independent review not run (rate-limited). [W65 record](ports/W65-account-network.md).

## W65 waves D-E: auth, policy limits, remote sessions

Wave D step 1 (`03713f4`) makes auth API-key-only: every new body is the answer the tree already returns under `isBareMode()`, so only an OAuth subscriber's answer changes (+14/-200). Wave E step 1 (`75c7aa8`) deletes the org policy-limits service: all thirteen call sites were gates on remote-session/remote-control/product-feedback paths (+3/-790). Step 2 (`0ec1f6a`) removes the scheduled remote agents surface and the remote callout. Step 3 (`bd7f6c7`) removes the remote assistant history plus two modules with no importer at all. Step 4 (`db6e7c7`) removes the teleport and remote-session cluster — 33 files / ~11,450 lines across 31 hosts, the largest slice of the program: the teleport family, the three transport hooks, remote/, server/, ssh/, the RemoteAgentTask task, the session-ingress v1 path and the whole /ultraplan surface. Three adaptations recorded (a 6-line helper ported verbatim from the deleted teleport api, an EnvironmentKind union rehomed, and a removed clearAllSessions call now asserted as the only fixture difference). tsc exits 0; four fixtures pass; the bak quarantine ran first (13 files, byte-verified). Independent review not run (rate-limited). [W65 record](ports/W65-account-network.md). Step 5 (`88545db`) removes the bridge cluster: `bridge/` (31 files, 12,595 lines), `hooks/useReplBridge.tsx` and `components/BridgeDialog.tsx`, with 18 hosts re-stitched across three passes (28 tsc errors to 0; 53 files, +114/-14,675). Four load-bearing bodies were ported with citations instead of invented — `toCompatSessionId`, the Spinner shimmer trio, and the two JWT decoders — and a fifth fixture (`w65-e5-verify`) compares each against the recovered source textually and behaviourally. `--remote-control`/`--rc` leaves as a flag, a command and an AppState input; `print.ts` stops fetching web-composer attachments from the account endpoint; the `replBridge*` AppState family stays inert for the leftovers wave. tsc exits 0; five fixtures pass; the bak quarantine ran first (9 files, byte-verified). Independent review not run (rate-limited). [W65 record](ports/W65-account-network.md). Wave D step 2 (`e47f4a5`) removes the OAuth service and the token store: `services/oauth/` (6 files, 1,064 lines) plus five hosts (+81/-2,105), with `utils/auth.ts` keeping only the `CLAUDE_CODE_OAUTH_TOKEN` and file-descriptor bearers. Two pure helpers ported with citations; the `OAuthTokens`/`SubscriptionType` types had no source form to port (`services/oauth/types.ts` was itself a reconstruction stub) and are declared from use, which the record flags as the wave's one invented declaration. `components/ConsoleOAuthFlow.tsx` and the `claude setup-token` subcommand are gone. tsc exits 0; six fixtures pass. Wave D step 3 (`c11b5be`, `41e43e3`, `1bc1bc0`) removes the BigQuery metrics exporter and eleven zero-importer modules found by a new import-graph scan (`.audit/w65-orphans.mjs`; 13 files, +1/-2,815), and shows the cascade it starts: three successive scans after each deletion walked `Stats.tsx -> screenshotClipboard.ts -> ansiToPng.ts -> ansiToSvg.ts`, none of which a name grep or a single pre-cut pass can find. tsc exits 0; six fixtures pass. Wave D step 4 (`5b50aac`) removes the feedback-survey and transcript-share surface (components/FeedbackSurvey/, 10 files, the /issue auto-run chain, and the /feedback screen the cut then orphaned) while keeping the skill-improvement survey, whose hook edits the user's skill files; the one rehomed validator is a recorded adaptation. 20 files, +33/-2,623; tsc exits 0; seven fixtures pass. Wave D step 5 (`6e580ac`) removes the voice cluster — ten modules and eleven hosts with no ported body, since the dead flag's false arm was already written in the source (28 files, +24/-3,792; tsc exits 0; eight fixtures pass). Wave D step 6 (`b2c553b`) removes the first-run connectivity/region preflight, an account gate whose only effect was to exit the process; `utils/apiPreconnect.ts` was read and kept, since it warms the inference host's pool (2 files, +1/-157; tsc exits 0). Wave D step 7a (`18fbacc`) removes the two analytics transports: `datadog.ts`'s third-party intake, the 820-line OpenTelemetry batch exporter POSTing to api.anthropic.com, the logger that built its records, the sink router and its killswitch, the generated growthbook experiment type, and `hooks/useTimeout.ts`. Both gates were read from source first and both were live — `is1PEventLoggingEnabled()` is `!isAnalyticsDisabled()`, so the exporter was shipping events in a normal run, and GrowthBook's switch was that same predicate, so its remote-eval client is now unconstructible and every dynamic-config read answers with the caller's default. `services/analytics/index.ts` stays as an inert API so ~230 call sites keep compiling; `utils/config.ts` loses the recursion guard whose sampler was its only reason to exist. 17 files, +55/-2,190; tsc exits 0; nine fixtures pass; the post-cut orphan scan named both new orphans. Wave D step 7b (`25c134f`) collapses the GrowthBook fetch machinery the now-false switch guarded: the remote-eval client, its payload transform, the disk-cache writer, the exposure log, the periodic refresh and constants/keys.ts are gone, leaving the env-var and config override channels ahead of the switch (1,148 lines to 457; 6 files, +126/-847). The disk cache was deliberately not kept — a stale copy of server state sitting below the source's own guard. Recorded and pinned by the new fixture: the duplicated return after each guard is what hands callers their default, since tsc accepts falling off the end under "strict": false. Wave D step 7c (`ce11027`) turns `services/analytics/metadata.ts` into a PII-redaction module: the environment builder, process-metrics sampler, agent-identification helper, `getEventMetadata`, the 1P formatter and their six types were one contiguous dead block and went as one (950 lines to 363; imports from twenty-one bindings to four), leaving the tool-name, MCP-detail, skill-name, tool-input and file-extension helpers the tool path still calls. The deletion orphaned the 866-line 1P event proto type and, with it, the two generated types that depended only on that file — `types/generated/` now holds no files at all. Wave D step 7d (`11e5a4c`) removes the leftovers that cut stranded: `utils/user.ts` keeps only `getGitEmail` (the core user record, its GrowthBook variant, the startup email prefetch, the cache reset and both types had no reader, 194 lines to 33), `main.tsx` loses that prefetch and the post-login reset — so the tree no longer spawns `git config --get user.email` at startup — and three exports step 7c orphaned go with them (`getRepoRemoteHash` plus `normalizeGitRemoteUrl` and `isLocalHost`, and `getLinuxDistroInfo` and `detectVcs`). `refreshGrowthBookAfterAuthChange` is left caller-less on purpose: deleting it would drop the guard count its fixture pins, so step 7e takes it with `initializeGrowthBook`'s two warm-up calls. Wave D step 7e (`0e225a4`) removes the GrowthBook warm-up surface: `initializeGrowthBook`, `resetGrowthBook` and `refreshGrowthBookAfterAuthChange` had no local effect left and go with their two call sites (`interactiveHelpers.tsx`'s after-trust block, which keeps the trust signal and the system-context prefetch, and `print.ts`'s headless entry). No behaviour change. `checkGate_CACHED_OR_BLOCKING` is kept because its one caller sits in the KAIROS_CHANNELS dev-channels block, which waits for its own package (54 files, 124 flag reads). `@growthbook/growthbook` now has zero importers; pruning it from package.json belongs to a dependency-pruning pass, since the lockfile is generated. The 7b fixture's guard count moved 6 to 5 in this commit. 3 files, +12/-63; tsc exits 0; thirteen fixtures pass. Wave D step 7f (`64c2520`) removes the channel notification surface: the six modules that owned it (`channelAllowlist.ts`, `channelNotification.ts`, `channelPermissions.ts`, `UserChannelMessage.tsx`, `ChannelsNotice.tsx`, `DevChannelsDialog.tsx`), the `--channels` and `--dangerously-load-development-channels` options with their parse-and-telemetry block, the `channel_enable` control request and both print-mode handlers, the MCP connection gate with its notification handlers and blocked toast, the interactive permission relay, the session allowlist state, the GrowthBook gate helper whose only caller was the channels warm-up, the two channel constants, the four settings keys and the render/visibility branches keyed off the origin tag. Three sites invert the guard (`if (!(feature('KAIROS') || feature('KAIROS_CHANNELS'))) return`), where the source's own fallback is the early return, so those functions went with their callers rather than having their guards dropped. 25 files, +8/-1,928; tsc exits 0; fourteen fixtures pass. Wave D step 7g (`9825b9f`) removes assistant mode's tool surface: the three flag-conditional requires in `tools.ts` (SendUserFileTool, PushNotificationTool, SubscribePRTool — each target already absent from the build) and their pool spreads, the W47 port `tools/SendUserFileTool/prompt.ts` that loses every consumer, the shared `SEND_USER_FILE_TOOL_NAME` constant and its three readers (each use was itself flag-gated, so each folds to the arm the false flag produced), and the push-notification settings group (three toggles in Config.tsx, three entries in supportedSettings.ts, three global-config fields and their allowlist entries) — a group that configured a pusher the missing tool owned. 8 files, +5/-180; tsc exits 0; fifteen fixtures pass. Wave D step 7h (`98e4ff1`) removes assistant mode's own state, and the cut is a fold rather than a judgement: `setKairosActive` has no call site anywhere in the build and `main.tsx`'s `let kairosEnabled = false` is never reassigned, so the bootstrap `kairosActive` bit and the AppState `kairosEnabled` field are permanently false. Gone with them: the two accessors, the `--assistant` option, the `assistantModule` stub, the `assistant/assistantName` settings, the assistant-mode comment block, the ten reads (whole guarded blocks in autoDream, memdir, both shell tools, attachments, StatusLine and processSlashCommand; single `||` terms in `fastMode`, Spinner, UserPromptMessage and BriefTool), the `assistantMode` prop and its cronScheduler bypass, `compact.ts`/`attachments.ts`'s already-null `sessionTranscriptModule` with its three call sites, `KAIROS_DREAM`'s require of the absent `./dream.js`, `AgentTool`'s schema ternary and `assistantForceAsync`, and the auto-background plumbing only that block ever set (`assistantAutoBackgrounded` in both tools and `ShellCommand`, plus `ASSISTANT_BLOCKING_BUDGET_MS`). `memdir`'s 44-line daily-log prompt builder lost its only caller and went with it. 23 files, +31/-474; tsc exits 0; sixteen fixtures pass. Wave D step 7i (`f1b8fb1`) removes the brief-mode surface by the same kind of fold: `BriefTool.isEnabled()` returned `isBriefEnabled()`, whose body is the `feature('KAIROS') || feature('KAIROS_BRIEF')` ternary, so the SendUserMessage tool is never enabled in this build. Deleted: `tools/BriefTool/` (the tool with both gates, its schemas, prompt, chat-style renderers and attachment resolver — 405 lines) and `utils/formatBriefTimestamp.ts`, whose only two callers were brief layouts; the `UI.tsx.w54bak` copy was quarantined and byte-compared first. Folded away: `userMsgOptIn` with its three startup opt-in paths (`--tools` listing, `defaultView: 'chat'`, `--brief` and `maybeActivateBrief`, whose own guard was the early-return shape so the function went with its four call sites), `AppState.isBriefOnly` with the `/config` picker, its Escape-restore snapshot and the `ctrl+shift+b` binding, the three code readers that named the tool by string (the 130-line transcript filter pair, the permission-rule alias, the ToolSearch deferral bypass), two todo/task nags, and the resume classifier's `isTerminalToolResult` (always false). The view folds to the plain arm: the spinner wrapper collapses into its inner component, `BriefSpinner`/`BriefIdleStatus` go, `HighlightedThinkingText` loses its brief branch with the `timestamp` prop threaded through three components, the queue loses its padding override, and the two brief label theme keys go with twelve values. Two deliberate non-cuts: GNU `file`'s own `--brief` in the two read-only command tables, and three prose comments naming the tool. 34 files, +34/-1,447; tsc exits 0; seventeen fixtures pass (the 7g and 7h fixtures amended, as the 7h record predicted). Wave D step 7j (`6014abf`) removes the PROACTIVE tick machinery, and its decisive fact is one flag wider than 7h's: `feature('PROACTIVE')` and `feature('KAIROS')` are both false **and** this build contains no `proactive/` directory, so every `proactiveModule` was null rather than off — two of the eight handles were even written `feature(…) ? null : null`. The Sleep tool was a prompt module for a tool that does not exist (`tools/SleepTool/` held only `prompt.ts`; `tools.ts` required a file the build never had), so it left the pool with `SLEEP_TOOL_NAME`'s four readers: `query.ts`'s `sleepRan ? 'later' : 'next'` drain upgrade (→ `'next'`), REPL's Sleep-only spinner rule (constant false, so the term drops from the spinner chain), and classifierDecision's auto-mode allowlist entry — plus the two Sleep settings. The tick loop went with the module it hung off: `scheduleProactiveTick` and both call sites, the `set_proactive` control branch, the `CLAUDE_CODE_PROACTIVE` fallback, and `TICK_TAG` itself once its four readers folded (`log.ts`'s resume-title fallback, `UserTextMessage`'s hide rule, `MessageSelector`'s filter row, the prompt section builder). Two whole prompt paths went: `getSimpleSystemPrompt`'s `simple-proactive` return branch and the 67-line `getProactiveSection`, plus `main.tsx`'s Proactive Mode block, `--proactive` and `maybeActivateProactive` with its four call sites. The UI folds the same way (the footer's `ProactiveCountdown` with its next-tick pair, Messages' terminal-progress gate, the placeholder's example gate, REPL's `proactiveActive` leaving the tools memo). The whole `AGENT_TRIGGERS`/cron surface is kept — it shares the "Kairos" name but not the gate. 22 files, +13/-520; tsc exits 0; eighteen fixtures pass (three amended: 7g's SleepTool-neighbour assertion, 7h's `false` term in AgentTool, 7i's two deliberately-kept proactive neighbours). Wave D step 7k (`e6a4caf`) removes the AGENT_TRIGGERS/cron surface: the flag is false and `isKairosCronEnabled()`'s body is that flag with an unreachable GrowthBook kill switch and env override behind it, so the three gates collapse into one constant. Deleted `tools/ScheduleCronTool/` (create/delete/list tools, shared prompt, UI) with the three `CRON_*` names, the engine (`cronTasks`, `cronScheduler`, `cronTasksLock`, `cron`, `cronJitterConfig`), the two constructors (`useScheduledTasks` and print.ts' `-p`-mode block with its `stop()` cleanup), `/loop` with its registration and tip, the session state (`scheduledTasksEnabled`, `sessionCronTasks`, the `SessionCronTask` type and three functions), and `WORKLOAD_CRON` with the `Workload` type whose only producer was the fired queue item. Kept deliberately: `entrypoints/agentSdkTypes.ts`' declarative cron types with two throwing stubs — a declared SDK contract with no producer, as wave C kept `rate_limit_event`. 23 files, +16/-2,557; tsc exits 0; nineteen fixtures pass (7h's cronScheduler guards and 7j's "stays intact" sentence amended). Wave D step 7l (`627859b`) removes the `replBridge*`/Remote Control leftovers — a fold to nothing rather than to an arm, since no module in this build reads or writes any of the slots: the twelve `replBridge*` AppState fields with the two `claude assistant` viewer counters (their only writers are `useReplBridge`, the bridge dialog and `initReplBridge`, none present), `remoteControlAtStartup` with `getRemoteControlAtStartup()`, its two `GLOBAL_CONFIG_KEYS` entries, its `supportedSettings` row behind the false `BRIDGE_MODE` gate and ConfigTool's two AppState sync blocks, the renaming migration for the older key, the readerless `remoteDialogSeen` and `bridgeOauthDead` pair, and in `bootstrap/state.ts` the ant-only `replBridgeActive` with `isReplBridgeActive()` plus `directConnectServerUrl` whose setter had no callers (folding the logo header to its bare path). Kept deliberately: the `/remote-control` command family with `remoteControlSpawnMode`, `desktopUpsellSeenCount` (a live reader), the retained `cli/transports/` lane and the SDK declaration. Four comments naming the removed modules were rewritten. 14 files, +10/-249; tsc exits 0; twenty fixtures pass (7h amended as its own record predicted). Wave D step 7m (`47b5ef3`) removes the bridge-origin command gate on a producer fact: the two `QueuedCommand` fields `skipSlashCommands` and `bridgeOrigin` are read in five places and written in none — the tree's three queue producers never set them and the bridge inbound path is absent — so both are permanently falsy and every gate on them folds. With them go `isBridgeSafeCommand` and `BRIDGE_SAFE_COMMANDS` (the deleted override block was their only caller), the `/x isn't available over Remote Control.` short-circuit, and three readerless slots: `createBridgeStatusMessage` with its `bridge_status` subtype member, type alias and Ink renderer (plus the two imports only that renderer used), `remoteControlSpawnMode`, and `sessionSource` whose one writer sat behind `CLAUDE_CODE_ENVIRONMENT_KIND === 'bridge'` (the variable itself stays — `cli/remoteIO.ts` and `filePersistence` read it). `updateSessionBridgeId` wrote a pid key nothing read back. Kept deliberately: `agentSdkTypes.ts`' declared `bridgeSessionId` and `SendMessageTool`'s `uds:`/`bridge:` rows, which sit in the false arm of `feature('UDS_INBOX')`. 12 files, +6/-217; tsc exits 0; twenty-one fixtures pass (7l amended as its own record predicted). Wave D step 7n (`34b8444`) removes the session-ingress bearer surface, folding to a documented arm rather than a constant: `getSessionIngressAuthHeaders()` already returned `{}` with no token, and that is what the transports now take permanently. `utils/sessionIngressAuth.ts` (the env-var/FD/well-known-file reader with its bootstrap cache) goes with everything that could not authenticate without it — `main.tsx`'s `--file` download block and its option, `utils/filePersistence/filePersistence.ts` with `types.ts`, `services/api/filesApi.ts` (748 lines), and `cli/print.ts`'s `executeFilePersistence` call with the `turnStartTime` that only fed it. Token reads fold at `services/mcp/client.ts` (two header spreads, the log field, the `hasOAuthTokens` probe), `MCPSettings.tsx`'s session-auth arm and the four transport files. The `bridge/jwtUtils.ts` port into `ccrClient.ts` is deleted with its only caller (the JWT expiry check) and recorded under the e5 fixture's `removedPorts`. Kept: the transport lane with `() => ({})` defaults (so `no_auth_headers` stays reachable), `outputsScanner`'s `getEnvironmentKind` for `utils/plans.ts`, and the declared `files_persisted` SDK subtype. 16 files, +27/-1,588; tsc exits 0; twenty-two fixtures pass (e5 amended as its own record predicted). Independent review not run (rate-limited). Wave D step 7o (`4a799eb`) removes the peer-messaging lane: `feature('UDS_INBOX')` is false and the three modules its gated requires name (`tools/ListPeersTool/`, `utils/udsMessaging.ts`, `utils/peerRegistry.ts`) are absent from the build, so the `ListPeers` slot, `SendMessageTool`'s `uds:`/`bridge:` rows with both cross-session branches, the Cross-session prompt section, the hidden `messaging_socket_path` in the init message, the PID file's `messagingSocketPath`, the `--messaging-socket-path` option with its setup() argument and replay promotion, and setup()'s emptied UDS gate all fold away, taking `utils/peerAddress.ts` with its last consumer and one ungated peer-grammar check whose only trigger was a `uds:`/`/` recipient. 9 files, +11/-142; tsc exits 0; twenty-three fixtures pass (7m amended as its own record predicted). Wave D step 7p (`50744a6`) removes the subscriber constants from the model-call path. The decisive fact is step 1's `isAnthropicAuthEnabled()` body — `return false` — so `isClaudeAISubscriber()`, `getOauthAccountInfo()` and the tier reads were already constants, and `hasProfileScope()` is false by a second, independent route: both surviving token producers hardcode `scopes: ['user:inference']`. Folded to the arms those constants produced: the Anthropic client setup's OAuth token check call (which had made the `configureApiKeyHeaders` call below it conditional) with the `authToken` field and the ant-only staging baseURL; the system prompt's `account_uuid` ternary to `''`; the off-switch gate's subscriber term; the `x-should-retry` exemption's subscriber/enterprise disjunction and the 9xx fallback term, with the 429 arm becoming a plain `return true`; the 401/revoked refresh attempt (`handleOAuth401Error` returns false unconditionally here, so the call could only re-read the client, which the block still does); the Pro-plan Opus 400 error block; the ant message's `orgId` ternary; the env-var org-disabled guard's subscriber term; `getAuthHeaders`' OAuth arm; the custom-betas warning and the oauth beta-header push; the `models.list` betas option; the Max and Team-Premium default-model arms with `isOpus1mMergeEnabled`'s Pro term and its whole fail-closed guard, plus `modelDisplayString`'s subscriber label arm; and the subscriber Default option with the entire Max/Team-Premium/Pro-Team-Enterprise model-option block, whose four builders `getMaxSonnet46_1MOption`, `getMaxOpus46_1MOption`, `MaxSonnet46Option` and `MaxHaiku45Option` were read by nothing else and are deleted with it. `services/api/bootstrap.ts` goes whole — 141 lines fetching an OAuth-account endpoint whose OAuth arm was already dead under the profile-scope fold — taking `main.tsx`'s `fetchBootstrapData` import and call, the dead `isClaudeAISubscriber` import beside it, and `utils/http.ts`' `withOAuth401Retry`, which existed only for that call. Kept: API-key auth as the retained path (the client keeps `apiKey: apiKey || getAnthropicApiKey()`, `getAuthHeaders` keeps its API-key arm with the three user-agent helpers that are the file's live surface, `getClaudeAIOAuthTokens` keeps both bearer sources so `hasStoredOAuth` and `getAuthTokenSource` keep their meaning), and the constants themselves in `utils/auth.ts` until their last reader in the status, commands and onboarding surface goes with them. 11 files, +21/-433; tsc exits 0; twenty-four fixtures pass (none amended); six earlier evidence records refreshed digest-only. Wave D step 7q (`6fa308a`) removes the subscriber consumer surface: the twelve predicates that lost their last reader leave `utils/auth.ts` (`getSubscriptionType`, `getRateLimitTier`, `getSubscriptionName`, `hasOpusAccess`, `isOverageProvisioningAllowed`, `isConsumerSubscriber` with `isConsumerPlan`, and the four `is*Subscriber` wrappers), `is1PApiCustomer` folds to its three env terms, and `getOauthAccountInfo` becomes `return undefined` for the connector handler that still reads it. The reads fold where they stood — the model label's description, the logo's billing string, account name, both organization announcement prefixes and its model-line suffix, the companion's account fallback, `/cost`'s `isHidden` getter, the availability filter's two subscriber terms, the OAuth-account telemetry block with `utils/taggedId.ts`, the onboarding telemetry fields, the plan-mode tier arms, the Opus 4.6 default-effort block with `getOpusDefaultEffortConfig`, the AgentTool concurrency note and the attachment's `showConcurrencyNote`. Three units go whole: `components/EffortCallout.tsx`, the Pro→Opus and Sonnet 4.5→4.6 migrations with the Sonnet notification entry, and nine `utils/config.ts` fields no writer could set (its write guard narrows to the onboarding clause and is renamed `wouldLoseOnboardingState`). One fold changes a behaviour and the record states it: `useApiKeyVerification`'s guard was always true, so no key verification runs and the invalid-key notices cannot fire — the arm the source itself takes under this build's auth decision. 24 files, +43/-803; tsc exits 0; twenty-five fixtures pass (two carried pins amended, both superseded by this step); ten earlier evidence records refreshed digest-only. Wave D step 7r (`755d79b`) removes the claude.ai MCP connector whole: `services/mcp/claudeai.ts` (a `/v1/mcp_servers` fetch gated on a `user:mcp_servers` scope no token in this build carries), the `claudeai-proxy` config type with its transport, status echo and analytics arm, the two-phase loading lane, the `-p` prefetch/merge/dedup/connect lane, and `MCPRemoteServerMenu`'s connector auth flow. The three auth predicates whose last reader it was (`isAnthropicAuthEnabled`, `isClaudeAISubscriber`, `getOauthAccountInfo`) leave with it, along with the private `shouldUseClaudeAIAuth` and the two token stubs only the MCP client called; `handleOAuth401Error` stays for `utils/fastMode.ts`. The analytics gate loses its `mcpServerType` parameter across nine call sites, `normalizeNameForMCP` loses its `claude.ai ` prefix case, and `CLAUDE_AI_ORIGIN`/`MCP_PROXY_URL`/`MCP_PROXY_PATH` leave the OAuth config. No behaviour changes: the scope gate could only answer false, so every removed branch was unreachable. 29 files, +95/-1365; tsc exits 0; twenty-five fixtures pass (two carried pins amended, both superseded by this step); thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7s (`8c8d201`) removes the fast-mode account-status probe: `utils/fastMode.ts`'s `GET ${BASE_API_URL}/api/claude_code_penguin_mode` with its OAuth bearer + `OAUTH_BETA_HEADER` (dead under the same producer fact 7r recorded — both surviving token sources hardcode `['user:inference']`) and its API-key arm, the 30 s throttle and `startupPrefetchedAt` bookkeeping with both `main.tsx` startup branches, the `/fast` pre-picker fetch, the cache-resolution substitute and the `orgStatus` model with its reason table. `handleFastModeRejectedByAPI` becomes the in-session server-feedback arm (it still clears the persisted preference and emits the signal, now payloadless, whose hook loses the unreachable re-enablement branch); the local flags, provider/SDK checks, cooldown and `/fast` stay. `handleOAuth401Error` and `hasProfileScope` leave `utils/auth.ts` as the probe's last readers, `OAUTH_BETA_HEADER` leaves `constants/oauth.ts`, and `penguinModeOrgEnabled`/`startupPrefetchedAt` leave `utils/config.ts`. The org-disabled memory is now session-scoped: the preference is still cleared on rejection, so a restart begins with fast mode off, while a fresh session's availability answer is unchanged (`pending` previously fell through). 7 files, +17/-368; tsc exits 0; twenty-seven fixtures pass (two carried pins amended, both superseded by this step); eleven earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7t (`19bce58`) removes the stranded in-place CLI blocks: eleven empty `{}` statements and their stale comments in `main.tsx`, the `claude server`/`claude connect`/`claude up`/`claude rollback`/ant-only registration stubs, the six absent-command fast-path comment blocks in `entrypoints/cli.tsx` (daemon worker, daemon, ps/logs/attach/kill, template jobs, environment-runner, self-hosted-runner), `setup.ts`'s empty `COMMIT_ATTRIBUTION` block with its then-unused `feature` import, and the unchecked `installAsciicastRecorder` import. `git log -S` shows the bodies were absent from the first compilable-base commit (`2148015`), which elided them and left empty statements, comments or whitespace-only lines. The live `claude update`/`claude install` blocks are reclassified to the auto-updater package instead of being cut alone: `utils/autoUpdater.ts` and its min-version, doctor and npm-deprecation messages still direct users to those commands, and software distribution is outside the account/subscription boundary. No behaviour changes; `utils/asciicast.ts` stays for its live resume-rename and flush readers. 3 files, +0/-68; tsc exits 0; twenty-eight fixtures pass (none amended); ten earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7u (`e864296`) removes the SDK transport lane: `--sdk-url` (registration, non-interactive predicate, extraction, format auto-set, validation, UUID-validation bypass and pass-through), `cli/remoteIO.ts`'s `RemoteIO` (URL-derived headers, transport selection, CCR v2 client wiring, internal-event registration, the three session listeners) and all of `cli/transports/` (WebSocket, SSE, Hybrid, `CCRClient`, `SerialBatchEventUploader`, `WorkerStateUploader`, `Transport`, `transportUtils`). The local print-mode path is unaffected: `getStructuredIO` returns `StructuredIO` over stdin unconditionally, and `replayUserMessages`, the control protocol, SDK MCP servers, `SdkControlTransport`, the MCP WebSocket transport and `--init-only` stay. The CCR v2 state the transports fed (`setSessionStateChangedListener`/`setSessionMetadataChangedListener`, the sessionStorage internal-event writer/reader with `hydrateFromCCRv2InternalEvents`, `restoredWorkerState`, `externalMetadataToAppState`, the URL arm of `--resume`) is producerless and recorded as step 7v. 15 files, +27/-3449; tsc exits 0; twenty-nine fixtures pass (four carried pins amended); thirteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7v (`d66887e`) removes the CCR v2 session-state residue the transport lane fed: `setSessionStateChangedListener`/`setSessionMetadataChangedListener` with their slots and the external_metadata mirroring, `notifySessionMetadataChanged` with its call sites, `SessionExternalMetadata` and `externalMetadataToAppState`, `StructuredIO.restoredWorkerState` and the two no-op internal-event methods, the sessionStorage internal-event writer/reader with `persistToRemote` and `hydrateFromCCRv2InternalEvents`, the print-mode CCR v2 resume branch with its `restoredWorkerState` option and `finally_*` run phases, and the URL arm of `parseSessionIdentifier` (a URL resume now reports `No conversation found`). The SDK status stream (`notifySessionStateChanged`'s opt-in event, `notifyPermissionModeChanged`), `RequiresActionDetails` with `buildRequiresActionDetails`/`onPermissionPrompt`, local transcript persistence and UUID/JSONL resume stay. 6 files, +44/-442; tsc exits 0; thirty fixtures pass (none amended); four earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7w (`f95398a`) removes the background auto-update UI lane: `AutoUpdaterWrapper`, `NativeAutoUpdater`, `PackageManagerAutoUpdater` and `AutoUpdater` (installation-type detection, the 30-minute release-bucket check, max-version messages, in-place installs), `useUpdateNotification` and `useInstallMessages`, with the whole REPL→PromptInput→Footer/Notifications prop chain that fed them and two comments that named the components. The remaining notification footer (API-key status, tokens, IDE, memory, token warning, plugin notifications) and the plugin-marketplace update lane stay; the updater core, commands, doctor diagnostics and config/settings residue are step 7x. 11 files, +2/-831; tsc exits 0; thirty-one fixtures pass (three file-count pins amended); two earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7x (`780b3fc`) removes the updater core and commands: `utils/autoUpdater.ts` (dist-tags, version comparison, install of the downloaded build), `utils/nativeInstaller/` (platform download with checksum/signature checks, the versioned install tree, PID locks), `cli/update.ts`, `commands/install.tsx`, the autoUpdates-to-settings migration and the npm-deprecation hook, plus everything that invoked or reported them — `claude update`/`claude install`, `assertMinVersion`, the doctor's Updates and Version Locks sections and the diagnostic's updater fields, the status panel's install warnings, setup's `lockCurrentVersion` and the old-version cleanup. `isAutoUpdaterDisabled` goes with its last reader and `shouldSkipPluginAutoupdate` tests the environment directly; package-manager detection moves to `utils/packageManagers.ts` and the plugin-marketplace lane stays. 25 files, +20/-4,548; tsc exits 0; thirty-two fixtures pass (four amended); fourteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Wave D step 7y (`51f7625`) removes the auto-update channel configuration residue: the settings schema's `autoUpdatesChannel` and `minimumVersion`, `ReleaseChannel`/`InstallMethod`, the global config's `installMethod`/`autoUpdates`/`autoUpdatesProtectedForNative` fields with their defaults, keys and test override, `migrateConfigFields` with its three call sites, and the `AutoUpdaterDisabledReason` type with its format/lookup helpers; the Config panel loses the channel row, change summary, revert entries, toggle branch, Enable Auto-Updates dialog, downgrade branch and `components/ChannelDowngradeDialog.tsx`; main loses the channel telemetry field, and two changeDetector comments are reworded. The plugin-marketplace gate stays environment-only. 6 files, +9/-380; tsc exits 0; thirty-three fixtures pass (one amended); fifteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Dependency-pruning pass (`827583f`) removes the four zero-importer packages (`@growthbook/growthbook`, `@opentelemetry/core`'s root declaration, `asciichart`, `qrcode`), the 36 lock entries unreachable from the remaining dependency set, and the callerless `themeColorToAnsi`/`chalkForChart` helper in `utils/theme.ts`; the fixture reruns the same reachability walk and asserts the lock has no unreachable entry. 3 files, +1/-409; tsc exits 0; thirty-four fixtures pass (none amended); no earlier evidence record moved. [W65 record](ports/W65-account-network.md).

Follow-up (`2823ec8`) renames the surviving `utils/filePersistence/outputsScanner.ts` to `utils/environmentKind.ts` beside its only reader `utils/plans.ts`, retiring a directory that held nothing but the environment-kind reader after the file-upload lane was removed. The union, return arms and null fallback are unchanged; only the relative debug import and one comment word differ. 2 files (one rename), +3/-3; tsc exits 0; thirty-five fixtures pass (7n follows the path); no earlier evidence record moved. [W65 record](ports/W65-account-network.md).

Wave D closure (`0a488b3`) closes the analytics transport surface: the two payload builders that survived the no-op switch (`logStartupTelemetry` with `getCertEnvVarTelemetry`, and `logContextMetrics` with its MCP prefetch, tool enumeration, context gathering, ripgrep file count and token estimation), the analytics gate `isAnalyticsDisabled` whose only readers they were, and the gh-CLI probe that existed solely for the startup payload. The no-op `logEvent`/`logEventAsync` API stays by the step-7a decision, as do `growthbook.ts`'s local override channels and `metadata.ts`'s redaction surface; no outbound telemetry path remains. 4 files, -208; tsc exits 0; thirty-six fixtures pass (eight counts amended); fourteen earlier evidence records refreshed digest-only. The local-only directive has no remaining items. [W65 record](ports/W65-account-network.md).

W45-72: the React layer partition 1 — the Raster site component and its surface hook. Ten source blocks, 1,479 units: `jo` renders the Box and its `ink-raw-ansi` child, `Ko` registers the mount and drives the paint scheduler, `Fo` coalesces paints at the 16 ms frame, `_o` writes the frame into the node and marks it dirty, and `nr` schedules only while the surface is not complete (250 ms waiting). The host seam provides the React hooks, element creation, the component runner and the two ported ink helpers; the rest of the layer is partitioned into five later slices. 11/11 new, 503/503 chain family, 1779/1779 full; tsc 0; index 56 chunks / 244,587 units. [W45 record](ports/W45-chain-runner.md).

W45-73: React layer partition 2a — the kitty image wire layer. Twelve source blocks, 3,783 units: `cFo` builds the transmit (id and cell ranges, the pixel size a non-png format needs, a q=1 file/shm control message or a q=2 inline message split at 4096 with m=1 until the last chunk), `lFo` builds the alt text (a colour sequence, a placeholder per cell and the SGR 39 row terminator), `O`/S write the two colour and placeholder forms, and `u`/`D`/`k`/`v` are the three checks and the base64 helper. `hxn` is ported with its source expression quoted; the rest is copied. 28/28 new, 531/531 chain family, 1807/1807 full; tsc 0; index 57 chunks / 248,370 units. [W45 record](ports/W45-chain-runner.md).

W45-74: React layer partition 2b-i — the Image source model. Two source blocks, 554 units: `ac`/`Z4t`/`B_` tell the inline png and reference shapes and read the decoded byte size, and `Uto`/`Dss` tell the shm shape and encode each source into the transmit shape `cFo` reads (a reference becomes a q=1 message, an inline source a q=2 one). The validators and the byte decoder were already carried by the ui.blit copy. 13/13 new, 544/544 chain family, 1820/1820 full; tsc 0; index 57 chunks / 248,924 units. [W45 record](ports/W45-chain-runner.md).

W45-75: the terminal capability and image-file probe stores. One source block, 1,835 units: `ImageFileProbe` is the one-shot file-read probe (unasked, asking, settled, with an immediate or subscribed listener) and `CapabilityReadings` is the capability table (settled readings, pending guesses, the default fallback for `now`, one answer, a deadline that settles pending capabilities at their guess). `DEFAULT_CAPABILITIES` and `CAPABILITY_NAMES` carry the six capabilities. 9/9 new, 553/553 chain family, 1829/1829 full; tsc 0; index 58 chunks / 250,759 units. [W45 record](ports/W45-chain-runner.md).

W45-76: React layer partition 2b-ii — the Image component and resolver, closing the Image slice. Nine source blocks, 4,944 units: the resolver allocates an id, transmits through the wire layer, skips a resend of the same reference, and registers the alt answer through the image mount writer; the component draws the raw-ansi alt or the text when the resolver answers undefined. The host seam serves the capability/probe accessors, the client and querier contexts, the colour level and the temp path builder. The hook runner gained the source's second effect hook, useCallback, all three state initializer forms, re-render after a state setter, and cleanup on a dependency change. 15/15 new, 568/568 chain family, 1844/1844 full; tsc 0; index 58 chunks / 255,604 units. [W45 record](ports/W45-chain-runner.md).

W45-77: React layer partition 3 begins — the Code leaf with the code block renderer and the unified-diff renderer. Thirty-eight source blocks, 24,196 units: the leaf measures itself, truncates by wrap mode, and renders the source through `Ob` or the patch through `tq`; the block renderer highlights through `nt` or draws plain text; the hunk renderer pairs removed and added lines word by word and falls back to the plain layout. The host seam answers the contexts through `_currentValue` and leaves the structured highlighters null, the source's own answer with the flag unset. The hook seam splits the compiler's jsx factory from createElement. 24/24 new plus 2 element-factory tests, 594/594 chain family, 1,870/1,870 full; tsc 0; index 62 chunks / 278,059 units. [W45 record](ports/W45-chain-runner.md).

W45-78: React layer partition 4 begins — the held-press store and the terminal input/select dispatch. Fifty-two source blocks, 8,476 units: a drawing's press handles are hosted under a plugin/component/request/surface key and rewritten in place, reused across drawings of the same plugin, and released when a replacement drops them; the dispatch finds the held entry by handle or full key and runs the drawing plugin's own press through `aP` under the site's check. The in-process module record now carries the source `tGe` press pair. 20/20 new tests, 614/614 chain family, 1,890/1,890 full; tsc 0; index 62 chunks / 286,430 units. [W45 record](ports/W45-chain-runner.md).

W45-79: the ui.press path closes — the dispatch finds the held press by plugin, handle and optional element, refuses a Markdown link the drawing did not declare after normalizing it through the path-safety graph, builds the argument and runs the module press; the terminal entry starts it without waiting and the settle wrapper logs a rejection. Forty source blocks, 4,897 units; the only host boundary binds node's path/url modules and answers the cwd fallback. 16/16 new tests, 630/630 chain family, 1,906/1,906 full; tsc 0; index 64 chunks / 291,177 units. [W45 record](ports/W45-chain-runner.md).

W45-80: the Markdown leaf closes the nine leaf types — it draws text through the already-carried markdown renderer, and a click over a link the drawing declared pressable stops the terminal, waits 500 ms with a live selection subscription, and presses through the terminal entry; a selection appearing during the wait cancels both. Five source blocks, 1,747 units, one host seam for the clock context, the selection context and the instance map. 14/14 new tests, 644/644 chain family, 1,920/1,920 full; tsc 0; index 65 chunks / 292,924 units. [W45 record](ports/W45-chain-runner.md).

W45-81: the interactive elements begin with the Select — a pure function of the select-fields context that draws the picked value, the open highlight and an eight-row window with a hidden-count row, and a site-focus reader gated on the exact press. Nine source blocks, 1,360 units. 12/12 new tests, 656/656 chain family, 1,932/1,932 full; tsc 0; index 65 chunks / 294,284 units. [W45 record](ports/W45-chain-runner.md).

W45-82: the second interactive element is the Input field — a view over the input host's text that draws a bold label, the host editor with a caret kept at the end, and the submit hint while focused, and the dim value otherwise. The editor is a host component token; the terminal-size hook keeps the source's provider requirement. Six source blocks, 992 units. 11/11 new tests, 667/667 chain family, 1,943/1,943 full; tsc 0; index 67 chunks / 295,276 units. [W45 record](ports/W45-chain-runner.md).

W45-83: the hover group is a count store keyed by plugin and scope; members count in and out, the scope provider carries its own hover state, and the resolver maps named colors and applies the group or the enclosing scope. Fifteen source blocks, 2,240 units. The hook seam's context gained its source Provider shape. 10/10 new tests, 677/677 chain family, 1,953/1,953 full; tsc 0; index 68 chunks / 297,516 units. [W45 record](ports/W45-chain-runner.md).

W45-84: the pressable Button draws its label through the action box and owns no press state; every actionable press is an entry in the shared action-key store, and the seat registers one keybinding handler per bound context whose rank decides the winner. The seam adds the keybinding service context, a per-node focus manager and the action-box token. Twenty-three source blocks, 3,496 units. 13/13 new tests, 690/690 chain family, 1,966/1,966 full; tsc 0; index 70 chunks / 300,970 units. [W45 record](ports/W45-chain-runner.md).

W45-85: the Client host acquires one plugin client per element, subscribes to its snapshot and mounts the terminal view under an error boundary; the mount forwards props, layout, pointer and key events and draws only the rebuilt tree. Focus is a host store shared with the pane layer, so pressing a client clears the pane focus and the key path reaches only the focused client. Nine source blocks, 3,896 units. 20/20 new tests, 710/710 chain family, 1,986/1,986 full; tsc 0; index 71 chunks / 304,866 units. [W45 record](ports/W45-chain-runner.md).

W45-86: the walker turns one plugin tree value into surface elements, dispatching each node type to the component that draws it. A Link carries both the well-formed URL and a terminal-safe display href; a keyed Box becomes a hover scope only once per parent, with the drop and repeat reasons reported. Five source blocks, 3,051 units. 13/13 new tests, 723/723 chain family, 1,999/1,999 full; tsc 0; index 72 chunks / 307,819 units. [W45 record](ports/W45-chain-runner.md).

W45-87: the render-version layer versions a surface by the pair (event counter, per-request version) and keeps the visible map versioned by steady keys alone. Twenty-two source blocks, 2,667 units. The package also restored the recovered matcher runner, so scalar matchers no longer pass an always-true test. 25/25 new tests, 748/748 chain family, 2,024/2,024 full; tsc 0; index 74 chunks / 310,408 units. [W45 record](ports/W45-chain-runner.md).

W45-88: the terminal glue turns one site into a surface node through the render version and held rows. The tree is walked under the plugin context, wrapped in the error boundary unless it is a Pane, and drawn from the settled answer only while a hook matches; the failure note is deduplicated and names the contributing plugins. Eight source blocks, 4,823 units; the engine render service, settled cache, row frames, mount counter and terminal mode stay host seams. 19/19 new tests, 767/767 chain family, 2,043/2,043 full; tsc 0; index 74 chunks / 315,116 units. Partition 4 complete. [W45 record](ports/W45-chain-runner.md).

W46-01: the recovered scope-picker frame and row list are ported verbatim (6 blocks, 8,409 units): the focus/window state, the keyboard and wheel movement, the search hook handoff, the preview layout and hint row, and the row list with its markers, stray-click guard and hover. The terminal size, focus and cursor contexts, the search hook and the visual primitives stay host seams. The shared state setter now implements React's functional updater, which the frame requires. 25/25 new tests, 767/767 chain family, 2,068/2,068 full; tsc 0; index 75 chunks / 323,525 units. Next: mount the frame in the product picker. [W46 record](ports/W46-scope-picker.md).

W46-02: the W46-01 frame is generated again against the product TUI runtime and mounted by the scoped picker. The document renderer supplies hooks and Box/Text; the host adds the memo cache, terminal size, focus and cursor contexts, the injected search hook, the stray-click guard and interaction-free visual primitives. The replacement frame is gone, so pick()/frame() render the recovered layout, including the compact hint row at 40 columns. 5/5 new tests, scope-picker 2/2, full 2,073/2,073; tsc 0; identity `6e8c48df…`. [W46 record](ports/W46-scope-picker.md).

W46-03: the recovered frame becomes the ScopedPicker frame used by both terminal hosts. The frame owns focus and window; the host captures its search-field key handler so the picker drives the source movement (up is focus+1 under direction up), onFocus mirrors the focus into the picker cursor, and a query/scope change remounts the host component as the source reset. A fresh item slice per render keeps the identity-based frame memo in step with the in-place scan. 5/5 new tests, picker entry 2/2, full 2,078/2,078; tsc 0; both smokes pass; identity `e8177e84…`. [W46 record](ports/W46-scope-picker.md).

W47-01 closes the MCP lifecycle row as a decision rather than a port. The four listed items already had verified coordinates and dispositions: next-turn background redial is off by default upstream and is superseded by this runtime's bounded recovery, explicit reconnect and stdio next-use re-dial; the parked refetch is driven by a `subscriptions/listen` stream this runtime does not implement, and refresh-on-replacement plus dirty-at-use cover the guarantee; an update lost while the stream is down is unrecoverable upstream too, so it is reported stale-known with the event-id GET resume path; full pixel decoding needs the Bun.Image codec this project does not carry, so the size/byte caps and over-target annotation stay. CURRENT and FEATURES now cite [remaining-dispositions.md](ports/remaining-dispositions.md) items 1/2/5/7 instead of listing the items as gaps. No behavior changed and no recovered entrypoint ran.

W47-02 reclaims a worktree ownership-store lock left by a dead owner. The store lock now records
`harness worktree store (pid N)` and fsyncs it; on EEXIST the lock is read with O_NOFOLLOW under a
512-byte bound, its reason must match the runtime format and name a dead pid (integer in
`(1, 2147483647]` whose `kill(pid, 0)` reports ESRCH), and the same dev/inode must still be
present before unlink. One reclaim-and-retry is allowed; empty, foreign, own-pid and live locks
stay fail-closed. Ported from `_x`/`Rze`/`P1t`/`zPo` in chunk-sfn1dbxq.js and `Iue`/`Nm` in
chunk-3sda67c1.js. 27/27 worktree tests, tsc 0, full 2,079/2,079, chain 767/767, both smokes
pass; identity `2732f49a…`. [W47-02 record](ports/W47-worktree-stale-lock.md).

W48-01 tags checkpoint staging files with the owning store and reclaims them during recovery. The
atomic writer now names temporaries `.checkpoint-<12hex store tag>-<uuid>.tmp`; under the
checkpoint store lock, `recoverCheckpoint` sweeps the store, objects and manifests directories,
and a pending transaction's recovery sweeps each target directory once before its ownership and
conflict checks. Foreign tags, untagged legacy staging, directories and symlinks stay. This closes
the W04 residual for tagged staging while leaving the pre-W48 untagged files visible. Since the
recovered durable checkpoint transaction is unobtainable (W04), this remains a recorded local
extension. 21/21 checkpoint tests, full 2,081/2,081, both crash smokes pass with no staging
residue; identity `f3419f9c…`. [W48 record](ports/W48-checkpoint-staging.md).

W49-01 reconciles an interrupted create's reservation. A `creating` record cannot belong to a live
operation when it is read under the store lock, because every create holds that lock across its Git
mutations. `create` and `remove` now run the same cleanup create's failure path uses: a record
whose directory Git registered under the recorded branch is verified and restored to `ready`; a
record whose Git work never landed is dropped when its unchanged empty directory can be removed and
the branch is absent; anything unverifiable is retained. `list` stays read-only. Two new worktree
tests, 29/29 worktree, full 2,083/2,083, both smokes pass; identity `92d4ad84…`.
[W49 record](ports/W49-worktree-reservation.md).

W50-01 makes worktree removal power-loss recoverable. Before renaming the checkout history into
`.agent/worktree-history`, removal writes and fsyncs a `.pending-<uuid>.json` intent with the
origin, checkout, history, archive, checkout dev/ino and pid. `recoverWorktreeArchives` runs at
interactive start and before each removal: it restores an archived history into an unchanged
checkout, clears a completed or already-home intent, and retains ambiguous states with a warning
(history and archive both present, changed checkout identity, live owner, invalid paths). A
successful removal and an in-process restore both clear their intent. 4/4 worktree-session tests,
full 2,084/2,084, both smokes pass; identity `6fb4abe8…`.
[W50 record](ports/W50-worktree-archive-intent.md).

W51-01 lists and restores preserved worktree histories. `listWorktreeArchives` scans
`.agent/worktree-history` for `<worktree>-<uuid>` directories and reads each as a session
directory through the extracted `listSessionDirectory`, reporting name, creation time, session
count and newest title. `/worktree-history` lists up to 20; `/worktree-history restore ARCHIVE`
accepts an exact name or unique prefix and restores into a fresh owned worktree at the original
name, because archived session metadata names its original workspace. The restore reuses the W50
durable intent, moves the archive into `<checkout>/.agent`, and keeps the checkout rather than
deleting moved history when a rollback cannot be proven. 5/5 worktree-session tests, interactive
7/7, full 2,085/2,085, both smokes pass; identity `436bb75f…`.
[W51 record](ports/W51-worktree-archive-picker.md).

W52-01 serializes live store-lock contention. Acquisition still reclaims a dead owner at once and
verifies the lock exactly as before; when the owner is live, the operation now waits in 50 ms
steps up to `lockWaitMs` (default 30,000; 0 restores fail-fast) and honors the operation signal,
so a second process queues behind a live create/remove instead of failing on a freshly created
lock. The wait does not alter reason matching, the identity-bound release or the dead-owner
policy. 30/30 worktree tests with a wait/abort case, full 2,086/2,086, both smokes pass; identity
`9d611189…`. [W52 record](ports/W52-worktree-lock-wait.md).

W53-01 makes checkpoint capture and its session association one recoverable unit. The capture path
writes a durable `.assoc-<uuid>.json` intent before publishing the manifest and clears it after the
journal append. A resumed `Session.open` scans this session's intents under the session lock and
appends a missing checkpoint event from the validated manifest; an intent whose manifest was never
published, or one already represented by the same name and digest, is cleared, while foreign,
unreadable or digest-mismatched files stay for inspection. Rewind 7/7 adds a real SIGKILL between
capture and append; checkpoints 21/21, full 2,088/2,088, chain 767/767, both checkpoint crash smoke
modes pass; identity `df90fb56…`. [W53 record](ports/W53-checkpoint-association.md).

W54-01 sweeps provable checkpoint garbage and records the durable write order. Under the store lock,
after any pending transaction is resolved, `recoverCheckpoint` removes content-addressed objects no
valid manifest references and association intents whose creator died before publishing a manifest;
unknown names, unreadable manifests, symlinks and capped stores retain the whole affected set. The
four durable writers (intent, object, manifest, transaction) share `atomicWrite`: fsync file, rename,
fsync directory, with the manifest published last and the transaction before effects. Checkpoints
23/23, rewind 7/7, full 2,090/2,090, chain 767/767, both crash smoke modes pass; identity
`6eaa8c28…`. [W54 record](ports/W54-checkpoint-gc.md).

W66-01 verifies real multiplexer decoding of the hook terminal wrapper. The recovered `OI` body
(chunk-kexg5hxg.js UTF-8 [8488,8667), detection `K3t` [7526,7656)) doubles ESC inside DCS for tmux
and screen; the port matches. `scripts/smoke-hook-mux.mjs` runs the product formatter inside each
real multiplexer and has an outer tmux parse the forwarded OSC 0, asserting the pane title, in
source and compiled modes. Display delivery is dispositioned as journal-before-effect at-most-once
with no replay; full original consumers and script semantics remain gaps. tsc 0, full 2,090/2,090,
chain 767/767, identity `bb47c630…`. [W66 record](ports/W66-hook-mux-decode.md).

W67-01 reads the local OS-managed policy directory when no explicit policy file is given. The
ported source seams give the platform directory (`My`), base file (`m_`) and the source merge
customizer; the new loader follows `Lko`'s file tier (base then non-hidden `.json` drop-ins by
name, regular files and symlinks) and reports ignored keys and unreadable documents instead of
inventing policy. Explicit-file strictness and managed-over-authored precedence are unchanged.
Remote policy, the plist/registry and WSL tiers, substitutions and the full approval flow remain
out of scope. tsc 0, config 69/69, settings chains 15/15, full 2,092/2,092, chain 767/767,
identity `f8c89d5a…` (corrected after the final build; W68-01 records it). [W67 record](ports/W67-os-managed-policy.md).

W68-01 dispositions the original TaskGet/TaskList contract against the local task store. The
recovered shapes (`Dr`/`Ur` and their schemas in chunk-tar639dc.js, UTF-16 ranges in the record)
are compared field by field: the source's visibility rules are already ported (hidden
`_internal`, completed blockers dropped in List, derived `blocks`, strict DAG), while UUID
identity, JSON transport, richer fields and the extra update operations remain deliberate
adaptations with the reason recorded. No product code changed; task suites 24/24 and tsc 0. The
same record corrects the W67 identity to `f8c89d5a…` (the value first recorded predated the final
build). [W68 record](ports/W68-task-contract.md).

W69-01 ports the recovered HTML preview fragment gate. `Ae` (chunk-ktr9sak2.js UTF-16
[19624,20102)) rejects a full document, script/style tags and markup-free text with three exact
messages, gated by the host's `questionPreviewFormat` (`uPr`, chunk-4bw62nzm.js [98437,98515)).
The product exposes the same gate as `previewFormat: "html"` on the interaction tools and applies
it to every option preview before dispatch; the host launch-option store is replaced by that
explicit option, recorded as the local adaptation. Two new cases, interaction-tools 23/23, tsc 0,
full 2,094/2,094, chain 767/767, identity `dc4f6cce…`. [W69 record](ports/W69-preview-gating.md).

W70-01 ports the recovered extended question kinds. Behind `extendedQuestions` (the product
counterpart of the host `extendedQuestionsEnabled` launch option), questions accept `kind:
"choice" | "text" | "number"` with the recovered per-kind field rules and messages (`me`,
UTF-16 [8434,9556)), number min/max and defaultValue bounds, optional title, and `kind` defaulted
to `"choice"` before dispatch (`K` [12694,12893)); `Q.check`'s unique-question-text rule applies
in both modes, and custom schema messages now reach the caller. Four new cases, interaction-tools
27/27, tsc 0, full 2,098/2,098, chain 767/767, identity `054cdd94…`. [W70 record](ports/W70-extended-questions.md).

W71-01 ports per-answer annotations. A host answer may now carry `annotations: {preview?,
notes?}`: notes are capped at 8192 (source `te`), unknown fields are refused, and a preview must
exactly match one the question showed (the first `pe` arm). The source's normalized-equivalent
preview arm depends on renderer helpers and stays with the renderer port; the source keys
annotations by question text while the product carries them on the indexed answer. One new case,
interaction-tools 28/28, tsc 0, full 2,099/2,099, chain 767/767, identity `3ed12d16…`.
[W71 record](ports/W71-answer-annotations.md).

W72-01 ports the recovered card answer admission as `admitCardAnswer(shown,
answer)`. Shown-field integrity, the host-only `afkTimeoutMs`, answers keyed by
question text with 8192-unit entries and `qht` joining, strict annotations with an
exact shown-preview match and 8192-unit notes, `response`, extended-only
`followUp`, and the 32768/48000 size caps all follow `V`/`le`/`ce`/`de`/`qht`.
The normalized preview arm and `xHe`'s transform remain unported with reasons, and
no product host emits cards yet, so the default ask contract is unchanged. One new
case, interaction-tools 29/29, tsc 0, full 2,100/2,100, chain 767/767, identity
`21433e88…`. [W72 record](ports/W72-card-admission.md).

W73-01 wires the recovered card host into `ask_user_question`. With
`cardAnswers: true`, an `askCard` callback returns the shown input plus answers,
annotations, response and followUp; the object is admitted through
`admitCardAnswer` (W72's `V`/`le` port) before it becomes the tool result, and a
refusal surfaces the source rule. The default indexed ask contract is unchanged;
the source client host is represented by the explicit callback. One new case,
interaction-tools 30/30, tsc 0, full 2,101/2,101, chain 767/767, identity
`ef8f4ab4…`. [W73 record](ports/W73-card-host.md).

W74-01 ports the recovered normalized preview arm of `pe`. A claimed annotation
preview may differ from the shown preview only through the source normalization
(`Ce` with the `cn` predicate, `Zs`, then the `Ee`/`rPe` stability test), and
only when the shown preview is at most 2000 UTF-16 units; the truncation marker
is never admitted. `ln`/`cn`/`Ce` are copied verbatim and `Zs`/`xg`/`rPe`
reuse the existing source copies. One new case, interaction-tools 31/31, tsc 0,
full 2,102/2,102, chain 767/767, identity `a96ee3cd…`.
[W74 record](ports/W74-preview-normalization.md).

W75-01 ports the recovered shown-field comparison `xHe`. Every returned field
is first bounds-walked on the answer side (20,000 values, depth 64, 1,048,576
characters), then compared with the shown value after a JSON roundtrip through
`isDeepStrictEqual`; the `de` kind allowance uses the same comparison. This
replaces the previous plain structural check, so JSON-equivalent forms such as
`NaN` and `null` now match, and oversized answer fields are refused. The
source's warning is not emitted; the refusal is the effect. One new case,
interaction-tools 32/32, tsc 0, full 2,103/2,103, chain 767/767, identity
`b03f27a0…`. [W75 record](ports/W75-card-field-comparison.md).

W76-01 ports the recovered preview display sanitation. `questionPreviewText`
now runs the source string branch: the 2000-unit cut gate, `pc` control folding
through `Ce`/`cn`/`Zs`, tab expansion to the eight-column stop, then the
truncation-marker and `xg` mark-run checks that withhold. Control characters
become U+FFFD instead of withholding the preview, and the W74 admission helpers
move to a shared `preview-sanitize` module. One new case, terminal 28/28,
interaction-tools 32/32, tsc 0, full 2,104/2,104, chain 767/767, identity
`27613f94…`. [W76 record](ports/W76-preview-display-sanitation.md).

W77-01 ports the recovered question-map tolerance. `cardQuestionMap` follows
`ce`: an absent or non-array shown list yields an empty map with `extended:
false`, non-plain questions and non-string kinds clear `extended`, and every
shown-question field is read through the recovered own-property helper `I`.
An empty shown object with an empty answer is therefore admitted, and answer
keys against an empty map refuse as `answers`. Three assertions added,
interaction-tools 32/32, tsc 0, full 2,104/2,104, chain 767/767, identity
`13f00168…`. [W77 record](ports/W77-question-map.md).

W78-01 ports the recovered permissive skill argument names. `argumentNamesFrom`
follows `$oe`: any non-empty string that is not all digits, from a
whitespace-split string or an array, with duplicates kept; non-strings and other
shapes are dropped. `expandSkill` filters names through it and escapes every
name with the recovered `gl` before the replacement alternation, so dotted,
plus and non-ASCII names substitute correctly; the session schema accepts the
same form. `config`+`session` 70/70, tsc 0, full 2,105/2,105, chain 767/767,
identity `1c2b556a…`. [W78 record](ports/W78-argument-names.md).

W79-01 ports the recovered hook selector table. `hookMatcherValue` follows
`y5e`: tool events select `tool_name`, DirectoryAdded and ConfigChange select
`source`, InstructionsLoaded selects `load_reason`, Setup selects `trigger`,
FileChanged selects the file basename, and an event outside the table has no
selector, so its configured matchers accept every occurrence as `zze` does.
CwdChanged now carries `old_cwd`/`new_cwd`, DirectoryAdded carries
`directory`/`source`, FileChanged carries `file_path`/`event`,
InstructionsLoaded carries `load_reason`, Setup carries `trigger: "init"`,
and Elicitation carries `mcp_server_name`. `hooks` 48/48,
`agent-lifecycle` 25/25, tsc 0, full 2,107/2,107, chain 767/767, identity
`fd3b6906…`. [W79 record](ports/W79-hook-selectors.md).

W80-01 ports the recovered model-switch hook payloads. PreModelSwitch sends
`from_model`, `to_model` and `requested_model` before the change;
PostModelSwitch sends the same three fields after it, with the prior model
captured before `applyConfig` replaces the session. The selector reads
`to_model` only; model-alias normalization and the `source`/flag fields stay
unported. `interactive` 7/7 with both payloads captured from real hooks,
`hooks` 48/48, tsc 0, full 2,107/2,107, chain 767/767, identity `560f098a…`.
[W80 record](ports/W80-model-switch-payloads.md).

W81-01 wires the recovered watcher-driven FileChanged raise. `watchProjectConfig`
reports each relevant Node watcher event as `(filePath, add|change|unlink)`
(rename is add or unlink by existence), and the interactive loop raises
FileChanged with the recovered `{file_path, event}` payload, displaying the
result's `systemMessages` like `ke` does. Hook-returned `watchPaths` and the
source failure-output display stay residual. `config-watch` 3/3, tsc 0, build
0, full 2,108/2,108, chain 767/767, identity `700a4af5…`.
[W81 record](ports/W81-file-watcher-events.md).

W82-01 ports hook-returned watch paths. `HookResult.watchPaths` collects
`hookSpecificOutput.watchPaths` from hooks whose event name matches, in run
order; the interactive FileChanged and CwdChanged raises add the collected
paths to the config watcher, which applies its existing absolute-path, count
and byte bounds. The agent's tool-mutation FileChanged raise has no watcher
consumer and ignores them. `hooks` 49/49, tsc 0, build 0, full 2,109/2,109,
chain 767/767, identity `35629d1f…`. [W82 record](ports/W82-watch-paths.md).

W83-01 ports the failed-hook display for watcher events. `HookResult.failures`
carries the same failure text already placed in model context for spawn
errors, timeouts, non-blocking exit 2 and other non-zero exits; the interactive
FileChanged and CwdChanged raises display those entries after the system
messages, as `ke` does with unsuccessful results. Blocking exit-2 events keep
their existing block behavior. `hooks` 50/50, tsc 0, build 0, full
2,110/2,110, chain 767/767, identity `53e0f27e…`.
[W83 record](ports/W83-failed-hook-output.md).

W84-01 ports the TaskCreated payload and its rollback. The raise sends the
created task's own `task_id`, `task_subject` and `task_description` rather than
the tool echo; a blocking hook deletes the task through the new internal
`removeTask` (unlinks it from dependents' `blockedBy`), and the tool result
becomes `TaskCreated hook feedback:`. TaskCreated joins the blocking and
decision-block sets, matching `Zge`. Team fields stay unset because the tool
path has no team identity. `agent-lifecycle` 27/27, `hooks` 50/50, tsc 0,
build 0, full 2,112/2,112, chain 767/767, identity `081a61bf…`.
[W84 record](ports/W84-task-created-hooks.md).

W85-01 aligns the TaskCompleted and TeammateIdle payloads. The TaskCompleted
gate reads the target record and sends `task_id`, `task_subject`,
`task_description` and `teammate_name` from its `owner`, falling back to the
tool fields only when the record is absent; WorktreeCreate is unchanged. The
interactive TeammateIdle raise drops its local `source` and keeps `agent_id`
and `teammate_name`. The per-task completion trigger stays as the existing
adaptation; `team_name` has no local source. `agent-lifecycle` 29/29,
`hooks` 50/50, tsc 0, build 0, full 2,114/2,114, chain 767/767, identity
`6b50f209…`. [W85 record](ports/W85-task-completed-payload.md).

W86-01 completes the SessionStart payload. `startSession` adds
`agent_type` for child sessions and `session_title` from the latest recorded
`title` event, matching `t7r`; a session without a title leaves the field
unset, as the source's `vm` yields undefined. `agent-lifecycle` 30/30, tsc 0,
build 0, full 2,115/2,115, chain 767/767, identity `3c77f51d…`.
[W86 record](ports/W86-session-start-payload.md).

W87-01 ports PreCompact custom instructions. The payload carries
`custom_instructions` (the `/compact` text, or null); successful hook stdout
collects as `newCustomInstructions`, and the summary prompt appends
`Additional Instructions:` with hook instructions first and the user text as
`User context:`, matching `rAe`/`wnn`/`ztt`. The raw stdout is excluded from
the duplicate `Hook context:` block but still reaches other consumers through
`additionalContext`. `agent-lifecycle` 31/31, tsc 0, build 0, full
2,116/2,116, chain 767/767, identity `e3257471…`.
[W87 record](ports/W87-precompact-instructions.md).

W88-01 ports the MessageDisplay contract. The agent raises
`{turn_id, message_id, index: 0, final: true, delta}` once per completed
message (the source's completed-message path), and
`hookSpecificOutput.displayContent` replaces the turn's displayed text while the
stored message and model view keep the original. Per-token delta rewriting is
not replicated; the whole completed text is the single final delta.
`agent-lifecycle` 32/32, tsc 0, build 0, full 2,117/2,117, chain 767/767,
identity `9088606a…`. [W88 record](ports/W88-message-display.md).

W89-01 corrects script-hook handling from the recovered build. `ito` throws
"script hooks are not available in this build" before anything runs, and the
adapter catch records that as the failure, blocking only for PreToolUse and
PermissionRequest. `runHooks` now refuses script hooks the same way instead of
executing the command; the transport test asserts the refusal and that no
command ran. `hooks` 51/51, `hook-transports` 3/3, tsc 0, build 0, full
2,118/2,118, chain 767/767, identity `f7a620b6…`.
[W89 record](ports/W89-script-hooks.md).

W90-01 aligns the worktree hook payloads. WorktreeCreate sends only the
requested `name` (`CTn`, chunk-sfn1dbxq.js offset 2952999) and WorktreeRemove
sends only `worktree_path` (`Xir`, offset 2954347), the manager's own
deterministic target; the tool echo is gone from both. The source's hook-owned
WorktreeCreate creation and informational WorktreeRemove failures stay
recorded adaptations. `agent-lifecycle` 33/33, tsc 0, build 0, full
2,119/2,119, chain 767/767, identity `8288ec96…`.
[W90 record](ports/W90-worktree-hooks.md).

W91-01 ports the per-file InstructionsLoaded payload. The loader records each
file's importing parent and a rule's patterns; `startSession` raises one event
per loaded file (`file_path`, `memory_type`, `load_reason`, optional
`globs`/`parent_file_path`), and path access raises
`nested_traversal`/`include`/`path_glob_match` with
`trigger_file_path`. This runtime has one project instruction tier, so every
file reports `Project`; later eager reasons are not tracked.
`agent-lifecycle` 34/34, tsc 0, build 0, full 2,120/2,120, chain 767/767,
identity `87bbcc5c…`. [W91 record](ports/W91-instructions-loaded.md).

W92-01 ports the permission-prompt Notification. While a prompt is pending,
`notifyPermissionPrompt` arms the source's unref'd six-second timer and
raises `{message, notification_type: "permission_prompt"}`; an answer cancels
it and `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS` suppresses the
arm. The prior Notification raise for internal runtime event prompts is
removed because `S0` has no such caller. `interactive` 8/8, tsc 0, build 0,
full 2,121/2,121, chain 767/767, identity `8ff650c8…`.
[W92 record](ports/W92-permission-notification.md).

W93-01 maps SessionEnd close causes onto the recovered reason enum
(`clear`, `resume`, `logout`, `prompt_input_exit`, `other`). The product's
internal causes no longer reach the hook: `session_switch` is `resume`,
`exit` is `prompt_input_exit`, and the remaining close causes are `other`.
`agent-lifecycle` 35/35, `interactive` 8/8, tsc 0, build 0, full
2,122/2,122, chain 767/767, identity `11df4f85…`.
[W93 record](ports/W93-session-end-reasons.md).

W94-01 aligns the Stop-family payloads. Stop and SubagentStop send the trimmed
last message only when present, SubagentStop adds `agent_transcript_path` and
drops `reason`, and StopFailure drops `stop_reason` on both raise sites.
`background_tasks` and `session_crons` remain omitted because the agent has
no runtime registry handle. `agent-lifecycle` 36/36, tsc 0, build 0, full
2,123/2,123, chain 767/767, identity `5ac052d1…`.
[W94 record](ports/W94-stop-payloads.md).

W95-01 ports the UserPromptExpansion payload. The event is raised only when
`Agent.run` receives an expansion descriptor, carrying `expansion_type`,
`command_name`, `command_args` and the reconstructed command text; the
interactive slash-command path supplies them. The prior per-prompt
`{prompt, source}` raise is removed, and the attachments test now asserts the
hook stays silent for `/attach`. `agent-lifecycle` 38/38, `interactive` 8/8,
`attachments` 2/2, tsc 0, build 0, full 2,124/2,124, chain 767/767, identity
`50e58886…`. [W95 record](ports/W95-user-prompt-expansion.md).

W96-01 corrects ConfigChange. The event is watcher-driven with the recovered
five-value `source` and `file_path`; the settings and skills watchers gate
their reload fan-out on it, `policy_settings` never blocks, and exit 2 blocks.
The invented synchronous raises for theme, editor, model-family config,
reload and MCP reconnect are removed. `config-watch` 4/4, `hooks` 52/52,
`interactive` 9/9, tsc 0, build 0, full 2,127/2,127, chain 767/767, identity
`6443354c…`. [W96 record](ports/W96-config-change.md).

W97-01 aligns the UserPromptSubmit payload. The event carries `prompt` and the
recorded `session_title` and no longer invents `source: "user"`; this build's
two builders omit the optional field. The title resolves from the latest
`title` event through the same helper SessionStart uses.
`agent-lifecycle` 38/38, tsc 0, build 0, full 2,128/2,128, chain 767/767,
identity `fc290fa6…`. [W97 record](ports/W97-user-prompt-submit.md).

W98-01 completes the Stop/SubagentStop runtime state. Both events now carry
`background_tasks` (running shell/monitor jobs with the 1000-unit truncation)
and `session_crons` (`id`, `schedule`, `recurring`, truncated `prompt`),
projected from the owning runtime in the interactive, headless and every
child-agent path. `background` 23/23, `runtime-resources` 11/11,
`agent-lifecycle` 39/39, tsc 0, build 0, full 2,131/2,131, chain 767/767,
identity `9b2dc7df…`. [W98 record](ports/W98-stop-runtime-state.md).

W99-01 restores the UserPromptExpansion `command_source` field. The skill
loader records the settings scope that authorized each directory
(`projectSettings`, `userSettings`, `plugin`) and the interactive slash
command passes it into the hook payload; a hand-built skill without a scope
omits the optional key. Focused 170/170, tsc 0, build 0, full 2,131/2,131,
chain 767/767, identity `e0cd9d5e…`. [W99 record](ports/W99-skill-source.md).

W100-01 removes the invented `updatedPrompt` hook field. The recovered
expansion consumer reads only blocking verdicts, continuation stops, additional
context and messages, and the string `updatedPrompt` does not occur anywhere in
the extracted modules. The submitted and expanded prompt are now authoritative;
a hook output naming that field is kept opaque and ignored. Focused 103/103,
tsc 0, build 0, full 2,131/2,131, chain 767/767, identity `f4fc4704…`.
[W100 record](ports/W100-no-prompt-rewrite.md).

W101-01 raises UserPromptExpansion before every execution-mode skill, not just
plain expansions. The interactive branch calls the hook before `runSkill`, a
blocked verdict prevents the run and reports `hook_blocked`, and the hook's
additional context reaches fallthrough turns through a new optional
`Agent.run` context parameter. UserPromptExpansion is now in the exit-2
blocking set. Focused 102/102, tsc 0, build 0, full 2,133/2,133, chain
767/767, identity `ef637462…`.
[W101 record](ports/W101-expansion-execution.md).

W102-01 consumes the hook-provided session title. SessionStart records it only
for startup, resume and fork sources, UserPromptSubmit records it before the
turn, and both normalize through the recovered `ci` helper (control/format
runs become a space, 200 code points, trimmed). The session list and later
UserPromptSubmit payloads now read the recorded title. Focused 94/94, tsc 0,
build 0, full 2,136/2,136, chain 767/767, identity `6c6de060…`.
[W102 record](ports/W102-session-title.md).

W103-01 consumes the SessionStart `initialUserMessage`. The last non-empty
value is returned by `startSession` and queued by the front end as the session's
first user turn: headless runs it before the typed prompt, interactive puts it
ahead of typed or piped input, and clear/fork restarts unshift it. It is never
stored as a lone message event, so the first `run()` is not blocked by an
unfinished turn. Focused 107/107, tsc 0, build 0, full 2,138/2,138, chain
767/767, identity `b4860f22…`.
[W103 record](ports/W103-initial-message.md).

W104-01 honors the SessionStart `reloadSkills` output. After the hooks
complete, the skill directories are re-scanned, the live catalog array is
replaced in place so the already-built skill tool sees it, and the system
prompt's catalog section is rewritten; settings, hooks, permissions and
instructions stay as loaded. A legacy configuration without a skill catalog and
a failed rescan both keep the previous state. Focused 110/110, tsc 0, build 0,
full 2,140/2,140, chain 767/767, identity `b59db97a…`.
[W104 record](ports/W104-skill-reload.md).

W105-01 consumes `suppressOriginalPrompt` on UserPromptSubmit and
UserPromptExpansion. Blocked prompts render the recovered
`<event> operation blocked by hook:\n<reason>` text plus
`Original prompt: <prompt>` unless the hook suppressed it; internal blocks
where the hook never ran suppress automatically, and ordinary exit 2 keeps the
prompt. Both prompt events now honor a top-level `decision:"block"` like `pX`.
Focused 88/88, tsc 0, build 0, full 2,143/2,143, chain 767/767, identity
`3319a5a3…`.
[W105 record](ports/W105-prompt-block.md).

W106-01 consumes the PermissionDenied `retry` output. When a deny path's hook
returns it, the recovered meta user message "The PermissionDenied hook
indicated you may retry this tool call." is appended after the paired tool
result batch, hidden from display and present in the next request. The source
skips it only on `noVerdict` auto-mode classifier denials, which this build
cannot produce. Focused 97/97, tsc 0, build 0, full 2,144/2,144, chain
767/767, identity `ef87a5eb…`.
[W106 record](ports/W106-permission-retry.md).

W107-01 consumes SubagentStart `additionalContext`. A child session's first
request carries the recovered `hook_additional_context` content, the same
position the source attachment occupies; a top-level session never raises the
event. Focused 45/45, tsc 0, build 0, full 2,145/2,145, chain 767/767,
identity `b6d0794d…`.
[W107 record](ports/W107-subagent-context.md).

W108-01 consumes PostModelSwitch `additionalContext`. The hook result is
staged in the event log and the next request carries it once as
`Hook context:`; later requests see it only as ordinary history. Focused
46/46, tsc 0, build 0, full 2,146/2,146, chain 767/767, identity `1e2c779c…`.
[W108 record](ports/W108-modelswitch-context.md).

W109-01 consumes Setup `additionalContext`. Startup-only Setup results reach
the first request through the same one-shot hook context scan; a resume start
does not raise the event. Focused 47/47, tsc 0, build 0, full 2,147/2,147,
chain 767/767, identity `45cc6853…`.
[W109 record](ports/W109-setup-context.md).

W110-01 consumes PreModelSwitch `permissionDecision`. Deny blocks with the
recovered text, ask asks the user to confirm and declining blocks with the
recovered model-specific text, and allow records the answer without a local
skip-confirm consumer. Focused 67/67, tsc 0, build 0, full 2,148/2,148, chain
767/767, identity `dbe3098b…`.
[W110 record](ports/W110-modelswitch-decision.md).

W111-01 consumes SessionStart `watchPaths`. The merged paths return from
`startSession`; the interactive loop registers them with the config watcher
for startup via `initialWatchPaths` and for every later start from the return
value. Focused 63/63, tsc 0, build 0, full 2,150/2,150, chain 767/767,
identity `ec6093d6…`.
[W111 record](ports/W111-sessionstart-watch-paths.md).

W112-01 consumes PostToolUse `updatedMCPToolOutput`. The MCP-only rewrite
applies to `mcp__` tools and wins over `updatedToolOutput` there; other tools
ignore it. The account memory server guard has no local analogue. Focused
102/102, tsc 0, build 0, full 2,151/2,151, chain 767/767, identity
`ecd38624…`.
[W112 record](ports/W112-updated-mcp-output.md).

W113-01 creates isolated child worktrees through WorktreeCreate hooks: the first
successful hook's path (JSON field or trailing stdout line), dot-segment and
symlink-ancestry screening, an existing-directory check, and WorktreeRemove on
cleanup with the checkout preserved on failure. Hooks always win when
configured; the Git manager remains the fallback. Focused 111/111, tsc 0, build
0, full 2,154/2,154, chain 767/767, identity `2f5efec2…`.
[W113 record](ports/W113-hook-worktree.md).

W114-01 reports the recovered advisory when an isolated child runs in a
workspace with no Git repository and no WorktreeCreate hook, instead of the Git
manager's failure. A workspace inside a repository whose root is elsewhere
still takes the manager's own root error. Focused 88/88, tsc 0, build 0, full
2,155/2,155, chain 767/767, identity `95c17af3…`.
[W114 record](ports/W114-worktree-advisory.md).

W115-01 consumes Elicitation and ElicitationResult hook answers. The
Elicitation answer replaces the MCP dialog (and skips the result hooks); after
a dialog answer, a blocking ElicitationResult declines and an answer overrides
the action while keeping the person's content when the hook supplies none.
Focused 97/97, tsc 0, build 0, full 2,158/2,158, chain 767/767, identity
`82dd4570…`.
[W115 record](ports/W115-elicitation-hooks.md).

W116-01 raises DirectoryAdded with the documented slash_command producer on a
workspace relocation and displays each failed hook output after the system
messages. The local CLI has no /add-dir or register_repo_root, so relocation
commands stand in for the source's registration triggers. Focused 71/71, tsc 0,
build 0, full 2,159/2,159, chain 767/767, identity `7b5c2d92…`.
[W116 record](ports/W116-directory-added.md).

W117-01 consumes PermissionRequest's deny `interrupt`. The adopted denying hook
(regular or classic chain) logs `Hook interrupt: tool=… hookMessage=…` and
aborts the turn's owned controller; the denial is still the tool result and the
turn finishes aborted before any post hook. Focused 214/214, tsc 0, build 0,
full 2,162/2,162, chain 768/768, identity `1c73f452…`.
[W117 record](ports/W117-permission-interrupt.md).

W118-01 consumes a PermissionRequest allow's `updatedPermissions`. The list is
validated with the recovered `Bz` schema, and the adopted answer's rules and
mode join a session-owned permission state consulted by every decision; an
unrepresentable deny or ask rule refuses the call with the source's own text,
while allow rules with content, unsupported modes and directories are dropped.
No settings writer exists, so the updates die with the session. Focused
131/131, extended 246/246, tsc 0, build 0, full 2,168/2,168, chain 768/768,
identity `b50e00a3…`. [W118 record](ports/W118-permission-updates.md).

W119-01 consumes a plugin command hook's `asyncRewake`. The definition implies
the async owner; the owner keeps the run's raw exit code and output, and an
exit code 2 completion carries a wake whose body is the configured prefix (or
`Stop hook blocking error from command "…":`) followed by stderr else stdout,
reminder-escaped and credential-redacted, with `rewakeSummary` or
`Stop hook feedback` as the summary. The runtime queues the body as the owner's
event prompt. Broken-install detection, its dedupe and the trusted-plugin JSON
summary have no local surface. Focused 103/103, extended 226/226, tsc 0,
build 0, full 2,171/2,171, chain 768/768, identity `06c37dbf…`.
[W119 record](ports/W119-async-rewake.md).

W120-01 adds `/background [PROMPT]`. The seed port follows `fBe`: the latest
real user text (or the explicit prompt) as intent, the latest assistant line as
detail, with tool results, command records and the two local meta kinds
skipped. The command writes the fork journal before spawning a detached
headless child on `--resume <forkId> <task>` with output under
`.agent/background/<forkId>.log`; a failed spawn removes the fork. The source's
job registry, snapshot copy, worktree briefing and carry-over counts have no
local counterpart. Focused 50/50, extended 86/86, tsc 0, build 0, full
2,177/2,177, chain 768/768, identity `5824092a…`.
[W120 record](ports/W120-background-fork.md).

W121-01 gives skill inline shell spans an independent durable effect journal. Each span is
identified by the skill, the authored span index and the SHA-256 of the expanded command; a
`started` record is fsynced before the spawn and a `finished` or `failed` record follows it.
A start without a terminal record means the process died after the effect began: the next run of
that skill reports it once with the local interrupted-effect sentence and acknowledges it with an
`unknown` record only after the rerun returns, so a failed rerun keeps the warning. Torn trailing
appends are discarded; complete malformed records and journals over 4 MiB fail closed. The
recovered source reaches the same ordering through a synthetic tool-use id and the tool runtime;
local spans have no model tool id, so they use `.agent/skill-effects/<owner>.jsonl` instead.
Focused 35/35, extended 86/86, tsc 0, build 0, full 2,184/2,184, chain 768/768, identity
`04147ee3…`. [W121 record](ports/W121-skill-effect-journal.md).

W122-01 ports conditional skills. A skill whose frontmatter names `paths` is held out of the
loaded catalog; `loadProjectConfig` returns it separately and `SessionConfig.heldSkills` keeps
the live list. Every path-bearing tool call runs the recovered activation test: the touched path
is made workspace-relative, patterns are matched with the same gitignore library the source
bundles, and the first match moves the skill into the captured catalog array and re-renders the
system-prompt section before the next request. `src/**` normalizes to `src`, a lone `**` leaves
the skill unconditional, a non-string pattern is a config error, and paths outside the workspace
never activate. Dynamic directory discovery remains open. Focused 134/134, lifecycle 55/55, tsc 0,
build 0, full 2,190/2,190, chain 768/768, identity `03e2bef1…`. [W122 record](ports/W122-conditional-skills.md).

W123-01 ports dynamic skill directory discovery. Every path-bearing tool call walks from the
touched file's directory up to the workspace and records each `<dir>/.harness/skills` candidate
once per session. A candidate that exists and is not ignored by `git check-ignore` is loaded
with the project skill rules; malformed entries are skipped rather than failing the tool, names
already live or held are not duplicated, and new skills are appended to the live catalog and
re-rendered before the next request. `reloadSkills` re-reads the discovered directories after
the static rescan. Focused 137/137, three-suite 164/164, tsc 0, build 0, full 2,194/2,194, chain
768/768, identity `4149770c…`. [W123 record](ports/W123-dynamic-skill-discovery.md).

W124-01 closes the C-10 residual list without product changes. The `anthropic-skills` reserved
namespace and its collision naming are part of claude.ai account sync and are excluded with it;
the citation-drops-when-redaction-changes-its-URL rule is already the `web_search` contract
(`src/web-search.ts` line 155, recorded in W19); the recovered shell AST keeps its not-ported
decision. The disposition is item 7 of `ports/remaining-dispositions.md`; FEATURES and the
three C-10 rows now read as closed. Last measured gates are W123's (full 2,194/2,194) and the
identity is unchanged at `4149770c…`. [W124 record](ports/W124-c10-dispositions.md).

W125-01 ports the original workflow script API. `workflow_run` now accepts `script` + `args`
beside `tasks`: the first statement must be a pure-literal `meta` export, the body is
await/yield/for-await rewritten, and it runs in a vm context with code generation disabled,
Date/Math.random removed, intrinsics frozen and a copy generator at the boundary. Scripts call
agent/parallel/pipeline/phase/log/console/budget/timers/args; agents spawn through the same
AgentRegistry, a failed child records `[label] failed: …` and returns null, and the result is
`{ result, agent_count, logs, failures, phases, duration_ms, error? }`. Journal/resume,
`scriptPath`/named workflows, reattachment, automatic effect replay and `agent({schema})`
remain out. Workflow family 42/42, tsc 0, build 0, full 2,203/2,203, chain 768/768, notices
checked, index unchanged, identity `3f771f63…`.
[W125 record](ports/W125-workflow-scripts.md).

W126-01 adds `scriptPath` to `workflow_run`. A workflow script can now be read from a file:
the path resolves against the session workspace, opens with `O_RDONLY|O_NOFOLLOW`, and the
opened descriptor is checked for `ino === 0`/`nlink > 1`, regular-file type and the 524,288-byte
cap before the source is parsed and run in the same sandbox as an inline script. Exactly one of
`script`/`scriptPath` is required and neither composes with `tasks`. Named workflows,
journal/resume, reattachment and structured output remain out. Workflow family 43/43, tsc 0,
build 0, full 2,204/2,204, chain 768/768, notices 0, identity `adad009d…`.
[W126 record](ports/W126-script-path.md).

W127-01 dispositions the unattended memory consolidation pass. The recovered trigger needs a
cross-session transcript store, the memory items record with capped-run settlement, a
cross-session lock/state file and a forked background query with its own permission and task
lifecycle; this runtime has none of those layers, so the trigger is not ported. The user-facing
function is carried by in-conversation maintenance, which `AUTO_MEMORY_INSTRUCTIONS` already
requires and which performs memory upkeep without a separate extraction call. Marketplace,
publish and plugin conflict/auto-discovery clauses remain open under C-9. Documentation-only
package; identity `adad009d…`. [W127 record](ports/W127-auto-dream-disposition.md).

W128-01 ports the workflow script journal and `resumeFromRunId`. Each script run now owns a
`journal.jsonl` under the session workflow directory, with the recovered v2 chained key over the
previous key, the prompt and the execution options. A resumed run reuses completed agent() results
for the longest unchanged prefix, reruns a call that has a `started` entry but no `failed` entry,
reruns failed or skipped calls, and runs the first changed call and everything after it live.
Journal writes are best-effort and never fail the script. The remote journal mirror, named
workflows, reattachment and automatic effect replay remain out. tsc 0, build 0, focused 64/64,
notices 0, identity `4c2f329b…`. [W128 record](ports/W128-script-journal.md).

W129-01 ports the recovered startup header. The first interactive frame now paints the source's
16-row ASCII header above the prompt, with the 58-cell art width, the light/dark theme branches,
the product's neutral name, and the package version from `cliVersion()`. Below 30 terminal rows
the header collapses to the source's single line. It is shown only while the transcript is empty,
so the first committed message removes it. The Apple_Terminal-only `V` variant remains out.
tsc 0, build 0, focused 75/75, notices 0, source index unchanged, identity `b86d2a9d…`.
[W129 record](ports/W129-tui-welcome.md).

W130-01 ports the Apple Terminal welcome variant `V`. When `TERM_PROGRAM` is
`Apple_Terminal`, the startup header now uses the source's quarter-block body in both themes;
the first 12 rows stay the generic art, and every other terminal keeps W129's rendering. The
variant is selected through `TuiOptions.termProgram`, cached with the header, and covered by a
two-theme test. Focused TUI/terminal tests 76/76, tsc 0, build 0, notices 0, source index
unchanged, identity `21ac3022…`. [W130 record](ports/W130-welcome-apple-terminal.md).

W131-01 completes C-1's local side. Without an explicit base, the launcher now resolves
`LLM_BASE_URL`, then a loopback `MAGPIE_ADDR`, then Magpie's `stash.json` wiring record
(`claude.wired_at`, bounded regular file, symlinks rejected, deterministic fallback across
`*.wired_at`), then `http://127.0.0.1:3425`, so a rotated port does not need repeating on each
run. A `sk-magpie-revoked-` caller key is never forwarded: the next source is used, an
all-revoked selection re-reads the client settings once for a rotated key, and a still-revoked
result fails while naming only variables. `--check` reports `baseSource`, `credentialSource`
and `rotationRecovered`; a resumed session keeps its pinned endpoint and model. Focused tests
18/18, tsc 0, build 0, notices 0, both owned Magpie smokes passed, identity `eac028a1…`.
[W131 record](ports/W131-magpie-endpoint-rotation.md).

W132 closes C-8's structured-output item. A workflow `agent({schema})` call refuses a
non-object root with the source lint text and refuses an unsupported schema before any child
exists. A valid schema appends the `StructuredOutput` tool (its API `input_schema` is the
caller's schema) and the source `bs` system note; each call is validated, failures are tool
errors, the fifth failure is the source retry cap, and a tool batch without a satisfying call
gets the source `[structured-output-enforce]` nudge once. A successful call carries
`endsTurn`, so the turn finishes without another model request, and the validated object is
returned to the script and stored in the journal for resume. `inspectJson` now accepts plain
records and arrays from the workflow VM realm while still rejecting class instances. Focused
73/73, full 2223/2223, tsc 0, build 0, notices 0, both workflow smokes passed, identity
`eaeec9c8…`. [W132 record](ports/W132-workflow-agent-schema.md).

W133 closes C-8's tool-narrowing item. `agent({disallowedTools})` and
`agent({bashCommandClamp})` are validated with the recovered rule grammar before a child
exists: unpadded non-empty names, `Bash(<command or prefix>)` entries, dedupe and sort. Denies
are applied to the child pool by exact name and MCP scope; case mismatches, empty or wildcard
MCP segments and wildcards outside MCP refuse the spawn. A clamp adds an implicit `mcp__*`
deny, refuses a schema spawn whose `StructuredOutput` is denied, and refuses a pool with no
shell tool. At execution the child permission gate checks every `shellReadings` reading against
every inherited clamp group, admits exact and `prefix:*` rules (including `xargs` forms),
refuses prefix matches for compound readings, and fails closed on an incomplete reading set
with the source denial text. Focused 111/111, full 2235/2235, tsc 0, build 0, notices 0, both
workflow smokes passed, identity `eff677d0…`.
[W133 record](ports/W133-workflow-agent-tool-restrictions.md).

W134 closes C-8's stall option. `agent({stallMs})` is read in the spawn options and carried
through the child session config; a positive finite window arms a per-attempt timer, text or
thinking progress restarts it under `min(stallMs*0.1,1000)`ms throttling, a silent window
aborts the attempt with `DOMException('stalled','AbortError')`, and five retries precede the
source failure text for six stalled attempts. Without the option the model request path is
unchanged; the source's stream-watchdog default and whole-query retry are not ported, so a
retry restarts the request and does not replay executed tools. Focused 87/87, full 2237/2237,
tsc 0, build 0, notices 0, both workflow smokes passed, identity `0d0226fa…`.
[W134 record](ports/W134-workflow-agent-stall.md).

W135 closes one PostToolBatch payload difference. The source's hook input is the common
fields plus `tool_calls`, each `{tool_name, tool_input, tool_use_id, tool_response}` built from
the resolved batch and its `tool_result` content. The independent transport now sends that
shape and shares the same array with the classic chain event; `tool_use_ids` is no longer
emitted. Focused 83/83, full 2238/2238, tsc 0, build 0, notices 0, identity `8066539f…`.
[W135 record](ports/W135-post-tool-batch-input.md).

W136 closes the StopFailure consumer difference. The recovered caller awaits the outside-REPL
hook run and reads none of its answer. Both StopFailure raise paths here (a failed model
request and `finishWithHooks` for a non-clean stop) still run and journal the hook, but no
longer display `additionalContext` or carry it into context. `error_details` is not sent
because local error values carry no such detail object. Focused 136/136, full 2238/2238,
tsc 0, build 0, notices 0, identity `1d28148b…`.
[W136 record](ports/W136-stop-failure-discard.md).

W137 closes the PostCompact display difference. The recovered `avt` collector reads none of the
hook's structured fields: it skips cancelled records and builds one
`PostCompact [<label>] completed successfully|failed[: <output>]` line per remaining record
from its raw stdout/stderr, joined into a display-only `userDisplayMessage`. The product now
builds that same message with the source's label mapping (`Mx`), journals it on the
`hook_result` event and displays it through the existing bounded status path. For this event
`suppressOutput`, `systemMessage` and `additionalContext` no longer apply, matching the
recovered caller; non-command transports use their own labels. Focused 136/136, full
2238/2238, tsc 0, build 0, notices 0, identity `9e503123…`.
[W137 record](ports/W137-post-compact-display.md).

W138 closes the SessionEnd display difference. The recovered `uvt` collector discards the
answer and, after the shutdown runner, writes one line per failed record whose output is
non-empty: `SessionEnd hook [<label>] failed: <output>`. The label is the same `Mx` mapping
used for PostCompact; status 2 takes the decision-block reason when present, other non-zero
statuses take stderr, and timeout/abort records `Hook cancelled`. The product now builds those
lines, displays them unprefixed through the cleaned bounded status path and outside the
`suppressOutput` gate, and stops displaying successful SessionEnd context, which the source
never shows. Focused 138/138, full 2240/2240, tsc 0, build 0, notices 0, identity `23bfdb9f…`.
[W138 record](ports/W138-session-end-failure-display.md).

W139 keeps PostCompact's runner-side `terminalSequence` effect. The shared per-hook generator
applies `terminalSequence` while each record settles (chunk-sfn1dbxq.js 3018155, read at
3041266, emitter `LLe` at 619331), before `b0` returns the records `avt` formats, so the
effect is not among the structured fields W137 made unread. The terminal-sequence handling is
now a helper shared by the JSON protocol and the PostCompact branch, which parses stdout only
for that effect; context, system message, suppression and hook-specific output stay unread.
Focused 139/139, full 2241/2241, tsc 0, build 0, notices 0, identity `a118ac44…`.
[W139 record](ports/W139-postcompact-terminal-sequence.md).

W140 measures the next C-12 subsystem, the engine pipeline `gno`, without changing the product.
An acorn top-level closure over chunk-n3ykh62m.js finds 204 statements / 40,767 UTF-16 units:
`gno` is 1,198 units with nine imported seams, and the unported core is tree validation `Eur`
(4,340), the draw/link/row transforms `nIn`/`dno`/`kur`/`vur`, and the handler cluster
`qss`/`zss`/`Wss`/`Uss`/`Bss`/`Gss`/`Nss`. Render-layer names already carried by W45-86..88 are
excluded from the plan. The slices are draw transforms, handler dispatch, validation, then the
default `RenderAnswerHost` wiring. Identity stays `a118ac44…`; baseline 139/139 focused and
2241/2241 full.
[W140 record](ports/W140-gno-engine-recon.md).

W141 lands the first `gno` slice, the engine's pre-paint draw transforms. Eight verbatim blocks
from chunk-n3ykh62m.js (2,740 UTF-16 units) cover `nIn`/`QPn` borderStyle dispatch (`nIn`
[267031,267454), `QPn` [247131,247200): a value outside the `rQt` table leaves props and hover
and reaches the callback, a table name stays), `dno` key removal (the `xAt` problem predicate
decides), `kur` link validation (every Link ordinal, `tIn`/`ino` rules, a refused Link becomes
the `eIn` Text, problems delivered once only when non-empty) and `vur` Code handling (every
Code ordinal, a `vVe`-refused diff loses `format`/`startLine` and is reported with the
`IL`-shortened path). The generated copy imports existing package helpers only and sits behind
a typed seam; no `gno` caller is wired until the handler and validation slices. Focused 8/8,
full 2247/2247, tsc 0, build 0, notices 0, identity `3edf8eca…`.
[W141 record](ports/W141-engine-draw.md).

W142 adds the engine's drawn-budget slice. `Rur` (chunk-n3ykh62m.js [270375,270825)) spends one
character budget through `isHeld`/`field`/`shown`/`markOf` and records `written`/`drawn` plus
`isCut`; `Tur` ([268980,270363)) clips Code/Markdown text, a Client's key/module/props, Button and
Select labels, Svg/Image/Input props, Box keys and Link hrefs while preserving node identity;
`Nss` reports the counters only when something was cut. `zss` ([281200,281622)) rewrites a drawn
prop only when it differs from and costs more than the input's, reverts values whose own cost
exceeds `OAt`, and reports exhausted budgets. The five noted handlers (`qss`, `Uss`, `Bss`, `Wss`,
`Gss`) use the `DAt`/`JAe` keys and the terminal seam's one-shot `s5t`/`Iye`; `fIn`, `Sur`, `bur`,
`wur` and `pno` keep the source wording. Three value helpers (`iD`, `eIt`, `Iws`) come from
chunk-nyce03br.js. Focused 10/10, full 2255/2255, tsc 0, build 0, notices 0, identity `46284acf…`.
[W142 record](ports/W142-engine-draw-budget-handlers.md).

W143 adds the engine's tree validation. `Eur` (chunk-n3ykh62m.js [262627,266967)) bounds node
count and depth, checks root/text/non-node/unknown-element/block-inline/surface rules, runs each
element's validator, the sibling key scope and `lur`'s hover/group/client rules, restricts Button
children and the dialog component (one engine node, no Markdown or layout props around it, at
most 12 measured rows), checks Link props through `sno` and props through `Pgo`/`sQt`/`Igo`, and
bounds Raster cells and Image bytes; Box key problems reach `note` without failing the tree, and
`measured` receives the row cost on success. `lur` ([239459,241244)), `Nto`/`EVe`, the
`$to`/`Fto`/`Drt`/`Wto`/`dur` helpers and eight nyce tables/constants come with it; the W141 copy
now exports `QPn`/`eIn`/`tIn`. Focused 12/12, full 2265/2265, tsc 0, notices 0, build 0,
identity `6960bd86…`.
[W143 record](ports/W143-engine-tree-validation.md).

W144 wires the engine's render pipeline. `gno` (chunk-n3ykh62m.js [283212,284410)) raises the
tool record, wraps the budgeted drawing as the `core` handler and dispatches the render argument
through the hooks chain with the `ui.render` site; a tracked, live request flushes its version
readers (at most 4000), the answer is copied (`ilt`) and validated (`Eur`), a refusal is recorded
and answered with the engine sentinel (`Ioe`), and a valid tree goes through the border/key
transforms, link validation and code-row measure before the descriptor and trace tables are
written. The final slice also ports the previously missing site: `ga`, `ilt`, the envelope check,
the component prop table and its ten validators, and the prop-cost helpers (30 nyce blocks,
4,796 units) beside the 16 n3 blocks (3,392 units). `ls`/`tIt` are reused so the dispatch store
stays single; the generated pipeline imports the site module first so registration precedes
`Ito`, and the typed seam installs `runEnginePipeline` as `RenderAnswerHost`. The end-to-end
probe draws `{type:'engine',ref:1}` with the original input as its descriptor. Focused 34/34,
full 2273/2273, tsc 0, build 0, notices 0, identity `e6ede94c…`.
[W144 record](ports/W144-gno-pipeline.md).

W145 starts C-2's AbovePrompt pane with its renderer-free core. Eleven blocks (1,473 units) port
the row-budget window, which reserves one row for the cue only when the tree overflows and floors
the body at the settled budget minus one; the autofocus index; the Input/Select key-context names;
the hotkey map, which takes a Button's hotkey and stops there, skipping engine subtrees; the cue
fully-laid-out check, which sums yoga tops up to but excluding the content root and rejects a node
with no height or outside the window; the content/plugin disjointness test; the six scroll
handlers; the pane key merge, which aliases pane scrolling to AbovePrompt next/previous only
outside inputs; and the 5-column handle and 150 ms settle constants. `NFe` itself (5,856 units, 82
unresolved names) stays for the next slice. Focused 14/14, full 2285/2285, tsc 0, build 0,
notices 0, identity `b8af8bb6…`. [W145 record](ports/W145-above-prompt-core.md).

W146 adds the AbovePrompt pane's content and chrome. Sixteen blocks (2,722 units) port the content
wrapper with its columns context and negative offset, the wheel-to-layout mapping, the held node's
top and bottom edges, the element-key bounds walk (root excluded, plugin strict), the raised scroll
wrapper, props merge and floor clamp, the toggle label, the absolute `[-]` collapse handle, the
hidden-panel header, the focus index, list rows against the select window, the `↑ n more · ↓ m more`
indicator and its Text, and digit selection. The source's module-namespace call
`Sc.releaseInkFocus` keeps its shape because the pressable-button seam now exports `_3n` under that
name; every body is otherwise verbatim. Focused 13/13, full 2296/2296, tsc 0, build 0, notices 0,
identity `6d39c0c6…`. [W146 record](ports/W146-above-prompt-parts.md).

W147 ports the prompt input's single-digit confirmation. Three blocks (1,625 units) carry the hint
map (`& é " ' ( - § è _ ç à` to 1–0) with its NFKC fallback, the Enter pre-dispatch path, which
proceeds only for a plain Return that resolves to `chat:submit` (or with no keybinding service),
past the mount window, after the input changed to one character that maps to a valid digit, and
the 400 ms debounce effect. The slice also carries the clock-now hook `Xa` (context function, else
`Date.now`) and the due-window helper `rc`. While testing, the hook seam's effect handling was
corrected: an effect called without a dependency array now runs after every render, as React
defines it, which the source's handler-ref effect needs. Focused 11/11, full 2305/2305, tsc 0,
build 0, notices 0, identity `307fee76…`. [W147 record](ports/W147-above-prompt-input.md).

W148 adds the AbovePrompt focus-seat layer. Five blocks (956 units) carry the NUL seat key, the
prompt key handlers (next and previous wrap by modulo, press dispatches a held Button through
pressFromTerminal or submits a held Input), the memoized seat index by plugin/handle, the
per-plugin registry whose unbind removes one seat, and the change watch that reports keys whose
value changed under the same plugin/element. The select keyboard itself (`C0`/`nK`) is deferred
because it needs the `ui.input` dispatcher. Focused 8/8, full 2311/2311, tsc 0, build 0, notices 0,
identity `8f0b66ab…`. [W148 record](ports/W148-above-prompt-seats.md).

W149 adds the AbovePrompt field/select state layer. Eight blocks (491 units) carry the three
per-site stores the select keyboard reads (field texts, picked values, site generations), the
`${plugin}\0${element}` site key, the generation read defaulting to zero, a copy-without-keys
helper, the forget helper that clears one site's texts and picked value while bumping its
generation, and the `ui.input` terminal dispatch. The select keyboard itself (`C0`/`nK`/`uK`/`lK`)
remains for the component slice. Focused 9/9, full 2318/2318, tsc 0, build 0, notices 0, identity
`61334785…`. [W149 record](ports/W149-above-prompt-select.md).

W150 adds the AbovePrompt select keyboard and field hooks. Sixteen blocks (5,032 units) carry
isTypedText and the control-character test, the per-site field store hook, the input-field hook
(ref-then-state text, change/submit dispatch, duplicate-submit guard and post-answer clear), the
field-key classifiers, the keys-ahead pre-dispatch handler, optionText and the select key handlers,
the select-field hook (highlight wrap, pick dispatch with answered-value apply, typed-ahead prefix
match, Ctrl+C close/clear), the terminal `ui.select` dispatch, focusableAt, and the controlled-state
hook. `NFe` itself remains. Focused 14/14, full 2330/2330, tsc 0, build 0, notices 0, identity
`40f60975…`. [W150 record](ports/W150-above-prompt-select-keys.md).

W151 measured the `NFe` AbovePrompt component closure without changing product code. The body is
5,856 UTF-16 units at `[456049,461905)` in `chunk-24k7d6mw.js`; its 82 direct references split into
44 exact seam-ledger hits across twelve existing seams, nine hook bindings, five hand-written host
seams (`kc`, `Ys`, `c9`, `Kje`, `$pn`), and 24 new bodies totalling 7,604 units in ten modules. A
flat probe grew from 42 blocks/15,668 units to 58 blocks/19,493 units and then failed to parse:
`chunk-z6yhgx3x.js [817,867)` declares `var l,d,P,j` while `chunk-76anb6yt.js [664,690)` declares
`function d` and the hook seam binds `P`, so multi-module bodies cannot share one top-level scope.
The port is therefore split into W152 (local state, 2,616u), W153 (focus/scroll, 3,096u), W154
(keybinding/registry, 1,094u), W155 (host glue, 798u), and W156 (`NFe` wiring, 5,856u).
[W151 record](ports/W151-above-prompt-component.md).

W152 landed the session/app-state context layer and the AbovePrompt local state across three
seams (21 blocks, 3,822 UTF-16 units). `plugin-chain-session-context` copies the z6yhgx3x session
providers and hooks plus the 4bw62nzm missing-project error (4 blocks, 1,880u);
`plugin-chain-app-state` copies the 7n39kxwj context tokens and selector hook (2 blocks, 225u);
`plugin-chain-above-prompt-local` copies the draft store registry, long-input marker, viewed-agent
selectors, settled-budget store, press-table lookup/pre-dispatch and the two release effects
(15 blocks, 1,717u). The session draft store is weak-keyed by the session root and seeded with the
source draft state; `useLongerInputValue` returns the marker past one character; `Att` normalizes
both agent task kinds. Focused 24/24, full 2354/2354, tsc 0, build 0, notices 0, identity
`97360dc7…`. The `_Fe`/`RFe` measure/render closure exceeds one package (wheel acceleration, the
`hs` settings schema at 5,548 units, and the `xwt` scroll dispatch) and moves to W157.
[W152 record](ports/W152-above-prompt-local.md).

W153 landed the AbovePrompt focus/scroll seam (10 blocks, 3,840 UTF-16 units) in
`plugin-chain-above-prompt-focus`. `A9r` clamps the scroll top against the viewport bottom; `Xq`
names the `above-prompt` request; `iZo` registers the focus ring site, queues acts behind an
in-flight request up to 64, aborts on forget/unmount and auto-focuses a held-empty seat; `Lqt` and
`fse` raise `ui.focus` through the pre-hook, the record handler table and the host; `sZo` wraps
non-kept handlers so they call `act(value)`; `ZD` registers the keybinding context while mounted;
`PYe` flattens the element tree into Button/Input/Select seats and stops at a Select. The host
registry `focusSites`/`focusSiteDraws` is reused, not recopied. Focused 8/8, full 2362/2362,
tsc 0, build 0, notices 0, identity `774e46e1…`. Next is W154 (keybinding/registry).
[W153 record](ports/W153-above-prompt-focus.md).

W154 landed the AbovePrompt keybinding/registry seam (6 blocks, 1,177 UTF-16 units) in
`plugin-chain-above-prompt-keybinding`. `Ze` keeps the latest handler in a ref and registers one
action keyed by action, context and service; `nn` registers a handler table under a sorted key
signature and removes every registration on unmount; `hro` answers the pane after the focused one;
`gpr` accepts a pending focus request through `c9` or clears it; `HG` debounces on the clock
context's timer, with `cancel` and unmount cleanup (its `Rt(p,T4n)` is the source's unsubscribe
cleanup trick, not a store read). The product already carries the same `Lc`, `Ri`/`c9`, `eE` clock
context and themed Box `s`, so those are reused rather than duplicated. Focused 7/7, full
2369/2369, tsc 0, build 0, notices 0, identity `96434b80…`. Next is W155 (host glue).
[W154 record](ports/W154-keybinding-registry.md).

W155 landed the AbovePrompt host-glue seam (3 blocks, 798 UTF-16 units). `QY` and `Mmt` are the
host context tokens for the pane measurement getter and the owed-rows callback; `sa` registers an
active overlay in app state and removes it on unmount, with the source's frame invalidation running
on cleanup; `us` answers the keybinding display text and reports a missing or unknown binding once
and answers the fallback. Two host bindings are recorded as rewrites: `F` reaches the renderer's
invalidate in the source through the host instance map, which this product populates with selection
readers, so it is bound through `bindPrevFrameInvalidator` (unbound is the source's absent-instance
no-op); `vot`'s analytics normalization chain is outside the local-only scope, so the same event is
recorded through the host feature recorder with its raw fields. Focused 5/5, full 2374/2374, tsc 0,
build 0, notices 0, identity `d83b46fd…`. Next is W157 (wheel acceleration / settings schema /
scroll dispatch), then W156 (`NFe` wiring).
[W155 record](ports/W155-host-glue.md).

W157a landed the pure wheel acceleration curve (7 blocks, 2,245 UTF-16 units): the JediTerm wheel
state `tgt`, the arrow-boost take-and-clear `VNo`, the 200 ms bypass window, the window/flood and
decay constants, the step body `pbt` and the state factory `fbt`. The curve grows the multiplier by
0.3 per event in window mode and by the decay formula otherwise, resets through a direction flip,
multiplies flood steps by the base and the flood factor, and accumulates the 0.35 fraction with a
0.008 multiplier gain on the JediTerm trackpad branch. The platform probe `uq`, the `jbBugConfirmed`
environment check `mLr`, the settings read `hs`, the wrapper `gbt`/`AZ`/`_Fe`, the scroll dispatch
`xwt` and the render host `RFe` remain in later W157 steps. Focused 7/7, full 2381/2381, tsc 0,
build 0, notices 0, identity `ab3d43d6…`.
[W157a record](ports/W157a-wheel-acceleration.md).

W157b landed the terminal environment probe the wheel path reads before stepping (3 blocks, 1,711
UTF-16 units): the per-host answer cache and its invalidator, the Cursor / VS Code-version-window /
xterm.js flood tests, the JetBrains terminal name table, the base selection with the
`CLAUDE_CODE_SCROLL_SPEED` override, and the terminal version readers. Measured branch behaviour:
an xterm.js DA reply is itself a flood, so it keeps the window curve; `TERM_PROGRAM=vscode` selects
the decay curve outside the flood window; JediTerm takes base 2. The cache guard compares only
xtversion, wheelFlood, jediTerm, wtSession and xtermJs, so a speed change needs the invalidator,
and `AZ`'s identity comparison relies on the cache answering the same object. `q` is reused from
the local-store copy, `Nx` from the text-style copy, `a` from the host environment; `B`/`Su`/`DT`
are host bindings, and the `DT` capability/image-file getters stay with the capability-defaults
subsystem. Focused 11/11, full 2392/2392, tsc 0, build 0, notices 0, identity `8ae9bc13…`. Next are
the settings read `hs`, `gbt`/`AZ`/`_Fe`/`mLr`, the scroll dispatch `xwt` and the render host `RFe`.
[W157b record](ports/W157b-terminal-environment.md).

W157c landed the settings read and the wheel glue around the probe (7 blocks, 1,777 UTF-16 units):
the source-ordered settings read with the legacy fallback and its warning text, the JetBrains
environment check that latches on the wheel state, the acceleration announcement with its
`accelDisabled` marker, the state hook that rebuilds when the probe object changes, the internal
JediTerm input reader, and the wheel event dispatch with its handler factory. Two name collisions
were checked rather than assumed: this package's `CFe` is the wheel dispatch closure, not the
hook-origin record in `plugin-chain-source`, and its `w_` is the project/user settings file
identity test, not the home realpath. The source order, the legacy store and its schema parse, and
the internal stdin context are host-bound; the last carries only `internal_jediTermInput`. Focused
12/12, full 2404/2404, tsc 0, build 0, notices 0, identity `e204a1c7…`. Next are the scroll
dispatch `xwt` and the render host `RFe` (including the settings schema `gf`), then W156.
[W157c record](ports/W157c-wheel-glue.md).

W157d landed the pane scroll host and the `ui.scroll` dispatch (2 blocks, 2,402 UTF-16 units): `RFe`
holds one pane's offset and follow-end flag, clamps every commit and `scrollBy` to the max offset,
queues a move that arrives while a dispatch is in flight, files its site under `component:requestId`
with a key-row walk over the pane content, and raises each person move through `xwt`; `xwt` runs the
classic pre-gate, the `ui.scroll` handlers and then the site's own commit (`PY`), logging the move or
its refusal. The wheel, key-row, props-merge and scroll-key companions are the exact W145/W146 copies
of the same module ranges, imported rather than copied again. Focused 11/11, full 2415/2415, tsc 0,
build 0, notices 0, identity `f8884490…`. Next is the settings schema `gf`, then the W156 `NFe`
wiring.
[W157d record](ports/W157d-pane-scroll.md).
