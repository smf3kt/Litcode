import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w222-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w222-user-'));
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
const rows = () => {
  const screen = new TerminalScreen(90, 30);
  screen.write(Buffer.concat(chunks).toString('utf8'));
  const lines = screen.lines();
  screen.close();
  return lines;
};
const flat = () => rows().map(row => row.replace(/\s+$/, '')).join('');
const screen = () => flat();

await delay(2500);

child.stdin.write('/workflows\r'); await delay(1200);
const workflows = screen();
check('bare /workflows opens the dynamic-workflows dialog',
  workflows.includes('Dynamic workflows') && workflows.includes('No dynamic workflows in this session.'), workflows);
check('the dialog advertises its own footer', workflows.includes('Esc close'), workflows);

child.stdin.write('\u001b'); await delay(600);
child.stdin.write('/loop\r'); await delay(1500);
const loop = screen();
check('bare /loop expands to a user turn instead of opening a dialog',
  loop.includes('> /loop') && !loop.includes('Esc close'), loop);

child.stdin.write('/tasks\r'); await delay(1200);
check('bare /tasks reports the empty task list', screen().includes('[]'), screen());

child.stdin.write('/cron\r'); await delay(1200);
check('bare /cron reports the scheduled prompts as JSON', screen().includes('{"jobs":[]}'), screen());

child.stdin.write('/status\r'); await delay(1200);
check('bare /status reports the context budget', screen().includes('"contextTokens": 1000000'), screen());

child.stdin.write('/context\r'); await delay(1200);
check('bare /context reports the compaction threshold', screen().includes('"compactAt": 512000'), screen());

child.stdin.write('/usage\r'); await delay(1200);
check('bare /usage reports the recorded model calls', screen().includes('"modelCalls"'), screen());

child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
