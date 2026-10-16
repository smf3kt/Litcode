import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { parseSettings } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { initializeStatusLineSource } from '../src/tui-statusline-source.js';
import { StatusLine, statusLineSchema } from '../src/tui-statusline.js';
import { TuiTerminal } from '../src/tui.js';
import { ge } from '../src/tui-color.js';

const {Terminal}=createRequire(import.meta.url)('@xterm/headless');
const scratch=()=>fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'statusline-test-')));
async function until(predicate:()=>boolean) {
  const deadline=Date.now()+5000;
  while(!predicate()){if(Date.now()>deadline)throw new Error('Status line fixture timed out');await delay(10);}
}
const commandBody=String.raw`
const fs=require('node:fs');let text='';
process.stdin.on('data',chunk=>text+=chunk);process.stdin.on('end',()=>{
  const payload=JSON.parse(text),mode=process.argv[2]??'ok';
  fs.appendFileSync('calls.jsonl',JSON.stringify({pid:process.pid,mode,payload})+'\n');
  if(mode==='slow'){setTimeout(()=>process.stdout.write('STALE\n'),4000);return;}
  if(mode==='fail'){process.stderr.write('owned failure');process.exitCode=1;return;}
  const usage=payload.context_window.current_usage;
  process.stdout.write('\x1b[31mFIRST '+payload.model.id+' '+(payload.vim?.mode??'plain')+'\nSECOND '+(usage?.input_tokens??0)+'\x1b[0m\n');
});`;
function fixture(root:string,command:string,refreshInterval?:number) {
  fs.writeFileSync(path.join(root,'status.cjs'),commandBody);
  const config={...defaultConfig(root,[]),model:'fixture/status',editorMode:'vim' as const,
    statusLine:{type:'command' as const,command,padding:2,refreshInterval,hideVimModeIndicator:true}};
  const session=Session.open(root,{config});
  const calls=()=>fs.existsSync(path.join(root,'calls.jsonl'))?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
  return {session,config,calls};
}

test('source status-line owner coalesces updates, aborts stale results and releases refresh and expiry timers',async()=>{
  let now=0,next=0;const timers=new Map<number,{due:number;callback:()=>void}>(),requests:{signal:AbortSignal;resolve:(text:string)=>void}[]=[];
  const source=initializeStatusLineSource({Oe:()=>{const listeners=new Set<()=>void>();return{subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f);},emit:()=>{for(const f of listeners)f();}};},
    ri:(value:unknown)=>value,gsr:()=>null,uhe:()=>false,QPo:()=>({}),So:()=>({cwd:'fixture'}),t:()=>{},c:()=>{},ae:(text:string)=>text.length,c1:()=>{}});
  const base={statusLine:{type:'command',command:'fixture',refreshInterval:1},settings:{},tokenUsage:null,permissionMode:'default',vimMode:'INSERT',mainLoopModel:'fixture',fastMode:false,effortValue:undefined,thinkingEnabled:false,prStatus:undefined,additionalWorkingDirectories:new Map()};
  const owner=new source.Owner({session:{},memory:{},getMessages:()=>[],getWorkspaceGit:async()=>({}),isVimModeEnabled:()=>true,isTrustAccepted:()=>true,onTrustBlocked:()=>{},logEvent:()=>{},
    setTimeout:(callback:()=>void,ms:number)=>{const id=++next;timers.set(id,{due:now+ms,callback});return()=>timers.delete(id);},
    execute:(_payload:unknown,signal:AbortSignal)=>new Promise<string>(resolve=>requests.push({signal,resolve}))},base);
  const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
  const advance=async(ms:number)=>{const end=now+ms;for(;;){const due=[...timers].filter(([,row])=>row.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!due)break;now=due[1].due;timers.delete(due[0]);due[1].callback();await settle();}now=end;};
  const unsubscribe=owner.subscribe(()=>{});await settle();assert.equal(requests.length,1);
  owner.setInputs({...base,vimMode:'NORMAL'});await advance(299);assert.equal(requests.length,1);
  await advance(1);assert.equal(requests.length,2);assert.equal(requests[0]!.signal.aborted,true);
  requests[0]!.resolve('stale');requests[1]!.resolve('current');await settle();assert.equal(owner.getSnapshot().text,'current');
  await advance(700);assert.equal(requests.length,2);await advance(300);assert.equal(requests.length,3);
  unsubscribe();assert.equal(requests[2]!.signal.aborted,true);assert.equal(timers.size,0);
  requests[2]!.resolve('late');await settle();await advance(5000);assert.equal(owner.getSnapshot().text,'current');assert.equal(requests.length,3);
});

