import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w228-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w228-user-'));
const settingsFile = path.join(user, 'settings.json');
// No denial can be made without a model, so this probe covers the reachable surface: the tab is
// drawn, its empty state is the recovered one, and an unmarked Esc still dismisses. The populated
// rows and the Esc apply are covered by test/permissions-panel.test.ts and the agent harness.
fs.writeFileSync(settingsFile, JSON.stringify({ permissions: { allow: ['Read'] } }, null, 2) + '\n');

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, condition, detail) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : `\n${detail}`}`);
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w226-wide.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
const flat = () => {
  const screen = new TerminalScreen(200, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  const lines = screen.lines();
  screen.close();
  return lines.map(row => row.replace(/\s+$/, '')).join('\n').split('\n').join('');
};
const up = async (times = 1) => { for (let index = 0; index < times; index++) { child.stdin.write('\u001b[A'); await delay(120); } };
const enter = () => child.stdin.write('\r');
const escape = () => child.stdin.write('\u001b');
const open = async () => { child.stdin.write('/permissions\r'); await delay(1200); };

await delay(2500);
await open();
const list = flat();
check('the tab strip offers the recent tab ahead of the rule tabs',
  list.includes('Permissions') && list.includes('Recently denied') && list.includes('[Allow]'), list);

// The cursor opens on Allow; the recent tab is the row above it.
await up();
enter(); await delay(1000);
const empty = flat();
check('the recent tab carries the recovered header and empty state',
  empty.includes('Commands recently denied by the auto mode classifier.')
  && empty.includes('No recent denials. Commands denied by the auto mode classifier will appear here.')
  && empty.includes('↑/↓ to navigate · Enter to select · Esc to cancel')
  && empty.includes('Selected: Recently denied'), empty);

escape(); await delay(1000);
check('an unmarked Esc dismisses the panel', flat().includes('Permissions dialog dismissed'), flat());

child.stdin.write('\u001b'); await delay(600);
child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
