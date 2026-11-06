import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { AsyncReadPermissionCheck, emptySessionPermissionUpdates, permissionDecision, prototypePermissionDecision, type PermissionPolicy } from '../src/permissions.js';
import { bindRuntimeTool, createTools, isBuiltinReadFile, type ToolDefinition } from '../src/tools.js';
import { PathApprovalCallOwner, TrustedReadContract } from '../src/path-approval-call-owner.js';
import { defaultConfig } from '../src/agent.js';
import { createRuntime } from '../src/runtime.js';

const policy: PermissionPolicy = { mode: 'bypass', allow: [], deny: [] };
const read: ToolDefinition = { schema: { name: 'read_file', input_schema: { type: 'object' } }, readOnly: true, execute: async () => '' };

test('async single-read checks real spellings, identity and cancellation', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'async-read-check-')));
  const checker = new AsyncReadPermissionCheck();
  try {
    fs.writeFileSync(path.join(root, 'one'), 'one');
    fs.writeFileSync(path.join(root, 'two'), 'two');
    fs.symlinkSync('one', path.join(root, 'alias'));
    const args = { policy: { ...policy, deny: ['Read(one)'] }, tool: read, input: { path: 'alias' }, workspace: root, toolUseId: 'call' };
    const first = await checker.check(args);
    assert.equal(first.kind, 'decision');
    if (first.kind !== 'decision') throw new Error('Expected decision');
    assert.equal(first.decision.decision, 'deny');
    assert.ok(first.observation?.spellings.includes(path.join(root, 'one')));
    if (process.platform === 'darwin') {
      const stat = fs.statSync(path.join(root, 'one'), { bigint: true });
      assert.deepEqual(first.identity, { dev: stat.dev, ino: stat.ino });
    }
    const pending = checker.check(args);
    fs.unlinkSync(path.join(root, 'alias'));
    fs.symlinkSync('two', path.join(root, 'alias'));
    const retained = await pending;
    assert.equal(retained.kind, 'decision');
    if (retained.kind === 'decision') {
      assert.equal(retained.decision.decision, 'deny');
      assert.ok(retained.observation?.spellings.includes(path.join(root, 'one')));
    }
    const second = await checker.check(args);
    assert.equal(second.kind, 'decision');
    if (second.kind !== 'decision') throw new Error('Expected decision');
    assert.equal(second.decision.decision, 'allow');
    assert.ok(second.observation?.spellings.includes(path.join(root, 'two')));
    const noId = await checker.check({ ...args, toolUseId: undefined });
    assert.equal(noId.kind, 'decision');
    if (noId.kind === 'decision') assert.equal(noId.identity, undefined);
    if (process.platform === 'darwin') {
      const during = new AbortController();
      const inFlight = checker.check({ ...args, signal: during.signal });
      during.abort();
      assert.deepEqual(await inFlight, { kind: 'cancelled' });
    }
    const cancelled = new AbortController();
    cancelled.abort();
    assert.deepEqual(await checker.check({ ...args, signal: cancelled.signal }), { kind: 'cancelled' });
    const invalid = await checker.check({ ...args, input: { path: '\0' } });
    assert.equal(invalid.kind, 'failure');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read binds tool and arguments across identity collection and preserves bare denial', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'async-read-binding-')));
  try {
    fs.writeFileSync(path.join(root, 'file'), 'one');
    const tool = { ...read, schema: { ...read.schema } };
    const args = { policy: { ...policy, deny: ['Read(file)'] }, tool, input: { path: 'file' }, workspace: root, toolUseId: 'duplicate' };
    const checker = new AsyncReadPermissionCheck();
    const pending = checker.check(args);
    tool.schema.name = 'other';
    args.workspace = os.tmpdir();
    args.input.path = 'other';
    const result = await pending;
    assert.equal(result.kind, 'decision');
    if (result.kind === 'decision') {
      assert.equal(result.decision.decision, 'deny');
      assert.equal(result.observation?.requested, path.join(root, 'file'));
    }
    const denied = await checker.check({ policy: { ...policy, deny: ['read_file'] }, tool: read,
      input: { path: '\0' }, workspace: root, toolUseId: 'duplicate' });
    assert.equal(denied.kind, 'decision');
    if (denied.kind === 'decision') assert.equal(denied.decision.reason, 'Tool denied by permission rule: read_file');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read rejects tool accessors and preserves bare denial before input and workspace', async () => {
  const checker = new AsyncReadPermissionCheck();
  let calls = 0;
  const accessorTool = { ...read, get readOnly(): boolean { calls++; throw new Error('getter executed'); } };
  const invalid = await checker.check({ policy, tool: accessorTool, input: { path: 'file' }, workspace: '.' });
  assert.equal(invalid.kind, 'failure');
  assert.equal(calls, 0);

  const input = Object.defineProperty({}, 'path', { enumerable: true, get() { calls++; throw new Error('input getter executed'); } }) as { path: string };
  const args = { policy: { ...policy, deny: ['read_file'] }, tool: read, input,
    get workspace(): string { calls++; throw new Error('workspace getter executed'); } };
  const denied = await checker.check(args);
  assert.equal(denied.kind, 'decision');
  if (denied.kind === 'decision') assert.equal(denied.decision.decision, 'deny');
  assert.equal(calls, 0);
});

test('async read preserves bare denial across session modes and policy layers', async () => {
  const checker = new AsyncReadPermissionCheck();
  const base = { ...policy, deny: ['read_file'] };
  for (const mode of [undefined, 'default', 'bypass', 'dontAsk', 'plan'] as const) {
    const session = emptySessionPermissionUpdates();
    session.mode = mode;
    const args = { policy: base, tool: read, input: { path: '\0' }, workspace: '.', session };
    const expected = permissionDecision(base, read, args.input, session, '.');
    assert.equal(expected.decision, 'deny');
    assert.deepEqual(await checker.check(args), { kind: 'decision', decision: expected, observation: undefined, identity: undefined }, String(mode));
  }
  const layered: PermissionPolicy = { ...policy, layers: [{ source: 'policySettings', root: '.', allow: [], deny: ['read_file'], ask: [], additionalDirectories: [] }] };
  const seeded = emptySessionPermissionUpdates();
  seeded.alwaysDenyRules.policySettings = ['read_file'];
  seeded.deny = ['read_file'];
  for (const session of [undefined, seeded, emptySessionPermissionUpdates()]) {
    const expected = permissionDecision(layered, read, { path: '\0' }, session, '.');
    const actual = await checker.check({ policy: layered, tool: read, input: { path: '\0' }, workspace: '.', session });
    if (expected.decision === 'deny' && expected.reason === 'Tool denied by permission rule: read_file') {
      assert.deepEqual(actual, { kind: 'decision', decision: expected, observation: undefined, identity: undefined });
    } else assert.equal(actual.kind, 'failure');
  }
});

