import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import { autoModeAvailable, bypassModeAvailable, internalCycleMode, nextPermissionMode, permissionCycleCommand } from '../src/permission-cycle.js';

test('the recovered cycle table steps through the live modes', () => {
  const all = { bypassAvailable: true, autoAvailable: true };
  assert.equal(nextPermissionMode('default', all), 'acceptEdits');
  assert.equal(nextPermissionMode('acceptEdits', all), 'plan');
  assert.equal(nextPermissionMode('plan', all), 'bypassPermissions');
  assert.equal(nextPermissionMode('bypassPermissions', all), 'auto');
  assert.equal(nextPermissionMode('auto', all), 'default');
  assert.equal(nextPermissionMode('dontAsk', all), 'default');
  assert.equal(nextPermissionMode('ask', all), 'default');
  assert.equal(nextPermissionMode(undefined, all), 'default');
});

test('plan skips a bypass the session never offered and falls back to auto or default', () => {
  assert.equal(nextPermissionMode('plan', { bypassAvailable: false, autoAvailable: true }), 'auto');
  assert.equal(nextPermissionMode('plan', { bypassAvailable: false, autoAvailable: false }), 'default');
  assert.equal(nextPermissionMode('bypassPermissions', { autoAvailable: false }), 'default');
});

test('availability reads the session bypass flag and offers auto locally', () => {
  assert.equal(bypassModeAvailable({ isBypassPermissionsModeAvailable: true }), true);
  assert.equal(bypassModeAvailable({ isBypassPermissionsModeAvailable: false }), false);
  assert.equal(autoModeAvailable(), true);
  assert.equal(internalCycleMode('bypassPermissions'), 'bypass');
  assert.equal(internalCycleMode('plan'), 'plan');
});

test('the command carries the internal spelling of the next mode', () => {
  assert.equal(permissionCycleCommand({ mode: 'bypass', isBypassPermissionsModeAvailable: true }), '/permissions auto');
  assert.equal(permissionCycleCommand({ mode: 'plan', isBypassPermissionsModeAvailable: true }), '/permissions bypass');
  assert.equal(permissionCycleCommand({ mode: 'plan', isBypassPermissionsModeAvailable: false }), '/permissions auto');
  assert.equal(permissionCycleCommand({ mode: 'default', isBypassPermissionsModeAvailable: false }), '/permissions acceptEdits');
  assert.equal(permissionCycleCommand({ mode: undefined, isBypassPermissionsModeAvailable: false }), '/permissions acceptEdits');
});

test('a launch-granted bypass availability survives a live mode change', () => {
  const workspace = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w238-cycle-'));
  const config = (mode: 'bypass' | 'auto' | 'default') => ({ ...defaultConfig(workspace, []), model: 'fixture',
    permissions: { mode, allow: [], deny: [] } });
  const first = Session.open(workspace, { config: config('bypass') });
  const next = Session.open(workspace, { config: config('auto') });
  try {
    next.carryPermissions(first, false);
    assert.equal(next.permissionOwner.state().isBypassPermissionsModeAvailable, true);
  } finally { next.close(); first.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('carrying from a non-bypass session does not grant bypass availability', () => {
  const workspace = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'w238-cycle-'));
  const config = (mode: 'bypass' | 'auto' | 'default') => ({ ...defaultConfig(workspace, []), model: 'fixture',
    permissions: { mode, allow: [], deny: [] } });
  const first = Session.open(workspace, { config: config('default') });
  const next = Session.open(workspace, { config: config('default') });
  try {
    next.carryPermissions(first, false);
    assert.equal(next.permissionOwner.state().isBypassPermissionsModeAvailable, false);
  } finally { next.close(); first.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
