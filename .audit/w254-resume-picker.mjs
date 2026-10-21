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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w254-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
const requests = [], children = [], checks = [], captures = {};
let active;
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message',
      role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `response ${requests.length}` } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
    send('message_stop', { type: 'message_stop' }); response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_EFFORT', 'TMUX', 'STY'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(90, 30);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const panel = () => /^Resume session$/m.test(screen());
const ready = () => !panel() && screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 15000) {
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
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk));
  child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current);
  await until(() => screen().includes('· ready'), 'startup ready', 25000);
}
async function stop() {
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
}
async function turn(text) {
  const before = requests.length; send(`${text}\r`);
  await until(() => requests.length > before && screen().includes(`response ${before + 1}`) && screen().includes('· ready'), 'turn finished');
}
function sessions() {
  return fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')).map(file => file.slice(0, -6));
}
try {
  await launch(); await turn('first conversation');
  send('/rename Alpha session\r'); await until(() => screen().includes('Session title: Alp'), 'first named');
  await stop();
  await launch(); await turn('second conversation');
  send('/rename Beta session\r'); await until(() => screen().includes('Session title: Bet'), 'second named');
  const before = sessions(); assert.equal(before.length, 2);
  send('/resume\r'); await until(panel, 'resume panel');
  captures.list = screen();
  pass('bare /resume opens the recovered picker with its title', panel());
  pass('the list shows the other named session and hides the current one',
    /^> Alpha session$/m.test(screen()) && !/^> Beta session$/m.test(screen()));
  pass('the row carries its relative time and the list guide',
    /Alpha session/.test(screen()) && /ago|in /.test(screen())
    && screen().includes('Type to search / Enter select / Esc cancel'));
  send('zzz');
  await until(() => screen().includes('No sessions match "zzz".'), 'no-match text');
  pass('typing filters the list and shows the recovered no-match text');
  send('\x1b'); await until(() => !screen().includes('No sessions match') && panel(), 'search cleared');
  pass('Escape in search clears the query and keeps the panel open');
  send('\x1b'); await until(() => ready(), 'panel cancelled');
  pass('Escape in the list closes the panel with the cancellation notice',
    /Session selection(?: cancelled\.)?/.test(screen()));
  send('/resume\r'); await until(panel, 'resume panel again');
  send('alp'); await until(() => screen().includes('Alpha session') && !screen().includes('No sessions match'), 'filtered');
  send('\r'); await until(() => ready() && screen().includes('Session resumed.'), 'session resumed');
  captures.resumed = screen();
  pass('Enter on a filtered row switches to that session',
    screen().includes('Session resumed.') && sessions().length === before.length);
  const alpha = before.find(id => fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8').includes('Alpha session'));
  pass('the resumed session is the named Alpha log', alpha !== undefined);
  await turn('third conversation in the resumed session');
  pass('the resumed session keeps running turns',
    alpha !== undefined && fs.readFileSync(path.join(workspace, '.agent', `${alpha}.jsonl`), 'utf8')
      .includes('third conversation in the resumed session'));
  await stop();
  pass('every owned CLI exits zero', children.every(current => current.child.exitCode === 0));
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256 }, null, 2));
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${identity.sha256}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  for (const current of children) if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
