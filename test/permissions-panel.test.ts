import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  PERMISSION_ADD_DIRECTORY_LABEL, PERMISSION_ADD_DIRECTORY_VALUE, PERMISSION_ADD_RULE_LABEL,
  PERMISSION_ADD_RULE_VALUE, PERMISSION_GUIDE, PERMISSIONS_DISMISSED, PERMISSIONS_WORKSPACE_DISMISSED,
  PERMISSION_OFFERED_TABS, PERMISSION_RULE_TABS, PERMISSION_SAVE_DESTINATIONS, PERMISSION_TABS,
  PERMISSION_WORKSPACE_INTRO, PERMISSION_WORKSPACE_ORIGINAL, browsePermissions,
  denialRows, denialsGrantReport, PERMISSION_RECENT_APPROVED_MARK, PERMISSION_RECENT_DENIED_MARK,
  PERMISSION_RECENT_EMPTY, PERMISSION_RECENT_GUIDE, PERMISSION_RECENT_HEADER,
  PERMISSION_RECENT_RETRY_KEY,
  permissionAddedReport, permissionDeleteFailedReport, permissionDeletedReport,
  permissionPanelRules, permissionRuleDecomposition, permissionRuleKey, permissionRuleLabels,
  PERMISSION_LABEL_LIMIT, permissionRulePaneRequest, permissionRuleRows, permissionRuleText, permissionSaveOptions,
  permissionSaveRequest, permissionShadowWarningLines, permissionShadowWarnings, permissionSourceName,
  permissionTabRow, permissionTabTitle, permissionsPanelRequest, workspaceAddRequest,
  workspaceAddedReport, workspaceDirectoryRows, workspaceDisplayText, workspaceRemoveRequest,
  workspaceRemovedReport, workspaceTabLines, type PermissionPanelRule,
} from '../src/permissions-panel.js';
import { AUTO_MODE_DENIAL_LIMIT, AutoModeDenialStore, autoModeDenialDisplay, autoModeDenialInputKey,
  denialReasonText, type AutoModeDenial } from '../src/permission-denials.js';
import {
  AUTO_MODE_BUILTINS_TITLE, AUTO_MODE_DOCUMENT_VALUE, AUTO_MODE_INTRO, AUTO_MODE_SECTIONS,
  AUTO_MODE_SECTION_COLUMN, autoModeBuiltinCounts, autoModeBuiltinRow, autoModeBuiltinRules,
  autoModeBuiltins, autoModeBuiltinsPaneRequest, autoModeDocumentNote, autoModeDocumentPaneRequest,
  autoModeEntries, autoModeEntryPaneRequest, autoModeEntryRow, autoModeEntryValue, autoModeRows,
  autoModeSectionTitle, autoModeShowsBuiltin, autoModeSourceLabel, autoModeSourceTag,
  type AutoModeEntry,
} from '../src/auto-mode-panel.js';
import { permissionLayerSchema, type PermissionLayer, type PermissionUpdate } from '../src/permissions.js';

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
  assert.deepEqual([...PERMISSION_OFFERED_TABS], ['recent', 'allow', 'ask', 'deny', 'automode', 'workspace']);
  assert.equal(permissionTabRow('ask'), ' Recently denied  Allow [Ask] Deny  Auto mode  Workspace ');
  // The strip follows the caller's list, so a tab the build does not draw stays out.
  assert.equal(permissionTabRow('deny', PERMISSION_RULE_TABS), ' Allow  Ask [Deny]');
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
  assert.deepEqual((request.choices ?? []).map(choice => choice.value),
    ['tab:recent', 'tab:allow', 'tab:ask', 'tab:deny', 'tab:automode', 'tab:workspace', PERMISSION_ADD_RULE_VALUE]);
  assert.equal(request.defaultIndex, 3);

  const listed = permissionsPanelRequest({ rules: [rule('Read'), rule('Bash', 'ls *', 'projectSettings')] }, 'allow');
  assert.ok(listed.message.includes('  Bash(ls *)'));
  assert.ok(listed.message.includes('  Read'));
  assert.ok(!listed.message.includes('No allow rules'));
  assert.deepEqual((listed.choices ?? []).slice(6).map(choice => choice.label), [PERMISSION_ADD_RULE_LABEL, 'Bash(ls *)', 'Read']);
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

