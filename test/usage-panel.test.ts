import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { STATS_EMPTY, STATS_PANEL_TITLE, activityHeatmap, compactNumber, formatDuration, nextUsageRange,
  parseUsageJournal, readUsageSessions, shortDate, usagePanelText, usageStats, usageStreaks,
  usageTotalsLine, type UsageMessage, type UsageSession } from '../src/usage-panel.js';

const AT = (day: number, hour: number) => Date.UTC(2026, 9, day, hour, 0, 0);
const message = (at: number, overrides: Partial<UsageMessage> = {}): UsageMessage =>
  ({ at, inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0,
    toolCalls: 0, ...overrides });

function fixture(): UsageSession[] {
  return [
    { id: 'a', startedAt: AT(20, 10), messages: [
      message(AT(20, 10)), message(AT(20, 10), { model: 'm1', inputTokens: 1000, outputTokens: 500, toolCalls: 1 }),
      message(AT(20, 10) + 1800000), message(AT(20, 10) + 1800000, { model: 'm1', inputTokens: 2000, outputTokens: 1000 }),
    ] },
    { id: 'b', startedAt: AT(21, 9), messages: [
      message(AT(21, 9), { model: 'm2', inputTokens: 5000, outputTokens: 1500 }),
    ] },
  ];
}

test('the recovered formatters keep their exact output', () => {
  assert.equal(compactNumber(999), '999');
  assert.equal(compactNumber(1000), '1.0k');
  assert.equal(compactNumber(2200), '2.2k');
  assert.equal(compactNumber(1200000), '1.2m');
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(0.5), '0.0s');
  assert.equal(formatDuration(500), '0s');
  assert.equal(formatDuration(1500), '1s');
  assert.equal(formatDuration(30000), '30s');
  assert.equal(formatDuration(65000), '1m 5s');
  assert.equal(formatDuration(3600000), '1h 0m 0s');
  assert.equal(formatDuration(90000000), '1d 1h 0m');
  assert.equal(shortDate('2026-10-20'), 'Oct 20');
  assert.equal(STATS_PANEL_TITLE, 'Stats');
});

test('streaks count back from today and keep the longest run', () => {
  assert.deepEqual(usageStreaks(['2026-10-20', '2026-10-21', '2026-10-22'], '2026-10-22'),
    { currentStreak: 3, longestStreak: 3 });
  assert.deepEqual(usageStreaks(['2026-10-18', '2026-10-20', '2026-10-21'], '2026-10-22'),
    { currentStreak: 0, longestStreak: 2 });
  assert.deepEqual(usageStreaks([], '2026-10-22'), { currentStreak: 0, longestStreak: 0 });
});

test('the aggregate matches the recovered dashboard fields', () => {
  const stats = usageStats(fixture(), { now: new Date(AT(21, 12)) });
  assert.equal(stats.totalSessions, 2);
  assert.equal(stats.totalMessages, 5);
  assert.equal(stats.activeDays, 2);
  assert.equal(stats.totalDays, 2);
  assert.deepEqual(stats.streaks, { currentStreak: 2, longestStreak: 2 });
  assert.equal(stats.favoriteModel, 'm2');
  assert.equal(stats.totalTokens, 11000);
  assert.deepEqual(stats.longestSession, { duration: 1800000, messageCount: 4 });
  assert.equal(stats.peakActivityDay, '2026-10-20');
  assert.deepEqual(stats.modelUsage.m2, { inputTokens: 5000, outputTokens: 1500,
    cacheReadInputTokens: 0, cacheCreationInputTokens: 0 });
  assert.equal(usageTotalsLine(stats.modelUsage),
    'Input 8.0k · Output 3.0k · Cache read 0 · Cache write 0');
});

test('the panel text lays the summary out in two 28-column cells', () => {
  const stats = usageStats(fixture(), { now: new Date(AT(21, 12)) });
  const cell = (text: string) => text.padEnd(32);
  assert.deepEqual(usagePanelText(stats).split('\n'), [
    'Range: All time',
    cell('Favorite model: m2') + 'Total tokens: 11.0k',
    cell('Sessions: 2') + 'Longest session: 30m 0s',
    cell('Active days: 2/2') + 'Longest streak: 2 days',
    cell('Most active day: Oct 20') + 'Current streak: 2 days',
    '',
    'Input 8.0k · Output 3.0k · Cache read 0 · Cache write 0',
  ]);
  const withHeatmap = usagePanelText(stats, 'all', activityHeatmap(stats.dailyActivity,
    { columns: 14, now: new Date(AT(22, 12)) })).split('\n');
  assert.equal(withHeatmap[0], '    AugSepOct');
  assert.equal(withHeatmap[9], '    Less ░ ▒ ▓ █ More');
  assert.equal(withHeatmap[10], '');
  assert.equal(withHeatmap[11], 'Range: All time');
  assert.equal(withHeatmap.at(-1), 'Input 8.0k · Output 3.0k · Cache read 0 · Cache write 0');
  const longModel = usageStats([{ id: 'c', startedAt: AT(20, 10), messages: [
    message(AT(20, 10), { model: 'model-name-longer-than-cell', inputTokens: 1000 })] }],
  { now: new Date(AT(21, 12)) });
  assert.equal(usagePanelText(longModel).split('\n')[1],
    'Favorite model: model-name-l' + ' '.repeat(4) + 'Total tokens: 1.0k');
  assert.equal(usagePanelText(usageStats([], { range: '7d' }), '7d'),
    `Range: Last 7 days\n\n${STATS_EMPTY}`);
  assert.equal(nextUsageRange('all'), '7d');
  assert.equal(nextUsageRange('7d'), '30d');
  assert.equal(nextUsageRange('30d'), 'all');
});

