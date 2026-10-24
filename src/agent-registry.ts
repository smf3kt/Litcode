import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Agent } from './agent.js';
import { Session, fingerprint, type SessionConfig } from './session.js';
import type { ModelProvider } from './provider.js';
import type { ToolContext, ToolDefinition } from './tools.js';
import { permissionDecision, permissionOwner, seedPermissionUpdates, effectivePermissionPolicy, type LivePermissionOwner } from './permissions.js';
import { CLAMPED_SHELL_TOOLS, normalizeBashCommandClamp, normalizeDisallowedTools, toolNameDenied,
  validateDisallowedTools } from './agent-tool-restrictions.js';
import { capChildOutput, childConfig, selectChildTools, createChildHookLifecycle, advancedChildFields, advancedChildProperties,
  resolveChildLaunch, forkMessages, preloadAgentSkills, validateChildEnvironment, type ChildHookOptions, type AdvancedChildOptions,
  type ChildEnvironmentLease, type ChildLaunchOptions } from './subagents.js';
import { scrubSubagentOutput } from './subagent-output-scrub.js';
import type Anthropic from '@anthropic-ai/sdk';
import { createAgentProgress, agentProgressSnapshot, observeAgentResponse, observeAgentStream,
  type AgentProgressTracker } from './agent-progress.js';
import type { AgentTaskDetail } from './agent-details.js';
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
export type AgentNotification = { kind: 'agent'; sequence: number; agent: AgentDescriptor;
  subscription?: { id: string; state: 'idle' | 'expired' } };
