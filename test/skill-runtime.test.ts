import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { loadProjectConfig, type SkillInfo } from '../src/config.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { executeSkill as executeSkillProduction, skillRequiresExecution, skillToolApproval, SkillCommandOwner, type SkillExecutionOptions } from '../src/skill-runtime.js';
import { issueHumanSkillAuthorization } from '../src/notification-authorization.js';
import { activateTouchedSkills, discoverTouchedSkills } from '../src/skill-catalog.js';
import { buildSystem, createRuntime, createSkillTool } from '../src/runtime.js';
import { SkillEffectJournal } from '../src/skill-effects.js';
import { pinSkillResult, skillResultsDirectory } from '../src/skill-output-source.js';
import { Session } from '../src/session.js';
import { readSkillScope, readSkillScopeWitness } from '../src/skill-scope.js';
import { listSessions } from '../src/sessions.js';
import { createTools, type ToolDefinition } from '../src/tools.js';
import { directoryWriteInputSchema } from '../src/directory-publication-authorization.js';
import '../src/plugin-chain-registry.js';
import { clearChainRecords } from '../src/plugin-chain-host.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';

function skill(overrides: Partial<SkillInfo> = {}): SkillInfo {
  return { name: 'fixture', path: '/fixture/SKILL.md', description: 'Fixture', body: 'Task $ARGUMENTS', userInvocable: true, disableModelInvocation: false, ...overrides };
}

async function executeSkill(item: SkillInfo, args: string, options: SkillExecutionOptions): Promise<string> {
  if (options.source !== 'user') return executeSkillProduction(item, args, options);
  const existing = options.session?.();
  if (existing) return executeSkillProduction(item, args, { ...options,
    humanAuthorization: issueHumanSkillAuthorization(existing, item.name, args, options.signal, () => existing.isOpen) });
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'skill-authority-')));
  const session = Session.open(dir, { config: { ...options.config, workspace: dir } });
  try {
    const authorization = issueHumanSkillAuthorization(session, item.name, args, options.signal, () => session.isOpen);
    return await executeSkillProduction(item, args, { ...options, session: () => session, humanAuthorization: authorization });
  } finally { session.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}

test('skill shell pins the approved HOME after startup files', async () => {
  if (!fs.existsSync('/bin/bash')) return;
  await fixture(async options => {
    const approved = fs.mkdtempSync(path.join(options.config.workspace, 'home-approved-'));
    const changed = fs.mkdtempSync(path.join(options.config.workspace, 'home-changed-'));
    const startup = path.join(approved, 'startup.sh');
    fs.writeFileSync(startup, `export HOME='${changed}'\n`);
    const previous = { HOME: process.env.HOME, BASH_ENV: process.env.BASH_ENV };
    process.env.HOME = approved; process.env.BASH_ENV = startup;
    try {
      const item = skill({ shell: '/bin/bash', body: '!`printf "%s" "$HOME"`' });
      options.config.skills = [item];
      options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
      assert.equal(await executeSkill(item, '', options), approved);
    } finally {
      if (previous.HOME === undefined) delete process.env.HOME; else process.env.HOME = previous.HOME;
      if (previous.BASH_ENV === undefined) delete process.env.BASH_ENV; else process.env.BASH_ENV = previous.BASH_ENV;
    }
  });
});

test('model skill recovery commits only a durable final warning', async () => {
  for (const scenario of ['delivery', 'replacement', 'write-failure'] as const) {
    await fixture(async options => {
      const root = options.config.workspace;
      const journal = new SkillEffectJournal(root, 'model-fixture');
      const old = journal.start('fixture', 0, 'previous'); journal.abandon(old);
      const item = skill({ shell: '/bin/sh', body: '!`printf retried > retry-marker`' });
      options.config.skills = [item];
      options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
      const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
        { ...options, signal: context.signal, source: 'model', effectJournal: journal }));
      options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      const session = Session.open(root, { config: options.config });
      let unload: (() => void) | undefined;
      clearChainRecords();
      try {
        if (scenario === 'replacement') {
          const modulePath = path.join(root, 'replace.mjs');
          fs.writeFileSync(modulePath, `export default {name:'fixture',tier:'user',patterns:[{pattern:'classic.PostToolUseFailure'}],handlers:{'classic.PostToolUseFailure':async()=>({updatedToolOutput:'replaced'})}};`);
          unload = (await loadChainModuleFileInto(createChainRun(), { pluginName: 'fixture', modulePath })).unload;
        }
        if (scenario === 'write-failure') {
          const append = session.append.bind(session);
          session.append = event => {
            if (event.kind === 'message' && event.classifier?.origin.kind === 'generated' && event.classifier.origin.source === 'tool-results') throw new Error('fixture session write failure');
            append(event);
          };
        }
        let calls = 0;
        const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
          ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
          : response([{ type: 'text', text: 'done' }]) };
        if (scenario === 'write-failure') await assert.rejects(new Agent(session, provider, [tool]).run('invoke'), /fixture session write failure/);
        else await new Agent(session, provider, [tool]).run('invoke');
        assert.equal(fs.existsSync(path.join(root, 'retry-marker')), false);
        assert.equal(journal.unresolved('fixture').length, 1, scenario);
        if (scenario === 'delivery') {
          assert.match(JSON.stringify(session.messages), /effect is unknown/);
          await assert.rejects(executeSkill(item, '', { ...options, effectJournal: journal }), /effect is unknown/);
          assert.equal(fs.existsSync(path.join(root, 'retry-marker')), false);
        }
      } finally { unload?.(); clearChainRecords(); session.close(); }
    });
  }
});
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

test('human skill capability is consumed once and fenced by input, signal and runtime lease', async () => {
  await fixture(async options => {
    const item = skill({ disableModelInvocation: true });
    options.config.skills = [item];
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const session = Session.open(options.config.workspace, { config: options.config });
    let reopened: Session | undefined;
    try {
      await runtime.bindSession!(session);
      const signal = new AbortController().signal;
      const grant = () => issueHumanSkillAuthorization(session, item.name, 'abc', signal, runtime.sessionLease!(session));
      const invoke = (token: object, args = 'abc', useSignal = signal, owner = session) => runtime.runSkill!(owner.config, owner.id,
        item, args, useSignal, undefined, owner.messages, owner, 'user', token);
      const valid = grant();
      assert.equal(await invoke(valid), 'Task abc');
      await assert.rejects(invoke(valid), /authorization invalid/);
      const changed = grant();
      await assert.rejects(invoke(changed, 'changed'), /authorization invalid/);
      await assert.rejects(invoke(changed), /authorization invalid/);
      const aborted = new AbortController();
      const cancelled = issueHumanSkillAuthorization(session, item.name, 'abc', aborted.signal, runtime.sessionLease!(session));
      aborted.abort();
      await assert.rejects(invoke(cancelled, 'abc', aborted.signal), /authorization invalid/);
      const old = grant();
      await runtime.releaseSession!(session.id);
      session.close();
      reopened = Session.open(options.config.workspace, { id: session.id });
      await runtime.bindSession!(reopened);
      await assert.rejects(invoke(old, 'abc', signal, reopened), /authorization invalid/);
      const tool = createSkillTool(reopened.config, (selected, args, context) => runtime.runSkill!(reopened!.config,
        reopened!.id, selected, args, context.signal, undefined, context.conversation, context.session, 'model'));
      reopened.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      let calls = 0;
      const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
        ? response([{ type: 'tool_use', id: 'forged', name: 'skill', input: { name: item.name, args: 'abc', source: 'user', humanAuthorization: {} } }], 'tool_use')
        : response([{ type: 'text', text: 'done' }]) };
      await new Agent(reopened, provider, [tool]).run('invoke');
      assert.match(JSON.stringify(reopened.messages), /unrecognized_keys/);
    } finally { await runtime.close(); session.close(); reopened?.close(); }
  });
});

test('real Agent cannot consume a human retry and concurrent direct invocations execute it once', async () => {
  await fixture(async options => {
    const command = 'printf x >> retry-marker; sleep 0.1';
    const item = skill({ shell: '/bin/sh', body: `!\`${command}\`` });
    options.config.skills = [item];
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const session = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(session);
      const journal = new SkillEffectJournal(options.config.workspace, session.id);
      const old = journal.start(item.name, 0, command); journal.abandon(old);
      fs.writeFileSync(path.join(options.config.workspace, 'retry-marker'), 'x');
      assert.throws(() => session.confirmSkillEffect('wrong-owner', old.id, 'retry'), /owner mismatch/);
      session.confirmSkillEffect(session.id, old.id, 'retry');
      const tool = createSkillTool(session.config, (selected, args, context) => runtime.runSkill!(session.config,
        session.id, selected, args, context.signal, undefined, context.conversation, context.session, 'model'));
      session.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      let calls = 0;
      const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
        ? response([{ type: 'tool_use', id: 'forged-retry', name: 'skill', input: { name: item.name, source: 'user', humanAuthorization: {} } }], 'tool_use')
        : response([{ type: 'text', text: 'done' }]) };
      await new Agent(session, provider, [tool]).run('invoke');
      assert.match(JSON.stringify(session.messages), /unrecognized_keys/);
      assert.equal(fs.existsSync(`${journal.file}.${old.id}.retry-consumed`), false);
      const signal = new AbortController().signal;
      const changed = { ...item, body: '!`printf y >> retry-marker`' };
      await assert.rejects(runtime.runSkill!(session.config, session.id, changed, '', signal, undefined, session.messages,
        session, 'user', issueHumanSkillAuthorization(session, changed.name, '', signal, runtime.sessionLease!(session))), /effect is unknown/);
      assert.equal(fs.existsSync(`${journal.file}.${old.id}.retry-consumed`), false);
      const invoke = () => runtime.runSkill!(session.config, session.id, item, '', signal, undefined, session.messages,
        session, 'user', issueHumanSkillAuthorization(session, item.name, '', signal, runtime.sessionLease!(session)));
      const results = await Promise.allSettled([invoke(), invoke()]);
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      assert.equal(results.filter(result => result.status === 'rejected').length, 1);
      assert.equal(fs.readFileSync(path.join(options.config.workspace, 'retry-marker'), 'utf8'), 'xx');
      assert.deepEqual(journal.unresolved(item.name).map(record => record.id), [old.id]);
    } finally { await runtime.close(); session.close(); }
  });
});

test('retry authority does not follow a same-ID Session rebind', async () => {
  await fixture(async options => {
    const command = 'printf x >> retry-rebind-marker';
    const item = skill({ shell: '/bin/sh', body: `!\`${command}\`` });
    options.config.skills = [item]; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const session = Session.open(options.config.workspace, { config: options.config });
    let reopened: Session | undefined;
    try {
      await runtime.bindSession!(session);
      const journal = new SkillEffectJournal(options.config.workspace, session.id);
      const old = journal.start(item.name, 0, command); journal.abandon(old);
      session.confirmSkillEffect(session.id, old.id, 'retry');
      const signal = new AbortController().signal;
      const token = issueHumanSkillAuthorization(session, item.name, '', signal, runtime.sessionLease!(session));
      await runtime.releaseSession!(session.id); session.close();
      reopened = Session.open(options.config.workspace, { id: session.id });
      await runtime.bindSession!(reopened);
      await assert.rejects(runtime.runSkill!(reopened.config, reopened.id, item, '', signal, undefined, reopened.messages,
        reopened, 'user', token), /authorization invalid/);
      const next = issueHumanSkillAuthorization(reopened, item.name, '', signal, runtime.sessionLease!(reopened));
      await assert.rejects(runtime.runSkill!(reopened.config, reopened.id, item, '', signal, undefined, reopened.messages,
        reopened, 'user', next), /effect is unknown/);
      assert.equal(fs.existsSync(`${journal.file}.${old.id}.retry-consumed`), false);
      assert.equal(fs.existsSync(path.join(options.config.workspace, 'retry-rebind-marker')), false);
    } finally { await runtime.close(); session.close(); reopened?.close(); }
  });
});

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
    const parent = Session.open(options.config.workspace, { config: options.config });
    options.parentSessionId = parent.id;
    options.session = () => parent;
    try {
    const before = JSON.stringify(options.config);
    const result = JSON.parse(await executeSkill(skill({ context: 'fork', model: 'child-model', allowedTools: ['read_file'] }), 'inspect', options));
    assert.equal(result.text, 'Summary'); assert.equal(result.reason, 'end_turn'); assert.equal(result.model_calls, 1);
    assert.equal(request!.model, 'child-model');
    assert.deepEqual(request!.tools!.map(tool => 'name' in tool ? tool.name : ''), ['read_file']);
    assert.deepEqual(request!.messages[0], { role: 'user', content: 'Task inspect' });
    assert.equal(JSON.stringify(options.config), before);
    const reopened = Session.open(options.config.workspace, { id: result.session_id });
    try { assert.equal(reopened.config.parentSessionId, parent.id); }
    finally { reopened.close(); }
    } finally { parent.close(); }
  }, async value => { request = value; return response([{ type: 'text', text: 'Summary' }]); });
});

