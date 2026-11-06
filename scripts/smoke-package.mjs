import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : os.tmpdir(), "harness-package-")));
const artifacts = path.join(temporary, "artifacts"), install = path.join(temporary, "install");
const run = (command, args, cwd, timeout = 60000) => execFileSync(command, args, { cwd, encoding: "utf8", timeout,
  maxBuffer: 4 * 1024 * 1024, env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" } });
packageSmoke: try {
  fs.mkdirSync(artifacts); fs.mkdirSync(install);
  const sourceBundle = path.join(temporary, 'source-bundle');
  run(process.execPath, [path.join(root, 'scripts/source-bundle.mjs'), sourceBundle], root);
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(sourceBundle, 'source-manifest.json'), 'utf8'));
  const nativeFiles = sourceManifest.files.filter(file => file.path.startsWith('native/'));
  assert.deepEqual(nativeFiles.map(file => file.path).sort(), [
    'native/directory-read/read.c', 'native/directory-write/write.c', 'native/file-lock/lock.c', 'native/peer-identity/peer.c', 'native/shell-supervisor/supervisor.c',
  ]);
  for (const record of nativeFiles) {
    const bytes = fs.readFileSync(path.join(sourceBundle, record.path));
    assert.equal(bytes.length, record.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.deepEqual(bytes, fs.readFileSync(path.join(root, record.path)));
  }
  run("npm", ["run", "build"], root, 180000);
  const [packed] = JSON.parse(run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", artifacts], root));
  assert.ok(packed.files.some(file => file.path === "dist/cli.js"));
  assert.ok(packed.files.some(file => file.path === "bin/personal-harness.mjs"));
  assert.ok(packed.files.some(file => file.path === "bin/litcode.mjs"));
  assert.ok(packed.files.some(file => file.path === "bin/litcode-magpie.mjs"));
  assert.ok(packed.files.some(file => file.path === "NOTICE.md"));
  assert.ok(packed.files.some(file => file.path === "THIRD_PARTY_NOTICES.txt"));
  assert.equal(packed.files.some(file => /^(?:extracted[^/]*|research|test|\.agent|\.harness|src)\//.test(file.path)), false);
  assert.deepEqual(packed.files.filter(file => file.path.startsWith('scripts/')).map(file => file.path), ['scripts/build-native.mjs']);
  assert.equal(packed.files.some(file => file.path.endsWith('.node')), false);
  const archive = path.join(artifacts, packed.filename);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const locked = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const dependency = { [manifest.name]: `file:${archive}` };
  fs.writeFileSync(path.join(install, "package.json"), JSON.stringify({ private: true, dependencies: dependency }));
  fs.writeFileSync(path.join(install, "package-lock.json"), JSON.stringify({
    lockfileVersion: locked.lockfileVersion, requires: true,
    packages: {
      ...locked.packages,
      "": { dependencies: dependency },
      [`node_modules/${manifest.name}`]: {
        version: manifest.version, resolved: dependency[manifest.name], integrity: packed.integrity,
        license: manifest.license, dependencies: manifest.dependencies, bin: manifest.bin, engines: manifest.engines, hasInstallScript: true,
      },
    },
  }));
  run("npm", ["ci", "--offline", "--omit=dev"], install);
  const installedPackage = path.join(install, 'node_modules', manifest.name);
  assert.ok(fs.existsSync(path.join(installedPackage, 'native/file-lock/lock.node')));
  assert.ok(fs.existsSync(path.join(installedPackage, 'native/directory-read/read')));
  assert.ok(fs.existsSync(path.join(installedPackage, 'native/directory-write/write')));
  assert.ok(packed.files.some(file => file.path === 'native/directory-write/write.c'));
  assert.equal(packed.files.some(file => file.path === 'native/directory-write/write'), false);
  assert.ok(packed.files.some(file => file.path === 'native/directory-read/read.c'));
  assert.equal(packed.files.some(file => file.path === 'native/directory-read/read'), false);
  const nativeTarget = path.join(install, 'native-write.txt'), nativeDirectory = fs.openSync(install, fs.constants.O_RDONLY);
  try {
    fs.writeFileSync(nativeTarget, 'OLD', { mode: 0o751 });
    const nativeWrite = (bytes, content) => spawnSync(path.join(installedPackage, 'native/directory-write/write'), ['native-write.txt', String(bytes)], {
      cwd: install, input: content, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe', nativeDirectory, 'pipe'], timeout: 10000,
    });
    const written = nativeWrite(3, 'NEW');
    assert.equal(written.status, 0, written.stderr); assert.match(written.output[4], /renamed\nlanded v2:[^\n]+\ndurable\n/);
    assert.equal(fs.readFileSync(nativeTarget, 'utf8'), 'NEW'); assert.equal(fs.statSync(nativeTarget).mode & 0o7777, 0o751);
    const partial = nativeWrite(4, 'bad');
    assert.notEqual(partial.status, 0); assert.match(partial.output[4], /error not_renamed/);
    assert.equal(fs.readFileSync(nativeTarget, 'utf8'), 'NEW'); assert.equal(fs.statSync(nativeTarget).mode & 0o7777, 0o751);
    const adapter = `import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {randomUUID} from 'node:crypto';
      const [root,reader,module]=process.argv.slice(1),{parseStableDirectoryBackupStatus,publishDirectoryFile,removeDirectoryFile}=await import(module),fd=fs.openSync(root,'r');
      try{const read=spawnSync(reader,['--backup','native-write.txt'],{stdio:['ignore','pipe','pipe',fd,'pipe']});if(read.status!==0)throw Error('backup helper failed');
        const expected=parseStableDirectoryBackupStatus({status:read.output[4].toString(),bytes:read.stdout.length});
        const published=publishDirectoryFile({fd,relative:'native-write.txt',expected,content:Buffer.from('ADAPTER')});
        if(published.kind!=='durable'||published.observation.mode!==0o751||fs.readFileSync(root+'/native-write.txt','utf8')!=='ADAPTER')throw Error('installed adapter failed');
        const stale=publishDirectoryFile({fd,relative:'native-write.txt',expected,content:Buffer.from('STALE')});if(stale.kind!=='not_published')throw Error('stale observation accepted');
        const id=randomUUID(),removed=removeDirectoryFile({fd,relative:'native-write.txt',expected:published.observation,expectedBytes:Buffer.from('ADAPTER'),transactionId:id});
        if(removed.kind!=='quarantined'||removed.transactionId!==id||fs.existsSync(root+'/native-write.txt')||fs.readFileSync(root+'/.litcode-remove-'+id+'/held','utf8')!=='ADAPTER')throw Error('installed removal failed');
        process.stdout.write(JSON.stringify({durable:true,staleRejected:true,removed:true}));}finally{fs.closeSync(fd)}`;
    const adapted = spawnSync(process.execPath, ['--input-type=module', '-e', adapter, install,
      path.join(installedPackage, 'native/directory-read/read'), pathToFileURL(path.join(installedPackage, 'dist/directory-file-state.js')).href],
    { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(adapted.status, 0, adapted.stderr);
    assert.deepEqual(JSON.parse(adapted.stdout), { durable: true, staleRejected: true, removed: true });
    console.log(JSON.stringify({ installedDirectoryWriter: 'passed', modePreserved: true, incompleteInputRefused: true, installedAdapter: true, installedRemoval: true }));
  } finally { fs.closeSync(nativeDirectory); }
  const sessionModule = pathToFileURL(path.join(installedPackage, 'dist/session.js')).href;
  const agentModule = pathToFileURL(path.join(installedPackage, 'dist/agent.js')).href;
  const toolsModule = pathToFileURL(path.join(installedPackage, 'dist/tools.js')).href;
  const writeIdentityFixture = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {bindRuntimeTool,createTools} from ${JSON.stringify(toolsModule)};
    const [root,outside,scenario]=process.argv.slice(1),file=path.join(outside,'value'),marker=path.join(root,'replacement-effect');
    const builtin=createTools().find(tool=>tool.schema.name==='write_file');if(!builtin)throw Error('builtin Write missing');
    const replacement=async()=>{fs.writeFileSync(marker,'UNEXPECTED');throw Error('write_file: writes through additional directory grants are not implemented')};
    const wrapper=bindRuntimeTool(builtin,{checkScope(){},refresh(){if(scenario==='inner')builtin.execute=replacement},checkJournal(){}}),tools=[wrapper];
    const session=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture-model',permissions:{mode:'bypass',allow:[],deny:[]}}});
    if(scenario==='outer')wrapper.executeBlocks=replacement;
    const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    let n=0;const provider={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):
      message([{type:'tool_use',id:'installed-swapped-write',name:'write_file',input:{path:file,content:'NO',overwrite:true}}],'tool_use')};
    try{session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);await new Agent(session,provider,tools).run('write fixture');
      const effect=session.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='installed-swapped-write');
      process.stdout.write(JSON.stringify({id:session.id,error:effect?.result.content,marker:fs.existsSync(marker),bytes:fs.readFileSync(file,'utf8')}))}
    finally{await session.close()}`;
  const writeIdentityReader = `import {Session} from ${JSON.stringify(sessionModule)};const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
    const effect=s.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='installed-swapped-write');
    process.stdout.write(JSON.stringify({error:effect?.result.content,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (const scenario of ['inner', 'outer']) {
    const writeIdentityRoot = path.join(temporary, `write-identity-${scenario}`), writeIdentityOutside = path.join(temporary, `write-identity-outside-${scenario}`);
    fs.mkdirSync(writeIdentityRoot); fs.mkdirSync(writeIdentityOutside); fs.writeFileSync(path.join(writeIdentityOutside, 'value'), 'INSTALLED_ORIGINAL');
    const writeIdentity = spawnSync(process.execPath, ['--input-type=module', '-e', writeIdentityFixture, writeIdentityRoot, writeIdentityOutside, scenario],
      { cwd: install, encoding: 'utf8', timeout: 15000 });
    assert.equal(writeIdentity.status, 0, writeIdentity.stderr);
    const writeIdentityResult = JSON.parse(writeIdentity.stdout);
    const error = `Runtime built-in write_file ${scenario === 'inner' ? 'implementation' : 'wrapper'} changed`;
    assert.deepEqual({ error: writeIdentityResult.error, marker: writeIdentityResult.marker, bytes: writeIdentityResult.bytes },
      { error, marker: false, bytes: 'INSTALLED_ORIGINAL' });
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', writeIdentityReader, writeIdentityRoot, writeIdentityResult.id, writeIdentityOutside],
        { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { error, grant: false });
    }
  }
  console.log(JSON.stringify({ installedBuiltinWriteIdentity: 'passed', replacementsPrevented: ['inner', 'outer'], coldProcessesPerCase: 2 }));
  const runtimeOwnerModule = pathToFileURL(path.join(installedPackage, 'dist/runtime.js')).href;
  const runtimeOwnerRoot = path.join(temporary, 'runtime-owner-workspace'), runtimeOwnerOutside = path.join(temporary, 'runtime-owner-outside');
  fs.mkdirSync(runtimeOwnerRoot); fs.mkdirSync(runtimeOwnerOutside); fs.writeFileSync(path.join(runtimeOwnerOutside, 'value'), 'OWNER_ORIGINAL');
  const runtimeOwnerFixture = `import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {createRuntime,pinToolSchemas} from ${JSON.stringify(runtimeOwnerModule)};
    const [root,outside]=process.argv.slice(1),file=path.join(outside,'value'),config=defaultConfig(root,[]);
    config.model='fixture-model';config.permissions={mode:'bypass',allow:[],deny:[]};
    const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    let n=0;const provider={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):
      message([{type:'tool_use',id:'installed-owner-write',name:'write_file',input:{path:file,content:'NO',overwrite:true}}],'tool_use')};
    const runtime=await createRuntime(config,provider,new AbortController().signal);config.tools=pinToolSchemas(runtime.tools);
    const session=Session.open(root,{config});try{await runtime.bindSession(session);session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      await new Agent(session,provider,runtime.buildTools(session.config,session.id)).run('owner fixture');
      const start=session.events.find(event=>event.kind==='tool_start'&&event.id==='installed-owner-write');
      const effect=session.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='installed-owner-write');
      process.stdout.write(JSON.stringify({id:session.id,owner:start?.runtimeWriteOwner,error:effect?.result.content,
        execution:session.events.filter(event=>event.kind==='runtime_write_execution'&&event.id==='installed-owner-write'),
        backup:session.events.some(event=>event.kind==='directory_backup'&&event.toolUseId==='installed-owner-write')}))}
    finally{await session.close();await runtime.close()}`;
  const runtimeOwner = spawnSync(process.execPath, ['--input-type=module', '-e', runtimeOwnerFixture, runtimeOwnerRoot, runtimeOwnerOutside],
    { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(runtimeOwner.status, 0, runtimeOwner.stderr);
  const runtimeOwnerResult = JSON.parse(runtimeOwner.stdout);
  assert.equal(runtimeOwnerResult.owner?.owner, runtimeOwnerResult.id);
  assert.match(runtimeOwnerResult.owner?.incarnation ?? '', /^[0-9a-f-]{36}$/);
  assert.equal(runtimeOwnerResult.error, 'write_file: writes through additional directory grants are not implemented');
  assert.equal(runtimeOwnerResult.backup, true);
  assert.deepEqual(runtimeOwnerResult.execution.map(row => ({ phase: row.phase, outcome: row.outcome ?? null })), [
    { phase: 'entered', outcome: null }, { phase: 'completed', outcome: 'blocked-additional-directory' },
  ]);
  assert.ok(runtimeOwnerResult.execution.every(row => row.id === 'installed-owner-write' &&
    row.runtimeWriteOwner.owner === runtimeOwnerResult.id && row.runtimeWriteOwner.incarnation === runtimeOwnerResult.owner.incarnation));
  const runtimeOwnerReader = `import {Session} from ${JSON.stringify(sessionModule)};const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
    const start=s.events.find(event=>event.kind==='tool_start'&&event.id==='installed-owner-write');
    process.stdout.write(JSON.stringify({owner:start?.runtimeWriteOwner,
      execution:s.events.filter(event=>event.kind==='runtime_write_execution'&&event.id==='installed-owner-write'),
      grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', runtimeOwnerReader, runtimeOwnerRoot, runtimeOwnerResult.id, runtimeOwnerOutside],
      { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { owner: runtimeOwnerResult.owner, execution: runtimeOwnerResult.execution, grant: false });
  }
  console.log(JSON.stringify({ installedRuntimeWriteOwner: 'passed', execution: 'entered-and-completed', coldProcesses: 2 }));
  const releaseBackgroundModule = pathToFileURL(path.join(installedPackage, 'dist/background.js')).href;
  const releaseRoot = path.join(temporary, 'release-workspace'); fs.mkdirSync(releaseRoot);
  const releaseFixture = `import assert from 'node:assert/strict';import{Session}from ${JSON.stringify(sessionModule)};
    import{Agent,defaultConfig}from ${JSON.stringify(agentModule)};import{createRuntime,pinToolSchemas}from ${JSON.stringify(runtimeOwnerModule)};
    import{BackgroundRegistry}from ${JSON.stringify(releaseBackgroundModule)};
    const root=process.argv[1],config=defaultConfig(root,[]);config.model='fixture';config.allowShell=true;config.features={tasks:false,subagents:false,background:true};
    config.permissions={mode:'bypass',allow:[],deny:[]};let n=0;
    const provider={count:async()=>1,complete:async()=>{const first=n++===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',
      content:first?[{type:'tool_use',id:'installed-release-background',name:'run_background',input:{command:'printf installed-release'}}]:[{type:'text',text:'done'}],
      stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}}};
    const signal=new AbortController().signal,runtime=await createRuntime(config,provider,signal);config.tools=pinToolSchemas(runtime.tools);
    const session=Session.open(root,{config}),close=BackgroundRegistry.prototype.close;let second,early,acknowledged=false,failureAck=false;
    try{await runtime.bindSession(session);await new Agent(session,provider,runtime.buildTools(session.config,session.id)).run('release fixture');
      BackgroundRegistry.prototype.close=async function(){second=runtime.releaseSession(session.id,()=>{acknowledged=true});
        await new Promise(resolve=>setImmediate(resolve));early=acknowledged;await close.call(this)};
      await runtime.releaseSession(session.id);assert.ok(second);await second;assert.equal(early,false);assert.equal(acknowledged,true);
      BackgroundRegistry.prototype.close=close;await runtime.bindSession(session);
      const tool=runtime.buildTools(session.config,session.id).find(tool=>tool.schema.name==='run_background');assert.ok(tool);
      await tool.execute({command:'printf failure-control'},{session,workspace:root,signal,allowShell:true,maxOutputBytes:24000});
      BackgroundRegistry.prototype.close=async function(){await close.call(this);throw Error('installed cleanup failure')};
      await assert.rejects(runtime.releaseSession(session.id,()=>{failureAck=true}),/Runtime cleanup incomplete/);
      await assert.rejects(runtime.releaseSession(session.id,()=>{failureAck=true}),/Runtime cleanup incomplete/);
      assert.throws(()=>runtime.buildTools(session.config,session.id),/cleanup.*unconfirmed/);
      await assert.rejects(runtime.bindSession(session),/cleanup.*unconfirmed/);
      process.stdout.write(JSON.stringify({id:session.id,early,acknowledged,failureAck,retained:true}));
    }finally{BackgroundRegistry.prototype.close=close;await runtime.close();await session.close()}`;
  const releaseCheck = spawnSync(process.execPath, ['--input-type=module', '-e', releaseFixture, releaseRoot],
    { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(releaseCheck.status, 0, releaseCheck.stderr);
  const releaseResult = JSON.parse(releaseCheck.stdout);
  assert.deepEqual({ early: releaseResult.early, acknowledged: releaseResult.acknowledged, failureAck: releaseResult.failureAck,
    retained: releaseResult.retained }, { early: false, acknowledged: true, failureAck: false, retained: true });
  const releaseReader = `import{Session}from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({starts:s.events.filter(e=>e.kind==='tool_start'&&e.id==='installed-release-background').length,
      results:s.events.filter(e=>e.kind==='tool_result'&&e.result.tool_use_id==='installed-release-background').length}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', releaseReader, releaseRoot, releaseResult.id],
      { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { starts: 1, results: 1 });
  }
  console.log(JSON.stringify({ installedOwnerRelease: 'passed', concurrent: true, failedRebindBlocked: true, coldProcesses: 2 }));
  const hookRoot = path.join(temporary, 'hook-correlation-workspace'); fs.mkdirSync(hookRoot);
  const hookFixture = `import fs from 'node:fs';import path from 'node:path';import{Session}from ${JSON.stringify(sessionModule)};
    import{Agent,defaultConfig}from ${JSON.stringify(agentModule)};import{createRuntime,pinToolSchemas}from ${JSON.stringify(runtimeOwnerModule)};
    const root=process.argv[1],command='printf "{}"',config=defaultConfig(root,[]);config.model='fixture';
    config.permissions={mode:'bypass',allow:[],deny:[]};config.features={tasks:false,subagents:false,background:false};
    config.hooks={PreToolUse:[{command}],PostToolUse:[{command,async:true}],FileChanged:[{command}]};let n=0;
    const provider={count:async()=>1,complete:async()=>{const step=n++,first=step%2===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',
      content:first?[{type:'tool_use',id:'installed-correlated-write',name:'write_file',input:{path:step===0?'one.txt':'two.txt',content:'INSTALLED_HOOK'}}]:[{type:'text',text:'done'}],
      stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}}};
    const runtime=await createRuntime(config,provider,new AbortController().signal);config.tools=pinToolSchemas(runtime.tools);const session=Session.open(root,{config});
    try{await runtime.bindSession(session);const agent=new Agent(session,provider,runtime.buildTools(config,session.id),{hookOptions:runtime.hookOptions(config,session.id)});
      await agent.run('first installed hook');await agent.run('second installed hook');await runtime.releaseSession(session.id,()=>{});
      process.stdout.write(JSON.stringify({id:session.id,calls:session.events.filter(e=>e.kind==='hook_start').map(e=>({call:e.toolUseId,parent:e.parentMessageId})),
        jobs:session.events.filter(e=>e.kind==='hook_result'&&e.event==='PostToolUse').map(e=>e.backgroundTasks),
        bytes:['one.txt','two.txt'].map(file=>fs.readFileSync(path.join(root,file),'utf8'))}));
    }finally{await runtime.close();await session.close()}`;
  const hookCheck = spawnSync(process.execPath, ['--input-type=module', '-e', hookFixture, hookRoot],
    { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(hookCheck.status, 0, hookCheck.stderr);
  const hookResult = JSON.parse(hookCheck.stdout);
  assert.deepEqual(hookResult.bytes, ['INSTALLED_HOOK', 'INSTALLED_HOOK']);
  assert.equal(hookResult.calls.length, 6);
  assert.ok(hookResult.calls.every(call => call.call === 'installed-correlated-write'));
  const hookParents = [...new Set(hookResult.calls.map(call => call.parent))];
  assert.equal(hookParents.length, 2);
  for (const parent of hookParents) assert.match(parent, /^[0-9a-f-]{36}$/);
  assert.deepEqual(hookResult.calls.map(call => call.parent), hookParents.flatMap(parent => [parent, parent, parent]));
  assert.equal(hookResult.jobs.length, 2);
  for (const ids of hookResult.jobs) { assert.equal(ids.length, 1); assert.match(ids[0], /^[0-9a-f-]{36}$/); }
  assert.notEqual(hookResult.jobs[0][0], hookResult.jobs[1][0]);
  const hookReader = `import{Session}from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({calls:s.events.filter(e=>e.kind==='hook_start').map(e=>({call:e.toolUseId,parent:e.parentMessageId})),
      jobs:s.events.filter(e=>e.kind==='hook_result'&&e.event==='PostToolUse').map(e=>e.backgroundTasks)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', hookReader, hookRoot, hookResult.id],
      { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { calls: hookResult.calls, jobs: hookResult.jobs });
  }
  console.log(JSON.stringify({ installedHookCorrelation: 'passed', calls: 2, reusedToolId: true, coldProcesses: 2 }));
  const callbackModule = pathToFileURL(path.join(installedPackage, 'dist/async-hooks.js')).href;
  const callbackRoot = path.join(temporary, 'callback-workspace'); fs.mkdirSync(callbackRoot);
  const callbackFixture = `import fs from 'node:fs';import path from 'node:path';import{AsyncHookRegistry}from ${JSON.stringify(callbackModule)};
    const root=process.argv[1],marker=path.join(root,'callback-effect'),payload={cwd:root};let release;
    const gate=new Promise(resolve=>release=resolve),registry=new AsyncHookRegistry({workspace:root,onResult:async()=>{await gate;fs.writeFileSync(marker,'LATE_INSTALLED_EFFECT')}});
    try{const id=await registry.start({definition:{command:'true',async:true},event:'PostToolUse',payload,cwd:root,
      input:JSON.stringify({...payload,hook_event_name:'PostToolUse'})+'\\n',timeoutMs:10000,signal:new AbortController().signal});
      const result=await registry.wait(id),afterWait=registry.get(id).callbackState;await registry.close();
      const afterClose=registry.get(id).callbackState,beforeEffect=fs.existsSync(marker);release();await new Promise(resolve=>setImmediate(resolve));
      process.stdout.write(JSON.stringify({process:result.state,afterWait,afterClose,beforeEffect,afterCallback:registry.get(id).callbackState,effect:fs.readFileSync(marker,'utf8')}));
    }finally{release();await registry.close()}`;
  const callbackCheck = spawnSync(process.execPath, ['--input-type=module', '-e', callbackFixture, callbackRoot],
    { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(callbackCheck.status, 0, callbackCheck.stderr);
  assert.deepEqual(JSON.parse(callbackCheck.stdout), { process: 'completed', afterWait: 'pending', afterClose: 'pending',
    beforeEffect: false, afterCallback: 'returned', effect: 'LATE_INSTALLED_EFFECT' });
  console.log(JSON.stringify({ installedCallbackSettlement: 'passed', boundedCloseCanRemainPending: true, lateReturnObserved: true }));
  const publication = `import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    const [root,outside,variant]=process.argv.slice(1),target=path.join(outside,'value'),tools=createTools(),tool=tools.find(x=>x.schema.name==='write_file'),execute=tool.execute;
    tool.execute=async(input,ctx)=>{try{return await execute(input,ctx)}catch(error){if(!String(error).includes('writes through additional directory grants are not implemented'))throw error;
      const b=variant!=='missing'?ctx.session.directoryBackups.at(-1):ctx.session.events.findLast(row=>row.kind==='directory_missing_backup'),grant=ctx.session.workingDirectories(false).readHandle(outside);
      const result=ctx.session.publishDirectoryFileTransaction({toolUseId:ctx.toolUseId,backupId:b.id,grant,lexicalPath:target,content:Buffer.from(input.content),signal:ctx.signal,
        authorizationSignal:ctx.authorizationIdentity.signal,approvalCall:ctx.pathApprovalCall,authorization:ctx.directoryPublicationAuthorization,
        ...(variant==='retained'?{strategy:'retained'}:{})});
      if(result.kind!=='durable')throw Error('publication '+result.kind);return 'published';}};
    const s=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture-model',permissions:{mode:'bypass',allow:[],deny:[]}}});
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);let n=0;
    const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    const provider={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):message([{type:'tool_use',id:'write',name:'write_file',input:{path:target,content:'PUBLISHED',...(variant!=='missing'?{overwrite:true}:{})}}],'tool_use')};
    await new Agent(s,provider,tools).run('write fixture');const h=s.directoryFileHistory,ref=h.kind==='available'&&h.snapshots[0]?.entries[0]?.reference,p=s.directoryPublications[0],messageId=h.kind==='available'&&h.snapshots[0]?.messageId;
    const selected=s.selectDirectoryRewindSnapshot(messageId);
    const expected=variant==='retained'?'present':variant;
    if(ref?.kind!==expected||p?.kind!=='durable'||selected.kind!=='available'||selected.entries[0]?.reference.kind!==expected||
      (variant==='retained'&&!p.retained))throw Error('installed publication unavailable');
    const observed=variant==='retained'?s.observeRetainedDirectoryPublication({id:p.id,grant:s.workingDirectories(false).readHandle(outside),signal:new AbortController().signal}).kind:null;
    if(variant==='retained'&&observed!=='observed')throw Error('installed retained observation unavailable');
    process.stdout.write(JSON.stringify({id:s.id,publication:p.id,messageId,backup:ref.kind==='present'?s.readDirectoryHistoryBackup(ref.backupId)?.bytes.toString():null,
      retained:p.retained?.held.ino??null,observed}));await s.close();`;
  const publicationReader = `import {Session} from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    const selection=s.selectDirectoryRewindSnapshot(process.argv[3]),publications=s.directoryPublications.map(x=>({id:x.id,kind:x.kind,retained:x.retained?.held.ino??null}));
    let observed=null;if(process.argv[5]==='retained'){const signal=new AbortController().signal,grant=()=>s.workingDirectories(false).readHandle(process.argv[4]);
      const before=s.observeRetainedDirectoryPublication({id:process.argv[6],grant:grant(),signal}).kind;
      s.adoptPermissionUpdates([{type:'addDirectories',directories:[process.argv[4]],destination:'session'}]);
      observed={before,after:s.observeRetainedDirectoryPublication({id:process.argv[6],grant:grant(),signal}).kind};}
    process.stdout.write(JSON.stringify({publications,selected:selection.kind==='available'&&selection.entries[0]?.reference.kind,observed}));await s.close();`;
  const publicationVariants = ['present', 'missing', ...(process.platform === 'darwin' ? ['retained'] : [])];
  for (const variant of publicationVariants) {
    const publicationRoot = path.join(temporary, `publication-workspace-${variant}`), publicationOutside = path.join(temporary, `publication-outside-${variant}`);
    fs.mkdirSync(publicationRoot); fs.mkdirSync(publicationOutside);
    if (variant !== 'missing') fs.writeFileSync(path.join(publicationOutside, 'value'), 'ORIGINAL', { mode: 0o751 });
    const originalInode = variant === 'retained' ? String(fs.statSync(path.join(publicationOutside, 'value'), { bigint: true }).ino) : null;
    const published = spawnSync(process.execPath, ['--input-type=module', '-e', publication, publicationRoot, publicationOutside, variant], { cwd: install, encoding: 'utf8', timeout: 15000 });
    assert.equal(published.status, 0, published.stderr);
    const publicationResult = JSON.parse(published.stdout);
    assert.equal(publicationResult.backup, variant !== 'missing' ? 'ORIGINAL' : null); assert.equal(publicationResult.retained, originalInode);
    assert.equal(publicationResult.observed, variant === 'retained' ? 'observed' : null);
    assert.equal(fs.readFileSync(path.join(publicationOutside, 'value'), 'utf8'), 'PUBLISHED');
    assert.equal(fs.statSync(path.join(publicationOutside, 'value')).mode & 0o7777, variant !== 'missing' ? 0o751 : 0o666 & ~process.umask());
    if (variant === 'retained') assert.equal(fs.readFileSync(path.join(publicationOutside, `.litcode-replace-${publicationResult.publication}`, 'held'), 'utf8'), 'ORIGINAL');
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', publicationReader, publicationRoot, publicationResult.id, publicationResult.messageId,
        publicationOutside, variant, publicationResult.publication], { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { publications: [{ id: publicationResult.publication, kind: 'durable', retained: originalInode }],
        selected: variant === 'retained' ? 'present' : variant, observed: variant === 'retained' ? { before: 'unknown', after: 'observed' } : null });
    }
  }
  console.log(JSON.stringify({ installedDirectoryTransaction: 'passed', targets: publicationVariants, coldProcessesPerTarget: 2 }));
  const rewindModule = pathToFileURL(path.join(installedPackage, 'dist/rewind.js')).href;
  const checkpointModule = pathToFileURL(path.join(installedPackage, 'dist/checkpoints.js')).href;
  const sessionsModule = pathToFileURL(path.join(installedPackage, 'dist/sessions.js')).href;
  const associationOwner = `import {Session} from ${JSON.stringify(sessionModule)};import {defaultConfig} from ${JSON.stringify(agentModule)};
    import {checkpointConversation} from ${JSON.stringify(rewindModule)};const root=process.argv[1],s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    checkpointConversation(s,'shared',new AbortController().signal);await s.close();`;
  const associationWriter = `import fs from 'node:fs';import {Session} from ${JSON.stringify(sessionModule)};import {defaultConfig} from ${JSON.stringify(agentModule)};
    import {checkpointConversation} from ${JSON.stringify(rewindModule)};const [root,marker,cut]=process.argv.slice(1),s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    const pause=()=>{fs.writeFileSync(marker,s.id);process.kill(process.pid,'SIGSTOP')};
    if(cut==='intent'){const rename=fs.renameSync,sync=fs.fsyncSync;let armed=false;
      fs.renameSync=function(from,to){const result=rename.apply(this,arguments);if(String(to).includes('/.assoc-'))armed=true;return result};
      fs.fsyncSync=function(fd){const result=sync.call(this,fd);if(armed)pause();return result};}
    else{const append=s.append.bind(s);s.append=function(event,...args){if(event.kind==='checkpoint')pause();return append(event,...args)}}
    checkpointConversation(s,'shared',new AbortController().signal);throw Error('checkpoint barrier missed');`;
  const associationReader = `import {Session} from ${JSON.stringify(sessionModule)};const [root,id,mode]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:mode==='recover'});
    const event=s.events.find(row=>row.kind==='checkpoint'&&row.name==='shared');process.stdout.write(JSON.stringify({digest:event?.digest??null}));await s.close();`;
  const associationCold = (root, id, mode) => {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', associationReader, root, id, mode], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr); return JSON.parse(reader.stdout);
  };
  const startAssociationWriter = async (root, marker, cut) => {
    const writer = spawn(process.execPath, ['--input-type=module', '-e', associationWriter, root, marker, cut], { cwd: install, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = ''; writer.stderr.on('data', bytes => { stderr += bytes; });
    const exited = new Promise((resolve, reject) => { writer.once('error', reject); writer.once('close', (code, signal) => resolve({ code, signal })); });
    const deadline = Date.now() + 15000;
    try {
      while (!fs.existsSync(marker) || !spawnSync('ps', ['-o', 'state=', '-p', String(writer.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
        assert.ok(Date.now() < deadline && writer.exitCode === null && writer.signalCode === null, stderr);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return { writer, exited, id: fs.readFileSync(marker, 'utf8') };
    } catch (error) { writer.kill('SIGKILL'); await exited; throw error; }
  };
  const killAssociationWriter = async stopped => {
    stopped.writer.kill('SIGKILL'); const exit = await stopped.exited; assert.equal(exit.signal, 'SIGKILL');
  };
  for (const order of ['existing', 'concurrent']) {
    const associationRoot = path.join(temporary, `association-${order}`), marker = path.join(temporary, `association-${order}.marker`);
    fs.mkdirSync(associationRoot); fs.writeFileSync(path.join(associationRoot, 'value'), 'ORIGINAL');
    if (order === 'existing') run(process.execPath, ['--input-type=module', '-e', associationOwner, associationRoot], install);
    const stopped = await startAssociationWriter(associationRoot, marker, 'intent');
    try {
      if (order === 'concurrent') run(process.execPath, ['--input-type=module', '-e', associationOwner, associationRoot], install);
      const store = path.join(associationRoot, '.agent/checkpoints'), intent = fs.readdirSync(store).find(name => name.startsWith('.assoc-'));
      assert.ok(intent); const journal = path.join(associationRoot, '.agent', `${stopped.id}.jsonl`), before = fs.readFileSync(journal);
      await killAssociationWriter(stopped);
      for (const mode of ['recover', 'open']) {
        assert.deepEqual(associationCold(associationRoot, stopped.id, mode), { digest: null });
        assert.deepEqual(fs.readFileSync(journal), before); assert.ok(fs.existsSync(path.join(store, intent)));
      }
    } finally { if (stopped.writer.exitCode === null && stopped.writer.signalCode === null) await killAssociationWriter(stopped); }
  }
  const associationRoot = path.join(temporary, 'association-objects'), marker = path.join(temporary, 'association-objects.marker');
  fs.mkdirSync(associationRoot); fs.writeFileSync(path.join(associationRoot, 'value'), 'ORIGINAL');
  const stopped = await startAssociationWriter(associationRoot, marker, 'append');
  try {
    const store = path.join(associationRoot, '.agent/checkpoints'), intentName = fs.readdirSync(store).find(name => name.startsWith('.assoc-'));
    assert.ok(intentName); const intentPath = path.join(store, intentName), intent = JSON.parse(fs.readFileSync(intentPath, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(store, 'manifests/shared.json'), 'utf8'));
    assert.deepEqual(manifest.association, { id: intent.id, session: stopped.id, boundary: intent.boundary });
    const entry = manifest.entries.find(item => item.path === 'value' && item.kind === 'file'); assert.ok(entry);
    const object = path.join(store, 'objects', entry.sha256), bytes = fs.readFileSync(object);
    await killAssociationWriter(stopped);
    for (const [state, mode] of [['missing', 'recover'], ['corrupt', 'open']]) {
      if (state === 'missing') fs.unlinkSync(object); else fs.writeFileSync(object, 'CORRUPT');
      assert.deepEqual(associationCold(associationRoot, stopped.id, mode), { digest: null }); assert.ok(fs.existsSync(intentPath));
      fs.writeFileSync(object, bytes);
    }
    for (const mode of ['open', 'open']) assert.deepEqual(associationCold(associationRoot, stopped.id, mode), { digest: manifest.digest });
    assert.equal(fs.existsSync(intentPath), false);
  } finally { if (stopped.writer.exitCode === null && stopped.writer.signalCode === null) await killAssociationWriter(stopped); }
  console.log(JSON.stringify({ installedCheckpointAssociation: 'passed', sameName: ['existing', 'concurrent'], objects: ['missing', 'corrupt', 'restored'], coldProcesses: true }));
  const syncRoot = path.join(temporary, 'association-sync-failure'); fs.mkdirSync(syncRoot);
  fs.writeFileSync(path.join(syncRoot, 'value'), 'ORIGINAL');
  const syncWriter = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    import {defaultConfig} from ${JSON.stringify(agentModule)};import {checkpointConversation} from ${JSON.stringify(rewindModule)};
    const root=process.argv[1],s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}}),rename=fs.renameSync,sync=fs.fsyncSync;
    const manifest=path.join(root,'.agent/checkpoints/manifests/sync.json');let armed=false,injected=false;
    fs.renameSync=function(from,to){const result=rename.apply(this,arguments);if(String(to)===manifest)armed=true;return result};
    fs.fsyncSync=function(fd){if(armed){armed=false;injected=true;throw Error('manifest sync failure')}return sync.call(this,fd)};
    try{checkpointConversation(s,'sync',new AbortController().signal);throw Error('sync failure missed')}
    catch(error){if(!injected||!String(error).includes('manifest sync failure'))throw error}
    fs.writeSync(1,JSON.stringify({id:s.id}));process.kill(process.pid,'SIGKILL');`;
  const syncWriterResult = spawnSync(process.execPath, ['--input-type=module', '-e', syncWriter, syncRoot], { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(syncWriterResult.signal, 'SIGKILL', syncWriterResult.stderr); const syncId = JSON.parse(syncWriterResult.stdout).id;
  const syncStore = path.join(syncRoot, '.agent/checkpoints'), syncIntent = fs.readdirSync(syncStore).find(name => name.startsWith('.assoc-'));
  assert.ok(syncIntent); assert.ok(fs.existsSync(path.join(syncStore, 'manifests/sync.json')));
  const syncReader = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    const [root,id]=process.argv.slice(1),target=fs.statSync(path.join(root,'.agent/checkpoints/manifests')),sync=fs.fsyncSync;let failed=false;
    fs.fsyncSync=function(fd){const current=fs.fstatSync(fd);if(!failed&&current.isDirectory()&&current.dev===target.dev&&current.ino===target.ino){failed=true;throw Error('recovery sync failure')}return sync.call(this,fd)};
    const s=Session.open(root,{id,recoverLock:true});fs.fsyncSync=sync;
    process.stdout.write(JSON.stringify({failed,checkpoint:s.events.some(row=>row.kind==='checkpoint'&&row.name==='sync')}));await s.close();`;
  const failedSyncReader = spawnSync(process.execPath, ['--input-type=module', '-e', syncReader, syncRoot, syncId], { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(failedSyncReader.status, 0, failedSyncReader.stderr);
  assert.deepEqual(JSON.parse(failedSyncReader.stdout), { failed: true, checkpoint: false }); assert.ok(fs.existsSync(path.join(syncStore, syncIntent)));
  const syncSuccessReader = `import {Session} from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({count:s.events.filter(row=>row.kind==='checkpoint'&&row.name==='sync').length}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', syncSuccessReader, syncRoot, syncId], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr); assert.deepEqual(JSON.parse(reader.stdout), { count: 1 });
  }
  assert.equal(fs.existsSync(path.join(syncStore, syncIntent)), false);
  console.log(JSON.stringify({ installedCheckpointSyncRecovery: 'passed', failedWriterAndRecovery: true, successfulColdReaders: 2 }));
  const journalRoot = path.join(temporary, 'association-journal-failure'); fs.mkdirSync(journalRoot);
  fs.writeFileSync(path.join(journalRoot, 'value'), 'ORIGINAL');
  const journalWriter = `import fs from 'node:fs';import {Session} from ${JSON.stringify(sessionModule)};import {defaultConfig} from ${JSON.stringify(agentModule)};
    import {checkpointConversation} from ${JSON.stringify(rewindModule)};const root=process.argv[1],s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}}),append=s.append.bind(s);
    s.append=function(event,...args){if(event.kind==='checkpoint')throw Error('pre-append failure');return append(event,...args)};
    try{checkpointConversation(s,'journal',new AbortController().signal);throw Error('pre-append failure missed')}
    catch(error){if(!String(error).includes('pre-append failure'))throw error}
    fs.writeSync(1,JSON.stringify({id:s.id}));process.kill(process.pid,'SIGKILL');`;
  const journalWriterResult = spawnSync(process.execPath, ['--input-type=module', '-e', journalWriter, journalRoot], { cwd: install, encoding: 'utf8', timeout: 15000 });
  assert.equal(journalWriterResult.signal, 'SIGKILL', journalWriterResult.stderr); const journalId = JSON.parse(journalWriterResult.stdout).id;
  const journalStore = path.join(journalRoot, '.agent/checkpoints'), journalIntent = fs.readdirSync(journalStore).find(name => name.startsWith('.assoc-'));
  assert.ok(journalIntent);
  const journalFailureReader = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    const [root,id,stage]=process.argv.slice(1),journal=path.join(root,'.agent',id+'.jsonl'),before=fs.statSync(journal),sync=fs.fsyncSync;let injected=false,failed=false;
    fs.fsyncSync=function(fd){const current=fs.fstatSync(fd);if(!injected&&current.isFile()&&current.dev===before.dev&&current.ino===before.ino&&
      (stage==='existing'||current.size>before.size)){injected=true;throw Error('journal sync failure')}return sync.call(this,fd)};
    try{const s=Session.open(root,{id,recoverLock:stage==='append'});await s.close()}catch(error){if(!String(error).includes('journal sync failure'))throw error;failed=true}
    process.stdout.write(JSON.stringify({injected,failed}));`;
  for (const stage of ['append', 'existing']) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', journalFailureReader, journalRoot, journalId, stage], { cwd: install, encoding: 'utf8', timeout: 15000 });
    assert.equal(reader.status, 0, reader.stderr); assert.deepEqual(JSON.parse(reader.stdout), { injected: true, failed: true });
    assert.ok(fs.existsSync(path.join(journalStore, journalIntent)));
  }
  const journalSuccessReader = `import {Session} from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({count:s.events.filter(row=>row.kind==='checkpoint'&&row.name==='journal').length}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', journalSuccessReader, journalRoot, journalId], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr); assert.deepEqual(JSON.parse(reader.stdout), { count: 1 });
  }
  assert.equal(fs.existsSync(path.join(journalStore, journalIntent)), false);
  console.log(JSON.stringify({ installedCheckpointJournalRecovery: 'passed', syncFailures: ['append', 'existing'], successfulColdReaders: 2 }));
  const externalPreview = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    import {checkpointConversation,checkpointConversationWithDirectoryWitness,previewRewind,applyRewind} from ${JSON.stringify(rewindModule)};
    import {forkSession} from ${JSON.stringify(sessionsModule)};
    const [root,outside]=process.argv.slice(1),target=path.join(outside,'value'),missing=path.join(outside,'missing'),tools=createTools(),signal=new AbortController().signal;
    const s=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture',permissions:{mode:'bypass',allow:[],deny:[]}}});let next,fork;
    try{s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);checkpointConversation(s,'before-track',signal);
      let n=0;const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
      const provider={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):
        message([{type:'tool_use',id:'write',name:'write_file',input:{path:target,content:'BLOCKED',overwrite:true}},
          {type:'tool_use',id:'write-missing',name:'write_file',input:{path:missing,content:'BLOCKED'}}],'tool_use')};
      await new Agent(s,provider,tools).run('track after checkpoint');
      const tracked=await checkpointConversationWithDirectoryWitness(s,'after-track',signal);if(tracked.external_witness!=='available'||tracked.external_tracked_paths!==2)throw Error('installed witness unavailable');
      fork=forkSession(s);
      const preview=previewRewind(s,0,signal);
      if(preview.external.kind!=='unavailable'||JSON.stringify(preview.external.paths)!==JSON.stringify([missing,target].sort()))throw Error('external preview unavailable');
      next=applyRewind(s,preview,preview.token,signal);if(JSON.stringify(previewRewind(next,0,signal).external)!==JSON.stringify(preview.external))throw Error('branch uncertainty lost');
      const successor=await checkpointConversationWithDirectoryWitness(next,'after-branch',signal);
      if(successor.external_witness!=='available'||successor.external_tracked_paths!==2)throw Error('installed successor witness unavailable');
      if(fs.readFileSync(target,'utf8')!=='ORIGINAL'||fs.existsSync(missing))throw Error('external file changed');process.stdout.write(JSON.stringify({source:s.id,branch:next.id,fork:fork.id}));
    }finally{await fork?.close();await next?.close();await s.close()}`;
  const previewRoot = path.join(temporary, 'external-preview-workspace'), previewOutside = path.join(temporary, 'external-preview-outside');
  fs.mkdirSync(previewRoot); fs.mkdirSync(previewOutside); fs.writeFileSync(path.join(previewOutside, 'value'), 'ORIGINAL');
  const previewRun = spawnSync(process.execPath, ['--input-type=module', '-e', externalPreview, previewRoot, previewOutside], { cwd: install, encoding: 'utf8', timeout: 20000 });
  assert.equal(previewRun.status, 0, previewRun.stderr); const previewIds = JSON.parse(previewRun.stdout);
  fs.writeFileSync(path.join(previewOutside, 'value'), 'CHANGED'); fs.writeFileSync(path.join(previewOutside, 'missing'), 'CREATED');
  const previewReader = `import {Session} from ${JSON.stringify(sessionModule)};import {previewRewind} from ${JSON.stringify(rewindModule)};
    const s=Session.open(process.argv[1],{id:process.argv[2]});process.stdout.write(JSON.stringify({external:previewRewind(s,0,new AbortController().signal).external,
      grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
  for (const id of [previewIds.source, previewIds.branch]) for (let i = 0; i < 2; i++) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', previewReader, previewRoot, id, previewOutside], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr);
    assert.deepEqual(JSON.parse(reader.stdout), { external: { kind: 'unavailable', paths: [path.join(previewOutside, 'missing'), path.join(previewOutside, 'value')].sort() }, grant: false });
  }
  const installedWitnessReader = `import {Session} from ${JSON.stringify(sessionModule)};
    import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from ${JSON.stringify(rewindModule)};
    const [root,id,outside,name]=process.argv.slice(1),s=Session.open(root,{id}),target=outside+'/value',w=inspectDirectoryCheckpointWitness(s,name);
    process.stdout.write(JSON.stringify({kind:w.kind,present:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===target)?.observation.kind,
      missing:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===outside+'/missing')?.observation.kind,bytes:readDirectoryCheckpointBackup(s,name,target)?.toString()??null,
      grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (const [id, name] of [[previewIds.source, 'after-track'], [previewIds.fork, 'after-track'], [previewIds.branch, 'after-branch']]) for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', installedWitnessReader, previewRoot, id, previewOutside, name], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', present: 'present', missing: 'missing', bytes: 'ORIGINAL', grant: false });
  }
  const witnessDir = path.join(previewRoot, '.agent'), witnessBase = `${previewIds.source}.jsonl`;
  const witnessName = fs.readdirSync(witnessDir).find(name => name.startsWith(`${witnessBase}.checkpoint-witness-receipt-`) &&
    JSON.parse(fs.readFileSync(path.join(witnessDir, name), 'utf8')).checkpoint.name === 'after-track');
  assert.ok(witnessName); const witnessFile = path.join(witnessDir, witnessName), witnessBytes = fs.readFileSync(witnessFile);
  const alteredWitness = JSON.parse(witnessBytes.toString('utf8')), witnessEntry = alteredWitness.entries.find(entry => entry.path.lexicalPath === path.join(previewOutside, 'value'));
  assert.ok(witnessEntry); const witnessBackup = path.join(witnessDir, `${witnessBase}.snapshot-unknown-${witnessEntry.observation.backup.id}`), originalBackup = fs.readFileSync(witnessBackup);
  try {
    const forged = Buffer.alloc(originalBackup.length, 88); fs.writeFileSync(witnessBackup, forged);
    witnessEntry.observation.backup.sha256 = crypto.createHash('sha256').update(forged).digest('hex'); fs.writeFileSync(witnessFile, JSON.stringify(alteredWitness));
    for (const id of [previewIds.source, previewIds.fork]) for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', installedWitnessReader, previewRoot, id, previewOutside, 'after-track'], { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'unknown', present: false, missing: false, bytes: null, grant: false });
    }
  } finally { fs.writeFileSync(witnessBackup, originalBackup); fs.writeFileSync(witnessFile, witnessBytes); }
  console.log(JSON.stringify({ installedDirectoryCheckpointWitness: 'passed', targets: ['present', 'missing'], successorCheckpoint: 'rewind', inheritedCheckpoint: 'fork', rehashedTamperRejected: true, coldProcessesPerSession: 2 }));
  console.log(JSON.stringify({ installedExternalPreview: 'passed', sourceAndBranch: true, coldProcessesPerSession: 2 }));
  const preparedWriter = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    import {checkpointConversationWithDirectoryWitness} from ${JSON.stringify(rewindModule)};
    const [root,outside,phase]=process.argv.slice(1),target=path.join(outside,'value'),tools=createTools(),s=Session.open(root,
      {config:{...defaultConfig(root,tools),model:'fixture',permissions:{mode:'bypass',allow:[],deny:[]}}});
    fs.writeSync(1,JSON.stringify({id:s.id}));s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    let n=0;const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    const provider={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):
      message([{type:'tool_use',id:'track',name:'write_file',input:{path:target,content:'BLOCKED',overwrite:true}}],'tool_use')};
    await new Agent(s,provider,tools).run('track');const append=s.append.bind(s);
    s.append=function(event,...args){if(event.kind==='directory_checkpoint_witness'&&phase==='before')process.kill(process.pid,'SIGKILL');
      const result=append(event,...args);if(event.kind==='directory_checkpoint_witness'&&phase==='after')process.kill(process.pid,'SIGKILL');return result};
    await checkpointConversationWithDirectoryWitness(s,'prepared-crash',new AbortController().signal);throw Error('prepared witness crash missed');`;
  const preparedReader = `import {setTimeout as delay} from 'node:timers/promises';import {Session} from ${JSON.stringify(sessionModule)};
    import {forkSession} from ${JSON.stringify(sessionsModule)};import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from ${JSON.stringify(rewindModule)};
    const [root,id,outside,mode]=process.argv.slice(1);let s;const deadline=Date.now()+5000;
    while(!s){try{s=Session.open(root,{id,recoverLock:mode==='recover'})}catch(error){if(!String(error).includes('Session lock busy')||Date.now()>deadline)throw error;await delay(25)}}
    const fork=mode==='fork'?forkSession(s):undefined,current=fork??s,w=inspectDirectoryCheckpointWitness(current,'prepared-crash');
    process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(current,'prepared-crash',outside+'/value')?.toString()??null,
      grant:!!current.workingDirectories(false).readHandle?.(outside)}));await fork?.close();await s.close();`;
  for (const phase of ['before', 'after']) {
    const root = path.join(temporary, `prepared-${phase}-workspace`), outside = path.join(temporary, `prepared-${phase}-outside`);
    fs.mkdirSync(root); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'value'), 'ORIGINAL');
    const writer = spawnSync(process.execPath, ['--input-type=module', '-e', preparedWriter, root, outside, phase], { cwd: install, encoding: 'utf8', timeout: 15000 });
    assert.equal(writer.signal, 'SIGKILL', writer.stderr); const { id } = JSON.parse(writer.stdout);
    assert.ok(fs.readdirSync(path.join(root, '.agent')).some(name => name.startsWith(`${id}.jsonl.checkpoint-witness-prepared-`)));
    fs.writeFileSync(path.join(outside, 'value'), 'CHANGED');
    for (const mode of ['recover', 'source', 'fork', 'fork']) {
      const reader = spawnSync(process.execPath, ['--input-type=module', '-e', preparedReader, root, id, outside, mode], { cwd: install, encoding: 'utf8', timeout: 15000 });
      assert.equal(reader.status, 0, reader.stderr);
      assert.deepEqual(JSON.parse(reader.stdout), { kind: phase === 'after' ? 'available' : 'unknown',
        bytes: phase === 'after' ? 'ORIGINAL' : null, grant: false });
    }
  }
  console.log(JSON.stringify({ installedPreparedCheckpoint: 'passed', writerDeath: ['before', 'after'], sourceColdProcesses: 2, forkColdProcesses: 2 }));
  const bracketFixture = `import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {Session} from ${JSON.stringify(sessionModule)};
    import {defaultConfig} from ${JSON.stringify(agentModule)};import {checkpointConversation} from ${JSON.stringify(rewindModule)};
    const [root,outside,variant]=process.argv.slice(1),s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const id=randomUUID(),backup=s.file+'.snapshot-unknown-'+id,destinationFd=fs.openSync(backup,'wx+',0o600);
    let bracket;try{const signal=new AbortController().signal;
      bracket=await s.beginDirectoryCheckpointBracket({id,root:outside,lexicalPath:path.join(outside,'value'),destinationFd,signal});
      if(bracket.kind!=='ready')throw Error('installed bracket unavailable');const checkpoint=checkpointConversation(s,'installed-bracket',signal),result=await bracket.finish();
      if(result.kind!=='stable'||result.observation.kind!==variant)throw Error('installed bracket unstable');
      process.stdout.write(JSON.stringify({id:s.id,backupId:id,checkpoint:checkpoint.checkpoint_digest,kind:result.observation.kind,bytes:fs.readFileSync(backup,'utf8')}));
    }finally{if(bracket?.kind==='ready')await bracket.cancel();fs.closeSync(destinationFd);await s.close();}`;
  const bracketReader = `import {Session} from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    const checkpoint=s.events.find(e=>e.kind==='checkpoint'&&e.name==='installed-bracket');
    process.stdout.write(JSON.stringify({digest:checkpoint?.digest,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3]),
      receipted:s.events.some(e=>e.kind==='directory_snapshot_file'&&e.id===process.argv[4])}));await s.close();`;
  for (const variant of ['present', 'missing']) {
    const bracketRoot = path.join(temporary, `bracket-workspace-${variant}`), bracketOutside = path.join(temporary, `bracket-outside-${variant}`);
    fs.mkdirSync(bracketRoot); fs.mkdirSync(bracketOutside);
    if (variant === 'present') fs.writeFileSync(path.join(bracketOutside, 'value'), 'ORIGINAL', { mode: 0o751 });
    const runBracket = spawnSync(process.execPath, ['--input-type=module', '-e', bracketFixture, bracketRoot, bracketOutside, variant], { cwd: install, encoding: 'utf8', timeout: 15000 });
    assert.equal(runBracket.status, 0, runBracket.stderr); const result = JSON.parse(runBracket.stdout);
    assert.equal(result.kind, variant); assert.equal(result.bytes, variant === 'present' ? 'ORIGINAL' : '');
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', bracketReader, bracketRoot, result.id, bracketOutside, result.backupId], { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { digest: result.checkpoint, grant: false, receipted: false });
    }
  }
  console.log(JSON.stringify({ installedDirectoryBracket: 'passed', targets: ['present', 'missing'], coldProcessesPerTarget: 2, fixture: true }));
  const gateRoot = path.join(temporary, 'session-gate-workspace'); fs.mkdirSync(gateRoot);
  const gateOwner = `import fs from 'node:fs';import {Session} from ${JSON.stringify(sessionModule)};import {defaultConfig} from ${JSON.stringify(agentModule)};
    const root=process.argv[1],s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}});fs.writeSync(1,JSON.stringify({id:s.id}));process.kill(process.pid,'SIGKILL');`;
  const gateWriter = spawnSync(process.execPath, ['--input-type=module', '-e', gateOwner, gateRoot], { cwd: install, encoding: 'utf8', timeout: 10000 });
  assert.equal(gateWriter.signal, 'SIGKILL', gateWriter.stderr); const gateId = JSON.parse(gateWriter.stdout).id;
  const gateLock = path.join(gateRoot, '.agent', `${gateId}.jsonl.lock`), gatePath = `${gateLock}.gate`, gateLockBytes = fs.readFileSync(gateLock);
  const gateReader = `import {Session} from ${JSON.stringify(sessionModule)};try{const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:process.argv[3]==='recover'});
    process.stdout.write('opened');await s.close()}catch(error){process.stdout.write(String(error))}`;
  fs.renameSync(gatePath, `${gatePath}-original`); fs.writeFileSync(gatePath, '', { mode: 0o600 });
  const blockedGate = spawnSync(process.execPath, ['--input-type=module', '-e', gateReader, gateRoot, gateId, 'recover'], { cwd: install, encoding: 'utf8', timeout: 10000 });
  assert.equal(blockedGate.status, 0, blockedGate.stderr); assert.match(blockedGate.stdout, /Session lock gate changed/);
  assert.deepEqual(fs.readFileSync(gateLock), gateLockBytes); fs.unlinkSync(gatePath); fs.renameSync(`${gatePath}-original`, gatePath);
  for (const mode of ['recover', 'open']) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', gateReader, gateRoot, gateId, mode], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr); assert.equal(reader.stdout, 'opened');
  }
  console.log(JSON.stringify({ installedSessionGateReplacement: 'passed', coldProcesses: 2 }));
  const effectModule = pathToFileURL(path.join(installedPackage, 'dist/skill-effects.js')).href;
  const branchGateFixture = `import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {spawnSync} from 'node:child_process';
    import {Session} from ${JSON.stringify(sessionModule)};import {defaultConfig} from ${JSON.stringify(agentModule)};
    import {checkpointConversation,previewRewind,applyRewind} from ${JSON.stringify(rewindModule)};
    import {recoverCheckpoint} from ${JSON.stringify(checkpointModule)};import {lock} from ${JSON.stringify(effectModule)};
    const root=process.argv[1],signal=new AbortController().signal,ctx={workspace:root,signal,allowShell:false,maxOutputBytes:24000};
    const s=Session.open(root,{config:{...defaultConfig(root,[]),model:'fixture'}}),target=path.join(root,'value'),rename=fs.renameSync;let fd;
    try{fs.writeFileSync(target,'base');checkpointConversation(s,'initial',signal);fs.writeFileSync(target,'changed');const preview=previewRewind(s,0,signal);
      const pending=path.join(root,'.agent/checkpoints/transaction.json');fs.renameSync=function(from,to){if(String(to)===pending&&JSON.parse(fs.readFileSync(from,'utf8')).state==='committed')throw Error('marker failure');return rename.apply(this,arguments)};
      try{applyRewind(s,preview,preview.token,signal);throw Error('marker failure missing')}catch(error){if(!String(error).includes('history committed'))throw error}finally{fs.renameSync=rename}
      const tx=JSON.parse(fs.readFileSync(pending,'utf8')),branch=path.join(root,'.agent',tx.branch.id+'.jsonl'),gate=branch+'.lock.gate',stat=fs.statSync(gate,{bigint:true});
      const dead=spawnSync(process.execPath,['-e','process.kill(process.pid,"SIGKILL")']);if(dead.signal!=='SIGKILL')throw Error('dead owner fixture failed');
      fs.writeFileSync(branch+'.lock',JSON.stringify({pid:dead.pid,token:randomUUID(),gate:{dev:String(stat.dev),ino:String(stat.ino)}}),{mode:0o600});
      fd=fs.openSync(gate,'r+');if(!lock(fd,false))throw Error('fixture gate busy');let busy=false;
      try{recoverCheckpoint(ctx)}catch(error){busy=/branch.*gate.*busy/i.test(String(error))}if(!busy||!fs.existsSync(pending))throw Error('branch gate not fenced');
      fs.closeSync(fd);fd=undefined;if(recoverCheckpoint(ctx).recovery!=='committed'||fs.readFileSync(target,'utf8')!=='base')throw Error('branch recovery failed');
      process.stdout.write(JSON.stringify({id:tx.branch.id}));
    }finally{fs.renameSync=rename;if(fd!==undefined)fs.closeSync(fd);await s.close()}`;
  const branchGateRoot = path.join(temporary, 'branch-gate-workspace'); fs.mkdirSync(branchGateRoot);
  const branchGate = spawnSync(process.execPath, ['--input-type=module', '-e', branchGateFixture, branchGateRoot], { cwd: install, encoding: 'utf8', timeout: 20000 });
  assert.equal(branchGate.status, 0, branchGate.stderr); const branchGateId = JSON.parse(branchGate.stdout).id;
  const branchReader = `import {Session} from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({branch:s.events.some(event=>event.kind==='branch'&&event.reason==='rewind')}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', branchReader, branchGateRoot, branchGateId], { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr); assert.deepEqual(JSON.parse(reader.stdout), { branch: true });
  }
  console.log(JSON.stringify({ installedBranchGateRecovery: 'passed', coldProcesses: 2 }));
  const runtimeModule = pathToFileURL(path.join(installedPackage, 'dist/runtime.js')).href;
  const rewindRecovery = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};
    import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    import {createRuntime} from ${JSON.stringify(runtimeModule)};import {checkpointConversation,previewRewind,applyRewindAfterRelease} from ${JSON.stringify(rewindModule)};
    const [root,outside,variant]=process.argv.slice(1),tools=createTools(),config={...defaultConfig(root,tools),model:'fixture-model',permissions:{mode:'bypass',allow:[],deny:[]}};
    const target=path.join(outside,'value'),local=path.join(root,'local'),signal=new AbortController().signal;
    const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    let count=0;const provider={count:async()=>1,complete:async()=>count++?message([{type:'text',text:'done'}],'end_turn'):
      message([{type:'tool_use',id:'read',name:'read_file',input:{path:target}}],'tool_use')};
    const runtime=await createRuntime(config,provider,signal),source=Session.open(root,{config}),append=Session.prototype.append;let current=source,nextRuntime;
    try{await runtime.bindSession(source);source.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      await new Agent(source,provider,tools).run('read before rewind');checkpointConversation(source,'installed-rewind',signal);
      if(variant==='rollback'||variant==='release')fs.writeFileSync(local,'CHANGED');
      if(variant==='rollback'){Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
        if(this!==source&&event.kind==='rewind')throw Error('installed rewind append failure');return result}}
      const preview=previewRewind(source,1,signal);
      let rejected=false;try{await applyRewindAfterRelease(source,preview,preview.token,signal,async completed=>{
        if(variant==='permission')source.adoptPermissionUpdates([{type:'removeDirectories',directories:[outside],destination:'session'},{type:'addDirectories',directories:[outside],destination:'session'}]);
        await runtime.releaseSession(source.id,completed);if(variant==='stale')fs.writeFileSync(local,'CHANGED');
        if(variant==='release')throw Error('installed completed release failure')},async recovered=>{
        current=recovered;nextRuntime=await runtime.reconfigure(recovered.config);await nextRuntime.bindSession(recovered)});}catch(error){if(!String(error).includes(variant==='stale'?'preview is stale':variant==='rollback'?'installed rewind append failure':variant==='release'?'installed completed release failure':'permission state changed'))throw error;rejected=true}
      if(!rejected||source.isOpen||current.id!==source.id)throw Error('installed rewind recovery failed');
      if(variant==='stale'||variant==='rollback'||variant==='release'){if(!JSON.stringify(current.messages).includes('INSTALLED_SECRET')||fs.readFileSync(local,'utf8')!=='CHANGED'||
        fs.existsSync(path.join(root,'.agent/checkpoints/transaction.json')))throw Error('installed rewind recovery failed')}
      else{if(current.workingDirectories(false).readHandle?.(outside)||JSON.stringify(current.messages).includes('INSTALLED_SECRET'))throw Error('installed permission recovery revived an old grant');
        current.adoptPermissionUpdates([{type:'removeDirectories',directories:[outside],destination:'session'},{type:'addDirectories',directories:[outside],destination:'session'}]);
        if(!current.workingDirectories(false).readHandle?.(outside)||JSON.stringify(current.messages).includes('INSTALLED_SECRET'))throw Error('installed explicit regrant failed')}
      if(variant==='release'){fs.writeFileSync(target,'INSTALLED_AFTER_RELEASE');let calls=0;
        const retry={count:async()=>1,complete:async()=>calls++?message([{type:'text',text:'done'}],'end_turn'):
          message([{type:'tool_use',id:'read-after-release',name:'read_file',input:{path:target}}],'tool_use')};
        await new Agent(current,retry,tools).run('read after release failure');
        if(!JSON.stringify(current.messages).includes('INSTALLED_AFTER_RELEASE'))throw Error('installed release recovery read failed')}
      process.stdout.write(JSON.stringify({id:current.id,recovered:true}));}finally{Session.prototype.append=append;await nextRuntime?.close();await runtime.close();await current.close();await source.close()}`;
  const recoveryReader = `import {Session} from ${JSON.stringify(sessionModule)};const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:process.argv[4]==='recover'});
    process.stdout.write(JSON.stringify({messages:s.messages,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
  for (const variant of ['stale', 'permission', 'rollback', 'release']) {
    const recoveryRoot = path.join(temporary, `rewind-workspace-${variant}`), recoveryOutside = path.join(temporary, `rewind-outside-${variant}`);
    fs.mkdirSync(recoveryRoot); fs.mkdirSync(recoveryOutside); fs.writeFileSync(path.join(recoveryRoot, 'local'), 'ORIGINAL');
    fs.writeFileSync(path.join(recoveryOutside, 'value'), 'INSTALLED_SECRET');
    const recovered = spawnSync(process.execPath, ['--input-type=module', '-e', rewindRecovery, recoveryRoot, recoveryOutside, variant], { cwd: install, encoding: 'utf8', timeout: 20000 });
    assert.equal(recovered.status, 0, recovered.stderr);
    const recoveredResult = JSON.parse(recovered.stdout); assert.equal(recoveredResult.recovered, true);
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', recoveryReader, recoveryRoot, recoveredResult.id, recoveryOutside], { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); const projection = JSON.parse(cold.stdout);
      assert.equal(projection.grant, false); assert.doesNotMatch(JSON.stringify(projection.messages), /INSTALLED_SECRET/);
      assert.doesNotMatch(JSON.stringify(projection.messages), /INSTALLED_AFTER_RELEASE/);
    }
  }
  console.log(JSON.stringify({ installedRewindRecovery: 'passed', variants: ['stale', 'permission', 'rollback', 'release'], coldProcessesPerVariant: 2 }));
  const interactiveModule = pathToFileURL(path.join(installedPackage, 'dist/interactive.js')).href;
  const committedBindFixture = `import fs from 'node:fs';import path from 'node:path';import {PassThrough,Writable} from 'node:stream';
    import {Session} from ${JSON.stringify(sessionModule)};import {defaultConfig} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    import {createRuntime,pinToolSchemas} from ${JSON.stringify(runtimeModule)};import {checkpointConversation} from ${JSON.stringify(rewindModule)};
    import {interactiveLoop} from ${JSON.stringify(interactiveModule)};
    const [root,outside,stage]=process.argv.slice(1),local=path.join(root,'value'),external=path.join(outside,'value'),signal=new AbortController().signal,input=new PassThrough();
    const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    let calls=0,observed=false;const provider={count:async()=>1,complete:async request=>{if(!calls++)return message([{type:'tool_use',id:'after-bind',name:'read_file',input:{path:external}}],'tool_use');
      observed=JSON.stringify(request.messages).includes('INSTALLED_BIND_SECRET');setImmediate(()=>input.write('/exit\\n'));return message([{type:'text',text:'done'}],'end_turn')}};
    const config={...defaultConfig(root,createTools()),model:'fixture',permissions:{mode:'bypass',allow:[],deny:[]}},runtime=await createRuntime(config,provider,signal);
    config.tools=pinToolSchemas(runtime.tools);const source=Session.open(root,{config});
    source.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);checkpointConversation(source,'before-bind',signal);fs.writeFileSync(local,'AFTER');
    const bind=runtime.bindSession;let failed=false,applied=false,regrant=false,continued=false,text='',status='';
    runtime.bindSession=async next=>{if(stage==='old-cleanup'&&next.id!==source.id){const fresh=await runtime.reconfigure(next.config);await fresh.bindSession(next);return fresh}
      if(stage!=='accept'&&next.id!==source.id&&!failed){failed=true;if(stage==='after')await bind(next);throw Error('installed successor bind failure')}return bind(next)};
    if(stage==='accept'){const settle=runtime.settleScheduler;runtime.settleScheduler=async(owner,...args)=>{
      if(owner!==source.id&&!failed){failed=true;setImmediate(()=>input.write('continue after failed acceptance\\n'));throw Error('installed acceptance failure')}return settle(owner,...args)}}
    if(stage==='failed')runtime.closeForHandoff=async()=>{throw Error('installed cleanup failure')};
    if(stage==='old-cleanup')runtime.closeForHandoff=async()=>{failed=true;throw Error('installed old cleanup failure')};
    const output=new Writable({write(chunk,_encoding,done){text+=String(chunk);const token=/Apply: \\/rewind 0 --files --apply ([a-f0-9]{64})/.exec(text)?.[1];
      if(token&&!applied){applied=true;setImmediate(()=>input.write('/rewind 0 --files --apply '+token+'\\n'))}
      if(text.includes('Rewound files and conversation to turn 0')&&stage==='after'&&!regrant){regrant=true;setImmediate(()=>input.write('/add-dir '+outside+'\\n'))}
      if(text.includes('Rewound files and conversation to turn 0')&&(stage!=='after'||text.includes('Added '+outside))&&!continued){continued=true;setImmediate(()=>input.write('continue\\n'))}done()}});
    const errors=new Writable({write(chunk,_encoding,done){status+=String(chunk);if(status.includes('error: installed successor bind failure'))setImmediate(()=>input.write('/exit\\n'));done()}});
    let timedOut=false;const timer=setTimeout(()=>{timedOut=true;input.write('/exit\\n')},8000);
    try{input.write('/rewind 0 --files\\n');await interactiveLoop(source,provider,runtime,{input,output,status:errors,signal});
      if(timedOut||!failed||fs.readFileSync(local,'utf8')!=='BEFORE')throw Error('installed committed rewind fixture failed: '+status);
      if(stage==='failed'){if(!/Rewind committed in session [0-9a-f-]{36}; runtime recovery failed/.test(status)||calls!==0)throw Error('installed failure lost committed branch')}
      else if(stage==='accept'||stage==='old-cleanup'){if(!/Rewind committed in session [0-9a-f-]{36}; session handoff is incomplete/.test(text)||calls!==0||
        stage==='old-cleanup'&&!text.includes('handoff cleanup is unconfirmed'))throw Error('installed acceptance did not stop')}
      else if(!text.includes('Rewound files and conversation to turn 0')||calls!==2||!observed||(stage==='after'&&!text.includes('add additional directories again')))throw Error('installed bind recovery failed: '+status);
      const dir=path.join(root,'.agent'),file=fs.readdirSync(dir).filter(x=>x.endsWith('.jsonl')).find(x=>fs.readFileSync(path.join(dir,x),'utf8').includes('"reason":"rewind"'));
      if(!file)throw Error('installed committed branch missing');const id=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8').split('\\n')[0]).id;
      if(stage==='old-cleanup'&&!fs.existsSync(path.join(dir,id+'.jsonl.lock')))throw Error('installed unconfirmed owner lock missing');
      process.stdout.write(JSON.stringify({id,calls}));
    }finally{clearTimeout(timer);await runtime.close();await source.close();input.destroy()}`;
  for (const stage of ['before', 'after', 'failed', 'accept', 'old-cleanup']) {
    const recoveryRoot = path.join(temporary, `bind-workspace-${stage}`), recoveryOutside = path.join(temporary, `bind-outside-${stage}`);
    fs.mkdirSync(recoveryRoot); fs.mkdirSync(recoveryOutside); fs.writeFileSync(path.join(recoveryRoot, 'value'), 'BEFORE');
    fs.writeFileSync(path.join(recoveryOutside, 'value'), 'INSTALLED_BIND_SECRET');
    const recovered = spawnSync(process.execPath, ['--input-type=module', '-e', committedBindFixture, recoveryRoot, recoveryOutside, stage], { cwd: install, encoding: 'utf8', timeout: 20000 });
    assert.equal(recovered.status, 0, recovered.stderr); const { id } = JSON.parse(recovered.stdout);
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', recoveryReader, recoveryRoot, id, recoveryOutside,
        ...(stage === 'old-cleanup' ? ['recover'] : [])], { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); const projection = JSON.parse(cold.stdout);
      assert.equal(projection.grant, false); assert.doesNotMatch(JSON.stringify(projection.messages), /INSTALLED_BIND_SECRET/);
    }
  }
  console.log(JSON.stringify({ installedCommittedRewindBind: 'passed', stages: ['before', 'after', 'failed'], coldProcessesPerStage: 2 }));
  console.log(JSON.stringify({ installedCommittedRewindAccept: 'passed', stages: ['accept', 'old-cleanup'], coldProcessesPerStage: 2 }));
  const committedWitnessFixture = `import fs from 'node:fs';import path from 'node:path';import {PassThrough,Writable} from 'node:stream';
    import {Session} from ${JSON.stringify(sessionModule)};import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    import {forkSession} from ${JSON.stringify(sessionsModule)};
    import {createRuntime,pinToolSchemas} from ${JSON.stringify(runtimeModule)};import {checkpointConversationWithDirectoryWitness} from ${JSON.stringify(rewindModule)};
    import {interactiveLoop} from ${JSON.stringify(interactiveModule)};
    const [root,outside,stage]=process.argv.slice(1),local=path.join(root,'value'),external=path.join(outside,'value'),signal=new AbortController().signal,input=new PassThrough(),tools=createTools();
    const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    let calls=0,observed=false;const provider={count:async()=>1,complete:async request=>{if(!calls++)return message([{type:'tool_use',id:'after-inheritance',name:'read_file',input:{path:external}}],'tool_use');
      observed=JSON.stringify(request.messages).includes('INSTALLED_INHERIT_SECRET');setImmediate(()=>input.write('/exit\\n'));return message([{type:'text',text:'done'}],'end_turn')}};
    const config={...defaultConfig(root,tools),model:'fixture',permissions:{mode:'bypass',allow:[],deny:[]}},runtime=await createRuntime(config,provider,signal);
    config.tools=pinToolSchemas(runtime.tools);const parent=Session.open(root,{config}),sync=fs.fsyncSync,write=fs.writeSync,rename=fs.renameSync;let active=parent,id='',firstId='',injected=false,applied=false,regrant=false,continued=false,text='',status='';
    try{parent.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);let n=0;
      const tracker={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):
        message([{type:'tool_use',id:'track',name:'write_file',input:{path:external,content:'BLOCKED',overwrite:true}}],'tool_use')};
      await new Agent(parent,tracker,tools).run('track');const captured=await checkpointConversationWithDirectoryWitness(parent,'installed-inherit',signal);
      if(captured.external_witness!=='available')throw Error('installed source witness unavailable');const directory=path.join(root,'.agent');
      const childForFd=fd=>{const stat=fs.fstatSync(fd);for(const name of fs.readdirSync(directory).filter(x=>x.endsWith('.jsonl')&&x!==parent.id+'.jsonl')){
        const named=fs.lstatSync(path.join(directory,name));if(named.dev===stat.dev&&named.ino===stat.ino)return name.slice(0,-6)}};
      if(stage==='indirect-torn')active=forkSession(parent);
      if(stage==='repeated-torn'||stage==='post-torn'){
        fs.writeSync=new Proxy(write,{apply(target,thisArg,args){const [fd,bytes,offset,length]=args;
          if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
            firstId=childForFd(fd);fs.writeSync=write;Reflect.apply(target,thisArg,[fd,bytes,offset,Math.max(1,Math.floor(length/2))]);throw Error('installed earlier short write')}
          return Reflect.apply(target,thisArg,args)}});
        try{forkSession(parent);throw Error('installed earlier short write missed')}catch(error){if(!String(error).includes('installed earlier short write'))throw error}
        finally{fs.writeSync=write}if(!firstId)throw Error('installed earlier target missing');active=Session.open(root,{id:firstId});
        if(active.reconcileTornCheckpointInheritance(parent).kind!=='reconciled')throw Error('installed earlier reconciliation failed');
        if(stage==='post-torn'){active.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
          const later=await checkpointConversationWithDirectoryWitness(active,'installed-before-second-torn',signal);
          if(later.external_witness!=='available')throw Error('installed post-recovery checkpoint unavailable')}}
      fs.writeFileSync(local,'AFTER');
      if(stage.startsWith('marker')){const transaction=path.join(directory,'checkpoints/transaction.json');fs.renameSync=(from,to)=>{
        if(!injected&&String(to)===transaction){const saved=JSON.parse(fs.readFileSync(from,'utf8'));if(saved.state==='committed'){
          id=saved.branch.id;injected=true;fs.renameSync=rename;if(stage==='marker-conflict')fs.writeFileSync(local,'CONCURRENT');throw Error('installed marker failure')}}
        return rename(from,to)}}
      else if(stage==='torn'||stage==='indirect-torn'||stage==='repeated-torn'||stage==='post-torn')fs.writeSync=new Proxy(write,{apply(target,thisArg,args){const [fd,bytes,offset,length]=args;
        if(!injected&&Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
          id=childForFd(fd);if(!id)throw Error('installed target journal missing');injected=true;fs.writeSync=write;
          Reflect.apply(target,thisArg,[fd,bytes,offset,Math.max(1,Math.floor(length/2))]);throw Error('installed inherited witness short write')}
        return Reflect.apply(target,thisArg,args)}});
      else fs.fsyncSync=function(fd){const child=childForFd(fd);if(!injected&&child&&fs.readFileSync(path.join(directory,child+'.jsonl'),'utf8').includes('"kind":"directory_checkpoint_inheritance"')){
        id=child;injected=true;fs.fsyncSync=sync;throw Error('installed inherited witness sync failure')}return sync.call(this,fd)};
      const output=new Writable({write(chunk,_encoding,done){text+=String(chunk);const token=/Apply: \\/rewind 1 --files --apply ([a-f0-9]{64})/.exec(text)?.[1];
        if(token&&!applied){applied=true;setImmediate(()=>input.write('/rewind 1 --files --apply '+token+'\\n'))}
        if(text.includes('Rewound files and conversation to turn 1')&&!regrant){regrant=true;setImmediate(()=>input.write('/add-dir '+outside+'\\n'))}
        if(regrant&&text.includes('Added '+outside)&&!continued){continued=true;setImmediate(()=>input.write('continue\\n'))}done()}});
      const errors=new Writable({write(chunk,_encoding,done){status+=String(chunk);if(status.includes('error: Checkpoint history committed;'))setImmediate(()=>input.write('/exit\\n'));done()}});
      let timedOut=false;const timer=setTimeout(()=>{timedOut=true;input.write('/exit\\n')},8000);
      try{input.write('/rewind 1 --files\\n');await interactiveLoop(active,provider,runtime,{input,output,status:errors,signal});
        if(timedOut||!injected||!id||fs.readFileSync(local,'utf8')!==(stage==='marker-conflict'?'CONCURRENT':'BEFORE'))throw Error('installed inheritance recovery failed: '+status);
        if(stage==='sync'||stage==='torn'||stage==='indirect-torn'||stage==='repeated-torn'||stage==='post-torn'){if(!text.includes(stage==='sync'?'checkpoint witness outcome is uncertain':'checkpoint witness was reconciled')||calls!==2||!observed||
          (stage!=='sync'&&!fs.readdirSync(directory).some(name=>name.startsWith(id+'.jsonl.torn-'))))throw Error('installed inheritance continuation failed')}
        else if(stage==='marker'){if(!text.includes('checkpoint transaction was recovered')||calls!==2||!observed||fs.existsSync(path.join(directory,'checkpoints/transaction.json')))throw Error('installed marker continuation failed')}
        else if(stage==='marker-conflict'){if(!text.includes('Rewind committed in session '+id+'; checkpoint transaction and runtime recovery are uncertain')||calls!==0||
          !fs.existsSync(path.join(directory,'checkpoints/transaction.json')))throw Error('installed marker conflict was not retained')}
        process.stdout.write(JSON.stringify({id,firstId}));}finally{clearTimeout(timer)}
    }finally{fs.fsyncSync=sync;fs.writeSync=write;fs.renameSync=rename;await runtime.close();await active.close();await parent.close();input.destroy()}`;
  const committedWitnessReader = `import {Session} from ${JSON.stringify(sessionModule)};import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from ${JSON.stringify(rewindModule)};
    const [root,id,outside,name='installed-inherit']=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,name);
    process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,name,outside+'/value')?.toString()??null,
      grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  const committedWitnessNewCheckpoint = `import {Session} from ${JSON.stringify(sessionModule)};import {checkpointConversationWithDirectoryWitness} from ${JSON.stringify(rewindModule)};
    const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});try{
      s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      const result=await checkpointConversationWithDirectoryWitness(s,'installed-after-torn',new AbortController().signal);
      process.stdout.write(JSON.stringify({kind:result.external_witness}))}finally{await s.close()}`;
  const committedWitnessFork = `import {Session} from ${JSON.stringify(sessionModule)};import {forkSession} from ${JSON.stringify(sessionsModule)};
    const [root,id]=process.argv.slice(1),s=Session.open(root,{id});let a,b;
    try{a=forkSession(s);b=forkSession(a);process.stdout.write(JSON.stringify([a.id,b.id]))}
    finally{await b?.close();await a?.close();await s.close()}`;
  for (const stage of ['sync', 'torn', 'indirect-torn', 'repeated-torn', 'post-torn', 'marker', 'marker-conflict']) {
    const recoveryRoot = path.join(temporary, `witness-workspace-${stage}`), recoveryOutside = path.join(temporary, `witness-outside-${stage}`);
    fs.mkdirSync(recoveryRoot); fs.mkdirSync(recoveryOutside); fs.writeFileSync(path.join(recoveryRoot, 'value'), 'BEFORE');
    fs.writeFileSync(path.join(recoveryOutside, 'value'), 'INSTALLED_INHERIT_SECRET');
    const recovered = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessFixture, recoveryRoot, recoveryOutside, stage], { cwd: install, encoding: 'utf8', timeout: 20000 });
    assert.equal(recovered.status, 0, recovered.stderr); const { id, firstId } = JSON.parse(recovered.stdout);
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, recoveryRoot, id, recoveryOutside], { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { kind: stage === 'marker-conflict' ? 'unknown' : 'available',
        bytes: stage === 'marker-conflict' ? null : 'INSTALLED_INHERIT_SECRET', grant: false });
    }
    if (stage === 'torn' || stage === 'indirect-torn' || stage === 'repeated-torn' || stage === 'post-torn') {
      const captured = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessNewCheckpoint, recoveryRoot, id, recoveryOutside],
        { cwd: install, encoding: 'utf8', timeout: 20000 });
      assert.equal(captured.status, 0, captured.stderr); assert.deepEqual(JSON.parse(captured.stdout), { kind: 'available' });
      const forked = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessFork, recoveryRoot, id], { cwd: install, encoding: 'utf8', timeout: 20000 });
      assert.equal(forked.status, 0, forked.stderr); const descendants = JSON.parse(forked.stdout); assert.equal(descendants.length, 2);
      const names = ['installed-inherit', 'installed-after-torn', ...(stage === 'post-torn' ? ['installed-before-second-torn'] : [])];
      for (const descendant of descendants) for (const name of names) for (let i = 0; i < 2; i++) {
        const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, recoveryRoot, descendant, recoveryOutside, name],
          { cwd: install, encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr);
        assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'INSTALLED_INHERIT_SECRET', grant: false });
      }
      const directory = path.join(recoveryRoot, '.agent'), tornName = fs.readdirSync(directory).find(name => name.startsWith(`${id}.jsonl.torn-`));
      assert.ok(tornName); const tornFile = path.join(directory, tornName), tornBytes = fs.readFileSync(tornFile);
      try {
        fs.writeFileSync(tornFile, 'changed');
        for (const descendant of descendants) for (const name of names) {
          const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, recoveryRoot, descendant, recoveryOutside, name],
            { cwd: install, encoding: 'utf8', timeout: 10000 });
          assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'unknown', bytes: null, grant: false });
        }
      } finally { fs.writeFileSync(tornFile, tornBytes); }
      if (stage === 'repeated-torn' || stage === 'post-torn') {
        assert.ok(firstId); const firstName = fs.readdirSync(directory).find(name => name.startsWith(`${firstId}.jsonl.torn-`)); assert.ok(firstName);
        const firstFile = path.join(directory, firstName), firstBytes = fs.readFileSync(firstFile);
        try {
          fs.writeFileSync(firstFile, 'changed earlier evidence');
          for (const descendant of descendants) for (const name of names) {
            const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, recoveryRoot, descendant, recoveryOutside, name],
              { cwd: install, encoding: 'utf8', timeout: 10000 });
            assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'unknown', bytes: null, grant: false });
          }
        } finally { fs.writeFileSync(firstFile, firstBytes); }
      }
    }
  }
  console.log(JSON.stringify({ installedCommittedRewindWitness: 'passed', stages: ['sync', 'torn', 'indirect-torn', 'repeated-torn', 'post-torn'], coldProcessesPerStage: 2, recoveredDescendants: 2 }));
  console.log(JSON.stringify({ installedCommittedRewindMarker: 'passed', stages: ['marker', 'marker-conflict'], coldProcessesPerStage: 2 }));
  const restartedWitnessFixture = `import fs from 'node:fs';import path from 'node:path';
    import {Session} from ${JSON.stringify(sessionModule)};import {Agent,defaultConfig} from ${JSON.stringify(agentModule)};
    import {createTools} from ${JSON.stringify(toolsModule)};import {forkSession} from ${JSON.stringify(sessionsModule)};
    import {checkpointConversationWithDirectoryWitness} from ${JSON.stringify(rewindModule)};
    const [root,outside]=process.argv.slice(1),tools=createTools(),source=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture',
      permissions:{mode:'bypass',allow:[],deny:[]}}}),external=path.join(outside,'value'),directory=path.join(root,'.agent'),write=fs.writeSync;
    let id='',calls=0;const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,
      stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}),provider={count:async()=>1,complete:async()=>calls++?
      message([{type:'text',text:'done'}],'end_turn'):message([{type:'tool_use',id:'track',name:'write_file',input:{path:external,content:'BLOCKED',overwrite:true}}],'tool_use')};
    try{source.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);await new Agent(source,provider,tools).run('track');
      const captured=await checkpointConversationWithDirectoryWitness(source,'installed-inherit',new AbortController().signal);
      if(captured.external_witness!=='available')throw Error('installed restart source missing');
      fs.writeSync=new Proxy(write,{apply(target,thisArg,args){const [fd,bytes,offset,length]=args;
        if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
          const stat=fs.fstatSync(fd),file=fs.readdirSync(directory).find(name=>name.endsWith('.jsonl')&&(()=>{const s=fs.lstatSync(path.join(directory,name));return s.dev===stat.dev&&s.ino===stat.ino})());
          if(!file)throw Error('installed restart target missing');id=file.slice(0,-6);fs.writeSync=write;
          Reflect.apply(target,thisArg,[fd,bytes,offset,Math.max(1,Math.floor(length/2))]);throw Error('installed restart tear')}
        return Reflect.apply(target,thisArg,args)}});
      try{forkSession(source);throw Error('installed restart tear missed')}catch(error){if(!String(error).includes('installed restart tear'))throw error}
      if(!id)throw Error('installed restart target absent');process.stdout.write(JSON.stringify({id,sourceId:source.id}));
    }finally{fs.writeSync=write;await source.close()}`;
  const restartRoot = path.join(temporary, 'restart-witness-workspace'), restartOutside = path.join(temporary, 'restart-witness-outside');
  const restartHome = path.join(temporary, 'restart-witness-home'); fs.mkdirSync(restartRoot); fs.mkdirSync(restartOutside); fs.mkdirSync(restartHome);
  fs.writeFileSync(path.join(restartOutside, 'value'), 'INSTALLED_RESTART_SECRET');
  const preparedRestart = spawnSync(process.execPath, ['--input-type=module', '-e', restartedWitnessFixture, restartRoot, restartOutside],
    { cwd: install, encoding: 'utf8', timeout: 20000 });
  assert.equal(preparedRestart.status, 0, preparedRestart.stderr); const restartedId = JSON.parse(preparedRestart.stdout).id;
  const restartDirectory = path.join(restartRoot, '.agent'), restartOriginal = fs.readFileSync(path.join(restartDirectory, `${restartedId}.jsonl`));
  const restartArgs = [path.join(installedPackage, 'bin/litcode.mjs'), '--workspace', restartRoot, '--resume', restartedId, '--recover-lock', '--interactive', '--no-tui', '--no-inherit-gateway'];
  const textPreload = path.join(temporary, 'restart-text-provider.mjs');
  fs.writeFileSync(textPreload, `globalThis.fetch=()=>{throw Error('fixture network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(pathToFileURL(path.join(installedPackage, 'dist/provider.js')).href)});
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(_request,_signal,onText)=>{
      onText?.('fixture reply');return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'fixture reply'}],
        stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const runLaterText = (args, home) => spawnSync(process.execPath, args, { cwd: install, input: 'installed later text\n/exit\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: home, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${textPreload}` } });
  const laterHistoryFixture = `import {Session} from ${JSON.stringify(sessionModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    const [root,id]=process.argv.slice(1),session=Session.open(root,{id}),tool=createTools().find(item=>item.schema.name==='write_file');
    try{if(!tool)throw Error('write tool missing');await tool.execute({path:'installed-later.txt',content:'INSTALLED_LATER',overwrite:true},
      {session,workspace:root,signal:new AbortController().signal,allowShell:false,maxOutputBytes:24000,fileHistory:file=>session.touchFile(file)});
      const event=session.events.at(-1);session.append({kind:'session_color',color:'blue'});process.stdout.write(JSON.stringify({event,sequence:session.fileHistory.trackSequence}))}
    finally{await session.close()}`;
  const laterSnapshotFixture = `import {Session} from ${JSON.stringify(sessionModule)};import {Agent} from ${JSON.stringify(agentModule)};import {createTools} from ${JSON.stringify(toolsModule)};
    const [root,id,outside]=process.argv.slice(1),session=Session.open(root,{id}),tools=createTools(),before=session.events.length;
    const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'fixture reply'}],
      stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    try{session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      await new Agent(session,provider,tools).run('snapshot later text');const history=session.directoryFileHistory;
      process.stdout.write(JSON.stringify({kinds:session.events.slice(before).map(event=>event.kind),history:history.kind,
        entries:history.kind==='available'?history.snapshots.at(-1)?.entries:null}))}finally{await session.close()}`;
  const restartStoreLock = path.join(restartDirectory, 'checkpoints', 'lock');
  fs.writeFileSync(restartStoreLock, JSON.stringify({ pid: process.pid, token: crypto.randomUUID() }), { flag: 'wx', mode: 0o600 });
  try {
    const blocked = spawnSync(process.execPath, restartArgs, { cwd: install, input: '/rename installed-title\n/color blue\n/exit\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: restartHome, LLM_API_KEY: '', NODE_OPTIONS: '' } });
    assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout); assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/);
    assert.equal(fs.existsSync(path.join(restartDirectory, 'checkpoints', 'transaction.json')), false);
    assert.equal(fs.existsSync(restartStoreLock), true);
    const rows = fs.readFileSync(path.join(restartDirectory, `${restartedId}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(rows.some(row => row.kind === 'title' && row.title === 'installed-title'), true);
    assert.deepEqual(rows.at(-1), { kind: 'session_color', color: 'blue' });
    const later = spawnSync(process.execPath, ['--input-type=module', '-e', laterHistoryFixture, restartRoot, restartedId],
      { cwd: install, encoding: 'utf8', timeout: 20000 });
    assert.equal(later.status, 0, later.stderr); const history = JSON.parse(later.stdout);
    assert.deepEqual(history.event, { kind: 'file_history', path: 'installed-later.txt', tracked: false }); assert.ok(history.sequence > 0);
    const text = runLaterText(restartArgs, restartHome); assert.equal(text.status, 0, text.stderr + text.stdout);
    assert.doesNotMatch(text.stderr, /Checkpoint witness reconciled/);
    const afterText = fs.readFileSync(path.join(restartDirectory, `${restartedId}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(afterText.slice(-3).map(row => row.kind), ['message', 'message', 'turn_end']);
  } finally { fs.unlinkSync(restartStoreLock); }
  for (let i = 0; i < 2; i++) {
    const resumed = spawnSync(process.execPath, restartArgs, { cwd: install, input: '/exit\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: restartHome, LLM_API_KEY: '', NODE_OPTIONS: '' } });
    assert.equal(resumed.status, 0, resumed.stderr + resumed.stdout);
    if (i === 0) assert.match(resumed.stderr, /Checkpoint witness reconciled/);
    else assert.doesNotMatch(resumed.stderr, /Checkpoint witness reconciled/);
  }
  const restartTorn = fs.readdirSync(restartDirectory).find(name => name.startsWith(`${restartedId}.jsonl.torn-`)); assert.ok(restartTorn);
  assert.deepEqual(fs.readFileSync(path.join(restartDirectory, restartTorn)), restartOriginal);
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, restartRoot, restartedId, restartOutside],
      { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'INSTALLED_RESTART_SECRET', grant: false });
  }
  const restartFork = `import fs from 'node:fs';import path from 'node:path';import {Session} from ${JSON.stringify(sessionModule)};import {forkSession} from ${JSON.stringify(sessionsModule)};
    const [root,id]=process.argv.slice(1),source=Session.open(root,{id});if(source.title!=='installed-title'||source.sessionColor!=='blue')throw Error('title or color lost');
    if(source.fileHistory.trackSequence<1||fs.readFileSync(path.join(root,'installed-later.txt'),'utf8')!=='INSTALLED_LATER')throw Error('file history lost');
    if(!source.messages.some(message=>message.role==='user'&&message.content==='installed later text'))throw Error('later text lost');
    const child=forkSession(source);process.stdout.write(child.id);await child.close();await source.close();`;
  const forked = spawnSync(process.execPath, ['--input-type=module', '-e', restartFork, restartRoot, restartedId],
    { cwd: install, encoding: 'utf8', timeout: 20000 });
  assert.equal(forked.status, 0, forked.stderr);
  for (let i = 0; i < 2; i++) {
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, restartRoot, forked.stdout, restartOutside],
      { cwd: install, encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'INSTALLED_RESTART_SECRET', grant: false });
  }
  console.log(JSON.stringify({ installedRestartedWitness: 'passed', activeStoreLock: true, laterTitleColorHistoryAndText: true, resumes: 2, descendants: 1, coldProcessesPerSession: 2 }));
  const lockRoot = path.join(temporary, 'restart-lock-workspace'), lockOutside = path.join(temporary, 'restart-lock-outside');
  const lockHome = path.join(temporary, 'restart-lock-home'), lockMarker = path.join(temporary, 'restart-lock-stopped');
  fs.mkdirSync(lockRoot); fs.mkdirSync(lockOutside); fs.mkdirSync(lockHome); fs.writeFileSync(path.join(lockOutside, 'value'), 'INSTALLED_LOCK_SECRET');
  const preparedLock = spawnSync(process.execPath, ['--input-type=module', '-e', restartedWitnessFixture, lockRoot, lockOutside],
    { cwd: install, encoding: 'utf8', timeout: 20000 });
  assert.equal(preparedLock.status, 0, preparedLock.stderr); const { id: lockTargetId, sourceId: lockSourceId } = JSON.parse(preparedLock.stdout);
  const lockPreload = path.join(temporary, 'restart-lock-preload.mjs');
  fs.writeFileSync(lockPreload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(sessionModule)}),append=Session.prototype.append;
    Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
      if(event.kind==='directory_checkpoint_torn_recovery'){fs.writeFileSync(${JSON.stringify(lockMarker)},'ready');process.kill(process.pid,'SIGSTOP')}return result};`);
  const lockArgs = [path.join(installedPackage, 'bin/litcode.mjs'), '--workspace', lockRoot, '--resume', lockTargetId,
    '--recover-lock', '--interactive', '--no-tui', '--no-inherit-gateway'];
  const lockWriter = spawn(process.execPath, lockArgs, { cwd: install, stdio: ['pipe', 'ignore', 'pipe'],
    env: { ...process.env, HOME: lockHome, LLM_API_KEY: '', NODE_OPTIONS: `--import=${lockPreload}` } });
  lockWriter.stdin.end('/exit\n'); let lockErrors = ''; lockWriter.stderr.on('data', bytes => { lockErrors += bytes; });
  const lockExit = new Promise((resolve, reject) => { lockWriter.once('error', reject); lockWriter.once('exit', (_code, signal) => resolve(signal)); });
  try {
    const lockDeadline = Date.now() + 15000;
    while (!fs.existsSync(lockMarker) || !spawnSync('ps', ['-o', 'state=', '-p', String(lockWriter.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
      assert.ok(Date.now() < lockDeadline && lockWriter.exitCode === null && lockWriter.signalCode === null, lockErrors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    lockWriter.kill('SIGKILL'); assert.equal(await lockExit, 'SIGKILL');
    const lockFile = path.join(lockRoot, '.agent', `${lockSourceId}.jsonl.lock`), owner = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    const targetRows = fs.readFileSync(path.join(lockRoot, '.agent', `${lockTargetId}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const fact = targetRows.find(row => row.kind === 'directory_checkpoint_torn_recovery'); assert.ok(fact?.sourceLock);
    assert.equal(JSON.stringify(fact.sourceLock).includes(owner.token), false);
    const storeLock = path.join(lockRoot, '.agent', 'checkpoints', 'lock'), savedStoreLock = `${storeLock}.fixture-held`;
    const sourceLockBytes = fs.readFileSync(lockFile); fs.renameSync(storeLock, savedStoreLock);
    fs.writeFileSync(storeLock, JSON.stringify({ pid: process.pid, token: crypto.randomUUID() }), { flag: 'wx', mode: 0o600 });
    try {
      const blocked = spawnSync(process.execPath, lockArgs, { cwd: install, input: '/rename installed-title\n/color blue\n/exit\n', encoding: 'utf8', timeout: 20000,
        env: { ...process.env, HOME: lockHome, LLM_API_KEY: '', NODE_OPTIONS: '' } });
      assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout); assert.doesNotMatch(blocked.stderr, /Checkpoint recovery source lock reclaimed/);
      assert.deepEqual(fs.readFileSync(lockFile), sourceLockBytes); assert.equal(fs.existsSync(storeLock), true);
      const rows = fs.readFileSync(path.join(lockRoot, '.agent', `${lockTargetId}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      assert.equal(rows.some(row => row.kind === 'title' && row.title === 'installed-title'), true);
      assert.deepEqual(rows.at(-1), { kind: 'session_color', color: 'blue' });
      const later = spawnSync(process.execPath, ['--input-type=module', '-e', laterHistoryFixture, lockRoot, lockTargetId],
        { cwd: install, encoding: 'utf8', timeout: 20000 });
      assert.equal(later.status, 0, later.stderr); const history = JSON.parse(later.stdout);
      assert.deepEqual(history.event, { kind: 'file_history', path: 'installed-later.txt', tracked: false }); assert.ok(history.sequence > 0);
      const text = runLaterText(lockArgs, lockHome); assert.equal(text.status, 0, text.stderr + text.stdout);
      assert.doesNotMatch(text.stderr, /Checkpoint recovery source lock reclaimed/);
      const afterText = fs.readFileSync(path.join(lockRoot, '.agent', `${lockTargetId}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      assert.deepEqual(afterText.slice(-3).map(row => row.kind), ['message', 'message', 'turn_end']);
      const laterSnapshot = spawnSync(process.execPath, ['--input-type=module', '-e', laterSnapshotFixture, lockRoot, lockTargetId, lockOutside],
        { cwd: install, encoding: 'utf8', timeout: 20000 });
      assert.equal(laterSnapshot.status, 0, laterSnapshot.stderr);
      assert.deepEqual(JSON.parse(laterSnapshot.stdout), { kinds: ['message', 'directory_snapshot_intent', 'directory_snapshot', 'message', 'turn_end'], history: 'available', entries: [] });
      assert.deepEqual(fs.readFileSync(lockFile), sourceLockBytes);
    } finally { fs.unlinkSync(storeLock); fs.renameSync(savedStoreLock, storeLock); }
    const resumed = spawnSync(process.execPath, lockArgs, { cwd: install, input: '/exit\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: lockHome, LLM_API_KEY: '', NODE_OPTIONS: '' } });
    assert.equal(resumed.status, 0, resumed.stderr + resumed.stdout); assert.match(resumed.stderr, /Checkpoint recovery source lock reclaimed/);
    assert.equal(fs.existsSync(lockFile), false);
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', committedWitnessReader, lockRoot, lockTargetId, lockOutside],
        { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'INSTALLED_LOCK_SECRET', grant: false });
    }
    const snapshotReader = `import {Session} from ${JSON.stringify(sessionModule)};const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id}),history=s.directoryFileHistory;
      process.stdout.write(JSON.stringify({kind:history.kind,entries:history.kind==='available'?history.snapshots.at(-1)?.entries:null,
        grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', snapshotReader, lockRoot, lockTargetId, lockOutside],
        { cwd: install, encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', entries: [], grant: false });
    }
    console.log(JSON.stringify({ installedRecoverySourceLock: 'passed', activeStoreLock: true, laterEmptySnapshot: true, writerDeath: 'after-append', coldProcesses: 2 }));
  } finally { if (lockWriter.exitCode === null && lockWriter.signalCode === null) { lockWriter.kill('SIGKILL'); await lockExit; } }
  const journalModule = pathToFileURL(path.join(installedPackage, 'dist/skill-effects.js')).href;
  run(process.execPath, ['--input-type=module', '-e', `import {SkillEffectJournal} from ${JSON.stringify(journalModule)}; const j = new SkillEffectJournal(process.argv[1], 'package'); const e = j.start('fixture', 0, 'test'); j.finish(e, 'finished'); if (j.unresolved('fixture').length) process.exit(1);`, install], install);
  const failedBuild = spawnSync(process.execPath, [path.join(installedPackage, 'scripts/build-native.mjs')], {
    cwd: install, encoding: 'utf8', env: { ...process.env, PATH: '' }, timeout: 60000,
  });
  assert.notEqual(failedBuild.status, 0);
  assert.match(failedBuild.stderr, /cc|node_api\.h/);
  for (const [relative, record] of Object.entries(locked.packages)) {
    if (!relative || record.dev || record.optional) continue;
    const installed = JSON.parse(fs.readFileSync(path.join(install, relative, "package.json"), "utf8"));
    assert.equal(installed.version, record.version, `installed dependency differs from lock: ${relative}`);
  }
  const executable = path.join(install, "node_modules/.bin/litcode");
  const skillSupervisor = process.argv.includes('--skill-supervisor');
  if (skillSupervisor && process.platform === 'darwin') {
    const supervisor = path.join(installedPackage, 'native/shell-supervisor/supervisor');
    assert.ok(packed.files.some(file => file.path === 'native/shell-supervisor/supervisor.c'));
    assert.equal(packed.files.some(file => file.path === 'native/shell-supervisor/supervisor'), false);
    fs.accessSync(supervisor, fs.constants.X_OK);
    run(process.execPath, [path.join(root, 'scripts/smoke-skill-inline-cli.mjs'), '--cli', executable, '--fenced'], install, 180000);
  }
  if (process.argv.includes('--skill-classify')) {
    run(process.execPath, [path.join(root, 'scripts/smoke-skill-inline-cli.mjs'), '--cli', executable, '--classify'], install, 180000);
    console.log(JSON.stringify({ installedSkillClassifier: 'passed', archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'), upstreamRequests: 0 }));
    break packageSmoke;
  }
  const help = run(executable, ["--help"], install);
  assert.match(help, /--interactive/); assert.match(help, /LLM_API_KEY/);
  assert.match(help, /^LiTcode/);
  assert.equal(run(path.join(install, "node_modules/.bin/personal-harness"), ["--help"], install), help);
  const demo = spawnSync(executable, ["--demo"], { cwd: install, encoding: "utf8", timeout: 60000 });
  assert.equal(demo.status, 0, demo.stderr);
  assert.match(demo.stdout, /Offline demo passed/);
  const directory = /^workspace: (.+)$/m.exec(demo.stderr)?.[1];
  assert.ok(directory); assert.ok(directory.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
  assert.match(path.basename(directory), /^personal-agent-demo-/);
  assert.equal(fs.readFileSync(path.join(directory, "hello.txt"), "utf8"), "Hello from the independent agent.\n");
  assert.equal(fs.readdirSync(path.join(directory, ".agent")).some(name => name.endsWith(".lock")), false);
  fs.rmSync(directory, { recursive: true, force: true });
  assert.equal(fs.existsSync(path.join(install, "node_modules/tsx")), false);
  const launcher = path.join(install, "node_modules/.bin/litcode-magpie");
  const launcherHelp = run(launcher, ["--help"], install);
  assert.match(launcherHelp, /^Usage: litcode-magpie\b/);
  for (const flag of ["--check", "--base-url", "--model", "--start-app", "--start-command", "--startup-timeout-ms", "--workspace", "--resume"]) {
    assert.ok(launcherHelp.includes(flag), `launcher help missing ${flag}`);
  }
  assert.equal(launcherHelp.includes("scripts/launch-magpie.mjs"), false);
  // Each external driver owns its fixture server while this process waits synchronously.
  for (const [driver, key] of [["smoke-magpie-launcher.mjs", "launcher"], ["smoke-magpie-startup.mjs", "startup"]]) {
    const output = run(process.execPath, [path.join(root, "scripts", driver), "--launcher", launcher], install);
    const result = JSON.parse(output.trim());
    assert.equal(result[key], "passed");
    assert.equal(result.modelCalls, 0);
    assert.equal(result.noSecretOutput, true);
  }
  const tuiPreviews = process.argv.includes('--tui-preview');
  if (tuiPreviews) {
    for (const name of ['tui-layout', 'tui-markdown-lexer', 'tui-markdown', 'tui-markdown-host']) {
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`), `package missing ${name}`);
    }
    const driver = path.join(root, 'scripts/smoke-tui-mouse.mjs');
    for (const flags of [[], ['--narrow'], ['--line']]) {
      const result = JSON.parse(run(process.execPath, [driver, '--cli', executable, '--preview', ...flags], install).trim());
      assert.equal(result.choicePreview, true);
      assert.equal(result.installedCLI, true);
      assert.equal(result.locksReleased, true);
      assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiMessages = process.argv.includes('--tui-messages');
  if (tuiMessages) {
    const driver = path.join(root, 'scripts/smoke-tui-mouse.mjs');
    for (const flags of [[], ['--narrow'], ['--stream-chunks']]) {
      const result = JSON.parse(run(process.execPath, [driver, '--cli', executable, '--messages', ...flags], install).trim());
      assert.equal(result.tuiMessages, 'passed');
      assert.equal(result.installedCLI, true);
      assert.equal(result.responseBoundaries, true);
      assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiPacing = process.argv.includes('--tui-pacing');
  if (tuiPacing) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-stream-preview.js'));
    for (const flags of [['--pacing'], ['--input-close', '--narrow']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, ...flags], install).trim());
      assert.equal(result.tuiPacing, 'passed');
      assert.equal(result.installedCLI, true);
      assert.equal(result.locksReleased, true);
      assert.equal(result.paidUpstreamCalls, 0);
      if (flags.includes('--input-close')) assert.equal(result.fatalInputCancelsProvider, true);
      console.log(JSON.stringify(result));
    }
  }
  const tuiVisibility = process.argv.includes('--tui-visibility');
  if (tuiVisibility) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-preview-visibility.js'));
    for (const flags of [['--narrow'], ['--narrow', '--windows-terminal']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--visibility', ...flags], install).trim());
      assert.equal(result.tuiVisibility, 'passed');
      assert.equal(result.resumeRestoresPinned, true);
      assert.equal(result.installedCLI, true);
      assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiEditing = process.argv.includes('--tui-editing');
  if (tuiEditing) {
    for (const name of ['tui-input-cursor', 'tui-input-host', 'tui-input-navigation'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--line']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--editing', ...flags], install).trim());
      assert.equal(result.tuiEditing, 'passed'); assert.equal(result.durableSubmissionMatched, true);
      assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiKillRing = process.argv.includes('--tui-kill-ring');
  if (tuiKillRing) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-input-kill.js'));
    for (const flags of [[], ['--line']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--kill-ring', ...flags], install).trim());
      assert.equal(result.tuiKillRing, 'passed'); assert.equal(result.durableSubmissionMatched, true);
      assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0);
      console.log(JSON.stringify(result));
    }
  }
  const tuiUndo = process.argv.includes('--tui-undo');
  if (tuiUndo) {
    for (const name of ['tui-input-undo', 'tui-input-undo-source'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--line']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--undo', ...flags], install).trim());
      assert.equal(result.tuiUndo, 'passed'); assert.equal(result.durableSubmissionMatched, true);
      assert.equal(result.installedCLI, true); assert.equal(result.pendingClose, true);
      assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
    }
  }
  const tuiProseWidth = process.argv.includes('--tui-prose-width');
  if (tuiProseWidth) {
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--prose-width'], install).trim());
    assert.equal(result.tuiProseWidth, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.codeAndTableFullWidth, true); assert.equal(result.installedCLI, true);
    assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiHighlight = process.argv.includes('--tui-highlight-setting');
  if (tuiHighlight) {
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--highlight-setting'], install).trim());
    assert.equal(result.tuiHighlightSetting, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.streamedAndFinalStyles, true); assert.equal(result.installedCLI, true);
    assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiTheme = process.argv.includes('--tui-theme-setting');
  if (tuiTheme) {
    for (const name of ['tui-theme-source', 'tui-theme-state', 'theme-settings'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--theme-setting'], install).trim());
    assert.equal(result.tuiThemeSetting, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.focusPreview, true); assert.equal(result.restartReadsSaved, true);
    assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiSystemTheme = process.argv.includes('--tui-system-theme');
  if (tuiSystemTheme) {
    for (const name of ['tui-response-source', 'tui-system-theme-source', 'tui-system-theme'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--system-theme-mux']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--system-theme', ...flags], install).trim());
      assert.equal(result.tuiSystemTheme, 'passed'); assert.equal(result.draftSubmissionExact, true);
      assert.equal(result.responseTextAbsentFromJournal, true); assert.equal(result.pendingClose, true);
      assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
    }
  }
  const tuiCustomTheme = process.argv.includes('--tui-custom-theme');
  if (tuiCustomTheme) {
    for (const name of ['tui-custom-themes', 'tui-custom-theme-source', 'tui-theme-overrides-source', 'tui-theme-watcher-source'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--custom-theme'], install).trim());
    assert.equal(result.tuiCustomTheme, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.hotEditRefresh, true); assert.equal(result.draftSubmissionExact, true);
    assert.equal(result.pendingClose, true); assert.equal(result.installedCLI, true);
    assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiPluginTheme = process.argv.includes('--tui-plugin-theme');
  if (tuiPluginTheme) {
    assert.ok(packed.files.some(file => file.path === 'dist/tui-plugin-theme-source.js'));
    const result = JSON.parse(run(process.execPath,
      [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--plugin-theme'], install).trim());
    assert.equal(result.tuiPluginTheme, 'passed'); assert.equal(result.rawMessagesComplete, true);
    assert.equal(result.disabledFallback, true); assert.equal(result.draftSubmissionExact, true);
    assert.equal(result.installedCLI, true); assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
  }
  const tuiThemeEditor = process.argv.includes('--tui-theme-editor');
  if (tuiThemeEditor) {
    for (const name of ['theme-editor', 'tui-theme-editor-source', 'tui-theme-color-components'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--narrow']]) {
      const result = JSON.parse(run(process.execPath,
        [path.join(root, 'scripts/smoke-tui-mouse.mjs'), '--cli', executable, '--theme-editor', ...flags], install).trim());
      assert.equal(result.tuiThemeEditor, 'passed'); assert.equal(result.sourceColorComponents, true);
      assert.equal(result.pluginForkPreservesOriginal, true); assert.equal(result.pendingPreviewClose, true);
      assert.equal(result.rawMessagesComplete, true); assert.equal(result.installedCLI, true);
      assert.equal(result.paidUpstreamCalls, 0); console.log(JSON.stringify(result));
    }
  }
  const tuiExternalEditor=process.argv.includes('--tui-external-editor');
  if(tuiExternalEditor){
    for(const name of ['external-editor','external-editor-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--external-editor',...flags],install).trim());
      assert.equal(result.tuiExternalEditor,'passed');assert.equal(result.pendingChildReaped,true);
      assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const inputHistory=process.argv.includes('--tui-input-history');
  if(inputHistory){
    for(const name of ['tui-input-history','tui-input-history-source','tui-input-history-sensitive','tui-input-history-read'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line'],['--search-chain'],['--search-chain','--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-input-history.mjs'),'--cli',executable,...flags],install).trim());
      assert.equal(result.tuiInputHistory,'passed');assert.equal(result.crossProcessRestart,true);assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);
      if(flags.includes('--search-chain'))assert.equal(result.tuiHistorySearch,'passed');console.log(JSON.stringify(result));
    }
  }
  const tuiStatusLine=process.argv.includes('--tui-status-line');
  if(tuiStatusLine){
    for(const name of ['tui-statusline','tui-statusline-source','tui-statusline-schema','tui-statusline-usage','tui-statusline-components'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--status-line','--narrow'],install).trim());
    assert.equal(result.tuiStatusLine,'passed');assert.equal(result.pendingChildReaped,true);assert.equal(result.installedCLI,true);
    assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
  }
  const tuiFocus=process.argv.includes('--tui-terminal-focus');
  if(tuiFocus){
    for(const name of ['tui-focus','tui-focus-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--terminal-focus',...flags],install).trim());
      assert.equal(result.tuiTerminalFocus,'passed');assert.equal(result.sourceVisualInverse,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiGestures=process.argv.includes('--tui-input-gestures');
  if(tuiGestures){
    for(const name of ['tui-input-gestures','tui-input-gesture-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--input-gestures',...flags],install).trim());
      assert.equal(result.tuiInputGestures,'passed');assert.equal(result.confirmedExit,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiReturn=process.argv.includes('--tui-return');
  if(tuiReturn){
    for(const name of ['tui-input-return','tui-input-return-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--return-gesture',...flags],install).trim());
      assert.equal(result.tuiReturnGesture,'passed');assert.equal(result.exactSubmission,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiVim=process.argv.includes('--tui-vim');
  if(tuiVim){
    for(const name of ['tui-vim','tui-vim-source','tui-vim-keys','tui-vim-settings-source'])assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]){
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--vim',...flags],install).trim());
      assert.equal(result.tuiVim,'passed');assert.equal(result.exactSubmission,true);assert.equal(result.settingSaves,true);
      assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiFoldPaste=process.argv.includes('--tui-fold-paste');
  if (tuiFoldPaste) {
    for (const name of ['tui-input-paste','tui-input-paste-source']) assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for(const flags of [[],['--line']]) {
      const result=JSON.parse(run(process.execPath,[path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--fold-paste',...flags],install).trim());
      assert.equal(result.tuiFoldPaste,'passed');assert.equal(result.exactExpandedSubmit,true);
      assert.equal(result.installedCLI,true);assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  const tuiProgress = process.argv.includes('--tui-thinking-progress');
  if (tuiProgress) {
    for (const name of ['tui-progress', 'tui-progress-source', 'tui-progress-spinner', 'tui-progress-star', 'tui-progress-time', 'tui-progress-tasks', 'tui-progress-completion'])
      assert.ok(packed.files.some(file => file.path === `dist/${name}.js`));
    for (const flags of [[], ['--narrow']]) {
      const result=JSON.parse(run(process.execPath,
        [path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--thinking-progress',...flags],install).trim());
      assert.equal(result.tuiThinkingProgress,'passed'); assert.equal(result.taskSummary,true);
      assert.equal(result.sourceShimmer,true); assert.equal(result.durableTiming,true);
      assert.equal(result.installedCLI,true); assert.equal(result.paidUpstreamCalls,0); console.log(JSON.stringify(result));
    }
  }
  const tuiProgressSettings=process.argv.includes('--tui-progress-settings');
  if (tuiProgressSettings) {
    for (const name of ['tui-progress-settings','tui-progress-settings-source'])
      assert.ok(packed.files.some(file=>file.path===`dist/${name}.js`));
    for (const flags of [[],['--narrow']]) {
      const result=JSON.parse(run(process.execPath,
        [path.join(root,'scripts/smoke-tui-mouse.mjs'),'--cli',executable,'--progress-settings',...flags],install).trim());
      assert.equal(result.tuiProgressSettings,'passed');assert.equal(result.cacheReflow,true);
      assert.equal(result.resumeRestores,true);assert.equal(result.installedCLI,true);
      assert.equal(result.paidUpstreamCalls,0);console.log(JSON.stringify(result));
    }
  }
  console.log(JSON.stringify({ package: "passed", compiledCLI: true, binHelp: true, offlineInstall: true,
    packagedDemo: true, installedLauncherHelp: true, installedLauncherFixtures: true, installedStartupFixtures: true,
    devRuntimeAbsent: true, extractedSamplesExcluded: true, files: packed.files.length,
    ...(tuiPreviews ? { installedTuiPreviews: true, installedLinePreview: true, localPreviewModelCalls: 15 } : {}),
    ...(tuiMessages ? { installedTuiMessages: true, localMessageModelCalls: 6, installedStreamingChunks: true } : {}),
    ...(tuiPacing ? { installedTuiPacing: true, installedFatalInputClose: true, localPacingModelCalls: 10 } : {}),
    ...(tuiVisibility ? { installedTuiVisibility: true, installedWindowsTerminalGate: true, localVisibilityModelCalls: 10 } : {}),
    ...(tuiEditing ? { installedTuiEditing: true, installedLineEditing: true, localEditingModelCalls: 10 } : {}),
    ...(tuiKillRing ? { installedTuiKillRing: true, installedLineKillRing: true, localKillModelCalls: 10 } : {}),
    ...(tuiUndo ? { installedTuiUndo: true, installedLineUndo: true, localUndoModelCalls: 10 } : {}),
    ...(tuiProseWidth ? { installedTuiProseWidth: true, localProseModelCalls: 6 } : {}),
    ...(tuiHighlight ? { installedTuiHighlightSetting: true, localHighlightModelCalls: 5 } : {}),
    ...(tuiTheme ? { installedTuiThemeSetting: true, localThemeModelCalls: 5 } : {}),
    ...(tuiSystemTheme ? { installedTuiSystemTheme: true, installedMuxFallback: true, localSystemThemeModelCalls: 4 } : {}),
    ...(tuiCustomTheme ? { installedTuiCustomTheme: true, localCustomThemeModelCalls: 3 } : {}),
    ...(tuiPluginTheme ? { installedTuiPluginTheme: true, localPluginThemeModelCalls: 3 } : {}),
    ...(tuiThemeEditor ? { installedTuiThemeEditor: true, localThemeEditorModelCalls: 4 } : {}),
    ...(inputHistory?{installedTuiInputHistory:true,localHistoryModelCalls:6}:{}),
    ...(tuiStatusLine?{installedTuiStatusLine:true,localStatusLineModelCalls:1}:{}),
    ...(tuiExternalEditor?{installedTuiExternalEditor:true,localEditorModelCalls:6}:{}),
    ...(tuiVim?{installedTuiVim:true,installedLineVim:true,localVimModelCalls:18}:{}),
    ...(tuiReturn?{installedTuiReturn:true,installedLineReturn:true,localReturnModelCalls:13}:{}),
    ...(tuiGestures?{installedTuiInputGestures:true,installedLineInputGestures:true,localGestureModelCalls:8}:{}),
    ...(tuiFoldPaste ? {installedTuiFoldPaste:true,localFoldPasteModelCalls:16} : {}),
    ...(tuiProgress ? {installedTuiThinkingProgress:true, localThinkingModelCalls:12} : {}),
    ...(tuiProgressSettings ? {installedTuiProgressSettings:true,localProgressSettingsModelCalls:16} : {}),
    ...(skillSupervisor ? { installedDarwinSkillSupervisor: process.platform === 'darwin' ? 'passed' : 'not_run' } : {}),
    archiveSha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
    upstreamRequests: 0 }));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
