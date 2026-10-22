import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { stripVTControlCharacters } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import ts from 'typescript';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const sources = new Map();
const readSource = file => {
  if (!sources.has(file)) {
    const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules', file));
    assert.equal(hash(bytes), manifest.modules.find(row => row.path === file).decodedSha256);
    sources.set(file, bytes.toString('utf8'));
  }
  return sources.get(file);
};
const ax = readSource('chunk-ax7r0qj7.js'), gy = readSource('chunk-gyf58rwf.js');
const copied = [ax.slice(1128, 1272), ax.slice(1544, 1850), 'var ' + ax.slice(1929, 2004) + ';',
  'var ' + ax.slice(2005, 2123) + ';', ax.slice(2353, 2411),
  'var ' + gy.slice(9240, 9285) + ',' + gy.slice(9286, 9345) + ';',
  'var ' + gy.slice(9766, 9796) + ';', gy.slice(11889, 12100),
  'var ' + gy.slice(12137, 12144) + ';', gy.slice(12145, 12302)].join('\n');
const cleanup = fs.readFileSync(path.join(root, 'src/tui-model-description-source.ts'), 'utf8');
const canonical = node => JSON.parse(JSON.stringify(node, (key, value) =>
  ['start', 'end', 'raw'].includes(key) ? undefined : value));
const astOf = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const compiled = text => ts.transpileModule(text, { compilerOptions: {
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
assert.deepEqual(canonical(astOf(compiled(cleanup)).body.filter(node => !['ImportDeclaration', 'ExportNamedDeclaration'].includes(node.type))),
  canonical(astOf(copied).body));
for (const body of copied.split('\n')) assert.ok(cleanup.includes(body));
assert.match(cleanup, /import \{ stripVTControlCharacters as pn \} from 'node:util'/);
const { AT } = await import('../dist/tui-model-description-source.js');
const { tuiCommandsWithSkills, commandSuggestions } = await import('../dist/tui-autocomplete.js');
const recoveredCleanup = Function('pn', copied + ';return AT')(stripVTControlCharacters);
const getterSource = readSource('chunk-sfn1dbxq.js').slice(1650777, 1650860);
const adaptedGetter = getterSource.replace(' for Claude Code', '')
  .replace('qo(tt())', "modelDisplayText(currentModel()) || 'unknown model'");
const catalogAst = astOf(compiled(fs.readFileSync(path.join(root, 'src/tui-autocomplete.ts'), 'utf8')));
let getter;
simple(catalogAst, { Property(node) {
  if (node.kind === 'get' && node.key.name === 'description') getter = node;
} });
assert.deepEqual(canonical(getter), canonical(astOf('({' + adaptedGetter + '})').body[0].expression.properties[0]));
assert.match(readSource('chunk-24k7d6mw.js').slice(507454, 507979), /T\.menuDescription\?\?T\.description/);
assert.match(readSource('chunk-sfn1dbxq.js').slice(1666990, 1667469), /if\(e.type!=="prompt"\)return e.description/);
assert.match(readSource('chunk-bk5ct2gw.js').slice(386338, 386796), /return AT\(e\)\|\|"unknown model"/);
let model = 'fixture-model';
const catalog = tuiCommandsWithSkills([], { currentModel: () => model });
const recovered = Function('qo', 'tt', 'return ({' + getterSource.replace(' for Claude Code', '') + '})')(
  text => recoveredCleanup(text) || 'unknown model', () => model);
for (const value of ['fixture-model', 'gateway/custom[1m]', '  custom\nname ', '\x1b[31mred\x1b[0m',
  '`<tag>`[x](url)![img][y]:', '\ud800bad', '🦉', '⠀', '', 'x'.repeat(254) + '🦉']) {
  model = value;
  assert.equal(AT(value), recoveredCleanup(value));
  assert.equal(commandSuggestions('/model', 6, catalog)[0].description, recovered.description);
}
console.log('PASS exact source identities, copied cleanup AST and documented model getter adaptations');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w288-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(user, 'agents'));
fs.writeFileSync(path.join(user, 'agents/second.md'), '---\nname: second\ndescription: Fixture\nmodel: second-model\n---\nFixture.\n');
fs.writeFileSync(path.join(user, 'agents/third.md'), '---\nname: third\ndescription: Fixture\nmodel: third-model\n---\nFixture.\n');
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'first-model', thinking: false,
  watchConfig: false, prefersReducedMotion: true }));
