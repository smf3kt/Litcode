# W339 MCP template argument completion

Status: verified locally with independent source/correctness/comment review. Final identity3520d4dc. Work in place on afd3b93. Local commit only, no coauthor or push.

Task card:
- Outcome: typing an explicit @server:resource URI offers server-completed argument values. Accepting a partial continues to the next argument; accepting the last value closes quotes and adds a space without submitting.
- Model: parsed template parts and one active argument with resolved arguments/valueStartIndex. One terminal-owned pending/ready completion carries the draft/caret identity.
- Source: ose/Lre/bEt/o0e/n0e/e0e/ese and ys/Cr/Xn in chunk-24k7d6mw.js, plus completeResourceTemplate in both local client generations.
- Targets: tui-mcp-suggestions, existing @ replacement helper, MCP transports/connection, Runtime/CLI/interactive/TerminalSurface and TuiTerminal.
- Method: copy parser/selection/replacement logic, adapt RPC to existing managed transport and async source state to one terminal owner. Preserve static list and catalog opt-in.
- Validation: three behavior groups, compiled actual PTY against owned stdio/loopback MCP, check/build, independent review, identity and records.

Artifact 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All source ranges are zero-based half-open UTF-16 code units. Module digests match extracted-v2/manifest.json. Recovered application code is inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | Nre [491566,491632), e0e [491632,491873), Lre [491873,492286), bEt [492286,492853), o0e [492853,493153), n0e [493153,493497), ose [564216,565691), ese [565691,565770), ys declarator [572764,573328), Cr [573571,573583), yr [573957,580545), Xn callback [580879,585225) |
| chunk-ax7r0qj7.js | 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e | Qe [3224,3289) |
| chunk-dj5t4hnw.js | c91fc98a7db753c155d910e88183390dd17cf52a1acb6be4e646b07e067744a1 | f [4838,5343), generation-selected local client loader |
| chunk-4vr415ka.js | 01c2a556237e9a957f29cd7de89b228439e6621ea982a0b5b0bd10be4cd20580 | Nt [88505,89907), Zd [116547,116997) |
| chunk-sb190ksj.js | 0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df | no [119034,120436), nh [149573,150023) |

Lre splits literal/variable parts, strips one RFC6570 operator and explode/prefix modifier, and uses only the first comma-separated variable. bEt consumes literals and resolved arguments to locate the current value. o0e chooses by resolved count, value start and number of placeholders in that order. n0e substitutes the candidate plus the following literal. e0e retains partial only when the next literal leads to another variable. ose filters app-only templates, keeps null for static fallback, resolves the connected client and maps at most15 values. ese opens a quote for partial values and closes it for final values. Zd/nh gate on completions capability, send ref/resource+argument and nonempty context.arguments, and return[] on failure.

ys awaits ose and discards responses for another partial. Cr debounces ys by50ms. Xn cancels queued work before acceptance, writes replacement metadata and resuggests only for partial values. The host has synchronous render, so it will adapt this to one async completion owner. Abort/identity retirement on edit/caret change, catalog rebind and close prevents stale publication and releases existing RPC resources. No new model tool or persistent server is added.

Grounding: a bounded independent how reader traced the existing McpClient.catalogRequest, capability stores, managed generation and catalog handoff. It identified both transport implementations and the stable ManagedMcpClient as the request owner. Existing request cancellation/close is reused. No account or subscription function is involved.

Design comparison: candidate A scatters timer/controller/query/results fields through TuiTerminal. Candidate B keeps a pending/ready discriminated state and source parser/row logic in tui-mcp-suggestions, with one update/reset callback to the terminal. Candidate B concentrates identity/debounce/cleanup while preserving synchronous row reads. It is selected under Model the Domain. The existing managed transport retains connection ownership. Project direct/in-place rules override skill code delegates, worktrees and broad design fanout. No checkpoint is required under existing local authorization.

Throughput checkpoint:
- Blocking first steps: verify sources and capture the compiled missing-completion baseline before product edits.
- Independent workstreams: main owns the coupled parser/RPC/terminal chain. One bounded read-only reviewer follows completed validation.
- Shared mutable state: one terminal completion owns its timer/controller/result; managed MCP owns the transport generation and close.
- Smallest decomposition: one completion model over existing catalog/RPC interfaces, no generic async autocomplete framework or transport service.

## Implementation and evidence

The parser, match/rank and replacement bodies are adapted into tui-mcp-suggestions. n0e/e0e share one part scan. The old static list remains available for a host without completion capability, and the async path keeps ose's null-versus-empty result contract. ShapeTemplateReplacement now takes the source partial boolean directly. All internal static callers already pass true; the old direct quote test had inverted semantics and is corrected while the new group verifies partial and final quotes through actual row acceptance.

McpConnection exposes a catalog-only completeResourceTemplate callback. Existing McpClient catalog routing and capability predicates gain completions. Both transports reuse existing request deadlines and abort/close ownership. The adapter sends ref/resource, argument and context.arguments only when nonempty. A zod boundary parses values as string[] and failed/malformed results return[] as Zd/nh do. ManagedMcpClient remains the stable current-transport owner; no new request replay or tool schema appears.

