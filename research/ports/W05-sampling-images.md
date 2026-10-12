# W05 sampling image input

Status: verified finite image-input chain. Date: 2026-10-12.
Task: MCP sampling/createMessage image -> optional host approval -> provider count/shared budget -> native Messages image -> bounded text result -> fixed-config resume; absent/managed-false gate makes zero sampling provider calls.
Entry: mcpClient.sampling=true and samplingImages=true in authored settings; runtime host callback factory retains config snapshot. Managed policy and session schemas accept optional samplingImages; absent/false preserves text-only behavior.
Targets: mcp-host.ts, media.ts, session.ts; existing runtime/CLI consumers propagate mcpClient.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Inert source schema module chunk-3d69zma1.js SHA-256 efb80057e2fa0526d212ff27e36f3ca3ff97b8e232a3ca41b4446e5c9dd93bb9 verified from extracted bytes. All ranges are zero-based UTF-16, left-closed/end-exclusive: T[5050,5142) base64 atob; O[6590,6687) image; N[6688,6785) audio; Ot[9032,9053) union; Nt[9081,9146) role and single/array block; It[9147,9449) sampling params; f7n[9450,9510) request; sWe[9511,9619) result. These are source declarations, not runtime observation.

Classification: rewrite of provider conversion; direct recovered provider-image conversion was not established in the bounded read. The existing owned media.ts imageInfo detector is reused unchanged except export visibility, and native base64 image fields match installed SDK documentation. Recovered schema permits audio/arrays/metadata/tools; this package selects single image input and text output to preserve existing host isolation and budget contracts. No recovered entrypoint executed.

## Contract and boundaries

Strict input shape, entire32KiB JSON cap, canonical base64 roundtrip, allowlisted MIME and existing container header/dimensions must pass before approval/count/complete. PNG/JPEG/GIF/WebP accepted; MIME mismatch/malformed base64/invalid header/audio fail without provider work. Decoder inspects metadata only: complete pixel validity, CRC, decompression/resize and huge declared pixel areas remain unverified. No URL/path reads or image transcoding.

Server systemPrompt/roles become quoted JSON; each image is replaced in that JSON by MIME and1-based attachment index and supplied as a native user image block. Text-only payloads keep their exact former shape. Count and completion use equal cloned request content, host-fixed model/maxTokens/effort, tools:none, and shared budget. Approval mutation cannot change it; existing abort/deadline/concurrency/output checks remain. Replies are text only and sampling image bytes are not copied into parent session journals.

## Validation

Two added tests: combined host gate/validation/native bytes/approval mutation/pre-abort and actual CLI pin/resume/budget/legacy/managed chain. Source host+CLI28/28 (4162.162625ms); compiled actual chain7owned gateway requests,0paid requests, exact image digest153cf6c9a526a63053a37b10234c2fd85df38887c2dc0a800d90abfa6631d01c, locks released and credentials absent. Full1029/1029, fail/cancel/skip0 (42729.376042ms); npm run check/build exit0. Offline installed package58files passed. Detailed identity and receipts: [W05-sampling-images-evidence.json](W05-sampling-images-evidence.json). Previous persistence/delivery records retain their identities.

## Next source-backed task package

Foreground MCP tasks are ready for copy/adapt research: chunk-f79f00pg.js SHA-25673d50b557ed49b7de0783b46a8f6804d5c45068cd92317c413d821948032b421, ojr/driveMcpTask UTF16[3621,7532), hyt[3012,3064), classifiers[3064,3581), task schemas[968,1451), input/status[2297,2925). App chunk-sb190ksj.js SHA-2560a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df; co[176157,190043), foreground ie[181833,182950), hd[174994,175303), Si[175303,176157), all UTF16. Core observed clamp250..30000ms/default2000, five consecutive failures, sixteen input keys and cached update retries. This is a resultType/tasks-update/inline-terminal extension; standard SDK tasks-result is distinct. No task implementation or acceptance is claimed in this image package.
