# W182 independent review contract

Run only once implementation is stable. Read-only review, no product writes, no external services or recovered entrypoint execution. Inspect task-matched skills/catalog. Verify exact source bodies against manifest digests, then current W182 diff against HEAD 9caf843. This is an acceptance rubric, not a statement that scenarios have passed.

1. Focused input ownership. Ctrl+G/action opens editor only for focused Other row or focused preview notes with configured editor. Single and multi-choice paths preserve selected values. Root draft and paste state remain unchanged.
2. Source update semantics. Both pre-await and post-await wouldTakeAnswer gates hold. Null and unchanged result preserve original state. Changed Other invokes the live input update and persists correct question text; changed notes updates only notes. External editing never submits an answer by itself. Preserve one-trailing-newline source handling and existing input budgets.
3. Stale result boundaries. A result captured for dialog/question A never changes dialog/question B after cancel, question switch, replacement or terminal shutdown. Use full question identity, including duplicate header fixture. No accidental root editor apply callback.
4. AFK and input lifecycle. Countdown pauses during external handoff, input/raw/modes restore at the correct owner boundary, no same-batch keystroke leaks into the dialog after handoff starts.
5. Resource cleanup. Abort/close kills owned descendants, waits their stdio release, removes private temporary files, then restores TTY. Errors retain meaningful status and release session locks. Verify actual process and terminal behavior, not just flags.
6. Downstream output. Notes appear in annotations.notes with exact preview; Other changes participate in final answers and Chat about this live clarification. Compiled PTY uses owned editor fixture and provider messages, not source-only component projections.
7. Scope and evidence. At most three essential regression groups, check/build and affected tests plus actual compiled driver. Exact source/adaptation record and final content identity. All remaining C-area work remains open unless separately verified or source-backed disposition exists.

Return concrete findings with reproducible input/state, observed wrong result, location and source branch. If none survive, state coverage and limitations. Fixes require fresh original-scenario verification before commit.
