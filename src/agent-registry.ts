import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { observeApprovalOperation } from './approval-operation-observer.js';
import fs from 'node:fs';
import path from 'node:path';
import { Agent, assertPaired, recoverPendingToolResults, type AgentEvents, type RunResult } from './agent.js';
import { Session, fingerprint, fingerprintOf, readSessionJournal, renderNotificationBatch, type NotificationBatch, type SessionConfig } from './session.js';
import { issueNotificationAuthorization } from './notification-authorization.js';
import { instructionSources, loadProjectConfig, loadSkillsFromDirectories, rebaseChildInstructions, type SkillInfo } from './config.js';
import { AgentHistoryStore, type AgentHistoryHeader, type AgentHistoryRecord, type ReadyWorkerDelivery, type ParkedWorkerDelivery } from './agent-history.js';
import { readSkillScope, readSkillScopeWitness, writeSkillScope, type SkillScope } from './skill-scope.js';
import type { ModelProvider } from './provider.js';
import { bindScopedChildTool, type ToolContext, type ToolDefinition } from './tools.js';
import type { HookCommandHome } from './hooks.js';
import { permissionDecision, permissionOwner, seedPermissionUpdates, effectivePermissionPolicy, childPermissionState, bindPermissionOwner, type LivePermissionOwner, type PermissionDecision } from './permissions.js';
import { prepareSkillHooks, skillToolApproval } from './skill-runtime.js';
import { CLAMPED_SHELL_TOOLS, normalizeBashCommandClamp, normalizeDisallowedTools, toolNameDenied,
  validateDisallowedTools } from './agent-tool-restrictions.js';
import { assertAgentSpawnDepth, capChildOutput, childConfig, childPromptSuffix, instructionEndMarkers, selectChildTools, createChildHookLifecycle, advancedChildFields, advancedChildProperties,
  resolveChildLaunch, forkMessages, preloadAgentSkills, validateChildEnvironment, type ChildHookOptions, type AdvancedChildOptions,
  type ChildEnvironmentLease, type ChildLaunchOptions } from './subagents.js';
import { scrubSubagentOutput } from './subagent-output-scrub.js';
import type Anthropic from '@anthropic-ai/sdk';
import { createAgentProgress, agentProgressSnapshot, observeAgentResponse, observeAgentStream,
  type AgentProgressTracker } from './agent-progress.js';
import type { AgentTaskDetail } from './agent-details.js';
import { transcriptEvent, type AgentTranscript, type AgentTranscriptRecord } from './agent-transcript.js';
import type { MessageOrigin } from './message-origin.js';
import { compileStructuredOutputSchema, formatSchemaIssues, STRUCTURED_OUTPUT_RETRY_LIMIT, STRUCTURED_OUTPUT_SUCCESS,
  STRUCTURED_OUTPUT_SYSTEM_NOTE, STRUCTURED_OUTPUT_TOOL_NAME, STRUCTURED_OUTPUT_TOOL_PROMPT,
  type CompiledJsonSchema, type JsonValue } from './structured-output.js';

export type AgentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentDescriptor = {
  id: string; session_id: string; name: string | null; status: AgentStatus;
  mode: 'explore' | 'general'; model: string; summary: string; error: string | null;
  reason: string | null; model_calls: number; queued_messages: number;
  workspace?: string; subagent_type?: string; cleanup_error?: string;
  structured_output?: JsonValue; structured_error?: string;
};
export type AgentNotification = { kind: 'agent'; sequence: number; agent: AgentDescriptor; runId?: string;
  subscription?: { id: string; state: 'idle' | 'expired' } };
export type AgentPollResult = { revision: number; changed: boolean; agents: { id: string; status: AgentStatus }[] };
export type AgentIdleSubscription = { id: string; agent_id: string; expires_ms: number };
export type SessionApproval = (tool: ToolDefinition, input: unknown, decision: PermissionDecision, signal: AbortSignal) => Promise<PermissionDecision>;
export type AgentRegistryLimits = {
  maxConcurrency: number; maxHistory: number; maxMailboxCount: number; maxMailboxBytes: number;
  maxMessageBytes: number; maxAgentMessages: number; maxJournalEvents: number; maxJournalBytes: number;
  maxOutputBytes: number; maxEvents: number; maxEventBytes: number;
  maxIdleSubscriptions: number; maxPollWaiters: number;
};
export type AgentRegistryOptions = ChildHookOptions & AdvancedChildOptions & {
  source: SessionConfig | (() => SessionConfig); provider: ModelProvider; tools: ToolDefinition[];
  parentSessionId?: string;
  requireSessionOwner?: boolean;
  sessionOwner?: () => Session | undefined;
  signal?: AbortSignal; onNotification?: (event: AgentNotification) => void;
  onChange?: () => void;
  limits?: Partial<AgentRegistryLimits>;
};
export type AgentLaunch = ChildLaunchOptions & {
  prompt: string; name?: string; background?: boolean;
  /** Workflow schema mode (`agent({schema})`): the child must return this shape. */
  structured_schema?: unknown;
  /** Workflow tool narrowing (`agent({disallowedTools, bashCommandClamp})`). */
  disallowed_tools?: unknown; bash_command_clamp?: unknown;
  /** Workflow stall watchdog (`agent({stallMs})`). */
  stall_ms?: unknown;
};

const launchSchema = z.object({
  prompt: z.string().refine(value => value.trim().length > 0, 'Prompt is empty'), mode: z.enum(['explore', 'general']).default('explore'),
  max_turns: z.number().int().min(1).max(30).default(10),
  name: z.string().trim().min(1).max(128).optional(), background: z.boolean().default(false),
  model: z.string().trim().min(1).max(256).optional(), structured_schema: z.unknown().optional(),
  disallowed_tools: z.unknown().optional(), bash_command_clamp: z.unknown().optional(),
  stall_ms: z.unknown().optional(),
}).strict();
const advancedLaunchSchema = launchSchema.extend({ mode: z.enum(['explore', 'general']).optional(),
  max_turns: z.number().int().min(1).max(30).optional(), ...advancedChildFields }).strict();
const selectorSchema = z.string().trim().min(1).max(256);
const messageSchema = z.string().refine(value => value.trim().length > 0, 'Message is empty');
const waitSchema = z.number().int().min(0).max(30_000);
const DEFAULTS: AgentRegistryLimits = {
  maxConcurrency: 8, maxHistory: 100, maxMailboxCount: 32, maxMailboxBytes: 128 * 1024,
  maxMessageBytes: 32 * 1024, maxAgentMessages: 100, maxJournalEvents: 10_000,
  maxJournalBytes: 16 * 1024 * 1024, maxOutputBytes: 24_000,
  maxEvents: 256, maxEventBytes: 256 * 1024,
  maxIdleSubscriptions: 128, maxPollWaiters: 64,
};
const terminal = (status: AgentStatus) => ['completed', 'failed', 'cancelled'].includes(status);

// Return a bounded field without adding a journal-oriented truncation marker.
function field(text: string, limit: number): string {
  const bytes = Buffer.from(text);
  let end = Math.min(bytes.length, limit);
  while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString('utf8');
}

type StructuredOutputState = {
  compiled: CompiledJsonSchema; value?: JsonValue; attempts: number; lastError?: string; capError?: string;
};

/** The recovered `Ea` tool (chunk-5wc3wh5m.js): an empty internal schema, the
 *  caller's JSON Schema as the API shape, and `endsTurn` on success. Validation
 *  failures are tool errors, which the model retries until the source's cap. */
function createStructuredOutputTool(schema: unknown, state: StructuredOutputState): ToolDefinition {
  return {
    schema: { name: STRUCTURED_OUTPUT_TOOL_NAME, description: STRUCTURED_OUTPUT_TOOL_PROMPT,
      input_schema: schema as Anthropic.Tool['input_schema'] },
    readOnly: true, endsTurn: true,
    async execute(input) {
      if (state.capError !== undefined) throw new Error(state.capError);
      const validation = state.compiled.validate(input);
      if (!validation.valid) {
        state.attempts += 1;
        state.lastError = formatSchemaIssues(validation.issues);
        if (state.attempts >= STRUCTURED_OUTPUT_RETRY_LIMIT) {
          state.capError = `agent({schema}): StructuredOutput retry cap (${STRUCTURED_OUTPUT_RETRY_LIMIT}) exceeded — `
            + `${state.attempts} failed calls with no valid output — last StructuredOutput error: ${state.lastError}`;
          throw new Error(state.capError);
        }
        throw new Error(`Output does not match required schema: ${state.lastError}`);
      }
      state.value = validation.value;
      return STRUCTURED_OUTPUT_SUCCESS;
    },
  };
}

type MailboxMessage = { text: string; origin: MessageOrigin; displayId?: string };
function witnessEvents(events: Session['events']): {bytes:number; sha256:string} {
  const hash = createHash('sha256');
  let bytes = 0;
  for (const event of events) {
    const line = JSON.stringify(event) + '\n';
    bytes += Buffer.byteLength(line);
    hash.update(line);
  }
  return {bytes,sha256:hash.digest('hex')};
}
type Child = {
  coldKeepalive?: ParkedWorkerDelivery['waitingFor'];
  parked?: boolean;
  stagedWake?: ReadyWorkerDelivery;
  continuingDeliveryId?: string;
  readyDelivery?: ReadyWorkerDelivery;
  nested?: AgentRegistry;
  forkedSkillName?: string;
  runId?: string;
  view: AgentDescriptor; config: SessionConfig; readonly resumeConfig: SessionConfig; tools: ToolDefinition[]; controller: AbortController;
  mailbox: MailboxMessage[]; mailboxBytes: number; accepted: number; session?: Session;
  transcript: AgentTranscriptRecord[]; inProgressToolUseIDs: Set<string>; viewLeases: Set<symbol>; activeInput?: string;
  agent?: Agent; hooks?: ReturnType<typeof createChildHookLifecycle>; hookHomes?: ReadonlyMap<string, HookCommandHome>;
  worker?: Promise<void>; journalEvents: number; journalBytes: number;
  environment?: ChildEnvironmentLease; environmentClosing?: Promise<void>; fork?: boolean;
  structured?: StructuredOutputState;
  liveOwner: LivePermissionOwner; adoptionOnly: boolean;
  prompt: string; startedAt: number; endedAt?: number; progress: AgentProgressTracker; streamedChars: number;
  backgrounded: boolean; history?: AgentHistoryHeader; coldJournal?: { bytes: number; sha256: string }; historyInvalid?: boolean; coldRootVerified?: boolean;
  skillContinuation?: { scope: SkillScope; path: string; hooks: string; update: (skill: SkillInfo) => void; first: boolean; approvalValid?: () => boolean };
  coldSkillScope?: SkillScope;
};

/** One instance belongs to one parent session; selectors never resolve outside it. */
export class AgentRegistry {
  readonly limits: AgentRegistryLimits;
  private children = new Map<string, Child>();
  private events: AgentNotification[] = [];
  private eventBytes = 0;
  private dropped = 0;
  private deliveredNestedDrops = 0;
  private sequence = 0;
  private revision = 0;
  private changes = new Set<() => void>();
  private subscriptions = new Map<string, { subscription: AgentIdleSubscription; child: Child; timer: ReturnType<typeof setTimeout> }>();
  private active = 0;
  private preparing = new Set<Promise<void>>();
  private preparations = new Set<AbortController>();
  private reservedNames = new Set<string>();
  private preparingSkills = new Map<AbortController, string>();
  private closed = false;
  private parentRegistry?: AgentRegistry;
  private closing?: Promise<void>;
  private history?: AgentHistoryStore;
  private historyParent?: string;
  private historySession?: Session;
  private recoveredSettlements: AgentDescriptor[] = [];
  private interruptedDescendants = new Map<string,{receiver:string;runId:string}>();
  private parkedOwners = new Set<string>();
  private approval?: { callback: SessionApproval; controller: AbortController; id: string };
  private readonly onAbort = () => { void this.close(); };

  constructor(private readonly options: AgentRegistryOptions) {
    const output = this.source().maxOutputBytes;
    this.limits = { ...DEFAULTS, maxOutputBytes: output, ...options.limits };
    for (const [key, value] of Object.entries(this.limits)) {
      if (!Number.isSafeInteger(value) || value < 1) throw new Error(`agent registry: ${key} must be a positive integer`);
    }
    options.signal?.addEventListener('abort', this.onAbort, { once: true });
    if (options.signal?.aborted) void this.close();
  }

  private source(): SessionConfig {
    return typeof this.options.source === 'function' ? this.options.source() : this.options.source;
  }

  // Host ownership adaptation for source iye, sfn1dbxq [3368429,3370821), UTF-16.
  childSkillTools(session: Session, parent: Session): ToolDefinition[] | undefined {
    return this.skillWorker(session, parent)?.tools;
  }

  private skillWorker(session: Session, parent: Session): Child | undefined {
    if (this.closed || !parent.isOpen || !session.isOpen || this.historySession !== parent ||
        this.options.sessionOwner?.() !== parent) return;
    const child = this.children.get(session.id);
    if (child?.session === session && !child.controller.signal.aborted) return child;
    for (const worker of this.children.values()) {
      if (!worker.session || worker.controller.signal.aborted) continue;
      const found = worker.nested?.skillWorker(session, worker.session);
      if (found) return found;
    }
  }

  // zyn [1892,4679), UTF-16: the invoking worker owns the task and its cancellation.
  nestedSkillRegistry(session: Session, parent: Session): AgentRegistry {
    const worker = this.skillWorker(session, parent);
    if (!worker) throw new Error('Child skill session owner released');
    if (worker.nested) return worker.nested;
    const nested = new AgentRegistry({ ...this.options, source: () => session.config,
      parentSessionId: session.id, sessionOwner: () => worker.session, requireSessionOwner: true,
      tools: worker.tools, signal: AbortSignal.any([worker.controller.signal, session.closeSignal]),
      onChange: () => this.changed(), onNotification: undefined });
    try {
      nested.parentRegistry = this;
      nested.bindHistory(session);
      worker.nested = nested;
      return nested;
    } catch (error) { void nested.close(); throw error; }
  }

  // zyn, 9dhv0d4w [1892,4679), UTF-16. Worktree preparation can yield before registration.
  hasLiveForkedSkill(name: string): boolean {
    return [...this.preparingSkills.values()].includes(name) || [...this.children.values()].some(child =>
      (child.forkedSkillName === name && (child.view.status === 'queued' || child.view.status === 'running')) ||
      child.nested?.hasLiveForkedSkill(name));
  }

  // zyn, 9dhv0d4w [1892,4679), UTF-16: the child receives its caller's live permission callback.
  bindApproval(callback: SessionApproval): () => void {
    this.assertOpen();
    this.approval?.controller.abort();
    const binding = { callback, controller: new AbortController(), id: randomUUID() };
    this.approval = binding;
    return () => { if (this.approval === binding) { this.approval = undefined; binding.controller.abort(); } };
  }

  captureApprovalGeneration(): () => boolean {
    const binding = this.approval;
    const parentLive = this.parentRegistry?.captureApprovalGeneration();
    return () => !this.closed && this.approval === binding && (parentLive?.() ?? true);
  }

  private requireApprovalGeneration(): () => boolean {
    if (!this.approval || this.closed) throw new Error('Session approval unavailable');
    return this.captureApprovalGeneration();
  }

  async requestApproval(tool: ToolDefinition, input: unknown, decision: PermissionDecision, signal: AbortSignal): Promise<PermissionDecision> {
    const binding = this.approval;
    if (this.closed || signal.aborted || !binding) return { decision: 'deny', reason: 'Session approval unavailable' };
    const result = await observeApprovalOperation(this.historySession, { kind: 'registry', bindingId: binding.id },
      async () => await binding.callback(tool, input, decision, AbortSignal.any([signal, binding.controller.signal])));
    return this.closed || signal.aborted || this.approval !== binding
      ? { decision: 'deny', reason: 'Session approval unavailable' } : result;
  }

