import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

/** The provider streams, so the stub answers with Anthropic SSE events, not one JSON body. */
function sse(res, text, stopReason) {
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: 'msg_probe', type: 'message', role: 'assistant',
    model: 'fixture/probe', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } });
  send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w275-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
const checks = [], captures = {};
let active;

const requests = [];
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* a stream body that is not JSON stays empty */ }
    requests.push(parsed);
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    // The fork child's prompt names the task; the parent turn answers the seeded history.
    const last = Array.isArray(parsed.messages) ? parsed.messages.at(-1) : undefined;
    const text = JSON.stringify(last?.content ?? '').includes('PROBE_TASK') ? 'CHILD_RESULT' : 'PARENT_REPLY';
    sse(response, text, 'end_turn');
  });
});
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
const flat = () => screen().replace(/\s+/g, '');
const ready = () => screen().includes('· ready') || flat().includes('?forshortcuts');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(80);
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
  await until(ready, 'startup ready', 30000);
  pass('the compiled CLI starts ready');

  // Source `m` (chunk-57v1bkyr.js 15000): the empty argument prints the usage row and spawns nothing.
  send('/subtask\r');
  await until(() => flat().includes('Usage:/subtask\\<task\\>'), 'usage row');
  pass('a bare /subtask prints the source usage row');
  captures.usage = screen();
  pass('a bare /subtask starts no child', requests.length === 0);

  // Source `m`: the first-turn guard fires before any spawn when there is no conversation.
  send('/subtask PROBE_TASK\r');
  await until(() => flat().includes('Cannotstartasubtaskbeforethefirstconversationturn'), 'first turn row');
  pass('a subtask with no conversation reports the first-turn row');
  captures.firstTurn = screen();
  pass('the first-turn refusal still starts no child', requests.length === 0);

  // One completed turn, then the fork spawns with the whole conversation.
  send('hello there\r');
  await until(() => flat().includes('PARENT_REPLY'), 'parent turn');
  send('/subtask PROBE_TASK\r');
  await until(() => /⑂forkedprobetask\([0-9a-f]{4}\)/.test(flat()), 'fork row');
  pass('a subtask after a turn reports the forked row');
  captures.fork = screen();
  const fork = /\u2442 forked (probetask) \(([0-9a-f]{4})\)/.exec(screen());
  pass('the row names the allocated agent and its last four id characters', fork !== null);
  // The child runs on its own; the parent does not block on it.
  await until(() => requests.some(request => JSON.stringify(request.messages ?? '').includes('PROBE_TASK')),
    'child request');
  pass('the child receives the task prompt');
  const childRequest = requests.find(request => JSON.stringify(request.messages ?? '').includes('PROBE_TASK'));
  const seeded = JSON.stringify(childRequest?.messages ?? '');
  pass('the child is seeded with the completed conversation', seeded.includes('hello there') && seeded.includes('PARENT_REPLY'));
  // The child's result comes back through the child-agent event stream, which becomes a turn.
  await until(() => requests.some(request => JSON.stringify(request.messages ?? '').includes('Child agent events')),
    'child event turn');
  pass('the child result returns as a child-agent event turn');
  captures.after = screen();
  pass('the session stays interactive after the fork', !flat().includes('error:'));

  send('/exit\r');
  const code = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/exit ends the session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    identity: identity.sha256, ok: checks.length, requests: requests.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