test('a range drops sessions and days before the window', () => {
  const stats = usageStats(fixture(), { range: '7d', now: new Date(AT(22, 12)) });
  assert.equal(stats.totalSessions, 2);
  assert.equal(stats.totalMessages, 5);
  const old = usageStats(fixture(), { range: '7d', now: new Date(AT(28, 12)) });
  assert.equal(old.totalSessions, 0);
  assert.equal(old.totalMessages, 0);
  assert.equal(old.activeDays, 0);
  assert.equal(old.longestSession, null);
});

test('the heatmap keeps the recovered week grid, labels and legend', () => {
  const activity = [
    { date: '2026-08-16', messageCount: 1 },
    { date: '2026-08-17', messageCount: 2 },
    { date: '2026-08-18', messageCount: 5 },
  ];
  const now = new Date(Date.UTC(2026, 9, 22, 12));
  assert.deepEqual(activityHeatmap(activity, { columns: 14, now }).split('\n'), [
    '    AugSepOct',
    '    ▒·········',
    'Mon ▓·········',
    '    █·········',
    'Wed ··········',
    '    ··········',
    'Fri ········· ',
    '    ········· ',
    '',
    '    Less ░ ▒ ▓ █ More',
  ]);
  const wide = activityHeatmap(activity, { columns: 200, now }).split('\n');
  assert.equal(wide.length, 10);
  assert.equal(wide[1]!.length, 56);
  assert.equal(activityHeatmap([], { columns: 4, now }).split('\n')[1]!.length, 14);
});

test('a journal stamps messages from the turn_end that closes their turn', () => {
  const lines = [
    JSON.stringify({ kind: 'metadata', version: 1, id: 'x', config: {}, fingerprint: 'f', startedAt: 1000 }),
    JSON.stringify({ kind: 'message', message: { role: 'user', content: 'hi' } }),
    JSON.stringify({ kind: 'message', message: { role: 'assistant', content: [{ type: 'tool_use' }] },
      response: { model: 'fixture-model', usage: { input_tokens: 10, output_tokens: 2,
        cache_read_input_tokens: 1, cache_creation_input_tokens: 3 } } }),
    JSON.stringify({ kind: 'turn_end', reason: 'done', duration: { durationMs: 5,
      timestamp: '2026-10-20T10:00:00.000Z' } }),
    JSON.stringify({ kind: 'message', message: { role: 'user', content: 'unfinished' } }),
  ];
  const parsed = parseUsageJournal(lines.join('\n') + '\n', 'x');
  assert.equal(parsed.startedAt, 1000);
  assert.equal(parsed.messages.length, 3);
  assert.equal(parsed.messages[1]!.at, Date.UTC(2026, 9, 20, 10));
  assert.equal(parsed.messages[1]!.model, 'fixture-model');
  assert.equal(parsed.messages[1]!.inputTokens, 10);
  assert.equal(parsed.messages[1]!.cacheCreationInputTokens, 3);
  assert.equal(parsed.messages[1]!.toolCalls, 1);
  assert.equal(parsed.messages[2]!.at, Date.UTC(2026, 9, 20, 10));
  const partial = parseUsageJournal('{"kind":"message","message":{"role":"user","content":"hi"}}\n{"kind":"mess', 'y');
  assert.equal(partial.messages.length, 1);
  assert.ok(Number.isNaN(partial.messages[0]!.at));
  assert.equal(usageStats([partial], { now: new Date(AT(21, 12)) }).totalSessions, 0);
});

test('only committed uuid journals are read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-usage-'));
  try {
    const id = '11111111-1111-4111-8111-111111111111';
    fs.writeFileSync(path.join(dir, `${id}.jsonl`), [
      JSON.stringify({ kind: 'metadata', version: 1, id, config: {}, fingerprint: 'f', startedAt: AT(20, 10) }),
      JSON.stringify({ kind: 'message', message: { role: 'user', content: 'hi' } }),
      JSON.stringify({ kind: 'turn_end', reason: 'done', duration: { durationMs: 1,
        timestamp: '2026-10-20T10:00:01.000Z' } }),
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(dir, 'notes.jsonl'), '{}\n');
    fs.writeFileSync(path.join(dir, 'subagents'), '');
    const sessions = readUsageSessions(dir);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]!.id, id);
    assert.equal(sessions[0]!.messages.length, 1);
    assert.deepEqual(readUsageSessions(path.join(dir, 'missing')), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
