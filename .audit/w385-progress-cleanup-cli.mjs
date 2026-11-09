import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'progress-retry-cli-')));
try {
  const user = path.join(root, 'user'), preload = path.join(root, 'preload.mjs'), trace = path.join(root, 'trace');
  fs.mkdirSync(user);
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('external network disabled')};
    const {Agent}=await import(${JSON.stringify(url('agent'))}),{GatewayProvider}=await import(${JSON.stringify(url('provider'))});
    const original=Agent.prototype.run;let attempts=0,firstAgent;
    Agent.prototype.run=async function(...args){const attempt=++attempts;
      if(attempt===1)firstAgent=this;else if(firstAgent!==this)throw Error('retry changed Agent');
      const receiver=this.events,progress=receiver.progress;
      receiver.progress=function(event){if(attempt===1&&(event.kind==='start'||event.kind==='finish'))throw Error('owned progress failure');
        return progress?.call(this,event);};
      try{return await Reflect.apply(original,this,args)}finally{receiver.progress=progress;
        fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({attempt,busy:this.isRunning()})+'\\n');}};
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(request,signal,onText)=>{
      fs.appendFileSync(${JSON.stringify(trace)},JSON.stringify({provider:true})+'\\n');
      onText?.('RETRY_COMPLETED');
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
        content:[{type:'text',text:'RETRY_COMPLETED'}],stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
  const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
    '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'first\nretry\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stderr + run.stdout, /owned progress failure/);
  assert.match(run.stdout, /RETRY_COMPLETED/, run.stderr + fs.readFileSync(trace, 'utf8'));
  const records = fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(records, [{ attempt: 1, busy: false }, { provider: true }, { attempt: 2, busy: false }]);
  const result = { identity: captureIdentity().sha256, actualCli: true, sameAgent: true, records, upstreamCalls: 0 };
  fs.writeFileSync('.audit/w385-progress-cleanup-cli.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
