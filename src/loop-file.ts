/**
 * The loop-file runtime behind `/loop` with no prompt. Recovered from `chunk-ryyp81k6.js`, sha256
 * `99f4d0b9ac75f3a98980830e40e536f688612aab35613e762dc8e9dd33d59d82`: the persistent gate `c` at
 * [5448,5547), the preamble getter `L` at [5547,5664), the push sentence `s` at [5735,6289), the
 * cron tick `P` at [6289,6586), the delay paragraph `d` at [6586,7232), the dynamic tick `N` at
 * [7232,7759), the autonomous sentinel test `_` at [7759,7797), the autonomous resolver `A` at
 * [7797,8890), the sentinel literals `w`/`D`/`l` at [7994,8066), the loop-file ticks `q` at
 * [8066,8364) and `j` at [8364,8890), the absent tick `B` at [8890,9463), the truncation limit `h`
 * and `U` at [9463,9647), the path builders `S`/`T`/`W` at [9647,9774), the readers `b`/`u`/`O`/`g`
 * at [9774,10087), the file reader `Y` at [10087,10370), the loop-file test `m` at [10370,10404),
 * the resolvers `H`/`z`/`R` at [10404,11124) and the exports at [11124,11524). Offsets are
 * zero-based UTF-16 code units.
 *
 * The source interpolates tool display names from the tool registry; this host's names are
 * substituted one for one, as in `./loop-command.ts`: `wa`→`schedule_wakeup`, `Pl`→`monitor`,
 * `nR`→`task_list`, `Uc`→`task_stop`. Three source gates resolve to fixed local values and their
 * branches are dropped with them: `PCe()` (push notification) is false, so `s()` is empty and the
 * `g()` sentence in `./loop-command.ts` is empty; `zI()` (brief mode) is false, so every update is
 * plain visible text; and `r$()` (per-model pre-arm) is false, so `d()` takes its post-arm branch.
 *
 * The storage half of `Y` is out of reach here. The recovered reader asks a native storage V5
 * handle for the `state`/`loop-file` entry and falls back to a direct `fs` read of the user file
 * when no handle was handed in — `if(!e)return u(o)`. The bundled backend factory is the stub
 * `function Mbr(){if(!j())return;return}`, so that handle is undefined in this build and the
 * fallback is the live path; this port therefore keeps the two direct reads and drops the middle
 * step. See `research/ports/W208-loop-file-runtime.md`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AUTONOMOUS_LOOP_PREAMBLE } from './loop-autonomous-preamble.js';
import { HARNESS_DIR } from './config.js';

/** Source `D` at [7994,8010) and `l` at [8010,8032). */
export const LOOP_FILE_SENTINEL = '<<loop.md>>';
export const LOOP_FILE_DYNAMIC_SENTINEL = '<<loop.md-dynamic>>';

/** Source `Eqe`/`xCe` in `chunk-3857kmpe.js` (line 666), re-exported into the runtime module. */
export const AUTONOMOUS_LOOP_SENTINEL = '<<autonomous-loop>>';
export const AUTONOMOUS_LOOP_DYNAMIC_SENTINEL = '<<autonomous-loop-dynamic>>';

/** Source `w` at [7994,7994+22): the delivery-state marker for the preamble-only tick. */
const AUTONOMOUS_PREAMBLE_DELIVERED = '__autonomous_preamble__';

/** Source `h` at [9463,9475). The recovered message calls this a byte count; the arithmetic is on
 * UTF-16 code units, and the port keeps both the limit and the wording. */
export const LOOP_FILE_LIMIT = 25_000;

/** Source `v0n({preArmStatus:false, briefMode:false})` in `chunk-3857kmpe.js` [746,…). */
const VISIBLE_UPDATE = 'This must be ordinary visible response text — the user cannot see your ' +
  'thinking/reasoning, so an update written only there is invisible to them. Make it the last ' +
  'thing in the turn, then end the turn.';

export type LoopFile = { path: string; content: string };

/**
 * The delivery state the resolvers mutate, one per session. Source: the `autonomousLoopPreamble`
 * object the fire path passes in (`chunk-appb2dtz.js` [18100,…)) with `autonomousPreambleDelivered`
 * and `lastLoopFileDelivered`.
 */
export type LoopDeliveryState = {
  autonomousPreambleDelivered: boolean;
  lastLoopFileDelivered: string | null;
};

export function newLoopDeliveryState(): LoopDeliveryState {
  return { autonomousPreambleDelivered: false, lastLoopFileDelivered: null };
}

/** Source `p` at [5318,5378) through `L` at [5547,5664). The persistent variant `y` is gated off. */
export function getAutonomousLoopPreamble(): string {
  return AUTONOMOUS_LOOP_PREAMBLE;
}

/**
 * Source `S`/`T` at [9682,9774): the project file first, then the config-home file. The recovered
 * roots are the project directory plus `.claude` and the config home; this host's equivalents are
 * the workspace plus `HARNESS_DIR` and the harness user directory.
 */
export function loopFilePaths(workspace: string, userDir: string): { project: string; user: string } {
  return { project: join(workspace, HARNESS_DIR, 'loop.md'), user: join(userDir, 'loop.md') };
}

