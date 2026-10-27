import crypto from 'node:crypto';
import { z } from 'zod';

// XHn/z, 6zdc3jq1 [3332,3450)/[7600,7635), UTF-16.
export const PEER_LIMITS = Object.freeze({ bucketCapacity: 30, refillPerSecond: 0.5, dedupWindowMs: 30_000,
  maxSelfHops: 10, maxChainLength: 28, maxTrackedSenders: 256, maxQueuedPeerMessages: 50 });
export type PeerLimits = { [Key in keyof typeof PEER_LIMITS]: number };
export const peerDropReasonSchema = z.enum(['rate-limited', 'duplicate', 'hop-loop', 'hop-runaway', 'queue-full']);
export type PeerDropReason = z.infer<typeof peerDropReasonSchema>;
export type PeerAdmission = { admitted: true } | { admitted: false; reason: PeerDropReason };
export const peerHopChainSchema = z.array(z.string().regex(/^[0-9a-f]{24}$/)).max(32);

// OTs/nKe/n, 64ag51qf [3280,3354), 7s4db5eh [704,744), UTF-16.
const hopSecret = crypto.randomBytes(32);
export function peerHopToken(address: string): string {
  return crypto.createHmac('sha256', hopSecret).update(address).digest('hex').slice(0, 24);
}

// Ljn, 64ag51qf [3530,3664), UTF-16; typed wire metadata preserves the host's raw body.
export function appendPeerHop(chain: readonly string[] | undefined, token: string): string[] | undefined {
  if (chain === undefined) return undefined;
  const next = [...chain];
  if (token) next.push(token);
  if (next.length === 0) return undefined;
  return next.length > 32 ? next.slice(next.length - 32) : next;
}

