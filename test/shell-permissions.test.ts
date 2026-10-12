import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissionDecision, type PermissionPolicy } from '../src/permissions.js';
import { SHELL_READING_LIMIT, shellReadings } from '../src/shell-readings.js';
import type { ToolDefinition } from '../src/tools.js';

const shellTool: ToolDefinition = {
  readOnly: false,
  schema: { name: 'run_command', description: 'Run a shell command.', input_schema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
  async execute() { return 'ran'; },
};

function policy(inputRules: NonNullable<PermissionPolicy['inputRules']>, mode: PermissionPolicy['mode'] = 'default'): PermissionPolicy {
  return { mode, allow: [], deny: [], inputRules };
}

const decide = (rules: NonNullable<PermissionPolicy['inputRules']>, command: string, mode?: PermissionPolicy['mode']) =>
  permissionDecision(policy(rules, mode), shellTool, { command });

test('readings include the de-quoted, per-segment and substitution forms and report incompleteness', () => {
  assert.deepEqual(shellReadings('echo hi'), { readings: ['echo hi'], exhaustive: true });
  assert.deepEqual(shellReadings("echo 'denied'").readings, ["echo 'denied'", 'echo denied']);
  assert.ok(shellReadings('true; rm -rf /').readings.includes('rm -rf /'));
  assert.ok(shellReadings('echo $(cat key)').readings.includes('cat key'));
  // A substitution, a variable, a glob and a leading tilde all expand to text
  // that is not in the command, so no reading set can be complete.
  for (const command of ['echo $(cat key)', 'echo ${HOME}', 'echo $HOME', 'ls *.txt', 'cat ~/key', 'echo `id`']) {
    assert.equal(shellReadings(command).exhaustive, false, command);
  }
  const wide = shellReadings(Array.from({ length: 40 }, (_, index) => `c${index}`).join(';'));
  assert.equal(wide.exhaustive, false);
  assert.ok(wide.readings.length <= SHELL_READING_LIMIT);
});

test('a rule that constrains the command is enforced over every reading, not just the literal text', () => {
  const rules: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo denied', decision: 'deny' }];
  // The literal text does not match the rule, but the shell runs the de-quoted form.
  assert.equal(permissionDecision(policy(rules), shellTool, { command: "echo 'denied'" }).decision, 'deny');
  const segments: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'rm -rf *', decision: 'deny' }];
  assert.equal(permissionDecision(policy(segments), shellTool, { command: 'true; rm -rf /tmp' }).decision, 'deny');
  const inner: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: '*curl*', decision: 'deny' }];
  assert.equal(permissionDecision(policy(inner), shellTool, { command: 'echo $(curl http://x)' }).decision, 'deny');
});

test('an incomplete reading set is never allowed on the strength of one reading', () => {
  const allow: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo *', decision: 'allow' }];
  const expanded = decide(allow, 'echo $SECRET');
  assert.equal(expanded.decision, 'ask');
  assert.match(expanded.reason ?? '', /cannot all be checked/);
  // A command with no expansion is fully enumerated and keeps its allow.
  assert.equal(decide(allow, 'echo hello').decision, 'allow');
  // A reading that asks for approval also blocks a plain allow.
  const mixed: NonNullable<PermissionPolicy['inputRules']> = [
    { tool: 'run_command', command: 'echo *', decision: 'allow' },
    { tool: 'run_command', command: 'rm *', decision: 'ask' },
  ];
  assert.equal(decide(mixed, 'echo ok; rm -rf /tmp').decision, 'ask');
});

test('unchanged behaviour: no command rule, a denial, or bypass mode', () => {
  const toolOnly: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', decision: 'allow' }];
  assert.equal(decide(toolOnly, 'echo $SECRET').decision, 'allow');
  const pathOnly: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', path: 'x', decision: 'allow' }];
  assert.equal(decide(pathOnly, 'echo $SECRET').decision, 'allow');
  // A baseline denial is never softened by a later reading.
  const denied: NonNullable<PermissionPolicy['inputRules']> = [
    { tool: 'run_command', command: 'echo *', decision: 'allow' },
    { tool: 'run_command', command: 'echo bad', decision: 'deny' },
  ];
  assert.equal(decide(denied, 'echo bad').decision, 'deny');
  // Bypass keeps its meaning: nothing turns into a prompt, but a denial stands.
  assert.equal(decide(denied, 'echo ok; echo bad', 'bypass').decision, 'deny');
  assert.equal(decide([{ tool: 'run_command', command: 'echo *', decision: 'allow' }], 'echo $SECRET', 'bypass').decision, 'allow');
  // A non-shell tool is untouched even when a command field is present.
  const reader: ToolDefinition = { readOnly: true, schema: { name: 'read_file', description: 'Read.', input_schema: { type: 'object', properties: {} } }, async execute() { return ''; } };
  assert.equal(permissionDecision(policy([{ tool: 'read_file', command: 'echo *', decision: 'allow' }]), reader, { command: 'echo $SECRET' }).decision, 'allow');
});
