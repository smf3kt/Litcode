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
import { createPluginTools } from '../dist/plugins.js';

const root = path.resolve(import.meta.dirname, '..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w299-cli-')));
const workspace = path.join(temporary, 'workspace'), user = path.join(temporary, 'user');
for (const directory of [workspace, user, path.join(workspace, '.git'), path.join(workspace, '.harness')]) fs.mkdirSync(directory);
const project = path.join(workspace, '.harness/settings.json');
fs.writeFileSync(path.join(user, 'settings.json'), JSON.stringify({ model: 'fixture', thinking: false, plugins: { enabled: true }, keep: 7 }));
const moduleLog = path.join(temporary, 'module-edits'), pidFile = path.join(temporary, 'mcp-pids'), mcp = path.join(temporary, 'owned-mcp.mjs');
fs.writeFileSync(mcp, "import fs from 'node:fs';import readline from 'node:readline';fs.appendFileSync(process.argv[2],process.pid+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.id===undefined)return;const result=m.method==='initialize'?{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'owned',version:'1'}}:m.method==='tools/list'?{tools:[{name:'echo',description:'Owned local echo',inputSchema:{type:'object',properties:{}}}]}:{};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n')});");
const pids = () => fs.existsSync(pidFile) ? fs.readFileSync(pidFile, 'utf8').trim().split('\n').filter(Boolean).map(Number) : [];
const live = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const editCount = () => fs.existsSync(moduleLog) ? fs.statSync(moduleLog).size : 0;
const install = createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install');
for (const name of ['alpha', 'beta']) {
  const source = path.join(temporary, name); fs.mkdirSync(source); fs.mkdirSync(path.join(source, 'skills/helper'), { recursive: true });
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name, version: '1.0', description: `${name} local description`,
    ...(name === 'alpha' ? { hooks: 'hooks.json', mcpServers: 'mcp.json' } : {}) }));
  if (name === 'alpha') {
    fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify({ hooks: {}, modules: ['./register.mjs'] }));
    fs.writeFileSync(path.join(source, 'mcp.json'), JSON.stringify({ mcpServers: { local: { command: process.execPath, args: [mcp, pidFile] } } }));
    fs.writeFileSync(path.join(source, 'register.mjs'), `import fs from 'node:fs';export default {name:'alpha',tier:'user',patterns:[{pattern:'prompt.edit'}],handlers:{'prompt.edit':async(input,next)=>{fs.appendFileSync(${JSON.stringify(moduleLog)},'x');return next(input)}}};`);
  }
  fs.writeFileSync(path.join(source, 'skills/helper/SKILL.md'), `---\nname: ${name}-helper\ndescription: ${name} local skill\n---\n${name} fixture body`);
  await install.execute({ directory: source }, { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
}
let requests = 0, active;
const children = [], checks = [];
const server = http.createServer((_request, reply) => { requests++; reply.writeHead(500); reply.end(); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const env = { ...process.env, TERM: 'xterm-256color', LC_ALL: 'en_US.UTF-8', FORCE_COLOR: '3', TMPDIR: temporary,
  LLM_API_KEY: 'fixture', LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: 'bearer', LLM_TOKEN_COUNTING: 'estimate' };
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key) || ['LLM_MODEL','LLM_THINKING','LLM_EFFORT','TMUX','STY','ZELLIJ','NO_COLOR','TERM_PROGRAM'].includes(key)) delete env[key];
const text = () => active.screen.lines().join('\n');
const send = value => active.child.stdin.write(value);
const ready = () => text().includes('· ready') && !/^Plugins$/m.test(text()) && !text().includes('Enable plugin') && !text().includes('Disable plugin');
async function until(predicate, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (predicate()) return; if (active.child.exitCode !== null) break; await delay(25); }
  throw new Error(`${label}\n${text()}`);
}
function pass(label, condition = true) { assert.ok(condition, `${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch() {
  const child = spawn('/usr/bin/expect', [path.join(root, '.audit/w299-plugin-toggle.exp'), process.execPath,
    path.join(root, 'bin/personal-harness.mjs'), '--workspace', workspace, '--user-dir', user, '--interactive', '--no-inherit-gateway'],
    { cwd: root, env, stdio: ['pipe','pipe','pipe'] });
  const screen = new TerminalScreen(110,36), decoder = new StringDecoder('utf8');
  active = { child, screen, raw: '', closed: new Promise(resolve => child.once('close', resolve)) }; const owner = active; children.push(owner);
  const output = chunk => { const value = decoder.write(chunk); owner.raw += value; screen.write(value); };
  child.stdout.on('data',output); child.stderr.on('data',output); await until(ready,'startup',30000);
}
async function stop() { send('\x15/exit\r'); pass('compiled CLI exits zero', await Promise.race([active.closed,delay(6000).then(()=>'timeout')]) === 0); active.screen.close(); }
async function closePanel() { send('\x1b'); await delay(90); await until(ready,'panel closed'); }
async function suggestion(name, expected) { send(`/${name}-`); await delay(120); pass(`${name} command completion ${expected ? 'is active' : 'is absent'}`, text().includes(`/${name}-helper`) === expected); send('\x15'); }
async function moduleEdit(expected, label) {
  await delay(70); const before = editCount(); send('probe');
  if (expected) await until(() => editCount() > before, label); else await delay(120);
  pass(label, (editCount() > before) === expected); send('\x15'); await delay(70);
}
async function warning(label) {
  const count = () => (text().match(/This reload changes MCP tools/g) ?? []).length;
  const before = count(); send('/reload-plugins\r');
  await until(() => count() > before && ready(), label);
}
try {
  await launch(); pass('local compiled CLI starts with installed plugins'); await until(() => pids().length === 1, 'initial owned MCP');
  const firstPid = pids()[0]; pass('initial owned MCP is live', live(firstPid)); await moduleEdit(true, 'initial prompt.edit module runs on actual input');
  send('/plugin\r'); await until(()=>/^Plugins$/m.test(text())&&text().includes('alpha (v1.0, project)'),'plugin list');
  pass('list exposes installed choices and Space toggle', text().includes('toggle') && text().includes('beta (v1.0, project)'));
  send(' '); await until(()=>fs.existsSync(project)&&JSON.parse(fs.readFileSync(project,'utf8')).plugins.enabledPlugins.alpha===false,'space persists disable');
  await until(()=>text().includes('run /reload-plugins to apply'),'pending note'); pass('Space persists disabled state and names the reload boundary');
  send(' '); await until(()=>JSON.parse(fs.readFileSync(project,'utf8')).plugins.enabledPlugins.alpha===true,'space reverses');
  pass('repeated Space reverses the pending change'); await closePanel();
  send('/plugin disable alpha\r'); await until(()=>fs.existsSync(project)&&JSON.parse(fs.readFileSync(project,'utf8')).plugins.enabledPlugins.alpha===false&&ready(),'typed disable');
  pass('typed disable saves the installed local plugin'); await suggestion('alpha',true);
  await warning('disable cache warning'); await moduleEdit(true, 'disable warning retains the active prompt.edit module');
  pass('disable warning retains the owned MCP process', live(firstPid) && pids().length === 1);
  send('/memory\r'); await until(() => /^Memory$/m.test(text()), 'memory observes instructions'); await closePanel();
  await moduleEdit(true, 'Memory observation keeps the pending module active');
  send('/config\r'); await until(() => text().includes('Type to filter'), 'Config observer'); send('progressBar\r');
  await until(() => text().includes('Enter/Space change'), 'Config list focus'); send('\r');
  await until(() => JSON.parse(fs.readFileSync(path.join(user, 'settings.json'), 'utf8')).terminalProgressBarEnabled === false, 'Config merged read');
  await closePanel(); await moduleEdit(true, 'Config merged read keeps the pending module active');
  send('/reload-skills\r'); await until(() => text().includes('Reloaded skills:') && ready(), 'skills observer');
  await moduleEdit(true, 'skill rescan keeps the pending module active'); pass('observations retain the owned MCP runtime', live(firstPid) && pids().length === 1);
  send('/reload-plugins --force\r'); await until(()=>text().includes('Reloaded: 1 plugin')&&ready(),'apply disable');
  await until(() => !live(firstPid), 'forced disable releases MCP'); pass('forced disable releases the old owned MCP process', !live(firstPid));
  await moduleEdit(false, 'forced disable removes the prompt.edit module');
  pass('reload counts only active plugins'); await suggestion('alpha',false); await suggestion('beta',true);
  send('/plugin ls --disabled\r'); await until(()=>/^Plugins$/m.test(text())&&text().includes('alpha (v1.0, project)'),'disabled list');
  pass('disabled filter retains the installed plugin'); send('\r'); await until(()=>text().includes('Enable plugin'),'details');
  pass('Enter opens local details and the enable action',text().includes('alpha local description'));
  send('\r'); await until(()=>JSON.parse(fs.readFileSync(project,'utf8')).plugins.enabledPlugins.alpha===true&&/^Plugins$/m.test(text()),'detail enables');
  pass('detail action persists enable and returns to the list'); await closePanel();
  await warning('enable cache warning'); await moduleEdit(false, 'enable warning keeps the prompt.edit module pending');
  pass('enable warning starts no owned MCP process', pids().length === 1 && !live(firstPid)); await suggestion('alpha',false);
  send('/reload-plugins --force\r'); await until(()=>text().includes('Reloaded: 2 plugins')&&ready(),'apply enable');
  await until(() => pids().length === 2, 'forced enable starts MCP'); const secondPid = pids()[1];
  pass('forced enable starts one new owned MCP process', live(secondPid)); await moduleEdit(true, 'forced enable restores the prompt.edit module'); await suggestion('alpha',true);
  send('/plugin disable missing\r'); await until(()=>text().includes('is not installed in this project')&&ready(),'missing name'); pass('missing name has no settings effect');
  send('/plugin\r'); await until(()=>/^Plugins$/m.test(text()),'list before failed write'); const valid=fs.readFileSync(project,'utf8'); fs.writeFileSync(project,'{broken');
  send(' '); await until(()=>ready(),'failed setting read closes cleanly'); pass('invalid settings stay unchanged after a failed toggle',fs.readFileSync(project,'utf8')==='{broken');
  fs.writeFileSync(project,valid); send('/plugin disable alpha\r'); await until(()=>JSON.parse(fs.readFileSync(project,'utf8')).plugins.enabledPlugins.alpha===false&&ready(),'repaired write');
  pass('repaired settings accept a subsequent toggle'); await stop(); await until(() => pids().every(pid => !live(pid)), 'exit releases MCP');
  pass('exit releases every owned MCP process', pids().every(pid => !live(pid)));
  await launch(); await moduleEdit(false, 'fresh disabled state has no prompt.edit module');
  pass('fresh disabled state starts no MCP process', pids().length === 2);
  send('/plugin list --disabled\r'); await until(()=>/^Plugins$/m.test(text())&&text().includes('alpha (v1.0, project)'),'fresh disabled');
  pass('fresh CLI restores the saved per-plugin state',!text().includes('run /reload-plugins to apply')); await closePanel(); await suggestion('alpha',false); await suggestion('beta',true); await stop();
  pass('unrelated settings survive toggles',JSON.parse(fs.readFileSync(path.join(user,'settings.json'),'utf8')).keep===7);
  pass('all session locks release',fs.readdirSync(path.join(workspace,'.agent')).every(file=>!file.endsWith('.lock')));
  pass('local plugin management performs zero model requests',requests===0);
  const identity=captureIdentity(root);
  if(process.env.W299_RESULT)fs.writeFileSync(process.env.W299_RESULT,JSON.stringify({checks,requests,paidUpstreamCalls:0,identity},null,2));
  console.log(`IDENTITY ${identity.sha256}`);console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  for(const owner of children){if(owner.child.exitCode===null){owner.child.kill('SIGTERM');await Promise.race([owner.closed,delay(1000)]);if(owner.child.exitCode===null)owner.child.kill('SIGKILL');}owner.screen.close();}
  for (const pid of pids()) if (live(pid)) process.kill(pid, 'SIGTERM');
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(temporary,{recursive:true,force:true});
}
