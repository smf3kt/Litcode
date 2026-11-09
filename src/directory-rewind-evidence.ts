import crypto from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { boundDirectoryFileObservationSchema } from './directory-file-state.js';
import type { DirectoryRewindPlan } from './directory-rewind-plan.js';

export const DIRECTORY_REWIND_BYTE_CAP = 32 * 1024 * 1024;
const hash = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex');
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = z.string().min(1).max(4096).refine(value => path.isAbsolute(value) && path.resolve(value) === value);
const parent = boundDirectoryFileObservationSchema.shape.parent;
const content = z.object({ bytes: z.number().int().min(0).max(DIRECTORY_REWIND_BYTE_CAP), sha256: digest }).strict();
const present = z.object({ kind: z.literal('present'), observation: boundDirectoryFileObservationSchema, content }).strict();
const missing = z.object({ kind: z.literal('missing'), parent }).strict();
const state = z.discriminatedUnion('kind', [present, missing]);
const completed = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('durable'), observation: boundDirectoryFileObservationSchema,
    held: boundDirectoryFileObservationSchema.optional() }).strict(),
  z.object({ kind: z.literal('quarantined'), observation: boundDirectoryFileObservationSchema }).strict(),
]);
const stage = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('prepared') }).strict(),
  z.object({ kind: z.literal('attempting'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('refused'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('completed'), id: z.string().uuid(), result: completed, reconciledReceipt: digest.optional() }).strict(),
  z.object({ kind: z.literal('unknown'), id: z.string().uuid() }).strict(),
]);
const rollback = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attempting'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('unknown'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('refused'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('completed'), id: z.string().uuid(), result: completed, reconciledReceipt: digest.optional() }).strict(),
]);
export const directoryNativeReceiptSchema = z.object({ dev: z.string().regex(/^[0-9]+$/), ino: z.string().regex(/^[0-9]+$/) }).strict();
export const capturedDirectoryContinuationSchema = z.object({ kind: z.literal('publish-captured'), id: z.string().uuid(), receiptDigest: digest,
  parent, held: boundDirectoryFileObservationSchema, staged: boundDirectoryFileObservationSchema }).strict();
export type CapturedDirectoryContinuation = z.infer<typeof capturedDirectoryContinuationSchema>;
export const directoryPreparationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('absent'), parent }).strict(),
  z.object({ kind: z.literal('retained'), staged: state }).strict(),
]);
export type DirectoryPreparation = z.infer<typeof directoryPreparationSchema>;
export const directoryCreationPreparationSchema = z.union([directoryPreparationSchema,
  z.object({ kind: z.literal('metadata'), content: z.literal('unverified'), observation: boundDirectoryFileObservationSchema }).strict(),
]);
export type DirectoryCreationPreparation = z.infer<typeof directoryCreationPreparationSchema>;
export const directoryCreationSchema = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('preparing'), id: z.string().uuid(), receipt: directoryNativeReceiptSchema }).strict(),
  z.object({ phase: z.literal('publishing'), id: z.string().uuid(), receipt: directoryNativeReceiptSchema,
    preparationDigest: digest, staged: boundDirectoryFileObservationSchema }).strict(),
]);
export type DirectoryCreation = z.infer<typeof directoryCreationSchema>;
const noEffectAttempt = z.object({ id: z.string().uuid(), reverse: z.boolean(), receipt: directoryNativeReceiptSchema, digest,
  preparation: directoryCreationPreparationSchema.optional(),
  creation: z.object({ evidence: directoryCreationSchema, digest }).strict().optional() }).strict();
