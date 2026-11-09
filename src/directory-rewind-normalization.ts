import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { matchesNativeErrorPrefix } from './directory-receipt-error.js';
import { isDeepStrictEqual } from 'node:util';
import { directoryFileObservationFrame, parseDirectoryFileObservationFrame, probeMissingDirectoryFile, readStableDirectoryFile, type BoundDirectoryFileObservation } from './directory-file-state.js';
import { observeLinkedRetainedDirectoryFile, publishLinkedCapturedDirectoryFile } from './directory-linked-native.js';
import { DIRECTORY_REWIND_BYTE_CAP, type DirectoryRewindEvidence, type LinkedNormalization, type DirectoryPreparation } from './directory-rewind-evidence.js';
import { inspectLinkedDirectoryAttempt, openLinkedWitness } from './directory-rewind-linked.js';
import type { Session } from './session.js';

type Operation = DirectoryRewindEvidence['operations'][number];
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex');
const origin = (a: BoundDirectoryFileObservation, b: BoundDirectoryFileObservation) => a.dev === b.dev && a.ino === b.ino &&
  a.size === b.size && a.mode === b.mode && a.mtimeSeconds === b.mtimeSeconds && a.mtimeNanoseconds === b.mtimeNanoseconds;

// RVr/sC, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// UTF-16 [4740702,4743506); f606a53w dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
// UTF-16 [12501,15618). Host normalization provenance keeps both old links.
// Filesystem stat supplies only a candidate frame; native descriptor checks,
// both bound parents and independent content establish the retained evidence.
export function inspectDirectoryNormalization(originalBytes: Buffer, bytes: Buffer, operation: Operation, reverse: boolean, source: Session,
  signal: AbortSignal, objectPath: (hash: string) => string, abandoned?: LinkedNormalization, preparation?: DirectoryPreparation) {
  operation = structuredClone(operation);
  const saved = abandoned ? structuredClone(abandoned) : reverse ? operation.rollbackNormalization : operation.normalization;
  const attempt = reverse ? operation.rollback : operation.stage;
  const from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  if (!saved || !attempt || attempt.kind === 'prepared' || attempt.kind === 'refused' || from.kind !== 'missing' || to.kind !== 'present')
    throw new Error('External rewind normalization provenance missing');
  const original = /^directory-write-receipt-v2\nstart\nstaging\npublishing\nintent create (\.litcode-tmp-[0-9]+-[0-9]+) (v2:[^\n ]+)\ncommitting\n$/.exec(originalBytes.toString('utf8'));
  if (!original || saved.originalReceiptDigest !== hash(originalBytes) || saved.alias !== original[1]) throw new Error('External rewind original linked receipt changed');
  const initial = parseDirectoryFileObservationFrame(original[2]!);
  if (initial.nlink !== '1' || !origin(initial, saved.pair) || !isDeepStrictEqual(initial.parent, saved.pair.parent) ||
      !isDeepStrictEqual(saved.pair.parent, from.parent) || !isDeepStrictEqual(saved.pair.parent, to.observation.parent) ||
      initial.mode !== to.observation.mode || initial.size !== String(to.content.bytes)) throw new Error('External rewind original linked identity changed');
  const grant = source.workingDirectories(false).readHandle?.(operation.grant.root);
  if (!grant || grant.owner !== source.id || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
    throw new Error('External rewind requires an explicit grant for the original directory');
  const relative = path.relative(grant.root, operation.path), retained = path.join(path.dirname(relative), `.litcode-linked-${saved.id}`);
  const authority = () => {
    signal.throwIfAborted(); source.checkpointGateIdentity();
    const current = source.workingDirectories(false).readHandle?.(grant.root);
    if (!source.isOpen || source.isJournalFenced || source.isDirectoryAuthorityReleased || !current || current.fd !== grant.fd ||
        current.incarnation !== grant.incarnation || current.owner !== source.id || current.dev !== grant.dev || current.ino !== grant.ino ||
        grant.signal.aborted || current.signal.aborted) throw new Error('External rewind normalization authority changed');
  };
  const read = (name: string) => {
    const file = readStableDirectoryFile({ fd: grant.fd, relative: name, sync: true }, DIRECTORY_REWIND_BYTE_CAP, signal);
    if (!file || file.bytes.length !== to.content.bytes || hash(file.bytes) !== to.content.sha256) return;
    return file.observation;
  };
  const missing = (name: string, parent: BoundDirectoryFileObservation['parent']) =>
    isDeepStrictEqual(probeMissingDirectoryFile({ fd: grant.fd, relative: name, sync: true }), parent);
  const targetUnchanged = () => {
    authority();
    const pair = inspectLinkedDirectoryAttempt(originalBytes, operation, reverse, source, signal);
    return !!pair && isDeepStrictEqual(pair.evidence.observation, saved.pair);
  };
  const earlyPrefix = `directory-write-receipt-v2\nstart\nstaging\nchecking\nlinked_alias ${saved.alias}\nintent normalize-linked ${directoryFileObservationFrame(saved.pair)} `;
  const raw = bytes.toString('utf8'), errorIndex = raw.indexOf('\ne');
  const trailer = errorIndex < 0 ? '' : raw.slice(errorIndex + 1);
  const unknown = matchesNativeErrorPrefix(trailer, 'unknown');
  const refused = matchesNativeErrorPrefix(trailer, 'not_published');
  const hasError = unknown || refused;
  const receiptText = hasError ? raw.slice(0, errorIndex + 1) : raw;
  const receiptDigest = hash(bytes);
  if (saved.captured && (hasError || saved.captured.receiptDigest !== undefined) && saved.captured.receiptDigest !== receiptDigest)
    throw new Error('External rewind normalization capture receipt changed');
  const partialStagedFrame = receiptText.startsWith(earlyPrefix) && !receiptText.slice(earlyPrefix.length).includes('\n');
  if (!saved.captured && !saved.completedReceiptDigest && (earlyPrefix.startsWith(receiptText) || partialStagedFrame)) {
    // RVr/sC ranges above: this observed orphan state is retained evidence only.
    // It never authorizes publishing partial bytes or deleting foreign objects.
    const snapshot = (): DirectoryPreparation => {
      authority();
      if (missing(retained, saved.pair.parent)) { authority(); return { kind: 'absent', parent: saved.pair.parent }; }
      const file = readStableDirectoryFile({ fd: grant.fd, relative: path.join(retained, 'staged'), sync: true }, DIRECTORY_REWIND_BYTE_CAP, signal);
      const parent = file?.observation.parent ?? probeMissingDirectoryFile({ fd: grant.fd, relative: path.join(retained, 'staged'), sync: true });
      if (!parent || !missing(path.join(retained, 'held'), parent)) throw new Error('External rewind early normalization preparation unresolved');
      authority();
      return { kind: 'retained', staged: file ? { kind: 'present', observation: file.observation,
        content: { bytes: file.bytes.length, sha256: hash(file.bytes) } } : { kind: 'missing', parent } };
    };
    if (abandoned && !preparation) throw new Error('External rewind early normalization preparation missing');
    if (!abandoned && !targetUnchanged()) throw new Error('External rewind normalization original pair changed');
    const expected = preparation ? structuredClone(preparation) : snapshot();
    if (hasError) {
      const start = 'directory-write-receipt-v2\nstart\n';
      const checking = start + 'staging\nchecking\n';
      let consistent: boolean;
      if (expected.kind === 'absent') consistent = refused && receiptText === start;
      else if (expected.staged.kind === 'missing') consistent = unknown && receiptText === start;
      else {
        const staged = expected.staged;
        const checked = receiptText === checking || receiptText === checking + `linked_alias ${saved.alias}\n`;
        consistent = unknown && staged.content.bytes <= to.content.bytes &&
          (receiptText === start + 'staging\n' || (checked && staged.observation.mode === initial.mode &&
            isDeepStrictEqual(staged.content, to.content)));
      }
      if (!consistent) throw new Error('External rewind normalization error phase differs');
    }
    if (partialStagedFrame) {
      if (expected.kind !== 'retained' || expected.staged.kind !== 'present' ||
          !isDeepStrictEqual(expected.staged.content, to.content) || expected.staged.observation.mode !== initial.mode ||
          expected.staged.observation.nlink !== '1' ||
          (expected.staged.observation.dev === initial.dev && expected.staged.observation.ino === initial.ino) ||
          !`${earlyPrefix}${directoryFileObservationFrame(expected.staged.observation)}\n`.startsWith(receiptText))
        throw new Error('External rewind normalization staged prefix changed');
    }
    const verifyRetained = () => {
      if (!isDeepStrictEqual(snapshot(), expected)) throw new Error('External rewind early normalization preparation changed');
    };
    verifyRetained();
    return { kind: 'prepared' as const, preparation: structuredClone(expected), verifyRetained, verify: () => {
      if (!targetUnchanged()) throw new Error('External rewind normalization original pair changed');
      verifyRetained();
    } };
  }
  if (preparation) throw new Error('External rewind early normalization receipt changed');
  const intent = /^directory-write-receipt-v2\nstart\nstaging\nchecking\nlinked_alias ([^\n]+)\nintent normalize-linked (v2:[^\n ]+) (v2:[^\n ]+)\n([\s\S]*)$/.exec(receiptText);
  if (!intent || intent[1] !== saved.alias || !isDeepStrictEqual(parseDirectoryFileObservationFrame(intent[2]!), saved.pair))
    throw new Error('External rewind normalization intent incomplete or changed');
  let suffix = intent[4]!;
  // held and landed are emitted together on the success tail. A failed
  // receipt write fences subsequent appends, including the terminal error.
  if (hasError && (!unknown || suffix.includes('held '))) throw new Error('External rewind normalization error phase differs');
  if (suffix.endsWith('exit 0\n')) {
    if (!suffix.endsWith('durable\nexit 0\n')) throw new Error('External rewind normalization receipt incomplete');
    suffix = suffix.slice(0, -7);
  }
  if (!/^(?:capturing\n(?:captured\n(?:publishing\n(?:renamed\n(?:held v2:[^\n]+\n(?:landed v2:[^\n]+\n(?:durable\n)?)?)?)?)?)?)?$/.test(suffix))
    throw new Error('External rewind normalization receipt unresolved');
  const staged = parseDirectoryFileObservationFrame(intent[3]!);
  if (staged.nlink !== '1' || staged.mode !== initial.mode || staged.size !== initial.size || (staged.dev === initial.dev && staged.ino === initial.ino))
    throw new Error('External rewind normalization staged identity changed');
  if (!saved.captured && !saved.completedReceiptDigest && (suffix === '' || suffix === 'capturing\n')) {
    const verifyRetained = () => {
      authority();
      if (!isDeepStrictEqual(read(path.join(retained, 'staged')), staged) || !missing(path.join(retained, 'held'), staged.parent))
        throw new Error('External rewind normalization preparation changed');
      authority();
    };
    if (abandoned || targetUnchanged()) {
      verifyRetained();
      return { kind: 'prepared' as const, preparation: undefined, verifyRetained, verify: () => {
        if (!targetUnchanged()) throw new Error('External rewind normalization original pair changed');
        verifyRetained();
      } };
    }
  }
  if (abandoned) throw new Error('External rewind abandoned normalization intent changed');
  const retainedProof = () => {
    authority();
    const name = path.join(grant.root, retained, 'held'), stat = fs.lstatSync(name, { bigint: true }), parent = fs.lstatSync(path.dirname(name), { bigint: true });
    const held = parseDirectoryFileObservationFrame(['v2', stat.dev, stat.ino, stat.size, stat.mtimeNs / 1000000000n, stat.mtimeNs % 1000000000n,
      stat.ctimeNs / 1000000000n, stat.ctimeNs % 1000000000n, stat.mode & 0o7777n, stat.nlink, parent.dev, parent.ino].join(':'));
    if (!stat.isFile() || held.nlink !== '2' || !origin(saved.pair, held) || !isDeepStrictEqual(held.parent, staged.parent))
      throw new Error('External rewind normalized retained identity changed');
    const witness = openLinkedWitness(to.content, objectPath);
    try {
      if (observeLinkedRetainedDirectoryFile({ fd: grant.fd, relative, alias: saved.alias, parent: saved.pair.parent, held,
        originalFd: witness.fd, transactionId: saved.id }).kind !== 'observed') throw new Error('External rewind normalized retained pair changed');
    } finally { witness.close(); }
    if (saved.captured && (!isDeepStrictEqual(saved.captured.held, held) || !isDeepStrictEqual(saved.captured.staged, staged)))
      throw new Error('External rewind normalization continuation changed');
    const line = /^held (v2:[^\n]+)$/m.exec(suffix);
    if (line && !isDeepStrictEqual(parseDirectoryFileObservationFrame(line[1]!), held)) throw new Error('External rewind normalized held receipt changed');
    authority(); return held;
  };
  const held = retainedProof();
  const output = attempt.kind === 'completed' && attempt.result.kind === 'durable' ? attempt.result.observation : read(relative);
  if (output && output.nlink === '1' && origin(staged, output) && isDeepStrictEqual(output.parent, saved.pair.parent) && missing(path.join(retained, 'staged'), staged.parent)) {
    if (hasError && !suffix.startsWith('capturing\ncaptured\npublishing\n') && saved.captured?.receiptDigest !== receiptDigest)
      throw new Error('External rewind normalization publication evidence missing');
    const line = /^landed (v2:[^\n]+)$/m.exec(suffix);
    if (line && !isDeepStrictEqual(parseDirectoryFileObservationFrame(line[1]!), output)) throw new Error('External rewind normalized output receipt changed');
    const verify = () => {
      retainedProof();
      if (!isDeepStrictEqual(read(relative), output) || !missing(path.join(retained, 'staged'), staged.parent))
        throw new Error('External rewind normalized output changed');
    };
    return { kind: 'published' as const, result: { kind: 'durable' as const, observation: structuredClone(output) }, verify, verifyRetained: () => {
      retainedProof();
      if (!missing(path.join(retained, 'staged'), staged.parent)) throw new Error('External rewind normalized staging path changed');
    } };
  }
  if (attempt.kind === 'completed' || !missing(relative, saved.pair.parent) || !isDeepStrictEqual(read(path.join(retained, 'staged')), staged))
    throw new Error('External rewind normalization state unresolved');
  if (hasError && (!suffix.startsWith('capturing\n') || suffix.includes('renamed\n')))
    throw new Error('External rewind normalization capture phase differs');
  const evidence = { held, staged, receiptDigest };
  const verify = () => {
    if (!isDeepStrictEqual(retainedProof(), held) || !missing(relative, saved.pair.parent) || !isDeepStrictEqual(read(path.join(retained, 'staged')), staged))
      throw new Error('External rewind linked captured state changed');
  };
  return { kind: 'captured' as const, reverse, evidence: structuredClone(evidence), verify, verifyRetained: () => { retainedProof(); },
    publish: (leaseFd: number) => {
      verify(); const witness = openLinkedWitness(to.content, objectPath);
      try {
        const result = publishLinkedCapturedDirectoryFile({ fd: grant.fd, relative, alias: saved.alias, parent: saved.pair.parent,
          held, staged, originalFd: witness.fd, desiredFd: witness.fd, transactionId: saved.id, leaseFd });
        authority();
        if (result.kind !== 'normalized') throw new Error(`External rewind linked continuation ${result.kind}; transaction retained`);
      } finally { witness.close(); }
    } };
}
