import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { Agent, defaultConfig } from '../src/agent.js';
import type { SkillInfo } from '../src/config.js';
import { HOOK_EVENTS, type HooksConfig } from '../src/hooks.js';
import type { ModelProvider } from '../src/provider.js';
import type { SessionConfig } from '../src/session.js';
import { createTools, type ToolContext, type ToolDefinition } from '../src/tools.js';
import {
  buildSystem,
  createRuntime,
  createSkillTool,
  expandUserSkill,
  findSkill,
  parseSettings,
  parseSlashCommand,
  pinToolSchemas,
  runtimeAbilities,
  validateRuntimeConfig,
  type Runtime,
} from '../src/runtime.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_MCP = String.raw`
const fs = require("fs");
const OUT = process.argv[1] || "";
function send(o) { process.stdout.write(JSON.stringify(o) + "\n"); }
function note(o) { if (OUT) { try { fs.appendFileSync(OUT, JSON.stringify(o) + "\n"); } catch (e) {} } }
if (OUT) note({ pid: process.pid });
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", function (chunk) {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch (e) { continue; }
    if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "mock", version: "1" } } });
    else if (msg.method === "notifications/initialized") {}
    else if (msg.method === "tools/list") send({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "echo", description: "Echo text", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] } });
    else if (msg.method === "tools/call") send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "echo:" + ((msg.params.arguments && msg.params.arguments.text) || "") }] } });
  }
});
`;

const tempDirs: string[] = [];
function tmpDir(prefix = 'ccrev-runtime-'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
});

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
async function waitFor(check: () => boolean, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (check()) return; await delay(25); }
  throw new Error('condition was not met before the timeout');
}
function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}
function readNotes(file: string): Record<string, unknown>[] {
  let raw: string;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return []; }
  return raw.split('\n').filter(l => l.trim()).flatMap(l => { try { return [JSON.parse(l) as Record<string, unknown>]; } catch { return []; } });
}
function toContext(workspace: string): ToolContext {
  return { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000 };
}
function skill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return { name: 'greet', description: 'Say hello', path: '/skills/greet/SKILL.md', body: 'Hello $ARGUMENTS',
    userInvocable: true, disableModelInvocation: false, ...overrides };
}
const unusedProvider: ModelProvider = {
  count: async () => 0,
  complete: async () => { throw new Error('model must not be called in this test'); },
};

test('trusted callback hooks reach child and skill lifecycles with independent once claims', async () => {
  const workspace = fs.realpathSync(tmpDir());
  const config = defaultConfig(workspace, []); config.model = 'fixture';
  config.features = { tasks: false, subagents: true, agentMessaging: true };
  config.hooks = { SessionStart: [{ type: 'callback', name: 'fixture', once: true }] };
  const ids: string[] = [];
  const provider: ModelProvider = { count: async () => 1, complete: async () => ({ id: 'fixture', model: 'fixture',
    type: 'message', role: 'assistant', content: [{ type: 'text', text: 'done', citations: null }], stop_reason: 'end_turn',
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as never) };
  const runtime = await createRuntime(config, provider, new AbortController().signal, { hookCallbacks: () => ({
    fixture: async (_definition, _event, payload) => { ids.push(payload.session_id!); return { additionalContext: 'trusted child context' }; },
  }) });
  try {
    const tools = runtime.buildTools(config, 'parent'); config.tools = pinToolSchemas(tools);
    const agent = tools.find(tool => tool.schema.name === 'agent')!;
    await agent.execute({ prompt: 'child task', mode: 'general', background: false }, toContext(workspace));
    await runtime.runSkill!(config, 'parent', skill({ context: 'fork' }), 'skill task', new AbortController().signal);
    assert.equal(ids.length, 2); assert.equal(new Set(ids).size, 2);
    for (const id of ids) {
      const records = fs.readFileSync(path.join(workspace, '.agent', `${id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      assert.equal(records.filter(record => record.kind === 'hook_once').length, 1);
      assert.ok(records.some(record => record.kind === 'hook_result' && record.additionalContext.includes('trusted child context')));
    }
  } finally { await runtime.close(); }
});

// ---------------------------------------------------------------------------
// Settings mapping
// ---------------------------------------------------------------------------