test('the workspace tab draws the intro, the original directory and its rows', () => {
  const request = permissionsPanelRequest({ rules: [], directories: ['/w/extras'], originalCwd: '/w' }, 'workspace');
  assert.ok(request.message.includes(PERMISSION_WORKSPACE_INTRO));
  assert.ok(request.message.includes(`-  /w ${PERMISSION_WORKSPACE_ORIGINAL}`));
  assert.ok(request.message.includes('  /w/extras'));
  assert.ok(request.message.includes(PERMISSION_GUIDE));
  // The add row is last here, unlike the rule tabs where it leads.
  assert.deepEqual((request.choices ?? []).slice(6).map(choice => choice.value), ['/w/extras', PERMISSION_ADD_DIRECTORY_VALUE]);
  assert.deepEqual((request.choices ?? []).slice(6).map(choice => choice.label), ['/w/extras', PERMISSION_ADD_DIRECTORY_LABEL]);
  assert.equal(request.defaultIndex, 5);
  // With no directory the tab still offers the add row and shows no empty-state line.
  const empty = permissionsPanelRequest({ rules: [], directories: [], originalCwd: '/w' }, 'workspace');
  assert.ok(!empty.message.includes('No additional working directories'));
  assert.deepEqual((empty.choices ?? []).slice(6).map(choice => choice.value), [PERMISSION_ADD_DIRECTORY_VALUE]);
});

test('the workspace labels go through the display fold, then the dedup', () => {
  // Source `Fn`: control, format and separator code points become U+FFFD.
  assert.equal(workspaceDisplayText('/w/a\u0007b'), '/w/a�b');
  assert.equal(workspaceDisplayText('/w/a b'), '/w/a�b');
  assert.equal(workspaceDisplayText('/w/plain'), '/w/plain');
  // Source `nB` = `uFe` over `Fn`: only paths that fold onto the same label take the escaped form.
  assert.deepEqual(workspaceDirectoryRows(['/w/one', '/w/two']).map(row => row.label),
    ['/w/one', '/w/two', PERMISSION_ADD_DIRECTORY_LABEL]);
  // Paths that fold onto the same label drop to the escaped form; ASCII alone is left as it is.
  assert.deepEqual(workspaceDirectoryRows(['/w/a b', '/w/a  b']).map(row => row.label),
    ['/w/a b', '/w/a  b', PERMISSION_ADD_DIRECTORY_LABEL]);
  assert.deepEqual(workspaceDirectoryRows(['/w/é x', '/w/é  x']).map(row => row.label),
    ['/w/\\u00e9 x', '/w/\\u00e9  x', PERMISSION_ADD_DIRECTORY_LABEL]);
  // The rows carry the raw path as their value and the original directory is never a row.
  assert.deepEqual(workspaceDirectoryRows(['/w/a b'])[0], { label: '/w/a b', value: '/w/a b' });
  assert.deepEqual(workspaceTabLines({ rules: [], directories: ['/w/x'], originalCwd: '/w' }),
    [PERMISSION_WORKSPACE_INTRO, '', `-  /w ${PERMISSION_WORKSPACE_ORIGINAL}`, '  /w/x']);
});

test('the workspace add flow validates, reports the add, and re-prompts on a rejection', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'w227-')));
  const originalCwd = path.join(root, 'w');
  const added = path.join(root, 'extras');
  fs.mkdirSync(originalCwd);
  fs.mkdirSync(added);
  try {
    const updates: PermissionUpdate[] = [];
    const script = [
      { selected: ['tab:workspace'] },
      { selected: [PERMISSION_ADD_DIRECTORY_VALUE] },
      { selected: [], text: path.join(root, 'missing') },
      { selected: [], text: '  ' },
      { selected: [PERMISSION_ADD_DIRECTORY_VALUE] },
      { selected: [], text: added },
      undefined,
    ];
    let step = 0;
    const input = { rules: [], directories: [], originalCwd };
    const notice = await browsePermissions(() => input, async () => script[step++],
      async update => { updates.push(update); return {}; });
    // The rejection and the empty submission apply nothing; the valid path adds for the session.
    assert.deepEqual(updates, [{ type: 'addDirectories', directories: [added], destination: 'session' }]);
    assert.equal(notice, workspaceAddedReport(added, false));
    assert.equal(notice, `Added directory ${added} to workspace for this session`);
    assert.equal(workspaceAddedReport(added, true), `Added directory ${added} to workspace and saved to local settings`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the workspace removal confirms first and reports the removal', async () => {
  const updates: PermissionUpdate[] = [];
  const script = [
    { selected: ['tab:workspace'] },
    { selected: ['/w/extras'] },
    { selected: ['cancel'] },
    { selected: ['/w/extras'] },
    { selected: ['confirm'] },
    undefined,
  ];
  let step = 0;
  const notice = await browsePermissions(() => ({ rules: [], directories: ['/w/extras'], originalCwd: '/w' }),
    async () => script[step++], async update => { updates.push(update); return {}; });
  assert.deepEqual(updates, [{ type: 'removeDirectories', directories: ['/w/extras'], destination: 'session' }]);
  assert.equal(notice, 'Removed directory /w/extras from workspace');
  assert.equal(workspaceRemovedReport('/w/extras'), notice);
});

