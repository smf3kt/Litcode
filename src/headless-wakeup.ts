// Source module digests and zero-based UTF-16 ranges: research/ports/W316-headless-wakeup.md.
import { setTimeout as delay } from 'node:timers/promises';

import type { Agent, RunResult } from './agent.js';
import type { Runtime, RuntimeEvent } from './runtime.js';

/** Zy [87478,87623), chunk-rx2nah4x.js retains a loop through its parked-time overdue grace. */
export function headlessWakeupPending(
  task: { scheduledFor?: number } | null,
  now: number,
  parkedSince: number | null,
): boolean {
  const parked = parkedSince ?? now;
  return task !== null && (task.scheduledFor === undefined || now <= Math.max(task.scheduledFor, parked) + 120_000);
}

/** KL/Ap.park [562879,563257)/[90210,92849), chunk-rx2nah4x.js parks only the dynamic lane at EOF. */
export async function drainHeadlessWakeups(options: {
  runtime: Runtime;
  owner: string;
  agent: Pick<Agent, 'run'>;
  result: RunResult;
  signal: AbortSignal;
  budgetExhausted: () => boolean;
  onWait?: () => void;
  now?: () => number;
  wait?: (signal: AbortSignal) => Promise<void>;
}): Promise<RunResult> {
  const { runtime, owner, agent, signal } = options;
  const now = options.now ?? Date.now;
  const wait = options.wait ?? (signal => delay(100, undefined, { signal }));
  const announced = new Set<string>();
  const queued: Extract<RuntimeEvent, { kind: 'scheduled' }>[] = [];
  let result = options.result, calls = result.modelCalls;
  let parkedSince: number | null = null;
  while (result.reason === 'end_turn' || result.reason === 'stop_sequence') {
    signal.throwIfAborted();
    if (options.budgetExhausted()) break;
    const at = now();
    parkedSince ??= at;
    queued.push(...runtime.drainLoopWakeups?.(owner) ?? []);
    const pending = runtime.loopWakeup?.(owner) ?? null;
    if (queued.length === 0 && !headlessWakeupPending(pending, at, parkedSince)) break;
    runtime.checkScheduler?.(owner);
    queued.push(...runtime.drainLoopWakeups?.(owner) ?? []);
    const event = queued.shift();
    if (event !== undefined) {
      if (runtime.beginLoopWakeup?.(owner, event.id) === false) continue;
      try {
        const next = await agent.run(event.prompt, signal, undefined, undefined, [], undefined,
          { kind: 'generated', source: 'headless-scheduled' });
        calls += next.modelCalls;
        result = { ...next, modelCalls: calls };
      } finally { runtime.finishLoopWakeup?.(owner, event.id); }
      parkedSince = null;
      continue;
    }
    // Ap.announceLongWait [92849,93503), chunk-rx2nah4x.js reports each waiting id once after five seconds.
    if (pending && at - parkedSince >= 5000 && !announced.has(pending.id)) {
      announced.add(pending.id);
      options.onWait?.();
    }
    await wait(signal);
  }
  return result;
}