The source's cached-client dial circuit and telemetry stay with its own runtime. This host reuses ManagedMcpClient recovery and omits source telemetry; it does not create another dial cache. The adapter requires a retained client that advertised completions. A disabled or never-connected server contributes no values. Server enable/reconnect and catalog rebind retain their existing owners. Completion result parsing uses the host's existing zod dependency because the source SDK validates its complete result before returning values.

The callback passes through Runtime, CLI and all existing bindMcpCatalog consumers. TemplateCompletion holds one discriminated pending/ready state,50ms timer,controller and exact draft/caret key. Edits,caret moves,modal/search/transcript handoff,catalog rebind and close reset it. Identity and aborted-signal checks discard late values. Existing acceptAutocomplete already handles replacement metadata and keeps suffix text. No template catalog notification refresh is added.

The existing W202 app-only filter,description clipping,template-head helper and atQuery/applyFileSuggestion remain shared dependencies. Their original records remain in [W202](W202-mcp-resource-completion.md) and [W200](W200-file-completion.md); no duplicate parser or token splice is added.

Source helper `$CLAUDE_JOB_DIR/tmp/w339-source.mjs` verifies five module digests and eighteen exact function/declarator ranges. Eight exact character diffs were read in full for Lre,bEt,o0e,n0e,e0e,ose,ese and Zd. Changes are TypeScript/host names, merged sequential scans, factored server filtering/static rows, existing managed RPC and one terminal request owner. Two executable comparisons prove ese after mechanical names and both source client generations after local renaming. Source raw data is never imported or executed.

## Current validation

- Pre-edit compiled baseline at afd3b93 fails at server argument completion appears. The decoded screen shows only static template heads and no completion RPC.
- Three new behavior groups pass. They cover template syntax/ranking/caps/quoted sequential values, real HTTP MCP wire shape/capabilities/malformed/abort/disable/re-enable/reconnect/close, and native composer stale responses/suffix splice/partial/final acceptance/rebind/modal/close.
- Affected246/246 pass across completion,static @ rows,autocomplete,catalog,management,HTTP,stdio,interactive and TUI. The additional shared Runtime/resources/MCP-persistence and CLI/migration suites pass75/75. Final check/build pass. Final compiled driver9checks passes with0model requests using an owned stdio MCP and loopback failure-only model endpoint. The CLI accepts both URI arguments,forwards prior context,closes a final spaced value,submits nothing and releases its session locks and MCP process.
- One driver fixture used overlapping templates and expected the more literal template to win. Source o0e ranks resolved-argument count first, so it correctly selected the broad template. A distinct URI scheme makes the quote probe unambiguous; product ranking stays unchanged.
- Commands use `node --import tsx --test --test-concurrency=2` with the named files above, `npm run check`, `npm run build` and `node scripts/smoke-mcp-template-cli.mjs`. All final commands exit0. Logs are w339-affected.txt,w339-runtime-cli-tests.txt,w339-check.txt,w339-build-final.txt and w339-cli-final.txt under the job temporary directory. Full-suite and live upstream validation are not run for this unit.
- Candidate content identity is `c04b094d590c504f541a69697ef4dc8a0d13aaffb0be6362227f55c94fce7758`,880 input,341 validation and623 build files. The independent reviewer matched all1844records before and after its source/correctness/comment pass. It reran3/3 and actual compiled9checks/0model requests. Exactly two additional compiled probes verify spaced partial/final acceptance stays settled after debounce and same-draft/caret catalog replacement aborts/discards the retired result. No confirmed scoped correctness defect. Cleanup reports0live owned processes,0locks and0probe directories. Logs are w339-independent-tests.txt,w339-independent-cli.txt,w339-independent-probes.txt and w339-independent-cleanup.txt.
- The comment audit found one catalog comment attached to the new completion field instead of its original catalog flag. Move it back,run check/build and compare source/compiled executable syntax with comments removed. Both are identical. Final content identity is `3520d4dcf36bca7c016136530180b499069e96813853bf128ce244f404b702ec`,with880input,341validation and623build files. Only src/tui.ts and dist/tui.js differ from the independently reviewed candidate,and both differences are comment placement. Zero suppressions or redundant comment deletions. Protected user hashes stay unchanged.
- apply_patch remains absent, so dedicated Write/Edit are the recorded fallback. Temporary source/runs are under `$CLAUDE_JOB_DIR/tmp/w339-*`.

## Rule comparison

S-1/S-7 bind source parser/RPC/input owners before code and retain exact character diffs. S-2 preserves static fallback,tool schemas and RMr-unrelated terminal behavior; the old quote helper test retains both partial/final cases under corrected source semantics. S-3 checks actual decoded draft and exact URI metadata. S-4 one terminal owns timer/controller and managed MCP owns transport cleanup. S-5 distinguishes missing completion RPC at baseline from actual accepted values and0model calls. S-6 connects both transports,shared interface,Runtime,CLI,all rebinding callers and UI consumers. Model the Domain selects one typed request state; Prove It Works requires the actual compiled PTY chain. The local commit subject is `Complete MCP resource template arguments in the composer`. Exact-path staging excludes the local-only research/question.md and unrelated user changes. No coauthor or push.
