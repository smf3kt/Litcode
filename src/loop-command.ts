/**
 * The built-in `/loop` command. Recovered from `chunk-1eegq95r.js`, sha256
 * `b84d67a18c2873ac0f54b882718647305d0c037b20d1b873b5a2d49b9b3db65b`: the registration `se`
 * at [22959,24199) and its prompt builder `R` at [12484,17570). Offsets are zero-based UTF-16
 * code units.
 *
 * The recovered builder has three branches. This port carries the parse-and-schedule branch
 * (`R`), the one `/loop [interval] <prompt>` and `/loop <prompt>` take. The no-argument
 * autonomous default (`y`) reads a `loop.md` task file through native storage V5 and is
 * deferred with that chain (W208), so an empty input keeps the usage line this branch prints.
 *
 * The source interpolates tool display names from the tool registry. This host's names are
 * substituted one for one: `Wu`→`cron_create`, `$_`→`cron_delete`, `wa`→`schedule_wakeup`,
 * `Pl`→`monitor`, `Uc`→`task_stop`, `nR`→`task_list`, `Qo`→`ask_user_question`,
 * `Ro`→`skill`. Two source gates resolve to fixed local values and their branches are
 * dropped with them: `zI()` (brief mode) is false, so the update is plain visible text, and
 * `PCe()` is false, so the push-notification sentence `g()` is empty.
 */

/** Source `oat` = "loop" with its menu description, aliases and argument hint. */
export const LOOP_COMMAND = {
  name: 'loop',
  aliases: ['proactive'],
  menuDescription: 'Repeat a prompt or command on an interval (e.g. /loop 5m /foo)',
  description: 'Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace.',
  argumentHint: '[interval] [prompt]',
};

/** Source `S`: the interval-to-cron table, copied verbatim. */
const CRON_TABLE = `| Interval pattern      | Cron expression     | Notes                                    |
|-----------------------|---------------------|------------------------------------------|
| \`Nm\` where N ≤ 59   | \`*/N * * * *\`     | every N minutes                          |
| \`Nm\` where N ≥ 60   | \`0 */H * * *\`     | round to hours (H = N/60, must divide 24)|
| \`Nh\` where N ≤ 23   | \`0 */N * * *\`     | every N hours                            |
| \`Nd\`                | \`0 0 */N * *\`     | every N days at midnight local           |
| \`Ns\`                | treat as \`ceil(N/60)m\` | cron minimum granularity is 1 minute  |

**If the interval doesn't cleanly divide its unit** (e.g. \`7m\` → \`*/7 * * * *\` gives uneven gaps at :56→:00; \`90m\` → 1.5h which cron can't express), pick the nearest clean interval and tell the user what you rounded to before scheduling.`;

/** Source `dre()`/`vqe()`/`C0n` with this host's monitor deadline: 30 minutes, the ceiling. */
const MONITOR_ARMING = 'arm one now with `timeout_ms: 1800000`';
const MONITOR_EXPIRY = 'A monitor expires after at most 30 minutes and tells you; on later ' +
  'iterations call task_list first and re-arm only if no monitor for it is still running.';

/** Source `v0n({preArmStatus:false, briefMode:false})`. */
const VISIBLE_UPDATE = 'This must be ordinary visible response text — the user cannot see your ' +
  'thinking/reasoning, so an update written only there is invisible to them. Make it the last ' +
  'thing in the turn, then end the turn.';

/** Source `k0n({briefMode:false})` inside `w()`. */
const STOPPED_OUTCOME = 'write the loop\'s outcome for the user as ordinary visible response text';

/**
 * Source `R(e, o)` with `o` false (the per-model pre-arm flag `r$` is false for every model
 * this host configures) and the cloud/PR-steward block `aJe`, the cloud offer `x()` and the
 * cloud confirmation `C()` replaced by nothing, as the account and remote-session work is out
 * of scope here.
 */
