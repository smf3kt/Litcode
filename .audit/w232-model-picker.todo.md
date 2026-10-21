# W232 model picker

- [x] Read CURRENT and bound the source question to the model picker and its query/list dependencies.
- [x] Record the exact search, focus, effort-touch and accept bodies before product edits. Search is gated off; scope corrected.
- [x] Implement the local model picker through one modal owner.
- [x] Verify the compiled picker, request payloads and persistence. Check/build, 135/135 related, compiled picker 23/23, model 11/11, slider 18/18. Independent narrow-frame repair accepted.
- [x] Deliver the reviewed package as a local commit on work/w43-choice-preview.

## Throughput checkpoint

- Blocking first steps. Source hashes and input-state contracts are the implementation gate.
- Independent workstreams. One read-only source question covers Gse and GHe while the lead checks the current modal and recovered list owner.
- Shared mutable state. One writer owns src/tui.ts, src/terminal.ts, src/model-picker.ts and src/interactive.ts. The existing modal owns cancellation and composer restoration.
- Smallest safe decomposition. WORKFLOW.md section 6 requires the lead to implement one package directly with at most one bounded research agent. That project rule overrides the bundled Feature playbook's delegated writer, design fan-out and PR steps. No worktree, push or paid calls.

## Design grounding

Initial candidate, superseded after source closure: the current modal treats text as Other and tracks effort by final value equality. The apparent startInSearchMode flag suggested a search/list state owner. The bounded source reader proved Gse gates that flag with canEnter=false, so search is unreachable in this sample. W232 keeps search disabled and ports the reachable model-list and effort-touched state instead.

Two shapes considered locally under the project source-first rule. A generic choice extension would add list/focus/effort callbacks to every question consumer. A model-picker owner can keep its focus/viewport/implicit-or-adjusted effort state together and render inside the existing dialog. Choose the model-picker owner. It returns the existing selected/adjusted/key answer, with adjusted present only after an arrow action. Generic questions, the effort slider and line mode keep their paths.

The source contracts and concrete descriptor are recorded in research/ports/W232-model-picker.md. Product source entrypoints remain inert.
