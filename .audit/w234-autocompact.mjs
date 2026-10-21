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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w234-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settingsFile = path.join(user, 'settings.json');
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'fixture', thinking: false, compactAt: 100_000, keep: 'authored' }));
fs.writeFileSync(path.join(workspace, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const requests = [], counts = [], children = [], checks = [], captures = {};
let active, pressure = 100, summaryPressure = 100, holdNextSummary = false, held, abortObserved = false;
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks));
    if (request.url?.includes('count_tokens')) {
      const inputTokens = String(body.messages?.[0]?.content).startsWith('Session summary') ? summaryPressure : pressure;
      counts.push({ path: request.url, inputTokens, messages: body.messages?.length });
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ input_tokens: inputTokens })); return;
    }
    const summary = body.tool_choice?.type === 'none';
    requests.push({ summary, body });
    if (summary && holdNextSummary) {
      holdNextSummary = false; held = response;
      response.on('close', () => { abortObserved = true; held = undefined; }); return;
    }
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant',
      model: body.model, content: [], stop_reason: null, stop_sequence: null, container: null, diagnostics: null, stop_details: null,
      usage: { input_tokens: 1, output_tokens: 0 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta',
      text: summary ? 'The prior task is complete. Continue the current task.' : `response ${requests.length}` } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
    send('message_stop', { type: 'message_stop' }); response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'api' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'LLM_DISABLE_AUTO_COMPACT', 'LLM_DISABLE_COMPACT', 'TMUX', 'STY'].includes(key)) delete env[key];
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
async function launch(overrides = {}, resume) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w205-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway'])], { cwd: root, env: { ...env, ...overrides }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 25000);
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, screen()); }
async function open() { send('/config\r'); await until(() => panel() && screen().includes('Auto-compact'), 'Config auto row'); }
async function selectAuto() { send('autoCompact\r'); await until(() => panel() && screen().includes('Enter/Space change'), 'auto row selected'); }
async function toggle(value, key = '\r') {
  send(key); await until(() => stored().autoCompactEnabled === value && !screen().includes('Saving settings'), `persist auto ${value}`);
}
async function close() { send('\x1b'); await until(ready, 'Config closed'); }
async function turn(prompt, summaries = 0) {
  const before = requests.length; send(prompt + '\r');
  await until(() => requests.length === before + 1 + summaries && ready() && screen().includes(`response ${before + 1 + summaries}`), 'turn finished');
  const next = requests.slice(before); assert.equal(next.filter(row => row.summary).length, summaries);
}
function journal() {
  const locks = fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl.lock'));
  assert.equal(locks.length, 1); const file = path.join(workspace, '.agent', locks[0].slice(0, -5));
  return { file, id: path.basename(file, '.jsonl'), events: fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)) };
}
try {
  await launch(); await turn('seed the completed history'); await open(); captures.default = screen();
  pass('Config exposes Auto-compact with its default true', /^Auto-compact\s+true$/m.test(screen()));
  await selectAuto(); await toggle(false); captures.off = screen(); await close();
  pass('Enter saves false immediately and Escape retains it', stored().autoCompactEnabled === false && stored().keep === 'authored');
  // W252 moved the row live; the running session keeps its file instead of a successor.
  pass('the live toggle opens no successor session',
    fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')).length === 1);
  pressure = 100_000; await turn('over automatic threshold with auto disabled');
  pass('disabled auto sends a normal request at the exact threshold');
  await turn('/attach pixel.png attachment above the automatic threshold');
  pass('disabled auto also skips attachment precompaction within capacity');
  send('/autocompact\r'); await until(() => /^Auto-compact window$/m.test(screen()), 'window dialog'); captures.disabledWindow = screen();
  pass('threshold chooser shows the recovered disabled caption', screen().includes('Auto-compact is currently disabled (see /config)'));
  send('\x1b'); await until(ready, 'window cancel');
  send('/autocompact 200k\r'); await until(() => ready() && stored().compactAt === 200_000, 'disabled window saved');
  pressure = 200_000; await turn('disabled auto after changing its window');
  pass('the threshold can change while disabled and the next task stays usable');
  const beforeManual = requests.length; send('/compact Keep the current task\r');
  await until(() => requests.length === beforeManual + 1 && ready(), 'manual summary completed');
  pass('manual compact still sends a tool-free summary while auto is disabled', requests.at(-1).summary
    && JSON.stringify(requests.at(-1).body.messages).includes('Keep the current task'));
  pass('the journal commits the manual summary and turn end', journal().events.some(event => event.kind === 'compact')
    && journal().events.some(event => event.kind === 'turn_end' && event.reason === 'manual_compact'));
  await stop(); await launch(); await open(); captures.restart = screen();
  pass('a fresh CLI restores saved false', /^Auto-compact\s+false$/m.test(screen()));
  await selectAuto(); await toggle(true, '\x1b[C'); await close();
  pressure = 100; await turn('seed after re-enabling'); pressure = stored().compactAt;
  await turn('trigger automatic compaction', 1);
  pass('re-enabled auto summarizes the next threshold-crossing turn', requests.at(-2).summary && !requests.at(-1).summary);
  const activeId = journal().id; await stop(); await launch({}, activeId);
  // The row now applies live (W252), so the session snapshot keeps the value it was opened
  // with; `/reload` is the path that re-reads the persisted setting on resume.
  send('/reload\r'); await until(() => ready() && !panel(), 'reload after resume');
  await open(); pass('reload after resume adopts the persisted true', /^Auto-compact\s+true$/m.test(screen()));
  await selectAuto(); const validBytes = fs.readFileSync(settingsFile, 'utf8'); fs.writeFileSync(settingsFile, '{invalid');
  send('\r'); await until(() => screen().includes('JSON') && !screen().includes('Saving settings'), 'write failure');
  pass('failed save leaves true active and preserves the malformed authored bytes', /^Auto-compact\s+true$/m.test(screen())
    && fs.readFileSync(settingsFile, 'utf8') === '{invalid');
  fs.writeFileSync(settingsFile, validBytes); await toggle(false); await close(); await stop();
  await launch({ LLM_DISABLE_AUTO_COMPACT: ' YeS ' }); pressure = stored().compactAt;
  const settings = stored(); settings.autoCompactEnabled = true; fs.writeFileSync(settingsFile, JSON.stringify(settings));
  send('/reload\r'); await until(() => ready() && journal().events[0].config.autoCompactEnabled === true, 'reload setting');
  await turn('environment-disabled first turn'); await turn('environment-disabled second turn');
  pass('live disable environment wins over saved true after reload');
  send('/autocompact\r'); await until(() => /^Auto-compact window$/m.test(screen()), 'environment caption');
  pass('the chooser reports the effective environment disable', screen().includes('Auto-compact is currently disabled'));
  send('\x1b'); await until(ready, 'environment dialog canceled');
  holdNextSummary = true; const beforeCancel = requests.length; send('/compact\r');
  await until(() => requests.length === beforeCancel + 1 && held !== undefined, 'held summary'); send('\x03');
  await until(() => abortObserved && ready(), 'summary aborted');
  pass('Ctrl+C aborts the in-flight manual request and returns the prompt');
  await turn('normal task after canceled manual compact');
  pass('the next task runs after cancellation with auto still disabled');
  pressure = 980_616; const beforeBlocked = requests.length; send('hard-capacity task\r');
  await until(() => ready() && screen().includes('Prompt is too long'), 'hard capacity outcome');
  pass('disabled auto returns blocking_limit before completion', requests.length === beforeBlocked
    && journal().events.at(-1)?.reason === 'blocking_limit');
  send('/compact\r'); await until(() => requests.length === beforeBlocked + 1 && ready(), 'manual recovery from capacity');
  pass('a capacity-blocked turn remains manually compactable', requests.at(-1).summary);
  await turn('continue after capacity recovery'); pass('normal input resumes after manual capacity recovery');
  pressure = stored().compactAt; await stop(); await launch({ LLM_DISABLE_COMPACT: 'on' });
  await turn('seed with all compaction disabled'); await turn('threshold with all compaction disabled');
  const beforeGlobal = requests.length; send('/compact\r');
  await until(() => ready() && screen().includes('error: Compaction'), 'manual global gate');
  pass('global disable closes the manual entry without a model request', requests.length === beforeGlobal); await stop();
  const finalSettings = stored(); finalSettings.autoCompactEnabled = true; finalSettings.compactAt = 981_000;
  fs.writeFileSync(settingsFile, JSON.stringify(finalSettings)); pressure = 980_700; await launch();
  const initialCalls = requests.length; send('initial input above hard capacity\r');
  await until(() => ready() && journal().events.at(-1)?.reason === 'blocking_limit', 'initial capacity terminal result');
  pass('fresh input above capacity finishes without a summary request', requests.length === initialCalls);
  pressure = 100; await turn('seed capacity-summary recovery');
  pressure = 981_000; summaryPressure = 980_700;
  const beforeSummaryLimit = requests.length; send('summary still above hard capacity\r');
  await until(() => ready() && journal().events.at(-1)?.reason === 'blocking_limit', 'oversized summary terminal result');
  pass('oversized automatic summary ends the blocked turn without a normal completion', requests.length === beforeSummaryLimit + 1
    && requests.at(-1).summary && screen().includes('Prompt is too long'));
  summaryPressure = 100; send('/compact\r');
  await until(() => requests.length === beforeSummaryLimit + 2 && ready(), 'oversized summary manual recovery');
  await turn('task after oversized summary recovery');
  pass('manual compact and the next task work after an oversized automatic summary'); await stop();
  const files = fs.readdirSync(path.join(workspace, '.agent'));
  pass('every owned CLI exits zero and releases its session lock', children.every(current => current.child.exitCode === 0)
    && !files.some(file => file.endsWith('.jsonl.lock')));
  pass('the fixture observed actual token-count requests', counts.length > 0 && counts.every(row => row.path.includes('count_tokens')));
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    requests: requests.map(row => ({ summary: row.summary, model: row.body.model, messages: row.body.messages.length })), counts,
    identity: identity.sha256, inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256 }, null, 2));
  console.log(`RESULT ${checks.length} checks; ${temporary}; identity ${identity.sha256}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  if (held) held.destroy();
  for (const current of children) if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
