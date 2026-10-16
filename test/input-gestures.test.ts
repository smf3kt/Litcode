import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createTerminalInput } from '../src/terminal.js';
import { TuiTerminal } from '../src/tui.js';

const {Terminal}=createRequire(import.meta.url)('@xterm/headless');
function fixture(mode:'line'|'tui',columns=40){
  const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=raw=>{input.isRaw=raw;};let outputText='';
  const screen=new Terminal({cols:columns,rows:10,allowProposedApi:true,logLevel:'off'});
  const output=new Writable({write(chunk,_encoding,done){outputText+=String(chunk);screen._core.writeSync(String(chunk));done();}});Object.assign(output,{isTTY:true,columns,rows:10});
  let exits=0,interrupts=0;const submitted:string[]=[],actions:string[]=[],options={input,output,sourceInputGestures:true,onExit:()=>{exits++;},onInterrupt:()=>{interrupts++;},onSubmit:(text:string)=>submitted.push(text),onAction:(action:string)=>actions.push(action)};
  const terminal=(mode==='line'?createTerminalInput(options):new TuiTerminal(options)).start();
  const key=async(value:string)=>{input.emit('data',value);if(value==='\x1b')await delay(70);};
  const hint=()=>Reflect.get(terminal,'gestures').hint as string|undefined;
  const close=()=>{terminal.close();screen.dispose();assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);};
  const lines=()=>Array.from({length:10},(_,row)=>screen.buffer.active.getLine(screen.buffer.active.viewportY+row)?.translateToString(true)??'');
  return {terminal,input,key,hint,close,submitted,actions,screen,lines,exits:()=>exits,interrupts:()=>interrupts,output:()=>outputText};
}

test('copied iq arms, expires and confirms the shared Ctrl-C/D exit gesture',async()=>{
  for(const mode of ['line','tui'] as const){const f=fixture(mode);try{
    await f.key('draft\u0003');assert.equal(f.terminal.state.text,'');assert.equal(f.hint(),'Press Ctrl-C again to exit');assert.equal(f.exits(),0);
    await delay(850);assert.equal(f.hint(),undefined);await f.key('\u0004');assert.equal(f.hint(),'Press Ctrl-D again to exit');assert.equal(f.exits(),0);
    await f.key('\u0003');assert.equal(f.exits(),1);assert.equal(f.input.isRaw,false);
  }finally{f.close();}}
  for(const mode of ['line','tui'] as const){const f=fixture(mode);try{
    await f.key('abc\u0001\u0004');assert.equal(f.terminal.state.text,'bc');assert.equal(f.hint(),undefined);
    await f.key('\u0004\u0004');assert.equal(f.terminal.state.text,'');assert.equal(f.hint(),undefined);
    await f.key('\u0004');assert.equal(f.exits(),0);await f.key('\u0004');assert.equal(f.exits(),1);
  }finally{f.close();}}
});

test('source double Escape stores folded raw history while Vim and running cancellation retain their owners',async()=>{
  for(const mode of ['line','tui'] as const){const f=fixture(mode);try{
    const raw='one\ntwo\nthree\nfour';await f.key('\x1b[200~'+raw+'\x1b[201~');const display=f.terminal.state.text;
    await f.key('\x1b');assert.equal(f.hint(),'Esc again to clear');assert.equal(f.terminal.state.text,display);
    await f.key('\x1b');assert.equal(f.terminal.state.text,'');assert.deepEqual(f.terminal.state.pastedContents,{});assert.deepEqual(f.terminal.state.history,[display]);
    await f.key('\x1b[A\r');assert.deepEqual(f.submitted,[raw]);
    f.terminal.setEditorMode('vim');await f.key('draft');await f.key('\x1b');await f.key('\x1b');assert.equal(f.terminal.state.text,'draft');assert.equal(f.hint(),undefined);
    await f.key('v');f.terminal.setRunning(true);await f.key('\u0003');assert.equal(f.interrupts(),1);assert.equal(f.hint(),undefined);assert.equal(f.terminal.state.text,'draft');
    f.terminal.setRunning(false);
  }finally{f.close();}}
});

test('confirmation timers reset at modal, configuration and editor handoff, then close without later output',async()=>{
  const f=fixture('tui');const tui=f.terminal as TuiTerminal;try{
    await f.key('\u0003');const dialog=tui.prompt({message:'Answer',allowText:true},new AbortController().signal);await f.key('answer\r');await dialog;
    await f.key('\u0003');assert.equal(f.exits(),0);assert.equal(f.hint(),'Press Ctrl-C again to exit');
    tui.setEditorMode('vim');assert.equal(f.hint(),undefined);tui.setEditorMode('normal');
    await f.key('\u0003');tui.setKeybindings({'\u0003':null});assert.equal(f.hint(),undefined);tui.setKeybindings();
    const previous=process.env.VISUAL;process.env.VISUAL='/usr/bin/true';
    try{await f.key('\u0003');await tui.editDraft(new AbortController().signal);assert.equal(f.hint(),undefined);await f.key('\u0003');assert.equal(f.exits(),0);}
    finally{if(previous===undefined)delete process.env.VISUAL;else process.env.VISUAL=previous;}
    f.close();const before=f.output();await delay(850);assert.equal(f.output(),before);
  }finally{f.close();}
  for(const mode of ['line','tui'] as const){const narrow=fixture(mode,20);try{
    await narrow.key('\u0003');await delay(850);await narrow.key('fresh');
    assert.equal(narrow.lines().some(row=>row.includes('Press Ctrl')),false);assert.equal(narrow.terminal.state.text,'fresh');
  }finally{narrow.close();}}
  const chord=fixture('tui');try{
    await chord.key('draft\u0018');await chord.key('\x1b');await chord.key('\u0005');
    assert.equal(chord.actions.includes('chat:externalEditor'),false);assert.equal(Reflect.get(chord.terminal,'keys').pendingChord,'');
  }finally{chord.close();}
});
