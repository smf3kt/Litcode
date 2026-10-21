import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { FOCUS_DISABLED, FOCUS_ENABLED, FOCUS_MODES, briefTranscriptEnabled, focusModeFor,
  focusReport, focusUnknownArgument, parseFocusArgument, saveViewModeSetting, startupVerbose } from '../src/focus-command.js';

const userDir = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'focus-')));

test('the argument grammar is on, off, an empty toggle, or the invalid line', () => {
  assert.deepEqual(parseFocusArgument('on', false), { kind: 'set', enabled: true });
  assert.deepEqual(parseFocusArgument('off', true), { kind: 'set', enabled: false });
  assert.deepEqual(parseFocusArgument('', false), { kind: 'set', enabled: true });
  assert.deepEqual(parseFocusArgument('', true), { kind: 'set', enabled: false });
  assert.deepEqual(parseFocusArgument(' ON ', false), { kind: 'set', enabled: true });
  assert.deepEqual(parseFocusArgument('maybe', false), { kind: 'unknown', argument: 'maybe' });
  assert.deepEqual(parseFocusArgument(' 1 ', false), { kind: 'unknown', argument: '1' });
});

test('the invalid line is the recovered one', () => {
  assert.equal(focusUnknownArgument('maybe'), 'Unknown argument "maybe". Use: /focus [on|off]');
});

test('the two reports and the two written modes are the recovered pair', () => {
  assert.equal(focusReport(true), FOCUS_ENABLED);
  assert.equal(focusReport(false), FOCUS_DISABLED);
  assert.equal(focusModeFor(true), 'focus');
  assert.equal(focusModeFor(false), 'default');
  assert.deepEqual([...FOCUS_MODES], ['default', 'verbose', 'focus']);
});

test('only the focus view mode turns the brief transcript on', () => {
  assert.equal(briefTranscriptEnabled({ viewMode: 'focus' }), true);
  assert.equal(briefTranscriptEnabled({ viewMode: 'default' }), false);
  assert.equal(briefTranscriptEnabled({ viewMode: 'verbose' }), false);
  assert.equal(briefTranscriptEnabled({}), false);
});

test('a present viewMode decides startup verbose; the stored switch is the fallback', () => {
  assert.equal(startupVerbose('verbose', false), true);
  assert.equal(startupVerbose('default', true), false);
  assert.equal(startupVerbose('focus', true), false);
  assert.equal(startupVerbose('verbose', undefined), true);
  assert.equal(startupVerbose('default', undefined), false);
  assert.equal(startupVerbose('focus', undefined), false);
  assert.equal(startupVerbose(undefined, true), true);
  assert.equal(startupVerbose(undefined, false), false);
  assert.equal(startupVerbose(undefined, undefined), false);
});

test('the write creates the settings file and keeps every other key', () => {
  const dir = userDir();
  try {
    const file = path.join(dir, 'settings.json');
    saveViewModeSetting('focus', dir);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { viewMode: 'focus' });
    fs.writeFileSync(file, JSON.stringify({ theme: 'dark', env: { A: '1' }, viewMode: 'default' }, null, 2) + '\n');
    saveViewModeSetting('focus', dir);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')),
      { theme: 'dark', env: { A: '1' }, viewMode: 'focus' });
    saveViewModeSetting('default', dir);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).viewMode, 'default');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a settings file that is not an object is refused', () => {
  const dir = userDir();
  try {
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, '[]\n');
    assert.throws(() => saveViewModeSetting('focus', dir), /must contain an object/);
    assert.equal(fs.readFileSync(file, 'utf8'), '[]\n');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
