/**
 * The built-in `/loop` command. Recovered from `chunk-1eegq95r.js`, sha256
 * `b84d67a18c2873ac0f54b882718647305d0c037b20d1b873b5a2d49b9b3db65b`: the registration `se`
 * at [22959,24199), its prompt builder `R` at [12484,17570), the no-prompt builder `y` at
 * [17570,22959), the interval matchers `m`/`f` and the normaliser `L` at [7642,7797), and the
 * shared helpers `k`/`v`/`b`/`g`/`w` at [7422,7642). Offsets are zero-based UTF-16 code units.
 *
 * The recovered builder has two branches. `R` takes an input that carries a prompt and hands the
 * model the parse-and-schedule instructions. `y` takes an empty input or a bare interval, reads
 * the loop-tasks file through `./loop-file.ts`, and expands either the loop.md tasks or the
 * autonomous default — dynamic pacing for the empty input, a recurring cron for the interval.
 *
 * The source interpolates tool display names from the tool registry. This host's names are
 * substituted one for one: `Wu`→`cron_create`, `$_`→`cron_delete`, `wa`→`schedule_wakeup`,
 * `Pl`→`monitor`, `Uc`→`task_stop`, `nR`→`task_list`, `Qo`→`ask_user_question`,
 * `Ro`→`skill`. Two source gates resolve to fixed local values and their branches are
 * dropped with them: `zI()` (brief mode) is false, so the update is plain visible text, and
 * `PCe()` is false, so the push-notification sentence `g()` is empty. `TCe` is 7 days.
 */

import type { LoopFile } from './loop-file.js';
import {
  AUTONOMOUS_LOOP_DYNAMIC_SENTINEL, AUTONOMOUS_LOOP_SENTINEL, LOOP_FILE_DYNAMIC_SENTINEL,
  LOOP_FILE_SENTINEL, getAutonomousLoopPreamble,
} from './loop-file.js';

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

/** Source `v(e)` at [11531,11920): the noun is `iterations` in `R` and `ticks` in `y`. */
function monitorExpiry(noun: 'iterations' | 'ticks'): string {
  return 'A monitor expires after at most 30 minutes and tells you; on later ' + noun +
    ' call task_list first and re-arm only if no monitor for it is still running.';
}

/** Source `A` at [7414,7422): the interval the no-prompt branch schedules when none was typed. */
const DEFAULT_LOOP_INTERVAL = '10m';

/** Source `v0n({preArmStatus:false, briefMode:false})`. */
const VISIBLE_UPDATE = 'This must be ordinary visible response text — the user cannot see your ' +
  'thinking/reasoning, so an update written only there is invisible to them. Make it the last ' +
  'thing in the turn, then end the turn.';

/** Source `k0n({briefMode:false})` inside `w()`. */
const STOPPED_OUTCOME = 'write the loop\'s outcome for the user as ordinary visible response text';