test('a background skill beyond the spawn limit runs its foreground fork under the immediate parent', async () => {
  await fixture(async options => {
    const previous = process.env.LITCODE_MAX_SUBAGENT_SPAWN_DEPTH;
    process.env.LITCODE_MAX_SUBAGENT_SPAWN_DEPTH = '2';
    const parent = Session.open(options.config.workspace, {config:{...options.config, childMode:'general', spawnDepth:2}});
    try {
      const registry = new AgentRegistry({source:parent.config, tools:options.tools, provider:options.provider});
      try {
        await assert.rejects(registry.launch({prompt:'another agent'}), /nesting limit reached \(depth 2 of 2\)/);
      } finally { await registry.close(); }
      const result = JSON.parse(await executeSkill(skill({context:'fork', background:true}), '',
        {...options, config:parent.config, session:() => parent}));
      const fork = Session.open(parent.config.workspace, {id:result.session_id});
      try {
        assert.equal(fork.config.spawnDepth, 3);
        assert.equal(fork.config.parentSessionId, parent.id);
        assert.equal(result.text, 'Summary');
      } finally { await fork.close(); }
    } finally {
      await parent.close();
      if (previous === undefined) delete process.env.LITCODE_MAX_SUBAGENT_SPAWN_DEPTH;
      else process.env.LITCODE_MAX_SUBAGENT_SPAWN_DEPTH = previous;
    }
  });
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
    assert.equal(calls, 3);
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

test('real fork skill agent consumes a scoped file declaration', { skip: process.env.RUN_W385_SKILL_LAYERS_RED !== '1' }, async () => {
  let calls = 0; let target = ''; let result = '';
  await fixture(async options => {
    target = path.join(options.config.workspace, 'allowed.txt');
    fs.writeFileSync(target, 'SCOPED_FILE_CONTENT');
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    await executeSkill(skill({ context: 'fork', allowedTools: [`read_file(//${target.slice(1)})`] }), '', options);
    assert.match(result, /SCOPED_FILE_CONTENT/);
  }, async request => {
    if (++calls === 1) return response([{ type: 'tool_use', id: 'file', name: 'read_file', input: { path: target } }], 'tool_use');
    result = JSON.stringify(request.messages.at(-1)?.content);
    return response([{ type: 'text', text: 'done' }]);
  });
});

test('fork skill applies scoped file rules inside the workspace and retains parent denial', async () => {
  let calls = 0; let results = '';
  await fixture(async options => {
    fs.writeFileSync(path.join(options.config.workspace, 'allowed.txt'), 'SCOPED_FILE_CONTENT');
    fs.writeFileSync(path.join(options.config.workspace, 'denied.txt'), 'DENIED_FILE_CONTENT');
    options.config.permissions = { mode: 'bypass', allow: [], deny: ['Read(./denied.txt)'], ruleWorkspace: options.config.workspace };
    await executeSkill(skill({ context: 'fork', allowedTools: ['Read(./allowed.txt)', 'Read(./denied.txt)'] }), '', options);
    assert.match(results, /SCOPED_FILE_CONTENT/);
    assert.doesNotMatch(results, /DENIED_FILE_CONTENT/);
    assert.match(results, /denied/i);
  }, async request => {
    if (++calls === 1) return response([
      { type: 'tool_use', id: 'allowed', name: 'read_file', input: { path: 'allowed.txt' } },
      { type: 'tool_use', id: 'denied', name: 'read_file', input: { path: 'denied.txt' } },
      { type: 'tool_use', id: 'other', name: 'read_file', input: { path: 'other.txt' } },
    ], 'tool_use');
    results = JSON.stringify(request.messages.at(-1)?.content);
    assert.match(results, /outside allowed-tools/);
    return response([{ type: 'text', text: 'done' }]);
  });
});

test('loaded fork skill grants expand workspace and skill directories for actual child calls', async () => {
  let calls = 0; const executed: string[] = []; let commands: string[] = [];
  await fixture(async options => {
    const root = options.config.workspace;
    const dir = path.join(root, '.harness', 'skills', 'grant');
    commands = [`printf ${root}/a b,c`, `printf ${dir}/x y`];
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\ncontext: fork\nallowed-tools: "Bash(printf ${CLAUDE_PROJECT_DIR}/a b,c), Bash(printf ${CLAUDE_SKILL_DIR}/x y)"\n---\nInstructions');
    const loaded = loadProjectConfig(root, { userDir: path.join(root, 'user') }).skills[0]!;
    const tool: ToolDefinition = { schema: { name: 'run_command', description: 'Fixture', input_schema: { type: 'object' } }, readOnly: false,
      async execute(input) { executed.push(String((input as { command: string }).command)); return 'executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    await executeSkill(loaded, '', options);
    assert.deepEqual(executed, commands);
  }, async request => {
    if (++calls === 1) {
      return response(commands.map((command, index) => ({ type: 'tool_use' as const, id: `grant-${index}`, name: 'run_command', input: { command } })), 'tool_use');
    }
    assert.ok((request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[]).every(result => !result.is_error));
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('block-output skill tools enforce parent path deny and skill grants before any file reads', async () => {
  for (const policy of ['parent-deny', 'skill-deny', 'allow'] as const) {
    let calls = 0; let reads = 0; let plainCalls = 0;
    await fixture(async options => {
      options.config.allowShell = false;
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
    const result = JSON.parse(await executeSkill(skill({ context: 'fork', allowedTools: ['fixture_write'] }), '', { ...options, requestPermission: async () => { approvals++; return { decision: 'allow' }; } }));
    assert.equal(result.text, 'Summary'); assert.equal(executed, 1); assert.equal(approvals, 1);
  }, async () => {
    if (++calls === 1) return response([{ type: 'tool_use', id: 'a', name: 'fixture_write', input: {} }], 'tool_use');
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('skill approval uses the child plan family and preserves live deny and ask', async () => {
  await fixture(async options => {
    options.config.plansDirectory = 'plans';
    options.config.features = { tasks: false, subagents: true, sourcePlanTools: true };
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: [] };
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      parent.planMode!.enter();
      const write = options.tools.find(tool => tool.schema.name === 'write_file'); assert.ok(write);
      let prompts = 0;
      const approve = skillToolApproval(() => skill({ allowedTools: ['write_file'] }), { ...options, config: parent.config,
        requestPermission: async () => { prompts++; return { decision: 'deny' }; } });
      const owner = { directory: parent.planOwnership.directory, slug: 'child-owner' };
      const input = { path: path.join(owner.directory, `${owner.slug}-agent-other.md`), content: 'fixture' };
      await approve(write, input, options.signal, options.config.workspace, owner);
      parent.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'ask', destination: 'session' }]);
      await assert.rejects(approve(write, input, options.signal, options.config.workspace, owner), /permission deny/i);
      assert.equal(prompts, 1);
      parent.adoptPermissionUpdates([{ type: 'removeRules', rules: [{ toolName: 'write_file' }], behavior: 'ask', destination: 'session' },
        { type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' }]);
      await assert.rejects(approve(write, input, options.signal, options.config.workspace, owner), /denied/i);
      assert.equal(prompts, 1);
    } finally { parent.close(); }
  });
});

test('foreground fork skill rejects a parsed Write redirect after approval', async () => {
  let calls = 0, prompts = 0, result = '';
  await fixture(async options => {
    const parse = directoryWriteInputSchema.parse;
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: ['write_file'] };
    try {
      await executeSkill(skill({ context: 'fork', allowedTools: ['write_file'] }), '', { ...options,
        requestPermission: async () => {
          prompts++;
          directoryWriteInputSchema.parse = (...args) => ({ ...parse(...args), path: 'redirected' });
          return { decision: 'allow' };
        },
      });
    } finally { directoryWriteInputSchema.parse = parse; }
    assert.equal(prompts, 1);
    assert.equal(fs.existsSync(path.join(options.config.workspace, 'redirected')), false);
    assert.equal(fs.existsSync(path.join(options.config.workspace, 'approved')), false);
    assert.match(result, /input changed after permission checking/i);
  }, async request => {
    if (++calls === 1) return response([{ type: 'tool_use', id: 'write', name: 'write_file', input: { path: 'approved', content: 'value' } }], 'tool_use');
    result = JSON.stringify(request.messages.at(-1)?.content);
    return response([{ type: 'text', text: 'done' }]);
  });
});

test('real fork skill agent writes plan family and intersects parent and scoped permissions', async () => {
  for (const scenario of ['allow', 'deny', 'ask', 'scoped-deny', 'ask-scoped-deny'] as const) {
    let calls = 0; let target = ''; let resultError: boolean | undefined; let prompts = 0;
    await fixture(async options => {
      options.config.plansDirectory = 'plans';
      options.config.features = { tasks: false, subagents: true, sourcePlanTools: true };
      options.config.permissions = { mode: 'default', allow: [], deny: [], ask: [] };
      const parent = Session.open(options.config.workspace, { config: options.config });
      try {
        parent.planMode!.enter();
        target = path.join(parent.planOwnership.directory, `${parent.planOwnership.slug}-agent-sibling.md`);
        const behavior = scenario === 'deny' ? 'deny' : scenario === 'ask' || scenario === 'ask-scoped-deny' ? 'ask' : undefined;
        if (behavior) parent.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior, destination: 'session' }]);
        await executeSkill(skill({ context: 'fork', allowedTools: ['write_file'],
          ...(scenario.endsWith('scoped-deny') ? { disallowedTools: ['write_file'] } : {}) }), '', {
          ...options, config: parent.config, parentSessionId: parent.id, parentPlanId: parent.planId,
          requestPermission: async () => { prompts++; return { decision: 'deny' }; },
        });
        assert.equal(fs.existsSync(target), scenario === 'allow', scenario);
        if (scenario === 'allow') assert.equal(fs.readFileSync(target, 'utf8'), 'SKILL FAMILY');
        assert.equal(Boolean(resultError), scenario !== 'allow', scenario);
        assert.equal(prompts, scenario === 'ask' ? 1 : 0, scenario);
      } finally { parent.close(); }
    }, async request => {
      if (++calls === 1) return response([{ type: 'tool_use', id: 'family', name: 'write_file', input: { path: target, content: 'SKILL FAMILY' } }], 'tool_use');
      resultError = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!.is_error;
      return response([{ type: 'text', text: 'Summary' }]);
    });
  }
});

test('inline shell remains literal unless invocation metadata opts into expansion', async () => {
  await fixture(async options => {
    const marker = path.join(options.config.workspace, 'marker');
    const body = `Result !\`touch '${marker}'\``;
    assert.equal(await executeSkill(skill({ body }), '', options), body);
    assert.equal(fs.existsSync(marker), false);
    options.config.features = { tasks: true, subagents: true, skillInlineCommands: true };
    options.config.allowShell = false;
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

test('fenced shell blocks retain overlapping inline commands', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    const defaultPermissions = options.config.permissions;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    options.config.features = { tasks: true, subagents: true, skillInlineCommands: true };
    const marker = path.join(options.config.workspace, 'marker');
    const fenced = `Before\n\`\`\`!\nprintf A\n\`\`\`\nAfter`;
    assert.equal(skillRequiresExecution(skill({ body: fenced }), options.config), true);
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: fenced }), '', options), 'Before\nA\nAfter');
    // Both matches are approved and executed even after the block is replaced.
    const nested = `\`\`\`!\nprintf ' !\`touch ${marker}\`'\n\`\`\``;
    options.config.permissions = { mode: 'ask', allow: [], deny: [] };
    const approvals: string[] = [];
    const nestedResult = await executeSkill(skill({ shell: '/bin/sh', body: nested }), '', { ...options,
      requestPermission: async (_tool, input) => { approvals.push((input as { command: string }).command); return { decision: 'allow' }; },
    });
    assert.ok(nestedResult === ' ' || nestedResult === "```!\nprintf ' '\n```", nestedResult);
    assert.deepEqual(approvals, [`printf ' !\`touch ${marker}\`'`, `touch ${marker}`]);
    assert.equal(fs.existsSync(marker), true);
    fs.unlinkSync(marker);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: nested }), '', { ...options,
      requestPermission: async (_tool, input) => ({ decision: (input as { command: string }).command.startsWith('touch ') ? 'deny' : 'allow' }),
    }), /permission deny/);
    assert.equal(fs.existsSync(marker), false);
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const attached = `Task!\`printf B\``;
    assert.equal(skillRequiresExecution(skill({ body: attached }), options.config), false);
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: attached }), '', options), attached);
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

test('inline shell maps stdout and stderr as a Shell result', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const body = "before !`printf '  err  \\n' >&2; printf '\\n  out  \\n'` after";
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body }), '', options), 'before   err  \n\n  out after');
  });
});

test('skill approval rechecks a deny installed while the prompt is open', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: ['Bash'] };
    const tool = options.tools.find(item => item.schema.name === 'run_command')!;
    const approve = skillToolApproval(() => skill(), {
      ...options, requestPermission: async () => {
        options.config.permissions!.deny = ['Bash'];
        return { decision: 'allow' };
      },
    });
    await assert.rejects(approve(tool, { command: 'echo fixture' }, options.signal, options.config.workspace), /denied/i);
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

test('inline command denial and cancellation preserve independently owned siblings', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    const marker = path.join(options.config.workspace, 'marker');
    const body = `!\`touch '${marker}'\` !\`echo denied\``;
    const commandOwner = new SkillCommandOwner();
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body }), '', { ...options,
      commandOwner,
      requestPermission: async (_tool, input) => ({ decision: (input as { command: string }).command === 'echo denied' ? 'deny' : 'allow' }),
    }), /permission deny/);
    await commandOwner.drain();
    assert.equal(fs.existsSync(marker), true);
    fs.unlinkSync(marker);

    const controller = new AbortController();
    const journal = new SkillEffectJournal(options.config.workspace, 'preflight-cancel');
    let approvals = 0;
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body }), '', { ...options,
      signal: controller.signal, effectJournal: journal,
      requestPermission: async () => {
        if (++approvals === 2) controller.abort();
        return { decision: 'allow' };
      },
    }));
    assert.equal(approvals, 2);
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(journal.file), false);

    options.config.permissions = { mode: 'default', allow: [], deny: ['Bash(printf:*)'] };
    const wrapped = `!\`touch '${marker}'\` !\`env CUSTOM=value printf denied\``;
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: wrapped }), '', { ...options, commandOwner }), /denied/i);
    await commandOwner.drain();
    await commandOwner.close();
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: '!\`env CUSTOM=value echo allowed\`' }), '', options), 'allowed');
  });
});