  private livePermissionOwner(): LivePermissionOwner {
    const owner = () => permissionOwner(this.source().permissions);
    return {
      prepareAutoMode: () => owner()?.prepareAutoMode?.(),
      get adoptUpdates() { return owner()?.adoptUpdates; },
      state: () => {
        const source = this.source();
        const state = owner()?.state() ?? seedPermissionUpdates(source.permissions, source.workspace, source.configSources?.userDir);
        return { ...state, mode: state.mode ?? source.permissions?.mode };
      },
      workingDirectories: readOnly => owner()?.workingDirectories(readOnly) ?? [],
    };
  }

  // fQo/VOe/kn, sfn1dbxq [4234807,4235398), 24k7d6mw [339498,340137), qw2csqy5 [9345,31492), UTF-16.
  bindHistory(parent: Session): string[] {
    this.assertOpen();
    if (!parent.isOpen || (this.options.requireSessionOwner && this.options.parentSessionId !== parent.id))
      throw new Error('Child history requires its open owning session');
    if (this.historyParent !== undefined) {
      if (this.historyParent !== parent.id) throw new Error('Child history is already bound to another parent');
      if (this.historySession !== parent) throw new Error('Child history is already bound to another session instance');
      return [];
    }
    if (parent.config.workspace !== this.source().workspace) throw new Error('Child history parent workspace mismatch');
    const store = new AgentHistoryStore(parent, this.limits.maxJournalBytes, this.limits.maxHistory);
    this.history = store; this.historyParent = parent.id; this.historySession = parent;
    const warnings = this.importSettledHistory(parent,store);
    const requests = new Set<string>();
    for (const row of parent.events) {
      if (row.kind === 'subtree_stop_request' && row.parent === parent.id) requests.add(row.requestId);
      if (row.kind === 'subtree_stop_redirect' && row.parent === parent.id && requests.delete(row.requestId))
        this.queueRootNotices(parent,row.events);
    }
    return warnings;
  }

  private queueRootNotices(parent: Session, notices: ReadonlyArray<Pick<AgentNotification,'agent'|'runId'>>): void {
    const claimed = new Set<string>();
    for (const row of parent.events) if (row.kind === 'notification_intent_v2' && row.owner === parent.id &&
        row.batch.kind === 'agent_events' && !row.batch.receiverRunId)
      for (const event of row.batch.events) if (!event.subscription) claimed.add(event.agent.id+'/'+event.runId);
    for (const event of this.events) if (!event.subscription) claimed.add(event.agent.id+'/'+event.runId);
    for (const notice of notices) {
      const key = notice.agent.id+'/'+notice.runId;
      if (!notice.runId || claimed.has(key)) continue;
      claimed.add(key);
      this.enqueueNotification({kind:'agent',agent:notice.agent,runId:notice.runId,sequence:++this.sequence});
    }
  }

