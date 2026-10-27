import crypto from 'node:crypto';
import path from 'node:path';
import { createSourcePeerIdle } from './peer-idle-state-source.js';
import { addressPath, inboundVerdict, listRecords, peerAddress, PeerSendRefusal, pidMatches, processGone, recordStart,
  receiptTarget, refundablePeerSend, sendPeerFrame, type InboundPolicy, type PeerMode } from './local-peer.js';
import { encodePeerAddress } from './local-peer-envelope.js';
import type { PeerIdleNotice, PeerIdleSource } from './peer-idle-host.js';
import { kg, u6 } from './peer-idle-log-source.js';

export type PeerIdleHost = {
  enabled: () => boolean;
  conversation: () => string;
  queueLength: () => number;
  lastText: () => string;
  onNotice: (notice: PeerIdleNotice, display: string) => void;
  enqueue: (text: string, conversationId: string) => void;
  onSubscribed?: (text: string) => void;
};

export type PeerIdleSubscription = { success: true; msg_id: string; peer_known_capable: boolean }
  | { success: false; reason: string; restored_earlier?: true };

export function peerIdleErrorKind(error: unknown): 'busy' | 'gone' | 'other' {
  // b_e/hgr, 6zdc3jq1 [10421,10523)/[10723,10844), UTF-16.
  if (error instanceof PeerSendRefusal && error.refusal === 'no-live-inbox') return 'gone';
  const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (code === 'ENOENT' || code === 'ECONNREFUSED') return 'gone';
  return code === 'EBUSY' || code === 'EAGAIN' ? 'busy' : 'other';
}

const canonical = (target: string) => addressPath(target) ?? (path.isAbsolute(target) ? path.resolve(target) : undefined);

export class LocalPeerIdle {
  readonly source: PeerIdleSource;
  private pending: { notice: PeerIdleNotice; conversation: string }[] = [];
  private coalesce?: NodeJS.Timeout;
  private summary?: NodeJS.Timeout;
  private windowStart = 0;
  private announced = 0;
  private suppressed = 0;

  constructor(private readonly options: {
    host: PeerIdleHost;
    userDir: string;
    address: string;
    heldCount: () => number;
    policy: () => InboundPolicy | undefined;
    mode: () => { mode: string; bypassAvailable?: boolean } | null;
    logger: (message: string) => void;
  }) {
    const { host } = options;
    this.source = createSourcePeerIdle({
      conversation: host.conversation, canonicalTarget: canonical,
      policy: () => inboundVerdict({ explicit: options.policy(), recipient: options.mode() }).policy,
      admission: origin => inboundVerdict({ explicit: options.policy(), recipient: options.mode(), ...origin }).policy,
      queueLength: host.queueLength, heldCount: options.heldCount, enabled: host.enabled,
      refusalClass: PeerSendRefusal, errorKind: peerIdleErrorKind, log: options.logger,
      reportError: error => options.logger(u6(String(error))), safeText: kg, safeError: u6,
      enqueue: entry => host.enqueue(entry.value, entry.agentId),
    });
    this.source.sender(async (target, notice, pid, includeMode, procStart) => {
      await sendPeerFrame(peerAddress(target), { type: 'control', action: 'peer_idle_notice', ...notice,
        from: encodePeerAddress(options.address), msgV: 1, msg_id: crypto.randomUUID(),
        ...(includeMode ? { from_mode: this.mode() } : {}) },
      { userDir: options.userDir, expectPeerPid: pid, expectPeerProcStart: procStart });
    });
    this.source.registeredInboxes(async pids => {
      // yao/J, 6zdc3jq1 [14707,14980)/[15098,15215), UTF-16.
      const records = (await listRecords(options.userDir, { rejectUnreadable: true })).filter(row => pids.includes(row.pid) && row.sock !== '');
      const verified = await Promise.all(records.map(async row => recordStart(row) !== undefined && !processGone(row.pid)
        && await pidMatches(row.pid, recordStart(row)) === true));
      return new Map(records.filter((_row, index) => verified[index]).map(row => [row.pid, row.sock]));
    });
    this.source.lastText(host.lastText);
    this.source.onNotice(notice => {
      if (this.pending.length >= 50) this.flushNotices();
      this.pending.push({ notice, conversation: host.conversation() });
      if (this.coalesce === undefined) {
        this.coalesce = setTimeout(() => this.flushNotices(), 500);
        this.coalesce.unref();
      }
    });
    this.source.onSubscribed((address, verified) => this.announce(this.source.subscriptionText(address, verified)));
  }

