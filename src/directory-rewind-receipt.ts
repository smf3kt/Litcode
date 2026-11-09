import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import { directoryNativeReceiptSchema, directoryRewindEvidenceSchema, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import { directoryFileObservationFrame, parseDirectoryFileObservationFrame, type BoundDirectoryFileObservation } from './directory-file-state.js';
import { publishedReceiptText, reconcilePublishedDirectoryAttempt } from './directory-rewind-partial.js';
import { inspectCapturedDirectoryAttempt, capturedResultMatches } from './directory-rewind-captured.js';
import { noEffectDirectoryVerifier } from './directory-rewind-no-effect.js';
import { inspectLinkedDirectoryAttempt } from './directory-rewind-linked.js';
import { inspectDirectoryNormalization } from './directory-rewind-normalization.js';
import { inspectRewindCreation } from './directory-rewind-creation.js';
import type { Session } from './session.js';

type Identity = z.infer<typeof directoryNativeReceiptSchema>;
export type DirectoryReceiptFactory = (id: string) => { fd: number; identity: Identity; read: () => Buffer; close: () => void };
const receiptPath = (store: string, id: string) => path.join(store, `native-attempt-${z.string().uuid().parse(id)}.receipt`);

// Host receipt provenance for RVr, sfn1dbxq
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4740702,4743506). Identity is persisted before the native call.
export function createDirectoryReceipt(store: string, id: string): ReturnType<DirectoryReceiptFactory> {
  const fd = fs.openSync(receiptPath(store, id), fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
  try {
    const stat = fs.fstatSync(fd, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || (stat.mode & 0o7777n) !== 0o600n || stat.size !== 0n) throw new Error('Invalid native receipt file');
    fs.fsyncSync(fd);
    const directory = fs.openSync(store, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    const identity = { dev: String(stat.dev), ino: String(stat.ino) };
    return { fd, identity, read: () => readReceipt(store, id, identity), close: () => fs.closeSync(fd) };
  } catch (error) { fs.closeSync(fd); throw error; }
}

function readReceipt(store: string, id: string, identity: Identity): Buffer {
  const file = receiptPath(store, id), fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    const valid = (stat: fs.BigIntStats) => stat.isFile() && stat.nlink === 1n && (stat.mode & 0o7777n) === 0o600n &&
      String(stat.dev) === identity.dev && String(stat.ino) === identity.ino && stat.size <= 24000n;
    if (!valid(before) || !valid(fs.lstatSync(file, { bigint: true }))) throw new Error('Native receipt identity changed');
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) { const count = fs.readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) throw new Error('Native receipt truncated'); offset += count; }
    fs.fsyncSync(fd);
    const after = fs.fstatSync(fd, { bigint: true }), named = fs.lstatSync(file, { bigint: true });
    if (!valid(after) || !valid(named) || after.size !== before.size || named.size !== before.size ||
        after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || named.mtimeNs !== before.mtimeNs || named.ctimeNs !== before.ctimeNs)
      throw new Error('Native receipt changed during verification');
    return bytes;
  } finally { fs.closeSync(fd); }
}

