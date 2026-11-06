import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile, syncDirectory } from './atomic-write.js';
import { configSchema, fingerprint, fingerprintOf, type Session, type SessionConfig } from './session.js';

const text = z.string();
const headerSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), parent: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), name: text.nullable(), prompt: text,
  backgrounded: z.boolean(), fork: z.boolean(), subagentType: text.optional(), skillName: text.min(1).max(256).optional(),
  parentPlanId: z.string().uuid().optional(), startedAt: z.number().finite().nonnegative(),
}).strict();
const stateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('active') }).strict(),
  z.object({ kind: z.literal('settled'), status: z.enum(['completed', 'failed', 'cancelled']),
    summary: text, error: text.nullable(), reason: text.nullable(), modelCalls: z.number().int().nonnegative(),
    endedAt: z.number().finite().nonnegative(), config: configSchema,
    journal: z.object({ bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict(),
]);
const recordSchema = headerSchema.extend({ state: stateSchema }).strict();
export type AgentHistoryHeader = z.infer<typeof headerSchema>;
export type AgentHistoryRecord = Omit<z.infer<typeof recordSchema>, 'state'> & {
  state: { kind: 'active' } | {
    kind: 'settled'; status: 'completed' | 'failed' | 'cancelled'; summary: string; error: string | null;
    reason: string | null; modelCalls: number; endedAt: number; config: SessionConfig;
    journal: { bytes: number; sha256: string };
  };
};

// DXt/lg, 9em13yqt [1831,1995); WZe/nJr/lFn, sfn1dbxq [4541786,4543991), UTF-16.
export class AgentHistoryStore {
  private readonly dir: string;
  constructor(private readonly parent: Session, private readonly maxBytes: number, private readonly maxRecords: number) {
    this.dir = path.join(path.dirname(parent.file), 'subagents', parent.id);
  }

  private directory(create: boolean): boolean {
    if (!this.parent.isOpen) throw new Error('Child history parent session is closed');
    const storage = path.dirname(this.parent.file);
    for (const dir of [storage, path.join(storage, 'subagents'), this.dir]) {
      if (!fs.existsSync(dir)) {
        if (!create) return false;
        fs.mkdirSync(dir, { mode: 0o700 });
      }
      const stat = fs.lstatSync(dir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Child history requires real directories');
      // Retry parent sync even when a prior attempt created the entry then failed.
      if (create) syncDirectory(path.dirname(dir));
    }
    return true;
  }

  // OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16.
  write(record: AgentHistoryRecord): void {
    recordSchema.parse(record);
    if (record.parent !== this.parent.id) throw new Error('Child history parent mismatch');
    const content = JSON.stringify(record);
    if (Buffer.byteLength(content) > this.maxBytes) throw new Error('Child history byte limit reached');
    this.directory(true);
    const target = path.join(this.dir, `${record.id}.meta.json`);
    if (record.state.kind === 'settled') {
      // Host adaptation: source OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16,
      // does not establish a transaction with the host's parent witness (W385).
      const witness = this.parent.events.findLast(event => event.kind === 'agent_history' && event.id === record.id);
      if (!witness || witness.kind !== 'agent_history') throw new Error('Child history has no prior parent witness');
      const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.size > this.maxBytes) throw new Error('Invalid or oversized child history');
        const raw: unknown = JSON.parse(fs.readFileSync(fd, 'utf8'));
        const previous = recordSchema.parse(raw);
        if (previous.id !== record.id || previous.parent !== this.parent.id || fingerprintOf(raw) !== witness.digest) {
          throw new Error('Child history has no matching parent witness');
        }
      } finally { fs.closeSync(fd); }
      this.parent.append({ kind: 'agent_history_intent', parent: this.parent.id, id: record.id,
        oldDigest: witness.digest, newDigest: fingerprintOf(record), journal: record.state.journal });
    }
    atomicWriteFile(target, content, { mode: 0o600, label: 'child history', durable: true });
    this.parent.append({ kind: 'agent_history', id: record.id, digest: fingerprintOf(record) });
  }

  // fQo, sfn1dbxq [4234807,4235398), UTF-16.
  read(): { records: AgentHistoryRecord[]; warnings: string[]; candidates: Set<string> } {
    if (!this.directory(false)) return { records: [], warnings: [], candidates: new Set() };
    const records: AgentHistoryRecord[] = [], warnings: string[] = [];
    const candidates = new Set<string>();
    const owned = new Set<string>();
    for (let index = this.parent.events.length - 1; index >= 0 && owned.size < this.maxRecords; index--) {
      const event = this.parent.events[index]!;
      if (event.kind === 'agent_history') owned.add(event.id);
    }
    for (const id of owned) {
      const name = `${id}.meta.json`;
      try {
        const fd = fs.openSync(path.join(this.dir, name), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try {
          const stat = fs.fstatSync(fd);
          if (!stat.isFile() || stat.size > this.maxBytes) throw new Error('Invalid or oversized child history');
          const raw: unknown = JSON.parse(fs.readFileSync(fd, 'utf8'));
          recordSchema.parse(raw);
          const record = raw as AgentHistoryRecord;
          if (record.parent !== this.parent.id || `${record.id}.meta.json` !== name) throw new Error('Child history identity mismatch');
          const witness = this.parent.events.findLast(event => event.kind === 'agent_history' && event.id === record.id);
          if (witness?.kind !== 'agent_history' || witness.digest !== fingerprintOf(record)) {
            const last = this.parent.events.findLast(event => (event.kind === 'agent_history' || event.kind === 'agent_history_intent') && event.id === id);
            if (witness?.kind !== 'agent_history' || last?.kind !== 'agent_history_intent' || last.parent !== this.parent.id
              || last.oldDigest !== witness.digest || last.newDigest !== fingerprintOf(record)
              || record.state.kind !== 'settled' || last.journal.bytes !== record.state.journal.bytes
              || last.journal.sha256 !== record.state.journal.sha256) throw new Error('Child history has no matching parent witness');
            candidates.add(id);
          }
          if (record.state.kind === 'settled' && record.state.config.workspace !== this.parent.config.workspace) {
            throw new Error('Child history workspace mismatch');
          }
          records.push(record);
        } finally { fs.closeSync(fd); }
      } catch (error) { warnings.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    records.sort((a, b) => b.startedAt - a.startedAt);
    return { records, warnings, candidates };
  }

  // Host witness transaction; source OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16, has no host witness.
  commitCandidate(record: AgentHistoryRecord): void {
    const current = this.read();
    const same = current.records.find(item => item.id === record.id);
    if (!current.candidates.has(record.id) || !same || fingerprintOf(same) !== fingerprintOf(record)) {
      throw new Error('Child history intent changed before commit');
    }
    // A previous writer may have died or failed before either sync completed.
    const fd = fs.openSync(path.join(this.dir, `${record.id}.meta.json`), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try { fs.fsyncSync(fd); } catch (error) {
      try { fs.closeSync(fd); } catch { /* preserve the sync error */ }
      throw error;
    }
    fs.closeSync(fd);
    for (const dir of [path.dirname(this.parent.file), path.join(path.dirname(this.parent.file), 'subagents'), this.dir]) {
      syncDirectory(path.dirname(dir));
    }
    syncDirectory(this.dir);
    this.parent.append({ kind: 'agent_history', id: record.id, digest: fingerprintOf(record) });
  }

  header(session: Session, value: Omit<AgentHistoryHeader, 'version' | 'id' | 'parent' | 'fingerprint'>): AgentHistoryHeader {
    // EE, 27et44g8 [14843,14970), UTF-16: bind the launch plan separately from the child journal.
    return { version: 1, id: session.id, parent: this.parent.id, fingerprint: fingerprint(session.config),
      ...value, ...(session.config.parentPlanId ? { parentPlanId: this.parent.config.parentPlanId ?? this.parent.planId } : {}) };
  }
}
