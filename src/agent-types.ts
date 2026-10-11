// Independent harness agent definitions; all source directories are explicit.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ConfigError, parseFrontmatter, readBoundedBytes } from "./config.js";

export const AGENT_TYPE_LIMITS = Object.freeze({
  fileBytes: 2 * 1024 * 1024,
  totalBytes: 8 * 1024 * 1024,
  dirEntries: 2048,
  directories: 2048,
});

export interface AgentTypeInfo {
  name: string;
  description: string;
  aliases?: string[];
  /** Original Markdown body, pinned when the catalog is loaded. */
  body: string;
  /** Canonical absolute path of the definition that supplied the body. */
  path: string;
  mode: "explore" | "general";
  tools?: string[];
  /** Includes literal "inherit"; model selection belongs to the runtime. */
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTurns?: number;
  isolation?: "worktree";
}

const nonempty = z.string().trim().min(1);
const definitionSchema = z.object({
  name: nonempty.max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  description: nonempty,
  aliases: z.array(nonempty.max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)).max(32).refine(names => new Set(names).size === names.length && names.every(name => !["fork", "explore", "general"].includes(name.toLowerCase()))).optional(),
  mode: z.enum(["explore", "general"]).default("general"),
  tools: z.array(nonempty).max(AGENT_TYPE_LIMITS.dirEntries).optional(),
  model: nonempty.optional(),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  maxTurns: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  isolation: z.literal("worktree").optional(),
}).strict();

export const agentTypeSchema = definitionSchema.extend({
  body: z.string(),
  path: nonempty.refine(value => path.isAbsolute(value), "path must be absolute"),
});
export const agentTypesSchema = z.array(agentTypeSchema).max(AGENT_TYPE_LIMITS.dirEntries);

export type AgentTypeSource = "project" | "user" | "plugin";
export interface AgentTypeLoadReport {
  path: string;
  source: AgentTypeSource;
  status: "loaded" | "invalid" | "reserved" | "shadowed" | "duplicate" | "missing";
  message: string;
  name?: string;
  winnerPath?: string;
}

export interface LoadAgentTypesOptions {
  /** Explicit agents directories, e.g. workspace/.harness/agents. */
  projectDir?: string;
  userDir?: string;
  /** Ordered agents directories; the first plugin wins among plugins. */
  pluginDirs?: readonly string[];
  /** Remaining bytes from the caller shared config budget; capped at 8 MiB. */
  remainingBudget?: number;
}

export interface LoadedAgentTypes {
  agentTypes: AgentTypeInfo[];
  reports: AgentTypeLoadReport[];
  /** Original bytes read once per realpath, including invalid/shadowed files. */
  bytes: number;
}

