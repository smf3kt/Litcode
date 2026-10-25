import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

// Compiled checks for W333: the open-fleet `/fork` gates recovered from `Ue`
// (chunk-zsg1bb14.js [19311,20040)) and the `isEnabled:()=>!xa()` command rows.
const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'fork-gates-cli-')));
const checks = [];
let active;

function sse(res, text) {
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: 'msg_fork', type: 'message', role: 'assistant',
    model: 'fixture-model', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '', citations: null } });
  send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

const requests = [];
const server = http.createServer((request, response) => {
  let body = '';
  request.on('data', chunk => { body += chunk; });
  request.on('end', () => {
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* a non-JSON body stays empty */ }
    requests.push(parsed);
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const last = Array.isArray(parsed.messages) ? parsed.messages.at(-1) : undefined;
    sse(response, JSON.stringify(last?.content ?? '').includes('FORK_TASK') ? 'COPY_REPLY' : 'PARENT_REPLY');
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const baseEnv = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_MODEL: 'fixture-model', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` };
for (const key of Object.keys(baseEnv)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_DISABLE_AGENT_VIEW', 'IS_DEMO',
    'CLAUDE_CODE_COORDINATOR_MODE', 'CLAUDE_CODE_REMOTE'].includes(key)) delete baseEnv[key];

const screen = () => {
  const terminal = new TerminalScreen(110, 40);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const flat = () => screen().replace(/\s+/g, '');
const ready = () => screen().includes('· ready') || flat().includes('?forshortcuts');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(80);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${screen()}`);
  checks.push(label); console.log(`PASS ${label}`);
}
async function startSession(tag, extraEnv = {}) {
  const workspace = path.join(temporary, `${tag}-workspace`), user = path.join(temporary, `${tag}-user`);
  fs.mkdirSync(workspace); fs.mkdirSync(user);
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
    promptSuggestionEnabled: false }));
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/litcode.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: workspace, env: { ...baseEnv, HOME: temporary, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, `${tag} startup ready`, 30000);
  return { workspace };
}
const journals = workspace => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
const records = file => {
  const text = fs.readFileSync(file, 'utf8');
  return text.slice(0, text.lastIndexOf('\n')).split('\n').filter(Boolean).map(line => JSON.parse(line));
};
const lastText = request => JSON.stringify(request.messages?.at(-1)?.content ?? '');
async function resumeSession(workspace, id) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/litcode.mjs'), '--workspace', workspace, '--resume', id, '--interactive', '--no-inherit-gateway'],
  { cwd: temporary, env: { ...baseEnv, HOME: temporary }, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'waiting copy resume ready');
}
async function endSession() {
  send('/exit\r');
  const code = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
}

