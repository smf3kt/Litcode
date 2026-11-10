import { z } from 'zod';

import type { ToolDefinition } from './tools.js';
import { shellReadings } from './shell-readings.js';
import { vS } from './bash-parser-source.js';
import { E6, pyr } from './shell-analyser-source.js';
import { shellAnalysisHome, withShellAnalysisHome } from './shell-analysis-home.js';
import { KI, Do } from './permission-reducer-source.js';
import { Un, _n } from './permission-rule-source.js';
import { bindContentRuleOwner, contentRuleMatches, ruleToolMatches, hasContentConsumer } from './permission-content.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { types as utilTypes } from 'node:util';
import { resolveChain, verifyIdentity } from './path-identity.js';
import { filePathDecision } from './path-leaf-permission.js';
import { observePermissionPath, type PathPermissionObservation } from './path-permission-observation.js';
import { ownsPlanPath, resolvePlanFile, resolveOwnedPlanFile, type PlanOwnership } from './plan-file.js';
import { createPathIdentity } from './path-approval-identity-source.js';
import { createPathApprovalBinding } from './path-approval-binding-source.js';
import { Be, j8e } from './path-approval-stash-source.js';
import { randomUUID } from 'node:crypto';
import { createReadIdentity } from './path-read-identity-source.js';

export const autoPolicySchema = z.object({ deny: z.array(z.string()).optional(), allow: z.array(z.string()).optional(), soft_deny: z.array(z.string()).optional(), hard_deny: z.array(z.string()).optional(), environment: z.array(z.string()).optional(), classifyAllShell: z.boolean().optional() }).strict();
export const permissionLayerSchema = z.object({
  source: z.enum(['userSettings', 'projectSettings', 'localSettings', 'flagSettings', 'policySettings', 'cliArg', 'session', 'command', 'toolsNarrowing', 'mcpServerPolicy', 'hostCredential']),
  root: z.string(), file: z.string().optional(),
  allow: z.array(z.string()), deny: z.array(z.string()), ask: z.array(z.string()),
  useAutoModeDuringPlan: z.boolean().optional(),
  autoMode: autoPolicySchema.optional(),
  classifyAllShell: z.boolean().optional(),
  additionalDirectories: z.array(z.string()),
});

export type PermissionSource = PermissionUpdate['destination'] | 'policySettings' | 'flagSettings' | 'command' | 'toolsNarrowing' | 'mcpServerPolicy' | 'hostCredential';
export type RuleBuckets = Partial<Record<PermissionSource, string[]>>;
export type PermissionRule = Extract<PermissionUpdate, { type: 'addRules' }>['rules'][number];
export const parsePermissionRule: (text: string) => PermissionRule = Un;
export const serializePermissionRule: (rule: PermissionRule) => string = _n;

const patternSchema = z.string().max(4096);
export const permissionPolicySchema = z.object({
  mode: z.enum(['default', 'plan', 'acceptEdits', 'bypass', 'ask', 'auto', 'dontAsk']),
  defaultMode: z.enum(['acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan']).optional(),
  autoDuringPlan: z.boolean().optional(),
  additionalDirectories: z.array(z.string()).optional(),
  blockReadsOutsideWorkingDirectories: z.boolean().optional(),
  allow: z.array(patternSchema).max(1024),
  deny: z.array(patternSchema).max(1024),
  ask: z.array(patternSchema).max(1024).optional(),
  layers: z.array(permissionLayerSchema).optional(),
  ruleWorkspace: z.string().optional(),
  managedOnly: z.boolean().optional(),
  inputRules: z.array(z.object({
    tool: patternSchema,
    path: patternSchema.optional(),
    command: patternSchema.optional(),
    decision: z.enum(['allow', 'deny', 'ask']),
  }).strict()).max(1024).optional(),
}).strict();

export type PermissionPolicy = z.infer<typeof permissionPolicySchema>;
// W303 user-default adaptation of nybcbd9t [21907,22578), UTF-16; settings retain the external spelling.
export const DEFAULT_PERMISSION_MODE = { mode: 'bypass', defaultMode: 'bypassPermissions' } as const satisfies Pick<PermissionPolicy, 'mode' | 'defaultMode'>;
// fl/Kt, chunk-hwpb27as.js [120818,120979)/[121053,123737), UTF-16: Shell is enabled unless explicitly narrowed.
export const DEFAULT_ALLOW_SHELL = true;
/** One settings layer, derived from the schema the config parses. */
export type PermissionLayer = NonNullable<PermissionPolicy['layers']>[number];
export type PermissionDecision = { decision: 'allow' | 'deny' | 'ask'; reason?: string;
  floor?: 'rule' | 'plan' | 'readings' | 'host' | 'interaction' };

/**
 * The permission modes a setMode update may name (chunk-a60ee1ne.js offset 678),
 * in the source's own order. `manual` is the retired name the schema
 * normalizes to `default` (chunk-a60ee1ne.js offset 782).
 */
export const PERMISSION_MODES = ['acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan'] as const;

/**
 * One permission update as a PermissionRequest allow answer returns it. This is
 * the recovered schema `Bz` (chunk-n3ykh62m.js offset 390059): a union on
 * `type` whose rule entries are `{toolName, ruleContent?}` and whose
 * destinations are the five source scopes.
 */
export const permissionUpdateSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('addRules'),
    rules: z.array(z.object({ toolName: z.string(), ruleContent: z.string().optional() })),
    behavior: z.enum(['allow', 'deny', 'ask']),
    destination: z.enum(['userSettings', 'projectSettings', 'localSettings', 'session', 'cliArg']),
  }),
  z.object({
    type: z.literal('replaceRules'),
    rules: z.array(z.object({ toolName: z.string(), ruleContent: z.string().optional() })),
    behavior: z.enum(['allow', 'deny', 'ask']),
    destination: z.enum(['userSettings', 'projectSettings', 'localSettings', 'session', 'cliArg']),
  }),
  z.object({
    type: z.literal('removeRules'),
    rules: z.array(z.object({ toolName: z.string(), ruleContent: z.string().optional() })),
    behavior: z.enum(['allow', 'deny', 'ask']),
    destination: z.enum(['userSettings', 'projectSettings', 'localSettings', 'session', 'cliArg']),
  }),
  z.object({
    type: z.literal('setMode'),
    mode: z.preprocess((value) => (value === 'manual' ? 'default' : value), z.enum(PERMISSION_MODES)),
    destination: z.enum(['userSettings', 'projectSettings', 'localSettings', 'session', 'cliArg']),
  }),
  z.object({
    type: z.literal('addDirectories'),
    directories: z.array(z.string()),
    destination: z.enum(['userSettings', 'projectSettings', 'localSettings', 'session', 'cliArg']),
  }),
  z.object({
    type: z.literal('removeDirectories'),
    directories: z.array(z.string()),
    destination: z.enum(['userSettings', 'projectSettings', 'localSettings', 'session', 'cliArg']),
  }),
]);
export const permissionUpdateListSchema = z.array(permissionUpdateSchema);
export type PermissionUpdate = z.infer<typeof permissionUpdateSchema>;

/** Destination-aware session context, projected into arrays for existing decision callers. */
export type SessionPermissionUpdates = {
  contentRuleOwner?: object;
  ruleWorkspace?: string;
  planFile?: string;
  planOwnership?: PlanOwnership;
  ruleRoots?: Partial<Record<PermissionSource, string>>;
  mode?: PermissionPolicy['mode'];
  autoDuringPlan?: boolean;
  useAutoModeDuringPlan?: boolean;
  classifyAllShell?: boolean;
  autoMode?: z.infer<typeof autoPolicySchema>;
  prePlanMode?: 'acceptEdits' | 'auto' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan';
  strippedDangerousRules?: RuleBuckets;
  startupModeDecidedByProactivityLevel?: unknown;
  allow: string[];
  deny: string[];
  ask: string[];
  alwaysAllowRules: RuleBuckets;
  alwaysDenyRules: RuleBuckets;
  alwaysAskRules: RuleBuckets;
  additionalWorkingDirectories: Map<string, { path: string; source: PermissionSource }>;
  isBypassPermissionsModeAvailable: boolean;
};

export const emptySessionPermissionUpdates = (): SessionPermissionUpdates => ({ allow: [], deny: [], ask: [],
  alwaysAllowRules: {}, alwaysDenyRules: {}, alwaysAskRules: {}, additionalWorkingDirectories: new Map(),
  isBypassPermissionsModeAvailable: false });

