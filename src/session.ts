import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { refreshAutoMode } from './plan-resume.js';
import { createPlanRuntime } from './plan-runtime-host.js';
import { classifierMessageSchema, classifierMessage, markClassifierMessage } from './message-origin.js';
import { z } from 'zod';
import { effortSelectionSchema, modelSettingsSchema, type EffortSelection, type ModelSettings } from './effort-command.js';
import type Anthropic from '@anthropic-ai/sdk';
import type { GatewayConfig } from './provider.js';
import { parseTheme, type ThemeSetting } from './tui-theme-state.js';
import { HOOK_EVENTS, hooksSchema, type HooksConfig } from './hooks.js';
import { autoPolicySchema, permissionPolicySchema, emptySessionPermissionUpdates, seedPermissionUpdates, bindPermissionOwner, reloadPermissionState, childPermissionState, type LivePermissionOwner, applyPermissionUpdates, type PermissionUpdate, type PermissionPolicy, type SessionPermissionUpdates } from './permissions.js';
import { persistPermissionUpdate, permissionSettingsPaths, type PermissionWriteResult, type PermissionIgnoreResult } from './permission-settings.js';
import { AutoModeDenialStore, permissionRetryMessage } from './permission-denials.js';
import { observeWorkingDirectory, type WorkingDirectories } from './path-identity.js';
import { defaultUserDir } from './config.js';
import type { SkillInfo, ConditionalRule, InstructionSource } from './config.js';
import { mcpServersSchema, type McpServerConfig } from './mcp.js';
import { lspConfigSchema, type LspConfig } from './lsp.js';
import { keybindingsSchema } from './keybindings.js';
import type { Keybindings } from './terminal.js';
import { webSearchConfigSchema, type WebSearchConfig } from './web-search.js';
import { pluginConfigSchema, type PluginConfig } from './plugins.js';
import { agentTypesSchema, type AgentTypeInfo } from './agent-types.js';
import { clearCheckpointAssociation, recoverCheckpointAssociations } from './checkpoints.js';
import { spinnerVerbsSchema } from './tui-progress-settings.js';
import { statusLineSchema } from './tui-statusline-schema.js';
import { editorModeSchema, vimRemapsSchema } from './tui-vim.js';
import type { StoredToolUseResult } from './tool-use-result.js';