try {
  // `Ue`'s first statement: a coordinator session refuses before anything is seeded, and both
  // agent rows carry `isEnabled:()=>!xa()`.
  const coordinator = await startSession('coordinator',
    { CLAUDE_CODE_COORDINATOR_MODE: 'on', CLAUDE_CODE_REMOTE: '1' });
  pass('the compiled CLI starts ready in a coordinator session');
  send('/fork write the tests\r');
  await until(() => flat().includes('Forkingisnotavailableincoordinatorsessions.Use/branchinstead.'),
    'coordinator row');
  pass('a coordinator /fork prints the source refusal');
  pass('the coordinator refusal seeds no copy', journals(coordinator.workspace).length === 1);
  // A bare `/` opens the suggestion list; Enter would submit and dismiss it.
  send('/');
  await delay(900);
  // The typed `/fork write the tests` row is still in the transcript, so the list is read by its
  // row descriptions rather than by the command word.
  const listed = flat();
  pass('the coordinator list omits the /fork row', !listed.includes('Copythisconversationintoanewbackgroundsession'));
  pass('the coordinator list omits the /subtask row',
    !listed.includes('Sendasubagentoffwithyourfullcontext;itsresultcomesbackhere'));
  pass('the coordinator list still offers /branch', listed.includes('Createabranchofthecurrentconversationatthispoint'));
  send('\x1b');
  await until(ready, 'coordinator close');
  await endSession();
  pass('/exit ends the coordinator session');

  // `fBe` refuses only when no user text was seen and no prompt was typed.
  const open = await startSession('open');
  pass('the compiled CLI starts ready in an open fleet fork');
  send('/fork\r');
  await until(() => flat().includes('Nothingtoforkyet.Sendamessagefirst.'), 'nothing row');
  pass('a bare /fork with no conversation prints the source row');
  send('/fork FORK_TASK\r');
  // `Ue` names the copy `TMr(parentName ⑂ prompt)`; this fixture session has no title, so the
  // prompt is the name segment between the state and the id.
  await until(() => /sessionrunning·FORK_TASK·[0-9a-f]{8}/.test(flat()), 'running row');
  pass('a typed prompt seeds an empty conversation and reports the running row');
  await until(() => requests.some(request => JSON.stringify(request.messages ?? '').includes('FORK_TASK')),
    'copy request');
  pass('the copy runs the typed prompt against the provider');
  pass('the copy wrote its own journal', journals(open.workspace).length === 2);
  await endSession();
  pass('/exit ends the open-fleet session');
  pass('the session released its locks',
    fs.readdirSync(path.join(open.workspace, '.agent')).filter(name => name.endsWith('.lock')).length === 0);

  const waiting = await startSession('waiting');
  send('ORIGINAL_TASK\r');
  await until(() => screen().includes('PARENT_REPLY') && ready(), 'parent task finished');
  const parentFile = path.join(waiting.workspace, '.agent', journals(waiting.workspace)[0]);
  await until(() => records(parentFile).some(event => event.kind === 'turn_end'), 'parent turn committed');
  const parentBytes = fs.readFileSync(parentFile, 'utf8');
  const beforeFork = requests.length;
  send('/fork\r');
  await until(() => flat().includes('sessionwaitingforaprompt·') && journals(waiting.workspace).length === 2,
    'waiting fork row');
  const copyFile = path.join(waiting.workspace, '.agent', journals(waiting.workspace)
    .find(name => name !== path.basename(parentFile)));
  const copyEvents = records(copyFile);
  const copyId = copyEvents[0].id;
  const copyLock = copyFile + '.lock';
  pass('a bare fork saves a completed copy', copyEvents.some(event => event.kind === 'branch')
    && copyEvents.some(event => event.kind === 'turn_end'));
  pass('the waiting copy releases its lock without starting a task', !fs.existsSync(copyLock));
  pass('forking leaves the parent journal unchanged', fs.readFileSync(parentFile, 'utf8') === parentBytes);
  await endSession();
  await delay(500);
  pass('the waiting copy sends no model request', requests.length === beforeFork);
  pass('the waiting copy keeps the fork-point history', JSON.stringify(records(copyFile)) === JSON.stringify(copyEvents));

  await resumeSession(waiting.workspace, copyId);
  pass('the saved copy resumes in an interactive terminal');
  send('NEW_COPY_TASK\r');
  await until(() => requests.some(request => lastText(request).includes('NEW_COPY_TASK'))
    && screen().includes('PARENT_REPLY') && ready(), 'resumed copy task');
  pass('only the new task executes after resume', requests.length === beforeFork + 1);
  const resumed = requests.find(request => lastText(request).includes('NEW_COPY_TASK'));
  pass('the resumed request retains the original conversation', JSON.stringify(resumed.messages).includes('ORIGINAL_TASK'));
  await endSession();
  pass('resuming the copy leaves the parent journal unchanged', fs.readFileSync(parentFile, 'utf8') === parentBytes);
  pass('the resumed copy releases its lock', !fs.existsSync(copyLock));

  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, requests: requests.length }, null, 2));
  console.log(`\n${checks.length} checks, ${requests.length} model requests, fixture ${temporary}`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
