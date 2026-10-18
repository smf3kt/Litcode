import { SourceDiffSelection, diffSelectionMessage } from './diff-selection-source.js';

export interface DiffSelection {
  source: 'diff';
  text: string;
  lineCount: number;
  filePath?: string;
}

export class DiffSelectionOwner {
  private readonly source;
  constructor(changed: () => void) { this.source = new SourceDiffSelection(changed); }
  get pending(): DiffSelection | undefined { return this.source.getSnapshot().ideSelection; }
  set(selection: DiffSelection): void { this.source.setIdeSelection(selection); }
  dismiss(): void { this.source.dismissIdeSelection(); }

  /** chunk-24k7d6mw.js [1492693,1492930) UTF-16. Slash and bash input retain the slot. */
  take(prompt: string, promptUuid: string): DiffSelection | undefined {
    if (prompt.trim().startsWith('/') || prompt.startsWith('!')) return undefined;
    const selection = this.pending;
    this.source.consumeIdeSelection(promptUuid);
    return selection;
  }

  restore(promptUuid: string, selection?: DiffSelection): void {
    this.source.restoreIdeSelectionConsumedBy(promptUuid, selection);
  }
}

export function selectedDiffMessage(selection: DiffSelection): string {
  return diffSelectionMessage(selection) as string;
}
