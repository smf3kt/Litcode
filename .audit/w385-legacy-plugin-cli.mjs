import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { defaultConfig } from '../dist/agent.js';
import { Session, fingerprint } from '../dist/session.js';
import { createRuntime, pinToolSchemas } from '../dist/runtime.js';
import { loadProjectConfig } from '../dist/config.js';
import { createPluginTools, discoverInstalledPluginComponents } from '../dist/plugins.js';

const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-plugin-cli-')));
const results = [];
let child;
try {
  for (const command of ['/reload', '/reload-plugins']) {
    const workspace = path.join(base, command.slice(1)), source = path.join(workspace, 'source'), user = path.join(workspace, 'user');
    fs.mkdirSync(source, { recursive: true }); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, '.git'));
    fs.writeFileSync(path.join(source, 'plugin.json'), JSON.stringify({ name: 'fixture', version: '1', hooks: 'hooks.json' }));
    const hook = letter => ({ hooks: { UserPromptSubmit: [{ command: `printf ${letter} >> trace` }] } });
    fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify(hook('a')));
    const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100000 };
    await createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_install').execute({ directory: source }, context);
    const settings = path.join(workspace, '.harness/settings.json');
    fs.writeFileSync(settings, JSON.stringify({ plugins: { enabled: true }, ...hook('e') }));
    const config = { ...defaultConfig(workspace, []), model: 'fixture', plugins: { enabled: true }, configSources: { userDir: user },
      hooks: loadProjectConfig(workspace, { userDir: user, pluginHooks: 'preview' }).settings.hooks };
    const runtime = await createRuntime(config, { count: async () => 1, complete: async () => { throw Error('unexpected model'); } }, context.signal);
    config.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(workspace, { config }); await runtime.close(); await session.close();
    const metadata = JSON.parse(fs.readFileSync(session.file, 'utf8')); delete metadata.pluginHookOriginsVersion;
    for (const entry of metadata.config.hooks.UserPromptSubmit) delete entry.pluginOrigin;
    metadata.fingerprint = fingerprint(metadata.config); fs.writeFileSync(session.file, JSON.stringify(metadata) + '\n');
    fs.writeFileSync(path.join(source, 'hooks.json'), JSON.stringify(hook('b')));
    const previous = discoverInstalledPluginComponents(workspace, { enabled: true })[0].plugin;
    await createPluginTools({ enabled: true }).find(tool => tool.schema.name === 'plugin_update').execute({
      name: 'fixture', directory: source, expected_digest: previous.digest }, context);
    fs.writeFileSync(settings, JSON.stringify({ plugins: { enabled: true }, ...hook('f') }));
    const preload = path.join(workspace, 'provider.mjs');
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
      const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
      const {createPluginTools,discoverInstalledPluginComponents}=await import(${JSON.stringify(new URL('../dist/plugins.js', import.meta.url).href)});
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        if(++calls===2){const workspace=${JSON.stringify(workspace)},source=${JSON.stringify(source)};
          const previous=discoverInstalledPluginComponents(workspace,{enabled:true})[0].plugin;
          fs.writeFileSync(source+'/hooks.json',JSON.stringify({hooks:{UserPromptSubmit:[{command:'printf c >> trace'}]}}));
          await createPluginTools({enabled:true}).find(tool=>tool.schema.name==='plugin_update').execute({name:'fixture',directory:source,expected_digest:previous.digest},
            {workspace,signal:new AbortController().signal,allowShell:false,maxOutputBytes:100000});}
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}};};`);
    child = spawn(process.execPath, ['bin/litcode.mjs', '--workspace', workspace, '--resume', session.id,
      '--interactive', '--no-tui', '--no-inherit-gateway'], { stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000,
      env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)); });
    const waitFor = async predicate => {
      for (let i = 0; i < 1000; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
      throw Error('CLI observation timeout: ' + output);
    };
    const rows = file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    child.stdin.write('old pinned task\n');
    await waitFor(() => rows(session.file).some(row => row.kind === 'turn_end'));
    assert.equal(fs.readFileSync(path.join(workspace, 'trace'), 'utf8'), 'ae');
    assert.match(output, /older session keeps its saved hooks/);
    child.stdin.write(command + '\n');
    const directory = path.join(workspace, '.agent'); let successor;
    await waitFor(() => { successor = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') && name !== `${session.id}.jsonl`); return Boolean(successor); });
    await waitFor(() => output.includes(command === '/reload' ? 'Local configuration reloaded;' : 'Reloaded:'));
    const nextFile = path.join(directory, successor), before = rows(nextFile).filter(row => row.kind === 'turn_end').length;
    child.stdin.write('new loaded task\n');
    await waitFor(() => rows(nextFile).filter(row => row.kind === 'turn_end').length > before);
    assert.equal(fs.readFileSync(path.join(workspace, 'trace'), 'utf8'), 'aebf');
    child.stdin.write('live update task\n');
    await waitFor(() => rows(nextFile).filter(row => row.kind === 'turn_end').length > before + 1);
    child.stdin.end(); assert.equal(await exited, 0, output); child = undefined;
    assert.equal(fs.readFileSync(path.join(workspace, 'trace'), 'utf8'), 'aebfcf');
    const nextId = successor.slice(0, -6);
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import {Session} from './dist/session.js';
      const result=[];for(const id of process.argv.slice(2)){const s=Session.open(process.argv[1],{id});
        try{result.push({pinned:s.config.legacyPluginHookSnapshot===true,version:s.events[0].pluginHookOriginsVersion??null})}finally{await s.close()}}
      console.log(JSON.stringify(result));`, workspace, session.id, nextId], { encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), [{ pinned: true, version: null }, { pinned: false, version: 1 }]);
    results.push({ command, trace: 'aebfcf', sourcePinned: true, successorLive: true, coldReaders: 2 });
  }
  console.log(JSON.stringify({ probe: 'legacy pinned hooks migrate explicitly and regain live plugin updates', results }));
} finally { child?.kill('SIGKILL'); fs.rmSync(base, { recursive: true, force: true }); }
