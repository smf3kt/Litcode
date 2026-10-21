import { cloneClassifierMessages } from './message-origin.js';
import { toolNameDenied } from './agent-tool-restrictions.js';
import { refreshPluginComponents } from './skill-catalog.js';
import { z } from 'zod';
import { Agent, assertPaired, type StopRuntimeState } from './agent.js';
import type Anthropic from '@anthropic-ai/sdk';
import type { AgentTypeInfo } from './agent-types.js';
import { Session, type SessionConfig } from './session.js';
import { expandSkill, type SkillInfo } from './config.js';
import type { ModelProvider } from './provider.js';
import { permissionOwner, seedPermissionUpdates } from './permissions.js';
import type { ToolDefinition } from './tools.js';
import { AsyncHookRegistry, type AsyncHookCompletion } from './async-hooks.js';
import type { HookRunOptions } from './hooks.js';

export type ChildHookOptions = {
  hookOptions?: (config: SessionConfig, sessionId: string) => HookRunOptions;
  onHookCompletion?: (sessionId: string, completion: AsyncHookCompletion) => void;
  terminalSequence?: (sessionId: string, sequence: string) => void;
  instructionFiles?: (workspace: string, paths: string[]) => void;
  /** Stop/SubagentStop live background jobs and session cron tasks. */
  stopState?: () => StopRuntimeState;
};

export type ChildEnvironmentLease = {
  config: SessionConfig; tools: ToolDefinition[]; storageRoot?: string;
  close(): Promise<void>;
};
export type ChildEnvironmentFactory = (request: {
  config: SessionConfig; tools: readonly ToolDefinition[]; isolation: 'worktree'; signal: AbortSignal;
}) => Promise<ChildEnvironmentLease>;
export type AdvancedChildOptions = {
  enableAdvanced?: boolean; agentTypes?: readonly AgentTypeInfo[];
  childEnvironmentFactory?: ChildEnvironmentFactory;
};
export type ChildLaunchOptions = {
  mode?: 'explore' | 'general'; max_turns?: number; model?: string;
  subagent_type?: string; effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'; isolation?: 'worktree';
};
export const advancedChildFields = {
  subagent_type: z.string().trim().min(1).max(128).optional(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
  isolation: z.literal('worktree').optional(),
};
export const advancedChildProperties = {
  subagent_type: { type: 'string', minLength: 1, maxLength: 128 },
  effort: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max'] },
  isolation: { type: 'string', enum: ['worktree'] },
};

export function resolveChildLaunch(parent: SessionConfig, raw: ChildLaunchOptions, options: AdvancedChildOptions): {
  mode: 'explore' | 'general'; max_turns: number; model?: string;
  effort?: ChildLaunchOptions['effort']; isolation?: 'worktree'; type?: AgentTypeInfo; fork: boolean;
} {
  refreshPluginComponents(parent);
  if (!options.enableAdvanced && (raw.subagent_type !== undefined || raw.effort !== undefined || raw.isolation !== undefined)) {
    throw new Error('Advanced child options are disabled');
  }
  const fork = raw.subagent_type === 'fork';
  const builtin = raw.subagent_type === 'explore' || raw.subagent_type === 'general';
  const definitions = parent.agentTypes ?? options.agentTypes;
  let type = raw.subagent_type && !fork && !builtin ? definitions?.find(type => type.name === raw.subagent_type) : undefined;
  if (raw.subagent_type && !fork && !builtin && !type) {
    const candidates = definitions?.filter(type => type.aliases?.includes(raw.subagent_type!)) ?? [];
    if (candidates.length > 1) throw new Error(`Ambiguous agent type alias: ${raw.subagent_type}; use a full type name`);
    type = candidates[0];
  }
  if (raw.subagent_type && !fork && !builtin && !type) throw new Error(`Unknown agent type: ${raw.subagent_type}`);
  const model = fork ? undefined : raw.model ?? type?.model;
  const effort = fork ? parent.effort : raw.effort ?? type?.effort;
  return { mode: raw.mode ?? type?.mode ?? (builtin ? raw.subagent_type as 'explore' | 'general' : raw.subagent_type ? 'general' : 'explore'),
    max_turns: raw.max_turns ?? type?.maxTurns ?? 10,
    ...(model && model !== 'inherit' ? { model } : {}),
    ...(effort ? { effort } : {}),
    ...((raw.isolation ?? type?.isolation) ? { isolation: raw.isolation ?? type?.isolation } : {}), type, fork };
}

/**
 * Source preloads an agent's declared skills into the child conversation as
 * meta user messages (chunk-40cepjpq.js, `isSkillPreload`). Each message is the
 * skill's prompt with the command-message/skill-format header the recovered
 * formatter emits; at most 32 names are considered.
 */
export function preloadAgentSkills(type: AgentTypeInfo | undefined, skills: readonly SkillInfo[] | undefined, agentName: string,
  report?: (message: string) => void): Anthropic.MessageParam[] {
  const names = (type?.skills ?? []).slice(0, 32);
  if (names.length === 0) return [];
  const found = new Map<string, SkillInfo>();
  for (const name of names) {
    let skill = skills?.find(candidate => candidate.name === name);
    if (!skill && type?.name.includes(':')) skill = skills?.find(candidate => candidate.name === `${type.name.slice(0, type.name.lastIndexOf(':'))}:${name}`);
    if (!skill) skill = skills?.find(candidate => candidate.name.endsWith(`:${name}`));
    if (!skill) { report?.(`[Agent: ${agentName}] Warning: Skill '${name}' specified in frontmatter was not found`); continue; }
    if (skill.disableModelInvocation || skill.mode === 'user-invocable-only' || skill.mode === 'off') {
      report?.(`[Agent: ${agentName}] Warning: Skill '${name}' is disabled by policy`); continue;
    }
    found.set(name, skill);
  }
  const messages: Anthropic.MessageParam[] = [];
  for (const [name, skill] of found) {
    messages.push({ role: 'user', content: `<command-message>${name}</command-message>\n<command-name>${name}</command-name>\n` +
      `<skill-format>true</skill-format>\n` + expandSkill(skill.body, '', {}) });
  }
  return messages;
}

export function forkMessages(messages: readonly Anthropic.MessageParam[] | undefined, fork: boolean): Anthropic.MessageParam[] {  if (!fork) return [];
  if (!messages) throw new Error('Fork requires a parent conversation snapshot');
  const snapshot = cloneClassifierMessages(messages);
  assertPaired(snapshot);
  // Child system/tools differ from the producing prefix; signed reasoning is conversation-bound.
  for (const message of snapshot) {
    if (!Array.isArray(message.content)) continue;
    const retained = message.content.filter(block => block.type !== 'thinking' && block.type !== 'redacted_thinking');
    message.content = retained.length ? retained : [{ type: 'text', text: '[Prior reasoning omitted in child context]' }];
  }
  assertPaired(snapshot);
  return snapshot;
}

/** Only the trusted runtime factory can rebind tools or choose an isolated root. */
export function validateChildEnvironment(config: SessionConfig, tools: readonly ToolDefinition[], lease: ChildEnvironmentLease): void {
  const { workspace: _workspace, tools: _schemas, ...expected } = config;
  const { workspace: _newWorkspace, tools: _newSchemas, ...actual } = lease.config;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const diff = [...keys].filter(key => JSON.stringify((expected as Record<string, unknown>)[key]) !== JSON.stringify((actual as Record<string, unknown>)[key]));
    throw new Error('Child environment changed inherited configuration: ' + diff.join(','));
  }
  if (tools.length !== lease.tools.length || tools.some((tool, index) => {
    const rebound = lease.tools[index];
    return !rebound || rebound.readOnly !== tool.readOnly || JSON.stringify(rebound.schema) !== JSON.stringify(tool.schema);
  })) throw new Error('Child environment changed permitted tool schemas');
}

