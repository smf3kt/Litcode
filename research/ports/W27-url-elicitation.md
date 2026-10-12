# W27 URL elicitation and the completion notice

Status: verified finite URL-elicitation chain and completion notice. Date: 2026-10-12.
Task: an MCP server asks the person for input -> the request may be a form or a URL -> a URL request is shown,
answered accept/decline/cancel without collected data, and the server's later confirmation of that
elicitation reaches the session as a notice.
Entry: `--mcp-elicitation` (or `mcpClient.elicitation`), interactive only, as before.
Targets: `src/mcp-client-requests.ts` (the parameter union, URL validation, capability, result rule and the
completion observer), `src/mcp.ts` and `src/mcp-http.ts` (notification routing), `src/runtime.ts` (the
per-turn completion sink), `src/interactive.ts` (the URL display), `src/hooks.ts` (the two hook payload
fields), `test/mcp-client-requests.test.ts`, `test/mcp-form-ownership.test.ts`, `scripts/smoke-mcp-form.mjs`.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data.

- The request is a **union of two members**, not one shape with an optional mode: the form member
  `Ft=z.extend({mode:C("form").optional(),message:o(),requestedSchema:u({type:C("object"),…})})` at
  [11022,11162) in chunk-3d69zma1.js (SHA-256 efb80057e2fa0526d212ff27e36f3ca3ff97b8e232a3ca41b4446e5c9dd93bb9,
  13458 bytes) and the URL member `m7n=z.extend({mode:C("url"),message:o(),elicitationId:o(),url:o().url()})`
  at [11162,11235), combined by `Ht=Ue([Ft,m7n])` at [11235,11252) and requested by
  `QOe=n.extend({method:C("elicitation/create"),params:Ht})` at [11252,11342).
- Completion is a **separate notification with its own param**: `$t=i.extend({elicitationId:o()})` and
  `Jyt=r.extend({method:C("notifications/elicitation/complete"),params:$t})` at [11342,11414).
- One **result schema serves both members**: `ZOe=a.extend({action:U(["accept","decline","cancel"]),content:…})`
  at [11415,11549) - so the recovered result may carry scalar or string-array content in either mode.
- The dispatcher **defaults the mode**: `let Pe=Z.params.mode==="url"?"url":"form"`, takes `url` only when
  mode is url and the key is present, takes `elicitationId` the same way, then calls the host handler and the
  result hooks, at [283923,285177) in chunk-rx2nah4x.js (SHA-256
  cfb79b3b3d580f450f8184e5873a686eb083e9ea3abd4e0a58268425de6acc51, 691306 bytes). The same span wires the
  notice: with `completions==="forward"`, `onMcpElicitationComplete` turns a completed id into
  `MCP server "<server>" confirmed elicitation <id> complete` plus a system event carrying
  `subtype:"elicitation_complete"`, `mcp_server_name` and `elicitation_id`.
- The host handler **carries the mode and the URL to the UI** and answers the person's choice:
  `async handleElicitation(e,s,n,r,o,m,h,R,v=!1)` at [40634,41493) in chunk-mkyr1xcw.js (SHA-256
  d71fcdeb09513e8ffb3b16fdece0710ff230d774c5fc55940f5ec538d4cd1a22, 46820 bytes) returns
  `{action:"cancel"}` when the host does not answer elicitations, when input is closed or the signal aborted,
  publishes a pending action, and then `sendRequest({subtype:"elicitation",mcp_server_name,message,mode,url,
  elicitation_id,requested_schema,title,display_name,description})` at [41208,41493).
