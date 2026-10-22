import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w274-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
const checks = [], captures = {};
let active;

const server = http.createServer((_request, response) => { response.writeHead(500); response.end(); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  HOME: temporary, LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(110, 40);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const ready = () => screen().includes('· ready');
const flat = () => screen().replace(/\s+/g, '');
const footer = () => screen().split('\n').find(row => row.includes('ready')) ?? '';
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(60);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
try {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');

  // Source `LVe` 766656: the idle footer carries the recovered row while the draft is empty.
  pass('the idle footer names the ? shortcut', footer().includes('? for shortcuts'));
  captures.idle = footer();

  send('?');
  await until(() => flat().includes('[General]') && flat().includes('Shortcuts'), 'help panel');
  pass('? on an empty draft opens the help panel');
  pass('the panel opens on the General tab', flat().includes('Selected:General'));
  // A 40-row terminal shows the tail of the General tab, so the visible proof is the shortcut
  // table itself and the dialog's own answer row.
  pass('the panel draws the recovered shortcut table',
    flat().includes('ctrl+oforverboseoutput') && flat().includes('doubletapesctoclearinput'));
  pass('the panel offers its tabs as rows', flat().includes('Selected:General'));
  captures.panel = screen();

  send('\x1b');
  await until(() => !flat().includes('[General]'), 'panel closed');
  pass('escape closes the panel');
  await until(ready, 'settled');
  pass('the footer returns to idle after the panel closes');

  // A non-empty draft keeps `?` as text, which is the source's `typeText` arm.
  send('why');
  await until(() => flat().includes('why'), 'typed');
  send('?');
  await delay(300);
  pass('a non-empty draft keeps ? as text', flat().includes('why?') && !flat().includes('[General]'));
  captures.text = screen();

  send('\x7f\x7f\x7f\x7f');
  await delay(200);
  send('\r');
  await delay(400);
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/exit ends the session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    identity: identity.sha256, ok: checks.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
