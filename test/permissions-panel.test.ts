import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PERMISSION_ADD_RULE_LABEL, PERMISSION_ADD_RULE_VALUE, PERMISSION_GUIDE, PERMISSIONS_DISMISSED,
  PERMISSION_RULE_TABS, PERMISSION_SAVE_DESTINATIONS, PERMISSION_TABS, browsePermissions,
  permissionAddedReport, permissionDeleteFailedReport, permissionDeletedReport,
  permissionPanelRules, permissionRuleDecomposition, permissionRuleKey, permissionRuleLabels,
  PERMISSION_LABEL_LIMIT, permissionRulePaneRequest, permissionRuleRows, permissionRuleText, permissionSaveOptions,
  permissionSaveRequest, permissionShadowWarningLines, permissionShadowWarnings, permissionSourceName,
  permissionTabRow, permissionTabTitle, permissionsPanelRequest, type PermissionPanelRule,
} from '../src/permissions-panel.js';
import type { PermissionUpdate } from '../src/permissions.js';

function rule(toolName: string, ruleContent?: string, source = 'userSettings',
  ruleBehavior: 'allow' | 'deny' | 'ask' = 'allow'): PermissionPanelRule {
  return { ruleValue: ruleContent === undefined ? { toolName } : { toolName, ruleContent }, ruleBehavior, source };
}

test('the rule display text folds whitespace and strips what the source strips', () => {
  assert.equal(permissionRuleText({ toolName: 'Bash', ruleContent: 'ls *' }), 'Bash(ls *)');
  assert.equal(permissionRuleText({ toolName: 'Bash' }), 'Bash');
  // The serializer keeps the specifier verbatim; only the fold runs here.
  assert.equal(permissionRuleText({ toolName: 'Bash', ruleContent: '  ls   -la  ' }), 'Bash( ls -la )');
  // `Hu`: the invisible characters never reach the label.
  assert.equal(permissionRuleText({ toolName: 'Bash', ruleContent: 'ls​ ﻿-la' }), 'Bash(ls -la)');
});

test('the decomposition names the four recovered readings', () => {
  assert.deepEqual(permissionRuleDecomposition({ toolName: 'Bash' }), { prefix: 'Any Bash command' });
  assert.deepEqual(permissionRuleDecomposition({ toolName: 'Bash', ruleContent: 'ls:*' }),
    { prefix: 'Any Bash command starting with ', emphasis: 'ls' });
  assert.deepEqual(permissionRuleDecomposition({ toolName: 'Bash', ruleContent: 'ls *' }),
    { prefix: 'Any Bash command starting with ', emphasis: 'ls' });
  assert.deepEqual(permissionRuleDecomposition({ toolName: 'Bash', ruleContent: 'ls -la' }),
    { prefix: 'The Bash command ', emphasis: 'ls -la' });
  assert.deepEqual(permissionRuleDecomposition({ toolName: 'Read' }),
    { prefix: 'Any use of the ', emphasis: 'Read', suffix: ' tool' });
  // A specifier on another tool has no reading; the serialized text stands alone.
  assert.equal(permissionRuleDecomposition({ toolName: 'Read', ruleContent: '/tmp/x' }), undefined);
});

test('duplicate labels take the escaped form and a counted suffix', () => {
  assert.deepEqual(permissionRuleLabels([{ toolName: 'Bash', ruleContent: 'ls *' }, { toolName: 'Read' }]),
    ['Bash(ls *)', 'Read']);
  // Identical texts share one group, so they never earn a suffix.
  assert.deepEqual(permissionRuleLabels([{ toolName: 'Read' }, { toolName: 'Read' }]), ['Read', 'Read']);
  // Two rules that fold onto the same display text drop to the serialized text, unfolded.
  assert.deepEqual(permissionRuleLabels([{ toolName: 'Bash', ruleContent: 'ls  *' }, { toolName: 'Bash', ruleContent: 'ls *' }]),
    ['Bash(ls  *)', 'Bash(ls *)']);
  // The duplicate form escapes what the plain form leaves alone.
  assert.deepEqual(permissionRuleLabels([{ toolName: 'Bash', ruleContent: 'é x' }, { toolName: 'Bash', ruleContent: 'é  x' }]),
    ['Bash(\\u00e9 x)', 'Bash(\\u00e9  x)']);
  // The suffix appears when the escaped forms collide: both fold alike and truncate alike.
  const long = 'a'.repeat(PERMISSION_LABEL_LIMIT) + ' x';
  const labels = permissionRuleLabels([
    { toolName: 'Bash', ruleContent: long },
    { toolName: 'Bash', ruleContent: long.replace(' x', '  x') },
  ]);
  assert.ok(labels[0]!.endsWith('…'), labels[0]!.slice(-8));
  assert.ok(labels[1]!.endsWith(`… (#2)`), labels[1]!.slice(-12));
});

