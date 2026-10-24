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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'btw-fork-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
const agentTypes = !process.argv.includes('--legacy');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture-btw', thinking: false,
  features: { agentTypes }, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled' }));
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const question = 'Write the reviewed answer into branch.txt';
const sideAnswer = 'SIDE_ANSWER_TO_FORK';
const requests = [], screen = new TerminalScreen(120, 40);
const baseline = process.argv.includes('--baseline');
let child, exited, server;
const frame = () => screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => child.stdin.write(value);
const ready = () => frame().includes('· ready') && !frame().split('\n').includes('Btw')
  && !frame().split('\n').includes('Background') && !frame().includes('Viewing agent');
async function until(check, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (!check()) {
    assert.ok(Date.now() < end, `${label}\n${frame()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}: CLI exited`);
    await delay(30);
  }
}
function respond(res, body, block, index) {
  const events = [
    { type: 'message_start', message: { id: `btw-${index}`, type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 80, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: block.type === 'text'
      ? { type: 'text', text: '' } : { ...block, input: {} } },
    { type: 'content_block_delta', index: 0, delta: block.type === 'text' ? { type: 'text_delta', text: block.text }
      : { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: block.type === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null },
      usage: { output_tokens: 20 } },
    { type: 'message_stop' },
  ];
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
}
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on('data', chunk => chunks.push(chunk)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length, text = JSON.stringify(body.messages), latest = body.messages.at(-1)?.content;
      if (body.tool_choice?.type === 'none') {
        assert.deepEqual(body.tools, []);
        respond(res, body, { type: 'text', text: sideAnswer }, index);
      } else if (text.includes(sideAnswer)) {
        if (typeof latest === 'string' && latest === 'BTWFORK_FOLLOWUP')
          respond(res, body, { type: 'text', text: 'BTWFORK_FOLLOWUP_COMPLETE' }, index);
        else if (Array.isArray(latest) && latest.some(block => block.type === 'tool_result'))
          respond(res, body, { type: 'text', text: 'BTWFORK_CHILD_COMPLETE' }, index);
        else respond(res, body, { type: 'tool_use', id: `write-${index}`, name: 'write_file',
          input: { path: 'branch.txt', content: sideAnswer } }, index);
      } else respond(res, body, { type: 'text', text: 'BTWFORK_MAIN_CONTEXT' }, index);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const env = { ...process.env, TERM: 'xterm-256color' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture-btw', LLM_AUTH: 'bearer',
    LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => screen.write(text));
  await until(ready, 'startup', 20000);
  send('Seed parent context\r');
  await until(() => ready() && frame().includes('BTWFORK_MAIN_CONTEXT'), 'parent seed');
  send(`/btw ${question}\r`);
  await until(() => frame().split('\n').includes('Btw') && frame().includes(sideAnswer), 'side answer panel');
  const before = requests.length;
  send('f');
  if (baseline) {
    await delay(200);
    assert.equal(requests.length, before);
    assert.ok(frame().split('\n').includes('Btw'));
    assert.equal(fs.existsSync(path.join(workspace, 'branch.txt')), false);
    send('\x1b'); await until(ready, 'baseline close');
  } else {
    await until(() => fs.existsSync(path.join(workspace, 'branch.txt')) && ready(), 'fork writes and returns to main');
    assert.equal(fs.readFileSync(path.join(workspace, 'branch.txt'), 'utf8'), sideAnswer);
    await until(() => !frame().includes('1 local agent'), 'fork completes');
    send('/tasks\r'); await until(() => frame().includes('Completed (1)'), 'fork retained in task list');
    send('\r'); await until(() => frame().includes('Viewing agent') && frame().includes('BTWFORK_CHILD_COMPLETE'), 'fork transcript');
    assert.match(frame(), /SIDE_ANSWER_TO_FORK/);
    send('BTWFORK_FOLLOWUP\r');
    await until(() => frame().includes('BTWFORK_FOLLOWUP_COMPLETE'), 'same child follow-up');
    send('\x1b'); await until(ready, 'return to parent');
    const forkRequest = requests.find(body => body.tools?.length && JSON.stringify(body.messages).includes(sideAnswer));
    assert.ok(forkRequest);
    assert.match(JSON.stringify(forkRequest.messages), /BTWFORK_MAIN_CONTEXT/);
    assert.equal(forkRequest.model, 'fixture-btw');
  }
  send('/exit\r');
  const code = await Promise.race([exited, delay(6000).then(() => 'timeout')]);
  assert.equal(code, 0, `exit ${code}\n${frame()}`);
  const records = fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).map(name =>
    ({ name, rows: fs.readFileSync(path.join(workspace, '.agent', name), 'utf8').trim().split('\n').map(line => JSON.parse(line)) }));
  const parent = records.find(item => !item.rows.some(row => row.kind === 'turn_end' && row.reason === 'fork_seed'));
  assert.ok(parent);
  const parentMessages = parent.rows.filter(row => row.kind === 'message');
  assert.doesNotMatch(JSON.stringify(parentMessages), /SIDE_ANSWER_TO_FORK/);
  const directParent = parentMessages.filter(row => row.classifier?.origin.kind !== 'generated');
  assert.doesNotMatch(JSON.stringify(directParent), /BTWFORK_CHILD_COMPLETE|BTWFORK_FOLLOWUP/);
  if (!baseline) assert.ok(parentMessages.some(row => row.classifier?.origin.kind === 'generated'
    && JSON.stringify(row.message).includes('Child agent events')));
  if (!baseline) {
    const branch = records.find(item => item.rows.some(row => row.kind === 'turn_end' && row.reason === 'fork_seed'));
    assert.ok(branch); assert.match(JSON.stringify(branch.rows), /SIDE_ANSWER_TO_FORK/);
    assert.equal(records.length, 2);
  }
  assert.deepEqual(fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.lock')), []);
  console.log(JSON.stringify({ cli: 'passed', baseline, agentTypes, modelRequests: requests.length, fork: !baseline,
    gateway: 'owned loopback SSE', locksReleased: true, fixture: temporary }));
} finally {
  fs.writeFileSync(path.join(temporary, 'screen.txt'), frame());
  if (child?.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    await exited;
  }
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  screen.close();
}
