import crypto from 'node:crypto';
import fs from 'node:fs';
import { matchesNativeErrorPrefix } from './directory-receipt-error.js';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parseDirectoryFileObservationFrame, probeMissingDirectoryFile, readStableDirectoryFile, publishCapturedDirectoryFile,
  type BoundDirectoryFileObservation } from './directory-file-state.js';
import { capturedDirectoryContinuationSchema, DIRECTORY_REWIND_BYTE_CAP,
  type CapturedDirectoryContinuation, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import type { Session } from './session.js';

type Operation = DirectoryRewindEvidence['operations'][number];
type Result = Extract<Operation['stage'], { kind: 'completed' }>['result'];
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const moved = (a: BoundDirectoryFileObservation, b: BoundDirectoryFileObservation) => a.dev === b.dev && a.ino === b.ino &&
  a.size === b.size && a.mode === b.mode && a.nlink === '1' && b.nlink === '1' && a.mtimeSeconds === b.mtimeSeconds && a.mtimeNanoseconds === b.mtimeNanoseconds;

export function capturedResultMatches(saved: CapturedDirectoryContinuation, digest: string, result: Result): boolean {
  return saved.receiptDigest === digest && result.kind === 'durable' && isDeepStrictEqual(saved.held, result.held) &&
    moved(saved.staged, result.observation) && isDeepStrictEqual(saved.parent, result.observation.parent);
}

// The original writer can fail after moving the old inode into held. Keep
// the full receipt for the continuation digest and compare its protocol body.
export function capturedReplacementErrorBody(text: string): string | undefined {
  const index = text.indexOf('\ne');
  if (index < 0 || !matchesNativeErrorPrefix(text.slice(index + 1), 'unknown')) return;
  const body = text.slice(0, index + 1);
  if (/\ncapturing\n(?:captured\n(?:publishing\n)?)?$/.test(body)) return body;
}

// EVr/RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4743506). Host continuation uses exact retained provenance;
// the checkpoint caller must persist this evidence under its gate before publish.
export function inspectCapturedDirectoryAttempt(bytes: Buffer, operation: Operation, reverse: boolean, source: Session, signal: AbortSignal) {
  const raw = bytes.toString('utf8');
  const match = /^directory-write-receipt-v2\nstart\nstaging\nchecking\nintent replace (v2:[^\n ]+) (v2:[^\n ]+)\n(?:capturing\n(?:captured\n(?:publishing\n)?)?)?$/.exec(capturedReplacementErrorBody(raw) ?? raw);
  const from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  const attempt = reverse ? operation.rollback : operation.stage;
  if (!match || from.kind !== 'present' || to.kind !== 'present' || !attempt || !['attempting', 'unknown'].includes(attempt.kind) || attempt.kind === 'prepared') return;
  let expected = from.observation;
  if (reverse) {
    if (operation.stage.kind !== 'completed' || operation.stage.result.kind !== 'durable') return;
    expected = operation.stage.result.observation;
  }
  const original = parseDirectoryFileObservationFrame(match[1]!), stagedIntent = parseDirectoryFileObservationFrame(match[2]!);
  if (!isDeepStrictEqual(original, expected) || !isDeepStrictEqual(expected.parent, to.observation.parent)) return;
  const grant = source.workingDirectories(false).readHandle?.(operation.grant.root);
  if (!grant || grant.owner !== source.id || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
    throw new Error('External rewind requires an explicit grant for the original directory');
  const relative = path.relative(grant.root, operation.path), retained = path.join(path.dirname(relative), `.litcode-replace-${attempt.id}`);
  const authority = () => {
    signal.throwIfAborted(); source.checkpointGateIdentity();
    const current = source.workingDirectories(false).readHandle?.(grant.root);
    if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased || !current || current.fd !== grant.fd ||
        current.incarnation !== grant.incarnation || current.owner !== source.id || current.dev !== grant.dev || current.ino !== grant.ino ||
        grant.signal.aborted || current.signal.aborted) throw new Error('External rewind captured authority changed');
  };
  const observe = () => {
    authority();
    if (!isDeepStrictEqual(probeMissingDirectoryFile({ fd: grant.fd, relative, sync: true }), expected.parent)) return;
    const read = (name: string, content: typeof from.content) => {
      const file = readStableDirectoryFile({ fd: grant.fd, relative: path.join(retained, name), sync: true }, DIRECTORY_REWIND_BYTE_CAP, signal);
      if (!file || file.bytes.length !== content.bytes || hash(file.bytes) !== content.sha256) throw new Error('External rewind captured file changed');
      return file.observation;
    };
    const held = read('held', from.content), staged = read('staged', to.content);
    if (!moved(expected, held) || !isDeepStrictEqual(staged, stagedIntent) || !isDeepStrictEqual(held.parent, staged.parent) ||
        staged.mode !== to.observation.mode || (held.dev === staged.dev && held.ino === staged.ino)) throw new Error('External rewind captured identity changed');
    authority();
    return capturedDirectoryContinuationSchema.parse({ kind: 'publish-captured', id: attempt.id,
      receiptDigest: hash(bytes), parent: expected.parent, held, staged });
  };
  const evidence = observe();
  if (!evidence) return;
  const saved = reverse ? operation.rollbackContinuation : operation.continuation;
  if (saved && !isDeepStrictEqual(saved, evidence)) throw new Error('External rewind captured continuation changed');
  const verify = () => { if (!isDeepStrictEqual(observe(), evidence)) throw new Error('External rewind captured state changed'); };
  return { evidence, reverse, verify, publish: (leaseFd: number, objectPath: (hash: string) => string) => {
    verify();
    const originalFd = fs.openSync(objectPath(from.content.sha256), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const desiredFd = fs.openSync(objectPath(to.content.sha256), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      try {
        const result = publishCapturedDirectoryFile({ fd: grant.fd, relative, ...evidence, transactionId: evidence.id, originalFd, desiredFd, leaseFd });
        authority();
        if (result.kind !== 'durable') throw new Error(`External rewind captured continuation ${result.kind}; transaction retained`);
      } finally { fs.closeSync(desiredFd); }
    } finally { fs.closeSync(originalFd); }
  } };
}
