import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SessionEvent, ToolResult } from './session.js';
import type { ToolDisplayResult } from './tui-tool-result.js';

// Host observer journal adaptation, W385 #35. Source xe constructs result messages,
// sfn1dbxq SHA 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// [4380701,4382470), UTF-16; it does not define this host callback/fsync interface.
export const toolResultObserverSchema = z.object({
  kind: z.literal('tool_result_observer'), owner: z.string().uuid(), invocationId: z.string().uuid(),
  parentMessageId: z.string().uuid(), toolUseId: z.string().min(1), resultIndex: z.number().int().nonnegative(),
  resultSha256: z.string().regex(/^[a-f0-9]{64}$/), displaySha256: z.string().regex(/^[a-f0-9]{64}$/),
  transition: z.discriminatedUnion('phase', [
    z.object({ phase: z.literal('admitted') }).strict(),
    z.object({ phase: z.literal('returned'), mode: z.enum(['absent', 'sync', 'promise']) }).strict(),
    z.object({ phase: z.literal('threw') }).strict(),
    z.object({ phase: z.literal('settled'), outcome: z.enum(['fulfilled', 'rejected']) }).strict(),
    z.object({ phase: z.literal('unobserved') }).strict(),
  ]),
}).strict();
export type ToolResultObserverEvent = z.infer<typeof toolResultObserverSchema>;
export type ToolResultObservation = { event: ToolResultObserverEvent;
  state: 'admitted_unknown' | 'absent' | 'sync_returned' | 'promise_pending' | 'threw' | 'fulfilled' | 'rejected' | 'unobserved' };

export function observerResultDigest(result: ToolResult): string {
  return createHash('sha256').update(JSON.stringify(result)).digest('hex');
}

/** Hash only the text projection; do not serialize arbitrary callback input/host objects. */
export function observerDisplayDigest(display: Pick<ToolDisplayResult, 'id' | 'name' | 'content' | 'isError'>): string {
  return createHash('sha256').update(JSON.stringify([display.id, display.name, display.content, display.isError])).digest('hex');
}

function sameBinding(a: ToolResultObserverEvent, b: ToolResultObserverEvent): boolean {
  return a.owner === b.owner && a.invocationId === b.invocationId && a.parentMessageId === b.parentMessageId &&
    a.toolUseId === b.toolUseId && a.resultIndex === b.resultIndex && a.resultSha256 === b.resultSha256 && a.displaySha256 === b.displaySha256;
}

/** Pending means unknown, including death between admission fsync and invocation. Never replay. */
export function toolResultObservations(events: readonly SessionEvent[], owner: string): ToolResultObservation[] {
  const observations = new Map<string, ToolResultObservation>(), calls = new Set<string>();
  for (const [index, event] of events.entries()) {
    if (event.kind !== 'tool_result_observer') continue;
    const invalid = () => new Error('Invalid tool result observer history');
    if (event.owner !== owner) throw invalid();
    const previous = observations.get(event.invocationId), transition = event.transition;
    if (transition.phase === 'admitted') {
      const key = JSON.stringify([event.parentMessageId, event.toolUseId]);
      const committed = events[event.resultIndex];
      if (previous || calls.has(key) || event.resultIndex >= index ||
          !committed || (committed.kind !== 'tool_result' && committed.kind !== 'tool_output') ||
          committed.result.tool_use_id !== event.toolUseId || observerResultDigest(committed.result) !== event.resultSha256) throw invalid();
      const parents = events.slice(0, event.resultIndex).filter(row => row.kind === 'message' && row.messageId === event.parentMessageId);
      const parent = parents[0];
      if (parents.length !== 1 || parent?.kind !== 'message' || parent.message.role !== 'assistant' ||
          !Array.isArray(parent.message.content)) throw invalid();
      const toolCalls = parent.message.content.filter(block => block.type === 'tool_use' && block.id === event.toolUseId);
      const call = toolCalls[0];
      if (toolCalls.length !== 1 || call?.type !== 'tool_use' || observerDisplayDigest({ id: event.toolUseId,
        name: call.name, content: String(committed.result.content), isError: committed.result.is_error === true }) !== event.displaySha256) throw invalid();
      calls.add(key);
      observations.set(event.invocationId, { event, state: 'admitted_unknown' });
      continue;
    }
    if (!previous || !sameBinding(previous.event, event)) throw invalid();
    let state: ToolResultObservation['state'];
    switch (transition.phase) {
      case 'returned':
        if (previous.state !== 'admitted_unknown') throw invalid();
        state = transition.mode === 'promise' ? 'promise_pending' : transition.mode === 'sync' ? 'sync_returned' : 'absent';
        break;
      case 'threw':
        if (previous.state !== 'admitted_unknown') throw invalid();
        state = 'threw'; break;
      case 'settled':
        if (previous.state !== 'promise_pending') throw invalid();
        state = transition.outcome; break;
      case 'unobserved':
        if (previous.state !== 'promise_pending') throw invalid();
        state = 'unobserved'; break;
    }
    observations.set(event.invocationId, { event, state });
  }
  return [...observations.values()];
}
