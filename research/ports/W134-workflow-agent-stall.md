# W134 — Workflow `agent({stallMs})`

C-8's stall option. A workflow script can give a child a stall window; a request that emits
no text or thinking progress for that window is aborted and retried, and the child fails
with the source message after the retry budget is exhausted. Without the option the request
path is unchanged.

## Source position

- `chunk-hedqf2m1.js` [47679,47717) `Ze=H?.stallMs!=null?Number(H.stallMs):AGr()`: the
  per-agent window comes from the option, otherwise the source default.
- `chunk-40cepjpq.js` [104266,104430) `AGr()`: `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` when
  set, else `min(nJt()+300000, 2147483647)` with the stream watchdog on (default), else
  `600000`.
- `chunk-hedqf2m1.js` [62398,62423) `Cr=Math.min(fe*0.1,1000)`: progress restarts are
  throttled to a tenth of the window, capped at one second.
- `chunk-hedqf2m1.js` [62423,62470) `On=()=>{if(qt?.clear(),fe>0)qt=_0t(...xt...,fe,...)}`:
  the timer runs `Es` [81203] — `abort(new DOMException("stalled","AbortError"))` — against
  the attempt's controller; in-flight tool tracking defers it (`mo`/`wo`).
- `chunk-hedqf2m1.js` [71019,71300) `for(let le=1;A.stalled&&...&&le<=tr;le++)`: retries
  after the initial attempt, each with `[stall] agent "..." stalled (no progress) after Ns —
  retrying (le/tr)` progress.
- `chunk-hedqf2m1.js` [40311] `tr=5`: retry budget; six attempts in total.
- `chunk-hedqf2m1.js` [72470,72730) final failure text:
  `agent stalled on all ${le} attempts (no progress for ${fe}ms each)`; `le` is the number
  of stalled attempts recorded.

## Port

- `src/agent.ts`: `completeModel` wraps the provider call. `stallMs` from the child session
  config arms a timer per attempt; text/thinking chunks restart it under
  `min(stallMs * 0.1, 1000)`ms; the attempt's forwarding `AbortController` is aborted with
  `new DOMException('stalled','AbortError')`; a stalled attempt is retried up to
  `STALL_RETRIES = 5`; the final failure is the source text with six attempts. A caller abort
  is forwarded and rethrown unchanged; a non-stall provider error is rethrown immediately.
- `src/session.ts`: `SessionConfig.stallMs` plus its journal schema.
- `src/agent-registry.ts`: `stall_ms` launch field, finite-number normalization before the
  capacity check, and propagation into the child config.
- `src/workflow-script.ts`: `stallMs` leaves the unsupported-option list, is coerced and
  checked as finite before the journal key and bridge call.
- `src/workflow.ts`: passes `stall_ms` to `launch`.

## Adaptations

- The source default (`AGr`) relies on the async-agent stream watchdog stack, which this
  runtime does not have. The window therefore applies only when the script sets a positive
  finite `stallMs`; absent, non-finite or non-positive values keep the unmodified request
  path. `stall_ms` is optional in the child journal config.
- The source aborts a whole `query` and retries it with structured-output bookkeeping. This
  runtime retries the single model request; tool calls already executed are not replayed.
  The retry therefore restarts the same request rather than the query.
- The source pauses the timer while tools are in flight (`tn` / `mo` / `wo`). This runtime's
  progress signal is the provider stream only; a tool-heavy turn with no stream text can hit
  the window. Scripts that need a longer budget set a larger value.
- `stalledReason`, `replyLost` and the user-retry variants are not ported; only the
  no-progress stall is. The final message keeps the source's `(no progress for Nms each)`
  form.

## Verification

- `test/agent-registry.test.ts`: a silent provider fails after six attempts with
  `agent stalled on all 6 attempts (no progress for 20ms each)`; a non-finite `stall_ms`
  rejects before spawn; a provider that keeps emitting progress completes in one call.
- `test/workflow-script.test.ts`: `stallMs` is rejected when non-finite before the bridge and
  passed through to the bridge when finite.
- Focused 87/87, full 2237/2237, tsc 0, build 0, notices 0, both workflow smokes pass,
  identity `0d0226fa…`.
