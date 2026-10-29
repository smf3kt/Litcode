import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vS } from '../src/bash-parser-source.js';
import { E6 } from '../src/shell-analyser-source.js';
import { xX } from '../src/shell-rule-matcher-source.js';

function commandAst(command: string) {
  const tree = vS().parse(command, undefined);
  assert.ok(tree);
  const analysis = E6(command, tree);
  assert.equal(analysis.kind, 'simple');
  return analysis.commands[0];
}

test('source rule matching follows wrappers for deny and ask candidates', () => {
  const deny = { source: 'projectSettings', ruleBehavior: 'deny', ruleValue: { toolName: 'Bash', ruleContent: 'rm:*' } };
  const rules = new Map([['rm:*', deny]]);
  const ask = { source: 'session', ruleBehavior: 'ask', ruleValue: { toolName: 'Bash', ruleContent: 'rm:*' } };
  const askRules = new Map([['rm:*', ask]]);
  for (const command of ['rm target', 'timeout 2s rm target', 'command rm target', 'env CUSTOM=value rm target']) {
    const input = { command };
    const options = { stripAllEnvVars: true, skipCompoundCheck: true, astCommand: commandAst(command), ruleBehavior: 'deny' };
    assert.deepEqual(xX(input, rules, 'exact', options), []);
    const denyMatches = xX(input, rules, 'prefix', options);
    assert.equal(denyMatches.length, 1);
    assert.equal(denyMatches[0], deny);
    const askOptions = { ...options, ruleBehavior: 'ask' };
    const askMatches = xX(input, askRules, 'prefix', askOptions);
    assert.equal(askMatches.length, 1);
    assert.equal(askMatches[0], ask);
  }
  const fallback = { stripAllEnvVars: true, ruleBehavior: 'deny' };
  const fallbackMatches = xX({ command: 'env CUSTOM=value rm target' }, rules, 'prefix', fallback);
  assert.equal(fallbackMatches.length, 1);
  assert.equal(fallbackMatches[0], deny);
  for (const command of ['command -v rm', 'timeout 2s echo ok']) {
    const options = { stripAllEnvVars: true, astCommand: commandAst(command), ruleBehavior: 'deny' };
    assert.deepEqual(xX({ command }, rules, 'prefix', options), []);
  }
});

test('source certified matching requires literal command forms', () => {
  const rule = { source: 'session', ruleBehavior: 'allow', ruleValue: { toolName: 'Bash', ruleContent: 'certified: git status' } };
  const rules = new Map([['certified: git status', rule]]);
  const match = (command: string) => {
    const options = { astCommand: commandAst(command), ruleBehavior: 'allow', skipCompoundCheck: false };
    return xX({ command }, rules, 'prefix', options);
  };
  const certifiedMatches = match('git status');
  assert.equal(certifiedMatches.length, 1);
  assert.equal(certifiedMatches[0], rule);
  assert.deepEqual(match('git status --short'), [rule]);
  assert.deepEqual(match('git status > /dev/null'), [rule]);
  assert.deepEqual(match('git status -sb'), []);
  assert.deepEqual(match('CUSTOM=value git status'), []);
  assert.deepEqual(match('git status *'), []);
  const exactOptions = { astCommand: commandAst('git status'), ruleBehavior: 'allow', skipCompoundCheck: false };
  assert.deepEqual(xX({ command: 'git status' }, rules, 'exact', exactOptions), []);
  const assignmentOptions = { ...exactOptions, compoundBareAssignmentNames: ['CUSTOM'] };
  // The copied function's empty-array default is inferred as never[] by TypeScript.
  assert.deepEqual(Reflect.apply(xX, undefined, [{ command: 'git status' }, rules, 'prefix', assignmentOptions]), []);
  const prefix = { source: 'session', ruleBehavior: 'allow', ruleValue: { toolName: 'Bash', ruleContent: 'echo:*' } };
  const prefixRules = new Map([['echo:*', prefix]]);
  const compound = { command: 'echo ok; rm target' };
  const allowOptions = { ruleBehavior: 'allow', skipCompoundCheck: false };
  assert.deepEqual(xX(compound, prefixRules, 'prefix', allowOptions), []);
  assert.equal(xX(compound, prefixRules, 'prefix', { ...allowOptions, skipCompoundCheck: true })[0], prefix);
});
