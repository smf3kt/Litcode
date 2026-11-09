import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { normalizeLinkedDirectoryFile, observeLinkedRetainedDirectoryFile } from '../dist/directory-linked-native.js';
import { parseDirectoryFileObservationFrame } from '../dist/directory-file-state.js';

const root = path.resolve(import.meta.dirname, '..'), work = fs.mkdtempSync(path.join(os.tmpdir(), 'linked-normalization-'));
const production = path.join(root, 'native/directory-write/write'), helper = path.join(work, 'write-test');
const results = [];
function frame(file) {
  const s = fs.statSync(file, { bigint: true }), p = fs.statSync(path.dirname(file), { bigint: true });
  return ['v2', s.dev, s.ino, s.size, s.mtimeNs / 1000000000n, s.mtimeNs % 1000000000n,
    s.ctimeNs / 1000000000n, s.ctimeNs % 1000000000n, s.mode & 0o7777n, s.nlink, p.dev, p.ino].join(':');
}
try {
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper, path.join(root, 'native/directory-write/write.c')]);
  for (const kind of ['normal', 'empty', 'binary', 'adapter', 'witness', 'input', 'same-name', 'alias-line', 'alias-symlink', 'alias-foreign', 'third-link',
    'alias-before', 'alias-captured', 'alias-published', 'target-before', 'target-captured', 'parent-before', 'stage-linked',
    'kill-before', 'kill-captured', 'kill-published', 'cancel', 'invalid-receipt']) {
    const grantRoot = path.join(work, kind), dir = path.join(grantRoot, 'sub'); fs.mkdirSync(dir, { recursive: true });
    const alias = kind === 'alias-line' ? '.litcode-tmp-123-0\n' : '.litcode-tmp-123-0', aliasPath = path.join(dir, alias), target = path.join(dir, 'target');
    const bytes = kind === 'empty' ? Buffer.alloc(0) : kind === 'binary' ? Buffer.from([0, 128, 255, 1]) : Buffer.from('ORIGINAL');
    fs.writeFileSync(aliasPath, bytes, { mode: 0o640 }); fs.linkSync(aliasPath, target);
    const original = frame(target), originalIno = fs.statSync(target).ino, id = crypto.randomUUID();
    const quarantine = path.join(dir, `.litcode-linked-${id}`), witness = path.join(dir, 'witness'), receiptPath = path.join(dir, 'receipt');
    fs.writeFileSync(witness, kind === 'witness' ? 'DIFFERENT' : bytes);
    const fd = fs.openSync(grantRoot, 'r'), witnessFd = fs.openSync(witness, 'r'), receiptFd = fs.openSync(receiptPath, 'wx+', kind === 'invalid-receipt' ? 0o644 : 0o600);
    try {
      if (kind === 'alias-symlink') { fs.renameSync(aliasPath, `${aliasPath}-held`); fs.symlinkSync('target', aliasPath); }
      if (kind === 'alias-foreign') { fs.renameSync(aliasPath, `${aliasPath}-held`); fs.writeFileSync(aliasPath, bytes); }
      if (kind === 'third-link') fs.linkSync(target, path.join(dir, 'third'));
      const point = ['alias-before', 'target-before', 'parent-before', 'kill-before', 'cancel'].includes(kind) ? 'replace_after_recheck' :
        ['alias-captured', 'target-captured', 'kill-captured'].includes(kind) ? 'replace_after_capture' :
        ['alias-published', 'kill-published'].includes(kind) ? 'replace_after_publish' : kind === 'stage-linked' ? 'replace_before_stage_check' : undefined;
      const args = ['--receipt', '--normalize-linked', 'sub/target', String(bytes.length), original, id, kind === 'same-name' ? 'target' : alias, '--execute'];
      const options = { stdio: ['pipe', 'ignore', 'pipe', fd, 'pipe', 'pipe', 'ignore', witnessFd, receiptFd],
        env: { ...process.env, ...(point ? { DIRECTORY_WRITE_TEST_POINT: point } : {}), ...(kind.startsWith('kill-') ? { DIRECTORY_WRITE_TEST_SELF_KILL: '1' } : {}) } };
      let code, signal;
      if (kind === 'adapter') {
        const result = normalizeLinkedDirectoryFile({ fd, relative: 'sub/target', alias, expected: parseDirectoryFileObservationFrame(original),
          originalFd: witnessFd, content: bytes, transactionId: id, receiptFd });
        assert.equal(result.kind, 'normalized'); code = 0;
        assert.equal(observeLinkedRetainedDirectoryFile({ fd, relative: 'sub/target', alias, held: result.held,
          parent: result.observation.parent, originalFd: witnessFd, transactionId: id }).kind, 'observed');
      } else if (!point || kind.startsWith('kill-')) {
        const result = spawnSync(point ? helper : production, args, { ...options, input: kind === 'input' ? Buffer.from('DIFFDATA') : bytes, timeout: 10000 });
        assert.equal(result.error, undefined); code = result.status; signal = result.signal;
      } else {
        const child = spawn(helper, args, options); const done = new Promise((resolve, reject) => {
          child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
        });
        child.stderr.resume(); child.stdin.on('error', () => {}); child.stdin.end(bytes);
        let text = '', changed = false;
        child.stdio[4].on('data', data => {
          text += data;
          if (!changed && text.includes(`test ${point}\n`)) {
            changed = true;
            if (kind.startsWith('alias-')) { fs.renameSync(aliasPath, `${aliasPath}-held`); fs.writeFileSync(aliasPath, bytes); }
            if (kind === 'target-before') fs.renameSync(target, `${target}-held`);
            if (kind.startsWith('target-')) fs.writeFileSync(target, 'FOREIGN');
            if (kind === 'parent-before') { fs.renameSync(dir, `${dir}-held`); fs.mkdirSync(dir); }
            if (kind === 'stage-linked') fs.linkSync(path.join(quarantine, 'staged'), path.join(dir, 'stage-alias'));
            if (kind === 'cancel') child.kill('SIGTERM');
            child.stdio[5].end(kind === 'cancel' ? 'x' : 'c');
          }
        });
        const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
        try { ({ code, signal } = await done); } finally { clearTimeout(timer); }
        assert.ok(changed, kind);
      }
      const actualDir = kind === 'parent-before' ? `${dir}-held` : dir;
      const receipt = fs.readFileSync(path.join(actualDir, 'receipt'), 'utf8');
      if (['normal', 'empty', 'binary', 'adapter'].includes(kind)) {
        assert.equal(code, 0, receipt); assert.match(receipt, /intent normalize-linked /); assert.match(receipt, /durable\nexit 0\n$/);
        assert.deepEqual(fs.readFileSync(target), bytes); assert.notEqual(fs.statSync(target).ino, originalIno); assert.equal(fs.statSync(target).nlink, 1);
        assert.equal(fs.statSync(target).mode & 0o7777, 0o640);
        assert.equal(fs.statSync(aliasPath).ino, originalIno); assert.equal(fs.statSync(aliasPath).nlink, 2);
        assert.equal(fs.statSync(path.join(quarantine, 'held')).ino, originalIno);
        assert.deepEqual(fs.readFileSync(path.join(quarantine, 'held')), bytes);
        assert.equal(fs.existsSync(path.join(quarantine, 'staged')), false);
      } else {
        assert.notEqual(code, 0, kind); assert.doesNotMatch(receipt, /durable\nexit 0\n$/);
        if (['witness', 'input', 'same-name', 'alias-line', 'alias-symlink', 'alias-foreign', 'third-link', 'cancel', 'invalid-receipt'].includes(kind)) {
          assert.equal(fs.statSync(target).ino, originalIno); assert.deepEqual(fs.readFileSync(target), bytes);
        }
        if (kind.startsWith('kill-')) {
          assert.equal(signal, 'SIGKILL'); assert.match(receipt, /intent normalize-linked /); assert.doesNotMatch(receipt, /exit /);
          const captured = kind !== 'kill-before', published = kind === 'kill-published';
          assert.equal(fs.existsSync(target), !captured || published);
          assert.equal(fs.statSync(captured ? path.join(quarantine, 'held') : target).ino, originalIno);
          assert.equal(fs.statSync(aliasPath).nlink, 2);
          if (published) assert.equal(fs.statSync(target).nlink, 1);
          else assert.deepEqual(fs.readFileSync(path.join(quarantine, 'staged')), bytes);
        }
        if (kind === 'target-before') {
          assert.match(receipt, /error unknown /);
          assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'FOREIGN');
          assert.equal(fs.statSync(`${target}-held`).ino, originalIno);
        }
        if (kind === 'target-captured') assert.equal(fs.readFileSync(target, 'utf8'), 'FOREIGN');
        if (kind.startsWith('alias-') && !['alias-symlink', 'alias-foreign'].includes(kind))
          assert.deepEqual(fs.readFileSync(aliasPath), bytes, 'foreign replacement alias must survive');
      }
      results.push(kind);
    } finally { fs.closeSync(fd); fs.closeSync(witnessFd); fs.closeSync(receiptFd); }
  }
  console.log(JSON.stringify({ platform: process.platform, normalization: results, automaticRecovery: false }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
