/**
 * `/plugin`'s Installed list. Recovered from `chunk-tw1h5pks.js`, sha256
 * `a2e774c2edf6cae411ba63eaf5ce554b8f92d00ed5ab9597311e7bc36d2990f7`: the local component `fc` at
 * 216895 renders `Installed plugins:` over `  • <id> (<version>, <scope>) <status>` rows and
 * `No plugins installed. Use \`/plugin install\` to install a plugin.` when the store is empty.
 * `AKt` (`chunk-sfn1dbxq.js` sha256
 * `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, 3875439) supplies the `v`
 * version prefix; the glyphs come from `te` (`chunk-04v7vxqn.js`, already ported as
 * `src/tui-symbols.ts`). Offsets are zero-based UTF-16 code units.
 */

import { te } from './tui-symbols.js';

export const PLUGIN_PANEL_TITLE = 'Plugins';
export const PLUGIN_PANEL_HEADER = 'Installed plugins:';
export const PLUGIN_PANEL_EMPTY = 'No plugins installed. Use `/plugin install` to install a plugin.';

/** One installed record as the list needs it. */
export interface PluginPanelEntry {
  readonly name: string;
  readonly version?: string;
  /** `xh`'s scope label; this host keeps one workspace-local store, so every row is `project`. */
  readonly scope: string;
  /** The installed tree still matches its index digest. */
  readonly verified: boolean;
  /** The store's global gate (`plugins.enabled`); a disabled store loads nothing. */
  readonly enabled: boolean;
}

/** Source `AKt`: the first real version among the candidates, prefixed with `v`. */
export function pluginVersionLabel(...versions: readonly (string | undefined)[]): string | undefined {
  const found = versions.find(version => version !== undefined && version !== '' && version !== 'unknown');
  return found === undefined ? undefined : `v${found}`;
}

/** `vt`'s 100-unit cut for the version cell, ellipsis included. */
function cut(value: string): string {
  return value.length > 100 ? `${value.slice(0, 100)}…` : value;
}

/** `fc`'s status cell: a failed verification wins, then the store's enabled gate. */
export function pluginStatusText(entry: PluginPanelEntry): string {
  if (!entry.verified) return `${te.cross} failed to load`;
  return entry.enabled ? `${te.tick} enabled` : `${te.cross} disabled`;
}

/** `fc`: `<id> (<version>, <scope>)`, with the version cell only when one resolves. */
export function pluginRowLabel(entry: PluginPanelEntry): string {
  const version = pluginVersionLabel(entry.version);
  return version === undefined ? `${entry.name} (${entry.scope})` : `${entry.name} (${cut(version)}, ${entry.scope})`;
}

/** `fc` sorts the store's ids and keeps one row per record. */
export function pluginPanelRows(entries: readonly PluginPanelEntry[]): { label: string; value: string; description: string }[] {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name))
    .map(entry => ({ label: pluginRowLabel(entry), value: entry.name, description: pluginStatusText(entry) }));
}

/** `fc`: the header plus one `  • …` row per plugin, or the empty message. */
export function pluginPanelText(entries: readonly PluginPanelEntry[]): string {
  if (entries.length === 0) return PLUGIN_PANEL_EMPTY;
  return [PLUGIN_PANEL_HEADER, ...pluginPanelRows(entries).map(row => `  • ${row.label} ${row.description}`)].join('\n');
}

/** `fc`'s `No ${filter} plugins.` when a filter narrows the list to nothing. */
export function pluginFilteredEmpty(filter: string): string {
  return `No ${filter} plugins.`;
}

export type PluginListFilter = 'enabled' | 'disabled';

/** `fc`'s `filter` prop: a disabled record leaves the enabled view and the reverse. */
export function filterPluginEntries(entries: readonly PluginPanelEntry[], filter?: PluginListFilter): PluginPanelEntry[] {
  if (filter === undefined) return [...entries];
  const wantEnabled = filter === 'enabled';
  return entries.filter(entry => (entry.verified && entry.enabled) === wantEnabled);
}
