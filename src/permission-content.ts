import path from 'node:path';
import os from 'node:os';
import ignore from 'ignore';
import { tNe, en, Wn, Vo, Cf, uZ, jxe } from './permission-content-source.js';
import { Un } from './permission-rule-source.js';
import { isCompoundReading, prefixMatches, trailingWildcard } from './agent-tool-restrictions.js';
import { resolveChain } from './path-identity.js';
import type { PermissionPolicy } from './permissions.js';

const contentOwners = new WeakMap<PermissionPolicy, object>();
const physicalTwins = new WeakMap<object, Map<string, Set<string>>>();

export function bindContentRuleOwner(policy: PermissionPolicy, owner: object): void {
  contentOwners.set(policy, owner);
}

const families: Readonly<Record<string, readonly string[]>> = {
  Read: ['read_file', 'read_media', 'notebook_read', 'list_files', 'search'],
  Edit: ['write_file', 'edit_file', 'notebook_edit', 'lsp_edit'],
  Write: ['write_file'], NotebookRead: ['notebook_read'], NotebookEdit: ['notebook_edit'],
  Glob: ['list_files'], Bash: ['run_command', 'run_background', 'bash', 'Bash', 'monitor'],
};
export function hasContentConsumer(name: string): boolean {
  return Object.hasOwn(families, name) || Object.values(families).some(names => names.includes(name));
}
export function ruleToolMatches(rule: string, name: string): boolean {
  return rule === name || families[rule]?.includes(name) === true;
}

/** xX [3205608,3207630), 3cy uZ/jxe [182221,183008), UTF-16. */
export function shellContentMatches(content: string, command: string, behavior: 'allow' | 'deny' | 'ask'): boolean {
  const rule = jxe(content);
  const reading = command.trim();
  if (rule.type === 'exact') return rule.command === reading;
  if (behavior === 'allow' && isCompoundReading(reading)) return false;
  if (rule.type === 'prefix') return prefixMatches(rule.prefix, reading);
  return uZ(rule.pattern, reading) || (behavior !== 'allow' || trailingWildcard(rule.pattern)) && uZ(`xargs ${rule.pattern}`, reading);
}

/** Nn/Ui/ZYt, 2bcy [221752,223408)/[225036,225815)/[226996,227149), UTF-16. */
export function contentRuleMatches(policy: PermissionPolicy, behavior: 'allow' | 'deny' | 'ask', name: string,
  input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const command = Object.getOwnPropertyDescriptor(input, 'command')?.value;
  const file = Object.getOwnPropertyDescriptor(input, 'path')?.value;
  const layers = policy.layers ?? [{ source: 'cliArg', root: policy.ruleWorkspace ?? process.cwd(),
    allow: policy.allow, deny: policy.deny, ask: policy.ask ?? [], additionalDirectories: [] }];
  const workspace = policy.ruleWorkspace ?? process.cwd();
  const shell = families.Bash!.includes(name) && typeof command === 'string';
  const fileFamily = families.Read!.includes(name) || families.Edit!.includes(name);
  if (!shell && (!fileFamily || typeof file !== 'string')) return false;
  if (shell) return layers.some(layer => layer[behavior]?.some(text => {
    const rule = Un(text);
    return rule.ruleContent !== undefined && ruleToolMatches(rule.toolName, name) &&
      shellContentMatches(rule.ruleContent, command, behavior);
  }));
  const resolved = resolveChain(workspace, file);
  const spellings = [...new Set([path.resolve(workspace, file), ...(resolved.spellings ?? []), resolved.path])];
  const owner = contentOwners.get(policy) ?? policy;
  let observed = physicalTwins.get(owner);
  if (!observed) { observed = new Map(); physicalTwins.set(owner, observed); }
  const groups = new Map<string | null, Map<string, string[]>>();
  const add = (root: string | null, source: string, pattern: string) => {
    let bucket = groups.get(root);
    if (!bucket) { bucket = new Map(); groups.set(root, bucket); }
    const patterns = bucket.get(source) ?? [];
    const previous = patterns.indexOf(pattern);
    if (behavior !== 'allow' && previous >= 0) patterns.splice(previous, 1);
    patterns.push(pattern);
    bucket.set(source, patterns);
  };
  for (const layer of layers) for (const text of layer[behavior] ?? []) {
    const rule = Un(text);
    if (rule.ruleContent === undefined) continue;
    const readDeny = behavior === 'deny' && rule.toolName === 'Read' && families.Edit!.includes(name);
    if (!readDeny && !ruleToolMatches(rule.toolName, name)) continue;
    // Source path consumers use the Edit family for Write and NotebookEdit too.
    const parsed: { relativePattern: string; root: string | null } = tNe(rule.ruleContent, layer.root || workspace);
    const pattern: string | null = Vo(en(parsed.relativePattern), behavior === 'allow');
    if (pattern === null) continue;
    const source = behavior === 'allow' ? '' : layer.source;
    add(parsed.root, source, Wn(pattern, behavior === 'allow'));
    if (behavior === 'allow' || parsed.root === null) continue;
    // Nn [221752,223408), UTF-16. Retain observed twins in this owner's root-NUL-pattern set.
    const key = `${parsed.root}\0${pattern}`;
    let twins = observed.get(key);
    if (!twins) { twins = new Set(); observed.set(key, twins); }
    const twin = Cf(parsed.root, pattern);
    if (twin !== null) twins.add(twin);
    for (const retained of twins) add(path.parse(parsed.root).root, source, Wn(retained, false));
  }
  const matched = (spelling: string) => [...groups].some(([root, sources]) => {
    const relative = path.relative(root ?? workspace, spelling).split(path.sep).join('/');
    if (!relative || !ignore.isPathValid(relative)) return false;
    return [...sources.values()].reverse().some(patterns => ignore().add(patterns).test(relative).ignored);
  });
  return behavior === 'allow' ? spellings.every(matched) : spellings.some(matched);
}