/** Source `b({preArmStatus:false, …})`: the wakeup re-arm sentence, shared by `R` and `y`. */
const rearmUpdate = (body: string) => `${body}, then write the same brief update as visible text`;

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
  const dynamic = `The user wants you to self-pace. Decide what makes the next iteration worth running — a passage of time, or an observable event.

1. **Run the parsed prompt now.** If it's a slash command, invoke it via the \`skill\` tool; otherwise act on it directly.
2. **If the next run is gated on an event** (CI finishing, a log line matching, a file changing, a PR comment) and no monitor is already running for it: ${MONITOR_ARMING}. Its events arrive as \`<task-notification>\` messages and wake this loop immediately — you do not wait for the schedule_wakeup deadline. ${monitorExpiry('iterations')}
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

/** Source `m` at [7650,7674) and `f` at [7674,7797), copied verbatim. */
const INTERVAL = /^\d+[smhd]$/;
const EVERY = /^every\s+(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\s*$/i;

/** Source `L(e)` at [7797,7912): the `every <N> <unit>` clause normalised to the `Nm` form. */
function normaliseEvery(match: RegExpExecArray): string {
  const count = match[1];
  const unit = match[2]!.toLowerCase();
  if (unit.startsWith('s')) return `${count}s`;
  if (unit.startsWith('h')) return `${count}h`;
  if (unit.startsWith('d')) return `${count}d`;
  return `${count}m`;
}

/**
 * Source the branch selector inside `se.getPromptForCommand`: `l = !t`, `c = m.test(t) || n !== null`.
 * A null result means the input carries a prompt and `loopCommandPrompt` takes it.
 */
export function loopAutonomousInterval(input: string): { dynamic: boolean; interval: string } | null {
  const every = EVERY.exec(input);
  const dynamic = input === '';
  if (!dynamic && !INTERVAL.test(input) && every === null) return null;
  return { dynamic, interval: every === null ? (input || DEFAULT_LOOP_INTERVAL) : normaliseEvery(every) };
}

/**
 * Source `y(e, o, t, s)` at [17570,22959) with `s` false (the per-model pre-arm flag `r$` is false
 * for every model this host configures) and the cloud/PR-steward block `aJe` replaced by nothing.
 * `o` selects dynamic pacing, `t` is the interval the fixed branch schedules, and `e` is the
 * loop-tasks file the runtime resolved, or null when there is none.
 */
export function loopAutonomousPrompt(options: { file: LoopFile | null; dynamic: boolean; interval: string }): string {
  const { file, dynamic, interval } = options;
  const heading = file === null
    ? '## Autonomous-loop instructions (for the immediate execution and every fire)'
    : `## Loop tasks (from ${file.path})`;
  const instructions = file === null ? getAutonomousLoopPreamble() : file.content;
  const subject = file === null ? 'the autonomous check' : 'the loop.md tasks';
  const tail = `${heading}

${instructions}`;

  if (dynamic) {
    const sentinel = file === null ? AUTONOMOUS_LOOP_DYNAMIC_SENTINEL : LOOP_FILE_DYNAMIC_SENTINEL;
    const lead = file === null
      ? `# /loop — autonomous default with dynamic pacing

The user invoked \`/loop\` with no prompt and no interval. Run the autonomous check now, then self-pace the next iteration via schedule_wakeup — no cron.`
      : `# /loop — loop.md tasks with dynamic pacing

The user invoked \`/loop\` with no prompt and no interval and has a loop-tasks file at \`${file.path}\`. Run those tasks now, then self-pace the next iteration via schedule_wakeup — no cron.`;
    const confirm = file === null
      ? 'that this is the autonomous default in dynamic-pacing mode, that you ran the check now'
      : `that you're running tasks from \`${file.path}\` in dynamic-pacing mode, that you ran the first tick now`;
    const decideBody = `If the next check is worth running, call schedule_wakeup with:
   - \`delaySeconds\`: with a monitor armed this is the fallback heartbeat (lean 1200–1800s). Without one, pick based on what you observed this turn — quiet branch? wait longer. Lots in flight? wait shorter. Read the tool's own description for cache-aware delay guidance.
   - \`reason\`: one short sentence on why you picked that delay.
   - \`prompt\`: the literal string \`${sentinel}\` — the dynamic-mode sentinel expands at fire time to the full instructions (first fire / first fire post-compact / loop.md edited) or a dynamic-pacing-specific short reminder (subsequent fires). Do not pass the full instructions; that is handled automatically.
   - \`noop\`: \`true\` if this tick changed nothing ("still waiting", "quiet hold"); \`false\` if it did something worth keeping. Consecutive \`noop: true\` ticks collapse in the terminal.
   If it isn't, stop instead (step 6) — re-arming is a per-turn choice, not a default.`;
    const steps34 = `3. **Decide whether the loop continues.** ${decideBody}
4. **After the wakeup is armed, briefly confirm**: ${confirm}, whether a monitor is the primary wake signal, and what fallback delay you picked. ${VISIBLE_UPDATE}`;
    const action = `1. **Run ${subject} now**, following the instructions inlined below.
2. **If the next tick is gated on an event** (CI finishing, a PR comment, a log line) and no monitor is already running for it: ${MONITOR_ARMING}. Its events wake this loop immediately — you do not wait for the schedule_wakeup deadline. ${monitorExpiry('ticks')}
${steps34}
5. **If woken by a \`<task-notification>\`** rather than this prompt: handle the event, then make the same decision. If the loop should continue, ${rearmUpdate(`call schedule_wakeup again with \`${sentinel}\` and the same 1200–1800s \`delaySeconds\` (the monitor remains the wake signal; the new wakeup is only the fallback heartbeat)`)}. If the event means the work is finished, stop (step 6).
6. **To stop the loop** — the task is complete, further iterations can't make progress, or the user asked you to stop — call schedule_wakeup with \`stop: true\` (no other fields) and task_stop any monitor you armed (use task_list to find the task ID if it is no longer in context). Then ${STOPPED_OUTCOME} — a stopped loop has no next tick to surface it. Stopping is the loop's normal ending — the user can restart it anytime with /loop.`;
    return `${lead}

## Action

${action}

${tail}`;
  }

  const sentinel = file === null ? AUTONOMOUS_LOOP_SENTINEL : LOOP_FILE_SENTINEL;
  const lead = file === null
    ? `# /loop — schedule the autonomous default

The user invoked \`/loop\` with no prompt (input was empty or just the interval \`${interval}\`). Schedule the autonomous-loop default and then run the first autonomous check immediately.`
    : `# /loop — schedule loop.md tasks

The user invoked \`/loop\` with no prompt (input was empty or just the interval \`${interval}\`) and has a loop-tasks file at \`${file.path}\`. Schedule a recurring cron that runs those tasks each tick, then run the first tick immediately.`;
  const expansion = file === null
    ? 'it expands at fire time to the full autonomous-loop instructions on first delivery, and to a short reminder on subsequent fires (the long instructions stay in the cached message-prefix).'
    : 'it expands at fire time to the full loop.md contents on first delivery (and whenever loop.md has been edited since last fire), and to a short reminder on subsequent unchanged fires. The long instructions stay in the cached message-prefix.';
  const confirm = file === null
    ? 'what\'s scheduled, the cron expression, the human-readable cadence, that recurring tasks auto-expire after 7 days, and that they can cancel sooner with cron_delete (include the job ID). Mention this is the autonomous default and that the autonomous-loop instructions are baked in.'
    : `what's scheduled, the cron expression, the human-readable cadence, that it's running tasks from \`${file.path}\`, that recurring tasks auto-expire after 7 days, and that the user can cancel sooner with cron_delete (include the job ID).`;
  return `${lead}

## Action

1. Convert \`${interval}\` to a 5-field cron expression. Supported suffixes: \`s\` → ceil to nearest minute, \`m\` (minutes), \`h\` (hours), \`d\` (days). Examples: \`5m\` → \`*/5 * * * *\`, \`1h\` → \`0 * * * *\`, \`1d\` → \`0 0 * * *\`. If the interval doesn't cleanly divide its unit, round to the nearest clean interval and tell the user what you rounded to.
2. Call cron_create with:
   - \`cron\`: the expression from step 1
   - \`prompt\`: the literal string \`${sentinel}\` — ${expansion}
   - \`recurring\`: \`true\`
3. Briefly confirm: ${confirm}
4. **Then immediately run ${subject} now**, following the instructions inlined below. Don't wait for the first cron fire.

${tail}`;
}
