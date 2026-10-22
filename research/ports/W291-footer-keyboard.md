# W291 footer keyboard

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: Down past current composer history, then Footer navigation and open.
- Outcome: task label focus, inverse and view hint, live Background open, cancel and edit recovery.
- Source: bS/lue.Yo -> Wv/JA -> rh/pf/Wp/mg/mh -> kL -> A4.openBashesDialog.
- Targets: adapted navigation bodies, TuiTerminal focus owner, existing FooterPart selected flag.
- Shape: one null/tasks/ideSelection focus value, sharing the existing diff attachment owner.
- Mode: adapt navigation bodies and local selectors; reuse copied Vde for selected paint.
- Existing differences: local task list has no coordinator rows; diff attachment remains the W180 host adapter.
- CLI: Down/Enter and Down/Down during a held turn, cancel, edit, natural exit, remap and cleanup.
- Done: source comparisons, check/build, affected checks, compiled CLI, independent review and local commit.

## Source preflight

Sample 2.1.296 SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
All ranges are zero-based UTF-16 code units, half-open. Original entrypoints remain inert.
Main module chunk-24k7d6mw.js SHA-256
1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 matches manifest.

| Symbol | Range | Behavior |
| --- | --- | --- |
| lue | [791954,796268) | Yo returns true only when history is already current and no load was cancelled |
| bS | [834853,835119) | Multiple suggestions and a caret before the last newline block Down past end; queued selection precedes history |
| JA/Wv | [871891,871990) | Select the first available footer item; absent item is inert |
| roster and validity | [868887,870733) | Ordered task/frame/bagel/selection/bridge/workflow list; stale selections clear |
| rh | [870856,871116) | Adjacent item, no wrap; upward escape can clear focus |
| pf | [889030,889143) | Up to preceding item or composer |
| Wp | [889143,889398) | Down advances, or opens task dialog when there is no later item |
| mg/mh | [889951,889998) | Left/right select adjacent items without wrapping |
| kL | [890122,890813) | Enter opens task dialog and clears task selection; no ideSelection Enter branch |
| Zq | [891095,891240) | Escape clears selection and existing queue/help ownership |
| pT | [816246,816348) | Clear footerSelection and idleTeammatesExpanded |
| cq edit callback | [830027,830557) | Draft changes invoke pT before committing text |
| cursor gate | [825973,825984) | ec=!co&&!Ct hides input cursor while footer is selected |
| LVe | [762242,771241) | pz selected inverse; unselected down/manage and selected Enter/view tasks hint |

The navigation bodies are adapted by removing coordinator and absent surface branches, then
using the local ordered items and selection setter directly. An exact closure copy would need
unused task previews and no-op store writers solely for unreachable branches. The product has
no coordinator footer or workflow preview rows. Frame, bridge and remote rows have no local
producer. The W180 diff attachment uses ideSelection as an explicit host mapping.
Its existing single-row layout takes priority while pending, so the available local list is
ideSelection in that state and tasks otherwise. No hidden second focus is created.

The existing history reducer uses increasing indexes rather than source lue's reverse counter.
Down at its current end maps Yo's true result, after ordinary wrapped-line motion and queue
handling. The source blocks multiple suggestions. A single remaining suggestion continues
through the same gate. Normal history traversal remains in the existing reducer.

The source edit callback pT clears focus when text changes. Adapt that at the shared replaceDraft
boundary and explicit lifecycle transitions. Opening through the keyboard clears focus; mouse
opening retains its W290 behavior. Task disappearance clears validity before later keys can
submit or stop stale work. Source NORMAL j/k/l/h navigation maps to Footer while selected.

Default Footer bindings are chunk-6ccen3s8.js SHA-256
4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d,
[5984,6216), verified against manifest by the independent source reader.
Up/Ctrl+P, Down/Ctrl+N, Right, Left, Enter, Escape and x use the existing Footer actions.
Chat Down remains history:next; it is not a newly invented footer shortcut. Global Ctrl+T
and AbovePrompt chords retain their separate owners. The source hint uses ma for openSelected.
The existing host Keymap resolves mounted contexts. Local keybindings.json overrides decode
into EditorAction values; this package preserves that existing contract at selected-footer
dispatch. Larger source-resolver differences are recorded by W44 and remain outside this package.

## Ownership and throughput

One terminal focus value replaces diffAttachmentFocused. Footer context precedes Chat only
while that value is live. Printable keys not handled by Footer edit the draft and clear focus.
The existing W290 live task opener owns the session signal without replacing the model turn.
Mouse, search, modal, session rebind and close retain their current owners.

The main writer owns product and fixtures. One independent read-only binding question is
complete; independent correctness and comment review follow implementation. The critical
path is source closure, focus adapter, actual CLI, then evidence and commit.

## Review repairs

Independent review reproduced two host boundary gaps. Explicit decoder overrides produce typed
EditorAction values, bypassing the raw-key Footer path. Map submit and arrows to the same
selected-footer actions before ordinary editor behavior, and retain the input-owner batch check
after that dispatch. Explicit custom action semantics remain the decoder's contract. A follow-up
review reproduced Ctrl+C being swallowed by an over-broad interrupt mapping. Source Global
[1964,2339) owns Ctrl+C/app:interrupt; Footer [5984,6216) owns only Escape/clearSelection.
Remove the interrupt mapping and let the existing running-turn reducer emit once. The regression
fails before this repair (0 events versus 1), then passes with default and explicit bindings.

