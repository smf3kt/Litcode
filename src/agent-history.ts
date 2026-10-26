import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { configSchema, fingerprint, fingerprintOf, type Session, type SessionConfig } from './session.js';

const text = z.string();
const headerSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), parent: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), name: text.nullable(), prompt: text,
  backgrounded: z.boolean(), fork: z.boolean(), subagentType: text.optional(), startedAt: z.number().finite().nonnegative(),
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
    atomicWriteFile(path.join(this.dir, `${record.id}.meta.json`), content, { mode: 0o600, label: 'child history' });
    this.parent.append({ kind: 'agent_history', id: record.id, digest: fingerprintOf(record) });
  }

  // fQo, sfn1dbxq [4234807,4235398), UTF-16.
  read(): { records: AgentHistoryRecord[]; warnings: string[] } {
    if (!this.directory(false)) return { records: [], warnings: [] };
    const records: AgentHistoryRecord[] = [], warnings: string[] = [];
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
          if (witness?.kind !== 'agent_history' || witness.digest !== fingerprintOf(record)) throw new Error('Child history has no matching parent witness');
          if (record.state.kind === 'settled' && record.state.config.workspace !== this.parent.config.workspace) {
            throw new Error('Child history workspace mismatch');
          }
          records.push(record);
        } finally { fs.closeSync(fd); }
      } catch (error) { warnings.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    records.sort((a, b) => b.startedAt - a.startedAt);
    return { records, warnings };
  }

  header(session: Session, value: Omit<AgentHistoryHeader, 'version' | 'id' | 'parent' | 'fingerprint'>): AgentHistoryHeader {
    return { version: 1, id: session.id, parent: this.parent.id, fingerprint: fingerprint(session.config), ...value };
  }
}