test('parseSettings maps known runtime fields and ignores unknown keys', () => {
  const parsed = parseSettings({
    model: 'magpie-x', baseURL: 'http://127.0.0.1:9', auth: 'api-key', tokenCounting: 'api',
    thinking: true, promptCaching: true, eagerToolInput: true, allowShell: true,
    maxTurns: 5, maxTokens: 10, contextTokens: 11, compactAt: 12, maxOutputBytes: 13,
    hooks: {
      PreToolUse: [{ command: 'echo hi', matcher: 'Write', timeout: 1.5 }],
      PostToolBatch: [{ command: 'echo batch' }],
      SessionEnd: [{ command: 'echo bye' }],
    },
    permissions: { mode: 'plan', allow: ['read_*'], deny: ['run_command'] },
    mcpServers: { srv: { command: 'node', args: ['-e', 'x'] } },
    features: { tasks: false },
    alpha: 1, list: [1, 2], nested: { x: 1 },
  });
  assert.equal(parsed.model, 'magpie-x');
  assert.equal(parsed.baseURL, 'http://127.0.0.1:9');
  assert.equal(parsed.auth, 'api-key');
  assert.equal(parsed.tokenCounting, 'api');
  assert.equal(parsed.thinking, true);
  assert.equal(parsed.maxOutputBytes, 13);
  assert.deepEqual(parsed.permissions, { mode: 'plan', allow: ['read_*'], deny: ['run_command'] });
  assert.deepEqual(parsed.mcpServers, { srv: { command: 'node', args: ['-e', 'x'] } });
  assert.deepEqual(parsed.features, { tasks: false });
  assert.deepEqual(parsed.hooks, {
    PreToolUse: [{ command: 'echo hi', matcher: 'Write', timeout: 1.5 }],
    PostToolBatch: [{ command: 'echo batch' }],
    SessionEnd: [{ command: 'echo bye' }],
  });
  // Unknown keys never reach the parsed settings.
  assert.equal('alpha' in parsed, false);
  assert.equal('nested' in parsed, false);
});

test('parseSettings rejects malformed known fields and unknown hook events', () => {
  assert.throws(() => parseSettings({ thinking: 'yes' }), /settings\.thinking/);
  assert.throws(() => parseSettings({ maxTurns: 0 }), /settings\.maxTurns/);
  assert.throws(() => parseSettings({ auth: 'basic' }), /settings\.auth/);
  assert.throws(() => parseSettings({ permissions: { mode: 'yolo', allow: [], deny: [] } }));
  // An unknown hook event name is dropped, not merged.
  assert.deepEqual(parseSettings({ hooks: { NotARealEvent: [{ command: 'x' }] } }).hooks, {});
  // A mix keeps the known event and drops only the unknown one.
  assert.deepEqual(
    parseSettings({ hooks: { Stop: [{ command: 'x' }], NotARealEvent: [{ command: 'y' }] } }).hooks,
    { Stop: [{ command: 'x' }] },
  );
  // Every new event is accepted by the lenient runtime loader.
  for (const event of HOOK_EVENTS) {
    assert.deepEqual(parseSettings({ hooks: { [event]: [{ command: 'x' }] } }).hooks, {
      [event]: [{ command: 'x' }],
    });
  }
});

test('the strict session config schema accepts every hook event but rejects an unknown one', () => {
  const config = defaultConfig(fs.realpathSync(tmpDir()), createTools());
  config.model = 'test';
  for (const event of HOOK_EVENTS) {
    config.hooks = { [event]: [{ command: 'true' }] };
    assert.doesNotThrow(() => validateRuntimeConfig(config), `session schema rejected ${event}`);
  }
  config.hooks = { NotARealEvent: [{ command: 'true' }] } as unknown as HooksConfig;
  assert.throws(() => validateRuntimeConfig(config));
});

test('parseSettings rejects an explicit MCP env member so no environment is journaled', () => {
  assert.throws(() => parseSettings({ mcpServers: { srv: { command: 'node', env: { TOKEN: 'secret' } } } }));
});

// ---------------------------------------------------------------------------
// System prompt assembly
// ---------------------------------------------------------------------------

