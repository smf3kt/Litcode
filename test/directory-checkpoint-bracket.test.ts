import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { checkpointConversation } from '../src/rewind.js';
import { Session } from '../src/session.js';
import { lock } from '../src/skill-effects.js';
import { beginDirectoryCheckpointBracket } from '../src/directory-checkpoint-bracket.js';

const roots: string[] = [];
after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });

test('directory brackets cover a real checkpoint and reject changed or retired evidence', async () => {
  for (const scenario of ['present', 'empty', 'missing', 'changed', 'parent-roundtrip', 'revoked', 'regranted',
    'missing-created', 'missing-created-deleted', 'root-replaced', 'root-moved', 'symlink', 'hardlink',
    'backup-changed', 'session-closed', 'caller-aborted', 'cancelled'] as const) {
    const base = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'directory-bracket-')));
    roots.push(base);
    const workspace = path.join(base, 'workspace'), outside = path.join(base, 'outside'), sub = path.join(outside, 'sub'), target = path.join(sub, 'value');
    fs.mkdirSync(workspace); fs.mkdirSync(outside); fs.mkdirSync(sub);
    const missing = scenario === 'missing' || scenario === 'missing-created' || scenario === 'missing-created-deleted';
    if (!missing) {
      fs.writeFileSync(target, scenario === 'empty' ? '' : 'ORIGINAL', { mode: 0o751 });
      fs.utimesSync(target, 1700000000, 1700000000);
      if (scenario === 'symlink') { fs.renameSync(target, `${target}-original`); fs.symlinkSync('value-original', target); }
      if (scenario === 'hardlink') fs.linkSync(target, `${target}-other`);
    }
    const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const grant = session.workingDirectories(false).readHandle?.(outside); assert.ok(grant);
    if (scenario === 'root-replaced') { fs.renameSync(outside, `${outside}-old`); fs.mkdirSync(outside); }
    const gateFd = fs.openSync(`${session.file}.lock.gate`, 'r+'); assert.equal(lock(gateFd, false), true);
    const destinationFd = fs.openSync(path.join(workspace, '.agent', 'bracket-fixture'), 'wx+', 0o600);
    const controller = new AbortController();
    const current = () => {
      const live = session.workingDirectories(false).readHandle?.(outside);
      return session.isOpen && !!live && live.owner === grant.owner && live.fd === grant.fd && live.incarnation === grant.incarnation;
    };
    let bracket: Awaited<ReturnType<typeof beginDirectoryCheckpointBracket>> | undefined;
    try {
      bracket = await beginDirectoryCheckpointBracket({ grant, relative: 'sub/value', destinationFd, gateFd,
        signal: AbortSignal.any([controller.signal, grant.signal, session.closeSignal]), isCurrent: current });
      if (scenario === 'root-replaced' || scenario === 'symlink' || scenario === 'hardlink') { assert.equal(bracket.kind, 'unknown'); continue; }
      assert.equal(bracket.kind, 'ready');
      if (bracket.kind !== 'ready') throw new Error('bracket unavailable');
      checkpointConversation(session, `bracket-${scenario}`, controller.signal);
      if (scenario === 'changed') { fs.writeFileSync(target, 'MUTATED!'); fs.utimesSync(target, 1700000000, 1700000000); }
      if (scenario === 'parent-roundtrip') { fs.renameSync(sub, `${sub}-old`); fs.renameSync(`${sub}-old`, sub); }
      if (scenario === 'revoked' || scenario === 'regranted') {
        session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
        if (scenario === 'regranted') session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      }
      if (scenario === 'missing-created') fs.writeFileSync(target, 'CREATED');
      if (scenario === 'missing-created-deleted') { fs.writeFileSync(target, 'CREATED'); fs.unlinkSync(target); }
      if (scenario === 'root-moved') { fs.renameSync(outside, `${outside}-old`); fs.mkdirSync(outside); }
      if (scenario === 'backup-changed') fs.writeSync(destinationFd, Buffer.from('MUTATED!'), 0, 8, 0);
      if (scenario === 'session-closed') await session.close();
      if (scenario === 'caller-aborted') controller.abort();
      if (scenario === 'cancelled') await bracket.cancel();
      const result = await bracket.finish();
      assert.equal(result.kind, scenario === 'present' || scenario === 'empty' || scenario === 'missing' ? 'stable' : 'unknown', scenario);
      assert.deepEqual(await bracket.finish(), result);
      if (result.kind === 'stable') {
        assert.equal(result.observation.kind, missing ? 'missing' : 'present');
        if (result.observation.kind === 'present') {
          assert.equal(result.observation.file.mode, 0o751);
          assert.equal(fs.readFileSync(path.join(workspace, '.agent', 'bracket-fixture'), 'utf8'), scenario === 'empty' ? '' : 'ORIGINAL');
        }
      }
    } finally {
      if (bracket?.kind === 'ready') await bracket.cancel();
      fs.closeSync(destinationFd); fs.closeSync(gateFd); await session.close();
    }
  }
});

