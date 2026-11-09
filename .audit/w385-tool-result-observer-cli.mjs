import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const moduleURL = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const cut of ['normal', 'admitted', 'inside', 'returned', 'pending', 'settled']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-observer-cli-')));
  const user = path.join(root, 'user'), preload = path.join(root, 'fixture.mjs'), marker = path.join(root, 'observer-effects');
  fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.git')); fs.writeFileSync(path.join(root, 'value'), 'LOCAL_RESULT');
  fs.writeFileSync(preload, `import fs from 'node:fs';
    globalThis.fetch=()=>{throw Error('network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(moduleURL('provider'))});
    const {Session}=await import(${JSON.stringify(moduleURL('session'))});
    const {Agent}=await import(${JSON.stringify(moduleURL('agent'))});
    const cut=${JSON.stringify(cut)},marker=${JSON.stringify(marker)},resume=process.env.OBSERVER_RESUME==='1';
    const kill=()=>process.kill(process.pid,'SIGKILL');
    const append=Session.prototype.append;
    Session.prototype.append=function(event,...args){const result=Reflect.apply(append,this,[event,...args]);
      if(!resume&&event.kind==='tool_result_observer'){
        const phase=event.transition.phase;
        if(cut===phase||cut==='pending'&&phase==='returned'&&event.transition.mode==='promise')kill();
      }return result;};
    const run=Agent.prototype.run;
    Agent.prototype.run=function(...args){
      const receiver=this.events,original=receiver.toolResult;
      receiver.toolResult=function(display){
        if(resume)throw Error('observer replay');
        fs.appendFileSync(marker,'called\\n');
        if(cut==='inside')kill();
        if(original)Reflect.apply(original,this,[display]);
        if(cut==='pending'||cut==='settled')return Promise.resolve();
      };
      return Reflect.apply(run,this,args);
    };
    let calls=0;GatewayProvider.prototype.count=async()=>1;
    GatewayProvider.prototype.complete=async()=>{const first=!resume&&++calls===1;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
      content:first?[{type:'tool_use',id:'observed',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
      stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}};};`);
  const env = { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` };
  const args = ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture', '--interactive', '--no-tui', '--no-inherit-gateway'];
  try {
    const cli = spawnSync(process.execPath, args, { input: 'read value\n', encoding: 'utf8', timeout: 20000, env });
    if (cut === 'normal') assert.equal(cli.status, 0, cli.stderr + cli.stdout);
    else assert.equal(cli.signal, 'SIGKILL', cli.stderr + cli.stdout);
    const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'));
    assert.equal(journals.length, 1); const id = journals[0].slice(0, -6);
    const expected = { normal: 'sync_returned', admitted: 'admitted_unknown', inside: 'admitted_unknown', returned: 'sync_returned', pending: 'promise_pending', settled: 'fulfilled' }[cut];
    for (let reader = 0; reader < 2; reader++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import {Session,readSessionJournal} from ${JSON.stringify(moduleURL('session'))};
        import {forkSession} from ${JSON.stringify(moduleURL('sessions'))};
        const session=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.equal(session.toolResultObservations.length,1);
        assert.equal(session.toolResultObservations[0].state,process.argv[3]);
        assert.deepEqual(readSessionJournal(process.argv[1],process.argv[2],{maxBytes:10000000,maxEvents:10000}),session.events);
        if(session.awaitingResponse)assert.throws(()=>forkSession(session),/Finish or continue/);
        else {const fork=forkSession(session);assert.deepEqual(fork.toolResultObservations,[]);fork.close();}
        session.close();`, root, id, expected], { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
      if (reader === 0) {
        const resumed = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root,
          '--interactive', '--no-tui', '--resume', id], { input: 'continue\n', encoding: 'utf8', timeout: 20000,
          env: { ...env, OBSERVER_RESUME: '1' } });
        assert.equal(resumed.status, 0, resumed.stderr + resumed.stdout);
      }
    }
    assert.equal(fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : '', cut === 'admitted' ? '' : 'called\n');
    console.log(JSON.stringify({ cut, state: expected, coldReaders: 2, resumed: true, upstream: 0 }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
