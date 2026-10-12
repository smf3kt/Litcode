import crypto from 'node:crypto';
import type { Session } from './session.js';
import { MCP_MAX_RESOURCE_SUBSCRIPTIONS, validateMcpResourceUri, type McpSubscriptionMethod } from './mcp-subscriptions.js';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(session: Session, server: string): string {
  const definition = session.config.mcpServers?.[server];
  if (!definition || !Object.hasOwn(session.config.mcpServers!, server)) throw new Error('Persistent MCP server is absent from pinned configuration');
  return crypto.createHash('sha256').update(canonical({ workspace: session.config.workspace, server, definition })).digest('hex');
}

function enabled(session: Session): boolean {
  return session.config.features?.mcpPersistence === true && session.config.features.mcpRecovery === true && session.config.features.mcpSubscriptions === true;
}

/** URI desire is owned by this journal; new forks do not inherit external subscriptions. */
export function mcpSubscriptionState(session: Session): Record<string, string[]> {
  const state = Object.create(null) as Record<string, string[]>;
  if (!enabled(session)) return state;
  const sets = new Map<string, Set<string>>();
  for (const event of session.events) {
    if (event.kind !== 'mcp_subscription') continue;
    if (event.configDigest !== digest(session, event.server)) throw new Error('Persistent MCP subscription configuration digest mismatch');
    validateMcpResourceUri(event.uri);
    let uris = sets.get(event.server);
    if (!uris) { uris = new Set(); sets.set(event.server, uris); }
    if (event.method === 'resources/subscribe') uris.add(event.uri);
    else uris.delete(event.uri);
    if (uris.size > MCP_MAX_RESOURCE_SUBSCRIPTIONS) throw new Error('Persistent MCP subscription limit exceeded');
  }
  for (const [server, uris] of sets) state[server] = [...uris];
  return state;
}

/** Fsync the successful acknowledgment before publishing the desired-state mutation. */
export function commitMcpSubscription(session: Session, server: string, method: McpSubscriptionMethod, uri: string): void {
  if (!enabled(session)) throw new Error('Persistent MCP subscriptions are disabled in this session');
  validateMcpResourceUri(uri);
  const state = mcpSubscriptionState(session);
  const present = state[server] ?? [];
  if (method === 'resources/subscribe' && !present.includes(uri) && present.length >= MCP_MAX_RESOURCE_SUBSCRIPTIONS) throw new Error('Persistent MCP subscription limit exceeded');
  session.append({ kind: 'mcp_subscription', server, configDigest: digest(session, server), method, uri });
}
