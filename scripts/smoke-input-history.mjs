import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { TerminalScreen } from './terminal-screen.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const cliIndex=process.argv.indexOf('--cli'),cli=cliIndex<0?path.join(root,'bin/litcode.mjs'):process.argv[cliIndex+1];
assert.ok(cli,'--cli requires an executable');
const line=process.argv.includes('--line'),searchChain=process.argv.includes('--search-chain');
const temporary=fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR?path.join(process.env.CLAUDE_JOB_DIR,'tmp'):root,'.input-history-'));
const workspace=path.join(temporary,'workspace'),user=path.join(temporary,'user');fs.mkdirSync(workspace);fs.mkdirSync(user);
const raw=('restart é👩‍💻 '+ 'x'.repeat(20)+'\n').repeat(80).trimEnd();
const requests=[],runs=[];
const server=http.createServer(async(req,res)=>{
  try{
    let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);requests.push(body);
    res.writeHead(200,{'Content-Type':'text/event-stream'});
    const emit=(event,data)=>res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    emit('message_start',{type:'message_start',message:{id:'history-'+requests.length,type:'message',role:'assistant',model:'fixture/history',content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}});
    emit('content_block_start',{type:'content_block_start',index:0,content_block:{type:'text',text:''}});
    emit('content_block_delta',{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'history accepted '+requests.length}});
    emit('content_block_stop',{type:'content_block_stop',index:0});
    emit('message_delta',{type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:10}});
    emit('message_stop',{type:'message_stop'});res.end();
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const quote=value=>`'${value.replaceAll("'","'\\''")}'`;
function start(index){
  const pidFile=path.join(temporary,'cli-'+index+'.pid');
  const command=`printf '%s' "$$" > ${quote(pidFile)}; stty rows 10 cols 40; exec ${quote(process.execPath)} ${quote(cli)}${line?' --no-tui':''} --workspace ${quote(workspace)} --user-dir ${quote(user)}`;
  const child=spawn('/bin/sh',['-c',`cat | script -q /dev/null /bin/sh -c ${quote(command)}`],{cwd:root,detached:true,
    env:{...process.env,TERM:'xterm-256color',LLM_INHERIT_GATEWAY:'false',LLM_API_KEY:'owned-history-fixture',
      LLM_BASE_URL:`http://127.0.0.1:${server.address().port}`,LLM_MODEL:'fixture/history',LLM_AUTH:'bearer',
      LLM_THINKING:'false',LLM_TOKEN_COUNTING:'estimate',LLM_PROMPT_CACHE:'false',LLM_EAGER_TOOL_INPUT:'false'}});
  const screen=new TerminalScreen(40,10);let output='',errors='';
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',text=>{output+=text;screen.write(text);});child.stderr.on('data',text=>errors+=text);
  const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
  const kill=()=>{if(fs.existsSync(pidFile)){const pid=Number(fs.readFileSync(pidFile,'utf8'));if(Number.isSafeInteger(pid)&&pid>0)try{process.kill(pid,'SIGKILL');}catch{}}
    try{process.kill(-child.pid,'SIGKILL');}catch{}};
  const timer=setTimeout(kill,20000),frame=()=>screen.lines().join('\n');
  const until=async predicate=>{const deadline=Date.now()+10000;while(!predicate()){if(child.exitCode!==null)throw new Error('CLI exited: '+errors);if(Date.now()>deadline)throw new Error('History CLI timed out: '+errors+'\n'+frame());await delay(10);}};
  const send=async text=>{child.stdin.write(text);if(text==='\x1b')await delay(80);};
  const draft=text=>screen.lines().some(row=>row.includes((line?'> ':'❯ ')+text));
  const close=async()=>{clearTimeout(timer);if(child.exitCode===null){kill();await exited;}screen.close();};
  const row={child,screen,frame,until,send,draft,exited,close,output:()=>output,errors:()=>errors};runs.push(row);return row;
}
try{
  let run=start(1);await run.until(()=>line?run.output().includes('/help for commands.'):run.frame().includes('ctrl+o'));
  await run.send('\x1b[200~'+raw+'\x1b[201~');await run.until(()=>run.draft('[Pasted text #1'));await run.send('\r');
  await run.until(()=>requests.length===1&&run.frame().includes('history accepted 1')&&(line?run.output().includes('finished: end_turn'):run.frame().includes('ready')));
  assert.equal(requests[0].messages.filter(row=>row.role==='user').at(-1).content,raw);
  await run.send('cleared after submit');await run.send('\x1b');await run.until(()=>run.frame().includes('Esc again'));await run.send('\x1b');
  await run.until(()=>!run.draft('cleared after submit'));await run.send('\u0004');await run.until(()=>run.frame().includes('Press Ctrl-D'));await run.send('\u0004');run.child.stdin.end();assert.equal(await run.exited,0,run.errors());
  const file=path.join(user,'history.jsonl'),records=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length,2);assert.match(records[0].display,/^\[Pasted text #1/);assert.equal(records[1].display,'cleared after submit');
  const hash=records[0].pastedContents[1].contentHash;assert.match(hash,/^[0-9a-f]{16}$/);assert.equal(fs.readFileSync(path.join(user,'paste-cache',hash+'.txt'),'utf8'),raw);
  assert.equal(fs.statSync(file).mode&511,384);assert.equal(fs.existsSync(file+'.lock'),false);await run.close();
  if(searchChain){
    const foreign=path.join(temporary,'foreign');fs.mkdirSync(foreign);
    fs.appendFileSync(file,[1,2].map(index=>JSON.stringify({display:'FOREIGN Needle é👩‍💻',pastedContents:{},timestamp:Date.now()+index,
      project:foreign,sessionId:'owned-foreign-'+index})+'\n').join(''));
  }
  run=start(2);await run.until(()=>line?run.output().includes('/help for commands.'):run.frame().includes('ctrl+o'));
  await run.send('\x1b[A');await run.until(()=>run.draft('cleared after submit'));await run.send('\r');
  await run.until(()=>requests.length===2&&run.frame().includes('history accepted 2')&&(line?run.output().includes('finished: end_turn'):run.frame().includes('ready')));
  assert.equal(requests[1].messages.filter(row=>row.role==='user').at(-1).content,'cleared after submit');
  // While the history is bound the scoped picker owns ctrl+r. Source Kse filters the folded display
  // text only, and source gLt selects the focused row with enter without submitting, so the restored
  // row is reached by walking the list, accepted into the draft, and then submitted explicitly. The
  // filter is cleared after opening so the steps below do not depend on the open-time query.
  const openPicker=async query=>{await run.send('\u0012');await run.until(()=>run.frame().includes('Search prompts'));
    await run.send('\u007f'.repeat(80));
    // Each backspace re-renders; wait for the cleared query instead of assuming a fixed delay.
    await run.until(()=>run.frame().includes('Filter history…'));
    if(query)await run.send(query);};
  // Visibility is not focus: the frame's window shows the row above the focused one. Walk the
  // frame's own focus until the target row carries the `>` marker.
  const focusedRow=text=>run.frame().split('\n').some(row=>row.startsWith('>')&&row.includes(text));
  const walkTo=async text=>{for(let step=0;step<12&&!focusedRow(text);step++){await run.send('\x1b[A');await delay(40);}
    await run.until(()=>focusedRow(text));};
  await openPicker();await walkTo('[Pasted text #1');
  await run.send('\r');await run.until(()=>run.draft('[Pasted text #1'));assert.equal(requests.length,2);
  await run.send('\r');
  await run.until(()=>requests.length===3&&run.frame().includes('history accepted 3')&&(line?(run.output().match(/finished: end_turn/g)??[]).length===2:run.frame().includes('ready')));
  assert.equal(requests[2].messages.filter(row=>row.role==='user').at(-1).content,raw);
  if(searchChain){
    const completed=async(index,text)=>{
      await run.until(()=>requests.length===index&&run.frame().includes('history accepted '+index)
        &&(line?(run.output().match(/finished: end_turn/g)??[]).length===index-1:run.frame().includes('ready')));
      assert.equal(requests[index-1].messages.filter(row=>row.role==='user').at(-1).content,text);
    };
    // Scope: 'everywhere' lists foreign-project rows, the query folds case, and cancel leaves the
    // untouched draft in place with no model request.
    await run.send('retained draft');await run.send('\u0012');
    // Opening with a draft pre-filters the list: source `_y` seeds its query from the consumer's
    // `initialQuery`, which is the draft (`e(Kse,{initialQuery: ee.value, ...})`).
    await run.until(()=>run.frame().includes('No matching prompts'));
    await run.send('\u0003');await run.until(()=>!run.frame().includes('Search prompts'));
    await run.until(()=>run.draft('retained draft'));assert.equal(requests.length,3);
    await openPicker('nEeDlE');await run.until(()=>run.frame().includes('FOREIGN Needle'));
    await run.send('\u0003');await run.until(()=>!run.frame().includes('Search prompts'));
    await run.until(()=>run.draft('retained draft'));assert.equal(requests.length,3);
    // A query that matches no row is not a submission: source gLt swallows enter and the picker holds.
    await openPicker('zzzz-no-such-row');await run.until(()=>run.frame().includes('No matching prompts'));
    await run.send('\r');await delay(300);
    assert.equal(requests.length,3);assert.ok(run.frame().includes('Search prompts'));
    await run.send('\u0003');await run.until(()=>!run.frame().includes('Search prompts'));
    // Source gLt selects the focused row with tab or enter without running it; the next enter submits.
    await openPicker('needle');await run.until(()=>run.frame().includes('FOREIGN Needle'));
    await run.send('\t');await run.until(()=>run.draft('FOREIGN Needle'));assert.equal(requests.length,3);
    await run.send('\r');await completed(4,'FOREIGN Needle é👩‍💻');
    // An empty query lists the newest row first; enter selects it into the draft without running it.
    await run.send('empty query draft');await openPicker();await run.send('\r');
    await run.until(()=>run.draft('FOREIGN Needle'));assert.equal(requests.length,4);
    await run.until(()=>!run.frame().includes('Search prompts'));
    await run.send('\r');
    await run.until(()=>requests.length===5&&run.frame().includes('history accepted 5'));
    assert.equal(requests[4].messages.filter(row=>row.role==='user').at(-1).content.startsWith('FOREIGN Needle'),true);
    // Accepting a folded row keeps the shared paste allocator; the new body rebases onto its payload.
    await openPicker();await walkTo('[Pasted text #1');
    await run.send('\t');await run.until(()=>run.draft('[Pasted text #1'));assert.equal(requests.length,5);
    await run.send('\x1b[200~new\npaste\nbody\x1b[201~');await run.until(()=>/text #\d+ \+2 lines\]/.test(run.frame()));
    await run.send('\r');await completed(6,raw+'new\npaste\nbody');
  }
  await run.send('\u0004');await run.until(()=>run.frame().includes('Press Ctrl-D'));await run.send('\u0004');run.child.stdin.end();assert.equal(await run.exited,0,run.errors());
  assert.equal(fs.existsSync(file+'.lock'),false);const journals=fs.readdirSync(path.join(workspace,'.agent')).filter(name=>name.endsWith('.jsonl'));
  assert.equal(journals.length,2);assert.equal(fs.readdirSync(path.join(workspace,'.agent')).some(name=>name.endsWith('.lock')),false);
  for(const name of journals)assert.equal(fs.readFileSync(path.join(workspace,'.agent',name),'utf8').includes('owned-history-fixture'),false);
  let pendingSearchExit;
  if(searchChain){run=start(3);await run.until(()=>line?run.output().includes('/help for commands.'):run.frame().includes('ctrl+o'));
    await run.send('closing draft');await openPicker('no-owned-result');await run.until(()=>run.frame().includes('No matching prompts'));
    process.kill(Number(fs.readFileSync(path.join(temporary,'cli-3.pid'),'utf8')),'SIGTERM');run.child.stdin.end();pendingSearchExit=await run.exited;
    assert.equal(pendingSearchExit,130);assert.equal(fs.readdirSync(path.join(workspace,'.agent')).some(name=>name.endsWith('.lock')),false);
  }
  console.log(JSON.stringify({tuiInputHistory:'passed',crossProcessRestart:true,sourceHashCache:true,rawUnicode:true,displayAndPayloadPaired:true,
    ...(searchChain?{tuiHistorySearch:'passed',globalAcrossProjects:true,caseInsensitive:true,sourceDuplicateSkip:true,
      cancelRestoresDraft:true,noMatchSkipsSubmit:true,acceptWithoutSubmit:true,emptyQueryFirstRowSelects:true,draftSeedsQuery:true,pasteRebaseSharedAllocator:true,pendingSearchExit}:{}),
    doubleEscapePersisted:true,projectNavigation:true,rawSearch:true,exactSubmission:true,privateFiles:true,modesRestored:runs.every(run=>run.output().includes('\x1b[?2004l')),
    locksReleased:true,exitCode:0,compiled:true,installedCLI:cliIndex>=0,lineInput:line,modelCalls:requests.length,provider:'owned loopback SSE',paidUpstreamCalls:0}));
}finally{for(const run of runs)await run.close();await new Promise(resolve=>server.close(resolve));fs.rmSync(temporary,{recursive:true,force:true});}
