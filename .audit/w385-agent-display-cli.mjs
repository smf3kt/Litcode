// Acceptance counterpart of w385-agent-display-gap.mjs; historical red evidence remains unchanged.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href, cases = [];
for (const callback of ['status', 'progress', 'terminalSequence']) for (const cut of ['before', 'after', 'returned', 'normal']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-display-cli-')));
  const user = path.join(root, 'user'), preload = path.join(root, 'preload.mjs'), marker = path.join(root, 'callback-effect');
  try {
    fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness')); fs.writeFileSync(path.join(root, 'value'), 'owned read');
    fs.writeFileSync(path.join(root, 'hook-output'), JSON.stringify({ systemMessage: 'owned display', terminalSequence: '\u001b]0;owned title\u0007' }));
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ command: 'cat hook-output' }] } }));
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('external network disabled')};
      const {Agent}=await import(${JSON.stringify(url('agent'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))}),
        {Session}=await import(${JSON.stringify(url('session'))});
      const resume=process.env.DISPLAY_RESUME==='1',append=Session.prototype.append;let selected;
      Session.prototype.append=function(event,...args){const result=Reflect.apply(append,this,[event,...args]);
        if(!resume&&event.kind==='agent_display_observer'&&event.callback===${JSON.stringify(callback)}){
          if(!selected&&event.transition.phase==='admitted')selected=event.invocationId;
          if(event.invocationId===selected&&event.transition.phase==='returned'&&${JSON.stringify(cut)}==='returned')process.kill(process.pid,'SIGKILL');}
        return result;};
      const run=Agent.prototype.run;Agent.prototype.run=function(...args){if(!resume){
        const name=${JSON.stringify(callback)},receiver=this.events,original=receiver[name];
        receiver[name]=function(...values){
          if(name==='status'&&!String(values[0]).includes('owned display'))return original?.apply(this,values);
          if(${JSON.stringify(cut)}==='before')process.kill(process.pid,'SIGKILL');
          original?.apply(this,values);fs.appendFileSync(${JSON.stringify(marker)},'effect\\n');
          if(${JSON.stringify(cut)}==='after')process.kill(process.pid,'SIGKILL');
        };}return Reflect.apply(run,this,args);};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        const first=!resume&&calls++===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:first?[{type:'tool_use',id:'read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
          stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const env = { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` };
    const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
      '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'read value\n', encoding: 'utf8', timeout: 20000, env });
    if (cut === 'normal') assert.equal(run.status, 0, run.stderr + run.stdout); else assert.equal(run.signal, 'SIGKILL', run.stderr + run.stdout);
    const before = fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '';
    assert.equal(Boolean(before), cut !== 'before');
    const file = fs.readdirSync(path.join(root, '.agent')).find(name => name.endsWith('.jsonl'));
    const rows = fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse), id = rows[0].id;
    const selected = rows.find(row => row.kind === 'agent_display_observer' && row.callback === callback); assert.ok(selected);
    const expected = rows.filter(row => row.kind === 'agent_display_observer' && row.invocationId === selected.invocationId);
    assert.deepEqual(expected.at(-1).transition, cut === 'before' || cut === 'after' ? { phase: 'admitted' } : { phase: 'returned', mode: 'sync' });
    for (let reader = 0; reader < 2; reader++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
        import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true}),expected=JSON.parse(process.argv[3]);
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(row=>row.kind==='agent_display_observer'&&row.invocationId===expected[0].invocationId),expected);
        if(!s.awaitingResponse){const f=forkSession(s);assert.deepEqual(f.agentDisplayObservations,[]);f.close();}s.close();`, root, id, JSON.stringify(expected)],
      { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
      if (reader === 0) {
        const resumed = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--interactive', '--no-tui', '--resume', id],
          { input: 'continue\n', encoding: 'utf8', timeout: 20000, env: { ...env, DISPLAY_RESUME: '1' } });
        assert.equal(resumed.status, 0, resumed.stderr + resumed.stdout);
        assert.equal(fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '', before);
      }
    }
    cases.push({ callback, cut, phase: expected.at(-1).transition.phase, actualEffect: Boolean(before), coldReaders: 2, noReplay: true });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const result = { identity: captureIdentity().sha256, cases, upstreamCalls: 0 };
fs.writeFileSync('.audit/w385-agent-display-cli.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result));
