# W138 — SessionEnd failed-record display

C-6's SessionEnd display path. The product displayed the event's `additionalContext` and only
reported hook failures as generic diagnostics. The recovered collector ignores the answer and
writes one stderr line per failed record whose output is non-empty. The product now produces
those same lines.

## Source position

- `chunk-sfn1dbxq.js` offset 2943770: `uvt` builds
  `{...common, hook_event_name: 'SessionEnd', reason}` and runs the shutdown steps through
  `F_r`, whose `end` callback awaits `b0` and collects the records. It then iterates the
  records and, when `!record.succeeded && record.output && !Te()`, writes
  ``SessionEnd hook [${record.command}] failed: ${record.output}\n`` to stderr. The hook
  registry is cleared afterwards; no field of the answer is otherwise consumed.
- Offset 2944201 is that write. `Te()` is `fj()` (chunk-4bw62nzm.js [108175,108201)), the
  diskless-session probe; this runtime's loader-surface port returns false, so the write
  always applies here.
- `chunk-sfn1dbxq.js` [3052300,3055000): the record builder. `command` is the display label
  (`Wn = Mx(Et)`), `succeeded` is `status === 0` only, and `output` is the block reason when
  the stdout object says `decision:"block"`, stdout on status 0, and stderr on any other
  status. An aborted or timed-out run records `succeeded:false, output:"Hook cancelled"`; a
  spawn/HTTP failure records the error message; a script that did not run records
  `script hook did not run (...)`.

## Port

- `src/hooks.ts`:
  - `fail` takes an optional display override: the generic diagnostic still enters
    `additionalContext`, while `failures` carries the source line (or nothing when the record's
    output is empty).
  - `sessionEndFailure` formats `SessionEnd hook [<label>] failed: <output>` through the
    existing `hookDisplayLabel` (`Mx`) for SessionEnd, and answers `undefined` for every other
    event so their failure text is unchanged.
  - Timeout and abort map to `Hook cancelled`; spawn failure to the launch error; status 2 to
    the stdout decision-block reason when present and stderr otherwise; any other nonzero
    status to stderr. A silent failure produces no line, which is the source's own condition.
- `src/agent.ts`: SessionEnd failures are displayed after the shutdown runner through the
  existing cleaned, UTF-8-bounded status path, without the `hook <event>:` prefix, and outside
  the `suppressOutput` gate (the source writes them unconditionally). SessionEnd leaves the
  `additionalContext` display list: the source displays no successful record output.

## Adaptations

- The source writes to stderr directly; this runtime routes the same text through its status
  channel so headless and interactive consumers keep one display path. Control-character
  cleaning and the configured output budget still apply.
- Pending-integration outcomes (unresolved prompt/callback/MCP hooks, async owner
  registration failure, HTTP header refusal) are local states with no recovered record, so
  they carry no source line. Script refusal uses the recovered message text.
- `Te()` is a recorded port that returns false; no diskless mode exists in this runtime.

## Verification

- `test/hooks.test.ts`: stderr failure line, silent exit 2 (no line), decision-block reason
  line; generic `additionalContext` note retained.
- `test/lifecycle.test.ts`: a successful SessionEnd context is not displayed, the failed
  record's line is displayed exactly once without a prefix.
- Focused 138/138, full 2240/2240, tsc 0, build 0, notices 0, identity `23bfdb9f…`.
