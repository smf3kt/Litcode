import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const base = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();
const work = fs.mkdtempSync(path.join(base, 'directory-retained-write-'));
const production = path.join(root, 'native/directory-write/write'), instrumented = path.join(work, 'instrumented');
const outcomes = [];
let success = false;
function fileFrame(file) {
  const stat = fs.statSync(file, { bigint: true }), parent = fs.statSync(path.dirname(file), { bigint: true });
  const seconds = value => value / 1000000000n, nanos = value => value % 1000000000n;
  return ['v2', stat.dev, stat.ino, stat.size, seconds(stat.mtimeNs), nanos(stat.mtimeNs), seconds(stat.ctimeNs), nanos(stat.ctimeNs),
    stat.mode & 0o7777n, stat.nlink, parent.dev, parent.ino].join(':');
}
try {
  if (process.platform !== 'darwin') {
    const { publishRetainedDirectoryFile } = await import(pathToFileURL(path.join(root, 'dist/directory-file-state.js')).href);
    const f = path.join(work, 'file'); fs.writeFileSync(f, 'ORIGINAL');
    const { parseDirectoryFileObservationFrame } = await import(pathToFileURL(path.join(root, 'dist/directory-file-state.js')).href);
    assert.equal(publishRetainedDirectoryFile({ fd: 0, relative: 'file', expected: parseDirectoryFileObservationFrame(fileFrame(f)),
      expectedFd: 0, content: Buffer.from('NEW'), transactionId: crypto.randomUUID() }).kind, 'not_published');
    success = true; process.stdout.write(JSON.stringify({ platform: process.platform, unsupported: true }) + '\n'); process.exitCode = 0;
  } else {
    execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', instrumented,
      path.join(root, 'native/directory-write/write.c')], { timeout: 30000 });
    const barriers = {
      'late-replacement': 'replace_after_recheck', 'same-inode': 'replace_after_recheck',
      occupied: 'replace_after_capture', 'late-occupied': 'replace_after_stage_check', 'parent-move': 'replace_after_recheck',
      'held-swap': 'replace_after_capture', 'stage-swap': 'replace_before_stage_check', 'stage-swap-late': 'replace_after_stage_check',
      'stage-inplace': 'replace_before_stage_check', 'stage-inplace-late': 'replace_after_stage_check',
      'output-swap': 'replace_after_publish', 'final-output-swap': 'replace_before_final',
      'kill-captured': 'replace_after_capture', 'kill-published': 'replace_after_publish', 'quarantine-move': 'replace_after_recheck',
    };
    const cases = ['normal', 'binary', 'empty', 'restore-mode', 'restore-zero', 'restore-invalid', 'short-input', 'identical-witness', 'preexisting-transaction',
      'late-replacement', 'same-inode', 'occupied', 'late-occupied', 'parent-move', 'held-swap', 'stage-swap',
      'stage-swap-late', 'stage-inplace', 'stage-inplace-late', 'output-swap', 'final-output-swap', 'quarantine-move',
      'old-writer', 'kill-captured', 'kill-published'];
    for (const kind of cases) {
      const dir = path.join(work, kind), sub = path.join(dir, 'sub'); fs.mkdirSync(dir); fs.mkdirSync(sub);
      const target = path.join(sub, 'target'), witness = path.join(dir, 'witness'), id = crypto.randomUUID();
      const original = Buffer.from('ORIGINAL'), content = kind === 'binary' ? Buffer.from([0, 255, 65, 128, 10]) : kind === 'empty' ? Buffer.alloc(0) : Buffer.from('NEW');
      fs.writeFileSync(target, original, { mode: 0o751 }); fs.utimesSync(target, 1700000000, 1700000000);
      fs.writeFileSync(witness, original); const expected = fileFrame(target), initial = fs.statSync(target, { bigint: true });
      let qdir = path.join(sub, `.litcode-replace-${id}`);
      if (kind === 'preexisting-transaction') { fs.mkdirSync(qdir); fs.writeFileSync(path.join(qdir, 'sentinel'), 'UNCHANGED'); }
      const rootFd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(kind === 'identical-witness' ? target : witness, 'r');
      const oldWriter = kind === 'old-writer' ? fs.openSync(target, 'r+') : undefined;
      const point = barriers[kind], declared = content.length + (kind === 'short-input' ? 1 : 0);
      const restoreMode = kind === 'restore-mode' ? 0o640 : kind === 'restore-zero' ? 0 : kind === 'restore-invalid' ? 0o10000 : undefined;
      const child = spawn(point ? instrumented : production,
        [restoreMode === undefined ? '--replace-retained' : '--restore-retained', 'sub/target', String(declared), expected, id,
          ...(restoreMode === undefined ? [] : [String(restoreMode)]), '--execute'],
        { stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', 'ignore', witnessFd],
          env: { ...process.env, ...(point ? { DIRECTORY_WRITE_TEST_POINT: point, DIRECTORY_WRITE_TEST_FIXED_TIME: '1' } : {}) } });
      let status = '', stderr = '', finished;
      child.stdio[4].on('data', data => { status += String(data); }); child.stderr.on('data', data => { stderr += String(data); });
      child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; }); child.stdio[5].on('error', () => {});
      const completed = new Promise(resolve => child.once('close', (code, signal) => { finished = { code, signal }; resolve(finished); }));
      const wait = async marker => {
        const deadline = Date.now() + 5000;
        while (!status.includes(marker)) {
          assert.ok(Date.now() < deadline && !finished, `${kind} waiting for ${marker}: ${status} ${stderr}`);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      try {
        child.stdin.end(content);
        if (point) {
          await wait(`test ${point}\n`);
          if (kind === 'late-replacement') { fs.renameSync(target, path.join(sub, 'original')); fs.writeFileSync(target, 'OTHER'); }
          if (kind === 'same-inode') { fs.writeFileSync(target, 'MUTATED!'); fs.utimesSync(target, 1700000000, 1700000000); }
          if (kind === 'occupied' || kind === 'late-occupied') fs.writeFileSync(target, 'THIRD', { flag: 'wx' });
          if (kind === 'parent-move') {
            fs.renameSync(sub, path.join(dir, 'sub-old')); fs.mkdirSync(sub); fs.writeFileSync(target, 'OTHER');
            qdir = path.join(dir, 'sub-old', `.litcode-replace-${id}`);
          }
          if (kind === 'quarantine-move') {
            fs.renameSync(qdir, `${qdir}-moved`); fs.mkdirSync(qdir, { mode: 0o700 }); qdir = `${qdir}-moved`;
          }
          if (kind === 'held-swap') { fs.renameSync(path.join(qdir, 'held'), path.join(qdir, 'held-original')); fs.writeFileSync(path.join(qdir, 'held'), 'OTHER'); }
          if (kind === 'stage-swap' || kind === 'stage-swap-late') {
            fs.renameSync(path.join(qdir, 'staged'), path.join(qdir, 'staged-original')); fs.writeFileSync(path.join(qdir, 'staged'), 'BAD');
          }
          if (kind === 'stage-inplace' || kind === 'stage-inplace-late') {
            fs.writeFileSync(path.join(qdir, 'staged'), 'BAD'); fs.utimesSync(path.join(qdir, 'staged'), 1700000000, 1700000000);
          }
          if (kind === 'output-swap' || kind === 'final-output-swap') {
            fs.renameSync(target, path.join(sub, 'published-original')); fs.writeFileSync(target, content, { mode: 0o751 }); fs.chmodSync(target, 0o751);
          }
          if (kind.startsWith('kill-')) child.kill('SIGKILL'); else child.stdio[5].end('c');
        }
        const result = await completed;
        if (['normal', 'binary', 'empty', 'old-writer', 'restore-mode', 'restore-zero'].includes(kind)) {
          assert.equal(result.code, 0, `${kind}: ${status} ${stderr}`);
          assert.match(status, /held v2:[^\n]+\nlanded v2:[^\n]+\ndurable\n$/);
          assert.equal(fs.statSync(target).mode & 0o7777, restoreMode ?? 0o751);
          if (restoreMode === 0) fs.chmodSync(target, 0o600); // Inspect only after asserting the restored mode.
          assert.deepEqual(fs.readFileSync(target), content);
          assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          assert.equal(fs.statSync(path.join(qdir, 'held')).mode & 0o7777, 0o751);
          assert.equal(fs.statSync(path.join(qdir, 'held'), { bigint: true }).ino, initial.ino);
          if (oldWriter !== undefined) { fs.writeSync(oldWriter, 'CHANGED!', 0, 'utf8'); assert.equal(fs.readFileSync(path.join(qdir, 'held'), 'utf8'), 'CHANGED!'); }
        } else if (kind === 'short-input') {
          assert.notEqual(result.code, 0); assert.match(status, /error unknown/); assert.deepEqual(fs.readFileSync(target), original);
          assert.deepEqual(fs.readFileSync(path.join(qdir, 'staged')), content);
        } else if (kind === 'identical-witness' || kind === 'preexisting-transaction' || kind === 'restore-invalid') {
          assert.notEqual(result.code, 0); assert.match(status, /error not_published/); assert.deepEqual(fs.readFileSync(target), original);
          if (kind === 'preexisting-transaction') assert.equal(fs.readFileSync(path.join(qdir, 'sentinel'), 'utf8'), 'UNCHANGED');
          if (kind === 'restore-invalid') { assert.equal(fs.existsSync(qdir), false); assert.equal(fs.statSync(target).mode & 0o7777, 0o751); }
        } else if (kind.startsWith('kill-')) {
          assert.equal(result.signal, 'SIGKILL'); assert.doesNotMatch(status, /durable/);
          assert.equal(fs.existsSync(target), kind === 'kill-published');
          if (kind === 'kill-published') assert.deepEqual(fs.readFileSync(target), content);
          assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
        } else {
          assert.notEqual(result.code, 0, `${kind}: ${status}`); assert.match(status, /error unknown/); assert.doesNotMatch(status, /durable/);
          if (kind === 'late-replacement') {
            assert.equal(fs.readFileSync(path.join(sub, 'original'), 'utf8'), 'ORIGINAL'); assert.equal(fs.existsSync(target), false);
            assert.equal(fs.readFileSync(path.join(qdir, 'held'), 'utf8'), 'OTHER');
          } else if (kind === 'same-inode') {
            assert.equal(fs.existsSync(target), false); assert.equal(fs.readFileSync(path.join(qdir, 'held'), 'utf8'), 'MUTATED!');
          } else if (kind === 'occupied' || kind === 'late-occupied') {
            assert.equal(fs.readFileSync(target, 'utf8'), 'THIRD'); assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          } else if (kind === 'parent-move') {
            assert.equal(fs.readFileSync(target, 'utf8'), 'OTHER'); assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          } else if (kind === 'held-swap') {
            assert.equal(fs.existsSync(target), false); assert.equal(fs.readFileSync(path.join(qdir, 'held'), 'utf8'), 'OTHER');
            assert.deepEqual(fs.readFileSync(path.join(qdir, 'held-original')), original);
          } else if (kind === 'stage-swap' || kind === 'stage-swap-late') {
            assert.equal(fs.existsSync(target), kind === 'stage-swap-late');
            if (kind === 'stage-swap-late') assert.equal(fs.readFileSync(target, 'utf8'), 'BAD');
            else assert.equal(fs.readFileSync(path.join(qdir, 'staged'), 'utf8'), 'BAD');
            assert.deepEqual(fs.readFileSync(path.join(qdir, 'staged-original')), content); assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          } else if (kind === 'stage-inplace' || kind === 'stage-inplace-late') {
            assert.equal(fs.existsSync(target), kind === 'stage-inplace-late');
            if (kind === 'stage-inplace-late') assert.equal(fs.readFileSync(target, 'utf8'), 'BAD');
            else assert.equal(fs.readFileSync(path.join(qdir, 'staged'), 'utf8'), 'BAD');
            assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          } else if (kind === 'output-swap' || kind === 'final-output-swap') {
            assert.deepEqual(fs.readFileSync(path.join(sub, 'published-original')), content);
            assert.deepEqual(fs.readFileSync(target), content); assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
            assert.notEqual(fs.statSync(target, { bigint: true }).ino, fs.statSync(path.join(sub, 'published-original'), { bigint: true }).ino);
          } else if (kind === 'quarantine-move') {
            assert.equal(fs.existsSync(target), false); assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          }
        }
        outcomes.push({ kind, code: result.code, signal: result.signal });
      } finally {
        if (!finished) { child.kill('SIGKILL'); await completed; }
        fs.closeSync(rootFd); fs.closeSync(witnessFd); if (oldWriter !== undefined) fs.closeSync(oldWriter);
      }
    }
    const observationCases = [];
    for (const kind of ['normal', 'held-swap', 'held-inplace', 'directory-swap', 'parent-swap', 'witness-change', 'kill',
      'archive-kill', 'archive-intent-kill', 'archive-receipt-kill', 'archive-swap', 'archive-extra']) {
      const dir = path.join(work, `observe-${kind}`), sub = path.join(dir, 'sub'); fs.mkdirSync(dir); fs.mkdirSync(sub);
      const target = path.join(sub, 'target'), witness = path.join(dir, 'witness'), id = crypto.randomUUID();
      fs.writeFileSync(target, 'ORIGINAL', { mode: 0o751 }); fs.utimesSync(target, 1700000000, 1700000000);
      fs.writeFileSync(witness, 'ORIGINAL');
      const rootFd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(witness, 'r');
      let child, finished, completed;
      let archiveFd, gateFd;
      try {
        const published = spawnSync(production, ['--replace-retained', 'sub/target', '3', fileFrame(target), id, '--execute'],
          { input: 'NEW', encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'ignore', 'ignore', witnessFd], timeout: 10000 });
        assert.equal(published.status, 0, `${kind}: ${published.output[4]} ${published.stderr}`);
        const qdir = path.join(sub, `.litcode-replace-${id}`), held = path.join(qdir, 'held'), frame = fileFrame(held);
        const archiving = kind.startsWith('archive-'), archive = path.join(work, kind + '-store');
        const parent = fs.statSync(sub, { bigint: true });
        const args = archiving ? ['--archive-retained', 'sub/target', frame, id, `missing:${parent.dev}:${parent.ino}`, '--execute']
          : ['--observe-retained', 'sub/target', frame, id, '--execute'];
        if (archiving) {
          fs.mkdirSync(archive, { mode: 0o700 }); archiveFd = fs.openSync(archive, 'r');
          gateFd = fs.openSync(path.join(dir, 'gate'), 'wx+', 0o600);
        }
        if (kind === 'archive-extra') fs.writeFileSync(path.join(qdir, 'extra'), 'OTHER');
        const point = kind === 'normal' || kind === 'archive-extra' ? undefined : kind === 'archive-kill' ? 'archive_after_capture'
          : kind === 'archive-intent-kill' ? 'archive_after_intent' : kind === 'archive-receipt-kill' ? 'archive_after_receipt'
          : kind === 'archive-swap' ? 'archive_before_capture' : 'observe_retained_after_read';
        const stdio = ['ignore', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', gateFd ?? 'ignore', witnessFd, 'ignore', archiveFd ?? 'ignore'];
        child = spawn(point ? instrumented : production, args,
          { stdio,
            env: { ...process.env, ...(point ? { DIRECTORY_WRITE_TEST_POINT: point } : {}) } });
        let status = '', stderr = '';
        child.stdio[4].on('data', data => { status += String(data); }); child.stderr.on('data', data => { stderr += String(data); });
        child.stdio[5].on('error', () => {});
        completed = new Promise(resolve => child.once('close', (code, signal) => { finished = { code, signal }; resolve(finished); }));
        if (point) {
          const deadline = Date.now() + 5000;
          while (!status.includes(`test ${point}\n`)) {
            assert.ok(Date.now() < deadline && !finished, `${kind} waiting for ${point}: ${status} ${stderr}`);
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          if (kind === 'held-swap') { fs.renameSync(held, `${held}-original`); fs.writeFileSync(held, 'ORIGINAL', { mode: 0o751 }); }
          if (kind === 'held-inplace') { fs.writeFileSync(held, 'MUTATED!'); fs.utimesSync(held, 1700000000, 1700000000); }
          if (kind === 'directory-swap') { fs.renameSync(qdir, `${qdir}-original`); fs.mkdirSync(qdir, { mode: 0o700 }); }
          if (kind === 'parent-swap') { fs.renameSync(sub, `${sub}-original`); fs.mkdirSync(sub); }
          if (kind === 'witness-change') fs.writeFileSync(witness, 'MUTATED!');
          if (kind === 'archive-swap') {
            fs.renameSync(qdir, qdir + '-original'); fs.mkdirSync(qdir, { mode: 0o700 });
            fs.writeFileSync(path.join(qdir, 'held'), 'ORIGINAL');
          }
          if (kind.endsWith('kill')) child.kill('SIGKILL'); else child.stdio[5].end('c');
        }
        const result = await completed;
        if (archiving) {
          const captured = path.join(archive, path.basename(qdir), 'held');
          if (kind.endsWith('kill')) {
            assert.equal(result.signal, 'SIGKILL'); assert.equal(fs.existsSync(qdir), kind === 'archive-intent-kill');
            assert.equal(fileFrame(kind === 'archive-intent-kill' ? held : captured), frame);
            const gate = path.join(dir, 'gate'), mark = phase => spawnSync('/usr/bin/xattr', ['-p', 'org.litcode.archive.' + phase + '.' + id, gate], { encoding: 'utf8' });
            assert.equal(mark('intent').status, 0);
            assert.equal(mark('captured').status === 0, kind === 'archive-receipt-kill');
            const retry = spawnSync(production, args, { stdio, encoding: 'utf8', timeout: 10000 });
            assert.equal(retry.status, 0); assert.equal(retry.output[4], `start\narchived ${frame}\n`);
            assert.equal(mark('intent').stdout, mark('captured').stdout);
          } else {
            assert.notEqual(result.code, 0); assert.doesNotMatch(status, /archived v2:/);
            if (kind === 'archive-swap') {
              assert.equal(fileFrame(path.join(qdir + '-original', 'held')), frame);
              assert.equal(fs.existsSync(captured), false, 'a substituted holder must stay at the source');
              assert.equal(fs.readFileSync(held, 'utf8'), 'ORIGINAL'); assert.notEqual(fileFrame(held), frame);
              assert.notEqual(spawnSync(production, args, { stdio, timeout: 10000 }).status, 0);
            } else {
              assert.equal(fs.existsSync(captured), false); assert.equal(fileFrame(held), frame);
              assert.equal(fs.readFileSync(path.join(qdir, 'extra'), 'utf8'), 'OTHER');
              fs.unlinkSync(path.join(qdir, 'extra'));
              fs.mkdirSync(path.dirname(captured), { mode: 0o700 });
              const occupied = fs.statSync(path.dirname(captured)).ino;
              assert.notEqual(spawnSync(production, args, { stdio, timeout: 10000 }).status, 0);
              assert.equal(fileFrame(held), frame); assert.equal(fs.statSync(path.dirname(captured)).ino, occupied);
            }
          }
        } else if (kind === 'normal') { assert.equal(result.code, 0, `${status} ${stderr}`); assert.equal(status, `start\nobserved ${frame}\n`); }
        else if (kind === 'kill') { assert.equal(result.signal, 'SIGKILL'); assert.doesNotMatch(status, /observed v2:/); }
        else { assert.notEqual(result.code, 0); assert.match(status, /error unknown/); assert.doesNotMatch(status, /observed v2:/); }
        observationCases.push({ kind, code: result.code, signal: result.signal });
      } finally {
        if (child && !finished) { child.kill('SIGKILL'); await completed; }
        if (archiveFd !== undefined) fs.closeSync(archiveFd);
        if (gateFd !== undefined) fs.closeSync(gateFd);
        fs.closeSync(rootFd); fs.closeSync(witnessFd);
      }
    }
    const { publishRetainedDirectoryFile, observeRetainedDirectoryFile, parseDirectoryFileObservationFrame,
      publishDirectoryFile, removeDirectoryFile, readStableDirectoryFile, probeMissingDirectoryFile } = await import(pathToFileURL(path.join(root, 'dist/directory-file-state.js')).href);
    const adapterDir = path.join(work, 'adapter'); fs.mkdirSync(adapterDir);
    const adapterTarget = path.join(adapterDir, 'target'), adapterWitness = path.join(work, 'adapter-witness');
    fs.writeFileSync(adapterTarget, 'ORIGINAL', { mode: 0o751 }); fs.writeFileSync(adapterWitness, 'ORIGINAL');
    const expected = parseDirectoryFileObservationFrame(fileFrame(adapterTarget)), rootFd = fs.openSync(adapterDir, 'r'), witnessFd = fs.openSync(adapterWitness, 'r');
    try {
      const id = crypto.randomUUID(), result = publishRetainedDirectoryFile({ fd: rootFd, relative: 'target', expected, expectedFd: witnessFd,
        content: Buffer.from('NEW'), transactionId: id });
      assert.equal(result.kind, 'durable', JSON.stringify(result)); assert.equal(result.transactionId, id);
      assert.equal(result.held.ino, expected.ino); assert.equal(result.observation.ino, String(fs.statSync(adapterTarget, { bigint: true }).ino));
      assert.equal(fs.readFileSync(path.join(adapterDir, `.litcode-replace-${id}`, 'held'), 'utf8'), 'ORIGINAL');
      assert.equal(fs.readFileSync(adapterTarget, 'utf8'), 'NEW');
      assert.equal(observeRetainedDirectoryFile({ fd: rootFd, relative: 'target', expected: result.held, expectedFd: witnessFd, transactionId: id }).kind, 'observed');
      fs.writeFileSync(path.join(adapterDir, `.litcode-replace-${id}`, 'held'), 'MODIFIED');
      assert.equal(observeRetainedDirectoryFile({ fd: rootFd, relative: 'target', expected: result.held, expectedFd: witnessFd, transactionId: id }).kind, 'unknown');
    } finally { fs.closeSync(rootFd); fs.closeSync(witnessFd); }
    for (const restoreMode of [0o640, 0]) {
      const dir = path.join(work, `adapter-restore-${restoreMode}`); fs.mkdirSync(dir);
      const target = path.join(dir, 'target'), witness = path.join(dir, 'witness');
      fs.writeFileSync(target, 'CURRENT', { mode: 0o751 }); fs.writeFileSync(witness, 'CURRENT');
      const expected = parseDirectoryFileObservationFrame(fileFrame(target));
      const rootFd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(witness, 'r'), id = crypto.randomUUID();
      const input = { fd: rootFd, relative: 'target', expected, expectedFd: witnessFd, content: Buffer.from([0, 255, 65]), transactionId: id };
      try {
        for (const invalid of [-1, 0.5, 0o10000]) assert.throws(() => publishRetainedDirectoryFile({ ...input, restoreMode: invalid }));
        assert.equal(fs.existsSync(path.join(dir, `.litcode-replace-${id}`)), false);
        assert.equal(fs.readFileSync(target, 'utf8'), 'CURRENT'); assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
        const result = publishRetainedDirectoryFile({ ...input, restoreMode });
        assert.equal(result.kind, 'durable', JSON.stringify(result));
        assert.equal(result.observation.mode, restoreMode); assert.equal(result.held.mode, 0o751);
        assert.equal(fs.statSync(target).mode & 0o7777, restoreMode);
        if (restoreMode === 0) fs.chmodSync(target, 0o600);
        assert.deepEqual(fs.readFileSync(target), input.content);
        assert.equal(fs.readFileSync(path.join(dir, `.litcode-replace-${id}`, 'held'), 'utf8'), 'CURRENT');
      } finally { fs.closeSync(rootFd); fs.closeSync(witnessFd); }
    }
    const receiptCases = [];
    for (const kind of ['normal', 'closed-pipe', 'killed', 'nonempty', 'wrong-mode', 'hardlink', 'readonly']) {
      const dir = path.join(work, `receipt-${kind}`); fs.mkdirSync(dir);
      const target = path.join(dir, 'target'), witness = path.join(dir, 'before'), receipt = path.join(dir, 'receipt');
      fs.writeFileSync(target, 'BEFORE', { mode: 0o751 }); fs.writeFileSync(witness, 'BEFORE');
      fs.writeFileSync(receipt, kind === 'nonempty' ? 'existing' : '', { mode: 0o600 });
      if (kind === 'wrong-mode') fs.chmodSync(receipt, 0o644);
      if (kind === 'hardlink') fs.linkSync(receipt, `${receipt}-link`);
      const rootFd = fs.openSync(dir, 'r'), beforeFd = fs.openSync(witness, 'r'), receiptFd = fs.openSync(receipt, kind === 'readonly' ? 'r' : 'r+');
      const id = crypto.randomUUID(), invalid = ['nonempty', 'wrong-mode', 'hardlink', 'readonly'].includes(kind);
      try {
        const child = spawn(kind === 'killed' ? instrumented : production,
          ['--receipt', '--replace-retained', 'target', '5', fileFrame(target), id, '--execute'],
          { stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'ignore', 'ignore', beforeFd, receiptFd],
            env: { ...process.env, ...(kind === 'killed' ? { DIRECTORY_WRITE_TEST_POINT: 'replace_after_publish', DIRECTORY_WRITE_TEST_SELF_KILL: '1' } : {}) } });
        let status = '', errors = '';
        if (kind === 'closed-pipe') child.stdio[4].destroy();
        else child.stdio[4].on('data', bytes => { status += String(bytes); });
        child.stderr.on('data', bytes => { errors += String(bytes); });
        child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; });
        const completion = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
        child.stdin.end('AFTER');
        const result = await completion, saved = fs.readFileSync(receipt, 'utf8');
        if (invalid) {
          assert.equal(result.code, 2, errors); assert.equal(fs.readFileSync(target, 'utf8'), 'BEFORE');
          assert.equal(fs.existsSync(path.join(dir, `.litcode-replace-${id}`)), false);
          assert.equal(saved, kind === 'nonempty' ? 'existing' : '');
        } else {
          assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER');
          assert.equal(fs.readFileSync(path.join(dir, `.litcode-replace-${id}`, 'held'), 'utf8'), 'BEFORE');
          assert.ok(saved.startsWith('directory-write-receipt-v2\n'));
          if (kind === 'killed') { assert.equal(result.signal, 'SIGKILL'); assert.doesNotMatch(saved, /exit 0\n$/); }
          else {
            assert.equal(result.code, 0, errors);
            assert.match(saved, /^directory-write-receipt-v2\nstart\nstaging\nchecking\nintent replace v2:[^\n ]+ v2:[^\n ]+\ncapturing\ncaptured\npublishing\nrenamed\nheld v2:[^\n]+\nlanded v2:[^\n]+\ndurable\nexit 0\n$/);
            if (kind === 'normal') assert.equal(saved.replace(/^intent [^\n]+\n/m, ''), `directory-write-receipt-v2\n${status}exit 0\n`);
          }
        }
        receiptCases.push(kind);
      } finally { fs.closeSync(rootFd); fs.closeSync(beforeFd); fs.closeSync(receiptFd); }
    }
    const intentCuts = [];
    for (const [action, points] of [
      ['replace', ['replace_after_recheck', 'replace_after_capture', 'replace_after_publish']],
      ['remove', ['remove_after_recheck', 'remove_after_capture']],
      ['create', ['after_recheck', 'after_publish', 'after_rename']],
    ]) for (const point of points) {
      const dir = path.join(work, `intent-${point}`); fs.mkdirSync(dir);
      const target = path.join(dir, 'target'), before = path.join(dir, 'before'), receipt = path.join(dir, 'receipt');
      if (action !== 'create') fs.writeFileSync(target, 'BEFORE', { mode: 0o640 });
      fs.writeFileSync(before, 'BEFORE');
      const rootFd = fs.openSync(dir, 'r'), beforeFd = fs.openSync(before, 'r'), receiptFd = fs.openSync(receipt, 'wx+', 0o600);
      try {
        const parent = fs.fstatSync(rootFd, { bigint: true }), id = crypto.randomUUID();
        const original = action === 'create' ? `missing:${parent.dev}:${parent.ino}` : fileFrame(target);
        const args = action === 'create' ? ['target', '5', original, '416'] : action === 'remove' ?
          ['--remove', 'target', original, id, '--execute'] : ['--replace-retained', 'target', '5', original, id, '--execute'];
        const result = spawnSync(instrumented, ['--receipt', ...args], {
          input: action === 'remove' ? 'BEFORE' : 'AFTER',
          stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'ignore', 'ignore', beforeFd, receiptFd],
          env: { ...process.env, DIRECTORY_WRITE_TEST_POINT: point, DIRECTORY_WRITE_TEST_SELF_KILL: '1' }, timeout: 10000,
        });
        assert.equal(result.signal, 'SIGKILL', result.stderr?.toString());
        const saved = fs.readFileSync(receipt, 'utf8');
        assert.doesNotMatch(saved, /exit 0\n$/);
        const intent = /^intent (create|remove|replace) ([^\n ]+) ([^\n ]+)$/m.exec(saved);
        assert.ok(intent, saved); assert.equal(intent[1], action);
        if (action !== 'create') assert.equal(intent[2], original);
        const heldDir = path.join(dir, `.litcode-${action}-${id}`);
        if (action === 'remove') {
          const stat = fs.statSync(heldDir, { bigint: true });
          assert.equal(intent[3], `missing:${stat.dev}:${stat.ino}`);
        } else {
          const staged = parseDirectoryFileObservationFrame(intent[3]);
          const published = point === 'replace_after_publish' || point === 'after_publish' || point === 'after_rename';
          const location = published ? target : action === 'create' ? path.join(dir, intent[2]) : path.join(heldDir, 'staged');
          const actual = parseDirectoryFileObservationFrame(fileFrame(location));
          for (const field of ['dev', 'ino', 'size', 'mode', 'mtimeSeconds', 'mtimeNanoseconds']) assert.equal(staged[field], actual[field]);
          const directory = fs.statSync(action === 'create' ? dir : heldDir, { bigint: true });
          assert.deepEqual(staged.parent, { dev: String(directory.dev), ino: String(directory.ino) });
          assert.equal(fs.readFileSync(location, 'utf8'), 'AFTER');
          assert.equal(actual.nlink, '1');
        }
        const beforeEffect = point.endsWith('after_recheck');
        if (action !== 'create') {
          const location = beforeEffect ? target : path.join(heldDir, 'held');
          assert.equal(fs.readFileSync(location, 'utf8'), 'BEFORE');
          assert.equal(fs.statSync(location, { bigint: true }).ino.toString(), original.split(':')[2]);
        } else if (beforeEffect) assert.equal(fs.existsSync(target), false);
        intentCuts.push(point);
      } finally { fs.closeSync(rootFd); fs.closeSync(beforeFd); fs.closeSync(receiptFd); }
    }
    for (const kind of ['create', 'remove', 'restore']) {
      const dir = path.join(work, `receipt-adapter-${kind}`); fs.mkdirSync(dir);
      const target = path.join(dir, 'target'), before = path.join(dir, 'before'), receipt = path.join(dir, 'receipt');
      if (kind !== 'create') fs.writeFileSync(target, 'BEFORE', { mode: 0o751 });
      fs.writeFileSync(before, 'BEFORE');
      const rootFd = fs.openSync(dir, 'r'), beforeFd = fs.openSync(before, 'r'), receiptFd = fs.openSync(receipt, 'wx+', 0o600);
      try {
        const stat = fs.fstatSync(rootFd, { bigint: true }), parent = { dev: String(stat.dev), ino: String(stat.ino) };
        const expected = kind === 'create' ? { kind: 'missing', parent, mode: 0o640 } : parseDirectoryFileObservationFrame(fileFrame(target));
        const input = { fd: rootFd, relative: 'target', expected, receiptFd, transactionId: crypto.randomUUID() };
        const result = kind === 'create' ? publishDirectoryFile({ ...input, content: Buffer.from('AFTER') }) :
          kind === 'remove' ? removeDirectoryFile({ ...input, expectedBytes: Buffer.from('BEFORE') }) :
            publishRetainedDirectoryFile({ ...input, expectedFd: beforeFd, content: Buffer.from('AFTER'), restoreMode: 0o640 });
        assert.equal(result.kind, kind === 'remove' ? 'quarantined' : 'durable', JSON.stringify(result));
        assert.match(fs.readFileSync(receipt, 'utf8'), /(?:quarantined|durable)\nexit 0\n$/);
        if (kind === 'remove') {
          assert.equal(fs.existsSync(target), false);
          const archive = path.join(dir, 'archive'), name = '.litcode-remove-' + input.transactionId;
          fs.mkdirSync(archive, { mode: 0o700 });
          const archiveFd = fs.openSync(archive, 'r'), gateFd = fs.openSync(path.join(dir, 'gate'), 'wx+', 0o600);
          try {
            const capture = (type, move) => observeRetainedDirectoryFile({ ...input, expected: result.observation,
              expectedFd: beforeFd, leaseFd: gateFd, archive: { fd: archiveFd, parent, move, kind: type } }).kind;
            assert.equal(capture('replace', true), 'unknown');
            assert.equal(capture('remove', false), 'observed');
            assert.equal(capture('remove', true), 'observed');
            assert.equal(fs.existsSync(path.join(dir, name)), false);
            assert.deepEqual(parseDirectoryFileObservationFrame(fileFrame(path.join(archive, name, 'held'))), result.observation);
            assert.equal(capture('remove', false), 'observed');
            assert.equal(capture('remove', true), 'observed');
          } finally { fs.closeSync(archiveFd); fs.closeSync(gateFd); }
        }
        else { assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER'); assert.equal(fs.statSync(target).mode & 0o7777, 0o640); }
      } finally { fs.closeSync(rootFd); fs.closeSync(beforeFd); fs.closeSync(receiptFd); }
    }
    const syncDir = path.join(work, 'synced-observation'); fs.mkdirSync(syncDir);
    fs.mkdirSync(path.join(syncDir, 'nested')); fs.writeFileSync(path.join(syncDir, 'nested/file'), 'BOUND');
    fs.symlinkSync('nested', path.join(syncDir, 'alias')); fs.symlinkSync('file', path.join(syncDir, 'nested/link'));
    const syncFd = fs.openSync(syncDir, 'r'), signal = new AbortController().signal;
    try {
      const read = relative => readStableDirectoryFile({ fd: syncFd, relative, sync: true }, 32, signal);
      const file = read('nested/file'); assert.ok(file); assert.equal(file.bytes.toString(), 'BOUND');
      assert.deepEqual(file.observation, parseDirectoryFileObservationFrame(fileFrame(path.join(syncDir, 'nested/file'))));
      assert.deepEqual(probeMissingDirectoryFile({ fd: syncFd, relative: 'nested/missing', sync: true }), file.observation.parent);
      assert.equal(probeMissingDirectoryFile({ fd: syncFd, relative: 'nested/file', sync: true }), undefined);
      for (const relative of ['alias/file', 'nested/link', '../before']) assert.equal(read(relative), undefined);
      assert.equal(probeMissingDirectoryFile({ fd: syncFd, relative: 'alias/missing', sync: true }), undefined);
      fs.linkSync(path.join(syncDir, 'nested/file'), path.join(syncDir, 'nested/other'));
      assert.equal(read('nested/file'), undefined);
    } finally { fs.closeSync(syncFd); }
    success = true;
    process.stdout.write(JSON.stringify({ platform: process.platform, cases: outcomes, observationCases, adapter: 'passed', restoreAdapterModes: [0o640, 0], receiptCases, intentCuts, syncedObservation: 'passed', receiptAdapters: ['create', 'remove', 'restore'] }) + '\n');
  }
} finally {
  if (success) fs.rmSync(work, { recursive: true, force: true });
  else process.stderr.write(`fixture retained: ${work}\n`);
}