test('async read reports argument getter errors and honors cancellation', async () => {
  const checker = new AsyncReadPermissionCheck();
  const base = { tool: read, input: { path: 'file' }, workspace: '.' };
  const throwing = { ...base, get policy(): PermissionPolicy { throw new Error('policy getter failed'); } };
  assert.deepEqual(await checker.check(throwing), { kind: 'failure', reason: 'policy getter failed' });
  const sessionThrowing = { ...base, policy, get session(): never { throw new Error('session getter failed'); } };
  assert.deepEqual(await checker.check(sessionThrowing), { kind: 'failure', reason: 'session getter failed' });
  const cancelledDuringGetter = new AbortController();
  assert.deepEqual(await checker.check({ ...base, signal: cancelledDuringGetter.signal, get policy(): PermissionPolicy {
    cancelledDuringGetter.abort();
    throw new Error('cancelled during policy getter');
  } }), { kind: 'cancelled' });
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await checker.check({ ...base, signal: controller.signal, get policy(): PermissionPolicy { throw new Error('unexpected'); } }), { kind: 'cancelled' });
});

test('async read stops reading arguments immediately after cancellation', async () => {
  const checker = new AsyncReadPermissionCheck();
  for (const field of ['policy', 'session'] as const) {
    const controller = new AbortController();
    const reads: string[] = [];
    const args = { tool: read, input: { path: 'file' }, workspace: '.', signal: controller.signal,
      get policy() { reads.push('policy'); if (field === 'policy') controller.abort(); return policy; },
      get session() { reads.push('session'); if (field === 'session') controller.abort(); return undefined; },
      get toolUseId() { reads.push('toolUseId'); return 'call'; } };
    assert.deepEqual(await checker.check(args), { kind: 'cancelled' });
    assert.deepEqual(reads, field === 'policy' ? ['policy'] : ['policy', 'session']);
  }
});

test('async read contains exceptions that cannot be converted to strings', async () => {
  const checker = new AsyncReadPermissionCheck();
  const base = { tool: read, input: { path: 'file' }, workspace: '.' };
  const brokenError = new Error('original');
  Object.defineProperty(brokenError, 'message', { get() { throw new Error('message getter'); } });
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const thrown of [Object.create(null), brokenError, revoked.proxy]) {
    const result = await checker.check({ ...base, get policy(): PermissionPolicy { throw thrown; } });
    assert.deepEqual(result, { kind: 'failure', reason: 'Unknown error' });
  }
});

test('async read gives cancellation priority across getters and policy decisions', async () => {
  const checker = new AsyncReadPermissionCheck();
  const base = { tool: read, input: { path: 'file' }, workspace: '.' };
  for (const field of ['policy', 'tool'] as const) {
    const controller = new AbortController();
    let laterReads = 0;
    const args = { ...base, policy: { ...policy, deny: ['read_file'] }, signal: controller.signal };
    Object.defineProperty(args, field, { get() {
      controller.abort();
      return field === 'policy' ? { ...policy, deny: ['read_file'] } : read;
    } });
    Object.defineProperty(args, 'input', { get() { laterReads++; throw new Error('unexpected input'); } });
    assert.deepEqual(await checker.check(args), { kind: 'cancelled' }, field);
    assert.equal(laterReads, 0);
  }
  for (const throws of [false, true]) {
    const controller = new AbortController();
    const changingPolicy: PermissionPolicy = { ...policy, get layers() {
      controller.abort();
      if (throws) throw new Error('merge failed');
      return undefined;
    }, deny: ['read_file'] };
    assert.deepEqual(await checker.check({ ...base, policy: changingPolicy, signal: controller.signal }), { kind: 'cancelled' });
  }
  const controller = new AbortController();
  let calls = 0;
  const changingPolicy: PermissionPolicy = { ...policy, get layers() {
    if (++calls > 1) controller.abort();
    return undefined;
  } };
  assert.deepEqual(await checker.check({ ...base, policy: changingPolicy, signal: controller.signal }), { kind: 'cancelled' });
});

test('async read converts non-string error messages safely', async () => {
  const checker = new AsyncReadPermissionCheck();
  for (const [message, expected] of [[42, '42'], [{ toString: () => 'object message' }, 'object message'], [{ toString() { throw new Error('conversion'); } }, 'Unknown error']] as const) {
    const error = new Error();
    Object.defineProperty(error, 'message', { value: message });
    const result = await checker.check({ tool: read, input: { path: 'file' }, workspace: '.', get policy(): PermissionPolicy { throw error; } });
    assert.equal(result.kind, 'failure');
    if (result.kind === 'failure') assert.equal(result.reason, expected);
  }
});

test('async read handles exceptional signal objects without invoking proxy traps', async () => {
  const checker = new AsyncReadPermissionCheck();
  let traps = 0;
  const signal = new Proxy(new AbortController().signal, { get() { traps++; throw new Error('signal getter failed'); } });
  const result = await checker.check({ policy, tool: read, input: { path: 'file' }, workspace: '.', signal });
  assert.equal(result.kind, 'failure');
  assert.equal(traps, 0);
  const revoked = Proxy.revocable(new AbortController().signal, {});
  revoked.revoke();
  assert.equal((await checker.check({ policy, tool: read, input: { path: 'file' }, workspace: '.', signal: revoked.proxy })).kind, 'failure');
  const controller = new AbortController();
  Object.defineProperty(controller.signal, 'aborted', { get() { throw new Error('shadow getter'); } });
  controller.abort();
  assert.deepEqual(await checker.check({ policy, tool: read, input: { path: 'file' }, workspace: '.', signal: controller.signal }), { kind: 'cancelled' });
  const throwing = { policy, tool: read, input: { path: 'file' }, workspace: '.', get signal(): AbortSignal { throw new Error('signal argument failed'); } };
  assert.deepEqual(await checker.check(throwing), { kind: 'failure', reason: 'signal argument failed' });
});

