# W276 `/fork`

The composer's fork command, in both registrations the source selects between. Offsets are
zero-based UTF-16 code units.

| Module | SHA-256 | Offset | Contents |
| --- | --- | --- | --- |
| `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | 1638340 | `tjt`: the closed-fleet registration, `Spawn a background agent that inherits the full conversation`, argument hint `<directive>` |
| ↳ | | 1638551 | `njt`: the open-fleet registration, `Copy this conversation into a new background session and keep working here`, argument hint `[prompt]` |
| ↳ | | 1663949 | `Ujt`: `fleetFork:{open:()=>gw()&&!Ne(a.IS_DEMO),whenOpen:[njt,ojt],whenClosed:[tjt]}` |
| `chunk-wtdka69b.js` | `5619612f9e775014b7693af2153033c4cbdad460dceb30d5f872d2e10bd1780e` | 854 | `Tkt`: `r() !== null` |
| ↳ | | 887 | `r`: the environment flag, then the `disableAgentView` setting |
| ↳ | | 1096 | `gw`: `!Tkt()`, the fleet-fork gate |
| `chunk-0krtqd6x.js` | `64f3467f02a34e42387c6e3e14747eb2f1ee829fdf087cb521186ec43d2bd3cb` | 15000 | the closed-fleet body `m`: usage row, `Zjt` spawn, two null-return rows, the fork row |
| `chunk-zsg1bb14.js` | `b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26` | 19311 | `Ue`: the open-fleet body — coordinator, persistence and launch-flag refusals, the empty-conversation row, the background copy |
| ↳ | | 20040 | `U`: the dialog that calls `gft` with `keepParent:!0` and reports `UKn(...)` |
| `chunk-t721xmjm.js` | `c88d190d4b973f293465e812bffa970b235dcf6b7f2e12525af0551168a2cb26` | 46831 | `Ucn`/`rFt`: `session running` and `session waiting for a prompt` |
| ↳ | | 46909 | `_e`: ` · ` |
| ↳ | | 46946 | `TMr`: the name chips split on the fork glyph |
| ↳ | | 47819 | `UKn`: state, name, id and chips joined by ` · ` |
| `chunk-fdxhcr6b.js` | | 615 | `Ne`: the truthy reader the demo flag goes through |

## Behaviour

- **The selector.** `Ujt` keys the whole command table on `gw() && !Ne(IS_DEMO)`. Open selects
  `njt` for `/fork` and keeps `ojt` (`/subtask`, W275); closed selects `tjt` and offers no
  subtask row. `gw` is `!Tkt`, and `Tkt` is true when `r()` reports a reason: any non-empty
  `CLAUDE_CODE_DISABLE_AGENT_VIEW`, or `settings.disableAgentView === true`.
- **The closed body.** `m` trims the argument; an empty one writes `Usage: /fork \<directive\>`.
  Otherwise `Zjt` seeds a child with `e.messages` and the parent's exact tools, and the row is
  `${OR} forked <name> (<last4>)`. A null from `Zjt` becomes the coordinator row when `xa()` is
  true and `Cannot fork before the first conversation turn` otherwise. This is the same spawn and
  the same three rows as `/subtask`; only the command word differs.
- **The open body.** `Ue` refuses a coordinator session, a persistence-off session and a session
  started with launch flags, then seeds from `fBe` and reports `Nothing to fork yet. Send a
  message first.` when there is nothing. `U` spawns through `gft` with `keepParent:!0` and writes
  `UKn({state, name, id, chips})`: `session waiting for a prompt` for a bare `/fork`,
  `session running` once a prompt was typed, then the name, the eight-character id and any chips.

## Host adaptations

- **The host keeps the open branch and adds the closed one.** The host has no fleet, so the open
  branch's "background session" is this product's own `startBackgroundSession`: it forks the
  journal and starts a detached headless child, which is the observable contract `gft` gives
  (`keepParent` leaves the parent running). The row is the recovered `UKn` shape with the short
  id, and the log and resume lines the host already prints for `/background` follow it.
- **The closed branch reuses W275's seam.** `Runtime.launchSubtask` is the spawn `Zjt` describes,
  so the directive arm calls it and prints `subtaskForkLine`, which is the same `${OR} forked …`
  row. No second registry seam was added.
- **`/clear` and `/rewind` keep their own arm.** The source's successor-session path belongs to
  the open-fleet body's sibling, not to either fork registration; `/clear` and `/rewind` no longer
  share an arm with `/fork`.
- **The gate is read once.** `fleetForkOpen` is evaluated at loop start from the process
  environment and the session config, and the same value drives the composer table, `/help` and
  the `/fork` arm, so a session cannot show one row and run the other.
- **Not ported.** The `fork_briefing` message, the `rc_repl_fork_conversation` remote path, the
  worktree relocation chips, the `tengu_session_fork` telemetry, the `session running`/
  `session waiting` reader `Bcn` that parses a row back, and the launch-flag refusal (this host
  has no safe/bare launch flags to inherit).

## Validation

Unit 14/14 (`test/fork-command.test.ts`: the exact closed-fleet rows, the gate over the
environment flag, the setting and the demo flag, the `UKn`/`TMr` row builders, both command-table
branches, the open copy with and without a prompt, the empty-conversation refusal, a failed copy,
and the closed directive arm's usage, coordinator, first-turn and forked rows, plus `/subtask`'s
own rows). Updated 3 assertions in `test/interactive.test.ts` that read `/fork` as a successor
session. Focused 72/72 (fork, subtask, interactive, autocomplete, background). Full suite
3176/3177 with the known `cli-migration` effort failure. Compiled 17/17 at identity
`7222caea…`: in the open fleet fork a bare `/fork` with no conversation prints the source row, a
bare `/fork` after a turn prints `session waiting for a prompt · <8 hex>` and writes a second
journal and a background log, `/fork FORK_TASK` prints `session running · <8 hex>` and the copy
runs its prompt; in the closed fleet fork (`CLAUDE_CODE_DISABLE_AGENT_VIEW=1`) a bare `/fork`
prints the usage row and `/fork FORK_TASK` prints `⑂ forked forktask (xxxx)` and runs as a child.
