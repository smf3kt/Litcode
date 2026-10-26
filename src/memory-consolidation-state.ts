import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const stateSchema = z.object({ version: z.literal(1), lastConsolidatedAt: z.number().finite().nonnegative() }).strict();
const lockSchema = z.object({ pid: z.number().int().positive(), token: z.string().uuid() }).strict();
const STATE = 'memory-consolidation.json';
const STALE_PUBLICATION_MS = 3600000;
const PUBLICATION = /^\.memory-consolidation-lease-([1-9][0-9]*)-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.tmp$/;

type Snapshot = { bytes: Buffer; dev: number; ino: number; mtimeMs: number };
export type MemoryConsolidationLease = {
  readonly prior: number;
  readonly acquiredAt: number;
  complete(): void;
  release(): void;
};

function absent(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function directory(workspace: string, create = false): string | undefined {
  const root = fs.realpathSync(workspace);
  const target = path.join(root, '.harness');
  if (create) {
    try { fs.mkdirSync(target, { mode: 0o700 }); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
  }
  let stat: fs.Stats;
  try { stat = fs.lstatSync(target); } catch (error) { if (absent(error)) return; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(target) !== target) throw new Error('Memory consolidation directory is aliased');
  return target;
}

function read(file: string, maxLinks = 1): Snapshot | undefined {
  let fd: number;
  try { fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (error) { if (absent(error)) return; throw error; }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink < 1 || stat.nlink > maxLinks || stat.size > 16384) throw new Error('Invalid memory consolidation state file');
    return { bytes: fs.readFileSync(fd), dev: stat.dev, ino: stat.ino, mtimeMs: stat.mtimeMs };
  } finally { fs.closeSync(fd); }
}

function same(left: Snapshot | undefined, right: Snapshot | undefined): boolean {
  return left === undefined ? right === undefined : right !== undefined && left.dev === right.dev && left.ino === right.ino &&
    left.mtimeMs === right.mtimeMs && left.bytes.equals(right.bytes);
}

function stamp(value: Snapshot | undefined): number {
  return value === undefined ? 0 : stateSchema.parse(JSON.parse(value.bytes.toString('utf8'))).lastConsolidatedAt;
}

function holder(value: Snapshot): z.infer<typeof lockSchema> | undefined {
  let parsed: unknown;
  try { parsed = JSON.parse(value.bytes.toString('utf8')); } catch { return; }
  const result = lockSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

function live(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return !(error instanceof Error && 'code' in error && error.code === 'ESRCH'); }
}

// S/x, 2dvx15ja [2725,3573), UTF-16; a stable SQLite transaction replaces StorageV5 conditional ownership.
function acquireMutex(base: string): { check(): void; release(): void } | undefined {
  const sqlite = process.getBuiltinModule?.('node:sqlite');
  if (!sqlite?.DatabaseSync) throw new Error('Memory consolidation requires the node:sqlite DatabaseSync runtime');
  const file = path.join(base, 'memory-consolidation.sqlite');
  let stat: fs.Stats;
  try { stat = fs.lstatSync(file); }
  catch (error) {
    if (!absent(error)) throw error;
    try { fs.closeSync(fs.openSync(file, 'wx', 0o600)); }
    catch (created) { if (!(created instanceof Error && 'code' in created && created.code === 'EEXIST')) throw created; }
    stat = fs.lstatSync(file);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Memory consolidation mutex is aliased');
  const database = new sqlite.DatabaseSync(file);
  try { database.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE'); }
  catch (error) {
    database.close();
    if (error instanceof Error && 'errcode' in error && (error.errcode === 5 || error.errcode === 6)) return;
    throw error;
  }
  let closed = false;
  const check = () => {
    const current = fs.lstatSync(file);
    if (closed || current.dev !== stat.dev || current.ino !== stat.ino || current.nlink !== 1 || current.isSymbolicLink()) {
      throw new Error('Memory consolidation mutex changed');
    }
  };
  try { check(); }
  catch (error) { database.close(); throw error; }
  return {
    check,
    release() {
      if (closed) return;
      closed = true;
      try { database.exec('ROLLBACK'); } finally { database.close(); }
    },
  };
}

function recoverPublications(base: string): void {
  for (const name of fs.readdirSync(base)) {
    const match = PUBLICATION.exec(name);
    if (!match || live(Number(match[1]))) continue;
    const file = path.join(base, name);
    const snapshot = read(file, 2);
    if (!snapshot) continue;
    const owner = holder(snapshot);
    if (owner && (owner.pid !== Number(match[1]) || owner.token !== match[2])) continue;
    if (same(snapshot, read(file, 2))) fs.unlinkSync(file);
  }
}

// I7e, 2dvx15ja [1573,1839), UTF-16; this host stores the timestamp separately from the active lease.
export function lastMemoryConsolidation(workspace: string): number {
  const base = directory(workspace);
  return base === undefined ? 0 : stamp(read(path.join(base, STATE)));
}

// L/C/S, 2dvx15ja [1878,2423)/[2466,3342), UTF-16; serialize recovery and complete ownership publication.
export function acquireMemoryConsolidation(workspace: string, acquiredAt = Date.now()): MemoryConsolidationLease | undefined {
  const base = directory(workspace, true)!;
  const mutex = acquireMutex(base);
  if (!mutex) return;
  let transferred = false;
  try {
    const file = path.join(base, STATE);
    const lock = file + '.lock';
    recoverPublications(base);
    const held = read(lock, 2);
    if (held) {
      const current = holder(held);
      if (current ? live(current.pid) : Date.now() - held.mtimeMs < STALE_PUBLICATION_MS) return;
      if (!same(held, read(lock, 2))) return;
      fs.unlinkSync(lock);
    }
    const token = crypto.randomUUID();
    const temporary = path.join(base, `.memory-consolidation-lease-${process.pid}-${token}.tmp`);
    const bytes = Buffer.from(JSON.stringify({ pid: process.pid, token }));
    const fd = fs.openSync(temporary, 'wx', 0o600);
    const created = fs.fstatSync(fd);
    let open = true;
    let published = false;
    let owner: Snapshot | undefined;
    let previous: Snapshot | undefined;
    try {
      fs.writeFileSync(fd, bytes);
      fs.fsyncSync(fd);
      const stat = fs.fstatSync(fd);
      owner = { bytes, dev: stat.dev, ino: stat.ino, mtimeMs: stat.mtimeMs };
      fs.closeSync(fd); open = false;
      try { fs.linkSync(temporary, lock); }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return;
        throw error;
      }
      published = true;
      fs.unlinkSync(temporary);
      if (!same(owner, read(lock))) throw new Error('Memory consolidation lease changed');
      previous = read(file);
      stamp(previous);
      const memory = path.join(base, 'memory');
      try { fs.mkdirSync(memory, { mode: 0o700 }); }
      catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
      const memoryStat = fs.lstatSync(memory);
      if (memoryStat.isSymbolicLink() || !memoryStat.isDirectory()) throw new Error('Memory directory is aliased');
    } catch (error) {
      if (published && owner && same(owner, read(lock, 2))) fs.unlinkSync(lock);
      throw error;
    } finally {
      if (open) fs.closeSync(fd);
      try {
        const current = fs.lstatSync(temporary);
        if (current.dev === created.dev && current.ino === created.ino && !current.isSymbolicLink()) fs.unlinkSync(temporary);
      } catch (error) { if (!absent(error)) throw error; }
    }
    let released = false;
    const check = () => {
      mutex.check();
      if (released || directory(workspace) !== base || !same(owner, read(lock))) throw new Error('Memory consolidation lease changed');
    };
    const lease: MemoryConsolidationLease = {
      prior: stamp(previous), acquiredAt,
      complete() {
        check();
        if (!same(previous, read(file))) throw new Error('Memory consolidation stamp changed');
        const temporary = path.join(base, `.memory-consolidation-${crypto.randomUUID()}.tmp`);
        let output: number | undefined;
        try {
          output = fs.openSync(temporary, 'wx', 0o600);
          fs.writeFileSync(output, JSON.stringify({ version: 1, lastConsolidatedAt: acquiredAt }) + '\n');
          fs.fsyncSync(output); fs.closeSync(output); output = undefined;
          check();
          if (!same(previous, read(file))) throw new Error('Memory consolidation stamp changed');
          fs.renameSync(temporary, file);
          const directoryFd = fs.openSync(base, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
          try { fs.fsyncSync(directoryFd); } finally { fs.closeSync(directoryFd); }
        } finally {
          if (output !== undefined) fs.closeSync(output);
          try { fs.unlinkSync(temporary); } catch (error) { if (!absent(error)) throw error; }
        }
      },
      release() {
        if (released) return;
        try { check(); fs.unlinkSync(lock); }
        finally { released = true; mutex.release(); }
      },
    };
    transferred = true;
    return lease;
  } finally { if (!transferred) mutex.release(); }
}
