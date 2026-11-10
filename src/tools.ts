// Workspace tool layer for an independent personal agent.
//
// File tools use the workspace and explicit live directory grants, vet every
// symlink spelling, and preserve the reserved `.agent` boundary.
// Searches and listings include hidden files but always exclude `.agent`.
// Shell commands run with the OS user's permissions and are not path-confined;
// only file tools are confined.

import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { fileURLToPath } from "node:url";

import type { Anthropic } from "@anthropic-ai/sdk";
import { z } from "zod";
import type { WrapperObservation, WrapperTransition } from './runtime-wrapper-observer.js';
import { atomicWriteFile, syncDirectory } from "./atomic-write.js";
import type { InteractionCallbacks } from "./interaction-tools.js";
import { PathResolutionError, resolveChain, verifyIdentity, observeWorkingDirectory, type DirectoryReadHandle, type WorkingDirectories, type ResolvedPath } from "./path-identity.js";
import { editEffectResult, writeEffectResult, type ToolUseResult } from "./tool-use-result.js";
import type { PlanModeHost } from './plan-mode.js';
import type { PathApprovalCall } from './path-approval-call-owner.js';
import { resolveOwnedPlanFile } from './plan-file.js';
import type { SourceReadCache } from './controlled-read-projection-source.js';
import { sourceBunHashString } from './wyhash-source.js';
import { decodeFileBytes, lwe } from './path-approval-decoder-source.js';
import { ZMe } from './edit-match-source.js';
import { skillResultsDirectory } from './skill-output-source.js';
import { copyStableDirectoryFile } from './directory-file-state.js';
import { directoryEditInputSchema as editFileSchema, directoryWriteInputSchema, renderFileEdit } from './directory-publication-authorization.js';
export { copyStableDirectoryFile } from './directory-file-state.js';

export type ToolContext = {
  notebookInsertId?: string;
  session?: import('./session.js').Session;
  toolUseId?: string;
  workspace: string;
  signal: AbortSignal;
  abortController?: AbortController;
  allowShell: boolean;
  maxOutputBytes: number;
  pathApprovalCall?: PathApprovalCall;
  /** Host-owned approval-to-use checker for a builtin read (revalidates and binds the approved identity). */
  /** Approved landing captured before hooks; the reader refuses a later landing change. */
  readApproval?: { landing: string; spellings: readonly string[] };
  readHandleConsumer?: {
    check(input: { path: string }): Promise<boolean>;
    readLinesWithMetadata(offset: number, limit: number, maxBytes: number): Promise<{
      content: string; truncated: boolean; mtimeMs: number; identity: { dev: string; ino: string };
    }>;
  };
  authorizationIdentity?: { readonly signal: AbortSignal };
  directoryPublicationAuthorization?: import('./directory-publication-authorization.js').DirectoryPublicationAuthorization;
  shellHome?: { value: string | undefined };
  conversation?: readonly Anthropic.MessageParam[];
  interaction?: InteractionCallbacks;
  planMode?: PlanModeHost;
  fileHistory?: (file?: string) => void;
  readFileCache?: SourceReadCache;
  fileMutationGate?: { preReadGuard: boolean; readAllowed: (file: string, tool: 'write_file' | 'edit_file') => boolean };
  workingDirectories?: (readOnly: boolean) => WorkingDirectories;
  /** A host-owned, already verified directory handle; its owner retains and closes it. */
  verifiedReadDirectory?: { readonly fd: number; readonly root: string };
  /** Retain the exact directory grant used by this invocation until delivery. */
  readGrantSignal?: (signal: AbortSignal) => void;
  readGrantWitness?: (grant: { readonly owner: string; readonly incarnation: string }) => void;
  /** A file-effecting tool reports the structured host result of the effect it just performed. */
  hostResult?: (value: ToolUseResult) => void;
  /** Context changes belong to this invocation and are merged by the scheduler. */
  contextLayer?: (layer: ToolResultContextLayer) => void;
  /** Child assistant tool-use progress, tied to the invoking parent call. */
  agentProgress?: (agentId: string, message: Anthropic.ToolUseBlockParam) => void;
  /** Source `Czr`'s `emitToolProgress` progress frame, carrying the shell poll's snapshot. */
  onProgress?: (progress: ShellProgress) => void;
};

export type ToolResultContextLayer = { kind: 'allowed_tools'; allowedTools: readonly string[] };

/**
 * Source `Czr` (chunk-sfn1dbxq.js 4340642): one shell poll frame. `output` is the tail kept for
 * the row, `fullOutput` everything seen so far, and `totalLines`/`totalBytes` the running counts.
 */
export type ShellProgress = {
  output: string;
  fullOutput: string;
  elapsedTimeSeconds: number;
  totalLines: number;
  totalBytes: number;
  timeoutMs?: number;
};

export type ToolDefinition = {
  schema: Anthropic.Tool;
  readOnly: boolean;
  concurrencySafe?(input: unknown): boolean;
  // SendFileTool/IA, 8t44px9f [22793,31590), 2bcyxj9q [231514,231561), UTF-16.
  readPaths?(input: unknown): readonly string[];
  mcpAnnotations?: { destructive: boolean; openWorld: boolean; toolName?: string; title?: string };
  toAutoClassifierInput?(input: unknown): unknown;
  requiresUserInteraction?: boolean;
  planOperation?: 'enter' | 'exit';
  classifierOnly?: boolean;
  execute(input: unknown, context: ToolContext): Promise<string>;
  executeBlocks?(input: unknown, context: ToolContext): Promise<Anthropic.ToolResultBlockParam['content']>;
  forChild?(): ToolDefinition;
  /** Source tool `call` result `endsTurn: true` (chunk-5wc3wh5m.js `Ea`): a successful
   *  call ends the turn instead of re-invoking the model. */
  endsTurn?: boolean;
};

const READ_DEFAULT_LIMIT = 2000;
const READ_MAX_LIMIT = 2000;
const LIST_DEFAULT_LIMIT = 1000;
const LIST_MAX_LIMIT = 1000;
const SEARCH_DEFAULT_LIMIT = 200;
const SEARCH_MAX_LIMIT = 200;
const COMMAND_DEFAULT_TIMEOUT_MS = 30000;
const COMMAND_MAX_TIMEOUT_MS = 120000;
const FALLBACK_MAX_OUTPUT_BYTES = 100_000;
const AGENT_DIR = ".agent";
const READ_STREAM_HIGH_WATER = 64 * 1024;
const SHELL_PIPE_GRACE_MS = 200;
/** Source `hOn` (chunk-sfn1dbxq.js 4322055): the shell's progress poll interval. */
const SHELL_PROGRESS_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

function abortError(): Error {
  const error = new Error("operation aborted before it started");
  error.name = "AbortError";
  return error;
}

// ---------------------------------------------------------------------------
// UTF-8 safe truncation (never emit a U+FFFD replacement char from a cut)
// ---------------------------------------------------------------------------

/** Largest prefix length <= maxBytes that ends on a UTF-8 code point boundary. */
function utf8PrefixEnd(buf: Buffer, maxBytes: number): number {
  let end = Math.min(maxBytes, buf.length);
  while (end > 0 && end < buf.length && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return end;
}

/** Smallest suffix start so a suffix of at most maxBytes begins on a boundary. */
function utf8SuffixStart(buf: Buffer, maxBytes: number): number {
  let start = Math.max(0, buf.length - maxBytes);
  while (start < buf.length && (buf[start]! & 0xc0) === 0x80) start += 1;
  return start;
}

/**
 * Drop a trailing incomplete UTF-8 sequence so decoding cannot emit U+FFFD.
 * Used when a byte cap may have cut the final code point off.
 */
function trimIncompleteTail(buf: Buffer): Buffer {
  if (buf.length === 0) return buf;
  let index = buf.length;
  let continuation = 0;
  while (index > 0 && continuation < 3 && (buf[index - 1]! & 0xc0) === 0x80) {
    index -= 1;
    continuation += 1;
  }
  if (index === 0) return buf;
  const lead = buf[index - 1]!;
  let expected: number;
  if (lead < 0x80) expected = 1;
  else if ((lead & 0xe0) === 0xc0) expected = 2;
  else if ((lead & 0xf0) === 0xe0) expected = 3;
  else if ((lead & 0xf8) === 0xf0) expected = 4;
  else return buf; // invalid lead byte: leave the bytes untouched
  if (buf.length - (index - 1) >= expected) return buf;
  return buf.subarray(0, index - 1);
}

function decodeUtf8(buf: Buffer): string {
  return trimIncompleteTail(buf).toString("utf8");
}

// ---------------------------------------------------------------------------
// Confinement
// ---------------------------------------------------------------------------

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function unresolvedUnderLink(resolved: ResolvedPath, roots: readonly string[]): boolean {
  if (resolved.identity !== undefined) return false;
  // A terminal link to a missing target is a dangling write target.
  if (resolved.leafIsSymlink === true) return true;
  if (resolved.hops.length === 0) return false;
  // An ancestor directory link is safe to follow for a create only when the
  // missing leaf's parent still lands inside an allowed root and is a directory.
  const parent = path.dirname(resolved.path);
  if (!roots.some(root => isWithin(root, parent))) return true;
  try { return !fs.statSync(parent).isDirectory(); } catch { return true; }
}

function rejectAgentSegment(root: string, target: string): void {
  const rel = path.relative(root, target);
  if (rel === "") return;
  if (rel.split(path.sep).includes(AGENT_DIR)) {
    throw new Error(`path is inside the reserved "${AGENT_DIR}" directory`);
  }
}

/**
 * Resolve `userPath` inside `root`, following every symlink component and
 * rejecting any path that leaves the workspace. Absolute paths are rejected
 * outright so a caller cannot name a location inside the workspace by absolute
 * path. When `mustExist` is false the final path component(s) may be missing,
 * but every existing ancestor symlink is still resolved and checked so a
 * symlinked directory cannot be used to write outside the workspace.
 */
export function confineResolved(root: string, userPath: string, mustExist: boolean,
  directories: WorkingDirectories = []): ResolvedPath {
  const observed = directories.rootSpellings ?? directories.flatMap(directory => observeWorkingDirectory(root, directory));
  if (observed.length) {
    // Mk/eNe/Yg, chunk-2bcyxj9q [214762,215541), UTF-16. Every observed spelling needs a vetted root.
    const roots = [root, ...observed];
    const resolved = resolveChain(root, userPath);
    const spellings = [path.resolve(root, userPath), ...(resolved.spellings ?? []), resolved.path];
    for (const spelling of spellings) {
      if (spelling.split(path.sep).includes(AGENT_DIR)) throw new Error(`path is inside the reserved "${AGENT_DIR}" directory`);
      if (!roots.some(allowed => isWithin(allowed, spelling))) throw new Error(`path escapes the workspace through an ungranted spelling: ${userPath}`);
    }
    if (!resolved.identity && (mustExist || unresolvedUnderLink(resolved, roots))) throw new Error(`path does not exist or has a dangling symlink: ${userPath}`);
    return resolved;
  }
  if (path.isAbsolute(userPath)) {
    throw new Error(`path escapes the workspace (absolute paths are not allowed): ${userPath}`);
  }
  const abs = path.resolve(root, userPath);
  if (!isWithin(root, abs)) {
    throw new Error(`path escapes the workspace: ${userPath}`);
  }
  const rel = path.relative(root, abs);
  if (rel === "") {
    if (mustExist && !fs.existsSync(abs)) {
      throw new Error(`path does not exist: ${userPath}`);
    }
    return { path: root, hops: [] };
  }
  // The reserved directory is refused before any link is followed, so the
  // lexical form is checked first and the resolved form again below.
  if (rel.split(path.sep).includes(AGENT_DIR)) {
    throw new Error(`path is inside the reserved "${AGENT_DIR}" directory: ${userPath}`);
  }
  // Resolve the whole chain in one bounded walk rather than following each
  // segment with a separate realpath call: the bound, the loop refusal, the
  // unreadable-ancestor refusal and the network-landing refusal all live in the
  // resolver, and it returns the hops and the identity for the caller to use.
  let resolved: ResolvedPath;
  try {
    resolved = resolveChain(root, userPath);
  } catch (error) {
    if (error instanceof PathResolutionError) {
      throw new Error(`path cannot be resolved: ${userPath} (${error.message})`);
    }
    throw error;
  }
  if (!isWithin(root, resolved.path)) {
    throw new Error(`path escapes the workspace through a symlink: ${userPath}`);
  }
  // A chain that ends on nothing is a dangling link, which is refused here even
  // when the caller would otherwise be allowed to create the target.
  if (unresolvedUnderLink(resolved, [root])) {
    throw new Error(`path escapes the workspace through a dangling symlink: ${userPath}`);
  }
  rejectAgentSegment(root, resolved.path);
  if (resolved.identity === undefined && mustExist) {
    throw new Error(`path does not exist: ${userPath}`);
  }
  return resolved;
}

function confine(root: string, userPath: string, mustExist: boolean, directories: readonly string[] = []): string {
  return confineResolved(root, userPath, mustExist, directories).path;
}

/**
 * Refuse a write when the path is no longer the file that was resolved for it.
 * A tool that resolves a path and then writes through it would otherwise land
 * on whatever took its place in between.
 */
function verifyUnchanged(resolved: ResolvedPath, tool: string, userPath: string): void {
  try {
    verifyIdentity(resolved);
  } catch (error) {
    if (error instanceof PathResolutionError) {
      throw new Error(`${tool}: path changed after it was resolved: ${userPath}`);
    }
    throw error;
  }
}

function workspaceReal(workspace: string): string {
  const resolved = path.resolve(workspace);
  try {
    return fs.realpathSync(resolved);
  } catch {
    throw new Error(`workspace does not exist: ${workspace}`);
  }
}

// ---------------------------------------------------------------------------
// Output capping
// ---------------------------------------------------------------------------

function maxBytesFor(context: ToolContext): number {
  const value = Math.floor(context.maxOutputBytes);
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_MAX_OUTPUT_BYTES;
}

/** Keep the head of `text`, noting omitted bytes. Used for reads/listings. */
function truncateHead(text: string, maxBytes: number, label: string): string {
  const buf = Buffer.from(text, "utf8");
  if (buf.length <= maxBytes) return text;
  const end = utf8PrefixEnd(buf, maxBytes);
  const kept = buf.subarray(0, end).toString("utf8");
  return `${kept}\n[${label}: output truncated; ${buf.length - end} more bytes omitted]`;
}

// ---------------------------------------------------------------------------
// Atomic write
// ---------------------------------------------------------------------------

function atomicWrite(real: string, content: string | Buffer, mode?: number) {
  // Delegated: the shared writer verifies the bytes it wrote and the directory
  // it wrote them in, and keeps the content rather than discarding it when the
  // rename cannot happen.
  return atomicWriteFile(real, content, mode === undefined ? {} : { mode });
}

// ---------------------------------------------------------------------------
// Bounded subprocess helper (for rg). Memory usage is capped while the child
// is still allowed to run until the cap is reached, then it is killed.
// ---------------------------------------------------------------------------

type BoundedResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  truncated: boolean;
  aborted: boolean;
  spawnError: NodeJS.ErrnoException | null;
};

