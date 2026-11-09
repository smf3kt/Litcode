import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const reloadMode = process.argv.includes('--reload');
const pre = reloadMode || process.argv.includes('--pre');
const cuts = reloadMode ? ['reload_success','reload_error','reload_abort','reload_wait'] :
  ['normal','failure',...(pre?['denial','rewrite']:[]),'chain_admitted','module_admitted','module_fulfilled','chain_fulfilled'];
for (const cut of cuts) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'agent-classic-cli-')));
  const user=path.join(root,'user'),modulePath=path.join(root,'classic.mjs'),preload=path.join(root,'preload.mjs'),trace=path.join(root,'trace');
  try {
    fs.mkdirSync(user);fs.writeFileSync(path.join(root,'value'),'owned fixture');
    fs.writeFileSync(path.join(root,'changed'),'rewritten fixture');
    fs.writeFileSync(modulePath,`import fs from 'node:fs';const events=${JSON.stringify(pre?['PreToolUse']:['PostToolUse','PostToolUseFailure','PostToolBatch'])};
      export default {name:'agent-classic-fixture',tier:'user',patterns:events.map(event=>({pattern:'classic.'+event})),
        handlers:Object.fromEntries(events.map(event=>['classic.'+event,async()=>{fs.appendFileSync(${JSON.stringify(trace)},event+'\\n');return ${JSON.stringify(cut==='denial'?{deny:'owned pre denial'}:cut==='rewrite'?{updatedInput:{path:'changed'}}:{})}}]))};`);
    fs.writeFileSync(preload,`globalThis.fetch=()=>{throw Error('external network disabled')};
      await import(${JSON.stringify(url('plugin-chain-registry'))});
      const {createChainRun,loadChainModuleFileInto}=await import(${JSON.stringify(url('plugin-chain-loader'))});
      await loadChainModuleFileInto(createChainRun(),{pluginName:'agent-classic-fixture',modulePath:${JSON.stringify(modulePath)}});
      const {Session}=await import(${JSON.stringify(url('session'))});const append=Session.prototype.append,resume=process.env.CLASSIC_RESUME==='1';
      const fs=await import('node:fs'),{it}=await import(${JSON.stringify(url('plugin-chain-host'))});
      let releaseReload,rejectReload,reloadStarted=false;
      const pendingReload=${reloadMode}&&!resume?new Promise((resolve,reject)=>{releaseReload=resolve;rejectReload=reject}):undefined;
      if(pendingReload)it().hooksRespawns.add(pendingReload);
      Session.prototype.append=function(event,...args){const observed=['classic_hook_chain','classic_hook_module'].includes(event.kind);
        if(resume&&observed)throw Error('classic replay');const result=Reflect.apply(append,this,[event,...args]);
        if(pendingReload&&!reloadStarted&&event.kind==='classic_hook_chain'&&event.phase==='admitted'){
          reloadStarted=true;setTimeout(()=>{
            if(fs.existsSync(${JSON.stringify(trace)}))throw Error('module entered before reload finished');
            if(${JSON.stringify(cut)}==='reload_wait')process.kill(process.pid,'SIGKILL');
            it().hooksRespawns.delete(pendingReload);
            if(${JSON.stringify(cut)}==='reload_error')rejectReload(Error('owned reload denial'));
            else if(${JSON.stringify(cut)}==='reload_abort')rejectReload(new DOMException('owned reload abort','AbortError'));
            else releaseReload();
          },30);
        }
        const point=(event.kind==='classic_hook_module'?'module_':'chain_')+event.phase;
        if(!resume&&observed&&event.event.endsWith(${JSON.stringify(pre?'PreToolUse':'PostToolUse')})&&point===${JSON.stringify(cut)})process.kill(process.pid,'SIGKILL');return result;};
      const {GatewayProvider}=await import(${JSON.stringify(url('provider'))});let launched=false;
      GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{const first=!resume&&!launched;launched=true;
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:first?[{type:'tool_use',id:'observed',name:'read_file',input:{path:${JSON.stringify(cut==='failure'?'absent':'value')}}}]:[{type:'text',text:'DONE'}],
          stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const env={...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`};
    const run=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--user-dir',user,'--model','fixture','--interactive','--no-tui','--no-inherit-gateway'],{input:'read value\n',encoding:'utf8',timeout:20000,env});
    const normal=['normal','failure','denial','rewrite','reload_success','reload_error','reload_abort'].includes(cut);
    if(normal)assert.equal(run.status,0,run.stderr+run.stdout);else assert.equal(run.signal,'SIGKILL',run.stderr+run.stdout);
    const name=fs.readdirSync(path.join(root,'.agent')).find(name=>name.endsWith('.jsonl'));
    const rows=fs.readFileSync(path.join(root,'.agent',name),'utf8').trim().split('\n').map(JSON.parse),id=rows[0].id;
    const expected=rows.filter(row=>['classic_hook_chain','classic_hook_module'].includes(row.kind));
    assert.ok(expected.length>0);
    const before=fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'';
    const firstEvent=pre?'PreToolUse':cut==='failure'?'PostToolUseFailure':'PostToolUse';
    if(['reload_error','reload_abort','reload_wait'].includes(cut))assert.equal(before,'');
    else if(normal)assert.ok(before.includes(firstEvent+'\n'));
    else assert.equal(before,cut.endsWith('admitted')?'':firstEvent+'\n');
    if(pre) {
      const results=rows.filter(row=>row.kind==='tool_result');
      if(!normal)assert.equal(results.length,0,'tool must not complete before the pre-hook cut');
      else if(cut==='denial')assert.match(JSON.stringify(results),/owned pre denial/);
      else if(cut==='rewrite')assert.match(JSON.stringify(results),/rewritten fixture/);
      else if(cut==='normal')assert.match(JSON.stringify(results),/owned fixture/);
      else if(cut==='reload_success')assert.match(JSON.stringify(results),/owned fixture/);
      else if(cut==='reload_error')assert.match(JSON.stringify(results),/owned reload denial/);
      else if(cut==='reload_abort')assert.match(JSON.stringify(results),/owned reload abort/);
      if(reloadMode){
        assert.equal(expected.filter(row=>row.kind==='classic_hook_module').length,cut==='reload_success'?2:0);
        const chains=expected.filter(row=>row.kind==='classic_hook_chain');
        assert.equal(chains.at(-1).phase,cut==='reload_wait'?'admitted':cut==='reload_abort'?'rejected':'fulfilled');
      }
    }
    for(let reader=0;reader<2;reader++) {
      const cold=spawnSync(process.execPath,['--input-type=module','-e',`
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(row=>['classic_hook_chain','classic_hook_module'].includes(row.kind)),JSON.parse(process.argv[3]));s.close();`,root,id,JSON.stringify(expected)],{encoding:'utf8',timeout:10000});
      assert.equal(cold.status,0,cold.stderr+cold.stdout);
      if(reader===0) {
        const resume=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--interactive','--no-tui','--resume',id],{input:'continue\n',encoding:'utf8',timeout:20000,env:{...env,CLASSIC_RESUME:'1'}});
        assert.equal(resume.status,0,resume.stderr+resume.stdout);assert.equal(fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'',before);
      }
    }
    console.log(JSON.stringify({pre,cut,records:expected.length,coldReaders:2,noReplay:true,upstream:0}));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