export type PermissionWriteOrigin = {
  sessionId: string;
  onWrite?(work: Promise<import('./permission-settings.js').PermissionWriteResult>): void;
};
export type LivePermissionOwner = {
  prepareAutoMode?(): void;
  state(): SessionPermissionUpdates;
  workingDirectories(readOnly: boolean): import('./path-identity.js').WorkingDirectories;
  adoptUpdates?(updates: readonly PermissionUpdate[], origin?: PermissionWriteOrigin): PermissionUpdatesOutcome;
};
const permissionOwners = new WeakMap<PermissionPolicy, LivePermissionOwner>();
const planFiles = new WeakMap<PermissionPolicy, string>();
const planOwners = new WeakMap<PermissionPolicy, PlanOwnership>();

export function permissionOwner(policy: PermissionPolicy | undefined): LivePermissionOwner | undefined {
  return policy && permissionOwners.get(policy);
}

export function inheritPermissionOwner(target: PermissionPolicy | undefined, source: PermissionPolicy | undefined): void {
  const owner = permissionOwner(source);
  if (target && owner) permissionOwners.set(target, owner);
}

/** FVt/Bpn, sfn [3364776,3365484), gDr/P, 9v9 [2364,4132), UTF-16. */
export function reloadPermissionState(previous: SessionPermissionUpdates, policy: PermissionPolicy | undefined,
  workspace: string, userDirectory: string): SessionPermissionUpdates {
  const settings = seedPermissionUpdates(policy, workspace, userDirectory);
  const next = { ...settings, contentRuleOwner: previous.contentRuleOwner, mode: previous.mode,
    prePlanMode: previous.prePlanMode, autoDuringPlan: previous.autoDuringPlan, strippedDangerousRules: previous.strippedDangerousRules,
    startupModeDecidedByProactivityLevel: previous.startupModeDecidedByProactivityLevel,
    ruleRoots: { ...previous.ruleRoots, ...settings.ruleRoots } };
  const sources: PermissionSource[] = ['cliArg', 'command', 'session', 'toolsNarrowing', 'mcpServerPolicy', 'hostCredential'];
  for (const source of sources) {
    next.alwaysAllowRules[source] = policy?.managedOnly && (source === 'cliArg' || source === 'session')
      ? [] : [...(previous.alwaysAllowRules[source] ?? settings.alwaysAllowRules[source] ?? [])];
    next.alwaysDenyRules[source] = [...(previous.alwaysDenyRules[source] ?? settings.alwaysDenyRules[source] ?? [])];
    next.alwaysAskRules[source] = [...(previous.alwaysAskRules[source] ?? settings.alwaysAskRules[source] ?? [])];
  }
  for (const [directory, entry] of previous.additionalWorkingDirectories) {
    if (entry.source === 'cliArg' || entry.source === 'command' || entry.source === 'session') {
      next.additionalWorkingDirectories.set(directory, { ...entry });
    }
  }
  next.allow = Object.values(next.alwaysAllowRules).flat();
  next.deny = Object.values(next.alwaysDenyRules).flat();
  next.ask = Object.values(next.alwaysAskRules).flat();
  return next;
}

/** yn, 40cep [123604,125280), UTF-16. Allow overrides replace inherited authored grants. */
export function childPermissionState(parent: SessionPermissionUpdates, allowedTools?: readonly string[]): SessionPermissionUpdates {
  if (allowedTools === undefined) return parent;
  const alwaysAllowRules: RuleBuckets = { cliArg: parent.alwaysAllowRules.cliArg,
    ...(parent.alwaysAllowRules.mcpServerPolicy ? { mcpServerPolicy: parent.alwaysAllowRules.mcpServerPolicy } : {}),
    session: [...allowedTools] };
  return { ...parent, alwaysAllowRules, allow: Object.values(alwaysAllowRules).flat() };
}

/** kd/Izr, chunk-2bcyxj9q [67462,67956), chunk-xv9wnb67 [14228,17300), UTF-16. */
/** et/gge, wh2 [3533,4062), 8f8 [1091,2073), UTF-16; resolveChain is the verified W09 walker. */
export function normalizeWorkingDirectory(value: string, workspace: string): string | undefined {
  if (!value.trim() || value.includes('\0')) return undefined;
  const text = value.trim();
  const directory = path.resolve(workspace, text === '~' ? os.homedir() : text.startsWith('~/') ? path.join(os.homedir(), text.slice(2)) : text);
  try {
    const resolved = resolveChain(workspace, directory);
    if (!resolved.identity || !fs.statSync(resolved.path).isDirectory()) return undefined;
    verifyIdentity(resolved);
    return directory;
  } catch { return undefined; }
}

export function seedPermissionUpdates(policy: PermissionPolicy | undefined, workspace?: string, userDirectory?: string): SessionPermissionUpdates {
  const state = emptySessionPermissionUpdates();
  state.contentRuleOwner = {};
  state.ruleWorkspace = workspace;
  // gRt/Fko [217195,217458)/[400577,400665), UTF-16. Roots exist before settings files do.
  state.ruleRoots = userDirectory === undefined ? {} : { userSettings: path.resolve(userDirectory) };
  if (!policy) return state;
  const layers = policy.layers ?? [{ source: 'cliArg' as const, root: '', allow: policy.allow,
    deny: policy.deny, ask: policy.ask ?? [], additionalDirectories: policy.additionalDirectories ?? [] }];
  const autoLayers = ['userSettings', 'flagSettings', 'policySettings'].flatMap(source => layers.filter(layer => layer.source === source).map(layer => layer.autoMode));
  state.autoMode = {};
  for (const key of ['allow', 'soft_deny', 'hard_deny', 'environment'] as const) {
    const values = autoLayers.flatMap(layer => layer?.[key] ?? []);
    if (values.length) state.autoMode[key] = values;
  }
  state.useAutoModeDuringPlan = !layers.some(layer => layer.useAutoModeDuringPlan === false);
  state.classifyAllShell = layers.some(layer => ['userSettings', 'flagSettings', 'policySettings'].includes(layer.source) && layer.classifyAllShell === true);
  for (const layer of layers) {
    state.ruleRoots[layer.source] ??= layer.source === 'userSettings' && layer.file ? path.dirname(layer.file) : layer.root || workspace || process.cwd();
    const settingsExcluded = policy.managedOnly && layer.source !== 'policySettings' && layer.source !== 'cliArg';
    state.alwaysAllowRules[layer.source] = settingsExcluded || policy.managedOnly && layer.source === 'cliArg' ? [] : [...layer.allow];
    state.alwaysDenyRules[layer.source] = settingsExcluded ? [] : [...layer.deny];
    state.alwaysAskRules[layer.source] = settingsExcluded ? [] : [...layer.ask];
    if (workspace) for (const value of layer.additionalDirectories) {
      const directory = normalizeWorkingDirectory(value, workspace);
      if (directory) state.additionalWorkingDirectories.set(directory, { path: directory, source: layer.source });
    }
  }
  state.allow = Object.values(state.alwaysAllowRules).flat();
  state.deny = Object.values(state.alwaysDenyRules).flat();
  state.ask = Object.values(state.alwaysAskRules).flat();
  state.isBypassPermissionsModeAvailable = policy.mode === 'bypass';
  return state;
}

export function bindPermissionOwner(policy: PermissionPolicy | undefined, state: SessionPermissionUpdates | LivePermissionOwner): void {
  if (policy) permissionOwners.set(policy, 'state' in state ? state : {
    state: () => state, workingDirectories: () => [...state.additionalWorkingDirectories.keys()],
  });
}

/** One projection serves gates and snapshots; an empty replaced bucket stays empty. */
export function effectivePermissionPolicy(policy: PermissionPolicy | undefined,
  session = permissionOwner(policy)?.state()): PermissionPolicy | undefined {
  if (!session) return policy;
  const { layers: _layers, ...base } = policy ?? {};
  const effective = { ...base, autoDuringPlan: session.autoDuringPlan, mode: session.mode ?? policy?.mode ?? 'default', ruleWorkspace: session.ruleWorkspace ?? policy?.ruleWorkspace,
    layers: [...new Set([...Object.keys(session.alwaysAllowRules), ...Object.keys(session.alwaysDenyRules),
      ...Object.keys(session.alwaysAskRules)])].map(source => permissionLayerSchema.parse({ source,
        root: session.ruleRoots?.[source as PermissionSource] ?? session.ruleWorkspace ?? process.cwd(),
        allow: session.alwaysAllowRules[source as PermissionSource] ?? [],
        deny: session.alwaysDenyRules[source as PermissionSource] ?? [],
        ask: session.alwaysAskRules[source as PermissionSource] ?? [], additionalDirectories: [] })),
    allow: [...session.allow], deny: [...session.deny], ask: [...session.ask],
    additionalDirectories: [...session.additionalWorkingDirectories.keys()] };
  bindContentRuleOwner(effective, session.contentRuleOwner ?? session);
  const planFile = session.planFile ?? (policy === undefined ? undefined : planFiles.get(policy));
  if (planFile !== undefined) planFiles.set(effective, planFile);
  const planOwner = session.planOwnership ?? (policy === undefined ? undefined : planOwners.get(policy));
  if (planOwner !== undefined) planOwners.set(effective, planOwner);
  return effective;
}

