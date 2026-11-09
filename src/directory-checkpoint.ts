import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile, syncDirectory } from './atomic-write.js';
import { inspectCheckpointAssociation } from './checkpoints.js';
import { boundDirectoryFileObservationSchema } from './directory-file-state.js';
import { directoryCheckpointInheritanceSchema, directoryCheckpointPathsSchema, directoryCheckpointReferenceSchema, directoryCheckpointTornRecoverySchema, directoryHistoryPathSchema,
  directoryRewindExternalSchema, type DirectoryCheckpointReference, type DirectoryHistoryPath,
  type DirectoryCheckpointInheritanceEvent, type DirectoryCheckpointTornRecoveryEvent } from './directory-file-history.js';
import type { DirectoryCheckpointBracket } from './directory-checkpoint-bracket.js';
import type { DirectoryReadHandle } from './path-identity.js';
import type { Session } from './session.js';
import { skipInertDisplayPairs } from './agent-display-observer.js';

// Host rewrite: Fet/Tke/Cwt/E$n, sfn1dbxq [4731316,4733481)/[4734814,4735645)/[4743506,4743628), UTF-16,
// bind message snapshots; they do not provide a workspace-checkpoint bracket or receipt.
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const decimal = z.string().regex(/^[0-9]+$/);
const checkpointName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
const journalSchema = z.object({ bytes: z.number().int().positive().safe(), sha256: digest, events: z.number().int().positive().safe() }).strict();
const intentSchema = z.object({ version: z.literal(1), id: z.string().uuid(), owner: z.string().uuid(), name: checkpointName,
  boundary: z.number().int().nonnegative().safe(), paths: z.array(directoryHistoryPathSchema).max(4096), journal: journalSchema }).strict();
const backupSchema = z.object({ id: z.string().uuid(), dev: decimal, ino: decimal, uid: decimal,
  bytes: z.number().int().nonnegative().safe(), sha256: digest }).strict();
const observationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('present'), file: boundDirectoryFileObservationSchema, backup: backupSchema }).strict(),
  z.object({ kind: z.literal('missing'), parent: z.object({ dev: decimal, ino: decimal }).strict(), backup: backupSchema }).strict(),
]);
const receiptSchema = z.object({ version: z.literal(1), id: z.string().uuid(), owner: z.string().uuid(), intent: digest,
  checkpoint: z.object({ name: checkpointName, boundary: z.number().int().nonnegative().safe(), digest, association: z.string().uuid() }).strict(),
  journal: journalSchema, entries: z.array(z.object({ path: directoryHistoryPathSchema, observation: observationSchema }).strict()).max(4096) }).strict();
type Intent = z.infer<typeof intentSchema>;
type Receipt = z.infer<typeof receiptSchema>;
type Backup = z.infer<typeof backupSchema>;
type Entry = Receipt['entries'][number];
type CheckedWitness = { receipt: Receipt; witness: DirectoryCheckpointWitness; origin: DirectoryCheckpointReference['origin'] };
type ReadyBracket = Extract<DirectoryCheckpointBracket, { kind: 'ready' }>;
type Held = { path: DirectoryHistoryPath; id: string; fd: number; grant: DirectoryReadHandle; bracket: ReadyBracket };
type Commitment = { id: string; name: string; witness: string };
const authorizations = new Map<symbol, { session: Session; commitment: Commitment; current: () => boolean }>();
export function consumeDirectoryCheckpointAuthorization(session: Session, commitment: Commitment, token?: symbol): void {
  const saved = token === undefined ? undefined : authorizations.get(token);
  if (token !== undefined) authorizations.delete(token);
  if (!saved || saved.session !== session || saved.commitment.id !== commitment.id || saved.commitment.name !== commitment.name ||
      saved.commitment.witness !== commitment.witness || !saved.current()) throw new Error('Directory checkpoint witness authorization invalid');
}
const META_CAP = 8 * 1024 * 1024;
const JOURNAL_CAP = 100 * 1024 * 1024;
const RECOVERED_REFERENCE_CAP = 64;
// Host S3 traversal budget for AVr/kkn, sfn1dbxq
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// [4744282,4746177)/[4747790,4749819), UTF-16; source has no torn-proof graph.
// Share across branches and final rereads; successful prior reads are never cached.
class RecoveryVerificationBudget {
  private steps = 4096;
  private bytes = JOURNAL_CAP;
  charge(bytes = 0): void {
    if (--this.steps < 0 || bytes > this.bytes) throw new Error('Checkpoint recovery verification budget exhausted');
    this.bytes -= bytes;
  }
  read(file: string, cap: number): Buffer {
    this.charge();
    const value = readPrivate(file, Math.min(cap, this.bytes));
    this.charge(value.length); return value;
  }
  receipt(journal: string, id: string) {
    this.charge();
    const result = readReceipt(journal, id);
    this.charge(result.bytes.length); return result;
  }
}
// A no-path shell touch or an outside path does not bind the affected external history.
const workspaceHistoryPath = z.string().min(1).refine(value => !value.includes('\0') && !path.isAbsolute(value) &&
  value !== '.' && value !== '..' && !value.startsWith(`..${path.sep}`) && path.normalize(value) === value);
const recoverySuffixSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('session_color'), color: z.enum(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']).nullable() }).strict(),
  z.object({ kind: z.literal('title'), title: z.string().min(1).max(200).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)) }).strict(),
  z.object({ kind: z.literal('file_history'), path: workspaceHistoryPath, tracked: z.boolean() }).strict(),
]);
// Z2n, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// [417118,417742), UTF-16: absent/null citations normalize to an empty list.
// S3 recovery accepts only empty representations; original journal bytes still bind equality.
const recoveryTextBlockSchema = z.object({ type: z.literal('text'), text: z.string(),
  citations: z.array(z.never()).max(0).nullable().optional() }).strict();
const recoveryUserMessageSchema = z.object({ kind: z.literal('message'),
  message: z.object({ role: z.literal('user'), content: z.string() }).strict(), messageId: z.string().uuid(),
  directoryHistoryDisabled: z.literal(true).optional(), classifier: z.object({ origin: z.object({ kind: z.literal('human') }).strict(),
    humanText: z.string() }).strict() }).strict();
const recoveryAssistantMessageSchema = z.object({ kind: z.literal('message'),
  message: z.object({ role: z.literal('assistant'), content: z.array(recoveryTextBlockSchema).min(1) }).strict(), messageId: z.string().uuid(),
  response: z.object({ role: z.literal('assistant'), content: z.array(recoveryTextBlockSchema).min(1), stop_reason: z.literal('end_turn') }).passthrough() }).strict();
const recoveryTextTurnEndSchema = z.object({ kind: z.literal('turn_end'), reason: z.literal('end_turn'),
  duration: z.object({ uuid: z.string().uuid(), durationMs: z.number().finite().nonnegative(), timestamp: z.string().datetime({ offset: true }) }).strict().optional() }).strict();
const hash = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');
const intentFile = (journal: string, id: string) => `${journal}.checkpoint-witness-intent-${id}`;
const receiptFile = (journal: string, id: string) => `${journal}.checkpoint-witness-receipt-${id}`;
const preparedFile = (journal: string, id: string) => `${journal}.checkpoint-witness-prepared-${id}`;
const backupFile = (journal: string, id: string) => `${journal}.snapshot-unknown-${id}`;
const intentPath = (session: Session, id: string) => intentFile(session.file, id);
const receiptPath = (session: Session, id: string) => receiptFile(session.file, id);
const preparedPath = (session: Session, id: string) => preparedFile(session.file, id);
const backupPath = (session: Session, id: string) => backupFile(session.file, id);

