/**
 * The `/tasks` Background panel. Recovered from `chunk-24k7d6mw.js`, sha256
 * `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` — the local
 * component `fLt` at 674472, the row projection `EWe` at 699801, the stop predicate
 * `RB` at 699056, the subtitle counts at 693613 and the dialog shell at 698025
 * (`title:"Background"`, `No tasks currently running`). The registration wrapper is
 * `i` in `chunk-dy7th9we.js` at 21553. Offsets are zero-based UTF-16 code units.
 */

/** `EWe`: the task kinds this host can produce. */
export type BackgroundTaskKind = 'shell' | 'monitor' | 'agent' | 'cron';

export const TASKS_TITLE = 'Background';
export const TASKS_EMPTY = 'No tasks currently running';
export const TASKS_DISMISSED = 'Background dialog dismissed';

/** One live row, after `EWe`'s per-kind label choice. */
export interface BackgroundTaskItem {
  readonly id: string;
  readonly kind: BackgroundTaskKind;
  readonly status: string;
  readonly label: string;
  /** The command, prompt or parent id the row carries as its second line. */
  readonly detail?: string;
}

/** The live registries the panel reads; the runtime fills this snapshot. */
export interface BackgroundTaskSnapshot {
  readonly jobs: readonly { readonly id: string; readonly kind: string; readonly state: string;
    readonly command: string; readonly description: string; readonly source?: 'websocket' }[];
  readonly agents: readonly { readonly id: string; readonly name?: string | null; readonly status: string }[];
  readonly crons: readonly { readonly id: string; readonly cron: string; readonly recurring: boolean; readonly prompt: string }[];
}

/** `EWe` at 699801: a monitor shows its description, a run shows its command. */
export function backgroundTaskItems(snapshot: BackgroundTaskSnapshot): BackgroundTaskItem[] {
  const items: BackgroundTaskItem[] = [];
  for (const job of snapshot.jobs) {
    const monitor = job.kind !== 'run';
    items.push({ id: job.id, kind: monitor ? 'monitor' : 'shell', status: job.state,
      label: monitor ? job.description : job.command,
      ...(monitor ? { detail: job.command } : job.description ? { detail: job.description } : {}) });
  }
  for (const agent of snapshot.agents) {
    items.push({ id: agent.id, kind: 'agent', status: agent.status,
      label: agent.name ?? agent.id, detail: 'child agent' });
  }
  for (const cron of snapshot.crons) {
    items.push({ id: cron.id, kind: 'cron', status: cron.recurring ? 'recurring' : 'scheduled',
      label: cron.cron, detail: cron.prompt });
  }
  return items;
}

/** The counts line at 693613: `N active shells · N active agents`. */
export function tasksPanelSubtitle(items: readonly BackgroundTaskItem[]): string {
  const count = (kind: BackgroundTaskKind) => items.filter(item => item.kind === kind).length;
  const parts: string[] = [];
  const shells = count('shell') + count('monitor');
  const agents = count('agent');
  const crons = count('cron');
  if (shells > 0) parts.push(`${shells} active ${shells === 1 ? 'shell' : 'shells'}`);
  if (agents > 0) parts.push(`${agents} active ${agents === 1 ? 'agent' : 'agents'}`);
  if (crons > 0) parts.push(`${crons} ${crons === 1 ? 'scheduled task' : 'scheduled tasks'}`);
  return parts.join(' · ');
}

/** `RB` at 699056: a running row can be stopped. */
export function backgroundTaskStoppable(item: BackgroundTaskItem): boolean {
  return item.status === 'running' || item.status === 'queued' || item.status === 'recurring' || item.status === 'scheduled';
}

export interface BackgroundTaskRow {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly item: BackgroundTaskItem;
}

/** Each row is the label plus `kind · status`, with the command or prompt beneath it. */
export function tasksPanelRows(items: readonly BackgroundTaskItem[]): BackgroundTaskRow[] {
  return items.map(item => ({
    value: `task:${item.kind}:${item.id}`,
    label: item.label,
    description: [item.kind, item.status, item.detail].filter((part): part is string => typeof part === 'string' && part !== '').join(' · '),
    item,
  }));
}

/** The value encodes kind and id; the separator is the first colon after `task:`. */
export function parseBackgroundTaskValue(value: string): { kind: BackgroundTaskKind; id: string } | undefined {
  const match = /^task:(shell|monitor|agent|cron):(.+)$/.exec(value);
  if (match === null) return undefined;
  return { kind: match[1] as BackgroundTaskKind, id: match[2]! };
}

/** The stop confirmation line, used when the runtime no longer holds the row. */
export function backgroundTaskGoneMessage(): string {
  return 'That task is no longer running';
}
