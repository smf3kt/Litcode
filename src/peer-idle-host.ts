import type { z } from 'zod';
import type { InboundPolicy, PeerMode } from './local-peer.js';

export type PeerIdleNotice = {
  kind: 'idle' | 'exited' | 'unavailable' | 'expired';
  label: string;
  finishedAt?: number;
  detail?: string;
  modelVisible: boolean;
};

export type PeerIdleWireNotice = {
  orig_msg_id: string;
  state: string;
  finished_at?: unknown;
  detail?: unknown;
};

export type PeerIdleSender = (target: string, notice: PeerIdleWireNotice, pid: number | undefined,
  includeMode: boolean, procStart: string | undefined) => Promise<void>;

export type PeerIdleSourceHost = {
  conversation: () => string;
  canonicalTarget: (target: string) => string | undefined;
  policy: () => InboundPolicy;
  admission: (origin: { fromMode?: PeerMode; selfSent?: boolean }) => InboundPolicy;
  queueLength: () => number;
  heldCount: () => number;
  enabled: () => boolean;
  refusalClass: new (...args: never[]) => Error & { refusal: string };
  errorKind: (error: unknown) => 'busy' | 'gone' | 'other';
  log: (message: string) => void;
  reportError: (error: unknown) => void;
  safeText: (text: string) => string;
  safeError: (text: string) => string;
  enqueue: (entry: { value: string; agentId: string }) => void;
};

export type PeerIdleSource = {
  subscriptionSchema: z.ZodType<{ action: 'notify_when_idle'; from: string; msg_id: string; from_mode?: unknown }>;
  noticeSchema: z.ZodType<PeerIdleWireNotice & { action: 'peer_idle_notice'; from?: unknown; from_mode?: unknown }>;
  recordSubscriber: (address: string, target: string, msgId: string, pid: number | undefined,
    procStart: string | undefined, authenticated: boolean, mode: PeerMode | undefined, selfSent: boolean) => 'recorded' | 'invalid' | 'refused' | 'full';
  status: (idle: boolean, busy: boolean) => void;
  flush: (state: 'idle' | 'exited') => Promise<void>;
  label: (label: string) => string;
  track: (msgId: string, label: string, target: string) => { ok: true; priors: string[] } | { ok: false; reason: 'invalid-target' | 'cap' };
  has: (msgId: unknown) => boolean;
  forget: (msgId: string) => void;
  receive: (msgId: unknown, state: string, finishedAt: unknown, detail: unknown, mode: PeerMode | undefined, selfSent: boolean) => boolean;
  onNotice: (callback: ((notice: PeerIdleNotice) => void) | null) => void;
  lastText: (callback: (() => string) | null) => void;
  sender: (callback: PeerIdleSender | null) => void;
  onSubscribed: (callback: ((address: string, verified: boolean, replayed: boolean) => void) | null, replayDone?: (() => void) | null) => void;
  registeredInboxes: (callback: ((pids: number[]) => Promise<Map<number, string>>) | null) => void;
  subscriptionText: (address: string, verified: boolean) => string;
  display: (notice: PeerIdleNotice) => string;
  snapshotHeld: () => void;
  hostSubscription: (unsubscribe: (() => void) | null) => void;
  unavailable: (target: string, msgId: string, pid: number | undefined, authenticated: boolean, procStart: string | undefined) => void;
  enqueue: (notices: PeerIdleNotice[]) => void;
  modelText: (notice: PeerIdleNotice) => string;
  reset: () => void;
};
