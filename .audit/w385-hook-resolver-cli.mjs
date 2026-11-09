import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const cut of ['normal','admitted','settled','returned','late_returned','late_settled']) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w385-resolver-cli-')));
  const user=path.join(root,'user'),preload=path.join(root,'provider.mjs'),trace=path.join(root,'trace');
  fs.mkdirSync(user);fs.mkdirSync(path.join(root,'.git'));fs.mkdirSync(path.join(root,'.harness'));fs.writeFileSync(path.join(root,'value'),'LOCAL');
  fs.writeFileSync(path.join(root,'.harness/settings.json'),JSON.stringify({hooks:{PreToolUse:[{type:'prompt',prompt:'RESOLVER_FIXTURE',timeout:0.03}]}}));
  fs.writeFileSync(preload,`import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(url('provider'))});const {Session}=await import(${JSON.stringify(url('session'))});
    const cut=${JSON.stringify(cut)},late=cut.startsWith('late_'),resume=process.env.RESOLVER_RESUME==='1';let release=()=>{};
    const waiting=new Promise(resolve=>release=resolve),append=Session.prototype.append;
    Session.prototype.append=function(event,...args){
      if(resume&&event.kind==='hook_resolver')throw Error('resolver replay');
      const result=Reflect.apply(append,this,[event,...args]);
      if(event.kind==='hook_resolver'&&(cut===event.transition.phase||late&&cut==='late_'+event.transition.phase))process.kill(process.pid,'SIGKILL');
      if(event.kind==='hook_result'&&event.event==='PreToolUse')release();return result;};
    let main=0;GatewayProvider.prototype.count=async()=>1;
    GatewayProvider.prototype.complete=async request=>{
      const hook=JSON.stringify(request.system).includes('Evaluate the configured lifecycle hook');
      if(hook){if(resume)throw Error('hook model replay');fs.appendFileSync(${JSON.stringify(trace)},'resolver\\n');if(late)await waiting;}
      const tool=!hook&&!resume&&++main===1;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
        content:hook?[{type:'text',text:'{"ok":true}'}]:tool?[{type:'tool_use',id:'read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
        stop_reason:tool?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}};};`);
  const env={...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`};
  try {
    const cli=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--user-dir',user,'--model','fixture','--interactive','--no-tui','--no-inherit-gateway'],
      {input:'read value\n',encoding:'utf8',timeout:20000,env});
    if(cut==='normal')assert.equal(cli.status,0,cli.stderr+cli.stdout);else assert.equal(cli.signal,'SIGKILL',cli.stderr+cli.stdout);
    const files=fs.readdirSync(path.join(root,'.agent')).filter(name=>name.endsWith('.jsonl'));assert.equal(files.length,1);const id=files[0].slice(0,-6);
    const expected=fs.readFileSync(path.join(root,'.agent',files[0]),'utf8').trim().split('\n').map(JSON.parse).filter(row=>row.kind==='hook_resolver');
    assert.equal(expected.length,cut==='admitted'?1:cut==='settled'||cut==='late_returned'?2:3);
    if(cut.startsWith('late_'))assert.equal(expected[1].transition.outcome,'timed_out');
    for(let reader=0;reader<2;reader++){
      const cold=spawnSync(process.execPath,['--input-type=module','-e',`
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],process.argv[2],{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(e=>e.kind==='hook_resolver'),JSON.parse(process.argv[3]));assert.equal(s.hookResolverObservations.length,1);
        if(!s.awaitingResponse){const f=forkSession(s);assert.deepEqual(f.hookResolverObservations,[]);f.close();}s.close();`,root,id,JSON.stringify(expected)],{encoding:'utf8',timeout:10000});
      assert.equal(cold.status,0,cold.stderr+cold.stdout);
      if(reader===0){const resumed=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--interactive','--no-tui','--resume',id],
        {input:'continue\n',encoding:'utf8',timeout:20000,env:{...env,RESOLVER_RESUME:'1'}});assert.equal(resumed.status,0,resumed.stderr+resumed.stdout);}
    }
    assert.equal(fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'',cut==='admitted'?'':'resolver\n');
    console.log(JSON.stringify({cut,records:expected.length,coldReaders:2,resumed:true,upstream:0}));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