test('multiple directory brackets stay live across the same checkpoint', async () => {
  for (const changeSecond of [false, true]) {
    const base = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'directory-bracket-multi-')));
    roots.push(base);
    const workspace = path.join(base, 'workspace'), outside = path.join(base, 'outside');
    fs.mkdirSync(workspace); fs.mkdirSync(outside);
    for (const name of ['a', 'b']) { fs.writeFileSync(path.join(outside, name), 'ORIGINAL'); fs.utimesSync(path.join(outside, name), 1700000000, 1700000000); }
    const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const grant = session.workingDirectories(false).readHandle?.(outside); assert.ok(grant);
    const gateFd = fs.openSync(`${session.file}.lock.gate`, 'r+'); assert.equal(lock(gateFd, false), true);
    const destinations = ['a', 'b'].map(name => fs.openSync(path.join(workspace, '.agent', `bracket-${name}`), 'wx+', 0o600));
    const signal = AbortSignal.any([grant.signal, session.closeSignal]);
    const isCurrent = () => {
      const live = session.workingDirectories(false).readHandle?.(outside);
      return session.isOpen && !!live && live.owner === grant.owner && live.fd === grant.fd && live.incarnation === grant.incarnation;
    };
    let brackets: Awaited<ReturnType<typeof beginDirectoryCheckpointBracket>>[] = [];
    try {
      brackets = await Promise.all(['a', 'b'].map((relative, index) => beginDirectoryCheckpointBracket({
        grant, relative, destinationFd: destinations[index]!, gateFd, signal, isCurrent,
      })));
      assert.ok(brackets.every(bracket => bracket.kind === 'ready'));
      checkpointConversation(session, 'multi-bracket', signal);
      if (changeSecond) { fs.writeFileSync(path.join(outside, 'b'), 'MUTATED!'); fs.utimesSync(path.join(outside, 'b'), 1700000000, 1700000000); }
      const results = await Promise.all(brackets.map(bracket => bracket.kind === 'ready' ? bracket.finish() : bracket));
      assert.deepEqual(results.map(result => result.kind), changeSecond ? ['stable', 'unknown'] : ['stable', 'stable']);
    } finally {
      await Promise.all(brackets.map(bracket => bracket.kind === 'ready' ? bracket.cancel() : undefined));
      for (const fd of destinations) fs.closeSync(fd);
      fs.closeSync(gateFd); await session.close();
    }
  }
});

