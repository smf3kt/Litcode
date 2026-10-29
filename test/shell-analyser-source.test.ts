import assert from 'node:assert/strict';
import { test } from 'node:test';
import { vS } from '../src/bash-parser-source.js';
import { E6, Yx, pyr } from '../src/shell-analyser-source.js';
import { DTr } from '../src/shell-reading-merge-source.js';

function parse(command: string) {
  const tree = vS().parse(command, undefined);
  assert.ok(tree);
  return tree;
}

const prefixOptions = (choice: boolean) => ({ plainUnquotedHeredocs: false, declarationPrefix: [choice] });

test('declaration prefixes enumerate complete small sets and bound larger sets', () => {
  const three = 'A=1 export B; C=1 export D; E=1 export F';
  const four = `${three}; G=1 export H`;
  for (const [command, prefixCount, sampleCount, exhaustive] of [
    [three, 3, 8, true],
    [four, 4, 6, false],
  ] as const) {
    const analysis = E6(command, parse(command));
    assert.equal(analysis.declarationPrefixes, prefixCount);
    const sample = pyr(analysis.declarationPrefixes, analysis.declarationPrefixBashKeeps);
    assert.equal(sample.readings.length, sampleCount);
    assert.equal(sample.exhaustive, exhaustive);
    assert.equal(new Set(sample.readings.map((value: boolean[]) => value.join(','))).size, sampleCount);
    if (prefixCount === 4) assert.deepEqual(sample.readings, [
      [false, false, false, false], [true, true, true, true],
      [true, false, false, false], [false, true, false, false],
      [false, false, true, false], [false, false, false, true],
    ]);
  }
  assert.deepEqual(pyr(4, [true, true, false, false]), {
    readings: [
      [false, false, false, false], [true, true, true, true],
      [true, false, false, false], [false, true, false, false],
      [false, false, true, false], [false, false, false, true],
      [true, true, false, false],
    ], exhaustive: false,
  });
});

test('prefix choices retain later readings and restore state between calls', () => {
  const command = 'X=old; X=new export Y; echo "$X"';
  const tree = parse(command);
  const baseline = E6(command, tree);
  assert.equal(baseline.kind, 'too-complex');
  assert.deepEqual(baseline.declarationPrefixBashKeeps, [false]);
  assert.deepEqual(pyr(baseline.declarationPrefixes, baseline.declarationPrefixBashKeeps),
    { readings: [[false], [true]], exhaustive: true });
  for (let index = 0; index < 4; index++) {
    for (const [choice, expected] of [[false, 'echo old'], [true, 'echo new']] as const) {
      const analysis = E6(command, tree, prefixOptions(choice));
      assert.equal(analysis.kind, 'simple');
      assert.equal(analysis.commands.at(-1)?.text, expected);
    }
    assert.deepEqual(E6(command, tree), baseline);
  }
  assert.equal(E6('echo hi', Yx).nodeType, 'PARSE_ABORT');
  const unicode = 'printf "%s" "雪"; X=old; X=new export Y; echo "$X"';
  const unicodeTree = parse(unicode);
  assert.equal(E6(unicode, unicodeTree, prefixOptions(false)).kind, 'too-complex');
  const alternate = E6(unicode, unicodeTree, prefixOptions(true));
  assert.equal(alternate.kind, 'simple');
  assert.equal(alternate.commands.at(-1)?.text, 'echo new');
});

test('source reading merge preserves denials, hard asks and incomplete samples', () => {
  const allow = { behavior: 'allow', decisionReason: { type: 'rule', rule: { ruleBehavior: 'allow' } } };
  const soft = { behavior: 'ask', decisionReason: { type: 'other', reason: 'soft' } };
  const hard = { behavior: 'ask', decisionReason: { type: 'rule', rule: { ruleBehavior: 'ask' } } };
  const deny = { behavior: 'deny' };
  const protectedAsk = { behavior: 'ask', decisionReason: { type: 'safetyCheck', circuitBreaker: 'outsideReadsBlocked' } };
  assert.equal(DTr(allow, [allow], true), allow);
  assert.equal(DTr(allow, [deny], false), deny);
  assert.equal(DTr(hard, [soft], false), hard);
  assert.equal(DTr(hard, [deny], false), deny);
  assert.equal(DTr(soft, [hard], true), hard);
  assert.equal(DTr(allow, [soft], false), soft);
  assert.equal(DTr(allow, [protectedAsk], false), protectedAsk);
  const incomplete = DTr(allow, [allow], false);
  assert.notEqual(incomplete, allow);
  assert.equal(incomplete.behavior, 'ask');
  assert.equal(incomplete.decisionReason.bashMissKind, 'too-complex');
  assert.equal(incomplete.message, "Variables set in front of a declaration in this command can't all be checked before it runs");
  assert.deepEqual(incomplete.suggestions, []);
});
