# C7 local peer transport source investigation

Date: 2026-10-18. Read-only peer report. No product edits, external calls or recovered entrypoint execution. Verify exact source bodies again before implementation. All coordinates are zero-based UTF-16 half-open. Record/key helper coordinates include the investigator's final AST correction.

## Verified module identities and observations

chunk-6zdc3jq1.js SHA256 8009c180a36973dc5853feebabd9653728bb5a902f3f27aa36cd883187ca3e9a.

- q [17953,18154): 250 ms local socket probe; EBUSY treated live.
- F [18299,18568): numeric JSON record enumeration.
- G [18568,20657): canonical PID filenames, bounded reads, typed fields. Torn live record reread once; PID birth/file mtime compared; invalid live record yields typed EBADRECORD.
- Z [21883,22142): present/gone/recycled PID state. Foreign PID domain remains present; own domain checks process start identity.
- Sao [22142,22608): exclude self, spare/parked records (ee [23041,23100)); combine socket and process identity. Sweep only permitted dead same-domain records. Preserve foreign or live identities.
- we [15535,17953): validate local endpoint, find auth key, bounded newline JSON, optional noFollowSymlink, 5 s timeout. Expected PID requires native peer PID/UID and optional process start before sending. Native Bun.ant peer boundary [1851,2705).

chunk-m7864yc0.js SHA256 190465da91f131a8ccd7708ae318757359ebe9f53bc32819af73a29209babe6e. oV [4852,4892) joins userDir/sessions. STs [5232,5505) publishes per-PID socket-hash key, mode 0600 under 0700 directory, containing peerToken/process identity/pidDomain. bTs [6473,6592) removes owned key; wTs [6592,7933) completes the key lifecycle. These coordinates were corrected by the investigator's exact AST pass.

chunk-akfkn8xh.js SHA256 dcae213f12d26a84eface39176fff4ed4a0cb63f83e6a3f32336dd6ca0ad36d0. GTs [1155,1624) projects cwd/start/kind/session/status/pidDomain, with exact AST range supplied by the investigator.

chunk-w9kaj2q7.js SHA256 c9f40c6995b02e693505c0f8c86273286f00a7b85187d878cb69e8f21d5d380e. ajr [1484,2566) projects local records to uds transport/address. Cloud/bridge/DID excluded by local-only requirement.

chunk-bt8cr7rw.js SHA256 5fa6b57b2b362f4047324577cee8ca6263304332d36ea8389f2cf911f2213667.

- nn [12376,14664): first-line deadline, bounded newline/final-fragment parser, first-frame auth, peer PID/start, serialized processing Je [11877,12278).
- Qe [5180,6744): text validation/loop guard, session.receive before queue, verified peer origin, isMeta/skipSlashCommands/skipAttachments, admission.
- mn [28327,34716), setup [29793,31650): mode0600 socket, auth publication precedes advertised endpoint; failed publication closes auth-required inbox.
- j [15004,15363): destroy clients, close server, expire held messages/idle notices, await processing, unlink owned socket/key, clear secrets through Y [15363,15599).

chunk-0ydceggj.js SHA256 ca1c4ce2ce4d84bd24cca5d1a2f7f8eb2e732d046edd178b8d8f4facf50db341. E [4491,4991): explicit policy first, self accept, unknown mode hold, asserted matching mode accept/mismatch hold, absent assertion bypass recipient holds and normal recipient accepts. R [6012,7011): accept/refuse/hold, bounded held FIFO, expiry and receipts. ZUt [2525,2968) expires held on close.

chunk-sfn1dbxq.js SHA256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da. Rwt [472253,472852): session.receive chain can consume/rewrite before admission/queue.

## Product boundary and unresolved host requirement

AgentRegistry currently lists/sends only its own children. Runtime per-owner resources and interactive queue are lifecycle integration points. Proposed separate same-host transport owner aggregates explicit transport variants and routes uds selectors without changing child behavior. Admission belongs to recipient runtime/UI owner.

Standard Node on macOS exposes no matching peer PID/UID API. A native adapter must be obtained and verified, or this exact gap retained. Follow-up scratch feasibility in workflow wf_fd2cf88d-aa4 now verifies macOS arm64 / Node 26 connected-fd identity through a minimal N-API 8 addon using LOCAL_PEERPID and getpeereid; product integration, Node 22 and other platforms remain pending. Socket path and PID record alone do not prove connected peer identity. Auth tokens must never enter journals or evidence.

## Required real validation

Two CLI processes, private shared user directory, distinct workspaces/sessions and owned loopback SSE. Discover and send exact text into recipient meta request. Mismatched mode holds until recipient approval; refuse/expire receipts checked. Exit removes only owned socket/record/key. Exercise live/foreign/stale PID fixtures and sender cancellation. No cloud calls. Product implementation and full CLI validation remain pending.

## Native feasibility follow-up

Workflow wf_fd2cf88d-aa4 verified source Bun.ant boundary [1851,2705) and fd helper [2705,2775) in chunk-6zdc3jq1.js. Scratch /Users/mant1ssa/.claude/jobs/9b2805b2/tmp/c7.1Vy1UK contains peer.c, peer.node and probe.cjs. Built with existing xcrun clang, NAPI_VERSION=8, minimum macOS 11.0 and /opt/homebrew/include/node; no installed dependencies. Two independent Node26 processes observed exact peer PIDs, UID501/GID20 through LOCAL_PEERPID/getpeereid, verified before sending/receiving application text, and cleaned the socket. Addon SHA256 6890cd07fde850a4f28baf806fc6e32f0b6ab79e7938aa09a387f85bf1f79769. LOCAL_PEEREPID matched in this ordinary-process fixture; exec/setuid distinctions and Bun internal syscall choice remain unknown. Node22, x64/Linux/Windows remain unmeasured. Product build currently deletes dist and packages no native source/addon, so distribution/build ownership must be implemented and validated.

Source auth correction from Pjn in chunk-m7864yc0.js: default authentication requirement is Windows-only; macOS default is optional unless requireAuth is explicitly set. Preserve explicit requireAuth and auth-before-message processing. Published endpoint still follows socket chmod/key publication, with auth-required publication failure closing the inbox. Do not infer connected peer identity from a pathname or process record.
