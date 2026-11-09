import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { defaultConfig } from '../src/agent.js';
import { Session, readSessionJournal } from '../src/session.js';
import { forkSession } from '../src/sessions.js';
import { createClassicChainObserver } from '../src/classic-hook-observer.js';
import { classicHookInput, raiseClassicEvent } from '../src/plugin-chain-classic-raise.js';
import { raiseClassicPreToolUse } from '../src/plugin-chain-tool-raise.js';
import '../src/plugin-chain-registry.js';
import { createChainRun, loadChainModuleFileInto } from '../src/plugin-chain-loader.js';
import { chainModuleRecord } from '../src/plugin-chain-module-record.js';
import { it } from '../src/plugin-chain-host.js';

async function fixture(event = 'WorktreeCreate') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'classic-observer-')));
  const modulePath = path.join(root, 'hook.mjs'), entered = path.join(root, 'entered'), released = path.join(root, 'released');
  fs.writeFileSync(modulePath, `import fs from 'node:fs';export default {name:'classic-fixture',tier:'user',
    patterns:[{pattern:${JSON.stringify('classic.' + event)}}],handlers:{[${JSON.stringify('classic.' + event)}]:async()=>{
      fs.writeFileSync(${JSON.stringify(entered)},'entered');
      while(!fs.existsSync(${JSON.stringify(released)}))await new Promise(resolve=>setTimeout(resolve,5));
      return ${event === 'PreToolUse' ? '{}' : `{worktreePath:${JSON.stringify(root)}}`};}}};`);
  const loaded = await loadChainModuleFileInto(createChainRun(), { pluginName: 'classic-fixture', modulePath });
  return { root, entered, released, loaded };
}

test('actual classic chain settlement binds its owner and remains unknown after close', async () => {
  for (const close of [false, true]) {
    const f = await fixture();
    let session = Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } });
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:WorktreeCreate' });
    const running = raiseClassicEvent({ event: 'WorktreeCreate', hookInput: classicHookInput('WorktreeCreate', { name: 'fixture' }),
      observeChain: createClassicChainObserver(session, id) });
    try {
      const deadline = Date.now() + 2000;
      while (!fs.existsSync(f.entered) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
      assert.equal(fs.existsSync(f.entered), true); assert.equal(session.classicHookChains[0]?.phase, 'admitted');
      assert.equal(session.classicHookModules[0]?.phase, 'admitted');
      if (close) { const owner = session.id; session.close(); session = Session.open(f.root, { id: owner }); }
      fs.writeFileSync(f.released, '');
      const answer = await running; assert.equal(answer.answer.worktreePath, f.root);
      assert.equal(session.classicHookChains[0]?.phase, close ? 'admitted' : 'fulfilled');
      assert.equal(session.classicHookModules[0]?.phase, close ? 'admitted' : 'fulfilled');
      assert.equal(session.classicHookModules[0]?.chainInvocationId, session.classicHookChains[0]?.invocationId);
      assert.throws(() => session.append(structuredClone(session.classicHookModules[0]!)), /Classic module write authorization/);
      assert.throws(() => session.append(structuredClone(session.classicHookChains[0]!)), /Classic chain write authorization/);
      const state = session.classicHookChains, modules = session.classicHookModules, owner = session.id; session.close(); session = Session.open(f.root, { id: owner });
      assert.deepEqual(session.classicHookChains, state);
      assert.deepEqual(session.classicHookModules, modules);
      assert.deepEqual(readSessionJournal(f.root, owner, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.classicHookChains, []); assert.deepEqual(fork.classicHookModules, []); } finally { fork.close(); }
    } finally { fs.writeFileSync(f.released, ''); await running.catch(() => {}); f.loaded.unload(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('classic chain write faults prevent invocation or retain an admitted unknown chain', async () => {
  for (const phase of ['admitted', 'fulfilled'] as const) {
    const f = await fixture(); fs.writeFileSync(f.released, '');
    let session = Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } });
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:WorktreeCreate' });
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"classic_hook_chain"') && args[1].includes(`"phase":"${phase}"`)) throw Error('classic journal fixture');
        return Reflect.apply(target, receiver, args);
      } });
      await assert.rejects(raiseClassicEvent({ event: 'WorktreeCreate', hookInput: classicHookInput('WorktreeCreate'),
        observeChain: createClassicChainObserver(session, id) }), /classic journal fixture|journal write failed/);
    } finally { fs.writeSync = write; }
    try {
      assert.equal(fs.existsSync(f.entered), phase === 'fulfilled');
      const owner = session.id; session.close(); session = Session.open(f.root, { id: owner });
      assert.equal(session.classicHookChains[0]?.phase, phase === 'fulfilled' ? 'admitted' : undefined);
      if (phase === 'fulfilled') {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'classic_hook_chain').hookId = randomUUID();
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(f.root, { id: owner }), /Invalid classic hook chain history/);
      }
    } finally { f.loaded.unload(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('pre-aborted classic chain records its actual resolved Promise', async () => {
  const f = await fixture(); fs.writeFileSync(f.released, '');
  const session = Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } });
  const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:WorktreeCreate' });
  const controller = new AbortController(); controller.abort();
  try {
    await raiseClassicEvent({ event: 'WorktreeCreate', hookInput: classicHookInput('WorktreeCreate'), signal: controller.signal,
      observeChain: createClassicChainObserver(session, id) });
    assert.equal(session.classicHookChains[0]?.phase, 'fulfilled');
  } finally { f.loaded.unload(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('actual module admission and terminal write faults preserve unknown execution', async () => {
  for (const phase of ['admitted', 'fulfilled'] as const) {
    const f = await fixture(); fs.writeFileSync(f.released, '');
    let session = Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } });
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:WorktreeCreate' });
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"classic_hook_module"') && args[1].includes(`"phase":"${phase}"`)) throw Error('module journal fixture');
        return Reflect.apply(target, receiver, args);
      } });
      await assert.rejects(raiseClassicEvent({ event: 'WorktreeCreate', hookInput: classicHookInput('WorktreeCreate'),
        observeChain: createClassicChainObserver(session, id) }));
    } finally { fs.writeSync = write; }
    try {
      assert.equal(fs.existsSync(f.entered), phase === 'fulfilled');
      const owner = session.id; session.close(); session = Session.open(f.root, { id: owner });
      assert.equal(session.classicHookModules[0]?.phase, phase === 'fulfilled' ? 'admitted' : undefined);
      if (phase === 'fulfilled') {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'classic_hook_module').chainInvocationId = randomUUID();
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(f.root, { id: owner }), /Invalid classic module history/);
        assert.throws(() => readSessionJournal(f.root, owner, { maxBytes: 1000000, maxEvents: 1000 }), /Invalid classic module history/);
      }
    } finally { f.loaded.unload(); session.close(); fs.rmSync(f.root, { recursive: true, force: true }); }
  }
});

