# W05 sampling block arrays

Status: verified finite array input chain. Date: 2026-10-12.
Task chain: MCP server sends mixed text/image array -> bounded wire validation -> pinned host arrays/images gates -> quoted ordered blocks with attachment indices -> native gateway count/completion -> text result -> resume fixed config -> managed/legacy denial before model work.
Entry: mcpClient.sampling=true and samplingArrays=true; image blocks additionally require samplingImages=true. Config field optional across session, overrides and managed schema; existing runtime/reload/CLI consumers preserve the object.
Targets: mcp-client-requests.ts wire types/validation, mcp-host.ts conversion, session.ts pinning and existing smoke driver --arrays.

## Provenance and choice

Original artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Digest-verified inert schema module chunk-3d69zma1.js SHA-256 efb80057e2fa0526d212ff27e36f3ca3ff97b8e232a3ca41b4446e5c9dd93bb9. Source coordinates zero-based UTF16/end-exclusive: Ot[9032,9053) text/image/audio union; Nt[9081,9146) user/assistant with single/array content; It[9147,9449) request params; f7n[9450,9510) sampling/createMessage; sWe[9511,9619) basic single-block result. Source inspected as data, no recovered entrypoints run.

Wire shape: adapt recovered single-or-array union to owned strict types/validation. Host conversion: rewrite extension of already-owned image conversion; no recovered provider converter was established. Preserve singleton shape verbatim, mapping array elements in order and images to1-based attachment index/native blocks. Recovered schema also includes tool content/metadata/array outputs not selected here. Existing header detector remains reused, not a new original-code port.

## Bounds and differences

Entire request32KiB, at most128blocks summed across all messages; empty/nested arrays rejected before callbacks. This explicit aggregate count also bounds requests composed of more than128single messages (tightened finite contract). Transport trusted callbacks accept protocol media shapes; built-in host accepts text and gated validated PNG/JPEG/GIF/WebP, with canonical base64/MIME/header checks. Unsupported audio/malformed image and disabled array/image gate produce zero provider work.

Quoted JSON preserves roles/text/image MIME/order; native image list preserves encounter order and exact bytes. Text-only arrays stay one quoted text message, no host-history/tools/credentials. Provider count gets cloned identical content; fixed model/output/budget/cancellation/approval mutation protections reused. Output still a single text block; array output/audio/tools/content metadata/full pixel decoding not implemented.

## Validation and delivery

Three new combined regressions: host mixed order/multiple image indices/gates/bounds/approval mutation/preabort; actual CLI fixed resume/budget/legacy/managed; one dual-transport array fixture with invalid arrays failing before callback. Initial focused48/48 passed before third fixture. New fixture initially compared null-prototype inert callback values to ordinary literals; corrected assertion compares JSON data. Final dual-transport19/19 passed (1583.101ms).
Compiled CLI --arrays passed7owned gateway requests with order/bytes/pinnedresume/managed/legacy/budget and clean locks;0paidcalls. Package fixture once read empty PID marker before writer finished; readiness now waits nonempty marker, product launcher unchanged. Final full1034/1034, fail/cancel/skip0,44505.354042ms; check/build exit0,59file installed package passed. Source186files offlineinstall/check/build yields52build files byte-identical; archives release/sampling-arrays-runtime and release/litcode-source-sampling-arrays. Final full baseline, offline install, source rebuild and identities: [W05-sampling-arrays-evidence.json](W05-sampling-arrays-evidence.json). Failures are retained with final receipts.

Remaining local MCP gaps: standardtasks/result, background durable task reattachment, audio sampling, full park/refetch and event replay. Complete TUI and historical source ownership audit remain separate.
