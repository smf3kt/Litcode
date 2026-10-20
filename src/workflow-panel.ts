/**
 * The `/workflows` panel. Recovered from `chunk-mtw0aefh.js`, sha256
 * `5fa9e2db33e721240465b0ae2b1949c3caa20ad18154be2b69a3da2653576042`: the list panel `le` at
 * [20074,24977), its row model `We` at [24977,25291), the status-icon map `Pt` at [25291,25535),
 * the entry `pe` at [19263,20074) and the dismiss notice `J` at [19190,19263). Offsets are
 * zero-based UTF-16 code units.
 *
 * The row glyphs come from two shared tables: `a={tick:"✔",…,cross:"✘",…,circle:"◯"}`
 * in `chunk-04v7vxqn.js` (exported as `te`) and `uo=O()==="macos"?"⏺":"●"` in
 * `chunk-3cynezh1.js`. The duration formatter is `rn(e)` in `chunk-yn0pfn70.js`, the pluraliser is
 * `I(t,n,e=n+"s")` in `chunk-ax7r0qj7.js`, and the row facts are joined with `" · "` by `C` in
 * `chunk-fz2251t0.js`.
 *
 * The panel is a `local-jsx` command with `immediate: true` and no `presentation`, so the host
 * docks it in the frame below the prompt rather than replacing the screen; here that surface is the
 * modal dialog, which already keeps the chat frame around it.
 */

import type { TerminalPromptRequest } from './terminal.js';
import type { WorkflowStatus, WorkflowTaskStatus, WorkflowTaskView, WorkflowView } from './workflow.js';

export const WORKFLOW_PANEL_TITLE = 'Dynamic workflows';
export const WORKFLOW_PANEL_EMPTY = 'No dynamic workflows in this session.';
export const WORKFLOW_PANEL_DISMISSED = 'Dynamic workflows dialog dismissed';

/** Source `a` in `chunk-04v7vxqn.js` and `uo` in `chunk-3cynezh1.js`, through the `Pt` map. */
const ICONS: Record<WorkflowStatus | WorkflowTaskStatus, string> = {
  pending: '◯',
  running: process.platform === 'darwin' ? '⏺' : '●',
  completed: '✔',
  failed: '✘',
  skipped: '✘',
  cancelled: '✘',
};

/** Source `ro` (chunk-e24bvje9.js [30601)): the verbose status vocabulary. */
const STATUS_LABELS: Record<WorkflowStatus | WorkflowTaskStatus, string> = {
  pending: 'Queued', running: 'Running', completed: 'Completed', failed: 'Failed',
  skipped: 'Skipped', cancelled: 'Stopped',
};

/** Source `AHr` (chunk-36h1wcr3.js [15706)): the header's status suffix. */
const STATUS_SUFFIXES: Partial<Record<WorkflowStatus, string>> = {
  completed: 'done', failed: 'failed', cancelled: 'stopped',
};

export function workflowIcon(status: WorkflowStatus | WorkflowTaskStatus): string {
  return ICONS[status];
}

/**
 * Source `rn(e)` in `chunk-yn0pfn70.js` without its `hideTrailingZeros` and `mostSignificantOnly`
 * options, which no caller here uses: seconds below a minute, then `Xd Xh Xm`, `Xh Xm Xs`,
 * `Xm Xs` or `Xs`.
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 60_000) {
    if (milliseconds === 0) return '0s';
    if (milliseconds < 1) return `${(milliseconds / 1000).toFixed(1)}s`;
    return `${Math.floor(milliseconds / 1000).toString()}s`;
  }
  let days = Math.floor(milliseconds / 86_400_000);
  let hours = Math.floor((milliseconds % 86_400_000) / 3_600_000);
  let minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  let seconds = Math.round((milliseconds % 60_000) / 1000);
  if (seconds === 60) { seconds = 0; minutes++; }
  if (minutes === 60) { minutes = 0; hours++; }
  if (hours === 24) { hours = 0; days++; }
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Source `I(t,n,e=n+"s")` in `chunk-ax7r0qj7.js`. */
export function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

/**
 * Source `C` (chunk-fz2251t0.js): the row facts joined by a dim `" · "`, with the empty ones
 * dropped. Tokens are the one recovered fact this host has no source for, so that entry is always
 * empty and drops out here, exactly as the recovered renderer drops a zero count.
 */
function joinFacts(facts: readonly string[]): string {
  return facts.filter(fact => fact !== '').join(' · ');
}

