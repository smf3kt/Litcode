// Project configuration foundation for the independent personal harness.
//
// This module reads only harness configuration and authored content.
// Verified configuration contracts map onto harness file names:
//
//   settings precedence   user -> project -> local -> explicit flag (last wins)
//   instructions          HARNESS.md + AGENTS.md, bounded at home or a git root;
//                         Markdown imports and optionally path-selected rules
//   skills                direct SKILL.md subdirectories, with source precedence
//                         project > user > installed > configured plugin dirs
//   agent types           project .harness/agents > user agents catalogs
//   memories              local .harness/memory/*.md catalog, loaded separately
//
// Every read here is bounded by a single descriptor read that consumes at most
// one byte past the applicable cap, so a file that grows between the size check
// and the read cannot exceed it (file-size, directory-entry and ancestor-depth
// caps). Directory and file identity is de-duplicated by realpath so symlinks
// cannot cause repeated or unbounded traversal. Invalid settings JSON is
// surfaced as a ConfigError instead of being silently dropped.
//
// Config loading parses YAML into bounded JSON data and validates known fields.
// The original scalar parseFrontmatter projection remains available for callers.
// Malformed frontmatter preserves the original source with explicit limitations.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isMap, isSeq, parseDocument } from "yaml";
import { hooksSchema, type HooksConfig } from "./hooks.js";
import { discoverInstalledPluginComponents, pluginConfigSchema, type PluginConfig } from "./plugins.js";
import { mergeSettings } from "./plugin-chain-settings-merge.js";
import { managedSettingsDir } from "./plugin-chain-settings-source.js";
import { mcpServersSchema, type McpServerConfig } from "./mcp.js";
import { loadAgentTypes, type AgentTypeInfo, type AgentTypeLoadReport } from "./agent-types.js";
import { LinkVetError, vetLinkChain } from "./link-vetting.js";
import { managedPolicySchema } from "./session.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InstructionFile {
  /** Absolute path of the instruction file that was read. */
  path: string;
  /** Verbatim UTF-8 contents. */
  content: string;
  /** The file that imported this one, for an `@`-include. */
  parent?: string;
  /** Rule patterns that selected a conditional rule. */
  globs?: string[];
}

/** The identity fields an InstructionsLoaded raise reports; content stays out of session metadata. */
export type InstructionSource = Pick<InstructionFile, "path" | "parent" | "globs">;

export function instructionSources(files: InstructionFile[]): InstructionSource[] {
  return files.map(({ path, parent, globs }) => ({
    path, ...(parent === undefined ? {} : { parent }), ...(globs === undefined ? {} : { globs }),
  }));
}

export interface ConditionalRule extends InstructionFile {
  /** Workspace-relative glob patterns; the source is pinned at config load time. */
  patterns: string[];
  /** Imported instruction sources inherit this rule's patterns and are pinned. */
  imports?: InstructionFile[];
}

export type SkillEffort = "low" | "medium" | "high" | "xhigh" | "max";

/** Settings scope that authorized the directory a skill was read from.
 *  The recovered loader assigns these as the skill's `source` (`mO`,
 *  chunk-sfn1dbxq.js [3384052,3388176); plugin skills carry `plugin` at 962912). */
export type SkillSource = "userSettings" | "projectSettings" | "plugin";

export interface SkillInfo {
  /** Frontmatter `name`, or the skill directory name when it is absent. */
  name: string;
  /** Frontmatter `description`, or an empty string when it is absent. */
  description: string;
  /** Absolute path of the skill's SKILL.md file. */
  path: string;
  /** Markdown body after the frontmatter block, verbatim. */
  body: string;
  /** Settings scope that authorized the directory the skill was read from. */
  source?: SkillSource;
  /** Frontmatter `user-invocable`; defaults to true. */
  userInvocable: boolean;
  /** Frontmatter `disable-model-invocation`; defaults to false. */
  disableModelInvocation: boolean;
  allowedTools?: string[];
  argumentNames?: string[];
  aliases?: string[];
  model?: string;
  effort?: SkillEffort;
  context?: "fork";
  agent?: string;
  background?: boolean;
  hooks?: HooksConfig;
  /** Inert invocation metadata; the loader never executes commands. */
  command?: string;
  shell?: string;
  metadata?: Record<string, unknown>;
  /** Parsing fallback and invocation features that remain unresolved. */
  limitations?: string[];
}

export interface LoadedConfig {
  settings: Record<string, unknown>;
  managedSettings?: Record<string, unknown>;
  /** Origin and diagnostics of the managed policy that was read, when any. */
  managedSettingsReport?: ManagedSettingsReport;
  /** Content roots already verified by installed/local catalog discovery. */
  watchDirectories?: string[];
  instructions: InstructionFile[];
  skills: SkillInfo[];
  /** Local memory documents are cataloged separately from project instructions. */
  memories?: InstructionFile[];
  conditionalRules?: ConditionalRule[];
  /** Local agent definitions and bodies pinned at config load time. */
  agentTypes?: AgentTypeInfo[];
  /** Validation and precedence diagnostics for the agent catalogs that exist. */
  agentTypeReports?: AgentTypeLoadReport[];
  /**
   * MCP servers declared by a project-owned settings file. A checkout can ship
   * `.harness/settings.json`, so these names carry the declaration the project
   * asked for and the caller decides whether to connect them.
   */
  projectMcpServers?: Record<string, McpServerConfig>;
  /**
   * The user's own switch to admit every project-declared MCP server in this
   * workspace without answering for each one. Only the user layer (or an
   * explicitly named settings file) may set it.
   */
  approveAllProjectMcpServers?: boolean;
}

export interface LoadProjectOptions {
  /** Harness user directory. Defaults to `<home>/.harness`. */
  userDir?: string;
  /** Explicit settings file merged last (highest precedence). */
  settingsFile?: string;
  /** Explicit independent policy file; parsed as bounded JSON data. */
  managedSettingsFile?: string;
  /**
   * Directory the OS-managed policy is read from when no explicit policy file
   * is given. Defaults to the source's platform directory; an explicit value
   * stands where the source's own override slot answers nothing in this build.
   */
  managedSettingsDir?: string;
  /** Workspace-relative or absolute paths used to select conditional rules.
   * Omission preserves the original unconditional loading behavior. */
  paths?: string[];
}

/** Where an OS-managed policy came from and what the loader had to drop. */
export interface ManagedSettingsReport {
  source: "explicit" | "directory";
  /** The managed directory, for a directory read. */
  directory?: string;
  /** Documents that were read, in merge order (base first, drop-ins by name). */
  documents: string[];
  /** Keys ignored because this runtime carries no policy for them. */
  ignoredKeys: string[];
  /** Read, parse or validation failures. A document with an error contributes nothing. */
  errors: { file: string; message: string }[];
}

const MANAGED_POLICY_KEYS: ReadonlySet<string> = new Set(["allowShell", "permissions", "features", "mcpClient"]);

function errnoOf(error: unknown): string | undefined {
  const own = (error as NodeJS.ErrnoException | undefined)?.code;
  if (own !== undefined) return own;
  return (error as { cause?: NodeJS.ErrnoException } | undefined)?.cause?.code;
}

/**
 * Read the OS-managed policy directory the way the recovered `Lko` does:
 * `managed-settings.json` first, then every `managed-settings.d/*.json` whose
 * name does not start with a dot, sorted by name, regular files and symlinks
 * only, merging each document with the source's own settings customizer.
 *
 * The product carries four policy keys. A document's other keys are dropped
 * and reported rather than rejecting the whole policy: the source's schema
 * accepts every settings key, so a foreign key there is not an error either.
 * A missing directory or file is absence; any other read or parse failure is
 * reported and that document contributes nothing.
 */
