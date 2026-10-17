# W68 — the original task tool contract against the local store

## Source position

The recovered task tools are in `chunk-tar639dc.js` (UTF-16 code units):

| Tool | Input schema | Output schema | Tool body |
| --- | --- | --- | --- |
| TaskCreate | `Oi` [139849,140169) 320 | `xi` [140172,140213) 41 | `xr` [140216,141450) 1234 |
| TaskGet | `Pi` [142239,142306) 67 | `zi` [142309,142421) 112 | `Dr` [142424,143539) 1115 |
| TaskUpdate | `Di` [145886,146609) 723 | `Li` [146611,146733) 122 | `Nr` [146736,149722) 2986 |
| TaskList | `Mi` [151469,151483) 14 | `Ni` [151486,151582) 96 | `Ur` [151585,152664) 1079 |

The source stores one JSON document per sequential integer id under the task-list directory with a
`.highwatermark` (chunk-9xs8s13r.js), and its tools render text:

- TaskGet returns `{task: {id, subject, description, status, blocks, blockedBy} | null}` and
  renders `Task #id: subject` / `Status` / `Description` / `Blocked by` / `Blocks`, or
  `Task not found`.
- TaskList takes `{}` and returns `{tasks: [{id, subject, status, owner?, blockedBy}]}`, after
  dropping every task whose `metadata._internal` is set and every completed id from each
  `blockedBy`; it renders `#id [status] subject (owner) [blocked by #..]`, or `No tasks found`.
- TaskUpdate takes `taskId`, `addBlocks`, `addBlockedBy`, and a status that includes
  `deleted`, and returns `{success, taskId, updatedFields, error?, statusChange?}`.

## What this product already ports

The product's store keeps UUID identities in one durable, lock-guarded `.agent/tasks.json`
rather than numeric ids in one file per task. On top of it, the source's visibility rules are
implemented: read projections hide `metadata._internal`, drop completed ids from `blockedBy`, and
derive `blocks`; a pending task with no outstanding blockers is `ready`; the graph is a strict DAG
and status changes cannot rest on unfinished dependencies.

## Accepted divergences

The tool surface itself remains the product's own JSON API, and that is recorded rather than
replaced:

- **UUID identity.** The product's TUI, runtime, agent isolation and task tests address tasks by
  UUID. Switching to sequential integer ids and one file per task would replace the durable store
  and its crash-safe write path for no behavioral gain in this harness.
- **Field set.** Get/List add `owner`, `metadata`, `activeForm` and `ready`, and Get returns the
  stored `blockedBy` filtered to outstanding blockers. These are the fields the task panel and
  the model consume here; the source's six-field Get omits exactly the fields the product relies
  on.
- **Transport.** These tools return JSON strings, like every other tool in this runtime; the
  source's renderer text is produced for the original client's tool-result pipeline and would drop
  the structured fields this runtime's callers parse.
- **Update surface.** The product accepts `removeBlockedBy`/`removeBlocks` and `deleted: true`
  in addition to the source's `add*` fields and `status: "deleted"`; removing them would delete
  working operations used by the tests and the task panel.
- **Unknown id.** TaskGet throws the product's tool error instead of answering null, consistent
  with the other tools in this runtime.

This is an adaptation with a stated reason, not a missing port: the source's visibility semantics
are present, and the differing container follows from the product's own durable identity and
transport choices.

## W67 identity correction

W67's first identity measurement (`b1c74f0c…`) was taken before the final build that included an
added module comment. The committed tree's identity is `f8c89d5a…` (inputs `4ac6abc8…`, build
`f22723bf…`); every W67 record now carries the corrected value.

## Verification

No product code changed. tsc 0; task suites 24/24 (both task files); the W67 full-suite result
(2,092/2,092) still describes this tree because only comments and records differ; identity
`f8c89d5a…`.
