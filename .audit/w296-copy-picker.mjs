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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w296-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
const userFile = path.join(user, 'settings.json'), project = path.join(workspace, '.harness/settings.json');
fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 7, prefersReducedMotion: true, showTurnDuration: false }));
const response = '<cc-memory>heading</cc-memory>\n\n| A | B |\n|:-|--:|\n| 中 | **x** |\n\n> quote\n> next\n\n```ts\nconst n = 1;\n```\n';
const normalized = 'heading\n\n| A   | B     |\n| :-- | ----: |\n| 中  | **x** |\n\n> quote\n> next\n\n```ts\nconst n = 1;\n```\n';
const children = [], requests = [], checks = [];
const server = http.createServer((request, reply) => {
  const chunks = []; request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    reply.writeHead(200, { 'content-type': 'text/event-stream' });
    const event = (name, data) => reply.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    event('message_start', { type: 'message_start', message: { id: `message_${requests.length}`, type: 'message', role: 'assistant', model: 'fixture',
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4, output_tokens: 0 } } });
    event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: response } });
    event('content_block_stop', { type: 'content_block_stop', index: 0 });
    event('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 12 } });
    event('message_stop', { type: 'message_stop' }); reply.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3', TMPDIR: temporary,
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'NO_COLOR', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION'].includes(key)) delete env[key];
let active;
const lines = () => active.screen.lines();
const text = () => lines().join('\n');
const picker = () => text().includes('Select content to copy:');
const ready = () => text().includes('· ready') && !picker() && !/^Config$/m.test(text());
const send = value => active.child.stdin.write(value);
const copies = () => [...active.raw.matchAll(/\x1b\]52;c;([A-Za-z0-9+/=]*)(?:\x07|\x1b\\)/g)].map(match => Buffer.from(match[1], 'base64').toString('utf8'));
const stored = () => JSON.parse(fs.readFileSync(userFile, 'utf8'));
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'));
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; if (active?.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\n${text()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w296-copy-picker.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
    '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(100, 30), decoder = new StringDecoder('utf8');
  active = { child, screen, raw: '', closed: new Promise(resolve => child.once('close', resolve)) }; children.push(active);
  const owner = active;
  const output = chunk => { const decoded = decoder.write(chunk); owner.raw += decoded; screen.write(decoded); };
  child.stdout.on('data', output); child.stderr.on('data', output);
  await until(ready, 'startup ready', 30000);
}
async function turn() { const count = requests.length; send('fixture response\r'); await until(() => requests.length === count + 1 && ready(), 'owned model response'); }
async function open() { send('/copy\r'); await until(picker, 'copy picker opens'); }
async function copied(index, expected) { await until(() => copies().length === index && ready(), 'copy finishes'); assert.equal(copies().at(-1), expected); }
async function stop() { send('\x15/exit\r'); pass('CLI exits zero', await Promise.race([active.closed, delay(6000).then(() => 'timeout')]) === 0); active.screen.close(); }
async function toggle(value) {
  send('/config\r'); await until(() => /^Config$/m.test(text()), 'Config opens'); send('Skip the /copy picker');
  await until(() => lines().some(line => /Skip the \/copy picker\s+(true|false)/.test(line)), 'copy preference row');
  send('\r '); await until(() => stored().copyFullResponse === value && !text().includes('Saving settings'), 'Config preference saved');
  pass(`Config displays and persists ${value}`, lines().some(line => new RegExp(`Skip the /copy picker\\s+${value}`).test(line)));
  send('\x1b'); await delay(100); await until(ready, 'Config closes');
}
try {
  await launch(); await turn(); const count = journals().length;
  await open(); pass('full, quote, code and always rows render with source metadata', /Full response\s+96 chars · 13 lines/.test(text()) && /quote, 2 lines/.test(text()));
  send('\x1b[A\r'); await copied(1, normalized); pass('top-clamped full choice preserves inline table Markdown');
  await open(); send('\x1b[Bw'); await until(() => ready() && text().includes('Written to '), 'write-only completes');
  const written = lines().findLast(line => /Written to .*copy\.md/.test(line))?.match(/Written to (.*copy\.md)/)?.[1];
  pass('w writes the quote without a clipboard request', written !== undefined && fs.readFileSync(written, 'utf8') === 'quote\nnext' && copies().length === 1);
  await open(); send('\x1b[B\x1b[B\r'); await copied(2, 'const n = 1;'); pass('Enter copies the selected code body');
  await open(); await delay(320); const row = lines().findIndex(line => /quote, 2 lines/.test(line)); assert.ok(row >= 0);
  send(`\x1b[<0;4;${row + 1}M\x1b[<0;4;${row + 1}m`); await copied(3, 'quote\nnext'); pass('mouse accepts the painted quote row');
  for (const [name, keys] of [['Escape', '\x1b'], ['Ctrl-C', '\x03\x03'], ['Ctrl-D', '\x04\x04']]) {
    await open(); send(keys); await delay(90); await until(ready, `${name} cancels`); pass(`${name} cancels without copying`, copies().length === 3);
  }
  await open(); send('\x03'); await until(() => text().includes('Press Ctrl-C again to cancel'), 'pending cancellation guide');
  await delay(850); pass('cancel timer expires without closing the picker', picker() && text().includes('w write to file'));
  send('\x1b'); await delay(90); await until(ready, 'expired timer escape');
  await open(); send('\x1b[F\x1b[B\r'); await copied(4, normalized);
  pass('Always persists before copying and reports its reset path', stored().copyFullResponse === true && text().includes('Preference saved. Use /config to change copyFullResponse'));
  send('/copy\r'); await copied(5, normalized); pass('next copy bypasses the picker');
  await toggle(false); await open(); send('\x1b'); await delay(90); await until(ready, 'picker restored'); pass('Config restores the picker in the same session', journals().length === count);
  pass('settings writes preserve unrelated authored data', stored().keep === 7);
  fs.writeFileSync(project, JSON.stringify({ copyFullResponse: false })); await toggle(true); await stop();
  await launch(); await turn(); send('/copy\r'); await copied(1, normalized);
  pass('restart uses the user preference ahead of project copyFullResponse');
  await toggle(false); await open(); send('\x1b'); await delay(90); await until(ready, 'restart reset');
  const authored = stored(); delete authored.copyFullResponse; fs.writeFileSync(userFile, JSON.stringify(authored));
  const beforeReload = journals().length; send('/reload\r'); await until(() => ready() && journals().length === beforeReload + 1, 'reload successor');
  await turn(); await open(); send('\x1b'); await delay(90); await until(ready, 'reload default'); pass('reload deletion restores the default picker');
  await stop(); pass('all session locks release', fs.readdirSync(path.join(workspace, '.agent')).every(file => !file.endsWith('.lock')));
  pass('requests use only the owned loopback provider', requests.length === 3 && requests.every(request => request.model === 'fixture'));
  const identity = captureIdentity(root);
  if (process.env.W296_RESULT) fs.writeFileSync(process.env.W296_RESULT, JSON.stringify({ checks, requests: requests.length, paidUpstreamCalls: 0, identity }, null, 2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  for (const owner of children) {
    if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]); if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); }
    owner.screen.close();
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true });
}
