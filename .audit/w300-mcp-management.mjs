import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { captureIdentity } from '../scripts/identity.mjs';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w300-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user'), notes = path.join(temporary, 'notes.jsonl');
const control = path.join(temporary, 'control.json');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const settings = { model: 'fixture', thinking: false, keep: 7, features: { mcpCatalog: true },
  mcpServers: Object.fromEntries(['alpha','beta'].map(name => [name, { command: process.execPath,
    args: [path.join(root, '.audit/w300-mcp-fixture.mjs'), notes, name, ...(name === 'alpha' ? [control] : [])] }])) };
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify(settings));
const checks = [], requests = [], children = [], captures = {};
let active;
const boots = name => fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8').trim().split('\n').filter(Boolean)
  .map(line => JSON.parse(line)).filter(row => row.kind === 'boot' && row.server === name).map(row => row.pid) : [];
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const gateway = http.createServer((request, response) => {
  let text = ''; request.on('data', chunk => { text += chunk; }); request.on('end', () => {
    const body = JSON.parse(text); requests.push(body);
    const message = { id: 'fixture', type: 'message', role: 'assistant', model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } };
    const events = [{ type: 'message_start', message },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `PROBE_DONE_${requests.length}` } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: 'message_stop' }];
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''));
  });
});
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3', TMPDIR: temporary,
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${gateway.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL','LLM_THINKING','LLM_EFFORT','TMUX','STY','ZELLIJ','NO_COLOR','TERM_PROGRAM'].includes(key)) delete env[key];
const screen = () => active.screen.lines().join('\n');
const send = text => active.child.stdin.write(text);
const ready = () => screen().includes('· ready') && !screen().includes('Manage MCP servers')
  && !screen().includes('alpha MCP Server') && !screen().includes('Tools for alpha');
async function until(predicate, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; if (active.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\n${screen()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch(resume) {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w299-plugin-toggle.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, ...(resume ? [] : ['--user-dir', user]),
    '--interactive', '--no-inherit-gateway', ...(resume ? ['--resume', resume] : [])],
  { cwd: root, env, stdio: ['pipe','pipe','pipe'] });
  const terminal = new TerminalScreen(110,36), decoder = new StringDecoder('utf8');
  active = { child, screen: terminal, raw: '', closed: new Promise(resolve => child.once('close', resolve)) };
  const owner = active; children.push(owner);
  const output = chunk => { const text = decoder.write(chunk); owner.raw += text; terminal.write(text); };
  child.stdout.on('data', output); child.stderr.on('data', output);
  await until(ready, 'startup ready', 30000);
}
async function stop() {
  send('\x15/exit\r'); assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0);
  pass('compiled CLI exits zero');
}
async function closePanel() { send('\x1b'); await until(ready, 'panel returns to ready'); }
async function openList() { send('/mcp\r'); await until(() => screen().includes('Manage MCP servers'), 'server list'); }
async function openAlpha() { send('\r'); await until(() => screen().includes('alpha MCP Server'), 'server details'); }
async function probe() {
  const count = requests.length + 1; send(`probe ${count}\r`);
  await until(() => screen().includes(`PROBE_DONE_${count}`) && ready(), 'owned model turn');
}
const schemas = () => requests.at(-1).tools.map(tool => tool.name);
const journalFiles = () => fs.readdirSync(path.join(workspace, '.agent')).filter(file => file.endsWith('.jsonl'));
try {
  await launch(); await until(() => boots('alpha').length === 1 && boots('beta').length === 1, 'owned servers');
  pass('two local MCP servers start once');
  const alpha = boots('alpha')[0], beta = boots('beta')[0];
  const files = journalFiles(); assert.equal(files.length, 1);
  const first = JSON.parse(fs.readFileSync(path.join(workspace, '.agent', files[0]), 'utf8').split('\n')[0]);
  const original = first.id; pass('active journal identity is bound to its metadata', files[0] === `${original}.jsonl`);
  await probe(); pass('initial model request receives both server schemas', schemas().includes('mcp__alpha__ping') && schemas().includes('mcp__beta__ping'));
  await openList(); pass('list shows the recovered title and two servers', screen().includes('2 servers'));
  await openAlpha(); captures.details = screen();
  pass('details show endpoint and source actions', screen().includes('Command:') && screen().includes('View tools') && screen().includes('Reconnect') && screen().includes('Disable'));
  send('\r'); await until(() => screen().includes('Tools for alpha'), 'tools list');
  pass('View tools opens local inventory', screen().includes('ping'));
  send('\r'); await until(() => screen().includes('Full name: mcp__alpha__ping'), 'tool details'); captures.tool = screen();
  pass('tool detail includes description and schema', screen().includes('Owned alpha ping') && screen().includes('text required: string'));
  pass('tool annotations remain visible metadata', screen().includes('[read-only]') && screen().includes('[destructive]') && screen().includes('[open-world]'));
  send('\x1b'); await until(() => screen().includes('Tools for alpha'), 'detail back'); pass('tool Escape returns to tools');
  send('\x1b'); await until(() => screen().includes('alpha MCP Server'), 'tools back'); pass('tools Escape returns to server details');
  send('\x1b'); await until(() => screen().includes('Manage MCP servers'), 'server back'); pass('server Escape returns to list');
  await openAlpha(); send('\x1b[B\x1b[B\r'); await until(() => screen().includes('alpha: disabled'), 'disabled list');
  pass('disable returns to list with disabled state'); await until(() => !alive(alpha), 'disabled child exit');
  pass('disable reaps only the selected transport', !alive(alpha) && alive(beta) && boots('beta').length === 1);
  await openAlpha(); pass('disabled detail offers only Enable', screen().includes('Enable') && !screen().includes('View tools') && !screen().includes('Reconnect'));
  send('\x1b'); await until(() => screen().includes('Manage MCP servers'), 'disabled back'); await closePanel();
  await probe(); pass('next model request omits disabled schema and keeps peer schema', !schemas().includes('mcp__alpha__ping') && schemas().includes('mcp__beta__ping'));
  await openList(); await openAlpha(); send('\r'); await until(() => screen().includes('alpha: connected'), 'enabled list');
  pass('enable starts exactly one replacement', boots('alpha').length === 2 && alive(boots('alpha')[1]) && alive(beta));
  await closePanel(); await probe(); pass('next model request restores enabled schema', schemas().includes('mcp__alpha__ping'));
  await openList(); await openAlpha(); send('\x1b[B\r'); await until(() => screen().includes('Manage MCP servers'), 'reconnect done');
  pass('reconnect changes one process only', boots('alpha').length === 3 && alive(beta) && boots('beta').length === 1);
  await openAlpha(); const state = path.join(user, 'mcp-state.json'), valid = fs.readFileSync(state, 'utf8');
  fs.writeFileSync(state, '{broken'); const activePid = boots('alpha').at(-1); send('\x1b[B\x1b[B\r');
  await until(() => screen().includes('error: Expected property') && ready(), 'failed state write'); pass('failed state write keeps active process', alive(activePid) && alive(beta));
  pass('failed state write leaves its bytes intact', fs.readFileSync(state, 'utf8') === '{broken'); fs.writeFileSync(state, valid);
  await openList(); await openAlpha(); send('\x1b[B\x1b[B\r'); await until(() => screen().includes('alpha: disabled'), 'final disable');
  await closePanel(); pass('management preserves the active session', journalFiles().length === 1);
  await stop(); pass('exit reaps all owned servers', [...boots('alpha'), ...boots('beta')].every(pid => !alive(pid)));
  const alphaStarts = boots('alpha').length;
  await launch(); pass('fresh CLI honors saved disable without spawning alpha', boots('alpha').length === alphaStarts);
  await openList(); pass('fresh list retains saved disabled choice', screen().includes('alpha: disabled')); await closePanel(); await stop();
  await launch(original); pass('resume honors workspace state without spawning alpha', boots('alpha').length === alphaStarts);
  await openList(); pass('resumed list retains disabled choice', screen().includes('alpha: disabled')); await closePanel();
  await probe(); pass('resumed model request omits disabled schema', !schemas().includes('mcp__alpha__ping'));
  await openList(); await openAlpha(); fs.writeFileSync(control, JSON.stringify({ fail: true }));
  send('\r'); await until(() => screen().includes('error:') && ready(), 'owned enable failure');
  pass('failed enable closes its candidate', boots('alpha').every(pid => !alive(pid)));
  const journals = fs.readFileSync(path.join(workspace, '.agent', `${original}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const catalog = journals.findLast(event => event.kind === 'mcp_catalog');
  pass('failed enable records unavailable separately from enabled intent', catalog.disabledServers.length === 0 && catalog.unavailableServers.includes('alpha'));
  await stop(); fs.writeFileSync(control, '{}'); await launch(original);
  await probe(); pass('healthy original resume restores the enabled schema after discovery failure', schemas().includes('mcp__alpha__ping'));
  await stop(); pass('settings definitions and sibling fields stay intact', JSON.stringify(JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8'))) === JSON.stringify(settings));
  pass('all locks release', fs.readdirSync(path.join(workspace, '.agent')).every(file => !file.endsWith('.lock')));
  pass('all owned transports exit after restart and resume', [...boots('alpha'), ...boots('beta')].every(pid => !alive(pid)));
  const identity = captureIdentity(root);
  if (process.env.W300_RESULT) fs.writeFileSync(process.env.W300_RESULT, JSON.stringify({ checks, captures, modelRequests: requests.length,
    paidUpstreamCalls: 0, identity }, null, 2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  if (process.env.W300_SCREEN) fs.writeFileSync(process.env.W300_SCREEN, screen());
  for (const owner of children) { if (owner.child.exitCode === null) { owner.child.kill('SIGTERM'); await Promise.race([owner.closed, delay(1000)]);
    if (owner.child.exitCode === null) owner.child.kill('SIGKILL'); } owner.screen.close(); }
  for (const pid of [...boots('alpha'), ...boots('beta')]) if (alive(pid)) process.kill(pid, 'SIGTERM');
  gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve)); fs.rmSync(temporary, { recursive: true, force: true });
}
