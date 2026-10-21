import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ResumePicker, RESUME_EMPTY_TEXT, filterResumeSessions, groupResumeSessions, resumeClip,
  resumeNoMatchText, resumePickerGuide, resumePickerRows, resumeRelativeTime, resumeRowDescription,
  resumeRowLabel, resumeSessionName, type ResumeSession,
} from '../src/resume-picker.js';

const NOW = Date.parse('2026-10-22T12:00:00.000Z');
const log = (id: string, overrides: Partial<ResumeSession> = {}): ResumeSession => ({
  id, updated: '2026-10-22T11:00:00.000Z', ...overrides,
});

test('the title follows the recovered precedence: custom title, then the short id', () => {
  assert.equal(resumeSessionName(log('12345678-aaaa-bbbb-cccc-000000000000')), '12345678');
  assert.equal(resumeSessionName(log('12345678-aaaa', { title: '  Fix the parser  ' })), 'Fix the parser');
});

test('fork grouping roots every descendant under its first ancestor and sorts newest first', () => {
  const logs = [
    log('root', { updated: '2026-10-22T09:00:00.000Z' }),
    log('child', { parent: { id: 'root' }, updated: '2026-10-22T10:00:00.000Z' }),
    log('grandchild', { parent: { id: 'child' }, updated: '2026-10-22T11:00:00.000Z' }),
    log('other'),
  ];
  const groups = groupResumeSessions(logs);
  assert.deepEqual(groups.get('root')?.map(item => item.id), ['grandchild', 'child', 'root']);
  assert.deepEqual(groups.get('other')?.map(item => item.id), ['other']);
});

test('the current session is filtered out, including when it is a fork child', () => {
  const groups = groupResumeSessions([log('root'), log('child', { parent: { id: 'root' } })], 'child');
  assert.deepEqual(groups.get('root')?.map(item => item.id), ['root']);
});

test('search matches the title and the id case-insensitively', () => {
  const logs = [log('aaaa-1', { title: 'Parser rewrite' }), log('bbbb-2', { title: 'Docs' })];
  assert.deepEqual(filterResumeSessions(logs, 'PARSER').map(item => item.id), ['aaaa-1']);
  assert.deepEqual(filterResumeSessions(logs, 'bbbb').map(item => item.id), ['bbbb-2']);
  assert.equal(filterResumeSessions(logs, '').length, 2);
});

test('the relative time is short and numeric in the past', () => {
  assert.equal(resumeRelativeTime('2026-10-22T11:00:00.000Z', NOW), '1 hr. ago');
  assert.equal(resumeRelativeTime('2026-10-20T12:00:00.000Z', NOW), '2 days ago');
  assert.equal(resumeRelativeTime('2026-10-22T12:30:00.000Z', NOW), 'in 30 min.');
});

test('row labels carry the recovered fork suffix and child indent', () => {
  const header = resumeRowLabel(log('root', { title: 'Root' }), 60, { group: true, childCount: 2 });
  assert.equal(header, 'Root (+2 other sessions)');
  const single = resumeRowLabel(log('root', { title: 'Root' }), 60, { group: true, childCount: 1 });
  assert.equal(single, 'Root (+1 other session)');
  assert.equal(resumeRowDescription(log('root'), NOW), '1 hr. ago');
  assert.equal(resumeRowDescription(log('child'), NOW, true), '    1 hr. ago');
});

test('clipping collapses whitespace and ends with the recovered ellipsis', () => {
  assert.equal(resumeClip('a   b', 10), 'a b');
  assert.equal(resumeClip('abcdef', 4), 'abc…');
  assert.equal(resumeClip('abcdef', 1), '…');
});

test('rows keep the empty and no-match text from the source', () => {
  assert.equal(resumePickerRows({ logs: [], currentId: 'x' }).length, 0);
  assert.equal(RESUME_EMPTY_TEXT, 'No conversations found in this project.');
  assert.equal(resumeNoMatchText('zzz'), 'No sessions match "zzz".');
  const rows = resumePickerRows({ logs: [log('one', { title: 'Alpha' }), log('two', { title: 'Beta' })], now: NOW },
    { query: 'alp' });
  assert.deepEqual(rows.map(row => row.log.id), ['one']);
});

test('a fork group expands and collapses from the focused header', () => {
  const picker = new ResumePicker({ logs: [
    log('root', { updated: '2026-10-22T09:00:00.000Z' }),
    log('child', { parent: { id: 'root' }, updated: '2026-10-22T10:00:00.000Z' }),
  ], now: NOW });
  assert.equal(picker.rowCount, 1);
  assert.equal(picker.focused?.kind, 'group');
  picker.expand('right');
  assert.equal(picker.rowCount, 2);
  assert.equal(picker.rows[1]?.kind, 'log');
  assert.equal((picker.rows[1] as { child: boolean }).child, true);
  picker.expand('left');
  assert.equal(picker.rowCount, 1);
});

test('typing enters search mode and filters; Escape clears back to the list', () => {
  const picker = new ResumePicker({ logs: [log('one', { title: 'Alpha' }), log('two', { title: 'Beta' })], now: NOW });
  picker.insert('bet');
  assert.equal(picker.searching, true);
  assert.equal(picker.rowCount, 1);
  assert.equal(picker.focused?.log.id, 'two');
  picker.clear();
  assert.equal(picker.searching, false);
  assert.equal(picker.rowCount, 2);
  assert.equal(resumePickerGuide('search'), 'Type to Search / Enter select / Esc clear');
  assert.equal(resumePickerGuide('list'), 'Type to search / Enter select / Esc cancel');
});

test('focus clamps at the list ends and moving leaves search mode', () => {
  const picker = new ResumePicker({ logs: [log('one'), log('two')], now: NOW });
  picker.insert('o');
  picker.move(1);
  assert.equal(picker.searching, false);
  picker.move(99);
  assert.equal(picker.focusIndex, picker.rowCount - 1);
  picker.move(-99);
  assert.equal(picker.focusIndex, 0);
});
