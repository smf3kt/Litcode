import type { ModelRetry, ModelRetryObserver } from './provider.js';
import type { SideQuestionOutcome } from './side-question.js';
import { SIDE_QUESTION_NO_RESPONSE } from './side-question.js';
import { HIe } from './tui-progress-source.js';

export type SideQuestionRetry = ModelRetry & { retryAt?: number };
export type SideQuestionSettled = { kind: 'closed' } | { kind: 'answer'; outcome: SideQuestionOutcome }
  | { kind: 'error'; message: string };
export type SideQuestionProgressState = { kind: 'pending'; retry: SideQuestionRetry | null } | SideQuestionSettled;

// we/We/Re/qe, qskwh3r4 [17437,25206), UTF-16: one request owns retry publication and explicit-close cancellation.
export class SideQuestionProgress {
  private controller = new AbortController();
  private listeners = new Set<() => void>();
  private value: SideQuestionProgressState = { kind: 'pending', retry: null };
  readonly settled: Promise<SideQuestionSettled>;

  constructor(readonly question: string, signal: AbortSignal,
    ask: (signal: AbortSignal, onRetry: ModelRetryObserver) => Promise<SideQuestionOutcome>) {
    const combined = AbortSignal.any([signal, this.controller.signal]);
    this.settled = Promise.resolve().then(async (): Promise<SideQuestionSettled> => {
      try {
        combined.throwIfAborted();
        const outcome = await ask(combined, retry => {
          if (combined.aborted || this.value.kind !== 'pending') return;
          this.publish({ kind: 'pending', retry: retry === null ? null : { ...retry,
            ...(retry.retryInMs === undefined ? {} : { retryAt: Date.now() + retry.retryInMs }) } });
        });
        if (combined.aborted) return { kind: 'closed' };
        return outcome.response === null ? { kind: 'error', message: SIDE_QUESTION_NO_RESPONSE } : { kind: 'answer', outcome };
      } catch (error) {
        return combined.aborted ? { kind: 'closed' } : { kind: 'error',
          message: (error instanceof Error ? error.message : String(error)) || 'Failed to get response' };
      }
    }).then(result => { this.publish(result); return result; });
  }

  get state(): SideQuestionProgressState { return this.value; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  close(): void { this.controller.abort(); this.listeners.clear(); }
  private publish(state: SideQuestionProgressState): void { this.value = state; for (const listener of this.listeners) listener(); }
}

// $e/He, qskwh3r4 [26512,27639), UTF-16; bie/HIe retain the existing recovered frame glyphs.
export function sideQuestionWaitingText(question: string, retry: SideQuestionRetry | null, frame: number, now = Date.now()): string {
  const glyphs = HIe(), glyph = glyphs[frame % glyphs.length];
  if (!retry) return `/btw ${question}\n\n${glyph} Answering…`;
  const status = retry.status === 429 ? 'Rate limited' : retry.status === 529 ? 'API overloaded'
    : retry.status === 401 || retry.status === 403 ? 'Authentication failed' : 'API error';
  const delay = retry.retryAt === undefined ? 'retrying' : `retrying in ${Math.max(0, Math.ceil((retry.retryAt - now) / 1000))}s`;
  return `/btw ${question}\n\n${glyph} ${status} · ${delay} · attempt ${retry.retryAttempt}/${retry.maxRetries}`;
}
