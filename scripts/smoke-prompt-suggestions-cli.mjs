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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'prompt-suggestions-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-prediction', thinking: false,
  ...(process.argv.includes('--baseline') ? {} : { features: { promptSuggestions: true } }),
  prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 35 columns 110"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const screen = new TerminalScreen(110, 35), requests = [];
let child, exited, server, holdNext = false, held;
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready');
const ghostShown = () => screen.lines().some(line => line.trim() === '❯ run the tests' || line.trim() === '❯ run the tests');
const until = async (check, label, timeout = 7000) => {
  const end = Date.now() + timeout;
  while (!check()) { assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, label); await delay(25); }
};
function respond(res, body, text, index) {
  const events = [
    { type: 'message_start', message: { id: `prediction-${index}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 800, output_tokens: 0 } } },
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
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)), index = requests.push(body);
      const last = JSON.stringify(body.messages.at(-1)?.content);
      const prediction = last.includes('[SUGGESTION MODE:');
      if (prediction) {
        assert.deepEqual(body.tools, []); assert.deepEqual(body.tool_choice, { type: 'none' });
        if (holdNext) { holdNext = false; held = () => respond(res, body, 'stale suggestion', index); return; }
        respond(res, body, '<suggestion>run the tests</suggestion>', index);
      } else respond(res, body, `MAIN_RESPONSE_${requests.filter(value => !JSON.stringify(value.messages.at(-1)?.content).includes('[SUGGESTION MODE:')).length}`, index);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_|HARNESS_PROMPT_SUGGESTIONS)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-prediction', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => screen.write(text));
  await until(ready, 'startup', 15000);
  send('first fixture turn\r'); await until(() => frame().includes('MAIN_RESPONSE_1') && ready(), 'first response');
  await delay(150); assert.equal(requests.length, 1, 'one assistant message does not predict');
  send('second fixture turn\r'); await until(() => frame().includes('MAIN_RESPONSE_2') && ready(), 'second response');
  if (process.argv.includes('--baseline')) {
    await delay(400); assert.equal(requests.length, 2); assert.doesNotMatch(frame(), /run the tests/);
    console.log(JSON.stringify({ baseline: 'prediction and composer proposal absent', requests: requests.length, temporary }));
  } else {
    await until(ghostShown, 'suggestion shown');
    const before = requests.length; send('\x1b[C'); await delay(100);
    assert.equal(requests.length, before, 'Right adopts without submitting');
    send(' now\r'); await until(() => frame().includes('MAIN_RESPONSE_3') && ready(), 'adopted draft submitted');
    assert.equal(requests.find(body => body.messages.at(-1)?.content === 'run the tests now')?.messages.at(-1).content, 'run the tests now');
    await until(ghostShown, 'next suggestion shown');
    send('\t'); await delay(100); holdNext = true; send('\r');
    await until(() => held !== undefined, 'prediction held after Tab adoption');
    send('human draft'); await delay(100); held(); await delay(150);
    assert.doesNotMatch(frame(), /stale suggestion/); assert.match(frame(), /human draft/);
    send('\x05\x15/config\r'); await until(() => frame().includes('Config'), 'config opened');
    send('Prompt suggestions'); await until(() => frame().includes('Prompt suggestions'), 'setting located');
    send('\x1b[B\r'); await until(() => JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'))).promptSuggestionEnabled === false, 'setting disabled');
    send('\x1b'); await until(() => !frame().includes('Config') && ready(), 'config closed');
    const count = requests.length; send('disabled fixture turn\r');
    await until(() => requests.length === count + 1 && ready(), 'disabled turn'); await delay(150);
    assert.equal(requests.length, count + 1, 'disabled prediction performs no request');
    const journals = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
    for (const name of journals) assert.doesNotMatch(fs.readFileSync(path.join(workspace, '.agent', name), 'utf8'), /\[SUGGESTION MODE:|stale suggestion/);
    console.log(JSON.stringify({ result: 'passed', requests: requests.length, temporary }));
  }
  send('\x05\x15/exit\r'); assert.equal(await Promise.race([exited, delay(6000).then(() => 'timeout')]), 0, frame());
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
} finally {
  if (child && child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} await exited; }
  server?.closeAllConnections(); await new Promise(resolve => server ? server.close(resolve) : resolve());
}
