# W211 the `/workflows` panel

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

User report: 「/workflows也没有反应，现在都只是文字选项，选中后也没有效果」 — `/workflows` answered
with a raw JSON dump of the run list and nothing could be selected. The recovered command is a panel
of rows with a run list, a detail view and a task card.

## What was there

`src/interactive.ts` printed `JSON.stringify(views.map(...), null, 2)` to stdout. No title, no
icons, no selection, no second level.

## Recovered source

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-mv5ceh8c.js` | `848c45387f153652fe2bf11fcf85251480e4dc9295d47325c0da3f26b60b3763` | 4600+ | the registration `{type:"local-jsx",name:"workflows",aliases:[],description:"Browse running and completed workflows",isEnabled:()=>dg(),immediate:!0}` |
| `chunk-24k7d6mw.js` | (main frame) | 75768, `Ux` | the dispatch table `fZ` — `workflows:()=>import("…/chunk-mtw0aefh.js")` — resolved by `Ux(h)=h.load??fZ[h.name]` |
| `chunk-mtw0aefh.js` | `5fa9e2db33e721240465b0ae2b1949c3caa20ad18154be2b69a3da2653576042` | `pe` [19263,20074), `le` [20074,24977), `We` [24977,25291), `Pt` [25291,25535), `J` [19190,19263) | the entry, the list panel, the row model, the status-icon map and the dismiss notice |
| `chunk-04v7vxqn.js` | `8cb167b9ed25629bf15c7ef87c1fcb95da00328c65013321480cbd386dd3d4d6` | `a={tick:…}` | `tick:"✔"`, `cross:"✘"`, `circle:"◯"` |
| `chunk-3cynezh1.js` | `c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3` | `var uo=` | `uo=O()==="macos"?"⏺":"●"` |
| `chunk-yn0pfn70.js` | `1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f` | `function rn(` | the duration formatter |
| `chunk-ax7r0qj7.js` | `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e` | `function I(` | `I(t,n,e=n+"s")`, the pluraliser |
| `chunk-fz2251t0.js` | `5b8789988815996ef934fa9d83ec0813f8ebec48dd7ec67d24d8c110fd8f5eff` | whole module | `C(o,a)`: a dim `" · "` before every child but the first |
| `chunk-e24bvje9.js` | `2b5182f8162f82d69d07991b927b2a8ce4905173511a0e0b4d81f2009c2692d0` | `ro` [30601,…) | the verbose status vocabulary |
| `chunk-36h1wcr3.js` | `46fb061e8114326e919fef78f9f747738faecaf2b86de4d7bebd15fb53e195b6` | `AHr` [15706,…) | the detail header: `done/total agents · duration` plus ` · done`/`stopped`/`paused`/`failed` |
| `chunk-c5zwk83v.js` | `6959b4be7259da93c2fa4cf4ae0704ff8c14f60a196d7bdc4dbee0f675828a60` | `dg` [2239,2275) | the command's enable gate, `$uo()===void 0` |

Coordinates are zero-based UTF-16 offsets, and every range above was read from the bundle in this
session.

## Port

- `src/workflow-panel.ts` (new) holds the panel: `WORKFLOW_PANEL_TITLE` (`Dynamic workflows`),
  `WORKFLOW_PANEL_EMPTY` (`No dynamic workflows in this session.`), `WORKFLOW_PANEL_DISMISSED`
  (`Dynamic workflows dialog dismissed`), `formatDuration` (`rn`), `pluralize` (`I`), the icon map
  (`Pt` over `a`/`uo`), the subtitle counts (`le`: running versus everything else, labelled
  `completed`), the row facts (`We`: duration, then `N agents`, joined by `" · "` with the
  empty entries dropped), the list request, the detail request and the task card, plus
  `browseWorkflows`, the navigation.
- `src/interactive.ts`: `/workflows` builds the list lazily and, when a modal surface exists, runs
  `browseWorkflows(list, request => withTurn(signal => readDialog(request, signal)))` and writes the
  dismiss notice to the status line. Without a terminal the previous text dump stays, so the
  non-interactive path is unchanged. `COMMAND_HELP` and `TUI_COMMANDS` take the recovered
  description, `Browse running and completed workflows`.
- `src/terminal.ts` and `src/tui.ts`: `TerminalPromptRequest.readOnly`. Such a dialog draws its rows
  and no `> ` input row, keeps `Selected: …` and row selection, and hints `Enter next / Esc back`
  with rows or `Esc close` without them. This is the host's stand-in for the recovered panel's
  `inputGuide`, which the question component has no slot for.
- `browseWorkflows`: the list, `Enter` into a run, `Enter` into one of its tasks, `Esc` one level
  back at a time, the dismiss notice when the list itself is cancelled, and the recovered auto-drill
  when the session holds exactly one run. The list is read again on every return so a running run's
  row keeps up, as the recovered panel's live task registry does.

## Verification

- `test/workflow-panel.test.ts` (new, 10 tests): the formatters, the subtitle split, the row facts,
  the three requests and the navigation — list → run → task → back → back → notice, the single-run
  drill, and a task-less run.
- `test/tui.test.ts` (2 new tests): a read-only panel with rows draws no input row, shows
  `Selected: ✔ build`, resolves with the picked row on Enter and closes on Escape; a read-only panel
  without rows ignores Enter and closes on Escape.
- Full suite 2759/2759 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w211-workflows.mjs` (a stub provider over SSE, because the provider
  streams): two turns each run a real two-task workflow, then `/workflows` shows the list
  (`Dynamic workflows`, `2 completed`, two rows of `✔ <run id>` with `0s · 2 agents`, `Selected: …`,
  `Enter next / Esc cancel / PgUp/PgDn`), `Enter` opens the run (`2/2 agents · 0s · done` and the two
  task rows), `Enter` opens the task card (`✔ build`, `Completed · session <id>`, the summary, the
  run id, `Esc close`), and three `Esc` presses walk back out to the chat with `Dynamic workflows` in
  the footer.

## Adaptations and what stays out

- The row label is the run id. The recovered label is `workflowName ?? summary ?? description`, and a
  local `WorkflowView` carries none of the three; the run id is the identity the command already
  printed.
- Tokens are the one recovered fact this host has no source for, so that entry is always empty and
  drops out of the join, exactly as the recovered renderer drops a zero count.
- `agentCount` is `view.tasks.length`: each DAG task runs one child agent. Script runs
  (`workflow_run` with a `script`) are journaled under the session workspace and never enter the
  registry's list, so they have no row here; the recovered panel merges their stored snapshots.
- The list's own keys beyond selection are out: `x` (stop a running run) and `s` (save a script) need
  row-level key handling the question component does not have, and the local view carries no script
  text to save. The detail view's `r`/`x`/`p`/`f` agent keys are the same case.
- The recovered `dg()` enable gate (a managed-settings and org-policy chain) is not ported. The
  command keeps this host's existing `workflow_get` permission check, which is what the text path
  already enforced.
- The detail view is read-only: the recovered one acts on the focused agent, and the local one has
  no per-task action to offer.
