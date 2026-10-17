import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./tools.js";

export const WORKTREE_DIRECTORY = ".harness-worktrees";
const STORE_FILE = "worktrees.json";
const MAX_BYTES = 4 * 1024 * 1024;
/** Ported from `_x`/`Rze` in chunk-sfn1dbxq.js [1759186,1759662), `P1t` [1801260,1801370) and the
 *  sweep `zPo` [1801370,1802540) (UTF-8 bytes): a worktree lock is reclaimed only when its reason
 *  names a dead process, using the integer bound of `Iue` [2547,2601) and the ESRCH check of `Nm`
 *  [2601,2715) in chunk-3sda67c1.js. The reason names this runtime's store instead of
 *  `claude agent|session`; as in `U1t`, an own-pid lock is never reclaimed. */
const LOCK_REASON = /^harness worktree store \(pid ([1-9][0-9]{0,9})\)$/;
const LOCK_REASON_MAX = 512;
function lockReason(): string { return `harness worktree store (pid ${process.pid})`; }
/** Source `Nm`: a pid is dead only when `kill(pid, 0)` reports ESRCH. */
function deadPid(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 1 || pid > 2147483647) return false;
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
}
/** Source `Rze` adapted to the store lock: only a bounded reason in this process's format that names
 *  a dead owner is safe to remove. A foreign or empty file stays, preserving the fail-closed contract. */
