import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cuts = process.argv.includes('--death-cuts')
  ? ['completed', 'observer-pending', 'intent', 'observer-returned', 'message'] : ['none'];
const adopted = process.argv.includes('--adopted');
for (const agentMessaging of [true, false]) for (const cut of cuts) {
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-hook-delivery-')));
const user = path.join(root, 'user'), seen = path.join(root, 'requests.jsonl');
const quote = value => `'${value.replaceAll("'", `'"'"'`)}'`;
try {
  fs.mkdirSync(user); fs.mkdirSync(path.join(root, '.harness')); fs.mkdirSync(path.join(root, '.git'));
  const hook = path.join(root, 'hook.mjs');
  fs.writeFileSync(hook, `import fs from 'node:fs';const input=JSON.parse(fs.readFileSync(0,'utf8'));
    if(${adopted}){console.log('{"async":true}');await new Promise(resolve=>setTimeout(resolve,100));}
    const message='CHILD_ASYNC_OUTPUT_'+input.session_id;
    fs.appendFileSync(${JSON.stringify(path.join(root, 'commands.jsonl'))},JSON.stringify({id:input.session_id,message})+'\\n');
    console.log(JSON.stringify({systemMessage:message}));`);
  // Use one full command per owner, keeping markers independent of model text.
  fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ features: { agentMessaging }, hooks: { SessionStart: [{ ...(!adopted ? { async: true } : {}),
    command: `${quote(process.execPath)} ${quote(hook)}` }] } }));
  const preload = path.join(root, 'provider.mjs');
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
    const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
    const append=Session.prototype.append;let childJob,childDelivery,childCompleted;
    Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
      const lifecycle=this.config.childMode!==undefined&&event.kind==='async_hook_lifecycle';
      if(lifecycle&&event.transition.phase==='admitted')childJob=event.jobId;
      if(lifecycle&&event.transition.phase==='completed')childCompleted=event.transition.state;
      const intent=event.kind==='notification_intent_v2'&&event.batch.kind==='async_hook'&&event.batch.jobId===childJob;
      if(intent)childDelivery=event.deliveryId;
      const cut=${JSON.stringify(cut)};
      const stop=lifecycle&&(cut==='completed'&&event.transition.phase==='completed'
        ||event.transition.phase==='observer'&&event.transition.observer?.kind==='completion'
          &&cut==='observer-'+event.transition.state)
        ||cut==='intent'&&intent
        ||cut==='message'&&event.kind==='message'&&childDelivery!==undefined&&event.notificationDelivery?.deliveryId===childDelivery;
      if(stop)process.kill(process.pid,'SIGKILL');return result;};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
    let launched=false;GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
      const child=JSON.stringify(request.system).includes('You are a child agent assigned');
      // Keep the owner alive until the real hook exits; writing its marker is not completion.
      if(child){for(let i=0;i<1000&&childCompleted===undefined;i++)await new Promise(resolve=>setTimeout(resolve,5));
        if(childCompleted!=='completed')throw Error('child hook did not complete: '+childCompleted);}
      fs.appendFileSync(${JSON.stringify(seen)},JSON.stringify({child,messages:request.messages})+'\\n');
      let content=[{type:'text',text:'fixture done'}];
      if(!child&&!launched){launched=true;const tool=request.tools.find(t=>t.name==='agent');if(!tool)throw Error('agent unavailable');
        content=[{type:'tool_use',id:'child-delivery',name:tool.name,input:{prompt:'Return fixture done',mode:'general',max_turns:1}}];}
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason:content[0].type==='tool_use'?'tool_use':'end_turn',
        stop_sequence:null,usage:{input_tokens:1,output_tokens:1}};};`);
  // Generated modules must contain JS newline escapes, not literal backslash-n records.
  for (const file of [hook, preload]) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replaceAll("'\\\\n'", "'\\n'"));
  const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture',
    '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], { cwd: process.cwd(),
    input: 'Run the child fixture\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: user, CLAUDE_JOB_DIR: path.join(root, 'jobs'), LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
  if (cut === 'none') assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  else assert.equal(cli.signal, 'SIGKILL', cli.stderr + cli.stdout);
  const read = file => fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const commands = read(path.join(root, 'commands.jsonl')), requests = read(seen);
  const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl')).map(name => read(path.join(root, '.agent', name)));
  const child = journals.find(rows => rows[0].config.childMode !== undefined), parent = journals.find(rows => rows[0].config.childMode === undefined);
  assert.ok(child && parent); assert.equal(commands.length, 2);
  for (const rows of [parent, child]) {
    const records = rows.filter(row => row.kind === 'hook_resolver');
    assert.equal(records.length, 4);
    assert.ok(records.every(row => row.owner === rows[0].id && row.event === 'SessionStart' && row.resolverType === 'command'));
    assert.deepEqual(records.map(row => row.transition.phase), ['admitted', adopted ? 'adopted_job' : 'async_job', 'returned', 'settled']);
    assert.equal(records[2].transition.outcome, 'backgrounded'); assert.equal(records[3].transition.outcome, 'fulfilled');
    assert.ok(rows.some(row => row.kind === 'hook_start' && row.id === records[0].hookId && row.event === 'SessionStart'));
    assert.ok(rows.some(row => row.kind === 'async_hook_lifecycle' && row.jobId === records[1].transition.jobId && row.generation === records[1].transition.generation));
  }
  const output = commands.find(row => row.id === child[0].id); assert.ok(output);
  assert.ok(child.some(row => row.kind === 'async_hook_lifecycle' && row.transition.phase === 'completed' && row.transition.state === 'completed'));
  const observation = { childCommandCompleted: true, childMarker: output.message,
    childModelSawOutput: requests.filter(row => row.child).some(row => JSON.stringify(row.messages).includes(output.message)),
    parentModelSawOutput: requests.filter(row => !row.child).some(row => JSON.stringify(row.messages).includes(output.message)),
    parentDeliveryIntent: parent.some(row => row.kind === 'notification_intent_v2' && JSON.stringify(row.batch).includes(output.message)),
    childRows: child.filter(row => row.kind === 'hook_result' || row.kind === 'async_hook_lifecycle').map(row => row.kind === 'async_hook_lifecycle' ? row.transition : { kind: row.kind, additionalContext: row.additionalContext }),
  };
  assert.equal(observation.childModelSawOutput, false);
  assert.equal(observation.parentModelSawOutput, cut === 'none');
  const hasIntent = !['completed', 'observer-pending'].includes(cut);
  const hasMessage = cut === 'none' || cut === 'message';
  assert.equal(observation.parentDeliveryIntent, hasIntent);
  const intents = parent.filter(row => row.kind === 'notification_intent_v2' && JSON.stringify(row.batch).includes(output.message));
  assert.equal(intents.length, hasIntent ? 1 : 0);
  if (hasIntent) {
    assert.equal(intents[0].owner, parent[0].id);
    assert.ok(child.some(row => row.kind === 'async_hook_lifecycle' && row.jobId === intents[0].batch.jobId));
  }
  assert.equal(child.some(row => row.kind === 'notification_intent_v2'), false);
  for (let i = 0; i < 2; i++) {
    const readback = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
      import {Session,readSessionJournal} from ${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)};
      import {hookDefinitionSchema} from ${JSON.stringify(new URL('../dist/hooks.js', import.meta.url).href)};
      const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
      const child=Session.open(process.argv[1],{id:process.argv[3],recoverLock:true});
      for(const owner of [s,child]){
        assert.deepEqual(readSessionJournal(process.argv[1],owner.id,{maxBytes:10000000,maxEvents:10000}),owner.events);
        const execution=owner.hookResolverObservations[0];assert.ok(execution);assert.equal(owner.hookResolverObservations.length,1);
        assert.equal(execution.resolver,'fulfilled');assert.equal(execution.runner,'backgrounded');assert.ok(execution.asyncJob);
        assert.equal(execution.event.definitionSha256,createHash('sha256').update(JSON.stringify(hookDefinitionSchema.parse(owner.config.hooks.SessionStart[0]))).digest('hex'));
      }
      console.log(JSON.stringify({unknown:s.notificationCoordination,messages:s.messages,
        childLifecycle:child.events.filter(e=>e.kind==='async_hook_lifecycle'),childUnknown:child.notificationCoordination}));child.close();s.close();`, root, parent[0].id, child[0].id],
      { encoding: 'utf8', timeout: 10000 });
    assert.equal(readback.status, 0, readback.stderr);
    const restored = JSON.parse(readback.stdout);
    const deliveryUnknown = restored.unknown.filter(row => row.deliveryId === intents[0]?.deliveryId);
    assert.equal(deliveryUnknown.length, hasIntent && !hasMessage ? 1 : 0);
    if (deliveryUnknown.length) assert.equal(deliveryUnknown[0].state, 'unknown');
    assert.equal(JSON.stringify(restored.messages).includes(output.message), hasMessage);
    assert.deepEqual(restored.childUnknown, []);
    assert.deepEqual(restored.childLifecycle, child.filter(row => row.kind === 'async_hook_lifecycle'));
  }
  assert.equal(read(path.join(root, 'commands.jsonl')).length, 2, 'cold readers must not replay hooks');
  console.log(JSON.stringify({ agentMessaging, adopted, cut, ...observation, executionBindings: true, coldReaders: 2 }));
} finally { fs.rmSync(root, { recursive: true, force: true }); }
}