function runBounded(
  command: string,
  args: string[],
  cwd: string,
  options: { maxBytes: number; maxLines: number; signal?: AbortSignal },
): Promise<BoundedResult> {
  return new Promise<BoundedResult>((resolve) => {
    if (options.signal?.aborted) {
      resolve({
        stdout: "",
        stderr: "",
        code: null,
        truncated: false,
        aborted: true,
        spawnError: null,
      });
      return;
    }

    let child: ChildProcess;
    try {
      child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      resolve({
        stdout: "",
        stderr: "",
        code: null,
        truncated: false,
        aborted: false,
        spawnError: error as NodeJS.ErrnoException,
      });
      return;
    }

    let settled = false;
    let truncated = false;
    let aborted = false;
    let bytes = 0;
    let errBytes = 0;
    let newlines = 0;
    const outParts: Buffer[] = [];
    const errParts: Buffer[] = [];

    const kill = () => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    };
    const onAbort = () => {
      aborted = true;
      kill();
    };
    const finish = (result: BoundedResult) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };

    child.stdout?.on("data", (chunk: Buffer) => {
      const room = options.maxBytes > 0 ? Math.max(0, options.maxBytes - bytes) : 0;
      if (room > 0) outParts.push(chunk.subarray(0, room));
      bytes += chunk.length;
      for (const byte of chunk) if (byte === 0x0a) newlines += 1;
      if (bytes > options.maxBytes || newlines > options.maxLines) {
        truncated = true;
        kill();
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      // Bound stderr by bytes, not by a fixed chunk count: the failure text is
      // surfaced in error messages, so it must respect the same output cap as
      // stdout (a chunk-count cap let stderr grow to chunks x chunk-size).
      const room = options.maxBytes > 0 ? Math.max(0, options.maxBytes - errBytes) : 0;
      if (room > 0) errParts.push(chunk.subarray(0, room));
      errBytes += chunk.length;
    });

    child.on("error", (error) => {
      finish({
        stdout: decodeUtf8(Buffer.concat(outParts)),
        stderr: "",
        code: null,
        truncated,
        aborted,
        spawnError: error as NodeJS.ErrnoException,
      });
    });
    child.on("close", (code) => {
      finish({
        stdout: decodeUtf8(Buffer.concat(outParts)),
        stderr: decodeUtf8(Buffer.concat(errParts)),
        code,
        truncated,
        aborted,
        spawnError: null,
      });
    });

    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

// ---------------------------------------------------------------------------
// Glob fallback (only used when ripgrep is unavailable)
// ---------------------------------------------------------------------------

function globToRegExp(glob: string): RegExp {
  let source = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i]!;
    if (char === "*") {
      if (glob[i + 1] === "*") {
        while (glob[i + 1] === "*") i += 1;
        if (glob[i + 1] === "/") {
          source += "(?:.*/)?";
          i += 1;
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) {
        source += "\\{";
      } else {
        const alternatives = glob
          .slice(i + 1, end)
          .split(",")
          .map((alt) => alt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        source += `(?:${alternatives.join("|")})`;
        i = end;
      }
    } else if ("\\^$+.()|[]".includes(char)) {
      source += `\\${char}`;
    } else {
      source += char;
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * Bounded, cancellable directory walk used when ripgrep is unavailable. Stops
 * as soon as `limit` matches are collected (marking the result truncated) and
 * aborts promptly when the signal fires, so a huge tree cannot exhaust memory.
 */
async function fallbackListFiles(
  root: string,
  target: string,
  glob: string | undefined,
  limit: number,
  signal: AbortSignal,
): Promise<{ entries: string[]; truncated: boolean }> {
  const matcher = glob ? globToRegExp(glob) : null;
  const found: string[] = [];
  let truncated = false;
  const stack: string[] = [target];
  while (stack.length > 0) {
    if (signal.aborted) throw abortError();
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.name === AGENT_DIR || entry.name === '.harness-worktrees') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      const rel = path.relative(root, full) || entry.name;
      if (matcher && !matcher.test(rel)) continue;
      if (found.length >= limit) {
        truncated = true;
        break;
      }
      found.push(rel);
    }
    if (truncated) break;
  }
  found.sort((a, b) => a.localeCompare(b));
  return { entries: found, truncated };
}

// ---------------------------------------------------------------------------
// Bounded line-window reader (read_file)
// ---------------------------------------------------------------------------

async function readDirectoryFileLines(
  directory: { readonly fd: number; readonly relative: string }, userPath: string,
  offset: number, limit: number, maxBytes: number, signal: AbortSignal,
  unchanged?: { timestamp: number; identity: { dev: string; ino: string } },
): Promise<{ content: string; mtimeMs: number; truncated: boolean; identity: { dev: string; ino: string }; incomplete?: boolean } | { unchanged: true }> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw new Error('read_file: directory handles unsupported');
  if (signal.aborted) throw abortError();
  const child = spawn(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)), [directory.relative],
    { stdio: ['ignore', 'pipe', 'ignore', directory.fd, 'pipe'] });
  const stdout = child.stdout;
  const metadata = child.stdio[4];
  if (!stdout || !metadata || !('read' in metadata)) { child.kill(); throw new Error('read_file: helper pipes unavailable'); }
  const exit = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  // Install the handler before any await, including when spawn itself fails.
  void exit.catch(() => {});
  const onAbort = () => child.kill('SIGTERM');
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  let complete = false;
  try {
    const iterator = metadata[Symbol.asyncIterator]();
    let header = '';
    while (!header.includes('\n') && header.length <= 1024) {
      const part = await iterator.next();
      if (part.done) break;
      header += String(part.value);
    }
    if (signal.aborted) throw abortError();
    const firstEnd = header.indexOf('\n');
    const first = header.slice(0, firstEnd + 1);
    let rest = header.slice(firstEnd + 1);
    const match = /^v1 begin ([0-9]+) ([0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+)\n$/.exec(first);
    if (!match) throw new Error(`read_file: directory-relative open failed: ${userPath}`);
    if (Number(match[5]) >= 1e9 || Number(match[7]) >= 1e9) throw new Error(`read_file: invalid directory-relative metadata: ${userPath}`);
    const identity = { dev: match[1]!, ino: match[2]! };
    const mtimeMs = Number(match[4]) * 1000 + Math.floor(Number(match[5]) / 1000000);
    if (!Number.isSafeInteger(mtimeMs)) throw new Error(`read_file: invalid directory-relative timestamp: ${userPath}`);
    stdout.setEncoding('utf8');
    let lineNo = 1, current = '', chars = 0, capped = false, finished = false;
    const lines: string[] = [];
    const endLine = offset + limit - 1;
    for await (const chunk of stdout) {
      if (signal.aborted) throw abortError();
      const text = String(chunk);
      let cursor = 0;
      for (;;) {
        const nl = text.indexOf('\n', cursor);
        const segment = nl < 0 ? text.slice(cursor) : text.slice(cursor, nl);
        const inWindow = lineNo >= offset && lineNo <= endLine;
        if (inWindow) {
          const room = maxBytes - chars;
          if (segment.length > room) {
            current += room > 0 ? segment.slice(0, room) : '';
            lines.push(current); current = ''; capped = true; finished = true; break;
          }
          current += segment; chars += segment.length;
        }
        if (nl < 0) break;
        if (inWindow) {
          lines.push(current); current = '';
          if (lineNo === endLine) { finished = true; break; }
        }
        lineNo++; cursor = nl + 1;
      }
      if (finished) break;
    }
    if (!finished && lineNo >= offset && lineNo <= endLine) lines.push(current);
    if (!finished) {
      for (;;) {
        const part = await iterator.next();
        if (part.done) break;
        rest += String(part.value);
        if (rest.length > 1024) throw new Error(`read_file: invalid directory-relative status: ${userPath}`);
      }
      const code = await exit;
      if (signal.aborted) throw abortError();
      if (code !== 0) throw new Error(`read_file: directory-relative read failed: ${userPath}`);
      if (rest !== first.replace('v1 begin ', 'v1 stable ')) throw new Error(`read_file: directory-relative file changed during read or status incomplete: ${userPath}`);
      complete = true;
      if (unchanged && unchanged.timestamp === mtimeMs && unchanged.identity.dev === identity.dev && unchanged.identity.ino === identity.ino) return { unchanged: true };
    }
    const joined = lines.join('\n');
    if (capped) {
      const bytes = Buffer.from(joined, 'utf8');
      return { content: `${bytes.subarray(0, utf8PrefixEnd(bytes, maxBytes)).toString('utf8')}\n[read_file: output truncated; file continues]`, mtimeMs, truncated: true, identity, incomplete: finished };
    }
    const content = truncateHead(joined, maxBytes, 'read_file');
    return { content, mtimeMs, truncated: content !== joined, identity, incomplete: finished };
  } finally {
    signal.removeEventListener('abort', onAbort);
    if (!complete) child.kill('SIGTERM');
    stdout.destroy();
    metadata.destroy();
    await exit.catch(() => {});
  }
}

/**
 * Stream `real` and return only the requested 1-based line window, mirroring
 * `String#split("\n")` semantics (a trailing newline yields a final empty
 * line). The stored window is bounded by `maxBytes` so a huge file or a single
 * enormous line cannot allocate unbounded memory; when the bound is hit the
 * content is truncated and noted.
 */
async function readFileLines(
  resolved: ResolvedPath,
  userPath: string,
  offset: number,
  limit: number,
  maxBytes: number,
  signal: AbortSignal,
  unchanged?: { timestamp: number; identity: { dev: string; ino: string } },
  directory?: { readonly fd: number; readonly relative: string },
): Promise<{ content: string; mtimeMs: number; truncated: boolean; identity: { dev: string; ino: string }; incomplete?: boolean } | { unchanged: true }> {
  const endLine = offset + limit - 1;
  const lines: string[] = [];
  let lineNo = 1;
  let current = "";
  let windowChars = 0;
  let capped = false;
  let finished = false;

  // Open the resolved path without following a link on its last component, then
  // check the handle against the identity the resolver recorded. The stream
  // reads from that handle, so the bytes come from the file that was checked
  // rather than from whatever the path names when the read starts.
  if (directory) return readDirectoryFileLines(directory, userPath, offset, limit, maxBytes, signal, unchanged);
  const fd = fs.openSync(resolved.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let stream: fs.ReadStream | undefined;
  let mtimeMs = 0;
  let identity: { dev: string; ino: string };
  try {
    const metadata = fs.fstatSync(fd);
    if (!metadata.isFile()) throw new Error(`read_file: not a regular file: ${userPath}`);
    mtimeMs = metadata.mtimeMs;
    const opened = fs.fstatSync(fd, { bigint: true });
    identity = { dev: String(opened.dev), ino: String(opened.ino) };
    if (resolved.identity !== undefined) {
      if (
        String(opened.dev) !== resolved.identity.dev ||
        String(opened.ino) !== resolved.identity.ino ||
        String(opened.ctimeMs) !== resolved.identity.ctimeMs ||
        Number(opened.size) !== resolved.identity.size
      ) {
        throw new Error(`read_file: path changed after it was resolved: ${userPath}`);
      }
    }
    // Host adaptation of GIr, sfn1dbxq UTF-16 [3546500,3549105): mtime alone aliases replaced inodes.
    if (unchanged && Math.floor(metadata.mtimeMs) === unchanged.timestamp &&
        identity.dev === unchanged.identity.dev && identity.ino === unchanged.identity.ino) {
      return { unchanged: true };
    }
    stream = fs.createReadStream("", {
      fd,
      encoding: "utf8",
      highWaterMark: READ_STREAM_HIGH_WATER,
    });
    for await (const raw of stream as AsyncIterable<Buffer | string>) {
      if (signal.aborted) throw abortError();
      const chunk = typeof raw === "string" ? raw : raw.toString("utf8");
      let cursor = 0;
      while (true) {
        const nl = chunk.indexOf("\n", cursor);
        const seg = nl === -1 ? chunk.slice(cursor) : chunk.slice(cursor, nl);
        const inWindow = lineNo >= offset && lineNo <= endLine;
        if (inWindow) {
          const room = maxBytes - windowChars;
          if (seg.length > room) {
            current += room > 0 ? seg.slice(0, room) : "";
            capped = true;
            lines.push(current);
            current = "";
            finished = true;
            break;
          }
          current += seg;
          windowChars += seg.length;
        }
        if (nl === -1) break;
        if (inWindow) {
          lines.push(current);
          current = "";
          if (lineNo === endLine) {
            finished = true;
            break;
          }
        }
        lineNo += 1;
        cursor = nl + 1;
      }
      if (finished) break;
    }
    if (!finished && lineNo >= offset && lineNo <= endLine) {
      lines.push(current);
    }
  } finally {
    // The stream owns the descriptor once it is built; only the path where the
    // identity check threw before that leaves it to be closed here.
    if (stream !== undefined) stream.destroy();
    else fs.closeSync(fd);
  }

  const joined = lines.join("\n");
  if (capped) {
    const buf = Buffer.from(joined, "utf8");
    const end = utf8PrefixEnd(buf, maxBytes);
    return { content: `${buf.subarray(0, end).toString("utf8")}\n[read_file: output truncated; file continues]`, mtimeMs, truncated: true, identity };
  }
  const content = truncateHead(joined, maxBytes, "read_file");
  return { content, mtimeMs, truncated: content !== joined, identity };
}

// ---------------------------------------------------------------------------
// Input schemas (strict)
// ---------------------------------------------------------------------------

const readFileSchema = z
  .object({
    path: z.string().min(1),
    offset: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(READ_MAX_LIMIT).optional(),
  })
  .strict();

const listFilesSchema = z
  .object({
    path: z.string().min(1).optional(),
    glob: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(LIST_MAX_LIMIT).optional(),
  })
  .strict();

const searchSchema = z
  .object({
    pattern: z.string().min(1),
    path: z.string().min(1).optional(),
    regex: z.boolean().optional(),
    limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT).optional(),
  })
  .strict();

const writeFileSchema = directoryWriteInputSchema;
const approvedMutationInputs = new WeakSet<object>();
const builtinEdits = new WeakSet<ToolDefinition>();
const selectedEdits = new WeakMap<object, { tool: ToolDefinition; execute: ToolDefinition['execute'] }>();

// Kt, hwpb27as [121053,123737), half-open UTF-16. The selected implementation
// survives permission checks. Both host edit adapters expose only execute.
function editExecutor(tool: ToolDefinition): ToolDefinition['execute'] {
  const method = Object.getOwnPropertyDescriptor(tool, 'execute');
  if (Object.getPrototypeOf(tool) !== Object.prototype || 'executeBlocks' in tool ||
      !method || typeof method.value !== 'function')
    throw new Error('Built-in edit implementation changed');
  return method.value;
}

function checkedEditExecutor(tool: ToolDefinition, input: unknown): ToolDefinition['execute'] {
  const execute = editExecutor(tool);
  if (input && typeof input === 'object' && approvedMutationInputs.has(input)) {
    const selected = selectedEdits.get(input);
    if (selected?.tool !== tool || selected.execute !== execute) throw new Error('Built-in edit implementation changed');
  }
  return execute;
}

export function registerBuiltinEdit(tool: ToolDefinition): ToolDefinition {
  builtinEdits.add(tool);
  return tool;
}

// m_t/_Wo, sfn1dbxq [504681,505531)/[2237279,2239655), UTF-16.
// Both edit schemas contain scalar fields. Compare the actual parser output
// to the selected permission input before resolving any target.
export function verifyApprovedEditInput(input: unknown, parsed: Record<string, unknown>): void {
  if (!input || typeof input !== 'object' || !approvedMutationInputs.has(input)) return;
  const fields = Object.getOwnPropertyDescriptors(input);
  if (Object.keys(fields).length !== Object.keys(parsed).length ||
      Object.entries(parsed).some(([key,value]) => !Object.hasOwn(fields,key) || fields[key]?.value !== value))
    throw new Error('Built-in edit input changed after permission checking');
}
type ChildToolAuthorization = (input: unknown, context: ToolContext) => Promise<ToolContext>;
const scopedChildMutations = new WeakMap<ToolDefinition, { tool: ToolDefinition; authorize: ChildToolAuthorization }>();

// Kt [121053,123737), _Wo [2237279,2239655), half-open UTF-16. Keep the
// checked input while the child supplies its narrower execution context.
export function bindScopedChildTool(tool: ToolDefinition, checkPermission: ChildToolAuthorization,
    lookup: 'before-approval' | 'after-approval' = 'before-approval'): ToolDefinition {
  if (builtinEdits.has(tool)) editExecutor(tool);
  const implementation = snapshotToolImplementation(tool);
  const mutation = builtinEdits.has(tool) || builtinWriteExecutors.has(tool) || runtimeBuiltinWrites.has(tool) || scopedChildMutations.has(tool);
  const authorize = mutation ? withChildDirectoryGrant(checkPermission) : checkPermission;
  const scoped: ToolDefinition = { ...tool,
    async execute(value, context) {
      const input = snapshotBuiltinMutationInput(tool, value);
      if (builtinEdits.has(tool)) {
        const approved = await authorize(input, context);
        return checkedEditExecutor(tool, input).call(tool, input, approved);
      }
      if (lookup === 'after-approval') {
        const approved = await authorize(input, context);
        assertToolImplementation(tool, implementation);
        return tool.execute(input, approved);
      }
      const approved = await authorize(input, context);
      assertToolImplementation(tool, implementation);
      return tool.execute(input, approved);
    },
    ...(tool.executeBlocks ? { async executeBlocks(value: unknown, context: ToolContext) {
      const input = snapshotBuiltinMutationInput(tool, value);
      if (lookup === 'after-approval') {
        const approved = await authorize(input, context);
        assertToolImplementation(tool, implementation);
        return tool.executeBlocks!(input, approved);
      }
      const approved = await authorize(input, context);
      assertToolImplementation(tool, implementation);
      return tool.executeBlocks!(input, approved);
    } } : {}),
  };
  if (mutation) {
    scopedChildMutations.set(scoped, { tool, authorize });
    Object.freeze(scoped);
  }
  return scoped;
}

function withChildDirectoryGrant(authorize: ChildToolAuthorization): ChildToolAuthorization {
  return async (checked, context) => {
    // Kt [121053,123737), UTF-16: a location change during permission
    // checking requires a new call. Compare the actual directory grant.
    const file = (checked as { path?: unknown }).path;
    const target = typeof file === 'string' ? path.resolve(context.workspace, file) : undefined;
    const external = target && !isWithin(context.workspace, target) ? target : undefined;
    const grantFor = (ctx: ToolContext, destination: string) => {
      const directories = ctx.workingDirectories?.(false);
      const root = directories?.filter(root => isWithin(root, destination)).sort((a, b) => b.length - a.length)[0];
      return root ? directories?.readHandle?.(root) : undefined;
    };
    const grant = external ? grantFor(context, external) : undefined;
    const childContext = await authorize(checked, context);
    if (external && (grant?.signal.aborted || grant !== grantFor(childContext, external)))
      throw new Error('Write directory grant changed during child approval');
    return childContext;
  };
}
const rawWriteDispatch = new WeakMap<object, { tool: ToolDefinition; handler: ToolDefinition['execute'] | NonNullable<ToolDefinition['executeBlocks']> }>();

// Kt, hwpb27as [121053,123737), UTF-16: capture the factory on construction
// and check execution location at dispatch. The raw host adapter selects one of two methods.
function rawWriteHandler(tool: ToolDefinition) {
  const blocks = Object.getOwnPropertyDescriptor(tool, 'executeBlocks');
  const execute = Object.getOwnPropertyDescriptor(tool, 'execute');
  if (Object.getPrototypeOf(tool) !== Object.prototype || (blocks && !('value' in blocks)) ||
      (!blocks && 'executeBlocks' in tool) || !execute || !('value' in execute))
    throw new Error('Runtime built-in write_file implementation changed');
  const handler = blocks?.value ?? execute.value;
  if (typeof handler !== 'function') throw new Error('Runtime built-in write_file implementation changed');
  return handler as ToolDefinition['execute'] | NonNullable<ToolDefinition['executeBlocks']>;
}

// Kt [121053,123737), m_t/_Wo [504681,505531)/[2237279,2239655),
// half-open UTF-16. Rewritten inputs pass through permission checks again.
// Pin scalar arguments for the built-in file mutations across awaited callbacks.
export function snapshotBuiltinMutationInput(tool: ToolDefinition, input: unknown): unknown {
  const scoped = scopedChildMutations.get(tool);
  if (scoped) return snapshotBuiltinMutationInput(scoped.tool, input);
  if (!builtinEdits.has(tool) && !builtinWriteExecutors.has(tool) && !runtimeBuiltinWrites.has(tool)) return input;
  const invalid = builtinEdits.has(tool) ? 'Invalid built-in edit input' : 'Invalid built-in Write input';
  if (!input || typeof input !== 'object' || utilTypes.isProxy(input)) throw new Error(invalid);
  if (approvedMutationInputs.has(input)) return input;
  const proto = Object.getPrototypeOf(input);
  if (proto !== Object.prototype && proto !== null) throw new Error(invalid);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Object.values(descriptors).some(field => !('value' in field))) throw new Error(invalid);
  const value = Object.freeze(Object.create(null, descriptors));
  if (builtinEdits.has(tool)) selectedEdits.set(value, { tool, execute: editExecutor(tool) });
  if (builtinWriteExecutors.has(tool)) rawWriteDispatch.set(value, { tool, handler: rawWriteHandler(tool) });
  approvedMutationInputs.add(value);
  return value;
}

