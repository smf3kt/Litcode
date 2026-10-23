/**
 * The durable half of the session scheduler: `scheduled_tasks.json` and its lock.
 *
 * Recovered from `chunk-atzjaveb.js`, sha256
 * `71378d5821cac631dfe41fe2db138ed7853b6008545668f423b89cbf4d060a2a` — the store path `RCe` at
 * [5187,5276), the reader `D9t` at [5276,6340), the atomic writer `w0n` at [6340,6991) and the
 * session-registering create `Pot` at [6991,7366). Also `chunk-jrz2zk22.js`, sha256
 * `da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3` — the lock path `U`, the
 * lock schema `Ne`, the lock reader `Fe`, the exclusive create `Ie`, the acquire `de` at
 * [3263,4046), the release `N` at [4046,4236), the aged-out test `He` at [4469,4560) and the
 * missed-task prompt `Ke` at [11476,11900). Offsets are zero-based UTF-16 code units.
 *
 * The source stores under `<project>/.claude/`; this harness's own state directory is
 * `.harness`, so the store keeps the file name and lock name and changes only the parent.
 * Two source gates have no counterpart here and are recorded as limitations in the port
 * record: `b0n` (durable refused under `--project-config-root`) and `mso`/`Pfr` (durable
 * refused under restricted workspace roots or teammate mode). Neither option exists in this
 * host, so both resolve to "durable is available".
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { HARNESS_DIR } from './config.js';
import { processGone, processStart } from './local-peer.js';
import { writeFileWithAtomicOptions } from './plugin-chain-atomic.js';
import { describeCron, nextOccurrence, parseCron } from './scheduler.js';

/** The store's file name inside the harness directory (`A` in `chunk-atzjaveb.js`). */
export const SCHEDULED_TASKS_FILE = 'scheduled_tasks.json';
/** The lock's file name beside it (`De`). */
export const SCHEDULED_TASKS_LOCK = 'scheduled_tasks.lock';
/** The staging directory the atomic writer publishes from (`rU`). */
const STAGING_DIR = '.writes';

/**
 * One stored task (`D9t`'s accepted shape). `recurring` and `permanent` are written only when
 * true, matching the source's conditional spread; `durable` is never stored.
 */
export interface StoredTask {
  id: string;
  cron: string;
  prompt: string;
  createdAt: number;
  lastFiredAt?: number;
  recurring?: boolean;
  permanent?: boolean;
  createdBySessionId?: string;
  createdByPid?: number;
  createdByProcStart?: string;
  createdInProject?: string;
}

/** The lock's record (`Ne`). */
export interface SchedulerLock {
  sessionId: string;
  pid: number;
  procStart?: string;
  acquiredAt: number;
}

/** The store's directory: the workspace's harness directory. */
export function scheduledTasksDir(workspace: string): string {
  return path.join(workspace, HARNESS_DIR);
}

/** Source `RCe`: the store file. */
export function scheduledTasksPath(workspace: string): string {
  return path.join(scheduledTasksDir(workspace), SCHEDULED_TASKS_FILE);
}

