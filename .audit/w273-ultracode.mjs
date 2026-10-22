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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w273-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
// Dynamic workflows on, so the ultracode row exists; `keep` proves unrelated bytes survive.
fs.writeFileSync(settingsFile, JSON.stringify({ keep: 'preserved', prefersReducedMotion: true,
  features: { workflow: true } }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const requests = [], checks = [], captures = {};
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
const flat = () => screen().replace(/\s+/g, '');
const track = () => screen().split('\n').find(row => /^─*▲─*$/u.test(row.trim()) && row.trim().length === 42)?.trim();
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
try {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive'],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(() => screen().includes('· ready'), 'startup ready', 25000);
  pass('the compiled CLI starts ready with dynamic workflows on');

  send('/effort\r');
  await until(() => /^Effort$/m.test(screen()) && track() !== undefined, 'slider open');
  pass('the slider draws the source track');
  pass('the ultracode row starts off', flat().includes('Ultracodeoff'));
  pass('the guide names the tab toggle', flat().includes('tabtogglesultracode'));
  captures.off = screen();

  send('\t');
  await until(() => flat().includes('Ultracodeon'), 'ultracode on');
  pass('tab turns the row on without closing the dialog');
  pass('the on row carries the recovered description',
    flat().includes('Ultracode:dynamicworkflowson everytask'.replace(/\s+/g, '')));
  captures.on = screen();

  send('\r');
  await until(() => track() === undefined && flat().includes('Ultracodeon'), 'accepted');
  pass('Enter keeps the level and reports the ultracode change',
    flat().includes('Seteffortleveltohigh') && flat().includes('Ultracodeon(thissessiononly)'));
  pass('ultracode never reaches the settings file', !('ultracode' in stored()));

  // The argument path shares the same arm and reports the effort that stays in force.
  send('/effort ultracode off\r');
  await until(() => flat().includes('Ultracodeoff.Effortstayshigh.'), 'argument off');
  pass('/effort ultracode off reports the effort that stays');
  await until(() => screen().includes('· ready'), 'settled');
  send('/effort ultracode\r');
  await until(() => flat().includes('Ultracodeon(thissessiononly)'), 'argument on');
  pass('/effort ultracode turns it back on');
  await until(() => screen().includes('· ready'), 'settled');

  send('/effort help\r');
  await until(() => flat().includes('Ultracode(anyeffortlevel'), 'usage');
  pass('the usage text grows the ultracode paragraph');
  await until(() => screen().includes('· ready'), 'settled');

  send('/quit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/quit exits the session');

  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    ok: checks.length }, null, 2));
  console.log(`\n${checks.length} checks at identity ${identity.sha256.slice(0, 8)}…`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.close();
}