test('empty authored shell directives stay literal and require no approval', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    options.config.permissions = { mode: 'ask', allow: [], deny: [] };
    const body = 'empty !`   `\n```!\n   \n```\nvalid !`printf yes`';
    let approvals = 0;
    const result = await executeSkill(skill({ shell: '/bin/sh', body }), '', {
      ...options, requestPermission: async () => { approvals++; return { decision: 'allow' }; },
    });
    assert.equal(result, 'empty !`   `\n```!\n   \n```\nvalid yes');
    assert.equal(approvals, 1);
  });
});

test('ordinary inline code does not execute embedded skill commands', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    options.config.permissions = { mode: 'ask', allow: [], deny: [] };
    const marker = path.join(options.config.workspace, 'code-marker');
    const body = `Example \`sample !\`touch ${marker}\`\` and !\`printf yes\``;
    let approvals = 0;
    const result = await executeSkill(skill({ shell: '/bin/sh', body }), '', {
      ...options, requestPermission: async () => { approvals++; return { decision: 'allow' }; },
    });
    assert.equal(result, `Example \`sample !\`touch ${marker}\`\` and yes`);
    assert.equal(approvals, 1);
    assert.equal(fs.existsSync(marker), false);
  });
});

test('inline shell requires a whitespace or line-start boundary', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    options.config.permissions = { mode: 'ask', allow: [], deny: [] };
    const marker = path.join(options.config.workspace, 'midword-marker');
    const body = `value=!\`touch ${marker}\`\n!\`printf yes\``;
    let approvals = 0;
    const result = await executeSkill(skill({ shell: '/bin/sh', body }), '', {
      ...options, requestPermission: async () => { approvals++; return { decision: 'allow' }; },
    });
    assert.equal(result, `value=!\`touch ${marker}\`\nyes`);
    assert.equal(approvals, 1);
    assert.equal(fs.existsSync(marker), false);
  });
});

test('inline shell binds the HOME observed during each approval', async () => {
  await fixture(async options => {
    const previous = process.env.HOME;
    try {
      process.env.HOME = '/allowed-fixture';
      options.config.allowShell = true;
      options.config.permissions = { mode: 'bypass', allow: [], deny: ['Bash(printf /denied-fixture)'], ask: ['Bash(true)'] };
      const definition = skill({ shell: '/bin/sh',
        body: '!`X=old; X=new export Y; printf "$HOME" > marker.txt` !`true`' });
      await executeSkill(definition, '', { ...options, requestPermission: async () => {
        process.env.HOME = '/denied-fixture';
        return { decision: 'allow' };
      } });
      assert.equal(fs.readFileSync(path.join(options.config.workspace, 'marker.txt'), 'utf8'), '/allowed-fixture');
      const first = '!`true`';
      const next = '!`X=old; X=new export Y; printf "$HOME" > second.txt`';
      process.env.HOME = '/allowed-fixture';
      await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: `${first} ${next}` }), '', {
        ...options, requestPermission: async () => {
          process.env.HOME = '/denied-fixture';
          return { decision: 'allow' };
        },
      }), /denied/i);
      assert.equal(fs.existsSync(path.join(options.config.workspace, 'second.txt')), false);
      delete process.env.HOME;
      const absent = '!`X=old; X=new export Y; printf "%s" "$HOME" > absent.txt` !`true`';
      await executeSkill(skill({ shell: '/bin/sh', body: absent }), '', { ...options, requestPermission: async () => {
        process.env.HOME = '/later-fixture';
        return { decision: 'allow' };
      } });
      assert.equal(fs.readFileSync(path.join(options.config.workspace, 'absent.txt'), 'utf8'), '');
    } finally {
      if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
    }
  });
});

test('inline shell uses its configured HOME for both permission and execution', async () => {
  if (!fs.existsSync('/bin/zsh') || !fs.existsSync('/bin/bash')) return;
  await fixture(async options => {
    const previous = process.env.HOME;
    delete process.env.HOME;
    try {
      options.config.allowShell = true;
      options.config.permissions = { mode: 'bypass', allow: [], deny: [`Bash(printf ${os.homedir()})`] };
      const body = '!`X=old; X=new export Y; printf "$HOME" > marker.txt`';
      await assert.rejects(executeSkill(skill({ shell: '/bin/zsh', body }), '', options), /denied/i);
      assert.equal(fs.existsSync(path.join(options.config.workspace, 'marker.txt')), false);
      await executeSkill(skill({ shell: '/bin/sh', body }), '', options);
      assert.equal(fs.readFileSync(path.join(options.config.workspace, 'marker.txt'), 'utf8'), '');
      fs.unlinkSync(path.join(options.config.workspace, 'marker.txt'));
      options.config.permissions.deny = ['Bash(printf *)'];
      await assert.rejects(executeSkill(skill({ shell: '/bin/bash', body }), '', options), /denied/i);
      assert.equal(fs.existsSync(path.join(options.config.workspace, 'marker.txt')), false);
      process.env.HOME = '';
      options.config.permissions.deny = [`Bash(printf ${os.userInfo().homedir})`];
      await executeSkill(skill({ shell: '/bin/zsh', body }), '', options);
      assert.equal(fs.readFileSync(path.join(options.config.workspace, 'marker.txt'), 'utf8'), '');
    } finally {
      if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
    }
  });
});

test('inline commands journal a started and a terminal record around every effect', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(options.config.workspace, 'journal-session');
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body: '!`printf A` !`printf B`' }), '', { ...options, effectJournal: journal }), 'A B');
    const records = fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as { phase: string; index: number });
    for (const index of [0, 1]) {
      assert.deepEqual(records.filter(record => record.index === index).map(record => record.phase), ['started', 'finished']);
    }
    assert.equal(fs.readFileSync(journal.file, 'utf8').includes('printf'), false, 'commands are identified by digest only');
    assert.deepEqual(journal.unresolved('fixture'), []);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`exit 3`' }), '', { ...options, effectJournal: journal }), /Shell command failed for pattern/);
    const failed = fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as { phase: string });
    assert.deepEqual(failed.map(record => record.phase).slice(-2), ['started', 'failed']);
    assert.deepEqual(journal.unresolved('fixture'), []);
  });
});

test('real Agent runs configured shells with shared output, classification and permission', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    const shells = ['/bin/sh', '/bin/bash', '/bin/zsh', '/bin/dash', '/bin/ksh', '/bin/tcsh', '/bin/csh']
      .filter(shell => fs.existsSync(shell) && spawnSync(shell, ['-c', '/usr/bin/true']).status === 0);
    assert.ok(shells.includes('/bin/sh'));
    const outputCommand = `/usr/bin/perl -e 'syswrite STDOUT,"O1\\n";syswrite STDERR,"E1\\n";syswrite STDOUT,"O2\\n"'`;
    for (const [index, shell] of shells.entries()) {
      for (const [command, expected, denied] of [
        [outputCommand, 'O1\\nE1\\nO2', false],
        ['grep z /dev/null', '', false],
        ['/usr/bin/false', 'Shell command failed for pattern', false],
        ['/usr/bin/printenv HOME', process.env.HOME ?? '', false],
        ['touch deny-marker', 'denied', true],
      ] as const) {
        options.config.permissions = { mode: 'bypass', allow: [], deny: denied ? ['Bash(touch *)'] : [] };
        const journal = new SkillEffectJournal(root, `shell-matrix-${index}`);
        const owner = new SkillCommandOwner();
        const item = skill({ shell, body: `!\`${command}\`` });
        options.config.skills = [item];
        const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
          { ...options, signal: context.signal, source: 'model', commandOwner: owner, effectJournal: journal }));
        options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
        const session = Session.open(root, { config: options.config });
        let calls = 0;
        const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
          ? response([{ type: 'tool_use', id: 'shell-matrix', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
          : response([{ type: 'text', text: 'done' }]) };
        try {
          await new Agent(session, provider, [tool]).run('invoke');
          const messages = JSON.stringify(session.messages);
          assert.ok(messages.includes(expected), `${shell}: ${command}: ${messages}`);
          if (command.includes('grep')) assert.doesNotMatch(messages, /Shell command failed for pattern/);
          assert.equal(fs.existsSync(path.join(root, 'deny-marker')), false);
          assert.equal(fs.existsSync(path.join(root, '1')), false);
        } finally { await owner.close(); session.close(); }
      }
    }
  });
});

test('real Agent observes missing and non-executable shells alongside shell exits', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const denied = path.join(root, 'non-executable-shell');
    fs.writeFileSync(denied, '#!/bin/sh\nexit 0\n', { mode: 0o600 });
    const cases = [
      [path.join(root, 'missing-shell'), 'touch absent-marker', false],
      [denied, 'touch denied-marker', false],
      ['/bin/sh', 'touch exit126-marker; exit 126', true],
      ['/bin/sh', 'touch exit127-marker; exit 127', true],
    ] as const;
    for (const [index, [shell, command, executes]] of cases.entries()) {
      const journal = new SkillEffectJournal(root, `shell-start-${index}`);
      const owner = new SkillCommandOwner();
      options.config.skills = [skill({ shell, body: `!\`${command}\`` })];
      const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
        { ...options, signal: context.signal, source: 'model', commandOwner: owner, effectJournal: journal }));
      options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      const session = Session.open(root, { config: options.config });
      let calls = 0;
      const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
        ? response([{ type: 'tool_use', id: 'shell-start', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
        : response([{ type: 'text', text: 'done' }]) };
      try {
        await new Agent(session, provider, [tool]).run('invoke');
        const visible = JSON.stringify(session.messages);
        assert.match(visible, /Shell command failed for pattern/);
        if (!executes) assert.ok(visible.includes(shell), visible);
        const marker = /touch ([\w-]+)/.exec(command)![1]!;
        assert.equal(fs.existsSync(path.join(root, marker)), executes);
        const records = fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as { phase: string });
        assert.deepEqual(records.map(record => record.phase), ['started', 'failed']);
        assert.deepEqual(journal.unresolved('fixture'), []);
      } finally { await owner.close(); session.close(); }
    }
    assert.equal(fs.readdirSync(path.join(root, '.agent/skill-effects')).some(name => name.endsWith('.lease')), false);
    assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.lock')), false);
  });
});

test('real Agent classifies skill shell exits and journals each effect', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const cases = [
      ['printf x | grep z', false], ['printf x | rg z', false],
      ['diff /dev/null /etc/hosts', false], ['test 1 = 2', false],
      ['printf x; grep z /dev/null', false], ['grep z /dev/null; false', true],
      ['grep x /definitely-missing-skill-file', true], ['printf error; exit 7', true],
    ] as const;
    for (const [index, [command, failed]] of cases.entries()) {
      const journal = new SkillEffectJournal(root, `classifier-${index}`);
      const owner = new SkillCommandOwner();
      const item = skill({ shell: '/bin/sh', body: `!\`${command}\`` });
      options.config.skills = [item];
      const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
        { ...options, signal: context.signal, source: 'model', commandOwner: owner, effectJournal: journal }));
      options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      const session = Session.open(root, { config: options.config });
      let calls = 0;
      const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
        ? response([{ type: 'tool_use', id: 'classify', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
        : response([{ type: 'text', text: 'done' }]) };
      try {
        await new Agent(session, provider, [tool]).run('invoke');
        const messages = JSON.stringify(session.messages);
        assert.equal(messages.includes('Shell command failed for pattern'), failed, command);
        const records = fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as { phase: string });
        assert.deepEqual(records.map(record => record.phase), ['started', failed ? 'failed' : 'finished'], command);
      } finally { await owner.close(); session.close(); }
    }
  });
});

test('real Agent returns a failure while the session owner retains a concurrent skill command', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'ask', allow: [], deny: [] };
    const journal = new SkillEffectJournal(root, 'concurrent-agent');
    const owner = new SkillCommandOwner();
    let approvals = 0;
    let release!: () => void;
    const bothApprovals = new Promise<void>(resolve => { release = resolve; });
    const item = skill({ shell: '/bin/sh', body: '!`while [ ! -f started ]; do sleep 0.01; done; printf "ERR1\\n" >&2; printf "OUT1\\n"; printf "ERR2\\n" >&2; printf "OUT2\\n"; exit 7` !`touch started; sleep 0.4; touch completed`' });
    options.config.skills = [item];
    const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
      { ...options, signal: context.signal, source: 'model', commandOwner: owner, effectJournal: journal,
        requestPermission: async () => { if (++approvals === 2) release(); await bothApprovals; return { decision: 'allow' }; } }));
    options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    const session = Session.open(root, { config: options.config });
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    try {
      await new Agent(session, provider, [tool]).run('invoke');
      assert.equal(approvals, 2);
      const messages = JSON.stringify(session.messages);
      assert.match(messages, /\[stderr\]\\nERR1\\nOUT1\\nERR2\\nOUT2/);
      assert.equal(fs.existsSync(path.join(root, 'completed')), false);
      await owner.drain();
      assert.equal(fs.existsSync(path.join(root, 'completed')), true);
      assert.deepEqual(journal.unresolved('fixture'), []);
      const records = fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as { phase: string; index: number });
      assert.deepEqual(records.filter(record => record.index === 0).map(record => record.phase), ['started', 'failed']);
      assert.deepEqual(records.filter(record => record.index === 1).map(record => record.phase), ['started', 'finished']);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    } finally { await owner.close(); session.close(); }
  });
});

test('real Agent timeout kills the inline command without delivering TERM and leaves an unknown effect', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(root, 'timeout-agent');
    const owner = new SkillCommandOwner();
    const item = skill({ shell: '/bin/sh', body: '!`trap "touch term" TERM; touch ready; while :; do :; done`' });
    options.config.skills = [item];
    const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
      { ...options, signal: context.signal, source: 'model', timeoutMs: 300, commandOwner: owner, effectJournal: journal }));
    options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    const session = Session.open(root, { config: options.config });
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'timeout-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    try {
      await new Agent(session, provider, [tool]).run('invoke');
      await owner.drain();
      assert.match(JSON.stringify(session.messages), /timed out/);
      assert.equal(fs.existsSync(path.join(root, 'ready')), true);
      assert.equal(fs.existsSync(path.join(root, 'term')), false);
      assert.equal(journal.unresolved('fixture').length, 1);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    } finally { await owner.close(); session.close(); }
  });
});