export type SessionConfig = {
  model: string;
  system: string;
  tools: Anthropic.Tool[];
  workspace: string;
  allowShell: boolean;
  maxOutputBytes: number;
  maxTokens: number;
  contextTokens: number;
  compactAt: number;
  autoCompactEnabled?: boolean;
  maxTurns: number;
  stopHookBlockCap?: number;
  automaticCheckpoints?: boolean;
  thinking: boolean;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  modelSettings?: ModelSettings;
  effortSelection?: EffortSelection;
  childMode?: 'explore' | 'general';
  gateway?: GatewayConfig;
  hooks?: HooksConfig;
  permissions?: PermissionPolicy;
  /** Per-spawn `agent({bashCommandClamp})` groups. Every reading of a shell
   *  command has to match a rule in every group (source `fTr`). */
  bashCommandClamp?: string[][];
  /** Per-spawn `agent({stallMs})`: abort a model request that makes no progress
   *  for this many milliseconds (source `AGr`/`_0t`). */
  stallMs?: number;
  managedPolicy?: { allowShell?: boolean; permissions?: PermissionPolicy;
    features?: Partial<NonNullable<SessionConfig['features']>>; mcpClient?: SessionConfig['mcpClient'] };
  policyHelper?: { path: string; intervalMs?: number; defaultPolicy?: SessionConfig['managedPolicy'] };
  skills?: SkillInfo[];
  /** Bumped when the installed plugin catalog changes under a live session. */
  pluginGeneration?: number;
  /** Conditional skills held back by `paths`; activation moves them into `skills`.
   *  Journaled with the session metadata: a resumed session keeps the same held
   *  list, and activation survives a reload because the list is replaced from
   *  the new load. */
  heldSkills?: SkillInfo[];
  /** `<HARNESS_DIR>/skills` directories discovered beside a touched path.
   *  The recovered `dAr` keeps the same per-session set and never rescans a
   *  candidate (chunk-sfn1dbxq.js offset 3396597); the set is journaled with
   *  the session so a resume keeps its discovered catalogs. */
  dynamicSkillDirs?: string[];
  /** Instruction files loaded for the eager InstructionsLoaded raise. */
  instructionSources?: InstructionSource[];
  conditionalRules?: ConditionalRule[];
  keybindings?: Keybindings;
  prefersReducedMotion?: boolean;
  showTurnDuration?: boolean;
  showMessageTimestamps?: boolean;
  /** `/focus`'s persisted view mode; `focus` is the brief transcript. */
  viewMode?: import('./focus-command.js').FocusMode;
  /** The live Verbose output switch (`Te`); `viewMode` supplies its startup value. */
  verbose?: boolean;
  /** `progressBar`/`terminalProgressBarEnabled`: OSC 9;4 progress while the agent runs. */
  terminalProgressBarEnabled?: boolean;
  timeFormat?: string;
  timeZone?: string;
  spinnerVerbs?: import('./tui-progress-settings.js').SpinnerVerbs;
  editorMode?: import('./tui-vim.js').EditorMode;
  vimInsertModeRemaps?: Record<string,unknown>;
  maxProseWidth?: number;
  /** `Kdt`: idle time before the question dialog auto-continues; absent means never. */
  askUserQuestionTimeout?: '60s' | '5m' | '10m' | 'never';
  /** `Ade`/`onn`: how long a held peer message awaits approval; absent is 5m. */
  dialogExpiry?: '60s' | '5m' | '10m' | 'never';
  syntaxHighlightingDisabled?: boolean;
  /** Composer workflow-keyword gates: the `dg` availability switch and the `C7t` trigger setting. */
  enableWorkflows?: boolean;
  workflowKeywordTriggerEnabled?: boolean;
  /** The `:name:` emoji typeahead. Absent or true enables it. */
  emojiCompletionEnabled?: boolean;
  theme?: ThemeSetting;
  statusLine?: import('./tui-statusline.js').StatusLineSetting;
  webSearch?: WebSearchConfig;
  plugins?: PluginConfig;
  agentTypes?: AgentTypeInfo[];
  mcpServers?: Record<string, McpServerConfig>;
  /**
   * Project-declared MCP servers held for approval. They are never connected
   * while held, and each entry records why: never approved, or approved and
   * then edited.
   */
  heldMcpServers?: { name: string; fingerprint: string; reason: 'unapproved' | 'declaration-changed' }[];
  mcpClient?: { roots?: boolean; sampling?: boolean; samplingImages?: boolean; samplingArrays?: boolean; samplingAudio?: boolean; elicitation?: boolean };
  autoMemory?: boolean;
  dynamicInstructions?: boolean;
  watchConfig?: boolean;
  worktreeReturn?: string;
  configSources?: { userDir?: string; settingsFile?: string; managedSettingsFile?: string; overrides?: {
    autoMemory?: boolean; watchConfig?: boolean; allowShell?: boolean; permissions?: PermissionPolicy;
    mcpClient?: { roots?: boolean; sampling?: boolean; samplingImages?: boolean; samplingArrays?: boolean; samplingAudio?: boolean; elicitation?: boolean }; tasks?: boolean; subagents?: boolean;
  } };
  lspServers?: LspConfig;
  features?: { tasks: boolean; subagents: boolean; notebooks?: boolean; background?: boolean; scheduler?: boolean;
    workflowPersistence?: boolean; mcpSubscriptions?: boolean; mcpLogging?: boolean; mcpNotificationStream?: boolean; mcpRecovery?: boolean; mcpPersistence?: boolean; mcpTasks?: boolean; mcpStandardTasks?: boolean;
    taskProjections?: boolean;
    schedulerJitter?: boolean; skillInlineCommands?: boolean; skillQuotedArguments?: boolean; skillArgumentFallback?: boolean; skillExtendedArguments?: boolean; pluginSkillNamespaces?: boolean;
    agentMessaging?: boolean; agentIdle?: boolean; agentTypes?: boolean; interaction?: boolean; web?: boolean; lsp?: boolean; checkpoints?: boolean; worktrees?: boolean; memory?: boolean; media?: boolean; workflow?: boolean; mcpCatalog?: boolean; mcpDynamic?: boolean; mcpDeferred?: boolean; policyHelper?: boolean; crossSessionMessaging?: boolean };
  /** Explicit inbound policy for same-host peer messages; omitted follows the mode. */
  crossSessionInbound?: 'accept' | 'hold' | 'refuse';
};
export type ToolResult = Anthropic.ToolResultBlockParam;
import { permissionModeCommandSchema, type PermissionModeCommand } from './plan-resume.js';
export type SessionEvent =
  | PermissionModeCommand
  | { kind: 'metadata'; version: 1; id: string; config: SessionConfig; fingerprint: string; startedAt?: number }
  | { kind: 'file_history'; path?: string; tracked: boolean }
  | { kind: 'message'; message: Anthropic.MessageParam; response?: Anthropic.Message; isMeta?: boolean; classifier?: import('./message-origin.js').ClassifierMessage }
  | { kind: 'mcp_subscription'; server: string; configDigest: string; method: 'resources/subscribe' | 'resources/unsubscribe'; uri: string }
  | { kind: 'mcp_task'; server: string; configDigest: string; taskId: string; tool: string; createdAt: string; ttl: number | null; resolved: boolean; result?: string; isError?: boolean }
  | { kind: 'tool_start'; id: string; name: string }
  | { kind: 'tool_result'; result: ToolResult; host?: StoredToolUseResult }
  | { kind: 'tool_output'; result: ToolResult }
  | { kind: 'hook_once'; event: string; key: string }
  | { kind: 'checkpoint'; name: string; digest: string; boundary: number }
  | { kind: 'rewind'; source: string; boundary: number; checkpoint: string; digest: string }
  | { kind: 'title'; title: string }
  | { kind: 'session_color'; color: import('./session-color.js').SessionColor | null }
  | { kind: 'refusal'; model: string; category?: string; explanation?: string; requestId?: string }
  | { kind: 'branch'; source: string; workspace: string; boundary: number; reason: 'fork' | 'rewind' | 'reload' | 'configuration' | 'relocation' }
  | { kind: 'hook_start'; id: string; event: string; toolUseId?: string }
  | { kind: 'hook_terminal'; id: string; event: string; sequences: string[] }
  | { kind: 'instruction_watch'; workspace: string; paths: string[] }
  | { kind: 'stop_hook_count'; count: number; hookId?: string }
  | { kind: 'hook_result'; id: string; event: string; blocked: boolean; reason?: string; additionalContext: string[]; stopRequested?: boolean; suppressOutput?: boolean; systemMessages?: string[]; terminalSequences?: string[]; userDisplayMessage?: string }
  | { kind: 'compact'; summary: string; response: Anthropic.Message }
  | { kind: 'turn_end'; reason: string; duration?: import('./tui-progress.js').TurnDuration };

const policyFeaturesSchema = z.object({ tasks: z.boolean().optional(), subagents: z.boolean().optional(), notebooks: z.boolean().optional(), background: z.boolean().optional(), scheduler: z.boolean().optional(),
  workflowPersistence: z.boolean().optional(), mcpSubscriptions: z.boolean().optional(), mcpLogging: z.boolean().optional(), mcpNotificationStream: z.boolean().optional(), mcpRecovery: z.boolean().optional(), mcpPersistence: z.boolean().optional(), mcpTasks: z.boolean().optional(), mcpStandardTasks: z.boolean().optional(), taskProjections: z.boolean().optional(), schedulerJitter: z.boolean().optional(), skillInlineCommands: z.boolean().optional(), skillQuotedArguments: z.boolean().optional(), skillArgumentFallback: z.boolean().optional(), skillExtendedArguments: z.boolean().optional(), pluginSkillNamespaces: z.boolean().optional(),
  agentMessaging: z.boolean().optional(), agentIdle: z.boolean().optional(), agentTypes: z.boolean().optional(), interaction: z.boolean().optional(), web: z.boolean().optional(), lsp: z.boolean().optional(), checkpoints: z.boolean().optional(), worktrees: z.boolean().optional(), memory: z.boolean().optional(), media: z.boolean().optional(), workflow: z.boolean().optional(), mcpCatalog: z.boolean().optional(), mcpDynamic: z.boolean().optional(), mcpDeferred: z.boolean().optional(), policyHelper: z.boolean().optional() }).strict();
