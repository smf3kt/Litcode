import crypto from 'node:crypto';
import path from 'node:path';
import { matchesNativeErrorPrefix } from './directory-receipt-error.js';
import { capturedReplacementErrorBody } from './directory-rewind-captured.js';
import { isDeepStrictEqual } from 'node:util';
import { parseDirectoryFileObservationFrame, probeMissingDirectoryFile, readStableDirectoryFile,
  type BoundDirectoryFileObservation } from './directory-file-state.js';
import { DIRECTORY_REWIND_BYTE_CAP, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import type { Session } from './session.js';

type Operation = DirectoryRewindEvidence['operations'][number];
type Result = Extract<Operation['stage'], { kind: 'completed' }>['result'];
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const moved = (before: BoundDirectoryFileObservation, after: BoundDirectoryFileObservation) =>
  before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mode === after.mode &&
  before.nlink === '1' && after.nlink === '1' && before.mtimeSeconds === after.mtimeSeconds && before.mtimeNanoseconds === after.mtimeNanoseconds;

// The retained writer reaches committing (remove) or publishing (replace)
// before its final rename. At that point its only terminal error is unknown.
// EVr/RVr sfn1dbxq [4739632,4743506), sC f606a53w [12501,15618), UTF-16.
export function publishedReceiptText(bytes: Buffer, operation: Operation, reverse: boolean): string {
  const text = bytes.toString('utf8');
  const error = text.indexOf('\ne');
  if (error < 0 || !matchesNativeErrorPrefix(text.slice(error + 1), 'unknown')) return text;
  const body = text.slice(0, error + 1);
  const saved = reverse ? operation.rollbackContinuation : operation.continuation;
  const attempt = reverse ? operation.rollback : operation.stage;
  if (saved && attempt && attempt.kind !== 'prepared' && saved.id === attempt.id && saved.receiptDigest === hash(bytes)) {
    const captured = capturedReplacementErrorBody(text);
    if (captured) return captured;
  }
  if (/^intent remove [^\n]+\ncommitting\n/m.test(body) ||
      /^intent replace [^\n]+\ncapturing\ncaptured\npublishing\n/m.test(body)) return body;
  return text;
}

// Host crash reconciliation of EVr/RVr, sfn1dbxq
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4743506). This observes/syncs a bound completed effect; it
// never publishes a staged file or replays an unknown operation.
export function reconcilePublishedDirectoryAttempt(bytes: Buffer, operation: Operation, reverse: boolean,
  source: Session, signal: AbortSignal): Result | undefined {
  const text = publishedReceiptText(bytes, operation, reverse);
  if (!text.startsWith('directory-write-receipt-v2\n')) return;
  const intent = /^intent (remove|replace|create) ([^\n ]+) ([^\n ]+)\n/m.exec(text);
  if (!intent) return;
  const kind = intent[1], from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  if (kind !== (to.kind === 'missing' ? 'remove' : from.kind === 'present' ? 'replace' : 'create')) return;
  const prefix = `directory-write-receipt-v2\n${kind === 'remove' ? 'start\nchecking\n' : kind === 'replace' ? 'start\nstaging\nchecking\n' : 'start\nstaging\npublishing\n'}`;
  if (!text.startsWith(prefix) || intent.index !== prefix.length) return;
  const suffix = text.slice(intent.index + intent[0].length);
  const validSuffix = kind === 'remove' ? /^(?:committing\n(?:captured\n(?:held v2:[^\n]+\n(?:quarantined\n)?)?)?)?$/ :
    kind === 'replace' ? /^(?:capturing\n(?:captured\n(?:publishing\n(?:renamed\n(?:held v2:[^\n]+\n(?:landed v2:[^\n]+\n(?:durable\n)?)?)?)?)?)?)?$/ :
      /^(?:committing\n(?:renamed\n(?:landed v2:[^\n]+\n(?:durable\n)?)?)?)?$/;
  if (!validSuffix.test(suffix)) return;
  signal.throwIfAborted();
  if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased) throw new Error('External rewind authority closed');
  source.checkpointGateIdentity();
  const grant = source.workingDirectories(false).readHandle?.(operation.grant.root);
  if (!grant || grant.owner !== source.id || grant.signal.aborted || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
    throw new Error('External rewind requires an explicit grant for the original directory');
  const relative = path.relative(grant.root, operation.path), directory = path.dirname(relative);
  const attempt = reverse ? operation.rollback : operation.stage;
  if (!attempt || attempt.kind === 'prepared') return;
  const read = (relative: string, file: Extract<Operation['before'], { kind: 'present' }>) => {
    const result = readStableDirectoryFile({ fd: grant.fd, relative, sync: true }, DIRECTORY_REWIND_BYTE_CAP, signal);
    if (!result || result.bytes.length !== file.content.bytes || hash(result.bytes) !== file.content.sha256)
      throw new Error('External rewind file identity or content changed');
    return result.observation;
  };
  const missing = (relative: string, parent: BoundDirectoryFileObservation['parent']) => {
    if (!isDeepStrictEqual(probeMissingDirectoryFile({ fd: grant.fd, relative, sync: true }), parent))
      throw new Error('External rewind intermediate path changed');
  };
  let expected: BoundDirectoryFileObservation | undefined;
  if (from.kind === 'present') {
    if (reverse) {
      if (operation.stage.kind !== 'completed' || operation.stage.result.kind !== 'durable') return;
      expected = operation.stage.result.observation;
    } else expected = from.observation;
    if (!isDeepStrictEqual(parseDirectoryFileObservationFrame(intent[2]!), expected)) return;
  }
  let result: Result;
  if (kind === 'remove') {
    if (from.kind !== 'present' || to.kind !== 'missing' || !expected) return;
    const held = read(path.join(directory, `.litcode-remove-${attempt.id}`, 'held'), from);
    if (!moved(expected, held) || intent[3] !== `missing:${held.parent.dev}:${held.parent.ino}`) return;
    missing(relative, to.parent);
    result = { kind: 'quarantined', observation: held };
  } else {
    if (to.kind !== 'present') return;
    const staged = parseDirectoryFileObservationFrame(intent[3]!);
    const landed = read(relative, to);
    if (!moved(staged, landed) || landed.mode !== to.observation.mode || !isDeepStrictEqual(landed.parent, to.observation.parent)) return;
    if (kind === 'replace') {
      if (from.kind !== 'present' || !expected) return;
      const retained = path.join(directory, `.litcode-replace-${attempt.id}`), held = read(path.join(retained, 'held'), from);
      if (!moved(expected, held) || !isDeepStrictEqual(staged.parent, held.parent)) return;
      missing(path.join(retained, 'staged'), staged.parent);
      result = { kind: 'durable', observation: landed, held };
    } else {
      if (!/^\.litcode-tmp-[0-9]+-[0-9]+$/.test(intent[2]!) || !isDeepStrictEqual(staged.parent, landed.parent)) return;
      missing(path.join(directory, intent[2]!), staged.parent);
      result = { kind: 'durable', observation: landed };
    }
  }
  for (const line of suffix.matchAll(/^(held|landed) (v2:[^\n]+)$/gm)) {
    const observation = line[1] === 'landed' ? result.observation : result.kind === 'quarantined' ? result.observation : result.held;
    if (!isDeepStrictEqual(parseDirectoryFileObservationFrame(line[2]!), observation)) return;
  }
  return result;
}
