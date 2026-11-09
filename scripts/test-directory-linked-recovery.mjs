import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Session } from '../dist/session.js';
import { defaultConfig } from '../dist/agent.js';
import { readStableDirectoryFile, readLinkedDirectoryPair, directoryFileObservationFrame } from '../dist/directory-file-state.js';
import { inspectLinkedDirectoryAttempt } from '../dist/directory-rewind-linked.js';
import { createDirectoryReceipt, reconcileDirectoryReceipts } from '../dist/directory-rewind-receipt.js';

const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'directory-linked-recovery-')));
const signal = new AbortController().signal, results = [];
try {
  for (const kind of ['forward', 'reverse', 'alias-replaced', 'third-link', 'content', 'intent-inode', 'intent-parent',
    'receipt-replaced', 'regrant', 'aborted', 'evidence-mutated', 'trailer']) {
    const root = path.join(base, kind), outside = path.join(root, 'outside'), workspace = path.join(root, 'workspace'), store = path.join(root, 'receipts');
    fs.mkdirSync(outside, { recursive: true }); fs.mkdirSync(workspace); fs.mkdirSync(store);
    const source = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
    const grantDirectory = () => source.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    grantDirectory();
    const grant = source.workingDirectories(false).readHandle(outside); assert.ok(grant);
    const alias = '.litcode-tmp-123-0', target = path.join(outside, 'target'), staging = path.join(outside, alias);
    const content = Buffer.from('DESIRED'), contentHash = crypto.createHash('sha256').update(content).digest('hex');
    const id = crypto.randomUUID(), forwardId = crypto.randomUUID(), reverse = kind === 'reverse';
    try {
      fs.writeFileSync(staging, content, { mode: 0o640 });
      const staged = readStableDirectoryFile({ fd: grant.fd, relative: alias, sync: true }, content.length, signal); assert.ok(staged);
      const state = { kind: 'present', observation: staged.observation, content: { bytes: content.length, sha256: contentHash } };
      const missing = { kind: 'missing', parent: staged.observation.parent };
      let held;
      if (reverse) {
        fs.writeFileSync(target, content, { mode: 0o640 });
        const original = readStableDirectoryFile({ fd: grant.fd, relative: 'target', sync: true }, content.length, signal); assert.ok(original);
        state.observation = original.observation;
        const retained = `.litcode-remove-${forwardId}`; fs.mkdirSync(path.join(outside, retained));
        fs.renameSync(target, path.join(outside, retained, 'held'));
        held = readStableDirectoryFile({ fd: grant.fd, relative: `${retained}/held`, sync: true }, content.length, signal); assert.ok(held);
      }
      const operation = { action: reverse ? 'remove' : 'write', path: target,
        before: reverse ? state : missing, after: reverse ? missing : state,
        grant: { root: outside, owner: source.id, incarnation: grant.incarnation, dev: String(grant.dev), ino: String(grant.ino) },
        stage: reverse ? { kind: 'completed', id: forwardId, result: { kind: 'quarantined', observation: held.observation } } : { kind: 'unknown', id },
        ...(reverse ? { rollback: { kind: 'unknown', id } } : {}) };
      const intent = structuredClone(staged.observation);
      if (kind === 'intent-inode') intent.ino = String(BigInt(intent.ino) + 1n);
      if (kind === 'intent-parent') intent.parent.ino = String(BigInt(intent.parent.ino) + 1n);
      const receiptBytes = Buffer.from(`directory-write-receipt-v2\nstart\nstaging\npublishing\nintent create ${alias} ${directoryFileObservationFrame(intent)}\ncommitting\n${kind === 'trailer' ? 'error unknown 5\nexit 1\n' : ''}`);
      const receipt = createDirectoryReceipt(store, id);
      try { fs.writeSync(receipt.fd, receiptBytes); fs.fsyncSync(receipt.fd); } finally { receipt.close(); }
      if (reverse) operation.rollbackReceipt = receipt.identity; else operation.receipt = receipt.identity;
      const record = { version: 1, owner: source.id, checkpoint: { owner: source.id, name: 'fixture', digest: '0'.repeat(64) },
        plan: '0'.repeat(64), operations: [operation] };
      fs.linkSync(staging, target);
      assert.equal(readStableDirectoryFile({ fd: grant.fd, relative: 'target', sync: true }, 32, signal), undefined);
      assert.equal(readLinkedDirectoryPair({ fd: grant.fd, relative: 'target', alias }, 1, signal), undefined);
      if (kind === 'alias-replaced') { fs.renameSync(staging, `${staging}-old`); fs.writeFileSync(staging, content); }
      if (kind === 'third-link') fs.linkSync(target, `${target}-third`);
      if (kind === 'content') fs.writeFileSync(target, 'CHANGED');
      const inspect = () => inspectLinkedDirectoryAttempt(receiptBytes, operation, reverse, source, signal);
      const unchanged = JSON.stringify(record);
      if (['intent-parent', 'trailer', 'alias-replaced', 'third-link'].includes(kind)) assert.equal(inspect(), undefined, kind);
      else if (['intent-inode', 'content'].includes(kind)) assert.throws(inspect, /linked identity or content changed/);
      else {
        const proof = inspect(); assert.ok(proof, kind); proof.verify();
        assert.equal(proof.evidence.reverse, reverse); assert.equal(proof.evidence.observation.nlink, '2');
        if (kind === 'regrant') {
          source.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
          assert.throws(inspect, /explicit grant/); grantDirectory();
          assert.throws(proof.verify, /linked authority changed/);
        }
        if (kind === 'aborted') {
          const controller = new AbortController(); controller.abort();
          assert.throws(() => inspectLinkedDirectoryAttempt(receiptBytes, operation, reverse, source, controller.signal));
        }
        if (kind === 'evidence-mutated') {
          proof.evidence.observation.ino = '0'; proof.verify();
          fs.writeFileSync(target, 'CHANGED'); assert.throws(proof.verify, /linked identity or content changed/);
        }
        if (kind === 'receipt-replaced') {
          const name = path.join(store, `native-attempt-${id}.receipt`);
          fs.renameSync(name, `${name}-original`); fs.writeFileSync(name, receiptBytes, { mode: 0o600 });
          assert.throws(() => reconcileDirectoryReceipts(store, record, source, signal), /receipt identity changed/);
        } else if (!['regrant', 'evidence-mutated'].includes(kind)) {
          const candidate = reconcileDirectoryReceipts(store, record, source, signal);
          assert.equal(candidate.linked.size, 1); candidate.linked.get(target).verify();
        }
      }
      assert.equal(JSON.stringify(record), unchanged, 'observation must not promote or mutate the transaction');
      results.push(kind);
    } finally { await source.close(); }
  }
  console.log(JSON.stringify({ linkedBinding: results, candidateOnly: true }));
} finally { fs.rmSync(base, { recursive: true, force: true }); }
