# W03 installed gateway launcher

Date: 2026-10-11. Status: existing-gateway handoff and owned command cold-start verified.
Implementation classification: local integration; discovery contract observed
on Magpie0.1.1109. No recovered application code is executed or copied.

bin/litcode-magpie.mjs checks a loopback gateway root for name=magpie and
advertised /v1/messages, then validates the selected /v1/models identifier.
Read-only discovery has a three-second deadline, one-MiB response cap and no
redirects. Credentials remain in process environment. An existing vendor
credential reference is accepted only for the exact selected gateway origin;
the child receives neutral LLM_* configuration. No credentials are printed.
Resume reads bounded regular-file session metadata and uses its pinned model
and endpoint. The launcher forwards child exit codes and SIGINT/SIGTERM.

```
node scripts/launch-magpie.mjs --check --model deepseek/deepseek-flash
node scripts/launch-magpie.mjs --model deepseek/deepseek-flash -- --workspace PROJECT --interactive
node scripts/launch-magpie.mjs -- --workspace PROJECT --resume SESSION_ID --continue
```

The latter two commands may make paid calls and require applicable approval.
This pass invoked --check against the real installed gateway with zero model
calls. The owned smoke verifies discovery, missing-model rejection, gateway
identity validation, pinned resume, exact credential origin, no secret output
and actual compiled offline demo handoff. It makes no model calls.

Explicit --start-command JSON_ARGV launches an owned process only after a
connection-refused observation; the default remains discovery-only. Its process
group is terminated on launcher exit, cancellation, readiness error or timeout,
with a one-second SIGKILL escalation. Model catalog readiness shares the bounded
startup deadline (100..120000ms, default15000). Healthy gateways and invalid
gateway identities never trigger the starter. Credentials are stripped from
the starter environment; they reach only the intended LiTcode child.

```
node scripts/launch-magpie.mjs --check --model MODEL --start-command '["/absolute/gateway", "ARG"]'
node scripts/launch-magpie.mjs --check --model deepseek/deepseek-flash --start-app /Applications/magpie.app
```

--start-app uses macOS open only after connection refusal; the application is
externally owned and remains running. This launch path is implemented but actual
application cold-start was not exercised: the real gateway was already healthy,
so startupAction=none. Owned process fixtures verify cold discovery/model
readiness, failure cleanup, 100/300ms deadlines, SIGTERM and child reaping in
three groups. Existing smoke also verifies equal-form resume flags, strict UUID,
duplicate rejection and symlink storage rejection. Foreground CLI retains TTY
process-group membership. Routes/credential issuance/rotation remain unverified.

Installed delivery follow-up: package bin now includes litcode-magpie; the
scripts/launch-magpie.mjs path remains a compatibility import. --help works
without discovery, credentials or model calls. The launcher ships as ordinary
Node ESM with production-only installation. Package smoke invokes both owned
drivers against the actual installed executable and proves help, model gates,
pinned resume, compiled demo, cold start and cancellation. A starter that exits
while leaving a descendant no longer skips group cleanup; that child is reaped
inside the existing command-ownership test group.
Private package57files/source178files and identical50module rebuild are bound
in W03-installed-launcher-evidence.json. This pass made zero new model calls.
Artifacts: release/launcher-runtime and release/litcode-source-launcher.
