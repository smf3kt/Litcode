import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createTerminalInput } from '../src/terminal.js';
import { TuiTerminal } from '../src/tui.js';

const {Terminal}=createRequire(import.meta.url)('@xterm/headless');
function fixture(mode:'line'|'tui',remaps:Record<string,unknown>={jj:'<Esc>',jk:'<Esc>'}) {
  const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};
  const screen=new Terminal({cols:40,rows:10,allowProposedApi:true,logLevel:'off'});
  const output=new Writable({write(chunk,_encoding,done){screen._core.writeSync(String(chunk));done();}});
  Object.assign(output,{isTTY:true,columns:40,rows:10});
  const submitted:string[]=[],actions:string[]=[];
  const options={input,output,editorMode:'vim' as const,vimInsertModeRemaps:remaps,onSubmit:(text:string)=>submitted.push(text),onAction:(action:string)=>actions.push(action)};
  const terminal=(mode==='line'?createTerminalInput(options):new TuiTerminal(options)).start();
  const key=async(value:string)=>{input.emit('data',value);if(value==='\x1b')await delay(70);};
  const lines=()=>Array.from({length:10},(_,row)=>screen.buffer.active.getLine(screen.buffer.active.viewportY+row)?.translateToString(true)??'');
  const close=()=>{terminal.close();screen.dispose();assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);};
  return {input,terminal,key,submitted,actions,lines,screen,close};
}

test('source Vim operators, counts, dot and visual ranges submit through both terminal owners',async()=>{
  for(const mode of ['line','tui'] as const){const owned=fixture(mode);const {terminal,key,submitted}=owned;
    try{
      await key('alpha beta gamma');await key('\x1b');await key('0dw.iX');await key('\x1b');await key('v');await key('l');
      const buffer=owned.screen.buffer.active;
      assert.ok(Array.from({length:10},(_,row)=>buffer.getLine(buffer.viewportY+row)).some(line=>line&&Array.from({length:40},(_,col)=>line.getCell(col)).filter(cell=>cell?.isInverse()).length>=2));
      await key('x');assert.equal(terminal.state.text,'amma');await key('\r');
      await key('one two three four');await key('\x1b');await key('02dw');assert.equal(terminal.state.text,'three four');await key('\r');
      await key('a (hello world) z');await key('\x1b');await key('0f(lciwX');await key('\x1b');assert.equal(terminal.state.text,'a (X world) z');await key('\r');
      await key('abc-def-ghi');await key('\x1b');await key('0f-;rX~');assert.equal(terminal.state.text,'abc-defxghi');await key('\r');
      const paste='\x1b[200~one\ntwo\nthree\x1b[201~';await key(paste);await key(paste);await key('\x1b');await key('ggVjd');assert.equal(terminal.state.text,'three');await key('u');assert.equal(terminal.state.text,'one\ntwo\nthree');await key('ggJ>>');assert.equal(terminal.state.text,'  one two\nthree');await key('\r');
      assert.deepEqual(submitted,['amma','three four','a (X world) z','abc-defxghi','  one two\nthree']);
    }finally{owned.close();}
  }
});

test('source remap timing and registers preserve raw Unicode, folded payloads and undo',async context=>{
  let time=10000;context.mock.method(Date,'now',()=>time);
  for(const mode of ['line','tui'] as const){const owned=fixture(mode,{jj:'<Esc>',jk:'<Esc>',bad:'<Esc>',xx:'ignored',invalid:42});const {terminal,key,submitted}=owned;
    try{
      await key('draftj');await key('j');assert.equal(terminal.state.text,'draft');await key('0xiQjk.');assert.equal(terminal.state.text,'QQraft');await key('\r');
      await key('j');time+=1001;await key('j');assert.equal(terminal.state.text,'jj');await key('\r');
      await key('é👩‍💻');assert.equal(terminal.state.text,'é👩‍💻');await key('\x1b');await key('0x');assert.equal(terminal.state.text,'👩‍💻');await key('u');assert.equal(terminal.state.text,'é👩‍💻');await key('\r');
      const raw='one\ntwo\nthree\nfour';await key('\x1b[200~'+raw+'\x1b[201~');await key('\x1b');await key('0dd');assert.deepEqual(terminal.state.pastedContents,{});await key('u');assert.equal(Object.values(terminal.state.pastedContents)[0]?.content,raw);await key('ddp');assert.equal(terminal.state.text,'\n'+raw);await key('\r');
      await key('\x1b');await key('p');assert.equal(terminal.state.text,'\n'+raw);await key('\r');
      assert.deepEqual(submitted,['QQraft','jj','é👩‍💻','\n'+raw,'\n'+raw]);
      const previous={VISUAL:process.env.VISUAL,EDITOR:process.env.EDITOR};
      try{
        for(const executable of ['/usr/bin/true','/usr/bin/false']){
          process.env.VISUAL=executable;process.env.EDITOR='unused';await key('draftj');
          await terminal.editDraft(new AbortController().signal);await key('j');assert.equal(terminal.state.text,'draftjj');
          await key('\u0003');
        }
      }finally{for(const [name,value]of Object.entries(previous))if(value===undefined)delete process.env[name];else process.env[name]=value;}
      let interrupts=0;const unsubscribe=terminal.subscribe({onInterrupt:()=>{interrupts++;}});
      await key('active');await key('\x1b');await key('v');terminal.setRunning(true);await key('\u0003');
      assert.equal(interrupts,1);assert.equal(terminal.state.interruptRequested,true);await key('\u0003');assert.equal(interrupts,1);unsubscribe();terminal.setRunning(false);
    }finally{owned.close();}
  }
});

test('Vim configuration changes and TUI global keys retain draft and modal ownership',async()=>{
  const owned=fixture('tui');const tui=owned.terminal as TuiTerminal;const {key,actions}=owned;
  try{
    await key('draft');await key('\x1b');await key('\u0013');assert.equal(tui.state.text,'');await key('scratch\u0013');assert.equal(tui.state.text,'draft');
    await key('\x1bp');assert.ok(actions.includes('chat:modelPicker'));assert.equal(tui.state.text,'draft');
    const answer=tui.prompt({message:'Answer',allowText:true},new AbortController().signal);await key('jj');await key('\r');assert.deepEqual(await answer,{selected:[],text:'jj'});assert.equal(tui.state.text,'draft');
    tui.setEditorMode('normal');await key('j');assert.equal(tui.state.text,'drafjt');tui.setEditorMode('vim',{jj:'<Esc>'});await key('j');tui.setEditorMode('vim',{jk:'<Esc>'});await key('k');assert.equal(tui.state.text,'drafjjkt');
    tui.setKeybindings({q:'submit'});await key('q');assert.deepEqual(owned.submitted,['drafjjkt']);
    await key('pending');await key('\x1b');await key('\u000c');assert.equal(tui.state.text,'pending','the redraw chord leaves the draft untouched');
    tui.setEditorMode('normal');await key('\u0001');while(tui.state.text!=='')await key('\u000b');assert.equal(tui.state.text,'');await key('fresh');assert.equal(tui.state.text,'fresh');
    tui.setEditorMode('vim',{jj:'<Esc>'});await key('j');const remapDialog=tui.prompt({message:'Boundary',allowText:true},new AbortController().signal);
    await key('done\r');await remapDialog;await key('j');assert.equal(tui.state.text,'freshjj');
  }finally{owned.close();}
});
