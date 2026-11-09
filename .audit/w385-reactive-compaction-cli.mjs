import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const reload of [false, true]) {
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w385-compact-cli-')));
const user = path.join(root, 'user'), preload = path.join(root, 'provider.mjs'), observations = path.join(root, 'requests.jsonl');
fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.git'));
const moduleURL = name => new URL(`../dist/${name}.js`, import.meta.url).href;
fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
const {GatewayProvider}=await import(${JSON.stringify(moduleURL('provider'))});let n=0;
GatewayProvider.prototype.count=async()=>1;
GatewayProvider.prototype.complete=async request=>{n++;fs.appendFileSync(${JSON.stringify(observations)},JSON.stringify(request)+'\\n');
 const compact=request.tool_choice?.type==='none';
 return {id:'response-'+n,model:'fixture',type:'message',role:'assistant',stop_reason:'end_turn',stop_sequence:null,
 content:compact?[{type:'text',text:'COMPACT_SUMMARY'}]:[{type:'thinking',thinking:'reasoning-'+n,signature:'signature-'+n},{type:'text',text:'ANSWER_'+n}],usage:{input_tokens:1,output_tokens:1}};};`);
const env = { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` };
try {
  const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture', '--interactive', '--no-tui', '--no-inherit-gateway'],
    { input: `first\nsecond\n/compact\n${reload ? '/reload\n' : ''}third\n`, encoding: 'utf8', timeout: 20000, env });
  assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  const requests = fs.readFileSync(observations, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(requests.length, 4);
  assert.match(JSON.stringify(requests[2].messages), /ANSWER_1/);
  assert.doesNotMatch(JSON.stringify(requests[2].messages), /ANSWER_2|signature-2/);
  assert.match(JSON.stringify(requests[3].messages), /COMPACT_SUMMARY/);
  assert.match(JSON.stringify(requests[3].messages), /ANSWER_2/);
  if (reload) assert.doesNotMatch(JSON.stringify(requests[3].messages), /signature-2/);
  else assert.match(JSON.stringify(requests[3].messages), /signature-2/);
  assert.doesNotMatch(JSON.stringify(requests[3].messages), /ANSWER_1/);
  const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, reload ? 2 : 1);
  const selected = reload ? journals.find(name => fs.readFileSync(path.join(root, '.agent', name), 'utf8').includes('"reason":"reload"')) : journals[0];
  assert.ok(selected); const id = selected.slice(0, -6);
  for (let i = 0; i < 2; i++) {
    const reader = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import {Session} from ${JSON.stringify(moduleURL('session'))};
      import {forkSession} from ${JSON.stringify(moduleURL('sessions'))};
      import {assertPaired} from ${JSON.stringify(moduleURL('agent'))};
      const s=Session.open(process.argv[1],{id:process.argv[2]});const f=forkSession(s);
      assertPaired(s.messages);assertPaired(f.messages);console.log(JSON.stringify({original:s.messages,fork:f.messages}));f.close();s.close();`, root, id],
      { encoding: 'utf8', timeout: 10000 });
    assert.equal(reader.status, 0, reader.stderr);
    const read = JSON.parse(reader.stdout); assert.deepEqual(read.original, read.fork);
    assert.match(JSON.stringify(read.original), /COMPACT_SUMMARY/); assert.match(JSON.stringify(read.original), /ANSWER_2/);
    assert.doesNotMatch(JSON.stringify(read.original), /ANSWER_1/);
  }
  console.log(JSON.stringify({ cli: 'passed', reload, modelCalls: requests.length, coldReaders: 2, forks: 2, upstreamCalls: 0 }));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
}
