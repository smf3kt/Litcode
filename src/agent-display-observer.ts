import { createHash, randomUUID } from 'node:crypto';
import { types } from 'node:util';
import { z } from 'zod';
import type { AgentEvents } from './agent.js';
import type { AgentProgressEvent } from './tui-progress.js';
import type { Session, SessionEvent } from './session.js';

// LLe [619331,619362), Bkr [3041260,3041307), UTF-16, sfn1dbxq SHA
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// S3 host observer journal; source writes directly and has no callback/fsync interface.
export const agentDisplaySchema = z.object({
  kind: z.literal('agent_display_observer'), owner: z.string().uuid(), invocationId: z.string().uuid(),
  callback: z.enum(['status', 'progress', 'terminalSequence', 'agentProgress', 'clearAgentProgress']), admissionIndex: z.number().int().nonnegative(),
  inputEvidence: z.literal('unobserved').optional(),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/),
  transition: z.discriminatedUnion('phase', [
    z.object({ phase: z.literal('admitted') }).strict(),
    z.object({ phase: z.literal('absent'), basis: z.literal('inert_lookup') }).strict(),
    z.object({ phase: z.literal('returned'), mode: z.enum(['absent', 'sync', 'promise']) }).strict(),
    z.object({ phase: z.literal('threw') }).strict(),
    z.object({ phase: z.literal('settled'), outcome: z.enum(['fulfilled', 'rejected']) }).strict(),
    z.object({ phase: z.literal('unobserved') }).strict(),
  ]),
}).strict();
export type AgentDisplayEvent = z.infer<typeof agentDisplaySchema>;
export type AgentDisplayArgs = [name: 'status' | 'terminalSequence' | 'clearAgentProgress', value: string]
  | [name: 'progress', value: AgentProgressEvent]
  | [name: 'agentProgress', value: Parameters<NonNullable<AgentEvents['agentProgress']>>[0]];