test('real Agent journals successful and overflowing skill effects', async () => {
  for (const overflow of [false, true]) await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    if (overflow) options.config.maxOutputBytes = 128;
    const journal = new SkillEffectJournal(root, `agent-${overflow}`);
    const owner = new SkillCommandOwner();
    const item = skill({ shell: '/bin/sh', body: overflow ? '!`touch effect; yes x`' : '!`touch effect; printf "ERR1\\n" >&2; printf "OUT1\\n"; printf "ERR2\\n" >&2; printf "OUT2\\n"`' });
    options.config.skills = [item];
    const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
      { ...options, signal: context.signal, source: 'model', session: () => {
        if (context.session && !context.session.isOpen) throw new Error('Skill session owner released');
        return context.session;
      }, commandOwner: owner, effectJournal: journal }));
    options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    const session = Session.open(root, { config: options.config });
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    try {
      await new Agent(session, provider, [tool]).run('invoke');
      await owner.drain();
      assert.match(JSON.stringify(session.messages), overflow ? /output byte limit/ : /ERR1\\nOUT1\\nERR2\\nOUT2/);
      assert.equal(fs.existsSync(path.join(root, 'effect')), true);
      assert.equal(journal.unresolved('fixture').length, overflow ? 1 : 0);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    } finally { await owner.close(); session.close(); }
  });
});

test('real Agent ordinary skill with allowed tools returns instructions to parent', async () => {
  await fixture(async options => {
    options.config.skills = [skill({ allowedTools: ['read_file'], body: 'INLINE_SKILL_INSTRUCTIONS' })];
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    let calls = 0;
    let secondRequest = '';
    const provider: ModelProvider = { count: async () => 0, complete: async request => {
      if (++calls === 1) return response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
      secondRequest = JSON.stringify(request.messages);
      return response([{ type: 'text', text: 'done' }]);
    } };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(parent);
      const tool = runtime.buildTools(parent.config, parent.id).find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      await new Agent(parent, provider, [tool]).run('invoke');
      assert.match(secondRequest, /INLINE_SKILL_INSTRUCTIONS/);
      assert.equal(listSessions(options.config.workspace).length, 1, 'ordinary skill must remain in the parent session');
    } finally { await runtime.close(); parent.close(); }
  });
});

test('real Agent ordinary skill grants its declared tool within the current turn', async () => {
  await fixture(async options => {
    options.config.skills = [skill({ allowedTools: ['fixture_effect'], body: 'INLINE_SKILL_INSTRUCTIONS' })];
    options.config.permissions = { mode: 'default', allow: ['skill'], deny: [] };
    let effects = 0, prompts = 0, calls = 0;
    const effect: ToolDefinition = {
      schema: { name: 'fixture_effect', description: 'Fixture effect', input_schema: { type: 'object', properties: {} } },
      readOnly: false,
      execute: async () => { effects++; return 'EFFECT_COMPLETED'; },
    };
    const provider: ModelProvider = { count: async () => 0, complete: async request => {
      calls++;
      if (calls === 1) return response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
      if (calls === 2) {
        assert.match(JSON.stringify(request.messages), /INLINE_SKILL_INSTRUCTIONS/);
        return response([{ type: 'tool_use', id: 'effect-call', name: 'fixture_effect', input: {} }], 'tool_use');
      }
      assert.match(JSON.stringify(request.messages), /EFFECT_COMPLETED/);
      return response([{ type: 'text', text: 'done' }]);
    } };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(parent);
      const tool = runtime.buildTools(parent.config, parent.id).find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [tool, effect].map(entry => ({ ...entry.schema, eager_input_streaming: true }));
      await new Agent(parent, provider, [tool, effect], { permission: async () => { prompts++; return false; } }).run('invoke');
      assert.equal(effects, 1);
      assert.equal(prompts, 0);
      assert.equal(listSessions(options.config.workspace).length, 1);
    } finally { await runtime.close(); parent.close(); }
  });
});

test('ordinary skill layer is applied before the next call in the same batch', async () => {
  await fixture(async options => {
    options.config.skills = [skill({ allowedTools: ['fixture_effect'], body: 'INSTRUCTIONS' })];
    options.config.permissions = { mode: 'default', allow: ['skill'], deny: [] };
    let effects = 0, calls = 0;
    const effect: ToolDefinition = { schema: { name: 'fixture_effect', description: 'Effect', input_schema: { type: 'object', properties: {} } },
      readOnly: false, execute: async () => { effects++; return 'EFFECT'; } };
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } },
        { type: 'tool_use', id: 'effect-call', name: 'fixture_effect', input: {} }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(parent);
      const tool = runtime.buildTools(parent.config, parent.id).find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [tool, effect].map(entry => ({ ...entry.schema, eager_input_streaming: true }));
      await new Agent(parent, provider, [tool, effect]).run('invoke');
      assert.equal(effects, 1);
    } finally { await runtime.close(); parent.close(); }
  });
});

test('ordinary skill layers respect live deny and ask and expire after the turn', async () => {
  for (const scenario of ['allow', 'deny', 'ask'] as const) await fixture(async options => {
    options.config.skills = [skill({ allowedTools: ['fixture_effect'], body: 'INSTRUCTIONS' })];
    options.config.permissions = { mode: 'default', allow: ['skill'], deny: scenario === 'deny' ? ['fixture_effect'] : [], ask: scenario === 'ask' ? ['fixture_effect'] : [] };
    let effects = 0, prompts = 0, calls = 0;
    const effect: ToolDefinition = { schema: { name: 'fixture_effect', description: 'Effect', input_schema: { type: 'object', properties: {} } },
      readOnly: false, execute: async () => { effects++; return 'EFFECT'; } };
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
      if (calls === 2 || calls === 4) return response([{ type: 'tool_use', id: `effect-${calls}`, name: 'fixture_effect', input: {} }], 'tool_use');
      return response([{ type: 'text', text: 'done' }]);
    } };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(parent);
      const tool = runtime.buildTools(parent.config, parent.id).find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [tool, effect].map(entry => ({ ...entry.schema, eager_input_streaming: true }));
      const agent = new Agent(parent, provider, [tool, effect], { permission: async () => { prompts++; return false; } });
      await agent.run('first');
      assert.equal(effects, scenario === 'allow' ? 1 : 0);
      assert.equal(prompts, scenario === 'ask' ? 1 : 0);
      await agent.run('unrelated');
      assert.equal(effects, scenario === 'allow' ? 1 : 0);
      assert.equal(calls, 5, `${scenario}: both turns reached their final model response`);
      const secondResult = parent.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'effect-4');
      assert.ok(secondResult && secondResult.type === 'tool_result' && secondResult.is_error);
      assert.equal(prompts, scenario === 'ask' ? 1 : 0);
    } finally { await runtime.close(); parent.close(); }
  });
});

test('ordinary skill layer is fenced across release and same-ID rebind', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.skills = [skill({ allowedTools: ['fixture_effect'], body: 'INSTRUCTIONS' })];
    options.config.permissions = { mode: 'default', allow: ['skill'], deny: [] };
    let effects = 0, calls = 0;
    const effect: ToolDefinition = { schema: { name: 'fixture_effect', description: 'Effect', input_schema: { type: 'object', properties: {} } },
      readOnly: false, execute: async () => { effects++; return 'EFFECT'; } };
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      if (++calls === 1) return response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
      entered(); await gate;
      return response([{ type: 'tool_use', id: 'old-effect', name: 'fixture_effect', input: {} }], 'tool_use');
    } };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(root, { config: options.config });
    let reopened: Session | undefined;
    try {
      await runtime.bindSession!(parent);
      const tool = runtime.buildTools(parent.config, parent.id).find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [tool, effect].map(entry => ({ ...entry.schema, eager_input_streaming: true }));
      const running = new Agent(parent, provider, [tool, effect]).run('invoke');
      await ready;
      await runtime.releaseSession!(parent.id);
      parent.close();
      reopened = Session.open(root, { id: parent.id });
      await runtime.bindSession!(reopened);
      const before = fs.readFileSync(parent.file);
      release();
      await assert.rejects(running, /Session is closed/);
      assert.deepEqual(fs.readFileSync(parent.file), before);
      assert.equal(effects, 0);
      let freshCalls = 0;
      const freshProvider: ModelProvider = { count: async () => 0, complete: async () => ++freshCalls === 1
        ? response([{ type: 'tool_use', id: 'fresh-effect', name: 'fixture_effect', input: {} }], 'tool_use')
        : response([{ type: 'text', text: 'done' }]) };
      const freshSkill = runtime.buildTools(reopened.config, reopened.id).find(entry => entry.schema.name === 'skill')!;
      reopened.config.tools = [freshSkill, effect].map(entry => ({ ...entry.schema, eager_input_streaming: true }));
      await new Agent(reopened, freshProvider, [freshSkill, effect]).run();
      assert.equal(effects, 0);
      const result = reopened.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'fresh-effect');
      assert.ok(result && result.type === 'tool_result' && result.is_error);
    } finally { release(); await runtime.close(); parent.close(); reopened?.close(); }
  });
});

test('ordinary skill grant is cleared after provider failure or cancellation', async () => {
  for (const scenario of ['failure', 'cancel'] as const) await fixture(async options => {
    options.config.skills = [skill({ allowedTools: ['fixture_effect'], body: 'INSTRUCTIONS' })];
    options.config.permissions = { mode: 'default', allow: ['skill'], deny: [] };
    let effects = 0, calls = 0;
    const effect: ToolDefinition = { schema: { name: 'fixture_effect', description: 'Effect', input_schema: { type: 'object', properties: {} } },
      readOnly: false, execute: async () => { effects++; return 'EFFECT'; } };
    let entered!: () => void;
    const barrier = new Promise<void>(resolve => { entered = resolve; });
    const controller = new AbortController();
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
      if (calls === 2) {
        entered();
        if (scenario === 'failure') throw new Error('fixture provider failure');
        await new Promise<void>(resolve => controller.signal.addEventListener('abort', () => resolve(), { once: true }));
        throw new Error('fixture cancelled');
      }
      if (calls === 3) return response([{ type: 'tool_use', id: 'later-effect', name: 'fixture_effect', input: {} }], 'tool_use');
      return response([{ type: 'text', text: 'done' }]);
    } };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(parent);
      const tool = runtime.buildTools(parent.config, parent.id).find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [tool, effect].map(entry => ({ ...entry.schema, eager_input_streaming: true }));
      const agent = new Agent(parent, provider, [tool, effect]);
      const first = agent.run('first', controller.signal);
      await barrier;
      if (scenario === 'cancel') { controller.abort(); assert.equal((await first).reason, 'aborted'); }
      else await assert.rejects(first, /fixture provider failure/);
      await agent.run(scenario === 'failure' ? undefined : 'later');
      assert.equal(effects, 0, scenario);
      const result = parent.messages.flatMap(message => Array.isArray(message.content) ? message.content : [])
        .find(block => block.type === 'tool_result' && block.tool_use_id === 'later-effect');
      assert.ok(result && result.type === 'tool_result' && result.is_error, scenario);
    } finally { await runtime.close(); parent.close(); }
  });
});

test('real Agent skill fork uses its live Session and retains unknown child root', async () => {
  await fixture(async options => {
    const item = skill({ context: 'fork' });
    options.config.skills = [item];
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    const runtime = await createRuntime(options.config, provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    try {
      await runtime.bindSession!(parent);
      const tools = runtime.buildTools(parent.config, parent.id);
      const tool = tools.find(entry => entry.schema.name === 'skill')!;
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      await new Agent(parent, provider, [tool]).run('invoke');
      const childInfo = listSessions(options.config.workspace).find(entry => entry.id !== parent.id);
      assert.ok(childInfo);
      const child = Session.open(options.config.workspace, { id: childInfo.id });
      try {
        assert.equal(child.config.parentSessionId, parent.id);
        assert.deepEqual(parent.rootIdentity, { rootSessionId: parent.id, originalCwd: options.config.workspace });
        assert.equal(child.rootIdentity, undefined);
      } finally { child.close(); }
    } finally { await runtime.close(); parent.close(); }
  });
});

test('real Agent persists large successful inline shell output', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.maxOutputBytes = 256_000;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(root, 'persistence-agent');
    const owner = new SkillCommandOwner();
    const item = skill({ shell: '/bin/sh', body: '!`printf begin; head -c 100000 /dev/zero | tr "\\0" x; printf end`' });
    options.config.skills = [item];
    const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
      { ...options, signal: context.signal, source: 'model', session: () => {
        if (context.session && !context.session.isOpen) throw new Error('Skill session owner released');
        return context.session;
      }, commandOwner: owner, effectJournal: journal }));
    const read = options.tools.find(candidate => candidate.schema.name === 'read_file')!;
    options.config.tools = [tool, read].map(candidate => ({ ...candidate.schema, eager_input_streaming: true }));
    const session = Session.open(root, { config: options.config });
    let calls = 0;
    let modelMessages = '';
    const provider: ModelProvider = { count: async () => 0, complete: async request => {
      if (++calls === 1) return response([{ type: 'tool_use', id: 'persistence-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
      if (calls === 2) {
        modelMessages = JSON.stringify(request.messages);
        const saved = /Full output saved to: ([^\s\\]+)/.exec(modelMessages);
        assert.ok(saved);
        return response([{ type: 'tool_use', id: 'read-result', name: 'read_file', input: { path: saved[1] } }], 'tool_use');
      }
      return response([{ type: 'text', text: 'done' }]);
    } };
    try {
      await new Agent(session, provider, [tool, read]).run('invoke');
      await owner.drain();
      assert.deepEqual(journal.unresolved('fixture'), []);
      const records = fs.readFileSync(journal.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line) as { phase: string });
      assert.deepEqual(records.map(record => record.phase), ['started', 'finished']);
      const messages = JSON.stringify(session.messages);
      const saved = /Full output saved to: ([^\s\\]+)/.exec(messages);
      assert.ok(saved, 'large successful skill shell output should expose its persisted file to the model');
      assert.ok(modelMessages.includes(saved[0]), 'the following model request must receive the persisted file path');
      assert.match(modelMessages, /beginx{100}/, 'the following model request must receive the output preview');
      assert.equal(fs.readFileSync(saved[1]!, 'utf8'), `begin${'x'.repeat(100000)}end`);
      assert.ok(messages.includes(`begin${'x'.repeat(100000)}end`), 'real Read must return the complete saved file');
      const id = session.id;
      session.close();
      const reopened = Session.open(root, { id, config: options.config });
      const other = Session.open(root, { config: options.config });
      try {
        const readContext = { workspace: root, signal: new AbortController().signal, allowShell: true, maxOutputBytes: 256000 };
        assert.equal(await read.execute({ path: saved[1]! }, { ...readContext, session: reopened }), `begin${'x'.repeat(100000)}end`);
        await assert.rejects(read.execute({ path: saved[1]! }, { ...readContext, session: other }), /workspace/);
      } finally { reopened.close(); other.close(); }
      fs.rmSync(path.dirname(saved[1]!), { recursive: true, force: true });
    } finally { await owner.close(); session.close(); }
  });
});

