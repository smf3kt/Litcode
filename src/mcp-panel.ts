import type { McpServerStatus } from './mcp.js';

/**
 * `/mcp`'s management list. Offsets are zero-based UTF-16 code units in the extracted modules.
 *
 * - `chunk-6sz429bf.js` (`b32da1da…`): `wt` 28713 the list: the `Manage MCP servers` title, the
 *   `I(Nt,"server")` subtitle, scope headings, rows sorted by name and the null result for an
 *   empty catalog; `Qo` 35295 the row status text and icon; `ps` 36559 the name sort.
 * - `chunk-sfn1dbxq.js` (`4c74137e…`): `jfo` 1164118 the `local-jsx` registration
 *   (`Manage MCP servers`, `immediate`, `twin` dispatch).
 *
 * The host keeps one merged `mcpServers` map and a flat per-server status record, so the scope
 * headings (project/user/local/enterprise/managed/agent/built-in), the claude.ai connectors, the
 * per-server detail page and the enable/disable and authentication actions are not ported. The
 * list keeps the recovered name sort, title, subtitle and status wording for the rows it has.
 */

export const MCP_PANEL_TITLE = 'Manage MCP servers';

export interface McpPanelRow {
  name: string;
  status: string;
  /** Whether the row has a live connection record or is merely configured. */
  configured: boolean;
}

/** Source `Qo`: the status text under a server name, in the recovered wording. */
export function mcpStatusText(status: McpServerStatus | undefined, toolCount = 0): string {
  if (status === undefined) return 'not connected';
  switch (status.state) {
    case 'connected':
      return toolCount > 0 ? `connected (${toolCount} ${toolCount === 1 ? 'tool' : 'tools'})`
        : 'connected · no tools';
    case 'reconnecting':
      return status.attempts > 0 ? `reconnecting (attempt ${status.attempts})…` : 'reconnecting…';
    case 'disconnected':
    case 'closed':
      return status.lastError ? `disconnected · ${status.lastError}` : 'disconnected';
  }
}

/** Source `wt`/`ps`: configured names sorted by name, each with its live status. */
export function mcpPanelRows(configured: readonly string[],
  statuses: Readonly<Record<string, McpServerStatus>>,
  toolCounts: Readonly<Record<string, number>> = {}): McpPanelRow[] {
  return [...configured].sort((left, right) => left.localeCompare(right)).map(name => ({
    name, status: mcpStatusText(statuses[name], toolCounts[name] ?? 0),
    configured: statuses[name] !== undefined,
  }));
}

/** Source `wt`: the `I(Nt,"server")` subtitle above the list. */
export function mcpPanelSubtitle(count: number): string {
  return `${count} ${count === 1 ? 'server' : 'servers'}`;
}

/** The list body: the subtitle, then `name: status` for every configured server. */
export function mcpPanelText(rows: readonly McpPanelRow[]): string {
  return [mcpPanelSubtitle(rows.length),
    ...rows.map(row => `${row.name}: ${row.status}`)].join('\n');
}

/** One MCP tool name is `mcp__<server>__<tool>` (`chunk-3cynezh1.js` 364). */
export function mcpToolCounts(serverNames: readonly string[], toolNames: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const server of serverNames) {
    const prefix = `mcp__${server}__`;
    counts[server] = toolNames.filter(name => name.startsWith(prefix)).length;
  }
  return counts;
}