- The **hook contract** names both fields: the event schema in chunk-r2vtj1kh.js (SHA-256
  2b13302b83beea3fe54e83316b9d855c43e2298af6d0041b009cec563bbc1515, 664290 bytes) carries
  `mode:U(["form","url"]).optional(),url:o().optional(),elicitation_id:o().optional()` for `Elicitation` and
  `mode` plus `action` for `ElicitationResult`, "Hooks can auto-respond (accept/decline) instead of showing
  the dialog". The construction that fills them is `{…,hook_event_name:"Elicitation",mcp_server_name,
  message,mode,url,elicitation_id,requested_schema}` at [2934268,2934672) in chunk-sfn1dbxq.js (SHA-256
  4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da, 4762583 bytes).
- A hook may **answer before the dialog**: chunk-nejdhvxk.js [1983,2455) and chunk-3sr3513w.js [1934,2406)
  (SHA-256 16f3e340a1a75277d62240cfe94b2cdcac4d76b3e77eaacb62907f78a6c93160 / cf9586ef5de07cc0da728fd04cd1c216e6640f14d8473188919c0c6f16085f1b)
  read `mode` and pass `url` and `elicitationId` through to the hook, and return the hook's
  `{action,content}` when it produced one.
- The CLI side rebuilds the same fields when a hook answers: `mode:n.mode,url:n.url,
  elicitationId:n.elicitation_id,requestedSchema:n.requested_schema,…` at [36464,36772) in chunk-xxx7vgzn.js
  (SHA-256 b6345680b8f748673353d5e22b6d63f2b8ff8dc4bf38a17536fa24a70cacb2be, 75989 bytes).

These are source declarations, not runtime observation.

Classification: copy of the recovered request union, completion notification and hook fields onto the
elicitation surface this runtime already owns. `src/mcp-client-requests.ts` already validated the form
member, advertised `elicitation:{form:{}}`, dispatched `elicitation/create` through a bounded callback and
validated the result against the requested schema; what it did not have was the second member, the
completion notification, and the two hook fields, and its own limits string said so in as many words
("no URL elicitation").

- **A union type rather than a mode flag.** `McpElicitationParams` becomes
  `McpElicitationFormParams | McpElicitationUrlParams`, so a caller that reads `requestedSchema` cannot
  compile without first narrowing on `params.mode === "url"` - the same rule the recovered member union
  enforces at the schema level.
- **`url` is checked with `new URL`, and control characters are refused.** The recovered member is
  `o().url()`, which is `new URL()` succeeding; nothing there restricts the scheme. This runtime prints the
  URL for the person to open rather than handing it to a window, so the one addition is a refusal of
  C0/C1 control characters, which could otherwise rewrite the terminal line it is displayed on.
- **`elicitationId` must be non-empty.** The recovered member requires a string; an empty one cannot be
  correlated with a later completion notice, so it is refused here. `message` is checked exactly as the
  form member checks it.
- **URL mode accepts no result content.** The recovered result schema is mode-independent and would allow
  scalar or string-array content, but this runtime's result is a schema-validated object map and URL mode
  has no schema to validate against, so `content` is refused rather than passed through unchecked.
- **Both modes are advertised whenever an elicitation callback is registered.** The recovered host decides
  per request and answers `{action:"cancel"}` when it will not serve one; this runtime keeps that shape
  instead of adding a second capability gate.
- **The notice is observed, never answered, and holds no state.** The recovered client forwards the id to
  the session; nothing correlates it with the request that started it, so an unknown or malformed id is
  discarded silently, and the sink belongs to the turn that owns the elicitation UI (no owner, no notice).
- **The person opens the URL.** The recovered host hands the URL to its window; this terminal surface shows
  it and reads `:accept`, `:decline` or `:cancel`, so the three answers are the same and the opening step
  is the person's.

## A broken smoke driver found on the way

Running `scripts/smoke-mcp-form.mjs` to validate this package showed it had stopped exercising anything:
its server was declared in the checkout's own `.harness/settings.json`, which the project-declared-server
admission (W12) holds unconnected until a person answers, so the CLI never contacted it and the model
fixture's tool call failed silently. The pre-change driver fails the same way on the previous commit, so
this was not caused by this package. Nine further drivers declared a server the same way -
`smoke-mcp-stdio-redial`, `smoke-mcp-list-changed-cli`, `smoke-mcp-logging-cli`, `smoke-mcp-startup-cli`,
`smoke-mcp-persistence-cli`, `smoke-mcp-reconnect-cli`, `smoke-mcp-recovery-cli`, `smoke-mcp-tasks` and
`smoke-plugin-components` (which passes, its server comes from an installed plugin's own config) - and each
now declares that server in the user layer, which is configuration rather than a decision, leaving
permissions, features and hooks where they were. Every one passes again in source and compiled form. The
drivers that specifically test the decision itself (`smoke-mcp-approval-cli`) are untouched.

## Validation

- Full suite 1119/1119, fail/cancel/skip 0 (the two new per-transport cases; 1116 before). `tsc --noEmit`
  and `tsc -p tsconfig.build.json` clean.
- Two added per-transport cases in `test/mcp-client-requests.test.ts`: a URL request reaches the callback
  with exactly the recovered parameters and is answered `{action:"accept"}`; a malformed or empty
  `elicitationId` and a completion notice with one are dropped; a URL answer carrying content is refused
  with `-32603`; the capability object is `{form:{},url:{}}`.
- One added case in `test/mcp-form-ownership.test.ts` drives the real interactive loop over a real runtime
  against a fixture HTTP server: the URL is displayed, `:accept` answers it with no content, and the
  server's `notifications/elicitation/complete` reaches the session as
  `MCP server "fixture" confirmed elicitation elicit-1 complete`.
- `npm run smoke:mcp-form` now exercises both modes through the real CLI with the two elicitation hooks
  enabled: the form refuses `{"label":42}` and re-asks, accepts `{"label":"selected"}`, the URL is answered
  `{action:"accept"}` with no content, the completion notice is forwarded, and both hook events are in the
  journal. Zero model calls were spent outside the fixture.
- Re-run after the driver fix (all in source form unless noted): `smoke:mcp-form`, `smoke:mcp-stdio-redial`
  (+`--compiled`), `smoke:mcp-list-changed-cli`, `smoke:mcp-logging-cli`, `smoke:mcp-startup-cli`,
  `smoke:mcp-persistence-cli` (+`--compiled`), `smoke:mcp-reconnect-cli` (+`--compiled`),
  `smoke:mcp-recovery-cli` (+`--compiled`), `smoke:mcp-tasks`, `smoke:mcp-approval-cli`,
  `smoke:mcp-subscriptions`, `smoke:mcp-notification`, `smoke:mcp-logging`, the three sampling smokes and
  `smoke:plugins`.
- `npm run smoke:package` passed, 70 files and 0 upstream requests. Identity: 123 input / 90 validation /
  63 build files, merged `06d67404307e3163030289f88fecae5940b0764f5b6482599ae3782433dbc966`.
- No paid model call and no external service was contacted; the interactive URL test opens nothing, and the
  `https://example.invalid/` fixture is never fetched.

Detail and coordinates: [W27-url-elicitation-evidence.json](W27-url-elicitation-evidence.json).
