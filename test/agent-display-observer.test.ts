import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { Agent, defaultConfig, type AgentEvents } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import type { ModelProvider } from '../src/provider.js';

const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function fixture(events: AgentEvents) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'display-observer-')));
  const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture',
    hooks: { Notification: [{ type: 'callback', name: 'display' }] } } });
  events.hookOptions = { resolveCallbackHook: async () => ({ systemMessage: 'owned status', terminalSequence: '\u001b]0;owned title\u0007' }) };
  const provider: ModelProvider = { count: async () => 1, complete: async (_request, _signal, onText, onThinking) => {
    onThinking?.(); onText?.('done');
    return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
      container: null, diagnostics: null, stop_details: null, content: [{ type: 'text', text: 'done', citations: null }], stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
        cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  return { root, session, agent: new Agent(session, provider, [], events) };
}
test('actual hook display and model progress retain receiver, argument binding, absence and cold ownership', async () => {
  for (const present of [true, false]) {
    const received: string[] = [], events: AgentEvents = {};
    if (present) {
      const record = function (this: AgentEvents, value: unknown) { assert.equal(this, events); received.push(JSON.stringify(value)); };
      events.status = record; events.progress = record; events.terminalSequence = record;
    }
    const f = fixture(events); let session = f.session;
    try {
      await f.agent.emitHook('Notification', {}); await f.agent.run('fixture');
      const observations = session.agentDisplayObservations;
      assert.deepEqual(new Set(observations.map(row => row.callback)), new Set(['status', 'progress', 'terminalSequence']));
      assert.ok(observations.length >= 7);
      for (const [index, row] of observations.entries()) {
        assert.deepEqual(row.transition, present ? { phase: 'returned', mode: 'sync' } : { phase: 'absent', basis: 'inert_lookup' });
        assert.equal(session.events[row.admissionIndex]?.kind, 'agent_display_observer');
        if (present) assert.equal(row.inputSha256, createHash('sha256').update(received[index]!).digest('hex'));
      }
      assert.throws(() => session.append(structuredClone(observations[0]!)), /Display observer write authorization/);
      const id = session.id; session.close(); session = Session.open(f.root, { id });
      assert.deepEqual(session.agentDisplayObservations, observations);
      assert.deepEqual(readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.agentDisplayObservations, []); } finally { fork.close(); }
    } finally { session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
test('all display callbacks distinguish throw, nonawaited Promise settlement, thenables and retired owners', async () => {
  const names: Array<'status' | 'progress' | 'terminalSequence'> = ['status', 'progress', 'terminalSequence'];
  for (const name of names) for (const mode of ['fulfilled', 'rejected', 'closed', 'getter-throw', 'thenable']) {
    let release = () => {}, reject = (_error: Error) => {};
    const gate = new Promise<void>((resolve, failure) => { release = resolve; reject = failure; });
    const events: AgentEvents = {};
    events[name] = () => mode === 'thenable' ? { get then() { throw Error('must not assimilate'); } } : gate;
    const f = fixture(events); let session = f.session;
    if (mode === 'getter-throw') Object.defineProperty(events, name, { get() {
      const row = session.agentDisplayObservations.at(-1); assert.equal(row?.callback, name);
      assert.equal(row.transition.phase, 'admitted'); throw Error('owned getter failure');
    } });
    try {
      const run = name === 'progress' ? f.agent.run('fixture') : f.agent.emitHook('Notification', {});
      if (mode === 'getter-throw') await assert.rejects(run, /owned getter failure/); else await run;
      assert.equal(f.agent.isRunning(), false);
      const selected = () => session.agentDisplayObservations.filter(row => row.callback === name);
      assert.ok(selected().length > 0);
      const expected = mode === 'getter-throw' ? { phase: 'threw' } : { phase: 'returned', mode: mode === 'thenable' ? 'sync' : 'promise' };
      for (const row of selected()) assert.deepEqual(row.transition, expected);
      if (mode === 'closed') { const id = session.id; session.close(); session = Session.open(f.root, { id }); }
      if (mode === 'rejected') reject(Error('late rejection')); else release();
      await tick();
      for (const row of selected()) assert.deepEqual(row.transition, mode === 'fulfilled' || mode === 'rejected' ?
        { phase: 'settled', outcome: mode } : expected);
      assert.deepEqual(readSessionJournal(f.root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
    } finally { release(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
test('display journal faults gate entry or retain unknown settlement and cold readers reject corrupt binding', async () => {
  for (const phase of ['admitted', 'returned', 'settled']) {
    let effects = 0;
    const f = fixture({ status: () => { effects++; return Promise.resolve(); } }); let session = f.session;
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"agent_display_observer"') &&
          args[1].includes('"callback":"status"') && args[1].includes(`"phase":"${phase}"`)) throw Error('display journal fault');
        return Reflect.apply(target, receiver, args);
      } });
      const run = f.agent.emitHook('Notification', {});
      if (phase === 'settled') await run; else await assert.rejects(run, /display journal fault/);
      await tick();
    } finally { fs.writeSync = write; }
    try {
      assert.equal(effects, phase === 'admitted' ? 0 : 1); assert.equal(session.isJournalFenced, true);
      const id = session.id; session.close(); session = Session.open(f.root, { id });
      const row = session.agentDisplayObservations.find(row => row.callback === 'status');
      assert.deepEqual(row?.transition, phase === 'admitted' ? undefined : phase === 'returned' ?
        { phase: 'admitted' } : { phase: 'returned', mode: 'promise' });
      if (phase === 'settled') {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'agent_display_observer').admissionIndex++;
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(f.root, { id }), /Invalid agent display observer history/);
        assert.throws(() => readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), /Invalid agent display observer history/);
      }
    } finally { session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