test('malformed read calls retire only their own lane while sibling checks remain pending', async () => {
  if (process.platform !== 'darwin') return;
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-isolation-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    for (const kind of ['null', 'accessor', 'proxy', 'throw', 'cancel'] as const) {
      const checker = new AsyncReadPermissionCheck();
      const sibling = checker.begin('same');
      const failing = checker.begin('same');
      const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'same' };
      assert.equal((await checker.check(base, failing)).kind, 'decision');
      const pending = checker.check(base, sibling);
      const controller = new AbortController();
      const bad = kind === 'null' ? null : kind === 'proxy' ? new Proxy(base, {}) : kind === 'accessor'
        ? { ...base, get lane() { throw new Error('lane getter'); } }
        : kind === 'throw' ? { ...base, get policy(): PermissionPolicy { throw new Error('policy failure'); } }
        : { ...base, signal: controller.signal, get policy() { controller.abort(); return policy; } };
      const result = await checker.check(bad as typeof base, failing);
      assert.equal(result.kind, kind === 'cancel' ? 'cancelled' : 'failure', kind);
      assert.deepEqual(checker.take(failing, file), { kind: 'expired' }, kind);
      assert.equal((await pending).kind, 'decision', kind);
      assert.equal(checker.take(sibling, file).kind, 'saved', kind);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane retains intersections, identity conflicts and whole-lane consumption', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-')));
  const checker = new AsyncReadPermissionCheck();
  try {
    fs.writeFileSync(path.join(root, 'one'), 'one');
    fs.writeFileSync(path.join(root, 'two'), 'two');
    fs.symlinkSync('one', path.join(root, 'alias'));
    const lane = checker.begin('same');
    const other = checker.begin('same');
    const base = { policy, tool: read, workspace: root, input: { path: 'alias' }, toolUseId: 'same' };
    assert.equal((await checker.check(base, lane)).kind, 'decision');
    assert.equal((await checker.check(base, other)).kind, 'decision');
    fs.unlinkSync(path.join(root, 'alias'));
    fs.symlinkSync('two', path.join(root, 'alias'));
    assert.equal((await checker.check(base, lane)).kind, 'decision');
    assert.equal((await checker.check({ ...base, input: { path: 'one' } }, lane)).kind, 'decision');
    const saved = checker.take(lane, path.join(root, 'alias'));
    assert.equal(saved.kind, 'saved');
    if (saved.kind === 'saved') {
      assert.ok(saved.paths.includes(path.join(root, 'alias')));
      assert.ok(!saved.paths.includes(path.join(root, 'one')));
      assert.ok(!saved.paths.includes(path.join(root, 'two')));
      if (process.platform === 'darwin') assert.equal(saved.identity, null);
    }
    assert.deepEqual(checker.take(lane, path.join(root, 'one')), { kind: 'expired' });
    const independent = checker.take(other, path.join(root, 'alias'));
    assert.equal(independent.kind, 'saved');
    if (independent.kind === 'saved') assert.ok(independent.paths.includes(path.join(root, 'one')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane retires pending take and concurrent checks', async () => {
  if (process.platform !== 'darwin') return;
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-pending-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'same' };
    const lane = checker.begin('same');
    const pending = checker.check(base, lane);
    assert.deepEqual(checker.take(lane, file), { kind: 'expired' });
    assert.equal((await pending).kind, 'cancelled');
    assert.deepEqual(checker.take(lane, file), { kind: 'expired' });
    const concurrent = checker.begin('same');
    const first = checker.check(base, concurrent);
    const second = checker.check(base, concurrent);
    assert.notEqual((await second).kind, 'decision');
    assert.equal((await first).kind, 'cancelled');
    assert.deepEqual(checker.take(concurrent, file), { kind: 'expired' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane keeps returned identity separate from the stash', async () => {
  if (process.platform !== 'darwin') return;
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-identity-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const lane = checker.begin('identity');
    const result = await checker.check({ policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'identity' }, lane);
    assert.equal(result.kind, 'decision');
    if (result.kind !== 'decision' || !result.identity) throw new Error('Expected identity');
    const stat = fs.statSync(file, { bigint: true });
    result.identity.ino = 0n;
    const saved = checker.take(lane, file);
    assert.equal(saved.kind, 'saved');
    if (saved.kind === 'saved') assert.deepEqual(saved.identity, { dev: stat.dev, ino: stat.ino });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read rejects ambiguous lane access without retaining old evidence', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-accessor-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'same' };
    for (const mode of ['throwing-signal', 'pre-abort', 'proxy'] as const) {
      const lane = checker.begin('same');
      assert.equal((await checker.check(base, lane)).kind, 'decision');
      let reads = 0;
      const controller = new AbortController();
      controller.abort();
      const args = { ...base, get lane() { reads++; return lane; },
        get signal(): AbortSignal { if (mode === 'throwing-signal') throw new Error('signal'); return controller.signal; } };
      const supplied = mode === 'proxy' ? new Proxy(args, { getOwnPropertyDescriptor() { throw new Error('trap'); } }) : args;
      assert.notEqual((await checker.check(supplied, lane)).kind, 'decision');
      assert.equal(reads, 0);
      assert.deepEqual(checker.take(lane, file), { kind: 'expired' }, mode);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane rejects intercepted abort and mixed call identities', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-binding-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'call' };
    const controller = new AbortController();
    controller.signal.addEventListener('abort', event => event.stopImmediatePropagation());
    const cancelled = checker.begin('call');
    assert.equal((await checker.check({ ...base, signal: controller.signal }, cancelled)).kind, 'decision');
    controller.abort();
    assert.equal(checker.take(cancelled, file).kind, 'expired');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane rejects mixed call identities', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-mixed-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'call' };
    for (const changed of [{ toolUseId: 'other' }, { tool: { ...read } }]) {
      const lane = checker.begin('call');
      assert.equal((await checker.check(base, lane)).kind, 'decision');
      assert.notEqual((await checker.check({ ...base, ...changed }, lane)).kind, 'decision');
      assert.equal(checker.take(lane, file).kind, 'expired');
    }
    const wrong = checker.begin('other');
    assert.notEqual((await checker.check(base, wrong)).kind, 'decision');
    assert.equal(checker.take(wrong, file).kind, 'expired');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read retires on late abort even when signal methods are replaced', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-late-abort-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const lane = checker.begin('late');
    const controller = new AbortController();
    controller.signal.removeEventListener = () => {};
    assert.equal((await checker.check({ policy, tool: read, workspace: root, input: { path: file }, signal: controller.signal, toolUseId: 'late' }, lane)).kind, 'decision');
    controller.abort();
    assert.equal(checker.take(lane, file).kind, 'expired');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane retires on signal getter and ignores replaced listener methods', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-signal-')));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'x');
    const checker = new AsyncReadPermissionCheck();
    const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'same' };
    const lane = checker.begin('same');
    await checker.check(base, lane);
    assert.equal((await checker.check({ ...base, get signal(): AbortSignal { throw new Error('signal getter'); } }, lane)).kind, 'failure');
    assert.deepEqual(checker.take(lane, file), { kind: 'expired' });
    const cleanupLane = checker.begin('same');
    const signal = new AbortController().signal;
    signal.removeEventListener = () => { throw new Error('cleanup'); };
    assert.equal((await checker.check({ ...base, signal }, cleanupLane)).kind, 'decision');
    assert.equal(checker.take(cleanupLane, file).kind, 'saved');
    const cancelledLane = checker.begin('same');
    const controller = new AbortController();
    controller.signal.removeEventListener = () => { controller.abort(); throw new Error('cleanup'); };
    assert.equal((await checker.check({ ...base, signal: controller.signal }, cancelledLane)).kind, 'decision');
    assert.equal(checker.take(cancelledLane, file).kind, 'saved');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read lane records screenshot alternate and retires failed or cancelled checks', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'read-lane-alt-')));
  const checker = new AsyncReadPermissionCheck();
  try {
    const file = path.join(root, 'Screen 10 AM.png');
    const alternate = path.join(root, 'Screen 10 AM.png');
    fs.writeFileSync(file, 'one');
    fs.writeFileSync(alternate, 'two');
    const base = { policy, tool: read, workspace: root, input: { path: file }, toolUseId: 'same' };
    const lane = checker.begin('same');
    assert.equal((await checker.check(base, lane)).kind, 'decision');
    const result = checker.take(lane, file, alternate);
    assert.equal(result.kind, 'saved');
    if (result.kind === 'saved' && process.platform === 'darwin') {
      const stat = fs.statSync(alternate, { bigint: true });
      assert.deepEqual(result.alternateIdentity, { dev: stat.dev, ino: stat.ino });
    }
    const failed = checker.begin('same');
    assert.equal((await checker.check({ ...base, input: { path: '\0' } }, failed)).kind, 'failure');
    assert.deepEqual(checker.take(failed, file), { kind: 'expired' });
    const cancelled = checker.begin('same');
    const controller = new AbortController();
    const pending = checker.check({ ...base, signal: controller.signal }, cancelled);
    controller.abort();
    assert.equal((await pending).kind, 'cancelled');
    assert.deepEqual(checker.take(cancelled, file), { kind: 'expired' });
    const alreadyCancelled = checker.begin('same');
    assert.equal((await checker.check({ ...base, signal: controller.signal }, alreadyCancelled)).kind, 'cancelled');
    assert.deepEqual(checker.take(alreadyCancelled, file), { kind: 'expired' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('async read keeps duplicate provider IDs independent after cancellation and failure', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'async-read-concurrent-')));
  try {
    fs.writeFileSync(path.join(root, 'one'), 'one');
    fs.writeFileSync(path.join(root, 'two'), 'two');
    const checker = new AsyncReadPermissionCheck();
    const controller = new AbortController();
    const base = { policy, tool: read, workspace: root, toolUseId: 'same' };
    const cancelled = checker.check({ ...base, input: { path: 'one' }, signal: controller.signal });
    const allowed = checker.check({ ...base, input: { path: 'two' } });
    controller.abort();
    const [first, second] = await Promise.all([cancelled, allowed]);
    if (process.platform === 'darwin') assert.equal(first.kind, 'cancelled');
    assert.equal(second.kind, 'decision');
    if (second.kind === 'decision') {
      assert.equal(second.decision.decision, 'allow');
      assert.equal(second.observation?.requested, path.join(root, 'two'));
    }
    assert.equal((await checker.check({ ...base, input: { path: '\0' } })).kind, 'failure');
    const retry = await checker.check({ ...base, input: { path: 'one' } });
    assert.equal(retry.kind, 'decision');
    if (retry.kind === 'decision') assert.equal(retry.observation?.requested, path.join(root, 'one'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('prototype preserves early denial and isolates the input snapshot', () => {
  const input = { path: '\0', nested: { value: 'original' } };
  const denied = { ...policy, deny: ['read_file'] };
  const expected = permissionDecision(denied, read, input);
  const result = prototypePermissionDecision(denied, read, input);
  assert.equal(result.kind, 'observed');
  if (result.kind !== 'observed') return;
  assert.equal(result.coverage, 'partial-host-short-circuit');
  assert.deepEqual(result.decision, expected);
  assert.equal(result.decision.reason, 'Tool denied by permission rule: read_file');
  assert.deepEqual(result.observations, []);
  input.nested.value = 'changed';
  assert.deepEqual(result.input, { path: '\0', nested: { value: 'original' } });
});

test('prototype captures real single and multiple path observations without sharing decision state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-observation-'));
  try {
    fs.writeFileSync(path.join(root, 'one'), 'one');
    fs.writeFileSync(path.join(root, 'two'), 'two');
    fs.symlinkSync('one', path.join(root, 'alias'));
    const input = { path: 'alias', nested: { value: 'original' } };
    const single = prototypePermissionDecision(policy, read, input, undefined, root);
    assert.equal(single.kind, 'observed');
    if (single.kind !== 'observed') return;
    assert.deepEqual(single.decision, permissionDecision(policy, read, input, undefined, root));
    const observed = single.observations[0];
    assert.ok(observed && !observed.unresolved);
    assert.equal(observed.landing, fs.realpathSync(path.join(root, 'one')));
    Reflect.set(observed.hostRuleSpellings, '0', 'changed');
    assert.equal(single.decision.decision, 'allow');
    const multi: ToolDefinition = { ...read, schema: { ...read.schema, name: 'send_file' },
      readPaths(value) {
        input.path = 'two';
        if (typeof value === 'object' && value !== null && 'path' in value) Object.assign(value, { path: 'two' });
        return ['alias', 'two'];
      } };
    const result = prototypePermissionDecision(policy, multi, input, undefined, root);
    assert.equal(result.kind, 'observed');
    if (result.kind !== 'observed') return;
    assert.deepEqual(result.input, { path: 'alias', nested: { value: 'original' } });
    assert.deepEqual(result.observations.map(item => item.requested), [path.join(root, 'alias'), path.join(root, 'two')]);
    assert.equal(result.decision.decision, 'allow');
    const deniedPolicy = { ...policy, deny: ['Read(two)'] };
    const denied = prototypePermissionDecision(deniedPolicy, multi, { path: 'alias' }, undefined, root);
    assert.equal(denied.kind, 'observed');
    if (denied.kind !== 'observed') return;
    assert.equal(denied.decision.decision, 'deny');
    assert.deepEqual(denied.observations.map(item => item.requested), [path.join(root, 'alias'), path.join(root, 'two')]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('single-read handoff accepts only the checked input and its single resolved observation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-handoff-'));
  const owner = new PathApprovalCallOwner();
  const call = owner.begin('handoff');
  try {
    fs.writeFileSync(path.join(root, 'public'), 'public');
    fs.symlinkSync('public', path.join(root, 'alias'));
    const result = prototypePermissionDecision(policy, read, { path: 'alias' }, undefined, root);
    assert.equal(result.kind, 'observed');
    if (result.kind !== 'observed') throw new Error('Expected observation');
    const observation = result.observations[0];
    assert.ok(observation && !observation.unresolved);
    const stat = fs.statSync(observation.landing, { bigint: true });
    const identity = { dev: stat.dev, ino: stat.ino };
    const proxy = new Proxy({ path: 'alias' }, { getOwnPropertyDescriptor() { throw new Error('proxy trap'); } });
    for (const [input, observations] of [
      [proxy, result.observations],
      [{ path: 'public' }, result.observations],
      [result.input, []],
      [result.input, [...result.observations, observation]],
    ] as const) {
      const incomplete = owner.begin('incomplete');
      try {
        assert.equal(incomplete.recordObservedRead(result.input, root, result.observations, identity), 'recorded');
        assert.equal(incomplete.recordObservedRead(input, root, observations, identity), 'incomplete');
        assert.deepEqual(incomplete.takeVerifiedRead(observation.requested), { kind: 'expired' });
        assert.throws(() => incomplete.recordObservedRead(result.input, root, result.observations, identity), /sealed/);
      } finally { incomplete.finish('denied'); }
    }
    assert.equal(call.recordObservedRead(result.input, root, result.observations, identity), 'recorded');
    assert.deepEqual(call.takeVerifiedRead(observation.requested), { kind: 'saved', paths: observation.spellings, identity });
  } finally {
    call.finish('success');
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(owner.activeCalls, 0);
});

test('single-read evidence rejects caller-supplied identity and cross-call reuse', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-evidence-'));
  const owner = new PathApprovalCallOwner();
  try {
    fs.writeFileSync(path.join(root, 'public'), 'public');
    fs.writeFileSync(path.join(root, 'protected'), 'protected');
    const result = prototypePermissionDecision(policy, read, { path: 'public' }, undefined, root);
    if (result.kind !== 'observed') throw new Error('Expected observation');
    const stat = fs.statSync(path.join(root, 'protected'), { bigint: true });
    for (const id of ['first', 'second']) {
      const call = owner.begin(id);
      try {
        assert.equal(call.recordObservedRead(result.input, root, result.observations, { dev: stat.dev, ino: stat.ino }), 'incomplete', id);
      } finally { call.finish('denied'); }
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('single-read handoff rejects changed observations and clears prior snapshots after exceptions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-handoff-tamper-'));
  const owner = new PathApprovalCallOwner();
  const call = owner.begin('tamper');
  try {
    fs.writeFileSync(path.join(root, 'public'), 'public');
    fs.writeFileSync(path.join(root, 'protected'), 'protected');
    const result = prototypePermissionDecision(policy, read, { path: 'public' }, undefined, root);
    assert.equal(result.kind, 'observed');
    if (result.kind !== 'observed') throw new Error('Expected observation');
    const observation = result.observations[0];
    assert.ok(observation && !observation.unresolved);
    const stat = fs.statSync(observation.landing, { bigint: true });
    const identity = { dev: stat.dev, ino: stat.ino };
    assert.equal(call.recordObservedRead(result.input, root, result.observations, identity), 'recorded');
    const throwing = new Proxy(result.observations, { get() { throw new Error('observation trap'); } });
    assert.equal(call.recordObservedRead(result.input, root, throwing, identity), 'incomplete');
    assert.deepEqual(call.takeVerifiedRead(observation.requested), { kind: 'expired' });
    const changed = owner.begin('changed');
    try {
      Reflect.set(observation.spellings, observation.spellings.length, path.join(root, 'protected'));
      assert.equal(changed.recordObservedRead(result.input, root, result.observations, identity), 'incomplete');
      assert.deepEqual(changed.takeVerifiedRead(observation.requested), { kind: 'expired' });
    } finally { changed.finish('denied'); }
    const denied = prototypePermissionDecision({ ...policy, deny: ['Read(public)'] }, read, { path: 'public' }, undefined, root);
    assert.equal(denied.kind, 'observed');
    if (denied.kind !== 'observed') throw new Error('Expected observation');
    assert.equal(denied.decision.decision, 'deny');
    const deniedCall = owner.begin('denied');
    try {
      assert.equal(deniedCall.recordObservedRead(denied.input, root, denied.observations, identity), 'incomplete');
      assert.deepEqual(deniedCall.takeVerifiedRead(observation.requested), { kind: 'expired' });
    } finally { deniedCall.finish('denied'); }
  } finally { call.finish('denied'); fs.rmSync(root, { recursive: true, force: true }); }
});

test('builtin read identity rejects lookalikes, copies and replaced execution', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'builtin-read-'));
  try {
    fs.writeFileSync(path.join(root, 'file'), 'public');
    const builtin = createTools().find(tool => tool.schema.name === 'read_file');
    const rebuilt = createTools().find(tool => tool.schema.name === 'read_file');
    assert.ok(builtin);
    assert.ok(rebuilt);
    assert.equal(isBuiltinReadFile(builtin), true);
    assert.equal(isBuiltinReadFile(rebuilt), true);
    assert.equal(isBuiltinReadFile(read), false);
    assert.equal(isBuiltinReadFile({ ...builtin }), false);
    assert.equal(isBuiltinReadFile(Object.create(builtin)), false);
    assert.match(await builtin.execute({ path: 'file' }, {
      workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000,
    }), /public/);
    const execute = builtin.execute;
    builtin.execute = async () => 'replacement';
    assert.equal(isBuiltinReadFile(builtin), false);
    builtin.execute = execute;
    assert.equal(isBuiltinReadFile(builtin), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('caller-controlled runtime wrapper cannot obtain trusted read authority', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-read-untrusted-'));
  const call = new PathApprovalCallOwner().begin('untrusted-wrapper');
  const parent = createTools().find(tool => tool.schema.name === 'read_file');
  assert.ok(parent);
  fs.writeFileSync(path.join(root, 'file'), 'public');
  const original = parent.execute;
  let invoked = false;
  const wrapped = bindRuntimeTool(parent, {
    checkScope() {},
    refresh() { parent.execute = async () => { invoked = true; return 'attacker'; }; },
    checkJournal() {},
  });
  try {
    assert.equal(isBuiltinReadFile(parent), true);
    assert.equal(await new TrustedReadContract(call, wrapped).observe(policy, { path: 'file' }, root), false);
    assert.equal(await wrapped.execute({ path: 'file' }, {
      workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000,
    }), 'attacker');
    assert.equal(invoked, true);
    assert.equal(isBuiltinReadFile(wrapped), false);
  } finally {
    parent.execute = original;
    call.finish('success');
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runtime-bound read executes real files without trusted read authority', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-read-binding-')));
  const controller = new AbortController();
  const owner = new PathApprovalCallOwner();
  const call = owner.begin('runtime-wrapper');
  const config = defaultConfig(root, createTools());
  const runtime = await createRuntime(config, {
    count: async () => 0,
    complete: async () => { throw new Error('model must not be called'); },
  }, controller.signal);
  try {
    fs.writeFileSync(path.join(root, 'file'), 'runtime file content');
    const builtin = createTools().find(tool => tool.schema.name === 'read_file');
    const wrapped = runtime.buildTools(config, 'runtime-wrapper').find(tool => tool.schema.name === 'read_file');
    assert.ok(builtin);
    assert.ok(wrapped);
    const substitute: ToolDefinition = { ...wrapped, execute: async () => 'substitute' };
    const context = { workspace: root, signal: controller.signal, allowShell: false, maxOutputBytes: 24000 };
    assert.equal(isBuiltinReadFile(builtin), true);
    assert.equal(isBuiltinReadFile(wrapped), false);
    const forked = runtime.buildTools(config, 'runtime-child').find(tool => tool.schema.name === 'read_file');
    assert.ok(forked);
    assert.notEqual(forked, wrapped);
    assert.equal(isBuiltinReadFile(forked), false);
    assert.match(await forked.execute({ path: 'file' }, context), /runtime file content/);
    assert.equal(isBuiltinReadFile(substitute), false);
    assert.equal(await new TrustedReadContract(call, builtin).observe(policy, { path: 'file' }, root), true);
    assert.equal(await new TrustedReadContract(call, wrapped).observe(policy, { path: 'file' }, root), false);
    assert.equal(await new TrustedReadContract(call, substitute).observe(policy, { path: 'file' }, root), false);
    assert.match(await wrapped.execute({ path: 'file' }, context), /runtime file content/);
    assert.equal(await substitute.execute({ path: 'file' }, context), 'substitute');
    const original = wrapped.execute;
    try {
      wrapped.execute = async () => 'replacement';
      assert.equal(isBuiltinReadFile(wrapped), false);
      assert.equal(await wrapped.execute({ path: 'file' }, context), 'replacement');
    } finally { wrapped.execute = original; }
    assert.equal(isBuiltinReadFile(wrapped), false);
    assert.match(await wrapped.execute({ path: 'file' }, context), /runtime file content/);
    assert.equal(fs.readFileSync(path.join(root, 'file'), 'utf8'), 'runtime file content');
  } finally {
    call.finish('success');
    await runtime.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(owner.activeCalls, 0);
});

test('runtime wrapper stays untrusted and preserves child caching and callback order', async () => {
  const parent = createTools().find(tool => tool.schema.name === 'read_file');
  assert.ok(parent);
  const events: string[] = [];
  const checks = { checkScope: () => { events.push('scope'); }, refresh: () => { events.push('refresh'); }, checkJournal: () => { events.push('journal'); } };
  const wrapped = bindRuntimeTool(parent, checks);
  assert.equal(isBuiltinReadFile(wrapped), false);
  const original = parent.execute;
  parent.execute = async () => 'replacement';
  assert.equal(isBuiltinReadFile(wrapped), false);
  parent.execute = original;
  const description = parent.schema.description;
  parent.schema.description = 'changed';
  assert.equal(isBuiltinReadFile(wrapped), false);
  parent.schema.description = description;
  const schema = wrapped.schema;
  wrapped.schema = { ...schema, description: 'changed' };
  assert.equal(isBuiltinReadFile(wrapped), false);
  wrapped.schema = schema;
  assert.equal(isBuiltinReadFile(wrapped), false);
  const fake = { ...parent, execute: async () => 'fake' };
  assert.equal(isBuiltinReadFile(bindRuntimeTool(fake, checks)), false);
  const withChild: ToolDefinition = { ...fake, forChild: () => fake, executeBlocks: async () => 'blocks' };
  const bound = bindRuntimeTool(withChild, checks);
  assert.equal(bound.forChild?.(), bound.forChild?.());
  assert.equal(isBuiltinReadFile(bound.forChild!()), false);
  events.length = 0;
  const context = { workspace: '.', signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100 };
  assert.equal(await bound.execute({}, context), 'fake');
  assert.deepEqual(events, ['scope', 'refresh', 'journal']);
  events.length = 0;
  assert.equal(await bound.executeBlocks?.({}, context), 'blocks');
  assert.deepEqual(events, ['scope', 'journal']);
});

test('trusted read collects identity itself and binds call, tool, cancellation and single use', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-read-'));
  const owner = new PathApprovalCallOwner();
  const call = owner.begin('same');
  const other = owner.begin('same');
  try {
    fs.writeFileSync(path.join(root, 'file'), 'public');
    const builtin = createTools().find(tool => tool.schema.name === 'read_file');
    assert.ok(builtin);
    const fake = new TrustedReadContract(call, read);
    assert.equal(await fake.observe(policy, { path: 'file' }, root), false);
    const contract = new TrustedReadContract(call, builtin);
    assert.equal(await contract.observe(policy, { path: 'file' }, root), true);
    assert.equal(contract.take(other, builtin), undefined);
    assert.equal(contract.take(call, builtin), undefined);
    const stable = new TrustedReadContract(call, builtin);
    assert.equal(await stable.observe(policy, { path: 'file' }, root), true);
    const snapshot = stable.take(call, builtin);
    assert.ok(snapshot);
    const stat = fs.statSync(path.join(root, 'file'), { bigint: true });
    assert.deepEqual(snapshot.identity, { dev: stat.dev, ino: stat.ino });
    assert.equal(stable.take(call, builtin), undefined);
    const replacementTool = { ...builtin };
    const substitute = new TrustedReadContract(call, builtin);
    assert.equal(await substitute.observe(policy, { path: 'file' }, root), true);
    assert.equal(substitute.take(call, replacementTool), undefined);
    const controller = new AbortController();
    const cancelled = new TrustedReadContract(call, builtin);
    assert.equal(await cancelled.observe(policy, { path: 'file' }, root, controller.signal), true);
    controller.abort();
    assert.equal(cancelled.take(call, builtin), undefined);
    call.record('read', snapshot.requested, snapshot.paths, { dev: 9n, ino: 9n });
    const independent = new TrustedReadContract(call, builtin);
    assert.equal(independent.take(call, builtin), undefined);
  } finally { call.finish('success'); other.finish('success'); fs.rmSync(root, { recursive: true, force: true }); }
});

test('schema getter cannot impersonate a builtin read', () => {
  const tool = createTools().find(item => item.schema.name === 'read_file');
  assert.ok(tool);
  const original = tool.schema.description;
  const replacement = async () => 'replacement';
  Object.defineProperty(tool.schema, 'description', { configurable: true, enumerable: true, get() {
    tool.execute = replacement;
    return original;
  } });
  assert.equal(isBuiltinReadFile(tool), false);
});

test('trusted read rejects policy revoked after observation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-read-policy-'));
  const call = new PathApprovalCallOwner().begin('policy');
  try {
    fs.writeFileSync(path.join(root, 'file'), 'public');
    const tool = createTools().find(item => item.schema.name === 'read_file');
    assert.ok(tool);
    const live = { ...policy, deny: [] as string[] };
    const contract = new TrustedReadContract(call, tool);
    assert.equal(await contract.observe(live, { path: 'file' }, root), true);
    live.deny.push('Read(file)');
    await assert.rejects(contract.open(call, tool));
    let current = { ...policy, deny: [] as string[] };
    const replaced = new TrustedReadContract(call, tool);
    assert.equal(await replaced.observe(() => current, { path: 'file' }, root), true);
    current = { ...current, deny: ['Read(file)'] };
    await assert.rejects(replaced.open(call, tool));
  } finally { call.finish('success'); fs.rmSync(root, { recursive: true, force: true }); }
});

