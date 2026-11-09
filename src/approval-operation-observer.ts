import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { Session, SessionEvent } from './session.js';

// zyn, 9dhv0d4w c4470ca90407cae041b2e0c29625c7cb382cc03ab0899dbc66fae53321edc3a0
// [1892,4679); _Wo/Cge, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// [2237279,2240346), UTF-16. S3 host journal; source has no durable approval receipt.
export const approvalOperationSchema = z.object({
  kind: z.literal('approval_operation'), owner: z.string().uuid(), requestId: z.string().uuid(),
  admissionIndex: z.number().int().nonnegative(),
  scope: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('registry'), bindingId: z.string().uuid() }).strict(),
    z.object({ kind: z.literal('skill') }).strict(),
  ]),
  phase: z.enum(['admitted', 'fulfilled', 'rejected']),
}).strict();
export type ApprovalOperationEvent = z.infer<typeof approvalOperationSchema>;
const writes = new WeakMap<object, { owner: Session; event: ApprovalOperationEvent }>();

/** Observe operation settlement only; neither opaque input nor decision is attested. */
export async function observeApprovalOperation<T>(owner: Session | undefined, scope: ApprovalOperationEvent['scope'], body: () => Promise<T>): Promise<T> {
  if (!owner?.isOpen) return body();
  if (owner.isJournalFenced) throw new Error('Approval operation owner unavailable before invocation');
  const binding = { owner: owner.id, requestId: randomUUID(), admissionIndex: owner.events.length, scope: Object.freeze({ ...scope }) };
  const record = (phase: ApprovalOperationEvent['phase']) => {
    if (phase !== 'admitted' && (!owner.isOpen || owner.isJournalFenced)) return;
    const event: ApprovalOperationEvent = Object.freeze({ kind: 'approval_operation', ...binding, phase });
    writes.set(event, { owner, event });
    try { owner.append(event); } finally { writes.delete(event); }
  };
  record('admitted');
  let result: T;
  try { result = await body(); } catch (error) { record('rejected'); throw error; }
  record('fulfilled'); return result;
}
export function consumeApprovalOperationWrite(owner: Session, event: object): ApprovalOperationEvent | undefined {
  const saved = writes.get(event); writes.delete(event);
  return saved?.owner === owner ? saved.event : undefined;
}
export function approvalOperations(events: readonly SessionEvent[], owner: string): ApprovalOperationEvent[] {
  const states = new Map<string, ApprovalOperationEvent>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'approval_operation') continue;
    const before = states.get(event.requestId), invalid = () => new Error('Invalid approval operation history');
    if (event.owner !== owner) throw invalid();
    if (event.phase === 'admitted') { if (before || event.admissionIndex !== index) throw invalid(); }
    else if (!before || before.phase !== 'admitted' || before.admissionIndex !== event.admissionIndex || !isDeepStrictEqual(before.scope, event.scope)) throw invalid();
    states.set(event.requestId, event);
  }
  return [...states.values()];
}
