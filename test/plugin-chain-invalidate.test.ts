// The invalidation calls (W45-42). The copied bodies are src/plugin-chain-invalidate-source.ts (4
// blocks, 281 units; ranges and per-block digests in research/ports/W45-invalidate-blocks.plan.json)
// behind the wrappers in src/plugin-chain-invalidate.ts. These tests seed both registries the bodies
// reach and assert that each call moves its own names and no others: the two accessors are
// process-wide singletons, so the seeds are per test and every watched name is re-seeded first.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { it } from '../src/plugin-chain-host.js';
import {
  clearHookRegistration, invalidateAgentSources, invalidateOutputStyleSources, invalidateSkillSources,
} from '../src/plugin-chain-invalidate.js';
import { xr } from '../src/plugin-chain-sources-registry.js';

const plugin = it() as unknown as Record<string, unknown>;
const sources = xr();

const SOURCE_TABLES = ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles',
  'allOutputStyles', 'routines', 'routineCronTasks', 'allWorkflows', 'builtinCommandTable'] as const;
const PLUGIN_SLOTS = ['agents', 'outputStyles', 'commands', 'skills', 'skillsV5', 'workflows', 'hookRegistration'] as const;

/** A marker in every watched name, so a call that touches a neighbour shows up as a change. */
function seed(): void {
  for (const key of SOURCE_TABLES) {
    const value = (sources as unknown as Record<string, unknown>)[key];
    if (value instanceof Map) value.set('k', 'v');
    else (sources as unknown as Record<string, unknown>)[key] = 'marker';
  }
  sources.dynamicSkillStates.set('cli', {
    refusedReservedNames: new Map([['x', 1]]),
    conditionalSkills: new Map([['c', 1]]),
    activatedConditionalSkillNames: new Set(['c']),
  });
  for (const key of PLUGIN_SLOTS) plugin[key] = 'marker';
}
/** The names the call left cleared (a table at 0 entries, a slot at undefined). */
function cleared(): string[] {
  const fromTables = SOURCE_TABLES.map((key) => {
    const value = (sources as unknown as Record<string, unknown>)[key];
    return value instanceof Map && value.size === 0 ? key : null;
  });
  const fromSlots = PLUGIN_SLOTS.map((key) => (plugin[key] === undefined ? `plugin.${key}` : null));
  return [...fromTables, ...fromSlots].filter((entry): entry is string => entry !== null).sort();
}

test('invalidateSkillSources drops the skill dirs and the markdown files, nothing else', () => {
  seed();
  invalidateSkillSources();
  assert.deepEqual(cleared(), ['markdownFiles', 'skillDirCommands']);
  assert.equal(sources.dynamicSkillStates.get('cli')!.conditionalSkills.size, 0);
  assert.equal(sources.dynamicSkillStates.get('cli')!.activatedConditionalSkillNames.size, 0);
  assert.equal(sources.dynamicSkillStates.get('cli')!.refusedReservedNames.size, 1, 'only the conditional tables go');
  const once = cleared();
  invalidateSkillSources();
  assert.deepEqual(cleared(), once, 'a second call is a no-op');
});

test('clearHookRegistration clears the plugin registry\'s hook slot and nothing else', () => {
  seed();
  clearHookRegistration();
  assert.deepEqual(cleared(), ['plugin.hookRegistration']);
});

test('invalidateAgentSources drops the agent definitions with the markdown files and the agents slot', () => {
  seed();
  invalidateAgentSources();
  assert.deepEqual(cleared(), ['agentDefinitions', 'markdownFiles', 'plugin.agents']);
});

test('invalidateOutputStyleSources drops the dir styles with the markdown files and the styles slot', () => {
  seed();
  invalidateOutputStyleSources();
  assert.deepEqual(cleared(), ['markdownFiles', 'outputStyleDirStyles', 'plugin.outputStyles']);
});

test('the command table survives all four, because its invalidation is the unported `VT`', () => {
  // `VT` is `xr().invalidateCommands(),BEo()` and `BEo` reads a store this product does not carry, so
  // the command table is the one source table none of the four ported calls drops.
  for (const call of [invalidateSkillSources, clearHookRegistration, invalidateAgentSources, invalidateOutputStyleSources]) {
    seed();
    call();
    assert.equal((sources as unknown as Record<string, unknown>).builtinCommandTable, 'marker');
  }
});

test('the markdown-file table is dropped by the three source calls and not by the hook one', () => {
  for (const call of [invalidateSkillSources, invalidateAgentSources, invalidateOutputStyleSources]) {
    seed();
    call();
    assert.equal(sources.markdownFiles.size, 0, `${call.name} drops the markdown files`);
  }
  seed();
  clearHookRegistration();
  assert.equal(sources.markdownFiles.size, 1, 'the hook slot lives in the plugin registry, not in a source table');
});
