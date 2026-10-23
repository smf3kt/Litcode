# W307 hook deadlines follow the recovered defaults

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: any hook definition that names no `timeout`, and any hook that names one above one hour.
- Outcome: a command/HTTP/MCP/callback/script hook runs under 600 s, a prompt hook under 30 s and an
  agent hook under 60 s; an explicit `timeout` wins for every kind and is not capped at load or at
  run time.
- Shape: one deadline resolution shared by the foreground runner and the async registry.
- Target: `src/hooks.ts`, `src/async-hooks.ts`, `test/hooks.test.ts`.

## Source preflight

Sample 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units, half-open ranges.

| Module | SHA-256 | Sites |
| --- | --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `lu=600000` 2915815, `Bkr` 3013410, `js` 3021682, `UF` 2973302, HTTP 2919869, MCP 2923125, prompt 2899971, agent 2910918, `avt` 2932807, async record 2970018 |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | `timeout:v().positive().optional()`: command 100695, prompt 102568, mcp 103697, http 104096, agent 105510 |

```js
var lu=600000;                                            // 2915815
let nn=e.timeout?e.timeout*1000:lu;                       // 2973302  UF
let js=uo.timeout?uo.timeout*1000:b;                      // 3021682  foreground run
asyncTimeout:e.timeout?e.timeout*1000:lu;                 // 2970018  async record
let w=e.timeout?e.timeout*1000:h;                         // 2919869  HTTP sender
let M=e.timeout?e.timeout*1000:y;                         // 2923125  MCP sender
let Ae=e.timeout?e.timeout*1000:30000;                    // 2899971  prompt hook
let Ae=e.timeout?e.timeout*1000:60000;                    // 2910918  agent hook
async function avt(e,n,r,s,h=lu){...}                     // 2932807
```

The schema is `timeout:v().positive().optional()` on all five kinds: positive, optional, no upper
bound. The source converts seconds to milliseconds at the use site and never clamps.

## Cause

Three deviations from that body:

1. `DEFAULT_TIMEOUT_SECONDS = 60` was a flat default for every kind, so a hook that named no
   deadline gave up after one minute where the source allows ten.
2. Prompt and agent hooks shared that flat default instead of the source's 30000/60000 split.
3. The schema carried an invented `max(3600)` and both async guards rejected a deadline above one
   hour. A settings file naming `timeout: 7200` failed to load, which the source never does.

The async registry also resolved its own deadline from `request.timeoutMs` alone, so a definition
with an explicit `timeout` ran under the caller's deadline instead of its own. The source uses one
expression on both sides (`js` for the foreground run, `asyncTimeout` for the record), so the two
must agree.

## Implementation

- `src/hooks.ts`: removed the schema cap, kept `finite()` so an infinite deadline cannot be
  scheduled, and replaced the flat default with `DEFAULT_TIMEOUT_SECONDS = 600`,
  `PROMPT_HOOK_TIMEOUT_SECONDS = 30`, `AGENT_HOOK_TIMEOUT_SECONDS = 60`. The new exported
  `hookTimeoutSeconds(definition)` resolves explicit-then-kind, and the runner calls it.
- `src/async-hooks.ts`: both `Async hook deadline must be positive.` guards now check only
  finiteness and positivity; the registry timeout takes `definition.timeout` first and falls back to
  the caller's deadline, matching the two source expressions.
- No other file changes. `src/tui-statusline.ts:132` already passes 600000 and matches `lu`.

## Verification

- `npx tsc --noEmit` 0.
- `test/hooks.test.ts` + `test/async-hooks.test.ts` 77/77.
- `test/plugin-chain*.test.ts` + `test/skills-hooks.test.ts` 980/980.
- `test/hooks` + `async-hooks` + `interactive` + `agent` 118/118.
- Full suite: three tests time out (`statusline` multiline ANSI footer, `terminal-focus` Vim draft
  handoff, `plugin-toggle` live catalog). All three reproduce in a clean worktree at `c54daf7` with
  this package reverted, so they are pre-existing and not caused by the deadline change; everything
  else in the suite passes.
- `npm run build` succeeded.
- Compiled CLI against an owned loopback provider: a workspace settings file naming
  `timeout: 7200` loads without a settings error, the turn completes, exit 0, one request. Before
  the change the same file was rejected at load.

## Limitations

- The generic `lu` fallback is ported. The source's per-event caller deadlines are not: the
  UserPromptSubmit dispatch passes `n5e=30000` (chunk-sfn1dbxq.js 2952261 and 2952631), WorktreeCreate
  passes `n5e` while WorktreeRemove passes `lu` (2952631, 2954405), and SessionEnd resolves
  `ues()`/`oAe()` (2955428/2955497) with `des=1500`, `X_r=60000` and the
  `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` override. This host still runs every event under one
  fallback, so a UserPromptSubmit hook that names no deadline gets 600 s instead of 30 s. That is the
  next package.
- The source's `timeout` is a JSON number of seconds; this host keeps that unit and converts once at
  the runner, so the async request keeps carrying milliseconds.
- `avt`'s own `h=lu` parameter default is not a separate surface here; the registry receives the
  resolved deadline from the runner instead of resolving it a second time.
- The prompt/agent model-hook resolvers are parent-owned; only their deadline values are ported in
  this package.
