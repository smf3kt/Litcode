import type { BackgroundTaskSnapshot } from './tasks-panel.js';
import { TAe, Vg, vyt } from './tui-background-label-source.js';

type FooterTask =
  | { type: 'local_bash'; kind: string; status: string }
  | { type: 'monitor_ws' | 'local_agent'; status: string };

/** pz/Tfe/Sjr, 24k7d6mw [740155,740694), phg89898 [189738,189892), y5d901dg [759,2376), UTF-16. */
export function backgroundFooterLabel(snapshot: BackgroundTaskSnapshot): string | undefined {
  const tasks = snapshot.jobs.map<FooterTask>(job => job.source === 'websocket'
    ? { type: 'monitor_ws', status: job.state }
    : { type: 'local_bash', kind: job.kind === 'run' ? 'run' : 'monitor', status: job.state });
  tasks.push(...snapshot.agents.map<FooterTask>(agent => ({ type: 'local_agent', status: agent.status })));
  // The local queued state is setup, not source pending execution; there is no coordinator panel.
  const active = tasks.filter(task => task.status === 'running' && Vg(task) && !TAe(task));
  return active.length === 0 ? undefined : vyt(active, 0) ?? undefined;
}
