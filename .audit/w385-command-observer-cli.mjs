// Adapted from w385-hook-inner-cli.mjs: real command callbacks and owned CLI death cuts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const configured of [false, true]) for (const cut of ['normal', 'admitted', 'returned']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'command-observer-cli-')));
  const user = path.join(root, 'user'), preload = path.join(root, 'preload.mjs'), marker = path.join(root, 'executed');
  try {
    fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness')); fs.writeFileSync(path.join(root, 'value'), 'owned read');
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ hooks: { PreToolUse: [
      { command: 'printf x >> executed; printf fixture', ...(configured ? { async: true } : {}), timeout: 5 },
    ] } }));
    fs.writeFileSync(preload, `globalThis.fetch=()=>{throw Error('external network disabled')};
      const {Session}=await import(${JSON.stringify(url('session'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))});
      const append=Session.prototype.append,resume=process.env.COMMAND_RESUME==='1';
      Session.prototype.append=function(event,...args){
        if(resume&&['hook_command_observer','hook_resolver'].includes(event.kind))throw Error('command replay');
        const result=Reflect.apply(append,this,[event,...args]);
        if(!resume&&event.kind==='hook_command_observer'&&event.transition.phase===${JSON.stringify(cut)})process.kill(process.pid,'SIGKILL');return result;};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        const tool=!resume&&calls++===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:tool?[{type:'tool_use',id:'read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
          stop_reason:tool?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const env = { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` };
    const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
      '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'read value\n', encoding: 'utf8', timeout: 20000, env });
    if (cut === 'normal') assert.equal(run.status, 0, run.stderr + run.stdout);
    else assert.equal(run.signal, 'SIGKILL', run.stderr + run.stdout);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'x');
    const file = fs.readdirSync(path.join(root, '.agent')).find(name => name.endsWith('.jsonl'));
    const rows = fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse), id = rows[0].id;
    const expected = rows.filter(row => row.kind === 'hook_command_observer');
    assert.equal(expected.length, cut === 'admitted' ? 1 : 2);
    if (cut !== 'admitted') assert.deepEqual(expected[1].transition, { phase: 'returned', mode: configured ? 'sync' : 'absent' });
    const resolver = rows.find(row => row.kind === 'hook_resolver');
    assert.equal(expected[0].resolverInvocationId, resolver.invocationId);
    for (let reader = 0; reader < 2; reader++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
        import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(row=>row.kind==='hook_command_observer'),JSON.parse(process.argv[3]));
        assert.equal(s.hookCommandObservations.length,1);
        if(!s.awaitingResponse){const f=forkSession(s);assert.deepEqual(f.hookCommandObservations,[]);f.close();}s.close();`,
      root, id, JSON.stringify(expected)], { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
      if (reader === 0) {
        const resumed = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--interactive', '--no-tui', '--resume', id],
          { input: 'continue\n', encoding: 'utf8', timeout: 20000, env: { ...env, COMMAND_RESUME: '1' } });
        assert.equal(resumed.status, 0, resumed.stderr + resumed.stdout);
        assert.equal(fs.readFileSync(marker, 'utf8'), 'x');
      }
    }
    console.log(JSON.stringify({ configured, cut, coldReaders: 2, noReplay: true, upstream: 0 }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
