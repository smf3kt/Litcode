import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseDirectoryFileObservationFrame, readLinkedDirectoryPair } from './directory-file-state.js';
import { DIRECTORY_REWIND_BYTE_CAP, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import type { Session } from './session.js';
import { normalizeLinkedDirectoryFile } from './directory-linked-native.js';

type Operation = DirectoryRewindEvidence['operations'][number];
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');

export function openLinkedWitness(content: { bytes: number; sha256: string }, objectPath: (hash: string) => string) {
  const fd = fs.openSync(objectPath(content.sha256), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size !== content.bytes || stat.size > DIRECTORY_REWIND_BYTE_CAP)
      throw new Error('External rewind linked object changed');
    const bytes = fs.readFileSync(fd);
    if (bytes.length !== content.bytes || hash(bytes) !== content.sha256) throw new Error('External rewind linked object changed');
    return { fd, bytes, close: () => fs.closeSync(fd) };
  } catch (error) { fs.closeSync(fd); throw error; }
}

// EVr/RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4743506). Host legacy-pair evidence only. The caller reads an
// inode-bound receipt; this closure does not classify the effect as completed.
export function inspectLinkedDirectoryAttempt(bytes: Buffer, operation: Operation, reverse: boolean, source: Session, signal: AbortSignal) {
  operation = structuredClone(operation);
  const match = /^directory-write-receipt-v2\nstart\nstaging\npublishing\nintent create (\.litcode-tmp-[0-9]+-[0-9]+) (v2:[^\n ]+)\ncommitting\n$/.exec(bytes.toString('utf8'));
  const from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  const attempt = reverse ? operation.rollback : operation.stage;
  if (!match || from.kind !== 'missing' || to.kind !== 'present' || !attempt ||
      (attempt.kind !== 'attempting' && attempt.kind !== 'unknown')) return;
  if (reverse && (operation.stage.kind !== 'completed' || operation.stage.result.kind !== 'quarantined')) return;
  const staged = parseDirectoryFileObservationFrame(match[2]!);
  if (staged.nlink !== '1' || staged.size !== String(to.content.bytes) || staged.mode !== to.observation.mode ||
      !isDeepStrictEqual(staged.parent, from.parent) || !isDeepStrictEqual(staged.parent, to.observation.parent)) return;
  const grant = source.workingDirectories(false).readHandle?.(operation.grant.root);
  if (!grant || grant.owner !== source.id ||
      String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
    throw new Error('External rewind requires an explicit grant for the original directory');
  const relative = path.relative(grant.root, operation.path), alias = match[1]!;
  const authority = () => {
    signal.throwIfAborted(); source.checkpointGateIdentity();
    const current = source.workingDirectories(false).readHandle?.(grant.root);
    if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased || !current || current.fd !== grant.fd ||
        current.incarnation !== grant.incarnation || current.owner !== source.id || current.dev !== grant.dev || current.ino !== grant.ino ||
        grant.signal.aborted || current.signal.aborted) throw new Error('External rewind linked authority changed');
  };
  const observe = () => {
    authority();
    const file = readLinkedDirectoryPair({ fd: grant.fd, relative, alias }, DIRECTORY_REWIND_BYTE_CAP, signal);
    if (!file) return;
    const actual = file.observation;
    if (actual.dev !== staged.dev || actual.ino !== staged.ino || actual.mode !== staged.mode || actual.size !== staged.size ||
        actual.mtimeSeconds !== staged.mtimeSeconds || actual.mtimeNanoseconds !== staged.mtimeNanoseconds ||
        !isDeepStrictEqual(actual.parent, staged.parent) || file.bytes.length !== to.content.bytes || hash(file.bytes) !== to.content.sha256)
      throw new Error('External rewind linked identity or content changed');
    authority();
    return { id: attempt.id, reverse, receiptDigest: hash(bytes), alias, observation: actual };
  };
  const observed = observe();
  if (!observed) return;
  const verify = () => {
    if (!isDeepStrictEqual(observe(), observed)) throw new Error('External rewind linked state changed');
  };
  return { kind: 'initial' as const, reverse, evidence: structuredClone(observed), verify,
    normalize: (transactionId: string, receiptFd: number, leaseFd: number, objectPath: (hash: string) => string) => {
      verify();
      const witness = openLinkedWitness(to.content, objectPath);
      try {
        const result = normalizeLinkedDirectoryFile({ fd: grant.fd, relative, alias, expected: observed.observation,
          originalFd: witness.fd, content: witness.bytes, transactionId, receiptFd, leaseFd });
        authority();
        if (result.kind !== 'normalized') throw new Error(`External rewind linked normalization ${result.kind}; transaction retained`);
      } finally { witness.close(); }
    } };
}