function sessionUpdatesActive(session: SessionPermissionUpdates | undefined): boolean {
  return session !== undefined &&
    (session.mode !== undefined || session.allow.length > 0 || session.deny.length > 0 || session.ask.length > 0);
}

/** Strict-consumer refusal text retained for callers that report unapplied updates. */
export const PERMISSION_UPDATES_UNAPPLIED =
  'The call was not run. The permission answer allowed it and also asked for changes to the permission rules. ' +
  'This session could not apply them all, so a deny or ask rule among them may not be in force. ' +
  'Nothing that the answer allowed is in force either. Tell the person so. ' +
  'A new call can be allowed by an answer that changes fewer rules, or none.';

/** Eligible auto asks are evaluated separately by the Agent's shared provider classifier. */
const UPDATE_MODES: Partial<Record<(typeof PERMISSION_MODES)[number], PermissionPolicy['mode']>> = {
  dontAsk: 'dontAsk',
  default: 'default',
  plan: 'plan',
  acceptEdits: 'acceptEdits',
  bypassPermissions: 'bypass',
};

export type PermissionUpdatesOutcome = {
  applied?: PermissionUpdate[];
  /** The state to keep. Uncommitted when `blocked` is set: the source applies nothing then. */
  state: SessionPermissionUpdates;
  /** Updates the product cannot represent, named for the record. */
  dropped: string[];
  /** Set when the answer must not run the call (see `PERMISSION_UPDATES_UNAPPLIED`). */
  blocked?: string;
};

/**
 * Adapt KI/sf, chunk-2bcyxj9q [194801,197020)/[197487,197681), UTF-16.
 * Preserve behavior/destination buckets, content rules and raw directory keys.
 */
export function applyPermissionUpdates(state: SessionPermissionUpdates, updates: readonly PermissionUpdate[]): PermissionUpdatesOutcome {
  const accepted: PermissionUpdate[] = [], dropped: string[] = [];
  for (const update of updates) {
    const checked = Do(update);
    if (checked.action !== 'apply') { dropped.push(checked.reason ?? 'Invalid permission update'); continue; }
    const parsed = permissionUpdateSchema.safeParse(checked.update);
    if (!parsed.success) { dropped.push('Invalid permission update'); continue; }
    const value = parsed.data;
    if (value.type === 'setMode' && UPDATE_MODES[value.mode] === undefined) {
      dropped.push(`setMode ${value.mode}`); continue;
    }
    if ('rules' in value && value.type !== 'removeRules') {
      const unsupported = value.rules.filter(rule => rule.ruleContent !== undefined && !hasContentConsumer(rule.toolName));
      if (unsupported.length && value.behavior !== 'allow') return { state, dropped, blocked: PERMISSION_UPDATES_UNAPPLIED };
      if (unsupported.length) {
        dropped.push(...unsupported.map(rule => `${value.behavior} rule ${rule.toolName}`));
        accepted.push({ ...value, rules: value.rules.filter(rule => !unsupported.includes(rule)) });
        continue;
      }
    }
    accepted.push(value);
  }
  const reduced = KI({ ...state, mode: state.mode === 'bypass' ? 'bypassPermissions' : state.mode }, accepted);
  const next: SessionPermissionUpdates = { ...reduced, mode: reduced.mode === 'bypassPermissions' ? 'bypass' : reduced.mode };
  return { state: { ...next, allow: Object.values(next.alwaysAllowRules).flat(),
    deny: Object.values(next.alwaysDenyRules).flat(), ask: Object.values(next.alwaysAskRules).flat() }, dropped, applied: accepted };
}

// Only '*' is a wildcard. All other glob-looking and regexp characters are literal.
// The iterative matcher avoids regexp backtracking for repeated wildcard segments.
function matches(pattern: string, value: string, legacy = false): boolean {
  let patternIndex = 0;
  let valueIndex = 0;
  let wildcardIndex = -1;
  let retryIndex = 0;
  while (valueIndex < value.length) {
    if (pattern[patternIndex] === '*') {
      wildcardIndex = patternIndex++;
      retryIndex = valueIndex;
    } else if (patternIndex < pattern.length && pattern[patternIndex] === value[valueIndex]) {
      patternIndex++;
      valueIndex++;
    } else if (wildcardIndex >= 0) {
      if (legacy && [10, 13, 0x2028, 0x2029].includes(value.charCodeAt(retryIndex))) return false;
      patternIndex = wildcardIndex + 1;
      valueIndex = ++retryIndex;
    } else return false;
  }
  while (pattern[patternIndex] === '*') patternIndex++;
  return patternIndex === pattern.length;
}

// Legacy regexp '*' excludes line separators while literal separators still match.
function legacyMatches(pattern: string, name: string): boolean {
  return matches(pattern, name, true);
}

function bareRuleMatches(text: string, name: string): boolean {
  const rule = Un(text);
  return text === name || rule.ruleContent === undefined && (ruleToolMatches(rule.toolName, name) || matches(rule.toolName, name));
}

function unsupportedContentRule(policy: PermissionPolicy, name: string): string | undefined {
  // B_e/Nn select known tool families. Unmapped host consumers fail before effects.
  for (const text of [...policy.deny, ...(policy.ask ?? [])]) {
    const rule = Un(text);
    if (rule.ruleContent !== undefined && !hasContentConsumer(rule.toolName) &&
        (ruleToolMatches(rule.toolName, name) || matches(rule.toolName, name))) {
      return `Unsupported restrictive permission content consumer: ${rule.toolName}`;
    }
  }
  return undefined;
}

export function permissionError(policy: PermissionPolicy | undefined, tool: ToolDefinition): string | undefined {
  policy = effectivePermissionPolicy(policy) ?? policy;
  if (policy?.layers) policy = effectivePermissionPolicy(policy, seedPermissionUpdates(policy));
  if (!policy) return undefined;
  const unsupported = unsupportedContentRule(policy, tool.schema.name);
  if (unsupported) return unsupported;
  if (policy.deny.some(rule => legacyMatches(rule, tool.schema.name) || Un(rule).ruleContent === undefined && ruleToolMatches(rule, tool.schema.name))) return `Tool denied by permission rule: ${tool.schema.name}`;
  if (policy.mode === 'plan' && !tool.readOnly) return `Plan mode permits read-only tools: ${tool.schema.name}`;
  const bareAllows = policy.allow.filter(rule => Un(rule).ruleContent === undefined);
  if (bareAllows.length && !bareAllows.some(rule => bareRuleMatches(rule, tool.schema.name))) return `Tool is outside the allow list: ${tool.schema.name}`;
  return undefined;
}

function inputRuleMatches(rule: NonNullable<PermissionPolicy['inputRules']>[number], tool: string, input: unknown): boolean {
  if (!matches(rule.tool, tool)) return false;
  const object = typeof input === 'object' && input !== null && !Array.isArray(input) ? input : {};
  if (rule.path !== undefined) {
    const descriptor = Object.getOwnPropertyDescriptor(object, 'path');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || !matches(rule.path, descriptor.value)) return false;
  }
  if (rule.command !== undefined) {
    const descriptor = Object.getOwnPropertyDescriptor(object, 'command');
    if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string' || !matches(rule.command, descriptor.value)) return false;
  }
  return true;
}

const EDIT_TOOLS = new Set([
  'write_file', 'edit_file', 'notebook_edit', 'memory_write', 'memory_delete', 'lsp_edit',
]);
const SHELL_TOOLS = new Set(['run_command', 'run_background', 'bash', 'Bash']);
const FILE_PERMISSION_TOOLS = new Set(['read_file', 'read_media', 'notebook_read', 'list_files', 'search',
  'write_file', 'edit_file', 'notebook_edit', 'lsp_edit']);

