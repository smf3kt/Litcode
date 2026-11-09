import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { publishLinkedCapturedDirectoryFile, observeLinkedRetainedDirectoryFile } from '../dist/directory-linked-native.js';
import { parseDirectoryFileObservationFrame } from '../dist/directory-file-state.js';

const root = path.resolve(import.meta.dirname, '..'), work = fs.mkdtempSync(path.join(os.tmpdir(), 'linked-continuation-'));
const production = path.join(root, 'native/directory-write/write'), helper = path.join(work, 'write-test');
const results = [];
const frame = file => {
  const s = fs.statSync(file, { bigint: true }), p = fs.statSync(path.dirname(file), { bigint: true });
  return ['v2', s.dev, s.ino, s.size, s.mtimeNs / 1000000000n, s.mtimeNs % 1000000000n,
    s.ctimeNs / 1000000000n, s.ctimeNs % 1000000000n, s.mode & 0o7777n, s.nlink, p.dev, p.ino].join(':');
};
async function invoke(args, options, point, mutate, kill = false) {
  const env = { ...process.env, ...(point ? { DIRECTORY_WRITE_TEST_POINT: point } : {}), ...(kill ? { DIRECTORY_WRITE_TEST_SELF_KILL: '1' } : {}) };
  if (!mutate) {
    const result = spawnSync(point ? helper : production, args, { ...options, env, timeout: 10000 });
    assert.equal(result.error, undefined); return { code: result.status, signal: result.signal, text: result.output[4].toString() };
  }
  const child = spawn(helper, args, { ...options, env }); child.stdin?.end(); child.stderr.resume();
  const done = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); });
  let text = '', changed = false;
  child.stdio[4].on('data', bytes => {
    text += bytes;
    if (!changed && text.includes(`test ${point}\n`)) { changed = true; mutate(); child.stdio[5].end('c'); }
  });
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
  try { const result = await done; assert.ok(changed); return { ...result, text }; } finally { clearTimeout(timer); }
}
try {
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper, path.join(root, 'native/directory-write/write.c')]);
  for (const kind of ['normal', 'empty', 'binary', 'adapter', 'wrong-parent', 'occupied', 'alias-foreign', 'held-foreign', 'stage-foreign', 'third-link',
    'wrong-witness', 'stage-mode', 'stage-bytes', 'observe-alias', 'observe-parent', 'observe-third',
    'late-alias-before', 'late-alias-after', 'late-occupied', 'kill-before', 'kill-after']) {
    const dir = path.join(work, kind), sub = path.join(dir, 'sub'); fs.mkdirSync(sub, { recursive: true });
    const alias = '.litcode-tmp-123-0', aliasPath = path.join(sub, alias), target = path.join(sub, 'target'), witness = path.join(dir, 'witness'), desired = path.join(dir, 'desired');
    const bytes = kind === 'empty' ? Buffer.alloc(0) : kind === 'binary' ? Buffer.from([0, 255, 128]) : Buffer.from('ORIGINAL');
    fs.writeFileSync(aliasPath, bytes, { mode: 0o640 }); fs.linkSync(aliasPath, target);
    fs.writeFileSync(witness, bytes); fs.writeFileSync(desired, bytes);
    const rootFd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(witness, 'r'), desiredFd = fs.openSync(desired, 'r');
    const receiptPath = path.join(dir, 'receipt'), receiptFd = fs.openSync(receiptPath, 'wx+', 0o600);
    const id = crypto.randomUUID(), retained = path.join(sub, `.litcode-linked-${id}`), held = path.join(retained, 'held'), staged = path.join(retained, 'staged');
    try {
      const initial = await invoke(['--normalize-linked', 'sub/target', String(bytes.length), frame(target), id, alias, '--execute'],
        { input: bytes, stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'ignore', 'ignore', witnessFd] }, 'replace_after_capture', undefined, true);
      assert.equal(initial.signal, 'SIGKILL'); assert.equal(fs.existsSync(target), false);
      const oldIno = fs.statSync(held).ino, newIno = fs.statSync(staged).ino, parent = fs.statSync(sub, { bigint: true });
      let missing = `missing:${parent.dev}:${parent.ino}`, heldFrame = frame(held), stageFrame = frame(staged);
      const observationArgs = () => ['--observe-linked-retained', 'sub/target', heldFrame, id, alias, missing, '--execute'];
      const options = { stdio: ['ignore', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', 'ignore', witnessFd, receiptFd, desiredFd] };
      const initialObservation = await invoke(observationArgs(), options);
      assert.equal(initialObservation.code, 0); assert.equal(initialObservation.text, `start\nobserved_linked ${heldFrame}\n`);
      const ordinary = await invoke(['--observe-retained', 'sub/target', heldFrame, id, '--execute'], options);
      assert.notEqual(ordinary.code, 0);
      if (kind === 'wrong-parent') missing = `missing:${parent.dev}:${parent.ino + 1n}`;
      if (kind === 'occupied') fs.writeFileSync(target, 'FOREIGN');
      if (kind === 'alias-foreign') { fs.renameSync(aliasPath, `${aliasPath}-original`); fs.writeFileSync(aliasPath, bytes); }
      if (kind === 'held-foreign') { fs.renameSync(held, `${held}-original`); fs.writeFileSync(held, bytes); }
      if (kind === 'stage-foreign') { fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, bytes); }
      if (kind === 'third-link') fs.linkSync(held, path.join(sub, 'third'));
      if (kind === 'wrong-witness') fs.writeFileSync(witness, 'DIFFERENT');
      if (kind === 'stage-mode') { fs.chmodSync(staged, 0o600); stageFrame = frame(staged); }
      if (kind === 'stage-bytes') { fs.writeFileSync(staged, 'MODIFIED'); fs.writeFileSync(desired, 'MODIFIED'); stageFrame = frame(staged); }
      if (kind.startsWith('observe-')) {
        const result = await invoke(observationArgs(), options, 'observe_retained_after_read', () => {
          if (kind === 'observe-alias') { fs.renameSync(aliasPath, `${aliasPath}-original`); fs.writeFileSync(aliasPath, bytes); }
          if (kind === 'observe-parent') { fs.renameSync(sub, `${sub}-original`); fs.mkdirSync(sub); }
          if (kind === 'observe-third') fs.linkSync(held, path.join(sub, 'third'));
        });
        assert.notEqual(result.code, 0); assert.doesNotMatch(result.text, /observed_linked/); results.push(kind); continue;
      }
      const args = ['--receipt', '--publish-linked-captured', 'sub/target', missing, heldFrame, stageFrame, id, alias, '--execute'];
      const point = kind === 'late-alias-before' || kind === 'late-occupied' ? 'captured_before_publish' :
        kind === 'late-alias-after' || kind === 'kill-after' ? 'captured_after_publish' : kind === 'kill-before' ? 'captured_after_recheck' : undefined;
      const mutate = kind.startsWith('late-') ? () => {
        if (kind === 'late-occupied') fs.writeFileSync(target, 'FOREIGN');
        else { fs.renameSync(aliasPath, `${aliasPath}-original`); fs.writeFileSync(aliasPath, bytes); }
      } : undefined;
      let result;
      if (kind === 'adapter') {
        const outcome = publishLinkedCapturedDirectoryFile({ fd: rootFd, relative: 'sub/target', alias,
          parent: { dev: String(parent.dev), ino: String(parent.ino) }, held: parseDirectoryFileObservationFrame(heldFrame),
          staged: parseDirectoryFileObservationFrame(stageFrame), originalFd: witnessFd, desiredFd, transactionId: id, receiptFd });
        assert.equal(outcome.kind, 'normalized');
        assert.equal(observeLinkedRetainedDirectoryFile({ fd: rootFd, relative: 'sub/target', alias, held: outcome.held,
          parent: outcome.observation.parent, originalFd: witnessFd, transactionId: id }).kind, 'observed');
        result = { code: 0, signal: null };
      } else result = await invoke(args, options, point, mutate, kind.startsWith('kill-'));
      const receipt = fs.readFileSync(receiptPath, 'utf8');
      if (['normal', 'empty', 'binary', 'adapter'].includes(kind)) {
        assert.equal(result.code, 0, receipt); assert.match(receipt, /resume_linked /); assert.match(receipt, /durable\nexit 0\n$/);
        assert.deepEqual(fs.readFileSync(target), bytes); assert.equal(fs.statSync(target).ino, newIno); assert.equal(fs.statSync(target).nlink, 1);
        assert.equal(fs.statSync(target).mode & 0o7777, 0o640); assert.equal(fs.statSync(aliasPath).ino, oldIno); assert.equal(fs.statSync(aliasPath).nlink, 2);
        assert.equal(fs.statSync(held).ino, oldIno); assert.equal(fs.existsSync(staged), false);
        assert.equal((await invoke(observationArgs(), options)).code, 0);
        assert.notEqual((await invoke(args.slice(1), options)).code, 0, 'repeating captured publication must refuse');
      } else {
        assert.notEqual(result.code, 0, kind); assert.doesNotMatch(receipt, /durable\nexit 0\n$/);
        if (kind.startsWith('kill-')) {
          assert.equal(result.signal, 'SIGKILL'); assert.match(receipt, /resume_linked /); assert.doesNotMatch(receipt, /exit /);
          assert.equal(fs.existsSync(target), kind === 'kill-after');
          assert.equal(fs.statSync(held).ino, oldIno); assert.equal(fs.statSync(aliasPath).ino, oldIno);
        }
        if (kind === 'occupied' || kind === 'late-occupied') assert.equal(fs.readFileSync(target, 'utf8'), 'FOREIGN');
      }
      results.push(kind);
    } finally { fs.closeSync(rootFd); fs.closeSync(witnessFd); fs.closeSync(desiredFd); fs.closeSync(receiptFd); }
  }
  console.log(JSON.stringify({ linkedContinuation: results, automaticRecovery: false }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
