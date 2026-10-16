import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { InputHistory } from '../src/tui-input-history.js';
import { createTerminalInput } from '../src/terminal.js';
import { TuiTerminal } from '../src/tui.js';

const scratch=()=>fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR?path.join(process.env.CLAUDE_JOB_DIR,'tmp'):os.tmpdir(),'input-history-')));
function fixture(mode:'line'|'tui'){
  const input=new PassThrough() as PassThrough&{isTTY:boolean;isRaw:boolean;setRawMode:(value:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};
  const output=new Writable({write(_chunk,_encoding,done){done();}});Object.assign(output,{isTTY:true,columns:40,rows:10});
  const submitted:string[]=[];const options={input,output,sourceInputGestures:true,onSubmit:(text:string)=>submitted.push(text)};
  const terminal=(mode==='line'?createTerminalInput(options):new TuiTerminal(options)).start();
  const key=async(value:string)=>{input.emit('data',value);if(value==='\x1b')await delay(70);};
  const close=async()=>{terminal.close();await terminal.flushInputHistory();assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);};
  return{terminal,input,key,submitted,close};
}
const config=(root:string,user:string)=>({...defaultConfig(root,[]),model:'fixture/history',configSources:{userDir:user}});

test('copied history store persists hashes, deduplicates and reads current project/session before other sessions',async()=>{
  const root=scratch(),user=path.join(root,'user'),other=path.join(root,'other');fs.mkdirSync(user);fs.mkdirSync(other);
  const first=Session.open(root,{config:config(root,user)}),second=Session.open(root,{config:config(root,user)}),foreign=Session.open(other,{config:config(other,user)});
  const errors:unknown[]=[],owners:InputHistory[]=[];const make=()=>{const value=new InputHistory(error=>errors.push(error));owners.push(value);return value;};
  try{
    const raw='é👩‍💻\n'.repeat(240),display='[Pasted text #1 +239 lines]',entry={display,pastedContents:{1:{id:1,type:'text' as const,content:raw}}};
    let owner=make();await owner.bind(first);owner.add(entry);owner.add({display:'ordinary',pastedContents:{}});owner.add({display:'ordinary',pastedContents:{}});await owner.finish();
    let records=fs.readFileSync(path.join(user,'history.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.equal(records.length,2);
    const hash=createHash('sha256').update(raw).digest('hex').slice(0,16);assert.equal(records[0].pastedContents[1].contentHash,hash);assert.equal(records[0].pastedContents[1].content,undefined);
    assert.equal(fs.readFileSync(path.join(user,'paste-cache',hash+'.txt'),'utf8'),raw);assert.equal(fs.statSync(path.join(user,'history.jsonl')).mode&511,384);
    assert.equal(fs.statSync(path.join(user,'paste-cache',hash+'.txt')).mode&511,384);assert.ok(records[1].timestamp>records[0].timestamp);
    owner=make();await owner.bind(second);owner.add({display:'second-session',pastedContents:{}});await owner.finish();
    owner=make();await owner.bind(foreign);owner.add({display:'foreign-project',pastedContents:{}});await owner.finish();
    owner=make();const recalled=await owner.bind(first);assert.deepEqual(recalled.map(row=>row.display),['second-session',display,'ordinary']);assert.equal(recalled[1]!.pastedContents[1]!.content,raw);
    await owner.finish();
    fs.appendFileSync(path.join(user,'history.jsonl'),'broken-json\n'+JSON.stringify({display:'bad-paste',pastedContents:{1:{type:'wrong'}},timestamp:1,project:root})+'\n');
    owner=make();const valid=await owner.bind(second);assert.ok(valid.some(row=>row.display==='ordinary'));assert.deepEqual(valid.find(row=>row.display==='bad-paste')!.pastedContents,{});await owner.finish();
    const before=fs.statSync(path.join(user,'history.jsonl')).size;const previous=process.env.LITCODE_SKIP_PROMPT_HISTORY;
    try{process.env.LITCODE_SKIP_PROMPT_HISTORY='true';owner=make();await owner.bind(first);owner.add({display:'skipped',pastedContents:{}});await owner.finish();}
    finally{if(previous===undefined)delete process.env.LITCODE_SKIP_PROMPT_HISTORY;else process.env.LITCODE_SKIP_PROMPT_HISTORY=previous;}
    assert.equal(fs.statSync(path.join(user,'history.jsonl')).size,before);
    assert.equal(fs.existsSync(path.join(user,'history.jsonl.lock')),false);
  }finally{for(const owner of owners)await owner.finish();first.close();second.close();foreign.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('both terminal owners restore folded raw history across restart, search and double-Escape clear',async()=>{
  for(const mode of ['line','tui'] as const){const root=scratch(),user=path.join(root,'user');fs.mkdirSync(user);const session=Session.open(root,{config:config(root,user)});let f=fixture(mode);
    try{
      await f.terminal.bindInputHistory(session);const raw='restart é👩‍💻\n'.repeat(100).trimEnd();
      await f.key('\x1b[200~'+raw+'\x1b[201~');const display=f.terminal.state.text;assert.match(display,/^\[Pasted text/);await f.key('\r');assert.deepEqual(f.submitted,[raw]);
      await f.key('cleared draft');await f.key('\x1b');await f.key('\x1b');assert.equal(f.terminal.state.text,'');await f.close();
      f=fixture(mode);await f.terminal.bindInputHistory(session);assert.deepEqual(f.terminal.state.history,[display,'cleared draft']);
      await f.key('\x1b[A');assert.equal(f.terminal.state.text,'cleared draft');await f.key('\x1b[A');assert.equal(f.terminal.state.text,display);assert.equal(Object.values(f.terminal.state.pastedContents)[0]!.content,raw);
      await f.key('\r');assert.deepEqual(f.submitted,[raw]);
      // The scoped picker owns ctrl+r while the history is bound. The source filters on the folded
      // display text, so this route reaches the pasted row by walking the list and accepting it.
      await f.key('\u0012');
      const picker=((mode==='line'
        ? (f.terminal as unknown as {linePicker?:unknown}).linePicker
        : (f.terminal as unknown as {sourcePicker?:unknown}).sourcePicker) as {visible:readonly {display:string}[]}|undefined);
      for(let attempts=0;attempts<400&&!(picker?.visible.some(row=>row.display===display));attempts++)await delay(5);
      assert.ok(picker?.visible.some(row=>row.display===display),`the picker lists the folded paste (${mode}) got=${JSON.stringify(picker?.visible.map(row=>row.display))}`);
      if(!picker)throw new Error('picker did not open');
      while(picker.visible.findIndex(row=>row.display===display)>0)await f.key('\x1b[A');
      await f.key('\r');
      for(let attempts=0;attempts<100&&f.terminal.state.text!==display;attempts++)await delay(5);
      assert.equal(f.terminal.state.text,display);await f.key('\r');
      assert.equal(f.submitted.at(-1),raw);assert.equal(f.submitted.length,2);
      if(mode==='tui'){const answer=(f.terminal as TuiTerminal).prompt({message:'Isolated',allowText:true},new AbortController().signal);await f.key('modal-only\r');await answer;}
      await f.close();const lines=fs.readFileSync(path.join(user,'history.jsonl'),'utf8');assert.equal(lines.includes('modal-only'),false);assert.equal(fs.existsSync(path.join(user,'history.jsonl.lock')),false);
    }finally{await f.close();session.close();fs.rmSync(root,{recursive:true,force:true});}
  }
});

test('history append writers serialize, reject symlink targets and filter source sensitive command or paste records',async()=>{
  const root=scratch(),user=path.join(root,'user');fs.mkdirSync(user);const a=Session.open(root,{config:config(root,user)}),b=Session.open(root,{config:config(root,user)});
  const owners=[new InputHistory(),new InputHistory()];
  try{
    await Promise.all([owners[0]!.bind(a),owners[1]!.bind(b)]);for(let i=0;i<20;i++)owners[i%2]!.add({display:'writer-'+i,pastedContents:{}});
    await Promise.all(owners.map(owner=>owner.finish()));const rows=fs.readFileSync(path.join(user,'history.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
    assert.equal(rows.length,20);assert.equal(new Set(rows.map(row=>row.display)).size,20);assert.equal(fs.existsSync(path.join(user,'history.jsonl.lock')),false);
    const owner=new InputHistory();owners.push(owner);await owner.bind(a);const token='sk-ant-TEST0123456789abcdefghijklmnop';
    owner.add({display:'/config key='+token,pastedContents:{}});owner.add({display:'[Pasted text #1]',pastedContents:{1:{id:1,type:'text',content:token}}});await owner.finish();
    assert.equal(fs.readFileSync(path.join(user,'history.jsonl'),'utf8').includes(token),false);
    const alternate=path.join(root,'alternate');fs.mkdirSync(alternate);const original=path.join(user,'history.jsonl'),target=path.join(alternate,'target');fs.writeFileSync(target,'untouched');fs.unlinkSync(original);fs.symlinkSync(target,original);
    const errors:unknown[]=[];const blocked=new InputHistory(error=>errors.push(error));owners.push(blocked);await blocked.bind(b);blocked.add({display:'must remain local',pastedContents:{}});await blocked.finish();
    assert.equal(fs.readFileSync(target,'utf8'),'untouched');assert.ok(errors.length>0);assert.equal(fs.existsSync(original+'.lock'),false);

    const userB=path.join(root,'user-b');fs.mkdirSync(userB);const c=Session.open(root,{config:config(root,userB)});
    let failed!:()=>void;const failure=new Promise<void>(resolve=>{failed=resolve;});const recovery=new InputHistory(()=>failed());owners.push(recovery);
    try{
      fs.unlinkSync(original);await recovery.bind(a);fs.mkdirSync(original);
      const raw='retained é👩‍💻\n'.repeat(120);
      recovery.add({display:'[Pasted text #1 +119 lines]',pastedContents:{1:{id:1,type:'text',content:raw}}});await failure;
      await recovery.bind(c);recovery.add({display:'new-directory',pastedContents:{}});await recovery.flush();
      assert.equal(fs.readFileSync(path.join(userB,'history.jsonl'),'utf8').includes('new-directory'),true);
      fs.rmdirSync(original);await recovery.flush();
      const saved=JSON.parse(fs.readFileSync(original,'utf8').trim());assert.equal(saved.sessionId,a.id);assert.equal(saved.project,root);
      assert.equal(fs.readFileSync(path.join(user,'paste-cache',saved.pastedContents[1].contentHash+'.txt'),'utf8'),raw);
      assert.equal(fs.readFileSync(path.join(userB,'history.jsonl'),'utf8').includes('Pasted text'),false);
      recovery.add({display:'continues-after-repair',pastedContents:{}});await recovery.flush();
      assert.equal(fs.readFileSync(path.join(userB,'history.jsonl'),'utf8').includes('continues-after-repair'),true);
    }finally{await recovery.finish();c.close();}

    const live=JSON.stringify({pid:process.pid,token:'live-owner'});fs.writeFileSync(original+'.lock',live);fs.utimesSync(original+'.lock',new Date(0),new Date(0));
    const lockOwner=new InputHistory();owners.push(lockOwner);
    await assert.rejects((lockOwner as unknown as {lock:(file:string)=>Promise<()=>Promise<void>>}).lock(original),{code:'EEXIST'});
    assert.equal(fs.readFileSync(original+'.lock','utf8'),live);fs.unlinkSync(original+'.lock');
    const exited=spawnSync(process.execPath,['-e','process.stdout.write(String(process.pid))'],{encoding:'utf8'});assert.equal(exited.status,0);
    const deadPid=Number(exited.stdout);assert.throws(()=>process.kill(deadPid,0),{code:'ESRCH'});
    fs.writeFileSync(original+'.lock',JSON.stringify({pid:deadPid,token:'exited-owner'}));
    await lockOwner.bind(a);lockOwner.add({display:'after-crash',pastedContents:{}});await lockOwner.finish();
    assert.equal(fs.existsSync(original+'.lock'),false);assert.equal(fs.readFileSync(original,'utf8').includes('after-crash'),true);
  }finally{await Promise.all(owners.map(owner=>owner.finish()));a.close();b.close();fs.rmSync(root,{recursive:true,force:true});}
});
