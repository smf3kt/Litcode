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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w264-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.mkdirSync(path.join(workspace, '.agent'));
const fixtureId = '11111111-1111-4111-8111-111111111111';
fs.writeFileSync(path.join(workspace, '.agent', `${fixtureId}.jsonl`), [
  JSON.stringify({ kind: 'metadata', version: 1, id: fixtureId, config: { model: 'fixture', workspace },
    fingerprint: 'fixture', startedAt: Date.UTC(2026, 9, 20, 10) }),
  JSON.stringify({ kind: 'message', message: { role: 'user', content: 'hi' } }),
  JSON.stringify({ kind: 'message', message: { role: 'assistant', content: [] },
    response: { model: 'fixture', usage: { input_tokens: 1000, output_tokens: 500,
      cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }),
  JSON.stringify({ kind: 'turn_end', reason: 'done', duration: { durationMs: 1,
    timestamp: '2026-10-20T10:30:00.000Z' } }),
].join('\n') + '\n');
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
const checks = [], captures = {};
let active;

const server = http.createServer((_request, response) => { response.writeHead(500); response.end(); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  HOME: temporary, LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(110, 40);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const ready = () => screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 20000) {
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
try {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'],
  { cwd: workspace, env, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'startup ready', 25000);
  pass('the compiled CLI starts ready');

  send('/usage\r');
  await until(() => screen().includes('Stats'), 'stats panel');
  captures.panel = screen();
  pass('/usage opens the Stats panel');
  pass('the range line starts at all time', screen().includes('Range: All time'));
  pass('the journal aggregate names its favorite model', screen().includes('Favorite model: fixture'));
  pass('the session count comes from the journals', screen().includes('Sessions: 1'));
  pass('the activity row reports the day span', screen().includes('Active days: 1/1'));
  pass('the modality totals use the recovered formatter', screen().includes('Input 1.0k · Output 500'));

  send('t');
  await until(() => screen().includes('Range: Last 7 days'), '7d range');
  pass('t cycles to the last 7 days');

  send('t');
  await until(() => screen().includes('Range: Last 30 days'), '30d range');
  pass('t cycles to the last 30 days');

  send('\x1b');
  await until(ready, 'panel closed');
  pass('Escape closes the panel and returns to the composer');

  send('/cost\r');
  await until(() => screen().includes('Stats'), 'cost panel');
  pass('/cost opens the same panel');
  send('\x1b');
  await until(ready, 'cost closed');

  send('/stats\r');
  await until(() => screen().includes('Stats'), 'stats alias panel');
  pass('/stats opens the same panel');
  send('\x1b');
  await until(ready, 'stats closed');

  send('/exit\r');
  const code = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, identity: identity.sha256,
    inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256 }, null, 2));
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${identity.sha256}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  if (active && active.child.exitCode === null && active.child.signalCode === null) {
    active.child.kill('SIGKILL'); await Promise.race([active.closed, delay(2000)]);
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
