// Independent durable journal for skill inline shell effects.
//
// The recovered inline executor does not spawn commands directly: it hands each
// authored span to the tool runtime with a synthetic tool-use id
// (`toolUseId:` at chunk-sfn1dbxq.js offset 3369204, `await y.call({command})`
// at 3370268, the extractor `xxr` at 3370821 over `Gtr` at 434915). The tool
// layer therefore knows a command started before it runs, and a crash leaves a
// started call whose outcome is unknown. This product executes the spans
// itself, so it carries that same order in a dedicated append-only journal:
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
import { z } from 'zod';

/** Bounds one owner's journal; a longer history fails closed instead of growing without limit. */
const MAX_JOURNAL_BYTES = 4 * 1024 * 1024;
/** Up to 24 commands in one authored body (the source's own span budget is far smaller). */
const MAX_SPAN_INDEX = 1023;
const OWNER_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

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

/** One command whose start was made durable; `finish` closes it. */
export type SkillEffectStart = { id: string; skill: string; index: number; digest: string };
/** A started command with no terminal record: the process died before its outcome was known. */
export type SkillEffectPending = SkillEffectStart & { at: string };

function digestOf(command: string): string {
  return createHash('sha256').update(command, 'utf8').digest('hex');
}

export class SkillEffectJournal {
  readonly directory: string;
  readonly file: string;

  constructor(workspace: string, owner: string) {
    if (!OWNER_PATTERN.test(owner)) throw new Error('Skill effect journal owner must be a session id');
    this.directory = path.join(workspace, '.agent', 'skill-effects');
    this.file = path.join(this.directory, `${owner}.jsonl`);
  }

  /** Commit `started` before the command's first side effect. Returns the record to close. */
  start(skill: string, index: number, command: string): SkillEffectStart {
    if (!Number.isInteger(index) || index < 0 || index > MAX_SPAN_INDEX) throw new Error('Skill effect span index is out of bounds');
    if (skill.length === 0 || skill.length > 256) throw new Error('Skill effect name is out of bounds');
    const effect = { id: randomUUID(), skill, index, digest: digestOf(command) };
    this.append({ v: 1, ...effect, phase: 'started', at: new Date().toISOString() });
    return effect;
  }

  /** Commit how the command ended. A failed commit leaves the start unresolved, which is safe. */
  finish(effect: SkillEffectStart, phase: 'finished' | 'failed'): void {
    this.append({ v: 1, ...effect, phase, at: new Date().toISOString() });
  }

  /** Started records for `skill` that no terminal record closed, oldest first. */
  unresolved(skill: string): SkillEffectPending[] {
    const records = this.read();
    const closed = new Set<string>();
    for (const record of records) if (record.phase !== 'started') closed.add(record.id);
    return records
      .filter((record): record is SkillEffectRecord & { phase: 'started' } => record.phase === 'started' && record.skill === skill && !closed.has(record.id))
      .map(({ id, skill: name, index, digest, at }) => ({ id, skill: name, index, digest, at }));
  }

  /** Mark records as reported: they stay in the journal but no longer warn. */
  acknowledge(pending: readonly SkillEffectPending[]): void {
    for (const record of pending) {
      this.append({ v: 1, id: record.id, skill: record.skill, index: record.index, digest: record.digest,
        phase: 'unknown', at: new Date().toISOString() });
    }
  }

  private append(record: SkillEffectRecord): void {
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
      const fd = fs.openSync(this.file, 'a');
      try { fs.writeSync(fd, line); fs.fsyncSync(fd); }
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
    // A trailing line without a newline is a torn append from the crash this
    // journal exists for; it is discarded rather than treated as corruption.
    const lines = text.split('\n');
    lines.pop();
    return lines.map((line, index) => {
      if (line.trim() === '') throw new Error(`Skill effect journal is unreadable: line ${index + 1} is empty`);
      let value: unknown;
      try { value = JSON.parse(line); } catch { throw new Error(`Skill effect journal is unreadable: line ${index + 1} is not JSON`); }
      const parsed = recordSchema.safeParse(value);
      if (!parsed.success) throw new Error(`Skill effect journal is unreadable: line ${index + 1} has an invalid record`);
      return parsed.data;
    });
  }
}