test('the source labels are the recovered table', () => {
  assert.equal(permissionSourceName('userSettings'), 'user settings');
  assert.equal(permissionSourceName('projectSettings'), 'shared project settings');
  assert.equal(permissionSourceName('localSettings'), 'project local settings');
  assert.equal(permissionSourceName('policySettings'), 'enterprise managed settings');
  assert.equal(permissionSourceName('flagSettings'), 'command line arguments');
  assert.equal(permissionSourceName('command'), 'command configuration');
  assert.equal(permissionSourceName('session'), 'current session');
});

test('the save scopes keep the recovered order and wording', () => {
  assert.deepEqual([...PERMISSION_SAVE_DESTINATIONS], ['localSettings', 'projectSettings', 'userSettings']);
  const options = permissionSaveOptions({ localSettings: '/w/.harness/settings.local.json',
    projectSettings: '/w/.harness/settings.json', userSettings: '/u/settings.json' });
  assert.deepEqual(options, [
    { label: 'Project settings (local)', description: 'Saved in /w/.harness/settings.local.json', value: 'localSettings' },
    { label: 'Project settings', description: 'Checked in at /w/.harness/settings.json', value: 'projectSettings' },
    { label: 'User settings', description: 'Saved in at /u/settings.json', value: 'userSettings' },
  ]);
  assert.deepEqual(permissionSaveOptions().map(option => option.description), [
    'Saved in ~/.claude/settings.json', 'Checked in at ~/.claude/settings.json',
    'Saved in at ~/.claude/settings.json',
  ]);
});

test('the tab table keeps the recovered order and titles', () => {
  assert.deepEqual(PERMISSION_TABS.map(tab => tab.id),
    ['recent', 'allow', 'ask', 'deny', 'automode', 'workspace']);
  assert.equal(permissionTabTitle('recent'), 'Recently denied');
  assert.equal(permissionTabTitle('automode'), 'Auto mode');
  assert.equal(permissionTabRow('ask'), ' Allow [Ask] Deny ');
});

test('the rule rows lead with the add row, sort by text and filter on the query', () => {
  const rules = [rule('Read'), rule('Bash', 'ls *'), rule('Bash', 'git status')];
  const list = permissionRuleRows(rules, 'allow');
  assert.equal(list.options[0]!.value, PERMISSION_ADD_RULE_VALUE);
  assert.equal(list.options[0]!.label, PERMISSION_ADD_RULE_LABEL);
  assert.deepEqual(list.options.slice(1).map(option => option.label), ['Bash(git status)', 'Bash(ls *)', 'Read']);
  // The value is the rule's canonical key, and the map resolves it back.
  assert.deepEqual(list.rulesByKey.get(list.options[1]!.value)?.ruleValue, { toolName: 'Bash', ruleContent: 'git status' });
  assert.equal(permissionRuleKey(rules[1]!), 'userSettings\u0000allow\u0000Bash(ls *)');
  // A filter drops the add row and keeps only matching rules.
  const filtered = permissionRuleRows(rules, 'allow', 'git');
  assert.deepEqual(filtered.options.map(option => option.label), ['Bash(git status)']);
  // The three tabs without rule rows never offer the add row.
  for (const tab of ['workspace', 'recent', 'automode'] as const) {
    assert.deepEqual(permissionRuleRows([], tab).options, []);
  }
});

