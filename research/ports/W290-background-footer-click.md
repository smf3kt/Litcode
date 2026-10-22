# W290 background footer click

Status: verified locally on 2026-10-23.

## Task card

- Entry: click the visible local background task label while idle or during a turn.
- Outcome: open Background, stop a focused task with x, cancel back to the retained draft.
- Source: Vde/pz -> v1e.Ks -> A4.openBashesDialog -> fLt.onDone.
- Targets: copied Vde/hover source, footer renderer/pointer host, shared live task-panel opener.
- Shape: a clickable footer node and a modal-owned live snapshot reader, not a queued prompt.
- Mode: copy Vde and pointer helpers; adapt chrome state and store subscription to terminal owners.
- Existing differences: no task detail/foreground page; /tasks keeps its list/stop contract.
- CLI: click during held model request, focus/stop, natural completion, cancel, draft and teardown.
- Done: affected checks, check/build, compiled PTY, independent review, records and local commit.

## Source preflight

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
All ranges below are zero-based UTF-16 code units, half-open, in extracted-v2/modules.
The digests match manifest decodedSha256. Original application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | pz [740155,740694), Vde [740694,741175), LVe row [770079,771241), v1e.Ks [786385,786417), callback prop [787228,787248), A4 methods [1487552,1487705), fLt mount [900819,901650), cancel [697586,698126), task subscription [674472,675750), focus [677240,678145), x handler [682045,682255) |
| chunk-06azbynj.js | 5f6c500dbd8f70af3c65b52a0e67f4a88d62df3793237af821d9f62af7d28fbd | I1/mo [206301,206455), Ax [242075,244661), cq [249383,250176), ov [250654,251135), rv/lv/Hs/iv/qd [251135,252369), dispatchHover [347186,347597) |
| chunk-1r9zp6s1.js | 444d1adce233caec24f15e8203bd02c9ae6313df62af94ff0c81ea669458936e | Mi [2581,2622) |

The fullscreen expression Ks=hn?ee.openBashesDialog:void 0 passes the chrome method directly.
pz calls it with zero arguments. A4.openBashesDialog assigns h??true, #d skips unchanged state,
and closeBashesDialog assigns false. None checks isLoading or isExternalLoading. Repeated open
is idempotent. fLt's onDone receives closeBashesDialog. Escape in its list calls onDone with
Background dialog dismissed and display:skip. The source's app:toggleTodos is a separate owner,
so this package does not reinterpret that chord as the new click action.

Vde copies the background-colored label, selected||hover inverse state and Box onClick/enter/leave
wrapper. Its dependencies are the existing w memo cache, y state hook, b memo sentinel, s/n and
JSX e. The default LVe row puts that Box in its own flexShrink:0 item, beside dim separators and
truncated trailing hints. The current host Tde nests all parts inside Text; a direct probe of a
clickable Box inside it throws Box can't be nested inside Text. Restore the source row structure
for footer parts, retaining measured width and the existing feedback/stash column. Normal text
parts still use the same dim text and theme slots. No separate coordinate-derived click region.

Ax starts selection on left press and calls onClickAt only on release without a selection.
ov hit-tests cq against current cached layouts. rv computes the hovered ancestor set, sends
leave to previous nodes and enter to new nodes; Hs/iv/mo bind the blank-cell test to the actual
painted frame. Copy those helpers with cq and the existing render core bindings. The local host
routes footer-row mouse events through the existing native selection/click methods and that
hover helper. Mouse off/scroll-only, right click, drag, off-row release and resize cannot open.
Pointer capture clears on screen/dialog/size changes and close. A fresh tree owns hit geometry,
so a finished or clipped label has no stale independent hit box.

fLt reads V(tjt) and recomputes rows on task changes. It remembers focused id/index; a removed
focused task latches ls.current and consumes the next x before stopping the replacement row.
The x handler uses the current row and clears that latch on navigation. Port those conditions
for the local list, keeping the focused value where available and clamping the fallback index.
Only jobs/agents/crons already supplied by W259 are shown. Runtime notifications refresh the
modal snapshot without draining events. There is no polling timer for display.

## Host ownership and adaptations

The live opener uses the current session's BackgroundTaskSnapshot and stopTask. It reuses
readDialog under the session lifetime, not withTurn, so opening/closing a panel does not replace
or abort the active model turn. Bare /tasks and the existing local chord call the same opener;
piped /tasks remains the durable inspection command. No new key binding or task detail view.

The modal request retains its host snapshot callback outside structuredClone, like config/resume
callbacks. backgroundWorkChanged refreshes only a Background request, preserving id/index and
source stale-stop latch. Escape leaves its caller's draft and turn intact. A higher-priority
interaction can close the local task view before taking input. Session close cancels it and
releases the same live-dialog controller, input owner, subscription and pointer state.

