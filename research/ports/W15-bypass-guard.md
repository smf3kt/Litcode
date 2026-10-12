# W15 - a bypass request from root outside a sandbox is refused

## Recovered surface

`chunk-zygdtz20.js`, sha256
`e71f5d58cb820aed4afb2f8f044e1315afd0b23a494345609179b253bbd2e1a8`, 5842 bytes, read as
inert data. Coordinates below are zero-based UTF-16, left-closed/end-exclusive over the
decoded module text, after the import barrel that ends with the named imports at offset
3886.

| Symbol | Range | What it is |
| --- | --- | --- |
| `function i(s)` | [4733, 4815) | the bypass request predicate: `permissionMode === "bypassPermissions"` or `allowBypass === true` |
| `function g(s)` | [4815, 5010) | the guard: on a bypass request, `console.error` the refusal and `process.exit(1)` |
| `function c(s)` | [5010, 5201) | the policy gate that strips the mode and reports the policy notice |
| `async function b(s,o,r)` | [5201, 5748) | the consent dialog and the persist-after-consent check |
| `export{...}` | [5748, 5842) | the three exported names |

The sandbox exemption `g` consults lives in a different module - `chunk-bk5ct2gw.js`,
sha256 `efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1`, 744610 bytes -
at [255561, 255700):

```
isRootOutsideDeliberateSandbox(){return this.sources.platform!=="win32"&&this.sources.getuid()===0&&!this.sources.isSandboxEnvSet()&&!this.sources.isBubblewrapEnvSet()}
```

Its three sources are bound in the same module at [256546, 256760): `isSandboxEnvSet` is
`process.env.IS_SANDBOX === "1"`, `isBubblewrapEnvSet` is the `CLAUDE_CODE_BUBBLEWRAP`
environment flag, and `getuid` is `process.getuid()` where the function exists. The
container marker itself is `statSync("/.dockerenv")` in `chunk-9rz2kgpd.js`, sha256
`cf758c9dbb4d9967606378bfe4c71d6f29d175c4c7fd2940c4ed967054a9d53d`, at [1028, 1074), reached
through the same probe class's `isDocker()`.

## Ported invariant

A bypass request is refused before anything runs when the process is root outside a
deliberate sandbox. The check is on the resolved permission mode, it happens at
configuration build time - after the permissions are resolved and before any tool runs - and
it is a process exit rather than a warning, because a warning about a mode that already
skipped the checks is read too late.

Classification: adapt of the guard onto this runtime's own permission resolution, narrower than the recovered module. The recovered `g` both decides and exits; here the decision is a value the CLI turns into the exit, and the sandbox exemption is reproduced by different signals because this runtime has no bubblewrap wrapper of its own. The other two exports of the same module - the policy gate and the bypass consent dialog with its persist-after-consent check - are not ported, so this is one half of the recovered rule landing on a surface this runtime already owns.

## What the local runtime had
`src/cli.ts` accepted `--permission-mode bypass` and `src/permissions.ts:154` returns
`{ decision: 'allow' }` for every call in that mode; `src/interactive.ts` documents
`/permissions MODE`. Nothing under `src/` read a privileged uid, so the guard half of the
recovered rule had no local counterpart at all.

## What landed

| File | Change |
| --- | --- |
| `src/bypass-guard.ts` | new: the predicate, the sandbox test, and the refusal as a value |
| `src/cli.ts` | the refusal is reported and exits 1 immediately after `resolvePermissions` |

`src/cli.ts:15` imports `refuseBypassUnderRoot`; `src/cli.ts:289` calls it with
`{ mode: config.permissions.mode }` and, on a refusal, writes the message to stderr and
exits 1. Placing it there means the refusal precedes workspace locking, MCP admission, the
task-required gate and the first request.

## Owned decisions

- **The decision is returned, not exited.** The recovered `g` calls `process.exit(1)`
  itself. Here the refusal is a value (`{ refused, message }`) that the CLI turns into an
  exit, so the rule is observable by a test and explainable by a wrapper - a rule that only
  exists as an exit code cannot be asserted directly.
- **Two sandbox signals, not one.** The recovered predicate exempts on
  `IS_SANDBOX === "1"` and `CLAUDE_CODE_BUBBLEWRAP`. The port keeps one environment opt-in
  (`HARNESS_SANDBOX=1`) and adds the two container marker files, because in this runtime
  being root under Docker or Podman is the intended arrangement and there is no bubblewrap
  wrapper of our own to name.
- **`win32` is handled structurally, not by a platform test.** The recovered predicate
  short-circuits on `platform !== "win32"`. Here `process.getuid` does not exist there, so
  the uid is `undefined`, which is not `0`, and nothing is refused. Same outcome without a
  platform string this runtime does not otherwise carry.
- **An unreadable marker is not a sandbox.** A marker path that throws on stat is treated as
  absent, so a permission error cannot be turned into an exemption.
- **The refusal names the reason, not the fix.** The message says the tools would run as the
  machine's owner rather than as the person who typed the command; it does not suggest a
  container, because the choice of sandbox belongs to the person running it.

## Not ported

- `applyBypassPolicyGate` (`c`, [5010, 5201)): it strips the mode and reports a
  policy-sourced notice. This runtime's settings layers carry no such policy source, and
  stripping the mode after resolving it would silently contradict the flag the person typed.
- `ensureAgentsBypassConsent` (`b`, [5201, 5748)): it opens an interactive consent dialog
  and then re-reads user settings to confirm the consent persisted, warning when the write
  failed. This runtime has no bypass consent dialog - the mode is chosen by flag or settings
  layer and takes effect - so the rule guards a surface this runtime does not have.
- The settings-level spelling of the request (`allowBypass === true`): this runtime's
  settings schema has no such field, so the mode is the only spelling that reaches the guard
  here. Keeping an unreachable true branch in a guard like this would hide exactly the kind
  of mistake the guard exists to catch.
- The bubblewrap flag as such; it is covered by the container markers and the one opt-in.

## Verification

- `npm test` - 1109 pass, 0 fail. `test/bypass-guard.test.ts` holds 5 cases, including a
  real CLI run: the child preloads `process.getuid=()=>0` through a `data:` module, starts
  `src/cli.ts` with `--permission-mode bypass`, and asserts exit 1 with the message and no
  connection attempt; the same uid with `--permission-mode plan` is not refused.
- `npm run check` (tsc --noEmit) clean; `npm run build` exit 0.
- `npm run smoke:package` - passed, 69 files, 0 upstream requests.
- No CLI smoke driver was added: the refusal is a pure function of the resolved mode and the
  process uid, and the real-CLI case above already drives the whole path end to end.

Regressions: none. No existing case changed behavior - the guard fires only on a mode no
existing test uses together with a uid no test environment has.
