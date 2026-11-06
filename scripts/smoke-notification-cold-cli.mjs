import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { captureIdentity } from './identity.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temp = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR, 'tmp', 'notification-cli-')));
const workspace = path.join(temp, 'workspace'); fs.mkdirSync(workspace);
const requests = [];
const server = http.createServer((req, res) => { const chunks=[]; req.on('data', c=>chunks.push(c)); req.on('end',()=>{
 const body=JSON.parse(Buffer.concat(chunks)); requests.push(body);
 const launch=body.messages.at(-1)?.content==='START_REAL_BACKGROUND';
 const block=launch?{type:'tool_use',id:'real-background',name:'run_background',input:{command:`printf 'once\\n' >> '${workspace}/effect'; printf '%s' "$$" > '${workspace}/job.pid'; printf 'REAL_JOB_OUTPUT\\n'`,description:'real notification fixture'}}:{type:'text',text:'ACCEPTED'};
 const events=[{type:'message_start',message:{id:'fixture',type:'message',role:'assistant',model:body.model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}},
 {type:'content_block_start',index:0,content_block:launch?{...block,input:{}}:{type:'text',text:''}},{type:'content_block_delta',index:0,delta:launch?{type:'input_json_delta',partial_json:JSON.stringify(block.input)}:{type:'text_delta',text:block.text}},
 {type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:launch?'tool_use':'end_turn',stop_sequence:null},usage:{output_tokens:1}},{type:'message_stop'}];
 res.writeHead(200,{'content-type':'text/event-stream'});res.end(events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''));
});});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const writer = spawnSync(process.execPath, ['--input-type=module', '-e', `
import fs from 'node:fs'; import {randomUUID} from 'node:crypto';
 import {issueNotificationAuthorization,bindNotificationMessage} from './dist/notification-authorization.js';
 import {Session,renderNotificationBatch} from './dist/session.js'; import {defaultConfig} from './dist/agent.js'; import {createRuntime,pinToolSchemas} from './dist/runtime.js';
const ids=[]; for (const mode of ['fsync','short','fsync-pty-dir','fsync-pty-kill','fsync-pty-retry','fsync-pty-retry-kill']) {
 const config={...defaultConfig(process.argv[1],[]),model:'fixture',skills:[]}; config.gateway.baseURL=process.argv[2];config.gateway.auth='bearer'; const runtime=await createRuntime(config,{},new AbortController().signal);config.tools=pinToolSchemas(runtime.tools);
 const s=Session.open(process.argv[1],{config}), deliveryId=randomUUID();
 const secret='SECRET_NOTIFICATION_'+mode,batch={kind:'background',events:[],dropped:0,pending:0,maxOutputBytes:24000};
 s.append({kind:'notification_intent_v2',owner:s.id,deliveryId,batch});
 const sync=fs.fsyncSync, write=fs.writeSync; let first=true;
 if(mode.startsWith('fsync')) fs.fsyncSync=()=>{throw Error('fsync fault')};
 else fs.writeSync=(...a)=>{if(first){first=false;return write(a[0],a[1],a[2],Math.floor(a[3]/2),a[4])} throw Error('short fault')};
 const msg={role:'user',content:[{type:'text',text:renderNotificationBatch(batch)},{type:'text',text:'Hook context:\\n'+secret}]};const token=issueNotificationAuthorization(s,deliveryId,batch,()=>true,()=>batch);bindNotificationMessage(token,s,msg);try{s.append({kind:'message',message:msg,notificationDelivery:{owner:s.id,deliveryId}},token);throw Error('fault missed')}catch(e){if(!['fsync fault','short fault'].includes(e.message))throw e}
 fs.fsyncSync=sync;fs.writeSync=write;assertFence(s,deliveryId);ids.push({id:s.id,deliveryId,mode});s.close();await runtime.close();
} {const config={...defaultConfig(process.argv[1],[]),model:'fixture',skills:[],permissions:{mode:'bypass',allow:[],deny:[]},features:{tasks:false,subagents:true,agentMessaging:true,background:true}};config.gateway.baseURL=process.argv[2];config.gateway.auth='bearer';const runtime=await createRuntime(config,{},new AbortController().signal);config.tools=pinToolSchemas(runtime.tools);const s=Session.open(process.argv[1],{config});ids.push({id:s.id,mode:'real'});s.close();await runtime.close()}
function assertFence(s,id){if(!s.isJournalFenced)throw Error('no fence');try{s.append({kind:'message',message:{role:'user',content:'retry'},notificationDelivery:{owner:s.id,deliveryId:id}});throw Error('fence missed')}catch(e){if(e.message==='fence missed')throw e}}
process.stdout.write(JSON.stringify(ids));
`, workspace, `http://127.0.0.1:${server.address().port}`], { cwd: root, encoding: 'utf8', env: process.env });
assert.equal(writer.status, 0, writer.stderr); const owners = JSON.parse(writer.stdout);
const env={...process.env};for(const k of Object.keys(env))if(/^(LLM_|ANTHROPIC_)/.test(k))delete env[k];
Object.assign(env,{LLM_API_KEY:'fixture',LLM_MODEL:'fixture',LLM_THINKING:'false',LLM_AUTH:'bearer',LLM_TOKEN_COUNTING:'estimate',LLM_BASE_URL:`http://127.0.0.1:${server.address().port}`});
const barrier=path.join(temp,'pipe-barrier.mjs');
fs.writeFileSync(barrier,`import fs from 'node:fs';for(const stream of [process.stdout,process.stderr]){const write=stream.write;stream.write=function(chunk,...args){if(String(chunk).includes('Notification delivery status unknown:')){fs.writeSync(3,'ready');process.kill(process.pid,'SIGSTOP')}return write.call(this,chunk,...args)}}`);
async function run(owner,format,broken) {
 const before=requests.length;
 const child=spawn(process.execPath,[path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--resume',owner.id,'--output-format',format,'ordinary input'],{cwd:root,env:{...env,HOME:temp,...(broken?{NODE_OPTIONS:`--import=${barrier}`}:{})},stdio:['ignore','pipe','pipe',...(broken?['pipe']:[])]});
 let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
 if(broken) child.stdio[3].once('data',()=>{assert.ok(fs.existsSync(path.join(workspace,'.agent',`${owner.id}.jsonl.lock`)));child[broken].destroy();setTimeout(()=>child.kill('SIGCONT'),50);});
 const timer=setTimeout(()=>child.kill('SIGKILL'),20000);
 const [code,signal]=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',(...args)=>resolve(args));});clearTimeout(timer);
 assert.equal(fs.existsSync(path.join(workspace,'.agent',`${owner.id}.jsonl.lock`)),false,'session lock leaked');
 if(broken){assert.notEqual(code,0,`${format} ${broken} ${out} ${err}`);assert.equal(requests.length,before);return;}
 assert.equal(signal,null);assert.equal(code,0,err);
 const notice=`Notification delivery status unknown: ${owner.deliveryId}. It has not been automatically retried; retain this ID for reconciliation.`;
 if(format==='stream-json') {const lines=out.trim().split('\n').map(JSON.parse);assert.deepEqual(lines[0],{type:'status',message:notice,sequence:1,session_id:owner.id});assert.equal(lines.at(-1).type,'result');}
 else {assert.ok(err.split('\n').includes(notice));if(format==='json')assert.equal(JSON.parse(out).text,'ACCEPTED');else assert.equal(out,'ACCEPTED\n');}
 assert.ok(!(out+err).includes(owners.find(o=>o!==owner).deliveryId));
 assert.equal(requests.length,before+1);const messages=JSON.stringify(requests.at(-1).messages);assert.ok(messages.includes('ordinary input'));assert.ok(!messages.includes('SECRET_NOTIFICATION_'));
}
try {
 const real=owners[6], journal=path.join(workspace,'.agent',`${real.id}.jsonl`), fault=path.join(temp,'real-fsync.mjs'), faultMarker=path.join(temp,'real-fsync.marker');
 fs.writeFileSync(fault,`import fs from 'node:fs';const write=fs.writeSync,sync=fs.fsyncSync;let target;fs.writeSync=function(fd,bytes,...args){const result=write.call(this,fd,bytes,...args);if(Buffer.isBuffer(bytes)&&bytes.toString().includes('"notificationDelivery"'))target=fd;return result};fs.fsyncSync=function(fd){if(fd===target){target=undefined;fs.writeFileSync(process.env.REAL_FAULT_MARKER,'message-written');throw Error('real notification fsync fault')}return sync(fd)};`);
 const startReal=extra=>{const p=spawn('/usr/bin/expect',[path.join(root,'scripts/pty-cli.exp'),process.execPath,path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--interactive','--resume',real.id],{cwd:root,env:{...env,HOME:temp,...extra},stdio:['pipe','pipe','pipe']});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);return {p,get output(){return output},done:new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',resolve)})}};
 const waitReal=async(p,predicate,label)=>{const deadline=Date.now()+20000;while(!predicate()){if(p.p.exitCode!==null||Date.now()>deadline)throw Error(`${label}: ${p.output}`);await new Promise(r=>setTimeout(r,25))}};
 const first=startReal({NODE_OPTIONS:`--import=${fault}`,REAL_FAULT_MARKER:faultMarker});
 try {
  await waitReal(first,()=>first.output.includes('ready'),'real first prompt');first.p.stdin.write('START_REAL_BACKGROUND\r');
  await waitReal(first,()=>fs.existsSync(faultMarker),'real notification fsync fault');first.p.stdin.write('/exit\r');
  assert.equal(await Promise.race([first.done,new Promise((_,reject)=>setTimeout(()=>reject(Error('real first exit timeout')),15000))]),0,first.output);
 } finally {if(first.p.exitCode===null)first.p.kill('SIGKILL');first.p.stdin.destroy()}
 assert.equal(fs.existsSync(`${journal}.lock`),false,'real first session lock leaked');
 const initial=fs.readFileSync(journal,'utf8').trim().split('\n').map(JSON.parse), failed=initial.find(x=>x.kind==='message'&&x.notificationDelivery), original=initial.find(x=>x.kind==='notification_intent_v2'&&x.deliveryId===failed?.notificationDelivery.deliveryId);
 const job=JSON.parse(initial.find(x=>x.kind==='tool_result'&&x.result.tool_use_id==='real-background').result.content);
 assert.ok(original?.batch.events.length,'real batch missing events');assert.equal(original.owner,real.id);assert.ok(original.batch.events.some(x=>x.job_id===job.id&&x.kind==='exit'&&x.state==='completed'&&x.exit_code===0));assert.equal(fs.readFileSync(path.join(workspace,'effect'),'utf8'),'once\n');
 const coldReal=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';const [root,id,delivery,other]=process.argv.slice(1),s=Session.open(root,{id});if(!s.notificationCoordination.some(x=>x.deliveryId===delivery)||s.messages.some(x=>x.content?.includes?.('Background task events')))throw Error('cold isolation failed');try{s.retryNotification(other,delivery);throw Error('wrong owner accepted')}catch(e){if(e.message==='wrong owner accepted')throw e}s.close()`,workspace,real.id,original.deliveryId,owners[0].id],{cwd:root,encoding:'utf8'});assert.equal(coldReal.status,0,coldReal.stderr);
 const beforeReal=requests.length, second=startReal({});
 try {
  await waitReal(second,()=>second.output.includes('ready'),'real cold prompt');assert.equal(requests.length,beforeReal);
  const contender=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';try{const s=Session.open(process.argv[1],{id:process.argv[2]});s.close();process.exit(1)}catch{}`,workspace,real.id],{cwd:root,encoding:'utf8'});assert.equal(contender.status,0,'live session lock did not exclude contender');
  second.p.stdin.write(`/notification ${real.id} ${original.deliveryId} retry\r`);
  await waitReal(second,()=>requests.length===beforeReal+1,'real retry model request');
  assert.equal(requests.at(-1).messages.at(-1).content,failed.message.content,'retry message differs from real failed delivery');
  await waitReal(second,()=>fs.readFileSync(journal,'utf8').includes('"decision"')||fs.existsSync(`${journal}.notification-${original.deliveryId}.decision-receipt`),'real decision receipt');
  second.p.stdin.write('/exit\r');assert.equal(await Promise.race([second.done,new Promise((_,reject)=>setTimeout(()=>reject(Error('real retry exit timeout')),15000))]),0,second.output);
 } finally {if(second.p.exitCode===null)second.p.kill('SIGKILL');second.p.stdin.destroy()}
 assert.equal(fs.existsSync(`${journal}.lock`),false,'real retry session lock leaked');assert.equal(fs.readFileSync(path.join(workspace,'effect'),'utf8'),'once\n');
 const decision=JSON.parse(fs.readFileSync(`${journal}.notification-${original.deliveryId}.decision`)),decisionReceipt=JSON.parse(fs.readFileSync(`${journal}.notification-${original.deliveryId}.decision-receipt`));
 const finalRows=fs.readFileSync(journal,'utf8').trim().split('\n').map(JSON.parse), retryIntent=finalRows.find(x=>x.kind==='notification_intent_v2'&&x.deliveryId===decision.retryDeliveryId),retryMessages=finalRows.filter(x=>x.kind==='message'&&x.notificationDelivery?.deliveryId===decision.retryDeliveryId);
 const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 assert.equal(decision.owner,real.id);assert.equal(decision.deliveryId,original.deliveryId);assert.equal(decision.decision,'retry');assert.equal(decision.intent,digest(original));assert.equal(decisionReceipt.owner,real.id);assert.equal(decisionReceipt.deliveryId,original.deliveryId);assert.equal(decisionReceipt.decision,digest(decision));assert.deepEqual(retryIntent.batch,original.batch);assert.equal(retryMessages.length,1);assert.equal(retryMessages[0].message.content,failed.message.content);
 const realIntent=JSON.parse(fs.readFileSync(`${journal}.notification-${decision.retryDeliveryId}.intent`)),realReceipt=JSON.parse(fs.readFileSync(`${journal}.notification-${decision.retryDeliveryId}.receipt`));assert.equal(realIntent.owner,real.id);assert.equal(realIntent.deliveryId,decision.retryDeliveryId);assert.equal(realIntent.intent,digest(retryIntent));assert.equal(realReceipt.owner,real.id);assert.equal(realReceipt.deliveryId,decision.retryDeliveryId);assert.equal(realReceipt.intent,digest(retryIntent));assert.equal(realReceipt.message,digest(retryMessages[0]));assert.equal(requests.length,beforeReal+1);
 for(const pid of new Set([job.pid,Number(fs.readFileSync(path.join(workspace,'job.pid'),'utf8'))]))try{process.kill(pid,0);assert.fail(`real process ${pid} still alive`)}catch(e){if(e.code!=='ESRCH')throw e}
 for(const owner of owners.slice(0,2)) for(const format of ['text','json','stream-json']) await run(owner,format);
 for(const [format,pipe] of [['text','stderr'],['json','stderr'],['stream-json','stdout']]) await run(owners[0],format,pipe);
 const inspect=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';for(const x of JSON.parse(process.argv[2])){const s=Session.open(process.argv[1],{id:x.id});if(!s.unknownNotifications.some(n=>n.deliveryId===x.deliveryId))throw Error('lost unknown');if(s.messages.some(m=>JSON.stringify(m).includes('SECRET_NOTIFICATION_')))throw Error('exposed');try{s.append({kind:'message',message:{role:'user',content:'retry'},notificationDelivery:{owner:s.id,deliveryId:x.deliveryId}});throw Error('retry accepted')}catch(e){if(e.message==='retry accepted')throw e}s.close()}`,workspace,JSON.stringify(owners.slice(0,6))],{cwd:root,encoding:'utf8'});
 assert.equal(inspect.status,0,inspect.stderr);
 const owner=owners[0], receipt=path.join(workspace,'.agent',`${owner.id}.jsonl.notification-${owner.deliveryId}.decision-receipt`);
 const pty=spawn('/usr/bin/expect',[path.join(root,'scripts/pty-cli.exp'),process.execPath,path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--interactive','--resume',owner.id],{cwd:root,env:{...env,HOME:temp},stdio:['pipe','pipe','pipe']});
 let frame='',errors=''; pty.stdout.on('data',b=>frame+=b);pty.stderr.on('data',b=>errors+=b);
 const exited=new Promise((resolve,reject)=>{pty.on('error',reject);pty.on('close',resolve)});
 const until=async (predicate,label)=>{const deadline=Date.now()+15000;while(!predicate()){if(pty.exitCode!==null||Date.now()>deadline)throw Error(`${label}: ${errors} ${frame}`);await new Promise(r=>setTimeout(r,25));}};
 try {
  await until(()=>frame.includes('ready'),'interactive prompt');
  pty.stdin.write(`/notification ${owner.id} ${owner.deliveryId} processed\r`);
  await until(()=>fs.existsSync(receipt),'decision receipt');
  pty.stdin.write('/exit\r');
  assert.equal(await Promise.race([exited,new Promise((_,reject)=>setTimeout(()=>reject(Error('PTY exit timeout')),15000))]),0,errors);
 } finally {if(pty.exitCode===null)pty.kill('SIGKILL');pty.stdin.destroy();}
 const cold=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});if(s.notificationCoordination.some(x=>x.deliveryId===process.argv[3]))throw Error('decision lost');if(s.messages.some(m=>JSON.stringify(m).includes('SECRET_NOTIFICATION_')))throw Error('exposed');s.close()`,workspace,owner.id,owner.deliveryId],{cwd:root,encoding:'utf8'});
 assert.equal(cold.status,0,cold.stderr);
 for(const [index,mode] of [[2,'dir'],[3,'kill']]) {
  const item=owners[index], file=path.join(workspace,'.agent',`${item.id}.jsonl.notification-${item.deliveryId}.decision-receipt`);
  const injection=path.join(temp,`decision-${mode}.mjs`);
  const marker=path.join(temp,`decision-${mode}.marker`);
  fs.writeFileSync(injection,`import fs from 'node:fs';const rename=fs.renameSync,sync=fs.fsyncSync;let published=false;fs.renameSync=(a,b)=>{const result=rename(a,b);if(String(b).endsWith('.decision-receipt')){published=true;if(process.env.DECISION_MODE==='kill'){fs.writeFileSync(process.env.DECISION_MARKER,'kill');process.kill(process.pid,'SIGKILL')}}return result};fs.fsyncSync=fd=>{if(published&&fs.fstatSync(fd).isDirectory()){fs.writeFileSync(process.env.DECISION_MARKER,'fault');throw Error('receipt directory sync fault')}return sync(fd)};`);
  const child=spawn('/usr/bin/expect',[path.join(root,'scripts/pty-cli.exp'),process.execPath,path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--interactive','--resume',item.id],{cwd:root,env:{...env,HOME:temp,NODE_OPTIONS:`--import=${injection}`,DECISION_MODE:mode,DECISION_MARKER:marker},stdio:['pipe','pipe','pipe']});
  let output='', errors='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>errors+=b);
  const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve)});
  const wait=async (predicate,label)=>{const deadline=Date.now()+15000;while(!predicate()){if(child.exitCode!==null||Date.now()>deadline)throw Error(`${label}: ${errors} ${output}`);await new Promise(r=>setTimeout(r,25));}};
  try {
   await wait(()=>output.includes('ready'),'fault PTY prompt');child.stdin.write(`/notification ${item.id} ${item.deliveryId} processed\r`);
   await wait(()=>fs.existsSync(file),'fault receipt rename');
   if(mode==='dir'){await wait(()=>fs.existsSync(marker),'directory fault');child.stdin.write('/exit\r');}
   await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(Error('fault PTY exit timeout')),15000))]);
   assert.equal(fs.readFileSync(marker,'utf8'),mode==='kill'?'kill':'fault');
   if(mode==='kill') assert.ok(fs.existsSync(path.join(workspace,'.agent',`${item.id}.jsonl.lock`)),'killed CLI lock missing');
  } finally {if(child.exitCode===null)child.kill('SIGKILL');child.stdin.destroy();}
  const read=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';const [root,id,delivery]=process.argv.slice(1);const s=Session.open(root,{id,recoverLock:true});if(s.notificationCoordination.some(x=>x.deliveryId===delivery))throw Error('decision remained pending');if(s.messages.some(m=>JSON.stringify(m).includes('SECRET_NOTIFICATION_')))throw Error('exposed');s.confirmNotification(id,delivery);s.confirmNotification(id,delivery);s.close()`,workspace,item.id,item.deliveryId],{cwd:root,encoding:'utf8'});
  assert.equal(read.status,0,read.stderr);
 }
 const retryOwner=owners[4], before=requests.length;
 const retryPty=spawn('/usr/bin/expect',[path.join(root,'scripts/pty-cli.exp'),process.execPath,path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--interactive','--resume',retryOwner.id],{cwd:root,env:{...env,HOME:temp},stdio:['pipe','pipe','pipe']});
 let retryFrame='',retryErrors='';retryPty.stdout.on('data',b=>retryFrame+=b);retryPty.stderr.on('data',b=>retryErrors+=b);
 const retryDone=new Promise((resolve,reject)=>{retryPty.on('error',reject);retryPty.on('close',resolve)});
 const retryWait=async(predicate,label)=>{const deadline=Date.now()+15000;while(!predicate()){if(retryPty.exitCode!==null||Date.now()>deadline)throw Error(`${label}: ${retryErrors} ${retryFrame}`);await new Promise(r=>setTimeout(r,25));}};
 try {
  await retryWait(()=>retryFrame.includes('ready'),'retry PTY prompt');
  retryPty.stdin.write(`/notification ${retryOwner.id} ${retryOwner.deliveryId} retry\r`);
  await retryWait(()=>requests.length===before+1,'retry model request');
  const messages=JSON.stringify(requests.at(-1).messages);assert.ok(messages.includes('Background task events'));assert.ok(!messages.includes('SECRET_NOTIFICATION_'));
  await retryWait(()=>fs.readFileSync(path.join(workspace,'.agent',`${retryOwner.id}.jsonl`),'utf8').includes('ACCEPTED'),'retry response journal');
  retryPty.stdin.write(`/notification ${retryOwner.id} ${retryOwner.deliveryId} retry\r`);
  retryPty.stdin.write('/exit\r');
  assert.equal(await Promise.race([retryDone,new Promise((_,reject)=>setTimeout(()=>reject(Error('retry PTY exit timeout')),15000))]),0,retryErrors);
  assert.equal(requests.length,before+1);
 } finally {if(retryPty.exitCode===null)retryPty.kill('SIGKILL');retryPty.stdin.destroy();}
 const retryCold=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';const [root,id,old]=process.argv.slice(1),s=Session.open(root,{id});const intents=s.events.filter(x=>x.kind==='notification_intent_v2');const rows=s.events.filter(x=>x.kind==='message'&&x.notificationDelivery);if(intents.length!==2||rows.filter(x=>x.notificationDelivery.deliveryId===intents[1].deliveryId).length!==1||s.retryNotification(id,old)!==undefined||s.messages.some(x=>JSON.stringify(x).includes('SECRET_NOTIFICATION_')))throw Error('retry cold evidence mismatch');s.close()`,workspace,retryOwner.id,retryOwner.deliveryId],{cwd:root,encoding:'utf8'});
 assert.equal(retryCold.status,0,retryCold.stderr);
 const killedOwner=owners[5], marker=path.join(temp,'retry-kill.marker'), injection=path.join(temp,'retry-kill.mjs'), requestCount=requests.length;
 fs.writeFileSync(injection,`import fs from 'node:fs';const rename=fs.renameSync;fs.renameSync=(a,b)=>{const result=rename(a,b);if(String(b).endsWith('.decision-receipt')){fs.writeFileSync(process.env.RETRY_MARKER,String(process.pid));process.kill(process.pid,'SIGSTOP')}return result}`);
 const crashPty=spawn('/usr/bin/expect',[path.join(root,'scripts/pty-cli.exp'),process.execPath,path.join(root,'bin/litcode.mjs'),'--workspace',workspace,'--interactive','--resume',killedOwner.id],{cwd:root,env:{...env,HOME:temp,NODE_OPTIONS:`--import=${injection}`,RETRY_MARKER:marker},stdio:['pipe','pipe','pipe']});
 let crashFrame='',crashErrors='';crashPty.stdout.on('data',b=>crashFrame+=b);crashPty.stderr.on('data',b=>crashErrors+=b);
 const crashDone=new Promise((resolve,reject)=>{crashPty.on('error',reject);crashPty.on('close',resolve)});
 const crashWait=async(predicate,label)=>{const deadline=Date.now()+15000;while(!predicate()){if(crashPty.exitCode!==null||Date.now()>deadline)throw Error(`${label}: ${crashErrors} ${crashFrame}`);await new Promise(r=>setTimeout(r,25));}};
 try {
  await crashWait(()=>crashFrame.includes('ready'),'retry crash prompt');crashPty.stdin.write(`/notification ${killedOwner.id} ${killedOwner.deliveryId} retry\r`);
  await crashWait(()=>fs.existsSync(marker),'retry decision barrier');
  process.kill(Number(fs.readFileSync(marker,'utf8')),'SIGKILL');
  await Promise.race([crashDone,new Promise((_,reject)=>setTimeout(()=>reject(Error('retry crash exit timeout')),15000))]);
  assert.equal(requests.length,requestCount);
 } finally {if(crashPty.exitCode===null)crashPty.kill('SIGKILL');crashPty.stdin.destroy();}
 for(let pass=0;pass<2;pass++){
  const read=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from './dist/session.js';const [root,id,old,pass]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:pass==='0'});if(s.events.filter(x=>x.kind==='notification_intent_v2').length!==1||s.notificationCoordination.length!==1||s.notificationCoordination[0].deliveryId===old||s.retryNotification(id,old)!==undefined||s.messages.some(x=>JSON.stringify(x).includes('SECRET_NOTIFICATION_')))throw Error('retry crash recovery mismatch');s.close()`,workspace,killedOwner.id,killedOwner.deliveryId,String(pass)],{cwd:root,encoding:'utf8'});
  assert.equal(read.status,0,read.stderr);
 }
 const identity=captureIdentity(root);console.log(JSON.stringify({result:'passed',realBackgroundRetry:true,requests:requests.length,temporary:temp,identity:identity.sha256,inputs:identity.inputs.sha256,validation:identity.validation.sha256,build:identity.build.sha256}));
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
