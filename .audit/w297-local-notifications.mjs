import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w297-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
const userFile = path.join(user, 'settings.json'), project = path.join(workspace, '.harness/settings.json'), hookLog = path.join(temporary, 'hooks.jsonl');
const hookScript = path.join(temporary, 'hook.mjs');
fs.writeFileSync(hookScript, "import fs from 'node:fs'; const p=JSON.parse(fs.readFileSync(0,'utf8')); fs.appendFileSync(process.argv[2],JSON.stringify({message:p.message,type:p.notification_type,at:Date.now()})+'\\n');");
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 7, prefersReducedMotion: true, showTurnDuration: false,
  preferredNotifChannel: 'auto', hooks: { Notification: [{ matcher: 'permission_prompt', command: `${quote(process.execPath)} ${quote(hookScript)} ${quote(hookLog)}` }] } }));
const stored = () => JSON.parse(fs.readFileSync(userFile, 'utf8'));
const hookRows = () => fs.existsSync(hookLog) ? fs.readFileSync(hookLog, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const children = [], requests = [], checks = []; let writeIndex = 0, active;
const server = http.createServer((request, reply) => {
  const chunks = []; request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push(body);
    const content = body.messages.at(-1)?.content;
    const results = Array.isArray(content) && content.some(block => block.type === 'tool_result');
    reply.writeHead(200, { 'content-type': 'text/event-stream' });
    const event = (name, data) => reply.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
    event('message_start', { type: 'message_start', message: { id: `message_${requests.length}`, type: 'message', role: 'assistant', model: 'fixture',
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4, output_tokens: 0 } } });
    if (results) {
      event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'fixture finished' } });
    } else {
      const index = ++writeIndex;
      event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: `write-${index}`, name: 'write_file', input: {} } });
      event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ path: `result-${index}.txt`, content: `approved-${index}` }) } });
    }
    event('content_block_stop', { type: 'content_block_stop', index: 0 });
    event('message_delta', { type: 'message_delta', delta: { stop_reason: results ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 12 } });
    event('message_stop', { type: 'message_stop' }); reply.end();
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3', TMPDIR: temporary,
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'ZELLIJ', 'NO_COLOR', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS'].includes(key)) delete env[key];
const text = () => active.screen.lines().join('\n');
const ready = () => text().includes('· ready') && !text().includes('Allow once') && !/^Config$/m.test(text());
const send = value => active.child.stdin.write(value);
const notices = () => [...active.raw.matchAll(/\x1b\]9;Permission needed\x07/g)].length;
const bells = () => [...active.raw.replace(/\x1b\]0;[^\x07]*(?:\x07|\x1b\\)/g, '').matchAll(/\x07/g)].length;
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'));
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; if (active?.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\n${text()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch(resume) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w297-local-notifications.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'ask'])], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(100, 30), decoder = new StringDecoder('utf8');
  const owner = { child, screen, raw: '', closed: new Promise(resolve => child.once('close', resolve)), noticeAt: [] }; active = owner; children.push(owner);
  const output = chunk => { const decoded = decoder.write(chunk); owner.raw += decoded; screen.write(decoded); if (decoded.includes('\x1b]9;Permission needed\x07')) owner.noticeAt.push(Date.now()); };
  child.stdout.on('data', output); child.stderr.on('data', output); await until(ready, 'startup ready', 30000);
}
async function stop() { send('\x15/exit\r'); pass('CLI exits zero', await Promise.race([active.closed, delay(6000).then(() => 'timeout')]) === 0); active.screen.close(); }
async function openConfig() { send('/config\r'); await until(() => /^Config$/m.test(text()), 'Config opens'); send('Local notifications\r'); await until(() => /Local notifications\s+‹/.test(text()), 'notification row selected'); }
async function closeConfig() { send('\x1b'); await delay(100); await until(ready, 'Config closes'); }
async function cycle(expected, effective = expected) { send('\x1b[C'); await until(() => stored().preferredNotifChannel === expected && !text().includes('Saving settings'), `persist ${expected}`); pass(`Config persists ${expected} and displays ${effective}`, new RegExp(`Local notifications\\s+‹ ${effective} ›`).test(text())); }
async function permission() { const before = writeIndex; send(`owned permission ${before + 1}\r`); await until(() => text().includes('Allow once') && writeIndex === before + 1, 'actual write_file permission'); return writeIndex; }
async function answer(index, allow) { send(allow ? '\r' : '\x1b'); if (!allow) await delay(100); await until(ready, 'permission turn completes'); pass(`tool ${index} ${allow ? 'writes after approval' : 'stays absent after cancellation'}`, allow ? fs.readFileSync(path.join(workspace, `result-${index}.txt`), 'utf8') === `approved-${index}` : !fs.existsSync(path.join(workspace, `result-${index}.txt`))); }
try {
  await launch(); const sessions = journals().length; await openConfig(); pass('Local notifications defaults to auto', /Local notifications\s+‹ auto ›/.test(text()));
  for (const value of ['iterm2', 'terminal_bell', 'iterm2_with_bell', 'kitty', 'ghostty', 'notifications_disabled', 'auto', 'iterm2']) await cycle(value);
  await closeConfig(); pass('channel changes retain the current session and authored data', journals().length === sessions && stored().keep === 7);
  let index = await permission(), before = notices(), began = Date.now();
  await delay(3000); pass('pending permission emits no notification before six seconds', notices() === before && !fs.existsSync(path.join(workspace, `result-${index}.txt`)));
  send('\x1b[O\x1b[I\x1b[<35;5;5M');
  await until(() => notices() === before + 1, 'local OSC9 notification', 6000);
  pass('focus reports and idle pointer motion leave the six-second gate intact', Date.now() - began >= 5800 && Date.now() - began < 9000);
  pass('Notification hook completes before local terminal output', hookRows().some(row => row.message === 'Permission needed' && row.type === 'permission_prompt' && row.at <= active.noticeAt.at(-1)));
  pass('the independent tool-specific hook still fires', hookRows().some(row => row.message === 'Permission needed to use write_file'));
  await delay(1000); pass('the same pending prompt sends once', notices() === before + 1); await answer(index, true);
  index = await permission(); before = notices(); began = Date.now(); await delay(3000); send('\x1b[B'); await delay(3400);
  pass('a real arrow key postpones the first six-second check', notices() === before);
  await until(() => notices() === before + 1, 'notification after recent interaction', 8000);
  pass('the periodic gate resumes after inactivity', Date.now() - began >= 11500); send('\x1b[A'); await answer(index, true);
  index = await permission(); before = notices(); await answer(index, false); await delay(6300); pass('early cancellation leaves no late notification', notices() === before);
  await openConfig(); await cycle('terminal_bell'); await cycle('iterm2_with_bell'); await cycle('kitty'); await cycle('ghostty'); await cycle('notifications_disabled'); await closeConfig();
  index = await permission(); const disabledBefore = bells(), genericBefore = hookRows().filter(row => row.message === 'Permission needed').length;
  await delay(6400); pass('disabled channel retains its hook and emits no local protocol', hookRows().filter(row => row.message === 'Permission needed').length === genericBefore + 1 && bells() === disabledBefore); await answer(index, false);
  const pinnedFile = journals()[0], pinnedId = pinnedFile.slice(0, -6); await stop(); await launch(pinnedId); await openConfig();
  pass('resume retains its original auto snapshot', /Local notifications\s+‹ auto ›/.test(text())); await closeConfig(); await stop();
  await launch(); await openConfig(); pass('a fresh session reads the saved disabled channel', /Local notifications\s+‹ notifications_disabled ›/.test(text())); await closeConfig(); await stop();
  fs.writeFileSync(project, JSON.stringify({ preferredNotifChannel: 'ghostty' })); await launch(); await openConfig();
  pass('a higher project layer supplies the effective channel', /Local notifications\s+‹ ghostty ›/.test(text())); await cycle('notifications_disabled', 'ghostty'); await closeConfig(); await stop();
  fs.writeFileSync(project, JSON.stringify({ preferredNotifChannel: 'invalid' })); await launch(); await openConfig();
  pass('an invalid project channel falls back to the authored disabled user channel', /Local notifications\s+‹ notifications_disabled ›/.test(text())); await closeConfig(); await stop();
  fs.rmSync(project); const values = stored(); delete values.preferredNotifChannel; fs.writeFileSync(userFile, JSON.stringify(values)); await launch();
  const beforeReload = journals().length; send('/reload\r'); await until(() => ready() && journals().length === beforeReload + 1, 'reload successor'); await openConfig();
  pass('reload deletion restores auto', /Local notifications\s+‹ auto ›/.test(text())); await closeConfig(); await stop();
  pass('all session locks release', fs.readdirSync(path.join(workspace, '.agent')).every(file => !file.endsWith('.lock')));
  pass('requests use only the owned loopback provider', requests.length === 8 && requests.every(request => request.model === 'fixture'));
  const identity = captureIdentity(root);
  if (process.env.W297_RESULT) fs.writeFileSync(process.env.W297_RESULT, JSON.stringify({ checks, requests: requests.length, paidUpstreamCalls: 0, identity }, null, 2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  for (const owner of children) { if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]); if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); } owner.screen.close(); }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true });
}