export const managedPolicySchema = z.object({ useAutoModeDuringPlan: z.boolean().optional(), autoMode: autoPolicySchema.optional(), allowManagedPermissionRulesOnly: z.boolean().optional(), allowShell: z.boolean().optional(), permissions: permissionPolicySchema.optional(),
  features: policyFeaturesSchema.optional(), mcpClient: z.object({ roots: z.boolean().optional(), sampling: z.boolean().optional(), samplingImages: z.boolean().optional(), samplingArrays: z.boolean().optional(), samplingAudio: z.boolean().optional(), elicitation: z.boolean().optional() }).strict().optional() }).strict();

/** Pin only authored fields; permission arrays replace rather than concatenate. */
export function applyManagedPolicy(config: SessionConfig, policy: SessionConfig['managedPolicy']): void {
  if (policy === undefined) { delete config.managedPolicy; return; }
  const parsed = managedPolicySchema.parse(policy);
  config.managedPolicy = structuredClone(parsed);
  if (parsed.allowShell !== undefined) config.allowShell = parsed.allowShell;
  if (parsed.permissions !== undefined) config.permissions = { ...structuredClone(parsed.permissions),
    ...(config.permissions?.layers === undefined ? {} : { layers: config.permissions.layers }) };
  if (parsed.allowManagedPermissionRulesOnly !== undefined && config.permissions) config.permissions.managedOnly = parsed.allowManagedPermissionRulesOnly;
  if (parsed.features) config.features = { tasks: true, subagents: true, ...config.features, ...parsed.features };
  if (parsed.mcpClient) config.mcpClient = { ...config.mcpClient, ...parsed.mcpClient };
}