function readPrivate(file: string, cap: number): Buffer {
  const named = fs.lstatSync(file, { bigint: true });
  if (!named.isFile() || named.isSymbolicLink() || named.nlink !== 1n || named.size > BigInt(cap) || (named.mode & 0o7777n) !== 0o600n)
    throw new Error('Checkpoint witness metadata invalid');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== named.dev || opened.ino !== named.ino || opened.size !== named.size || opened.nlink !== 1n ||
        (opened.mode & 0o7777n) !== 0o600n || (typeof process.getuid === 'function' && opened.uid !== BigInt(process.getuid())))
      throw new Error('Checkpoint witness metadata changed');
    const bytes = fs.readFileSync(fd); fs.fsyncSync(fd);
    const after = fs.fstatSync(fd, { bigint: true }), current = fs.lstatSync(file, { bigint: true });
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== opened.dev || current.ino !== opened.ino ||
        after.dev !== opened.dev || after.ino !== opened.ino || after.size !== opened.size || bytes.length !== Number(opened.size) ||
        after.uid !== opened.uid || after.mode !== opened.mode || after.nlink !== 1n || after.mtimeNs !== opened.mtimeNs ||
        after.ctimeNs !== opened.ctimeNs) throw new Error('Checkpoint witness metadata changed');
    const checked = Buffer.alloc(bytes.length);
    for (let offset = 0; offset < checked.length;) {
      const count = fs.readSync(fd, checked, offset, checked.length - offset, offset);
      if (!count) throw new Error('Checkpoint witness metadata truncated');
      offset += count;
    }
    const final = fs.fstatSync(fd, { bigint: true }), finalName = fs.lstatSync(file, { bigint: true });
    if (!checked.equals(bytes) || !finalName.isFile() || finalName.isSymbolicLink() || finalName.dev !== opened.dev || finalName.ino !== opened.ino ||
        final.dev !== opened.dev || final.ino !== opened.ino || final.size !== opened.size || final.uid !== opened.uid || final.mode !== opened.mode ||
        final.nlink !== 1n || final.mtimeNs !== opened.mtimeNs || final.ctimeNs !== opened.ctimeNs) throw new Error('Checkpoint witness metadata changed');
    return bytes;
  } finally { fs.closeSync(fd); }
}

// Host torn-evidence bracket for Ole, sfn1dbxq [4694145,4697475), UTF-16;
// source marks a torn tail but has no host evidence or recovery commitment.
function readTornEvidenceFile(file: string): { id: string; bytes: Buffer } | undefined {
  try {
    const prefix = `${path.basename(file)}.torn-`;
    const names = fs.readdirSync(path.dirname(file)).filter(name => name.startsWith(prefix));
    if (names.length !== 1) return;
    const id = names[0]!.slice(prefix.length);
    if (!z.string().uuid().safeParse(id).success) return;
    const bytes = readPrivate(path.join(path.dirname(file), names[0]!), JOURNAL_CAP);
    return { id, bytes };
  } catch { return; }
}

export function readTornCheckpointEvidence(session: Session): { id: string; bytes: Buffer } | undefined {
  try {
    session.checkpointGateIdentity();
    const evidence = readTornEvidenceFile(session.file);
    session.checkpointGateIdentity();
    return evidence;
  } catch { return; }
}

export function matchesTornCheckpointInheritance(journal: Buffer, candidate: DirectoryCheckpointInheritanceEvent, evidence: Buffer): boolean {
  const full = Buffer.from(JSON.stringify(candidate) + '\n'), marker = Buffer.from('"references":[');
  const header = full.indexOf(marker);
  if (header < 0 || evidence.length <= journal.length || !evidence.subarray(0, journal.length).equals(journal)) return false;
  const tail = evidence.subarray(journal.length);
  return tail.length >= header + marker.length && tail.length < full.length && full.subarray(0, tail.length).equals(tail);
}

// Host suffix proof for xe/Ole/XKt/Pz/rhe/Fet, sfn1dbxq [4380701,4382470)/[4694145,4697475)/[4657832,4658124)/[4644259,4644651)/[4728518,4730433)/[4731316,4732048), UTF-16;
// the source has no retained torn-inheritance commitment.
export function checkpointRecoveryAnchor(events: readonly unknown[], end: number): number {
  if (!Number.isSafeInteger(end) || end < 0 || end > events.length) return -1;
  let index = skipInertDisplayPairs(events, end - 1);
  while (index >= 0) {
    if (recoverySuffixSchema.safeParse(events[index]).success) { index = skipInertDisplayPairs(events, index - 1); continue; }
    const assistant = skipInertDisplayPairs(events, index - 1), user = skipInertDisplayPairs(events, assistant - 1);
    if (user < 0 || !isCheckpointRecoveryTextTurn(events[user], events[assistant], events[index])) break;
    index = skipInertDisplayPairs(events, user - 1);
  }
  return index;
}
export function isCheckpointRecoveryTextTurn(userEvent: unknown, assistantEvent: unknown, endEvent: unknown): boolean {
  const user = recoveryUserMessageSchema.safeParse(userEvent), assistant = recoveryAssistantMessageSchema.safeParse(assistantEvent);
  return user.success && assistant.success && recoveryTextTurnEndSchema.safeParse(endEvent).success &&
    user.data.messageId !== assistant.data.messageId && user.data.classifier.humanText === user.data.message.content &&
    JSON.stringify(assistant.data.message.content) === JSON.stringify(assistant.data.response.content);
}
export function checkpointRecoveryPrefix(events: readonly unknown[], journal: Buffer, end: number): { index: number; bytes: Buffer } | undefined {
  const index = checkpointRecoveryAnchor(events, end);
  if (index < 0) return;
  let offset = 0;
  for (let i = 0; i <= index; i++) {
    const newline = journal.indexOf(10, offset);
    if (newline < 0) return;
    offset = newline + 1;
  }
  return { index, bytes: journal.subarray(0, offset) };
}

function readReceipt(journal: string, id: string): { file: string; bytes: Buffer } {
  const file = receiptFile(journal, id);
  try { return { file, bytes: readPrivate(file, META_CAP) }; }
  catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    const prepared = preparedFile(journal, id);
    return { file: prepared, bytes: readPrivate(prepared, META_CAP) };
  }
}

function backupBytes(journal: string, backup: Backup, capture: boolean): Buffer | undefined {
  const file = backupFile(journal, backup.id), named = fs.lstatSync(file, { bigint: true });
  if (!named.isFile() || named.isSymbolicLink() || named.nlink !== 1n || String(named.dev) !== backup.dev || String(named.ino) !== backup.ino ||
      String(named.uid) !== backup.uid || named.size !== BigInt(backup.bytes) || (named.mode & 0o7777n) !== 0o600n) throw new Error('Checkpoint backup changed');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const initial = fs.fstatSync(fd, { bigint: true });
    if (!initial.isFile() || initial.dev !== named.dev || initial.ino !== named.ino || initial.nlink !== 1n || initial.size !== named.size ||
        initial.uid !== named.uid || initial.mode !== named.mode) throw new Error('Checkpoint backup changed');
    fs.fsyncSync(fd);
    const hasher = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(64 * 1024), parts: Buffer[] = [];
    for (let offset = 0; offset < backup.bytes;) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, backup.bytes - offset), offset);
      if (!count) throw new Error('Checkpoint backup truncated');
      const part = buffer.subarray(0, count); hasher.update(part); if (capture) parts.push(Buffer.from(part)); offset += count;
    }
    if (hasher.digest('hex') !== backup.sha256) throw new Error('Checkpoint backup digest mismatch');
    const after = fs.fstatSync(fd, { bigint: true }), current = fs.lstatSync(file, { bigint: true });
    if (!current.isFile() || current.isSymbolicLink() || current.dev !== initial.dev || current.ino !== initial.ino ||
        after.dev !== initial.dev || after.ino !== initial.ino || after.size !== initial.size || after.mtimeNs !== initial.mtimeNs ||
        after.ctimeNs !== initial.ctimeNs || after.nlink !== 1n || after.mode !== initial.mode) throw new Error('Checkpoint backup changed');
    return capture ? Buffer.concat(parts, backup.bytes) : undefined;
  } finally { fs.closeSync(fd); }
}

function ownerCurrent(session: Session, held: Held): boolean {
  const current = session.workingDirectories(false).readHandle?.(held.path.grant.root), grant = held.grant;
  return session.isOpen && !session.closeSignal.aborted && !grant.signal.aborted && !!current && !current.signal.aborted &&
    grant.owner === session.id && current.owner === session.id && current.incarnation === grant.incarnation && current.fd === grant.fd &&
    current.dev === grant.dev && current.ino === grant.ino;
}

