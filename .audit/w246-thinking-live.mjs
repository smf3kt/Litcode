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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w246-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));
fs.writeFileSync(path.join(workspace, 'note.txt'), 'fixture note\n');

const requests = [], checks = [];
const gates = [];
let active;
const nextGate = () => { let release; const gate = new Promise(resolve => { release = resolve; });
  gates.push(gate); return { gate, release }; };

const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const streamed = (response, { id, block, stopReason, json = false }) => sse(response, [
  ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant',
    model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: block.start }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: json
    ? { type: 'input_json_delta', partial_json: block.text }
    : { type: 'text_delta', text: block.text } }],
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 10 } }],
  ['message_stop', { type: 'message_stop' }],
]);
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', async () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    requests.push(body);
    const index = requests.length;
    if (index % 2 === 1) {
      // Hold each turn's first request so the chord runs mid-turn.
      await gates[Math.floor(index / 2)];
      streamed(response, { id: `msg_tool_${index}`, stopReason: 'tool_use', json: true,
        block: { start: { type: 'tool_use', id: `toolu_w246_${index}`, name: 'read_file', input: {} },
          text: JSON.stringify({ path: 'note.txt' }) } });
      return;
    }
    streamed(response, { id: `msg_done_${index}`, stopReason: 'end_turn',
      block: { start: { type: 'text', text: '' }, text: `finished ${index}` } });
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_KB_COHESION_FIXES'].includes(key)) delete env[key];

const screen = () => {
  const terminal = new TerminalScreen(160, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
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

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w246-thinking-live.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
  '--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
child.stdout.on('data', chunk => active.chunks.push(chunk));
child.stderr.on('data', chunk => active.chunks.push(chunk));

try {
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');
  const firstGate = nextGate();
  send('hold one\r');
  await until(() => requests.length === 1, 'the first turn reaches the provider');
  pass('the first request has thinking off', requests[0].thinking === undefined);
  send('\u001bt');
  await until(() => screen().includes('Toggle thinking mode'), 'the thinking dialog opens mid-turn');
  pass('alt+t opens the thinking dialog during the turn');
  pass('the dialog shows both rows', screen().includes('Enabled') && screen().includes('Disabled'));
  send('\u001b[A'); await delay(150);
  send('\r');
  await until(() => screen().includes('Thinking on'), 'the enabled row applies');
  pass('the dialog applies thinking on without a confirmation before any assistant turn');
  firstGate.release();
  await until(() => requests.length === 2, 'the turn continues');
  pass('the running turn continues with thinking enabled', requests[1].thinking?.type === 'adaptive');
  await until(() => screen().includes('finished 2'), 'first turn end');

  const secondGate = nextGate();
  send('hold two\r');
  await until(() => requests.length === 3, 'the second turn reaches the provider');
  pass('the second turn starts with thinking enabled', requests[2].thinking?.type === 'adaptive');
  send('\u001bt');
  await until(() => screen().includes('Toggle thinking mode'), 'the dialog opens again');
  send('\u001b[B'); await delay(150);
  send('\r');
  await until(() => screen().includes('Changing thinking mode mid-conversation'), 'the warning appears');
  pass('a changed value mid-conversation asks first');
  send('\u001b[B'); await delay(150);
  send('\r');
  await until(() => screen().includes('Thinking off'), 'the confirmation applies');
  pass('the confirmation applies thinking off');
  secondGate.release();
  await until(() => requests.length === 4, 'the second turn continues');
  pass('the next request has thinking off again', requests[3].thinking === undefined);
  await until(() => screen().includes('finished 4'), 'second turn end');
  pass('both turns finish');
  send('\u0015'); await delay(100);
  send('/exit\r');
  const status = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  pass('the CLI exits zero', status === 0);
  console.log(`IDENTITY ${captureIdentity(root).sha256}`);
  console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  if (child.exitCode === null) child.kill('SIGKILL');
  server.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
