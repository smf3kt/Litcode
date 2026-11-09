import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { inspectDirectoryCheckpointWitness, readDirectoryCheckpointBackup } from './directory-checkpoint.js';
import { probeMissingDirectoryFile, readStableDirectoryFile, type BoundDirectoryFileObservation } from './directory-file-state.js';
import type { DirectoryReadHandle } from './path-identity.js';
import type { Session } from './session.js';
import { directoryRewindPlanDigest } from './directory-rewind-evidence.js';

type Parent = BoundDirectoryFileObservation['parent'];
type FileState = { kind: 'missing'; parent: Parent } |
  { kind: 'present'; observation: BoundDirectoryFileObservation; bytes: Buffer };
export type DirectoryRewindPlan = { kind: 'unknown' } | {
  kind: 'available'; owner: string; checkpoint: { owner: string; name: string; digest: string }; entries: {
    path: string; grant: Pick<DirectoryReadHandle, 'root' | 'owner' | 'incarnation'> & { dev: string; ino: string };
    before: FileState; after: FileState; action: 'write' | 'remove' | 'unchanged';
  }[];
  digest: string;
};

// Cwt/kVr/EVr/RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4734814,4737243)/[4739632,4743506). Adapt source snapshot selection
// and byte/mode comparison to checkpoint receipts and current grant FDs.
// This is a bounded observation, not permission to mutate. Application must
// recapture the plan and bind publication to its own durable transaction.
export function planDirectoryRewind(session: Session, name: string, signal: AbortSignal, authority: Session = session): DirectoryRewindPlan {
  const unknown: DirectoryRewindPlan = { kind: 'unknown' };
  signal.throwIfAborted();
  try {
    if (authority.config.workspace !== session.config.workspace) return unknown;
    const journal = session.checkpointJournalBytes();
    const witness = inspectDirectoryCheckpointWitness(session, name);
    const paths = session.directoryCheckpointPathsAt(session.events.length);
    if (witness.kind !== 'available' || paths.kind !== 'available') return unknown;
    const saved = session.events.findLast(event => event.kind === 'checkpoint' && event.name === name);
    if (!saved || saved.kind !== 'checkpoint') return unknown;
    const checkpoint = { owner: session.id, name, digest: saved.digest };
    // A later first-tracked file does not establish a selected checkpoint's state.
    if (paths.paths.length !== witness.entries.length || paths.paths.some(target => !witness.entries.some(entry =>
      entry.path.lexicalPath === target.lexicalPath && isDeepStrictEqual(entry.path.grant, target.grant)))) return unknown;
    let remaining = 32 * 1024 * 1024;
    const entries: Extract<DirectoryRewindPlan, { kind: 'available' }>['entries'] = [];
    const grants: DirectoryReadHandle[] = [];
    const assertCurrent = (grant: DirectoryReadHandle) => {
      signal.throwIfAborted();
      const current = authority.workingDirectories(false).readHandle?.(grant.root);
      if (!session.isOpen || session.isJournalFenced || !authority.isOpen || authority.isJournalFenced || authority.isDirectoryAuthorityReleased || grant.signal.aborted ||
          !current || current.signal.aborted || current.owner !== authority.id || grant.owner !== authority.id ||
          current.incarnation !== grant.incarnation || current.fd !== grant.fd || current.dev !== grant.dev || current.ino !== grant.ino)
        throw new Error('Directory rewind grant changed');
      authority.checkpointGateIdentity();
    };
    for (const entry of witness.entries) {
      if (entry.observation.kind === 'unavailable') return unknown;
      const grant = authority.workingDirectories(false).readHandle?.(entry.path.grant.root);
      if (!grant || String(grant.dev) !== entry.path.grant.dev || String(grant.ino) !== entry.path.grant.ino) return unknown;
      assertCurrent(grant); grants.push(grant);
      const relative = path.relative(grant.root, entry.path.lexicalPath);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return unknown;
      const parent = entry.observation.kind === 'present' ? entry.observation.file.parent : entry.observation.parent;
      let after: FileState;
      if (entry.observation.kind === 'missing') after = { kind: 'missing', parent };
      else {
        if (BigInt(entry.observation.file.size) > BigInt(remaining)) return unknown;
        const bytes = readDirectoryCheckpointBackup(session, name, entry.path.lexicalPath);
        if (!bytes || bytes.length > remaining || BigInt(bytes.length) !== BigInt(entry.observation.file.size)) return unknown;
        remaining -= bytes.length;
        after = { kind: 'present', observation: entry.observation.file, bytes };
      }
      const missing = probeMissingDirectoryFile({ fd: grant.fd, relative });
      let before: FileState;
      if (missing) before = { kind: 'missing', parent: missing };
      else {
        const current = readStableDirectoryFile({ fd: grant.fd, relative }, remaining, signal);
        if (!current || current.observation.nlink !== '1') return unknown;
        remaining -= current.bytes.length;
        before = { kind: 'present', observation: current.observation, bytes: current.bytes };
      }
      if (!isDeepStrictEqual(parent, before.kind === 'missing' ? before.parent : before.observation.parent)) return unknown;
      assertCurrent(grant);
      const action = after.kind === 'missing' ? before.kind === 'missing' ? 'unchanged' : 'remove' :
        before.kind === 'present' && before.bytes.equals(after.bytes) && before.observation.mode === after.observation.mode ? 'unchanged' : 'write';
      entries.push({ path: entry.path.lexicalPath, grant: { root: grant.root, owner: grant.owner, incarnation: grant.incarnation,
        dev: String(grant.dev), ino: String(grant.ino) }, before, after, action });
    }
    for (const grant of grants) assertCurrent(grant);
    if (!session.checkpointJournalBytes().equals(journal) || !isDeepStrictEqual(inspectDirectoryCheckpointWitness(session, name), witness)) return unknown;
    const plan: Omit<Extract<DirectoryRewindPlan, { kind: 'available' }>, 'digest'> = { kind: 'available', owner: authority.id, checkpoint, entries };
    return { ...plan, digest: directoryRewindPlanDigest(plan) };
  } catch {
    signal.throwIfAborted();
    return unknown;
  }
}
