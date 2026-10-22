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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w280-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));

const requests = [], checks = [];
let active;

const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
// The first turn never finishes, so the composer stays in the running state while the shell
// command is queued behind it.
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    requests.push(body);
    if (requests.length === 1) {
      response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      response.write('event: message_start\ndata: ' + JSON.stringify({ type: 'message_start', message: {
        id: 'msg_slow', type: 'message', role: 'assistant', model: 'fixture', content: [],
        stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } }) + '\n\n');
      return;
    }
    sse(response, [
      ['message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message',
        role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'answered' } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 10 } }],
      ['message_stop', { type: 'message_stop' }],
    ]);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
  LLM_MODEL: 'fixture', CLAUDE_CODE_KB_COHESION_FIXES: '1' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];

const screen = () => {
  const terminal = new TerminalScreen(120, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const ready = () => screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(50);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w280-queued-shell-pull.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
  '--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
child.stdout.on('data', chunk => active.chunks.push(chunk));
child.stderr.on('data', chunk => active.chunks.push(chunk));

try {
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');
  send('slow prompt\r');
  await until(() => requests.length === 1, 'the slow turn reaches the provider', 25000);
  await until(() => screen().includes('ctrl+c to interrupt'), 'the turn is running');
  pass('a turn is running');
  // Queue a drained shell command behind the running turn.
  send('!');
  await until(() => screen().includes('shell mode'), 'bash mode');
  send('echo queued-shell-command\r');
  await until(() => screen().includes('Press up to select a queued message, then Enter to edit it'),
    'the queued shell command paints the select hint');
  pass('a queued shell command paints the select hint');
  // A typed draft refuses the pull: the shell entry needs an empty composer. The selection hint
  // is a placeholder, so it only paints into an empty draft; the selection itself still works.
  send('typed draft');
  send('\x1b[A');
  await delay(300);
  send('\r');
  await until(() => screen().includes('Clear the input to edit this queued shell'),
    'the refused pull reports its notice');
  pass('a shell entry refuses the pull into a non-empty draft');
  pass('the refused pull leaves the draft in place', screen().includes('typed draft'));
  pass('the refused pull did not enter bash mode', !screen().includes('shell mode'));
  assert.equal(requests.length, 1, screen());
  checks.push('the refused pull sends nothing');
  console.log('PASS the refused pull sends nothing');
  // Clear the draft and pull again: the command lands in bash mode.
  send('\u0015');
  await until(() => !screen().includes('typed draft'), 'the draft is cleared');
  send('\x1b[A');
  await until(() => screen().includes('Press Enter to edit the selected message, or up again for history'),
    'the queued shell command is selectable again');
  send('\r');
  await until(() => screen().includes('queued-shell-command'), 'the command pulls into the composer');
  pass('the queued shell command pulls into an empty draft');
  await until(() => screen().includes('shell mode'), 'the pulled command leaves the composer in bash mode');
  pass('the pulled shell entry leaves the composer in bash mode');
  assert.equal(requests.length, 1, screen());
  checks.push('the successful pull sends nothing');
  console.log('PASS the successful pull sends nothing');
  // Leave bash mode and end the still-running turn before exiting. The first ctrl+c only drops
  // bash mode (source `QE`); the second one interrupts the turn.
  send('\u0015');
  send('\u0003');
  await until(() => !screen().includes('shell mode'), 'the composer leaves bash mode');
  send('\u0003');
  await until(() => !screen().includes('ctrl+c to interrupt'), 'the slow turn is interrupted');
  send('/exit\r');
  const status = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  pass('the CLI exits zero', status === 0);
  console.log(`IDENTITY ${captureIdentity(root).sha256}`);
  console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  if (child.exitCode === null) child.kill('SIGKILL');
  server.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
