import fs from 'node:fs';
import { matchesNativeErrorPrefix } from './directory-receipt-error.js';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { prepareDirectoryCreation, publishPreparedDirectoryCreation } from './directory-create-native.js';
import { directoryFileObservationFrame as frame, parseDirectoryFileObservationFrame, probeMissingDirectoryFile,
  readStableDirectoryFile, observeDirectoryFileMetadata, type BoundDirectoryFileObservation } from './directory-file-state.js';
import { DIRECTORY_REWIND_BYTE_CAP, type DirectoryCreation, type DirectoryCreationPreparation, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import type { DirectoryReceiptFactory } from './directory-rewind-receipt.js';
import type { Session } from './session.js';

type Operation = DirectoryRewindEvidence['operations'][number];
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const header = 'directory-write-receipt-v2\n';
const origin = (a: BoundDirectoryFileObservation, b: BoundDirectoryFileObservation) => a.dev === b.dev && a.ino === b.ino &&
  a.size === b.size && a.nlink === '1' && b.nlink === '1' && a.mtimeSeconds === b.mtimeSeconds && a.mtimeNanoseconds === b.mtimeNanoseconds;
const preparedReceipt = (parent: BoundDirectoryFileObservation['parent'], mode: number, staged: BoundDirectoryFileObservation) => {
  const missing = `missing:${parent.dev}:${parent.ino}`;
  return `${header}start\nstaging\nchecking\ncreate_mode ${mode}\nintent prepare-create ${missing} ${frame(staged)}\nprepared_create ${missing} ${frame(staged)}\nprepared\nexit 0\n`;
};

// Native create_retained's terminal path records exactly one error followed by
// main's exit 1. sC/RVr source coordinates and host adaptation below.
// Retain every possible error family for a torn trailer; physical proof and
// phase ordering still have to agree. Never fill in original receipt bytes.
function createReceiptBody(bytes: Buffer, preparing: boolean) {
  const text = bytes.toString('utf8'), index = text.indexOf('\ne');
  if (index < 0) return { text, errors: undefined };
  const trailer = text.slice(index + 1);
  const candidates = ['not_prepared', 'preparation_incomplete', 'not_published', 'unknown']
    .filter(kind => matchesNativeErrorPrefix(trailer, kind));
  if (!candidates.length) return { text, errors: undefined };
  const errors = candidates.filter(kind => (preparing ? ['not_prepared', 'preparation_incomplete'] : ['not_published', 'unknown']).includes(kind));
  if (!errors.length) throw new Error('External rewind create error phase differs');
  return { text: text.slice(0, index + 1), errors };
}

// RVr/sC: sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// UTF-16 [4740702,4743506); f606a53w dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
// [12501,15618). Host journal adaptation: preparation cannot publish. Its inode
// and receipt must be durably saved before the separately receipted publisher.
// This owns the first persistence of the caller's in-memory attempting stage:
// no durable create attempt is emitted without its preparation receipt binding.
export function createRewindDirectoryFile(input: { operation: Operation; reverse: boolean; fd: number; relative: string;
  content: Buffer; objectPath: string; leaseFd: number | undefined; receipt: ReturnType<DirectoryReceiptFactory>;
  createReceipt: DirectoryReceiptFactory; persist: () => void; assert: () => void }) {
  const { operation, reverse } = input, from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  if (from.kind !== 'missing' || to.kind !== 'present') throw new Error('Invalid retained create direction');
  const id = crypto.randomUUID(), receipt = input.createReceipt(id);
  try {
    const evidence: DirectoryCreation = { phase: 'preparing', id, receipt: receipt.identity };
    if (reverse) operation.rollbackCreation = evidence; else operation.creation = evidence;
    input.persist(); input.assert();
    const desiredFd = fs.openSync(input.objectPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const prepared = prepareDirectoryCreation({ fd: input.fd, relative: input.relative, parent: from.parent,
        mode: to.observation.mode, content: input.content, desiredFd, transactionId: id, leaseFd: input.leaseFd, receiptFd: receipt.fd });
      if (prepared.kind !== 'prepared') throw new Error(`External rewind create preparation ${prepared.kind}; transaction retained`);
      const bytes = receipt.read();
      if (bytes.toString('utf8') !== preparedReceipt(from.parent, to.observation.mode, prepared.staged))
        throw new Error('External rewind create preparation receipt differs');
      const publishing: DirectoryCreation = { phase: 'publishing', id, receipt: receipt.identity,
        preparationDigest: hash(bytes), staged: prepared.staged };
      if (reverse) operation.rollbackCreation = publishing; else operation.creation = publishing;
      input.assert(); input.persist(); input.assert();
      const result = publishPreparedDirectoryCreation({ fd: input.fd, relative: input.relative, parent: from.parent,
        staged: prepared.staged, mode: to.observation.mode, desiredFd, transactionId: id, leaseFd: input.leaseFd, receiptFd: input.receipt.fd });
      // Retain both receipts on every failure, including pre-publication refusal.
      if (result.kind !== 'durable') throw new Error(`External rewind create publication ${result.kind}; transaction retained`);
      const published = input.receipt.read(), appliedLine = /^mode_applied (v2:[^\n]+)\n/m.exec(published.toString('utf8'));
      if (!appliedLine) throw new Error('External rewind create mode receipt missing');
      const applied = parseDirectoryFileObservationFrame(appliedLine[1]!);
      const expected = `${header}start\nchecking\ncreate_mode ${to.observation.mode}\nintent publish-create missing:${from.parent.dev}:${from.parent.ino} ${frame(prepared.staged)}\nmode_changing\nmode_applied ${frame(applied)}\npublishing\nrenamed\nlanded ${frame(result.observation)}\ndurable\nexit 0\n`;
      if (!origin(applied, prepared.staged) || applied.mode !== to.observation.mode || !isDeepStrictEqual(applied.parent, prepared.staged.parent) ||
          published.toString('utf8') !== expected || !receipt.read().equals(bytes)) throw new Error('External rewind create publication receipt differs');
      return { ...result, receiptDigest: hash(published) };
    } finally { fs.closeSync(desiredFd); }
  } finally { receipt.close(); }
}

// EVr/RVr, same module digest, UTF-16 [4739632,4743506). Adapt the existing
// no-effect/partial readers, retaining historical objects instead of replaying
// unknown syscalls. A completed historical outcome need not still be the target.
export function inspectRewindCreation(preparationBytes: Buffer, publicationBytes: Buffer, operation: Operation, reverse: boolean,
  source: Session, signal: AbortSignal, creationOverride?: DirectoryCreation, snapshotOverride?: DirectoryCreationPreparation) {
  operation = structuredClone(operation);
  const creation = structuredClone(creationOverride ?? (reverse ? operation.rollbackCreation : operation.creation));
  const from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  const attempt = reverse ? operation.rollback : operation.stage;
  if (!creation || from.kind !== 'missing' || to.kind !== 'present') throw new Error('Missing retained creation evidence');
  const grant = source.workingDirectories(false).readHandle?.(operation.grant.root);
  if (!grant || grant.owner !== source.id || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
    throw new Error('External rewind requires an explicit grant for the original directory');
  const authority = () => {
    signal.throwIfAborted(); source.checkpointGateIdentity();
    const current = source.workingDirectories(false).readHandle?.(grant.root);
    if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased || !current || current.fd !== grant.fd ||
        current.incarnation !== grant.incarnation || current.owner !== source.id || current.dev !== grant.dev || current.ino !== grant.ino ||
        grant.signal.aborted || current.signal.aborted) throw new Error('External rewind creation authority changed');
  };
  const relative = path.relative(grant.root, operation.path), retained = path.join(path.dirname(relative), `.litcode-create-${creation.id}`);
  const read = (name: string) => readStableDirectoryFile({ fd: grant.fd, relative: name, sync: true }, DIRECTORY_REWIND_BYTE_CAP, signal);
  const missing = (name: string) => probeMissingDirectoryFile({ fd: grant.fd, relative: name, sync: true });
  const unchanged = () => { authority(); return isDeepStrictEqual(missing(relative), from.parent); };
  const snapshot = (): DirectoryCreationPreparation => {
    authority();
    if (isDeepStrictEqual(missing(retained), from.parent)) return { kind: 'absent', parent: from.parent };
    const file = read(path.join(retained, 'staged'));
    if (!file) {
      const observation = observeDirectoryFileMetadata({ fd: grant.fd, relative: path.join(retained, 'staged') }, signal);
      if (observation && (observation.mode & 0o444) === 0) {
        authority(); return { kind: 'metadata', content: 'unverified', observation };
      }
    }
    const parent = file?.observation.parent ?? missing(path.join(retained, 'staged'));
    if (!parent || parent.dev !== from.parent.dev || isDeepStrictEqual(parent, from.parent)) throw new Error('External rewind create staging unresolved');
    authority();
    return { kind: 'retained', staged: file ? { kind: 'present', observation: file.observation,
      content: { bytes: file.bytes.length, sha256: hash(file.bytes) } } : { kind: 'missing', parent } };
  };
  const prep = createReceiptBody(preparationBytes, true), publication = createReceiptBody(publicationBytes, false);
  const prepText = prep.text, pubText = publication.text;
  let applied: BoundDirectoryFileObservation | undefined, prefix: string | undefined;
  if (creation.phase === 'publishing') {
    if (prep.errors || hash(preparationBytes) !== creation.preparationDigest || prepText !== preparedReceipt(from.parent, to.observation.mode, creation.staged))
      throw new Error('External rewind create preparation receipt changed');
    const modePrefix = `${header}start\nchecking\ncreate_mode ${to.observation.mode}\nintent publish-create missing:${from.parent.dev}:${from.parent.ino} ${frame(creation.staged)}\nmode_changing\n`;
    prefix = modePrefix;
    if (publication.errors && !publication.errors.some(kind => kind === 'not_published' ? modePrefix.startsWith(pubText) : pubText.startsWith(modePrefix)))
      throw new Error('External rewind create error phase differs');
    const match = /^mode_applied (v2:[^\n]+)\n/.exec(pubText.slice(prefix.length));
    if (pubText.startsWith(prefix) && match) {
      applied = parseDirectoryFileObservationFrame(match[1]!);
      if (!origin(applied, creation.staged) || applied.mode !== to.observation.mode || !isDeepStrictEqual(applied.parent, creation.staged.parent))
        throw new Error('External rewind create mode receipt changed');
      prefix += match[0];
    }
  } else if (publicationBytes.length) throw new Error('External rewind preparation has a publication receipt');

  const saved = snapshotOverride ? structuredClone(snapshotOverride) : undefined;
  if (!saved && creation.phase === 'publishing' && applied && prefix) {
    const completeStage = attempt?.kind === 'completed' && attempt.result.kind === 'durable' ? attempt.result : undefined;
    const landed = completeStage ? undefined : read(relative);
    // RVr sfn1dbxq [4740702,4743506), UTF-16, verifies through the readable
    // descriptor. At renamed the native writer has not reported landed bytes.
    if (!completeStage && !landed && (applied.mode & 0o444) === 0 &&
        pubText === `${prefix}publishing\nrenamed\n`) {
      authority();
      const named = observeDirectoryFileMetadata({ fd: grant.fd, relative }, signal);
      if (named && origin(named, applied) && named.mode === applied.mode && isDeepStrictEqual(named.parent, from.parent) &&
          isDeepStrictEqual(missing(path.join(retained, 'staged')), creation.staged.parent)) {
        authority();
        throw new Error(`External rewind needs read access to verify the published file ${JSON.stringify(operation.path)} (mode ${named.mode.toString(8).padStart(4, '0')}). Restore read access to the existing file and retry recovery.`);
      }
    }
    const observed = completeStage?.observation ?? landed?.observation;
    if (observed && origin(observed, applied) && observed.mode === to.observation.mode && isDeepStrictEqual(observed.parent, from.parent) &&
        (completeStage || (landed && landed.bytes.length === to.content.bytes && hash(landed.bytes) === to.content.sha256))) {
      const complete = `${prefix}publishing\nrenamed\nlanded ${frame(observed)}\ndurable\nexit 0\n`;
      if (!pubText.endsWith('\n') || !(publication.errors ? complete.slice(0, -'exit 0\n'.length) : complete).startsWith(pubText) || !pubText.startsWith(`${prefix}publishing\n`))
        throw new Error('External rewind create publication receipt differs');
      const verifyRetained = () => {
        authority();
        if (!isDeepStrictEqual(missing(path.join(retained, 'staged')), creation.staged.parent)) throw new Error('External rewind published staging changed');
        authority();
      };
      const result = { kind: 'durable' as const, observation: observed };
      const verify = () => {
        verifyRetained();
        const current = read(relative);
        if (!current || !isDeepStrictEqual(current.observation, observed) || current.bytes.length !== to.content.bytes || hash(current.bytes) !== to.content.sha256)
          throw new Error('External rewind created target changed');
        authority();
      };
      verifyRetained(); if (!completeStage) verify();
      return { kind: 'published' as const, result, verify, verifyRetained };
    }
  }
  if (!saved && !unchanged()) throw new Error('External rewind create target unresolved');
  const preparation = saved ?? snapshot();
  // sC f606a53w [12501,15618), UTF-16, chmod precedes publication.
  // Match a torn native mode report against independent current evidence, not
  // invented receipt fields. The original partial bytes remain immutable.
  const beforePublication = (observed: BoundDirectoryFileObservation) => !!prefix && (pubText === prefix ||
    (!applied && observed.mode === to.observation.mode && pubText.startsWith(prefix) &&
      `${prefix}mode_applied ${frame(observed)}\n`.startsWith(pubText)));
  if (preparation.kind === 'metadata') {
    // EVr's named stat is only retention evidence. The complete, pre-publication
    // receipt boundary proves no target rename was reached; these unknown bytes
    // cannot be restored, published or deleted. No leaf permissions are changed.
    const observed = preparation.observation;
    if (creation.phase !== 'publishing' || !beforePublication(observed) ||
        (observed.mode & 0o444) !== 0 || observed.mode !== to.observation.mode ||
        !origin(observed, creation.staged) || !isDeepStrictEqual(observed.parent, creation.staged.parent) ||
        (applied && !isDeepStrictEqual(observed, applied))) throw new Error('External rewind metadata-only creation unresolved');
  } else if (creation.phase === 'preparing') {
    const early = `${header}start\nstaging\nchecking\n`;
    const staged = preparation.kind === 'retained' && preparation.staged.kind === 'present' ? preparation.staged : undefined;
    const complete = staged && staged.observation.mode === 0o600 && staged.observation.nlink === '1' && isDeepStrictEqual(staged.content, to.content)
      ? preparedReceipt(from.parent, to.observation.mode, staged.observation) : early;
    if ((prep.errors && !prep.errors.some(kind => kind === 'preparation_incomplete' || `${header}start\n`.startsWith(prepText))) ||
        !(prep.errors ? complete.replace(/exit 0\n$/, '') : complete).startsWith(prepText))
      throw new Error('External rewind create preparation prefix differs');
  } else {
    const staged = preparation.kind === 'retained' && preparation.staged.kind === 'present' ? preparation.staged : undefined;
    // sC's chmod changes ctime before the mode_applied report. The complete
    // mode_changing prefix plus readable, original-inode desired bytes permits
    // retaining this observed staging snapshot, never publishing it on replay.
    const changedMode = staged && !applied && beforePublication(staged.observation) &&
      (staged.observation.mode === creation.staged.mode || staged.observation.mode === to.observation.mode);
    if (!staged || !isDeepStrictEqual(staged.content, to.content) || !origin(staged.observation, creation.staged) ||
        !isDeepStrictEqual(staged.observation.parent, creation.staged.parent) ||
        !(isDeepStrictEqual(staged.observation, creation.staged) || (applied && isDeepStrictEqual(staged.observation, applied)) || changedMode))
      throw new Error('External rewind create staged identity changed');
    if (!prefix || !(prefix.startsWith(pubText) || beforePublication(staged.observation) || (applied && `${prefix}publishing\n`.startsWith(pubText))))
      throw new Error('External rewind create publication prefix differs');
  }
  const verifyRetained = () => { if (!isDeepStrictEqual(snapshot(), preparation)) throw new Error('External rewind retained creation changed'); };
  verifyRetained();
  return { kind: 'prepared' as const, preparation: structuredClone(preparation), verifyRetained, verify: () => {
    if (!unchanged()) throw new Error('External rewind create target changed');
    verifyRetained();
  } };
}