test('buildSystem appends instructions and a model-invocable skill catalog', () => {
  const system = buildSystem('BASE', [{ path: '/repo/HARNESS.md', content: 'Do X\n' }], [
    skill(),
    skill({ name: 'auto', description: 'Auto only', disableModelInvocation: true }),
  ]);
  assert.ok(system.startsWith('BASE'));
  assert.match(system, /# Project instructions/);
  assert.match(system, /Instructions from \/repo\/HARNESS\.md:\nDo X/);
  assert.match(system, /# Available skills/);
  assert.match(system, /- greet: Say hello/);
  assert.ok(!/- auto:/.test(system), 'non-model-invocable skills are hidden from the catalog');

  assert.equal(buildSystem('BASE', [], []), 'BASE');
});

// ---------------------------------------------------------------------------
// Skill tool and slash resolution
// ---------------------------------------------------------------------------

test('the skill tool expands snapshot bodies and guards disable-model-invocation', async () => {
  const config = { skills: [skill(), skill({ name: 'auto', body: 'Auto', disableModelInvocation: true })] } as SessionConfig;
  const tool = createSkillTool(config);
  assert.equal(tool.readOnly, true);
  assert.equal(tool.schema.name, 'skill');
  assert.equal(await tool.execute({ name: 'greet', args: 'world' }, toContext('/tmp')), 'Hello world');
  await assert.rejects(tool.execute({ name: 'missing' }, toContext('/tmp')), /Unknown skill/);
  await assert.rejects(tool.execute({ name: 'auto' }, toContext('/tmp')), /not model-invocable/);
  await assert.rejects(tool.execute({ name: '' }, toContext('/tmp')));
});

test('skill instructions respect the output byte cap without splitting UTF-8', async () => {
  const config = { skills: [skill({ body: '你好'.repeat(100) })] } as SessionConfig;
  const output = await createSkillTool(config).execute({ name: 'greet' }, { ...toContext('/tmp'), maxOutputBytes: 7 });
  assert.ok(output.startsWith('你好\n')); assert.ok(!output.includes('�'));
  assert.match(output, /Skill instructions truncated/);
});

test('slash parsing and explicit skill expansion honor user-invocable', () => {
  assert.deepEqual(parseSlashCommand('/greet a b'), { name: 'greet', args: 'a b' });
  assert.deepEqual(parseSlashCommand('/greet'), { name: 'greet', args: '' });
  assert.equal(parseSlashCommand('hello'), undefined);
  assert.equal(parseSlashCommand('/'), undefined);
  assert.deepEqual(parseSlashCommand("/plugin:review:quick a b"), { name: "plugin:review:quick", args: "a b" });
  assert.equal(parseSlashCommand("/plugin::review"), undefined);

  const invocable = skill();
  assert.equal(expandUserSkill(invocable, 'x y'), 'Hello x y');
  assert.equal(findSkill([invocable], 'greet'), invocable);
  assert.equal(findSkill([invocable], 'nope'), undefined);
  const aliased = { ...invocable, name: "plugin:review", aliases: ["quick"] };
  assert.equal(findSkill([aliased], "quick"), aliased);
  assert.equal(findSkill([aliased, { ...invocable, name: "quick" }], "quick")!.name, "quick");
  assert.throws(() => findSkill([aliased, { ...aliased, name: "other:review" }], "quick"), /Ambiguous skill alias/);
  assert.throws(() => expandUserSkill(skill({ userInvocable: false }), 'x'), /not user-invocable/);
  // disable-model-invocation is permitted for an explicit user invocation.
  assert.equal(expandUserSkill(skill({ disableModelInvocation: true, body: 'B' }), ''), 'B');
});

// ---------------------------------------------------------------------------
// Abilities and schema pinning
// ---------------------------------------------------------------------------

test('runtimeAbilities distinguishes legacy and modern configurations', () => {
  const base = { features: undefined, skills: undefined, mcpServers: undefined } as unknown as SessionConfig;
  assert.deepEqual(runtimeAbilities(base), { skill: false, tasks: false, subagents: false });
  const modern = { features: { tasks: true, subagents: false } } as SessionConfig;
  assert.deepEqual(runtimeAbilities(modern), { skill: true, tasks: true, subagents: false });
  const skillsOnly = { skills: [] } as unknown as SessionConfig;
  assert.deepEqual(runtimeAbilities(skillsOnly), { skill: true, tasks: false, subagents: false });
});

test('pinToolSchemas marks every schema for eager input streaming', () => {
  const pinned = pinToolSchemas(createTools());
  assert.ok(pinned.length > 0);
  assert.ok(pinned.every(schema => (schema as { eager_input_streaming?: boolean }).eager_input_streaming === true));
});

test('validateRuntimeConfig accepts a well-formed base configuration', () => {
  const config = defaultConfig(tmpDir(), createTools());
  config.model = 'test';
  assert.doesNotThrow(() => validateRuntimeConfig(config));
});

// ---------------------------------------------------------------------------
// createRuntime: MCP discovery, tool assembly and teardown
// ---------------------------------------------------------------------------

function runtimeConfig(workspace: string, out: string): SessionConfig {
  const config = defaultConfig(workspace, createTools());
  config.model = 'test';
  config.features = { tasks: true, subagents: true };
  config.skills = [skill()];
  config.mcpServers = { srv: { command: process.execPath, args: ['-e', MOCK_MCP, out] } };
  return config;
}

test('createRuntime discovers MCP tools, assembles config tools and closes its children', async () => {
  const ws = tmpDir();
  const out = path.join(ws, 'notes.jsonl');
  const config = runtimeConfig(ws, out);
  const runtime: Runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    const names = runtime.tools.map(t => t.schema.name);
    for (const expected of ['read_file', 'list_files', 'search', 'write_file', 'edit_file', 'run_command']) {
      assert.ok(names.includes(expected), `missing base tool ${expected}`);
    }
    assert.ok(names.includes('task_create') && names.includes('task_list'));
    assert.ok(names.includes('skill'));
    assert.ok(names.includes('agent'));
    assert.ok(names.includes('mcp__srv__echo'));
    assert.ok(runtime.limits.some(entry => entry.includes('2024-11-05')));

    // The MCP tool is callable through the adapted definition.
    const echo = runtime.tools.find(t => t.schema.name === 'mcp__srv__echo');
    assert.ok(echo);
    assert.equal(await echo.execute({ text: 'hi' }, toContext(ws)), 'echo:hi');

    // buildTools returns a fresh array bound to the passed configuration.
    const rebuilt = runtime.buildTools(config);
    assert.notEqual(rebuilt, runtime.tools);
    assert.deepEqual(rebuilt.map(t => t.schema.name), names);

    await waitFor(() => readNotes(out).some(note => typeof note.pid === 'number'));
    const pid = readNotes(out).find(note => typeof note.pid === 'number')?.pid as number;
    assert.ok(processAlive(pid));

    await runtime.close();
    await runtime.close(); // idempotent
    await waitFor(() => !processAlive(pid));
  } finally {
    await runtime.close();
  }
});

test('a legacy configuration yields base tools only, matching a resumed old session', async () => {
  const ws = tmpDir();
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    const names = runtime.tools.map(t => t.schema.name);
    assert.deepEqual(names, ['read_file', 'list_files', 'search', 'write_file', 'edit_file', 'run_command']);
    assert.equal(names.includes('skill'), false);
    assert.equal(names.includes('agent'), false);
  } finally { await runtime.close(); }
});

