import { stripVTControlCharacters as pn } from 'node:util';
import { Su } from './plugin-chain-terminal-environment-host.js';
import { detectTerminal } from './tui-selection-copy.js';

export interface TitleActivity {
  queuedElicitation?: boolean;
  topDialogWaitingFor?: string;
  pendingWorkerRequest?: boolean;
  pendingSandboxRequest?: boolean;
  isShowingLocalJSXCommand?: boolean;
  isResponseStreaming?: boolean;
  delegatedActive?: boolean;
  isLoading: boolean;
  isQueryActive: boolean;
}
export interface TitleNames { sessionTitle?: string; aiSessionTitle?: string; agentTitle?: string; haikuTitle?: string }
export interface TerminalTitleSnapshot extends TitleNames {
  fromRename?: boolean;
  activity: TitleActivity;
  focused: boolean;
  active: boolean;
}

// eve/Ryo, 24k7d6mw [1292353,1292871), UTF-16.
export function eve(h: TitleActivity) { let T = Ryo(h); if (T !== undefined) return { status: 'waiting', waitingFor: T, working: false }; return { status: h.isLoading || h.delegatedActive ? 'busy' : 'idle', waitingFor: undefined, working: h.isQueryActive }; }
function Ryo(h: TitleActivity) { if (h.queuedElicitation) return 'input needed'; if (h.topDialogWaitingFor !== undefined) return h.topDialogWaitingFor; if (h.pendingWorkerRequest) return 'worker request'; if (h.pendingSandboxRequest) return 'sandbox request'; if (h.isShowingLocalJSXCommand && !h.isResponseStreaming && !h.delegatedActive) return 'dialog open'; return; }

// gEe/rV, 24k7d6mw [164141,165246), UTF-16.
export function resolveTerminalTitle(names: TitleNames, fromRename = true): string {
  const ee = fromRename ? names.sessionTitle : undefined, he = names.aiSessionTitle, Te = names.agentTitle, we = names.haikuTitle;
  return ee ?? he ?? Te ?? we ?? 'LiTcode';
}
const C6 = ['◐', '◑'], T6 = '✳', Ost = 960;
function Hyo(_t: number) { return (_t + 1) % C6.length; }

// Di/SEe, 1r9zp6s1 [24622,24997), UTF-16; Node supplies cancellable timeouts.
function SEe(o: { setTimeout(callback: () => void, ms: number): () => void }, r: () => void, l: number) {
  let u = false, c: () => void, p = () => { if (u) return; try { r(); } finally { if (!u) c = o.setTimeout(p, l); } };
  return c = o.setTimeout(p, l), () => { u = true; c(); };
}
const clock = { setTimeout(callback: () => void, ms: number) { const timer = setTimeout(callback, ms); timer.unref?.(); return () => clearTimeout(timer); } };

// bEe/gh, 1r9zp6s1 [27985,28095), kexg5hxg [8412,8488), UTF-16; OSC0 uses the direct writer.
export function terminalTitleSequence(o: string): string {
  const C = '\x1b]', Y9e = ';', nG = '\x07', hxn = '\x1b\\';
  const A = () => Su()?.terminal ?? detectTerminal();
  function gh(...e: (string | number)[]) { let r = A() === 'kitty' ? hxn : nG; return `${C}${e.join(Y9e)}${r}`; }
  return gh(0, pn(o));
}
function K3t() { let e = Su(); if (e) return e.mux; if (process.env.TMUX) return 'tmux'; if (process.env.STY) return 'screen'; if (process.env.ZELLIJ) return 'zellij'; return null; }

/** _6, 24k7d6mw [1293039,1293366), UTF-16; one owner replaces React state/effect subscriptions. */
export class TerminalTitle {
  private snapshot: TerminalTitleSnapshot | undefined;
  private frame = 0;
  private last: string | undefined;
  private cancel: (() => void) | undefined;
  private closed = false;
  constructor(private readonly write: (sequence: string) => void, private readonly disabled = process.env.LITCODE_DISABLE_TERMINAL_TITLE) {}
  update(snapshot: TerminalTitleSnapshot): void {
    if (this.closed) return;
    this.snapshot = snapshot;
    const isAnimating = eve(snapshot.activity).status === 'busy';
    const staticMux = K3t() !== null;
    const animate = !this.disabled && snapshot.active && snapshot.focused && isAnimating && !staticMux;
    if (!animate) { this.cancel?.(); this.cancel = undefined; }
    else if (!this.cancel) this.cancel = SEe(clock, () => { this.frame = Hyo(this.frame); this.publish(); }, Ost);
    this.publish();
  }
  private publish(): void {
    const snapshot = this.snapshot;
    if (!snapshot || !snapshot.active || this.closed || this.disabled) { this.last = undefined; return; }
    const ee = resolveTerminalTitle(snapshot, snapshot.fromRename), M = eve(snapshot.activity).status === 'busy', Te = K3t() !== null, Me = this.frame;
    const je = M && !Te ? C6[Me] ?? T6 : T6;
    const title = `${je} ${ee}`;
    if (title === this.last) return;
    this.last = title; this.write(terminalTitleSequence(title));
  }
  close(): void { this.closed = true; this.cancel?.(); this.cancel = undefined; this.snapshot = undefined; }
}
