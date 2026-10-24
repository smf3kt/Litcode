import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'btw-progress-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-btw', thinking: false,
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const baseline = process.argv.includes('--baseline'), screen = new TerminalScreen(120, 40);
const requests = [], errors = [], held = new Map(), progressFrames = new Set();
let child, exited, server, holdClosed = false;
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready') && !frame().split('\n').includes('Btw');
async function until(check, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (!check()) {
    assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}: CLI exited`);
    await delay(30);
  }
}
function respond(res, body, text) {
  const events = [
    { type: 'message_start', message: { id: `btw-${requests.length}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 80, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
try {
  server = http.createServer((req, res) => {
    void (async () => {
      let text = ''; for await (const chunk of req) text += chunk;
      const body = JSON.parse(text), side = body.tool_choice?.type === 'none';
      const content = body.messages.at(-1)?.content;
      const question = typeof content === 'string' ? content : content?.at(-1)?.text;
      const attempt = Number(req.headers['x-stainless-retry-count'] ?? 0);
      requests.push({ side, question, attempt, body });
      if (side) assert.deepEqual(body.tools, []);
      if (question === 'HOLD_SIDE') {
        held.set(question, { res, body }); res.once('close', () => { holdClosed = true; }); return;
      }
      if (question === 'RETRY_SIDE' && attempt === 0) {
        res.writeHead(429, { 'content-type': 'application/json', 'retry-after-ms': '2200' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'owned fixture retry' } })); return;
      }
      if (question === 'FAIL_SIDE') {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'OWNED_SIDE_ERROR' } })); return;
      }
      respond(res, body, side ? 'OWNED_SIDE_ANSWER' : 'OWNED_MAIN_RECOVERED');
    })().catch(error => { errors.push(error.message); res.destroy(); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-btw', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => { screen.write(text); const lines = frame().split('\n').filter(line => /Answering|limited|attempt|retrying/.test(line));
    if (lines.length) progressFrames.add(lines.join('\n')); });
  child.stderr.on('data', text => screen.write(text));
  await until(ready, 'startup', 20000);
  send('/btw HOLD_SIDE\r'); await until(() => held.has('HOLD_SIDE'), 'held request');
  if (baseline) {
    await delay(180);
    assert.doesNotMatch(frame(), /Answering/); assert.ok(!frame().split('\n').includes('Btw'));
    const pending = held.get('HOLD_SIDE'); respond(pending.res, pending.body, 'OWNED_SIDE_ANSWER');
    await until(() => frame().includes('OWNED_SIDE_ANSWER'), 'baseline final answer');
    send('\x1b'); await until(ready, 'baseline close');
  } else {
    await until(() => frame().split('\n').includes('Btw') && frame().includes('Answering'), 'pending panel');
    send('\x1b'); await until(() => ready() && holdClosed, 'close cancels owned side request');
    send('/btw RETRY_SIDE\r');
    await until(() => frame().includes('Rate limited') && frame().includes('attempt 1/2'), 'retry progress');
    assert.match(frame(), /retrying in [123]s/);
    await until(() => frame().includes('OWNED_SIDE_ANSWER'), 'retried answer');
    send('c'); await delay(80); send('\x1b'); await until(ready, 'close retried answer');
    send('/btw FAIL_SIDE\r'); await until(() => frame().includes('OWNED_SIDE_ERROR'), 'side error panel');
    send('\x1b'); await until(ready, 'close side error');
    send('MAIN_AFTER_SIDE\r'); await until(() => ready() && frame().includes('OWNED_MAIN_RECOVERED'), 'main recovered');
    const retry = requests.filter(row => row.question === 'RETRY_SIDE');
    assert.deepEqual(retry.map(row => row.attempt), [0, 1]);
    assert.deepEqual(retry[0].body, retry[1].body);
    assert.doesNotMatch(JSON.stringify(retry[0].body.messages), /HOLD_SIDE/);
    const main = requests.find(row => row.question === 'MAIN_AFTER_SIDE'); assert.ok(main);
    assert.doesNotMatch(JSON.stringify(main.body.messages), /HOLD_SIDE|RETRY_SIDE|FAIL_SIDE|OWNED_SIDE_ANSWER|OWNED_SIDE_ERROR/);
  }
  send('/exit\r'); const code = await Promise.race([exited, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `exit ${code}\n${frame()}`); assert.deepEqual(errors, []);
  const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, 1);
  const journal = fs.readFileSync(path.join(workspace, '.agent', journals[0]), 'utf8');
  assert.doesNotMatch(journal, /HOLD_SIDE|RETRY_SIDE|FAIL_SIDE|OWNED_SIDE_ANSWER|OWNED_SIDE_ERROR/);
  assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.lock')), []);
  console.log(JSON.stringify({ cli: 'passed', baseline, modelRequests: requests.length, pendingPanel: !baseline,
    retryCountdown: !baseline, cancelledHeld: !baseline && holdClosed, sideJournalAbsent: true, locksReleased: true, fixture: temporary }));
} finally {
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  fs.writeFileSync(path.join(temporary, 'progress.json'), JSON.stringify({ progressFrames: [...progressFrames],
    requests: requests.map(({ side, question, attempt }) => ({ side, question, attempt })) }, null, 2));
  console.log(JSON.stringify({ diagnostics: path.join(temporary, 'progress.json') }));
  if (child?.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    await exited;
  }
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve)); screen.close();
}
