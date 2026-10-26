import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig, assertPaired } from '../src/agent.js';
import { createTools, type ToolContext, type ToolDefinition } from '../src/tools.js';
import { createInteractionTools } from '../src/interaction-tools.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { permissionDecision, effectivePermissionPolicy } from '../src/permissions.js';
import { planHistoryState, permissionModeCommand } from '../src/plan-resume.js';
import { planReviewChoices } from '../src/plan-mode.js';
import { readPlanFile } from '../src/plan-file.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { forkSession } from '../src/sessions.js';
import { checkpointConversation, previewRewind, applyRewind } from '../src/rewind.js';
import type { ModelProvider } from '../src/provider.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'model-plan-test-')));
const find = (tools: readonly ToolDefinition[], name: string) => { const tool = tools.find(tool => tool.schema.name === name); assert.ok(tool); return tool; };
const context = (session: Session, signal = new AbortController().signal): ToolContext => ({
  workspace: session.config.workspace, signal, allowShell: false, maxOutputBytes: 100000,
  planMode: session.planMode, workingDirectories: readOnly => session.workingDirectories(readOnly),
});
function reply(content: Anthropic.ContentBlock[], stop: 'tool_use' | 'end_turn'): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message', content, stop_reason: stop,
    stop_sequence: null, container: null, diagnostics: null, stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null,
      server_tool_use: null, service_tier: null } };
}

