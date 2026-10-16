// W45-41 probe: measure the copied source registry — its cold defaults, its eight methods, the two
// export helpers and the accessor seam — before any assertion is written against it.
import {
  createSourcesRegistry, memoizeOrBuild, nullableKey, xr,
} from '../src/plugin-chain-sources-registry.js';

const rows: Array<Record<string, unknown>> = [];
const show = (value: unknown): string => (typeof value === 'undefined' ? 'undefined' : JSON.stringify(value));
const sizeOf = (value: unknown): unknown => {
  if (value instanceof Map || value instanceof Set) return value.size;
  if (Array.isArray(value)) return value.length;
  return show(value);
};

// 1. The cold store: the shape the class builds when the memo makes one.
const cold = createSourcesRegistry();
const containers = ['bundledSkills', 'skillDirCommands', 'skillFiles', 'loadedCommands', 'skillToolCommands',
  'slashCommandToolSkills', 'skillIndex', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles',
  'allOutputStyles', 'routines', 'routineCronTasks', 'allWorkflows', 'dynamicSkillStates',
  'lastCollisionExtrasSpellings', 'reservedSpellingsByLoadedResult', 'loadedResultsMissingTrustedNames'] as const;
rows.push({ probe: 'cold/containers', sizes: Object.fromEntries(containers.map((key) => [key, sizeOf((cold as any)[key])])) });
rows.push({ probe: 'cold/weak-containers', values: ['reservedSpellingsByLoadedResult', 'loadedResultsMissingTrustedNames', 'skillFiles', 'builtinPluginWiredSkills']
  .map((key) => `${key}=${(cold as any)[key]?.constructor?.name ?? show((cold as any)[key])}`).join(' ') });
rows.push({ probe: 'cold/command-tables', values: ['builtinCommandTable', 'builtinCommandNames', 'shippedCommandNames']
  .map((key) => `${key}=${show((cold as any)[key])}`).join(' ') });
rows.push({ probe: 'cold/signals', values: ['dynamicSkillsLoaded', 'skillsChanged']
  .map((key) => `${key}=${(cold as any)[key] && typeof (cold as any)[key].emit === 'function' ? 'signal' : show((cold as any)[key])}`).join(' ') });
rows.push({ probe: 'cold/dynamicSkillStateKey', value: cold.dynamicSkillStateKey() });
rows.push({ probe: 'cold/refusedReservedSkillNames', value: show(cold.refusedReservedSkillNames()) });

// 2. invalidateCommands: which containers empty and which fields go back to undefined.
const commands = createSourcesRegistry();
commands.builtinCommandTable = { table: 1 };
commands.builtinCommandNames = new Set(['a']);
commands.shippedCommandNames = new Set(['b']);
for (const key of ['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex'] as const) {
  (commands as any)[key].set('k', 'v');
}
commands.markdownFiles.set('untouched', 'v');
commands.invalidateCommands();
rows.push({ probe: 'invalidateCommands', fields: ['builtinCommandTable', 'builtinCommandNames', 'shippedCommandNames']
  .map((key) => `${key}=${show((commands as any)[key])}`).join(' '),
containers: ['loadedCommands', 'skillToolCommands', 'slashCommandToolSkills', 'skillIndex', 'markdownFiles']
  .map((key) => `${key}=${sizeOf((commands as any)[key])}`).join(' ') });

// 3. invalidateSkillDirs, with and without a dynamic state for the current key.
const dirs = createSourcesRegistry();
dirs.skillDirCommands.set('a:one', 1);
dirs.dynamicSkillStates.set('cli', { refusedReservedNames: new Map(), conditionalSkills: new Map([['c', 1]]), activatedConditionalSkillNames: new Set(['c']) });
dirs.invalidateSkillDirs();
const state = dirs.dynamicSkillStates.get('cli')!;
rows.push({ probe: 'invalidateSkillDirs/with-state', skillDirCommands: dirs.skillDirCommands.size,
  conditionalSkills: state.conditionalSkills.size, activated: state.activatedConditionalSkillNames.size });
