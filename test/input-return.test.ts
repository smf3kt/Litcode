import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createTerminalInput } from '../src/terminal.js';
import { TuiTerminal } from '../src/tui.js';

function fixture(mode:'line'|'tui'){
  const input=new PassThrough() as PassThrough & {isTTY:boolean;isRaw:boolean;setRawMode:(raw:boolean)=>void};
  input.isTTY=true;input.isRaw=false;input.setRawMode=raw=>{input.isRaw=raw;};
  const output=new Writable({write(_chunk,_encoding,done){done();}});Object.assign(output,{isTTY:true,columns:40,rows:10});
  const submitted:string[]=[],options={input,output,onSubmit:(text:string)=>submitted.push(text)};
  const terminal=(mode==='line'?createTerminalInput(options):new TuiTerminal(options)).start();
  const key=async(value:string)=>{input.emit('data',value);if(value==='\x1b')await delay(70);};
  const close=()=>{terminal.close();assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);};
  return {terminal,key,close,submitted};
}

test('source Return removes the preceding backslash before modifiers and keeps atomic undo and raw paste',async()=>{
  for(const mode of ['line','tui'] as const){const owned=fixture(mode),{terminal,key,submitted}=owned;
    try{
      await key('one\\\r');assert.equal(terminal.state.text,'one\n');assert.equal(submitted.length,0);
      await key('\u001f');assert.equal(terminal.state.text,'one\\');assert.equal(terminal.state.cursor,4);
      await key('\rtwo\r');
      await key('ab\\cd\x1b[D\x1b[D\r');assert.equal(terminal.state.text,'ab\ncd');assert.equal(terminal.state.cursor,3);await key('\r');
      for(const modifier of ['\x1b[13;2u','\x1b\r']){
        await key('é👩‍💻\\'+modifier+'中\r');
      }
      const raw='one\ntwo\nthree\nfour';await key('\x1b[200~'+raw+'\x1b[201~\\\r');
      assert.equal(Object.values(terminal.state.pastedContents)[0]?.content,raw);await key('tail\r');
      await key('literal\\\n');
      terminal.setKeybindings({'\r':'newline','\u0013':'submit'});await key('override\\\rtail\u0013');
      assert.deepEqual(submitted,['one\ntwo','ab\ncd','é👩‍💻\n中','é👩‍💻\n中',raw+'\ntail','literal\\','override\\\ntail']);
    }finally{owned.close();}
  }
});

test('framed Return preserves source Vim insertion repeats and plain modal command ownership',async()=>{
  for(const mode of ['line','tui'] as const){const owned=fixture(mode),{terminal,key,submitted}=owned;
    try{
      terminal.setEditorMode('vim');await key('one');await key('\x1b');await key('A\\\ré👩‍💻');await key('\x1b');await key('.\r');
      assert.deepEqual(submitted,['one\né👩‍💻\né👩‍💻']);
      terminal.setEditorMode('normal');
      if(terminal instanceof TuiTerminal){
        await key('root');const answer=terminal.prompt({message:'Answer',allowText:true},new AbortController().signal);
        await key('literal\\\r');assert.deepEqual(await answer,{selected:[],text:'literal\\'});assert.equal(terminal.state.text,'root');
        const multiline=terminal.prompt({message:'Answer',allowText:true},new AbortController().signal);
        await key('literal\\\x1b[13;2uvalue\r');assert.deepEqual(await multiline,{selected:[],text:'literal\\\nvalue'});
        await key('\u007f'.repeat('literal\\\nvalue'.length));await key('chord');await key('\u0018\r');assert.ok(submitted.includes('chord'));
      }
      if(terminal instanceof TuiTerminal){
        await key('draft\u0012\r');assert.equal(Reflect.get(terminal,'screen'),'chat');assert.equal(terminal.state.text,'');assert.equal(submitted.at(-1),'draft');
      }
      await key('pending\\\r');terminal.close();assert.equal(terminal.state.text,'pending\n');
    }finally{owned.close();}
  }
});
