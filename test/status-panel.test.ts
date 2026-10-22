import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STATUS_NO_SESSION_NAME, appVersion, latestSessionTitle, statusPanelRows,
  statusPanelText } from '../src/status-panel.js';

test('the status rows keep the recovered order and the session-name fallback', () => {
  const rows = statusPanelRows({ version: '1.2.3', sessionId: 'session-1', sessionKind: 'interactive',
    cwd: '/work', model: 'model-a' });
  assert.deepEqual(rows, [
    { label: 'Version', value: '1.2.3' },
    { label: 'Session name', value: STATUS_NO_SESSION_NAME },
    { label: 'Session ID', value: 'session-1' },
    { label: 'Session kind', value: 'interactive' },
    { label: 'cwd', value: '/work' },
    { label: 'Model', value: 'model-a' },
  ]);
  assert.equal(statusPanelText(rows).split('\n')[1], 'Session name: /rename to add a name');
});

test('a recorded title, tmux and a custom gateway add their rows', () => {
  const rows = statusPanelRows({ version: '1.2.3', sessionName: 'Named session', sessionId: 'session-1',
    sessionKind: 'interactive', tmux: '/tmp/tmux-501/default,123,0', cwd: '/work', model: 'model-a',
    gatewayURL: 'http://127.0.0.1:9999' });
  assert.deepEqual(rows.map(row => row.label), ['Version', 'Session name', 'Session ID', 'Session kind',
    'tmux session', 'cwd', 'Model', 'Gateway URL']);
  assert.equal(rows[1]!.value, 'Named session');
  assert.equal(rows[4]!.value, '/tmp/tmux-501/default,123,0');
  assert.equal(rows[7]!.value, 'http://127.0.0.1:9999');
});

test('the latest title event wins', () => {
  const events = [
    { kind: 'title' as const, title: 'first' },
    { kind: 'title' as const, title: 'second' },
  ];
  assert.equal(latestSessionTitle(events), 'second');
  assert.equal(latestSessionTitle([]), undefined);
});

test('the version comes from the package beside the module', () => {
  assert.match(appVersion(), /^\d+\.\d+\.\d+/);
});
