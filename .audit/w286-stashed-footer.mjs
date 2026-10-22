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
const sha256 = data => createHash('sha256').update(data).digest('hex');
const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules/chunk-24k7d6mw.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
assert.equal(sha256(bytes), manifest.modules.find(row => row.path === 'chunk-24k7d6mw.js').decodedSha256);
const expression = bytes.toString('utf8').slice(723972, 724107);
assert.equal(sha256(expression), 'c2b8ea04094669c3e5833673e66f99be8c42e701629cbbc8542653d70f26147e');
const target = fs.readFileSync(path.join(root, 'src/tui-stash.ts'), 'utf8');
const compiled = ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext } }).outputText;
const ast = parse(compiled, { ecmaVersion: 'latest', sourceType: 'module' });
const returned = ast.body.find(node => node.type === 'ExportNamedDeclaration'
  && node.declaration?.id?.name === 'stashedIndicator').declaration.body.body[0].argument;
const normalize = node => JSON.parse(JSON.stringify(node, (key, value) => {
  if (['start', 'end', 'raw'].includes(key)) return undefined;
  if (key === 'arguments' && value.length === 3 && value[2]?.name === 'undefined') return value.slice(0, 2);
  return value;
}));
assert.deepEqual(normalize(returned), normalize(parse(expression, { ecmaVersion: 'latest' }).body[0].expression));
const { stashedIndicator } = await import('../dist/tui-stash.js');
const { jsx: e, jsxs: r } = await import('../dist/tui-jsx.js');
const { s, n } = await import('../dist/tui-base-components.js');
const { te } = await import('../dist/tui-symbols.js');
const recovered = Function('e', 'r', 's', 'n', 'te', `return ($e,Io)=>${expression}`)(e, r, s, n, te);
for (const present of [false, true]) for (const feedback of [false, true])
  assert.deepEqual(stashedIndicator(present, feedback), recovered(present, feedback));
console.log('PASS exact source identity, copied expression AST and all compiled indicator branches');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w286-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', effort: 'high',
  thinking: false, prefersReducedMotion: true, watchConfig: false }));