test('Session owns checkpoint bracket authority, evidence and cleanup', async () => {
  for (const scenario of ['stable', 'unrelated-destination', 'sidecar-swap', 'gate-swap', 'abandoned-close'] as const) {
    const base = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'directory-bracket-owner-')));
    roots.push(base);
    const workspace = path.join(base, 'workspace'), outside = path.join(base, 'outside');
    fs.mkdirSync(workspace); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'value'), 'ORIGINAL');
    const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const id = randomUUID(), sidecar = `${session.file}.snapshot-unknown-${id}`;
    const file = scenario === 'unrelated-destination' ? path.join(workspace, '.agent', 'unrelated') : sidecar;
    const fd = fs.openSync(file, 'wx+', 0o600), signal = new AbortController().signal;
    let bracket: { kind: string; finish?: () => Promise<{ kind: string }>; cancel?: () => Promise<void> } | undefined;
    try {
      const begin = Reflect.get(session, 'beginDirectoryCheckpointBracket'); assert.equal(typeof begin, 'function');
      bracket = await Reflect.apply(begin, session, [{ id, root: outside, lexicalPath: path.join(outside, 'value'), destinationFd: fd, signal }]);
      if (scenario === 'unrelated-destination') { assert.equal(bracket?.kind, 'unknown'); assert.equal(fs.statSync(file).size, 0); continue; }
      assert.equal(bracket?.kind, 'ready'); assert.ok(bracket?.finish && bracket.cancel);
      checkpointConversation(session, `owned-${scenario}`, signal);
      if (scenario === 'sidecar-swap') { fs.renameSync(sidecar, `${sidecar}-original`); fs.writeFileSync(sidecar, 'OTHER', { mode: 0o600 }); }
      if (scenario === 'gate-swap') { fs.renameSync(`${session.file}.lock.gate`, `${session.file}.lock.gate-old`); fs.writeFileSync(`${session.file}.lock.gate`, '', { mode: 0o600 }); }
      if (scenario === 'abandoned-close') {
        await session.close();
        let reopened: Session | undefined; const deadline = Date.now() + 10000;
        while (!reopened) {
          try { reopened = Session.open(workspace, { id: session.id }); }
          catch (error) { if (!String(error).includes('Session lock busy') || Date.now() >= deadline) throw error; await new Promise(resolve => setTimeout(resolve, 10)); }
        }
        await reopened.close();
      }
      const result = await bracket.finish();
      assert.equal(result.kind, scenario === 'stable' ? 'stable' : 'unknown', scenario);
      if (scenario === 'stable') assert.equal(fs.readFileSync(sidecar, 'utf8'), 'ORIGINAL');
      if (scenario === 'sidecar-swap') assert.equal(fs.readFileSync(`${sidecar}-original`, 'utf8'), 'ORIGINAL');
      if (scenario === 'gate-swap') {
        const lock = `${session.file}.lock`, original = fs.readFileSync(lock, 'utf8');
        await session.close(); assert.equal(fs.readFileSync(lock, 'utf8'), original);
      }
    } finally { await bracket?.cancel?.(); fs.closeSync(fd); await session.close(); }
  }
});

test('Session shares one gate across concurrent checkpoint brackets', async () => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'directory-bracket-shared-')));
  roots.push(base);
  const workspace = path.join(base, 'workspace'), outside = path.join(base, 'outside'); fs.mkdirSync(workspace); fs.mkdirSync(outside);
  for (const name of ['a', 'b']) fs.writeFileSync(path.join(outside, name), name === 'a' ? '' : name);
  const session = Session.open(workspace, { config: { ...defaultConfig(workspace, []), model: 'fixture' } });
  session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
  const ids = [randomUUID(), randomUUID()], fds = ids.map(id => fs.openSync(`${session.file}.snapshot-unknown-${id}`, 'wx+', 0o600));
  const signal = new AbortController().signal;
  let brackets: Awaited<ReturnType<Session['beginDirectoryCheckpointBracket']>>[] = [];
  try {
    brackets = await Promise.all(['a', 'b'].map((name, index) => session.beginDirectoryCheckpointBracket({
      id: ids[index]!, root: outside, lexicalPath: path.join(outside, name), destinationFd: fds[index]!, signal,
    })));
    assert.deepEqual(brackets.map(bracket => bracket.kind), ['ready', 'ready']);
    const duplicate = await session.beginDirectoryCheckpointBracket({ id: ids[0]!, root: outside,
      lexicalPath: path.join(outside, 'a'), destinationFd: fds[0]!, signal });
    assert.equal(duplicate.kind, 'unknown');
    checkpointConversation(session, 'shared-bracket', signal);
    const first = brackets[0], second = brackets[1]; assert.ok(first?.kind === 'ready' && second?.kind === 'ready');
    const contender = fs.openSync(`${session.file}.lock.gate`, 'r+');
    try {
      assert.equal(lock(contender, false), false);
      assert.equal((await first.finish()).kind, 'stable'); assert.equal(lock(contender, false), false);
      assert.equal((await second.finish()).kind, 'stable'); assert.equal(lock(contender, false), true);
    } finally { fs.closeSync(contender); }
  } finally {
    await Promise.all(brackets.map(bracket => bracket.kind === 'ready' ? bracket.cancel() : undefined));
    for (const fd of fds) fs.closeSync(fd); await session.close();
  }
});
