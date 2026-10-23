import type { McpServerConfig, McpServerStatus } from './mcp.js';
import type { TerminalPromptRequest } from './terminal.js';
import type { ToolDefinition } from './tools.js';
import { truncateMcpDetail } from './mcp-detail-source.js';

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
 * headings (project/user/local/enterprise/managed/agent/built-in) and authentication are absent.
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
    case 'disabled': return 'disabled';
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
    const prefix = `mcp__${server.replace(/[^A-Za-z0-9_-]/g, '_')}__`;
    counts[server] = toolNames.filter(name => name.startsWith(prefix)).length;
  }
  return counts;
}

// icn/zu, tw1h5pks [114759,117497)/[99870,113771), UTF-16; only local connection actions.
export function mcpServerRequest(name: string, config: McpServerConfig, status: McpServerStatus | undefined,
  count: number): TerminalPromptRequest {
  const disabled = status?.state === 'disabled', options = [];
  if (!disabled && count > 0) options.push({ label: 'View tools', value: 'tools' });
  if (!disabled) options.push({ label: 'Reconnect', value: 'reconnectMcpServer' });
  options.push({ label: disabled ? 'Enable' : 'Disable', value: 'toggle-enabled' });
  const endpoint = config.type === 'http' ? config.url : [config.command, ...(config.args ?? [])].join(' ');
  return { title: `${name} MCP Server`, message: [
    `Status: ${mcpStatusText(status, count)}`,
    `${config.type === 'http' ? 'URL' : 'Command'}: ${endpoint}`,
    'Config location: Merged local configuration', ...(count ? [`Tools: ${count} ${count === 1 ? 'tool' : 'tools'}`] : []),
  ].join('\n'), choices: options };
}

// grn/hrn, g9z2s3cs [2260,2462), UTF-16; the host's MCP sanitizer supplies the prefix.
export function mcpToolLabel(name: string, server: string): string {
  const prefix = `mcp__${server.replace(/[^A-Za-z0-9_-]/g, '_')}__`;
  const label = name.replace(prefix, '').replace(/\s*\(MCP\)\s*$/, '').trim();
  const index = label.indexOf(' - ');
  return index === -1 ? label : label.substring(index + 3).trim();
}

// cNt/lNt, tw1h5pks [121409,123419)/[117520,121025), UTF-16; schemas are already in memory.
export function mcpToolsRequest(server: string, tools: readonly ToolDefinition[]): TerminalPromptRequest {
  return { title: `Tools for ${server}`, message: tools.length ? `${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}` : 'No tools available',
    choices: tools.map(tool => ({ label: tool.mcpAnnotations?.title || mcpToolLabel(tool.schema.name, server), value: tool.schema.name,
      description: [tool.readOnly ? 'read-only' : '', tool.mcpAnnotations?.destructive ? 'destructive' : '',
        tool.mcpAnnotations?.openWorld ? 'open-world' : ''].filter(Boolean).join(' · ') || undefined })) };
}

// lNt, tw1h5pks a2e774c2 [117520,121025), UTF-16; render retained schemas with source text limits.
export function mcpToolRequest(server: string, tool: ToolDefinition): TerminalPromptRequest {
  const schema = tool.schema.input_schema, properties = schema.properties ?? {}, required = schema.required ?? [];
  const parameters = Object.entries(properties).map(([name, value]) => {
    const property = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const type = 'type' in property ? String(property.type) : 'unknown';
    const description = 'description' in property ? ` - ${truncateMcpDetail(String(property.description), 200)}` : '';
    return `  ${name}${required.includes(name) ? ' required' : ''}: ${type}${description}`;
  });
  return { title: tool.mcpAnnotations?.title || mcpToolLabel(tool.schema.name, server), readOnly: true,
    message: [`Tool name: ${tool.mcpAnnotations?.toolName ?? mcpToolLabel(tool.schema.name, server)}`, `Full name: ${tool.schema.name}`,
      ...(tool.readOnly ? ['[read-only]'] : []), ...(tool.mcpAnnotations?.destructive ? ['[destructive]'] : []),
      ...(tool.mcpAnnotations?.openWorld ? ['[open-world]'] : []),
      ...(tool.schema.description ? [`Description:\n${truncateMcpDetail(tool.schema.description, 1000)}`] : []),
      ...(parameters.length ? [`Parameters:\n${parameters.join('\n')}`] : [])].join('\n') };
}
