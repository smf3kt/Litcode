# W376 — Hooks family acceptance

Status: scoped acceptance package, no product change. Full-suite identity `3f1d784de2b9d3a9cc7138049ffd4e96bf87055251ab77a1c8089a000e23b138`; final driver identity `6a6a89d1004a724f2d7daa59ecc9628a83bbd819561455b24281f74081a74c07`. Base: 69d8cf5 (W375).

## Predicate

The existing local async adoption, deadline, terminal sequence, and bounded display paths pass their focused suites and compiled CLI checks. This predicate does not cover the entire Hooks family.

## Source position

- Source sample 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`; `chunk-sfn1dbxq.js` SHA-256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`. All source ranges are zero-based, half-open UTF-16 code units; body16 is the first 16 hex digits of the SHA-256 of the UTF-8 encoded slice.
- Async adoption: `Ur`/`UF` [2969279,2980094), `m5e` [2955889,2958184), `gbt` [622557,622798), `Sbt` [626520,627570); see [W185](W185-async-adoption.md). A first-line `{"async":true}` header hands the same foreground process to `AsyncHookRegistry.adopt` (src/async-hooks.ts:203); `gbt` skips the header so a later sync payload is interpreted. `start` (:137) owns configured-async jobs without a second adoption; `wait`, `stop` and `close` are at :256, :261 and :268.
- Deadlines: W307. Notification order and the idle prompt: W308.
- Terminal sequences: `Agent.emitHook` appends the `hook_result` record and forwards `terminalSequences` (src/agent.ts:354-360); the TUI writes them through its terminal-sequence sink (test/hook-terminal.test.ts).
- Display: src/agent.ts:361-385 cleans control bytes and applies a shared `maxOutputBytes` budget. Source `avt` [2932807,2933599), body16 `5b9ec10b07286d81`, builds PostCompact's labeled message from the record output. The shared hook runner independently applies a terminal sequence. Host src/hooks.ts:1749-1767 retains the raw record for display rather than applying structured `suppressOutput`.
- Event display: TeammateIdle is raised on the idle-notification turn (src/interactive.ts:2154-2156). In addition to OS notification delivery at :1066-1072, Notification has a permission-prompt call site at :1280. The driver run exercises TeammateIdle and does not establish Notification delivery.

## Product change

None. The package corrects the test owner and adds one regression group:

- `scripts/smoke-hook-terminal-cli.mjs`: completion gates read the current parent journal rather than transient TUI status text. Ordinary and post-compact turns wait for `end_turn` following the exact user prompt; the compact stage waits for `manual_compact`, and child routes bind their own prompt and completion. A background skill is a local command: `interactive.ts:3867-3877` writes the descriptor returned by `skill-runtime.ts:296-304` and `agent-registry.ts:652-653`, without a parent model turn. The driver renders the PTY stream with the existing `TerminalScreen`, reads the returned descriptor ID from the screen, and matches it to the completed child journal. Event mode waits for the TeammateIdle `hook_result` and checks the human turn separately. Journal polling uses complete newline-terminated records, strictly parses completed lines, and also runs when no TTY bytes arrive. A 160-column PTY verifies visible and hidden TeammateIdle output; PostCompact verifies its status label, terminal sequence and journal record. The driver does not claim to exercise Notification in that flow.
- `test/agent-lifecycle.test.ts`: one new group asserts the status-sink budget. Notification system/context lines stay within 96 bytes with `[truncated]`, no ESC and no replacement character. PostCompact reads a short-named fixture file, so the exact displayed raw-output prefix is distinguishable from the hook's command label.

## Validation

- Nine hooks suites 138/138: hooks, async-hooks, hook-groups, hook-once-runtime, hook-terminal, hook-transports, hooks-event-metadata, hooks-panel, plugin-hooks-module. agent-lifecycle 61/61 including the new group; terminal-notifications and idle-notification 10/10, including Notification-before-local-channel.
- The compiled driver exits 0 through a real expect PTY and an owned loopback SSE fixture: default 3 model calls, event-display 18, post-compact 12, children 13; tmux and screen byte-encoding modes also pass. These modes set mux environment markers; they do not launch a real multiplexer. The source-mode equivalents passed before the final driver-only display and completion-gate changes. After the background descriptor gate, compiled children passed at `cbe7f1ad`. After the partial-journal repair, compiled children, event and PostCompact passed at `6a6a89d1` with 13, 18 and 12 calls respectively. A focused probe checks empty and unfinished first records, a complete record followed by an unfinished one, and rejection of a malformed complete line.
- Check and build pass. The initial full run had one failure in `test/mcp-notification-stream.test.ts:313` (1 versus 2 replies); its isolated rerun passed 6/6, and a second full run passed 3458/3458 across 118 suites. The later review repair changed one test and the driver; a third full run passed 3458/3458 across 118 suites after those changes. The candidate identity `3f1d784de2b9d3a9cc7138049ffd4e96bf87055251ab77a1c8089a000e23b138` contains 941 input, 360 validation and 662 build records. Final identity `6a6a89d1004a724f2d7daa59ecc9628a83bbd819561455b24281f74081a74c07` has the same record counts, validation hash `dbd0ebbad8d2017df56d7c0f9cf2db44fd64f8abc28cbd8faf0925d26581f7af` and build hash `30f4989c72ade5adfd4b7a44d14ea956f2b58e73c07dac1db1bb68a1a21cb637`; its input hash is `e2aab2ac9c75b56d378e5bdc4c2577fac0fb09b6909ae3fc9fdd738ad1bdf10e` after the driver-only changes. Comparing all records against `cbe7f1ad` identifies one changed input, `scripts/smoke-hook-terminal-cli.mjs`, and no changed validation or build records.

