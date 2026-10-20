import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HOOKS_ALL_EVENTS, HOOKS_ALL_MATCHER, HOOKS_DISMISSED, HOOKS_EVENTS_ROW, HOOKS_MANAGED_ONLY,
  HOOKS_MATCHES_EVERYTHING, HOOKS_NONE_FOR_EVENT, HOOKS_NONE_YET, attributeHooks, browseHooks,
  escapeHookText, hookConfigKindLabel, hookConfigLabel, hookConfigText, hookDetailRequest,
  hookDetailTitle, hookEventHooksTitle, hookEventSubtitle, hookGuidance, hookListSubtitle,
  hookMatcherLabel, hookMatcherTitle, hooksEventHooksRequest, hooksEventRequest, hooksListRequest,
  hooksMatcherRequest, pluralize, type HookPanelHook } from '../src/hooks-panel.js';
import type { HookDefinition, HooksConfig } from '../src/hooks.js';

const command = (value: string, matcher?: string): HookDefinition =>
  ({ type: 'command', command: value, ...(matcher === undefined ? {} : { matcher }) });
const hook = (event: HookPanelHook['event'], matcher: string, config: HookDefinition,
  source = 'localSettings', pluginName?: string): HookPanelHook =>
  ({ event, matcher, config, source, ...(pluginName === undefined ? {} : { pluginName }) });

test('counts and control characters render the recovered way', () => {
  assert.equal(pluralize(1, 'hook'), 'hook');
  assert.equal(pluralize(0, 'hook'), 'hooks');
  assert.equal(pluralize(2, 'event'), 'events');
  assert.equal(pluralize(1, 'match', 'matches'), 'match');
  assert.equal(escapeHookText('a\nb\tc'), 'a␤b␉c');
});

test('each local definition shows its own payload', () => {
  assert.equal(hookConfigText(command('echo hi')), 'echo hi');
  assert.equal(hookConfigText({ type: 'http', url: 'https://example.test/hook' }), 'https://example.test/hook');
  assert.equal(hookConfigText({ type: 'prompt', prompt: 'check it' }), 'check it');
  assert.equal(hookConfigText({ type: 'agent', prompt: 'delegate' }), 'delegate');
  assert.equal(hookConfigText({ type: 'mcp_tool', tool: 'lookup' }), 'lookup');
  assert.equal(hookConfigText({ type: 'callback', name: 'audit' }), 'audit');
  assert.equal(hookConfigText({ type: 'script', command: 'run.sh' }), 'run.sh');
  assert.equal(hookConfigLabel({ type: 'command', command: 'a\nb' }), 'a␤b');
});

test('the detail title and payload label follow the recovered type tables', () => {
  assert.equal(hookDetailTitle({ type: 'command', command: 'x' }), 'Command hook');
  assert.equal(hookDetailTitle({ type: 'http', url: 'u' }), 'HTTP hook');
  assert.equal(hookDetailTitle({ type: 'prompt', prompt: 'p' }), 'Prompt hook');
  assert.equal(hookDetailTitle({ type: 'agent', prompt: 'p' }), 'Agent hook');
  assert.equal(hookDetailTitle({ type: 'mcp_tool', tool: 't' }), 'MCP tool hook');
  assert.equal(hookDetailTitle({ type: 'script', command: 's' }), 'Script hook');
  assert.equal(hookConfigKindLabel({ type: 'command', command: 'x' }), 'Command');
  assert.equal(hookConfigKindLabel({ type: 'http', url: 'u' }), 'URL');
  assert.equal(hookConfigKindLabel({ type: 'agent', prompt: 'p' }), 'Prompt');
  assert.equal(hookConfigKindLabel({ type: 'mcp_tool', tool: 't' }), 'MCP tool');
  assert.equal(hookConfigKindLabel({ type: 'script', command: 's' }), 'Script');
});

test('the guidance names the file, the plugin, or the reason the hook is fixed', () => {
  const settingsPaths = { localSettings: '/w/.harness/settings.local.json' };
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'localSettings'), settingsPaths),
    'To change or remove this hook, edit /w/.harness/settings.local.json or ask Claude.');
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'userSettings'), settingsPaths),
    'To change or remove this hook, edit settings.json or ask Claude.');
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'pluginHook', 'audit-log')),
    'This hook comes from the audit-log plugin and stops running when that plugin is disabled (/plugin).');
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'pluginHook')),
    'This hook comes from a plugin and stops running when that plugin is disabled (/plugin).');
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'builtinHook')),
    "This hook is built in to Claude Code and can't be changed or removed.");
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'sessionHook')),
    "This hook was registered while Claude Code was running (by /goal, an agent or a skill), not by a settings file, and can't be changed here.");
  assert.equal(hookGuidance(hook('Stop', '', command('x'), 'policySettings')),
    "This hook is set by your organization's managed settings and can't be changed here.");
});

