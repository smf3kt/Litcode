import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'acorn';
import ts from 'typescript';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const source = file => {
  const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
  assert.equal(sha(bytes), manifest.modules.find(row => row.path === file).decodedSha256);
  return bytes.toString('utf8');
};
const main = source('chunk-24k7d6mw.js'), native = source('chunk-06azbynj.js');
const canonical = value => JSON.parse(JSON.stringify(value, (key, item) => ['start', 'end', 'raw'].includes(key) ? undefined : item));
const ast = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body;
for (const [file, bodies] of [
  ['src/tui-background-click-source.ts', [main.slice(740694, 741175)]],
  ['src/tui-hover-source.ts', [native.slice(206301, 206455), native.slice(251135, 251446), native.slice(251879, 252369)]],
]) {
  const target = fs.readFileSync(path.join(root, file), 'utf8');
  for (const body of bodies) assert.ok(target.includes(body), file + ' exact body');
  const compiled = ts.transpileModule(target, { compilerOptions: {
    target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  } }).outputText;
  assert.deepEqual(canonical(ast(compiled).filter(node => node.type !== 'ImportDeclaration'
    && node.type !== 'ExportNamedDeclaration')), canonical(ast(bodies.join('\n'))));
}
assert.equal(main.slice(786385, 786417), 'Ks=hn?ee.openBashesDialog:void 0');
assert.equal(main.slice(1487552, 1487705), 'openBashesDialog=(h)=>{this.#d(h??!0)};closeBashesDialog=()=>{this.#d(!1)};#d(h){if(h===this.#n.bashesDialog)return;this.#i({...this.#n,bashesDialog:h})}');
assert.equal(source('chunk-1r9zp6s1.js').slice(2581, 2622), 'function Mi(){return HT()==="fullscreen"}');
console.log('PASS module identities and four exact copied source spans match their ASTs');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w290-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
  watchConfig: false, prefersReducedMotion: true }));
const worker = path.join(temporary, 'worker.mjs');
fs.writeFileSync(worker, "import fs from 'node:fs';\nfs.writeFileSync(process.argv[2],String(process.pid));\nconst timer=setInterval(()=>{if(fs.existsSync(process.argv[3])){clearInterval(timer);process.exit(0);}},20);\n");
const quote = text => "'" + text.replaceAll("'", "'\\''") + "'";
const jobs = new Map(), holds = new Map(), requests = [], checks = [], captures = {}, processes = [];
let active, serial = 0, formAnswer, formResponse;
const formServer = http.createServer(async (request, response) => {
  if (request.method === 'DELETE') { response.writeHead(204).end(); return; }
  if (request.method !== 'POST') { response.writeHead(405).end(); return; }
  let bytes = ''; for await (const chunk of request) bytes += chunk;
  const rpc = JSON.parse(bytes);
  const answer = result => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
  };
  if (rpc.method === 'initialize') answer({ protocolVersion: '2025-06-18', capabilities: { tools: {} },
    serverInfo: { name: 'owned-background-form', version: '1' } });
  else if (rpc.method === 'tools/list') answer({ tools: [{ name: 'choose', description: 'Choose a local label',
    inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } }] });
  else if (rpc.method === 'tools/call') {
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 'background-form', method: 'elicitation/create',
      params: { message: 'Choose a local label', requestedSchema: { type: 'object',
        properties: { label: { type: 'string' } }, required: ['label'] } } })}\n\n`);
    formResponse = { response, id: rpc.id };
  } else if (rpc.id === 'background-form') {
    formAnswer = rpc.result; response.writeHead(202).end();
    formResponse.response.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: formResponse.id,
      result: { content: [{ type: 'text', text: 'local form answered' }] } })}\n\n`);
  } else response.writeHead(202).end();
});
await new Promise(resolve => formServer.listen(0, '127.0.0.1', resolve));
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
  watchConfig: false, prefersReducedMotion: true, mcpClient: { elicitation: true },
  mcpServers: { fixture: { type: 'http', url: `http://127.0.0.1:${formServer.address().port}/mcp` } } }));