test('the panel body carries the tab row, the intro and the empty state', () => {
  const request = permissionsPanelRequest({ rules: [] }, 'deny');
  assert.equal(request.title, 'Permissions');
  assert.ok(request.message.includes('Deny'));
  assert.ok(request.message.includes('Claude Code will always reject requests to use denied tools.'));
  assert.ok(request.message.includes('No deny rules'));
  assert.ok(request.message.includes(PERMISSION_GUIDE));
  assert.deepEqual((request.choices ?? []).map(choice => choice.value), ['tab:allow', 'tab:ask', 'tab:deny', PERMISSION_ADD_RULE_VALUE]);
  assert.equal(request.defaultIndex, 2);

  const listed = permissionsPanelRequest({ rules: [rule('Read'), rule('Bash', 'ls *', 'projectSettings')] }, 'allow');
  assert.ok(listed.message.includes('  Bash(ls *)'));
  assert.ok(listed.message.includes('  Read'));
  assert.ok(!listed.message.includes('No allow rules'));
  assert.deepEqual((listed.choices ?? []).slice(3).map(choice => choice.label), [PERMISSION_ADD_RULE_LABEL, 'Bash(ls *)', 'Read']);
});

test('the rule pane is read-only for managed, flag and command sources', () => {
  const managed = permissionRulePaneRequest(rule('Bash', 'ls *', 'policySettings'));
  assert.equal(managed.title, 'Rule details');
  assert.ok(managed.message.includes('This rule is configured by managed settings and cannot be modified.'));
  assert.ok(managed.message.includes('Contact your system administrator for more information.'));
  assert.deepEqual((managed.choices ?? []).map(choice => choice.value), ['back']);

  const flagged = permissionRulePaneRequest(rule('Bash', 'ls *', 'flagSettings'));
  assert.ok(flagged.message.includes('This rule comes from a read-only source (the --settings flag) and cannot be modified here.'));
  const command = permissionRulePaneRequest(rule('Bash', 'ls *', 'command'));
  assert.ok(command.message.includes('This rule comes from a read-only source (a slash command) and cannot be modified here.'));

  const ask = permissionRulePaneRequest(rule('Bash', 'ls *', 'userSettings', 'ask'));
  assert.ok(ask.message.includes('Delete ask tool?'));
  assert.ok(ask.message.includes('Are you sure you want to delete this permission rule?'));
  assert.ok(ask.message.includes('From user settings'));
  assert.ok(ask.message.includes('Any Bash command starting with ls'));
  assert.deepEqual(ask.choices, [{ label: 'Yes', value: 'confirm' }, { label: 'No', value: 'cancel' }]);
  assert.equal(ask.defaultIndex, 1);
});

test('the shadow analysis reports the deny block first and honours the sandbox exemption', () => {
  const allow = rule('Bash', 'git status');
  const denyAll = rule('Bash', undefined, 'policySettings', 'deny');
  const warnings = permissionShadowWarnings([allow], [], [denyAll]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.shadowType, 'deny');
  assert.equal(warnings[0]!.reason, 'Blocked by "Bash" deny rule (from enterprise managed settings)');
  assert.equal(warnings[0]!.fix,
    'Remove the "Bash" deny rule from enterprise managed settings, or remove the specific allow rule from user settings');
  assert.deepEqual(permissionShadowWarningLines(warnings[0]!), [
    `⚠ Warning: Bash(git status) is blocked`,
    '  Blocked by "Bash" deny rule (from enterprise managed settings)',
    '  Fix: Remove the "Bash" deny rule from enterprise managed settings, or remove the specific allow rule from user settings',
  ]);

  const askAll = rule('Bash', undefined, 'userSettings', 'ask');
  const shadowed = permissionShadowWarnings([allow], [askAll], []);
  assert.equal(shadowed[0]!.shadowType, 'ask');
  assert.ok(shadowed[0]!.reason.startsWith('Shadowed by "Bash" ask rule'));
  assert.ok(permissionShadowWarningLines(shadowed[0]!)[0]!.endsWith('is shadowed'));
  // Under sandbox auto-allow a Bash ask rule from the user layer no longer shadows.
  assert.deepEqual(permissionShadowWarnings([allow], [askAll], [], { sandboxAutoAllowEnabled: true }), []);
  // A project-layer ask rule still shadows under the same flag.
  const projectAsk = rule('Bash', undefined, 'projectSettings', 'ask');
  assert.equal(permissionShadowWarnings([allow], [projectAsk], [], { sandboxAutoAllowEnabled: true }).length, 1);
  // A content-less allow rule has nothing to shadow.
  assert.deepEqual(permissionShadowWarnings([rule('Bash')], [], [denyAll]), []);
});

