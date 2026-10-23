import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { loadProjectConfig } from '../src/config.js';
import { ConfigPanel } from '../src/config-panel.js';
import { permissionCycleCommand } from '../src/permission-cycle.js';
import { permissionDecision, type PermissionPolicy } from '../src/permissions.js';
import { reloadConfig } from '../src/reload.js';
import { parseSettings } from '../src/runtime.js';
import { Session } from '../src/session.js';
import { saveConfigPanelSetting } from '../src/theme-settings.js';
import type { ToolDefinition } from '../src/tools.js';

function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
    ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w303-')));
  const workspace = path.join(root, 'workspace'), userDir = path.join(root, 'user');
  fs.mkdirSync(workspace); fs.mkdirSync(userDir);
  const file = path.join(userDir, 'settings.json');
  const config = { ...defaultConfig(workspace, []), model: 'fixture', configSources: { userDir } };
  return { workspace, userDir, file, config, close() { fs.rmSync(root, { recursive: true, force: true }); } };
}

const write: ToolDefinition = { schema: { name: 'write_file', description: 'fixture',
  input_schema: { type: 'object', properties: {} } }, readOnly: false, execute: async () => 'fixture' };

test('fresh configuration and rule-only reload use bypass while explicit modes and rules retain precedence', () => {
  const f = fixture();
  try {
    assert.equal(reloadConfig(f.config).permissions?.mode, 'bypass');
    const rules = parseSettings({ permissions: { deny: ['run_command'] } }).permissions;
    assert.ok(rules);
    assert.equal(rules.mode, 'bypass');
    assert.equal(permissionDecision(rules, write, {}).decision, 'allow');
    assert.equal(permissionDecision({ ...rules, deny: ['write_file'] }, write, {}).decision, 'deny');
    assert.equal(permissionDecision({ ...rules, ask: ['write_file'] }, write, {}).decision, 'ask');
    for (const mode of ['default', 'plan', 'acceptEdits', 'ask', 'auto', 'dontAsk', 'bypass'] as const)
      assert.equal(parseSettings({ permissions: { mode } }).permissions?.mode, mode);
    assert.equal(parseSettings({ permissions: { defaultMode: 'bypassPermissions' } }).permissions?.mode, 'bypass');
    assert.equal(parseSettings({ permissions: { defaultMode: 'bypassPermissions', mode: 'plan' } }).permissions?.mode, 'plan');
    fs.writeFileSync(f.file, JSON.stringify({ permissions: { defaultMode: 'plan' } }));
    const withRules = { ...f.config, configSources: { userDir: f.userDir,
      overrides: { permissions: { allow: ['read_file'], deny: ['run_command'] } } } };
    const reloaded = reloadConfig(withRules);
    assert.equal(reloaded.permissions?.mode, 'plan');
    assert.deepEqual(reloaded.permissions?.layers?.at(-1)?.deny, ['run_command']);
    assert.equal(reloadConfig({ ...withRules, configSources: { ...withRules.configSources,
      overrides: { permissions: { ...withRules.configSources.overrides.permissions, mode: 'default' } } } }).permissions?.mode, 'default');
    const managed = path.join(f.workspace, 'managed.json');
    fs.writeFileSync(managed, JSON.stringify({ permissions: { mode: 'acceptEdits', allow: [], deny: ['write_file'] } }));
    const enforced = reloadConfig({ ...withRules, configSources: { ...withRules.configSources, managedSettingsFile: managed } });
    assert.equal(enforced.permissions?.mode, 'acceptEdits');
    assert.deepEqual(enforced.permissions?.deny, ['write_file']);
  } finally { f.close(); }
});

test('Config can save bypass for restart while original resume and launch availability keep their owners', async () => {
  const f = fixture();
  let old: Session | undefined, fresh: Session | undefined;
  try {
    fs.writeFileSync(f.file, JSON.stringify({ keep: 'authored', permissions: { allow: ['read_file'] } }));
    old = Session.open(f.workspace, { config: { ...f.config, permissions: { mode: 'default', allow: [], deny: [] } } });
    const oldId = old.id;
    const panel = new ConfigPanel({ config: old.config, hidden: [] });
    panel.key({ type: 'insert', text: 'permission' }, 90);
    panel.key({ type: 'submit' }, 90);
    assert.equal(panel.focused?.value, 'bypassPermissions');
    const next = panel.key({ type: 'left' }, 90);
    assert.deepEqual(next, { kind: 'change', update: { id: 'permissionMode', value: 'auto' } });
    panel.update({ config: { ...old.config, permissions: { mode: 'default', allow: [], deny: [], defaultMode: 'auto' } }, hidden: [] });
    assert.deepEqual(panel.key({ type: 'right' }, 90), { kind: 'change', update: { id: 'permissionMode', value: 'bypassPermissions' } });
    await saveConfigPanelSetting({ id: 'permissionMode', value: 'bypassPermissions' }, f.workspace, f.userDir);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')),
      { keep: 'authored', permissions: { allow: ['read_file'], defaultMode: 'bypassPermissions' } });
    const policy = parseSettings(loadProjectConfig(f.workspace, { userDir: f.userDir, paths: [] }).settings).permissions;
    assert.equal(policy?.mode, 'bypass');
    fresh = Session.open(f.workspace, { config: { ...f.config, permissions: policy } });
    assert.equal(fresh.permissionOwner.state().mode, 'bypass');
    assert.equal(fresh.permissionOwner.state().isBypassPermissionsModeAvailable, true);
    assert.equal(permissionCycleCommand(fresh.permissionOwner.state()), '/permissions auto');
    old.close();
    old = Session.open(f.workspace, { id: oldId });
    assert.equal(old.config.permissions?.mode, 'default');
    assert.equal(old.permissionOwner.state().isBypassPermissionsModeAvailable, false);
    fresh.carryPermissions(old);
    assert.equal(fresh.permissionOwner.state().mode, 'default');
    assert.equal(fresh.config.permissions?.mode, 'bypass');
    const oldPolicy: PermissionPolicy = { mode: 'ask', allow: [], deny: [] };
    assert.equal(permissionDecision(oldPolicy, write, {}).decision, 'ask');
  } finally { fresh?.close(); old?.close(); f.close(); }
});
