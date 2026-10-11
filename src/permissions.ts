import { z } from 'zod';

import type { ToolDefinition } from './tools.js';

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

export function permissionDecision(policy: PermissionPolicy | undefined, tool: ToolDefinition, input: unknown): PermissionDecision {
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