function reply(response, text = 'W290 fixture done') {
  emit(response, { type: 'text', text: '' }, text, 'end_turn');
}
function emit(response, block, content, stop, json = false) {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: `w290-${++serial}`, type: 'message', role: 'assistant',
    model: 'fixture-model', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: block });
  send('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: json ? { type: 'input_json_delta', partial_json: JSON.stringify(content) } : { type: 'text_delta', text: content } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' }); response.end();
}
const server = http.createServer(async (request, response) => {
  let bytes = ''; for await (const chunk of request) bytes += chunk;
  const body = JSON.parse(bytes); requests.push(body);
  const content = body.messages.at(-1)?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content)
    ? content.filter(block => block.type === 'text').map(block => block.text).join('\n') : '';
  const start = /^W290_START_(\w+)$/.exec(text);
  if (start) {
    const id = start[1], pidFile = path.join(workspace, `${id}.pid`), release = path.join(workspace, `${id}.release`);
    jobs.set(id, { pidFile, release });
    const input = { command: `exec ${quote(process.execPath)} ${quote(worker)} ${quote(pidFile)} ${quote(release)}`,
      description: `W290 ${id}`, timeout_ms: 120_000 };
    emit(response, { type: 'tool_use', id: 'start-' + id, name: 'run_background', input: {} }, input, 'tool_use', true);
  } else if (/^W290_(HOLD|QUESTION|FORM)$/.test(text)) {
    const held = { response, aborted: false };
    response.on('close', () => { if (!response.writableEnded) held.aborted = true; });
    holds.set(text, held);
  } else reply(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-w290-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const frame = () => active.screen.lines().join('\n');
const footer = () => active.screen.lines().at(-1) ?? '';
const send = text => active.child.stdin.write(text);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const pid = job => fs.existsSync(job.pidFile) ? Number(fs.readFileSync(job.pidFile, 'utf8')) : undefined;
async function until(predicate, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (active.child.exitCode !== null || Date.now() > deadline) throw new Error(`${label}\n${active.stderr}\n${frame()}`);
    await delay(25);
  }
}
function pass(label, value = true) {
  assert.ok(value, label + '\n' + frame()); checks.push(label); captures[label] = frame(); console.log('PASS ' + label);
}
function pointer(button, column, row, end = 'M') { send(`\x1b[<${button};${column};${row}${end}`); }
function taskColumn(label) { const value = footer().indexOf(label); assert.ok(value >= 0, footer()); return value + 1; }
async function launch(columns = 160) {
  const rows = 30, screen = new TerminalScreen(columns, rows), decoder = new StringDecoder('utf8');
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w290-background-footer-click.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive',
    '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'], { cwd: root,
    env: { ...env, W290_ROWS: String(rows), W290_COLUMNS: String(columns) }, stdio: ['pipe', 'pipe', 'pipe'] });
  active = { child, screen, rows, columns, stderr: '', exited: new Promise(resolve => child.once('close', resolve)) };
  const current = active; processes.push(current);
  child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { current.stderr += chunk.toString('utf8'); });
  await until(() => frame().includes('Welcome to LiTcode') && /^❯\s*$/mu.test(frame()), 'startup composer');
}
async function start(id, label) {
  send(`W290_START_${id}\r`);
  await until(() => jobs.has(id) && pid(jobs.get(id)) !== undefined && alive(pid(jobs.get(id)))
    && footer().includes(label) && !footer().includes('running') && /^❯\s*$/mu.test(frame()), 'background worker ' + id);
  return jobs.get(id);
}
async function open(label) {
  const column = taskColumn(label); pointer(0, column, 30); pointer(0, column, 30, 'm');
  await until(() => /^Background$/mu.test(frame()), 'native footer opens Background');
}
async function close() { send('\x03'); await until(() => /^❯/mu.test(frame()) && !/^Background$/mu.test(frame()), 'close Background'); }
async function clear() { send('\x15'); await until(() => /^❯\s*$/mu.test(frame()), 'clear draft'); }
async function exit() {
  send('/exit\r'); assert.equal(await Promise.race([active.exited, delay(8000).then(() => 'timeout')]), 0, active.stderr);
}
try {
  await launch();
  const first = await start('first', '1 shell');
  send('retained click draft'); await until(() => frame().includes('❯ retained click draft'), 'draft');
  const column = taskColumn('1 shell');
  pointer(35, column, 30); await until(() => Boolean(active.screen.cell(column - 1, 29).isInverse()), 'native hover');
  pass('the task label receives native hover inverse');
  pointer(0, column, 30); await delay(75);
  pass('left press leaves the composer active', frame().includes('❯ retained click draft'));
  pointer(0, column, 30, 'm'); await until(() => /^Background$/mu.test(frame()), 'release opens');
  pass('left release opens the live Background list', frame().includes('1 active shell'));
  await close(); pass('cancel restores the exact draft', frame().includes('❯ retained click draft'));
  pointer(0, column, 30); pointer(32, column + 2, 30); pointer(0, column + 2, 30, 'm'); await delay(75);
  pass('a drag leaves the task running and the composer open', !/^Background$/mu.test(frame()) && alive(pid(first)));
  await clear();
  send('W290_HOLD\r'); await until(() => holds.has('W290_HOLD') && footer().includes('running'), 'held main request');
  send('draft during request'); await until(() => frame().includes('❯ draft during request'), 'held draft');
  await open('1 shell'); await close();
  pass('opening and cancelling during a request preserves the provider stream', !holds.get('W290_HOLD').aborted);
  await open('1 shell'); send('x');
  await until(() => frame().includes('No tasks currently running') && !alive(pid(first)), 'stop owned shell');
  pass('x stops the owned shell while the main request remains live', !holds.get('W290_HOLD').aborted);
  await close(); pass('stop and cancel retain the draft', frame().includes('❯ draft during request'));
  reply(holds.get('W290_HOLD').response, 'W290 held request finished');
  await until(() => frame().includes('W290 held request finished') && !footer().includes('running'), 'main request resumed');
  pass('the original request completes after the panel closes'); await clear();
  const natural = await start('natural', '1 shell'); await open('1 shell');
  fs.writeFileSync(natural.release, 'done');
  await until(() => frame().includes('No tasks currently running') && !alive(pid(natural)), 'live natural completion');
  pass('natural task completion updates an open panel without input'); await close();
  const question = await start('question', '1 shell');
  send('W290_QUESTION\r'); await until(() => holds.has('W290_QUESTION') && footer().includes('running'), 'held question request');
  send('question draft'); await open('1 shell');
  emit(holds.get('W290_QUESTION').response, { type: 'tool_use', id: 'question-owner', name: 'ask_user_question', input: {} },
    { questions: [{ question: 'Choose the local fixture result', header: 'Fixture', multiSelect: false,
      options: [{ label: 'First', description: 'First local result' }, { label: 'Second', description: 'Second local result' }] }] }, 'tool_use', true);
  await until(() => frame().includes('Choose the local fixture result') && !/^Background$/mu.test(frame()), 'question owns input');
  pass('a model question takes input from the Background panel without collision', !frame().includes('Another interaction'));
  send('\r'); await delay(75); send('\r');
  await until(() => /^❯/mu.test(frame()) && !footer().includes('running'), 'question complete');
  pass('question completion restores the parent draft', frame().includes('❯ question draft'));
  await open('1 shell'); send('x');
  await until(() => frame().includes('No tasks currently running') && !alive(pid(question)), 'question worker stopped');
  await close(); await clear();
  const formJob = await start('form', '1 shell');
  send('W290_FORM\r'); await until(() => holds.has('W290_FORM') && footer().includes('running'), 'held form request');
  send('form draft'); await open('1 shell');
  emit(holds.get('W290_FORM').response, { type: 'tool_use', id: 'mcp-form-owner', name: 'mcp__fixture__choose', input: {} },
    {}, 'tool_use', true);
  await until(() => frame().includes('MCP form from fixture') && !/^Background$/mu.test(frame()), 'form takes input');
  pass('MCP elicitation takes input from Background before admission');
  send('{"label":"chosen"}\r');
  await until(() => formAnswer !== undefined && /^❯/mu.test(frame()) && !footer().includes('running'), 'form completed');
  assert.deepEqual(formAnswer, { action: 'accept', content: { label: 'chosen' } });
  pass('the MCP form returns its exact accepted result and keeps the draft', frame().includes('❯ form draft'));
  await open('1 shell'); send('x');
  await until(() => frame().includes('No tasks currently running') && !alive(pid(formJob)), 'form worker stopped');
  await close(); await clear(); await exit();
  pass('wide CLI exits zero');
  await launch(80); const narrow = await start('narrow', '1 shell'); await open('1 shell');
  pass('80 columns keeps the native footer click reachable', frame().includes('1 active shell'));
  send('x'); await until(() => frame().includes('No tasks currently running') && !alive(pid(narrow)), 'narrow stopped');
  await close(); await exit();
  pass('all compiled processes exit zero', processes.every(process => process.child.exitCode === 0));
  pass('all owned task processes have exited', [...jobs.values()].every(job => !alive(pid(job))));
  const journalDir = path.join(workspace, '.agent'), files = fs.readdirSync(journalDir, { recursive: true });
  pass('session and input-history locks are released', !files.some(file => String(file).endsWith('.lock')));
  pass('journals omit the fixture credential', files.filter(file => String(file).endsWith('.jsonl'))
    .every(file => !fs.readFileSync(path.join(journalDir, file), 'utf8').includes(env.LLM_API_KEY)));
  const identity = captureIdentity(root);
  fs.writeFileSync(process.env.W290_RESULT ?? path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    identity: identity.sha256, inputs: identity.inputs.sha256, validation: identity.validation.sha256,
    build: identity.build.sha256, requests: requests.length, paidUpstreamCalls: 0, temporary }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  for (const held of holds.values()) if (!held.response.writableEnded) held.response.destroy();
  for (const current of processes) {
    if (current.child.exitCode === null && current.child.signalCode === null) {
      current.child.stdin.write('\x03'); await delay(75); current.child.stdin.write('\x15/exit\r');
      if (await Promise.race([current.exited, delay(3000).then(() => 'timeout')]) === 'timeout') current.child.kill('SIGKILL');
    }
    current.screen.close();
  }
  for (const job of jobs.values()) {
    const value = pid(job);
    if (value !== undefined && alive(value)) { try { process.kill(-value, 'SIGKILL'); } catch { try { process.kill(value, 'SIGKILL'); } catch {} } }
  }
  formServer.closeAllConnections(); await new Promise(resolve => formServer.close(resolve));
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
