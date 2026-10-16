import { initializeUndoSource } from './tui-input-undo-source.js';

interface UndoEntry {
  text: string;
  cursorOffset: number;
  pastedContents: Record<string, unknown>;
  timestamp: number;
}
interface UndoState { entries: UndoEntry[]; index: number }
interface UndoMethods {
  pushToBuffer(text: string, cursor: number, pastedContents?: Record<string, unknown>, options?: { immediate?: boolean }): void;
  undo(): UndoEntry | undefined;
  clearBuffer(): void;
}

/** One hook instance's refs/state, adapted to the owned terminal lifetime. */
export class InputUndo {
  private snapshot: UndoState = { entries: [], index: -1 };
  private readonly source: UndoMethods;

  constructor(options: { maxBufferSize?: number; debounceMs?: number } = {}) {
    const due = initializeUndoSource({
      on: () => ({ setTimeout: (callback: () => void, milliseconds: number) => {
        const timer = setTimeout(callback, milliseconds);
        return () => clearTimeout(timer);
      } }),
      R: <T>(current: T) => ({ current }),
      y: (initial: UndoState) => {
        this.snapshot = initial;
        return [initial, (value: UndoState) => { this.snapshot = value; }];
      },
      le: <T>(callback: T) => callback,
    });
    this.source = due({ maxBufferSize: options.maxBufferSize ?? 50, debounceMs: options.debounceMs ?? 1000 });
  }

  get canUndo(): boolean {
    return this.snapshot.index >= 0 && this.snapshot.entries[this.snapshot.index] !== undefined;
  }

  record(text: string, cursor: number, options?: { immediate?: boolean }, pastedContents: Record<string, unknown> = {}): void {
    this.source.pushToBuffer(text, cursor, structuredClone(pastedContents), options);
  }

  undo(): UndoEntry | undefined { return this.source.undo(); }
  clear(): void { this.source.clearBuffer(); }
}