export const linkedNormalizationSchema = z.object({ id: z.string().uuid(), receipt: directoryNativeReceiptSchema,
  originalReceiptDigest: digest, alias: z.string().regex(/^\.litcode-tmp-[0-9]+-[0-9]+$/),
  completedReceiptDigest: digest.optional(),
  pair: boundDirectoryFileObservationSchema.extend({ nlink: z.literal('2') }),
  captured: z.object({ held: boundDirectoryFileObservationSchema, staged: boundDirectoryFileObservationSchema, receiptDigest: digest.optional() }).strict().optional(),
}).strict();
export type LinkedNormalization = z.infer<typeof linkedNormalizationSchema>;
const abandonedNormalization = z.object({ attemptId: z.string().uuid(), reverse: z.boolean(), digest,
  preparation: directoryPreparationSchema.optional(),
  normalization: linkedNormalizationSchema.omit({ captured: true, completedReceiptDigest: true }) }).strict();
const common = { path: absolute, continuation: capturedDirectoryContinuationSchema.optional(), rollbackContinuation: capturedDirectoryContinuationSchema.optional(),
  creation: directoryCreationSchema.optional(), rollbackCreation: directoryCreationSchema.optional(),
  normalization: linkedNormalizationSchema.optional(), rollbackNormalization: linkedNormalizationSchema.optional(),
  abandonedNormalizations: z.array(abandonedNormalization).optional(),
  noEffectAttempts: z.array(noEffectAttempt).optional(),
  receipt: directoryNativeReceiptSchema.optional(), rollbackReceipt: directoryNativeReceiptSchema.optional(), rollback: rollback.optional(), grant: z.object({ root: absolute, owner: z.string().uuid(), incarnation: z.string().uuid(),
  dev: z.string().regex(/^[0-9]+$/), ino: z.string().regex(/^[0-9]+$/) }).strict(), stage };
const operation = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('write'), before: state, after: present }).strict(),
  z.object({ ...common, action: z.literal('remove'), before: present, after: missing }).strict(),
]);