## Review repair

The first independent reader disconnected before returning a verdict. Its retained trace identified three verification defects: manual compaction's own `turn_end` could satisfy the next-turn gate, normal completion was not distinguished from other reasons, and the PostCompact raw-output assertion could match the command label. A captured journal showed `compact` at index 4, `manual_compact` at 7, the next prompt at 8 and its `end_turn` at 10. The gates bind the relevant parent or child prompt and `end_turn`; the display fixture reads its payload from a file whose name does not contain it. A fresh independent review returned `VERIFIED_SCOPED` at `3f1d784d`, using 16 calls; it verified these repairs and identified a possible false pass because the background skill's parent command was not independently bound. The driver binds the displayed descriptor's ID to the child journal, and its compiled children run passes. A second independent review returned `VERIFIED_SCOPED` for that binding at `cbe7f1ad`, while confirming a separate race: an unfinished first JSON line with no newline was sliced at -1 and could be parsed prematurely. The driver now defers that record until its first newline; a four-case focused probe and the three relevant compiled routes pass at `6a6a89d1`. A 19-call follow-up by the same independent reader returned `VERIFIED_SCOPED` for that repair at `6a6a89d1`, independently checking empty, partial, complete, malformed and multi-record cases against `Session`'s newline boundary. Its probe did not change files or rerun the compiled driver.

The reviews also retained these limits: the logs themselves do not embed the content identity or check exit status; identity binding uses the captured execution and record. The background descriptor gate checks the matching ID prefix, not all fields or complete JSON, and does not independently establish non-blocking return or isolate parent versus child model-call counts. TeammateIdle's human turn is asserted after exit; a non-`end_turn` first completion times out; the sink test does not assert the whole cleaned tail. PostCompact's PTY status label alone is weak, so record semantics come from journal assertions. The reviews did not establish Notification delivery or whole-family closure. The second reader used 81 calls against the bounded brief; it did not rerun the full suite or the compiled driver.

## Dispositions

- The Hooks family remains Partial. W45-6/7's discovery, adoption and awaited plugin-install paths are present in `src/config.ts:1324-1330`, `src/plugins.ts:690-699` and `src/plugin-chain-registry.ts:104-146`. W45-70 copied `G2e` and exposes `dispatchCall` in `src/plugin-chain-call-dispatch.ts:143-147`; a search of `src/` found no caller of that exported seam. `src/plugin-chain-module-host.ts:30-45,117-208` supplies an in-process module format and leaves worker bookkeeping, table resolution and build as bounded adaptations. The remaining plugin-to-host and VM/worker paths require their own source and runtime reconciliation.
- The TUI status row is transient and width-bounded. The compiled PTY checks a visible system message, suppression and the PostCompact label; the new status-sink test verifies byte budgeting separately. This terminal run does not establish Notification delivery or every displayed message; the separate 10/10 notification tests cover Notification-before-channel.
- The async registry's historical ownership and one-settlement behavior are documented by [W185](W185-async-adoption.md); this package makes no broader replay-equivalence claim.

## Workflow checks

S-1: the original PTY failure and full-suite MCP failure are recorded above. S-2/S-3/S-6: narrowed terminal assertions name the status-sink coverage and remaining Notification gap; they do not stand in for full-line PTY output. S-4: each driver checks released session locks; hook registry cancellation and teardown remain covered by `test/async-hooks.test.ts`. S-5: checks use complete journal records, exact prompts, normal completion and explicit terminal bytes; the polling interval is cleared with the child timer. S-7: no product behavior changed, and W185/W307/W308 and the source `avt` body supply the mappings used here. The incident is recorded in `research/question.md`, an existing ignored local log.

## Reproduction

```sh
node --import tsx --test test/hooks.test.ts test/async-hooks.test.ts test/hook-groups.test.ts \
  test/hook-once-runtime.test.ts test/hook-terminal.test.ts test/hook-transports.test.ts \
  test/hooks-event-metadata.test.ts test/hooks-panel.test.ts test/plugin-hooks-module.test.ts
node --import tsx --test test/agent-lifecycle.test.ts
node --import tsx --test test/terminal-notifications.test.ts test/idle-notification.test.ts
node scripts/smoke-hook-terminal-cli.mjs --compiled
node scripts/smoke-hook-terminal-cli.mjs --compiled --event-display
node scripts/smoke-hook-terminal-cli.mjs --compiled --post-compact
node scripts/smoke-hook-terminal-cli.mjs --compiled --children
node scripts/smoke-hook-terminal-cli.mjs --compiled --tmux
node scripts/smoke-hook-terminal-cli.mjs --compiled --screen
```
