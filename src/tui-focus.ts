import { initializeFocusSource } from './tui-focus-source.js';

export type TerminalFocusState = 'unknown' | 'focused' | 'blurred';

/** Source focus callbacks use one store and subscriber set per terminal owner. */
export class TerminalFocus {
  private readonly listeners = new Set<() => void>();
  private readonly source;

  constructor() {
    this.source = initializeFocusSource({
      ba: {
        terminalFocus: 'unknown',
        terminalFocusGainedAt: Number.NEGATIVE_INFINITY,
        terminalFocusChanged: {
          emit: () => { for (const listener of this.listeners) listener(); },
          subscribe: (listener: () => void) => {
            this.listeners.add(listener);
            return () => { this.listeners.delete(listener); };
          },
        },
      },
      mxo: () => {},
    });
  }

  get focused(): boolean { return this.source.focused(); }
  get state(): TerminalFocusState { return this.source.state(); }
  get gainedAt(): number { return this.source.gainedAt(); }
  set(focused: boolean): void { this.source.set(focused); }
  subscribe(listener: () => void): () => void { return this.source.subscribe(listener); }
  close(): void { this.listeners.clear(); }
}
