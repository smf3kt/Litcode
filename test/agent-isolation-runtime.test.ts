import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { createRuntime, parseSettings, pinToolSchemas, type Runtime } from '../src/runtime.js';
import { Session, type SessionConfig } from '../src/session.js';
import { createTools, type ToolContext, type ToolDefinition } from '../src/tools.js';

const gitEnv: NodeJS.ProcessEnv = {
  PATH: process.env.PATH, TMPDIR: os.tmpdir(), LC_ALL: 'C',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0',
  GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.test',
  GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.test',
};
function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], {
    cwd: root, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000,
  }).trimEnd();
}
function repository(): string {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-isolation-')));
  git(workspace, 'init', '--initial-branch=main');
  fs.writeFileSync(path.join(workspace, 'file.txt'), 'baseline\n');
  fs.writeFileSync(path.join(workspace, '.gitignore'), '.agent/\n.harness/\n.harness-worktrees/\n');
  git(workspace, 'add', 'file.txt', '.gitignore');
  git(workspace, 'commit', '-m', 'Synthetic isolation fixture');
  return workspace;
}
function response(content: ({ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown })[], toolUse = false): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content,
    stop_reason: toolUse ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
const done = () => response([{ type: 'text', text: 'fixture complete' }]);
function result(request: ModelRequest): Anthropic.ToolResultBlockParam | undefined {
  const content = request.messages.at(-1)?.content;
  if (!Array.isArray(content)) return undefined;
  return content.find(block => block.type === 'tool_result') as Anthropic.ToolResultBlockParam | undefined;
}
function tool(tools: ToolDefinition[], name: string): ToolDefinition {
  const found = tools.find(candidate => candidate.schema.name === name);
  assert.ok(found, name);
  return found;
}
function context(workspace: string): ToolContext {
  return { workspace, allowShell: false, maxOutputBytes: 100_000, signal: new AbortController().signal };
}
type Child = { id: string; session_id: string; status: string; summary: string; workspace?: string; cleanup_error?: string };
async function fixture(provider: ModelProvider, override: Partial<SessionConfig> = {}) {
  const workspace = repository();
  const config: SessionConfig = { ...defaultConfig(workspace, createTools()), model: 'fixture',
    features: { tasks: true, subagents: true, agentMessaging: true, agentTypes: true, agentIdle: true,
      memory: true, checkpoints: true, worktrees: true, background: true, scheduler: true, workflow: true },
    ...override };
  const controller = new AbortController();
  const runtime = await createRuntime(config, provider, controller.signal);
  config.tools = pinToolSchemas(runtime.tools);
  return { workspace, config, controller, runtime,
    invoke: (name: string, input: unknown) => tool(runtime.tools, name).execute(input, context(workspace)),
    async cleanup() { await runtime.close(); fs.rmSync(workspace, { recursive: true, force: true }); },
  };
}

