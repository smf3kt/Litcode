// Local cron jobs and one dynamic wakeup slot. The parser retains this host's DST contract.
// Durable watching adapts x0r [5233,11476) from chunk-jrz2zk22.js, SHA-256
// da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3.
// File mutations adapt Pot/s_e/bds [6985,7656) from chunk-atzjaveb.js, SHA-256
// 71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a.
// Coordinates are zero-based UTF-16. See research/ports/W310-cron-watch.md.

import { randomUUID } from 'node:crypto';

import { schedulerProcessBirth, TaskCreators } from './scheduler-creators.js';
import {
  acquireSchedulerLock, agedOut, missedTasks, missedTasksPrompt, readStoredTasks, releaseSchedulerLock,
  removeStoredTasks, scheduledTasksPath, stampStoredTasks, watchStoredTasks, writeStoredTasks,
  STORE_LOCK_RETRY_MS, type StoredTask, type TaskStoreWatch,
} from './scheduler-store.js';

// ---------------------------------------------------------------------------
// Cron parsing (local time)
// ---------------------------------------------------------------------------

/** Inclusive numeric bounds for each of the five cron fields. */
export interface CronFieldSpec {
  min: number;
  max: number;
}

/** Field order and bounds: minute, hour, day-of-month, month, day-of-week. */
export const CRON_FIELDS: readonly CronFieldSpec[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 },  // day of week (0 = Sunday; 7 is accepted as Sunday)
];

/** A parsed 5-field cron expression. */
export interface ParsedCron {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
  /** True when the raw day-of-month field is not exactly `*`. */
  domRestricted: boolean;
  /** True when the raw day-of-week field is not exactly `*`. */
  dowRestricted: boolean;
}

/**
 * Expand one cron field into a sorted, de-duplicated value list. Returns null
 * for any malformed field. Grammar: `*`, `*\/n`, `a`, `a-b`, `a-b/n`, and
 * comma-separated combinations. A bare `7` (or `7` in a range) in the
 * day-of-week field is treated as Sunday (0).
 */
export function expandCronField(text: string, spec: CronFieldSpec): number[] | null {
  const values = new Set<number>();
  const isDayOfWeek = spec.min === 0 && spec.max === 6;
  for (const part of text.split(',')) {
    const star = /^\*(?:\/(\d+))?$/.exec(part);
    if (star) {
      const step = star[1] ? parseInt(star[1], 10) : 1;
      if (step < 1) return null;
      for (let value = spec.min; value <= spec.max; value += step) values.add(value);
      continue;
    }
    const range = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(part);
    if (range) {
      const low = parseInt(range[1], 10);
      const high = parseInt(range[2], 10);
      const step = range[3] ? parseInt(range[3], 10) : 1;
      const upperBound = isDayOfWeek ? 7 : spec.max;
      if (low > high || step < 1 || low < spec.min || high > upperBound) return null;
      for (let value = low; value <= high; value += step) {
        values.add(isDayOfWeek && value === 7 ? 0 : value);
      }
      continue;
    }
    if (/^\d+$/.test(part)) {
      let value = parseInt(part, 10);
      if (isDayOfWeek && value === 7) value = 0;
      if (value < spec.min || value > spec.max) return null;
      values.add(value);
      continue;
    }
    return null;
  }
  if (values.size === 0) return null;
  return Array.from(values).sort((a, b) => a - b);
}

/** Parse a 5-field cron expression; returns null when malformed. */
export function parseCron(expression: string): ParsedCron | null {
  if (typeof expression !== 'string') return null;
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const expanded: number[][] = [];
  for (let index = 0; index < 5; index += 1) {
    const field = expandCronField(fields[index], CRON_FIELDS[index]);
    if (!field) return null;
    expanded.push(field);
  }
  return {
    minute: expanded[0],
    hour: expanded[1],
    dayOfMonth: expanded[2],
    month: expanded[3],
    dayOfWeek: expanded[4],
    domRestricted: fields[2] !== '*',
    dowRestricted: fields[4] !== '*',
  };
}

/** Upper bound of the next-occurrence search: one year of minute steps. */
export const MINUTES_PER_YEAR = 527040; // 366 * 24 * 60

/**
 * Whether a calendar day matches the parsed expression. When both day fields
 * are restricted the match is the union (OR); otherwise it is the intersection
 * (AND), which collapses to whichever field is actually restricted.
 */
export function cronDayMatches(parsed: ParsedCron, date: Date): boolean {
  const domMatch = parsed.dayOfMonth.includes(date.getDate());
  const dowMatch = parsed.dayOfWeek.includes(date.getDay());
  if (parsed.domRestricted && parsed.dowRestricted) return domMatch || dowMatch;
  return domMatch && dowMatch;
}

/**
 * First local-time occurrence strictly after `from`, or null when none exists
 * within one year. Seconds and sub-second fields are floored to :00.
 *
 * Bounds: the search stops at a real epoch deadline one calendar year after
 * `from` (not just an iteration count), so month/day/hour skips can never
 * return an occurrence more than a year out. A safety iteration cap remains.
 *
 * DST: the plain minute advance uses epoch arithmetic (`+60000 ms`), so a DST
 * fall-back's repeated wall-clock hour is walked minute by minute rather than
 * skipped, and a spring-forward gap simply jumps the epoch by 60 s. The coarse
 * month/day/hour jumps are wall-clock based; each is clamped to advance at
 * least one epoch minute, guaranteeing strictly increasing candidates.
 */
