import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {ScopePicker,type PickerScope,type ScopePickerSnapshot} from '../src/tui-scope-picker.js';
import {HistorySearch} from '../src/tui-history-search.js';
import {InputHistory,type InputHistoryEntry} from '../src/tui-input-history.js';
import {expandPastedText} from '../src/tui-input-paste.js';
import {Mct} from '../src/tui-input-paste-source.js';
import {defaultConfig} from '../src/agent.js';
import {Session} from '../src/session.js';

const scratch=()=>fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR?path.join(process.env.CLAUDE_JOB_DIR,'tmp'):os.tmpdir(),'scope-picker-')));
const config=(root:string,user:string)=>({...defaultConfig(root,[]),model:'fixture/picker',configSources:{userDir:user}});
const entry=(display:string):InputHistoryEntry=>({display,pastedContents:{}});
async function until(check:()=>boolean):Promise<void>{const end=Date.now()+3000;while(!check()){assert.ok(Date.now()<end,'scope picker fixture timed out');await delay(5);}}

test('source picker scans scopes lazily, cycles everywhere/session/project, caps by counted units and ranks exact before fuzzy',async()=>{
  const root=scratch(),user=path.join(root,'user');fs.mkdirSync(user);
  // A second, older session of this project: same project scope, different session scope.
  const session=Session.open(root,{config:config(root,user)}),foreign=Session.open(root,{config:config(root,user)});
  // A separate project root: source `readTimestamped` filters only on project/session, so these rows
  // are visible under `everywhere` and must stay out of the project and session scopes.
  const other=path.join(root,'other');fs.mkdirSync(other);
  const outsider=Session.open(other,{config:config(other,user)});
  // finish() closes an InputHistory owner, so each scope writes through its own instance.
  const writer=new InputHistory(),raw='picker raw é👩‍💻\n'.repeat(600);
  const localWriter=new InputHistory(),outsideWriter=new InputHistory();
  try{
    // Source order puts the newest rows first, so the foreign project is written before this session's rows.
    await writer.bind(foreign);writer.add({display:'[Pasted text #1 +599 lines]',pastedContents:{1:{id:1,type:'text',content:raw}}});
    for(let index=0;index<120;index++)writer.add({display:`foreign row ${index} needle`,pastedContents:{}});
    await writer.finish();
    await outsideWriter.bind(outsider);outsideWriter.add({display:'outside alpha needle',pastedContents:{}});outsideWriter.add({display:'outside beta',pastedContents:{}});
    await outsideWriter.finish();
    await localWriter.bind(session);localWriter.add({display:'local alpha','pastedContents':{}});localWriter.add({display:'local needle tail',pastedContents:{}});localWriter.add({display:'n e e d l e fuzzy',pastedContents:{}});await localWriter.flush();await localWriter.finish();
    const store=new InputHistory(),allocator=new Mct();let current:ScopePickerSnapshot|undefined;const snapshot=()=>current!;
    await store.bind(session);
    const reads:PickerScope[]=[];
    const picker=new ScopePicker({read:(scope:PickerScope)=>{reads.push(scope);return store.readTimestamped(scope);},
      changed:value=>current=value,report:error=>{throw error;},allocator,
      resolve:(row)=>row.resolve()});
    try{
      const drive=async()=>{for(let i=0;i<200;i++){picker.pick(80,12);const state=snapshot();if(state?.status==='complete'||state?.status==='truncated')return;await delay(5);}};
      picker.begin();await drive();
      assert.equal(snapshot().scope,'everywhere');assert.equal(reads[0],'everywhere');
      // Source `readTimestamped` leaves `everywhere` unfiltered, so every project's rows arrive here.
      assert.equal(snapshot().items.length,126,'everywhere lists this session, the project, and the other project');
      assert.ok(snapshot().items.some(row=>row.display==='outside alpha needle'),'everywhere keeps another project\'s rows');
      assert.equal(snapshot().items.length<=100,false,'the scan cap is a progressive reveal, not a 100-row limit');
      assert.equal(snapshot().status,'complete');
      const frames=picker.frame(40,10);
      assert.match(frames[0]!,/Search prompts · everywhere/);
      assert.match(frames.join('\n'),/Ctrl\+S scope/,'the frame keeps the source hint row');
      assert.match(frames.join('\n'),/Enter select/);
      assert.ok(picker.cycleScope());await drive();await until(()=>snapshot().scope==='session'&&reads.at(-1)==='session');
      await until(()=>snapshot().status==='complete');
      assert.equal(snapshot().items.length,3,'session scope keeps only this session\'s rows');
      assert.equal(snapshot().items.some(row=>row.display==='outside alpha needle'),false,'session scope drops the other project');
      assert.ok(picker.cycleScope());await drive();await until(()=>snapshot().scope==='project'&&reads.at(-1)==='project');
      await until(()=>snapshot().items.length===124&&snapshot().status==='complete');
      assert.equal(snapshot().items.some(row=>row.display==='outside alpha needle'),false,'project scope drops the other project');
      // The source caches each scope's scan, so returning to everywhere restores it without a new read.
      assert.ok(picker.cycleScope());await drive();
      await until(()=>snapshot().scope==='everywhere'&&snapshot().items.length===126&&snapshot().status==='complete');
      assert.equal(reads.at(-1),'project');
      picker.query('needle');await until(()=>snapshot().filtered.length>0);
      const exact=snapshot().filtered.map(row=>row.display);
      assert.ok(exact.indexOf('local needle tail')<exact.indexOf('n e e d l e fuzzy'),'exact substring rows precede fuzzy subsequence rows');
      // Paste payloads stay lazy: the row resolves only when the picker is about to use it.
      for(const row of snapshot().filtered.slice(0,4)){const resolved=await row.entry.resolve();
        assert.ok(expandPastedText(resolved.display,resolved.pastedContents).length>=0);
        if(row.display.startsWith('[Pasted text'))assert.equal(expandPastedText(resolved.display,resolved.pastedContents),raw);}
      const before=snapshot().filtered.length;picker.query('zzzz-no-such-row');await until(()=>snapshot().filtered.length===0);
      assert.match(picker.frame(40,10).join('\n'),/No matching prompts/);picker.query('needle');await until(()=>snapshot().filtered.length===before);
      assert.equal(picker.accept(),true);assert.equal(picker.done.entry?.display.includes('needle'),true);await picker.chosenEntry();
      picker.begin();picker.cancel();assert.equal(picker.done.cancelled,true);
      const empty=picker.frame(40,4);assert.ok(empty.length<=4);
    }finally{picker.close();await store.finish();}
    assert.equal(allocator.carrierProviders.size,0);
  }finally{await localWriter.finish();await writer.finish();await outsideWriter.finish();session.close();foreign.close();outsider.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('picker and prompt-line search close their readers and releases bind before rebind, close and pending exit',async()=>{
  const root=scratch(),user=path.join(root,'user'),other=path.join(root,'other');fs.mkdirSync(user);fs.mkdirSync(other);
  // The foreign project shares the history directory but not the session or project identity.
  const session=Session.open(root,{config:config(root,user)}),foreign=Session.open(other,{config:config(other,user)});
  const store=new InputHistory();const allocator=new Mct();
  try{
    await store.bind(session);store.add(entry('reader row'));await store.flush();
    const picker=new ScopePicker({read:(scope:PickerScope)=>store.readTimestamped(scope),changed:()=>{},report:error=>{throw error;},allocator,resolve:row=>row.resolve()});
    picker.begin();await delay(20);picker.close();
    const search=new HistorySearch({read:()=>store.readEntries(),changed:()=>{},submit:()=>{},report:error=>{throw error;},carriers:()=>[],sessionId:()=>session.id,allocator});
    search.open({text:'draft',cursor:5,pastedContents:{}});search.query('reader');await delay(20);search.close();
    assert.equal(allocator.carrierProviders.size,0);
    await store.bind(foreign);store.add(entry('foreign row'));await store.flush();
    const rows=[];for await(const row of store.readTimestamped('everywhere'))rows.push(row.display);
    assert.ok(rows.includes('foreign row'));
    await store.bind(session);
    const stale=store.readTimestamped('project');await stale.next();await store.bind(session);assert.equal((await stale.next()).done,true);
    await store.finish();assert.equal((await store.readTimestamped('session').next()).done,true);
    assert.equal(fs.existsSync(path.join(user,'history.jsonl.lock')),false);assert.equal(fs.existsSync(path.join(other,'history.jsonl.lock')),false);
  }finally{await store.finish();session.close();foreign.close();fs.rmSync(root,{recursive:true,force:true});}
});
