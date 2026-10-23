import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w295-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
fs.mkdirSync(path.join(workspace, '.harness'));
const userFile = path.join(user, 'settings.json'), project = path.join(workspace, '.harness/settings.json');
fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 1, prefersReducedMotion: false, showTurnDuration: false }));
const requests = [], streams = [], children = [], checks = [];
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push(body);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const event = (name, data) => response.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    event('message_start', { type: 'message_start', message: { id: `message_${requests.length}`, type: 'message', role: 'assistant',
      model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4, output_tokens: 0 } } });
    event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    const stream = { event, response, next: 0, closed: false,
      append(count) {
        const text = Array.from({ length: count }, () => `STREAM_${String(this.next++).padStart(3, '0')}`).join('\n') + '\n';
        event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
      },
      finish() {
        event('content_block_stop', { type: 'content_block_stop', index: 0 });
        event('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 12 } });
        event('message_stop', { type: 'message_stop' }); response.end();
      } };
    response.on('close', () => { stream.closed = true; }); streams.push(stream); stream.append(48);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3',
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'NO_COLOR'].includes(key)) delete env[key];
let active;
const lines = () => active.screen.lines();
const text = () => lines().map(line => line.trimEnd()).join('\n');
const ready = () => text().includes('· ready') && !/^Config$/m.test(text()) && !text().includes('j/k scroll');
const send = value => active.child.stdin.write(value);
const streamRows = () => lines().flatMap(line => line.match(/STREAM_\d{3}/g) ?? []);
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(25);
  }
  throw new Error(`${label}\n${text()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w295-auto-scroll.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
    '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(100, 30), decoder = new StringDecoder('utf8');
  const owner = { child, screen, closed: new Promise(resolve => child.once('close', resolve)) };
  active = owner; children.push(owner);
  const output = chunk => screen.write(decoder.write(chunk));
  child.stdout.on('data', output); child.stderr.on('data', output);
  await until(ready, 'startup ready', 30000);
}
async function start() {
  const count = streams.length; send('\x15STREAM fixture\r');
  await until(() => streams.length === count + 1 && streamRows().includes('STREAM_047'), 'stream tail visible');
  return streams.at(-1);
}
async function toggle(requested, effective = requested) {
  send('\x15/config\r'); await until(() => /^Config$/m.test(text()), 'Config opens');
  send('auto-scroll'); await until(() => text().includes('Auto-scroll'), 'Auto-scroll row'); send('\r ');
  await until(() => JSON.parse(fs.readFileSync(userFile, 'utf8')).autoScrollEnabled === requested
    && !text().includes('Saving settings'), 'Auto-scroll saved');
  pass(`Config persists ${requested} and displays effective ${effective}`,
    lines().some(line => new RegExp(`^Auto-scroll\\s+${effective}\\s*$`).test(line.trim())));
  send('\x1b'); await delay(120); await until(ready, 'Config closes');
}
async function stop() {
  send('\x15/exit\r');
  pass('compiled CLI exits zero', await Promise.race([active.closed, delay(6000).then(() => 'timeout')]) === 0);
  active.screen.close();
}
try {
  await launch(); const first = await start(); const original = journals().length;
  pass('default output follows the owned streaming tail');
  send('\x1b[5~'); await delay(100); const fixed = streamRows();
  first.append(20); await delay(180);
  pass('PageUp keeps the same rendered rows during streaming', JSON.stringify(streamRows()) === JSON.stringify(fixed));
  pass('new output exposes the native bottom indicator', /Jump to bottom/.test(text()));
  send('retained draft'); await delay(60);
  pass('user-away edit preserves the viewport and draft', JSON.stringify(streamRows()) === JSON.stringify(fixed) && text().includes('retained draft'));
  send('\x1b[1;5F'); await until(() => streamRows().includes('STREAM_067'), 'forced bottom');
  first.append(4); await until(() => streamRows().includes('STREAM_071'), 'forced follow');
  pass('explicit bottom restores sticky following');
  first.finish(); await until(ready, 'first turn completes'); await toggle(false);
  pass('display setting changes retain the same journal', journals().length === original);
  pass('settings writer preserves unrelated values', JSON.parse(fs.readFileSync(userFile, 'utf8')).keep === 1);
  const second = await start(); pass('disabling retains the existing sticky tail');
  send('\x1b[5~'); await delay(90); const offRows = streamRows(); second.append(20); await delay(180);
  pass('disabled output preserves the scrolled viewport', JSON.stringify(streamRows()) === JSON.stringify(offRows));
  send('\x1b[6~'.repeat(20)); await until(() => streamRows().includes('STREAM_067'), 'incremental scroll reaches current bottom');
  const atBottom = streamRows(); second.append(5); await delay(180);
  pass('incremental bottom remains fixed while disabled', JSON.stringify(streamRows()) === JSON.stringify(atBottom));
  send('\x1b[1;5F'); await until(() => streamRows().includes('STREAM_072'), 'off forced bottom'); second.append(3);
  await until(() => streamRows().includes('STREAM_075'), 'off forced follow');
  pass('Ctrl+End forces sticky even with Auto-scroll off');
  send('\x1b[<64;2;3M\x1b[5~'); await delay(100); second.append(20); await delay(180);
  send('kept click draft'); await delay(60);
  const pillRow = lines().findIndex(line => /Jump to bottom|new messages?/.test(line)); assert.ok(pillRow >= 0, text());
  const column = lines()[pillRow].search(/Jump to bottom|\d+ new message/);
  const background = active.screen.cell(column, pillRow).getBgColor();
  send(`\x1b[<35;${column + 1};${pillRow + 1}M`); await delay(60);
  pass('native bottom indicator paints hover', active.screen.cell(column, pillRow).getBgColor() !== background);
  send(`\x1b[<0;${column + 1};${pillRow + 1}M`); await delay(40);
  send(`\x1b[<0;${column + 1};${pillRow + 1}m`);
  await until(() => streamRows().includes('STREAM_095'), 'pill jumps to new output');
  pass('bottom indicator click jumps and leaves the draft intact', text().includes('kept click draft'));
  second.append(2); await until(() => streamRows().includes('STREAM_097'), 'pill restores follow');
  pass('indicator click restores sticky while disabled'); second.finish(); await until(ready, 'second turn completes');
  fs.writeFileSync(project, JSON.stringify({ autoScrollEnabled: false })); await toggle(true, false);
  pass('project setting keeps precedence after the user write', JSON.parse(fs.readFileSync(userFile, 'utf8')).autoScrollEnabled === true);
  fs.writeFileSync(project, '{}'); send('/reload\r');
  await until(() => ready() && journals().length === original + 1, 'reload owner');
  await toggle(false); await stop();
  pass('session locks release', fs.readdirSync(path.join(workspace, '.agent')).every(file => !file.endsWith('.lock')));
  await launch(); const third = await start(); send('\x1b[5~'); await delay(100); const restartRows = streamRows();
  third.append(12); await delay(180);
  pass('restart restores the disabled setting', JSON.stringify(streamRows()) === JSON.stringify(restartRows));
  third.finish(); await until(ready, 'restart turn completes'); await stop();
  pass('all requests stay on the owned loopback model', requests.length === 3 && requests.every(request => request.model === 'fixture'));
  const identity = captureIdentity(root);
  if (process.env.W295_RESULT) fs.writeFileSync(process.env.W295_RESULT, JSON.stringify({ checks, requests: requests.length,
    paidUpstreamCalls: 0, identity }, null, 2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  for (const owner of children) {
    if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]);
      if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); }
    owner.screen.close();
  }
  for (const stream of streams) stream.response.destroy();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