  private mode(): PeerMode { return this.options.mode()?.mode === 'bypass' ? 'bypass' : 'prompting'; }

  // tve/Uyo/jyo/Wyo, 24k7d6mw [1293374,1295081), UTF-16.
  flushNotices(): void {
    if (this.coalesce !== undefined) clearTimeout(this.coalesce);
    this.coalesce = undefined;
    const notices = this.pending.splice(0).filter(row => row.conversation === this.options.host.conversation()).map(row => row.notice);
    for (const notice of notices) this.options.host.onNotice(notice, this.source.display(notice));
    this.source.enqueue(notices.filter(notice => notice.modelVisible));
  }

  private announce(text: string): void {
    const now = Date.now();
    if (now - this.windowStart > 60_000) { this.windowStart = now; this.announced = 0; }
    if (this.announced < 10) { this.announced++; this.options.host.onSubscribed?.(text); return; }
    this.suppressed++;
    if (this.summary === undefined) {
      this.summary = setTimeout(() => this.flushSummary(), Math.max(0, 60_000 - (now - this.windowStart)));
      this.summary.unref();
    }
  }

  private flushSummary(): void {
    if (this.summary !== undefined) clearTimeout(this.summary);
    this.summary = undefined;
    const count = this.suppressed; this.suppressed = 0;
    if (count) this.options.host.onSubscribed?.(`${count} more idle ${count === 1 ? 'subscription was' : 'subscriptions were'} recorded in the last minute.`);
  }

  // K/g, gs2kyzqb [14064,15416), UTF-16. The tool admits only the local UDS arm.
  async subscribe(address: string, signal: AbortSignal): Promise<PeerIdleSubscription> {
    signal.throwIfAborted();
    if (!this.options.host.enabled()) return { success: false, reason: 'disabled' };
    if (this.options.policy() === 'refuse') return { success: false, reason: 'requester-refuses-inbound' };
    const target = addressPath(address);
    if (target === undefined) return { success: false, reason: 'unreachable-namespace' };
    if (target === canonical(this.options.address)) return { success: false, reason: 'self-target' };
    const record = (await listRecords(this.options.userDir)).find(row => canonical(row.sock) === target);
    if (record !== undefined && !record.peerFeatures?.includes('notify_idle')) return { success: false, reason: 'peer-unsupported' };
    // MTs, 64ag51qf [8653,8816), UTF-16; cross-directory replies require the peer capability.
    const own = this.options.address.slice(4);
    const sameDirectory = path.dirname(target) === path.dirname(own) && own.endsWith('.sock');
    if (!sameDirectory && !(record?.peerFeatures?.includes('reply_across_default_dirs')
      && receiptTarget(this.options.address, target, process.pid) !== undefined)) return { success: false, reason: 'unreachable-namespace' };
    const msgId = crypto.randomUUID(), tracked = this.source.track(msgId, record?.name ?? address, address);
    if (!tracked.ok) return { success: false, reason: tracked.reason === 'cap' ? 'cap' : 'unreachable-namespace' };
    try {
      await sendPeerFrame(address, { type: 'control', action: 'notify_when_idle', msgV: 1, msg_id: msgId,
        from: encodePeerAddress(this.options.address), from_mode: this.mode() },
      { userDir: this.options.userDir, expectPeerPid: record?.pid, expectPeerProcStart: record === undefined ? undefined : recordStart(record), signal });
      return { success: true, msg_id: msgId, peer_known_capable: record !== undefined };
    } catch (error) {
      this.options.logger(`[peer-idle] subscription send failed: ${u6(String(error))}`);
      if (peerIdleErrorKind(error) === 'gone') {
        this.source.forget(msgId); for (const prior of tracked.priors) this.source.forget(prior);
        return { success: false, reason: 'peer-gone' };
      }
      if (refundablePeerSend(error)) {
        this.source.forget(msgId);
        return { success: false, reason: 'send-failed', ...(tracked.priors.some(prior => this.source.has(prior)) ? { restored_earlier: true } : {}) };
      }
      return { success: false, reason: 'send-uncertain' };
    }
  }

  dispose(): void {
    this.source.onNotice(null); this.source.onSubscribed(null); this.source.lastText(null);
    this.flushNotices(); this.flushSummary(); this.source.reset();
  }
}