export type DirectoryCheckpointWitness = { kind: 'unknown' } | { kind: 'available';
  entries: { path: DirectoryHistoryPath; observation: { kind: 'present'; file: z.infer<typeof boundDirectoryFileObservationSchema>; backupId: string } |
    { kind: 'missing'; parent: { dev: string; ino: string } } | { kind: 'unavailable' } }[] };
export type DirectoryCheckpointGroup = { kind: 'unknown' } | { kind: 'ready'; validate(): void;
  finish(): Promise<DirectoryCheckpointWitness>; cancel(): Promise<void> };

export async function beginDirectoryCheckpoint(session: Session, name: string, boundary: number, signal: AbortSignal): Promise<DirectoryCheckpointGroup> {
  const unknown: DirectoryCheckpointGroup = { kind: 'unknown' }, held: Held[] = [];
  let handedOff = false, closed = false;
  const cancel = async () => {
    if (closed) return; closed = true;
    await Promise.allSettled(held.map(item => item.bracket.cancel()));
    for (const item of held) { try { fs.closeSync(item.fd); } catch { /* Unavailable descriptors remain unconfirmed. */ } }
  };
  try {
    signal.throwIfAborted(); checkpointName.parse(name);
    const count = session.events.length, state = session.directoryCheckpointPathsAt(count);
    if (state.kind !== 'available' || state.paths.length > 4096) return unknown;
    const journal = session.checkpointJournalBytes(), id = crypto.randomUUID();
    const intent: Intent = intentSchema.parse({ version: 1, id, owner: session.id, name, boundary, paths: state.paths,
      journal: { bytes: journal.length, sha256: hash(journal), events: count } });
    const intentBytes = Buffer.from(JSON.stringify(intent));
    if (intentBytes.length > META_CAP || fs.existsSync(intentPath(session, id)) || fs.existsSync(receiptPath(session, id)) ||
        fs.existsSync(preparedPath(session, id))) return unknown;
    atomicWriteFile(intentPath(session, id), intentBytes, { mode: 0o600, durable: true });
    for (const target of intent.paths) {
      signal.throwIfAborted();
      const grant = session.workingDirectories(false).readHandle?.(target.grant.root);
      if (!grant || grant.owner !== session.id || String(grant.dev) !== target.grant.dev || String(grant.ino) !== target.grant.ino) return unknown;
      const backupId = crypto.randomUUID(), file = backupPath(session, backupId);
      const fd = fs.openSync(file, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
      let accepted = false;
      try {
        syncDirectory(path.dirname(file));
        const bracket = await session.beginDirectoryCheckpointBracket({ id: backupId, root: target.grant.root,
          lexicalPath: target.lexicalPath, destinationFd: fd, signal });
        if (bracket.kind !== 'ready') return unknown;
        held.push({ path: target, id: backupId, fd, grant, bracket }); accepted = true;
      } finally { if (!accepted) fs.closeSync(fd); }
    }
    const validate = () => {
      signal.throwIfAborted();
      if (!session.checkpointJournalBytes().equals(journal) || session.events.length !== count ||
          JSON.stringify(session.directoryCheckpointPathsAt(count)) !== JSON.stringify(state) ||
          !readPrivate(intentPath(session, id), META_CAP).equals(intentBytes) || held.some(item => !ownerCurrent(session, item)))
        throw new Error('Checkpoint witness changed before capture');
    };
    const finish = async (): Promise<DirectoryCheckpointWitness> => {
      try {
        signal.throwIfAborted();
        const results = await Promise.all(held.map(item => item.bracket.finish()));
        signal.throwIfAborted();
        const current = session.checkpointJournalBytes(), row = session.events[count];
        if (session.events.length !== count + 1 || !current.subarray(0, journal.length).equals(journal) ||
            !row || row.kind !== 'checkpoint' || row.name !== name || row.boundary !== boundary ||
            results.some(result => result.kind !== 'stable') || held.some(item => !ownerCurrent(session, item)) ||
            !readPrivate(intentPath(session, id), META_CAP).equals(intentBytes)) return { kind: 'unknown' };
        const association = inspectCheckpointAssociation(session.config.workspace, name, session.id, boundary);
        if (!association || association.digest !== row.digest) return { kind: 'unknown' };
        const entries: Entry[] = [];
        for (const [index, item] of held.entries()) {
          const result = results[index]; if (!result || result.kind !== 'stable') return { kind: 'unknown' };
          const stat = fs.fstatSync(item.fd, { bigint: true }), named = fs.lstatSync(backupPath(session, item.id), { bigint: true });
          if (!stat.isFile() || !named.isFile() || named.isSymbolicLink() || stat.dev !== named.dev || stat.ino !== named.ino ||
              stat.nlink !== 1n || (stat.mode & 0o7777n) !== 0o600n || stat.size > BigInt(Number.MAX_SAFE_INTEGER)) return { kind: 'unknown' };
          const size = Number(stat.size), hasher = crypto.createHash('sha256'), buffer = Buffer.allocUnsafe(64 * 1024);
          for (let offset = 0; offset < size;) {
            const n = fs.readSync(item.fd, buffer, 0, Math.min(buffer.length, size - offset), offset);
            if (!n) return { kind: 'unknown' }; hasher.update(buffer.subarray(0, n)); offset += n;
          }
          const backup = backupSchema.parse({ id: item.id, dev: String(stat.dev), ino: String(stat.ino), uid: String(stat.uid), bytes: size, sha256: hasher.digest('hex') });
          if (result.observation.kind === 'present' ? BigInt(result.observation.file.size) !== stat.size : size !== 0) return { kind: 'unknown' };
          fs.fsyncSync(item.fd); backupBytes(session.file, backup, false);
          entries.push({ path: item.path, observation: { ...result.observation, backup } });
        }
        syncDirectory(path.dirname(session.file));
        if (held.some(item => !ownerCurrent(session, item)) || !session.checkpointJournalBytes().equals(current)) return { kind: 'unknown' };
        const receipt = receiptSchema.parse({ version: 1, id, owner: session.id, intent: hash(intentBytes),
          checkpoint: { name, boundary, digest: row.digest, association: association.id },
          journal: { bytes: current.length, sha256: hash(current), events: session.events.length }, entries });
        const encoded = Buffer.from(JSON.stringify(receipt)); if (encoded.length > META_CAP) return { kind: 'unknown' };
        // Host receipt recovery for Fet/Tke, sfn1dbxq [4731316,4733481), UTF-16;
        // persist the complete bytes before committing their digest to the journal.
        atomicWriteFile(preparedPath(session, id), encoded, { mode: 0o600, durable: true });
        const commitment = { id, name, witness: hash(encoded) }, authorization = Symbol('directory checkpoint witness');
        authorizations.set(authorization, { session, commitment: { ...commitment }, current: () => !closed && !signal.aborted && session.isOpen &&
          !session.isJournalFenced && held.every(item => ownerCurrent(session, item)) &&
          readPrivate(intentPath(session, id), META_CAP).equals(intentBytes) && readPrivate(preparedPath(session, id), META_CAP).equals(encoded) &&
          session.checkpointJournalBytes().equals(current) });
        try { session.commitDirectoryCheckpointWitness(commitment, authorization); }
        finally { authorizations.delete(authorization); }
        if (held.some(item => !ownerCurrent(session, item)) || !readPrivate(intentPath(session, id), META_CAP).equals(intentBytes) ||
            !readPrivate(preparedPath(session, id), META_CAP).equals(encoded) || fs.existsSync(receiptPath(session, id))) return { kind: 'unknown' };
        fs.renameSync(preparedPath(session, id), receiptPath(session, id));
        syncDirectory(path.dirname(session.file));
        return inspectDirectoryCheckpointWitness(session, name);
      } catch (error) {
        if (signal.aborted || !session.isOpen || session.isJournalFenced) throw error;
        return { kind: 'unknown' };
      }
      finally { await cancel(); }
    };
    validate(); handedOff = true;
    return { kind: 'ready', validate, finish, cancel };
  } catch { return unknown; }
  finally { if (!handedOff) await cancel(); }
}

function inspectDirect(session: Session, name: string): CheckedWitness | undefined {
  try {
    checkpointName.parse(name);
    const journal = session.checkpointJournalBytes(), prefix = `${path.basename(session.file)}.checkpoint-witness-receipt-`;
    const names = fs.readdirSync(path.dirname(session.file)).filter(value => value.startsWith(prefix));
    if (names.length > 4096 || hasUnresolvedDirectoryHistoryTorn(session)) return;
    let selected: { receipt: Receipt; bytes: Buffer; file: string } | undefined;
    for (const filename of names) {
      const id = filename.slice(prefix.length); if (!z.string().uuid().safeParse(id).success) return;
      const bytes = readPrivate(receiptPath(session, id), META_CAP), receipt = receiptSchema.parse(JSON.parse(bytes.toString('utf8')));
      if (receipt.id !== id || receipt.owner !== session.id) return;
      if (receipt.checkpoint.name === name) { if (selected) return; selected = { receipt, bytes, file: receiptPath(session, id) }; }
    }
    if (!selected) {
      const commitments = session.events.filter(event => event.kind === 'directory_checkpoint_witness' && event.name === name);
      if (commitments.length !== 1 || commitments[0]?.kind !== 'directory_checkpoint_witness') return;
      const id = commitments[0].id, found = readReceipt(session.file, id);
      const receipt = receiptSchema.parse(JSON.parse(found.bytes.toString('utf8')));
      if (receipt.id !== id || receipt.owner !== session.id || receipt.checkpoint.name !== name) return;
      selected = { receipt, ...found };
    }
    if (!selected) return;
    const { receipt, bytes: receiptBytes } = selected, intentBytes = readPrivate(intentPath(session, receipt.id), META_CAP);
    const intent = intentSchema.parse(JSON.parse(intentBytes.toString('utf8')));
    if (intent.id !== receipt.id || intent.owner !== session.id || hash(intentBytes) !== receipt.intent ||
        intent.name !== receipt.checkpoint.name || intent.boundary !== receipt.checkpoint.boundary ||
        receipt.journal.events !== intent.journal.events + 1 || receipt.journal.events > session.events.length ||
        intent.journal.bytes > receipt.journal.bytes || receipt.journal.bytes > journal.length ||
        hash(journal.subarray(0, intent.journal.bytes)) !== intent.journal.sha256 ||
        hash(journal.subarray(0, receipt.journal.bytes)) !== receipt.journal.sha256) return;
    const initial = journal.subarray(0, intent.journal.bytes);
    if (initial.at(-1) !== 10 || JSON.stringify(initial.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !==
        JSON.stringify(session.events.slice(0, intent.journal.events))) return;
    const row = session.events[intent.journal.events];
    if (!row || row.kind !== 'checkpoint' || row.name !== intent.name || row.boundary !== intent.boundary || row.digest !== receipt.checkpoint.digest ||
        !journal.subarray(intent.journal.bytes, receipt.journal.bytes).equals(Buffer.from(JSON.stringify(row) + '\n'))) return;
    const commitment = session.events[receipt.journal.events];
    if (!commitment || commitment.kind !== 'directory_checkpoint_witness' || commitment.id !== receipt.id || commitment.owner !== session.id ||
        commitment.name !== intent.name || commitment.witness !== hash(receiptBytes) ||
        session.events.filter(event => event.kind === 'directory_checkpoint_witness' && (event.id === receipt.id || event.name === intent.name)).length !== 1) return;
    const savedPaths = session.directoryCheckpointPathsAt(intent.journal.events), currentPaths = session.directoryCheckpointPathsAt(session.events.length);
    if (savedPaths.kind !== 'available' || currentPaths.kind !== 'available' || JSON.stringify(savedPaths.paths) !== JSON.stringify(intent.paths) ||
        receipt.entries.length !== intent.paths.length || receipt.entries.some((entry, index) => JSON.stringify(entry.path) !== JSON.stringify(intent.paths[index]))) return;
    const association = inspectCheckpointAssociation(session.config.workspace, intent.name, session.id, intent.boundary);
    if (!association || association.id !== receipt.checkpoint.association || association.digest !== receipt.checkpoint.digest) return;
    for (const entry of receipt.entries) {
      const { observation } = entry;
      if (observation.kind === 'present' ? BigInt(observation.file.size) !== BigInt(observation.backup.bytes) : observation.backup.bytes !== 0) return;
      backupBytes(session.file, observation.backup, false);
    }
    syncDirectory(path.dirname(session.file));
    if (!readPrivate(selected.file, META_CAP).equals(receiptBytes) ||
        !readPrivate(intentPath(session, receipt.id), META_CAP).equals(intentBytes) || !session.checkpointJournalBytes().equals(journal)) return;
    for (const entry of receipt.entries) backupBytes(session.file, entry.observation.backup, false);
    const entries: Extract<DirectoryCheckpointWitness, { kind: 'available' }>['entries'] = receipt.entries.map(entry => ({ path: entry.path,
      observation: entry.observation.kind === 'present' ? { kind: 'present', file: entry.observation.file, backupId: entry.observation.backup.id } :
        { kind: 'missing', parent: entry.observation.parent } }));
    for (const target of currentPaths.paths) {
      const previous = entries.find(entry => entry.path.trackingPath === target.trackingPath);
      if (previous && JSON.stringify(previous.path) !== JSON.stringify(target)) return;
      if (!previous) entries.push({ path: target, observation: { kind: 'unavailable' } });
    }
    if (hasUnresolvedDirectoryHistoryTorn(session)) return;
    session.checkpointGateIdentity();
    const original = { owner: session.id, workspace: session.config.workspace, journal: session.file, receipt: receipt.id,
      receiptDigest: hash(receiptBytes), boundary: receipt.checkpoint.boundary, association: receipt.checkpoint.association };
    const recoveryIndex = session.events.findIndex(event => event.kind === 'directory_checkpoint_torn_recovery');
    const origin: DirectoryCheckpointReference['origin'] = recoveryIndex < 0 ? original : { kind: 'post-torn-checkpoint', owner: session.id,
      workspace: session.config.workspace, journal: session.file, proof: { journal: { bytes: journal.length, sha256: hash(journal),
        events: session.events.length }, recoveryIndex }, original };
    return { receipt, witness: { kind: 'available', entries }, origin };
  } catch { return; }
}

// Host recovery proof for Ole/Cwt, sfn1dbxq [4694145,4697475)/[4734814,4735645), UTF-16;
// source does not bind preserved torn bytes to a cross-session checkpoint reference.
type RecoveryTarget = { owner: string; workspace: string; events: readonly unknown[];
  readEvidence(): { id: string; bytes: Buffer } | undefined; readJournal(): Buffer };

function inheritedSourcePaths(rows: ({ kind: string } & Record<string, unknown>)[], owner: string, workspace: string,
    reference: DirectoryCheckpointReference): DirectoryHistoryPath[] | undefined {
  const matches: { index: number; event: DirectoryCheckpointInheritanceEvent; boundary: number }[] = [];
  for (const [index, row] of rows.entries()) {
    if (row.kind !== 'directory_checkpoint_inheritance') continue;
    const parsed = directoryCheckpointInheritanceSchema.safeParse(row); if (!parsed.success) return;
    for (const item of parsed.data.references) if (item.name === reference.name) {
      if (item.digest !== reference.digest || JSON.stringify(item.origin) !== JSON.stringify(reference.origin)) return;
      matches.push({ index, event: parsed.data, boundary: item.boundary });
    }
  }
  if (matches.length !== 1) return;
  const match = matches[0]!, branchIndex = rows.findLastIndex((row, index) => index < match.index && row.kind === 'branch');
  const branchRow = rows[branchIndex];
  const branch = z.object({ kind: z.literal('branch'), source: z.string().uuid(), workspace: z.string(),
    external: directoryRewindExternalSchema, checkpointPaths: directoryCheckpointPathsSchema }).passthrough().safeParse(branchRow);
  if (!branch.success || branch.data.workspace !== workspace || branch.data.source !== match.event.source || match.event.owner !== owner ||
      branch.data.external.kind === 'unknown' || branch.data.checkpointPaths.kind !== 'available' || hash(JSON.stringify(branchRow)) !== match.event.branch) return;
  const paths = branch.data.checkpointPaths.paths;
  if ((branch.data.external.kind === 'none' && paths.length !== 0) ||
      (branch.data.external.kind === 'unavailable' && branch.data.external.paths.some(file => !paths.some(item => item.lexicalPath === file))) ||
      new Set(paths.map(item => item.trackingPath)).size !== paths.length || new Set(paths.map(item => item.lexicalPath)).size !== paths.length) return;
  const checkpoints = rows.slice(0, branchIndex).filter(row => row.kind === 'checkpoint' && row.name === reference.name);
  if (checkpoints.length !== 1 || checkpoints[0]?.digest !== reference.digest || checkpoints[0]?.boundary !== match.boundary) return;
  return paths;
}

function verifyTornRecoveryEvidence(target: RecoveryTarget, journal: Buffer, index: number, recovery: DirectoryCheckpointTornRecoveryEvent,
    ancestors: ReadonlySet<string> = new Set(), budget = new RecoveryVerificationBudget()): boolean {
  try {
    budget.charge(journal.length);
    if (ancestors.has(target.owner)) return false;
    const visiting = new Set(ancestors); visiting.add(target.owner);
    const { candidate, evidence, sourceJournal, targetJournal } = recovery;
    const torn = target.readEvidence(), targetPrefix = journal.subarray(0, targetJournal.bytes);
    budget.charge(torn?.bytes.length ?? 0);
    const branchPrefix = checkpointRecoveryPrefix(target.events, targetPrefix, index);
    const branch = z.object({ kind: z.literal('branch'), source: z.string().uuid(), workspace: z.string() }).passthrough()
      .safeParse(branchPrefix && target.events[branchPrefix.index]);
    if (!torn || torn.id !== evidence.id || hash(torn.bytes) !== evidence.sha256 || targetPrefix.length !== targetJournal.bytes ||
        hash(targetPrefix) !== targetJournal.sha256 || targetJournal.events !== index || targetPrefix.at(-1) !== 10 ||
        JSON.stringify(targetPrefix.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line))) !== JSON.stringify(target.events.slice(0, index)) ||
        !branchPrefix || !branch.success || candidate.owner !== target.owner || branch.data.source !== candidate.source ||
        branch.data.workspace !== target.workspace || hash(JSON.stringify(target.events[branchPrefix.index])) !== candidate.branch ||
        !matchesTornCheckpointInheritance(branchPrefix.bytes, candidate, torn.bytes)) return false;
    const sourceFile = path.join(target.workspace, '.agent', `${candidate.source}.jsonl`);
    const recovered = candidate.references.filter(reference => 'kind' in reference.origin);
    if ((recovered.length && candidate.references.length > RECOVERED_REFERENCE_CAP) ||
        candidate.references.some(reference => {
          const recorded = reference.origin, original = 'kind' in recorded ? recorded.original : recorded;
          return recorded.workspace !== target.workspace || original.workspace !== target.workspace ||
            original.journal !== path.join(target.workspace, '.agent', `${original.owner}.jsonl`);
        })) return false;
    const sourceTorn = fs.readdirSync(path.dirname(sourceFile)).some(name => name.startsWith(`${path.basename(sourceFile)}.torn-`));
    if (sourceTorn && candidate.references.some(reference => !('kind' in reference.origin) ||
        reference.origin.owner !== candidate.source || reference.origin.journal !== sourceFile)) return false;
    const source = budget.read(sourceFile, JOURNAL_CAP), sourcePrefix = source.subarray(0, sourceJournal.bytes);
    if (source.at(-1) !== 10 || sourcePrefix.length !== sourceJournal.bytes || sourcePrefix.at(-1) !== 10 || hash(sourcePrefix) !== sourceJournal.sha256) return false;
    const rowSchema = z.object({ kind: z.string() }).passthrough();
    source.toString('utf8').trimEnd().split('\n').forEach(line => rowSchema.parse(JSON.parse(line)));
    const rows = sourcePrefix.toString('utf8').trimEnd().split('\n').map(line => rowSchema.parse(JSON.parse(line)));
    if (rows.length !== sourceJournal.events) return false;
    const metadata = z.object({ kind: z.literal('metadata'), id: z.string().uuid(),
      config: z.object({ workspace: z.string() }).passthrough() }).passthrough().safeParse(rows[0]);
    if (!metadata.success || metadata.data.id !== candidate.source || metadata.data.config.workspace !== target.workspace) return false;
    const checkpointSchema = z.object({ kind: z.literal('checkpoint'), name: checkpointName, digest,
      boundary: z.number().int().nonnegative().safe() }).strict();
    const commitmentSchema = z.object({ kind: z.literal('directory_checkpoint_witness'), owner: z.string().uuid(),
      id: z.string().uuid(), name: checkpointName, witness: digest }).strict();
    const origins = new Map<string, { journal: Buffer; rows: typeof rows; torn: boolean }>();
    for (const reference of candidate.references) {
      budget.charge();
      const recorded = reference.origin, priorRecovery = 'kind' in recorded;
      if (priorRecovery && !verifyRecoveredLineage(target.workspace, reference, visiting, budget)) return false;
      const origin = priorRecovery ? recorded.original : recorded;
      const direct = !priorRecovery && origin.owner === candidate.source;
      const ownRecovery = priorRecovery && recorded.owner === candidate.source && recorded.journal === sourceFile;
      const inheritedPaths = direct || ownRecovery ? undefined : inheritedSourcePaths(rows, candidate.source, target.workspace, reference);
      if (!direct && !ownRecovery && !inheritedPaths) return false;
      let originPrefix = sourcePrefix, originRows = rows;
      if (origin.owner !== candidate.source) {
        let saved = origins.get(origin.journal);
        const recoveredReceiptOwner = priorRecovery && recorded.kind === 'post-torn-checkpoint' &&
          recorded.owner === origin.owner && recorded.journal === origin.journal;
        if (!saved) {
          const torn = fs.readdirSync(path.dirname(origin.journal)).some(name => name.startsWith(`${path.basename(origin.journal)}.torn-`));
          if (torn && !recoveredReceiptOwner) return false;
          const original = budget.read(origin.journal, JOURNAL_CAP);
          if (original.at(-1) !== 10) return false;
          const originalRows = original.toString('utf8').trimEnd().split('\n').map(line => rowSchema.parse(JSON.parse(line)));
          const originalMetadata = z.object({ kind: z.literal('metadata'), id: z.string().uuid(),
            config: z.object({ workspace: z.string() }).passthrough() }).passthrough().safeParse(originalRows[0]);
          if (!originalMetadata.success || originalMetadata.data.id !== origin.owner || originalMetadata.data.config.workspace !== target.workspace) return false;
          saved = { journal: original, rows: originalRows, torn }; origins.set(origin.journal, saved);
        }
        if (saved.torn && !recoveredReceiptOwner) return false;
        originPrefix = saved.journal; originRows = saved.rows;
      }
      const stored = budget.receipt(origin.journal, origin.receipt), receiptBytes = stored.bytes;
      const receipt = receiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')));
      const intentBytes = budget.read(intentFile(origin.journal, origin.receipt), META_CAP);
      const intent = intentSchema.parse(JSON.parse(intentBytes.toString('utf8')));
      const checkpoint = checkpointSchema.safeParse(originRows[intent.journal.events]);
      const commitment = commitmentSchema.safeParse(originRows[receipt.journal.events]);
      const sameCommitments = originRows.filter(row => row.kind === 'directory_checkpoint_witness' &&
        (row.id === receipt.id || row.name === reference.name));
      if (hash(receiptBytes) !== origin.receiptDigest || receipt.id !== origin.receipt ||
          receipt.owner !== origin.owner || intent.id !== receipt.id || intent.owner !== origin.owner || receipt.intent !== hash(intentBytes) ||
          intent.name !== reference.name || intent.boundary !== origin.boundary || receipt.checkpoint.name !== reference.name ||
          receipt.checkpoint.digest !== reference.digest || receipt.checkpoint.boundary !== origin.boundary ||
          receipt.checkpoint.association !== origin.association || receipt.journal.events !== intent.journal.events + 1 ||
          intent.journal.bytes > receipt.journal.bytes || receipt.journal.bytes > originPrefix.length ||
          hash(originPrefix.subarray(0, intent.journal.bytes)) !== intent.journal.sha256 ||
          hash(originPrefix.subarray(0, receipt.journal.bytes)) !== receipt.journal.sha256 ||
          !checkpoint.success || checkpoint.data.name !== reference.name || checkpoint.data.digest !== reference.digest ||
          checkpoint.data.boundary !== origin.boundary || !commitment.success || commitment.data.owner !== origin.owner ||
          commitment.data.id !== receipt.id || commitment.data.name !== reference.name || commitment.data.witness !== hash(receiptBytes) ||
          sameCommitments.length !== 1 || (inheritedPaths && receipt.entries.some(entry => !inheritedPaths.some(path => JSON.stringify(path) === JSON.stringify(entry.path))))) return false;
    }
    if (!budget.read(sourceFile, JOURNAL_CAP).equals(source) ||
        fs.readdirSync(path.dirname(sourceFile)).some(name => name.startsWith(`${path.basename(sourceFile)}.torn-`)) !== sourceTorn) return false;
    for (const [file, saved] of origins) if (!budget.read(file, JOURNAL_CAP).equals(saved.journal) ||
        fs.readdirSync(path.dirname(file)).some(name => name.startsWith(`${path.basename(file)}.torn-`)) !== saved.torn) return false;
    for (const reference of recovered) if (!verifyRecoveredLineage(target.workspace, reference, visiting, budget)) return false;
    const again = target.readEvidence();
    budget.charge(again?.bytes.length ?? 0);
    if (!again || again.id !== torn.id || !again.bytes.equals(torn.bytes)) return false;
    const finalJournal = target.readJournal(); budget.charge(finalJournal.length);
    return finalJournal.equals(journal);
  } catch { return false; }
}

