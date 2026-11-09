import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import type { ToolDefinition } from '../src/tools.js';
import type { ModelProvider } from '../src/provider.js';
import type { HookDefinition } from '../src/hooks.js';

function fixture(type: 'agent' | 'mcp_tool', body: () => Promise<string>, blocks = false, timeout = 2) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'hook-inner-')));
  const tool: ToolDefinition = { readOnly: true, schema: { name: type === 'agent' ? 'read_file' : 'mcp__fixture__read',
    description: 'owned fixture', input_schema: { type: 'object', properties: {} } }, execute: body };
  if (blocks) tool.executeBlocks = async () => [{ type: 'text', text: await body() }];
  const definition: HookDefinition = type === 'agent' ? { type, prompt: 'inspect', timeout } : { type, tool: tool.schema.name, arguments: {}, timeout };
  const session = Session.open(root, { config: { ...defaultConfig(root, [tool]), model: 'fixture',
    permissions: { mode: 'bypass', allow: [], deny: [] }, hooks: { Notification: [definition] } } });
  let calls = 0;
  const provider: ModelProvider = { count: async () => 1, complete: async () => {
    const first = calls++ === 0;
    return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
      container: null, diagnostics: null, stop_details: null,
      content: first ? [{ type: 'tool_use', id: 'inner', name: tool.schema.name, input: {}, caller: { type: 'direct' } }]
        : [{ type: 'text', text: '{"ok":true}', citations: null }],
      stop_reason: first ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1,
        cache_creation: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, inference_geo: null,
        output_tokens_details: null, server_tool_use: null, service_tier: null } };
  } };
  return { root, session, agent: new Agent(session, provider, [tool]) };
}

test('real agent text/block and MCP inner calls bind actual resolver, survive cold reads and do not fork', async () => {
  for (const type of ['agent', 'mcp_tool'] as const) for (const blocks of type === 'agent' ? [false, true] : [false]) {
    let entered = 0;
    const f = fixture(type, async () => { entered++; return '{"ok":true}'; }, blocks);
    let session = f.session;
    try {
      await f.agent.emitHook('Notification', {});
      assert.equal(entered, 1); assert.equal(session.hookToolExecutions.length, 1);
      const row = session.hookToolExecutions[0]!;
      assert.equal(row.phase, 'fulfilled'); assert.equal(row.owner, session.id);
      assert.equal(row.resolverInvocationId, session.hookResolverObservations[0]?.event.invocationId);
      assert.equal(row.inputSha256, createHash('sha256').update('{}').digest('hex'));
      assert.throws(() => session.append(structuredClone(row)), /Hook inner-tool write authorization/);
      const id = session.id, before = session.hookToolExecutions; session.close(); session = Session.open(f.root, { id });
      assert.deepEqual(session.hookToolExecutions, before);
      assert.deepEqual(readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.hookToolExecutions, []); } finally { fork.close(); }
    } finally { session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('inner tool actual late settlement stays distinct from timeout and retired owner', async () => {
  for (const type of ['agent', 'mcp_tool'] as const) for (const close of [false, true]) {
    let release = () => {}, entered = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const f = fixture(type, async () => { entered = true; await gate; return '{"ok":true}'; }, false, 0.02);
    let session = f.session;
    try {
      await f.agent.emitHook('Notification', {});
      assert.equal(entered, true); assert.equal(session.hookToolExecutions[0]?.phase, 'admitted');
      assert.equal(session.hookResolverObservations[0]?.runner, 'timed_out');
      if (close) { const id = session.id; session.close(); session = Session.open(f.root, { id }); }
      release(); await new Promise(resolve => setTimeout(resolve, 20));
      assert.equal(session.hookToolExecutions[0]?.phase, close ? 'admitted' : 'fulfilled');
      assert.deepEqual(readSessionJournal(f.root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
    } finally { release(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('inner tool rejection and journal faults preserve actual outcomes and reject corrupt cold binding', async () => {
  for (const mode of ['throw', 'admitted', 'fulfilled']) {
    let entered = 0;
    const f = fixture('mcp_tool', async () => { entered++; if (mode === 'throw') throw Error('owned tool failure'); return '{"ok":true}'; });
    let session = f.session;
    const write = fs.writeSync;
    try {
      if (mode !== 'throw') fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"hook_tool"') && args[1].includes(`"phase":"${mode}"`)) throw Error('inner journal fault');
        return Reflect.apply(target, receiver, args);
      } });
      const running = f.agent.emitHook('Notification', {});
      if (mode === 'throw') await running; else await assert.rejects(running);
    } finally { fs.writeSync = write; }
    try {
      assert.equal(entered, mode === 'admitted' ? 0 : 1);
      const id = session.id; session.close(); session = Session.open(f.root, { id });
      assert.equal(session.hookToolExecutions[0]?.phase, mode === 'throw' ? 'rejected' : mode === 'fulfilled' ? 'admitted' : undefined);
      if (mode === 'fulfilled') {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'hook_tool').resolverInvocationId = randomUUID();
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(f.root, { id }), /Invalid hook inner-tool history/);
        assert.throws(() => readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), /Invalid hook inner-tool history/);
      }
    } finally { session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});
