import { createHash, randomUUID } from 'node:crypto';
import { types } from 'node:util';
import { z } from 'zod';
import type { CommandHookExecution, HookRunOptions } from './hooks.js';
import type { Session, SessionEvent } from './session.js';

// UF [2969279,2980094), UTF-16, sfn1dbxq SHA
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// S3 host callback journal adaptation; source defines no callback/fsync protocol.
export const hookCommandObserverSchema = z.object({
  kind: z.literal('hook_command_observer'), owner: z.string().uuid(), hookId: z.string().uuid(),
  resolverInvocationId: z.string().uuid(), invocationId: z.string().uuid(),
  executionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  transition: z.discriminatedUnion('phase', [
    z.object({ phase: z.literal('admitted') }).strict(),
    z.object({ phase: z.literal('returned'), mode: z.enum(['absent', 'sync', 'promise']) }).strict(),
    z.object({ phase: z.literal('threw') }).strict(),
    z.object({ phase: z.literal('settled'), outcome: z.enum(['fulfilled', 'rejected']) }).strict(),
    z.object({ phase: z.literal('unobserved') }).strict(),
  ]),
}).strict();
export type HookCommandObserverEvent = z.infer<typeof hookCommandObserverSchema>;
const owners = new WeakMap<object, { owner: Session; hookId: string }>();
const writes = new WeakMap<object, { owner: Session; event: HookCommandObserverEvent }>();
export function registerHookCommandOwner(observer: object, owner: Session, hookId: string): void {
  owners.set(observer, { owner, hookId });
}
export function observeHookCommandResult(observer: object | undefined, resolverInvocationId: string,
  receiver: HookRunOptions, execution: CommandHookExecution): void {
  const held = observer && owners.get(observer);
  if (!held) { receiver.onCommandResult?.(execution); return; }
  const { owner, hookId } = held;
  // Retired command cleanup still forwards its raw result, but never borrows a
  // reopened Session's journal. Its callback effects remain unobserved.
  if (!owner.isOpen) { receiver.onCommandResult?.(execution); return; }
  if (owner.isJournalFenced) throw new Error('Command observer owner unavailable before invocation');
  const binding = { owner: owner.id, hookId, resolverInvocationId, invocationId: randomUUID(),
    executionSha256: createHash('sha256').update(JSON.stringify(execution)).digest('hex') };
  const record = (transition: HookCommandObserverEvent['transition']) => {
    const event: HookCommandObserverEvent = Object.freeze({ kind: 'hook_command_observer', ...binding,
      transition: Object.freeze(transition) });
    writes.set(event, { owner, event });
    try { owner.append(event); } finally { writes.delete(event); }
  };
  record({ phase: 'admitted' });
  let returned: unknown, present: boolean;
  try {
    const callback = receiver.onCommandResult;
    present = callback !== undefined && callback !== null;
    if (callback !== undefined && callback !== null) returned = Reflect.apply(callback, receiver, [execution]);
  } catch (error) { record({ phase: 'threw' }); throw error; }
  if (!present) { record({ phase: 'returned', mode: 'absent' }); return; }
  if (!types.isPromise(returned)) { record({ phase: 'returned', mode: 'sync' }); return; }
  let failed = false, failure: unknown;
  try { record({ phase: 'returned', mode: 'promise' }); } catch (error) { failed = true; failure = error; }
  const settle = (outcome: 'fulfilled' | 'rejected') => {
    if (failed || !owner.isOpen || owner.isJournalFenced) return;
    try { record({ phase: 'settled', outcome }); } catch { /* Fenced journal retains unknown settlement. */ }
  };
  // Observe native Promises without reading a user-defined .then or awaiting the callback.
  try { Promise.prototype.then.call(returned, () => settle('fulfilled'), () => settle('rejected')); }
  catch { if (!failed && owner.isOpen && !owner.isJournalFenced) record({ phase: 'unobserved' }); }
  if (failed) throw failure;
}
export function consumeHookCommandWrite(owner: Session, event: object): HookCommandObserverEvent | undefined {
  const held = writes.get(event); writes.delete(event);
  return held?.owner === owner ? held.event : undefined;
}
export function hookCommandObservations(events: readonly SessionEvent[], owner: string): HookCommandObserverEvent[] {
  const resolvers = new Map<string, string>(), calls = new Set<string>();
  const states = new Map<string, HookCommandObserverEvent>();
  for (const event of events) {
    if (event.kind === 'hook_resolver' && event.owner === owner && event.resolverType === 'command' &&
      event.transition.phase === 'settled') resolvers.set(event.invocationId, event.hookId);
    if (event.kind !== 'hook_command_observer') continue;
    const before = states.get(event.invocationId), next = event.transition;
    const invalid = () => new Error('Invalid command observer history');
    if (event.owner !== owner || resolvers.get(event.resolverInvocationId) !== event.hookId) throw invalid();
    if (next.phase === 'admitted') {
      if (before || calls.has(event.resolverInvocationId)) throw invalid();
      calls.add(event.resolverInvocationId);
    } else {
      if (!before || before.hookId !== event.hookId || before.resolverInvocationId !== event.resolverInvocationId ||
        before.executionSha256 !== event.executionSha256) throw invalid();
      if (next.phase === 'returned' || next.phase === 'threw') {
        if (before.transition.phase !== 'admitted') throw invalid();
      } else if (before.transition.phase !== 'returned' || before.transition.mode !== 'promise') throw invalid();
    }
    states.set(event.invocationId, event);
  }
  return [...states.values()];
}