export function nextOccurrence(parsed: ParsedCron, from: Date): Date | null {
  const startMs = from.getTime();
  if (!Number.isFinite(startMs)) return null;
  const deadline = new Date(startMs);
  deadline.setFullYear(deadline.getFullYear() + 1);
  const deadlineMs = deadline.getTime();
  // Floor to the minute in epoch time and step one minute. Epoch arithmetic is
  // used here (not local `setSeconds`) because a local-field setter resolves an
  // ambiguous wall-clock (a DST fall-back hour) to its first instance, which can
  // move the epoch backward.
  const minuteFloor = Math.floor(startMs / 60000) * 60000;
  const cursor = new Date(minuteFloor + 60000); // strictly after `from`, minute granularity
  const minuteSet = new Set(parsed.minute);
  const hourSet = new Set(parsed.hour);
  const monthSet = new Set(parsed.month);
  // Any coarse (wall-clock) jump must still move the epoch forward.
  const keepMonotonic = (previousMs: number): void => {
    if (cursor.getTime() <= previousMs) cursor.setTime(previousMs + 60000);
  };
  for (let step = 0; step < MINUTES_PER_YEAR; step += 1) {
    if (cursor.getTime() > deadlineMs) return null;
    const before = cursor.getTime();
    if (!monthSet.has(cursor.getMonth() + 1)) {
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      keepMonotonic(before);
      continue;
    }
    if (!cronDayMatches(parsed, cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      keepMonotonic(before);
      continue;
    }
    if (!hourSet.has(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      keepMonotonic(before);
      continue;
    }
    if (!minuteSet.has(cursor.getMinutes())) {
      cursor.setTime(cursor.getTime() + 60000); // epoch step: never skips a real minute
      continue;
    }
    return cursor;
  }
  return null;
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/**
 * Compact human-readable summary for common patterns; falls back to the raw
 * expression. Mirrors the original `humanSchedule` output for simple shapes.
 */
export function describeCron(expression: string): string {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return expression;
  const [minute, hour, dom, month, dow] = fields;
  if (dom !== '*' || month !== '*' || dow !== '*') return expression;
  if (minute === '*') return 'Every minute';
  const minuteStep = /^\*\/(\d+)$/.exec(minute);
  if (minuteStep) {
    const step = parseInt(minuteStep[1], 10);
    return step === 1 ? 'Every minute' : `Every ${step} minutes`;
  }
  if (/^\d+$/.test(minute) && hour === '*') {
    const minuteValue = parseInt(minute, 10);
    return minuteValue === 0 ? 'Every hour' : `Every hour at :${pad2(minuteValue)}`;
  }
  const hourStep = /^\*\/(\d+)$/.exec(hour);
  if (/^\d+$/.test(minute) && hourStep) {
    const step = parseInt(hourStep[1], 10);
    const minuteValue = parseInt(minute, 10);
    const at = minuteValue === 0 ? '' : ` at :${pad2(minuteValue)}`;
    return step === 1 ? `Every hour${at}` : `Every ${step} hours${at}`;
  }
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `Every day at ${pad2(parseInt(hour, 10))}:${pad2(parseInt(minute, 10))}`;
  }
  return expression;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Source `_9` (chunk-atzjaveb.js 7983): the timing constants the recovered scheduler uses for
 * every fire. `recurringFrac`/`recurringCapMs` bound the recurring spread, `oneShotMaxMs`/
 * `oneShotFloorMs`/`oneShotMinuteMod` bound the one-shot early fire, `recurringMaxAgeMs` is the
 * seven-day expiry and `cacheLeadMs` is the warm-up lead a `*\/N` schedule gets.
 */
export const SCHEDULER_TIMING = {
  recurringFrac: 0.5,
  recurringCapMs: 1_800_000,
  oneShotMaxMs: 90_000,
  oneShotFloorMs: 0,
  oneShotMinuteMod: 30,
  recurringMaxAgeMs: 604_800_000,
  cacheLeadMs: 15_000,
} as const;

/** Source `D`: the schedules that get the cache lead (a bare `*\/N` minute field). */
const CACHE_LEAD_CRON = /^\*\/\d+ \* \* \* \*$/;
/** Source `S0n`: the shortest interval the cache lead applies to. */
const CACHE_LEAD_INTERVAL_MS = 300_000;

/**
 * Source `C(n)`: the deterministic spread factor, the first eight hex characters of the job id
 * read as a fraction of 2^32. Not a digest of the schedule; the id alone decides.
 */
export function jitterFraction(id: string): number {
  const value = parseInt(id.slice(0, 8), 16) / 0x1_0000_0000;
  return Number.isFinite(value) ? value : 0;
}

/** `wqe`: the first occurrence strictly after `from`, as epoch ms. */
function occurrenceAfter(cron: string, from: number): number | null {
  const parsed = parseCron(cron);
  if (!parsed) return null;
  const next = nextOccurrence(parsed, new Date(from));
  return next ? next.getTime() : null;
}

/**
 * Source `L9t`: the next fire of a recurring task. The nominal occurrence moves later by up to
 * `recurringFrac` of the interval, capped at `recurringCapMs`; a `*\/N` schedule whose interval
 * sits just above five minutes instead fires `cacheLeadMs` early so the cache is warm.
 */
export function nextRecurringFire(cron: string, from: number, id: string, timing = SCHEDULER_TIMING): number | null {
  const nominal = occurrenceAfter(cron, from);
  if (nominal === null) return null;
  const following = occurrenceAfter(cron, nominal);
  if (following === null) return nominal;
  const interval = following - nominal;
  if (CACHE_LEAD_CRON.test(cron) && timing.cacheLeadMs > 0 && timing.cacheLeadMs < interval
    && interval >= CACHE_LEAD_INTERVAL_MS && interval - timing.cacheLeadMs < CACHE_LEAD_INTERVAL_MS) {
    return from + interval - timing.cacheLeadMs;
  }
  // The source keeps the fractional offset and hands it to `Date`, which truncates to whole
  // milliseconds; flooring here makes the same instant explicit.
  return Math.floor(nominal + Math.min(jitterFraction(id) * timing.recurringFrac * interval, timing.recurringCapMs));
}

/**
 * Source `E0n`: the fire of a one-shot task. A task landing on :00 or :30 fires up to
 * `oneShotMaxMs` early, never before it was created.
 */
export function nextOneShotFire(cron: string, createdAt: number, id: string, timing = SCHEDULER_TIMING): number | null {
  const nominal = occurrenceAfter(cron, createdAt);
  if (nominal === null) return null;
  if (new Date(nominal).getMinutes() % timing.oneShotMinuteMod !== 0) return nominal;
  const early = timing.oneShotFloorMs + jitterFraction(id) * (timing.oneShotMaxMs - timing.oneShotFloorMs);
  // E0n [8395,8604), chunk-atzjaveb.js preserves the fraction for ne's numeric clock comparison.
  return Math.max(nominal - early, createdAt);
}

/** Source `Pot`: a job id is the first eight hex characters of a fresh UUID. */
export function newTaskId(): string {
  return randomUUID().slice(0, 8);
}

/** Hard cap on concurrent cron jobs, matching the original bound. */
export const MAX_JOBS = 50;
/** Recurring jobs auto-expire after this age, with one final fire. */
export const RECURRING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Default poll interval for the real, self-owned timer. */
export const DEFAULT_TICK_MS = 1000;
/** Dynamic wakeup delay bounds, in seconds. */
export const WAKEUP_MIN_SECONDS = 60;
export const WAKEUP_MAX_SECONDS = 3600;
/** F/O [4151,4658), chunk-68g5e6vr.js. */
export function dynamicWakeupTiming(delaySeconds: number, now: number, cacheLeadMs: number = SCHEDULER_TIMING.cacheLeadMs): {
  clamped: number; wasClamped: boolean; targetMs: number; createdAt: number;
} {
  let rounded;
  if (Number.isNaN(delaySeconds)) rounded = WAKEUP_MIN_SECONDS;
  else if (delaySeconds === Infinity) rounded = WAKEUP_MAX_SECONDS;
  else if (delaySeconds === -Infinity) rounded = WAKEUP_MIN_SECONDS;
  else rounded = Math.round(delaySeconds);
  const clamped = Math.max(WAKEUP_MIN_SECONDS, Math.min(WAKEUP_MAX_SECONDS, rounded));
  const wasClamped = !Number.isFinite(delaySeconds) || rounded !== clamped;
  const planned = now + clamped * 1000;
  const target = new Date(planned);
  if (target.getSeconds() > 0 || target.getMilliseconds() > 0) target.setMinutes(target.getMinutes() + 1);
  target.setSeconds(0, 0);
  let targetMs = target.getTime();
  if (cacheLeadMs > 0 && clamped * 1000 <= CACHE_LEAD_INTERVAL_MS) {
    const window = CACHE_LEAD_INTERVAL_MS - cacheLeadMs;
    while (targetMs - now > window && targetMs - 60_000 >= now + WAKEUP_MIN_SECONDS * 1000) targetMs -= 60_000;
  }
  const createdAt = planned < targetMs ? planned : targetMs - 1;
  return { clamped, wasClamped, targetMs, createdAt };
}

/** T [4658,4744), chunk-68g5e6vr.js supplies the dynamic task's early-fire fraction. */
function newWakeupId(): string {
  return Math.floor(Math.random() * 4294967295).toString(16).padStart(8, '0');
}

/** Input budgets enforced by {@link LocalScheduler.create}. */
export const MAX_CRON_LENGTH = 200;
export const MAX_PROMPT_LENGTH = 100000;

/** Typed scheduler error; `code` mirrors the original validator error codes. */
export class SchedulerError extends Error {
  readonly code: number;
  constructor(message: string, code: number) {
    super(message);
    this.name = 'SchedulerError';
    this.code = code;
  }
}

/** Stored task metadata plus this session's due-time cache. */
export interface ScheduledJob extends Omit<StoredTask, 'recurring'> {
  recurring: boolean;
  durable: boolean;
  nextAt: number;
  humanSchedule: string;
}

/** A single fire emitted by {@link LocalScheduler.tick}. */
export interface SchedulerEvent {
  id: string;
  prompt: string;
  kind: 'cron' | 'wakeup';
  dueAt: number;
  firedAt: number;
  recurring?: boolean;
  /**
   * Set when the injected `onPrompt` callback threw for this event. The
   * failure is contained per event: remaining due jobs still fire this tick.
   */
  callbackError?: string;
}

/** k2o [1246,1362), chunk-68g5e6vr.js; triBool/Ne/Es use the neutral environment name. */
export function loopKeepaliveEnabled(value = process.env.HARNESS_LOOP_KEEPALIVE): boolean {
  const normalized = value?.toLowerCase().trim();
  if (normalized !== undefined && ['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (normalized !== undefined && ['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return true;
}

/** The single dynamic wakeup slot. */
export interface DynamicWakeup {
  id: string;
  prompt: string;
  scheduledFor: number;
  createdAt: number;
  chainStartedAt: number;
  nextAt: number;
  reason?: string;
  keepalive?: true;
}

interface WakeupChain {
  startedAt: number;
  lastScheduledFor: number;
  agedOut?: true;
}

/** Create-job input. */
export interface CronJobInput {
  cron: string;
  prompt: string;
  recurring?: boolean;
  durable?: boolean;
}

/** Injectable timer surface (subset of `setInterval`). */
export interface SchedulerTimer {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  unref?(handle: unknown): void;
}

export interface LocalSchedulerOptions {
  /** Consumes fired prompts. The only output path; never a model call. */
  onPrompt: (prompt: string, id: string, kind?: SchedulerEvent['kind']) => void;
  /** x0r.ne [7616,7735), chunk-jrz2zk22.js: hold delivery while the owner is loading. */
  isLoading?: () => boolean;
  assistantMode?: boolean;
  keepalive?: () => boolean;
  /** x0r B/Q [5233,5610), chunk-jrz2zk22.js controls task admission and file leasing. */
  filter?: (kind: SchedulerEvent['kind']) => boolean;
  leaseFileTasks?: () => boolean;
  /** Injectable clock. Defaults to `() => new Date()`. */
  now?: () => Date;
  /**
   * Inject a timer, or pass `null` to disable auto-ticking entirely (drive
   * manually via {@link LocalScheduler.tick}). When omitted, a real
   * `setInterval` is used and unref-ed so it never keeps the process alive.
   */
  timer?: SchedulerTimer | null;
  /** Job cap. Defaults to {@link MAX_JOBS}. */
  maxJobs?: number;
  /** Recurring expiry age. Defaults to {@link RECURRING_MAX_AGE_MS}. */
  recurringMaxAgeMs?: number;
  /** Auto-tick interval for the default timer. Defaults to {@link DEFAULT_TICK_MS}. */
  tickIntervalMs?: number;
  /** Opt in to recovered cron jitter and dynamic minute/cache-lead timing. */
  jitter?: boolean;
  /** Durable tasks use the workspace store and source creator eligibility (`ke`/`ne`). */
  store?: SchedulerStoreOptions;
}

/** The durable store's injectable surface, so a test can drive it without a workspace. */
export interface SchedulerStoreOptions {
  workspace: string;
  /** This session's lock identity. Defaults to a fresh UUID. */
  sessionId?: string;
  /** Sessions observed by the same interactive process (`x0r.Y`/`vd`). */
  sessionIds?: ReadonlySet<string>;
  /** The current project's local journal directory (`Je`/`Oh`). */
  transcriptDirectory?: string;
  /** The catch-up prompt for one-shot tasks that came due while nothing was running. */
  onMissed?: (prompt: string) => void;
}

const realTimer: SchedulerTimer = {
  setInterval(handler, ms) {
    return setInterval(handler, ms);
  },
  clearInterval(handle) {
    clearInterval(handle as ReturnType<typeof setInterval>);
  },
  unref(handle) {
    (handle as { unref?: () => void }).unref?.();
  },
};

/**
 * In-memory, session-only scheduler with an injectable clock and timer.
 */
export class LocalScheduler {
  private readonly onPrompt: (prompt: string, id: string, kind?: SchedulerEvent['kind']) => void;
  private readonly isLoading: () => boolean;
  private readonly assistantMode: boolean;
  private readonly keepalive: () => boolean;
  private readonly filter: (kind: SchedulerEvent['kind']) => boolean;
  private readonly leaseFileTasks: () => boolean;
  private readonly now: () => Date;
  private readonly maxJobs: number;
  private readonly recurringMaxAgeMs: number;
  private readonly jitter: boolean;
  private readonly timer: SchedulerTimer | null;
  private readonly jobs = new Map<string, ScheduledJob>();
  private readonly store: SchedulerStoreOptions | undefined;
  private readonly storeSessionId: string;
  private readonly creators: TaskCreators | undefined;
  private readonly fileDeadlines = new Set<string>();
  private dynamic: DynamicWakeup | null = null;
  // he [34628,35290), chunk-4bw62nzm.js: prompt history survives a fire and resets on cancellation/close.
  private readonly wakeupChains = new Map<string, WakeupChain>();
  private readonly deliveredWakeups = new Map<string, string>();
  private inFlightWakeup: Pick<DynamicWakeup, 'id' | 'prompt'> | null = null;
  // he [34628,35290), chunk-4bw62nzm.js; C2o [1437,1642), chunk-68g5e6vr.js owns the budget.
  private consecutiveKeepalives = 0;
  private timerHandle: unknown = undefined;
  private closed = false;
  private storeLease: 'detached' | 'waiting' | 'held' = 'detached';
  private attachPromise: Promise<boolean> | undefined;
  private storeWatch: TaskStoreWatch | undefined;
  private lockRetry: unknown;
  private lockAttempt: Promise<void> | undefined;
  private storeClosing: Promise<void> | undefined;
  private pendingWrite: Promise<void> = Promise.resolve();
  private storeError: unknown;
  private readonly deliveredFileTasks = new Set<string>();

  constructor(options: LocalSchedulerOptions) {
    if (!options || typeof options.onPrompt !== 'function') {
      throw new TypeError('LocalScheduler requires an onPrompt callback');
    }
    this.onPrompt = options.onPrompt;
    this.isLoading = options.isLoading ?? (() => false);
    this.assistantMode = options.assistantMode === true;
    this.keepalive = options.keepalive ?? loopKeepaliveEnabled;
    this.filter = options.filter ?? (() => true);
    this.leaseFileTasks = options.leaseFileTasks ?? (() => true);
    this.now = options.now ?? (() => new Date());
    this.maxJobs = options.maxJobs ?? MAX_JOBS;
    this.recurringMaxAgeMs = options.recurringMaxAgeMs ?? RECURRING_MAX_AGE_MS;
    this.jitter = options.jitter === true;
    this.store = options.store;
    this.storeSessionId = options.store?.sessionId ?? randomUUID();
    this.creators = options.store && new TaskCreators({ ...options.store, sessionId: this.storeSessionId });
    this.timer = options.timer === undefined ? realTimer : options.timer;
    if (this.timer) {
      const interval = options.tickIntervalMs ?? DEFAULT_TICK_MS;
      const handle = this.timer.setInterval(() => {
        try {
          this.tick();
        } catch {
          // The injected onPrompt owns its errors; never crash the host timer.
        }
      }, interval);
      this.timer.unref?.(handle);
      this.timerHandle = handle;
    }
  }

  /**
   * Register a cron job. Input is validated strictly (types and size budgets).
   * Throws {@link SchedulerError} code 1 (malformed input, invalid cron or
   * invalid clock), 2 (no occurrence within a year) or 3 (capacity / closed).
   */
  create(input: CronJobInput): ScheduledJob {
    if (this.closed) throw new SchedulerError('scheduler is closed', 3);
    if (input === null || typeof input !== 'object') {
      throw new SchedulerError('create input must be an object.', 1);
    }
    const raw = input as { cron?: unknown; prompt?: unknown; recurring?: unknown; durable?: unknown };
    if (typeof raw.cron !== 'string') throw new SchedulerError('cron must be a string.', 1);
    if (typeof raw.prompt !== 'string') throw new SchedulerError('prompt must be a string.', 1);
    if (raw.recurring !== undefined && typeof raw.recurring !== 'boolean') {
      throw new SchedulerError('recurring must be a boolean.', 1);
    }
    if (raw.durable !== undefined && typeof raw.durable !== 'boolean') {
      throw new SchedulerError('durable must be a boolean.', 1);
    }
    const cron = raw.cron.trim();
    if (cron.length === 0 || cron.length > MAX_CRON_LENGTH) {
      throw new SchedulerError(`cron must be a non-empty string of at most ${MAX_CRON_LENGTH} characters.`, 1);
    }
    if (raw.prompt.length === 0) throw new SchedulerError('prompt must be a non-empty string.', 1);
    if (raw.prompt.length > MAX_PROMPT_LENGTH) {
      throw new SchedulerError(`prompt exceeds the ${MAX_PROMPT_LENGTH}-character budget.`, 1);
    }
    const parsed = parseCron(cron);
    if (!parsed) {
      throw new SchedulerError(`Invalid cron expression '${cron}'. Expected 5 fields: M H DoM Mon DoW.`, 1);
    }
    if (this.jobs.size >= this.maxJobs) {
      throw new SchedulerError(`Too many scheduled jobs (max ${this.maxJobs}). Cancel one first.`, 3);
    }
    const createdAt = this.clock();
    const next = nextOccurrence(parsed, new Date(createdAt));
    if (!next) {
      throw new SchedulerError(`Cron expression '${cron}' does not match any calendar date in the next year.`, 2);
    }
    const job: ScheduledJob = {
      // Source `Pot`: eight hex characters of a fresh UUID, not the whole UUID.
      id: newTaskId(),
      cron,
      prompt: raw.prompt,
      recurring: raw.recurring === undefined ? true : raw.recurring,
      // Durable is only ever true when a store is bound and the caller asked for it; without a
      // store the input is accepted and the job stays session-only.
      durable: raw.durable === true && this.store !== undefined,
      createdAt,
      nextAt: next.getTime(),
      humanSchedule: describeCron(cron),
    };
    job.nextAt = this.fireTime(job, parsed, next.getTime(), createdAt);
    this.jobs.set(job.id, job);
    if (job.durable) {
      // `Pot` [6985,7298), chunk-atzjaveb.js: append to the latest file, retaining other rows.
      const task: StoredTask = { id: job.id, cron, prompt: job.prompt, createdAt,
        ...(job.recurring ? { recurring: true } : {}),
        createdBySessionId: this.storeSessionId, createdByPid: process.pid,
        createdByProcStart: schedulerProcessBirth(), createdInProject: this.store!.workspace };
      Object.assign(job, task);
      this.fileDeadlines.add(job.id);
      void this.storeOperation(async () => {
        const tasks = await readStoredTasks(this.store!.workspace);
        tasks.push(task);
        await writeStoredTasks(this.store!.workspace, tasks);
      });
    }
    return { ...job };
  }

  /** Remove a job by id. Returns true when a job was removed. */
  delete(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    this.jobs.delete(id);
    if (job.durable) {
      this.deliveredFileTasks.add(id);
      void this.storeOperation(() => removeStoredTasks(this.store!.workspace, [id]));
    }
    return true;
  }

  /** Copy of a single job, or null. */
  getJob(id: string): ScheduledJob | null {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  hasStoreLock(): boolean {
    return this.storeLease === 'held' && this.storeClosing === undefined;
  }

  ensureAttached(): Promise<boolean> {
    if (this.store === undefined || this.closed || this.storeClosing) return Promise.resolve(false);
    return this.attachPromise ??= this.startStore();
  }

  attachStore(): Promise<boolean> {
    return this.ensureAttached();
  }

  /** `oe` [9890,10444), chunk-jrz2zk22.js: acquire, read, watch, then retry a contended lease. */
  private async startStore(): Promise<boolean> {
    const store = this.store!;
    const acquired = this.leaseFileTasks() && await acquireSchedulerLock(store.workspace, { sessionId: this.storeSessionId });
    if (this.closed || this.storeClosing || acquired && !this.leaseFileTasks()) {
      if (acquired) await releaseSchedulerLock(store.workspace, this.storeSessionId);
      return false;
    }
    this.storeLease = acquired ? 'held' : 'waiting';
    await this.storeOperation(() => this.reloadStoredTasks(true));
    if (this.closed || this.storeClosing) return false;
    this.storeWatch = watchStoredTasks(store.workspace, {
      changed: () => { void this.storeOperation(async () => { await this.reloadStoredTasks(); this.tick(); }); },
      removed: () => { void this.storeOperation(() => this.reloadStoredTasks()); },
      error: error => { this.storeError = error; },
    });
    await this.storeWatch.ready;
    if (this.closed || this.storeClosing) return false;
    if (!acquired && this.timer) {
      this.lockRetry = this.timer.setInterval(() => this.retryStoreLock(), STORE_LOCK_RETRY_MS);
      this.timer.unref?.(this.lockRetry);
    }
    return acquired;
  }

  private retryStoreLock(): void {
    if (this.closed || this.storeClosing || this.storeLease !== 'waiting' || this.lockAttempt || !this.leaseFileTasks()) return;
    const store = this.store!;
    this.lockAttempt = (async () => {
      const acquired = await acquireSchedulerLock(store.workspace, { sessionId: this.storeSessionId });
      if (this.closed || this.storeClosing || !this.leaseFileTasks()) {
        if (acquired) await releaseSchedulerLock(store.workspace, this.storeSessionId);
        return;
      }
      if (!acquired) return;
      // `ke` precedes `b` in ne [7616,9890): only an eligible creator owns a deadline.
      for (const job of this.jobs.values()) {
        if (job.durable && !this.creators!.eligible(job, false)) {
          this.jobs.delete(job.id);
          this.fileDeadlines.delete(job.id);
        }
      }
      this.storeLease = 'held';
      this.clearLockRetry();
      await this.storeOperation(async () => { await this.reloadStoredTasks(); this.tick(); });
    })().catch(error => { this.storeError = error; }).finally(() => { this.lockAttempt = undefined; });
  }

  private clearLockRetry(): void {
    if (this.lockRetry !== undefined) this.timer?.clearInterval(this.lockRetry);
    this.lockRetry = undefined;
  }

  /** `me` [6337,7616) and `pe`: replace file rows, retain the id-keyed due cache and session rows. */
  private async reloadStoredTasks(startup = false): Promise<void> {
    if (this.closed || this.storeClosing) return;
    const store = this.store!;
    const stored = await readStoredTasks(store.workspace);
    await this.creators!.readTranscripts(stored);
    if (this.closed || this.storeClosing) return;
    // `me` [6337,7616): an original-session resume refreshes its creator process before catch-up.
    if (startup) {
      let refreshed = false;
      for (const task of stored) {
        if (task.createdBySessionId === this.storeSessionId && task.createdByPid !== process.pid) {
          task.createdByPid = process.pid;
          task.createdByProcStart = schedulerProcessBirth();
          refreshed = true;
        }
      }
      if (refreshed) await writeStoredTasks(store.workspace, stored).catch(error => { this.storeError = error; });
    }
    if (this.closed || this.storeClosing) return;
    const ids = new Set(stored.map(task => task.id));
    for (const id of this.deliveredFileTasks) if (!ids.has(id)) this.deliveredFileTasks.delete(id);
    for (const id of this.fileDeadlines) if (!ids.has(id)) this.fileDeadlines.delete(id);
    if (startup) {
      const missed = missedTasks(stored, this.clock())
        .filter(task => this.filter('cron') && task.recurring !== true && !this.deliveredFileTasks.has(task.id)
          && this.creators!.eligible(task, this.hasStoreLock()));
      if (missed.length) {
        for (const task of missed) this.deliveredFileTasks.add(task.id);
        try {
          const prompt = missedTasksPrompt(missed, scheduledTasksPath(store.workspace));
          if (store.onMissed) store.onMissed(prompt);
          else this.onPrompt(prompt, 'missed');
          await removeStoredTasks(store.workspace, missed.map(task => task.id));
        } catch (error) { this.storeError = error; }
      }
    }
    if (this.closed || this.storeClosing) return;
    for (const job of this.jobs.values()) if (job.durable && !ids.has(job.id)) this.jobs.delete(job.id);
    for (const task of stored) {
      if (this.deliveredFileTasks.has(task.id)) { this.jobs.delete(task.id); continue; }
      const parsed = parseCron(task.cron);
      if (!parsed) continue;
      const previous = this.jobs.get(task.id);
      const from = task.recurring ? (task.lastFiredAt ?? task.createdAt) : task.createdAt;
      const nominal = nextOccurrence(parsed, new Date(from));
      // ne.b [7731,9544), chunk-jrz2zk22.js, UTF-16 caches unresolved deadlines as Infinity.
      const job: ScheduledJob = { ...task, recurring: task.recurring === true, durable: true,
        nextAt: nominal?.getTime() ?? Infinity, humanSchedule: describeCron(task.cron) };
      const eligible = this.creators!.eligible(task, this.hasStoreLock());
      job.nextAt = eligible && this.fileDeadlines.has(task.id) && previous
        ? previous.nextAt : nominal ? this.fireTime(job, parsed, nominal.getTime(), from) : Infinity;
      if (eligible) this.fileDeadlines.add(task.id);
      else this.fileDeadlines.delete(task.id);
      this.jobs.set(job.id, job);
    }
  }

  /** `N` and x0r.stop: close is awaited so no late acquisition can outlive its session. */
  detachStore(): Promise<void> {
    if (this.storeClosing) return this.storeClosing;
    if (!this.store) return Promise.resolve();
    this.clearLockRetry();
    const watcherClosing = this.storeWatch?.close();
    this.storeWatch = undefined;
    this.storeClosing = (async () => {
      await this.attachPromise?.catch(() => false);
      await this.lockAttempt;
      await watcherClosing;
      await this.pendingWrite;
      if (this.storeLease === 'held') await releaseSchedulerLock(this.store!.workspace, this.storeSessionId);
      this.storeLease = 'detached';
    })();
    return this.storeClosing;
  }

  private storeOperation(operation: () => Promise<void>): Promise<void> {
    this.pendingWrite = this.pendingWrite.then(operation).catch(error => { this.storeError = error; });
    return this.pendingWrite;
  }

  async flushStore(): Promise<void> {
    await this.pendingWrite;
    if (this.storeError !== undefined) {
      const error = this.storeError;
      this.storeError = undefined;
      throw error;
    }
  }

  /** All jobs, ordered by next fire time. */
  list(): ScheduledJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => a.nextAt - b.nextAt || a.createdAt - b.createdAt)
      .map((job) => ({ ...job }));
  }

  /** C/w/F [2208,4515), chunk-68g5e6vr.js; source timing follows the existing jitter gate. */
  scheduleWakeup(delaySeconds: number, prompt: string, reason?: string): {
    scheduledFor: number;
    clampedDelaySeconds: number;
    wasClamped: boolean;
  } {
    return this.armWakeup(delaySeconds, prompt, reason, false);
  }

  /** C [2208,3481), chunk-68g5e6vr.js distinguishes model schedules from fallback schedules. */
  private armWakeup(delaySeconds: number, prompt: string, reason: string | undefined, viaKeepalive: boolean) {
    if (this.closed) throw new SchedulerError('scheduler is closed', 3);
    if (typeof delaySeconds !== 'number' || !Number.isFinite(delaySeconds)) {
      throw new SchedulerError('delaySeconds must be a finite number.', 1);
    }
    if (typeof prompt !== 'string' || prompt.length === 0) {
      throw new SchedulerError('prompt must be a non-empty string.', 1);
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new SchedulerError(`prompt exceeds the ${MAX_PROMPT_LENGTH}-character budget.`, 1);
    }
    if (!viaKeepalive) this.consecutiveKeepalives = 0;
    const createdAt = this.clock();
    this.dynamic = null;
    const chain = this.wakeupChains.get(prompt);
    const stale = chain !== undefined && createdAt > chain.lastScheduledFor + WAKEUP_MAX_SECONDS * 1000;
    const startedAt = chain === undefined || stale ? createdAt : chain.startedAt;
    if (this.recurringMaxAgeMs > 0 && createdAt - startedAt >= this.recurringMaxAgeMs) {
      if (!chain?.agedOut) this.wakeupChains.set(prompt, {
        startedAt,
        lastScheduledFor: createdAt - (WAKEUP_MAX_SECONDS - WAKEUP_MIN_SECONDS) * 1000,
        agedOut: true,
      });
      return { scheduledFor: 0, clampedDelaySeconds: 0, wasClamped: false };
    }
    const clamped = Math.min(WAKEUP_MAX_SECONDS, Math.max(WAKEUP_MIN_SECONDS, Math.round(delaySeconds)));
    const timing = this.jitter ? dynamicWakeupTiming(delaySeconds, createdAt)
      : { clamped, wasClamped: clamped !== delaySeconds, targetMs: createdAt + clamped * 1000, createdAt };
    const id = this.jitter ? newWakeupId() : randomUUID();
    const target = new Date(timing.targetMs);
    const cron = `${target.getMinutes()} ${target.getHours()} * * *`;
    this.dynamic = {
      id,
      prompt,
      scheduledFor: timing.targetMs,
      createdAt: timing.createdAt,
      chainStartedAt: startedAt,
      nextAt: this.jitter ? nextOneShotFire(cron, timing.createdAt, id) ?? Infinity : timing.targetMs,
      ...(reason !== undefined ? { reason } : {}),
      ...(viaKeepalive ? { keepalive: true } : {}),
    };
    this.wakeupChains.set(prompt, { startedAt, lastScheduledFor: this.dynamic.scheduledFor });
    if (viaKeepalive) this.consecutiveKeepalives++;
    return { scheduledFor: this.dynamic.scheduledFor, clampedDelaySeconds: timing.clamped, wasClamped: timing.wasClamped };
  }

  /** The armed dynamic wakeup, or null. */
  getWakeup(): DynamicWakeup | null {
    return this.dynamic ? { ...this.dynamic } : null;
  }

  /** T2o/N8n [1671,2208)/[4928,5325), chunk-68g5e6vr.js forget cancelled prompts. */
  stop(): boolean {
    const had = this.dynamic !== null;
    if (this.dynamic) this.wakeupChains.delete(this.dynamic.prompt);
    for (const prompt of this.deliveredWakeups.values()) this.wakeupChains.delete(prompt);
    if (this.inFlightWakeup !== null) this.wakeupChains.delete(this.inFlightWakeup.prompt);
    this.dynamic = null;
    this.deliveredWakeups.clear();
    this.inFlightWakeup = null;
    this.consecutiveKeepalives = 0;
    return had;
  }

  /** Ie [17435,19295), chunk-appb2dtz.js carries task identity through the host's extra queue. */
  beginWakeup(id: string): boolean {
    const prompt = this.deliveredWakeups.get(id);
    if (prompt === undefined) return false;
    this.inFlightWakeup = { id, prompt };
    return true;
  }

  /** Ie [19175,19294), chunk-appb2dtz.js; C2o [1437,1642), chunk-68g5e6vr.js budgets one fallback. */
  finishWakeup(id: string): void {
    this.deliveredWakeups.delete(id);
    if (this.inFlightWakeup?.id !== id) return;
    const prompt = this.inFlightWakeup.prompt;
    this.inFlightWakeup = null;
    if (this.closed || this.dynamic !== null || !this.keepalive() || this.consecutiveKeepalives >= 1) return;
    this.armWakeup(1200, prompt, undefined, true);
  }

  /**
   * Fire every due cron job and the dynamic wakeup. Idempotent within an
   * occurrence: advancing a job to a strictly-future `nextAt` (or deleting it)
   * guarantees a repeated tick never re-fires the same occurrence. Returns the
   * events emitted this tick; `onPrompt` is invoked once per event.
   */
  tick(): SchedulerEvent[] {
    if (this.closed) return [];
    if (this.storeClosing) return [];
    // x0r.ne [7616,7735), chunk-jrz2zk22.js releases the lease when input ownership ends.
    if (this.storeLease === 'held' && !this.leaseFileTasks()) {
      this.storeLease = 'waiting';
      void this.storeOperation(() => releaseSchedulerLock(this.store!.workspace, this.storeSessionId));
    }
    // x0r.ne [7616,7735), chunk-jrz2zk22.js: leave deadlines and file rows untouched while busy.
    if (this.isLoading() && !this.assistantMode) return [];
    const now = this.now();
    const firedAt = now instanceof Date ? now.getTime() : NaN;
    if (!Number.isFinite(firedAt)) return []; // invalid clock: no-op, never throw from a timer
    const emitted: SchedulerEvent[] = [];
    // Source `b`/`w`: durable recurring fires are stamped, durable one-shot and aged-out jobs are
    // removed from the store once they have fired.
    const fired: string[] = [];
    const removed: string[] = [];

    // `ne` [7616,9890): ke runs before b creates or retains an id-keyed deadline.
    const due: ScheduledJob[] = [];
    for (const job of this.jobs.values()) {
      if (!this.filter('cron') || this.deliveredFileTasks.has(job.id)) continue;
      if (job.durable) {
        if (!this.creators!.eligible(job, this.hasStoreLock())) { this.fileDeadlines.delete(job.id); continue; }
        if (!this.fileDeadlines.has(job.id)) {
          const parsed = parseCron(job.cron);
          const from = job.recurring ? (job.lastFiredAt ?? job.createdAt) : job.createdAt;
          const next = parsed && nextOccurrence(parsed, new Date(from));
          job.nextAt = next ? this.fireTime(job, parsed!, next.getTime(), from) : Infinity;
          this.fileDeadlines.add(job.id);
        }
      }
      if (job.nextAt <= firedAt) due.push(job);
    }
    due.sort((a, b) => a.nextAt - b.nextAt || a.createdAt - b.createdAt);

    for (const job of due) {
      if (!this.jobs.has(job.id)) continue; // already handled this tick
      const dueAt = job.nextAt; // the occurrence being fired, before any reschedule
      if (!job.recurring) {
        const delivered = this.emit(job.prompt, job.id, emitted, { kind: 'cron', dueAt, firedAt, recurring: false });
        this.jobs.delete(job.id);
        if (job.durable) {
          this.deliveredFileTasks.add(job.id);
          if (delivered) removed.push(job.id);
        }
        continue;
      }
      if (agedOut(job, firedAt, this.recurringMaxAgeMs)) {
        // Final fire at/after the expiry age, then delete.
        this.jobs.delete(job.id);
        if (job.durable) { this.deliveredFileTasks.add(job.id); removed.push(job.id); }
        this.emit(job.prompt, job.id, emitted, { kind: 'cron', dueAt, firedAt, recurring: true });
        continue;
      }
      const parsed = parseCron(job.cron);
      const next = parsed ? nextOccurrence(parsed, new Date(firedAt)) : null;
      // b [7731,9544), chunk-jrz2zk22.js, UTF-16 retains unresolved recurring rows and stamps the fire.
      job.nextAt = next ? this.fireTime(job, parsed!, next.getTime(), firedAt) : Infinity;
      this.emit(job.prompt, job.id, emitted, { kind: 'cron', dueAt, firedAt, recurring: true });
      if (job.durable) { job.lastFiredAt = firedAt; fired.push(job.id); }
    }

    // ne.b [7616,9890), chunk-jrz2zk22.js uses E0n for the source loop's actual deadline.
    if (this.dynamic && this.filter('wakeup') && this.dynamic.nextAt <= firedAt) {
      const wakeup = this.dynamic;
      this.dynamic = null;
      // Ie.onFireTask [18384,18879), chunk-appb2dtz.js retains the original prompt through the turn.
      this.deliveredWakeups.set(wakeup.id, wakeup.prompt);
      this.emit(wakeup.prompt, wakeup.id, emitted, { kind: 'wakeup', dueAt: wakeup.nextAt, firedAt });
    }

    // Source `bds`: a durable recurring task records the fire that just happened, so a later
    // process resumes from the last fire instead of replaying it.
    if (this.store !== undefined && (fired.length > 0 || removed.length > 0)) {
      void this.storeOperation(async () => {
        await stampStoredTasks(this.store!.workspace, fired, firedAt);
        await removeStoredTasks(this.store!.workspace, removed);
      });
    }
    return emitted;
  }

  /** Clear all jobs and the wakeup, and stop the timer. */
  close(): Promise<void> {
    if (!this.closed) {
      this.closed = true;
      this.jobs.clear();
      this.fileDeadlines.clear();
      this.dynamic = null;
      // he.reset [34628,35290), chunk-4bw62nzm.js clears session-owned chain history.
      this.wakeupChains.clear();
      this.deliveredWakeups.clear();
      this.inFlightWakeup = null;
      this.consecutiveKeepalives = 0;
      if (this.timer && this.timerHandle !== undefined) {
        this.timer.clearInterval(this.timerHandle);
        this.timerHandle = undefined;
      }
    }
    return this.detachStore();
  }

  /** Whether {@link LocalScheduler.close} has run. */
  isClosed(): boolean {
    return this.closed;
  }

  // b [7731,9544) / Ee [11998,12190), chunk-jrz2zk22.js, UTF-16: outcome owns retention;
  // diagnostic conversion has a fixed fallback. Host string adaptation: research/ports/W318-scheduler-delivery-recovery.md.
  private emit(
    prompt: string,
    id: string,
    sink: SchedulerEvent[],
    meta: { kind: 'cron' | 'wakeup'; dueAt: number; firedAt: number; recurring?: boolean },
  ): boolean {
    const event: SchedulerEvent = {
      id,
      prompt,
      kind: meta.kind,
      dueAt: meta.dueAt,
      firedAt: meta.firedAt,
    };
    if (meta.recurring !== undefined) event.recurring = meta.recurring;
    sink.push(event);
    try {
      this.onPrompt(prompt, id, meta.kind);
      return true;
    } catch (error) {
      try {
        event.callbackError = error instanceof Error ? error.message : String(error);
      } catch {
        event.callbackError = 'scheduled task handler threw (message not reported: it may contain user text)';
      }
      return false;
    }
  }

  private fireTime(job: ScheduledJob, parsed: ParsedCron, nominal: number, after: number): number {
    if (!this.jitter) return nominal;
    // The recovered arm (chunk-atzjaveb.js `L9t`/`E0n`): recurring jobs spread later by a
    // fraction of their interval, one-shot jobs landing on :00/:30 fire early.
    const recovered = job.recurring
      ? nextRecurringFire(job.cron, after, job.id)
      : nextOneShotFire(job.cron, job.createdAt, job.id);
    return recovered ?? nominal;
  }

  /** Current time in epoch ms; throws code 1 when the clock is not a valid Date. */
  private clock(): number {
    const date = this.now();
    const ms = date instanceof Date ? date.getTime() : NaN;
    if (!Number.isFinite(ms)) throw new SchedulerError('clock returned an invalid date.', 1);
    return ms;
  }
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export type SchedulerToolName = 'cron_create' | 'cron_delete' | 'cron_list' | 'schedule_wakeup';

/** JSON-schema-typed compact input schema. */
export interface SchedulerToolSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
  additionalProperties?: boolean;
}

/** A single tool descriptor with a total (non-throwing) `run`. */
export interface SchedulerTool {
  name: SchedulerToolName;
  description: string;
  input_schema: SchedulerToolSchema;
  run(input: Record<string, unknown>): SchedulerToolResult;
}

export interface SchedulerToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  code?: number;
}

export type SchedulerTools = Record<SchedulerToolName, SchedulerTool>;

function errorResult(error: unknown): SchedulerToolResult {
  if (error instanceof SchedulerError) return { ok: false, error: error.message, code: error.code };
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message, code: 0 };
}

// Strict input helpers: reject non-objects, unknown keys and wrong types. They
// throw SchedulerError code 1, contained by each tool's own try/catch.
function asObject(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new SchedulerError('input must be an object.', 1);
  }
  return input as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new SchedulerError(`unknown property '${key}'.`, 1);
  }
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new SchedulerError(`${name} must be a boolean.`, 1);
  return value;
}

