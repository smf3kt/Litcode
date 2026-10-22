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
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const sha256 = data => createHash('sha256').update(data).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extracted-v2/manifest.json'), 'utf8'));
const bytes = fs.readFileSync(path.join(root, 'extracted-v2/modules/chunk-24k7d6mw.js'));
assert.equal(sha256(bytes), manifest.modules.find(row => row.path === 'chunk-24k7d6mw.js').decodedSha256);
const source = bytes.toString('utf8');
const formatter = source.slice(153296, 153407), effect = source.slice(894148, 894249);
assert.equal(sha256(formatter), 'f6ce829ad79d82d3015c6e468868fb167873fabb3eb0358a5e3d01984ba01ec3');
assert.equal(sha256(effect), '0db332fa095120c4c2ffecafab8ee157c470d9f399347eddfd5d2654d5cc00c2');
assert.equal(parse(formatter, { ecmaVersion: 'latest' }).body[0].id.name, 'eee');
const { effortIndicator, effortGlyph } = await import('../dist/effort-command.js');
const recovered = Function('z$', formatter + ';return eee')(effortGlyph);
for (const level of [undefined, 'low', 'medium', 'high', 'xhigh', 'max']) {
  for (const ultra of [false, true]) for (const prefix of [false, true]) {
    assert.equal(effortIndicator(level, prefix, ultra), recovered(level, ultra, prefix));
  }
}
console.log('PASS source digest, exact formatter/effect ranges and every compiled formatter arm');

const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w285-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(user, 'agents'));
fs.writeFileSync(path.join(user, 'agents/second.md'),
  '---\nname: second\ndescription: Fixture\nmodel: second-model\n---\nFixture.\n');
const settingsPath = path.join(user, 'settings.json');
fs.writeFileSync(settingsPath, JSON.stringify({ model: 'fixture', thinking: false, prefersReducedMotion: true,
  watchConfig: false, modelSettings: { fixture: { effortLevel: 'low' }, 'second-model': { effortLevel: 'xhigh' } } }));
const stored = () => JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const requests = [], checks = [], captures = {}, children = [];
let active;
const server = http.createServer(async (request, response) => {
  let data = '';
  for await (const chunk of request) data += chunk;
  const body = JSON.parse(data); requests.push(body);
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const emit = (event, value) => response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
  emit('message_start', { type: 'message_start', message: { id: `w285-${requests.length}`, type: 'message',
    role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 0 } } });
  emit('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  emit('content_block_delta', { type: 'content_block_delta', index: 0,
    delta: { type: 'text_delta', text: `feedback fixture answered ${requests.length}` } });
  emit('content_block_stop', { type: 'content_block_stop', index: 0 });
  emit('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null },
    usage: { output_tokens: 1 } });
  emit('message_stop', { type: 'message_stop' }); response.end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8',
  LLM_API_KEY: 'owned-w285-fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
  LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'TERM_PROGRAM',
    'CLAUDE_CODE_DISABLE_WORKFLOWS'].includes(key)) delete env[key];