/** The `command` string of a shell invocation, or undefined when there is none. */
function commandInput(tool: ToolDefinition, input: unknown): string | undefined {
  const object = typeof input === 'object' && input !== null && !Array.isArray(input) ? input : undefined;
  if (!object) return undefined;
  const value = Object.getOwnPropertyDescriptor(object, 'command')?.value;
  if (typeof value !== 'string') return undefined;
  return SHELL_TOOLS.has(tool.schema.name) || tool.schema.name === 'monitor' ? value : undefined;
}

/** A copy of the tool input whose `command` field carries one reading. */
function withCommand(input: unknown, command: string): unknown {
  return { ...(typeof input === 'object' && input !== null && !Array.isArray(input) ? input : {}), command };
}

/**
 * The recovered `Lcn` strictness rank (chunk-sfn1dbxq.js [3234326,3234534)):
 * deny 6, an ask that matched a rule 5, any other ask 4, allow 1. The source
 * also ranks a soft ask 3, a passthrough 2 and a rule-only allow 0; the host
 * has no producer for those, because an allow carries no reason tree, no
 * reading result is a passthrough, and every host ask carries a mode or rule
 * reason. `m0` marks a matched ask rule, which is the host's `floor: 'rule'`
 * ask.
 *
 * The host applies its mode hold inside `decideOnce`, so a mode ask reaches
 * this ranking with no floor and is ranked as a plain ask. The recovered order
 * applies the hold after the reading combination; for every case the host can
 * produce, ranking the hold as a plain ask gives the same decision, because a
 * rule ask from an alternate still outranks it and it still outranks an allow.
 */
function readingRank(decision: PermissionDecision): number {
  switch (decision.decision) {
    case 'allow': return 1;
    case 'ask': return decision.floor === 'rule' ? 5 : 4;
    case 'deny': return 6;
  }
}

/**
 * The recovered client checks every reading of a shell command against the
 * permission rules and takes any denial, and it will not let an incomplete
 * reading set pass on the strength of a single reading. That invariant is
 * applied here on top of the plain decision, and only when a rule actually
 * constrains the command text: rules that name a tool alone cannot depend on
 * how the shell reads the line, so behaviour without a `command` rule is
 * unchanged. A denial is never softened, and `bypass` keeps its meaning rather
 * than turning into an approval prompt.
 */
/**
 * The recovered nested-shell policy (`jcn`/`Fcn`, chunk-sfn1dbxq.js UTF-16
 * [3213895,3215588)/[3243430,3246934)) evaluates a shell script passed to
 * `bash -c` instead of judging only the outer argv. The host's readings do
 * not parse that script, so a denied inner command behind an allowed outer
 * `bash -c` escaped. Re-check direct and wrapper-prefixed shell scripts with
 * the same rules before an allow. This is still a conservative adaption:
 * only nested denials and rule asks are returned; sandbox, declaration budget
 * and the complete source callback chain remain with the source-policy item.
 */
function nestedShellScript(argv: readonly string[]): string | undefined {
  const shells = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
  const wrappers = new Set(['sudo', 'doas', 'env', 'command', 'builtin', 'nohup', 'time', 'timeout', 'nice', 'stdbuf', 'exec']);
  const valueOptions = new Set(['-u', '-g', '-U', '-C', '-D', '-h', '-p', '-r', '-R', '-t', '-T', '--user', '--group',
    '--other-user', '--close-from', '--chdir', '--host', '--prompt', '--role', '--chroot', '--type', '--command-timeout',
    '--auth-type', '-n', '--interval', '-c', '-i', '-o', '-e']);
  let index = 0;
  while (index < argv.length) {
    const arg = argv[index]!;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(arg)) { index++; continue; }
    const base = path.basename(arg);
    if (shells.has(base)) {
      for (let position = index + 1; position < argv.length; position++) {
        if (!/^-[A-Za-z]*c[A-Za-z]*$/.test(argv[position]!)) continue;
        const script = argv[position + 1];
        return script !== undefined && script.trim() !== '' ? script : undefined;
      }
      return undefined;
    }
    if (!wrappers.has(base)) return undefined;
    index++;
    while (index < argv.length && argv[index]!.startsWith('-')) {
      const option = argv[index]!;
      index += valueOptions.has(option) && index + 1 < argv.length ? 2 : 1;
    }
    if (base === 'timeout' && index < argv.length) index++;
  }
  return undefined;
}

function nestedPrefixDenial(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown, script: string,
  session?: SessionPermissionUpdates): PermissionDecision | undefined {
  let tree: ReturnType<typeof vS>['parse'] extends (...args: never[]) => infer R ? R : never;
  try { tree = vS().parse(script, undefined); } catch { return undefined; }
  if (!tree) return undefined;
  let initial: ReturnType<typeof E6>;
  try { initial = E6(script, tree); } catch { return undefined; }
  if (initial.kind !== 'simple' || initial.declarationPrefixes === undefined) return undefined;
  let readings: boolean[][];
  try { readings = pyr(initial.declarationPrefixes, initial.declarationPrefixBashKeeps).readings; } catch { return undefined; }
  for (const declarationPrefix of readings) {
    let analysis: ReturnType<typeof E6>;
    const options = { plainUnquotedHeredocs: false, declarationPrefix };
    try { analysis = E6(script, tree, options); } catch { continue; }
    if (analysis.kind !== 'simple') continue;
    for (const entry of analysis.commands) {
      const nested = decideOnce(policy, tool, withCommand(input, entry.text), session);
      if (nested.decision === 'deny') {
        return { decision: 'deny', reason: `Permission to run this command was denied for a nested shell reading: ${tool.schema.name}` };
      }
    }
  }
  return undefined;
}

function nestedShellDenial(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown, command: string,
  session?: SessionPermissionUpdates, depth = 0): PermissionDecision | undefined {
  let tree: ReturnType<typeof vS>['parse'] extends (...args: never[]) => infer R ? R : never;
  try { tree = vS().parse(command, undefined); } catch { return undefined; }
  if (!tree) return undefined;
  let analysis: ReturnType<typeof E6>;
  try { analysis = E6(command, tree); } catch { return undefined; }
  if (analysis.kind !== 'simple') return undefined;
  if (depth > 3) {
    const commands = analysis.commands as { argv: readonly string[] }[];
    if (commands.some(entry => nestedShellScript(entry.argv) !== undefined)) {
      return { decision: 'ask', floor: 'readings', reason: `This command has nested shells that cannot all be checked: ${tool.schema.name}` };
    }
    return undefined;
  }
  for (const entry of analysis.commands) {
    const script = nestedShellScript(entry.argv);
    if (script === undefined) continue;
    const deeper = nestedShellDenial(policy, tool, withCommand(input, script), script, session, depth + 1);
    if (deeper !== undefined) return deeper;
    const sampled = nestedPrefixDenial(policy, tool, input, script, session);
    if (sampled !== undefined) return sampled;
    const nested = decideOnce(policy, tool, withCommand(input, script), session);
    if (nested.decision === 'deny') {
      return { decision: 'deny', reason: `Permission to run this command was denied for a nested shell: ${tool.schema.name}` };
    }
    if (nested.decision === 'ask' && nested.floor === 'rule') return nested;
  }
  return undefined;
}

/**
 * The read-block flag (`permissions.blockReadsOutsideWorkingDirectories`) is a
 * source policy state (`vX`/`sR`, chunk-sfn1dbxq.js) that asks when a shell
 * command names a path outside the working directories. The host already
 * carries the flag for directory grants but did not apply it to shell reads.
 * This is a conservative subset: simple read commands with explicit path
 * operands; redirections, globs, exceptions and the full source callback chain
 * remain under the read-block item.
 */
