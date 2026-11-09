import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { Session, readSessionJournal, renderNotificationBatch } from '../src/session.js';
import { fixtureAppend } from './notification-fixture.js';
import { issueNotificationAuthorization } from '../src/notification-authorization.js';
import { forkSession } from '../src/sessions.js';
import { checkpointConversation, previewRewind, applyRewind } from '../src/rewind.js';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

test('compiled registry and legacy children deliver hook attachments to the root and recover without replay', { timeout: 60000 }, () => {
  const result = spawnSync(process.execPath, ['scripts/smoke-child-hook-delivery.mjs'], { encoding: 'utf8', timeout: 55000 });
  assert.equal(result.status, 0, result.stderr);
  const reports = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(reports.length, 2);
  assert.ok(reports.every(report => report.parentModelSawOutput && report.parentDeliveryIntent && report.coldReaders === 2));
});

test('compiled child-to-root delivery preserves distinct lifecycle and receipt states across process death', { timeout: 60000 }, () => {
  const result = spawnSync(process.execPath, ['scripts/smoke-child-hook-delivery.mjs', '--death-cuts'], { encoding: 'utf8', timeout: 55000 });
  assert.equal(result.status, 0, result.stderr);
  const reports = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(reports.length, 10);
  assert.ok(reports.every(report => report.childCommandCompleted && !report.parentModelSawOutput && report.coldReaders === 2));
});

