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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w294-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
fs.mkdirSync(path.join(workspace, '.harness'));
const userFile = path.join(user, 'settings.json'), projectFile = path.join(workspace, '.harness/settings.json');
fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 1, prefersReducedMotion: true }));
fs.writeFileSync(projectFile, JSON.stringify({ copyOnSelect: false }));
const checks = [], requests = [], held = [], children = [];
const bodyText = 'Selection alpha beta gamma 中👩‍💻';
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(body);
    if (JSON.stringify(body.messages.at(-1)).includes('HOLD')) {
      response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders();
      const pending = { response, closed: false }; held.push(pending);
      response.on('close', () => { pending.closed = true; }); return;
    }
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant',
      model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4, output_tokens: 0 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: bodyText } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } });
    send('message_stop', { type: 'message_stop' }); response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3',
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM', 'NO_COLOR'].includes(key)) delete env[key];
let active;
const text = () => active.screen.lines().map(line => line.trimEnd()).join('\n');
const ready = () => text().includes('· ready') && !/^Config$/m.test(text()) && !text().includes('j/k scroll');
const send = value => active.child.stdin.write(value);
const copies = () => [...active.raw.matchAll(/\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/g)]
  .map(match => Buffer.from(match[1], 'base64').toString('utf8'));
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
async function until(predicate, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(25);
  }
  throw new Error(`${label}\n${text()}`);
}
function pass(label, value = true) { assert.ok(value, `${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w294-copy-on-select.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
    '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(100, 30), decoder = new StringDecoder('utf8');
  active = { child, screen, raw: '', closed: new Promise(resolve => child.once('close', resolve)) };
  children.push(active);
  const owner = active;
  const output = chunk => { const value = decoder.write(chunk); owner.raw += value; screen.write(value); };
  child.stdout.on('data', output); child.stderr.on('data', output);
  await until(ready, 'startup ready', 30000);
}
async function prime() { send('prime selection\r'); await until(() => ready() && text().includes(bodyText), 'owned response'); }
async function select(first, last, finish = true) {
  const lines = active.screen.lines(), row = lines.findLastIndex(line => line.includes(bodyText));
  assert.ok(row >= 0, text());
  const column = lines[row].indexOf(bodyText);
  send(`\x1b[<0;${column + first + 1};${row + 1}M`); await delay(30);
  send(`\x1b[<32;${column + last + 1};${row + 1}M`); await delay(30);
  if (finish) { send(`\x1b[<0;${column + last + 1};${row + 1}m`); await delay(80); }
  return { row, column: column + first, end: column + last };
}
async function toggle(enabled) {
  send('\x15/config\r'); await until(() => /^Config$/m.test(text()), 'Config opens');
  send('copy on select'); await until(() => text().includes('Copy on select'), 'Copy on select row');
  send('\r'); await delay(30); send(' ');
  await until(() => JSON.parse(fs.readFileSync(userFile, 'utf8')).copyOnSelect === enabled
    && !text().includes('Saving settings'), 'preference persisted');
  pass(`Config persists Copy on select ${enabled}`);
  send('\x1b'); await until(ready, 'Config closes');
}
async function exit() {
  send('\x15/exit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  pass('compiled CLI exits zero', code === 0); active.screen.close();
}
try {
  await launch(); await prime(); const original = journals().length;
  send('kept draft'); await delay(50);
  const first = await select(10, 14, false);
  pass('drag stays out of the clipboard', copies().length === 0);
  send(`\x1b[<0;${first.end + 1};${first.row + 1}m`);
  await until(() => copies().length === 1, 'release copies');
  pass('default user preference ignores the project flag and copies exact text', copies()[0] === 'alpha');
  pass('auto-copy retains the painted selection', Boolean(active.screen.cell(first.column, first.row).isInverse()));
  send('\x03'); await delay(100);
  pass('Ctrl+C clears highlight without a duplicate write', copies().length === 1 && !active.screen.cell(first.column, first.row).isInverse());
  pass('copying retains the composer draft', text().includes('kept draft'));
  send('\x15'); await toggle(false);
  pass('user write preserves unrelated data', JSON.parse(fs.readFileSync(userFile, 'utf8')).keep === 1);
  fs.writeFileSync(projectFile, JSON.stringify({ copyOnSelect: true }));
  send('disabled draft'); await delay(50); await select(16, 19);
  pass('disabled release leaves the clipboard alone and shows the chord', copies().length === 1 && text().includes('ctrl+c to copy'));
  send('\x03'); await until(() => copies().length === 2, 'manual copy');
  pass('disabled Ctrl+C copies the selected bytes', copies().at(-1) === 'beta');
  const stashed = copies().length; await select(10, 14); send('\x13'); await delay(70); send('\x1b[99;6u'); await delay(70);
  pass('stash clears the text selection before its action', copies().length === stashed);
  send('\x13'); await delay(60); pass('stash round trip retains the draft', text().includes('disabled draft'));
  await select(10, 14); send('\x0f'); await until(() => text().includes('j/k scroll'), 'transcript opens');
  send('\x1b[99;6u'); await delay(60);
  pass('transcript entry clears stale chat row coordinates', copies().length === stashed);
  await select(10, 14); send('\x03'); await until(() => copies().length === stashed + 1, 'transcript copies');
  pass('transcript Ctrl+C copies before exiting', copies().at(-1) === 'alpha' && text().includes('j/k scroll'));
  send('\x03'); await until(ready, 'transcript exits after teardown');
  send('\x0f'); await until(() => text().includes('j/k scroll'), 'transcript reopens');
  await select(10, 14); const escapeCopies = copies().length;
  send('\x1b'); await delay(120); await until(ready, 'Escape exits transcript');
  send('\x1b[99;6u'); await delay(80);
  pass('Escape clears transcript selection coordinates', copies().length === escapeCopies);
  await toggle(true); pass('live Config toggles retain the same session', journals().length === original);
  send('enabled draft'); await delay(50); const unicode = await select(27, 29);
  pass('Unicode selection preserves complete graphemes', copies().at(-1) === '中👩‍💻');
  pass('Unicode feedback counts graphemes', text().includes('sent 2 chars'));
  send('\x03'); await delay(60);
  send('\x15HOLD\r'); await until(() => held.length === 1, 'held request');
  await delay(70); const before = copies().length; await select(10, 14); send('\x03'); await delay(100);
  pass('selection Ctrl+C leaves the active request running', !held[0].closed && copies().length === before + 1);
  send('\x03'); await until(() => held[0].closed && ready(), 'second Ctrl+C interrupts');
  pass('Ctrl+C returns to the interrupt owner after selection teardown');
  await toggle(false);
  const settings = JSON.parse(fs.readFileSync(userFile, 'utf8')); settings.copyOnSelect = true;
  fs.writeFileSync(userFile, JSON.stringify(settings)); send('/reload\r');
  await until(() => ready() && journals().length === original + 1, 'reload session');
  await prime(); const reloaded = copies().length; await select(10, 14);
  pass('reload rebinds the user preference', copies().length === reloaded + 1);
  send('\x03'); await toggle(false); await exit();
  pass('all journal locks release after exit', fs.readdirSync(path.join(workspace, '.agent')).every(name => !name.endsWith('.lock')));
  await launch(); await prime(); await select(10, 14);
  pass('restart restores the disabled user preference', copies().length === 0 && text().includes('ctrl+c to copy'));
  send('\x03'); await until(() => copies().length === 1, 'restart explicit copy');
  pass('restart explicit copy remains functional', copies()[0] === 'alpha'); await exit();
  pass('all requests use the owned loopback model', requests.every(request => request.model === 'fixture'));
  const identity = captureIdentity(root);
  if (process.env.W294_RESULT) fs.writeFileSync(process.env.W294_RESULT, JSON.stringify({ checks, requests: requests.length,
    paidUpstreamCalls: 0, identity }, null, 2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  for (const owner of children) {
    if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]);
      if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); }
    owner.screen.close();
  }
  for (const entry of held) entry.response.destroy();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
