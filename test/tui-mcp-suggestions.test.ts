import assert from 'node:assert/strict';
import test from 'node:test';
import { templateArgumentRows } from '../src/tui-mcp-suggestions.js';
import type { McpTemplate } from '../src/tui-at-suggestions.js';

const templates: Record<string, readonly McpTemplate[]> = {
  repo: [
    { server: 'repo', uriTemplate: 'repo://file/{path}' },
    { server: 'repo', uriTemplate: 'repo://issue/{id}', name: 'Issue' },
    { server: 'repo', uriTemplate: 'repo://hidden/{x}', mimeType: 'text/html; profile=mcp-app' },
  ],
};

test('an explicit server partial lists the templates that continue it', () => {
  const rows = templateArgumentRows('repo:repo://fi', templates);
  assert.deepEqual(rows?.map(row => row.id), ['mcp-template::repo__repo://file/{path}']);
  assert.equal(rows?.[0]?.displayText, 'repo:repo://file/');
  assert.equal(rows?.[0]?.replacement, '@repo:repo://file/');
  assert.equal(rows?.[0]?.partial, true);
});

test('a hidden template is not offered', () => {
  assert.equal(templateArgumentRows('repo:repo://hidden/x', templates), null);
});

test('no colon, an unknown server, an empty remainder or a completed template answer null', () => {
  assert.equal(templateArgumentRows('repo', templates), null);
  assert.equal(templateArgumentRows('other:repo://fi', templates), null);
  assert.equal(templateArgumentRows('repo:', templates), null);
  assert.equal(templateArgumentRows('repo:repo://file/{path}', templates), null,
    'a complete URI leaves nothing to continue');
});

test('a match keeps the description fallback and the server cap', () => {
  const rows = templateArgumentRows('repo:repo://', templates);
  assert.deepEqual(rows?.map(row => row.description),
    ['repo://file/{path}', 'Issue'], 'description, then name, then the template');
});
