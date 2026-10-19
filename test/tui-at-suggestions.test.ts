import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AT_DESCRIPTION_LIMIT, AT_SUGGESTION_LIMIT, combinedAtRows, templatePrefix,
} from '../src/tui-at-suggestions.js';
import type { AtFileRow } from '../src/tui-at-suggestions.js';
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
    resources: [{ server: 'docs', uri: 'docs://guide' }],
    templates: [{ server: 'repo', uriTemplate: 'repo://file/{path}' }],
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
    resources: [{ server: 'docs', uri: 'docs://docs' }],
    templates: [{ server: 'docs', uriTemplate: 'docs://docs' }],
  });
  assert.deepEqual(rows.map(row => row.id),
    ['mcp-template::docs__docs://docs', 'mcp-resource-docs__docs://docs']);
});

test('a template shows only its literal head and cuts its description', () => {
  const [row] = combinedAtRows({
    query: '', showOnEmpty: true, files: [], agents: [],
    templates: [{ server: 'repo', uriTemplate: 'repo://file/{path}/blob', description: 'y'.repeat(90) }],
  });
  assert.equal(row?.displayText, 'repo:repo://file/');
  assert.equal([...(row?.description ?? '')].length, AT_DESCRIPTION_LIMIT);
});

test('a resource falls back from description to name to uri', () => {
  const rows = combinedAtRows({
    query: '', showOnEmpty: true, files: [], agents: [],
    resources: [{ server: 's', uri: 'u', name: 'named' }, { server: 's', uri: 'bare' }],
  });
  assert.deepEqual(rows.map(row => row.description), ['named', 'bare']);
});

test('a template prefix stops at the first brace', () => {
  assert.equal(templatePrefix('repo://file/{path}'), 'repo://file/');
  assert.equal(templatePrefix('repo://file/static'), 'repo://file/static');
  assert.equal(templatePrefix('{a}'), '');
});