export function loadManagedSettingsDirectory(directory: string): { settings?: Record<string, unknown>; report: ManagedSettingsReport } {
  const documents: string[] = [];
  const ignoredKeys: string[] = [];
  const errors: { file: string; message: string }[] = [];
  const merged: Record<string, unknown> = {};
  let found = false;
  const read = (file: string): void => {
    let text: string;
    try {
      const bytes = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
      if (bytes.overflow) throw new ConfigError(`managed settings file exceeds ${CONFIG_LIMITS.settingsBytes} byte limit`, file);
      text = bytes.buffer.toString("utf8");
    } catch (error) {
      const code = errnoOf(error);
      if (code !== "ENOENT" && code !== "ENOTDIR") errors.push({ file, message: (error as Error).message });
      return;
    }
    documents.push(file);
    if (text.trim() === "") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      errors.push({ file, message: `invalid JSON (${(error as Error).message})` });
      return;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.push({ file, message: "managed settings must be a JSON object" });
      return;
    }
    const accepted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (MANAGED_POLICY_KEYS.has(key)) accepted[key] = value;
      else if (!ignoredKeys.includes(key)) ignoredKeys.push(key);
    }
    if (Object.keys(accepted).length === 0) return;
    found = true;
    mergeSettings(merged, accepted);
  };
  read(path.join(directory, "managed-settings.json"));
  const dropIn = path.join(directory, "managed-settings.d");
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dropIn, { withFileTypes: true });
  } catch (error) {
    const code = errnoOf(error);
    if (code !== "ENOENT" && code !== "ENOTDIR") errors.push({ file: dropIn, message: (error as Error).message });
    entries = [];
  }
  const names = entries
    .filter(entry => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith(".json") && !entry.name.startsWith("."))
    .map(entry => entry.name)
    .sort();
  for (const name of names) read(path.join(dropIn, name));
  const report: ManagedSettingsReport = { source: "directory", directory, documents, ignoredKeys, errors };
  if (!found) return { report };
  const parsed = managedPolicySchema.safeParse(cloneSafe(merged));
  if (!parsed.success) {
    errors.push({ file: directory, message: `managed settings rejected (${parsed.error.message})` });
    return { report };
  }
  return { settings: parsed.data, report };
}


export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
  /** Legacy projection limitations or full YAML parsing fallback diagnostics. */
  limitations: string[];
}

// Bounds on every filesystem read. Exposed so callers and tests can reason
// about them; treat as read-only.
export const CONFIG_LIMITS = Object.freeze({
  settingsBytes: 512 * 1024,
  textBytes: 2 * 1024 * 1024,
  // Shared ceiling for all configuration text loaded in one call. The
  // per-file and per-directory caps alone would allow thousands of large files.
  textBytesTotal: 8 * 1024 * 1024,
  dirEntries: 2048,
  ancestorDepth: 64,
  importDepth: 5,
  yamlNodes: 10000,
  yamlDepth: 64,
});

const INSTRUCTION_FILES = ["HARNESS.md", "AGENTS.md"] as const;
const SKILL_MANIFEST = "SKILL.md";
const HARNESS_DIR = ".harness";

// Keys that must never be merged as ordinary data: assigning or recursing into
// them can mutate an object's prototype chain.
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Raised for unreadable, oversized, or syntactically invalid configuration. */
export class ConfigError extends Error {
  readonly path?: string;

  constructor(message: string, filePath?: string, options?: { cause?: unknown }) {
    super(filePath ? `${message}: ${filePath}` : message, options);
    this.name = "ConfigError";
    this.path = filePath;
  }
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

function tryRealpath(target: string): string | undefined {
  try {
    return fs.realpathSync(target);
  } catch {
    return undefined;
  }
}

/**
 * Vet an instruction file's link chain before its contents are treated as
 * instructions. A file reached through a link is not the file the path named,
 * so a body that is not a path at all, a body that climbs back out of a
 * directory it entered, a loop, or a chain past the bound are refused here
 * rather than silently read.
 */
function vetInstructionPath(file: string): void {
  try {
    vetLinkChain(file);
  } catch (error) {
    if (error instanceof LinkVetError) throw new ConfigError(error.message, file, { cause: error });
    throw error;
  }
}

function isRegularFile(target: string): boolean {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

// Tracks the remaining *original* file bytes a configuration loading pass
// may still read. Instructions, skills, memories and agent definitions share
// this budget. It is charged the bytes on disk, never the size the decoded string
// would re-encode to, so malformed UTF-8 cannot inflate the accounting.
interface ByteBudget {
  remaining: number;
  text?: Map<string, string>;
}

/**
 * Result of a bounded descriptor read. `buffer` holds exactly the bytes that
 * were read (the first `bytes` bytes of the file), `bytes` is that count, and
 * `overflow` is true when the file held more than the requested cap.
 */
export interface BoundedRead {
  buffer: Buffer;
  bytes: number;
  overflow: boolean;
}

/**
 * Read at most `maxBytes` bytes from a regular file through one descriptor,
 * issuing `maxBytes + 1` bytes of requests in total so an over-limit file is
 * detected without ever consuming more than one byte past the bound. Unlike a
 * stat-then-`readFileSync`, this never issues an unbounded read and is immune
 * to a file that grows between the size check and the read.
 *
 * The file is opened with `O_NONBLOCK` so that opening a FIFO or other special
 * file cannot block, and the regular-file check is made with `fstat` on the
 * opened descriptor rather than on a prior path stat, so it cannot race with a
 * path swap. The descriptor is closed even when a read fails. `maxBytes` must
 * be a non-negative safe integer.
 *
 * Exposed for tests and reuse; the caller decides how to interpret `overflow`.
 */
export function readBoundedBytes(file: string, maxBytes: number): BoundedRead {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError(`readBoundedBytes requires a non-negative safe integer byte limit, got ${maxBytes}`);
  }
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0);
  let fd: number;
  try {
    fd = fs.openSync(file, flags);
  } catch (error) {
    throw new ConfigError("cannot open file", file, { cause: error });
  }
  try {
    let stat: fs.Stats;
    try {
      stat = fs.fstatSync(fd);
    } catch (error) {
      throw new ConfigError("cannot stat file", file, { cause: error });
    }
    if (!stat.isFile()) throw new ConfigError("not a regular file", file);

    // One spare byte is enough to prove the file is larger than the cap.
    const window = Buffer.allocUnsafe(maxBytes + 1);
    let total = 0;
    while (total <= maxBytes) {
      let read: number;
      try {
        read = fs.readSync(fd, window, total, window.length - total, total);
      } catch (error) {
        throw new ConfigError("cannot read file", file, { cause: error });
      }
      if (read === 0) break; // end of file
      total += read;
    }
    return { buffer: window.subarray(0, total), bytes: total, overflow: total > maxBytes };
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // A failed close only drops the descriptor; the read result still stands.
    }
  }
}

/**
 * Read a text file under both the per-file cap and the shared aggregate budget.
 *
 * The read consumes at most one byte past the tighter of the two caps
 * (`min(textBytes, budget.remaining)`), so it never over-reads past the shared
 * budget, and the overage is classified by which bound the bytes actually read
 * broke. The budget is charged the exact original byte count: a malformed
 * UTF-8 file is counted by its bytes on disk, not by the larger size its
 * decoded string would re-encode to (each invalid byte is one byte here, not
 * the three its replacement character would re-encode to, which would
 * overcharge the budget). Peak transient memory is bounded by the read window
 * plus the decoded string, not held to an exact byte figure. The offending
 * path is preserved on the error.
 */
