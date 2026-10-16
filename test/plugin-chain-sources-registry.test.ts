// The skill, command and agent source registry (W45-41). The copied module is
// src/plugin-chain-sources-registry-source.ts (4 blocks, 2,728 units; ranges and per-block digests in
// research/ports/W45-sources-registry-blocks.plan.json) and the typed seam is
// src/plugin-chain-sources-registry.ts. These tests pin the store's cold shape, its eight methods and
// the two helpers the module exports, so a body that clears the wrong table or a seam that hands out a
// second store fails here. They use `createSourcesRegistry()` for isolation and touch the `xr()`
// singleton only where the singleton itself is the subject.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createSourcesRegistry, memoizeOrBuild, nullableKey, xr, type DynamicSkillState, type SourcesRegistry,
} from '../src/plugin-chain-sources-registry.js';

const dynamicState = (): DynamicSkillState => ({
  refusedReservedNames: new Map(),
  conditionalSkills: new Map(),
  activatedConditionalSkillNames: new Set(),
});
const fill = (store: SourcesRegistry, keys: readonly string[]): void => {
  for (const key of keys) (store as unknown as Record<string, Map<string, unknown>>)[key]!.set('k', 'v');
};
const sizes = (store: SourcesRegistry, keys: readonly string[]): number[] =>
  keys.map((key) => (store as unknown as Record<string, Map<string, unknown>>)[key]!.size);

test('the cold store is the source class: empty tables, four weak containers, two live signals', () => {
  const store = createSourcesRegistry();
  const mapFields = ['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex', 'skillDirCommands',
    'dynamicSkillStates', 'lastCollisionExtrasSpellings', 'replacedSkillNames', 'skillContentIntern', 'builtinPlugins',
    'builtinPluginFailures', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles', 'allOutputStyles', 'routines',
    'routineCronTasks', 'allWorkflows'];
  assert.deepEqual(sizes(store, mapFields), mapFields.map(() => 0));
  assert.deepEqual(store.bundledSkills, []);
  assert.deepEqual(store.bundledSkillSessionResetHooks, []);
  assert.deepEqual(store.bundledWorkflows, []);
  assert.deepEqual(store.projectAgentsElsewhere, []);
  assert.equal(store.bundledSkillsInitialized, false);
  assert.equal(store.shippedTablesFillFailed, false);
  assert.equal(store.replacedSkillNamesSeq, 0);
  assert.equal(store.markdownScansGivenUp, 0);
  // The four weak containers keep their weakness: a string key would throw, not silently mis-store.
  assert.ok(store.reservedSpellingsByLoadedResult instanceof WeakMap);
  assert.ok(store.loadedResultsMissingTrustedNames instanceof WeakSet);
  assert.ok(store.skillFiles instanceof WeakMap);
  assert.ok(store.builtinPluginWiredSkills instanceof WeakMap);
  assert.throws(() => (store.reservedSpellingsByLoadedResult as unknown as WeakMap<object, string[]>).set('k' as never, []), TypeError);
  for (const key of ['dynamicSkillsLoaded', 'skillsChanged'] as const) {
    assert.equal(typeof (store[key] as { emit?: unknown }).emit, 'function', `${key} is a live signal`);
  }
});

test('the dynamic-skill state key is the source kind "cli"', () => {
  assert.equal(createSourcesRegistry().dynamicSkillStateKey(), 'cli');
  // It is a function field, not a method: the class writes it as an arrow over the module constant.
  assert.equal(xr().dynamicSkillStateKey(), 'cli');
});

test('invalidateCommands drops the three command tables and empties its four maps only', () => {
  const store = createSourcesRegistry();
  store.builtinCommandTable = { table: 1 };
  store.builtinCommandNames = new Set(['a']);
  store.shippedCommandNames = new Set(['b']);
  fill(store, ['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex', 'markdownFiles']);
  store.invalidateCommands();
  assert.equal(store.builtinCommandTable, undefined);
  assert.equal(store.builtinCommandNames, undefined);
  assert.equal(store.shippedCommandNames, undefined);
  assert.deepEqual(sizes(store, ['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex']), [0, 0, 0, 0]);
  assert.equal(store.markdownFiles.size, 1, 'a load cache is not the command surface');
});

