import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = '/Users/mant1ssa/Projects/cc_reverse';
const workspace = fs.realpathSync(fs.mkdtempSync('/tmp/w224-ws-'));
const user = fs.realpathSync(fs.mkdtempSync('/tmp/w224-user-'));
const skillDir = name => path.join(workspace, '.harness', 'skills', name);
const addSkill = (name, description) => {
  fs.mkdirSync(skillDir(name), { recursive: true });
  fs.writeFileSync(path.join(skillDir(name), 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n${description} body\n`);
};
addSkill('alpha', 'Alpha fixture skill');

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
const backspace = count => type('\u007f'.repeat(count));

await delay(2500);
type('/reload-skills\r'); await delay(1200);
const unchanged = flat();
check('an unchanged catalog reports no changes',
  unchanged.includes('Reloaded skills: 1 skill available (no changes)'), unchanged);

addSkill('beta', 'Beta fixture skill');
type('/bet'); await delay(900);
const before = flat();
check('the composer does not know a skill written after startup', !before.includes('Beta fixture skill'), before);
backspace(4); await delay(400);

type('/reload-skills\r'); await delay(1200);
const added = flat();
check('the rescan reports the skill added on disk',
  added.includes('Reloaded skills: 2 skills available (1 added)'), added);

type('/bet'); await delay(900);
const after = flat();
check('the composer offers the newly added skill after the rescan',
  after.includes('beta') && after.includes('Beta fixture skill'), after);
backspace(4); await delay(400);

fs.rmSync(skillDir('alpha'), { recursive: true, force: true });
type('/reload-skills\r'); await delay(1200);
const removed = flat();
check('the rescan reports the skill removed on disk',
  removed.includes('Reloaded skills: 1 skill available (1 removed)'), removed);

type('/help\r'); await delay(1200);
const help = flat();
check('the help lists the command', help.includes('/reload-skills'), help);
child.stdin.write('\u001b'); await delay(600);

type('/exit\r'); await delay(1200);
if (child.exitCode === null && child.signalCode === null) {
  const closed = new Promise(resolve => child.once('close', resolve));
  child.kill('SIGKILL');
  await Promise.race([closed, delay(2000)]);
}
fs.rmSync(workspace, { recursive: true, force: true });
fs.rmSync(user, { recursive: true, force: true });