const requests = [], checks = [], captures = {}, children = [];
let active;
const server = http.createServer(async (request, response) => {
  let data = ''; for await (const chunk of request) data += chunk;
  const body = JSON.parse(data); requests.push(body);
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const emit = (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  emit('message_start', { type: 'message_start', message: { id: `w286-${requests.length}`, type: 'message',
    role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 0 } } });
  emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  emit('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text: 'stashed fixture answered' } });
  emit('content_block_stop', { type: 'content_block_stop', index: 0 });
  emit('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 1 } }); emit('message_stop', { type: 'message_stop' }); response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-w286-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM',
    'CLAUDE_CODE_DISABLE_WORKFLOWS'].includes(key)) delete env[key];
const frame = () => active.screen.lines().join('\n');
const footer = () => active.screen.lines().at(-1);
const draft = () => active.screen.lines()[active.rows - 3];
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (active.child.exitCode !== null || Date.now() > deadline)
      throw new Error(`${label}\n${active.stderr}\n${frame()}`);
    await delay(20);
  }
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${frame()}`); checks.push(label); console.log('PASS ' + label);
}
async function launch(columns = 120) {
  const rows = 30, screen = new TerminalScreen(columns, rows), decoder = new StringDecoder('utf8');
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w286-stashed-footer.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
    '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root,
    env: { ...env, W286_COLUMNS: String(columns), W286_ROWS: String(rows) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, screen, columns, rows, stderr: '', exited: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { current.stderr += chunk.toString('utf8'); });
  children.push(current); active = current;
  await until(() => footer()?.includes('ready'), 'startup ready');
}
async function stop() {
  send('\x15/exit\r');
  assert.equal(await Promise.race([active.exited, delay(8_000).then(() => 'timeout')]), 0, active.stderr);
}
try {
  await launch();
  pass('the empty stash has no footer marker', !footer().includes('stashed'));
  send('retained\x13');
  await until(() => footer()?.endsWith(' · › stashed'), 'stashed with feedback');
  pass('stash empties the draft and appends its marker after effort', !draft().includes('retained')
    && footer().includes('● high · /effort · › stashed'));
  pass('the marker uses the source inactive color', active.screen.cell(footer().indexOf('›'), 29).getFgColor() === 0x999999);
  captures.combined = frame();
  await until(() => footer()?.endsWith(' › stashed') && !footer().includes('/effort'), 'feedback expiry leaves stash');
  pass('feedback expiry preserves stash without a separator', !footer().includes(' · › stashed'));
  send('other\x13');
  await until(() => draft()?.includes('retained'), 'swapped retained draft');
  pass('swapping retains the marker for the other draft', footer().endsWith(' › stashed'));
  send('\x15\x13'); await until(() => draft()?.includes('other') && !footer()?.includes('stashed'), 'pop other draft');
  pass('popping the slot clears the marker');
  send('\x13/'); await until(() => frame().includes('/add-dir') && draft()?.trim() === '❯ /' && !footer()?.includes('stashed'), 'suggestion gate');
  pass('slash suggestions hide the fullscreen stash marker');
  send('\x15'); await until(() => footer()?.endsWith(' › stashed'), 'suggestion clear');
  pass('clearing suggestions restores the marker');
  send('\x12'); await until(() => frame().includes('Search prompts'), 'history search');
  pass('history search hides the chat stash marker', !frame().includes('› stashed'));
  send('\x03'); await until(() => footer()?.endsWith(' › stashed'), 'history search cancel');
  pass('cancelling history search restores the marker');
  send('sent task\r');
  await until(() => frame().includes('stashed fixture answered') && draft()?.includes('other'), 'submit restored stash');
  pass('submit restores the waiting draft and clears the marker', !footer().includes('stashed'));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].messages.filter(message => message.role === 'user').at(-1).content, 'sent task');
  send('\x15focus-retained\x13/focus on\r');
  await until(() => frame().includes('Focus view enabled') && draft()?.includes('focus-retained'), 'focus dispatch restore');
  pass('local command dispatch restores the stash and removes its marker', !footer().includes('stashed'));
  send('\x13'); await until(() => footer()?.endsWith(' › stashed'), 'brief stash');
  pass('brief mode retains stash status without effort feedback');
  captures.brief = frame(); await stop();

  await launch(40);
  pass('a fresh terminal does not inherit the previous stash slot', !footer().includes('stashed'));
  send('narrow\x13'); await until(() => footer()?.endsWith('› stashed'), 'narrow marker');
  pass('the 40-column footer keeps the complete stash marker', footer().length <= 40);
  send('\x13'); await until(() => draft()?.includes('narrow') && !footer()?.includes('stashed'), 'narrow pop');
  pass('the narrow marker clears on pop'); await stop();
  pass('all compiled CLI processes exit zero', children.every(current => current.child.exitCode === 0));
  const files = fs.readdirSync(path.join(workspace, '.agent'));
  pass('history and session locks are released', !fs.existsSync(path.join(user, 'history.jsonl.lock'))
    && !files.some(name => name.endsWith('.lock')));
  for (const file of files.filter(name => name.endsWith('.jsonl')))
    assert.equal(fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').includes('owned-w286-fixture'), false);
  pass('only the explicit prompt reached the owned provider', requests.length === 1);
  const identity = captureIdentity(root);
  const result = { checks, captures, identity: identity.sha256, inputs: identity.inputs.sha256,
    validation: identity.validation.sha256, build: identity.build.sha256, sourceExpression: sha256(expression),
    provider: 'owned loopback SSE', modelCalls: requests.length, paidUpstreamCalls: 0 };
  if (process.env.W286_RESULT) fs.writeFileSync(process.env.W286_RESULT, JSON.stringify(result, null, 2) + '\n');
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}`);
} finally {
  for (const current of children) {
    if (current.child.exitCode === null) {
      current.child.stdin.write('\x15/exit\r'); await Promise.race([current.exited, delay(2_000)]);
      if (current.child.exitCode === null) { current.child.kill('SIGKILL'); await current.exited; }
    }
    current.screen.close();
  }
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