test('the workspace tab dismisses with its own message and keeps the rule tabs to theirs', async () => {
  // The panel opens on a rule tab, so a bare Esc there gives the panel's own message.
  const rules = await browsePermissions(() => ({ rules: [], directories: [], originalCwd: '/w' }),
    async () => undefined, async () => ({}));
  assert.equal(rules, PERMISSIONS_DISMISSED);
  // Esc from a sub-surface steps back to the tab, so the dismissal only lands there.
  const backing = [{ selected: ['tab:workspace'] }, { selected: [PERMISSION_ADD_DIRECTORY_VALUE] },
    undefined, undefined];
  let step = 0;
  assert.equal(await browsePermissions(() => ({ rules: [], directories: [], originalCwd: '/w' }),
    async () => backing[step++], async () => ({})), PERMISSIONS_WORKSPACE_DISMISSED);
});

test('the workspace surfaces carry the recovered wording', () => {
  const add = workspaceAddRequest();
  assert.equal(add.title, 'Add directory to workspace');
  assert.equal(add.allowText, true);
  assert.ok(add.message.includes('Claude Code will be able to read files in this directory and make edits when auto-accept edits is on.'));
  assert.ok(add.message.includes('Enter the path to the directory:'));
  // Source `TXe`: a rejected path re-opens the surface with `hge`'s line under the prompt.
  assert.ok(workspaceAddRequest('Path /w/nope was not found.').message.includes('Path /w/nope was not found.'));

  const remove = workspaceRemoveRequest('/w/extras');
  assert.equal(remove.title, 'Remove directory from workspace?');
  assert.ok(remove.message.includes('/w/extras'));
  assert.ok(remove.message.includes('Claude Code will no longer have access to files in this directory.'));
  assert.deepEqual(remove.choices, [{ label: 'Yes', value: 'confirm' }, { label: 'No', value: 'cancel' }]);
  assert.equal(remove.defaultIndex, 1);
});

/* ------------------------------------------------------- the recent tab (W228) */

function denial(display: string, reason = ''): AutoModeDenial {
  return { toolName: 'run_command', display, inputKey: JSON.stringify({ command: display }), reason };
}

test('the denial store keeps the newest twenty by identity', () => {
  const store = new AutoModeDenialStore();
  for (let index = 0; index < 25; index += 1) store.record(denial(`command ${index}`));
  assert.equal(store.denials.length, AUTO_MODE_DENIAL_LIMIT);
  // Source `recordDenial`: the newest leads and the oldest falls off the tail.
  assert.equal(store.denials[0]!.display, 'command 24');
  assert.equal(store.denials.at(-1)!.display, 'command 5');
  // Source `removeDenial`: two identical records stay distinct until the held one goes.
  const first = denial('same');
  store.record(first);
  store.record(denial('same'));
  store.remove(first);
  assert.equal(store.denials.filter(entry => entry.display === 'same').length, 1);
});

test('the denial record keys shell tools on the command and others on the whole input', () => {
  // Source `B4` over `p_`: the shell tool's key drops the other fields.
  assert.equal(autoModeDenialInputKey('run_command', { command: 'ls', timeout: 1000 }), '{"command":"ls"}');
  assert.equal(autoModeDenialInputKey('write_file', { path: '/w/a', content: 'x' }),
    '{"path":"/w/a","content":"x"}');
});

