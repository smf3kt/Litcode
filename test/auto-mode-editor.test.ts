import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { persistAutoModeUpdate, autoModeRuleProblem, autoModeDocument } from '../src/auto-mode-rules.js';
import { browseAutoMode, type AutoModeEditorHost } from '../src/auto-mode-editor.js';
import { permissionLayerSchema, type PermissionLayer } from '../src/permissions.js';
import { persistPermissionUpdate, permissionSettingsPaths } from '../src/permission-settings.js';
import { classifierSystem } from '../src/auto-classifier.js';
import { loadProjectConfig } from '../src/config.js';
import { seedPermissionUpdates } from '../src/permissions.js';
import type { TerminalPromptRequest } from '../src/terminal.js';

function fixture() {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w230-')));
  const workspace = path.join(directory, 'workspace'), user = path.join(directory, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(user);
  const file = path.join(user, 'settings.json');
  return { directory, workspace, user, file };
}

function layer(autoMode?: PermissionLayer['autoMode']): PermissionLayer {
  return permissionLayerSchema.parse({ source: 'userSettings', root: '/w', allow: [], deny: [], ask: [],
    additionalDirectories: [], ...(autoMode === undefined ? {} : { autoMode }) });
}

test('auto mode writes preserve settings, serialize permission writes, and reload into the classifier', async () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.file, JSON.stringify({ unrelated: { keep: true }, autoMode: { deny: ['legacy'], classifyAllShell: true } }), { mode: 0o640 });
    const paths = permissionSettingsPaths(f.workspace, f.user);
    await Promise.all([
      persistAutoModeUpdate(f.file, { kind: 'add', section: 'soft_deny', text: 'Require review before staging' }),
      persistPermissionUpdate({ type: 'addRules', behavior: 'ask', destination: 'userSettings', rules: [{ toolName: 'Bash' }] }, paths, false),
    ]);
    let saved = JSON.parse(fs.readFileSync(f.file, 'utf8'));
    assert.deepEqual(saved.unrelated, { keep: true });
    assert.deepEqual(saved.permissions.ask, ['Bash']);
    assert.deepEqual(saved.autoMode, { deny: ['legacy'], classifyAllShell: true,
      soft_deny: ['$defaults', 'Require review before staging'] });
    assert.equal(fs.statSync(f.file).mode & 0o777, 0o640);
    await persistAutoModeUpdate(f.file, { kind: 'update', section: 'soft_deny', index: 1,
      original: 'Require review before staging', text: 'Require review before shipping️' });
    await persistAutoModeUpdate(f.file, { kind: 'toggle', section: 'soft_deny', enabled: false });
    saved = JSON.parse(fs.readFileSync(f.file, 'utf8'));
    assert.deepEqual(saved.autoMode.soft_deny, ['Require review before shipping']);
    const loaded = loadProjectConfig(f.workspace, { userDir: f.user, managedSettingsDir: path.join(f.directory, 'managed') });
    const state = seedPermissionUpdates({ mode: 'auto', allow: [], deny: [], layers: loaded.permissionLayers });
    const prompt = classifierSystem([], state.autoMode);
    assert.ok(prompt.includes('Require review before shipping'));
    assert.ok(!prompt.includes('Require review before staging'));
    await persistAutoModeUpdate(f.file, { kind: 'delete', section: 'soft_deny', index: 0, original: 'Require review before shipping' });
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')).autoMode.soft_deny, []);
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('auto mode rejects invalid and stale writes without overwriting the settings document', async () => {
  const f = fixture();
  try {
    const original = JSON.stringify({ autoMode: { allow: ['$defaults', 'External edit'], environment: ['### Host', 'staging'] }, keep: 1 });
    fs.writeFileSync(f.file, original);
    await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'update', section: 'allow', index: 1, original: 'old', text: 'replacement' }), /changed on disk/);
    await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'document', section: 'environment', expected: [], text: 'new environment' }), /environment changed/);
    for (const text of ['$defaults', 'bad\u0000rule', 'bad‮rule', '<settings_rule>', '</user_allow_rules_to_replace>']) {
      assert.ok(autoModeRuleProblem('allow', text));
      await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'add', section: 'allow', text }));
      assert.equal(fs.readFileSync(f.file, 'utf8'), original);
    }
    assert.equal(autoModeRuleProblem('allow', 'plain\ttext'), null);
    assert.deepEqual(autoModeDocument('### Empty\n### Host\nstaging\n\n### Tail').entries, ['### Host', 'staging']);
    await persistAutoModeUpdate(f.file, { kind: 'document', section: 'environment', expected: ['### Host', 'staging'], text: '' });
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')).autoMode.environment, []);
    for (const autoMode of [[], { allow: [1] }, null]) {
      const bytes = JSON.stringify({ autoMode });
      fs.writeFileSync(f.file, bytes);
      await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'add', section: 'allow', text: 'plain' }), /array|expected shape/);
      assert.equal(fs.readFileSync(f.file, 'utf8'), bytes);
    }
    fs.writeFileSync(f.file, '{');
    await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'add', section: 'allow', text: 'plain' }), /validation error/);
    assert.equal(fs.readFileSync(f.file, 'utf8'), '{');
    fs.writeFileSync(f.file, JSON.stringify({ autoMode: { allow: ['$defaults'] } }));
    await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'toggle', section: 'allow', enabled: false }), /empty section/);
    fs.writeFileSync(f.file, JSON.stringify({ autoMode: { allow: ['$defaults', ...Array.from({ length: 200 }, (_, i) => `rule ${i}`)] } }));
    await assert.rejects(persistAutoModeUpdate(f.file, { kind: 'add', section: 'allow', text: 'overflow' }), /maximum is 200/);
    await persistAutoModeUpdate(f.file, { kind: 'delete', section: 'allow', index: 1, original: 'rule 0' });
    assert.equal(JSON.parse(fs.readFileSync(f.file, 'utf8')).autoMode.allow.length, 200);
  } finally { fs.rmSync(f.directory, { recursive: true, force: true }); }
});