/** Async command hooks belong to this open child journal, including shutdown hooks. */
export function createChildHookLifecycle(session: Session, options: ChildHookOptions = {}): {
  hookOptions: HookRunOptions; close(): Promise<void>;
} {
  let journalError: unknown;
  let closing: Promise<void> | undefined;
  const bounded = (text: string) => capChildOutput(text, session.config.maxOutputBytes);
  const hooks = new AsyncHookRegistry({ workspace: session.config.workspace, onResult: completion => {
    const result = completion.result;
    const context = bounded(JSON.stringify({ state: completion.state, additionalContext: result.additionalContext }));
    let recorded = false;
    try {
      session.append({ kind: 'hook_result', id: completion.id, event: `async:${completion.event}`,
        blocked: result.blocked, ...(result.reason ? { reason: bounded(result.reason) } : {}),
        ...(result.stopRequested !== undefined ? { stopRequested: result.stopRequested } : {}), additionalContext: [context],
        ...(result.terminalSequences?.length ? { terminalSequences: result.terminalSequences } : {}) });
      recorded = true;
    } catch (error) { journalError ??= error; }
    if (recorded) for (const sequence of result.terminalSequences ?? []) {
      try { options.terminalSequence?.(session.id, sequence); } catch { /* Observer owns its failures. */ }
    }
    try { options.onHookCompletion?.(session.id, completion); } catch { /* Observer owns its failures. */ }
  } });
  try {
    const supplied = options.hookOptions?.(session.config, session.id) ?? {};
    return {
      hookOptions: { ...supplied, startAsyncCommand: async request => {
        const id = request.handle ? await hooks.adopt(request, request.handle, `async_hook_${request.handle.pid ?? ''}`) : await hooks.start(request);
        session.append({ kind: 'hook_start', id, event: `async:${request.event}`,
          ...(typeof request.payload.tool_use_id === 'string' ? { toolUseId: request.payload.tool_use_id } : {}) });
        return id;
      } },
      close() {
        if (closing) return closing;
        closing = (async () => {
          // Let short commands finish; cancel remaining groups after bounded settlement.
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([Promise.all(hooks.list().map(job => hooks.wait(job.id))),
              new Promise<void>(resolve => { timer = setTimeout(resolve, 200); })]);
          } finally {
            if (timer) clearTimeout(timer);
            await hooks.close();
          }
          if (journalError) throw journalError;
        })();
        return closing;
      },
    };
  } catch (error) { void hooks.close(); throw error; }
}

