import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';

import { Agent, defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { createMediaTools } from '../src/media.js';
import { createNotebookTools } from '../src/notebooks.js';
import { observePermissionPath } from '../src/path-permission-observation.js';
import { resolveChain } from '../src/path-identity.js';
import { contentRuleMatches } from '../src/permission-content.js';
import { permissionDecision, seedPermissionUpdates } from '../src/permissions.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { Session } from '../src/session.js';
import { createTools, type ToolDefinition } from '../src/tools.js';

function workspace(): string {
  const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'leaf-permission-')));
  fs.mkdirSync(path.join(root, '.git'));
  return root;
}

function reply(content: unknown[], stop: 'tool_use' | 'end_turn'): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content,
    stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

class Provider implements ModelProvider {
  private calls = 0;
  constructor(private readonly name: string, private readonly input: unknown) {}
  async count(_request: ModelRequest): Promise<number> { return 1; }
  async complete(_request: ModelRequest): Promise<Anthropic.Message> {
    this.calls += 1;
    return this.calls === 1 ? reply([{ type: 'tool_use', id: 'leaf-call', name: this.name, input: this.input }], 'tool_use')
      : reply([{ type: 'text', text: 'done' }], 'end_turn');
  }
}

function lookup(tools: ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find(item => item.schema.name === name);
  assert.ok(tool);
  return tool;
}