test('invalidateSkillDirs clears the skill dirs and, when the current key has a state, its two containers', () => {
  const store = createSourcesRegistry();
  store.skillDirCommands.set('a:one', 1);
  store.dynamicSkillStates.set('cli', {
    ...dynamicState(),
    conditionalSkills: new Map([['c', 1]]),
    activatedConditionalSkillNames: new Set(['c']),
  });
  store.invalidateSkillDirs();
  assert.equal(store.skillDirCommands.size, 0);
  const state = store.dynamicSkillStates.get('cli')!;
  assert.equal(state.conditionalSkills.size, 0);
  assert.equal(state.activatedConditionalSkillNames.size, 0);
  assert.equal(store.dynamicSkillStates.size, 1, 'the state itself stays; only its conditional tables go');
  // With no state for the current key the second half is skipped and nothing throws.
  const bare = createSourcesRegistry();
  bare.skillDirCommands.set('a:one', 1);
  bare.invalidateSkillDirs();
  assert.equal(bare.skillDirCommands.size, 0);
});

test('clearLoadCaches is the command invalidation plus the eight derived tables', () => {
  const store = createSourcesRegistry();
  store.builtinCommandTable = { table: 1 };
  fill(store, ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles', 'allOutputStyles',
    'routines', 'routineCronTasks', 'allWorkflows', 'skillIndex']);
  store.clearLoadCaches();
  assert.equal(store.builtinCommandTable, undefined);
  assert.deepEqual(sizes(store, ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles',
    'allOutputStyles', 'routines', 'routineCronTasks', 'allWorkflows', 'skillIndex']),
  [0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('evictDynamicSkillState removes one id, its extras and only its own prefixed skill dirs', () => {
  const store = createSourcesRegistry();
  store.dynamicSkillStates.set('p1', dynamicState());
  store.dynamicSkillStates.set('p2', dynamicState());
  store.lastCollisionExtrasSpellings.set('p1', 1);
  store.lastCollisionExtrasSpellings.set('p2', 2);
  for (const key of ['p1:one', 'p1:two', 'p2:one', 'p1x:one']) store.skillDirCommands.set(key, key);
  store.evictDynamicSkillState('p1');
  assert.deepEqual([...store.skillDirCommands.keys()], ['p2:one', 'p1x:one'],
    'the prefix is `p1:`, so `p1x:` is another plugin');
  assert.deepEqual([...store.dynamicSkillStates.keys()], ['p2']);
  assert.deepEqual([...store.lastCollisionExtrasSpellings.keys()], ['p2']);
});

test('the reserved-spelling and missing-trusted-name helpers key their weak containers by object', () => {
  const store = createSourcesRegistry();
  const loaded = { name: 'loaded' };
  const other = { name: 'other' };
  let builds = 0;
  const first = store.reservedSpellingsFor(loaded, () => { builds += 1; return ['a']; });
  const second = store.reservedSpellingsFor(loaded, () => { builds += 1; return ['b']; });
  assert.equal(builds, 1, 'the second call reads the remembered []');
  assert.equal(first, second);
  assert.deepEqual(first, ['a']);
  assert.deepEqual(store.reservedSpellingsFor(other, () => ['c']), ['c'], 'another result builds its own');
  store.markLoadedResultMissingTrustedNames(loaded);
  assert.equal(store.loadedResultIsMissingTrustedNames(loaded), true);
  assert.equal(store.loadedResultIsMissingTrustedNames(other), false);
});

test('refusedReservedSkillNames reads the current key\'s table and answers empty without one', () => {
  const store = createSourcesRegistry();
  assert.deepEqual(store.refusedReservedSkillNames(), []);
  store.dynamicSkillStates.set('cli', {
    ...dynamicState(),
    refusedReservedNames: new Map([['x', 1], ['y', 2]]),
  });
  assert.deepEqual(store.refusedReservedSkillNames(), [1, 2]);
  store.dynamicSkillStates.set('other', { ...dynamicState(), refusedReservedNames: new Map([['z', 3]]) });
  assert.deepEqual(store.refusedReservedSkillNames(), [1, 2], 'only the current key\'s state is read');
});

test('memoizeOrBuild and nullableKey are the module\'s own exports', () => {
  const table = new Map<string, string[]>();
  let built = 0;
  const first = memoizeOrBuild(table, 'k', () => { built += 1; return ['v']; });
  const second = memoizeOrBuild(table, 'k', () => { built += 1; return ['other']; });
  assert.equal(built, 1);
  assert.equal(first, second);
  assert.equal(table.size, 1);
  assert.equal(nullableKey(null), '\u0000');
  assert.equal(nullableKey(undefined), '\u0000');
  assert.equal(nullableKey('a'), 'a');
});

test('xr is one store per process, and a fresh one is not it', () => {
  assert.equal(xr(), xr());
  assert.notEqual(createSourcesRegistry(), xr());
  xr().markdownFiles.set('marker', 1);
  assert.equal(xr().markdownFiles.get('marker'), 1);
  xr().markdownFiles.clear();
});
