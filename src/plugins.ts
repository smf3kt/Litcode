// Independent local plugin contract. Packages are inert directory snapshots;
// discovery never executes hooks/servers or consults marketplaces or OAuth.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { hooksSchema, type HooksConfig } from "./hooks.js";
import { mcpServersSchema } from "./mcp.js";
import type { ToolContext, ToolDefinition } from "./tools.js";

export const PLUGIN_LIMITS = Object.freeze({
  files: 1024, entries: 4096, bytes: 16 * 1024 * 1024,
  fileBytes: 4 * 1024 * 1024, manifestBytes: 64 * 1024,
  indexBytes: 512 * 1024, plugins: 64, depth: 32,
});
const nameSchema = z.string().max(64).regex(/^[a-z][a-z0-9_-]*$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const localPath = z.string().min(1).max(4096).refine(s => !/[\x00-\x1f\x7f]/.test(s));
function relativePath(value: string): string {
  if (value.length > 1024 || path.isAbsolute(value) || /[\\:\x00-\x1f\x7f]/.test(value)
    || value.split("/").some(p => !p || p === "." || p === "..")) {
    throw new Error(`Invalid plugin relative path: ${JSON.stringify(value)}`);
  }
  return value;
}
const themePathSchema = z.string().min(1).max(1024).refine(s => {
  try { relativePath(s); return true; } catch { return false; }
}, "themes must name a relative file or directory");
const themesSchema = z.union([themePathSchema, z.array(themePathSchema).max(PLUGIN_LIMITS.entries)]);
export const pluginManifestSchema = z.object({
  name: nameSchema,
  version: z.string().min(1).max(128).refine(s => s.trim() === s && !/[\x00-\x1f\x7f]/.test(s)),
  description: z.string().max(4096).optional(),
  workflows: z.union([z.string(), z.array(z.string()).max(PLUGIN_LIMITS.entries)]).optional(),
  themes: themesSchema.optional(),
  experimental: z.object({ themes: themesSchema.optional() }).strict().optional(),
  skills: z.union([z.string(), z.array(z.string()).max(PLUGIN_LIMITS.entries)]).optional(),
  agents: z.union([z.string(), z.array(z.string()).max(PLUGIN_LIMITS.entries)]).optional(),
  commands: z.union([z.string(), z.array(z.string()).max(PLUGIN_LIMITS.entries),
    z.record(z.object({ source: z.string().optional(), content: z.string().optional(),
      description: z.string().optional(), argumentHint: z.string().optional(), model: z.string().optional(),
      allowedTools: z.array(z.string()).optional() }).passthrough())]).optional(),
  hooks: z.string().min(1).max(1024).refine(s => {
    try { relativePath(s); return true; } catch { return false; }
  }, "hooks must be a relative JSON file path").optional(),
  mcpServers: z.string().min(1).max(1024).refine(s => {
    try { relativePath(s); return true; } catch { return false; }
  }, "mcpServers must be a relative JSON file path").optional(),
}).strict();
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export const pluginEnabledMapSchema = z.record(nameSchema, z.boolean()).refine(value =>
  Object.keys(value).length <= PLUGIN_LIMITS.entries, 'Plugin enable map exceeds entry cap');
export const pluginConfigSchema = z.object({
  enabled: z.boolean().default(false),
  enabledPlugins: pluginEnabledMapSchema.optional(),
  maxFiles: z.number().int().min(1).max(PLUGIN_LIMITS.files).default(PLUGIN_LIMITS.files),
  maxBytes: z.number().int().min(1).max(PLUGIN_LIMITS.bytes).default(PLUGIN_LIMITS.bytes),
  maxFileBytes: z.number().int().min(1).max(PLUGIN_LIMITS.fileBytes).default(PLUGIN_LIMITS.fileBytes),
  maxPlugins: z.number().int().min(1).max(PLUGIN_LIMITS.plugins).default(PLUGIN_LIMITS.plugins),
}).strict();
export type PluginConfig = z.input<typeof pluginConfigSchema>;
type Options = z.output<typeof pluginConfigSchema>;
/** mIt/Clt, nrk8z90j [10632,11384), UTF-16; installed local copies default on. */
export function pluginEnabled(name: string, config?: PluginConfig): boolean {
  return config?.enabled === true && config.enabledPlugins?.[name] !== false;
}
const recordSchema = z.object({
  manifest: pluginManifestSchema, digest: digestSchema,
  files: z.number().int().min(1).max(PLUGIN_LIMITS.files),
  bytes: z.number().int().min(1).max(PLUGIN_LIMITS.bytes),
}).strict();
export type InstalledPlugin = z.infer<typeof recordSchema>;
const indexSchema = z.object({
  version: z.literal(1), digest: digestSchema,
  plugins: z.array(recordSchema).max(PLUGIN_LIMITS.plugins),
}).strict();
type Index = z.infer<typeof indexSchema>;
type Entry = { path: string; kind: "directory" | "file"; mode: number; size?: number; sha256?: string };
type Snapshot = InstalledPlugin & { entries: Entry[]; contents: Map<string, Buffer> };
export interface PluginThemePaths {
  name: string;
  themesPath?: string;
  themesPaths?: string[];
}
export interface InstalledPluginComponents {
  plugin: InstalledPlugin;
  directory: string;
  skillDirectory?: string;
  agentDirectory?: string;
  skillDirectories: string[];
  agentPaths: string[];
  commandSources: PluginCommandSource[];
  componentProblems: PluginComponentProblem[];
  componentFiles: ReadonlyMap<string, Buffer>;
  componentEntries: readonly { path: string; kind: 'directory' | 'file' }[];
  workflowsPath?: string;
  workflowsPaths?: string[];
  workflowProblems: { type: 'path-traversal' | 'path-not-found'; path: string; component: 'workflows' }[];
  themePaths?: PluginThemePaths;
  hooks?: HooksConfig;
  /** Persisted MCP schema: stdio command/args or HTTP URL/header env references. */
  mcpServers?: z.infer<typeof mcpServersSchema>;
  /** The plugin's chain hooks module: the one entry its hooks file names in `modules`, relative to the
   *  plugin folder. Source `aUr` (chunk-sfn1dbxq.js [4056182,4056874)) sets `plugin.modulePath` from
   *  exactly one such entry — zero leaves it unset, two load neither. */
  hooksModulePath?: string;
  /** Why a named module is not loaded, in the source's own diagnostic shapes. The plugin still loads;
   *  the source pushes these into its error list rather than failing the plugin. */
  hooksModuleProblem?: PluginHooksModuleProblem;
}
export type PluginCommandMetadata = Exclude<PluginManifest['commands'], string | string[] | undefined>[string];
export type PluginCommandSource = { kind: 'path'; path: string; name?: string; metadata?: PluginCommandMetadata }
  | { kind: 'inline'; name: string; content: string; metadata: PluginCommandMetadata };
export interface PluginComponentProblem {
  type: 'path-traversal' | 'path-not-found' | 'component-load-failed' | 'folder-shadowed-by-manifest';
  plugin: string;
  component: 'skills' | 'agents' | 'commands';
  path: string;
  reason?: string;
}
export interface PluginHooksModuleProblem {
  type: "hook-load-failed" | "path-traversal" | "path-not-found";
  path: string;
  reason?: string;
}
const hookFileSchema = z.object({
  hooks: hooksSchema,
  modules: z.array(z.string().min(1).max(1024)).max(PLUGIN_LIMITS.entries).optional(),
}).strict();
const mcpFileSchema = z.object({ mcpServers: mcpServersSchema }).strict();
const MAX_COMPONENT_BYTES = 512 * 1024;
const MAX_COMPONENT_SERVERS = 1024;
type State = { index: Index; bytes?: Buffer };
const LIST = z.object({}).strict();
const INSTALL = z.object({ directory: localPath }).strict();
const UPDATE = z.object({ name: nameSchema, directory: localPath, expected_digest: digestSchema }).strict();
const REMOVE = z.object({ name: nameSchema, expected_digest: digestSchema }).strict();

function hash(value: string | Buffer): string { return crypto.createHash("sha256").update(value).digest("hex"); }
function aborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw Object.assign(new Error("Plugin operation aborted."), { name: "AbortError" });
}
function stat(target: string): fs.Stats | undefined {
  try { return fs.lstatSync(target); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}
function same(a: fs.Stats, b: fs.Stats): boolean {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size
    && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
// Check every component, including explicitly supplied source ancestors.
function directory(target: string, create = false): string {
  const absolute = path.resolve(target);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let info = stat(current);
    if (!info && create) { fs.mkdirSync(current, { mode: 0o700 }); info = fs.lstatSync(current); }
    if (!info || !info.isDirectory() || info.isSymbolicLink()) throw new Error(`Missing, symlink, or invalid plugin directory: ${current}`);
  }
  return absolute;
}
function storeFor(workspace: string, create = false): string | undefined {
  const root = directory(workspace);
  const harness = path.join(root, ".harness");
  if (!stat(harness) && !create) return undefined;
  directory(harness, create);
  const store = path.join(harness, "plugins");
  if (!stat(store) && !create) return undefined;
  return directory(store, create);
}
function read(target: string, cap: number, signal?: AbortSignal): Buffer {
  aborted(signal);
  directory(path.dirname(target));
  const before = fs.lstatSync(target);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > cap) {
    throw new Error(`Plugin file must be regular, unlinked, and within byte cap: ${target}`);
  }
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const initial = fs.fstatSync(fd);
    if (!same(before, initial) || !initial.isFile()) throw new Error(`Plugin file changed during read: ${target}`);
    const bytes = Buffer.alloc(initial.size);
    let offset = 0;
    while (offset < bytes.length) {
      aborted(signal);
      const count = fs.readSync(fd, bytes, offset, Math.min(64 * 1024, bytes.length - offset), offset);
      if (!count) throw new Error(`Plugin file changed during read: ${target}`);
      offset += count;
    }
    const extra = Buffer.alloc(1);
    if (fs.readSync(fd, extra, 0, 1, offset) || !same(initial, fs.fstatSync(fd)) || !same(initial, fs.lstatSync(target))) {
      throw new Error(`Plugin file changed during read: ${target}`);
    }
    return bytes;
  } finally { fs.closeSync(fd); }
}
function snapshot(root: string, options: Options, signal?: AbortSignal, copy = false): Snapshot {
  directory(root);
  const entries: Entry[] = [{ path: "", kind: "directory", mode: copy ? 0o700 : fs.lstatSync(root).mode & 0o7777 }];
  const contents = new Map<string, Buffer>();
  let files = 0;
  let bytes = 0;
  let manifestBytes: Buffer | undefined;
  const aliases = new Set<string>();
  function visit(relative: string, depth: number): void {
    aborted(signal);
    if (depth > PLUGIN_LIMITS.depth) throw new Error("Plugin directory depth exceeds cap.");
    const full = relative ? path.join(root, relative) : root;
    directory(full);
    const before = fs.lstatSync(full);
    // opendir bounds enumeration itself, including directories with many entries.
    const handle = fs.opendirSync(full);
    const names: string[] = [];
    try {
      let child: fs.Dirent | null;
      while ((child = handle.readSync()) !== null) {
        if (names.length + entries.length >= PLUGIN_LIMITS.entries) throw new Error("Plugin entry count exceeds cap.");
        names.push(child.name);
      }
    } finally { handle.closeSync(); }
    for (const name of names.sort()) {
      const rel = relativePath(relative ? `${relative}/${name}` : name);
      const alias = rel.normalize("NFC").toLowerCase();
      if (aliases.has(alias)) throw new Error(`Plugin path has a case or Unicode alias: ${rel}`);
      aliases.add(alias);
      if (entries.length >= PLUGIN_LIMITS.entries) throw new Error("Plugin entry count exceeds cap.");
      const target = path.join(root, rel);
      const info = fs.lstatSync(target);
      if (info.isSymbolicLink()) throw new Error(`Symlink plugin path: ${rel}`);
      if (info.isDirectory()) {
        entries.push({ path: rel, kind: "directory", mode: copy ? 0o700 : info.mode & 0o7777 });
        visit(rel, depth + 1);
      } else if (info.isFile()) {
        if (++files > options.maxFiles) throw new Error("Plugin file count exceeds cap.");
        const data = read(target, Math.min(options.maxFileBytes, options.maxBytes - bytes,
          rel === "plugin.json" ? PLUGIN_LIMITS.manifestBytes : options.maxFileBytes), signal);
        bytes += data.length;
        if (bytes > options.maxBytes) throw new Error("Plugin total byte cap exceeded.");
        entries.push({ path: rel, kind: "file", mode: copy ? 0o600 : info.mode & 0o7777, size: data.length, sha256: hash(data) });
        if (rel === "plugin.json") manifestBytes = data;
        // Parse declared components from these same observed bytes, never a reread.
        contents.set(rel, data);
      } else throw new Error(`Plugin contains a non-regular entry: ${rel}`);
    }
    if (!same(before, fs.lstatSync(full))) throw new Error(`Plugin directory changed during read: ${full}`);
  }
  visit("", 0);
  if (!manifestBytes) throw new Error("Plugin directory requires a regular plugin.json manifest.");
  const manifest = pluginManifestSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)));
  const themes = manifest.experimental?.themes ?? manifest.themes;
  for (const themePath of themes === undefined ? [] : Array.isArray(themes) ? themes : [themes]) {
    if (!entries.some(entry => entry.path === themePath)) throw new Error("Plugin themes path must name an existing file or directory.");
  }
  entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const result = { manifest, entries, contents, files, bytes, digest: hash(JSON.stringify(entries)) };
  componentConfigs(result, root);
  return result;
}
function componentConfigs(value: Snapshot, root: string): Pick<InstalledPluginComponents, "hooks" | "hooksModulePath" | "hooksModuleProblem" | "mcpServers"> {
  const result: Pick<InstalledPluginComponents, "hooks" | "hooksModulePath" | "hooksModuleProblem" | "mcpServers"> = {};
  for (const field of ["hooks", "mcpServers"] as const) {
    const relative = value.manifest[field];
    if (relative === undefined) continue;
    const bytes = value.contents.get(relative);
    if (!relative.endsWith(".json") || !bytes || bytes.length > MAX_COMPONENT_BYTES) {
      throw new Error(`Plugin ${field} path must name an existing JSON file within ${MAX_COMPONENT_BYTES} bytes.`);
    }
    const json: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (field === "hooks") {
      const parsed = hookFileSchema.parse(json);
      result.hooks = parsed.hooks;
      if (parsed.modules !== undefined && parsed.modules.length > 0) {
        Object.assign(result, hookModuleFor(value.manifest.name, root, relative, parsed.modules, value.contents));
      }
    } else {
      const servers = mcpFileSchema.parse(json).mcpServers;
      if (Object.keys(servers).length > MAX_COMPONENT_SERVERS) throw new Error("Plugin MCP server count exceeds cap.");
      result.mcpServers = Object.fromEntries(Object.entries(servers).map(([name, config]) => {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(name)) throw new Error(`Invalid plugin MCP server name: ${JSON.stringify(name)}`);
        return [`${value.manifest.name}/${name}`, config];
      }));
    }
  }
  return result;
}

