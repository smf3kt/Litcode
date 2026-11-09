import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { captureIdentity } from '../scripts/identity.mjs';
const url = name => new URL(`../dist/${name}.js`, import.meta.url).href;
const before = captureIdentity().sha256, cases = [];
for (const cut of ['skill-admitted', 'registry-before', 'registry-after', 'registry-fulfilled', 'skill-fulfilled', 'normal', 'deny']) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'approval-operation-cli-')));
  try {
    const user = path.join(root, 'user'), marker = path.join(root, 'approval-effect'), target = path.join(root, 'skill-effect'), preload = path.join(root, 'preload.mjs');
    fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness/skills/fixture'), { recursive: true });
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ features: { skillInlineCommands: true, subagents: true, agentMessaging: true } }));
    fs.writeFileSync(path.join(root, '.harness/skills/fixture/SKILL.md'), '---\nname: fixture\ndescription: Owned fixture\n---\n!`printf APPROVED > skill-effect`\n');
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
      const cut=${JSON.stringify(cut)}, {Agent}=await import(${JSON.stringify(url('agent'))}),{AgentRegistry}=await import(${JSON.stringify(url('agent-registry'))}),
      {GatewayProvider}=await import(${JSON.stringify(url('provider'))}),{Session}=await import(${JSON.stringify(url('session'))});
      const append=Session.prototype.append;Session.prototype.append=function(row,...args){const result=Reflect.apply(append,this,[row,...args]);
        if(row.kind==='approval_operation'&&cut===row.scope.kind+'-'+row.phase)process.kill(process.pid,'SIGKILL');return result;};
      const bind=AgentRegistry.prototype.bindApproval;AgentRegistry.prototype.bindApproval=function(){return Reflect.apply(bind,this,[async function(){
        if(cut==='registry-before')process.kill(process.pid,'SIGKILL');fs.writeFileSync(${JSON.stringify(marker)},'CALLBACK');
        if(cut==='registry-after')process.kill(process.pid,'SIGKILL');return {decision:cut==='deny'?'deny':'allow'};}]);};
      const run=Agent.prototype.run;Agent.prototype.run=function(...args){this.events.permission=async()=>true;return Reflect.apply(run,this,args);};
      let calls=0;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{const n=calls++;
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',stop_sequence:null,
          content:n===0?[{type:'tool_use',id:'parent-agent',name:'agent',input:{prompt:'APPROVAL_CHILD',mode:'general'}}]
            :n===1?[{type:'tool_use',id:'skill-call',name:'skill',input:{name:'fixture'}}]:[{type:'text',text:'DONE'}],
          stop_reason:n<2?'tool_use':'end_turn',usage:{input_tokens:1,output_tokens:1}}};`);
    const run = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture', '--allow-shell',
      '--permission-mode', 'ask', '--interactive', '--no-tui', '--no-inherit-gateway'], { input: 'invoke skill\n/exit\n', encoding: 'utf8', timeout: 25000,
      env: { ...process.env, HOME: user, CLAUDE_CONFIG_DIR: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    if (cut === 'normal' || cut === 'deny') assert.equal(run.status, 0, run.stderr + run.stdout);
    else assert.equal(run.signal, 'SIGKILL', cut + '\n' + run.stderr + run.stdout);
    const journals = fs.readdirSync(path.join(root, '.agent')).filter(file => file.endsWith('.jsonl'))
      .map(file => fs.readFileSync(path.join(root, '.agent', file), 'utf8').trim().split('\n').map(JSON.parse));
    assert.equal(journals.length, 2);
    const facts = journals.flat().filter(row => row.kind === 'approval_operation'); assert.ok(facts.length, cut);
    const skill = facts.filter(row => row.scope.kind === 'skill'), registry = facts.filter(row => row.scope.kind === 'registry');
    assert.equal(skill.at(-1)?.phase, cut === 'normal' || cut === 'skill-fulfilled' ? 'fulfilled' : cut === 'deny' ? 'rejected' : 'admitted');
    if (cut !== 'skill-admitted') assert.equal(registry.at(-1)?.phase, ['registry-before', 'registry-after'].includes(cut) ? 'admitted' : 'fulfilled');
    assert.equal(fs.existsSync(marker), !['skill-admitted', 'registry-before'].includes(cut));
    assert.equal(fs.existsSync(target), cut === 'normal');
    if (cut === 'normal') assert.equal(fs.readFileSync(target, 'utf8'), 'APPROVED');
    for (const rows of journals) for (let reader = 0; reader < 2; reader++) {
      const cold = spawnSync(process.execPath, ['--input-type=module', '-e', `import assert from 'node:assert/strict';
        import {Session,readSessionJournal} from ${JSON.stringify(url('session'))};const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
        assert.deepEqual(s.events.filter(row=>row.kind==='approval_operation'),JSON.parse(process.argv[3]));
        assert.deepEqual(readSessionJournal(process.argv[1],s.id,{maxBytes:10000000,maxEvents:10000}),s.events);await s.close();`,
        root, rows[0].id, JSON.stringify(rows.filter(row => row.kind === 'approval_operation'))], { encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr + cold.stdout);
    }
    assert.equal(fs.existsSync(target), cut === 'normal');
    cases.push({ cut, callbackEffect: fs.existsSync(marker), skillEffect: fs.existsSync(target), skill: skill.at(-1)?.phase, registry: registry.at(-1)?.phase, coldReaders: 4 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const full = captureIdentity(); assert.equal(full.sha256, before);
const identity = { sha256: full.sha256, ...Object.fromEntries(['inputs', 'validation', 'build'].map(key => [key, { sha256: full[key].sha256, files: full[key].files.length }])) };
const evidence = { identity, cases, upstreamCalls: 0 };
fs.writeFileSync(new URL('./w385-approval-operation-cli.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
