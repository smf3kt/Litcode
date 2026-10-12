# Remaining recovered-subsystem dispositions

Status: closed decisions for the backlog items that were still open after the W05/W06 packages. Date: 2026-10-12.
Each item below states the recovered evidence (coordinates verified against the extracted bytes), the decision, and the user-visible contract this runtime ships instead. Nothing here is a promise to port later; an item is either superseded by an owned mechanism, impossible without a transport or codec this runtime does not have, or has no recovered source basis at all.

Sample: `/Users/mant1ssa/.local/share/claude/versions/2.1.296`, SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based UTF-16, left-closed/end-exclusive, read as inert data.

## 1. Next-turn background redial - superseded

Recovered evidence. `var ZF=10,oT=30000,ex=20,tx=600000` [388228,388266); `function iT(){return Math.min(2*$a(),tx)}` [388259,388300); `function dT(){let e=k("tengu_snug_reef",0);return typeof e==="number"&&Number.isFinite(e)?Math.min(Math.max(Math.trunc(e),0),ZF):0}` [388374,388505); and the scheduler `function lT(e){let n=new Map,r=new Map,...}` [388505,388543+), which selects failed rows whose permanent-error code is absent (`aT`), whose configuration identity still matches, and which are still open, counting `turns + heldTurns` with a hold of `min(2 x connect timeout, 600000)`.

Decision: superseded, not ported. The recovered policy is off by default (its flag reads 0 unless a numeric override is set, clamped to 10 turns) and operates on the recovered connection-table row model, where a server is a row with a turn counter and a held state. This runtime has no such table: one owner per server replaces the transport, and recovery is already always on and bounded - five fast then eight slow jitter rounds per transport lifetime (`src/mcp-retry.ts`), then an explicit `/mcp-reconnect`, plus the stdio next-use re-dial under `features.mcpRecovery`. Porting a second, disabled-by-default dialing scheduler on top of that owner would give two dialers the same decision and no new user-visible behavior. User-visible contract here: a dead HTTP server is retried automatically within one turn budget and then reported as disconnected with an explicit reconnect path; upstream, a dead server stays dead until the feature flag is raised, after which a bounded number of servers are re-dialed at the start of later turns.

## 2. Parked list_changed refetch - no transport basis

Recovered evidence. `var Pn=[1000,2000,4000],Ta=1e4,wa=5000,Ea=3600000,Pa=5,va=21600000,ba=5000` [47894,47968); `function ka(e,n,r,s){...}` [48170,48515), which re-runs a server's registered refetch handler once per list type the re-listen response reports as changed and logs a failure instead of failing the connection; and its only caller `P.push(Date.now()),ka(e,n,r,w.filter)` [50368,50405) inside the `subscriptions/listen` re-listen loop.

Decision: not applicable. The parked re-run is driven by a `subscriptions/listen` stream that re-reports which lists changed while it was parked; this runtime implements the classic GET notification stream and POST-carried streams, not `subscriptions/listen`. The guarantee it protects is already met here: a replacement refreshes the private catalog before it is adopted, and a pending change makes the server dirty so the next search or call refreshes it (see `ports/W05-list-changed-refetch.md`, whose package added the immediate refetch on the notification itself).

## 3. Recovered shell-AST argument splitting - not ported

Recovered evidence. `function SE(e){if(!e||e.length>D0)return[];let t=vS().parse(e);if(!t)return[];let r=nde(t,null);if(!r)return[];return DKe(r)}` [4697,4822) with the node types it refuses to cross [4822,4882) and its bounds `D0=1e4,P=65536,U=16` [1052,1071): the arguments string is parsed by the sample's own bash parser, the command node is located, and its argv is extracted.

Decision: not ported. The parser is an internal bash lexer/parser of substantial size with a 10,000 character cap, and the observable delta against this runtime's quote-group parser is limited to shell-grammar edge cases (for example a `;` or a pipeline inside an argument string). Porting it would replace a tested, documented argument contract with a hand-written grammar for those edge cases, so this runtime keeps its parser: quotes and escapes are grouped, adjacent fragments join, empty quotes are kept, an unclosed quote or trailing escape falls back to whitespace splitting, and the raw `$ARGUMENTS` form always keeps the input text.

## 4. `mcp serve` server and the server-side task receiver - no source basis

Recovered evidence. The recovered CLI's own server declaration advertises `tools.listChanged` only; the earlier bounded review found no `tasks` implementation behind its `mcp serve`, and the recovered task code is entirely client-side (requestor). This runtime therefore ships no server-side counterpart: it is a client of MCP servers, not an MCP server, and nothing in the sample specifies the server contract this project would have to satisfy.

Decision: out of scope, recorded rather than guessed. Implementing an MCP server here would be new product surface with no recovered behavior to copy, including a task receiver whose semantics would have to be invented.

## 5. Full pixel decoding - no portable codec

Recovered evidence. The recovered runtime resizes and recompresses images through its built-in `Bun.Image` codec; a bounded search found no portable counterpart, and the harness enforces the hard API contract instead (2000x2000, base64 5242880 / raw 3932160), reporting over-target dimensions rather than silently sending or refusing (see `ports/W05-image-limits.md`).

Decision: not portable in this runtime. Decoding every pixel requires a codec this project does not carry; the caps and the explicit over-target annotation are the shipped contract.

## 6. Modules without a port record - open gap, quantified

The ledger (`ports/port-ledger.md`) accounts for all 2365 modules of the sample: 25 carry port evidence in a `research/ports/` record, 57 appear only in narrative records, and 2283 (33.4 MB) are cited by no record at all. The unreviewed set is named and never assigned an estimated share; closing it means reviewing those modules against the product's remaining gaps, which is unbounded work rather than a pending item with a definition of done.

Decision: recorded as an open, quantified gap. Each new work package adds its modules to the ledger by regenerating it (`node scripts/port-ledger.mjs --extracted <sample> --output research/ports/port-ledger.json --markdown research/ports/port-ledger.md`), so the number is always reproducible rather than asserted.
