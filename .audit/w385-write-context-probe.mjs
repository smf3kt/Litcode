// Owned CLI probe: a builtin execution receipt is not a context-effect proof.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const manifest = JSON.parse(fs.readFileSync('extracted-v2/manifest.json', 'utf8'));
const source = [];
for (const [module, start, end] of [['chunk-hwpb27as.js', 121053, 123737], ['chunk-sfn1dbxq.js', 739599, 743280]]) {
  const bytes = fs.readFileSync(`extracted-v2/modules/${module}`);
  const entry = manifest.modules.find(row => row.path === module);
  assert.equal(hash(bytes), entry.decodedSha256);
  source.push({ module, sha256: hash(bytes), start, end, unit: 'zero-based half-open UTF-16', bodySha256: hash(bytes.toString().slice(start, end)) });
}
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const cases = [];
const redirect = process.argv.includes('--redirect');
const operation = process.argv.find(arg => arg.startsWith('--operation='))?.slice('--operation='.length);
if (operation) assert.ok(['writeInputDescription', 'writeRuntimeStart', 'writePublicationAuthorization'].includes(operation));
const preflight = process.argv.includes('--preflight') || !!operation;
const callback = operation ?? (preflight ? 'writeGrantCheck' : 'workingDirectories');
const observed = process.argv.includes('--observed') || preflight;
for (const [changed, cut] of observed ? [[false, 'normal'], ...['before', 'after', 'returned', 'normal'].map(cut => [true, cut])] : [[false, 'normal'], [true, 'normal']]) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'write-context-')));
  try {
    const outside = path.join(root, 'external'), workspace = path.join(root, 'workspace'), user = path.join(root, 'user');
    for (const dir of [outside, workspace, user]) fs.mkdirSync(dir);
    const target = path.join(outside, 'value'), marker = path.join(root, 'context-effect'), preload = path.join(root, 'preload.mjs');
    const workspaceFile = path.join(workspace, 'workspace-value');
    const requested = redirect && changed ? workspaceFile : target;
    const substitute = changed ? path.join(outside, 'redirected') : path.join(workspace, 'redirected');
    fs.writeFileSync(target, 'ORIGINAL');
    if (redirect) fs.writeFileSync(workspaceFile, 'WORKSPACE_ORIGINAL');
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
      const {Session}=await import(${JSON.stringify(url('session'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))});
      let armed=false;const append=Session.prototype.append;
      Session.prototype.append=function(event,...args){const result=Reflect.apply(append,this,[event,...args]);
        if(!${preflight}&&event.kind==='runtime_write_execution'&&event.phase==='entered')armed=true;
        if(${preflight}&&event.kind==='tool_context_observer'&&event.callback===${JSON.stringify(callback)}&&event.transition.phase==='admitted')armed=true;
        if(armed&&event.kind==='tool_context_observer'&&event.callback===${JSON.stringify(callback)}&&event.transition.phase==='returned'){
          if(${JSON.stringify(cut)}==='returned')process.kill(process.pid,'SIGKILL');
          if(${preflight})armed=false;}
        if(${redirect} && event.kind==='tool_start' && event.id==='context-write'){
          const parse=schema.parse;schema.parse=(...args)=>({...parse(...args),path:${JSON.stringify(substitute)}});}
        return result;};
      const schema=(await import(${JSON.stringify(url('directory-publication-authorization'))})).directoryWriteInputSchema;
      const instrument=${!!operation}?schema:Session.prototype,member=${!!operation}?'safeParse':'workingDirectories',original=instrument[member];
      if(${changed})instrument[member]=function(...args){if(armed){
        if(${JSON.stringify(cut)}==='before')process.kill(process.pid,'SIGKILL');
        fs.writeFileSync(${JSON.stringify(marker)},'CONTEXT_EFFECT');
        if(${JSON.stringify(cut)}==='after')process.kill(process.pid,'SIGKILL');}
        return Reflect.apply(original,this,args);};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        const first=calls++===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
        content:first?[{type:'tool_use',id:'context-write',name:'write_file',input:{path:${JSON.stringify(requested)},content:'NO',overwrite:false}}]:[{type:'text',text:'DONE'}],
        stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', workspace, '--user-dir', user,
      '--model', 'fixture', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
      input: `/add-dir ${outside}\ntry write\n/exit\n`, encoding: 'utf8', timeout: 25000,
      env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
    });
    if (cut === 'normal') assert.equal(run.status, 0, run.stderr + run.stdout);
    else assert.equal(run.signal, 'SIGKILL', run.stderr + run.stdout);
    const journal = fs.readdirSync(path.join(workspace, '.agent')).find(file => file.endsWith('.jsonl'));
    assert.ok(journal);
    const rows = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8').trim().split('\n').map(JSON.parse);
    const execution = rows.filter(row => row.kind === 'runtime_write_execution');
    assert.deepEqual(execution.map(row => [row.phase, row.outcome]), redirect ? [] : cut === 'normal'
      ? [['entered', undefined], ['completed', 'blocked-additional-directory']] : preflight ? [] : [['entered', undefined]]);
    const contextRows = rows.filter(row => row.kind === 'tool_context_observer');
    if (observed) {
      assert.ok(contextRows.length > 0);
      const entryIndex = rows.findIndex(row => row.kind === 'runtime_write_execution' && row.phase === 'entered');
      const first = preflight ? contextRows.find(row => row.callback === callback)
        : rows.slice(entryIndex + 1).find(row => row.kind === 'tool_context_observer'); assert.ok(first);
      const last = contextRows.filter(row => row.invocationId === first.invocationId).at(-1);
      if (operation) {
        assert.equal(first.inputKind, 'unobserved');
        if (operation === 'writeInputDescription' && cut !== 'normal') assert.ok(!contextRows.some(row => row.callback === 'writeGrantCheck'));
      }
      assert.deepEqual(last.transition, cut === 'before' || cut === 'after' ? { phase: 'admitted' } : { phase: 'returned', mode: 'sync' });
    }
    const start = rows.find(row => row.kind === 'tool_start' && row.id === 'context-write');
    if (redirect) {
      assert.ok(start);
      assert.equal(fs.existsSync(substitute), false);
      assert.equal(fs.readFileSync(workspaceFile, 'utf8'), 'WORKSPACE_ORIGINAL');
      assert.ok(rows.some(row => row.kind === 'tool_effect' && row.result.is_error &&
        JSON.stringify(row.result.content).includes('Write input changed after permission checking')));
    } else if (preflight && operation !== 'writePublicationAuthorization' && cut !== 'normal') assert.equal(start, undefined); else assert.ok(start?.runtimeWriteOwner);
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL');
    assert.equal(fs.existsSync(marker), !redirect && changed && cut !== 'before');
    for (let i = 0; i < 2; i++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `import assert from 'node:assert/strict';
        import {Session} from ${JSON.stringify(url('session'))};const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(s.events.filter(row=>row.kind==='runtime_write_execution'),JSON.parse(process.argv[3]));
        assert.deepEqual(s.events.filter(row=>row.kind==='tool_context_observer'),JSON.parse(process.argv[5]));
        assert.equal(s.workingDirectories(false).readHandle?.(process.argv[4]),undefined);await s.close();`,
        workspace, rows[0].id, JSON.stringify(execution), outside, JSON.stringify(contextRows)], { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
    }
    assert.equal(fs.existsSync(marker), !redirect && changed && cut !== 'before');
    cases.push({ changed, cut, actualContextEffect: fs.existsSync(marker), execution: execution.map(({ phase, outcome }) => ({ phase, outcome })), contextTransitions: contextRows.map(row => row.transition), coldReaders: 2, coldGrant: false });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const fullIdentity = captureIdentity();
const identity = { sha256: fullIdentity.sha256, ...Object.fromEntries(['inputs', 'validation', 'build'].map(key => [key,
  { sha256: fullIdentity[key].sha256, files: fullIdentity[key].files.length }])) };
const evidence = { identity, source, cases, conclusion: redirect ? 'Both redirected paths were refused before the filesystem effect.' :
  'Builtin execution boundaries do not attest Session workingDirectories callback effects. No reclamation expansion is justified.', upstreamCalls: 0 };
fs.writeFileSync(new URL(redirect ? './w385-write-redirect.json' : operation ? `./w385-context-${operation}.json` : preflight ? './w385-write-grant-preflight.json' : observed ? './w385-write-context-observed.json' : './w385-write-context-probe.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
