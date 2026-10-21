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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w250-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', verbose: false, prefersReducedMotion: false, keep: 'preserved' }));
const sessions = () => fs.existsSync(path.join(workspace, '.agent'))
  ? fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).sort() : [];
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const localSettingsFile = path.join(workspace, '.harness', 'settings.local.json');
const localStored = () => fs.existsSync(localSettingsFile)
  ? JSON.parse(fs.readFileSync(localSettingsFile, 'utf8')) : {};

const requests = [], checks = [];
const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    requests.push(body);
    sse(response, [
      ['message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant',
        model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 1 } } }],
      ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
      ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `response ${requests.length}` } }],
      ['content_block_stop', { type: 'content_block_stop', index: 0 }],
      ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: 10 } }],
      ['message_stop', { type: 'message_stop' }],
    ]);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_KB_COHESION_FIXES'].includes(key)) delete env[key];

let active;
const screen = () => {
  const terminal = new TerminalScreen(160, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().map(line => line.trimEnd()).join('\n'); terminal.close(); return text;
};
const panel = () => /^Config$/m.test(screen());
const ready = () => !panel() && screen().includes('· ready');
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

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w250-config-live.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
  '--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
child.stdout.on('data', chunk => active.chunks.push(chunk));
child.stderr.on('data', chunk => active.chunks.push(chunk));

try {
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');
  const before = sessions().length;
  pass('the fixture starts with one session file', before === 1);
  send('/config\r');
  await until(() => panel() && screen().includes('Verbose'), 'config open');
  send('verbose');
  await until(() => screen().includes('⌕ verbose'), 'verbose filter');
  send('\r');
  await until(() => screen().includes('Enter/Space change'), 'list focus');
  send(' ');
  await until(() => stored().verbose === true && !screen().includes('Saving settings'), 'verbose toggles');
  pass('the verbose row persists its setting');
  pass('the user settings document keeps its other keys', stored().keep === 'preserved');
  send('\x1b'); await until(ready, 'config closed');
  pass('the verbose change opened no configuration branch', sessions().length === before);
  send('verbose probe\r');
  await until(() => requests.length === 1 && ready() && screen().includes('response 1'), 'turn done');
  pass('the live change keeps the session running', requests.length === 1);
  pass('the verbose change still opened no configuration branch', sessions().length === before);

  send('/config\r');
  await until(() => panel() && screen().includes('Reduce motion'), 'config open again');
  send('reduceMotion');
  await until(() => screen().includes('⌕ reduceMotion'), 'reduce-motion filter');
  send('\r');
  await until(() => screen().includes('Enter/Space change'), 'list focus again');
  send(' ');
  await until(() => localStored().prefersReducedMotion === true && !screen().includes('Saving settings'), 'reduce motion toggles');
  pass('the reduce-motion row persists its setting');
  send('\x1b'); await until(ready, 'config closed again');
  pass('the reduce-motion change opened no configuration branch', sessions().length === before);
  send('second probe\r');
  await until(() => requests.length === 2 && ready() && screen().includes('response 2'), 'second turn done');
  pass('the second turn uses the same session', sessions().length === before);
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