const writes = new WeakMap<object, { owner: Session; event: AgentDisplayEvent }>();
const unobservedChildInput = createHash('sha256').update('unobserved:agentProgress').digest('hex');
const ownDescriptor = Object.getOwnPropertyDescriptor, prototypeOf = Object.getPrototypeOf, isProxy = types.isProxy;
// Descriptor inspection on non-Proxies invokes neither getters nor proxy traps.
// A getter returning undefined is deliberately not this proof.
function inertAbsence(receiver: object, name: AgentDisplayArgs[0]): boolean {
  let current: object | null = receiver;
  while (current !== null) {
    if (isProxy(current)) return false;
    const descriptor = ownDescriptor(current, name);
    if (descriptor) return 'value' in descriptor && (descriptor.value === undefined || descriptor.value === null);
    current = prototypeOf(current);
  }
  return true;
}
export function observeAgentDisplay(owner: Session, receiver: AgentEvents, ...[name, value]: AgentDisplayArgs): void {
  // Retired cleanup can still report to its original consumer, without borrowing
  // a reopened Session. No durable effect claim is made for that path.
  if (!owner.isOpen) {
    const callback = receiver[name];
    if (callback !== undefined && callback !== null) Reflect.apply(callback, receiver, [value]);
    return;
  }
  if (owner.isJournalFenced) throw new Error('Display observer owner unavailable before invocation');
  // wj6fycw8 [38800,42500)/[44500,45150), UTF-16, SHA
  // ce38912bf9ddb32271235f9639bd42afb9c42c11ce66ee1d4471362d4a99d8ae.
  // Child input may contain arbitrary getters/Proxies. This observes callback
  // execution only; the sentinel is explicitly not a payload fingerprint.
  const inputEvidence = name === 'agentProgress' ? 'unobserved' : undefined;
  const binding: Omit<AgentDisplayEvent, 'kind' | 'transition'> = { owner: owner.id, invocationId: randomUUID(), callback: name, admissionIndex: owner.events.length,
    ...(inputEvidence === undefined ? {} : { inputEvidence }),
    inputSha256: inputEvidence === undefined ? createHash('sha256').update(JSON.stringify(value)).digest('hex') : unobservedChildInput };
  const record = (transition: AgentDisplayEvent['transition']) => {
    if (transition.phase !== 'admitted' && !owner.isOpen) return;
    const event: AgentDisplayEvent = Object.freeze({ kind: 'agent_display_observer', ...binding, transition: Object.freeze(transition) });
    writes.set(event, { owner, event });
    try { owner.append(event); } finally { writes.delete(event); }
  };
  record({ phase: 'admitted' });
  if (inertAbsence(receiver, name)) { record({ phase: 'absent', basis: 'inert_lookup' }); return; }
  let returned: unknown, present: boolean;
  try {
    const callback = receiver[name];
    present = callback !== undefined && callback !== null;
    if (callback !== undefined && callback !== null) returned = Reflect.apply(callback, receiver, [value]);
  } catch (error) { record({ phase: 'threw' }); throw error; }
  if (!present) { record({ phase: 'returned', mode: 'absent' }); return; }
  if (!types.isPromise(returned)) { record({ phase: 'returned', mode: 'sync' }); return; }
  let failed = false, failure: unknown;
  try { record({ phase: 'returned', mode: 'promise' }); } catch (error) { failed = true; failure = error; }
  const settle = (outcome: 'fulfilled' | 'rejected') => {
    if (failed || !owner.isOpen || owner.isJournalFenced) return;
    try { record({ phase: 'settled', outcome }); } catch { /* Unknown settlement remains on the fenced owner. */ }
  };
  try { Promise.prototype.then.call(returned, () => settle('fulfilled'), () => settle('rejected')); }
  catch { if (!failed && owner.isOpen && !owner.isJournalFenced) record({ phase: 'unobserved' }); }
  if (failed) throw failure;
}
export function consumeAgentDisplayWrite(owner: Session, event: object): AgentDisplayEvent | undefined {
  const held = writes.get(event); writes.delete(event);
  return held?.owner === owner ? held.event : undefined;
}
export function agentDisplayObservations(events: readonly SessionEvent[], owner: string): AgentDisplayEvent[] {
  const states = new Map<string, AgentDisplayEvent>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'agent_display_observer') continue;
    const before = states.get(event.invocationId), next = event.transition;
    const invalid = () => new Error('Invalid agent display observer history');
    if (event.owner !== owner || (event.callback === 'agentProgress'
      ? event.inputEvidence !== 'unobserved' || event.inputSha256 !== unobservedChildInput
      : event.inputEvidence !== undefined)) throw invalid();
    if (next.phase === 'admitted') { if (before || event.admissionIndex !== index) throw invalid(); }
    else {
      if (!before || before.callback !== event.callback || before.admissionIndex !== event.admissionIndex ||
        before.inputSha256 !== event.inputSha256 || before.inputEvidence !== event.inputEvidence) throw invalid();
      if (next.phase === 'returned' || next.phase === 'threw' || next.phase === 'absent') {
        if (before.transition.phase !== 'admitted') throw invalid();
      } else if (before.transition.phase !== 'returned' || before.transition.mode !== 'promise') throw invalid();
    }
    states.set(event.invocationId, event);
  }
  return [...states.values()];
}

const ownerSchema = z.object({ kind: z.literal('metadata'), id: z.string().uuid() }).passthrough();
/** Keep physical journal positions; only an adjacent, fully bound inert lookup can be crossed. */
export function skipInertDisplayPairs(events: readonly unknown[], index: number): number {
  const metadata = ownerSchema.safeParse(events[0]);
  if (!metadata.success) return index;
  while (index >= 1) {
    const start = agentDisplaySchema.safeParse(events[index - 1]), finish = agentDisplaySchema.safeParse(events[index]);
    if (!start.success || !finish.success) break;
    const a = start.data, b = finish.data;
    if (a.callback === 'agentProgress'
      ? a.inputEvidence !== 'unobserved' || a.inputSha256 !== unobservedChildInput
      : a.inputEvidence !== undefined) break;
    if (a.transition.phase !== 'admitted' || b.transition.phase !== 'absent' ||
      a.owner !== metadata.data.id || b.owner !== a.owner || a.invocationId !== b.invocationId ||
      a.admissionIndex !== index - 1 || b.admissionIndex !== a.admissionIndex ||
      a.callback !== b.callback || a.inputSha256 !== b.inputSha256 || a.inputEvidence !== b.inputEvidence) break;
    index -= 2;
  }
  return index;
}
