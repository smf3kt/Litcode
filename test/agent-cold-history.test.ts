import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { createRuntime, pinToolSchemas } from '../src/runtime.js';
import { fingerprintOf, Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolContext } from '../src/tools.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'agent-cold-test-')));
const reply = (content: Anthropic.ContentBlock[], stop_reason: Anthropic.Message['stop_reason'] = 'end_turn'): Anthropic.Message => ({
  id: 'owned', model: 'fixture', type: 'message', role: 'assistant', content, stop_reason, stop_sequence: null,
  container: null, diagnostics: null, stop_details: null,
  usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
});
const textReply = () => reply([{ type: 'text', text: 'OWNED_COMPLETE', citations: null }]);
const context = (workspace: string): ToolContext => ({ workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
const until = async (check: () => boolean) => {
  const deadline = Date.now() + 5000;
  while (!check()) { assert.ok(Date.now() < deadline, 'owned child settles'); await new Promise(resolve => setTimeout(resolve, 5)); }
};
const tool = (runtime: Awaited<ReturnType<typeof createRuntime>>, session: Session, name: string) => {
  const found = runtime.buildTools(session.config, session.id).find(candidate => candidate.schema.name === name);
  assert.ok(found, name); return found;
};

async function setup(provider: ModelProvider) {
  const workspace = temporary();
  fs.writeFileSync(path.join(workspace, 'fixture.txt'), 'OWNED_FILE');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', skills: [],
    permissions: { mode: 'bypass' as const, allow: [], deny: [] },
    features: { tasks: false, subagents: true, agentMessaging: true, agentTypes: true } };
  const runtime = await createRuntime(config, provider, new AbortController().signal);
  config.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(workspace, { config });
  await runtime.bindSession!(parent);
  return { workspace, runtime, parent };
}

test('original parent cold startup retains passive child history, mutable context, same UUID and one follow-up effect', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls++;
    if (request.messages.at(-1)?.content === 'FIRST') return reply([
      { type: 'tool_use', id: 'read', name: 'read_file', input: { path: 'fixture.txt' }, caller: { type: 'direct' } },
    ], 'tool_use');
    if (request.messages.at(-1)?.content === 'FOLLOW') return reply([
      { type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'effect.txt', content: 'ONCE' }, caller: { type: 'direct' } },
    ], 'tool_use');
    return textReply();
  } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'FIRST', name: 'cold', mode: 'general', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    const journal = path.join(workspace, '.agent', `${child.id}.jsonl`), metadata = fs.readFileSync(journal, 'utf8').split('\n')[0];
    await runtime.close(); parent.close();
    parent = Session.open(workspace, { id: parent.id });
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    const before = calls, parentBytes = fs.readFileSync(parent.file), childBytes = fs.readFileSync(journal);
    await runtime.bindSession!(parent);
    assert.equal(calls, before);
    assert.deepEqual(runtime.backgroundTasks!(parent.id).agents.map(row => [row.id, row.status]), [[child.id, 'completed']]);
    assert.match(JSON.stringify(runtime.agentTranscript!(parent.id, child.id)), /OWNED_FILE/);
    assert.deepEqual(fs.readFileSync(parent.file), parentBytes); assert.deepEqual(fs.readFileSync(journal), childBytes);
    const release = runtime.retainAgentView!(parent.id, child.id); assert.ok(release); release();
    assert.equal(runtime.agentTranscript!('foreign', child.id), undefined);
    assert.equal((await tool(runtime, parent, 'get_agent').execute({ id: 'cold' }, context(workspace))).includes(child.id), true);
    await runtime.submitAgentInput!(parent.id, child.id, 'FOLLOW');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.readFileSync(path.join(workspace, 'effect.txt'), 'utf8'), 'ONCE');
    assert.equal(calls, before + 2);
    const events = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(events.filter(event => event.kind === 'tool_start' && event.name === 'write_file').length, 1);
    assert.equal(fs.readFileSync(journal, 'utf8').split('\n')[0], metadata);
    assert.equal(runtime.backgroundWorkCount!(parent.id), 0);
    await runtime.close(); parent.close();
    parent = Session.open(workspace, { id: parent.id });
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    assert.equal(runtime.agentTranscript!(parent.id, child.id)?.status, 'completed');
    assert.equal(calls, before + 2);
    assert.equal(fs.readFileSync(path.join(workspace, 'effect.txt'), 'utf8'), 'ONCE');
  } finally {
    await runtime.close(); parent.close();
    assert.equal(fs.readdirSync(path.join(workspace, '.agent')).some(name => name.endsWith('.lock')), false);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('cold import needs the original parent witness, complete matching journal and unique trusted tools', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async () => { calls++; return textReply(); } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'OWNED', name: 'owner', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    await runtime.close(); parent.close();
    const sidecar = path.join(workspace, '.agent', 'subagents', parent.id, `${child.id}.meta.json`);
    const original = fs.readFileSync(sidecar, 'utf8'), journal = path.join(workspace, '.agent', `${child.id}.jsonl`);
    const originalJournal = fs.readFileSync(journal);
    parent = Session.open(workspace, { id: parent.id });
    const before = calls;
    const check = (tools: import('../src/tools.js').ToolDefinition[] = []) => {
      const registry = new AgentRegistry({ source: parent.config, provider, tools });
      const warnings = registry.bindHistory(parent);
      assert.deepEqual(registry.list(), []); assert.ok(warnings.length > 0);
      return registry.close();
    };
    await check();
    fs.writeFileSync(sidecar, '{'); await check(); fs.writeFileSync(sidecar, original);
    fs.appendFileSync(journal, '{"kind":"turn_end","reason":"foreign"}\n'); await check(); fs.writeFileSync(journal, originalJournal);
    const changed: unknown = JSON.parse(original);
    assert.ok(changed && typeof changed === 'object' && 'parent' in changed);
    Reflect.set(changed, 'parent', '00000000-0000-4000-8000-000000000000');
    fs.writeFileSync(sidecar, JSON.stringify(changed)); await check(); fs.writeFileSync(sidecar, original);
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    assert.equal(runtime.agentTranscript!(parent.id, child.id)?.status, 'completed');
    fs.appendFileSync(journal, '{"kind":"turn_end","reason":"late"}\n');
    await runtime.submitAgentInput!(parent.id, child.id, 'LATE');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'failed');
    await assert.rejects(runtime.submitAgentInput!(parent.id, child.id, 'RETRY'), /continuity/);
    assert.equal(calls, before);
    await runtime.close();
    fs.writeFileSync(journal, originalJournal); fs.writeFileSync(sidecar, original);
    const active = JSON.parse(original); active.state = { kind: 'active' };
    fs.writeFileSync(sidecar, JSON.stringify(active));
    parent.append({ kind: 'agent_history', id: child.id, digest: fingerprintOf(active) });
    const registry = new AgentRegistry({ source: parent.config, provider, tools: [] });
    assert.deepEqual(registry.bindHistory(parent), []); assert.deepEqual(registry.list(), []); await registry.close();
    assert.equal(calls, before);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('persisted stop keeps peer input closed while explicit human restart retains live permission checks', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    calls++;
    if (request.messages.at(-1)?.content === 'HUMAN_RESTART') return reply([
      { type: 'tool_use', id: 'denied', name: 'write_file', input: { path: 'denied.txt', content: 'BLOCKED' }, caller: { type: 'direct' } },
    ], 'tool_use');
    return textReply();
  } };
  const fixture = await setup(provider), { workspace } = fixture;
  let runtime = fixture.runtime, parent = fixture.parent;
  try {
    const child = JSON.parse(await tool(runtime, parent, 'agent').execute({ prompt: 'FIRST', mode: 'general', background: true }, context(workspace))) as { id: string };
    await tool(runtime, parent, 'get_agent').execute({ id: child.id, wait_ms: 5000 }, context(workspace));
    await tool(runtime, parent, 'stop_agent').execute({ id: child.id }, context(workspace));
    await runtime.close(); parent.close();
    parent = Session.open(workspace, { id: parent.id });
    parent.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' }]);
    runtime = await createRuntime(parent.config, provider, new AbortController().signal);
    await runtime.bindSession!(parent);
    const before = calls;
    await assert.rejects(tool(runtime, parent, 'send_message').execute({ id: child.id, message: 'PEER' }, context(workspace)), /cancelled/);
    assert.equal(calls, before);
    await runtime.submitAgentInput!(parent.id, child.id, 'HUMAN_RESTART');
    await until(() => runtime.agentTranscript!(parent.id, child.id)?.status === 'completed');
    assert.equal(fs.existsSync(path.join(workspace, 'denied.txt')), false);
    assert.match(JSON.stringify(runtime.agentTranscript!(parent.id, child.id)), /denied|Denied/);
    assert.equal(calls, before + 2);
  } finally { await runtime.close(); parent.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
