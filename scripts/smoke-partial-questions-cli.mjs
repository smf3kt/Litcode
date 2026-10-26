import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const longAfk = process.argv.includes('--long-afk');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : root, 'partial-questions-cli-')));
const workspace = path.join(temporary, 'workspace'), userDir = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
const settingsFile = path.join(userDir, 'settings.json');
const pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 30 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const settings = value => fs.writeFileSync(settingsFile, JSON.stringify({ prefersReducedMotion: true,
  promptSuggestionEnabled: false, ...(value === undefined ? {} : { features: { questionPartialAnswers: value } }) }));
settings();
const questions = { questions: [
  { question: 'Choose the retained layout', header: 'Layout', multiSelect: false,
    options: [{ label: 'A', description: 'First', preview: 'Preview A' }, { label: 'B', description: 'Second', preview: 'Preview B' }] },
  { question: 'Choose the remaining tags', header: 'Tags', multiSelect: true,
    options: [{ label: 'X', description: 'First tag' }, { label: 'Y', description: 'Second tag' }] },
] };
const requests = [];
function send(response, block) {
  const tool = block.type === 'tool_use';
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'partial-question', type: 'message', role: 'assistant', model: 'fixture',
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: tool ? { ...block, input: {} } : { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: tool
      ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}
const server = http.createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    requests.push(body);
    const content = body.messages.at(-1)?.content;
    send(response, typeof content === 'string' && content.startsWith('ASK_')
      ? { type: 'tool_use', id: `ask-${requests.length}`, name: 'ask_user_question', input: questions }
      : { type: 'text', text: 'PARTIAL_QUESTIONS_DONE' });
  } catch (error) { response.writeHead(500); response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const clockFile = path.join(temporary, 'clock'), preload = path.join(temporary, 'clock.mjs');
fs.writeFileSync(clockFile, '0');
const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==';
fs.writeFileSync(preload, `import fs from 'node:fs';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
const originalSpawn=cp.spawn;
cp.spawn=function(command,args,options){
  if(command==='/usr/bin/osascript'&&args?.[0]==='-e'&&args[1]==='the clipboard as \\u00abclass PNGf\\u00bb')
    return originalSpawn(process.execPath,['-e',${JSON.stringify(`process.stdout.write(${JSON.stringify(`«data PNGf${Buffer.from(image, 'base64').toString('hex')}»\n`)})`)}],options);
  return originalSpawn(command,args,options);
};syncBuiltinESMExports();
${longAfk ? 'const OriginalDate=Date;const now=()=>OriginalDate.now()+Number(fs.readFileSync(process.env.PARTIAL_CLOCK,"utf8"));globalThis.Date=class extends OriginalDate{constructor(...args){super(...(args.length?args:[now()]));}static now(){return now();}};' : ''}
`);
const env = { ...process.env, HOME: temporary, TERM: 'xterm-256color', CLAUDE_AFK_TIMEOUT_MS: longAfk ? '600000' : '1000',
  CLAUDE_AFK_COUNTDOWN_MS: '1000', HARNESS_LOOP_KEEPALIVE: 'off' };
for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
if (longAfk) env.PARTIAL_CLOCK = clockFile;
Object.assign(env, { LLM_API_KEY: 'owned-partial-fixture', LLM_MODEL: 'fixture', LLM_AUTH: 'bearer',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
const children = [];
let active;
async function until(check, label) {
  const end = Date.now() + 10000;
  while (!check()) {
    assert.ok(Date.now() < end, `${label}\n${active?.frame()}\n${active?.errors}`);
    if (active?.closed) throw new Error(`${label}: CLI exited ${active.errors}`);
    await delay(20);
  }
}
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl')).map(name => {
  const file = path.join(workspace, '.agent', name), text = fs.readFileSync(file, 'utf8');
  const rows = text.slice(0, text.lastIndexOf('\n')).split('\n').filter(Boolean).map(JSON.parse);
  return { id: name.slice(0, -6), file, rows };
});
const held = () => journals().find(row => fs.existsSync(`${row.file}.lock`));
async function launch(id) {
  const screen = new TerminalScreen(120, 30);
  const child = spawn('/usr/bin/expect', [pty, process.execPath, '--import', preload, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--interactive', '--no-inherit-gateway', ...(id ? ['--resume', id] : ['--user-dir', userDir])],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, screen, errors: '', closed: false, frame: () => screen.lines().join('\n') };
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => { state.errors += text; });
  state.exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { state.closed = true; resolve(code); }); });
  children.push(state); active = state;
  await until(() => state.frame().includes('ready') && fs.existsSync(path.join(workspace, '.agent')) && held(), 'CLI ready');
  return state;
}
async function ask(state, name, answer, expected, afk = false) {
  const before = requests.length;
  state.child.stdin.write(`${name}\r`);
  await until(() => state.frame().includes('Choose the retained layout') && state.frame().includes('Question 1 of 2'), name);
  state.child.stdin.write('\x1b[I');
  if (answer === 'image') {
    state.child.stdin.write('\x1b[B\x1b[B\x16');
    const attachments = path.join(workspace, '.harness', 'attachments');
    await until(() => fs.existsSync(attachments) && fs.readdirSync(attachments).some(name =>
      fs.statSync(path.join(attachments, name)).size === Buffer.from(image, 'base64').length), `${name} image captured`);
    await delay(250);
    state.child.stdin.write('\x1b[A\x1b[A\t\t');
  }
  else if (answer === 'partial') state.child.stdin.write('\r\t');
  else if (answer === 'empty') state.child.stdin.write('\t\t');
  else if (answer === 'notes') {
    state.child.stdin.write('n');
    await until(() => state.frame().includes('Notes ·'), `${name} notes input`);
    state.child.stdin.write('retained note');
    await until(() => state.frame().includes('retained note'), `${name} notes text`);
    state.child.stdin.write('\x1b'); await delay(80); state.child.stdin.write('\t\t');
  }
  if (afk) {
    state.child.stdin.write('\x1b[O');
    if (longAfk) {
      await delay(80);
      fs.writeFileSync(clockFile, String(Number(fs.readFileSync(clockFile, 'utf8')) + 601000));
    }
  } else {
    await until(() => state.frame().includes('Review your answers'), `${name} review`);
    state.child.stdin.write('\r');
  }
  await until(() => requests.length === before + 2 && state.frame().includes('PARTIAL_QUESTIONS_DONE') && state.frame().includes('ready'), `${name} result`);
  const result = requests.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
    .findLast(block => block.type === 'tool_result');
  assert.ok(result);
  if (expected === 'error') assert.equal(result.is_error, true, JSON.stringify(result));
  else {
    assert.equal(result.is_error ?? false, false, JSON.stringify(result));
    const value = JSON.parse(typeof result.content === 'string' ? result.content : result.content[0].text);
    assert.deepEqual(value.answers, expected);
    if (afk) {
      assert.equal(value.afkTimeoutMs, longAfk ? 600000 : 1000);
      assert.match(value.notice, longAfk ? /^No response after 600s/ : /^No response after 1s/);
    }
    else { assert.equal(value.afkTimeoutMs, undefined); assert.equal(value.notice, undefined); }
    if (answer === 'image') {
      assert.ok(Array.isArray(result.content));
      assert.deepEqual(result.content.slice(1), [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } }]);
      assert.equal(JSON.stringify(value).includes(image), false);
      await until(() => fs.readdirSync(path.join(workspace, '.harness', 'attachments')).length === 0, `${name} image cleanup`);
    }
  }
}
async function close(state) {
  state.child.stdin.write('/exit\r');
  assert.equal(await Promise.race([state.exit, delay(6000).then(() => 'timeout')]), 0, state.errors);
  state.child.stdin.end(); state.screen.close();
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
}
try {
  let state = await launch();
  const original = held();
  await ask(state, 'ASK_PARTIAL', 'partial', [{ questionIndex: 0, selected: ['A'], annotations: { preview: 'Preview A' } }]);
  assert.equal(original.rows[0].config.features.questionPartialAnswers, true);
  await ask(state, 'ASK_EMPTY', 'empty', []);
  await ask(state, 'ASK_NOTES', 'notes', [{ questionIndex: 0, selected: [], annotations: { notes: 'retained note' } }]);
  await ask(state, 'ASK_AFK_PARTIAL', 'partial', [{ questionIndex: 0, selected: ['A'], annotations: { preview: 'Preview A' } }], true);
  await ask(state, 'ASK_AFK_EMPTY', 'idle', [], true);
  await ask(state, 'ASK_AFK_NOTES', 'notes', [{ questionIndex: 0, selected: [], annotations: { notes: 'retained note' } }], true);
  await ask(state, 'ASK_IMAGE', 'image', []);
  await ask(state, 'ASK_AFK_IMAGE', 'image', [], true);
  await close(state);
  settings(false);
  state = await launch(original.id);
  assert.deepEqual(held().rows[0], original.rows[0]);
  await ask(state, 'ASK_RESUMED', 'empty', []);
  state.child.stdin.write('/reload\r');
  await until(() => held()?.id !== original.id && held()?.rows[0].config.features.questionPartialAnswers === false && state.frame().includes('ready'), 'explicit legacy reload');
  await ask(state, 'ASK_LEGACY', 'partial', 'error');
  await close(state);
  state = await launch();
  assert.equal(held().rows[0].config.features.questionPartialAnswers, false);
  await ask(state, 'ASK_FRESH_LEGACY', 'empty', 'error');
  const beforeCancel = requests.length;
  state.child.stdin.write('ASK_CANCEL\r');
  await until(() => state.frame().includes('Choose the retained layout'), 'cancel question');
  state.child.stdin.write('\x03');
  await until(() => requests.length === beforeCancel + 2 && state.frame().includes('PARTIAL_QUESTIONS_DONE') && state.frame().includes('ready'), 'cancel result');
  const cancelled = requests.at(-1).messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
    .findLast(block => block.type === 'tool_result');
  assert.equal(cancelled?.is_error, true);
  await close(state);
  assert.equal(requests.length, 24);
  console.log(JSON.stringify({ cliPartialQuestions: 'passed', partial: true, empty: true, notes: true, images: true, afk: true, longAfk,
    originalResumePinned: true, explicitLegacyReload: true, freshLegacy: true, cancelled: true, modelRequests: requests.length, externalCalls: 0 }));
} finally {
  for (const state of children) {
    if (!state.closed) { try { process.kill(-state.child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } await state.exit; }
    state.screen.close();
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
