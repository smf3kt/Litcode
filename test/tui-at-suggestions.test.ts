import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AT_DESCRIPTION_LIMIT, AT_SUGGESTION_LIMIT, combinedAtRows, isUiOnlyResource,
  mcpResourceRows, mcpTemplateRows, shapeTemplateReplacement, templatePrefix,
} from '../src/tui-at-suggestions.js';
import type { AtFileRow, McpResource, McpTemplate } from '../src/tui-at-suggestions.js';
import { agentSuggestionRows } from '../src/tui-agent-suggestions.js';

const agents = agentSuggestionRows([
  { name: 'explore', description: 'Fast read-only search agent' },
  { name: 'reviewer', description: 'Reviews a change' },
], '', true);

function files(count: number): AtFileRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `file-src/f${index}.ts`, displayText: `src/f${index}.ts`, score: index / count,
  }));
}

test('an empty query lists files, resources, templates then agents up to the cap', () => {
  const rows = combinedAtRows({
    query: '', showOnEmpty: true, files: files(2),
    mcpResources: { docs: [{ server: 'docs', uri: 'docs://guide' }] },
    mcpResourceTemplates: { repo: [{ server: 'repo', uriTemplate: 'repo://file/{path}' }] },
    agents,
  });
  assert.deepEqual(rows.map(row => row.id), [
    'file-src/f0.ts', 'file-src/f1.ts', 'mcp-resource-docs__docs://guide',
    'mcp-template::repo__repo://file/{path}', 'agent-explore', 'agent-reviewer',
  ]);
});

test('an empty query is dropped unless the caller asks for it', () => {
  assert.deepEqual(combinedAtRows({ query: '', showOnEmpty: false, files: files(2), agents }), []);
});

test('the cap counts every family together', () => {
  const rows = combinedAtRows({ query: '', showOnEmpty: true, files: files(20), agents });
  assert.equal(rows.length, AT_SUGGESTION_LIMIT);
  assert.equal(rows.filter(row => row.id.startsWith('agent-')).length, 0);
});

test('a query keeps the files in score order and appends the fuzzy hits', () => {
  const rows = combinedAtRows({
    query: 'f', showOnEmpty: false, agents: [],
    files: [{ id: 'file-a', displayText: 'a', score: 0.9 },
      { id: 'file-b', displayText: 'b', score: 0.1 },
      { id: 'file-c', displayText: 'c', score: 0.5 }],
  });
  assert.deepEqual(rows.map(row => row.id), ['file-b', 'file-c', 'file-a']);
});

test('an exact agent name outranks a weakly matching file', () => {
  const rows = combinedAtRows({
    query: 'explore', showOnEmpty: false, agents,
    files: [{ id: 'file-x', displayText: 'src/explore-helpers.ts', score: 0.4 }],
  });
  assert.equal(rows[0]?.id, 'agent-explore');
});

test('a resource pays the fifteen-hundredths offset against its template twin', () => {
  const rows = combinedAtRows({
    query: 'docs', showOnEmpty: false, files: [], agents: [],
    mcpResources: { docs: [{ server: 'docs', uri: 'docs://docs' }] },
    mcpResourceTemplates: { docs: [{ server: 'docs', uriTemplate: 'docs://docs' }] },
  });
  assert.deepEqual(rows.map(row => row.id),
    ['mcp-template::docs__docs://docs', 'mcp-resource-docs__docs://docs']);
});

test('a template shows only its literal head and cuts its description', () => {
  const [row] = combinedAtRows({
    query: '', showOnEmpty: true, files: [], agents: [],
    mcpResourceTemplates: { repo: [{ server: 'repo', uriTemplate: 'repo://file/{path}/blob',
      description: 'y'.repeat(90) }] },
  });
  assert.equal(row?.displayText, 'repo:repo://file/');
  assert.equal([...(row?.description ?? '')].length, AT_DESCRIPTION_LIMIT);
});

test('a resource falls back from description to name to uri', () => {
  const rows = combinedAtRows({
    query: '', showOnEmpty: true, files: [], agents: [],
    mcpResources: { s: [{ server: 's', uri: 'u', name: 'named' }, { server: 's', uri: 'bare' }] },
  });
  assert.deepEqual(rows.map(row => row.description), ['named', 'bare']);
});

test('a template prefix stops at the first brace', () => {
  assert.equal(templatePrefix('repo://file/{path}'), 'repo://file/');
  assert.equal(templatePrefix('repo://file/static'), 'repo://file/static');
  assert.equal(templatePrefix('{a}'), '');
});

test('a ui:// URI is app-only and never listed', () => {
  assert.equal(isUiOnlyResource({ uri: 'UI://panel' }), true);
  assert.equal(isUiOnlyResource({ uri: 'repo://file' }), false);
});

test('a text/html mime type is app-only only with profile=mcp-app', () => {
  assert.equal(isUiOnlyResource({ uri: 'repo://a', mimeType: 'text/html; profile=mcp-app' }), true);
  assert.equal(isUiOnlyResource({ uri: 'repo://a', mimeType: 'text/html;profile="MCP-App"' }), true);
  assert.equal(isUiOnlyResource({ uri: 'repo://a', mimeType: 'text/html; profile=other' }), false);
  assert.equal(isUiOnlyResource({ uri: 'repo://a', mimeType: 'text/html' }), false);
  assert.equal(isUiOnlyResource({ uri: 'repo://a', mimeType: 'text/markdown; profile=mcp-app' }), false);
  assert.equal(isUiOnlyResource({ uri: 'repo://a', mimeType: `text/html; ${'x'.repeat(1100)}` }), false,
    'an oversized mime type is listed rather than parsed');
});

test('the row builders drop the hidden resources and keep the server prefix', () => {
  const resources: Record<string, readonly McpResource[]> = {
    a: [{ server: 'a', uri: 'repo://one', name: 'One' }, { server: 'a', uri: 'ui://hidden' }],
    b: [{ server: 'b', uri: 'repo://two', mimeType: 'text/html; profile=mcp-app' }],
  };
  assert.deepEqual(mcpResourceRows(resources).map(row => row.displayText),
    ['a:repo://one'], 'flattened server-first, the hidden pair removed');
  const templates: Record<string, readonly McpTemplate[]> = {
    a: [{ server: 'a', uriTemplate: 'repo://file/{path}' }],
  };
  assert.deepEqual(mcpTemplateRows(templates).map(row => row.displayText), ['a:repo://file/']);
});

test('a template row carries its replacement and stays partial', () => {
  const [row] = combinedAtRows({ query: '', showOnEmpty: true, files: [], agents: [],
    mcpResourceTemplates: { repo: [{ server: 'repo', uriTemplate: 'repo://file/{path}' }] } });
  assert.deepEqual(row?.metadata, { replacement: '@repo:repo://file/', partial: true });
});

test('a spaced template replacement is quoted and a partial leaves it open', () => {
  assert.equal(shapeTemplateReplacement('a:b', true), '@a:b');
  assert.equal(shapeTemplateReplacement('a b', true), '@"a b"');
  assert.equal(shapeTemplateReplacement('a b', false), '@"a b');
});