// Host durable evidence for Cwt/kVr/RVr, sfn1dbxq
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4734814,4737243)/[4740702,4743506). Source has no mixed workspace
// transaction. A prepared record or matching bytes never prove execution.
export const directoryRewindEvidenceSchema = z.object({ version: z.literal(1), owner: z.string().uuid(),
  checkpoint: z.object({ owner: z.string().uuid(), name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), digest }).strict(),
  plan: digest, operations: z.array(operation).min(1).max(4096) }).strict().superRefine((record, context) => {
  const paths = new Set<string>();
  let bytes = 0;
  for (const entry of record.operations) {
    const relative = path.relative(entry.grant.root, entry.path);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) ||
        entry.grant.owner !== record.owner || paths.has(entry.path.toLowerCase())) context.addIssue({ code: 'custom', message: 'Invalid directory rewind path ownership' });
    paths.add(entry.path.toLowerCase());
    const abandoned = new Set<string>();
    const abandonedNormalizationIds = new Set<string>();
    for (const entryAttempt of entry.abandonedNormalizations ?? []) {
      const attempt = entryAttempt.reverse ? entry.rollback : entry.stage;
      const current = entryAttempt.reverse ? entry.rollbackNormalization : entry.normalization;
      const from = entryAttempt.reverse ? entry.after : entry.before, to = entryAttempt.reverse ? entry.before : entry.after;
      if (!attempt || attempt.kind === 'prepared' || attempt.kind === 'refused' || attempt.id !== entryAttempt.attemptId ||
          from.kind !== 'missing' || to.kind !== 'present' || !(entryAttempt.reverse ? entry.rollbackReceipt : entry.receipt) ||
          current?.id === entryAttempt.normalization.id || attempt.id === entryAttempt.normalization.id ||
          abandonedNormalizationIds.has(entryAttempt.normalization.id))
        context.addIssue({ code: 'custom', message: 'Invalid abandoned normalization provenance' });
      abandonedNormalizationIds.add(entryAttempt.normalization.id);
    }
    for (const attempt of entry.noEffectAttempts ?? []) {
      if (attempt.preparation?.kind === 'metadata' && (!attempt.creation || attempt.creation.evidence.phase !== 'publishing'))
        context.addIssue({ code: 'custom', message: 'Metadata-only preparation lacks a bound creation publication phase' });
      if (abandoned.has(attempt.id) || (attempt.reverse ? entry.stage.kind !== 'completed' || entry.rollback?.id === attempt.id :
          entry.stage.kind !== 'refused' || entry.stage.id !== attempt.id || !entry.receipt ||
          entry.receipt.dev !== attempt.receipt.dev || entry.receipt.ino !== attempt.receipt.ino))
        context.addIssue({ code: 'custom', message: 'Invalid no-effect attempt provenance' });
      abandoned.add(attempt.id);
    }
    for (const reverse of [false, true]) {
      const normalization = reverse ? entry.rollbackNormalization : entry.normalization;
      const normalizedAttempt = reverse ? entry.rollback : entry.stage;
      const from = reverse ? entry.after : entry.before, to = reverse ? entry.before : entry.after;
      const creation = reverse ? entry.rollbackCreation : entry.creation;
      if (creation && (from.kind !== 'missing' || to.kind !== 'present' || !normalizedAttempt ||
          normalizedAttempt.kind === 'prepared' || normalizedAttempt.kind === 'refused' || normalizedAttempt.id === creation.id ||
          !(reverse ? entry.rollbackReceipt : entry.receipt) || normalization ||
          (normalizedAttempt.kind === 'completed' && creation.phase !== 'publishing') ||
          (creation.phase === 'publishing' && (creation.staged.mode !== 0o600 || creation.staged.nlink !== '1' ||
            creation.staged.size !== String(to.content.bytes) || creation.staged.parent.dev !== from.parent.dev ||
            creation.staged.parent.ino === from.parent.ino))))
        context.addIssue({ code: 'custom', message: 'Invalid retained creation provenance' });
      if (normalization && (from.kind !== 'missing' || to.kind !== 'present' || !normalizedAttempt ||
          normalizedAttempt.kind === 'prepared' || normalizedAttempt.kind === 'refused' || normalizedAttempt.id === normalization.id ||
          !(reverse ? entry.rollbackReceipt : entry.receipt) ||
          (normalizedAttempt.kind === 'completed' && normalizedAttempt.result.kind !== 'durable')))
        context.addIssue({ code: 'custom', message: 'Linked normalization lacks its bound create attempt' });
      if (normalization && (normalizedAttempt?.kind === 'completed' ? !normalization.completedReceiptDigest : normalization.completedReceiptDigest !== undefined))
        context.addIssue({ code: 'custom', message: 'Linked normalization receipt digest lacks a completed attempt' });
      const continuation = reverse ? entry.rollbackContinuation : entry.continuation, attempt = reverse ? entry.rollback : entry.stage;
      if (continuation && (entry.before.kind !== 'present' || entry.after.kind !== 'present' || !attempt || attempt.kind === 'prepared' ||
          attempt.kind === 'refused' || attempt.id !== continuation.id || !(reverse ? entry.rollbackReceipt : entry.receipt)))
        context.addIssue({ code: 'custom', message: 'Captured continuation lacks its bound replacement attempt' });
    }
    if ((entry.receipt && entry.stage.kind === 'prepared') || (entry.rollbackReceipt && !entry.rollback))
      context.addIssue({ code: 'custom', message: 'Directory native receipt lacks an attempt' });
    if ((entry.stage.kind === 'completed' && entry.stage.reconciledReceipt && !entry.receipt) ||
        (entry.rollback?.kind === 'completed' && entry.rollback.reconciledReceipt && !entry.rollbackReceipt))
      context.addIssue({ code: 'custom', message: 'Reconciled directory outcome lacks a receipt' });
    for (const file of [entry.before, entry.after]) if (file.kind === 'present') {
      bytes += file.content.bytes;
      if (BigInt(file.observation.size) !== BigInt(file.content.bytes)) context.addIssue({ code: 'custom', message: 'Directory rewind content size mismatch' });
    }
    if (entry.stage.kind === 'completed' && ((entry.action === 'write') !== (entry.stage.result.kind === 'durable')))
      context.addIssue({ code: 'custom', message: 'Directory rewind outcome/action mismatch' });
    if (entry.rollback && (entry.stage.kind !== 'completed' || (entry.rollback.kind === 'completed' &&
        ((entry.before.kind === 'present') !== (entry.rollback.result.kind === 'durable')))))
      context.addIssue({ code: 'custom', message: 'Directory rewind rollback outcome/action mismatch' });
  }
  if (bytes > DIRECTORY_REWIND_BYTE_CAP) context.addIssue({ code: 'custom', message: 'Directory rewind byte budget exceeded' });
});
export type DirectoryRewindEvidence = z.infer<typeof directoryRewindEvidenceSchema>;

