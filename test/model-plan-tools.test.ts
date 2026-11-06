import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig, assertPaired } from '../src/agent.js';
import { createTools, type ToolContext, type ToolDefinition } from '../src/tools.js';
import { createInteractionTools } from '../src/interaction-tools.js';
import { Session, managedPolicySchema } from '../src/session.js';
import { permissionDecision, effectivePermissionPolicy } from '../src/permissions.js';
import { planHistoryState, permissionModeCommand } from '../src/plan-resume.js';
import { planReviewChoices } from '../src/plan-mode.js';
import { ownsPlanPath, planDirectory, readPlanFile } from '../src/plan-file.js';
import { createRuntime, parseSettings, pinToolSchemas } from '../src/runtime.js';
import { reloadConfig } from '../src/reload.js';
import { forkSession } from '../src/sessions.js';
import { checkpointConversation, previewRewind, applyRewind } from '../src/rewind.js';
import { relocateSession } from '../src/workspace-session.js';
import type { ModelProvider } from '../src/provider.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'model-plan-test-')));
const find = (tools: readonly ToolDefinition[], name: string) => { const tool = tools.find(tool => tool.schema.name === name); assert.ok(tool); return tool; };
const context = (session: Session, signal = new AbortController().signal): ToolContext => ({
  workspace: session.config.workspace, signal, allowShell: false, maxOutputBytes: 100000,
  planMode: session.planMode, workingDirectories: readOnly => session.workingDirectories(readOnly),
});

