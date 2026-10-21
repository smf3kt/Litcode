import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w229-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w229-user-'));
const settingsFile = path.join(user, 'settings.json');
// One sentinel-free section, one section that splices the built-ins back in, and a document, so the
// tab draws a builtins row with its count, an entry row and the environment document row.
fs.writeFileSync(settingsFile, JSON.stringify({ autoMode: {
  soft_deny: ['Never push to main'],
  hard_deny: ['$defaults'],
  environment: ['### Host', '- macOS 26', '- Node 26'],
} }, null, 2) + '\n');

const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'f', LLM_MODEL: 'base-model', LLM_BASE_URL: 'http://127.0.0.1:1', LLM_AUTH: 'bearer',
  LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false', VISUAL: '/usr/bin/true', EDITOR: '/usr/bin/true' };
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
  return lines.map(row => row.replace(/\s+$/, '')).join('\n').split('\n').join('  ');
};
const down = async (times = 1) => { for (let index = 0; index < times; index++) { child.stdin.write('\u001b[B'); await delay(120); } };
const enter = () => child.stdin.write('\r');
const escape = () => child.stdin.write('\u001b');
const open = async () => { child.stdin.write('/permissions\r'); await delay(1200); };

await delay(2500);
await open();
const tabs = flat();
check('the tab strip offers Auto mode between Deny and Workspace',
  tabs.includes('Deny  Auto mode  Workspace') && tabs.includes('[Allow]'), tabs);

// The cursor opens on Allow; Auto mode is three rows below it.
await down(3);
enter(); await delay(1000);
const tab = flat();
check('the automode tab carries the recovered intro and its rows',
  tab.includes('Extra rules for the auto mode classifier. Rules are plain sentences; new rules are saved to your user settings.')
  && tab.includes('Soft allow          [x] Built-in rules · ')
  && tab.includes('Soft deny           [ ] Built-in rules · ') && tab.includes('· off')
  && tab.includes('Soft deny           Never push to main')
  && tab.includes('Hard deny           [x] Built-in rules · ')
  && tab.includes('Environment         Replaces the built-in default · from user settings · enter to edit')
  && tab.includes('Selected: Auto mode'), tab);

// The add row precedes Soft allow's builtins row below the six tabs.
await down(3);
enter(); await delay(1000);
const builtins = flat();
check('a builtins row opens the built-ins card with its count line and rules',
  builtins.includes('Built-in rules')
  && builtins.includes('Soft allow · 17 built-in rules · in effect')
  && builtins.includes('- Read-Only Operations')
  && builtins.includes('Selected: View in editor'), builtins);

await down();
enter(); await delay(800);
check('the card comes back to the automode tab', flat().includes('Selected: Auto mode'), flat());

// The document row is seven choices below the tab after adding the rule input row.
await down(7);
enter(); await delay(1000);
const document = flat();
check('the environment document row runs the editor and retains an unchanged document',
  document.includes('Edit environment') && document.includes('No changes detected')
  && JSON.parse(fs.readFileSync(settingsFile, 'utf8')).autoMode.environment.includes('- macOS 26'), document);

escape(); await delay(600);
escape(); await delay(800);
check('an unmarked Esc from the tab dismisses the panel', flat().includes('Permissions dialog dismissed'), flat());

child.stdin.write('\u001b'); await delay(600);
child.stdin.write('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
