import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig, type AgentEvents } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

function fixture(events: AgentEvents) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'permission-observer-')));
  let calls = 0, effects = 0;
  const tool: ToolDefinition = { readOnly: false, schema: { name: 'mutate', description: 'fixture', input_schema: { type: 'object', properties: {} } },
    async execute(input) { assert.deepEqual(input, { value: 'original' }); effects++; return 'DONE'; } };
  const session = Session.open(root, { config: { ...defaultConfig(root, [tool]), model: 'fixture', permissions: { mode: 'ask', allow: [], deny: [] } } });
  const provider: ModelProvider = { count: async () => 1, complete: async () => {
    const first = calls++ === 0;
    return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
      container: null, diagnostics: null, stop_details: null,
      content: first ? [{ type: 'tool_use', id: 'approval-call', name: 'mutate', input: { value: 'original' }, caller: { type: 'direct' } }]
        : [{ type: 'text', text: 'DONE', citations: null }], stop_reason: first ? 'tool_use' : 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
        cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  return { root, session, agent: new Agent(session, provider, [tool], events), effects: () => effects };
}

test('actual approval lookup and awaited decision preserve allow, deny, rejection, getter failure and copied input', async () => {
  for (const mode of ['allow', 'deny', 'reject', 'getter', 'absent', 'thenable']) {
    const events: AgentEvents = {}, f = fixture(events); let session = f.session, callbacks = 0;
    if (mode !== 'absent') Object.defineProperty(events, 'permission', { get() {
      const lookup = session.toolContextObservations.at(-1);
      assert.equal(lookup?.callback, 'permissionLookup'); assert.equal(lookup.transition.phase, 'admitted');
      if (mode === 'getter') throw Error('owned permission getter');
      return function (this: unknown, request: Parameters<NonNullable<AgentEvents['permission']>>[0]) {
        assert.equal(this, undefined); callbacks++;
        const operation = session.toolContextObservations.at(-1);
        assert.equal(operation?.callback, 'permission'); assert.equal(operation.transition.phase, 'admitted');
        assert.equal(operation.inputKind, 'unobserved');
        assert.deepEqual(request.input, { value: 'original' }); request.input = { value: 'changed copy' };
        if (mode === 'reject') return Promise.reject(Error('owned rejection'));
        if (mode === 'thenable') return { get then() {
          assert.equal(session.toolContextObservations.at(-1)?.transition.phase, 'admitted');
          return (resolve: (value: boolean) => void) => resolve(true);
        } };
        return Promise.resolve(mode === 'allow');
      };
    } });
    try {
      await f.agent.run('fixture');
      assert.equal(f.effects(), mode === 'allow' || mode === 'thenable' ? 1 : 0);
      assert.equal(callbacks, mode === 'getter' || mode === 'absent' ? 0 : 1);
      const facts = session.toolContextObservations.filter(row => row.callback.startsWith('permission'));
      const lookup = facts.find(row => row.callback === 'permissionLookup'); assert.ok(lookup);
      assert.deepEqual(lookup.transition, mode === 'getter' ? { phase: 'threw' } : { phase: 'returned', mode: 'sync' });
      const operation = facts.find(row => row.callback === 'permission');
      if (callbacks) {
        assert.ok(operation); assert.equal(operation.contextId, lookup.contextId);
        assert.equal(operation.toolUseId, 'approval-call');
        assert.deepEqual(operation.transition, { phase: 'settled', outcome: mode === 'reject' ? 'rejected' : 'fulfilled' });
      } else assert.equal(operation, undefined);
      assert.throws(() => session.append(structuredClone(lookup)), /Tool context observer write authorization/);
      const id = session.id; await session.close(); session = Session.open(f.root, { id });
      assert.deepEqual(session.toolContextObservations.filter(row => row.callback.startsWith('permission')), facts);
      assert.deepEqual(readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.toolContextObservations, []); } finally { await fork.close(); }
    } finally { await session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('approval pending across owner close remains pending in the successor and cannot execute the tool', async () => {
  let release = (_value: boolean) => {}, started = () => {};
  const entered = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<boolean>(resolve => { release = resolve; });
  const f = fixture({ permission: async () => { started(); return gate; } }), controller = new AbortController();
  let session = f.session;
  const running = f.agent.run('fixture', controller.signal).then(value => value, error => error);
  try {
    await entered;
    const facts = session.toolContextObservations;
    assert.deepEqual(facts.at(-1)?.transition, { phase: 'returned', mode: 'promise' });
    const id = session.id; controller.abort(); await session.close(); session = Session.open(f.root, { id });
    release(true); await running;
    assert.equal(f.effects(), 0); assert.deepEqual(session.toolContextObservations, facts);
  } finally { release(false); await running; await session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('permission admission and return journal failures never authorize a tool', async () => {
  for (const phase of ['admitted', 'returned']) {
    let callbacks = 0;
    const f = fixture({ permission: async () => { callbacks++; return true; } }), append = f.session.append;
    f.session.append = function (row, ...args) {
      if (row.kind === 'tool_context_observer' && row.callback === 'permission' && row.transition.phase === phase) throw Error('owned approval journal fault');
      return Reflect.apply(append, this, [row, ...args]);
    };
    try {
      await f.agent.run('fixture'); assert.equal(f.effects(), 0); assert.equal(callbacks, phase === 'admitted' ? 0 : 1);
      assert.deepEqual(f.session.toolContextObservations.filter(row => row.callback === 'permission').map(row => row.transition),
        phase === 'admitted' ? [] : [{ phase: 'admitted' }]);
    } finally { f.session.append = append; await f.session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