function readTextFile(file: string, budget: ByteBudget): string {
  const real = tryRealpath(file);
  if (real !== undefined && budget.text?.has(real)) return budget.text.get(real)!;
  const perFile = CONFIG_LIMITS.textBytes;

  // A cheap size pre-check gives an obviously oversized file per-file priority
  // and avoids reading its first `textBytes` bytes only to reject it. The
  // authoritative bound below is still enforced on the descriptor, so a file
  // that grows past this pre-check cannot bypass it.
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    throw new ConfigError("cannot stat file", file, { cause: error });
  }
  if (stat.isFile() && stat.size > perFile) {
    throw new ConfigError(`file exceeds ${perFile} byte read limit`, file);
  }

  // Read at most one byte past the tighter cap, then classify the overage by
  // which cap the bytes actually read exceeded.
  const limit = Math.min(perFile, budget.remaining);
  const read = readBoundedBytes(file, limit);
  if (read.overflow) {
    if (read.bytes > perFile) {
      throw new ConfigError(`file exceeds ${perFile} byte read limit`, file);
    }
    throw new ConfigError(
      `instruction/skill text exceeds ${CONFIG_LIMITS.textBytesTotal} byte aggregate budget`,
      file,
    );
  }
  budget.remaining -= read.bytes;
  const text = read.buffer.toString("utf8");
  if (real !== undefined) budget.text?.set(real, text);
  return text;
}

// ---------------------------------------------------------------------------
// Prototype-safe structural merge
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Deep-copy a JSON value, skipping prototype-polluting keys entirely. */
function cloneSafe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneSafe);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (PROTOTYPE_KEYS.has(key)) continue;
      out[key] = cloneSafe(value[key]);
    }
    return out;
  }
  return value;
}

/** Concatenate two arrays, dropping structurally-duplicate entries. */
function dedupConcat(base: unknown[], incoming: unknown[]): unknown[] {
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const item of [...base, ...incoming]) {
    let identity: string;
    try {
      identity = JSON.stringify(item) ?? String(item);
    } catch {
      identity = String(item);
    }
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(cloneSafe(item));
  }
  return out;
}

/**
 * Merge `source` into `target`: plain objects recurse, arrays concatenate with
 * de-duplication, and any other later value replaces the earlier one. Keys that
 * would mutate a prototype chain are skipped so a hostile settings file cannot
 * pollute `Object.prototype`.
 */
function mergeInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (PROTOTYPE_KEYS.has(key)) continue;
    const incoming = source[key];
    const current = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
    if (isPlainObject(current) && isPlainObject(incoming)) {
      const merged: Record<string, unknown> = { ...current };
      mergeInto(merged, incoming);
      target[key] = merged;
    } else if (Array.isArray(current) && Array.isArray(incoming)) {
      target[key] = dedupConcat(current, incoming);
    } else {
      target[key] = cloneSafe(incoming);
    }
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

function readSettingsLayer(file: string, required: boolean): Record<string, unknown> | null {
  let exists: boolean;
  try {
    exists = fs.existsSync(file);
  } catch {
    exists = false;
  }
  if (!exists) {
    if (required) throw new ConfigError("explicit settings file not found", file);
    return null;
  }
  // The regular-file test and the byte bound are both enforced on the opened
  // descriptor inside readBoundedBytes, so a file that grows (or changes type)
  // between this existence check and the read cannot bypass the settings cap.
  const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
  if (read.overflow) {
    throw new ConfigError(`settings file exceeds ${CONFIG_LIMITS.settingsBytes} byte limit`, file);
  }
  const text = read.buffer.toString("utf8");
  // An empty file is treated as "no settings", not as a JSON error.
  if (text.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(`invalid JSON in settings file (${(error as Error).message})`, file, { cause: error });
  }
  if (!isPlainObject(parsed)) throw new ConfigError("settings file must contain a JSON object", file);
  return parsed;
}

// ---------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------

/**
 * Ancestor directories from the outermost boundary down to the workspace.
 * Traversal stops (inclusively) at the home directory, a directory containing a
 * `.git` entry, or the filesystem root, whichever comes first, and is capped by
 * CONFIG_LIMITS.ancestorDepth. Results are ordered outermost-first.
 */
function ancestorDirs(workspaceRoot: string): string[] {
  const homeReal = tryRealpath(os.homedir());
  const chain: string[] = [];
  const seen = new Set<string>();
  let dir = workspaceRoot;
  for (let depth = 0; depth < CONFIG_LIMITS.ancestorDepth; depth++) {
    const real = tryRealpath(dir) ?? dir;
    if (seen.has(real)) break;
    seen.add(real);
    // The filesystem root is an authority boundary, never an instruction source.
    if (path.dirname(dir) === dir) break;
    chain.push(dir);
    if (homeReal !== undefined && real === homeReal) break;
    if (fs.existsSync(path.join(dir, ".git"))) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  chain.reverse();
  return chain;
}

/** Bounded recursive Markdown rules, preserving deterministic path order. */
function listRules(dir: string): string[] {
  if (!isDirectory(dir)) return [];
  const root = fs.realpathSync(dir);
  const queue = [{ directory: dir, depth: 0 }];
  const seen = new Set<string>();
  const files: string[] = [];
  let count = 0;
  for (let index = 0; index < queue.length; index++) {
    const { directory, depth } = queue[index]!;
    const real = fs.realpathSync(directory);
    if (seen.has(real)) continue;
    seen.add(real);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { throw new ConfigError("cannot read rules directory", directory, { cause: error }); }
    count += entries.length;
    if (count > CONFIG_LIMITS.dirEntries) throw new ConfigError(`rules directory exceeds ${CONFIG_LIMITS.dirEntries} entries`, directory);
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      let stat: fs.Stats;
      try { stat = fs.statSync(full); }
      catch (error) {
        if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) continue;
        throw new ConfigError("cannot stat rules entry", full, { cause: error });
      }
      if (stat.isDirectory()) {
        const relative = path.relative(root, fs.realpathSync(full));
        if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new ConfigError("rules directory escapes its root", full);
        if (seen.has(fs.realpathSync(full))) continue;
        if (depth >= 3) throw new ConfigError("rules directory exceeds depth 3", full);
        queue.push({ directory: full, depth: depth + 1 });
      } else if (entry.name.endsWith(".md") && stat.isFile()) files.push(full);
    }
  }
  return files.sort();
}

// Mask inert Markdown regions while retaining offsets/newlines for token scans.
function activeMarkdown(text: string): string {
  const chars = text.split("");
  const mask = (start: number, end: number): void => {
    for (let i = start; i < end; i++) if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " ";
  };
  let fence: { char: string; length: number } | undefined;
  for (let i = 0; i < text.length;) {
    if (i === 0 || text[i - 1] === "\n") {
      const newline = text.indexOf("\n", i);
      const end = newline === -1 ? text.length : newline + 1;
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)/.exec(text.slice(i, end));
      if (fence) {
        mask(i, end);
        if (marker && marker[1]![0] === fence.char && marker[1]!.length >= fence.length && marker[2]!.trim() === "") fence = undefined;
        i = end;
        continue;
      }
      if (marker && !(marker[1]![0] === "`" && marker[2]!.includes("`"))) {
        fence = { char: marker[1]![0]!, length: marker[1]!.length };
        mask(i, end);
        i = end;
        continue;
      }
    }
    if (text.startsWith("<!--", i)) {
      const close = text.indexOf("-->", i + 4);
      const end = close === -1 ? text.length : close + 3;
      mask(i, end);
      i = end;
    } else if (text[i] === "`") {
      let end = i + 1;
      while (text[end] === "`") end++;
      const delimiter = text.slice(i, end);
      let close = text.indexOf(delimiter, end);
      while (close !== -1 && (text[close - 1] === "`" || text[close + delimiter.length] === "`")) {
        close = text.indexOf(delimiter, close + delimiter.length);
      }
      if (close === -1) { i = end; continue; }
      mask(i, close + delimiter.length);
      i = close + delimiter.length;
    } else if (text[i] === "\\") { mask(i, i + 2); i += 2; }
    else i++;
  }
  return chars.join("");
}

