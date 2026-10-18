// Per-spawn tool restrictions from `agent({disallowedTools, bashCommandClamp})`.
//
// Source: chunk-hedqf2m1.js option validation [77200,80100), tool-pool checks
// [88500,101000), chunk-sfn1dbxq.js `fTr` [5444505,5444900) and `xX`
// [5439798,5443900), chunk-z6p21rxk.js `Un`/`hpe` [95,205), and
// chunk-3cynezh1.js `jxe`/`Bxe` [264332,266180). The permission-rule grammar,
// the every-reading invariant and the fail-closed clamp are ported; MCP server
// wildcards and the source's legacy tool aliases are not part of this runtime.

import { shellReadings } from './shell-readings.js';

/** The source's Bash permission-rule tool name (`Be`, chunk-r2vtj1kh.js). */
export const BASH_RULE_TOOL = 'Bash';

/** Tools whose `command` field runs a shell line in this runtime. */
export const CLAMPED_SHELL_TOOLS = new Set(['run_command', 'run_background', 'bash', 'Bash']);

export type ParsedToolRule = { toolName: string; ruleContent?: string };

function unescapedIndex(text: string, character: string, fromEnd: boolean): number {
  const step = fromEnd ? -1 : 1;
  let index = fromEnd ? text.length - 1 : 0;
  while (index >= 0 && index < text.length) {
    if (text[index] === character) {
      let slashes = 0;
      let back = index - 1;
      while (back >= 0 && text[back] === '\\') { slashes++; back--; }
      if (slashes % 2 === 0) return index;
    }
    index += step;
  }
  return -1;
}

const BACKSLASH = String.fromCharCode(92);

function unescapeRuleContent(content: string): string {
  return content.split(`${BACKSLASH}(`).join('(')
    .split(`${BACKSLASH})`).join(')')
    .split(`${BACKSLASH}${BACKSLASH}`).join(BACKSLASH);
}

/**
 * The source's `Un`: `Tool(content)` splits on the first unescaped `(` and the
 * last unescaped `)`; a missing or unbalanced pair names the whole text.
 * Empty and `*` content are a bare tool rule, and escaped parens unescape.
 */
export function parseToolRule(text: string): ParsedToolRule {
  if (!text.includes('(') && !text.includes(')')) return { toolName: text };
  const open = unescapedIndex(text, '(', false);
  const close = unescapedIndex(text, ')', true);
  if (open === -1 && close === -1) return { toolName: text };
  const toolName = text.slice(0, open);
  if (open === -1 || close <= open || close !== text.length - 1 || /[()]/.test(toolName)) {
    return { toolName: text };
  }
  const rawContent = text.slice(open + 1, close);
  if (rawContent === '' || rawContent === '*') return { toolName };
  return { toolName, ruleContent: unescapeRuleContent(rawContent) };
}

/**
 * `agent() opts.disallowedTools` (chunk-hedqf2m1.js [77423,78030)): an array of
 * non-empty, unpadded tool-name strings; an empty array narrows nothing.
 */
export function normalizeDisallowedTools(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((entry: unknown) => typeof entry !== 'string' || entry === '' || entry !== entry.trim())) {
    const got = Array.isArray(value) ? 'an array with non-string, empty, or whitespace-padded entries' : typeof value;
    throw new Error(`agent() opts.disallowedTools must be an array of non-empty tool-name strings (e.g. ['run_command', 'write_file']); got ${got}. Refusing the spawn rather than running it un-narrowed.`);
  }
  return value.length === 0 ? undefined : [...new Set(value as string[])].sort();
}

/**
 * `agent() opts.bashCommandClamp` (chunk-hedqf2m1.js [78145,79640)): `Bash(...)`
 * allow rules whose content names a command or a `prefix:*` form. Each spawn
 * contributes one clamp group; inherited groups all have to admit a command.
 */
export function normalizeBashCommandClamp(value: unknown): string[][] | undefined {
  if (!Array.isArray(value) || value.some((entry: unknown) => typeof entry !== 'string' || entry === '' || entry !== entry.trim())) {
    const got = Array.isArray(value) ? 'an array with non-string, empty, or whitespace-padded entries' : typeof value;
    throw new Error(`agent() opts.bashCommandClamp must be an array of non-empty strings; got ${got}. Refusing the spawn rather than running it un-clamped.`);
  }
  if (value.length === 0) return undefined;
  const rules = [...new Set(value as string[])].sort();
  for (const rule of rules) {
    const parsed = parseToolRule(rule);
    if (parsed.toolName !== BASH_RULE_TOOL || parsed.ruleContent === undefined || parsed.ruleContent === '' ||
        parsed.ruleContent !== parsed.ruleContent.trim()) {
      const detail = parsed.ruleContent === undefined || parsed.ruleContent === ''
        ? ' with no rule content'
        : parsed.ruleContent !== parsed.ruleContent.trim() ? ' with whitespace-padded rule content' : '';
      throw new Error(`agent() opts.bashCommandClamp entry '${rule}' must be a 'Bash(<command or prefix>)' permission rule `
        + `(tool name case-sensitive, non-empty content with no leading/trailing whitespace inside the parens); it parses to `
        + `tool '${parsed.toolName}'${detail}. Refusing the spawn rather than running it with an inert clamp entry.`);
    }
  }
  return [rules];
}

