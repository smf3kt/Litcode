# W275 `/subtask <task>`

The composer's fork command: send a subagent off with the full conversation and keep working
while its result comes back on its own. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 1638723 | `ojt`: the `local-jsx` registration, description, argument hint `<task>`, `isEnabled:()=>!xa()` |
| `chunk-57v1bkyr.js` | `38a4ef68a99a508da6ba6d162153e0d73c7e8d0a7646076feece2b738f2f5868` | 15000 | the body `m`: usage row, `Zjt` spawn, the two null-return rows, the fork row |
| `chunk-940nvk4p.js` | `ccbaa2429c7a25d7f8b8724bd20245450200035b2468e7c78ddc1383fb2a66ba` | 1241 | `Zjt`: the fork spawn, `forkContextMessages: e.messages`, `useExactTools: true`, `model: "inherit"` |
| ↳ | | 4214 | `_`: the name hint, first three words joined by `-`, stripped, cut to 24 |
| `chunk-yx9wnc2f.js` | | | `allocateName`: base, then `base-2`, `base-3`, … past live names |
| `chunk-nfna65jh.js` | `c1764357cf2e6f8c97c1b9994577437baec0e04fe67d8532ceb9a562b4d12446` | 1482 | `Fh`: `a<name>-<8 hex>`, the id whose last four characters the row shows |
| `chunk-vvj0cwgx.js` | `557a86a5e4f608e938b7d477d0daf16f8cf8bba85d6ddb4cb695dea263fc4f46` | 758 | `xa`: the coordinator gate |
| `chunk-fdxhcr6b.js` | `3c625e31827ca4ef7cc3a4691103fbbb3abbdd338778cbf70c0054f37359507b` | 615 | `Ne`: the env truthy reader the gate uses |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` | 65963 | `OR = "⑂"`, the fork glyph |

## Behaviour

- **The argument.** `m` trims the typed argument; an empty one writes
  `Usage: /subtask \<task\>` as a system row and returns. The recovered literal carries escaped
  angle brackets, so the row renders with a backslash before each bracket.
- **The guards.** `Zjt` returns null when the session was ended by the model, when `xa()` reports
  a coordinator session, or when no rendered system prompt can be produced. `m` turns a null into
  one of two rows: the coordinator row when `xa()` is true, otherwise
  `Cannot start a subtask before the first conversation turn`.
- **The spawn.** `Zjt` allocates a name from `_` over the task text, registers it, and starts an
  async child with `forkContextMessages: e.messages`, the parent's system prompt
  (`override.systemPrompt = parentSystemPrompt`), `model: "inherit"` and `useExactTools: true`.
  The child runs the parent's exact tool pool, not a narrowed subset.
- **The row.** `${OR} forked ${name} (${agentId.slice(-4)})` — the glyph, the allocated name and
  the last four id characters. `m` returns null, so the composer keeps no result to render: the
  child's own completion arrives through the child-agent event stream.

## Host adaptations

- **One seam, not a tool.** `Runtime.launchSubtask` reaches the owner's `AgentRegistry` through
  `subtaskSeams`, which `buildTools` fills whenever the subagent feature is on. The registry's
  existing `launch(..., execution, conversation)` already seeds a fork from a conversation and
  validates an execution's tools against its own child pool, so the seam hands it the
  child-facing tool list (`childTools`) and lets `childConfig` derive the child prefix.
- **`subagent_type` only where it exists.** `conversation` alone makes the launch a seeded fork.
  The advanced `subagent_type: 'fork'` is passed only when `agentTypes` is on, because
  `resolveChildLaunch` refuses advanced options otherwise.
- **The name is allocated before the spawn.** The registry's own `args.name` is reserved, not
  ordinaled, so the host computes `subtaskName` then `allocateSubtaskName` over the live roster
  and passes the result as the spawn name. That is the same base/ordinal loop `allocateName`
  runs, over this host's own roster.
- **Not ported.** The `subagent_launch` telemetry events and their reasons, `endedByModel`, the
  `nameHint`/`description` overrides, the concurrency-slot registry, the worktree result hook,
  the summarization flag, and the coordinator surface itself (this host has no coordinator mode,
  so `xa` can only be true through the environment flag).
- **The turn guard is the host's.** `session.awaitingResponse` refuses a mid-turn spawn, which is
  this loop's rule for every session-switching command; the source instead gates on a rendered
  system prompt.

## Validation

Unit 9/9 (`test/subtask-command.test.ts`: the exact source rows, the name derivation and
allocator, the coordinator gate, both command tables, the usage arm, the fork arm with the
seeded conversation, the first-turn arm, and a real-runtime launch that writes a child journal
with the `fork_seed` boundary). Focused 112/112 (subtask, autocomplete, interactive, branch,
registry). Full suite 3162/3163 with the known `cli-migration` effort failure. Compiled 12/12 at
identity `5b5e9e2e…`: a bare `/subtask` prints the usage row and starts no child, a subtask before
any turn prints the first-turn row and starts no child, and after one turn the row reads
`⑂ forked probetask (xxxx)` while the child request carries the parent's two messages plus the
task.
