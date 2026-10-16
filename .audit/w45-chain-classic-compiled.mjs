// W45-12 against the built artifact: the two generated site families and the rules they carry. Sources:
// dist/plugin-chain-classic-source.js, dist/plugin-chain-registry.js (which registers both families),
// dist/plugin-chain-host.js (`$be` reads the registered table) and dist/plugin-chain-entry.js (`tht`).
import assert from 'node:assert/strict';
import { HFs, Mr, Q$n, xp } from '../dist/plugin-chain-classic-source.js';
import { tht } from '../dist/plugin-chain-entry.js';
import { $be } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';

const site = (name) => $be()[name];

assert.equal(Q$n.length, 63, 'the value events');
assert.equal(xp.length, 33, 'the classic hook events in the source list');
assert.equal(HFs.length, 32, 'one classic event is excluded: PreToolUse has a hand-written site');
assert.equal(HFs.includes('classic.PreToolUse'), false);
// The excluded name is registered by the classic-sites copy, not by this family; W45-14 measures it.
assert.equal(typeof site('classic.PreToolUse'), 'object', 'the hand-written site is registered elsewhere');

// The 63 value events are registered; the seven the source's own table overrides by hand carry that
// hand-written descriptor instead (its `checkArgument` is what tells the two apart).
const overridden = ['ui.open', 'ui.close', 'ui.blit', 'env.get', 'env.set', 'state.get', 'state.set'];
for (const name of Q$n) {
  const entry = site(name);
  assert.equal(entry?.event, name, `${name} is registered under its own name`);
  assert.equal(typeof entry.check, 'function', `${name} carries its result check`);
  if (overridden.includes(name)) {
    assert.equal(typeof entry.checkArgument, 'function', `${name} carries its hand-written argument check`);
    continue;
  }
  assert.equal(entry.checkArgument, undefined, `${name} takes no argument check`);
  assert.deepEqual(Object.keys(entry).sort(), ['check', 'event'], `${name} carries nothing else`);
}
for (const name of HFs) {
  const entry = site(name);
  assert.equal(entry?.event, name, `${name} is registered under its own name`);
  assert.deepEqual(Object.keys(entry).sort(), ['check', 'checkArgument', 'event'], `${name} carries both rules`);
}

// The registered total: twelve hand-written sites, `prompt.edit` (the composer relay), 56 generated
// value events, 32 classic events, the seven value events the table overrides by hand, the three
// classic sites it also writes by hand, and the two `$` table sites W45-71 ported (`ui.scroll`,
// `ui.focus`).
assert.equal(Object.keys($be()).length, 113);

// The copied classic rules, through the registered site, with their own sentences.
const classic = site('classic.PostToolUse');
assert.equal(classic.check({ tool_name: 'Read', continue: true }, {}, []), undefined);
assert.equal(classic.check({ tool_name: 'Read', block: 5 }, {}, []), 'block of the wrong type');
assert.equal(classic.check({ tool_name: 'Read', permissionDecision: 'maybe' }, {}, []),
  'a permissionDecision that is not allow, deny or ask');
assert.equal(classic.check({ tool_name: 'Read', permissionDecision: 'deny' }, {}, []), undefined, 'a well-formed decision passes');
assert.equal(classic.check({ tool_name: 'Read', permissionDecision: 'deny', decision: 5 }, {}, []),
  'a decision that is not an object');
const envelope = Object.fromEntries(Mr.map((key) => [key, 'held']));
assert.equal(classic.checkArgument(envelope, envelope), undefined);
assert.equal(classic.checkArgument({ ...envelope, cwd: 'elsewhere' }, envelope),
  `a changed cwd (the envelope is the engine's; a rewrite keeps ${Mr.join(', ')})`);

const value = site('model.complete');
assert.equal(value.check({ value: 42 }, {}, []), undefined);
assert.equal(value.check({ deny: 'a reason' }, {}, []), undefined);
assert.equal(value.check({}, {}, []), 'neither { value } nor { deny }');

// These names never reach `ga`: the payload-builder table carries the engine's own chains only, so the
// source's classic events are dispatched through `aP` with the site itself.
assert.equal(Object.keys(tht).filter((name) => name.startsWith('classic.')).length, 0);
assert.equal(Object.keys(tht).includes('model.complete'), false);
for (const name of ['prompt.edit', 'tool.call', 'tool.check', 'session.receive']) {
  assert.equal(typeof tht[name], 'function', `${name} is an engine chain`);
}

// The shared bodies are the ones the sites copy already carries: one `re` (the envelope-rewrite check)
// and one `L` (the wrong-type sweep) for both families.
assert.equal(typeof (await import('../dist/plugin-chain-sites-source.js')).re, 'function');

console.log('W45ChainClassicCompiled.v1');
