import path from 'node:path';
import { z } from 'zod';
import { sessionGateIdentitySchema } from './session-lock-record.js';

const identity = z.string().regex(/^[0-9]+$/);
const version = z.number().int().positive().safe();
const parentSchema = z.object({ dev: identity, ino: identity }).strict();
export const directoryHistoryPathSchema = z.object({ trackingPath: z.string().min(1).max(4096),
  lexicalPath: z.string().min(1).max(4096), resolvedRelative: z.string().min(1).max(4096).optional(),
  grant: z.object({ root: z.string().min(1).max(4096), dev: identity, ino: identity }).strict() }).strict();
export const directoryCheckpointPathsSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('unknown') }).strict(),
  z.object({ kind: z.literal('available'), paths: z.array(directoryHistoryPathSchema).max(4096) }).strict(),
]);
const absolutePath = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && path.resolve(value) === value);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const recoveryJournalSchema = z.object({ bytes: z.number().int().positive().safe().max(100 * 1024 * 1024),
  sha256, events: z.number().int().positive().safe() }).strict();
const directCheckpointOriginSchema = z.object({ owner: z.string().uuid(), workspace: absolutePath, journal: absolutePath,
  receipt: z.string().uuid(), receiptDigest: sha256, boundary: z.number().int().nonnegative().safe(), association: z.string().uuid() }).strict();
const recoveredCheckpointOriginSchema = z.object({ kind: z.enum(['torn-recovery', 'post-torn-checkpoint']), owner: z.string().uuid(), workspace: absolutePath,
  journal: absolutePath, proof: z.object({ journal: recoveryJournalSchema, recoveryIndex: z.number().int().nonnegative().safe() }).strict().optional(),
  original: directCheckpointOriginSchema }).strict();
export const directoryCheckpointReferenceSchema = z.object({ name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/),
  digest: sha256, boundary: z.number().int().nonnegative().safe(),
  origin: z.union([directCheckpointOriginSchema, recoveredCheckpointOriginSchema]) }).strict();
export const directoryCheckpointInheritanceSchema = z.object({ kind: z.literal('directory_checkpoint_inheritance'), owner: z.string().uuid(),
  source: z.string().uuid(), branch: sha256, references: z.array(directoryCheckpointReferenceSchema).min(1).max(4096) }).strict();
export const directoryCheckpointTornRecoverySchema = z.object({ kind: z.literal('directory_checkpoint_torn_recovery'),
  candidate: directoryCheckpointInheritanceSchema, evidence: z.object({ id: z.string().uuid(), sha256 }).strict(),
  sourceJournal: recoveryJournalSchema, targetJournal: recoveryJournalSchema,
  sourceLock: z.object({ pid: z.number().int().positive(), dev: identity, ino: identity, uid: identity, mode: identity,
    size: identity, mtimeNs: identity, ctimeNs: identity, gate: sessionGateIdentitySchema }).strict().optional() }).strict();
export const directoryHistoryReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('present'), origin: z.enum(['tool', 'snapshot']), backupId: z.string().uuid(), version }).strict(),
  z.object({ kind: z.literal('missing'), parent: parentSchema, version }).strict(),
  z.object({ kind: z.literal('unknown'), lastKnownVersion: z.number().int().nonnegative().safe(),
    reason: z.enum(['grant-unavailable', 'interrupted', 'unstable', 'corrupt']) }).strict(),
]);
export const directoryHistoryEntrySchema = z.object({ path: directoryHistoryPathSchema, reference: directoryHistoryReferenceSchema }).strict();
export const directoryRewindExternalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('unavailable'), paths: z.array(z.string().min(1).max(4096)).min(1) }).strict(),
  z.object({ kind: z.literal('unknown') }).strict(),
]);
export const directorySnapshotIntentSchema = z.object({ kind: z.literal('directory_snapshot_intent'), id: z.string().uuid(),
  owner: z.string().uuid(), messageId: z.string().uuid(), paths: z.array(directoryHistoryPathSchema), timestamp: z.string().datetime({ offset: true }) }).strict();
