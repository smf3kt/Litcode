import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyPermissionUpdates, emptySessionPermissionUpdates, permissionDecision, permissionError, permissionPolicySchema,
  permissionUpdateListSchema, PERMISSION_UPDATES_UNAPPLIED, type PermissionPolicy, type SessionPermissionUpdates } from '../src/permissions.js';
import type { ToolDefinition } from '../src/tools.js';

function tool(name: string, readOnly = true): ToolDefinition {
  return { schema: { name, description: 'fixture', input_schema: { type: 'object', properties: {} } }, readOnly, execute: async () => 'fixture' };
}
function policy(overrides: Partial<PermissionPolicy> = {}): PermissionPolicy {
  return { mode: 'default', allow: [], deny: [], ...overrides };
}
function decide(current: PermissionPolicy | undefined, name: string, readOnly = true, input: unknown = {}) {
  return permissionDecision(current, tool(name, readOnly), input);
}

test('policy schema preserves old sessions without adding optional fields or defaults', () => {
  const old = { mode: 'acceptEdits', allow: ['read_*'], deny: ['run_command'] };
  assert.deepEqual(permissionPolicySchema.parse(old), old);
  assert.deepEqual(Object.keys(permissionPolicySchema.parse(old)).sort(), ['allow', 'deny', 'mode']);
  assert.equal(permissionPolicySchema.safeParse(undefined).success, false);
  assert.equal(permissionPolicySchema.safeParse({ allow: [], deny: [] }).success, false);
});

test('legacy name-only matcher retains newline behavior with default classifier', () => {
  const current = policy({ deny: ['read_*'] });
  assert.equal(permissionError(current, tool('read_\nfile')), undefined);
  assert.deepEqual(decide(current, 'read_\nfile'), { decision: 'allow' });
});

test('policy schema admits new modes and strict input-aware rules', () => {
  for (const mode of ['default', 'plan', 'acceptEdits', 'bypass', 'ask'] as const) {
    const current = policy({ mode, ask: ['mcp_*'], inputRules: [
      { tool: 'read_file', path: 'private/*', decision: 'deny' },
      { tool: 'run_command', command: 'git status*', decision: 'allow' },
      { tool: '*', path: '*', command: '*', decision: 'ask' },
    ] });
    assert.deepEqual(permissionPolicySchema.parse(current), current);
  }
  for (const invalid of [
    policy({ mode: 'other' as any }), { ...policy(), unexpected: true },
    { ...policy(), inputRules: [{ tool: '*', decision: 'unknown' }] },
    { ...policy(), inputRules: [{ tool: '*', decision: 'allow', hidden: true }] },
    { ...policy(), inputRules: [{ tool: '*', path: 1, decision: 'allow' }] },
    { ...policy(), ask: [4] }, { ...policy(), allow: ['x'.repeat(4097)] },
    { ...policy(), deny: Array.from({ length: 1025 }, () => '*') },
  ]) assert.equal(permissionPolicySchema.safeParse(invalid).success, false);
});

test('legacy permissionError keeps exact name-only behavior and error messages', () => {
  assert.equal(permissionError(undefined, tool('write_file', false)), undefined);
  assert.equal(permissionError(policy(), tool('run_command', false)), undefined);
  assert.equal(permissionError(policy({ mode: 'acceptEdits' }), tool('run_command', false)), undefined);
  assert.equal(permissionError(policy({ deny: ['read_*'] }), tool('read_file')), 'Tool denied by permission rule: read_file');
  assert.equal(permissionError(policy({ mode: 'plan' }), tool('write_file', false)), 'Plan mode permits read-only tools: write_file');
  assert.equal(permissionError(policy({ allow: ['read_file'] }), tool('write_file', false)), 'Tool is outside the allow list: write_file');
  assert.equal(permissionError(policy({ ask: ['*'] }), tool('write_file', false)), undefined);
  assert.equal(permissionError(policy({ inputRules: [{ tool: '*', decision: 'deny' }] }), tool('read_file')), undefined);
});

