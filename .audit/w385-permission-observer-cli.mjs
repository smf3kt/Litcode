import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const cases = [];
for (const cut of ['lookup-before', 'lookup-after', 'before', 'after', 'settled', 'normal', 'deny']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'permission-cli-')));
  try {
    const user = path.join(root, 'user'), marker = path.join(root, 'approval-effect'), lookupMarker = path.join(root, 'lookup-effect'), target = path.join(root, 'value'), preload = path.join(root, 'preload.mjs');
    fs.mkdirSync(user);
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
      const {Agent}=await import(${JSON.stringify(url('agent'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))}),{Session}=await import(${JSON.stringify(url('session'))});
      const append=Session.prototype.append;Session.prototype.append=function(row,...args){const result=Reflect.apply(append,this,[row,...args]);
        if(row.kind==='tool_context_observer'&&row.callback==='permission'&&row.transition.phase==='settled'&&${JSON.stringify(cut)}==='settled')process.kill(process.pid,'SIGKILL');return result;};
      const run=Agent.prototype.run;Agent.prototype.run=function(...args){Object.defineProperty(this.events,'permission',{configurable:true,get(){
        if(${JSON.stringify(cut)}==='lookup-before')process.kill(process.pid,'SIGKILL');
        fs.writeFileSync(${JSON.stringify(lookupMarker)},'LOOKUP');
        if(${JSON.stringify(cut)}==='lookup-after')process.kill(process.pid,'SIGKILL');
        return async function(request){
          if(this!==undefined)throw Error('approval receiver changed');
          if(${JSON.stringify(cut)}==='before')process.kill(process.pid,'SIGKILL');
          fs.writeFileSync(${JSON.stringify(marker)},'APPROVAL');
          if(${JSON.stringify(cut)}==='after')process.kill(process.pid,'SIGKILL');
          return ${JSON.stringify(cut)}!=='deny';};}});return Reflect.apply(run,this,args);};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        const first=calls++===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:first?[{type:'tool_use',id:'permission-write',name:'write_file',input:{path:'value',content:'AUTHORIZED'}}]:[{type:'text',text:'DONE'}],
          stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
      '--permission-mode', 'ask', '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'write owned file\n/exit\n',
      encoding: 'utf8', timeout: 20000, env: { ...process.env, HOME: user, CLAUDE_CONFIG_DIR: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    if (cut === 'normal' || cut === 'deny') assert.equal(run.status, 0, run.stderr + run.stdout);
    else assert.equal(run.signal, 'SIGKILL', run.stderr + run.stdout);
    const file = fs.readdirSync(path.join(root, '.agent')).find(file => file.endsWith('.jsonl')); assert.ok(file);
    const rows = fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse);
    const facts = rows.filter(row => row.kind === 'tool_context_observer' && row.callback.startsWith('permission'));
    const lookup = facts.filter(row => row.callback === 'permissionLookup'), operation = facts.filter(row => row.callback === 'permission');
    assert.ok(lookup.length);
    if (cut.startsWith('lookup-')) { assert.deepEqual(lookup.at(-1).transition, { phase: 'admitted' }); assert.equal(operation.length, 0); }
    else {
      assert.deepEqual(lookup.at(-1).transition, { phase: 'returned', mode: 'sync' });
      assert.ok(operation.length); assert.equal(operation[0].contextId, lookup[0].contextId);
      assert.equal(operation[0].inputKind, 'unobserved');
      assert.deepEqual(operation.at(-1).transition, cut === 'before' || cut === 'after' ? { phase: 'admitted' } : { phase: 'settled', outcome: 'fulfilled' });
    }
    assert.equal(fs.existsSync(lookupMarker), cut !== 'lookup-before');
    assert.equal(fs.existsSync(marker), ['after', 'settled', 'normal', 'deny'].includes(cut));
    assert.equal(fs.existsSync(target), cut === 'normal');
    if (cut === 'normal') assert.equal(fs.readFileSync(target, 'utf8'), 'AUTHORIZED');
    for (let reader = 0; reader < 2; reader++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `import assert from 'node:assert/strict';
        import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(s.events.filter(row=>row.kind==='tool_context_observer'&&row.callback.startsWith('permission')),JSON.parse(process.argv[3]));
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);await s.close();`,
        root, rows[0].id, JSON.stringify(facts)], { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
    }
    assert.equal(fs.existsSync(target), cut === 'normal');
    cases.push({ cut, lookupEffect: fs.existsSync(lookupMarker), approvalEffect: fs.existsSync(marker), toolEffect: fs.existsSync(target),
      lookup: lookup.at(-1).transition, operation: operation.at(-1)?.transition, coldReaders: 2 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const full = captureIdentity(), identity = { sha256: full.sha256, ...Object.fromEntries(['inputs', 'validation', 'build'].map(key => [key, { sha256: full[key].sha256, files: full[key].files.length }])) };
const evidence = { identity, cases, upstreamCalls: 0 };
fs.writeFileSync(new URL('./w385-permission-observer-cli.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