/** Source `We` (chunk-mtw0aefh.js [24977,25291)) over a stored run view. */
export function workflowRowFacts(view: WorkflowView, now: number): string {
  const duration = Math.max(0, (view.ended_at ?? now) - view.started_at);
  const agents = view.tasks.length;
  return joinFacts([formatDuration(duration),
    agents > 0 ? `${agents} ${pluralize(agents, 'agent')}` : '']);
}

/** Source `le`: `q` counts running runs and every other run is counted as completed. */
export function workflowPanelSubtitle(views: readonly WorkflowView[]): string | undefined {
  if (views.length === 0) return undefined;
  const running = views.filter(view => view.status === 'running').length;
  const completed = views.length - running;
  return joinFacts([running > 0 ? `${running} running` : '',
    completed > 0 ? `${completed} completed` : '']);
}

/**
 * Source `We`: the row label is `workflowName ?? summary ?? description`. A stored run view carries
 * none of the three, so its id is the label.
 */
function rowLabel(view: WorkflowView): string {
  return `${workflowIcon(view.status)} ${view.id}`;
}

export function workflowListRequest(views: readonly WorkflowView[], now: number): TerminalPromptRequest {
  return {
    title: WORKFLOW_PANEL_TITLE,
    message: workflowPanelSubtitle(views) ?? WORKFLOW_PANEL_EMPTY,
    choices: views.map(view => ({ label: rowLabel(view), value: view.id,
      description: workflowRowFacts(view, now) })),
    defaultIndex: 0,
  };
}

/** Source `AHr` [15706,15800) in `chunk-36h1wcr3.js`: `done/total agents · duration · status`. */
export function workflowDetailRequest(view: WorkflowView, now: number): TerminalPromptRequest {
  const done = view.tasks.filter(task => task.status === 'completed').length;
  const total = view.tasks.length;
  const duration = formatDuration(Math.max(0, (view.ended_at ?? now) - view.started_at));
  const suffix = STATUS_SUFFIXES[view.status];
  const stats = joinFacts([total > 0 ? `${done}/${total} ${pluralize(total, 'agent')}` : '', duration]);
  return {
    title: `${workflowIcon(view.status)} ${view.id}`,
    message: [stats + (suffix === undefined ? '' : ` · ${suffix}`), view.error ?? '']
      .filter(line => line !== '').join('\n'),
    choices: view.tasks.map(task => ({ label: `${workflowIcon(task.status)} ${task.id}`,
      value: task.id, description: taskFacts(task) })),
    readOnly: true,
  };
}

function taskFacts(task: WorkflowTaskView): string {
  return joinFacts([STATUS_LABELS[task.status], task.summary, task.error ?? '']);
}

/** The deepest level: one task's own record. The recovered agent card is display-only too. */
export function workflowTaskRequest(view: WorkflowView, task: WorkflowTaskView): TerminalPromptRequest {
  return {
    title: `${workflowIcon(task.status)} ${task.id}`,
    message: [`${STATUS_LABELS[task.status]}${task.session_id === null ? '' : ` · session ${task.session_id}`}`,
      ...(task.summary ? ['', task.summary] : []), ...(task.error ? ['', task.error] : []),
      '', `Run ${view.id}`].join('\n'),
    readOnly: true,
  };
}

export type WorkflowPanelAnswer = { selected: readonly string[] } | undefined;

/**
 * The recovered panel's navigation: the list, `Enter` into a run, `Enter` into one of its tasks, and
 * `Esc` one level back at a time, closing from the list with the dismiss notice. The list is read
 * again on every return so a running run's row keeps up, as the recovered panel does.
 */
export async function browseWorkflows(
  list: () => readonly WorkflowView[],
  read: (request: TerminalPromptRequest) => Promise<WorkflowPanelAnswer>,
  now: () => number = () => Date.now(),
): Promise<string | undefined> {
  // Source `le`: the panel opens straight into the detail view when the session holds exactly one
  // run. Leaving that view shows the list, so the drill happens once.
  let drilled = false;
  for (;;) {
    const views = list();
    const first = !drilled && views.length === 1 ? views[0] : undefined;
    drilled = true;
    const answer = first === undefined ? await read(workflowListRequest(views, now())) : undefined;
    const picked = first ?? (answer === undefined ? undefined
      : views.find(view => view.id === answer.selected[0]));
    if (picked === undefined) return WORKFLOW_PANEL_DISMISSED;
    for (;;) {
      const view = list().find(candidate => candidate.id === picked.id) ?? picked;
      const detail = await read(workflowDetailRequest(view, now()));
      const task = detail === undefined ? undefined
        : view.tasks.find(candidate => candidate.id === detail.selected[0]);
      if (task === undefined) break;
      await read(workflowTaskRequest(view, task));
    }
  }
}
