# W259 `/tasks`

The recovered Background panel over the live task registries, and this host's mapping onto its background jobs, child agents and scheduler. Offsets are zero-based UTF-16 code units.

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-dy7th9we.js` | `0f2762a2b4d1187494238d29f2057d741fc7163aa243e96f495953e109719ba5` | `i` 21553 | `local-jsx` registration; `fLt` for a local session, `mLt` only for a remote one |
| `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `fLt` 674472 | dialog body: registry projection, selection, actions, detail modes |
| ↳ | | `fu` 693613 | subtitle counts over teammates, active shells and active agents |
| ↳ | | `RB` 699056 | stop predicate per task kind |
| ↳ | | `EWe` 699801 | row labels per task kind |
| ↳ | | 698025 | dialog shell `title:"Background"`, `No tasks currently running` |

## Behaviour

- **Panel.** `fLt` filters the task store with `CE`, sorts with `rjt`, groups running and completed agents, and builds `listRows` from bash tasks, MCP monitors, MCP tasks, remote sessions, agent tasks, workflow tasks, dream/auto-mode/memory-import tasks and the self-managed group. The list is the `tn` tree with group headers (`lm`: bold label plus `(size)`); Enter opens the row's detail or effects its agent action, `x` stops the focused row, `f` foregrounds an agent or teammate.
- **Rows.** `EWe` gives a `local_bash` task its command (a monitor its description), a `local_agent` its description, a teammate `@name`, and the rest their own description.
- **Counts.** The subtitle joins `N agents`, `N active shells` and `N active agents`, omitting zero groups.
- **Stop.** `RB` accepts a running `local_bash`, `local_agent`, teammate, workflow, MCP monitor/task, dream, auto-mode scan, memory import or remote agent; the dispatch at 680125 picks the registry kill for each kind.
- **Empty/cancel.** No rows shows `No tasks currently running`. The dialog's own cancel reports `Background dialog dismissed` with `display:"skip"`, so no line reaches the transcript.

## Host adaptations

- **Registry mapping.** The host has no vendor task store. `Runtime.backgroundTasks(owner)` projects the owner's live registry: `BackgroundRegistry.active()` jobs (`run` → shell, `monitor` → monitor), running `AgentRegistry` children, and `LocalScheduler.list()` crons. `Runtime.stopTask(owner, id)` dispatches to `BackgroundRegistry.stop`, `AgentRegistry.stop` or `LocalScheduler.delete`.
- **Labels.** Run jobs keep the recovered command label and monitor jobs the description label; a cron row shows its expression with the prompt as the second line. The counts line becomes `N active shells · N active agents · N scheduled tasks`.
- **Actions.** Only `x` is bound. Enter is inert because this host has no task detail screen, no foregrounding, and no agent-action menu; the self-managed group, teammates, workflows, MCP tasks, dream, auto-mode scan, memory import and remote agents have no host producer and are not ported. `x` waits briefly (up to 2s) for a killed process group to leave `active()` before re-rendering, because the registry keeps a job visible until its exit event.
- **Cancel.** Escape closes silently, matching the recovered `display:"skip"`.
- **Piped mode.** A session without a modal surface keeps the existing durable `task_list` report rather than inventing a background text view; the recovered command only exists as a `local-jsx` surface.

## Validation

- `test/tasks-panel.test.ts`: 6/6 (per-kind labels, subtitle counts, row meta, value round-trip, stoppable predicate, recovered strings).
- `test/tasks-command.test.ts`: 1/1 (`x` on the focused shell row calls `stopTask` with its id and the reopened panel reports `No tasks currently running`).
- Focused `tasks-panel`, `tasks-command`, `interactive`, `skills-command`: 33/33.
- Compiled `.audit/w259-tasks.mjs`: 7/7 at identity `c44dd8ab…`. A fixture turn calls `run_background` with `sleep 60`; `/tasks` shows `1 active shell` and the command row; `x` stops it and the panel shows the empty line; a second open agrees; every CLI exits zero.
- Full suite 3057, 3056 pass, with only the known CLI-effort failure.