const runCommandSchema = z
  .object({
    command: z.string().min(1),
    timeout_ms: z.number().int().min(1).max(COMMAND_MAX_TIMEOUT_MS).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// run_command implementation
// ---------------------------------------------------------------------------

function runShell(
  command: string,
  cwd: string,
  timeoutMs: number,
  maxBytes: number,
  signal: AbortSignal,
  onProgress?: (progress: ShellProgress) => void,
  shellHome?: { value: string | undefined },
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    let child: ChildProcess;
    try {
      child = spawn("/bin/sh", ["-c", command], {
        cwd,
        env: shellHome === undefined ? process.env : { ...process.env, HOME: shellHome.value },
        detached: true, // own process group so the whole tree can be killed
        stdio: ["ignore", "pipe", "pipe"], // stdin ignored
      });
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;
    let timedOut = false;
    let aborted = false;
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;
    let totalBytes = 0;
    let tail: Buffer = Buffer.alloc(0);
    let totalLines = 0;

    // Source `Czr` (chunk-sfn1dbxq.js 4340642) polls the shell's own output every `hOn` = 2000 ms
    // (chunk-sfn1dbxq.js 4322055) and yields one `bash_progress` frame per poll. The host has no
    // task-output store to poll, so the row is fed from the pipe instead: the same snapshot shape,
    // taken on the source's own cadence rather than on every chunk.
    const started = Date.now();
    const emitProgress = () => {
      if (onProgress === undefined) return;
      onProgress({ output: tail.toString("utf8"), fullOutput: tail.toString("utf8"),
        elapsedTimeSeconds: Math.floor((Date.now() - started) / 1000), totalLines, totalBytes,
        ...(timeoutMs > 0 ? { timeoutMs } : {}) });
    };
    const progressTimer = onProgress === undefined ? undefined : setInterval(emitProgress, SHELL_PROGRESS_INTERVAL_MS);

    const append = (chunk: Buffer) => {
      totalBytes += chunk.length;
      for (let at = chunk.indexOf(0x0a); at !== -1; at = chunk.indexOf(0x0a, at + 1)) totalLines += 1;
      tail = tail.length === 0 ? chunk : Buffer.concat([tail, chunk]);
      if (tail.length > maxBytes) tail = tail.subarray(tail.length - maxBytes);
    };

    const killGroup = () => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }
    };

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            killGroup();
          }, timeoutMs)
        : undefined;
    const onAbort = () => {
      aborted = true;
      killGroup();
    };
    let grace: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (grace) clearTimeout(grace);
      if (progressTimer !== undefined) clearInterval(progressTimer);
      signal.removeEventListener("abort", onAbort);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      let note: string;
      if (timedOut) note = `[run_command: timed out after ${timeoutMs}ms; process group killed]`;
      else if (aborted) note = "[run_command: aborted; process group killed]";
      else {
        note = `[run_command: exit code ${exitCode ?? "null"}${
          exitSignal ? `, signal ${exitSignal}` : ""
        }]`;
      }
      const start = utf8SuffixStart(tail, maxBytes);
      const body = tail.subarray(start).toString("utf8");
      const prefix =
        totalBytes > maxBytes
          ? `[run_command: output truncated; showing last ${maxBytes} of ${totalBytes} bytes]\n`
          : "";
      resolve(`${prefix}${body}\n${note}`);
    };

    signal.addEventListener("abort", onAbort, { once: true });

    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    child.on("exit", (code, signalCode) => {
      // The shell itself has exited. Detached descendants may still hold the
      // stdout/stderr pipes open (or keep running with redirected output), so
      // the parent's completion must not wait on them: stop the whole process
      // group now and bound how long we wait for the pipes to drain.
      exitCode = code;
      exitSignal = signalCode;
      if (timer) clearTimeout(timer);
      killGroup();
      grace = setTimeout(() => {
        try {
          child.stdout?.destroy();
        } catch {
          /* ignore */
        }
        try {
          child.stderr?.destroy();
        } catch {
          /* ignore */
        }
        finish();
      }, SHELL_PIPE_GRACE_MS);
    });
    child.on("close", () => finish());
  });
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const builtinReadFiles = new WeakMap<ToolDefinition, { execute: ToolDefinition['execute']; schema: string }>();
const builtinWriteExecutors = new WeakMap<ToolDefinition, ToolDefinition['execute']>();
type ToolSnapshot = { prototype: object | null; properties: { key: string | symbol; descriptor: PropertyDescriptor }[]; schema: string };
const builtinWriteSnapshots = new WeakMap<ToolDefinition, ToolSnapshot>();
const runtimeBuiltinWrites = new WeakMap<ToolDefinition, { execute: ToolDefinition['execute']; original: ToolDefinition;
  originalSnapshot?: ToolSnapshot; wrapperSnapshot?: ToolSnapshot }>();
