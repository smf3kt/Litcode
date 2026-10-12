# W28 Progress tokens and the tool-call idle deadline

Status: verified finite progress-token chain in both transports, with the recovered host-side half
recorded as no-local-surface. Date: 2026-10-12.
Task: a tool call that names a progress token stays alive while the server reports on it -> a report
moves that call's idle deadline -> the call's total deadline is never moved by progress -> a call that
goes quiet is cut off at the idle deadline -> a report naming a token no open call owns is dropped.
Entry: local only. `connectMcpServers(..., { toolIdleTimeoutMs, onProgress })` and
`createRuntime(..., { mcpProgress })`; there is no CLI flag, because the recovered opt-in is per call,
not per session.
Targets: `src/mcp-progress.ts` (new: payload bounds, token registry), `src/mcp.ts` and `src/mcp-http.ts`
(token issuance, routing, idle/total deadlines, limits), `src/runtime.ts` (the host observer),
`test/mcp-progress.test.ts` (new).

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are
zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data.

- The token is **minted only for a call that passes a progress handler**, and the token is that call's
  own request id: `b=this._requestMessageId++;m=b;let p={...t,jsonrpc:"2.0",id:b};if(s?.onprogress)
  this._progressHandlers.set(b,s.onprogress),p.params={...t.params,_meta:{...t.params?._meta,
  progressToken:b}}` at [107335,107522) in chunk-2rxk8n7w.js (SHA-256
  251b9444642e923022862625925ee3fe6c749f7fbdd79f7524fcea361f0a275a, 332939 bytes).
- The **idle and total deadlines are separate**, and only the idle one moves:
  `_setupTimeout(e,t,r,s,a=!1){this._timeoutInfo.set(e,{timeoutId:setTimeout(s,t),startTime:Date.now(),
  timeout:t,maxTotalTimeout:r,resetTimeoutOnProgress:a,onTimeout:s})}` and
  `_resetTimeout(e){…let r=Date.now()-t.startTime;if(t.maxTotalTimeout&&r>=t.maxTotalTimeout)throw
  this._timeoutInfo.delete(e),new Ms(As.RequestTimeout,"Maximum total timeout exceeded",…);
  return clearTimeout(t.timeoutId),t.timeoutId=setTimeout(t.onTimeout,t.timeout),!0}` with
  `_cleanupTimeout(e)` following, at [99525,100162).
- A report **resets that call's deadline before it is handed on**, and a token with no open call is an
  error, not a notice: `_onprogress(e){let{progressToken:t,...r}=e.params,s=Number(t),
  a=this._progressHandlers.get(s);if(!a){this._onerror(Error("Received a progress notification for an
  unknown token: …"));return}let n=this._responseHandlers.get(s),i=this._timeoutInfo.get(s);
  if(i&&n&&i.resetTimeoutOnProgress)try{this._resetTimeout(s)}catch(l){…n(l);return}a(r)}` at
  [104895,105342); settling retires the token in `_onresponse`, which deletes the response handler,
  cleans the timeout and deletes the progress handler at [105342,105691).
- The **wire payload** is `Is=u({progress:v(),total:Ii(v()),message:Ii(o())})` and
  `Os=u({...$e.shape,...Is.shape,progressToken:br})` sent as
  `Ir=Ee.extend({method:C("notifications/progress"),params:Os})` at [4202,4362), over the token union
  `br=Ue([o(),v().int()])` at [1506,1528) and the request-envelope `_meta` schema
  `zr=_t({progressToken:br.optional(),…})` at [1583,1640).
- The bundled **ingress validator accepts a string or a number** token and drops the whole message
  otherwise: `let{progressToken:i}=t;if(i!==void 0&&typeof i!=="string"&&typeof i!=="number")return!1`
  at [3248,3505) in chunk-wa0p9jsy.js (SHA-256 bd98636ce7f5a80ff10498e87c2591308d5a85502a634a9acbdde35c4c1294c9,
  3812 bytes).
- The recovered host **opts in on every tool call and asks the SDK to keep the call alive**:
  `S={result:await Yro(b,{method:e,params:L(h)?{...r,_meta:{...h,progressToken:void 0}}:r},
  a?{signal:s,timeout:d.getMcpToolIdleTimeoutMs(b.config)||M,maxTotalTimeout:M,
  resetTimeoutOnProgress:!0,onprogress:function(){}}:{signal:s,timeout:$a()})}` at [38215,38456) in
  chunk-qtksmp3x.js (SHA-256 3f6f874b3563c30d289f53ada3f36a86ef29ae0b85c44a7cdca4f87df021c491, 61379
  bytes) - the caller's own `_meta` is forwarded with `progressToken` cleared, because the SDK mints its
  own token for the call.
- The host side of the same surface treats a caller's token as **the destination for streamed output**:
  `let g=n.reportProgress;if(g===void 0)throw Error("RunMonitorCommand was not run: the call sent no
  progress token, so the command's output would have nowhere to go. Call again with
  _meta.progressToken set.")` at [47466,47748), and the emitter that feeds such a caller reports a
  non-decreasing progress with a 30-second heartbeat: `var ye=30000;function Y(S,O,k=ye){…let
  L=(n,N)=>(R=n>R?n:R+0.001,O({method:"notifications/progress",params:{progressToken:S,progress:R,
  message:N}})),E=setInterval(()=>{U+=1;let n=U*k/1000;L(n,`Running for ${n}s`)…},k)…}` at
  [2244,2670) in chunk-5vztnqym.js (SHA-256 5548bf5b0067da3532d136c37be2f0d1c473df382c6438a00a9180456d701cc3,
  12637 bytes).

