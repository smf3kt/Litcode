import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w227-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w227-user-'));
const extra = path.join(workspace, 'extra');
fs.mkdirSync(extra);
const settingsFile = path.join(user, 'settings.json');
// The workspace tab reads the layer's declared directories, so the seed is the ordinary settings
// document rather than a panel action.
fs.writeFileSync(settingsFile, JSON.stringify({ permissions: { additionalDirectories: [extra] } }, null, 2) + '\n');

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
const down = async (times = 1) => { for (let index = 0; index < times; index++) { child.stdin.write('\u001b[B'); await delay(120); } };
const up = async (times = 1) => { for (let index = 0; index < times; index++) { child.stdin.write('\u001b[A'); await delay(120); } };
const enter = () => child.stdin.write('\r');
const escape = () => child.stdin.write('\u001b');
const open = async () => { child.stdin.write('/permissions\r'); await delay(1200); };

await delay(2500);
await open();
// Rows: five tab rows, then the seeded directory, then the add row.
await down(4);
enter(); await delay(1000);
const tab = flat();
check('the workspace tab draws its intro, the original directory and the seeded one',
  tab.includes("Claude Code can read files in the workspace, and make edits when auto-accept edits is on.")
  && tab.includes(`${workspace} (Original working directory)`) && tab.includes(extra), tab);

await down(1);
enter(); await delay(1000);
const confirm = flat();
check('a directory row opens the removal confirm',
  confirm.includes('Remove directory from workspace?') && confirm.includes(extra)
  && confirm.includes('Claude Code will no longer have access to files in this directory.'), confirm);

await up();          // the confirm focuses No; Yes is one row up
enter(); await delay(1500);
escape(); await delay(1200);
const removed = flat();
check('the confirm removes the directory and the exit reports it',
  removed.includes(`Removed directory ${extra} from workspace`), removed);

await delay(200);
await open();
await down(4);
enter(); await delay(1000);
const refreshed = flat();
check('the refreshed list drops the removed directory',
  refreshed.includes('Add directory') && !refreshed.includes(`  ${extra}`), refreshed);

await down(1);
enter(); await delay(1000);
const input = flat();
check('the add row opens the path input with its header',
  input.includes('Add directory to workspace')
  && input.includes('Claude Code will be able to read files in this directory and make edits when auto-accept edits is on.')
  && input.includes('Enter the path to the directory:'), input);

child.stdin.write('/definitely/not/a/directory'); await delay(300);
enter(); await delay(1000);
const rejected = flat();
check('a rejected path keeps the input open with its message',
  rejected.includes('Add directory to workspace') && rejected.includes('was not found'), rejected);

escape(); await delay(800);
escape(); await delay(1200);
const dismissed = flat();
check('the workspace tab dismisses with its own message',
  dismissed.includes('Workspace dialog dismissed'), dismissed);

child.stdin.write('\u001b'); await delay(600);
child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
