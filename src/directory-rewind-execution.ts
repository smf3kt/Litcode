import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { lock as flock } from './skill-effects.js';
import { planDirectoryRewind } from './directory-rewind-plan.js';
import { directoryRewindEvidenceSchema, directoryRewindTargetDigest, encodeDirectoryRewindPlan,
  verifyDirectoryRewindObjects, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import { boundDirectoryFileObservationSchema, publishRetainedDirectoryFile, removeDirectoryFile } from './directory-file-state.js';
import { createRewindDirectoryFile } from './directory-rewind-creation.js';
import type { Session } from './session.js';
import { compensateDirectoryRewind } from './directory-rewind-compensation.js';
import type { DirectoryReceiptFactory } from './directory-rewind-receipt.js';

const executions = new WeakSet<DirectoryRewindExecution>();

// Cwt/kVr/RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4734814,4737243)/[4740702,4743506). S3 host adaptation: the store
// transaction owns durable phases; the successor owns the directory handles.
export class DirectoryRewindExecution {
  #record: DirectoryRewindEvidence;
  #objects: Map<string, Buffer>;
  #gate: number | undefined;
  #gateIdentity: { dev: bigint; ino: bigint } | undefined;

  constructor(private source: Session, private authority: Session, private name: string,
    private expected: string, private signal: AbortSignal) {
    const plan = planDirectoryRewind(source, name, signal, authority);
    if (plan.kind !== 'available' || directoryRewindTargetDigest(plan) !== expected) throw new Error('External rewind preview is stale');
    const encoded = encodeDirectoryRewindPlan(plan);
    if (!encoded) throw new Error('External rewind has no operations');
    this.#record = encoded.record; this.#objects = encoded.objects;
    executions.add(this);
    Object.freeze(this);
  }
  get record(): DirectoryRewindEvidence { return structuredClone(this.#record); }
  get objects(): ReadonlyMap<string, Buffer> { return new Map([...this.#objects].map(([key, bytes]) => [key, Buffer.from(bytes)])); }

  private grant(operation: DirectoryRewindEvidence['operations'][number], rollback = false) {
    if (!rollback) this.signal.throwIfAborted();
    const grant = this.authority.workingDirectories(false).readHandle?.(operation.grant.root);
    if (!this.authority.isOpen || this.authority.isJournalFenced || this.authority.isDirectoryAuthorityReleased ||
        !grant || grant.signal.aborted || grant.owner !== this.authority.id || grant.owner !== operation.grant.owner ||
        grant.incarnation !== operation.grant.incarnation || String(grant.dev) !== operation.grant.dev || String(grant.ino) !== operation.grant.ino)
      throw new Error('External rewind directory authority changed');
    this.authority.checkpointGateIdentity();
    return grant;
  }
  private assertGate(rollback = false): void {
    if (this.#gate === undefined || !this.#gateIdentity) throw new Error('External rewind gate is not held');
    const named = fs.lstatSync(`${this.authority.file}.lock.gate`, { bigint: true }), opened = fs.fstatSync(this.#gate, { bigint: true });
    if (!named.isFile() || named.isSymbolicLink() || !opened.isFile() || named.dev !== this.#gateIdentity.dev ||
        named.ino !== this.#gateIdentity.ino || opened.dev !== named.dev || opened.ino !== named.ino || (named.mode & 0o777n) !== 0o600n)
      throw new Error('External rewind gate changed');
    for (const operation of this.#record.operations) this.grant(operation, rollback);
  }
  acquire(): void {
    if (this.#gate !== undefined) throw new Error('External rewind execution already acquired');
    const fresh = planDirectoryRewind(this.source, this.name, this.signal, this.authority);
    if (fresh.kind !== 'available' || directoryRewindTargetDigest(fresh) !== this.expected || fresh.digest !== this.#record.plan)
      throw new Error('External rewind changed before transaction');
    this.#gate = fs.openSync(`${this.authority.file}.lock.gate`, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
    try {
      const opened = fs.fstatSync(this.#gate, { bigint: true });
      this.#gateIdentity = { dev: opened.dev, ino: opened.ino };
      if (!flock(this.#gate, false)) throw new Error('External rewind gate unavailable');
      this.assertGate();
    } catch (error) { this.close(); throw error; }
  }
  close(): void {
    if (this.#gate !== undefined) fs.closeSync(this.#gate);
    this.#gate = undefined; this.#gateIdentity = undefined;
  }

  apply(persist: (record: DirectoryRewindEvidence) => void, readObject: (hash: string) => Buffer, objectPath: (hash: string) => string, createReceipt: DirectoryReceiptFactory): void {
    this.assertGate();
    const objects = verifyDirectoryRewindObjects(this.#record, readObject);
    for (const operation of this.#record.operations) {
      this.assertGate();
      if (operation.stage.kind !== 'prepared') throw new Error('External rewind operation already attempted');
      const grant = this.grant(operation), relative = path.relative(grant.root, operation.path), id = crypto.randomUUID();
      const receipt = createReceipt(id);
      try {
      operation.receipt = receipt.identity;
      operation.stage = { kind: 'attempting', id };
      // RVr range above: creation's coordinator persists this attempt with
      // both receipt identities before its first native call, in one record.
      if (operation.before.kind !== 'missing') persist(this.record);
      this.assertGate();
      if (operation.action === 'remove') {
        const bytes = objects.get(operation.before.content.sha256); if (!bytes) throw new Error('External rewind before image missing');
        const result = removeDirectoryFile({ fd: grant.fd, relative, expected: operation.before.observation,
          expectedBytes: bytes, transactionId: id, leaseFd: this.#gate, receiptFd: receipt.fd });
        if (result.kind !== 'quarantined') {
          operation.stage = { kind: result.kind === 'not_removed' ? 'refused' : 'unknown', id }; persist(this.record);
          throw new Error(`External rewind removal ${result.kind}`);
        }
        operation.stage = { kind: 'completed', id, result: { kind: 'quarantined', observation: result.observation } };
      } else {
        const content = objects.get(operation.after.content.sha256); if (!content) throw new Error('External rewind after image missing');
        const result = operation.before.kind === 'missing'
          ? createRewindDirectoryFile({ operation, reverse: false, fd: grant.fd, relative, content,
            objectPath: objectPath(operation.after.content.sha256), leaseFd: this.#gate, receipt, createReceipt,
            persist: () => persist(this.record), assert: () => this.assertGate() })
          : this.replace(operation, grant.fd, relative, id, content, objectPath(operation.before.content.sha256), receipt.fd);
        if (result.kind !== 'durable') {
          operation.stage = { kind: result.kind === 'not_published' ? 'refused' : 'unknown', id }; persist(this.record);
          throw new Error(`External rewind publication ${result.kind}`);
        }
        operation.stage = { kind: 'completed', id, ...('receiptDigest' in result ? { reconciledReceipt: result.receiptDigest } : {}), result: { kind: 'durable', observation: result.observation,
          ...('held' in result ? { held: boundDirectoryFileObservationSchema.parse(result.held) } : {}) } };
      }
      this.assertGate(); persist(this.record);
      } finally { receipt.close(); }
    }
    verifyDirectoryRewindObjects(this.#record, readObject);
  }
  private replace(operation: DirectoryRewindEvidence['operations'][number], fd: number, relative: string, id: string,
    content: Buffer, beforePath: string, receiptFd: number) {
    if (operation.action !== 'write' || operation.before.kind !== 'present') throw new Error('Invalid retained rewind operation');
    const expectedFd = fs.openSync(beforePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      return publishRetainedDirectoryFile({ fd, relative, expected: operation.before.observation, expectedFd,
        content, transactionId: id, leaseFd: this.#gate, restoreMode: operation.after.observation.mode, receiptFd });
    } finally { fs.closeSync(expectedFd); }
  }
  // RVr [4740702,4743506), UTF-16, same source digest above. Host compensation
  // restores the transaction before-image only against its witnessed landed inode.
  rollback(record: DirectoryRewindEvidence, persist: (record: DirectoryRewindEvidence) => void,
    readObject: (hash: string) => Buffer, objectPath: (hash: string) => string, createReceipt: DirectoryReceiptFactory): void {
    if (!isDeepStrictEqual(directoryRewindEvidenceSchema.parse(record), this.#record)) throw new Error('External rewind record changed');
    compensateDirectoryRewind(this.#record, persist, readObject, objectPath, {
      assert: () => this.assertGate(true), grant: operation => this.grant(operation, true), leaseFd: this.#gate, createReceipt,
    });
  }
  verifyRecovery(record: DirectoryRewindEvidence, rollback: boolean): void {
    if (!isDeepStrictEqual(directoryRewindEvidenceSchema.parse(record), this.#record)) throw new Error('External rewind record changed');
    if (this.#record.operations.some(operation => rollback
      ? operation.stage.kind !== 'prepared' && operation.stage.kind !== 'refused' && operation.rollback?.kind !== 'completed'
      : operation.stage.kind !== 'completed' || !!operation.rollback))
      throw new Error('External rewind reconciliation is required; transaction retained');
    if (!rollback) this.assertGate();
  }
}

const verifyRecovery = DirectoryRewindExecution.prototype.verifyRecovery;
Object.freeze(DirectoryRewindExecution.prototype);
export function assertDirectoryRewindExecution(value: DirectoryRewindExecution): void {
  if (!executions.has(value)) throw new Error('External rewind coordinator is not owned');
}
export function verifyDirectoryRewindExecution(value: DirectoryRewindExecution, record: DirectoryRewindEvidence, rollback: boolean): void {
  assertDirectoryRewindExecution(value);
  verifyRecovery.call(value, record, rollback);
}
