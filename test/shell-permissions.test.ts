import assert from 'node:assert/strict';
import { test } from 'node:test';
import { permissionDecision, type PermissionPolicy } from '../src/permissions.js';
import { SHELL_READING_LIMIT, shellComplexityReason, shellReadings } from '../src/shell-readings.js';
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
  assert.deepEqual(shellReadings('echo hi'), { readings: ['echo hi'], denyOnly: [], exhaustive: true });
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

test('the recovered analyser refusals make a reading set incomplete', () => {
  // Each line is one the recovered `E6` refuses to model; the reading set over
  // it cannot be complete, so an allow rule must not carry it.
  const refused: [string, string][] = [
    ['echo \u0007x', 'Contains control characters'],
    ['echo  x', 'Contains Unicode whitespace'],
    ['echo a\\ b', 'Contains backslash-escaped whitespace'],
    ['echo ~[a]', 'Contains zsh ~[ dynamic directory syntax'],
    ['echo =ls', 'Contains zsh =cmd equals expansion'],
    ['echo <1-3>', 'Contains zsh <N-M> numeric-range glob'],
    ["echo {a,b'c}", 'Contains brace with quote character (expansion obfuscation)'],
    ['echo \uD800', 'Contains lone surrogate'],
  ];
  for (const [command, reason] of refused) {
    assert.equal(shellComplexityReason(command), reason, command);
    assert.equal(shellReadings(command).exhaustive, false, command);
  }
  // An ordinary line, and an astral character that is not a lone surrogate,
  // stay fully enumerated.
  assert.equal(shellComplexityReason('echo hi'), undefined);
  assert.equal(shellReadings('echo hi').exhaustive, true);
  assert.equal(shellComplexityReason('echo \u{1F600}'), undefined);
  const allow: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo *', decision: 'allow' }];
  assert.equal(decide(allow, 'echo <1-3>').decision, 'ask');
  assert.equal(decide(allow, 'echo a\\ b').decision, 'ask');
});

test('a group, a keyword body and a loop body are checked as the commands they run', () => {
  const rules: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo hi', decision: 'deny' }];
  // The text walk sees one segment for each of these, so before the tree walk
  // the rule never met the inner command and the call was allowed.
  assert.equal(permissionDecision(policy(rules), shellTool, { command: '( echo hi )' }).decision, 'deny');
  assert.equal(permissionDecision(policy(rules), shellTool, { command: '{ echo hi; }' }).decision, 'deny');
  assert.equal(permissionDecision(policy(rules), shellTool, { command: 'if true; then echo hi; fi' }).decision, 'deny');
  assert.equal(permissionDecision(policy(rules), shellTool, { command: 'for f in *; do echo hi; done' }).decision, 'deny');
  // An ordinary line and a line whose inner command is not the denied one keep
  // their own answers.
  assert.equal(permissionDecision(policy(rules), shellTool, { command: 'echo ok' }).decision, 'allow');
  assert.equal(permissionDecision(policy(rules), shellTool, { command: '( echo ok )' }).decision, 'allow');
  // A line the parser cannot read yields no reading set at all, so an allow
  // rule cannot carry it.
  const allow: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo *', decision: 'allow' }];
  assert.equal(decide(allow, 'echo hi )').decision, 'ask');
  assert.equal(shellReadings('echo hi )').exhaustive, false);
});

