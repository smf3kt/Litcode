import fs from 'node:fs';
import path from 'node:path';

/**
 * The Settings Stats tab (`ni`, chunk-dag4qhha.js 99921) over the local session journals.
 *
 * Recovered bodies: `Bs` (chunk-yn0pfn70.js 10886) number formatting, `rn` (9654) durations,
 * `Js` (chunk-dag4qhha.js 91732) day labels, `go` (97308) model ranking, `ei` (97420) the
 * per-modality totals line, `gr` (90466) streaks and `zd` (89324) the aggregate shape.
 *
 * Host adaptation: journals carry no per-entry timestamp. Assistant and user messages inherit the
 * timestamp of the `turn_end` that closes their turn, and a session starts at its recorded
 * `startedAt` (or its first stamped message when that is absent).
 */
export const STATS_PANEL_TITLE = 'Stats';
export const STATS_EMPTY = 'No stats available yet.';

export type UsageRange = 'all' | '7d' | '30d';
export const STATS_RANGE_LABELS: Record<UsageRange, string> = {
  '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'All time',
};
const RANGE_ORDER: readonly UsageRange[] = ['all', '7d', '30d'];
export function nextUsageRange(range: UsageRange): UsageRange {
  return RANGE_ORDER[(RANGE_ORDER.indexOf(range) + 1) % RANGE_ORDER.length]!;
}

export type UsageModelTokens = {
  inputTokens: number; outputTokens: number;
  cacheReadInputTokens: number; cacheCreationInputTokens: number;
};
export type UsageMessage = UsageModelTokens & { at: number; model?: string; toolCalls: number };
export type UsageSession = { id: string; startedAt?: number; messages: readonly UsageMessage[] };
export type UsageDay = { date: string; messageCount: number; sessionCount: number; toolCallCount: number };
export type UsageStreaks = { currentStreak: number; longestStreak: number };
export type UsageStats = {
  totalSessions: number; totalMessages: number; totalDays: number; activeDays: number;
  streaks: UsageStreaks;
  dailyActivity: UsageDay[];
  longestSession: { duration: number; messageCount: number } | null;
  modelUsage: Record<string, UsageModelTokens>;
  firstSessionDate: string | null; lastSessionDate: string | null;
  peakActivityDay: string | null;
  favoriteModel: string | null; totalTokens: number;
};

/** `Bs` (chunk-yn0pfn70.js 10886): compact, lower-cased, one fraction digit above 999. */
export function compactNumber(value: number): string {
  const format = new Intl.NumberFormat('en-US', value >= 1000
    ? { notation: 'compact', maximumFractionDigits: 1, minimumFractionDigits: 1 }
    : { notation: 'compact', maximumFractionDigits: 1, minimumFractionDigits: 0 });
  return format.format(value).toLowerCase();
}