test('trusted read rechecks lifecycle and tool after final policy callback and closes the real handle', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-read-reentry-'));
  try {
    const file = path.join(root, 'file');
    fs.writeFileSync(file, 'public');
    const target = fs.statSync(file, { bigint: true });
    for (const action of ['abort', 'finish', 'execute'] as const) {
      const call = new PathApprovalCallOwner().begin(action);
      const controller = new AbortController();
      const tool = createTools().find(item => item.schema.name === 'read_file');
      assert.ok(tool);
      let calls = 0;
      let openedFd: number | undefined;
      const contract = new TrustedReadContract(call, tool);
      const currentPolicy = () => {
        if (++calls === 3) {
          openedFd = fs.readdirSync('/dev/fd').map(Number).find(fd => {
            try {
              const stat = fs.fstatSync(fd, { bigint: true });
              return stat.dev === target.dev && stat.ino === target.ino;
            } catch { return false; }
          });
          assert.notEqual(openedFd, undefined);
          if (action === 'abort') controller.abort();
          if (action === 'finish') call.finish('cancelled');
          if (action === 'execute') tool.execute = async () => 'replacement';
        }
        return policy;
      };
      try {
        assert.equal(await contract.observe(currentPolicy, { path: 'file' }, root, controller.signal), true);
        await assert.rejects(contract.open(call, tool));
        assert.equal(calls, 3);
        assert.notEqual(openedFd, undefined);
        assert.throws(() => fs.fstatSync(openedFd!), { code: 'EBADF' });
      } finally { call.finish('success'); }
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('trusted read observation rejects a path getter without executing it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-read-getter-'));
  const call = new PathApprovalCallOwner().begin('getter');
  try {
    fs.writeFileSync(path.join(root, 'file'), 'public');
    const tool = createTools().find(item => item.schema.name === 'read_file');
    assert.ok(tool);
    let calls = 0;
    const input = { get path() { calls++; return 'file'; } };
    const contract = new TrustedReadContract(call, tool);
    assert.equal(await contract.observe(policy, input, root), false);
    assert.equal(calls, 0);
    assert.equal(contract.take(call, tool), undefined);
  } finally { call.finish('success'); fs.rmSync(root, { recursive: true, force: true }); }
});