test('the list subtitle counts hooks and events, or names why it is empty', () => {
  assert.equal(hookListSubtitle([]), HOOKS_NONE_YET);
  assert.equal(hookListSubtitle([], true), HOOKS_MANAGED_ONLY);
  assert.equal(hookListSubtitle([hook('Stop', '', command('a'))]), '1 hook on 1 event');
  assert.equal(hookListSubtitle([hook('Stop', '', command('a')), hook('Stop', 'Bash', command('b')),
    hook('PreToolUse', 'Bash', command('c'))]), '3 hooks on 2 events');
  assert.equal(hookEventSubtitle(33, 2), '33 events · 2 with hooks');
  assert.equal(hookEventSubtitle(1, 1), '1 event · 1 with hooks');
});

test('the matcher label and the two matcher titles are the recovered ones', () => {
  assert.equal(hookMatcherLabel(''), HOOKS_ALL_MATCHER);
  assert.equal(hookMatcherLabel('Bash'), 'Bash');
  assert.equal(hookMatcherTitle('PreToolUse'), 'PreToolUse - Matchers');
  assert.equal(hookEventHooksTitle('PreToolUse', 'Bash', true), 'PreToolUse - Matcher: Bash');
  assert.equal(hookEventHooksTitle('PreToolUse', '', true), 'PreToolUse - Matcher: (all)');
  assert.equal(hookEventHooksTitle('Stop', '', false), 'Stop');
});

test('the list carries one row per hook and the All events row last', () => {
  const request = hooksListRequest({ hooks: [hook('Stop', '', command('a')), hook('PreToolUse', 'Bash', command('b'))] });
  assert.equal(request.title, 'Hooks');
  assert.ok(request.message.startsWith('2 hooks on 2 events'));
  assert.deepEqual(request.choices!.map(choice => choice.value), ['hook:0', 'hook:1', HOOKS_EVENTS_ROW]);
  assert.equal(request.choices!.at(-1)?.label, HOOKS_ALL_EVENTS);
  const empty = hooksListRequest({ hooks: [] });
  assert.ok(empty.message.includes(HOOKS_NONE_YET));
  assert.deepEqual(empty.choices!.map(choice => choice.value), [HOOKS_EVENTS_ROW]);
});

test('the event browser lists every event and counts only the ones with hooks', () => {
  const request = hooksEventRequest({ hooks: [hook('Stop', '', command('a'))] });
  const values = request.choices!.map(choice => choice.value);
  assert.equal(values.length, 33);
  assert.ok(values.includes('event:Stop'));
  assert.ok(request.message.startsWith('33 events · 1 with hooks'));
  const stop = request.choices!.find(choice => choice.value === 'event:Stop');
  assert.equal(stop?.description, 'Right before Claude concludes its response · 1 hook');
  const idle = request.choices!.find(choice => choice.value === 'event:TeammateIdle');
  assert.equal(idle?.description, 'When a teammate is about to go idle');
});

test('the matcher browser groups by matcher and shows its sources', () => {
  const hooks = [hook('PreToolUse', 'Bash', command('a'), 'localSettings'),
    hook('PreToolUse', 'Bash', command('b'), 'userSettings'),
    hook('PreToolUse', '', command('c'), 'projectSettings')];
  const request = hooksMatcherRequest({ hooks }, 'PreToolUse');
  assert.equal(request.title, 'PreToolUse - Matchers');
  assert.deepEqual(request.choices!.map(choice => choice.label), ['Bash', HOOKS_ALL_MATCHER]);
  assert.equal(request.choices![0]?.description, '[localSettings, userSettings] · 2 hooks');
  assert.equal(request.choices![1]?.description, '[projectSettings] · 1 hook');
  assert.ok(request.message.startsWith('Input to command is JSON of tool call arguments.'));
  const empty = hooksMatcherRequest({ hooks: [] }, 'Stop');
  assert.ok(empty.message.includes(HOOKS_NONE_FOR_EVENT));
  assert.deepEqual(empty.choices!, []);
});

test('the hooks surface filters by matcher only where the event declares one', () => {
  const hooks = [hook('PreToolUse', 'Bash', command('a')), hook('PreToolUse', '', command('b'))];
  const filtered = hooksEventHooksRequest({ hooks }, 'PreToolUse', 'Bash');
  assert.equal(filtered.title, 'PreToolUse - Matcher: Bash');
  assert.deepEqual(filtered.choices!.map(choice => choice.value), ['hook:0']);
  const all = hooksEventHooksRequest({ hooks }, 'Stop', '');
  assert.equal(all.title, 'Stop');
  assert.equal(all.choices!.length, 0);
  assert.ok(all.message.includes(HOOKS_NONE_FOR_EVENT));
});

