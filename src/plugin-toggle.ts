import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { permissionSettingsPaths, queuePermissionSettingsWrite } from './permission-settings.js';
import { pluginConfigSchema, pluginEnabled, pluginEnabledMapSchema, readPluginStore, type PluginConfig } from './plugins.js';
import type { SessionConfig } from './session.js';

export type PluginToggleScope = 'user' | 'project' | 'local';
export type PluginToggleSettings = Pick<SessionConfig, 'workspace' | 'configSources' | 'plugins'>;
type Layer = { file: string; scope: PluginToggleScope | 'flag'; plugins?: z.infer<ReturnType<typeof pluginConfigSchema.partial>> };
const object = z.record(z.unknown());
function document(file: string): { value: Record<string, unknown>; mode: number } {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Plugin settings must be a regular file');
    const bytes = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (bytes.overflow) throw new Error('Plugin settings exceed the byte limit');
    return { value: object.parse(JSON.parse(bytes.buffer.toString('utf8') || '{}')), mode: stat.mode & 0o777 };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { value: {}, mode: 0o600 };
    throw error;
  }
}

// Clt/In, nrk8z90j [10632,11156), tm17ttjb [126677,127158), UTF-16; local scope order replaces source IDs.
function layers(config: PluginToggleSettings): Layer[] {
  const files = permissionSettingsPaths(config.workspace, config.configSources?.userDir ?? defaultUserDir());
  const rows: Layer[] = [{ file: files.userSettings!, scope: 'user' }, { file: files.projectSettings!, scope: 'project' },
    ...(files.legacyLocalSettings ? [{ file: files.legacyLocalSettings, scope: 'local' as const }] : []),
    { file: files.localSettings!, scope: 'local' },
    ...(config.configSources?.settingsFile ? [{ file: path.resolve(config.workspace, config.configSources.settingsFile), scope: 'flag' as const }] : [])];
  return rows.map(row => {
    const value = document(row.file).value.plugins;
    return { ...row, ...(value === undefined ? {} : { plugins: pluginConfigSchema.partial().parse(value) }) };
  });
}

export function desiredPluginConfig(config: PluginToggleSettings): PluginConfig {
  const { enabledPlugins: _previous, ...base } = config.plugins ?? {};
  let result: PluginConfig = base;
  for (const layer of layers(config)) if (layer.plugins) result = { ...result, ...layer.plugins,
    enabledPlugins: { ...result.enabledPlugins, ...layer.plugins.enabledPlugins } };
  return pluginConfigSchema.parse(result);
}

export type PluginToggleResult = { success: true; message: string; name: string; enabled: boolean; scope: PluginToggleScope }
  | { success: false; message: string; alreadyInGoalState?: true };

// Sn/jn, tm17ttjb [90191,100347)/[128356,128738), UTF-16; installed local names need no marketplace resolver.
export async function setPluginEnabled(config: PluginToggleSettings, name: string, enabled: boolean): Promise<PluginToggleResult> {
  pluginEnabledMapSchema.parse({ [name]: enabled });
  const store = readPluginStore(config.workspace, config.plugins);
  const entry = store.entries.find(entry => entry.name === name);
  if (!entry) return { success: false, message: `Plugin "${name}" is not installed in this project` };
  const records = layers(config), target = records.findLast(layer => layer.plugins?.enabledPlugins?.[name] !== undefined)
    ?? records.find(layer => layer.scope === 'project')!;
  if (target.scope === 'flag') return { success: false, message: `Plugin "${name}" is governed by the explicit settings file. Change it there.` };
  const scope = target.scope;
  const desired = desiredPluginConfig(config);
  if (pluginEnabled(name, desired) === enabled) return { success: false, alreadyInGoalState: true,
    message: `Plugin "${name}" is already ${enabled ? 'enabled' : 'disabled'}` };
  if (enabled && desired.enabled !== true) return { success: false,
    message: 'Enable plugins.enabled in settings before enabling an installed plugin.' };
  await queuePermissionSettingsWrite(target.file, () => {
    const current = document(target.file), previous = current.value.plugins === undefined ? {} : object.parse(current.value.plugins);
    const map = pluginEnabledMapSchema.parse(previous.enabledPlugins ?? {});
    current.value.plugins = { ...previous, enabledPlugins: { ...map, [name]: enabled } };
    const text = JSON.stringify(current.value, null, 2) + '\n';
    if (Buffer.byteLength(text) > CONFIG_LIMITS.settingsBytes) throw new Error('Plugin settings exceed the byte limit');
    atomicWriteFile(target.file, text, { mode: current.mode, label: 'setPluginEnabled' });
  });
  return { success: true, name, enabled, scope, message: `Successfully ${enabled ? 'enabled' : 'disabled'} plugin: ${name} (scope: ${scope})` };
}