test('model plan transitions affect the next call in a batch and survive cold reopen with exact typed results', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user');
  const tools = [...createTools(), ...createInteractionTools({ sourcePlanTools: true })];
  const config = { ...defaultConfig(workspace, tools), model: 'fixture', configSources: { userDir },
    features: { tasks: false, subagents: false, interaction: true, sourcePlanTools: true },
    permissions: { mode: 'bypass' as const, allow: [], deny: [], ask: [] } };
  let session = Session.open(workspace, { config });
  try {
    const host = session.planMode; assert.ok(host);
    const plan = '# Context\n\nImplement the owned result.\n';
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async request => {
      if (++calls === 1) return reply([
        { type: 'tool_use', id: 'enter', name: 'enter_plan_mode', input: {}, caller: { type: 'direct' } },
        { type: 'tool_use', id: 'blocked', name: 'write_file', input: { path: 'blocked.txt', content: 'absent' }, caller: { type: 'direct' } },
        { type: 'tool_use', id: 'plan', name: 'write_file', input: { path: host.filePath, content: plan }, caller: { type: 'direct' } },
      ], 'tool_use');
      assert.match(String(request.system), /Plan mode is active/);
      const last = request.messages.at(-1)?.content; assert.ok(Array.isArray(last));
      assert.equal(last.find(block => block.type === 'tool_result' && block.tool_use_id === 'blocked')?.type, 'tool_result');
      const blocked = last.find(block => block.type === 'tool_result' && block.tool_use_id === 'blocked');
      assert.ok(blocked?.type === 'tool_result' && blocked.is_error);
      return reply([{ type: 'text', text: 'planned', citations: null }], 'end_turn');
    } };
    await new Agent(session, provider, tools).run('Plan this local task');
    assertPaired(session.messages); assert.equal(calls, 2);
    assert.equal(fs.existsSync(path.join(workspace, 'blocked.txt')), false);
    assert.equal(readPlanFile(workspace, host.filePath), plan);
    assert.equal(session.permissionOwner.state().mode, 'plan');
    assert.equal(planHistoryState(session.events), 'open');
    const id = session.id, original = fs.readFileSync(session.file);
    session.close(); session = Session.open(workspace, { id });
    assert.deepEqual(fs.readFileSync(session.file), original);
    assert.equal(session.permissionOwner.state().mode, 'plan');
    assert.equal(session.planMode?.filePath, host.filePath);
    const exit = find(tools, 'exit_plan_mode');
    const result = await exit.execute({ plan: 'model input must be ignored' }, { ...context(session), interaction: {
      reviewPlan: async review => { assert.equal(review.plan, plan); return { behavior: 'allow', mode: 'acceptEdits', plan: plan + '\nEdited by the reviewer.\n' }; },
    }, hostResult: host => { session.append({ kind: 'tool_result', result: { type: 'tool_result', tool_use_id: 'exit', content: 'approved' }, host }); } });
    assert.match(result, /Approved Plan \(edited by user\)/);
    assert.match(result, /Edited by the reviewer/);
    assert.equal(session.permissionOwner.state().mode, 'acceptEdits');
    assert.equal(session.permissionOwner.state().prePlanMode, undefined);
    assert.equal(planHistoryState(session.events), 'exited');
    assert.equal(planHistoryState([{ kind: 'message', message: { role: 'assistant', content: 'Your plan is approved.' } }]), 'none');
    const stored = session.events.findLast(event => event.kind === 'tool_result');
    assert.ok(stored?.kind === 'tool_result' && stored.host && 'kind' in stored.host && stored.host.kind === 'plan');
    assert.equal(stored.host.planWasEdited, true);
    session.close(); session = Session.open(workspace, { id });
    assert.equal(session.permissionOwner.state().mode, 'acceptEdits');
    assert.equal(readPlanFile(workspace, host.filePath), plan + '\nEdited by the reviewer.\n');
    await assert.rejects(exit.execute({}, context(session)), /not in plan mode/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('plan file capability retains deny and ask priority, stable paths, child authority and failed-review state', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user');
  const tools = [...createTools(), ...createInteractionTools({ sourcePlanTools: true })];
  const config = { ...defaultConfig(workspace, tools), model: 'fixture', configSources: { userDir },
    features: { tasks: false, subagents: false, sourcePlanTools: true },
    permissions: { mode: 'default' as const, allow: [], deny: [], ask: [] } };
  const session = Session.open(workspace, { config });
  try {
    const host = session.planMode; assert.ok(host); host.enter();
    const write = find(tools, 'write_file'), edit = find(tools, 'edit_file'), exit = find(tools, 'exit_plan_mode');
    const input = { path: host.filePath, content: '# Plan\n' };
    assert.equal(permissionDecision(session.config.permissions, write, input).decision, 'allow');
    const projected = effectivePermissionPolicy(session.config.permissions);
    assert.equal(permissionDecision(effectivePermissionPolicy(projected), write, input).decision, 'allow');
    await write.execute(input, context(session));
    await edit.execute({ path: host.filePath, old_string: 'Plan', new_string: 'Local plan' }, context(session));
    assert.equal(readPlanFile(workspace, host.filePath), '# Local plan\n');
    session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' }]);
    assert.equal(permissionDecision(session.config.permissions, write, input).decision, 'deny');
    session.adoptPermissionUpdates([{ type: 'removeRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' },
      { type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'ask', destination: 'session' }]);
    assert.equal(permissionDecision(session.config.permissions, write, input).decision, 'ask');
    assert.equal(permissionDecision(session.config.permissions, write, { ...input, path: path.join(path.dirname(host.filePath), 'other.md') }).decision, 'deny');
    await assert.rejects(write.execute({ ...input, path: path.join(path.dirname(host.filePath), 'other.md') }, context(session)), /escapes/);
    const refused = { ...context(session), interaction: { reviewPlan: async () => ({ behavior: 'deny' as const, feedback: 'Add verification.' }) } };
    await assert.rejects(exit.execute({}, refused), /Add verification/);
    assert.equal(host.mode(), 'plan');
    await assert.rejects(exit.execute({}, context(session)), /host review callback is missing/);
    const controller = new AbortController();
    await assert.rejects(exit.execute({}, { ...context(session, controller.signal), interaction: { reviewPlan: async () => {
      controller.abort(); return { behavior: 'allow', mode: 'bypass' };
    } } }), { name: 'AbortError' });
    assert.equal(host.mode(), 'plan');
    const child = Session.open(workspace, { config: { ...config, childMode: 'general' } });
    try {
      child.inheritPermissions(session.permissionOwner);
      await assert.rejects(find(tools, 'enter_plan_mode').execute({}, context(child)), /Only the main session/);
      await assert.rejects(exit.execute({}, context(child)), /fork cannot exit plan mode/);
      assert.equal(host.mode(), 'plan');
    } finally { child.close(); }
    const beforeBudget = fs.readFileSync(host.filePath);
    await assert.rejects(exit.execute({}, { ...context(session), maxOutputBytes: 1, interaction: { reviewPlan: async () =>
      ({ behavior: 'allow', mode: 'default', plan: 'must not land' }) } }), /output byte limit/);
    assert.deepEqual(fs.readFileSync(host.filePath), beforeBudget); assert.equal(host.mode(), 'plan');
    const saved = fs.readFileSync(host.filePath);
    fs.unlinkSync(host.filePath); fs.symlinkSync(path.join(workspace, 'target.md'), host.filePath);
    assert.equal(permissionDecision(session.config.permissions, edit, { path: host.filePath, old_string: 'x', new_string: 'y' }).decision, 'deny');
    await assert.rejects(edit.execute({ path: host.filePath, old_string: 'x', new_string: 'y' }, context(session)), /symbolic links/);
    fs.unlinkSync(host.filePath); fs.writeFileSync(host.filePath, saved);
    for (const plan of ['a'.repeat(200001), 'x… [+3 graphemes]']) assert.deepEqual(planReviewChoices({ plan, filePath: host.filePath, automaticMode: 'auto' }), []);
    assert.deepEqual(planReviewChoices({ plan: null, filePath: host.filePath, automaticMode: 'bypass' }).map(choice => choice.value), ['default', 'deny']);
    for (const mode of ['default', 'acceptEdits', 'auto', 'bypass'] as const) {
      host.exit(mode); assert.equal(host.mode(), mode); assert.equal(session.permissionOwner.state().prePlanMode, undefined); host.enter();
    }
    fs.unlinkSync(host.filePath);
    assert.match(await exit.execute({}, { ...context(session), interaction: { reviewPlan: async review => {
      assert.equal(review.plan, null); return { behavior: 'allow', mode: 'default' };
    } } }), /approved exiting plan mode/);
    assert.equal(host.mode(), 'default');
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('plan catalogs pin original metadata, reload and managed choices, and keep branch history linked to its plan file', async () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user'); fs.mkdirSync(userDir);
  const managedSettingsFile = path.join(workspace, 'managed.json'); fs.writeFileSync(managedSettingsFile, '{}');
  const provider: ModelProvider = { count: async () => 0, complete: async () => { throw new Error('No model call expected'); } };
  try {
    assert.equal(parseSettings({ features: { sourcePlanTools: false } }).features?.sourcePlanTools, false);
    assert.throws(() => parseSettings({ features: { sourcePlanTools: 'true' } }));
    assert.equal(managedPolicySchema.parse({ features: { sourcePlanTools: false } }).features?.sourcePlanTools, false);
    for (const sourcePlanTools of [undefined, false, true]) {
      const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir, managedSettingsFile },
        permissions: { mode: 'bypass' as const, allow: [], deny: [] },
        features: { tasks: false, subagents: false, interaction: true, ...(sourcePlanTools === undefined ? {} : { sourcePlanTools }) } };
      const runtime = await createRuntime(config, provider, new AbortController().signal);
      config.tools = pinToolSchemas(runtime.tools);
      let session = Session.open(workspace, { config });
      try {
        assert.equal(runtime.tools.some(tool => tool.schema.name === 'enter_plan_mode'), sourcePlanTools === true);
        const id = session.id, original = fs.readFileSync(session.file); session.close();
        fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ features: { sourcePlanTools: true } }));
        session = Session.open(workspace, { id });
        assert.deepEqual(fs.readFileSync(session.file), original);
        assert.equal(session.config.features?.sourcePlanTools, sourcePlanTools);
        assert.equal(reloadConfig(session.config).features?.sourcePlanTools, true);
        fs.writeFileSync(managedSettingsFile, JSON.stringify({ features: { sourcePlanTools: false } }));
        assert.equal(reloadConfig(session.config).features?.sourcePlanTools, false);
        fs.writeFileSync(managedSettingsFile, '{}');
        if (sourcePlanTools === true) {
          session.append({ kind: 'message', message: { role: 'user', content: 'Before plan entry' } });
          session.append({ kind: 'turn_end', reason: 'end_turn' });
          const beforePlan = session.events.length - 1;
          checkpointConversation(session, 'before-plan', new AbortController().signal);
          session.planMode!.enter(); session.append({ kind: 'turn_end', reason: 'planned' });
          let earlier = forkSession(session, beforePlan);
          try {
            earlier.carryPermissions(session);
            earlier.restoreModelPlanMode('prefix');
            assert.equal(earlier.permissionOwner.state().mode, session.config.permissions?.mode);
            assert.equal(earlier.permissionOwner.state().prePlanMode, undefined);
            const id = earlier.id;
            earlier.close(); earlier = Session.open(workspace, { id });
            assert.equal(earlier.permissionOwner.state().mode, session.config.permissions?.mode);
            assert.equal(earlier.events.some(event => event.kind === 'model_plan_mode'), false);
          } finally { earlier.close(); }
          const preview = previewRewind(session, 1, new AbortController().signal);
          let files = applyRewind(session, preview, preview.token, new AbortController().signal);
          try {
            assert.equal(files.permissionOwner.state().mode, 'bypass');
            assert.equal(files.permissionOwner.state().prePlanMode, undefined);
            const id = files.id;
            files.close(); files = Session.open(workspace, { id });
            assert.equal(files.permissionOwner.state().mode, 'bypass');
          } finally { files.close(); }
          const fork = forkSession(session);
          try {
            assert.equal(fork.planMode?.filePath, session.planMode?.filePath);
            assert.equal(fork.permissionOwner.state().mode, 'plan');
          } finally { fork.close(); }
          const rewind = forkSession(session, session.events.length - 1);
          try { assert.equal(rewind.permissionOwner.state().mode, 'plan'); }
          finally { rewind.close(); }
          session.append(permissionModeCommand('permissions', 'default', 'plan'));
        }
      } finally { session.close(); await runtime.close(); }
    }
    const locked = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir },
      features: { tasks: false, subagents: false, sourcePlanTools: true }, managedPolicy: { permissions: { mode: 'plan', allow: [], deny: [] } } } });
    try { assert.throws(() => locked.planMode?.enter(), /pinned by managed/); }
    finally { locked.close(); }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