test('trusted read rejects a renamed built-in and execution replaced while observing', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-read-mutation-'));
  const call = new PathApprovalCallOwner().begin('mutation');
  try {
    fs.writeFileSync(path.join(root, 'file'), 'public');
    const tool = createTools().find(item => item.schema.name === 'read_file');
    assert.ok(tool);
    const originalName = tool.schema.name;
    tool.schema.name = 'other';
    assert.equal(isBuiltinReadFile(tool), false);
    assert.equal(await new TrustedReadContract(call, tool).observe({ ...policy, deny: ['Read(file)'] }, { path: 'file' }, root), false);
    tool.schema.name = originalName;
    const originalExecute = tool.execute;
    const contract = new TrustedReadContract(call, tool);
    const pending = contract.observe(policy, { path: 'file' }, root);
    tool.execute = async () => 'replacement';
    assert.equal(await pending, false);
    tool.execute = originalExecute;
    assert.equal(contract.take(call, tool), undefined);
  } finally { call.finish('success'); fs.rmSync(root, { recursive: true, force: true }); }
});

test('prototype rejects unsupported inputs without executing getters or sharing memory', () => {
  let calls = 0;
  const input = Object.defineProperty({}, 'path', { enumerable: true, get() { calls++; throw new Error('getter'); } });
  const denied = { ...policy, deny: ['read_file'] };
  assert.equal(permissionDecision(denied, read, input).decision, 'deny');
  assert.equal(prototypePermissionDecision(denied, read, input).kind, 'unsupported-input');
  assert.equal(calls, 0);
  assert.equal(prototypePermissionDecision(policy, read, { bytes: new SharedArrayBuffer(4) }).kind, 'unsupported-input');
  assert.equal(prototypePermissionDecision(policy, read, { callback() {} }).kind, 'unsupported-input');
});

