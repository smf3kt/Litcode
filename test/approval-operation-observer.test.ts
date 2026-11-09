import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { skillToolApproval, type SkillExecutionOptions } from '../src/skill-runtime.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';
import type { PermissionDecision } from '../src/permissions.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'approval-operation-')));
  const tool: ToolDefinition = { readOnly: false, schema: { name: 'write_file', description: 'fixture', input_schema: { type: 'object' } },
    async execute() { throw Error('permission-only fixture'); } };
  const config = defaultConfig(root, [tool]); config.model = 'fixture';
  config.permissions = { mode: 'ask', allow: [], deny: [] };
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw Error('no upstream'); } };
  const session = Session.open(root, { config });
  const registry = new AgentRegistry({ source: config, provider, tools: [tool] }); registry.bindHistory(session);
  const signal = new AbortController().signal;
  return { root, tool, config, provider, session, registry, signal,
    ask: () => registry.requestApproval(tool, { path: 'owned', content: 'fixture' }, { decision: 'ask' }, signal),
    async cleanup() { await registry.close(); await session.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

test('registry records actual binding generations, preserves decisions and revocation, and cold readers exclude forked observations', async () => {
  const f = fixture(); let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  try {
    let bound: AbortSignal | undefined;
    f.registry.bindApproval(async (_tool, _input, _decision, signal) => {
      bound = signal; assert.equal(f.session.approvalOperations.at(-1)?.phase, 'admitted');
      await gate; return { decision: 'allow' };
    });
    const pending = f.ask();
    const denied: PermissionDecision = { decision: 'deny', reason: 'fixture deny' };
    f.registry.bindApproval(async () => denied);
    assert.equal(bound?.aborted, true); assert.equal(await f.ask(), denied);
    release(); assert.equal((await pending).decision, 'deny');
    f.registry.bindApproval(async () => { throw Error('fixture reject'); });
    await assert.rejects(f.ask(), /fixture reject/);
    const facts = f.session.approvalOperations;
    assert.deepEqual(facts.map(row => row.phase), ['fulfilled', 'fulfilled', 'rejected']);
    assert.equal(new Set(facts.map(row => row.scope.kind === 'registry' && row.scope.bindingId)).size, 3);
    assert.throws(() => f.session.append(structuredClone(facts[0]!)), /Approval operation write authorization/);
    const fork = forkSession(f.session); try { assert.deepEqual(fork.approvalOperations, []); } finally { await fork.close(); }
    const id = f.session.id; await f.registry.close(); await f.session.close();
    const cold = Session.open(f.root, { id });
    try {
      assert.deepEqual(cold.approvalOperations, facts);
      assert.deepEqual(readSessionJournal(f.root, id, { maxBytes: 1000000, maxEvents: 1000 }), cold.events);
    } finally { await cold.close(); }
  } finally { release(); await f.cleanup(); }
});

test('skill approval observes live deny and input rechecks without treating callback allow as authorization', async () => {
  for (const mode of ['allow', 'deny', 'changed-input', 'live-deny']) {
    const f = fixture();
    const options: SkillExecutionOptions = { config: f.config, provider: f.provider, tools: [f.tool], signal: f.signal,
      source: 'model', session: () => f.session,
      async requestPermission(_tool, input) {
        assert.equal(this.session?.(), f.session);
        assert.equal(f.session.approvalOperations.at(-1)?.phase, 'admitted');
        if (mode === 'changed-input' && typeof input === 'object' && input !== null) Object.assign(input, { content: 'changed' });
        if (mode === 'live-deny') f.config.permissions!.deny.push('write_file');
        return { decision: mode === 'deny' ? 'deny' : 'allow' };
      } };
    const approve = skillToolApproval(() => ({ name: 'fixture', path: '/fixture/SKILL.md', description: 'fixture', body: '',
      userInvocable: true, disableModelInvocation: false }), options);
    try {
      const running = approve(f.tool, { path: 'owned', content: 'fixture' }, f.signal, f.root);
      if (mode === 'allow') await running; else await assert.rejects(running, mode === 'changed-input' ? /input changed/ : /den/i);
      assert.equal(f.session.approvalOperations.length, 1);
      assert.equal(f.session.approvalOperations[0]?.phase, mode === 'allow' ? 'fulfilled' : 'rejected');
      assert.deepEqual(f.session.approvalOperations[0]?.scope, { kind: 'skill' });
    } finally { await f.cleanup(); }
  }
});

test('closed owners retain unresolved approval and admission or terminal write faults never return approval', async () => {
  for (const mode of ['closed', 'admitted', 'fulfilled']) {
    const f = fixture(), append = f.session.append; let callbacks = 0, release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    f.registry.bindApproval(async () => { callbacks++; if (mode === 'closed') await gate; return { decision: 'allow' }; });
    f.session.append = function (row, ...args) {
      if (row.kind === 'approval_operation' && row.phase === mode) throw Error('fixture journal fault');
      return Reflect.apply(append, this, [row, ...args]);
    };
    try {
      const pending = f.ask();
      if (mode === 'closed') {
        const id = f.session.id; await f.registry.close(); await f.session.close();
        const cold = Session.open(f.root, { id });
        try { release(); assert.equal((await pending).decision, 'deny'); assert.equal(cold.approvalOperations[0]?.phase, 'admitted'); }
        finally { await cold.close(); }
      } else {
        await assert.rejects(pending, /fixture journal fault/);
        assert.equal(callbacks, mode === 'admitted' ? 0 : 1);
        assert.deepEqual(f.session.approvalOperations.map(row => row.phase), mode === 'admitted' ? [] : ['admitted']);
      }
    } finally { release(); f.session.append = append; await f.cleanup(); }
  }
});
