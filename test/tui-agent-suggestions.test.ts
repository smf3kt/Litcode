import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_DESCRIPTION_LIMIT, agentColor, agentSuggestionRows } from '../src/tui-agent-suggestions.js';

const agents = [
  { name: 'explore', description: 'Fast read-only search agent' },
  { name: 'general-purpose', description: 'x'.repeat(100) },
  { name: 'reviewer', description: 'Reviews a change' },
];

test('an agent row names the type and cuts its description to sixty cells', () => {
  const rows = agentSuggestionRows(agents, '', true);
  assert.deepEqual(rows.map(row => row.id), ['agent-explore', 'agent-general-purpose', 'agent-reviewer']);
  assert.equal(rows[1]?.displayText, 'general-purpose (agent)');
  const description = rows[1]?.description ?? '';
  assert.equal([...description].length, AGENT_DESCRIPTION_LIMIT);
  assert.ok(description.endsWith('…'), 'the cut ends in an ellipsis');
  assert.equal(rows[0]?.description, 'Fast read-only search agent', 'a short description is untouched');
});

test('an empty query only lists agents when the caller asks for them', () => {
  assert.deepEqual(agentSuggestionRows(agents, ''), []);
  assert.equal(agentSuggestionRows(agents, '', true).length, 3);
});

test('a query keeps the types whose name or display text contains it', () => {
  assert.deepEqual(agentSuggestionRows(agents, 'rev', true).map(row => row.agentType), ['reviewer']);
  // No type name contains "agent", so all three can only match through the display text.
  assert.deepEqual(agentSuggestionRows(agents, 'agent', true).map(row => row.agentType),
    ['explore', 'general-purpose', 'reviewer']);
  assert.deepEqual(agentSuggestionRows(agents, 'zzz', true), []);
});

test('a colour needs an override and general-purpose never takes one', () => {
  assert.equal(agentColor('general-purpose'), undefined);
  assert.equal(agentColor('reviewer'), undefined);
  assert.equal(agentColor('reviewer', { reviewer: 'purple' }), 'purple_FOR_SUBAGENTS_ONLY');
  assert.equal(agentColor('general-purpose', { 'general-purpose': 'red' }), undefined);
  assert.equal(agentColor('reviewer', { reviewer: 'chartreuse' }), undefined);
  const [row] = agentSuggestionRows([{ name: 'reviewer', description: 'r' }], 'rev', true,
    name => agentColor(name, { reviewer: 'cyan' }));
  assert.equal(row?.color, 'cyan_FOR_SUBAGENTS_ONLY');
});
