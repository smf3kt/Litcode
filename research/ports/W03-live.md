# W03 real Magpie task acceptance

Date: 2026-10-11. Status: real existing-route task/resume verified; the gateway
management surface is located and read; the application cold start and
credential issuance through the application's own API remain unexercised, and
both are the user's action rather than a probe this review can make.

The user explicitly selected deepseek/deepseek-flash and a USD1 budget while
preserving existing routing and credentials. Read-only /v1/models confirmed
the model and native Messages endpoint. The live local Magpie application is
version0.1.1109 and listens on127.0.0.1:3425. The existing credential reference
was reused in process memory and excluded from logs/evidence.

A compiled CLI process requested one write_file call. The real model wrote
hello.txt with the expected bytes. Its first invocation exited2 at the explicit
one-model-call budget after persisting the paired tool result. A second process
resumed the same journal with --continue and exited0. Exactly two upstream
Messages requests returned200 (6400 and6780 body bytes, max512 output tokens).
The tool executed once; credentials were absent from the journal and locks
were released. The guard prevents a third model request and rejects bodies
above100000bytes, other models, thinking and larger output caps.

```
node scripts/accept-magpie-live.mjs --approved-usd-1
```

This paid entrypoint requires applicable approval on each new invocation.
Its fixture workspace and journal are removed after the acceptance receipt.
The first receipt read usage from the wrong journal field; the driver now uses
response.usage, but the removed first journal cannot substantiate usage. No
additional model request was made solely to fill that diagnostic. Actual billed
cost and Magpie custom pricing remain unverified. Official published peak
input/output rates imply a guarded worst-case estimate ofUSD0.0612288.

Evidence: W03-live-evidence.json contains exact receipt and content identity.
No route was changed, credential rotated or management service restarted;
this closes real task+resume acceptance only and does not close A02 in full.

Management surface, located 2026-10-12 (read-only): the gateway's own discovery
document advertises three management routes beside its model routes -
`/v1/magpie/quotas`, `/v1/magpie/quotas/history` and `/v1/magpie/route`. Reading
a route requires naming a session (`?session=<id>` or `X-Magpie-Session`); an
unknown session is answered with `{"route":null,"seq":0,"session":"<id>"}`, so a
route is a versioned per-session value rather than a gateway-wide setting. The
route path serves **GET only** - POST, PUT and PATCH all receive the gateway's
not-found message naming the model routes - so route switching is not a
management write at all: what remains on the routing side is observing a session's
route and the model-selection path that sets it. Credential issuance and
revocation are not on the gateway at all: a bounded negative search shows eight
plausible management paths answering 404 with the message that names the model
routes, and the advertised list holds exactly three management routes, none of
which issues or rotates a credential. Read-only inspection of the installed
application bundle finds where they do live - its own management API, with
`/api/caller-keys` and the caller-key prefixes `sk-magpie-key-` and
`sk-magpie-revoked-` - and finds that the application currently holds one
listening socket, `127.0.0.1:3425`, so that API travels with its window mode
rather than with a port. Exercising it is therefore the user's action, like the
cold start. The same inspection shows the gateway address and port are settings
(`MAGPIE_ADDR`, a Gateway port field defaulting to 3425), so the address this
project discovers is a configuration it reads. Every probe was a read or an
empty-bodied method probe that could not name a target, so nothing on the running
gateway was changed. Detail: [W03-management-discovery-evidence.json](W03-management-discovery-evidence.json).
