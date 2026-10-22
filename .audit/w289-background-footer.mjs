import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
import { parse } from 'acorn';
import ts from 'typescript';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sources = new Map();
function source(file) {
  if (!sources.has(file)) {
    const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
    assert.equal(digest(bytes), manifest.modules.find(row => row.path === file).decodedSha256);
    sources.set(file, bytes.toString('utf8'));
  }
  return sources.get(file);
}
const y = source('chunk-y5d901dg.js'), j = source('chunk-j8hqhz0c.js');
const f = source('chunk-3qabb19b.js'), c = source('chunk-3cynezh1.js');
const copied = ['var ' + c.slice(65975, 65986) + ';', 'var ' + c.slice(65987, 65998) + ';',
  f.slice(673, 732), j.slice(16174, 16309), j.slice(16673, 16790), y.slice(759, 2376)].join('\n');
const target = fs.readFileSync(path.join(root, 'src/tui-background-label-source.ts'), 'utf8');
const canonical = value => JSON.parse(JSON.stringify(value, (key, item) =>
  ['start', 'end', 'raw'].includes(key) ? undefined : item));
const ast = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module' }).body;
const compiled = text => ts.transpileModule(text, { compilerOptions: {
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
const body = ast(compiled(target)).filter(node => node.type !== 'ExportNamedDeclaration'
  && !(node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'oae'));
assert.deepEqual(canonical(body), canonical(ast(copied)));
for (const slice of [f.slice(673, 732), j.slice(16174, 16309), j.slice(16673, 16790), y.slice(759, 2376)])
  assert.ok(target.includes(slice));
const recovered = Function('oae', copied + ';return {vyt,Vg,TAe}')( () => false );
const { backgroundFooterLabel } = await import('../dist/tui-background.js');
for (const jobs of [[], ['run'], ['monitor'], ['run', 'monitor'], ['websocket'], ['monitor', 'websocket']]) {
  for (const agents of [0, 1, 2]) {
    const tasks = jobs.map(kind => kind === 'websocket' ? { type: 'monitor_ws', status: 'running' }
      : { type: 'local_bash', kind, status: 'running' });
    tasks.push(...Array.from({ length: agents }, () => ({ type: 'local_agent', status: 'running' })));
    const snapshot = { jobs: jobs.map((kind, id) => ({ id: String(id), kind: kind === 'websocket' ? 'monitor' : kind,
      state: 'running', command: '', description: '', ...(kind === 'websocket' ? { source: 'websocket' } : {}) })),
    agents: Array.from({ length: agents }, (_, id) => ({ id: String(id), status: 'running' })), crons: [] };
    assert.equal(backgroundFooterLabel(snapshot), tasks.length === 0 ? undefined : recovered.vyt(tasks, 0));
  }
}
assert.match(source('chunk-6zdc3jq1.js').slice(2939, 2963), /return!1/);
assert.match(source('chunk-3gz7s57c.js').slice(9765, 9819), /dA\(i4n\)&&u&&!l/);
assert.match(source('chunk-24k7d6mw.js').slice(768633, 768681), /js=Xn\?e\(pz/);
console.log('PASS source identities, copied AST and 18 compiled label cases match the isolated formatter');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w289-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-model', thinking: false,
  watchConfig: false, prefersReducedMotion: true }));
const worker = path.join(temporary, 'worker.mjs');
fs.writeFileSync(worker, `import fs from 'node:fs';\nfs.writeFileSync(process.argv[2],String(process.pid));\nconst timer=setInterval(()=>{if(fs.existsSync(process.argv[3])){clearInterval(timer);process.exit(0);}},20);\n`);
const quote = text => "'" + text.replaceAll("'", "'\\''") + "'";
const pidFiles = [], held = [], children = [], checks = [], captures = {}, requests = [];
const jobs = new Map();
let active, actionNumber = 0;
const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
await new Promise(resolve => wsServer.once('listening', resolve));
const emit = (response, block, text, stopReason, json = false) => {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const send = (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  send('message_start', { type: 'message_start', message: { id: `w289-${requests.length}`, type: 'message',
    role: 'assistant', model: 'fixture-model', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 0 } } });
  send('content_block_start', { type: 'content_block_start', index: 0, content_block: block });
  send('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: json ? { type: 'input_json_delta', partial_json: JSON.stringify(text) } : { type: 'text_delta', text } });
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 1 } });
  send('message_stop', { type: 'message_stop' }); response.end();
};
const textReply = response => emit(response, { type: 'text', text: '' }, 'W289 fixture done', 'end_turn');
const server = http.createServer(async (request, response) => {
  let bytes = ''; for await (const chunk of request) bytes += chunk;
  const body = JSON.parse(bytes); requests.push(body);
  const last = body.messages.at(-1)?.content;
  const lastText = typeof last === 'string' ? last : Array.isArray(last)
    ? last.filter(block => block.type === 'text').map(block => block.text).join('\n') : '';
  if (lastText === 'W289_CHILD') { held.push(response); return; }
  const match = /^W289_(SHELL|MONITOR|WEBSOCKET)_(\d+)$/.exec(lastText);
  if (!match) { textReply(response); return; }
  const [, kind, id] = match;
  const pidFile = path.join(workspace, `job-${id}.pid`), release = path.join(workspace, `release-${id}`);
  const command = `exec ${quote(process.execPath)} ${quote(worker)} ${quote(pidFile)} ${quote(release)}`;
  if (kind !== 'WEBSOCKET') pidFiles.push(pidFile);
  jobs.set(id, { kind, pidFile, release });
  const name = kind === 'SHELL' ? 'run_background' : 'monitor';
  const input = kind === 'WEBSOCKET'
    ? { ws: { url: `ws://127.0.0.1:${wsServer.address().port}` }, description: 'W289 WebSocket', timeout_ms: 120_000 }
    : { command, description: `W289 ${kind.toLowerCase()}`, timeout_ms: 120_000 };
  emit(response, { type: 'tool_use', id: `tool-w289-${id}`, name, input: {} }, input, 'tool_use', true);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-w289-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const frame = () => active.screen.lines().join('\n');
const footer = () => active.screen.lines().at(-1) ?? '';
const send = value => active.child.stdin.write(value);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const pid = file => fs.existsSync(file) ? Number(fs.readFileSync(file, 'utf8')) : undefined;
async function until(predicate, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (active.child.exitCode !== null || Date.now() > deadline) throw new Error(`${label}\n${active.stderr}\n${frame()}`);
    await delay(25);
  }
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${frame()}`); checks.push(label); captures[label] = frame(); console.log('PASS ' + label);
}
async function launch(columns = 160) {
  const rows = 30, screen = new TerminalScreen(columns, rows), decoder = new StringDecoder('utf8');
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w289-background-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive',
    '--no-inherit-gateway', '--permission-mode', 'bypass', '--allow-shell'], { cwd: root,
    env: { ...env, W289_ROWS: String(rows), W289_COLUMNS: String(columns) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, screen, stderr: '', columns, rows, exited: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { current.stderr += chunk.toString('utf8'); });
  active = current; children.push(current);
  await until(() => frame().includes('Welcome to LiTcode') && /^❯\s*$/mu.test(frame()), 'startup composer');
}
async function start(kind, label) {
  const id = String(++actionNumber), before = requests.length;
  send(`W289_${kind}_${id}\r`);
  await until(() => jobs.has(id) && requests.length >= before + 2
    && /^❯\s*$/mu.test(frame()) && !footer().includes('running'), 'tool turn completed');
  await until(() => footer().includes(label), 'live footer ' + label);
  const job = jobs.get(id);
  if (kind !== 'WEBSOCKET') await until(() => pid(job.pidFile) !== undefined && alive(pid(job.pidFile)), 'owned worker started');
  return job;
}
async function clearDraft() { send('\x15'); await until(() => /^❯\s*$/mu.test(frame()), 'empty composer'); }
async function stopAll(label) {
  send('\x18\x0b'); await until(() => frame().includes('again to stop background agents'), 'stop confirmation');
  send('\x18\x0b'); await until(() => !/\d+ (?:shell|monitor|local agent|background task)/.test(footer()), label);
}
async function exit() {
  send('/exit\r'); assert.equal(await Promise.race([active.exited, delay(8_000).then(() => 'timeout')]), 0, active.stderr);
}
try {
  await launch();
  pass('startup has no background execution indicator', !/\d+ (?:shell|monitor|agent)/.test(footer()));
  const shell = await start('SHELL', '1 shell');
  pass('a real background shell is visible while the composer is ready', footer().includes('ready'));
  const column = footer().indexOf('1 shell');
  pass('the task label uses the recovered background theme slot', active.screen.cell(column, 29).getFgColor() === 0x00cccc);
  send('retained draft'); await until(() => frame().includes('❯ retained draft'), 'retained draft');
  fs.writeFileSync(shell.release, 'finish');
  await until(() => !alive(pid(shell.pidFile)) && !footer().includes('1 shell'), 'natural shell completion');
  pass('natural completion clears the indicator without a keystroke', frame().includes('❯ retained draft'));
  await clearDraft();
  const monitor = await start('MONITOR', '1 monitor');
  pass('a shell monitor uses its monitor label');
  await start('WEBSOCKET', '2 background tasks');
  pass('a WebSocket plus a shell monitor remains a mixed task group');
  await stopAll('both monitors stopped');
  await until(() => !alive(pid(monitor.pidFile)) && wsServer.clients.size === 0, 'monitor resources released');
  pass('the confirmed kill chord clears tasks and releases process and socket');
  await until(() => footer().includes('ready'), 'stop notification settled');
  send('/subtask W289_CHILD\r'); await until(() => held.length === 1 && footer().includes('1 local agent'), 'child running');
  pass('a held local child is visible while the parent accepts input');
  send('child draft'); await until(() => frame().includes('❯ child draft'), 'child draft');
  textReply(held.pop());
  await until(() => !footer().includes('1 local agent'), 'child completion');
  pass('child completion clears its label and retains the parent draft', frame().includes('❯ child draft'));
  await clearDraft();
  const ownerJob = await start('SHELL', '1 shell');
  send('/tasks\r'); await until(() => /^Background$/m.test(frame()) && frame().includes('1 active shell'), 'existing tasks panel');
  pass('the existing tasks manager sees the same running shell');
  send('x'); await until(() => frame().includes('No tasks currently running') && !alive(pid(ownerJob.pidFile)), 'manager stop');
  pass('stopping in the manager removes the footer label', !footer().includes('1 shell'));
  send('\x1b'); await until(() => !/^Background$/m.test(frame()), 'manager closed');
  const handoffJob = await start('SHELL', '1 shell');
  send('/clear\r');
  await until(() => !alive(pid(handoffJob.pidFile)) && !footer().includes('1 shell') && /^❯\s*$/mu.test(frame()), 'session clear');
  pass('a successor session has no stale job count and releases its old process');
  await exit();
  pass('the wide CLI exits zero');
  for (const columns of [80, 40]) {
    await launch(columns);
    const narrow = await start('SHELL', '1 shell');
    pass(`${columns} columns retains the fixed task label`, footer().includes('1 shell') && footer().length <= columns);
    fs.writeFileSync(narrow.release, 'finish');
    await until(() => !alive(pid(narrow.pidFile)) && !footer().includes('1 shell'), 'narrow completion');
    pass(`${columns} columns clears the finished task`);
    await exit();
  }
  pass('all compiled CLI processes exit zero', children.every(current => current.child.exitCode === 0));
  pass('all owned background processes have exited', pidFiles.every(file => !alive(pid(file))));
  const journalDir = path.join(workspace, '.agent');
  const files = fs.readdirSync(journalDir, { recursive: true });
  pass('session and input-history locks are released', !files.some(file => String(file).endsWith('.lock')));
  pass('journals omit the fixture credential', files.filter(file => String(file).endsWith('.jsonl'))
    .every(file => !fs.readFileSync(path.join(journalDir, file), 'utf8').includes(env.LLM_API_KEY)));
  const identity = captureIdentity(root);
  fs.writeFileSync(process.env.W289_RESULT ?? path.join(temporary, 'result.json'), JSON.stringify({ checks, captures,
    identity: identity.sha256, inputs: identity.inputs.sha256, validation: identity.validation.sha256,
    build: identity.build.sha256, modelCalls: requests.length, provider: 'owned loopback SSE and WebSocket',
    paidUpstreamCalls: 0, temporary }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  for (const response of held) response.destroy();
  for (const socket of wsServer.clients) socket.terminate();
  for (const current of children) {
    if (current.child.exitCode === null && current.child.signalCode === null) {
      current.child.stdin.write('\x15/exit\r');
      const exited = await Promise.race([current.exited, delay(3_000).then(() => 'timeout')]);
      if (exited === 'timeout') current.child.kill('SIGKILL');
    }
    current.screen.close();
  }
  for (const file of pidFiles) {
    const value = pid(file);
    if (value !== undefined && alive(value)) { try { process.kill(-value, 'SIGKILL'); } catch { try { process.kill(value, 'SIGKILL'); } catch {} } }
  }
  await new Promise(resolve => wsServer.close(resolve));
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