function verifyTornRecovery(session: Session, journal: Buffer, index: number, recovery: DirectoryCheckpointTornRecoveryEvent): boolean {
  return verifyTornRecoveryEvidence({ owner: session.id, workspace: session.config.workspace, events: session.events,
    readEvidence: () => readTornCheckpointEvidence(session), readJournal: () => session.checkpointJournalBytes() }, journal, index, recovery);
}

export function verifyDirectoryCheckpointTornCandidate(session: Session, recovery: DirectoryCheckpointTornRecoveryEvent): boolean {
  try {
    return recovery.targetJournal.events === session.events.length &&
      verifyTornRecovery(session, session.checkpointJournalBytes(), session.events.length, recovery);
  } catch { return false; }
}

// Host torn classification for Ole/rhe, sfn1dbxq [4694145,4697475)/[4728518,4730433), UTF-16;
// source has no retained host evidence or checkpoint-receipt transaction.
export function isReconciledCheckpointTorn(session: Session): boolean {
  try {
    const matches = session.events.flatMap((event, index) => event.kind === 'directory_checkpoint_torn_recovery' ? [{ event, index }] : []);
    if (matches.length !== 1) return false;
    const { event, index } = matches[0]!, candidate = event.candidate;
    const branchIndex = checkpointRecoveryAnchor(session.events, index), branch = session.events[branchIndex];
    if (!branch || branch.kind !== 'branch' || branch.source !== candidate.source || branch.workspace !== session.config.workspace ||
        branch.checkpointPaths?.kind !== 'available' || !branch.external || branch.external.kind === 'unknown' ||
        candidate.owner !== session.id || hash(JSON.stringify(branch)) !== candidate.branch) return false;
    const paths = branch.checkpointPaths.paths;
    if ((branch.external.kind === 'none' && paths.length !== 0) ||
        (branch.external.kind === 'unavailable' && branch.external.paths.some(file => !paths.some(item => item.lexicalPath === file))) ||
        new Set(paths.map(item => item.trackingPath)).size !== paths.length || new Set(paths.map(item => item.lexicalPath)).size !== paths.length) return false;
    const journal = session.checkpointJournalBytes();
    if (!verifyTornRecovery(session, journal, index, event)) return false;
    for (const reference of candidate.references) {
      const recorded = reference.origin, origin = 'kind' in recorded ? recorded.original : recorded;
      if (origin.workspace !== session.config.workspace) return false;
      const rows = session.events.slice(0, branchIndex).filter(row => row.kind === 'checkpoint' && row.name === reference.name);
      if (rows.length !== 1 || rows[0]?.kind !== 'checkpoint' || rows[0].boundary !== reference.boundary || rows[0].digest !== reference.digest) return false;
      const stored = readReceipt(origin.journal, origin.receipt), receipt = receiptSchema.parse(JSON.parse(stored.bytes.toString('utf8')));
      const intentBytes = readPrivate(intentFile(origin.journal, origin.receipt), META_CAP), intent = intentSchema.parse(JSON.parse(intentBytes.toString('utf8')));
      if (hash(stored.bytes) !== origin.receiptDigest || receipt.id !== origin.receipt || receipt.owner !== origin.owner ||
          intent.id !== origin.receipt || intent.owner !== origin.owner || receipt.intent !== hash(intentBytes) || intent.name !== reference.name ||
          intent.boundary !== origin.boundary || receipt.checkpoint.name !== reference.name || receipt.checkpoint.boundary !== origin.boundary ||
          receipt.checkpoint.digest !== reference.digest || receipt.checkpoint.association !== origin.association ||
          receipt.entries.length !== intent.paths.length || receipt.entries.some((entry, i) => JSON.stringify(entry.path) !== JSON.stringify(intent.paths[i]) ||
            !paths.some(item => JSON.stringify(item) === JSON.stringify(entry.path)))) return false;
      const association = inspectCheckpointAssociation(origin.workspace, reference.name, origin.owner, origin.boundary);
      if (!association || association.id !== origin.association || association.digest !== reference.digest) return false;
      for (const entry of receipt.entries) {
        const { observation } = entry;
        if (observation.kind === 'present' ? BigInt(observation.file.size) !== BigInt(observation.backup.bytes) : observation.backup.bytes !== 0) return false;
        backupBytes(origin.journal, observation.backup, false);
      }
      if (!readPrivate(stored.file, META_CAP).equals(stored.bytes) || !readPrivate(intentFile(origin.journal, origin.receipt), META_CAP).equals(intentBytes)) return false;
    }
    return verifyTornRecovery(session, journal, index, event);
  } catch { return false; }
}

