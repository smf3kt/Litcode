# W30 Output-schema validation of MCP tool results

Status: verified finite output-contract chain on both transports. Date: 2026-10-12.
Task: a server declares a result contract for a tool -> a successful call must answer with structured
content -> that content must satisfy the contract -> otherwise the call fails with the recovered code
and message; a tool without a contract, and an error result, are passed through.
Entry: local only. There is no CLI flag; the behaviour follows the server's own `tools/list` declaration.
Targets: `src/json-schema.ts` (new: the bounded validator), `src/mcp.ts` (tool metadata, the result
check, the limits, standard-task resume), `src/mcp-http.ts` (the same check on the HTTP transport),
`src/runtime.ts` (the journaled tool name on task recovery), `test/mcp-output-schema.test.ts` (new).

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are
zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data.

- The tool declaration carries the contract, in both protocol eras: `outputSchema:_t({$schema:
  o().optional()}).optional()` at [7558,7611) and `outputSchema:u({type:C("object"),properties:ue(o(),
  e).optional(),required:A(o()).optional()}).catchall(oe()).optional()` at [28185,28305), with the
  predicate the client uses to notice one `function Ln(e){return Qo(e)&&Qo(e.outputSchema)&&
  Qn(e.outputSchema)}` at [43020,43089), in chunk-2rxk8n7w.js (SHA-256
  251b9444642e923022862625925ee3fe6c749f7fbdd79f7524fcea361f0a275a, 332939 bytes).
- The validator is **compiled once per catalog** and cached by tool name: `cacheToolMetadata(e){…for(let
  r of e){if(r.outputSchema){let s=this._jsonSchemaValidator.getValidator(r.outputSchema);
  this._cachedToolOutputValidators.set(r.name,s)}…}` at [29169,29612) and `getToolOutputValidator(e)
  {return this._cachedToolOutputValidators.get(e)}` at [29612,29682), in chunk-4vr415ka.js (SHA-256
  01c2a556237e9a957f29cd7de89b228439e6621ea982a0b5b0bd10be4cd20580, 156824 bytes).
- The **call path** applies it, with the two codes and the two messages:
  `let s=await this.request({method:"tools/call",params:e},r,n),h=this.getToolOutputValidator(e.name);
  if(h){if(!s.structuredContent&&!s.isError)throw new ei(fi.InvalidRequest,\`Tool ${e.name} has an output
  schema but did not return structured content\`);if(s.structuredContent)try{let y=h(s.structuredContent);
  if(!y.valid)throw new ei(fi.InvalidParams,\`Structured content does not match the tool's output schema:
  ${y.errorMessage}\`)}catch(y){if(y instanceof ei)throw y;throw new ei(fi.InvalidParams,\`Failed to
  validate structured content: …\`)}}return s` at [28392,28980); the streaming variant applies the same
  two rules and yields them as error events at [18978,19661).
- It is **product behaviour, not an unused SDK path**: the recovered tool call goes through it,
  `ut=await Je.callTool({name:n,arguments:r,_meta:it},{…,signal,timeout,onprogress:…})` at
  [179345,179435) in chunk-sb190ksj.js (SHA-256
  0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df, 198048 bytes).

These are source declarations, not runtime observation.

Classification: copy of the recovered result contract onto this runtime's own transports and its own
validator. `parseMcpToolResult` already refused a malformed result and already carried
`structuredContent` through to the model; what neither transport had was the declared contract, the
check itself, or any way to compare one.

## Deliberate rewrites

1. **The validator is bounded and dependency-free**, where the recovered client plugs in a full JSON
   Schema engine. `src/json-schema.ts` enforces type (single or union), enum, const, allOf, anyOf,
   oneOf, not, `$ref` to a local pointer, properties, required, additionalProperties, items (schema or
   tuple), minItems, maxItems, uniqueItems, minimum, maximum, exclusiveMinimum, exclusiveMaximum,
   multipleOf, minLength, maxLength and pattern, to depth 32. Every other keyword is ignored, which is
   what the specification asks of a validator that does not know a keyword, so a contract written only
   in the rest is accepted rather than guessed at. The connection's limits name the enforced list and
   the depth.
2. **One failure message instead of two.** The recovered client catches a validator throw separately
   and re-raises `Failed to validate structured content: <detail>`; this validator never throws
   outward (an internal fault becomes `could not be checked: <detail>` inside the mismatch message), so
   the second code path has nothing to report.
3. **The tool name is threaded, not guessed.** The recovered messages name the tool from the request
   the client already holds. Here the check runs inside `parseMcpToolResult`, so the call sites pass
   the name they called; the standard-task resume path had to carry it, which is why `resumeTask`
   gained a `toolName` argument, filled from the journaled entry (`task.tool`) rather than from the
   task handle, which does not name its tool.
4. **A changed contract fails the pinned check.** The pinned-metadata comparison now covers the
   declared output schema next to the input schema, so a server cannot swap a tool's result contract
   under a pinned tool without the call failing.
5. **An error result is only shape-checked.** The recovered rule skips validation when `isError` is
   set, because a server reports its own failures there; an error result still has to be a record with
   a `content` array, which `parseMcpToolResult` already enforced.

## Validation

- `npx tsc --noEmit`: clean. `npm run build`: clean.
- `npx tsx --test --test-timeout=20000 test/mcp-output-schema.test.ts`: 3/3 pass.
  - the validator itself: a satisfying object passes; an undeclared member, a fixed-value mismatch, an
    out-of-range integer, a missing required member, an over-long and a non-matching string, an empty
    and a repeating array, an `anyOf` miss, a `oneOf` count miss, an exclusive minimum, a non-multiple,
    a wrong nested type, a local `$ref` and a null where an object is required each produce their own
    message; an unknown keyword constrains nothing; the depth bound and a remote `$ref` both report;
  - stdio: a declared contract accepts matching structured content, refuses a successful result with
    none (`-32600`, exact message), refuses content that violates it (`-32602`, message ending in the
    violation), passes an `isError` result through and leaves a tool without a contract unchecked;
  - HTTP: the same contract refuses a body with an undeclared member and accepts a matching one.
- `npm test`: 1130/1130 pass (1127 before this package; the suite carries 3 output-contract cases).
- `npm run smoke:package`: `files 72, upstreamRequests 0`, all gates true.
- `npm run identity`: `f8dab8197b7d67f5bac099742e81eb76a8d2333a65ad30a97b0f1ff6948dbe94`
  (inputs 125, validation 92, build 65).
- `npm run notices:check`: unchanged, `installed 28`, sha256
  `6d025e66ae53c22228d4e4ddde35c1ec1d0cd45a1d40af6d00add122372c42f2`.
