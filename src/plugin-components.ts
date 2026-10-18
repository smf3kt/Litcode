import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import { hooksSchema } from './hooks.js';
import { CONFIG_LIMITS, ConfigError, type SkillInfo } from './config.js';
import type { AgentTypeInfo } from './agent-types.js';
import type { InstalledPluginComponents, PluginCommandMetadata } from './plugins.js';

export interface ComponentDiagnostic {
  plugin: string;
  component: 'skills' | 'agents' | 'commands';
  path: string;
  message: string;
}
export interface ComponentBudget {
  remaining: number;
}
export interface PluginComponentCatalog {
  skills: SkillInfo[];
  agents: AgentTypeInfo[];
  diagnostics: ComponentDiagnostic[];
}
const objectSchema = z.record(z.unknown());
/** Ygt/fHe/ib, chunk-sfn1dbxq.js [436958,437364); Lu, chunk-z6p21rxk.js [3933,4292); UTF-16. */
const names = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const result: string[] = [];
  for (const item of values) {
    let word = '', parentheses = false;
    for (const char of item) {
      if (char === '(') parentheses = true;
      if (char === ')') parentheses = false;
      if ((char === ',' || char === ' ') && !parentheses) {
        if (word.trim()) result.push(word.trim());
        word = '';
      } else if (word || char.trim()) word += char;
    }
    if (word.trim()) result.push(word.trim());
  }
  return result.includes('*') ? ['*'] : result;
};
const text = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value.trim() : undefined;
const description = (value: unknown): string | undefined => text(value) ?? (typeof value === 'number' || typeof value === 'boolean' ? String(value) : undefined);
const summary = (body: string, fallback: string) => {
  const line = body.split('\n').map(line => line.trim()).find(Boolean)?.replace(/^#+\s+(\S.*)$/, '$1');
  return line ? line.length > 100 ? line.substring(0, 97) + '...' : line : fallback;
};
const effortSchema = z.enum(['low', 'medium', 'high', 'xhigh', 'max']);
const slashName = z.string().min(1).max(128).regex(/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/);
/** Source `Wbe`, chunk-3cynezh1.js [109634,109851): a hook tree declares a guard event. */
const guardHooks = (hooks: unknown): boolean => {
  if (!hooks || typeof hooks !== 'object') return false;
  if (Array.isArray(hooks)) return hooks.some(guardHooks);
  return Object.entries(hooks).some(([event, value]) => (event === 'PreToolUse' || event === 'PermissionRequest') &&
    value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0));
};

