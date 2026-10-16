// The `$` call table's filesystem floor (W45-46). The ported bodies are src/plugin-chain-fs-source.ts,
// the five entries sit verbatim in src/plugin-chain-fs.ts (chunk-sfn1dbxq.js [2353753,2353766),
// [2353767,2353781), [2353782,2353795), [2353796,2353905) and [2353906,2353919)), and the two
// dependencies the product does not carry — the location policy `$ne` and the platform `O` — are the
// bindable hooks in src/plugin-chain-fs-boundaries.ts. These tests bind the behaviour those bodies
// produce to the source's own texts: the read with its byte limit and its base64 form, the write and
// its log line, the existence probe that answers false, the stat that follows a reachable link, the
// sorted list, the location refusal, and the entry checks.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import '../src/plugin-chain-registry.js';
import { bindHostPlatform, bindNetworkLocationRefusal, O } from '../src/plugin-chain-fs-boundaries.js';
import {
  fsPathRefusal,
  fsRaiseDescriptor,
  fsReadRefusal,
  fsStatRefusal,
  raiseFsCall,
  runFsEvent,
} from '../src/plugin-chain-fs.js';
import { bindPluginProcessIdentity, chainRecords, clearChainRecords, installChainModule, se } from '../src/plugin-chain-host.js';
import type { ChainHandler, ChainModule } from '../src/plugin-chain-types.js';

const ORIGIN = Object.freeze([Object.freeze({ kind: 'plugin' })]);
const caller = (plugin = 'fixture-fs') => ({ plugin, origin: ORIGIN });
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-reverse-fs-'));

function moduleWith(event: string, handler: ChainHandler): ChainModule {
  return { name: handler.name, tier: handler.tier, hooks: (e: string) => e === event, record: () => handler };
}

/** A handler whose `next` hands the call to the floor, which is where an entry's `check` runs. */
function passthrough(name: string, event: string): ChainModule {
  return moduleWith(event, {
    name,
    tier: 'user',
    run: async (args: unknown, next: (value: unknown) => Promise<unknown>) => await next(args),
  } as unknown as ChainHandler);
}

const logLines = () => chainRecords().filter((record): record is { kind: 'log'; level: string; message: string } => record.kind === 'log').map(record => record.message);

after(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test('fs.read answers the file text, and its bytes as base64', async () => {
  const file = path.join(root, 'read-me.txt');
  fs.writeFileSync(file, 'the file the plugin asked for', 'utf8');

  assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: file }, caller: caller() }), 'the file the plugin asked for');

  // The bytes form is an object carrying `base64`; the text form is the string itself.
  const bytes = fs.readFileSync(file);
  const asBytes = await raiseFsCall({ event: 'fs.read', args: { path: file, as: 'bytes' }, caller: caller() }) as { base64: string };
  assert.deepEqual(asBytes, { base64: bytes.toString('base64') });
  assert.deepEqual(Buffer.from(asBytes.base64, 'base64'), bytes);

  // The path resolves against the caller's cwd when it is relative.
  assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: 'read-me.txt' }, caller: { ...caller(), cwd: root } }), 'the file the plugin asked for');
});

test('a relative path with no caller cwd resolves against the process cwd the host holds', async () => {
  const file = path.join(root, 'no-cwd.txt');
  fs.writeFileSync(file, 'process cwd', 'utf8');
  // `HE` falls back to `se()`, the process cwd the host binds (W45-44), the way the source's own
  // `se()` reads the process's cwd.
  const unbind = bindPluginProcessIdentity({ cwd: root });
  try {
    assert.equal(se(), root);
    assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: 'no-cwd.txt' }, caller: caller() }), 'process cwd');
  } finally {
    unbind();
  }
});

test('fs.write makes the directory, writes the text, and logs the byte count', async () => {
  clearChainRecords();
  const file = path.join(root, 'deep', 'nested', 'written.txt');
  await raiseFsCall({ event: 'fs.write', args: { path: file, text: 'written by the floor' }, caller: caller() });
  assert.equal(fs.readFileSync(file, 'utf8'), 'written by the floor');
  assert.equal(Buffer.byteLength('written by the floor'), 20);
  assert.ok(logLines().includes(`$.fs.write (fixture-fs): ${file} (20 bytes)`), `log lines: ${JSON.stringify(logLines())}`);

  // Overwriting is plain: the write is the whole file.
  await raiseFsCall({ event: 'fs.write', args: { path: file, text: 'shorter' }, caller: caller() });
  assert.equal(fs.readFileSync(file, 'utf8'), 'shorter');
});

test('the write refuses text over the 4 MiB limit before it touches the disk', async () => {
  const file = path.join(root, 'too-big.txt');
  const over = 'a'.repeat(4194305);
  await assert.rejects(
    () => raiseFsCall({ event: 'fs.write', args: { path: file, text: over }, caller: caller() }),
    (error: unknown) => {
      assert.match((error as Error).message, /4194305 bytes is over the 4194304-byte limit/);
      return true;
    },
  );
  assert.equal(fs.existsSync(file), false, 'a refused write leaves no file');
});

