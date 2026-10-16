// W45-11 against the built artifact: the twelve chain sites and the cores the source gives them, driven
// through the copied runner. Sources: dist/plugin-chain-sites-source.js, dist/plugin-chain-cores-source.js,
// dist/plugin-chain-registry.js (which registers both) and dist/plugin-chain-entry.js (`ga`).
import assert from 'node:assert/strict';
import { ga } from '../dist/plugin-chain-entry.js';
import { $be, yyt } from '../dist/plugin-chain-host.js';
import '../dist/plugin-chain-registry.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'composer' })]);
const dispatch = (name, event) => ga(name, { origin: ORIGIN })(event);

// Each chain's own projection: what the site carries and what the core hands back.
assert.deepEqual(await dispatch('agent.offer', { kind: 'agent', name: 'planner' }), { isOffered: true });
assert.deepEqual(await dispatch('command.describe', { name: 'review', description: 'reviews', argumentHint: '[path]', isHidden: false }),
  { description: 'reviews', argumentHint: '[path]', isHidden: false }, 'the projection drops the name');
assert.deepEqual(await dispatch('config.describe', { key: 'theme', label: 'Theme', description: 'the scheme', isHidden: false }),
  { label: 'Theme', description: 'the scheme', isHidden: false }, 'the projection drops the key');
assert.deepEqual(await dispatch('tool.describe', { name: 'Read', description: 'reads a file' }), { description: 'reads a file' },
  'a tool that is not deferred reports neither field');
assert.deepEqual(await dispatch('tool.describe', { name: 'Read', description: 'reads a file', isDeferred: true }),
  { description: 'reads a file', isDeferred: true });
assert.deepEqual(await dispatch('prompt.autocomplete', { text: 'rev', cursor: 3, token: 'rev', start: 0 }), { suggestions: [] });
assert.deepEqual(await dispatch('telemetry.mark', { value: 7 }), { value: undefined }, 'the mark core answers undefined');
const context = { blocks: [{ name: 'claudeMd', text: 'be terse' }], instructionFiles: [] };
assert.deepEqual(await dispatch('prompt.context', context), context);
for (const name of ['prompt.section', 'prompt.attachment', 'skill.prompt', 'attribution.text', 'session.receive']) {
  assert.deepEqual(await dispatch(name, { text: 'the body', skill: 'review' }), { text: 'the body' }, name);
}

// The pairing: every registered core has a site whose `event` names its chain, and the site is the
// copied descriptor (its rules are the source's own functions).
for (const name of ['agent.offer', 'command.describe', 'config.describe', 'tool.describe', 'prompt.autocomplete',
  'telemetry.mark', 'prompt.context', 'prompt.section', 'prompt.attachment', 'skill.prompt', 'attribution.text', 'session.receive']) {
  const site = $be()[name];
  assert.equal(site.event, name);
  assert.equal(typeof site.check, 'function', `${name} kept its result check`);
  assert.ok(yyt()[name], `${name} has a core`);
}

// A chain the product has no site or core for still refuses where the runner always refused.
await assert.rejects(() => dispatch('tool.call', { tool: 'Read', args: {} }),
  /\$\.tool\.call: no core at the bottom of the chain/);

// The core's own answer is not re-checked: the site's `check` runs on what a hook returns, and `ae()`
// holds the core out of it. A site rule still reads the answer the core gave.
assert.deepEqual(await dispatch('prompt.context', { blocks: [], instructionFiles: [] }), { blocks: [], instructionFiles: [] });

console.log('W45ChainCoresCompiled.v1');