/** Source `m(e)` at [10370,10404). */
export function isLoopFileSentinel(prompt: string): boolean {
  return prompt === LOOP_FILE_SENTINEL || prompt === LOOP_FILE_DYNAMIC_SENTINEL;
}

/** Source `_(e)` at [7759,7797). */
export function isAutonomousLoopSentinel(prompt: string): boolean {
  return prompt === AUTONOMOUS_LOOP_SENTINEL || prompt === AUTONOMOUS_LOOP_DYNAMIC_SENTINEL;
}

/** Source `ye(e)` at [11124,11157): either family is a loop default that expands at fire time. */
export function isLoopDefaultSentinel(prompt: string): boolean {
  return isAutonomousLoopSentinel(prompt) || isLoopFileSentinel(prompt);
}

/**
 * Source `U(e)` at [9475,9647): a file over the limit is cut at the last line break at or before
 * it, and the warning is appended after a blank line.
 */
export function truncateLoopFile(content: string): string {
  if (content.length <= LOOP_FILE_LIMIT) return content;
  const cut = content.lastIndexOf('\n', LOOP_FILE_LIMIT);
  return `${content.slice(0, cut > 0 ? cut : LOOP_FILE_LIMIT)}

> WARNING: loop.md was truncated to ${LOOP_FILE_LIMIT} bytes. Keep the task list concise.`;
}

/** Source `g(e,t)` at [9994,10087): trimmed, and empty content is no file at all. */
function describeLoopFile(path: string, text: string): LoopFile | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return { path, content: truncateLoopFile(trimmed) };
}

/** Source `O(e)` at [9934,9994) with `jt` from `chunk-886tf6ja.js` [8341,…): a missing or
 * unreadable path is no file, and any other failure is a real error. */
function readOrNull(path: string): LoopFile | null {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const expected = new Set(['ENOENT', 'EACCES', 'EPERM', 'ENOTDIR', 'ELOOP', 'ENAMETOOLONG', 'EROFS', 'EISDIR']);
    if (code !== undefined && expected.has(code)) return null;
    throw error;
  }
  return describeLoopFile(path, text);
}

/** Source `W()` at [9647,9682): the project file, else the user file. */
export function readLoopFile(workspace: string, userDir: string): LoopFile | null {
  const paths = loopFilePaths(workspace, userDir);
  return readOrNull(paths.project) ?? readOrNull(paths.user);
}

/** Source `q()` at [8066,8364): the fixed-interval loop-file tick. */
function loopFileTick(): string {
  return `# /loop tick — loop.md tasks

Work the tasks from the loop.md contents established earlier in this conversation. If you cannot find them, treat this as a no-op tick. The recurring cron will fire the next tick automatically — do not call schedule_wakeup from this tick.`;
}

/** Source `j()` at [8364,8890): the dynamic-pacing loop-file tick. */
function loopFileDynamicTick(): string {
  return `# /loop tick — loop.md tasks (dynamic pacing)

Work the tasks from the loop.md contents established earlier in this conversation. If you cannot find them, treat this as a no-op tick.

You scheduled this tick via the schedule_wakeup tool (not a recurring cron). To keep the loop alive, call schedule_wakeup again this turn with \`prompt\` set to the literal sentinel \`${LOOP_FILE_DYNAMIC_SENTINEL}\` and \`noop\` set to \`true\` if this tick changed nothing (or \`false\` if it did) — otherwise the loop ends after this tick.${delayParagraph()}`;
}

/** Source `B()` at [8890,9463): the dynamic tick when no loop file exists. */
function loopFileAbsentTick(): string {
  return `# /loop tick — loop.md absent (dynamic pacing)

loop.md is not currently present. Run the autonomous check using the loop instructions established earlier in this conversation.

You scheduled this tick via the schedule_wakeup tool (not a recurring cron). To keep the loop alive — and to pick up loop.md if it is recreated — call schedule_wakeup again this turn with \`prompt\` set to the literal sentinel \`${LOOP_FILE_DYNAMIC_SENTINEL}\` and \`noop\` set to \`true\` if this tick changed nothing (or \`false\` if it did) — otherwise the loop ends after this tick.${delayParagraph()}`;
}

/** Source `P()` at [6289,6586): the recurring-cron autonomous tick. */
function autonomousCronTick(): string {
  return `# Autonomous loop tick

Run the autonomous check using the loop instructions established earlier in this conversation. If you cannot find them, treat this as a no-op tick. The recurring cron will fire the next tick automatically — do not call schedule_wakeup from this tick.`;
}

/** Source `N()` at [7232,7759): the dynamic-pacing autonomous tick. */
function autonomousDynamicTick(): string {
  return `# Autonomous loop tick (dynamic pacing)

Run the autonomous check using the loop instructions established earlier in this conversation. If you cannot find them, treat this as a no-op tick.

You scheduled this tick via the schedule_wakeup tool (not a recurring cron). To keep the loop alive, call schedule_wakeup again this turn with \`prompt\` set to the literal sentinel \`${AUTONOMOUS_LOOP_DYNAMIC_SENTINEL}\` and \`noop\` set to \`true\` if this tick changed nothing (or \`false\` if it did) — otherwise the loop ends after this tick.${delayParagraph()}`;
}