export const configSchema = z.object({
  model: z.string().min(1), system: z.string(), tools: z.array(z.object({ name: z.string() }).passthrough()),
  workspace: z.string(), allowShell: z.boolean(), maxOutputBytes: z.number().int().positive(),
  maxTokens: z.number().int().positive(), contextTokens: z.number().int().positive(),
  compactAt: z.number().int().positive(), autoCompactEnabled: z.boolean().optional(),
  maxTurns: z.number().int().positive(), thinking: z.boolean(),
  stopHookBlockCap: z.number().int().min(0).max(1024).optional(),
  automaticCheckpoints: z.boolean().optional(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
  modelSettings: modelSettingsSchema.optional(),
  effortSelection: effortSelectionSchema.optional(),
  childMode: z.enum(['explore', 'general']).optional(),
  gateway: z.object({
    baseURL: z.string().url().refine(value => { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.search && !u.hash; }, 'Use an HTTP(S) endpoint without credentials, query or fragment'),
    auth: z.enum(['bearer', 'api-key']), tokenCounting: z.enum(['estimate', 'api']),
    promptCaching: z.boolean(), eagerToolInput: z.boolean(),
  }).strict().optional(),
  hooks: hooksSchema.optional(),
  permissions: permissionPolicySchema.optional(),
  /** Explicit same-host inbound policy; omitted follows the permission mode. */
  crossSessionInbound: z.enum(['accept', 'hold', 'refuse']).optional(),
  bashCommandClamp: z.array(z.array(z.string().min(1)).min(1)).min(1).optional(),
  stallMs: z.number().finite().optional(),
  managedPolicy: managedPolicySchema.optional(),
  // Opt-in managed-settings helper. Distinct from `managedSettingsFile`, which
  // is read once and is fatal when unusable: a helper is expected to change under
  // the session, so a failed read degrades to its static default or to the last
  // successful output, while a structurally invalid document is still refused.
  policyHelper: z.object({ path: z.string().min(1),
    intervalMs: z.number().int().positive().max(86_400_000).optional(),
    defaultPolicy: managedPolicySchema.optional() }).strict().optional(),
  skills: z.array(z.object({ name: z.string().min(1), description: z.string(), path: z.string(), body: z.string(), source: z.enum(['userSettings', 'projectSettings', 'plugin']).optional(), format: z.enum(['skill', 'command']).optional(), plugin: z.string().optional(), disallowedTools: z.array(z.string()).optional(), userInvocable: z.boolean(), disableModelInvocation: z.boolean(),
    paths: z.array(z.string()).optional(),
    allowedTools: z.array(z.string()).optional(), argumentNames: z.array(z.string().refine(name => name.trim() !== '' && !/^\d+$/.test(name), 'argument names must be non-empty and not all digits')).optional(), model: z.string().optional(), effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(), context: z.literal('fork').optional(), agent: z.string().trim().min(1).max(128).optional(), background: z.boolean().optional(),
    aliases: z.array(z.string().min(1).max(128).regex(/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/)).max(32).refine(names => new Set(names).size === names.length).optional(),
    hooks: hooksSchema.optional(), command: z.string().optional(), shell: z.string().optional(), metadata: z.record(z.unknown()).optional(), limitations: z.array(z.string()).optional(),
  }).strict()).optional(),
  heldSkills: z.array(z.object({ name: z.string().min(1), description: z.string(), path: z.string(), body: z.string(), source: z.enum(['userSettings', 'projectSettings', 'plugin']).optional(), format: z.enum(['skill', 'command']).optional(), plugin: z.string().optional(), disallowedTools: z.array(z.string()).optional(), userInvocable: z.boolean(), disableModelInvocation: z.boolean(),
    paths: z.array(z.string()).min(1),
    allowedTools: z.array(z.string()).optional(), argumentNames: z.array(z.string()).optional(), model: z.string().optional(), effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(), context: z.literal('fork').optional(), agent: z.string().trim().min(1).max(128).optional(), background: z.boolean().optional(),
    aliases: z.array(z.string()).optional(),
    hooks: hooksSchema.optional(), command: z.string().optional(), shell: z.string().optional(), metadata: z.record(z.unknown()).optional(), limitations: z.array(z.string()).optional(),
  }).strict()).optional(),
  dynamicSkillDirs: z.array(z.string().min(1)).optional(),
  keybindings: keybindingsSchema.optional(),
  prefersReducedMotion: z.boolean().optional(),
  showTurnDuration: z.boolean().optional(),
  showMessageTimestamps: z.boolean().optional(),
  viewMode: z.enum(['default', 'verbose', 'focus']).optional(),
  verbose: z.boolean().optional(),
  terminalProgressBarEnabled: z.boolean().optional(),
  timeFormat: z.string().optional(),
  timeZone: z.string().optional(),
  spinnerVerbs: spinnerVerbsSchema.optional(),
  editorMode: editorModeSchema,
  vimInsertModeRemaps: vimRemapsSchema,
  maxProseWidth: z.number().int().min(40).optional(),
  // Recovered schema: enum with `.catch(void 0)`, so an invalid value is unset.
  askUserQuestionTimeout: z.enum(['60s', '5m', '10m', 'never']).optional().catch(undefined),
  dialogExpiry: z.enum(['60s', '5m', '10m', 'never']).optional().catch(undefined),
  syntaxHighlightingDisabled: z.boolean().optional(),
  // `enableWorkflows` and `workflowKeywordTriggerEnabled` are the two settings the composer's
  // workflow-keyword gate reads (chunk-c5zwk83v.js `dg`/`C7t`).
  enableWorkflows: z.boolean().optional(),
  workflowKeywordTriggerEnabled: z.boolean().optional(),
  // The `:name:` emoji typeahead switch (`chunk-24k7d6mw.js` `Kl().emojiCompletionEnabled`).
  emojiCompletionEnabled: z.boolean().optional(),
  theme: z.string().refine(value => parseTheme(value) !== undefined, 'Invalid theme').optional(),
  statusLine: statusLineSchema,
  webSearch: webSearchConfigSchema.optional(),
  plugins: pluginConfigSchema.optional(),
  agentTypes: z.lazy(() => agentTypesSchema).optional(),
  conditionalRules: z.array(z.object({ path: z.string(), content: z.string(), patterns: z.array(z.string()),
    imports: z.array(z.object({ path: z.string(), content: z.string(), parent: z.string().optional() }).strict()).optional(),
  }).strict()).optional(),
  instructionSources: z.array(z.object({ path: z.string(), parent: z.string().optional(),
    globs: z.array(z.string()).optional() }).strict()).optional(),
  mcpServers: mcpServersSchema.optional(),
  heldMcpServers: z.array(z.object({ name: z.string().min(1).max(256), fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.enum(['unapproved', 'declaration-changed']) }).strict()).optional(),
  mcpClient: z.object({ roots: z.boolean().optional(), sampling: z.boolean().optional(), samplingImages: z.boolean().optional(), samplingArrays: z.boolean().optional(), samplingAudio: z.boolean().optional(), elicitation: z.boolean().optional() }).strict().optional(),
  autoMemory: z.boolean().optional(),
  dynamicInstructions: z.boolean().optional(),
  watchConfig: z.boolean().optional(),
  worktreeReturn: z.string().min(1).optional(),
  configSources: z.object({ userDir: z.string().optional(), settingsFile: z.string().optional(), managedSettingsFile: z.string().optional(), overrides: z.object({
    autoMemory: z.boolean().optional(), watchConfig: z.boolean().optional(), allowShell: z.boolean().optional(), permissions: permissionPolicySchema.optional(),
    mcpClient: z.object({ roots: z.boolean().optional(), sampling: z.boolean().optional(), samplingImages: z.boolean().optional(), samplingArrays: z.boolean().optional(), samplingAudio: z.boolean().optional(), elicitation: z.boolean().optional() }).strict().optional(),
    tasks: z.boolean().optional(), subagents: z.boolean().optional(),
  }).strict().optional() }).strict().optional(),
  lspServers: lspConfigSchema.optional(),
  pluginGeneration: z.number().int().nonnegative().optional(),
  features: z.object({ tasks: z.boolean(), subagents: z.boolean(), notebooks: z.boolean().optional(), background: z.boolean().optional(), scheduler: z.boolean().optional(),
    workflowPersistence: z.boolean().optional(), mcpSubscriptions: z.boolean().optional(), mcpLogging: z.boolean().optional(), mcpNotificationStream: z.boolean().optional(), mcpRecovery: z.boolean().optional(), mcpPersistence: z.boolean().optional(), mcpTasks: z.boolean().optional(), mcpStandardTasks: z.boolean().optional(),
    taskProjections: z.boolean().optional(),
    schedulerJitter: z.boolean().optional(), skillInlineCommands: z.boolean().optional(), skillQuotedArguments: z.boolean().optional(), skillArgumentFallback: z.boolean().optional(), skillExtendedArguments: z.boolean().optional(), pluginSkillNamespaces: z.boolean().optional(),
    agentMessaging: z.boolean().optional(), agentIdle: z.boolean().optional(), agentTypes: z.boolean().optional(), interaction: z.boolean().optional(), web: z.boolean().optional(), lsp: z.boolean().optional(), checkpoints: z.boolean().optional(), worktrees: z.boolean().optional(), memory: z.boolean().optional(), media: z.boolean().optional(), workflow: z.boolean().optional(), mcpCatalog: z.boolean().optional(), mcpDynamic: z.boolean().optional(), mcpDeferred: z.boolean().optional(), policyHelper: z.boolean().optional(), crossSessionMessaging: z.boolean().optional() }).strict().optional(),
}).strict();
const messageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]) }).strict();
const responseSchema = z.object({ role: z.literal('assistant'), content: z.array(z.object({ type: z.string() }).passthrough()), stop_reason: z.string().nullable() }).passthrough();
const resultSchema = z.object({ type: z.literal('tool_result'), tool_use_id: z.string().min(1), content: z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]), is_error: z.boolean().optional() }).strict();
// The stored host row (`TRn`): hunks the turn-diff walk counts, plus the fields a row needs to be
// recognized at all. A create keeps its content because an empty patch leaves no other body.
const patchHunkSchema = z.object({ oldStart: z.number().int(), oldLines: z.number().int(),
  newStart: z.number().int(), newLines: z.number().int(), lines: z.array(z.string()) }).strict();