  private importSettledHistory(parent: Session, store: AgentHistoryStore, recoverCandidates?: ReadonlySet<string>): string[] {
    const { records, warnings, candidates } = store.read();
    this.interruptedDescendants.clear();
    this.parkedOwners.clear();
    for (const record of records) if (record.state.kind === 'active' &&
      (record.state.parkedDelivery || record.state.preparedDeliveryId || record.state.continuingDeliveryId)) {
      this.parkedOwners.add(record.id);
      for (const waiting of record.state.parkedDelivery?.waitingFor ?? [])
        this.interruptedDescendants.set(waiting.id,{receiver:record.id,runId:waiting.runId});
    }
    const existingNames = new Set([...this.children.values()].flatMap(child => child.view.name ? [child.view.name] : []));
    for (const record of records) {
      if (record.state.kind !== 'settled' || (recoverCandidates && !recoverCandidates.has(record.id)) ||
          this.children.has(record.id) || this.children.size >= this.limits.maxHistory) continue;
      try {
        const events = readSessionJournal(parent.config.workspace, record.id, {
          maxBytes: this.limits.maxJournalBytes, maxEvents: this.limits.maxJournalEvents,
        }, record.state.journal);
        const meta = events[0], state = record.state;
        let redirectedEvents = state.redirectedEvents;
        if (redirectedEvents || (state.status === 'cancelled' && state.notificationAgent && state.runId)) {
          const intent = parent.events.findLast(row => row.kind === 'agent_history_intent' && row.id === record.id);
          const stopped = intent?.kind === 'agent_history_intent' && intent.parent === parent.id && state.runId &&
            intent.cancelledRunId === state.runId && intent.newDigest === fingerprintOf(record) &&
            parent.events.some(row => row.kind === 'parked_agent_stop' && row.parent === parent.id &&
              row.id === record.id && row.activeDigest === intent.oldDigest);
          if (!stopped && redirectedEvents) throw new Error('Redirected notifications have no matching owner stop');
          if (stopped && state.runId && !redirectedEvents) {
            try { redirectedEvents = this.legacyStopNotices(store,record,events,state.runId,intent.oldDigest); }
            catch (error) { warnings.push(`${record.id}: ${error instanceof Error ? error.message : String(error)}`); }
          }
        }
        if (meta?.kind === 'metadata' && meta.config.parentPlanId !== record.parentPlanId) {
          throw new Error('Child history parent plan witness mismatch');
        }
        if (meta?.kind !== 'metadata' || meta.fingerprint !== record.fingerprint || meta.config.childMode === undefined
          || (meta.config.parentSessionId !== undefined && meta.config.parentSessionId !== parent.id)
          || (candidates.has(record.id) && meta.config.parentSessionId !== parent.id)
          || fingerprint({ ...state.config, skills: meta.config.skills, heldSkills: meta.config.heldSkills,
            dynamicSkillDirs: meta.config.dynamicSkillDirs, system: meta.config.system }) !== meta.fingerprint) {
          throw new Error('Child history configuration mismatch');
        }
        if (events.findLast(event => event.kind === 'turn_end' || event.kind === 'message' || event.kind === 'compact')?.kind !== 'turn_end') {
          throw new Error('Child journal has an unfinished turn');
        }
        const coldSkillScope = this.validateColdSkillScope(path.join(path.dirname(parent.file), `${record.id}.jsonl`), record.skillName);
        const messages = events.flatMap(event => event.kind === 'message' ? [event.message] : []);
        assertPaired(messages);
        const tools = this.restoredTools(meta.config);
        let continued = false;
        if (fs.existsSync(path.join(path.dirname(parent.file), `${record.id}.jsonl.lock`))) {
          const intent = parent.events.findLast(row => (row.kind === 'agent_history' || row.kind === 'agent_history_intent') && row.id === record.id);
          if (!candidates.has(record.id) || intent?.kind !== 'agent_history_intent' || !intent.continuationDeliveryId || !intent.shutdownLock)
            throw new Error('Child journal is active');
          if (!recoverCandidates?.has(record.id)) continue;
          continued = this.commitDescendantPublication(parent,store,record,events);
        } else if (candidates.has(record.id)) continued = store.commitCandidate(record);
        const controller = new AbortController();
        if (state.status !== 'completed') controller.abort();
        const progress = createAgentProgress();
        for (const event of events) if (event.kind === 'message' && event.response) observeAgentResponse(progress, event.response);
        const name = record.name !== null && !existingNames.has(record.name) ? record.name : null;
        if (name !== null) existingNames.add(name);
        const { state: _state, ...history } = record;
        const child: Child = {
          view: { id: record.id, session_id: record.id, name, status: state.status, mode: meta.config.childMode,
            model: meta.config.model, summary: state.summary, error: state.error, reason: state.reason,
            model_calls: state.modelCalls, queued_messages: 0,
            ...(this.options.enableAdvanced ? { workspace: meta.config.workspace,
              ...(record.subagentType ? { subagent_type: record.subagentType } : {}) } : {}) },
          config: structuredClone(state.config), resumeConfig: structuredClone(meta.config), tools, controller,
          mailbox: [], mailboxBytes: 0, accepted: events.filter(event => event.kind === 'message' && event.message.role === 'user' && !event.isMeta
            && (event.classifier?.origin.kind === 'human' || event.classifier?.origin.kind === 'peer')).length,
          transcript: events.filter(transcriptEvent), inProgressToolUseIDs: new Set(), viewLeases: new Set(),
          liveOwner: this.livePermissionOwner(), adoptionOnly: false,
          prompt: record.prompt, startedAt: record.startedAt, endedAt: state.endedAt, progress, streamedChars: 0,
          ...(state.runId ? { runId: state.runId } : {}),
          backgrounded: record.backgrounded, fork: record.fork, history, coldJournal: state.journal,
          ...(coldSkillScope ? { coldSkillScope, forkedSkillName: coldSkillScope.skillName } : {}),
          journalEvents: events.length, journalBytes: events.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event)) + 1, 0),
        };
        this.children.set(record.id,child);
        if (continued) this.recoveredSettlements.push(this.snapshot(child));
        if (redirectedEvents && state.notificationAgent && state.runId && state.status === 'cancelled') {
          // vEe, sfn1dbxq [4228134,4228512), UTF-16. The root owns the
          // stopped worker notice followed by its unconsumed descendant results.
          this.queueRootNotices(parent,[{agent:state.notificationAgent,runId:state.runId},...redirectedEvents]);
        } else if (continued) this.notify(child);
      } catch (error) { warnings.push(`${record.id}: ${error instanceof Error ? error.message : String(error)}`); }
    }
    return warnings;
  }

  // vEe, sfn1dbxq [4228134,4228512), UTF-16. Legacy stops retained the
  // original park digest and publication order but omitted the queued descriptors.
  private legacyStopNotices(store: AgentHistoryStore, record: AgentHistoryRecord, rows: Session['events'],
    runId: string, activeDigest: string): AgentNotification[] {
    let boundary = rows.length;
    while (boundary >= 2 && rows[boundary-1]?.kind === 'agent_history' && rows[boundary-2]?.kind === 'agent_history_intent') boundary -= 2;
    const count = (rows.length-boundary)/2;
    if (!count || count > Math.min(100,this.limits.maxEvents)) throw new Error('Legacy stop has no bounded publication suffix');
    const prefix = rows.slice(0,boundary);
    const receipt = prefix.findLast(row => row.kind === 'message' && row.notificationDelivery);
    if (receipt?.kind !== 'message' || receipt.notificationDelivery?.owner !== record.id)
      throw new Error('Legacy stop has no worker delivery receipt');
    const deliveryId = receipt.notificationDelivery.deliveryId;
    const intent = prefix.findLast(row => row.kind === 'notification_intent_v2' && row.deliveryId === deliveryId);
    if (intent?.kind !== 'notification_intent_v2' || intent.owner !== record.id || intent.batch.kind !== 'agent_events' ||
        intent.batch.receiverRunId !== runId) throw new Error('Legacy stop receipt does not match the receiving run');
    const waiting = [], notices: AgentNotification[] = [];
    for (let i = boundary; i < rows.length; i += 2) {
      const settlement = rows[i], witness = rows[i+1];
      if (settlement?.kind !== 'agent_history_intent' || settlement.parent !== record.id ||
          witness?.kind !== 'agent_history' || witness.id !== settlement.id || witness.digest !== settlement.newDigest)
        throw new Error('Legacy stop publication pair does not match');
      const position = prefix.findLastIndex(row => row.kind === 'agent_history' && row.id === witness.id);
      const prior = prefix[position];
      const item = store.readPublishedDescendant(record.id,witness.id,witness.digest), state = item.state;
      if (prior?.kind !== 'agent_history' || prior.digest !== settlement.oldDigest || !item.backgrounded ||
          state.kind !== 'settled' || !state.runId || state.journal.bytes !== settlement.journal.bytes ||
          state.journal.sha256 !== settlement.journal.sha256 || state.notificationAgent?.id !== item.id ||
          state.notificationAgent.session_id !== item.id || state.notificationAgent.status !== state.status)
        throw new Error('Legacy stop has no matching descendant result');
      waiting.push({id:item.id,runId:state.runId,startedAt:item.startedAt,position});
      notices.push({kind:'agent',sequence:notices.length+1,runId:state.runId,agent:state.notificationAgent});
    }
    // AgentHistoryStore.read sorts newest launches first, with reverse witness
    // order as its stable tie breaker. The original digest verifies the order.
    const waitingFor = waiting.sort((a,b)=>b.startedAt-a.startedAt || b.position-a.position).map(({id,runId})=>({id,runId}));
    const parkedDelivery = {deliveryId,journal:witnessEvents(prefix),waitingFor};
    if (fingerprintOf({...record,state:{kind:'active',runId,parkedDelivery}}) !== activeDigest)
      throw new Error('Legacy stop does not match the recorded park');
    return notices;
  }

  // SessionEnd raiser uvt, sfn1dbxq [2943750,2944030), UTF-16. Report only
  // the hook boundaries present after this delivery; execution can precede its result.
  private describeWorkerFinalization(parent: Session, worker: AgentHistoryHeader, deliveryId: string, runId: string): string {
    let observed = '';
    try {
      const journal = readSessionJournal(parent.config.workspace,worker.id,{
        maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents,
      });
      const meta = journal[0];
      const intent = journal.findIndex(row => row.kind === 'notification_intent_v2' &&
        row.owner === worker.id && row.deliveryId === deliveryId &&
        row.batch.kind === 'agent_events' && row.batch.receiverRunId === runId);
      const receipt = journal.findIndex(row => row.kind === 'message' &&
        row.notificationDelivery?.owner === worker.id && row.notificationDelivery.deliveryId === deliveryId);
      if (meta?.kind === 'metadata' && meta.config.parentSessionId === parent.id && meta.fingerprint === worker.fingerprint &&
          intent >= 0 && receipt > intent) {
        const after = journal.slice(receipt+1);
        const end = after.findLastIndex(row => row.kind === 'turn_end');
        if (end >= 0) {
          observed = ' The worker journal records turn_end.';
          const shutdown = after.slice(end+1);
          const hook = shutdown.findLast(row => row.kind === 'hook_start' && row.event === 'SessionEnd');
          if (hook?.kind === 'hook_start') {
            const paired = shutdown.slice(shutdown.indexOf(hook)+1).some(row => row.kind === 'hook_result' &&
              row.event === 'SessionEnd' && row.id === hook.id);
            observed += paired ? ' It also records the matching SessionEnd hook result.' : ' It also records SessionEnd hook start.';
          }
        }
      }
    } catch { /* The parent claim still identifies the unresolved delivery when its child journal is unreadable. */ }
    return observed;
  }

  // fQo, sfn1dbxq [4234807,4235398); kn, qw2csqy5 [22571,24971); wake router,
  // rx2nah4x [229020,229780), UTF-16. Host recovery retains the receiving invocation.
  async continueWorkerDeliveries(parent: Session, signal: AbortSignal, onUncertain: (message: string) => void): Promise<AgentDescriptor[]> {
    this.assertCaller(parent);
    if (!this.history || this.historySession !== parent || !parent.isOpen) throw new Error('Child recovery requires its owning session');
    const { records, candidates } = this.history.read();
    signal.throwIfAborted();
    if (candidates.size) for (const warning of this.importSettledHistory(parent,this.history,candidates)) onUncertain(warning);
    const recovered = this.recoveredSettlements.splice(0);
    for (const record of records) {
      signal.throwIfAborted();
      this.assertCaller(parent);
      const { state, ...history } = record;
      if (state.kind !== 'active' || !state.runId || !record.skillName ||
          !record.backgrounded || this.children.has(record.id)) continue;
      if (this.hasParkedStop(parent,record)) {
        await this.stopInterruptedTask(parent,record.id);
        const stopped = this.children.get(record.id);
        if (stopped) recovered.push(this.snapshot(stopped));
        continue;
      }
      if (state.parkedDelivery) {
        const digest = fingerprintOf(record);
        const completed = new Set(parent.events.flatMap(row => row.kind === 'subtree_stop_redirect' && row.parent === parent.id ? [row.requestId] : []));
        for (const row of parent.events.slice()) if (row.kind === 'subtree_stop_request' && row.parent === parent.id &&
            row.receiver === record.id && row.activeDigest === digest && !completed.has(row.requestId) &&
            state.parkedDelivery.waitingFor.some(item=>item.id === row.id && item.runId === row.runId))
          await this.stopInterruptedTask(parent,row.id);
      }
      if (state.continuingDeliveryId) {
        const observed = this.describeWorkerFinalization(parent,history,state.continuingDeliveryId,state.runId);
        onUncertain(`Worker ${record.id} has an unresolved continuation for delivery ${state.continuingDeliveryId} (run ${state.runId}).${observed}`);
        continue;
      }
      const events = readSessionJournal(parent.config.workspace, record.id,
        {maxBytes:this.limits.maxJournalBytes, maxEvents:this.limits.maxJournalEvents});
      const meta = events[0], tail = events.at(-1);
      if (meta?.kind !== 'metadata' || meta.config.parentSessionId !== parent.id || !meta.config.childMode ||
          meta.fingerprint !== record.fingerprint || meta.config.parentPlanId !== record.parentPlanId) continue;
      const journal = witnessEvents(events);
      if (state.parkedDelivery && journal.bytes <= state.parkedDelivery.journal.bytes) {
        const parked = state.parkedDelivery;
        if (journal.bytes !== parked.journal.bytes || journal.sha256 !== parked.journal.sha256 ||
            fs.statSync(path.join(path.dirname(parent.file),record.id+'.jsonl')).size !== parked.journal.bytes)
          onUncertain(`Worker ${record.id} journal changed after parking for delivery ${parked.deliveryId}.`);
        else onUncertain(`Worker ${record.id} processed delivery ${parked.deliveryId} and is waiting for ${parked.waitingFor.map(item => item.id+' (run '+item.runId+')').join(', ')}.`);
        continue;
      }
      let ready = state.readyDelivery?.journal.bytes === journal.bytes && state.readyDelivery.journal.sha256 === journal.sha256
        ? state.readyDelivery : undefined;
      if (ready && (ready.batch.receiverRunId !== state.runId || ready.batch.dropped || !ready.batch.events.length ||
          ready.batch.events.some(event => !event.runId || event.subscription))) continue;
      if (!ready && !state.parkedDelivery && !(tail?.kind === 'message' && tail.notificationDelivery?.owner === record.id)) {
        if (state.readyDelivery) onUncertain(`Worker ${record.id} journal does not match selected delivery ${state.readyDelivery.deliveryId}.`);
        else if (tail?.kind === 'notification_intent_v2' && tail.batch.kind === 'agent_events' && tail.batch.receiverRunId === state.runId)
          onUncertain(`Worker ${record.id} has no committed message for delivery ${tail.deliveryId}.`);
        continue;
      }
      const session = Session.open(parent.config.workspace, {id:record.id, config:meta.config, recoverLock:true,
        expectedJournal:journal,childJournalLimits:this.limits});
      try {
        const store = new AgentHistoryStore(session,this.limits.maxJournalBytes,this.limits.maxHistory);
        if (state.parkedDelivery) ready = this.parkedWake(session,state.runId,state.parkedDelivery,store);
        const descendants = store.read();
        const receipt = session.pendingWorkerReceipt;
        if (!ready && (receipt?.runId !== state.runId || receipt.parent !== parent.id)) continue;
        const deliveryId = ready?.deliveryId ?? receipt?.deliveryId;
        if (!deliveryId || (state.preparedDeliveryId && state.preparedDeliveryId !== deliveryId) ||
            (state.readyDelivery && state.readyDelivery.deliveryId !== deliveryId)) continue;
        if (ready && (session.notificationCoordination.length || session.awaitingResponse)) continue;
        // IX, 40cepjpq [110300,111850), UTF-16: the receiver stays alive for its
        // other descendants. Their result queues must also have survived the crash.
        const waitingFor = descendants.records.flatMap(item => item.backgrounded && item.state.kind === 'active' && item.state.runId
          ? [{id:item.id,runId:item.state.runId}] : []);
        const received = new Map<string,string>();
        for (const row of session.events) {
          if (row.kind !== 'message' || !row.notificationDelivery) continue;
          const batch = session.branchMessage(row)?.inheritedNotification?.batch;
          if (batch?.kind !== 'agent_events' || batch.receiverRunId !== state.runId) continue;
          for (const event of batch.events) if (event.runId) received.set(event.agent.id,event.runId);
        }
        if (ready) {
          if (ready.batch.events.some(event => received.get(event.agent.id) === event.runId)) continue;
          for (const event of ready.batch.events) received.set(event.agent.id,event.runId!);
        }
        if (descendants.warnings.length || descendants.candidates.size || !received.size ||
            descendants.records.some(item => item.backgrounded && (!item.state.runId ||
              (item.state.kind === 'settled' && received.get(item.id) !== item.state.runId)))) continue;
        if ([...received].some(([id,runId]) => !descendants.records.some(item => item.id === id &&
            item.state.kind === 'settled' && item.state.runId === runId))) continue;
        if (ready) for (const event of ready.batch.events) {
          const item = descendants.records.find(candidate => candidate.id === event.agent.id);
          if (!item || !item.backgrounded || item.state.kind !== 'settled' || item.state.runId !== event.runId || item.state.status !== event.agent.status ||
              fs.existsSync(path.join(path.dirname(session.file),item.id+'.jsonl.lock')))
            throw new Error('Selected notification requires a settled descendant');
          const rows = readSessionJournal(parent.config.workspace,item.id,
            {maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents},item.state.journal);
          if (rows[0]?.kind !== 'metadata' || rows[0].config.parentSessionId !== session.id || rows[0].fingerprint !== item.fingerprint)
            throw new Error('Selected notification descendant identity mismatch');
        }
        const scope = this.validateColdSkillScope(session.file,record.skillName);
        if (!scope) throw new Error('Child skill scope is missing');
        const tools = this.restoredTools(meta.config);
        this.capacity();
        const progress = createAgentProgress();
        let modelCalls = 0;
        for (const row of events) if (row.kind === 'message' && row.response) { observeAgentResponse(progress,row.response); modelCalls++; }
        const child: Child = {view:{id:record.id,session_id:record.id,name:record.name,status:'queued',mode:meta.config.childMode,
          model:meta.config.model,summary:'',error:null,reason:null,model_calls:modelCalls,queued_messages:0},
          session, config:structuredClone(session.config), resumeConfig:structuredClone(meta.config), tools,
          controller:new AbortController(), mailbox:[], mailboxBytes:0,
          accepted:events.filter(row => row.kind === 'message' && row.message.role === 'user' && !row.isMeta &&
            (row.classifier?.origin.kind === 'human' || row.classifier?.origin.kind === 'peer')).length,
          transcript:events.filter(transcriptEvent),inProgressToolUseIDs:new Set(),viewLeases:new Set(),
          liveOwner:this.livePermissionOwner(),adoptionOnly:true,prompt:record.prompt,startedAt:record.startedAt,
          progress,streamedChars:0,backgrounded:true,history,fork:record.fork,coldSkillScope:scope,
          forkedSkillName:record.skillName,runId:state.runId,continuingDeliveryId:deliveryId,readyDelivery:ready,
          ...(waitingFor.length ? {coldKeepalive:waitingFor} : {}),
          journalEvents:events.length,journalBytes:fs.statSync(session.file).size};
        // OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16. A prepared record has
        // not entered hooks or the model. Reopening it requires all receipt checks again.
        if (!state.preparedDeliveryId) this.history.write({...history,state:{kind:'active',runId:state.runId,preparedDeliveryId:deliveryId,
          ...(ready ? {readyDelivery:ready} : {})}});
        this.children.set(record.id,child);
        const abort = () => child.controller.abort(signal.reason);
        signal.addEventListener('abort', abort, {once:true});
        try {
          if (signal.aborted) abort();
          this.start(child);
          await child.worker;
        } finally { signal.removeEventListener('abort',abort); }
        this.parkedOwners.delete(record.id);
        for (const [id,target] of this.interruptedDescendants) if (target.receiver === record.id) this.interruptedDescendants.delete(id);
        if (child.coldKeepalive && child.view.status === 'running') {
          this.parkedOwners.add(record.id);
          for (const waiting of waitingFor) this.interruptedDescendants.set(waiting.id,{receiver:record.id,runId:waiting.runId});
          onUncertain(`Worker ${record.id} processed delivery ${deliveryId} and is waiting for ${waitingFor.map(item => item.id+' (run '+item.runId+')').join(', ')}.`);
        } else recovered.push(this.snapshot(child));
      } finally { if (session.isOpen) await session.close(); }
    }
    return recovered;
  }

  // IX, 40cepjpq [110300,111850); wake router, rx2nah4x [229020,229780), UTF-16.
  // Recover the publication order only from settlement pairs appended after the parked turn.
  private parkedWake(session: Session, receiverRunId: string, parked: ParkedWorkerDelivery, store: AgentHistoryStore): ReadyWorkerDelivery {
    const descendants = store.read();
    let count = 0, bytes = 0;
    while (count < session.events.length && bytes < parked.journal.bytes)
      bytes += Buffer.byteLength(JSON.stringify(session.events[count++])) + 1;
    const prefix = session.events.slice(0,count), suffix = session.events.slice(count);
    const previous = prefix.findLast(row => row.kind === 'message' && row.notificationDelivery?.deliveryId === parked.deliveryId);
    const prior = previous?.kind === 'message' ? session.branchMessage(previous)?.inheritedNotification?.batch : undefined;
    const last = suffix.at(-1);
    const candidate = last?.kind === 'agent_history_intent' && descendants.candidates.size === 1 && descendants.candidates.has(last.id)
      ? descendants.records.find(item => item.id === last.id) : undefined;
    if (candidate) suffix.push({kind:'agent_history',id:candidate.id,digest:fingerprintOf(candidate)});
    if (bytes !== parked.journal.bytes || witnessEvents(prefix).sha256 !== parked.journal.sha256 ||
        prior?.kind !== 'agent_events' || prior.receiverRunId !== receiverRunId || !prior.events.length ||
        descendants.warnings.length || (descendants.candidates.size && !candidate) || !suffix.length || suffix.length % 2)
      throw new Error('Parked worker has no verified settlement after its recorded turn');
    const waiting = new Map(parked.waitingFor.map(item => [item.id,item.runId]));
    const events: AgentNotification[] = [];
    let sequence = prior.events.at(-1)!.sequence;
    for (let i = 0; i < suffix.length; i += 2) {
      const intent = suffix[i], published = suffix[i+1];
      if (intent?.kind !== 'agent_history_intent' || intent.parent !== session.id ||
          published?.kind !== 'agent_history' || published.id !== intent.id || published.digest !== intent.newDigest)
        throw new Error('Parked worker settlement pair is incomplete or unrelated');
      const old = prefix.findLast(row => row.kind === 'agent_history' && row.id === intent.id);
      const item = descendants.records.find(record => record.id === intent.id);
      const state = item?.state, runId = waiting.get(intent.id);
      if (!item?.backgrounded || !runId || state?.kind !== 'settled' || state.runId !== runId ||
          old?.kind !== 'agent_history' || old.digest !== intent.oldDigest || fingerprintOf(item) !== published.digest ||
          state.journal.bytes !== intent.journal.bytes || state.journal.sha256 !== intent.journal.sha256 ||
          !state.notificationAgent || state.notificationAgent.id !== item.id || state.notificationAgent.session_id !== item.id ||
          state.notificationAgent.status !== state.status)
        throw new Error('Parked worker settlement does not match its waiting run');
      waiting.delete(item.id);
      events.push({kind:'agent', sequence:++sequence, runId, agent:state.notificationAgent});
    }
    if ([...waiting].some(([id,runId]) => !descendants.records.some(item => item.id === id && item.state.kind === 'active' && item.state.runId === runId)) ||
        events.length > Math.min(100,this.limits.maxEvents) || events.reduce((sum,event) => sum+Buffer.byteLength(JSON.stringify(event)),0) > this.limits.maxEventBytes)
      throw new Error('Parked worker result queue cannot be reconstructed');
    if (candidate) this.commitDescendantPublication(session,store,candidate);
    return {deliveryId:randomUUID(), journal:witnessEvents(session.events), batch:{kind:'agent_events',receiverRunId,events,dropped:0,maxOutputBytes:session.config.maxOutputBytes}};
  }

  // OMe/Tle, sfn1dbxq [4543991,4544354), UTF-16. Finish the original
  // terminal publication under its owner before cancelling any enclosing run.
  private commitDescendantPublication(owner: Session, store: AgentHistoryStore, record: AgentHistoryRecord,
    verifiedRows?: Session['events']): boolean {
    const intent = owner.events.findLast(row=>(row.kind === 'agent_history' || row.kind === 'agent_history_intent') && row.id === record.id);
    const {state,...header} = record;
    if (intent?.kind !== 'agent_history_intent' || intent.parent !== owner.id || state.kind !== 'settled' ||
        !state.runId || intent.newDigest !== fingerprintOf(record) ||
        (intent.cancelledRunId && (intent.cancelledRunId !== state.runId || state.status !== 'cancelled')))
      throw new Error('Descendant terminal publication changed');
    const rows = verifiedRows ?? readSessionJournal(owner.config.workspace,record.id,
      {maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents},state.journal);
    const meta = rows[0], terminal = rows.findLast(row=>row.kind === 'turn_end' || row.kind === 'message' || row.kind === 'compact');
    if (meta?.kind !== 'metadata' || meta.config.parentSessionId !== owner.id || meta.fingerprint !== record.fingerprint ||
        terminal?.kind !== 'turn_end') throw new Error('Descendant terminal journal mismatch');
    if (!intent.cancelledRunId && !intent.continuationDeliveryId &&
        fingerprintOf({...header,state:{kind:'active',runId:state.runId}}) !== intent.oldDigest)
      throw new Error('Descendant terminal publication has no matching active run');
    if (intent.continuationDeliveryId && !intent.cancelledRunId &&
        !rows.some(row=>row.kind === 'notification_intent_v2' && row.owner === record.id &&
          row.deliveryId === intent.continuationDeliveryId && row.batch.kind === 'agent_events' && row.batch.receiverRunId === state.runId))
      throw new Error('Descendant terminal publication has no matching delivery');
    if (fs.existsSync(path.join(path.dirname(owner.file),record.id+'.jsonl.lock'))) {
      if (!intent.shutdownLock || !intent.continuationDeliveryId) throw new Error('Late descendant journal is active');
      let continued = false;
      owner.reclaimWorkerShutdown(intent,()=>{ continued = store.commitCandidate(record); });
      return continued;
    }
    return store.commitCandidate(record);
  }

  // kn, qw2csqy5 [11500,19000), UTF-16: retain scoped history before binding its live owner.
  private validateColdSkillScope(journal: string, skillName?: string): SkillScope | undefined {
    const result = readSkillScope(journal);
    if (result.status === 'absent' && skillName === undefined) return;
    if (result.status !== 'valid') throw new Error('Child skill scope is missing or malformed');
    if (skillName !== result.scope.skillName) throw new Error('Child skill history identity mismatch');
    if (readSkillScopeWitness(journal) !== result.scope.skillName) throw new Error('Child skill scope witness mismatch');
    const skill = this.currentSkill(result.scope.skillName);
    if (result.scope.skillPath !== skill.path || result.scope.hookIdentity !== JSON.stringify(skill.hooks ?? null)) {
      throw new Error('Child skill identity or hook approvals changed');
    }
    return result.scope;
  }

  // kn, qw2csqy5 [11500,19000), UTF-16: resolve the current skill at continuation.
  private currentSkill(name: string): SkillInfo {
    const current = this.source();
    const loaded = loadProjectConfig(current.workspace, { ...current.configSources, paths: [], pluginHooks: 'preview' });
    const skills = [...loaded.skills];
    skills.push(...loadSkillsFromDirectories(current.dynamicSkillDirs ?? [], new Set(skills.map(skill => skill.name)), current.workspace));
    const skill = skills.find(candidate => candidate.name === name);
    if (!skill || skill.context !== 'fork' || skill.mode === 'off') throw new Error('Child skill no longer resolves to an enabled fork skill');
    return skill;
  }

  private restoredTools(config: SessionConfig): ToolDefinition[] {
    const permitted = selectChildTools(this.options.tools, config.childMode ?? 'explore');
    return config.tools.map(schema => {
      const matches = permitted.filter(tool => JSON.stringify({ ...tool.schema, eager_input_streaming: true }) === JSON.stringify(schema));
      if (matches.length !== 1) throw new Error(`Child tool has no unique trusted factory match: ${schema.name}`);
      return matches[0]!;
    });
  }

  // ad/Tle/kn, 40cepjpq [120014,120794), sfn1dbxq [4544058,4544310), qw2csqy5 [9345,31492), UTF-16.
  private saveHistory(child: Child, active = false, activeRunId?: string): void {
    if (!this.history || !child.history || child.historyInvalid) return;
    if (active) {
      this.history.write({ ...child.history, state: { kind: 'active', ...(activeRunId ? { runId: activeRunId } : {}),
        ...(child.continuingDeliveryId ? { continuingDeliveryId:child.continuingDeliveryId,
          ...(child.session ? {claimedJournal:witnessEvents(child.session.events)} : {}) } : {}) } });
      return;
    }
    const record = this.settledHistory(child, child.history);
    const parent = this.parentRegistry, receiver = parent?.children.get(record.parent);
    if (parent?.history && receiver?.parked && receiver.history && receiver.runId && receiver.session === this.historySession &&
        !this.preparing.size && !this.dropped && !this.subscriptions.size && child.runId &&
        !receiver.controller.signal.aborted && !receiver.mailbox.length && child.backgrounded) {
      // IX [110300,111850), 40cepjpq; wake router [229020,229780), rx2nah4x (UTF-16).
      // The descendant's final history witness is the last row needed to wake its parked receiver.
      const publish = this.history.prepareWrite(record);
      const event: AgentNotification = { kind:'agent',sequence:this.sequence+1,agent:this.snapshot(child),runId:child.runId };
      // Match notify's FIFO append only while the entire projected batch fits one delivery.
      if (this.events.length < Math.min(100,this.limits.maxEvents) &&
          this.eventBytes + Buffer.byteLength(JSON.stringify(event)) <= this.limits.maxEventBytes &&
          this.events.every(queued => queued.runId && !queued.subscription)) {
        const journal = witnessEvents([...this.historySession!.events,{kind:'agent_history',id:record.id,digest:fingerprintOf(record)}]);
        const ready: ReadyWorkerDelivery = {deliveryId:randomUUID(),journal,batch:{kind:'agent_events',receiverRunId:receiver.runId,
          events:[...this.events,event],dropped:0,maxOutputBytes:receiver.config.maxOutputBytes}};
        parent.history.write({...receiver.history,state:{kind:'active',runId:receiver.runId,readyDelivery:ready}});
        receiver.stagedWake = ready;
      }
      publish();
    } else this.history.write(record);
    child.coldJournal = record.state.journal;
  }

  private settledHistory(child: Child, header: AgentHistoryHeader): AgentHistoryHeader & {state: Extract<AgentHistoryRecord['state'], {kind:'settled'}>} {
    const status = child.view.status;
    if (status === 'queued' || status === 'running') throw new Error('Child history requires a terminal state');
    const journalFile = path.join(this.source().workspace, '.agent', `${child.view.id}.jsonl`);
    const fd = fs.openSync(journalFile, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let journal: Buffer;
    try {
      if (fs.fstatSync(fd).size > this.limits.maxJournalBytes) throw new Error('Child journal limit reached');
      journal = fs.readFileSync(fd);
    } finally { fs.closeSync(fd); }
    const boundary = journal.lastIndexOf(10) + 1;
    const witness = { bytes: boundary, sha256: createHash('sha256').update(journal.subarray(0, boundary)).digest('hex') };
    return { ...header, state: { kind: 'settled', status, summary: child.view.summary,
      error: child.view.error, reason: child.view.reason, modelCalls: child.view.model_calls,
      endedAt: child.endedAt ?? Date.now(), config: child.config,
      // aB/LP, bk5ct2gw [267620,268165), UTF-16: retain the last known run for the next admission.
      ...(child.runId ? { runId: child.runId } : {}),
      ...(this.parentRegistry && child.backgrounded ? {notificationAgent:this.snapshot(child)} : {}),
      journal: witness } };
  }

  private assertOpen(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.closed || this.options.signal?.aborted) throw new Error('Agent registry is closed');
  }

  // dne, sfn1dbxq [4233793,4234807), UTF-16: adapt source owner identity to the host's Session instance.
  assertCaller(session?: Session): void {
    if (this.options.requireSessionOwner && session !== undefined &&
        (session !== this.historySession || !session.isOpen || this.options.sessionOwner?.() !== session)) {
      throw new Error('Agent execution session does not match the tool owner');
    }
  }

  private resolve(selector: string): Child {
    selector = selectorSchema.parse(selector);
    const byId = this.children.get(selector);
    if (byId) return byId;
    const matches = [...this.children.values()].filter(child => child.view.name === selector);
    if (matches.length === 1) return matches[0]!;
    throw new Error(`Unknown child agent: ${selector}`);
  }

  private snapshot(child: Child): AgentDescriptor {
    return { ...child.view, queued_messages: child.mailbox.length };
  }

  list(): AgentDescriptor[] { return [...this.children.values()].map(child => this.snapshot(child)); }

  // CE/IC/dne, 24k7d6mw [674264,674472), sfn1dbxq [4222190,4222263)/[4233793,4234807), UTF-16.
  backgroundTasks(): import('./tasks-panel.js').BackgroundTaskSnapshot['agents'] {
    if (this.closed || this.options.signal?.aborted) return [];
    const live = [...this.children.values()]
      .filter(child => child.view.status === 'running' || child.backgrounded && child.view.status === 'completed')
      .map(child => ({ id: child.view.id, name: child.view.name, status: child.view.status, startedAt: child.startedAt }));
    return [...live,...Array.from(this.parkedOwners,id => ({id,status:'interrupted'})),
      ...Array.from(this.interruptedDescendants.keys(),id => ({id,status:'interrupted'}))];
  }

  // _k/Cfr, sfn1dbxq [4228512,4230112), dxp0113e [2037,2191), UTF-16.
  // _k/Cfr, sfn1dbxq [4228512,4230112), dxp0113e [2037,2191), UTF-16.
  private hasParkedStop(parent: Session, record: AgentHistoryRecord): boolean {
    const digest = fingerprintOf(record);
    return parent.events.some(row => row.kind === 'parked_agent_stop' && row.parent === parent.id &&
      row.id === record.id && row.activeDigest === digest);
  }

  async stopInterruptedTask(parent: Session, id: string): Promise<boolean> {
    const target = this.interruptedDescendants.get(id);
    const receiverId = target?.receiver ?? id;
    const history = this.history;
    if (!history || (!target && !this.parkedOwners.has(id))) return false;
    this.assertOpen();
    this.assertCaller(parent);
    const receiverRecord = history.read().records.find(item => item.id === receiverId);
    const state = receiverRecord?.state;
    if (this.historySession !== parent || !parent.isOpen || !receiverRecord || state?.kind !== 'active' ||
        !state.runId) throw new Error('Interrupted task no longer belongs to this parked run');
    if (!target && (state.preparedDeliveryId || state.continuingDeliveryId)) {
      await this.cancelOwnedTree(parent,history,receiverRecord,state.runId,true);
      this.importSettledHistory(parent,history);
      this.changed();
      return true;
    }
    if (!state.parkedDelivery) throw new Error('Interrupted task has no parked delivery');
    const parked = state.parkedDelivery;
    const limits = {maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents};
    const journal = witnessEvents(readSessionJournal(parent.config.workspace,receiverId,limits));
    const receiver = Session.open(parent.config.workspace,{id:receiverId,recoverLock:true,expectedJournal:journal,childJournalLimits:this.limits});
    try {
      if (receiver.config.parentSessionId !== parent.id || fingerprint(receiver.config) !== receiverRecord.fingerprint)
        throw new Error('Parked receiver identity changed');
      const store = new AgentHistoryStore(receiver,this.limits.maxJournalBytes,this.limits.maxHistory);
      // A stop may be retried after a prior descendant's durable publication.
      // Only the original park or its verified settlement suffix can authorize it.
      const published = new Set<string>();
      if (journal.bytes !== parked.journal.bytes || journal.sha256 !== parked.journal.sha256) {
        const batch = this.parkedWake(receiver,state.runId,parked,store).batch;
        const previous = target && batch.events.find(event => event.agent.id === id);
        if (previous && previous.agent.status !== 'cancelled') {
          this.interruptedDescendants.delete(id);
          this.changed();
          return false;
        }
        for (const event of batch.events) published.add(event.agent.id);
      }
      const selected = target ? parked.waitingFor.filter(item => item.id === id && item.runId === target.runId) : parked.waitingFor;
      if (!selected.length) throw new Error('Interrupted descendant run changed');
      if (!target) {
        const owned = store.read();
        if (owned.warnings.length || owned.candidates.size || owned.records.some(record => record.state.kind === 'active' &&
            !parked.waitingFor.some(waiting => waiting.id === record.id && waiting.runId === record.state.runId)))
          throw new Error('Parked receiver owns an unverified descendant');
      }
      if (!target && !this.hasParkedStop(parent,receiverRecord))
        parent.append({kind:'parked_agent_stop',parent:parent.id,id,activeDigest:fingerprintOf(receiverRecord)});
      let requestId: string | undefined;
      if (target) {
        const activeDigest = fingerprintOf(receiverRecord);
        const prior = parent.events.findLast(row=>row.kind === 'subtree_stop_request' && row.parent === parent.id &&
          row.receiver === receiver.id && row.activeDigest === activeDigest && row.id === id && row.runId === target.runId);
        if (prior?.kind === 'subtree_stop_request') requestId = prior.requestId;
        else {
          requestId = randomUUID();
          parent.append({kind:'subtree_stop_request',requestId,parent:parent.id,receiver:receiver.id,activeDigest,id,runId:target.runId});
        }
      }
      for (const waiting of selected) {
        if (published.has(waiting.id)) continue;
        const {records,warnings,candidates} = store.read();
        const child = records.find(item => item.id === waiting.id);
        if (warnings.length || candidates.size || !child?.backgrounded || child.state.kind !== 'active' || child.state.runId !== waiting.runId)
          throw new Error('Interrupted descendant run changed');
        await this.cancelOwnedTree(receiver,store,child,waiting.runId);
      }
      if (requestId) {
        const witness = receiver.events.findLast(row=>row.kind === 'agent_history' && row.id === id);
        if (witness?.kind !== 'agent_history') throw new Error('Missing stopped subtree publication');
        const child = store.readPublishedDescendant(receiver.id,id,witness.digest);
        if (child.state.kind !== 'settled' || child.state.status !== 'cancelled' || child.state.runId !== target?.runId)
          throw new Error('Stopped subtree run changed');
        const events = child.state.subtreeEvents ?? [];
        if (!parent.events.some(row=>row.kind === 'subtree_stop_redirect' && row.parent === parent.id && row.requestId === requestId))
          parent.append({kind:'subtree_stop_redirect',requestId,parent:parent.id,events});
        this.queueRootNotices(parent,events);
      } else {
        const ready = this.parkedWake(receiver,state.runId,parked,store);
        if (ready.batch.events.length !== parked.waitingFor.length || receiver.awaitingResponse)
          throw new Error('Parked receiver still owns unfinished tasks');
        assertPaired(receiver.messages);
        const notices = ready.batch.events.flatMap(event => {
          const witness = receiver.events.findLast(row=>row.kind === 'agent_history' && row.id === event.agent.id);
          if (witness?.kind !== 'agent_history') throw new Error('Missing descendant publication');
          const settled = store.readPublishedDescendant(receiver.id,event.agent.id,witness.digest);
          return [event,...(settled.state.kind === 'settled' ? settled.state.subtreeEvents ?? [] : [])];
        });
        await this.publishInterruptedStop(receiver,history,receiverRecord,state.runId,{redirectedEvents:notices});
        this.importSettledHistory(parent,history);
      }
      for (const waiting of selected) this.interruptedDescendants.delete(waiting.id);
      this.changed();
      return true;
    } finally { if (receiver.isOpen) await receiver.close(); }
  }

  // _k/vEe, sfn1dbxq [4228134,4230112), UTF-16. Hold each immediate
  // owner's journal lock while settling the runs recorded in its registry.
  private async cancelOwnedTree(owner: Session, store: AgentHistoryStore, child: AgentHistoryRecord, runId: string,
    rootStop = false): Promise<void> {
    const limits = {maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents};
    const latest = owner.events.findLast(row=>(row.kind === 'agent_history' || row.kind === 'agent_history_intent') && row.id === child.id);
    if (latest?.kind !== 'agent_history' || latest.digest !== fingerprintOf(child))
      throw new Error('Interrupted worker has an unresolved history publication');
    const rows = readSessionJournal(owner.config.workspace,child.id,limits);
    const meta = rows[0];
    if (meta?.kind !== 'metadata' || meta.config.parentSessionId !== owner.id || meta.fingerprint !== child.fingerprint)
      throw new Error('Interrupted descendant identity changed');
    if (child.state.kind !== 'active' || child.state.runId !== runId) throw new Error('Interrupted worker run changed');
    const deliveryId = child.state.preparedDeliveryId ?? child.state.continuingDeliveryId;
    if (deliveryId) {
      const receipt = rows.find(row=>row.kind === 'message' && row.notificationDelivery?.owner === child.id &&
        row.notificationDelivery.deliveryId === deliveryId);
      const intent = rows.find(row=>row.kind === 'notification_intent_v2' && row.owner === child.id && row.deliveryId === deliveryId);
      const snapshot = child.state.readyDelivery?.journal ?? child.state.claimedJournal;
      let exact = false;
      if (snapshot) {
        let count = 0, bytes = 0;
        while (count < rows.length && bytes < snapshot.bytes) bytes += Buffer.byteLength(JSON.stringify(rows[count++]))+1;
        if (bytes !== snapshot.bytes || witnessEvents(rows.slice(0,count)).sha256 !== snapshot.sha256)
          throw new Error('Interrupted delivery journal prefix changed');
        exact = count === rows.length;
        if (!exact && !intent && this.hasParkedStop(owner,child)) {
          // After an authorized stop, child settlements may extend this prefix
          // before a crash. Each publication still needs its own run witness.
          exact = rows.slice(count).every(row=>
            (row.kind === 'parked_agent_stop' && row.parent === child.id) ||
            (row.kind === 'agent_history_intent' && row.parent === child.id && !!row.cancelledRunId) ||
            row.kind === 'agent_history');
        }
      }
      if (intent?.kind === 'notification_intent_v2') {
        if (intent.batch.kind !== 'agent_events' || intent.batch.receiverRunId !== runId)
          throw new Error('Interrupted notification has no matching receiving run');
        if (receipt && rows.slice(rows.indexOf(receipt)+1).some(row=>
            row.kind === 'turn_end' && row.reason !== 'aborted' || row.kind === 'hook_start' && row.event === 'SessionEnd'))
          throw new Error('Interrupted delivery already entered finalization');
      } else if (!exact) throw new Error('Interrupted delivery has no verified dispatch boundary');
    }
    const worker = Session.open(owner.config.workspace,{id:child.id,recoverLock:true,expectedJournal:witnessEvents(rows),childJournalLimits:this.limits});
    try {
      if (deliveryId) {
        const receipt = worker.events.find(row=>row.kind === 'message' && row.notificationDelivery?.deliveryId === deliveryId);
        if (receipt?.kind === 'message' && !worker.branchMessage(receipt)) throw new Error('Interrupted notification receipt is isolated');
      }
      if (rootStop && !this.hasParkedStop(owner,child))
        owner.append({kind:'parked_agent_stop',parent:owner.id,id:child.id,activeDigest:fingerprintOf(child)});
      const nested = new AgentHistoryStore(worker,this.limits.maxJournalBytes,this.limits.maxHistory);
      const history = nested.read();
      if (history.warnings.length || new Set(worker.events.flatMap(row=>row.kind === 'agent_history' ? [row.id] : [])).size !== history.records.length)
        throw new Error('Interrupted descendant history is incomplete');
      for (const item of history.records) {
        if (item.state.kind === 'active') {
          if (!item.backgrounded || !item.state.runId)
            throw new Error('Interrupted descendant still owns unresolved tasks');
          if (!this.hasParkedStop(worker,item))
            worker.append({kind:'parked_agent_stop',parent:worker.id,id:item.id,activeDigest:fingerprintOf(item)});
          await this.cancelOwnedTree(worker,nested,item,item.state.runId);
        }
        if (history.candidates.has(item.id)) this.commitDescendantPublication(worker,nested,item);
      }
      // vEe moves pending results in queue order. An existing delivery intent
      // already claimed that invocation, even if its receipt was interrupted.
      const publications = new Map<string,string>(), claimed = new Set<string>();
      for (const row of worker.events) {
        if (row.kind === 'agent_history') {
          publications.delete(row.id);
          publications.set(row.id,row.digest);
        }
        if (row.kind === 'notification_intent_v2' && row.owner === worker.id && row.batch.kind === 'agent_events')
          for (const event of row.batch.events) if (!event.subscription && event.runId) claimed.add(event.agent.id+'/'+event.runId);
      }
      const notices: AgentNotification[] = [];
      for (const [id,digest] of publications) {
        const record = nested.readPublishedDescendant(worker.id,id,digest), settled = record.state;
        if (!record.backgrounded || settled.kind !== 'settled' || !settled.runId || claimed.has(id+'/'+settled.runId)) continue;
        const agent = settled.notificationAgent;
        if (!agent || agent.id !== id || agent.session_id !== id || agent.status !== settled.status)
          throw new Error('Missing witnessed descendant notification');
        if (fs.existsSync(path.join(path.dirname(worker.file),id+'.jsonl.lock'))) throw new Error('Descendant result journal is active');
        const journal = readSessionJournal(worker.config.workspace,id,limits,settled.journal);
        const meta = journal[0], terminal = journal.findLast(row=>row.kind === 'turn_end' || row.kind === 'message' || row.kind === 'compact');
        if (meta?.kind !== 'metadata' || meta.config.parentSessionId !== worker.id || meta.fingerprint !== record.fingerprint ||
            terminal?.kind !== 'turn_end') throw new Error('Descendant result journal does not match its owner');
        notices.push({kind:'agent',sequence:notices.length+1,agent,runId:settled.runId},...(settled.subtreeEvents ?? []));
      }
      if (worker.awaitingResponse) {
        recoverPendingToolResults(worker);
        worker.append({kind:'turn_end',reason:'aborted'});
      } else {
        const last = worker.events.findLast(row=>row.kind === 'turn_end' || row.kind === 'message' || row.kind === 'compact');
        if (last?.kind !== 'turn_end' || (!deliveryId && !notices.length && last.reason !== 'aborted'))
          throw new Error('Interrupted task has no recoverable turn boundary');
        assertPaired(worker.messages);
      }
      await this.publishInterruptedStop(worker,store,child,runId,rootStop ? {redirectedEvents:notices} :
        notices.length ? {subtreeEvents:notices} : {});
    } finally { if (worker.isOpen) await worker.close(); }
  }

  private async publishInterruptedStop(worker: Session, store: AgentHistoryStore, child: AgentHistoryRecord, runId: string,
    notices: {redirectedEvents?: AgentNotification[]; subtreeEvents?: AgentNotification[]}): Promise<void> {
    const config = worker.config, id = worker.id;
    if (!config.childMode) throw new Error('Interrupted task has no child mode');
    const modelCalls = worker.events.filter(row => row.kind === 'message' && row.response).length;
    const agent: AgentDescriptor = {id,session_id:id,name:child.name,status:'cancelled',mode:config.childMode,
      model:config.model,summary:'',error:null,reason:'aborted',model_calls:modelCalls,queued_messages:0,
      ...(this.options.enableAdvanced ? {workspace:config.workspace,...(child.subagentType ? {subagent_type:child.subagentType} : {})} : {})};
    await worker.close();
    const journal = witnessEvents(worker.events);
    if (fs.existsSync(worker.file+'.lock')) throw new Error('Interrupted task journal is active');
    readSessionJournal(config.workspace,id,{maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents},journal);
    store.prepareWrite({...child,state:{kind:'settled',status:'cancelled',summary:'',error:null,reason:'aborted',
      modelCalls,endedAt:Date.now(),config,runId,notificationAgent:agent,...notices,journal}},undefined,runId)();
  }

  /** kG/dne, 24k7d6mw [633300,637661), sfn1dbxq [4233793,4234807), UTF-16: passive retained task fields. */
  detail(id: string): AgentTaskDetail | undefined {
    if (this.closed || this.options.signal?.aborted) return;
    const child = this.children.get(id);
    if (child === undefined) return;
    return { kind: 'agent', id: child.view.id, name: child.view.name, status: child.view.status,
      mode: child.view.mode, model: child.view.model, error: child.view.error, prompt: child.prompt,
      agentType: child.view.subagent_type ?? child.view.mode,
      ...(child.config.effort === undefined ? {} : { effort: child.config.effort }), startedAt: child.startedAt,
      ...(child.endedAt === undefined ? {} : { endedAt: child.endedAt }), progress: agentProgressSnapshot(child.progress) };
  }

  // Vp/Zee/im/am, 24k7d6mw [210906,211342)/[398352,399172), UTF-16: existing-owner views.
  transcript(id: string): AgentTranscript | undefined {
    if (this.closed || this.options.signal?.aborted) return;
    const child = this.children.get(id);
    if (child === undefined) return;
    return structuredClone({ id, name: child.view.name, model: child.view.model, status: child.view.status,
      records: child.transcript, inProgressToolUseIDs: [...child.inProgressToolUseIDs] });
  }

  // im/am/aoe, 24k7d6mw [398164,399172), UTF-16; the host retains against its history count cap.
  retainView(id: string): (() => void) | undefined {
    if (this.closed || this.options.signal?.aborted) return;
    const child = this.children.get(id);
    if (child === undefined) return;
    const lease = Symbol(id);
    child.viewLeases.add(lease);
    return () => {
      if (!child.viewLeases.delete(lease)) return;
      void this.trimHistory();
    };
  }

  private changed(): void {
    this.revision++;
    for (const listener of [...this.changes]) listener();
    this.options.onChange?.();
  }

  async poll(options: { waitMs?: number; since?: number; signal?: AbortSignal } = {}): Promise<AgentPollResult> {
    options.signal?.throwIfAborted();
    const waitMs = waitSchema.parse(options.waitMs ?? 0);
    const since = z.number().int().nonnegative().parse(options.since ?? this.revision);
    if (since > this.revision) throw new Error('Agent poll revision is ahead of this owner');
    if (since === this.revision && waitMs && !this.closed) {
      if (this.changes.size >= this.limits.maxPollWaiters) throw new Error('Agent poll waiter limit reached');
      await new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = (error?: unknown) => {
          if (timer) clearTimeout(timer);
          this.changes.delete(onChange); options.signal?.removeEventListener('abort', onAbort);
          if (error !== undefined) reject(error); else resolve();
        };
        const onChange = () => finish();
        const onAbort = () => finish(options.signal!.reason ?? new Error('Agent poll wait cancelled'));
        this.changes.add(onChange); options.signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => finish(), waitMs);
      });
    }
    return { revision: this.revision, changed: this.revision > since,
      agents: [...this.children.values()].map(child => ({ id: child.view.id, status: child.view.status })) };
  }

  subscribeIdle(selector: string, options: { expiresMs?: number; signal?: AbortSignal } = {}): AgentIdleSubscription {
    this.assertOpen(options.signal);
    const child = this.resolve(selector);
    const expiresMs = z.number().int().min(1).max(1_800_000).parse(options.expiresMs ?? 300_000);
    if (this.subscriptions.size >= this.limits.maxIdleSubscriptions) throw new Error('Agent idle subscription limit reached');
    const subscription: AgentIdleSubscription = { id: randomUUID(), agent_id: child.view.id, expires_ms: expiresMs };
    const timer = setTimeout(() => {
      if (this.closed || !this.subscriptions.delete(subscription.id)) return;
      this.notify(child, { id: subscription.id, state: 'expired' });
    }, expiresMs);
    this.subscriptions.set(subscription.id, { subscription, child, timer });
    return { ...subscription };
  }

  private deliverIdle(child: Child): void {
    if (this.closed || child.mailbox.length || !terminal(child.view.status)) return;
    // A notification callback may subscribe again or resume this child.
    const agent = this.snapshot(child);
    for (const [id, subscription] of [...this.subscriptions]) {
      if (this.closed) break;
      if (subscription.child !== child || !this.subscriptions.has(id)) continue;
      clearTimeout(subscription.timer); this.subscriptions.delete(id);
      this.notify(child, { id, state: 'idle' }, agent);
    }
  }

  private releaseEnvironment(child: Child): Promise<void> {
    if (child.environmentClosing) return child.environmentClosing;
    const environment = child.environment;
    if (!environment) return Promise.resolve();
    child.environmentClosing = (async () => {
      try { await environment.close(); }
      catch (error) {
        child.view.cleanup_error = field(`${child.config.workspace}: ${error instanceof Error ? error.message : String(error)}`, this.limits.maxOutputBytes);
      } finally { child.environment = undefined; }
    })();
    return child.environmentClosing;
  }

  // im/aoe, 24k7d6mw [398164,398888), UTF-16: selected transcripts survive normal task eviction.
  private async trimHistory(): Promise<void> {
    const finished = [...this.children.values()].filter(child => !child.worker && !child.viewLeases.size && terminal(child.view.status));
    while (finished.length > this.limits.maxHistory) {
      const old = finished.shift()!;
      this.children.delete(old.view.id); this.changed();
      await this.releaseEnvironment(old);
      if (old.view.cleanup_error) this.notify(old);
    }
  }

  private capacity(): void {
    let root: AgentRegistry = this;
    while (root.parentRegistry) root = root.parentRegistry;
    if (root.activeWorkers() >= root.limits.maxConcurrency) throw new Error('Child agent concurrency limit reached');
  }

  private activeWorkers(): number {
    let total = this.active;
    for (const child of this.children.values()) total += child.nested?.activeWorkers() ?? 0;
    return total;
  }

  // N4.submitToAgent/tqt/eqt, 24k7d6mw [1497670,1498885), sfn1dbxq [4223404,4224352), UTF-16.
  private enqueue(child: Child, message: string, human = false): void {
    messageSchema.parse(message);
    const bytes = Buffer.byteLength(message);
    if (bytes > this.limits.maxMessageBytes) throw new Error('Child message byte limit exceeded');
    if (child.accepted >= this.limits.maxAgentMessages) throw new Error('Child conversation message limit reached');
    if (child.mailbox.length >= this.limits.maxMailboxCount || child.mailboxBytes + bytes > this.limits.maxMailboxBytes) {
      throw new Error('Child mailbox limit reached');
    }
    if (child.journalEvents >= this.limits.maxJournalEvents || child.journalBytes >= this.limits.maxJournalBytes) {
      throw new Error('Child journal limit reached');
    }
    const displayId = human ? randomUUID() : undefined;
    child.mailbox.push({ text: message, origin: human ? { kind: 'human' } : { kind: 'peer', source: 'mailbox' },
      ...(displayId === undefined ? {} : { displayId }) });
    if (displayId !== undefined) child.transcript.push({ kind: 'pending_input', id: displayId, text: message });
    child.mailboxBytes += bytes; child.accepted++;
  }

  // dne/iCn, sfn1dbxq [4233793,4234807)/[4219665,4219883), UTF-16: retain launch data and progress.
  async launch(raw: AgentLaunch, callerSignal?: AbortSignal, execution?: {
    config: SessionConfig; tools: ToolDefinition[]; conversation?: readonly Anthropic.MessageParam[]; initialPrompt?: string;
    beforeTool?: (tool: ToolDefinition, input: unknown, signal: AbortSignal, workspace: string, planOwnership?: import('./plan-file.js').PlanOwnership) => Promise<void>;
    permissionOwner?: LivePermissionOwner; hookHomes?: ReadonlyMap<string, HookCommandHome>; skillScope?: SkillScope;
    skillContinuation?: { path: string; hooks: string; update: (skill: SkillInfo) => void; approvalValid?: () => boolean };
  }, conversation?: readonly Anthropic.MessageParam[], callerSession?: Session,
    progress?: ToolContext['agentProgress']): Promise<AgentDescriptor> {
    this.assertOpen(callerSignal);
    // EE, 27et44g8 [14843,14970), UTF-16: child plan identity comes from the current session.
    // The host's unbound catalog sentinel is not a session and cannot be persisted as one.
    const assertOwner = () => {
      if ((this.options.requireSessionOwner && (!this.historySession?.isOpen || this.historySession.id !== this.options.parentSessionId ||
          this.options.sessionOwner?.() !== this.historySession)) ||
          (this.options.parentSessionId === 'initial' && this.historyParent === undefined))
        throw new Error('Agent execution requires session-owned tools: bind a session and use buildTools(config, session.id)');
    };
    assertOwner();
    // dne, sfn1dbxq [4233793,4234807), UTF-16: adapt the invocation owner to the host Session object.
    if (this.options.requireSessionOwner && callerSession !== undefined && callerSession !== this.historySession)
      throw new Error('Agent execution session does not match the tool owner');
    const args: AgentLaunch = (this.options.enableAdvanced ? advancedLaunchSchema : launchSchema).parse(raw);
    const structuredState: StructuredOutputState | undefined = args.structured_schema === undefined ? undefined : (() => {
      try { return { compiled: compileStructuredOutputSchema(args.structured_schema), attempts: 0 }; }
      catch (error) {
        throw new Error(`agent({schema}) received an invalid JSON Schema: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    // The source validates these options before it creates any child
    // (chunk-hedqf2m1.js [77200,80100)); bad entries refuse the spawn.
    const disallowedTools = args.disallowed_tools === undefined ? undefined : normalizeDisallowedTools(args.disallowed_tools);
    const bashCommandClamp = args.bash_command_clamp === undefined ? undefined : normalizeBashCommandClamp(args.bash_command_clamp);
    // The source coerces with Number() and only arms the timer when the value is
    // above zero; a non-finite value would silently disable it, so the bridge
    // refuses it instead.
    let stallMs: number | undefined;
    if (args.stall_ms !== undefined && args.stall_ms !== null) {
      stallMs = Number(args.stall_ms);
      if (!Number.isFinite(stallMs)) throw new Error('agent({stallMs}) must be a finite number');
    }
    this.capacity();
    if (args.name && (this.reservedNames.has(args.name) || [...this.children.values()].some(child => child.view.name === args.name || child.view.id === args.name))) {
      throw new Error(`Child agent name already exists: ${args.name}`);
    }
    if (Buffer.byteLength(args.prompt) > this.limits.maxMessageBytes) throw new Error('Child message byte limit exceeded');
    // Zjt, 940nvk4p [1235,3817), UTF-16: task prompt stays raw while the worker receives Ykn(t).
    const initialPrompt = execution?.initialPrompt ?? args.prompt;
    if (Buffer.byteLength(initialPrompt) > this.limits.maxMessageBytes) throw new Error('Child message byte limit exceeded');
    const parent = this.source();
    let supplied = this.options.tools;
    if (!execution?.skillScope) assertAgentSpawnDepth(parent);
    if (execution) {
      if (execution.config.workspace !== parent.workspace) throw new Error('Child execution workspace must match parent');
      if (execution.tools.some(tool => !this.options.tools.includes(tool)) ||
          new Set(execution.tools.map(tool => tool.schema.name)).size !== execution.tools.length) {
        throw new Error('Child execution tools must be an original parent tool subset');
      }
      supplied = execution.tools;
    }
    const launch = resolveChildLaunch(parent, args, this.options);
    const seededFork = launch.fork || execution?.conversation !== undefined;
    const messages = forkMessages(execution?.conversation ?? conversation, seededFork);
    const liveOwner = execution?.permissionOwner ?? this.livePermissionOwner();
    const parentPolicy = () => effectivePermissionPolicy(this.source().permissions);
    const scopedPolicy = () => effectivePermissionPolicy(execution?.config.permissions,
      execution?.permissionOwner?.state());
    const allowShell = launch.mode === 'general' && parent.allowShell && (execution?.config.allowShell ?? true);
    const beforeTool = execution?.beforeTool;
    let selected = selectChildTools(supplied, launch.mode, launch.type?.tools);
    // A clamp also denies every MCP tool, as the source merges `mcp__*` into
    // the spawn's disallowed list when a clamp is present.
    const definitionDenies = [...(disallowedTools ?? []), ...(launch.type?.disallowedTools ?? [])];
    const mergedDenies = bashCommandClamp !== undefined
      ? [...definitionDenies, 'mcp__*']
      : definitionDenies.length ? definitionDenies : undefined;
    if (mergedDenies !== undefined) {
      validateDisallowedTools(mergedDenies, selected.map(tool => tool.schema.name));
      selected = selected.filter(tool => !toolNameDenied(tool.schema.name, mergedDenies));
    }
    if (structuredState !== undefined) {
      if (mergedDenies !== undefined && toolNameDenied(STRUCTURED_OUTPUT_TOOL_NAME, mergedDenies)) {
        throw new Error(`agent() schema mode needs the ${STRUCTURED_OUTPUT_TOOL_NAME} tool, but the spawn's merged disallowedTools deny it — `
          + 'refusing the spawn instead of running an agent that cannot return its structured output.');
      }
      // The source appends `Ea` when the agent's tool list lacks it and the pool
      // resolves names to the standard definition, so replacing a same-name entry
      // here is the same tool and keeps validation under this runtime's control.
      selected = [...selected.filter(tool => tool.schema.name !== STRUCTURED_OUTPUT_TOOL_NAME),
        createStructuredOutputTool(args.structured_schema, structuredState)];
    }
    if (bashCommandClamp !== undefined && !selected.some(tool => CLAMPED_SHELL_TOOLS.has(tool.schema.name))) {
      throw new Error(`agent() opts.bashCommandClamp can bind nothing: the spawned agent's resolved tool pool has no Bash-equivalent shell tool `
        + `(${[...CLAMPED_SHELL_TOOLS].join('/')}) — it was removed by this spawn's disallowedTools, the agent definition's denies, or it is `
        + 'absent from the session pool. A clamp on a Bash-less agent means the commands it was meant to keep are unavailable — refusing the '
        + 'spawn rather than running a blind agent. Drop the clamp or the Bash deny.');
    }
    const inherited = execution ? { ...structuredClone(execution.config), workspace: parent.workspace,
      allowShell: parent.allowShell && execution.config.allowShell,
      ...(execution.beforeTool ? { permissions: { mode: 'bypass' as const, allow: [], deny: [] } } : {}),
    } : parent;
    let config = childConfig(inherited, selected, launch);
    // EE, chunk-27et44g8.js [14843,14970), UTF-16: source children share a session owner.
    // EE, chunk-27et44g8.js [14843,14970), UTF-16: source children share a session owner.
    const parentSessionId = this.historyParent ?? this.options.parentSessionId;
    if (parentSessionId !== undefined) config.parentSessionId = parentSessionId;
    if (this.historySession) config.parentPlanId = this.historySession.config.parentPlanId ?? this.historySession.planId;
    // de, chunk-p46ep603.js UTF-16 [4120,5234): append each invocation layer.
    if (bashCommandClamp !== undefined) config = { ...config,
      bashCommandClamp: [...(config.bashCommandClamp ?? []), ...bashCommandClamp] };
    if (stallMs !== undefined) config = { ...config, stallMs };
    if (structuredState !== undefined) config = { ...config, system: config.system + STRUCTURED_OUTPUT_SYSTEM_NOTE };
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    if (callerSignal?.aborted) onCallerAbort();
    this.active++;
    if (args.name) this.reservedNames.add(args.name);
    const preparingSkill = execution?.skillScope?.skillName;
    if (preparingSkill) this.preparingSkills.set(controller, preparingSkill);
    this.preparations.add(controller);
    let finishPreparation!: () => void;
    const preparation = new Promise<void>(resolve => { finishPreparation = resolve; });
    this.preparing.add(preparation);
    let environment: ChildEnvironmentLease | undefined;
    let session: Session | undefined;
    let hooks: ReturnType<typeof createChildHookLifecycle> | undefined;
    let child: Child | undefined;
    let started = false;
    try {
      if (launch.isolation) {
        if (!this.options.childEnvironmentFactory) throw new Error('Child worktree environment is unavailable');
        environment = await this.options.childEnvironmentFactory({ config, tools: selected, isolation: launch.isolation, signal: controller.signal });
        validateChildEnvironment(config, selected, environment);
        // The recovered child reads its instructions from the path it runs in
        // (`Sar` -> `Znr` -> `gCt`, chunk-sfn1dbxq.js [3671831,3672142)), so an
        // isolated checkout carries its own files, not the parent's text.
        const rebased = rebaseChildInstructions(config, environment.config.workspace,
          { ...(config.configSources?.managedSettingsFile === undefined ? {} : { managedSettingsFile: config.configSources.managedSettingsFile }),
            ...(config.policyHelperText === undefined ? {} : { policyHelperText: config.policyHelperText }) },
          childPromptSuffix(launch) + (structuredState === undefined ? '' : STRUCTURED_OUTPUT_SYSTEM_NOTE), instructionEndMarkers(config),
          launch.type?.omitClaudeMd === true);
        config = { ...config, workspace: environment.config.workspace, system: rebased.system };
        if (rebased.instructions !== undefined) {
          config.instructionSources = instructionSources(rebased.instructions);
          config.conditionalRules = rebased.conditionalRules ?? [];
        }
        selected = environment.tools;
      }
      this.assertOpen(controller.signal);
      // dne, sfn1dbxq [4233793,4234807), UTF-16: host Session ownership must survive preparation.
      assertOwner();
      const tools = selected.map(tool => {
        if (!execution) return tool;
        const authorize = async (input: unknown, context: ToolContext): Promise<ToolContext> => {
          context.signal.throwIfAborted();
          const plan = context.planMode?.ownership;
          const decision = permissionDecision(execution.permissionOwner ? scopedPolicy() : parentPolicy(), tool, input,
            { ...liveOwner.state(), planOwnership: plan }, config.workspace);
          const scopedDecision = permissionDecision(scopedPolicy(), tool, input,
            { ...liveOwner.state(), planOwnership: plan }, config.workspace);
          if (scopedDecision.decision === 'deny') throw new Error(scopedDecision.reason ?? 'Child permission denied tool');
          if (decision.decision === 'deny') throw new Error(decision.reason ?? 'Parent permission denied child tool');
          if ((decision.decision === 'ask' || scopedDecision.decision === 'ask') && !beforeTool) {
            throw new Error(decision.reason ?? scopedDecision.reason ?? 'Parent permission requires approval');
          }
          await beforeTool?.(tool, input, context.signal, config.workspace, plan);
          context.signal.throwIfAborted();
          return { ...context, workingDirectories: context.workingDirectories ?? liveOwner.workingDirectories,
            workspace: config.workspace, allowShell: context.allowShell && allowShell };
        };
        return bindScopedChildTool(tool, authorize);
      });
      const metadataBytes = Buffer.byteLength(JSON.stringify({ kind: 'metadata', version: 1,
        id: '00000000-0000-4000-8000-000000000000', config, fingerprint: fingerprint(config) })) + 1;
      // vC, 40cepjpq [131541,131676), UTF-16: declared skills preload into initial context.
      const preloads = launch.type ? preloadAgentSkills(launch.type, parent.skills, launch.type.name, undefined, parent.features?.skillSourceArguments === true) : [];
      const seedBytes = messages.reduce((sum, message) => sum + Buffer.byteLength(JSON.stringify({ kind: 'message', message })) + 1, 0)
        + preloads.reduce((sum, message) => sum + Buffer.byteLength(JSON.stringify({ kind: 'message', message, isMeta: true })) + 1, 0);
      const seedBoundary = seededFork && messages.length ? 'fork_seed' : preloads.length ? 'skill_preload' : undefined;
      const seedBoundaryBytes = seedBoundary ? Buffer.byteLength(JSON.stringify({ kind: 'turn_end', reason: seedBoundary })) + 1 : 0;
      if (metadataBytes + seedBytes + seedBoundaryBytes + 128 > this.limits.maxJournalBytes || messages.length + preloads.length + (seedBoundaryBytes ? 2 : 1) >= this.limits.maxJournalEvents) throw new Error('Child journal limit reached');
      const identityParent = !environment && !seededFork && !execution && this.options.requireSessionOwner ? this.historySession : undefined;
      session = Session.open(config.workspace, { config, childJournalLimits:this.limits, ...(environment?.storageRoot ? { storageRoot: environment.storageRoot } : {}),
        ...(identityParent ? { childRoot: { parent: identityParent, isOwner: () => !this.closed &&
          this.historySession === identityParent && this.options.sessionOwner?.() === identityParent } } : {}) });
      if (execution?.skillScope) writeSkillScope(session.file, execution.skillScope);
      if (execution?.beforeTool) session.inheritPermissionAdoption(liveOwner);
      else session.inheritPermissions(liveOwner);
      for (const message of messages) session.append({ kind: 'message', message });
      for (const message of preloads) session.append({ kind: 'message', message, isMeta: true });
      // vC, 40cepjpq [132082,132105), UTF-16: preloads are initial query context.
      if (seedBoundary) session.append({ kind: 'turn_end', reason: seedBoundary });
      hooks = createChildHookLifecycle(session, this.options, execution?.hookHomes);
      const childId = session.id;
      const agent = new Agent(session, this.options.provider, tools, { hookOptions: hooks.hookOptions,
        // Foreground agent progress, wj6fycw8 [38800,42500), UTF-16.
        toolUse: message => { if (!args.background && !child?.backgrounded && !callerSignal?.aborted) progress?.(childId, message); },
        textStart: () => { if (child) this.beginResponse(child); },
        text: text => { if (child) this.streamResponse(child, text); },
        // A denying PermissionRequest hook with `interrupt:true` aborts this
        // child's turn (source subagent consumer, chunk-fk088dyb.js offset 89115).
        interruptTurn: () => controller.abort(new Error('Hook interrupt')),
        ...(structuredState ? { requiredTool: STRUCTURED_OUTPUT_TOOL_NAME } : {}),
        ...(this.options.instructionFiles ? { instructionFiles: paths => this.options.instructionFiles!(config.workspace, paths) } : {}),
        ...(this.options.terminalSequence ? { terminalSequence: sequence => this.options.terminalSequence!(childId, sequence) } : {}),
        ...(this.options.stopState ? { stopState: this.options.stopState } : {}) });
      child = {
        ...(preparingSkill ? { forkedSkillName: preparingSkill } : {}),
        view: { id: session.id, session_id: session.id, name: args.name ?? null, status: 'queued',
          mode: launch.mode, model: config.model, summary: '', error: null, reason: null, model_calls: 0, queued_messages: 0,
          ...(this.options.enableAdvanced ? { workspace: config.workspace, ...(args.subagent_type ? { subagent_type: args.subagent_type } : {}) } : {}) },
        config: session.config, resumeConfig: structuredClone(config), tools, controller, mailbox: [], mailboxBytes: 0, liveOwner, adoptionOnly: execution?.beforeTool !== undefined,
        transcript: session.events.filter(transcriptEvent), inProgressToolUseIDs: new Set(), viewLeases: new Set(),
        prompt: args.prompt, startedAt: Date.now(), progress: createAgentProgress(), streamedChars: 0, backgrounded: args.background === true,
        accepted: 0, session, agent, hooks, ...(execution?.hookHomes ? { hookHomes: execution.hookHomes } : {}),
        journalEvents: session.events.length, journalBytes: metadataBytes + seedBytes + seedBoundaryBytes,
        ...(structuredState ? { structured: structuredState } : {}),
        ...(execution?.skillScope && execution.skillContinuation ? { skillContinuation: { scope: execution.skillScope, ...execution.skillContinuation, first: true } } : {}),
        ...(environment ? { environment } : {}), fork: seededFork,
      };
      // ad, 40cepjpq [120014,120794), UTF-16.
      if (this.history && (!execution || execution.skillScope) && !environment && !structuredState && !disallowedTools && !bashCommandClamp && stallMs === undefined) {
        child.history = this.history.header(session, { name: child.view.name, prompt: args.prompt, backgrounded: child.backgrounded,
          fork: seededFork, startedAt: child.startedAt, ...(args.subagent_type ? { subagentType: args.subagent_type } : {}),
          ...(execution?.skillScope ? { skillName: execution.skillScope.skillName } : {}) });
        this.saveHistory(child, true);
      }
      this.enqueue(child, initialPrompt);
      this.children.set(session.id, child);
      this.start(child, true); started = true; this.changed();
    } catch (error) {
      try { await hooks?.close(); }
      finally {
        try { await session?.close(); }
        finally {
          try { await environment?.close(); }
          catch (cleanup) { throw new AggregateError([error, cleanup], `Child setup failed; cleanup failed at ${config.workspace}`); }
        }
      }
      throw error;
    } finally {
      callerSignal?.removeEventListener('abort', onCallerAbort);
      this.preparations.delete(controller);
      if (args.name) this.reservedNames.delete(args.name);
      if (preparingSkill) this.preparingSkills.delete(controller);
      if (!started) this.active--;
      this.preparing.delete(preparation); finishPreparation();
    }
    if (!args.background) await this.wait(child!, undefined, callerSignal);
    return this.snapshot(child!);
  }

  // N4.submitToAgent/xX/Ve, 24k7d6mw [1497670,1498885), qw2csqy5 [8817,9345), UTF-16.
  async sendMessage(selector: string, message?: string, callerSignal?: AbortSignal, options: {
    notifyWhenIdle?: boolean; expiresMs?: number; human?: boolean;
  } = {}): Promise<AgentDescriptor> {
    this.assertOpen(callerSignal);
    const child = this.resolve(selector);
    const notifyWhenIdle = z.boolean().parse(options.notifyWhenIdle ?? false);
    const expiresMs = z.number().int().min(1).max(1_800_000).parse(options.expiresMs ?? 300_000);
    if (message === undefined && !notifyWhenIdle) throw new Error('Message or idle subscription is required');
    if (notifyWhenIdle && this.subscriptions.size >= this.limits.maxIdleSubscriptions) throw new Error('Agent idle subscription limit reached');
    if (message !== undefined) {
      // _kt/kn, j8hqhz0c [42796,42945), qw2csqy5 [9345,31492), UTF-16: publish the human restart after admission.
      while (options.human && child.worker && (child.controller.signal.aborted || child.view.status === 'failed')) {
        await child.worker;
        this.assertOpen(callerSignal);
        if (this.children.get(child.view.id) !== child) throw new Error('Agent view owner is no longer available');
      }
      const restarting = child.controller.signal.aborted || child.view.status === 'failed';
      if (restarting) {
        if (!options.human) throw new Error(`Child agent is ${child.view.status}`);
        if (child.environmentClosing) throw new Error('The isolated agent environment has closed; start a new agent');
      }
      if (!child.worker) this.capacity();
      if (child.historyInvalid) throw new Error('Child journal continuity requires reconciliation');
      if (child.history) this.restoredTools(child.resumeConfig);
      if (!child.worker && child.coldJournal && this.history && this.historySession?.isOpen) {
        const current = this.history.read(), record = current.records.find(item => item.id === child.view.id);
        child.coldRootVerified = !current.candidates.has(child.view.id) && record?.parent === this.historySession.id &&
          record.state.kind === 'settled' && record.state.journal.bytes === child.coldJournal.bytes &&
          record.state.journal.sha256 === child.coldJournal.sha256;
      }
      const transcriptLength = child.transcript.length;
      this.enqueue(child, message, options.human);
      try { this.saveHistory(child, true, child.view.status === 'running' ? child.runId : undefined); }
      catch (error) {
        child.mailbox.pop(); child.mailboxBytes -= Buffer.byteLength(message); child.accepted--;
        child.transcript.length = transcriptLength;
        throw error;
      }
      if (restarting) { child.controller = new AbortController(); child.view.error = null; }
      if (!child.worker) { child.view.status = 'queued'; this.start(child); }
      this.changed();
    }
    if (notifyWhenIdle) this.subscribeIdle(selector, { expiresMs });
    return this.snapshot(child);
  }

  async get(selector: string, options: { waitMs?: number; signal?: AbortSignal } = {}): Promise<AgentDescriptor> {
    options.signal?.throwIfAborted();
    const child = this.resolve(selector);
    const waitMs = waitSchema.parse(options.waitMs ?? 0);
    if (waitMs) await this.wait(child, waitMs, options.signal);
    return this.snapshot(child);
  }

  // _k, sfn1dbxq [4228512,4230112), UTF-16: stamp terminal task time through the owned stop path.
  async stop(selector: string): Promise<AgentDescriptor> {
    const child = this.resolve(selector);
    // _k/Cfr, sfn1dbxq [4228512,4230112), dxp0113e [2037,2191), UTF-16: retain a terminal, unparked record.
    if (!child.worker && terminal(child.view.status)) {
      await this.releaseEnvironment(child);
      return this.snapshot(child);
    }
    this.retireStagedWake(child);
    child.controller.abort();
    child.mailbox = []; child.mailboxBytes = 0;
    if (child.worker) await child.worker;
    else { child.view.status = 'cancelled'; child.endedAt = Date.now(); this.saveHistory(child); this.notify(child); this.deliverIdle(child); }
    await this.releaseEnvironment(child);
    return this.snapshot(child);
  }

  private start(child: Child, reserved = false): void {
    if (!reserved) this.active++;
    // Set worker before starting hooks/provider work, so rapid messages queue serially.
    child.worker = Promise.resolve().then(async () => {
      do { await this.run(child); }
      while (child.mailbox.length && !child.controller.signal.aborted && child.view.status !== 'failed');
    }).finally(async () => {
      if (child.controller.signal.aborted || child.view.status === 'failed') await this.releaseEnvironment(child);
      this.active--; child.worker = undefined;
      if (child.forkedSkillName) this.changed();
      this.deliverIdle(child);
      if (child.mailbox.length && !child.worker && !this.closed && !child.controller.signal.aborted && child.view.status !== 'failed') this.start(child);
      await this.trimHistory();
    });
  }

  // IX [107910,110110), 40cepjpq, UTF-16; host final-message usage adapter recorded in W321.
  private beginResponse(child: Child): void {
    child.streamedChars = 0;
    observeAgentStream(child.progress, { type: 'response_start' });
  }

  // Td, hwpb27as [4137,4218), UTF-16: estimate the accumulated text rather than rounded chunks.
  private streamResponse(child: Child, text: string): void {
    const previous = Math.round(child.streamedChars / 4);
    child.streamedChars += text.length;
    observeAgentStream(child.progress, { type: 'tokens', estimatedTokensDelta: Math.round(child.streamedChars / 4) - previous });
  }

  // IX, 40cepjpq [107910,110110); tqt/eqt, sfn1dbxq [4223404,4224352), UTF-16.
  // The journal adapter replaces its pending human echo and publishes committed tool/message rows.
  private boundJournal(child: Child): void {
    const session = child.session!;
    child.journalEvents = session.events.length;
    child.journalBytes = session.events.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event)) + 1, 0);
    if (child.journalEvents > this.limits.maxJournalEvents || child.journalBytes > this.limits.maxJournalBytes) {
      throw new Error('Child journal limit reached');
    }
    const append = session.append.bind(session);
    session.append = (...args: Parameters<Session['append']>) => {
      const [event] = args;
      const bytes = Buffer.byteLength(JSON.stringify(event)) + 1;
      append(...args);
      child.journalEvents++; child.journalBytes += bytes;
      if (transcriptEvent(event)) {
        let replaced = false;
        if (event.kind === 'message' && event.classifier?.origin.kind === 'human' && child.activeInput !== undefined) {
          const index = child.transcript.findIndex(row => row.kind === 'pending_input' && row.id === child.activeInput);
          if (index >= 0) { child.transcript[index] = structuredClone(event); replaced = true; }
          child.activeInput = undefined;
        }
        if (!replaced) child.transcript.push(structuredClone(event));
        if (event.kind === 'tool_start') child.inProgressToolUseIDs.add(event.id);
        if (event.kind === 'tool_result') child.inProgressToolUseIDs.delete(event.result.tool_use_id);
        if (event.kind === 'turn_end') child.inProgressToolUseIDs.clear();
        this.options.onChange?.();
      }
      if (event.kind === 'message' && event.response !== undefined) {
        child.progress.streamedTokenEstimate = child.progress.streamedTokenEstimateAtResponseStart;
        observeAgentResponse(child.progress, event.response);
        child.streamedChars = 0;
      }
    };
  }

  // IX, 40cepjpq [104577,115399); iYr/nsr, sfn1dbxq [4232306,4233793), UTF-16: owned run and terminal time.
  private async run(child: Child): Promise<void> {
    const resumedDelivery = child.continuingDeliveryId;
    let suspend = false;
    let publishSettlement: (() => void) | undefined;
    // LP, bk5ct2gw [267620,268165); un, j8hqhz0c [39120,41080), UTF-16.
    // Each worker invocation follows the preceding terminal notification, including reentrant resumes.
    const previous = child.runId?.match(/^[0-9a-z]{9}(?=-)/)?.[0];
    const timestamp = Math.max(Date.now(), previous === undefined ? 0 : parseInt(previous, 36) + 1);
    if (!child.continuingDeliveryId || !child.runId) child.runId = timestamp.toString(36).padStart(9, '0') + '-' + randomBytes(4).toString('hex');
    const signal = child.controller.signal;
    let started = false;
    let coldPermission: AgentEvents['permission'];
    // kn, chunk-qw2csqy5.js [11500,19000), aNn, chunk-p46ep603.js
    // [1284,1978), UTF-16: resolve and scope the current skill before hooks.
    const prepareSkill = () => {
      const continuation = child.skillContinuation;
      if (!continuation) return;
      if (continuation.first) {
        continuation.first = false;
        if (continuation.approvalValid && !continuation.approvalValid()) throw new Error('Session approval unavailable');
        delete continuation.approvalValid;
        return;
      }
      const journal = child.session!.file;
      const scope = readSkillScope(journal);
      if (scope.status !== 'valid' || scope.scope.skillName !== continuation.scope.skillName || scope.scope.attributionName !== continuation.scope.attributionName || scope.scope.effort !== continuation.scope.effort || scope.scope.skillPath !== continuation.path || scope.scope.hookIdentity !== continuation.hooks || readSkillScopeWitness(journal) !== continuation.scope.skillName) throw new Error('Child skill scope identity mismatch');
      const skill = this.currentSkill(continuation.scope.skillName);
      if (skill.path !== continuation.path || JSON.stringify(skill.hooks ?? null) !== continuation.hooks) throw new Error('Child skill identity or hook approvals changed');
      continuation.update(skill);
    };
    try {
      signal.throwIfAborted();
      // kn, qw2csqy5 [11500,19000), aNn, p46ep603 [1284,1978), UTF-16.
      if (child.coldSkillScope) {
        const scope = this.validateColdSkillScope(path.join(this.source().workspace, '.agent', `${child.view.id}.jsonl`), child.coldSkillScope.skillName);
        if (!scope || JSON.stringify(scope) !== JSON.stringify(child.coldSkillScope)) throw new Error('Child skill scope identity mismatch');
        let currentSkill = this.currentSkill(scope.skillName);
        const valid = this.requireApprovalGeneration();
        const parentOwner = this.livePermissionOwner();
        const owner: LivePermissionOwner = {
          prepareAutoMode: () => parentOwner.prepareAutoMode?.(),
          state: () => childPermissionState(parentOwner.state(), currentSkill.allowedTools),
          workingDirectories: readOnly => parentOwner.workingDirectories(readOnly),
          adoptUpdates: parentOwner.adoptUpdates,
        };
        const config = structuredClone(this.source());
        bindPermissionOwner(config.permissions, parentOwner);
        const options = { config, provider: this.options.provider, tools: this.options.tools, signal, source: 'user' as const,
          requestPermission: this.requestApproval.bind(this) };
        // kn, qw2csqy5 [22571,24971), UTF-16. Fence external work before hook approval.
        if (child.continuingDeliveryId) this.saveHistory(child, true, child.runId);
        const prepared = await prepareSkillHooks(currentSkill, options, valid);
        if (!valid()) throw new Error('Session approval unavailable');
        const checkedScope = this.validateColdSkillScope(path.join(this.source().workspace, '.agent', `${child.view.id}.jsonl`), scope.skillName);
        if (JSON.stringify(checkedScope) !== JSON.stringify(scope)) throw new Error('Child skill scope identity mismatch');
        currentSkill = this.currentSkill(scope.skillName);
        const beforeTool = skillToolApproval(() => currentSkill, options);
        const approvals = new WeakMap<object, { tool: string; input: string; signal: AbortSignal }>();
        // zyn [1892,4679), kn [22571,27805), UTF-16: retain the live caller approval across child authorization.
        coldPermission = async request => {
          if (!valid() || request.authorizationIdentity.signal.aborted || request.signal.aborted) return false;
          const tool = this.restoredTools(child.resumeConfig).find(item => item.schema.name === request.tool);
          if (!tool) return false;
          const snapshot = JSON.stringify(request.input);
          const result = await this.requestApproval(tool, request.input, { decision: 'ask', reason: request.reason }, request.signal);
          if (!valid() || request.signal.aborted || request.authorizationIdentity.signal.aborted || JSON.stringify(request.input) !== snapshot || result.decision !== 'allow') return false;
          approvals.set(request.authorizationIdentity, { tool: request.tool, input: snapshot, signal: request.signal });
          return true;
        };
        const takeApproval = (tool: ToolDefinition, input: unknown, context: ToolContext): boolean => {
          const identity = context.authorizationIdentity;
          if (!identity) return false;
          const approval = approvals.get(identity);
          approvals.delete(identity);
          return !!approval && valid() && !identity.signal.aborted && !context.signal.aborted &&
            approval.signal === context.signal && approval.tool === tool.schema.name && approval.input === JSON.stringify(input);
        };
        // kn [22571,24971), Kt [121053,123737), UTF-16: rebuild the tool pool
        // for the resumed child and keep the checked input through dispatch.
        child.tools = this.restoredTools(child.resumeConfig).map(tool => bindScopedChildTool(tool, async (input, context) => {
          if (!valid()) throw new Error('Session approval unavailable');
          await beforeTool(tool, input, context.signal, context.workspace, context.planMode?.ownership, takeApproval(tool, input, context));
          if (!valid()) throw new Error('Session approval unavailable');
          return { ...context, workingDirectories: context.workingDirectories ?? parentOwner.workingDirectories,
            allowShell: context.allowShell && config.allowShell };
        }, 'after-approval'));
        child.liveOwner = owner;
        child.hookHomes = prepared.hookHomes;
        child.config.hooks = prepared.hooks;
        child.skillContinuation = { scope, path: scope.skillPath!, hooks: scope.hookIdentity!, first: true,
          approvalValid: valid, update: next => { currentSkill = next; } };
        delete child.coldSkillScope;
      }
      const resumed = !child.agent;
      if (resumed) {
        // kn, qw2csqy5 [22571,24971)/[25405,27805), UTF-16; journal identity and live skill context have separate owners.
        try {
          const parent = this.historySession, journal = child.coldJournal, history = this.history;
          const childRoot = parent && journal && history && this.options.requireSessionOwner && !child.fork && !child.history?.skillName
            ? { parent, isOwner: () => !this.closed && this.historySession === parent && this.options.sessionOwner?.() === parent,
              verifyHistory: () => {
                const current = history.read();
                const record = current.records.find(item => item.id === child.view.id);
                return child.coldRootVerified === true && !current.candidates.has(child.view.id) &&
                  record?.parent === parent.id && record.state.kind === 'active';
              } } : undefined;
          child.session ??= Session.open(child.config.workspace, { id: child.view.session_id, config: child.resumeConfig, childJournalLimits:this.limits,
            ...(child.coldJournal ? { expectedJournal: child.coldJournal } : {}),
            ...(childRoot ? { childRoot } : {}),
            ...(child.environment?.storageRoot ? { storageRoot: child.environment.storageRoot } : {}) });
        } catch (error) { if (child.coldJournal) child.historyInvalid = true; throw error; }
        delete child.coldJournal;
        for (const key of Object.keys(child.session.config)) {
          if (!Object.hasOwn(child.config, key)) Reflect.deleteProperty(child.session.config, key);
        }
        Object.assign(child.session.config, structuredClone(child.config));
        child.config = child.session.config;
        if (child.adoptionOnly) child.session.inheritPermissionAdoption(child.liveOwner);
        else child.session.inheritPermissions(child.liveOwner);
        child.hooks = createChildHookLifecycle(child.session, this.options, child.hookHomes);
        const childId = child.session.id;
        child.agent = new Agent(child.session, this.options.provider, child.tools, { hookOptions: child.hooks.hookOptions,
          ...(coldPermission ? { permission: coldPermission } : {}),
          textStart: () => this.beginResponse(child), text: text => this.streamResponse(child, text),
          interruptTurn: () => child.controller.abort(new Error('Hook interrupt')),
          ...(child.structured ? { requiredTool: STRUCTURED_OUTPUT_TOOL_NAME } : {}),
          ...(this.options.instructionFiles ? { instructionFiles: paths => this.options.instructionFiles!(child.config.workspace, paths) } : {}),
          ...(this.options.terminalSequence ? { terminalSequence: sequence => this.options.terminalSequence!(childId, sequence) } : {}),
          ...(this.options.stopState ? { stopState: this.options.stopState } : {}) });
      }
      this.boundJournal(child);
      // zUn/LP, bk5ct2gw [267620,268165), UTF-16: publish this invocation before its hooks or model turn.
      if (!child.continuingDeliveryId) this.saveHistory(child, true, child.runId);
      delete child.endedAt;
      child.view.status = 'running'; this.changed();
      prepareSkill();
      if (!child.continuingDeliveryId) await child.agent!.startSession(resumed ? 'resume' : child.fork ? 'fork' : 'startup', signal);
      started = true;
      let firstPrompt = true;
      while (true) {
        signal.throwIfAborted();
        const nested = child.nested;
        const continuing = firstPrompt && child.continuingDeliveryId !== undefined;
        const prompt = continuing ? undefined : child.mailbox.shift();
        const delivery = prompt ? undefined : nested?.pendingWorkerBatch(child.config.maxOutputBytes, child.runId);
        if (!prompt && !delivery && !continuing) {
          if (!nested?.active) break;
          // IX, 40cepjpq [110300,111850), UTF-16: withhold the owner's terminal
          // notification while its descendants run. Mailbox and task changes wake it.
          child.parked = true;
          try { await this.poll({waitMs:30000, signal}); } finally { child.parked = false; }
          continue;
        }
        if (!firstPrompt) prepareSkill();
        firstPrompt = false;
        child.activeInput = prompt?.displayId;
        let result: RunResult;
        if (continuing) {
          if (child.readyDelivery) {
            const ready = child.readyDelivery;
            const registry = this.nestedSkillRegistry(child.session!,this.historySession!);
            for (const event of ready.batch.events) {
              const descendant = registry.children.get(event.agent.id);
              if (!descendant || descendant.runId !== event.runId || descendant.view.status !== event.agent.status)
                throw new Error('Nested delivery no longer matches settled history');
            }
            registry.events = structuredClone(ready.batch.events);
            registry.eventBytes = registry.events.reduce((size,event) => size + Buffer.byteLength(JSON.stringify(event)),0);
            registry.sequence = registry.events.at(-1)!.sequence;
            result = await registry.deliverWorkerBatch(child,ready.batch,signal,ready.deliveryId);
            delete child.readyDelivery;
          } else result = await child.agent!.run(undefined,signal);
          delete child.continuingDeliveryId;
        } else if (prompt) {
          child.mailboxBytes -= Buffer.byteLength(prompt.text);
          result = await child.agent!.run(prompt.text, signal, undefined, undefined, [], undefined, prompt.origin);
        } else {
          result = await nested!.deliverWorkerBatch(child, delivery!, signal);
        }
        child.view.reason = field(result.reason, this.limits.maxOutputBytes);
        child.view.summary = field(result.text, this.limits.maxOutputBytes);
        if (child.structured !== undefined) {
          if (child.structured.value !== undefined) {
            // Source `ups` call site (chunk-hedqf2m1.js [73056)): reserved-key strip and scrub
            // before the structured result is exposed.
            child.view.structured_output = scrubSubagentOutput(child.structured.value, {
              reservedKeys: ['webFetchSavedFiles'],
            }).value;
            delete child.view.structured_error;
          } else {
            const structuredError = child.structured.capError ?? child.structured.lastError;
            if (structuredError !== undefined) child.view.structured_error = field(structuredError, this.limits.maxOutputBytes);
          }
        }
        child.view.model_calls += result.modelCalls;
        child.journalEvents = child.session!.events.length;
        child.journalBytes = child.session!.events.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event)) + 1, 0);
        if (signal.aborted || result.reason === 'aborted') break;
        if (!['end_turn', 'stop_sequence', 'turn_limit', 'hook_blocked'].includes(result.reason)) {
          throw new Error(`Child turn ended with ${result.reason}`);
        }
        if (child.mailbox.length && (child.journalEvents >= this.limits.maxJournalEvents || child.journalBytes >= this.limits.maxJournalBytes)) {
          throw new Error('Child journal limit reached');
        }
      }
      // IX, 40cepjpq [110300,111850), UTF-16: defer terminal reporting while
      // another descendant owns a keepalive. Its old provider call cannot be resumed here.
      suspend = !!child.coldKeepalive && !signal.aborted;
      child.view.status = signal.aborted ? 'cancelled' : suspend ? 'running' : 'completed';
    } catch (error) {
      child.view.status = signal.aborted ? 'cancelled' : 'failed';
      child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
      // Failed provider/hook calls still delimit the attempted turn in the journal.
      if (child.session?.awaitingResponse) {
        try { child.session.append({ kind: 'turn_end', reason: signal.aborted ? 'aborted' : 'agent_error' }); }
        catch { /* Preserve the original failure if the journal itself failed. */ }
      }
    } finally {
      this.retireStagedWake(child);
      if (child.nested) {
        try { await child.nested.close(); }
        catch (error) {
          child.view.status = 'failed';
          child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
        }
        child.nested = undefined;
      }
      child.mailbox = []; child.mailboxBytes = 0;
      try { if (started && !suspend) await child.agent?.endSession(signal.aborted ? 'interrupt' : 'other'); }
      catch (error) {
        if (!signal.aborted) {
          child.view.status = 'failed';
          child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
        }
      } finally {
        try { await child.hooks?.close(); }
        catch (error) {
          child.view.status = 'failed';
          child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
        } finally {
          // IX, 40cepjpq [114500,115399), UTF-16. Host session shutdown
          // also drains pending permission writes before publishing the result.
          try {
            const store = this.history, header = child.history, session = child.session;
            await session?.close(resumedDelivery && store && header && !child.historyInvalid ? async lock => {
              try {
                // Child permission adoption delegates persistence to the live parent.
                await this.historySession!.drainPermissionWrites();
                child.endedAt = Date.now();
                const journal = witnessEvents(session.events);
                if (suspend) {
                  if (child.view.status !== 'running') throw new Error(child.view.error ?? 'Worker could not park');
                  readSessionJournal(session.config.workspace,session.id,
                    {maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents},journal);
                  store.park(header,child.runId!,{deliveryId:resumedDelivery,journal,waitingFor:child.coldKeepalive!});
                  return;
                }
                const record = this.settledHistory(child, header);
                if (journal.bytes !== record.state.journal.bytes || journal.sha256 !== record.state.journal.sha256 ||
                    fs.statSync(session.file).size !== journal.bytes)
                  throw new Error('Child journal changed during shutdown');
                const publish = store.prepareWrite(record,lock);
                publishSettlement = () => {
                  if (fs.existsSync(session.file + '.lock')) throw new Error('Child journal is active');
                  readSessionJournal(session.config.workspace,session.id,
                    {maxBytes:this.limits.maxJournalBytes,maxEvents:this.limits.maxJournalEvents},journal);
                  publish();
                  child.coldJournal = journal;
                };
              } catch (error) {
                child.historyInvalid = true;
                throw error;
              }
            } : undefined);
          }
          catch (error) {
            publishSettlement = undefined;
            if (resumedDelivery && child.session && fs.existsSync(child.session.file+'.lock')) child.historyInvalid = true;
            child.view.status = 'failed';
            child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
          }
          child.session = undefined; child.agent = undefined; child.hooks = undefined;
        }
      }
      if (suspend) {
        this.children.delete(child.view.id);
      } else {
        if (!publishSettlement) child.endedAt = Date.now();
        try { if (publishSettlement) publishSettlement(); else this.saveHistory(child); }
        catch (error) {
          child.view.status = 'failed';
          child.view.error = field(`Child history commit failed: ${error instanceof Error ? error.message : String(error)}`, this.limits.maxOutputBytes);
        }
        this.notify(child);
      }
    }
  }

  private pendingWorkerBatch(maxOutputBytes: number, receiverRunId: string): Extract<NotificationBatch, {kind:'agent_events'}> | undefined {
    if (!this.events.length && this.dropped === this.deliveredNestedDrops) return;
    // aB/zUn, bk5ct2gw [267620,268165), and wake router, rx2nah4x [229020,229780), UTF-16.
    return {kind:'agent_events', receiverRunId, ...this.peekNotifications(), maxOutputBytes};
  }

  // wake router, rx2nah4x [229020,229780), UTF-16: consume only the commands
  // selected for this delivery, after the receiving worker commits its prompt.
  private async deliverWorkerBatch(child: Child, batch: Extract<NotificationBatch, {kind:'agent_events'}>,
      signal: AbortSignal, deliveryId: string = randomUUID()): Promise<RunResult> {
    const session = child.session!, owner = session.id;
    const live = () => !signal.aborted && session.isOpen && child.session === session && child.nested === this &&
      child.runId === batch.receiverRunId;
    const count = batch.events.length;
    // Wake router, rx2nah4x [229020,229780), UTF-16. Preserve its exact selected
    // commands under the root before the receiving journal or prompt hooks run.
    if (!child.continuingDeliveryId && child.history && this.parentRegistry?.history &&
        !this.active && !this.preparing.size && !this.subscriptions.size && !this.dropped &&
        batch.events.length === this.events.length && batch.events.every(event => event.runId && !event.subscription)) {
      const journal = witnessEvents(session.events);
      if (child.stagedWake?.journal.sha256 === journal.sha256 && fingerprintOf(child.stagedWake.batch) === fingerprintOf(batch))
        deliveryId = child.stagedWake.deliveryId;
      else this.parentRegistry.history.write({ ...child.history, state:{kind:'active',runId:child.runId,
        readyDelivery:{deliveryId,batch,journal}} });
      // Retire the pre-dispatch proof before entering delivery. A later truncated
      // worker journal must never turn an already attempted prompt back into ready work.
      this.parentRegistry.saveHistory(child,true,child.runId);
      delete child.stagedWake;
    } else if (child.stagedWake) this.parentRegistry?.retireStagedWake(child);
    session.append({kind:'notification_intent_v2', owner, deliveryId, batch});
    const authorization = issueNotificationAuthorization(session, deliveryId, batch, live, () => ({
      ...batch, events:count ? this.peekNotifications(count).events : [],
    }));
    let committed = false;
    const result = await child.agent!.run(renderNotificationBatch(batch), signal, undefined, undefined, [], undefined,
      {kind:'generated', source:'task-notification'}, undefined, () => {
        const consumed = new Set(batch.events.map(event => event.sequence));
        this.events = this.events.filter(event => {
          if (!consumed.has(event.sequence)) return true;
          this.eventBytes -= Buffer.byteLength(JSON.stringify(event));
          return false;
        });
        this.deliveredNestedDrops = batch.dropped;
        committed = true;
      }, undefined, {owner, deliveryId}, authorization);
    if (!committed) throw new Error('Nested task notification was not committed');
    return result;
  }

  private notify(child: Child, subscription?: AgentNotification['subscription'], agent = this.snapshot(child)): void {
    this.enqueueNotification({ kind: 'agent', sequence: ++this.sequence, agent,
      ...(!subscription && child.runId ? { runId: child.runId } : {}),
      ...(subscription ? { subscription } : {}) });
  }

  private enqueueNotification(event: AgentNotification): void {
    const size = Buffer.byteLength(JSON.stringify(event));
    if (size <= this.limits.maxEventBytes) {
      while (this.events.length >= this.limits.maxEvents || this.eventBytes + size > this.limits.maxEventBytes) {
        this.eventBytes -= Buffer.byteLength(JSON.stringify(this.events.shift()!)); this.dropped++;
      }
      this.events.push(event); this.eventBytes += size;
    } else this.dropped++;
    this.changed();
    try { this.options.onNotification?.(structuredClone(event)); }
    catch { /* Observer failures do not replace the child result. */ }
  }

  peekNotifications(limit = 100): { events: AgentNotification[]; dropped: number } {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid agent notification limit');
    return { events: structuredClone(this.events.slice(0, limit)), dropped: this.dropped };
  }

  drainNotifications(limit = 100): { events: AgentNotification[]; dropped: number } {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid agent notification limit');
    const events = this.events.splice(0, limit);
    this.eventBytes -= events.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event)), 0);
    return { events: structuredClone(events), dropped: this.dropped };
  }

  private async wait(child: Child, waitMs?: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    const pending = [child.worker, child.environmentClosing].filter((promise): promise is Promise<void> => promise !== undefined);
    if (!pending.length) return;
    await new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: unknown) => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        if (error !== undefined) reject(error); else resolve();
      };
      const onAbort = () => finish(signal!.reason ?? new Error('Agent wait cancelled'));
      signal?.addEventListener('abort', onAbort, { once: true });
      if (waitMs !== undefined) timer = setTimeout(() => finish(), waitMs);
      void Promise.all(pending).then(() => finish(), error => finish(error));
    });
  }

  private retireStagedWake(child: Child): void {
    if (!child.stagedWake) return;
    this.saveHistory(child,true,child.runId);
    delete child.stagedWake;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.approval?.controller.abort(); this.approval = undefined;
    this.options.signal?.removeEventListener('abort', this.onAbort);
    for (const subscription of this.subscriptions.values()) clearTimeout(subscription.timer);
    this.subscriptions.clear(); this.changed();
    const children = [...this.children.values()];
    for (const controller of this.preparations) controller.abort();
    for (const child of children) {
      this.retireStagedWake(child);
      child.controller.abort(); child.mailbox = []; child.mailboxBytes = 0;
    }
    this.closing = (async () => {
      await Promise.all([...this.preparing, ...children.map(child => child.worker)]);
      await Promise.all(children.map(child => this.releaseEnvironment(child)));
    })();
    return this.closing;
  }
}