type Operation = DirectoryRewindEvidence['operations'][number];
type Result = Extract<Operation['stage'], { kind: 'completed' }>['result'];
function receiptResult(bytes: Buffer, operation: Operation, reverse: boolean): Result | undefined {
  const text = bytes.toString('utf8'), header = /^directory-write-receipt-v([12])\n/.exec(text);
  if (!header) return;
  let body = text.slice(header[0].length);
  let intent: RegExpExecArray | null = null;
  if (header[1] === '2') {
    intent = /^intent (remove|replace|create) ([^\n ]+) ([^\n ]+)\n/m.exec(body);
    if (!intent) return;
    const prefix = intent[1] === 'remove' ? 'start\nchecking\n' : intent[1] === 'replace' ? 'start\nstaging\nchecking\n' : 'start\nstaging\npublishing\n';
    if (intent.index !== prefix.length || !body.startsWith(prefix)) return;
    body = body.slice(0, intent.index) + body.slice(intent.index + intent[0].length);
  }
  const remove = /^start\nchecking\ncommitting\ncaptured\nheld (v2:[^\n]+)\nquarantined\nexit 0\n$/.exec(body);
  const retained = /^start\nstaging\nchecking\ncapturing\ncaptured\npublishing\nrenamed\nheld (v2:[^\n]+)\nlanded (v2:[^\n]+)\ndurable\nexit 0\n$/.exec(body);
  const created = /^start\nstaging\npublishing\ncommitting\nrenamed\nlanded (v2:[^\n]+)\ndurable\nexit 0\n$/.exec(body);
  const from = reverse ? operation.after : operation.before, to = reverse ? operation.before : operation.after;
  let expected: BoundDirectoryFileObservation | undefined;
  if (from.kind === 'present') {
    if (reverse) { if (operation.stage.kind !== 'completed' || operation.stage.result.kind !== 'durable') return; expected = operation.stage.result.observation; }
    else expected = from.observation;
  }
  const original = (observed: BoundDirectoryFileObservation) => !!expected && observed.dev === expected.dev && observed.ino === expected.ino &&
    observed.size === expected.size && observed.mode === expected.mode && observed.nlink === '1' &&
    observed.mtimeSeconds === expected.mtimeSeconds && observed.mtimeNanoseconds === expected.mtimeNanoseconds;
  try {
    // V2 intent is extra provenance, never a substitute for a complete result.
    // Its staged inode survives rename but its ctime and parent can change.
    if (intent) {
      const action = to.kind === 'missing' ? 'remove' : from.kind === 'present' ? 'replace' : 'create';
      if (intent[1] !== action) return;
      if (action !== 'create' && !isDeepStrictEqual(parseDirectoryFileObservationFrame(intent[2]!), expected)) return;
      if (action === 'remove') {
        if (!remove) return;
        const held = parseDirectoryFileObservationFrame(remove[1]!);
        if (intent[3] !== `missing:${held.parent.dev}:${held.parent.ino}`) return;
      } else {
        if (action === 'create' && !/^\.litcode-tmp-[0-9]+-[0-9]+$/.test(intent[2]!)) return;
        const staged = parseDirectoryFileObservationFrame(intent[3]!);
        const landed = parseDirectoryFileObservationFrame((retained ? retained[2] : created?.[1])!);
        if (staged.dev !== landed.dev || staged.ino !== landed.ino || staged.size !== landed.size || staged.mode !== landed.mode ||
            staged.nlink !== '1' || staged.mtimeSeconds !== landed.mtimeSeconds || staged.mtimeNanoseconds !== landed.mtimeNanoseconds) return;
        const parent = retained ? parseDirectoryFileObservationFrame(retained[1]!).parent : landed.parent;
        if (!isDeepStrictEqual(staged.parent, parent)) return;
      }
    }
    if (to.kind === 'missing') {
      if (!remove) return;
      const observation = parseDirectoryFileObservationFrame(remove[1]!);
      return original(observation) ? { kind: 'quarantined', observation } : undefined;
    }
    if (from.kind === 'present' ? !retained : !created) return;
    const observation = parseDirectoryFileObservationFrame((retained ? retained[2] : created?.[1])!);
    if (observation.mode !== to.observation.mode || BigInt(observation.size) !== BigInt(to.content.bytes) || observation.nlink !== '1' ||
        !isDeepStrictEqual(observation.parent, to.observation.parent)) return;
    if (retained) {
      const held = parseDirectoryFileObservationFrame(retained[1]!);
      return original(held) ? { kind: 'durable', observation, held } : undefined;
    }
    return { kind: 'durable', observation };
  } catch { return; }
}