function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new SchedulerError(`${name} must be a string.`, 1);
  return value;
}

/**
 * Build the four scheduling tools over a scheduler. Schemas match the originals
 * compactly; `run` never throws (validation failures return `{ok:false,code}`),
 * and every result is a plain object the outer loop can enqueue safely.
 */
export function createSchedulerTools(scheduler: LocalScheduler, options: { legacyWakeup?: boolean } = {}): SchedulerTools {
  const cron_create: SchedulerTool = {
    name: 'cron_create',
    description:
      'Schedule a prompt to be enqueued at a future time. Uses standard 5-field cron in local time: ' +
      'minute hour day-of-month month day-of-week. recurring defaults to true; recurring:false fires once ' +
      'then auto-deletes. Recurring jobs auto-expire after 7 days. durable:true persists the job to the ' +
      'harness store so it survives a restart; otherwise the job is session-only.',
    input_schema: {
      type: 'object',
      properties: {
        cron: {
          type: 'string',
          description: 'Standard 5-field cron expression in local time: "M H DoM Mon DoW" (e.g. "*/5 * * * *").',
        },
        prompt: { type: 'string', description: 'The prompt to enqueue at each fire time.' },
        recurring: {
          type: 'boolean',
          description: 'true (default) = fire on every match until deleted or auto-expired after 7 days. false = fire once, then auto-delete.',
        },
        durable: {
          type: 'boolean',
          description: 'true = persist to the harness store and survive restarts. false (default) = in-memory only, gone when the session ends.',
        },
      },
      required: ['cron', 'prompt'],
      additionalProperties: false,
    },
    run(input) {
      try {
        const value = asObject(input);
        assertOnlyKeys(value, ['cron', 'prompt', 'recurring', 'durable']);
        if (typeof value.cron !== 'string') throw new SchedulerError('cron must be a string.', 1);
        if (typeof value.prompt !== 'string') throw new SchedulerError('prompt must be a string.', 1);
        const recurring = optionalBoolean(value.recurring, 'recurring');
        const durable = optionalBoolean(value.durable, 'durable');
        const job = scheduler.create({ cron: value.cron, prompt: value.prompt, recurring, durable });
        return {
          ok: true,
          data: {
            id: job.id,
            cron: job.cron,
            humanSchedule: job.humanSchedule,
            recurring: job.recurring,
            durable: job.durable,
            nextAt: job.nextAt,
          },
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const cron_delete: SchedulerTool = {
    name: 'cron_delete',
    description: 'Cancel a scheduled cron job by ID. Removes it from the in-memory session store.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The job id returned by cron_create.' } },
      required: ['id'],
      additionalProperties: false,
    },
    run(input) {
      try {
        const value = asObject(input);
        assertOnlyKeys(value, ['id']);
        if (typeof value.id !== 'string' || value.id.length === 0) {
          throw new SchedulerError('id must be a non-empty string.', 1);
        }
        return { ok: true, data: { id: value.id, deleted: scheduler.delete(value.id) } };
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const cron_list: SchedulerTool = {
    name: 'cron_list',
    description: 'List all cron jobs scheduled in this session.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run(input) {
      try {
        assertOnlyKeys(asObject(input), []);
        return {
          ok: true,
          data: {
            jobs: scheduler.list().map((job) => ({
              id: job.id,
              cron: job.cron,
              humanSchedule: job.humanSchedule,
              prompt: job.prompt,
              recurring: job.recurring,
              durable: job.durable,
              nextAt: job.nextAt,
            })),
          },
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  const schedule_wakeup: SchedulerTool = {
    name: 'schedule_wakeup',
    description:
      'Arm a single dynamic wakeup: fire a prompt once after a delay. delaySeconds is clamped to [60, 3600]. ' +
      'Arming replaces any previous wakeup. Pass stop:true to clear it. Cron jobs are unaffected.',
    input_schema: {
      type: 'object',
      properties: {
        delaySeconds: { type: 'number', description: 'Seconds from now to wake up. Clamped to [60, 3600]. Required unless stop is true.' },
        prompt: { type: 'string', description: 'The prompt to fire on wake-up. Required unless stop is true.' },
        reason: { type: 'string', description: 'One short sentence explaining the chosen delay.' },
        stop: { type: 'boolean', description: 'true = clear the dynamic wakeup instead of arming one.' },
        ...(!options.legacyWakeup ? { noop: { type: 'boolean', description: 'Whether this tick changed nothing. Required unless stop is true.' } } : {}),
      },
      additionalProperties: false,
    },
    // yo.call [46241,50040), chunk-tar639dc.js returns a terminal result even with no pending slot.
    run(input) {
      try {
        const value = asObject(input);
        assertOnlyKeys(value, ['delaySeconds', 'prompt', 'reason', 'stop', 'noop']);
        const stop = optionalBoolean(value.stop, 'stop');
        if (stop === true) {
          const cancelledWakeups = scheduler.stop() ? 1 : 0;
          return { ok: true, data: { scheduledFor: 0, clampedDelaySeconds: 0, wasClamped: false,
            stopped: true, cancelledWakeups } };
        }
        const reason = optionalString(value.reason, 'reason');
        const noop = optionalBoolean(value.noop, 'noop');
        if (!options.legacyWakeup && (reason === undefined || noop === undefined)) {
          throw new SchedulerError('reason and noop are required unless stop is true.', 1);
        }
        if (typeof value.delaySeconds !== 'number' || !Number.isFinite(value.delaySeconds)) {
          throw new SchedulerError('delaySeconds must be a finite number in [60, 3600] unless stop is true.', 1);
        }
        if (typeof value.prompt !== 'string' || value.prompt.length === 0) {
          throw new SchedulerError('prompt must be a non-empty string unless stop is true.', 1);
        }
        const result = scheduler.scheduleWakeup(value.delaySeconds, value.prompt, reason);
        return {
          ok: true,
          data: {
            scheduledFor: result.scheduledFor,
            clampedDelaySeconds: result.clampedDelaySeconds,
            wasClamped: result.wasClamped,
            stopped: false,
          },
        };
      } catch (error) {
        return errorResult(error);
      }
    },
  };

  return { cron_create, cron_delete, cron_list, schedule_wakeup };
}