// Host execution evidence for Kt/uno/KWo, hwpb27as [121053,123737),
// sfn1dbxq [739599,743280)/[2292400,2294250), UTF-16; source has no journal capability.
export type BuiltinWriteExecutionAuthorization = object;
type BuiltinWriteExecution = { input: z.infer<typeof directoryWriteInputSchema> } &
  ({ phase: 'entered' } | { phase: 'completed'; outcome: 'returned' | 'threw' | 'blocked-additional-directory' });
type BuiltinWriteInvocation = { tool: ToolDefinition; input: unknown; context: ToolContext;
  state: { phase: 'dispatched' } | { phase: 'entered' | 'completed'; input: z.infer<typeof directoryWriteInputSchema> };
  observe(authorization: BuiltinWriteExecutionAuthorization): void };
const builtinWriteInvocations = new WeakMap<ToolContext, BuiltinWriteInvocation>();
const builtinWriteObservations = new WeakMap<BuiltinWriteExecutionAuthorization, { invocation: BuiltinWriteInvocation; event: BuiltinWriteExecution }>();
const blockedDirectoryWrites = new WeakSet<Error>();

function observeBuiltinWrite(invocation: BuiltinWriteInvocation, event: BuiltinWriteExecution): void {
  if (event.phase === 'entered' ? invocation.state.phase !== 'dispatched' : invocation.state.phase !== 'entered')
    throw new Error('Runtime Write execution phase changed');
  const authorization = {};
  builtinWriteObservations.set(authorization, { invocation, event });
  try { invocation.observe(authorization); invocation.state = { phase: event.phase, input: Object.freeze({ ...event.input }) }; }
  finally { builtinWriteObservations.delete(authorization); }
}

export function consumeBuiltinWriteExecution(authorization: BuiltinWriteExecutionAuthorization, tool: ToolDefinition,
    input: unknown, context: ToolContext): BuiltinWriteExecution | undefined {
  const saved = builtinWriteObservations.get(authorization);
  builtinWriteObservations.delete(authorization);
  if (!saved || saved.invocation !== builtinWriteInvocations.get(context) || saved.invocation.tool !== tool ||
      saved.invocation.input !== input || saved.invocation.context !== context) return;
  return structuredClone(saved.event);
}

type WrapperInvocation = { tool: ToolDefinition; input: unknown; context: ToolContext; observe(authorization: object): void };
const wrapperInvocations = new WeakMap<ToolContext, WrapperInvocation>();
const wrapperObservations = new WeakMap<object, { invocation: WrapperInvocation; event: WrapperObservation }>();
export function consumeRuntimeWrapperObservation(authorization: object, tool: ToolDefinition, input: unknown,
    context: ToolContext): WrapperObservation | undefined {
  const saved = wrapperObservations.get(authorization); wrapperObservations.delete(authorization);
  if (!saved || saved.invocation.tool !== tool || saved.invocation.input !== input || saved.invocation.context !== context) return;
  return structuredClone(saved.event);
}

function observeRuntimeCheck(tool: ToolDefinition, input: unknown, context: ToolContext,
    method: WrapperObservation['method'], stage: WrapperObservation['stage'], invoke: () => unknown): void {
  const invocation = wrapperInvocations.get(context);
  if (!invocation || invocation.tool !== tool || invocation.input !== input) { invoke(); return; }
  const invocationId = crypto.randomUUID();
  const record = (transition: WrapperTransition) => {
    const authorization = {};
    wrapperObservations.set(authorization, { invocation, event: { invocationId, method, stage, transition } });
    try { invocation.observe(authorization); } finally { wrapperObservations.delete(authorization); }
  };
  // Admission also covers callback property selection, including supplied getters.
  record({ phase: 'admitted' });
  let returned: unknown;
  try { returned = invoke(); } catch (error) { record({ phase: 'threw' }); throw error; }
  if (!utilTypes.isPromise(returned)) { record({ phase: 'returned', mode: 'sync' }); return; }
  let failed = false, failure: unknown;
  try { record({ phase: 'returned', mode: 'promise' }); } catch (error) { failed = true; failure = error; }
  const settle = (outcome: 'fulfilled' | 'rejected') => {
    if (!failed) try { record({ phase: 'settled', outcome }); } catch { /* Original journal retains uncertainty. */ }
  };
  try { Promise.prototype.then.call(returned, () => settle('fulfilled'), () => settle('rejected')); }
  catch { if (!failed) record({ phase: 'unobserved' }); }
  if (failed) throw failure;
}

