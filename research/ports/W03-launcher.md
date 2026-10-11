# W03 existing-gateway launcher

Date: 2026-10-11. Status: verified existing-gateway process handoff.
Implementation classification: local integration; discovery contract observed
on Magpie0.1.1109. No recovered application code is executed or copied.

scripts/launch-magpie.mjs checks a loopback gateway root for name=magpie and
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

This adapter uses an already-running Magpie service. It does not launch or
restart the application, mutate routes, issue credentials or rotate them.
Those management lifecycle parameters and permissions remain unverified.
