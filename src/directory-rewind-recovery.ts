import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { inspectDirectoryCheckpointWitness, readDirectoryCheckpointBackup } from './directory-checkpoint.js';
import { probeMissingDirectoryFile, readStableDirectoryFile, type BoundDirectoryFileObservation } from './directory-file-state.js';
import { directoryRewindEvidenceSchema, verifyDirectoryRewindObjects, DIRECTORY_REWIND_BYTE_CAP,
  type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import type { Session } from './session.js';

// EVr/RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4743506). Host cold verification: historical evidence never
// recreates a grant. The caller must also hold and prove the branch disposition.
export function directoryRewindRecoveryVerifier(source: Session, input: DirectoryRewindEvidence,
  readObject: (hash: string) => Buffer, signal: AbortSignal, disposition: 'committed' | 'rolled_back' | 'uncommitted',
  captured: ReadonlyMap<string, { reverse: boolean; verify: () => void }> = new Map(),
  grantOwner = source, inspectHeld?: (operation: DirectoryRewindEvidence['operations'][number], id: string, kind: 'replace' | 'remove',
    observation: BoundDirectoryFileObservation, digest: string) => void): (() => void) & { authority: () => void } {
  const record = directoryRewindEvidenceSchema.parse(input);
  if (source.id !== record.checkpoint.owner) throw new Error('Open the original checkpoint session to reconcile external rewind');
  const isCaptured = (operation: DirectoryRewindEvidence['operations'][number]) => disposition === 'uncommitted' && captured.has(operation.path) &&
    (captured.get(operation.path)!.reverse ? operation.stage.kind === 'completed' &&
      (operation.rollback?.kind === 'attempting' || operation.rollback?.kind === 'unknown') :
      !operation.rollback && (operation.stage.kind === 'attempting' || operation.stage.kind === 'unknown'));
  if (record.operations.some(operation => !isCaptured(operation) && (disposition === 'committed'
    ? operation.stage.kind !== 'completed' || operation.rollback
    : !((operation.stage.kind === 'prepared' || operation.stage.kind === 'refused') && !operation.rollback) &&
      !(operation.stage.kind === 'completed' && (operation.rollback?.kind === 'completed' ||
        (disposition === 'uncommitted' && !operation.rollback))))))
    throw new Error('External rewind has unresolved effects; transaction retained');
  const journal = source.checkpointJournalBytes();
  const checkpoint = source.events.findLast(event => event.kind === 'checkpoint' && event.name === record.checkpoint.name);
  if (!checkpoint || checkpoint.kind !== 'checkpoint' || checkpoint.digest !== record.checkpoint.digest)
    throw new Error('External rewind checkpoint changed');
  const witness = inspectDirectoryCheckpointWitness(source, record.checkpoint.name);
  if (witness.kind !== 'available') throw new Error('External rewind checkpoint witness unavailable');
  const grants = record.operations.map(operation => {
    const grant = grantOwner.workingDirectories(false).readHandle?.(operation.grant.root);
    if (!grant || grant.owner !== grantOwner.id || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
      throw new Error('External rewind requires an explicit grant for the original directory');
    return grant;
  });
  const authority = () => {
    signal.throwIfAborted();
    if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased) throw new Error('External rewind authority closed');
    source.checkpointGateIdentity();
    if (grantOwner !== source) grantOwner.checkpointGateIdentity();
    for (const [index, operation] of record.operations.entries()) {
      const grant = grants[index]!;
      const current = grantOwner.workingDirectories(false).readHandle?.(grant.root);
      if (!current || current.fd !== grant.fd || current.incarnation !== grant.incarnation || current.owner !== grant.owner ||
          current.dev !== grant.dev || current.ino !== grant.ino || grant.signal.aborted || current.signal.aborted)
        throw new Error('External rewind grant changed');
    }
    if (!source.checkpointJournalBytes().equals(journal)) throw new Error('External rewind source history changed');
  };
  const verify = () => {
    authority();
    const objects = verifyDirectoryRewindObjects(record, readObject);
    for (const [index, operation] of record.operations.entries()) {
      const grant = grants[index]!;
      const saved = witness.entries.find(entry => entry.path.lexicalPath === operation.path &&
        entry.path.grant.root === grant.root && entry.path.grant.dev === operation.grant.dev && entry.path.grant.ino === operation.grant.ino);
      if (!saved || saved.observation.kind !== operation.after.kind) throw new Error('External rewind checkpoint path changed');
      if (operation.after.kind === 'present') {
        const backup = readDirectoryCheckpointBackup(source, record.checkpoint.name, operation.path);
        if (saved.observation.kind !== 'present' || !isDeepStrictEqual(saved.observation.file, operation.after.observation) ||
            !backup?.equals(objects.get(operation.after.content.sha256)!)) throw new Error('External rewind checkpoint backup changed');
      } else if (saved.observation.kind !== 'missing' || !isDeepStrictEqual(saved.observation.parent, operation.after.parent))
        throw new Error('External rewind checkpoint parent changed');
      const relative = path.relative(grant.root, operation.path);
      const verifyFile = (name: string, observation: BoundDirectoryFileObservation, hash: string) => {
        const file = readStableDirectoryFile({ fd: grant.fd, relative: name }, DIRECTORY_REWIND_BYTE_CAP, signal);
        if (!file || !isDeepStrictEqual(file.observation, observation) || !file.bytes.equals(objects.get(hash)!))
          throw new Error('External rewind file identity or content changed');
      };
      // A terminal archive only acts on held files. Later edits at the live
      // target do not change the receipt or grant that identifies a held file.
      const targetMissing = (parent: BoundDirectoryFileObservation['parent']) => !!inspectHeld ||
        isDeepStrictEqual(probeMissingDirectoryFile({ fd: grant.fd, relative }), parent);
      const verifyTarget = (observation: BoundDirectoryFileObservation, digest: string) => {
        if (!inspectHeld) verifyFile(relative, observation, digest);
      };
      const verifyHeld = (id: string, kind: 'remove' | 'replace', observation: BoundDirectoryFileObservation, digest: string) => {
        if (inspectHeld) inspectHeld(operation, id, kind, observation, digest);
        else verifyFile(path.join(path.dirname(relative), `.litcode-${kind}-${id}`, 'held'), observation, digest);
      };
      if (isCaptured(operation)) {
        const continuation = captured.get(operation.path)!;
        continuation.verify();
        if (continuation.reverse) {
          if (operation.stage.kind !== 'completed' || operation.before.kind !== 'present')
            throw new Error('External rewind original retained observation missing');
          const forward = operation.stage.result, held = forward.kind === 'quarantined' ? forward.observation : forward.held;
          if (!held) throw new Error('External rewind original retained observation missing');
          verifyHeld(operation.stage.id, forward.kind === 'quarantined' ? 'remove' : 'replace', held, operation.before.content.sha256);
        }
        continue;
      }
      if (disposition !== 'committed' && (operation.stage.kind !== 'completed' || operation.rollback)) {
        if (operation.stage.kind === 'prepared' || operation.stage.kind === 'refused') {
          if (operation.before.kind === 'present') verifyTarget(operation.before.observation, operation.before.content.sha256);
          else if (!targetMissing(operation.before.parent))
            throw new Error('External rewind untouched target changed');
          continue;
        }
        if (operation.stage.kind !== 'completed' || operation.rollback?.kind !== 'completed') throw new Error('External rewind rollback outcome missing');
        const forward = operation.stage.result, reverse = operation.rollback.result;
        if (operation.before.kind === 'present') {
          if (reverse.kind !== 'durable') throw new Error('External rewind rollback publication missing');
          verifyTarget(reverse.observation, operation.before.content.sha256);
          const original = forward.kind === 'quarantined' ? forward.observation : forward.held;
          if (!original) throw new Error('External rewind original retained observation missing');
          verifyHeld(operation.stage.id, forward.kind === 'quarantined' ? 'remove' : 'replace', original, operation.before.content.sha256);
          if (operation.after.kind === 'present') {
            if (!reverse.held || reverse.held.dev !== forward.observation.dev || reverse.held.ino !== forward.observation.ino)
              throw new Error('External rewind rollback retained identity changed');
            verifyHeld(operation.rollback.id, 'replace', reverse.held, operation.after.content.sha256);
          }
        } else {
          if (reverse.kind !== 'quarantined' || operation.after.kind !== 'present' ||
              reverse.observation.dev !== forward.observation.dev || reverse.observation.ino !== forward.observation.ino ||
              !targetMissing(operation.before.parent))
            throw new Error('External rewind rollback removed target changed');
          verifyHeld(operation.rollback.id, 'remove', reverse.observation, operation.after.content.sha256);
        }
        continue;
      }
      if (operation.stage.kind !== 'completed') throw new Error('External rewind outcome missing');
      const result = operation.stage.result;
      if (operation.action === 'remove') {
        if (result.kind !== 'quarantined' || !targetMissing(operation.after.parent))
          throw new Error('External rewind removed target changed');
        verifyHeld(operation.stage.id, 'remove', result.observation, operation.before.content.sha256);
      } else {
        if (result.kind !== 'durable') throw new Error('External rewind publication outcome missing');
        verifyTarget(result.observation, operation.after.content.sha256);
        if (operation.before.kind === 'present') {
          if (!result.held) throw new Error('External rewind retained observation missing');
          verifyHeld(operation.stage.id, 'replace', result.held, operation.before.content.sha256);
        }
      }
    }
    if (!source.checkpointJournalBytes().equals(journal) || !isDeepStrictEqual(inspectDirectoryCheckpointWitness(source, record.checkpoint.name), witness))
      throw new Error('External rewind source history changed');
  };
  verify();
  return Object.assign(verify, { authority });
}