test('auto mode editor retains drafts, confirms deletes and recovers the environment document', async () => {
  let layers = [layer()];
  const applied: unknown[] = [];
  const drafts: string[][] = [];
  let edits = 0;
  const host: AutoModeEditorHost = {
    apply: async update => {
      applied.push(update);
      if (update.kind === 'add') layers = [layer({ allow: ['$defaults', update.text] })];
      return {};
    },
    editDocument: async lines => {
      drafts.push([...lines]);
      return { kind: 'edited', content: edits++ === 0 ? '<settings_bad>' : '### Host\nstaging' };
    },
    viewRules: async () => 'viewed',
  };
  const drive = (value: string, answers: ({ selected: string[]; text?: string } | undefined)[], inspect?: (r: TerminalPromptRequest, index: number) => void) => {
    let index = 0;
    return browseAutoMode(value, () => layers, async request => {
      inspect?.(request, index);
      assert.ok(index < answers.length, request.title);
      return answers[index++];
    }, host);
  };
  const added = await drive('add-new-rule', [{ selected: ['allow'] }, { selected: [], text: '$defaults' }, { selected: [], text: 'Allow docs' }], (request, i) => {
    if (i === 0) assert.equal(request.choices?.[0]?.value, 'allow');
    if (i === 2) { assert.equal(request.initialText, '$defaults'); assert.match(request.message, /reserved/); }
  });
  assert.deepEqual(added, ['Added auto mode soft allow rule Allow docs']);
  const before = applied.length;
  await drive('allow:userSettings:1', [{ selected: ['edit'] }, undefined, { selected: ['delete'] }, { selected: ['cancel'] }, undefined], (request, i) => {
    if (i === 1) assert.equal(request.initialText, 'Allow docs');
    if (i === 3) { assert.equal(request.title, 'Delete auto mode rule?'); assert.equal(request.defaultIndex, 1); }
  });
  assert.equal(applied.length, before);
  await drive('environment-document', [{ selected: ['confirm'] }, { selected: ['reopen'] }], (request, i) => {
    if (i === 0) { assert.equal(request.title, 'Replace the built-in environment?'); assert.equal(request.defaultIndex, 1); }
    if (i === 1) assert.match(request.message, /template token/);
  });
  assert.deepEqual(drafts[1], ['<settings_bad>']);
  assert.deepEqual(applied.at(-1), { kind: 'document', section: 'environment', expected: [], text: '### Host\nstaging' });
  const flag = permissionLayerSchema.parse({ ...layer({ allow: ['Foreign rule'] }), source: 'flagSettings' });
  layers = [flag];
  await drive('allow:flagSettings:0', [{ selected: ['delete'] }]);
  assert.equal(applied.length, before + 1);
});
