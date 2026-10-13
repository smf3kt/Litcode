# W34 Inheriting a gateway from an installed client's configuration

Status: verified locally on macOS with Node v26.10.0, including a stripped-environment run of the
globally installed bin. Date: 2026-10-13.
Task: a person who already configured another Messages-protocol client on this machine should not
have to state the same gateway, credential and model again; `litcode` should track that client's
configuration by default.
Entry: `litcode`, `litcode-magpie`. Targets: `src/gateway-inherit.ts` (new), `src/cli.ts`,
`bin/litcode-magpie.mjs`, `test/gateway-inherit.test.ts` (new), `test/cli.test.ts`, `README.md`.
No recovered sample module is involved: this is local product surface, not a port.

## What it reads, and what it refuses to

The client settings file is read as data: its `env` block and its top-level `model`, nothing else.
The directory is `LLM_INHERIT_DIR`, else the client's own configuration-directory variable, else
`~/.claude`. The process environment fills any field the file does not name.

| Field | Client variables | Used as |
| --- | --- | --- |
| endpoint | `ANTHROPIC_BASE_URL` | `gateway.baseURL` |
| model | `ANTHROPIC_MODEL`, else the file's `model` | `config.model` |
| credential | `ANTHROPIC_AUTH_TOKEN` (bearer), else `ANTHROPIC_API_KEY` (api-key) | the provider credential, and the default `auth` |

Bounds and refusals, all of which resolve to "contribute nothing" rather than a startup failure: a
file over 1 MiB, a file that is not a regular file, malformed JSON, a non-object document, a
non-string or blank value, a value carrying a control character, a value past its length bound
(credential 8192, URL 2048, model 256), an endpoint that is not an absolute `http`/`https` URL, and
an `env` block past its entry bound. No other file is consulted: the client's own credential store,
its session records and any authorization flow are out of scope, which is what "OAuth is excluded"
already required.

## Precedence, and the endpoint rule

For a new session the chain is a flag, then this harness's `LLM_*` environment, then this harness's
own `settings.json`, then - only where all of those are silent - the client configuration. A resumed
session keeps its pinned endpoint and takes only the credential from inheritance, matched against
that pinned endpoint.

A borrowed credential is used **only for the endpoint the client itself named** (`sameGateway`
compares origin plus path with trailing slashes removed). `--base-url` pointing anywhere else means
the credential is not borrowed at all, and the failure names both endpoints - which is a fact the
person needs and not a secret. This is the rule the launcher already applied to
`ANTHROPIC_AUTH_TOKEN`; it is now one implementation instead of two.

Reporting is one stderr line naming the variable and the file per field:
`gateway: inherited credential from ANTHROPIC_AUTH_TOKEN in …/settings.json; base URL from
ANTHROPIC_BASE_URL in …/settings.json; model from model in …/settings.json`. No value is printed
anywhere, and no credential enters the session configuration or a journal - the session keeps
recording only `baseURL`/`auth`, as before.

## Deliberate rewrites

1. **The token variable wins over the key variable** when a source sets both. A deployment gateway
   carries its credential in the token variable; the key variable is the first-party path. Nothing
   in either client records which one is authoritative when both are present, so the choice is
   stated here and `LLM_AUTH`/`--auth` overrides it.
2. **The default `auth` now follows the credential.** `bearer` was the unconditional default; a
   borrowed key-variable credential would be sent in the wrong header, so the default comes from the
   variable the credential was read from, and `gateway.authDefault` disappears the moment any
   explicit value exists.
3. **A client that names a credential but no endpoint contributes nothing.** With no explicit
   endpoint its own endpoint is the vendor default, which is not this harness's loopback gateway;
   borrowing there would send a credential to a host it was not issued for.
4. **The launcher shares the reader** instead of keeping its own environment-only comparison. It
   imports the compiled reader and falls back to the previous environment-only behaviour when no
   build is present, so a source checkout without `dist/` still runs.

## Validation

- `npx tsc --noEmit`: clean. `npm run build`: clean.
- `test/gateway-inherit.test.ts`: 11/11 pass - file-supplied fields with their reported sources; the
  key variable vs the token variable; file-over-environment precedence with environment fill; a
  top-level `model`; disabled, empty, malformed, non-object, directory-in-place-of-file, oversized,
  blank, control-character, non-URL and wrong-scheme inputs all contributing nothing; the directory
  search order; endpoint comparison including trailing slash, case, path difference, scheme
  difference and a non-URL; and two resolutions of the same file agreeing while sharing no object.
- `test/cli.test.ts`: 14/14 pass, four new - a live run takes gateway, credential and model from the
  client configuration and never prints the value; an explicit `--base-url` refuses the borrowed
  credential by name while this harness's own key ignores inheritance entirely; `--no-inherit-gateway`
  and `LLM_INHERIT_GATEWAY=false` both restore the missing-credential error, and the two flags
  together are refused; a resumed session borrows for its pinned endpoint. The shared test helper now
  sets `LLM_INHERIT_GATEWAY=false` so a developer's own client configuration cannot reach unrelated
  cases.
- `npm test`: 1148/1148 pass (1133 before this package).
- End to end with a stripped environment: `env -i PATH=… HOME=… TERM=xterm litcode` on a PTY, with no
  `LLM_*` or `ANTHROPIC_*` variable present at all, printed the inherited-source line for all three
  fields from `~/.claude/settings.json`, opened the session and exited on `/exit` with 0 model calls.
  No live model call was made in this package.
- `npm run smoke:package`: `files 74, upstreamRequests 0`, all gates true (the package grew by the
  compiled reader).
- `npm run identity`: `47a942eb869557ef3c8d71b80c2f99fbc650d1cdfb3455bfc1c6478d62d47fb2`
  (inputs 126, validation 93, build 66).
- `npm run notices:check`: exit 0, `installed 28`, sha256
  `6d025e66ae53c22228d4e4ddde35c1ec1d0cd45a1d40af6d00add122372c42f2`; the advisory
  `missingText` list for two optional packages is unchanged and `THIRD_PARTY_NOTICES.txt` is not
  modified.
