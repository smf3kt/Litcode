import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { resolveChain, verifyIdentity, type ResolvedPath } from './path-identity.js';
import { createPathIdentity } from './path-approval-identity-source.js';

// F/EE/te, 27et44g8 [12772,12808)/[14843,14970)/[16849,17024), UTF-16.
export function sessionPlanFile(userDirectory: string, id: string, workspace?: string, configured?: string, agentId?: string): string {
  const fallback = path.join(path.resolve(userDirectory), 'plans');
  return path.join(workspace && configured ? planDirectory(workspace, configured) ?? fallback : fallback, `${id}${agentId ? `-agent-${agentId}` : ''}.md`);
}

export interface PlanOwnership {
  readonly directory: string;
  readonly slug: string;
}

// fl, 2bcyxj9q [205509,205734), UTF-16. Workshop has a separate source feature gate.
export function ownsPlanPath(owner: PlanOwnership, candidate: string): boolean {
  const normalized = path.resolve(candidate).normalize('NFC');
  if (path.dirname(normalized) !== owner.directory.normalize('NFC')) return false;
  const name = path.basename(normalized);
  return name === `${owner.slug}.md` || name.startsWith(`${owner.slug}-agent-`) && name.endsWith('.md');
}

// fl/Ol, 2bcyxj9q [205509,205734)/[240626,240892), UTF-16.
export function resolveOwnedPlanFile(workspace: string, input: string, owner: PlanOwnership, mustExist = false): ResolvedPath | undefined {
  const requested = path.resolve(workspace, input);
  if (!ownsPlanPath(owner, requested)) return undefined;
  return resolvePlanFile(workspace, input, requested, mustExist);
}

// V/ke, 27et44g8 [13330,14217); ff/He, gyf58rwf [64754,68000), UTF-16.
export function planDirectory(workspace: string, configured: string): string | undefined {
  const root = path.resolve(workspace);
  const candidate = path.resolve(root, configured);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return undefined;
  if (candidate.includes('\\')) return undefined;
  const filesystem = {
    lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync,
    openDirNoFollowSync(value: string) {
      const fd = fs.openSync(value, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
      fs.closeSync(fd);
    },
  };
  const source = createPathIdentity({ ie: () => filesystem, qpt: () => null });
  if (source.ff(filesystem, candidate, undefined) !== undefined) return undefined;
  const real = (value: string): string | null => {
    try { return fs.realpathSync.native(value).normalize('NFC'); } catch { return null; }
  };
  const base = real(root);
  if (base === null) return undefined;
  let current = candidate;
  for (;;) {
    const resolved = real(current);
    if (resolved !== null) return resolved === base || resolved.startsWith(base + path.sep) ? candidate : undefined;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

// fl/sNe/aNe, 2bcyxj9q [205509,205734)/[238027,238395)/[241113,242279), UTF-16.
export function resolvePlanFile(workspace: string, input: string, file: string, mustExist = false): ResolvedPath | undefined {
  const requested = path.resolve(workspace, input);
  if (requested !== file) return undefined;
  const resolved = resolveChain(workspace, requested);
  if (resolved.hops.length || resolved.path !== file) throw new Error('Plan file must have a stable path without symbolic links');
  if (mustExist && !resolved.identity) throw new Error('Plan file does not exist');
  if (resolved.identity && !fs.statSync(file).isFile()) throw new Error('Plan file is not a regular file');
  return resolved;
}

// TKe/zK/te, 27et44g8 [15903,16247)/[16849,17024), UTF-16. Local disk replaces StorageV5.
export function readPlanFile(workspace: string, file: string): string | null {
  return readPlanBytes(workspace, file)?.toString('utf8') ?? null;
}

export function readPlanBytes(workspace: string, file: string): Buffer | null {
  const resolved = resolvePlanFile(workspace, file, file);
  if (!resolved?.identity) return null;
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { verifyIdentity(resolved); return fs.readFileSync(fd); }
  finally { fs.closeSync(fd); }
}

// zco, 27et44g8 [14463,14763), UTF-16. The existing atomic writer owns local publication.
export function savePlanFile(workspace: string, file: string, text: string | Uint8Array): void {
  const resolved = resolvePlanFile(workspace, file, file);
  if (resolved?.identity) verifyIdentity(resolved);
  atomicWriteFile(file, text, { mode: 0o600 });
}