test('undefined and default legacy policies allow existing writes and shell', () => {
  for (const name of ['read_file', 'write_file', 'run_command', 'mcp_custom']) {
    assert.deepEqual(decide(undefined, name, false), { decision: 'allow' });
    assert.deepEqual(decide(policy(), name, false), { decision: 'allow' });
  }
});

test('explicit deny dominates allows, asks, bypass and input allow', () => {
  for (const mode of ['default', 'ask', 'acceptEdits', 'bypass', 'plan'] as const) {
    const current = policy({ mode, deny: ['run_*'], allow: ['*'], ask: ['*'], inputRules: [{ tool: '*', decision: 'allow' }] });
    const result = decide(current, 'run_command', false, { command: 'git status' });
    assert.equal(result.decision, 'deny');
    assert.equal(result.reason, 'Tool denied by permission rule: run_command');
  }
});

test('matching input deny dominates asks and other matching input allows regardless of order', () => {
  for (const reverse of [false, true]) {
    const rules: NonNullable<PermissionPolicy['inputRules']> = [
      { tool: 'write_file', path: '*', decision: 'allow' },
      { tool: 'write_file', path: 'private/*', decision: 'deny' },
      { tool: 'write_file', path: '*', decision: 'ask' },
    ];
    const current = policy({ mode: 'bypass', inputRules: reverse ? rules.reverse() : rules });
    assert.equal(decide(current, 'write_file', false, { path: 'private/key.txt' }).decision, 'deny');
    assert.equal(decide(current, 'write_file', false, { path: 'public/readme.md' }).decision, 'ask');
  }
});

test('plan mode denies mutations before allow or ask rules and permits read-only', () => {
  assert.equal(decide(policy({ mode: 'plan', ask: ['*'], allow: ['*'] }), 'write_file', false).decision, 'deny');
  assert.equal(decide(policy({ mode: 'plan', inputRules: [{ tool: '*', decision: 'allow' }] }), 'write_file', false).decision, 'deny');
  assert.deepEqual(decide(policy({ mode: 'plan' }), 'read_file'), { decision: 'allow' });
  assert.equal(decide(policy({ mode: 'plan', ask: ['read_file'] }), 'read_file').decision, 'ask');
});

test('allow-list boundary remains deny and explicit input allow grants only matching inputs', () => {
  const current = policy({ mode: 'ask', allow: ['read_file'], ask: ['write_file'], inputRules: [{ tool: 'write_file', path: 'docs/*', decision: 'allow' }] });
  assert.equal(decide(current, 'write_file', false, { path: 'src/file.ts' }).decision, 'deny');
  assert.equal(decide(current, 'write_file', false, { path: 'docs/file.md' }).decision, 'ask');
  assert.equal(decide({ ...current, ask: [] }, 'write_file', false, { path: 'docs/file.md' }).decision, 'allow');
  assert.equal(decide(policy({ mode: 'bypass', allow: ['read_file'] }), 'write_file', false).decision, 'deny');
});

test('ask rules dominate mode and allow rules and can ask read-only tools', () => {
  assert.equal(decide(policy({ mode: 'bypass', ask: ['read_*'], allow: ['*'] }), 'read_file').decision, 'ask');
  assert.equal(decide(policy({ inputRules: [{ tool: 'read_file', path: 'private/*', decision: 'ask' }] }), 'read_file', true, { path: 'private/a' }).decision, 'ask');
  assert.deepEqual(decide(policy({ ask: ['write_*'] }), 'read_file'), { decision: 'allow' });
});