test('settings parse plugins, agent catalogs and optional feature gates; legacy schemas stay stable', async () => {
  const types = [{ name: 'reader', description: 'Fixture reader', body: 'Read fixture files.',
    path: '/fixture/agents/reader.md', mode: 'explore' as const }];
  const parsed = parseSettings({ plugins: { enabled: true }, agentTypes: types,
    features: { agentTypes: true, interaction: true } });
  assert.equal(parsed.plugins?.enabled, true);
  assert.deepEqual(parsed.agentTypes, types);
  assert.deepEqual(parsed.features, { agentTypes: true, interaction: true });
  assert.throws(() => parseSettings({ agentTypes: [{ name: 'broken' }] }));
  assert.throws(() => parseSettings({ plugins: { enabled: 'yes' } }));
  assert.throws(() => parseSettings({ features: { agentTypes: 'yes' } }));
  const workspace = repository();
  const provider: ModelProvider = { count: async () => 0, complete: async () => done() };
  const runtimes: Runtime[] = [];
  try {
    const legacy = defaultConfig(workspace, createTools());
    const base = await createRuntime(legacy, provider, new AbortController().signal); runtimes.push(base);
    assert.deepEqual(pinToolSchemas(base.tools), legacy.tools);
    const existing = { ...legacy, features: { tasks: false, subagents: true, agentMessaging: true } };
    const old = await createRuntime(existing, provider, new AbortController().signal); runtimes.push(old);
    const explicit = await createRuntime({ ...existing, plugins: { enabled: false },
      features: { ...existing.features, agentTypes: false, interaction: false } }, provider, new AbortController().signal);
    runtimes.push(explicit);
    assert.deepEqual(pinToolSchemas(old.tools), pinToolSchemas(explicit.tools));
    assert.equal(Object.hasOwn(tool(old.tools, 'agent').schema.input_schema.properties ?? {}, 'isolation'), false);
    const enabled = await createRuntime({ ...existing, plugins: { enabled: true },
      features: { ...existing.features, agentTypes: true, interaction: true } }, provider, new AbortController().signal);
    runtimes.push(enabled);
    assert.ok(Object.hasOwn(tool(enabled.tools, 'agent').schema.input_schema.properties ?? {}, 'isolation'));
    assert.ok(enabled.tools.some(item => item.schema.name === 'plugin_list'));
    assert.ok(enabled.tools.some(item => item.schema.name === 'ask_user_question'));
  } finally {
    await Promise.all(runtimes.map(runtime => runtime.close()));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test('owned checkout rebuilds task, memory, checkpoint and worktree tools; resume keeps the lease', async () => {
  const operations = [
    { name: 'task_create', input: { subject: 'child only', description: 'Isolated task' } },
    { name: 'memory_write', input: { name: 'child', content: 'Isolated memory' } },
    { name: 'checkpoint_create', input: { name: 'child' } },
    { name: 'worktree_list', input: {} },
    { name: 'task_list', input: {} },
  ];
  let calls = 0;
  const seen: string[] = [];
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    const previous = result(request);
    if (previous) {
      assert.equal(previous.is_error, undefined, JSON.stringify(previous));
      seen.push(String(previous.content));
    }
    const names = request.tools?.map(item => 'name' in item ? item.name : '') ?? [];
    for (const name of ['agent', 'send_message', 'workflow_run', 'run_background', 'cron_create', 'poll_agents']) {
      assert.equal(names.includes(name), false, name);
    }
    const operation = operations[calls++];
    if (!operation) return done();
    return response([{ type: 'tool_use', id: `step-${calls}`, name: operation.name, input: operation.input }], true);
  } };
  const f = await fixture(provider);
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'inspect', mode: 'general', isolation: 'worktree', max_turns: 10 })) as Child;
    assert.equal(child.status, 'completed');
    assert.ok(child.workspace && child.workspace !== f.workspace);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'file.txt'), 'utf8'), 'baseline\n');
    assert.match(seen.at(-1)!, /child only/);
    const parentTasks = JSON.parse(await f.invoke('task_list', {}));
    assert.deepEqual(parentTasks, []);
    assert.deepEqual(JSON.parse(await f.invoke('memory_list', {})).memories, []);
    assert.equal(fs.existsSync(path.join(f.workspace, '.agent', 'checkpoints')), false);
    assert.ok(fs.existsSync(path.join(child.workspace, '.agent', 'checkpoints', 'manifests', 'child.json')));
    const session = Session.open(child.workspace, { id: child.session_id, storageRoot: f.workspace });
    try {
      assert.equal(session.config.workspace, child.workspace);
      assert.equal(session.config.features?.background, false);
      assert.equal(session.config.features?.agentIdle, false);
      assert.equal(session.config.features?.workflow, false);
      assert.equal(session.config.features?.worktrees, true);
      const childNames = session.config.tools.map(item => item.name);
      const expected = f.runtime.tools.filter(item => !['agent', 'list_agents', 'send_message', 'get_agent', 'stop_agent',
        'poll_agents', 'run_background', 'monitor', 'get_background_task', 'task_stop', 'read_notifications',
        'cron_create', 'cron_delete', 'cron_list', 'schedule_wakeup', 'workflow_run', 'workflow_get'].includes(item.schema.name));
      assert.deepEqual(childNames, expected.map(item => item.schema.name));
      assert.deepEqual(session.config.tools, pinToolSchemas(expected));
    } finally { session.close(); }
    await f.invoke('send_message', { id: child.id, message: 'resume' });
    const resumed = JSON.parse(await f.invoke('get_agent', { id: child.id, wait_ms: 30_000 })) as Child;
    assert.equal(resumed.status, 'completed'); assert.equal(resumed.workspace, child.workspace);
    assert.ok(fs.existsSync(child.workspace));
    const stopped = JSON.parse(await f.invoke('stop_agent', { id: child.id })) as Child;
    // Metadata written by workspace tools is preserved by discard_changes=false.
    assert.ok(fs.existsSync(child.workspace));
    assert.match(stopped.cleanup_error ?? '', /preserved at/);
    assert.ok(fs.existsSync(path.join(f.workspace, '.agent', `${child.session_id}.jsonl`)));
  } finally { await f.cleanup(); }
});

