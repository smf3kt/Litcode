import assert from 'node:assert/strict';
import {test} from 'node:test';
import {$be} from '../src/plugin-chain-host.js';
import {tht} from '../src/plugin-chain-entry.js';
import {HFs, Mr, Q$n, xp} from '../src/plugin-chain-classic-source.js';
// The registry import is what registers the two generated families.
import '../src/plugin-chain-registry.js';

// The chains the source generates rather than writes out: `...co(Q$n, se)` for the value events and
// `...co(HFs, Bbr)` for the classic hook events. Their sites are the contract every answer to those
// events is validated against. Sources: research/ports/W45-chain-runner.md, the classic package.

const site = (name: string) => $be()[name] as {event: string; check: (answer: unknown, raised: unknown, fromBelow: readonly unknown[]) => unknown; checkArgument?: (passed: unknown, received: unknown) => unknown};

/**
 * The seven value events the source's own table overrides with a hand-written site. They are
 * registered from that site (see `test/plugin-chain-override-sites.test.ts`), so the generated
 * descriptor is not the one a plugin meets: each carries a `checkArgument` the generated site lacks.
 */
const OVERRIDDEN = ['ui.open', 'ui.close', 'ui.blit', 'env.get', 'env.set', 'state.get', 'state.set'];

test('classic sites: both generated families are registered from the source\'s own name lists', () => {
  assert.equal(Q$n.length, 63);
  assert.equal(xp.length, 33);
  assert.equal(HFs.length, 32, 'classic.PreToolUse is excluded: it has a hand-written site');
  assert.equal(HFs.includes('classic.PreToolUse'), false);

  for (const name of Q$n) {
    assert.equal(site(name).event, name);
    assert.equal(typeof site(name).check, 'function');
    if (OVERRIDDEN.includes(name)) {
      assert.equal(typeof site(name).checkArgument, 'function', `${name} carries its hand-written argument check`);
      continue;
    }
    assert.equal(site(name).checkArgument, undefined, 'a generated value event takes no argument check');
  }
  for (const name of HFs) {
    assert.equal(site(name).event, name);
    assert.equal(typeof site(name).check, 'function');
    assert.equal(typeof site(name).checkArgument, 'function', 'a classic event restores its envelope');
  }
  // `classic.PreToolUse` is not in `HFs`; its registered site comes from the hand-written copy, and
  // `settle` is what tells that one from a generated classic site.
  assert.equal($be()['classic.PreToolUse'].event, 'classic.PreToolUse');
  assert.equal(typeof $be()['classic.PreToolUse'].settle, 'function');
  assert.equal(Object.keys($be()).length, 113, 'the twelve hand-written sites, prompt.edit, both generated families, the seven overrides, the three classic sites the table also writes by hand and the two W45-71 sites (ui.scroll, ui.focus)');
});

test('classic sites: the copied rules answer with the source\'s own sentences', () => {
  const classic = site('classic.PostToolUse');
  assert.equal(classic.check({tool_name: 'Read', continue: true}, {}, []), undefined);
  assert.equal(classic.check({tool_name: 'Read', block: 5}, {}, []), 'block of the wrong type');
  assert.equal(classic.check({tool_name: 'Read', permissionDecision: 'maybe'}, {}, []),
    'a permissionDecision that is not allow, deny or ask');
  assert.equal(classic.check({tool_name: 'Read', permissionDecision: 'deny', decision: 5}, {}, []),
    'a decision that is not an object');

  // The envelope is pinned: a hook that rewrites a key it does not own is refused, and the sentence
  // names the key it may keep.
  const envelope = Object.fromEntries(Mr.map((key) => [key, 'held']));
  assert.equal(classic.checkArgument?.({...envelope, hook_event_name: 'changed'}, envelope),
    `a changed hook_event_name (the envelope is the engine's; a rewrite keeps ${Mr.join(', ')})`);
  assert.equal(classic.checkArgument?.(envelope, envelope), undefined);

  const value = site('model.complete');
  assert.equal(value.check({value: 42}, {}, []), undefined);
  assert.equal(value.check({deny: 'no'}, {}, []), undefined, 'a deny stands beside the value');
  assert.equal(value.check({}, {}, []), 'neither { value } nor { deny }');
});

test('classic sites: these names are not in the payload-builder table, so aP dispatches them', () => {
  // `ga` reads `tht[e](event)`; the table carries the engine's own chain names only, which is why the
  // source's classic events reach the chain through `aP` with `zd[name]` instead.
  assert.equal(Object.keys(tht).filter((name) => name.startsWith('classic.')).length, 0);
  assert.equal(Object.keys(tht).includes('model.complete'), false);
  for (const name of ['prompt.edit', 'tool.call', 'tool.check', 'session.receive']) {
    assert.equal(typeof (tht as Record<string, unknown>)[name], 'function', name);
  }
});