test('the denial display is the tool input on one line, and the reason collapses', () => {
  const tool = { schema: { name: 'run_command' }, readOnly: false,
    toAutoClassifierInput: (input: unknown) => (input as { command: string }).command };
  assert.equal(autoModeDenialDisplay(tool as never, { command: 'rm -rf /w' }), 'rm -rf /w');
  // Source `Ci`/`Bi`: a line separator and a control code point both become U+FFFD.
  assert.equal(autoModeDenialDisplay(tool as never, { command: 'a\nb\u0007c' }), 'a�b�c');
  assert.equal(denialReasonText('  too   broad \n for this call '), 'too broad � for this call');
  assert.equal(denialReasonText(''), undefined);
  assert.equal(denialReasonText('   '), undefined);
});

test('the recent rows carry the status mark, the retry suffix and the reason', () => {
  // The second row folds onto the first's label, so `uFe` puts both back to their escaped raw text.
  const denials = [denial('rm -rf /w é', 'Deletes files'), denial('rm -rf /w  é')];
  const rows = denialRows(denials, new Set([0]), new Set([0]));
  assert.equal(rows[0]!.label, `${PERMISSION_RECENT_APPROVED_MARK}rm -rf /w \\u00e9 (retry)`);
  assert.equal(rows[1]!.label, `${PERMISSION_RECENT_DENIED_MARK}rm -rf /w  \\u00e9`);
  assert.equal(rows[0]!.description, 'Deletes files');
  assert.equal(rows[1]!.description, undefined);
  assert.deepEqual(rows.map(row => row.value), ['0', '1']);
  // A lone row keeps its plain label and shows no mark beyond the status icon.
  assert.equal(denialRows([denial('rm -rf /w')], new Set(), new Set())[0]!.label,
    `${PERMISSION_RECENT_DENIED_MARK}rm -rf /w`);
});

test('the recent tab draws its header, the empty state and the retry key', () => {
  const empty = permissionsPanelRequest({ rules: [], denials: [] }, 'recent');
  assert.ok(empty.message.includes(PERMISSION_RECENT_HEADER));
  assert.ok(empty.message.includes(PERMISSION_RECENT_EMPTY));
  assert.ok(empty.message.includes(PERMISSION_GUIDE));
  assert.equal(empty.keys, undefined);

  const listed = permissionsPanelRequest({ rules: [], denials: [denial('rm -rf /w', 'too broad')] }, 'recent');
  assert.ok(listed.message.includes(PERMISSION_RECENT_GUIDE));
  assert.deepEqual(listed.keys, [{ key: PERMISSION_RECENT_RETRY_KEY, label: 'r to retry' }]);
  assert.deepEqual((listed.choices ?? []).slice(6).map(choice => choice.value), ['0']);
  assert.equal((listed.choices ?? [])[6]!.description, 'too broad');
  assert.equal(listed.defaultIndex, 0);
});

test('the panel opens on the recent tab and Esc applies the approved marks', async () => {
  const denials = [denial('rm -rf /w', 'Deletes files'), denial('git push', 'Writes history')];
  const removed: AutoModeDenial[] = [];
  const script = [
    { selected: ['0'] },              // Enter approves the first row
    { selected: ['1'] },              // Enter approves the second
    { selected: ['1'] },              // Enter again withdraws it
    undefined,                        // Esc applies
  ];
  let step = 0;
  const notice = await browsePermissions(() => ({ rules: [], denials }),
    async () => script[step++], async () => ({}),
    { removeDenial: record => removed.push(record) });
  assert.deepEqual(removed, [denials[0]]);
  assert.equal(notice, `Approved rm -rf /w\n${denialsGrantReport(['rm -rf /w'])}`);
});

test('a retry mark hands the labels back and leaves the store alone', async () => {
  const denials = [denial('rm -rf /w')];
  const retried: (readonly string[])[] = [];
  const removed: AutoModeDenial[] = [];
  const script = [{ selected: ['0'], key: 'r' }, undefined];
  let step = 0;
  const notice = await browsePermissions(() => ({ rules: [], denials }),
    async () => script[step++], async () => ({}),
    { removeDenial: record => removed.push(record), onRetryDenials: labels => retried.push(labels) });
  assert.deepEqual(retried, [['rm -rf /w']]);
  assert.deepEqual(removed, []);
  assert.equal(notice, denialsGrantReport(['rm -rf /w']));
});

test('the recent tab dismisses plainly when nothing is marked', async () => {
  const script = [undefined, undefined];
  let step = 0;
  assert.equal(await browsePermissions(() => ({ rules: [], denials: [denial('rm -rf /w')] }),
    async () => script[step++], async () => ({}), {}), PERMISSIONS_DISMISSED);
  // The rule grid is the opening tab only while the denial list is empty.
  assert.equal(await browsePermissions(() => ({ rules: [], denials: [] }),
    async () => script[step++], async () => ({}), {}), PERMISSIONS_DISMISSED);
});

