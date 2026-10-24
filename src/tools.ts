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

import type { Anthropic } from "@anthropic-ai/sdk";
import { z } from "zod";
import { atomicWriteFile } from "./atomic-write.js";
import type { InteractionCallbacks } from "./interaction-tools.js";
import { PathResolutionError, resolveChain, verifyIdentity, observeWorkingDirectory, type WorkingDirectories, type ResolvedPath } from "./path-identity.js";
import { editEffectResult, writeEffectResult, type ToolUseResult } from "./tool-use-result.js";

export type ToolContext = {
  workspace: string;
  signal: AbortSignal;
  allowShell: boolean;
  maxOutputBytes: number;
  conversation?: readonly Anthropic.MessageParam[];
  interaction?: InteractionCallbacks;
  fileHistory?: (file?: string) => void;
  workingDirectories?: (readOnly: boolean) => readonly string[];
  /** A file-effecting tool reports the structured host result of the effect it just performed. */
  hostResult?: (value: ToolUseResult) => void;
  /** Source `Czr`'s `emitToolProgress` progress frame, carrying the shell poll's snapshot. */
  onProgress?: (progress: ShellProgress) => void;
};

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
  mcpAnnotations?: { destructive: boolean; openWorld: boolean; toolName?: string; title?: string };
  toAutoClassifierInput?(input: unknown): unknown;
  requiresUserInteraction?: boolean;
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
    if (!resolved.identity && (mustExist || resolved.hops.length)) throw new Error(`path does not exist or has a dangling symlink: ${userPath}`);
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
  if (resolved.identity === undefined && resolved.hops.length > 0) {
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

function atomicWrite(real: string, content: string, mode?: number): void {
  // Delegated: the shared writer verifies the bytes it wrote and the directory
  // it wrote them in, and keeps the content rather than discarding it when the
  // rename cannot happen.
  atomicWriteFile(real, content, mode === undefined ? {} : { mode });
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
): Promise<string> {
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
  const fd = fs.openSync(resolved.path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  let stream: fs.ReadStream | undefined;
  try {
    if (resolved.identity !== undefined) {
      const opened = fs.fstatSync(fd, { bigint: true });
      if (
        String(opened.dev) !== resolved.identity.dev ||
        String(opened.ino) !== resolved.identity.ino ||
        String(opened.ctimeMs) !== resolved.identity.ctimeMs ||
        Number(opened.size) !== resolved.identity.size
      ) {
        throw new Error(`read_file: path changed after it was resolved: ${userPath}`);
      }
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
    return `${buf.subarray(0, end).toString("utf8")}\n[read_file: output truncated; file continues]`;
  }
  return truncateHead(joined, maxBytes, "read_file");
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

const writeFileSchema = z
  .object({
    path: z.string().min(1),
    content: z.string(),
    overwrite: z.boolean().optional(),
  })
  .strict();

const editFileSchema = z
  .object({
    path: z.string().min(1),
    old_string: z.string().min(1),
    new_string: z.string(),
    replace_all: z.boolean().optional(),
  })
  .strict();

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
        env: process.env,
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

function readFileTool(): ToolDefinition {
  return {
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
      const resolved = confineResolved(root, userPath, true, context.workingDirectories?.(true));
      const stat = await fsp.stat(resolved.path);
      if (!stat.isFile()) {
        throw new Error(`read_file: not a regular file: ${userPath}`);
      }
      return readFileLines(resolved, userPath, offset, limit, maxBytesFor(context), context.signal);
    },
  };
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

function writeFileTool(): ToolDefinition {
  return {
    toAutoClassifierInput(input) { const value = writeFileSchema.parse(input); return `${value.path}: ${value.content}`; },
    readOnly: false,
    schema: {
      name: "write_file",
      description:
        "Write a UTF-8 text file inside the agent workspace. The write is atomic " +
        "(temporary file in the target directory, then rename). Existing files are " +
        "left untouched unless `overwrite: true`; when overwriting, the original " +
        "file mode is preserved. Paths are workspace-relative and confined to the " +
        "workspace.",
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
      const root = workspaceReal(context.workspace);
      const resolved = confineResolved(root, userPath, false, context.workingDirectories?.(false));
      const real = resolved.path;
      const existed = fs.existsSync(real);
      let previous = "";
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
        verifyUnchanged(resolved, "write_file", userPath);
        context.fileHistory?.(real);
        atomicWrite(real, content, stat.mode & 0o7777);
      } else {
        context.fileHistory?.(real);
        atomicWrite(real, content);
      }
      const rel = path.relative(root, real) || userPath;
      context.hostResult?.(writeEffectResult(rel, previous, content));
      return `${existed ? "overwrote" : "wrote"} ${Buffer.byteLength(content, "utf8")} bytes to ${rel}`;
    },
  };
}

function editFileTool(): ToolDefinition {
  return {
    // sfn [4160906,4161312), UTF-16. Select external removal-visible defaults, cap 3000.
    toAutoClassifierInput(input) { const value = editFileSchema.parse(input); return { file_path: value.path,
      adds: value.new_string, removes: value.old_string.slice(0, 3000), removesTruncated: value.old_string.length > 3000,
      ...(value.replace_all === true ? { replaceAll: true } : {}) }; },
    readOnly: false,
    schema: {
      name: "edit_file",
      description:
        "Replace text in an existing workspace file. `old_string` must occur " +
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
      const { path: userPath, old_string, new_string, replace_all = false } = editFileSchema.parse(input);
      const root = workspaceReal(context.workspace);
      const resolved = confineResolved(root, userPath, true, context.workingDirectories?.(false));
      const real = resolved.path;
      const stat = await fsp.stat(real);
      if (!stat.isFile()) {
        throw new Error(`edit_file: not a regular file: ${userPath}`);
      }
      const original = await fsp.readFile(real, "utf8");
      const occurrences = original.split(old_string).length - 1;
      if (occurrences === 0) {
        throw new Error(`edit_file: old_string not found in ${userPath}`);
      }
      if (occurrences > 1 && !replace_all) {
        throw new Error(
          `edit_file: old_string is not unique in ${userPath} (${occurrences} matches); ` +
            "provide more context or pass replace_all: true",
        );
      }
      // Both paths insert `new_string` literally: `split`/`join` never expands
      // dollar patterns, and a function replacement is used verbatim by
      // `String#replace`.
      const updated = replace_all
        ? original.split(old_string).join(new_string)
        : original.replace(old_string, () => new_string);
      verifyUnchanged(resolved, "edit_file", userPath);
      context.fileHistory?.(real);
      atomicWrite(real, updated, stat.mode & 0o7777);
      const count = replace_all ? occurrences : 1;
      const rel = path.relative(root, real) || userPath;
      context.hostResult?.(editEffectResult(rel, original, updated, old_string, new_string, replace_all));
      return `edited ${rel}: ${count} replacement(s)`;
    },
  };
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
      try { return await runShell(command, root, timeout_ms, maxBytesFor(context), context.signal, context.onProgress); }
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
