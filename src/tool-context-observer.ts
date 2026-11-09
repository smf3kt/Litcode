import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual, types } from 'node:util';
import { z } from 'zod';
import type { Session, SessionEvent } from './session.js';
import { wrapperTransitionSchema } from './runtime-wrapper-observer.js';

// Kt, hwpb27as c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e
// [121053,123737); uno, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// [739599,743280), UTF-16. S3 host journal: source context calls have no fsync receipt.
export const toolContextSchema = z.object({
  kind: z.literal('tool_context_observer'), owner: z.string().uuid(), contextId: z.string().uuid(),
  invocationId: z.string().uuid(), toolUseId: z.string().min(1), lane: z.enum(['agent', 'model_hook']),
  callback: z.enum(['workingDirectories', 'writeInputDescription', 'writeGrantCheck', 'writeRuntimeStart', 'writePublicationAuthorization',
    'fileHistory', 'permissionLookup', 'permission']), admissionIndex: z.number().int().nonnegative(),
  inputKind: z.enum(['string', 'boolean', 'undefined', 'unobserved']),
  inputSha256: z.string().regex(/^[a-f0-9]{64}$/), transition: wrapperTransitionSchema,
}).strict();
export type ToolContextEvent = z.infer<typeof toolContextSchema>;
const writes = new WeakMap<object, { owner: Session; event: ToolContextEvent }>();

/** Captures the live owner, not a lookup by session ID. Returned values retain identity. */
export function createToolContextObserver(owner: Session, toolUseId: string, lane: ToolContextEvent['lane']) {
  const contextId = randomUUID();
  return function observe<T>(callback: ToolContextEvent['callback'], input: unknown, body: () => T): T {
    if (!owner.isOpen) return body();
    if (owner.isJournalFenced) throw new Error('Tool context observer owner unavailable before invocation');
    const inputKind: ToolContextEvent['inputKind'] = input === undefined ? 'undefined'
      : typeof input === 'string' ? 'string' : typeof input === 'boolean' ? 'boolean' : 'unobserved';
    // Untyped callers may pass an object; observing it must not invoke toJSON/getters.
    const encoded = inputKind === 'unobserved' ? 'unobserved' : JSON.stringify(input) ?? 'undefined';
    const binding = { owner: owner.id, contextId, toolUseId, lane, callback, invocationId: randomUUID(), inputKind,
      admissionIndex: owner.events.length, inputSha256: createHash('sha256').update(encoded).digest('hex') };
    const record = (transition: ToolContextEvent['transition']) => {
      if (transition.phase !== 'admitted' && !owner.isOpen) return;
      const event: ToolContextEvent = Object.freeze({ kind: 'tool_context_observer', ...binding, transition: Object.freeze(transition) });
      writes.set(event, { owner, event });
      try { owner.append(event); } finally { writes.delete(event); }
    };
    record({ phase: 'admitted' });
    let result: T;
    try { result = body(); } catch (error) { record({ phase: 'threw' }); throw error; }
    if (!types.isPromise(result)) { record({ phase: 'returned', mode: 'sync' }); return result; }
    let failed = false, failure: unknown;
    try { record({ phase: 'returned', mode: 'promise' }); } catch (error) { failed = true; failure = error; }
    const settle = (outcome: 'fulfilled' | 'rejected') => {
      if (failed || !owner.isOpen || owner.isJournalFenced) return;
      try { record({ phase: 'settled', outcome }); } catch { /* The original owner retains unknown settlement. */ }
    };
    try { Promise.prototype.then.call(result, () => settle('fulfilled'), () => settle('rejected')); }
    catch { if (!failed && owner.isOpen && !owner.isJournalFenced) record({ phase: 'unobserved' }); }
    if (failed) throw failure;
    return result;
  };
}
export function consumeToolContextWrite(owner: Session, event: object): ToolContextEvent | undefined {
  const saved = writes.get(event); writes.delete(event);
  return saved?.owner === owner ? saved.event : undefined;
}
export function toolContextObservations(events: readonly SessionEvent[], owner: string): ToolContextEvent[] {
  const states = new Map<string, ToolContextEvent>();
  const contexts = new Map<string, { lane: ToolContextEvent['lane']; toolUseId: string }>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'tool_context_observer') continue;
    const invalid = () => new Error('Invalid tool context observer history');
    const before = states.get(event.invocationId), context = contexts.get(event.contextId), next = event.transition;
    if (event.owner !== owner || context && (context.lane !== event.lane || context.toolUseId !== event.toolUseId)) throw invalid();
    if (next.phase === 'admitted') {
      if (before || event.admissionIndex !== index) throw invalid();
      contexts.set(event.contextId, { lane: event.lane, toolUseId: event.toolUseId });
    } else {
      if (!before) throw invalid();
      const { transition: _before, ...a } = before, { transition: _next, ...b } = event;
      if (!isDeepStrictEqual(a, b)) throw invalid();
      if (next.phase === 'returned' || next.phase === 'threw') {
        if (before.transition.phase !== 'admitted') throw invalid();
      } else if (before.transition.phase !== 'returned' || before.transition.mode !== 'promise') throw invalid();
    }
    states.set(event.invocationId, event);
  }
  return [...states.values()];
}
