import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { Session } from '../dist/session.js';
import { defaultConfig } from '../dist/agent.js';
import { createTools } from '../dist/tools.js';
import { lock } from '../dist/skill-effects.js';

const project = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'directory-owner-gate-'));
const helper = path.join(work, 'writer-test');
execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper,
  path.join(project, 'native/directory-write/write.c')]);

const ownerProgram = `import fs from 'node:fs';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import path from 'node:path';
import {Session} from './dist/session.js';import {defaultConfig} from './dist/agent.js';import {createTools} from './dist/tools.js';import {lock} from './dist/skill-effects.js';
 import {copyStableDirectoryFile,publishDirectoryFile,removeDirectoryFile,publishRetainedDirectoryFile,observeRetainedDirectoryFile} from './dist/directory-file-state.js';
const [root,outside,helper,hold,action]=process.argv.slice(1),tools=createTools();
const s=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture-model',permissions:{mode:'bypass',allow:[],deny:[]}}});
s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
const grant=s.workingDirectories(false).readHandle(outside),gate=fs.openSync(s.file+'.lock.gate','r+');
if(hold==='yes'&&!lock(gate,false))throw Error('gate busy');
const dest=await fs.promises.open(path.join(root,'backup'),'wx+',0o600);
const backup=await copyStableDirectoryFile({fd:grant.fd,relative:'data'},dest,new AbortController().signal);await dest.close();
 const id='a2127b3a-3b32-4b24-b93b-c3194004f5d4',backupFd=fs.openSync(path.join(root,'backup'),'r');let held;
 if(action==='observe'){const result=publishRetainedDirectoryFile({fd:grant.fd,relative:'data',expected:backup.metadata,expectedFd:backupFd,content:Buffer.from('NEW'),transactionId:id});
   if(result.kind!=='durable')throw Error('retained setup '+result.kind);held=result.held;}
const native=childProcess.spawnSync;
childProcess.spawnSync=(file,args,options)=>{const stdio=[...options.stdio];stdio[5]=5;stdio[6]??='ignore';
  return native(helper,args,{...options,stdio,env:{...process.env,DIRECTORY_WRITE_TEST_POINT:action==='quarantine'?'remove_after_capture':action==='observe'?'observe_retained_after_read':'after_recheck',DIRECTORY_WRITE_TEST_CONTROL_STATUS:'1'}})};
syncBuiltinESMExports();process.stdout.write('owner '+s.id+'\\n');
if(action==='quarantine') removeDirectoryFile({fd:grant.fd,relative:'data',expected:backup.metadata,expectedBytes:Buffer.from('OLD'),transactionId:'a2127b3a-3b32-4b24-b93b-c3194004f5d4',...(hold==='yes'?{leaseFd:gate}:{})});
 else if(action==='observe') observeRetainedDirectoryFile({fd:grant.fd,relative:'data',expected:held,expectedFd:backupFd,transactionId:id,...(hold==='yes'?{leaseFd:gate}:{})});
else publishDirectoryFile({fd:grant.fd,relative:'data',expected:backup.metadata,content:Buffer.from('NEW'),...(hold==='yes'?{leaseFd:gate}:{})});
throw Error('owner returned before barrier');`;

