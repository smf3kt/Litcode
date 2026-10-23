import { execFile } from 'node:child_process';
import { z } from 'zod';
import { Agt, ipn } from './notification-plist.js';
import { detectTerminal } from './tui-selection-copy.js';
import { Su } from './plugin-chain-terminal-environment-host.js';

// tY, ppsy9aeg [619,717), schema 3cynezh1 at272538, UTF-16.
export const NOTIFICATION_CHANNELS = ['auto', 'iterm2', 'terminal_bell', 'iterm2_with_bell', 'kitty', 'ghostty', 'notifications_disabled'] as const;
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS).optional().catch(undefined);
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];
export interface LocalNotification { message: string; title?: string }
export interface NotificationWriter {
  notifyITerm2(notification: LocalNotification): void;
  notifyKitty(notification: { message: string; title: string; id: number }): void;
  notifyGhostty(notification: { message: string; title: string }): void;
  notifyBell(): void;
}

// m/gh/OI, z7whhrje [7839,7954), kexg5hxg [8412,8667), UTF-16.
function m(r: string) { let n = ''; for (let o = 0; o < r.length; o++) { let u = r.charCodeAt(o); n += u < 32 || u >= 127 && u <= 159 ? ' ' : r[o]; } return n; }
export function notificationWriter(write: (text: string) => void, env: NodeJS.ProcessEnv = process.env): NotificationWriter {
  const C = '\x1b]', Y9e = ';', nG = '\x07', hxn = '\x1b\\';
  const A = () => Su()?.terminal ?? detectTerminal();
  const a = env;
  function K3t() { let e = Su(); if (e) return e.mux; if (a.TMUX) return 'tmux'; if (a.STY) return 'screen'; if (a.ZELLIJ) return 'zellij'; return null; }
  function gh(...e: (string | number)[]) { let r = A() === 'kitty' ? hxn : nG; return `${C}${e.join(Y9e)}${r}`; }
  function OI(e: string) { let r = K3t(); if (r === 'tmux') return `\x1bPtmux;${e.replaceAll('\x1b', '\x1b\x1b')}\x1b\\`; if (r === 'screen') return `\x1bP${e.replaceAll('\x1b', '\x1b\x1b')}\x1b\\`; return e; }
  // ZO callbacks, z7whhrje [7986,9007), UTF-16; terminal owns the raw writer.
  return {
    notifyITerm2: ({ message: s, title: d }) => { let c = d ? `${d}: ${s}` : s; write(OI(gh(9, m(c)))); },
    notifyKitty: ({ message: s, title: d, id: c }) => {
      write(OI(gh(99, `i=${c}:d=0:p=title`, m(d)))); write(OI(gh(99, `i=${c}:p=body`, m(s)))); write(OI(gh(99, `i=${c}:d=1:a=focus`, '')));
    },
    notifyGhostty: ({ message: s, title: d }) => { write(OI(gh(777, 'notify', m(d), m(s)))); },
    notifyBell: () => { write(nG); },
  };
}

interface ProcessReply { code: number; stdout: string }
type ProcessRunner = (file: string, args: string[], signal: AbortSignal) => Promise<ProcessReply>;
const run: ProcessRunner = (file, args, signal) => new Promise((resolve, reject) => {
  execFile(file, args, { encoding: 'utf8', signal, timeout: 2000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
    if (error) {
      if (typeof error.code === 'number') resolve({ code: error.code, stdout });
      else reject(error);
    } else resolve({ code: 0, stdout });
  });
});

/** w, m18zhdb2 [3864,4544), UTF-16; Node execFile replaces the bounded source process host. */
export async function appleTerminalBell(signal: AbortSignal, st: ProcessRunner = run): Promise<boolean> {
  try {
    let n = (await st('osascript', ['-e', 'tell application "Terminal" to name of current settings of front window'], signal)).stdout.trim();
    if (!n) return false;
    let o = await st('defaults', ['export', 'com.apple.Terminal', '-'], signal);
    if (o.code !== 0) return false;
    let r = ipn(o.stdout); if (!Agt(r)) return false;
    let s = r['Window Settings'], l = Agt(s) ? s[n] : undefined;
    if (!Agt(l)) return false;
    return l.Bell === false;
  } catch { return false; }
}

/** A/I/y/E, m18zhdb2 [2913,3864), UTF-16; sends are bound to one terminal lifetime. */
export class TerminalNotifications {
  private channel: NotificationChannel = 'auto';
  private readonly lifetime = new AbortController();
  private readonly writer: NotificationWriter;
  constructor(write: (text: string) => void, private readonly active: () => boolean) {
    this.writer = notificationWriter(text => { if (!this.lifetime.signal.aborted && this.active()) write(text); });
  }
  setChannel(value?: NotificationChannel): void { this.channel = value ?? 'auto'; }
  close(): void { this.lifetime.abort(); }
  async send(notification: LocalNotification, signal: AbortSignal): Promise<string> {
    const combined = AbortSignal.any([signal, this.lifetime.signal]);
    if (combined.aborted || !this.active()) return 'no_surface';
    const terminal = Su()?.terminal ?? detectTerminal();
    const o = this.writer, p = 'LiTcode';
    const probe = () => appleTerminalBell(combined);
    async function I() {
      switch (terminal) {
        case 'Apple_Terminal': return await probe() ? 'terminal_bell' : 'no_method_available';
        case 'iTerm.app': return 'iterm2';
        case 'kitty': return 'kitty';
        case 'ghostty': return 'ghostty';
        default: return 'no_method_available';
      }
    }
    function y(e: string, n: LocalNotification, o: NotificationWriter) {
      if (combined.aborted) return;
      switch (e) {
        case 'iterm2': o.notifyITerm2(n); return;
        case 'iterm2_with_bell': o.notifyITerm2(n), o.notifyBell(); return;
        case 'kitty': o.notifyKitty({ ...n, title: n.title || p, id: E() }); return;
        case 'ghostty': o.notifyGhostty({ ...n, title: n.title || p }); return;
        case 'terminal_bell': o.notifyBell(); return;
        case 'disabled': case 'none': case 'no_method_available': return;
      }
    }
    function E() { return Math.floor(Math.random() * 1e4); }
    async function A(e: string, n: LocalNotification, o: NotificationWriter) {
      if (e === 'auto') { let s = await I(); return y(s, n, o), s; }
      let r;
      switch (e) {
        case 'iterm2': case 'iterm2_with_bell': case 'kitty': case 'ghostty': case 'terminal_bell': r = e; break;
        case 'notifications_disabled': r = 'disabled'; break;
        default: r = 'none';
      }
      try { return y(r, n, o), r; } catch { return 'error'; }
    }
    return A(this.channel, notification, o);
  }
}

/** Awo/qve and SEe, 24k7d6mw [1318654,1318983), 1r9zp6s1 [24861,24997), UTF-16. */
export function pendingPermissionNotification(lastInteraction: () => number, send: () => void): () => void {
  const born = Date.now(); let stopped = false, sent = false;
  const Ip = lastInteraction;
  function Awo(h: number, T: number) { return Date.now() - Math.max(Ip(), T) >= h; }
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    if (stopped || sent) return;
    if (Awo(6000, born)) { sent = true; send(); }
    if (!stopped && !sent) { timer = setTimeout(tick, 6000); timer.unref?.(); }
  };
  timer = setTimeout(tick, 6000); timer.unref?.();
  return () => { stopped = true; clearTimeout(timer); };
}
