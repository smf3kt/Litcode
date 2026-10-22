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
const hash = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const source = new Map();
function moduleSource(file) {
  if (!source.has(file)) {
    const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
    assert.equal(hash(bytes), manifest.modules.find(row => row.path === file).decodedSha256);
    source.set(file, bytes.toString('utf8'));
  }
  return source.get(file);
}
const pieces = [
  ['chunk-ax7r0qj7.js', 3224, 3289],
  ['chunk-3cynezh1.js', 347360, 347523],
  ['chunk-n3ykh62m.js', 372823, 373983],
  ['chunk-n3ykh62m.js', 374016, 377371],
];
const target = fs.readFileSync(path.join(root, 'src/tui-editor-name-source.ts'), 'utf8');
const copied = pieces.map(([file, start, end]) => moduleSource(file).slice(start, end));
for (const body of copied) assert.ok(target.includes(body), 'the complete copied body stays exact');
const canonical = node => JSON.parse(JSON.stringify(node, (key, value) =>
  ['start', 'end', 'raw'].includes(key) ? undefined : value));
const targetAst = parse(ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext } }).outputText, { ecmaVersion: 'latest', sourceType: 'module' });
assert.deepEqual(canonical(targetAst.body.filter(node => !['ImportDeclaration', 'ExportNamedDeclaration'].includes(node.type))),
  canonical(parse(copied.join('\n'), { ecmaVersion: 'latest' }).body));
const { Gpe } = await import('../dist/plugin-chain-lodash-internals-source.js');
const { Ub } = await import('../dist/tui-editor-name-source.js');
const recoveredName = Function('d1', 'Gpe', copied.join('\n') + ';return Ub')(path.basename, Gpe);
for (const command of [undefined, '', 'code', 'code --wait', 'cursor', 'windsurf', 'antigravity',
  '/usr/bin/vi', '/usr/bin/vim', 'nano', 'start /wait notepad', 'intellij', 'androidstudio',
  '/tmp/my-editor', '🦉edit', 'édit', '👩‍💻editor']) assert.equal(Ub(command), recoveredName(command));
moduleSource('chunk-4bw62nzm.js');
assert.ok(fs.readFileSync(path.join(root, 'src/plugin-chain-lodash-internals-source.ts'), 'utf8')
  .includes('function vi(e){return e==null?"":Vt(e)}'));
const main = moduleSource('chunk-24k7d6mw.js');
const predicate = main.slice(481135, 481165), effect = main.slice(722518, 722821);
assert.equal(hash(predicate), '789fe9641600cf12bba416ab76cbc622672fc78759843205c1bce85f652667d1');
const editorSource = moduleSource('chunk-7tnkhv2k.js');
const editorTarget = fs.readFileSync(path.join(root, 'src/external-editor-source.ts'), 'utf8');
assert.ok(editorTarget.includes(editorSource.slice(2499, 2801)), 'the cached resolver class stays copied');
const launchStart = editorTarget.indexOf('async function Zie('), launchEnd = editorTarget.indexOf('async function $j(');
assert.equal(editorTarget.slice(launchStart, launchEnd).trim().replace('async function', 'function')
  .replaceAll('await I(', 'I('), editorSource.slice(3072, 3957));
assert.ok(editorTarget.includes('const hx=resolveEditor??(()=>resolver.resolve())'));
assert.equal(hash(effect), '85491d470c72712637ad1ed0a6c7f2b4ae8cefda8e8e35af17c5fd7a438164ec');
assert.equal(main.slice(864462, 864475), 'Mt=Re(ee,Ire)');
assert.match(moduleSource('chunk-7tnkhv2k.js').slice(2859, 2908), /function hx\(\)/);
assert.match(moduleSource('chunk-nh8hd3rr.js').slice(800, 1044), /description:o/);
assert.match(moduleSource('chunk-0qkpwgr4.js').slice(3890, 4537), /m=i\?" ":" to "/);
for (const eligible of [false, true]) {
  const calls = [];
  const jsx = (type, props) => ({ type, props });
  Function('Uo', 'yo', 'i', 'po', 'co', 'e', 'n', 'pt', 'Ub', `return (${effect})`)(eligible,
    '/usr/bin/vi', () => {}, notice => calls.push(notice), key => calls.push(key), jsx, 'text', 'hint', Ub)();
  if (!eligible) assert.deepEqual(calls, ['external-editor-hint']);
  else {
    assert.equal(calls[0].timeoutMs, 5000);
    assert.equal(calls[0].priority, 'immediate');
    assert.deepEqual(calls[0].jsx.props.children.props, { action: 'chat:externalEditor', context: 'Chat',
      fallback: 'ctrl+g', description: 'edit in Vim' });
  }
}
console.log('PASS exact module identities, copied closure AST, compiled names and isolated source hint branches');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w287-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', effort: 'high',
  thinking: false, prefersReducedMotion: true, watchConfig: false }));