export const directorySnapshotObservationSchema = z.object({ kind: z.literal('directory_snapshot_observation'), snapshotId: z.string().uuid(),
  owner: z.string().uuid(), entry: directoryHistoryEntrySchema }).strict();
export const directorySnapshotSchema = z.object({ kind: z.literal('directory_snapshot'), id: z.string().uuid(), owner: z.string().uuid(),
  messageId: z.string().uuid(), entries: z.array(directoryHistoryEntrySchema), timestamp: z.string().datetime({ offset: true }),
  preCheckpoint: z.literal(true).optional(), interrupted: z.literal(true).optional() }).strict();
export const directorySnapshotRecoverySchema = z.object({ kind: z.literal('directory_snapshot_recovery'), id: z.string().uuid(), owner: z.string().uuid(),
  messageId: z.string().uuid(), entries: z.array(directoryHistoryEntrySchema), timestamp: z.string().datetime({ offset: true }),
  unconfirmed: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict();
export type DirectoryHistoryPath = z.infer<typeof directoryHistoryPathSchema>;
export type DirectoryCheckpointPaths = z.infer<typeof directoryCheckpointPathsSchema>;
export type DirectoryCheckpointReference = z.infer<typeof directoryCheckpointReferenceSchema>;
export type DirectoryCheckpointInheritanceEvent = z.infer<typeof directoryCheckpointInheritanceSchema>;
export type DirectoryCheckpointTornRecoveryEvent = z.infer<typeof directoryCheckpointTornRecoverySchema>;
export type DirectoryHistoryEntry = z.infer<typeof directoryHistoryEntrySchema>;
export type DirectoryHistoryReference = DirectoryHistoryEntry['reference'];
export type DirectoryRewindExternal = z.infer<typeof directoryRewindExternalSchema>;
export type DirectorySnapshotIntentEvent = z.infer<typeof directorySnapshotIntentSchema>;
export type DirectorySnapshotObservationEvent = z.infer<typeof directorySnapshotObservationSchema>;
export type DirectorySnapshotEvent = z.infer<typeof directorySnapshotSchema>;
export type DirectorySnapshotRecoveryEvent = z.infer<typeof directorySnapshotRecoverySchema>;
export type DirectoryHistorySnapshot = { messageId: string; timestamp: string; entries: DirectoryHistoryEntry[]; preCheckpoint?: true };
export type DirectoryHistoryState = { snapshots: DirectoryHistorySnapshot[]; trackedFiles: Map<string, DirectoryHistoryPath>;
  trackSequence: number; snapshotSequence: number };
export type DirectoryRewindEntry = { path: DirectoryHistoryPath; reference: DirectoryHistoryReference | { kind: 'unavailable' } };
export type DirectoryRewindSelection = { kind: 'unknown' } | { kind: 'not_found' } |
  { kind: 'available'; messageId: string; entries: DirectoryRewindEntry[] };
export type DirectoryHistoryOperation =
  | { kind: 'track'; snapshotMessageId: string; entry: DirectoryHistoryEntry }
  | { kind: 'snapshot'; snapshot: DirectoryHistorySnapshot }
  | { kind: 'touch' };

// R$n/SRe, sfn1dbxq [4743628,4743772), UTF-16; this Session's execution workspace supplies Ee().
export function directoryHistoryTrackingPath(workspace: string, file: string): string {
  if (!path.isAbsolute(file)) return file;
  return file.startsWith(workspace) ? path.relative(workspace, file) : file;
}

export function emptyDirectoryFileHistory(): DirectoryHistoryState {
  return { snapshots: [], trackedFiles: new Map(), trackSequence: 0, snapshotSequence: 0 };
}

// Fet, sfn1dbxq [4731316,4732048), UTF-16: only the first backup tracks a path.
export function shouldTrackDirectoryHistory(state: DirectoryHistoryState, trackingPath: string): boolean {
  return state.snapshots.length > 0 && !state.snapshots.some(snapshot => snapshot.entries.some(entry => entry.path.trackingPath === trackingPath));
}

// Tke, sfn1dbxq [4732048,4733481), UTF-16; host UUID sidecars retain versions explicitly.
export function nextDirectoryHistoryVersion(state: DirectoryHistoryState, trackingPath: string): number {
  let greatest = 0;
  for (const snapshot of state.snapshots) {
    const entry = snapshot.entries.find(value => value.path.trackingPath === trackingPath);
    if (!entry) continue;
    const candidate = entry.reference.kind === 'unknown' ? entry.reference.lastKnownVersion : entry.reference.version;
    greatest = Math.max(greatest, candidate);
  }
  const next = greatest + 1;
  if (!Number.isSafeInteger(next)) throw new Error('Directory file history has no usable next version');
  return next;
}

// Cwt/kVr/E$n, sfn1dbxq [4734814,4737243)/[4743506,4743628), UTF-16.
// An unknown host observation cannot establish which retained version was first.
export function selectDirectoryRewindSnapshot(state: DirectoryHistoryState, messageId: string): DirectoryRewindSelection {
  const selected = state.snapshots.findLast(snapshot => snapshot.messageId === messageId);
  if (!selected) return { kind: 'not_found' };
  const entries = [...state.trackedFiles.values()].map<DirectoryRewindEntry>(target => {
    const found = selected.entries.find(entry => entry.path.trackingPath === target.trackingPath);
    if (found) return { path: target, reference: found.reference };
    for (const snapshot of state.snapshots) {
      const candidate = snapshot.entries.find(entry => entry.path.trackingPath === target.trackingPath)?.reference;
      if (candidate && (candidate.kind === 'unknown' || candidate.version === 1)) return { path: target, reference: candidate };
    }
    return { path: target, reference: { kind: 'unavailable' } };
  });
  return { kind: 'available', messageId, entries };
}

// rhe, sfn1dbxq [4728518,4730433), UTF-16; NMt, gsnbskq4 [10715,10722), UTF-16, is 100.
export function reduceDirectoryFileHistory(state: DirectoryHistoryState, operation: DirectoryHistoryOperation): DirectoryHistoryState {
  if (operation.kind === 'touch') return { ...state, trackSequence: state.trackSequence + 1 };
  if (operation.kind === 'track') {
    const latest = state.snapshots.at(-1);
    if (!latest) return state;
    if (latest.messageId !== operation.snapshotMessageId) throw new Error('Directory file history snapshot owner mismatch');
    const trackSequence = state.trackSequence + 1, key = operation.entry.path.trackingPath;
    if (latest.entries.some(entry => entry.path.trackingPath === key)) return { ...state, trackSequence };
    const trackedFiles = new Map(state.trackedFiles);
    if (!trackedFiles.has(key)) trackedFiles.set(key, operation.entry.path);
    const snapshots = state.snapshots.slice();
    snapshots[snapshots.length - 1] = { ...latest, entries: [...latest.entries, operation.entry] };
    return { ...state, snapshots, trackedFiles, trackSequence };
  }
  const latest = state.snapshots.at(-1), entries = [...operation.snapshot.entries];
  const keys = new Set(entries.map(entry => entry.path.trackingPath));
  if (keys.size !== entries.length) throw new Error('Duplicate directory file history path');
  if (latest) for (const key of state.trackedFiles.keys()) {
    if (keys.has(key)) continue;
    const previous = latest.entries.find(entry => entry.path.trackingPath === key);
    if (previous) entries.push(previous);
  }
  const earlier = operation.snapshot.preCheckpoint ? state.snapshots.map(snapshot => {
    if (snapshot.messageId !== operation.snapshot.messageId || !snapshot.preCheckpoint) return snapshot;
    const { preCheckpoint: _removed, ...rest } = snapshot;
    return rest;
  }) : state.snapshots;
  return { ...state, snapshots: [...earlier, { ...operation.snapshot, entries }].slice(-100), snapshotSequence: state.snapshotSequence + 1 };
}