test('session plan ownership recognizes the source main and agent path family', () => {
  const workspace = temporary();
  const config = { ...defaultConfig(workspace, []), model: 'fixture', plansDirectory: 'plans',
    features: { tasks: false, subagents: false, sourcePlanTools: true } };
  const session = Session.open(workspace, { config });
  try {
    const owner = session.planOwnership;
    assert.equal(ownsPlanPath(owner, session.planFilePath), true);
    assert.equal(ownsPlanPath(owner, path.join(owner.directory, `${owner.slug}-agent-other.md`)), true);
    assert.equal(ownsPlanPath(owner, path.join(owner.directory, `${owner.slug}-agent-.md`)), true);
    assert.equal(ownsPlanPath(owner, path.join(owner.directory, `${owner.slug}.workshop.md`)), false);
    assert.equal(ownsPlanPath(owner, path.join(owner.directory, `other-agent-${owner.slug}.md`)), false);
    assert.equal(ownsPlanPath(owner, path.join(workspace, 'other', `${owner.slug}.md`)), false);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('real agent uses plan family and explicit rules override each family member', async () => {
  const workspace = temporary(), tools = [...createTools(), ...createInteractionTools({ sourcePlanTools: true })];
  const config = { ...defaultConfig(workspace, tools), model: 'fixture', plansDirectory: 'plans',
    features: { tasks: false, subagents: false, sourcePlanTools: true },
    permissions: { mode: 'default' as const, allow: [], deny: [], ask: [] } };
  const session = Session.open(workspace, { config });
  try {
    session.planMode!.enter();
    const owner = session.planOwnership, sibling = path.join(owner.directory, `${owner.slug}-agent-sibling.md`);
    const foreign = path.join(owner.directory, `different-agent-sibling.md`);
    const write = find(tools, 'write_file'), read = find(tools, 'read_file');
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return reply([{ type: 'tool_use', id: 'sibling', name: 'write_file', input: { path: sibling, content: 'FAMILY' }, caller: { type: 'direct' } }], 'tool_use');
      if (calls === 2) return reply([{ type: 'tool_use', id: 'family-read', name: 'read_file', input: { path: sibling }, caller: { type: 'direct' } }], 'tool_use');
      return reply([{ type: 'text', text: 'done', citations: null }], 'end_turn');
    } };
    await new Agent(session, provider, tools).run('Use the sibling plan');
    assert.equal(fs.readFileSync(sibling, 'utf8'), 'FAMILY');
    assert.ok(session.events.some(event => event.kind === 'tool_result' && event.result.tool_use_id === 'family-read' && !event.result.is_error));
    assert.equal(permissionDecision(session.config.permissions, write, { path: foreign, content: '' }).decision, 'deny');
    for (const behavior of ['deny', 'ask'] as const) {
      session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'read_file' }, { toolName: 'write_file' }], behavior, destination: 'session' }]);
      assert.equal(permissionDecision(session.config.permissions, write, { path: sibling, content: '' }).decision, behavior);
      assert.equal(permissionDecision(session.config.permissions, read, { path: sibling }).decision, behavior);
      session.adoptPermissionUpdates([{ type: 'removeRules', rules: [{ toolName: 'read_file' }, { toolName: 'write_file' }], behavior, destination: 'session' }]);
    }
    const link = path.join(owner.directory, `${owner.slug}-agent-link.md`);
    fs.symlinkSync(sibling, link);
    assert.equal(permissionDecision(session.config.permissions, read, { path: link }).decision, 'deny');
    await assert.rejects(read.execute({ path: link }, context(session)), /symbolic links/);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('fork copies workshop independently and preserves it across a process restart', () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir },
    plansDirectory: 'plans', features: { tasks: false, subagents: false, sourcePlanTools: true } };
  const source = Session.open(workspace, { config });
  const workshop = (file: string) => file.slice(0, -3) + '.workshop.md';
  try {
    const main = source.planMode!.filePath, sibling = workshop(main);
    fs.mkdirSync(path.dirname(main), { recursive: true });
    fs.writeFileSync(sibling, 'workshop 内容\n');
    let fork = forkSession(source);
    const id = fork.id, copied = workshop(fork.planMode!.filePath);
    assert.equal(fs.readFileSync(copied, 'utf8'), 'workshop 内容\n');
    assert.equal(fs.existsSync(fork.planMode!.filePath), false);
    fork.close();
    const script = `import { Session } from './src/session.ts'; import fs from 'node:fs'; const s=Session.open(process.argv[1],{id:process.argv[2]}); try { process.stdout.write(fs.readFileSync(s.planMode.filePath.slice(0,-3)+'.workshop.md','utf8')); } finally { s.close(); }`;
    assert.equal(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, workspace, id], { cwd: process.cwd(), encoding: 'utf8' }), 'workshop 内容\n');
    const bytes = Buffer.from([0xff, 0x00, 0x80, 0x0a]);
    fs.writeFileSync(sibling, bytes);
    fork = forkSession(source);
    try { assert.deepEqual(fs.readFileSync(workshop(fork.planMode!.filePath)), bytes); }
    finally { fork.close(); }
    fs.unlinkSync(sibling);
    fs.writeFileSync(main, 'main survives');
    fs.symlinkSync(main, sibling);
    fork = forkSession(source);
    try {
      assert.equal(fs.readFileSync(fork.planMode!.filePath, 'utf8'), 'main survives');
      assert.equal(fs.existsSync(workshop(fork.planMode!.filePath)), false);
    } finally { fork.close(); }
    const rewind = forkSession(source, 0);
    try { assert.equal(fs.existsSync(workshop(rewind.planMode!.filePath)), false); }
    finally { rewind.close(); }
  } finally { source.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('fork copies plans while plan tools are disabled and preserves them on cold open', () => {
  const workspace = temporary(), userDir = path.join(workspace, 'user');
  fs.mkdirSync(userDir);
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir },
    plansDirectory: 'plans', features: { tasks: false, subagents: false, sourcePlanTools: false } };
  const source = Session.open(workspace, { config });
  try {
    assert.equal(source.planMode, undefined);
    const main = source.planFilePath, sibling = main.slice(0, -3) + '.workshop.md';
    fs.mkdirSync(path.dirname(main), { recursive: true });
    fs.writeFileSync(main, 'disabled main\n');
    fs.writeFileSync(sibling, 'disabled workshop\n');
    const fork = forkSession(source);
    const id = fork.id, copied = fork.planFilePath;
    try {
      assert.equal(fork.planMode, undefined);
      assert.equal(fs.readFileSync(copied, 'utf8'), 'disabled main\n');
      assert.equal(fs.readFileSync(copied.slice(0, -3) + '.workshop.md', 'utf8'), 'disabled workshop\n');
    } finally { fork.close(); }
    const script = `import { Session } from './src/session.ts'; import fs from 'node:fs'; const s=Session.open(process.argv[1],{id:process.argv[2]}); try { if(s.planMode!==undefined) throw Error('plan tools enabled'); process.stdout.write(JSON.stringify([fs.readFileSync(s.planFilePath,'utf8'),fs.readFileSync(s.planFilePath.slice(0,-3)+'.workshop.md','utf8')])); } finally { s.close(); }`;
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script, workspace, id], { cwd: process.cwd(), encoding: 'utf8' })), ['disabled main\n', 'disabled workshop\n']);
    fs.unlinkSync(main); fs.unlinkSync(sibling);
    const empty = forkSession(source);
    try {
      assert.equal(fs.existsSync(empty.planFilePath), false);
      assert.equal(fs.existsSync(empty.planFilePath.slice(0, -3) + '.workshop.md'), false);
    } finally { empty.close(); }
  } finally { source.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
function reply(content: Anthropic.ContentBlock[], stop: 'tool_use' | 'end_turn'): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', role: 'assistant', type: 'message', content, stop_reason: stop,
    stop_sequence: null, container: null, diagnostics: null, stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null,
      server_tool_use: null, service_tier: null } };
}