test('result directory pin rejects a replaced directory before writing', { skip: !['darwin', 'linux'].includes(process.platform) }, async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    const dir = path.join(root, 'result');
    const protectedDir = path.join(root, 'protected');
    fs.mkdirSync(dir); fs.mkdirSync(protectedDir);
    const destination = path.join(dir, 'output.txt');
    const pin = await pinSkillResult(destination);
    try {
      await pin.recheckBeforeWrite();
      fs.renameSync(dir, `${dir}-old`);
      fs.symlinkSync(protectedDir, dir);
      if (process.platform === 'darwin') await assert.rejects(async () => pin.recheckBeforeWrite());
      else {
        await pin.recheckBeforeWrite();
        await fs.promises.writeFile(pin.ioPath, 'owned');
        assert.equal(fs.readFileSync(path.join(`${dir}-old`, 'output.txt'), 'utf8'), 'owned');
      }
      assert.equal(fs.existsSync(path.join(protectedDir, 'output.txt')), false);
    } finally { await pin.close(); }
  });
});

test('real Agent retains inline output on result-directory and partial-write faults', async () => {
  for (const fault of ['directory', 'write'] as const) {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.maxOutputBytes = 256000;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(root, 'persistence-io');
    const owner = new SkillCommandOwner();
    const item = skill({ shell: '/bin/sh', body: '!`head -c 40000 /dev/zero | tr "\\0" x`' });
    options.config.skills = [item];
    const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
      { ...options, signal: context.signal, source: 'model', session: () => context.session,
        commandOwner: owner, effectJournal: journal }));
    options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    const session = Session.open(root, { config: options.config });
    const directory = skillResultsDirectory(session)!;
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    const originalOpen = fs.promises.open;
    if (fault === 'directory') fs.writeFileSync(directory, 'blocking file');
    else {
      Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: async (...args: unknown[]) => {
        const handle = await Reflect.apply(originalOpen, fs.promises, args);
        if (typeof args[0] === 'string' && args[0].endsWith('.txt')) {
          const write = handle.write.bind(handle);
          Object.defineProperty(handle, 'write', { value: async (buffer: Buffer, offset: number, length: number, position: number) => {
            await write(buffer, offset, Math.min(length, 64), position);
            throw Object.assign(new Error('injected result write error'), { code: 'EIO' });
          } });
        }
        return handle;
      } });
      syncBuiltinESMExports();
    }
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'io-failure', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    try {
      await new Agent(session, provider, [tool]).run('invoke');
      assert.ok(JSON.stringify(session.messages).includes('x'.repeat(40000)));
      if (fault === 'directory') assert.equal(fs.readFileSync(directory, 'utf8'), 'blocking file');
      else assert.deepEqual(fs.readdirSync(directory), []);
      assert.deepEqual(journal.unresolved('fixture'), []);
      const rows = fs.readFileSync(journal.file, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { phase: string });
      assert.deepEqual(rows.map(row => row.phase), ['started', 'finished']);
    } finally {
      Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: originalOpen });
      syncBuiltinESMExports();
      await owner.close(); session.close();
      fs.rmSync(path.dirname(directory), { recursive: true, force: true });
    }
  });
  }
});

test('release and same-ID rebind during result file open remove the stale output', { skip: process.platform !== 'darwin', timeout: 10000 }, async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.maxOutputBytes = 256000;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const item = skill({ shell: '/bin/sh', body: '!`head -c 40000 /dev/zero | tr "\\0" x`' });
    options.config.skills = [item];
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const parent = Session.open(root, { config: options.config });
    const directory = skillResultsDirectory(parent)!;
    const originalOpen = fs.promises.open;
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    let reopened: Session | undefined;
    try {
      await runtime.bindSession!(parent);
      Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: async (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].startsWith(`${directory}/`) && args[0].endsWith('.txt')) {
          entered(); await gate;
        }
        return Reflect.apply(originalOpen, fs.promises, args);
      } });
      syncBuiltinESMExports();
      const tool = createSkillTool(parent.config, (selected, args, context) => runtime.runSkill!(parent.config, parent.id,
        selected, args, context.signal, undefined, context.conversation, context.session));
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      const running = new Agent(parent, options.provider, [tool]).run('invoke');
      await ready;
      const closing = runtime.releaseSession!(parent.id);
      parent.close();
      reopened = Session.open(root, { id: parent.id });
      await runtime.bindSession!(reopened);
      release();
      await closing;
      await assert.rejects(running, /Session is closed/);
      assert.deepEqual(fs.readdirSync(directory), []);
    } finally {
      release();
      Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: originalOpen });
      syncBuiltinESMExports();
      await runtime.close(); parent.close(); reopened?.close();
      fs.rmSync(path.dirname(directory), { recursive: true, force: true });
    }
  }, async request => request.messages.at(-1)?.content === 'invoke'
    ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
    : response([{ type: 'text', text: 'done' }]));
});

test('real Agent owner cancellation releases the shell and effect lease', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(root, 'cancel-agent');
    const owner = new SkillCommandOwner();
    const item = skill({ shell: '/bin/sh', body: '!`sleep 30 & echo $! > child-pid; touch ready; wait`' });
    options.config.skills = [item];
    const tool = createSkillTool(options.config, (selected, args, context) => executeSkill(selected, args,
      { ...options, signal: context.signal, source: 'model', commandOwner: owner, effectJournal: journal }));
    options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    const session = Session.open(root, { config: options.config });
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => ++calls === 1
      ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
      : response([{ type: 'text', text: 'done' }]) };
    try {
      const run = new Agent(session, provider, [tool]).run('invoke');
      const deadline = Date.now() + 5000;
      while (!fs.existsSync(path.join(root, 'ready'))) {
        if (Date.now() > deadline) throw new Error('skill did not start');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const pid = Number(fs.readFileSync(path.join(root, 'child-pid'), 'utf8'));
      await owner.close();
      await run;
      assert.throws(() => process.kill(pid, 0));
      assert.equal(journal.unresolved('fixture').length, 1);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    } finally { await owner.close(); session.close(); }
  });
});

test('runtime session release cancels a real Agent skill and preserves its unknown effect after rebind', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const item = skill({ shell: '/bin/sh', body: '!`printf x >> effect-count; if [ ! -f ready ]; then sleep 30 & echo $! > child-pid; touch ready; wait; fi; printf recovered`' });
    options.config.skills = [item];
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const parent = Session.open(root, { config: options.config });
    const journal = new SkillEffectJournal(root, parent.id);
    let reopened: Session | undefined;
    let running: Promise<unknown> | undefined;
    try {
      await runtime.bindSession!(parent);
      const tool = createSkillTool(parent.config, (selected, args, context) => runtime.runSkill!(parent.config, parent.id, selected, args, context.signal, undefined, context.conversation, context.session));
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      running = new Agent(parent, options.provider, [tool]).run('invoke');
      const deadline = Date.now() + 5000;
      while (!fs.existsSync(path.join(root, 'ready'))) {
        if (Date.now() > deadline) throw new Error('skill did not start');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const pid = Number(fs.readFileSync(path.join(root, 'child-pid'), 'utf8'));
      await runtime.releaseSession!(parent.id);
      await running;
      assert.throws(() => process.kill(pid, 0));
      assert.equal(journal.unresolved('fixture').length, 1);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
      parent.close();
      reopened = Session.open(root, { id: parent.id });
      await runtime.bindSession!(reopened);
      await assert.rejects(runtime.runSkill!(reopened.config, reopened.id, item, '', new AbortController().signal), /effect is unknown/);
      assert.equal(journal.unresolved('fixture').length, 1);
      assert.equal(fs.readFileSync(path.join(root, 'effect-count'), 'utf8'), 'x');
      const recoveryTool = createSkillTool(reopened.config, (selected, args, context) => runtime.runSkill!(reopened!.config, reopened!.id, selected, args, context.signal, undefined, context.conversation, context.session));
      reopened.config.tools = [{ ...recoveryTool.schema, eager_input_streaming: true }];
      let recoveryCalls = 0;
      const recoveryProvider: ModelProvider = { count: async () => 0, complete: async () => ++recoveryCalls === 1
        ? response([{ type: 'tool_use', id: 'recovery-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
        : response([{ type: 'text', text: 'done' }]) };
      await new Agent(reopened, recoveryProvider, [recoveryTool]).run('recover');
      assert.match(fs.readFileSync(reopened.file, 'utf8'), /effect is unknown/);
      assert.equal(fs.readFileSync(path.join(root, 'effect-count'), 'utf8'), 'x');
      assert.equal(journal.unresolved('fixture').length, 1);
      assert.equal(fs.readFileSync(journal.file, 'utf8').split('\n').filter(line => line.includes('"phase":"unknown"')).length, 1);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
      await runtime.releaseSession!(reopened.id);
      reopened.close();
      reopened = Session.open(root, { id: parent.id });
      await runtime.bindSession!(reopened);
      const retrySession = reopened;
      const retryTool = createSkillTool(retrySession.config, (selected, args, context) => runtime.runSkill!(retrySession.config, retrySession.id, selected, args, context.signal, undefined, context.conversation, context.session));
      retrySession.config.tools = [{ ...retryTool.schema, eager_input_streaming: true }];
      recoveryCalls = 0;
      await new Agent(retrySession, recoveryProvider, [retryTool]).run('explicit retry');
      assert.match(JSON.stringify(retrySession.messages), /effect is unknown/);
      assert.equal(fs.readFileSync(path.join(root, 'effect-count'), 'utf8'), 'x');
      assert.equal(journal.unresolved('fixture').length, 1);
      assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    } finally {
      await runtime.close();
      await running?.catch(() => {});
      parent.close(); reopened?.close();
    }
    assert.equal(fs.existsSync(`${parent.file}.lock`), false);
  }, async request => request.messages.at(-1)?.content === 'invoke'
    ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
    : response([{ type: 'text', text: 'done' }]));
});

test('duplicate inline replacements follow command completion order', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const command = 'if mkdir order-lock 2>/dev/null; then sleep 0.2; printf first; else printf second; fi';
    const body = `!\`${command}\` !\`${command}\``;
    assert.equal(await executeSkill(skill({ shell: '/bin/sh', body }), '', options), 'second first');
  });
});

test('interrupted effects release their lease and remain visible to another process', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(options.config.workspace, 'interrupted');
    const marker = path.join(options.config.workspace, 'effect');
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`printf done > effect; sleep 10`' }), '',
      { ...options, effectJournal: journal, timeoutMs: 300 }), /timed out/);
    assert.equal(fs.readFileSync(marker, 'utf8'), 'done');
    const pending = journal.unresolved('fixture');
    assert.equal(pending.length, 1);
    assert.equal(fs.readdirSync(journal.directory).some(name => name.endsWith('.lease')), false);
    const modulePath = path.resolve('dist/skill-effects.js');
    const probe = `import { SkillEffectJournal } from ${JSON.stringify(new URL(`file://${modulePath}`).href)}; process.stdout.write(JSON.stringify(new SkillEffectJournal(process.argv[1], 'interrupted').unresolved('fixture')))`;
    const recovered = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', probe, options.config.workspace], { encoding: 'utf8' })) as { id: string }[];
    assert.equal(recovered[0]?.id, pending[0]?.id);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`printf recovered`' }), '', { ...options, effectJournal: journal }), /effect is unknown/);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`printf recovered`' }), '', { ...options, effectJournal: journal }), /effect is unknown/);
  });
});

test('an interrupted command remains blocked after warning delivery', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(options.config.workspace, 'recovery-session');
    const prior = journal.start('fixture', 2, 'touch marker');
    const interrupted = fs.readFileSync(journal.file);
    journal.finish(prior, 'failed');
    fs.writeFileSync(journal.file, interrupted);
    const retry = skill({ shell: '/bin/sh', body: '!`touch retried; printf ok`' });
    await assert.rejects(executeSkill(retry, '', { ...options, effectJournal: journal }), /command #2 in "fixture".*effect is unknown/);
    assert.equal(fs.existsSync(path.join(options.config.workspace, 'retried')), false);
    assert.equal(journal.unresolved('fixture').length, 1);
    journal.acknowledge(journal.unresolved('fixture'));
    await assert.rejects(executeSkill(retry, '', { ...options, effectJournal: journal }), /effect is unknown/);
    assert.equal(fs.existsSync(path.join(options.config.workspace, 'retried')), false);
  });
});

