/**
 * `/reload-plugins`. Recovered from `chunk-x876fw6t.js`, sha256
 * `82f072d959103651ec4007a02691e4b1883602213581c89d88809dca574beef2`: the registration `MTo` in
 * `chunk-sfn1dbxq.js` 1639842 (`local`, `Activate pending plugin changes in the current session`,
 * argument hint `[--force]`), the body `Yr` at 16694, the declined line `Re` at 16550, the pending
 * note `we` at 16629, the force parser at 17319, the summary `Reloaded: …` at 18369, the
 * non-interactive gate `Ee` at 19098, the cache check `Q` at 19162, the count formatter `l` at
 * 19417 and the warning `Z` at 19456. The pluralizer `I` is `chunk-ax7r0qj7.js` 798
 * (`t === 1 ? n : n + "s"`), sha256
 * `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e`. Offsets are zero-based
 * UTF-16 code units.
 */

export const RELOAD_PLUGINS_DECLINED = "/reload-plugins isn't available over a remote connection in this session.";
export const HEADLESS_MCP_PENDING_NOTE = 'Plugin MCP server changes take effect in your next session.';

/** Source `I`: `t === 1 ? n : n + "s"`. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Source `l`: `<count> <noun>`. */
export function counted(count: number, noun: string): string {
  return `${count} ${pluralize(count, noun)}`;
}

/** Source `r`: a `--force` or `force` token anywhere in the argument. */
export function reloadPluginsForced(argument: string): boolean {
  return argument.trim().split(/\s+/).some(token => token === '--force' || token === 'force');
}

export interface PluginReloadCounts {
  readonly plugins: number;
  readonly skills: number;
  readonly agents: number;
  readonly hooks: number;
  readonly mcpServers: number;
  readonly lspServers: number;
  readonly errors: number;
}

/**
 * Source `h`: `Reloaded: N plugins · N skills · N agents · N hooks · N plugin MCP servers ·
 * N plugin LSP servers`, then the load-error line. A non-interactive session drops the MCP count
 * and gets the pending note when servers changed.
 */
export function pluginReloadSummary(counts: PluginReloadCounts, options: { nonInteractive?: boolean;
  mcpChanged?: boolean; cacheWarning?: string | null } = {}): string {
  const parts = [counted(counts.plugins, 'plugin'), counted(counts.skills, 'skill'),
    counted(counts.agents, 'agent'), counted(counts.hooks, 'hook'),
    ...(options.nonInteractive ? [] : [counted(counts.mcpServers, 'plugin MCP server')]),
    counted(counts.lspServers, 'plugin LSP server')];
  let text = `Reloaded: ${parts.join(' · ')}`;
  if (options.nonInteractive && options.mcpChanged) text += `\n${HEADLESS_MCP_PENDING_NOTE}`;
  if (options.cacheWarning !== undefined && options.cacheWarning !== null) text += `\n${options.cacheWarning}`;
  if (counts.errors > 0) text += `\n${counted(counts.errors, 'error')} during load. Run /plugin for details.`;
  return text;
}

/**
 * Source `Z`: the cache warning. The single-name form is `Nn`'s display name of the changed
 * server — the last two `:`-separated segments of `plugin:<plugin>:<server>`, or the whole name.
 */
export function formatCacheWarningText(change: { added: readonly string[]; removed: readonly string[];
  lspToolChange: 'may-add' | 'may-remove' | string | null }): string {
  const names = [...change.added, ...change.removed];
  const first = names[0];
  const label = names.length === 1 && first !== undefined
    ? (first.split(':').slice(2).join(':') || first) : `${names.length} MCP servers`;
  const causes: string[] = [];
  if (names.length > 0) causes.push(`changes MCP tools (${label})`);
  if (change.lspToolChange !== null) {
    causes.push(change.lspToolChange === 'may-add' ? 'may add the LSP tool'
      : change.lspToolChange === 'may-remove' ? 'may remove the LSP tool' : `${change.lspToolChange} the LSP tool`);
  }
  return `This reload ${causes.join(' and ')} — your next message will re-read `
    + 'the whole conversation instead of using the cache. Run /reload-plugins --force to apply.';
}

/**
 * Source `Q`: no warning when nothing would invalidate the cache. In an interactive session the
 * LSP change alone is not enough; a non-interactive session warns for any MCP or LSP change.
 */
export function pluginCacheWarning(change: PluginServerDiff & { lspToolChange: 'may-add' | 'may-remove' | string | null },
  nonInteractive: boolean): string | null {
  if (!change.wouldInvalidateCache) return null;
  if (!nonInteractive) {
    return formatCacheWarningText({ added: change.added, removed: change.removed,
      lspToolChange: change.lspToolChange });
  }
  if (change.lspToolChange === null) return null;
  return formatCacheWarningText({ added: [], removed: [], lspToolChange: change.lspToolChange });
}

export interface PluginServerIdentity {
  /** The plugin the server came from, or undefined for an authored server. */
  readonly plugin?: string;
  /** The server name inside the plugin's `mcpServers` file. */
  readonly name: string;
}

/**
 * The server rows one reload diff compares. This host names plugin servers
 * `<plugin>/<server>` (the store's own convention), while the source compares the
 * full `plugin:<plugin>:<server>` id; both are reduced to the same pair so a
 * renamed host key does not read as a change.
 */
export function pluginServerIdentities(servers: Iterable<string>): PluginServerIdentity[] {
  const rows: PluginServerIdentity[] = [];
  for (const server of servers) {
    const colon = server.split(':');
    if (colon.length === 3 && colon[0] === 'plugin') { rows.push({ plugin: colon[1]!, name: colon[2]! }); continue; }
    const slash = server.indexOf('/');
    if (slash > 0) { rows.push({ plugin: server.slice(0, slash), name: server.slice(slash + 1) }); continue; }
    rows.push({ name: server });
  }
  return rows;
}

export interface PluginServerDiff {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Added or removed rows only; a server whose definition changed keeps the cache. */
  readonly wouldInvalidateCache: boolean;
}

/** The source's `q4` comparison, over two server-name sets. */
export function diffPluginServers(before: readonly string[], after: readonly string[]): PluginServerDiff {
  const key = (row: PluginServerIdentity) => row.plugin === undefined ? row.name : `${row.plugin}/${row.name}`;
  const previous = new Map(pluginServerIdentities(before).map(row => [key(row), row]));
  const next = new Map(pluginServerIdentities(after).map(row => [key(row), row]));
  const added = [...next].filter(([name]) => !previous.has(name)).map(([, row]) => row);
  const removed = [...previous].filter(([name]) => !next.has(name)).map(([, row]) => row);
  return { added: added.map(key), removed: removed.map(key),
    wouldInvalidateCache: added.length > 0 || removed.length > 0 };
}

/** The LSP tool's presence, as the source's `lspToolChange` field records it. */
export function lspToolChange(before: boolean, after: boolean): 'may-add' | 'may-remove' | null {
  if (before === after) return null;
  return after ? 'may-add' : 'may-remove';
}