test('prototype rejects top-level and nested proxies without triggering traps', () => {
  let traps = 0;
  const makeProxy = () => new Proxy({}, {
    getPrototypeOf() { traps++; throw new Error('proxy trap'); },
    ownKeys() { traps++; throw new Error('proxy trap'); },
  });
  for (const input of [makeProxy(), { nested: makeProxy() }, [makeProxy()]]) {
    assert.equal(prototypePermissionDecision(policy, read, input).kind, 'unsupported-input');
  }
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.equal(prototypePermissionDecision(policy, read, { nested: revoked.proxy }).kind, 'unsupported-input');
  assert.equal(traps, 0);
});

test('prototype preserves null prototypes in snapshots and readPaths inputs', () => {
  const nested = Object.assign(Object.create(null), { value: 'original' });
  const input = Object.assign(Object.create(null), { nested });
  const tool: ToolDefinition = { ...read, schema: { ...read.schema, name: 'send_file' },
    readPaths(value) {
      assert.ok(typeof value === 'object' && value !== null);
      assert.equal(Object.getPrototypeOf(value), null);
      const child = Reflect.get(value, 'nested');
      assert.ok(typeof child === 'object' && child !== null);
      assert.equal(Object.getPrototypeOf(child), null);
      return [];
    } };
  const result = prototypePermissionDecision(policy, tool, input);
  assert.equal(result.kind, 'observed');
  if (result.kind !== 'observed') return;
  assert.equal(result.decision.decision, 'allow');
  assert.equal(result.coverage, 'partial-host-short-circuit');
  assert.ok(typeof result.input === 'object' && result.input !== null);
  assert.equal(Object.getPrototypeOf(result.input), null);
  assert.equal(Object.getPrototypeOf(Reflect.get(result.input, 'nested')), null);
});

