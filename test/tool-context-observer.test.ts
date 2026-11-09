import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { createToolContextObserver, toolContextObservations } from '../src/tool-context-observer.js';
import type { ToolDefinition } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';

test('real Agent and model-hook context calls retain receiver, admission, returned identity and cold ownership', async () => {
  for (const hook of [false, true]) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tool-context-')));
    let calls = 0, entered = 0, executing = false;
    const tool: ToolDefinition = { readOnly: true, schema: { name: 'read_file', description: 'fixture', input_schema: { type: 'object', properties: {} } },
      async execute(_input, context) {
        executing = true;
        try { context.workingDirectories?.(true); if (!hook) context.fileHistory?.(); return 'ok'; }
        finally { executing = false; }
      } };
    let session = Session.open(root, { config: { ...defaultConfig(root, [tool]), model: 'fixture',
      permissions: { mode: 'bypass', allow: [], deny: [] }, ...(hook ? { hooks: { Notification: [{ type: 'agent', prompt: 'inspect' }] } } : {}) } });
    const original = session.workingDirectories;
    Object.defineProperty(session, 'workingDirectories', { configurable: true, get() {
      if (executing) assert.equal(session.toolContextObservations.at(-1)?.transition.phase, 'admitted');
      return function (this: Session, readOnly: boolean) { assert.equal(this, session); if (executing) entered++; return original.call(this, readOnly); };
    } });
    const provider: ModelProvider = { count: async () => 1, complete: async () => {
      const first = calls++ === 0;
      return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
        container: null, diagnostics: null, stop_details: null,
        content: first ? [{ type: 'tool_use', id: 'same-id', name: tool.schema.name, input: {}, caller: { type: 'direct' } }]
          : [{ type: 'text', text: '{"ok":true}', citations: null }], stop_reason: first ? 'tool_use' : 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
          cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
    } };
    try {
      const agent = new Agent(session, provider, [tool]);
      if (hook) await agent.emitHook('Notification', {}); else await agent.run('read');
      assert.equal(entered, 1);
      const facts = session.toolContextObservations;
      assert.equal(facts.length, hook ? 1 : 2);
      for (const row of facts) {
        assert.equal(row.lane, hook ? 'model_hook' : 'agent'); assert.equal(row.toolUseId, 'same-id');
        assert.deepEqual(row.transition, { phase: 'returned', mode: 'sync' });
      }
      assert.throws(() => session.append(structuredClone(facts[0]!)), /Tool context observer write authorization/);
      const damaged = structuredClone(session.events);
      const terminal = damaged.find(row => row.kind === 'tool_context_observer' && row.transition.phase === 'returned');
      assert.ok(terminal?.kind === 'tool_context_observer'); terminal.toolUseId = 'changed';
      assert.throws(() => toolContextObservations(damaged, session.id), /Invalid tool context/);
      const id = session.id; await session.close(); session = Session.open(root, { id });
      assert.deepEqual(session.toolContextObservations, facts);
      assert.deepEqual(readSessionJournal(root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.toolContextObservations, []); } finally { await fork.close(); }
    } finally { await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('context observer preserves throws and native Promise identity, never assimilates thenables or migrates late writes', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'context-settlement-')));
  let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  try {
    const observe = createToolContextObserver(session, 'call', 'agent');
    const failure = Error('owned failure');
    assert.throws(() => observe('fileHistory', undefined, () => { throw failure; }), error => error === failure);
    assert.deepEqual(session.toolContextObservations.at(-1)?.transition, { phase: 'threw' });
    const thenable = { get then() { throw Error('must not assimilate'); } };
    assert.equal(observe('fileHistory', undefined, () => thenable), thenable);
    const untyped = { get toJSON() { throw Error('must not serialize callback input'); } };
    assert.equal(Reflect.apply(observe, undefined, ['fileHistory', untyped, () => untyped]), untyped);
    assert.equal(session.toolContextObservations.at(-1)?.inputKind, 'unobserved');
    let release = () => {};
    const promise = new Promise<void>(resolve => { release = resolve; });
    assert.equal(observe('workingDirectories', true, () => promise), promise);
    assert.deepEqual(session.toolContextObservations.at(-1)?.transition, { phase: 'returned', mode: 'promise' });
    release(); await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(session.toolContextObservations.at(-1)?.transition, { phase: 'settled', outcome: 'fulfilled' });
    const late = new Promise<void>(resolve => { release = resolve; });
    observe('workingDirectories', false, () => late);
    const id = session.id, facts = session.toolContextObservations; await session.close(); session = Session.open(root, { id });
    release(); await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(session.toolContextObservations, facts);
    let retired = false; observe('fileHistory', undefined, () => { retired = true; });
    assert.equal(retired, true); assert.deepEqual(session.toolContextObservations, facts);
  } finally { await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('failed context admission prevents effects and a failed return leaves an admitted unknown', async () => {
  for (const phase of ['admitted', 'returned']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'context-fault-')));
    const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
    const append = session.append; let effects = 0;
    session.append = function (event, ...args) {
      if (event.kind === 'tool_context_observer' && event.transition.phase === phase) throw Error('owned append fault');
      return Reflect.apply(append, this, [event, ...args]);
    };
    try {
      const observe = createToolContextObserver(session, 'call', 'agent');
      assert.throws(() => observe('fileHistory', undefined, () => { effects++; }), /owned append fault/);
      assert.equal(effects, phase === 'admitted' ? 0 : 1);
      assert.deepEqual(session.toolContextObservations.map(row => row.transition), phase === 'admitted' ? [] : [{ phase: 'admitted' }]);
    } finally { session.append = append; await session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});
