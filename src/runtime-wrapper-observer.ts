import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import type { SessionEvent } from './session.js';

// Host lifecycle rewrite: Kt, hwpb27as SHA
// c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e,
// [121053,123737), UTF-16, has no host wrapper callbacks or fsync journal.
export const wrapperTransitionSchema = z.discriminatedUnion('phase', [
  z.object({ phase: z.literal('admitted') }).strict(),
  z.object({ phase: z.literal('returned'), mode: z.enum(['sync', 'promise']) }).strict(),
  z.object({ phase: z.literal('threw') }).strict(),
  z.object({ phase: z.literal('settled'), outcome: z.enum(['fulfilled', 'rejected']) }).strict(),
  z.object({ phase: z.literal('unobserved') }).strict(),
]);
export type WrapperTransition = z.infer<typeof wrapperTransitionSchema>;
export const writeFactorySchema = z.object({ owner: z.string().uuid(), incarnation: z.string().uuid() }).strict();
export const runtimeWrapperSchema = z.object({
  kind: z.literal('runtime_wrapper_observer'), owner: z.string().uuid(), invocationId: z.string().uuid(),
  parentMessageId: z.string().uuid(), toolUseId: z.string().min(1), startIndex: z.number().int().nonnegative(),
  startSha256: z.string().regex(/^[a-f0-9]{64}$/), method: z.enum(['execute', 'executeBlocks']),
  stage: z.enum(['checkScope', 'refresh', 'checkJournal']), transition: wrapperTransitionSchema,
  writeFactory: writeFactorySchema.optional(),
}).strict();
export type RuntimeWrapperEvent = z.infer<typeof runtimeWrapperSchema>;
export type WrapperObservation = Pick<RuntimeWrapperEvent, 'invocationId' | 'method' | 'stage' | 'transition'>;
export type WrapperState = 'admitted_unknown' | 'sync_returned' | 'promise_pending' | 'threw' | 'fulfilled' | 'rejected' | 'unobserved';
export const wrapperStartDigest = (event: Extract<SessionEvent, { kind: 'tool_start' }>) =>
  createHash('sha256').update(JSON.stringify(event)).digest('hex');

/** Observation only: returned callbacks may have detached effects. Never replay. */
export function runtimeWrapperObservations(events: readonly SessionEvent[], owner: string) {
  const observations = new Map<string, { event: RuntimeWrapperEvent; state: WrapperState }>();
  const calls = new Map<number, RuntimeWrapperEvent[]>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'runtime_wrapper_observer') continue;
    const invalid = () => new Error('Invalid runtime wrapper observer history');
    if (event.owner !== owner) throw invalid();
    const prior = observations.get(event.invocationId), transition = event.transition;
    if (transition.phase === 'admitted') {
      const start = events[event.startIndex], stages = calls.get(event.startIndex) ?? [];
      const sequence = event.method === 'execute' ? ['checkScope', 'refresh', 'checkJournal'] : ['checkScope', 'checkJournal'];
      if (prior || event.startIndex >= index || start?.kind !== 'tool_start' || start.id !== event.toolUseId ||
          start.parentMessageId !== event.parentMessageId || wrapperStartDigest(start) !== event.startSha256 ||
          event.stage !== sequence[stages.length] || stages.some(row => row.method !== event.method ||
            !isDeepStrictEqual(row.writeFactory, event.writeFactory))) throw invalid();
      if (event.writeFactory && (start.name !== 'write_file' ||
          (start.runtimeWriteOwner && !isDeepStrictEqual(start.runtimeWriteOwner, event.writeFactory)))) throw invalid();
      const previousStage = stages.at(-1), previous = previousStage && observations.get(previousStage.invocationId);
      if (previous && (previous.state === 'admitted_unknown' || previous.state === 'threw')) throw invalid();
      stages.push(event); calls.set(event.startIndex, stages);
      observations.set(event.invocationId, { event, state: 'admitted_unknown' }); continue;
    }
    if (!prior) throw invalid();
    const { transition: _priorTransition, ...before } = prior.event;
    const { transition: _transition, ...after } = event;
    if (!isDeepStrictEqual(before, after)) throw invalid();
    let state: WrapperState;
    switch (transition.phase) {
      case 'returned':
        if (prior.state !== 'admitted_unknown') throw invalid();
        state = transition.mode === 'sync' ? 'sync_returned' : 'promise_pending'; break;
      case 'threw':
        if (prior.state !== 'admitted_unknown') throw invalid();
        state = 'threw'; break;
      case 'settled':
        if (prior.state !== 'promise_pending') throw invalid();
        state = transition.outcome; break;
      case 'unobserved':
        if (prior.state !== 'promise_pending') throw invalid();
        state = 'unobserved'; break;
    }
    observations.set(event.invocationId, { event, state });
  }
  return [...observations.values()];
}