const storedToolUseResultSchema = z.union([
  z.object({ type: z.literal('create'), filePath: z.string().min(1), content: z.string(), structuredPatch: z.array(patchHunkSchema) }).strict(),
  z.object({ type: z.literal('update'), filePath: z.string().min(1), structuredPatch: z.array(patchHunkSchema) }).strict(),
  z.object({ filePath: z.string().min(1), oldString: z.string(), newString: z.string(), structuredPatch: z.array(patchHunkSchema), replaceAll: z.boolean() }).strict(),
]);
const eventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('metadata'), version: z.literal(1), id: z.string().uuid(), config: configSchema,
    fingerprint: z.string(), startedAt: z.number().finite().nonnegative().optional() }).strict(),
  z.object({ kind: z.literal('permission_mode_command'), operation: z.enum(['enter', 'exit', 'select']),
    mode: permissionPolicySchema.shape.mode, command: z.enum(['plan', 'permissions']) }).strict(),
  z.object({ kind: z.literal('file_history'), path: z.string().min(1).optional(), tracked: z.boolean() }).strict(),
  z.object({ kind: z.literal('message'), message: messageSchema, response: responseSchema.optional(), isMeta: z.boolean().optional(), classifier: classifierMessageSchema.optional() }).strict(),
  z.object({ kind: z.literal('mcp_subscription'), server: z.string().min(1).max(256), configDigest: z.string().regex(/^[a-f0-9]{64}$/),
    method: z.enum(['resources/subscribe', 'resources/unsubscribe']), uri: z.string().min(1).refine(value => Buffer.byteLength(value) <= 4096 && !/[\x00-\x20\x7f]/.test(value)) }).strict(),
  z.object({ kind: z.literal('mcp_task'), server: z.string().min(1).max(256), configDigest: z.string().regex(/^[a-f0-9]{64}$/), taskId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/), tool: z.string().min(1).max(256), createdAt: z.string().datetime({ offset: true }), ttl: z.number().finite().int().nonnegative().nullable(), resolved: z.boolean(), isError: z.boolean().optional(), result: z.string().refine(value => Buffer.byteLength(value) <= 24000).optional() }).strict(),
  z.object({ kind: z.literal('tool_start'), id: z.string(), name: z.string() }).strict(),
  z.object({ kind: z.literal('tool_result'), result: resultSchema, host: storedToolUseResultSchema.optional() }).strict(),
  z.object({ kind: z.literal('tool_output'), result: resultSchema }).strict(),
  z.object({ kind: z.literal('title'), title: z.string().min(1).max(200).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)) }).strict(),
  z.object({ kind: z.literal('session_color'), color: z.enum(['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan']).nullable() }).strict(),
  z.object({ kind: z.literal('refusal'), model: z.string().min(1).max(256).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)),
    category: z.string().min(1).max(64).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)).optional(),
    explanation: z.string().min(1).max(1024).refine(value => !/[\x00-\x1f\x7f-\x9f]/.test(value)).optional(),
    requestId: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/).optional() }).strict(),
  z.object({ kind: z.literal('branch'), source: z.string().uuid(), workspace: z.string().min(1), boundary: z.number().int().nonnegative(), reason: z.enum(['fork', 'rewind', 'reload', 'configuration', 'relocation']) }).strict(),
  z.object({ kind: z.literal('checkpoint'), name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), digest: z.string().regex(/^[a-f0-9]{64}$/), boundary: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal('rewind'), source: z.string().uuid(), boundary: z.number().int().nonnegative(), checkpoint: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ kind: z.literal('hook_once'), event: z.enum(HOOK_EVENTS), key: z.string().max(256).regex(/^[A-Za-z]+:(?:0|[1-9]\d{0,3}):(?:flat|0|[1-9]\d{0,3}):[a-f0-9]{64}$/) }).strict(),
  z.object({ kind: z.literal('hook_start'), id: z.string(), event: z.string(), toolUseId: z.string().optional() }).strict(),
  z.object({ kind: z.literal('stop_hook_count'), count: z.number().int().min(0).max(1024), hookId: z.string().optional() }).strict(),
  z.object({ kind: z.literal("instruction_watch"), workspace: z.string().min(1),
    paths: z.array(z.string().min(1).refine(value => path.isAbsolute(value) && Buffer.byteLength(value) <= 4096)).max(2048)
      .refine(values => Buffer.byteLength(JSON.stringify(values)) <= 65536) }).strict(),
  z.object({ kind: z.literal('hook_terminal'), id: z.string(), event: z.string(),
    sequences: z.array(z.string().min(1).refine(value => Buffer.byteLength(value) <= 4096)).max(128)
      .refine(values => values.reduce((total, value) => total + Buffer.byteLength(value), 0) <= 32768) }).strict(),
  z.object({ kind: z.literal('hook_result'), id: z.string(), event: z.string(), blocked: z.boolean(), reason: z.string().optional(), additionalContext: z.array(z.string()), stopRequested: z.boolean().optional(), suppressOutput: z.boolean().optional(), systemMessages: z.array(z.string()).optional(), userDisplayMessage: z.string().optional(),
    terminalSequences: z.array(z.string().min(1).refine(value => Buffer.byteLength(value) <= 4096)).max(128)
      .refine(values => values.reduce((total, value) => total + Buffer.byteLength(value), 0) <= 32768).optional() }).strict(),
  z.object({ kind: z.literal('compact'), summary: z.string().min(1), response: responseSchema }).strict(),
  z.object({ kind: z.literal('turn_end'), reason: z.string(), duration: z.object({uuid:z.string().uuid(),
    durationMs:z.number().finite().nonnegative(), timestamp:z.string().datetime({offset:true})}).strict().optional() }).strict(),
]).superRefine((record, context) => {
  if (record.kind === 'permission_mode_command') {
    if (!permissionModeCommandSchema.safeParse(record).success) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid local permission mode command' });
    return;
  }
  if (record.kind !== 'hook_once') return;
  const [event, entry, inner] = record.key.split(':');
  if (event !== record.event || Number(entry) >= 1024 || (inner !== 'flat' && Number(inner) >= 1024)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid once hook journal identity' });
  }
});

