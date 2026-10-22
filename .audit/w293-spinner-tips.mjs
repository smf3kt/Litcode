import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { setTimeout as delay } from 'node:timers/promises';
import { TerminalScreen } from '../scripts/terminal-screen.mjs';
import { captureIdentity } from '../scripts/identity.mjs';

const root = path.resolve(import.meta.dirname,'..');
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'w293-cli-')));
const workspace = path.join(temporary,'workspace'), user = path.join(temporary,'user');
fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace,'.git'));
fs.mkdirSync(path.join(workspace,'.harness'));
const userFile = path.join(user,'settings.json'), localFile = path.join(workspace,'.harness/settings.local.json');
const tipsFile = path.join(temporary,'tips.json'), historyFile = path.join(user,'spinner-tips.json');
fs.writeFileSync(tipsFile,JSON.stringify([{id:'file',text:'File tip persists through reload.',priority:10}]));
fs.writeFileSync(userFile,JSON.stringify({model:'fixture',prefersReducedMotion:true,keep:'preserved',
  spinnerTipsOverride:{label:'Local',tipsFile,excludeDefault:true,tips:[]}}));
fs.writeFileSync(localFile,JSON.stringify({keepLocal:'preserved'}));
const requests = [], held = [], checks = [];
function finish(response,id) {
  if (response.destroyed || response.writableEnded) return;
  const events = [
    ['message_start',{type:'message_start',message:{id:`msg_${id}`,type:'message',role:'assistant',model:'fixture',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:10,output_tokens:0}}}],
    ['content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}}],
    ['content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text:`response ${id}`}}],
    ['content_block_stop',{type:'content_block_stop',index:0}],
    ['message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:2}}],
    ['message_stop',{type:'message_stop'}],
  ];
  if (!response.headersSent) response.writeHead(200,{'content-type':'text/event-stream'});
  for (const [event,data] of events) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  response.end();
}
const server = http.createServer((request,response)=>{
  const chunks = [];
  request.on('data',chunk=>chunks.push(chunk));
  request.on('end',()=>{
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const entry = {body,response,id:requests.length+1,closed:false}; requests.push(entry);
    response.on('close',()=>{entry.closed=true;});
    const last = body.messages?.at(-1)?.content;
    if (JSON.stringify(last).includes('HOLD')) {
      response.writeHead(200,{'content-type':'text/event-stream'}); response.flushHeaders(); held.push(entry);
    } else finish(response,entry.id);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const env = {...process.env,TERM:'xterm-256color',LC_ALL:'en_US.UTF-8',FORCE_COLOR:'3',
  LLM_API_KEY:'fixture',LLM_BASE_URL:`http://127.0.0.1:${server.address().port}`,LLM_AUTH:'bearer',LLM_TOKEN_COUNTING:'estimate'};
for (const key of Object.keys(env)) if (/^ANTHROPIC_/.test(key)
  || ['LLM_MODEL','LLM_EFFORT','LLM_THINKING','TMUX','STY','TERM_PROGRAM','NO_COLOR','CLAUDE_CODE_KB_COHESION_FIXES'].includes(key)) delete env[key];
let active;
const text = ()=>active.screen.lines().map(row=>row.trimEnd()).join('\n');
const ready = ()=>text().includes('· ready')&&!/^Config$/m.test(text());
const send = value=>active.child.stdin.write(value);
const sessions = ()=>fs.readdirSync(path.join(workspace,'.agent')).filter(name=>name.endsWith('.jsonl'));
const history = ()=>JSON.parse(fs.readFileSync(historyFile,'utf8'));
async function until(predicate,label,timeout=20000) {
  const end=Date.now()+timeout;
  while(Date.now()<end) {
    if (predicate()) return;
    if (active?.child.exitCode!==null && active?.child.exitCode!==undefined) break;
    await delay(30);
  }
  throw new Error(`${label}\n${text()}`);
}
function pass(label,condition=true) { assert.ok(condition,`${label}\n${text()}`); checks.push(label); console.log(`PASS ${label}`); }
async function launch(extra=[]) {
  const child=spawn('/usr/bin/expect',[path.join(root,'.audit/w293-spinner-tips.exp'),process.execPath,
    path.join(root,'bin/personal-harness.mjs'),'--workspace',workspace,'--interactive','--user-dir',user,'--no-inherit-gateway','--permission-mode','bypass',...extra],
    {cwd:root,env,stdio:['pipe','pipe','pipe']});
  const screen=new TerminalScreen(100,30),decoder=new StringDecoder('utf8');
  active={child,screen,pid:child.pid,closed:new Promise(resolve=>child.once('close',resolve))};
  child.stdout.on('data',chunk=>screen.write(decoder.write(chunk)));
  child.stderr.on('data',chunk=>screen.write(decoder.write(chunk)));
  await until(ready,'startup ready',30000);
}
async function hold(label) {
  const count=held.length; send(label+' HOLD\r');
  await until(()=>held.length>count,'held request'); await delay(100);
  return held.at(-1);
}
async function release(entry) { finish(entry.response,entry.id); await until(()=>ready()&&text().includes(`response ${entry.id}`),'released turn'); }
async function toggle(enabled) {
  send('/config\r'); await until(()=>/^Config$/m.test(text()),'Config opens'); send('tips');
  await until(()=>text().includes('⌕ tips'),'Tips filter'); send('\r'); await delay(50); send(' ');
  await until(()=>JSON.parse(fs.readFileSync(localFile,'utf8')).spinnerTipsEnabled===enabled
    && !text().includes('Saving settings'),'Tips toggle');
  pass(`Show tips ${enabled} persists to the local layer`);
  send('\x1b'); await until(ready,'Config closes');
}
async function exit() {
  send('\x15/exit\r');
  const code=await Promise.race([active.closed,delay(6000).then(()=> 'timeout')]);
  pass('compiled CLI exits zero',code===0); active.screen.close();
}
try {
  await launch();
  pass('one CLI startup records one launch',history().numStartups===1);
  pass('the first frame contains no invented Tip',!text().includes('Local:'));
  send('prime\r'); await until(()=>ready()&&text().includes('response 1'),'first turn');
  await until(()=>history().tipsHistory['org-tip:file']===1,'selected Tip history');
  const sessionCount=sessions().length;
  const pending=await hold('next');
  await until(()=>text().includes('Local: File tip persists through reload.'),'Tip on next spinner');
  pass('the next held turn paints the file Tip with its trusted label');
  const rows=active.screen.lines(),row=rows.findIndex(value=>value.includes('Local: File tip'));
  const column=rows[row].indexOf('Local:');
  pass('the Tip text uses the inactive theme color',active.screen.cell(column,row).getFgColor()===0x999999);
  send('kept draft'); await delay(60); send('\x03');
  await until(()=>pending.closed&&ready(),'interrupt held request');
  pass('cancellation preserves the composer draft',text().includes('kept draft'));
  send('\x15'); await toggle(false);
  pass('local write preserves unrelated user and local keys',JSON.parse(fs.readFileSync(userFile,'utf8')).keep==='preserved'
    &&JSON.parse(fs.readFileSync(localFile,'utf8')).keepLocal==='preserved');
  send('disabled pick\r'); await until(()=>ready()&&text().includes('response 3'),'disabled pick clears');
  const disabled=await hold('disabled');
  pass('a disabled selection leaves the next spinner without a Tip',!text().includes('Local:')); await release(disabled);
  await toggle(true);
  send('enabled pick\r'); await until(()=>ready()&&text().includes('response 5'),'enabled selection');
  fs.writeFileSync(tipsFile,JSON.stringify([{id:'file',text:'Changed on disk.',priority:10}]));
  pass('live toggles keep the original session',sessions().length===sessionCount);
  send('/reload\r'); await until(()=>ready()&&sessions().length===sessionCount+1,'config reload');
  send('reload prime\r'); await until(()=>ready()&&text().includes('response 6'),'reload prime');
  const cached=await hold('cached');
  pass('reload retains the source file cache',text().includes('File tip persists through reload.')&&!text().includes('Changed on disk.'));
  await release(cached);
  pass('live toggles retain the original runtime session until explicit reload',sessions().length===sessionCount+1);
  pass('same-startup Tip history increments lifetime once',history().tipLifetimeShownCounts['org-tip:file']===1);
  await exit();
  pass('all session and Tip locks release',fs.readdirSync(path.join(workspace,'.agent')).every(name=>!name.endsWith('.lock'))
    &&!fs.existsSync(historyFile+'.lock'));
  await launch(); pass('a new CLI advances the startup counter',history().numStartups===2);
  send('restart prime\r'); await until(()=>ready()&&text().includes('response 8'),'restart prime');
  await until(()=>history().tipsHistory['org-tip:file']===2,'restart Tip history');
  const restarted=await hold('restart');
  pass('a new process reads the changed Tips file',text().includes('Local: Changed on disk.'));
  await release(restarted); await exit();
  pass('history contains only counters and ids',!fs.readFileSync(historyFile,'utf8').includes('Changed on disk.')
    &&history().tipLifetimeShownCounts['org-tip:file']===2);
  const managedFile=path.join(temporary,'managed.json');
  fs.writeFileSync(managedFile,JSON.stringify({spinnerTipsEnabled:false}));
  await launch(['--managed-settings',managedFile]);
  await toggle(true);
  send('policy prime\r'); await until(()=>ready()&&text().includes('response 10'),'policy prime');
  const policyHeld=await hold('policy');
  pass('the local toggle retains the higher managed false gate',!text().includes('Local:'));
  await release(policyHeld); await exit();
  pass('all compiled requests stayed on the owned fixture',requests.every(entry=>entry.body.model==='fixture'));
  const identity=captureIdentity(root);
  const result={checks,requests:requests.length,paidUpstreamCalls:0,identity};
  if(process.env.W293_RESULT)fs.writeFileSync(process.env.W293_RESULT,JSON.stringify(result,null,2));
  console.log(`IDENTITY ${identity.sha256}`); console.log(`PASS ${checks.length}/${checks.length}`);
} finally {
  if(active?.child.exitCode===null) {active.child.kill('SIGTERM');await Promise.race([active.closed,delay(1500)]);if(active.child.exitCode===null)active.child.kill('SIGKILL');}
  active?.screen.close();
  for(const entry of held)entry.response.destroy();
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(temporary,{recursive:true,force:true});
}
