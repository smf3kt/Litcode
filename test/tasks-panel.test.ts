import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TASKS_EMPTY, TASKS_TITLE, backgroundTaskGoneMessage, backgroundTaskItems, backgroundTaskStoppable,
  parseBackgroundTaskValue, tasksPanelRows, tasksPanelSubtitle,
} from '../src/tasks-panel.js';

import { backgroundFooterLabel } from '../src/tui-background.js';
const snapshot = {
  jobs: [
    { id: 'job-1', kind: 'run', state: 'running', command: 'npm test', description: 'Run the suite' },
    { id: 'job-2', kind: 'monitor', state: 'running', command: 'tail -f app.log', description: 'Watch the log' },
  ],
  agents: [{ id: 'agent-1', name: 'reviewer', status: 'running' }, { id: 'agent-2', name: null, status: 'queued' }],
  crons: [{ id: 'cron-1', cron: '*/5 * * * *', recurring: true, prompt: 'check the deploy' }],
};

test('items follow the recovered row labels: a run shows its command, a monitor its description', () => {
  const items = backgroundTaskItems(snapshot);
  assert.deepEqual(items.map(item => [item.kind, item.label]), [
    ['shell', 'npm test'], ['monitor', 'Watch the log'], ['agent', 'reviewer'], ['agent', 'agent-2'], ['cron', '*/5 * * * *'],
  ]);
  assert.equal(items[0]!.detail, 'Run the suite');
  assert.equal(items[1]!.detail, 'tail -f app.log');
  assert.equal(items[4]!.detail, 'check the deploy');
  assert.equal(items[4]!.status, 'recurring');
});

test('the subtitle counts shells, agents and scheduled tasks', () => {
  assert.equal(tasksPanelSubtitle(backgroundTaskItems(snapshot)),
    '2 active shells · 2 active agents · 1 scheduled task');
  assert.equal(tasksPanelSubtitle([]), '');
  assert.equal(tasksPanelSubtitle(backgroundTaskItems({ jobs: [snapshot.jobs[0]!], agents: [], crons: [] })),
    '1 active shell');
});

test('rows carry kind, status and the second line', () => {
  const rows = tasksPanelRows(backgroundTaskItems(snapshot));
  assert.equal(rows[0]!.value, 'task:shell:job-1');
  assert.equal(rows[0]!.label, 'npm test');
  assert.equal(rows[0]!.description, 'shell · running · Run the suite');
  assert.equal(rows[4]!.value, 'task:cron:cron-1');
  assert.equal(rows[4]!.description, 'cron · recurring · check the deploy');
});

test('the row value round-trips to a kind and id', () => {
  assert.deepEqual(parseBackgroundTaskValue('task:monitor:job-2'), { kind: 'monitor', id: 'job-2' });
  assert.deepEqual(parseBackgroundTaskValue('task:agent:agent-1'), { kind: 'agent', id: 'agent-1' });
  assert.equal(parseBackgroundTaskValue('task:other:x'), undefined);
});

test('a running, queued or scheduled row is stoppable', () => {
  const items = backgroundTaskItems(snapshot);
  assert.ok(items.every(backgroundTaskStoppable));
  assert.equal(backgroundTaskStoppable({ ...items[0]!, status: 'completed' }), false);
});

test('the panel strings match the recovered shell', () => {
  assert.equal(TASKS_TITLE, 'Background');
  assert.equal(TASKS_EMPTY, 'No tasks currently running');
  assert.equal(backgroundTaskGoneMessage(), 'That task is no longer running');
});

test('the footer classifies live background execution and omits scheduled or finished work', () => {
  const run = snapshot.jobs[0]!, monitor = snapshot.jobs[1]!;
  const ws = { ...monitor, source: 'websocket' as const };
  const label = (jobs: (typeof run & { source?: 'websocket' })[], agents = snapshot.agents.slice(0, 0)) =>
    backgroundFooterLabel({ jobs, agents, crons: snapshot.crons });
  assert.equal(label([]), undefined);
  assert.equal(label([run]), '1 shell');
  assert.equal(label([run, { ...run, id: 'run-2' }]), '2 shells');
  assert.equal(label([monitor]), '1 monitor');
  assert.equal(label([run, monitor]), '1 shell, 1 monitor');
  assert.equal(label([ws]), '1 monitor');
  assert.equal(label([ws, { ...ws, id: 'ws-2' }]), '2 monitors');
  assert.equal(label([ws, monitor]), '2 background tasks');
  assert.equal(label([], snapshot.agents), '1 local agent');
  assert.equal(label([], [snapshot.agents[0]!, { ...snapshot.agents[0]!, id: 'agent-3' }]), '2 local agents');
  assert.equal(label([run], snapshot.agents), '2 background tasks');
  assert.equal(label([{ ...run, state: 'completed' }], [{ ...snapshot.agents[0]!, status: 'failed' }]), undefined);
  assert.equal(label([], [{ ...snapshot.agents[0]!, status: 'pending' }]), undefined);
});