test('the read refuses a file over the 4 MiB limit', async () => {
  const file = path.join(root, 'big.bin');
  fs.writeFileSync(file, Buffer.alloc(4194305, 97));
  await assert.rejects(
    () => raiseFsCall({ event: 'fs.read', args: { path: file }, caller: caller() }),
    /the file is over the 4194304-byte limit/,
  );

  // A file that fits is read through the chunk loop and answers whole.
  const fits = path.join(root, 'fits.bin');
  fs.writeFileSync(fits, Buffer.alloc(200000, 98));
  const answer = await raiseFsCall({ event: 'fs.read', args: { path: fits, as: 'bytes' }, caller: caller() }) as { base64: string };
  const whole = Buffer.from(answer.base64, 'base64');
  assert.equal(whole.length, 200000);
  assert.equal(whole.every(byte => byte === 98), true);
});

test('fs.exists answers a boolean and never throws', async () => {
  const file = path.join(root, 'exists.txt');
  fs.writeFileSync(file, 'here', 'utf8');
  assert.equal(await raiseFsCall({ event: 'fs.exists', args: { path: file }, caller: caller() }), true);
  assert.equal(await raiseFsCall({ event: 'fs.exists', args: { path: path.join(root, 'absent.txt') }, caller: caller() }), false);
  // A path below a file cannot be stat-ed either; the probe answers false rather than throwing.
  assert.equal(await raiseFsCall({ event: 'fs.exists', args: { path: path.join(file, 'below') }, caller: caller() }), false);
});

test('fs.list answers the entries sorted by name, with kinds, sizes and link flags', async () => {
  const dir = path.join(root, 'listing');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'b-file.txt'), 'bbb', 'utf8');
  fs.writeFileSync(path.join(dir, 'a-file.txt'), 'a', 'utf8');
  fs.mkdirSync(path.join(dir, 'c-dir'));
  fs.symlinkSync(path.join(dir, 'a-file.txt'), path.join(dir, 'd-link'));

  const entries = await raiseFsCall({ event: 'fs.list', args: { path: dir }, caller: caller() }) as Array<{ name: string; kind: string; size: number; mtimeMs: number; isLink: boolean }>;
  assert.deepEqual(entries.map(entry => entry.name), ['a-file.txt', 'b-file.txt', 'c-dir', 'd-link']);
  const byName = new Map(entries.map(entry => [entry.name, entry]));
  assert.equal(byName.get('a-file.txt')?.kind, 'file');
  assert.equal(byName.get('a-file.txt')?.size, 1);
  assert.equal(byName.get('b-file.txt')?.size, 3);
  assert.equal(byName.get('c-dir')?.kind, 'dir');
  assert.equal(byName.get('c-dir')?.size, 0, 'a directory answers the size the source leaves it at');
  assert.equal(byName.get('d-link')?.kind, 'other', 'a link is neither a file nor a directory');
  assert.equal(byName.get('d-link')?.isLink, true);
  assert.ok((byName.get('a-file.txt')?.mtimeMs ?? 0) > 0);
});

test('fs.stat answers the entry, and follows a link whose target is reachable', async () => {
  const file = path.join(root, 'stat.txt');
  fs.writeFileSync(file, 'twelve bytes', 'utf8');
  const direct = await raiseFsCall({ event: 'fs.stat', args: { path: file }, caller: caller() }) as { kind: string; size: number; isLink: boolean; realPath?: string };
  assert.equal(direct.kind, 'file');
  assert.equal(direct.size, 12);
  assert.equal(direct.isLink, false);
  assert.equal(direct.realPath, undefined, 'realPath is answered only when the caller asked to resolve');

  const link = path.join(root, 'stat-link');
  fs.symlinkSync(file, link);
  const linked = await raiseFsCall({ event: 'fs.stat', args: { path: link }, caller: caller() }) as { kind: string; size: number; isLink: boolean; realPath?: string };
  assert.equal(linked.isLink, true, 'the entry itself is reported as a link');
  assert.equal(linked.kind, 'file', 'the kind comes from the link target');
  assert.equal(linked.size, 12, 'so does the size');

  const resolved = await raiseFsCall({ event: 'fs.stat', args: { path: link, resolve: true }, caller: caller() }) as { realPath?: string };
  assert.equal(resolved.realPath, fs.realpathSync(file));

  // A link pointing nowhere is not followed; the stat answers the link itself.
  const broken = path.join(root, 'broken-link');
  fs.symlinkSync(path.join(root, 'absent-target'), broken);
  const brokenStat = await raiseFsCall({ event: 'fs.stat', args: { path: broken }, caller: caller() }) as { isLink: boolean; realPath?: string };
  assert.equal(brokenStat.isLink, true);
  assert.equal(brokenStat.realPath, undefined);
});