test('status-line schema, journal usage, reload removal and command cancellation retain pinned session contracts',async()=>{
  const root=scratch(),user=path.join(root,'user');fs.mkdirSync(user);
  const command=`${process.execPath} status.cjs`,f=fixture(root,command),owner=new StatusLine(),values:(string|undefined)[]=[];
  try{
    assert.equal(statusLineSchema.parse({type:'command',command,refreshInterval:0})?.refreshInterval,undefined);
    assert.deepEqual(parseSettings({statusLine:{type:'command',command,padding:1,refreshInterval:2}}).statusLine,{type:'command',command,padding:1,refreshInterval:2});
    assert.throws(()=>parseSettings({statusLine:{type:'wrong',command}}));
    f.session.config.configSources={userDir:user};fs.writeFileSync(path.join(user,'settings.json'),JSON.stringify({statusLine:{type:'command',command:command+' fail'}}));
    const reloaded=reloadConfig(f.session.config);assert.equal(reloaded.statusLine?.command,command+' fail');assert.equal(f.session.config.statusLine?.command,command);
    fs.writeFileSync(path.join(user,'settings.json'),'{}');assert.equal(reloadConfig(reloaded).statusLine,undefined);
    const usage={input_tokens:20,output_tokens:7,cache_creation_input_tokens:10,cache_read_input_tokens:30};
    const response={id:'fixture-message',type:'message',role:'assistant',model:'fixture/status',content:[{type:'text',text:'owned'}],stop_reason:'end_turn',stop_sequence:null,usage} as Anthropic.Message;
    f.session.append({kind:'message',message:{role:'assistant',content:response.content},response});
    owner.bind(f.session,value=>values.push(value));owner.setActive(true);await until(()=>values.some(value=>value?.includes('SECOND 20')));
    const payload=f.calls()[0].payload;assert.equal(payload.session_id,f.session.id);assert.equal(payload.context_window.total_input_tokens,60);assert.equal(payload.context_window.total_output_tokens,7);
    assert.equal(payload.context_window.used_percentage,0);assert.equal(payload.context_window.context_window_size,1000000);
    assert.equal(payload.cwd,root);assert.equal(JSON.stringify(payload).includes('credentials'),false);
    owner.close();await owner.flush();f.session.close();const resumed=Session.open(root,{id:f.session.id});
    assert.equal(resumed.config.statusLine?.command,command);resumed.close();
    const slowSession=Session.open(root,{config:{...f.config,statusLine:{type:'command',command:command+' slow'}}}),slow=new StatusLine();
    try{slow.bind(slowSession,()=>{});slow.setActive(true);await until(()=>f.calls().some(row=>row.mode==='slow'));const pid=f.calls().find(row=>row.mode==='slow').pid;
      slow.close();await slow.flush();assert.throws(()=>process.kill(pid,0));
    }finally{slow.close();await slow.flush();slowSession.close();}
  }finally{owner.close();await owner.flush();f.session.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('source multiline ANSI status footer keeps raw draft and cursor through narrow layout, modal and editor handoff',async()=>{
  const previousColor=Reflect.get(ge,'level');Reflect.set(ge,'level',3);
  const root=scratch(),f=fixture(root,`${process.execPath} status.cjs`,1);
  const input=new PassThrough() as PassThrough&{isTTY:boolean;isRaw:boolean;setRawMode:(value:boolean)=>void};input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};
  const screen=new Terminal({cols:40,rows:10,allowProposedApi:true,logLevel:'off'});let bytes='';
  const output=new Writable({write(chunk,_enc,done){bytes+=String(chunk);screen._core.writeSync(String(chunk));done();}});Object.assign(output,{isTTY:true,columns:40,rows:10});
  const tui=new TuiTerminal({input,output,editorMode:'vim'}).start();
  const lines=()=>{const buffer=screen.buffer.active;return Array.from({length:10},(_,row)=>buffer.getLine(buffer.viewportY+row)?.translateToString(true)??'');};
  try{tui.bindStatusLine(f.session);input.emit('data','é👩‍💻 draft');await until(()=>lines().some(row=>row.includes('FIRST fixture/status INSERT')));
    assert.equal(tui.state.text,'é👩‍💻 draft');assert.equal(screen.buffer.active.cursorY,5);assert.equal(lines().some(row=>row.includes('-- INSERT --')),false);
    tui.bindStatusLine(f.session);assert.equal(lines().some(row=>row.includes('FIRST fixture/status INSERT')),true);
    const saved=f.session.config.statusLine;delete f.session.config.statusLine;tui.bindStatusLine(f.session);
    assert.equal(lines().some(row=>row.includes('FIRST')),false);f.session.config.statusLine=saved;tui.bindStatusLine(f.session);
    await until(()=>lines().some(row=>row.includes('FIRST fixture/status INSERT')));
    const first=lines().findIndex(row=>row.includes('FIRST')),second=lines().findIndex(row=>row.includes('SECOND'));
    assert.equal(screen.buffer.active.getLine(first)!.getCell(2)!.getFgColor(),1);assert.equal(screen.buffer.active.getLine(second)!.getCell(2)!.getFgColor(),1);
    input.emit('data','\x1b');await delay(80);await until(()=>lines().some(row=>row.includes('NORMAL')));
    screen.resize(20,10);Object.assign(output,{columns:20});output.emit('resize');assert.equal(lines().filter(row=>row.includes('FIRST')).length,1);
    assert.equal(tui.state.text,'é👩‍💻 draft');assert.equal(screen.buffer.active.cursorY,5);
    const answer=tui.prompt({message:'Modal',allowText:true},new AbortController().signal);const count=f.calls().length;
    await delay(1400);assert.equal(f.calls().length,count);input.emit('data','answer\r');assert.deepEqual(await answer,{selected:[],text:'answer'});
    await until(()=>f.calls().length>count);assert.equal(tui.state.text,'é👩‍💻 draft');
    const previous={VISUAL:process.env.VISUAL,EDITOR:process.env.EDITOR};try{process.env.VISUAL='/usr/bin/true';process.env.EDITOR='unused';await tui.editDraft(new AbortController().signal);}
    finally{for(const[name,value]of Object.entries(previous))if(value===undefined)delete process.env[name];else process.env[name]=value;}
    assert.equal(tui.state.text,'é👩‍💻 draft');tui.close();await tui.flushStatusLine();const end=bytes,last=f.calls().length;await delay(1400);
    assert.equal(bytes,end);assert.equal(f.calls().length,last);assert.equal(input.isRaw,false);
  }finally{tui.close();await tui.flushStatusLine();screen.dispose();f.session.close();fs.rmSync(root,{recursive:true,force:true});Reflect.set(ge,'level',previousColor);}
});
