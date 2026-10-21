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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w238-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', thinking: false }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const children = [], checks = [], captures = {};
let active;

const server = http.createServer((request, response) => {
  request.resume();
  request.on('end', () => {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    response.end('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(90, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const ready = () => screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 18000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(50);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch({ permission = false } = {}) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    '--user-dir', user, '--no-inherit-gateway', ...(permission ? ['--permission-mode', 'bypass'] : [])],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 25000);
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, screen()); }
async function cycle(expected) { send('\x1b[Z'); await until(() => screen().includes(expected), `cycle to ${expected}`); }
try {
  await launch(); captures.defaultStart = screen();
  pass('a default session starts on the manual chip', screen().includes('manual mode on'));
  await cycle('accept edits on');
  pass('one shift+tab enters accept edits', screen().includes('accept edits on'));
  await cycle('plan mode on');
  pass('the second step enters plan mode', screen().includes('plan mode on'));
  await cycle('auto mode on');
  pass('plan falls to auto when bypass was never offered', screen().includes('auto mode on'));
  await cycle('manual mode on');
  pass('auto falls back to manual', screen().includes('manual mode on'));
  pass('the live cycle persists nothing to settings', stored().permissions === undefined && stored().model === 'fixture');
  send('draft');
  await cycle('accept edits on');
  pass('a non-empty composer keeps its draft through the cycle', screen().includes('draft'));
  send('\x0c');
  await stop();

  await launch({ permission: true }); captures.bypassStart = screen();
  pass('a bypass session starts on the bypass chip', screen().includes('bypass permissions on'));
  await cycle('auto mode on');
  pass('bypass falls to auto', screen().includes('auto mode on'));
  await cycle('manual mode on');
  pass('auto falls to manual in the bypass session', screen().includes('manual mode on'));
  await cycle('accept edits on');
  await cycle('plan mode on');
  await cycle('bypass permissions on');
  pass('plan offers bypass when the session made it available', screen().includes('bypass permissions on'));
  await stop();

  await launch();
  pass('a fresh session returns to the settings default (the cycle is live-only)', screen().includes('manual mode on'));
  send('\x1b[Z\x1b[Z');
  await until(() => screen().includes('plan mode on'), 'two quick presses advance twice');
  pass('two quick presses advance two steps', screen().includes('plan mode on'));
  await stop();

  await launch();
  send('\x1b[Z\x1b[Z\x1b[Z\x1b[Z\x1b[Z');
  await until(() => screen().includes('accept edits on'), 'five quick presses wrap to accept edits');
  pass('five quick presses wrap once and land on accept edits', screen().includes('accept edits on'));
  await stop();
} finally {
  server.close();
  for (const current of children) if (current.child.exitCode === null) current.child.kill('SIGKILL');
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${captureIdentity().sha256}`);
}
