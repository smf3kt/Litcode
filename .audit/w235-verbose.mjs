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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w235-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'ALPHA-LINE\nBETA-LINE\nGAMMA-LINE\n');
const settingsFile = path.join(user, 'settings.json');
// No verbose key: the first launch starts from the source's default false.
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', thinking: false, keep: 'authored' }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const search = { name: 'search', input: { pattern: 'LINE' } };
const read = { name: 'read_file', input: { path: 'fixture.txt' } };
const missing = { name: 'read_file', input: { path: 'missing.txt' } };
const requests = [], classifierRequests = [], children = [], checks = [], captures = {};
let active, pending = { name: 'read_file', input: { path: 'fixture.txt' } }, mainTurns = 0, withheld;

const sse = (response, events) => {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
};
const streamed = (response, { id, block, stopReason, json = false }) => sse(response, [
  ['message_start', { type: 'message_start', message: { id, type: 'message', role: 'assistant',
    model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: block.start }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: json
    ? { type: 'input_json_delta', partial_json: block.text }
    : { type: 'text_delta', text: block.text } }],
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 10 } }],
  ['message_stop', { type: 'message_stop' }],
]);
const lastMessageHasToolResult = body => {
  const last = body.messages?.at(-1);
  return Array.isArray(last?.content) && last.content.some(block => block.type === 'tool_result');
};
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    if (JSON.stringify(body.system ?? '').includes('cc_automode_permissions')) {
      classifierRequests.push(body);
      streamed(response, { id: `msg_classifier_${classifierRequests.length}`,
        block: { start: { type: 'text', text: '' }, text: '<block>no</block>' }, stopReason: 'end_turn' });
      return;
    }
    mainTurns++;
    requests.push({ body, tool: pending.name });
    if (!lastMessageHasToolResult(body)) {
      streamed(response, { id: `msg_tool_${mainTurns}`, stopReason: 'tool_use', json: true,
        block: { start: { type: 'tool_use', id: `toolu_w235_${mainTurns}`, name: pending.name, input: {} },
          text: JSON.stringify(pending.input) } });
      return;
    }
    streamed(response, { id: `msg_done_${mainTurns}`, stopReason: 'end_turn',
      block: { start: { type: 'text', text: '' }, text: `finished ${mainTurns}` } });
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'TMUX', 'STY'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(90, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const panel = () => /^Config$/m.test(screen());
const ready = () => !panel() && screen().includes('· ready');
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 18000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(50);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch(resume) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'bypass'])], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 25000);
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, screen()); }
async function openConfig() { send('/config\r'); await until(() => panel() && screen().includes('Verbose output'), 'Config rows'); }
async function selectVerbose() {
  send('verbose\r'); await until(() => panel() && screen().includes('Enter/Space change'), 'verbose row selected');
}
async function toggleVerbose(value) {
  send('\r'); await until(() => stored().verbose === value && !screen().includes('Saving settings'), `persist verbose ${value}`);
}
async function closeConfig() {
  for (let index = 0; index < 3 && panel(); index++) { send('\x1b'); await delay(120); }
  await until(ready, 'Config closed');
}
async function turn(prompt) {
  const before = requests.length; send(prompt + '\r');
  await until(() => requests.length === before + 2 && ready() && screen().includes(`finished ${mainTurns}`), 'turn finished');
  assert.equal(requests.at(-1).body.messages.at(-1).content.at(-1).type, 'tool_result');
}
function journal() {
  const locks = fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl.lock'));
  assert.equal(locks.length, 1); const file = path.join(workspace, '.agent', locks[0].slice(0, -5));
  return { file, id: path.basename(file, '.jsonl'), events: fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) };
}
try {
  await launch(); await turn('read the fixture with verbose off'); captures.off = screen();
  pass('the summary row renders Read 3 lines without the file body', screen().includes('Read 3 lines') && !screen().includes('ALPHA-LINE'));
  pending = search; await turn('search the fixture with verbose off');
  pass('a search summary counts lines and offers the expand hint',
    screen().includes('Found 3 lines (ctrl+o)') && !screen().includes('ALPHA-LINE'));
  await openConfig(); captures.configOff = screen();
  pass('Config exposes Verbose output and starts false', /Verbose output\s+false/.test(screen()));
  await selectVerbose(); await toggleVerbose(true); await closeConfig(); captures.on = screen();
  pass('toggling Verbose output persists into the user settings beside authored keys',
    stored().verbose === true && stored().keep === 'authored');
  pass('the successor session records the live switch', journal().events[0].config.verbose === true);
  await turn('search the fixture with verbose on'); captures.detailed = screen();
  pass('Verbose shows the match body under the five-cell margin', screen().includes('ALPHA-LINE') && screen().includes('GAMMA-LINE'));
  pending = missing; await turn('read a missing file with verbose on'); captures.error = screen(); pending = read;
  pass('a failed tool call renders its Error row', /Error: .*missing\.txt/.test(screen()));
  await stop(); await launch(); await openConfig(); captures.restart = screen();
  pass('a fresh CLI restores the saved true switch', /Verbose output\s+true/.test(screen()));
  await closeConfig(); pending = search; await turn('search the fixture after restart');
  pass('the restored switch still renders detailed rows', screen().includes('ALPHA-LINE'));
  await openConfig(); await selectVerbose(); await toggleVerbose(false); await closeConfig();
  pass('turning Verbose off repaints the existing rows as summaries', !screen().includes('ALPHA-LINE'));
  await turn('search the fixture with verbose off again');
  pass('the next turn keeps the summary-only lane', screen().includes('Found 3 lines (ctrl+o)') && !screen().includes('ALPHA-LINE'));
  send('\u000f'); await until(() => screen().includes('ALPHA-LINE'), 'transcript screen detail');
  pass('the transcript screen forces detailed tool rows while the switch is off', screen().includes('ALPHA-LINE'));
  send('\u001b'); await until(() => !screen().includes('ALPHA-LINE'), 'chat screen summary');
  pass('leaving the transcript screen returns the summary rows', !screen().includes('ALPHA-LINE'));
  const reloaded = stored(); reloaded.verbose = true; fs.writeFileSync(settingsFile, JSON.stringify(reloaded));
  send('/reload\r'); await until(() => ready() && screen().includes('ALPHA-LINE'), 'reload true detail');
  pass('reload applies an authored true switch to the existing rows', screen().includes('ALPHA-LINE'));
  reloaded.verbose = false; fs.writeFileSync(settingsFile, JSON.stringify(reloaded));
  send('/reload\r'); await until(() => ready() && !screen().includes('ALPHA-LINE'), 'reload false summary');
  pass('a second reload returns the authored false switch to summaries', !screen().includes('ALPHA-LINE'));
  const beforeFocus = requests.length; send('/focus on\r'); await until(ready, 'focus applied');
  await turn('search after switching focus');
  pass('a focus switch keeps the next turn usable and calls finished', requests.length === beforeFocus + 2);
  pass('the focus turn renders no runtime owner failure', !screen().includes('Runtime owner'));
  const activeId = journal().id; await stop(); await launch(activeId); await openConfig();
  pass('resume restores the stored false switch independently of the focus view mode',
    /Verbose output\s+false/.test(screen()));
  await closeConfig(); await turn('search after resume');
  pass('the resumed turn keeps summary rows', screen().includes('Found 3 lines (ctrl+o)') && !screen().includes('ALPHA-LINE'));
  await stop();
  const files = fs.readdirSync(path.join(workspace, '.agent'));
  pass('every owned CLI exits zero and releases its session lock', children.every(current => current.child.exitCode === 0)
    && !files.some(file => file.endsWith('.jsonl.lock')));
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    requests: requests.map(row => ({ tool: row.tool, blocks: row.body.messages?.length })),
    classifierRequests: classifierRequests.length,
    identity: identity.sha256, inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256 }, null, 2));
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${identity.sha256}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  if (withheld) withheld.destroy();
  for (const current of children) if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
