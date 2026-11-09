import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { boundDirectoryFileObservationSchema, publishRetainedDirectoryFile, removeDirectoryFile } from './directory-file-state.js';
import { createRewindDirectoryFile } from './directory-rewind-creation.js';
import { verifyDirectoryRewindObjects, type DirectoryRewindEvidence } from './directory-rewind-evidence.js';
import type { DirectoryReadHandle } from './path-identity.js';
import type { DirectoryReceiptFactory } from './directory-rewind-receipt.js';

// RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4740702,4743506). Shared host inverse sequence; callers prove the
// record, hold the transaction gate and bind live grants before invoking it.
export function compensateDirectoryRewind(record: DirectoryRewindEvidence, persist: (record: DirectoryRewindEvidence) => void,
  readObject: (hash: string) => Buffer, objectPath: (hash: string) => string, controls: {
    assert: () => void; grant: (operation: DirectoryRewindEvidence['operations'][number]) => Pick<DirectoryReadHandle, 'fd' | 'root'>;
    leaseFd: number | undefined; createReceipt: DirectoryReceiptFactory;
  }): void {
  if (record.operations.some(operation => !['prepared', 'refused', 'completed'].includes(operation.stage.kind) || (operation.rollback && operation.rollback.kind !== 'completed')))
    throw new Error('External rewind reconciliation is required; transaction retained');
  const completed = record.operations.filter(operation => operation.stage.kind === 'completed' && !operation.rollback);
  if (!completed.length) return;
  controls.assert();
  const objects = verifyDirectoryRewindObjects(record, readObject);
  for (const operation of completed.reverse()) {
    if (operation.stage.kind !== 'completed') throw new Error('External rewind outcome missing');
    controls.assert();
    const grant = controls.grant(operation), relative = path.relative(grant.root, operation.path);
    const id = crypto.randomUUID(), landed = operation.stage.result;
    const receipt = controls.createReceipt(id);
    try {
    operation.rollbackReceipt = receipt.identity;
    operation.rollback = { kind: 'attempting', id };
    // RVr range above: the creation coordinator binds both receipts in the
    // first persisted inverse attempt, before any preparation is executed.
    if (landed.kind !== 'quarantined') persist(structuredClone(record));
    controls.assert();
    if (operation.before.kind === 'missing') {
      if (landed.kind !== 'durable' || operation.after.kind !== 'present') throw new Error('External rewind removal proof missing');
      const bytes = objects.get(operation.after.content.sha256); if (!bytes) throw new Error('External rewind after image missing');
      const result = removeDirectoryFile({ fd: grant.fd, relative, expected: landed.observation,
        expectedBytes: bytes, transactionId: id, leaseFd: controls.leaseFd, receiptFd: receipt.fd });
      if (result.kind !== 'quarantined') {
        operation.rollback = { kind: result.kind === 'not_removed' ? 'refused' : 'unknown', id }; persist(structuredClone(record));
        throw new Error(`External rewind rollback removal ${result.kind}`);
      }
      operation.rollback = { kind: 'completed', id, result: { kind: 'quarantined', observation: result.observation } };
    } else {
      const content = objects.get(operation.before.content.sha256); if (!content) throw new Error('External rewind before image missing');
      let result;
      if (landed.kind === 'quarantined') {
        result = createRewindDirectoryFile({ operation, reverse: true, fd: grant.fd, relative, content,
          objectPath: objectPath(operation.before.content.sha256), leaseFd: controls.leaseFd, receipt,
          createReceipt: controls.createReceipt, persist: () => persist(structuredClone(record)), assert: controls.assert });
      } else {
        if (operation.after.kind !== 'present') throw new Error('External rewind publication proof missing');
        const expectedFd = fs.openSync(objectPath(operation.after.content.sha256), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
        try {
          result = publishRetainedDirectoryFile({ fd: grant.fd, relative, expected: landed.observation,
            expectedFd, content, transactionId: id, leaseFd: controls.leaseFd, restoreMode: operation.before.observation.mode, receiptFd: receipt.fd });
        } finally { fs.closeSync(expectedFd); }
      }
      if (result.kind !== 'durable') {
        operation.rollback = { kind: result.kind === 'not_published' ? 'refused' : 'unknown', id }; persist(structuredClone(record));
        throw new Error(`External rewind rollback publication ${result.kind}`);
      }
      operation.rollback = { kind: 'completed', id, ...('receiptDigest' in result ? { reconciledReceipt: result.receiptDigest } : {}), result: { kind: 'durable', observation: result.observation,
        ...('held' in result ? { held: boundDirectoryFileObservationSchema.parse(result.held) } : {}) } };
    }
    controls.assert(); persist(structuredClone(record));
    } finally { receipt.close(); }
  }
}