These are source declarations, not runtime observation.

Classification: copy of the recovered per-call progress contract onto transports this runtime already
owns. Both transports sent plain requests with one deadline and knew nothing about
`notifications/progress`; what they did not have was the per-call token, the routing of a report back to
its call, and the split between a movable idle deadline and a fixed total one.

## Deliberate rewrites

1. **The token is a string this runtime mints** (`litcode-progress-<n>`) rather than the SDK's numeric
   request id. The recovered payload schema allows a string or an integer, and the ingress validator
   still accepts both, but only a string can name one of this runtime's calls, so a numeric token is
   dropped instead of matched. Tokens are per call and never handed out twice on a connection.
2. **The observer is real**. The recovered host passes `onprogress:function(){}` in this path - it wants
   the watchdog reset and discards the payload. The port keeps the reset and additionally reports the
   bounded update to a host-owned observer (`onProgress` on the connection, `RuntimeOptions.mcpProgress`
   on the runtime), so the same notification can drive a caller's own display.
3. **An unknown or stale token is dropped, never raised.** The recovered client calls `_onerror` with
   "Received a progress notification for an unknown token"; in this runtime's transports a reported
   error counts towards the disconnect threshold and could take down a healthy server because one late
   report arrived after its call settled. The limits state the drop.
4. **Bounds before dispatch**: a token over 128 bytes, a non-finite `progress`/`total` or a message over
   4096 bytes makes the whole notification inert. The recovered schema validates the same fields but
   bounds no lengths; this runtime caps them the way it caps other inbound text.
5. **The host-side half has no local surface and is not ported.** A caller-supplied
   `_meta.progressToken` is the recovered monitor's output destination, so a call without a token is
   refused. This runtime's `monitor` streams stdout lines into its own bounded notification queue read
   with `read_notifications`, and a WebSocket monitor emits one event per frame, so no local call can be
   starved of somewhere for its output to go; there is nothing to refuse and no token to demand.
6. **The HTTP transport builds its own settings object**, so both new options had to be listed in that
   literal. They were not, and the HTTP half was silently inert until the runtime test caught it - see
   the defect section.

## Found and fixed while landing this package

`McpHttpClient` does not take the shared `McpConnectSettings`; it takes raw `McpConnectOptions` and
rebuilds `this.settings` from a fixed field list, which is why `toolIdleTimeoutMs` and `onProgress`
reached the stdio transport and never reached HTTP. Both fields are now in that literal, with a comment
saying a field missing from it is dropped even when the caller set it. `positiveLimit` was added to
`src/mcp-http.ts` so both transports validate the idle deadline identically.

## Limits surfaced on every connection

`MCP_PROGRESS_LIMITS` is spread into both `MCP_PROTOCOL_LIMITS` and `MCP_HTTP_LIMITS`: opt-in per call,
one token per call retired when the call settles, the two bounds, and the rule that a report moves the
idle deadline while the total deadline keeps running.

## Validation

- `npx tsc --noEmit`: clean. `npm run build`: clean.
- `npx tsx --test --test-timeout=20000 test/mcp-progress.test.ts`: 8/8 pass.
  - payload bounds, including a 129-byte token, a non-finite `total` and a 4097-byte message;
  - registry isolation, delivery to the owning token only, and retirement on settle;
  - stdio: a call carrying a token survives three reports 40ms apart under a 60ms idle deadline and
    finishes inside its total deadline; the reports arrive in order with their messages;
  - stdio: a server that ignores its token is still cut off at the idle deadline (`timed out after
    60ms`);
  - both transports: the idle deadline never moves past the total deadline (reporting every 40ms under
    `requestTimeoutMs: 90`, `toolIdleTimeoutMs: 60` still ends at 90ms);
  - both transports' limits lists carry the progress contract;
  - HTTP: a token is sent in `_meta` and the call's own SSE stream routes three reports back;
  - runtime: `createRuntime(..., { mcpProgress })` is rebuilt from the runtime's own configuration, the
    observer receives both reports of the one call, and the tool result still reaches the session.
- `npm test`: 1127/1127 pass (1119 before this package; the suite carries 8 progress cases).
- `npm run smoke:package`: `files 71, upstreamRequests 0`, all gates true.
- `npm run identity`: `068753af6eaab1a8301353bee18bc53827984ee499cc10cd8daabf5c04a3a4ce`
  (inputs 124, validation 91, build 64).
- `npm run notices:check`: unchanged, `installed 28`, `missingText ["@esbuild/darwin-arm64",
  "standardwebhooks"]`, sha256 `6d025e66ae53c22228d4e4ddde35c1ec1d0cd45a1d40af6d00add122372c42f2`.

No CLI flag was added, so the runtime test above is the highest available integration point: the
runtime is the product's only caller of `connectMcpServers`.