test('the detail view names the event, the matcher, the source and the guidance', () => {
  const request = hookDetailRequest(hook('PreToolUse', 'Bash', command('run.sh')), { localSettings: '/w/settings.local.json' });
  assert.equal(request.title, 'Command hook');
  const lines = request.message.split('\n');
  assert.equal(lines[0], 'PreToolUse · Bash');
  assert.equal(lines[2], 'Source: Local settings (.claude/settings.local.json)');
  assert.equal(lines[4], 'Command');
  assert.equal(lines[5], 'run.sh');
  assert.ok(request.message.includes('To change or remove this hook, edit /w/settings.local.json or ask Claude.'));
  const matcherless = hookDetailRequest(hook('Stop', '', command('x')));
  assert.equal(matcherless.message.split('\n')[0], 'Stop');
  const all = hookDetailRequest(hook('PreToolUse', '', command('x')));
  assert.equal(all.message.split('\n')[0], `PreToolUse · ${HOOKS_MATCHES_EVERYTHING}`);
  const plugin = hookDetailRequest(hook('Stop', '', command('x'), 'pluginHook', 'audit-log'));
  assert.ok(plugin.message.includes('Plugin: audit-log'));
});

test('attribution recovers the layer each merged entry came from', () => {
  const layers = [
    { source: 'localSettings', hooks: { Stop: [command('local')] } as HooksConfig },
    { source: 'userSettings', hooks: { Stop: [command('user', 'Bash')] } as HooksConfig },
  ];
  const merged: HooksConfig = { Stop: [command('local'), command('user', 'Bash'), command('plugin')] };
  const hooks = attributeHooks(merged, layers);
  assert.deepEqual(hooks.map(entry => [hookConfigText(entry.config), entry.source]),
    [['local', 'localSettings'], ['user', 'userSettings'], ['plugin', 'pluginHook']]);
});

test('attribution expands a matcher group and keeps duplicate declarations apart', () => {
  const shared = command('same');
  const layers = [
    { source: 'projectSettings', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [shared, command('second')] }] } as HooksConfig },
    { source: 'userSettings', hooks: { PreToolUse: [command('same')] } as HooksConfig },
  ];
  const merged: HooksConfig = { PreToolUse: [
    { matcher: 'Bash', hooks: [shared, command('second')] },
    command('same'),
  ] };
  const hooks = attributeHooks(merged, layers);
  assert.deepEqual(hooks.map(entry => [entry.matcher, hookConfigText(entry.config), entry.source]), [
    ['Bash', 'same', 'projectSettings'],
    ['Bash', 'second', 'projectSettings'],
    ['', 'same', 'userSettings'],
  ]);
});

test('the browser walks list, events, matchers, hooks and detail, and Escape steps back', async () => {
  const hooks = [hook('PreToolUse', 'Bash', command('a')), hook('Stop', '', command('b'))];
  const seen: string[] = [];
  const script = [HOOKS_EVENTS_ROW, 'event:PreToolUse', 'matcher:Bash', 'hook:0', 'back', undefined,
    undefined, undefined, undefined];
  const notice = await browseHooks({ hooks }, async request => {
    seen.push(request.title ?? '');
    const value = script.shift();
    if (value === undefined) return undefined;
    return { selected: [value] };
  });
  assert.equal(notice, HOOKS_DISMISSED);
  assert.deepEqual(seen, ['Hooks', 'Hook events', 'PreToolUse - Matchers', 'PreToolUse - Matcher: Bash',
    'Command hook', 'PreToolUse - Matcher: Bash', 'PreToolUse - Matchers', 'Hook events', 'Hooks']);
});

test('a hook opened from the list returns to the list', async () => {
  const hooks = [hook('Stop', '', command('b'))];
  const seen: string[] = [];
  const script = ['hook:0', 'back', undefined];
  await browseHooks({ hooks }, async request => {
    seen.push(request.title ?? '');
    const value = script.shift();
    return value === undefined ? undefined : { selected: [value] };
  });
  assert.deepEqual(seen, ['Hooks', 'Command hook', 'Hooks']);
});

test('an event without matcher metadata goes straight to its hooks', async () => {
  const hooks = [hook('Stop', '', command('b'))];
  const seen: string[] = [];
  const script = [HOOKS_EVENTS_ROW, 'event:Stop', undefined, undefined, undefined];
  const notice = await browseHooks({ hooks }, async request => {
    seen.push(request.title ?? '');
    const value = script.shift();
    return value === undefined ? undefined : { selected: [value] };
  });
  assert.equal(notice, HOOKS_DISMISSED);
  assert.deepEqual(seen, ['Hooks', 'Hook events', 'Stop', 'Hook events', 'Hooks']);
});
