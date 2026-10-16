// W45-14 against the built artifact: the three classic sites the source's table writes by hand, which
// the generated classic family excludes by construction. Sources: dist/plugin-chain-classic-sites-source.js,
// dist/plugin-chain-registry.js (which registers every family) and dist/plugin-chain-host.js (`$be`
// reads the registered table).
import assert from 'node:assert/strict';
import { Ba, Ka, Ua } from '../dist/plugin-chain-classic-sites-source.js';
import { $be } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';

const HAND_WRITTEN = { 'classic.PreToolUse': Ua, 'tool.call': Ba, 'tool.check': Ka };
const site = (name) => $be()[name];

for (const [name, handWritten] of Object.entries(HAND_WRITTEN)) {
  assert.equal(site(name), handWritten, `${name} is the hand-written site object itself`);
  assert.equal(site(name).event, name);
  assert.equal(typeof site(name).checkArgument, 'function');
}
assert.deepEqual(Object.keys(site('tool.call')).sort(),
  ['carry', 'check', 'checkArgument', 'event', 'isLateRefusal', 'measure', 'pinnedKeys', 'restoreArgument', 'settle', 'stripResult']);
assert.deepEqual(site('tool.call').pinnedKeys, ['tool', 'tool_use_id', 'agentId']);
assert.equal(typeof site('tool.check').restoreResult, 'function', 'the generated classic site has no result restore');
assert.equal(Object.keys($be()).length, 113, '12 + prompt.edit + 56 + 32 + 7 + 3 + ui.scroll + ui.focus (W45-71)');

// The sentences, measured through the registered sites.
assert.equal(site('classic.PreToolUse').check({ continue: true }, {}, []), undefined);
assert.equal(site('classic.PreToolUse').check({ allow: 1 }, {}, []), 'an allow that is not true');
assert.equal(site('classic.PreToolUse').check({ deny: 5, ask: 'sure' }, {}, []), undefined, 'a string ask stands beside a malformed deny');
assert.equal(site('classic.PreToolUse').check({ ask: 5 }, {}, []), 'a deny or ask that is not a string');
// The pinned envelope is the tool call's own keys, not `tool_name`.
assert.equal(site('classic.PreToolUse').checkArgument({ tool: 'B' }, { tool: 'A' }),
  "a changed tool (the envelope is the engine's; a rewrite keeps tool, tool_use_id, agentId, consent, $shadowed)");
assert.equal(site('tool.call').check({}, {}, []), 'neither { result } nor { deny }');
assert.equal(site('tool.check').check({ decision: 'maybe' }, {}, []), 'no { decision } (one of allow, ask, deny)');
assert.equal(site('tool.check').checkArgument({ tool: 'X' }, { tool: 'Y' }),
  'a changed tool (the tool, its input and the call are the question and are pinned; a hook answers { decision }, it does not ask about another call)');

// The answer shaping.
assert.deepEqual(site('tool.call').stripResult({ result: 'r', ref: 'x', isReadOnly: true }, [{ ref: 'x', isReadOnly: true, result: 'r' }]),
  { result: 'r', ref: 'x', isReadOnly: true });
assert.deepEqual(site('tool.call').stripResult({ result: 'r', ref: 'x', isReadOnly: true }, [{ ref: 'x', isReadOnly: false, result: 'r' }]),
  { result: 'r', ref: 'x' });
assert.deepEqual(site('tool.check').restoreResult({ decision: 'allow', ceiling: 9 }, [], { tool: 'X', ceiling: 3 }),
  { decision: 'allow', ceiling: 3 });
assert.deepEqual(site('tool.check').settle({ decision: 'deny', reason: 'r', rule: 'ru', hook: 'h', other: 1 }),
  { decision: 'deny', reason: 'r', rule: 'ru', hook: 'h' });
assert.deepEqual(site('classic.PreToolUse').restoreArgument({}, { tool_name: 'A', $shadowed: { x: 1 } }), { $shadowed: { x: 1 } });

console.log('W45ClassicSitesCompiled.v1');
