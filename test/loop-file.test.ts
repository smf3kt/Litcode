import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { HARNESS_DIR } from '../src/config.js';
import { loopAutonomousInterval, loopAutonomousPrompt } from '../src/loop-command.js';
import {
  AUTONOMOUS_LOOP_DYNAMIC_SENTINEL, AUTONOMOUS_LOOP_SENTINEL, LOOP_FILE_DYNAMIC_SENTINEL,
  LOOP_FILE_LIMIT, LOOP_FILE_SENTINEL, displayCronJobs, getAutonomousLoopPreamble,
  isLoopDefaultSentinel, isLoopFileSentinel, loopFilePaths, loopJobDisplayPrompt,
  newLoopDeliveryState, readLoopFile, resolveLoopDefaultFire, truncateLoopFile,
} from '../src/loop-file.js';

/** A workspace plus a user directory, each able to carry its own `loop.md`. */
function roots(): { workspace: string; userDir: string } {
  const workspace = mkdtempSync(join(tmpdir(), 'loop-ws-'));
  const userDir = mkdtempSync(join(tmpdir(), 'loop-user-'));
  return { workspace, userDir };
}

function writeLoopFile(directory: string, content: string, project: boolean): void {
  const target = project ? join(directory, HARNESS_DIR) : directory;
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'loop.md'), content);
}

test('the branch selector takes an empty input and a bare interval, and nothing else', () => {
  // Source `m`/`f`/`L` in chunk-1eegq95r.js [7650,7797): `l = !t`, `c = m.test(t) || n !== null`.
  assert.deepEqual(loopAutonomousInterval(''), { dynamic: true, interval: '10m' });
  assert.deepEqual(loopAutonomousInterval('5m'), { dynamic: false, interval: '5m' });
  assert.deepEqual(loopAutonomousInterval('2h'), { dynamic: false, interval: '2h' });
  assert.deepEqual(loopAutonomousInterval('every 5 minutes'), { dynamic: false, interval: '5m' });
  assert.deepEqual(loopAutonomousInterval('every 2 hours'), { dynamic: false, interval: '2h' });
  assert.deepEqual(loopAutonomousInterval('every 1 day'), { dynamic: false, interval: '1d' });
  assert.deepEqual(loopAutonomousInterval('every 30 secs'), { dynamic: false, interval: '30s' });
  // An input that carries a prompt keeps the parse-and-schedule branch, even with an interval in it.
  assert.equal(loopAutonomousInterval('5m check the deploy'), null);
  assert.equal(loopAutonomousInterval('check the deploy'), null);
  assert.equal(loopAutonomousInterval('check every PR'), null);
  assert.equal(loopAutonomousInterval('5M'), null);
});

test('the sentinel families are recognised and shown as the recovered loop labels', () => {
  assert.equal(isLoopFileSentinel(LOOP_FILE_SENTINEL), true);
  assert.equal(isLoopFileSentinel(LOOP_FILE_DYNAMIC_SENTINEL), true);
  assert.equal(isLoopFileSentinel(AUTONOMOUS_LOOP_SENTINEL), false);
  assert.equal(isLoopDefaultSentinel(AUTONOMOUS_LOOP_DYNAMIC_SENTINEL), true);
  assert.equal(isLoopDefaultSentinel('check the deploy'), false);
  // Source `C` in chunk-appb2dtz.js [18304,18490).
  assert.equal(loopJobDisplayPrompt(AUTONOMOUS_LOOP_SENTINEL), '/loop');
  assert.equal(loopJobDisplayPrompt(AUTONOMOUS_LOOP_DYNAMIC_SENTINEL), '/loop');
  assert.equal(loopJobDisplayPrompt(LOOP_FILE_SENTINEL), '/loop (loop.md)');
  assert.equal(loopJobDisplayPrompt(LOOP_FILE_DYNAMIC_SENTINEL), '/loop (loop.md)');
  assert.equal(loopJobDisplayPrompt('check the deploy'), 'check the deploy');
});

test('the cron list shows the loop label and leaves every other job prompt alone', () => {
  const text = JSON.stringify({ jobs: [
    { id: 'job-1', cron: '*/5 * * * *', prompt: LOOP_FILE_SENTINEL, recurring: true },
    { id: 'job-2', cron: '0 * * * *', prompt: 'check the deploy', recurring: true },
  ] });
  assert.deepEqual(JSON.parse(displayCronJobs(text)), { jobs: [
    { id: 'job-1', cron: '*/5 * * * *', prompt: '/loop (loop.md)', recurring: true },
    { id: 'job-2', cron: '0 * * * *', prompt: 'check the deploy', recurring: true },
  ] });
  // Anything that is not a job list is passed through untouched.
  assert.equal(displayCronJobs('not json'), 'not json');
  assert.equal(displayCronJobs('[]'), '[]');
});

test('a loop file over the limit is cut at a line break and warned about', () => {
  const short = 'work the list\n';
  assert.equal(truncateLoopFile(short), short);
  const long = `${'x'.repeat(LOOP_FILE_LIMIT)}\nsecond line\n`;
  const cut = truncateLoopFile(long);
  assert.equal(cut, `${'x'.repeat(LOOP_FILE_LIMIT)}\n\n> WARNING: loop.md was truncated to ${LOOP_FILE_LIMIT} bytes. Keep the task list concise.`);
});