/* ---------------------------------------------------------------- W229 automode */

function layer(source: string, autoMode?: Record<string, readonly string[]>): PermissionLayer {
  return permissionLayerSchema.parse({ source, root: '/w', allow: [], deny: [], ask: [],
    additionalDirectories: [], ...(autoMode === undefined ? {} : { autoMode }) });
}

test('the automode section and source tables keep the recovered wording', () => {
  assert.deepEqual([...AUTO_MODE_SECTIONS], ['allow', 'soft_deny', 'hard_deny', 'environment']);
  assert.equal(autoModeSectionTitle('allow'), 'Soft allow');
  assert.equal(autoModeSectionTitle('soft_deny'), 'Soft deny');
  assert.equal(autoModeSectionTitle('hard_deny'), 'Hard deny');
  assert.equal(autoModeSectionTitle('environment'), 'Environment');
  assert.equal(autoModeSourceLabel('userSettings'), 'user settings');
  assert.equal(autoModeSourceLabel('flagSettings'), 'the --settings flag');
  assert.equal(autoModeSourceLabel('policySettings'), 'managed settings');
  // `En`: only a source that is not the user's own earns a column tag.
  assert.equal(autoModeSourceTag('userSettings'), undefined);
  assert.equal(autoModeSourceTag('flagSettings'), 'flag');
  assert.equal(autoModeSourceTag('policySettings'), 'org');
  assert.equal(AUTO_MODE_SECTION_COLUMN, 20);
  assert.equal(AUTO_MODE_INTRO, 'Extra rules for the auto mode classifier. Rules are plain sentences; '
    + 'new rules are saved to your user settings.');
});

test('the built-in rules come out of the classifier document, one entry per bullet', () => {
  const allow = autoModeBuiltinRules('allow');
  assert.ok(allow.length > 0);
  // `Rue` strips the bullet and keeps the rule text whole.
  assert.ok(allow.every(rule => !rule.startsWith('- ')));
  assert.ok(allow.some(rule => rule.startsWith('Read-Only Operations')));
  const counts = autoModeBuiltinCounts();
  for (const section of AUTO_MODE_SECTIONS) {
    assert.equal(counts[section], autoModeBuiltinRules(section).length);
  }
  assert.equal(counts.allow, allow.length);
});

test('the entry reader takes the three settings layers, skips the sentinel and marks structure', () => {
  const layers = [
    layer('userSettings', { allow: ['Allow reading docs', '$defaults'], environment: ['### Host', '- macOS'] }),
    layer('projectSettings', { allow: ['Ignored project rule'] }),
    layer('flagSettings', { soft_deny: ['Flag rule'] }),
    layer('policySettings', { hard_deny: ['Managed rule'] }),
  ];
  const entries = autoModeEntries(layers);
  assert.deepEqual(entries.map(entry => [entry.section, entry.source, entry.text]), [
    ['allow', 'userSettings', 'Allow reading docs'],
    ['environment', 'userSettings', '### Host'],
    ['environment', 'userSettings', '- macOS'],
    ['soft_deny', 'flagSettings', 'Flag rule'],
    ['hard_deny', 'policySettings', 'Managed rule'],
  ]);
  // `### ` lines are structure; the sentinel never reaches the list.
  assert.equal(entries.filter(entry => entry.structure === true).length, 1);
  assert.ok(!entries.some(entry => entry.text === '$defaults'));
  // The index is the position inside that layer's section array, so the sentinel leaves a gap.
  assert.deepEqual(entries.filter(entry => entry.section === 'allow').map(entry => entry.index), [0]);
  assert.equal(autoModeEntryValue(entries[1]!), 'environment:userSettings:0');
});