export function bindRuntimeTool(tool: ToolDefinition, checks: {
  checkScope(): void;
  refresh(): void;
  checkJournal(tool: ToolDefinition): void;
}): ToolDefinition {
  let child: ToolDefinition | undefined;
  const implementation = snapshotToolImplementation(tool);
  const builtinWrite = builtinWriteExecutors.get(tool);
  const edit = builtinEdits.has(tool) ? editExecutor(tool) : undefined;
  const wrapped: ToolDefinition = { ...tool,
    async execute(input, context) {
      context.signal.throwIfAborted();
      observeRuntimeCheck(wrapped, input, context, 'execute', 'checkScope', () => checks.checkScope());
      observeRuntimeCheck(wrapped, input, context, 'execute', 'refresh', () => checks.refresh());
      observeRuntimeCheck(wrapped, input, context, 'execute', 'checkJournal', () => checks.checkJournal(tool));
      // Host wrapper guard: Kt, hwpb27as [121053,123737), UTF-16 has no mutable refresh callback.
      if (builtinWrite) {
        const execute = Object.getOwnPropertyDescriptor(tool, 'execute');
        if (!execute || !('value' in execute) || execute.value !== builtinWrite)
          throw new Error('Runtime built-in write_file implementation changed');
        const invocation = builtinWriteInvocations.get(context);
        const observed = invocation?.tool === wrapped && invocation.input === input ? invocation : undefined;
        let result: string;
        try { result = await builtinWrite.call(tool, input, context); }
        catch (error) {
          if (observed && observed.state.phase === 'entered') observeBuiltinWrite(observed, { phase: 'completed', input: observed.state.input, outcome:
            error instanceof Error && blockedDirectoryWrites.has(error) ? 'blocked-additional-directory' : 'threw' });
          throw error;
        }
        if (observed && observed.state.phase === 'entered') observeBuiltinWrite(observed, { phase: 'completed', input: observed.state.input, outcome: 'returned' });
        return result;
      }
      if (edit) {
        if (editExecutor(tool) !== edit) throw new Error('Built-in edit implementation changed');
        return edit.call(tool, input, context);
      }
      assertToolImplementation(tool, implementation);
      return tool.execute(input, context);
    },
    ...(tool.executeBlocks ? { async executeBlocks(input: unknown, context: ToolContext) {
      context.signal.throwIfAborted();
      observeRuntimeCheck(wrapped, input, context, 'executeBlocks', 'checkScope', () => checks.checkScope());
      observeRuntimeCheck(wrapped, input, context, 'executeBlocks', 'checkJournal', () => checks.checkJournal(tool));
      assertToolImplementation(tool, implementation);
      return tool.executeBlocks!(input, context);
    } } : {}),
    ...(tool.forChild ? { forChild() { checks.checkScope(); return child ??= bindRuntimeTool(tool.forChild!(), checks); } } : {}),
  };
  if (builtinWrite) runtimeBuiltinWrites.set(wrapped, { execute: wrapped.execute, original: tool,
    originalSnapshot: builtinWriteSnapshots.get(tool), wrapperSnapshot: snapshotTool(wrapped) });
  return builtinEdits.has(tool) ? registerBuiltinEdit(wrapped) : wrapped;
}

// Host dispatch guard: Kt/KWo, hwpb27as [121053,123737), sfn1dbxq [2275902,2308030), UTF-16.
export async function executeAgentTool(tool: ToolDefinition, input: unknown, context: ToolContext,
    observe?: (authorization: BuiltinWriteExecutionAuthorization) => void,
    wrapperObserver?: ((authorization: object) => void) | {
      forTool(tool: ToolDefinition, context: ToolContext): (authorization: object) => void;
    }, implementation?: ToolImplementationSnapshot): Promise<Anthropic.ToolResultBlockParam['content']> {
  const scoped = scopedChildMutations.get(tool);
  if (scoped) {
    const checked = snapshotBuiltinMutationInput(scoped.tool, input);
    const childContext = await scoped.authorize(checked, context);
    return executeAgentTool(scoped.tool, checked, childContext, observe, wrapperObserver);
  }
  if (wrapperInvocations.has(context)) throw new Error('Runtime wrapper invocation already active');
  const observeWrapper = typeof wrapperObserver === 'function' ? wrapperObserver : wrapperObserver?.forTool(tool, context);
  if (observeWrapper) wrapperInvocations.set(context, { tool, input, context, observe: observeWrapper });
  try { return await executeAgentToolBody(tool, input, context, observe, implementation); }
  finally { wrapperInvocations.delete(context); }
}

async function executeAgentToolBody(tool: ToolDefinition, input: unknown, context: ToolContext,
    observe?: (authorization: BuiltinWriteExecutionAuthorization) => void,
    implementation?: ToolImplementationSnapshot): Promise<Anthropic.ToolResultBlockParam['content']> {
  const builtinWrite = runtimeBuiltinWrites.get(tool);
  if (builtinEdits.has(tool)) return checkedEditExecutor(tool, input).call(tool, input, context);
  if (builtinWriteExecutors.has(tool) && input && typeof input === 'object' && approvedMutationInputs.has(input)) {
    const selected = rawWriteDispatch.get(input);
    if (selected?.tool !== tool || selected.handler !== rawWriteHandler(tool))
      throw new Error('Runtime built-in write_file implementation changed');
    return selected.handler.call(tool, input, context);
  }
  if (!builtinWrite) {
    assertToolImplementation(tool, implementation);
    return tool.executeBlocks ? tool.executeBlocks(input, context) : tool.execute(input, context);
  }
  const execute = Object.getOwnPropertyDescriptor(tool, 'execute');
  if (!execute || !('value' in execute) || execute.value !== builtinWrite.execute ||
      Object.getOwnPropertyDescriptor(tool, 'executeBlocks') !== undefined || Object.getPrototypeOf(tool) !== Object.prototype)
    throw new Error('Runtime built-in write_file wrapper changed');
  if (!observe) return builtinWrite.execute.call(tool, input, context);
  if (builtinWriteInvocations.has(context)) throw new Error('Runtime Write invocation already active');
  const invocation: BuiltinWriteInvocation = { tool, input, context, observe, state: { phase: 'dispatched' } };
  builtinWriteInvocations.set(context, invocation);
  try { return await builtinWrite.execute.call(tool, input, context); }
  finally { builtinWriteInvocations.delete(context); }
}

function snapshotTool(tool: ToolDefinition): ToolSnapshot | undefined {
  try {
    if (utilTypes.isProxy(tool)) return;
    const properties = Reflect.ownKeys(tool).map(key => ({ key, descriptor: Object.getOwnPropertyDescriptor(tool, key) }));
    if (properties.some(item => !item.descriptor)) return;
    const schema = Object.getOwnPropertyDescriptor(tool, 'schema');
    if (!schema || !('value' in schema)) return;
    return { prototype: Object.getPrototypeOf(tool), properties: properties.map(item => ({ key: item.key, descriptor: item.descriptor! })),
      schema: JSON.stringify(inertSchema(schema.value)) };
  } catch { return; }
}

type ToolImplementationSnapshot = { prototype: object | null; execute: PropertyDescriptor; executeBlocks?: PropertyDescriptor };

// Kt [121053,123737), UTF-16: the source binds one implementation instance to
// its host. The host keeps the ToolDefinition reference across awaited hooks;
// capture the selected handler at authorization and refuse a later replacement.
export function snapshotToolImplementation(tool: ToolDefinition): ToolImplementationSnapshot | undefined {
  try {
    if (utilTypes.isProxy(tool)) return;
    const execute = Object.getOwnPropertyDescriptor(tool, 'execute');
    const blocks = Object.getOwnPropertyDescriptor(tool, 'executeBlocks');
    if (!execute || !('value' in execute) || typeof execute.value !== 'function') return;
    if (blocks && !('value' in blocks)) return;
    return { prototype: Object.getPrototypeOf(tool), execute, ...(blocks ? { executeBlocks: blocks } : {}) };
  } catch { return; }
}

export function assertToolImplementation(tool: ToolDefinition, snapshot: ToolImplementationSnapshot | undefined): void {
  if (snapshot === undefined) return;
  let changed = true;
  try {
    const execute = Object.getOwnPropertyDescriptor(tool, 'execute');
    const blocks = Object.getOwnPropertyDescriptor(tool, 'executeBlocks');
    changed = utilTypes.isProxy(tool) || Object.getPrototypeOf(tool) !== snapshot.prototype ||
      !execute || !('value' in execute) || execute.value !== snapshot.execute.value ||
      (blocks === undefined) !== (snapshot.executeBlocks === undefined) ||
      (blocks !== undefined && snapshot.executeBlocks !== undefined && blocks.value !== snapshot.executeBlocks.value);
  } catch { changed = true; }
  if (changed) throw new Error('Tool implementation changed after authorization');
}

function matchesToolSnapshot(tool: ToolDefinition, saved: ToolSnapshot | undefined): boolean {
  if (!saved || utilTypes.isProxy(tool)) return false;
  try {
    const current = snapshotTool(tool);
    return !!current && current.prototype === Object.prototype && current.prototype === saved.prototype && current.schema === saved.schema &&
      current.properties.length === saved.properties.length && saved.properties.every(({ key, descriptor }) => {
        const found = current.properties.find(item => item.key === key)?.descriptor;
        return !!found && found.value === descriptor.value && found.get === descriptor.get && found.set === descriptor.set &&
          found.enumerable === descriptor.enumerable && found.configurable === descriptor.configurable && found.writable === descriptor.writable;
      });
  } catch { return false; }
}

export function isRuntimeBuiltinWrite(tool: ToolDefinition): boolean {
  const saved = runtimeBuiltinWrites.get(tool);
  return !!saved && matchesToolSnapshot(tool, saved.wrapperSnapshot) && matchesToolSnapshot(saved.original, saved.originalSnapshot);
}

function inertSchema(value: unknown, seen = new Set<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    throw new Error('Unsupported schema value');
  }
  if (utilTypes.isProxy(value) || seen.has(value)) throw new Error('Unsupported schema object');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) throw new Error('Unsupported schema prototype');
  seen.add(value);
  const copy: Record<string, unknown> | unknown[] = Array.isArray(value) ? [] : Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Unsupported schema property');
    Object.defineProperty(copy, key, { value: inertSchema(descriptor.value, seen), enumerable: true, configurable: true });
  }
  seen.delete(value);
  return copy;
}

// Runtime wrappers remain outside the unconnected trusted-read contract.
export function isBuiltinReadFile(tool: ToolDefinition): boolean {
  const original = builtinReadFiles.get(tool);
  try {
    if (!original || utilTypes.isProxy(tool)) return false;
    const execute = Object.getOwnPropertyDescriptor(tool, 'execute');
    const schema = Object.getOwnPropertyDescriptor(tool, 'schema');
    const readOnly = Object.getOwnPropertyDescriptor(tool, 'readOnly');
    if (!execute || !('value' in execute) || execute.value !== original.execute ||
        !schema || !('value' in schema) || !readOnly || !('value' in readOnly) || readOnly.value !== true ||
        Object.getOwnPropertyDescriptor(tool, 'readPaths') !== undefined ||
        Object.getOwnPropertyDescriptor(tool, 'executeBlocks') !== undefined ||
        Object.getOwnPropertyDescriptor(tool, 'forChild') !== undefined || Object.getPrototypeOf(tool) !== Object.prototype) return false;
    return JSON.stringify(inertSchema(schema.value)) === original.schema;
  } catch { return false; }
}