test('prototype contains readPaths getter errors in the permission decision', () => {
  const tool: ToolDefinition = { ...read, get readPaths(): ToolDefinition['readPaths'] { throw new Error('readPaths getter'); } };
  const expected = permissionDecision(policy, tool, {});
  assert.equal(expected.decision, 'deny');
  const result = prototypePermissionDecision(policy, tool, {});
  assert.equal(result.kind, 'observed');
  if (result.kind !== 'observed') return;
  assert.deepEqual(result.decision, expected);
  assert.equal(result.coverage, 'partial-host-short-circuit');
});

test('prototype preserves first-path denial before a later array getter', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-lazy-'));
  try {
    fs.writeFileSync(path.join(root, 'one'), 'one');
    let laterReads = 0;
    const input = { nested: { value: 'original' } };
    const tool: ToolDefinition = { ...read, schema: { ...read.schema, name: 'send_file' },
      readPaths(value) {
        assert.equal(this, tool);
        assert.ok(typeof value === 'object' && value !== null && 'nested' in value);
        const nested = value.nested;
        assert.ok(typeof nested === 'object' && nested !== null);
        Object.assign(nested, { value: 'changed' });
        const paths = ['one', 'two'];
        Object.defineProperty(paths, '1', { get() { laterReads++; throw new Error('later path getter'); } });
        return paths;
      } };
    const denied = { ...policy, deny: ['Read(one)'] };
    const expected = permissionDecision(denied, tool, { nested: { value: 'original' } }, undefined, root);
    assert.equal(expected.reason, 'Tool denied by permission rule: read_file');
    const result = prototypePermissionDecision(denied, tool, input, undefined, root);
    assert.equal(result.kind, 'observed');
    if (result.kind !== 'observed') return;
    assert.deepEqual(result.decision, expected);
    assert.equal(laterReads, 0);
    assert.deepEqual(input, { nested: { value: 'original' } });
    assert.deepEqual(result.input, input);
    assert.equal(result.coverage, 'partial-host-short-circuit');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('prototype keeps readPaths receiver and declares short-circuit coverage', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'permission-coverage-'));
  try {
    fs.writeFileSync(path.join(root, 'one'), 'one');
    fs.writeFileSync(path.join(root, 'two'), 'two');
    const tool: ToolDefinition = { ...read, schema: { ...read.schema, name: 'send_file' },
      readPaths() { assert.equal(this, tool); return ['one', 'two']; } };
    const result = prototypePermissionDecision({ ...policy, deny: ['Read(one)'] }, tool, {}, undefined, root);
    assert.equal(result.kind, 'observed');
    if (result.kind !== 'observed') return;
    assert.equal(result.decision.decision, 'deny');
    assert.equal(result.coverage, 'partial-host-short-circuit');
    assert.ok(!result.observations.some(item => item.requested === path.join(root, 'two')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