test('the floor refuses a location the policy refuses, with the source\'s text', async () => {
  clearChainRecords();
  bindNetworkLocationRefusal((file: string) => file.includes('network'));
  try {
    await assert.rejects(
      () => raiseFsCall({ event: 'fs.read', args: { path: '/network/share/notes.txt' }, caller: caller() }),
      (error: unknown) => {
        assert.match((error as Error).message, /fixture-fs: \$\.fs\.read: \/network\/share\/notes\.txt refused: a network location is not reached from here/);
        return true;
      },
    );
    assert.ok(logLines().some(line => line.startsWith('$.fs.read (fixture-fs): /network/share/notes.txt refused: a network location is not reached from here')), `log lines: ${JSON.stringify(logLines())}`);
    // The policy is the boundary's: with it unbound the same call reaches the filesystem instead.
    bindNetworkLocationRefusal(undefined);
    await assert.rejects(
      () => raiseFsCall({ event: 'fs.read', args: { path: '/network/share/notes.txt' }, caller: caller() }),
      /failed: ENOENT/,
    );
  } finally {
    bindNetworkLocationRefusal(undefined);
  }
});

test('the platform the read picks its open mode by is the bound one', async () => {
  assert.equal(O(), process.platform, 'unbound, the boundary answers the host platform');
  let asked = 0;
  bindHostPlatform(() => { asked += 1; return 'windows'; });
  try {
    const file = path.join(root, 'platform.txt');
    fs.writeFileSync(file, 'read on any platform', 'utf8');
    assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: file }, caller: caller() }), 'read on any platform');
    assert.equal(asked, 1, 'the read asks the platform once');
  } finally {
    bindHostPlatform(undefined);
  }
  assert.equal(O(), process.platform);
});

test('the entry checks refuse with the source\'s own texts', () => {
  assert.equal(fsPathRefusal({ path: 'a/b.txt' }), undefined);
  assert.equal(fsPathRefusal({}), 'takes a path');
  assert.equal(fsPathRefusal({ path: '' }), 'takes a path');
  assert.equal(fsPathRefusal({ path: 7 }), 'takes a path');

  assert.equal(fsReadRefusal({ path: 'a/b.txt', as: 'text' }), undefined);
  assert.equal(fsReadRefusal({ path: 'a/b.txt', as: 'bytes' }), undefined);
  assert.equal(fsReadRefusal({ path: 'a/b.txt', as: 'binary' }), 'as is "text" or "bytes"');
  assert.equal(fsReadRefusal({ path: 'a/b.txt' }), 'as is "text" or "bytes"', 'the read names its two forms, so omitting `as` is refused too');
  assert.equal(fsReadRefusal({}), 'takes a path', 'the path is refused first');

  assert.equal(fsStatRefusal({ path: 'a/b.txt', resolve: true }), undefined);
  assert.equal(fsStatRefusal({ path: 'a/b.txt', resolve: false }), undefined);
  assert.equal(fsStatRefusal({ path: 'a/b.txt', resolve: 'yes' }), 'resolve is true or false');
  assert.equal(fsStatRefusal({ path: 'a/b.txt' }), 'resolve is true or false', 'the stat names its flag, so omitting `resolve` is refused too');

  assert.deepEqual(fsRaiseDescriptor({ cwd: '/some/where' }), { field: 'path', at: '/some/where' });
  assert.deepEqual(fsRaiseDescriptor({}), { field: 'path', at: process.cwd() });
});

test('an entry check runs only behind a handler, as the table floors do', async () => {
  const gate = installChainModule(passthrough('fixture-fs-check', 'fs.read'));
  const listGate = installChainModule(passthrough('fixture-fs-list-check', 'fs.list'));
  try {
    await assert.rejects(
      () => raiseFsCall({ event: 'fs.read', args: {}, caller: caller() }),
      /HooksError: fs\.read: takes a path \(host check\)/,
    );
    await assert.rejects(
      () => raiseFsCall({ event: 'fs.read', args: { path: 'a/b.txt' }, caller: caller() }),
      /HooksError: fs\.read: as is "text" or "bytes" \(host check\)/,
    );
    await assert.rejects(
      () => raiseFsCall({ event: 'fs.list', args: { path: 7 }, caller: caller() }),
      /HooksError: fs\.list: takes a path \(host check\)/,
    );
  } finally {
    gate();
    listGate();
  }
});

test('a handler in the chain answers an fs call first', async () => {
  const gate = installChainModule(moduleWith('fs.read', {
    name: 'fixture-fs-answer',
    tier: 'user',
    run: async () => ({ value: 'from the handler' }),
  } as unknown as ChainHandler));
  try {
    assert.equal(await raiseFsCall({ event: 'fs.read', args: { path: path.join(root, 'never-asked.txt') }, caller: caller() }), 'from the handler');
  } finally {
    gate();
  }
});

test('runFsEvent runs one filesystem event directly', async () => {
  const file = path.join(root, 'direct.txt');
  await runFsEvent({ event: 'write', path: file, text: 'direct' }, 'fixture-fs');
  assert.equal(await runFsEvent({ event: 'read', path: file }, 'fixture-fs'), 'direct');
  assert.equal(await runFsEvent({ event: 'exists', path: file }, 'fixture-fs'), true);
  assert.equal((await runFsEvent({ event: 'stat', path: file }, 'fixture-fs') as { size: number }).size, 6);
});
