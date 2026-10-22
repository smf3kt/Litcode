import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MCP_PANEL_TITLE, mcpPanelRows, mcpPanelSubtitle, mcpPanelText, mcpStatusText,
  mcpToolCounts } from '../src/mcp-panel.js';

test('the status wording follows the recovered rows', () => {
  assert.equal(mcpStatusText(undefined), 'not connected');
  assert.equal(mcpStatusText({ state: 'connected', generation: 1, attempts: 0 }, 2), 'connected (2 tools)');
  assert.equal(mcpStatusText({ state: 'connected', generation: 1, attempts: 0 }, 1), 'connected (1 tool)');
  assert.equal(mcpStatusText({ state: 'connected', generation: 1, attempts: 0 }, 0), 'connected · no tools');
  assert.equal(mcpStatusText({ state: 'reconnecting', generation: 1, attempts: 3 }), 'reconnecting (attempt 3)…');
  assert.equal(mcpStatusText({ state: 'disconnected', generation: 0, attempts: 2, lastError: 'boom' }),
    'disconnected · boom');
  assert.equal(mcpStatusText({ state: 'closed', generation: 0, attempts: 0 }), 'disconnected');
});

test('rows sort by name and carry the live status', () => {
  const rows = mcpPanelRows(['beta', 'alpha', 'missing'], {
    alpha: { state: 'connected', generation: 1, attempts: 0 },
    beta: { state: 'disconnected', generation: 0, attempts: 0 },
  }, { alpha: 4 });
  assert.deepEqual(rows, [
    { name: 'alpha', status: 'connected (4 tools)', configured: true },
    { name: 'beta', status: 'disconnected', configured: true },
    { name: 'missing', status: 'not connected', configured: false },
  ]);
  assert.equal(mcpPanelSubtitle(3), '3 servers');
  assert.equal(mcpPanelSubtitle(1), '1 server');
  assert.equal(mcpPanelText(rows).split('\n')[0], '3 servers');
  assert.equal(mcpPanelText(rows).split('\n')[1], 'alpha: connected (4 tools)');
  assert.equal(MCP_PANEL_TITLE, 'Manage MCP servers');
});

test('tool names are attributed to their server', () => {
  assert.deepEqual(mcpToolCounts(['alpha', 'beta'], [
    'mcp__alpha__read', 'mcp__alpha__write', 'mcp__beta__list', 'read_file',
  ]), { alpha: 2, beta: 1 });
});
