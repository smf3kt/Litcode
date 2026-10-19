import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, DEFAULT_SYSTEM, defaultConfig } from './agent.js';
import { DEFAULT_GATEWAY, GatewayProvider, type ModelProvider } from './provider.js';
import { resolveInheritedGateway, sameGateway, type InheritedField, type InheritedGateway } from './gateway-inherit.js';
import { Session, applyManagedPolicy, managedPolicySchema, type SessionConfig } from './session.js';
import { PolicyHelper } from './policy-helper.js';
import { interactiveLoop } from './interactive.js';
import { tuiCommandsWithSkills } from './tui-autocomplete.js';
import { createTuiTerminal } from './tui.js';
import { formatHookTerminalSequence } from './hook-terminal.js';
import { skillRequiresExecution } from './skill-runtime.js';
import { agentTypesSection, setHeldSkills } from './skill-catalog.js';
import { listSessions } from './sessions.js';
import { loadProjectConfig, defaultUserDir, instructionSources, type LoadedConfig } from './config.js';
import { refuseBypassUnderRoot } from './bypass-guard.js';
import { heldMcpServerNotice, mcpServerFingerprint, readMcpApprovals, recordMcpApprovals, resolveMcpServers, workspaceApprovalKey } from './mcp-approval.js';
import { loadKeybindings } from './keybindings.js';
import { bindSettingsStore } from './plugin-chain-settings-store.js';
import { bindWheelSettingsHost } from './plugin-chain-wheel-glue-host.js';
import { compileJsonSchema, createHeadlessOutput, UsageBudget, UsageBudgetExceeded, withUsageBudget,
  type HeadlessOutput, type OutputFormat } from './structured-output.js';
import type { PermissionPolicy } from './permissions.js';
import {
  buildSystem,
  createRuntime,
  expandUserSkill,
  findSkill,
  parseSettings,
  parseSlashCommand,
  pinToolSchemas,
  validateRuntimeConfig,
  type ParsedRuntimeSettings,
  type Runtime,
} from './runtime.js';

const help = `LiTcode

  litcode                          Interactive session in the current directory
  litcode --workspace DIR          Interactive session in DIR
  litcode "task"                   One-shot task in the current directory
  litcode --workspace DIR "task"   One-shot task in DIR
  litcode --resume UUID "task"     Continue a stored session with a new task
  litcode --resume UUID --continue Continue a turn interrupted before completion
  litcode --demo                   Offline demonstration, no model call

Options (flags override LLM_* environment values for new sessions):
  --workspace DIR        Existing workspace (default current directory)
  --model NAME           Gateway model ID (LLM_MODEL; required for live sessions)
  --effort LEVEL         low, medium, high, xhigh or max (LLM_EFFORT; optional)
  --base-url URL         Messages endpoint base (LLM_BASE_URL; default http://127.0.0.1:3425)
  --auth MODE            bearer or api-key (LLM_AUTH; default from the credential source)
  --inherit-gateway     Take a missing gateway, credential and model from an installed
                        client's own settings (default on; LLM_INHERIT_GATEWAY)
  --no-inherit-gateway  Use only this harness's own flags, LLM_* values and settings
  --token-counting MODE  estimate or api (LLM_TOKEN_COUNTING; default estimate)
  --thinking            Send adaptive thinking (LLM_THINKING; default false)
  --no-thinking         Omit thinking parameter
  --prompt-cache        Enable ephemeral cache (LLM_PROMPT_CACHE; default false)
  --eager-tool-input    Enable eager input streaming (LLM_EAGER_TOOL_INPUT; default false)
  --allow-shell         Enable commands with current OS user permissions
  --max-turns N         Model calls per task (default 30)
  --context-tokens N     Configured window (default 1000000; verify deployment capacity)
  --compact-at N         Summarize above input budget (default 512000)
  --max-tokens N         Output limit (default 16384)
  --settings FILE        Explicit settings file loaded last (highest precedence)
  --managed-settings FILE  Pin authored permission/shell/feature/MCP policy fields
  --user-dir DIR         Harness user directory (default ~/.harness)
  --permission-mode MODE default, plan, acceptEdits, ask, bypass, auto or dontAsk (default default)
  --allow-tool RULE      Permit a tool rule (repeatable); outside the list is denied
  --deny-tool RULE       Deny a tool rule (repeatable)
  --tasks               Enable durable task tools (new sessions; default on)
  --subagents           Enable the subagent tool (new sessions; default on)
  --auto-memory         Maintain durable workspace memories using existing tools
  --watch-config        Reload changed local configuration between interactive turns
  --mcp-roots           Expose current workspace file URI to configured MCP servers
  --mcp-elicitation     Enable MCP form questions during interactive tasks
  --mcp-sampling        Authorize tool-free delegated calls using the configured
                        model and shared usage budget (no OAuth or credentials)
  --resume UUID          Open a session with its original settings
  --continue            Continue a turn interrupted before completion
  --recover-lock        Remove a lock only if its owner process has exited
  --interactive         Read tasks and slash commands until /exit (the default
                        when no task is given and input is a terminal)
  --tui                 Draw the full-screen interface (default at a capable
                        terminal), with a transcript, status row and prompt box
  --no-tui              Use the line editor even at a capable terminal
  --attach PATH         Attach one workspace image/PDF to a one-shot task
  --pages RANGE         Select PDF pages for --attach, such as 2-4,8
  --output-format MODE  text, json or stream-json (one-shot; default text)
  --json-schema JSON    Validate the final JSON value against a local schema
  --max-model-calls N   Completion call budget for this invocation
  --max-input-tokens N  Actual input token budget for this invocation
  --max-output-tokens N Actual output token budget for this invocation
  --max-total-tokens N  Actual combined token budget for this invocation
  --list-sessions       List workspace sessions without a model call
  --demo                Offline demonstration in a temporary workspace
  --version             Show the version
  --help                Show this text

LLM_API_KEY supplies the credential. When it is unset, anything the other client
on this machine did not answer is filled from that client's own settings: its
ANTHROPIC_BASE_URL, ANTHROPIC_MODEL and ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY,
read from its settings.json and from this process's environment. A borrowed
credential is used only for the endpoint that client named. Every explicit value
here - a flag, an LLM_* variable or this harness's settings.json - still wins, and
the notice names the source, never a value. LLM_INHERIT_DIR or the other client's
own configuration-directory variable selects where to look; --no-inherit-gateway
turns the whole thing off.

Magpie translates the Messages protocol
for configured upstream models. Capability options are opt-in. New sessions
merge default, then settings.json, then LLM_* environment, then flags; --resume
uses the pinned snapshot and never reloads project configuration. Estimate mode
uses a conservative UTF-8 byte budget, not a model tokenizer or billed usage.
Session settings contain no API key or MCP environment values. Transcripts are
stored in WORKSPACE/.agent.
`;

