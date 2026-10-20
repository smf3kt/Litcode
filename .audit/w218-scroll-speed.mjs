import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w218-ws-')));
const user = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w218-user-')));
const settingsFile = path.join(user, 'settings.json');
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY'
    || key === 'CLAUDE_CODE_SCROLL_SPEED' || key === 'WT_SESSION' || key === 'CURSOR_TRACE_ID') delete env[key];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, condition) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`);
const stored = () => fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile, 'utf8')) : {};
const storedSpeed = () => stored().env?.CLAUDE_CODE_SCROLL_SPEED;
// The user directory is under the temporary directory, so there is no home prefix to abbreviate.
const named = file => `\`${file}\``;
/** A report longer than the pty is hard-wrapped mid-token, so rows are rejoined before matching. */
const unwrapped = text => text.split('\n').map(row => row.replace(/\s+$/, '')).join('');

/** One app process: the pty is 90x30 (`.audit/w205-footer.exp`), read at 120 columns. */
function startApp() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const chunks = [];
  child.stdout.on('data', chunk => chunks.push(chunk));
  child.stderr.on('data', () => {});
  const screenNow = () => {
    const screen = new TerminalScreen(120, 30);
    screen.write(Buffer.concat(chunks).toString('utf8'));
    const rows = screen.lines();
    screen.close();
    return rows;
  };
  return { child, text: () => screenNow().join('\n'), flat: () => unwrapped(screenNow().join('\n')),
    snap: label => {
    console.log('=====', label);
    for (const row of screenNow()) if (row.trim()) console.log(JSON.stringify(row));
  } };
}

/** `SIGKILL` after a close that may already have happened is not an event to wait for. */
async function stop(child) {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill('SIGKILL');
    await Promise.race([closed, delay(2000)]);
  }
}

const first = startApp();
await delay(2500);
check('a fresh user directory has no settings file', fs.existsSync(settingsFile) === false);

first.child.stdin.write('/scroll-speed\r'); await delay(1500);
const dialog = first.text();
check('the command opens the scroll speed dialog', dialog.includes('Scroll speed'));
check('the dialog shows the current notch count and the terminal row',
  dialog.includes('1 line per wheel notch (auto)') && dialog.includes('Terminal  '));
check('the dialog offers auto and the reachable steps below the fold',
  dialog.includes('auto (1 line per notch)') && dialog.includes('0.25 lines per notch')
  && dialog.includes('0.5 lines per notch') && dialog.includes('0.75 lines per notch')
  && dialog.includes('1 line per notch') && dialog.includes('2 lines per notch'));
first.snap('after /scroll-speed');

// The first row is focused, so one step down lands on the finest value.
first.child.stdin.write('\u001b[B'); await delay(400);
first.child.stdin.write('\r'); await delay(1500);
const saved = first.flat();
check('the pick is reported with the notch count and the settings file',
  saved.includes(`Scroll speed set to 0.25 lines per notch · saved to ${named(settingsFile)}`));
check('the pick is written to the settings env block', storedSpeed() === '0.25');

first.child.stdin.write('/scroll-speed\r'); await delay(1500);
const reopened = first.text();
check('reopening shows the stored value as explicit rather than auto',
  reopened.includes('0.25 lines per wheel notch · auto is 1'));
check('the explicit value is the focused row', />\s+0\.25 lines per notch/.test(reopened));

first.child.stdin.write('\u001b[B\u001b[B\r'); await delay(1500);
check('a second pick moves two steps up the fine grid',
  first.flat().includes(`Scroll speed set to 0.75 lines per notch · saved to ${named(settingsFile)}`));
check('the second pick replaces the first', storedSpeed() === '0.75');

first.child.stdin.write('/scroll-speed\r'); await delay(1500);
first.child.stdin.write('\u001b'); await delay(1200);
const cancelled = first.text();
check('Escape reports the recovered cancel line', cancelled.includes('Scroll speed unchanged'));
check('a cancelled dialog leaves the stored value alone', storedSpeed() === '0.75');

// 0.75 is the fourth row, so three steps up reach the auto row.
first.child.stdin.write('/scroll-speed\r'); await delay(1500);
first.child.stdin.write('\u001b[A\u001b[A\u001b[A'); await delay(600);
first.child.stdin.write('\r'); await delay(1500);
const reset = first.flat();
check('the auto row is reported as the reset form',
  reset.includes(`Scroll speed reset to auto (1 line per notch) · removed from ${named(settingsFile)}`));
check('a reset drops the key and keeps the block it lived in',
  storedSpeed() === undefined && JSON.stringify(stored().env) === '{}');

// Auto is the first row again, so four steps down reach the whole line.
first.child.stdin.write('/scroll-speed\r'); await delay(1500);
first.child.stdin.write('\u001b[B\u001b[B\u001b[B\u001b[B'); await delay(600);
first.child.stdin.write('\r'); await delay(1500);
check('a pick above the fine grid lands on a whole line',
  first.flat().includes(`Scroll speed set to 1 line per notch · saved to ${named(settingsFile)}`));
check('the whole line is stored as the environment string', storedSpeed() === '1');
first.child.stdin.write('/exit\r'); await delay(1200);
await stop(first.child);

// A new process over the same user directory: the stored env block is what carries the setting.
const second = startApp();
await delay(2500);
second.child.stdin.write('/scroll-speed\r'); await delay(1500);
const carried = second.text();
check('a new process reads the stored value back as explicit',
  carried.includes('1 line per wheel notch · auto is 1') && carried.includes('(auto)') === false);
second.snap('after a restart');
second.child.stdin.write('\u001b'); await delay(1000);
second.child.stdin.write('/exit\r'); await delay(1000);
await stop(second.child);

console.log('SETTINGS', JSON.stringify(stored()));
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
