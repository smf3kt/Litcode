import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile, syncDirectory } from './atomic-write.js';
import { configSchema, fingerprint, fingerprintOf, workerNotificationBatchSchema, type Session, type SessionConfig, type SessionEvent } from './session.js';

const text = z.string();
const headerSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), parent: z.string().uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), name: text.nullable(), prompt: text,
  backgrounded: z.boolean(), fork: z.boolean(), subagentType: text.optional(), skillName: text.min(1).max(256).optional(),
  parentPlanId: z.string().uuid().optional(), startedAt: z.number().finite().nonnegative(),
}).strict();
const runIdSchema = z.string().regex(/^[0-9a-z]{9,}-[0-9a-f]{8}$/).optional();
const readyDeliverySchema = z.object({ deliveryId: z.string().uuid(), batch: workerNotificationBatchSchema,
  journal: z.object({ bytes: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict() }).strict();
const parkedDeliverySchema = z.object({ deliveryId: z.string().uuid(), journal: readyDeliverySchema.shape.journal,
  waitingFor: z.array(z.object({id:z.string().uuid(),runId:runIdSchema.unwrap()}).strict()).min(1) }).strict();
const stateSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('active'), runId: runIdSchema, preparedDeliveryId: z.string().uuid().optional(),
    continuingDeliveryId: z.string().uuid().optional(), claimedJournal: readyDeliverySchema.shape.journal.optional(), readyDelivery: readyDeliverySchema.optional(), parkedDelivery: parkedDeliverySchema.optional() }).strict(),
  z.object({ kind: z.literal('settled'), status: z.enum(['completed', 'failed', 'cancelled']),
    summary: text, error: text.nullable(), reason: text.nullable(), modelCalls: z.number().int().nonnegative(),
    endedAt: z.number().finite().nonnegative(), config: configSchema,
    runId: runIdSchema, notificationAgent: workerNotificationBatchSchema.shape.events.element.shape.agent.optional(),
    redirectedEvents: workerNotificationBatchSchema.shape.events.optional(),
    subtreeEvents: workerNotificationBatchSchema.shape.events.optional(),
    journal: z.object({ bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict(),
]);
const recordSchema = headerSchema.extend({ state: stateSchema }).strict().refine(({ state }) =>
  state.kind !== 'active' || state.preparedDeliveryId === undefined ||
    (state.runId !== undefined && state.continuingDeliveryId === undefined),
  'Prepared continuation requires one receiving run and cannot already be executing').refine(({ state }) =>
  state.kind !== 'active' || !state.readyDelivery || (!!state.runId && state.readyDelivery.batch.receiverRunId === state.runId &&
    !state.continuingDeliveryId && (!state.preparedDeliveryId || state.preparedDeliveryId === state.readyDelivery.deliveryId)),
  'Selected notification requires its receiving run and cannot already be executing').refine(({state}) =>
  state.kind !== 'active' || !state.parkedDelivery || (!!state.runId && !state.readyDelivery && !state.preparedDeliveryId && !state.continuingDeliveryId),
  'Parked notification requires a receiving run with no pending dispatch');
export type ParkedWorkerDelivery = z.infer<typeof parkedDeliverySchema>;
export type ReadyWorkerDelivery = z.infer<typeof readyDeliverySchema>;
export type AgentHistoryHeader = z.infer<typeof headerSchema>;
export type AgentHistoryRecord = Omit<z.infer<typeof recordSchema>, 'state'> & {
  state: { kind: 'active'; runId?: string; preparedDeliveryId?: string; continuingDeliveryId?: string; claimedJournal?: ReadyWorkerDelivery['journal']; readyDelivery?: ReadyWorkerDelivery; parkedDelivery?: ParkedWorkerDelivery } | {
    kind: 'settled'; status: 'completed' | 'failed' | 'cancelled'; summary: string; error: string | null;
    reason: string | null; modelCalls: number; endedAt: number; config: SessionConfig; runId?: string;
    notificationAgent?: ReadyWorkerDelivery['batch']['events'][number]['agent'];
    redirectedEvents?: ReadyWorkerDelivery['batch']['events'];
    subtreeEvents?: ReadyWorkerDelivery['batch']['events'];
    journal: { bytes: number; sha256: string };
  };
};

// DXt/lg, 9em13yqt [1831,1995); WZe/nJr/lFn, sfn1dbxq [4541786,4543991), UTF-16.
export class AgentHistoryStore {
  private readonly dir: string;
  constructor(private readonly parent: Session, private readonly maxBytes: number, private readonly maxRecords: number) {
    this.dir = path.join(path.dirname(parent.file), 'subagents', parent.id);
  }

  private directory(create: boolean, owner = this.parent.id): boolean {
    if (!this.parent.isOpen) throw new Error('Child history parent session is closed');
    const storage = path.dirname(this.parent.file);
    for (const dir of [storage, path.join(storage, 'subagents'), path.join(storage,'subagents',owner)]) {
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

  // Read-only lookup for witnessed settlements retained by an already closed owner.
  readPublishedDescendant(owner: string, id: string, digest: string): AgentHistoryRecord {
    if (!z.string().uuid().safeParse(owner).success || !z.string().uuid().safeParse(id).success || !this.directory(false,owner))
      throw new Error('Missing descendant history directory');
    const record = this.readRecord(path.join(path.dirname(this.dir),owner,id+'.meta.json'));
    if (record.parent !== owner || record.id !== id || record.state.kind !== 'settled' || fingerprintOf(record) !== digest)
      throw new Error('Descendant history no longer matches its publication');
    return record;
  }

  private readRecord(file: string, expectedContent?: string): AgentHistoryRecord {
    const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size > this.maxBytes) throw new Error('Invalid or oversized child history');
      const content = fs.readFileSync(fd,'utf8');
      if (expectedContent !== undefined && content !== expectedContent)
        throw new Error('Unclaimed worker settlement requires the original publication');
      const raw: unknown = JSON.parse(content);
      recordSchema.parse(raw);
      // Fingerprints cover the original JSON property order.
      return raw as AgentHistoryRecord;
    } finally { fs.closeSync(fd); }
  }

  // OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16.
  write(record: AgentHistoryRecord): void {
    this.prepareWrite(record)();
  }

  // IX [110300,111850), 40cepjpq, UTF-16. Only the current receiving run may
  // replace its execution claim with a durable descendant keepalive.
  park(header: AgentHistoryHeader, runId: string, parkedDelivery: ParkedWorkerDelivery): void {
    const {records} = this.read();
    const previous = records.find(record => record.id === header.id);
    const claimedJournal = previous?.state.kind === 'active' && previous.state.claimedJournal;
    const expected = {...header,state:{kind:'active',runId,continuingDeliveryId:parkedDelivery.deliveryId,...(claimedJournal ? {claimedJournal} : {})}};
    if (!previous || fingerprintOf(previous) !== fingerprintOf(expected))
      throw new Error('Worker execution claim changed before parking');
    this.write({...header,state:{kind:'active',runId,parkedDelivery}});
  }

  // OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16. The root intent is durable
  // before returning; the caller can finish publication after shutdown returns.
  prepareWrite(record: AgentHistoryRecord, shutdownLock?: Extract<SessionEvent,{kind:'agent_history_intent'}>['shutdownLock'], cancelledRunId?: string): () => void {
    recordSchema.parse(record);
    if (record.parent !== this.parent.id) throw new Error('Child history parent mismatch');
    const content = JSON.stringify(record);
    if (Buffer.byteLength(content) > this.maxBytes) throw new Error('Child history byte limit reached');
    this.directory(true);
    const target = path.join(this.dir, `${record.id}.meta.json`);
    const latest = this.parent.events.findLast(event => (event.kind === 'agent_history' || event.kind === 'agent_history_intent') && event.id === record.id);
    if (latest?.kind === 'agent_history_intent') throw new Error('Child history publication is still pending');
    // Older writers could die with only a sidecar. Only the original proposal
    // may claim it; a new invocation must not inherit or overwrite its bytes.
    const orphan = fs.existsSync(target+'.settlement');
    if (orphan && record.state.kind !== 'settled')
      throw new Error('Unclaimed worker settlement requires the original publication');
    if (orphan) this.readRecord(target+'.settlement',content);
    let continuationDeliveryId: string | undefined;
    let stagedRunId: string | undefined;
    if (record.state.kind === 'settled') {
      // Host adaptation: source OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16,
      // does not establish a transaction with the host's parent witness (W385).
      const witness = latest;
      if (!witness || witness.kind !== 'agent_history') throw new Error('Child history has no prior parent witness');
      const previous = this.readRecord(target);
      if (previous.id !== record.id || previous.parent !== this.parent.id || fingerprintOf(previous) !== witness.digest)
        throw new Error('Child history has no matching parent witness');
      if (orphan && (previous.state.kind !== 'active' || previous.state.runId !== record.state.runId))
        throw new Error('Unclaimed worker settlement belongs to another run');
      if (previous.state.kind === 'active' && previous.state.continuingDeliveryId && previous.state.runId === record.state.runId)
        continuationDeliveryId = previous.state.continuingDeliveryId;
      // OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16: retain the exact proposed
      // metadata across a crash between the root intent and sidecar replacement.
      if (cancelledRunId && (previous.state.kind !== 'active' || previous.state.runId !== cancelledRunId ||
          record.state.runId !== cancelledRunId || record.state.status !== 'cancelled')) throw new Error('Cancelled run changed');
      if (record.backgrounded && !continuationDeliveryId && !cancelledRunId && previous.state.kind === 'active' &&
          previous.state.runId === record.state.runId) stagedRunId = record.state.runId;
      this.parent.append({ kind: 'agent_history_intent', parent: this.parent.id, id: record.id,
        ...(continuationDeliveryId ? {continuationDeliveryId} : {}),
        ...(cancelledRunId ? {cancelledRunId} : {}),
        ...(stagedRunId ? {stagedRunId} : {}),
        ...(continuationDeliveryId || cancelledRunId || stagedRunId ? {terminalRecord:record} : {}),
        ...(continuationDeliveryId && shutdownLock ? {shutdownLock} : {}),
        oldDigest: witness.digest, newDigest: fingerprintOf(record), journal: record.state.journal });
    }
    const publication = {kind:'agent_history' as const,id:record.id,digest:fingerprintOf(record)};
    return () => {
      if (continuationDeliveryId || cancelledRunId || stagedRunId) {
        this.commitCandidate(record);
        return;
      }
      this.parent.assertHistoryWitnessWritable(publication);
      atomicWriteFile(target, content, { mode: 0o600, label: 'child history', durable: true });
      this.parent.append(publication);
    };
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
        const target = path.join(this.dir, name);
        let record = this.readRecord(target);
        if (record.parent !== this.parent.id || record.id !== id) throw new Error('Child history identity mismatch');
        const witness = this.parent.events.findLast(event => event.kind === 'agent_history' && event.id === id);
        const last = this.parent.events.findLast(event => (event.kind === 'agent_history' || event.kind === 'agent_history_intent') && event.id === id);
        if (last?.kind === 'agent_history' && fs.existsSync(target+'.settlement'))
          throw new Error('Unclaimed worker settlement requires the original publication');
        if (last?.kind === 'agent_history_intent' && record.state.kind === 'active' && last.oldDigest === fingerprintOf(record) &&
            (last.continuationDeliveryId || last.cancelledRunId || last.stagedRunId) &&
            (!last.continuationDeliveryId || last.continuationDeliveryId === record.state.continuingDeliveryId) &&
            (!last.cancelledRunId || last.cancelledRunId === record.state.runId) &&
            (!last.stagedRunId || (record.backgrounded && last.stagedRunId === record.state.runId))) {
          let proposed: AgentHistoryRecord;
          if (last.terminalRecord !== undefined) {
            if (Buffer.byteLength(JSON.stringify(last.terminalRecord)) > this.maxBytes)
              throw new Error('Invalid journalled worker settlement');
            recordSchema.parse(last.terminalRecord);
            proposed = last.terminalRecord as AgentHistoryRecord;
          } else proposed = this.readRecord(target + '.settlement');
          if (proposed.id !== id || proposed.parent !== this.parent.id || proposed.state.kind !== 'settled' ||
              proposed.state.runId !== record.state.runId || (last.cancelledRunId && proposed.state.status !== 'cancelled') ||
              fingerprintOf(proposed) !== last.newDigest)
            throw new Error('Staged worker settlement mismatch');
          record = proposed;
        }
        if (last?.kind === 'agent_history_intent' && record.state.kind === 'active')
          throw new Error('Child terminal publication has no matching settlement');
        const digest = fingerprintOf(record);
        if (witness?.kind !== 'agent_history' || witness.digest !== digest) {
          if (witness?.kind !== 'agent_history' || last?.kind !== 'agent_history_intent' || last.parent !== this.parent.id ||
              last.oldDigest !== witness.digest || last.newDigest !== digest || record.state.kind !== 'settled' ||
              last.journal.bytes !== record.state.journal.bytes || last.journal.sha256 !== record.state.journal.sha256)
            throw new Error('Child history has no matching parent witness');
          candidates.add(id);
        }
        if (record.state.kind === 'settled' && record.state.config.workspace !== this.parent.config.workspace)
          throw new Error('Child history workspace mismatch');
        records.push(record);
      } catch (error) { warnings.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    records.sort((a, b) => b.startedAt - a.startedAt);
    return { records, warnings, candidates };
  }

  // Host witness transaction; source OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16, has no host witness.
  commitCandidate(record: AgentHistoryRecord): boolean {
    const current = this.read();
    const same = current.records.find(item => item.id === record.id);
    if (!current.candidates.has(record.id) || !same || fingerprintOf(same) !== fingerprintOf(record)) {
      throw new Error('Child history intent changed before commit');
    }
    // A previous writer may have died or failed before either sync completed.
    const intent = this.parent.events.findLast(event => event.kind === 'agent_history_intent' && event.id === record.id);
    const continuation = intent?.kind === 'agent_history_intent' && intent.continuationDeliveryId !== undefined;
    const target = path.join(this.dir,`${record.id}.meta.json`);
    const staged = continuation || (intent?.kind === 'agent_history_intent' && !!(intent.cancelledRunId || intent.stagedRunId));
    const publication = {kind:'agent_history' as const,id:record.id,digest:fingerprintOf(record)};
    this.parent.assertHistoryWitnessWritable(publication);
    if (staged) atomicWriteFile(target,JSON.stringify(same),{mode:0o600,label:'worker settlement',durable:true});
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
    if (staged && fs.existsSync(target+'.settlement')) {
      this.readRecord(target+'.settlement',JSON.stringify(same));
      fs.unlinkSync(target+'.settlement');
      syncDirectory(this.dir);
    }
    this.parent.append(publication);
    // A root stop may die after staging the parked owner's own settlement.
    // Only the root command bound to the old active record owns its notification.
    return continuation || (intent?.kind === 'agent_history_intent' && !!intent.cancelledRunId &&
      this.parent.events.some(row => row.kind === 'parked_agent_stop' && row.parent === this.parent.id &&
        row.id === record.id && row.activeDigest === intent.oldDigest));
  }

  header(session: Session, value: Omit<AgentHistoryHeader, 'version' | 'id' | 'parent' | 'fingerprint'>): AgentHistoryHeader {
    // EE, 27et44g8 [14843,14970), UTF-16: bind the launch plan separately from the child journal.
    return { version: 1, id: session.id, parent: this.parent.id, fingerprint: fingerprint(session.config),
      ...value, ...(session.config.parentPlanId ? { parentPlanId: this.parent.config.parentPlanId ?? this.parent.planId } : {}) };
  }
}