const PARENT_CONTROLS = new Set(['agent', 'list_agents', 'send_message', 'get_agent', 'stop_agent', 'poll_agents',
  'run_background', 'monitor', 'get_background_task', 'task_stop', 'read_notifications',
  'cron_create', 'cron_delete', 'cron_list', 'schedule_wakeup', 'workflow_run', 'workflow_get']);

export function selectChildTools(tools: readonly ToolDefinition[], mode: 'explore' | 'general', allowedTools?: readonly string[]): ToolDefinition[] {
  return tools.map(tool => tool.forChild?.() ?? tool)
    .filter(tool => !PARENT_CONTROLS.has(tool.schema.name) && (mode !== 'explore' || tool.readOnly) &&
      (allowedTools === undefined || allowedTools.includes(tool.schema.name)));
}

export function childConfig(config: SessionConfig, tools: ToolDefinition[], options: {
  mode: 'explore' | 'general'; max_turns: number; model?: string; effort?: ChildLaunchOptions['effort']; type?: AgentTypeInfo; fork?: boolean; isolation?: 'worktree';
}): SessionConfig {
  const child: SessionConfig = { ...structuredClone(config), maxTurns: options.max_turns, childMode: options.mode,
    ...(options.model ? { model: options.model } : {}),
    ...(options.effort ? { effort: options.effort } : {}),
    allowShell: options.mode === 'general' && config.allowShell,
    tools: tools.map(tool => ({ ...tool.schema, eager_input_streaming: true })),
    system: config.system + '\nYou are a child agent assigned a focused task. Return findings, changed paths, verification and remaining issues. Do not launch recursive agents.',
  };
  if (options.type?.body) child.system += '\n\nAgent instructions:\n' + options.type.body;
  if (child.features) {
    child.features = { ...child.features, subagents: false,
      ...(child.features.background !== undefined ? { background: false } : {}),
      ...(child.features.scheduler !== undefined ? { scheduler: false } : {}),
    };
    // Preserve absent flags for journals created before agent messaging existed.
    if ('agentMessaging' in child.features) Object.assign(child.features, { agentMessaging: false });
    if (options.fork || options.type || options.isolation) {
      if ('agentIdle' in child.features) child.features.agentIdle = false;
      if ('workflow' in child.features) child.features.workflow = false;
    }
  }
  return child;
}

