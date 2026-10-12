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
function applyShellReadings(policy: PermissionPolicy, tool: ToolDefinition, input: unknown, baseline: PermissionDecision): PermissionDecision {
  if (baseline.decision === 'deny') return baseline;
  const command = commandInput(tool, input);
  if (command === undefined) return baseline;
  if (!(policy.inputRules ?? []).some(rule => rule.command !== undefined && matches(rule.tool, tool.schema.name))) return baseline;
  const { readings, exhaustive } = shellReadings(command);
  let sawAsk = false;
  for (const reading of readings) {
    if (reading === command) continue;
    const decision = decideOnce(policy, tool, withCommand(input, reading));
    if (decision.decision === 'deny') {
      return { decision: 'deny', reason: `Permission to run this command was denied for an alternate reading: ${tool.schema.name}` };
    }
    if (decision.decision === 'ask') sawAsk = true;
  }
  if (baseline.decision === 'allow' && policy.mode !== 'bypass' && (!exhaustive || sawAsk)) {
    return { decision: 'ask', reason: `This command has readings that cannot all be checked: ${tool.schema.name}` };
  }
  return baseline;
}

export function permissionDecision(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown): PermissionDecision {
  const baseline = decideOnce(policy, tool, input);
  if (!policy) return baseline;
  return applyShellReadings(policy, tool, input, baseline);
}

function decideOnce(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown): PermissionDecision {
  if (!policy) return { decision: 'allow' };
  if (policy.mode === 'default' && policy.ask === undefined && policy.inputRules === undefined) {
    const reason = permissionError(policy, tool);
    return reason ? { decision: 'deny', reason } : { decision: 'allow' };
  }
  const name = tool.schema.name;
  if (policy.deny.some(rule => matches(rule, name))) {
    return { decision: 'deny', reason: `Tool denied by permission rule: ${name}` };
  }
  const applicable = (policy.inputRules ?? []).filter(rule => inputRuleMatches(rule, name, input));
  if (applicable.some(rule => rule.decision === 'deny')) {
    return { decision: 'deny', reason: `Tool input denied by permission rule: ${name}` };
  }
  if (policy.mode === 'plan' && !tool.readOnly) {
    return { decision: 'deny', reason: `Plan mode permits read-only tools: ${name}` };
  }
  const explicitAllow = policy.allow.some(rule => matches(rule, name)) || applicable.some(rule => rule.decision === 'allow');
  if (policy.allow.length && !explicitAllow) {
    return { decision: 'deny', reason: `Tool is outside the allow list: ${name}` };
  }
  if ((policy.ask ?? []).some(rule => matches(rule, name)) || applicable.some(rule => rule.decision === 'ask')) {
    return { decision: 'ask', reason: `Tool requires approval by permission rule: ${name}` };
  }
  if (explicitAllow || policy.mode === 'bypass') return { decision: 'allow' };
  const shell = SHELL_TOOLS.has(name) || (name === 'monitor' && typeof input === 'object' && input !== null &&
    typeof Object.getOwnPropertyDescriptor(input, 'command')?.value === 'string');
  if (policy.mode === 'ask' && (!tool.readOnly || shell)) {
    return { decision: 'ask', reason: `Ask mode requires approval: ${name}` };
  }
  if (policy.mode === 'acceptEdits' && (!tool.readOnly || shell) && (shell || !EDIT_TOOLS.has(name))) {
    return { decision: 'ask', reason: `Accept-edits mode requires approval for this tool: ${name}` };
  }
  return { decision: 'allow' };
}