test('createRuntime surfaces an MCP connect failure without leaking the provider', async () => {
  const ws = tmpDir();
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  config.mcpServers = { bad: { command: process.execPath, args: ['-e', 'process.exit(0)'] } };
  await assert.rejects(createRuntime(config, unusedProvider, new AbortController().signal));
});

// ---------------------------------------------------------------------------
// The assembled config integrates with the session layer
// ---------------------------------------------------------------------------

test('a modern session round-trips runtime fields and rebuilt tools match the pinned schemas', async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  config.skills = [skill()];
  config.features = { tasks: true, subagents: true };
  config.permissions = { mode: 'acceptEdits', allow: ['read_*'], deny: ['run_command'] };
  const runtime = await createRuntime(config, unusedProvider, new AbortController().signal);
  try {
    config.tools = pinToolSchemas(runtime.tools);
    validateRuntimeConfig(config);
    const { Session } = await import('../src/session.js');
    const session = Session.open(ws, { config });
    try {
      assert.deepEqual(session.config.features, { tasks: true, subagents: true });
      assert.equal(session.config.skills?.length, 1);
      assert.deepEqual(session.config.permissions, { mode: 'acceptEdits', allow: ['read_*'], deny: ['run_command'] });
      assert.equal('env' in (session.config.mcpServers ?? {}), false);
      // Rebuilding tools for the resumed config must reproduce the pinned schemas,
      // which is what the Agent constructor enforces on resume.
      assert.doesNotThrow(() => new Agent(session, unusedProvider, runtime.buildTools(session.config)));
    } finally { session.close(); }
  } finally { await runtime.close(); }
});

// ---------------------------------------------------------------------------
// Session hook snapshots: optional stopRequested
// ---------------------------------------------------------------------------

test('a session hook_result round-trips an optional stopRequested and keeps legacy events unchanged', async () => {
  const ws = fs.realpathSync(tmpDir());
  const config = defaultConfig(ws, createTools());
  config.model = 'test';
  validateRuntimeConfig(config);
  const { Session } = await import('../src/session.js');
  // A legacy Stop result has no stopRequested; a terminal one adds it.
  const legacy = { kind: 'hook_result' as const, id: 'h1', event: 'Stop', blocked: true, reason: 'keep going', additionalContext: [] };
  const terminal = { kind: 'hook_result' as const, id: 'h2', event: 'Stop', blocked: true, additionalContext: [], stopRequested: true };
  const session = Session.open(ws, { config });
  try {
    session.append(legacy);
    session.append(terminal);
    const stored = session.events.filter((event) => event.kind === 'hook_result');
    assert.equal(stored.length, 2);
    // Absence is preserved: no default field is added to the legacy snapshot.
    assert.equal('stopRequested' in stored[0]!, false);
    assert.equal((stored[0] as { stopRequested?: boolean }).stopRequested, undefined);
    assert.equal((stored[1] as { stopRequested?: boolean }).stopRequested, true);
  } finally { session.close(); }
});
