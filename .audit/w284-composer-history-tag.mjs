import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { StringDecoder } from 'node:string_decoder';
import { parse } from 'acorn';
import ts from 'typescript';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sourcePath = 'extracted-v2/modules/chunk-24k7d6mw.js';
const bytes = fs.readFileSync(path.join(root, sourcePath));
const sha256 = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
assert.equal(sha256(bytes), manifest.modules.find(entry => entry.path === 'chunk-24k7d6mw.js').decodedSha256);
const source = bytes.toString('utf8').slice(809815, 809924);
assert.equal(sha256(source), 'bf00e185a64b5a52265c7c2c0e682d378a687651e2994321ce42c679b43601fc');
const target = fs.readFileSync(path.join(root, 'src/tui-history-position.ts'), 'utf8');
const compiled = ts.transpileModule(target, { compilerOptions: { target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext } }).outputText;
const ast = text => parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
const copied = ast(compiled).body.find(node => node.type === 'ExportNamedDeclaration'
  && node.declaration?.id?.name === 'gue').declaration;
const normalize = node => JSON.parse(JSON.stringify(node, (key, value) =>
  ['start', 'end', 'raw'].includes(key) ? undefined : value));
assert.deepEqual(normalize(copied.body), normalize(ast(source).body[0].body));
const originalBody = source.slice(source.indexOf('{') + 1, -1);
const tsSource = ts.createSourceFile('history-position.ts', target, ts.ScriptTarget.Latest, true);
const targetFunction = tsSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'gue');
assert.equal(targetFunction.body.getText(tsSource).slice(1, -1).trim(), originalBody);
const originalRecord = bytes.toString('utf8').slice(848742, 848808);
const adaptedRecord = originalRecord.replace('ge.dim(eRe)', "Reflect.get(ge, 'dim')(eRe)");
assert.ok(target.includes('return eRe?' + adaptedRecord + ':void 0;'));
const { gue } = await import('../dist/tui-history-position.js');
assert.equal(gue(1, null, false), 'History');
assert.equal(gue(1, 3, true), undefined);
assert.equal(gue(0, 3, false), undefined);
console.log('PASS source digest, formatter text/AST, adapted record diff, unknown-total and edited gates');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w284-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false,
  prefersReducedMotion: true, watchConfig: false }));
fs.writeFileSync(path.join(user, 'history.jsonl'), ['alpha history', 'beta history', 'gamma history']
  .map((display, index) => JSON.stringify({ display, pastedContents: {}, timestamp: 1_700_000_000_000 + index,
    project: workspace, sessionId: 'w284-owned-history' }) + '\n').join(''));

const requests = [], checks = [], captures = {};
const server = http.createServer(async (request, response) => {
  let body = '';
  for await (const chunk of request) body += chunk;
  requests.push(JSON.parse(body));
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const emit = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  emit('message_start', { type: 'message_start', message: { id: 'w284-owned-turn', type: 'message',
    role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 0 } } });
  emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  emit('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text: 'history tag fixture answered' } });
  emit('content_block_stop', { type: 'content_block_stop', index: 0 });
  emit('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 5 } });
  emit('message_stop', { type: 'message_stop' }); response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-w284-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_MODEL: 'fixture', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['TMUX', 'STY', 'TERM_PROGRAM', 'CLAUDE_CODE_DISABLE_WORKFLOWS'].includes(key)) delete env[key];
const screen = new TerminalScreen(120, 30), decoder = new StringDecoder('utf8');
const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w284-composer-history-tag.exp'), process.execPath,
  path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
  '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
const exited = new Promise(resolve => child.once('close', resolve));
let stderr = '';
child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
const frame = () => screen.lines().join('\n');
const border = () => screen.lines()[26];
const send = text => child.stdin.write(text);
async function until(predicate, label) {
  const deadline = Date.now() + 15_000;
  while (!predicate()) {
    if (child.exitCode !== null || Date.now() > deadline) throw new Error(`${label}\n${stderr}\n${frame()}`);
    await delay(20);
  }
}
function pass(label, condition = true) {
  assert.ok(condition, `${label}\n${frame()}`); checks.push(label); console.log('PASS ' + label);
}
async function history(key, expected) {
  send(key); await until(() => border()?.includes(expected), expected);
  pass(expected + ' appears on the composer border', border().startsWith('─'.repeat(3) + ' ' + expected));
}
try {
  await until(() => frame().includes('ready'), 'startup ready');
  pass('startup has no history tag', !border().includes('History'));
  await history('\x1b[A', 'History 3/3');
  pass('history label is dim and starts after the source offset', screen.cell(4, 26).isDim());
  await history('\x1b[A', 'History 2/3');
  await history('\x1b[A', 'History 1/3');
  send('\x1b[B\x1b[B\x1b[B');
  await until(() => !border().includes('History'), 'return to draft');
  send('retained draft');
  await until(() => frame().includes('retained draft'), 'typed draft');
  await history('\x1b[A', 'History 3/3');
  send('\x1b[B');
  await until(() => !border().includes('History') && screen.lines()[27].includes('retained draft'), 'restore draft');
  pass('Down restores the live draft and clears the history tag');
  await history('\x1b[A', 'History 3/3'); send('X');
  await until(() => !border().includes('History') && screen.lines()[27].includes('gamma historyX'), 'edited history');
  pass('editing recalled text takes the tag down');
  send('\x15/effort ultracode\r');
  await until(() => border().includes('ultracode'), 'ultracode tag');
  pass('history navigation and the local effort command sent no model request', requests.length === 0);
  send('tag fixture turn\r');
  await until(() => frame().includes('history tag fixture answered') && frame().includes('ready'), 'owned provider turn');
  await history('\x1b[A', 'History 5/5');
  pass('history text takes precedence over ultracode', !border().includes('ultracode'));
  captures.history = frame();
  send('\x12'); await until(() => frame().includes('Search prompts'), 'history picker');
  pass('history picker suppresses the browse tag', !frame().includes('History 5/5'));
  send('\x03'); await until(() => border().includes('History 5/5'), 'cancel picker');
  pass('cancelling the picker restores the browse tag');
  send('\x1b[B'); await until(() => border().includes('ultracode'), 'ultracode restored');
  pass('the ultracode tag returns with the live draft');
  send('/exit\r'); assert.equal(await exited, 0, stderr);
  pass('the compiled CLI exits zero');
  const agentFiles = fs.readdirSync(path.join(workspace, '.agent'));
  pass('history and session locks are released', !fs.existsSync(path.join(user, 'history.jsonl.lock'))
    && !agentFiles.some(name => name.endsWith('.lock')));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].messages.filter(message => message.role === 'user').at(-1).content, 'tag fixture turn');
  const journals = agentFiles.filter(name => name.endsWith('.jsonl'));
  for (const name of journals) assert.equal(fs.readFileSync(path.join(workspace, '.agent', name), 'utf8')
    .includes('owned-w284-fixture'), false);
  const identity = captureIdentity(root);
  const result = { checks, captures, identity: identity.sha256, inputs: identity.inputs.sha256,
    build: identity.build.sha256, sourceModule: sha256(bytes), sourceBody: sha256(source),
    provider: 'owned loopback SSE', modelCalls: requests.length, paidUpstreamCalls: 0 };
  if (process.env.W284_RESULT) fs.writeFileSync(process.env.W284_RESULT, JSON.stringify(result, null, 2) + '\n');
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}`);
} finally {
  if (child.exitCode === null) { child.kill('SIGKILL'); await exited; }
  screen.close(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
