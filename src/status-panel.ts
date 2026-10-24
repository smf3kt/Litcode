import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SessionEvent } from './session.js';
import type { McpServerStatus } from './mcp.js';

/**
 * The Status tab of the recovered Settings dialog, restricted to rows this host can answer.
 * Offsets are zero-based UTF-16 code units in the extracted modules.
 *
 * - `chunk-8x0s4t30.js` (`c7861ef1…`): `t3n` 3424 builds the session rows (Version, Session name,
 *   Session ID, Session kind, tmux session, cwd), `n3n` 5523 the model and configuration rows,
 *   `U` 7619 calls both and filters empty groups, `Ye` 2977 renders `label: value`.
 * - `chunk-dag4qhha.js` (`cd1a28e9…`): `Ofe` 114000 mounts the tab as `Status` with a
 *   `confirm:no` Escape footer.
 * - `chunk-efek3snh.js` (`c4e76aaf…`): `SNo` 14431 the model label, `tdn` 10961 the gateway row,
 *   `pNo` [3784,4644) the MCP count row, excluding the separately owned IDE connection.
 * - `chunk-wtch2p0g.js` (`00d29835…`): `fT` 4516 the setting-source labels.
 */

export const STATUS_PANEL_TITLE = 'Status';
export const STATUS_NO_SESSION_NAME = '/rename to add a name';

export interface StatusSpan { text: string; color?: 'success' | 'inactive' | 'error' }
export interface StatusRow { label: string; value: string; spans?: readonly StatusSpan[] }
export interface StatusPanelInput {
  version: string;
  sessionName?: string;
  sessionId: string;
  sessionKind: string;
  tmux?: string;
  cwd: string;
  model: string;
  gatewayURL?: string;
  mcpServers?: Readonly<Record<string, McpServerStatus>>;
}

// pNo, efek3snh [3784,4644), UTF-16; only states produced by the local manager are counted.
export function mcpStatusRows(servers: NonNullable<StatusPanelInput['mcpServers']> = {}): StatusRow[] {
  const clients = Object.entries(servers).filter(([name]) => name !== 'ide');
  if (!clients.length) return [];
  const counts = { connected: 0, pending: 0, disabled: 0, failed: 0 };
  for (const [, status] of clients) {
    switch (status.state) {
      case 'connected': counts.connected++; break;
      case 'reconnecting': counts.pending++; break;
      case 'disabled': counts.disabled++; break;
      case 'disconnected':
      case 'closed': counts.failed++; break;
      default: { const exhaustive: never = status.state; return exhaustive; }
    }
  }
  const parts: StatusSpan[] = [];
  if (counts.connected) parts.push({ text: `${counts.connected} connected`, color: 'success' });
  if (counts.pending) parts.push({ text: `${counts.pending} pending`, color: 'inactive' });
  if (counts.disabled) parts.push({ text: `${counts.disabled} disabled`, color: 'inactive' });
  if (counts.failed) parts.push({ text: `${counts.failed} failed`, color: 'error' });
  const spans: StatusSpan[] = parts.flatMap((part, index) => index === 0 ? [part] : [{ text: ', ' }, part]);
  spans.push({ text: ' · /mcp', color: 'inactive' });
  return [{ label: 'MCP servers', value: spans.map(span => span.text).join(''), spans }];
}

/** Source `t3n`/`n3n`: the surviving rows in their recovered order. */
export function statusPanelRows(input: StatusPanelInput): StatusRow[] {
  const rows: StatusRow[] = [
    { label: 'Version', value: input.version },
    { label: 'Session name', value: input.sessionName ?? STATUS_NO_SESSION_NAME },
    { label: 'Session ID', value: input.sessionId },
    { label: 'Session kind', value: input.sessionKind },
  ];
  if (input.tmux) rows.push({ label: 'tmux session', value: input.tmux });
  rows.push({ label: 'cwd', value: input.cwd });
  rows.push({ label: 'Model', value: input.model });
  if (input.gatewayURL) rows.push({ label: 'Gateway URL', value: input.gatewayURL });
  rows.push(...mcpStatusRows(input.mcpServers));
  return rows;
}

/** Source `Ye`: each row is `label:` then the value, joined as one text body. */
export function statusPanelText(rows: readonly StatusRow[]): string {
  return rows.map(row => `${row.label}: ${row.value}`).join('\n');
}

/** Source `kM`: the last recorded title, or none. */
export function latestSessionTitle(events: readonly SessionEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!;
    if (event.kind === 'title') return event.title;
  }
  return undefined;
}

/** The package version `cliVersion` reports, read beside the running module. */
export function appVersion(): string {
  const candidates = [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { version?: unknown }).version === 'string') {
        return (parsed as { version: string }).version;
      }
    } catch { /* try the next candidate */ }
  }
  return 'unknown';
}
