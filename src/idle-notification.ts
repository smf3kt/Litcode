// The idle-prompt notification: the recovered `_$` state machine.
//
// `chunk-24k7d6mw.js` (SHA-256
// 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `var tAe="idle-return-hint"`
// 76020, `class _$` 76055-78797 with its arm `#g` at 77100, its turn subscription `#m` at 76873 and
// its guards in `#g`; the instance is constructed at 1691362 with `getIdleNotifThresholdMs:yEo` and
// `sendIdleNotification` calling `YD({message:"Claude is waiting for your input",
// notificationType:"idle_prompt"})`. `yEo` 1679555 returns `ce().messageIdleNotifThresholdMs`, whose
// default is 60000 (`chunk-bk5ct2gw.js` SHA-256
// efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1, 558979). Offsets are
// zero-based UTF-16 code units in the extracted module.
//
// The machine's other output, the `/clear` context hint (`#h`, `tAe`), is not ported: it needs a
// keyed notification store, which this terminal does not have (see `tui.ts` `stashTip`).

/** `messageIdleNotifThresholdMs`'s recovered default (`Ze` in chunk-bk5ct2gw.js 558979). */
export const DEFAULT_IDLE_NOTIF_THRESHOLD_MS = 60_000;
/** Node clamps a delay above this, so the source clamps it too (`Math.min(2147483647, …)`). */
const MAX_TIMER_MS = 2_147_483_647;

export interface IdleNotificationHost {
  now(): number;
  /** One cancellable timer; the source uses `clock.setTimeout`. */
  setTimeout(callback: () => void, milliseconds: number): { cancel(): void };
  /** The live turn snapshot the source reads through `turn.getSnapshot()`. */
  snapshot(): { isLoading: boolean; submitCount: number; lastQueryCompletionTime: number };
  lastInteractionTime(): number;
  isDialogOnScreen(): boolean;
  hasPendingLoopWakeup(): boolean;
  hasArmedQuotaAutoResume(): boolean;
  /** `exn(tasks)`: a live background agent, which defers the notification. */
  liveBackgroundAgents(): boolean;
  subscribeBackgroundAgents(listener: () => void): () => void;
  thresholdMs(): number;
  send(): void;
}

/**
 * `_$` (chunk-24k7d6mw.js 76055): after every completed turn whose completion time is unchanged,
 * one notification per completion, only when the person has not touched the input since, no dialog
 * is up, no loop wakeup is armed, no quota auto-resume is armed and no background agent is live.
 */
export class IdleNotifier {
  private turn = { isLoading: false, submitCount: 0, lastQueryCompletionTime: 0 };
  private localOverlay = false;
  private timer: { cancel(): void } | null = null;
  private agentSubscription: (() => void) | null = null;
  private notifiedCompletion = 0;
  private disposed = false;

  constructor(private readonly host: IdleNotificationHost) {
    this.turn = host.snapshot();
    this.refresh();
  }

  /** `#m`: re-arm on a loading change or a new completion; the source also re-arms the hint here. */
  refresh(): void {
    if (this.disposed) return;
    const next = this.host.snapshot();
    const changed = next.isLoading !== this.turn.isLoading
      || next.lastQueryCompletionTime !== this.turn.lastQueryCompletionTime;
    const submitted = next.submitCount !== this.turn.submitCount;
    this.turn = next;
    if (changed || submitted) this.arm();
  }

  /** `setLocalOverlayShowing`: a composer overlay counts as "not idle" for this machine. */
  setLocalOverlayShowing(showing: boolean): void {
    if (this.disposed || showing === this.localOverlay) return;
    this.localOverlay = showing;
    this.arm();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelTimers();
  }

  /** `#f`: both timers and the agent subscription. */
  private cancelTimers(): void {
    this.timer?.cancel();
    this.timer = null;
    this.agentSubscription?.();
    this.agentSubscription = null;
  }

  /** `#g`, transcribed. */
  private arm(): void {
    this.cancelTimers();
    const turn = this.turn;
    if (turn.isLoading) return;
    // `T===0 && !hasSeededRemotePrompt`: this host has no remote session seeding.
    if (turn.submitCount === 0) return;
    if (turn.lastQueryCompletionTime === 0) return;
    this.timer = this.host.setTimeout(() => {
      this.timer = null;
      if (this.host.lastInteractionTime() > turn.lastQueryCompletionTime) return;
      if (this.host.liveBackgroundAgents()) {
        this.agentSubscription = this.host.subscribeBackgroundAgents(() => {
          if (!this.host.liveBackgroundAgents()) this.arm();
        });
        return;
      }
      const idle = this.host.now() - turn.lastQueryCompletionTime;
      // The loading flag is read live (`!this.#t.isLoading`); the completion time is the arm's.
      if (!this.turn.isLoading && !this.localOverlay && !this.host.isDialogOnScreen()
        && !this.host.hasPendingLoopWakeup() && !this.host.hasArmedQuotaAutoResume()
        && idle >= this.host.thresholdMs()
        && turn.lastQueryCompletionTime !== this.notifiedCompletion) {
        this.notifiedCompletion = turn.lastQueryCompletionTime;
        this.host.send();
      }
    }, Math.min(MAX_TIMER_MS, this.host.thresholdMs()));
  }
}