Adaptations are explicit. The recovered chrome boolean becomes an idempotent local live-dialog
owner. Vde uses real native JSX and hit testing. The main dialog is still the W259 local list
instead of fLt's task-specific detail/foreground/action pages. Stop is the existing dispatch;
its bounded process-exit wait remains. No account, remote, OAuth or paid upstream call is added.

## Throughput checkpoint

- Blocking steps: open callback/state owner, row geometry, release semantics and live focus safety.
- Independent work: one bounded source question, then independent read-only review of the diff.
- Shared state: one writer; existing unrelated edits stay untouched.
- Smallest complete unit: native click/hover, live list/stop, cancel and cleanup in one package.

## Review repairs

Independent review confirmed two adapter gaps. MCP elicitation's early approval guard runs
before readDialog, so an open tasks panel returned cancel without showing the form. Release
the task view before that admission guard, retaining formActive and closed/aborted checks.
The existing hook source Zgn (chunk-nejdhvxk.js SHA-256
16f3e340a1a75277d62240cfe94b2cdcac4d76b3e77eaacb62907f78a6c93160,
[2004,2515), UTF-16) returns only a hook override; the modal priority is this host's adapter.
The source Gs callback [677240,678145) clears the lost-focus latch after navigation within the
same list. Apply that clear in both actual host navigation branches, including Tab/Shift+Tab
and Home/End, rather than only matching Up/Down before navigation.

## Validation

Pre-change decoded click on 1 shell produced no action and left the chat draft intact.
The final source verifier checks module identities, four copied text spans and their ASTs,
plus the fullscreen callback and idempotent chrome methods. It executes no recovered entrypoint.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` | 0 | TypeScript clean |
| `npm run build` | 0 | Compiled CLI and native peer identity built |
| `node --import tsx --test test/tui.test.ts test/tasks-command.test.ts test/tasks-panel.test.ts test/effort-command.test.ts test/tui-model-picker.test.ts test/thinking-dialog.test.ts test/mcp-form-ownership.test.ts test/interaction-runtime.test.ts` | 0 | 137 tests passed |
| `node .audit/w290-background-footer-click.mjs` | 0 | Source text and AST checks, 20 compiled PTY checks |
| `node .audit/w285-effort-feedback.mjs` | 0 | 26 compiled effort checks |
| `node .audit/w286-stashed-footer.mjs` | 0 | 19 compiled stash checks |
| Independent repair recheck | 0 | Both prior findings resolved, 7 focused checks passed |
| Independent comment review | complete | No actionable deletion or suppression finding |
| `git diff --check` | 0 | No whitespace errors |

Three new regression groups cover native hover/release and invalid clicks, live focus identity
and disappearance protection, and the held-turn panel owner with accepted MCP form takeover.
The compiled driver runs real background processes and a held loopback model stream. It verifies
press versus release, hover, drag, live stop, natural completion, Questions and MCP form priority,
retained drafts, 80-column reachability, zero CLI exits, exited worker PIDs and released locks.
The MCP form returns exactly `{"action":"accept","content":{"label":"chosen"}}`.
The new chain makes 21 owned loopback model requests. Paid upstream calls are zero.
Journals omit the fixture credential. The two prior compiled footer drivers use that same build.

Final content identity is shared by all three compiled runs.

- All `b41aa5b765510427d43d6162d19fc365a1d618d4663ab213b1c39c325556af82`.
- Inputs `da0f567ce5bad2beb705f5c780b34b48b56a13b940b622692fdcc6287a0af6b7`.
- Tests `dae26a2ab30e3401f79879d26204e68428f0131af59fd7485317b189e7fd96ac`.
- Build `25fe373c2d9428ba2d2b95a6f12beee2471bbeb4dad62672cdbdab40ba071a0b`.

Logs and decoded frames are in `$CLAUDE_JOB_DIR/tmp/w290-*`. The final new-chain result is
`w290-cli-final-result.json`, with fixture directory `w290-cli-1esxEb`.
Initial review found the two defects above; a fresh independent review verified both repairs
and found no additional scoped correctness defect. The comment review checked exact copied
source suppressions and required S-7 citations, with no edits or open actions.

## Coding-standard check and remaining work

S-1 and S-7 bind copied Vde, hover helpers, chrome state and Gs focus to exact verified ranges.
S-2 preserves draft, held request, stop and existing picker assertions. S-3 keeps display labels
out of provider and task payloads. S-4 gives the tasks dialog its own session lifetime, yields
input before MCP admission, and releases actual processes, dialogs, subscriptions and locks.
S-5 uses decoded terminal cells, accepted form results and real process state. S-6 shares the
current task request and resets protection in every host focus branch. Rework is in question.md;
the existing seven rules cover its causes.

Full suite was not rerun. W283's known `test/cli-migration.test.ts:87` effort expectation
mismatch remains the full-suite baseline. A crowded 40-column footer can still clip the task
label through the existing allocation. Task detail, foregrounding, footer keyboard selection,
remote and account surfaces remain outside this package. No push.
