import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
for (const allowed of [false, true]) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w385-permission-hook-')));
  const user = path.join(root,'user'), preload = path.join(root,'provider.mjs'), trace = path.join(root,'trace');
  fs.mkdirSync(user); fs.mkdirSync(path.join(root,'.git')); fs.mkdirSync(path.join(root,'.harness'));
  fs.writeFileSync(path.join(root,'.harness/settings.json'), JSON.stringify({hooks:{PermissionRequest:[{type:'agent',prompt:'UNSUPPORTED_PERMISSION_AGENT'}]}}));
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(url('provider'))});
    const {Agent}=await import(${JSON.stringify(url('agent'))});
    const trace=${JSON.stringify(trace)},run=Agent.prototype.run;
    Agent.prototype.run=function(...args){this.events.permission=async()=>{fs.appendFileSync(trace,'approval\\n');return ${allowed}};return Reflect.apply(run,this,args)};
    let calls=0;GatewayProvider.prototype.count=async()=>1;
    GatewayProvider.prototype.complete=async request=>{
      if(JSON.stringify(request.system).includes('Evaluate the configured lifecycle hook')){fs.appendFileSync(trace,'UNSUPPORTED_MODEL\\n');throw Error('unsupported resolver executed')}
      fs.appendFileSync(trace,'model\\n');const first=++calls===1;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
        content:first?[{type:'tool_use',id:'write',name:'write_file',input:{path:'result',content:'APPROVED_WRITE',overwrite:true}}]:[{type:'text',text:'DONE'}],
        stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
  try {
    const cli = spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--user-dir',user,'--model','fixture',
      '--permission-mode','ask','--no-inherit-gateway','write fixture'],{encoding:'utf8',timeout:20000,
      env:{...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`}});
    assert.equal(cli.status,0,cli.stderr+cli.stdout);
    assert.equal(fs.readFileSync(trace,'utf8'),'model\napproval\nmodel\n');
    assert.equal(fs.existsSync(path.join(root,'result')),allowed);
    if(allowed)assert.equal(fs.readFileSync(path.join(root,'result'),'utf8'),'APPROVED_WRITE');
    const journals=fs.readdirSync(path.join(root,'.agent')).filter(name=>name.endsWith('.jsonl'));
    assert.equal(journals.length,1);const id=journals[0].slice(0,-6);
    const read=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
      const s=Session.open(process.argv[1],{id:process.argv[2]});
      const result=s.events.find(e=>e.kind==='hook_result'&&e.event==='PermissionRequest');
      assert.ok(result);assert.equal(result.blocked,false);
      assert.ok(result.additionalContext.some(x=>x.includes('agent-type hooks are not supported for PermissionRequest')));
      assert.deepEqual(readSessionJournal(process.argv[1],process.argv[2],{maxBytes:10000000,maxEvents:10000}),s.events);s.close();`,root,id],
      {encoding:'utf8',timeout:10000});
    assert.equal(read.status,0,read.stderr+read.stdout);
    console.log(JSON.stringify({allowed,approvalCalls:1,mainModelCalls:2,hookModelCalls:0,coldReader:1,upstream:0}));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
