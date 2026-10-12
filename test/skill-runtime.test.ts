import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import type { SkillInfo } from '../src/config.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { executeSkill, skillRequiresExecution, type SkillExecutionOptions } from '../src/skill-runtime.js';
import { Session } from '../src/session.js';
import { listSessions } from '../src/sessions.js';
import { createTools, type ToolDefinition } from '../src/tools.js';

function skill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return { name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: 'Task $ARGUMENTS', userInvocable: true, disableModelInvocation: false, ...overrides };
}
function response(content: ({ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown })[], reason = 'end_turn'): Anthropic.Message {
  return { id: 'fixture', type: 'message', role: 'assistant', model: 'fixture', content, stop_reason: reason, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
async function fixture(run: (options: SkillExecutionOptions) => Promise<void>, complete?: ModelProvider['complete']): Promise<void> {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-')));
  const tools = createTools(); const config = defaultConfig(workspace, tools); config.model = 'fixture';
  const provider: ModelProvider = { count: async () => 0, complete: complete ?? (async () => response([{ type: 'text', text: 'Summary' }])) };
  try { await run({ config, provider, tools, signal: new AbortController().signal, source: 'user' }); }
  finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}

test('plain skills return expanded text and invocation eligibility remains explicit', async () => {
  await fixture(async options => {
    assert.equal(await executeSkill(skill(), 'arguments', options), 'Task arguments');
    assert.equal(listSessions(options.config.workspace).length, 0);
    await assert.rejects(executeSkill(skill({ disableModelInvocation: true }), '', { ...options, source: 'model' }), /disabled for model/);
    assert.equal(await executeSkill(skill({ disableModelInvocation: true }), 'explicit', options), 'Task explicit');
    await assert.rejects(executeSkill(skill({ userInvocable: false }), '', options), /hidden from user/);
  });
});

test('fork skill agent routing intersects type tools and applies pinned body/model/effort', async () => {
  let request: ModelRequest | undefined;
  await fixture(async options => {
    options.config.agentTypes = [{ name: 'reviewer', description: 'fixture', path: '/fixture/reviewer.md',
      body: 'ROUTED_AGENT_BODY', mode: 'explore', tools: ['read_file', 'write_file'], model: 'type-model', effort: 'high', maxTurns: 2 }];
    const routed = skill({ context: 'fork', agent: 'reviewer', allowedTools: ['read_file', 'write_file'] });
    const result = JSON.parse(await executeSkill(routed, 'inspect', options));
    assert.equal(result.text, 'Summary'); assert.equal(request!.model, 'type-model');
    assert.equal(request!.output_config?.effort, 'high'); assert.match(String(request!.system), /ROUTED_AGENT_BODY/);
    assert.deepEqual(request!.tools!.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    await assert.rejects(executeSkill({ ...routed, agent: 'unknown' }, '', options), /Unknown agent type/);
    await assert.rejects(executeSkill({ ...routed, context: undefined }, '', options), /requires context/);
  }, async value => { request = value; return response([{ type: 'text', text: 'Summary' }]); });
});

test('fork pins model and tools in an isolated child and leaves parent config untouched', async () => {
  let request: ModelRequest | undefined;
  await fixture(async options => {
    const before = JSON.stringify(options.config);
    const result = JSON.parse(await executeSkill(skill({ context: 'fork', model: 'child-model', allowedTools: ['read_file'] }), 'inspect', options));
    assert.equal(result.text, 'Summary'); assert.equal(result.reason, 'end_turn'); assert.equal(result.model_calls, 1);
    assert.equal(request!.model, 'child-model');
    assert.deepEqual(request!.tools!.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    assert.deepEqual(request!.messages[0], { role: 'user', content: 'Task inspect' });
    assert.equal(JSON.stringify(options.config), before);
    assert.equal(listSessions(options.config.workspace)[0]!.active, false);
  }, async value => { request = value; return response([{ type: 'text', text: 'Summary' }]); });
});

test('fork skill snapshots paired history, drops bound thinking and persists seeds before startup without replay', async () => {
  let calls = 0; let effects = 0;
  const conversation: Anthropic.MessageParam[] = [
    { role: 'user', content: 'Parent task' },
    { role: 'assistant', content: [
      { type: 'thinking', thinking: '', signature: 'parent-binding' },
      { type: 'redacted_thinking', data: 'parent-redacted-binding' },
      { type: 'text', text: 'Parent progress' },
      { type: 'tool_use', id: 'parent-write', name: 'fixture_write', input: { value: 'parent' } },
      { type: 'tool_use', id: 'parent-read', name: 'fixture_write', input: { value: 'other' } },
    ] },
    { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'parent-write', content: 'Already written' },
      { type: 'tool_result', tool_use_id: 'parent-read', content: 'Already read' },
    ] },
  ];
  const expected = structuredClone(conversation);
  expected[1]!.content = (expected[1]!.content as Anthropic.ContentBlockParam[]).filter(block => !['thinking', 'redacted_thinking'].includes(block.type));
  await fixture(async options => {
    const tool: ToolDefinition = { schema: { name: 'fixture_write', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: false,
      async execute() { effects++; return 'Executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    options.config.effort = 'medium';
    options.config.hooks = { SessionStart: [{ type: 'prompt', prompt: 'Check seeded startup' }] };
    const before = structuredClone(options.config);
    const invoke = executeSkill(skill({ context: 'fork', model: 'skill-model', effort: 'high' }), 'child', { ...options, conversation });
    conversation[0]!.content = 'Changed after invocation';
    const result = JSON.parse(await invoke);
    assert.equal(result.text, 'Summary'); assert.equal(effects, 0); assert.deepEqual(options.config, before);
    const session = Session.open(options.config.workspace, { id: result.session_id });
    try {
      assert.deepEqual(session.messages.slice(0, expected.length), expected);
      assertPaired(session.messages);
      const boundary = session.events.findIndex(event => event.kind === 'turn_end' && event.reason === 'fork_seed');
      const startup = session.events.findIndex(event => event.kind === 'hook_start' && event.event === 'SessionStart');
      assert.equal(boundary, expected.length + 1); assert.ok(startup > boundary);
      assert.equal(session.events.some(event => event.kind === 'tool_start' || event.kind === 'tool_result'), false);
      assert.equal(session.config.model, 'skill-model'); assert.equal(session.config.effort, 'high');
      const resumed = new Agent(session, options.provider, options.tools);
      await resumed.startSession('resume', options.signal);
      await resumed.run('Continue child', options.signal);
      assert.equal(effects, 0); assert.equal(calls, 2);
    } finally { session.close(); }
  }, async request => {
    if (String(request.system).startsWith('Evaluate the configured lifecycle hook')) {
      return response([{ type: 'text', text: '{"ok":true}' }]);
    }
    calls++;
    assert.equal(request.model, 'skill-model'); assert.equal(request.output_config?.effort, 'high');
    assert.deepEqual(request.messages.slice(0, expected.length), expected); assertPaired(request.messages);
    assert.equal(JSON.stringify(request.messages).includes('parent-binding'), false);
    assert.equal(JSON.stringify(request.messages).includes('parent-redacted-binding'), false);
    assert.equal(request.messages.at(-1)!.content, calls === 1 ? 'Task child' : 'Continue child');
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('fork skill failed provider resume retains seed history without replaying parent effects', async () => {
  let calls = 0; let effects = 0;
  const conversation: Anthropic.MessageParam[] = [
    { role: 'user', content: 'Parent task' },
    { role: 'assistant', content: [{ type: 'tool_use', id: 'done', name: 'fixture_write', input: {} }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'done', content: 'Completed previously' }] },
  ];
  await fixture(async options => {
    const tool: ToolDefinition = { schema: { name: 'fixture_write', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: false,
      async execute() { effects++; return 'Executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    await assert.rejects(executeSkill(skill({ context: 'fork' }), 'resume task', { ...options, conversation }), /fixture outage/);
    const session = Session.open(options.config.workspace, { id: listSessions(options.config.workspace)[0]!.id });
    try {
      assert.equal(session.awaitingResponse, true);
      const resumed = new Agent(session, options.provider, options.tools);
      await resumed.startSession('resume', options.signal);
      assert.equal((await resumed.run(undefined, options.signal)).text, 'Summary');
      assert.equal(effects, 0); assertPaired(session.messages);
      assert.equal(session.events.some(event => event.kind === 'tool_start' || event.kind === 'tool_result'), false);
    } finally { session.close(); }
  }, async request => {
    assert.deepEqual(request.messages.slice(0, conversation.length), conversation);
    assertPaired(request.messages);
    if (++calls === 1) throw new Error('fixture outage');
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('conversation is ignored by plain and metadata-only skills and absent fork snapshots remain compatible', async () => {
  let calls = 0;
  await fixture(async options => {
    const conversation: Anthropic.MessageParam[] = [{ role: 'user', content: 'Parent context' }];
    assert.equal(await executeSkill(skill(), 'inline', { ...options, conversation }), 'Task inline');
    for (const definition of [skill({ model: 'child-model' }), skill({ effort: 'low' }), skill({ background: false, allowedTools: [] })]) {
      await executeSkill(definition, 'fresh', { ...options, conversation });
    }
    await executeSkill(skill({ context: 'fork' }), 'fresh', options);
    assert.equal(calls, 4);
  }, async request => {
    calls++; assert.deepEqual(request.messages, [{ role: 'user', content: 'Task fresh' }]);
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('fork skill rejects unpaired, oversized and over-context snapshots before creating a journal or provider call', async () => {
  await fixture(async options => {
    let providerCalls = 0;
    options.provider = { count: async () => { providerCalls++; return 0; }, complete: async () => { providerCalls++; return response([]); } };
    const invoke = (conversation: Anthropic.MessageParam[]) => executeSkill(skill({ context: 'fork' }), '', { ...options, conversation });
    await assert.rejects(invoke([{ role: 'assistant', content: [{ type: 'tool_use', id: 'pending', name: 'fixture', input: {} }] }]), /Unanswered tool calls/);
    await assert.rejects(invoke([{ role: 'user', content: 'x'.repeat(8 * 1024 * 1024) }]), /byte limit/);
    options.config.maxTokens = 128; options.config.compactAt = 1024; options.config.contextTokens = 2048;
    await assert.rejects(invoke([{ role: 'user', content: 'x'.repeat(2048) }]), /context budget/);
    assert.equal(providerCalls, 0); assert.deepEqual(listSessions(options.config.workspace), []);
  });
});

test('skill effort alone forks and sends the pinned effort without changing parent configuration', async () => {
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max'] as const) {
    await fixture(async options => {
      options.config.effort = 'medium';
      const definition = skill({ effort });
      assert.equal(skillRequiresExecution(definition), true);
      const result = JSON.parse(await executeSkill(definition, '', options));
      assert.equal(result.text, 'Summary'); assert.equal(options.config.effort, 'medium');
      assert.equal(listSessions(options.config.workspace).length, 1);
    }, async request => {
      assert.equal(request.output_config?.effort, effort);
      return response([{ type: 'text', text: 'Summary' }]);
    });
  }
});

test('skills without effort inherit only explicitly configured parent effort', async () => {
  for (const parentEffort of [undefined, 'high'] as const) {
    await fixture(async options => {
      if (parentEffort !== undefined) options.config.effort = parentEffort;
      await executeSkill(skill({ context: 'fork' }), '', options);
    }, async request => {
      if (parentEffort === undefined) assert.equal(request.output_config, undefined);
      else assert.equal(request.output_config?.effort, parentEffort);
      return response([{ type: 'text', text: 'Summary' }]);
    });
  }
});

test('parent schema intersection excludes executor definitions outside the pinned parent tool set', async () => {
  await fixture(async options => {
    options.config.tools = options.config.tools.filter(tool => tool.name === 'read_file');
    const result = JSON.parse(await executeSkill(skill({ context: 'fork', allowedTools: ['*'] }), '', options));
    assert.equal(result.text, 'Summary');
  }, async request => {
    assert.deepEqual(request.tools!.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('skill command grants restrict inputs and preserve parent deny policy', async () => {
  let executed = 0; let calls = 0;
  await fixture(async options => {
    options.config.allowShell = true;
    const tool: ToolDefinition = { schema: { name: 'run_command', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: false, async execute() { executed++; return 'executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    options.config.permissions = { mode: 'default', allow: [], deny: [], inputRules: [{ tool: 'run_command', command: 'echo denied', decision: 'deny' }] };
    const result = JSON.parse(await executeSkill(skill({ context: 'fork', allowedTools: ['Bash(echo *)'] }), '', options));
    assert.equal(result.text, 'Summary'); assert.equal(executed, 0);
  }, async request => {
    calls++;
    if (calls === 1) return response([
      { type: 'tool_use', id: 'a', name: 'run_command', input: { command: 'touch forbidden' } },
      { type: 'tool_use', id: 'b', name: 'run_command', input: { command: 'echo denied' } },
    ], 'tool_use');
    const results = request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[];
    assert.ok(results.every(result => result.is_error));
    assert.match(String(results[0]!.content), /outside allowed-tools/);
    assert.match(String(results[1]!.content), /denied/);
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('block-output skill tools enforce parent path deny and skill grants before any file reads', async () => {
  for (const policy of ['parent-deny', 'skill-deny', 'allow'] as const) {
    let calls = 0; let reads = 0; let plainCalls = 0;
    await fixture(async options => {
      const file = path.join(options.config.workspace, 'private.png');
      fs.writeFileSync(file, 'fixture-media');
      const tool: ToolDefinition = {
        schema: { name: 'read_media', description: 'Fixture blocks', input_schema: { type: 'object' } }, readOnly: true,
        async execute() { plainCalls++; return 'plain'; },
        async executeBlocks(input, context) {
          assert.equal(context.allowShell, false);
          reads++;
          return [{ type: 'text', text: fs.readFileSync(path.join(context.workspace, (input as { path: string }).path), 'utf8') }];
        },
      };
      options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      options.config.permissions = { mode: 'default', allow: [], deny: [], ...(policy === 'parent-deny' ? { inputRules: [{ tool: 'read_media', path: 'private.png', decision: 'deny' as const }] } : {}) };
      const result = JSON.parse(await executeSkill(skill({ context: 'fork', allowedTools: policy === 'skill-deny' ? [] : ['read_media'] }), '', options));
      assert.equal(result.text, 'Summary');
      assert.equal(reads, policy === 'allow' ? 1 : 0); assert.equal(plainCalls, 0);
    }, async request => {
      if (++calls === 1) return response([{ type: 'tool_use', id: 'media', name: 'read_media', input: { path: 'private.png' } }], 'tool_use');
      const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
      if (policy === 'allow') {
        assert.deepEqual(result.content, [{ type: 'text', text: 'fixture-media' }]);
        assert.equal(result.is_error, undefined);
      } else {
        assert.equal(result.is_error, true);
        assert.match(String(result.content), policy === 'parent-deny' ? /denied/ : /Unknown tool/);
      }
      return response([{ type: 'text', text: 'Summary' }]);
    });
  }
});

test('block-output skill tools recheck the actual input rewritten by PreToolUse', async () => {
  let calls = 0; let reads = 0;
  const server = http.createServer((request, reply) => {
    request.resume();
    request.on('end', () => {
      reply.setHeader('content-type', 'application/json');
      reply.end(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { path: 'private.png' } } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  try {
    await fixture(async options => {
      const tool: ToolDefinition = { schema: { name: 'read_media', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: true,
        async execute() { throw new Error('Expected block executor'); }, async executeBlocks() { reads++; return [{ type: 'text', text: 'private' }]; } };
      options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      options.config.permissions = { mode: 'default', allow: [], deny: [], inputRules: [{ tool: 'read_media', path: 'private.png', decision: 'deny' }] };
      await executeSkill(skill({ context: 'fork', allowedTools: ['read_media'], hooks: { PreToolUse: [{ type: 'http', url: `http://127.0.0.1:${address.port}/rewrite` }] } }), '', options);
      assert.equal(reads, 0);
    }, async request => {
      if (++calls === 1) return response([{ type: 'tool_use', id: 'media', name: 'read_media', input: { path: 'public.png' } }], 'tool_use');
      const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
      assert.equal(result.is_error, true); assert.match(String(result.content), /denied/);
      return response([{ type: 'text', text: 'Summary' }]);
    });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('scoped tool grants isolate invocation and parent ask prompts once per executed input', async () => {
  let calls = 0; let executed = 0; let approvals = 0;
  await fixture(async options => {
    const tool: ToolDefinition = { schema: { name: 'fixture_write', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: false, async execute() { executed++; return 'Executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    options.config.permissions = { mode: 'ask', allow: [], deny: [] };
    const result = JSON.parse(await executeSkill(skill({ allowedTools: ['fixture_write'] }), '', { ...options, requestPermission: async () => { approvals++; return { decision: 'allow' }; } }));
    assert.equal(result.text, 'Summary'); assert.equal(executed, 1); assert.equal(approvals, 1);
  }, async () => {
    if (++calls === 1) return response([{ type: 'tool_use', id: 'a', name: 'fixture_write', input: {} }], 'tool_use');
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('inline shell remains literal unless invocation metadata opts into expansion', async () => {
  await fixture(async options => {
    const marker = path.join(options.config.workspace, 'marker');
    const body = `Result !\`touch '${marker}'\``;
    assert.equal(await executeSkill(skill({ body }), '', options), body);
    assert.equal(fs.existsSync(marker), false);
    options.config.features = { tasks: true, subagents: true, skillInlineCommands: true };
    assert.equal(skillRequiresExecution(skill({ body }), options.config), true);
    await assert.rejects(executeSkill(skill({ body }), "", options), /shell access is disabled/);
    options.config.allowShell = true;
    await assert.rejects(executeSkill(skill({ body }), "", options), /explicit invocation approval/);
    options.config.permissions = { mode: "bypass", allow: [], deny: [] };
    assert.equal(await executeSkill(skill({ body }), "", options), "Result ");
    assert.equal(fs.existsSync(marker), true);
    options.config.features.skillInlineCommands = false;
    assert.equal(await executeSkill(skill({ body }), "", options), body);
    options.config.allowShell = false;
    await assert.rejects(executeSkill(skill({ body, shell: '/bin/sh' }), '', options), /shell access is disabled/);
  });
});

test('fenced shell blocks run once and skip spans they already contain', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    const defaultPermissions = options.config.permissions;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    options.config.features = { tasks: true, subagents: true, skillInlineCommands: true };
    const marker = path.join(options.config.workspace, 'marker');
    const fenced = `Before\n\`\`\`!\nprintf A\n\`\`\`\nAfter`;
    assert.equal(skillRequiresExecution(skill({ body: fenced }), options.config), true);
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: fenced }), '', options), 'Before\nA\nAfter');
    // An inline span inside a block belongs to the block and never runs twice.
    const nested = `\`\`\`!\nprintf '!\`touch ${marker}\`'\n\`\`\``;
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: nested }), '', options), `!\`touch ${marker}\``);
    assert.equal(fs.existsSync(marker), false);
    // A span without surrounding whitespace still runs, as this runtime always did.
    const attached = `Task!\`printf B\``;
    assert.equal(skillRequiresExecution(skill({ body: attached }), options.config), true);
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: attached }), '', options), 'TaskB');
    // Preflight still denies a later fenced command before the earlier one runs.
    options.config.permissions = defaultPermissions;
    const denied = `\`\`\`!\ntouch ${marker}\n\`\`\`\n\`\`\`!\necho denied\n\`\`\``;
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: denied }), '', { ...options,
      requestPermission: async (_tool, input) => ({ decision: (input as { command: string }).command === 'echo denied' ? 'deny' : 'allow' }),
    }), /permission deny/);
    assert.equal(fs.existsSync(marker), false);
  });
});

test('inline shell asks without a policy and substitutes once with bounded output', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    const definition = skill({ shell: '/bin/sh', body: 'prefix !`printf "$1"` suffix' });
    await assert.rejects(executeSkill(definition, 'fixture', options), /explicit invocation approval/);
    let approvals = 0;
    const text = await executeSkill(definition, 'fixture', { ...options, requestPermission: async () => { approvals++; return { decision: 'allow' }; } });
    assert.equal(text, 'prefix fixture suffix'); assert.equal(approvals, 1);
  });
});

test('argument and command output directives never create another shell-expansion pass', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const marker = path.join(options.config.workspace, 'marker');
    const argument = `!\`touch '${marker}'\``;
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: '$ARGUMENTS' }), argument, options), argument);
    assert.equal(fs.existsSync(marker), false);
    const text = await executeSkill(skill({ shell: '/bin/sh', body: "!`printf '$ARGUMENTS'`" }), '$1 literal', options);
    assert.equal(text, '$1 literal');
    options.config.features = { tasks: true, subagents: true, skillInlineCommands: true, skillArgumentFallback: true };
    assert.equal(await executeSkill(skill({ body: "Task !`printf fixture`" }), "; touch fallback-marker", options), "Task fixture\n\nARGUMENTS: ; touch fallback-marker");
    assert.equal(fs.existsSync(path.join(options.config.workspace, "fallback-marker")), false);
  });
});

test('inline command preflight denies later commands before executing any earlier one', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    const marker = path.join(options.config.workspace, 'marker');
    const body = `!\`touch '${marker}'\` !\`echo denied\``;
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body }), '', { ...options,
      requestPermission: async (_tool, input) => ({ decision: (input as { command: string }).command === 'echo denied' ? 'deny' : 'allow' }),
    }), /permission deny/);
    assert.equal(fs.existsSync(marker), false);
  });
});

test('inline shell output overflow, nonzero exit, timeout and cancellation terminate the command', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    options.config.maxOutputBytes = 128;
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`yes x`' }), '', options), /output byte limit/);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`exit 3`' }), '', options), /exited with 3/);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`sleep 10`' }), '', { ...options, timeoutMs: 25 }), /timed out/);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25);
    try { await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`sleep 10`' }), '', { ...options, signal: controller.signal }), /aborted/); }
    finally { clearTimeout(timer); }
  });
});

test('skill hook overlays are approved, isolated and keep parent hooks in order', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const marker = path.join(options.config.workspace, 'hooks');
    options.config.hooks = { SessionStart: [{ command: `printf parent >> '${marker}'` }] };
    const before = structuredClone(options.config.hooks);
    const definition = skill({ context: 'fork', hooks: { SessionStart: [{ command: `printf skill >> '${marker}'` }] } });
    await executeSkill(definition, '', options);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'parentskill');
    assert.deepEqual(options.config.hooks, before);
  });
});

