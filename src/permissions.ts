import { z } from 'zod';

import type { ToolDefinition } from './tools.js';
import { shellReadings } from './shell-readings.js';

const patternSchema = z.string().max(4096);
export const permissionPolicySchema = z.object({
  mode: z.enum(['default', 'plan', 'acceptEdits', 'bypass', 'ask']),
  allow: z.array(patternSchema).max(1024),
  deny: z.array(patternSchema).max(1024),
  ask: z.array(patternSchema).max(1024).optional(),
  inputRules: z.array(z.object({
    tool: patternSchema,
    path: patternSchema.optional(),
    command: patternSchema.optional(),
    decision: z.enum(['allow', 'deny', 'ask']),
  }).strict()).max(1024).optional(),
}).strict();

export type PermissionPolicy = z.infer<typeof permissionPolicySchema>;
export type PermissionDecision = { decision: 'allow' | 'deny' | 'ask'; reason?: string };

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

/**
 * Session-scoped permission rules adopted from a PermissionRequest allow
 * answer. The source keeps this beside the settings-derived policy in its
 * session permission context (chunk-fyhzvvp0.js `CUt` launcher arm offset 3459:
 * `setSessionToolPermissionContext(...)` then `O1(...)`). This product has no
 * settings writer, so every destination applies to this in-memory session
 * state and nothing is persisted (see the W118 port record).
 */
export type SessionPermissionUpdates = {
  mode?: PermissionPolicy['mode'];
  allow: string[];
  deny: string[];
  ask: string[];
};

export const emptySessionPermissionUpdates = (): SessionPermissionUpdates => ({ allow: [], deny: [], ask: [] });

function sessionUpdatesActive(session: SessionPermissionUpdates | undefined): boolean {
  return session !== undefined &&
    (session.mode !== undefined || session.allow.length > 0 || session.deny.length > 0 || session.ask.length > 0);
}

/**
 * The source's refusal text when a deny or ask rule the answer added cannot be
 * in force (`AXn`, chunk-sfn1dbxq.js offset 544491). The launcher consumer never reaches it — it applies
 * every update to its session context — but this product cannot represent a
 * rule that carries `ruleContent`, so the conservative branch of the source's
 * own strict consumer is used instead of running without the restriction.
 */
export const PERMISSION_UPDATES_UNAPPLIED =
  'The call was not run. The permission answer allowed it and also asked for changes to the permission rules. ' +
  'This session could not apply them all, so a deny or ask rule among them may not be in force. ' +
  'Nothing that the answer allowed is in force either. Tell the person so. ' +
  'A new call can be allowed by an answer that changes fewer rules, or none.';

/** The source modes this product's policy can express; `auto` and `dontAsk` have no local counterpart. */
const UPDATE_MODES: Partial<Record<(typeof PERMISSION_MODES)[number], PermissionPolicy['mode']>> = {
  default: 'default',
  plan: 'plan',
  acceptEdits: 'acceptEdits',
  bypassPermissions: 'bypass',
};

export type PermissionUpdatesOutcome = {
  /** The state to keep. Uncommitted when `blocked` is set: the source applies nothing then. */
  state: SessionPermissionUpdates;
  /** Updates the product cannot represent, named for the record. */
  dropped: string[];
  /** Set when the answer must not run the call (see `PERMISSION_UPDATES_UNAPPLIED`). */
  blocked?: string;
};

/**
 * Apply one allow answer's updates to the session state.
 *
 * The source's launcher consumer (`q`/`WK`, chunk-fyhzvvp0.js offset 3459 and
 * chunk-nkb63p1y.js offset 3840) hands each update to its session permission
 * context and persists it; replacements and removals address the destination's
 * rule set. This product keeps one in-memory session set and no settings
 * writer, so:
 *  - add/replace/remove act on the session set for the named behavior;
 *  - rules without `ruleContent` map to the product's tool-name patterns;
 *  - a deny or ask rule that carries `ruleContent` cannot be represented, so
 *    the call is refused rather than run without a restriction the answer
 *    asked for (`AXn`, the source's strict-consumer refusal);
 *  - an allow rule that carries `ruleContent` (and a `setMode` this product
 *    cannot express) is dropped, as the source drops unsupported updates in
 *    `s9r` (chunk-sfn1dbxq.js offset 546964);
 *  - directory updates have no local counterpart and are dropped.
 */
