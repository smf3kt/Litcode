import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const cut of ['normal', 'checkScope:admitted', 'checkScope:returned', 'refresh:admitted', 'refresh:returned', 'checkJournal:admitted', 'checkJournal:returned']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-wrapper-cli-')));
  const user = path.join(root, 'user'), preload = path.join(root, 'provider.mjs');
  fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.git')); fs.writeFileSync(path.join(root, 'value'), 'WRAPPER_RESULT');
  fs.writeFileSync(preload, `globalThis.fetch=()=>{throw Error('network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(url('provider'))});
    const {Session}=await import(${JSON.stringify(url('session'))});
    const resume=process.env.WRAPPER_RESUME==='1',cut=${JSON.stringify(cut)};
    const append=Session.prototype.append;
    Session.prototype.append=function(event,...args){
      if(resume&&event.kind==='runtime_wrapper_observer')throw Error('wrapper replay');
      const value=Reflect.apply(append,this,[event,...args]);
      if(event.kind==='runtime_wrapper_observer'&&event.stage+':'+event.transition.phase===cut)process.kill(process.pid,'SIGKILL');
      return value;};
    let calls=0;GatewayProvider.prototype.count=async()=>1;
    GatewayProvider.prototype.complete=async()=>{const first=!resume&&++calls===1;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
        content:first?[{type:'tool_use',id:'wrapped',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
        stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}};};`);
  const env = { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` };
  try {
    const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
      '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'read value\n', encoding: 'utf8', timeout: 20000, env });
    if (cut === 'normal') assert.equal(cli.status, 0, cli.stderr + cli.stdout);
    else assert.equal(cli.signal, 'SIGKILL', cli.stderr + cli.stdout);
    const files = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'));
    assert.equal(files.length, 1); const id = files[0].slice(0, -6);
    const before = fs.readFileSync(path.join(root, '.agent', files[0]), 'utf8').trim().split('\n').map(JSON.parse);
    const expected = before.filter(row => row.kind === 'runtime_wrapper_observer');
    assert.equal(expected.length, cut === 'normal' ? 6 : ['checkScope:admitted', 'checkScope:returned', 'refresh:admitted', 'refresh:returned', 'checkJournal:admitted', 'checkJournal:returned'].indexOf(cut) + 1);
    if (cut !== 'normal') assert.equal(before.some(row => row.kind === 'tool_effect'), false);
    for (let reader = 0; reader < 2; reader++) {
      const read = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
        import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],process.argv[2],{maxBytes:10000000,maxEvents:10000}),s.events);
        const expected=JSON.parse(process.argv[3]);assert.deepEqual(s.events.filter(e=>e.kind==='runtime_wrapper_observer'),expected);
        assert.equal(s.runtimeWrapperObservations.at(-1).state,expected.at(-1).transition.phase==='admitted'?'admitted_unknown':'sync_returned');
        if(!s.awaitingResponse){const fork=forkSession(s);assert.deepEqual(fork.runtimeWrapperObservations,[]);fork.close();}s.close();`,
      root, id, JSON.stringify(expected)], { encoding: 'utf8', timeout: 10000 });
      assert.equal(read.status, 0, read.stderr + read.stdout);
      if (reader === 0) {
        const resume = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--interactive', '--no-tui', '--resume', id],
          { input: 'continue\n', encoding: 'utf8', timeout: 20000, env: { ...env, WRAPPER_RESUME: '1' } });
        assert.equal(resume.status, 0, resume.stderr + resume.stdout);
      }
    }
    console.log(JSON.stringify({ cut, observations: expected.length, coldReaders: 2, resumed: true, upstream: 0 }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