const requests = [], checks = [], captures = {}, children = [];
let active, releaseHeld;
const server = http.createServer(async (request, response) => {
  let data = ''; for await (const chunk of request) data += chunk;
  const body = JSON.parse(data); requests.push(body);
  if (requests.length === 1) await new Promise(resolve => { releaseHeld = resolve; });
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const emit = (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  emit('message_start', { type: 'message_start', message: { id: `w288-${requests.length}`, type: 'message',
    role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 0 } } });
  emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  emit('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text: `model fixture answered ${requests.length}` } });
  emit('content_block_stop', { type: 'content_block_stop', index: 0 });
  emit('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
  emit('message_stop', { type: 'message_stop' }); response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-w288-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM'].includes(key)) delete env[key];
const frame = () => active.screen.lines().join('\n');
const footer = () => active.screen.lines().at(-1) ?? '';
const send = text => active.child.stdin.write(text);
const configPanel = () => /^Config$/m.test(frame());
const picker = () => /^Select model$/m.test(frame());
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
async function launch(columns = 160) {
  const rows = 30, screen = new TerminalScreen(columns, rows), decoder = new StringDecoder('utf8');
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w288-live-model-description.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user,
    '--interactive', '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root,
    env: { ...env, W288_ROWS: String(rows), W288_COLUMNS: String(columns) }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, screen, rows, columns, stderr: '', exited: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { current.stderr += chunk.toString('utf8'); });
  active = current; children.push(current);
  await until(() => footer().includes('ready'), 'startup ready');
}
async function clear() {
  send('\x15'); await until(() => /^❯\s*$/mu.test(frame()) && !/^[❯ ]+\/model\s+config/m.test(frame()), 'empty composer');
}
async function show(model, label) {
  const before = requests.length;
  send('/model');
  await until(() => frame().includes(`Set the AI model (currently ${model})`), label);
  pass(label, requests.length === before);
  captures[label] = frame();
  await clear();
}
async function stop() {
  send('/exit\r');
  assert.equal(await Promise.race([active.exited, delay(8_000).then(() => 'timeout')]), 0, active.stderr);
}
function sessionFiles() { return fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl')); }
const metadata = file => JSON.parse(fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').split('\n')[0]);
try {
  await launch();
  await show('first-model', 'startup suggestion names the effective model');
  send('hold the model turn\r'); await until(() => requests.length === 1, 'held model request');
  pass('the explicit turn reaches the owned provider on first-model', requests[0].model === 'first-model');
  send('/model second-model\r'); await until(() => frame().includes('Model set to second-model'), 'typed mid-turn model switch');
  await show('second-model', 'typed mid-turn switch refreshes the suggestion');
  send('\x1bp'); await until(picker, 'model picker chord');
  send('\x1b[B'); await delay(80); send('s');
  await until(() => frame().includes('Model set to third-model'), 'session-only picker choice');
  await show('third-model', 'session-only picker choice refreshes the suggestion');
  const release = releaseHeld; releaseHeld = undefined; release();
  await until(() => frame().includes('model fixture answered 1') && footer().includes('ready'), 'held response finished');
  send('confirm switched model\r');
  await until(() => requests.length === 2 && frame().includes('model fixture answered 2') && footer().includes('ready'), 'next model turn');
  pass('the next request uses the same model shown in the suggestion', requests[1].model === 'third-model');
  send('/config\r'); await until(() => configPanel() && frame().includes('Type to filter'), 'config panel');
  send('model\r'); await until(() => frame().includes('Enter/Space change'), 'config model focused');
  send('\r'); await until(picker, 'config model picker');
  send('\x1b[B\r'); await until(configPanel, 'config model accepted');
  send('\x1b'); await until(() => !configPanel() && footer().includes('ready'), 'config closed');
  await show('second-model', 'config successor binds the current session reader');
  send('/reload\r'); await until(() => frame().includes('Local configuration reloa') && footer().includes('ready'), 'reload adopted');
  await show('second-model', 'reload retains the correct model description');
  send('/reload-skills\r'); await until(() => /Reloaded|No changes|skills/i.test(footer()), 'skill reload completed');
  await show('second-model', 'skill catalog rebuild retains the model getter');
  const first = sessionFiles().find(file => metadata(file).config.model === 'first-model');
  assert.ok(first, 'first-model session was persisted');
  send('/resume ' + first.slice(0, -6) + '\r');
  await until(() => frame().includes('Session resumed.') && footer().includes('ready'), 'first session resumed');
  await show('first-model', 'resume replaces the old session captured by the catalog');
  send('/model'); await until(() => frame().includes('(currently first-model)'), 'model suggestion before acceptance');
  send('\r'); await until(picker, 'accept model suggestion');
  pass('Enter on the dynamic description still opens the existing model picker');
  send('\x1b'); await until(() => !picker() && footer().includes('ready'), 'cancel model picker');
  await show('first-model', 'cancelling the picker preserves the current model description');
  pass('all catalog and picker actions add no model calls', requests.length === 2);
  await stop();
  await launch(64);
  send('/model'); await until(() => frame().includes('Set the AI model'), 'narrow model suggestion');
  pass('narrow suggestion wrapping stays within terminal width', active.screen.lines().every(row => [...row].length <= 64));
  captures.narrow = frame(); await clear(); await stop();
  pass('both compiled CLI processes exit zero', children.every(current => current.child.exitCode === 0));
  pass('history and session locks are released', !fs.existsSync(path.join(user, 'history.jsonl.lock'))
    && !fs.readdirSync(path.join(workspace, '.agent')).some(file => file.endsWith('.lock')));
  for (const file of sessionFiles()) assert.ok(!fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').includes(env.LLM_API_KEY));
  pass('journals omit the fixture credential');
  const identity = captureIdentity(root);
  const result = { checks, captures, identity: identity.sha256, inputs: identity.inputs.sha256,
    validation: identity.validation.sha256, build: identity.build.sha256, sourceGetter: hash(getterSource),
    provider: 'owned loopback SSE', modelCalls: requests.length, paidUpstreamCalls: 0 };
  if (process.env.W288_RESULT) fs.writeFileSync(process.env.W288_RESULT, JSON.stringify(result, null, 2) + '\n');
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}`);
} finally {
  releaseHeld?.();
  for (const current of children) {
    if (current.child.exitCode === null) {
      current.child.stdin.write('\x15/exit\r'); await Promise.race([current.exited, delay(2_000)]);
      if (current.child.exitCode === null) { current.child.kill('SIGKILL'); await current.exited; }
    }
    current.screen.close();
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
