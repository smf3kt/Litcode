import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'resident-fork-cli-')));
const userDir = path.join(temporary, 'user');
const workspace = path.join(temporary, 'workspace');
const runtimeDir = fs.realpathSync(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'rf-')));
const requests = [];
const mcpMethods = [];
const children = [];
const workers = new Set();
const heldResponses = new Set();
let address;

function sse(response, blocks) {
  const events = [
    ['message_start', { type: 'message_start', message: { id: 'resident', type: 'message', role: 'assistant',
      model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 } } }],
    ...blocks.flatMap((block, index) => block.type === 'tool_use'
      ? [['content_block_start', { type: 'content_block_start', index, content_block: { ...block, input: {} } }],
        ['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } }],
        ['content_block_stop', { type: 'content_block_stop', index }]]
      : [['content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }],
        ['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } }],
        ['content_block_stop', { type: 'content_block_stop', index }]]),
    ['message_delta', { type: 'message_delta', delta: { stop_reason: blocks.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
    ['message_stop', { type: 'message_stop' }],
  ];
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));
}
const server = http.createServer((request, response) => {
  if (request.url === '/mcp' && (request.method === 'GET' || request.method === 'DELETE')) {
    response.writeHead(request.method === 'GET' ? 405 : 204).end(); return;
  }
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (request.url === '/mcp') {
      mcpMethods.push(body.method);
      if (body.id === undefined) { response.writeHead(202).end(); return; }
      const result = body.method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: { tools: {} } }
        : body.method === 'tools/list' ? { tools: [{ name: 'ping', description: 'Owned resident fixture',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false } }] } : {};
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result })); return;
    }
    requests.push(body);
    const last = body.messages.at(-1);
    const text = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '');
    if (text.startsWith('SEND ')) {
      sse(response, [{ type: 'tool_use', id: `send-${requests.length}`, name: 'send_peer_message',
        input: { address, message: text.slice(5), wait_ms: 0 } }]);
    } else if (last?.role === 'user' && text.includes('CANCEL_RESIDENT')) {
      heldResponses.add(response); response.on('close', () => heldResponses.delete(response));
    } else if (last?.role === 'user' && text.includes('AFTER_PARENT_EXIT')) {
      sse(response, [{ type: 'tool_use', id: 'resident-write', name: 'write_file',
        input: { path: 'resident-effect.txt', content: 'one committed effect\n' } }]);
    } else sse(response, [{ type: 'text', text: 'RESIDENT_REPLY' }]);
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
fs.mkdirSync(userDir); fs.mkdirSync(workspace);
fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false,
  promptSuggestionEnabled: false, features: { residentForks: true, crossSessionMessaging: true },
  mcpServers: { owned: { type: 'http', url: `http://127.0.0.1:${server.address().port}/mcp` } } }));
