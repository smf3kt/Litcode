// W45-40 probe: measure the copied invalidation bodies against the registry they operate on, and the
// four compositions the source's own call sites build out of them.
import { it } from '../src/plugin-chain-host.js';
import { createPluginRegistryState } from '../src/plugin-chain-registry-state.js';
import {
  pluginLoadCacheOnly,
  registeredAgentExists,
  resetAgents,
  resetCommands,
  resetOutputStyles,
  resetSkills,
  resetWorkflows,
} from '../src/plugin-chain-registry-reset.js';

const reg = it() as unknown as Record<string, unknown>;
const rows: Array<Record<string, unknown>> = [];
const show = (value: unknown): string => (typeof value === 'undefined' ? 'undefined' : JSON.stringify(value));

// Every field a reset or a read touches, plus sentinels no reset may touch.
const targets = ['commands', 'skills', 'skillsV5', 'agents', 'outputStyles', 'workflows', 'pluginLoadCacheOnly'];
const sentinels = ['pluginLoad', 'handedIn', 'hookRegistrationEpoch', 'registeredAgents'];

const seed = (): void => {
  reg.commands = ['c'];
  reg.skills = ['s'];
  reg.skillsV5 = ['s5'];
  reg.agents = ['a'];
  reg.outputStyles = ['o'];
  reg.workflows = ['w'];
  reg.pluginLoadCacheOnly = true;
  reg.pluginLoad = 'sentinel-pluginLoad';
  reg.handedIn = 'sentinel-handedIn';
  reg.hookRegistrationEpoch = 7;
};

const guarded = [...targets, ...sentinels];
/** Which of the named fields differ from the snapshot, with their value after the call. */
const diff = (before: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(guarded.filter(name => !Object.is(before[name], reg[name])).map(name => [name, show(reg[name])]));
const snapshot = (): Record<string, unknown> => Object.fromEntries(guarded.map(key => [key, reg[key]]));

// 1. The two reads.
reg.registeredAgents = new Map([['alpha', { id: 'alpha' }]]);
rows.push({ probe: 'registeredAgentExists/hit', value: registeredAgentExists('alpha') });
rows.push({ probe: 'registeredAgentExists/miss', value: registeredAgentExists('beta') });
(reg.registeredAgents as Map<string, unknown>).delete('alpha');
rows.push({ probe: 'registeredAgentExists/after-delete', value: registeredAgentExists('alpha') });
reg.pluginLoadCacheOnly = undefined;
rows.push({ probe: 'pluginLoadCacheOnly/default', value: show(pluginLoadCacheOnly()) });
reg.pluginLoadCacheOnly = true;
rows.push({ probe: 'pluginLoadCacheOnly/set', value: show(pluginLoadCacheOnly()) });

// 2. Each reset on its own, with every other guarded field seeded, so an over-broad body shows up.
const singles: Array<[string, () => void]> = [
  ['Nhr', resetCommands], ['Fhr', resetSkills], ['$hr', resetAgents],
  ['Uhr', resetOutputStyles], ['UDn', resetWorkflows],
];
for (const [name, run] of singles) {
  seed();
  const before = snapshot();
  run();
  rows.push({ probe: `reset/${name}`, changed: diff(before) });
}

// 3. Idempotence: a reset over an already-cleared slot changes nothing more and throws nothing.
seed();
resetCommands();
const clearedOnce = snapshot();
resetCommands();
rows.push({ probe: 'reset/Nhr/idempotent', stable: guarded.every(key => Object.is(clearedOnce[key], reg[key])) });

// 4. The four compositions the source runs, read out of chunk-sfn1dbxq.js: bM(), the reset half of
//    zLr(), _7() and bCn().
const compositions: Array<[string, Array<() => void>]> = [
  ['bM', [resetCommands, resetSkills]],
  ['zLr/reset-half', [resetCommands, resetAgents, resetOutputStyles, resetWorkflows]],
  ['_7', [resetAgents]],
  ['bCn', [resetOutputStyles]],
];
for (const [name, parts] of compositions) {
  seed();
  const before = snapshot();
  for (const part of parts) part();
  rows.push({ probe: `compose/${name}`, changed: diff(before) });
}

// 5. On a cold registry every field a reset writes is already the value it writes, so the resets are
//    no-ops there; and the registry literal the product installs carries every one of those fields,
//    so none of the five writes lands on a field this port does not have.
const fresh = createPluginRegistryState() as unknown as Record<string, unknown>;
rows.push({ probe: 'fresh-literal/targets-already-cleared', notUndefined: targets.filter(key => fresh[key] !== undefined) });
rows.push({ probe: 'fresh-literal/targets-present', missing: targets.filter(key => !(key in fresh)) });
rows.push({ probe: 'fresh-literal/sentinel-present', missing: sentinels.filter(key => !(key in fresh)) });

console.log(JSON.stringify({ schema: 'W45RegistryResetProbe.v1', rows }, null, 1));
