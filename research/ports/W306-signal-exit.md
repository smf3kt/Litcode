# W306 one-shot interrupt exits 130 under a loaded signal-exit

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: `litcode /<background skill>` in one-shot mode, Ctrl+C (SIGINT) while the child waits.
- Outcome: the process finishes the aborted turn, reports `finished: aborted`, releases the
  session lock and exits 130 instead of dying by signal with a null code.
- Shape: the CLI's interrupt handlers must stay registered for the life of the run, matching the
  recovered `process.on` registration.
- Target: `src/cli.ts` only.

## Source preflight

Sample 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units.

| Module | SHA-256 | Range |
| --- | --- | --- |
| chunk-rx2nah4x.js | cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51 | `ni` 492033, `process.on("SIGINT",ni)` 492237, `Vd`/`process.on("SIGTERM",Vd)` 492335 |

```js
let ni=()=>{if(J("info","shutdown_signal",{signal:"SIGINT"}),Ds()){WZ();return}
  if(Me.abortController&&!Me.abortController.signal.aborted)Me.abortController.abort(fc("user-cancel"));
  Yn.abort(),WZ(),Zn(0)};
process.on("SIGINT",ni);
let oi=!1,Vd=()=>{if(oi||Ds())return;oi=!0,M8(),Lvn(),Yn.abort(),Zn(143)};
process.on("SIGTERM",Vd)
```

The source registers both with `process.on`, and each handler guards itself (`Ds()` for an
in-flight shutdown, `oi` for a repeated SIGTERM). The local CLI used `process.once`, which is the
whole defect.

## Cause

`plugin-chain-lockfile-source.ts` carries vendored `signal-exit`, which installs one SIGINT
listener of its own and, when a signal fires, re-raises it after its callbacks run if no other
listener remains. A `once` wrapper removes itself before it runs, so at the moment signal-exit
inspects the listener list the only remaining listener is its own: it re-raises SIGINT, and the
process dies by signal before the aborted run can set `process.exitCode = 130`. A run whose
listener was still registered when the signal fired (any path that had not yet reached the
`finally` removal) is unaffected, which is why only the background-skill wait reproduced it.

Observed with a listener-count probe: `once` leaves `listeners=1` (signal-exit only) at the
moment the handler runs, and the child closes with `code: null, signal: "SIGINT"`. With `on`,
both listeners remain, signal-exit takes its normal path, and the child reports `finished:
aborted` and code 130.

## Implementation

- `src/cli.ts` registers `onInterrupt` with `process.on` for SIGINT and SIGTERM and still removes
  both in the `finally`. The handler itself is unchanged: it aborts the controller, which every
  path already treats as an interrupt.
- No other file changes. The `--login` path keeps its own `once` registration, matching the
  recovered login flow, which is a separate short-lived command and not this run loop.

## Verification

- `npx tsc --noEmit` 0.
- `test/cli-migration.test.ts` 12/12, including the previously failing
  `CLI interrupt during one-shot background skill wait exits 130 and closes owned child locks`.
  The test also asserts `finished: aborted`, no active session and no leftover lock.
- `test/cli.test.ts` + `test/cli-advanced.test.ts` 20/20.
- The long-standing effort mismatch in the same suite is resolved by reading the source rather
  than by changing the product: `Vit(r.effort)` (chunk-9vcaezw1.js 14114) writes the flag as the
  session effort, and `kE` (12972) puts `Y0()`'s environment value ahead of the session level.
  The test asserted the opposite for both, so it now asserts the source order: the flag beats a
  settings default, the resumed request carries `LLM_EFFORT`, the journal keeps the pinned
  `xhigh`, and a fresh session with both sends the environment value. Product code unchanged.

## Limitations

- The source's shutdown store (`lts.shutdown`, failsafe timers, resume hint, SessionEnd hooks) is
  not ported; this host keeps its own `finish()` sequence. Only the registration form is ported,
  because that form is what the exit-code defect depends on.
- `SIGHUP`, `uncaughtException` and the orphan check in the same `install()` body remain out of
  scope for this package.
