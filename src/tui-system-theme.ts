import { ALr, initializeSystemThemeWatcher } from './tui-system-theme-source.js';
import { ENABLE_THEME_NOTIFY, DISABLE_THEME_NOTIFY } from './tui-modes.js';
import type { TerminalResponse } from './terminal.js';

type PendingDelay = { timer: ReturnType<typeof setTimeout>; resolve(): void };

/** One terminal owns the source queue, subscription, query deadline and mux race. */
export class SystemThemeMonitor {
  private readonly querier;
  private readonly state: { osc11Responsive?: boolean } = {};
  private readonly delays = new Set<PendingDelay>();
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private disposeWatcher: (() => void) | undefined;
  private active = false;
  private closed = false;

  constructor(private readonly output: { write(text: string): unknown },
    private readonly changed: (theme: 'dark' | 'light') => void,
    private readonly failed: (error: Error) => void,
    private readonly queryTimeoutMs = 2000) {
    this.querier = new ALr({ write: (text: string) => {
      try { output.write(text); }
      catch (error) {
        queueMicrotask(() => {
          if (this.closed) return;
          try { this.close(); }
          catch { /* Report the original query failure after releasing local state. */ }
          this.failed(error instanceof Error ? error : new Error(String(error)));
        });
      }
    } });
    this.querier.setInputAttached(true);
  }

  setActive(active: boolean): void {
    if (this.closed || this.active === active) return;
    if (!active) { this.stop(); return; }
    this.active = true;
    this.output.write(ENABLE_THEME_NOTIFY);
    const watcher = initializeSystemThemeWatcher({
      a: { TMUX: process.env.TMUX, STY: process.env.STY },
      Gle: () => false,
      Q: (milliseconds: number) => new Promise<void>(resolve => {
        const pending: PendingDelay = { timer: setTimeout(() => {
          this.delays.delete(pending); resolve();
        }, milliseconds), resolve };
        pending.timer.unref?.(); this.delays.add(pending);
      }),
      t: () => {}, DT: () => this.state, tWt: () => {},
      oi: () => new Map(), REe: () => () => {}, oX: () => 'focused', ifn: async () => {},
    });
    const query = {
      send: (request: unknown) => {
        this.armDeadline();
        return this.querier.send(request);
      },
      cancel: (request: unknown) => this.querier.cancel(request),
      subscribeThemeChange: (listener: (dark: boolean) => void) => this.querier.subscribeThemeChange(listener),
      flush: async () => {
        this.armDeadline();
        const result = await this.querier.flush();
        if (!this.querier.queue.length && this.deadline) {
          clearTimeout(this.deadline); this.deadline = undefined;
        }
        return result;
      },
    };
    this.disposeWatcher = watcher(query, (theme: 'dark' | 'light') => {
      if (!this.active || this.closed) return;
      try { this.changed(theme); }
      catch (error) { this.failed(error instanceof Error ? error : new Error(String(error))); }
    }, undefined);
  }

  onResponse(response: TerminalResponse): void {
    if (this.closed) return;
    this.querier.onResponse(response);
    if (!this.querier.queue.length && this.deadline) {
      clearTimeout(this.deadline); this.deadline = undefined;
    }
  }

  private armDeadline(): void {
    if (this.deadline) return;
    this.deadline = setTimeout(() => {
      this.deadline = undefined; this.querier.resync({ probe: false });
    }, this.queryTimeoutMs);
    this.deadline.unref?.();
  }

  private stop(): void {
    this.active = false;
    this.disposeWatcher?.(); this.disposeWatcher = undefined;
    this.querier.resync({ probe: false });
    if (this.deadline) { clearTimeout(this.deadline); this.deadline = undefined; }
    for (const delay of this.delays) { clearTimeout(delay.timer); delay.resolve(); }
    this.delays.clear();
    this.output.write(DISABLE_THEME_NOTIFY);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try { if (this.active) this.stop(); }
    finally { this.querier.setInputAttached(false); }
  }
}
