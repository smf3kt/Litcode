# W05 subscription and notification recovery

Status: verified finite recovery slice. Date: 2026-10-11. Owner: parallel execution agents.

Task: acknowledged exact-URI subscriptions survive successful manual/automatic transport replacement; opted-in HTTP GET notifications reopen after transient loss.
Entry/config: features.mcpRecovery=true, optional/pinned/managed; mcpSubscriptions and mcpNotificationStream remain independently gated.
Targets: mcp.ts/mcp-subscriptions.ts/mcp-http.ts, runtime/session/CLI configuration and one actual CLI driver.
Classification: rewrite of finite local recovery behavior, using existing connection manager; no original URI replay algorithm is claimed.
CLI contract: subscribe -> failed replacement retains old -> successful replacement restores -> expired session auto replacement -> same-session EOF GET reopening -> unsubscribe excluded -> peer and journal retained -> close.
Checks: a few transport regressions, affected consumers, typecheck/build, source+compiled CLI driver; identity and evidence retained after freeze.
Remaining: startup partial degradation, slow reconnect rounds, durable subscriptions across process restart, lost-event replay and original hourly park/refetch strategy. Of these, startup degradation and the slow rounds landed with ports/W05-startup.md, durable subscriptions across restart with ports/W05-persistence.md, and the hourly park/refetch strategy is decided in ports/remaining-dispositions.md; lost-event replay remains, and CURRENT.md's W05 row is authoritative.

## Source evidence and differences

Artifact SHA256: c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Source chain accepted by W02.
chunk-sb190ksj.js SHA256: 0a1c2aa1424babd95eeec371f67c875b6382db0c891b3b3e90f710f2102b16df.
chunk-8sj9gbsq.js SHA256: 86e5e1c62a4509d1ead03e93cea5a61bcecd910fc4f06ec218b653528b975704.
Coordinates are UTF-8 file bytes, left-closed/end-exclusive:

| Source | Range | Observed responsibility |
| --- | --- | --- |
| Zo / ka | [48080,48170) / [48170,48515) in sb | Subscribe metadata and list-refetch dispatch |
| Aa / Ia / js / Oa | [48515,48913) / [48913,50441) / [50441,50690) / [50690,51588) in sb | Listen lifecycle, capability filter, wait/reopen and list refresh |
| Vm / Km / Gm | [118119,118292) / [118292,118418) / [118418,118548) in sb | Register tools/prompts/resources callbacks |
| UMo / de | [8755,9928) / [10045,13327) in 8sj | Headless close ownership, guarded replacement and onReconnected callback |

Original listen code uses1/2/4-second waits, additional graceful-close delay, health-dependent resets and per-hour parked/jitter phases. Current finite local policy instead caps GET reopening cumulatively at5 (1/2/4/8/8seconds), keeps POST and session identity intact, never synthesizes refetch/events and never invokes callbacks from GET.
Original URI subscribe desired-state replay was not established by the bounded source read. New local restoration prepares/validates/freezes acknowledged URI state, subscribes the candidate before commit, and releases the old transaction on failure. Logs and queued updates remain transport-generation owned.
Recovered entrypoints remain inert. Original runtime/SDK listen equivalence and all unexamined cross-chunk consumers remain unverified.

## W03 independent search

Bounded read-only search of direct neighboring project directories and installed command names found no Magpie management repository/CLI. Existing Messages endpoints and environment configuration are located; management launch/route mutation/credential issuance APIs remain unknown. Real upstream/management validation remains not_run; no paid calls were made.

## Final acceptance

Source and compiled actual CLI each passed12 owned model requests,5 transport generations and7GET requests. Verified failed-restore retention, exact URI restoration after manual/automatic replacement, same-session GET EOF reopening, peer/journal preservation, unsubscribe exclusion, no tool replay/resource reads, credential isolation and lock cleanup.
Merged MCP138/138 passed; final full baseline1015/1015 passed with0fail/cancel/skip (40330.846083ms). Typecheck/build exit0. Offline package52files passed production-only install/help/demo with0upstream requests.
Persistent complete content identity and receipts: [W05-recovery-evidence.json](W05-recovery-evidence.json). Identity: `4454a2b87fe777d5ab7dae0139ade83fa9bfdfe68ab3641fb35c58b5dd674555`.
Six essential added recovery tests cover exact restoration, failure/cancellation/concurrency/late close, transient GET versus terminal parse/status failures, finite lifetime cap and timer cleanup. Fatal stdio failure still clears URI state; normal connected stdio manual replacement shares candidate restoration path.
This closes the stated GET/URI recovery slice; the whole W05 package and MCP family remain Partial for the remaining items above.