const results = {};
try {
  for (const action of ['publish', 'quarantine', ...(process.platform === 'darwin' ? ['observe'] : [])]) for (const hold of ['no', 'yes']) {
    const root = path.join(work, `root-${action}-${hold}`), outside = path.join(work, `outside-${action}-${hold}`);
    fs.mkdirSync(root); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'data'), 'OLD');
    const owner = spawn(process.execPath, ['--input-type=module', '-e', ownerProgram, root, outside, helper, hold, action],
      { cwd: project, stdio: ['ignore', 'pipe', 'pipe', 'ignore', 'ignore', 'pipe'] });
    let output = '', controlOutput = '', errors = '', writerPid = 0;
    owner.stdout.setEncoding('utf8'); owner.stderr.setEncoding('utf8');
    owner.stdout.on('data', chunk => { output += chunk; }); owner.stderr.on('data', chunk => { errors += chunk; });
    const control = owner.stdio[5];
    control.setEncoding('utf8'); control.on('data', chunk => { controlOutput += chunk; });
    const helperExited = new Promise(resolve => { control.once('end', resolve); control.once('close', resolve); });
    const exited = once(owner, 'exit');
    try {
      const deadline = Date.now() + 10000;
      const barrier = action === 'quarantine' ? 'remove_after_capture' : action === 'observe' ? 'observe_retained_after_read' : 'after_recheck';
      while (!new RegExp(`test ${barrier} [0-9]+\\n`).test(controlOutput) || !/owner [a-f0-9-]{36}\n/.test(output)) {
        assert.ok(Date.now() < deadline && owner.exitCode === null && owner.signalCode === null, `owner stalled: ${errors}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const match = /owner ([a-f0-9-]{36})\n/.exec(output), helperMatch = new RegExp(`test ${barrier} ([0-9]+)\\n`).exec(controlOutput);
      assert.ok(match, output); assert.ok(helperMatch, controlOutput);
      const id = match[1]; writerPid = Number(helperMatch[1]);
      owner.kill('SIGKILL'); await exited;
      if (hold === 'yes') assert.throws(() => Session.open(root, { id, recoverLock: true }), /Session lock busy/);
      else { const reopened = Session.open(root, { id, recoverLock: true }); await reopened.close(); }
      control.end('c');
      if (hold === 'yes') {
        let reopened;
        const limit = Date.now() + 10000;
        while (!reopened) {
          try { reopened = Session.open(root, { id, recoverLock: true }); }
          catch (error) {
            if (!String(error).includes('Session lock busy') || Date.now() >= limit) throw error;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
        await reopened.close();
      }
      let timer;
      try { await Promise.race([helperExited, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('writer did not exit')), 5000); })]); }
      finally { clearTimeout(timer); }
      writerPid = 0;
      if (action === 'quarantine') {
        assert.equal(fs.existsSync(path.join(outside, 'data')), false);
        assert.equal(fs.readFileSync(path.join(outside, '.litcode-remove-a2127b3a-3b32-4b24-b93b-c3194004f5d4', 'held'), 'utf8'), 'OLD');
      } else if (action === 'observe') {
        assert.equal(fs.readFileSync(path.join(outside, 'data'), 'utf8'), 'NEW');
        assert.equal(fs.readFileSync(path.join(outside, '.litcode-replace-a2127b3a-3b32-4b24-b93b-c3194004f5d4', 'held'), 'utf8'), 'OLD');
      } else assert.equal(fs.readFileSync(path.join(outside, 'data'), 'utf8'), 'OLD');
      results[action] ??= {};
      results[action][hold] = hold === 'yes' ? 'rebind blocked until helper exit' : 'rebind succeeded while helper was held';
    } finally {
      if (owner.exitCode === null && owner.signalCode === null) { owner.kill('SIGKILL'); await exited.catch(() => {}); }
      if (writerPid) { try { process.kill(writerPid, 'SIGKILL'); } catch { /* helper already exited */ } }
    }
  }
  const reopenRoot = path.join(work, 'same-id-reopen'); fs.mkdirSync(reopenRoot);
  const owner = Session.open(reopenRoot, { config: { ...defaultConfig(reopenRoot, createTools()), model: 'fixture-model' } });
  const gate = fs.openSync(`${owner.file}.lock.gate`, 'r+');
  const reopen = `import {Session} from './dist/session.js';try{const s=Session.open(process.argv[1],{id:process.argv[2]});await s.close();process.stdout.write('opened')}
    catch(error){if(!String(error).includes('Session lock busy'))throw error;process.stdout.write('blocked')}`;
  try {
    assert.equal(lock(gate, false), true);
    await owner.close();
    assert.equal(fs.existsSync(`${owner.file}.lock`), false);
    const runReopen = () => execFileSync(process.execPath, ['--input-type=module', '-e', reopen, reopenRoot, owner.id], { cwd: project, encoding: 'utf8', timeout: 10000 });
    assert.equal(runReopen(), 'blocked');
    assert.throws(() => Session.open(reopenRoot, { id: owner.id }), /Session lock busy/);
    fs.closeSync(gate);
    assert.equal(runReopen(), 'opened');
    results.sameIdGate = { concurrent: 'blocked while held', freshOpen: 'blocked while held', afterRelease: 'opened' };
  } finally {
    try { fs.closeSync(gate); } catch { /* gate already closed */ }
    await owner.close();
  }
  const handoffWriter = `import fs from 'node:fs';import {Session} from './dist/session.js';import {defaultConfig} from './dist/agent.js';
    import {createTools} from './dist/tools.js';import {createRuntime} from './dist/runtime.js';
    const [root,outside,stage]=process.argv.slice(1),tools=createTools(),config={...defaultConfig(root,tools),model:'fixture-model'};
    const provider={count:async()=>1,complete:async()=>{throw Error('unexpected provider')}};
    const runtime=await createRuntime(config,provider,new AbortController().signal),s=Session.open(root,{config});await runtime.bindSession(s);
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    s.append({kind:'message',message:{role:'user',content:'DURABLE_FIXTURE'}});s.append({kind:'message',message:{role:'assistant',content:'done'}});s.append({kind:'turn_end',reason:'end_turn'});
    const retained=Session.open(root,{config:s.snapshotConfig()});retained.carryPermissions(s);const recovery=s.prepareRewindRecovery(retained);
    await runtime.releaseSession(s.id);
    const stop=()=>{fs.writeSync(1,'barrier '+s.id+' '+retained.id+'\\n');process.kill(process.pid,'SIGSTOP')};
    const open=Session.openInternal;Session.openInternal=function(...args){if(args[2]&&stage==='before-open')stop();const next=open.apply(this,args);if(args[2]&&stage==='after-open')stop();return next};
    const close=Session.prototype.close;Session.prototype.close=function(...args){const result=close.apply(this,args);if(this===s&&stage==='after-old-close')stop();return result};
    await recovery.restore();throw Error('handoff did not stop');`;
  const handoffReader = `import {Session} from './dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
    process.stdout.write(JSON.stringify({messages:s.messages,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
  results.handoffCrash = {};
  for (const stage of ['before-open', 'after-open', 'after-old-close']) {
    const root = path.join(work, `handoff-${stage}`), outside = path.join(work, `handoff-outside-${stage}`);
    fs.mkdirSync(root); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'data'), 'ORIGINAL');
    const child = spawn(process.execPath, ['--input-type=module', '-e', handoffWriter, root, outside, stage], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
    const exited = once(child, 'exit');
    try {
      const deadline = Date.now() + 10000;
      while (!/barrier [a-f0-9-]{36} [a-f0-9-]{36}\n/.test(output)) {
        assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, `${stage}: ${errors}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const match = /barrier ([a-f0-9-]{36}) ([a-f0-9-]{36})\n/.exec(output); assert.ok(match);
      const id = match[1], journalPath = path.join(root, '.agent', `${id}.jsonl`), journal = fs.readFileSync(journalPath);
      child.kill('SIGKILL'); const [code, signal] = await exited; assert.equal(code, null); assert.equal(signal, 'SIGKILL');
      fs.writeFileSync(path.join(outside, 'data'), 'AFTER_CRASH');
      for (let i = 0; i < 2; i++) {
        const cold = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', handoffReader, root, id, outside], { cwd: project, encoding: 'utf8', timeout: 10000 }));
        assert.equal(cold.grant, false); assert.match(JSON.stringify(cold.messages), /DURABLE_FIXTURE/);
        assert.deepEqual(fs.readFileSync(journalPath), journal);
      }
      assert.equal(fs.readFileSync(path.join(outside, 'data'), 'utf8'), 'AFTER_CRASH');
      results.handoffCrash[stage] = 'original journal, no runtime grant';
    } finally {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited.catch(() => {}); }
    }
  }
  console.log(JSON.stringify({ result: 'passed', comparison: results }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
