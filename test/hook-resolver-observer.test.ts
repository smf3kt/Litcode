import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { hookDefinitionSchema, type HookDefinition, type RawHookResult } from '../src/hooks.js';
import type { ModelProvider } from '../src/provider.js';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { AsyncHookRegistry } from '../src/async-hooks.js';

const provider: ModelProvider = { count: async () => 1, complete: async () => { throw Error('unexpected model call'); } };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('configured async commands retain original definition and durable job identity through actual execution', async () => {
  for (const mode of ['normal', 'rewake', 'closed'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'configured-observer-')));
    const definition: HookDefinition = { command: 'touch entered; while [ ! -f released ]; do sleep 0.01; done; printf "{}"',
      ...(mode === 'rewake' ? { asyncRewake: true } : { async: true }), timeout: 5, once: true };
    let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture', hooks: { Notification: [definition] } } });
    const registry = new AsyncHookRegistry({ workspace: root, journalOwner: session });
    try {
      const agent = new Agent(session, provider, [], { hookOptions: { startAsyncCommand: registry.start } });
      await agent.emitHook('Notification', {});
      let state = session.hookResolverObservations[0]; assert.ok(state);
      assert.equal(state.resolver, 'pending'); assert.equal(state.runner, 'backgrounded');
      assert.equal(state.event.definitionSha256, createHash('sha256').update(JSON.stringify(hookDefinitionSchema.parse(definition))).digest('hex'));
      const job = registry.list()[0]; assert.ok(job);
      assert.equal(state.asyncJob?.jobId, job.id);
      assert.ok(session.events.some(e => e.kind === 'hook_result' && e.backgroundTasks?.includes(job.id)));
      if (mode === 'closed') { const id = session.id; session.close(); session = Session.open(root, { id }); }
      fs.writeFileSync(path.join(root, 'released'), ''); await registry.wait(job.id); await tick();
      state = session.hookResolverObservations[0]; assert.ok(state);
      assert.equal(state.resolver, mode === 'closed' ? 'pending' : 'fulfilled');
      assert.equal(fs.existsSync(path.join(root, 'entered')), true);
      const id = session.id; session.close(); session = Session.open(root, { id });
      assert.deepEqual(readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      assert.deepEqual(session.hookResolverObservations, [state]);
      const fork = forkSession(session); try { assert.deepEqual(fork.hookResolverObservations, []); } finally { fork.close(); }
    } finally {
      fs.writeFileSync(path.join(root, 'released'), ''); await registry.close().catch(() => {}); session.close(); fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('configured async grants reject changed requests and do not attest copies or fake registration', async () => {
  for (const mode of ['changed', 'copied', 'fake', 'reused'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'configured-binding-')));
    const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
      hooks: { Notification: [{ command: 'printf x >> executed', async: true }] } } });
    const registry = new AsyncHookRegistry({ workspace: root, journalOwner: session });
    try {
      const agent = new Agent(session, provider, [], { hookOptions: { startAsyncCommand: async request => {
        if (mode === 'fake') return 'unproven-owner-id';
        if (mode === 'changed') request.definition.command = 'touch changed';
        const id = await registry.start(mode === 'copied' ? { ...request } : request);
        if (mode === 'reused') await registry.start(request);
        return id;
      } } });
      await agent.emitHook('Notification', {});
      for (const job of registry.list()) await registry.wait(job.id);
      assert.equal(session.hookResolverObservations.length, mode === 'reused' ? 1 : 0);
      assert.equal(fs.existsSync(path.join(root, 'changed')), false);
      assert.equal(fs.existsSync(path.join(root, 'executed')), mode === 'copied' || mode === 'reused');
      if (mode === 'reused') assert.equal(fs.readFileSync(path.join(root, 'executed'), 'utf8'), 'x');
    } finally { await registry.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('configured async association rejects missing cold job identity and prevents spawn on binding write failure', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'configured-binding-fault-')));
  let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
    hooks: { Notification: [{ command: 'touch executed', async: true }] } } });
  const registry = new AsyncHookRegistry({ workspace: root, journalOwner: session });
  const write = fs.writeSync;
  try {
    fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
      if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"hook_resolver"') && args[1].includes('"phase":"async_job"')) throw Error('binding journal fixture');
      return Reflect.apply(target, receiver, args);
    } });
    await assert.rejects(new Agent(session, provider, [], { hookOptions: { startAsyncCommand: registry.start } }).emitHook('Notification', {}), /binding journal fixture|journal write failed/);
  } finally { fs.writeSync = write; }
  try {
    for (const job of registry.list()) await registry.wait(job.id);
    assert.equal(fs.existsSync(path.join(root, 'executed')), false);
    const id = session.id; session.close(); session = Session.open(root, { id });
    assert.equal(session.hookResolverObservations[0]?.resolver, 'pending');
    assert.equal(session.hookResolverObservations[0]?.asyncJob, undefined);
    const file = session.file; session.close();
    const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const admission = rows.find(row => row.kind === 'hook_resolver'); assert.ok(admission);
    rows.push({ ...admission, transition: { phase: 'async_job', jobId: '00000000-0000-4000-8000-000000000000', generation: '00000000-0000-4000-8000-000000000001' } });
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.throws(() => Session.open(root, { id }), /Invalid hook resolver history/);
  } finally { await registry.close().catch(() => {}); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('command observations separate real process completion from successful or rejected header handoff', async () => {
  for (const mode of ['complete', 'nonzero', 'spawn_error', 'timeout', 'abort', 'adopt', 'reject', 'closed'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'command-observer-')));
    const header = ['adopt', 'reject', 'closed'].includes(mode);
    const command = header ? `printf '{"async":true}\\n'; while [ ! -f released ]; do sleep 0.01; done; printf '{"additionalContext":"done"}\\n'` :
      mode === 'timeout' || mode === 'abort' ? 'sleep 10' : `printf '{}'; exit ${mode === 'nonzero' ? 7 : 0}`;
    let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
      hooks: { Notification: [{ command, timeout: mode === 'timeout' ? 0.05 : 5 }] } } });
    const registry = new AsyncHookRegistry({ workspace: root, journalOwner: session });
    const controller = new AbortController();
    let releaseTimer: NodeJS.Timeout | undefined;
    try {
      const agent = new Agent(session, provider, [], { hookOptions: { startAsyncCommand: async request => {
        if (mode === 'reject') { releaseTimer = setTimeout(() => fs.writeFileSync(path.join(root, 'released'), ''), 30); throw Error('reject handoff'); }
        assert.ok(request.handle); return registry.adopt(request, request.handle, 'owned-fixture');
      } } });
      if (mode === 'abort') releaseTimer = setTimeout(() => controller.abort(), 30);
      const run = agent.emitHook('Notification', mode === 'spawn_error' ? { cwd: path.join(root, 'missing') } : {}, controller.signal);
      if (mode === 'abort') await assert.rejects(run, /abort/i); else await run;
      let state = session.hookResolverObservations[0]; assert.ok(state);
      assert.equal(state.event.resolverType, 'command');
      const backgrounded = mode === 'adopt' || mode === 'closed';
      assert.equal(state.runner, backgrounded ? 'backgrounded' : mode === 'timeout' ? 'timed_out' : mode === 'abort' ? 'aborted' : 'completed');
      assert.equal(state.resolver, backgrounded ? 'pending' : mode === 'spawn_error' ? 'rejected' : 'fulfilled');
      assert.equal(state.asyncJob?.jobId, backgrounded ? registry.list()[0]?.id : undefined);
      if (backgrounded) {
        if (mode === 'closed') { const id = session.id; session.close(); session = Session.open(root, { id }); }
        fs.writeFileSync(path.join(root, 'released'), '');
        const job = registry.list()[0]; assert.ok(job);
        await registry.wait(job.id); await tick();
        state = session.hookResolverObservations[0]; assert.ok(state);
        assert.equal(state.resolver, mode === 'closed' ? 'pending' : 'fulfilled');
      }
      const id = session.id; session.close(); session = Session.open(root, { id });
      assert.deepEqual(readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      assert.deepEqual(session.hookResolverObservations, [state]);
      const fork = forkSession(session); try { assert.deepEqual(fork.hookResolverObservations, []); } finally { fork.close(); }
      if (mode === 'adopt') {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const job = rows.find(row => row.kind === 'async_hook_lifecycle' && row.transition.phase === 'admitted'); assert.ok(job);
        job.transition.mode = 'configured';
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(root, { id }), /Invalid hook resolver history/);
        assert.throws(() => readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), /Invalid hook resolver history/);
      }
    } finally {
      if (releaseTimer) clearTimeout(releaseTimer);
      fs.writeFileSync(path.join(root, 'released'), '');
      if (mode === 'closed') await registry.close().catch(() => {}); else await registry.close();
      session.close(); fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('failed adopted job admission or association restores actual foreground cancellation', { timeout: 10000 }, async () => {
  for (const phase of ['admitted', 'adopted_job'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adopted-observer-fault-')));
    let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
      hooks: { Notification: [{ command: `printf '{"async":true}\\n'; sleep 10; touch forbidden`, timeout: 2 }] } } });
    const registry = new AsyncHookRegistry({ workspace: root, journalOwner: session });
    const controller = new AbortController();
    let completion: Promise<RawHookResult> | undefined;
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes(phase === 'admitted' ? '"kind":"async_hook_lifecycle"' : '"kind":"hook_resolver"') && args[1].includes(`"phase":"${phase}"`)) {
          setImmediate(() => controller.abort()); throw Error('adopted binding fixture');
        }
        return Reflect.apply(target, receiver, args);
      } });
      await assert.rejects(new Agent(session, provider, [], { hookOptions: {
        onCommandHandle: handle => { completion = handle.done; },
        startAsyncCommand: request => { assert.ok(request.handle); return registry.adopt(request, request.handle, 'failed-binding'); },
      } }).emitHook('Notification', {}, controller.signal), /binding fixture|journal write failed|abort/i);
    } finally { fs.writeSync = write; }
    try {
      assert.ok(completion); const raw = await completion;
      assert.equal(raw.aborted, true); assert.equal(raw.timedOut, false);
      assert.equal(fs.existsSync(path.join(root, 'forbidden')), false);
      const id = session.id; session.close(); session = Session.open(root, { id });
      assert.equal(session.hookResolverObservations[0]?.asyncJob, undefined);
      assert.equal(session.hookResolverObservations[0]?.resolver, 'pending');
    } finally { await registry.close(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('command observation write failures prevent spawn or preserve unknown settlement', async () => {
  for (const failure of ['admitted', 'settled', 'returned'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'command-observer-fault-')));
    let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
      hooks: { Notification: [{ command: 'touch executed' }] } } });
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"hook_resolver"') && args[1].includes(`"phase":"${failure}"`)) throw Error('command journal fixture');
        return Reflect.apply(target, receiver, args);
      } });
      await assert.rejects(new Agent(session, provider, []).emitHook('Notification', {}), /command journal fixture|journal write failed/);
    } finally { fs.writeSync = write; }
    try {
      assert.equal(fs.existsSync(path.join(root, 'executed')), failure !== 'admitted');
      const id = session.id; session.close(); session = Session.open(root, { id });
      assert.equal(session.hookResolverObservations[0]?.resolver, failure === 'admitted' ? undefined : failure === 'settled' ? 'pending' : 'fulfilled');
      assert.equal(session.hookResolverObservations[0]?.runner, undefined);
    } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('HTTP observations wait for the actual response body or cancellation, without claiming remote effects', async () => {
  for (const mode of ['body', 'status', 'malformed', 'disconnect', 'timeout', 'abort'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'http-observer-')));
    const controller = new AbortController();
    let release = () => {}, received = 0, pendingAtRequest = false;
    let requestArrived = () => {};
    const arrived = new Promise<void>(resolve => { requestArrived = resolve; });
    let session: Session | undefined;
    const server = http.createServer((request, response) => {
      received++;
      pendingAtRequest = session?.hookResolverObservations[0]?.resolver === 'pending';
      request.resume();
      if (mode === 'disconnect') request.socket.destroy();
      else if (mode === 'status') { response.writeHead(503); response.end('{}'); }
      else if (mode === 'malformed') response.end('not json');
      else {
        response.writeHead(200, { 'content-type': 'application/json' }); response.flushHeaders();
        release = () => response.end('{"additionalContext":"body finished"}');
        if (mode === 'abort') controller.abort();
      }
      requestArrived();
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const definition: HookDefinition = { type: 'http', url: `http://127.0.0.1:${address.port}`, timeout: mode === 'timeout' ? 0.5 : 5 };
    session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture', hooks: { Notification: [definition] } } });
    try {
      const run = new Agent(session, provider, []).emitHook('Notification', {}, controller.signal);
      const checked = mode === 'abort' ? assert.rejects(run, /abort/i) : run;
      await arrived;
      if (mode === 'body') {
        await tick();
        assert.equal(session.hookResolverObservations[0]?.resolver, 'pending');
        assert.equal(session.hookResolverObservations[0]?.runner, undefined);
        release();
      }
      await checked;
      assert.equal(received, 1); assert.equal(pendingAtRequest, true);
      const state = session.hookResolverObservations[0]; assert.ok(state);
      assert.equal(state.event.resolverType, 'http');
      assert.equal(state.resolver, ['disconnect', 'timeout', 'abort'].includes(mode) ? 'rejected' : 'fulfilled');
      assert.equal(state.runner, mode === 'timeout' ? 'timed_out' : mode === 'abort' ? 'aborted' : 'completed');
      assert.equal(state.event.definitionSha256, createHash('sha256').update(JSON.stringify(hookDefinitionSchema.parse(definition))).digest('hex'));
      assert.throws(() => session?.append(structuredClone(state.event)), /Hook resolver authorization/);
      const id = session.id; session.close(); session = Session.open(root, { id });
      assert.deepEqual(readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      assert.deepEqual(session.hookResolverObservations, [state]);
      const fork = forkSession(session); try { assert.deepEqual(fork.hookResolverObservations, []); } finally { fork.close(); }
    } finally {
      release(); session.close(); server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve())); fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('HTTP journal faults stop the request or preserve unknown local settlement', async () => {
  for (const failure of ['admitted', 'settled', 'returned'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'http-observer-fault-')));
    let requests = 0;
    const server = http.createServer((request, response) => { requests++; request.resume(); response.end('{}'); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
      hooks: { Notification: [{ type: 'http', url: `http://127.0.0.1:${address.port}` }] } } });
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"hook_resolver"') && args[1].includes(`"phase":"${failure}"`)) throw Error('HTTP journal fixture');
        return Reflect.apply(target, receiver, args);
      } });
      await assert.rejects(new Agent(session, provider, []).emitHook('Notification', {}), /HTTP journal fixture|journal write failed/);
    } finally { fs.writeSync = write; }
    try {
      assert.equal(requests, failure === 'admitted' ? 0 : 1);
      const id = session.id; session.close(); session = Session.open(root, { id });
      assert.equal(session.hookResolverObservations[0]?.resolver, failure === 'admitted' ? undefined : failure === 'settled' ? 'pending' : 'fulfilled');
      assert.equal(session.hookResolverObservations[0]?.runner, undefined);
    } finally {
      session.close(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('actual hook resolvers bind selection and distinguish runner return from late completion', async () => {
  for (const type of ['prompt', 'agent', 'callback', 'mcp_tool'] as const) {
    for (const mode of ['complete', 'throw', 'timeout', 'reject', 'abort', 'close'] as const) {
      const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-observer-')));
      let release = (_value: unknown) => {}, reject = (_error: Error) => {}, effects = 0;
      const completion = new Promise<unknown>((resolve, fail) => { release = resolve; reject = fail; });
      const definition: HookDefinition = type === 'callback' ? { type, name: 'selected', timeout: 0.01 } :
        type === 'mcp_tool' ? { type, tool: 'mcp__fixture__selected', timeout: 0.01 } : { type, prompt: 'selected', timeout: 0.01 };
      let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture', hooks: { Notification: [definition] } } });
      const controller = new AbortController();
      const resolver = async () => {
        assert.equal(session.hookResolverObservations.at(-1)?.resolver, 'pending');
        if (mode === 'throw') throw Error('actual resolver failure');
        if (mode === 'complete') { effects++; return { ok: true }; }
        if (mode === 'abort') controller.abort();
        const value = await completion; effects++; return value;
      };
      try {
        const agent = new Agent(session, provider, [], { hookOptions: {
          resolveModelHook: resolver, resolveCallbackHook: resolver, resolveMcpHook: resolver,
        } });
        const run = agent.emitHook('Notification', {}, controller.signal);
        if (mode === 'abort') await assert.rejects(run, /abort/i); else await run;
        let observed = session.hookResolverObservations[0]; assert.ok(observed);
        assert.equal(observed.event.resolverType, type);
        assert.equal(observed.event.definitionSha256, createHash('sha256').update(JSON.stringify(hookDefinitionSchema.parse(definition))).digest('hex'));
        assert.equal(observed.runner, mode === 'complete' || mode === 'throw' ? 'completed' : mode === 'abort' ? 'aborted' : 'timed_out');
        assert.equal(observed.resolver, mode === 'complete' ? 'fulfilled' : mode === 'throw' ? 'rejected' : 'pending');
        assert.throws(() => session.append(structuredClone(observed.event)), /Hook resolver authorization/);
        if (!['complete', 'throw'].includes(mode)) {
          assert.equal(effects, 0);
          if (mode === 'close') { const id = session.id; session.close(); session = Session.open(root, { id }); }
          if (mode === 'reject') reject(Error('late rejection')); else release({ ok: true });
          await tick(); observed = session.hookResolverObservations[0]; assert.ok(observed);
          assert.equal(observed.resolver, mode === 'close' ? 'pending' : mode === 'reject' ? 'rejected' : 'fulfilled');
          assert.equal(effects, mode === 'reject' ? 0 : 1);
        }
        const id = session.id; session.close(); session = Session.open(root, { id });
        assert.deepEqual(readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
        assert.deepEqual(session.hookResolverObservations[0], observed);
        const fork = forkSession(session); try { assert.deepEqual(fork.hookResolverObservations, []); } finally { fork.close(); }
      } finally { release({ ok: true }); await tick(); session.close(); fs.rmSync(root, { recursive: true, force: true }); }
    }
  }
});

test('resolver journal faults stop admission or retain unknown return and reject corrupt cold binding', async () => {
  for (const failure of ['admitted', 'settled', 'returned'] as const) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-observer-fault-')));
    let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture', hooks: { Notification: [{ type: 'callback', name: 'fixture' }] } } });
    const write = fs.writeSync; let effects = 0;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"hook_resolver"') && args[1].includes(`"phase":"${failure}"`)) throw Error('resolver journal fixture');
        return Reflect.apply(target, receiver, args);
      } });
      await assert.rejects(new Agent(session, provider, [], { hookOptions: { resolveCallbackHook: async () => { effects++; return {}; } } }).emitHook('Notification', {}),
        /resolver journal fixture|journal write failed/);
    } finally { fs.writeSync = write; }
    try {
      assert.equal(effects, failure === 'admitted' ? 0 : 1);
      const id = session.id; session.close(); session = Session.open(root, { id });
      const state = session.hookResolverObservations[0];
      assert.equal(state?.resolver, failure === 'admitted' ? undefined : failure === 'settled' ? 'pending' : 'fulfilled');
      assert.equal(state?.runner, undefined);
      if (state) {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'hook_resolver').hookId = '00000000-0000-4000-8000-000000000000';
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(root, { id }), /Invalid hook resolver history/);
      }
    } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('resolver selection records the actual live definition after matching and once filtering', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'resolver-observer-selection-')));
  let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
    hooks: { PreToolUse: [{ type: 'callback', name: 'old' }] } } });
  const names: string[] = [];
  try {
    session.config.hooks = { PreToolUse: [
      { matcher: 'write_file', hooks: [{ type: 'callback', name: 'unmatched' }] },
      { matcher: 'read_file', hooks: [{ type: 'callback', name: 'live-once', once: true }, { type: 'callback', name: 'live-always' }] },
    ] };
    const agent = new Agent(session, provider, [], { hookOptions: { resolveCallbackHook: async definition => { names.push(definition.name); return {}; } } });
    await agent.emitHook('PreToolUse', { tool_name: 'read_file' });
    await agent.emitHook('PreToolUse', { tool_name: 'read_file' });
    assert.deepEqual(names, ['live-once', 'live-always', 'live-always']);
    const records = session.hookResolverObservations;
    assert.equal(records.length, 3);
    assert.ok(records.every(row => row.runner === 'completed' && row.resolver === 'fulfilled'));
    assert.deepEqual(records.map(row => row.event.definitionKey.split(':').slice(0, 3)),
      [['PreToolUse', '1', '0'], ['PreToolUse', '1', '1'], ['PreToolUse', '1', '1']]);
    assert.equal(records[1]?.event.definitionSha256, records[2]?.event.definitionSha256);
    const id = session.id; session.close(); session = Session.open(root, { id });
    assert.deepEqual(session.config.hooks?.PreToolUse, [{ type: 'callback', name: 'old' }]);
    assert.deepEqual(session.hookResolverObservations, records);
    assert.doesNotMatch(fs.readFileSync(session.file, 'utf8'), /live-once|live-always/);
  } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