test('the project loop file wins, an empty one falls through, and a missing one is null', () => {
  const { workspace, userDir } = roots();
  assert.equal(readLoopFile(workspace, userDir), null);
  writeLoopFile(userDir, 'from the user file', false);
  assert.deepEqual(readLoopFile(workspace, userDir),
    { path: loopFilePaths(workspace, userDir).user, content: 'from the user file' });
  // A whitespace-only project file is no file, exactly as the recovered reader treats it.
  writeLoopFile(workspace, '   \n', true);
  assert.equal(readLoopFile(workspace, userDir)?.content, 'from the user file');
  writeLoopFile(workspace, 'from the project file\n', true);
  assert.deepEqual(readLoopFile(workspace, userDir),
    { path: loopFilePaths(workspace, userDir).project, content: 'from the project file' });
});

test('an autonomous fire carries the preamble once and the short tick after that', () => {
  const state = newLoopDeliveryState();
  const read = () => null;
  const first = resolveLoopDefaultFire(state, AUTONOMOUS_LOOP_SENTINEL, read);
  assert.equal(first, `${getAutonomousLoopPreamble()}\n\n---\n\n# Autonomous loop tick\n\nRun the autonomous check using the loop instructions established earlier in this conversation. If you cannot find them, treat this as a no-op tick. The recurring cron will fire the next tick automatically — do not call schedule_wakeup from this tick.`);
  const second = resolveLoopDefaultFire(state, AUTONOMOUS_LOOP_SENTINEL, read);
  assert.equal(second.startsWith('# Autonomous loop tick\n'), true);
  assert.equal(second.includes('Autonomous loop check'), false);
  // The dynamic sentinel is its own tick text and still shares the one-time preamble.
  const dynamic = resolveLoopDefaultFire(newLoopDeliveryState(), AUTONOMOUS_LOOP_DYNAMIC_SENTINEL, read);
  assert.equal(dynamic.includes('# Autonomous loop tick (dynamic pacing)'), true);
  assert.equal(dynamic.includes(AUTONOMOUS_LOOP_DYNAMIC_SENTINEL), true);
});

test('a loop-file fire inlines the file, repeats the tick, and re-inlines after an edit', () => {
  const state = newLoopDeliveryState();
  const file = { path: '/w/.harness/loop.md', content: 'run the tests' };
  const first = resolveLoopDefaultFire(state, LOOP_FILE_SENTINEL, () => file);
  assert.equal(first.startsWith('# /loop tick — tasks from /w/.harness/loop.md\n'), true);
  assert.equal(first.includes('\n---\n\nrun the tests\n\n---\n\n# /loop tick — loop.md tasks\n'), true);
  const repeated = resolveLoopDefaultFire(state, LOOP_FILE_SENTINEL, () => file);
  assert.equal(repeated.startsWith('# /loop tick — loop.md tasks\n'), true);
  const edited = resolveLoopDefaultFire(state, LOOP_FILE_SENTINEL, () => ({ ...file, content: 'ship it' }));
  assert.equal(edited.includes('\n---\n\nship it\n\n---\n'), true);
});

test('a loop-file fire with no file falls back to the absent tick and its own preamble', () => {
  const state = newLoopDeliveryState();
  const first = resolveLoopDefaultFire(state, LOOP_FILE_DYNAMIC_SENTINEL, () => null);
  assert.equal(first.startsWith(`${getAutonomousLoopPreamble()}\n\n---\n\n# /loop tick — loop.md absent (dynamic pacing)\n\nloop.md is not currently present. Run the autonomous check using the loop instructions established earlier in this conversation.\n\n`), true);
  assert.equal(first.includes(`call schedule_wakeup again this turn with \`prompt\` set to the literal sentinel \`${LOOP_FILE_DYNAMIC_SENTINEL}\``), true);
  assert.equal(first.includes('If a monitor is armed (check task_list), keep `delaySeconds` at 1200–1800s'), true);
  const second = resolveLoopDefaultFire(state, LOOP_FILE_DYNAMIC_SENTINEL, () => null);
  assert.equal(second.startsWith('# /loop tick — loop.md absent (dynamic pacing)'), true);
  assert.equal(second.includes('Autonomous loop check'), false);
});

test('a prompt that is not a loop sentinel is handed back unchanged', () => {
  assert.equal(resolveLoopDefaultFire(newLoopDeliveryState(), 'check the deploy', () => null), 'check the deploy');
});

test('the no-prompt branch reads the loop file into the tasks heading and the autonomous default without one', () => {
  const file = { path: '/w/.harness/loop.md', content: 'run the tests' };
  const dynamic = loopAutonomousPrompt({ file, dynamic: true, interval: '10m' });
  assert.equal(dynamic.startsWith('# /loop — loop.md tasks with dynamic pacing\n'), true);
  assert.equal(dynamic.includes('## Loop tasks (from /w/.harness/loop.md)'), true);
  assert.equal(dynamic.includes(LOOP_FILE_DYNAMIC_SENTINEL), true);
  assert.equal(dynamic.endsWith('run the tests'), true);

  const fixed = loopAutonomousPrompt({ file, dynamic: false, interval: '5m' });
  assert.equal(fixed.startsWith('# /loop — schedule loop.md tasks\n'), true);
  assert.equal(fixed.includes('just the interval `5m`'), true);
  assert.equal(fixed.includes(`\`prompt\`: the literal string \`${LOOP_FILE_SENTINEL}\``), true);
  assert.equal(fixed.includes('auto-expire after 7 days'), true);

  const autonomous = loopAutonomousPrompt({ file: null, dynamic: false, interval: '10m' });
  assert.equal(autonomous.startsWith('# /loop — schedule the autonomous default\n'), true);
  assert.equal(autonomous.includes(`\`prompt\`: the literal string \`${AUTONOMOUS_LOOP_SENTINEL}\``), true);
  assert.equal(autonomous.includes('## Autonomous-loop instructions (for the immediate execution and every fire)'), true);
  assert.equal(autonomous.endsWith(getAutonomousLoopPreamble()), true);
});
