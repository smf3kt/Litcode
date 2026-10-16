// The registry's invalidation surface (W45-40). The copied bodies are
// src/plugin-chain-registry-reset-source.ts (7 blocks, 306 units; ranges and per-block digests in
// research/ports/W45-registry-reset-blocks.plan.json), behind the typed seam
// src/plugin-chain-registry-reset.ts. These tests drive the seam and read the registry the product
// installs, so a body that clears the wrong slot or a wrapper that reaches a different registry fails
// here. They read and write the one registry `it()` builds, which is process-wide state; each test
// seeds the fields it asserts on.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import { createPluginRegistryState } from '../src/plugin-chain-registry-state.js';
import {
  pluginLoadCacheOnly, registeredAgentExists, resetAgents, resetCommands, resetOutputStyles,
  resetSkills, resetWorkflows,
} from '../src/plugin-chain-registry-reset.js';

const reg = it() as unknown as Record<string, unknown>;
const TARGETS = ['commands', 'skills', 'skillsV5', 'agents', 'outputStyles', 'workflows', 'pluginLoadCacheOnly'];
/** Fields no reset may touch: an over-broad body that clears the plugin-load or hook state shows here. */
const SENTINELS = ['pluginLoad', 'handedIn', 'hookRegistrationEpoch', 'registeredAgents'];

/** Seed every target with a distinct value and every sentinel with a marker, then snapshot. */
function seed(): Record<string, unknown> {
  reg.commands = ['c'];
  reg.skills = ['s'];
  reg.skillsV5 = ['s5'];
  reg.agents = ['a'];
  reg.outputStyles = ['o'];
  reg.workflows = ['w'];
  reg.pluginLoadCacheOnly = true;
  reg.pluginLoad = 'marker-pluginLoad';
  reg.handedIn = 'marker-handedIn';
  reg.hookRegistrationEpoch = 7;
  return Object.fromEntries([...TARGETS, ...SENTINELS].map(key => [key, reg[key]]));
}

const changed = (before: Record<string, unknown>): string[] =>
  [...TARGETS, ...SENTINELS].filter(key => !Object.is(before[key], reg[key]));

test('registeredAgentExists is the registry map lookup, not a second store', () => {
  reg.registeredAgents = new Map([['alpha', { id: 'alpha' }]]);
  assert.equal(registeredAgentExists('alpha'), true);
  assert.equal(registeredAgentExists('beta'), false);
  (reg.registeredAgents as Map<string, unknown>).delete('alpha');
  assert.equal(registeredAgentExists('alpha'), false);
  // A name the source's map holds with an undefined value is still present: `.has`, not a truth test.
  (reg.registeredAgents as Map<string, unknown>).set('gamma', undefined);
  assert.equal(registeredAgentExists('gamma'), true);
});

test('pluginLoadCacheOnly reads the slot itself, including its unset state', () => {
  reg.pluginLoadCacheOnly = undefined;
  assert.equal(pluginLoadCacheOnly(), undefined);
  reg.pluginLoadCacheOnly = true;
  assert.equal(pluginLoadCacheOnly(), true);
  reg.pluginLoadCacheOnly = false;
  assert.equal(pluginLoadCacheOnly(), false);
});

test('each reset clears exactly its own slots and leaves the rest of the registry alone', () => {
  const cases: Array<[string, () => void, string[]]> = [
    ['Nhr', resetCommands, ['commands']],
    ['Fhr', resetSkills, ['skills', 'skillsV5']],
    ['$hr', resetAgents, ['agents']],
    ['Uhr', resetOutputStyles, ['outputStyles']],
    ['UDn', resetWorkflows, ['workflows']],
  ];
  for (const [name, run, cleared] of cases) {
    const before = seed();
    run();
    assert.deepEqual(changed(before).sort(), cleared.sort(), `${name} clears ${cleared.join(',')} and nothing else`);
    for (const key of cleared) assert.equal(reg[key], undefined, `${name} leaves ${key} undefined`);
  }
});

test('a reset over an already-cleared slot is a no-op', () => {
  seed();
  resetCommands();
  const cleared = Object.fromEntries([...TARGETS, ...SENTINELS].map(key => [key, reg[key]]));
  resetCommands();
  resetCommands();
  assert.deepEqual(changed(cleared), []);
});

test('the compositions the source runs clear the union of their parts', () => {
  // bM() in the source is `VT(); Nhr(); Fhr(); Hz()`; the plugin-source re-read zLr() clears commands,
  // agents, output styles and workflows; _7() clears agents; bCn() clears output styles.
  const cases: Array<[string, Array<() => void>, string[]]> = [
    ['bM', [resetCommands, resetSkills], ['commands', 'skills', 'skillsV5']],
    ['zLr', [resetCommands, resetAgents, resetOutputStyles, resetWorkflows],
      ['commands', 'agents', 'outputStyles', 'workflows']],
    ['_7', [resetAgents], ['agents']],
    ['bCn', [resetOutputStyles], ['outputStyles']],
  ];
  for (const [name, parts, cleared] of cases) {
    const before = seed();
    for (const part of parts) part();
    assert.deepEqual(changed(before).sort(), cleared.sort(), `${name} clears its union`);
  }
});

test('the registry carries every field a reset writes, and each starts cleared', () => {
  const fresh = createPluginRegistryState() as unknown as Record<string, unknown>;
  for (const key of [...TARGETS, ...SENTINELS]) assert.ok(key in fresh, `the literal carries ${key}`);
  for (const key of TARGETS) assert.equal(fresh[key], undefined, `${key} starts unset, so a cold reset is a no-op`);
});