export function hasUnresolvedDirectoryHistoryTorn(session: Session): boolean {
  const torn = fs.readdirSync(path.dirname(session.file)).some(name => name.startsWith(`${path.basename(session.file)}.torn-`));
  return (torn || session.events.some(event => event.kind === 'directory_checkpoint_torn_recovery')) && !isReconciledCheckpointTorn(session);
}

// Host lineage rewrite for kkn/AVr, sfn1dbxq [4747790,4749819)/[4744282,4746177), UTF-16;
// source copies backup files but does not commit intermediate torn-journal evidence.
function verifyRecoveredLineage(workspace: string, reference: DirectoryCheckpointReference, ancestors: ReadonlySet<string> = new Set(),
    budget = new RecoveryVerificationBudget()): boolean {
  try {
    budget.charge();
    const origin = reference.origin;
    if (!('kind' in origin) || !origin.proof || origin.proof.recoveryIndex >= origin.proof.journal.events ||
        ancestors.has(origin.owner) || origin.workspace !== workspace || origin.original.workspace !== workspace) return false;
    const lineage = origin.proof, file = path.join(workspace, '.agent', `${origin.owner}.jsonl`);
    if (origin.journal !== file) return false;
    const journal = budget.read(file, JOURNAL_CAP);
    const prefix = journal.subarray(0, lineage.journal.bytes);
    if (journal.at(-1) !== 10 || prefix.length !== lineage.journal.bytes || prefix.at(-1) !== 10 || hash(prefix) !== lineage.journal.sha256) return false;
    const rowSchema = z.object({ kind: z.string() }).passthrough();
    journal.toString('utf8').trimEnd().split('\n').forEach(line => rowSchema.parse(JSON.parse(line)));
    const rows = prefix.toString('utf8').trimEnd().split('\n').map(line => rowSchema.parse(JSON.parse(line)));
    if (rows.length !== lineage.journal.events) return false;
    const metadata = z.object({ kind: z.literal('metadata'), id: z.string().uuid(),
      config: z.object({ workspace: z.string() }).passthrough() }).passthrough().safeParse(rows[0]);
    const recovered = directoryCheckpointTornRecoverySchema.safeParse(rows[lineage.recoveryIndex]);
    if (!metadata.success || metadata.data.id !== origin.owner || metadata.data.config.workspace !== workspace || !recovered.success ||
        recovered.data.candidate.owner !== origin.owner || recovered.data.targetJournal.events !== lineage.recoveryIndex) return false;
    const encoded = Buffer.from(JSON.stringify(recovered.data) + '\n');
    if (!prefix.subarray(recovered.data.targetJournal.bytes, recovered.data.targetJournal.bytes + encoded.length).equals(encoded)) return false;
    const branchIndex = rows.findLastIndex((row, index) => index < lineage.recoveryIndex && row.kind === 'branch');
    const branchRow = rows[branchIndex];
    const branch = z.object({ kind: z.literal('branch'), source: z.string().uuid(), workspace: z.string(),
      external: directoryRewindExternalSchema, checkpointPaths: directoryCheckpointPathsSchema }).passthrough().safeParse(branchRow);
    if (!branch.success || branch.data.workspace !== workspace || branch.data.source !== recovered.data.candidate.source ||
        branch.data.external.kind === 'unknown' || branch.data.checkpointPaths.kind !== 'available' ||
        hash(JSON.stringify(branchRow)) !== recovered.data.candidate.branch) return false;
    const paths = branch.data.checkpointPaths.paths;
    if ((branch.data.external.kind === 'none' && paths.length !== 0) ||
        (branch.data.external.kind === 'unavailable' && branch.data.external.paths.some(name => !paths.some(item => item.lexicalPath === name))) ||
        new Set(paths.map(item => item.trackingPath)).size !== paths.length || new Set(paths.map(item => item.lexicalPath)).size !== paths.length) return false;
    if (origin.kind === 'torn-recovery') {
      const matches = recovered.data.candidate.references.filter(item => item.name === reference.name), original = matches[0];
      if (matches.length !== 1 || !original || original.digest !== reference.digest ||
          JSON.stringify('kind' in original.origin ? original.origin.original : original.origin) !== JSON.stringify(origin.original)) return false;
      const checkpoints = rows.slice(0, branchIndex).filter(row => row.kind === 'checkpoint' && row.name === reference.name);
      if (checkpoints.length !== 1 || checkpoints[0]?.digest !== original.digest || checkpoints[0]?.boundary !== original.boundary) return false;
      const receipt = receiptSchema.parse(JSON.parse(budget.receipt(origin.original.journal, origin.original.receipt).bytes.toString('utf8')));
      if (receipt.entries.some(entry => !paths.some(item => JSON.stringify(item) === JSON.stringify(entry.path)))) return false;
    } else {
      const original = origin.original;
      if (original.owner !== origin.owner || original.journal !== file) return false;
      const receiptBytes = budget.receipt(file, original.receipt).bytes, receipt = receiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')));
      const intentBytes = budget.read(intentFile(file, original.receipt), META_CAP), intent = intentSchema.parse(JSON.parse(intentBytes.toString('utf8')));
      const checkpointSchema = z.object({ kind: z.literal('checkpoint'), name: checkpointName, digest,
        boundary: z.number().int().nonnegative().safe() }).strict();
      const commitmentSchema = z.object({ kind: z.literal('directory_checkpoint_witness'), owner: z.string().uuid(),
        id: z.string().uuid(), name: checkpointName, witness: digest }).strict();
      const checkpoint = checkpointSchema.safeParse(rows[intent.journal.events]), commitment = commitmentSchema.safeParse(rows[receipt.journal.events]);
      const commitments = rows.filter(row => row.kind === 'directory_checkpoint_witness' && (row.id === original.receipt || row.name === reference.name));
      if (hash(receiptBytes) !== original.receiptDigest || receipt.id !== original.receipt || receipt.owner !== origin.owner ||
          intent.id !== original.receipt || intent.owner !== origin.owner || receipt.intent !== hash(intentBytes) ||
          intent.name !== reference.name || intent.boundary !== original.boundary || receipt.checkpoint.name !== reference.name ||
          receipt.checkpoint.boundary !== original.boundary || receipt.checkpoint.digest !== reference.digest ||
          receipt.checkpoint.association !== original.association || intent.journal.events <= lineage.recoveryIndex ||
          receipt.journal.events !== intent.journal.events + 1 || intent.journal.bytes > receipt.journal.bytes || receipt.journal.bytes > prefix.length ||
          hash(prefix.subarray(0, intent.journal.bytes)) !== intent.journal.sha256 || hash(prefix.subarray(0, receipt.journal.bytes)) !== receipt.journal.sha256 ||
          !checkpoint.success || checkpoint.data.name !== reference.name || checkpoint.data.digest !== reference.digest ||
          checkpoint.data.boundary !== original.boundary ||
          !prefix.subarray(intent.journal.bytes, receipt.journal.bytes).equals(Buffer.from(JSON.stringify(checkpoint.data) + '\n')) ||
          !commitment.success || commitment.data.owner !== origin.owner || commitment.data.id !== original.receipt ||
          commitment.data.name !== reference.name || commitment.data.witness !== hash(receiptBytes) || commitments.length !== 1) return false;
    }
    const target: RecoveryTarget = { owner: origin.owner, workspace, events: rows, readEvidence: () => readTornEvidenceFile(file),
      readJournal: () => readPrivate(file, JOURNAL_CAP) };
    return verifyTornRecoveryEvidence(target, journal, lineage.recoveryIndex, recovered.data, ancestors, budget);
  } catch { return false; }
}

