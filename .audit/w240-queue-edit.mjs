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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w240-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));
const requests = [], children = [], checks = [], captures = {};
let active;

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
      write(response, events(`msg_slow_${requests.length}`, 'SLOW-REPLY', false));
      return;
    }
    write(response, events(`msg_${requests.length}`, 'SECOND-REPLY', true));
    response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_KB_COHESION_FIXES'].includes(key)) delete env[key];
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
async function launch(extra) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    '--user-dir', user, '--no-inherit-gateway'],
    { cwd: root, env: { ...env, ...extra }, stdio: ['pipe', 'pipe', 'pipe'] });
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
const slowCount = () => requests.filter(body => JSON.stringify(body).includes('slow prompt')).length;
async function slowTurn() {
  const before = slowCount();
  send('slow prompt\r');
  await until(() => slowCount() > before, 'the slow turn request reached the fixture');
  await until(() => /running/.test(screen()) && screen().includes('ctrl+c to interrupt'), 'the turn is running');
}
try {
  let current = await launch({ CLAUDE_CODE_KB_COHESION_FIXES: '1' });
  await slowTurn();
  send('queued one\r');
  await until(() => screen().includes('Press up to select a queued message, then Enter to edit it'), 'the first queued prompt paints the hint');
  pass('a queued prompt paints the select hint while the turn runs');
  send('queued two\r');
  await delay(400);
  pass('the second queued prompt leaves exactly one live request', requests.length === 1);
  send('\x1b[A');
  await until(() => screen().includes('Press Enter to edit the selected message, or up again for an older one'), 'up selects the newest queued prompt');
  pass('up selects the newest queued prompt');
  send('\x1b'); await delay(120);
  await until(() => screen().includes('Press up to select a queued message, then Enter to edit it'), 'escape clears the selection');
  pass('escape clears the selection without cancelling the turn');
  pass('the turn is still running after escape', screen().includes('ctrl+c to interrupt'));
  send('\x1b[A');
  await until(() => screen().includes('or up again for an older one'), 'up selects again');
  send('\x1b[A');
  await until(() => screen().includes('Press Enter to edit the selected message, or up again for history'), 'up reaches the oldest row');
  pass('up walks toward the oldest queued prompt');
  send('\r');
  await until(() => screen().includes('queued one'), 'Enter pulls the selected prompt into the draft');
  pass('Enter pulls the selected prompt into the composer');
  assert.equal(requests.length, 1, screen()); checks.push('the pull sends nothing');
  console.log('PASS the pull sends nothing');
  send('\u000c');
  send('\x1b[A');
  await until(() => screen().includes('Press Enter to edit the selected message, or up again for history'), 'the remaining prompt is selectable');
  send('\r');
  await until(() => screen().includes('queued two'), 'the second prompt pulls into the draft');
  pass('the second queued prompt pulls after the first was taken');
  send('\u000c');
  await delay(300);
  pass('no pulled prompt was sent', requests.length === 1);
  captures.select = screen();
  send('\u0003');
  await until(() => !screen().includes('ctrl+c to interrupt'), 'the slow turn is interrupted');
  await stop(current);
  pass('the CLI exits zero after the selection session');

  current = await launch({});
  await slowTurn();
  send('alpha\r');
  await until(() => screen().includes('Press up to edit queued messages'), 'the plain hint paints');
  pass('without the cohesion flag the hint names the pull, not a selection');
  send('beta\r');
  await delay(300);
  send('\x1b[A');
  await until(() => screen().includes('alpha') && screen().includes('beta'), 'up pulls every queued prompt');
  pass('up pulls every queued prompt into the draft');
  assert.equal(requests.length, 2, screen()); checks.push('the plain pull sends nothing');
  console.log('PASS the plain pull sends nothing');
  send('\u000c');
  send('\u0003');
  await until(() => !screen().includes('ctrl+c to interrupt'), 'the second slow turn is interrupted');
  await stop(current);
  pass('the second CLI exits zero');
} finally {
  server.close();
  for (const current of children) if (current.child.exitCode === null) current.child.kill('SIGKILL');
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${captureIdentity().sha256}`);
}