test('repeated recovery reports leave the interrupted command unresolved', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    const journal = new SkillEffectJournal(options.config.workspace, 'failure-session');
    const prior = journal.start('fixture', 1, 'touch marker');
    const interrupted = fs.readFileSync(journal.file);
    journal.finish(prior, 'failed');
    fs.writeFileSync(journal.file, interrupted);
    const retry = skill({ shell: '/bin/sh', body: '!`exit 3`' });
    await assert.rejects(executeSkill(retry, '', { ...options, effectJournal: journal }), /command #1 in "fixture"/);
    await assert.rejects(executeSkill(retry, '', { ...options, effectJournal: journal }), /effect is unknown/);
    assert.equal(journal.unresolved('fixture').length, 1);
  });
});

test('inline shell output overflow, nonzero exit, timeout and cancellation terminate the command', async () => {
  await fixture(async options => {
    options.config.allowShell = true; options.config.permissions = { mode: 'bypass', allow: [], deny: [] };
    options.config.maxOutputBytes = 128;
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`yes x`' }), '', options), /output byte limit/);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`exit 3`' }), '', options), /Shell command failed for pattern/);
    await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`sleep 10`' }), '', { ...options, timeoutMs: 25 }), /timed out/);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25);
    try { await assert.rejects(executeSkill(skill({ shell: '/bin/sh', body: '!`sleep 10`' }), '', { ...options, signal: controller.signal }), /aborted/); }
    finally { clearTimeout(timer); }
  });
});

test('skill command owner waits for child exit and post-exit finalization on close', async () => {
  const owner = new SkillCommandOwner();
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  let release!: () => void;
  const finalized = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  const operation = owner.run(new AbortController().signal, async signal => {
    const child = spawn(process.execPath, ['-e', 'process.stdin.once("data", () => process.exit(0)); process.stdout.write("ready");'], { stdio: ['pipe', 'pipe', 'ignore'] });
    child.stdout.once('data', () => { events.push('ready'); started(); });
    signal.addEventListener('abort', () => { events.push('abort'); child.stdin.end('exit'); }, { once: true });
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`child exited ${code}`)));
    });
    events.push('exit');
    await finalized;
    events.push('finalized');
  });
  await ready;
  let closed = false;
  const closing = owner.close().then(() => { closed = true; });
  await new Promise<void>(resolve => setTimeout(resolve, 100));
  assert.deepEqual(events, ['ready', 'abort', 'exit']);
  assert.equal(closed, false);
  release();
  await Promise.all([operation, closing]);
  assert.deepEqual(events, ['ready', 'abort', 'exit', 'finalized']);
  assert.equal(closed, true);
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

test('skill hook approvals bind HOME to each definition across foreground and registry execution', async () => {
  for (const background of [false, true]) for (const hookKind of ['sync', 'configured-async', 'header-async'] as const) {
    await fixture(async options => {
      const previous = process.env.HOME;
      const workspace = options.config.workspace;
      const shared = `X=old; X=new export Y; printf "$HOME" >> '${path.join(workspace, 'shared')}'`;
      const target = `X=old; X=new export Y; ${hookKind === 'header-async' ? `printf '{"async":true}\\n'; ` : ''}printf "$HOME" > '${path.join(workspace, 'target')}'${hookKind === 'header-async' ? '; sleep 0.05' : ''}`;
      const hooks = { SessionStart: [{ hooks: [
        { command: shared },
        { command: 'true' },
        { command: target, ...(hookKind === 'configured-async' ? { async: true } : {}) },
        { command: 'true' },
      ] }] };
      const file = path.join(workspace, '.harness/skills/fixture/SKILL.md');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `---\nname: fixture\ndescription: Fixture\ncontext: fork\nbackground: ${background}\nhooks: ${JSON.stringify(hooks)}\n---\nTask\n`);
      const definition = loadProjectConfig(workspace, { paths: [], pluginHooks: 'preview' }).skills.find(item => item.name === 'fixture')!;
      options.config.allowShell = true;
      options.config.permissions = { mode: 'bypass', allow: [], deny: [], ask: ['Bash(true)'] };
      options.config.hooks = { SessionStart: [{ command: shared }] };
      const registry = background ? new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools }) : undefined;
      let approvals = 0;
      try {
        process.env.HOME = '/first-fixture';
        const result = JSON.parse(await executeSkill(definition, '', { ...options, registry, requestPermission: async () => {
          process.env.HOME = ++approvals === 1 ? '/second-fixture' : '/after-fixture';
          return { decision: 'allow' };
        } }));
        if (registry) assert.equal((await registry.get(result.id, { waitMs: 3000 })).status, 'completed');
        assert.equal(approvals, 2);
        assert.equal(fs.readFileSync(path.join(workspace, 'shared'), 'utf8'), '/after-fixture/first-fixture');
        assert.equal(fs.readFileSync(path.join(workspace, 'target'), 'utf8'), '/second-fixture');
        if (registry) {
          process.env.HOME = '/resume-fixture';
          await registry.sendMessage(result.id, 'continue');
          const continued = await registry.get(result.id, { waitMs: 3000 });
          assert.equal(continued.status, 'completed', continued.error ?? undefined);
          assert.equal(fs.readFileSync(path.join(workspace, 'shared'), 'utf8'), '/after-fixture/first-fixture/resume-fixture/first-fixture');
          assert.equal(fs.readFileSync(path.join(workspace, 'target'), 'utf8'), '/second-fixture');
        }
        const journals = fs.readdirSync(path.join(workspace, '.agent'));
        assert.equal(journals.some(name => name.endsWith('.lock')), false);
        for (const journal of journals.filter(name => name.endsWith('.jsonl'))) {
          const text = fs.readFileSync(path.join(workspace, '.agent', journal), 'utf8');
          assert.equal(text.includes('/first-fixture') || text.includes('/second-fixture'), false);
        }
      } finally {
        await registry?.close();
        if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
      }
    });
  }
});