function readFileTool(): ToolDefinition {
  const tool: ToolDefinition = {
    readOnly: true,
    schema: {
      name: "read_file",
      description:
        "Read a UTF-8 text file inside the agent workspace. Lines are 1-based; " +
        "`offset` selects the first line and `limit` the maximum number of lines " +
        "returned (default " +
        READ_DEFAULT_LIMIT +
        ", max " +
        READ_MAX_LIMIT +
        "). Paths are workspace-relative and confined to the workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file, relative to the workspace." },
          offset: { type: "integer", minimum: 1, description: "First line to return (1-based)." },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: READ_MAX_LIMIT,
            description: "Maximum number of lines to return.",
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { path: userPath, offset = 1, limit = READ_DEFAULT_LIMIT } = readFileSchema.parse(input);
      const root = workspaceReal(context.workspace);
      // fl/c_, 2bcyxj9q [205509,205734)/[235473,238027), UTF-16: admit only the designated plan path.
      // Xce, 2bcyxj9q [242279,243972), UTF-16: the current root's result store is readable.
      const results = skillResultsDirectory(context.session);
      const directories: WorkingDirectories = context.workingDirectories?.(true) ?? [];
      // eNe/Yg and Xce, 2bcyxj9q [214841,215541)/[242279,243972), UTF-16.
      // Preserve the grant owner's observations when adding the separate result-store exception.
      const readDirectories = results ? [...directories, results] : directories;
      if (results) Object.defineProperty(readDirectories, 'rootSpellings', { value: [
        ...(directories.rootSpellings ?? directories.flatMap(directory => observeWorkingDirectory(root, directory))),
        ...observeWorkingDirectory(root, results),
      ] });
      const resolved = (context.planMode && resolveOwnedPlanFile(root, userPath, context.planMode.ownership, true))
        || confineResolved(root, userPath, true, readDirectories);
      if (context.readApproval && resolved.path !== context.readApproval.landing)
        throw new Error('read_file: read approval changed');
      const requested = path.resolve(root, userPath);
      const grant = [...directories].filter(directory => isWithin(directory, requested))
        .sort((a, b) => b.length - a.length)[0];
      if (!grant && directories.readHandle && !isWithin(root, resolved.path) &&
          (!results || !isWithin(results, resolved.path)) &&
          (directories.rootSpellings ?? []).some(spelling => isWithin(spelling, resolved.path))) {
        throw new Error('read_file: directory grant spelling has no bound handle');
      }
      const owned = grant && directories.readHandle ? directories.readHandle(grant) : undefined;
      if (grant && directories.readHandle && !owned) throw new Error('read_file: directory grant is no longer available');
      if (owned) context.readGrantSignal?.(owned.signal);
      const verified = context.verifiedReadDirectory ?? owned;
      const relative = verified ? path.relative(verified.root, path.resolve(root, userPath)) : undefined;
      if (verified && (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))) {
        throw new Error('read_file: path outside verified directory');
      }
      const directory = verified && relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
        ? { fd: verified.fd, relative } : undefined;
      // Host FD witness: source eNe/Yg, chunk-2bcyxj9q [214841,215541), UTF-16, retains paths only.
      if (directory && owned && verified === owned) context.readGrantWitness?.({ owner: owned.owner, incarnation: owned.incarnation });
      // GIr, sfn1dbxq [3546500,3549105), UTF-16: only an identical visible, nonpartial view can be reused.
      const cacheKey = path.resolve(root, userPath);
      const previous = context.readFileCache?.get(cacheKey);
      const unchanged = previous && previous.identity && previous.realPath === resolved.path && !previous.isPartialView && !previous.contentNotInModelContext &&
        previous.offset === offset && previous.limit === limit ? { timestamp: previous.timestamp, identity: previous.identity } : undefined;
      const readSignal = owned ? AbortSignal.any([context.signal, owned.signal]) : context.signal;
      // Approval-to-use revalidation belongs immediately before the open, after the
      // path resolution, so the window between the policy check and the read is minimal.
      const consumer = context.readHandleConsumer;
      if (consumer && !directory) {
        if (!(await consumer.check({ path: userPath }))) throw new Error('read_file: read approval changed');
        // The approved-handle reader opens the captured identity, so a retarget after
        // the check cannot substitute another file. Directory-grant reads keep the
        // descriptor-bound readFileLines path below.
        const read = await consumer.readLinesWithMetadata(offset, limit, maxBytesFor(context));
        if (unchanged && Math.floor(read.mtimeMs) === unchanged.timestamp &&
            read.identity.dev === unchanged.identity.dev && read.identity.ino === unchanged.identity.ino)
          return 'Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead.';
        context.readFileCache?.set(cacheKey, { content: read.content, timestamp: Math.floor(read.mtimeMs),
          offset, limit, identity: read.identity, realPath: resolved.path, isPartialView: read.truncated, contentNotInModelContext: true });
        context.hostResult?.({ kind: 'file_read', filePath: resolved.path, cacheKey, content: read.content,
          mtimeMs: read.mtimeMs, identity: read.identity, offset, limit, truncated: read.truncated });
        return read.content;
      }
      if (consumer && !(await consumer.check({ path: userPath }))) throw new Error('read_file: read approval changed');
      const read = await readFileLines(resolved, userPath, offset, limit, maxBytesFor(context), readSignal, unchanged, directory);
      readSignal.throwIfAborted();
      if ('unchanged' in read) return 'Wasted call — file unchanged since your last Read. Refer to that earlier tool_result instead.';
      // QIr, sfn1dbxq [3559220,3562500), UTF-16: retain the descriptor-bound view.
      context.readFileCache?.set(cacheKey, { content: read.content, timestamp: Math.floor(read.mtimeMs),
        offset, limit, identity: read.identity, realPath: resolved.path, isPartialView: read.truncated || !!read.incomplete, contentNotInModelContext: true });
      context.hostResult?.({ kind: 'file_read', filePath: resolved.path, cacheKey, content: read.content,
        mtimeMs: read.mtimeMs, identity: read.identity, offset, limit, truncated: read.truncated || !!read.incomplete });
      return read.content;
    },
  };
  builtinReadFiles.set(tool, { execute: tool.execute, schema: JSON.stringify(tool.schema) });
  return tool;
}

function listFilesTool(): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "list_files",
      description:
        "List files inside the agent workspace using ripgrep (`rg --files`). " +
        "Hidden files are included; the reserved `.agent` directory is always " +
        "excluded (its exclusion cannot be overridden by `glob`). `path` is a " +
        "directory (default the workspace root) and `glob` is an optional " +
        "ripgrep glob filter. Returned paths are workspace-relative; at most " +
        "`limit` files (default " +
        LIST_DEFAULT_LIMIT +
        ", max " +
        LIST_MAX_LIMIT +
        ") are returned.",
      input_schema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Directory to list, relative to the workspace. Defaults to `.`.",
          },
          glob: { type: "string", description: "Optional ripgrep glob filter, e.g. `*.ts`." },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: LIST_MAX_LIMIT,
            description: "Maximum number of paths to return.",
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { path: userPath = ".", glob, limit = LIST_DEFAULT_LIMIT } = listFilesSchema.parse(input);
      const root = workspaceReal(context.workspace);
      const real = confine(root, userPath, true, context.workingDirectories?.(true));
      if (context.readApproval && real !== context.readApproval.landing)
        throw new Error('list_files: read approval changed');
      const relTarget = path.relative(root, real) || ".";
      const args = ["--files", "--color=never", "--hidden"];
      if (glob) args.push("--glob", glob);
      // Exclusions are pushed last so a caller `glob` cannot re-include the
      // reserved `.agent` directory (ripgrep lets the last matching glob win).
      args.push("--glob", "!.agent/**", "--glob", "!**/.agent/**", "--glob", "!.harness-worktrees/**", "--glob", "!**/.harness-worktrees/**");
      // `--` terminates options so a path named like a flag is never parsed as
      // one. The target is omitted for the workspace root so output stays
      // `path`-relative rather than `./path`.
      args.push("--");
      if (relTarget !== ".") args.push(relTarget);

      const result = await runBounded("rg", args, root, {
        maxBytes: maxBytesFor(context),
        maxLines: limit,
        signal: context.signal,
      });
      if (result.aborted) throw abortError();

      let lines: string[];
      let truncated = result.truncated;
      if (result.spawnError && result.spawnError.code === "ENOENT") {
        // ripgrep is unavailable: fall back to a bounded filesystem walk.
        const walked = await fallbackListFiles(root, real, glob, limit, context.signal);
        truncated = truncated || walked.truncated;
        lines = walked.entries;
      } else if (result.spawnError) {
        throw new Error(`list_files: failed to launch ripgrep: ${result.spawnError.message}`);
      } else {
        if (result.code !== null && result.code > 1) {
          throw new Error(`list_files: rg failed (${result.code}): ${result.stderr.trim()}`);
        }
        lines = result.stdout.split("\n").filter((line) => line.length > 0);
        if (lines.length > limit) {
          truncated = true;
          lines = lines.slice(0, limit);
        }
      }

      const body = truncateHead(lines.join("\n"), maxBytesFor(context), "list_files");
      return truncated ? `${body}\n[list_files: listing truncated at limit ${limit}]` : body;
    },
  };
}