export const fingerprint = (config: SessionConfig): string => createHash('sha256').update(JSON.stringify(config)).digest('hex');

export class Session {
  readonly id: string;
  readonly config: SessionConfig;
  readonly file: string;
  readonly events: SessionEvent[];
  readonly startedAt: number;
  private fileHistoryValue = { trackSequence: 0, trackedFiles: new Set<string>() };
  private readonly fileHistoryListeners = new Set<() => void>();
  /** Destination buckets are session-owned; settings writes settle independently of memory. */
  permissionUpdates: SessionPermissionUpdates = emptySessionPermissionUpdates();
  readonly permissionWriteResults: PermissionWriteResult[] = [];
  readonly permissionIgnoreResults: PermissionIgnoreResult[] = [];
  /** The auto-mode classifier's recent refusals, the `/permissions` `recent` tab's list. */
  readonly autoModeDenials = new AutoModeDenialStore();
  private readonly pendingPermissionWrites = new Set<Promise<void>>();
  private readonly permissionListeners = new Set<() => void>();

  subscribePermissions(listener: () => void): () => void {
    this.permissionListeners.add(listener);
    return () => { this.permissionListeners.delete(listener); };
  }

  private readonly directoryObservations = new Map<string, readonly string[]>();

  private inheritedPermissions?: { owner: LivePermissionOwner; allowedTools?: readonly string[] };
  private permissionAdoptionOwner?: LivePermissionOwner;
  private readonly autoRuntime = createPlanRuntime();
  prepareAutoMode(): void {
    if (this.inheritedPermissions) { this.inheritedPermissions.owner.prepareAutoMode?.(); return; }
    const mode = this.permissionUpdates.mode ?? this.config.permissions?.mode;
    if (mode === undefined || mode !== 'auto' && mode !== 'plan' && this.permissionUpdates.strippedDangerousRules === undefined) return;
    this.permissionUpdates = refreshAutoMode(this.permissionUpdates, mode, this.autoRuntime);
  }
  readonly permissionOwner: LivePermissionOwner = {
    prepareAutoMode: () => this.prepareAutoMode(),
    state: () => this.inheritedPermissions
      ? childPermissionState(this.inheritedPermissions.owner.state(), this.inheritedPermissions.allowedTools)
      : { ...this.permissionUpdates, mode: this.permissionUpdates.mode ?? this.config.permissions?.mode },
    workingDirectories: readOnly => this.workingDirectories(readOnly),
    adoptUpdates: updates => this.adoptPermissionUpdates(updates),
  };

  /** Rir sfn [2539631,2543941), eXn rgay [1086,1317), UTF-16. Both child lanes share session adoption. */
  inheritPermissionAdoption(owner: LivePermissionOwner): void {
    this.permissionAdoptionOwner = owner;
  }

  inheritPermissions(owner: LivePermissionOwner, allowedTools?: readonly string[]): void {
    this.inheritPermissionAdoption(owner);
    this.inheritedPermissions = { owner, allowedTools };
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
  }

  /** HV, 24k7d6mw [348500,351100), UTF-16. Ordinary fork retains the live context without settings rehydration. */
  carryForkPermissions(previous: Session): void {
    const { contentRuleOwner, ...state } = previous.permissionOwner.state();
    this.permissionUpdates = { ...structuredClone(state), contentRuleOwner };
    this.directoryObservations.clear();
    for (const [directory, observations] of previous.directoryObservations) {
      this.directoryObservations.set(directory, [...observations]);
    }
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
  }

  /** IFt/FVt retain the live owner across a local configuration branch. */
  carryPermissions(previous: Session, preserveMode = true): void {
    this.permissionUpdates = reloadPermissionState(previous.permissionOwner.state(), this.config.permissions,
      this.config.workspace, this.config.configSources?.userDir ?? defaultUserDir());
    // The source builds `isBypassPermissionsModeAvailable` once per session context and `UBt`
    // reads it for the cycle; a live mode change must not revoke a launch-granted availability.
    if (previous.permissionOwner.state().isBypassPermissionsModeAvailable)
      this.permissionUpdates.isBypassPermissionsModeAvailable = true;
    if (!preserveMode) delete this.permissionUpdates.mode;
    this.directoryObservations.clear();
    for (const [directory, observations] of previous.directoryObservations) {
      if (this.permissionUpdates.additionalWorkingDirectories.has(directory)) this.directoryObservations.set(directory, observations);
    }
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
    this.workingDirectories(false);
  }

  workingDirectories(readOnly: boolean): string[] & WorkingDirectories {
    if (this.inheritedPermissions) {
      const parent = this.inheritedPermissions.owner.workingDirectories(readOnly);
      const directories = [...parent];
      Object.defineProperty(directories, 'rootSpellings', { value: 'rootSpellings' in parent ? parent.rootSpellings : [] });
      return directories;
    }
    const entries = [...this.permissionUpdates.additionalWorkingDirectories.values()]
      .filter(directory => !(readOnly && this.config.permissions?.blockReadsOutsideWorkingDirectories && directory.source === 'projectSettings'));
    for (const directory of entries) {
      if (!this.directoryObservations.has(directory.path)) this.directoryObservations.set(directory.path,
        observeWorkingDirectory(this.config.workspace, directory.path));
    }
    const valid = entries.filter(directory => (this.directoryObservations.get(directory.path)?.length ?? 0) > 0);
    const directories = valid.map(directory => directory.path);
    Object.defineProperty(directories, 'rootSpellings', { value: valid.flatMap(directory => this.directoryObservations.get(directory.path) ?? []) });
    return directories;
  }