function partialReceiptMatchesResult(bytes: Buffer, operation: Operation, reverse: boolean, result: Result): boolean {
  const text = publishedReceiptText(bytes, operation, reverse), intent = /^intent (remove|replace|create) [^\n]+\n/m.exec(text);
  if (!intent || !text.endsWith('\n')) return false;
  let complete = 'directory-write-receipt-v2\n';
  if (intent[1] === 'remove') {
    if (result.kind !== 'quarantined') return false;
    complete += `start\nchecking\n${intent[0]}committing\ncaptured\nheld ${directoryFileObservationFrame(result.observation)}\nquarantined\n`;
  } else {
    if (result.kind !== 'durable') return false;
    if (intent[1] === 'replace') {
      if (!result.held) return false;
      complete += `start\nstaging\nchecking\n${intent[0]}capturing\ncaptured\npublishing\nrenamed\nheld ${directoryFileObservationFrame(result.held)}\n`;
    } else complete += `start\nstaging\npublishing\n${intent[0]}committing\nrenamed\n`;
    complete += `landed ${directoryFileObservationFrame(result.observation)}\ndurable\n`;
  }
  // Build a comparison frame, never append a fabricated completion to disk.
  // The saved prefix and the result must independently satisfy the V2 contract.
  return complete.startsWith(text) && isDeepStrictEqual(receiptResult(Buffer.from(`${complete}exit 0\n`), operation, reverse), result);
}

