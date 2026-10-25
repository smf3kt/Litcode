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
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'mcp-template-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
fs.mkdirSync(workspace); fs.mkdirSync(user);
const notes = path.join(temporary, 'rpc.jsonl'), fixture = path.join(temporary, 'server.mjs');
const pty = path.join(temporary, 'terminal.exp');
fs.writeFileSync(pty, `set stty_init "rows 40 columns 120"\nsource {${path.join(root, 'scripts/pty-cli.exp')}}\n`);
fs.writeFileSync(fixture, `import fs from 'node:fs';
import readline from 'node:readline';
const notes=process.argv[2];
const record=value=>fs.appendFileSync(notes,JSON.stringify({pid:process.pid,...value})+'\\n');
const reply=(id,result)=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\\n');
record({kind:'boot'});
readline.createInterface({input:process.stdin}).on('line',line=>{
  const m=JSON.parse(line);record({kind:'rpc',method:m.method,params:m.params});
  if(m.id===undefined)return;
  if(m.method==='initialize')reply(m.id,{protocolVersion:m.params.protocolVersion,capabilities:{resources:{},completions:{}},serverInfo:{name:'repo',version:'1'}});
  else if(m.method==='resources/list')reply(m.id,{resources:[]});
  else if(m.method==='resources/templates/list')reply(m.id,{resourceTemplates:[{uriTemplate:'repo://{org}/{file}',name:'Files'},{uriTemplate:'quoted://{name}',name:'Spaced names'}]});
  else if(m.method==='completion/complete'){
    const values=m.params.argument.name==='org'?['acme']:m.params.argument.name==='file'?['report.md']:['a b'];
    reply(m.id,{completion:{values}});
  }else reply(m.id,{});
});
`);
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture-template', thinking: false,
  promptSuggestionEnabled: false, prefersReducedMotion: true, preferredNotifChannel: 'notifications_disabled',
  features: { mcpCatalog: true }, mcpServers: { repo: { command: process.execPath, args: [fixture, notes] } } }));
let modelRequests = 0;
const gateway = http.createServer((_request, response) => { modelRequests++; response.writeHead(500).end('Unexpected model call'); });
await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', FORCE_COLOR: '3', LC_ALL: 'en_US.UTF-8', HOME: temporary };
for (const name of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(name)
  || ['TMUX', 'STY', 'NO_COLOR', 'CLAUDE_CODE_REMOTE'].includes(name)) delete env[name];
Object.assign(env, { LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${gateway.address().port}`,
  LLM_MODEL: 'fixture-template', LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' });
const terminal = new TerminalScreen(120, 40);
const child = spawn('/usr/bin/expect', [pty, process.execPath, path.join(root, 'bin/litcode.mjs'),
  '--workspace', workspace, '--user-dir', user, '--interactive', '--no-inherit-gateway'],
{ cwd: root, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
const closed = new Promise(resolve => child.once('close', resolve));
let errors = '';
child.stdout.setEncoding('utf8'); child.stdout.on('data', text => terminal.write(text));
child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { errors += text; });
const records = () => fs.existsSync(notes) ? fs.readFileSync(notes, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
const completions = () => records().filter(row => row.method === 'completion/complete');
const screen = () => terminal.lines().join('\n');
const send = text => child.stdin.write(text);
const checks = [];
function pass(label, condition = true) { assert.ok(condition, `${label}\n${screen()}`); checks.push(label); console.log(`PASS ${label}`); }
async function until(predicate, label) {
  const deadline = Date.now() + 12000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, `${label}\n${errors}\n${screen()}`);
    assert.ok(child.exitCode === null && child.signalCode === null, `${label}: CLI exited\n${errors}`);
    await delay(25);
  }
}
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
try {
  await until(() => screen().includes('? for shortcuts'), 'CLI ready');
  send('@repo:repo://a');
  await until(() => completions().length > 0 && screen().includes('acme/'), 'server argument completion appears');
  pass('typed arguments reach completion/complete', completions()[0].params.ref.uri === 'repo://{org}/{file}'
    && completions()[0].params.argument.name === 'org' && completions()[0].params.argument.value === 'a');
  pass('the first argument omits context', completions()[0].params.context === undefined);
  send('\t');
  await until(() => completions().some(row => row.params.argument.name === 'file') && screen().includes('report.md'), 'next argument completion');
  pass('partial acceptance forwards resolved arguments', completions().find(row => row.params.argument.name === 'file').params.context.arguments.org === 'acme');
  send('\t'); await delay(80);
  pass('final acceptance writes the complete URI', terminal.lines().some(line => line.includes('@repo:repo://acme/report.md')));
  pass('completion acceptance sends no model request', modelRequests === 0);
  send('\x01\x0b@repo:quoted://a');
  await until(() => completions().some(row => row.params.ref.uri === 'quoted://{name}') && screen().includes('a b'), 'spaced completion');
  send('\t'); await delay(80);
  pass('final spaced value closes its quote', terminal.lines().some(line => line.includes('@"repo:quoted://a b"')));
  send('\x01\x0b/exit\r');
  assert.equal(await Promise.race([closed, delay(6000).then(() => 'timeout')]), 0, errors);
  pass('all session locks release', fs.readdirSync(path.join(workspace, '.agent')).every(name => !name.endsWith('.lock')));
  pass('owned MCP process exits', records().filter(row => row.kind === 'boot').every(row => !alive(row.pid)));
  pass('the whole chain is model-free', modelRequests === 0);
  fs.writeFileSync(path.join(temporary, 'result.json'), JSON.stringify({ checks, modelRequests, completions: completions().length }, null, 2));
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