The source input cursor gate also controls Vim's painted text cursor. wr in chunk-s7977spq.js
SHA-256 3b692848c071d5fda8034ab8cc3dbd346654fe37ac9f0e84a42b171b3ec50509,
[7424,11062), UTF-16, takes `M=t.showCursor&&!c?" ":""` and passes cursorChar into BFt.
The local layoutInput adapter must take showCursor alongside terminal focus so the selected
footer hides both the hardware cursor and NORMAL mode's inverse text cursor. Selection ranges
retain their own Vim owner.

The affected editor-gesture fixture set VISUAL after terminal mount, while W287 caches that
selection at mount. Its old run launched nvim and stalled. The owned child was terminated and
confirmed gone. Set and restore VISUAL around fixture creation, retaining every original timer
and handoff assertion. The final affected run uses the corrected fixture and exits without manual
intervention. A nonexistent optional .claude/CLAUDE.md lookup added no instructions or changes.

## Validation

| Command | Exit | Result |
| --- | --- | --- |
| `npm run check` | 0 | TypeScript clean |
| `npm run build` | 0 | Compiled CLI built |
| `node --import tsx --test test/tui.test.ts test/tasks-command.test.ts test/tasks-panel.test.ts test/effort-command.test.ts test/tui-model-picker.test.ts test/thinking-dialog.test.ts test/vim.test.ts test/input-gestures.test.ts test/input-return.test.ts test/keybindings.test.ts test/keybindings-command.test.ts` | 0 | 155/155 passed on the final tree |
| `node .audit/w291-footer-keyboard.mjs` | 0 | 32 isolated source-navigation cases, four copied text/AST spans, 33 compiled CLI checks |
| `node .audit/w285-effort-feedback.mjs` | 0 | 26/26 compiled effort checks |
| `node .audit/w286-stashed-footer.mjs` | 0 | 19/19 compiled stash checks |
| `git diff --check` | 0 | Patch whitespace clean |

Two new regression groups cover history and wrapped-line entry, suggestions, navigation,
no wrap, edit reset, task disappearance, raw keys, explicit defaults/custom F5/F6, one-shot
Ctrl+C, exact draft, Vim glyph/inverse visibility and same-batch handoff. The existing held-turn
case reopens via keyboard before exact MCP form acceptance. No existing assertion is weakened.

Initial review found the explicit-decoder and painted-cursor defects. Its repair review confirmed
both fixed (2/2 plus five cursor cases) and found the Ctrl+C regression. A fresh independent
review then passed the two keyboard groups, four ordinary/Vim x default/explicit interrupt cases,
and the held-turn/MCP case. It found no remaining confirmed scoped defect. Comment/suppression
review found no new action; the final source cursor comment was rechecked by that fresh reader.
A reviewer's unrelated terminal-focus batch was stopped after stalling and is not counted.

The compiled chain drives three actual CLI processes at 160, 80 and 120 columns. It verifies
hover/click, keyboard hints and inverse, Enter/Down opening, cancel, draft edits, natural completion,
Questions/MCP preemption, explicit bindings, both Vim cursor consumers and a held provider
request cancelled by Ctrl+C while the background shell survives. All CLI processes exit zero,
actual task PIDs exit, session/input-history locks release and journals omit the fixture credential.
The new chain made 31 owned loopback requests. Paid upstream calls were 0; live Magpie was not run.

All three final compiled runs share this content identity.

- all: `0d1b511bc37c490ffffac46f3979a0021ae3181229344ae1e8cbfbedf5bb225a`
- inputs: `738140a6f48f0a3bd85a7cf4612dc5738c9aa21a072570b2679345b65fe6eb75`
- tests: `30603e5cf3650cd6ea745263e05a351bdab1488a412a22c03b9e75ea1957c8fd`
- build: `60d4bfccf4bb5a2f873a1253b10da4be94baa301753524934b168a9c05f9af96`

Logs/results live under `$CLAUDE_JOB_DIR/tmp`: `w291-focused-release.log`,
`w291-check-release.log`, `w291-build-release.log`, `w291-cli-release.log`,
`w291-cli-release-result.json`, `w291-effort-release-result.json`,
`w291-stash-release-result.json`, and `w291-release-identity.json`.
Full suite was not rerun. Its baseline remains W283's 3201/3202, with the known CLI effort
expected-xhigh/actual-medium mismatch at test/cli-migration.test.ts:87.

## Coding-standard check and remaining work

S-1/S-7 source bodies, module digests and exact coordinates precede changes. S-2 retains exact
draft and request ownership assertions. S-3 keeps display focus/hints out of submitted data.
S-4 uses one selection value and resets it on edit, modal/search/view, task loss, rebind and close;
same-batch tails and process cleanup are verified. S-5 waits on selected cells and request state,
clearing the prior text-selection owner before keyboard checks. S-6 updates raw and typed key
entries, FooterPart paint, hardware/text cursors, held-turn driver and mount-time editor fixture.
Rework is recorded in question.md; these causes fit the existing seven rules.

The full TUI family remains Partial. Missing coordinator/workflow preview rows, frame/bridge/remote
producers and task detail/foregrounding remain outside this local package. W289's crowded
40-column task-label allocation limit remains. Account, subscription and OAuth surfaces are excluded.
