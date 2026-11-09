import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'w385-http-startup-')));
const user=path.join(root,'user'),preload=path.join(root,'provider.mjs'),received=[];
const server=http.createServer((request,response)=>{
  let text='';request.on('data',chunk=>{text+=chunk});request.on('end',()=>{
    received.push(JSON.parse(text).hook_event_name);response.setHeader('content-type','application/json');
    response.end(JSON.stringify({additionalContext:'HTTP_USER_CONTEXT'}));
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const endpoint=`http://127.0.0.1:${server.address().port}/hook`;
const moduleURL=name=>new URL(`../dist/${name}.js`,import.meta.url).href;
try {
  fs.mkdirSync(user);fs.mkdirSync(path.join(root,'.git'));fs.mkdirSync(path.join(root,'.harness'));
  const hook={type:'http',url:endpoint,once:true};
  fs.writeFileSync(path.join(root,'.harness/settings.json'),JSON.stringify({hooks:{
    Setup:[hook,{command:"printf 'setup\\n' >> allowed-hooks",once:true}],
    SessionStart:[hook,{command:"printf 'start\\n' >> allowed-hooks",once:true}],
    UserPromptSubmit:[{type:'http',url:endpoint}],
  }}));
  fs.writeFileSync(preload,`const originalFetch=globalThis.fetch;globalThis.fetch=(input,init)=>{
    if(String(input)!==${JSON.stringify(endpoint)})throw Error('external network disabled');return originalFetch(input,init)};
    const {GatewayProvider}=await import(${JSON.stringify(moduleURL('provider'))});
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
      if(!JSON.stringify(request.messages).includes('HTTP_USER_CONTEXT'))throw Error('supported HTTP context missing');
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'DONE'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const env={...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`};
  const run=args=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe'],timeout:20000});let output='';
    child.stdout.on('data',bytes=>{output+=bytes});child.stderr.on('data',bytes=>{output+=bytes});child.on('error',reject);
    child.on('close',(code,signal)=>code===0?resolve():reject(Error(`CLI ${code}/${signal}: ${output}`)));
  });
  await run(['bin/litcode.mjs','--workspace',root,'--user-dir',user,'--model','fixture','--no-inherit-gateway','first']);
  assert.deepEqual(received,['UserPromptSubmit']);
  assert.equal(fs.readFileSync(path.join(root,'allowed-hooks'),'utf8'),'setup\nstart\n');
  const files=fs.readdirSync(path.join(root,'.agent')).filter(name=>name.endsWith('.jsonl'));assert.equal(files.length,1);const id=files[0].slice(0,-6);
  await run(['bin/litcode.mjs','--workspace',root,'--resume',id,'second']);
  assert.deepEqual(received,['UserPromptSubmit','UserPromptSubmit']);
  assert.equal(fs.readFileSync(path.join(root,'allowed-hooks'),'utf8'),'setup\nstart\n');
  for(let reader=0;reader<2;reader++){
    const cold=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(moduleURL('session'))};
      const s=Session.open(process.argv[1],{id:process.argv[2]});assert.deepEqual(readSessionJournal(process.argv[1],process.argv[2],{maxBytes:10000000,maxEvents:10000}),s.events);
      for(const event of ['Setup','SessionStart']){
        const once=s.events.filter(e=>e.kind==='hook_once'&&e.event===event);assert.equal(once.length,1);assert.ok(once[0].key.startsWith(event+':1:flat:'));
        assert.ok(s.events.some(e=>e.kind==='hook_result'&&e.event===event));
      }s.close();`,root,id],{encoding:'utf8',timeout:10000});assert.equal(cold.status,0,cold.stderr+cold.stdout);
  }
  console.log(JSON.stringify({startupHttp:0,setupHttp:0,supportedHttp:received.length,otherHooks:2,resume:true,coldReaders:2,upstream:0}));
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(root,{recursive:true,force:true});}