function shellReadBlockDecision(policy: PermissionPolicy | undefined, command: string, workspace?: string,
  planFile?: string): PermissionDecision | undefined {
  if (policy?.blockReadsOutsideWorkingDirectories !== true) return undefined;
  const roots = [workspace, ...(policy.additionalDirectories ?? [])].filter((root): root is string => typeof root === 'string' && path.isAbsolute(root));
  if (roots.length === 0) return undefined;
  let tree: ReturnType<typeof vS>['parse'] extends (...args: never[]) => infer R ? R : never;
  try { tree = vS().parse(command, undefined); } catch { return undefined; }
  if (!tree) return undefined;
  let analysis: ReturnType<typeof E6>;
  try { analysis = E6(command, tree); } catch { return undefined; }
  if (analysis.kind !== 'simple') {
    return { decision: 'ask', floor: 'readings', reason: 'This command cannot be checked against the read block (permissions.blockReadsOutsideWorkingDirectories)' };
  }
  const readCommands = new Set(['cat', 'head', 'tail', 'less', 'more', 'wc', 'file', 'stat', 'od', 'strings', 'nl', 'tac', 'sort', 'uniq']);
  const cwd = workspace ?? process.cwd();
  const outside = (candidate: string) => roots.every(root => {
    const relative = path.relative(root, candidate);
    return path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`);
  });
  const askOutside = (display: string) => ({ decision: 'ask' as const, floor: 'readings' as const,
    reason: `This command reads outside the working directories: ${display}` });
  const safeDevice = new Set(['/dev/null', '/dev/stdin', '/dev/stdout', '/dev/stderr', '/dev/tty']);
  const resolvedPlan = planFile === undefined ? undefined : path.resolve(planFile);
  const planStem = resolvedPlan?.endsWith('.md') ? resolvedPlan.slice(0, -3) : resolvedPlan;
  const isPlanPath = (candidate: string) => resolvedPlan !== undefined &&
    (candidate === resolvedPlan || (planStem !== undefined && candidate.startsWith(`${planStem}-agent-`) && candidate.endsWith('.md')));
  const checkOperand = (operand: string): PermissionDecision | undefined => {
    if (operand === '' || operand === '--' || operand === '|' || operand === ';') return undefined;
    if (operand.startsWith('-') && operand !== '-') return undefined;
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(operand)) return undefined;
    if (safeDevice.has(operand)) return undefined;
    const expanded = operand === '~' ? os.homedir() : operand.startsWith('~/') ? path.join(os.homedir(), operand.slice(2)) : operand;
    if (/[*?[]/.test(expanded)) {
      let matches: string[] = [];
      try { matches = fs.globSync(expanded, { cwd }); } catch { matches = []; }
      if (matches.length > 0) {
        for (const match of matches) {
          const blocked = checkOperand(path.resolve(cwd, match));
          if (blocked !== undefined) return blocked;
        }
        return undefined;
      }
    }
    const candidate = path.resolve(cwd, expanded);
    if (isPlanPath(candidate)) return undefined;
    const readRules = (policy?.inputRules ?? []).filter(rule => inputRuleMatches(rule, 'read_file', { path: candidate }));
    if (readRules.some(rule => rule.decision === 'deny')) {
      return { decision: 'deny', reason: `This command reads a path denied by a read rule: ${operand}` };
    }
    if (readRules.some(rule => rule.decision === 'ask')) {
      return { decision: 'ask', floor: 'rule', reason: `This command reads a path that requires approval: ${operand}` };
    }
    if (readRules.some(rule => rule.decision === 'allow')) return undefined;
    if (outside(candidate)) return askOutside(operand);
    return undefined;
  };
  for (const entry of analysis.commands) {
    const argv = entry.argv;
    if (Array.isArray(argv) && argv.length >= 2 && readCommands.has(path.basename(argv[0] ?? ''))) {
      for (const operand of argv.slice(1)) {
        const blocked = checkOperand(operand);
        if (blocked !== undefined) return blocked;
      }
    }
    const redirects = (entry as { redirects?: { op?: unknown; target?: unknown }[] }).redirects;
    if (Array.isArray(redirects)) {
      for (const redirect of redirects) {
        if (redirect.op !== '<' && redirect.op !== '<>') continue;
        if (typeof redirect.target !== 'string') continue;
        if (safeDevice.has(redirect.target)) continue;
        const target = path.resolve(cwd, redirect.target);
        if (isPlanPath(target)) continue;
        if (outside(target)) return askOutside(redirect.target);
      }
    }
  }
  return undefined;
}

function applyShellReadings(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown, baseline: PermissionDecision,
  session?: SessionPermissionUpdates, workspace?: string, planFile?: string): PermissionDecision {
  if (baseline.decision === 'deny') return baseline;
  const command = commandInput(tool, input);
  if (command === undefined) return baseline;
  const readBlock = shellReadBlockDecision(policy, command, workspace, planFile);
  if (readBlock !== undefined) return readBlock;
  const nestedDenial = nestedShellDenial(policy, tool, input, command, session);
  if (nestedDenial !== undefined) return nestedDenial;
  if (!(policy?.inputRules ?? []).some(rule => rule.command !== undefined && matches(rule.tool, tool.schema.name)) &&
      ![...(policy?.allow ?? []), ...(policy?.deny ?? []), ...(policy?.ask ?? []), ...(session?.allow ?? []),
        ...(session?.deny ?? []), ...(session?.ask ?? [])].some(text => {
          const rule = Un(text); return rule.ruleContent !== undefined && ruleToolMatches(rule.toolName, tool.schema.name);
        })) return baseline;
  // E6/pyr, zjewzgfh [7897,10857)/[7547,7897); D3e/DTr, sfn [3256051,3265763)/[3234534,3234967), UTF-16.
  let samplingUncertain = false, prefixSetUncertain = false;
  try {
    if (command.length <= 10000) {
      const tree = vS().parse(command, undefined);
      if (tree) {
        const sampledDenial: PermissionDecision | undefined = withShellAnalysisHome(shellAnalysisHome(process.env.HOME ?? ''), () => {
          const initial = E6(command, tree);
          if (initial.declarationPrefixes !== undefined) {
            const { readings: vectors, exhaustive: prefixesExhaustive } = pyr(initial.declarationPrefixes, initial.declarationPrefixBashKeeps);
            if (!prefixesExhaustive) prefixSetUncertain = true;
            for (const declarationPrefix of vectors) {
              const options = { plainUnquotedHeredocs: false, declarationPrefix };
              const analysis = E6(command, tree, options);
              if (analysis.kind !== 'simple') { samplingUncertain = true; continue; }
              for (const entry of analysis.commands) {
                const decision = decideOnce(policy, tool, withCommand(input, entry.text), session);
                if (decision.decision === 'deny') {
                  return { decision: 'deny', reason: `Permission to run this command was denied for an alternate reading: ${tool.schema.name}` };
                }
              }
            }
          }
        });
        if (sampledDenial !== undefined) return sampledDenial;
      } else if (command.trim() !== '') samplingUncertain = true;
    } else samplingUncertain = true;
  } catch { samplingUncertain = true; }
  const { readings, denyOnly, exhaustive } = shellReadings(command);
  // A deny-only reading is the command under a redirect, which the recovered
  // `GTr` checks against deny rules alone: an exact allow on the whole line
  // keeps standing, but a denial still reaches the command inside it.
  for (const reading of denyOnly) {
    const decision = decideOnce(policy, tool, withCommand(input, reading), session);
    if (decision.decision === 'deny') {
      return { decision: 'deny', reason: `Permission to run this command was denied for an alternate reading: ${tool.schema.name}` };
    }
  }
  // The recovered `DTr` (chunk-sfn1dbxq.js [3234534,3234967)) lets the
  // strictest reading decide: a denial anywhere wins, then the highest `Lcn`
  // rank among the primary and the alternates. A non-exhaustive set whose
  // winner is not an ask becomes an ask of its own. The call site `ior`
  // ([3253708,3254351)) downgrades a soft ask from the alternates to a
  // passthrough, but the entry `$pn` ([3360777,3364305)) turns every
  // passthrough back into an ask, so that path still asks; the host produces
  // no soft ask to downgrade in the first place.
  const mode = session?.mode ?? policy?.mode;
  const alternates: { decision: PermissionDecision; reading: string }[] = [];
  for (const reading of readings) {
    if (reading === command) continue;
    const decision = decideOnce(policy, tool, withCommand(input, reading), session);
    if (decision.decision === 'deny') {
      return { decision: 'deny', reason: `Permission to run this command was denied for an alternate reading: ${tool.schema.name}` };
    }
    alternates.push({ decision, reading });
  }
  let winner = baseline;
  let winnerReading: string | undefined;
  for (const alternate of alternates) {
    if (readingRank(alternate.decision) > readingRank(winner)) {
      winner = alternate.decision;
      winnerReading = alternate.reading;
    }
  }
  if (winnerReading !== undefined) {
    return { ...winner, reason: `Alternate command reading requires approval: ${winnerReading}` };
  }
  const allowRules = [...(policy?.allow ?? []), ...(session?.allow ?? [])];
  const wholeToolAllowed = allowRules.some(text => {
    const rule = Un(text);
    return rule.ruleContent === undefined && ruleToolMatches(rule.toolName, tool.schema.name);
  });
  const trimmedCommand = command.trim();
  const commandAllowedByRule = allowRules.some(text => {
    const rule = Un(text);
    if (rule.ruleContent === undefined || !ruleToolMatches(rule.toolName, tool.schema.name)) return false;
    return rule.ruleContent === trimmedCommand ||
      (rule.ruleContent.endsWith(':*') && trimmedCommand.startsWith(rule.ruleContent.slice(0, -2)));
  });
  if (samplingUncertain && winner.decision === 'allow') {
    return { decision: 'ask', floor: 'readings', reason: `This command has readings that cannot all be checked: ${tool.schema.name}` };
  }
  if (prefixSetUncertain && winner.decision === 'allow' && mode !== 'bypass' && !wholeToolAllowed && commandAllowedByRule) {
    return { decision: 'ask', floor: 'readings', reason: `This command has readings that cannot all be checked: ${tool.schema.name}` };
  }
  if (baseline.decision === 'allow' && mode !== 'bypass' && !exhaustive) {
    return { decision: 'ask', floor: 'readings', reason: `This command has readings that cannot all be checked: ${tool.schema.name}` };
  }
  return baseline;
}

export function permissionDecision(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates, workspace?: string): PermissionDecision {
  return decideWithObservations(policy, tool, input, session, workspace);
}

// $f/Yce and xv, 2bcyxj9q [231514,233054), [233474,235473), UTF-16.
// A bare allow-list for other tools is not a Read denial in the source path check.
export function sourceReadAutomaticallyAllowed(policy: PermissionPolicy | undefined, session: SessionPermissionUpdates,
  workspace: string, file: string, activeTools: readonly string[], invoked: string): boolean {
  if (activeTools.includes(invoked) && !activeTools.includes('read_file') && !activeTools.includes('repl')) return false;
  const resolved = resolveDecisionPolicy(policy, session);
  const current = resolved.policy;
  const bareRead = (rules: readonly string[] | undefined) => (rules ?? []).some(rule => bareRuleMatches(rule, 'read_file'));
  if (bareRead(current?.deny) || bareRead(current?.ask)) return false;
  const adjusted = current && { ...current, allow: current.allow.filter(rule => Un(rule).ruleContent !== undefined || bareRuleMatches(rule, 'read_file')) };
  const readTool: ToolDefinition = { schema: { name: 'read_file', input_schema: { type: 'object' } }, readOnly: true, execute: async () => '' };
  const decision = decideWithObservations(adjusted, readTool, { path: file }, resolved.session, workspace);
  return decision.decision === 'allow' || decision.decision === 'ask' && decision.floor !== 'rule' && session.mode === 'bypass';
}

type ReadCheckIdentity = { dev: bigint; ino: bigint } | null;

const addAbortListener = EventTarget.prototype.addEventListener;
const removeAbortListener = EventTarget.prototype.removeEventListener;

// Read checkPermissions, chunk-sfn1dbxq.js [3542972,3543340), UTF-16,
// sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// This standalone host adapter returns evidence only; no approval stash or file handle is owned here.
export class AsyncReadPermissionCheck {
  #lanes = new WeakMap<object, { stash: InstanceType<typeof Be>; key: string; providerId: string; tool?: ToolDefinition; active: boolean; pending: boolean; paths: Set<string>; signal?: AbortSignal; retire?: () => void }>();

  begin(providerId: string): object {
    const lane = Object.freeze({ providerId });
    this.#lanes.set(lane, { stash: new Be(), key: randomUUID(), providerId, active: true, pending: false, paths: new Set() });
    return lane;
  }

  finish(lane: object): void {
    const state = this.#lanes.get(lane);
    if (!state?.active) return;
    state.active = false;
    if (state.signal && state.retire) removeAbortListener.call(state.signal, 'abort', state.retire);
    for (const file of state.paths) state.stash.consume(state.key, file, 'read');
    state.paths.clear();
  }

  // Be consumes the whole read lane after both identities have been retrieved.
  take(lane: object, file: string, alternate?: string):
    { kind: 'saved'; paths: string[]; identity: ReadCheckIdentity | undefined; alternateIdentity: ReadCheckIdentity | undefined } | { kind: 'expired' } {
    const state = this.#lanes.get(lane);
    if (!state?.active) return { kind: 'expired' };
    const nativeAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
    if (state.pending || (state.signal && (!nativeAborted || nativeAborted.call(state.signal)))) {
      this.finish(lane);
      return { kind: 'expired' };
    }
    const identity = state.stash.takeIdentity(state.key, file);
    const alternateIdentity = alternate === undefined ? undefined : state.stash.takeIdentity(state.key, alternate);
    const paths = state.stash.consume(state.key, file, 'read');
    this.finish(lane);
    if (paths === j8e || !Array.isArray(paths)) return { kind: 'expired' };
    return { kind: 'saved', paths: [...paths], identity, alternateIdentity };
  }

  async check(args: { policy: PermissionPolicy | undefined; tool: ToolDefinition; input: { path: string };
    workspace: string; toolUseId?: string; session?: SessionPermissionUpdates; signal?: AbortSignal }, lane?: object): Promise<
      { kind: 'decision'; decision: PermissionDecision; observation: PathPermissionObservation | undefined; identity: ReadCheckIdentity | undefined } |
      { kind: 'cancelled' } | { kind: 'failure'; reason: string }> {
    let signal: AbortSignal | undefined;
    let keepLane = false;
    let retire: (() => void) | undefined;
    // Accept native signals, including subclasses; proxies and signal-shaped objects fail the brand check.
    const aborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
    try {
      // Host adaptation: the separate lane identifies this invocation before inspecting its arguments.
      if (args === null || typeof args !== 'object' || utilTypes.isProxy(args)) throw new Error('Expected non-proxy arguments');
      const prototype = Object.getPrototypeOf(args);
      const descriptor = Object.getOwnPropertyDescriptor(args, 'lane');
      if ((prototype !== Object.prototype && prototype !== null) || descriptor) throw new Error('Unexpected lane argument');
      const suppliedSignal = args.signal;
      if (suppliedSignal !== undefined) {
        if (utilTypes.isProxy(suppliedSignal) || !aborted) throw new Error('Expected a native AbortSignal');
        const cancelled = aborted.call(suppliedSignal);
        signal = suppliedSignal;
        if (cancelled) return { kind: 'cancelled' };
      }
      const laneState = lane === undefined ? undefined : this.#lanes.get(lane);
      if (lane !== undefined && !laneState?.active) throw new Error('Read lane expired');
      if (laneState?.pending) throw new Error('Concurrent read lane check');
      if (laneState) laneState.pending = true;
      if (laneState && lane !== undefined) {
        if (laneState.signal && laneState.signal !== signal) throw new Error('Read lane signal changed');
        if (signal && !laneState.signal) {
          const ownedLane = lane;
          retire = () => this.finish(ownedLane);
          laneState.signal = signal;
          laneState.retire = retire;
          addAbortListener.call(signal, 'abort', retire, { once: true });
          retire = undefined;
        }
      }
      const policy = args.policy;
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      const session = args.session;
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      const toolUseId = args.toolUseId;
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      const sourceTool = args.tool;
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      if (!sourceTool || typeof sourceTool !== 'object' || utilTypes.isProxy(sourceTool)) throw new Error('Expected a plain read tool');
      // Host lane ownership binds each observation to its call ID and tool instance.
      if (laneState) {
        if (toolUseId !== laneState.providerId || (laneState.tool && laneState.tool !== sourceTool)) throw new Error('Read lane owner changed');
        laneState.tool = sourceTool;
      }
      const descriptors = Object.getOwnPropertyDescriptors(sourceTool);
      if (Object.values(descriptors).some(descriptor => !('value' in descriptor))) throw new Error('Tool accessors are unsupported');
      const schema = descriptors.schema?.value;
      if (!schema || typeof schema !== 'object' || utilTypes.isProxy(schema)) throw new Error('Expected a read schema');
      const schemaDescriptors = Object.getOwnPropertyDescriptors(schema);
      if (Object.values(schemaDescriptors).some(descriptor => !('value' in descriptor)) || schemaDescriptors.name?.value !== 'read_file' ||
          descriptors.readPaths?.value) throw new Error('Expected a single read path');
      const merged = resolveDecisionPolicy(policy, session);
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      const denied = [...(merged.policy?.deny ?? []), ...(merged.session?.deny ?? [])].some(rule => bareRuleMatches(rule, 'read_file'));
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      if (denied) {
        return { kind: 'decision', decision: { decision: 'deny', reason: 'Tool denied by permission rule: read_file' }, observation: undefined, identity: undefined };
      }
      const input = snapshotPrototypeInput(args.input);
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      if (input === null || typeof input !== 'object' || Array.isArray(input) || typeof input.path !== 'string' || !input.path)
        throw new Error('Expected a single read path');
      const workspace = path.resolve(args.workspace);
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      const readOnly = descriptors.readOnly?.value;
      const execute = descriptors.execute?.value;
      if (typeof readOnly !== 'boolean' || typeof execute !== 'function') throw new Error('Expected a read tool');
      const tool: ToolDefinition = { schema: { name: 'read_file', input_schema: { type: 'object' } },
        readOnly, planOperation: descriptors.planOperation?.value, execute };
      const observation = observePermissionPath(workspace, input.path);
      if (laneState) {
        laneState.stash.stash(laneState.key, observation.requested, [...observation.spellings], 'read');
        laneState.paths.add(observation.requested);
      }
      let captured: ReadCheckIdentity | undefined;
      if (process.platform === 'darwin' && (toolUseId !== undefined || laneState !== undefined)) {
        const filesystem = { cwd: () => workspace, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync,
          realpathSync: (file: string) => fs.realpathSync(file).normalize('NFC') };
        const identities = createPathIdentity({ ie: () => filesystem, qpt: () => null });
        const binding = createPathApprovalBinding({ ie: () => filesystem, ...identities,
          O: undefined, QHt: undefined, Z3: undefined, lwe: undefined, t: undefined, ai: undefined, zut: undefined });
        const result: { own: ReadCheckIdentity; alt?: { path: string; identity: ReadCheckIdentity } } =
          await createReadIdentity(binding.vpe).whn(observation.requested, observation.spellings);
        if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
        if (laneState && (!laneState.active || (lane !== undefined && this.#lanes.get(lane) !== laneState))) return { kind: 'cancelled' };
        captured = result.own === null ? null : { ...result.own };
        if (laneState) {
          laneState.stash.stashIdentity(laneState.key, observation.requested, captured === null ? null : { ...captured });
          if (result.alt) laneState.stash.stashIdentity(laneState.key, result.alt.path, result.alt.identity);
        }
      }
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      const decision = decideWithObservations(policy, tool, input, session, workspace, undefined, observation);
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      if (laneState && (!laneState.active || (lane !== undefined && this.#lanes.get(lane) !== laneState))) return { kind: 'cancelled' };
      keepLane = decision.decision !== 'deny';
      return { kind: 'decision', decision, observation: structuredClone(observation), identity: captured };
    } catch (error) {
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      let reason: string;
      try { reason = String(error instanceof Error ? error.message : error); }
      catch { reason = 'Unknown error'; }
      if (signal && aborted?.call(signal)) return { kind: 'cancelled' };
      return { kind: 'failure', reason };
    } finally {
      if (signal && retire) {
        try { removeAbortListener.call(signal, 'abort', retire); }
        catch {
          if (lane !== undefined) this.finish(lane);
          if (aborted?.call(signal)) return { kind: 'cancelled' };
          return { kind: 'failure', reason: 'Abort listener cleanup failed' };
        }
      }
      if (signal && aborted?.call(signal)) {
        if (lane !== undefined) this.finish(lane);
        return { kind: 'cancelled' };
      }
      if (lane !== undefined) {
        const state = this.#lanes.get(lane);
        if (keepLane && !state?.active) return { kind: 'cancelled' };
        if (!keepLane) this.finish(lane);
        else if (state) state.pending = false;
      }
    }
  }
}

type PrototypeInput = null | boolean | number | string | PrototypeInput[] | { [key: string]: PrototypeInput };
type PrototypeDecision =
  | { kind: 'unsupported-input'; reason: string }
  | { kind: 'observed'; input: PrototypeInput; decision: PermissionDecision;
      coverage: 'partial-host-short-circuit'; observations: PathPermissionObservation[] };

// Only inert JSON-shaped data is accepted; accessors and shared memory are never cloned.
function snapshotPrototypeInput(input: unknown, seen = new Set<object>()): PrototypeInput {
  if (input === null || typeof input === 'string' || typeof input === 'boolean') return input;
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input !== 'object' || utilTypes.isProxy(input) || seen.has(input)) throw new Error('Expected an acyclic JSON-shaped input without proxies');
  seen.add(input);
  try {
    const proto = Object.getPrototypeOf(input);
    const array = Array.isArray(input);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) {
      throw new Error('Expected plain objects and arrays');
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Object.getOwnPropertySymbols(input).length) throw new Error('Symbol keys are unsupported');
    const output: PrototypeInput[] | { [key: string]: PrototypeInput } = array ? [] : Object.create(proto);
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === 'length') continue;
      if (!descriptor.enumerable || !('value' in descriptor)) throw new Error('Accessors and non-enumerable properties are unsupported');
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length)) throw new Error('Array properties are unsupported');
      Object.defineProperty(output, key, { value: snapshotPrototypeInput(descriptor.value, seen), enumerable: true, writable: true, configurable: true });
    }
    if (array && Object.keys(output).length !== input.length) throw new Error('Sparse arrays are unsupported');
    return output;
  } finally { seen.delete(input); }
}

const prototypeReadHandoffs = new WeakMap<object, { input: object; inputText: string; workspace: string; observationsText: string; observation: PathPermissionObservation }>();

// Private decision evidence prevents a caller from substituting or modifying observations.
export function verifiedPrototypeRead(input: unknown, workspace: string, observations: readonly PathPermissionObservation[]): PathPermissionObservation | undefined {
  const handoff = prototypeReadHandoffs.get(observations);
  if (!handoff || handoff.input !== input || handoff.workspace !== path.resolve(workspace) ||
      handoff.inputText !== JSON.stringify(snapshotPrototypeInput(input)) ||
      handoff.observationsText !== JSON.stringify(snapshotPrototypeInput(observations))) return undefined;
  return structuredClone(handoff.observation);
}

// Fixture-only host ordering; coverage is partial even when every visited path was observed.
export function prototypePermissionDecision(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates, workspace?: string): PrototypeDecision {
  let snapshot: PrototypeInput;
  try { snapshot = snapshotPrototypeInput(input); }
  catch (error) { return { kind: 'unsupported-input', reason: error instanceof Error ? error.message : String(error) }; }
  const isolatedTool: ToolDefinition = Object.create(tool);
  Object.defineProperty(isolatedTool, 'readPaths', { get() {
    const readPaths = tool.readPaths;
    return readPaths && ((value: unknown) => readPaths.call(tool, snapshotPrototypeInput(value)));
  } });
  const observations: PathPermissionObservation[] = [];
  const decision = decideWithObservations(policy, isolatedTool, snapshot, session, workspace, observations);
  const observation = observations[0];
  if (decision.decision === 'allow' && tool.schema.name === 'read_file' && observations.length === 1 &&
      observation && !observation.unresolved && snapshot !== null && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const effectiveWorkspace = workspace ?? session?.ruleWorkspace ?? policy?.ruleWorkspace ?? process.cwd();
    prototypeReadHandoffs.set(observations, { input: snapshot, inputText: JSON.stringify(snapshot),
      workspace: path.resolve(effectiveWorkspace), observationsText: JSON.stringify(observations), observation: structuredClone(observation) });
  }
  return { kind: 'observed', input: snapshot, decision, coverage: 'partial-host-short-circuit', observations };
}

function resolveDecisionPolicy(policy: PermissionPolicy | undefined, session?: SessionPermissionUpdates) {
  const owner = session ?? permissionOwner(policy)?.state();
  if (policy?.layers || policy && permissionOwners.has(policy)) {
    policy = effectivePermissionPolicy(policy, owner ?? seedPermissionUpdates(policy));
    session = undefined;
  }
  if (session && sessionUpdatesActive(session)) {
    const seeded = seedPermissionUpdates(policy);
    policy = effectivePermissionPolicy(policy, { ...session,
      allow: [...(policy?.allow ?? []), ...session.allow], deny: [...(policy?.deny ?? []), ...session.deny],
      ask: [...(policy?.ask ?? []), ...session.ask],
      alwaysAllowRules: { ...seeded.alwaysAllowRules, ...session.alwaysAllowRules },
      alwaysDenyRules: { ...seeded.alwaysDenyRules, ...session.alwaysDenyRules },
      alwaysAskRules: { ...seeded.alwaysAskRules, ...session.alwaysAskRules } });
    session = undefined;
  }
  return { policy, session, owner };
}

function decideWithObservations(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates, workspace?: string, observations?: PathPermissionObservation[],
  fixedObservation?: PathPermissionObservation): PermissionDecision {
  const observe = (directory: string, file: string): PathPermissionObservation => {
    const result = observePermissionPath(directory, file);
    if (observations) observations.push(structuredClone(result));
    return result;
  };
  const resolved = resolveDecisionPolicy(policy, session);
  ({ policy, session } = resolved);
  const owner = resolved.owner;
  let baseline: PermissionDecision;
  try {
    const executionWorkspace = workspace ?? owner?.ruleWorkspace ?? policy?.ruleWorkspace ?? process.cwd();
    const file = typeof input === 'object' && input !== null && !Array.isArray(input)
      ? Object.getOwnPropertyDescriptor(input, 'path')?.value : undefined;
    let observed = false;
    let observation: PathPermissionObservation | undefined;
    const getObservation = (): PathPermissionObservation | undefined => {
      if (!observed) {
        observed = true;
        if (FILE_PERMISSION_TOOLS.has(tool.schema.name) && typeof file === 'string' && file.length > 0) {
          observation = fixedObservation ?? observe(executionWorkspace, file);
        }
      }
      return observation;
    };
    baseline = decideOnce(policy, tool, input, session, owner?.planFile, getObservation, executionWorkspace, owner?.planOwnership);
    // SendFileTool/IA, 8t44px9f [22793,31590), 2bcyxj9q [231514,231561), UTF-16.
    if (tool.readPaths && baseline.decision !== 'deny') {
      const readTool: ToolDefinition = { schema: { name: 'read_file', input_schema: { type: 'object' } }, readOnly: true, execute: async () => '' };
      let reading: PermissionDecision | undefined;
      for (const file of tool.readPaths(input)) {
        let readObservation: PathPermissionObservation | undefined;
        let decision = decideOnce(policy, readTool, { path: file }, session, owner?.planFile,
          () => readObservation ??= observe(executionWorkspace, file), executionWorkspace, owner?.planOwnership);
        if (decision.decision !== 'deny') {
          readObservation ??= observe(executionWorkspace, file);
          decision = filePathDecision(readTool.schema.name, readObservation) ?? decision;
        }
        if (decision.decision === 'deny') { reading = decision; break; }
        if (decision.decision === 'ask' && (reading === undefined || decision.floor === 'rule')) reading = decision;
      }
      if (reading?.decision === 'deny' || reading?.decision === 'ask' && (baseline.decision === 'allow' || reading.floor === 'rule')) baseline = reading;
    }
    if (baseline.decision !== 'deny') {
      baseline = filePathDecision(tool.schema.name, getObservation()) ?? baseline;
    }
  } catch (error) { return { decision: 'deny', reason: `Permission path check failed: ${error instanceof Error ? error.message : String(error)}` }; }
  const result = !policy && !sessionUpdatesActive(session) ? baseline : applyShellReadings(policy, tool, input, baseline, session, workspace, owner?.planFile);
  // axr, sfn [3321472,3323500), UTF-16. Chrome origin-consent has no local tool surface.
  return (session?.mode ?? policy?.mode) === 'dontAsk' && result.decision === 'ask'
    ? { decision: 'deny', reason: `Dont-ask mode denied approval: ${tool.schema.name}` } : result;
}

function decideOnce(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates, planFile?: string, observation?: () => PathPermissionObservation | undefined, workspace?: string,
  planOwner?: PlanOwnership): PermissionDecision {
  const active = sessionUpdatesActive(session);
  if (!policy && !active) return { decision: 'allow' };
  const mode = session?.mode ?? policy?.mode ?? 'default';
  planFile ??= session?.planFile ?? (policy === undefined ? undefined : planFiles.get(policy));
  planOwner ??= session?.planOwnership ?? (policy === undefined ? undefined : planOwners.get(policy));
  if (mode === 'default' && policy?.ask === undefined && policy?.inputRules === undefined && !active &&
      ![...(policy?.allow ?? []), ...(policy?.deny ?? [])].some(text => Un(text).ruleContent !== undefined)) {
    const reason = permissionError(policy, tool);
    return reason ? { decision: 'deny', reason } : { decision: 'allow' };
  }
  const name = tool.schema.name;
  const unsupported = policy && unsupportedContentRule(policy, name);
  if (unsupported) return { decision: 'deny', reason: unsupported };
  // Session rules join the settings-derived rules for the same decision: a
  // deny on either side wins, and a session allow satisfies the allow list.
  if ((policy?.deny ?? []).some(rule => bareRuleMatches(rule, name)) || (session?.deny ?? []).some(rule => bareRuleMatches(rule, name)) ||
      policy && contentRuleMatches(policy, 'deny', name, input, observation?.(), workspace)) {
    return { decision: 'deny', reason: `Tool denied by permission rule: ${name}` };
  }
  const applicable = (policy?.inputRules ?? []).filter(rule => inputRuleMatches(rule, name, input));
  if (applicable.some(rule => rule.decision === 'deny')) {
    return { decision: 'deny', reason: `Tool input denied by permission rule: ${name}` };
  }
  // c_/aNe/fl, 2bcyxj9q [235473,238027)/[241113,242279)/[205509,205734); et, wh2vcbh8 [3533,4062), UTF-16.
  const requestedPath = typeof input === 'object' && input !== null
    ? Object.getOwnPropertyDescriptor(input, 'path')?.value : undefined;
  const directory = workspace ?? policy?.ruleWorkspace ?? process.cwd();
  const observed = planOwner && typeof requestedPath === 'string' ? observation?.() : undefined;
  const ownedPlan = ['read_file', 'write_file', 'edit_file'].includes(name) && typeof requestedPath === 'string' &&
    (planOwner !== undefined ? resolveOwnedPlanFile(directory, requestedPath, planOwner) !== undefined &&
      observed !== undefined && !observed.unresolved && observed.spellings.length > 0 &&
      observed.spellings.every(spelling => ownsPlanPath(planOwner, spelling))
      : planFile !== undefined && resolvePlanFile(directory, requestedPath, planFile) !== undefined);
  if (mode === 'plan' && !tool.readOnly && !ownedPlan && tool.planOperation !== 'exit') {
    return { decision: 'deny', reason: `Plan mode permits read-only tools: ${name}` };
  }
  const explicitAllow = (policy?.allow ?? []).some(rule => bareRuleMatches(rule, name)) ||
    applicable.some(rule => rule.decision === 'allow') ||
    (session?.allow ?? []).some(rule => bareRuleMatches(rule, name)) ||
    policy !== undefined && contentRuleMatches(policy, 'allow', name, input, observation?.(), workspace);
  if ((policy?.allow.filter(text => Un(text).ruleContent === undefined).length ?? 0) && !explicitAllow) {
    return { decision: 'deny', reason: `Tool is outside the allow list: ${name}` };
  }
  // xv/c_, 2bcyxj9q [233474,238027), UTF-16: explicit ask precedes the plan exception.
  if ((policy?.ask ?? []).some(rule => bareRuleMatches(rule, name)) || applicable.some(rule => rule.decision === 'ask') ||
      (session?.ask ?? []).some(rule => bareRuleMatches(rule, name)) || policy && contentRuleMatches(policy, 'ask', name, input, observation?.(), workspace)) {
    return { decision: 'ask', floor: 'rule', reason: `Tool requires approval by permission rule: ${name}` };
  }
  if (ownedPlan || tool.planOperation !== undefined || explicitAllow || mode === 'bypass') return { decision: 'allow' };
  const shell = SHELL_TOOLS.has(name) || (name === 'monitor' && typeof input === 'object' && input !== null &&
    typeof Object.getOwnPropertyDescriptor(input, 'command')?.value === 'string');
  if ((mode === 'ask' || mode === 'dontAsk' || mode === 'auto') && (!tool.readOnly || shell)) {
    return { decision: 'ask', reason: `Ask mode requires approval: ${name}` };
  }
  if (mode === 'acceptEdits' && (!tool.readOnly || shell) && (shell || !EDIT_TOOLS.has(name))) {
    return { decision: 'ask', reason: `Accept-edits mode requires approval for this tool: ${name}` };
  }
  return { decision: 'allow' };
}
