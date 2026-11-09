// Owned compiled CLI/Agent fixtures. Extracted application entrypoints are never executed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const results = [];
const cleanupAcceptance = process.argv.includes('--cleanup-fixed');
for (const callback of ['status', 'progress', 'terminalSequence']) for (const cut of ['before', 'after']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'display-observer-gap-')));
  const user = path.join(root, 'user'), preload = path.join(root, 'preload.mjs'), marker = path.join(root, 'callback-effect');
  try {
    fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness')); fs.writeFileSync(path.join(root, 'value'), 'owned read');
    const output = { systemMessage: 'owned display', terminalSequence: '\u001b]0;owned title\u0007' };
    fs.writeFileSync(path.join(root, 'hook-output'), JSON.stringify(output));
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ hooks: { PreToolUse: [{ command: 'cat hook-output' }] } }));
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('external network disabled')};
      const {Agent}=await import(${JSON.stringify(url('agent'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))});
      const run=Agent.prototype.run;Agent.prototype.run=function(...args){
        const name=${JSON.stringify(callback)},receiver=this.events,original=receiver[name];
        receiver[name]=function(...values){
          if(${JSON.stringify(callback)}==='status'&&!String(values[0]).includes('owned display'))return original?.apply(this,values);
          if(${JSON.stringify(cut)}==='before')process.kill(process.pid,'SIGKILL');
          original?.apply(this,values);fs.appendFileSync(${JSON.stringify(marker)},'effect\\n');process.kill(process.pid,'SIGKILL');
        };return Reflect.apply(run,this,args);};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{
        const first=calls++===0;return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:first?[{type:'tool_use',id:'read',name:'read_file',input:{path:'value'}}]:[{type:'text',text:'DONE'}],
          stop_reason:first?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
      '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'read value\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    assert.equal(run.signal, 'SIGKILL', run.stderr + run.stdout);
    assert.equal(fs.existsSync(marker), cut === 'after');
    const file = fs.readdirSync(path.join(root, '.agent')).find(name => name.endsWith('.jsonl'));
    const rows = fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse), id = rows[0].id;
    const hook = rows.find(row => row.kind === 'hook_result' && row.event === 'PreToolUse');
    if (callback !== 'progress') {
      assert.ok(hook); assert.ok(hook.systemMessages.includes('owned display')); assert.equal(hook.terminalSequences.length, 1);
    }
    const observerKinds = [...new Set(rows.map(row => row.kind).filter(kind => /observer|progress|terminal/.test(kind)))];
    assert.ok(observerKinds.every(kind => kind === 'hook_command_observer'), JSON.stringify(observerKinds));
    const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};
      const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
      assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);s.close();`, root, id],
    { encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr + cold.stdout);
    results.push({ callback, cut, actualEffect: cut === 'after', recordedHookResult: Boolean(hook), observerKinds, coldReaders: 1 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'display-progress-finally-')));
let cleanup;
try {
  const { Agent, defaultConfig } = await import(url('agent')), { Session } = await import(url('session'));
  const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  try {
    const events = { progress() { throw Error('owned progress failure'); } };
    const agent = new Agent(session, { count: async () => 1, complete: async () => { throw Error('unexpected provider'); } }, [], events);
    await assert.rejects(agent.run('fixture'), /owned progress failure/);
    assert.equal(agent.isRunning(), !cleanupAcceptance);
    events.progress = () => {};
    await assert.rejects(agent.run('retry'), cleanupAcceptance ? /unexpected provider/ : /Agent is already running/);
    assert.equal(agent.isRunning(), !cleanupAcceptance);
    cleanup = { progressThrowLeavesBusy: !cleanupAcceptance, retryReachedProvider: cleanupAcceptance };
  } finally { session.close(); }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
const result = { identity: captureIdentity().sha256, cases: results, cleanup, upstreamCalls: 0,
  conclusion: 'Display callbacks have no admission/settlement record; hook_result is input intent only.', cleanupAcceptance };
fs.writeFileSync(cleanupAcceptance ? '.audit/w385-progress-cleanup-validation.json' : '.audit/w385-agent-display-gap.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
