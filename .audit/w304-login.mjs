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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w304-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const credentialFile = path.join(user, 'credentials.json');
const children = [], checks = [], captures = {};
let active;
const requests = [];

// One owned loopback gateway that speaks the Messages protocol the login writes.
const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    requests.push({ url: request.url, headers: request.headers, body: body.slice(0, 4000) });
    sse(response, [
      ['message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant',
        model: 'deepseek-flash', content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'signed-in reply' } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } }],
      ['message_stop', { type: 'message_stop' }],
    ]);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}`;
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LITCODE_NO_BROWSER: '1' };
for (const key of Object.keys(env)) {
  if (/^ANTHROPIC_/.test(key) || /^LLM_/.test(key) || ['TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
}
const screen = () => {
  const terminal = new TerminalScreen(100, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const panel = () => /^Config$/m.test(screen());
const ready = () => !panel() && screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(50);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch(extra = []) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w304-login.exp'), process.execPath,
    path.join(root, 'bin/litcode.mjs'), '--workspace', workspace, '--user-dir', user, '--no-inherit-gateway', ...extra],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 30000);
  return current;
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(8000).then(() => 'timeout')]), 0, screen()); }
function journals() {
  const dir = path.join(workspace, '.agent');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).map(name => fs.readFileSync(path.join(dir, name), 'utf8')) : [];
}
try {
  // 1. No credential and no model at all: the session still opens.
  const first = await launch(); captures.startup = screen();
  pass('a session with no LLM configuration starts instead of refusing', /· ready/.test(screen()));
  pass('the startup names the sign-in route rather than a hard failure',
    /litcode --login deepseek|\/login/.test(screen()));
  // 2. A model request before sign-in fails with the actionable message, and the session survives.
  send('hello there\r');
  await until(() => /No model credential yet/.test(screen()), 'missing-credential error');
  pass('the first model request explains how to sign in', /No model credential yet\. Run \/login to sign in/.test(screen()));
  pass('the session stays open after that failure', /· ready/.test(screen()));
  // 3. /login deepseek with the key pasted: the credential lands with mode 0600.
  send('/login deepseek\r');
  await until(() => /DeepSeek API key/.test(screen()) || /Paste the API key/.test(screen()), 'key prompt');
  send('sk-fixture-deepseek-key\r');
  // The model row follows the key; Enter accepts the highlighted default.
  await until(() => /DeepSeek model/.test(screen()), 'model row');
  send('\r');
  await until(() => fs.existsSync(credentialFile), 'credential written');
  const stored = JSON.parse(fs.readFileSync(credentialFile, 'utf8'));
  pass('the login writes the DeepSeek endpoint, header and key', stored.providers.deepseek?.baseURL === 'https://api.deepseek.com/anthropic'
    && stored.providers.deepseek?.auth === 'api-key' && stored.providers.deepseek?.key === 'sk-fixture-deepseek-key');
  pass('the credential file is owner-only', (fs.statSync(credentialFile).mode & 0o777) === 0o600);
  pass('the key never appears in the terminal output', !screen().includes('sk-fixture-deepseek-key'));
  await until(() => /Signed in to deepseek/.test(screen()) && /· ready/.test(screen()), 'signed in', 30000);
  captures.signedIn = screen();
  pass('the session adopts the signed-in model', /deepseek-flash/.test(screen()));
  // 4. A real request now goes out with the stored credential. Point the endpoint at the
  //    owned fixture by rewriting only the stored base URL, the same shape a real login writes.
  stored.providers.deepseek.baseURL = endpoint;
  fs.writeFileSync(credentialFile, JSON.stringify(stored, null, 2) + '\n');
  send('/exit\r'); await Promise.race([active.closed, delay(8000)]);
  const second = await launch(); captures.restarted = screen();
  pass('a restarted session picks the stored credential up without any LLM_* value', /· ready/.test(screen()));
  send('what model are you\r');
  await until(() => requests.length > 0, 'gateway request', 30000);
  await until(() => /signed-in reply/.test(screen()), 'reply rendered', 30000);
  pass('the request carries the stored api key as x-api-key', requests[0]?.headers['x-api-key'] === 'sk-fixture-deepseek-key');
  pass('the request names the signed-in model', /"model":"deepseek-flash"/.test(requests[0]?.body ?? ''));
  pass('the reply is shown', /signed-in reply/.test(screen()));
  pass('no journal record contains the key', journals().every(text => !text.includes('sk-fixture-deepseek-key')));
  await stop();

  // 5. --logout removes the credential and a fresh session asks for a login again.
  const logout = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--user-dir', user, '--logout'],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const logoutOut = await new Promise(resolve => {
    let text = ''; logout.stdout.on('data', chunk => { text += chunk; });
    logout.on('close', code => resolve({ code, text }));
  });
  pass('--logout reports the removal and exits 0', logoutOut.code === 0 && /Signed out/.test(logoutOut.text));
  pass('--logout deletes the credential file', !fs.existsSync(credentialFile));
  await launch(); captures.afterLogout = screen();
  pass('after logout a new session starts unconfigured again', /· ready/.test(screen()) && /No model credential yet/.test(screen()));
  await stop();

  // 6. A one-shot task still refuses, because there is nowhere to ask.
  const oneShot = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', user, '--no-inherit-gateway', 'do a thing'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const oneShotOut = await new Promise(resolve => {
    let text = ''; oneShot.stderr.on('data', chunk => { text += chunk; });
    oneShot.on('close', code => resolve({ code, text }));
  });
  pass('a one-shot task without a credential still fails with the sign-in hint',
    oneShotOut.code === 1 && /litcode --login deepseek/.test(oneShotOut.text));
} finally {
  server.close();
  for (const current of children) if (current.child.exitCode === null) current.child.kill('SIGKILL');
  fs.writeFileSync(path.join(process.env.CLAUDE_JOB_DIR ?? os.tmpdir(), 'w304-cli-result.json'),
    JSON.stringify({ checks, captures, requests: requests.map(r => ({ url: r.url, headers: Object.keys(r.headers) })) }, null, 2));
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${captureIdentity().sha256}`);
}
