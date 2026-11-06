// gg, njj04bkb [1085,1772), and streaming executeTool, 5b2hxy2e
// [43800,52600), UTF-16. Explicit disposal replaces source weak finalization.
export class ToolCancellation {
  private readonly turn = new AbortController();
  private readonly forwardParent = () => this.turn.abort(this.parent.reason);

  constructor(private readonly parent: AbortSignal) {
    if (parent.aborted) this.forwardParent();
    else parent.addEventListener('abort', this.forwardParent, { once: true });
  }

  get signal(): AbortSignal { return this.turn.signal; }

  call(): { controller: AbortController; dispose: () => void } {
    const controller = new AbortController();
    const fromTurn = () => controller.abort(this.turn.signal.reason);
    const fromCall = () => {
      if (!this.turn.signal.aborted) this.turn.abort(controller.signal.reason);
    };
    if (this.turn.signal.aborted) fromTurn();
    else {
      this.turn.signal.addEventListener('abort', fromTurn, { once: true });
      controller.signal.addEventListener('abort', fromCall, { once: true });
    }
    return { controller, dispose: () => {
      this.turn.signal.removeEventListener('abort', fromTurn);
      controller.signal.removeEventListener('abort', fromCall);
    } };
  }

  dispose(): void { this.parent.removeEventListener('abort', this.forwardParent); }
}