export function applyPermissionUpdates(state: SessionPermissionUpdates, updates: readonly PermissionUpdate[]): PermissionUpdatesOutcome {
  const next: SessionPermissionUpdates = { mode: state.mode, allow: [...state.allow], deny: [...state.deny], ask: [...state.ask] };
  const dropped: string[] = [];
  let blocked: string | undefined;
  const listFor = (behavior: 'allow' | 'deny' | 'ask'): string[] => next[behavior];

  for (const update of updates) {
    switch (update.type) {
      case 'setMode': {
        const mode = UPDATE_MODES[update.mode];
        if (mode === undefined) dropped.push(`setMode ${update.mode}`);
        else next.mode = mode;
        break;
      }
      case 'addRules': {
        for (const rule of update.rules) {
          if (rule.ruleContent !== undefined) {
            if (update.behavior === 'allow') dropped.push(`${update.behavior} rule ${rule.toolName}`);
            else blocked ??= PERMISSION_UPDATES_UNAPPLIED;
            continue;
          }
          const list = listFor(update.behavior);
          if (!list.includes(rule.toolName)) list.push(rule.toolName);
        }
        break;
      }
      case 'replaceRules': {
        const kept: string[] = [];
        for (const rule of update.rules) {
          if (rule.ruleContent !== undefined) {
            if (update.behavior === 'allow') dropped.push(`${update.behavior} rule ${rule.toolName}`);
            else blocked ??= PERMISSION_UPDATES_UNAPPLIED;
            continue;
          }
          if (!kept.includes(rule.toolName)) kept.push(rule.toolName);
        }
        next[update.behavior] = kept;
        break;
      }
      case 'removeRules': {
        for (const rule of update.rules) {
          if (rule.ruleContent !== undefined) {
            // A removal this product cannot address leaves the merged rule
            // set in place; dropping it can only keep a restriction, never
            // lose one.
            dropped.push(`${update.behavior} rule ${rule.toolName}`);
            continue;
          }
          next[update.behavior] = next[update.behavior].filter((item) => item !== rule.toolName);
        }
        break;
      }
      case 'addDirectories':
      case 'removeDirectories': {
        dropped.push(update.type);
        break;
      }
    }
  }
  return blocked === undefined ? { state: next, dropped } : { state: next, dropped, blocked };
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

export function permissionError(policy: PermissionPolicy | undefined, tool: ToolDefinition): string | undefined {
  if (!policy) return undefined;
  if (policy.deny.some(rule => legacyMatches(rule, tool.schema.name))) return `Tool denied by permission rule: ${tool.schema.name}`;
  if (policy.mode === 'plan' && !tool.readOnly) return `Plan mode permits read-only tools: ${tool.schema.name}`;
  if (policy.allow.length && !policy.allow.some(rule => legacyMatches(rule, tool.schema.name))) return `Tool is outside the allow list: ${tool.schema.name}`;
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
  if (!(policy?.inputRules ?? []).some(rule => rule.command !== undefined && matches(rule.tool, tool.schema.name))) return baseline;
  const { readings, exhaustive } = shellReadings(command);
  let sawAsk = false;
  for (const reading of readings) {
    if (reading === command) continue;
    const decision = decideOnce(policy, tool, withCommand(input, reading), session);
    if (decision.decision === 'deny') {
      return { decision: 'deny', reason: `Permission to run this command was denied for an alternate reading: ${tool.schema.name}` };
    }
    if (decision.decision === 'ask') sawAsk = true;
  }
  const mode = session?.mode ?? policy?.mode;
  if (baseline.decision === 'allow' && mode !== 'bypass' && (!exhaustive || sawAsk)) {
    return { decision: 'ask', reason: `This command has readings that cannot all be checked: ${tool.schema.name}` };
  }
  return baseline;
}

export function permissionDecision(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates): PermissionDecision {
  const baseline = decideOnce(policy, tool, input, session);
  if (!policy && !sessionUpdatesActive(session)) return baseline;
  return applyShellReadings(policy, tool, input, baseline, session);
}

function decideOnce(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown,
  session?: SessionPermissionUpdates): PermissionDecision {
  const active = sessionUpdatesActive(session);
  if (!policy && !active) return { decision: 'allow' };
  const mode = session?.mode ?? policy?.mode ?? 'default';
  if (mode === 'default' && policy?.ask === undefined && policy?.inputRules === undefined && !active) {
    const reason = permissionError(policy, tool);
    return reason ? { decision: 'deny', reason } : { decision: 'allow' };
  }
  const name = tool.schema.name;
  // Session rules join the settings-derived rules for the same decision: a
  // deny on either side wins, and a session allow satisfies the allow list.
  if ((policy?.deny ?? []).some(rule => matches(rule, name)) || (session?.deny ?? []).some(rule => matches(rule, name))) {
    return { decision: 'deny', reason: `Tool denied by permission rule: ${name}` };
  }
  const applicable = (policy?.inputRules ?? []).filter(rule => inputRuleMatches(rule, name, input));
  if (applicable.some(rule => rule.decision === 'deny')) {
    return { decision: 'deny', reason: `Tool input denied by permission rule: ${name}` };
  }
  if (mode === 'plan' && !tool.readOnly) {
    return { decision: 'deny', reason: `Plan mode permits read-only tools: ${name}` };
  }
  const explicitAllow = (policy?.allow ?? []).some(rule => matches(rule, name)) ||
    applicable.some(rule => rule.decision === 'allow') ||
    (session?.allow ?? []).some(rule => matches(rule, name));
  if ((policy?.allow.length ?? 0) && !explicitAllow) {
    return { decision: 'deny', reason: `Tool is outside the allow list: ${name}` };
  }
  if ((policy?.ask ?? []).some(rule => matches(rule, name)) || applicable.some(rule => rule.decision === 'ask') ||
      (session?.ask ?? []).some(rule => matches(rule, name))) {
    return { decision: 'ask', reason: `Tool requires approval by permission rule: ${name}` };
  }
  if (explicitAllow || mode === 'bypass') return { decision: 'allow' };
  const shell = SHELL_TOOLS.has(name) || (name === 'monitor' && typeof input === 'object' && input !== null &&
    typeof Object.getOwnPropertyDescriptor(input, 'command')?.value === 'string');
  if (mode === 'ask' && (!tool.readOnly || shell)) {
    return { decision: 'ask', reason: `Ask mode requires approval: ${name}` };
  }
  if (mode === 'acceptEdits' && (!tool.readOnly || shell) && (shell || !EDIT_TOOLS.has(name))) {
    return { decision: 'ask', reason: `Accept-edits mode requires approval for this tool: ${name}` };
  }
  return { decision: 'allow' };
}