  /** CUt [3459,3835), O1 [199668,199720), UTF-16. Memory commits before queued persistence. */
  adoptPermissionUpdates(updates: readonly PermissionUpdate[]): ReturnType<typeof applyPermissionUpdates> {
    if (this.closed) throw new Error('Session is closed');
    // sxr sfn [3317869,3319984), UTF-16. Reduce against latest shared authority, then persist there.
    if (this.permissionAdoptionOwner?.adoptUpdates) return this.permissionAdoptionOwner.adoptUpdates(updates);
    const outcome = applyPermissionUpdates(this.permissionUpdates, updates);
    if (outcome.blocked !== undefined) return outcome;
    this.permissionUpdates = outcome.state;
    for (const update of outcome.applied ?? []) {
      if (update.type === 'removeDirectories') for (const directory of update.directories) this.directoryObservations.delete(directory);
    }
    for (const directory of this.directoryObservations.keys()) {
      if (!this.permissionUpdates.additionalWorkingDirectories.has(directory)) this.directoryObservations.delete(directory);
    }
    this.workingDirectories(false);
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
    const paths = permissionSettingsPaths(this.config.workspace, this.config.configSources?.userDir ?? defaultUserDir());
    for (const update of outcome.applied ?? []) {
      const pending = persistPermissionUpdate(update, paths, this.config.permissions?.managedOnly === true, {
        workspace: this.config.workspace,
        schedule: work => {
          const pendingIgnore = work.then(result => { this.permissionIgnoreResults.push(result); })
            .finally(() => { this.pendingPermissionWrites.delete(pendingIgnore); });
          this.pendingPermissionWrites.add(pendingIgnore);
        },
      })
        .then(result => { this.permissionWriteResults.push(result); })
        .finally(() => { this.pendingPermissionWrites.delete(pending); });
      this.pendingPermissionWrites.add(pending);
    }
    for (const listener of this.permissionListeners) {
      try { listener(); } catch { /* UI observers do not own permission adoption or persistence. */ }
    }
    return outcome;
  }

  async drainPermissionWrites(): Promise<readonly PermissionWriteResult[]> {
    while (this.pendingPermissionWrites.size) await Promise.all([...this.pendingPermissionWrites]);
    return [...this.permissionWriteResults];
  }
  private fd: number;
  private lock: string;
  private lockToken: string;
  private closed = false;

  private constructor(file: string, fd: number, lock: string, lockToken: string, events: SessionEvent[]) {
    const meta = events[0];
    if (meta?.kind !== 'metadata') throw new Error('Session metadata is missing');
    this.id = meta.id;
    this.config = structuredClone(meta.config);
    this.permissionUpdates = seedPermissionUpdates(this.config.permissions, this.config.workspace,
      this.config.configSources?.userDir ?? defaultUserDir());
    this.workingDirectories(false);
    bindPermissionOwner(this.config.permissions, this.permissionOwner);
    this.file = file;
    this.events = events;
    this.fd = fd;
    this.lock = lock;
    this.lockToken = lockToken;
    this.startedAt = meta.startedAt ?? Math.min(Date.now(), fs.fstatSync(fd).birthtimeMs || Date.now());
    for (const event of events) if (event.kind === 'file_history') this.updateFileHistory(event);
  }

