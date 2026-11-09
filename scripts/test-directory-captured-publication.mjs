import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'captured-publication-')));
const production = path.join(root, 'native/directory-write/write'), instrumented = path.join(work, 'instrumented');
const { publishCapturedDirectoryFile, parseDirectoryFileObservationFrame } = await import(pathToFileURL(path.join(root, 'dist/directory-file-state.js')));
const { lock } = await import(pathToFileURL(path.join(root, 'dist/skill-effects.js')));
const outcomes = [];
let success = false;
function frame(file) {
  const s = fs.statSync(file, { bigint: true }), p = fs.statSync(path.dirname(file), { bigint: true });
  return ['v2', s.dev, s.ino, s.size, s.mtimeNs / 1000000000n, s.mtimeNs % 1000000000n,
    s.ctimeNs / 1000000000n, s.ctimeNs % 1000000000n, s.mode & 0o7777n, s.nlink, p.dev, p.ino].join(':');
}
try {
  assert.equal(process.platform, 'darwin', 'captured publication currently requires the retained writer on macOS');
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', instrumented, path.join(root, 'native/directory-write/write.c')]);
  for (const kind of ['normal', 'binary', 'empty', 'adapter', 'closed-pipe', 'lease', 'receipt-invalid', 'wrong-parent', 'occupied', 'wrong-original-bytes', 'wrong-desired-bytes',
    'held-substituted', 'stage-substituted', 'held-content', 'stage-content', 'held-hardlink', 'stage-hardlink', 'zero-mode',
    'quarantine-swap', 'parent-swap', 'late-occupied', 'late-stage-swap', 'output-swap', 'cancel', 'kill-before', 'kill-after']) {
    const dir = path.join(work, kind), sub = path.join(dir, 'sub'); fs.mkdirSync(dir); fs.mkdirSync(sub);
    const target = path.join(sub, 'value'), before = path.join(dir, 'before'), desired = path.join(dir, 'desired');
    const oldBytes = Buffer.from('ORIGINAL'), bytes = kind === 'binary' ? Buffer.from([0, 255, 7, 128]) : kind === 'empty' ? Buffer.alloc(0) : Buffer.from('DESIRED');
    fs.writeFileSync(target, oldBytes, { mode: 0o640 }); fs.writeFileSync(before, oldBytes); fs.writeFileSync(desired, bytes);
    const rootFd = fs.openSync(dir, 'r'), beforeFd = fs.openSync(before, 'r'), desiredFd = fs.openSync(desired, 'r');
    const receiptPath = path.join(dir, 'receipt'); fs.writeFileSync(receiptPath, kind === 'receipt-invalid' ? 'occupied' : '', { mode: 0o600 });
    const receiptFd = fs.openSync(receiptPath, 'r+'), id = crypto.randomUUID(), retained = path.join(sub, `.litcode-replace-${id}`);
    let child, leaseFd, probeFd;
    try {
      const capture = spawnSync(instrumented, ['--restore-retained', 'sub/value', String(bytes.length), frame(target), id, kind === 'zero-mode' ? '0' : '489', '--execute'], {
        input: bytes, stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'ignore', 'ignore', beforeFd], timeout: 10000,
        env: { ...process.env, DIRECTORY_WRITE_TEST_POINT: 'replace_after_capture', DIRECTORY_WRITE_TEST_SELF_KILL: '1' },
      });
      assert.equal(capture.signal, 'SIGKILL', capture.stderr?.toString()); assert.equal(fs.existsSync(target), false);
      const heldPath = path.join(retained, 'held'), stagePath = path.join(retained, 'staged');
      const held = frame(heldPath), staged = frame(stagePath), parent = fs.statSync(sub, { bigint: true });
      if (kind === 'wrong-original-bytes') fs.writeFileSync(before, 'CHANGED!');
      if (kind === 'wrong-desired-bytes') fs.writeFileSync(desired, 'CHANGED');
      const missing = `missing:${parent.dev}:${kind === 'wrong-parent' ? '999999999999999999' : parent.ino}`;
      const substitute = file => { const content = fs.readFileSync(file), mode = fs.statSync(file).mode & 0o7777; fs.renameSync(file, `${file}-original`); fs.writeFileSync(file, content, { mode }); };
      if (kind === 'occupied') fs.writeFileSync(target, 'OUTSIDE', { flag: 'wx' });
      if (kind === 'held-substituted') substitute(heldPath);
      if (kind === 'stage-substituted') substitute(stagePath);
      if (kind === 'held-content') fs.writeFileSync(heldPath, 'CHANGED!');
      if (kind === 'stage-content') fs.writeFileSync(stagePath, 'CHANGED');
      if (kind === 'held-hardlink') fs.linkSync(heldPath, `${heldPath}-link`);
      if (kind === 'stage-hardlink') fs.linkSync(stagePath, `${stagePath}-link`);
      if (kind === 'quarantine-swap') {
        fs.renameSync(retained, `${retained}-original`); fs.mkdirSync(retained, { mode: 0o700 });
        fs.copyFileSync(path.join(`${retained}-original`, 'held'), heldPath); fs.copyFileSync(path.join(`${retained}-original`, 'staged'), stagePath);
      }
      if (kind === 'parent-swap') { fs.renameSync(sub, `${sub}-original`); fs.mkdirSync(sub); }
      if (kind === 'adapter') {
        const result = publishCapturedDirectoryFile({ fd: rootFd, relative: 'sub/value', parent: { dev: String(parent.dev), ino: String(parent.ino) },
          held: parseDirectoryFileObservationFrame(held), staged: parseDirectoryFileObservationFrame(staged), originalFd: beforeFd, desiredFd,
          transactionId: id, receiptFd });
        assert.equal(result.kind, 'durable', JSON.stringify(result));
        assert.deepEqual(result.observation, parseDirectoryFileObservationFrame(frame(target)));
        assert.deepEqual(result.held, parseDirectoryFileObservationFrame(held));
        assert.deepEqual(fs.readFileSync(target), bytes); assert.equal(fs.existsSync(stagePath), false);
        outcomes.push({ kind, result: result.kind }); continue;
      }
      const point = ['late-occupied', 'late-stage-swap'].includes(kind) ? 'captured_after_recheck' :
        ['output-swap', 'kill-after'].includes(kind) ? 'captured_after_publish' : ['cancel', 'kill-before', 'lease'].includes(kind) ? 'captured_before_publish' : undefined;
      const killed = kind.startsWith('kill-');
      if (kind === 'lease') { leaseFd = fs.openSync(path.join(dir, 'lease'), 'wx+'); assert.equal(lock(leaseFd, false), true); }
      child = spawn(point ? instrumented : production, ['--receipt', '--publish-captured', 'sub/value', missing, held, staged, id, '--execute'], {
        timeout: 15000, killSignal: 'SIGKILL',
        stdio: ['ignore', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', leaseFd ?? 'ignore', beforeFd, receiptFd, desiredFd],
        env: { ...process.env, ...(point ? { DIRECTORY_WRITE_TEST_POINT: point } : {}), ...(killed ? { DIRECTORY_WRITE_TEST_SELF_KILL: '1' } : {}) },
      });
      let status = '', errors = '', closed = false;
      child.stderr.on('data', b => { errors += String(b); }); child.stdio[5].on('error', () => {});
      if (kind === 'closed-pipe') child.stdio[4].destroy(); else child.stdio[4].on('data', b => { status += String(b); });
      const completion = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => { closed = true; resolve({ code, signal }); }); });
      if (point && !killed) {
        const until = Date.now() + 10000;
        while (!status.includes(`test ${point}\n`)) { assert.ok(!closed && Date.now() < until, `${kind}: ${status} ${errors}`); await new Promise(resolve => setTimeout(resolve, 10)); }
        if (kind === 'late-occupied') fs.writeFileSync(target, 'OUTSIDE', { flag: 'wx' });
        if (kind === 'late-stage-swap') { fs.renameSync(stagePath, `${stagePath}-original`); fs.writeFileSync(stagePath, 'OUTSIDE'); }
        if (kind === 'output-swap') { fs.renameSync(target, `${target}-original`); fs.writeFileSync(target, 'OUTSIDE'); }
        if (kind === 'lease') {
          fs.closeSync(leaseFd); leaseFd = undefined;
          probeFd = fs.openSync(path.join(dir, 'lease'), 'r+'); assert.equal(lock(probeFd, false), false);
        }
        if (kind === 'cancel') child.kill('SIGTERM'); else child.stdio[5].write('c');
      }
      const result = await completion, receipt = fs.readFileSync(receiptPath, 'utf8');
      if (kind === 'lease') assert.equal(lock(probeFd, false), true);
      if (['normal', 'binary', 'empty', 'closed-pipe', 'lease'].includes(kind)) {
        assert.equal(result.code, 0, status + errors); assert.match(receipt, /\ndurable\nexit 0\n$/);
        assert.deepEqual(fs.readFileSync(target), bytes); assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
        assert.equal(frame(target).split(':')[2], staged.split(':')[2]); assert.equal(fs.existsSync(stagePath), false);
        // Repeating the exact request cannot recapture or overwrite the landed file.
        const repeated = publishCapturedDirectoryFile({ fd: rootFd, relative: 'sub/value', parent: { dev: String(parent.dev), ino: String(parent.ino) },
          held: parseDirectoryFileObservationFrame(held), staged: parseDirectoryFileObservationFrame(staged), originalFd: beforeFd, desiredFd, transactionId: id });
        assert.equal(repeated.kind, 'not_published'); assert.deepEqual(fs.readFileSync(target), bytes);
      } else {
        assert.doesNotMatch(receipt, /\ndurable\nexit 0\n$/);
        if (killed) assert.equal(result.signal, 'SIGKILL'); else assert.notEqual(result.code, 0, status);
        if (kind === 'kill-after') { assert.deepEqual(fs.readFileSync(target), bytes); assert.equal(frame(target).split(':')[2], staged.split(':')[2]); }
        else if (['occupied', 'late-occupied', 'late-stage-swap', 'output-swap'].includes(kind)) assert.equal(fs.readFileSync(target, 'utf8'), 'OUTSIDE');
        else assert.equal(fs.existsSync(target), false);
        if (['late-stage-swap', 'output-swap'].includes(kind)) assert.match(status, /error unknown/);
        if (kind === 'receipt-invalid') assert.equal(receipt, 'occupied');
        if (kind === 'late-stage-swap') assert.deepEqual(fs.readFileSync(`${stagePath}-original`), bytes);
        if (kind === 'output-swap') assert.deepEqual(fs.readFileSync(`${target}-original`), bytes);
      }
      if (!['held-content', 'parent-swap'].includes(kind)) assert.deepEqual(fs.readFileSync(heldPath), oldBytes);
      outcomes.push({ kind, ...result });
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      if (leaseFd !== undefined) fs.closeSync(leaseFd);
      if (probeFd !== undefined) fs.closeSync(probeFd);
      for (const fd of [rootFd, beforeFd, desiredFd, receiptFd]) fs.closeSync(fd);
    }
  }
  success = true; console.log(JSON.stringify({ capturedPublication: outcomes }));
} finally {
  if (success) fs.rmSync(work, { recursive: true, force: true });
  else console.error(`fixture retained: ${work}`);
}