test('ask mode asks mutations and known shell even when tool claims read-only', () => {
  const current = policy({ mode: 'ask' });
  assert.deepEqual(decide(current, 'read_file'), { decision: 'allow' });
  assert.deepEqual(decide(current, 'web_fetch'), { decision: 'allow' });
  assert.equal(decide(current, 'write_file', false).decision, 'ask');
  assert.equal(decide(current, 'run_command', false).decision, 'ask');
  assert.equal(decide(current, 'run_command', true).decision, 'ask');
  assert.equal(decide(current, 'run_background', true).decision, 'ask');
  assert.equal(decide(current, 'monitor', true, { command: 'printf hello' }).decision, 'ask');
  assert.equal(decide(current, 'mcp_mutation', false).decision, 'ask');
  assert.deepEqual(decide(policy({ mode: 'ask', allow: ['write_file'] }), 'write_file', false), { decision: 'allow' });
});

test('acceptEdits allows local editing but asks shell and other mutations', () => {
  const current = policy({ mode: 'acceptEdits' });
  for (const name of ['write_file', 'edit_file', 'notebook_edit', 'memory_write', 'memory_delete', 'lsp_edit']) {
    assert.deepEqual(decide(current, name, false), { decision: 'allow' });
  }
  assert.deepEqual(decide(current, 'read_file'), { decision: 'allow' });
  for (const name of ['run_command', 'run_background', 'mcp_mutation', 'checkpoint_restore']) {
    assert.equal(decide(current, name, false).decision, 'ask');
  }
  assert.equal(decide(current, 'run_command', true).decision, 'ask');
  assert.equal(decide(current, 'monitor', true, { command: 'id' }).decision, 'ask');
});

test('bypass allows default actions while preserving explicit denies and asks', () => {
  const current = policy({ mode: 'bypass' });
  assert.deepEqual(decide(current, 'run_command', false), { decision: 'allow' });
  assert.deepEqual(decide(current, 'custom', false), { decision: 'allow' });
  assert.equal(decide({ ...current, deny: ['custom'] }, 'custom', false).decision, 'deny');
  assert.equal(decide({ ...current, ask: ['custom'] }, 'custom', false).decision, 'ask');
});

test('input path and command selectors require own string values and both must match', () => {
  const current = policy({ inputRules: [{ tool: 'custom', path: 'docs/*', command: 'git *', decision: 'deny' }] });
  assert.equal(decide(current, 'custom', false, { path: 'docs/a', command: 'git status' }).decision, 'deny');
  for (const input of [
    { path: 'docs/a', command: 'npm test' }, { path: 'src/a', command: 'git status' },
    { path: 'docs/a' }, { command: 'git status' }, { path: 1, command: 'git status' },
    { file: 'docs/a', command: 'git status' }, { name: 'docs/a', command: 'git status' },
    null, [], 'docs/a', Object.create({ path: 'docs/a', command: 'git status' }),
  ]) assert.deepEqual(decide(current, 'custom', false, input), { decision: 'allow' });
});

test('permission matching does not execute input getters', () => {
  let calls = 0;
  const input = Object.defineProperty({}, 'path', { get: () => { calls++; throw new Error('getter evaluated'); } });
  assert.deepEqual(decide(policy({ inputRules: [{ tool: '*', path: '*', decision: 'deny' }] }), 'read_file', true, input), { decision: 'allow' });
  assert.equal(calls, 0);
});

test('wildcards match only complete strings with all regexp syntax treated literally', () => {
  const patterns = ['tool[1]', 'tool?', 'tool.+', 'tool(a|b)', 'tool\\path', '^tool$', 'a{2}'];
  for (const literal of patterns) {
    assert.equal(decide(policy({ deny: [literal] }), literal).decision, 'deny');
    assert.equal(decide(policy({ deny: [literal] }), literal + 'tail').decision, 'allow');
  }
  for (const name of ['read_file', 'read_', 'read_a_b', 'read_世界']) {
    assert.equal(decide(policy({ deny: ['read_*'] }), name).decision, 'deny');
  }
  assert.equal(decide(policy({ deny: ['read_*'] }), 'prefixread_file').decision, 'allow');
  assert.equal(decide(policy({ deny: ['a**b*c'] }), 'axybzbc').decision, 'deny');
  assert.equal(decide(policy({ deny: ['*'] }), '').decision, 'deny');
  assert.equal(decide(policy({ deny: [''] }), '').decision, 'deny');
  assert.equal(decide(policy({ deny: [''] }), 'tool').decision, 'allow');
});