// Host inheritance for Fet/Tke/Cwt and kHs, sfn1dbxq [4731316,4733481)/[4734814,4735645),
// 24k7d6mw [45367,46476), UTF-16; source has no cross-Session receipt commitment.
function inspectInherited(session: Session, name: string, batch?: { index: number; journal: Buffer }): CheckedWitness | undefined {
  try {
    checkpointName.parse(name);
    const journal = batch?.journal ?? session.checkpointJournalBytes();
    const matches = session.events.flatMap((row, index) => {
      const event = row.kind === 'directory_checkpoint_inheritance' ? row : row.kind === 'directory_checkpoint_torn_recovery' ? row.candidate : undefined;
      return event ? event.references.filter(reference => reference.name === name).map(reference => ({ event, index, reference,
        recovery: row.kind === 'directory_checkpoint_torn_recovery' ? row : undefined })) : [];
    });
    if (matches.length !== 1) return;
    const match = matches[0]; if (!match) return;
    const { event, index, reference, recovery } = match, origin = reference.origin;
    const recoveredOrigin = 'kind' in origin, receiptOrigin = recoveredOrigin ? origin.original : origin;
    if (batch && batch.index !== index) return;
    if (recovery ? !(batch?.index === index) && !verifyTornRecovery(session, journal, index, recovery) :
      fs.readdirSync(path.dirname(session.file)).some(value => value.startsWith(`${path.basename(session.file)}.torn-`))) return;
    if (recoveredOrigin && !verifyRecoveredLineage(session.config.workspace, reference)) return;
    const branchIndex = session.events.findLastIndex((row, i) => i < index && row.kind === 'branch');
    const branch = session.events[branchIndex];
    if (!branch || branch.kind !== 'branch' || !branch.checkpointPaths || event.owner !== session.id || event.source !== branch.source || event.branch !== hash(JSON.stringify(branch)) ||
        origin.workspace !== session.config.workspace || path.basename(origin.journal) !== `${origin.owner}.jsonl` ||
        receiptOrigin.workspace !== session.config.workspace || path.basename(receiptOrigin.journal) !== `${receiptOrigin.owner}.jsonl`) return;
    const checkpointRows = session.events.slice(0, branchIndex).filter(row => row.kind === 'checkpoint' && row.name === name);
    if (checkpointRows.length !== 1 || checkpointRows[0]?.kind !== 'checkpoint' || checkpointRows[0].digest !== reference.digest ||
        checkpointRows[0].boundary !== reference.boundary) return;
    const stored = readReceipt(receiptOrigin.journal, receiptOrigin.receipt), receiptBytes = stored.bytes;
    if (hash(receiptBytes) !== receiptOrigin.receiptDigest) return;
    const receipt = receiptSchema.parse(JSON.parse(receiptBytes.toString('utf8')));
    const intentBytes = readPrivate(intentFile(receiptOrigin.journal, receiptOrigin.receipt), META_CAP);
    const intent = intentSchema.parse(JSON.parse(intentBytes.toString('utf8')));
    if (receipt.id !== receiptOrigin.receipt || receipt.owner !== receiptOrigin.owner || intent.id !== receiptOrigin.receipt || intent.owner !== receiptOrigin.owner ||
        receipt.intent !== hash(intentBytes) || intent.name !== name || receipt.checkpoint.name !== name ||
        intent.boundary !== receiptOrigin.boundary || receipt.checkpoint.boundary !== receiptOrigin.boundary || receipt.checkpoint.digest !== reference.digest ||
        receipt.checkpoint.association !== receiptOrigin.association || receipt.journal.events !== intent.journal.events + 1 ||
        receipt.entries.length !== intent.paths.length || receipt.entries.some((entry, i) => JSON.stringify(entry.path) !== JSON.stringify(intent.paths[i]))) return;
    const association = inspectCheckpointAssociation(receiptOrigin.workspace, name, receiptOrigin.owner, receiptOrigin.boundary);
    if (!association || association.id !== receiptOrigin.association || association.digest !== reference.digest) return;
    const currentPaths = session.directoryCheckpointPathsAt(session.events.length); if (currentPaths.kind !== 'available') return;
    for (const entry of receipt.entries) {
      const current = currentPaths.paths.find(target => target.trackingPath === entry.path.trackingPath);
      if (!current || JSON.stringify(current) !== JSON.stringify(entry.path)) return;
      const { observation } = entry;
      if (observation.kind === 'present' ? BigInt(observation.file.size) !== BigInt(observation.backup.bytes) : observation.backup.bytes !== 0) return;
      backupBytes(receiptOrigin.journal, observation.backup, false);
    }
    syncDirectory(path.dirname(receiptOrigin.journal));
    if (!readPrivate(stored.file, META_CAP).equals(receiptBytes) ||
        !readPrivate(intentFile(receiptOrigin.journal, receiptOrigin.receipt), META_CAP).equals(intentBytes) ||
        (!batch && !session.checkpointJournalBytes().equals(journal))) return;
    for (const entry of receipt.entries) backupBytes(receiptOrigin.journal, entry.observation.backup, false);
    if (recoveredOrigin && !verifyRecoveredLineage(session.config.workspace, reference)) return;
    const entries: Extract<DirectoryCheckpointWitness, { kind: 'available' }>['entries'] = receipt.entries.map(entry => ({ path: entry.path,
      observation: entry.observation.kind === 'present' ? { kind: 'present', file: entry.observation.file, backupId: entry.observation.backup.id } :
        { kind: 'missing', parent: entry.observation.parent } }));
    for (const target of currentPaths.paths) {
      const previous = entries.find(entry => entry.path.trackingPath === target.trackingPath);
      if (previous && JSON.stringify(previous.path) !== JSON.stringify(target)) return;
      if (!previous) entries.push({ path: target, observation: { kind: 'unavailable' } });
    }
    session.checkpointGateIdentity();
    const inheritedOrigin: DirectoryCheckpointReference['origin'] = recovery ? { kind: 'torn-recovery', owner: session.id,
      workspace: session.config.workspace, journal: session.file, proof: { journal: { bytes: journal.length, sha256: hash(journal),
        events: session.events.length }, recoveryIndex: index }, original: receiptOrigin } : origin;
    return { receipt, witness: { kind: 'available', entries }, origin: inheritedOrigin };
  } catch { return; }
}