test('write permissions distinguish terminal links from ordinary and ancestor paths', () => {
  const root = workspace();
  try {
    fs.mkdirSync(path.join(root, 'dir'));
    fs.writeFileSync(path.join(root, 'dir', 'file.txt'), 'ORIGINAL');
    fs.symlinkSync('dir/file.txt', path.join(root, 'alias.txt'));
    fs.symlinkSync('missing.txt', path.join(root, 'dangling.txt'));
    fs.symlinkSync('loop.txt', path.join(root, 'loop.txt'));
    fs.symlinkSync('file.txt', path.join(root, 'dir', 'alias.txt'));
    fs.symlinkSync('dir', path.join(root, 'parent'));
    fs.symlinkSync('\u001b[31mdir/file.txt', path.join(root, 'unsafe.txt'));
    assert.equal(resolveChain(root, 'parent/file.txt').leafIsSymlink, false);
    assert.equal(resolveChain(root, 'parent/alias.txt').leafIsSymlink, true);
    assert.equal(resolveChain(root, 'dangling.txt').leafIsSymlink, true);
    const tools = [...createTools(), ...createNotebookTools()];
    const state = seedPermissionUpdates(undefined, root);
    for (const name of ['write_file', 'edit_file', 'notebook_edit']) {
      const tool = lookup(tools, name);
      for (const file of ['alias.txt', 'dangling.txt', 'loop.txt', 'parent/alias.txt', 'unsafe.txt']) {
        const result = permissionDecision(undefined, tool, { path: file }, state);
        assert.equal(result.decision, 'deny', `${name}: ${file}`);
        assert.match(result.reason ?? '', file === 'loop.txt' ? /could not be determined/i : /symbolic link/i);
        assert.doesNotMatch(result.reason ?? '', /\u001b/);
      }
      for (const file of ['dir/file.txt', 'parent/file.txt', 'dir/new.txt']) {
        assert.equal(permissionDecision(undefined, tool, { path: file }, state).decision, 'allow', `${name}: ${file}`);
      }
      const bypass = { mode: 'bypass' as const, allow: [], deny: [], ruleWorkspace: root };
      assert.equal(permissionDecision(bypass, tool, { path: 'alias.txt' }).decision, 'deny');
      const blocked = { ...bypass, deny: [name] };
      assert.equal(permissionDecision(blocked, tool, { path: 'alias.txt' }).reason, `Tool denied by permission rule: ${name}`);
    }
    assert.equal(permissionDecision(undefined, lookup(tools, 'read_file'), { path: 'alias.txt' }, state).decision, 'allow');
    const alternateRoot = workspace();
    try {
      fs.writeFileSync(path.join(alternateRoot, 'target.txt'), 'OTHER');
      fs.symlinkSync('target.txt', path.join(alternateRoot, 'alias.txt'));
      const otherState = seedPermissionUpdates(undefined, root);
      assert.equal(permissionDecision(undefined, lookup(tools, 'write_file'), { path: 'alias.txt' }, otherState, alternateRoot).decision, 'deny');
      assert.equal(permissionDecision(undefined, lookup(tools, 'write_file'), { path: 'dir/file.txt' }, otherState, alternateRoot).decision, 'allow');
    } finally { fs.rmSync(alternateRoot, { recursive: true, force: true }); }
    assert.equal(fs.readFileSync(path.join(root, 'dir', 'file.txt'), 'utf8'), 'ORIGINAL');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('permission checks use the execution workspace and allow invalid names to be rewritten', async () => {
  const parent = workspace(), child = workspace();
  const tools = createTools();
  const write = lookup(tools, 'write_file');
  fs.mkdirSync(path.join(child, 'protected'));
  fs.writeFileSync(path.join(parent, 'alias.txt'), 'PARENT');
  fs.writeFileSync(path.join(child, 'protected', 'data.txt'), 'CHILD');
  fs.symlinkSync('protected/data.txt', path.join(child, 'alias.txt'));
  fs.symlinkSync('protected', path.join(child, 'one'));
  fs.symlinkSync('one', path.join(child, 'two'));
  fs.symlinkSync('loop-b', path.join(child, 'loop-a'));
  fs.symlinkSync('loop-a', path.join(child, 'loop-b'));
  const policy = { mode: 'default' as const, allow: [], deny: ['Read(protected/data.txt)'], ask: ['write_file'], ruleWorkspace: parent };
  const rooted = { ...policy, deny: ['Read(/protected/data.txt)'] };
  const absolute = { ...policy, deny: [`Read(//${path.join(child, 'protected', 'data.txt').slice(1)})`] };
  const intermediate = { ...policy, deny: ['Read(one/data.txt)'] };
  const permissive = { mode: 'ask' as const, allow: ['Read(one/data.txt)'], deny: [], ruleWorkspace: parent };
  const invalid = 'bad�name.txt';
  const answer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: {
    behavior: 'allow', updatedInput: { path: 'safe.txt', content: 'CREATED' },
  } } });
  const session = Session.open(child, { config: { ...defaultConfig(child, tools), model: 'fixture',
    permissions: { mode: 'ask', allow: [], deny: [] },
    hooks: { PermissionRequest: [{ matcher: 'write_file', command: `printf called > hook-called; printf '%s' '${answer}'` }] } } });
  try {
    assert.equal(permissionDecision(policy, write, { path: 'alias.txt' }, undefined, child).decision, 'deny');
    assert.equal(permissionDecision(policy, lookup(tools, 'read_file'), { path: 'alias.txt' }, undefined, child).decision, 'deny');
    for (const name of ['search', 'list_files']) {
      assert.equal(permissionDecision(policy, lookup(tools, name), { path: 'alias.txt' }, undefined, child).decision, 'deny', name);
    }
    assert.equal(permissionDecision(rooted, lookup(tools, 'read_file'), { path: 'alias.txt' }, undefined, child).decision, 'allow');
    assert.equal(permissionDecision(absolute, lookup(tools, 'read_file'), { path: 'alias.txt' }, undefined, child).decision, 'deny');
    assert.equal(permissionDecision(intermediate, lookup(tools, 'read_file'), { path: 'two/data.txt' }, undefined, child).decision, 'deny');
    assert.equal(contentRuleMatches(permissive, 'allow', 'read_file', { path: 'two/data.txt' }, undefined, child), false);
    const both = { ...permissive, allow: ['Read(two/data.txt)', 'Read(protected/data.txt)'] };
    assert.equal(contentRuleMatches(both, 'allow', 'read_file', { path: 'two/data.txt' }, undefined, child), false);
    assert.equal(permissionDecision(undefined, write, { path: invalid }, undefined, child).decision, 'allow');
    assert.equal(permissionDecision({ ...policy, deny: ['write_file'] }, write, { path: 'bad\0name' }, undefined, child).reason,
      'Tool denied by permission rule: write_file');
    assert.equal(permissionDecision(undefined, write, { path: 'loop-a/file' }, undefined, child).decision, 'deny');
    const readers = [...tools, ...createMediaTools(), ...createNotebookTools()];
    for (const name of ['read_file', 'read_media', 'notebook_read', 'search', 'list_files']) {
      assert.equal(permissionDecision(undefined, lookup(readers, name), { path: 'loop-a/file' }, undefined, child).decision, 'deny', name);
    }
    const multiRead: ToolDefinition = { ...lookup(tools, 'read_file'), schema: { ...lookup(tools, 'read_file').schema, name: 'multi_read' },
      readPaths: () => ['loop-a/file'] };
    assert.equal(permissionDecision(undefined, multiRead, {}, undefined, child).decision, 'deny');
    await new Agent(session, new Provider('write_file', { path: invalid, content: 'CREATED' }), tools).run('exercise fixture');
    const result = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'leaf-call');
    assert.ok(result && result.kind === 'tool_result');
    assert.equal(result.result.is_error, undefined, String(result.result.content));
    assert.equal(fs.readFileSync(path.join(child, 'hook-called'), 'utf8'), 'called');
    assert.equal(fs.readFileSync(path.join(child, 'safe.txt'), 'utf8'), 'CREATED');
    assert.equal(fs.existsSync(path.join(child, invalid)), false);
    await assert.rejects(write.execute({ path: invalid, content: 'DIRECT' }, {
      workspace: child, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000,
    }), /replacement character/);
    assert.equal(fs.existsSync(path.join(child, invalid)), false);
    assert.equal(fs.readFileSync(path.join(child, 'protected', 'data.txt'), 'utf8'), 'CHILD');
  } finally {
    session.close();
    fs.rmSync(child, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('a permission hook cannot rewrite an ordinary write to a terminal link', async () => {
  const root = workspace();
  const tools = createTools();
  fs.writeFileSync(path.join(root, 'target.txt'), 'ORIGINAL');
  fs.symlinkSync('target.txt', path.join(root, 'alias.txt'));
  const answer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest',
    decision: { behavior: 'allow', updatedInput: { path: 'alias.txt', content: 'CHANGED', overwrite: true } } } });
  const session = Session.open(root, { config: { ...defaultConfig(root, tools), model: 'fixture',
    permissions: { mode: 'default', allow: [], deny: [], ask: ['write_file'] },
    hooks: { PermissionRequest: [{ command: `printf '%s' '${answer}'` }] } } });
  try {
    const agent = new Agent(session, new Provider('write_file', { path: 'target.txt', content: 'CHANGED', overwrite: true }), tools);
    await agent.run('exercise fixture');
    const result = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'leaf-call');
    assert.ok(result && result.kind === 'tool_result');
    assert.equal(result.result.is_error, true);
    assert.match(String(result.result.content), /symbolic link/i);
    assert.equal(fs.readFileSync(path.join(root, 'target.txt'), 'utf8'), 'ORIGINAL');
    assert.equal(fs.lstatSync(path.join(root, 'alias.txt')).isSymbolicLink(), true);
  } finally {
    session.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('permission hook rewrite retains explicit ask rules and ordinary approvals', async () => {
  for (const scenario of ['rule', 'whole-tool', 'plain', 'unchanged', 'deny', 'mode'] as const) {
    const root = workspace();
    const tools = createTools();
    const target = scenario === 'rule' ? 'asked.txt' : scenario === 'deny' ? 'denied.txt' : 'plain.txt';
    const decision = { behavior: 'allow', ...(scenario === 'unchanged' ? {} : { updatedInput: { path: target, content: 'REWRITTEN\n' } }) };
    const answer = JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } });
    const config = { ...defaultConfig(root, tools), model: 'fixture',
      permissions: { mode: scenario === 'mode' ? 'ask' as const : 'default' as const, allow: [], deny: ['Edit(denied.txt)'],
        ask: scenario === 'whole-tool' ? ['write_file'] : ['Edit(original.txt)', 'Edit(asked.txt)'] },
      hooks: { PermissionRequest: [{ matcher: 'write_file', command: `printf '%s' '${answer}'` }],
        PreToolUse: [{ matcher: 'write_file', command: 'true' }] } };
    const session = Session.open(root, { config });
    try {
      const write = lookup(tools, 'write_file');
      if (scenario !== 'unchanged') {
        const check = permissionDecision(session.config.permissions, write, { path: target, content: 'REWRITTEN\n' }, session.permissionOwner.state(), root);
        assert.equal(check.decision, scenario === 'rule' || scenario === 'whole-tool' || scenario === 'mode' ? 'ask' : scenario === 'deny' ? 'deny' : 'allow');
        if (scenario === 'rule' || scenario === 'whole-tool') assert.equal(check.floor, 'rule');
        if (scenario === 'mode') assert.equal(check.floor, undefined);
      }
      await new Agent(session, new Provider('write_file', { path: 'original.txt', content: 'ORIGINAL\n' }), tools).run('exercise fixture');
      const result = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'leaf-call');
      assert.ok(result && result.kind === 'tool_result');
      const denied = scenario === 'rule' || scenario === 'whole-tool' || scenario === 'deny';
      assert.equal(result.result.is_error === true, denied, scenario);
      if (scenario === 'rule' || scenario === 'whole-tool') assert.match(String(result.result.content), /requires approval by permission rule/);
      assert.equal(session.events.some(event => event.kind === 'hook_start' && event.event === 'PreToolUse'), !denied, scenario);
      const destination = scenario === 'unchanged' ? 'original.txt' : target;
      for (const file of ['original.txt', 'asked.txt', 'plain.txt', 'denied.txt']) {
        const exists = fs.existsSync(path.join(root, file));
        assert.equal(exists, !denied && file === destination, `${scenario}: ${file}`);
        if (exists) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), scenario === 'unchanged' ? 'ORIGINAL\n' : 'REWRITTEN\n');
      }
    } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('isolated child applies parent content rules to its own resolved paths', async () => {
  const parent = workspace(), child = workspace();
  const tools = createTools();
  fs.mkdirSync(path.join(child, 'protected'));
  fs.writeFileSync(path.join(parent, 'alias.txt'), 'PARENT');
  fs.writeFileSync(path.join(child, 'protected', 'data.txt'), 'PROTECTED_FIXTURE');
  fs.symlinkSync('protected/data.txt', path.join(child, 'alias.txt'));
  try {
    for (const deny of [[], ['Read(protected/data.txt)']]) {
      const config = { ...defaultConfig(parent, tools), model: 'fixture',
        permissions: { mode: 'bypass' as const, allow: [], deny, ruleWorkspace: parent } };
      const registry = new AgentRegistry({ source: config, tools,
        provider: new Provider('read_file', { path: 'alias.txt' }), enableAdvanced: true,
        childEnvironmentFactory: async request => ({ config: { ...request.config, workspace: child },
          storageRoot: parent, tools: [...request.tools], close: async () => {} }) });
      try {
        const result = await registry.launch({ prompt: 'exercise fixture', mode: 'general', isolation: 'worktree' }, undefined,
          { config, tools, beforeTool: async () => {} });
        const journal = fs.readFileSync(path.join(parent, '.agent', `${result.session_id}.jsonl`), 'utf8')
          .trim().split('\n').map(line => JSON.parse(line));
        const read = journal.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'leaf-call')?.result;
        assert.ok(read);
        if (deny.length) {
          assert.equal(read.is_error, true);
          assert.equal(String(read.content), 'Tool denied by permission rule: read_file');
          assert.doesNotMatch(String(read.content), /PROTECTED_FIXTURE/);
        } else {
          assert.notEqual(read.is_error, true);
          assert.match(String(read.content), /PROTECTED_FIXTURE/);
        }
      } finally { await registry.close(); }
    }
    assert.equal(fs.readFileSync(path.join(child, 'protected', 'data.txt'), 'utf8'), 'PROTECTED_FIXTURE');
  } finally {
    fs.rmSync(child, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('isolated child resolves unanchored and anchored read rules against their respective roots', async () => {
  const parent = workspace(), child = workspace();
  const tools = createTools();
  fs.mkdirSync(path.join(parent, 'protected'));
  fs.mkdirSync(path.join(child, 'protected'));
  fs.writeFileSync(path.join(parent, 'protected', 'data.txt'), 'PARENT_FIXTURE');
  fs.writeFileSync(path.join(child, 'protected', 'data.txt'), 'CHILD_FIXTURE');
  fs.writeFileSync(path.join(child, 'other.txt'), 'OTHER_FIXTURE');
  try {
    for (const [rule, target, denied, content] of [
      ['', 'protected/data.txt', false, 'CHILD_FIXTURE'],
      ['Read(protected/data.txt)', 'protected/data.txt', true, 'CHILD_FIXTURE'],
      ['Read(/protected/data.txt)', 'protected/data.txt', false, 'CHILD_FIXTURE'],
      ['Read(/protected/data.txt)', path.join(parent, 'protected', 'data.txt'), true, 'PARENT_FIXTURE'],
      [`Read(//${path.join(child, 'protected', 'data.txt').slice(1)})`, 'protected/data.txt', true, 'CHILD_FIXTURE'],
      [`Read(//${path.join(child, 'protected', 'data.txt').slice(1)})`, 'other.txt', false, 'OTHER_FIXTURE'],
    ] as const) {
      const config = { ...defaultConfig(parent, tools), model: 'fixture',
        permissions: { mode: 'bypass' as const, allow: [], deny: rule ? [rule] : [], ruleWorkspace: parent } };
      const registry = new AgentRegistry({ source: config, tools,
        provider: new Provider('read_file', { path: target }), enableAdvanced: true,
        childEnvironmentFactory: async request => ({ config: { ...request.config, workspace: child },
          storageRoot: parent, tools: [...request.tools], close: async () => {} }) });
      try {
        const result = await registry.launch({ prompt: 'exercise fixture', mode: 'general', isolation: 'worktree' }, undefined,
          { config, tools, beforeTool: async () => {} });
        const journal = fs.readFileSync(path.join(parent, '.agent', `${result.session_id}.jsonl`), 'utf8')
          .trim().split('\n').map(line => JSON.parse(line));
        const read = journal.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'leaf-call')?.result;
        assert.ok(read, rule);
        assert.equal(read.is_error === true, denied, rule);
        if (denied) {
          assert.equal(String(read.content), 'Tool denied by permission rule: read_file', rule);
          assert.doesNotMatch(String(read.content), new RegExp(content));
        } else assert.match(String(read.content), new RegExp(content));
      } finally { await registry.close(); }
    }
  } finally {
    fs.rmSync(child, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test('isolated child checks the execution workspace rather than the parent workspace', async () => {
  const parent = workspace(), child = workspace();
  const tools = createTools();
  fs.writeFileSync(path.join(parent, 'alias.txt'), 'PARENT');
  fs.writeFileSync(path.join(child, 'target.txt'), 'CHILD');
  fs.symlinkSync('target.txt', path.join(child, 'alias.txt'));
  const config = { ...defaultConfig(parent, tools), model: 'fixture',
    permissions: { mode: 'bypass' as const, allow: [], deny: [], ruleWorkspace: parent } };
  const provider = new Provider('write_file', { path: 'alias.txt', content: 'CHANGED', overwrite: true });
  const registry = new AgentRegistry({ source: config, tools, provider, enableAdvanced: true,
    childEnvironmentFactory: async request => ({ config: { ...request.config, workspace: child },
      storageRoot: parent, tools: [...request.tools], close: async () => {} }) });
  try {
    const result = await registry.launch({ prompt: 'exercise fixture', mode: 'general', isolation: 'worktree' }, undefined,
      { config, tools, beforeTool: async () => {} });
    const journal = fs.readFileSync(path.join(parent, '.agent', `${result.session_id}.jsonl`), 'utf8')
      .trim().split('\n').map(line => JSON.parse(line));
    const denied = journal.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'leaf-call')?.result;
    assert.equal(denied?.is_error, true);
    assert.match(String(denied?.content), /symbolic link/i);
    assert.equal(fs.readFileSync(path.join(child, 'target.txt'), 'utf8'), 'CHILD');
    assert.equal(fs.readFileSync(path.join(parent, 'alias.txt'), 'utf8'), 'PARENT');
  } finally {
    await registry.close();
    fs.rmSync(child, { recursive: true, force: true });
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("permission checks expand a leading tilde before resolving rules", () => {
  const root = workspace();
  const target = path.join(os.homedir(), 'w385-tilde-control');
  const tool = lookup(createTools(), 'read_file');
  const policy = { mode: 'default' as const, allow: [], deny: [`Read(//${target.slice(1)})`], ruleWorkspace: root };
  assert.equal(permissionDecision(policy, tool, { path: '~/w385-tilde-control' }, undefined, root).decision, 'deny');
});

test('path observations normalize NFD spellings to NFC', () => {
  const root = workspace();
  const nfc = 'caf\u00e9.txt', nfd = nfc.normalize('NFD');
  fs.writeFileSync(path.join(root, nfc), 'fixture');
  const observation = observePermissionPath(root, nfd);
  assert.ok(observation.hostRuleSpellings.length > 0);
  for (const spelling of observation.hostRuleSpellings) assert.equal(spelling, spelling.normalize('NFC'), spelling);
});
