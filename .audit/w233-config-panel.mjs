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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w233-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(user, 'agents'));
fs.writeFileSync(path.join(user, 'agents', 'other.md'), '---\nname: other\ndescription: Fixture\nmodel: model-02\n---\nFixture.\n');
const settingsFile = path.join(user, 'settings.json'), localFile = path.join(workspace, '.harness', 'settings.local.json');
fs.writeFileSync(settingsFile, JSON.stringify({ model: 'model-01', effort: 'medium', keep: 'preserved', thinking: false,
  theme: 'dark', editorMode: 'normal', showTurnDuration: true }));
const stored = () => JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
const wrapper = path.join(temporary, 'pty.exp');
fs.writeFileSync(wrapper, `set stty_init "rows $env(W233_ROWS) columns $env(W233_COLUMNS)"\nsource ${path.join(root, 'scripts/pty-cli.exp')}\n`);
const requests = [], children = [], checks = [], captures = {};
let active;
const server = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = (event, data) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: `msg_${requests.length}`, type: 'message', role: 'assistant',
      model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `response ${requests.length}` } });
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } });
    send('message_stop', { type: 'message_stop' }); response.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LANG: 'en_US.UTF-8',
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY'].includes(key)) delete env[key];
const screen = () => {
  const terminal = new TerminalScreen(active.columns, active.rows);
  terminal.write(Buffer.concat(active.chunks).toString('utf8'));
  const lines = terminal.lines(); terminal.close();
  return lines.map(line => line.trimEnd()).join('\n');
};
const panel = () => /^Config$/m.test(screen());
const ready = () => !panel() && (screen().includes('· ready') || active.columns < 40 && /^❯\s*$/mu.test(screen()));
const searching = query => screen().includes(`⌕ ${query}`);
const send = value => active.child.stdin.write(value);
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (predicate()) return;
    if (active?.child.exitCode !== null && active?.child.exitCode !== undefined) break;
    await delay(60);
  }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch(columns = 90, rows = 30) {
  const child = spawn('/usr/bin/expect', [wrapper, process.execPath, path.join(root, 'bin/personal-harness.mjs'),
    '--workspace', workspace, '--user-dir', user, '--interactive'], {
    cwd: root, env: { ...env, W233_COLUMNS: String(columns), W233_ROWS: String(rows) }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  const current = { child, columns, rows, chunks: [], closed: new Promise(resolve => child.once('close', resolve)) };
  child.stdout.on('data', chunk => current.chunks.push(chunk)); child.stderr.on('data', chunk => current.chunks.push(chunk));
  active = current; children.push(current); await until(ready, 'startup ready', 25000);
}
async function stop() { send('/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, screen()); }
async function open() { send('/config\r'); await until(() => panel() && screen().includes('⌕') && screen().includes('Type to filter'), 'config open'); }
async function filter(query, list = true) {
  send('/' + query); await until(() => panel() && searching(query), `search ${query}`);
  if (list) { send('\r'); await until(() => screen().includes('Enter/Space change'), 'list focus'); }
}
async function clearSearch() {
  send('\x1b'); await until(() => screen().includes('⌕ Search') && screen().includes('Type to filter'), 'search cleared');
  send('\x1b'); await until(() => screen().includes('Enter/Space change'), 'search released');
}
async function change(key, predicate, label) {
  send(key); await until(() => predicate() && !screen().includes('Saving settings'), label);
  pass(label);
}
async function close() { send('\x1b'); await until(ready, 'config closed'); }
async function turn(model, thinking, effort) {
  const before = requests.length;
  send(`settings probe ${before + 1}\r`);
  await until(() => requests.length === before + 1 && ready() && screen().includes(`response ${before + 1}`), 'turn done');
  assert.equal(requests.at(-1).model, model);
  assert.equal(requests.at(-1).thinking?.type === 'enabled' || requests.at(-1).thinking?.type === 'adaptive', thinking);
  assert.equal(requests.at(-1).output_config?.effort, effort);
}
try {
  await launch(); await open(); captures.open = screen();
  pass('bare config opens ten local setting rows with active search', ['Auto-compact', 'Reduce motion', 'Thinking mode', 'Show turn duration',
    'Time format', 'Theme', 'Editor mode', 'Question auto-continue timeout', 'Model', 'Dialog expiry'].every(label => screen().includes(label)));
  send('MOTION\r'); await until(() => screen().includes('Enter/Space change'), 'first search focus');
  await change('\r', () => fs.existsSync(localFile) && JSON.parse(fs.readFileSync(localFile)).prefersReducedMotion === true,
    'Reduce motion writes the workspace local file and applies in place');
  pass('local write preserves the user document', stored().keep === 'preserved' && stored().prefersReducedMotion === undefined);
  await filter('thinking'); await change(' ', () => stored().thinking === true, 'Thinking mode writes immediately');
  await filter('turnDuration'); await change('\x1b[C', () => stored().showTurnDuration === false, 'Turn duration cycles and persists');
  await filter('editor'); await change('\x1b[C', () => stored().editorMode === 'vim', 'Editor mode changes through the list');
  await change('\x1b[D', () => stored().editorMode === 'normal', 'Editor left cycles back to normal');
  await filter('askUserQuestionTimeout'); await change('\x1b[C', () => stored().askUserQuestionTimeout === '60s', 'Question timeout persists');
  await filter('dialogExpiry'); await change('\x1b[C', () => stored().dialogExpiry === '60s', 'Dialog expiry persists');
  await change('\x1b[D', () => stored().dialogExpiry === undefined, 'Dialog expiry default removes the authored key');
  await filter('timeFormat'); send('\x1b[D'); await delay(120);
  pass('Left on a picker link leaves the parent open', panel());
  send('\r'); await until(() => /^Time format$/m.test(screen()), 'time picker');
  const beforeCancel = fs.readFileSync(settingsFile, 'utf8');
  send('\x1b[B\x1b'); await until(panel, 'time cancel parent');
  pass('Time format cancellation preserves settings and the parent search', fs.readFileSync(settingsFile, 'utf8') === beforeCancel && searching('timeFormat'));
  send('\r'); await until(() => /^Time format$/m.test(screen()), 'time picker reopened');
  send('\x1b[B\x1b[B\r'); await until(() => panel() && stored().timeFormat === '24-hour', 'time saved');
  pass('Time format confirms in its child picker and returns to the parent');
  await filter('theme'); send('\r'); await until(() => /^Theme$/m.test(screen()), 'theme picker');
  send('\x1b'); await until(panel, 'theme cancel');
  pass('Theme cancellation returns without a write', stored().theme === 'dark');
  send('\r'); await until(() => /^Theme$/m.test(screen()), 'theme picker reopened');
  send('\x1b[B\r'); await until(() => panel() && stored().theme === 'light', 'theme saved');
  pass('Theme selection saves and returns to the parent');
  await filter('model'); send('\r'); await until(() => /^Select model$/m.test(screen()), 'model picker');
  pass('Config model picker has no session-only acceptance guide', !screen().includes('use this session only') && screen().includes('Enter confirm'));
  send('s'); await delay(100); pass('s leaves the Config model picker open', /^Select model$/m.test(screen()));
  send('\x1b[B\x1b[C\r'); await until(() => panel() && stored().model === 'model-02', 'config model saved');
  pass('Config model selection updates its saved model and per-model effort default', stored().modelSettings?.['model-02']?.effortLevel === 'high' && stored().effort === 'medium');
  await close(); await turn('model-02', true, 'high'); pass('live model thinking and effort reach the next request');
  await open(); send('no-such-setting'); await until(() => screen().includes('No settings match'), 'empty filter');
  send('\r\x1b[B'); await delay(100); pass('empty search retains input focus', screen().includes('Type to filter'));
  await clearSearch(); await filter('thinking');
  const validBytes = fs.readFileSync(settingsFile, 'utf8'); fs.writeFileSync(settingsFile, '{invalid');
  send('\r'); await until(() => screen().includes('JSON') && !screen().includes('Saving settings'), 'write error displayed');
  captures.error = screen();
  pass('failed write keeps the live setting and exposes the error', screen().includes('Thinking mode  true') && fs.readFileSync(settingsFile, 'utf8') === '{invalid');
  fs.writeFileSync(settingsFile, validBytes); await change('\r', () => stored().thinking === false, 'retry succeeds after the authored file is repaired');
  await close(); await turn('model-02', false, 'high'); pass('successful retry updates the next actual request');
  await stop(); await launch(); await open(); captures.restart = screen();
  pass('fresh CLI restores saved local settings', screen().includes('Thinking mode                   false')
    && screen().includes('Show turn duration              false') && screen().includes('Time format                     24-hour')
    && screen().includes('Theme                           Light mode') && screen().includes('Question auto-continue timeout  60s')
    && screen().includes('Model                           model-02'));
  send('\r'); await close(); await turn('model-02', false, 'high'); pass('fresh process applies the model-specific effort ahead of the legacy default');
  send('/effort low\r'); await until(() => ready() && stored().modelSettings?.['model-02']?.effortLevel === 'low', 'standalone default repaired');
  await turn('model-02', false, 'low'); await stop(); await launch(); await turn('model-02', false, 'low');
  pass('standalone effort updates the existing per-model default across restart');
  send('/effort auto\r'); await until(() => ready() && stored().effort === undefined && stored().modelSettings?.['model-02']?.effortLevel === undefined, 'auto default cleared');
  await stop(); await launch(); await turn('model-02', false, undefined);
  pass('auto clears the per-model effort and stays omitted after restart');
  await open(); send('24-hour\r'); await until(() => screen().includes('Enter/Space change'), 'time option search');
  pass('Time format remains searchable by an enum option', screen().includes('Time format'));
  await close();
  const original = fs.readFileSync(settingsFile, 'utf8');
  await open(); send('thinking\r'); await until(() => screen().includes('Enter/Space change'), 'thinking selected before close');
  fs.writeFileSync(settingsFile, '{invalid'); send('\r\x03');
  await until(() => ready() && screen().includes('Setting change failed'), 'failed accepted write reported after close');
  pass('immediate close preserves the accepted write failure as a transcript notice', fs.readFileSync(settingsFile, 'utf8') === '{invalid');
  fs.writeFileSync(settingsFile, original); await stop();
  const targetSettings = stored(); targetSettings.model = 'model-01'; targetSettings.effort = 'low';
  targetSettings.modelSettings = { 'model-02': { effortLevel: 'xhigh', privateMetadata: { marker: 'UNCONSUMED_MODEL_FIELD' } } };
  fs.writeFileSync(settingsFile, JSON.stringify(targetSettings));
  await launch(); await open(); send('model\r'); await until(() => screen().includes('Enter/Space change'), 'target model row');
  send('\r'); await until(() => /^Select model$/m.test(screen()), 'target model picker');
  send('\x1b[B'); await until(() => screen().includes('xHigh effort'), 'target inherited default shown');
  send('\r'); await until(() => panel() && stored().model === 'model-02', 'target default accepted');
  await close(); await turn('model-02', false, 'xhigh');
  pass('untouched model selection previews and applies its target default immediately'); await stop();
  const sessionFiles = fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'));
  pass('session journals omit unconsumed authored model fields', sessionFiles.every(file => !fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').includes('UNCONSUMED_MODEL_FIELD')));
  const linkedSettings = path.join(temporary, 'linked-settings.json');
  fs.writeFileSync(linkedSettings, JSON.stringify({ prefersReducedMotion: true, askUserQuestionTimeout: '5m', dialogExpiry: '10m' }));
  fs.unlinkSync(localFile); fs.symlinkSync(linkedSettings, localFile);
  await launch(20, 24); await open(); send('askUserQuestionTimeout'); await until(() => screen().includes('No settings match'), 'higher source hidden');
  pass('a workspace-owned timeout hides the user-only row');
  await clearSearch(); send('\x1b[F'); await delay(100); captures.narrow = screen();
  pass('20-column layout keeps the final Model row reachable with owned expiry hidden', screen().includes('Model') && screen().includes('model-02'));
  const target = screen().split('\n').findIndex(row => row.includes('model-02'));
  send(`\x1b[<0;4;${target + 1}M\x1b[<0;4;${target + 1}m`);
  await until(() => /^Select model$/m.test(screen()), 'narrow value click');
  pass('narrow value click opens the painted model child');
  send('\x1b'); await until(panel, 'narrow child cancelled'); await close(); await stop();
  const journals = fs.readdirSync(path.join(workspace, '.agent'));
  pass('all CLI processes exit and release session locks', children.every(current => current.child.exitCode === 0)
    && journals.some(file => file.endsWith('.jsonl')) && !journals.some(file => file.endsWith('.jsonl.lock')));
  const identity = captureIdentity(root);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, captures, requests: requests.map(body => ({
    model: body.model, thinking: body.thinking, effort: body.output_config?.effort })), identity: identity.sha256,
    inputs: identity.inputs.sha256, validation: identity.validation.sha256, build: identity.build.sha256 }, null, 2));
  console.log(`RESULT ${checks.length} checks; identity ${identity.sha256}; ${temporary}`);
} finally {
  if (active) fs.writeFileSync(path.join(temporary, 'screen.txt'), screen());
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  for (const current of children) if (current.child.exitCode === null && current.child.signalCode === null) {
    current.child.kill('SIGKILL'); await Promise.race([current.closed, delay(2000)]);
  }
  await new Promise(resolve => server.close(resolve));
}
