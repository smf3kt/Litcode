import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

// Compiled checks for W334: `gft`'s relocation (`po`), `editsIn` (`xo`) and briefing (`Fo`) on the
// open-fleet `/fork` (chunk-24k7d6mw.js 38766). The parent runs inside a real linked worktree, so
// the copy must land in the origin tree, say so on its row, and carry the briefing into its own
// request.
const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'fork-relocation-cli-')));
const checks = [];
let active;

const fixtureEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test' };
const git = (cwd, ...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
  cwd, env: fixtureEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 }).trimEnd();

const origin = path.join(temporary, 'origin');
fs.mkdirSync(origin);
git(origin, 'init', '--initial-branch=trunk');
fs.writeFileSync(path.join(origin, 'file.txt'), 'baseline\n');
git(origin, 'add', 'file.txt'); git(origin, 'commit', '-m', 'Disposable fixture baseline');
const worktree = path.join(origin, '.harness-worktrees', 'feature');
fs.mkdirSync(path.dirname(worktree), { recursive: true });
git(origin, 'worktree', 'add', '-b', 'feature', worktree);

function sse(res, text) {
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: 'msg_relocation', type: 'message', role: 'assistant',
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
  const terminal = new TerminalScreen(120, 40);
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
const journals = workspace => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));

try {
  const user = path.join(temporary, 'user');
  fs.mkdirSync(user);
  fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false }));
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/litcode.mjs'), '--workspace', worktree, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'],
  { cwd: worktree, env: { ...baseEnv, HOME: temporary }, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => active.chunks.push(chunk));
  child.stderr.on('data', chunk => active.chunks.push(chunk));
  await until(ready, 'worktree startup ready', 30000);
  pass('the compiled CLI starts ready inside a linked worktree');

  send('/fork FORK_TASK\r');
  // `Ue` names the copy `TMr(parentName ⑂ prompt)`, so the row carries the prompt between the
  // state and the id; this fixture session has no title, so the prompt is the name segment.
  await until(() => /sessionrunning·FORK_TASK·[0-9a-f]{8}·runsintheorigintree/.test(flat()), 'origin-tree row');
  pass('the fork row names the origin tree');
  await until(() => requests.some(request => JSON.stringify(request.messages ?? '').includes('FORK_TASK')), 'copy request');
  pass('the copy runs the typed prompt against the provider');
  const copyRequest = requests.find(request => JSON.stringify(request.messages ?? '').includes('FORK_TASK'));
  const copyText = JSON.stringify(copyRequest?.messages ?? '');
  pass('the copy carries the briefing about the original worktree',
    copyText.includes('This conversation was forked out of') && copyText.includes('never edit files, run commands, or enter that worktree'));
  pass('the copy is told where it runs', copyText.includes(JSON.stringify(origin).slice(1, -1)));

  await until(() => journals(origin).length === 1, 'origin journal');
  pass('the copy wrote its journal in the origin tree');
  // `gft`'s `_t` renames the copy before the spawn; this fixture session has no title, so the copy
  // is named `⑂ FORK_TASK` and its own journal carries that title, not the parent's.
  const copyJournal = path.join(origin, '.agent', journals(origin)[0]);
  await until(() => fs.readFileSync(copyJournal, 'utf8').includes('\u2442 FORK_TASK'), 'copy title');
  pass('the copy journal carries the fork name');
  pass('the worktree keeps only its own journal', journals(worktree).length === 1);

  send('/exit\r');
  const code = await Promise.race([active.closed, delay(8000).then(() => 'timeout')]);
  assert.equal(code, 0, `CLI exit ${code}\n${screen()}`);
  pass('/exit ends the worktree session');
  pass('the session released its locks',
    fs.readdirSync(path.join(worktree, '.agent')).filter(name => name.endsWith('.lock')).length === 0);

  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, requests: requests.length }, null, 2));
  console.log(`\n${checks.length} checks, ${requests.length} model requests, fixture ${temporary}`);
} finally {
  if (active?.child.exitCode === null) active.child.kill('SIGKILL');
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