test('the reports are the recovered lines', () => {
  assert.equal(permissionAddedReport('allow', { toolName: 'Bash', ruleContent: 'ls *' }), 'Added allow rule Bash(ls *)');
  assert.equal(permissionDeletedReport('deny', { toolName: 'Read' }), 'Deleted deny rule Read');
  assert.equal(permissionDeleteFailedReport({ toolName: 'Read' }), 'Could not delete Read — the rule is unchanged');
});

test('the panel walks the add flow and returns the rule it saved as its result', async () => {
  const updates: PermissionUpdate[] = [];
  const rules = [rule('Read')];
  const script = [
    { selected: [PERMISSION_ADD_RULE_VALUE] },
    { selected: [], text: ' Bash(ls *) ' },
    { selected: ['projectSettings'] },
    { selected: ['tab:deny'] },
    undefined,
  ];
  let step = 0;
  const notice = await browsePermissions(() => ({ rules }), async () => script[step++],
    async update => { updates.push(update); return {}; });
  assert.deepEqual(updates, [{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'ls *' }],
    behavior: 'allow', destination: 'projectSettings' }]);
  // Source `wu`: the dialog hands back its accumulated lines instead of the dismissed message.
  assert.equal(notice, 'Added allow rule Bash(ls *)');
});

test('the panel deletes a rule only after the confirm, and returns a failed write', async () => {
  const updates: PermissionUpdate[] = [];
  const target = rule('Read', undefined, 'projectSettings', 'deny');
  const script = [
    { selected: ['tab:deny'] },
    { selected: [permissionRuleKey(target)] },
    { selected: ['cancel'] },
    { selected: [permissionRuleKey(target)] },
    { selected: ['confirm'] },
    undefined,
  ];
  let step = 0;
  const notice = await browsePermissions(() => ({ rules: [target] }), async () => script[step++],
    async update => { updates.push(update); return update.type === 'addRules' ? {} : { error: 'read-only' }; });
  // The cancelled arm applies nothing; the confirmed arm sends the one removal.
  assert.deepEqual(updates, [{ type: 'removeRules', rules: [{ toolName: 'Read' }],
    behavior: 'deny', destination: 'projectSettings' }]);
  assert.equal(notice, 'Could not delete Read — the rule is unchanged');
});

test('an empty add submission returns to the tab without applying anything', async () => {
  const updates: PermissionUpdate[] = [];
  const script = [{ selected: [PERMISSION_ADD_RULE_VALUE] }, { selected: [], text: '   ' }, undefined];
  let step = 0;
  const notice = await browsePermissions(() => ({ rules: [] }), async () => script[step++],
    async update => { updates.push(update); return {}; });
  assert.deepEqual(updates, []);
  assert.equal(notice, PERMISSIONS_DISMISSED);
});

test('the state buckets flatten into the three behaviours', () => {
  const rules = permissionPanelRules({ userSettings: ['Read', 'Bash(ls *)'], session: ['Write'] }, 'ask');
  assert.deepEqual(rules, [
    { ruleValue: { toolName: 'Read' }, ruleBehavior: 'ask', source: 'userSettings' },
    { ruleValue: { toolName: 'Bash', ruleContent: 'ls *' }, ruleBehavior: 'ask', source: 'userSettings' },
    { ruleValue: { toolName: 'Write' }, ruleBehavior: 'ask', source: 'session' },
  ]);
  assert.deepEqual(permissionPanelRules({}, 'deny'), []);
  assert.equal(PERMISSION_RULE_TABS.length, 3);
});

test('the add-rule surface carries the recovered example and asks for text', () => {
  const request = permissionSaveRequest('allow', [{ toolName: 'Bash', ruleContent: 'ls *' }]);
  assert.equal(request.title, 'Add allow permission rule');
  assert.ok(request.message.includes('Where should this rule be saved?'));
  assert.ok(request.message.includes('  Bash(ls *)'));
  assert.deepEqual((request.choices ?? []).map(choice => choice.value), ['localSettings', 'projectSettings', 'userSettings']);

  const many = permissionSaveRequest('deny', [{ toolName: 'Read' }, { toolName: 'Write' }]);
  assert.equal(many.title, 'Add deny permission rules');
  assert.ok(many.message.includes('Where should these rules be saved?'));
});
