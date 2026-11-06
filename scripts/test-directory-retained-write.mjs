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
    const cases = ['normal', 'binary', 'empty', 'short-input', 'identical-witness', 'preexisting-transaction',
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
      const child = spawn(point ? instrumented : production,
        ['--replace-retained', 'sub/target', String(declared), expected, id, '--execute'],
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
        if (['normal', 'binary', 'empty', 'old-writer'].includes(kind)) {
          assert.equal(result.code, 0, `${kind}: ${status} ${stderr}`);
          assert.match(status, /held v2:[^\n]+\nlanded v2:[^\n]+\ndurable\n$/);
          assert.deepEqual(fs.readFileSync(target), content); assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
          assert.deepEqual(fs.readFileSync(path.join(qdir, 'held')), original);
          assert.equal(fs.statSync(path.join(qdir, 'held'), { bigint: true }).ino, initial.ino);
          if (oldWriter !== undefined) { fs.writeSync(oldWriter, 'CHANGED!', 0, 'utf8'); assert.equal(fs.readFileSync(path.join(qdir, 'held'), 'utf8'), 'CHANGED!'); }
        } else if (kind === 'short-input') {
          assert.notEqual(result.code, 0); assert.match(status, /error unknown/); assert.deepEqual(fs.readFileSync(target), original);
          assert.deepEqual(fs.readFileSync(path.join(qdir, 'staged')), content);
        } else if (kind === 'identical-witness' || kind === 'preexisting-transaction') {
          assert.notEqual(result.code, 0); assert.match(status, /error not_published/); assert.deepEqual(fs.readFileSync(target), original);
          if (kind === 'preexisting-transaction') assert.equal(fs.readFileSync(path.join(qdir, 'sentinel'), 'utf8'), 'UNCHANGED');
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
    for (const kind of ['normal', 'held-swap', 'held-inplace', 'directory-swap', 'parent-swap', 'witness-change', 'kill']) {
      const dir = path.join(work, `observe-${kind}`), sub = path.join(dir, 'sub'); fs.mkdirSync(dir); fs.mkdirSync(sub);
      const target = path.join(sub, 'target'), witness = path.join(dir, 'witness'), id = crypto.randomUUID();
      fs.writeFileSync(target, 'ORIGINAL', { mode: 0o751 }); fs.utimesSync(target, 1700000000, 1700000000);
      fs.writeFileSync(witness, 'ORIGINAL');
      const rootFd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(witness, 'r');
      let child, finished, completed;
      try {
        const published = spawnSync(production, ['--replace-retained', 'sub/target', '3', fileFrame(target), id, '--execute'],
          { input: 'NEW', encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'ignore', 'ignore', witnessFd], timeout: 10000 });
        assert.equal(published.status, 0, `${kind}: ${published.output[4]} ${published.stderr}`);
        const qdir = path.join(sub, `.litcode-replace-${id}`), held = path.join(qdir, 'held'), frame = fileFrame(held);
        const point = kind === 'normal' ? undefined : 'observe_retained_after_read';
        child = spawn(point ? instrumented : production, ['--observe-retained', 'sub/target', frame, id, '--execute'],
          { stdio: ['ignore', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', 'ignore', witnessFd],
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
          if (kind === 'kill') child.kill('SIGKILL'); else child.stdio[5].end('c');
        }
        const result = await completed;
        if (kind === 'normal') { assert.equal(result.code, 0, `${status} ${stderr}`); assert.equal(status, `start\nobserved ${frame}\n`); }
        else if (kind === 'kill') { assert.equal(result.signal, 'SIGKILL'); assert.doesNotMatch(status, /observed v2:/); }
        else { assert.notEqual(result.code, 0); assert.match(status, /error unknown/); assert.doesNotMatch(status, /observed v2:/); }
        observationCases.push({ kind, code: result.code, signal: result.signal });
      } finally {
        if (child && !finished) { child.kill('SIGKILL'); await completed; }
        fs.closeSync(rootFd); fs.closeSync(witnessFd);
      }
    }
    const { publishRetainedDirectoryFile, observeRetainedDirectoryFile, parseDirectoryFileObservationFrame } = await import(pathToFileURL(path.join(root, 'dist/directory-file-state.js')).href);
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
    success = true;
    process.stdout.write(JSON.stringify({ platform: process.platform, cases: outcomes, observationCases, adapter: 'passed' }) + '\n');
  }
} finally {
  if (success) fs.rmSync(work, { recursive: true, force: true });
  else process.stderr.write(`fixture retained: ${work}\n`);
}