test('direct module budget return retains pending execution until the actual body settles', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'classic-direct-')));
  const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
  let release = () => {};
  const released = new Promise<void>(resolve => { release = resolve; });
  const record = chainModuleRecord({ name: 'direct-fixture', tier: 'user', hooks: event => event === 'classic.WorktreeCreate',
    record: () => ({ name: 'direct-fixture', tier: 'user', budgetMs: 5, run: async () => { await released; return {}; } }) });
  it().loadedModules.push(record);
  try {
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:WorktreeCreate' });
    await raiseClassicEvent({ event: 'WorktreeCreate', hookInput: classicHookInput('WorktreeCreate'),
      core: { name: 'fixture-core', isCore: true, run: async () => ({}) }, observeChain: createClassicChainObserver(session, id) });
    assert.equal(session.classicHookChains[0]?.phase, 'fulfilled');
    assert.equal(session.classicHookModules[0]?.phase, 'admitted');
    release();
    const deadline = Date.now() + 2000;
    while (session.classicHookModules[0]?.phase === 'admitted' && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(session.classicHookModules[0]?.phase, 'fulfilled');
    assert.deepEqual(readSessionJournal(root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
  } finally {
    release(); it().loadedModules.splice(it().loadedModules.indexOf(record), 1);
    session.close(); fs.rmSync(root, { recursive: true, force: true });
  }
});

test('concurrent classic raises bind the same loaded module to distinct owners and invocations', async () => {
  const f = await fixture();
  const sessions = [0, 1].map(() => Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } }));
  const running = sessions.map(session => {
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:WorktreeCreate' });
    return raiseClassicEvent({ event: 'WorktreeCreate', hookInput: classicHookInput('WorktreeCreate'), observeChain: createClassicChainObserver(session, id) });
  });
  try {
    const deadline = Date.now() + 2000;
    while (sessions.some(s => s.classicHookModules.length === 0) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    for (const s of sessions) assert.equal(s.classicHookModules[0]?.phase, 'admitted');
    fs.writeFileSync(f.released, ''); await Promise.all(running);
    const modules = sessions.map(s => {
      const row = s.classicHookModules[0]!;
      assert.equal(row.owner, s.id); assert.equal(row.phase, 'fulfilled');
      assert.equal(row.chainInvocationId, s.classicHookChains[0]?.invocationId);
      assert.deepEqual(readSessionJournal(f.root, s.id, { maxBytes: 1000000, maxEvents: 1000 }), s.events);
      return row;
    });
    assert.equal(modules[0]!.moduleInstanceId, modules[1]!.moduleInstanceId);
    assert.notEqual(modules[0]!.moduleInvocationId, modules[1]!.moduleInvocationId);
  } finally { fs.writeFileSync(f.released, ''); await Promise.allSettled(running); f.loaded.unload(); sessions.forEach(s => s.close()); fs.rmSync(f.root, { recursive: true, force: true }); }
});

