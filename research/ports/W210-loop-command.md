# W210 the built-in `/loop` command

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

User report: 「loop没做」 — typing `/loop` did nothing. The command was absent from the help
table and from the composer's suggestion list, and a typed line fell through to the unknown-command
path.

## What was there

Nothing. `/loop` had no dispatch branch, no `COMMAND_HELP` row and no `TUI_COMMANDS` row. The
composer offered no suggestion for it and the REPL answered `Unknown command`.

## Recovered source

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-1eegq95r.js` | `b84d67a18c2873ac0f54b882718647305d0c037b20d1b873b5a2d49b9b3db65b` | `se` [22959,24199) | the command descriptor `oat`: name `loop`, aliases `["proactive"]`, `userInvocable`, and the `getPromptForCommand` that returns the instruction text |
| `chunk-1eegq95r.js` | same | `R` [12484,17570) | the parse-and-schedule prompt builder (the branch this port carries) |
| `chunk-1eegq95r.js` | same | `S`, `v0n`, `k0n`, `dre`/`vqe`/`C0n` | the interval→cron table, the visible-update sentence, the stopped-outcome sentence and the monitor arming sentence |

Coordinates are zero-based UTF-16 offsets.

`/loop` is a built-in command, not a `local-jsx` panel: its `getPromptForCommand(input)` returns
text, and that text becomes the user turn. The recovered builder has three branches — rule 1
(leading interval token), rule 2 (trailing `every <N><unit>` clause) and rule 3 (no interval,
dynamic mode). All three end at the same prompt body, so one port covers them.

The source interpolates tool *display* names from the tool registry. This host's registry uses
different names, so each is substituted one for one:

| Source symbol | Source name | This host |
| --- | --- | --- |
| `Wu` | `CronCreate` | `cron_create` |
| `$_` | `CronDelete` | `cron_delete` |
| `wa` | `ScheduleWakeup` | `schedule_wakeup` |
| `Pl` | `Monitor` | `monitor` |
| `Uc` | `TaskStop` | `task_stop` |
| `nR` | `TaskList` | `task_list` |
| `Qo` | `AskUserQuestion` | `ask_user_question` |
| `Ro` | `Skill` | `skill` |

## Port

- `src/loop-command.ts` (new) holds `LOOP_COMMAND` and `loopCommandPrompt(input)`. The body is the
  recovered text with the tool names above substituted and the two gates resolved to their fixed
  local values.
- `src/interactive.ts`: a dispatch branch before the `/workflows` handler rewrites the typed line
  into the expanded prompt, which then travels the ordinary turn path:
  ```ts
  if (prompt === '/loop' || prompt.startsWith('/loop ')) {
    prompt = loopCommandPrompt(prompt.slice('/loop'.length).trim());
  }
  ```
  `COMMAND_HELP` gains its row so `/help` lists it.
- `src/tui-autocomplete.ts`: `TUI_COMMANDS` gains the same row in the `agent` lane, which is what
  puts the suggestion under the composer as `/loop` is typed.

## Verification

- `test/interactive.test.ts` gains one test: `/loop 5m /babysit-prs` reaches the provider exactly
  once, the single user text starts with `# /loop — schedule a recurring or self-paced prompt`, ends
  with the typed `5m /babysit-prs`, carries `Call cron_create with`, `schedule_wakeup`,
  `task_stop any monitor you armed (use task_list` and `invoke it via the \`skill\` tool`, and
  contains none of `CronCreate|CronDelete|ScheduleWakeup|TaskStop|TaskList|AskUserQuestion|Monitor|
  PushNotification`. 19/19 in that file, full suite 2747/2747, `npm run check` and `npm run build`
  clean.
- Compiled probe `.audit/w210-loop.mjs` (a local stub provider on `127.0.0.1`, so the body is
  readable): typing `/loop` shows `❯ /loop   agent  Repeat a prompt or command on an interval (e.g.
  /loop 5m /foo)` under the composer; Enter on `/loop 5m /probe-task` sends one request whose user
  text begins `# /loop — schedule a recurring or self-paced prompt` and ends `## Input\n\n5m
  /probe-task`, with the cron and skill sentences present and no vendor tool name anywhere.

## Adaptations and what stays out

- The no-argument branch (`y`) reads a `loop.md` task file through native storage V5 and its
  autonomous sentinels (`<<autonomous-loop>>`, `<<autonomous-loop-dynamic>>`). That chain is W208;
  until it lands, an empty input keeps this branch's own usage line, `/loop [interval] <prompt>`.
- The per-model pre-arm flag (`r$`) is false for every model this host configures, so the `o` branch
  of `R` is the one ported.
- The cloud/PR-steward block (`aJe`), the cloud offer (`x`) and the cloud confirmation (`C`) are
  account and remote-session work and stay out, as does the push-notification sentence, whose gate
  `PCe()` is false here.
- `zI()` (brief mode) is false, so the update sentence is the plain visible-text variant
  `v0n({preArmStatus:false, briefMode:false})` rather than the brief one.
- The monitor deadline sentence uses this host's `monitor` ceiling, 30 minutes
  (`timeout_ms: 1800000`), not the recovered default.
