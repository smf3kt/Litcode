// The skill, command and agent source registry (W45-41): the store every invalidation in the
// plugin-source family reaches, and the one W45-40's five clears could only name.
//
// Source: chunk-qm4226vk.js, 3,516 units, the whole module. It is five declarations and a memo:
//
//   var o="cli"                                          [710,722)   the source kind the dynamic-skill state key is built from
//   class s{…}                                           [722,3319)  the store: 45 field initialisers, eight methods
//   function pQ(table,key,build){…}                      [3319,3406) memoise-or-build for a keyed table
//   function fQ(key){return key??"\x00"}                 [3406,3438) the nullable-key normaliser
//   export{pQ,fQ,xr}                                     [3498,3515)
//
// and the boundary between them, quoted as the module writes it:
//   [3438,3497)  var a=new q(()=>new s);function xr(){return a.of(B().host)}
//
// Four of those are copied verbatim into ./plugin-chain-sources-registry-source.ts (4 blocks, 2,728
// units): `o`, the class, `pQ` and `fQ`. The accessor is the host boundary and is not copied, for the
// reason W45-40 recorded for the plugin registry: the source builds one store per host under the memo
// `q(() => new s)` reached through `B().host`, and this product has one host for the process, so
// `xr()` below builds the singleton lazily instead. The source's `xr` is not exported either — the
// module exports only `pQ`, `fQ` and `xr` — so keeping the name and the laziness is what makes the
// copied bodies that call `xr().<field>` mean the same thing here.
//
// The class is the table of everything the loader derives from folders, marketplaces and builtins:
// load caches (`markdownFiles`, `agentDefinitions`, `outputStyleDirStyles`, `allOutputStyles`,
// `routines`, `routineCronTasks`, `allWorkflows`), the command tables (`builtinCommandTable`,
// `builtinCommandNames`, `shippedCommandNames`, `loadedCommands`, `skillToolCommands`,
// `slashCommandToolSkills`, `skillIndex`), the skill tables (`bundledSkills`, `skillDirCommands`,
// `skillFiles`, `bundledWorkflows`, `builtinPlugins`) and the signals `dynamicSkillsLoaded` and
// `skillsChanged`. W45-40's five clears drop the plugin registry's slots; these clears drop the
// derived tables, and the two are separate stores on purpose.
//
// `refusedReservedSkillNames` and the reserved-spelling helpers read `dynamicSkillStates`, a Map keyed
// by `dynamicSkillStateKey()` — which is `o`, the source kind `"cli"`.
import { fQ, pQ, s } from './plugin-chain-sources-registry-source.js';

/** A change signal, the shape `Oe()` builds and the store holds two of. */
export interface SourcesChangeSignal {
  subscribe: (listener: (...args: unknown[]) => void) => () => void;
  emit: (...args: unknown[]) => void;
  clear: () => void;
}

/** The per-source-kind state `dynamicSkillStates` holds. Only the three fields the ported bodies reach
 *  are named; the source's own object carries more, and the copied class is what builds it. */
export interface DynamicSkillState {
  refusedReservedNames: Map<string, unknown>;
  conditionalSkills: Map<string, unknown>;
  activatedConditionalSkillNames: Set<string>;
}

/** The store, typed field by field as the source's class initialises them: four `WeakMap`s and a
 *  `WeakSet` keep their weakness (so a caller must key them with objects), four fields are arrays, two
 *  are Sets, the rest are Maps, and the eight `void 0` fields start unset. */
export interface SourcesRegistry {
  bundledSkills: unknown[];
  bundledSkillKillSwitchSurvivors: Set<unknown>;
  bundledSkillSessionResetHooks: unknown[];
  bundledSkillsInitialized: boolean;
  shippedTablesFillFailed: boolean;
  bundledSkillFilesElsewhere: unknown;
  commandsOffHere: unknown;
  attachedFolderSkills: unknown;
  builtinToolsServedByMcp: unknown;
  builtinCommandTable: unknown;
  builtinCommandNames: unknown;
  shippedCommandNames: unknown;
  loadedCommands: Map<string, unknown>;
  skillToolCommands: Map<string, unknown>;
  slashCommandToolSkills: Map<string, unknown>;
  skillIndex: Map<string, unknown>;
  reservedSpellingsByLoadedResult: WeakMap<object, string[]>;
  loadedResultsMissingTrustedNames: WeakSet<object>;
  skillDirCommands: Map<string, unknown>;
  dynamicSkillStates: Map<string, DynamicSkillState>;
  lastCollisionExtrasSpellings: Map<string, unknown>;
  dynamicSkillsLoaded: SourcesChangeSignal;
  skillsChanged: SourcesChangeSignal;
  replacedSkillNames: Map<string, unknown>;
  replacedSkillNamesSeq: number;
  shadowedBundledSkills: unknown;
  fallbackShadowTelemetryLogged: Set<unknown>;
  skillContentIntern: Map<string, unknown>;
  skillFiles: WeakMap<object, unknown>;
  builtinPlugins: Map<string, unknown>;
  builtinPluginsInitialized: boolean;
  builtinPluginFailures: Map<string, unknown>;
  builtinPluginWiredSkills: WeakMap<object, unknown>;
  bundledWorkflows: unknown[];
  markdownFiles: Map<string, unknown>;
  markdownScansGivenUp: number;
  agentDefinitions: Map<string, unknown>;
  projectAgentsElsewhere: unknown[];
  outputStyleDirStyles: Map<string, unknown>;
  allOutputStyles: Map<string, unknown>;
  routines: Map<string, unknown>;
  routineCronTasks: Map<string, unknown>;
  allWorkflows: Map<string, unknown>;
  dynamicSkillStateKey(): string;
  reservedSpellingsFor(result: object, build: () => string[]): string[];
  refusedReservedSkillNames(): unknown[];
  markLoadedResultMissingTrustedNames(result: object): void;
  loadedResultIsMissingTrustedNames(result: object): boolean;
  clearLoadCaches(): void;
  invalidateCommands(): void;
  invalidateSkillDirs(): void;
  evictDynamicSkillState(id: string): void;
}

/** `s()` — a fresh store, the class the source's memo builds per host. */
export function createSourcesRegistry(): SourcesRegistry {
  return new s() as unknown as SourcesRegistry;
}

let registry: SourcesRegistry | null = null;

/** Source `xr()` [3461,3497): `a.of(B().host)` over the memo `new q(() => new s)`. This product has one
 *  host for the process, so the store is built on the first call and kept — the same lowering the
 *  plugin registry's `it()` records, and for the same reason. */
export function xr(): SourcesRegistry {
  if (registry === null) registry = createSourcesRegistry();
  return registry;
}

/** Source `pQ(table,key,build)` [3319,3406): the entry for a key, built and remembered on first use. */
export function memoizeOrBuild<T>(table: Map<string, T>, key: string, build: () => T): T {
  return pQ(table, key, build) as T;
}

/** Source `fQ(key)` [3406,3438): the key a nullable id is stored under. */
export function nullableKey(key: string | null | undefined): string {
  return fQ(key) as string;
}