function searchTool(): ToolDefinition {
  return {
    readOnly: true,
    schema: {
      name: "search",
      description:
        "Search file contents inside the agent workspace with ripgrep. The " +
        "`pattern` is a literal substring by default; set `regex: true` to treat " +
        "it as a regular expression. Hidden files are included; the reserved " +
        "`.agent` directory is always excluded. Matches are returned as " +
        "workspace-relative `path:line:text` records, capped at `limit` (default " +
        SEARCH_DEFAULT_LIMIT +
        ", max " +
        SEARCH_MAX_LIMIT +
        ").",
      input_schema: {
        type: "object",
        properties: {
          pattern: { type: "string", description: "Text or regular expression to search for." },
          path: {
            type: "string",
            description: "File or directory to search, relative to the workspace. Defaults to `.`.",
          },
          regex: { type: "boolean", description: "Treat `pattern` as a regular expression." },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: SEARCH_MAX_LIMIT,
            description: "Maximum number of matching lines to return.",
          },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const {
        pattern,
        path: userPath = ".",
        regex = false,
        limit = SEARCH_DEFAULT_LIMIT,
      } = searchSchema.parse(input);
      const root = workspaceReal(context.workspace);
      const real = confine(root, userPath, true, context.workingDirectories?.(true));
      if (context.readApproval && real !== context.readApproval.landing)
        throw new Error('search: read approval changed');
      const relTarget = path.relative(root, real) || ".";
      const args = ["--no-heading", "--color=never", "-n", "--hidden"];
      // `-e` always marks the pattern, even in literal mode, so a pattern that
      // begins with `-` is never parsed as an option.
      if (!regex) args.push("-F");
      args.push("-e", pattern);
      args.push("--glob", "!.agent/**", "--glob", "!**/.agent/**", "--glob", "!.harness-worktrees/**", "--glob", "!**/.harness-worktrees/**");
      // `--` terminates options before the target path.
      args.push("--");
      if (relTarget !== ".") args.push(relTarget);

      const result = await runBounded("rg", args, root, {
        maxBytes: maxBytesFor(context),
        maxLines: limit,
        signal: context.signal,
      });
      if (result.aborted) throw abortError();
      if (result.spawnError) {
        throw new Error(`search: failed to launch ripgrep: ${result.spawnError.message}`);
      }
      if (result.code !== null && result.code > 1) {
        throw new Error(`search: rg failed (${result.code}): ${result.stderr.trim()}`);
      }
      let lines = result.stdout.split("\n").filter((line) => line.length > 0);
      let truncated = result.truncated;
      if (lines.length > limit) {
        truncated = true;
        lines = lines.slice(0, limit);
      }
      const body = truncateHead(lines.join("\n"), maxBytesFor(context), "search");
      return truncated ? `${body}\n[search: results truncated at limit ${limit}]` : body;
    },
  };
}

// dno, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// [733986,734328), UTF-16. Shared source-backed pre-write guard; callers own file observation.
function checkWriteReadState(context: ToolContext, file: Pick<ResolvedPath, 'path' | 'identity'>,
  cacheKey: string, previous: string, mtimeMs: number): void {
  const real = file.path;
  const observed = context.readFileCache?.get(cacheKey);
  const read = observed?.identity && (observed.realPath !== real ||
    observed.identity.dev !== file.identity?.dev || observed.identity.ino !== file.identity?.ino) ? undefined : observed;
  if (!read && context.fileMutationGate && (context.fileMutationGate.preReadGuard || !context.fileMutationGate.readAllowed(real, 'write_file'))) {
    throw new Error('File has not been read in full. Read it again before attempting to write it.');
  }
  if (read?.isPartialView) throw new Error('File has not been read in full. Read it again before attempting to write it.');
  if (read && !read.isPartialView && Math.floor(mtimeMs) > read.timestamp) {
    const complete = (read.offset ?? 1) <= 1 && (read.limit === undefined ||
      (read.content !== '' && read.content.split('\n').length < read.limit));
    const normalized = previous.replace(/^﻿/, '').replaceAll('\r\n', '\n');
    const matches = read.contentHash === undefined ? read.content === normalized :
      read.contentHash === sourceBunHashString(normalized);
    if (!complete || !matches) throw new Error('File has been modified since read. Read it again before attempting to write it.');
  }
}

// uno, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// [739599,743280), UTF-16: update read state and project the successfully landed write.
function finishFileWrite(context: ToolContext, real: string, cacheKey: string, rel: string, previous: string, content: string,
  existed: boolean, landed: Pick<ReturnType<typeof atomicWrite>, 'mtimeMs' | 'identity'>): string {
  if (context.readFileCache) {
    // Host conservative alias invalidation until write/edit/rewind alias ownership is mapped.
    context.readFileCache.clear();
    try { context.readFileCache.set(cacheKey, { content: content.replace(/^﻿/, '').replaceAll('\r\n', '\n'),
      timestamp: Math.floor(landed.mtimeMs), identity: landed.identity, realPath: real, offset: undefined, limit: undefined }); }
    catch { context.readFileCache.delete(cacheKey); }
  }
  context.hostResult?.({ ...writeEffectResult(rel, previous, content), landed: { filePath: real, cacheKey,
    content: content.replace(/^﻿/, '').replaceAll('\r\n', '\n'), mtimeMs: landed.mtimeMs, identity: landed.identity } });
  return `${existed ? "overwrote" : "wrote"} ${Buffer.byteLength(content, "utf8")} bytes to ${rel}`;
}

// Fet/T$n, sfn1dbxq [4731316,4732048)/[4739060,4739632), UTF-16.
// Pin the source grant and copy exact bytes before recording the original.
async function captureDirectoryBackup(session: NonNullable<ToolContext['session']>, toolUseId: string,
  grant: DirectoryReadHandle, lexicalPath: string, relative: string, id: string, signal: AbortSignal,
  edit?: { input: unknown; resolved: ResolvedPath }, copyRelative = relative) {
  signal.throwIfAborted();
  const sidecar = `${session.file}.backup-unknown-${id}`;
  const destination = await fsp.open(sidecar, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | fs.constants.O_NOFOLLOW, 0o600);
  try {
    signal.throwIfAborted();
    syncDirectory(path.dirname(sidecar));
    const copied = await copyStableDirectoryFile({ fd: grant.fd, relative: copyRelative }, destination, signal);
    signal.throwIfAborted();
    if (edit) {
      verifyUnchanged(edit.resolved, 'edit_file', lexicalPath);
      if (copied.metadata.dev !== edit.resolved.identity?.dev || copied.metadata.ino !== edit.resolved.identity?.ino)
        throw new Error('edit_file: directory file changed during backup');
    }
    session.recordDirectoryBackup({ id, toolUseId, lexicalPath, grant, destinationFd: destination.fd, ...copied,
      source: { begin: copied.metadata, end: { ...copied.metadata } }, signal, ...(edit ? { editInput: edit.input } : {}),
      ...(copyRelative !== relative ? { resolvedRelative: copyRelative } : {}) });
    return copied.metadata;
  } finally { await destination.close(); }
}

/** Consume the Agent's per-call write-lane snapshot at the builtin producer. */
export function consumeWriteApproval(context: ToolContext, requested: string, label: string): void {
  const call = context.pathApprovalCall;
  if (!call) return;
  let snapshot;
  try { snapshot = call.take('write', requested); }
  catch { throw new Error(`${label}: write approval changed`); }
  if (snapshot.kind !== 'saved') throw new Error(`${label}: write approval changed`);
}

function writeFileTool(): ToolDefinition {
  const tool: ToolDefinition = {
    toAutoClassifierInput(input) { const value = writeFileSchema.parse(input); return `${value.path}: ${value.content}`; },
    readOnly: false,
    schema: {
      name: "write_file",
      description:
        "Write a UTF-8 text file inside the agent workspace or an explicitly granted directory. Existing files are " +
        "left untouched unless `overwrite: true`; when overwriting, the original " +
        "file mode is preserved. Paths may be workspace-relative or absolute within a granted directory.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to write, relative to the workspace." },
          content: { type: "string", description: "Full file content to write." },
          overwrite: {
            type: "boolean",
            description: "Allow replacing an existing file. Defaults to false.",
          },
        },
        required: ["path", "content"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const { path: userPath, content, overwrite = false } = writeFileSchema.parse(input);
      if (input && typeof input === 'object' && approvedMutationInputs.has(input)) {
        const approved = input as Record<string, unknown>;
        if (userPath !== approved.path || content !== approved.content || overwrite !== (approved.overwrite === undefined ? false : approved.overwrite))
          throw new Error('Built-in Write input changed after permission checking');
      }
      const invocation = builtinWriteInvocations.get(context);
      if (invocation && invocation.input === input && runtimeBuiltinWrites.get(invocation.tool)?.original === tool)
        observeBuiltinWrite(invocation, { phase: 'entered', input: { path: userPath, content, overwrite } });
      consumeWriteApproval(context, path.resolve(context.workspace, userPath).normalize('NFC'), 'write_file');
      const root = workspaceReal(context.workspace);
      // fl/aNe, 2bcyxj9q [205509,205734)/[241113,242279), UTF-16.
      const planPath = context.planMode && resolveOwnedPlanFile(root, userPath, context.planMode.ownership);
      const resolved = planPath || confineResolved(root, userPath, false, context.workingDirectories?.(false));
      const real = resolved.path;
      // uno/dno, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
      // [739599,743280)/[733986,734328), and sC, f606a53w
      // dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
      // [12501,15618), UTF-16. Adapt history-before-publication and successful
      // cache/result ordering to the host's owned descriptor transaction.
      if (!planPath && !isWithin(root, real)) {
        // T$n, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
        // UTF-16 [4739060,4739632): source copies by path. The host binds its FD
        // copy to the Session's durable journal and receipt before accepting it.
        const directories = context.workingDirectories?.(false);
        const requested = path.resolve(root, userPath);
        const grant = directories?.filter(directory => isWithin(directory, requested)).sort((a, b) => b.length - a.length)[0];
        const owned = grant && directories?.readHandle?.(grant);
        const relative = owned && path.relative(owned.root, requested);
        const resolvedRelative = owned && path.relative(owned.root, real);
        if (context.session && context.toolUseId && owned && owned.owner === context.session.id && relative &&
            relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
          context.readGrantSignal?.(owned.signal);
          const signal = AbortSignal.any([context.signal, owned.signal, context.session.closeSignal]);
          const id = crypto.randomUUID();
          let missing = false;
          let captured = false;
          try {
            signal.throwIfAborted();
            missing = context.session.recordMissingDirectoryBackup({ id, toolUseId: context.toolUseId, lexicalPath: requested,
              grant: owned, value: { path: userPath, content, overwrite }, signal,
              ...(resolvedRelative && resolvedRelative !== relative ? { resolvedRelative } : {}) });
            if (!missing) {
              await captureDirectoryBackup(context.session, context.toolUseId, owned, requested, relative, id, signal, undefined,
                resolvedRelative && resolvedRelative !== relative ? resolvedRelative : relative);
            }
            captured = true;
          } catch {
            // Partial or unsynced evidence stays unknown and is never removed here.
          }
          if (context.directoryPublicationAuthorization && context.authorizationIdentity && context.pathApprovalCall) {
            signal.throwIfAborted();
            if (!captured) throw new Error('write_file: directory backup unavailable');
            let previous = '';
            if (!missing) {
              if (!overwrite) {
                const error = new Error(`write_file: file already exists (pass overwrite: true): ${userPath}`);
                blockedDirectoryWrites.add(error);
                throw error;
              }
              const backup = context.session.directoryBackups.find(row => row.id === id);
              const bytes = context.session.readDirectoryBackup(id);
              if (backup?.kind !== 'valid' || bytes === undefined) throw new Error('write_file: directory backup unavailable');
              previous = bytes.toString('utf8');
              const observed = backup.witness.source.end;
              checkWriteReadState(context, { path: requested, identity: { dev: observed.dev, ino: observed.ino,
                size: Number(observed.size), ctimeMs: String(BigInt(observed.ctimeSeconds) * 1000n + BigInt(observed.ctimeNanoseconds) / 1000000n) } },
                requested, previous, Number(observed.mtimeSeconds) * 1000 + Number(observed.mtimeNanoseconds) / 1e6);
            }
            const publication = context.session.publishDirectoryFileTransaction({ toolUseId: context.toolUseId, backupId: id,
              grant: owned, lexicalPath: requested, content: Buffer.from(content, 'utf8'), signal: context.signal,
              authorizationSignal: context.authorizationIdentity.signal, approvalCall: context.pathApprovalCall,
              authorization: context.directoryPublicationAuthorization, ...(missing ? {} : { strategy: 'retained' }),
              ...(resolvedRelative && resolvedRelative !== relative ? { resolvedRelative } : {}) });
            if (publication.kind !== 'durable') throw new Error(`write_file: directory publication ${publication.kind}: ${publication.detail}`);
            const observed = publication.observation;
            return finishFileWrite(context, requested, requested, path.relative(root, requested) || userPath,
              previous, content, !missing, { mtimeMs: Number(observed.mtimeSeconds) * 1000 + Number(observed.mtimeNanoseconds) / 1e6,
                identity: { dev: observed.dev, ino: observed.ino } });
          }
        }
        const error = new Error('write_file: writes through additional directory grants are not implemented');
        blockedDirectoryWrites.add(error);
        throw error;
      }
      const cacheKey = path.resolve(root, userPath);
      const existed = fs.existsSync(real);
      let previous = "";
      let landed: ReturnType<typeof atomicWrite>;
      if (existed) {
        const stat = fs.statSync(real);
        if (!stat.isFile()) {
          throw new Error(`write_file: not a regular file: ${userPath}`);
        }
        if (!overwrite) {
          throw new Error(`write_file: file already exists (pass overwrite: true): ${userPath}`);
        }
        // The prior content is read only once the target is known to be a regular file we may
        // replace, so the host row reports the effect against what the file actually held: an
        // existing but empty file takes the source's create branch.
        previous = fs.readFileSync(real, "utf8");
        // dno, chunk-sfn1dbxq.js 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
        // UTF-16 [733986,735250): an advanced mtime requires a matching complete read.
        checkWriteReadState(context, resolved, cacheKey, previous, stat.mtimeMs);
        verifyUnchanged(resolved, "write_file", userPath);
        context.fileHistory?.(real);
        landed = atomicWrite(real, content, stat.mode & 0o7777);
      } else {
        context.fileHistory?.(real);
        landed = atomicWrite(real, content);
      }
      return finishFileWrite(context, real, cacheKey, path.relative(root, real) || userPath, previous, content, existed, landed);
    },
  };
  builtinWriteExecutors.set(tool, tool.execute);
  const snapshot = snapshotTool(tool);
  if (snapshot) builtinWriteSnapshots.set(tool, snapshot);
  return tool;
}

type RetainedEdit = { grant: DirectoryReadHandle; backupId: string; resolvedRelative?: string };

