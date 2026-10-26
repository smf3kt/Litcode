import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { resolveChain, verifyIdentity, type ResolvedPath } from './path-identity.js';

// F/EE/te, 27et44g8 [12772,12808)/[14843,14970)/[16849,17024), UTF-16.
export function sessionPlanFile(userDirectory: string, id: string): string {
  return path.join(path.resolve(userDirectory), 'plans', `${id}.md`);
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
  const resolved = resolvePlanFile(workspace, file, file);
  if (!resolved?.identity) return null;
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { verifyIdentity(resolved); return fs.readFileSync(fd, 'utf8'); }
  finally { fs.closeSync(fd); }
}

// zco, 27et44g8 [14463,14763), UTF-16. The existing atomic writer owns local publication.
export function savePlanFile(workspace: string, file: string, text: string): void {
  const resolved = resolvePlanFile(workspace, file, file);
  if (resolved?.identity) verifyIdentity(resolved);
  atomicWriteFile(file, text, { mode: 0o600 });
}