const noState = createSourcesRegistry();
noState.skillDirCommands.set('a:one', 1);
let threw = '';
try { noState.invalidateSkillDirs(); } catch (error) { threw = String(error); }
rows.push({ probe: 'invalidateSkillDirs/without-state', threw: threw || 'no', skillDirCommands: noState.skillDirCommands.size });

// 4. clearLoadCaches: the commands invalidation plus the seven derived tables.
const caches = createSourcesRegistry();
caches.builtinCommandTable = { table: 1 };
for (const key of ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles', 'allOutputStyles',
  'routines', 'routineCronTasks', 'allWorkflows'] as const) {
  (caches as any)[key].set('k', 'v');
}
caches.skillIndex.set('kept-by-commands-only', 'v');
caches.clearLoadCaches();
rows.push({ probe: 'clearLoadCaches', builtinCommandTable: show(caches.builtinCommandTable),
  containers: ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles', 'allOutputStyles',
    'routines', 'routineCronTasks', 'allWorkflows', 'skillIndex'].map((key) => `${key}=${sizeOf((caches as any)[key])}`).join(' ') });

// 5. evictDynamicSkillState: the state, the collision extras, and only that id's skill-dir entries.
const evict = createSourcesRegistry();
evict.dynamicSkillStates.set('p1', { refusedReservedNames: new Map(), conditionalSkills: new Map(), activatedConditionalSkillNames: new Set() });
evict.dynamicSkillStates.set('p2', { refusedReservedNames: new Map(), conditionalSkills: new Map(), activatedConditionalSkillNames: new Set() });
evict.lastCollisionExtrasSpellings.set('p1', 1);
evict.lastCollisionExtrasSpellings.set('p2', 2);
for (const key of ['p1:one', 'p1:two', 'p2:one', 'p1x:one']) evict.skillDirCommands.set(key, key);
evict.evictDynamicSkillState('p1');
rows.push({ probe: 'evictDynamicSkillState/p1', skillDirCommands: [...evict.skillDirCommands.keys()],
  dynamicSkillStates: [...evict.dynamicSkillStates.keys()], collisionExtras: [...evict.lastCollisionExtrasSpellings.keys()] });

// 6. The reserved-spelling and missing-trusted-names helpers.
const spellings = createSourcesRegistry();
const loaded = { name: 'loaded-1' };
const otherLoaded = { name: 'loaded-2' };
let builds = 0;
const first = spellings.reservedSpellingsFor(loaded, () => { builds += 1; return ['a']; });
const second = spellings.reservedSpellingsFor(loaded, () => { builds += 1; return ['b']; });
rows.push({ probe: 'reservedSpellingsFor/memoised', builds, same: first === second, value: show(first) });
spellings.markLoadedResultMissingTrustedNames(loaded);
rows.push({ probe: 'loadedResultIsMissingTrustedNames', after: spellings.loadedResultIsMissingTrustedNames(loaded),
  other: spellings.loadedResultIsMissingTrustedNames(otherLoaded) });
const refused = createSourcesRegistry();
refused.dynamicSkillStates.set('cli', { refusedReservedNames: new Map([['x', 1], ['y', 2]]), conditionalSkills: new Map(), activatedConditionalSkillNames: new Set() });
rows.push({ probe: 'refusedReservedSkillNames/with-state', value: show(refused.refusedReservedSkillNames()) });

// 7. The helpers the module exports on their own, and the accessor seam.
const table = new Map<string, string[]>();
let built = 0;
const memo = memoizeOrBuild(table, 'k', () => { built += 1; return ['v']; });
const memo2 = memoizeOrBuild(table, 'k', () => { built += 1; return ['other']; });
rows.push({ probe: 'memoizeOrBuild', built, same: memo === memo2, size: table.size, value: show(memo) });
rows.push({ probe: 'nullableKey', values: [nullableKey(null), nullableKey(undefined), nullableKey('a')].map(show).join(' ') });
rows.push({ probe: 'xr/singleton', same: xr() === xr(), fresh: createSourcesRegistry() !== xr(), key: xr().dynamicSkillStateKey() });

console.log(JSON.stringify({ schema: 'W45SourcesRegistryProbe.v1', rows }, null, 1));
