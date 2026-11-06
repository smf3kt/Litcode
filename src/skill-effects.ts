// Independent durable journal for skill inline shell effects.
//
// The recovered inline executor does not spawn commands directly: it hands each
// authored span to the tool runtime with a synthetic tool-use id
// (`toolUseId:` at chunk-sfn1dbxq.js offset 3369204, `await y.call({command})`
// at 3370268, the extractor `xxr` at 3370821 over `Gtr` at 434915). The tool
// layer returns results; the recovered body does not establish a durable journal.
// This product executes the spans itself and uses a host-only journal:
// one `started` record is fsynced before the spawn and one terminal record
// after it returns. A record pair is the local counterpart of a tool call and
// its result; the journal is per workspace and owner so it survives the
// process that wrote it.
//
// The journal never stores a command. Its identity is the skill name, the
// authored span index and the SHA-256 of the expanded command, so arguments
// substituted into a span are not persisted here.
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { atomicWriteFile, syncDirectory } from './atomic-write.js';

/** Bounds one owner's journal; a longer history fails closed instead of growing without limit. */
const MAX_JOURNAL_BYTES = 4 * 1024 * 1024;
/** Up to 24 commands in one authored body (the source's own span budget is far smaller). */
const MAX_SPAN_INDEX = 1023;
const OWNER_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
// Host-only recovery rewrite: source iye, chunk-sfn1dbxq [3368429,3370821),
// UTF-16, exposes no journal ownership; share live IDs across journal instances.
const activeEffects = new Map<string, number>();
const retryGrants = new WeakMap<SkillEffectRetryGrant, { file: string; id: string }>();
export type SkillEffectRetryGrant = { readonly kind: 'skill-effect-retry' };
const require = createRequire(import.meta.url);

export function lock(fd: number, wait: boolean): boolean {
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw new Error(`Skill effect lock unsupported on ${process.platform}`);
  let addon: unknown;
  try { addon = require('../native/file-lock/lock.node'); }
  catch (error) { throw new Error(`Skill effect native lock unavailable: ${error instanceof Error ? error.message : String(error)}`); }
  if (typeof addon !== 'object' || addon === null || !('lock' in addon) || typeof addon.lock !== 'function') throw new Error('Skill effect native lock unavailable: invalid binding');
  const result: unknown = addon.lock(fd, wait);
  if (typeof result !== 'boolean') throw new Error('Skill effect native lock returned an invalid result');
  return result;
}

const recordSchema = z.object({
  v: z.literal(1),
  id: z.string().uuid(),
  skill: z.string().min(1).max(256),
  index: z.number().int().min(0).max(MAX_SPAN_INDEX),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  phase: z.enum(['started', 'finished', 'failed', 'unknown']),
  at: z.string().min(1).max(40),
}).strict();
type SkillEffectRecord = z.infer<typeof recordSchema>;
const batchSchema = z.object({ v: z.literal(2), phase: z.literal('unknown_batch'),
  records: z.array(recordSchema.extend({ phase: z.literal('unknown') })).min(1) }).strict();
type SkillEffectBatch = z.infer<typeof batchSchema>;

/** One command whose start was made durable; `finish` closes it. */
export type SkillEffectStart = { id: string; skill: string; index: number; digest: string };
/** A started command with no terminal record and no known local active call. */
export type SkillEffectPending = SkillEffectStart & { at: string };

export class SkillEffectRecoveryError extends Error {
  constructor(readonly journal: SkillEffectJournal, readonly pending: readonly SkillEffectPending[]) {
    super(skillEffectRecoveryMessage(journal.owner, pending));
  }
}

// Host recovery rewrite; iye, chunk-sfn1dbxq [3368429,3370821), UTF-16,
// has no durable notification or journal.
export function skillEffectRecoveryMessage(owner: string, pending: readonly SkillEffectPending[]): string {
  return pending.map(record =>
    `[skill effect recovery: owner ${owner}, effect ${record.id}, command #${record.index} in "${record.skill}", sha256 ${record.digest}] ` +
    'Execution was interrupted after it started. Its effect is unknown. Inspect workspace state before deciding whether to repeat it. To retry explicitly, start a new session and invoke the skill yourself.').join('\n');
}

