import assert from 'node:assert/strict';
import {test} from 'node:test';
import {$be} from '../src/plugin-chain-host.js';
// The registry import is what registers every family, the three hand-written classic sites included.
import '../src/plugin-chain-registry.js';

// The last three sites `zd` writes by hand: `classic.PreToolUse`, `tool.call` and `tool.check`. The
// generated classic family excludes the first by construction (`HFs` is `ao.filter(e => e !==
// "classic.PreToolUse")`), which is why these wait for their own copy. Sources: chunk-nyce03br.js
// [104152,104568) `Ua`, [105113,105501) `Ba`, [105602,106133) `Ka`, with the rules and the lodash
// map-values `ua` their settle reads; the plans are research/ports/W45-classic-sites-blocks.plan.json
// and the three research/ports/W45-lodash-*-source-blocks.plan.json.

const site = (name: string) => $be()[name] as {
  event: string;
  check: (answer: unknown, raised: unknown, fromBelow: readonly unknown[]) => unknown;
  checkArgument?: (passed: unknown, received: unknown) => unknown;
  restoreArgument?: (passed: unknown, received: unknown) => unknown;
  restoreResult?: (answer: unknown, fromBelow: readonly unknown[], received: unknown) => unknown;
  stripResult?: (answer: unknown, fromBelow: readonly unknown[]) => unknown;
  settle?: (answer: unknown) => unknown;
  pinnedKeys?: readonly string[];
};

test('classic hand-written sites: the three names carry the source\'s descriptors', () => {
  assert.deepEqual(Object.keys(site('classic.PreToolUse')).sort(),
    ['carry', 'check', 'checkArgument', 'event', 'restoreArgument', 'settle']);
  assert.deepEqual(Object.keys(site('tool.call')).sort(),
    ['carry', 'check', 'checkArgument', 'event', 'isLateRefusal', 'measure', 'pinnedKeys', 'restoreArgument', 'settle', 'stripResult']);
  assert.deepEqual(Object.keys(site('tool.check')).sort(),
    ['check', 'checkArgument', 'event', 'restoreArgument', 'restoreResult', 'settle']);
  for (const name of ['classic.PreToolUse', 'tool.call', 'tool.check']) assert.equal(site(name).event, name);

  // The keys a `tool.call` answer must keep: the source's own list, and not the whole envelope.
  assert.deepEqual(site('tool.call').pinnedKeys, ['tool', 'tool_use_id', 'agentId']);

  // 12 hand-written + prompt.edit + 56 generated values + 32 generated classic + 7 overrides + these 3
  // + the 2 W45-71 registers (ui.scroll, ui.focus).
  assert.equal(Object.keys($be()).length, 113);
});

test('classic hand-written sites: the copied rules answer with the source\'s own sentences', () => {
  const pre = site('classic.PreToolUse');
  assert.equal(pre.check({continue: true}, {}, []), undefined);
  assert.equal(pre.check({allow: 1}, {}, []), 'an allow that is not true');
  assert.equal(pre.check({deny: 5, ask: 'sure'}, {}, []), undefined, 'a string ask stands beside a malformed deny');
  assert.equal(pre.check({ask: 5}, {}, []), 'a deny or ask that is not a string');
  // The pinned envelope is the tool call's own keys, not `tool_name`.
  assert.equal(pre.checkArgument?.({tool: 'A'}, {tool: 'A'}), undefined);
  assert.equal(pre.checkArgument?.({tool: 'B'}, {tool: 'A'}),
    "a changed tool (the envelope is the engine's; a rewrite keeps tool, tool_use_id, agentId, consent, $shadowed)");

  const call = site('tool.call');
  assert.equal(call.check({result: 'r'}, {}, []), undefined);
  assert.equal(call.check({deny: 'no'}, {}, []), undefined);
  assert.equal(call.check({}, {}, []), 'neither { result } nor { deny }');
  assert.equal(call.checkArgument?.({tool: 'X'}, {tool: 'Y'}),
    "a changed tool (the envelope is the engine's; a rewrite keeps tool, tool_use_id, agentId, consent, $shadowed)");

  const chk = site('tool.check');
  assert.equal(chk.check({decision: 'allow'}, {}, []), undefined);
  assert.equal(chk.check({decision: 'maybe'}, {}, []), 'no { decision } (one of allow, ask, deny)');
  assert.equal(chk.checkArgument?.({tool: 'X'}, {tool: 'Y'}),
    'a changed tool (the tool, its input and the call are the question and are pinned; a hook answers { decision }, it does not ask about another call)');
});

test('classic hand-written sites: the answer shaping is the source\'s', () => {
  // `tool.call` keeps the shadowed result only when a read-only hook beneath it answered the same one.
  const call = site('tool.call');
  assert.deepEqual(call.stripResult?.({result: 'r', ref: 'x', isReadOnly: true}, [{ref: 'x', isReadOnly: true, result: 'r'}]),
    {result: 'r', ref: 'x', isReadOnly: true});
  assert.deepEqual(call.stripResult?.({result: 'r', ref: 'x', isReadOnly: true}, [{ref: 'x', isReadOnly: false, result: 'r'}]),
    {result: 'r', ref: 'x'});
  assert.deepEqual(call.settle?.({result: 'r', context: ['a']}), {result: 'r', context: ['a']});

  // `tool.check` drops a ceiling the hook set and keeps the one the call was made with.
  const chk = site('tool.check');
  assert.deepEqual(chk.restoreResult?.({decision: 'allow', ceiling: 9}, [], {tool: 'X', ceiling: 3}),
    {decision: 'allow', ceiling: 3});
  assert.deepEqual(chk.settle?.({decision: 'deny', reason: 'r', rule: 'ru', hook: 'h', other: 1}),
    {decision: 'deny', reason: 'r', rule: 'ru', hook: 'h'});

  // The shadowed result key is restored only when a rewrite dropped it.
  assert.deepEqual(site('classic.PreToolUse').restoreArgument?.({}, {tool_name: 'A', $shadowed: {x: 1}}), {$shadowed: {x: 1}});
  assert.deepEqual(site('classic.PreToolUse').settle?.({deny: 'no', ask: 'sure', allow: true, other: 1}),
    {deny: 'no', ask: 'sure', allow: true, other: 1});
});
