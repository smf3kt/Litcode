import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RELOAD_SKILLS_NO_CHANGES, reloadSkillsMessage, skillReloadCounts,
  skillReloadDiff } from '../src/reload-skills.js';

test('the counts are the entries each snapshot does not know', () => {
  assert.deepEqual(skillReloadCounts(['alpha', 'beta'], ['alpha', 'beta']), { added: 0, removed: 0 });
  assert.deepEqual(skillReloadCounts(['alpha'], ['alpha', 'beta']), { added: 1, removed: 0 });
  assert.deepEqual(skillReloadCounts(['alpha', 'beta'], ['alpha']), { added: 0, removed: 1 });
  assert.deepEqual(skillReloadCounts(['alpha', 'beta'], ['gamma', 'delta']), { added: 2, removed: 2 });
});

test('a renamed skill counts as one addition and one removal', () => {
  assert.deepEqual(skillReloadCounts(['old-name'], ['new-name']), { added: 1, removed: 1 });
});

test('a duplicate entry counts once per occurrence, as the source does', () => {
  assert.deepEqual(skillReloadCounts([], ['alpha', 'alpha']), { added: 2, removed: 0 });
});

test('the diff phrase keeps the source order and its two arms', () => {
  assert.equal(skillReloadDiff({ added: 0, removed: 0 }), RELOAD_SKILLS_NO_CHANGES);
  assert.equal(skillReloadDiff({ added: 1, removed: 0 }), '1 added');
  assert.equal(skillReloadDiff({ added: 0, removed: 2 }), '2 removed');
  assert.equal(skillReloadDiff({ added: 2, removed: 1 }), '2 added, 1 removed');
});

test('the report counts the catalog after the rescan and pluralizes it', () => {
  assert.equal(reloadSkillsMessage(['alpha'], ['alpha']), 'Reloaded skills: 1 skill available (no changes)');
  assert.equal(reloadSkillsMessage([], ['alpha', 'beta']), 'Reloaded skills: 2 skills available (2 added)');
  assert.equal(reloadSkillsMessage(['alpha', 'beta'], ['alpha']), 'Reloaded skills: 1 skill available (1 removed)');
  assert.equal(reloadSkillsMessage([], []), 'Reloaded skills: 0 skills available (no changes)');
  assert.equal(reloadSkillsMessage(['a'], ['a', 'b', 'c']), 'Reloaded skills: 3 skills available (2 added)');
});

test('the report has no safe-mode suffix, since this host has no safe mode', () => {
  assert.ok(!reloadSkillsMessage([], []).includes('safe mode'));
});