function digestOf(command: string): string {
  return createHash('sha256').update(command, 'utf8').digest('hex');
}

export class SkillEffectJournal {
  readonly directory: string;
  readonly file: string;

  constructor(workspace: string, readonly owner: string) {
    if (!OWNER_PATTERN.test(owner)) throw new Error('Skill effect journal owner must be a session id');
    this.directory = path.join(workspace, '.agent', 'skill-effects');
    this.file = path.join(this.directory, `${owner}.jsonl`);
  }

  // Host rewrite: iye, chunk-sfn1dbxq [3368429,3370821), UTF-16,
  // contains neither this journal nor a human decision transaction.
  confirmProcessed(id: string): void {
    this.confirmDecision(id, 'processed');
  }

  confirmRetry(id: string): void {
    this.confirmDecision(id, 'retry');
  }

  private confirmDecision(id: string, decision: 'processed' | 'retry'): void {
    if (!z.string().uuid().safeParse(id).success) throw new Error('Invalid skill effect ID');
    this.withMutex(() => {
      const records = this.read();
      const starts = records.filter(record => record.id === id && record.phase === 'started');
      if (starts.length !== 1) throw new Error('Unknown or ambiguous skill effect ID');
      const start = starts[0]!;
      if (!this.pending(start.skill).some(record => record.id === id)) throw new Error('Skill effect is not unresolved');
      const decisionPath = `${this.file}.${id}.decision`;
      const receiptPath = `${this.file}.${id}.decision-receipt`;
      const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
      const state = decision === 'processed'
        ? { owner: this.owner, id, start: digest(start), decision }
        : { owner: this.owner, id, start: digest(start), command: start.digest, decision };
      const receipt = { owner: this.owner, id, decision: digest(state) };
      const existing = fs.existsSync(decisionPath) || fs.existsSync(receiptPath);
      if (!existing) {
        const fd = fs.openSync(this.file, 'r');
        try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        atomicWriteFile(decisionPath, JSON.stringify(state), { mode: 0o600, durable: true });
        atomicWriteFile(receiptPath, JSON.stringify(receipt), { mode: 0o600, durable: true });
      }
      const fds: number[] = [];
      try {
        for (const [file, expected] of [[decisionPath, state], [receiptPath, receipt]] as const) {
          const stat = fs.lstatSync(file);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('Invalid skill effect decision evidence');
          const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); fds.push(fd);
          const opened = fs.fstatSync(fd);
          if (opened.dev !== stat.dev || opened.ino !== stat.ino || fs.readFileSync(fd, 'utf8') !== JSON.stringify(expected)) throw new Error('Skill effect decision evidence mismatch');
          fs.fsyncSync(fd);
        }
        syncDirectory(path.dirname(this.directory));
        syncDirectory(this.directory);
        for (const [index, file] of [decisionPath, receiptPath].entries()) {
          const stat = fs.lstatSync(file), opened = fs.fstatSync(fds[index]!);
          if (!stat.isFile() || stat.isSymbolicLink() || stat.dev !== opened.dev || stat.ino !== opened.ino) throw new Error('Skill effect decision evidence changed');
        }
      } finally { for (const fd of fds) fs.closeSync(fd); }
    });
  }

  // W121 host rewrite: iye sfn1dbxq [3368429,3370821), UTF-16 has no journal.
  // A consumption is deliberately only a durable fence; it does not clear recovery.
  consumeRetry(id: string, skill: string, index: number, command: string): boolean {
    return this.withMutex(() => {
      const records = this.read();
      const skills = new Set(records.filter(record => record.phase === 'started').map(record => record.skill));
      const pending = [...skills].flatMap(name => this.pending(name));
      if (pending.length !== 1 || pending[0]!.id !== id || pending[0]!.skill !== skill ||
          pending[0]!.index !== index || pending[0]!.digest !== digestOf(command)) return false;
      const starts = records.filter(record => record.id === id && record.phase === 'started');
      if (starts.length !== 1) throw new Error('Unknown or ambiguous skill effect ID');
      const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
      const state = { owner: this.owner, id, start: digest(starts[0]), command: starts[0]!.digest, decision: 'retry' };
      const receipt = { owner: this.owner, id, decision: digest(state) };
      for (const [file, expected] of [[`${this.file}.${id}.decision`, state], [`${this.file}.${id}.decision-receipt`, receipt]] as const) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('Invalid skill effect decision evidence');
        const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
          const opened = fs.fstatSync(fd);
          if (opened.dev !== stat.dev || opened.ino !== stat.ino || fs.readFileSync(fd, 'utf8') !== JSON.stringify(expected)) throw new Error('Skill effect decision evidence mismatch');
          fs.fsyncSync(fd);
          const after = fs.lstatSync(file);
          if (after.dev !== opened.dev || after.ino !== opened.ino || !after.isFile() || after.isSymbolicLink()) throw new Error('Skill effect decision evidence changed');
        } finally { fs.closeSync(fd); }
      }
      syncDirectory(path.dirname(this.directory));
      syncDirectory(this.directory);
      const consumption = `${this.file}.${id}.retry-consumed`;
      const fd = fs.openSync(consumption, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
      try {
        const bytes = Buffer.from(JSON.stringify({ owner: this.owner, id, start: state.start, command: state.command, decision: digest(state) }));
        if (fs.writeSync(fd, bytes) !== bytes.length) throw new Error('Short skill effect consumption write');
        fs.fsyncSync(fd);
      } finally { fs.closeSync(fd); }
      syncDirectory(this.directory);
      this.validateConsumption(id, starts[0]!);
      return true;
    });
  }

  consumeRetryGrant(id: string, skill: string, index: number, command: string): SkillEffectRetryGrant | undefined {
    if (!this.consumeRetry(id, skill, index, command)) return undefined;
    const grant: SkillEffectRetryGrant = { kind: 'skill-effect-retry' };
    retryGrants.set(grant, { file: this.file, id });
    return grant;
  }

  private validateConsumption(id: string, start: SkillEffectRecord): void {
    const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const state = { owner: this.owner, id, start: digest(start), command: start.digest, decision: 'retry' };
    const evidence = [
      [`${this.file}.${id}.decision`, state],
      [`${this.file}.${id}.decision-receipt`, { owner: this.owner, id, decision: digest(state) }],
      [`${this.file}.${id}.retry-consumed`, { owner: this.owner, id, start: state.start, command: state.command, decision: digest(state) }],
    ] as const;
    const opened: { file: string; fd: number }[] = [];
    try {
      for (const [file, value] of evidence) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error('Invalid skill effect consumption evidence');
        const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        opened.push({ file, fd });
        const current = fs.fstatSync(fd);
        if (current.dev !== stat.dev || current.ino !== stat.ino || fs.readFileSync(fd, 'utf8') !== JSON.stringify(value)) throw new Error('Skill effect consumption evidence mismatch');
        fs.fsyncSync(fd);
      }
      syncDirectory(path.dirname(this.directory));
      syncDirectory(this.directory);
      for (const { file, fd } of opened) {
        const after = fs.lstatSync(file), current = fs.fstatSync(fd);
        if (!after.isFile() || after.isSymbolicLink() || after.dev !== current.dev || after.ino !== current.ino) throw new Error('Skill effect consumption evidence changed');
      }
    } finally { for (const { fd } of opened) fs.closeSync(fd); }
  }

  /** Commit `started` before the command's first side effect. Returns the record to close. */
  start(skill: string, index: number, command: string, generation?: number, retry?: SkillEffectRetryGrant): SkillEffectStart {
    if (!Number.isInteger(index) || index < 0 || index > MAX_SPAN_INDEX) throw new Error('Skill effect span index is out of bounds');
    if (skill.length === 0 || skill.length > 256) throw new Error('Skill effect name is out of bounds');
    const effect = { id: randomUUID(), skill, index, digest: digestOf(command) };
    const authorization = retry === undefined ? undefined : retryGrants.get(retry);
    if (retry !== undefined) {
      retryGrants.delete(retry);
      if (!authorization || authorization.file !== this.file) throw new Error('Invalid skill effect retry grant');
    }
    this.withMutex(() => {
      const pending = this.pending(skill);
      if (authorization !== undefined) {
        const retryId = authorization.id;
        const records = this.read();
        const all = [...new Set(records.filter(record => record.phase === 'started').map(record => record.skill))].flatMap(name => this.pending(name));
        const starts = records.filter(record => record.id === retryId && record.phase === 'started');
        if (all.length !== 1 || all[0]?.id !== retryId || all[0]?.skill !== skill || all[0]?.index !== index || all[0]?.digest !== effect.digest || starts.length !== 1) throw new SkillEffectRecoveryError(this, all);
        this.validateConsumption(retryId, starts[0]!);
      } else if (pending.length) throw new SkillEffectRecoveryError(this, pending);
      if (generation !== undefined && this.generation(skill) !== generation) throw new Error('Skill effect notification was delivered after this invocation began; invoke the skill again.');
      const fd = this.lease(effect.id);
      let acquired = false;
      try {
        if (!lock(fd, false)) throw new Error('Skill effect lease already held');
        acquired = true;
        this.append({ v: 1, ...effect, phase: 'started', at: new Date().toISOString() });
        activeEffects.set(this.leasePath(effect.id), fd);
      } catch (error) { if (acquired) this.removeLease(effect.id); fs.closeSync(fd); throw error; }
    });
    return effect;
  }

  /** Commit how the command ended. A failed commit leaves the start unresolved, which is safe. */
  finish(effect: SkillEffectStart, phase: 'finished' | 'failed'): void {
    this.release(effect, phase);
  }

  /** Release ownership without closing an effect whose outcome is unknown. */
  abandon(effect: SkillEffectStart): void {
    this.release(effect);
  }

  // Host rewrite: iye, chunk-sfn1dbxq [3368429,3370821), UTF-16, has no journal.
  private release(effect: SkillEffectStart, phase?: 'finished' | 'failed'): void {
    const key = this.leasePath(effect.id);
    const fd = activeEffects.get(key);
    if (fd === undefined) throw new Error('Skill effect lease is not held by this process');
    try {
      this.withMutex(() => {
        try { if (phase) this.append({ v: 1, ...effect, phase, at: new Date().toISOString() }); }
        finally { activeEffects.delete(key); fs.closeSync(fd); this.removeLease(effect.id); }
      });
    } finally {
      if (activeEffects.delete(key)) fs.closeSync(fd);
    }
  }

  /** Started records for `skill` that no terminal record closed, oldest first. */
  unresolved(skill: string): SkillEffectPending[] {
    return this.withMutex(() => this.pending(skill));
  }

  invocation(skill: string): { generation: number; pending: SkillEffectPending[] } {
    return this.withMutex(() => ({ generation: this.generation(skill), pending: this.pending(skill) }));
  }

  private generation(skill: string): number {
    return this.read().filter(record => record.skill === skill && record.phase === 'unknown').length;
  }

  private pending(skill: string): SkillEffectPending[] {
    const records = this.read();
    const closed = new Set<string>();
    // Host recovery rewrite: source iye, chunk-sfn1dbxq [3368429,3370821),
    // UTF-16, has no effect journal. A delivered warning is not a decision.
    for (const record of records) if (record.phase === 'finished' || record.phase === 'failed') closed.add(record.id);
    // Host-only lease recovery: iye, chunk-sfn1dbxq [3368429,3370821), UTF-16,
    // has no journal. Remove only unlocked leases for completed effects.
    for (const id of closed) if (fs.existsSync(this.leasePath(id))) this.isActive(id);
    return records
      .filter((record): record is SkillEffectRecord & { phase: 'started' } => record.phase === 'started' && record.skill === skill && !closed.has(record.id) && !this.isActive(record.id))
      .map(({ id, skill: name, index, digest, at }) => ({ id, skill: name, index, digest, at }));
  }

  /** Record warning delivery without authorizing another effect. */
  acknowledge(pending: readonly SkillEffectPending[]): void {
    this.withMutex(() => {
      const reported = new Set(this.read().filter(record => record.phase === 'unknown').map(record => record.id));
      const records = pending.filter(record => !reported.has(record.id) && this.pending(record.skill).some(item => item.id === record.id))
        .map(record => ({ v: 1 as const, id: record.id, skill: record.skill, index: record.index, digest: record.digest,
          phase: 'unknown' as const, at: new Date().toISOString() }));
      if (records.length === 1) this.append(records[0]!);
      else if (records.length > 1) this.append({ v: 2, phase: 'unknown_batch', records });
    });
  }

  private leasePath(id: string): string { return `${this.file}.${id}.lease`; }

  private lease(id: string): number { return fs.openSync(this.leasePath(id), 'a', 0o600); }

  private removeLease(id: string): void {
    try { fs.unlinkSync(this.leasePath(id)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  private isActive(id: string): boolean {
    if (activeEffects.has(this.leasePath(id))) return true;
    const fd = this.lease(id);
    try {
      if (!lock(fd, false)) return true;
      this.removeLease(id);
      return false;
    } finally { fs.closeSync(fd); }
  }

  private withMutex<T>(operation: () => T): T {
    fs.mkdirSync(this.directory, { recursive: true });
    const fd = fs.openSync(`${this.file}.lock`, 'a', 0o600);
    try {
      if (!lock(fd, true)) throw new Error('Skill effect journal lock acquisition failed');
      return operation();
    } finally { fs.closeSync(fd); }
  }

  private append(record: SkillEffectRecord | SkillEffectBatch): void {
    const line = JSON.stringify(record) + '\n';
    try {
      fs.mkdirSync(this.directory, { recursive: true });
      let size = 0;
      try { size = fs.statSync(this.file).size; } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (size + Buffer.byteLength(line) > MAX_JOURNAL_BYTES) {
        throw new Error(`Skill effect journal exceeds ${MAX_JOURNAL_BYTES} bytes`);
      }
      // Host rewrite: the recovered executor has no journal (iye, chunk-sfn1dbxq,
      // [3368429,3370821) UTF-16). Preserve an incomplete tail for recovery.
      if (size > 0) {
        const fd = fs.openSync(this.file, 'r');
        try {
          const last = Buffer.alloc(1);
          if (fs.readSync(fd, last, 0, 1, size - 1) !== 1 || last[0] !== 10) {
            throw new Error('Skill effect journal has an incomplete trailing line');
          }
        } finally { fs.closeSync(fd); }
      }
      const fd = fs.openSync(this.file, 'a');
      try {
        if (fs.writeSync(fd, line) !== Buffer.byteLength(line)) throw new Error('Skill effect journal short write');
        fs.fsyncSync(fd);
      }
      finally { fs.closeSync(fd); }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Skill effect journal write failed: ${message}`);
    }
  }

  private read(): SkillEffectRecord[] {
    let size: number;
    try { size = fs.statSync(this.file).size; } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new Error(`Skill effect journal could not be read: ${(error as Error).message}`);
    }
    if (size > MAX_JOURNAL_BYTES) throw new Error(`Skill effect journal exceeds ${MAX_JOURNAL_BYTES} bytes`);
    let text: string;
    try { text = fs.readFileSync(this.file, 'utf8'); } catch (error) {
      throw new Error(`Skill effect journal could not be read: ${(error as Error).message}`);
    }
    // An incomplete start has no reliable identity, so retain it and fail closed.
    if (text.length > 0 && !text.endsWith('\n')) throw new Error('Skill effect journal has an incomplete trailing line');
    const lines = text.split('\n');
    lines.pop();
    return lines.flatMap((line, index) => {
      if (line.trim() === '') throw new Error(`Skill effect journal is unreadable: line ${index + 1} is empty`);
      let value: unknown;
      try { value = JSON.parse(line); } catch { throw new Error(`Skill effect journal is unreadable: line ${index + 1} is not JSON`); }
      const parsed = z.union([recordSchema, batchSchema]).safeParse(value);
      if (!parsed.success) throw new Error(`Skill effect journal is unreadable: line ${index + 1} has an invalid record`);
      return parsed.data.v === 2 ? parsed.data.records : [parsed.data];
    });
  }
}
