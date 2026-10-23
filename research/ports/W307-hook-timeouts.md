# W307 hook deadlines follow the recovered defaults

Status: verified locally on 2026-10-23. Local commit only; no push.

## Task card

- Entry: any hook definition that names no `timeout`, and any hook that names one above one hour.
- Outcome: a command/HTTP/MCP/callback/script hook runs under 600 s, a prompt hook under 30 s and an
  agent hook under 60 s; UserPromptSubmit and the two model-switch events use their own 30 s caller
  deadline and SessionEnd uses 1500 ms (env-overridable) with a 1500..60000 ms raiser bound; an
  explicit `timeout` wins for every kind and is not capped at load or at run time.
- Shape: one deadline resolution shared by the foreground runner and the async registry.
- Target: `src/hooks.ts`, `src/async-hooks.ts`, `src/agent.ts`, `test/hooks.test.ts`.

## Source preflight

Sample 2.1.296, SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.
Coordinates are zero-based UTF-16 code units, half-open ranges.

| Module | SHA-256 | Sites |
| --- | --- | --- |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `lu=600000`/`n5e=30000`/`o5e=30000` 2915829-2915858, `des=1500`/`X_r=60000` 2955193, `Bkr` 3013410, `js` 3021682, `UF` 2973302, HTTP 2919869, MCP 2923125, prompt 2899971, agent 2910918, `avt` 2932807, async record 2970018, `Yir` 2952261, `qtt` 2952631, PreModelSwitch 2938116, PostModelSwitch 2939949, WorktreeCreate 2953048, WorktreeRemove 2954405, `ues` 2955428, `oAe` 2955497, `uvt` 2943952 |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | `timeout:v().positive().optional()`: command 100695, prompt 102568, mcp 103697, http 104096, agent 105510 |

```js
var lu=600000,n5e=30000,aVt=6000,o5e=30000,Iln=5000;          // 2915829
var des=1500,X_r=60000;                                         // 2955193
let nn=e.timeout?e.timeout*1000:lu;                             // 2973302  UF
let js=uo.timeout?uo.timeout*1000:b;                            // 3021682  foreground run
asyncTimeout:e.timeout?e.timeout*1000:lu;                       // 2970018  async record
let w=e.timeout?e.timeout*1000:h;                               // 2919869  HTTP sender
let M=e.timeout?e.timeout*1000:y;                               // 2923125  MCP sender
let Ae=e.timeout?e.timeout*1000:30000;                          // 2899971  prompt hook
let Ae=e.timeout?e.timeout*1000:60000;                          // 2910918  agent hook
yield*KT({...,timeoutMs:n5e,...});                              // 2952261  UserPromptSubmit
yield*KT({...,timeoutMs:r.timeoutMs??o5e})                      // 2938116  PreModelSwitch
b0({...,timeoutMs:ues()})                                       // 2943952  SessionEnd
function ues(){return a.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS??des}   // 2955428
function oAe(){...Math.max(des,Math.min(n,X_r))}                // 2955497  raiser bound
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

4. Every event shared one caller deadline. The source's dispatchers do not: UserPromptSubmit and the
   two model-switch events pass 30 s, SessionEnd passes `des=1500`, and SessionEnd's raiser waits at
   most `oAe()` = clamp(longest configured SessionEnd timeout, 1500, 60000). This host's shutdown
   signal was a flat 2 s, which is neither.

## Implementation

- `src/hooks.ts`: removed the schema cap, kept `finite()` so an infinite deadline cannot be
  scheduled, and replaced the flat default with `DEFAULT_TIMEOUT_SECONDS = 600`,
  `PROMPT_HOOK_TIMEOUT_SECONDS = 30`, `AGENT_HOOK_TIMEOUT_SECONDS = 60`. `hookTimeoutSeconds` now
  takes the event and the environment and resolves explicit, then the model-hook fallbacks, then the
  event's caller deadline, then `lu`.
- The caller deadlines are ported too: `CALLER_TIMEOUT_SECONDS` carries `UserPromptSubmit`,
  `PreModelSwitch` and `PostModelSwitch` at 30 s (`n5e`/`o5e`, chunk-sfn1dbxq.js 2952261, 2952631,
  2938116, 2939949) and `SessionEnd` at `des=1500` with the
  `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` override (`ues`, 2955428). `sessionEndHookBoundMs`
  ports `oAe` (2955497): the env value, else the longest configured SessionEnd timeout floored at
  1500 ms and capped at 60000 ms. `src/agent.ts` uses that bound for the shutdown signal in place of
  the invented fixed 2 s.
- `src/async-hooks.ts`: both `Async hook deadline must be positive.` guards now check only
  finiteness and positivity; the registry timeout takes `definition.timeout` first and falls back to
  the caller's deadline, matching the two source expressions.
- `src/tui-statusline.ts:132` already passes 600000 and matches `lu`; no change.

## Verification

- `npx tsc --noEmit` 0.
- `test/hooks.test.ts` + `test/async-hooks.test.ts` 78/78, including the new per-event deadline
  assertions and the SessionEnd bound test.
- `test/plugin-chain*.test.ts` + `test/skills-hooks.test.ts` 980/980.
- `test/agent-lifecycle` + `interactive` + `agent-registry` 134/134.
- `test/hooks` + `async-hooks` + `interactive` + `agent` 118/118.
- Full suite: 3267 tests, 3262 pass, 1 fail, 4 cancelled. The three timeouts are `statusline`
  (multiline ANSI footer), `terminal-focus` (Vim draft handoff) and `plugin-toggle` (live catalog);
  each reproduces in a clean worktree at `c54daf7` with this package reverted, so all three are
  pre-existing and not caused by the deadline change.
- `npm run build` succeeded.
- Compiled CLI against an owned loopback provider: a workspace settings file naming
  `timeout: 7200` loads without a settings error, the turn completes, exit 0, one request. Before
  the change the same file was rejected at load.
- Compiled CLI with user-layer hooks: the UserPromptSubmit hook starts and its result is journaled
  (`hook_start`/`hook_result`), the SessionEnd hook writes its marker, exit 0 in ~0.3 s.

## Limitations

- The model-hook fallbacks are checked before the caller deadline, matching the source's dispatch
  order: a prompt hook never sees `n5e`, because `bln` reads its own `e.timeout?...:30000`.
- SessionEnd's `oAe` reads the source's managed and plugin SessionEnd tables as well as the local
  settings; this host passes the merged local config, so a managed-only SessionEnd timeout does not
  widen the bound. The env override is the same.
- The source's `timeout` is a JSON number of seconds; this host keeps that unit and converts once at
  the runner, so the async request keeps carrying milliseconds.
- `avt`'s own `h=lu` parameter default is not a separate surface here; the registry receives the
  resolved deadline from the runner instead of resolving it a second time.
- The prompt/agent model-hook resolvers are parent-owned; only their deadline values are ported in
  this package.