test('skill hook approval preserves an absent HOME through async execution', async () => {
  for (const hookKind of ['sync', 'configured-async', 'header-async'] as const) {
    await fixture(async options => {
      const previous = process.env.HOME;
      const marker = path.join(options.config.workspace, 'absent-hook');
      const presence = path.join(options.config.workspace, 'home-present');
      const command = `${hookKind === 'header-async' ? `printf '{"async":true}\\n'; ` : ''}printf '%s' "$HOME" > '${marker}'; env | grep '^HOME=' > '${presence}'; true${hookKind === 'header-async' ? '; sleep 0.05' : ''}`;
      options.config.allowShell = true;
      options.config.permissions = { mode: 'bypass', allow: [], deny: [], ask: ['Bash(true)'] };
      try {
        delete process.env.HOME;
        await executeSkill(skill({ context: 'fork', hooks: { SessionStart: [
          { command, ...(hookKind === 'configured-async' ? { async: true } : {}) }, { command: 'true' },
        ] } }), '', { ...options, requestPermission: async () => {
          process.env.HOME = '/after-fixture';
          return { decision: 'allow' };
        } });
        assert.equal(fs.readFileSync(marker, 'utf8'), '');
        assert.equal(fs.readFileSync(presence, 'utf8'), '');
      } finally {
        if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
      }
    });
  }
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
      const result = JSON.parse(await executeSkill(skill({ hooks: { UserPromptSubmit: [{ type: 'http', url: `http://127.0.0.1:${address.port}/hook` }] } }), '', options));
      assert.equal(result.text, 'Summary'); assert.equal(payloads.length, 1);
      assert.equal(payloads[0]!.hook_event_name, 'UserPromptSubmit');
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

test('concurrent invocations of a live background skill return one task and one foreground result', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await fixture(async options => {
    const definition = skill({context:'fork', background:true});
    const registry = new AgentRegistry({source:options.config, tools:options.tools, provider:options.provider});
    try {
      const results = await Promise.all(['first','second'].map(args =>
        executeSkill(definition, args, {...options, source:'model', registry}).then(text => JSON.parse(text))));
      const task = results.find(result => result.id);
      const foreground = results.find(result => result.text);
      assert.ok(task);
      assert.equal(foreground?.text, 'finished second');
      assert.notEqual(foreground.session_id, task.id);
      assert.equal(registry.list().length, 1);
      release();
      assert.equal((await registry.get(task.id, {waitMs:5000})).summary, 'finished first');
      const again = JSON.parse(await executeSkill(definition, 'third', {...options, source:'model', registry}));
      assert.ok(again.id && again.id !== task.id);
      assert.equal((await registry.get(again.id, {waitMs:5000})).summary, 'finished third');
    } finally { release(); await registry.close(); }
  }, async request => {
    const args = String(request.messages.at(-1)?.content).split(' ').at(-1);
    if (args === 'first') await gate;
    return response([{type:'text', text:'finished ' + args}]);
  });
});

test('a background skill invoking itself delivers the foreground result to its own Agent', async () => {
  const requests: ModelRequest[] = [];
  await fixture(async options => {
    options.config.features = { tasks:false, subagents:true, agentMessaging:true };
    options.config.skills = [skill({context:'fork', background:true, allowedTools:['skill']})];
    options.config.permissions = {mode:'bypass', allow:[], deny:[]};
    const runtime = await createRuntime(options.config, options.provider, options.signal);
    options.config.tools = runtime.tools.map(tool => ({...tool.schema, eager_input_streaming:true}));
    const parent = Session.open(options.config.workspace, {config:options.config});
    try {
      await runtime.bindSession!(parent);
      const tools = runtime.buildTools(parent.config, parent.id);
      const context = {workspace:parent.config.workspace, session:parent, signal:options.signal, allowShell:false, maxOutputBytes:24000};
      const outer = JSON.parse(await tools.find(tool => tool.schema.name === 'skill')!.execute({name:'fixture',args:'outer'}, context));
      const done = JSON.parse(await tools.find(tool => tool.schema.name === 'get_agent')!.execute({id:outer.id,wait_ms:5000}, context));
      assert.equal(done.summary, 'outer finished');
      const last = requests.at(-1)!.messages.at(-1)!.content;
      assert.ok(Array.isArray(last));
      const result = last.find(block => block.type === 'tool_result');
      assert.ok(result?.type === 'tool_result' && !result.is_error, JSON.stringify(last));
      const returned = JSON.parse(String(result.content));
      assert.equal(returned.text, 'inner finished');
      const nested = Session.open(parent.config.workspace, {id:returned.session_id});
      try {
        assert.equal(nested.config.parentSessionId, outer.id);
        assert.equal(nested.config.spawnDepth, 2);
      } finally { await nested.close(); }
      const notifications = runtime.drainEvents!(parent.id, parent).filter(event => event.kind === 'agent_events');
      assert.deepEqual(notifications.flatMap(event => event.events.map(entry => entry.agent.id)), [outer.id]);
    } finally { await runtime.close(); await parent.close(); }
  }, async request => {
    requests.push(structuredClone(request));
    const prompt = request.messages.at(-1)?.content;
    if (prompt === 'Task outer') return response([{type:'tool_use',id:'repeat',name:'skill',input:{name:'fixture',args:'inner'}}], 'tool_use');
    return response([{type:'text',text:prompt === 'Task inner' ? 'inner finished' : 'outer finished'}]);
  });
});

test('stopping a worker waiting on a nested background skill aborts the nested provider', async () => {
  let entered!: () => void;
  const pending = new Promise<void>(resolve => { entered = resolve; });
  let aborted = false;
  await fixture(async options => {
    options.config.features = {tasks:false, subagents:true, agentMessaging:true};
    options.config.skills = [skill({background:true, context:'fork', allowedTools:['skill']}),
      skill({name:'second', background:true, context:'fork'})];
    options.config.permissions = {mode:'bypass', allow:[], deny:[]};
    const runtime = await createRuntime(options.config, options.provider, options.signal);
    options.config.tools = runtime.tools.map(tool => ({...tool.schema, eager_input_streaming:true}));
    const parent = Session.open(options.config.workspace, {config:options.config});
    try {
      await runtime.bindSession!(parent);
      const tools = runtime.buildTools(parent.config, parent.id);
      const context = {workspace:parent.config.workspace, session:parent, signal:options.signal, allowShell:false, maxOutputBytes:24000};
      const outer = JSON.parse(await tools.find(tool => tool.schema.name === 'skill')!.execute({name:'fixture',args:'outer'}, context));
      await pending;
      const stopped = JSON.parse(await tools.find(tool => tool.schema.name === 'stop_agent')!.execute({id:outer.id}, context));
      assert.equal(stopped.status, 'cancelled');
      assert.equal(aborted, true);
      const notices = runtime.drainEvents!(parent.id, parent).filter(event => event.kind === 'agent_events');
      assert.deepEqual(notices.flatMap(batch => batch.events.map(event => event.agent.id)), [outer.id]);
      const sessions = listSessions(parent.config.workspace).filter(session => session.id !== parent.id);
      assert.equal(sessions.length, 2);
      assert.ok(sessions.every(session => !session.active));
    } finally { await runtime.close(); await parent.close(); }
  }, async (request, signal) => {
    const prompt = request.messages.at(-1)?.content;
    if (prompt === 'Task outer') return response([{type:'tool_use',id:'spawn',name:'skill',input:{name:'second',args:'inner'}}], 'tool_use');
    if (prompt === 'Task inner') {
      entered();
      await new Promise<void>(resolve => signal!.addEventListener('abort', () => { aborted = true; resolve(); }, {once:true}));
    }
    return response([{type:'text',text:'done'}]);
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

test('background skill approval uses the child signal after the invocation ends', async () => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let calls = 0; let approvals = 0; let executions = 0;
  await fixture(async options => {
    const invocation = new AbortController();
    const tool: ToolDefinition = { schema: { name: 'run_command', input_schema: { type: 'object' } }, readOnly: false,
      async execute() { executions++; return 'executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    options.config.allowShell = true;
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: ['Bash'] };
    const parent = Session.open(options.config.workspace, { config: options.config });
    const registry = new AgentRegistry({ source: options.config, parentSessionId: parent.id, provider: options.provider, tools: options.tools });
    try {
      registry.bindHistory(parent);
      const descriptor = JSON.parse(await executeSkill(skill({ context: 'fork', background: true, allowedTools: ['Bash(echo *)'] }), '', {
        ...options, signal: invocation.signal, parentSessionId: parent.id, registry,
        requestPermission: async (_tool, _input, _decision, signal) => {
          assert.equal(invocation.signal.aborted, true); assert.equal(signal.aborted, false);
          approvals++; return { decision: 'allow' };
        },
      }));
      invocation.abort(); release();
      assert.equal((await registry.get(descriptor.id, { waitMs: 1000 })).status, 'completed');
      assert.equal(approvals, 1); assert.equal(executions, 1);
    } finally { release(); await registry.close(); parent.close(); }
  }, async () => {
    if (++calls === 1) { await ready; return response([{ type: 'tool_use', id: 'allowed', name: 'run_command', input: { command: 'echo ok' } }], 'tool_use'); }
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('skill hook preparation stops when approval binding changes', async () => {
  await fixture(async options => {
    options.config.allowShell = true;
    const marker = path.join(options.config.workspace, 'hook-started');
    const registry = new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools });
    let approvals = 0;
    const revoke = registry.bindApproval(async () => ({ decision: 'allow' }));
    try {
      await assert.rejects(executeSkill(skill({ context: 'fork', background: true, hooks: {
        SessionStart: [{ command: `touch '${marker}'` }, { command: 'printf second' }],
      } }), '', { ...options, registry, requestPermission: async () => {
        approvals++;
        revoke();
        return { decision: 'allow' };
      } }), /Session approval unavailable/);
      assert.equal(approvals, 1);
      assert.equal(fs.existsSync(marker), false);
      assert.equal(registry.list().length, 0);
    } finally { await registry.close(); }
  });
});

test('real Agent stops a fork skill when its owner is released during hook approval', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    const marker = path.join(root, 'hook-started');
    const item = skill({ context: 'fork', background: true, hooks: {
      SessionStart: [{ command: `touch '${marker}'` }],
    } });
    options.config.skills = [item];
    options.config.allowShell = true;
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: ['Bash'] };
    const parent = Session.open(root, { config: options.config });
    let owner: Session | undefined = parent;
    const registry = new AgentRegistry({ source: parent.config, provider: options.provider, tools: options.tools,
      parentSessionId: parent.id, requireSessionOwner: true, sessionOwner: () => owner });
    registry.bindHistory(parent);
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const tool = createSkillTool(parent.config, (selected, args, context) => executeSkill(selected, args, {
      ...options, config: parent.config, source: 'model', registry, parentSessionId: parent.id, signal: context.signal,
      requestPermission: async () => { entered(); await gate; return { decision: 'allow' }; },
    }));
    parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    const outputs: string[] = [];
    try {
      const running = new Agent(parent, options.provider, [tool], { toolResult: event => outputs.push(String(event.content)) }).run('invoke');
      await ready;
      owner = undefined;
      await registry.close();
      release();
      await running;
      assert.match(outputs.join('\n'), /Session approval unavailable/);
      assert.equal(fs.existsSync(marker), false);
      assert.equal(listSessions(root).length, 1);
      assert.equal(registry.list().length, 0);
    } finally { release(); await registry.close(); parent.close(); }
  }, async request => request.messages.at(-1)?.content === 'invoke'
    ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
    : response([{ type: 'text', text: 'done' }]));
});

test('real Agent inline skill cannot use its released Session after same-ID rebind', async () => {
  await fixture(async options => {
    const item = skill({ shell: '/bin/sh', body: '!`touch stale-effect`' });
    options.config.skills = [item];
    options.config.allowShell = true;
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: ['Bash'] };
    options.config.features = { ...options.config.features, tasks: false, subagents: false };
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const parent = Session.open(options.config.workspace, { config: options.config });
    let reopened: Session | undefined;
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    let skillError = '';
    try {
      await runtime.bindSession!(parent);
      const tool = createSkillTool(parent.config, async (selected, args, context) => {
        try {
          return await runtime.runSkill!(parent.config, parent.id, selected, args, context.signal,
            async () => { entered(); await gate; return { decision: 'allow' }; }, context.conversation, context.session);
        } catch (error) { skillError = String(error); throw error; }
      });
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      const running = new Agent(parent, options.provider, [tool]).run('invoke');
      await ready;
      const closing = runtime.releaseSession!(parent.id);
      parent.close();
      reopened = Session.open(options.config.workspace, { id: parent.id });
      await runtime.bindSession!(reopened);
      release();
      await closing;
      await assert.rejects(running, /Session is closed/);
      assert.match(skillError, /released|aborted/i);
      assert.equal(fs.existsSync(path.join(options.config.workspace, 'stale-effect')), false);
    } finally { release(); await runtime.close(); parent.close(); reopened?.close(); }
  }, async request => request.messages.at(-1)?.content === 'invoke'
    ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
    : response([{ type: 'text', text: 'done' }]));
});

test('runtime release and same-ID rebind revoke a real Agent skill approval', async () => {
  await fixture(async options => {
    const root = options.config.workspace;
    const hook = path.join(root, 'released-hook');
    const command = path.join(root, 'released-command');
    const item = skill({ context: 'fork', background: true, shell: '/bin/sh',
      body: `!\`printf command > '${command}'\``, hooks: { SessionStart: [{ command: `touch '${hook}'` }] } });
    options.config.skills = [item];
    options.config.allowShell = true;
    options.config.permissions = { mode: 'default', allow: [], deny: [], ask: ['Bash'] };
    options.config.features = { ...options.config.features, tasks: false, subagents: true, agentMessaging: true };
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const parent = Session.open(root, { config: options.config });
    let reopened: Session | undefined;
    let entered!: () => void, release!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    try {
      await runtime.bindSession!(parent);
      let skillError = '';
      const tool = createSkillTool(parent.config, async (selected, args, context) => {
        try { return await runtime.runSkill!(parent.config, parent.id, selected, args, context.signal,
          async () => { entered(); await gate; return { decision: 'allow' }; }, context.conversation, context.session); }
        catch (error) { skillError = String(error); throw error; }
      });
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      const running = new Agent(parent, options.provider, [tool]).run('invoke');
      await ready;
      await runtime.releaseSession!(parent.id);
      parent.close();
      reopened = Session.open(root, { id: parent.id });
      await runtime.bindSession!(reopened);
      release();
      await assert.rejects(running, /Session is closed/);
      assert.match(skillError, /Session approval unavailable|session-owned tools|closed/i);
      assert.equal(fs.existsSync(hook), false);
      assert.equal(fs.existsSync(command), false);
      assert.equal(listSessions(root).length, 1);
    } finally {
      release(); await runtime.close(); parent.close(); reopened?.close();
    }
    assert.equal(fs.existsSync(`${parent.file}.lock`), false);
  }, async request => request.messages.at(-1)?.content === 'invoke'
    ? response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use')
    : response([{ type: 'text', text: 'done' }]));
});

test('real fork skill rejects a replaced owner after worktree preparation', async () => {
  let childCalls = 0;
  await fixture(async options => {
    const root = options.config.workspace;
    const checkout = path.join(root, 'checkout');
    const ready = path.join(root, 'factory-ready');
    const gate = path.join(root, 'factory-gate');
    const removed = path.join(root, 'factory-removed');
    fs.mkdirSync(checkout);
    execFileSync('mkfifo', [gate]);
    options.config.features = { ...options.config.features, tasks: false, subagents: true, agentMessaging: true, agentTypes: true };
    options.config.hooks = {
      WorktreeCreate: [{ hooks: [{ type: 'command', command: `printf ready > '${ready}'; read gate < '${gate}'; printf '%s' '${checkout}'` }] }],
      WorktreeRemove: [{ hooks: [{ type: 'command', command: `printf removed > '${removed}'` }] }],
    };
    options.config.agentTypes = [{ name: 'isolated', description: 'fixture', path: '/fixture/isolated.md',
      body: 'ISOLATED_CHILD', mode: 'explore', isolation: 'worktree' }];
    const item = skill({ context: 'fork', agent: 'isolated', background: true });
    options.config.skills = [item];
    const runtime = await createRuntime(options.config, options.provider, new AbortController().signal);
    const parent = Session.open(root, { config: options.config });
    let reopened: Session | undefined;
    let running: Promise<unknown> | undefined;
    try {
      await runtime.bindSession!(parent);
      const tool = createSkillTool(parent.config, (selected, args, context) => runtime.runSkill!(parent.config, parent.id, selected, args, context.signal, undefined, context.conversation, context.session));
      parent.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
      running = new Agent(parent, options.provider, [tool]).run('invoke');
      const deadline = Date.now() + 5000;
      while (!fs.existsSync(ready) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(fs.existsSync(ready), 'worktree factory reached barrier');
      const worktree = parent.hookResolverObservations.filter(row => row.event.event === 'WorktreeCreate');
      assert.equal(worktree.length, 1); assert.equal(worktree[0]?.resolver, 'pending'); assert.equal(worktree[0]?.runner, undefined);
      parent.close();
      reopened = Session.open(root, { id: parent.id });
      const beforeCleanup = fs.readFileSync(reopened.file, 'utf8');
      await assert.rejects(runtime.bindSession!(reopened), /another session instance/);
      fs.writeFileSync(gate, 'go\n');
      await assert.rejects(running, /Session is closed/);
      assert.equal(childCalls, 0);
      assert.ok(fs.existsSync(removed));
      assert.equal(fs.readFileSync(reopened.file, 'utf8'), beforeCleanup);
      assert.deepEqual(reopened.hookResolverObservations.filter(row => row.event.event === 'WorktreeCreate'), worktree);
      assert.equal(reopened.events.some(row => row.kind === 'hook_start' && row.event === 'WorktreeRemove'), false);
      assert.equal(listSessions(root).length, 1);
      await runtime.releaseSession!(parent.id);
      await runtime.bindSession!(reopened);
    } finally {
      if (fs.existsSync(ready) && !fs.existsSync(removed)) {
        const fd = fs.openSync(gate, fs.constants.O_WRONLY | fs.constants.O_NONBLOCK);
        fs.writeSync(fd, 'go\n'); fs.closeSync(fd);
      }
      await running?.catch(() => {});
      await runtime.close(); parent.close(); reopened?.close();
    }
    assert.equal(fs.existsSync(`${parent.file}.lock`), false);
  }, async request => {
    if (request.messages.at(-1)?.content === 'invoke') return response([{ type: 'tool_use', id: 'skill-call', name: 'skill', input: { name: 'fixture' } }], 'tool_use');
    childCalls++;
    return response([{ type: 'text', text: 'done' }]);
  });
});

test('skill continuation reloads grants and rejects missing scope', async () => {
  let calls = 0; let executions = 0;
  await fixture(async options => {
    const marker = path.join(options.config.workspace, 'lifecycle-order');
    options.config.hooks = {
      SessionStart: [{ command: `printf 'start\n' >> '${marker}'` }],
      SessionEnd: [{ command: `printf 'end\n' >> '${marker}'` }],
    };
    const file = path.join(options.config.workspace, '.harness/skills/fixture/SKILL.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const write = (rule: string) => fs.writeFileSync(file, `---\nname: fixture\ndescription: Fixture\ncontext: fork\nbackground: true\nallowed-tools: ${rule}\n---\nTask\n`);
    write('Bash(echo *)');
    const definition = loadProjectConfig(options.config.workspace, { paths: [], pluginHooks: 'preview' }).skills.find(item => item.name === 'fixture')!;
    const tool: ToolDefinition = { schema: { name: 'run_command', input_schema: { type: 'object' } }, readOnly: false,
      async execute() { executions++; return 'executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }]; options.config.allowShell = true;
    const registry = new AgentRegistry({ source: options.config, provider: options.provider, tools: options.tools });
    try {
      const child = JSON.parse(await executeSkill(definition, '', { ...options, registry }));
      assert.equal((await registry.get(child.id, { waitMs: 1000 })).status, 'completed');
      assert.equal(fs.readFileSync(marker, 'utf8'), 'start\nend\n');
      write('Bash(printf *)');
      await registry.sendMessage(child.id, 'continue', undefined, { human: true });
      assert.equal((await registry.get(child.id, { waitMs: 1000 })).status, 'completed');
      assert.equal(executions, 0);
      assert.equal(fs.readFileSync(marker, 'utf8'), 'start\nend\nstart\nend\n');
      fs.unlinkSync(path.join(options.config.workspace, '.agent', `${child.id}.forked-skill.json`));
      await registry.sendMessage(child.id, 'again', undefined, { human: true });
      const stopped = await registry.get(child.id, { waitMs: 1000 });
      assert.equal(stopped.status, 'failed'); assert.match(stopped.error ?? '', /scope identity mismatch/);
      assert.equal(fs.readFileSync(marker, 'utf8'), 'start\nend\nstart\nend\n');
      assert.equal(calls, 3);
    } finally { await registry.close(); }
  }, async request => {
    calls++;
    if (calls === 2) return response([{ type: 'tool_use', id: 'restricted', name: 'run_command', input: { command: 'echo stale' } }], 'tool_use');
    if (calls === 3) {
      const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
      assert.equal(result.is_error, true); assert.match(String(result.content), /outside allowed-tools/);
    }
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('cold skill history retains independent identity when both scope files are missing', async () => {
  let calls = 0; let executions = 0;
  await fixture(async options => {
    const tool: ToolDefinition = { schema: { name: 'run_command', input_schema: { type: 'object' } }, readOnly: false,
      async execute() { executions++; return 'executed'; } };
    options.tools = [tool]; options.config.tools = [{ ...tool.schema, eager_input_streaming: true }];
    options.config.allowShell = true;
    const parent = Session.open(options.config.workspace, { config: options.config });
    const createRegistry = () => new AgentRegistry({ source: options.config, parentSessionId: parent.id,
      provider: options.provider, tools: options.tools });
    const first = createRegistry();
    try {
      assert.deepEqual(first.bindHistory(parent), []);
      const descriptor = JSON.parse(await executeSkill(skill({ context: 'fork', background: true,
        allowedTools: ['Bash(echo *)'] }), '', { ...options, parentSessionId: parent.id, registry: first }));
      assert.equal((await first.get(descriptor.id, { waitMs: 1000 })).status, 'completed');
      assert.equal(executions, 0);
      const journal = path.join(path.dirname(parent.file), `${descriptor.id}.jsonl`);
      assert.deepEqual(readSkillScope(journal), { status: 'valid', scope: { skillName: 'fixture', attributionName: 'fixture', skillPath: '/fixture/SKILL.md', hookIdentity: 'null' } });
      assert.equal(readSkillScopeWitness(journal), 'fixture');
      const scopeFile = journal.replace(/\.jsonl$/, '.forked-skill.json');
      const markerFile = journal.replace(/\.jsonl$/, '.forked-skill.marker.json');
      const historyFile = path.join(path.dirname(parent.file), 'subagents', parent.id, `${descriptor.id}.meta.json`);
      assert.equal(JSON.parse(fs.readFileSync(historyFile, 'utf8')).skillName, 'fixture');
      const marker = fs.readFileSync(markerFile, 'utf8');
      fs.writeFileSync(markerFile, JSON.stringify({ forkedSkill: true, skillName: 'other' }));
      const mismatch = createRegistry();
      try {
        assert.match(mismatch.bindHistory(parent).join('\n'), /Child skill scope witness mismatch/);
        assert.equal(mismatch.list().length, 0);
      } finally { await mismatch.close(); }
      fs.writeFileSync(markerFile, marker);
      fs.unlinkSync(scopeFile);
      assert.deepEqual(readSkillScope(journal), { status: 'absent-but-marked' });
      fs.unlinkSync(markerFile);
      assert.deepEqual(readSkillScope(journal), { status: 'absent' });
      await first.close();
      const restored = createRegistry();
      try {
        assert.match(restored.bindHistory(parent).join('\n'), /Child skill scope is missing or malformed/);
        assert.equal(restored.list().some(child => child.id === descriptor.id), false);
        await assert.rejects(restored.sendMessage(descriptor.id, 'continue', undefined, { human: true }), /Unknown child agent/);
        assert.equal(calls, 2); assert.equal(executions, 0);
      } finally { await restored.close(); }
    } finally { await first.close(); parent.close(); }
  }, async request => {
    if (++calls === 1) return response([{ type: 'tool_use', id: 'denied', name: 'run_command', input: { command: 'touch forbidden' } }], 'tool_use');
    const result = (request.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;
    assert.equal(result.is_error, true); assert.match(String(result.content), /outside allowed-tools/);
    return response([{ type: 'text', text: 'Summary' }]);
  });
});

test('real process restart reconstructs skill approvals and enforces current grants', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-restart-')));
  const program = `
    import fs from 'node:fs';
    import path from 'node:path';
    import { defaultConfig } from './src/agent.js';
    import { AgentRegistry } from './src/agent-registry.js';
    import { loadProjectConfig } from './src/config.js';
    import { executeSkill } from './src/skill-runtime.js';
    import { issueHumanSkillAuthorization } from './src/notification-authorization.js';
    import { Session } from './src/session.js';
    const [workspace, phase, parentId] = process.argv.slice(1);
    const tool = { schema: { name: 'run_command', input_schema: { type: 'object' } }, readOnly: false,
      async execute(input) { fs.writeFileSync(path.join(workspace, phase === 'concurrent' ? input.command.split(' ')[1] : 'executed'), 'yes'); return 'executed'; } };
    const config = defaultConfig(workspace, [tool]);
    config.model = 'fixture'; config.allowShell = true;
    config.permissions = { mode: ['revoke', 'tool-revoke', 'hook-change', 'rules-change', 'live-deny', 'concurrent'].includes(phase) ? 'default' : 'bypass', allow: phase === 'allow' ? ['Bash'] : [],
      deny: phase === 'deny' ? ['Bash(echo *)'] : [], ask: ['revoke', 'tool-revoke', 'hook-change', 'rules-change', 'live-deny', 'concurrent'].includes(phase) ? ['Bash'] : [] };
    let calls = 0;
    const provider = { count: async () => 0, complete: async () => ({ id: 'fixture', type: 'message', role: 'assistant', model: 'fixture',
      content: phase !== 'launch' && calls++ < (phase === 'concurrent' ? 2 : 1) ? [{ type: 'tool_use', id: 'use', name: 'run_command', input: { command: phase === 'concurrent' ? (calls === 1 ? 'echo accepted' : 'echo rejected') : 'echo test' } }] : [{ type: 'text', text: 'Summary' }],
      stop_reason: phase !== 'launch' && calls <= (phase === 'concurrent' ? 2 : 1) ? 'tool_use' : 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }) };
    const parent = Session.open(workspace, phase === 'launch' ? { config } : { id: parentId });
    const registry = new AgentRegistry({ source: config, parentSessionId: parent.id, provider, tools: [tool] });
    try {
      if (phase !== 'launch') {
        let revoke = () => {};
        let release;
        const both = new Promise(resolve => { release = resolve; });
        let pending = 0;
        revoke = registry.bindApproval(async (_tool, _input, decision) => {
          if (phase === 'concurrent' && _input.command?.startsWith('echo ')) {
            if (++pending === 2) release();
            await both;
            return { decision: _input.command === 'echo accepted' ? 'allow' : 'deny' };
          }
          if (phase === 'revoke') revoke();
          if (phase === 'tool-revoke' && _input.command === 'echo test') revoke();
          if (phase === 'hook-change') {
            const file = path.join(workspace, '.harness/skills/fixture/SKILL.md');
            fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('hook-home', 'hook-changed'));
          }
          if (phase === 'rules-change') {
            const file = path.join(workspace, '.harness/skills/fixture/SKILL.md');
            fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('allowed-tools: Bash(echo *)', 'allowed-tools: Bash(printf *)'));
          }
          if (phase === 'live-deny') config.permissions.deny = ['Bash(echo *)'];
          return decision.decision === 'ask' ? { decision: 'allow' } : decision;
        });
      }
      const warnings = registry.bindHistory(parent);
      if (phase === 'launch') {
        const definition = loadProjectConfig(workspace, { paths: [], pluginHooks: 'preview' }).skills.find(item => item.name === 'fixture');
        const invoke = () => {
          const signal = new AbortController().signal;
          return executeSkill(definition, '', { config, provider, tools: [tool], signal, session: () => parent,
            humanAuthorization: issueHumanSkillAuthorization(parent, definition.name, '', signal, () => parent.isOpen),
            source: 'user', parentSessionId: parent.id, registry, requestPermission: async () => ({ decision: 'allow' }) });
        };
        const descriptor = JSON.parse(await invoke());
        const result = await registry.get(descriptor.id, { waitMs: 1000 });
        const second = JSON.parse(await invoke());
        await registry.get(second.id, { waitMs: 1000 });
        process.stdout.write(JSON.stringify({ parent: parent.id, child: descriptor.id, status: result.status }));
      } else {
        const children = registry.list();
        if (children.length) {
          if (phase === 'concurrent') {
            await Promise.all(children.slice(0, 2).map(child => registry.sendMessage(child.id, 'continue', undefined, { human: true })));
            await Promise.all(children.slice(0, 2).map(child => registry.get(child.id, { waitMs: 5000 })));
          } else await registry.sendMessage(children[0].id, 'continue', undefined, { human: true });
          const result = await registry.get(children[0].id, { waitMs: 1000 });
          process.stdout.write(JSON.stringify({ warnings, children: children.length, status: result.status, error: result.error }));
        } else process.stdout.write(JSON.stringify({ warnings, children: 0 }));
      }
    } finally { await registry.close(); parent.close(); }
  `;
  const run = (...args: string[]) => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', program, workspace, ...args],
    { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 15000, env: { ...process.env, HOME: path.join(workspace, args[0]!) } }));
  try {
    const file = path.join(workspace, '.harness/skills/fixture/SKILL.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const hooks = { SessionStart: [{ command: `printf '%s' "$HOME" > '${path.join(workspace, 'hook-home')}'` }] };
    fs.writeFileSync(file, `---\nname: fixture\ndescription: Fixture\ncontext: fork\nbackground: true\nallowed-tools: Bash(echo *)\nhooks: ${JSON.stringify(hooks)}\n---\nTask\n`);
    let launched;
    for (const rule of ['allow', 'deny']) {
      launched = run('launch');
      assert.equal(launched.status, 'completed');
      fs.unlinkSync(path.join(workspace, 'hook-home'));
      const restored = run(rule, launched.parent);
      assert.deepEqual(restored.warnings, []);
      assert.equal(restored.children, 2);
      assert.equal(restored.status, 'completed');
      assert.equal(fs.readFileSync(path.join(workspace, 'hook-home'), 'utf8'), path.join(workspace, rule));
      assert.equal(fs.existsSync(path.join(workspace, 'executed')), rule === 'allow');
      fs.rmSync(path.join(workspace, 'executed'), { force: true });
    }
    const original = fs.readFileSync(file, 'utf8');
    for (const scenario of ['revoke', 'tool-revoke', 'hook-change', 'rules-change', 'live-deny']) {
      fs.writeFileSync(file, original);
      launched = run('launch');
      fs.rmSync(path.join(workspace, 'hook-home'), { force: true });
      const restored = run(scenario, launched.parent);
      assert.equal(restored.children, 2);
      assert.equal(fs.existsSync(path.join(workspace, 'executed')), false);
      if (scenario === 'revoke' || scenario === 'hook-change') {
        assert.equal(restored.status, 'failed');
        assert.equal(fs.existsSync(path.join(workspace, 'hook-home')), false);
      } else assert.equal(restored.status, 'completed');
    }
    fs.writeFileSync(file, original);
    launched = run('launch');
    const concurrent = run('concurrent', launched.parent);
    assert.equal(concurrent.children, 2);
    assert.equal(fs.readFileSync(path.join(workspace, 'accepted'), 'utf8'), 'yes');
    assert.equal(fs.existsSync(path.join(workspace, 'rejected')), false);
    const journal = path.join(workspace, '.agent', `${launched.child}.jsonl`);
    fs.unlinkSync(journal.replace(/\.jsonl$/, '.forked-skill.json'));
    fs.unlinkSync(journal.replace(/\.jsonl$/, '.forked-skill.marker.json'));
    const missing = run('missing', launched.parent);
    assert.match(missing.warnings.join('\n'), /scope is missing or malformed/);
    assert.equal(missing.children, 1);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a conditional skill is held out of the catalog until a matching path is touched', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-paths-')));
  try {
    const config = defaultConfig(workspace, []);
    config.skills = [skill({ name: 'greet', description: 'Say hello' })];
    config.heldSkills = [skill({ name: 'scoped', description: 'Scoped', paths: ['src'] })];
    config.system = buildSystem('BASE', [], config.skills);
    const tool = createSkillTool(config);
    assert.match(config.system, /- greet: Say hello/);
    assert.doesNotMatch(config.system, /- scoped:/);
    assert.equal(activateTouchedSkills(config, [path.join(workspace, 'src/a.ts')]).length, 1);
    // The tool captured the catalog array reference, so it sees the new skill.
    assert.deepEqual(config.skills.map(entry => entry.name), ['greet', 'scoped']);
    assert.equal(config.heldSkills, undefined);
    assert.match(config.system, /- scoped: Scoped/);
    assert.match(String(tool.schema.description), /Load an available skill/);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a touched path discovers nested skill directories once and only within the workspace', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dynamic-skills-')));
  try {
    const dir = path.join(workspace, 'nested', '.harness', 'skills', 'local');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: local\ndescription: Local\n---\nLocal body\n');
    const config = defaultConfig(workspace, []);
    config.skills = [skill({ name: 'greet', description: 'Say hello' })];
    config.system = buildSystem('BASE', [], config.skills);
    const loaded = await discoverTouchedSkills(config, [path.join(workspace, 'nested', 'a.ts')]);
    assert.deepEqual(loaded.map(entry => entry.name), ['local']);
    assert.deepEqual(config.skills.map(entry => entry.name), ['greet', 'local']);
    assert.match(config.system, /- local: Local/);
    // Both the nested candidate and the workspace-level candidate are recorded
    // before they are checked, and the nested one was loaded.
    assert.deepEqual(config.dynamicSkillDirs, [
      path.join(workspace, 'nested', '.harness', 'skills'),
      path.join(workspace, '.harness', 'skills'),
    ]);
    // A second touch under the same ancestor does not rescan known directories.
    assert.deepEqual(await discoverTouchedSkills(config, [path.join(workspace, 'nested', 'b.ts')]), []);
    // Paths outside the workspace discover nothing.
    assert.deepEqual(await discoverTouchedSkills(config, ['../outside/a.ts']), []);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a gitignored skills directory is not loaded', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-dynamic-ignored-')));
  try {
    execFileSync('git', ['init', '-q'], { cwd: workspace });
    fs.writeFileSync(path.join(workspace, '.gitignore'), 'nested/\n');
    const dir = path.join(workspace, 'nested', '.harness', 'skills', 'hidden');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: hidden\ndescription: Hidden\n---\nHidden body\n');
    const config = defaultConfig(workspace, []);
    config.skills = [];
    config.system = buildSystem('BASE', [], config.skills);
    assert.deepEqual(await discoverTouchedSkills(config, [path.join(workspace, 'nested', 'a.ts')]), []);
    assert.deepEqual(config.skills, []);
    // The candidate is recorded, so a later touch does not re-check it.
    assert.ok(config.dynamicSkillDirs?.includes(path.join(workspace, 'nested', '.harness', 'skills')));
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
