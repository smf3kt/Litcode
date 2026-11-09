import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-observer-cli-')));
const observations = [];
try {
  for (const cut of ['none', 'pending', 'returned']) {
    const root = path.join(base, cut), user = path.join(root, 'user');
    fs.mkdirSync(user, { recursive: true }); fs.mkdirSync(path.join(root, '.harness')); fs.mkdirSync(path.join(root, '.git'));
    const saved = path.join(root, 'observer.json'), preload = path.join(root, 'provider.mjs');
    fs.writeFileSync(path.join(root, '.harness', 'settings.json'), JSON.stringify({ hooks: { SessionStart: [{ async: true,
      command: `printf x >> runs; printf '%s' '{"terminalSequence":"\\u001b]2;child-observer\\u0007"}'` }] } }));
    fs.writeFileSync(preload, `import fs from 'node:fs'; globalThis.fetch=()=>{throw Error('network disabled')};
      const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
      const append=Session.prototype.append;
      Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
        if(this.config.childMode&&event.kind==='async_hook_lifecycle'&&event.transition.phase==='observer'){
          fs.writeFileSync(${JSON.stringify(saved)},JSON.stringify({id:this.id,jobId:event.jobId,generation:event.generation}));
          if(event.transition.state===${JSON.stringify(cut)})process.kill(process.pid,'SIGKILL');
        }return result;};
      const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
      let calls=0;GatewayProvider.prototype.count=async()=>1;
      GatewayProvider.prototype.complete=async request=>{
        let content=[{type:'text',text:'child fixture done'}];
        if(calls++===0){const tool=request.tools.find(tool=>tool.name==='agent'||tool.name==='subagent');
          if(!tool)throw Error('child tool unavailable');
          content=[{type:'tool_use',id:'child-observer-call',name:tool.name,input:{prompt:'Return fixture result',mode:'general',max_turns:1}}];}
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,
          stop_reason:content[0].type==='tool_use'?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}};};`);
    const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user,
      '--model', 'fixture', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
      cwd: process.cwd(), input: 'Run the child fixture\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
    });
    if (cut === 'none') assert.equal(cli.status, 0, cli.stderr + cli.stdout);
    else assert.equal(cli.signal, 'SIGKILL', cli.stderr + cli.stdout);
    const identity = JSON.parse(fs.readFileSync(saved, 'utf8'));
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import {Session} from './dist/session.js';
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        try{console.log(JSON.stringify(s.events.filter(row=>row.kind==='async_hook_lifecycle')))}finally{await s.close()}
      `, root, identity.id], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      const rows = JSON.parse(cold.stdout), observers = rows.filter(row => row.transition.phase === 'observer');
      assert.deepEqual(observers.map(row => row.transition.state), cut === 'pending' ? ['pending'] : ['pending', 'returned']);
      assert.equal(rows.every(row => row.owner === identity.id && row.jobId === identity.jobId && row.generation === identity.generation), true);
      assert.equal(observers.every(row => row.transition.observer.kind === 'terminal' && row.transition.observer.index === 0), true);
      assert.equal(observers.every(row => row.transition.id === observers[0].transition.id), true);
    }
    assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'xx');
    observations.push({ cut, childObserver: cut === 'pending' ? 'pending' : 'returned', coldReaders: 2, commandRuns: 2 });
  }
  console.log(JSON.stringify({ probe: 'actual child CLI observer capability and process death', observations }));
} finally { fs.rmSync(base, { recursive: true, force: true }); }
