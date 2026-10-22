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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w281-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));

const requests = [], checks = [], captures = {};
let active;

const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    requests.push(body);
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message',
      role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `answered ${requests.length}` } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
    send('message_stop', { type: 'message_stop' });
    response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
  LLM_MODEL: 'fixture' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];

const screen = () => {
  const terminal = new TerminalScreen(120, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const ready = () => screen().includes('· ready');
const openPicker = () => /^Select model$/m.test(screen());
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
async function open() { send('/model\r'); await until(() => openPicker(), 'picker open'); }
async function close() { send('\x1b'); await until(() => !openPicker() && ready(), 'picker closed'); }

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w281-model-picker-ultracode.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
  '--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
child.stdout.on('data', chunk => active.chunks.push(chunk));
child.stderr.on('data', chunk => active.chunks.push(chunk));

try {
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');
  await open();
  captures.plain = screen();
  pass('without ultracode the effort footer carries no suffix',
    screen().includes('Left/Right adjust') && !screen().includes('adjust · Ultracode'));
  await close();
  send('/effort ultracode on\r');
  await until(() => screen().includes('Ultracode on (this session only)'), 'ultracode on');
  pass('the effort command turns the session ultracode flag on');
  await open();
  captures.ultracode = screen();
  pass('the picker footer names ultracode while the session flag is on',
    /Left\/Right adjust · Ultracode on \(\/effort\)/u.test(screen()));
  pass('the suffix rides the effort line and leaves the guide row alone',
    screen().includes('Enter set as default / s use this session only / Esc cancel'));
  send('\x1b[C');
  await until(() => screen().includes('◈ max effort') || screen().includes('◉ xHigh effort'), 'effort step');
  pass('stepping the effort keeps the suffix on the line',
    screen().includes('Ultracode on (/effort)'));
  send('\x1b[D\x1b[D\x1b[D');
  await close();
  send('/effort ultracode off\r');
  await until(() => screen().includes('Ultracode off'), 'ultracode off');
  pass('the effort command turns the session ultracode flag off');
  await open();
  pass('the suffix disappears with the flag',
    screen().includes('Left/Right adjust') && !screen().includes('adjust · Ultracode'));
  await close();
  send('turn\r');
  await until(() => screen().includes('answered 1'), 'a turn finished');
  pass('the picker changes send no provider request of their own', requests.length === 1);
  send('/exit\r');
  const status = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  pass('the CLI exits zero', status === 0);
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256 }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  if (child.exitCode === null) child.kill('SIGKILL');
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