export type AgentPollResult = { revision: number; changed: boolean; agents: { id: string; status: AgentStatus }[] };
export type AgentIdleSubscription = { id: string; agent_id: string; expires_ms: number };
export type AgentRegistryLimits = {
  maxConcurrency: number; maxHistory: number; maxMailboxCount: number; maxMailboxBytes: number;
  maxMessageBytes: number; maxAgentMessages: number; maxJournalEvents: number; maxJournalBytes: number;
  maxOutputBytes: number; maxEvents: number; maxEventBytes: number;
  maxIdleSubscriptions: number; maxPollWaiters: number;
};
export type AgentRegistryOptions = ChildHookOptions & AdvancedChildOptions & {
  source: SessionConfig | (() => SessionConfig); provider: ModelProvider; tools: ToolDefinition[];
  signal?: AbortSignal; onNotification?: (event: AgentNotification) => void;
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

type Child = {
  view: AgentDescriptor; config: SessionConfig; tools: ToolDefinition[]; controller: AbortController;
  mailbox: string[]; mailboxBytes: number; accepted: number; session?: Session;
  agent?: Agent; hooks?: ReturnType<typeof createChildHookLifecycle>;
  worker?: Promise<void>; journalEvents: number; journalBytes: number;
  environment?: ChildEnvironmentLease; environmentClosing?: Promise<void>; fork?: boolean;
  structured?: StructuredOutputState;
  liveOwner: LivePermissionOwner; adoptionOnly: boolean;
  prompt: string; startedAt: number; endedAt?: number; progress: AgentProgressTracker; streamedChars: number;
};

/** One instance belongs to one parent session; selectors never resolve outside it. */
export class AgentRegistry {
  readonly limits: AgentRegistryLimits;
  private children = new Map<string, Child>();
  private events: AgentNotification[] = [];
  private eventBytes = 0;
  private dropped = 0;
  private sequence = 0;
  private revision = 0;
  private changes = new Set<() => void>();
  private subscriptions = new Map<string, { subscription: AgentIdleSubscription; child: Child; timer: ReturnType<typeof setTimeout> }>();
  private active = 0;
  private preparing = new Set<Promise<void>>();
  private preparations = new Set<AbortController>();
  private reservedNames = new Set<string>();
  private closed = false;
  private closing?: Promise<void>;
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

  private assertOpen(signal?: AbortSignal): void {
    signal?.throwIfAborted();
    if (this.closed || this.options.signal?.aborted) throw new Error('Agent registry is closed');
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

  private changed(): void {
    this.revision++;
    for (const listener of [...this.changes]) listener();
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

  private async trimHistory(): Promise<void> {
    const finished = [...this.children.values()].filter(child => !child.worker && terminal(child.view.status));
    while (finished.length > this.limits.maxHistory) {
      const old = finished.shift()!;
      this.children.delete(old.view.id); this.changed();
      await this.releaseEnvironment(old);
      if (old.view.cleanup_error) this.notify(old);
    }
  }

  private capacity(): void {
    if (this.active >= this.limits.maxConcurrency) throw new Error('Child agent concurrency limit reached');
  }

  private enqueue(child: Child, message: string): void {
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
    child.mailbox.push(message); child.mailboxBytes += bytes; child.accepted++;
  }

  // dne/iCn, sfn1dbxq [4233793,4234807)/[4219665,4219883), UTF-16: retain launch data and progress.
  async launch(raw: AgentLaunch, callerSignal?: AbortSignal, execution?: {
    config: SessionConfig; tools: ToolDefinition[]; conversation?: readonly Anthropic.MessageParam[];
    beforeTool?: (tool: ToolDefinition, input: unknown, signal: AbortSignal) => Promise<void>;
    permissionOwner?: LivePermissionOwner;
  }, conversation?: readonly Anthropic.MessageParam[]): Promise<AgentDescriptor> {
    this.assertOpen(callerSignal);
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
    const parent = this.source();
    let supplied = this.options.tools;
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
    const sourceOwner = () => permissionOwner(this.source().permissions);
    const liveOwner: LivePermissionOwner = execution?.permissionOwner ?? {
      prepareAutoMode: () => permissionOwner(this.source().permissions)?.prepareAutoMode?.(),
      get adoptUpdates() { return sourceOwner()?.adoptUpdates; },
      state: () => {
        const source = this.source();
        const state = permissionOwner(source.permissions)?.state() ?? seedPermissionUpdates(source.permissions,
          source.workspace, source.configSources?.userDir);
        return { ...state, mode: state.mode ?? source.permissions?.mode };
      },
      workingDirectories: readOnly => permissionOwner(this.source().permissions)?.workingDirectories(readOnly) ?? [],
    };
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
    if (bashCommandClamp !== undefined) config = { ...config, bashCommandClamp };
    if (stallMs !== undefined) config = { ...config, stallMs };
    if (structuredState !== undefined) config = { ...config, system: config.system + STRUCTURED_OUTPUT_SYSTEM_NOTE };
    const controller = new AbortController();
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
    if (callerSignal?.aborted) onCallerAbort();
    this.active++;
    if (args.name) this.reservedNames.add(args.name);
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
        config = { ...config, workspace: environment.config.workspace }; selected = environment.tools;
      }
      this.assertOpen(controller.signal);
      const tools = selected.map(tool => {
        if (!execution) return tool;
        const authorize = async (input: unknown, context: ToolContext): Promise<ToolContext> => {
          context.signal.throwIfAborted();
          const decision = permissionDecision(execution.permissionOwner ? scopedPolicy() : parentPolicy(), tool, input);
          const scopedDecision = permissionDecision(scopedPolicy(), tool, input);
          if (scopedDecision.decision === 'deny') throw new Error(scopedDecision.reason ?? 'Child permission denied tool');
          if (decision.decision === 'deny') throw new Error(decision.reason ?? 'Parent permission denied child tool');
          if ((decision.decision === 'ask' || scopedDecision.decision === 'ask') && !beforeTool) {
            throw new Error(decision.reason ?? scopedDecision.reason ?? 'Parent permission requires approval');
          }
          await beforeTool?.(tool, input, context.signal);
          context.signal.throwIfAborted();
          return { ...context, ...(liveOwner ? { workingDirectories: liveOwner.workingDirectories } : {}), workspace: config.workspace, allowShell: context.allowShell && allowShell };
        };
        return { ...tool,
          async execute(input: unknown, context: ToolContext) { return tool.execute(input, await authorize(input, context)); },
          ...(tool.executeBlocks ? { async executeBlocks(input: unknown, context: ToolContext) {
            return tool.executeBlocks!(input, await authorize(input, context));
          } } : {}),
        };
      });
      const metadataBytes = Buffer.byteLength(JSON.stringify({ kind: 'metadata', version: 1,
        id: '00000000-0000-4000-8000-000000000000', config, fingerprint: fingerprint(config) })) + 1;
      // Declared agent skills ride as meta user messages before the first turn
      // (source `isSkillPreload`, chunk-40cepjpq.js offset 3259458).
      const preloads = launch.type ? preloadAgentSkills(launch.type, parent.skills, launch.type.name) : [];
      const seedBytes = messages.reduce((sum, message) => sum + Buffer.byteLength(JSON.stringify({ kind: 'message', message })) + 1, 0)
        + preloads.reduce((sum, message) => sum + Buffer.byteLength(JSON.stringify({ kind: 'message', message, isMeta: true })) + 1, 0);
      const seedBoundaryBytes = seededFork && messages.length ? Buffer.byteLength(JSON.stringify({ kind: 'turn_end', reason: 'fork_seed' })) + 1 : 0;
      if (metadataBytes + seedBytes + seedBoundaryBytes + 128 > this.limits.maxJournalBytes || messages.length + (seedBoundaryBytes ? 2 : 1) >= this.limits.maxJournalEvents) throw new Error('Child journal limit reached');
      session = Session.open(config.workspace, { config, ...(environment?.storageRoot ? { storageRoot: environment.storageRoot } : {}) });
      if (execution?.beforeTool) session.inheritPermissionAdoption(liveOwner);
      else session.inheritPermissions(liveOwner);
      for (const message of messages) session.append({ kind: 'message', message });
      for (const message of preloads) session.append({ kind: 'message', message, isMeta: true });
      if (seededFork && messages.length) session.append({ kind: 'turn_end', reason: 'fork_seed' });
      hooks = createChildHookLifecycle(session, this.options);
      const childId = session.id;
      const agent = new Agent(session, this.options.provider, tools, { hookOptions: hooks.hookOptions,
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
        view: { id: session.id, session_id: session.id, name: args.name ?? null, status: 'queued',
          mode: launch.mode, model: config.model, summary: '', error: null, reason: null, model_calls: 0, queued_messages: 0,
          ...(this.options.enableAdvanced ? { workspace: config.workspace, ...(args.subagent_type ? { subagent_type: args.subagent_type } : {}) } : {}) },
        config: session.config, tools, controller, mailbox: [], mailboxBytes: 0, liveOwner, adoptionOnly: execution?.beforeTool !== undefined,
        prompt: args.prompt, startedAt: Date.now(), progress: createAgentProgress(), streamedChars: 0,
        accepted: 0, session, agent, hooks, journalEvents: session.events.length, journalBytes: metadataBytes + seedBytes + seedBoundaryBytes,
        ...(structuredState ? { structured: structuredState } : {}),
        ...(environment ? { environment } : {}), fork: seededFork,
      };
      this.enqueue(child, args.prompt);
      this.children.set(session.id, child);
      this.start(child, true); started = true; this.changed();
    } catch (error) {
      try { await hooks?.close(); }
      finally {
        try { session?.close(); }
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
      if (!started) this.active--;
      this.preparing.delete(preparation); finishPreparation();
    }
    if (!args.background) await this.wait(child!, undefined, callerSignal);
    return this.snapshot(child!);
  }

  async sendMessage(selector: string, message?: string, callerSignal?: AbortSignal, options: {
    notifyWhenIdle?: boolean; expiresMs?: number;
  } = {}): Promise<AgentDescriptor> {
    this.assertOpen(callerSignal);
    const child = this.resolve(selector);
    const notifyWhenIdle = z.boolean().parse(options.notifyWhenIdle ?? false);
    const expiresMs = z.number().int().min(1).max(1_800_000).parse(options.expiresMs ?? 300_000);
    if (message === undefined && !notifyWhenIdle) throw new Error('Message or idle subscription is required');
    if (notifyWhenIdle && this.subscriptions.size >= this.limits.maxIdleSubscriptions) throw new Error('Agent idle subscription limit reached');
    if (message !== undefined) {
      if (child.controller.signal.aborted || child.view.status === 'failed') throw new Error(`Child agent is ${child.view.status}`);
      if (!child.worker) this.capacity();
      this.enqueue(child, message);
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
    child.controller.abort();
    child.mailbox = []; child.mailboxBytes = 0;
    if (child.worker) await child.worker;
    else { child.view.status = 'cancelled'; child.endedAt = Date.now(); this.notify(child); this.deliverIdle(child); }
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

  // IX, 40cepjpq [107910,110110), UTF-16: observe only newly committed assistant responses.
  private boundJournal(child: Child): void {
    const session = child.session!;
    child.journalEvents = session.events.length;
    child.journalBytes = session.events.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event)) + 1, 0);
    if (child.journalEvents > this.limits.maxJournalEvents || child.journalBytes > this.limits.maxJournalBytes) {
      throw new Error('Child journal limit reached');
    }
    const append = session.append.bind(session);
    session.append = event => {
      const bytes = Buffer.byteLength(JSON.stringify(event)) + 1;
      // Reserve one record and enough bytes to commit a failed turn boundary.
      const boundary = event.kind === 'turn_end';
      if (child.journalEvents + 1 > this.limits.maxJournalEvents - (boundary ? 0 : 1) ||
          child.journalBytes + bytes > this.limits.maxJournalBytes - (boundary ? 0 : 128)) {
        throw new Error('Child journal limit reached');
      }
      append(event);
      child.journalEvents++; child.journalBytes += bytes;
      if (event.kind === 'message' && event.response !== undefined) {
        child.progress.streamedTokenEstimate = child.progress.streamedTokenEstimateAtResponseStart;
        observeAgentResponse(child.progress, event.response);
        child.streamedChars = 0;
      }
    };
  }

  // IX, 40cepjpq [104577,115399); iYr/nsr, sfn1dbxq [4232306,4233793), UTF-16: owned run and terminal time.
  private async run(child: Child): Promise<void> {
    const signal = child.controller.signal;
    try {
      signal.throwIfAborted();
      const resumed = !child.session;
      if (resumed) {
        child.session = Session.open(child.config.workspace, { id: child.view.session_id, config: child.config,
          ...(child.environment?.storageRoot ? { storageRoot: child.environment.storageRoot } : {}) });
        if (child.adoptionOnly) child.session.inheritPermissionAdoption(child.liveOwner);
        else child.session.inheritPermissions(child.liveOwner);
        child.hooks = createChildHookLifecycle(child.session, this.options);
        const childId = child.session.id;
        child.agent = new Agent(child.session, this.options.provider, child.tools, { hookOptions: child.hooks.hookOptions,
          textStart: () => this.beginResponse(child), text: text => this.streamResponse(child, text),
          interruptTurn: () => child.controller.abort(new Error('Hook interrupt')),
          ...(child.structured ? { requiredTool: STRUCTURED_OUTPUT_TOOL_NAME } : {}),
          ...(this.options.instructionFiles ? { instructionFiles: paths => this.options.instructionFiles!(child.config.workspace, paths) } : {}),
          ...(this.options.terminalSequence ? { terminalSequence: sequence => this.options.terminalSequence!(childId, sequence) } : {}),
          ...(this.options.stopState ? { stopState: this.options.stopState } : {}) });
      }
      this.boundJournal(child);
      delete child.endedAt;
      child.view.status = 'running'; this.changed();
      await child.agent!.startSession(resumed ? 'resume' : child.fork ? 'fork' : 'startup', signal);
      while (child.mailbox.length) {
        signal.throwIfAborted();
        const prompt = child.mailbox.shift()!;
        child.mailboxBytes -= Buffer.byteLength(prompt);
        const result = await child.agent!.run(prompt, signal, undefined, undefined, [], undefined, { kind: 'peer', source: 'mailbox' });
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
      child.view.status = signal.aborted ? 'cancelled' : 'completed';
    } catch (error) {
      child.view.status = signal.aborted ? 'cancelled' : 'failed';
      child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
      // Failed provider/hook calls still delimit the attempted turn in the journal.
      if (child.session?.awaitingResponse) {
        try { child.session.append({ kind: 'turn_end', reason: signal.aborted ? 'aborted' : 'agent_error' }); }
        catch { /* Preserve the original failure if the journal itself failed. */ }
      }
    } finally {
      child.mailbox = []; child.mailboxBytes = 0;
      try { await child.agent?.endSession(signal.aborted ? 'interrupt' : 'other'); }
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
          try { child.session?.close(); }
          catch (error) {
            child.view.status = 'failed';
            child.view.error = field(error instanceof Error ? error.message : String(error), this.limits.maxOutputBytes);
          }
          child.session = undefined; child.agent = undefined; child.hooks = undefined;
        }
      }
      child.endedAt = Date.now();
      this.notify(child);
    }
  }

  private notify(child: Child, subscription?: AgentNotification['subscription'], agent = this.snapshot(child)): void {
    this.changed();
    const event: AgentNotification = { kind: 'agent', sequence: ++this.sequence, agent,
      ...(subscription ? { subscription } : {}) };
    const size = Buffer.byteLength(JSON.stringify(event));
    if (size <= this.limits.maxEventBytes) {
      while (this.events.length >= this.limits.maxEvents || this.eventBytes + size > this.limits.maxEventBytes) {
        this.eventBytes -= Buffer.byteLength(JSON.stringify(this.events.shift()!)); this.dropped++;
      }
      this.events.push(event); this.eventBytes += size;
    } else this.dropped++;
    try { this.options.onNotification?.(structuredClone(event)); }
    catch { /* Observer failures do not replace the child result. */ }
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

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closed = true;
    this.options.signal?.removeEventListener('abort', this.onAbort);
    for (const subscription of this.subscriptions.values()) clearTimeout(subscription.timer);
    this.subscriptions.clear(); this.changed();
    const children = [...this.children.values()];
    for (const controller of this.preparations) controller.abort();
    for (const child of children) {
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
    async execute(raw, context) { context.signal.throwIfAborted(); return encode(await execute(raw, context), context); },
  });
  const tools = [
    tool('agent', 'Launch an isolated child agent. By default wait for completion; background returns child metadata immediately. Explore uses read-only tools. Children omit agent, mailbox, background and scheduler controls.', {
      prompt: { type: 'string' }, mode: { type: 'string', enum: ['explore', 'general'] },
      max_turns: { type: 'integer', minimum: 1, maximum: 30 }, name: { type: 'string', minLength: 1, maxLength: 128 },
      background: { type: 'boolean' }, model: { type: 'string', minLength: 1, maxLength: 256 },
      ...(options.enableAdvanced ? advancedChildProperties : {}),
    }, ['prompt'], false, (raw, context) => registry.launch((options.enableAdvanced ? advancedLaunchSchema : launchSchema).parse(raw), context.signal, undefined, context.conversation)),
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
