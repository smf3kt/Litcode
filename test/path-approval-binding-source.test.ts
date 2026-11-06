import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { AsyncReadHandleConsumer, PathApprovalCallOwner, TrustedReadContract } from '../src/path-approval-call-owner.js';
import { readControlledHandleLines, readTrustedHandleLines } from '../src/controlled-handle-lines.js';
import { createPathApprovalBinding } from '../src/path-approval-binding-source.js';
import { AsyncReadPermissionCheck, prototypePermissionDecision } from '../src/permissions.js';
import { createTools, type ToolDefinition } from '../src/tools.js';
import { createPathApprovalConsumer } from '../src/path-approval-consumer-source.js';
import { lwe } from '../src/path-approval-decoder-source.js';
import { createPathIdentity } from '../src/path-approval-identity-source.js';
import { Be } from '../src/path-approval-stash-source.js';
import { createPathOpenCapability, createPathOpenPrimitives } from '../src/path-open-primitives-source.js';
import { createReadIdentity } from '../src/path-read-identity-source.js';

const MACOS = process.platform === 'darwin';
const scratch = process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir();

async function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(scratch, 'approval-binding-')));
  const target = (name: string) => path.join(root, name);
  try {
    fs.mkdirSync(target('public')); fs.mkdirSync(target('protected'));
    fs.writeFileSync(target('public/file.txt'), 'PUBLIC'); fs.writeFileSync(target('protected/file.txt'), 'PROTECTED');
    fs.symlinkSync('public', target('alias'));
    const api = { cwd: () => root, lstatSync: fs.lstatSync, readlinkSync: fs.readlinkSync,
      realpathSync: (file: string) => fs.realpathSync(file).normalize('NFC'),
      openDirNoFollowSync(file: string) {
        const fd = fs.openSync(file, fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        fs.closeSync(fd);
      },
      async mkdir(file: string) { await fsp.mkdir(file, { recursive: true }); },
    };
    const identity = createPathIdentity({ ie: () => api, qpt: () => null });
    const ai = 16777216, zut = 536870912, state = { noFollowAny: 'untried' };
    const capability = createPathOpenCapability({ X: fsp.open, m: fs.constants, ai, zut, f: state,
      E: (error: unknown) => error instanceof Error && 'code' in error ? error.code : undefined });
    const opening = createPathOpenPrimitives({ Pe: fsp.open, T: fs.constants, ai, zut, wGn: capability.wGn });
    const binding = createPathApprovalBinding({ ie: () => api, ...identity, O: () => 'macos', ...opening, ai, zut, lwe,
      t: () => {},
    });
    const take = createPathApprovalConsumer(identity._o, () => {});
    const stash = new Be();
    const file = target('alias/file.txt');
    const save = (id: string, lane: 'read' | 'write') => stash.stash(id, file, identity.di(file).spellings, lane);
    const consume = (id: string, lane: 'read' | 'write') =>
      take({ session: { writePermissionStash: stash }, toolUseId: id }, file, lane);
    return { root, target, file, identity, binding, state, capability, save, consume };
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

test('source open and pin bind file access to saved link spellings', { skip: !MACOS }, async t => {
  const f = await fixture();
  try {
    if (await f.capability.wGn()) {
      t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem');
      return;
    }
    const probe = await f.binding.vpe([f.target('public/file.txt')]);
    assert.ok(probe);
    f.save('read-stable', 'read');
    const read = await f.binding.eMt(f.file, f.consume('read-stable', 'read'), undefined, null);
    try { assert.equal(await read.handle.readFile('utf8'), 'PUBLIC'); } finally { await read.close(); }
    f.save('write-stable', 'write');
    const pin = await f.binding.US(f.file, f.consume('write-stable', 'write'), undefined);
    try {
      assert.deepEqual(await pin.readExisting(undefined), { content: 'PUBLIC', encoding: 'utf8', lineEndings: 'LF' });
      await assert.rejects(pin.readExisting(2), (error: NodeJS.ErrnoException) => error.code === 'ERR_FILE_TOO_LARGE');
      await pin.recheckBeforeWrite();
    } finally { await pin.close(); }
    assert.equal(f.state.noFollowAny, 'works');

    f.save('read-changed', 'read'); f.save('write-changed', 'write');
    fs.unlinkSync(f.target('alias')); fs.symlinkSync('protected', f.target('alias'));
    await assert.rejects(f.binding.eMt(f.file, f.consume('read-changed', 'read'), undefined, null),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    await assert.rejects(f.binding.US(f.file, f.consume('write-changed', 'write'), undefined),
      (error: Error) => error.name === 'SymlinkWriteRefusedError');
    assert.equal(fs.readFileSync(f.target('public/file.txt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');

    const encoded = f.target('public/encoded.txt');
    fs.writeFileSync(encoded, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('first\r\nsecond\r\n', 'utf16le')]));
    const encodedPin = await f.binding.US(encoded, f.identity.di(encoded).spellings, undefined);
    try {
      assert.deepEqual(await encodedPin.readExisting(undefined), { content: '﻿first\nsecond\n', encoding: 'utf16le', lineEndings: 'CRLF' });
    } finally { await encodedPin.close(); }
    const lossy = f.target('public/lossy.txt');
    fs.writeFileSync(lossy, Buffer.from([0x61, 0xff, 0x62]));
    const lossyPin = await f.binding.US(lossy, f.identity.di(lossy).spellings, undefined);
    try {
      assert.deepEqual(await lossyPin.readExisting(undefined), { content: 'a�b', encoding: 'utf8', lineEndings: 'LF', lossyDecode: true });
    } finally { await lossyPin.close(); }

    const newFile = f.target('new/dir/file.txt');
    const approved = f.identity.di(newFile).spellings;
    const created = await f.binding.US(newFile, approved, { createParents: true });
    try {
      assert.equal(await created.readExisting(undefined), null);
      await created.recheckBeforeWrite();
      assert.equal(fs.statSync(f.target('new/dir')).isDirectory(), true);
    } finally { await created.close(); }
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('trusted handle scope consumes the opened file and closes on success, abort and read error', { skip: !MACOS }, async t => {
  const f = await fixture();
  const tool = createTools().find(entry => entry.schema.name === 'read_file');
  assert.ok(tool);
  const originalOpen = TrustedReadContract.prototype.open;
  try {
    if (await f.capability.wGn()) { t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem'); return; }
    for (const scenario of ['replace', 'empty', 'abort', 'error'] as const) {
      const file = f.target('public/file.txt');
      fs.writeFileSync(file, scenario === 'empty' || scenario === 'abort' ? '' : 'first\nsecond\n');
      const owner = new PathApprovalCallOwner();
      const call = owner.begin(scenario);
      const controller = new AbortController();
      const contract: TrustedReadContract = new TrustedReadContract(call, tool);
      let opened: Awaited<ReturnType<TrustedReadContract['open']>> | undefined;
      try {
        assert.equal(await contract.observe({ mode: 'bypass', allow: [], deny: [] }, { path: 'public/file.txt' }, f.root, controller.signal), true);
        TrustedReadContract.prototype.open = async function (ownerCall, ownerTool) {
          opened = await originalOpen.call(this, ownerCall, ownerTool);
          if (scenario === 'replace') {
            fs.renameSync(file, f.target('public/moved.txt'));
            fs.writeFileSync(file, 'replacement\n');
          } else if (scenario === 'abort') controller.abort();
          else if (scenario === 'error') await opened.handle.close();
          return opened;
        };
        const result = readTrustedHandleLines(contract, call, tool, 1, 1, 100, controller.signal);
        if (scenario === 'abort') await assert.rejects(result, { name: 'AbortError' });
        else if (scenario === 'error') await assert.rejects(result, { code: 'EBADF' });
        else assert.equal(await result, scenario === 'empty' ? '' : 'first');
        assert.ok(opened);
        if (scenario !== 'abort') await assert.rejects(opened.handle.stat(), { code: 'EBADF' });
        assert.equal(contract.take(call, tool), undefined);
      } finally {
        TrustedReadContract.prototype.open = originalOpen;
        call.finish('success');
      }
      assert.equal(owner.activeCalls, 0);
    }
  } finally {
    TrustedReadContract.prototype.open = originalOpen;
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('trusted contract does not accept a caller-controlled opener', { skip: !MACOS }, async () => {
  const f = await fixture();
  const call = new PathApprovalCallOwner().begin('fake-open');
  const read = createTools().find(tool => tool.schema.name === 'read_file');
  assert.ok(read);
  try {
    const contract = new TrustedReadContract(call, read);
    assert.equal(await contract.observe({ mode: 'bypass', allow: [], deny: [] }, { path: 'alias/file.txt' }, f.root), true);
    let invoked = false;
    await assert.rejects(Reflect.apply(contract.open, contract, [call, read, async () => {
      invoked = true;
      return { handle: { stat: async () => ({ isFile: () => true }) }, close: async () => {} };
    }]));
    assert.equal(invoked, false);
  } finally { call.finish('success'); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('trusted contract identity reaches eMt and rejects a same-name replacement', { skip: !MACOS }, async t => {
  const f = await fixture();
  const owner = new PathApprovalCallOwner();
  const call = owner.begin('trusted');
  const read = createTools().find(tool => tool.schema.name === 'read_file');
  assert.ok(read);
  try {
    if (await f.capability.wGn()) { t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem'); return; }
    const stable = new TrustedReadContract(call, read);
    assert.equal(await stable.observe({ mode: 'bypass', allow: [], deny: [] }, { path: 'alias/file.txt' }, f.root), true);
    const opened = await stable.open(call, read);
    try { assert.equal(await opened.handle.readFile('utf8'), 'PUBLIC'); } finally { await opened.close(); }
    const contract = new TrustedReadContract(call, read);
    assert.equal(await contract.observe({ mode: 'bypass', allow: [], deny: [] }, { path: 'alias/file.txt' }, f.root), true);
    fs.renameSync(f.target('public/file.txt'), f.target('public/original.txt'));
    fs.writeFileSync(f.target('public/file.txt'), 'REPLACEMENT');
    await assert.rejects(contract.open(call, read), /identity changed/);
    assert.equal(contract.take(call, read), undefined);
  } finally { call.finish('success'); fs.rmSync(f.root, { recursive: true, force: true }); }
});

// Read checkPermissions/GIr/bhn, chunk-sfn1dbxq.js [3542972,3543340),
// [3546500,3549105), [3551998,3552396), UTF-16; module SHA-256
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
// The owned fixture consumes the checker's own lane; it does not authorize production reads.
test('async permission lane drives controlled real-file reads', { skip: !MACOS }, async t => {
  const f = await fixture();
  const checker = new AsyncReadPermissionCheck();
  const tool = createTools().find(entry => entry.schema.name === 'read_file');
  assert.ok(tool);
  const policy = { mode: 'bypass' as const, allow: [], deny: ['Read(protected/**)'] };
  const controller = new AbortController();
  const args = { policy, tool, input: { path: 'alias/file.txt' }, workspace: f.root, signal: controller.signal, toolUseId: 'fixture' };
  const retarget = (destination: 'public' | 'protected') => {
    fs.unlinkSync(f.target('alias'));
    fs.symlinkSync(destination, f.target('alias'));
  };
  try {
    if (await f.capability.wGn()) { t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem'); return; }
    const lane = checker.begin('fixture');
    const first = await checker.check(args, lane);
    assert.equal(first.kind, 'decision');
    if (first.kind !== 'decision') throw new Error('Expected decision');
    assert.equal(first.decision.decision, 'allow');
    assert.ok(first.observation && !first.observation.unresolved);
    assert.equal(first.observation.requested, f.file);
    assert.equal(first.observation.landing, f.target('public/file.txt'));
    const stat = fs.statSync(f.target('public/file.txt'), { bigint: true });
    assert.deepEqual(first.identity, { dev: stat.dev, ino: stat.ino });
    const repeat = await checker.check(args, lane);
    assert.equal(repeat.kind, 'decision');
    if (repeat.kind !== 'decision') throw new Error('Expected repeated decision');
    assert.equal(repeat.decision.decision, 'allow');
    const saved = checker.take(lane, f.file);
    assert.equal(saved.kind, 'saved');
    if (saved.kind !== 'saved' || !saved.identity) throw new Error('Expected saved identity');
    assert.deepEqual(saved.paths, first.observation?.spellings.filter(item => repeat.observation?.spellings.includes(item)));
    assert.deepEqual(saved.identity, { dev: stat.dev, ino: stat.ino });
    const opened = await f.binding.eMt(f.file, saved.paths, controller.signal, saved.identity, 'refused');
    try {
      const openedStat = await opened.handle.stat({ bigint: true });
      assert.deepEqual({ dev: openedStat.dev, ino: openedStat.ino }, saved.identity);
      assert.equal(await readControlledHandleLines(opened.handle, 1, 10, 100, controller.signal), 'PUBLIC');
    } finally { await opened.close(); }
    await assert.rejects(opened.handle.stat(), { code: 'EBADF' });
    assert.deepEqual(checker.take(lane, f.file), { kind: 'expired' });

    const changed = checker.begin('fixture');
    const approved = await checker.check(args, changed);
    assert.equal(approved.kind, 'decision');
    if (approved.kind !== 'decision') throw new Error('Expected decision');
    assert.equal(approved.decision.decision, 'allow');
    retarget('protected');
    const savedChanged = checker.take(changed, f.file);
    assert.equal(savedChanged.kind, 'saved');
    if (savedChanged.kind !== 'saved' || !savedChanged.identity) throw new Error('Expected saved identity');
    await assert.rejects(f.binding.eMt(f.file, savedChanged.paths, controller.signal, savedChanged.identity, 'refused'),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    const denied = checker.begin('fixture');
    const denial = await checker.check(args, denied);
    assert.equal(denial.kind, 'decision');
    if (denial.kind !== 'decision') throw new Error('Expected decision');
    assert.equal(denial.decision.decision, 'deny');
    assert.deepEqual(checker.take(denied, f.file), { kind: 'expired' });
    retarget('public');
    const intersection = checker.begin('fixture');
    const unrestricted = { ...args, policy: { ...policy, deny: [] } };
    const before = await checker.check(unrestricted, intersection);
    retarget('protected');
    const after = await checker.check(unrestricted, intersection);
    assert.equal(before.kind, 'decision');
    assert.equal(after.kind, 'decision');
    if (before.kind !== 'decision' || after.kind !== 'decision') throw new Error('Expected decisions');
    assert.equal(before.decision.decision, 'allow');
    assert.equal(after.decision.decision, 'allow');
    const intersected = checker.take(intersection, f.file);
    assert.equal(intersected.kind, 'saved');
    if (intersected.kind !== 'saved') throw new Error('Expected saved paths');
    assert.deepEqual(intersected.paths, before.observation?.spellings.filter(item => after.observation?.spellings.includes(item)));
    assert.equal(intersected.identity, null);
    assert.ok(!intersected.paths.includes(f.target('protected/file.txt')));
    retarget('public');
    const cancelled = checker.begin('fixture');
    const pending = checker.check(args, cancelled);
    controller.abort();
    assert.equal((await pending).kind, 'cancelled');
    assert.deepEqual(checker.take(cancelled, f.file), { kind: 'expired' });
    assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('async read consumer binds live policy, cancellation and file identity', { skip: !MACOS }, async t => {
  const f = await fixture();
  const tool = createTools().find(entry => entry.schema.name === 'read_file');
  assert.ok(tool);
  const owner = new PathApprovalCallOwner();
  let policy = { mode: 'bypass' as const, allow: [] as string[], deny: [] as string[] };
  try {
    if (await f.capability.wGn()) { t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem'); return; }
    const make = () => {
      const call = owner.begin('same-id');
      const controller = new AbortController();
      const consumer = new AsyncReadHandleConsumer(call, tool, f.root, controller.signal, () => policy, () => undefined);
      return { call, controller, consumer };
    };
    const input = { path: 'alias/file.txt' };
    const stable = make();
    assert.equal(await stable.consumer.check(input), true);
    assert.equal(await stable.consumer.readLines(1, 10, 100), 'PUBLIC');
    stable.call.finish('success');
    await assert.rejects(stable.consumer.readLines(1, 10, 100), /expired/);

    const denied = make();
    assert.equal(await denied.consumer.check(input), true);
    policy = { ...policy, deny: ['Read(public/**)'] };
    assert.equal(await denied.consumer.check(input), false);
    await assert.rejects(denied.consumer.readLines(1, 10, 100), /expired/);
    denied.call.finish('denied');
    policy = { ...policy, deny: [] };

    const live = make();
    assert.equal(await live.consumer.check(input), true);
    policy = { ...policy, deny: ['Read(public/**)'] };
    await assert.rejects(live.consumer.readLines(1, 10, 100), /policy changed/);
    live.call.finish('denied');
    policy = { ...policy, deny: [] };

    const aborted = make();
    assert.equal(await aborted.consumer.check(input), true);
    aborted.controller.abort();
    await assert.rejects(aborted.consumer.readLines(1, 10, 100), /expired/);
    aborted.call.finish('cancelled');

    const changed = make();
    assert.equal(await changed.consumer.check(input), true);
    fs.unlinkSync(f.target('alias'));
    fs.symlinkSync('protected', f.target('alias'));
    assert.equal(await changed.consumer.check(input), true);
    await assert.rejects(changed.consumer.readLines(1, 10, 100), /identity expired/);
    changed.call.finish('error');
    fs.unlinkSync(f.target('alias'));
    fs.symlinkSync('public', f.target('alias'));

    const opening = make();
    assert.equal(await opening.consumer.check(input), true);
    const pending = opening.consumer.readLines(1, 10, 100);
    opening.controller.abort();
    await assert.rejects(pending);
    opening.call.finish('cancelled');
    assert.equal(owner.activeCalls, 0);
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

// takeVerifiedRead is a strict host adaptation; this composition is not connected to production.
test('observed single-path Read decisions compose with call ownership and real handles', { skip: !MACOS }, async t => {
  const f = await fixture();
  const owner = new PathApprovalCallOwner();
  const read: ToolDefinition = { schema: { name: 'read_file', input_schema: { type: 'object' } },
    readOnly: true, execute: async () => '' };
  const policy = { mode: 'bypass' as const, allow: [], deny: ['Read(protected/**)'] };
  const observe = (deny: string[] = policy.deny) => {
    const result = prototypePermissionDecision({ ...policy, deny }, read, { path: 'alias/file.txt' }, undefined, f.root);
    assert.equal(result.kind, 'observed');
    if (result.kind !== 'observed') throw new Error('Expected an observed decision');
    return result;
  };
  const retarget = (destination: 'public' | 'protected') => {
    fs.unlinkSync(f.target('alias'));
    fs.symlinkSync(destination, f.target('alias'));
  };
  try {
    if (await f.capability.wGn()) {
      t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem');
      return;
    }
    const call = owner.begin('stable');
    try {
      const result = observe();
      assert.equal(result.decision.decision, 'allow');
      assert.equal(result.coverage, 'partial-host-short-circuit');
      assert.equal(result.observations.length, 1);
      const observation = result.observations[0];
      assert.ok(observation && !observation.unresolved);
      assert.equal(observation.requested, f.file);
      assert.equal(observation.landing, f.target('public/file.txt'));
      // Test adaptation: identity is collected after the decision; source captures it before the decision.
      const identity = await f.binding.vpe(observation.spellings);
      assert.ok(identity);
      assert.equal(call.recordObservedRead(result.input, f.root, result.observations, identity), 'recorded');
      const snapshot = call.takeVerifiedRead(observation.requested);
      assert.equal(snapshot.kind, 'saved');
      if (snapshot.kind !== 'saved') throw new Error('Expected saved approval');
      assert.deepEqual(snapshot.paths, observation.spellings);
      const opened = await f.binding.eMt(observation.requested, snapshot.paths, undefined, snapshot.identity);
      try {
        const stat = await opened.handle.stat({ bigint: true });
        assert.deepEqual({ dev: stat.dev, ino: stat.ino }, snapshot.identity);
        assert.equal(await opened.handle.readFile('utf8'), 'PUBLIC');
      } finally { await opened.close(); }
      assert.deepEqual(call.takeVerifiedRead(observation.requested), { kind: 'expired' });
    } finally { call.finish('success'); }
    assert.equal(owner.activeCalls, 0);

    const tampered = owner.begin('tampered-observation');
    try {
      const result = observe();
      const observation = result.observations[0];
      assert.ok(observation && !observation.unresolved);
      const identity = await f.binding.vpe(observation.spellings);
      assert.ok(identity);
      Reflect.set(observation.spellings, observation.spellings.length, f.target('protected/file.txt'));
      assert.equal(tampered.recordObservedRead(result.input, f.root, result.observations, identity), 'incomplete');
      assert.deepEqual(tampered.takeVerifiedRead(observation.requested), { kind: 'expired' });
    } finally { tampered.finish('denied'); }

    const redirected = owner.begin('redirected');
    try {
      const result = observe();
      assert.equal(result.decision.decision, 'allow');
      assert.equal(result.observations.length, 1);
      const observation = result.observations[0];
      assert.ok(observation && !observation.unresolved);
      const identity = await f.binding.vpe(observation.spellings);
      assert.ok(identity);
      redirected.record('read', observation.requested, observation.spellings, identity);
      retarget('protected');
      const snapshot = redirected.takeVerifiedRead(observation.requested);
      assert.equal(snapshot.kind, 'saved');
      if (snapshot.kind !== 'saved') throw new Error('Expected saved approval');
      await assert.rejects(f.binding.eMt(observation.requested, snapshot.paths, undefined, snapshot.identity),
        (error: Error) => error.name === 'SymlinkReadRefusedError');
      assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
    } finally { redirected.finish('denied'); }
    assert.equal(owner.activeCalls, 0);
    retarget('public');

    const beforeIdentity = owner.begin('retarget-before-identity');
    try {
      const result = observe();
      assert.equal(result.decision.decision, 'allow');
      const observation = result.observations[0];
      assert.ok(observation && !observation.unresolved);
      assert.equal(observation.landing, f.target('public/file.txt'));
      retarget('protected');
      const identity = await f.binding.vpe(observation.spellings);
      const publicStat = fs.statSync(f.target('public/file.txt'), { bigint: true });
      const protectedStat = fs.statSync(f.target('protected/file.txt'), { bigint: true });
      assert.deepEqual(identity, { dev: publicStat.dev, ino: publicStat.ino });
      assert.notDeepEqual(identity, { dev: protectedStat.dev, ino: protectedStat.ino });
      beforeIdentity.record('read', observation.requested, observation.spellings, identity);
      const snapshot = beforeIdentity.takeVerifiedRead(observation.requested);
      assert.deepEqual(snapshot, { kind: 'saved', paths: observation.spellings, identity });
      if (snapshot.kind !== 'saved') throw new Error('Expected saved approval');
      await assert.rejects(f.binding.eMt(observation.requested, snapshot.paths, undefined, snapshot.identity),
        (error: Error) => error.name === 'SymlinkReadRefusedError');
      assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
    } finally { beforeIdentity.finish('denied'); }
    assert.equal(owner.activeCalls, 0);
    retarget('public');

    const withoutIdentity = owner.begin('retarget-without-identity');
    try {
      const result = observe();
      assert.equal(result.decision.decision, 'allow');
      const observation = result.observations[0];
      assert.ok(observation && !observation.unresolved);
      assert.equal(observation.landing, f.target('public/file.txt'));
      retarget('protected');
      withoutIdentity.record('read', observation.requested, observation.spellings);
      const snapshot = withoutIdentity.take('read', observation.requested);
      assert.deepEqual(snapshot, { kind: 'saved', paths: observation.spellings, identity: undefined });
      if (snapshot.kind !== 'saved') throw new Error('Expected saved approval');
      await assert.rejects(f.binding.eMt(observation.requested, snapshot.paths, undefined, snapshot.identity),
        (error: Error) => error.name === 'SymlinkReadRefusedError');
      assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
    } finally { withoutIdentity.finish('denied'); }
    assert.equal(owner.activeCalls, 0);
    retarget('public');

    const repeated = owner.begin('intersection');
    try {
      const first = observe();
      assert.equal(first.decision.decision, 'allow');
      const before = first.observations[0];
      assert.ok(before && !before.unresolved);
      repeated.record('read', before.requested, before.spellings);
      retarget('protected');
      const second = observe([]);
      assert.equal(second.decision.decision, 'allow');
      const after = second.observations[0];
      assert.ok(after && !after.unresolved);
      assert.equal(after.requested, before.requested);
      repeated.record('read', after.requested, after.spellings);
      const snapshot = repeated.take('read', before.requested);
      assert.equal(snapshot.kind, 'saved');
      if (snapshot.kind !== 'saved') throw new Error('Expected saved intersection');
      assert.deepEqual(snapshot.paths, before.spellings.filter(value => after.spellings.includes(value)));
      assert.ok(snapshot.paths.includes(before.requested));
      assert.ok(!snapshot.paths.includes(after.landing));
      await assert.rejects(f.binding.eMt(before.requested, snapshot.paths, undefined, null),
        (error: Error) => error.name === 'SymlinkReadRefusedError');
    } finally { repeated.finish('denied'); }
    assert.equal(owner.activeCalls, 0);
    retarget('public');

    const invalidated = owner.begin('identity-change');
    try {
      const first = observe();
      assert.equal(first.decision.decision, 'allow');
      const before = first.observations[0];
      assert.ok(before && !before.unresolved);
      const firstIdentity = await f.binding.vpe(before.spellings);
      assert.ok(firstIdentity);
      invalidated.record('read', before.requested, before.spellings, firstIdentity);
      retarget('protected');
      const second = observe([]);
      assert.equal(second.decision.decision, 'allow');
      const after = second.observations[0];
      assert.ok(after && !after.unresolved);
      const secondIdentity = await f.binding.vpe(after.spellings);
      assert.ok(secondIdentity);
      assert.notDeepEqual(firstIdentity, secondIdentity);
      invalidated.record('read', after.requested, after.spellings, secondIdentity);
      assert.deepEqual(invalidated.takeVerifiedRead(before.requested), { kind: 'expired' });
      assert.deepEqual(invalidated.takeVerifiedRead(before.requested), { kind: 'expired' });
    } finally { invalidated.finish('denied'); }
    assert.equal(owner.activeCalls, 0);

    retarget('public');
    const denied = owner.begin('bare-deny');
    try {
      const prior = observe();
      assert.equal(prior.decision.decision, 'allow');
      const observation = prior.observations[0];
      assert.ok(observation && !observation.unresolved);
      const identity = await f.binding.vpe(observation.spellings);
      assert.ok(identity);
      denied.record('read', observation.requested, observation.spellings, identity);
      const result = observe(['read_file']);
      assert.equal(result.decision.decision, 'deny');
      assert.deepEqual(result.observations, []);
    } finally { denied.finish('denied'); }
    assert.equal(owner.activeCalls, 0);
    assert.throws(() => denied.take('read', f.file), /ended/);
    const next = owner.begin('bare-deny');
    try { assert.deepEqual(next.take('read', f.file), { kind: 'expired' }); }
    finally { next.finish('denied'); }
    assert.equal(owner.activeCalls, 0);
    assert.equal(fs.readFileSync(f.target('public/file.txt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('source read identity fallback reopens an approved path only for the same inode', { skip: !MACOS }, async t => {
  const f = await fixture();
  try {
    if (await f.capability.wGn()) {
      t.skip('O_NOFOLLOW_ANY is unavailable on this filesystem');
      return;
    }
    const initial = f.identity.di(f.file);
    const identities = createReadIdentity(f.binding.vpe);
    const { own: checked } = await identities.whn(f.file, initial.spellings);
    assert.ok(checked);
    fs.linkSync(f.target('public/file.txt'), f.target('protected/same.txt'));
    const direct = f.target('file-alias');
    fs.symlinkSync('public/file.txt', direct);
    const saved = f.identity.di(direct).spellings;
    fs.unlinkSync(direct); fs.symlinkSync('protected/same.txt', direct);
    const opened = await f.binding.eMt(direct, saved, undefined, checked);
    try {
      assert.equal(opened.canonicalPath, f.target('public/file.txt'));
      assert.equal(await opened.handle.readFile('utf8'), 'PUBLIC');
    } finally { await opened.close(); }
    const screenshot = f.target('public/Capture AM.png');
    const alternateScreenshot = f.target('public/Capture AM.png');
    fs.writeFileSync(screenshot, 'ORDINARY');
    fs.writeFileSync(alternateScreenshot, 'ALTERNATE');
    const screenshotNames = await identities.whn(screenshot, f.identity.di(screenshot).spellings);
    assert.ok(screenshotNames.alt);
    assert.equal(screenshotNames.alt.path, alternateScreenshot);
    assert.ok(screenshotNames.own);
    assert.ok(screenshotNames.alt.identity);
    assert.notDeepEqual(screenshotNames.own, screenshotNames.alt.identity);
    const alternateSpellings = identities.vhn(f.identity.di(screenshot).spellings, alternateScreenshot);
    const alternateRead = await f.binding.eMt(alternateScreenshot, alternateSpellings, undefined, screenshotNames.alt.identity);
    try { assert.equal(await alternateRead.handle.readFile('utf8'), 'ALTERNATE'); } finally { await alternateRead.close(); }
    fs.renameSync(alternateScreenshot, `${alternateScreenshot}.moved`);
    fs.symlinkSync('Capture AM.png', alternateScreenshot);
    await assert.rejects(f.binding.eMt(alternateScreenshot, alternateSpellings, undefined, null),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    await assert.rejects(f.binding.eMt(direct, saved, undefined, null),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    fs.unlinkSync(direct); fs.symlinkSync('protected/file.txt', direct);
    await assert.rejects(f.binding.eMt(direct, saved, undefined, checked),
      (error: Error) => error.name === 'SymlinkReadRefusedError');
    assert.equal(fs.readFileSync(f.target('public/file.txt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.readFileSync(f.target('protected/file.txt'), 'utf8'), 'PROTECTED');
  } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
});
