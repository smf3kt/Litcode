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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w276-cli-')));
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
    const last = Array.isArray(parsed.messages) ? parsed.messages.at(-1) : undefined;
    const text = JSON.stringify(last?.content ?? '').includes('FORK_TASK') ? 'COPY_REPLY' : 'PARENT_REPLY';
    sse(response, text, 'end_turn');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseEnv = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(baseEnv)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_DISABLE_AGENT_VIEW', 'IS_DEMO',
    'CLAUDE_CODE_COORDINATOR_MODE'].includes(key)) delete baseEnv[key];
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
/** One compiled CLI session in its own workspace and user directory. */
async function startSession(tag, extraEnv = {}) {
  const workspace = path.join(temporary, `${tag}-workspace`), user = path.join(temporary, `${tag}-user`);
  fs.mkdirSync(workspace); fs.mkdirSync(user);
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: workspace, env: { ...baseEnv, HOME: temporary, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, `${tag} startup ready`, 30000);
  return { workspace };
}
async function endSession() {
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
}
try {
  // Open fleet fork: `njt` copies into a background session and keeps this one.
  const open = await startSession('open');
  pass('the compiled CLI starts ready in the open fleet fork');

  // `Ue` (chunk-zsg1bb14.js 19311): nothing to seed refuses before any spawn.
  send('/fork\r');
  await until(() => flat().includes('Nothingtoforkyet.Sendamessagefirst.'), 'nothing row');
  pass('a fork with no conversation prints the source row');
  captures.nothing = screen();

  send('hello there\r');
  await until(() => flat().includes('PARENT_REPLY'), 'parent turn');
  // `UKn`/`Ucn` (chunk-t721xmjm.js 47819/46831): the bare form waits for a prompt.
  send('/fork\r');
  await until(() => /sessionwaitingforaprompt·[0-9a-f]{8}/.test(flat()), 'waiting row');
  pass('a bare /fork reports the waiting row with the short id');
  captures.waiting = screen();
  const waiting = /session waiting for a prompt · ([0-9a-f]{8})/.exec(screen());
  pass('the waiting row carries eight id characters', waiting !== null);
  // The copy is a real detached session with its own journal and log.
  const journals = fs.readdirSync(path.join(open.workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
  pass('the copy wrote its own journal', journals.length === 2, );
  const logs = fs.readdirSync(path.join(open.workspace, '.agent', 'background')).filter(name => name.endsWith('.log'));
  pass('the copy wrote its own log', logs.length === 1);
  pass('the session stays interactive after the copy', !flat().includes('error:'));

  // A prompt starts the copy running instead of waiting.
  send('/fork FORK_TASK\r');
  await until(() => /sessionrunning·[0-9a-f]{8}/.test(flat()), 'running row');
  pass('a /fork with a prompt reports the running row');
  captures.running = screen();
  await until(() => requests.some(request => JSON.stringify(request.messages ?? '').includes('FORK_TASK')),
    'copy request', 30000);
  pass('the copy runs its prompt against the provider');
  pass('the session stays interactive after the running copy', !flat().includes('error:'));
  await endSession();
  pass('/exit ends the open-fleet session');

  // Closed fleet fork: `tjt` is the directive registration; `ojt` (`/subtask`) is not offered.
  const closed = await startSession('closed', { CLAUDE_CODE_DISABLE_AGENT_VIEW: '1' });
  pass('the compiled CLI starts ready in the closed fleet fork');
  send('/fork\r');
  await until(() => flat().includes('Usage:/fork\\<directive\\>'), 'usage row');
  pass('a bare /fork prints the directive usage row');
  captures.usage = screen();
  send('hello there\r');
  await until(() => flat().includes('PARENT_REPLY'), 'closed parent turn');
  send('/fork FORK_TASK\r');
  await until(() => /⑂forkedforktask\([0-9a-f]{4}\)/.test(flat()), 'directive fork row');
  pass('a /fork directive reports the forked row');
  captures.forked = screen();
  const forked = /⑂ forked (forktask) \(([0-9a-f]{4})\)/.exec(screen());
  pass('the row names the allocated agent and its last four id characters', forked !== null);
  await until(() => requests.filter(request => JSON.stringify(request.messages ?? '').includes('FORK_TASK')).length >= 2,
    'directive child request', 30000);
  pass('the directive fork runs as a child of the closed-fleet session');
  await endSession();
  pass('/exit ends the closed-fleet session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    identity: identity.sha256, ok: checks.length, requests: requests.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