function instructionImports(text: string): string[] {
  const active = activeMarkdown(text);
  const imports: string[] = [];
  const pattern = /(^|[\s(])@([^\s<>`"']+)/g;
  for (const match of active.matchAll(pattern)) {
    const target = match[2]!.replace(/[),;.!?]+$/, "").split("#", 1)[0]!;
    if (/\.(?:md|markdown)$/i.test(target)) imports.push(target);
  }
  return imports;
}

function resolveImport(target: string, parentFile: string): string {
  if (target.startsWith("~/")) return path.resolve(os.homedir(), target.slice(2));
  return path.resolve(path.dirname(parentFile), target);
}

function conditionalRulePatterns(data: Record<string, unknown>, file: string): string[] | undefined {
  const value = data.paths ?? data.pathglob;
  if (value === undefined) return undefined;
  const patterns = typeof value === "string" ? [value] : value;
  if (!Array.isArray(patterns) || patterns.some(item => typeof item !== "string" || item.trim() === "")) {
    throw new ConfigError("rule paths/pathglob must be a string or array of non-empty strings", file);
  }
  return [...new Set(patterns as string[])];
}

/** Match a pinned rule against workspace-relative slash-normalized target paths. */
export function matchesConditionalRule(rule: Pick<ConditionalRule, "patterns">, paths: readonly string[]): boolean {
  return rule.patterns.some(pattern => paths.some(candidate => path.matchesGlob(candidate, pattern)));
}

// ---------------------------------------------------------------------------
// Minimal YAML frontmatter subset
// ---------------------------------------------------------------------------
//
// Supported: a leading `---` line, a closing `---` line, and within it flat
// `key: scalar` lines where the scalar is a plain unquoted string, a
// single-quoted string, a double-quoted string, or the booleans true/false.
// Blank lines and full-line `#` comments are ignored, and a trailing ` #`
// comment is stripped from unquoted scalars.
//
// NOT supported (reported in `limitations`, never mis-parsed): nested/indented
// mappings, block or flow collections (`- item`, `[a, b]`, `{a: b}`), block
// scalars (`|`, `>`), anchors/aliases/tags, and any line that is not a flat
// `key: value`. Those constructs are dropped; the skill still loads with the
// fields that were understood.

function unescapeDoubleQuoted(inner: string): string {
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch === "\\" && i + 1 < inner.length) {
      const next = inner[i + 1]!;
      if (next === "n") { out += "\n"; i += 1; continue; }
      if (next === "t") { out += "\t"; i += 1; continue; }
      if (next === '"' || next === "\\") { out += next; i += 1; continue; }
      out += ch;
      continue;
    }
    out += ch;
  }
  return out;
}

function parseScalar(raw: string): string | boolean {
  let value = raw.trim();
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0]!;
    const end = value.indexOf(quote, 1);
    if (end !== -1) value = value.slice(0, end + 1);
    const inner = value.slice(1, -1);
    return quote === '"' ? unescapeDoubleQuoted(inner) : inner.replace(/''/g, "'");
  }
  const comment = value.indexOf(" #");
  if (comment !== -1) value = value.slice(0, comment).trim();
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  return value;
}

function yamlData(source: string): Record<string, unknown> {
  const document = parseDocument(source, { schema: "core", uniqueKeys: true, strict: true });
  if (document.errors.length || document.warnings.length) {
    throw new Error([...document.errors, ...document.warnings].map(error => error.message).join("; "));
  }
  // Bound the inert syntax tree before expanding aliases or converting to JS.
  const pending: { node: unknown; depth: number }[] = [{ node: document.contents, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++nodes > CONFIG_LIMITS.yamlNodes || depth > CONFIG_LIMITS.yamlDepth) {
      throw new Error("YAML structural limit exceeded");
    }
    if (isMap(node)) {
      for (const pair of node.items) {
        pending.push({ node: pair.key, depth: depth + 1 }, { node: pair.value, depth: depth + 1 });
      }
    } else if (isSeq(node)) {
      for (const item of node.items) pending.push({ node: item, depth: depth + 1 });
    }
  }
  const value: unknown = document.toJS({ maxAliasCount: 100 });
  if (value === null) return {};
  if (!isPlainObject(value)) throw new Error("frontmatter must contain a YAML mapping");
  let count = 0;
  const ancestors = new Set<object>();
  function jsonValue(item: unknown, depth: number): unknown {
    if (++count > CONFIG_LIMITS.yamlNodes || depth > CONFIG_LIMITS.yamlDepth) {
      throw new Error("YAML value limit exceeded");
    }
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (!Array.isArray(item) && !isPlainObject(item)) throw new Error("frontmatter values must be JSON data");
    if (ancestors.has(item)) throw new Error("cyclic YAML aliases are unsupported");
    ancestors.add(item);
    let out: unknown;
    if (Array.isArray(item)) out = item.map(child => jsonValue(child, depth + 1));
    else {
      const mapping: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(item)) {
        if (!PROTOTYPE_KEYS.has(key)) mapping[key] = jsonValue(child, depth + 1);
      }
      out = mapping;
    }
    ancestors.delete(item);
    return out;
  }
  return jsonValue(value, 0) as Record<string, unknown>;
}

/** The default scalar projection remains compatible with the original public API.
 * Config loading selects full YAML explicitly. Invalid YAML preserves body text. */
export function parseFrontmatter(text: string, options: { full?: boolean } = {}): Frontmatter {
  const limitations: string[] = [];
  const normalized = text.replace(/^﻿/, "");
  const lines = normalized.split(/\r?\n/);
  if (lines.length === 0 || lines[0]!.trim() !== "---") {
    return { data: {}, body: normalized, limitations };
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]!.trim() === "---") { close = i; break; }
  }
  if (close === -1) {
    limitations.push("unterminated frontmatter: treated as body text");
    return { data: {}, body: normalized, limitations };
  }
  if (options.full) {
    try {
      const body = normalized.split(/(?<=\n)/).slice(close + 1).join("");
      return { data: yamlData(lines.slice(1, close).join("\n")), body, limitations };
    } catch (error) {
      limitations.push(`invalid YAML frontmatter: treated as body text (${(error as Error).message})`);
      return { data: {}, body: normalized, limitations };
    }
  }
  const data: Record<string, unknown> = {};
  let nestedReported = false;
  for (let i = 1; i < close; i++) {
    const line = lines[i]!;
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (/^\s/.test(line)) {
      if (!nestedReported) {
        limitations.push("nested/indented frontmatter is not supported and was ignored");
        nestedReported = true;
      }
      continue;
    }
    const match = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) {
      limitations.push(`unsupported frontmatter line ignored: ${JSON.stringify(line)}`);
      continue;
    }
    const key = match[1]!;
    const valueRaw = match[2]!.trim();
    if (valueRaw === "") {
      limitations.push(`frontmatter key "${key}" has no scalar value; nested content is not supported`);
      continue;
    }
    if (/^[[{|>]/.test(valueRaw)) {
      limitations.push(`complex frontmatter value for "${key}" is not supported`);
      continue;
    }
    data[key] = parseScalar(valueRaw);
  }
  const body = lines.slice(close + 1).join("\n");
  return { data, body, limitations };
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

function toBoolean(value: unknown, fallback: boolean, field: string, file: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^true$/i.test(value)) return true;
    if (/^false$/i.test(value)) return false;
  }
  throw new ConfigError(`skill ${field} must be a boolean`, file);
}

