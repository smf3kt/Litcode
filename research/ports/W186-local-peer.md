# W186/C7 same-host peer transport

Date: 2026-10-19. Source carrier: `extracted-v2/modules/chunk-sfn1dbxq.js`, SHA-256
`4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, 4762583 UTF-16
units. All ranges are zero-based UTF-16 half-open. Supporting modules and digests:
`chunk-6zdc3jq1.js` (`8009c180…`), `chunk-m7864yc0.js` (`190465da…`),
`chunk-bt8cr7rw.js` (`5fa6b57b…`), `chunk-0ydceggj.js` (`ca1c4ce2…`),
`chunk-akfkn8xh.js` (`dcae213f…`), `chunk-w9kaj2q7.js` (`c9f40c69…`).

## Ported source

- `q` [17953,18154), `F` [18299,18568), `G` [18568,20657), `Z` [21883,22142) and
  `Sao` [22142,22608) in `chunk-6zdc3jq1.js`: local socket liveness probe, numeric
  JSON record enumeration with bounded reads and typed fields, present/gone/recycled
  PID state, and self/spare exclusion that sweeps only permitted dead same-domain
  records. `src/local-peer.ts` ports these as `discoverPeers`, `listRecords`,
  `sweepRecords`, `processState` and `recordStart`.
- `we` [15535,17953) (`chunk-6zdc3jq1.js`): validate the endpoint, find the auth key,
  bounded newline JSON with an optional no-follow-symlink open and a 5 s deadline, and
  require the expected peer PID/UID plus optional process start before writing a frame.
  `src/local-peer.ts` `sendPeerFrame` is that body; the native boundary it calls is
  `Bun.ant` [1851,2705) and the fd helper [2705,2775).
- `oV` [4852,4892), `STs` [5232,5505), `bTs` [6473,6592), `wTs` [6592,7933)
  (`chunk-m7864yc0.js`): `<userDir>/sessions`, the per-PID socket-hash key published
  0600 inside a 0700 directory carrying the peer token, process identity and PID
  domain, and its removal. Ported as `publishKey`/`readKey`/`removeKey` with the same
  `<pid>.<sha256(sock)>.key` naming. `Pjn` supplies the auth correction: the default
  requirement is Windows-only, so macOS stays optional unless `requireAuth` is set,
  while publication still precedes the advertised endpoint.
- `GTs` [1155,1624) (`chunk-akfkn8xh.js`) and `ajr` [1484,2566)
  (`chunk-w9kaj2q7.js`): the record projection and its local `uds:` transport/address
  view. Cloud, bridge and DID variants are excluded by the local-only constraint.
- `nn` [12376,14664) and `Qe` [5180,6744) (`chunk-bt8cr7rw.js`): the first-line
  deadline with a bounded newline/final-fragment parser, first-frame auth, peer PID and
  start checks, serialized processing, then text validation, loop guard, verified peer
  origin, and `isMeta`/`skipSlashCommands`/`skipAttachments` admission.
- `j` [15004,15363) and `Y` [15363,15599): owned cleanup that destroys clients, closes
  the server, expires held messages, awaits in-flight processing and unlinks only the
  owned socket and key.
- `E` [4491,4991) and `R` [6012,7011) (`chunk-0ydceggj.js`): admission and the held
  queue. Explicit policy first, self accept, unknown mode hold, asserted matching mode
  accept with mismatch hold, and the recipient-bypass arm; then accept/refuse/hold with
  a bounded FIFO, expiry and receipts. `ZUt` [2525,2968) expires held on close.
- `Rwt` [472253,472852) (`chunk-sfn1dbxq.js`): the `session.receive` chain may consume
  or rewrite a message before admission.

## Ported semantics in this host

- `src/local-peer.ts` owns the whole lane: record publication and sweep, key
  publication and lookup, the owned `net` server and its first-frame auth, the held
  queue, receipts, and `createLocalPeerTools`.
- Admission is the recovered `E`/`R` pair. `inboundVerdict` takes the explicit policy
  result, `selfSent`, the recipient mode and the sender's asserted `from_mode`;
  `HeldQueue` keeps the bounded FIFO, re-evaluates each entry when a release cause
  arrives, and expires the remainder on close.
- `HeldMessage.origin` persists the sender's assertion (`fromMode`) plus the verified
  peer PID and process start, so a release re-runs the verdict against the same facts
  instead of a re-read of live state.
- Receipts follow the recovered status vocabulary: `held` is the one intermediate
  status; `delivered`, `denied`, `expired`, `refused` and `dropped` are terminal.
  `waitStatus` therefore keeps waiting past a recorded `held` and resolves with the
  terminal status, or with the intermediate one when the caller's deadline runs out.
- A sent frame carries `type`, `message`, `from`, `msg_id`, `from_mode` and `priority`.
  It carries no `session_id`: `K8t` (`chunk-6zdc3jq1.js`) omits it, and the receiver's
  `Ie` (`chunk-bt8cr7rw.js` [4978,5232)) treats a foreign id as a mismatch and drops
  the frame.
- The lane is opt-in through `config.features.crossSessionMessaging` (default off).
  Accepted text enters the owning session as a queued `{prompt, source: 'event',
  peer: {from}}` entry, so a peer message is untrusted input to the model, never a
  user turn.

## Host boundary

- `native/peer-identity/peer.c` is an N-API 8 addon using `LOCAL_PEERPID`,
  `LOCAL_PEEREPID`, `getpeereid` and `LOCAL_PEERCRED` on darwin. `scripts/build-native.mjs`
  compiles it during `npm run build` when a compiler and `node_api.h` exist, and the
  package `files` list ships both the source and the built addon. On any other platform,
  or with no addon present, connected-peer identity stays unverifiable and the inbox
  requires an explicit `requireAuth` token instead; a path or record never proves
  identity.
- The socket path falls back under the runtime directory only when the user-directory
  path exceeds the `sun_path` cap. The fallback refuses a symlinked component, which is
  why a macOS `/tmp` default is rejected by design.

## Validation

- `npx tsc --noEmit` clean; `npm run build` builds `dist/` and the native addon.
- `test/local-peer.test.ts` 13/13: discovery, exact-text delivery and receipts,
  mode-mismatch hold then approve/deny/release/expire, explicit refuse, forged record
  identity rejected before the frame, stale record sweep and crashed owner, unauthenticated
  drop, bounded FIFO, key publication mode, and the tools without child routing.
- `scripts/smoke-peer-cli.mjs` (tsx and `--compiled`): two independent CLI processes, one
  private shared user directory, distinct workspaces and sessions, one owned loopback SSE
  gateway. B starts bypass and A default, A discovers B through the record files, the
  fixture model calls the real `send_peer_message`, B reports `held for approval` for the
  exact text, `/peer-held` lists it as `mode-mismatch`, `/peer-held approve 1` answers
  `delivered`, A reads that receipt back through `peer_message_status`, B's next request
  carries the exact text as input, both exits return 0, and no record or key file remains.