/** Source `U`: the lock file. */
export function schedulerLockPath(workspace: string): string {
  return path.join(scheduledTasksDir(workspace), SCHEDULED_TASKS_LOCK);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Source `D9t`: read the store. A missing file is an empty list; a malformed entry is skipped
 * (the source logs and continues), and an entry whose cron does not parse is skipped too.
 */
export async function readStoredTasks(workspace: string): Promise<StoredTask[]> {
  let text: string;
  try {
    text = await fsp.readFile(scheduledTasksPath(workspace), 'utf8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (parsed === null || typeof parsed !== 'object') return [];
  const tasks = (parsed as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return [];
  const accepted: StoredTask[] = [];
  for (const raw of tasks) {
    if (raw === null || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== 'string' || typeof entry.cron !== 'string'
      || typeof entry.prompt !== 'string' || typeof entry.createdAt !== 'number') continue;
    if (parseCron(entry.cron) === null) continue;
    const task: StoredTask = { id: entry.id, cron: entry.cron, prompt: entry.prompt, createdAt: entry.createdAt };
    const lastFiredAt = optionalNumber(entry.lastFiredAt);
    if (lastFiredAt !== undefined) task.lastFiredAt = lastFiredAt;
    if (entry.recurring === true) task.recurring = true;
    if (entry.permanent === true) task.permanent = true;
    const session = optionalString(entry.createdBySessionId);
    if (session !== undefined) task.createdBySessionId = session;
    const pid = optionalNumber(entry.createdByPid);
    if (pid !== undefined) task.createdByPid = pid;
    const procStart = optionalString(entry.createdByProcStart);
    if (procStart !== undefined) task.createdByProcStart = procStart;
    const project = optionalString(entry.createdInProject);
    if (project !== undefined) task.createdInProject = project;
    accepted.push(task);
  }
  return accepted;
}

/**
 * Source `w0n`: publish the store atomically. The directory is created when absent, the file is
 * written through the shared atomic writer with the harness directory's own modes, and `durable`
 * is stripped from every record.
 */
export async function writeStoredTasks(workspace: string, tasks: readonly StoredTask[]): Promise<void> {
  const directory = scheduledTasksDir(workspace);
  await fsp.mkdir(directory, { recursive: true });
  const body = { tasks: tasks.map(({ ...task }) => task) };
  await writeFileWithAtomicOptions(scheduledTasksPath(workspace), `${JSON.stringify(body, null, 2)}\n`, {
    stagingDir: path.join(directory, STAGING_DIR),
  });
}

/** Source `Pot`'s id: the first eight hex characters of a fresh UUID. */
export function newTaskId(): string {
  return randomUUID().slice(0, 8);
}

/** Source `Fe`: the lock record, or undefined when absent or unreadable. */
export async function readSchedulerLock(workspace: string): Promise<SchedulerLock | undefined> {
  let text: string;
  try {
    text = await fsp.readFile(schedulerLockPath(workspace), 'utf8');
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== 'object') return undefined;
  const entry = parsed as Record<string, unknown>;
  if (typeof entry.sessionId !== 'string' || typeof entry.pid !== 'number'
    || typeof entry.acquiredAt !== 'number') return undefined;
  const lock: SchedulerLock = { sessionId: entry.sessionId, pid: entry.pid, acquiredAt: entry.acquiredAt };
  const procStart = optionalString(entry.procStart);
  if (procStart !== undefined) lock.procStart = procStart;
  return lock;
}

/** Source `Ie`: an exclusive create; `EEXIST` means someone else holds it. */
async function createLock(file: string, body: SchedulerLock): Promise<boolean> {
  try {
    await fsp.writeFile(file, JSON.stringify(body), { flag: 'wx' });
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') return false;
    if (code === 'ENOENT') {
      await fsp.mkdir(path.dirname(file), { recursive: true });
      try {
        await fsp.writeFile(file, JSON.stringify(body), { flag: 'wx' });
        return true;
      } catch (retry) {
        if ((retry as NodeJS.ErrnoException).code === 'EEXIST') return false;
        throw retry;
      }
    }
    throw error;
  }
}

export interface LockOptions {
  /** The session identity written into the lock; defaults to a fresh UUID. */
  sessionId?: string;
  /** The process start token; defaults to a fresh lookup. */
  procStart?: string;
}

/**
 * Source `de`: take the lock, keep it when this session already holds it, and recover one left
 * by a process that is gone or has been recycled. Returns whether this session now holds it.
 */
export async function acquireSchedulerLock(workspace: string, options: LockOptions = {}): Promise<boolean> {
  const file = schedulerLockPath(workspace);
  const sessionId = options.sessionId ?? randomUUID();
  const procStart = options.procStart ?? (await processStart(process.pid));
  const body: SchedulerLock = { sessionId, pid: process.pid, acquiredAt: Date.now() };
  if (procStart !== undefined) body.procStart = procStart;
  if (await createLock(file, body)) return true;
  const held = await readSchedulerLock(workspace);
  if (held?.sessionId === sessionId) {
    if (held.pid !== process.pid) await fsp.writeFile(file, JSON.stringify(body));
    return true;
  }
  if (held !== undefined && !processGone(held.pid)) {
    const current = held.procStart === undefined ? undefined : await processStart(held.pid, { skipCache: true });
    if (held.procStart === undefined || current === undefined || current === held.procStart) return false;
  }
  await fsp.unlink(file).catch(() => {});
  return createLock(file, body);
}

/** Source `N`: release the lock only when this session still owns it. */
export async function releaseSchedulerLock(workspace: string, sessionId: string): Promise<void> {
  const held = await readSchedulerLock(workspace);
  if (held === undefined || held.sessionId !== sessionId) return;
  await fsp.unlink(schedulerLockPath(workspace)).catch(() => {});
}

/** Source `He`: a recurring, non-permanent task that has reached its expiry age. */
export function agedOut(task: StoredTask, now: number, maxAgeMs: number): boolean {
  if (maxAgeMs === 0) return false;
  return task.recurring === true && task.permanent !== true && now - task.createdAt >= maxAgeMs;
}

/** Source `wds`: stored tasks whose first occurrence from `createdAt` is already past. */
export function missedTasks(tasks: readonly StoredTask[], now: number): StoredTask[] {
  return tasks.filter((task) => {
    const parsed = parseCron(task.cron);
    if (parsed === null) return false;
    const first = nextOccurrence(parsed, new Date(task.createdAt));
    return first !== null && first.getTime() < now;
  });
}

/** Source `Hzn`: wrap a prompt in a fence longer than any run of backticks it contains. */
function fenced(text: string): string {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  const language = '';
  return `${fence}${language}\n${text}\n${fence}`;
}

/**
 * Source `Ke`: the catch-up prompt for one-shot tasks that came due while the process was not
 * running. The source names `.claude/scheduled_tasks.json`; this harness names its own store.
 */
export function missedTasksPrompt(tasks: readonly StoredTask[], storePath: string): string {
  const plural = tasks.length > 1;
  const lead = `The following one-shot scheduled task${plural ? 's were' : ' was'} missed while the harness was not running. `
    + `${plural ? 'They have' : 'It has'} already been removed from ${storePath}.\n\n`
    + `Do NOT execute ${plural ? 'these prompts' : 'this prompt'} yet. First use the AskUserQuestion tool to ask whether to run `
    + `${plural ? 'each one' : 'it'} now. Only execute if the user confirms.`;
  const rows = tasks.map((task) => `[${describeCron(task.cron)}, created ${new Date(task.createdAt).toLocaleString()}]\n${fenced(task.prompt)}`);
  return `${lead}\n\n${rows.join('\n\n')}`;
}

/** Source `s_e`: drop the given ids from the store, keeping the rest. */
export async function removeStoredTasks(workspace: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  const tasks = await readStoredTasks(workspace);
  const kept = tasks.filter((task) => !drop.has(task.id));
  if (kept.length === tasks.length) return;
  await writeStoredTasks(workspace, kept);
}

/** Source `bds`: stamp `lastFiredAt` on the given ids. */
export async function stampStoredTasks(workspace: string, ids: readonly string[], firedAt: number): Promise<void> {
  if (ids.length === 0) return;
  const stamp = new Set(ids);
  const tasks = await readStoredTasks(workspace);
  let changed = false;
  for (const task of tasks) {
    if (!stamp.has(task.id)) continue;
    task.lastFiredAt = firedAt;
    changed = true;
  }
  if (!changed) return;
  await writeStoredTasks(workspace, tasks);
}

/** Whether the store file exists and holds at least one task (`Pfr`). */
export function storedTasksPresent(workspace: string): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(scheduledTasksPath(workspace), 'utf8')) as { tasks?: unknown };
    return Array.isArray(parsed.tasks) && parsed.tasks.length > 0;
  } catch {
    return false;
  }
}