test('clean child checkout closes on stop while its parent-owned journal stays available', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => done() };
  const f = await fixture(provider);
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'read', isolation: 'worktree' })) as Child;
    assert.equal(child.status, 'completed'); assert.ok(child.workspace);
    assert.ok(fs.existsSync(child.workspace));
    await f.invoke('stop_agent', { id: child.id });
    assert.equal(fs.existsSync(child.workspace), false);
    assert.ok(fs.existsSync(path.join(f.workspace, '.agent', `${child.session_id}.jsonl`)));
    assert.equal(git(f.workspace, 'branch', '--list', `harness/${path.basename(child.workspace)}`), '');
  } finally { await f.cleanup(); }
});

test('child writes remain in owned checkout and dirty checkout path is retained after close', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (calls++) { assert.equal(result(request)?.is_error, undefined); return done(); }
    return response([{ type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'file.txt', content: 'child change\n', overwrite: true } }], true);
  } };
  const f = await fixture(provider);
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'write', mode: 'general', isolation: 'worktree' })) as Child;
    assert.equal(child.status, 'completed'); assert.ok(child.workspace);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'file.txt'), 'utf8'), 'baseline\n');
    assert.equal(fs.readFileSync(path.join(child.workspace, 'file.txt'), 'utf8'), 'child change\n');
    const stopped = JSON.parse(await f.invoke('stop_agent', { id: child.id })) as Child;
    assert.match(stopped.cleanup_error ?? '', new RegExp(child.workspace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await f.runtime.close();
    assert.ok(fs.existsSync(child.workspace));
    assert.match(git(f.workspace, 'worktree', 'list', '--porcelain'), /agent-/);
  } finally { await f.cleanup(); }
});

test('isolated child retains parent deny policy even with a narrower named tool catalog', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    assert.deepEqual(request.tools?.map(item => 'name' in item ? item.name : ''), ['write_file']);
    if (calls++) { assert.equal(result(request)?.is_error, true); return done(); }
    return response([{ type: 'tool_use', id: 'denied', name: 'write_file', input: { path: 'file.txt', content: 'denied change' } }], true);
  } };
  const f = await fixture(provider, { permissions: { mode: 'bypass', allow: [], deny: ['write_file'] },
    agentTypes: [{ name: 'writer', description: 'Fixture writer', body: 'Focused writer',
      path: '/fixture/agents/writer.md', mode: 'general', tools: ['write_file'], isolation: 'worktree' }] });
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'write', subagent_type: 'writer' })) as Child;
    assert.equal(child.status, 'completed'); assert.ok(child.workspace);
    assert.equal(fs.readFileSync(path.join(child.workspace, 'file.txt'), 'utf8'), 'baseline\n');
    const session = Session.open(child.workspace, { id: child.id, storageRoot: f.workspace });
    try { assert.deepEqual(session.config.permissions, f.config.permissions); }
    finally { session.close(); }
    await f.invoke('stop_agent', { id: child.id });
    assert.equal(fs.existsSync(child.workspace), false);
  } finally { await f.cleanup(); }
});

test('runtime abort releases a running clean checkout after provider cancellation', async () => {
  let entered!: () => void;
  const ready = new Promise<void>(resolve => { entered = resolve; });
  const provider: ModelProvider = { count: async () => 0, complete: async (_request, signal) => {
    entered();
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      if (signal.aborted) reject(signal.reason);
    });
  } };
  const f = await fixture(provider);
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'wait', isolation: 'worktree', background: true })) as Child;
    await ready;
    assert.ok(fs.existsSync(child.workspace!));
    f.controller.abort();
    await f.runtime.close();
    assert.equal(fs.existsSync(child.workspace!), false);
    assert.ok(fs.existsSync(path.join(f.workspace, '.agent', `${child.session_id}.jsonl`)));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.workspace, '.agent', 'worktrees.json'), 'utf8')).records, []);
  } finally { await f.cleanup(); }
});