test('command wildcards support multiline strings without interpreting shell syntax', () => {
  const current = policy({ inputRules: [{ tool: 'run_command', command: 'git *', decision: 'ask' }] });
  assert.equal(decide(current, 'run_command', false, { command: 'git status\nprintf hello' }).decision, 'ask');
  const exact = policy({ inputRules: [{ tool: '*', command: 'echo $(id); [a]?', decision: 'deny' }] });
  assert.equal(decide(exact, 'run_command', false, { command: 'echo $(id); [a]?' }).decision, 'deny');
  assert.equal(decide(exact, 'run_command', false, { command: 'echo id; a1' }).decision, 'allow');
});

test('many repeated wildcard segments avoid pathological regexp backtracking', () => {
  const current = policy({ deny: ['*a'.repeat(100) + 'z'] });
  const started = Date.now();
  assert.equal(decide(current, 'a'.repeat(2000)).decision, 'allow');
  assert.ok(Date.now() - started < 1000);
});

test('classification re-evaluates hook-updated tool inputs against denies', () => {
  const current = policy({ inputRules: [{ tool: 'write_file', path: 'private/*', decision: 'deny' }] });
  assert.equal(decide(current, 'write_file', false, { path: 'docs/readme.md' }).decision, 'allow');
  assert.equal(decide(current, 'write_file', false, { path: 'private/token' }).decision, 'deny');
});

