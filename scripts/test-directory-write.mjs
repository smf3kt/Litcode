import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const work = fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'directory-write-'));
const instrumented = path.join(work, 'write-test');
execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', instrumented, path.join(root, 'native/directory-write/write.c')]);
const production = path.join(root, 'native/directory-write/write');
const grant = path.join(work, 'grant');
fs.mkdirSync(grant);
const fd = fs.openSync(grant, 'r');
function start(target, opts = {}) {
  const id = opts.remove ? randomUUID() : undefined;
  const witness = opts.remove ? fs.readFileSync(path.join(work, 'moved', target)) : undefined;
  const args = opts.remove ? ['--remove', target, opts.expected, id, '--execute'] : [target, String(opts.bytes ?? 3), ...(opts.expected ? [opts.expected] : [])];
  const child = spawn(opts.test ? instrumented : production, args, {
    stdio: ['pipe', 'ignore', 'inherit', fd, 'pipe', 'pipe'],
    env: { ...process.env, ...(opts.point ? { DIRECTORY_WRITE_TEST_POINT: opts.point } : {}), ...(opts.short ? { DIRECTORY_WRITE_TEST_SHORT: '1' } : {}),
      ...(opts.truncate ? { DIRECTORY_WRITE_TEST_TRUNCATE: '1' } : {}) },
  });
  child.stdin.on('error', error => { if (error.code !== 'EPIPE') throw error; });
  let text = '';
  const waiters = [];
  child.stdio[4].on('data', data => { text += data; for (const wake of waiters.splice(0)) wake(); });
  return { child, id, witness, text: () => text, async wait(marker) {
    while (!text.includes(marker)) await Promise.race([new Promise(resolve => waiters.push(resolve)), once(child, 'exit').then(() => { throw Error(`exited waiting for ${marker}: ${text}`); })]);
  }, async end() { const [code, signal] = await once(child, 'exit'); return { code, signal, text }; } };
}
function fileFrame(file) {
  const stat = fs.statSync(file, { bigint: true }), parent = fs.statSync(path.dirname(file), { bigint: true });
  const seconds = value => value / 1000000000n, nanos = value => value % 1000000000n;
  return ['v2', stat.dev, stat.ino, stat.size, seconds(stat.mtimeNs), nanos(stat.mtimeNs), seconds(stat.ctimeNs), nanos(stat.ctimeNs),
    stat.mode & 0o7777n, stat.nlink, parent.dev, parent.ino].join(':');
}
try {
  fs.renameSync(grant, path.join(work, 'moved'));
  fs.mkdirSync(grant);
  fs.mkdirSync(path.join(work, 'moved', 'sub'));
  fs.writeFileSync(path.join(work, 'moved', 'mode'), 'old', { mode: 0o751 });
  let p = start('mode'); p.child.stdin.end('new'); let r = await p.end();
  assert.equal(r.code, 0);
  assert.equal(fs.statSync(path.join(work, 'moved', 'mode')).mode & 0o7777, 0o751, 'replacement preserves the existing mode');
  const large = Buffer.alloc(2 * 1024 * 1024, 71);
  p = start('sub/file', { bytes: large.length }); p.child.stdin.end(large); r = await p.end();
  assert.equal(r.code, 0); assert.match(r.text, /renamed\nlanded v2:[^\n]+\ndurable\n/);
  assert.deepEqual(fs.readFileSync(path.join(work, 'moved/sub/file')), large);
  assert.equal(fs.existsSync(path.join(grant, 'sub/file')), false);
  fs.symlinkSync(work, path.join(work, 'moved/link'));
  fs.symlinkSync(path.join(work, 'outside'), path.join(work, 'moved/leaf'));
  for (const target of ['/tmp/escape', '../escape', 'sub/../escape', 'link/escape', 'leaf', 'sub//x']) {
    p = start(target); p.child.stdin.end('bad'); r = await p.end();
    assert.notEqual(r.code, 0, target); assert.match(r.text, /error not_renamed/);
  }
  p = start('short', { test: true, short: true, bytes: 19 }); p.child.stdin.end('short-write-content'); r = await p.end();
  assert.equal(r.code, 0); assert.equal(fs.readFileSync(path.join(work, 'moved/short'), 'utf8'), 'short-write-content');
  const previousMask = process.umask(0o027);
  try { p = start('new-mode'); } finally { process.umask(previousMask); }
  p.child.stdin.end('new'); r = await p.end();
  assert.equal(r.code, 0); assert.equal(fs.statSync(path.join(work, 'moved/new-mode')).mode & 0o7777, 0o640);
  p = start('empty', { bytes: 0 }); p.child.stdin.end(); r = await p.end();
  assert.equal(r.code, 0); assert.equal(fs.statSync(path.join(work, 'moved/empty')).size, 0);
  const utf8 = Buffer.from('汉字\0🎉');
  p = start('utf8', { bytes: utf8.length }); p.child.stdin.end(utf8); r = await p.end();
  assert.equal(r.code, 0); assert.deepEqual(fs.readFileSync(path.join(work, 'moved/utf8')), utf8);
  for (const [name, opts] of [['too-short', { bytes: 4 }], ['too-long', { bytes: 2 }],
    ['nonempty-zero', { bytes: 0 }], ['truncated', { bytes: 3, test: true, truncate: true }],
    ['invalid-count', { bytes: '-1' }], ['overflow-count', { bytes: '18446744073709551616' }]]) {
    const target = path.join(work, 'moved', name);
    fs.writeFileSync(target, 'ORIGINAL', { mode: 0o751 });
    p = start(name, opts); p.child.stdin.end('new'); r = await p.end();
    assert.notEqual(r.code, 0, name); assert.match(r.text, /error not_renamed/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL'); assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
  }
  for (const point of ['write', 'before_rename', 'after_rename']) {
    p = start('fault', { test: true, point }); p.child.stdin.end('new');
    await p.wait(`test ${point}\n`); p.child.stdio[5].end('f'); r = await p.end();
    assert.notEqual(r.code, 0); assert.match(r.text, new RegExp(`error ${point === 'after_rename' ? 'renamed' : 'not_renamed'}`));
    assert.equal(fs.existsSync(path.join(work, 'moved/fault')), point === 'after_rename');
    if (point === 'after_rename') fs.unlinkSync(path.join(work, 'moved/fault'));
  }
  p = start('rename-fails', { test: true, point: 'after_recheck' }); p.child.stdin.end('new');
  await p.wait('test after_recheck\n'); fs.mkdirSync(path.join(work, 'moved/rename-fails'));
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
  assert.equal(fs.statSync(path.join(work, 'moved/rename-fails')).isDirectory(), true);
  const appeared = path.join(work, 'moved/appeared-after-check');
  p = start('appeared-after-check', { test: true, point: 'after_recheck' }); p.child.stdin.end('new');
  await p.wait('test after_recheck\n'); fs.writeFileSync(appeared, 'OTHER', { flag: 'wx' });
  p.child.stdio[5].end('c'); r = await p.end();
  assert.equal(fs.readFileSync(appeared, 'utf8'), 'OTHER');
  assert.notEqual(r.code, 0, 'creation must not replace a file that appeared after the recheck');
  const changed = path.join(work, 'moved/changed-during-stage');
  fs.writeFileSync(changed, 'OLD', { mode: 0o751 });
  p = start('changed-during-stage', { test: true, point: 'before_rename' }); p.child.stdin.end('new');
  await p.wait('test before_rename\n'); fs.writeFileSync(changed, 'OTHER');
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0, 'changed target is rejected before publication');
  assert.match(r.text, /error not_renamed/); assert.equal(fs.readFileSync(changed, 'utf8'), 'OTHER');
  if (process.env.W385_DIRECTORY_PUBLISH_RACE_PROBE === '1') {
    const target = path.join(work, 'moved/replace-race'), original = `${target}-original`;
    fs.writeFileSync(target, 'ORIGINAL');
    p = start('replace-race', { test: true, point: 'after_recheck', expected: fileFrame(target) });
    p.child.stdin.end('new'); await p.wait('test after_recheck\n');
    fs.renameSync(target, original); fs.writeFileSync(target, 'OTHER');
    p.child.stdio[5].end('c'); r = await p.end();
    assert.equal(fs.readFileSync(original, 'utf8'), 'ORIGINAL');
    assert.equal(fs.readFileSync(target, 'utf8'), 'OTHER', 'late replacement must be preserved');
    assert.notEqual(r.code, 0, 'replacing an unverified inode must not be reported durable');
  }
  p = start('cancel', { test: true, point: 'staging' });
  await p.wait('test staging\n'); p.child.kill('SIGTERM'); p.child.stdio[5].end(); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error not_renamed/);
  assert.equal(fs.existsSync(path.join(work, 'moved/cancel')), false);
  assert.deepEqual(fs.readdirSync(path.join(work, 'moved')).filter(x => x.startsWith('.litcode-tmp-')), []);
  // Exercise both dispositions of a live stage whose name was reused.
  for (const [point, decision] of [['before_rename', 'f'], ['after_recheck', 'c']]) {
    p = start('stage-substitution', { test: true, point });
    p.child.stdin.end('new'); await p.wait(`test ${point}\n`);
    const parent = path.join(work, 'moved');
    const stage = path.join(parent, fs.readdirSync(parent).find(name => name.startsWith('.litcode-tmp-')));
    const saved = stage + '-original';
    fs.renameSync(stage, saved); fs.writeFileSync(stage, 'new', { flag: 'wx' });
    const replacement = fs.statSync(stage).ino;
    p.child.stdio[5].end(decision); r = await p.end();
    assert.notEqual(r.code, 0);
    assert.match(r.text, /cleanup_failed \d+\nerror not_renamed/);
    assert.equal(fs.existsSync(path.join(parent, 'stage-substitution')), false);
    assert.equal(fs.statSync(stage).ino, replacement);
    assert.equal(fs.readFileSync(saved, 'utf8'), 'new');
    fs.unlinkSync(saved); fs.unlinkSync(stage);
  }
  p = start('landed-substitution', { test: true, point: 'after_rename' }); p.child.stdin.end('new');
  await p.wait('test after_rename\n');
  const landed = path.join(work, 'moved', 'landed-substitution');
  fs.renameSync(landed, landed + '-original'); fs.writeFileSync(landed, 'new', { flag: 'wx' });
  const replacement = fs.statSync(landed).ino;
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error renamed/); assert.doesNotMatch(r.text, /landed v2:|durable/);
  assert.equal(fs.statSync(landed).ino, replacement);
  assert.equal(fs.readFileSync(landed + '-original', 'utf8'), 'new');
  p = start('unknown', { test: true, point: 'before_rename' }); p.child.stdin.end('new');
  await p.wait('test before_rename\n'); p.child.kill('SIGKILL'); r = await p.end();
  assert.equal(r.signal, 'SIGKILL'); assert.match(r.text, /publishing\n/); assert.doesNotMatch(r.text, /error |renamed\n/);
  p = start('kill', { test: true, point: 'after_rename', bytes: 9 }); p.child.stdin.end('published');
  await p.wait('test after_rename\n'); p.child.kill('SIGKILL'); r = await p.end();
  assert.equal(r.signal, 'SIGKILL'); assert.match(r.text, /renamed\n/);
  assert.equal(fs.readFileSync(path.join(work, 'moved/kill'), 'utf8'), 'published');
  p = start('kill-after-publish', { test: true, point: 'after_publish' }); p.child.stdin.end('new');
  await p.wait('test after_publish\n'); p.child.kill('SIGKILL'); r = await p.end();
  assert.equal(r.signal, 'SIGKILL'); assert.match(r.text, /committing\n/); assert.doesNotMatch(r.text, /renamed\n|durable\n/);
  const linked = path.join(work, 'moved/kill-after-publish'), linkedStat = fs.statSync(linked, { bigint: true });
  assert.equal(fs.readFileSync(linked, 'utf8'), 'new'); assert.equal(linkedStat.nlink, 1n);
  assert.ok(!fs.readdirSync(path.join(work, 'moved')).filter(x => x.startsWith('.litcode-tmp-'))
    .some(name => fs.statSync(path.join(work, 'moved', name), { bigint: true }).ino === linkedStat.ino));
  const removable = path.join(work, 'moved/remove-file');
  const flagName = path.join(work, 'moved/--remove'); fs.writeFileSync(flagName, 'OLD');
  p = start('--remove', { expected: fileFrame(flagName) }); p.child.stdin.end('new'); r = await p.end();
  assert.equal(r.code, 0, 'a file named --remove remains a normal write target');
  assert.equal(fs.readFileSync(flagName, 'utf8'), 'new');
  fs.writeFileSync(removable, 'REMOVE');
  p = start('remove-file', { remove: true, expected: fileFrame(removable) }); p.child.stdin.end(p.witness); r = await p.end();
  assert.equal(r.code, 0, r.text); assert.match(r.text, /held v2:[^\n]+\nquarantined\n/); assert.equal(fs.existsSync(removable), false);
  assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'REMOVE');
  const staleRemove = path.join(work, 'moved/remove-stale');
  fs.writeFileSync(staleRemove, 'ORIGINAL');
  p = start('remove-stale', { test: true, remove: true, expected: fileFrame(staleRemove), point: 'remove_before_recheck' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_before_recheck\n'); fs.writeFileSync(staleRemove, 'REPLACED');
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error not_removed/); assert.equal(fs.readFileSync(staleRemove, 'utf8'), 'REPLACED');
  const aborted = path.join(work, 'moved/remove-aborted'); fs.writeFileSync(aborted, 'ORIGINAL');
  p = start('remove-aborted', { test: true, remove: true, expected: fileFrame(aborted), point: 'remove_after_recheck' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_after_recheck\n'); p.child.stdio[5].end('f'); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/); assert.equal(fs.readFileSync(aborted, 'utf8'), 'ORIGINAL');
  assert.deepEqual(fs.readdirSync(path.join(work, 'moved', `.litcode-remove-${p.id}`)), []);
  const parent = path.join(work, 'moved/remove-parent'), oldParent = `${parent}-old`;
  fs.mkdirSync(parent); fs.writeFileSync(path.join(parent, 'file'), 'ORIGINAL');
  p = start('remove-parent/file', { test: true, remove: true, expected: fileFrame(path.join(parent, 'file')), point: 'remove_before_recheck' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_before_recheck\n'); fs.renameSync(parent, oldParent); fs.mkdirSync(parent); fs.writeFileSync(path.join(parent, 'file'), 'OTHER');
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0, 'renamed parent must not be used for removal');
  assert.equal(fs.readFileSync(path.join(oldParent, 'file'), 'utf8'), 'ORIGINAL');
  assert.equal(fs.readFileSync(path.join(parent, 'file'), 'utf8'), 'OTHER');
  const hardlink = path.join(work, 'moved/remove-hardlink'); fs.linkSync(staleRemove, hardlink);
  p = start('remove-hardlink', { remove: true, expected: fileFrame(hardlink) }); p.child.stdin.end(p.witness); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error not_removed/); assert.equal(fs.readFileSync(hardlink, 'utf8'), 'REPLACED');
  const symlink = path.join(work, 'moved/remove-symlink'); fs.symlinkSync('remove-stale', symlink);
  p = start('remove-symlink', { remove: true, expected: fileFrame(symlink) }); p.child.stdin.end(p.witness); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error not_removed/); assert.equal(fs.lstatSync(symlink).isSymbolicLink(), true);
  const killedRemove = path.join(work, 'moved/remove-killed'); fs.writeFileSync(killedRemove, 'REMOVE');
  p = start('remove-killed', { test: true, remove: true, expected: fileFrame(killedRemove), point: 'remove_after_quarantine' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_after_quarantine\n'); p.child.kill('SIGKILL'); r = await p.end();
  assert.equal(r.signal, 'SIGKILL'); assert.match(r.text, /committing\ncaptured\nheld v2:[^\n]+\nquarantined\n/);
  assert.equal(fs.existsSync(killedRemove), false);
  assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'REMOVE');
  {
    const target = path.join(work, 'moved/remove-race'), original = `${target}-original`;
    fs.writeFileSync(target, 'ORIGINAL');
    p = start('remove-race', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_recheck' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_recheck\n'); fs.renameSync(target, original); fs.writeFileSync(target, 'OTHER');
    p.child.stdio[5].end('c'); r = await p.end();
    assert.equal(fs.existsSync(target), false, 'an uncertain capture must not restore an unverified name');
    assert.equal(fs.readFileSync(original, 'utf8'), 'ORIGINAL');
    assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'OTHER');
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
  }
  for (const kind of ['directory', 'symlink']) {
    const target = path.join(work, `moved/remove-race-${kind}`), original = `${target}-original`;
    fs.writeFileSync(target, 'ORIGINAL');
    p = start(`remove-race-${kind}`, { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_recheck' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_recheck\n'); fs.renameSync(target, original);
    if (kind === 'directory') { fs.mkdirSync(target); fs.writeFileSync(path.join(target, 'child'), 'OTHER'); }
    else fs.symlinkSync(path.basename(original), target);
    p.child.stdio[5].end('c'); r = await p.end();
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/); assert.equal(fs.readFileSync(original, 'utf8'), 'ORIGINAL');
    const quarantine = path.join(work, 'moved', `.litcode-remove-${p.id}`);
    assert.equal(fs.existsSync(quarantine), true, 'a capture attempt must retain its transaction directory');
    assert.equal(fs.existsSync(target), false);
    if (kind === 'directory') assert.equal(fs.readFileSync(path.join(quarantine, 'held', 'child'), 'utf8'), 'OTHER');
    else assert.equal(fs.readlinkSync(path.join(quarantine, 'held')), path.basename(original));
  }
  {
    const target = path.join(work, 'moved/remove-conflicting-return'), original = `${target}-original`;
    fs.writeFileSync(target, 'ORIGINAL');
    p = start('remove-conflicting-return', { test: true, remove: true, expected: fileFrame(target),
      point: 'remove_after_recheck,remove_after_capture' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_recheck\n'); fs.renameSync(target, original); fs.writeFileSync(target, 'OTHER');
    p.child.stdio[5].write('c'); await p.wait('test remove_after_capture\n'); fs.writeFileSync(target, 'THIRD', { flag: 'wx' });
    p.child.stdio[5].end('c'); r = await p.end();
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'THIRD'); assert.equal(fs.readFileSync(original, 'utf8'), 'ORIGINAL');
    assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'OTHER');
  }
  const same = path.join(work, 'moved/remove-same-inode'); fs.writeFileSync(same, 'ORIGINAL'); fs.utimesSync(same, 1700000000, 1700000000);
  p = start('remove-same-inode', { test: true, remove: true, expected: fileFrame(same), point: 'remove_after_recheck' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_after_recheck\n'); fs.writeFileSync(same, 'MUTATED!'); fs.utimesSync(same, 1700000000, 1700000000);
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/); assert.equal(fs.existsSync(same), false);
  assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'MUTATED!');
  const occupied = path.join(work, 'moved/remove-occupied'); fs.writeFileSync(occupied, 'ORIGINAL');
  p = start('remove-occupied', { test: true, remove: true, expected: fileFrame(occupied), point: 'remove_after_capture' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_after_capture\n'); fs.writeFileSync(occupied, 'OTHER', { flag: 'wx' });
  p.child.stdio[5].end('c'); r = await p.end();
  assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/); assert.equal(fs.readFileSync(occupied, 'utf8'), 'OTHER');
  assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'ORIGINAL');
  const reoccupied = path.join(work, 'moved/remove-reoccupied'); fs.writeFileSync(reoccupied, 'ORIGINAL');
  p = start('remove-reoccupied', { test: true, remove: true, expected: fileFrame(reoccupied), point: 'remove_after_verify' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_after_verify\n'); fs.writeFileSync(reoccupied, 'OTHER', { flag: 'wx' });
  p.child.stdio[5].end('c'); r = await p.end();
  assert.equal(fs.readFileSync(reoccupied, 'utf8'), 'OTHER');
  assert.notEqual(r.code, 0, 'a reoccupied target must not report a completed missing state');
  assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'ORIGINAL');
  const killedCapture = path.join(work, 'moved/remove-captured'); fs.writeFileSync(killedCapture, 'ORIGINAL');
  p = start('remove-captured', { test: true, remove: true, expected: fileFrame(killedCapture), point: 'remove_after_capture' }); p.child.stdin.end(p.witness);
  await p.wait('test remove_after_capture\n'); p.child.kill('SIGKILL'); r = await p.end();
  assert.equal(r.signal, 'SIGKILL'); assert.equal(fs.existsSync(killedCapture), false);
  assert.equal(fs.readFileSync(path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'), 'utf8'), 'ORIGINAL');
  {
    const target = path.join(work, 'moved/remove-substituted-restore'); fs.writeFileSync(target, 'ORIGINAL');
    p = start('remove-substituted-restore', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_capture' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_capture\n');
    const quarantine = path.join(work, 'moved', `.litcode-remove-${p.id}`), held = path.join(quarantine, 'held');
    fs.renameSync(held, path.join(quarantine, 'original')); fs.writeFileSync(held, 'OTHER');
    p.child.stdio[5].end('c'); r = await p.end();
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
    assert.equal(fs.existsSync(target), false, 'a substituted held file must not be restored to the target');
    assert.equal(fs.readFileSync(held, 'utf8'), 'OTHER'); assert.equal(fs.readFileSync(path.join(quarantine, 'original'), 'utf8'), 'ORIGINAL');
  }
  {
    const target = path.join(work, 'moved/remove-held-occupied'); fs.writeFileSync(target, 'ORIGINAL');
    p = start('remove-held-occupied', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_recheck' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_recheck\n');
    const held = path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held'); fs.writeFileSync(held, 'OTHER', { flag: 'wx' });
    p.child.stdio[5].end('c'); r = await p.end();
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL'); assert.equal(fs.readFileSync(held, 'utf8'), 'OTHER');
  }
  {
    const target = path.join(work, 'moved/remove-private-race'); fs.writeFileSync(target, 'ORIGINAL');
    p = start('remove-private-race', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_verify' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_verify\n');
    const quarantine = path.join(work, 'moved', `.litcode-remove-${p.id}`);
    fs.renameSync(path.join(quarantine, 'held'), path.join(quarantine, 'original')); fs.writeFileSync(path.join(quarantine, 'held'), 'OTHER');
    p.child.stdio[5].end('c'); r = await p.end();
    assert.equal(fs.existsSync(path.join(quarantine, 'held')), true, 'replacement inside quarantine must survive');
    assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'OTHER');
    assert.equal(fs.readFileSync(path.join(quarantine, 'original'), 'utf8'), 'ORIGINAL');
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
  }
  {
    const target = path.join(work, 'moved/remove-quarantine-swap'); fs.writeFileSync(target, 'ORIGINAL');
    p = start('remove-quarantine-swap', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_verify' }); p.child.stdin.end(p.witness);
    await p.wait('test remove_after_verify\n');
    const quarantine = path.join(work, 'moved', `.litcode-remove-${p.id}`), moved = `${quarantine}-moved`;
    fs.renameSync(quarantine, moved); fs.mkdirSync(quarantine); fs.writeFileSync(path.join(quarantine, 'foreign'), 'KEEP');
    p.child.stdio[5].end('c'); r = await p.end();
    assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
    assert.equal(fs.readFileSync(path.join(quarantine, 'foreign'), 'utf8'), 'KEEP');
    assert.equal(fs.readFileSync(path.join(moved, 'held'), 'utf8'), 'ORIGINAL');
  }
  {
    const target = path.join(work, 'moved/remove-open-fd-race'); fs.writeFileSync(target, 'ORIGINAL');
    const writer = fs.openSync(target, 'r+');
    try {
      p = start('remove-open-fd-race', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_verify' }); p.child.stdin.end(p.witness);
      await p.wait('test remove_after_verify\n');
      fs.writeSync(writer, Buffer.from('MUTATED!'), 0, 8, 0); fs.fsyncSync(writer);
      p.child.stdio[5].end('c'); r = await p.end();
      const quarantine = path.join(work, 'moved', `.litcode-remove-${p.id}`);
      assert.equal(fs.existsSync(path.join(quarantine, 'held')), true, 'concurrent data written through an earlier descriptor must remain linked');
      assert.equal(fs.readFileSync(path.join(quarantine, 'held'), 'utf8'), 'MUTATED!');
      assert.notEqual(r.code, 0); assert.match(r.text, /error unknown/);
    } finally { fs.closeSync(writer); }
  }
  {
    const target = path.join(work, 'moved/remove-late-fd-race'); fs.writeFileSync(target, 'ORIGINAL');
    const writer = fs.openSync(target, 'r+');
    try {
      p = start('remove-late-fd-race', { test: true, remove: true, expected: fileFrame(target), point: 'remove_after_quarantine' }); p.child.stdin.end(p.witness);
      await p.wait('test remove_after_quarantine\n');
      fs.writeSync(writer, Buffer.from('MUTATED!'), 0, 8, 0); fs.fsyncSync(writer);
      p.child.stdio[5].end('c'); r = await p.end();
      const held = path.join(work, 'moved', `.litcode-remove-${p.id}`, 'held');
      assert.equal(fs.readFileSync(held, 'utf8'), 'MUTATED!');
      assert.notEqual(r.code, 0, 'a changed held file must not report an unchanged observation');
    } finally { fs.closeSync(writer); }
  }
  console.log('directory-write: production, no-replace race, removal, modes, umask, staged verification, paths, faults, cancellation and kill checks passed');
} finally { fs.closeSync(fd); fs.rmSync(work, { recursive: true, force: true }); }