function stringField(data: Record<string, unknown>, field: string, file: string): string | undefined {
  const value = data[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ConfigError(`skill ${field} must be a string`, file);
  return value;
}

function loadSkill(skillDir: string, skillManifest: string, into: Map<string, SkillInfo>, budget: ByteBudget, source: SkillSource, namespace?: string): void {
  const text = readTextFile(skillManifest, budget);
  const frontmatter = parseFrontmatter(text, { full: true });
  const data = frontmatter.data;
  const rawName = stringField(data, "name", skillManifest);
  const name = rawName || path.basename(skillDir);
  const skill: SkillInfo = {
    name,
    description: stringField(data, "description", skillManifest) ?? "",
    path: skillManifest,
    body: frontmatter.body,
    source,
    userInvocable: toBoolean(data["user-invocable"], true, "user-invocable", skillManifest),
    disableModelInvocation: toBoolean(data["disable-model-invocation"], false, "disable-model-invocation", skillManifest),
  };
  for (const field of ["model", "command", "shell"] as const) {
    const value = stringField(data, field, skillManifest);
    if (value !== undefined) skill[field] = value;
  }
  const effort = stringField(data, "effort", skillManifest);
  if (effort !== undefined) {
    if (!["low", "medium", "high", "xhigh", "max"].includes(effort)) {
      throw new ConfigError("skill effort must be low, medium, high, xhigh or max", skillManifest);
    }
    skill.effort = effort as SkillEffort;
  }
  if (data.context !== undefined) {
    if (data.context !== "fork") throw new ConfigError('skill context must be "fork"', skillManifest);
    skill.context = "fork";
  }
  if (data.agent !== undefined) {
    const agent = stringField(data, "agent", skillManifest)!;
    if (!agent.trim() || agent.length > 128 || skill.context !== "fork") throw new ConfigError("skill agent requires context: fork and a non-empty name up to 128 characters", skillManifest);
    skill.agent = agent.trim();
  }
  if (data.background !== undefined) skill.background = toBoolean(data.background, false, "background", skillManifest);
  if (data.aliases !== undefined) {
    const aliases = typeof data.aliases === "string" ? data.aliases.split(/\s+/).filter(Boolean) : data.aliases;
    if (!Array.isArray(aliases) || aliases.length > 32 || aliases.some(value => typeof value !== "string" || value.length > 128 || !/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/.test(value)) || new Set(aliases).size !== aliases.length) {
      throw new ConfigError("skill aliases must contain up to32 unique slash names", skillManifest);
    }
    skill.aliases = aliases.filter(value => value !== name);
  }
  if (data.arguments !== undefined) skill.argumentNames = argumentNamesFrom(data.arguments);
  if (data["allowed-tools"] !== undefined) {
    const raw = data["allowed-tools"];
    const values = typeof raw === "string" ? raw.split(",").map(value => value.trim()).filter(Boolean) : raw;
    if (!Array.isArray(values) || values.some(value => typeof value !== "string" || value.trim() === "")) {
      throw new ConfigError("skill allowed-tools must be a string or array of non-empty strings", skillManifest);
    }
    skill.allowedTools = [...new Set(values as string[])];
  }
  if (data.metadata !== undefined) {
    if (!isPlainObject(data.metadata)) throw new ConfigError("skill metadata must be a JSON object", skillManifest);
    skill.metadata = data.metadata;
  }
  if (data.hooks !== undefined) {
    const parsed = hooksSchema.safeParse(data.hooks);
    if (!parsed.success) throw new ConfigError(`invalid skill hooks (${parsed.error.message})`, skillManifest);
    skill.hooks = parsed.data;
  }
  const limitations = [...frontmatter.limitations];
  // Invocation-time inline shell expansion requires permission-aware machinery.
  if (/!`|```!/.test(frontmatter.body)) limitations.push("inline shell expansion is unresolved; commands remain literal text");
  if (skill.command !== undefined || skill.shell !== undefined) limitations.push("command/shell invocation metadata is inert in the configuration loader");
  if (limitations.length) skill.limitations = limitations;
  if (namespace !== undefined) {
    const fullName = `${namespace}:${name}`;
    if (fullName.length > 128 || !/^[A-Za-z0-9_.-]+(?::[A-Za-z0-9_.-]+)*$/.test(fullName)) throw new ConfigError("Invalid namespaced plugin skill name", skillManifest);
    skill.name = fullName;
    skill.aliases = [...new Set([name, ...(skill.aliases ?? [])])].filter(alias => alias !== fullName);
    if (skill.aliases.length > 32) throw new ConfigError("Namespaced plugin aliases exceed32", skillManifest);
  }
  if (!into.has(skill.name)) into.set(skill.name, skill);
}

/**
 * Scan one skills directory. Only direct subdirectories are considered, and
 * only those that contain a SKILL.md are loaded. A shared `seen` set of
 * realpaths de-duplicates symlinked or repeated entries across directories.
 * Every loaded SKILL.md draws from the shared aggregate byte budget.
 */
function scanSkills(baseDir: string, seen: Set<string>, into: Map<string, SkillInfo>, budget: ByteBudget, source: SkillSource, namespace?: string): void {
  if (!isDirectory(baseDir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch (error) {
    throw new ConfigError("cannot read skills directory", baseDir, { cause: error });
  }
  if (entries.length > CONFIG_LIMITS.dirEntries) {
    throw new ConfigError(`skills directory exceeds ${CONFIG_LIMITS.dirEntries} entries`, baseDir);
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const entry of entries) {
    const skillDir = path.join(baseDir, entry.name);
    const real = tryRealpath(skillDir);
    if (real === undefined || seen.has(real)) continue;
    if (!isDirectory(skillDir)) continue;
    const skillManifest = path.join(skillDir, SKILL_MANIFEST);
    if (!isRegularFile(skillManifest)) continue;
    const manifestReal = tryRealpath(skillManifest)!;
    if (seen.has(manifestReal)) continue;
    seen.add(real);
    seen.add(manifestReal);
    loadSkill(skillDir, skillManifest, into, budget, source, namespace);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Default harness user directory: `<home>/.harness`. */
export function defaultUserDir(): string {
  return path.join(os.homedir(), HARNESS_DIR);
}

/**
 * Load the harness configuration for `workspace`.
 *
 * Settings are merged with later sources winning: user, then project, then
 * local, then the explicit `settingsFile`. Plain objects merge recursively,
 * arrays concatenate with structural de-duplication, and prototype-polluting
 * keys are never merged. Invalid settings JSON raises a ConfigError.
 *
 * Instructions are `HARNESS.md`/`AGENTS.md` from the outermost ancestor down to
 * the workspace (bounded at home or a git root), followed by every
 * `.harness/rules/*.md` file and recursive Markdown imports. Supplying `paths`
 * selects conditional rules; omitting it retains unconditional loading. Skills
 * come from project, user, verified installed plugins when settings.plugins is
 * enabled, and explicit settings.pluginDirs local directories, in that
 * precedence. Memories are workspace-local; agent types come from project
 * `.harness/agents` then the independent user directory's `agents` catalog.
 *
 * All instruction, skill, memory and agent text shares an aggregate byte
 * budget (`CONFIG_LIMITS.textBytesTotal`). Exceeding it raises a ConfigError
 * (carrying the offending path) before any result is returned, so a partial
 * configuration is never emitted.
 *
 * An explicit managed policy file is strict. Without one, the OS-managed
 * directory is read as the recovered file tier does: the base document then
 * the drop-ins by name, merged with the source's own customizer. Policy keys
 * this runtime does not carry and documents it cannot read are reported in
 * `managedSettingsReport` rather than replacing the authored settings.
 */
/** Whether this process has ever handed the chain a plugin hooks declaration. Set on the first read
 *  that finds one, so every later read reconciles against it even when the list is empty: a removed
 *  plugin must be unloaded, and an empty declaration list *is* that removal. */
let pluginHooksAdoptionStarted = false;

export function loadProjectConfig(workspace: string, options: LoadProjectOptions = {}): LoadedConfig {
  const workspaceRoot = path.resolve(workspace);
  const workspaceReal = tryRealpath(workspaceRoot);
  if (workspaceReal === undefined) throw new ConfigError("workspace directory not found", workspaceRoot);
  if (!isDirectory(workspaceReal)) throw new ConfigError("workspace is not a directory", workspaceRoot);

  const userDir = path.resolve(options.userDir ?? defaultUserDir());
  const harnessDir = path.join(workspaceRoot, HARNESS_DIR);

  const layers: { file: string; required: boolean }[] = [
    { file: path.join(userDir, "settings.json"), required: false },
    { file: path.join(harnessDir, "settings.json"), required: false },
    { file: path.join(harnessDir, "settings.local.json"), required: false },
  ];
  if (options.settingsFile !== undefined) {
    const explicit = path.isAbsolute(options.settingsFile)
      ? options.settingsFile
      : path.resolve(workspaceRoot, options.settingsFile);
    layers.push({ file: explicit, required: true });
  }

  const settings: Record<string, unknown> = {};
  let managedSettings: Record<string, unknown> | undefined;
  let managedSettingsReport: ManagedSettingsReport | undefined;
  if (options.managedSettingsFile !== undefined) {
    const file = path.resolve(workspaceRoot, options.managedSettingsFile);
    const parsed = readSettingsLayer(file, true)!;
    const allowed = new Set(["allowShell", "permissions", "features", "mcpClient"]);
    if (Object.keys(parsed).some(key => !allowed.has(key))) throw new ConfigError("managed settings accepts only allowShell, permissions, features and mcpClient", file);
    managedSettings = managedPolicySchema.parse(cloneSafe(parsed));
    managedSettingsReport = { source: "explicit", documents: [file], ignoredKeys: [], errors: [] };
  } else {
    // The OS-managed directory is read when no explicit file replaces it, as
    // the recovered file tier does. An absent directory is absence.
    const directory = path.resolve(options.managedSettingsDir ?? managedSettingsDir());
    const loaded = loadManagedSettingsDirectory(directory);
    managedSettings = loaded.settings;
    if (loaded.report.documents.length > 0 || loaded.report.ignoredKeys.length > 0 || loaded.report.errors.length > 0) {
      managedSettingsReport = loaded.report;
    }
  }
  const pluginExplicitLayers: Record<string, unknown>[] = [];
  // The project-owned layers are `settings.json` and `settings.local.json`
  // inside the workspace. A server named there comes from the checkout, not
  // from the person running the session, so its declaration is kept aside for
  // the caller to hold until that person approves it. The user layer and an
  // explicitly named settings file are the caller's own.
  const projectMcpServers: Record<string, McpServerConfig> = {};
  // The one switch that admits a checkout's declarations wholesale lives in the
  // user layer for the same reason the answers do: a project must not be able
  // to grant itself admission by editing its own settings.
  let approveAllProjectMcpServers = false;
  for (const [index, layer] of layers.entries()) {
    const parsed = readSettingsLayer(layer.file, layer.required);
    if (parsed !== null) {
      pluginExplicitLayers.push(parsed);
      mergeInto(settings, parsed);
      if (parsed.approveAllProjectMcpServers !== undefined) {
        if (typeof parsed.approveAllProjectMcpServers !== "boolean") {
          throw new ConfigError("approveAllProjectMcpServers must be true or false", layer.file);
        }
        if (index === 1 || index === 2) {
          throw new ConfigError("approveAllProjectMcpServers is a user setting; a checkout cannot approve its own MCP servers", layer.file);
        }
        approveAllProjectMcpServers = parsed.approveAllProjectMcpServers;
      }
      if (index > 0 && index < 3 && parsed.mcpServers !== undefined) {
        Object.assign(projectMcpServers, mcpServersSchema.parse(parsed.mcpServers));
      }
    }
  }
  delete settings.approveAllProjectMcpServers;
  if (managedSettings) {
    for (const key of ["allowShell", "permissions"] as const) if (Object.hasOwn(managedSettings, key)) settings[key] = cloneSafe(managedSettings[key]);
    for (const key of ["features", "mcpClient"] as const) if (Object.hasOwn(managedSettings, key)) {
      settings[key] = { ...(isPlainObject(settings[key]) ? settings[key] : {}), ...(managedSettings[key] as Record<string, unknown>) };
    }
  }

  let plugins: PluginConfig | undefined;
  if (settings.plugins !== undefined) {
    const parsed = pluginConfigSchema.safeParse(settings.plugins);
    if (!parsed.success) throw new ConfigError(`invalid settings plugins (${parsed.error.message})`);
    plugins = parsed.data;
  }

  // One shared budget covers every configuration text file read below. It is
  // consumed conservatively: a project skill that later overrides a user skill
  // of the same name still counts against the budget, because its bytes were
  // read.
  const budget: ByteBudget = { remaining: CONFIG_LIMITS.textBytesTotal, text: new Map() };
  if (options.paths !== undefined && (!Array.isArray(options.paths) || options.paths.some(value => typeof value !== "string"))) {
    throw new ConfigError("configuration paths must be an array of strings");
  }
  const selectedPaths = options.paths?.map(value => {
    // macOS aliases /tmp to /private/tmp; accept either workspace spelling.
    const base = path.isAbsolute(value) && (value === workspaceReal || value.startsWith(workspaceReal + path.sep)) ? workspaceReal : workspaceRoot;
    return path.relative(base, path.resolve(base, value)).split(path.sep).join("/");
  });
  const instructions: InstructionFile[] = [];
  const conditionalRules: ConditionalRule[] = [];
  const conditionalSeen = new Set<string>();
  const instructionSeen = new Set<string>();
  function pinRuleImports(rootFile: string, body: string): InstructionFile[] {
    const pinned: InstructionFile[] = [];
    const seen = new Set<string>([tryRealpath(rootFile)!]);
    function visit(file: string, depth: number, parent?: string): void {
      vetInstructionPath(file);
      const real = tryRealpath(file);
      if (real === undefined || !isRegularFile(file)) throw new ConfigError("instruction import file not found", file);
      if (seen.has(real)) return;
      if (depth >= CONFIG_LIMITS.importDepth) throw new ConfigError(`instruction import exceeds depth ${CONFIG_LIMITS.importDepth}`, file);
      seen.add(real);
      const content = readTextFile(file, budget);
      pinned.push({ path: file, content, ...(parent === undefined ? {} : { parent }) });
      for (const target of instructionImports(parseFrontmatter(content, { full: true }).body)) visit(resolveImport(target, file), depth + 1, file);
    }
    for (const target of instructionImports(body)) visit(resolveImport(target, rootFile), 1, rootFile);
    return pinned;
  }
  function appendInstruction(file: string, depth: number, rule = false, parent?: string): void {
    vetInstructionPath(file);
    const real = tryRealpath(file);
    if (real === undefined || !isRegularFile(file)) throw new ConfigError("instruction import file not found", file);
    if (instructionSeen.has(real)) return;
    if (depth >= CONFIG_LIMITS.importDepth) throw new ConfigError(`instruction import exceeds depth ${CONFIG_LIMITS.importDepth}`, file);
    const content = readTextFile(file, budget);
    const frontmatter = parseFrontmatter(content, { full: true });
    let globs: string[] | undefined;
    if (rule) {
      const patterns = conditionalRulePatterns(frontmatter.data, file);
      if (patterns !== undefined) {
        globs = patterns;
        if (!conditionalSeen.has(real)) {
          conditionalSeen.add(real);
          const pinned: ConditionalRule = { path: file, content, patterns, ...(parent === undefined ? {} : { parent }) };
          if (selectedPaths !== undefined) {
            const imports = pinRuleImports(file, frontmatter.body);
            if (imports.length) pinned.imports = imports;
          }
          conditionalRules.push(pinned);
        }
        if (selectedPaths !== undefined && !matchesConditionalRule({ patterns }, selectedPaths)) return;
      }
    }
    instructionSeen.add(real);
    instructions.push({ path: file, content, ...(parent === undefined ? {} : { parent }), ...(globs === undefined ? {} : { globs }) });
    for (const target of instructionImports(frontmatter.body)) appendInstruction(resolveImport(target, file), depth + 1, false, file);
  }
  for (const dir of ancestorDirs(workspaceRoot)) {
    for (const name of INSTRUCTION_FILES) {
      const file = path.join(dir, name);
      if (isRegularFile(file)) appendInstruction(file, 0);
    }
  }
  for (const rule of listRules(path.join(harnessDir, "rules"))) appendInstruction(rule, 0, true);

  const skills = new Map<string, SkillInfo>();
  const seen = new Set<string>();
  // Scan highest precedence first so a shared realpath cannot demote a project skill.
  scanSkills(path.join(harnessDir, "skills"), seen, skills, budget, "projectSettings");
  scanSkills(path.join(userDir, "skills"), seen, skills, budget, "userSettings");
  let installedComponents: ReturnType<typeof discoverInstalledPluginComponents>;
  try {
    installedComponents = discoverInstalledPluginComponents(workspaceReal, plugins);
    // The chain's side of the same discovery: a plugin whose hooks file names a module hands the chain
    // its descriptor (`{name, modulePath, path}` — the source's own fields, `cIo`), which loads the
    // module in the background because the module is code and discovery is synchronous. Once a process
    // has adopted anything, every later read adopts again even with nothing declared, because that
    // empty list is how a removed plugin is unloaded. Imported lazily until then, so a config read with
    // no such plugin never pulls the chain in.
    const declarations = installedComponents.flatMap(item => item.hooksModulePath
      ? [{name: item.plugin.manifest.name, modulePath: item.hooksModulePath, path: item.directory}]
      : []);
    if (declarations.length > 0 || pluginHooksAdoptionStarted) {
      pluginHooksAdoptionStarted = true;
      void import("./plugin-chain-registry.js").then(chain => chain.adoptPluginHooksModules(declarations));
    }
    // Plugin hooks run first; each explicit layer keeps its actual precedence.
    const pluginHooks: Record<string, unknown[]> = {};
    const pluginServers = Object.fromEntries(installedComponents.flatMap(item => Object.entries(item.mcpServers ?? {})));
    for (const item of installedComponents) {
      for (const [event, entries] of Object.entries(item.hooks ?? {})) {
        pluginHooks[event] = [...(pluginHooks[event] ?? []), ...entries];
      }
    }
    const hasPluginHooks = installedComponents.some(item => item.hooks !== undefined);
    const hasPluginServers = installedComponents.some(item => item.mcpServers !== undefined);
    if (hasPluginHooks) {
      for (const layer of pluginExplicitLayers) {
        if (layer.hooks === undefined) continue;
        for (const [event, entries] of Object.entries(hooksSchema.parse(layer.hooks))) {
          pluginHooks[event] = [...(pluginHooks[event] ?? []), ...(entries ?? [])];
        }
      }
      settings.hooks = hooksSchema.parse(pluginHooks);
    }
    if (hasPluginServers) {
      // Replace complete servers, including args/type; generic deep merge would
      // combine incompatible transports or append a lower-priority argv list.
      for (const layer of pluginExplicitLayers) {
        if (layer.mcpServers === undefined) continue;
        Object.assign(pluginServers, mcpServersSchema.parse(layer.mcpServers));
      }
      settings.mcpServers = mcpServersSchema.parse(pluginServers);
    }
  } catch (error) {
    throw new ConfigError(`invalid installed plugin catalog (${(error as Error).message})`, path.join(harnessDir, "plugins"), { cause: error });
  }
  const namespacePlugins = isPlainObject(settings.features) && settings.features.pluginSkillNamespaces === true;
  for (const item of installedComponents) if (item.skillDirectory) scanSkills(item.skillDirectory, seen, skills, budget, "plugin",
    namespacePlugins ? item.plugin.manifest.name : undefined);
  const pluginDirs = settings.pluginDirs;
  if (pluginDirs !== undefined) {
    if (!Array.isArray(pluginDirs) || pluginDirs.some(value => typeof value !== "string" || value.trim() === "")) {
      throw new ConfigError("settings pluginDirs must be an array of non-empty local directory paths");
    }
    if (pluginDirs.length > CONFIG_LIMITS.dirEntries) throw new ConfigError("settings pluginDirs exceeds directory count limit");
    for (const dir of pluginDirs as string[]) {
      scanSkills(path.resolve(workspaceRoot, dir), seen, skills, budget, "plugin");
    }
  }
  const memorySeen = new Set<string>();
  const memories = listRules(path.join(harnessDir, "memory")).filter(file => {
    const real = tryRealpath(file)!;
    if (memorySeen.has(real)) return false;
    memorySeen.add(real);
    return true;
  }).map(file => ({ path: file, content: readTextFile(file, budget) }));
  const projectAgents = path.join(harnessDir, "agents");
  const userAgents = path.join(userDir, "agents");
  const agentCatalog = loadAgentTypes({
    ...(fs.existsSync(projectAgents) ? { projectDir: projectAgents } : {}),
    ...(fs.existsSync(userAgents) ? { userDir: userAgents } : {}),
    pluginDirs: installedComponents.flatMap(item => item.agentDirectory ? [item.agentDirectory] : []),
    remainingBudget: budget.remaining,
  });
  budget.remaining -= agentCatalog.bytes;
  // Agent/skill loaders pin their text. Reverify their installed trees after
  // those reads so persistent swaps or symlink replacements fail closed.
  if (installedComponents.length) {
    try {
      const current = discoverInstalledPluginComponents(workspaceReal, plugins);
      if (JSON.stringify(current.map(item => item.plugin)) !== JSON.stringify(installedComponents.map(item => item.plugin))) {
        throw new Error("Installed plugin index changed during config load.");
      }
    }
    catch (error) {
      throw new ConfigError(`installed plugin changed during config load (${(error as Error).message})`, path.join(harnessDir, "plugins"), { cause: error });
    }
  }
  const result: LoadedConfig = { settings, instructions, skills: [...skills.values()] };
  const watchDirectories = [...installedComponents.map(item => item.directory),
    ...(Array.isArray(pluginDirs) ? (pluginDirs as string[]).map(dir => path.resolve(workspaceRoot, dir)) : [])];
  if (watchDirectories.length) result.watchDirectories = watchDirectories;
  if (managedSettings !== undefined) result.managedSettings = managedSettings;
  if (managedSettingsReport !== undefined) result.managedSettingsReport = managedSettingsReport;
  if (memories.length) result.memories = memories;
  if (conditionalRules.length) result.conditionalRules = conditionalRules;
  if (agentCatalog.agentTypes.length) result.agentTypes = agentCatalog.agentTypes;
  if (agentCatalog.reports.length) result.agentTypeReports = agentCatalog.reports;
  if (Object.keys(projectMcpServers).length) result.projectMcpServers = projectMcpServers;
  if (approveAllProjectMcpServers) result.approveAllProjectMcpServers = true;
  return result;
}

/** Discover instructions along the accessed path without scanning sibling trees. */
export function loadPathInstructions(workspace: string, target: string, candidates?: (paths: string[]) => void): InstructionFile[] {
  const root = fs.realpathSync(workspace);
  const resolved = path.resolve(root, target);
  const relative = path.relative(root, resolved);
  if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(".." + path.sep)) return [];
  const parts = relative.split(path.sep).filter(Boolean);
  if (parts.some(part => [".agent", ".git", "node_modules", ".harness-worktrees"].includes(part.toLowerCase()))) return [];
  if (parts.length > CONFIG_LIMITS.ancestorDepth) throw new ConfigError("nested instruction depth exceeds limit");
  const budget: ByteBudget = { remaining: 64 * 1024, text: new Map() };
  const files: InstructionFile[] = [];
  const seen = new Set<string>();
  const watchPaths: string[] = [];
  function visit(file: string, depth: number, parent?: string): void {
    vetInstructionPath(file);
    const real = tryRealpath(file);
    if (!real || !isRegularFile(file)) throw new ConfigError("nested instruction import file missing", file);
    const rel = path.relative(root, real);
    if (path.isAbsolute(rel) || rel === ".." || rel.startsWith(".." + path.sep)) throw new ConfigError("nested instruction import escapes workspace", file);
    if (rel.split(path.sep).some(part => [".agent", ".git", "node_modules", ".harness-worktrees"].includes(part.toLowerCase()))) {
      throw new ConfigError("nested instruction import enters a reserved tree", file);
    }
    if (seen.has(real)) return;
    if (depth >= CONFIG_LIMITS.importDepth) throw new ConfigError("nested instruction import depth exceeds limit", file);
    seen.add(real);
    const content = readTextFile(real, budget);
    files.push({ path: real, content, ...(parent === undefined ? {} : { parent }) });
    for (const imported of instructionImports(parseFrontmatter(content, { full: true }).body)) visit(resolveImport(imported, real), depth + 1, real);
  }
  let directory = root;
  const depth = isDirectory(resolved) ? parts.length : Math.max(0, parts.length - 1);
  for (let index = 0; index < depth; index++) {
    directory = path.join(directory, parts[index]!);
    const real = tryRealpath(directory);
    if (!real) break;
    const rel = path.relative(root, real);
    if (path.isAbsolute(rel) || rel === ".." || rel.startsWith(".." + path.sep)) throw new ConfigError("nested instruction directory escapes workspace", directory);
    for (const name of INSTRUCTION_FILES) {
      const file = path.join(directory, name);
      watchPaths.push(path.join(real, name));
      if (isRegularFile(file)) visit(file, 0);
    }
  }
  candidates?.(watchPaths);
  return files;
}

/** Parse quote groups as text; incomplete syntax falls back to legacy splitting. */
function quotedSkillArguments(value: string): string[] | undefined {
  const result: string[] = [];
  let word = ""; let started = false; let quote = "";
  for (let i = 0; i < value.length; i++) {
    const char = value[i]!;
    if (quote) {
      if (char === quote) quote = "";
      else if (char === "\\" && quote === "\"") {
        const next = value[i + 1];
        if (next === undefined) return undefined;
        if (["\\", "\"", "$", "`", "\n"].includes(next)) { if (next !== "\n") word += next; i++; }
        else word += char;
      } else word += char;
    } else if (char === "\"" || char === "'") { quote = char; started = true; }
    else if (char === "\\") {
      const next = value[++i];
      if (next === undefined) return undefined;
      if (next !== "\n") { word += next; started = true; }
    } else if (/\s/.test(char)) {
      if (started) { result.push(word); word = ""; started = false; }
    } else { word += char; started = true; }
  }
  if (quote) return undefined;
  if (started) result.push(word);
  return result;
}

/** Recovered `$oe` (chunk-sfn1dbxq.js [435233,435431)): names are non-empty non-digit strings. */
export function argumentNamesFrom(value: unknown): string[] {
  const valid = (item: unknown): item is string => typeof item === "string" && item.trim() !== "" && !/^\d+$/.test(item);
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(valid);
  if (typeof value === "string") return value.split(/\s+/).filter(valid);
  return [];
}
/** Recovered `gl` (chunk-ax7r0qj7.js [677,739)): escape a name for the replacement pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Replace raw, zero-based indexed and one-based legacy forms in a single pass. */
export function expandSkill(skill: string | { body: string; argumentNames?: readonly string[] }, args: string, options: { quotedArguments?: boolean; appendUnusedArguments?: boolean; extendedArguments?: boolean; argumentNames?: readonly string[] } = {}): string {
  const body = typeof skill === "string" ? skill : typeof skill?.body === "string" ? skill.body : "";
  if (body === "") return "";
  const rawArgs = typeof args === "string" ? args : "";
  const trimmed = rawArgs.trim();
  const fallback = trimmed === "" ? [] : trimmed.split(/\s+/);
  const positional = options.quotedArguments ? quotedSkillArguments(rawArgs) ?? fallback : fallback;
  let consumed = false;
  const names = argumentNamesFrom(options.argumentNames ?? (typeof skill === "string" ? [] : skill.argumentNames ?? []));
  const namedPositions = new Map<string, number>();
  names.forEach((name, index) => { if (!namedPositions.has(name)) namedPositions.set(name, index); });
  const named = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  const basic = options.extendedArguments
    ? /(?<!\\)\\\$(?=\d|ARGUMENTS)|\$ARGUMENTS\[(\d+)\]|\$ARGUMENTS|\$(\d+)(?!\w)/g
    : /\$ARGUMENTS\[(\d+)\]|\$ARGUMENTS|\$([1-9])(?!\d)/g;
  const pattern = named ? new RegExp(`(?<!\\\\)\\\\\\$(?=(?:${named})(?![\\[\\w]))|\\$(?:${named})(?![\\[\\w])|${basic.source}`, "g") : basic;
  const expanded = body.replace(pattern, (match: string, indexed: string | undefined, index: string | undefined) => {
    if (match === "\\$") return "$";
    const namedIndex = namedPositions.get(match.slice(1));
    if (namedIndex !== undefined) { consumed = true; return positional[namedIndex] ?? ""; }
    if (indexed !== undefined) {
      const value = positional[Number(indexed)];
      if (value === undefined) return match;
      consumed = true; return value;
    }
    if (match === "$ARGUMENTS") { consumed = true; return rawArgs; }
    const value = positional[Number(index) - (options.extendedArguments ? 0 : 1)];
    if (value !== undefined) consumed = true;
    return value ?? (options.extendedArguments ? match : "");
  });
  return options.appendUnusedArguments && !consumed && rawArgs ? `${expanded}\n\nARGUMENTS: ${rawArgs}` : expanded;
}
