import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { prepareDirectoryCreation, publishPreparedDirectoryCreation } from '../dist/directory-create-native.js';

const root = path.resolve(import.meta.dirname, '..'), work = fs.mkdtempSync(path.join(os.tmpdir(), 'create-phases-'));
const production = path.join(root, 'native/directory-write/write'), helper = path.join(work, 'writer');
const results = [];
async function invoke(args, options, point, mutate, kill = false) {
  const env = { ...process.env, DIRECTORY_WRITE_TEST_SHORT_READ: '1', ...(point ? { DIRECTORY_WRITE_TEST_POINT: point } : {}),
    ...(kill ? { DIRECTORY_WRITE_TEST_SELF_KILL: '1' } : {}) };
  if (!mutate) {
    const result = spawnSync(point ? helper : production, args, { ...options, env, timeout: 10000 });
    assert.equal(result.error, undefined); return { code: result.status, signal: result.signal, text: result.output[4]?.toString() ?? '' };
  }
  const { input, ...spawnOptions } = options;
  const child = spawn(helper, args, { ...spawnOptions, env }); child.stdin.end(input); child.stderr.resume();
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
  for (const kind of ['normal', 'empty', 'binary', 'adapter', 'mode-zero', 'mode-readonly', 'mode-executable', 'adapter-zero', 'occupied-prep', 'existing-q', 'prep-witness', 'short-input',
    'occupied-publish', 'wrong-parent', 'stage-replaced', 'stage-linked', 'stage-bytes', 'stage-mode', 'wrong-witness',
    'late-target', 'late-stage', 'late-parent', 'late-q', 'late-stage-after-check', 'late-target-final', 'late-prep-target', 'late-prep-stage', 'late-prep-parent',
    'late-mode-target', 'late-mode-stage', 'late-mode-parent',
    'kill-before-q', 'kill-q', 'kill-staging', 'kill-writing', 'kill-prepared', 'kill-publish-before', 'kill-publish-after', 'kill-publish-final',
    'kill-mode-before-zero', 'kill-mode-after-zero', 'kill-publish-after-zero']) {
    const dir = path.join(work, kind), sub = path.join(dir, 'sub'); fs.mkdirSync(sub, { recursive: true });
    const id = crypto.randomUUID(), q = path.join(sub, `.litcode-create-${id}`), staged = path.join(q, 'staged'), target = path.join(sub, 'target');
    const bytes = kind === 'empty' ? Buffer.alloc(0) : kind === 'binary' ? Buffer.from([0, 255, 128, 10]) : Buffer.from('DESIRED');
    const mode = kind.endsWith('zero') ? 0 : kind === 'mode-readonly' ? 0o444 : kind === 'mode-executable' ? 0o751 : 0o640;
    const witness = path.join(dir, 'witness'); fs.writeFileSync(witness, kind === 'prep-witness' ? 'FOREIGN' : bytes);
    const p = fs.statSync(sub, { bigint: true }), parent = { dev: String(p.dev), ino: String(p.ino) }, missing = `missing:${p.dev}:${p.ino}`;
    const rootFd = fs.openSync(dir, 'r'), witnessFd = fs.openSync(witness, 'r'), receipt = path.join(dir, 'prepare.receipt'), receiptFd = fs.openSync(receipt, 'wx+', 0o600);
    let publishFd, stagedReadFd;
    try {
      if (kind === 'occupied-prep') fs.writeFileSync(target, 'FOREIGN');
      if (kind === 'existing-q') fs.mkdirSync(q, { mode: 0o700 });
      const prepCuts = { 'kill-before-q': 'create_before_quarantine', 'kill-q': 'create_quarantine', 'kill-staging': 'create_staging',
        'kill-writing': 'create_writing', 'kill-prepared': 'create_after_prepared' };
      const options = { input: kind === 'short-input' ? bytes.subarray(1) : bytes,
        stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', 'ignore', witnessFd, receiptFd] };
      let prepared;
      if (kind.startsWith('adapter')) {
        prepared = prepareDirectoryCreation({ fd: rootFd, relative: 'sub/target', parent, mode, content: bytes, desiredFd: witnessFd, transactionId: id, receiptFd });
        assert.equal(prepared.kind, 'prepared');
        assert.equal(prepared.mode, mode); assert.equal(prepared.staged.mode, 0o600);
      }
      const prepLate = {
        'late-prep-target': () => fs.writeFileSync(target, 'FOREIGN'),
        'late-prep-stage': () => { fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, 'FOREIGN'); },
        'late-prep-parent': () => { fs.renameSync(sub, `${sub}-original`); fs.mkdirSync(sub); },
      };
      const prep = prepared ? undefined : await invoke(['--receipt', '--prepare-create', 'sub/target', missing, id, String(bytes.length), String(mode), '--execute'],
        options, prepCuts[kind] ?? (prepLate[kind] ? 'create_before_prepared' : undefined), prepLate[kind], !!prepCuts[kind]);
      if (prepCuts[kind]) {
        assert.equal(prep.signal, 'SIGKILL'); assert.equal(fs.existsSync(target), false);
        assert.equal(fs.readFileSync(receipt, 'utf8').includes('exit 0\n'), false);
        if (kind === 'kill-writing') assert.equal(fs.statSync(staged).size, 1);
        if (kind === 'kill-prepared') assert.deepEqual(fs.readFileSync(staged), bytes);
        results.push(kind); continue;
      }
      if (['occupied-prep', 'existing-q', 'prep-witness', 'short-input'].includes(kind) || prepLate[kind]) {
        assert.notEqual(prep.code, 0); assert.equal(fs.existsSync(target), kind === 'occupied-prep' || kind === 'late-prep-target');
        if (kind === 'occupied-prep' || kind === 'late-prep-target') assert.equal(fs.readFileSync(target, 'utf8'), 'FOREIGN');
        if (kind === 'late-prep-stage') assert.equal(fs.readFileSync(staged, 'utf8'), 'FOREIGN');
        results.push(kind); continue;
      }
      if (prep) assert.equal(prep.code, 0, `${kind}: ${prep.text}`);
      assert.equal(fs.existsSync(target), false); assert.deepEqual(fs.readFileSync(staged), bytes);
      assert.equal(fs.statSync(staged).mode & 0o7777, 0o600); stagedReadFd = fs.openSync(staged, 'r');
      const preparationReceipt = fs.readFileSync(receipt, 'utf8'); assert.match(preparationReceipt, /intent prepare-create missing:/); assert.ok(preparationReceipt.endsWith('prepared\nexit 0\n'));
      const stagedFrame = /prepared_create missing:[0-9]+:[0-9]+ (v2:[^\n]+)/.exec(preparationReceipt)[1];
      const stagedIdentity = fs.statSync(staged, { bigint: true });
      const publishReceipt = path.join(dir, 'publish.receipt'); publishFd = fs.openSync(publishReceipt, 'wx+', 0o600);
      if (kind === 'occupied-publish') fs.writeFileSync(target, 'FOREIGN');
      if (kind === 'stage-replaced') { fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, bytes, { mode: 0o600 }); }
      if (kind === 'stage-linked') fs.linkSync(staged, path.join(dir, 'extra-link'));
      if (kind === 'stage-bytes') fs.writeFileSync(staged, 'FOREIGN');
      if (kind === 'stage-mode') fs.chmodSync(staged, 0o400);
      if (kind === 'wrong-witness') fs.writeFileSync(witness, 'FOREIGN');
      const late = {
        'late-target': ['create_before_publish', () => fs.writeFileSync(target, 'FOREIGN')],
        'late-stage': ['create_before_publish', () => { fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, 'FOREIGN'); }],
        'late-parent': ['create_before_publish', () => { fs.renameSync(sub, `${sub}-original`); fs.mkdirSync(sub); }],
        'late-q': ['create_before_publish', () => { fs.renameSync(q, `${q}-original`); fs.mkdirSync(q, { mode: 0o700 }); fs.writeFileSync(staged, 'FOREIGN'); }],
        'late-stage-after-check': ['create_after_recheck', () => { fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, 'FOREIGN'); }],
        'late-target-final': ['create_before_final', () => { fs.renameSync(target, `${target}-original`); fs.writeFileSync(target, 'FOREIGN'); }],
        'late-mode-target': ['create_after_mode', () => fs.writeFileSync(target, 'FOREIGN')],
        'late-mode-stage': ['create_before_mode', () => { fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, 'FOREIGN', { mode: 0o600 }); }],
        'late-mode-parent': ['create_after_mode', () => { fs.renameSync(sub, `${sub}-original`); fs.mkdirSync(sub); }],
      };
      const publishCuts = { 'kill-publish-before': 'create_before_publish', 'kill-publish-after': 'create_after_publish', 'kill-publish-final': 'create_before_final',
        'kill-mode-before-zero': 'create_before_mode', 'kill-mode-after-zero': 'create_after_mode', 'kill-publish-after-zero': 'create_after_publish' };
      if (prepared) {
        const published = publishPreparedDirectoryCreation({ fd: rootFd, relative: 'sub/target', parent, staged: prepared.staged, mode: prepared.mode, desiredFd: witnessFd, transactionId: id, receiptFd: publishFd });
        assert.equal(published.kind, 'durable'); assert.equal(published.observation.ino, prepared.staged.ino);
      } else {
        const result = await invoke(['--receipt', '--publish-prepared-create', 'sub/target', kind === 'wrong-parent' ? `missing:${p.dev}:1` : missing, id, stagedFrame, String(mode), '--execute'],
          { ...options, input: undefined, stdio: ['pipe', 'ignore', 'pipe', rootFd, 'pipe', 'pipe', 'ignore', witnessFd, publishFd] },
          late[kind]?.[0] ?? publishCuts[kind], late[kind]?.[1], !!publishCuts[kind]);
        if (publishCuts[kind]) {
          assert.equal(result.signal, 'SIGKILL'); assert.equal(fs.readFileSync(publishReceipt, 'utf8').includes('exit 0\n'), false);
          const published = ['create_after_publish', 'create_before_final'].includes(publishCuts[kind]);
          assert.equal(fs.existsSync(target), published); assert.equal(fs.existsSync(staged), !published);
          if (published) { assert.deepEqual(fs.readFileSync(stagedReadFd), bytes); assert.equal(fs.statSync(target, { bigint: true }).ino, stagedIdentity.ino); assert.equal(fs.statSync(target).mode & 0o7777, mode); }
          if (kind === 'kill-mode-before-zero') assert.equal(fs.statSync(staged).mode & 0o7777, 0o600);
          if (kind === 'kill-mode-after-zero') { assert.equal(fs.statSync(staged).mode & 0o7777, 0); assert.deepEqual(fs.readFileSync(stagedReadFd), bytes); }
          results.push(kind); continue;
        }
        if (!['normal', 'empty', 'binary', 'mode-zero', 'mode-readonly', 'mode-executable'].includes(kind)) {
          assert.notEqual(result.code, 0, `${kind}: ${result.text}`);
          if (['occupied-publish', 'late-target', 'late-stage-after-check', 'late-target-final', 'late-mode-target'].includes(kind)) assert.equal(fs.readFileSync(target, 'utf8'), 'FOREIGN');
          else assert.equal(fs.existsSync(target), false);
          if (kind.startsWith('late-mode-')) assert.match(result.text, /error unknown/);
          if (kind === 'late-mode-stage') { assert.equal(fs.statSync(staged).mode & 0o7777, 0o600); assert.equal(fs.readFileSync(staged, 'utf8'), 'FOREIGN'); }
          results.push(kind); continue;
        }
        assert.equal(result.code, 0, result.text);
      }
      assert.deepEqual(fs.readFileSync(stagedReadFd), bytes); assert.equal(fs.statSync(target, { bigint: true }).ino, stagedIdentity.ino);
      assert.equal(fs.statSync(target).nlink, 1); assert.equal(fs.statSync(target).mode & 0o7777, mode); assert.equal(fs.existsSync(staged), false);
      assert.match(fs.readFileSync(publishReceipt, 'utf8'), /intent publish-create missing:/); assert.ok(fs.readFileSync(publishReceipt, 'utf8').endsWith('durable\nexit 0\n'));
      results.push(kind);
    } finally { fs.closeSync(receiptFd); if (publishFd !== undefined) fs.closeSync(publishFd); if (stagedReadFd !== undefined) fs.closeSync(stagedReadFd); fs.closeSync(witnessFd); fs.closeSync(rootFd); }
  }
  console.log(JSON.stringify({ createPhases: results, durableIntegration: false }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
