# W131 — Magpie endpoint discovery and caller-key rotation

C-1 covers the local side of Magpie startup and recovery. A02 located the application's
management surface; this package keeps that surface untouched and adapts the launcher so a
running Magpie is found at its configured address, and a rotated caller key is not forwarded.

## Source position

The recovered extracted source contains no module for this behaviour. The source is the
installed application's own local configuration surface, observed read-only and recorded here:

- `/Applications/Magpie.app/Contents/MacOS/magpie` carries `MAGPIE_ADDR`,
  `POST /api/settings/port`, `GET /api/caller-keys`, `caller-keys.json`, and the caller-key
  prefixes `sk-magpie-key-` and `sk-magpie-revoked-`.
- `~/.config/magpie/stash.json` holds `claude.wired_at`, the endpoint Magpie last wired into a
  client. The directory has no `caller-keys.json`, only a lock file, so no key was read.
- [W03 live](../ports/W03-live.md) records the management API as window-mode bound rather than
  port-bound, and [W03 launcher](../ports/W03-launcher.md) records the route and launcher
  surface. [W03 management discovery](../ports/W03-management-discovery-evidence.json) owns the
  route evidence.

No recovered application entrypoint was executed. The application's management API, the
`settings/port` write, and caller-key issuance remain the user's on-site action.

## Port

`src/gateway-inherit.ts` gains:

- `resolveMagpieEndpoint({ env, home, explicit })` resolves, in order, an explicit value,
  `LLM_BASE_URL`, a loopback `MAGPIE_ADDR` (URL or `host:port`), Magpie's wiring record, and
  `MAGPIE_ENDPOINT_DEFAULT` (`http://127.0.0.1:3425`). Each result carries its source and, for
  the wiring record, the file path.
- `readMagpieWiring` reads only `~/.config/magpie/stash.json`: an `lstat`-checked regular file
  of at most 1 MiB opened with `O_NOFOLLOW`, a bounded object, keys matching
  `^[A-Za-z0-9_.-]{1,64}\.wired_at$`, loopback HTTP values only, `claude.wired_at` preferred and
  the remaining keys sorted. A malformed, oversized, linked, non-loopback or absent record
  contributes nothing and never fails startup.
- `isRevokedMagpieCredential` recognises the application's `sk-magpie-revoked-` marker.
- `selectMagpieCredential(candidates, reload)` never returns a revoked candidate: it takes the
  first current one, and when every candidate is revoked it re-reads the client settings once
  through `reload` to pick up a rotation that landed after the first read. It reports revoked
  variable names only, never values.

`bin/litcode-magpie.mjs` wires the resolver before URL validation, so a configured or wired
Magpie needs no repeated `--base-url`. Candidate order is `LLM_API_KEY`, the inherited client
credential for the exact endpoint, then `ANTHROPIC_AUTH_TOKEN` for that endpoint. The selected
credential supplies `LLM_AUTH` from its own variable, not from an unrelated inherited value.
`--check` adds `baseSource`, `credentialSource` and `rotationRecovered`; pinned resume still
sets the endpoint and model first.

## Adaptations

- The wiring record is read from the same application directory the source uses, but only the
  endpoint is consumed. The caller-key file and the management API are not read or called.
- `MAGPIE_ADDR` and wiring values are restricted to loopback; an explicit or inherited gateway
  may be remote because the existing launcher validates its origin under the same rule.
- Only `stash.json` is inspected. Other Magpie state files, quotas and providers are untouched.
- The failure text names variables and the caller-key route, never a key value.

## Verification

`test/gateway-inherit.test.ts` adds endpoint tests (precedence, loopback gating, untrusted
wiring, deterministic key order) and four revoked-key cases (marker detection, fallback,
rotation re-read, all-revoked reporting). `scripts/smoke-magpie-launcher.mjs` now isolates
`HOME` and checks `MAGPIE_ADDR`, the wiring record, revoked-key fallback and all-revoked failure
without printing a key.

Results: focused tests 18/18, tsc 0, build 0, notices 0, launcher smoke passed, startup smoke
passed, identity `eac028a1…`.

## Residuals

- A real macOS cold start and caller-key issuance through `GET /api/caller-keys` remain the
  user's action and were not exercised.
- The rotation re-read is covered with an owned fixture; it was not exercised against a live
  Magpie rotating a real key.
- Wiring keys other than `claude.*` are accepted by pattern; only the observed
  `claude.wired_at` record was available for validation.