/** The chain hooks module one plugin's hooks file names, per the source's `aUr`
 *  (chunk-sfn1dbxq.js [4056182,4056874)): the entries of its `modules` array, at most one of which
 *  loads. The specifier resolves against the folder the hooks file sits in — the source's
 *  `Fd(PS(pluginPath, hooksFilePath), spec)` — and must stay inside the plugin folder; the source's
 *  own two diagnostics and its "one module per plugin" refusal are reported with its own words, and
 *  the plugin still loads, exactly as the source leaves it.
 *
 *  Confinement here is lexical, not `Dz`'s realpath: a verified snapshot holds no symlinks, so there
 *  is no link for a specifier to leave through. */
function hookModuleFor(name: string, root: string, hooksFile: string, modules: readonly string[], contents: Map<string, Buffer>): Pick<InstalledPluginComponents, "hooksModulePath" | "hooksModuleProblem"> {
  const hooksFilePath = path.join(root, hooksFile);
  if (modules.length > 1) {
    return { hooksModuleProblem: { type: "hook-load-failed", path: hooksFilePath,
      reason: `Plugin ${name} names one hooks module per plugin, but ${modules.map(() => hooksFilePath).join(" and ")} each name one in \`modules\`; neither is loaded` } };
  }
  const spec = modules[0]!;
  const folder = path.posix.dirname(hooksFile);
  const candidate = path.posix.normalize(path.posix.join(folder === "." ? "" : folder, spec));
  if (path.posix.isAbsolute(spec) || candidate === ".." || candidate.startsWith("../")) {
    return { hooksModuleProblem: { type: "path-traversal", path: spec } };
  }
  if (!contents.has(candidate)) return { hooksModuleProblem: { type: "path-not-found", path: path.join(root, candidate) } };
  return { hooksModulePath: path.join(root, candidate) };
}
function themePaths(value: Snapshot, root: string): PluginThemePaths | undefined {
  const declared = value.manifest.experimental?.themes ?? value.manifest.themes;
  if (declared !== undefined) {
    const paths = (Array.isArray(declared) ? declared : [declared]).map(relative => path.join(root, relative));
    return { name: value.manifest.name, themesPaths: paths };
  }
  return value.entries.some(entry => entry.path === "themes" && entry.kind === "directory")
    ? { name: value.manifest.name, themesPath: path.join(root, "themes") } : undefined;
}
/** wne/zR, chunk-sfn1dbxq.js [4062560,4070285)/[4057935,4059181) UTF-16. */
function workflowPaths(value: Snapshot, root: string): Pick<InstalledPluginComponents, 'workflowsPath' | 'workflowsPaths' | 'workflowProblems'> {
  const workflowProblems: InstalledPluginComponents['workflowProblems'] = [];
  const declared = value.manifest.workflows;
  if (declared !== undefined) {
    const paths: string[] = [];
    for (const relative of Array.isArray(declared) ? declared : [declared]) {
      const full = path.resolve(root, relative);
      const local = path.relative(root, full);
      if (local === '..' || local.startsWith(`..${path.sep}`) || path.isAbsolute(local)) {
        workflowProblems.push({ type: 'path-traversal', path: relative, component: 'workflows' });
      } else if (!value.entries.some(entry => entry.path === local)) {
        workflowProblems.push({ type: 'path-not-found', path: full, component: 'workflows' });
      } else paths.push(full);
    }
    return { ...(paths.length ? { workflowsPaths: paths } : {}), workflowProblems };
  }
  return value.entries.some(entry => entry.path === 'workflows')
    ? { workflowsPath: path.join(root, 'workflows'), workflowProblems } : { workflowProblems };
}
/** Adapted wne/zR/OEn/lEn, chunk-sfn1dbxq.js [4057817,4070285), UTF-16. */
function localComponentPaths(value: Snapshot, root: string): Pick<InstalledPluginComponents,
  'skillDirectory' | 'agentDirectory' | 'skillDirectories' | 'agentPaths' | 'commandSources' | 'componentProblems'> {
  const componentProblems: PluginComponentProblem[] = [];
  const name = value.manifest.name;
  const resolve = (relative: string, component: PluginComponentProblem['component'], directoryOnly = false): string | undefined => {
    const full = path.resolve(root, relative);
    const local = path.relative(root, full);
    if (path.isAbsolute(relative) || /[\\\x00-\x1f]/.test(relative) || local === '..' || local.startsWith(`..${path.sep}`) || path.isAbsolute(local)) {
      componentProblems.push({ type: 'path-traversal', plugin: name, component, path: relative });
      return;
    }
    const entry = value.entries.find(entry => entry.path === local);
    if (!entry) {
      componentProblems.push({ type: 'path-not-found', plugin: name, component, path: full });
      return;
    }
    if (directoryOnly && entry.kind !== 'directory') {
      componentProblems.push({ type: 'component-load-failed', plugin: name, component, path: relative,
        reason: 'skills entries must be directories containing SKILL.md; point to the parent directory' });
      return;
    }
    return full;
  };
  const has = (relative: string) => value.entries.some(entry => entry.path === relative);
  const skillDirectories: string[] = has('skills') ? [path.join(root, 'skills')] : [];
  const declaredSkills = value.manifest.skills;
  if (declaredSkills !== undefined) {
    for (const relative of typeof declaredSkills === 'string' ? [declaredSkills] : declaredSkills) {
      const full = resolve(relative, 'skills', true);
      if (full && !skillDirectories.includes(full)) skillDirectories.push(full);
    }
  } else if (!skillDirectories.length && has('SKILL.md')) skillDirectories.push(root);
  const agentPaths: string[] = [];
  const commandSources: PluginCommandSource[] = [];
  for (const component of ['agents', 'commands'] as const) {
    const declared = value.manifest[component];
    const paths: string[] = [];
    if (!declared && has(component)) paths.push(path.join(root, component));
    else if (typeof declared === 'string' || Array.isArray(declared)) {
      for (const relative of typeof declared === 'string' ? [declared] : declared) {
        const full = resolve(relative, component);
        if (full) paths.push(full);
      }
    } else if (component === 'commands' && declared) {
      for (const [commandName, metadata] of Object.entries(declared)) {
        if (metadata.source) {
          const full = resolve(metadata.source, component);
          if (full) { paths.push(full); commandSources.push({ kind: 'path', path: full, name: commandName, metadata }); }
        } else if (metadata.content) commandSources.push({ kind: 'inline', name: commandName, content: metadata.content, metadata });
      }
    }
    const defaultPath = path.join(root, component);
    if (declared && has(component) && !paths.some(full => full === defaultPath || full.startsWith(defaultPath + path.sep))) {
      componentProblems.push({ type: 'folder-shadowed-by-manifest', plugin: name, component, path: defaultPath });
    }
    if (component === 'agents') agentPaths.push(...paths);
    else for (const full of paths) if (!commandSources.some(source => source.kind === 'path' && source.path === full)) commandSources.push({ kind: 'path', path: full });
  }
  return { skillDirectories, agentPaths, commandSources, componentProblems,
    ...(skillDirectories[0] ? { skillDirectory: skillDirectories[0] } : {}),
    ...(agentPaths[0] ? { agentDirectory: agentPaths[0] } : {}) };
}
function record(value: Snapshot): InstalledPlugin {
  return { manifest: value.manifest, digest: value.digest, files: value.files, bytes: value.bytes };
}
function makeIndex(plugins: InstalledPlugin[]): Index {
  const sorted = [...plugins].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name, "en"));
  return { version: 1, digest: hash(JSON.stringify(sorted)), plugins: sorted };
}
function load(store: string, options: Options, signal?: AbortSignal): State {
  const target = path.join(store, ".index.json");
  if (!stat(target)) return { index: makeIndex([]) };
  const bytes = read(target, PLUGIN_LIMITS.indexBytes, signal);
  const index = indexSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (index.plugins.length > options.maxPlugins || index.digest !== hash(JSON.stringify(index.plugins))) throw new Error("Plugin index digest or count mismatch.");
  const names = index.plugins.map(p => p.manifest.name);
  if (new Set(names).size !== names.length || JSON.stringify(index) !== JSON.stringify(makeIndex(index.plugins))) throw new Error("Plugin index contains duplicate or unsorted records.");
  return { index, bytes };
}
function verifyInstalled(store: string, item: InstalledPlugin, options: Options, signal?: AbortSignal): Snapshot {
  const current = snapshot(path.join(store, item.manifest.name), options, signal);
  if (JSON.stringify(record(current)) !== JSON.stringify(item)) throw new Error(`Installed plugin changed: ${item.manifest.name}`);
  return current;
}
function verifyState(store: string, state: State, options: Options, signal?: AbortSignal): void {
  const current = load(store, options, signal);
  if (current.bytes?.toString("hex") !== state.bytes?.toString("hex")) throw new Error("Plugin index changed during operation.");
  for (const item of state.index.plugins) verifyInstalled(store, item, options, signal);
}
function syncDir(target: string): void {
  const fd = fs.openSync(target, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function write(target: string, bytes: Buffer): void {
  const fd = fs.openSync(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function locked<T>(store: string, operation: () => T): T {
  directory(store);
  const target = path.join(store, ".lock");
  const fd = fs.openSync(target, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  const identity = fs.fstatSync(fd);
  try { fs.writeFileSync(fd, `${process.pid}\n`); fs.fsyncSync(fd); return operation(); }
  finally {
    fs.closeSync(fd);
    const current = stat(target);
    if (current?.dev === identity.dev && current.ino === identity.ino) fs.unlinkSync(target);
  }
}
function assertNoPending(store: string): void {
  const handle = fs.opendirSync(store);
  let count = 0;
  try {
    let item: fs.Dirent | null;
    while ((item = handle.readSync()) !== null) {
      if (++count > PLUGIN_LIMITS.entries) throw new Error("Plugin store entry count exceeds cap.");
      if (item.name.startsWith(".transaction-")) throw new Error("Plugin store has a pending transaction; preserve it for recovery.");
    }
  } finally { handle.closeSync(); }
}
function encode(value: unknown, context: ToolContext): string {
  const text = JSON.stringify(value);
  const cap = Number.isFinite(context.maxOutputBytes) && context.maxOutputBytes > 0 ? Math.floor(context.maxOutputBytes) : 100_000;
  if (Buffer.byteLength(text) > cap) throw new Error("Plugin result exceeds output byte cap.");
  return text;
}
function localSource(workspace: string, source: string, store: string): string {
  const full = directory(path.resolve(workspace, source));
  const inside = (a: string, b: string) => a === b || b.startsWith(`${a}${path.sep}`);
  if (inside(full, store) || inside(store, full)) throw new Error("Plugin source and working store must be separate directories.");
  return full;
}
// The index rename is the commit point. Before that point, restore the original
// tree on failure. Interrupted transactions are retained and fail closed.
function transact(store: string, state: State, next: Index, name: string, source: Snapshot | undefined,
  options: Options, signal: AbortSignal): void {
  const transaction = fs.mkdtempSync(path.join(store, ".transaction-"));
  const staged = path.join(transaction, "new");
  const backup = path.join(transaction, "old");
  const target = path.join(store, name);
  let movedOld = false;
  let movedNew = false;
  let committed = false;
  let preserve = false;
  try {
    write(path.join(transaction, "previous-index.json"), state.bytes ?? Buffer.from(JSON.stringify(state.index)));
    const nextBytes = Buffer.from(JSON.stringify(next));
    if (nextBytes.length > PLUGIN_LIMITS.indexBytes) throw new Error("Plugin index exceeds byte cap.");
    const nextPath = path.join(transaction, "next-index.json");
    write(nextPath, nextBytes);
    if (source) {
      fs.mkdirSync(staged, { mode: 0o700 });
      for (const item of source.entries) {
        aborted(signal);
        if (!item.path) continue;
        const destination = path.join(staged, item.path);
        if (item.kind === "directory") fs.mkdirSync(destination, { mode: 0o700 });
        else write(destination, source.contents.get(item.path)!);
      }
      for (const item of [...source.entries].reverse()) if (item.kind === "directory") syncDir(path.join(staged, item.path));
      if (snapshot(staged, options, signal).digest !== source.digest) throw new Error("Staged plugin digest mismatch.");
    }
    verifyState(store, state, options, signal);
    aborted(signal);
    if (state.index.plugins.some(p => p.manifest.name === name)) {
      fs.renameSync(target, backup);
      movedOld = true;
      const previous = state.index.plugins.find(p => p.manifest.name === name)!;
      if (snapshot(backup, options, signal).digest !== previous.digest) throw new Error("Plugin changed while staging replacement.");
    } else if (stat(target)) throw new Error("Plugin destination already exists outside the index.");
    if (source) { fs.renameSync(staged, target); movedNew = true; }
    syncDir(store);
    // Recheck unrelated installed trees and index immediately before commit.
    const fresh = load(store, options, signal);
    if (fresh.bytes?.toString("hex") !== state.bytes?.toString("hex")) throw new Error("Plugin index changed before commit.");
    for (const item of state.index.plugins) if (item.manifest.name !== name) verifyInstalled(store, item, options, signal);
    if (source && snapshot(target, options, signal).digest !== source.digest) throw new Error("Installed plugin changed before commit.");
    aborted(signal);
    fs.renameSync(nextPath, path.join(store, ".index.json"));
    committed = true;
    syncDir(store);
  } catch (error) {
    if (!committed) {
      try {
        if (movedNew) {
          // Preserve third-party changes rather than deleting them during rollback.
          if (snapshot(target, options).digest !== source!.digest) throw new Error("Replacement changed during rollback.");
          fs.renameSync(target, staged);
        }
        if (movedOld) {
          if (stat(target)) throw new Error("Rollback destination occupied.");
          fs.renameSync(backup, target);
        }
        syncDir(store);
      } catch (rollbackError) {
        preserve = true;
        throw new AggregateError([error, rollbackError], `Plugin rollback requires recovery in ${transaction}`);
      }
    } else preserve = true;
    throw error;
  } finally {
    if (!preserve) fs.rmSync(transaction, { recursive: true, force: true });
  }
}

/** Read-only helper for the parent config loader. Skills are directory catalogs
 * of direct child SKILL.md folders, matching settings.pluginDirs. */
export function discoverInstalledSkillDirectories(workspace: string, config?: PluginConfig): string[] {
  return discoverInstalledPluginComponents(workspace, config).flatMap(item => item.skillDirectory ? [item.skillDirectory] : []);
}

/** One index record with its live state, for `/plugin`'s list. `plugin_list` reports the same
 *  record and digest check; this reader takes the store lock once and returns the rows instead
 *  of the tool's JSON envelope, so the panel never re-verifies per row. */
export interface PluginStoreEntry {
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly digest: string;
  readonly files: number;
  readonly bytes: number;
  readonly directory: string;
  readonly modified: boolean;
}

export interface PluginStoreSnapshot {
  /** Whether `plugins.enabled` opens the store at all. */
  readonly enabled: boolean;
  /** The index digest, or `disabled`/the empty-index digest when there is no store. */
  readonly identity: string;
  readonly entries: readonly PluginStoreEntry[];
}

export function readPluginStore(workspace: string, config?: PluginConfig): PluginStoreSnapshot {
  const options = pluginConfigSchema.parse(config ?? {});
  const store = storeFor(workspace);
  if (!store) return { enabled: options.enabled, identity: makeIndex([]).digest, entries: [] };
  return locked(store, () => {
    assertNoPending(store);
    const state = load(store, options);
    const entries = state.index.plugins.map(item => {
      const current = snapshot(path.join(store, item.manifest.name), options);
      return { name: item.manifest.name, version: item.manifest.version, description: item.manifest.description,
        enabled: pluginEnabled(item.manifest.name, options), digest: item.digest,
        files: item.files, bytes: item.bytes, directory: path.join(store, item.manifest.name),
        modified: JSON.stringify(record(current)) !== JSON.stringify(item) };
    });
    return { enabled: options.enabled, identity: options.enabled ? state.index.digest : 'disabled', entries };
  });
}

/** Explicit, inert discovery of declared components in verified installed snapshots. */
export function installedPluginCatalogIdentity(workspace: string, config?: PluginConfig): string {
  const options = pluginConfigSchema.parse(config ?? {});
  if (!options.enabled) return 'disabled';
  const store = storeFor(workspace);
  if (!store) return makeIndex([]).digest;
  return locked(store, () => {
    assertNoPending(store);
    const state = load(store, options);
    const disabled = state.index.plugins.filter(item => !pluginEnabled(item.manifest.name, options)).map(item => item.manifest.name);
    return disabled.length === 0 ? state.index.digest : hash(JSON.stringify({ index: state.index.digest, disabled }));
  });
}

/** Explicit, inert discovery of declared components in verified installed snapshots. */
export function discoverInstalledPluginComponents(workspace: string, config?: PluginConfig): InstalledPluginComponents[] {
  const options = pluginConfigSchema.parse(config ?? {});
  if (!options.enabled) return [];
  const store = storeFor(workspace);
  if (!store) return [];
  return locked(store, () => {
    assertNoPending(store);
    const state = load(store, options);
    const components = state.index.plugins.filter(item => pluginEnabled(item.manifest.name, options)).map(item => {
      const current = verifyInstalled(store, item, options);
      const root = path.join(store, item.manifest.name);
      return {
        plugin: record(current), directory: root, componentFiles: current.contents, componentEntries: current.entries,
        ...localComponentPaths(current, root),
        ...workflowPaths(current, root),
        ...(themePaths(current, root) ? { themePaths: themePaths(current, root) } : {}),
        ...componentConfigs(current, root),
      };
    });
    const mergedHooks: Record<string, unknown[]> = {};
    let serverCount = 0;
    for (const item of components) {
      for (const [event, entries] of Object.entries(item.hooks ?? {})) {
        mergedHooks[event] = [...(mergedHooks[event] ?? []), ...entries];
      }
      serverCount += Object.keys(item.mcpServers ?? {}).length;
      if (serverCount > MAX_COMPONENT_SERVERS) throw new Error("Installed plugin MCP server count exceeds cap.");
    }
    hooksSchema.parse(mergedHooks);
    verifyState(store, state, options);
    return components;
  });
}

/** Opt-in factory; omitted or disabled configuration exposes no plugin tools. */
export function createPluginTools(config?: PluginConfig): ToolDefinition[] {
  const options = pluginConfigSchema.parse(config ?? {});
  if (!options.enabled) return [];
  const tool = (name: string, description: string, properties: Record<string, unknown>, required: string[], readOnly: boolean,
    execute: (raw: unknown, context: ToolContext) => string | Promise<string>): ToolDefinition => ({
    schema: { name, description, input_schema: { type: "object", additionalProperties: false, properties, required } },
    readOnly, async execute(raw, context) { aborted(context.signal); return await execute(raw, context); },
  });
  const nameProperty = { type: "string", pattern: "^[a-z][a-z0-9_-]*$", maxLength: 64 };
  const sourceProperty = { type: "string", minLength: 1, maxLength: 4096, description: "Explicit local source directory, absolute or relative to the workspace." };
  const expectedProperty = { type: "string", pattern: "^[a-f0-9]{64}$", description: "Installed digest returned by plugin_list or plugin_install; edits invalidate it." };
  function mutate(raw: unknown, context: ToolContext, operation: "install" | "update" | "remove"): string {
    const input = operation === "install" ? INSTALL.parse(raw) : operation === "update" ? UPDATE.parse(raw) : REMOVE.parse(raw);
    const workspace = directory(context.workspace);
    const store = storeFor(workspace, true)!;
    return locked(store, () => {
      assertNoPending(store);
      const state = load(store, options, context.signal);
      verifyState(store, state, options, context.signal);
      const source = "directory" in input ? snapshot(localSource(workspace, input.directory, store), options, context.signal, true) : undefined;
      const name = "name" in input ? input.name : source!.manifest.name;
      if (source && source.manifest.name !== name) throw new Error("Replacement manifest name must match the installed plugin.");
      const previous = state.index.plugins.find(p => p.manifest.name === name);
      if (operation === "install") {
        if (previous || stat(path.join(store, name))) throw new Error("Plugin already installed or destination occupied.");
        if (state.index.plugins.length >= options.maxPlugins) throw new Error("Installed plugin count exceeds cap.");
      } else {
        if (!previous) throw new Error("Plugin is missing from the installed index.");
        if (!("expected_digest" in input) || input.expected_digest !== previous.digest) throw new Error("Stale expected_digest for installed plugin.");
      }
      const item = source ? record(source) : previous!;
      const next = makeIndex([...state.index.plugins.filter(p => p.manifest.name !== name), ...(source ? [item] : [])]);
      const result = encode({ status: operation === "remove" ? "removed" : operation === "update" ? "updated" : "installed",
        plugin: item, directory: path.join(store, name), index_digest: next.digest }, context);
      transact(store, state, next, name, source, options, context.signal);
      return result;
    });
  }
  /** Hands the chain the store's declaration list after a change, and waits for it. The source loads a
   *  plugin's module inside the install itself (`Re = await tGe(n, z)`, chunk-sfn1dbxq.js
   *  [2392440,2392465)) and its removal reconciler `CVo` ([2394700,2395092)) unloads what left with
   *  "plugin disabled or uninstalled"; waiting here is what makes an install leave the module loaded
   *  instead of the next config read finishing it. The chain is imported dynamically so a store that
   *  never sees a hooks module never pulls it in. */
  async function reconcileChainHooksModules(workspace: string): Promise<void> {
    const declarations = discoverInstalledPluginComponents(workspace, options).flatMap(item => item.hooksModulePath
      ? [{ name: item.plugin.manifest.name, modulePath: item.hooksModulePath, path: item.directory }] : []);
    const chain = await import("./plugin-chain-registry.js");
    await chain.adoptPluginHooksModules(declarations);
  }
  const mutateTool = (operation: "install" | "update" | "remove") => async (raw: unknown, context: ToolContext): Promise<string> => {
    const result = mutate(raw, context, operation);
    await reconcileChainHooksModules(directory(context.workspace));
    return result;
  };
  return [
    tool("plugin_list", "List this workspace's independent local plugin index with content digests and modification status.", {}, [], true, (raw, context) => {
      LIST.parse(raw);
      const store = storeFor(context.workspace);
      if (!store) return encode({ plugins: [], total: 0, index_digest: makeIndex([]).digest }, context);
      return locked(store, () => {
        assertNoPending(store);
        const state = load(store, options, context.signal);
        const plugins = state.index.plugins.map(item => {
          const current = snapshot(path.join(store, item.manifest.name), options, context.signal);
          return { ...item, enabled: pluginEnabled(item.manifest.name, options), directory: path.join(store, item.manifest.name), current_digest: current.digest,
            modified: JSON.stringify(record(current)) !== JSON.stringify(item) };
        });
        return encode({ plugins, total: plugins.length, index_digest: state.index.digest }, context);
      });
    }),
    tool("plugin_install", "Install an inert copy of an explicitly supplied local directory containing plugin.json. No download or execution.",
      { directory: sourceProperty }, ["directory"], false, mutateTool("install")),
    tool("plugin_update", "Replace an installed local plugin from an explicit local directory, requiring its unchanged installed digest.",
      { name: nameProperty, directory: sourceProperty, expected_digest: expectedProperty }, ["name", "directory", "expected_digest"], false,
      mutateTool("update")),
    tool("plugin_remove", "Remove an indexed local plugin only when its installed digest and content still match.",
      { name: nameProperty, expected_digest: expectedProperty }, ["name", "expected_digest"], false,
      mutateTool("remove")),
  ];
}
