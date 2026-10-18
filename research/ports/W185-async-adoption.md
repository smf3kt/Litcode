# W185/C6 same-process async hook adoption

Date: 2026-10-18. Source carrier: `extracted-v2/modules/chunk-sfn1dbxq.js`, SHA-256
`4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, 4762583 UTF-16
units. All ranges are zero-based UTF-16 half-open. Supporting module
`chunk-ax7r0qj7.js` (`8e782f9b…`) and `chunk-n3ykh62m.js` (`2a0e605d…`).

## Ported source

- `Cxe` [82462,82919): one stdout/stderr capture object per process, cleanup detaches
  listeners. `Axe` [82919,87427): process owner with one `result` promise, deadline
  `#s`, abort listener `#k`, `#C()` clearing both, `background(e,n)` switching
  `running`→`backgrounded` and returning false otherwise, `#M` building the final
  result, and `#E` killing the process group. `wee` [87427,87504): constructor wrapper.
- `Ur`/`UF` [2969279,2980094): stdin written once; on every stdout chunk the first
  line is cut with `Ar` and parsed; a parse attempt is permanent (`Rr`); only
  `async === true` (`vye`, chunk-n3ykh62m.js [396651,396699)) hands the live handle
  to `m5e`; only a successful handoff detaches the foreground listeners and resolves
  `status 0, backgrounded`; `Do.cleanup()` is skipped only for that transfer.
  `_e` forceSync keeps the header in the foreground.
- `Ar`/`Qe` (chunk-ax7r0qj7.js [3224,3561)): the first line is the text before the
  first newline, or the whole remaining text when there is none; a header without a
  trailing newline therefore transfers as soon as it parses.
- `m5e` [2955889,2958184): normal path backgrounds the same shell, registers `kbt`
  and does not install a replacement async timeout. `kbt` [625629,626248) only logs
  `asyncTimeout || 15000` and registers the output reader.
- `gbt` [622557,622798): after an async header, the joined remaining lines are tried
  first, then each original line; the first parsed object without any `async`
  property is the sync payload. `Sbt` [626520,627570): the complete same-process
  stdout/stderr and exit code feed that parser; a clean exit with no payload and no
  stderr produces no attachment.

## Ported semantics in this host

- `src/hooks.ts` `startHookCommand` owns one `ChildProcess` with bounded stdout and
  stderr, a process group, one final `done` promise, and a separate foreground
  `result` that settles at transfer (`backgrounded: true`) or at process end.
  `background()` is the one-time owner claim; `detachForeground()` clears the
  deadline and abort listener; `kill()` terminates the group; `cleanup()` releases
  buffers. `runHookCommand` starts a non-adoptable handle, so bare callers keep the
  pre-existing final-result behaviour.
- First-line detection parses on every chunk until a first parse settles, matching
  `Ur`; it no longer requires a newline. A malformed first parse, a non-async first
  object, and a plain first line never transfer later.
- `runHooks` awaits the foreground `result`; on `backgrounded` it calls the owner's
  `startAsyncCommand` with the live handle. On a rejected registration it awaits the
  same process's `done`, cleans up, and interprets the final output with the same
  header-skipping rule, so the process stays in the foreground (`fo` false).
- `AsyncHookRegistry.adopt` validates the same stdin/cwd/event constraints as
  `start`, claims the handle, detaches the foreground deadline, waits for `done`,
  strips the async header with `syncOutputAfterHeader`, and interprets only the sync
  payload. `stop()` and `close()` kill an adopted process group; `close()` waits for
  all jobs.
- The configured-async path (`registry.start`) runs the command with
  `adoptAsyncHeaders: false` and `stripAsyncHeader: true`: the registry already owns
  that process, so its own header is output for `gbt` to skip, not a second handoff
  (`_e` forceSync).

## Host adaptations

- The source `asyncTimeout` value is logged but never installed. This host keeps no
  replacement timer after transfer, matching the observed body; the original
  foreground deadline is cleared at adoption.
- The source emits a `hook_response` event before conversation attachment without
  proving durable fsync. This host keeps its existing journal-before-effect contract
  in `createChildHookLifecycle`/runtime completion delivery; that ordering is an
  owned host decision, not a source claim.
- `forceSync` remains a runner control in the source and is not added to the authored
  hook schema; the equivalent host switch is the internal `adoptAsyncHeaders`
  option.

## Validation

- `npm run check`: 0.
- `test/async-hooks.test.ts` 17/17: same-PID transfer with split/no-newline header,
  one stdin line, header skipped in the completion; malformed/nonasync/plain first
  lines stay foreground; rejected adoption keeps the process and interprets its final
  output; configured async keeps its header as output with no second job; turn
  cancellation after adoption retains the job; registry close kills the adopted group.
- Affected hooks/registry suites: 151/151 (hooks 98, async-hooks 17, hook-groups,
  hook-transports, hook-once-runtime, agent-registry).
- Full suite: 2617/2617.
- Build `dist/hooks.js` `403063b4…`, `dist/async-hooks.js` `72c57ae5…`.
- Original before probe `/Users/mant1ssa/.claude/jobs/9b2805b2/tmp/c6-before.79ZqOoY4/`
  (foreground unsettled, 0 jobs, no completion) re-ran after repair at
  `/Users/mant1ssa/.claude/jobs/9b2805b2/tmp/c6-after.jqCKWG/`: foreground settled
  with one background task, one registry job on the same PID, one stdin line, exactly
  one completion with `systemMessages: ["OWNED_FINAL_CONTEXT"]` and no extra context.
- Configured-async probe (`c6-configured/probe.mjs`, `probe2.mjs`): newline,
  no-newline-then-newline and plain outputs complete with no registration-failure
  context and one job.
- `scripts/smoke-hook-terminal-cli.mjs` exits non-zero in this environment with a
  PTY close of `null`; the same failure reproduces with the C6 changes stashed at the
  pre-C6 tree, so it is not introduced by this package.
