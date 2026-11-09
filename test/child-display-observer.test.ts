import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig, type AgentEvents } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { observeAgentDisplay, agentDisplayObservations } from '../src/agent-display-observer.js';
import type { ToolDefinition } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';

test('actual Agent child progress and clear callbacks journal lookup and preserve original outcomes', async () => {
  for (const callback of ['agentProgress', 'clearAgentProgress'] as const)
    for (const mode of ['sync', 'absent', 'getter-throw', 'promise', 'thenable']) {
      const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-display-')));
      const events: AgentEvents = {}; let calls = 0, invoked = 0, release = () => {};
      const gate = new Promise<void>(resolve => { release = resolve; });
      const message = { type: 'tool_use' as const, id: 'child-call', name: 'read_file', input: {
        get toJSON() { throw Error('must not serialize child input'); },
      } };
      const tool: ToolDefinition = { readOnly: true, schema: { name: 'read_file', description: 'fixture', input_schema: { type: 'object', properties: {} } },
        async execute(_input, context) { context.agentProgress?.('child', message); return 'TOOL_RETURNED'; } };
      let session = Session.open(root, { config: { ...defaultConfig(root, [tool]), model: 'fixture', permissions: { mode: 'bypass', allow: [], deny: [] } } });
      if (mode === 'getter-throw') Object.defineProperty(events, callback, { get() {
        assert.equal(session.agentDisplayObservations.at(-1)?.transition.phase, 'admitted'); throw Error('owned getter failure');
      } });
      else if (mode !== 'absent') events[callback] = function (this: AgentEvents, value: unknown) {
        assert.equal(this, events); invoked++;
        assert.equal(session.agentDisplayObservations.at(-1)?.transition.phase, 'admitted');
        if (callback === 'agentProgress') {
          assert.ok(value && typeof value === 'object' && 'message' in value); assert.equal(value.message, message);
        } else assert.equal(value, 'parent-call');
        return mode === 'promise' ? gate : mode === 'thenable' ? { get then() { throw Error('must not assimilate'); } } : undefined;
      };
      const provider: ModelProvider = { count: async () => 1, complete: async () => {
        const first = calls++ === 0;
        return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
          container: null, diagnostics: null, stop_details: null,
          content: first ? [{ type: 'tool_use', id: 'parent-call', name: 'read_file', input: {}, caller: { type: 'direct' } }]
            : [{ type: 'text', text: 'DONE', citations: null }], stop_reason: first ? 'tool_use' : 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
            cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
      } };
      try {
        await new Agent(session, provider, [tool], events).run('fixture');
        const row = session.agentDisplayObservations.find(row => row.callback === callback); assert.ok(row);
        assert.equal(row.inputEvidence, callback === 'agentProgress' ? 'unobserved' : undefined);
        assert.deepEqual(row.transition, mode === 'absent' ? { phase: 'absent', basis: 'inert_lookup' }
          : mode === 'getter-throw' ? { phase: 'threw' } : { phase: 'returned', mode: mode === 'promise' ? 'promise' : 'sync' });
        assert.equal(invoked, mode === 'absent' || mode === 'getter-throw' ? 0 : 1);
        const result = session.events.find(row => row.kind === 'tool_result' && row.result.tool_use_id === 'parent-call');
        assert.ok(result?.kind === 'tool_result');
        assert.equal(result.result.content, mode === 'getter-throw' ? 'owned getter failure' : 'TOOL_RETURNED');
        assert.equal(result.result.is_error === true, mode === 'getter-throw');
        release(); await new Promise<void>(resolve => setImmediate(resolve));
        const facts = session.agentDisplayObservations;
        if (mode === 'promise') assert.deepEqual(facts.find(row => row.callback === callback)?.transition, { phase: 'settled', outcome: 'fulfilled' });
        assert.throws(() => session.append(structuredClone(row)), /Display observer write authorization/);
        const id = session.id; await session.close(); session = Session.open(root, { id });
        assert.deepEqual(session.agentDisplayObservations, facts);
        assert.deepEqual(readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
        const fork = forkSession(session); try { assert.deepEqual(fork.agentDisplayObservations, []); } finally { await fork.close(); }
      } finally { await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
    }
});

test('child display late rejection never attaches to a reopened owner and evidence cannot be strengthened', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-display-late-')));
  let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  let reject = (_error: Error) => {};
  const promise = new Promise<void>((_resolve, failure) => { reject = failure; });
  try {
    observeAgentDisplay(session, { agentProgress: () => promise }, 'agentProgress', { agentId: 'child', toolUseId: 'parent',
      message: { type: 'tool_use', id: 'child-call', name: 'read_file', input: {} } });
    const rows = structuredClone(session.events);
    const row = rows.find(row => row.kind === 'agent_display_observer'); assert.ok(row?.kind === 'agent_display_observer');
    delete row.inputEvidence;
    assert.throws(() => agentDisplayObservations(rows, session.id), /Invalid agent display/);
    const facts = session.agentDisplayObservations, id = session.id;
    await session.close(); session = Session.open(root, { id });
    reject(Error('late child rejection')); await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(session.agentDisplayObservations, facts);
  } finally { await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('child cleanup admission failure prevents callback effects and return failure retains unknown', async () => {
  for (const phase of ['admitted', 'returned']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'child-display-fault-')));
    const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
    const append = session.append; let effects = 0;
    session.append = function (row, ...args) {
      if (row.kind === 'agent_display_observer' && row.transition.phase === phase) throw Error('owned journal fault');
      return Reflect.apply(append, this, [row, ...args]);
    };
    try {
      assert.throws(() => observeAgentDisplay(session, { clearAgentProgress: () => { effects++; } }, 'clearAgentProgress', 'parent'), /owned journal fault/);
      assert.equal(effects, phase === 'admitted' ? 0 : 1);
      assert.deepEqual(session.agentDisplayObservations.map(row => row.transition), phase === 'admitted' ? [] : [{ phase: 'admitted' }]);
    } finally { session.append = append; await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});