test('nested raises and next continuation retain only their actual observed owner', async () => {
  for (const mode of ['unobserved', 'same-owner', 'other-owner']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'classic-nested-')));
    const outer = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
    const inner = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
    const called: string[] = [];
    const first = chainModuleRecord({ name: 'nested-first', tier: 'user', hooks: event => event === 'classic.WorktreeRemove',
      record: () => ({ name: 'nested-first', tier: 'user', run: async (input, next) => {
        if (typeof input === 'object' && input !== null && 'nested' in input) { called.push('inner'); return {}; }
        called.push('outer');
        const owner = mode === 'same-owner' ? outer : inner;
        let observeChain;
        if (mode !== 'unobserved') {
          const id = randomUUID(); owner.append({ kind: 'hook_start', id, event: 'classic:WorktreeRemove' });
          observeChain = createClassicChainObserver(owner, id);
        }
        await raiseClassicEvent({ event: 'WorktreeRemove', hookInput: classicHookInput('WorktreeRemove', { nested: true }), observeChain });
        return await next(input);
      } }) });
    const second = chainModuleRecord({ name: 'nested-second', tier: 'user', hooks: event => event === 'classic.WorktreeRemove',
      record: () => ({ name: 'nested-second', tier: 'user', run: async () => { called.push('next'); return {}; } }) });
    it().loadedModules.push(first, second);
    try {
      const id = randomUUID(); outer.append({ kind: 'hook_start', id, event: 'classic:WorktreeRemove' });
      await raiseClassicEvent({ event: 'WorktreeRemove', hookInput: classicHookInput('WorktreeRemove'), observeChain: createClassicChainObserver(outer, id) });
      assert.deepEqual(called, ['outer', 'inner', 'next']);
      assert.equal(outer.classicHookModules.length, mode === 'same-owner' ? 3 : 2);
      assert.equal(inner.classicHookModules.length, mode === 'other-owner' ? 1 : 0);
      const original = outer.classicHookChains.find(row => row.hookId === id)!;
      assert.equal(outer.classicHookModules.filter(row => row.chainInvocationId === original.invocationId).length, 2);
      for (const owner of [outer, inner]) {
        for (const row of owner.classicHookModules) { assert.equal(row.owner, owner.id); assert.equal(row.phase, 'fulfilled'); }
        assert.deepEqual(readSessionJournal(root, owner.id, { maxBytes: 1000000, maxEvents: 1000 }), owner.events);
      }
    } finally {
      for (const record of [first, second]) it().loadedModules.splice(it().loadedModules.indexOf(record), 1);
      outer.close(); inner.close(); fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('PreToolUse actual execution retains cold ownership through close and journal faults', async () => {
  for (const mode of ['normal', 'closed', 'admitted', 'fulfilled']) {
    const f = await fixture('PreToolUse');
    let session = Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } });
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:PreToolUse' });
    const write = fs.writeSync;
    let running: ReturnType<typeof raiseClassicPreToolUse> | undefined;
    try {
      if (mode === 'admitted' || mode === 'fulfilled') {
        fs.writeFileSync(f.released, '');
        fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
          if (Buffer.isBuffer(args[1]) && args[1].includes('"kind":"classic_hook_module"') && args[1].includes(`"phase":"${mode}"`)) throw Error('pre module journal fixture');
          return Reflect.apply(target, receiver, args);
        } });
      }
      running = raiseClassicPreToolUse({ tool: 'probe', toolUseId: 'owned', input: {}, observeChain: createClassicChainObserver(session, id) });
      if (mode === 'admitted' || mode === 'fulfilled') {
        await assert.rejects(running); fs.writeSync = write;
        assert.equal(fs.existsSync(f.entered), mode === 'fulfilled');
      } else {
        const deadline = Date.now() + 2000;
        while (!fs.existsSync(f.entered) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(fs.existsSync(f.entered), true);
        assert.equal(session.classicHookModules[0]?.phase, 'admitted');
        if (mode === 'closed') { const owner = session.id; session.close(); session = Session.open(f.root, { id: owner }); }
        fs.writeFileSync(f.released, ''); await running;
      }
      const owner = session.id; session.close(); session = Session.open(f.root, { id: owner });
      assert.equal(session.classicHookModules[0]?.phase, mode === 'admitted' ? undefined : mode === 'normal' ? 'fulfilled' : 'admitted');
      assert.deepEqual(readSessionJournal(f.root, owner, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
      const fork = forkSession(session); try { assert.deepEqual(fork.classicHookModules, []); } finally { fork.close(); }
    } finally {
      fs.writeSync = write; fs.writeFileSync(f.released, ''); await running?.catch(() => {});
      f.loaded.unload(); session.close(); fs.rmSync(f.root, { recursive: true, force: true });
    }
  }
});

