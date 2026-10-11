# W05 startup degradation and slow recovery

Date: 2026-10-11. Status: verified finite lifecycle slice.
Existing pinned features.mcpRecovery authorizes transient HTTP startup
degradation, preserving healthy peers and allowing eventual private discovery.
Configuration, authentication, protocol, cancellation and catalog integrity
errors remain fatal. Definitions and environment-header prerequisites are
validated before owned connections start. Default false remains fail-fast.

Five fast attempts precede eight slow rounds with 30-second exponential base,
300-second cap and 15-second jitter floor. Manual reconnect supersedes retry
timers; close cancels owned preparation and timers. Tool effects are never
replayed. Catalog refresh keeps published schemas pinned and preserves peers.

Source-derived formula observation:

| Module / SHA-256 | Symbol / range | Coordinates / classification |
| --- | --- | --- |
| chunk-bmffdtcn.js / a0ec7de2b09788f274420d680111f3a797a20618519f3963efa069574e6b535b | Knt and Cxn/dZr/Yns [1885,1994) | UTF-16, equal UTF-8 byte offsets here; behavioral adaptation |
| chunk-yjc18bey.js / e53a75c48188dd5f345841ef87e452840622f9d61bc86e97b2edea656866a687 | tv [615,940) | UTF-16, equal UTF-8 byte offsets here; capped exponential/full jitter |

Range hashes are 05fb6c8352d132b2f76ac4a07b03f75d0e11725f93db2be67af406f89bf71797
and 0550dd052196f13ac5d87c12b3da76501c9bcf24921ff5f1d831721ff24a14ce.
The overall mcpReconnectDelay/ManagedMcpClient lifecycle is a local rewrite,
combining the observed constants with an immediate attempt, integer-ms rounding
and owned cancellation/generation rules. No direct copy or original hourly
parking/refetch equivalence is claimed.

Source and compiled smoke-mcp-startup-cli.mjs each passed 10 owned loopback
model requests and 3 remote tool calls: transient503 recovery, peer single
initialization, fresh discovery, stable published schemas, single journal,
credential exclusion, DELETE cleanup and released locks. MCP141/141 and the
18-case reconnect suite passed; exactly three startup cases were added, with
accelerated scheduling proving all 13 attempts and close/manual supersession.
Existing compiled URI/GET chain still passed12requests after this change.

Exact target hashes/ranges, receipts and final source/build identity are bound
in local-completion-evidence.json. Remaining MCP task/media/URL-elicitation,
durable URI state and complete original startup/list-refetch semantics are
separate gaps; the local startup/slow-retry usage package is complete.