export function directoryRewindPlanDigest(plan: Omit<Extract<DirectoryRewindPlan, { kind: 'available' }>, 'digest'>): string {
  const describe = (state: typeof plan.entries[number]['before']) => state.kind === 'missing' ? state :
    { kind: state.kind, observation: state.observation, sha256: hash(state.bytes) };
  return hash(Buffer.from(JSON.stringify({ owner: plan.owner, checkpoint: plan.checkpoint,
    entries: plan.entries.map(entry => ({ ...entry, before: describe(entry.before), after: describe(entry.after) })) })));
}

// Stable across an explicitly carried source-to-successor grant handoff.
export function directoryRewindTargetDigest(plan: Extract<DirectoryRewindPlan, { kind: 'available' }>): string {
  const describe = (state: typeof plan.entries[number]['before']) => state.kind === 'missing' ? state :
    { kind: state.kind, observation: state.observation, sha256: hash(state.bytes) };
  return hash(Buffer.from(JSON.stringify({ checkpoint: plan.checkpoint, entries: plan.entries.map(entry => ({
    path: entry.path, action: entry.action, grant: { root: entry.grant.root, dev: entry.grant.dev, ino: entry.grant.ino },
    before: describe(entry.before), after: describe(entry.after) })) })));
}

export function encodeDirectoryRewindPlan(plan: Extract<DirectoryRewindPlan, { kind: 'available' }>):
  { record: DirectoryRewindEvidence; objects: Map<string, Buffer> } | undefined {
  if (directoryRewindPlanDigest(plan) !== plan.digest) throw new Error('Directory rewind plan changed before encoding');
  const objects = new Map<string, Buffer>();
  const describe = (file: typeof plan.entries[number]['before']) => {
    if (file.kind === 'missing') return file;
    const bytes = Buffer.from(file.bytes), sha256 = hash(bytes);
    objects.set(sha256, bytes);
    return { kind: file.kind, observation: file.observation, content: { bytes: bytes.length, sha256 } };
  };
  const operations = plan.entries.filter(entry => entry.action !== 'unchanged').map(entry => ({ path: entry.path, grant: entry.grant,
    action: entry.action, before: describe(entry.before), after: describe(entry.after), stage: { kind: 'prepared' } }));
  if (!operations.length) return;
  const record = directoryRewindEvidenceSchema.parse({ version: 1, owner: plan.owner, checkpoint: plan.checkpoint, plan: plan.digest, operations });
  return { record, objects };
}

export function verifyDirectoryRewindObjects(record: DirectoryRewindEvidence, read: (sha256: string) => Buffer): Map<string, Buffer> {
  const checked = directoryRewindEvidenceSchema.parse(record), objects = new Map<string, Buffer>();
  for (const operation of checked.operations) for (const file of [operation.before, operation.after]) {
    if (file.kind !== 'present') continue;
    const bytes = objects.get(file.content.sha256) ?? Buffer.from(read(file.content.sha256));
    if (bytes.length !== file.content.bytes || hash(bytes) !== file.content.sha256) throw new Error('Directory rewind object changed');
    objects.set(file.content.sha256, bytes);
  }
  return objects;
}