test('the builtins state follows the section, the sentinel and the owning layer', () => {
  // A section with no values keeps its built-ins on.
  assert.deepEqual(autoModeBuiltins([layer('userSettings')]).allow, { enabled: true, control: 'empty' });
  // User values without the sentinel replace the built-ins.
  assert.deepEqual(autoModeBuiltins([layer('userSettings', { soft_deny: ['mine'] })]).soft_deny,
    { enabled: false, control: 'user' });
  // The sentinel splices the built-ins back in.
  assert.deepEqual(autoModeBuiltins([layer('userSettings', { soft_deny: ['$defaults', 'mine'] })]).soft_deny,
    { enabled: true, control: 'user' });
  // A foreign layer's sentinel owns the section, and the theme reports where it comes from.
  const managed = autoModeBuiltins([layer('policySettings', { hard_deny: ['$defaults'] })]).hard_deny;
  assert.deepEqual(managed, { enabled: true, control: 'otherSource', source: 'policySettings' });
  // The environment is single-document: values without the sentinel replace the default.
  const environment = autoModeBuiltins([layer('userSettings', { environment: ['### Host'] })]).environment;
  assert.deepEqual(environment, { enabled: false, control: 'otherSource', source: 'userSettings' });
  assert.deepEqual(autoModeBuiltins([layer('userSettings', { environment: ['$defaults'] })]).environment,
    { enabled: true, control: 'otherSource', source: 'userSettings' });
});

test('only a replaced section hides its builtins row, and the environment never draws one', () => {
  const empty = { enabled: true, control: 'empty' } as const;
  const user = { enabled: false, control: 'user' } as const;
  const kept = { enabled: true, control: 'otherSource', source: 'policySettings' } as const;
  const off = { enabled: false, control: 'otherSource', source: 'userSettings' } as const;
  assert.equal(autoModeShowsBuiltin('allow', empty), true);
  assert.equal(autoModeShowsBuiltin('allow', user), true);
  assert.equal(autoModeShowsBuiltin('allow', kept), true);
  assert.equal(autoModeShowsBuiltin('allow', off), false);
  assert.equal(autoModeShowsBuiltin('environment', empty), false);
  assert.equal(autoModeShowsBuiltin('environment', kept), false);
});

test('the builtins row carries the mark, the count, the off state and the source', () => {
  assert.equal(autoModeBuiltinRow('allow', { enabled: true, control: 'empty' }, 17),
    `${'Soft allow'.padEnd(20)}[x] ${AUTO_MODE_BUILTINS_TITLE} · 17`);
  assert.equal(autoModeBuiltinRow('soft_deny', { enabled: false, control: 'user' }, 72),
    `${'Soft deny'.padEnd(20)}[ ] ${AUTO_MODE_BUILTINS_TITLE} · 72 · off`);
  assert.equal(autoModeBuiltinRow('hard_deny', { enabled: false, control: 'otherSource',
    source: 'policySettings' }, 1),
  `${'Hard deny'.padEnd(20)}[ ] ${AUTO_MODE_BUILTINS_TITLE} · 1 · off · from managed settings`);
});

test('the entry row is the section column, the source tag, then the text', () => {
  const entry = (over: Partial<AutoModeEntry>): AutoModeEntry =>
    ({ text: 'rule', section: 'allow', source: 'userSettings', index: 0, ...over });
  assert.equal(autoModeEntryRow(entry({})), `${'Soft allow'.padEnd(20)}rule`);
  // `Vm`: the tag is padded to the same 20-cell column, not appended after it.
  assert.equal(autoModeEntryRow(entry({ section: 'soft_deny', source: 'flagSettings' })),
    `Soft deny · flag${' '.repeat(20 - 'Soft deny · flag'.length)}rule`);
  assert.equal(autoModeEntryRow(entry({ section: 'hard_deny', source: 'policySettings' })),
    `Hard deny · org${' '.repeat(20 - 'Hard deny · org'.length)}rule`);
  // The text goes through the display fold, so a control character never reaches the row.
  assert.equal(autoModeEntryRow(entry({ text: 'a\u0000b' })), `${'Soft allow'.padEnd(20)}a\uFFFDb`);
});

test('the row list puts each section builtins first and the environment as one document row', () => {
  const layers = [layer('userSettings', {
    allow: ['Allow docs'], soft_deny: ['$defaults', 'Never push'], environment: ['### Host', '- macOS'],
  })];
  const entries = autoModeEntries(layers);
  const builtins = autoModeBuiltins(layers);
  const rows = autoModeRows(entries, builtins);
  assert.equal(rows[0]?.value, 'add-new-rule');
  assert.deepEqual(rows.map(row => row.value).slice(1, 3), ['builtins:allow', 'allow:userSettings:0']);
  assert.deepEqual(rows.map(row => row.value).slice(3, 4), ['builtins:soft_deny']);
  assert.deepEqual(rows.filter(row => row.value.startsWith('soft_deny:')).map(row => row.value),
    ['soft_deny:userSettings:1']);
  // The environment collapses into its document row, whose note names the sources.
  const document = rows.find(row => row.value === AUTO_MODE_DOCUMENT_VALUE)!;
  assert.ok(document.label.startsWith('Environment'.padEnd(20)));
  assert.ok(document.label.includes('Replaces the built-in default · from user settings'));
  assert.ok(document.description !== undefined && document.description.length > 0);
  // No environment entry rows survive the collapse.
  assert.equal(rows.filter(row => row.label.startsWith('Environment'.padEnd(20))).length, 1);
  assert.equal(autoModeRows(entries, builtins).length, 7);
});