function reclaimStaleLock(lock: string): boolean {
  let fd: number;
  try { fd = fs.openSync(lock, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (error) {
    // The owner released the lock between the failed create and this read: retry the acquire.
    return (error as NodeJS.ErrnoException).code === "ENOENT";
  }
  let identity: fs.Stats;
  let text: string;
  try {
    identity = fs.fstatSync(fd);
    if (!identity.isFile() || identity.size > LOCK_REASON_MAX) return false;
    text = fs.readFileSync(fd, "utf8");
  } finally { fs.closeSync(fd); }
  const match = LOCK_REASON.exec(text);
  if (!match) return false;
  const pid = Number(match[1]);
  if (pid === process.pid || !deadPid(pid)) return false;
  const present = statOrMissing(lock);
  if (!present || !present.isFile() || present.dev !== identity.dev || present.ino !== identity.ino) return false;
  fs.unlinkSync(lock);
  return true;
}
const nameSchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .refine((name) => name !== "." && name !== ".." && !name.endsWith(".lock"), "invalid worktree name");
const refSchema = z.string().min(1).max(1024).refine(
  (ref) => !ref.startsWith("-") && !/[\x00-\x20\x7f]/.test(ref), "invalid Git reference",
);
const createSchema = z.object({ name: nameSchema, branch: refSchema.optional(), base_ref: refSchema.optional() }).strict();
const removeSchema = z.object({
  name: nameSchema, discard_changes: z.boolean().optional(), delete_branch: z.boolean().optional(),
}).strict();
const recordSchema = z.object({
  name: nameSchema,
  branch: z.string().min(1),
  baseRef: z.string().min(1),
  baseCommit: z.string().regex(/^[0-9a-f]{40,64}$/),
  directory: z.object({ dev: z.number(), ino: z.number() }).strict(),
  gitDir: z.string().nullable(),
  state: z.enum(["creating", "ready", "removing"]),
  removalCommit: z.string().regex(/^[0-9a-f]{40,64}$/).optional(),
  deleteBranch: z.boolean().optional(),
}).strict();
const storeSchema = z.object({
  version: z.literal(1), root: z.string(), commonDir: z.string(), records: z.array(recordSchema).max(1000),
}).strict();
type OwnedRecord = z.infer<typeof recordSchema>;
type Store = z.infer<typeof storeSchema>;
type Repository = { root: string; commonDir: string };
type GitResult = { stdout: string; stderr: string; code: number | null };

export type WorktreeInfo = {
  path: string; head: string; branch?: string; detached?: boolean; bare?: boolean;
  locked?: string; prunable?: string;
  owned: boolean; name?: string; state?: OwnedRecord["state"]; verificationError?: string;
};
export type WorktreeManagerOptions = {
  workspace: string; signal?: AbortSignal; timeoutMs?: number; maxOutputBytes?: number; baseRef?: string;
  /** How long a live store lock may be awaited before failing; 0 keeps the previous fail-fast behavior. */
  lockWaitMs?: number;
};
export type CreateWorktreeInput = z.infer<typeof createSchema>;
export type RemoveWorktreeInput = z.infer<typeof removeSchema>;

function aborted(): Error {
  const error = new Error("worktree operation aborted");
  error.name = "AbortError";
  return error;
}
function pause(ms: number, signal: AbortSignal): Promise<void> {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(aborted()); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
function checkAbort(signal?: AbortSignal): void { if (signal?.aborted) throw aborted(); }
function statOrMissing(file: string): fs.Stats | undefined {
  try { return fs.lstatSync(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}
function checkedDirectory(dir: string, create = false): void {
  let stat = statOrMissing(dir);
  if (!stat && create) { fs.mkdirSync(dir, { mode: 0o700 }); stat = fs.lstatSync(dir); }
  if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`invalid directory or symlink: ${dir}`);
}
function checkFile(file: string): fs.Stats | undefined {
  const stat = statOrMissing(file);
  if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)) {
    throw new Error(`invalid metadata file or symlink: ${file}`);
  }
  return stat;
}
function capped(text: string, limit: number): string {
  const bytes = Buffer.from(text);
  if (bytes.length <= limit) return text;
  const note = "\n[worktrees: output truncated]";
  if (limit <= Buffer.byteLength(note)) return note.slice(0, limit);
  let end = limit - Buffer.byteLength(note);
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8") + note;
}

/** NUL porcelain avoids Git's quoted paths and newline-containing filenames. */
function parsePorcelain(text: string): WorktreeInfo[] {
  const result: WorktreeInfo[] = [];
  let current: WorktreeInfo | undefined;
  for (const field of text.split("\0")) {
    if (!field) { if (current) result.push(current); current = undefined; continue; }
    const space = field.indexOf(" ");
    const key = space < 0 ? field : field.slice(0, space);
    const value = space < 0 ? "" : field.slice(space + 1);
    if (key === "worktree") current = { path: value, head: "", owned: false };
    else if (!current) throw new Error("malformed Git worktree porcelain");
    else if (key === "HEAD") current.head = value;
    else if (key === "branch") current.branch = value;
    else if (key === "detached") current.detached = true;
    else if (key === "bare") current.bare = true;
    else if (key === "locked") current.locked = value;
    else if (key === "prunable") current.prunable = value;
  }
  if (current) result.push(current);
  return result;
}

export class WorktreeManager {
  readonly workspace: string;
  private readonly timeoutMs: number;
  private readonly lockWaitMs: number;
  private readonly maxBytes: number;
  private readonly baseRef: string;
  private readonly lifetime = new AbortController();
  private readonly externalSignal?: AbortSignal;
  private readonly onExternalAbort: () => void;
  private readonly running = new Map<ChildProcess, Promise<unknown>>();
  private readonly operations = new Set<Promise<unknown>>();
  private closed = false;

  constructor(options: WorktreeManagerOptions) {
    this.workspace = fs.realpathSync(path.resolve(options.workspace));
    checkedDirectory(this.workspace);
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.lockWaitMs = options.lockWaitMs ?? 30_000;
    this.maxBytes = options.maxOutputBytes ?? MAX_BYTES;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 120_000) {
      throw new Error("worktree timeoutMs must be between 1 and 120000");
    }
    if (!Number.isInteger(this.lockWaitMs) || this.lockWaitMs < 0 || this.lockWaitMs > 120_000) {
      throw new Error("worktree lockWaitMs must be between 0 and 120000");
    }
    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > MAX_BYTES) {
      throw new Error(`worktree maxOutputBytes must be between 1 and ${MAX_BYTES}`);
    }
    this.baseRef = refSchema.parse(options.baseRef ?? "HEAD");
    this.externalSignal = options.signal;
    this.onExternalAbort = () => this.lifetime.abort();
    if (options.signal?.aborted) this.onExternalAbort();
    else options.signal?.addEventListener("abort", this.onExternalAbort, { once: true });
  }

  private async operation<T>(signal: AbortSignal | undefined, action: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.closed) throw new Error("worktree manager is closed");
    const combined = signal ? AbortSignal.any([signal, this.lifetime.signal]) : this.lifetime.signal;
    checkAbort(combined);
    const pending = action(combined);
    this.operations.add(pending);
    try { return await pending; } finally { this.operations.delete(pending); }
  }

  private git(cwd: string, args: string[], signal: AbortSignal): Promise<GitResult> {
    checkAbort(signal);
    // Ignore inherited Git routing and host Git configuration. Local config is
    // needed for the repository, but hooks and fsmonitor never run here.
    const env: NodeJS.ProcessEnv = Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    );
    Object.assign(env, { LC_ALL: "C", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" });
    const child = spawn("git", ["--no-pager", "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false",
      "-c", "maintenance.auto=false", "-c", "gc.auto=0", "-c", "core.attributesFile=/dev/null",
      "-c", "submodule.recurse=false", ...args],
    { cwd, env, shell: false, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const pending = new Promise<GitResult>((resolve, reject) => {
      let settled = false;
      let failure: Error | undefined;
      let bytes = 0;
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let grace: NodeJS.Timeout | undefined;
      const kill = () => {
        try { if (child.pid) process.kill(-child.pid, "SIGKILL"); else child.kill("SIGKILL"); }
        catch { try { child.kill("SIGKILL"); } catch { /* already exited */ } }
      };
      const finish = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (grace) clearTimeout(grace);
        signal.removeEventListener("abort", onAbort);
        child.stdout?.destroy(); child.stderr?.destroy();
        if (failure) reject(failure);
        else resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8"), code });
      };
      const stop = (error: Error) => {
        failure ??= error;
        kill();
        grace ??= setTimeout(() => finish(null), 200);
      };
      const onAbort = () => stop(aborted());
      const timer = setTimeout(() => stop(new Error(`Git command timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
      const collect = (target: Buffer[]) => (chunk: Buffer) => {
        const room = Math.max(0, this.maxBytes - bytes);
        if (room) target.push(chunk.subarray(0, room));
        bytes += chunk.length;
        if (bytes > this.maxBytes) stop(new Error(`Git command output exceeded ${this.maxBytes} bytes`));
      };
      child.stdout?.on("data", collect(stdout));
      child.stderr?.on("data", collect(stderr));
      child.on("error", (error) => { failure ??= new Error(`failed to launch git: ${error.message}`); finish(null); });
      child.on("exit", (code) => {
        kill();
        grace ??= setTimeout(() => finish(code), 200);
      });
      child.on("close", (code) => finish(code));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    this.running.set(child, pending);
    return pending.finally(() => this.running.delete(child));
  }

  private async checkoutConfiguration(cwd: string, signal: AbortSignal): Promise<string[]> {
    const result = await this.git(cwd, ["config", "--null", "--name-only", "--get-regexp", "^filter\\..*\\.(process|smudge|clean|required)$"], signal);
    if (result.code !== 0 && result.code !== 1) throw new Error(`Git filter configuration lookup failed: ${result.stderr.trim()}`);
    return result.stdout.split("\0").filter(Boolean).flatMap((key) => ["-c", `${key}=${key.endsWith(".required") ? "false" : ""}`]);
  }

  private async checkedGit(cwd: string, args: string[], signal: AbortSignal): Promise<string> {
    const result = await this.git(cwd, args, signal);
    if (result.code !== 0) throw new Error(`git ${args[0]} failed (${result.code}): ${result.stderr.trim()}`);
    return result.stdout;
  }

  private async repository(signal: AbortSignal): Promise<Repository> {
    const top = (await this.checkedGit(this.workspace, ["rev-parse", "--show-toplevel"], signal)).trimEnd();
    if (fs.realpathSync(top) !== this.workspace) throw new Error("workspace must be the Git repository root");
    const common = (await this.checkedGit(this.workspace,
      ["rev-parse", "--path-format=absolute", "--git-common-dir"], signal)).trimEnd();
    return { root: this.workspace, commonDir: fs.realpathSync(common) };
  }

  private paths(create: boolean): { container: string; store: string; lock: string } {
    const agent = path.join(this.workspace, ".agent");
    const container = path.join(this.workspace, WORKTREE_DIRECTORY);
    if (statOrMissing(agent) || create) checkedDirectory(agent, create);
    if (statOrMissing(container) || create) checkedDirectory(container, create);
    const store = path.join(agent, STORE_FILE);
    const lock = store + ".lock";
    checkFile(store); checkFile(lock);
    return { container, store, lock };
  }

  private readStore(repo: Repository): Store {
    const { store } = this.paths(false);
    const stat = checkFile(store);
    if (!stat) return { version: 1, ...repo, records: [] };
    if (stat.size > MAX_BYTES) throw new Error("worktree ownership store exceeds size limit");
    const fd = fs.openSync(store, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    let value: Store;
    try {
      if (fs.fstatSync(fd).size > MAX_BYTES) throw new Error("worktree ownership store exceeds size limit");
      value = storeSchema.parse(JSON.parse(fs.readFileSync(fd, "utf8")));
    } finally { fs.closeSync(fd); }
    if (value.root !== repo.root || value.commonDir !== repo.commonDir) throw new Error("worktree ownership repository identity mismatch");
    const names = new Set<string>();
    const branches = new Set<string>();
    for (const record of value.records) {
      if (names.has(record.name) || branches.has(record.branch) || !record.branch.startsWith("refs/heads/")) {
        throw new Error("invalid or duplicate worktree ownership identity");
      }
      names.add(record.name); branches.add(record.branch);
    }
    return value;
  }

  private saveStore(store: Store): void {
    const file = this.paths(true).store;
    const text = JSON.stringify(storeSchema.parse(store), null, 2) + "\n";
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error("worktree ownership store exceeds size limit");
    const temporary = file + `.${crypto.randomUUID()}.tmp`;
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    try {
      try { fs.writeFileSync(fd, text); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      checkFile(file);
      fs.renameSync(temporary, file);
    } finally { if (statOrMissing(temporary)) fs.unlinkSync(temporary); }
    const dirFd = fs.openSync(path.dirname(file), fs.constants.O_RDONLY);
    try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
  }

  private async locked<T>(repo: Repository, signal: AbortSignal, action: (store: Store) => Promise<T>): Promise<T> {
    checkAbort(signal);
    const { lock } = this.paths(true);
    const open = (): number => fs.openSync(lock, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    const deadline = Date.now() + this.lockWaitMs;
    let fd: number | undefined;
    while (fd === undefined) {
      try { fd = open(); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        // A dead owner is reclaimed at once; a live owner is awaited for a bounded time so two
        // concurrent operations serialize instead of the loser failing on a freshly created lock.
        if (reclaimStaleLock(lock)) continue;
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new Error("worktree ownership store is locked by another operation");
        await pause(Math.min(50, remaining), signal);
      }
    }
    try {
      fs.writeFileSync(fd, lockReason());
      fs.fsyncSync(fd);
    } catch (error) { fs.closeSync(fd); throw error; }
    const identity = fs.fstatSync(fd);
    try { return await action(this.readStore(repo)); }
    finally {
      fs.closeSync(fd);
      const present = statOrMissing(lock);
      if (present?.dev === identity.dev && present.ino === identity.ino) fs.unlinkSync(lock);
    }
  }

  private target(name: string): string {
    nameSchema.parse(name);
    this.paths(false);
    const target = path.join(this.workspace, WORKTREE_DIRECTORY, name);
    const stat = statOrMissing(target);
    if (stat?.isSymbolicLink() || (stat && !stat.isDirectory())) throw new Error(`invalid worktree directory or symlink: ${target}`);
    return target;
  }

  private async inventory(signal: AbortSignal): Promise<WorktreeInfo[]> {
    return parsePorcelain(await this.checkedGit(this.workspace, ["worktree", "list", "--porcelain", "-z"], signal));
  }

  private async verify(record: OwnedRecord, item: WorktreeInfo, repo: Repository, signal: AbortSignal): Promise<string> {
    const target = this.target(record.name);
    const stat = fs.lstatSync(target);
    if (stat.dev !== record.directory.dev || stat.ino !== record.directory.ino) throw new Error("owned worktree directory identity changed");
    if (item.path !== target || item.branch !== record.branch || item.detached || item.bare) throw new Error("owned worktree registration or branch identity changed");
    const dotGit = path.join(target, ".git");
    checkFile(dotGit);
    if (!statOrMissing(dotGit)) throw new Error("owned worktree Git registration is missing");
    const gitDir = (await this.checkedGit(target, ["rev-parse", "--absolute-git-dir"], signal)).trimEnd();
    const expectedParent = path.join(repo.commonDir, "worktrees");
    checkedDirectory(expectedParent);
    checkedDirectory(gitDir);
    if (path.dirname(gitDir) !== expectedParent || fs.realpathSync(gitDir) !== gitDir || (record.gitDir && gitDir !== record.gitDir)) {
      throw new Error("owned worktree Git directory identity changed");
    }
    const common = (await this.checkedGit(target, ["rev-parse", "--path-format=absolute", "--git-common-dir"], signal)).trimEnd();
    if (fs.realpathSync(common) !== repo.commonDir) throw new Error("owned worktree belongs to another repository");
    const backlink = path.join(gitDir, "gitdir");
    checkFile(backlink);
    if (fs.readFileSync(backlink, "utf8").trimEnd() !== dotGit) throw new Error("owned worktree registration backlink changed");
    return gitDir;
  }

  /** A `creating` reservation read under the store lock cannot belong to a live operation: every
   *  create holds that lock across its Git mutations. The same cleanup as create's failure path
   *  applies here. Git may already have registered the recorded directory (adopt it), or the work
   *  may never have landed (drop the reservation when the recorded empty directory is unchanged and
   *  the branch is absent). Everything else is retained for inspection. */
  private async reclaimCreating(store: Store, repo: Repository, signal: AbortSignal): Promise<void> {
    let changed = false;
    const inventory = await this.inventory(signal);
    for (const record of [...store.records]) {
      if (record.state !== "creating") continue;
      const target = this.target(record.name);
      const item = inventory.find((entry) => entry.path === target);
      if (item) {
        if (item.branch !== record.branch) continue;
        try { record.gitDir = await this.verify(record, item, repo, signal); record.state = "ready"; changed = true; }
        catch { /* retain an unverifiable reservation */ }
        continue;
      }
      if (inventory.some((entry) => entry.branch === record.branch)) continue;
      const branch = await this.git(this.workspace, ["show-ref", "--verify", "--quiet", record.branch], signal);
      if (branch.code !== 1) continue;
      const remaining = statOrMissing(target);
      if (remaining) {
        if (!remaining.isDirectory() || remaining.dev !== record.directory.dev || remaining.ino !== record.directory.ino ||
          fs.readdirSync(target).length) continue;
        fs.rmdirSync(target);
      }
      store.records = store.records.filter((entry) => entry !== record);
      changed = true;
    }
    if (changed) this.saveStore(store);
  }

  async create(input: CreateWorktreeInput, signal?: AbortSignal): Promise<WorktreeInfo> {
    return this.operation(signal, async (active) => {
      const request = createSchema.parse(input);
      const repo = await this.repository(active);
      const branch = request.branch ?? `harness/${request.name}`;
      refSchema.parse(branch);
      const checked = (await this.checkedGit(this.workspace, ["check-ref-format", "--branch", branch], active)).trimEnd();
      if (checked !== branch) throw new Error("branch must be a literal Git branch name");
      const fullRef = `refs/heads/${branch}`;
      const baseRef = request.base_ref ?? this.baseRef;
      const baseCommit = (await this.checkedGit(this.workspace,
        ["rev-parse", "--verify", "--end-of-options", `${baseRef}^{commit}`], active)).trim();
      return this.locked(repo, active, async (store) => {
        await this.reclaimCreating(store, repo, active);
        const target = this.target(request.name);
        if (store.records.some((record) => record.name === request.name || record.branch === fullRef)) throw new Error("worktree name or branch is already owned");
        if (statOrMissing(target)) throw new Error("worktree destination already exists");
        const existing = await this.git(this.workspace, ["show-ref", "--verify", "--quiet", fullRef], active);
        if (existing.code === 0) throw new Error("branch already exists; create requires a new owned branch");
        if (existing.code !== 1) throw new Error(`Git branch lookup failed (${existing.code}): ${existing.stderr.trim()}`);
        const inventory = await this.inventory(active);
        if (inventory.some((item) => item.path === target || item.branch === fullRef)) throw new Error("worktree destination or branch is already registered");
        checkAbort(active);
        fs.mkdirSync(target, { mode: 0o700 });
        const stat = fs.lstatSync(target);
        const record: OwnedRecord = { name: request.name, branch: fullRef, baseRef, baseCommit,
          directory: { dev: stat.dev, ino: stat.ino }, gitDir: null, state: "creating" };
        store.records.push(record);
        try { this.saveStore(store); }
        catch (error) { fs.rmdirSync(target); throw error; }
        try {
          const checkoutConfig = await this.checkoutConfiguration(this.workspace, active);
          await this.checkedGit(this.workspace, [...checkoutConfig, "worktree", "add", "-b", branch, "--", target, baseCommit], active);
          const item = (await this.inventory(active)).find((entry) => entry.path === target);
          if (!item) throw new Error("created worktree was not registered by Git");
          record.gitDir = await this.verify(record, item, repo, active);
          record.state = "ready";
          this.saveStore(store);
          return { ...item, owned: true, name: record.name, state: record.state };
        } catch (error) {
          // Interrupted Git mutations retain their reservation for a later
          // registration check. Only our unchanged empty directory is cleaned.
          const remaining = statOrMissing(target);
          if (!active.aborted && (!remaining || (remaining.isDirectory() && remaining.dev === stat.dev && remaining.ino === stat.ino && fs.readdirSync(target).length === 0))) {
            try {
              const entries = await this.inventory(active);
              const branchState = await this.git(this.workspace, ["show-ref", "--verify", "--quiet", fullRef], active);
              if (!entries.some((entry) => entry.path === target || entry.branch === fullRef) && branchState.code === 1) {
                if (remaining) fs.rmdirSync(target);
                store.records = store.records.filter((entry) => entry !== record);
                this.saveStore(store);
              }
            } catch { /* retain the reservation when cleanup observations fail */ }
          }
          throw error;
        }
      });
    });
  }

  async list(signal?: AbortSignal): Promise<WorktreeInfo[]> {
    return this.operation(signal, async (active) => {
      const repo = await this.repository(active);
      const store = this.readStore(repo);
      const inventory = await this.inventory(active);
      for (const item of inventory) {
        const record = store.records.find((entry) => this.target(entry.name) === item.path);
        if (!record) continue;
        item.name = record.name; item.state = record.state;
        try { await this.verify(record, item, repo, active); item.owned = true; }
        catch (error) { checkAbort(active); item.verificationError = (error as Error).message; }
      }
      for (const record of store.records) {
        const target = this.target(record.name);
        if (!inventory.some((item) => item.path === target)) inventory.push({ path: target, head: "", branch: record.branch,
          owned: false, name: record.name, state: record.state, verificationError: "recorded worktree is absent from Git registration" });
      }
      return inventory;
    });
  }

  async remove(input: RemoveWorktreeInput, signal?: AbortSignal): Promise<{ path: string; branch: string; branchDeleted: boolean }> {
    return this.operation(signal, async (active) => {
      const request = removeSchema.parse(input);
      const repo = await this.repository(active);
      return this.locked(repo, active, async (store) => {
        await this.reclaimCreating(store, repo, active);
        const record = store.records.find((entry) => entry.name === request.name);
        if (!record) throw new Error("worktree is not owned by this manager");
        const target = this.target(record.name);
        let inventory = await this.inventory(active);
        let checkoutConfig = await this.checkoutConfiguration(this.workspace, active);
        const item = inventory.find((entry) => entry.path === target);
        const deleteBranch = request.delete_branch ?? record.deleteBranch ?? true;
        if (item) {
          record.gitDir = await this.verify(record, item, repo, active);
          if (item.locked !== undefined || item.prunable !== undefined) throw new Error("owned worktree is locked or prunable; resolve registration first");
          checkoutConfig = await this.checkoutConfiguration(target, active);
          const status = await this.checkedGit(target,
            [...checkoutConfig, "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching", "--ignore-submodules=none"], active);
          const sourceHead = (await this.checkedGit(this.workspace, ["rev-parse", "--verify", "HEAD^{commit}"], active)).trim();
          const merged = await this.git(this.workspace, ["merge-base", "--is-ancestor", item.head, sourceHead], active);
          if (merged.code !== 0 && merged.code !== 1) throw new Error(`Git merge inspection failed: ${merged.stderr.trim()}`);
          if (!request.discard_changes && (status.length > 0 || merged.code === 1)) {
            throw new Error(`worktree has ${status.length ? "dirty files" : "unmerged commits"}; pass discard_changes: true to remove it`);
          }
          record.state = "removing"; record.removalCommit = item.head; record.deleteBranch = deleteBranch;
          this.saveStore(store);
          await this.checkedGit(this.workspace,
            [...checkoutConfig, "worktree", "remove", ...(request.discard_changes ? ["--force"] : []), "--", target], active);
          inventory = await this.inventory(active);
        } else if (record.state !== "removing" || !record.removalCommit || !record.gitDir) {
          throw new Error("owned worktree registration is missing; removal requires a verified registration");
        }
        if (inventory.some((entry) => entry.path === target) || statOrMissing(target) || (record.gitDir && statOrMissing(record.gitDir))) {
          throw new Error("Git worktree removal did not clear its registered directory");
        }
        let branchDeleted = false;
        if (deleteBranch) {
          if (inventory.some((entry) => entry.branch === record.branch)) throw new Error("owned branch is checked out in another worktree");
          const exists = await this.git(this.workspace, ["show-ref", "--verify", "--quiet", record.branch], active);
          if (exists.code === 0) {
            const oid = (await this.checkedGit(this.workspace, ["show-ref", "--verify", "--hash", record.branch], active)).trim();
            if (oid !== record.removalCommit) throw new Error("owned branch changed since removal inspection; preserving it");
            // The expected OID makes branch deletion atomic against ref updates.
            await this.checkedGit(this.workspace, ["update-ref", "-d", record.branch, record.removalCommit!], active);
            branchDeleted = true;
          } else if (exists.code !== 1) throw new Error(`Git branch lookup failed (${exists.code}): ${exists.stderr.trim()}`);
        }
        store.records = store.records.filter((entry) => entry !== record);
        this.saveStore(store);
        return { path: target, branch: record.branch, branchDeleted };
      });
    });
  }

  /** Close cancels this manager's Git processes and preserves durable worktrees. */
  async close(): Promise<void> {
    this.closed = true;
    this.externalSignal?.removeEventListener("abort", this.onExternalAbort);
    this.lifetime.abort();
    await Promise.allSettled([...this.operations, ...this.running.values()]);
  }
}

/** A supplied manager enables explicit runtime lifecycle management. */
export function createWorktreeTools(manager?: WorktreeManager): ToolDefinition[] {
  const managers = new Map<string, WorktreeManager>();
  const getManager = (context: ToolContext) => {
    checkAbort(context.signal);
    const workspace = fs.realpathSync(path.resolve(context.workspace));
    if (manager) {
      if (workspace !== manager.workspace) throw new Error("worktree manager workspace mismatch");
      return manager;
    }
    let found = managers.get(workspace);
    if (!found) { found = new WorktreeManager({ workspace }); managers.set(workspace, found); }
    return found;
  };
  const output = (value: unknown, context: ToolContext) => capped(JSON.stringify(value, null, 2),
    Number.isFinite(context.maxOutputBytes) && context.maxOutputBytes > 0 ? Math.floor(context.maxOutputBytes) : 100_000);
  return [
    {
      readOnly: false,
      schema: { name: "worktree_create", description: "Create an owned Git worktree under .harness-worktrees and a new branch from base_ref (default HEAD). Returns its path without changing the agent workspace.",
        input_schema: { type: "object", properties: {
          name: { type: "string", description: "Single directory name, letters/digits/dots/underscores/dashes." },
          branch: { type: "string", description: "New branch name (default harness/<name>)." },
          base_ref: { type: "string", description: "Explicit local commit/ref to start from (default HEAD)." },
        }, required: ["name"], additionalProperties: false } },
      execute: async (input, context) => output(await getManager(context).create(createSchema.parse(input), context.signal), context),
    },
    {
      readOnly: true,
      schema: { name: "worktree_list", description: "List Git worktree registrations with verified harness ownership and durable state.",
        input_schema: { type: "object", properties: {}, required: [], additionalProperties: false } },
      execute: async (input, context) => { checkAbort(context.signal); z.object({}).strict().parse(input);
        return output(await getManager(context).list(context.signal), context); },
    },
    {
      readOnly: false,
      schema: { name: "worktree_remove", description: "Remove a registered harness-owned worktree. Dirty files and commits unmerged into the source HEAD require discard_changes=true. delete_branch defaults to true and only deletes its recorded owned branch.",
        input_schema: { type: "object", properties: {
          name: { type: "string", description: "Recorded owned worktree name." },
          discard_changes: { type: "boolean", description: "Explicitly discard dirty files or unmerged commits (default false)." },
          delete_branch: { type: "boolean", description: "Delete the recorded owned branch after removal (default true)." },
        }, required: ["name"], additionalProperties: false } },
      execute: async (input, context) => output(await getManager(context).remove(removeSchema.parse(input), context.signal), context),
    },
  ];
}
