import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig, type AgentEvents } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { checkpointRecoveryAnchor, checkpointRecoveryPrefix } from '../src/directory-checkpoint.js';
import { skipInertDisplayPairs } from '../src/agent-display-observer.js';
import type { ModelProvider } from '../src/provider.js';

const provider: ModelProvider = { count: async () => 1, complete: async () => {
  const result = {
  id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
  container: null, diagnostics: null, stop_details: null, content: [{ type: 'text', text: 'done', citations: null }], stop_reason: 'end_turn',
  usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
    cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
  } satisfies Awaited<ReturnType<ModelProvider['complete']>>;
  // Exercise the existing legacy text-only wire grammar. The newer SDK types
  // require nullable citations, which is outside that recovery grammar.
  Reflect.deleteProperty(result.content[0]!, 'citations');
  return result;
} };
test('only nonexecuting descriptor absence qualifies; getters, proxies and real callbacks retain unknown effects', async () => {
  for (const mode of ['missing', 'undefined', 'null', 'inherited', 'getter', 'proxy', 'prototype-proxy', 'callback']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'display-absence-')));
    const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
      hooks: { Notification: [{ type: 'callback', name: 'display' }] } } });
    let effects = 0, events: AgentEvents = { hookOptions: { resolveCallbackHook: async () => ({ systemMessage: 'owned display' }) } };
    if (mode === 'undefined' || mode === 'null') Object.defineProperty(events, 'status', { value: mode === 'null' ? null : undefined });
    if (mode === 'inherited') Object.setPrototypeOf(events, { status: undefined });
    if (mode === 'getter') Object.defineProperty(events, 'status', { get() { effects++; return undefined; } });
    if (mode === 'callback') events.status = () => { effects++; };
    if (mode === 'proxy') events = new Proxy(events, { get(target, key, receiver) {
      if (key === 'status') { effects++; return undefined; } return Reflect.get(target, key, receiver);
    } });
    if (mode === 'prototype-proxy') Object.setPrototypeOf(events, new Proxy({}, { get(_target, key) {
      if (key === 'status') effects++; return undefined;
    } }));
    try {
      await new Agent(session, provider, [], events).emitHook('Notification', {});
      const row = session.agentDisplayObservations.at(-1)!;
      const inert = ['missing', 'undefined', 'null', 'inherited'].includes(mode);
      assert.equal(effects, inert ? 0 : 1);
      assert.deepEqual(row.transition, inert ? { phase: 'absent', basis: 'inert_lookup' }
        : { phase: 'returned', mode: mode === 'callback' ? 'sync' : 'absent' });
      const end = session.events.length - 1;
      assert.equal(skipInertDisplayPairs(session.events, end), inert ? end - 2 : end);
      if (inert) for (const field of ['owner', 'callback', 'admissionIndex', 'inputSha256', 'invocationId']) {
        const rows = session.events.map(event => JSON.parse(JSON.stringify(event)));
        rows[end][field] = field === 'admissionIndex' ? 0 : field === 'callback' ? 'progress' : 'different';
        assert.equal(skipInertDisplayPairs(rows, end), end);
      }
      assert.deepEqual(readSessionJournal(root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
    } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});
test('real plain turns cross only proven absence pairs while physical prefix bytes and legacy uncertainty survive cold reads', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'display-prefix-')));
  let session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  try {
    await new Agent(session, provider, []).run('owned text');
    assert.equal(checkpointRecoveryAnchor(session.events, session.events.length), 0,
      JSON.stringify(session.events.filter(event => event.kind === 'message' || event.kind === 'turn_end')));
    const bytes = fs.readFileSync(session.file), prefix = checkpointRecoveryPrefix(session.events, bytes, session.events.length);
    assert.equal(prefix?.index, 0); assert.deepEqual(prefix?.bytes, bytes.subarray(0, bytes.indexOf(10) + 1));
    const id = session.id; session.close(); session = Session.open(root, { id });
    assert.equal(checkpointRecoveryAnchor(session.events, session.events.length), 0);
    const rows = session.events.map(event => JSON.parse(JSON.stringify(event))), end = rows.length - 1;
    rows[end].transition = { phase: 'returned', mode: 'absent' };
    assert.equal(checkpointRecoveryAnchor(rows, rows.length), end);
    rows[end].transition = { phase: 'returned', mode: 'sync' };
    assert.equal(checkpointRecoveryAnchor(rows, rows.length), end);
    rows.pop(); assert.equal(checkpointRecoveryAnchor(rows, rows.length), rows.length - 1);
    let effect = 0;
    await new Agent(session, provider, [], { progress: () => { effect++; } }).run('real callback');
    assert.ok(effect > 0); assert.equal(checkpointRecoveryAnchor(session.events, session.events.length), session.events.length - 1);
  } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