test('standalone agent factory enables isolated checkouts without registry messaging', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (calls++) { assert.match(String(result(request)?.content), /baseline/); return done(); }
    return response([{ type: 'tool_use', id: 'read', name: 'read_file', input: { path: 'file.txt' } }], true);
  } };
  const f = await fixture(provider, { features: { tasks: false, subagents: true, agentTypes: true } });
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'read', isolation: 'worktree' })) as Child;
    assert.ok(child.workspace && child.workspace !== f.workspace);
    assert.equal(child.summary, undefined);
    assert.equal(fs.existsSync(child.workspace), false);
    assert.ok(fs.existsSync(path.join(f.workspace, '.agent', `${child.session_id}.jsonl`)));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.workspace, '.agent', 'worktrees.json'), 'utf8')).records, []);
  } finally { await f.cleanup(); }
});

test('standalone dirty checkout returns its successful child result with cleanup diagnostics', async () => {
  let calls = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    if (calls++) { assert.equal(result(request)?.is_error, undefined); return done(); }
    return response([{ type: 'tool_use', id: 'write', name: 'write_file',
      input: { path: 'file.txt', content: 'standalone child change\n', overwrite: true } }], true);
  } };
  const f = await fixture(provider, { features: { tasks: false, subagents: true, agentTypes: true } });
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'write', mode: 'general', isolation: 'worktree' })) as {
      session_id: string; reason: string; text: string; model_calls: number; workspace: string; cleanup_error?: string;
    };
    assert.equal(child.reason, 'end_turn');
    assert.equal(child.text, 'fixture complete');
    assert.equal(child.model_calls, 2);
    assert.match(child.session_id, /^[0-9a-f-]{36}$/);
    assert.ok(child.workspace !== f.workspace && fs.existsSync(child.workspace));
    assert.match(child.cleanup_error ?? '', /preserved at/);
    assert.ok(child.cleanup_error?.includes(child.workspace));
    assert.equal(fs.readFileSync(path.join(child.workspace, 'file.txt'), 'utf8'), 'standalone child change\n');
    assert.equal(fs.readFileSync(path.join(f.workspace, 'file.txt'), 'utf8'), 'baseline\n');
    assert.ok(fs.existsSync(path.join(f.workspace, '.agent', `${child.session_id}.jsonl`)));
    const session = Session.open(child.workspace, { id: child.session_id, storageRoot: f.workspace });
    try { assert.equal(session.events.at(-1)?.kind, 'turn_end'); }
    finally { session.close(); }
    const records = JSON.parse(fs.readFileSync(path.join(f.workspace, '.agent', 'worktrees.json'), 'utf8')).records;
    assert.equal(records.length, 1);
    assert.equal(records[0].state, 'ready');
  } finally { await f.cleanup(); }
});

test('unmerged child commits survive stop and expose the preserved checkout', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => done() };
  const f = await fixture(provider);
  try {
    const child = JSON.parse(await f.invoke('agent', { prompt: 'read', isolation: 'worktree' })) as Child;
    fs.writeFileSync(path.join(child.workspace!, 'file.txt'), 'committed child change\n');
    git(child.workspace!, 'add', 'file.txt');
    git(child.workspace!, 'commit', '-m', 'Synthetic child change');
    const head = git(child.workspace!, 'rev-parse', 'HEAD');
    const stopped = JSON.parse(await f.invoke('stop_agent', { id: child.id })) as Child;
    assert.match(stopped.cleanup_error ?? '', /unmerged commits/);
    assert.ok(fs.existsSync(child.workspace!));
    assert.equal(git(child.workspace!, 'rev-parse', 'HEAD'), head);
    assert.equal(fs.readFileSync(path.join(f.workspace, 'file.txt'), 'utf8'), 'baseline\n');
  } finally { await f.cleanup(); }
});

test('concurrent child checkouts serialize owned metadata updates and runtime close cleans both', async () => {
  const provider: ModelProvider = { count: async () => 0, complete: async () => done() };
  const f = await fixture(provider);
  try {
    const children = await Promise.all(['one', 'two'].map(async prompt => JSON.parse(await f.invoke('agent', {
      prompt, isolation: 'worktree', background: true,
    })) as Child));
    await Promise.all(children.map(child => f.invoke('get_agent', { id: child.id, wait_ms: 30_000 })));
    assert.equal(new Set(children.map(child => child.workspace)).size, 2);
    await f.runtime.close();
    for (const child of children) assert.equal(fs.existsSync(child.workspace!), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.workspace, '.agent', 'worktrees.json'), 'utf8')).records, []);
  } finally { await f.cleanup(); }
});