type McpName = { serverName: string; toolName?: string };

function parseMcpName(toolName: string): McpName | null {
  if (!toolName.startsWith('mcp__')) return null;
  const rest = toolName.slice(5);
  if (rest === '') return { serverName: '' };
  const separator = rest.indexOf('__');
  if (separator === -1) return { serverName: rest };
  return { serverName: rest.slice(0, separator), toolName: rest.slice(separator + 2) };
}

function mcpRuleMatches(mcp: McpName, toolName: string): boolean {
  if (mcp.serverName === '*') return toolName.startsWith('mcp__');
  if (mcp.serverName === '') return false;
  if (mcp.toolName === undefined || mcp.toolName === '*') {
    return toolName.startsWith(`mcp__${mcp.serverName}__`);
  }
  return toolName === `mcp__${mcp.serverName}__${mcp.toolName}`;
}

/** True when one deny entry removes this tool name from the pool. */
export function toolNameDenied(toolName: string, entries: readonly string[]): boolean {
  for (const entry of entries) {
    const { toolName: ruleName } = parseToolRule(entry);
    if (ruleName === toolName) return true;
    const mcp = parseMcpName(ruleName);
    if (mcp !== null && mcpRuleMatches(mcp, toolName)) return true;
  }
  return false;
}

function entryMatchesPool(ruleName: string, pool: readonly string[]): boolean {
  const mcp = parseMcpName(ruleName);
  if (mcp !== null) return pool.some(name => mcpRuleMatches(mcp, name));
  return pool.includes(ruleName);
}

/**
 * The source's pool checks for `disallowedTools` (chunk-hedqf2m1.js
 * [92900,98900)): an entry that cannot parse, an empty or wildcard MCP segment,
 * or a case mismatch is refused rather than silently dropped; an entry naming
 * no pool tool is a no-op.
 */
export function validateDisallowedTools(entries: readonly string[], pool: readonly string[]): void {
  for (const entry of entries) {
    const { toolName } = parseToolRule(entry);
    if (toolName !== toolName.trim() || /[\s()]/.test(toolName.trim())) {
      throw new Error(`agent() opts.disallowedTools entry '${entry}' parses to tool name '${toolName}', which can never match a tool — `
        + 'check for a space before the rule parens or an unbalanced paren. Refusing the spawn rather than running it un-narrowed.');
    }
    if (toolName.startsWith('mcp__')) {
      const mcp = parseMcpName(toolName)!;
      if (mcp.serverName === '') {
        throw new Error(`agent() opts.disallowedTools entry '${entry}' cannot match any tool — its server segment is empty, so it names no server. `
          + "Use 'mcp__<server>' to deny one server's tools ('mcp__<server>__<tool>' for one tool), or 'mcp__*' to deny every MCP server's tools. "
          + 'Refusing the spawn rather than running it un-narrowed.');
      }
      if (mcp.serverName.includes('*') && mcp.serverName !== '*') {
        throw new Error(`agent() opts.disallowedTools entry '${entry}' cannot match any tool — server names take no wildcard. `
          + "Use 'mcp__*' for every MCP server's tools. Refusing the spawn rather than running it un-narrowed.");
      }
      if (mcp.toolName !== undefined && mcp.toolName !== '*' && mcp.toolName.includes('*')) {
        throw new Error(`agent() opts.disallowedTools entry '${entry}' cannot match any tool — tool names take no wildcard. `
          + 'Enumerate exact tool names, or use \'mcp__*\' to deny every MCP server\'s tools. Refusing the spawn rather than running it un-narrowed.');
      }
    } else if (toolName.includes('*')) {
      throw new Error(`agent() opts.disallowedTools entry '${entry}' cannot match any tool — '*' is not a deny wildcard outside mcp__ server specs. `
        + "Enumerate the tools to deny (e.g. ['run_command', 'write_file']), or use 'mcp__*' to deny every MCP server's tools. "
        + 'Refusing the spawn rather than running it un-narrowed.');
    }
    if (entryMatchesPool(toolName, pool)) continue;
    const lowered = toolName.toLowerCase();
    const caseMatch = pool.find(name => name.toLowerCase() === lowered)
      ?? (toolName.startsWith('mcp__')
        ? (() => {
          const mcp = parseMcpName(toolName)!;
          if (mcp.serverName === '*' || mcp.serverName === '') return undefined;
          return pool.find(name => name.toLowerCase().startsWith(`mcp__${mcp.serverName.toLowerCase()}__`));
        })()
        : undefined);
    if (caseMatch !== undefined) {
      throw new Error(`agent() opts.disallowedTools entry '${entry}' does not match any tool, but '${caseMatch}' exists — tool names are case-sensitive. `
        + 'Refusing the spawn rather than running it with this deny silently dropped.');
    }
  }
}