test('the document note says kept for a foreign copy and default when nothing is configured', () => {
  const empty = autoModeBuiltins([layer('userSettings')]);
  assert.equal(autoModeDocumentNote([], empty.environment), 'Built-in default document · enter to edit');
  const foreign = autoModeBuiltins([layer('policySettings', { environment: ['$defaults'] })]);
  assert.equal(autoModeDocumentNote([], foreign.environment),
    'Built-in default document · kept by managed settings · enter to edit');
  const configured = [layer('userSettings', { environment: ['### Host', '- macOS'] })];
  const entries = autoModeEntries(configured);
  assert.ok(autoModeDocumentNote(entries, autoModeBuiltins(configured).environment)
    .startsWith('Replaces the built-in default · from user settings'));
});

test('the automode tab draws the intro, the rows and the document row', () => {
  const input = { rules: [], autoModeLayers: [layer('userSettings', {
    soft_deny: ['Never push to main'], environment: ['### Host', '- macOS'],
  })] };
  const request = permissionsPanelRequest(input, 'automode');
  assert.equal(request.title, 'Permissions');
  assert.ok(request.message.includes('[Auto mode]'));
  assert.ok(request.message.includes(AUTO_MODE_INTRO));
  assert.ok(request.message.includes(`  ${'Soft allow'.padEnd(20)}[x] ${AUTO_MODE_BUILTINS_TITLE} · ${autoModeBuiltinCounts().allow}`));
  assert.ok(request.message.includes(`  ${'Soft deny'.padEnd(20)}[ ] ${AUTO_MODE_BUILTINS_TITLE} · ${autoModeBuiltinCounts().soft_deny} · off`));
  assert.ok(request.message.includes(`  ${'Soft deny'.padEnd(20)}Never push to main`));
  assert.ok(request.message.includes(`  ${'Environment'.padEnd(20)}Replaces the built-in default`));
  assert.ok(request.message.includes(PERMISSION_GUIDE));
  assert.deepEqual((request.choices ?? []).slice(6).map(choice => choice.value), [
    'add-new-rule', 'builtins:allow', 'builtins:soft_deny', 'soft_deny:userSettings:0', 'builtins:hard_deny',
    AUTO_MODE_DOCUMENT_VALUE,
  ]);
  assert.equal(request.defaultIndex, 4);
});

test('the builtins card prints the count line, the rules and the control note', () => {
  const card = autoModeBuiltinsPaneRequest('allow', { enabled: true, control: 'empty' });
  assert.equal(card.title, AUTO_MODE_BUILTINS_TITLE);
  const count = autoModeBuiltinRules('allow').length;
  assert.ok(card.message.startsWith(`Soft allow · ${count} built-in ${count === 1 ? 'rule' : 'rules'} · in effect`));
  assert.ok(card.message.includes('- '));
  assert.ok(card.message.includes('This section has no configured rules, so the built-ins apply. '
    + 'Add a rule to customize it.'));
  assert.deepEqual(card.choices, [{ label: 'View in editor', value: 'view' }, { label: 'Cancel', value: 'cancel' }]);

  const replaced = autoModeBuiltinsPaneRequest('soft_deny', { enabled: false, control: 'otherSource',
    source: 'userSettings' });
  assert.ok(replaced.message.includes('Soft deny · '));
  assert.ok(replaced.message.includes('· switched off'));
  assert.ok(replaced.message.includes('Replaced by rules from user settings. This control follows '
    + 'that configuration; add your own rules to customize the section.'));
  const kept = autoModeBuiltinsPaneRequest('hard_deny', { enabled: true, control: 'otherSource',
    source: 'policySettings' });
  assert.ok(kept.message.includes('Kept on by managed settings — it cannot be switched off here.'));
});

