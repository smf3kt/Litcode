import assert from 'node:assert/strict';
import childProcess, { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const project=path.resolve(import.meta.dirname,'..');
const base=process.env.CLAUDE_JOB_DIR?path.join(process.env.CLAUDE_JOB_DIR,'tmp'):os.tmpdir();
const work=fs.realpathSync(fs.mkdtempSync(path.join(base,'checkpoint-bracket-'))),binary=path.join(project,'native/directory-read/read');
const {Session}=await import(pathToFileURL(path.join(project,'dist/session.js')));
const {defaultConfig}=await import(pathToFileURL(path.join(project,'dist/agent.js')));
const {checkpointConversation}=await import(pathToFileURL(path.join(project,'dist/rewind.js')));
const {lock}=await import(pathToFileURL(path.join(project,'dist/skill-effects.js')));
let success=false;
try {
  const results=[];
  for(const kind of ['stable','file-change','file-revert','leaf-roundtrip','parent-roundtrip','root-roundtrip','root-pre-replaced','parent-swap','witness-change','revoke','revoke-regrant','kill',
    'missing-stable','missing-create','missing-create-delete','missing-symlink','missing-parent-roundtrip','missing-revoke','missing-kill']) {
    const root=path.join(work,`workspace-${kind}`),outside=path.join(work,`outside-${kind}`),sub=path.join(outside,'sub'),target=path.join(sub,'value');
    const missing=kind.startsWith('missing-');
    fs.mkdirSync(root);fs.mkdirSync(outside);fs.mkdirSync(sub);if(!missing){fs.writeFileSync(target,'ORIGINAL');fs.utimesSync(target,1700000000,1700000000);}
    fs.writeFileSync(path.join(root,'workspace-value'),'CHECKPOINT');
    const session=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const grant=session.workingDirectories(false).readHandle?.(outside);assert.ok(grant);
    if(kind==='root-pre-replaced'){fs.renameSync(outside,`${outside}-other`);fs.mkdirSync(outside);fs.mkdirSync(sub);fs.writeFileSync(target,'OTHER');}
    const liveGrant=()=>{try{const named=fs.lstatSync(outside,{bigint:true}),opened=fs.fstatSync(grant.fd,{bigint:true});
      const current=session.workingDirectories(false).readHandle?.(outside);
      return !grant.signal.aborted&&!!current&&!current.signal.aborted&&current.incarnation===grant.incarnation&&current.fd===grant.fd&&
        named.isDirectory()&&!named.isSymbolicLink()&&opened.isDirectory()&&named.dev===opened.dev&&named.ino===opened.ino&&opened.dev===grant.dev&&opened.ino===grant.ino;
    }catch{return false}};
    const liveBefore=liveGrant();
    const gate=fs.openSync(`${session.file}.lock.gate`,'r+');assert.equal(lock(gate,false),true);
    const backup=path.join(root,'.agent',`bracket-${kind}`),witness=fs.openSync(backup,'wx+',0o600);
    const child=spawn(binary,['--checkpoint-bracket','sub/value','--execute'],{stdio:['ignore','ignore','pipe',grant.fd,'pipe','pipe',gate,witness]});
    let output='',errors='',closed=false;child.stdio[4].on('data',x=>output+=String(x));child.stderr.on('data',x=>errors+=String(x));
    child.stdio[5].on('error',()=>{});
    const exited=new Promise(resolve=>child.once('close',(code,signal)=>{closed=true;resolve({code,signal})}));
    try {
      const limit=Date.now()+10000;
      while(!/^v[12] bracket-ready [^\n]+\n/.test(output)){assert.ok(Date.now()<limit&&!closed,`${kind}: ${output} ${errors}`);await new Promise(resolve=>setTimeout(resolve,10));}
      const captured=checkpointConversation(session,`checkpoint-${kind}`,new AbortController().signal);
      assert.ok(captured.checkpoint_digest);assert.equal(fs.readFileSync(backup,'utf8'),missing?'':'ORIGINAL');
      if(kind==='file-change'||kind==='file-revert') {
        fs.writeFileSync(target,'MUTATED!');if(kind==='file-revert')fs.writeFileSync(target,'ORIGINAL');fs.utimesSync(target,1700000000,1700000000);
      }
      if(kind==='leaf-roundtrip'){fs.renameSync(target,`${target}-other`);fs.renameSync(`${target}-other`,target);}
      if(kind==='parent-roundtrip'){fs.renameSync(sub,`${sub}-other`);fs.renameSync(`${sub}-other`,sub);}
      if(kind==='root-roundtrip'){fs.renameSync(outside,`${outside}-other`);fs.renameSync(`${outside}-other`,outside);}
      if(kind==='parent-swap'){fs.renameSync(sub,`${sub}-other`);fs.mkdirSync(sub);fs.writeFileSync(target,'OTHER');}
      if(kind==='witness-change')fs.writeSync(witness,Buffer.from('MUTATED!'),0,8,0);
      if(kind==='missing-create'||kind==='missing-create-delete'){fs.writeFileSync(target,'CREATED');if(kind==='missing-create-delete')fs.unlinkSync(target);}
      if(kind==='missing-symlink')fs.symlinkSync('elsewhere',target);
      if(kind==='missing-parent-roundtrip'){fs.renameSync(sub,`${sub}-other`);fs.renameSync(`${sub}-other`,sub);}
      if(kind==='revoke'||kind==='revoke-regrant'||kind==='missing-revoke'){
        session.adoptPermissionUpdates([{type:'removeDirectories',directories:[outside],destination:'session'}]);
        if(kind==='revoke-regrant')session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
        assert.equal(grant.signal.aborted,true);
      }
      if(kind==='kill'||kind==='missing-kill')child.kill('SIGKILL');else child.stdio[5].end('c');
      const result=await exited;
      if(kind==='stable'||kind==='revoke'||kind==='revoke-regrant'||kind==='root-pre-replaced'||kind==='missing-stable'||kind==='missing-revoke'){
        assert.equal(result.code,0,`${kind}: ${output} ${errors}`);
        const lines=output.trimEnd().split('\n');assert.equal(lines.length,2);assert.equal(lines[1],lines[0].replace('bracket-ready','bracket-stable'));
        assert.equal(liveBefore&&liveGrant(),kind==='stable'||kind==='missing-stable');
      }
      else if(kind==='kill'||kind==='missing-kill'){assert.equal(result.signal,'SIGKILL');assert.doesNotMatch(output,/bracket-stable/);}
      else{assert.notEqual(result.code,0,`${kind}: ${output}`);assert.match(output,/unknown/);assert.doesNotMatch(output,/bracket-stable/);}
      results.push({kind,...result,host:result.code===0&&liveBefore&&liveGrant()?'accepted':'unknown'});
    } finally {
      if(!closed){child.kill('SIGKILL');await exited;}
      fs.closeSync(witness);fs.closeSync(gate);await session.close();
    }
  }
  for(const kind of ['stable','change-second','rename-second']){
    const root=path.join(work,`multi-${kind}`),outside=path.join(work,`multi-outside-${kind}`),sub=path.join(outside,'sub');
    fs.mkdirSync(root);fs.mkdirSync(outside);fs.mkdirSync(sub);
    for(const name of ['a','b']){fs.writeFileSync(path.join(sub,name),'ORIGINAL');fs.utimesSync(path.join(sub,name),1700000000,1700000000);}
    const session=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const grant=session.workingDirectories(false).readHandle?.(outside);assert.ok(grant);
    const gate=fs.openSync(`${session.file}.lock.gate`,'r+');assert.equal(lock(gate,false),true);
    const witnesses=['a','b'].map(name=>fs.openSync(path.join(root,'.agent',`multi-${name}`),'wx+',0o600));
    const children=['a','b'].map((name,i)=>spawn(binary,['--checkpoint-bracket',`sub/${name}`,'--execute'],{stdio:['ignore','ignore','pipe',grant.fd,'pipe','pipe',gate,witnesses[i]]}));
    const statuses=['',''],closed=[false,false],exits=children.map((child,i)=>new Promise(resolve=>{
      child.stdio[4].on('data',x=>statuses[i]+=String(x));child.stdio[5].on('error',()=>{});
      child.once('close',(code,signal)=>{closed[i]=true;resolve({code,signal})});}));
    try{
      const deadline=Date.now()+10000;while(!statuses.every(s=>/^v[12] bracket-ready [^\n]+\n/.test(s))){
        assert.ok(Date.now()<deadline&&!closed.some(Boolean),`${kind}: ${JSON.stringify(statuses)}`);await new Promise(resolve=>setTimeout(resolve,10));}
      checkpointConversation(session,`multi-${kind}`,new AbortController().signal);
      const second=path.join(sub,'b');
      if(kind==='change-second'){fs.writeFileSync(second,'MUTATED!');fs.utimesSync(second,1700000000,1700000000);}
      if(kind==='rename-second'){fs.renameSync(second,`${second}-other`);fs.renameSync(`${second}-other`,second);}
      for(const child of children)child.stdio[5].end('c');
      const outcomes=await Promise.all(exits),codes=outcomes.map(x=>x.code);
      assert.deepEqual(codes,kind==='stable'?[0,0]:kind==='change-second'?[0,1]:[1,1]);
      results.push({kind:`multi-${kind}`,codes});
    }finally{
      for(const [i,child] of children.entries())if(!closed[i])child.kill('SIGKILL');
      await Promise.all(exits);for(const fd of witnesses)fs.closeSync(fd);fs.closeSync(gate);await session.close();
    }
  }
  const root=path.join(work,'owner-workspace'),outside=path.join(work,'owner-outside');fs.mkdirSync(root);fs.mkdirSync(outside);
  fs.mkdirSync(path.join(outside,'sub'));for(const name of ['a','b'])fs.writeFileSync(path.join(outside,'sub',name),'ORIGINAL');
  const ownerProgram=`import fs from 'node:fs';import {spawn} from 'node:child_process';
    import {Session} from ${JSON.stringify(pathToFileURL(path.join(project,'dist/session.js')).href)};
    import {defaultConfig} from ${JSON.stringify(pathToFileURL(path.join(project,'dist/agent.js')).href)};
    import {lock} from ${JSON.stringify(pathToFileURL(path.join(project,'dist/skill-effects.js')).href)};
    const [root,outside,binary]=process.argv.slice(1),s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const gate=fs.openSync(s.file+'.lock.gate','r+'),grant=s.workingDirectories(false).readHandle(outside);
    const witnesses=['a','b'].map(name=>fs.openSync(root+'/.agent/witness-'+name,'wx+',0o600));
    if(!lock(gate,false))throw Error('gate unavailable');
    const children=['a','b'].map((name,i)=>spawn(binary,['--checkpoint-bracket','sub/'+name,'--execute'],{stdio:['ignore','ignore','ignore',grant.fd,'pipe',i?8:5,gate,witnesses[i]]}));
    let ready=0;const buffers=['',''],seen=[false,false];for(const [i,child] of children.entries())child.stdio[4].on('data',data=>{
      buffers[i]+=String(data);if(!seen[i]&&buffers[i].includes('bracket-ready ')&&buffers[i].includes('\\n')){seen[i]=true;if(++ready===2)
      fs.writeSync(1,'ready '+s.id+' '+children[0].pid+' '+children[1].pid+'\\n')}});
    await new Promise(()=>{});`;
  const owner=spawn(process.execPath,['--input-type=module','-e',ownerProgram,root,outside,binary],{cwd:project,stdio:['ignore','pipe','pipe','ignore','ignore','pipe','ignore','ignore','pipe']});
  let output='',errors='',helperPids=[];owner.stdout.on('data',x=>output+=String(x));owner.stderr.on('data',x=>errors+=String(x));
  const exit=once(owner,'exit');
  const controls=[owner.stdio[5],owner.stdio[8]],closedControls=controls.map(control=>new Promise(resolve=>{
    control.once('end',resolve);control.once('close',resolve);control.resume();}));
  try {
    const limit=Date.now()+10000;while(!/ready [a-f0-9-]{36} [0-9]+ [0-9]+\n/.test(output)){
      assert.ok(Date.now()<limit&&owner.exitCode===null&&owner.signalCode===null,`owner: ${output} ${errors}`);await new Promise(resolve=>setTimeout(resolve,10));}
    const match=/ready ([a-f0-9-]{36}) ([0-9]+) ([0-9]+)\n/.exec(output);assert.ok(match);helperPids=[Number(match[2]),Number(match[3])];
    owner.kill('SIGKILL');await exit;assert.throws(()=>Session.open(root,{id:match[1],recoverLock:true}),/Session lock busy/);
    controls[0].end('c');let timer;
    try{await Promise.race([closedControls[0],new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('first helper did not exit')),5000)})]);}
    finally{clearTimeout(timer)}
    helperPids[0]=0;assert.throws(()=>Session.open(root,{id:match[1],recoverLock:true}),/Session lock busy/);
    controls[1].end('c');let reopened;
    const deadline=Date.now()+10000;while(!reopened){try{reopened=Session.open(root,{id:match[1],recoverLock:true});}
      catch(error){if(!String(error).includes('Session lock busy')||Date.now()>=deadline)throw error;await new Promise(resolve=>setTimeout(resolve,10));}}
    await reopened.close();helperPids[1]=0;
  } finally {
    if(owner.exitCode===null&&owner.signalCode===null){owner.kill('SIGKILL');await exit.catch(()=>{});}
    for(const helperPid of helperPids)if(helperPid){try{process.kill(helperPid,'SIGKILL');}catch{}}
  }
  const abandonedRoot=path.join(work,'abandoned-workspace'),abandonedOutside=path.join(work,'abandoned-outside');
  fs.mkdirSync(abandonedRoot);fs.mkdirSync(abandonedOutside);
  for(const name of ['a','b'])fs.writeFileSync(path.join(abandonedOutside,name),'ORIGINAL');
  const session=Session.open(abandonedRoot,{config:{...defaultConfig(abandonedRoot,[]),model:'fixture'}});
  session.adoptPermissionUpdates([{type:'addDirectories',directories:[abandonedOutside],destination:'session'}]);
  const ids=[randomUUID(),randomUUID()],fds=ids.map(id=>fs.openSync(`${session.file}.snapshot-unknown-${id}`,'wx+',0o600));
  const contender=fs.openSync(`${session.file}.lock.gate`,'r+'),helpers=[],originalSpawn=childProcess.spawn;
  childProcess.spawn=function(...args){const child=originalSpawn.apply(this,args);
    if(args[0]===binary&&args[1]?.[0]==='--checkpoint-bracket')helpers.push({child,exit:new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})))});
    return child;};
  syncBuiltinESMExports();let brackets=[];
  try{
    const signal=new AbortController().signal;
    brackets=await Promise.all(['a','b'].map((name,i)=>session.beginDirectoryCheckpointBracket({id:ids[i],root:abandonedOutside,
      lexicalPath:path.join(abandonedOutside,name),destinationFd:fds[i],signal})));
    assert.deepEqual(brackets.map(bracket=>bracket.kind),['ready','ready']);assert.equal(helpers.length,2);
    checkpointConversation(session,'abandoned-helpers',signal);assert.equal(lock(contender,false),false);
    helpers[0].child.kill('SIGKILL');assert.equal((await helpers[0].exit).signal,'SIGKILL');
    await new Promise(resolve=>setImmediate(resolve));assert.equal(lock(contender,false),false);
    helpers[1].child.kill('SIGKILL');assert.equal((await helpers[1].exit).signal,'SIGKILL');
    const deadline=Date.now()+5000;let acquired=false;
    while(!(acquired=lock(contender,false))&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(acquired,true,'gate remains locked after both abandoned helpers exit');assert.equal(session.isOpen,true);
    assert.deepEqual((await Promise.all(brackets.map(bracket=>bracket.finish()))).map(result=>result.kind),['unknown','unknown']);
  }finally{
    for(const helper of helpers)if(helper.child.exitCode===null&&helper.child.signalCode===null)helper.child.kill('SIGKILL');
    await Promise.all(helpers.map(helper=>helper.exit));await Promise.all(brackets.map(bracket=>bracket.kind==='ready'?bracket.cancel():undefined));
    fs.closeSync(contender);for(const fd of fds)fs.closeSync(fd);await session.close();
    childProcess.spawn=originalSpawn;syncBuiltinESMExports();
  }
  const sessionRoot=path.join(work,'session-owner-workspace'),sessionOutside=path.join(work,'session-owner-outside');
  fs.mkdirSync(sessionRoot);fs.mkdirSync(sessionOutside);
  for(const name of ['a','b'])fs.writeFileSync(path.join(sessionOutside,name),'ORIGINAL');
  const sessionOwnerProgram=`import childProcess from 'node:child_process';import fs from 'node:fs';import path from 'node:path';
    import {randomUUID} from 'node:crypto';import {syncBuiltinESMExports} from 'node:module';
    const [root,outside,binary,sessionModule,agentModule,rewindModule]=process.argv.slice(1),helpers=[],original=childProcess.spawn;
    childProcess.spawn=function(...args){const child=original.apply(this,args);if(args[0]===binary&&args[1]?.[0]==='--checkpoint-bracket')helpers.push(child);return child};
    syncBuiltinESMExports();const {Session}=await import(sessionModule),{defaultConfig}=await import(agentModule),{checkpointConversation}=await import(rewindModule);
    const s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const ids=[randomUUID(),randomUUID()],fds=ids.map(id=>fs.openSync(s.file+'.snapshot-unknown-'+id,'wx+',0o600)),signal=new AbortController().signal;
    const brackets=await Promise.all(['a','b'].map((name,i)=>s.beginDirectoryCheckpointBracket({id:ids[i],root:outside,lexicalPath:path.join(outside,name),destinationFd:fds[i],signal})));
    if(brackets.some(bracket=>bracket.kind!=='ready')||helpers.length!==2)throw Error('Session brackets unavailable');
    checkpointConversation(s,'owner-death',signal);fs.writeSync(1,'ready '+s.id+' '+helpers[0].pid+' '+helpers[1].pid+'\\n');await new Promise(()=>{});`;
  const sessionOwner=spawn(process.execPath,['--input-type=module','-e',sessionOwnerProgram,sessionRoot,sessionOutside,binary,
    pathToFileURL(path.join(project,'dist/session.js')).href,pathToFileURL(path.join(project,'dist/agent.js')).href,
    pathToFileURL(path.join(project,'dist/rewind.js')).href],{cwd:project,stdio:['ignore','pipe','pipe']});
  let ownerOutput='',ownerErrors='',sessionHelpers=[];sessionOwner.stdout.on('data',data=>ownerOutput+=String(data));sessionOwner.stderr.on('data',data=>ownerErrors+=String(data));
  const sessionOwnerExit=once(sessionOwner,'exit');
  const processState=pid=>{const result=childProcess.spawnSync('ps',['-o','state=','-p',String(pid)],{encoding:'utf8',timeout:5000});return result.status===0?result.stdout.trim():'';};
  try{
    let deadline=Date.now()+10000;while(!/ready [a-f0-9-]{36} [0-9]+ [0-9]+\n/.test(ownerOutput)){
      assert.ok(Date.now()<deadline&&sessionOwner.exitCode===null&&sessionOwner.signalCode===null,`Session owner: ${ownerOutput} ${ownerErrors}`);
      await new Promise(resolve=>setTimeout(resolve,10));}
    const ready=/ready ([a-f0-9-]{36}) ([0-9]+) ([0-9]+)\n/.exec(ownerOutput);assert.ok(ready);sessionHelpers=[Number(ready[2]),Number(ready[3])];
    for(const pid of sessionHelpers)process.kill(pid,'SIGSTOP');
    deadline=Date.now()+5000;while(!sessionHelpers.every(pid=>processState(pid).startsWith('T'))){
      assert.ok(Date.now()<deadline,'Session helpers did not stop');await new Promise(resolve=>setTimeout(resolve,10));}
    sessionOwner.kill('SIGKILL');await sessionOwnerExit;assert.throws(()=>Session.open(sessionRoot,{id:ready[1],recoverLock:true}),/Session lock busy/);
    process.kill(sessionHelpers[0],'SIGCONT');deadline=Date.now()+5000;
    while(processState(sessionHelpers[0])&&!processState(sessionHelpers[0]).startsWith('Z')){
      assert.ok(Date.now()<deadline,'first Session helper did not exit');await new Promise(resolve=>setTimeout(resolve,10));}
    sessionHelpers[0]=0;assert.throws(()=>Session.open(sessionRoot,{id:ready[1],recoverLock:true}),/Session lock busy/);
    process.kill(sessionHelpers[1],'SIGCONT');let reopened;deadline=Date.now()+10000;
    while(!reopened){try{reopened=Session.open(sessionRoot,{id:ready[1],recoverLock:true});}
      catch(error){if(!String(error).includes('Session lock busy')||Date.now()>=deadline)throw error;await new Promise(resolve=>setTimeout(resolve,10));}}
    await reopened.close();sessionHelpers[1]=0;
  }finally{
    if(sessionOwner.exitCode===null&&sessionOwner.signalCode===null){sessionOwner.kill('SIGKILL');await sessionOwnerExit.catch(()=>{});}
    for(const pid of sessionHelpers)if(pid){try{process.kill(pid,'SIGKILL');}catch{}}
  }
  const replacedRoot=path.join(work,'replaced-gate-workspace'),replacedOutside=path.join(work,'replaced-gate-outside');
  fs.mkdirSync(replacedRoot);fs.mkdirSync(replacedOutside);
  for(const name of ['a','b'])fs.writeFileSync(path.join(replacedOutside,name),'ORIGINAL');
  const replacedOwner=spawn(process.execPath,['--input-type=module','-e',sessionOwnerProgram,replacedRoot,replacedOutside,binary,
    pathToFileURL(path.join(project,'dist/session.js')).href,pathToFileURL(path.join(project,'dist/agent.js')).href,
    pathToFileURL(path.join(project,'dist/rewind.js')).href],{cwd:project,stdio:['ignore','pipe','pipe']});
  let replacedOutput='',replacedErrors='',replacedHelpers=[];replacedOwner.stdout.on('data',data=>replacedOutput+=String(data));
  replacedOwner.stderr.on('data',data=>replacedErrors+=String(data));const replacedOwnerExit=once(replacedOwner,'exit');
  try{
    let deadline=Date.now()+10000;while(!/ready [a-f0-9-]{36} [0-9]+ [0-9]+\n/.test(replacedOutput)){
      assert.ok(Date.now()<deadline&&replacedOwner.exitCode===null&&replacedOwner.signalCode===null,`replacement owner: ${replacedErrors}`);
      await new Promise(resolve=>setTimeout(resolve,10));}
    const ready=/ready ([a-f0-9-]{36}) ([0-9]+) ([0-9]+)\n/.exec(replacedOutput);assert.ok(ready);replacedHelpers=[Number(ready[2]),Number(ready[3])];
    for(const pid of replacedHelpers)process.kill(pid,'SIGSTOP');deadline=Date.now()+5000;
    while(!replacedHelpers.every(pid=>processState(pid).startsWith('T'))){assert.ok(Date.now()<deadline,'replacement helpers did not stop');await new Promise(resolve=>setTimeout(resolve,10));}
    const lockPath=path.join(replacedRoot,'.agent',`${ready[1]}.jsonl.lock`),gatePath=`${lockPath}.gate`,lockBytes=fs.readFileSync(lockPath);
    fs.renameSync(gatePath,`${gatePath}-original`);fs.writeFileSync(gatePath,'',{mode:0o600});replacedOwner.kill('SIGKILL');await replacedOwnerExit;
    let unexpected,failed;try{unexpected=Session.open(replacedRoot,{id:ready[1],recoverLock:true});}catch(error){failed=error;}
    if(unexpected)await unexpected.close();assert.match(String(failed),/Session lock gate changed/);
    assert.deepEqual(fs.readFileSync(lockPath),lockBytes);fs.unlinkSync(gatePath);fs.renameSync(`${gatePath}-original`,gatePath);
    assert.throws(()=>Session.open(replacedRoot,{id:ready[1],recoverLock:true}),/Session lock busy/);
    for(const pid of replacedHelpers)process.kill(pid,'SIGCONT');let reopened;deadline=Date.now()+10000;
    while(!reopened){try{reopened=Session.open(replacedRoot,{id:ready[1],recoverLock:true});}
      catch(error){if(!String(error).includes('Session lock busy')||Date.now()>=deadline)throw error;await new Promise(resolve=>setTimeout(resolve,10));}}
    await reopened.close();replacedHelpers=[];
  }finally{
    if(replacedOwner.exitCode===null&&replacedOwner.signalCode===null){replacedOwner.kill('SIGKILL');await replacedOwnerExit.catch(()=>{});}
    for(const pid of replacedHelpers)if(pid){try{process.kill(pid,'SIGKILL');}catch{}}
  }
  success=true;console.log(JSON.stringify({results,ownerDeath:'gate held until both helpers exit',abandonedHelpers:'gate released after both helpers exit',
    sessionOwnerDeath:'Session gate held until both stopped helpers exit',replacedGate:'recovery fenced until original gate is restored'}));
} finally { if(success)fs.rmSync(work,{recursive:true,force:true});else console.error('fixture retained:',work); }
