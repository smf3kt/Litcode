import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { editExternal } from '../src/external-editor.js';
import { createTerminalInput } from '../src/terminal.js';
import { TuiTerminal } from '../src/tui.js';

function fixture() {
  const root=fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR,'tmp') : os.tmpdir(),'editor-test-'));
  const previous={VISUAL:process.env.VISUAL,EDITOR:process.env.EDITOR};
  const script=path.join(root,'fixture.mjs');
  const configure=(body: string) => {
    fs.writeFileSync(script,body);process.env.VISUAL=process.execPath+' '+script;process.env.EDITOR='unused';
  };
  const close=()=>{
    for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
    fs.rmSync(root,{recursive:true,force:true});
  };
  return {root,configure,close};
}
const draft={text:'[Pasted text #1 +3 lines]',cursor:25,pastedContents:{'1':{id:1,type:'text' as const,content:'one\ntwo\nthree\nfour'}}};

test('source external editor expands and refolds text with ordered handoff and private cleanup', async () => {
  const owned=fixture(),calls:string[]=[];let temporary='';
  try {
    owned.configure(`import fs from 'node:fs';const file=process.argv.at(-1);fs.writeFileSync(${JSON.stringify(path.join(owned.root,'observed.json'))},JSON.stringify({file,content:fs.readFileSync(file,'utf8'),mode:fs.statSync(file).mode&511}));fs.writeFileSync(file,fs.readFileSync(file,'utf8')+' suffix\\n');`);
    const result=await editExternal(draft,{suspend:()=>calls.push('suspend'),resume:()=>calls.push('resume')},new AbortController().signal,owned.root);
    assert.deepEqual(result,{content:'[Pasted text #1 +3 lines] suffix'});assert.deepEqual(calls,['suspend','resume']);
    const observed=JSON.parse(fs.readFileSync(path.join(owned.root,'observed.json'),'utf8'));temporary=observed.file;
    assert.equal(observed.content,'one\ntwo\nthree\nfour');assert.equal(observed.mode,0o600);
    assert.equal(fs.existsSync(temporary),false);assert.equal(fs.existsSync(path.dirname(temporary)),false);
    owned.configure('process.exit(7);');calls.length=0;
    const failed=await editExternal(draft,{suspend:()=>calls.push('suspend'),resume:()=>calls.push('resume')},new AbortController().signal,owned.root);
    assert.equal(failed.content,null);assert.match(failed.error!,/exit code 7/);assert.deepEqual(calls,['suspend','resume']);
  } finally {owned.close();}
});

test('line external editor restores raw draft, undo, input and pending child cancellation', async () => {
  const owned=fixture();const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};
  const output=new Writable({write(_chunk,_encoding,done){done();}});Object.assign(output,{isTTY:true,columns:40,rows:24});
  const submitted:string[]=[];const terminal=createTerminalInput({input,output,onSubmit:text=>submitted.push(text)}).start();
  try {
    owned.configure(`import fs from 'node:fs';const file=process.argv.at(-1);fs.writeFileSync(file,fs.readFileSync(file,'utf8')+' suffix\\n');`);
    input.emit('data','original');await terminal.editDraft(new AbortController().signal,owned.root);
    assert.equal(terminal.state.text,'original suffix');assert.equal(input.isRaw,true);
    input.emit('data','\u001f');assert.equal(terminal.state.text,'original');
    input.emit('data','\r');assert.deepEqual(submitted,['original']);
    const ready=path.join(owned.root,'ready.json');
    owned.configure(`import fs from 'node:fs';import {spawn} from 'node:child_process';const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({file:process.argv.at(-1),pid:process.pid,descendant:descendant.pid}));setInterval(()=>{},1000);`);
    input.emit('data','pending');const editing=terminal.editDraft(new AbortController().signal,owned.root);
    for(let index=0;!fs.existsSync(ready)&&index<100;index++)await delay(10);
    assert.ok(fs.existsSync(ready));const child=JSON.parse(fs.readFileSync(ready,'utf8'));
    assert.equal(input.isRaw,false);terminal.close();await editing;
    assert.equal(input.isRaw,false);assert.equal(fs.existsSync(child.file),false);
    assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});assert.throws(()=>process.kill(child.descendant,0),{code:'ESRCH'});assert.equal(input.listenerCount('data'),0);
  } finally {terminal.close();owned.close();}
});

test('TUI external editor handoff refolds payload and restores modes through success and failure', async () => {
  const owned=fixture();const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};let writes='';
  const output=new Writable({write(chunk,_encoding,done){writes+=String(chunk);done();}});Object.assign(output,{isTTY:true,columns:40,rows:24});
  const submitted:string[]=[];const tui=new TuiTerminal({input,output,onSubmit:text=>submitted.push(text)}).start();
  try {
    owned.configure(`import fs from 'node:fs';const file=process.argv.at(-1);fs.writeFileSync(file,fs.readFileSync(file,'utf8')+' suffix\\n');`);
    input.emit('data','\x1b[200~one\ntwo\nthree\nfour\x1b[201~');await tui.editDraft(new AbortController().signal,owned.root);
    assert.equal(tui.state.text,'[Pasted text #1 +3 lines] suffix');assert.equal(input.isRaw,true);
    assert.ok(writes.includes('\x1b[?1049l'));assert.ok(writes.lastIndexOf('\x1b[?1049h')>writes.lastIndexOf('\x1b[?1049l'));
    input.emit('data','\u001f');assert.equal(tui.state.text,'[Pasted text #1 +3 lines]');
    owned.configure('process.exit(7);');const result=await tui.editDraft(new AbortController().signal,owned.root);
    assert.match(result.error!,/exit code 7/);assert.equal(tui.state.text,'[Pasted text #1 +3 lines]');
    input.emit('data','\r');assert.deepEqual(submitted,['one\ntwo\nthree\nfour']);
  } finally {tui.close();owned.close();}
  assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);
});
