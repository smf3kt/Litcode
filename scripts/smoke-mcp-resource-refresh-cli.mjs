import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'mcp-resource-refresh-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const notes = path.join(temporary, 'rpc.jsonl'), control = path.join(temporary, 'control.json');
const fixture = path.join(temporary, 'server.mjs'), pty = path.join(temporary, 'terminal.exp');
fs.writeFileSync(control, JSON.stringify({ generation: 1 }));
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
fs.writeFileSync(fixture, `import fs from 'node:fs';
import readline from 'node:readline';
const [notes,control]=process.argv.slice(2);
const record=value=>fs.appendFileSync(notes,JSON.stringify({pid:process.pid,...value})+'\\n');
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');
let current=JSON.parse(fs.readFileSync(control,'utf8')).generation;
record({kind:'boot'});
const timer=setInterval(()=>{const next=JSON.parse(fs.readFileSync(control,'utf8')).generation;if(next!==current){current=next;record({kind:'notify',generation:current});process.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/resources/list_changed'})+'\\n');}},30);
process.stdin.on('end',()=>{clearInterval(timer);process.exit(0)});
readline.createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line),state=JSON.parse(fs.readFileSync(control,'utf8'));record({kind:'rpc',method:m.method,generation:state.generation});
  if(m.id===undefined)return;
  if(m.method==='initialize')reply(m.id,{protocolVersion:m.params.protocolVersion,capabilities:{resources:{listChanged:true}},serverInfo:{name:'docs',version:'1'}});
  else if(m.method==='resources/list')reply(m.id,{resources:state.generation===3?[]:[{uri:'doc://generation'+state.generation,name:'RESOURCE_'+state.generation}]});
  else if(m.method==='resources/templates/list'){
    if(state.failTemplate)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,error:{code:-32603,message:'owned template listing failure'}})+'\\n');
    else reply(m.id,{resourceTemplates:state.generation===3?[]:[{uriTemplate:'template://generation'+state.generation+'/{id}',name:'TEMPLATE_'+state.generation}]});
  }else reply(m.id,{});
});
`);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-refresh', thinking: false,
  promptSuggestionEnabled: false, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled',
  features: { mcpCatalog: true }, mcpServers: { docs: { command: process.execPath, args: [fixture, notes, control] } } }));
let modelRequests = 0;
const gateway = http.createServer((_request, response) => { modelRequests++; response.writeHead(500).end('Unexpected model call'); });
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8', HOME: temporary };
for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name) || ['TMUX', 'STY', 'NO_COLOR'].includes(name)) delete env[name];
Object.assign(env, { LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${gateway.address().port}`,
  LLM_MODEL: 'fixture-refresh', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });
const terminal = new TerminalScreen(120, 40);
const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'),
  '--workspace', workspace, '--user-dir', user, '--interactive', '--no-inherit-gateway'],
{ cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
const closed = new Promise(resolve => child.once('close', resolve));
let errors = '';
child.stdout.setEncoding('utf8'); child.stdout.on('data', text => terminal.write(text));
child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { errors += text; });
const records = () => fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const screen = () => terminal.lines().join('\n');
const send = text => child.stdin.write(text);
const checks = [];
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function until(predicate, label) {
  const end = Date.now() + 12000;
  while (!predicate()) {
    assert.ok(Date.now() < end, `${label}\n${errors}\n${screen()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}: CLI exited`);
    await delay(25);
  }
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
try {
  await until(() => screen().includes('? for shortcuts'), 'CLI ready');
  send('@docs'); await until(() => screen().includes('RESOURCE_1') && screen().includes('TEMPLATE_1'), 'initial catalog');
  pass('initial resource and template rows appear');
  const journalDir = path.join(workspace, '.agent');
  const journal = path.join(journalDir, fs.readdirSync(journalDir).find(name => name.endsWith('.jsonl')));
  const before = fs.readFileSync(journal);
  fs.writeFileSync(control, JSON.stringify({ generation: 2, failTemplate: true }));
  await until(() => screen().includes('RESOURCE_2'), 'resource notification refresh');
  pass('the same draft receives changed resources', !screen().includes('RESOURCE_1'));
  pass('failed template refresh keeps its prior rows', screen().includes('TEMPLATE_1'));
  fs.writeFileSync(control, JSON.stringify({ generation: 3 }));
  await until(() => records().some(row => row.method === 'resources/templates/list' && row.generation === 3)
    && !screen().includes('RESOURCE_2') && !screen().includes('TEMPLATE_1'), 'empty catalog removes rows');
  pass('successful empty lists remove both families');
  fs.writeFileSync(control, JSON.stringify({ generation: 4 }));
  await until(() => screen().includes('RESOURCE_4') && screen().includes('TEMPLATE_4'), 'catalog recovery');
  pass('later notifications repopulate the same draft');
  pass('catalog refresh leaves the journal passive', before.equals(fs.readFileSync(journal)));
  pass('resource notifications send no model requests', modelRequests === 0);
  send('\x01\x0b/exit\r'); assert.equal(await Promise.race([closed, delay(6000).then(() => 'timeout')]), 0, errors);
  pass('session locks release', fs.readdirSync(journalDir).every(name => !name.endsWith('.lock')));
  pass('owned MCP process exits', records().filter(row => row.kind === 'boot').every(row => !alive(row.pid)));
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, modelRequests }, null, 2));
  console.log(`${checks.length} checks, ${modelRequests} model requests, fixture ${temporary}`);
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    await Promise.race([closed, delay(1000)]);
    if (child.exitCode === null && child.signalCode === null) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
  for (const row of records().filter(row => row.kind === 'boot')) if (alive(row.pid)) process.kill(row.pid, 'SIGTERM');
  terminal.close(); gateway.closeAllConnections(); await new Promise(resolve => gateway.close(resolve));
}
