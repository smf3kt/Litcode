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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w298-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git')); fs.mkdirSync(path.join(workspace, '.harness'));
const userFile = path.join(user, 'settings.json'), heldTool = path.join(temporary, 'tool-held'), releaseTool = path.join(temporary, 'tool-release'), hookScript = path.join(temporary, 'tool-hook.mjs');
fs.writeFileSync(hookScript, "import fs from 'node:fs'; fs.writeFileSync(process.argv[2],'held'); while(!fs.existsSync(process.argv[3]))await new Promise(r=>setTimeout(r,10));");
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 7, prefersReducedMotion: true, showTurnDuration: false,
  hooks: { PostToolUse: [{ command: `${quote(process.execPath)} ${quote(hookScript)} ${quote(heldTool)} ${quote(releaseTool)}` }] } }));
const children = [], requests = [], checks = []; let active, pending;
const server = http.createServer((request, reply) => {
  const chunks = []; request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8')); requests.push(body);
    const content = body.messages.at(-1)?.content, results = Array.isArray(content) && content.some(block => block.type === 'tool_result');
    const finish = () => {
      reply.writeHead(200, { 'content-type': 'text/event-stream' });
      const event = (name, data) => reply.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
      event('message_start', { type: 'message_start', message: { id: `message_${requests.length}`, type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 4, output_tokens: 0 } } });
      if (results) {
        event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
        event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'fixture finished' } });
      } else {
        event('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'write', name: 'write_file', input: {} } });
        event('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ path: 'result.txt', content: 'approved' }) } });
      }
      event('content_block_stop', { type: 'content_block_stop', index: 0 });
      event('message_delta', { type: 'message_delta', delta: { stop_reason: results ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 12 } });
      event('message_stop', { type: 'message_stop' }); reply.end();
    };
    if (results) finish(); else pending = finish;
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3', TMPDIR: temporary,
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL', 'LLM_EFFORT', 'LLM_THINKING', 'TMUX', 'STY', 'ZELLIJ', 'NO_COLOR', 'TERM_PROGRAM', 'TERM_PROGRAM_VERSION', 'LITCODE_DISABLE_TERMINAL_TITLE'].includes(key)) delete env[key];
const text = () => active.screen.lines().join('\n');
const ready = () => text().includes('· ready') && !text().includes('Allow once') && !/^Config$/m.test(text());
const send = value => active.child.stdin.write(value);
const titles = () => [...active.raw.matchAll(/\x1b\]0;([^\x07\x1b]*)(?:\x07|\x1b\\)/g)].map(match => match[1]);
const last = () => titles().at(-1);
const journals = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'));
async function until(predicate, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; if (active?.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\nlast title=${last()}\n${text()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch({ resume, environment } = {}) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w298-terminal-title.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--interactive',
    ...(resume ? ['--resume', resume] : ['--user-dir', user, '--no-inherit-gateway', '--permission-mode', 'ask'])],
    { cwd: root, env: { ...env, ...environment }, stdio: ['pipe', 'pipe', 'pipe'] });
  const screen = new TerminalScreen(100, 30), decoder = new StringDecoder('utf8');
  const owner = { child, screen, raw: '', closed: new Promise(resolve => child.once('close', resolve)) }; active = owner; children.push(owner);
  const output = chunk => { const decoded = decoder.write(chunk); owner.raw += decoded; screen.write(decoded); };
  child.stdout.on('data', output); child.stderr.on('data', output); await until(ready, 'startup ready', 30000);
}
async function stop() { send('\x15/exit\r'); pass('CLI exits zero', await Promise.race([active.closed, delay(6000).then(() => 'timeout')]) === 0); const count = titles().length; await delay(1050); pass('closed CLI emits no late title frames', titles().length === count); active.screen.close(); }
async function configPanel() { send('/config\r'); await until(() => /^Config$/m.test(text()), 'Config opens'); }
async function closePanel() { for (let i = 0; i < 3 && /^Config$/m.test(text()); i++) { send('\x1b'); await delay(100); } await until(ready, 'Config closes'); }
async function reload(expected) { const count = journals().length; send('/reload\r'); await until(() => ready() && journals().length === count + 1 && last() === expected, 'reload adopts title setting'); }
try {
  await launch(); pass('startup emits the source idle prefix with the neutral default', last() === '✳ LiTcode');
  send('/name live title\r'); await until(() => last() === '✳ live title' && ready(), 'rename title'); pass('rename alias updates the terminal and durable session title');
  const firstId = journals()[0].slice(0, -6); await configPanel(); const idle = titles().length; await delay(1050);
  pass('local Config remains static while its turn owner is running', last() === '✳ live title' && titles().length === idle); await closePanel();
  send('owned model title fixture\r'); await until(() => pending !== undefined && /^[◐◑] live title$/.test(last()), 'model loading title');
  const frames = titles().length; await until(() => titles().length > frames, '960ms title animation', 3000); pass('actual model loading alternates both source prefix frames', titles().includes('◐ live title') && titles().includes('◑ live title'));
  send('\x1b[O'); await delay(120); const blurred = titles().length; await delay(1100); pass('blurred terminal pauses title animation', titles().length === blurred);
  send('\x1b[I'); await until(() => titles().length > blurred, 'focused animation resumes', 2500); pass('focus resumes the existing title owner');
  pending(); pending = undefined; await until(() => text().includes('Allow once') && last() === '✳ live title', 'permission waits with static title');
  const waiting = titles().length; await delay(1050); pass('permission wait stops animation before tool effects', titles().length === waiting && !fs.existsSync(path.join(workspace, 'result.txt')));
  send('\r'); await until(() => fs.existsSync(heldTool) && fs.existsSync(path.join(workspace, 'result.txt')), 'approved tool waits in its owned hook');
  send('\x1bp'); await until(() => text().includes('Select model'), 'live model picker during tool work');
  pass('live model picker retains the busy title during tool work', /^[◐◑] live title$/.test(last()));
  const liveFrames = titles().length; await until(() => titles().length > liveFrames, 'animation continues beside model picker', 2500);
  pass('live model picker keeps the title animation clock running'); send('\x1bp'); await until(() => !text().includes('Select model'), 'live picker closes');
  fs.writeFileSync(releaseTool, 'go'); await until(() => ready(), 'approved tool and final response'); pass('approved tool writes and title returns to idle', fs.readFileSync(path.join(workspace, 'result.txt'), 'utf8') === 'approved' && last() === '✳ live title');
  fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 7, terminalTitleFromRename: false })); await reload('✳ LiTcode'); pass('reload applies terminalTitleFromRename false');
  send('/rename stored hidden\r'); await until(() => ready() && journals().some(file => fs.readFileSync(path.join(workspace, '.agent', file), 'utf8').includes('"kind":"title","title":"stored hidden"')), 'rename while disabled'); pass('false retains the stored name without applying it to the tab', last() === '✳ LiTcode');
  fs.writeFileSync(userFile, JSON.stringify({ model: 'fixture', keep: 7 })); await reload('✳ stored hidden'); pass('reload deletion restores rename title by the source true default');
  send('/clear\r'); await until(() => ready() && last() === '✳ LiTcode', 'clear title owner'); pass('clear binds a fresh title authority');
  send(`/resume ${firstId}\r`); await until(() => ready() && last() === '✳ live title', 'switch session title owner'); pass('session switch reads its own durable title'); await stop();
  await launch({ resume: firstId }); pass('process resume restores its own title and original settings', last() === '✳ live title'); await stop();
  await launch({ environment: { LITCODE_DISABLE_TERMINAL_TITLE: '1' } }); pass('disable environment option suppresses startup OSC0', titles().length === 0); send('/rename suppressed\r'); await until(ready, 'disabled rename'); await delay(1050); pass('disable environment option suppresses renamed OSC0', titles().length === 0); await stop();
  await launch({ environment: { TMUX: 'owned-fixture' } }); send('mux model fixture\r'); await until(() => pending !== undefined, 'mux pending model'); const staticCount = titles().length; await delay(1100);
  pass('multiplexer default keeps a direct static title while busy', last() === '✳ LiTcode' && titles().length === staticCount && !active.raw.includes('\x1bPtmux;\x1b\x1b]0;'));
  pending(); pending = undefined; await until(() => text().includes('Allow once'), 'mux permission'); send('\x1b'); await delay(100); await until(ready, 'mux cancellation'); await stop();
  pass('session locks release after every process', fs.readdirSync(path.join(workspace, '.agent')).every(file => !file.endsWith('.lock')));
  pass('only owned loopback requests were used', requests.length === 4 && requests.every(request => request.model === 'fixture'));
  const identity = captureIdentity(root); if (process.env.W298_RESULT) fs.writeFileSync(process.env.W298_RESULT, JSON.stringify({ checks, requests: requests.length, paidUpstreamCalls: 0, identity }, null, 2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  fs.writeFileSync(releaseTool, 'go'); pending?.();
  for (const owner of children) { if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]); if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); } owner.screen.close(); }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true });
}
