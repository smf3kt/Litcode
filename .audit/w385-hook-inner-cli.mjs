import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const url=name=>new URL(`../dist/${name}.js`,import.meta.url).href;
const mcp=process.argv.includes('--mcp');
for(const cut of ['normal','admitted','fulfilled','resolver_returned']) {
  const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'hook-inner-cli-'))),user=path.join(root,'user'),preload=path.join(root,'preload.mjs'),trace=path.join(root,'trace');
  try {
    fs.mkdirSync(user);fs.mkdirSync(path.join(root,'.harness'));fs.writeFileSync(path.join(root,'value'),'INNER_FIXTURE');
    fs.writeFileSync(path.join(root,'.harness/settings.json'),JSON.stringify({hooks:{PreToolUse:[mcp?
      {type:'mcp_tool',tool:'mcp__fixture__read',arguments:{},timeout:5}:{type:'agent',prompt:'inspect',timeout:5}]}}));
    if(mcp){
      const server=path.join(root,'server.mjs');
      fs.writeFileSync(server,`import fs from 'node:fs';import readline from 'node:readline';
        const lines=readline.createInterface({input:process.stdin});lines.on('close',()=>process.exit(0));
        lines.on('line',line=>{const request=JSON.parse(line);if(request.id===undefined)return;
          let result={};if(request.method==='initialize')result={protocolVersion:request.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'owned-fixture',version:'1'}};
          else if(request.method==='tools/list')result={tools:[{name:'read',description:'owned read',inputSchema:{type:'object',properties:{}},annotations:{readOnlyHint:true}}]};
          else if(request.method==='tools/call'){fs.appendFileSync(${JSON.stringify(trace)},'observed\\n');result={content:[{type:'text',text:'{"ok":true}'}],structuredContent:{ok:true}};}
          process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\\n');});`);
      fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify({permissions:{mode:'bypass',allow:[],deny:[]},
        mcpServers:{fixture:{type:'stdio',command:process.execPath,args:[server]}}}));
    }
    fs.writeFileSync(preload,`import fs from 'node:fs';globalThis.fetch=()=>{throw Error('external network disabled')};
      const {Session}=await import(${JSON.stringify(url('session'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))});
      const append=Session.prototype.append,resume=process.env.INNER_RESUME==='1';
      Session.prototype.append=function(event,...args){if(resume&&['hook_tool','hook_resolver'].includes(event.kind))throw Error('inner replay');
        const result=Reflect.apply(append,this,[event,...args]);
        if(!resume&&(event.kind==='hook_tool'&&event.phase===${JSON.stringify(cut)}||event.kind==='hook_resolver'&&event.transition.phase==='returned'&&${JSON.stringify(cut)}==='resolver_returned'))process.kill(process.pid,'SIGKILL');return result;};
      let main=0,inner=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
        const hook=JSON.stringify(request.system).includes('Evaluate the configured lifecycle hook');
        if(resume&&hook)throw Error('model hook replay');const tool=!resume&&(hook?inner++===0:main++===0);
        if(hook&&!tool){if(!JSON.stringify(request.messages).includes('INNER_FIXTURE'))throw Error('inner read result missing');fs.appendFileSync(${JSON.stringify(trace)},'observed\\n');}
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:tool?[{type:'tool_use',id:hook?'inner-read':'outer-read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:hook?'{"ok":true}':'DONE'}],
          stop_reason:tool?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const env={...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`};
    const run=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--user-dir',user,'--model','fixture','--interactive','--no-tui','--no-inherit-gateway'],{input:'read value\n',encoding:'utf8',timeout:20000,env});
    if(cut==='normal')assert.equal(run.status,0,run.stderr+run.stdout);else assert.equal(run.signal,'SIGKILL',run.stderr+run.stdout);
    const name=fs.readdirSync(path.join(root,'.agent')).find(name=>name.endsWith('.jsonl'));
    const rows=fs.readFileSync(path.join(root,'.agent',name),'utf8').trim().split('\n').map(JSON.parse),id=rows[0].id;
    const expected=rows.filter(row=>row.kind==='hook_tool');assert.equal(expected.length,cut==='admitted'?1:2,
      run.stderr+run.stdout+JSON.stringify(rows.filter(row=>row.kind==='hook_result'||row.kind==='tool_result')));
    if(mcp)assert.equal(expected[0].tool,'mcp__fixture__read');else assert.equal(expected[0].callId,'inner-read');
    const before=fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'';
    assert.equal(before,cut==='normal'||cut==='resolver_returned'||mcp&&cut==='fulfilled'?'observed\n':'');
    for(let reader=0;reader<2;reader++) {
      const cold=spawnSync(process.execPath,['--input-type=module','-e',`
        import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};import {forkSession} from ${JSON.stringify(url('sessions'))};
        const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);
        assert.deepEqual(s.events.filter(row=>row.kind==='hook_tool'),JSON.parse(process.argv[3]));
        assert.equal(s.hookToolExecutions.length,1);if(!s.awaitingResponse){const f=forkSession(s);assert.deepEqual(f.hookToolExecutions,[]);f.close();}s.close();`,root,id,JSON.stringify(expected)],{encoding:'utf8',timeout:10000});
      assert.equal(cold.status,0,cold.stderr+cold.stdout);
      if(reader===0){const resume=spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--interactive','--no-tui','--resume',id],{input:'continue\n',encoding:'utf8',timeout:20000,env:{...env,INNER_RESUME:'1'}});
        assert.equal(resume.status,0,resume.stderr+resume.stdout);assert.equal(fs.existsSync(trace)?fs.readFileSync(trace,'utf8'):'',before);}
    }
    console.log(JSON.stringify({mcp,cut,records:expected.length,coldReaders:2,noReplay:true,upstream:0}));
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
