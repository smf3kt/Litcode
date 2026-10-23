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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w237-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
const seed = permissions => JSON.stringify({ model: 'fixture', thinking: false, keep: 'authored',
  ...(permissions === undefined ? {} : { permissions }) });
fs.writeFileSync(settingsFile, seed({ allow: ['Bash'], defaultMode: 'default' }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const children = [], checks = [], captures = {};
let active;

const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const server = http.createServer((request, response) => {
  request.resume();
  request.on('end', () => sse(response, [
    ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant',
      model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 1 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'finished' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } }],
    ['message_stop', { type: 'message_stop' }],
  ]));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(90, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
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
async function launch({ resume, permission = true } = {}) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway', ...(permission ? ['--permission-mode', 'bypass'] : [])])],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 25000);
  return current;
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, screen()); }
async function openConfig() { send('/config\r'); await until(() => panel() && screen().includes('Default permission mode'), 'Config rows'); }
async function selectRow() {
  send('permission\r'); await until(() => panel() && screen().includes('Enter/Space change'), 'permission row selected');
}
async function cycle(value) {
  send('\x1b[C');
  await until(() => stored().permissions?.defaultMode === value && !screen().includes('Saving settings'), `persist default mode ${value}`);
}
async function closeConfig() {
  for (let index = 0; index < 3 && panel(); index++) { send('\x1b'); await delay(120); }
  await until(ready, 'Config closed');
}
try {
  const first = await launch(); await openConfig(); captures.defaultRow = screen();
  pass('Config exposes Default permission mode as the authored default, not the live bypass mode',
    /Default permission mode\s+default/.test(screen()) && screen().includes('bypass permissions on'));
  await selectRow(); await cycle('plan'); captures.changedRow = screen();
  pass('Right cycles the row to plan and the panel shows the new value', /Default permission mode\s+‹ plan ›/.test(screen()));
  pass('the live session mode stays bypass while the default changes', screen().includes('bypass permissions on'));
  pass('the write persists nested permissions.defaultMode beside authored permission keys',
    JSON.stringify(stored().permissions) === JSON.stringify({ allow: ['Bash'], defaultMode: 'plan' }) && stored().keep === 'authored');
  await closeConfig(); await stop();

  const session = fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'))
    .map(file => path.join(workspace, '.agent', file))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0]
    ?.replace(/^.*\/([^/]+)\.jsonl$/, '$1');
  await launch({ resume: session }); await openConfig(); captures.resumeRow = screen();
  pass('a resumed session keeps the default from its original pinned config', /Default permission mode\s+default/.test(screen()));
  await closeConfig(); await stop();

  await launch({ permission: false }); captures.freshPlan = screen();
  pass('a fresh session without a flag starts live in plan mode', screen().includes('plan mode on'));
  await stop();

  fs.writeFileSync(settingsFile, seed(undefined));
  await launch({ permission: false }); captures.freshDefault = screen();
  pass('an absent key starts the fresh session in bypass mode', screen().includes('bypass permissions on'));
  await openConfig();
  pass('the absent key reads as bypassPermissions', /Default permission mode\s+bypassPermissions/.test(screen()));
  await selectRow(); await cycle('dontAsk'); await cycle('default'); await cycle('plan');
  pass('writing into an absent permissions object creates it',
    JSON.stringify(stored().permissions) === JSON.stringify({ defaultMode: 'plan' }));
  await closeConfig(); await stop();

  fs.writeFileSync(settingsFile, seed({ defaultMode: 'default' }));
  fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness', 'settings.json'), JSON.stringify({ permissions: { defaultMode: 'plan' } }));
  await launch({ permission: false }); await openConfig();
  pass('a higher project layer decides the row value', /Default permission mode\s+plan/.test(screen()));
  await selectRow(); await cycle('acceptEdits');
  pass('the user write persists while the higher layer still shows in the row',
    JSON.stringify(stored().permissions) === JSON.stringify({ defaultMode: 'acceptEdits' }));
  pass('the higher project layer keeps the row at plan after the write', /Default permission mode\s+‹ plan ›/.test(screen()));
  await closeConfig(); await stop();
  await launch({ permission: false }); captures.precedence = screen();
  pass('a fresh session adopts the higher project layer', screen().includes('plan mode on'));
  await stop();
} finally {
  server.close();
  for (const current of children) if (current.child.exitCode === null) current.child.kill('SIGKILL');
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${captureIdentity().sha256}`);
}