/**
 * Source `fTr`: every reading of the command has to match a rule in every clamp
 * group, and a reading set that is not exhaustive cannot be admitted at all.
 */
export function checkBashCommandClamp(command: string, groups: readonly (readonly string[])[]): {
  kind: 'unverifiable' | 'unmatched'; span: string; group: readonly string[];
} | null {
  if (groups.length === 0) return null;
  const { readings, exhaustive } = shellReadings(command);
  if (!exhaustive) return { kind: 'unverifiable', span: command.trim(), group: groups[0] ?? [] };
  for (const group of groups) {
    for (const reading of readings) {
      if (!clampAdmits(reading, group)) return { kind: 'unmatched', span: reading, group };
    }
  }
  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function globMatch(pattern: string, value: string): boolean {
  let source = '^';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index]!;
    if (character === '\\' && index + 1 < pattern.length) { source += escapeRegExp(pattern[++index]!); continue; }
    source += character === '*' ? '.*' : escapeRegExp(character);
  }
  return new RegExp(`${source}$`).test(value);
}

function hasUnescapedWildcard(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    if (text[index] !== '*') continue;
    let slashes = 0;
    let back = index - 1;
    while (back >= 0 && text[back] === '\\') { slashes++; back--; }
    if (slashes % 2 === 0) return true;
  }
  return false;
}

export function trailingWildcard(text: string): boolean {
  const trimmed = text.trimEnd();
  if (!trimmed.endsWith('*')) return false;
  let slashes = 0;
  let back = trimmed.length - 2;
  while (back >= 0 && trimmed[back] === '\\') { slashes++; back--; }
  return slashes % 2 === 0;
}

/** A reading with shell control flow cannot satisfy a prefix or wildcard rule. */
export function isCompoundReading(reading: string): boolean {
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < reading.length; index++) {
    const character = reading[index]!;
    if (quote === "'") { if (character === "'") quote = undefined; continue; }
    if (quote === '"') {
      if (character === '\\') { index++; continue; }
      if (character === '"') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === '\\') { index++; continue; }
    if (character === ';' || character === '\n' || character === '|' || character === '&' ||
        character === '(' || character === ')') return true;
  }
  return false;
}

export function prefixMatches(prefix: string, reading: string): boolean {
  const normalize = (text: string) => text.replace(/[ \t]+/g, ' ');
  const wanted = normalize(prefix);
  const actual = normalize(reading);
  if (actual === wanted || actual.startsWith(`${wanted} `)) return true;
  const xargs = `xargs ${wanted}`;
  return actual === xargs || actual.startsWith(`${xargs} `);
}

function clampAdmits(reading: string, group: readonly string[]): boolean {
  for (const rule of group) {
    const parsed = parseToolRule(rule);
    if (parsed.toolName !== BASH_RULE_TOOL || parsed.ruleContent === undefined || parsed.ruleContent === '') continue;
    const content = parsed.ruleContent;
    const prefix = /^(.+):\*$/.exec(content)?.[1];
    if (prefix !== undefined) {
      if (!isCompoundReading(reading) && prefixMatches(prefix, reading)) return true;
      continue;
    }
    if (hasUnescapedWildcard(content)) {
      if (!isCompoundReading(reading) && trailingWildcard(content) &&
          (globMatch(content, reading) || globMatch(`xargs ${content}`, reading))) return true;
      continue;
    }
    if (reading === content) return true;
  }
  return false;
}

/** The source's clamp denial text (chunk-sfn1dbxq.js [174085,174105)). */
export function bashCommandClampDenial(toolName: string, command: string,
  failure: { kind: 'unverifiable' | 'unmatched'; span: string; group: readonly string[] }): string {
  return `Permission to use ${toolName} with command ${command.trim()} has been denied: this agent's Bash use is clamped to a fixed set of `
    + 'command forms (per-spawn bashCommandClamp), and '
    + (failure.kind === 'unverifiable'
      ? 'the command has structure the clamp cannot verify (substitution, control flow, or an undecomposable compound) — '
        + 'no clamp rule can admit it. Issue plain commands matching the clamped forms.'
      : `the span ${JSON.stringify(failure.span)} matches none of them. Allowed forms: ${failure.group.join(', ')}`);
}
