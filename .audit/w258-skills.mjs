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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w258-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
const home = path.join(temporary, 'home');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(home);
const skills = path.join(workspace, '.harness', 'skills');
for (const [name, description, extra] of [['alpha', 'First skill', ''], ['beta', 'Second skill', ''],
  ['locked', 'Author locked', 'disable-model-invocation: true\n']]) {
  fs.mkdirSync(path.join(skills, name), { recursive: true });
  fs.writeFileSync(path.join(skills, name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n${extra}---\n\nbody\n`);
}
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
  HOME: home, LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_EFFORT', 'TMUX', 'STY'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(100, 34);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const ready = () => screen().includes('· ready');
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
  { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
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
const localFile = path.join(workspace, '.harness', 'settings.local.json');
try {
  await launch();
  send('/skills\r');
  await until(() => screen().includes('Skills') && screen().includes('alpha'), 'skills panel');
  captures.list = screen();
  pass('bare /skills opens the recovered Skills panel', screen().includes('3 skills') &&
    screen().includes('enter/space to cycle, t to sort, esc to save'));
  pass('each row carries its source and token range', screen().includes('< 20 tok'));
  pass('the author-locked skill shows the lock and the user-only word',
    screen().includes('locked by author') && screen().includes('user-only'));

  send('\r');
  await until(() => screen().includes('name-only · project'), 'alpha cycled');
  captures.cycled = screen();
  pass('Enter cycles the focused row to name-only', screen().includes('name-only · project'));

  send('t');
  await until(() => screen().includes('sorted by tokens'), 'sorted');
  captures.sorted = screen();
  pass('t sorts the list by token estimate', screen().includes('sorted by tokens'));

  send('\x1b');
  await until(() => ready() && screen().includes('Updated 1 skill override'), 'saved');
  captures.saved = screen();
  pass('Escape saves the diff and reports the effective change', screen().includes('Updated 1 skill override'));
  const stored = JSON.parse(fs.readFileSync(localFile, 'utf8'));
  pass('the local settings file carries only the changed override',
    JSON.stringify(stored) === JSON.stringify({ skillOverrides: { alpha: 'name-only' } }));

  send('/skills\r');
  await until(() => screen().includes('Skills') && screen().includes('alpha'), 'skills panel reopened');
  pass('the saved mode is the row default on the next open', screen().includes('name-only · project'));
  send('\x1b');
  await until(() => ready() && screen().includes('No changes'), 'no changes');
  pass('closing without a new change reports No changes');

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