test('permission update schema admits the source union and normalizes the retired mode name', () => {
  assert.deepEqual(permissionUpdateListSchema.parse([
    { type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'allow', destination: 'session' },
    { type: 'replaceRules', rules: [{ toolName: 'read_file', ruleContent: 'docs/*' }], behavior: 'deny', destination: 'localSettings' },
    { type: 'removeRules', rules: [{ toolName: 'x' }], behavior: 'ask', destination: 'cliArg' },
    { type: 'setMode', mode: 'manual', destination: 'userSettings' },
    { type: 'addDirectories', directories: ['/tmp'], destination: 'projectSettings' },
    { type: 'removeDirectories', directories: ['/tmp'], destination: 'session' },
  ])[3], { type: 'setMode', mode: 'default', destination: 'userSettings' });
  for (const bad of [[{ type: 'allow', tool: 'read_file' }], [{ type: 'setMode', mode: 'turbo', destination: 'session' }],
    [{ type: 'addRules', rules: [{ toolName: 1 }], behavior: 'allow', destination: 'session' }],
    [{ type: 'addRules', rules: [], behavior: 'always', destination: 'session' }]]) {
    assert.equal(permissionUpdateListSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test('permission updates: session rules join the settings rules and satisfy the allow list', () => {
  const empty = emptySessionPermissionUpdates();
  assert.equal(permissionDecision(undefined, tool('write_file', false), {}, empty).decision, 'allow');
  const denied = applyPermissionUpdates(empty, [
    { type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' },
  ]).state;
  assert.equal(permissionDecision(undefined, tool('write_file', false), {}, denied).decision, 'deny');
  assert.equal(permissionDecision(undefined, tool('read_file'), {}, denied).decision, 'allow');
  // A session allow satisfies a settings allow list that would otherwise close.
  const locked = policy({ allow: ['read_file'] });
  assert.equal(decide(locked, 'write_file', false).decision, 'deny');
  const allowed: SessionPermissionUpdates = { ...empty, allow: ['write_file'] };
  assert.equal(permissionDecision(locked, tool('write_file', false), {}, allowed).decision, 'allow');
  // A settings deny still dominates a session allow.
  const blocked: SessionPermissionUpdates = { ...empty, allow: ['write_file'] };
  assert.equal(permissionDecision(policy({ deny: ['write_file'] }), tool('write_file', false), {}, blocked).decision, 'deny');
  // A session ask makes an otherwise allowed tool ask.
  const asked: SessionPermissionUpdates = { ...empty, ask: ['read_file'] };
  assert.equal(permissionDecision(undefined, tool('read_file'), {}, asked).decision, 'ask');
});

test('permission updates: mode, content, replace and remove reach consumers', () => {
  const empty = emptySessionPermissionUpdates();
  const planned = applyPermissionUpdates(empty, [{ type: 'setMode', mode: 'plan', destination: 'session' }]).state;
  assert.equal(planned.mode, 'plan');
  assert.equal(permissionDecision(undefined, tool('write_file', false), {}, planned).decision, 'deny');
  assert.equal(permissionDecision(undefined, tool('read_file'), {}, planned).decision, 'allow');
  const replaced = applyPermissionUpdates(planned, [
    { type: 'replaceRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' },
    { type: 'replaceRules', rules: [{ toolName: 'read_file' }], behavior: 'deny', destination: 'session' },
  ]).state;
  assert.deepEqual(replaced.deny, ['read_file']);
  const removed = applyPermissionUpdates(replaced, [
    { type: 'removeRules', rules: [{ toolName: 'read_file' }], behavior: 'deny', destination: 'session' },
  ]).state;
  assert.deepEqual(removed.deny, []);
  const refused = applyPermissionUpdates(empty, [
    { type: 'addRules', rules: [{ toolName: 'write_file', ruleContent: 'private/*' }], behavior: 'deny', destination: 'session' },
  ]);
  assert.equal(refused.blocked, undefined);
  assert.equal(permissionDecision(undefined, tool('write_file', false), { path: 'private/a' }, refused.state).decision, 'deny');
  const dropped = applyPermissionUpdates(empty, [
    { type: 'addRules', rules: [{ toolName: 'write_file', ruleContent: 'docs/*' }], behavior: 'allow', destination: 'session' },
    { type: 'addDirectories', directories: ['/tmp'], destination: 'session' },
  ]);
  assert.equal(dropped.blocked, undefined);
  assert.deepEqual(dropped.dropped, []);
  assert.deepEqual([...dropped.state.additionalWorkingDirectories], [['/tmp', { path: '/tmp', source: 'session' }]]);
  assert.deepEqual(dropped.state.allow, ['write_file(docs/*)']);
  const unsupported = applyPermissionUpdates(empty, [{ type: 'setMode', mode: 'dontAsk', destination: 'session' }]);
  assert.deepEqual(unsupported.dropped, []);
  assert.equal(unsupported.state.mode, 'dontAsk');
  assert.equal(permissionDecision(undefined, tool('write_file', false), {}, unsupported.state).decision, 'deny');
  const allowed = applyPermissionUpdates(unsupported.state, [{ type: 'addRules', behavior: 'allow', destination: 'session',
    rules: [{ toolName: 'Bash', ruleContent: 'printf:*' }] }]).state;
  assert.equal(permissionDecision(undefined, tool('run_command', false), { command: 'printf hello' }, allowed).decision, 'allow');
  assert.equal(permissionDecision(undefined, tool('run_command', false), { command: 'printf hello; touch secret' }, allowed).decision, 'deny');
  const asked = applyPermissionUpdates(allowed, [{ type: 'addRules', behavior: 'ask', destination: 'session',
    rules: [{ toolName: 'Bash', ruleContent: 'printf secret' }] }]).state;
  assert.equal(permissionDecision(undefined, tool('run_command', false), { command: 'printf secret' }, asked).decision, 'deny');
});
