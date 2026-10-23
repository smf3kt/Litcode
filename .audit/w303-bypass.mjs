import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(process.env.CLAUDE_JOB_DIR, 'tmp');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(output, 'w303-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
const settings = path.join(user, 'settings.json'), checks = [], captures = {}, children = [];
const requests = [];
let active;
const toolResults = body => body.messages.flatMap(message => Array.isArray(message.content)
  ? message.content.filter(block => block.type === 'tool_result') : []);
const seed = permissions => fs.writeFileSync(settings, JSON.stringify({ model: 'fixture', thinking: false,
  prefersReducedMotion: true, spinnerTipsEnabled: false, showTurnDuration: false, allowShell: true,
  keep: 'authored', ...(permissions === undefined ? {} : { permissions }) }));
const stored = () => JSON.parse(fs.readFileSync(settings, 'utf8'));
const server = http.createServer((request, reply) => {
  const chunks = []; let bytes = 0;
  request.on('data', chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
    const prompt = [...body.messages].reverse().find(message => message.role === 'user' && typeof message.content === 'string')?.content;
    const seen = toolResults(body);
    const sequence = prompt === 'BYPASS_EFFECTS' ? [
      { id: 'w303-write', name: 'write_file', input: { path: 'owned.txt', content: 'DEFAULT_BYPASS_FILE' } },
      { id: 'w303-shell', name: 'run_command', input: { command: 'printf DEFAULT_BYPASS_SHELL > shell.txt', timeout_ms: 2000 } },
    ] : prompt === 'ASK_EFFECT' ? [
      { id: 'w303-ask', name: 'write_file', input: { path: 'asked.txt', content: 'EXPLICIT_ASK' } },
    ] : [];
    const call = sequence.find(item => !seen.some(result => result.tool_use_id === item.id));
    reply.writeHead(200, { 'content-type': 'text/event-stream' });
    const event = data => reply.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`);
    event({ type: 'message_start', message: { id: `fixture-${requests.length}`, type: 'message', role: 'assistant', model: 'fixture',
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    event({ type: 'content_block_start', index: 0, content_block: call
      ? { type: 'tool_use', id: call.id, name: call.name, input: {} } : { type: 'text', text: '' } });
    event({ type: 'content_block_delta', index: 0, delta: call
      ? { type: 'input_json_delta', partial_json: JSON.stringify(call.input) }
      : { type: 'text_delta', text: `W303_DONE_${prompt}` } });
    event({ type: 'content_block_stop', index: 0 });
    event({ type: 'message_delta', delta: { stop_reason: call ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 4 } });
    event({ type: 'message_stop' }); reply.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key) || ['TMUX', 'STY', 'ZELLIJ', 'NO_COLOR'].includes(key)) delete env[key];
Object.assign(env, { TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', LLM_API_KEY: 'fixture',
  LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });
const text = () => active.screen.lines().map(line => line.trimEnd()).join('\n');
const send = value => active.child.stdin.write(value);
const panel = () => /^Config$/m.test(text());
const ready = () => !panel() && text().includes('ready');
function pass(name, condition = true) { assert.ok(condition, `${name}\n${text()}`); checks.push(name); console.log(`PASS ${name}`); }
async function until(predicate, label, milliseconds = 15000) {
  const end = Date.now() + milliseconds;
  while (Date.now() < end) { if (predicate()) return; if (active.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\n${text()}`);
}
function capture(name) { captures[name] = text(); }
const journalFiles = () => fs.readdirSync(path.join(workspace, '.agent')).filter(name => name.endsWith('.jsonl'));
function currentSession() {
  const files = journalFiles().map(name => path.join(workspace, '.agent', name))
    .filter(file => fs.existsSync(`${file}.lock`));
  assert.equal(files.length, 1, 'exactly one active journal owner');
  const line = fs.readFileSync(files[0], 'utf8').split('\n')[0];
  assert.ok(line); return JSON.parse(line);
}
async function launch({ resume, flags = [] } = {}) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w303-bypass.exp'), process.execPath, path.join(root, 'bin/litcode.mjs'),
    '--workspace', workspace, '--interactive', ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway']), ...flags],
    { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(100, 30), decoder = new StringDecoder('utf8');
  active = { child, screen, raw: '', closed: new Promise(resolve => child.once('close', resolve)) }; children.push(active);
  const owner = active;
  const feed = chunk => { const data = decoder.write(chunk); owner.raw += data; owner.screen.write(data); };
  child.stdout.on('data', feed); child.stderr.on('data', feed);
  await until(() => ready() && /(?:permissions|mode) on/.test(text()), 'CLI permission mode ready', 30000);
}
async function stop() {
  send('\x15/exit\r');
  pass('compiled CLI exits zero', await Promise.race([active.closed, delay(6000).then(() => 'timeout')]) === 0);
}
async function openConfig() {
  send('/config\r'); await until(() => panel() && text().includes('Default permission mode'), 'Config permission row');
  send('permission\r'); await until(() => text().includes('Enter/Space change'), 'Config selected');
}
async function closeConfig() {
  for (let index = 0; index < 3 && panel(); index++) { send('\x1b'); await delay(100); }
  await until(ready, 'Config closed');
}
async function cycleDefault(key, mode) {
  send(key); await until(() => stored().permissions?.defaultMode === mode && !text().includes('Saving settings'), `saved ${mode}`);
  pass(`Config saves ${mode}`, new RegExp(`Default permission mode\\s+‹ ${mode} ›`).test(text()));
}
try {
  seed(undefined);
  await launch(); capture('fresh');
  pass('new CLI defaults to bypass without any permission flag', text().includes('bypass permissions on') && currentSession().config.permissions.mode === 'bypass');
  const owner = active;
  send('BYPASS_EFFECTS\r');
  await until(() => fs.existsSync(path.join(workspace, 'shell.txt')) && text().includes('W303_DONE_BYPASS_EFFECTS') && ready(), 'default file and shell effects');
  pass('default bypass executes the real file tool', fs.readFileSync(path.join(workspace, 'owned.txt'), 'utf8') === 'DEFAULT_BYPASS_FILE');
  pass('default bypass executes the explicitly enabled shell tool', fs.readFileSync(path.join(workspace, 'shell.txt'), 'utf8') === 'DEFAULT_BYPASS_SHELL');
  pass('effects completed with paired successful results and no ordinary approval', toolResults(requests.at(-1)).length === 2 &&
    toolResults(requests.at(-1)).every(result => result.is_error !== true) && !owner.raw.includes('Allow once'));
  await openConfig(); capture('default-row');
  pass('Config displays the bypass default', /Default permission mode\s+‹ bypassPermissions ›/.test(text()));
  await cycleDefault('\x1b[D', 'auto');
  await cycleDefault('\x1b[C', 'bypassPermissions');
  pass('saved default retains unrelated settings', stored().keep === 'authored');
  await cycleDefault('\x1b[C', 'dontAsk');
  await cycleDefault('\x1b[C', 'default');
  pass('changing a future default keeps the current live bypass', text().includes('bypass permissions on'));
  await closeConfig(); const pinned = currentSession().id; await stop();
  await launch(); capture('fresh-manual');
  pass('restart honors explicit saved default', text().includes('manual mode on') && currentSession().config.permissions.mode === 'default');
  const manual = currentSession().id; await stop();
  seed({ defaultMode: 'bypassPermissions' });
  await launch({ resume: manual }); capture('old-resume');
  pass('original manual session resumes its pinned mode after defaults change', text().includes('manual mode on') && currentSession().config.permissions.mode === 'default');
  await stop();
  await launch({ resume: pinned });
  pass('original bypass session resumes its pinned mode', text().includes('bypass permissions on')); await stop();
  seed(undefined); await launch({ flags: ['--permission-mode', 'plan'] });
  pass('explicit CLI mode overrides bypass default', text().includes('plan mode on') && currentSession().config.permissions.mode === 'plan'); await stop();
  seed({ ask: ['write_file'] }); await launch();
  send('ASK_EFFECT\r'); await until(() => /Allow once|Allow this/.test(text()), 'explicit ask prompt'); capture('explicit-ask');
  pass('explicit ask rule still opens approval in bypass', !fs.existsSync(path.join(workspace, 'asked.txt')));
  send('\r'); await until(() => fs.existsSync(path.join(workspace, 'asked.txt')) && text().includes('W303_DONE_ASK_EFFECT') && ready(), 'approved write');
  pass('explicit approval then executes once', fs.readFileSync(path.join(workspace, 'asked.txt'), 'utf8') === 'EXPLICIT_ASK'); await stop();
  seed({ defaultMode: 'plan' }); await launch({ flags: ['--deny-tool', 'run_command'] });
  pass('rule-only flag keeps authored plan on startup', text().includes('plan mode on'));
  const override = currentSession().config.configSources.overrides.permissions;
  pass('rule-only CLI snapshot stores no invented mode', !Object.hasOwn(override, 'mode'));
  const priorReload = currentSession().id;
  send('/reload\r'); await until(() => ready() && currentSession().id !== priorReload, 'rules reload');
  pass('rule-only flag keeps authored plan through reload', text().includes('plan mode on')); await stop();
  seed(undefined); await launch();
  send('\x1b[Z'); await until(() => text().includes('auto mode on'), 'cycle from bypass');
  pass('Shift+Tab advances the live default bypass mode'); await stop();
  pass('all session locks are released', journalFiles().length > 0 && fs.readdirSync(path.join(workspace, '.agent')).every(name => !name.endsWith('.lock')));
  const result = { checks, captures, requests: requests.length, paidUpstreamCalls: 0, identity: captureIdentity(root) };
  fs.writeFileSync(path.join(output, 'w303-cli-result.json'), JSON.stringify(result));
  console.log(`PASS ${checks.length}/${checks.length}`); console.log(`REQUESTS ${requests.length}`); console.log(`IDENTITY ${result.identity.sha256}`);
} finally {
  for (const owner of children) {
    if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]); if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); }
    owner.screen.close();
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
