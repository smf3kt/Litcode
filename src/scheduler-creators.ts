// Je/Pe/he/Le/ke [4566,6337), chunk-jrz2zk22.js SHA-256
// da64f780f2b184a92cd87a21d03c8a02ca80ec4124edf791eccd988a67c980a3.
// $$e/Hue/lse [4509,4634)/[5100,5209)/[5307,5366), chunk-3sda67c1.js SHA-256
// 285259b1c6dcf821a48f703d5fb866a9f69e9b52f19a235a9ae68f7dd7384cef.
// Coordinates are half-open zero-based UTF-16. Host transcript paths replace Oh(project).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { StoredTask } from './scheduler-store.js';

function processBirth(pid: number): string | undefined {
  try {
    const value = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
      timeout: 1000, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    });
    return value ? value.trim() : undefined;
  } catch { return undefined; }
}

let ownBirth: string | undefined;
export function schedulerProcessBirth(): string | undefined {
  return ownBirth ??= processBirth(process.pid);
}

function processAlive(pid: number): boolean {
  if (pid <= 1) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function projectIdentity(project: string): string {
  return project.replaceAll('\\', '/').toLowerCase();
}

export class TaskCreators {
  private legacySessions = new Set<string>();
  private readonly births = new Map<number, { at: number; token: string | undefined }>();

  constructor(private readonly context: {
    workspace: string;
    sessionId: string;
    sessionIds?: ReadonlySet<string>;
    transcriptDirectory?: string;
  }) {
    schedulerProcessBirth();
  }

  async readTranscripts(tasks: readonly StoredTask[]): Promise<void> {
    const sessions = new Set(tasks.filter(task => task.createdInProject === undefined)
      .map(task => task.createdBySessionId).filter(id => id !== undefined && id !== this.context.sessionId));
    const found = new Set<string>();
    const directory = this.context.transcriptDirectory ?? path.join(this.context.workspace, '.agent');
    await Promise.all([...sessions].map(async id => {
      if (id === undefined || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
      if (await fs.lstat(path.join(directory, `${id}.jsonl`)).then(stat => stat.isFile(), () => false)) found.add(id);
    }));
    this.legacySessions = found;
  }

  private departed(pid: number, token: string | undefined): boolean {
    if (!processAlive(pid)) { this.births.delete(pid); return true; }
    if (token === undefined) return false;
    const now = Date.now();
    let birth = this.births.get(pid);
    if (!birth || now - birth.at >= 60_000) {
      birth = { at: now, token: processBirth(pid) };
      this.births.set(pid, birth);
    }
    return birth.token !== undefined && birth.token !== token;
  }

  eligible(task: StoredTask, lease: boolean): boolean {
    const creator = task.createdBySessionId;
    if (creator === undefined) return lease;
    if (creator === this.context.sessionId) return true;
    if (this.context.sessionIds?.has(creator) && task.createdByPid === process.pid &&
      (task.createdByProcStart === undefined ? task.createdAt >= performance.timeOrigin : task.createdByProcStart === ownBirth)) return true;
    const sameProject = task.createdInProject === undefined ? this.legacySessions.has(creator)
      : projectIdentity(task.createdInProject) === projectIdentity(this.context.workspace);
    return lease && sameProject && (task.createdByPid === undefined || this.departed(task.createdByPid, task.createdByProcStart));
  }
}