// Candidate outcomes are not authorized until branch, current grants and native
// landed/held states have also passed the recovery verifier under its gate.
export function reconcileDirectoryReceipts(store: string, input: DirectoryRewindEvidence, source: Session, signal: AbortSignal,
  checkpointSource = source) {
  const record = directoryRewindEvidenceSchema.parse(input), proofs: { id: string; identity: Identity; bytes: Buffer }[] = [];
  const candidates: (() => void)[] = [];
  const retainedProofs: (() => void)[] = [];
  const captured = new Map<string, NonNullable<ReturnType<typeof inspectCapturedDirectoryAttempt>>>();
  const linked = new Map<string, NonNullable<ReturnType<typeof inspectLinkedDirectoryAttempt>> |
    Extract<ReturnType<typeof inspectDirectoryNormalization>, { kind: 'captured' }>>();
  if (checkpointSource.id !== record.checkpoint.owner || (source !== checkpointSource && source.id !== record.owner))
    throw new Error('Open the original checkpoint session to reconcile external rewind');
  for (const operation of record.operations) {
    for (const abandoned of operation.abandonedNormalizations ?? []) {
      const identity = abandoned.reverse ? operation.rollbackReceipt : operation.receipt;
      if (!identity) throw new Error('Abandoned normalization original receipt missing');
      const original = readReceipt(store, abandoned.attemptId, identity);
      const normalized = readReceipt(store, abandoned.normalization.id, abandoned.normalization.receipt);
      if (crypto.createHash('sha256').update(normalized).digest('hex') !== abandoned.digest) throw new Error('Abandoned normalization receipt changed');
      const proof = inspectDirectoryNormalization(original, normalized, operation, abandoned.reverse, source, signal,
        digest => path.join(store, 'objects', digest), abandoned.normalization, abandoned.preparation);
      if (proof.kind !== 'prepared') throw new Error('Abandoned normalization preparation missing');
      retainedProofs.push(proof.verifyRetained);
      proofs.push({ id: abandoned.attemptId, identity, bytes: original },
        { id: abandoned.normalization.id, identity: abandoned.normalization.receipt, bytes: normalized });
    }
    for (const abandoned of operation.noEffectAttempts ?? []) {
      const bytes = readReceipt(store, abandoned.id, abandoned.receipt);
      if (crypto.createHash('sha256').update(bytes).digest('hex') !== abandoned.digest) throw new Error('No-effect native receipt changed');
      if (abandoned.creation) {
        const creation = abandoned.creation.evidence, prepared = readReceipt(store, creation.id, creation.receipt);
        if (crypto.createHash('sha256').update(prepared).digest('hex') !== abandoned.creation.digest || !abandoned.preparation)
          throw new Error('Abandoned create preparation changed');
        const proof = inspectRewindCreation(prepared, bytes, operation, abandoned.reverse, source, signal, creation, abandoned.preparation);
        if (proof.kind !== 'prepared') throw new Error('Abandoned create no-effect proof missing');
        retainedProofs.push(proof.verifyRetained);
        proofs.push({ id: creation.id, identity: creation.receipt, bytes: prepared }, { id: abandoned.id, identity: abandoned.receipt, bytes });
        continue;
      }
      if (abandoned.preparation?.kind === 'metadata') throw new Error('Metadata-only preparation cannot verify an ordinary operation');
      const verifier = noEffectDirectoryVerifier(bytes, operation, abandoned.reverse, abandoned.id, source, signal, abandoned.preparation);
      if (!verifier) throw new Error('No-effect native receipt differs');
      verifier.verifyRetained(); retainedProofs.push(verifier.verifyRetained);
      proofs.push({ id: abandoned.id, identity: abandoned.receipt, bytes });
    }
    for (const reverse of [false, true]) {
    const stage = reverse ? operation.rollback : operation.stage, identity = reverse ? operation.rollbackReceipt : operation.receipt;
    if (!identity || !stage || stage.kind === 'prepared' || stage.kind === 'refused') continue;
    const bytes = readReceipt(store, stage.id, identity), digest = crypto.createHash('sha256').update(bytes).digest('hex');
    let result = receiptResult(bytes, operation, reverse), reconciledReceipt: string | undefined;
    const normalization = reverse ? operation.rollbackNormalization : operation.normalization;
    const creation = reverse ? operation.rollbackCreation : operation.creation;
    if (creation) {
      const prepared = readReceipt(store, creation.id, creation.receipt), preparationDigest = crypto.createHash('sha256').update(prepared).digest('hex');
      if (stage.kind === 'completed' && stage.reconciledReceipt && stage.reconciledReceipt !== digest) throw new Error('Reconciled native receipt changed');
      const proof = inspectRewindCreation(prepared, bytes, operation, reverse, source, signal);
      proofs.push({ id: creation.id, identity: creation.receipt, bytes: prepared });
      retainedProofs.push(proof.verifyRetained);
      if (proof.kind === 'prepared') {
        if (stage.kind === 'completed') throw new Error('Completed creation lacks publication proof');
        proof.verify(); candidates.push(proof.verify);
        (operation.noEffectAttempts ??= []).push({ id: stage.id, reverse, receipt: identity, digest,
          preparation: proof.preparation, creation: { evidence: creation, digest: preparationDigest } });
        proofs.push({ id: stage.id, identity, bytes });
        if (reverse) { delete operation.rollback; delete operation.rollbackReceipt; delete operation.rollbackCreation; }
        else { operation.stage = { kind: 'refused', id: stage.id }; delete operation.creation; }
        continue;
      }
      result = proof.result; reconciledReceipt = digest;
      if (stage.kind !== 'completed') candidates.push(proof.verify);
    } else if (normalization) {
      const normalizedBytes = readReceipt(store, normalization.id, normalization.receipt);
      const normalizedDigest = crypto.createHash('sha256').update(normalizedBytes).digest('hex');
      if (stage.kind === 'completed' && normalization.completedReceiptDigest !== normalizedDigest) throw new Error('Normalized native receipt changed');
      const normalized = inspectDirectoryNormalization(bytes, normalizedBytes, operation, reverse, source, signal,
        digest => path.join(store, 'objects', digest));
      proofs.push({ id: normalization.id, identity: normalization.receipt, bytes: normalizedBytes });
      retainedProofs.push(normalized.verifyRetained);
      if (normalized.kind === 'prepared') {
        normalized.verify(); candidates.push(normalized.verify);
        (operation.abandonedNormalizations ??= []).push({ attemptId: stage.id, reverse, digest: normalizedDigest, normalization,
          ...(normalized.preparation ? { preparation: normalized.preparation } : {}) });
        if (reverse) delete operation.rollbackNormalization; else delete operation.normalization;
        const next = inspectLinkedDirectoryAttempt(bytes, operation, reverse, source, signal);
        if (!next) throw new Error('External rewind normalization retry pair changed');
        linked.set(operation.path, next);
        proofs.push({ id: stage.id, identity, bytes });
        continue;
      }
      if (normalized.kind === 'captured') {
        linked.set(operation.path, normalized);
        proofs.push({ id: stage.id, identity, bytes });
        continue;
      }
      result = normalized.result; reconciledReceipt = digest;
      if (stage.kind !== 'completed') { normalization.completedReceiptDigest = normalizedDigest; candidates.push(normalized.verify); }
      else if (stage.reconciledReceipt !== digest) throw new Error('Normalized original receipt changed');
    } else if (stage.kind === 'completed' && stage.reconciledReceipt) {
      if (stage.reconciledReceipt !== digest) throw new Error('Reconciled native receipt changed');
      if (!partialReceiptMatchesResult(bytes, operation, reverse, stage.result)) throw new Error('Reconciled native receipt outcome differs');
      result = stage.result; reconciledReceipt = digest;
    } else if (!result && stage.kind !== 'completed') {
      const linkedAttempt = inspectLinkedDirectoryAttempt(bytes, operation, reverse, source, signal);
      if (linkedAttempt) {
        linked.set(operation.path, linkedAttempt);
        proofs.push({ id: stage.id, identity, bytes });
        continue;
      }
      const continuation = inspectCapturedDirectoryAttempt(bytes, operation, reverse, source, signal);
      if (continuation) {
        captured.set(operation.path, continuation);
        proofs.push({ id: stage.id, identity, bytes });
        continue;
      }
      const untouched = noEffectDirectoryVerifier(bytes, operation, reverse, stage.id, source, signal);
      if (untouched?.targetUnchanged()) {
        untouched.verify(); candidates.push(untouched.verify); retainedProofs.push(untouched.verifyRetained);
        proofs.push({ id: stage.id, identity, bytes });
        (operation.noEffectAttempts ??= []).push({ id: stage.id, reverse, receipt: identity, digest,
          ...(untouched.preparation ? { preparation: untouched.preparation } : {}) });
        if (reverse) { delete operation.rollback; delete operation.rollbackReceipt; }
        else operation.stage = { kind: 'refused', id: stage.id };
        continue;
      }
      result = reconcilePublishedDirectoryAttempt(bytes, operation, reverse, source, signal);
      if (result && partialReceiptMatchesResult(bytes, operation, reverse, result)) {
        reconciledReceipt = digest;
        const saved = structuredClone(operation), expected = result;
        candidates.push(() => {
          if (!isDeepStrictEqual(reconcilePublishedDirectoryAttempt(bytes, saved, reverse, source, signal), expected))
            throw new Error('External rewind partial outcome changed before reconciliation');
        });
      } else result = undefined;
    }
    if (!result) throw new Error('External rewind has unresolved effects: native receipt incomplete');
    const continuation = reverse ? operation.rollbackContinuation : operation.continuation;
    if (continuation && !capturedResultMatches(continuation, digest, result)) throw new Error('External rewind captured result differs');
    if (stage.kind === 'completed' && !isDeepStrictEqual(stage.result, result)) throw new Error('Native receipt outcome differs');
    proofs.push({ id: stage.id, identity, bytes });
    if (reverse) operation.rollback = { kind: 'completed', id: stage.id, result, ...(reconciledReceipt ? { reconciledReceipt } : {}) };
    else operation.stage = { kind: 'completed', id: stage.id, result, ...(reconciledReceipt ? { reconciledReceipt } : {}) };
  }
  }
  const intermediates = new Map<string, { reverse: boolean; verify: () => void }>([...captured, ...linked]);
  return { record: directoryRewindEvidenceSchema.parse(record), captured, linked, intermediates, verifyCandidates: () => { for (const verify of candidates) verify(); }, verify: () => {
    for (const proof of proofs) if (!readReceipt(store, proof.id, proof.identity).equals(proof.bytes)) throw new Error('Native receipt changed before recovery');
    for (const verify of retainedProofs) verify();
  } };
}
