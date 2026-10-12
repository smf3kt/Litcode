import { spawn } from 'node:child_process';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent } from './agent.js';
import type { AgentRegistry } from './agent-registry.js';
import { expandSkill, type SkillInfo } from './config.js';
import { HOOK_EVENTS, flattenHookDefinitions, hooksSchema, type HooksConfig } from './hooks.js';
import { permissionDecision, type PermissionDecision } from './permissions.js';
import type { ModelProvider } from './provider.js';
import { Session, type SessionConfig } from './session.js';
import { capChildOutput, childConfig, createChildHookLifecycle, forkMessages, selectChildTools, resolveChildLaunch, type ChildHookOptions } from './subagents.js';
import type { ToolDefinition } from './tools.js';

export interface SkillExecutionOptions {
  config: SessionConfig;
  provider: ModelProvider;
  tools: ToolDefinition[];
  signal: AbortSignal;
  source: 'user' | 'model';
  onText?: (text: string) => void;
  registry?: AgentRegistry;
  conversation?: readonly Anthropic.MessageParam[];
  requestPermission?: (tool: ToolDefinition, input: unknown, decision: PermissionDecision) => Promise<PermissionDecision>;
  timeoutMs?: number;
  hookOptions?: ChildHookOptions['hookOptions'];
  terminalSequence?: ChildHookOptions['terminalSequence'];
  instructionFiles?: ChildHookOptions['instructionFiles'];
}

function skillConversation(skill: SkillInfo, options: SkillExecutionOptions): Anthropic.MessageParam[] | undefined {
  if (skill.context !== 'fork' || options.conversation === undefined) return undefined;
  if (Buffer.byteLength(JSON.stringify(options.conversation)) > 8 * 1024 * 1024) throw new Error('Skill fork conversation byte limit exceeded');
  return forkMessages(options.conversation, true);
}

function checkConversationBudget(messages: Anthropic.MessageParam[] | undefined, body: string, config: SessionConfig): void {
  if (messages === undefined) return;
  // Count serialized bytes as tokens to reserve conservatively without a provider call.
  const bytes = Buffer.byteLength(JSON.stringify({ system: config.system, tools: config.tools,
    messages: [...messages, { role: 'user', content: body }] }));
  if (bytes + 512 > config.contextTokens - config.maxTokens) throw new Error('Skill fork conversation context budget exceeded');
}

function wildcard(pattern: string, value: string): boolean {
  let p = 0; let v = 0; let star = -1; let retry = 0;
  while (v < value.length) {
    if (pattern[p] === '*') { star = p++; retry = v; }
    else if (pattern[p] === value[v]) { p++; v++; }
    else if (star >= 0) { p = star + 1; v = ++retry; }
    else return false;
  }
  while (pattern[p] === '*') p++;
  return p === pattern.length;
}

function grant(skill: SkillInfo, tool: ToolDefinition, input?: unknown): boolean {
  if (skill.allowedTools === undefined) return true;
  const name = tool.schema.name;
  return skill.allowedTools.some(rule => {
    const match = /^([^()]+)\((.*)\)$/.exec(rule);
    if (!match) return wildcard(rule, name) || (rule === 'Bash' && name === 'run_command');
    if (!wildcard(match[1]!, name) && !(match[1] === 'Bash' && name === 'run_command')) return false;
    if (input === undefined) return true;
    const command = typeof input === 'object' && input !== null ? Object.getOwnPropertyDescriptor(input, 'command')?.value : undefined;
    return typeof command === 'string' && wildcard(match[2]!, command);
  });
}

async function approve(tool: ToolDefinition, input: unknown, options: SkillExecutionOptions, explicit = false): Promise<void> {
  options.signal.throwIfAborted();
  if ((tool.schema.name === 'run_command') && !options.config.allowShell) throw new Error('Skill shell access is disabled');
  let decision = permissionDecision(options.config.permissions, tool, input);
  if (explicit && !options.config.permissions) decision = { decision: 'ask', reason: 'Skill command requires explicit invocation approval' };
  if (decision.decision === 'ask' && options.requestPermission) decision = await options.requestPermission(tool, input, decision);
  options.signal.throwIfAborted();
  if (decision.decision !== 'allow') throw new Error(decision.reason ?? `Skill permission ${decision.decision}: ${tool.schema.name}`);
}