test('synchronous skill async command hooks start in an owned registry and are reaped before session close', async () => {
  for (const providerFails of [false, true]) {
    let commandPid = 0; let checks = 0; let marker = '';
    await fixture(async options => {
      options.config.allowShell = true;
      options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
      marker = path.join(options.config.workspace, 'hook-pid');
      const definition = skill({ context: 'fork', hooks: { SessionStart: [{ command: `printf '%s' "$$" > '${marker}'; exec sleep 10`, async: true }] } });
      const invoke = executeSkill(definition, '', options);
      if (providerFails) await assert.rejects(invoke, /fixture provider failure/);
      else assert.equal(JSON.parse(await invoke).text, 'Summary');
      assert.ok(commandPid > 0);
      assert.throws(() => process.kill(commandPid, 0), (error: unknown) => (error as NodeJS.ErrnoException).code === 'ESRCH');
      const completed = listSessions(options.config.workspace)[0]!;
      assert.equal(completed.active, false);
      const events = fs.readFileSync(path.join(options.config.workspace, '.agent', `${completed.id}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
      assert.ok(events.some(event => event.kind === 'hook_start' && event.event === 'async:SessionStart'));
      assert.ok(events.some(event => event.kind === 'hook_result' && event.event === 'async:SessionStart'));
    }, async request => {
      assert.match(String(request.system), /child agent/);
      // SessionStart registers the async job before the first provider request.
      checks++;
      const deadline = Date.now() + 2000;
      while ((!fs.existsSync(marker) || !fs.readFileSync(marker, 'utf8')) && Date.now() < deadline) {
        await new Promise<void>(resolve => setTimeout(resolve, 5));
      }
      assert.ok(fs.existsSync(marker)); commandPid = Number(fs.readFileSync(marker, 'utf8')); assert.ok(commandPid > 0);
      if (providerFails) throw new Error('fixture provider failure');
      return response([{ type: 'text', text: 'Summary' }]);
    });
    assert.equal(checks, 1);
  }
});

test('skill HTTP hook overlay uses the local configured transport without shell and stays isolated', async () => {
  const payloads: Record<string, unknown>[] = [];
  const server = http.createServer((request, reply) => {
    const chunks: Buffer[] = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      payloads.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      reply.setHeader('content-type', 'application/json');
      reply.end(JSON.stringify({ additionalContext: 'HTTP skill context' }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  try {
    await fixture(async options => {
      const before = JSON.stringify(options.config);
      const result = JSON.parse(await executeSkill(skill({ hooks: { SessionStart: [{ type: 'http', url: `http://127.0.0.1:${address.port}/hook` }] } }), '', options));
      assert.equal(result.text, 'Summary'); assert.equal(payloads.length, 1);
      assert.equal(payloads[0]!.hook_event_name, 'SessionStart');
      assert.equal(JSON.stringify(options.config), before);
    }, async request => {
      assert.match(JSON.stringify(request.messages), /HTTP skill context/);
      return response([{ type: 'text', text: 'Summary' }]);
    });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('prompt and agent skill hooks use bounded provider calls without recursive hook dispatch', async () => {
  const models: string[] = []; let verdicts = 0; let tasks = 0;
  await fixture(async options => {
    const definition = skill({ hooks: { SessionStart: [
      { type: 'prompt', prompt: 'prompt-check', model: 'hook-model' },
      { type: 'agent', prompt: 'agent-check' },
    ] } });
    const result = JSON.parse(await executeSkill(definition, '', options));
    assert.equal(result.text, 'Summary'); assert.equal(verdicts, 2); assert.equal(tasks, 1);
    assert.deepEqual(models, ['hook-model', 'fixture']);
  }, async request => {
    if (String(request.system).startsWith('Evaluate the configured lifecycle hook')) {
      verdicts++; models.push(request.model);
      assert.equal(request.tools, undefined); assert.ok(request.max_tokens <= 4096);
      return response([{ type: 'text', text: JSON.stringify({ ok: true, additionalContext: 'model checked' }) }]);
    }
    tasks++; return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('background skill model hook overlay uses the registry provider and completes before task request', async () => {
  let verdicts = 0;
  await fixture(async options => {
    const registry = new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools });
    try {
      const descriptor = JSON.parse(await executeSkill(skill({ background: true, hooks: { SessionStart: [{ type: 'prompt', prompt: 'verify launch' }] } }), '', { ...options, registry }));
      const done = await registry.get(descriptor.id, { waitMs: 1000 });
      assert.equal(done.status, 'completed'); assert.equal(done.summary, 'Summary'); assert.equal(verdicts, 1);
    } finally { await registry.close(); }
  }, async request => {
    if (String(request.system).startsWith('Evaluate the configured lifecycle hook')) {
      verdicts++; return response([{ type: 'text', text: '{"ok":true}' }]);
    }
    assert.equal(verdicts, 1); return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('background skills require supplied registry and pin invocation tools and model', async () => {
  await fixture(async options => {
    const definition = skill({ context: 'fork', background: true, model: 'background-model', allowedTools: ['read_file'] });
    await assert.rejects(executeSkill(definition, '', options), /session-owned agent registry/);
    const registry = new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools });
    try {
      const descriptor = JSON.parse(await executeSkill(definition, '', { ...options, registry }));
      const done = await registry.get(descriptor.id, { waitMs: 1000 });
      assert.equal(done.status, 'completed'); assert.equal(done.model, 'background-model'); assert.equal(done.summary, 'Summary');
      assert.equal(listSessions(options.config.workspace)[0]!.active, false);
    } finally { await registry.close(); }
  }, async request => {
    assert.equal(request.model, 'background-model');
    assert.deepEqual(request.tools!.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('background fork skill seeds through trusted execution options in legacy and advanced registries', async () => {
  for (const enableAdvanced of [false, true]) {
    let calls = 0;
    const conversation: Anthropic.MessageParam[] = [
      { role: 'user', content: 'Background parent context' },
      { role: 'assistant', content: [
        { type: 'thinking', thinking: '', signature: 'bound-background' },
        { type: 'tool_use', id: 'prior', name: 'read_file', input: { path: 'already-read' } },
      ] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'prior', content: 'Stored read result' }] },
    ];
    const expected = structuredClone(conversation);
    expected[1]!.content = (expected[1]!.content as Anthropic.ContentBlockParam[]).filter(block => block.type !== 'thinking');
    await fixture(async options => {
      options.config.effort = 'medium';
      const before = structuredClone(options.config);
      const registry = new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools, enableAdvanced });
      try {
        const descriptor = JSON.parse(await executeSkill(skill({ context: 'fork', background: true, model: 'skill-model', effort: 'high', allowedTools: ['read_file'] }), 'background', { ...options, registry, conversation }));
        const done = await registry.get(descriptor.id, { waitMs: 1000 });
        assert.equal(done.status, 'completed'); assert.equal(done.model, 'skill-model'); assert.equal(done.summary, 'Summary'); assert.equal(calls, 1);
        assert.deepEqual(options.config, before);
        const session = Session.open(options.config.workspace, { id: descriptor.session_id });
        try {
          assert.deepEqual(session.messages.slice(0, expected.length), expected); assertPaired(session.messages);
          assert.equal(session.config.effort, 'high');
          assert.equal(session.events.some(event => event.kind === 'tool_start' || event.kind === 'tool_result'), false);
        } finally { session.close(); }
        const fresh = JSON.parse(await executeSkill(skill({ background: true, model: 'skill-model', effort: 'high', allowedTools: ['read_file'] }), 'fresh', { ...options, registry, conversation }));
        assert.equal((await registry.get(fresh.id, { waitMs: 1000 })).status, 'completed'); assert.equal(calls, 2);
      } finally { await registry.close(); }
    }, async request => {
      calls++; assert.equal(request.model, 'skill-model'); assert.equal(request.output_config?.effort, 'high');
      assert.deepEqual(request.tools!.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
      if (calls === 1) {
        assert.deepEqual(request.messages.slice(0, expected.length), expected);
        assert.equal(request.messages.at(-1)!.content, 'Task background');
      } else assert.deepEqual(request.messages, [{ role: 'user', content: 'Task fresh' }]);
      assertPaired(request.messages); return response([{ type: 'text', text: 'Summary' }]);
    });
  }
});

test('background command grants are enforced by registry beforeTool without altering executor provenance', async () => {
  let calls = 0; let executed = 0;
  await fixture(async options => {
    const tool: ToolDefinition = { schema: { name: 'run_command', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: false, async execute() { executed++; return 'Executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }]; options.config.allowShell = true;
    const registry = new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools });
    try {
      const descriptor = JSON.parse(await executeSkill(skill({ background: true, allowedTools: ['Bash(echo *)'] }), '', { ...options, registry }));
      const done = await registry.get(descriptor.id, { waitMs: 1000 });
      assert.equal(done.status, 'completed'); assert.equal(executed, 0);
    } finally { await registry.close(); }
  }, async request => {
    if (++calls === 1) return response([{ type: 'tool_use', id: 'a', name: 'run_command', input: { command: 'touch forbidden' } }], 'tool_use');
    const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
    assert.equal(result.is_error, true); assert.match(String(result.content), /outside allowed-tools/);
    return response([{ type: 'text', text: 'Summary' }]);
  });
});