test('configured plan directory validates real paths and survives session reload', () => {
  const workspace = temporary(), outside = temporary(), userDir = path.join(outside, 'user');
  fs.mkdirSync(userDir);
  fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ plansDirectory: 'plans/nested' }));
  fs.symlinkSync(outside, path.join(workspace, 'escape'));
  try {
    assert.equal(planDirectory(workspace, 'plans/nested'), path.join(workspace, 'plans/nested'));
    assert.equal(planDirectory(workspace, '../outside'), undefined);
    assert.equal(planDirectory(workspace, 'escape/plans'), undefined);
    const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir }, plansDirectory: 'plans/nested', features: { tasks: false, subagents: false, sourcePlanTools: true } };
    let session = Session.open(workspace, { config });
    const id = session.id;
    try {
      const file = session.planMode!.filePath;
      assert.equal(path.dirname(file), path.join(workspace, 'plans/nested'));
      session.close(); session = Session.open(workspace, { id });
      assert.equal(session.planMode!.filePath, file);
      fs.writeFileSync(path.join(userDir, 'settings.json'), JSON.stringify({ plansDirectory: 'next' }));
      const refreshed = reloadConfig(session.config);
      assert.equal(refreshed.plansDirectory, 'next');
    } finally { session.close(); }
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
});

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

