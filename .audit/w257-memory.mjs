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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w257-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
const home = path.join(temporary, 'home'), editorLog = path.join(temporary, 'editor.log');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(home);
fs.writeFileSync(path.join(workspace, 'HARNESS.md'), '# Project instructions\n');
const editor = path.join(temporary, 'fake-editor.sh');
fs.writeFileSync(editor, '#!/bin/sh\nprintf "%s\\n" "$@" >> "$MEMORY_EDITOR_LOG"\n');
fs.chmodSync(editor, 0o755);
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
  HOME: home, EDITOR: editor, VISUAL: '', MEMORY_EDITOR_LOG: editorLog,
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_EFFORT', 'TMUX', 'STY'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(90, 32);
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
const editorCalls = () => fs.existsSync(editorLog)
  ? fs.readFileSync(editorLog, 'utf8').split('\n').filter(Boolean) : [];
try {
  await launch();
  send('/memory\r');
  await until(() => screen().includes('Memory') && screen().includes('Project instructions'), 'memory dialog');
  captures.list = screen();
  pass('bare /memory opens the Memory panel over the loaded instruction files',
    screen().includes('Project instructions') && screen().includes('User instructions'));
  pass('the panel names the workspace file and its checked-in state',
    screen().includes('./HARNESS.md'));
  send('\x1b');
  await until(() => ready() && screen().includes('Cancelled memory editing'), 'memory cancelled');
  pass('Escape reports the recovered cancellation');

  send('/memory\r');
  await until(() => screen().includes('Memory') && screen().includes('Project instructions'), 'memory dialog again');
  send('\r');
  await until(() => screen().includes('Opened ./HARNESS.md'), 'project file opened');
  pass('selecting the project file opens it in the configured editor',
    editorCalls().some(call => call.endsWith('/workspace/HARNESS.md')));
  pass('the report names the editor source and the change hint',
    screen().includes(`Using $EDITOR="${editor}"`) && screen().includes('To change editor'));

  send('/memory\r');
  await until(() => screen().includes('Memory') && screen().includes('User instructions'), 'memory dialog for user file');
  send('\x1b[B'); await delay(120); send('\r');
  await until(() => screen().includes('Opened ~/HARNESS.md'), 'user placeholder opened');
  pass('choosing the absent user file creates it before the editor opens',
    fs.existsSync(path.join(home, 'HARNESS.md')));
  pass('the user path is displayed from the home directory', editorCalls().some(call => call.endsWith('/home/HARNESS.md')));
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