  static open(workspace: string, options: { config?: SessionConfig; id?: string; recoverLock?: boolean; storageRoot?: string; startedAt?: number }): Session {
    const root = fs.realpathSync(workspace);
    if (!fs.statSync(root).isDirectory()) throw new Error('Session workspace must be a directory');
    const storage = options.storageRoot === undefined ? root : fs.realpathSync(options.storageRoot);
    if (!fs.statSync(storage).isDirectory()) throw new Error('Session storage root must be a directory');
    const dir = path.join(storage, '.agent');
    if (fs.existsSync(dir)) {
      if (fs.lstatSync(dir).isSymbolicLink() || !fs.statSync(dir).isDirectory()) throw new Error('Session directory must be a real directory');
    } else fs.mkdirSync(dir, { mode: 0o700 });
    const id = options.id ?? randomUUID();
    z.string().uuid().parse(id);
    const file = path.join(dir, `${id}.jsonl`);
    const lock = `${file}.lock`;
    const lockToken = randomUUID();
    if (options.recoverLock && fs.existsSync(lock)) {
      const before = fs.lstatSync(lock);
      if (!before.isFile() || before.isSymbolicLink()) throw new Error('Invalid session lock');
      const owner = JSON.parse(fs.readFileSync(lock, 'utf8')) as { pid: number };
      if (!Number.isInteger(owner.pid) || owner.pid <= 0) throw new Error('Invalid lock owner');
      try { process.kill(owner.pid, 0); throw new Error(`Session is active in process ${owner.pid}`); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
      const after = fs.lstatSync(lock);
      if (after.ino !== before.ino || after.mtimeMs !== before.mtimeMs) throw new Error('Session lock changed during recovery');
      fs.unlinkSync(lock);
    }
    const lockFd = fs.openSync(lock, 'wx', 0o600);
    let fd: number | undefined;
    try {
      fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, token: lockToken }));
      fs.fsyncSync(lockFd);
      fs.closeSync(lockFd);
      let events: SessionEvent[];
      if (options.id) {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100 * 1024 * 1024) throw new Error('Invalid or oversized session journal');
        const bytes = fs.readFileSync(file);
        const boundary = bytes.lastIndexOf(10) + 1;
        events = bytes.subarray(0, boundary).toString('utf8').split('\n').filter(Boolean)
          .map((line) => {
            const event = JSON.parse(line);
            // Validate without reordering keys used by the stored fingerprint.
            eventSchema.parse(event);
            return event as SessionEvent;
          });
        const meta = events[0];
        if (meta?.kind !== 'metadata' || meta.id !== id || meta.config.workspace !== root || meta.fingerprint !== fingerprint(meta.config)) throw new Error('Session identity or config mismatch');
        if (events.slice(1).some((event) => event.kind === 'metadata')) throw new Error('Duplicate session metadata');
        if (options.config && fingerprint(options.config) !== meta.fingerprint) throw new Error('Resume requires the original model, system, tools and runtime settings');
        fd = fs.openSync(file, fs.constants.O_RDWR | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
        // An unterminated final record was never durably committed. Preserve all complete records.
        if (boundary !== bytes.length) { fs.ftruncateSync(fd, boundary); fs.fsyncSync(fd); }
        // A crash between checkpoint capture and this journal's association leaves an intent.
        // The manifest is already durable, so append the missing event under the session lock.
        const journal = fd;
        try {
          for (const pending of recoverCheckpointAssociations(root, id, (name) => {
            const saved = events.findLast((event) => event.kind === 'checkpoint' && event.name === name);
            return saved?.kind === 'checkpoint' ? saved.digest : undefined;
          })) {
            try {
              const event = eventSchema.parse({ kind: 'checkpoint', name: pending.name, digest: pending.digest, boundary: pending.boundary }) as SessionEvent;
              Session.writeAll(journal, Buffer.from(JSON.stringify(event) + '\n'));
              fs.fsyncSync(journal);
              events.push(event);
              clearCheckpointAssociation(pending.file);
            } catch { /* retain the intent for inspection; opening still succeeds */ }
          }
        } catch { /* checkpoint association recovery is best-effort */ }
      } else {
        if (!options.config) throw new Error('New session requires config');
        configSchema.parse(options.config);
        if (options.config.workspace !== root) throw new Error('Config workspace must use its canonical path');
        fd = fs.openSync(file, 'ax', 0o600);
        const meta: SessionEvent = { kind: 'metadata', version: 1, id, config: options.config,
          fingerprint: fingerprint(options.config), startedAt: Math.min(options.startedAt ?? Date.now(), Date.now()) };
        const record = Buffer.from(JSON.stringify(meta) + '\n');
        Session.writeAll(fd, record);
        fs.fsyncSync(fd);
        events = [structuredClone(meta)];
      }
      return new Session(file, fd, lock, lockToken, events);
    } catch (error) {
      if (fd !== undefined) fs.closeSync(fd);
      try { fs.closeSync(lockFd); } catch { /* already closed */ }
      fs.unlinkSync(lock);
      throw error;
    }
  }

  private static writeAll(fd: number, bytes: Buffer): void {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!written) throw new Error('Journal write made no progress');
      offset += written;
    }
  }

  append(event: Exclude<SessionEvent, { kind: 'metadata' }>): void {
    if (this.closed) throw new Error('Session is closed');
    if (event.kind === 'message' && event.classifier === undefined) {
      const inherited = classifierMessage(event.message);
      if (inherited) event = { ...event, classifier: inherited };
    }
    eventSchema.parse(event);
    Session.writeAll(this.fd, Buffer.from(JSON.stringify(event) + '\n'));
    fs.fsyncSync(this.fd);
    this.events.push(structuredClone(event));
    if (event.kind === 'file_history') {
      this.updateFileHistory(event);
      for (const listener of this.fileHistoryListeners) listener();
    }
  }

  get fileHistory(): { trackSequence: number; trackedFiles: ReadonlySet<string> } { return this.fileHistoryValue; }
  subscribeFileHistory(listener: () => void): () => void {
    this.fileHistoryListeners.add(listener);
    return () => { this.fileHistoryListeners.delete(listener); };
  }

  /** Fet/rhe, chunk-sfn1dbxq.js [4731316,4732048)/[4728518,4730433) UTF-16. */
  touchFile(file?: string): void {
    this.append({ kind: 'file_history', ...(file ? { path: path.relative(this.config.workspace, file) } : {}),
      tracked: file !== undefined && this.config.automaticCheckpoints === true && this.config.features?.checkpoints !== false
        && this.events.some(event => event.kind === 'checkpoint') });
  }

  private updateFileHistory(event: Extract<SessionEvent, { kind: 'file_history' }>): void {
    const trackedFiles = new Set(this.fileHistoryValue.trackedFiles);
    if (event.tracked && event.path) trackedFiles.add(event.path);
    this.fileHistoryValue = { trackSequence: this.fileHistoryValue.trackSequence + 1, trackedFiles };
  }

  /**
   * Source `gR` (`chunk-fxx7hh8y.js` 91624) and the message `Ets` (`chunk-sfn1dbxq.js` 4502383):
   * the `recent` tab's retry grants the named commands, and the grant is appended to the
   * conversation so a re-issued call passes the classifier. The source appends a `system` record
   * through `applyMessageOp`; this build's conversation holds `Anthropic.MessageParam`s and its
   * classifier reads a human-origin message as `{user: …}`, so the grant is a user message marked
   * human rather than non-user content.
   */
  appendPermissionRetry(labels: readonly string[]): void {
    this.append({ kind: 'message',
      message: { role: 'user', content: permissionRetryMessage(labels) },
      classifier: { origin: { kind: 'human' } } });
  }

  get messages(): Anthropic.MessageParam[] {
    let messages: Anthropic.MessageParam[] = [];
    for (const event of this.events) {
      if (event.kind === 'message') {
        const message = structuredClone(event.message);
        markClassifierMessage(message, event.classifier ?? { origin: { kind: 'unknown' } });
        messages.push(message);
      }
      if (event.kind === 'compact') messages = [markClassifierMessage({ role: 'user', content: `Session summary (prior conversation data):\n${event.summary}` }, { origin: { kind: 'summary' } })];
    }
    return messages;
  }

  get awaitingResponse(): boolean {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]!;
      if (event.kind === 'turn_end' || event.kind === 'metadata') return false;
      if (event.kind === 'message' || event.kind === 'compact') return true;
    }
    return false;
  }

  get lastResponse(): Anthropic.Message | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]!;
      if (event.kind === 'message') return event.response;
      if (event.kind === 'compact') return undefined;
    }
    return undefined;
  }

  /**
   * `XKt` writes the session colour as a transcript event and the reader takes the first
   * one it meets (`r.currentSessionAgentColor ??= e.agentColor`), so the earliest record
   * wins and a later reset does not clear it. Locally the latest write wins instead: a
   * `/color default` has to take effect on the session that issued it.
   */
  get sessionColor(): import('./session-color.js').SessionColor | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i]!;
      if (event.kind === 'session_color') return event.color ?? undefined;
    }
    return undefined;
  }

  close(): Promise<void> {
    if (this.closed) return this.drainPermissionWrites().then(() => {});
    this.closed = true;
    this.fileHistoryListeners.clear();
    this.permissionListeners.clear();
    fs.closeSync(this.fd);
    const owner = JSON.parse(fs.readFileSync(this.lock, 'utf8')) as { token: string };
    if (owner.token === this.lockToken) fs.unlinkSync(this.lock);
    return this.drainPermissionWrites().then(() => {});
  }
}
