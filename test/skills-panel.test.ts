import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { loadProjectConfig } from '../src/config.js';
import {
  SKILLS_EMPTY, SKILLS_EMPTY_HINT, SKILLS_PLUGIN_FOOTER, applySkillOverrideDiff,
  defaultSkillModes, filterSkills, nextSkillMode, readLocalSkillOverrides, saveSkillOverrides,
  skillLock, skillModeWord, skillOverrideDiff, skillOverrideMode, skillPanelRows, skillTokenEstimate,
  skillTokenRange, skillUnsafeNameNote, skillsPanelMessage, skillsSaveError, skillsSaveMessage,
  sortSkills, type SkillPanelSkill,
} from '../src/skills-panel.js';

const alpha: SkillPanelSkill = { name: 'alpha', description: 'First skill', source: 'projectSettings',
  userInvocable: true, disableModelInvocation: false };
const beta: SkillPanelSkill = { name: 'beta', description: 'Second skill', source: 'userSettings',
  userInvocable: true, disableModelInvocation: false };
const locked: SkillPanelSkill = { name: 'locked', description: 'Author locked', source: 'projectSettings',
  userInvocable: true, disableModelInvocation: true };
const plugin: SkillPanelSkill = { name: 'plugged', description: 'Plugin skill', source: 'plugin',
  userInvocable: true, disableModelInvocation: false };

test('the mode cycle follows the recovered order and wraps', () => {
  assert.deepEqual(['on', 'name-only', 'user-invocable-only', 'off'].map(mode => nextSkillMode(mode as never)),
    ['name-only', 'user-invocable-only', 'off', 'on']);
  assert.equal(skillModeWord('on'), '');
  assert.equal(skillModeWord('name-only'), 'name-only');
  assert.equal(skillModeWord('user-invocable-only'), 'user-only');
  assert.equal(skillModeWord('off'), '');
});

test('locks come from the reserved name, the author flag and plugin ownership', () => {
  assert.deepEqual(skillLock(locked), { value: 'user-invocable-only', source: 'author', reason: 'locked by author' });
  assert.deepEqual(skillLock(plugin), { value: 'on', source: 'plugin', reason: 'locked by plugin' });
  assert.deepEqual(skillLock({ ...alpha, name: '__proto__' }), { value: 'on', source: 'reserved-name', reason: 'reserved name' });
  assert.equal(skillLock(alpha), undefined);
});

test('default modes prefer the lock, then the local table, then on', () => {
  const modes = defaultSkillModes([alpha, beta, locked, plugin], { alpha: 'off', locked: 'off', plugged: 'off' });
  assert.equal(modes.alpha, 'off');
  assert.equal(modes.beta, 'on');
  assert.equal(modes.locked, 'user-invocable-only');
  assert.equal(modes.plugged, 'on');
});

test('sorting is by source then name, or by tokens then name', () => {
  assert.deepEqual(sortSkills([beta, alpha, plugin], false).map(skill => skill.name), ['plugged', 'alpha', 'beta']);
  const short: SkillPanelSkill = { ...alpha, name: 'short', description: 'x' };
  const long: SkillPanelSkill = { ...alpha, name: 'long', description: 'x'.repeat(400) };
  assert.deepEqual(sortSkills([short, long], true).map(skill => skill.name), ['long', 'short']);
});

test('the filter reads the name, description and source label', () => {
  const skills = [alpha, beta, plugin];
  assert.deepEqual(filterSkills(skills, 'FIRST').map(skill => skill.name), ['alpha']);
  assert.deepEqual(filterSkills(skills, 'user').map(skill => skill.name), ['beta']);
  assert.deepEqual(filterSkills(skills, 'plugin').map(skill => skill.name), ['plugged']);
  assert.deepEqual(filterSkills(skills, '').map(skill => skill.name), ['alpha', 'beta', 'plugged']);
});

test('rows carry the lock reason, mode word, source and token range', () => {
  const rows = skillPanelRows([alpha, locked, plugin], { modes: { alpha: 'name-only' }, sortByTokens: false });
  assert.deepEqual(rows.map(row => [row.label, row.value]), [['plugged', 'skill:plugged'], ['alpha', 'skill:alpha'], ['locked', 'skill:locked']]);
  assert.equal(rows[0]!.description, 'locked by plugin · plugin · < 20 tok');
  assert.equal(rows[1]!.description, 'name-only · project · < 20 tok');
  assert.equal(rows[2]!.description, 'locked by author · user-only · project · < 20 tok');
  assert.equal(rows[2]!.locked?.source, 'author');
  assert.equal(rows[1]!.locked, undefined);
});

test('the token estimate rounds text length by bytes per token, and the range rounds to ten', () => {
  assert.equal(skillTokenEstimate({ ...alpha, description: 'x'.repeat(395) }, 4), 100);
  assert.equal(skillTokenRange(19), '< 20');
  assert.equal(skillTokenRange(84), '~80');
  assert.equal(skillTokenRange(100), '~100');
});

