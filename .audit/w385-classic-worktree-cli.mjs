import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const cut of ['normal','create_admitted','create_fulfilled','remove_admitted','remove_fulfilled',
  'create_module_admitted','create_module_fulfilled','remove_module_admitted','remove_module_fulfilled']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w385-classic-cli-')));
  const user=path.join(root,'user'),checkout=path.join(root,'checkout'),modulePath=path.join(root,'classic.mjs'),preload=path.join(root,'provider.mjs'),trace=path.join(root,'trace');
  try {
    fs.mkdirSync(user);fs.mkdirSync(path.join(root,'.harness'));
    fs.writeFileSync(path.join(root,'.harness/settings.json'),JSON.stringify({features:{subagents:true,agentMessaging:true,agentTypes:true,worktrees:true}}));
    fs.writeFileSync(modulePath,`import fs from 'node:fs';export default {name:'classic-worktree-fixture',tier:'user',
      patterns:[{pattern:'classic.WorktreeCreate'},{pattern:'classic.WorktreeRemove'}],handlers:{
        'classic.WorktreeCreate':async()=>{fs.mkdirSync(${JSON.stringify(checkout)},{recursive:true});fs.appendFileSync(${JSON.stringify(trace)},'create\\n');return{worktreePath:${JSON.stringify(checkout)}}},
        'classic.WorktreeRemove':async()=>{fs.appendFileSync(${JSON.stringify(trace)},'remove\\n');return{}}}};`);
    fs.writeFileSync(preload,`globalThis.fetch=()=>{throw Error('external network disabled')};
      await import(${JSON.stringify(url('plugin-chain-registry'))});
      const {createChainRun,loadChainModuleFileInto}=await import(${JSON.stringify(url('plugin-chain-loader'))});
      await loadChainModuleFileInto(createChainRun(),{pluginName:'classic-worktree-fixture',modulePath:${JSON.stringify(modulePath)}});
      const {Session}=await import(${JSON.stringify(url('session'))});const append=Session.prototype.append,resume=process.env.CLASSIC_RESUME==='1';
      Session.prototype.append=function(event,...args){if(resume&&['classic_hook_chain','classic_hook_module'].includes(event.kind))throw Error('classic replay');
        const result=Reflect.apply(append,this,[event,...args]);const observed=['classic_hook_chain','classic_hook_module'].includes(event.kind);
        const point=(event.event?.endsWith('WorktreeCreate')?'create_':'remove_')+(event.kind==='classic_hook_module'?'module_':'')+event.phase;
        if(!resume&&observed&&${JSON.stringify(cut)}===point)process.kill(process.pid,'SIGKILL');return result;};
      const {GatewayProvider}=await import(${JSON.stringify(url('provider'))});let launched=false;
      GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
        const child=JSON.stringify(request.system).includes('You are a child agent assigned'),tool=!resume&&!child&&!launched;if(tool)launched=true;
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:tool?[{type:'tool_use',id:'isolated',name:'agent',input:{prompt:'Return done',mode:'general',isolation:'worktree',max_turns:1}}]:[{type:'text',text:'DONE'}],
          stop_reason:tool?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}};};`);
    const env={...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`};
    const run=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--user-dir',user,'--model','fixture','--permission-mode','bypass','--interactive','--no-tui','--no-inherit-gateway'],{input:'Run isolated child\n',encoding:'utf8',timeout:20000,env});
    if(cut==='normal')assert.equal(run.status,0,run.stderr+run.stdout);else assert.equal(run.signal,'SIGKILL',run.stderr+run.stdout);
    const journals=fs.readdirSync(path.join(root,'.agent')).filter(name=>name.endsWith('.jsonl')).map(name=>fs.readFileSync(path.join(root,'.agent',name),'utf8').trim().split('\n').map(JSON.parse));
    const parent=journals.find(rows=>rows[0].config.childMode===undefined);assert.ok(parent);
    const expected=parent.filter(e=>e.kind==='classic_hook_chain');
    assert.equal(expected.length,cut.startsWith('create_module')||cut==='create_admitted'?1:cut==='create_fulfilled'?2:cut.startsWith('remove_module')||cut==='remove_admitted'?3:4);
    const modules=parent.filter(e=>e.kind==='classic_hook_module');
    const moduleCounts={normal:4,create_admitted:0,create_fulfilled:2,remove_admitted:2,remove_fulfilled:4,
      create_module_admitted:1,create_module_fulfilled:2,remove_module_admitted:3,remove_module_fulfilled:4};
    assert.equal(modules.length,moduleCounts[cut]);
    const before=fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'';
    assert.equal(before,cut==='create_admitted'||cut==='create_module_admitted'?'':cut==='normal'||cut==='remove_fulfilled'||cut==='remove_module_fulfilled'?'create\nremove\n':'create\n');
    for(let reader=0;reader<2;reader++){
      const cold=spawnSync(process.execPath,['--input-type=module','-e',`
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(e=>e.kind==='classic_hook_chain'),JSON.parse(process.argv[3]));
        assert.deepEqual(s.events.filter(e=>e.kind==='classic_hook_module'),JSON.parse(process.argv[5]));
        assert.equal(s.classicHookChains.length,process.argv[4].startsWith('create_')?1:2);
        if(!s.awaitingResponse){const f=forkSession(s);assert.deepEqual(f.classicHookChains,[]);assert.deepEqual(f.classicHookModules,[]);f.close();}s.close();`,root,parent[0].id,JSON.stringify(expected),cut,JSON.stringify(modules)],{encoding:'utf8',timeout:10000});
      assert.equal(cold.status,0,cold.stderr+cold.stdout);
      if(reader===0){const resumed=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--interactive','--no-tui','--resume',parent[0].id],{input:'continue\n',encoding:'utf8',timeout:20000,env:{...env,CLASSIC_RESUME:'1'}});
        assert.equal(resumed.status,0,resumed.stderr+resumed.stdout);assert.equal(fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'',before);}
    }
    console.log(JSON.stringify({cut,records:expected.length,modules:modules.length,coldReaders:2,noReplay:true,upstream:0}));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
