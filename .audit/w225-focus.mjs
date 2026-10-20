import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w225-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w225-user-'));
// The startup value the command toggles away from.
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ viewMode: 'focus', theme: 'dark' }, null, 2) + '\n');
const settings = () => JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8'));

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
const type = text => child.stdin.write(text);

await delay(2500);
type('/focus\r'); await delay(1000);
check('a bare /focus toggles the startup value off', flat().includes('Focus view disabled'), flat());
check('the toggle is written to the settings file, keeping other keys',
  settings().viewMode === 'default' && settings().theme === 'dark', JSON.stringify(settings()));

type('/focus on\r'); await delay(1000);
check('the on arm reports and persists focus', flat().includes('Focus view enabled') && settings().viewMode === 'focus',
  `${flat()}\n${JSON.stringify(settings())}`);

type('/focus maybe\r'); await delay(1000);
check('the invalid line is the recovered one',
  flat().includes('Unknown argument "maybe". Use: /focus [on|off]'), flat());
check('an invalid argument changes nothing', settings().viewMode === 'focus', JSON.stringify(settings()));

type('/focus off\r'); await delay(1000);
const view = flat();
check('the off arm reports and persists default',
  view.includes('Focus view disabled') && settings().viewMode === 'default', `${view}\n${JSON.stringify(settings())}`);

type('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