test('the diff clears a choice equal to the locked tier and counts effective changes', () => {
  const skills = [alpha, beta, locked, plugin];
  const local = { beta: 'off' } as const;
  const diff = skillOverrideDiff(skills, { alpha: 'name-only', beta: 'on', locked: 'off', plugged: 'off' }, local);
  assert.deepEqual({ ...diff.diff }, { alpha: 'name-only', beta: undefined });
  assert.equal(diff.writes, 2);
  assert.equal(diff.effectiveChanged, 2);

  const cleared = skillOverrideDiff(skills, { alpha: 'on', beta: 'on' }, { beta: 'off' });
  assert.deepEqual({ ...cleared.diff }, { beta: undefined });
  assert.equal(cleared.writes, 1);
  assert.equal(cleared.effectiveChanged, 1);

  const none = skillOverrideDiff(skills, { alpha: 'on' }, {});
  assert.deepEqual({ ...none.diff }, {});
  assert.equal(none.writes, 0);
  assert.equal(none.effectiveChanged, 0);
});

test('applying a diff updates the local table in place', () => {
  assert.deepEqual(applySkillOverrideDiff({ alpha: 'off' }, { alpha: undefined, beta: 'name-only' }), { beta: 'name-only' });
});

test('the local table merges the legacy file beneath the canonical one', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-overrides-')));
  const legacy = path.join(root, 'legacy.json'), local = path.join(root, 'settings.local.json');
  fs.writeFileSync(legacy, JSON.stringify({ skillOverrides: { alpha: 'off', beta: 'name-only', bogus: 'nope' } }));
  fs.writeFileSync(local, JSON.stringify({ skillOverrides: { beta: 'user-invocable-only' } }));
  try {
    assert.deepEqual(readLocalSkillOverrides({ localSettings: local, legacyLocalSettings: legacy }),
      { alpha: 'off', beta: 'user-invocable-only' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a save keeps unrelated settings, writes the table and drops it when empty', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-save-')));
  const file = path.join(root, 'settings.local.json');
  fs.writeFileSync(file, JSON.stringify({ theme: 'dark', skillOverrides: { alpha: 'on' } }));
  try {
    saveSkillOverrides(file, { beta: 'off', alpha: undefined });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { theme: 'dark', skillOverrides: { beta: 'off' } });
    saveSkillOverrides(file, { beta: undefined });
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { theme: 'dark' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('the panel message joins the subtitle, plugin footer and reserved-name note', () => {
  const message = skillsPanelMessage({ skills: [alpha, plugin, { ...alpha, name: '__proto__' }],
    rows: skillPanelRows([alpha], { modes: {}, sortByTokens: false }), query: '', total: 3, sortByTokens: true });
  assert.match(message, /^3 skills · sorted by tokens · enter\/space to cycle, t to sort, esc to save/);
  assert.ok(message.includes(SKILLS_PLUGIN_FOOTER));
  assert.equal(skillUnsafeNameNote([{ ...alpha, name: '__proto__' }]),
    "Settings can't store an entry named __proto__, so a skill with that name can't be changed here. Rename its folder or command file to configure it.");
  assert.equal(skillsPanelMessage({ skills: [], rows: [], query: '', total: 0, sortByTokens: false }),
    `${SKILLS_EMPTY}\n\n${SKILLS_EMPTY_HINT}`);
  assert.equal(skillsPanelMessage({ skills: [alpha], rows: [], query: 'zzz', total: 1, sortByTokens: false }), 'No skills match "zzz"');
  assert.equal(skillsSaveMessage(0), 'No changes');
  assert.equal(skillsSaveMessage(1), 'Updated 1 skill override');
  assert.equal(skillsSaveMessage(2), 'Updated 2 skill overrides');
  assert.equal(skillsSaveError('disk full'), 'Failed to save skill overrides: disk full');
});

test('the merged skillOverrides setting reaches the loaded skill catalog', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-skill-config-')));
  const userDir = path.join(root, 'user');
  const skillDir = path.join(root, '.harness', 'skills', 'alpha');
  fs.mkdirSync(userDir);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: alpha\ndescription: First skill\n---\nbody\n');
  fs.writeFileSync(path.join(root, '.harness', 'settings.local.json'),
    JSON.stringify({ skillOverrides: { alpha: 'off' } }));
  try {
    const loaded = loadProjectConfig(root, { userDir });
    assert.equal(loaded.skills.find(skill => skill.name === 'alpha')?.mode, 'off');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('an override ignores names the lock already decides', () => {
  assert.equal(skillOverrideMode(alpha, { alpha: 'name-only' }), 'name-only');
  assert.equal(skillOverrideMode(alpha, { alpha: 'bogus' }), undefined);
  assert.equal(skillOverrideMode(locked, { locked: 'off' }), undefined);
  assert.equal(skillOverrideMode(plugin, { plugged: 'off' }), undefined);
});