test('relocated plan file uses the execution workspace and retains rule priority', async () => {
  const root = temporary(), parent = path.join(root, 'parent'), child = path.join(parent, 'child');
  fs.mkdirSync(parent); fs.mkdirSync(child);
  const tools = [...createTools(), ...createInteractionTools({ sourcePlanTools: true })];
  const config = { ...defaultConfig(parent, tools), model: 'fixture', configSources: { userDir: path.join(child, 'user') },
    features: { tasks: false, subagents: false, sourcePlanTools: true },
    permissions: { mode: 'default' as const, allow: [], deny: [], ask: [], ruleWorkspace: parent } };
  const source = Session.open(parent, { config });
  let session: Session | undefined;
  try {
    session = relocateSession(source, child, () => tools);
    const host = session.planMode; assert.ok(host); host.enter();
    assert.equal(session.permissionOwner.state().ruleWorkspace, parent);
    const relative = path.relative(child, host.filePath);
    const input = { path: relative, content: '# PLAN FIXTURE\n' };
    const write = find(tools, 'write_file'), edit = find(tools, 'edit_file'), read = find(tools, 'read_file');
    const decide = (tool: ToolDefinition, value: unknown) =>
      permissionDecision(session!.config.permissions, tool, value, session!.permissionOwner.state(), child).decision;
    assert.equal(decide(write, input), 'allow');
    assert.equal(decide(write, { ...input, path: host.filePath }), 'allow');
    assert.equal(permissionDecision(session.config.permissions, write, { ...input, path: host.filePath }, session.permissionOwner.state()).decision, 'allow');
    assert.equal(permissionDecision(session.config.permissions, write, { ...input, path: path.relative(parent, host.filePath) }, session.permissionOwner.state()).decision, 'allow');
    assert.equal(permissionDecision(session.config.permissions, write, input, session.permissionOwner.state()).decision, 'deny');
    const stalePolicy = { ...session.config.permissions!, ruleWorkspace: child };
    assert.equal(permissionDecision(stalePolicy, write, input, session.permissionOwner.state()).decision, 'deny');
    assert.equal(permissionDecision(stalePolicy, write, input, session.permissionOwner.state(), child).decision, 'allow');
    assert.equal(decide(write, { ...input, path: path.join(path.dirname(relative), 'other.md') }), 'deny');
    const addRule = (toolName: string, ruleContent: string | undefined, behavior: 'deny' | 'ask') => {
      session!.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName, ...(ruleContent === undefined ? {} : { ruleContent }) }], behavior, destination: 'session' }]);
    };
    const removeRule = (toolName: string, ruleContent: string | undefined, behavior: 'deny' | 'ask') => {
      session!.adoptPermissionUpdates([{ type: 'removeRules', rules: [{ toolName, ...(ruleContent === undefined ? {} : { ruleContent }) }], behavior, destination: 'session' }]);
    };
    addRule('write_file', undefined, 'deny'); assert.equal(decide(write, input), 'deny');
    removeRule('write_file', undefined, 'deny');
    addRule('write_file', undefined, 'ask'); assert.equal(decide(write, input), 'ask');
    removeRule('write_file', undefined, 'ask');
    const oldRootPattern = '/user/plans/**';
    addRule('Write', oldRootPattern, 'deny');
    assert.equal(decide(write, input), 'allow');
    removeRule('Write', oldRootPattern, 'deny');
    const actualRootPattern = `/${path.relative(parent, host.filePath).split(path.sep).join('/')}`;
    addRule('Write', actualRootPattern, 'deny');
    assert.equal(decide(write, input), 'deny');
    removeRule('Write', actualRootPattern, 'deny');
    let calls = 0;
    const provider: ModelProvider = { count: async () => 0, complete: async () => {
      calls++;
      if (calls === 1) return reply([{ type: 'tool_use', id: 'relative-plan', name: 'write_file', input, caller: { type: 'direct' } }], 'tool_use');
      if (calls === 2) return reply([{ type: 'tool_use', id: 'read-relative-plan', name: 'read_file', input: { path: relative }, caller: { type: 'direct' } }], 'tool_use');
      return reply([{ type: 'text', text: 'planned', citations: null }], 'end_turn');
    } };
    await new Agent(session, provider, tools).run('Write the current plan');
    const written = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'relative-plan');
    assert.ok(written?.kind === 'tool_result'); assert.notEqual(written.result.is_error, true);
    const readResult = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'read-relative-plan');
    assert.ok(readResult?.kind === 'tool_result'); assert.notEqual(readResult.result.is_error, true);
    assert.match(JSON.stringify(readResult.result.content), /PLAN FIXTURE/);
    assert.equal(fs.readFileSync(host.filePath, 'utf8'), input.content);
    const editInput = { path: relative, old_string: 'PLAN', new_string: 'LOCAL PLAN' };
    assert.equal(decide(read, { path: relative }), 'allow');
    assert.match(await read.execute({ path: relative }, context(session)), /PLAN FIXTURE/);
    assert.equal(decide(edit, editInput), 'allow');
    await edit.execute(editInput, context(session));
    assert.equal(fs.readFileSync(host.filePath, 'utf8'), '# LOCAL PLAN FIXTURE\n');
    fs.unlinkSync(host.filePath); fs.symlinkSync(path.join(root, 'target.md'), host.filePath);
    assert.equal(decide(read, { path: relative }), 'deny');
    assert.equal(decide(write, input), 'deny');
    assert.equal(decide(edit, editInput), 'deny');
    await assert.rejects(read.execute({ path: relative }, context(session)), /symbolic links/);
    await assert.rejects(write.execute(input, context(session)), /symbolic links/);
    await assert.rejects(edit.execute(editInput, context(session)), /symbolic links/);
  } finally { session?.close(); source.close(); fs.rmSync(root, { recursive: true, force: true }); }
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
          fs.mkdirSync(path.dirname(session.planMode!.filePath), { recursive: true });
          fs.writeFileSync(session.planMode!.filePath, 'parent plan');
          let fork = forkSession(session);
          try {
            assert.notEqual(fork.planMode?.filePath, session.planMode?.filePath);
            assert.equal(fs.readFileSync(fork.planMode!.filePath, 'utf8'), 'parent plan');
            const forkId = fork.id, forkFile = fork.planMode!.filePath;
            fork.close(); fork = Session.open(workspace, { id: forkId });
            assert.equal(fork.planMode?.filePath, forkFile);
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