test('the entry card names the classifier it belongs to and its source', () => {
  const entry: AutoModeEntry = { text: 'Never push to main', section: 'soft_deny',
    source: 'userSettings', index: 0 };
  const card = autoModeEntryPaneRequest(entry);
  assert.equal(card.title, 'Rule details');
  assert.ok(card.message.startsWith('Never push to main\n rule for the auto mode classifier · From user settings'));
  // A user rule with nothing to explain shows no note at all.
  assert.ok(!card.message.includes('cannot be modified'));

  const structure: AutoModeEntry = { text: '### Host', section: 'environment',
    source: 'userSettings', index: 0, structure: true };
  assert.ok(autoModeEntryPaneRequest(structure).message.includes(' section header for the auto mode classifier'));
  assert.ok(autoModeEntryPaneRequest(structure).message.includes('A section header that organizes the '
    + 'environment entries below it; it renders into the classifier prompt as written.'));
  assert.ok(autoModeEntryPaneRequest(structure).message.includes('Edit your settings file directly to restructure.'));

  const flag: AutoModeEntry = { text: 'Flag rule', section: 'allow', source: 'flagSettings', index: 0 };
  assert.ok(autoModeEntryPaneRequest(flag).message.includes('This rule comes from a read-only source '
    + '(the --settings flag) and cannot be modified here.'));

  const managed: AutoModeEntry = { text: 'Managed rule', section: 'hard_deny',
    source: 'policySettings', index: 0 };
  const managedCard = autoModeEntryPaneRequest(managed);
  assert.ok(managedCard.message.includes('This rule is configured by managed settings and cannot be modified.'));
  assert.ok(managedCard.message.includes('Contact your system administrator for more information.'));

  const environment: AutoModeEntry = { text: '- macOS', section: 'environment',
    source: 'userSettings', index: 1 };
  assert.ok(autoModeEntryPaneRequest(environment).message.includes('Environment entries describe this '
    + 'machine and project for the classifier.'));
});

test('the document card shows the built-in default until a layer replaces it', () => {
  const empty = autoModeDocumentPaneRequest([], autoModeBuiltins([layer('userSettings')]).environment);
  assert.equal(empty.title, 'Environment document');
  assert.ok(empty.message.startsWith('Built-in default document · enter to edit\n\n'));
  assert.ok(empty.message.includes(autoModeBuiltinRules('environment')[0] ?? 'impossible'));

  const entries = autoModeEntries([layer('userSettings', { environment: ['### Host', '- macOS'] })]);
  const replaced = autoModeDocumentPaneRequest(entries, autoModeBuiltins([layer('userSettings',
    { environment: ['### Host', '- macOS'] })]).environment);
  assert.ok(replaced.message.includes('### Host\n- macOS'));
  assert.ok(!replaced.message.includes('Built-in default document'));
});

test('the automode panes open from their rows and come back to the tab', async () => {
  const input = { rules: [], autoModeLayers: [layer('userSettings', {
    soft_deny: ['Never push to main'], environment: ['### Host', '- macOS'],
  })] };
  const seen: string[] = [];
  const script = [
    { selected: ['tab:automode'] },
    { selected: ['builtins:allow'] },
    { selected: ['back'] },
    { selected: ['soft_deny:userSettings:0'] },
    { selected: ['back'] },
    { selected: [AUTO_MODE_DOCUMENT_VALUE] },
    { selected: ['back'] },
    { selected: ['tab:allow'] },
    undefined,
  ];
  let step = 0;
  const notice = await browsePermissions(() => input, async request => {
    seen.push(request.title ?? '');
    return script[step++];
  }, async () => ({}));
  assert.equal(notice, 'Permissions dialog dismissed');
  assert.deepEqual(seen, ['Permissions', 'Permissions', AUTO_MODE_BUILTINS_TITLE, 'Permissions',
    'Rule details', 'Permissions', 'Edit environment', 'Permissions', 'Permissions']);
  // The Back row returns to the automode tab rather than dismissing the panel.
  assert.equal(step, 9);
});

test('an unknown automode row value dismisses the panel', async () => {
  const input = { rules: [], autoModeLayers: [layer('userSettings')] };
  const script = [{ selected: ['tab:automode'] }, { selected: ['allow:userSettings:99'] }, undefined];
  let step = 0;
  assert.equal(await browsePermissions(() => input, async () => script[step++], async () => ({})),
    'Permissions dialog dismissed');
  assert.equal(step, 2);
});
