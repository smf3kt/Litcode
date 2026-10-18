import { z } from 'zod';

import type { ToolDefinition } from './tools.js';
import { shellReadings } from './shell-readings.js';
import { KI, Do } from './permission-reducer-source.js';
import { Un, _n } from './permission-rule-source.js';
import { bindContentRuleOwner, contentRuleMatches, ruleToolMatches, hasContentConsumer } from './permission-content.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { resolveChain, verifyIdentity } from './path-identity.js';

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

export type LivePermissionOwner = {
  prepareAutoMode?(): void;
  state(): SessionPermissionUpdates;
  workingDirectories(readOnly: boolean): readonly string[];
  adoptUpdates?(updates: readonly PermissionUpdate[]): PermissionUpdatesOutcome;
};
const permissionOwners = new WeakMap<PermissionPolicy, LivePermissionOwner>();

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
 * The recovered client checks every reading of a shell command against the
 * permission rules and takes any denial, and it will not let an incomplete
 * reading set pass on the strength of a single reading. That invariant is
 * applied here on top of the plain decision, and only when a rule actually
 * constrains the command text: rules that name a tool alone cannot depend on
 * how the shell reads the line, so behaviour without a `command` rule is
 * unchanged. A denial is never softened, and `bypass` keeps its meaning rather
 * than turning into an approval prompt.
 */
function applyShellReadings(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown, baseline: PermissionDecision,
  session?: SessionPermissionUpdates): PermissionDecision {
  if (baseline.decision === 'deny') return baseline;
  const command = commandInput(tool, input);
  if (command === undefined) return baseline;
  if (!(policy?.inputRules ?? []).some(rule => rule.command !== undefined && matches(rule.tool, tool.schema.name)) &&
      ![...(policy?.allow ?? []), ...(policy?.deny ?? []), ...(policy?.ask ?? []), ...(session?.allow ?? []),
        ...(session?.deny ?? []), ...(session?.ask ?? [])].some(text => {
          const rule = Un(text); return rule.ruleContent !== undefined && ruleToolMatches(rule.toolName, tool.schema.name);
        })) return baseline;
  const { readings, exhaustive } = shellReadings(command);
  let askDecision: PermissionDecision | undefined;
  let sawAsk = false;
  for (const reading of readings) {
    if (reading === command) continue;
    const decision = decideOnce(policy, tool, withCommand(input, reading), session);
    if (decision.decision === 'deny') {
      return { decision: 'deny', reason: `Permission to run this command was denied for an alternate reading: ${tool.schema.name}` };
    }
    if (decision.decision === 'ask' && decision.floor !== undefined) askDecision ??= { ...decision, reason: `Alternate command reading requires approval: ${reading}` };
    if (decision.decision === 'ask') sawAsk = true;
  }
  if (askDecision) return askDecision;
  const mode = session?.mode ?? policy?.mode;
  if (baseline.decision === 'allow' && mode !== 'bypass' && (!exhaustive || sawAsk)) {
    return { decision: 'ask', floor: 'readings', reason: `This command has readings that cannot all be checked: ${tool.schema.name}` };
  }
  return baseline;
}

export function permissionDecision(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates): PermissionDecision {
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
  let baseline: PermissionDecision;
  try { baseline = decideOnce(policy, tool, input, session); }
  catch (error) { return { decision: 'deny', reason: `Permission path check failed: ${error instanceof Error ? error.message : String(error)}` }; }
  const result = !policy && !sessionUpdatesActive(session) ? baseline : applyShellReadings(policy, tool, input, baseline, session);
  // axr, sfn [3321472,3323500), UTF-16. Chrome origin-consent has no local tool surface.
  return (session?.mode ?? policy?.mode) === 'dontAsk' && result.decision === 'ask'
    ? { decision: 'deny', reason: `Dont-ask mode denied approval: ${tool.schema.name}` } : result;
}

function decideOnce(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates): PermissionDecision {
  const active = sessionUpdatesActive(session);
  if (!policy && !active) return { decision: 'allow' };
  const mode = session?.mode ?? policy?.mode ?? 'default';
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
      policy && contentRuleMatches(policy, 'deny', name, input)) {
    return { decision: 'deny', reason: `Tool denied by permission rule: ${name}` };
  }
  const applicable = (policy?.inputRules ?? []).filter(rule => inputRuleMatches(rule, name, input));
  if (applicable.some(rule => rule.decision === 'deny')) {
    return { decision: 'deny', reason: `Tool input denied by permission rule: ${name}` };
  }
  if (mode === 'plan' && !tool.readOnly) {
    return { decision: 'deny', reason: `Plan mode permits read-only tools: ${name}` };
  }
  const explicitAllow = (policy?.allow ?? []).some(rule => bareRuleMatches(rule, name)) ||
    applicable.some(rule => rule.decision === 'allow') ||
    (session?.allow ?? []).some(rule => bareRuleMatches(rule, name)) ||
    policy !== undefined && contentRuleMatches(policy, 'allow', name, input);
  if ((policy?.allow.filter(text => Un(text).ruleContent === undefined).length ?? 0) && !explicitAllow) {
    return { decision: 'deny', reason: `Tool is outside the allow list: ${name}` };
  }
  if ((policy?.ask ?? []).some(rule => bareRuleMatches(rule, name)) || applicable.some(rule => rule.decision === 'ask') ||
      (session?.ask ?? []).some(rule => bareRuleMatches(rule, name)) || policy && contentRuleMatches(policy, 'ask', name, input)) {
    return { decision: 'ask', floor: 'rule', reason: `Tool requires approval by permission rule: ${name}` };
  }
  if (explicitAllow || mode === 'bypass') return { decision: 'allow' };
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
