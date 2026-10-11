# Monitor transport contracts

Updated 2026-10-10. Focused static observations of Claude Code 2.1.296 for the independent personal harness. Recovered application code was read as data, never executed. Original runtime equivalence has not been established.

## Source identity

Sample SHA-256: `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`.

All anchors below are zero-based UTF-8 byte offsets within decoded module files, with range ends exclusive. They are not executable offsets or the UTF-16 coordinates in FEATURES.md. Parent computed these module hashes directly from extracted-v2/modules/ and verified all four against decodedSha256 in extracted-v2/manifest.json.

| Module | SHA-256 | Anchors |
| --- | --- | --- |
| chunk-znqf6yae.js | 220165fe021b26cce4c32ff7e726af7f7d27a15d1acb6b3a67d46b5b5b3da757 | d2t [3774,7673); schema be 7866; XOR _e 10075; message 5061; rejected upgrade 5557; error 6020; close 6317 |
| chunk-hasac4vg.js | d5e03f345f45bd21e434d436004fe65dbc1099668fe348a1b4282f80bcc7f99d | rate V_n [1673,3419); batch bJn [4821,5478); stop wJn [17962,18494); socket P_ [20957,21948); owner cleanup Jqo 26223 |
| chunk-64edse2c.js | 8a49c1044a864dc9d4a04febf952465b1cc046553124b9a4826664e13fc7354c | bucket defaults 615; Yme [635,898) |
| chunk-8qmvgbmp.js | 28a164c2d7ea2ca7cd4d793e886636035c7a133317987c50b358f58add5e5075 | constants 995; modes vqe 1041; timeout Ads [1245,1486); expiry Ifr [1486,1834) |

## Observed static contracts

- Public input selects command XOR ws using truthiness. ws.url parses as ws/wss, excludes embedded credentials, ASCII/control violations and literal tab/newline/carriage return. protocols is an optional array of unique RFC 6455 tokens. An alternate JSON-schema path remains command-only.
- Startup registers the socket/task and returns without waiting for open. maxPayload is 1,048,576 bytes. No public reconnect loop was found. The 30-second handshake deadline belongs to internal ambient watches, not ordinary public Monitor calls.
- Text appends a newline to the frame; binary becomes `[binary frame, N bytes]`. Both then enter a shared line batcher. Internal transform callbacks can drop binary/text; they are absent from the public schema.
- The batcher trims lines, removes blanks and short standalone hint tags, caps lines at 500 JS string units, and batches for 200 ms from the first pending line. Joined batches cap at 3,000 JS string units plus a suffix. Pending unfinished text caps at 1,048,576 JS string units. The prose stating that every frame is its own notification overstates the implementation's message isolation.
- A token bucket starts at 10, has capacity 10 and refills one token per 2 seconds. Each batch consumes one token. Suppressed batches are discarded, then reported on the next admitted batch. Rejection after more than 30 seconds in a suppression episode stops the monitor. An admitted batch more than 6 seconds after the latest suppression resets the episode.
- Public open has no connected notification. Upgrade rejection emits its HTTP status and terminates. Error emits a diagnostic unless an upgrade rejection was already recorded. Close flushes the batcher, reports code/reason and stops the task.
- Default timeout is 300,000 ms; schema minimum 1,000 ms and maximum 3,600,000 ms. Bounded mode clamps to 1,800,000 ms, or 600,000 ms in certain hosted modes. Legacy persistent behavior is mode-dependent.
- Task/owner cleanup calls socket.close, marks the task killed and clears its timer/keepalive. Natural close uses the same killed-state transition. Incoming messages check task and socket identity. The focused path contains no per-call abort listener or explicit awaited/forced-close fallback. Its close handler may flush buffered output after a stop.

## Independent implementation choices

The migration adds WebSocket transport to the existing session-owned BackgroundRegistry. It keeps the harness's own job states, queue limits, UTF-8 byte accounting and owner cleanup instead of adopting the original batcher's hint removal and string-unit cuts. One retained text message remains one notification, including embedded newlines; binary content is represented by its byte count. Lifecycle diagnostics expose failed connections and terminal close details. The independent client imposes a 10-second handshake timeout bounded by the job deadline, disables per-message compression and redirects, and stops the connection when 200 messages arrive within 100 ms. Retained event text is capped at the smaller of 4,096 UTF-8 bytes and the queue's text-byte budget, with per-event truncation metadata. There is no reconnect.

The monitor tool's new input offers command XOR ws. Shell gating applies to command mode; the socket mode does not launch a shell. Old session metadata keeps its exact command-only monitor schema on rebuild. New session schemas expose ws without increasing the tool count or changing other tool schemas. Runtime notifications continue to enter the interactive agent only between completed turns, and release/clear/fork/exit close the owning connections. A parent interactive test sends literal `/clear` during a model response and verifies it reaches the next model request as event data, without invoking a REPL command or creating a replacement session.

These choices intentionally differ from original rate-bucket, line-batching, natural-close state, deadline-minimum and forced-cleanup behavior. Transport fragmentation, protocol negotiation, UTF-8 checks and ping/pong are delegated to pinned ws 8.22.0; application-level message size and retained output are independently bounded. Parent final verification: npm run check passed; npm test passed 320/320, zero failures/skips, 5,099.452 ms. New coverage includes 29 transport regressions, exact legacy schema restoration, session owner isolation, serialized interactive event delivery and an actual CLI tool call over owned loopback SSE/WebSocket fixtures. These checks establish the independent implementation's behavior without proving original runtime equivalence or contacting a real upstream model. STATUS.md records the full-suite result.
