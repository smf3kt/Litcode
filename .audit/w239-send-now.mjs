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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w239-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));
const requests = [], children = [], checks = [], captures = {};
let active, slowResponse;

const events = (id, text, stop) => [
  ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant',
    model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
  ...(stop ? [['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 10 } }],
    ['message_stop', { type: 'message_stop' }]] : []),
];
const write = (response, list) => {
  for (const [event, data] of list) if (!response.writableEnded) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* reported by the client */ }
    requests.push(body);
    const last = body.messages?.at(-1)?.content;
    const lastText = typeof last === 'string' ? last : JSON.stringify(last ?? '');
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    if (lastText.includes('slow prompt')) {
      // Keep the turn open: the assistant text arrives but no stop event follows until abort.
      write(response, events(`msg_slow_${requests.length}`, 'SLOW-REPLY', false));
      slowResponse = response;
      request.on('close', () => { if (slowResponse === response) slowResponse = undefined; });
      return;
    }
    write(response, events(`msg_${requests.length}`, 'SECOND-REPLY', true));
    response.end();
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
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    '--user-dir', user, '--no-inherit-gateway'],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current);
  await until(ready, 'startup ready', 25000);
  return current;
}
async function stop(current) {
  send('/exit\r');
  assert.equal(await Promise.race([current.closed, delay(6000).then(() => 'timeout')]), 0, screen());
}
try {
  let current = await launch();
  send('slow prompt\r');
  await until(() => requests.some(body => JSON.stringify(body).includes('slow prompt')), 'first request reached the fixture');
  await until(() => /running/.test(screen()) && screen().includes('ctrl+c to interrupt'), 'the turn is running');
  pass('the first turn is still running');
  send('\x18\x13');
  await delay(800);
  pass('an empty send-now with no queued prompt leaves the running turn alone',
    requests.length === 1 && screen().includes('ctrl+c to interrupt'));
  send('send now draft');
  await until(() => screen().includes('send now draft'), 'the draft is in the composer');
  send('\x18\x13');
  await until(() => requests.some(body => JSON.stringify(body).includes('send now draft')), 'the draft was sent immediately', 12000);
  pass('ctrl+x ctrl+s sends the draft without waiting for the running turn');
  const queued = requests.filter(body => JSON.stringify(body).includes('send now draft'));
  assert.equal(queued.length, 1, screen()); checks.push('exactly one send-now request');
  console.log('PASS exactly one send-now request');
  await until(() => screen().includes('SECOND-REPLY'), 'the sent-now prompt answered');
  pass('the sent-now prompt runs and its answer lands');
  captures.send = screen();
  await stop(current);
  pass('the CLI exits zero');

  current = await launch();
  const before = requests.length;
  send('slow prompt\r');
  await until(() => requests.length > before, 'the second session turn started');
  await until(() => screen().includes('ctrl+c to interrupt'), 'the second turn is running');
  send('queued first\r');
  await delay(600);
  pass('a plain submit during the turn queues without sending',
    requests.length === before + 1 && screen().includes('ctrl+c to interrupt'));
  send('\x18\x13');
  await until(() => requests.some(body => JSON.stringify(body).includes('queued first')),
    'empty send-now flushed the queued prompt', 12000);
  pass('an empty send-now flushes a queued prompt by cancelling the turn');
  const flushed = requests.filter(body => JSON.stringify(body).includes('queued first'));
  assert.equal(flushed.length, 1, screen()); checks.push('exactly one flushed request');
  console.log('PASS exactly one flushed request');
  await until(() => screen().includes('SECOND-REPLY'), 'the flushed prompt answered');
  pass('the flushed prompt runs and its answer lands');
  await stop(current);
  pass('the second CLI exits zero');
} finally {
  server.close(); slowResponse?.end();
  for (const current of children) if (current.child.exitCode === null) current.child.kill('SIGKILL');
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${captureIdentity().sha256}`);
}