test('a compound line is read from its tree, not from its separators', () => {
  // `;` inside `if …; then …; fi` separates a keyword from its body, so the text
  // split would invent `then echo hi` and `fi` as commands. Neither is one.
  assert.deepEqual(shellReadings('if true; then echo hi; fi').readings,
    ['if true; then echo hi; fi', 'true', 'echo hi']);
  assert.deepEqual(shellReadings('while true; do echo hi; done').readings,
    ['while true; do echo hi; done', 'true', 'echo hi']);
  // A plain list has no keyword, so its separators are still command boundaries.
  assert.ok(shellReadings('echo a; echo b').readings.includes('echo b'));
  // A redirect belongs to the statement it wraps: the command inside it is not
  // a second command, so an exact allow rule on the whole line keeps working.
  // Its bare command is still checked against deny rules, because the recovered
  // `GTr` reads the statement and the command under the redirect apart.
  assert.deepEqual(shellReadings('printf shell-content > content/shell.txt'),
    { readings: ['printf shell-content > content/shell.txt'], denyOnly: ['printf shell-content'], exhaustive: true });
  assert.equal(decide([{ tool: 'run_command', command: 'printf shell-content > content/shell.txt', decision: 'allow' }],
    'printf shell-content > content/shell.txt').decision, 'allow');
  assert.equal(decide([{ tool: 'run_command', command: 'printf shell-content', decision: 'deny' }],
    'printf shell-content > content/shell.txt').decision, 'deny');
  // A redirect around a pipeline belongs to the last command in it, so the
  // earlier commands keep their own text and the last one reads both ways.
  assert.deepEqual(shellReadings('echo a | grep b > out.txt').readings,
    ['echo a | grep b > out.txt', 'echo a', 'grep b', 'grep b > out.txt']);
  // A redirect inside a group must not hide the command from a rule.
  assert.deepEqual(shellReadings('( echo denied > f )'),
    { readings: ['( echo denied > f )', 'echo denied > f'], denyOnly: ['echo denied'], exhaustive: true });
  // A quoted inner command is de-quoted before a rule sees it.
  assert.ok(shellReadings("( echo 'denied' )").readings.includes('echo denied'));
  // A tree refusal keeps the text readings instead of discarding them.
  const overlong = 'echo denied;' + 'x'.repeat(10050);
  assert.ok(shellReadings(overlong).readings.includes('echo denied'));
  assert.equal(shellReadings(overlong).exhaustive, false);
});

test('the strictest reading decides, and a mode ask ranks below a rule ask', () => {
  // `DTr` ranks the primary together with the alternates, and an ask outranks
  // an allow (`Lcn` 4/5 over 1), so a complete reading set still asks when an
  // alternate reading asks. The old shape only reached this when the set was
  // incomplete or the alternate ask matched a rule.
  const allowExact: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo "hi"', decision: 'allow' }];
  assert.equal(shellReadings('echo "hi"').exhaustive, true);
  const alternateAsk = decide(allowExact, 'echo "hi"', 'ask');
  assert.equal(alternateAsk.decision, 'ask');
  assert.match(alternateAsk.reason ?? '', /Alternate command reading requires approval: echo hi/);
  // A mode ask carries no floor and ranks 4; a rule ask from an alternate
  // reading ranks 5 and wins. The recovered order applies the mode hold after
  // the reading combination, which selects the rule ask the same way.
  const askExact: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'echo hi', decision: 'ask' }];
  const ruleAsk = decide(askExact, 'echo "hi"', 'ask');
  assert.equal(ruleAsk.decision, 'ask');
  assert.equal(ruleAsk.floor, 'rule');
  assert.match(ruleAsk.reason ?? '', /Alternate command reading requires approval: echo hi/);
  // A denial anywhere still wins over that rule ask.
  const denyAlternate: NonNullable<PermissionPolicy['inputRules']> = [{ tool: 'run_command', command: 'rm -rf /tmp', decision: 'deny' }];
  assert.equal(decide(denyAlternate, 'rm -rf "/tmp"', 'ask').decision, 'deny');
  // The auto-mode hold is a plain ask with no floor, so an alternate ask never
  // lets the command run: the host produces no soft ask, and `$pn` turns every
  // passthrough back into an ask.
  const autoAllow = permissionDecision({ mode: 'auto', allow: ['run_command(echo "hi")'], deny: [], ask: [] },
    shellTool, { command: 'echo "hi"' });
  assert.equal(autoAllow.decision, 'ask');
  assert.equal(autoAllow.floor, undefined);
  assert.match(autoAllow.reason ?? '', /Alternate command reading requires approval: echo hi/);
  const autoRuleAsk = permissionDecision({ mode: 'auto', allow: [], deny: [], ask: ['run_command(echo hi)'] },
    shellTool, { command: 'echo "hi"' });
  assert.equal(autoRuleAsk.decision, 'ask');
  assert.equal(autoRuleAsk.floor, 'rule');
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