export function inspectDirectoryCheckpointTornRecovery(session: Session, candidate: DirectoryCheckpointInheritanceEvent): boolean {
  try {
    const index = session.events.findLastIndex(row => row.kind === 'directory_checkpoint_torn_recovery');
    const recovery = session.events[index];
    if (!recovery || recovery.kind !== 'directory_checkpoint_torn_recovery' || JSON.stringify(recovery.candidate) !== JSON.stringify(candidate)) return false;
    const journal = session.checkpointJournalBytes();
    if (!verifyTornRecovery(session, journal, index, recovery)) return false;
    for (const reference of candidate.references) {
      if (inspectInherited(session, reference.name, { index, journal })?.witness.kind !== 'available') return false;
    }
    return verifyTornRecovery(session, journal, index, recovery);
  } catch { return false; }
}

function inspect(session: Session, name: string): CheckedWitness | undefined {
  return session.events.some(event => event.kind === 'directory_checkpoint_witness' && event.name === name)
    ? inspectDirect(session, name) : inspectInherited(session, name);
}

export function collectDirectoryCheckpointReferences(source: Session, target: Session): DirectoryCheckpointReference[] {
  try {
    if (source.config.workspace !== target.config.workspace) return [];
    const branchIndex = target.events.findLastIndex(event => event.kind === 'branch'), branch = target.events[branchIndex];
    if (!branch || branch.kind !== 'branch' || branch.source !== source.id || branch.workspace !== source.config.workspace) return [];
    const rows = target.events.slice(0, branchIndex).filter(event => event.kind === 'checkpoint');
    if (rows.length > 4096) return [];
    const result: DirectoryCheckpointReference[] = [], seen = new Set<string>();
    for (const row of rows) {
      if (row.kind !== 'checkpoint' || seen.has(row.name)) return [];
      seen.add(row.name);
      const originals = source.events.filter(event => event.kind === 'checkpoint' && event.name === row.name && event.digest === row.digest);
      if (originals.length !== 1 || originals[0]?.kind !== 'checkpoint') continue;
      const original = originals[0];
      const sourceTurns = source.events.slice(0, original.boundary + 1).filter(event => event.kind === 'turn_end').length;
      const targetTurns = target.events.slice(0, row.boundary + 1).filter(event => event.kind === 'turn_end').length;
      if (sourceTurns !== targetTurns) continue;
      const checked = inspect(source, row.name); if (!checked || checked.receipt.checkpoint.digest !== row.digest) continue;
      result.push(directoryCheckpointReferenceSchema.parse({ name: row.name, digest: row.digest, boundary: row.boundary, origin: checked.origin }));
    }
    return Buffer.byteLength(JSON.stringify(result)) <= META_CAP ? result : [];
  } catch { return []; }
}

export function inspectDirectoryCheckpointWitness(session: Session, name: string): DirectoryCheckpointWitness {
  return inspect(session, name)?.witness ?? { kind: 'unknown' };
}

export function readDirectoryCheckpointBackup(session: Session, name: string, lexicalPath: string): Buffer | undefined {
  try {
    const checked = inspect(session, name);
    if (!checked || checked.witness.kind !== 'available') return;
    const entry = checked.receipt.entries.find(value => value.path.lexicalPath === lexicalPath);
    if (!entry || entry.observation.kind !== 'present') return;
    const origin = 'kind' in checked.origin ? checked.origin.original : checked.origin;
    const bytes = backupBytes(origin.journal, entry.observation.backup, true);
    session.checkpointGateIdentity();
    return bytes;
  } catch { return; }
}
