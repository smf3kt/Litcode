import { z } from 'zod';
import type { PeerRecord } from './local-peer.js';

export const agentMessagePinSchema = z.object({ id: z.string().min(1).max(4096), name: z.string().min(1).max(400),
  ref: z.string().regex(/^[0-9a-f]{6,12}$/), sock: z.string().min(1).max(4096).optional() }).strict();
export type AgentMessagePin = z.infer<typeof agentMessagePinSchema>;
export type AgentCandidate = {
  kind: 'main' | 'subagent' | 'session';
  id: string;
  name: string;
  where: 'in-process' | 'this-machine';
  ref: string;
  lastActive?: number;
  sock?: string;
  stableId?: string;
  claimedSessionIds?: string[];
  derivedName?: boolean;
};
export type AgentCandidateIndex = {
  candidates: AgentCandidate[];
  byName: Map<string, AgentCandidate[]>;
  remoteNamesClaimedLocally: Map<string, Set<string>>;
};
export type AgentResolverState = {
  agentNameRegistry: Map<string, string>;
  tasks: Record<string, { id: string; type: 'local_agent'; agentType: string; status: string; startTime: number; stoppedByUser?: boolean }>;
  sendMessagePins: Record<string, AgentMessagePin>;
};
export type AgentNameHost = { sessionId: () => string; socket: () => string | undefined };
export type AgentNameSource = {
  index: (state: AgentResolverState, rows: { teamFile: null; sessions: PeerRecord[]; cloud: []; bridge: [] }) => AgentCandidateIndex;
  key: (name: string) => string;
  clean: (name: unknown) => string | null;
  display: (name: unknown) => string | null;
  printed: (candidate: { name: string; ref: string }) => string;
  parseRef: (name: string) => { name: string; ref: string } | null;
  choose: (byName: Map<string, AgentCandidate[]>, key: string, exactName?: string) => { kind: 'one'; candidate: AgentCandidate } | { kind: 'ambiguous' } | undefined;
  ref: (kind: AgentCandidate['kind'], id: string) => string;
  canonical: (target: string) => string | undefined;
  reserved: (name: string) => boolean;
  valid: (name: string) => boolean;
};
export type AgentResolvedTarget =
  | { kind: 'main' }
  | { kind: 'agent-live' | 'agent-stopped' | 'agent-evicted'; agentId: string; agentName: string; status?: string }
  | { kind: 'agent-stopped-by-user'; agentName: string }
  | { kind: 'local-session'; sock: string; pinId: string; displayName: string; exactUnique?: boolean; previouslyPinned?: boolean; sameNamedSiblings?: number }
  | { kind: 'ambiguous'; candidates: AgentCandidate[]; total: number; matchedBy: 'exact' | 'prefix' }
  | { kind: 'not-found'; closest: AgentCandidate[] };
export type AgentResolverHost = { names: AgentNameSource; isChildId: (id: string) => boolean };
export type AgentResolverSource = {
  exact: (index: AgentCandidateIndex, key: string, original: string, state: AgentResolverState, availability: AgentResolverAvailability) => AgentResolvedTarget | undefined;
  prefix: (index: AgentCandidateIndex, key: string, state: AgentResolverState, availability: AgentResolverAvailability) => AgentResolvedTarget | undefined;
  byRef: (index: AgentCandidateIndex, key: string, ref: string) => AgentCandidate | undefined;
  route: (candidate: AgentCandidate, state: AgentResolverState) => AgentResolvedTarget;
  child: (state: AgentResolverState, id: string, name: string) => AgentResolvedTarget;
  missing: (key: string, index: AgentCandidateIndex) => Extract<AgentResolvedTarget, { kind: 'not-found' }>;
};
export type AgentResolverAvailability = {
  bridgeSettled: true;
  cloudUnavailable: false;
  bridgeUnavailable: false;
  localUnavailable: boolean;
  localClaimedRemoteBodies: Set<string>;
  socksMirroredRemotely: Set<string>;
  searchTruncated: false;
};
export type AgentRosterRow = { agent: { name?: string; ref?: string; id?: string; type?: string; status?: string }; line: string };
export type AgentRosterSection = { kind: string; total: number; rows: AgentRosterRow[]; notes: { kind: string; text: string }[]; text: string };
export type AgentRosterSource = {
  subagents: (rows: { agentId: string; name?: string; agentType: string; status: string; startTime: number }[], candidates: Map<string, AgentCandidate>) => AgentRosterSection;
  row: (candidate: { shown: AgentRosterRow['agent']; printed: string }, fields: (string | { type: string } | { status: string } | undefined)[]) => AgentRosterRow;
  candidate: (candidate: AgentCandidate | undefined, name: string | null, fallback: string) => { shown: AgentRosterRow['agent']; printed: string };
  section: (kind: string, title: string, rows: AgentRosterRow[], total?: number) => AgentRosterSection;
  age: (milliseconds: number) => string;
};
