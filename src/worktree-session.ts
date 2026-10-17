import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { SessionConfig } from "./session.js";
import { WorktreeManager, WORKTREE_DIRECTORY, type WorktreeInfo } from "./worktrees.js";

export type WorktreeEntry = { path: string; origin: string; name: string; created: boolean };
const INTENT = /^\.pending-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.json$/;
const INTENT_SCAN_CAP = 100;
const intentSchema = z.object({
  version: z.literal(1), id: z.string().uuid(), origin: z.string(), checkout: z.string(),
  history: z.string(), archive: z.string(), dev: z.number(), ino: z.number(),
  pid: z.number().int().positive(), created_at: z.string().datetime(),
}).strict();
type ArchiveIntent = z.infer<typeof intentSchema>;
function syncDirectory(directory: string): void {
  let fd: number;
  try { fd = fs.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
/** Records the archive rename before it happens so a power loss between the rename and the removal
 *  leaves a fact a later start can reconcile. This runtime owns the archive layout, so the intent
 *  is a local extension rather than a ported body. */
function writeIntent(file: string, value: ArchiveIntent): void {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    fs.writeFileSync(fd, JSON.stringify(value));
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, file);
    syncDirectory(path.dirname(file));
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function removeIntent(file: string): void {
  try { fs.unlinkSync(file); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  syncDirectory(path.dirname(file));
}
function ownerAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}
function realDirectory(target: string): boolean {
  try {
    const stat = fs.lstatSync(target);
    return stat.isDirectory() && !stat.isSymbolicLink() && fs.realpathSync(target) === target;
  } catch { return false; }
}
/** Reconciles archive intents left by an interrupted removal. A history that is already home only
 *  needs the intent cleared; an archived history whose unchanged checkout still exists is put back;
 *  a missing checkout means the removal completed, so the archive is final. Anything ambiguous is
 *  retained with a warning. */
export function recoverWorktreeArchives(workspace: string): { recovered: string[]; warnings: string[] } {
  const result: { recovered: string[]; warnings: string[] } = { recovered: [], warnings: [] };
  const origin = fs.realpathSync(path.resolve(workspace));
  const parent = path.join(origin, ".agent", "worktree-history");
  if (!fs.existsSync(parent)) return result;
  if (!realDirectory(parent)) throw new Error("Worktree archive directory must be a real directory");
  const names = fs.readdirSync(parent).filter((name) => INTENT.test(name)).sort();
  if (names.length > INTENT_SCAN_CAP) throw new Error("Worktree archive intent count exceeds cap");
  for (const name of names) {
    const file = path.join(parent, name), match = INTENT.exec(name)!;
    let intent: ArchiveIntent;
    try { intent = intentSchema.parse(JSON.parse(fs.readFileSync(file, "utf8"))); }
    catch { result.warnings.push(`${file}: invalid archive intent retained`); continue; }
    if (intent.id !== match[1]) { result.warnings.push(`${file}: archive intent identity mismatch retained`); continue; }
    if (intent.origin !== origin || intent.checkout !== path.join(origin, WORKTREE_DIRECTORY, path.basename(intent.checkout)) ||
      intent.history !== path.join(intent.checkout, ".agent") || path.dirname(intent.archive) !== parent ||
      !path.basename(intent.archive).startsWith(`${path.basename(intent.checkout)}-`)) {
      result.warnings.push(`${file}: archive intent paths are outside this workspace and were retained`);
      continue;
    }
    if (ownerAlive(intent.pid)) { result.warnings.push(`${file}: archive intent owner is still running and was retained`); continue; }
    const history = fs.existsSync(intent.history), archive = fs.existsSync(intent.archive);
    if (history) {
      if (archive) result.warnings.push(`${file}: history and archive both exist; intent retained`);
      else removeIntent(file);
      continue;
    }
    if (!archive) { result.warnings.push(`${file}: neither history nor archive exists; intent retained`); continue; }
    const checkout = fs.existsSync(intent.checkout) ? fs.lstatSync(intent.checkout) : undefined;
    if (!checkout) { removeIntent(file); continue; }
    if (!checkout.isDirectory() || checkout.isSymbolicLink() || checkout.dev !== intent.dev || checkout.ino !== intent.ino) {
      result.warnings.push(`${file}: checkout identity changed; archive retained at ${intent.archive}`);
      continue;
    }
    if (!realDirectory(intent.archive)) { result.warnings.push(`${file}: archive is not a real directory; intent retained`); continue; }
    fs.renameSync(intent.archive, intent.history);
    syncDirectory(path.dirname(intent.history));
    removeIntent(file);
    result.recovered.push(intent.archive);
  }
  return result;
}

function verifiedCheckout(item: WorktreeInfo, origin: string): string {
  if (!item.owned || item.state !== "ready" || item.verificationError || item.prunable !== undefined ||
    !item.name || item.path !== path.join(origin, WORKTREE_DIRECTORY, item.name)) {
    throw new Error(`Worktree ownership verification failed: ${item.verificationError ?? item.name ?? item.path}`);
  }
  return item.path;
}

/** Resolve an owned checkout; the caller relocates the completed session afterwards. */
export async function resolveWorktreeEntry(config: SessionConfig, name: string, signal?: AbortSignal): Promise<WorktreeEntry> {
  if (config.worktreeReturn !== undefined) throw new Error("Exit the active worktree before entering another worktree");
  if (config.features?.worktrees === false) throw new Error("Worktrees are disabled in this session");
  if (name.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || name.endsWith(".lock")) {
    throw new Error("Use /worktree NAME with a single valid worktree name");
  }
  const manager = new WorktreeManager({ workspace: config.workspace, signal });
  try {
    const origin = manager.workspace;
    const matches = (await manager.list()).filter((item) => item.name === name);
    if (matches.length > 1) throw new Error("Worktree ownership identity is ambiguous");
    const existing = matches[0];
    const item = existing ?? await manager.create({ name });
    return { path: verifiedCheckout(item, origin), origin, name, created: existing === undefined };
  } finally { await manager.close(); }
}

/** Verify the return relationship and retain both the checkout and its branch. */
export async function resolveWorktreeExit(config: SessionConfig, signal?: AbortSignal): Promise<string> {
  if (!config.worktreeReturn) throw new Error("This session has no active worktree return workspace");
  const returnPath = path.resolve(config.worktreeReturn);
  const stat = fs.lstatSync(returnPath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Worktree return workspace must be an existing real directory");
  const origin = fs.realpathSync(returnPath);
  const manager = new WorktreeManager({ workspace: origin, signal });
  try {
    const current = path.resolve(config.workspace);
    const matches = (await manager.list()).filter((item) => item.path === current);
    if (matches.length !== 1) throw new Error("Current workspace is absent from the return workspace worktree inventory");
    verifiedCheckout(matches[0]!, origin);
    return origin;
  } finally { await manager.close(); }
}

/** Remove only after the caller has returned and released the checkout journal. */
export async function removeExitedWorktree(config: SessionConfig, discardChanges = false, signal?: AbortSignal): Promise<{ archive?: string; branchDeleted: boolean }> {
  const origin = await resolveWorktreeExit(config, signal);
  const checkout = path.resolve(config.workspace);
  const checkoutIdentity = fs.lstatSync(checkout);
  const manager = new WorktreeManager({ workspace: origin, signal });
  let archive: string | undefined;
  let intent: string | undefined;
  // Reconcile a previous interruption before starting another removal; a pending intent whose
  // owner is still running is skipped.
  recoverWorktreeArchives(origin);
  const history = path.join(checkout, ".agent");
  try {
    const item = (await manager.list()).find(entry => entry.path === checkout)!;
    verifiedCheckout(item, origin);
    if (fs.existsSync(history)) {
      const identity = fs.lstatSync(history);
      if (!identity.isDirectory() || identity.isSymbolicLink()) throw new Error("Worktree history must be a real directory");
      let entries = 0;
      const inspect = (directory: string, depth: number) => {
        if (depth > 16) throw new Error("Worktree history archive depth exceeded");
        for (const name of fs.readdirSync(directory)) {
          if (++entries > 10000) throw new Error("Worktree history archive entry limit exceeded");
          if (name.endsWith(".lock")) throw new Error("Worktree history is still locked; keep the checkout until its owners exit");
          const file = path.join(directory, name), stat = fs.lstatSync(file);
          if (stat.isDirectory() && !stat.isSymbolicLink()) inspect(file, depth + 1);
        }
      };
      inspect(history, 0);
      const parent = path.join(origin, ".agent", "worktree-history");
      for (const directory of [path.dirname(parent), parent]) {
        if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
        const stat = fs.lstatSync(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Worktree archive directory must be a real directory");
      }
      signal?.throwIfAborted();
      const current = fs.lstatSync(history);
      if (current.dev !== identity.dev || current.ino !== identity.ino) throw new Error("Worktree history identity changed");
      archive = path.join(parent, `${item.name}-${randomUUID()}`);
      intent = path.join(parent, `.pending-${randomUUID()}.json`);
      writeIntent(intent, { version: 1, id: path.basename(intent).slice(8, -5), origin, checkout, history, archive,
        dev: checkoutIdentity.dev, ino: checkoutIdentity.ino, pid: process.pid, created_at: new Date().toISOString() });
      fs.renameSync(history, archive);
      syncDirectory(parent);
    }
    const result = await manager.remove({ name: item.name!, discard_changes: discardChanges });
    if (intent) { removeIntent(intent); intent = undefined; }
    return { ...(archive ? { archive } : {}), branchDeleted: result.branchDeleted };
  } catch (error) {
    if (archive && fs.existsSync(checkout) && !fs.existsSync(history)) {
      const current = fs.lstatSync(checkout);
      if (current.isSymbolicLink() || current.dev !== checkoutIdentity.dev || current.ino !== checkoutIdentity.ino) {
        throw new Error(`Worktree identity changed; history retained at ${archive}`);
      }
      try { fs.renameSync(archive, history); archive = undefined; }
      catch (restoreError) { throw new AggregateError([error, restoreError], `Worktree removal failed; history retained at ${archive}`); }
    }
    if (intent) {
      try {
        // Settled: restored, never archived, or the checkout is gone and the archive is final.
        if (!archive || !fs.existsSync(checkout)) { removeIntent(intent); intent = undefined; }
      } catch { /* retain the intent when its cleanup cannot be observed */ }
    }
    if (archive) throw new Error(`Worktree removal incomplete; history retained at ${archive}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally { await manager.close(); }
}