const editorLog = path.join(temporary, 'editor.jsonl'), editorMode = path.join(temporary, 'editor-mode');
const editorModule = path.join(temporary, 'editor.mjs'), editor = path.join(temporary, 'vi');
fs.writeFileSync(editorMode, 'success');
fs.writeFileSync(editorModule, `import fs from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
const file=process.argv.at(-1), mode=fs.readFileSync(process.env.W287_EDITOR_MODE,'utf8');
const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});
const flags=execFileSync('/bin/stty',['-a'],{stdio:['inherit','pipe','pipe'],encoding:'utf8'}).split(/\\s+/);
fs.appendFileSync(process.env.W287_EDITOR_LOG,JSON.stringify({mode,file,pid:process.pid,parent:process.ppid,
descendant:descendant.pid,content:fs.readFileSync(file,'utf8'),fileMode:fs.statSync(file).mode&511,
directoryMode:fs.statSync(new URL('.', 'file://'+file)).mode&511,canonical:flags.includes('icanon'),
tty:process.stdin.isTTY===true,args:process.argv.slice(2)})+'\\n');
if(mode==='success')fs.writeFileSync(file,'edited by fixture\\n');
setTimeout(()=>process.exit(mode==='success'?0:7),350);
`);
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
fs.writeFileSync(editor, `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(editorModule)} "$@"\n`, { mode: 0o755 });
const checks = [], captures = {}, children = [], requests = [];
let active;
const server = http.createServer(async (request, response) => {
  let data = ''; for await (const chunk of request) data += chunk;
  const body = JSON.parse(data); requests.push(body);
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const emit = (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  emit('message_start', { type: 'message_start', message: { id: 'w287', type: 'message', role: 'assistant',
    model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
  emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  emit('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'editor fixture answered' } });
  emit('content_block_stop', { type: 'content_block_stop', index: 0 });
  emit('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
  emit('message_stop', { type: 'message_stop' }); response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8',
  VISUAL: editor, EDITOR: 'unused', W287_EDITOR_LOG: editorLog, W287_EDITOR_MODE: editorMode,
  LLM_API_KEY: 'owned-w287-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM',
    'CLAUDE_CODE_DISABLE_WORKFLOWS'].includes(key)) delete env[key];
const frame = () => active.screen.lines().join('\n');
const footer = () => active.screen.lines().at(-1) ?? '';
const send = text => active.child.stdin.write(text);
const hint = 'ctrl+x ctrl+e to edit in Vim';
const calls = () => fs.existsSync(editorLog) ? fs.readFileSync(editorLog, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
async function until(predicate, label, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (active.child.exitCode !== null || Date.now() > deadline) throw new Error(`${label}\n${active.stderr}\n${frame()}`);
    await delay(20);
  }
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${frame()}`); checks.push(label); console.log('PASS ' + label);
}
async function launch(columns = 120) {
  const rows = 30, screen = new TerminalScreen(columns, rows), decoder = new StringDecoder('utf8');
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w287-external-editor-hint.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
    '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root,
    env: { ...env, W287_COLUMNS: String(columns), W287_ROWS: String(rows) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, screen, rows, columns, raw: '', stderr: '', exited: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => { const text = decoder.write(chunk); current.raw += text; screen.write(text); });
  child.stderr.on('data', chunk => { current.stderr += chunk.toString('utf8'); });
  children.push(current); active = current;
  await until(() => footer().includes('ready'), 'startup ready');
}
async function stop() {
  send('\x15/exit\r');
  assert.equal(await Promise.race([active.exited, delay(8_000).then(() => 'timeout')]), 0, active.stderr);
}
function processGone(pid) {
  try { process.kill(pid, 0); return false; } catch (error) { if (error.code === 'ESRCH') return true; throw error; }
}
async function edit(mode, expected, draftBefore) {
  fs.writeFileSync(editorMode, mode);
  const count = calls().length, rawStart = active.raw.length;
  send('\x18\x05');
  await until(() => calls().length === count + 1, mode + ' editor started');
  const observed = calls().at(-1);
  pass(mode + ' editor receives the exact draft through a private file', observed.content === draftBefore
    && observed.fileMode === 0o600 && observed.directoryMode === 0o700);
  pass(mode + ' handoff releases raw mode and alternate screen', observed.tty && observed.canonical
    && active.raw.slice(rawStart).includes('\x1b[?1049l'));
  await until(() => active.raw.slice(rawStart).lastIndexOf('\x1b[?1049h')
    > active.raw.slice(rawStart).lastIndexOf('\x1b[?1049l') && footer().includes('ready') && frame().includes(expected), mode + ' editor returned');
  pass(mode + ' return waits for the launcher and inherited-stdio descendant', processGone(observed.pid) && processGone(observed.descendant));
  pass(mode + ' return removes the temporary file and its private directory', !fs.existsSync(observed.file)
    && !fs.existsSync(path.dirname(observed.file)));
  return observed;
}
try {
  await launch();
  pass('the empty composer has no editor hint', !footer().includes('edit in'));
  send('retained\x13first\x1b[13;2usecond');
  await until(() => footer().endsWith(hint + ' · › stashed'), 'multiline editor hint beside stash');
  const started = Date.now();
  pass('a real newline raises the resolved editor chord ahead of effort', !footer().includes('/effort'));
  pass('the editor hint uses the inactive foreground', active.screen.cell(footer().indexOf('ctrl+x'), 29).getFgColor() === 0x999999);
  captures.multiline = frame();
  await delay(3_500); send(' more');
  await until(() => !footer().includes('edit in'), 'unchanged multiline dependency expires', 2_000);
  pass('multiline edits retain the original five-second deadline', Date.now() - started >= 4_850 && footer().includes('/effort'));
  send(' still'); await delay(80);
  pass('an expired multiline value stays expired after another edit', !footer().includes('edit in'));
  send('\x03first\x1b[13;2usecond');
  await until(() => footer().endsWith(hint + ' · › stashed'), 'newline transition rearms');
  pass('single-line reset and a new newline rearm the hint');
  send('\x12'); await until(() => frame().includes('Search prompts'), 'search screen');
  pass('history search hides the chat hint', !footer().includes('edit in'));
  send('\x03'); await until(() => footer().endsWith(hint + ' · › stashed'), 'return from search');
  pass('returning from search preserves the same active hint');
  await edit('success', 'edited by fixture', 'first\nsecond');
  pass('editor replacement removes its last newline and clears the hint', !footer().includes('edit in'));
  captures.edited = frame();
  send('\x03failure\x1b[13;2uunchanged');
  await until(() => footer().endsWith(hint + ' · › stashed'), 'failure draft hint');
  await edit('failure', 'unchanged', 'failure\nunchanged');
  pass('failed editor preserves the multiline draft', frame().includes('failure') && frame().includes('unchanged'));
  send('\r'); await until(() => frame().includes('editor fixture answered') && frame().includes('retained'), 'submit after editor failure');
  const userMessage = requests[0]?.messages.filter(message => message.role === 'user').at(-1);
  pass('restored raw input submits the exact draft without hint text', userMessage?.content === 'failure\nunchanged');
  pass('submit restores the waiting stash and clears its marker', !footer().includes('stashed'));
  send('\x03'); await stop();
  await launch(40);
  send('x'.repeat(60)); await until(() => frame().includes('xxxxxxxxxx'), 'visual wrap');
  pass('narrow visual wrapping leaves the editor hint absent', !footer().includes('edit in'));
  send('\x03first\x1b[13;2usecond'); await until(() => footer().includes('ctrl+x ctrl+e'), 'narrow hint');
  pass('the 40-column notification truncates inside its footer row', footer().length <= 40 && !active.screen.lines().slice(0, -1).some(row => row.includes('to edit in')));
  captures.narrow = frame(); send('\x03'); await stop();
  pass('both compiled CLI processes exit zero', children.every(current => current.child.exitCode === 0));
  pass('UI actions and editor handoffs add no model requests', requests.length === 1);
  const files = fs.readdirSync(path.join(workspace, '.agent'));
  pass('history and session locks are released', !fs.existsSync(path.join(user, 'history.jsonl.lock')) && !files.some(file => file.endsWith('.lock')));
  for (const file of files.filter(name => name.endsWith('.jsonl')))
    assert.ok(!fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').includes(env.LLM_API_KEY));
  pass('journals omit the fixture credential');
  const identity = captureIdentity(root);
  const result = { checks, captures, identity: identity.sha256, inputs: identity.inputs.sha256,
    validation: identity.validation.sha256, build: identity.build.sha256,
    sourceRanges: pieces.map(([module, start, end]) => ({ module, start, end, sha256: hash(moduleSource(module).slice(start, end)), coordinates: 'UTF-16' })),
    sourceEffect: hash(effect), provider: 'owned loopback SSE', modelCalls: requests.length, paidUpstreamCalls: 0 };
  if (process.env.W287_RESULT) fs.writeFileSync(process.env.W287_RESULT, JSON.stringify(result, null, 2) + '\n');
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}`);
} finally {
  for (const current of children) {
    if (current.child.exitCode === null) {
      current.child.stdin.write('\x03/exit\r'); await Promise.race([current.exited, delay(2_000)]);
      if (current.child.exitCode === null) { current.child.kill('SIGKILL'); await current.exited; }
    }
    current.screen.close();
  }
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
