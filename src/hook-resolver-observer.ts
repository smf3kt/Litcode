import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { HOOK_EVENTS } from './hooks.js';
import type { SessionEvent } from './session.js';

// Host adaptation of Gkr [3059322,3059924) and qLe [633548,633961), UTF-16,
// sfn1dbxq SHA 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// Resolver completion and timeout-race return are different observations, neither effect-free proof.
export const hookResolverSchema = z.object({
  kind: z.literal('hook_resolver'), owner: z.string().uuid(), hookId: z.string().uuid(),
  invocationId: z.string().uuid(), event: z.enum(HOOK_EVENTS),
  definitionKey: z.string().max(256), definitionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  resolverType: z.enum(['prompt', 'agent', 'callback', 'mcp_tool', 'http', 'command']),
  transition: z.discriminatedUnion('phase', [
    z.object({ phase: z.literal('admitted') }).strict(),
    z.object({ phase: z.literal('async_job'), jobId: z.string().uuid(), generation: z.string().uuid() }).strict(),
    z.object({ phase: z.literal('adopted_job'), jobId: z.string().uuid(), generation: z.string().uuid() }).strict(),
    z.object({ phase: z.literal('settled'), outcome: z.enum(['fulfilled', 'rejected']) }).strict(),
    z.object({ phase: z.literal('returned'), outcome: z.enum(['completed', 'timed_out', 'aborted', 'backgrounded']) }).strict(),
  ]),
}).strict();
export type HookResolverEvent = z.infer<typeof hookResolverSchema>;
export type HookResolverObservation = Omit<HookResolverEvent, 'kind' | 'owner' | 'hookId'>;
export type HookResolverState = { event: HookResolverEvent; resolver: 'pending' | 'fulfilled' | 'rejected';
  asyncJob?: { jobId: string; generation: string };
  runner?: 'completed' | 'timed_out' | 'aborted' | 'backgrounded' };

export function hookResolverObservations(events: readonly SessionEvent[], owner: string): HookResolverState[] {
  const states = new Map<string, HookResolverState>(), definitions = new Set<string>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'hook_resolver') continue;
    const invalid = () => new Error('Invalid hook resolver history');
    if (event.owner !== owner) throw invalid();
    const previous = states.get(event.invocationId), transition = event.transition;
    if (transition.phase === 'admitted') {
      const starts = events.slice(0, index).filter(row => row.kind === 'hook_start' && row.id === event.hookId);
      const start = starts[0], key = JSON.stringify([event.hookId, event.definitionKey]);
      const parts = event.definitionKey.split(':');
      if (previous || definitions.has(key) || starts.length !== 1 || start?.kind !== 'hook_start' || start.event !== event.event ||
          parts.length !== 4 || parts[0] !== event.event || !/^(0|[1-9][0-9]*)$/.test(parts[1] ?? '') ||
          Number(parts[1]) >= 1024 || !(parts[2] === 'flat' || /^(0|[1-9][0-9]*)$/.test(parts[2] ?? '') && Number(parts[2]) < 1024) ||
          !/^[a-f0-9]{64}$/.test(parts[3] ?? '') || events.slice(0, index).some(row => row.kind === 'hook_result' && row.id === event.hookId)) throw invalid();
      definitions.add(key); states.set(event.invocationId, { event, resolver: 'pending' }); continue;
    }
    if (!previous) throw invalid();
    const { transition: _before, ...before } = previous.event, { transition: _after, ...after } = event;
    if (!isDeepStrictEqual(before, after)) throw invalid();
    if (transition.phase === 'async_job' || transition.phase === 'adopted_job') {
      const job = events.slice(0, index).find(row => row.kind === 'async_hook_lifecycle' && row.jobId === transition.jobId && row.transition.phase === 'admitted');
      if (event.resolverType !== 'command' || previous.asyncJob || previous.resolver !== 'pending' || previous.runner !== undefined ||
          job?.kind !== 'async_hook_lifecycle' || job.owner !== owner || job.event !== event.event || job.generation !== transition.generation ||
          job.transition.phase !== 'admitted' || job.transition.mode !== (transition.phase === 'async_job' ? 'configured' : 'adopted') ||
          events.slice(0, index).some(row => row.kind === 'hook_result' && row.id === event.hookId) ||
          [...states.values()].some(state => state.asyncJob?.jobId === transition.jobId)) throw invalid();
      states.set(event.invocationId, { ...previous, event, asyncJob: { jobId: transition.jobId, generation: transition.generation } });
    } else if (transition.phase === 'settled') {
      if (previous.resolver !== 'pending') throw invalid();
      states.set(event.invocationId, { ...previous, event, resolver: transition.outcome });
    } else {
      if (previous.runner !== undefined || transition.outcome === 'completed' && previous.resolver === 'pending' ||
          transition.outcome === 'backgrounded' && event.resolverType !== 'command') throw invalid();
      states.set(event.invocationId, { ...previous, event, runner: transition.outcome });
    }
  }
  return [...states.values()];
}
