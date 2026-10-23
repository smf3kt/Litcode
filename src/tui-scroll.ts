import type { TranscriptEntry, TranscriptScrollCommand } from './tui-transcript.js';

interface ScrollViewport {
  scrollTo(value: number): void;
  scrollBy(value: number): void;
  scrollToBottom(): void;
  getScrollTop(): number;
  getPendingDelta(): number;
  getScrollHeight(): number;
  getViewportHeight(): number;
  isSticky(): boolean;
}

// rMe/pee/ybt/Sbt/bbt, 24k7d6mw [130997,132084), UTF-16; Fvn is an excluded telemetry counter.
function scrollCommands(viewport: ScrollViewport, enabled: () => boolean) {
  const hs = (_key: string, _fallback: boolean) => ({ value: enabled() });
  const Fvn = () => {};
  function rMe(h: ScrollViewport) { if (hs('autoScrollEnabled', true).value) h.scrollToBottom(); else h.scrollTo(Math.max(0, h.getScrollHeight() - h.getViewportHeight())); return true; }
  function pee(h: ScrollViewport, T: number, M = true) { let L = Math.max(0, h.getScrollHeight() - h.getViewportHeight()), ee = Math.min(h.getScrollTop(), L) + h.getPendingDelta() + T; if (ee >= L) return rMe(h); if (ee <= 0 && M) Fvn(); return h.scrollTo(Math.max(0, ee)), false; }
  function ybt(h: ScrollViewport, T: number) { let M = Math.max(0, h.getScrollHeight() - h.getViewportHeight()); if (h.getScrollTop() + h.getPendingDelta() + T >= M) return rMe(h); return h.scrollBy(T), false; }
  function Sbt(h: ScrollViewport, T: number, M = true) { if (h.getScrollTop() + h.getPendingDelta() - T <= 0) { if (M) Fvn(); h.scrollTo(0); return; } h.scrollBy(-T); }
  function bbt(h: ScrollViewport, T: TranscriptScrollCommand | null, M = true) { switch (T) { case null: return null; case 'lineUp': case 'lineDown': return pee(h, T === 'lineDown' ? 1 : -1, M); case 'halfPageUp': case 'halfPageDown': { let L = Math.max(1, Math.floor(h.getViewportHeight() / 2)); return pee(h, T === 'halfPageDown' ? L : -L, M); } case 'fullPageUp': case 'fullPageDown': { let L = Math.max(1, h.getViewportHeight()); return pee(h, T === 'fullPageDown' ? L : -L, M); } case 'top': return h.scrollTo(0), false; case 'bottom': return h.scrollToBottom(), true; } }
  return (command: TranscriptScrollCommand, wheel: boolean): boolean => {
    if (command === 'pageUp' || command === 'pageDown')
      return pee(viewport, Math.max(1, Math.floor(viewport.getViewportHeight() / 2)) * (command === 'pageDown' ? 1 : -1));
    if (wheel && (command === 'lineUp' || command === 'lineDown')) {
      if (viewport.getScrollHeight() <= viewport.getViewportHeight()) return viewport.isSticky();
      if (command === 'lineDown') return ybt(viewport, 1);
      Sbt(viewport, 1); return false;
    }
    return bbt(viewport, command) ?? false;
  };
}

interface ScrollNode {
  scrollTop: number;
  stickyScroll: boolean;
  scrollHeight: number;
  scrollViewportHeight: number;
  scrollHeightHwm?: number;
  pendingScrollDelta?: number;
  attributes: { stickyScroll: boolean; followGrowth: boolean };
}

// Us, 06azbynj [286619,287168), UTF-16; synchronous row projection replaces Yoga measurement/drain.
function followGrowth(n: ScrollNode, ue: number, me: number): number {
  const se = n.scrollHeight, ve = n.scrollViewportHeight, Te = Math.max(0, ue - me);
  let Ie = n.scrollTop ?? 0, tt = n.attributes.stickyScroll, qe = n.stickyScroll ?? Boolean(tt), at = qe ? se : Math.max(n.scrollHeightHwm ?? 0, se);
  n.scrollHeightHwm = qe ? undefined : Math.max(at, ue);
  let Rt = Math.max(0, at - ve), yt = ue >= se, ti = n.attributes.followGrowth !== false;
  if ((qe || tt !== false && ti && yt && Ie >= Rt) && (n.pendingScrollDelta ?? 0) >= 0) {
    n.scrollTop = Te; n.pendingScrollDelta = undefined;
    if (n.stickyScroll === false && Ie >= Rt) n.stickyScroll = true;
  }
  const position = n.scrollTop + (n.pendingScrollDelta ?? 0);
  n.scrollTop = Math.max(0, Math.min(position, Math.max(Te, at - me)));
  n.pendingScrollDelta = undefined;
  n.scrollHeight = ue; n.scrollViewportHeight = me;
  return Math.max(0, Math.min(n.scrollTop, Te));
}