const commandTool: ToolDefinition = {
  schema: { name: 'run_command', description: 'Skill invocation command', input_schema: { type: 'object', properties: { command: { type: 'string' } } } },
  readOnly: false,
  async execute() { throw new Error('Invocation command descriptor is permission-only'); },
};

/** Commands use an owned process group and a bounded output window. */
async function shellOutput(command: string, shell: string, options: SkillExecutionOptions): Promise<string> {
  options.signal.throwIfAborted();
  const timeout = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120_000) throw new Error('Skill timeout must be between 1 and 120000ms');
  return new Promise((resolve, reject) => {
    const child = spawn(shell, ['-c', command], { cwd: options.config.workspace, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let finished = false; let failure: Error | undefined; let timer: ReturnType<typeof setTimeout>; let grace: ReturnType<typeof setTimeout> | undefined;
    const chunks: Buffer[] = []; let bytes = 0;
    const kill = () => {
      try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); }
      catch { try { child.kill('SIGKILL'); } catch { /* Already reaped. */ } }
    };
    const settle = (code?: number | null) => {
      if (finished) return;
      finished = true; clearTimeout(timer); if (grace) clearTimeout(grace);
      options.signal.removeEventListener('abort', abort);
      child.stdout?.destroy(); child.stderr?.destroy();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Skill command exited with ${code ?? 'signal'}: ${Buffer.concat(chunks).toString('utf8')}`));
      else resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const abort = () => { failure = new Error('Skill command aborted'); kill(); };
    const append = (chunk: Buffer) => {
      if (failure) return;
      if (bytes + chunk.length > options.config.maxOutputBytes) { failure = new Error('Skill command output byte limit exceeded'); kill(); return; }
      chunks.push(chunk); bytes += chunk.length;
    };
    timer = setTimeout(() => { failure = new Error(`Skill command timed out after ${timeout}ms`); kill(); }, timeout);
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
    child.stdout?.on('data', append); child.stderr?.on('data', append);
    child.once('error', error => { failure = error; settle(); });
    child.once('exit', code => { kill(); grace = setTimeout(() => settle(code), 200); });
    child.once('close', code => settle(code));
  });
}

/** The recovered normalization for an extracted command: trim, CRLF to LF. */
const normalizeCommand = (text: string) => text.trim().replaceAll('\r\n', '\n');

/** One authored shell directive: the raw span to replace and the command to run. */
type SkillCommand = { raw: string; command: string; at: number };

/**
 * Recovered: an authored body carries shell in two forms, both extracted from
 * the authored text before any substitution and both replaced by the command's
 * output: a fenced ```! block, and an inline `!`cmd`` span. Spans inside an
 * extracted block belong to that block and are skipped so a block never runs
 * twice, and both forms are executed in document order. This runtime keeps its
 * wider inline match (a span also counts mid-word, e.g. `value=!`cmd``), which
 * is a superset of the recovered line-start-or-whitespace boundary.
 */
function skillCommands(body: string): SkillCommand[] {
  const found: SkillCommand[] = [];
  for (const match of body.matchAll(/```!\s*\n?([\s\S]*?)\n?```/g)) {
    found.push({ raw: match[0], command: normalizeCommand(match[1]!), at: match.index! });
  }
  for (const match of body.matchAll(/!`([^`]+)`/g)) {
    const at = match.index!;
    if (found.some(entry => at >= entry.at && at < entry.at + entry.raw.length)) continue;
    found.push({ raw: match[0], command: normalizeCommand(match[1]!), at });
  }
  return found.sort((left, right) => left.at - right.at);
}

async function expandedBody(skill: SkillInfo, args: string, options: SkillExecutionOptions): Promise<string> {
  const body = skill.body;
  const expansion = { quotedArguments: options.config.features?.skillQuotedArguments === true,
    extendedArguments: options.config.features?.skillExtendedArguments === true, argumentNames: skill.argumentNames };
  const expand = (text: string) => expandSkill(text, args, expansion);
  const expanded = expand(body);
  const withArguments = expandSkill(body, args, { ...expansion,
    appendUnusedArguments: options.config.features?.skillArgumentFallback === true });
  // Identify authored directives before substitution; argument/output text never
  // introduces a second command-expansion pass.
  const commands = skillCommands(body);
  if (!commands.length || (skill.shell === undefined && skill.command === undefined && options.config.features?.skillInlineCommands !== true)) return withArguments;
  const shell = skill.shell ?? '/bin/sh';
  // Preflight every command before any side effect, including later denied commands.
  for (const entry of commands) {
    const command = expand(entry.command);
    if (!grant(skill, commandTool, { command })) throw new Error('Skill command is outside allowed-tools');
    await approve(commandTool, { command }, options, true);
  }
  let out = ''; let start = 0;
  for (const entry of commands) {
    out += expand(body.slice(start, entry.at)) + await shellOutput(expand(entry.command), shell, options);
    if (Buffer.byteLength(out) > options.config.maxOutputBytes) throw new Error('Expanded skill output byte limit exceeded');
    start = entry.at + entry.raw.length;
  }
  out += expand(body.slice(start));
  // Append only to instructions; fallback text must never extend a shell command.
  out += withArguments.slice(expanded.length);
  if (Buffer.byteLength(out) > options.config.maxOutputBytes) throw new Error('Expanded skill output byte limit exceeded');
  return out;
}

function overlayHooks(parent: HooksConfig | undefined, extra: HooksConfig | undefined): HooksConfig | undefined {
  if (!extra) return parent ? structuredClone(parent) : undefined;
  const hooks = structuredClone(parent ?? {});
  for (const event of Object.keys(extra) as (keyof HooksConfig)[]) hooks[event] = [...(hooks[event] ?? []), ...(extra[event] ?? [])];
  return hooksSchema.parse(hooks);
}

export function skillRequiresExecution(skill: SkillInfo, config?: SessionConfig): boolean {
  return skill.context === 'fork' || skill.model !== undefined || skill.effort !== undefined || skill.background === true ||
    skill.agent !== undefined || skill.hooks !== undefined || skill.allowedTools !== undefined || skill.command !== undefined || skill.shell !== undefined ||
    (config?.features?.skillInlineCommands === true && skillCommands(skill.body).length > 0);
}

/** Returns inline instruction text, a completed fork summary, or a background descriptor. */
export async function executeSkill(skill: SkillInfo, args: string, options: SkillExecutionOptions): Promise<string> {
  options.signal.throwIfAborted();
  skill = structuredClone(skill);
  options = { ...options, config: structuredClone(options.config), tools: [...options.tools] };
  if (options.source === 'model' && skill.disableModelInvocation) throw new Error('Skill is disabled for model invocation');
  if (options.source === 'user' && !skill.userInvocable) throw new Error('Skill is hidden from user invocation');
  if (skill.agent !== undefined && skill.context !== 'fork') throw new Error('Skill agent routing requires context: fork');
  const route = skill.agent === undefined ? undefined : resolveChildLaunch(options.config,
    { subagent_type: skill.agent, ...(skill.model ? { model: skill.model } : {}), ...(skill.effort ? { effort: skill.effort } : {}) },
    { enableAdvanced: options.config.features?.agentTypes !== false, agentTypes: options.config.agentTypes });
  if (route?.isolation && !options.registry) throw new Error('Isolated skill agent requires a session-owned agent registry');
  const conversation = skillConversation(skill, options);
  checkConversationBudget(conversation, expandSkill(skill.body, args, { quotedArguments: options.config.features?.skillQuotedArguments === true,
    extendedArguments: options.config.features?.skillExtendedArguments === true,
    argumentNames: skill.argumentNames,
    appendUnusedArguments: options.config.features?.skillArgumentFallback === true }), options.config);
  const fork = skill.context === 'fork' || skill.model !== undefined || skill.effort !== undefined || skill.background === true || skill.hooks !== undefined || skill.allowedTools !== undefined;
  if (skill.background && !options.registry) throw new Error('Background skill requires a session-owned agent registry');
  const hooks = overlayHooks(options.config.hooks, skill.hooks);
  if (skill.hooks) {
    hooksSchema.parse(skill.hooks);
    for (const event of HOOK_EVENTS) for (const { definition } of flattenHookDefinitions(skill.hooks, event)) {
      // Preflight grouped commands too before the skill performs any effects.
      if ('command' in definition) await approve(commandTool, { command: definition.command }, options, true);
    }
  }
  const body = await expandedBody(skill, args, options);
  if (!fork) return body;
  const config = structuredClone(options.config);
  const model = skill.model ?? route?.model;
  const effort = skill.effort ?? route?.effort;
  if (model !== undefined && model !== 'inherit') config.model = model;
  if (effort !== undefined) config.effort = effort;
  if (hooks !== undefined) config.hooks = hooks;
  const parentNames = new Set(config.tools.map(tool => tool.name));
  const mode = route?.mode ?? 'general';
  const originals = selectChildTools(options.tools, mode, route?.type?.tools).filter(tool => parentNames.has(tool.schema.name) && grant(skill, tool));
  const beforeTool = async (tool: ToolDefinition, input: unknown, signal: AbortSignal): Promise<void> => {
    if (!grant(skill, tool, input)) throw new Error('Skill tool input is outside allowed-tools');
    await approve(tool, input, { ...options, signal });
  };
  const selected = originals.map(tool => ({
    ...tool,
    async execute(input: unknown, context: Parameters<ToolDefinition['execute']>[1]): Promise<string> {
      await beforeTool(tool, input, context.signal);
      return tool.execute(input, { ...context, allowShell: context.allowShell && config.allowShell });
    },
    ...(tool.executeBlocks ? {
      async executeBlocks(input: unknown, context: Parameters<ToolDefinition['execute']>[1]) {
        await beforeTool(tool, input, context.signal);
        return tool.executeBlocks!(input, { ...context, allowShell: context.allowShell && config.allowShell });
      },
    } : {}),
  }));
  config.tools = selected.map(tool => ({ ...tool.schema, eager_input_streaming: true }));
  const child = childConfig(config, selected, { mode, max_turns: Math.min(config.maxTurns, route?.max_turns ?? config.maxTurns), ...(route?.type ? { type: route.type } : {}) });
  checkConversationBudget(conversation, body, child);
  if (skill.background || route?.isolation) {
    // Registry builds its own child prefix; carry only the authored type body once.
    const registryConfig = structuredClone(config);
    if (route?.type?.body) registryConfig.system += '\n\nAgent instructions:\n' + route.type.body;
    const descriptor = await options.registry!.launch({ prompt: body, mode, max_turns: Math.min(child.maxTurns, 30), background: skill.background === true,
      ...(model && model !== 'inherit' ? { model } : {}), ...(route?.isolation ? { isolation: route.isolation } : {}) }, options.signal,
      { config: registryConfig, tools: originals, beforeTool, ...(conversation !== undefined ? { conversation } : {}) });
    if (!skill.background) return capChildOutput(JSON.stringify({ session_id: descriptor.session_id, reason: descriptor.reason, text: descriptor.summary, model_calls: descriptor.model_calls }), config.maxOutputBytes);
    return capChildOutput(JSON.stringify(descriptor), config.maxOutputBytes);
  }
  // The executor wrapper owns the original policy, including post-hook inputs.
  // Agent's outer check delegates to it so one input asks only once.
  child.permissions = { mode: 'bypass', allow: [], deny: [] };
  const session = Session.open(config.workspace, { config: child });
  let agent: Agent | undefined;
  let asyncHooks: ReturnType<typeof createChildHookLifecycle> | undefined;
  try {
    for (const message of conversation ?? []) session.append({ kind: 'message', message });
    if (conversation !== undefined) session.append({ kind: 'turn_end', reason: 'fork_seed' });
    asyncHooks = createChildHookLifecycle(session, { hookOptions: options.hookOptions, terminalSequence: options.terminalSequence });
    agent = new Agent(session, options.provider, selected, { text: options.onText, hookOptions: asyncHooks.hookOptions,
      ...(options.instructionFiles ? { instructionFiles: paths => options.instructionFiles!(session.config.workspace, paths) } : {}),
      ...(options.terminalSequence ? { terminalSequence: sequence => options.terminalSequence!(session.id, sequence) } : {}) });
    await agent.startSession(conversation !== undefined ? 'fork' : 'startup', options.signal);
    const result = await agent.run(body, options.signal);
    return capChildOutput(JSON.stringify({ session_id: session.id, reason: result.reason, text: result.text, model_calls: result.modelCalls }), config.maxOutputBytes);
  } finally {
    try { await agent?.endSession(options.signal.aborted ? 'interrupt' : 'other'); }
    finally {
      try { await asyncHooks?.close(); }
      finally { session.close(); }
    }
  }
}