/** `rn` (chunk-yn0pfn70.js 9654) with the default options the dashboard passes. */
export function formatDuration(ms: number): string {
  if (ms < 60000) {
    if (ms === 0) return '0s';
    if (ms < 1) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 1000)}s`;
  }
  let days = Math.floor(ms / 86400000);
  let hours = Math.floor((ms % 86400000) / 3600000);
  let minutes = Math.floor((ms % 3600000) / 60000);
  let seconds = Math.round((ms % 60000) / 1000);
  if (seconds === 60) { seconds = 0; minutes++; }
  if (minutes === 60) { minutes = 0; hours++; }
  if (hours === 24) { hours = 0; days++; }
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** `Js` (chunk-dag4qhha.js 91732). */
export function shortDate(day: string): string {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** `Vt` (chunk-dag4qhha.js 77690): the UTC ISO day. */
export function usageDayKey(date: Date): string {
  const key = date.toISOString().split('T')[0];
  if (key === undefined) throw new Error('Invalid ISO date string');
  return key;
}

/** `Ks` (chunk-dag4qhha.js 90783): shift a day key by whole UTC days. */
function shiftDay(day: string, delta: number): string {
  const date = new Date(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return usageDayKey(date);
}

function emptyModelTokens(): UsageModelTokens {
  return { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
}

/** `Fo` (chunk-dag4qhha.js 80521). */
function modelTokens(tokens: UsageModelTokens): number {
  return tokens.inputTokens + tokens.outputTokens + tokens.cacheReadInputTokens + tokens.cacheCreationInputTokens;
}

/** `gr` (chunk-dag4qhha.js 90466): consecutive-day runs over the active-day set. */
export function usageStreaks(days: readonly string[], today = usageDayKey(new Date())): UsageStreaks {
  if (days.length === 0) return { currentStreak: 0, longestStreak: 0 };
  const active = new Set(days);
  let currentStreak = 0;
  let cursor = today;
  while (active.has(cursor)) { currentStreak++; cursor = shiftDay(cursor, -1); }
  let longestStreak = 0;
  let run = 1;
  const sorted = Array.from(active).sort();
  for (let index = 1; index < sorted.length; index++) {
    const previous = new Date(sorted[index - 1]!);
    const next = new Date(sorted[index]!);
    if (Math.round((next.getTime() - previous.getTime()) / 86400000) === 1) run++;
    else { if (run > longestStreak) longestStreak = run; run = 1; }
  }
  if (run > longestStreak) longestStreak = run;
  return { currentStreak, longestStreak };
}

/**
 * `go` + `zd` (chunk-dag4qhha.js 97308, 89324) over the parsed journals. A range drops sessions
 * whose first message predates the window and counts only in-window messages, mirroring `No`'s
 * `fromDate` filter.
 */
export function usageStats(sessions: readonly UsageSession[],
  options: { range?: UsageRange; now?: Date } = {}): UsageStats {
  const range = options.range ?? 'all';
  const now = options.now ?? new Date();
  let from: string | null = null;
  if (range !== 'all') {
    const start = new Date(now);
    start.setDate(start.getDate() - (range === '7d' ? 7 : 30) + 1);
    from = usageDayKey(start);
  }
  const days = new Map<string, UsageDay>();
  const modelUsage: Record<string, UsageModelTokens> = {};
  const perDayModels = new Map<string, Record<string, number>>();
  let totalMessages = 0;
  let totalSessions = 0;
  let longest: { duration: number; messageCount: number } | null = null;
  let firstSessionDate: string | null = null;
  let lastSessionDate: string | null = null;
  let peakActivityDay: string | null = null;

  for (const session of sessions) {
    const stamped = session.messages.filter(message => Number.isFinite(message.at));
    if (stamped.length === 0) continue;
    const first = stamped[0]!;
    const last = stamped[stamped.length - 1]!;
    const startDay = usageDayKey(new Date(first.at));
    if (from !== null && startDay < from) continue;
    totalSessions++;
    const duration = last.at - (session.startedAt ?? first.at);
    if (longest === null || duration > longest.duration) longest = { duration, messageCount: stamped.length };
    if (firstSessionDate === null || startDay < firstSessionDate) firstSessionDate = startDay;
    if (lastSessionDate === null || startDay > lastSessionDate) lastSessionDate = startDay;
    const startEntry = days.get(startDay) ?? { date: startDay, messageCount: 0, sessionCount: 0, toolCallCount: 0 };
    startEntry.sessionCount++;
    days.set(startDay, startEntry);
    for (const message of stamped) {
      const day = usageDayKey(new Date(message.at));
      if (from !== null && day < from) continue;
      totalMessages++;
      const entry = days.get(day) ?? { date: day, messageCount: 0, sessionCount: 0, toolCallCount: 0 };
      entry.messageCount++;
      entry.toolCallCount += message.toolCalls;
      days.set(day, entry);
      if (message.model === undefined || message.model in Object.prototype) continue;
      const tokens = modelUsage[message.model] ?? (modelUsage[message.model] = emptyModelTokens());
      tokens.inputTokens += message.inputTokens;
      tokens.outputTokens += message.outputTokens;
      tokens.cacheReadInputTokens += message.cacheReadInputTokens;
      tokens.cacheCreationInputTokens += message.cacheCreationInputTokens;
      const byModel = perDayModels.get(day) ?? {};
      byModel[message.model] = (byModel[message.model] ?? 0) + message.inputTokens + message.outputTokens
        + message.cacheReadInputTokens + message.cacheCreationInputTokens;
      perDayModels.set(day, byModel);
    }
  }

  const dailyActivity = Array.from(days.values()).sort((left, right) => left.date.localeCompare(right.date));
  for (const day of dailyActivity) if (peakActivityDay === null ||
    day.messageCount > (days.get(peakActivityDay)?.messageCount ?? 0)) peakActivityDay = day.date;
  let favoriteModel: string | null = null;
  let totalTokens = 0;
  for (const [model, tokens] of Object.entries(modelUsage)) {
    const count = modelTokens(tokens);
    totalTokens += count;
    if (favoriteModel === null || count > modelTokens(modelUsage[favoriteModel]!)) favoriteModel = model;
  }
  const totalDays = firstSessionDate !== null && lastSessionDate !== null
    ? Math.ceil((new Date(lastSessionDate).getTime() - new Date(firstSessionDate).getTime()) / 86400000) + 1
    : 0;
  return {
    totalSessions, totalMessages, totalDays, activeDays: dailyActivity.length,
    streaks: usageStreaks(dailyActivity.map(day => day.date), options.now === undefined ? undefined : usageDayKey(options.now)),
    dailyActivity, longestSession: longest, modelUsage, firstSessionDate, lastSessionDate,
    peakActivityDay, favoriteModel, totalTokens,
  };
}

/** `ei` (chunk-dag4qhha.js 97420). */
export function usageTotalsLine(modelUsage: Readonly<Record<string, UsageModelTokens>>): string {
  let input = 0, output = 0, cacheRead = 0, cacheWrite = 0;
  for (const tokens of Object.values(modelUsage)) {
    input += tokens.inputTokens;
    output += tokens.outputTokens;
    cacheRead += tokens.cacheReadInputTokens;
    cacheWrite += tokens.cacheCreationInputTokens;
  }
  return `Input ${compactNumber(input)} · Output ${compactNumber(output)} · `
    + `Cache read ${compactNumber(cacheRead)} · Cache write ${compactNumber(cacheWrite)}`;
}

const DAY_WIDTH = 28;
const CELL_GAP = 4;

function statCell(text: string): string {
  // Ink's `wrap="truncate"` hard-cuts the 28-column cell; the row gap stays between cells.
  return text.slice(0, DAY_WIDTH).padEnd(DAY_WIDTH + CELL_GAP);
}

function statRow(left: string, right: string): string {
  return `${statCell(left)}${right}`.trimEnd();
}

/** The `ni` summary block: two 28-column cells per row, then the modality totals. */
export function usagePanelText(stats: UsageStats, range: UsageRange = 'all'): string {
  const lines = [`Range: ${STATS_RANGE_LABELS[range]}`];
  if (stats.totalSessions === 0) {
    lines.push('', STATS_EMPTY);
    return lines.join('\n');
  }
  const favorite = stats.favoriteModel === null ? '' : `Favorite model: ${stats.favoriteModel}`;
  const longest = stats.longestSession === null ? ''
    : `Longest session: ${formatDuration(stats.longestSession.duration)}`;
  const streakDays = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;
  lines.push(
    statRow(favorite, `Total tokens: ${compactNumber(stats.totalTokens)}`),
    statRow(`Sessions: ${compactNumber(stats.totalSessions)}`, longest),
    statRow(`Active days: ${stats.activeDays}/${stats.totalDays}`,
      `Longest streak: ${streakDays(stats.streaks.longestStreak)}`),
    statRow(stats.peakActivityDay === null ? '' : `Most active day: ${shortDate(stats.peakActivityDay)}`,
      `Current streak: ${streakDays(stats.streaks.currentStreak)}`),
  );
  if (stats.totalTokens > 0) lines.push('', usageTotalsLine(stats.modelUsage));
  return lines.join('\n');
}

type JournalRecord = { kind?: unknown; startedAt?: unknown; message?: unknown; response?: unknown;
  duration?: unknown };
type ContentBlock = { type?: unknown };

function messageUsage(record: JournalRecord): { model?: string; tokens: UsageModelTokens; toolCalls: number } {
  const response = (record.response ?? null) as { model?: unknown; usage?: Record<string, unknown> } | null;
  const usage = response?.usage;
  const tokens = emptyModelTokens();
  if (usage !== undefined && usage !== null) {
    const pick = (key: string) => {
      const value = usage[key];
      return typeof value === 'number' && Number.isFinite(value) ? value : 0;
    };
    tokens.inputTokens = pick('input_tokens');
    tokens.outputTokens = pick('output_tokens');
    tokens.cacheReadInputTokens = pick('cache_read_input_tokens');
    tokens.cacheCreationInputTokens = pick('cache_creation_input_tokens');
  }
  const message = (record.message ?? null) as { content?: unknown } | null;
  let toolCalls = 0;
  if (Array.isArray(message?.content)) {
    for (const block of message.content as ContentBlock[]) if (block !== null && typeof block === 'object' && block.type === 'tool_use') toolCalls++;
  }
  return {
    ...(typeof response?.model === 'string' && response.model !== '' ? { model: response.model } : {}),
    tokens, toolCalls,
  };
}

/** Parse one journal into stamped messages. Only committed lines are read. */
export function parseUsageJournal(text: string, id: string): UsageSession {
  const messages: UsageMessage[] = [];
  let pending: UsageMessage[] = [];
  let startedAt: number | undefined;
  let lastAt: number | undefined;
  const end = text.lastIndexOf('\n') + 1;
  for (const line of text.slice(0, end).split('\n')) {
    if (line === '') continue;
    let record: JournalRecord;
    try { record = JSON.parse(line) as JournalRecord; } catch { continue; }
    if (record === null || typeof record !== 'object') continue;
    if (record.kind === 'metadata') {
      if (typeof record.startedAt === 'number' && Number.isFinite(record.startedAt)) startedAt = record.startedAt;
      continue;
    }
    if (record.kind === 'message') {
      const { model, tokens, toolCalls } = messageUsage(record);
      pending.push({ ...tokens, toolCalls, at: Number.NaN, ...(model === undefined ? {} : { model }) });
      continue;
    }
    if (record.kind === 'turn_end') {
      const duration = record.duration as { timestamp?: unknown } | undefined;
      const at = typeof duration?.timestamp === 'string' ? Date.parse(duration.timestamp) : Number.NaN;
      if (Number.isFinite(at)) {
        lastAt = at;
        for (const message of pending) message.at = at;
      }
      messages.push(...pending);
      pending = [];
    }
  }
  const fallback = lastAt ?? startedAt;
  if (fallback !== undefined) for (const message of pending) message.at = fallback;
  messages.push(...pending);
  return { id, ...(startedAt === undefined ? {} : { startedAt }), messages };
}

/** Every committed journal in a directory that `listSessionDirectory` would consider a session. */
export function readUsageSessions(dir: string): UsageSession[] {
  if (!fs.existsSync(dir)) return [];
  if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw new Error('Invalid session directory');
  return fs.readdirSync(dir).filter(name => /^[0-9a-f-]{36}\.jsonl$/.test(name)).flatMap(name => {
    const file = path.join(dir, name);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100 * 1024 * 1024) return [];
    return [parseUsageJournal(fs.readFileSync(file, 'utf8'), name.slice(0, -'.jsonl'.length))];
  });
}