test('PreToolUse waits through successive reloads and selects the replacement module', async () => {
  const old = await fixture('PreToolUse');
  const session = Session.open(old.root, { config: { ...defaultConfig(old.root, []), model: 'fixture' } });
  let releaseFirst = () => {}, releaseSecond = () => {};
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const second = new Promise<void>(resolve => { releaseSecond = resolve; });
  let replacement: Awaited<ReturnType<typeof fixture>> | undefined;
  let running: ReturnType<typeof raiseClassicPreToolUse> | undefined;
  try {
    it().hooksRespawns.add(first);
    const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:PreToolUse' });
    running = raiseClassicPreToolUse({ tool: 'probe', input: {}, observeChain: createClassicChainObserver(session, id) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fs.existsSync(old.entered), false); assert.equal(session.classicHookModules.length, 0);
    old.loaded.unload(); replacement = await fixture('PreToolUse'); fs.writeFileSync(replacement.released, '');
    it().hooksRespawns.add(second); it().hooksRespawns.delete(first); releaseFirst();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(fs.existsSync(replacement.entered), false);
    assert.equal(session.classicHookChains[0]?.phase, 'admitted');
    it().hooksRespawns.delete(second); releaseSecond(); await running;
    assert.equal(fs.existsSync(old.entered), false); assert.equal(fs.existsSync(replacement.entered), true);
    assert.equal(session.classicHookChains.length, 1); assert.equal(session.classicHookChains[0]?.phase, 'fulfilled');
    assert.equal(session.classicHookModules.length, 1); assert.equal(session.classicHookModules[0]?.phase, 'fulfilled');
    assert.deepEqual(readSessionJournal(old.root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
  } finally {
    it().hooksRespawns.delete(first); it().hooksRespawns.delete(second); releaseFirst(); releaseSecond();
    fs.writeFileSync(old.released, ''); if (replacement) fs.writeFileSync(replacement.released, '');
    await running?.catch(() => {}); old.loaded.unload(); replacement?.loaded.unload(); session.close();
    fs.rmSync(old.root, { recursive: true, force: true }); if (replacement) fs.rmSync(replacement.root, { recursive: true, force: true });
  }
});

test('PreToolUse reload rejection follows source denial versus abort classification', async () => {
  for (const mode of ['error', 'null', 'undefined', 'signal', 'abort-error']) {
    const f = await fixture('PreToolUse'); fs.writeFileSync(f.released, '');
    const session = Session.open(f.root, { config: { ...defaultConfig(f.root, []), model: 'fixture' } });
    let rejectReload: (error?: unknown) => void = () => {};
    const reload = new Promise<void>((_resolve, reject) => { rejectReload = reject; });
    const controller = new AbortController();
    let running: ReturnType<typeof raiseClassicPreToolUse> | undefined;
    try {
      it().hooksRespawns.add(reload);
      const id = randomUUID(); session.append({ kind: 'hook_start', id, event: 'classic:PreToolUse' });
      running = raiseClassicPreToolUse({ tool: 'probe', input: {}, signal: controller.signal, observeChain: createClassicChainObserver(session, id) });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(fs.existsSync(f.entered), false);
      it().hooksRespawns.delete(reload);
      if (mode === 'signal') controller.abort();
      const abortError = new Error('owned abort'); abortError.name = 'AbortError';
      rejectReload(mode === 'null' ? null : mode === 'undefined' ? undefined : mode === 'abort-error' ? abortError : new Error('owned reload failure'));
      if (mode === 'signal' || mode === 'abort-error') {
        await assert.rejects(running, error => error instanceof Error && error.name === 'AbortError');
        assert.equal(session.classicHookChains[0]?.phase, 'rejected');
      } else {
        const result = await running;
        assert.deepEqual(result.permission, mode === 'undefined' ? {} : { permissionBehavior: 'deny', hookPermissionDecisionReason: mode === 'null' ? 'null' : 'owned reload failure' });
        assert.equal(session.classicHookChains[0]?.phase, 'fulfilled');
      }
      assert.equal(fs.existsSync(f.entered), mode === 'undefined');
      assert.equal(session.classicHookModules.length, mode === 'undefined' ? 1 : 0);
      assert.deepEqual(readSessionJournal(f.root, session.id, { maxBytes: 1000000, maxEvents: 1000 }), session.events);
    } finally {
      it().hooksRespawns.delete(reload); rejectReload(); await running?.catch(() => {});
      f.loaded.unload(); session.close(); fs.rmSync(f.root, { recursive: true, force: true });
    }
  }
});
