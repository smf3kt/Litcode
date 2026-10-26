import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from './terminal-screen.mjs';

const root=path.resolve(import.meta.dirname,'..');
const temporary=fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR?path.join(process.env.CLAUDE_JOB_DIR,'tmp'):root,'source-findings-cli-')));
const workspace=path.join(temporary,'workspace'),userDir=path.join(temporary,'user');
fs.mkdirSync(workspace);fs.mkdirSync(userDir);
const settings=value=>fs.writeFileSync(path.join(userDir,'settings.json'),JSON.stringify({prefersReducedMotion:true,promptSuggestionEnabled:false,...(value===undefined?{}:{features:{sourceFindings:value}})}));
settings();
const source={level:'high',findings:[
  {file:'first.ts',line:17,summary:'Retain the completed result',short_summary:'Retain result',failure_scenario:'Cancel after completion loses the retained result.',category:'correctness',verdict:'CONFIRMED'},
  {file:'second.ts',summary:'Keep the restored state',failure_scenario:'Restart with pending work drops the state.',outcome:'fixed'},
  {file:'first.ts',line:201,summary:'Preserve the original mode',failure_scenario:'Reload must retain an original session mode.',category:'compatibility',verdict:'PLAUSIBLE',outcome:'skipped'},
]};
const legacy={findings:[{file:'legacy.ts',line:1,summary:'Legacy finding',severity:'info'}]};
const requests=[];
function send(response,block){const tool=block.type==='tool_use';const events=[
 ['message_start',{type:'message_start',message:{id:'findings',type:'message',role:'assistant',model:'fixture',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}}],
 ['content_block_start',{type:'content_block_start',index:0,content_block:tool?{...block,input:{}}:{type:'text',text:''}}],
 ['content_block_delta',{type:'content_block_delta',index:0,delta:tool?{type:'input_json_delta',partial_json:JSON.stringify(block.input)}:{type:'text_delta',text:block.text}}],
 ['content_block_stop',{type:'content_block_stop',index:0}],['message_delta',{type:'message_delta',delta:{stop_reason:tool?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:1}}],['message_stop',{type:'message_stop'}]];
 response.writeHead(200,{'content-type':'text/event-stream'});response.end(events.map(([event,data])=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(''));}
const server=http.createServer(async(request,response)=>{try{const chunks=[];for await(const chunk of request)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));requests.push(body);const last=body.messages.at(-1)?.content;send(response,typeof last==='string'&&last.startsWith('REPORT_')?{type:'tool_use',id:`report-${requests.length}`,name:'report_findings',input:last.includes('EMPTY')?{findings:[]}:last.includes('LEGACY')?legacy:source}:{type:'text',text:'FINDINGS_DONE'});}catch(error){response.writeHead(500);response.end(String(error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const env={...process.env,HOME:temporary,TERM:'xterm-256color',HARNESS_LOOP_KEEPALIVE:'off'};
for(const key of Object.keys(env))if(/^(LLM_|ANTHROPIC_)/.test(key))delete env[key];
Object.assign(env,{LLM_API_KEY:'owned-findings-fixture',LLM_MODEL:'fixture',LLM_AUTH:'bearer',LLM_BASE_URL:`http://127.0.0.1:${server.address().port}`,LLM_TOKEN_COUNTING:'estimate',LLM_THINKING:'false'});
const pty=path.join(temporary,'pty.exp'),sizeFile=path.join(temporary,'columns');
fs.writeFileSync(sizeFile,'120');
fs.writeFileSync(pty,`set stty_init "rows 38 columns 120"
set last_columns 120
proc watch_size {} {
 global spawn_id spawn_out last_columns env
 set file [open $env(FINDINGS_FIXTURE_SIZE) r]
 set columns [string trim [read $file]]
 close $file
 if {[string is integer -strict $columns] && $columns != $last_columns} {
  stty rows 38 columns $columns < $spawn_out(slave,name)
  exec kill -WINCH [exp_pid -i $spawn_id]
  set last_columns $columns
 }
 after 100 watch_size
}
after 100 watch_size
source {${path.join(root,'scripts/pty-cli.exp')}}
`);
env.FINDINGS_FIXTURE_SIZE=sizeFile;
const children=[];
let active;
async function until(check,label){const end=Date.now()+10000;while(!check()){assert.ok(Date.now()<end,`${label}\n${active?.frame()}\n${active?.errors}`);assert.equal(active?.closed,false,label);await delay(20);}}
const held=()=>fs.readdirSync(path.join(workspace,'.agent')).filter(name=>name.endsWith('.jsonl.lock')).map(name=>{const file=path.join(workspace,'.agent',name.slice(0,-5)),text=fs.readFileSync(file,'utf8');return{id:name.slice(0,-11),rows:text.slice(0,text.lastIndexOf('\n')).split('\n').filter(Boolean).map(JSON.parse)};})[0];
async function launch(id,inline=false){fs.writeFileSync(sizeFile,'120');const screen=new TerminalScreen(120,38);const child=spawn('/usr/bin/expect',[pty,process.execPath,path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--interactive','--no-inherit-gateway',...(inline?['--no-tui']:[]),...(id?['--resume',id]:['--user-dir',userDir])],{cwd:root,env,detached:true,stdio:['pipe','pipe','pipe']});const state={child,screen,errors:'',closed:false,frame:()=>screen.lines().join('\n'),ready:()=>inline?screen.lines().some(line=>line.trim()==='>'||line.includes('> finished: end_turn; model calls: 2')):screen.lines().join('\n').includes('ready')};child.stdout.setEncoding('utf8');child.stdout.on('data',text=>screen.write(text));child.stderr.on('data',text=>{state.errors+=text;});state.exit=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{state.closed=true;resolve(code);});});children.push(state);active=state;await until(()=>state.ready()&&fs.existsSync(path.join(workspace,'.agent'))&&held(),'ready');return state;}
async function report(state,name,expected){const before=requests.length;state.child.stdin.write(name+'\r');await until(()=>requests.length===before+2&&state.frame().includes('FINDINGS_DONE')&&state.ready(),name);const result=requests.at(-1).messages.flatMap(message=>Array.isArray(message.content)?message.content:[]).findLast(block=>block.type==='tool_result');assert.ok(result);if(expected==='error')assert.equal(result.is_error,true);else{assert.equal(result.is_error??false,false,JSON.stringify(result));if(typeof expected==='string')assert.equal(result.content,expected);else assert.deepEqual(JSON.parse(String(result.content)),expected);}return result;}
async function close(state){state.child.stdin.write('/exit\r');assert.equal(await Promise.race([state.exit,delay(5000).then(()=>-1)]),0,state.errors);state.screen.close();assert.equal(fs.readdirSync(path.join(workspace,'.agent')).some(name=>name.endsWith('.lock')),false);}
try{
 let state=await launch();
 const original=held();
 await report(state,'REPORT_SOURCE','3 findings reported.');
 assert.equal(original.rows[0].config.features.sourceFindings,true);
 assert.match(state.frame(),/first\.ts/);assert.match(state.frame(),/Retain the completed result/);assert.match(state.frame(),/\[skipped\]/);assert.match(state.frame(),/second\.ts/);
 const record=held().rows.findLast(row=>row.kind==='tool_result');assert.deepEqual(record.host,{kind:'findings',count:3,...source});
 state.screen.resize(46,38);fs.writeFileSync(sizeFile,'46');
 await until(()=>state.frame().includes('[correctness]')&&state.frame().includes('[skipped]'),'narrow grouped rows');
 state.screen.resize(120,38);fs.writeFileSync(sizeFile,'120');
 await until(()=>state.frame().includes(source.findings[0].summary)&&state.frame().includes(source.findings[2].summary),'wide grouped rows restored');
 state.child.stdin.write('\x0f');await until(()=>state.frame().includes(source.findings[0].failure_scenario),'verbose scenario');state.child.stdin.write('\x0f');
 await report(state,'REPORT_EMPTY','No findings reported.');
 await close(state);settings(false);state=await launch(original.id);assert.deepEqual(held().rows[0],original.rows[0]);await report(state,'REPORT_RESUMED','3 findings reported.');
 state.child.stdin.write('/reload\r');await until(()=>held()?.id!==original.id&&held()?.rows[0].config.features.sourceFindings===false&&state.ready(),'legacy reload');
 await report(state,'REPORT_SOURCE','error');await report(state,'REPORT_LEGACY',legacy);await close(state);
 state=await launch();assert.equal(held().rows[0].config.features.sourceFindings,false);await report(state,'REPORT_LEGACY',legacy);await close(state);
 settings(true);state=await launch(undefined,true);await report(state,'REPORT_INLINE','3 findings reported.');
 assert.match(state.frame(),/first\.ts/);assert.match(state.frame(),/Retain the completed result/);assert.match(state.frame(),/\[skipped\]/);await close(state);
 assert.equal(requests.length,14);console.log(JSON.stringify({sourceFindings:'passed',typedHost:true,compactOutput:true,groupedUI:true,widthRestore:true,verbose:true,inline:true,pinnedResume:true,legacyReload:true,freshLegacy:true,requests:requests.length,externalCalls:0}));
}finally{for(const state of children){if(!state.closed){try{process.kill(-state.child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}await state.exit;}state.screen.close();}server.closeAllConnections();await new Promise(resolve=>server.close(resolve));fs.rmSync(temporary,{recursive:true,force:true});}
