import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
for (const cut of ['normal','create_admitted','create_settled','create_returned','remove_admitted','remove_settled','remove_returned']) {
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-worktree-gap-')));
const user = path.join(root, 'user'), checkout = path.join(root, 'checkout'), preload = path.join(root, 'provider.mjs');
const quote = value => `'${value.replaceAll("'", `'"'"'`)}'`;
try {
  fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness'));
  fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({
    features: { subagents: true, agentMessaging: true, agentTypes: true, worktrees: true },
    hooks: {
      WorktreeCreate: [{ command: `mkdir -p ${quote(checkout)}; touch ${quote(path.join(root, 'created'))}; printf 'create\\n' >> ${quote(path.join(root, 'trace'))}; printf '%s\\n' ${quote(checkout)}` }],
      WorktreeRemove: [{ command: `touch ${quote(path.join(root, 'removed'))}; printf 'remove\\n' >> ${quote(path.join(root, 'trace'))}` }],
    },
  }));
  fs.writeFileSync(preload, `globalThis.fetch=()=>{throw Error('external network disabled')};
    const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
    const append=Session.prototype.append,resume=process.env.WORKTREE_RESUME==='1',cut=${JSON.stringify(cut)};
    Session.prototype.append=function(event,...args){
      if(resume&&event.kind==='hook_resolver')throw Error('worktree replay');
      const result=Reflect.apply(append,this,[event,...args]);
      if(!resume&&event.kind==='hook_resolver'&&cut===(event.event==='WorktreeCreate'?'create_':'remove_')+event.transition.phase)process.kill(process.pid,'SIGKILL');
      return result;};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
    let launched=false;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
      const child=JSON.stringify(request.system).includes('You are a child agent assigned');
      const tool=!resume&&!child&&!launched;if(tool)launched=true;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
        content:tool?[{type:'tool_use',id:'isolated',name:'agent',input:{prompt:'Return done',mode:'general',isolation:'worktree',max_turns:1}}]:[{type:'text',text:'DONE'}],
        stop_reason:tool?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}};};`);
  const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
    '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
    input: 'Run the isolated child\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
  });
  if(cut==='normal')assert.equal(run.status, 0, run.stderr + run.stdout);else assert.equal(run.signal,'SIGKILL',run.stderr+run.stdout);
  assert.equal(fs.existsSync(path.join(root, 'created')), cut!=='create_admitted', run.stderr + run.stdout);
  assert.equal(fs.existsSync(path.join(root, 'removed')), ['normal','remove_settled','remove_returned'].includes(cut), run.stderr + run.stdout);
  const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, cut.startsWith('create_')?1:2);
  const events = journals.flatMap(file => fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse));
  const worktree = events.filter(event => ['WorktreeCreate', 'WorktreeRemove'].includes(event.event)
    && ['hook_start', 'hook_result', 'hook_resolver'].includes(event.kind));
  const expected=worktree.filter(event=>event.kind==='hook_resolver');
  const phaseCount=phase=>['admitted','settled','returned'].indexOf(phase)+1;
  assert.equal(expected.filter(e=>e.event==='WorktreeCreate').length,cut.startsWith('create_')?phaseCount(cut.slice(7)):3);
  assert.equal(expected.filter(e=>e.event==='WorktreeRemove').length,cut==='normal'?3:cut.startsWith('remove_')?phaseCount(cut.slice(7)):0);
  const parent=events.find(event=>event.kind==='session'&&event.config.childMode===undefined)??events.find(event=>event.config?.childMode===undefined&&event.config);
  assert.ok(parent);assert.ok(expected.every(event=>event.owner===parent.id));
  const trace=()=>fs.existsSync(path.join(root,'trace'))?fs.readFileSync(path.join(root,'trace'),'utf8'):'';
  const before=trace();
  for(let reader=0;reader<2;reader++){
    const cold=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(new URL('../dist/session.js',import.meta.url).href)};
      const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
      assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
      assert.deepEqual(s.events.filter(e=>e.kind==='hook_resolver'),JSON.parse(process.argv[3]));
      for(const state of s.hookResolverObservations){assert.equal(state.event.owner,s.id);assert.equal(state.event.resolverType,'command');}
      s.close();`,root,parent.id,JSON.stringify(expected)],{encoding:'utf8',timeout:10000});
    assert.equal(cold.status,0,cold.stderr+cold.stdout);
    if(reader===0){const resumed=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--interactive','--no-tui','--resume',parent.id],{
      input:'continue\n',encoding:'utf8',timeout:20000,env:{...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`,WORKTREE_RESUME:'1'}});
      assert.equal(resumed.status,0,resumed.stderr+resumed.stdout);assert.equal(trace(),before);}
  }
  console.log(JSON.stringify({cut,journals:journals.length,executionRecords:expected.length,coldReaders:2,noReplay:true,upstream:0}));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
}
