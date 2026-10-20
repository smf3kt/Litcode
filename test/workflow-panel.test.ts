import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TerminalPromptRequest } from '../src/terminal.js';
import type { WorkflowTaskView, WorkflowView } from '../src/workflow.js';
import {
  WORKFLOW_PANEL_DISMISSED, WORKFLOW_PANEL_EMPTY, WORKFLOW_PANEL_TITLE, browseWorkflows,
  formatDuration, pluralize, workflowDetailRequest, workflowListRequest, workflowPanelSubtitle,
  workflowRowFacts, workflowTaskRequest,
} from '../src/workflow-panel.js';

const task = (overrides: Partial<WorkflowTaskView> = {}): WorkflowTaskView => ({
  id: 'build', status: 'completed', session_id: null, summary: '', error: null, ...overrides,
});
const view = (overrides: Partial<WorkflowView> = {}): WorkflowView => ({
  id: 'run-1', status: 'completed', started_at: 1_000, ended_at: 81_000, tasks: [], error: null,
  ...overrides,
});

test('the panel formatters match the recovered duration and plural helpers', () => {
  // Source `rn(e)` in chunk-yn0pfn70.js.
  assert.equal(formatDuration(0), '0s');
  // The recovered `e < 1` branch keeps a decimal, but the plain branch floors every
  // millisecond value at or above one, so a sub-second duration reads as whole seconds.
  assert.equal(formatDuration(0.5), '0.0s');
  assert.equal(formatDuration(900), '0s');
  assert.equal(formatDuration(500), '0s');
  assert.equal(formatDuration(45_000), '45s');
  assert.equal(formatDuration(81_000), '1m 21s');
  assert.equal(formatDuration(3_600_000), '1h 0m 0s');
  assert.equal(formatDuration(90_000_000), '1d 1h 0m');
  // Source `I(t,n,e=n+"s")` in chunk-ax7r0qj7.js.
  assert.equal(pluralize(1, 'agent'), 'agent');
  assert.equal(pluralize(2, 'agent'), 'agents');
});

test('the panel subtitle counts running runs and files every other run under completed', () => {
  assert.equal(workflowPanelSubtitle([]), undefined);
  assert.equal(workflowPanelSubtitle([view({ status: 'running', ended_at: null }), view()]),
    '1 running · 1 completed');
  assert.equal(workflowPanelSubtitle([view({ status: 'running', ended_at: null }),
    view({ status: 'running', ended_at: null })]), '2 running');
  // Source `le`: only `running` is split out, so a failed run counts as completed.
  assert.equal(workflowPanelSubtitle([view(), view({ status: 'failed' })]), '2 completed');
});

test('a row carries its run duration and agent count, and drops what it has none of', () => {
  const running = view({ status: 'running', ended_at: null, tasks: [task(), task({ id: 'test' })] });
  assert.equal(workflowRowFacts(running, 31_000), '30s · 2 agents');
  assert.equal(workflowRowFacts(view({ tasks: [task()] }), 0), '1m 20s · 1 agent');
});

test('the list request is the recovered panel title, empty state and rows', () => {
  const empty = workflowListRequest([], 0);
  assert.equal(empty.title, WORKFLOW_PANEL_TITLE);
  assert.equal(empty.message, WORKFLOW_PANEL_EMPTY);
  assert.deepEqual(empty.choices, []);

  const facts = workflowListRequest([view({ tasks: [task()] })], 0);
  assert.equal(facts.message, '1 completed');
  assert.deepEqual(facts.choices, [{ label: '✔ run-1', value: 'run-1',
    description: '1m 20s · 1 agent' }]);
});

test('the detail request is the recovered header and one row per task', () => {
  const failed = view({ tasks: [task(), task({ id: 'test', status: 'failed', summary: 'two failed',
    error: 'exit 1', session_id: 'session-9' })], error: 'Workflow deadline reached' });
  const request = workflowDetailRequest(failed, 0);
  assert.equal(request.title, '✔ run-1');
  assert.equal(request.message, '1/2 agents · 1m 20s · done\nWorkflow deadline reached');
  assert.equal(request.readOnly, true);
  assert.deepEqual(request.choices, [
    { label: '✔ build', value: 'build', description: 'Completed' },
    { label: '✘ test', value: 'test', description: 'Failed · two failed · exit 1' },
  ]);
});

test('the run suffix names the terminal state and a stopped run reads as stopped', () => {
  assert.equal(workflowDetailRequest(view({ status: 'cancelled' }), 0).message, '1m 20s · stopped');
  assert.equal(workflowDetailRequest(view({ status: 'running', ended_at: null }), 31_000).message,
    '30s');
});

test('the task request is one task record and never asks a question', () => {
  const request = workflowTaskRequest(view(), task({ status: 'failed', session_id: 'session-9',
    summary: 'two failed', error: 'exit 1' }));
  assert.equal(request.title, '✘ build');
  assert.equal(request.readOnly, true);
  assert.equal(request.message,
    'Failed · session session-9\n\ntwo failed\n\nexit 1\n\nRun run-1');
});

test('the panel walks list, run, task and back out again, then reports the dismissal', async () => {
  const runs = [view({ id: 'run-1' }), view({ id: 'run-2', status: 'failed',
    tasks: [task({ id: 'b1', status: 'failed' })] })];
  const seen: TerminalPromptRequest[] = [];
  const answers: (readonly string[] | undefined)[] = [['run-2'], ['b1'], undefined, undefined, undefined];
  const notice = await browseWorkflows(() => runs, async request => {
    seen.push(request);
    const selected = answers[seen.length - 1];
    return selected === undefined ? undefined : { selected };
  }, () => 0);
  assert.equal(notice, WORKFLOW_PANEL_DISMISSED);
  assert.deepEqual(seen.map(request => request.title), [WORKFLOW_PANEL_TITLE, '✘ run-2',
    '✘ b1', '✘ run-2', WORKFLOW_PANEL_TITLE]);
  assert.equal(seen[2]!.readOnly, true);
});

test('a single run opens its detail view without a list step, and the list follows it', async () => {
  const runs = [view({ tasks: [task()] })];
  const seen: TerminalPromptRequest[] = [];
  const notice = await browseWorkflows(() => runs, async request => {
    seen.push(request);
    return undefined;
  }, () => 0);
  assert.equal(notice, WORKFLOW_PANEL_DISMISSED);
  // The panel opens on the run; leaving it lands on the list instead of drilling back in.
  assert.deepEqual(seen.map(request => request.title), ['✔ run-1', WORKFLOW_PANEL_TITLE]);
});

test('a run with no tasks still opens a detail view that exits on Escape', async () => {
  const runs = [view(), view({ id: 'run-2' })];
  const seen: string[] = [];
  await browseWorkflows(() => runs, async request => {
    seen.push(request.title ?? '');
    return seen.length === 1 ? { selected: ['run-2'] } : undefined;
  }, () => 0);
  assert.deepEqual(seen, [WORKFLOW_PANEL_TITLE, '✔ run-2', WORKFLOW_PANEL_TITLE]);
});
