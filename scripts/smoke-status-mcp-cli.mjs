import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'status-mcp-cli-')));
const workspace = path.join(temporary, 'workspace'), empty = path.join(temporary, 'empty'), userDir = path.join(temporary, 'user');
for (const directory of [workspace, empty, userDir]) fs.mkdirSync(directory);
const notes = path.join(temporary, 'notes.jsonl'), control = path.join(temporary, 'control.json');
const fixture = path.join(temporary, 'server.mjs'), pty = path.join(temporary, 'pty.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
fs.writeFileSync(fixture, `import fs from 'node:fs';
import readline from 'node:readline';
const [notes,name,control]=process.argv.slice(2);
const record=value=>fs.appendFileSync(notes,JSON.stringify({name,pid:process.pid,...value})+'\\n');
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');
record({kind:'boot'});
readline.createInterface({input:process.stdin}).on('line',line=>{
  const message=JSON.parse(line);record({kind:'rpc',method:message.method});
  if(message.id===undefined)return;
  if(message.method==='initialize')reply(message.id,{protocolVersion:message.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name,version:'1'}});
  else if(message.method==='tools/list'){
    if(name==='alpha'&&fs.existsSync(control)&&JSON.parse(fs.readFileSync(control,'utf8')).fail)
      process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:message.id,error:{code:-32603,message:'owned discovery failure'}})+'\\n');
    else reply(message.id,{tools:[{name:'ping',inputSchema:{type:'object',properties:{}}}]});
  }else reply(message.id,{});
});
`);
const baseline = process.argv.includes('--baseline'), checks = [], captures = {}, owners = [];
let active, modelRequests = 0;
const gateway = http.createServer((_request, response) => { modelRequests++; response.writeHead(500); response.end('Unexpected fixture model request'); });
const records = () => fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const boots = name => records().filter(row => row.kind === 'boot' && row.name === name).map(row => row.pid);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const frame = () => active.screen.lines().join('\n');
const send = text => active.child.stdin.write(text);
const ready = () => frame().includes('· ready') && !/Session kind: interactive|Manage MCP servers|alpha MCP Server/.test(frame());
const journals = directory => fs.readdirSync(path.join(directory, '.agent')).filter(name => name.endsWith('.jsonl'));
const journal = () => fs.readFileSync(path.join(active.workspace, '.agent', journals(active.workspace)[0]));
function pass(label, condition = true) { assert.ok(condition, `${label}\n${frame()}`); checks.push(label); }
async function until(predicate, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (!predicate()) {
    assert.ok(Date.now() < end, `${label}\n${active.stderr}\n${frame()}`);
    assert.ok(active.child.exitCode === null && active.child.signalCode === null, `${label}: CLI exited\n${active.stderr}`);
    await delay(25);
  }
}
async function launch(directory, resume) {
  const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8' };
  for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY', 'NO_COLOR'].includes(name)) delete env[name];
  Object.assign(env, { LLM_API_KEY: 'owned-fixture', LLM_BASE_URL: `http://127.0.0.1:${gateway.address().port}`,
    LLM_MODEL: 'fixture-status', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });
  const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'), '--workspace', directory,
    ...(resume ? ['--resume', resume] : ['--user-dir', userDir]), '--interactive', '--no-inherit-gateway'],
  { cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
  const owner = { child, workspace: directory, screen: new TerminalScreen(120, 40), stderr: '',
    closed: new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); }) };
  active = owner; owners.push(owner);
  const decoder = new StringDecoder('utf8');
  child.stdout.on('data', chunk => owner.screen.write(decoder.write(chunk)));
  child.stderr.on('data', chunk => { owner.stderr += chunk.toString('utf8'); });
  await until(ready, 'CLI ready');
}
async function stop() {
  send('/exit\r');
  assert.equal(await Promise.race([active.closed, delay(6000).then(() => 'timeout')]), 0, active.stderr);
  pass('CLI exits zero');
  pass('session locks release', fs.readdirSync(path.join(active.workspace, '.agent')).every(name => !name.endsWith('.lock')));
}
async function closePanel() { send('\x1b'); await until(ready, 'panel closes'); }
async function status(label, expected) {
  const before = journal(), rpc = records();
  send('/status\r'); await until(() => frame().includes('Session kind: interactive'), 'Status opens');
  captures[label] = frame();
  if (expected === undefined || baseline) pass(`${label} omits summary`, !frame().includes('MCP servers:'));
  else pass(`${label} summary`, frame().includes(`MCP servers: ${expected} · /mcp`));
  pass(`${label} reads no RPC or new transport`, JSON.stringify(records()) === JSON.stringify(rpc));
  pass(`${label} preserves journal`, before.equals(journal()));
  await closePanel();
}
async function openAlpha() {
  send('/mcp\r'); await until(() => frame().includes('Manage MCP servers'), 'MCP list');
  send('\r'); await until(() => frame().includes('alpha MCP Server'), 'alpha details');
}
async function disableAlpha() {
  await openAlpha(); send('\x1b[B\x1b[B\r');
  await until(() => frame().includes('alpha: disabled'), 'alpha disabled'); await closePanel();
}
try {
  await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
  const base = { model: 'fixture-status', thinking: false, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled', features: { mcpCatalog: true } };
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify(base));
  await launch(empty); await status('empty'); await stop();
  const settings = { ...base, mcpServers: Object.fromEntries(['alpha', 'beta', 'ide'].map(name => [name,
    { command: process.execPath, args: [fixture, notes, name, control] }])) };
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify(settings));
  await launch(workspace);
  pass('three owned transports start once', ['alpha', 'beta', 'ide'].every(name => boots(name).length === 1));
  const sessionId = JSON.parse(journal().toString('utf8').split('\n')[0]).id;
  await status('connected', '2 connected'); await status('repeated', '2 connected');
  if (!baseline) {
    const alpha = boots('alpha')[0], beta = boots('beta')[0], ide = boots('ide')[0];
    await disableAlpha(); await until(() => !alive(alpha), 'alpha transport reaped');
    pass('disable preserves peer transports', alive(beta) && alive(ide));
    await status('disabled', '1 connected, 1 disabled');
    process.kill(beta, 'SIGTERM'); await until(() => !alive(beta), 'owned beta exit'); await delay(80);
    await status('disconnected', '1 disabled, 1 failed');
    fs.writeFileSync(control, JSON.stringify({ fail: true }));
    await openAlpha(); send('\r'); await until(() => ready() && frame().includes('error:'), 'failed enable returns to composer');
    await status('failed-enable', '2 failed');
    pass('failed enable reaps candidate', boots('alpha').every(pid => !alive(pid)));
    fs.writeFileSync(control, '{}'); send('/mcp-reconnect alpha\r');
    await until(() => ready() && boots('alpha').length === 3 && alive(boots('alpha').at(-1)), 'alpha reconnect');
    await status('reconnected', '1 connected, 1 failed');
    await disableAlpha(); await status('saved-disabled', '1 disabled, 1 failed'); await stop();
    await launch(workspace, sessionId); await status('original-resume', '1 connected, 1 disabled');
    pass('resume retains disabled without spawning alpha', boots('alpha').length === 3);
    pass('only original journal is retained', journals(workspace).length === 1); await stop();
  } else await stop();
  pass('zero model requests', modelRequests === 0);
  pass('all owned transports exit', records().filter(row => row.kind === 'boot').every(row => !alive(row.pid)));
  pass('settings definitions stay unchanged', fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8') === JSON.stringify(settings));
  console.log(JSON.stringify({ cli: 'passed', baseline, checks: checks.length, modelRequests,
    mcpRequests: records().filter(row => row.kind === 'rpc').length, locksReleased: true, fixture: temporary }));
} finally {
  fs.writeFileSync(path.join(temporary, 'captures.json'), JSON.stringify(captures, null, 2));
  for (const owner of owners) {
    if (owner.child.exitCode === null && owner.child.signalCode === null) {
      try { process.kill(-owner.child.pid, 'SIGKILL'); } catch { owner.child.kill('SIGKILL'); }
      await owner.closed;
    }
    owner.screen.close();
  }
  for (const row of records().filter(row => row.kind === 'boot')) if (alive(row.pid)) process.kill(row.pid, 'SIGTERM');
  gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve));
}
