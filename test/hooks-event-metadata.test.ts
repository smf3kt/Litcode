import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HOOK_EVENTS } from '../src/hooks.js';
import { HOOK_EVENT_METADATA, HOOK_SOURCE_ORDER, HOOK_SOURCES, hookEventMetadata,
  hookSourceDescription, hookSourceHeader, hookSourceInline } from '../src/hooks-event-metadata.js';

test('the table covers the local event inventory exactly', () => {
  const listed = Object.keys(HOOK_EVENT_METADATA);
  assert.equal(listed.length, HOOK_EVENTS.length);
  for (const event of HOOK_EVENTS) assert.ok(listed.includes(event), `${event} is missing`);
  for (const event of listed) assert.ok((HOOK_EVENTS as readonly string[]).includes(event), `${event} is not a local event`);
});

test('every event carries the recovered summary and contract', () => {
  for (const event of HOOK_EVENTS) {
    const entry = hookEventMetadata(event);
    assert.ok(entry, `${event} has no metadata`);
    assert.ok(entry.summary.length > 0, `${event} has no summary`);
    assert.ok(entry.description.length > 0, `${event} has no description`);
  }
});

test('a multi-line contract keeps its own line breaks', () => {
  const lines = HOOK_EVENT_METADATA.PreToolUse!.description.split('\n');
  assert.deepEqual(lines, [
    'Input to command is JSON of tool call arguments.',
    'Exit code 0 - stdout/stderr not shown',
    'Exit code 2 - show stderr to model and block tool call',
    'Other exit codes - show stderr to user only but continue with tool call',
  ]);
});

test('the matcher field is present only where the recovered table declares one', () => {
  assert.equal(hookEventMetadata('PreToolUse')?.matcherField, 'tool_name');
  assert.equal(hookEventMetadata('Notification')?.matcherField, 'notification_type');
  assert.equal(hookEventMetadata('UserPromptExpansion')?.matcherField, 'command_name');
  assert.equal(hookEventMetadata('StopFailure')?.matcherField, 'error');
  assert.equal(hookEventMetadata('Stop')?.matcherField, undefined);
  assert.equal(hookEventMetadata('UserPromptSubmit')?.matcherField, undefined);
  assert.equal(hookEventMetadata('SessionStart')?.matcherField, 'source');
});

test('a quoted contract survives as written', () => {
  assert.equal(hookEventMetadata('StopFailure')?.summary, 'When the turn ends due to an API error');
  assert.ok(hookEventMetadata('PostToolUse')!.description.includes('"inputs" (tool call arguments)'));
});

test('every settings source keeps its recovered attribution', () => {
  assert.deepEqual(HOOK_SOURCES.userSettings,
    { description: 'User settings (~/.claude/settings.json)', header: 'User Settings', inline: 'User' });
  assert.deepEqual(HOOK_SOURCES.localSettings,
    { description: 'Local settings (.claude/settings.local.json)', header: 'Local Settings', inline: 'Local' });
  assert.deepEqual(HOOK_SOURCES.pluginHook, {
    description: 'Plugin hooks (~/.claude/plugins/*/hooks/hooks.json)', header: 'Plugin Hooks', inline: 'Plugin' });
  assert.deepEqual(HOOK_SOURCES.builtinHook, {
    description: 'Built-in hooks (registered internally by Claude Code)', header: 'Built-in Hooks', inline: 'Built-in' });
});

test('the three source readers fall back to the raw source', () => {
  assert.equal(hookSourceInline('pluginHook'), 'Plugin');
  assert.equal(hookSourceHeader('localSettings'), 'Local Settings');
  assert.equal(hookSourceDescription('sessionHook'), 'Session hooks (in-memory, temporary)');
  assert.equal(hookSourceInline('somethingElse'), 'somethingElse');
  assert.equal(hookSourceHeader('somethingElse'), 'somethingElse');
  assert.equal(hookSourceDescription('somethingElse'), 'somethingElse');
});

test('the matcher ordering names the settings sources lowest precedence first', () => {
  assert.deepEqual(HOOK_SOURCE_ORDER, ['localSettings', 'projectSettings', 'userSettings']);
});
