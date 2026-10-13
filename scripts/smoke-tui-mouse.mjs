import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dialogs = process.argv.includes('--dialogs');
const temporary = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? `${process.env.CLAUDE_JOB_DIR}/tmp` : root, '.tui-mouse-'));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const questions = { questions: [{ question: 'Choose output', header: 'Fixture choice', multiSelect: false,
  options: [{ label: 'A', description: 'First' }, { label: 'B', description: 'Second' }] }] };
const requests = [];
const dialogCalls = [
  { type: 'tool_use', id: 'question', name: 'ask_user_question', input: questions },
  { type: 'tool_use', id: 'plan', name: 'submit_plan', input: { plan: 'Fixture plan body\nCreate the approved fixture file.' } },
  { type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'approved.txt', content: 'approved B\n' } },
  { type: 'tool_use', id: 'cancel-write', name: 'write_file', input: { path: 'cancelled.txt', content: 'must stay absent\n' } },
];
const server = http.createServer(async (req, res) => {
  try {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); requests.push(body);
    const tool = dialogs ? dialogCalls[requests.length - 1] : undefined;
    const answer = dialogs ? 'dialogs accepted' : requests.length === 1
      ? Array.from({ length: 20 }, (_, i) => `mouse-line-${i}`).join('\n') : 'draft accepted';
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('message_start', { type: 'message_start', message: { id: 'mouse-fixture', type: 'message',
      role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 } } });
    emit('content_block_start', { type: 'content_block_start', index: 0,
      content_block: tool ? { ...tool, input: {} } : { type: 'text', text: '' } });
    emit('content_block_delta', { type: 'content_block_delta', index: 0,
      delta: tool ? { type: 'input_json_delta', partial_json: JSON.stringify(tool.input) } : { type: 'text_delta', text: answer } });
    emit('content_block_stop', { type: 'content_block_stop', index: 0 });
    emit('message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
    emit('message_stop', { type: 'message_stop' }); res.end();
  } catch (error) { res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const pidFile = path.join(temporary, 'cli.pid');
const command = `printf '%s' "$$" > ${quote(pidFile)}; stty rows 10 cols 40; exec ${quote(process.execPath)} ${quote(path.join(root, 'bin/litcode.mjs'))} --workspace ${quote(workspace)} --user-dir ${quote(user)}${dialogs ? ' --permission-mode ask' : ''}`;
// A shell pipe gives macOS script a pipe rather than Node's stdin socket.
const child = spawn('/bin/sh', ['-c', `cat | script -q /dev/null /bin/sh -c ${quote(command)}`], {
  cwd: root, detached: true,
  env: { ...process.env, TERM: 'xterm-256color', LLM_INHERIT_GATEWAY: 'false', LLM_API_KEY: 'owned-mouse-fixture',
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_MODEL: 'fixture/mouse',
    LLM_AUTH: 'bearer', LLM_THINKING: 'false', LLM_TOKEN_COUNTING: 'estimate',
    LLM_PROMPT_CACHE: 'false', LLM_EAGER_TOOL_INPUT: 'false' },
});
let output = '', errors = '';
child.stdout.on('data', bytes => output += bytes);
child.stderr.on('data', bytes => errors += bytes);
const exited = new Promise((resolve, reject) => {
  child.once('error', reject); child.once('close', code => resolve(code));
});
function killFixture() {
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    if (Number.isSafeInteger(pid) && pid > 0) {
      try { process.kill(pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  }
  try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
const timer = setTimeout(killFixture, 20000);
async function until(predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (child.exitCode !== null) throw new Error(`CLI exited early: ${errors}`);
    if (Date.now() >= deadline) throw new Error(`CLI condition timed out: ${errors}\nLast frame: ${JSON.stringify(output.slice(-2400))}`);
    await delay(10);
  }
}
const topLine = () => output.slice(output.lastIndexOf('\x1b[H') + 3).split('\x1b[K')[0].trim();
try {
  await until(() => output.includes('\x1b[?1049h') && output.includes('ctrl+o'));
  child.stdin.write('first task\r');
  if (dialogs) {
    await until(() => topLine() === 'Fixture choice');
    child.stdin.write('\x1b[B\r');
    await until(() => topLine() === 'Approve this plan');
    child.stdin.write('\x1b[B\r');
    await until(() => topLine() === 'Allow once');
    child.stdin.write('\x1b[B\r');
    await until(() => requests.length === 4 && output.slice(output.lastIndexOf('\x1b[H')).includes('cancelled.txt'));
    child.stdin.write('\u0003');
    await until(() => output.includes('dialogs accepted'));
    child.stdin.write('/exit\r'); child.stdin.end();
    assert.equal(await exited, 0, errors);
    assert.equal(requests.length, 5);
    const results = requests.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
      .filter(block => block.type === 'tool_result');
    const content = id => {
      const block = results.find(result => result.tool_use_id === id);
      assert.ok(block, id);
      return typeof block.content === 'string' ? block.content : block.content.map(item => item.text ?? '').join('');
    };
    assert.deepEqual(JSON.parse(content('question')), { answers: [{ questionIndex: 0, selected: ['B'] }] });
    assert.deepEqual(JSON.parse(content('plan')), { approved: true });
    assert.equal(fs.readFileSync(path.join(workspace, 'approved.txt'), 'utf8'), 'approved B\n');
    assert.equal(fs.existsSync(path.join(workspace, 'cancelled.txt')), false);
    assert.ok(results.find(result => result.tool_use_id === 'cancel-write').is_error);
  } else {
  await until(() => output.includes('ready  finished:') && topLine() === 'mouse-line-14');
  child.stdin.write('draft\x1b[<64;2;');
  await delay(30); child.stdin.write('3M');
  await until(() => topLine() === 'mouse-line-13');
  child.stdin.write('\x1b[M' + String.fromCharCode(97, 34, 35));
  await until(() => topLine() === 'mouse-line-14');
  child.stdin.write('\u000f');
  await until(() => output.slice(output.lastIndexOf('\x1b[H')).includes('ctrl+o chat'));
  child.stdin.write('k'); await until(() => topLine() === 'mouse-line-13');
  child.stdin.write('j'); await until(() => topLine() === 'mouse-line-14');
  child.stdin.write('\u0005q');
  await until(() => output.slice(output.lastIndexOf('\x1b[H')).includes('ctrl+o transcript'));
  assert.ok(output.includes('\x1b[?1002h'));
  child.stdin.write('\x1b[<0;1;1M\x1b[<32;5;1M\x1b[<0;5;9m');
  await until(() => output.includes('\x1b[7mmouse\x1b[27m'));
  child.stdin.write('\x1b[1;2C\x1b[99;6u');
  await until(() => output.includes(`\x1b]52;c;${Buffer.from('mouse-').toString('base64')}`));
  child.stdin.write('\x1b[1;2C\x1bc');
  await until(() => output.includes(`\x1b]52;c;${Buffer.from('mo').toString('base64')}`));
  child.stdin.write('\x1b[<0;2;3M\x1b[<0;2;3m\r');
  await until(() => output.includes('draft accepted'));
  child.stdin.write('/exit\r'); child.stdin.end();
  assert.equal(await exited, 0, errors);
  assert.equal(requests.length, 2);
  const message = requests[1].messages.filter(item => item.role === 'user').at(-1);
  assert.ok(JSON.stringify(message).includes('draft'));
  assert.equal(JSON.stringify(message).includes('[<'), false);
  assert.equal(JSON.stringify(message).includes('[M'), false);
  }
  assert.ok(output.includes('\x1b[?1049h') && output.includes('\x1b[?1049l'));
  assert.ok(output.includes('\x1b[?1006l'));
  const files = fs.readdirSync(path.join(workspace, '.agent'));
  assert.equal(files.some(file => file.endsWith('.lock')), false);
  const journal = files.find(file => file.endsWith('.jsonl'));
  assert.ok(journal);
  assert.equal(fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8').includes('owned-mouse-fixture'), false);
  console.log(JSON.stringify({ ...(dialogs ? { tuiDialogs: 'passed', question: true, plan: true,
    permissionApproved: true, permissionCancelled: true, fileEffectsVerified: true } : {
    tuiMouse: 'passed', transcriptKeys: true, splitSgrWheel: true, x10Wheel: true,
    pointerSelection: true, keyboardExtension: true, osc52PayloadVerified: true, draftUnchanged: true }),
    compiled: true, defaultTui: true, modesRestored: true, locksReleased: true,
    modelCalls: requests.length, provider: 'owned loopback SSE', paidUpstreamCalls: 0 }));
} finally {
  clearTimeout(timer); if (child.exitCode === null) { killFixture(); await exited; }
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
