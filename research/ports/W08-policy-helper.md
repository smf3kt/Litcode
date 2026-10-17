# W08 managed settings helper: the local governance tiers

Status: verified finite helper state machine. Date: 2026-10-12.
Task: an opted-in helper reads managed policy from outside the workspace -> its output governs while it is healthy -> a failed read degrades to a static default payload when one exists, or keeps the last successful output when none does -> a structurally invalid document is refused rather than replaced -> the helper is re-read on its configured interval and its recovery is announced.
Entry: `--policy-helper PATH`, optionally `--policy-helper-interval MS`; the static default payload is whatever managed policy the session already carries, so `--managed-settings FILE` supplies it. With neither flag nothing changes.
Targets: policy-helper.ts (new), session.ts (`policyHelper` config, the `policyHelper` feature flag), cli.ts (flag parsing, the settle loop and the refresh timer), test/policy-helper.test.ts, scripts/smoke-policy-helper-cli.mjs.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data.

- The three tiers and their transitions are one closure in chunk-x0dc37w9.js (SHA-256 0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4e957d92, 113411 bytes). A failed refresh with a static default applies it and reports `settings_policy_helpers_per_os` / `refresh_fell_back_to_default` [56766, ...); a failed refresh with no default keeps the last successful output and reports `settings_policy_helper` / `refresh_failed` [57556, ...); a successful refresh after a failure announces that the helper's output replaces the static default [57556, ...) and sets `serving="helper"` [57600, ...). The tier itself is a field that flips between `helper` and `default`.
- Three read mechanisms are declared as one set, `$n=new Set(["plist","hklm","file"])` [57936, 57966). Only `file` is executable on this host: `plist` addresses a macOS system domain and `hklm` is the Windows registry.
- The read entry is `async function z0t(e,n,r)` [57969, 58140) over `async function Bn(e,n,r)` [59016, 63534), and the remote branch inside it decides whether a refusal is enforced at all: `function Gn(e,n)` [58176, 58557) logs `remote_refuse_not_enforced_no_session` when `onFailure` is `refuse` but the command starts no session, and `startsNoSession` [58484, ...) gates it.
- Structural validity is decided by two small functions. `function Kn(e)` [58702, 58830) finds a startup-fatal settings error whose path is empty, `policyHelpers`, or under `policyHelpers.`: `e.find((n)=>n.startupFatal&&(n.path===""||n.path==="policyHelpers"||n.path.startsWith("policyHelpers.")))`. `function vEo(e)` [58830, 59016) then classifies it: a path equal to `policyHelpers.<name>` for a name in `LB` is `helper_failed`, anything else is `policy_invalid`, and with no structural error the payload-refusal flag decides between the same two. The name list is a platform list, `LB=["macos","linux","windows","wsl"]` — chunk-3cynezh1.js (SHA-256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3, 434204 bytes) [201689, 201727) — and the refresh bound constant is `KCr=_u` [196135, ...) in that same module.

These are source declarations, not runtime observation.

Classification: adapt of the tier rules onto this runtime's existing managed-policy snapshot. This runtime already reads a managed settings file once (`--managed-settings`), strictly, and treats an unusable document as fatal; the helper is a different object — one whose input is expected to change, so a failed read has somewhere to fall back to. Owned decisions, marked as such:

- The helper is opt-in and separate from `--managed-settings`, so the existing once-read path keeps its fatal semantics and nothing about a session without the flag changes.
- The static default payload is the session's own managed policy rather than a second configuration field, which is the same relationship the recovered `defaultFallback` has to the static settings payload; a helper may still override it through its config.
- Success and failure are announced once per transition rather than per pass, matching the recovered code, which only re-announces when the failure code changes.
- Structural invalidity is split from read failure at the same boundary the recovered code uses: an unreadable, missing or non-JSON document is `helper_failed` and may be replaced by another tier, while a document that parses but is not a usable managed policy is `policy_invalid` and is refused, leaving whatever tier was governing in place.

Not ported, with reasons. The `plist` and `hklm` mechanisms are not ported: they read a macOS system domain and the Windows registry, neither of which exists on this host, so a helper here reads a file. The platform tiers themselves are not ported: `LB` exists to pick a per-platform helper path, and this runtime has one mechanism rather than four. Remote consent and remote refusal enforcement are not ported: they are `remote_consent_missing` [61280, 61890, 62563) and the `Gn` / `startsNoSession` branch above, both of which require an external service, which CURRENT already classes as External. The `bashMissKind`-style failure vocabulary is not ported. No recovered entrypoint was executed.

## Contract and boundaries

With `--policy-helper`, the helper is read once before the session runs and again on `--policy-helper-interval` when that is given; each pass applies whichever tier is governing. A healthy helper governs: its document is validated against the managed policy schema and, when valid, replaces the session's managed policy. A read failure applies the static default payload when one exists, otherwise the last successful output keeps governing; a structurally invalid document applies nothing and is reported as refused. Warnings name the transition and are written to standard error.

Without the flag the helper does not exist, so `--managed-settings` keeps its existing behaviour and a session that never names a helper is byte-for-byte unaffected. A refresh that throws is caught and reported rather than ending the session, and the timer is unref'd and cleared on abort so it never holds the process open.

## Validation

`test/policy-helper.test.ts` covers the classifier and the machine: a readable document serves the helper tier; a missing document with a default falls back and warns once, repeating a same-kind failure does not warn again, a return to health announces recovery, and a failure with no default keeps nothing; a document rejected by the validator is `policy_invalid` and leaves both the serving tier and the policy it was serving untouched rather than substituting the default, while malformed JSON after it is `helper_failed` and does fall back; and `readPolicyHelper` keeps an unreadable path, a JSON array and a valid object in their three distinct outcomes.

`npm run smoke:policy-helper-cli` drives the real CLI in source and compiled modes against an owned loopback SSE gateway, three times with the same policy-helper flags and a `--managed-settings` payload that denies `write_file`. With no helper document the default tier governs, the write is denied, the file is not created and stderr carries the fallback warning; with a valid document the helper tier governs, the write succeeds and the file appears, which is what shows the tier decides rather than a blanket rule; with a document that parses but misses required policy fields the document is refused, the fallback warning does not appear and the write stays denied. Two model requests per case; the driver asserts a zero exit.

Full suite 1062/1062, fail 0; check and build clean. Package smoke 64 files, 0 upstream requests. Identity: 114 input / 84 validation / 57 build files, merged digest 43cd0aeb6f6ba90fcf3eb3b0b463b89a4774147876b08fd7bc3256cbf44e43b9, reproduced byte-identical by an independent offline rebuild in a fresh directory (`npm ci --ignore-scripts --offline`, check, build); runtime tarball 64 files, SHA-256 6e4f726b477f2a53d315f0dc5ddd741851d7149379e6715877eb56d9b40ec1d2. Detailed identity, receipts and range citations: [W08-policy-helper-evidence.json](W08-policy-helper-evidence.json).


## W67-01 local OS-managed directory (2026-10-17)

The static default payload the helper falls back to is now the OS-managed policy when no explicit
`--managed-settings` file is given: the platform directory's base file and non-hidden `.json`
drop-ins, merged with the source customizer. Only the local file tier is read; the plist/registry
tiers, WSL inheritance and the remote policy path stay External. See
[W67 record](W67-os-managed-policy.md).
