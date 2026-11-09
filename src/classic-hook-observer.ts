import { z } from 'zod';
import type { Session, SessionEvent } from './session.js';
import { consumeClassicChainObservation } from './plugin-chain-classic-raise.js';
import { registerClassicModuleOwner } from './classic-module-observer.js';

// znr/Ikt [559965,560231)/[562773,563154), UTF-16, sfn1dbxq SHA
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// Whole-chain Promise settlement, not individual module/worker effect completion.
export const classicHookChainSchema = z.object({
  kind: z.literal('classic_hook_chain'), owner: z.string().uuid(), hookId: z.string().uuid(),
  invocationId: z.string().uuid(), event: z.string().min(1).max(128),
  phase: z.enum(['admitted', 'fulfilled', 'rejected']),
}).strict();
export type ClassicHookChainEvent = z.infer<typeof classicHookChainSchema>;
export type ClassicChainObservation = Omit<ClassicHookChainEvent, 'kind' | 'owner' | 'hookId'>;
export type ClassicChainObserver = (authorization: object) => void;
const writes = new WeakMap<object, { owner: Session; event: ClassicHookChainEvent }>();

export function createClassicChainObserver(owner: Session, hookId: string): ClassicChainObserver {
  const observe: ClassicChainObserver = authorization => {
    const observation = consumeClassicChainObservation(authorization, observe);
    if (!observation) throw new Error('Classic chain observation authorization invalid');
    if (!owner.isOpen || owner.isJournalFenced) return;
    const event: ClassicHookChainEvent = Object.freeze({ kind: 'classic_hook_chain', owner: owner.id, hookId, ...observation });
    writes.set(event, { owner, event });
    try { owner.append(event); } finally { writes.delete(event); }
  };
  registerClassicModuleOwner(observe, owner, hookId);
  return observe;
}
export function consumeClassicChainWrite(owner: Session, event: object): ClassicHookChainEvent | undefined {
  const saved = writes.get(event); writes.delete(event);
  return saved?.owner === owner ? saved.event : undefined;
}
export function classicHookChains(events: readonly SessionEvent[], owner: string): ClassicHookChainEvent[] {
  const states = new Map<string, ClassicHookChainEvent>(), starts = new Set<string>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'classic_hook_chain') continue;
    const invalid = () => new Error('Invalid classic hook chain history');
    if (event.owner !== owner) throw invalid();
    const before = states.get(event.invocationId);
    if (event.phase === 'admitted') {
      const matches = events.slice(0, index).filter(row => row.kind === 'hook_start' && row.id === event.hookId);
      const start = matches[0];
      if (before || starts.has(event.hookId) || matches.length !== 1 || start?.kind !== 'hook_start' || start.event !== `classic:${event.event}`) throw invalid();
      starts.add(event.hookId);
    } else if (!before || before.phase !== 'admitted' || before.hookId !== event.hookId || before.event !== event.event) throw invalid();
    states.set(event.invocationId, event);
  }
  return [...states.values()];
}