/** A strict byte cap includes the truncation marker and preserves UTF-8 boundaries. */
export function capChildOutput(text: string, maxBytes: number): string {
  const bytes = Buffer.from(text);
  const limit = Math.max(0, Math.floor(maxBytes));
  if (bytes.length <= limit) return text;
  const marker = '\n[Child output truncated; full response is in the child journal]';
  const suffix = Buffer.byteLength(marker) <= limit ? marker : '';
  let end = Math.min(bytes.length, limit - Buffer.byteLength(suffix));
  while (end > 0 && end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString('utf8') + suffix;
}

export function createSubagentTool(source: SessionConfig | (() => SessionConfig), provider: ModelProvider, tools: ToolDefinition[], options: ChildHookOptions & AdvancedChildOptions = {}): ToolDefinition {
  const input = z.object({ prompt: z.string().min(1), mode: z.enum(['explore', 'general']).optional(), max_turns: z.number().int().min(1).max(30).optional(),
    ...(options.enableAdvanced ? advancedChildFields : {}) }).strict();
  return {
    schema: { name: 'agent', description: 'Run an isolated child conversation on a focused task. Explore uses only read-only tools; general may edit the shared workspace. Returns a summary and child session ID. Children cannot launch further agents.',
      input_schema: { type: 'object', properties: { prompt: { type: 'string' }, mode: { type: 'string', enum: ['explore', 'general'] }, max_turns: { type: 'integer', minimum: 1, maximum: 30 }, ...(options.enableAdvanced ? advancedChildProperties : {}) }, required: ['prompt'], additionalProperties: false } },
    readOnly: false,
    async execute(raw, context) {
      context.signal.throwIfAborted();
      const args = input.parse(raw);
      const config = typeof source === 'function' ? source() : source;
      const launch = resolveChildLaunch(config, args as ChildLaunchOptions, options);
      const messages = forkMessages(context.conversation, launch.fork);
      let selected = selectChildTools(tools, launch.mode, launch.type?.tools)
        .filter(tool => !toolNameDenied(tool.schema.name, launch.type?.disallowedTools ?? []));
      let child = childConfig(config, selected, launch);
      // Source preloads the declared skills as meta user messages before the
      // first child turn; the prompt itself is unaffected.
      const preloads = launch.type ? preloadAgentSkills(launch.type, config.skills, launch.type.name) : [];
      let environment: ChildEnvironmentLease | undefined;
      let session: Session | undefined;
      let agent: Agent | undefined;
      let hooks: ReturnType<typeof createChildHookLifecycle> | undefined;
      let output: { session_id: string; reason: string; text: string; model_calls: number; workspace?: string; cleanup_error?: string } | undefined;
      let failure: unknown;
      let failed = false;
      try {
        if (launch.isolation) {
          if (!options.childEnvironmentFactory) throw new Error('Child worktree environment is unavailable');
          environment = await options.childEnvironmentFactory({ config: child, tools: selected, isolation: launch.isolation, signal: context.signal });
          validateChildEnvironment(child, selected, environment);
          child = { ...child, workspace: environment.config.workspace }; selected = environment.tools;
        }
        context.signal.throwIfAborted();
        session = Session.open(child.workspace, { config: child, ...(environment?.storageRoot ? { storageRoot: environment.storageRoot } : {}) });
        // yn, 40cep [123604,125280), UTF-16. Read the current parent on each decision.
        const sourceOwner = () => permissionOwner((typeof source === 'function' ? source() : source).permissions);
        session.inheritPermissions({
          prepareAutoMode: () => sourceOwner()?.prepareAutoMode?.(),
          get adoptUpdates() { return sourceOwner()?.adoptUpdates; },
          state: () => {
            const parent = typeof source === 'function' ? source() : source;
            const state = permissionOwner(parent.permissions)?.state() ?? seedPermissionUpdates(parent.permissions,
              parent.workspace, parent.configSources?.userDir);
            return { ...state, mode: state.mode ?? parent.permissions?.mode };
          },
          workingDirectories: readOnly => {
            const parent = typeof source === 'function' ? source() : source;
            return permissionOwner(parent.permissions)?.workingDirectories(readOnly) ?? [];
          },
        });
        for (const message of messages) session.append({ kind: 'message', message });
        for (const message of preloads) session.append({ kind: 'message', message, isMeta: true });
        if (launch.fork && messages.length) session.append({ kind: 'turn_end', reason: 'fork_seed' });
        hooks = createChildHookLifecycle(session, options);
        agent = new Agent(session, provider, selected, { hookOptions: hooks.hookOptions,
          ...(options.instructionFiles ? { instructionFiles: paths => options.instructionFiles!(session!.config.workspace, paths) } : {}),
          ...(options.terminalSequence ? { terminalSequence: sequence => options.terminalSequence!(session!.id, sequence) } : {}),
          ...(options.stopState ? { stopState: options.stopState } : {}) });
        await agent.startSession(launch.fork ? 'fork' : 'startup', context.signal);
        const result = await agent.run(args.prompt, context.signal, undefined, undefined, [], undefined, { kind: 'child', source: 'agent' });
        output = { session_id: session.id, reason: result.reason, text: result.text, model_calls: result.modelCalls,
          ...(options.enableAdvanced ? { workspace: child.workspace } : {}) };
      } catch (error) { failure = error; failed = true; }
      finally {
        try { await agent?.endSession(context.signal.aborted ? 'interrupt' : 'other'); }
        catch { /* Shutdown diagnostics must not replace the child result. */ }
        try { await hooks?.close(); }
        catch (error) { if (!failed) { failure = error; failed = true; } }
        try { session?.close(); }
        catch (error) { if (!failed) { failure = error; failed = true; } }
        try { await environment?.close(); }
        catch (error) {
          const cleanup = `${child.workspace}: ${error instanceof Error ? error.message : String(error)}`;
          if (failed) failure = new AggregateError([failure, error], `Child execution and cleanup failed at ${child.workspace}`);
          else if (output) output.cleanup_error = capChildOutput(cleanup, context.maxOutputBytes);
          else { failure = error; failed = true; }
        }
      }
      if (failed) throw failure;
      return capChildOutput(JSON.stringify(output), context.maxOutputBytes);
    },
  };
}
