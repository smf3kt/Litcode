// W45-42 probe: measure what each copied invalidation call drops against the two registries it reaches,
// so the regression can assert "this table and no other".
import { it } from '../src/plugin-chain-host.js';
import {
  clearHookRegistration, invalidateAgentSources, invalidateOutputStyleSources, invalidateSkillSources,
} from '../src/plugin-chain-invalidate.js';
import { xr } from '../src/plugin-chain-sources-registry.js';

const plugin = it() as unknown as Record<string, unknown>;
const sources = xr();
const rows: Array<Record<string, unknown>> = [];

const sourceTables = ['skillDirCommands', 'markdownFiles', 'agentDefinitions', 'outputStyleDirStyles',
  'allOutputStyles', 'routines', 'routineCronTasks', 'allWorkflows', 'builtinCommandTable'] as const;
const pluginSlots = ['agents', 'outputStyles', 'commands', 'skills', 'skillsV5', 'workflows', 'hookRegistration'] as const;

/** Fill every watched table and slot with a marker, then report each one's value after a call. */
const seed = (): void => {
  for (const key of sourceTables) {
    const value = (sources as unknown as Record<string, unknown>)[key];
    if (value instanceof Map) value.set('k', 'v');
    else (sources as unknown as Record<string, unknown>)[key] = 'marker';
  }
  sources.dynamicSkillStates.set('cli', {
    refusedReservedNames: new Map([['x', 1]]),
    conditionalSkills: new Map([['c', 1]]),
    activatedConditionalSkillNames: new Set(['c']),
  });
  for (const key of pluginSlots) plugin[key] = 'marker';
};
const report = (): string => [...sourceTables.map((key) => {
  const value = (sources as unknown as Record<string, unknown>)[key];
  return `${key}=${value instanceof Map ? value.size : String(value)}`;
}), ...pluginSlots.map((key) => `plugin.${key}=${String(plugin[key])}`)].join(' ');

const calls: Array<[string, () => void]> = [
  ['Hz/invalidateSkillSources', invalidateSkillSources],
  ['YCn/clearHookRegistration', clearHookRegistration],
  ['_7/invalidateAgentSources', invalidateAgentSources],
  ['bCn/invalidateOutputStyleSources', invalidateOutputStyleSources],
];
for (const [name, call] of calls) {
  seed();
  call();
  const after = report();
  rows.push({ probe: name, after });
  rows.push({
    probe: `${name}/changed`,
    // Which of the watched names moved: the source's tables and the plugin registry's slots.
    changed: after.split(' ').filter((entry) => /=(0|undefined)$/.test(entry)),
  });
  call();
  rows.push({ probe: `${name}/twice`, same: report() === after });
}

// The dynamic-skill state's conditional tables are part of the skills invalidation, and only of it.
seed();
invalidateSkillSources();
const state = sources.dynamicSkillStates.get('cli')!;
rows.push({ probe: 'skills/conditional-tables', conditionalSkills: state.conditionalSkills.size,
  activated: state.activatedConditionalSkillNames.size, refusedReservedNames: state.refusedReservedNames.size });

// The markdown-file table is dropped by three of the four calls and by no other single table.
for (const [name, call] of calls.slice(0, 1).concat(calls.slice(2))) {
  seed();
  call();
  rows.push({ probe: `${name}/markdown`, markdownFiles: sources.markdownFiles.size, agents: plugin.agents === undefined ? 'cleared' : 'kept' });
}

console.log(JSON.stringify({ schema: 'W45InvalidateProbe.v1', rows }, null, 1));