const frame = () => active.screen.lines().join('\n');
const notice = () => active.screen.lines().find(line => /[○◐●◉◈] (low|medium|high|xhigh|max) · (ultracode · )?\/effort/.test(line));
const send = text => active.child.stdin.write(text);
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
async function launch(override) {
  const screen = new TerminalScreen(120, 30), decoder = new StringDecoder('utf8');
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w285-effort-feedback.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive', '--user-dir', user,
    '--no-inherit-gateway', '--permission-mode', 'bypass'], { cwd: root,
    env: override === undefined ? env : { ...env, LLM_EFFORT: override }, stdio: ['pipe', 'pipe', 'pipe'] });
  const current = { child, screen, decoder, stderr: '', exited: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { current.stderr += chunk.toString('utf8'); });
  children.push(current); active = current;
  await until(() => frame().includes('ready'), 'startup ready');
}
async function stop() {
  send('/exit\r');
  assert.equal(await Promise.race([active.exited, delay(8_000).then(() => 'timeout')]), 0, active.stderr);
}
async function level(command, expected) {
  send(command + '\r');
  await until(() => notice()?.includes(expected), expected);
  pass(command + ' shows ' + expected);
}
async function turn(effort, model) {
  const before = requests.length;
  send(`feedback probe ${before + 1}\r`);
  await until(() => requests.length > before && frame().includes(`feedback fixture answered ${before + 1}`)
    && frame().includes('ready'), 'completed provider turn');
  assert.equal(requests.at(-1).output_config?.effort, effort);
  assert.equal(requests.at(-1).model, model);
  pass('the explicit turn uses ' + model + ' with ' + String(effort));
}
try {
  await launch();
  await until(() => notice()?.includes('○ low · /effort'), 'initial effective effort');
  const firstShown = Date.now();
  pass('startup resolves the inherited model default');
  await delay(2_000);
  send('/effort status\r');
  await until(() => frame().includes('Current effort level: low'), 'read-only status');
  await until(() => notice() === undefined, 'real ten-second expiry');
  const elapsed = Date.now() - firstShown;
  pass('feedback expires at ten seconds without a command rearming it', elapsed >= 9_300 && elapsed < 11_700);
  send('/effort low\r');
  await until(() => frame().includes('Set effort level to low'), 'unchanged effort applied');
  pass('an unchanged expired level stays absent', notice() === undefined);

  send('/effort auto\r');
  await until(() => notice()?.includes('● high · /effort'), 'auto high fallback');
  pass('auto resolves to high rather than leaving a stale manual label');
  await stop();
  fs.writeFileSync(settingsPath, JSON.stringify({ ...stored(), model: 'fixture', effort: undefined,
    modelSettings: { fixture: { effortLevel: 'low' }, 'second-model': { effortLevel: 'xhigh' } } }));
  await launch();
  fs.writeFileSync(settingsPath, JSON.stringify({ ...stored(),
    modelSettings: { fixture: { effortLevel: 'medium' }, 'second-model': { effortLevel: 'xhigh' } } }));
  send('/reload\r');
  await until(() => notice()?.includes('◐ medium · /effort'), 'inherited default reload');
  pass('reloading an inherited model default updates effective feedback');
  await turn('medium', 'fixture');
  fs.writeFileSync(settingsPath, JSON.stringify({ ...stored(),
    modelSettings: { fixture: { effortLevel: 'low' }, 'second-model': { effortLevel: 'xhigh' } } }));
  send('/reload\r');
  await until(() => notice()?.includes('○ low · /effort'), 'return to inherited low');
  await level('/model second-model', '◉ xhigh · /effort');
  await level('/model fixture', '○ low · /effort');
  send('/model\r'); await until(() => /^Select model$/m.test(frame()), 'model picker');
  send('\x1b[B\r'); await until(() => notice()?.includes('◉ xhigh · /effort'), 'picker model applied');
  pass('model picker acceptance refreshes inherited effective effort');
  await level('/effort high', '● high · /effort');
  send('/effort\r'); await until(() => /^Effort$/m.test(frame()), 'effort slider');
  send('\x1b[C'); await until(() => frame().includes('xhigh'), 'slider preview');
  send('s'); await until(() => notice()?.includes('◉ xhigh · /effort'), 'slider applied');
  pass('the effort slider updates the timed feedback');
  await level('/effort ultracode', '◉ xhigh · ultracode · /effort');
  send('/effort ultracode off\r');
  await until(() => notice()?.includes('◉ xhigh · /effort') && !notice()?.includes('ultracode'), 'suffix cleared');
  pass('turning ultracode off replaces its suffix');
  send('/focus on\r'); await until(() => frame().includes('Focus view enabled'), 'focus on');
  pass('brief mode clears effort feedback', notice() === undefined);
  send('/focus off\r'); await until(() => notice() !== undefined, 'focus off');
  pass('leaving brief mode restores effective effort feedback');
  captures.normal = frame();
  await turn('xhigh', 'second-model');
  fs.writeFileSync(settingsPath, JSON.stringify({ ...stored(), viewMode: 'focus' }));
  send('/reload\r'); await until(() => frame().includes('Local configuration reloa') && notice() === undefined, 'brief config rebind');
  pass('config rebind applies the saved brief-mode feedback gate');
  fs.writeFileSync(settingsPath, JSON.stringify({ ...stored(), viewMode: 'default' }));
  send('/reload\r'); await until(() => notice()?.includes('◉ xhigh · /effort'), 'normal config rebind');
  pass('config rebind restores the retained session effort feedback');
  await stop();

  await launch('medium');
  await until(() => notice()?.includes('◐ medium · /effort'), 'environment effective effort');
  pass('LLM_EFFORT controls feedback ahead of a saved default');
  send('/effort low\r'); await until(() => frame().includes('LLM_EFFORT=medium'), 'override explanation');
  pass('changing the stored choice preserves the effective environment label', notice()?.includes('◐ medium · /effort'));
  await turn('medium', 'second-model');
  await stop();

  await launch();
  send('/effort auto\r');
  await until(() => frame().includes('Effort level set to auto') && notice()?.includes('● high · /effort'),
    'auto display fallback after environment override');
  pass('auto without an environment override displays the source high fallback');
  await turn(undefined, 'second-model');
  captures.auto = frame(); await stop();
  pass('all compiled CLI processes exit zero', children.every(child => child.child.exitCode === 0));
  const agentFiles = fs.readdirSync(path.join(workspace, '.agent'));
  pass('history and session locks are released', !fs.existsSync(path.join(user, 'history.jsonl.lock'))
    && !agentFiles.some(name => name.endsWith('.lock')));
  for (const name of agentFiles.filter(name => name.endsWith('.jsonl')))
    assert.equal(fs.readFileSync(path.join(workspace, '.agent', name), 'utf8').includes('owned-w285-fixture'), false);
  pass('only explicit prompts call the owned provider', requests.length === 4);
  const identity = captureIdentity(root);
  const result = { checks, captures, identity: identity.sha256, inputs: identity.inputs.sha256,
    validation: identity.validation.sha256, build: identity.build.sha256, expiryMs: elapsed,
    sourceModule: sha256(bytes), sourceBody: sha256(formatter), sourceEffect: sha256(effect),
    modelCalls: requests.length, provider: 'owned loopback SSE', paidUpstreamCalls: 0 };
  if (process.env.W285_RESULT) fs.writeFileSync(process.env.W285_RESULT, JSON.stringify(result, null, 2) + '\n');
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; expiry ${elapsed}ms`);
} finally {
  for (const current of children) {
    if (current.child.exitCode === null) {
      current.child.stdin.write('/exit\r');
      await Promise.race([current.exited, delay(2_000)]);
      if (current.child.exitCode === null) { current.child.kill('SIGKILL'); await current.exited; }
    }
    current.screen.close();
  }
  await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