/** si/tXt/I, chunk-zm79vshj.js [5416,5880), [6938,8558), UTF-16. yaml is the Node native-parser adapter. */
export function parsePluginFrontmatter(raw: string): { data: Record<string, unknown>; body: string; error?: string } {
  const normalized = raw.charCodeAt(0) === 65279 ? raw.slice(1) : raw;
  const match = normalized.indexOf('---', 3) < 0 ? null : normalized.match(/^---\s*\n([\s\S]*?)---\s*\n?/);
  if (!match) return { data: {}, body: raw };
  const source = match[1] ?? '';
  const body = normalized.slice(match[0].length);
  const decode = (input: string) => {
    const value: unknown = parse(input, { maxAliasCount: 0 });
    const checked = objectSchema.safeParse(value);
    return checked.success ? checked.data : {};
  };
  try { return { data: decode(source), body }; } catch { /* Source retries repaired scalars once. */ }
  const repaired = source.split('\n').map(line => {
    const scalar = line.match(/^([a-zA-Z_-]+):\s+(\S.*)$/);
    if (!scalar) return line;
    const key = scalar[1], value = scalar[2];
    if (!key || !value || value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) return line;
    if (value.startsWith('[') && value.endsWith(']')) {
      try { if (Array.isArray(parse(value, { maxAliasCount: 0 }))) return line; } catch { /* Fall through to scalar quoting. */ }
    }
    return /[{}[\]*&#!|>%@`]|: /.test(value) ? `${key}: ${JSON.stringify(value)}` : line;
  }).join('\n').replace(/^\t+/gm, tabs => '  '.repeat(tabs.length));
  try { return { data: decode(repaired), body }; }
  catch (error) { return { data: {}, body, error: error instanceof Error ? error.message : String(error) }; }
}

/** Adapted KU/DDt/nle/Z5t, chunk-sfn1dbxq.js [957150,972849), [2048211,2053851), UTF-16. */
export function loadPluginComponents(components: readonly InstalledPluginComponents[], userFiles: ReadonlySet<string> = new Set(),
  budget: ComponentBudget = { remaining: CONFIG_LIMITS.textBytesTotal }, namespaced = false): PluginComponentCatalog {
  const result: PluginComponentCatalog = { skills: [], agents: [], diagnostics: [] };
  const skillFiles = new Set(userFiles);
  const skillNames = new Set<string>();
  for (const item of components) {
    const plugin = item.plugin.manifest.name;
    const report = (component: ComponentDiagnostic['component'], file: string, message: string) => result.diagnostics.push({ plugin, component, path: file, message });
    for (const problem of item.componentProblems) report(problem.component, problem.path, `${problem.type}${problem.reason ? ': ' + problem.reason : ''}`);
    const read = (file: string, component: ComponentDiagnostic['component']) => {
      try {
        const bytes = item.componentFiles.get(path.relative(item.directory, file));
        if (!bytes) throw new Error('component must be a regular file within 1048576 bytes');
        // Recovered `Yk` reads each component under the shared budget; the
        // original bytes are charged once per canonical path.
        if (budget.remaining < bytes.length) {
          throw new ConfigError(`instruction/skill text exceeds ${CONFIG_LIMITS.textBytesTotal} byte aggregate budget`, file);
        }
        if (bytes.length > 1048576) throw new Error('component must be a regular file within 1048576 bytes');
        budget.remaining -= bytes.length;
        const frontmatter = parsePluginFrontmatter(bytes.toString('utf8'));
        if (frontmatter.error) report(component, file, frontmatter.error);
        return frontmatter;
      } catch (error) {
        // The shared aggregate budget is an owned host contract; the source
        // per-component cap stays a per-entry skip.
        if (error instanceof ConfigError) throw error;
        report(component, file, String(error)); return undefined;
      }
    };
    const seen = { skills: new Set<string>(), agents: new Set<string>(), commands: new Set<string>() };
    const unique = (file: string, component: ComponentDiagnostic['component']) => {
      let identity = file;
      try { identity = fs.realpathSync(file); } catch { /* Dedup failure preserves candidate identity only. */ }
      if (seen[component].has(identity)) return false;
      seen[component].add(identity);
      if (component === 'skills') {
        if (skillFiles.has(identity)) return false;
        skillFiles.add(identity);
      }
      return true;
    };
    const prompt = (file: string, proposed: string, format: 'skill' | 'command', raw: ReturnType<typeof parsePluginFrontmatter>, metadata?: PluginCommandMetadata) => {
      const data: Record<string, unknown> = { ...raw.data,
        ...(metadata?.description ? { description: metadata.description } : {}),
        ...(metadata?.argumentHint ? { 'argument-hint': metadata.argumentHint } : {}),
        ...(metadata?.model ? { model: metadata.model } : {}),
        ...(metadata?.allowedTools ? { 'allowed-tools': metadata.allowedTools } : {}) };
      const declaredName = text(data.name);
      const bare = proposed.startsWith(`${plugin}:`) ? proposed.slice(plugin.length + 1) : proposed;
      const fullName = format === 'skill' && !namespaced ? bare : proposed;
      if (!slashName.safeParse(fullName).success) { report(format === 'skill' ? 'skills' : 'commands', file, 'invalid component name'); return; }
      if (skillNames.has(fullName)) return;
      skillNames.add(fullName);
      const skill: SkillInfo = { name: fullName, description: description(data.description) ?? summary(raw.body, format === 'skill' ? 'Plugin skill' : 'Plugin command'),
        path: file, body: raw.body, source: 'plugin', format, plugin,
        userInvocable: data['user-invocable'] === undefined || data['user-invocable'] === true || data['user-invocable'] === 'true',
        disableModelInvocation: data['disable-model-invocation'] === true || data['disable-model-invocation'] === 'true' };
      if (format === 'skill' && namespaced && bare !== fullName) skill.aliases = [bare];
      // The plugin-qualified name is the command; a bare frontmatter name is
      // only a declaration (source `pt`, chunk-sfn1dbxq.js offset 960220).
      if (format === 'skill' && namespaced && declaredName && !declaredName.includes(':') && slashName.safeParse(declaredName).success && declaredName !== fullName) skill.aliases = [...new Set([...(skill.aliases ?? []), declaredName])];
      const allowed = names(data['allowed-tools']);
      if (allowed) skill.allowedTools = allowed;
      if (format === 'skill' && data.hooks !== undefined) {
        const hooks = hooksSchema.safeParse(data.hooks);
        // Source `Wn`: top-level PreToolUse/PermissionRequest, or unreadable
        // hooks, drop allowed-tools entirely (chunk-sfn1dbxq.js offset 962131).
        if (hooks.success && guardHooks(hooks.data)) { skill.hooks = hooks.data; skill.allowedTools = []; }
        else if (hooks.success) skill.hooks = hooks.data;
        else { skill.allowedTools = []; report('skills', file, 'invalid hooks ignored with allowed-tools'); }
      }
      const shell = text(data.shell);
      if (shell) skill.shell = shell;
      const metadataValue = objectSchema.safeParse(data.metadata);
      if (metadataValue.success) skill.metadata = metadataValue.data;
      const disallowed = names(data['disallowed-tools']);
      if (disallowed) skill.disallowedTools = disallowed;
      const argumentsList = names(data.arguments);
      if (argumentsList) skill.argumentNames = argumentsList.filter(value => !/^\d+$/.test(value));
      const model = text(data.model);
      if (model) skill.model = model;
      const effort = effortSchema.safeParse(data.effort);
      if (effort.success) skill.effort = effort.data;
      if (data.context === 'fork') skill.context = 'fork';
      const agent = text(data.agent);
      if (agent) skill.agent = agent;
      if (data.background === true || data.background === 'true') skill.background = true;
      if (format === 'skill') skill.body = `Base directory for this skill: ${path.dirname(file)}\n\n${skill.body.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, item.directory).replace(/\$\{CLAUDE_SKILL_DIR\}/g, path.dirname(file))}`;
      else skill.body = skill.body.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, item.directory);
      result.skills.push(skill);
    };
    let directories = 0;
    const walk = (directory: string, component: 'agents' | 'commands', visit: (file: string, namespace: string[]) => void, namespace: string[] = []) => {
      if (namespace.length >= 32 || ++directories > 4096) { report(component, directory, 'directory scan limit reached'); return; }
      try {
        const relative = path.relative(item.directory, directory);
        const entries = item.componentEntries.filter(entry => entry.path !== relative && path.dirname(entry.path) === (relative || '.'))
          .map(entry => ({ name: path.basename(entry.path), isFile: () => entry.kind === 'file', isDirectory: () => entry.kind === 'directory' }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const skills = component === 'commands' ? entries.filter(entry => entry.isFile() && /^skill\.md$/i.test(entry.name)) : [];
        if (skills.length) { visit(path.join(directory, skills[0]!.name), namespace); return; }
        for (const entry of entries) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) walk(file, component, visit, [...namespace, entry.name]);
          else if (entry.isFile() && /\.md$/i.test(entry.name)) visit(file, namespace);
        }
      } catch (error) { if (error instanceof ConfigError) throw error; report(component, directory, String(error)); }
    };
    for (const directory of item.skillDirectories) {
      const own = path.join(directory, 'SKILL.md');
      const load = (file: string, fallback: string, direct: boolean) => {
        if (!unique(file, 'skills')) return;
        const raw = read(file, 'skills');
        if (!raw) return;
        const declared = text(raw.data.name)?.replace(new RegExp(`^${plugin}:`), '');
        const name = (declared || fallback).replace(/[^a-zA-Z0-9_-]/g, '-');
        prompt(file, `${plugin}:${name}`, 'skill', raw);
      };
      if (item.componentFiles.has(path.relative(item.directory, own))) load(own, path.basename(directory), true);
      else try {
        const relative = path.relative(item.directory, directory);
        for (const entry of item.componentEntries.filter(entry => entry.kind === 'directory' && path.dirname(entry.path) === (relative || '.'))) {
          const file = path.join(item.directory, entry.path, 'SKILL.md');
          if (item.componentFiles.has(path.relative(item.directory, file))) load(file, path.basename(entry.path), false);
        }
      } catch (error) { if (error instanceof ConfigError) throw error; report('skills', directory, String(error)); }
    }
    for (const source of item.commandSources) {
      if (source.kind === 'inline') {
        prompt(`<inline:${plugin}:${source.name}>`, `${plugin}:${source.name}`, 'command', parsePluginFrontmatter(source.content), source.metadata);
        continue;
      }
      const directorySource = item.componentEntries.some(entry => entry.path === path.relative(item.directory, source.path) && entry.kind === 'directory');
      const load = (file: string, namespace: string[]) => {
        if (!unique(file, 'commands')) return;
        const raw = read(file, 'commands');
        if (!raw) return;
        const skill = /^skill\.md$/i.test(path.basename(file));
        const suffix = skill ? namespace.length ? namespace : [path.basename(path.dirname(file))] : [...namespace, path.basename(file, '.md')];
        // A SKILL.md inside a command directory is a skill entry and follows the
        // skill naming feature; plain commands stay plugin-qualified.
        const shortName = directorySource ? suffix.join(':') : source.name ?? suffix.join(':');
        prompt(file, `${plugin}:${shortName}`, skill ? 'skill' : 'command', raw, directorySource ? undefined : source.metadata);
      };
      try {
        if (item.componentEntries.some(entry => entry.path === path.relative(item.directory, source.path) && entry.kind === 'directory')) walk(source.path, 'commands', load);
        else if (source.path.endsWith('.md')) load(source.path, []);
      } catch (error) { if (error instanceof ConfigError) throw error; report('commands', source.path, String(error)); }
    }
    for (const source of item.agentPaths) {
      const load = (file: string, namespace: string[]) => {
        if (!unique(file, 'agents')) return;
        const raw = read(file, 'agents');
        if (!raw) return;
        const data = raw.data;
        // Source `nXt`: an over-length name is ignored, then the file stem is
        // used (chunk-zm79vshj.js [10385,10555), AY = 256).
        const declared = text(data.name);
        const stem = declared !== undefined && declared.length > 256 ? path.basename(file, '.md') : declared ?? path.basename(file, '.md');
        const name = [plugin, ...namespace, stem].join(':');
        if (!slashName.safeParse(name).success) { report('agents', file, 'invalid agent name'); return; }
        const agent: AgentTypeInfo = { name, description: description(data.description) ?? description(data.when_to_use) ?? description(data['when-to-use']) ?? `Agent from ${plugin} plugin`,
          path: file, body: raw.body.trim().replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, item.directory), mode: 'general', plugin };
        const tools = names(data.tools);
        if (tools && !tools.includes('*')) agent.tools = tools;
        const disallowed = names(data.disallowedTools);
        if (disallowed) agent.disallowedTools = disallowed;
        const skills = names(data.skills);
        if (skills) agent.skills = skills;
        const model = text(data.model);
        if (model) agent.model = model.toLowerCase() === 'inherit' ? 'inherit' : model;
        const effort = effortSchema.safeParse(data.effort);
        if (effort.success) agent.effort = effort.data;
        else if (data.effort !== undefined) report('agents', file, 'invalid effort ignored');
        if (data.isolation === 'worktree') agent.isolation = 'worktree';
        const turns = z.number().int().positive().safeParse(typeof data.maxTurns === 'string' ? Number(data.maxTurns) : data.maxTurns);
        if (turns.success) agent.maxTurns = turns.data;
        else if (data.maxTurns !== undefined) report('agents', file, 'invalid maxTurns ignored');
        if (data.background === true || data.background === 'true') agent.background = true;
        // Source Z5t field gates: memory must be one of three roots, and an
        // integer window within the compact range (chunk-sfn1dbxq.js offset 2048211).
        if (data.memory !== undefined) {
          if (data.memory === 'user' || data.memory === 'project' || data.memory === 'local') agent.memory = data.memory;
          else report('agents', file, 'invalid memory value ignored');
        }
        if (data.autoCompactWindow !== undefined) {
          const window = z.number().int().min(100000).max(1000000).safeParse(data.autoCompactWindow);
          if (window.success) agent.autoCompactWindow = window.data;
          else report('agents', file, 'invalid autoCompactWindow ignored');
        }
        const experimental = objectSchema.safeParse(data.experimental);
        if (experimental.success) {
          const ttl = Object.entries(experimental.data).find(([key]) => key.toLowerCase() === 'cachettl')?.[1];
          if (ttl === '5m' || ttl === '1h') agent.cacheTtl = ttl;
        }
        for (const key of ['permissionMode', 'hooks', 'mcpServers']) {
          if (data[key] !== undefined) report('agents', file, `${key} is ignored for plugin agents; use .harness/agents/ for this level of control`);
        }
        for (const key of ['initialPrompt', 'observer', 'observerMessage', 'observeSubagents']) {
          if (data[key] !== undefined) report('agents', file, `${key} is ignored for plugin agents; define the agent in .harness/agents/ to use ${key}`);
        }
        result.agents.push(agent);
      };
      try {
        if (item.componentEntries.some(entry => entry.path === path.relative(item.directory, source) && entry.kind === 'directory')) walk(source, 'agents', load);
        else if (source.endsWith('.md')) load(source, []);
      } catch (error) { if (error instanceof ConfigError) throw error; report('agents', source, String(error)); }
    }
  }
  return result;
}
