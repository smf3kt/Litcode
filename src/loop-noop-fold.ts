// Source digests and zero-based UTF-16 ranges: research/ports/W317-loop-noop-fold.md.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { SessionEvent } from './session.js';
import { progressTime } from './tui-progress-settings.js';

export const scheduledFireSchema = z.object({
  kind: z.literal('scheduled_task_fire'), uuid: z.string().uuid(), taskId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }), content: z.string(), cronKind: z.literal('loop').optional(),
  noOpStreak: z.number().int().positive().optional(), streakStartedAt: z.string().datetime({ offset: true }).optional(),
  foldedFireIds: z.array(z.string().uuid()).optional(),
}).strict();
export type ScheduledFire = z.infer<typeof scheduledFireSchema>;

type Fold = { kind: 'none' } | { kind: 'veto'; reason: string } |
  { kind: 'fold'; fireIdx: number; priorStreak: number; since: string };

const isLoopFire = (event: SessionEvent): event is ScheduledFire =>
  event.kind === 'scheduled_task_fire' && event.cronKind === 'loop';
const blockingSystem = (event: SessionEvent) => event.kind === 'compact' || event.kind === 'scheduled_task_fire';

/** A [15225,16520), chunk-appb2dtz.js; journal errors conservatively retain their display span. */
export function analyzeLoopFold(events: readonly SessionEvent[]): Fold {
  const fireIdx = events.findLastIndex(isLoopFire), anchor = events[fireIdx];
  if (anchor === undefined || !isLoopFire(anchor)) return { kind: 'none' };
  for (let index = fireIdx - 1; index >= 0; index--) {
    const event = events[index]!;
    if (isLoopFire(event)) break;
    if (blockingSystem(event)) return { kind: 'veto', reason: 'blocking_system_before_anchor' };
  }
  let noop: boolean | undefined;
  const calls = new Set<string>();
  for (let index = fireIdx + 1; index < events.length; index++) {
    const event = events[index]!;
    if (blockingSystem(event)) return { kind: 'veto', reason: 'blocking_system_in_span' };
    if (event.kind === 'loop_boundary') return { kind: 'veto', reason: event.reason };
    if (event.kind === 'turn_end' && (event.reason === 'aborted' || event.reason === 'error')) {
      return { kind: 'veto', reason: 'tool_abort' };
    }
    if (event.kind === 'tool_result' && event.result.is_error) return { kind: 'veto', reason: 'tool_denial' };
    if (event.kind !== 'message') continue;
    const content = event.message.content;
    if (event.message.role === 'assistant') {
      if (typeof content === 'string') continue;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        calls.add(block.id);
        if (block.name === 'schedule_wakeup') {
          const input = block.input;
          noop = typeof input === 'object' && input !== null && 'noop' in input && input.noop === true;
        }
      }
    } else {
      const results = typeof content === 'string' ? [] : content.filter(block => block.type === 'tool_result');
      if (results.some(block => !calls.has(block.tool_use_id))) return { kind: 'veto', reason: 'split_tool_pair' };
      if (results.some(block => block.is_error)) return { kind: 'veto', reason: 'tool_denial' };
      const origin = event.classifier?.origin;
      const loopPrompt = origin?.kind === 'generated' && origin.source === `loop-wakeup:${anchor.uuid}`;
      const foreignOrigin = origin?.kind === 'human' || origin?.kind === 'peer' || origin?.kind === 'child';
      if (results.length === 0 && (foreignOrigin || !event.isMeta && !loopPrompt)) return { kind: 'veto', reason: 'foreign_user_input' };
    }
  }
  if (noop !== true) return { kind: 'veto', reason: 'model_reported_work' };
  return { kind: 'fold', fireIdx, priorStreak: anchor.noOpStreak ?? 0, since: anchor.streakStartedAt ?? anchor.timestamp };
}

/** y/v/RRn [14748,14999)/[16667,17235), appb2dtz; [4502962,4503404), sfn1dbxq. */
export function scheduledFire(events: readonly SessionEvent[], taskId: string, dynamic: boolean,
  timeZone?: string, now = new Date()): ScheduledFire {
  // k/C, 7d9mja9n [3055,3417), UTF-16; use the existing source parser's invalid-zone fallback.
  const zone: string | undefined = progressTime({ timeZone }).resolve().timeZone;
  const label = (date: Date) => date.toLocaleString('en-US', { month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: zone }).replace(/,? at |, (?=\d{1,2}:)/, ' ')
    .replace(/[  ]([AP]M)/i, (_match, part: string) => part.toLowerCase());
  const fold: Fold = dynamic ? analyzeLoopFold(events) : { kind: 'none' };
  const content = `${dynamic ? 'Resuming /loop wakeup' : 'Running scheduled task'} (${label(now)})`;
  const marker: ScheduledFire = { kind: 'scheduled_task_fire', uuid: randomUUID(), taskId,
    timestamp: now.toISOString(), content, ...(dynamic ? { cronKind: 'loop' } : {}) };
  if (fold.kind !== 'fold') return marker;
  const streak = fold.priorStreak + 1;
  return { ...marker, content: `${content} · ${streak} no-op ${streak === 1 ? 'tick' : 'ticks'} since ${label(new Date(fold.since))}`,
    noOpStreak: streak, streakStartedAt: fold.since,
    foldedFireIds: events.slice(fold.fireIdx).flatMap(event => event.kind === 'scheduled_task_fire' ? [event.uuid] : []) };
}

/** x [16520,16667), chunk-appb2dtz.js; this companion reaches the model with the retained history. */
export function loopNoopCompanion(streak: number): string {
  return `[${streak} prior /loop ${streak === 1 ? 'wakeup' : 'wakeups'} found nothing actionable; loop is healthy.]`;
}
