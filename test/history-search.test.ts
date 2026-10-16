import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {PassThrough,Writable} from 'node:stream';
import {createRequire} from 'node:module';
import type {Terminal as TerminalType} from '@xterm/headless';
const {Terminal}=createRequire(import.meta.url)('@xterm/headless') as {Terminal:typeof TerminalType};
import {setTimeout as delay} from 'node:timers/promises';
import {test} from 'node:test';
import {HistorySearch,type SearchSnapshot} from '../src/tui-history-search.js';
import {InputHistory,type InputHistoryEntry} from '../src/tui-input-history.js';
import {expandPastedText} from '../src/tui-input-paste.js';
import {Mct} from '../src/tui-input-paste-source.js';
import {TuiDocumentRenderer} from '../src/tui-document-renderer.js';
import {TuiTerminal} from '../src/tui.js';
import {createTerminalInput} from '../src/terminal.js';
import {defaultConfig} from '../src/agent.js';
import {Session} from '../src/session.js';

const scratch=()=>fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR?path.join(process.env.CLAUDE_JOB_DIR,'tmp'):os.tmpdir(),'history-search-')));
async function until(check:()=>boolean):Promise<void>{const end=Date.now()+3000;while(!check()){assert.ok(Date.now()<end,'history search fixture timed out');await delay(5);}}
const entry=(display:string):InputHistoryEntry=>({display,pastedContents:{}});
const gate=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return{promise,resolve};};

test('complete search hook keeps source query, dedup, next, exhaustion, mode, rebase and acceptance contracts',async()=>{
  const raw='raw needle é👩‍💻\n'.repeat(100),allocator=new Mct(),submitted:InputHistoryEntry[]=[],errors:unknown[]=[];
  let snapshot!:SearchSnapshot,closed=0;
  const records=[entry('NEW Needle end'),entry('NEW Needle end'),
    {display:'[Pasted text #1 +99 lines]',pastedContents:{1:{id:1,type:'text' as const,content:raw}}},entry('!echo needle')];
  const search=new HistorySearch({read:async function*(){try{yield*records;}finally{closed++;}},changed:value=>snapshot=value,
    submit:value=>submitted.push(value),report:error=>errors.push(error),carriers:()=>['[Pasted text #8]'],sessionId:()=> 'fixture',allocator});
  const document=new TuiDocumentRenderer();
  try{
    search.open({text:'original é👩‍💻',cursor:4,pastedContents:{}});assert.equal(snapshot.query,'');
    search.query('NEEDLE');await until(()=>snapshot.text==='NEW Needle end');assert.equal(snapshot.cursor,4);
    assert.match(document.renderElement(search.element(),40).map(row=>row.text).join('\n'),/search prompts: NEEDLE/);
    search.action('historySearch:next');await until(()=>snapshot.text.startsWith('[Pasted text'));
    search.action('historySearch:accept');assert.equal(snapshot.searching,false);
    assert.equal(snapshot.text,'[Pasted text #9 +99 lines]');assert.equal(expandPastedText(snapshot.text,snapshot.pastedContents),raw);
    assert.equal(allocator.mint(),10);assert.equal(submitted.length,0);
    search.open({text:'cancel draft',cursor:3,pastedContents:{}});search.query('needle');await until(()=>snapshot.text==='NEW Needle end');
    search.action('historySearch:next');await until(()=>snapshot.text.startsWith('[Pasted text'));
    search.action('historySearch:next');await until(()=>snapshot.text==='!echo needle');
    search.action('historySearch:next');await until(()=>snapshot.failed);assert.equal(snapshot.text,'!echo needle');
    assert.match(document.renderElement(search.element(),40).map(row=>row.text).join('\n'),/no matching prompt:/);
    search.action('historySearch:execute');assert.equal(submitted.at(-1)!.display,'!echo needle');
    search.action('historySearch:execute');assert.equal(submitted.length,1);
    search.open({text:'empty query task',cursor:5,pastedContents:{}});search.action('historySearch:execute');assert.equal(submitted.at(-1)!.display,'empty query task');
    search.open({text:'cancel draft',cursor:3,pastedContents:{}});search.query('missing');await until(()=>snapshot.failed);
    search.action('historySearch:execute');assert.equal(submitted.length,2);
    search.open({text:'cancel draft',cursor:3,pastedContents:{}});search.query('needle');await until(()=>snapshot.text==='NEW Needle end');
    search.action('historySearch:cancel');assert.equal(snapshot.text,'cancel draft');assert.equal(snapshot.cursor,3);
    search.open({text:'backspace draft',cursor:4,pastedContents:{}});assert.equal(search.backspace(),true);assert.equal(snapshot.text,'backspace draft');
    assert.deepEqual(errors,[]);assert.ok(closed>=3);
  }finally{search.close();document.close();}
  assert.equal(allocator.carrierProviders.size,0);assert.equal(document.liveNodes,0);
});

test('source iterator identity cancels late queries and store readers release before rebind or close',async()=>{
  let snapshot!:SearchSnapshot,calls=0,returns=0;const blocked=gate();
  const search=new HistorySearch({read:()=>{const index=++calls;return(async function*(){try{if(index===2)await blocked.promise;yield entry(index===2?'old query':'new query');}finally{returns++;}})();},
    changed:value=>snapshot=value,submit:()=>assert.fail('cancelled search submitted'),report:error=>{throw error;},carriers:()=>[],sessionId:()=> 'fixture'});
  try{
    search.open({text:'draft',cursor:2,pastedContents:{}});search.query('old');await until(()=>calls===2);
    search.query('new');await until(()=>snapshot.text==='new query');blocked.resolve();await delay(20);assert.equal(snapshot.text,'new query');
    search.action('historySearch:cancel');assert.equal(snapshot.text,'draft');search.close();const before=JSON.stringify(snapshot);await delay(20);assert.equal(JSON.stringify(snapshot),before);assert.ok(returns>=2);
  }finally{blocked.resolve();search.close();}
  const root=scratch(),user=path.join(root,'user');fs.mkdirSync(user);const config={...defaultConfig(root,[]),model:'fixture/search',configSources:{userDir:user}};
  const a=Session.open(root,{config}),b=Session.open(root,{config}),store=new InputHistory();
  try{
    await store.bind(a);store.add(entry('reader record'));await store.flush();const iterator=store.readEntries();assert.equal((await iterator.next()).value!.display,'reader record');
    await store.bind(b);assert.equal((await iterator.next()).done,true);
    const closeReader=store.readEntries();await closeReader.next();store.close();await store.finish();assert.equal((await closeReader.next()).done,true);
    assert.equal((await store.readEntries().next()).done,true);
  }finally{await store.finish();a.close();b.close();fs.rmSync(root,{recursive:true,force:true});}
});
