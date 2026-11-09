import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createPluginTools } from '../dist/plugins.js';
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'live-hook-cli-')));
const workspace = path.join(root, 'workspace'), source = path.join(root, 'source'), user = path.join(root, 'user');
let child;
const mixed = process.argv.includes('--mixed');
try {
  for (const dir of [workspace, source, user]) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name: 'fixture', version: '1', hooks: 'hooks.json',
    ...(mixed ? { skills: 'skills', agents: 'agents' } : {}) }));
  if (mixed) {
    fs.mkdirSync(path.join(source, 'skills/example'), { recursive: true }); fs.mkdirSync(path.join(source, 'agents'));
    fs.writeFileSync(path.join(source, 'skills/example/SKILL.md'), '---\nname: example\ndescription: OLD_SKILL\n---\nOLD_SKILL_BODY');
    fs.writeFileSync(path.join(source, 'agents/reviewer.md'), '---\nname: reviewer\ndescription: OLD_AGENT\n---\nOLD_AGENT_BODY');
  }
  fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify({ hooks: { UserPromptSubmit: [{ command: 'printf a >> trace' }] } }));
  await createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install').execute({ directory: source },
    { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 });
  fs.mkdirSync(path.join(workspace, '.harness'), { recursive: true });
  fs.writeFileSync(path.join(workspace, '.harness/settings.json'), JSON.stringify({ plugins: { enabled: true },
    hooks: { UserPromptSubmit: [{ command: 'printf e >> trace' }] } }));
  const preload = path.join(root, 'provider.mjs');
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
    const {createPluginTools,discoverInstalledPluginComponents}=await import(${JSON.stringify(new URL('../dist/plugins.js', import.meta.url).href)});
    let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
      calls++;const workspace=${JSON.stringify(workspace)},source=${JSON.stringify(source)};
      if(${mixed}){const system=JSON.stringify(request.system);
        const expected=calls===1?'OLD':calls===2?'NEW':null;
        if(expected&&(!system.includes(expected+'_SKILL')||!system.includes(expected+'_AGENT')))throw Error('stale catalog '+system);
        if(calls===3&&/OLD_SKILL|NEW_SKILL|OLD_AGENT|NEW_AGENT/.test(system))throw Error('removed catalog remains');}
      if(calls<=2){const previous=discoverInstalledPluginComponents(workspace,{enabled:true})[0].plugin;
        if(calls===1)fs.writeFileSync(source+'/hooks.json',JSON.stringify({hooks:{UserPromptSubmit:[{command:'printf b >> trace'}]}}));
        if(calls===1&&${mixed}){
          fs.writeFileSync(source+'/skills/example/SKILL.md','---\\nname: example\\ndescription: NEW_SKILL\\n---\\nNEW_SKILL_BODY');
          fs.writeFileSync(source+'/agents/reviewer.md','---\\nname: reviewer\\ndescription: NEW_AGENT\\n---\\nNEW_AGENT_BODY');}
        await createPluginTools({enabled:true}).find(t=>t.schema.name===(calls===1?'plugin_update':'plugin_remove')).execute({
          name:'fixture',expected_digest:previous.digest,...(calls===1?{directory:source}:{})},
          {workspace,signal:new AbortController().signal,allowShell:false,maxOutputBytes:100000});}
      fs.writeFileSync(${JSON.stringify(path.join(root, 'calls'))},String(calls));
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}};};`);
  child = spawn(process.execPath, ['bin/litcode.mjs', '--workspace', workspace, '--user-dir', user, '--model', 'fixture',
    '--interactive', '--no-tui', '--no-inherit-gateway'], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000,
    env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
  let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)); });
  for (let turn = 1; turn <= 3; turn++) {
    child.stdin.write(`task ${turn}\n`);
    let observed = false;
    for (let attempt = 0; attempt < 1000; attempt++) {
      const directory = path.join(workspace, '.agent');
      const file = fs.existsSync(directory) && fs.readdirSync(directory).find(name => name.endsWith('.jsonl'));
      if (file) {
        const rows = fs.readFileSync(path.join(directory, file), 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
        if (rows.filter(row => row.kind === 'turn_end').length >= turn) { observed = true; break; }
      }
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.ok(observed, `turn ${turn} did not finish: ${output}`);
  }
  child.stdin.end();
  assert.equal(await exited, 0, output);
  assert.equal(fs.readFileSync(path.join(root, 'calls'), 'utf8'), '3');
  assert.equal(fs.readFileSync(path.join(workspace, 'trace'), 'utf8'), 'aebee');
  assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
  console.log(JSON.stringify({ cli: 'three turns, real plugin update then removal', mixed, hookTrace: 'aebee', locksReleased: true, modelUpstreamRequests: 0 }));
} finally { if (child?.exitCode === null) child.kill(); fs.rmSync(root, { recursive: true, force: true }); }