/** Source `d()` at [6586,7232): the shared re-arm and stop paragraph of every dynamic tick. */
function delayParagraph(): string {
  return `

If a monitor is armed (check task_list), keep \`delaySeconds\` at 1200–1800s — the monitor is the wake signal and this is only the fallback heartbeat. If you were woken by a \`<task-notification>\`, handle the event before deciding whether to re-arm. After re-arming, write a brief status update for this tick. ${VISIBLE_UPDATE} To stop the loop, call schedule_wakeup with \`stop: true\` and task_stop the monitor (use task_list to find its task ID if no longer in context).`;
}

/**
 * Source `A(e,t)` at [7797,8890): the autonomous sentinel resolver. The first delivery carries the
 * preamble; a later delivery is the short tick alone. The activation telemetry `I()` is dropped.
 */
function resolveAutonomous(state: LoopDeliveryState, prompt: string): string | null {
  if (!isAutonomousLoopSentinel(prompt)) return null;
  const tick = prompt === AUTONOMOUS_LOOP_DYNAMIC_SENTINEL ? autonomousDynamicTick() : autonomousCronTick();
  if (state.autonomousPreambleDelivered || state.lastLoopFileDelivered !== null) return tick;
  state.autonomousPreambleDelivered = true;
  return `${getAutonomousLoopPreamble()}

---

${tick}`;
}

/**
 * Source `R(e,t,o)` at [10529,11124): the loop-file sentinel resolver. The full instructions go out
 * when the file content differs from the last delivery — including the first — and the short tick
 * alone repeats while it does not. With no file, the tick is the absent variant and the preamble
 * rides the first delivery of that state.
 */
function resolveLoopFile(state: LoopDeliveryState, sentinel: string, file: LoopFile | null): string {
  const dynamic = sentinel === LOOP_FILE_DYNAMIC_SENTINEL;
  if (file) {
    const tick = dynamic ? loopFileDynamicTick() : loopFileTick();
    if (state.lastLoopFileDelivered === file.content) return tick;
    state.lastLoopFileDelivered = file.content;
    return `# /loop tick — tasks from ${file.path}

The user configured a loop-tasks file. Work through the tasks defined below; these are the instructions for this tick and every subsequent tick (the reminder on later fires refers back to this message).

---

${file.content}

---

${tick}`;
  }
  const tick = dynamic ? loopFileAbsentTick() : autonomousCronTick();
  if (state.lastLoopFileDelivered === AUTONOMOUS_PREAMBLE_DELIVERED || state.autonomousPreambleDelivered) return tick;
  state.lastLoopFileDelivered = AUTONOMOUS_PREAMBLE_DELIVERED;
  state.autonomousPreambleDelivered = true;
  return `${getAutonomousLoopPreamble()}

---

${tick}`;
}

/**
 * Source `we(e,t)` at [11157,11205): `A(e,t) ?? H(e,t) ?? t`. The synchronous reader keeps the
 * fire path synchronous, as the recovered sync resolver does; the async variant `ke` differs only
 * in awaiting the read, and this host has no backend to await.
 */
export function resolveLoopDefaultFire(
  state: LoopDeliveryState,
  prompt: string,
  read: () => LoopFile | null,
): string {
  const autonomous = resolveAutonomous(state, prompt);
  if (autonomous !== null) return autonomous;
  if (!isLoopFileSentinel(prompt)) return prompt;
  return resolveLoopFile(state, prompt, read());
}

/**
 * Source `C` in `chunk-appb2dtz.js` [18304,18490): the prompt a scheduled loop job shows in the
 * list. The stored prompt and the tool result keep the literal sentinel the loop instructions tell
 * the model to re-arm with.
 */
export function loopJobDisplayPrompt(prompt: string): string {
  if (!isLoopDefaultSentinel(prompt)) return prompt;
  return isLoopFileSentinel(prompt) ? '/loop (loop.md)' : '/loop';
}

/**
 * Source `C` applied at the job-store write in `chunk-appb2dtz.js` [18304,18490), reached here
 * through the `cron_list` payload the `/cron` command prints. The recovered `CronListTool` returns
 * the stored prompt untouched (`chunk-bws04yaw.js`, `prompt: e.prompt`), so the transform stays on
 * the display side and the model still sees the literal sentinel it has to re-arm with.
 */
export function displayCronJobs(text: string): string {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return text;
  }
  if (payload === null || typeof payload !== 'object') return text;
  const jobs = (payload as { jobs?: unknown }).jobs;
  if (!Array.isArray(jobs)) return text;
  const mapped = jobs.map(job => {
    if (job === null || typeof job !== 'object') return job;
    const prompt = (job as { prompt?: unknown }).prompt;
    if (typeof prompt !== 'string') return job;
    return { ...job, prompt: loopJobDisplayPrompt(prompt) };
  });
  return JSON.stringify({ ...payload, jobs: mapped });
}