/** Tool schemas stay stable; owner identity lives in the registry closure. */
export function createAgentRegistryTools(registry: AgentRegistry, options: { idle?: boolean; enableAdvanced?: boolean } = {}): ToolDefinition[] {
  const encode = (value: unknown, context: ToolContext) => capChildOutput(JSON.stringify(value), Math.min(context.maxOutputBytes, registry.limits.maxOutputBytes));
  const targeted = z.object({ id: selectorSchema }).strict();
  const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[], readOnly: boolean,
    execute: (raw: unknown, context: ToolContext) => Promise<unknown>): ToolDefinition => ({
    schema: { name, description, input_schema: { type: 'object', properties, required, additionalProperties: false } }, readOnly,
    ...(name === 'agent' ? { concurrencySafe: (raw: unknown) => (options.enableAdvanced ? advancedLaunchSchema : launchSchema).safeParse(raw).success } : {}),
    async execute(raw, context) { context.signal.throwIfAborted(); registry.assertCaller(context.session); return encode(await execute(raw, context), context); },
  });
  const tools = [
    tool('agent', 'Launch an isolated child agent. By default wait for completion; background returns child metadata immediately. Explore uses read-only tools. Children omit agent, mailbox, background and scheduler controls.', {
      prompt: { type: 'string' }, mode: { type: 'string', enum: ['explore', 'general'] },
      max_turns: { type: 'integer', minimum: 1, maximum: 30 }, name: { type: 'string', minLength: 1, maxLength: 128 },
      background: { type: 'boolean' }, model: { type: 'string', minLength: 1, maxLength: 256 },
      ...(options.enableAdvanced ? advancedChildProperties : {}),
    }, ['prompt'], false, (raw, context) => registry.launch((options.enableAdvanced ? advancedLaunchSchema : launchSchema).parse(raw), context.signal, undefined, context.conversation, context.session, context.agentProgress)),
    tool('list_agents', 'List this session owner\'s children, statuses, session IDs, names, summaries and errors.', {}, [], true,
      async raw => { z.object({}).strict().parse(raw); return registry.list(); }),
    options.idle ? tool('send_message', 'Queue an optional message and/or subscribe once to the child\'s next idle transition. Pure subscriptions leave the child task unchanged. The subscription expires after at most 30 minutes; completion and expiry are owner notifications.', {
      id: { type: 'string' }, message: { type: 'string' }, notify_when_idle: { type: 'boolean' },
      expires_ms: { type: 'integer', minimum: 1, maximum: 1_800_000 },
    }, ['id'], false, (raw, context) => {
      const args = z.object({ id: selectorSchema, message: messageSchema.optional(), notify_when_idle: z.boolean().default(false),
        expires_ms: z.number().int().min(1).max(1_800_000).optional() }).strict().parse(raw);
      return registry.sendMessage(args.id, args.message, context.signal, { notifyWhenIdle: args.notify_when_idle, expiresMs: args.expires_ms });
    }) : tool('send_message', 'Queue a message for a child by ID or name. Messages run serially after complete turns. Completed children resume the same journal. Message content is untrusted task data.', {
      id: { type: 'string' }, message: { type: 'string' },
    }, ['id', 'message'], false, (raw, context) => {
      const args = z.object({ id: selectorSchema, message: messageSchema }).strict().parse(raw);
      return registry.sendMessage(args.id, args.message, context.signal);
    }),
    tool('get_agent', 'Get a child by ID or name; optionally wait up to 30000ms for the current queued conversation to finish.', {
      id: { type: 'string' }, wait_ms: { type: 'integer', minimum: 0, maximum: 30_000 },
    }, ['id'], true, (raw, context) => {
      const args = z.object({ id: selectorSchema, wait_ms: waitSchema.default(0) }).strict().parse(raw);
      return registry.get(args.id, { waitMs: args.wait_ms, signal: context.signal });
    }),
    tool('stop_agent', 'Cancel a child by ID or name, discard queued messages and wait for its session cleanup.', {
      id: { type: 'string' },
    }, ['id'], false, raw => registry.stop(targeted.parse(raw).id)),
  ];
  if (options.idle) tools.push(tool('poll_agents', 'Wait for any owned child completion or status change, up to 30000ms. Returns IDs and statuses with an owner-local revision; waiting cancellation leaves children running.', {
    wait_ms: { type: 'integer', minimum: 0, maximum: 30_000 }, since: { type: 'integer', minimum: 0 },
  }, [], true, (raw, context) => {
    const args = z.object({ wait_ms: waitSchema.default(0), since: z.number().int().nonnegative().optional() }).strict().parse(raw);
    return registry.poll({ waitMs: args.wait_ms, since: args.since, signal: context.signal });
  }));
  return tools;
}