interface ScrollMessage { type: string; message: { content: { type: string; text?: string }[] } }
// Dv/Av, 3gz7s57c [28427,28754), UTF-16; local entries are projected at the owner boundary.
function Dv(l: ScrollMessage[], u: number) { let m = 0, f = false; for (let h = u; h < l.length; h++) { let T = l[h]!; if (T.type === 'progress') continue; if (T.type === 'assistant' && !Av(T)) continue; let M = T.type === 'assistant'; if (M && !f) m++; f = M; } return m; }
function Av(l: ScrollMessage) { if (l.type !== 'assistant') return false; for (let u of l.message.content) if (u.type === 'text' && u.text?.trim()) return true; return false; }

/** p4, 24k7d6mw [1333944,1336535), UTF-16; one terminal replaces store/ref subscriptions. */
export class TranscriptScroll implements ScrollViewport {
  private node: ScrollNode = { scrollTop: 0, stickyScroll: true, scrollHeight: 0, scrollViewportHeight: 0,
    attributes: { stickyScroll: true, followGrowth: true } };
  private away = false;
  private slot: boolean | undefined;
  private divider: { y: number; start: number } | undefined;
  private entries: readonly TranscriptEntry[] = [];
  private readonly commands = scrollCommands(this, () => this.node.attributes.followGrowth);

  setEnabled(value?: boolean): void { this.node.attributes.followGrowth = value !== false; }
  reset(): void {
    this.node = { scrollTop: 0, stickyScroll: true, scrollHeight: 0, scrollViewportHeight: 0,
      attributes: { stickyScroll: true, followGrowth: this.node.attributes.followGrowth } };
    this.away = false; this.slot = undefined; this.divider = undefined; this.entries = [];
  }
  layout(total: number, rows: number, entries: readonly TranscriptEntry[]): number {
    this.entries = entries;
    if (this.divider && entries.length < this.divider.start) this.divider = undefined;
    return followGrowth(this.node, total, Math.max(0, rows));
  }
  // OT/K, 6x3scwgf [1537,1740)/[1953,2375)/[2770,2871), UTF-16.
  scrollTo(value: number): void {
    this.node.stickyScroll = false; this.node.scrollHeightHwm = undefined;
    this.node.pendingScrollDelta = undefined; this.node.scrollTop = Math.max(0, Math.floor(value));
  }
  scrollBy(value: number): void {
    this.node.stickyScroll = false; this.node.scrollHeightHwm = undefined;
    this.node.scrollTop = Math.min(this.node.scrollTop, Math.max(0, this.node.scrollHeight - this.node.scrollViewportHeight));
    this.node.pendingScrollDelta = (this.node.pendingScrollDelta ?? 0) + Math.floor(value);
  }
  scrollToBottom(): void { this.node.pendingScrollDelta = undefined; this.node.stickyScroll = true; }
  getScrollTop(): number { return this.node.scrollTop; }
  getPendingDelta(): number { return this.node.pendingScrollDelta ?? 0; }
  getScrollHeight(): number { return this.node.scrollHeight; }
  getViewportHeight(): number { return this.node.scrollViewportHeight; }
  isSticky(): boolean { return this.node.stickyScroll; }

  repin(force = false): void {
    if (!force && !this.node.attributes.followGrowth) return;
    this.scrollToBottom(); this.divider = undefined; this.away = false;
  }
  onPromptEdit(value: string, previous: string): void {
    if (previous !== '' || value === '' || this.away) return;
    this.repin();
  }
  onUserRowLanded(own: boolean): void { if (own || !this.away) this.repin(); }
  onBelowTranscriptSlotChange(value: boolean): void {
    const previous = this.slot; this.slot = value;
    if (previous === undefined || previous === value) return;
    if (this.isSticky()) this.repin();
  }
  scroll(command: TranscriptScrollCommand, wheel = false): void {
    const bottom = this.commands(command, wheel);
    this.away = !bottom;
    if (bottom) this.divider = undefined;
    else if (!this.divider && this.getScrollTop() + this.getPendingDelta()
      < Math.max(0, this.getScrollHeight() - this.getViewportHeight()))
      this.divider = { y: this.getScrollHeight(), start: this.entries.length };
  }
  reveal(value: number): void { this.scrollTo(value); this.away = true; }
  jumpToNew(): void { this.scrollToBottom(); this.away = false; }
  // nmt predicate [31126,31380), UTF-16; already-drained projected offsets have no pending delta.
  get pill(): { count: number } | undefined {
    if (this.isSticky()) return;
    const bottom = this.getScrollTop() + this.getPendingDelta() + this.getViewportHeight();
    if (this.divider ? bottom >= this.divider.y || bottom >= this.getScrollHeight()
      : this.node.attributes.followGrowth || bottom >= this.getScrollHeight()) return;
    const messages = this.entries.map(entry => ({ type: entry.duration ? 'progress' : entry.kind,
      message: { content: [{ type: 'text', text: entry.markdown ?? entry.text }] } }));
    const unseen = this.divider && messages.slice(this.divider.start)
      .some(message => message.type !== 'progress' && (message.type !== 'assistant' || Av(message)));
    return { count: unseen && this.divider ? Math.max(1, Dv(messages, this.divider.start)) : 0 };
  }
}