const env = { ...process.env, HOME: temporary, XDG_RUNTIME_DIR: runtimeDir,
  LLM_API_KEY: 'owned-fixture', LLM_MODEL: 'fixture', LLM_AUTH: 'bearer', LLM_THINKING: 'false',
  LLM_TOKEN_COUNTING: 'estimate', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}` };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_EFFORT', 'TMUX', 'STY', 'CLAUDE_CODE_DISABLE_AGENT_VIEW', 'IS_DEMO', 'CLAUDE_CODE_COORDINATOR_MODE'].includes(key)) delete env[key];
function start(extra = []) {
  const child = spawn(process.execPath, [path.join(root, 'bin/litcode.mjs'), '--workspace', workspace,
    '--user-dir', userDir, '--interactive', '--no-inherit-gateway', ...extra],
  { cwd: temporary, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const state = { child, text: '', exit: new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal }))) };
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { state.text = (state.text + chunk).slice(-100000); });
  children.push(state); return state;
}
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; await delay(30); }
  const directory = path.join(workspace, '.agent', 'background');
  const logs = fs.existsSync(directory) ? fs.readdirSync(directory).filter(n => n.endsWith('.log'))
    .map(n => `${n}\n${fs.readFileSync(path.join(directory, n), 'utf8').slice(-12000)}`).join('\n') : '';
  throw new Error(`${label}\n${children.map(c => c.text).join('\n')}\n${logs}\nrequests=${requests.length}`);
}
function records() {
  const directory = path.join(userDir, 'sessions');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(n => n.endsWith('.json')).flatMap(n => {
    try { return [{ ...JSON.parse(fs.readFileSync(path.join(directory, n), 'utf8')), pid: Number(n.split('-')[0]), file: path.join(directory, n) }]; }
    catch { return []; }
  });
}
function journal(id) {
  const text = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8');
  return text.slice(0, text.lastIndexOf('\n')).split('\n').filter(Boolean).map(line => JSON.parse(line));
}
async function stop(state) {
  state.child.stdin.write('/exit\n');
  assert.deepEqual(await Promise.race([state.exit, delay(8000).then(() => 'timeout')]), { code: 0, signal: null });
}
function live(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function terminate(pid) {
  assert.equal(Number.isSafeInteger(pid) && pid > 0, true);
  process.kill(pid, 'SIGTERM');
  await until(() => !records().some(r => r.pid === pid) && !live(pid), 'worker record and process removed');
  workers.delete(pid);
}
try {
  const parent = start();
  await until(() => parent.text.includes('Personal harness.'), 'parent ready');
  parent.child.stdin.write('PARENT_SEED\n');
  await until(() => parent.text.includes('finished: end_turn'), 'parent seed completed');
  const before = requests.length;
  parent.child.stdin.write('/fork\n');
  await until(() => /Log: (.+\.log)/.test(parent.text), 'fork row');
  const copy = /Log: (.+\.log)/.exec(parent.text)[1];
  const id = path.basename(copy, '.log');
  let record;
  await until(() => {
    record = records().find(r => r.sessionId === id && r.kind === 'bg');
    if (record) workers.add(record.pid);
    return record;
  }, 'resident copy discovered');
  address = `uds:${record.messagingSocketPath}`;
  const lock = path.join(workspace, '.agent', `${id}.jsonl.lock`);
  assert.equal(fs.existsSync(lock), true);
  await delay(200); assert.equal(requests.length, before, 'bare fork must wait without replay');
  await stop(parent);
  assert.equal(fs.existsSync(lock), true, 'parent exit leaves the resident owner alive');
  const sender = start();
  await until(() => sender.text.includes('Peer inbox:'), 'sender ready');
  sender.child.stdin.write('/peers\n');
  await until(() => sender.text.includes(address), 'sender discovers resident copy');
  sender.child.stdin.write('SEND AFTER_PARENT_EXIT\n');
  await until(() => fs.existsSync(path.join(workspace, 'resident-effect.txt'))
    && fs.readFileSync(copy, 'utf8').includes('event finished: end_turn'), 'resident effect and completed turn');
  assert.equal(fs.readFileSync(path.join(workspace, 'resident-effect.txt'), 'utf8'), 'one committed effect\n');
  assert.equal(journal(id).filter(r => r.kind === 'tool_start' && r.id === 'resident-write').length, 1);
  assert.equal(journal(id).filter(r => r.kind === 'message' && r.message.role === 'user'
    && JSON.stringify(r.message.content).includes('AFTER_PARENT_EXIT')).length, 1);
  await until(() => sender.text.includes('finished: end_turn'), 'sender tool turn completed');
  const completed = requests.length;
  await delay(200); assert.equal(requests.length, completed, 'resident settles back to waiting');
  sender.child.stdin.write('/fork INITIAL_RESIDENT_TASK\n');
  let prompted;
  await until(() => {
    prompted = records().find(r => r.kind === 'bg' && typeof r.sessionId === 'string' && r.sessionId !== id);
    if (prompted) workers.add(prompted.pid);
    return prompted;
  }, 'prompted resident discovered');
  const promptedLog = path.join(workspace, '.agent', 'background', `${prompted.sessionId}.log`);
  await until(() => fs.readFileSync(promptedLog, 'utf8').includes('finished: end_turn'), 'initial task completed');
  assert.equal(journal(prompted.sessionId).filter(r => r.kind === 'message' && r.message.role === 'user'
    && r.message.content === 'INITIAL_RESIDENT_TASK').length, 1);
  await terminate(prompted.pid);
  assert.equal(fs.existsSync(path.join(workspace, '.agent', `${prompted.sessionId}.jsonl.lock`)), false);
  sender.child.stdin.write('SEND CANCEL_RESIDENT\n');
  await until(() => heldResponses.size === 1, 'owned model request held');
  await terminate(record.pid);
  await until(() => heldResponses.size === 0, 'owned model request cancelled');
  assert.equal(fs.existsSync(lock), false);
  assert.equal(fs.existsSync(record.messagingSocketPath), false);
  await stop(sender);
  const origin = path.join(temporary, 'origin'), checkout = path.join(temporary, 'checkout');
  fs.mkdirSync(origin);
  const git = args => execFileSync('git', ['-C', origin, ...args], { env: { ...env, GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(temporary, 'gitconfig') }, stdio: 'pipe' });
  git(['init']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--allow-empty', '-m', 'fixture']);
  git(['worktree', 'add', '-b', 'resident-copy', checkout]);
  const relocatedParent = start(['--workspace', checkout]);
  await until(() => relocatedParent.text.includes('Peer inbox:'), 'worktree parent ready');
  relocatedParent.child.stdin.write('RELOCATION_SEED\n');
  await until(() => relocatedParent.text.includes('finished: end_turn'), 'worktree seed completed');
  relocatedParent.child.stdin.write('/fork\n');
  let relocated;
  await until(() => {
    relocated = records().find(r => r.kind === 'bg' && r.cwd === origin && typeof r.sessionId === 'string');
    if (relocated) workers.add(relocated.pid);
    return relocated && relocatedParent.text.includes('runs in the origin tree');
  }, 'resident starts in origin tree');
  const relocatedFile = path.join(origin, '.agent', `${relocated.sessionId}.jsonl`);
  assert.equal(fs.existsSync(`${relocatedFile}.lock`), true);
  assert.match(fs.readFileSync(relocatedFile, 'utf8'), /never edit files, run commands, or enter that worktree/);
  await stop(relocatedParent); await terminate(relocated.pid);
  assert.equal(fs.existsSync(`${relocatedFile}.lock`), false);
  assert.deepEqual(fs.readdirSync(path.join(userDir, 'sessions')).filter(n => /\.(json|key)$/.test(n)), []);
  assert.deepEqual(fs.readdirSync(path.join(runtimeDir, 'litcode-socks')), []);
  assert.ok(mcpMethods.filter(method => method === 'initialize').length >= 6);
  assert.ok(requests.every(request => request.tools.some(tool => tool.name === 'mcp__owned__ping')));
  console.log(JSON.stringify({ cli: 'passed', bareNoReplay: true, parentExit: true, effectOnce: true,
    promptedOnce: true, relocation: true, cancellation: true, ownedCleanup: true,
    connectedMcp: true, mcpRpc: mcpMethods.length, requests: requests.length, externalCalls: 0 }));
} finally {
  for (const record of records()) if (record.kind === 'bg') workers.add(record.pid);
  for (const pid of workers) { try { process.kill(pid, 'SIGTERM'); } catch {} }
  for (const state of children) if (state.child.exitCode === null && state.child.signalCode === null) state.child.kill('SIGTERM');
  await Promise.all(children.map(c => c.exit));
  for (const pid of workers) {
    for (let i = 0; i < 100; i++) {
      try { process.kill(pid, 0); } catch { break; }
      await delay(20);
      if (i === 99) { try { process.kill(pid, 'SIGKILL'); } catch {} }
    }
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.rmSync(runtimeDir, { recursive: true, force: true });
}