export function loopCommandPrompt(input: string): string {
  const decideBody = `If the task needs another iteration, call schedule_wakeup with:
   - \`delaySeconds\`: with a monitor armed this is the **fallback heartbeat** — how long to wait if no event fires (lean 1200–1800s; idle ticks more frequent than the task needs are pure overhead). Without a monitor this is the cadence — pick based on what you observed. Read the tool's own description for cache-aware delay guidance.
   - \`reason\`: one short sentence on why you picked that delay.
   - \`prompt\`: the full original /loop input verbatim, prefixed with \`/loop \` so the next firing re-enters this skill and continues the loop. For example, if the user typed \`/loop check the deploy\`, pass \`/loop check the deploy\` as the prompt.
   - \`noop\`: \`true\` if this tick changed nothing ("still waiting", "quiet hold"); \`false\` if it did something worth keeping. Consecutive \`noop: true\` ticks collapse in the terminal.
   If it doesn't need another iteration, stop instead (step 6) — re-arming is a per-turn choice, not a default.`;
  // Source `b({preArmStatus:false, …})`: the decide step leads and the confirmation follows.
  const steps34 = `3. **Decide whether the loop continues.** ${decideBody}
4. **After the wakeup is armed, briefly confirm**: that you're self-pacing, whether a monitor is the primary wake signal, that you ran the task now, and what fallback delay you picked. ${VISIBLE_UPDATE}`;
  const rearmUpdate = (body: string) => `${body}, then write the same brief update as visible text`;
  const dynamic = `The user wants you to self-pace. Decide what makes the next iteration worth running — a passage of time, or an observable event.

1. **Run the parsed prompt now.** If it's a slash command, invoke it via the \`skill\` tool; otherwise act on it directly.
2. **If the next run is gated on an event** (CI finishing, a log line matching, a file changing, a PR comment) and no monitor is already running for it: ${MONITOR_ARMING}. Its events arrive as \`<task-notification>\` messages and wake this loop immediately — you do not wait for the schedule_wakeup deadline. ${MONITOR_EXPIRY}
${steps34}
5. **If you were woken by a \`<task-notification>\`** rather than this prompt: handle the event in the context of the loop task, then make the same decision. If the loop should continue, ${rearmUpdate('call schedule_wakeup again with the same `prompt` and the same 1200–1800s `delaySeconds` from the schedule step above (the monitor remains the wake signal; the new wakeup is only the fallback heartbeat)')}. If the event means the work is finished, stop (step 6).
6. **To stop the loop** — the task is complete, further iterations can't make progress, or the user asked you to stop — call schedule_wakeup with \`stop: true\` (no other fields) and task_stop any monitor you armed (use task_list to find the task ID if it is no longer in context). Then ${STOPPED_OUTCOME} — a stopped loop has no next tick to surface it. Stopping is the loop's normal ending — the user can restart it anytime with /loop.`;
  return `# /loop — schedule a recurring or self-paced prompt

Parse the input below into \`[interval] <prompt…>\` and schedule it.

## Parsing (in priority order)

1. **Leading token**: if the first whitespace-delimited token matches \`^\\d+[smhd]$\` (e.g. \`5m\`, \`2h\`), that's the interval; the rest is the prompt.
2. **Trailing "every" clause**: otherwise, if the input ends with \`every <N><unit>\` or \`every <N> <unit-word>\` (e.g. \`every 20m\`, \`every 5 minutes\`, \`every 2 hours\`), extract that as the interval and strip it from the prompt. Only match when what follows "every" is a time expression — \`check every PR\` has no interval.
3. **No interval**: otherwise, the entire input is the prompt and you'll self-pace dynamically (see "Dynamic mode" below).

If the resulting prompt is empty, show usage \`/loop [interval] <prompt>\` and stop.

Examples:
- \`5m /babysit-prs\` → interval \`5m\`, prompt \`/babysit-prs\` (rule 1)
- \`check the deploy every 20m\` → interval \`20m\`, prompt \`check the deploy\` (rule 2)
- \`run tests every 5 minutes\` → interval \`5m\`, prompt \`run tests\` (rule 2)
- \`check the deploy\` → no interval → dynamic mode, prompt \`check the deploy\` (rule 3)
- \`check every PR\` → no interval → dynamic mode, prompt \`check every PR\` (rule 3 — "every" not followed by time)
- \`5m\` → empty prompt → show usage

## Fixed-interval mode (rules 1 and 2)

Convert the interval to a cron expression:

${CRON_TABLE}

Then:
1. Call cron_create with: \`cron\` (the expression above), \`prompt\` (the parsed prompt verbatim), \`recurring: true\`.
2. Briefly confirm: what's scheduled, the cron expression, the human-readable cadence, that recurring tasks auto-expire after 7 days, and that the user can cancel sooner with cron_delete (include the job ID).
3. **Then immediately execute the parsed prompt now** — don't wait for the first cron fire. If it's a slash command, invoke it via the \`skill\` tool; otherwise act on it directly.

## Dynamic mode (rule 3 — no interval)

${dynamic}

## Input

${input}`;
}
