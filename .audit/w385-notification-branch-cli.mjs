import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultConfig } from '../dist/agent.js';
import { createRuntime, pinToolSchemas } from '../dist/runtime.js';
import { Session, renderNotificationBatch } from '../dist/session.js';
import { bindNotificationMessage, issueNotificationAuthorization } from '../dist/notification-authorization.js';
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'notification-branch-cli-')));
const mode = process.argv.find(arg => arg.startsWith('--mode='))?.slice(7) ?? 'branch';
assert.ok(['branch', 'reload', 'model'].includes(mode));
const unknown = process.argv.includes('--unknown');
const command = mode === 'reload' ? '/reload' : mode === 'model' ? '/model fixture-next' : '/branch copied';
let runtime, source;
try {
  const user = path.join(root, 'user'); fs.mkdirSync(user);
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [], configSources: { userDir: user } };
  runtime = await createRuntime(config, { count: async () => 1, complete: async () => { throw Error('no provider calls'); } }, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools); source = Session.open(root, { config }); await runtime.bindSession(source);
  const payload = { cwd: root, session_id: source.id };
  await runtime.hookOptions(source.config, source.id).startAsyncCommand({ definition: { command: `printf x >> runs; printf '{"systemMessage":"BRANCH_CLI_OUTPUT"}'`, async: true },
    event: 'SessionStart', payload, input: JSON.stringify({ ...payload, hook_event_name: 'SessionStart' })+'\n', cwd: root, timeoutMs: 5000, signal: new AbortController().signal });
  for (let i=0;i<500&&!source.events.some(row=>row.kind==='notification_intent_v2');i++) await new Promise(resolve=>setTimeout(resolve,10));
  const intent = source.events.find(row=>row.kind==='notification_intent_v2'); assert.ok(intent);
  const message = { role: 'user', content: renderNotificationBatch(intent.batch) };
  const authorization = issueNotificationAuthorization(source, intent.deliveryId, intent.batch, ()=>true, ()=>intent.batch);
  bindNotificationMessage(authorization, source, message);
  source.append({ kind:'message', message, notificationDelivery:{ owner:source.id, deliveryId:intent.deliveryId } }, authorization);
  source.append({kind:'message',message:{role:'assistant',content:'done'}}); source.append({kind:'turn_end',reason:'end_turn'});
  const original = source.id; await runtime.close(); source.close();
  if (unknown) fs.unlinkSync(`${source.file}.notification-${intent.deliveryId}.receipt`);
  const preload = path.join(root,'offline.mjs'); fs.writeFileSync(preload,"globalThis.fetch=()=>{throw Error('network disabled')};");
  const cli = spawnSync(process.execPath,['bin/litcode.mjs','--workspace',root,'--resume',original,'--interactive','--no-tui','--no-inherit-gateway'],
    {input:command+'\n',encoding:'utf8',timeout:20000,env:{...process.env,HOME:user,LLM_API_KEY:'fixture-only',NODE_OPTIONS:`--import=${preload}`}});
  assert.equal(cli.status,0,cli.stderr+cli.stdout); assert.doesNotMatch(cli.stderr+cli.stdout,/owner mismatch|Branch failed/i);
  const files=fs.readdirSync(path.join(root,'.agent')).filter(name=>name.endsWith('.jsonl')&&!name.startsWith(original)); assert.equal(files.length,1);
  const branchId=files[0].slice(0,-6);
  for(let i=0;i<2;i++) {
    const reader=spawnSync(process.execPath,['--input-type=module','-e',`import {Session} from ${JSON.stringify(new URL('../dist/session.js',import.meta.url).href)};
      const s=Session.open(process.argv[1],{id:process.argv[2]});console.log(JSON.stringify({model:s.config.model,messages:s.messages,inherited:s.events.filter(r=>r.kind==='message'&&r.inheritedNotification).length,intents:s.events.filter(r=>r.kind==='notification_intent_v2').length,unknown:s.notificationCoordination}));s.close();`,root,branchId],{encoding:'utf8',timeout:10000});
    assert.equal(reader.status,0,reader.stderr); const data=JSON.parse(reader.stdout);
    assert.equal(data.inherited,unknown?0:1);assert.equal(data.intents,0);assert.deepEqual(data.unknown,[]);
    if(unknown)assert.doesNotMatch(JSON.stringify(data.messages),/BRANCH_CLI_OUTPUT/);
    else assert.match(JSON.stringify(data.messages),/BRANCH_CLI_OUTPUT/);
    assert.equal(data.model,mode==='model'?'fixture-next':'fixture');
  }
  assert.equal(fs.readFileSync(path.join(root,'runs'),'utf8'),'x');
  assert.equal(fs.readdirSync(path.join(root,'.agent')).some(name=>name.endsWith('.lock')),false);
  const originalRead = Session.open(root,{id:original});
  try { assert.equal(originalRead.notificationCoordination.length,unknown?1:0); }
  finally { originalRead.close(); }
  console.log(JSON.stringify({cli:'resume then '+command,unknownSource:unknown,inherited:unknown?0:1,intents:0,coldReaders:2,commandRuns:1,locksReleased:true}));
} finally { await runtime?.close();source?.close();fs.rmSync(root,{recursive:true,force:true}); }
