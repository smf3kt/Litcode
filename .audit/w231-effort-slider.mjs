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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w231-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ keep: 'preserved', prefersReducedMotion: true }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
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
const track = () => screen().split('\n').find(row => /^─*▲─*$/u.test(row.trim()) && row.trim().length === 42)?.trim();
const at = index => track()?.indexOf('▲') === [1, 10, 20, 30, 40][index];
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
const send = value => active.child.stdin.write(value);
async function launch(extra = {}) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env: { ...env, ...extra }, stdio: ['pipe', 'pipe', 'pipe'] });
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
async function open(index) {
  send('/effort\r');
  await until(() => /^Effort$/m.test(screen()) && at(index), 'slider open');
}
async function step(direction, index, count = 1) {
  send((direction === 'left' ? '\x1b[D' : '\x1b[C').repeat(count));
  await until(() => at(index), `slider ${direction}`);
}
async function accept(key, text) {
  send(key); await until(() => track() === undefined && screen().includes('· ready') && screen().includes(text), 'selection applied');
}
async function turn(effort) {
  const before = requests.length;
  send(`probe turn ${before + 1}\r`);
  await until(() => requests.length > before && screen().includes(`response ${before + 1}`) && screen().includes('· ready'), 'turn finished');
  assert.equal(requests.at(-1)?.output_config?.effort, effort, 'actual output_config.effort');
}
try {
  await launch(); await open(2);
  pass('bare effort opens the source track and labels with high selected',
    screen().includes('Faster                             Smarter')
    && screen().includes('low     medium     high     xhigh      max')
    && !screen().includes('Selected:') && !screen().includes('>     '));
  pass('the dialog names its arrow, Enter, session-only and cancel keys', screen().includes('Left/Right adjust / Enter confirm / s for this session only / Esc cancel'));
  const initial = fs.readFileSync(settingsFile, 'utf8');
  await step('right', 3);
  pass('one right step previews xhigh without a write or provider request', fs.readFileSync(settingsFile, 'utf8') === initial && requests.length === 0);
  await step('right', 4, 5);
  pass('the upper endpoint clamps at max and shows its complete note', screen().replace(/\s+/g, ' ').includes(
    'May use excessive tokens resulting in long response times or overthinking. Use sparingly for the hardest tasks.'));
  captures.max = screen();
  send('\x1b'); await until(() => track() === undefined && screen().includes('· ready'), 'cancel closed');
  pass('Escape discards the preview and preserves the settings bytes', fs.readFileSync(settingsFile, 'utf8') === initial);
  await open(2); await step('left', 0, 5); await accept('s', 'Set effort level to low (this session only)');
  pass('the lower endpoint clamps and s keeps the settings byte-identical', fs.readFileSync(settingsFile, 'utf8') === initial);
  await turn('low'); pass('the session-only pick reaches the next request');
  await open(0); await step('right', 1); await accept('\r', 'Set effort level to medium (saved as your default for new sessions)');
  pass('Enter writes the picked default and preserves unrelated settings', stored().effort === 'medium' && stored().keep === 'preserved');
  await turn('medium'); pass('the default pick reaches the current request');
  await open(1); await step('right', 4, 8); await accept('\r', 'Set effort level to max (this session only)');
  pass('max remains session-only even on Enter', stored().effort === 'medium');
  await turn('max'); pass('max reaches the request while the stored default stays medium');
  await open(4); send('\x1b'); await until(() => track() === undefined && screen().includes('· ready'), 'max reopen canceled');
  pass('reopen follows the live session pick');
  await stop(); await launch(); await open(1);
  pass('a fresh process restores the persisted medium default');
  await step('left', 0); await accept('s', 'Set effort level to low (this session only)');
  await open(0); await accept('\r', 'Set effort level to low (saved as your default for new sessions)');
  pass('Enter on an unchanged level promotes a session-only choice to a default', stored().effort === 'low');
  await stop(); await launch({ LLM_EFFORT: 'high' }); await open(2);
  pass('the slider starts on the environment override ahead of stored settings');
  await step('left', 0, 2); await accept('\r', 'LLM_EFFORT=high overrides this session');
  pass('a selection under an override still saves the requested next-session default', stored().effort === 'low');
  await turn('high'); pass('the environment override remains effective in the actual request');
  await stop(); await launch(); await turn('low');
  pass('clearing the environment restores the saved choice on a fresh process');
  await stop();
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256,
    requests: requests.map(body => ({ model: body.model, effort: body.output_config?.effort })) }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  for (const current of children) {
    if (current.child.exitCode === null && current.child.signalCode === null) {
      current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
    }
  }
  await new Promise(resolve => server.close(resolve));
}
