import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

// W305: the mid-conversation switch confirmation, the pinned max-effort row and the recovered
// switch notice. The fixture streams a turn, waits past the 1-hour cache lifetime is not
// practical, so the cache clock is driven through LLM_PROMPT_CACHE plus a stamped turn end: the
// gate needs `promptCaching` on and a `turn_end` older than the lifetime. The driver therefore
// seeds a journal whose last turn ended before the TTL and resumes it.

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w305-cli-')));
const workspace = path.join(temporary, 'workspace'), home = path.join(temporary, 'home');
fs.mkdirSync(workspace); fs.mkdirSync(home);
fs.mkdirSync(path.join(workspace, '.agent'));
// A resumed session locks `--user-dir` and `--permission-mode`, so the fixture owns HOME and
// the seeded config carries the mode instead.
fs.mkdirSync(path.join(home, '.harness'));
fs.writeFileSync(path.join(home, '.harness', 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false }));
fs.writeFileSync(path.join(workspace, 'note.txt'), 'fixture note\n');

const requests = [], checks = [], gates = [];
let active;
const nextGate = () => { let release; const gate = new Promise(resolve => { release = resolve; });
  gates.push(gate); return { gate, release }; };
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
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', async () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { /* the client reports it */ }
    requests.push(body);
    const index = requests.length;
    if (index % 2 === 1) {
      await gates[Math.floor(index / 2)];
      streamed(response, { id: `msg_tool_${index}`, stopReason: 'tool_use', json: true,
        block: { start: { type: 'tool_use', id: `toolu_w305_${index}`, name: 'read_file', input: {} },
          text: JSON.stringify({ path: 'note.txt' }) } });
      return;
    }
    streamed(response, { id: `msg_done_${index}`, stopReason: 'end_turn',
      block: { start: { type: 'text', text: '' }, text: `finished ${index}` } });
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
const env = { ...process.env, HOME: home, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: baseURL, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate',
  LLM_PROMPT_CACHE: 'true', LITCODE_MAX_EFFORT_REMINDER: '1' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_KB_COHESION_FIXES'].includes(key)) delete env[key];

// A journal whose last turn ended two hours ago: the cache is cold, and one response carries
// output tokens so the acknowledgement comparison has a value to differ from. The session is
// written through the built Session with the runtime's own pinned tool schemas, so the stored
// fingerprint matches what the resumed process rebuilds.
const { Session } = await import('../dist/session.js');
const { createRuntime, pinToolSchemas } = await import('../dist/runtime.js');
const base = { model: 'fixture', workspace, system: '', allowShell: true, maxOutputBytes: 65536,
  maxTokens: 4096, contextTokens: 200000, compactAt: 150000, maxTurns: 10, thinking: false,
  permissions: { mode: 'bypass', allow: [], deny: [] },
  gateway: { baseURL, auth: 'bearer', tokenCounting: 'estimate', promptCaching: true, eagerToolInput: false } };
const seeder = await createRuntime({ ...base, tools: [] }, { count: async () => 0,
  complete: async () => { throw new Error('unused'); } }, new AbortController().signal);
const config = { ...base, tools: pinToolSchemas(seeder.tools),
  configSources: { userDir: path.join(home, '.harness') } };
const oldStamp = new Date(Date.now() - 2 * 3_600_000).toISOString();
const seededSession = Session.open(workspace, { config });
const seeded = seededSession.id;
seededSession.append({ kind: 'message', message: { role: 'user', content: 'earlier question' } });
seededSession.append({ kind: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'earlier answer' }] },
  response: { id: 'msg_seed', type: 'message', role: 'assistant', model: 'fixture',
    content: [{ type: 'text', text: 'earlier answer' }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 40 } } });
seededSession.append({ kind: 'turn_end', reason: 'end_turn',
  duration: { uuid: randomUUID(), durationMs: 5, timestamp: oldStamp } });
seededSession.close();
await seeder.close();

const screen = () => {
  const terminal = new TerminalScreen(160, 30); terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const text = terminal.lines().join('\n'); terminal.close(); return text;
};
const ready = () => screen().includes('· ready');
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

const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w245-model-typed.exp'), process.execPath,
  path.join(root, 'bin/litcode.mjs'), '--workspace', workspace, '--interactive',
  '--no-inherit-gateway', '--resume', seeded],
  { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
active = { child, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
child.stdout.on('data', chunk => active.chunks.push(chunk));
child.stderr.on('data', chunk => active.chunks.push(chunk));

try {
  await until(ready, 'startup ready', 25000);
  pass('the resumed session starts ready');
  const firstGate = nextGate();
  send('hold one\r');
  await until(() => requests.length === 1, 'the first turn reaches the provider');
  pass('the first turn starts on the seeded model', requests[0].model === 'fixture');
  // The cache is cold and the seeded turn produced tokens, so a family change asks first.
  send('/model second-model\r');
  await until(() => screen().includes('Switch model?'), 'the cache-miss confirmation opens');
  pass('a cold cache and a different family ask before switching');
  pass('the confirmation names the target model', screen().includes('Yes, switch to second-model'));
  pass('the confirmation carries the cache warning', screen().includes('Your next response will be slower and use more tokens'));
  send('\u001b'); await delay(250);
  await until(() => screen().includes('Kept model as fixture'), 'cancel keeps the model');
  pass('cancelling leaves the model and says so');
  pass('the cancelled switch never reaches the provider', requests.length === 1);

  send('/model second-model\r');
  await until(() => screen().includes('Switch model?'), 'the confirmation reopens');
  send('\r'); await delay(200);
  await until(() => screen().includes('Set model to second-model'), 'accept applies the switch');
  pass('confirming applies the switch with the recovered notice');
  pass('the saved switch names the default write', screen().includes('and saved as your default for new sessions'));
  // The acknowledged token count moved, so the same model change no longer asks.
  send('/model second-model\r'); await delay(400);
  pass('an acknowledged switch does not ask again', !screen().includes('Switch model?'));
  firstGate.release();
  await until(() => requests.length === 2, 'the turn continues');
  pass('the running turn continues on the switched model', requests[1].model === 'second-model');
  await until(() => screen().includes('finished 2'), 'first turn end');

  // The max-effort pinned row appears once the session sits at `max` with the reminder on.
  send('/effort max\r');
  await until(() => screen().includes('Set effort level to max'), 'the level applies');
  await until(() => screen().includes('Max effort ·'), 'the pinned max-effort row is drawn');
  pass('max effort pins its reminder row');
  pass('the row points at /effort', screen().includes('/effort to change'));

  send('\u0015'); await delay(100);
  send('/exit\r');
  const status = await Promise.race([active.closed, delay(6000).then(() => 'timeout')]);
  pass('the CLI exits zero', status === 0);
  console.log(`IDENTITY ${captureIdentity(root).sha256}`);
  console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  if (child.exitCode === null) child.kill('SIGKILL');
  server.close();
  fs.rmSync(temporary, { recursive: true, force: true });
}