// N/M/U, 6zdc3jq1 [2979,3328), UTF-16.
function refill(tokens: number, previous: number, now: number, capacity: number, rate: number): number {
  return Math.min(capacity, tokens + Math.max(0, now - previous) / 1000 * rate);
}
function hasToken(tokens: number): boolean { return tokens >= 1; }
function trackedValue<T>(entries: Map<string, T>, key: string, limit: number, create: () => T,
  recyclable: (value: T) => boolean = () => true): T {
  const existing = entries.get(key);
  if (existing !== undefined) { entries.delete(key); entries.set(key, existing); return existing; }
  while (entries.size >= Math.max(1, limit)) {
    let oldest: string | undefined;
    for (const [candidate, value] of entries) if (recyclable(value)) { oldest = candidate; break; }
    oldest ??= entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  const value = create(); entries.set(key, value); return value;
}

export type PeerReservation = { ok: false; sentInBurst: number } | { ok: true; refund: () => void };
// ie, 6zdc3jq1 [8337,9249), UTF-16.
export function createPeerPacer(limits: () => PeerLimits = () => PEER_LIMITS, now = Date.now) {
  const entries = new Map<string, { tokens: number; updatedAt: number; sentInBurst: number; burstStartedAt: number }>();
  function entry(key: string, at: number) {
    const { bucketCapacity, refillPerSecond, maxTrackedSenders } = limits();
    let fresh = false;
    const value = trackedValue(entries, key, maxTrackedSenders, () => {
      fresh = true;
      return { tokens: bucketCapacity, updatedAt: at, sentInBurst: 0, burstStartedAt: at };
    }, value => refill(value.tokens, value.updatedAt, at, bucketCapacity, refillPerSecond) >= bucketCapacity);
    if (!fresh) {
      value.tokens = refill(value.tokens, value.updatedAt, at, bucketCapacity, refillPerSecond); value.updatedAt = at;
      const window = bucketCapacity / Math.max(refillPerSecond, 0.000000001) * 1000;
      if (value.tokens >= bucketCapacity || at - value.burstStartedAt > window) { value.sentInBurst = 0; value.burstStartedAt = at; }
    }
    return value;
  }
  return {
    reserve(key: string): PeerReservation {
      const value = entry(key, now());
      if (!hasToken(value.tokens)) return { ok: false, sentInBurst: value.sentInBurst };
      value.tokens -= 1; value.sentInBurst += 1;
      let refunded = false;
      return { ok: true, refund: () => {
        if (refunded) return;
        refunded = true; value.tokens = Math.min(limits().bucketCapacity, value.tokens + 1);
        value.sentInBurst = Math.max(0, value.sentInBurst - 1);
      } };
    },
    credit(key: string): void {
      const value = entry(key, now()); value.tokens = Math.min(limits().bucketCapacity, value.tokens + 1);
      value.sentInBurst = Math.max(0, value.sentInBurst - 1);
    },
    debit(key: string): void {
      const value = entry(key, now()); value.tokens = Math.max(0, value.tokens - 1); value.sentInBurst += 1;
    },
  };
}

// he/lao, 6zdc3jq1 [3451,4432), UTF-16.
export function createPeerIngressGuard(limits: () => PeerLimits = () => PEER_LIMITS, now = Date.now) {
  const senders = new Map<string, { tokens: number; lastRefill: number; lastBody?: string; lastBodyAt: number }>();
  function checkHopChain(chain: readonly string[] | undefined, ownTokens: ReadonlySet<string>): PeerAdmission | undefined {
    const current = limits();
    if (chain !== undefined && chain.length > current.maxChainLength) return { admitted: false, reason: 'hop-runaway' };
    let selfHops = 0;
    if (chain && ownTokens.size) for (const token of chain) if (ownTokens.has(token)) selfHops++;
    if (selfHops >= current.maxSelfHops) return { admitted: false, reason: 'hop-loop' };
    return undefined;
  }
  return {
    checkHopChain,
    admit(input: { senderKey: string; body: string; hopChain?: readonly string[]; ownTokens: ReadonlySet<string> }): PeerAdmission {
      const current = limits(), at = now(), hop = checkHopChain(input.hopChain, input.ownTokens);
      if (hop) return hop;
      const sender = trackedValue(senders, input.senderKey, current.maxTrackedSenders,
        () => ({ tokens: current.bucketCapacity, lastRefill: now(), lastBody: undefined, lastBodyAt: 0 }));
      if (sender.lastBody !== undefined && sender.lastBody === input.body && at - sender.lastBodyAt < current.dedupWindowMs)
        return { admitted: false, reason: 'duplicate' };
      sender.tokens = refill(sender.tokens, sender.lastRefill, at, current.bucketCapacity, current.refillPerSecond);
      sender.lastRefill = at;
      if (!hasToken(sender.tokens)) return { admitted: false, reason: 'rate-limited' };
      sender.tokens -= 1; sender.lastBody = input.body; sender.lastBodyAt = at;
      return { admitted: true };
    },
    trackedSenderCount: () => senders.size,
  };
}

export type PeerDropReport = { from: string; reason: PeerDropReason; suppressed?: number };
type PendingReceipt = { lastImmediateAt: number; pendingIds: string[]; pending: number;
  timer?: NodeJS.Timeout; pendingSend?: (ids: string[]) => void | Promise<void> };
// K/pao, 6zdc3jq1 [5669,7590), UTF-16.
export function createPeerDropReporter(report: (value: PeerDropReport) => void, trailMs = 5000) {
  const receipts = new Map<string, PendingReceipt>();
  let receiptWindow = 0, receiptCount = 0;
  function allowReceipt(at = Date.now()): boolean {
    if (at - receiptWindow >= 60_000) { receiptWindow = at; receiptCount = 0; }
    if (receiptCount >= 40) return false;
    receiptCount++; return true;
  }
  function flush(value: PendingReceipt, allowed: () => boolean): void | Promise<void> {
    if (value.timer !== undefined) { clearTimeout(value.timer); value.timer = undefined; }
    const { pending, pendingIds, pendingSend } = value;
    value.pending = 0; value.pendingIds = []; value.pendingSend = undefined;
    if (pending > 0 && pendingSend && allowed()) return pendingSend(pendingIds);
  }
  const reports = new Map<string, { lastReportAt: number; suppressed: number }>();
  let reportWindow = 0, reportCount = 0, suppressed = 0;
  return {
    noteDropForReceipt(key: string, msgId: string | undefined, send: (ids: string[]) => void | Promise<void>, at = Date.now()): void {
      let value = receipts.get(key);
      if (value === undefined) value = { lastImmediateAt: Number.NEGATIVE_INFINITY, pendingIds: [], pending: 0 };
      receipts.delete(key); receipts.set(key, value);
      if (receipts.size > 256) {
        const oldest = receipts.keys().next().value;
        if (oldest !== undefined && oldest !== key) {
          const evicted = receipts.get(oldest); receipts.delete(oldest);
          if (evicted !== undefined) flush(evicted, () => allowReceipt(at));
        }
      }
      if (at - value.lastImmediateAt >= 60_000 && value.pending === 0) {
        value.lastImmediateAt = at;
        if (allowReceipt(at)) send([]);
        return;
      }
      value.pending++;
      if (msgId !== undefined && value.pendingIds.length < 256) value.pendingIds.push(msgId);
      value.pendingSend = send;
      if (value.timer === undefined) { value.timer = setTimeout(flush, trailMs, value, allowReceipt); value.timer.unref?.(); }
    },
    report(value: PeerDropReport, at = Date.now()): void {
      const key = `${value.from}\0${value.reason}`, previous = reports.get(key);
      if (previous && at - previous.lastReportAt < 60_000) { previous.suppressed++; return; }
      if (at - reportWindow >= 60_000) { reportWindow = at; reportCount = 0; }
      if (reportCount >= 20) { suppressed++; return; }
      reportCount++;
      const count = (previous?.suppressed ?? 0) + suppressed;
      suppressed = 0; reports.delete(key); reports.set(key, { lastReportAt: at, suppressed: 0 });
      if (reports.size > 256) { const oldest = reports.keys().next().value; if (oldest !== undefined) reports.delete(oldest); }
      report({ ...value, suppressed: count });
    },
    async flushPendingReceipts(budgetMs = 500): Promise<void> {
      const pending: (void | Promise<void>)[] = [];
      for (const value of receipts.values()) {
        if (value.pending > 0) pending.push(flush(value, allowReceipt));
        else if (value.timer !== undefined) { clearTimeout(value.timer); value.timer = undefined; }
      }
      if (pending.length === 0) return;
      await Promise.race([Promise.allSettled(pending), new Promise(resolve => setTimeout(resolve, budgetMs).unref?.())]);
    },
    dispose(): void {
      for (const value of receipts.values()) if (value.timer !== undefined) clearTimeout(value.timer);
      receipts.clear();
    },
  };
}
