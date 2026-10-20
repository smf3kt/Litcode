import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w226-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w226-user-'));
const settingsFile = path.join(user, 'settings.json');
// The panel reads the file layers through the session's own permission state, so the seed is the
// ordinary settings document: one allow rule and one content-less deny rule that will block it.
fs.writeFileSync(settingsFile, JSON.stringify({ permissions: { allow: ['Read'], deny: ['Bash'] } }, null, 2) + '\n');
const settings = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));

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
/** Read at the pty's own 200 columns, and rejoin rows a wrap split mid-token. */
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
const list = flat();
check('a bare /permissions opens the rule panel',
  list.includes('Permissions') && list.includes('[Allow]') && list.includes('Ask') && list.includes('Deny'), list);
check('the allow tab carries its recovered intro and its rules',
  list.includes("Claude Code won't ask before using allowed tools.") && list.includes('Add a new rule') && list.includes('Read'), list);

escape(); await delay(1000);
check('Escape dismisses the panel', flat().includes('Permissions dialog dismissed'), flat());

await open();
await down(3);           // three tab rows, then the add row
enter(); await delay(1000);
const input = flat();
check('the add row opens the rule input', input.includes('Add allow permission rule')
  && input.includes('Permission rules are a tool name, optionally followed by a specifier in parentheses.')
  && input.includes('e.g., Bash or Bash(ls *)'), input);

child.stdin.write('Bash(ls *)'); await delay(300);
enter(); await delay(1000);
const picker = flat();
check('the input opens the save-scope picker',
  picker.includes('Where should this rule be saved?') && picker.includes('Project settings (local)')
  && picker.includes('User settings'), picker);

await down(2);           // local settings, project settings, user settings
enter(); await delay(1500);
check('the pick lands the rule in the settings file',
  JSON.stringify(settings().permissions.allow) === JSON.stringify(['Read', 'Bash(ls *)']), JSON.stringify(settings()));

escape(); await delay(1200);
const added = flat();
check('the add is reported and the deny rule shadows it',
  added.includes('Added allow rule Bash(ls *)')
  && added.includes('Warning: Bash(ls *) is blocked')
  && added.includes('Blocked by "Bash" deny rule (from user settings)')
  && added.includes('Fix: Remove the "Bash" deny rule from user settings, or remove the specific allow rule from user settings'),
  added);

await delay(200);
await open();
await down(2);           // the Deny tab row
enter(); await delay(1000);
const deny = flat();
check('the deny tab lists the deny rules',
  deny.includes('Claude Code will always reject requests to use denied tools.') && deny.includes('Bash'), deny);

escape(); await delay(800);
await open();
await down(5);           // three tabs, the add row, Bash(ls *), then Read
enter(); await delay(1000);
const pane = flat();
check('selecting a rule asks before deleting it',
  pane.includes('Rule details') && pane.includes('Delete allowed tool?')
  && pane.includes('Are you sure you want to delete this permission rule?') && pane.includes('From user settings'), pane);

await up();              // the confirm focuses No; Yes is one row up
enter(); await delay(1500);
check('the confirm removes the rule from the settings file',
  JSON.stringify(settings().permissions.allow) === JSON.stringify(['Bash(ls *)']), JSON.stringify(settings()));

escape(); await delay(1200);
const deleted = flat();
check('the delete is reported', deleted.includes('Deleted allow rule Read'), deleted);

await delay(200);
await open();
// The refreshed list has five rows (three tabs, the add row, the surviving rule), so a fifth
// down wraps back onto the Allow tab; a stale list would land on the deleted rule instead.
await down(5);
enter(); await delay(800);
const refreshed = flat();
check('the refreshed list drops the deleted rule',
  refreshed.includes('Selected: Allow') && refreshed.includes('  Bash(ls *)'), refreshed);

child.stdin.write('\u001b'); await delay(600);
child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