test('fork skills preserve root hook delivery through cached tool sets and queue retirement', async () => {
  const root = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [],
    hooks: { SessionStart: [{ command: `printf '{"systemMessage":"SKILL_CHILD_OUTPUT"}'`, async: true }] } };
  const runtime = await createRuntime(config, { count: async () => 1, complete: async () => ({
    id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'done', citations: null }],
    container: null, diagnostics: null, stop_details: null, stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
  }) }, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(root, { config });
  const skill = { name: 'hook-fixture', description: 'fixture', body: 'Return done', path: 'fixture/SKILL.md',
    userInvocable: true, disableModelInvocation: false, context: 'fork' as const };
  try {
    await runtime.bindSession!(session);
    for (let i = 0; i < 2; i++) await runtime.runSkill!(session.config, session.id, skill, '', controller.signal);
    const intents = session.events.filter(event => event.kind === 'notification_intent_v2');
    assert.equal(intents.length, 2);
    assert.ok(intents.every(event => event.kind === 'notification_intent_v2' && event.owner === session.id
      && JSON.stringify(event.batch).includes('SKILL_CHILD_OUTPUT')));
    const children = fs.readdirSync(path.join(root, '.agent')).filter(file => file.endsWith('.jsonl') && file !== `${session.id}.jsonl`);
    assert.equal(children.length, 2);
    for (const file of children) {
      const child = Session.open(root, { id: file.slice(0, -6) });
      try {
        const execution = child.hookResolverObservations[0]; assert.ok(execution);
        assert.equal(child.hookResolverObservations.length, 1);
        assert.equal(execution.event.owner, child.id); assert.equal(execution.event.event, 'SessionStart');
        assert.equal(execution.resolver, 'fulfilled'); assert.equal(execution.runner, 'backgrounded');
        assert.ok(execution.asyncJob);
        assert.ok(intents.some(event => event.kind === 'notification_intent_v2' && event.batch.kind === 'async_hook' && event.batch.jobId === execution.asyncJob?.jobId));
        assert.deepEqual(readSessionJournal(root, child.id, { maxBytes: 1000000, maxEvents: 1000 }), child.events);
      } finally { child.close(); }
    }
    await runtime.releaseSession!(session.id);
    assert.deepEqual(runtime.drainEvents!(session.id), []);
    const id = session.id; session.close();
    for (let i = 0; i < 2; i++) {
      const recovered = cold(root, id);
      assert.equal(recovered.unknown.length, 2);
      assert.equal(JSON.stringify(recovered.messages).includes('SKILL_CHILD_OUTPUT'), false);
    }
  } finally { await runtime.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('confirmed hook conversations fork without transferring delivery ownership, while unknown messages stay isolated', async () => {
  const root = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [] };
  const runtime = await createRuntime(config, { count: async () => 1, complete: async () => { throw Error('no model'); } }, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  let source = Session.open(root, { config }); let fork: Session | undefined;
  try {
    await runtime.bindSession!(source);
    const payload = { cwd: root, session_id: source.id };
    await runtime.hookOptions!(source.config, source.id).startAsyncCommand!({ definition: { command: `printf '{"systemMessage":"BRANCH_OUTPUT"}'`, async: true },
      event: 'SessionStart', payload, input: `${JSON.stringify({ ...payload, hook_event_name: 'SessionStart' })}\n`, cwd: root, timeoutMs: 5000, signal: controller.signal });
    for (let i = 0; i < 200 && !source.events.some(event => event.kind === 'notification_intent_v2'); i++) await delay(5);
    const intent = source.events.find(event => event.kind === 'notification_intent_v2'); assert.ok(intent?.kind === 'notification_intent_v2');
    fixtureAppend(source, { kind: 'message', message: { role: 'user', content: renderNotificationBatch(intent.batch) }, notificationDelivery: { owner: source.id, deliveryId: intent.deliveryId } });
    source.append({ kind: 'message', message: { role: 'assistant', content: 'done' } }); source.append({ kind: 'turn_end', reason: 'end_turn' });
    fork = forkSession(source);
    assert.deepEqual(fork.messages, source.messages);
    assert.equal(fork.events.some(event => event.kind === 'notification_intent_v2' || event.kind === 'message' && event.notificationDelivery), false);
    assert.ok(intent.batch.kind === 'async_hook');
    assert.deepEqual(fork.sessionStartAttachments(intent.batch.commandScope!), source.sessionStartAttachments(intent.batch.commandScope!));
    const descendant = forkSession(fork);
    try {
      assert.deepEqual(descendant.messages, source.messages);
      assert.deepEqual(descendant.sessionStartAttachments(intent.batch.commandScope!), source.sessionStartAttachments(intent.batch.commandScope!));
      assert.equal(descendant.notificationCoordination.length, 0);
    } finally { descendant.close(); }
    checkpointConversation(fork, 'with-notification', controller.signal);
    fork.append({ kind: 'message', message: { role: 'user', content: 'later' } });
    fork.append({ kind: 'message', message: { role: 'assistant', content: 'later done' } }); fork.append({ kind: 'turn_end', reason: 'end_turn' });
    const preview = previewRewind(fork, 1, controller.signal);
    const rewound = applyRewind(fork, preview, preview.token, controller.signal);
    try { assert.deepEqual(rewound.messages, source.messages); assert.equal(rewound.notificationCoordination.length, 0); }
    finally { rewound.close(); }
    assert.throws(() => fork!.append({ kind: 'message', message: { role: 'user', content: 'different' },
      inheritedNotification: { owner: source.id, deliveryId: intent.deliveryId, batch: intent.batch } }), /Inherited notification/);
    const forkId = fork.id; fork.close();
    for (let i = 0; i < 2; i++) { const read = cold(root, forkId); assert.equal(read.unknown.length, 0); assert.equal(read.inherited.length, 1); assert.match(JSON.stringify(read.messages), /BRANCH_OUTPUT/); }
    const forkFile = path.join(root, '.agent', `${forkId}.jsonl`);
    const rows = fs.readFileSync(forkFile, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    rows.find(row => row.kind === 'message' && row.inheritedNotification).message.content = 'tampered';
    fs.writeFileSync(forkFile, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.throws(() => Session.open(root, { id: forkId }), /Inherited notification/);
    await runtime.close(); const id = source.id, file = source.file; source.close();
    fs.unlinkSync(`${file}.notification-${intent.deliveryId}.receipt`);
    source = Session.open(root, { id });
    assert.equal(source.notificationCoordination.length, 1);
    fork = forkSession(source);
    assert.doesNotMatch(JSON.stringify(fork.messages), /BRANCH_OUTPUT/);
    assert.equal(fork.notificationCoordination.length, 0);
  } finally { await runtime.close(); fork?.close(); source.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`;
function temporary(): string { return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hook-delivery-'))); }
function cold(root: string, id: string) {
  const read = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import {Session} from ${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)};
    const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
    console.log(JSON.stringify({lifecycles:s.events.filter(e=>e.kind==='async_hook_lifecycle'),unknown:s.notificationCoordination,rows:s.events.filter(e=>e.kind==='notification_intent_v2'||e.kind==='message'&&e.notificationDelivery),inherited:s.events.filter(e=>e.kind==='message'&&e.inheritedNotification),messages:s.messages}));s.close();`, root, id],
  { encoding: 'utf8', timeout: 10000 });
  assert.equal(read.status, 0, read.stderr);
  return JSON.parse(read.stdout);
}

test('async delivery intents survive queue eviction and cold reads without replaying commands', { timeout: 20000 }, async () => {
  const root = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [] };
  const runtime = await createRuntime(config, { count: async () => 1, complete: async () => { throw Error('no model'); } }, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(root, { config });
  try {
    await runtime.bindSession!(session);
    const hooks = runtime.hookOptions!(session.config, session.id);
    const ids: string[] = [];
    for (let i = 0; i < 51; i++) {
      const payload = { cwd: root, session_id: session.id, tool_use_id: `tool-${i}` };
      ids.push(await hooks.startAsyncCommand!({ definition: { command: `printf x >> runs; printf '{"systemMessage":"RESULT_${i}"}'`, async: true },
        event: 'PostToolUse', payload, input: `${JSON.stringify({ ...payload, hook_event_name: 'PostToolUse' })}\n`, cwd: root,
        timeoutMs: 5000, signal: controller.signal }));
      for (let n = 0; n < 200 && session.events.filter(e => e.kind === 'notification_intent_v2').length <= i; n++) await delay(5);
      assert.equal(session.events.filter(e => e.kind === 'notification_intent_v2').length, i + 1);
    }
    const intents = session.events.filter(e => e.kind === 'notification_intent_v2');
    assert.equal(new Set(intents.map(e => e.deliveryId)).size, 51);
    assert.deepEqual(intents.map(e => e.batch.kind === 'async_hook' && e.batch.jobId), ids);
    const events = runtime.drainEvents!(session.id, session).filter(e => e.kind === 'async_hook');
    assert.equal(events.length, 50); assert.equal(events.some(e => e.jobId === ids[0]), false);
    const intent = intents.at(-1)!;
    assert.equal(intent.batch.kind, 'async_hook');
    assert.throws(() => issueNotificationAuthorization(session, intent.deliveryId,
      { kind: 'async_hook', jobId: ids[0]!, event: 'PostToolUse', prompt: renderNotificationBatch(intent.batch) },
      () => true, () => intent.batch), /differs/);
    fixtureAppend(session, { kind: 'message', message: { role: 'user', content: renderNotificationBatch(intent.batch) },
      notificationDelivery: { owner: session.id, deliveryId: intent.deliveryId } });
    await runtime.close(); session.close();
    for (let i = 0; i < 2; i++) {
      const read = cold(root, session.id);
      assert.equal(read.unknown.length, 50);
      assert.equal(read.unknown.some((e: { deliveryId: string }) => e.deliveryId === intents[0]!.deliveryId), true);
      assert.equal(read.unknown.some((e: { deliveryId: string }) => e.deliveryId === intent.deliveryId), false);
      assert.equal(read.rows.length, 52);
      assert.equal(read.messages.filter((message: { content: unknown }) => message.content === renderNotificationBatch(intent.batch)).length, 1);
    }
    assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'x'.repeat(51));
  } finally { await runtime.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('released hook callbacks cannot create delivery intents in a rebound session generation', async () => {
  const root = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [] };
  const runtime = await createRuntime(config, { count: async () => 1, complete: async () => { throw Error('no model'); } }, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  const original = Session.open(root, { config });
  let rebound: Session | undefined;
  try {
    await runtime.bindSession!(original);
    const old = runtime.hookOptions!(original.config, original.id);
    const payload = { cwd: root, session_id: original.id };
    const request = { definition: { command: 'touch entered; sleep 30', async: true }, event: 'PostToolUse' as const,
      payload, input: `${JSON.stringify({ ...payload, hook_event_name: 'PostToolUse' })}\n`, cwd: root, timeoutMs: 5000, signal: controller.signal };
    const previousId = await old.startAsyncCommand!(request);
    for (let i = 0; i < 200 && !fs.existsSync(path.join(root, 'entered')); i++) await delay(5);
    assert.equal(fs.existsSync(path.join(root, 'entered')), true);
    await runtime.releaseSession!(original.id);
    assert.equal(original.events.some(e => e.kind === 'notification_intent_v2'), false);
    assert.match(JSON.stringify(original.events), /"phase":"completed","state":"cancelled"/);
    original.close();
    rebound = Session.open(root, { id: original.id });
    await runtime.bindSession!(rebound);
    await assert.rejects(async () => old.startAsyncCommand!({ ...request, definition: { command: 'touch forbidden', async: true } }), /released/);
    const fresh = runtime.hookOptions!(rebound.config, rebound.id);
    const nextId = await fresh.startAsyncCommand!({ ...request, definition: { command: `printf '{"systemMessage":"FRESH"}'`, async: true } });
    for (let i = 0; i < 200 && !rebound.events.some(e => e.kind === 'notification_intent_v2'); i++) await delay(5);
    const intents = rebound.events.filter(e => e.kind === 'notification_intent_v2');
    assert.equal(intents.length, 1);
    assert.equal(intents[0]!.batch.kind === 'async_hook' && intents[0]!.batch.jobId, nextId);
    assert.notEqual(nextId, previousId);
    assert.equal(fs.existsSync(path.join(root, 'forbidden')), false);
    assert.deepEqual(runtime.drainEvents!(original.id, original), []);
    assert.equal(runtime.drainEvents!(rebound.id, rebound).filter(e => e.kind === 'async_hook').length, 1);
  } finally { await runtime.close(); original.close(); rebound?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('releasing a root cancels its running child hook without delivering into the reopened root', { timeout: 15000 }, async () => {
  const root = temporary(), controller = new AbortController();
  const config = { ...defaultConfig(root, []), model: 'fixture', skills: [],
    hooks: { SessionStart: [{ command: 'touch child-entered; sleep 30', async: true }] } };
  config.features = { tasks: false, subagents: true };
  const runtime = await createRuntime(config, { count: async () => 1, complete: async (_request, signal) => {
    signal.throwIfAborted();
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } }, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  const original = Session.open(root, { config }); let rebound: Session | undefined;
  try {
    await runtime.bindSession!(original);
    const launched = await runtime.launchSubtask!(original.config, original.id, 'Wait for cancellation', controller.signal,
      [{ role: 'user', content: 'Owned child fixture' }]);
    assert.equal(launched.kind, 'forked');
    for (let i = 0; i < 200 && !fs.existsSync(path.join(root, 'child-entered')); i++) await delay(5);
    assert.equal(fs.existsSync(path.join(root, 'child-entered')), true);
    await runtime.releaseSession!(original.id);
    assert.equal(original.events.some(row => row.kind === 'notification_intent_v2'), false);
    const childRows = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'))
      .map(name => fs.readFileSync(path.join(root, '.agent', name), 'utf8').trim().split('\n').map(line => JSON.parse(line)))
      .find(rows => rows[0].config.childMode !== undefined);
    assert.ok(childRows);
    assert.ok(childRows.some(row => row.kind === 'async_hook_lifecycle'
      && row.transition.phase === 'completed' && row.transition.state === 'cancelled'));
    original.close();
    rebound = Session.open(root, { id: original.id }); await runtime.bindSession!(rebound);
    assert.equal(rebound.events.some(row => row.kind === 'notification_intent_v2'), false);
    assert.deepEqual(runtime.drainEvents!(rebound.id, rebound), []);
    rebound.close();
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(cold(root, original.id).unknown, []);
      const child = cold(root, childRows[0].id);
      assert.deepEqual(child.unknown, []);
      assert.ok(child.lifecycles.some((row: { transition: { phase: string; state?: string } }) =>
        row.transition.phase === 'completed' && row.transition.state === 'cancelled'));
    }
  } finally { await runtime.close(); original.close(); rebound?.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('compiled CLI distinguishes lifecycle admission, completion, callback and delivery across process death', { timeout: 60000 }, () => {
  for (const cut of ['admitted', 'completed', 'pending', 'none', 'intent', 'message'] as const) {
    const root = temporary(), user = path.join(root, 'user'), settings = path.join(root, '.harness');
    const preload = path.join(root, 'provider.mjs'), identity = path.join(root, 'identity.json'), release = path.join(root, 'release');
    fs.mkdirSync(user); fs.mkdirSync(settings); fs.mkdirSync(path.join(root, '.git'));
    fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({ hooks: { PostToolUse: [{ async: true,
      command: `printf x >> runs; while [ ! -f ${quote(release)} ]; do sleep 0.01; done; printf '{"systemMessage":"DELIVERED_HOOK"}'`, timeout: 10,
    }] } }));
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
      const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
      const append=Session.prototype.append;let recorded=false;
      Session.prototype.append=function(event,...rest){const result=append.call(this,event,...rest);
        const lifecycle=event.kind==='async_hook_lifecycle';
        if(lifecycle&&event.transition.phase==='admitted')fs.writeFileSync(${JSON.stringify(identity)},JSON.stringify({id:this.id,jobId:event.jobId}));
        if(lifecycle&&(event.transition.phase===${JSON.stringify(cut)}||${JSON.stringify(cut)}==='pending'&&event.transition.phase==='callback'&&event.transition.state==='pending'))process.kill(process.pid,'SIGKILL');
        const intent=event.kind==='notification_intent_v2'&&event.batch.kind==='async_hook';
        if(intent){recorded=true;fs.writeFileSync(${JSON.stringify(identity)},JSON.stringify({id:this.id,deliveryId:event.deliveryId,jobId:event.batch.jobId}));}
        if((${JSON.stringify(cut)}==='intent'&&intent)||(${JSON.stringify(cut)}==='message'&&event.kind==='message'&&event.notificationDelivery))process.kill(process.pid,'SIGKILL');return result};
      const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let n=0;
      GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{const turn=n++;
        if(turn===1){fs.writeFileSync(${JSON.stringify(release)},'release');for(let i=0;i<1000&&!recorded;i++)await new Promise(r=>setTimeout(r,5));if(!recorded)throw Error('no intent');}
        if(turn===2&&!JSON.stringify(request.messages.at(-1)).includes('DELIVERED_HOOK'))throw Error('hook prompt absent');
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:turn===0?[{type:'tool_use',id:'delivery-write',name:'write_file',input:{path:'value.txt',content:'DELIVERY'}}]:[{type:'text',text:'done'}],
          stop_reason:turn===0?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
    try {
      const cli = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user, '--model', 'fixture-model',
        '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'], {
        cwd: process.cwd(), input: 'write the delivery fixture\n', encoding: 'utf8', timeout: 20000,
        env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
      });
      if (cut === 'none') assert.equal(cli.status, 0, cli.stderr + cli.stdout);
      else assert.equal(cli.signal, 'SIGKILL', cli.stderr + cli.stdout);
      const saved = JSON.parse(fs.readFileSync(identity, 'utf8'));
      if (cut === 'admitted' || cut === 'completed' || cut === 'pending') {
        for (let i = 0; i < 2; i++) {
          const read = cold(root, saved.id);
          assert.deepEqual(read.lifecycles.map((row: { transition: { phase: string } }) => row.transition.phase),
            cut === 'admitted' ? ['admitted'] : cut === 'completed' ? ['admitted', 'completed'] : ['admitted', 'completed', 'callback']);
          assert.equal(read.lifecycles.every((row: { owner: string; jobId: string }) => row.owner === saved.id && row.jobId === saved.jobId), true);
          assert.deepEqual(read.unknown, []); assert.deepEqual(read.rows, []);
        }
        assert.equal(fs.readFileSync(path.join(root, 'value.txt'), 'utf8'), 'DELIVERY');
        assert.equal(fs.existsSync(path.join(root, 'runs')), cut !== 'admitted');
        if (cut !== 'admitted') assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'x');
        continue;
      }
      assert.notEqual(saved.deliveryId, saved.jobId);
      for (let i = 0; i < 2; i++) {
        const read = cold(root, saved.id);
        assert.deepEqual(read.lifecycles.slice(0, 3).map((row: { transition: { phase: string } }) => row.transition.phase), ['admitted', 'completed', 'callback']);
        if (cut === 'intent') assert.deepEqual(read.lifecycles.at(-1).transition, { phase: 'callback', state: 'pending' });
        assert.equal(read.rows.filter((e: { kind: string }) => e.kind === 'notification_intent_v2').length, 1);
        assert.equal(read.rows.filter((e: { kind: string }) => e.kind === 'message').length, cut === 'intent' ? 0 : 1);
        assert.deepEqual(read.unknown, cut === 'intent' ? [{ deliveryId: saved.deliveryId, state: 'unknown' }] : []);
        assert.equal(JSON.stringify(read.messages).includes('DELIVERED_HOOK'), cut !== 'intent');
      }
      if (cut === 'intent') {
        const retryPreload = path.join(root, 'retry-provider.mjs'), seen = path.join(root, 'retry-seen');
        fs.writeFileSync(retryPreload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('network disabled')};
          const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
          GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async request=>{
            if(JSON.stringify(request.messages.at(-1)).includes('DELIVERED_HOOK'))fs.appendFileSync(${JSON.stringify(seen)},'x');
            return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',
              stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
        const retry = spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--resume', saved.id,
          '--interactive', '--no-tui', '--no-inherit-gateway'], { cwd: process.cwd(),
          input: `/continue\n/notification ${saved.id} ${saved.deliveryId} retry\n`, encoding: 'utf8', timeout: 20000,
          env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${retryPreload}` },
        });
        assert.equal(retry.status, 0, retry.stderr + retry.stdout);
        assert.equal(fs.readFileSync(seen, 'utf8'), 'x');
        const read = cold(root, saved.id);
        assert.deepEqual(read.unknown, []); assert.equal(read.rows.length, 3);
        const delivered = read.rows.find((e: { kind: string }) => e.kind === 'message');
        assert.notEqual(delivered.notificationDelivery.deliveryId, saved.deliveryId);
      }
      assert.equal(fs.readFileSync(path.join(root, 'value.txt'), 'utf8'), 'DELIVERY');
      assert.equal(fs.readFileSync(path.join(root, 'runs'), 'utf8'), 'x');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});