function positive(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Expected a positive integer: ${value}`);
  return Number(value);
}
function budgetLimit(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error(`Expected a nonnegative integer budget: ${value}`);
  return Number(value);
}
function choice<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) throw new Error(`Expected ${allowed.join(' or ')}: ${value}`);
  return value as T;
}
function envBoolean(name: string): boolean {
  const value = process.env[name];
  if (value === undefined) return false;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`${name} must be true/false or 1/0`);
}
/** Like envBoolean but undefined when unset, so settings can fill the gap. */
function optionalBoolean(name: string): boolean | undefined {
  return process.env[name] === undefined ? undefined : envBoolean(name);
}
function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}
function demoResponse(content: Anthropic.ContentBlock[], stop: Anthropic.StopReason): Anthropic.Message {
  return { id: 'demo', type: 'message', role: 'assistant', model: 'offline-fixture', content,
    stop_reason: stop, stop_sequence: null, stop_details: null, container: null, diagnostics: null,
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
}
function demoProvider(): ModelProvider {
  let turn = 0;
  return {
    count: async () => 100,
    complete: async (_request, _signal, onText) => {
      turn++;
      if (turn === 1) return demoResponse([{ type: 'tool_use', caller: { type: 'direct' }, id: 'write-demo', name: 'write_file', input: { path: 'hello.txt', content: 'Hello from the independent agent.\n' } }], 'tool_use');
      if (turn === 2) return demoResponse([{ type: 'tool_use', caller: { type: 'direct' }, id: 'read-demo', name: 'read_file', input: { path: 'hello.txt' } }], 'tool_use');
      const text = 'Offline demo passed: wrote hello.txt, read it back, and paired both tool results.\n';
      onText?.(text);
      return demoResponse([{ type: 'text', text, citations: null }], 'end_turn');
    },
  };
}

/** Expand a one-shot `/NAME args` prompt whose NAME is a user-invocable skill. */
function expandOneShot(prompt: string, config: SessionConfig): string {
  const parsed = parseSlashCommand(prompt);
  if (!parsed) return prompt;
  const skill = findSkill(config.skills, parsed.name);
  return skill ? expandUserSkill(skill, parsed.args, config) : prompt;
}

function resolvePermissions(base: PermissionPolicy | undefined, values: Record<string, unknown>): PermissionPolicy {
  const mode = values['permission-mode'] === undefined
    ? base?.mode ?? 'default'
    : choice(values['permission-mode'] as string, ['default', 'plan', 'acceptEdits', 'ask', 'bypass', 'auto', 'dontAsk'], 'default');
  const allow = dedupe([...(base?.allow ?? []), ...((values['allow-tool'] as string[] | undefined) ?? [])]);
  const deny = dedupe([...(base?.deny ?? []), ...((values['deny-tool'] as string[] | undefined) ?? [])]);
  return { ...base, mode, allow, deny };
}

/**
 * Assemble a new session configuration from defaults, settings, environment and
 * flags (last wins). Project configuration is only read for a new session;
 * `--resume` reuses the pinned snapshot. The offline demo stays on base tools
 * and adds no post-MVP fields, so its journal matches the original format.
 */
interface GatewayChoice {
  baseURL: string;
  model: string;
  /** The header the chosen credential needs, when nothing more explicit said. */
  authDefault?: 'bearer' | 'api-key';
}

/**
 * New-session gateway values, most explicit first: a flag, then this harness's own
 * `LLM_*` environment, then this harness's own settings, then - only where all of
 * those are silent - the gateway another client on this machine is configured with.
 */
function resolveGatewayChoice(
  values: Record<string, unknown>,
  settings: ParsedRuntimeSettings,
  inherited: InheritedGateway | undefined,
  demo: boolean,
): GatewayChoice {
  const baseURL = (values['base-url'] as string | undefined) ?? process.env.LLM_BASE_URL
    ?? settings.baseURL ?? inherited?.baseURL ?? DEFAULT_GATEWAY.baseURL;
  const model = demo
    ? 'offline-fixture'
    : ((values.model as string | undefined) ?? process.env.LLM_MODEL ?? settings.model ?? inherited?.model ?? '');
  const credential = gatewayCredential(baseURL, inherited);
  return { baseURL, model, ...(credential.auth === undefined ? {} : { authDefault: credential.auth }) };
}

/**
 * The credential for `baseURL`: this harness's own key first, then the one the other
 * client configured - and only when that client named this exact endpoint, so a
 * borrowed credential is never sent to a gateway it was not issued for.
 */
function gatewayCredential(baseURL: string, inherited: InheritedGateway | undefined): {
  key?: string;
  auth?: 'bearer' | 'api-key';
  source?: string;
  /** Set when a credential was found but belongs to a different endpoint. */
  refusedFor?: string;
} {
  const own = process.env.LLM_API_KEY;
  if (own !== undefined && own.trim() !== '') return { key: own };
  const borrowed = inherited?.credential;
  if (borrowed === undefined || inherited === undefined) return {};
  if (inherited.baseURL === undefined) return { refusedFor: 'the client names no endpoint' };
  if (!sameGateway(inherited.baseURL, baseURL)) return { refusedFor: inherited.baseURL };
  return { key: borrowed.value, auth: borrowed.auth, source: inherited.sources.find(entry => entry.field === 'credential')?.source };
}

/** What to do when no credential applies to the endpoint this run will use. */
function missingCredentialError(
  credential: { refusedFor?: string },
  baseURL: string,
): string {
  const opening = 'Set LLM_API_KEY in your environment before a live run (export LLM_API_KEY=…), '
    + 'or run `litcode --demo` for an offline demonstration';
  if (credential.refusedFor === undefined) return opening;
  return `${opening}. A client credential was found, but it belongs to ${credential.refusedFor} and this run uses ${baseURL}`;
}

/** Report borrowed values on stderr: the source is named, a value never is. */
function announceInheritance(inherited: InheritedGateway | undefined, used: InheritedField[]): void {
  const notice = inheritanceNotice(inherited, used);
  if (notice !== undefined) process.stderr.write(notice);
}

/** One non-secret line naming where the borrowed values came from. */
function inheritanceNotice(inherited: InheritedGateway | undefined, used: InheritedField[]): string | undefined {
  if (inherited === undefined || used.length === 0) return undefined;
  const labels: Record<InheritedField, string> = { credential: 'credential', baseURL: 'base URL', model: 'model' };
  const grouped = new Map<string, string[]>();
  for (const field of used) {
    const source = inherited.sources.find(entry => entry.field === field)?.source ?? 'the client configuration';
    grouped.set(source, [...(grouped.get(source) ?? []), labels[field]]);
  }
  const parts = [...grouped].map(([source, fields]) => `${fields.join(', ').replace(/, ([^,]*)$/, ' and $1')} from ${source}`);
  return `gateway: inherited ${parts.join('; ')}\n`;
}

function newConfig(
  values: Record<string, unknown>,
  workspace: string,
  loaded: LoadedConfig | undefined,
  settings: ParsedRuntimeSettings,
  demo: boolean,
  gateway: GatewayChoice,
): SessionConfig {
  const config = defaultConfig(workspace, []);
  config.model = gateway.model;
  const effort = (values.effort as string | undefined) ?? (demo ? undefined : process.env.LLM_EFFORT) ?? settings.effort;
  if (effort !== undefined) config.effort = choice<NonNullable<SessionConfig['effort']>>(effort, ['low', 'medium', 'high', 'xhigh', 'max'], 'high');
  config.gateway = {
    baseURL: gateway.baseURL,
    auth: choice((values.auth as string | undefined) ?? process.env.LLM_AUTH ?? settings.auth ?? gateway.authDefault, ['bearer', 'api-key'], 'bearer'),
    tokenCounting: choice((values['token-counting'] as string | undefined) ?? process.env.LLM_TOKEN_COUNTING ?? settings.tokenCounting, ['estimate', 'api'], 'estimate'),
    promptCaching: (values['prompt-cache'] as boolean | undefined) ?? (demo ? false : optionalBoolean('LLM_PROMPT_CACHE')) ?? settings.promptCaching ?? false,
    eagerToolInput: (values['eager-tool-input'] as boolean | undefined) ?? (demo ? false : optionalBoolean('LLM_EAGER_TOOL_INPUT')) ?? settings.eagerToolInput ?? false,
  };
  config.allowShell = (values['allow-shell'] as boolean | undefined) ?? settings.allowShell ?? false;
  config.maxTurns = positive(values['max-turns'] as string | undefined, settings.maxTurns ?? config.maxTurns);
  if (!demo) config.stopHookBlockCap = settings.stopHookBlockCap ?? 8;
  if (!demo && settings.automaticCheckpoints !== undefined) config.automaticCheckpoints = settings.automaticCheckpoints;
  config.maxTokens = positive(values['max-tokens'] as string | undefined, settings.maxTokens ?? config.maxTokens);
  config.contextTokens = positive(values['context-tokens'] as string | undefined, settings.contextTokens ?? config.contextTokens);
  config.compactAt = positive(values['compact-at'] as string | undefined, Math.min(settings.compactAt ?? config.compactAt, config.contextTokens - config.maxTokens - 8192));
  config.maxOutputBytes = settings.maxOutputBytes ?? config.maxOutputBytes;
  if (settings.prefersReducedMotion !== undefined) config.prefersReducedMotion = settings.prefersReducedMotion;
  if (settings.showTurnDuration !== undefined) config.showTurnDuration = settings.showTurnDuration;
  if (settings.timeFormat !== undefined) config.timeFormat = settings.timeFormat;
  if (settings.timeZone !== undefined) config.timeZone = settings.timeZone;
  if (settings.spinnerVerbs !== undefined) config.spinnerVerbs = settings.spinnerVerbs;
  if(settings.editorMode!==undefined)config.editorMode=settings.editorMode;
  if(settings.vimInsertModeRemaps!==undefined)config.vimInsertModeRemaps=settings.vimInsertModeRemaps;
  if (settings.maxProseWidth !== undefined) config.maxProseWidth = settings.maxProseWidth;
  if (settings.askUserQuestionTimeout !== undefined) config.askUserQuestionTimeout = settings.askUserQuestionTimeout;
  if (settings.dialogExpiry !== undefined) config.dialogExpiry = settings.dialogExpiry;
  if (settings.syntaxHighlightingDisabled !== undefined) config.syntaxHighlightingDisabled = settings.syntaxHighlightingDisabled;
  if (settings.enableWorkflows !== undefined) config.enableWorkflows = settings.enableWorkflows;
  if (settings.workflowKeywordTriggerEnabled !== undefined) config.workflowKeywordTriggerEnabled = settings.workflowKeywordTriggerEnabled;
  if (settings.emojiCompletionEnabled !== undefined) config.emojiCompletionEnabled = settings.emojiCompletionEnabled;
  if (settings.theme !== undefined) config.theme = settings.theme;
  if (settings.statusLine !== undefined) config.statusLine = settings.statusLine;
  config.thinking = values['no-thinking']
    ? false
    : (values.thinking as boolean | undefined) ?? (demo ? false : optionalBoolean('LLM_THINKING')) ?? settings.thinking ?? false;
  if (settings.mcpClient !== undefined || values['mcp-roots'] === true || values['mcp-sampling'] === true || values['mcp-elicitation'] === true) {
    config.mcpClient = {
      ...settings.mcpClient,
      ...(values['mcp-roots'] === true ? { roots: true } : {}),
      ...(values['mcp-sampling'] === true ? { sampling: true } : {}),
      ...(values['mcp-elicitation'] === true ? { elicitation: true } : {}),
    };
  }
  if (!demo && loaded) {
    config.configSources = {
      ...(values['user-dir'] === undefined ? {} : { userDir: path.resolve(values['user-dir'] as string) }),
      ...(values.settings === undefined ? {} : { settingsFile: path.resolve(workspace, values.settings as string) }),
      ...(values['managed-settings'] === undefined ? {} : { managedSettingsFile: path.resolve(workspace, values['managed-settings'] as string) }),
    };
    if (settings.autoMemory !== undefined || values['auto-memory'] === true) config.autoMemory = values['auto-memory'] === true || settings.autoMemory;
    config.dynamicInstructions = settings.dynamicInstructions ?? true;
    if (settings.watchConfig !== undefined || values['watch-config'] === true) config.watchConfig = values['watch-config'] === true || settings.watchConfig;
    config.system = buildSystem(DEFAULT_SYSTEM, [...loaded.instructions,
      ...(config.autoMemory || settings.features?.memory === false ? [] : loaded.memories ?? [])], loaded.skills);
    config.skills = loaded.skills;
    setHeldSkills(config, loaded.conditionalSkills);
    config.instructionSources = instructionSources(loaded.instructions);
    if (loaded.conditionalRules?.length) config.conditionalRules = structuredClone(loaded.conditionalRules);
    config.features = {
      tasks: (values.tasks as boolean | undefined) ?? settings.features?.tasks ?? true,
      taskProjections: settings.features?.taskProjections ?? true,
      subagents: (values.subagents as boolean | undefined) ?? settings.features?.subagents ?? true,
      notebooks: settings.features?.notebooks ?? true,
      background: settings.features?.background ?? true,
      scheduler: settings.features?.scheduler ?? true,
      ...(settings.features?.schedulerJitter === undefined ? {} : { schedulerJitter: settings.features.schedulerJitter }),
      ...(settings.features?.skillInlineCommands === undefined ? {} : { skillInlineCommands: settings.features.skillInlineCommands }),
      ...(settings.features?.skillQuotedArguments === undefined ? {} : { skillQuotedArguments: settings.features.skillQuotedArguments }),
      ...(settings.features?.skillArgumentFallback === undefined ? {} : { skillArgumentFallback: settings.features.skillArgumentFallback }),
      ...(settings.features?.skillExtendedArguments === undefined ? {} : { skillExtendedArguments: settings.features.skillExtendedArguments }),
      ...(settings.features?.pluginSkillNamespaces === undefined ? {} : { pluginSkillNamespaces: settings.features.pluginSkillNamespaces }),
      agentMessaging: settings.features?.agentMessaging ?? true,
      agentIdle: settings.features?.agentIdle ?? true,
      agentTypes: settings.features?.agentTypes ?? true,
      interaction: settings.features?.interaction ?? true,
      web: settings.features?.web ?? true,
      checkpoints: settings.features?.checkpoints ?? true,
      worktrees: settings.features?.worktrees ?? true,
      memory: settings.features?.memory ?? true,
      media: settings.features?.media ?? true,
      workflow: settings.features?.workflow ?? true,
      workflowPersistence: settings.features?.workflowPersistence ?? true,
      mcpSubscriptions: settings.features?.mcpSubscriptions ?? false,
      ...(settings.features?.mcpLogging === undefined ? {} : { mcpLogging: settings.features.mcpLogging }),
      ...(settings.features?.mcpNotificationStream === undefined ? {} : { mcpNotificationStream: settings.features.mcpNotificationStream }),
      ...(settings.features?.mcpRecovery === undefined ? {} : { mcpRecovery: settings.features.mcpRecovery }),
      ...(settings.features?.mcpPersistence === undefined ? {} : { mcpPersistence: settings.features.mcpPersistence }),
      ...(settings.features?.mcpTasks === undefined ? {} : { mcpTasks: settings.features.mcpTasks }),
      ...(settings.features?.mcpStandardTasks === undefined ? {} : { mcpStandardTasks: settings.features.mcpStandardTasks }),
      mcpCatalog: settings.features?.mcpCatalog ?? true,
      mcpDynamic: settings.features?.mcpDynamic ?? Boolean(settings.mcpServers && Object.keys(settings.mcpServers).length),
      mcpDeferred: settings.features?.mcpDeferred ?? false,
      // Same-host peer transport is opt-in: an inbox is a listening socket,
      // so it is never opened without the user's own setting.
      crossSessionMessaging: settings.features?.crossSessionMessaging ?? false,
      lsp: settings.features?.lsp ?? Boolean(settings.lspServers && Object.keys(settings.lspServers).length),
    };
    if (loaded.agentTypes !== undefined) config.agentTypes = structuredClone(loaded.agentTypes);
    applyManagedPolicy(config, loaded.managedSettings);
    if (config.features.subagents && config.features.agentTypes) config.system += agentTypesSection(config.agentTypes ?? []);
    if (settings.plugins) config.plugins = structuredClone(settings.plugins);
    if (settings.lspServers) config.lspServers = settings.lspServers;
    if (settings.webSearch) config.webSearch = settings.webSearch;
    if (settings.hooks) config.hooks = settings.hooks;
    if (settings.mcpServers) config.mcpServers = settings.mcpServers;
    const approvalUserDir = path.resolve((values['user-dir'] as string | undefined) ?? defaultUserDir());
    const approvals = readMcpApprovals(approvalUserDir, workspaceApprovalKey(workspace));
    const admission = resolveMcpServers(loaded.projectMcpServers ?? {}, approvals,
      { approveAll: loaded.approveAllProjectMcpServers === true });
    if (admission.pending.length || admission.declined.length) {
      // A held or declined server is never connected: the name is removed from
      // the configuration the runtime dials, and kept aside with its reason.
      for (const name of [...admission.pending.map(item => item.name), ...admission.declined]) {
        if (config.mcpServers) delete config.mcpServers[name];
      }
      if (admission.pending.length) config.heldMcpServers = admission.pending;
      const notice = heldMcpServerNotice(admission.pending, admission.declined, approvals.state);
      if (notice) process.stderr.write(`${notice}\n`);
    }
    const cliPermissions = resolvePermissions(undefined, values);
    config.permissions = { ...resolvePermissions(settings.permissions, values), layers: [...loaded.permissionLayers,
      { source: 'cliArg', root: workspace, allow: cliPermissions.allow, deny: cliPermissions.deny, ask: [], additionalDirectories: [] }] };
    // The mode that skips every check stops meaning "stop asking me" when the
    // process is root outside a container, so it is refused before anything
    // runs rather than warned about afterwards.
    const bypassRefusal = refuseBypassUnderRoot({ mode: config.permissions.mode });
    if (bypassRefusal.refused) {
      process.stderr.write(`${bypassRefusal.message}\n`);
      process.exit(1);
    }
    config.configSources!.overrides = {
      ...(values['auto-memory'] === undefined ? {} : { autoMemory: values['auto-memory'] as boolean }),
      ...(values['watch-config'] === undefined ? {} : { watchConfig: values['watch-config'] as boolean }),
      ...(values['allow-shell'] === undefined ? {} : { allowShell: values['allow-shell'] as boolean }),
      ...(values.tasks === undefined ? {} : { tasks: values.tasks as boolean }),
      ...(values.subagents === undefined ? {} : { subagents: values.subagents as boolean }),
      ...(["permission-mode", "allow-tool", "deny-tool"].some(key => values[key] !== undefined) ? { permissions: structuredClone({ ...cliPermissions, layers: [config.permissions.layers!.at(-1)!] }) } : {}),
      ...(values['mcp-roots'] || values['mcp-sampling'] || values['mcp-elicitation'] ? { mcpClient: {
        ...(values['mcp-roots'] ? { roots: true } : {}), ...(values['mcp-sampling'] ? { sampling: true } : {}),
        ...(values['mcp-elicitation'] ? { elicitation: true } : {}),
      } } : {}),
    };
    applyManagedPolicy(config, loaded.managedSettings);
  }
  return config;
}

/** The version the installed package reports, falling back to the source tree's own value. */
function cliVersion(): string {
  const candidates = [
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { version?: unknown }).version === 'string') {
        return (parsed as { version: string }).version;
      }
    } catch { /* try the next candidate */ }
  }
  return 'unknown';
}

async function main(): Promise<void> {  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean' }, demo: { type: 'boolean' }, workspace: { type: 'string' },
    interactive: { type: 'boolean' }, tui: { type: 'boolean' }, 'no-tui': { type: 'boolean' }, 'list-sessions': { type: 'boolean' },
    attach: { type: 'string' }, pages: { type: 'string' },
    model: { type: 'string' }, effort: { type: 'string' }, 'base-url': { type: 'string' }, auth: { type: 'string' },
    'token-counting': { type: 'string' }, thinking: { type: 'boolean' }, 'no-thinking': { type: 'boolean' },
    'prompt-cache': { type: 'boolean' }, 'eager-tool-input': { type: 'boolean' },
    'inherit-gateway': { type: 'boolean' }, 'no-inherit-gateway': { type: 'boolean' },
    'allow-shell': { type: 'boolean' }, 'max-turns': { type: 'string' },
    'context-tokens': { type: 'string' }, 'compact-at': { type: 'string' }, 'max-tokens': { type: 'string' },
    settings: { type: 'string' }, 'managed-settings': { type: 'string' }, 'policy-helper': { type: 'string' }, 'policy-helper-interval': { type: 'string' }, 'user-dir': { type: 'string' }, 'permission-mode': { type: 'string' },
    'allow-tool': { type: 'string', multiple: true }, 'deny-tool': { type: 'string', multiple: true },
    tasks: { type: 'boolean' }, subagents: { type: 'boolean' },
    'auto-memory': { type: 'boolean' },
    'watch-config': { type: 'boolean' },
    'approve-mcp-server': { type: 'string', multiple: true },
    'reject-mcp-server': { type: 'string', multiple: true },
    'mcp-roots': { type: 'boolean' }, 'mcp-sampling': { type: 'boolean' },
    'mcp-elicitation': { type: 'boolean' },
    'output-format': { type: 'string' }, 'json-schema': { type: 'string' },
    'max-model-calls': { type: 'string' }, 'max-input-tokens': { type: 'string' },
    'max-output-tokens': { type: 'string' }, 'max-total-tokens': { type: 'string' },
    resume: { type: 'string' }, continue: { type: 'boolean' }, 'recover-lock': { type: 'boolean' },
    version: { type: 'boolean' }, v: { type: 'boolean' },
  } });
  if (values.help) { process.stdout.write(help); return; }
  if (values.version || values.v) { process.stdout.write(`${cliVersion()}\n`); return; }
  // A bare invocation at a terminal is the interactive session, the way a person expects a CLI to
  // behave; anywhere else there is no way to read a task, so the help is the answer. Options that
  // belong to another complete action (demo, resume, session listing, an MCP answer) are left to
  // their own branches rather than being read as a request for a session.
  const impliedInteractive = !values.demo && !values.continue && !values.interactive
    && !values.resume && !values['list-sessions'] && positionals.length === 0
    && Boolean(process.stdin.isTTY);
  if (values['mcp-elicitation'] && !values.interactive && !impliedInteractive) throw new Error('--mcp-elicitation requires --interactive');
  if (values['watch-config'] && !values.interactive && !impliedInteractive) throw new Error('--watch-config requires --interactive');
  if (values.tui && !values.interactive && !impliedInteractive) throw new Error('--tui requires --interactive');
  if (values.tui && values['no-tui']) throw new Error('Choose --tui or --no-tui');
  // Interactive terminals own the full screen by default; pipes and dumb terminals keep line IO.
  const useTui = !values['no-tui'] && Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY)
    && typeof process.stdin.setRawMode === 'function' && (values.tui === true || process.env.TERM !== 'dumb');
  if (values.pages !== undefined && values.attach === undefined) throw new Error('--pages requires --attach');
  if (values.attach !== undefined && (values.interactive || values.continue || values.demo || values['list-sessions'])) {
    throw new Error('--attach requires a one-shot new task; interactive sessions use /attach');
  }
  const format = choice<OutputFormat>(values['output-format'], ['text', 'json', 'stream-json'], 'text');
  let schema: unknown;
  if (values['json-schema'] !== undefined) { schema = JSON.parse(values['json-schema']); compileJsonSchema(schema); }
  if (values.interactive && (values['output-format'] !== undefined || schema !== undefined)) throw new Error('Structured output options require one-shot execution');
  const budget = new UsageBudget({
    ...(values['max-model-calls'] === undefined ? {} : { maxCalls: budgetLimit(values['max-model-calls']) }),
    ...(values['max-input-tokens'] === undefined ? {} : { maxInputTokens: budgetLimit(values['max-input-tokens']) }),
    ...(values['max-output-tokens'] === undefined ? {} : { maxOutputTokens: budgetLimit(values['max-output-tokens']) }),
    ...(values['max-total-tokens'] === undefined ? {} : { maxTotalTokens: budgetLimit(values['max-total-tokens']) }),
  });
  if (values['list-sessions']) {
    if (values.demo || values.resume || values.continue || values.interactive || positionals.length) throw new Error('Session listing takes no task or execution options');
    process.stdout.write(JSON.stringify(listSessions(values.workspace ?? process.cwd()), null, 2) + '\n'); return;
  }
  if (values.interactive && (values.demo || values.continue || positionals.length)) throw new Error('Interactive mode takes no initial task, demo or continue option');
  if (values.demo && (values.resume || values.continue || positionals.length)) throw new Error('Demo takes no task or resume options');
  if (values.continue && (!values.resume || positionals.length)) throw new Error('--continue requires --resume and no new task');
  if (values.thinking && values['no-thinking']) throw new Error('Choose --thinking or --no-thinking');
  if (values['inherit-gateway'] && values['no-inherit-gateway']) throw new Error('Choose --inherit-gateway or --no-inherit-gateway');
  const resumeLocked = ['model', 'effort', 'base-url', 'auth', 'token-counting', 'thinking', 'no-thinking', 'prompt-cache',
    'eager-tool-input', 'allow-shell', 'max-turns', 'context-tokens', 'compact-at', 'max-tokens',
    'settings', 'managed-settings', 'user-dir', 'permission-mode', 'allow-tool', 'deny-tool', 'tasks', 'subagents', 'mcp-roots', 'mcp-sampling', 'mcp-elicitation', 'auto-memory', 'watch-config', 'approve-mcp-server', 'reject-mcp-server'];
  if (values.resume && resumeLocked.some(key => key in values)) throw new Error('Resume uses stored settings; start a new session to change them');

  const demo = values.demo === true;
  const workspace = fs.realpathSync(demo
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'personal-agent-demo-'))
    : values.workspace ?? process.cwd());

  // Project configuration is read only for a new live session. A resume pins the
  // original snapshot, and the offline demo stays independent of host config.
  const loaded = !values.resume && !demo
    ? loadProjectConfig(workspace, { userDir: values['user-dir'], settingsFile: values.settings, managedSettingsFile: values['managed-settings'], paths: [] })
    : undefined;
  const settings = loaded ? parseSettings(loaded.settings) : {};
  // The wheel settings read (`hs`, chunk-js2bhabe.js [777,1499)) walks the enabled settings
  // sources; this build merges its layers when it loads them, so each source it names answers the
  // merged map, and a resume or demo session answers the same empty map its pins imply. The legacy
  // global config stays empty: this build has no legacy store to read.
  const mergedSettings: Record<string, unknown> = loaded?.settings ?? {};
  bindSettingsStore({ all: () => mergedSettings, one: () => mergedSettings });
  bindWheelSettingsHost({
    sourceOrder: () => ['userSettings'],
    projectSharesUserSettings: () => false,
    legacyConfig: () => ({}),
    legacyDefaults: () => ({}),
    parseLegacySetting: () => undefined,
  });
  const userDir = path.resolve((values['user-dir'] as string | undefined) ?? defaultUserDir());
  // Answering for a project-declared server is its own action: it records the
  // declaration the person answered for and starts nothing.
  const approve = (values['approve-mcp-server'] as string[] | undefined) ?? [];
  const reject = (values['reject-mcp-server'] as string[] | undefined) ?? [];
  if (approve.length || reject.length) {
    if (!loaded) throw new Error('--approve-mcp-server and --reject-mcp-server need a project configuration; they are unavailable with --resume or --demo');
    const declared = loaded.projectMcpServers ?? {};
    const both = approve.filter(name => reject.includes(name));
    if (both.length) throw new Error(`a project MCP server cannot be both approved and declined: ${both.join(', ')}`);
    const unknown = [...approve, ...reject].filter(name => declared[name] === undefined);
    if (unknown.length) throw new Error(`no project-declared MCP server named ${unknown.join(', ')}`);
    const entries = [
      ...approve.map(name => ({ name, fingerprint: mcpServerFingerprint(declared[name]!), decision: 'approved' as const })),
      ...reject.map(name => ({ name, fingerprint: mcpServerFingerprint(declared[name]!), decision: 'rejected' as const })),
    ];
    try {
      recordMcpApprovals(userDir, workspaceApprovalKey(workspace), entries);
    } catch (error) {
      // Nothing was written, so the question genuinely comes back.
      process.stderr.write(`mcp: your MCP server choices could not be saved (${(error as Error).message}); you will be asked again next startup\n`);
      process.exitCode = 1;
      return;
    }
    const summary = [
      approve.length ? `approved ${approve.join(', ')}` : '',
      reject.length ? `declined ${reject.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    process.stdout.write(`Project MCP server(s) ${summary}\n`);
    return;
  }
  // Approval is a complete action on its own; every other path needs work to do. A bare invocation
  // with no terminal still has no way to read a task, so the help is the answer there.
  if (impliedInteractive) values.interactive = true;
  else if (!values.demo && !values.continue && !values.interactive && !values.resume
    && !values['list-sessions'] && positionals.length === 0
    && values['approve-mcp-server'] === undefined && values['reject-mcp-server'] === undefined) {
    process.stdout.write(help);
    return;
  }
  // Inheritance is on by default: a person who already configured a compatible client
  // on this machine should not have to say the same gateway, credential and model again.
  const inheritEnabled = values['no-inherit-gateway'] === true ? false
    : values['inherit-gateway'] === true ? true
    : (optionalBoolean('LLM_INHERIT_GATEWAY') ?? true);
  const inherited = resolveInheritedGateway({ enabled: inheritEnabled && !demo });
  const gateway = resolveGatewayChoice(values, settings, inherited, demo);
  const credential = gatewayCredential(gateway.baseURL, inherited);
  if (!demo && !values.resume && credential.key === undefined) {
    throw new Error(missingCredentialError(credential, gateway.baseURL));
  }

  const controller = new AbortController();
  const onInterrupt = () => controller.abort(new Error('Interrupted'));
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onInterrupt);
  let session: Session | undefined;
  let runtime: Runtime | undefined;
  let activeAgent: Agent | undefined;
  let headless: HeadlessOutput | undefined;
  let finalText = '';
  let budgetExceeded = false;
  let outputFinished = false;
  const wrapProvider = (provider: ModelProvider): ModelProvider => {
    const wrapped = withUsageBudget(provider, budget, usage => { if (!outputFinished) headless?.event({ type: 'usage', usage }); });
    return { count: wrapped.count, async complete(...args) {
      try { return await wrapped.complete(...args); }
      catch (error) { if (error instanceof UsageBudgetExceeded) budgetExceeded = true; throw error; }
    } };
  };
  const finish = async (reason: string, text: string, modelCalls: number): Promise<void> => {
    try { await activeAgent?.endSession(controller.signal.aborted ? 'interrupt' : 'other'); }
    catch (error) { headless!.status(`SessionEnd hook error: ${error instanceof Error ? error.message : String(error)}`); }
    const snapshot = budget.snapshot();
    const result = headless!.finish({ reason: budgetExceeded || snapshot.exceeded.length ? 'budget_exceeded' : reason,
      text, modelCalls: snapshot.model_calls || modelCalls, usage: snapshot.usage });
    outputFinished = true;
    process.stderr.write(`\nfinished: ${result.reason}; model calls: ${result.model_calls}\njournal: ${session!.file}\n`);
    process.exitCode = result.reason === 'end_turn' || result.reason === 'stop_sequence' ? 0 : result.reason === 'aborted' ? 130 : 2;
  };
  try {
    let provider: ModelProvider;
    if (demo) {
      provider = wrapProvider(demoProvider());
      const config = newConfig(values, workspace, undefined, {}, true, gateway);
      runtime = await createRuntime(config, provider, controller.signal);
      config.tools = pinToolSchemas(runtime.tools);
      validateRuntimeConfig(config);
      session = Session.open(workspace, { config });
    } else if (values.resume) {
      session = Session.open(workspace, { id: values.resume, recoverLock: values['recover-lock'] });
      if (!session.config.gateway) throw new Error('Legacy session has no gateway settings; start a new session');
      // A resumed session keeps its pinned endpoint, so the credential has to suit that
      // endpoint rather than whatever a new session would have chosen.
      const pinned = gatewayCredential(session.config.gateway.baseURL, inherited);
      if (pinned.key === undefined) throw new Error(missingCredentialError(pinned, session.config.gateway.baseURL));
      announceInheritance(inherited, pinned.source === undefined ? [] : ['credential']);
      provider = wrapProvider(new GatewayProvider(pinned.key, session.config.gateway));
      runtime = await createRuntime(session.config, provider, controller.signal);
    } else {
      const config = newConfig(values, workspace, loaded, settings, false, gateway);
      const keybindings = loadKeybindings(workspace, values['user-dir']);
      if (Object.keys(keybindings).length) config.keybindings = keybindings;
      if (!config.model.trim()) throw new Error('Set LLM_MODEL or --model to your gateway model ID');
      announceInheritance(inherited, [
        ...(credential.source === undefined ? [] : ['credential'] as InheritedField[]),
        ...(inherited?.baseURL === undefined || values['base-url'] !== undefined || process.env.LLM_BASE_URL !== undefined || settings.baseURL !== undefined ? [] : ['baseURL'] as InheritedField[]),
        ...(inherited?.model === undefined || values.model !== undefined || process.env.LLM_MODEL !== undefined || settings.model !== undefined ? [] : ['model'] as InheritedField[]),
      ]);
      provider = wrapProvider(new GatewayProvider(credential.key!, config.gateway!));
      runtime = await createRuntime(config, provider, controller.signal);
      config.tools = pinToolSchemas(runtime.tools);
      validateRuntimeConfig(config);
      session = Session.open(workspace, { config });
    }
    const currentSession = session;
    if (!currentSession || !runtime) throw new Error('Runtime failed to initialize');
    // Opt-in managed-settings helper: read once before the session runs and then
    // on its configured interval, applying whichever tier is governing. The
    // static default payload is whatever managed policy the session already
    // carries, which is what a failed helper falls back to.
    const helperPath = (values['policy-helper'] ?? currentSession.config.policyHelper?.path) as string | undefined;
    if (helperPath !== undefined) {
      const fallback = currentSession.config.policyHelper?.defaultPolicy ?? currentSession.config.managedPolicy;
      const interval = values['policy-helper-interval'] === undefined
        ? currentSession.config.policyHelper?.intervalMs
        : Number(values['policy-helper-interval']);
      if (interval !== undefined && (!Number.isInteger(interval) || interval <= 0)) throw new Error('--policy-helper-interval must be a positive number of milliseconds');
      const machine = new PolicyHelper({ path: path.resolve(workspace, helperPath),
        ...(fallback === undefined ? {} : { defaultPolicy: fallback }),
        validate: policy => managedPolicySchema.safeParse(policy).success ? undefined : 'policy does not match the managed policy schema' });
      const settle = (): void => {
        const output = machine.refresh();
        for (const warning of output.warnings) process.stderr.write(`policy helper: ${warning}\n`);
        if (output.policy !== undefined) applyManagedPolicy(currentSession.config, output.policy as SessionConfig['managedPolicy']);
      };
      settle();
      if (interval !== undefined) {
        const timer = setInterval(() => {
          try { settle(); } catch (error) { process.stderr.write(`policy helper: refresh error: ${error instanceof Error ? error.message : String(error)}\n`); }
        }, interval);
        timer.unref?.();
        controller.signal.addEventListener('abort', () => clearInterval(timer), { once: true });
      }
    }
    runtime = await runtime.bindSession?.(currentSession) ?? runtime;
    const currentRuntime = runtime;
    process.stderr.write(`session: ${currentSession.id}\nworkspace: ${workspace}\n`);
    if (values.interactive) {
      const tui = useTui ? createTuiTerminal({ input: process.stdin, output: process.stdout,sourceInputGestures:true,
        commands: tuiCommandsWithSkills(currentSession.config.skills),
        agentTypes: currentSession.config.agentTypes,
        ...(currentRuntime.catalogListing ? { mcpCatalog: (signal: AbortSignal) =>
          currentRuntime.catalogListing!(signal).then(listing => ({
            resources: listing.resources, templates: listing.templates,
          })) } : {}),
        version: cliVersion(),
        keybindings: currentSession.config.keybindings,
        prefersReducedMotion: currentSession.config.prefersReducedMotion,
        showTurnDuration: currentSession.config.showTurnDuration,
        editorMode:currentSession.config.editorMode,vimInsertModeRemaps:currentSession.config.vimInsertModeRemaps,
        progressSettings: {timeFormat:currentSession.config.timeFormat, timeZone:currentSession.config.timeZone,
          spinnerVerbs:currentSession.config.spinnerVerbs},
        maxProseWidth: currentSession.config.maxProseWidth,
        syntaxHighlightingDisabled: currentSession.config.syntaxHighlightingDisabled,
        theme: currentSession.config.theme, userDir: currentSession.config.configSources?.userDir,
        workspace: currentSession.config.workspace, plugins: currentSession.config.plugins }) : undefined;
      const started = await new Agent(currentSession, provider, currentRuntime.buildTools(currentSession.config, currentSession.id), {
        stopState: () => currentRuntime.stopState?.(currentSession.id) ?? { background_tasks: [], session_crons: [] },
        status: text => { if (tui) tui.setStatus(text); else process.stderr.write(`${text}\n`); },
        ...(tui ? { terminalSequence: (sequence: string) => tui.writeTerminalSequence(sequence) }
          : process.stdin.isTTY && process.stdout.isTTY ? { terminalSequence: (sequence: string) => {
            const validated = formatHookTerminalSequence(sequence);
            if (validated) process.stdout.write(validated);
          } } : {}),
        hookOptions: currentRuntime.hookOptions?.(currentSession.config, currentSession.id),
      }).startSession(values.resume ? 'resume' : 'startup', controller.signal);
      await interactiveLoop(currentSession, provider, currentRuntime, { input: process.stdin, output: process.stdout,
        status: tui ? tui.statusStream : process.stderr, signal: controller.signal,
        ...(started.initialUserMessage === undefined ? {} : { initialUserMessage: started.initialUserMessage }),
        ...(started.watchPaths === undefined ? {} : { initialWatchPaths: started.watchPaths }),
        ...(tui ? { terminal: tui } : {}) });
      if (controller.signal.aborted) process.exitCode = 130;
      return;
    }
    headless = createHeadlessOutput({ format, sessionId: currentSession.id, schema,
      write: text => { process.stdout.write(text); }, writeError: text => { process.stderr.write(text); } });
    const agent = activeAgent = new Agent(currentSession, provider, currentRuntime.buildTools(currentSession.config, currentSession.id), {
      text: text => { finalText += text; headless!.text(text); }, status: status => headless!.status(status),
      interruptTurn: () => controller.abort(new Error('Hook interrupt')),
      hookOptions: currentRuntime.hookOptions?.(currentSession.config, currentSession.id),
      stopState: () => currentRuntime.stopState?.(currentSession.id) ?? { background_tasks: [], session_crons: [] },
    });
    // Run SessionStart hooks once, for startup or resume.
    const started = await agent.startSession(values.resume ? 'resume' : 'startup', controller.signal);
    // The recovered headless prologue prepends the hook's initial user message
    // to the input queue (`OXr`/`prependUserMessage`, chunk-rx2nah4x.js offset
    // 472137), so it runs as the first turn ahead of the typed prompt.
    if (started.initialUserMessage !== undefined) await agent.run(started.initialUserMessage, controller.signal, undefined, undefined, [], undefined, { kind: 'generated', source: 'session-start' });
    const rawPrompt = positionals.join(' ');
    const slash = parseSlashCommand(rawPrompt);
    const selectedSkill = slash ? findSkill(currentSession.config.skills, slash.name) : undefined;
    if (values.attach !== undefined && selectedSkill && skillRequiresExecution(selectedSkill, currentSession.config)) {
      throw new Error('Attachments with executable skills require a plain task prompt');
    }
    if (!values.continue && !demo && selectedSkill && skillRequiresExecution(selectedSkill, currentSession.config) && currentRuntime.runSkill) {
      const skill = schema === undefined ? selectedSkill : { ...selectedSkill,
        body: selectedSkill.body + `\nReturn a complete JSON value matching this schema:\n${JSON.stringify(schema)}` };
      let output = await currentRuntime.runSkill(currentSession.config, currentSession.id, skill, slash!.args, controller.signal,
        undefined, currentSession.messages);
      if (selectedSkill.background) {
        const descriptor = JSON.parse(output) as { id?: unknown };
        if (typeof descriptor.id !== 'string') throw new Error('Background skill returned no child ID');
        const getAgent = currentRuntime.buildTools(currentSession.config, currentSession.id).find(tool => tool.schema.name === 'get_agent');
        if (!getAgent) throw new Error('Background skill completion requires the session-owned get_agent tool');
        const context = { workspace: currentSession.config.workspace, signal: controller.signal,
          allowShell: currentSession.config.allowShell, maxOutputBytes: currentSession.config.maxOutputBytes };
        let completed: { status: string; reason?: string | null; model_calls?: number; summary?: string };
        try {
          do {
            controller.signal.throwIfAborted();
            output = await getAgent.execute({ id: descriptor.id, wait_ms: 30_000 }, context);
            completed = JSON.parse(output);
          } while (completed.status === 'queued' || completed.status === 'running');
        } catch (error) {
          if (!controller.signal.aborted) throw error;
          await finish('aborted', finalText, budget.snapshot().model_calls); return;
        }
        const successful = completed.status === 'completed' &&
          (completed.reason === 'end_turn' || completed.reason === 'stop_sequence');
        await finish(successful ? completed.reason! : completed.status === 'cancelled' ? 'aborted' : completed.reason ?? completed.status,
          schema === undefined ? output : completed.summary ?? '', completed.model_calls ?? 0);
        return;
      }
      if (selectedSkill.context === 'fork' || selectedSkill.model || selectedSkill.effort || selectedSkill.background || selectedSkill.hooks || selectedSkill.allowedTools) {
        const child = JSON.parse(output) as { reason: string; model_calls: number; text: string };
        await finish(child.reason, schema === undefined ? output : child.text, child.model_calls); return;
      }
      const result = await agent.run(output, controller.signal, undefined, { expansion_type: 'slash_command', command_name: slash!.name, command_args: slash!.args, prompt: rawPrompt });
      await finish(result.reason, result.text, result.modelCalls);
      return;
    }
    let prompt = values.continue
      ? undefined
      : demo
        ? 'Write hello.txt and read it back.'
        : expandOneShot(positionals.join(' '), currentSession.config);
    if (schema !== undefined && prompt !== undefined) prompt += `\nReturn a complete JSON value matching this schema:\n${JSON.stringify(schema)}`;
    const result = await agent.run(prompt, controller.signal, values.attach === undefined ? undefined
      : { path: values.attach, ...(values.pages === undefined ? {} : { pages: values.pages }) }, selectedSkill && slash
        ? { expansion_type: 'slash_command', command_name: slash.name, command_args: slash.args, prompt: rawPrompt } : undefined);
    await finish(result.reason, result.text, result.modelCalls);
    if (demo && fs.readFileSync(path.join(workspace, 'hello.txt'), 'utf8') !== 'Hello from the independent agent.\n') throw new Error('Demo verification failed');
  } catch (error) {
    if (!headless) throw error;
    const reason = error instanceof UsageBudgetExceeded || budget.snapshot().exceeded.length ? 'budget_exceeded'
      : controller.signal.aborted ? 'aborted' : 'error';
    headless.event({ type: 'error', code: reason, message: error instanceof Error ? error.message : String(error) });
    await finish(reason, finalText, budget.snapshot().model_calls);
  } finally {
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onInterrupt);
    try {
      if (activeAgent) {
        try { await activeAgent.endSession(controller.signal.aborted ? 'interrupt' : 'other'); }
        catch (error) { process.stderr.write(`SessionEnd hook error: ${error instanceof Error ? error.message : String(error)}\n`); }
      }
    } finally {
      try { if (runtime) await runtime.close(); } finally { session?.close(); }
    }
  }
}
main().catch((error: unknown) => {
  process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
