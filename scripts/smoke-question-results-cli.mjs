import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const directory = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : root, 'question-results-cli-')));
const workspace = path.join(directory, 'workspace'), userDir = path.join(directory, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(userDir);
const settings = value => fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ prefersReducedMotion: true,
  promptSuggestionEnabled: false, ...(value === undefined ? {} : { features: { sourceQuestionResults: value } }) }));
settings();
const question = { questions: [{ question: 'Which route?', header: 'Route', multiSelect: false,
  options: [{ label: 'A', description: 'First path' }, { label: 'B', description: 'Second path' }] }] };
const expected = 'Your questions have been answered: "Which route?"="A". You can now continue with these answers in mind.';
let phase = 'source', shownQuestion = question, expectedText = expected, failure;
const requests = [];
function send(response, block) {
  const tool = block.type === 'tool_use';
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'question', type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: tool ? { ...block, input: {} } : { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: tool ? { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } : { type: 'text_delta', text: block.text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}
const server = http.createServer(async (request, response) => {
  try {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push(body);
    const last = body.messages.at(-1)?.content;
    if (typeof last === 'string') { send(response, { type: 'tool_use', id: `question-${requests.length}`, name: 'ask_user_question', input: shownQuestion }); return; }
    const result = last.find(block => block.type === 'tool_result'); assert.ok(result);
    assert.equal(result.is_error ?? false, false, JSON.stringify(result));
    if (phase === 'legacy') assert.deepEqual(JSON.parse(String(result.content)), { answers: [{ questionIndex: 0, selected: ['A'] }] });
    else assert.equal(result.content, expectedText, 'Source question result must use the recovered model mapper');
    send(response, { type: 'text', text: 'QUESTION_RESULT_DONE' });
  } catch (error) { failure = error; send(response, { type: 'text', text: 'QUESTION_RESULT_FAILED' }); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, HOME: directory, TERM: 'xterm-256color', HARNESS_LOOP_KEEPALIVE: 'off' };
for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
Object.assign(env, { LLM_API_KEY: 'owned-question-fixture', LLM_MODEL: 'fixture', LLM_AUTH: 'bearer',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_TOKEN_COUNTING: 'estimate', LLM_THINKING: 'false' });
const pty = path.join(directory, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 38 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
const states = [];
let active;
const held = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl.lock')).map(file => {
  const text = fs.readFileSync(path.join(workspace, '.agent', file.slice(0, -5)), 'utf8');
  return { id: file.slice(0, -11), rows: text.slice(0, text.lastIndexOf('\n')).split('\n').filter(Boolean).map(JSON.parse) };
})[0];
async function until(check, label) {
  const end = Date.now() + 10000;
  while (!check()) { if (failure) throw failure; assert.equal(active.closed, false, active.errors);
    assert.ok(Date.now() < end, `${label}\n${active.frame()}\n${active.errors}`); await delay(20); }
  if (failure) throw failure;
}
async function launch(id, inline = false, managed) {
  const screen = new TerminalScreen(120, 38);
  const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--interactive', '--no-inherit-gateway', ...(inline ? ['--no-tui'] : []), ...(managed ? ['--managed-settings', managed] : []),
    ...(id ? ['--resume', id] : ['--user-dir', userDir])], { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, screen, closed: false, errors: '', frame: () => screen.lines().join('\n'),
    ready: () => inline ? screen.lines().some(line => line.trim() === '>' || line.includes('finished: end_turn')) : screen.lines().join('\n').includes('ready') };
  child.stdout.setEncoding('utf8'); child.stdout.on('data', text => screen.write(text)); child.stderr.on('data', text => { state.errors += text; });
  state.exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => { state.closed = true; resolve(code); }); });
  states.push(state); active = state;
  await until(() => state.ready() && fs.existsSync(path.join(workspace, '.agent')) && held(), 'startup'); return state;
}
async function ask(state, inline = false, other = false, questionName = 'Which route?') {
  shownQuestion = { questions: question.questions.map(question => ({ ...question, question: questionName })) };
  expectedText = other ? `The user answered: "${questionName}"="Wait for review". Read the answers carefully — they may request clarification, changes, or that you not proceed — and follow what they actually say.`
    : `Your questions have been answered: "${questionName}"="A". You can now continue with these answers in mind.`;
  const before = requests.length; state.child.stdin.write('QUESTION_RESULT\r');
  await until(() => inline ? state.frame().includes('One number') : state.frame().includes(questionName) && state.frame().includes('First path'), 'question dialog');
  if (other) {
    state.child.stdin.write('\x1b[B\x1b[B');
    await until(() => state.frame().includes('> Other'), 'Other input focus');
    state.child.stdin.write('Wait for review\r');
  } else state.child.stdin.write(inline ? '1\r' : '\r');
  await until(() => requests.length === before + 2 && state.frame().includes('QUESTION_RESULT_DONE') && state.ready(), 'completed answer');
  if (phase !== 'legacy') {
    const result = held().rows.findLast(row => row.kind === 'tool_result');
    assert.deepEqual(result.host, { kind: 'questions', questions: shownQuestion.questions,
      answers: Object.fromEntries([[questionName, other ? 'Wait for review' : 'A']]), annotations: {} });
    assert.ok(state.frame().includes('User answered questions:')); assert.ok(state.frame().includes(questionName));
    assert.ok(state.frame().includes(other ? 'Wait for review' : 'A'));
  }
}
async function close(state) { state.child.stdin.write('/exit\r'); assert.equal(await Promise.race([state.exit, delay(5000).then(() => -1)]), 0, state.errors);
  state.screen.close(); assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(file => file.endsWith('.lock')), false); }
try {
  let state = await launch(); const original = held();
  await ask(state); await ask(state, false, true);
  for (const name of ['__proto__', 'constructor', 'toString']) await ask(state, false, false, name);
  await close(state); settings(false);
  state = await launch(original.id); assert.deepEqual(held().rows[0], original.rows[0]);
  for (const name of ['__proto__', 'constructor', 'toString']) {
    const host = held().rows.filter(row => row.kind === 'tool_result').map(row => row.host).find(host => host?.questions?.[0]?.question === name);
    assert.ok(host); assert.deepEqual(Object.keys(host.answers), [name]); assert.equal(host.answers[name], 'A');
  }
  await ask(state);
  state.child.stdin.write('/reload\r'); await until(() => held()?.id !== original.id && held()?.rows[0].config.features.sourceQuestionResults === false && state.ready(), 'legacy reload');
  phase = 'legacy'; await ask(state); await close(state);
  state = await launch(); await ask(state); await close(state);
  settings(true); phase = 'source'; state = await launch(undefined, true); await ask(state, true); await close(state);
  const managed = path.join(directory, 'managed.json'); fs.writeFileSync(managed, JSON.stringify({ features: { sourceQuestionResults: false } }));
  phase = 'legacy'; state = await launch(undefined, false, managed); await ask(state); await close(state);
  console.log(JSON.stringify({ questionResults: 'passed', modelText: true, typedHost: true, native: true, inline: true, other: true, specialQuestionKeys: true, coldSpecialKeys: true,
    pinnedResume: true, legacyReload: true, authoredFalse: true, managedFalse: true, requests: requests.length, externalCalls: 0 }));
} finally {
  for (const state of states) { if (!state.closed) { try { process.kill(-state.child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } await state.exit; } state.screen.close(); }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true });
}