export function requireDirectoryHandle(context: ToolContext, requested: string, readOnly: boolean) {
  const directories = context.workingDirectories?.(readOnly);
  const grantRoot = directories?.filter(directory => isWithin(directory, requested)).sort((a, b) => b.length - a.length)[0];
  const held = grantRoot && directories?.readHandle?.(grantRoot);
  if (!held || !context.session || held.owner !== context.session.id || !context.toolUseId)
    throw new Error('directory grant unavailable');
  const named = fs.lstatSync(held.root, { bigint: true });
  if (!named.isDirectory() || named.dev !== held.dev || named.ino !== held.ino)
    throw new Error('directory grant changed');
  context.readGrantSignal?.(held.signal);
  return held;
}

export async function captureExternalEdit(context: ToolContext, resolved: ResolvedPath, requested: string, input: unknown) {
  const held = requireDirectoryHandle(context, requested, false);
  if (!context.session || !context.toolUseId) throw new Error('directory edit session unavailable');
  const signal = AbortSignal.any([context.signal, context.session.closeSignal, held.signal]);
  const id = crypto.randomUUID();
  const relative = path.relative(held.root, requested), resolvedRelative = path.relative(held.root, resolved.path);
  const observed = await captureDirectoryBackup(context.session, context.toolUseId, held, requested, relative,
    id, signal, { input, resolved }, resolvedRelative !== relative ? resolvedRelative : relative);
  const bytes = context.session.readDirectoryBackup(id);
  if (!bytes) throw new Error('edit_file: original directory backup unavailable');
  signal.throwIfAborted();
  return { decoded: decodeFileBytes(bytes), observed,
    retained: { grant: held, backupId: id, ...(resolvedRelative !== relative ? { resolvedRelative } : {}) } };
}

export function publishExternalEdit(context: ToolContext, retained: RetainedEdit, cacheKey: string, bytes: Buffer) {
  if (!context.session || !context.toolUseId || !context.authorizationIdentity || !context.pathApprovalCall)
    throw new Error('edit_file: directory publication unavailable');
  const publication = context.session.publishDirectoryFileTransaction({ ...retained, toolUseId: context.toolUseId,
    lexicalPath: cacheKey, content: bytes, signal: context.signal, authorizationSignal: context.authorizationIdentity.signal,
    approvalCall: context.pathApprovalCall, authorization: context.directoryPublicationAuthorization, strategy: 'retained',
    ...(retained.resolvedRelative ? { resolvedRelative: retained.resolvedRelative } : {}) });
  if (publication.kind !== 'durable') throw new Error(`edit_file: directory publication ${publication.kind}: ${publication.detail}`);
  const { dev, ino, mtimeSeconds, mtimeNanoseconds } = publication.observation;
  return { identity: {dev, ino}, mtimeMs: Number(mtimeSeconds) * 1000 + Number(mtimeNanoseconds) / 1e6 };
}

function editFileTool(): ToolDefinition {
  return registerBuiltinEdit({
    // sfn [4160906,4161312), UTF-16. Select external removal-visible defaults, cap 3000.
    toAutoClassifierInput(input) { const value = editFileSchema.parse(input); return { file_path: value.path,
      adds: value.new_string, removes: value.old_string.slice(0, 3000), removesTruncated: value.old_string.length > 3000,
      ...(value.replace_all === true ? { replaceAll: true } : {}) }; },
    readOnly: false,
    schema: {
      name: "edit_file",
      description:
        "Replace text in an existing workspace file or an explicitly granted directory. `old_string` must occur " +
        "exactly once unless `replace_all: true` is set; otherwise the edit is " +
        "rejected. `new_string` is inserted literally (dollar sequences such as " +
        "`$&` are not expanded). The write is atomic and preserves the file mode. " +
        "Paths are workspace-relative and confined to the workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to edit, relative to the workspace." },
          old_string: { type: "string", description: "Exact text to replace." },
          new_string: { type: "string", description: "Replacement text (inserted literally)." },
          replace_all: {
            type: "boolean",
            description: "Replace every occurrence instead of requiring a unique match.",
          },
        },
        required: ["path", "old_string", "new_string"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      const parsed = editFileSchema.parse(input);
      verifyApprovedEditInput(input, parsed);
      const { path: userPath, old_string, new_string, replace_all = false } = parsed;
      consumeWriteApproval(context, path.resolve(context.workspace, userPath).normalize('NFC'), 'edit_file');
      const root = workspaceReal(context.workspace);
      // fl/c_, 2bcyxj9q [205509,205734)/[235473,238027), UTF-16: admit only the designated plan path.
      const planPath = context.planMode && resolveOwnedPlanFile(root, userPath, context.planMode.ownership, true);
      const resolved = planPath || confineResolved(root, userPath, true, context.workingDirectories?.(false));
      const real = resolved.path;
      // sjr, sfn1dbxq [4167188,4171835), UTF-16. Bind recheckBeforeWrite
      // to the retained file and the original directory descriptor.
      const external = !planPath && !isWithin(root, real);
      const cacheKey = path.resolve(root, userPath);
      let decoded: Awaited<ReturnType<typeof lwe>>;
      let mtimeMs: number, mode: number;
      let retained: { grant: DirectoryReadHandle; backupId: string } | undefined;
      if (external) {
        const captured = await captureExternalEdit(context, resolved, cacheKey, input);
        const { observed } = captured;
        decoded = captured.decoded;
        retained = captured.retained;
        mtimeMs = Number(observed.mtimeSeconds) * 1000 + Number(observed.mtimeNanoseconds) / 1e6;
        mode = observed.mode;
      } else {
        // ijr/lwe [4171835,4172005)/[2923,3214), half-open UTF-16.
        const descriptor = await fsp.open(real, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        try {
          const identity = await descriptor.stat({ bigint: true });
          if (!identity.isFile()) throw new Error(`edit_file: not a regular file: ${userPath}`);
          if (!resolved.identity || identity.dev.toString() !== resolved.identity.dev || identity.ino.toString() !== resolved.identity.ino)
            throw new Error(`edit_file: file changed before read: ${userPath}`);
          mtimeMs = Number(identity.mtimeNs / 1000000n);
          mode = Number(identity.mode & 0o7777n);
          decoded = await lwe(descriptor, real, undefined);
        } finally { await descriptor.close(); }
      }
      const original: string = decoded.content;
      const match: string | null = ZMe(original, old_string);
      const occurrences = match ? original.split(match).length - 1 : 0;
      // Edit validator and ajr, sfn1dbxq [4163900,4165400), [4172005,4172613), UTF-16.
      const observed = context.readFileCache?.get(cacheKey);
      const read = observed?.identity && (observed.realPath !== real ||
        observed.identity.dev !== resolved.identity?.dev || observed.identity.ino !== resolved.identity?.ino) ? undefined : observed;
      const gate = context.fileMutationGate;
      const allowed = () => gate?.readAllowed(real, 'edit_file') ?? true;
      if ((!read || read.isPartialView) && gate && (gate.preReadGuard || !allowed())) {
        throw new Error('File has not been read in full. Read it again before attempting to edit it.');
      }
      if (read && (read.refreshedBehindModel || Math.floor(mtimeMs) > read.timestamp)) {
        const complete = (read.offset ?? 1) <= 1 && !read.isPartialView && (read.limit === undefined ||
          (read.content !== '' && read.content.split('\n').length < read.limit));
        const normalized = original.replace(/^﻿/, '').replaceAll('\r\n', '\n');
        const matches = read.contentHash === undefined ? read.content === normalized : read.contentHash === sourceBunHashString(normalized);
        const applicable = old_string !== '' && occurrences > 0 && (replace_all || occurrences === 1);
        if ((read.refreshedBehindModel || !complete || !matches) && !(applicable && allowed())) {
          throw new Error('File has been modified since read. Read it again before attempting to edit it.');
        }
      }
      if (decoded.lossyDecode) throw new Error('edit_file: unsupported encoding; cannot edit invalid UTF-8 without losing bytes');
      if (!match) {
        throw new Error(`edit_file: old_string not found in ${userPath}`);
      }
      if (occurrences > 1 && !replace_all) {
        throw new Error(
          `edit_file: old_string is not unique in ${userPath} (${occurrences} matches); ` +
            "provide more context or pass replace_all: true",
        );
      }
      // sjr [4167188,4171835) uses the matched spelling for P3t and restores
      // the decoded encoding and line endings through o8e/pPe [7016,7501).
      const { updated, patch, bytes } = renderFileEdit(decoded, { path: real, old_string, new_string, replace_all }, match);
      verifyUnchanged(resolved, "edit_file", userPath);
      let landed: {mtimeMs: number; identity: { dev: string; ino: string }};
      if (retained) {
        landed = publishExternalEdit(context, retained, cacheKey, bytes);
      } else {
        context.fileHistory?.(real);
        landed = atomicWrite(real, bytes, mode);
      }
      // sjr, sfn1dbxq [4167188,4170788), UTF-16: an edited view may not be fully visible.
      const priorRead = context.readFileCache?.get(cacheKey);
      if (context.readFileCache) {
        context.readFileCache.clear();
        try { context.readFileCache.set(cacheKey, { content: updated.replace(/^﻿/, ''),
          timestamp: Math.floor(landed.mtimeMs), identity: landed.identity, realPath: real, offset: undefined, limit: undefined,
          contentNotInModelContext: true, ...(priorRead?.isPartialView ? { isPartialView: true } : {}) }); }
        catch { context.readFileCache.delete(cacheKey); }
      }
      const count = replace_all ? occurrences : 1;
      const rel = path.relative(root, real) || userPath;
      context.hostResult?.({ ...editEffectResult(rel, original, updated, match, new_string, replace_all, patch), landed: {
        filePath: real, cacheKey, content: updated.replace(/^﻿/, ''), mtimeMs: landed.mtimeMs, identity: landed.identity,
        ...(priorRead?.isPartialView ? { isPartialView: true } : {}) } });
      return `edited ${rel}: ${count} replacement(s)`;
    },
  });
}

function runCommandTool(): ToolDefinition {
  return {
    toAutoClassifierInput(input) { return runCommandSchema.parse(input).command; },
    readOnly: false,
    schema: {
      name: "run_command",
      description:
        "Run a shell command with `/bin/sh -c` from the agent workspace. Shell " +
        "commands are NOT path-confined: they run unrestricted within the OS " +
        "user's permissions (only the file tools are confined to the workspace). " +
        "stdin is ignored; stdout and stderr are combined, capped at the " +
        "configured max output size keeping the trailing bytes. The process runs " +
        "in its own group; on timeout (default " +
        COMMAND_DEFAULT_TIMEOUT_MS +
        "ms, max " +
        COMMAND_MAX_TIMEOUT_MS +
        "ms), on caller abort, or once the shell exits, the whole process group " +
        "is killed so detached descendants cannot outlive the call. Requires " +
        "`allowShell`.",
      input_schema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command line passed to `/bin/sh -c`." },
          timeout_ms: {
            type: "integer",
            minimum: 1,
            maximum: COMMAND_MAX_TIMEOUT_MS,
            description: "Timeout in milliseconds before the process group is killed.",
          },
        },
        required: ["command"],
        additionalProperties: false,
      },
    },
    async execute(input, context) {
      if (context.signal.aborted) throw abortError();
      if (!context.allowShell) {
        throw new Error("run_command: shell access is disabled for this agent (allowShell is false)");
      }
      const { command, timeout_ms = COMMAND_DEFAULT_TIMEOUT_MS } = runCommandSchema.parse(input);
      const root = workspaceReal(context.workspace);
      try { return await runShell(command, root, timeout_ms, maxBytesFor(context), context.signal, context.onProgress, context.shellHome); }
      finally { context.fileHistory?.(); }
    },
  };
}

export function createTools(): ToolDefinition[] {
  return [
    readFileTool(),
    listFilesTool(),
    searchTool(),
    writeFileTool(),
    editFileTool(),
    runCommandTool(),
  ];
}
