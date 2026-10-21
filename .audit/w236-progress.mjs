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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w236-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', thinking: false, keep: 'authored' }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const requests = [], children = [], checks = [], captures = {};
let active, mainTurns = 0;

const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const streamed = (response, text) => sse(response, [
  ['message_start', { type: 'message_start', message: { id: `msg_${mainTurns}`, type: 'message', role: 'assistant',
    model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } }],
  ['message_stop', { type: 'message_stop' }],
]);
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    mainTurns++;
    requests.push(body);
    streamed(response, `finished ${mainTurns}`);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
  TERM_PROGRAM: 'iTerm.app', TERM_PROGRAM_VERSION: '3.6.6' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'TMUX', 'STY', 'WT_SESSION', 'ConEmuANSI', 'ConEmuPID', 'ConEmuTask'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(90, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const raw = () => Buffer.concat(active.chunks).toString('utf8');
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
async function launch(resume) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass'])], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 25000);
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, screen()); }
async function turn(prompt) {
  const before = requests.length; send(prompt + '\r');
  await until(() => requests.length === before + 1 && ready() && screen().includes(`finished ${mainTurns}`), 'turn finished');
}
const PROGRESS = '\x1b]9;4;';
async function openConfig() { send('/config\r'); await until(() => panel() && screen().includes('Terminal progress bar'), 'Config rows'); }
async function selectProgress() {
  send('progress\r'); await until(() => panel() && screen().includes('Enter/Space change'), 'progress row selected');
}
async function toggleProgress(value) {
  send('\r'); await until(() => stored().terminalProgressBarEnabled === value && !screen().includes('Saving settings'), `persist progress ${value}`);
}
async function closeConfig() {
  for (let index = 0; index < 3 && panel(); index++) { send('\x1b'); await delay(120); }
  await until(ready, 'Config closed');
}
try {
  await launch(); await openConfig(); captures.defaultRow = screen();
  pass('Config exposes Terminal progress bar and defaults true', /Terminal progress bar\s+true/.test(screen()));
  await closeConfig(); await turn('say hello with progress on'); captures.on = screen();
  const on = raw(), start = on.indexOf(PROGRESS + '3;');
  pass('an active agent turn writes the indeterminate OSC 9;4 without changing the screen',
    start >= 0 && screen().includes('finished 1'));
  pass('the idle turn clears the indicator', on.indexOf(PROGRESS + '0;', start) > start);
  await stop();
  await launch(); await openConfig(); await selectProgress(); await toggleProgress(false); await closeConfig();
  pass('turning the row off persists terminalProgressBarEnabled beside authored keys',
    stored().terminalProgressBarEnabled === false && stored().keep === 'authored');
  await turn('say hello with progress off');
  pass('the disabled switch writes no OSC 9;4 during the turn', !raw().includes(PROGRESS));
  await stop();
  await launch(); await openConfig(); await selectProgress(); await toggleProgress(true); await closeConfig();
  pass('enabling the live row while idle writes the source idle clear', raw().includes(PROGRESS + '0;'));
  await turn('say hello with progress re-enabled');
  pass('the re-enabled row writes the indicator on the next turn', raw().includes(PROGRESS + '3;'));
  await openConfig(); await selectProgress(); await toggleProgress(false); await closeConfig();
  await stop();
  await launch(); await openConfig(); captures.restart = screen();
  pass('a fresh CLI restores the saved false switch', /Terminal progress bar\s+false/.test(screen()));
  await closeConfig(); await turn('say hello after restart');
  pass('the restored false switch still writes no progress', !raw().includes(PROGRESS));
  await stop();
  fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', thinking: false, keep: 'authored' }));
  await launch(); await turn('say hello with the default');
  pass('an absent key resolves on and writes the indicator', raw().includes(PROGRESS + '3;'));
  await stop();
} finally {
  server.close();
  for (const current of children) if (current.child.exitCode === null) current.child.kill('SIGKILL');
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${captureIdentity().sha256}`);
}
