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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w242-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));
const requests = [], checks = [];
let active, mainTurns = 0;

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
const job = { name: 'run_background',
  input: { command: 'echo $$ > job.pid; exec sleep 60', description: 'hold', timeout_ms: 60_000 } };
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    mainTurns++;
    requests.push({ body, tool: job.name });
    // Only the first turn starts a job; a later notification-driven turn must not restart it.
    if (mainTurns === 1) {
      streamed(response, { id: `msg_tool_${mainTurns}`, stopReason: 'tool_use', json: true,
        block: { start: { type: 'tool_use', id: `toolu_w242_${mainTurns}`, name: job.name, input: {} },
          text: JSON.stringify(job.input) } });
      return;
    }
    streamed(response, { id: `msg_done_${mainTurns}`, stopReason: 'end_turn',
      block: { start: { type: 'text', text: '' }, text: `finished ${mainTurns}` } });
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
const jobPid = () => {
  const file = path.join(workspace, 'job.pid');
  if (!fs.existsSync(file)) return undefined;
  const pid = Number(fs.readFileSync(file, 'utf8').trim());
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
};
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function untilDead(pid, label) {
  const end = Date.now() + 5000;
  while (Date.now() < end) { if (!alive(pid)) return; await delay(50); }
  throw new Error(`${label}: pid ${pid} still alive\n${screen()}`);
}

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w242-kill-agents.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
  '--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
child.stdout.on('data', chunk => active.chunks.push(chunk));
child.stderr.on('data', chunk => active.chunks.push(chunk));

try {
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');
  send('\u0018\u000b');
  await until(() => screen().includes('No background agents running'), 'idle none feedback');
  pass('with no job the chord reports that none is running');
  await delay(2200);
  send('start a job\r');
  await until(() => jobPid() !== undefined && ready(), 'background job started', 25000);
  const pid = jobPid();
  pass('run_background starts a live job', alive(pid));
  await delay(300);
  send('draft');
  await until(() => screen().includes('draft'), 'draft rendered');
  const requestsBefore = requests.length;
  send('\u0018\u000b');
  await until(() => screen().includes('again to stop background agents'), 'kill confirmation');
  pass('the first chord press asks for confirmation');
  pass('the job is still running before the confirmation', alive(pid));
  pass('the chord does not send a prompt', requests.length === requestsBefore);
  send('\u0018\u000b');
  await untilDead(pid, 'the confirmed chord stops the job');
  pass('the second press inside the window stops the job');
  pass('the confirmation row is gone', !screen().includes('again to stop background agents'));
  await delay(200);
  send('\u0018\u000b');
  await until(() => screen().includes('No background agents running'), 'none feedback');
  pass('a later press reports that no background agents are running');
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
