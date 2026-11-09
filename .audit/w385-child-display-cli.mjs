import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const cases = [];
for (const messaging of [false, true]) for (const callback of ['agentProgress', 'clearAgentProgress'])
  for (const cut of ['before', 'after', 'returned', 'normal']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-display-cli-')));
    try {
      const user = path.join(root, 'user'), marker = path.join(root, 'display-effect'), preload = path.join(root, 'preload.mjs');
      fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness')); fs.writeFileSync(path.join(root, 'value'), 'OWNED_CHILD_READ');
      fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ features: { tasks: false, subagents: true, agentMessaging: messaging, agentTypes: true } }));
      fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
        const {Agent}=await import(${JSON.stringify(url('agent'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))}),{Session}=await import(${JSON.stringify(url('session'))});
        const append=Session.prototype.append;let selected;
        Session.prototype.append=function(event,...args){const result=Reflect.apply(append,this,[event,...args]);
          if(!this.config.parentSessionId&&event.kind==='agent_display_observer'&&event.callback===${JSON.stringify(callback)}){
            if(!selected&&event.transition.phase==='admitted')selected=event.invocationId;
            if(event.invocationId===selected&&event.transition.phase==='returned'&&${JSON.stringify(cut)}==='returned')process.kill(process.pid,'SIGKILL');}
          return result;};
        const run=Agent.prototype.run;Agent.prototype.run=function(...args){if(!this.session.config.parentSessionId){
          const original=this.events[${JSON.stringify(callback)}];
          this.events[${JSON.stringify(callback)}]=function(...values){
            if(${JSON.stringify(cut)}==='before')process.kill(process.pid,'SIGKILL');
            original?.apply(this,values);fs.appendFileSync(${JSON.stringify(marker)},'effect\\n');
            if(${JSON.stringify(cut)}==='after')process.kill(process.pid,'SIGKILL');
          };}return Reflect.apply(run,this,args);};
        let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
          const n=calls++,content=n===0?[{type:'tool_use',id:'parent-agent',name:'agent',input:{prompt:'CHILD_DISPLAY_FIXTURE',mode:'general'}}]
            :n===1?[{type:'tool_use',id:'child-read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}];
          return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,content,stop_reason:n<2?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
      const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user,
        '--model', 'fixture', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
        input: 'launch owned child\n/exit\n', encoding: 'utf8', timeout: 25000,
        env: { ...process.env, HOME: user, CLAUDE_CONFIG_DIR: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
      });
      if (cut === 'normal') assert.equal(run.status, 0, run.stderr + run.stdout); else assert.equal(run.signal, 'SIGKILL', run.stderr + run.stdout);
      const journals = fs.readdirSync(path.join(root, '.agent')).filter(file => file.endsWith('.jsonl'));
      const all = journals.map(file => fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse));
      const rows = all.find(rows => !rows[0].config.parentSessionId); assert.ok(rows);
      const child = all.find(child => child[0].config.parentSessionId === rows[0].id); assert.ok(child);
      if (cut === 'normal' || callback === 'clearAgentProgress') assert.ok(child.some(row => row.kind === 'tool_result' &&
        row.result.tool_use_id === 'child-read' && String(row.result.content).includes('OWNED_CHILD_READ')));
      const first = rows.find(row => row.kind === 'agent_display_observer' && row.callback === callback); assert.ok(first);
      const selected = rows.filter(row => row.kind === 'agent_display_observer' && row.invocationId === first.invocationId);
      assert.deepEqual(selected.at(-1).transition, cut === 'before' || cut === 'after' ? { phase: 'admitted' } : { phase: 'returned', mode: 'sync' });
      assert.equal(first.inputEvidence, callback === 'agentProgress' ? 'unobserved' : undefined);
      const before = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '';
      assert.equal(Boolean(before), cut !== 'before');
      for (let reader = 0; reader < 2; reader++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `import assert from 'node:assert/strict';
          import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
          const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true}),expected=JSON.parse(process.argv[3]);
          assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
          assert.deepEqual(s.events.filter(row=>row.kind==='agent_display_observer'&&row.invocationId===expected[0].invocationId),expected);
          await s.close();`, root, rows[0].id, JSON.stringify(selected)], { encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr + cold.stdout);
      }
      assert.equal(fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '', before);
      cases.push({ messaging, callback, cut, transition: selected.at(-1).transition, actualEffect: Boolean(before), coldReaders: 2 });
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
const full = captureIdentity(), identity = { sha256: full.sha256, ...Object.fromEntries(['inputs', 'validation', 'build'].map(key => [key, { sha256: full[key].sha256, files: full[key].files.length }])) };
const evidence = { identity, cases, upstreamCalls: 0 };
fs.writeFileSync(new URL('./w385-child-display-cli.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