const RESERVED_NAMES = new Set(["fork", "explore", "general"]);
function isWithin(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

/** Hard read/directory bounds raise ConfigError; invalid definitions are reported.
 * Only direct Markdown files are scanned. No imports or commands are executed. */
export function loadAgentTypes(options: LoadAgentTypesOptions = {}): LoadedAgentTypes {
  const requested = options.remainingBudget ?? AGENT_TYPE_LIMITS.totalBytes;
  if (!Number.isSafeInteger(requested) || requested < 0) {
    throw new ConfigError("agent remainingBudget must be a non-negative safe integer");
  }
  if (options.pluginDirs !== undefined && !Array.isArray(options.pluginDirs)) {
    throw new ConfigError("agent pluginDirs must be an array of explicit directory paths");
  }
  const directories: { path: string; source: AgentTypeSource; real?: string }[] = [
    ...(options.projectDir === undefined ? [] : [{ path: options.projectDir, source: "project" as const }]),
    ...(options.userDir === undefined ? [] : [{ path: options.userDir, source: "user" as const }]),
    ...(options.pluginDirs ?? []).map(dir => ({ path: dir, source: "plugin" as const })),
  ];
  if (directories.length > AGENT_TYPE_LIMITS.directories) throw new ConfigError("agent directories exceed count limit");
  const result: LoadedAgentTypes = { agentTypes: [], reports: [], bytes: 0 };
  const budget = Math.min(requested, AGENT_TYPE_LIMITS.totalBytes);
  for (const dir of directories) {
    if (typeof dir.path !== "string" || dir.path.trim() === "" || !path.isAbsolute(dir.path)) {
      throw new ConfigError("agent directories must be explicit absolute paths");
    }
    try {
      dir.real = fs.realpathSync(dir.path);
      if (!fs.statSync(dir.real).isDirectory()) throw new ConfigError("agent path is not a directory", dir.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        dir.real = undefined;
        result.reports.push({ path: dir.path, source: dir.source, status: "missing", message: "agents directory is absent" });
      } else if (error instanceof ConfigError) throw error;
      else throw new ConfigError("cannot inspect agents directory", dir.path, { cause: error });
    }
  }
  const roots = directories.flatMap(dir => dir.real === undefined ? [] : [dir.real]);
  const seenDirectories = new Set<string>();
  const seenFiles = new Set<string>();
  const catalog = new Map<string, AgentTypeInfo>();
  for (const dir of directories) {
    if (dir.real === undefined) continue;
    if (seenDirectories.has(dir.real)) {
      result.reports.push({ path: dir.path, source: dir.source, status: "duplicate", message: "agents directory realpath already scanned" });
      continue;
    }
    seenDirectories.add(dir.real);
    const entries: fs.Dirent[] = [];
    let handle: fs.Dir | undefined;
    try {
      handle = fs.opendirSync(dir.real);
      let entry: fs.Dirent | null;
      while ((entry = handle.readSync()) !== null) {
        if (entries.length === AGENT_TYPE_LIMITS.dirEntries) throw new ConfigError("agents directory exceeds entry limit", dir.path);
        entries.push(entry);
      }
    } catch (error) {
      if (error instanceof ConfigError) throw error;
      throw new ConfigError("cannot read agents directory", dir.path, { cause: error });
    } finally {
      handle?.closeSync();
    }
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (!entry.name.endsWith(".md") || entry.isDirectory()) continue;
      const file = path.join(dir.real, entry.name);
      let real: string;
      try { real = fs.realpathSync(file); }
      catch (error) { throw new ConfigError("cannot resolve agent definition", file, { cause: error }); }
      if (!roots.some(root => isWithin(root, real))) {
        result.reports.push({ path: file, source: dir.source, status: "invalid", message: "definition realpath escapes the supplied agents directories" });
        continue;
      }
      if (seenFiles.has(real)) {
        result.reports.push({ path: file, source: dir.source, status: "duplicate", message: "definition realpath already read", winnerPath: real });
        continue;
      }
      seenFiles.add(real);
      let stat: fs.Stats;
      try { stat = fs.statSync(real); }
      catch (error) { throw new ConfigError("cannot inspect agent definition", real, { cause: error }); }
      if (stat.isDirectory()) continue;
      if (stat.size > AGENT_TYPE_LIMITS.fileBytes) throw new ConfigError("agent definition exceeds per-file byte limit", real);
      const read = readBoundedBytes(real, Math.min(AGENT_TYPE_LIMITS.fileBytes, budget - result.bytes));
      if (read.overflow) throw new ConfigError("agent definitions exceed byte budget or per-file limit", real);
      result.bytes += read.bytes;
      const frontmatter = parseFrontmatter(read.buffer.toString("utf8"), { full: true });
      if (frontmatter.limitations.length) {
        result.reports.push({ path: real, source: dir.source, status: "invalid", message: frontmatter.limitations.join("; ") });
        continue;
      }
      const data = { ...frontmatter.data };
      if (typeof data.tools === "string") data.tools = data.tools.split(",").map(tool => tool.trim());
      if (typeof data.aliases === "string") data.aliases = data.aliases.split(/\s+/).filter(Boolean);
      const parsed = definitionSchema.safeParse(data);
      if (!parsed.success) {
        result.reports.push({ path: real, source: dir.source, status: "invalid", message: parsed.error.message });
        continue;
      }
      const name = parsed.data.name;
      if (RESERVED_NAMES.has(name.toLowerCase())) {
        result.reports.push({ path: real, source: dir.source, name, status: "reserved", message: `agent name ${name} is reserved by the runtime` });
        continue;
      }
      const winner = catalog.get(name);
      if (winner) {
        result.reports.push({ path: real, source: dir.source, name, status: "shadowed", winnerPath: winner.path, message: "higher-precedence or earlier definition wins" });
        continue;
      }
      if (catalog.size === AGENT_TYPE_LIMITS.dirEntries) throw new ConfigError("agent catalog exceeds entry limit", real);
      const agent: AgentTypeInfo = { ...parsed.data, path: real, body: frontmatter.body };
      if (agent.tools !== undefined) agent.tools = [...new Set(agent.tools)];
      catalog.set(name, agent);
      result.reports.push({ path: real, source: dir.source, name, status: "loaded", message: "agent definition loaded and body pinned" });
    }
  }
  result.agentTypes = [...catalog.values()];
  return result;
}
