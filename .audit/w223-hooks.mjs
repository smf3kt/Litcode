import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w223-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w223-user-'));
fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
const settingsFile = path.join(workspace, '.harness', 'settings.local.json');
fs.writeFileSync(settingsFile, JSON.stringify({
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo hook-a' }] }],
    Stop: [{ type: 'command', command: 'echo hook-b' }],
  },
}, null, 2));

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || key === 'TMUX' || key === 'STY') delete env[key];
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (label, condition, detail) => console.log(`${condition ? 'PASS' : 'FAIL'} ${label}${condition ? '' : `\n${detail}`}`);
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const chunks = [];
child.stdout.on('data', chunk => chunks.push(chunk));
child.stderr.on('data', () => {});
/** Read at the pty's own 90 columns, and rejoin rows a wrap split mid-token. */
const flat = () => {
  const screen = new TerminalScreen(90, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  const lines = screen.lines();
  screen.close();
  return lines.map(row => row.replace(/\s+$/, '')).join('\n').split('\n').join('');
};
const down = () => child.stdin.write('\u001b[B');
const enter = () => child.stdin.write('\r');
const escape = () => child.stdin.write('\u001b');

await delay(2500);
child.stdin.write('/hooks\r'); await delay(1200);
const list = flat();
check('the list names the hooks and events it found',
  list.includes('Hooks') && list.includes('2 hooks on 2 events'), list);
check('each hook row shows its config text', list.includes('echo hook-a') && list.includes('echo hook-b'), list);

enter(); await delay(1000);
const detail = flat();
check('the first hook opens its detail view', detail.includes('Command hook') && detail.includes('PreToolUse · Bash'), detail);
check('the detail names the declaring settings file',
  detail.includes('Source: Local settings (.claude/settings.local.json)')
  && detail.includes(`edit ${settingsFile} or ask Claude`), detail);

escape(); await delay(800);
check('Escape returns to the list', flat().includes('2 hooks on 2 events'), flat());

down(); down(); await delay(400); enter(); await delay(1000);
const events = flat();
check('the All events row opens the event browser',
  events.includes('Hook events') && events.includes('33 events · 2 with hooks'), events);
check('the event rows carry their recovered summaries',
  events.includes('Before tool execution') && events.includes('PostToolUseFailure'), events);

escape(); await delay(800);
escape(); await delay(1000);
check('Escape from the list dismisses the panel', flat().includes('Hooks dialog dismi'), flat());

child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
