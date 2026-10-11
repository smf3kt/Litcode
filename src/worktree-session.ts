import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { SessionConfig } from "./session.js";
import { WorktreeManager, WORKTREE_DIRECTORY, type WorktreeInfo } from "./worktrees.js";

export type WorktreeEntry = { path: string; origin: string; name: string; created: boolean };

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
      fs.renameSync(history, archive);
    }
    const result = await manager.remove({ name: item.name!, discard_changes: discardChanges });
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
    if (archive) throw new Error(`Worktree removal incomplete; history retained at ${archive}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally { await manager.close(); }
}
