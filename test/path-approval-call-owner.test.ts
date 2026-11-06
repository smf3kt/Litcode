import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PathApprovalCallOwner } from '../src/path-approval-call-owner.js';

test('same provider IDs remain isolated across concurrent calls, lanes and rewritten paths', () => {
  const owner = new PathApprovalCallOwner();
  const first = owner.begin('provider-id');
  const second = owner.begin('provider-id');
  const paths = ['/alias', '/old'];
  first.record('read', '/alias', paths, { dev: 1n, ino: 9007199254740992n });
  paths.push('/mutated');
  first.record('read', '/alias', ['/alias', '/new'], { dev: 1n, ino: 9007199254740993n });
  first.record('read', '/rewritten', ['/rewritten']);
  first.record('write', '/alias', ['/write']);
  second.record('read', '/alias', ['/second']);
  assert.deepEqual(first.take('read', '/alias'), { kind: 'expired' });
  assert.deepEqual(first.take('read', '/alias'), { kind: 'expired' });
  assert.deepEqual(first.take('read', '/rewritten'), { kind: 'saved', paths: ['/rewritten'], identity: undefined });
  assert.deepEqual(first.take('write', '/alias'), { kind: 'saved', paths: ['/write'], identity: undefined });
  assert.deepEqual(second.take('read', '/alias'), { kind: 'saved', paths: ['/second'], identity: undefined });
  first.finish('success');
  second.finish('success');
  const later = owner.begin('provider-id');
  assert.deepEqual(later.take('read', '/alias'), { kind: 'expired' });
  later.finish('success');
  assert.equal(owner.activeCalls, 0);
});

test('verified reads reject absent or missing identities and consume each snapshot once', () => {
  const owner = new PathApprovalCallOwner();
  const call = owner.begin('read');
  call.record('read', '/missing-identity', ['/missing-identity']);
  assert.deepEqual(call.takeVerifiedRead('/missing-identity'), { kind: 'expired' });
  call.record('read', '/null-identity', ['/null-identity'], null);
  assert.deepEqual(call.takeVerifiedRead('/null-identity'), { kind: 'expired' });
  call.record('read', '/valid', ['/valid', '/physical'], { dev: 1n, ino: 2n });
  assert.deepEqual(call.takeVerifiedRead('/valid'), {
    kind: 'saved', paths: ['/valid', '/physical'], identity: { dev: 1n, ino: 2n },
  });
  assert.deepEqual(call.takeVerifiedRead('/valid'), { kind: 'expired' });
  call.record('read', '/zero', ['/zero'], { dev: 0n, ino: 0n });
  assert.deepEqual(call.takeVerifiedRead('/zero'), {
    kind: 'saved', paths: ['/zero'], identity: { dev: 0n, ino: 0n },
  });
  assert.deepEqual(call.takeVerifiedRead('/zero'), { kind: 'expired' });
  call.finish('success');
  assert.throws(() => call.takeVerifiedRead('/zero'), /ended/);
  assert.equal(owner.activeCalls, 0);
});

test('a missing snapshot seals its lane against later records', () => {
  const call = new PathApprovalCallOwner().begin('same');
  assert.deepEqual(call.take('read', '/missing'), { kind: 'expired' });
  assert.throws(() => call.record('read', '/missing', ['/missing']), /sealed/);
  call.record('write', '/other', ['/other']);
  assert.deepEqual(call.take('write', '/other'), { kind: 'saved', paths: ['/other'], identity: undefined });
  call.finish('error');
});

test('rechecking an evicted path cannot restore a discarded intersection', () => {
  const owner = new PathApprovalCallOwner(1, 0);
  const a = owner.begin('a');
  const b = owner.begin('b');
  a.record('read', '/a', ['/a', '/old']);
  b.record('read', '/b', ['/b']);
  a.record('read', '/a', ['/a', '/new']);
  assert.deepEqual(a.take('read', '/a'), { kind: 'expired' });
  a.finish('error');
  b.finish('success');
});

test('identity eviction and a later missing identity remain uncertain', () => {
  const owner = new PathApprovalCallOwner(1, 0);
  const a = owner.begin('a');
  const b = owner.begin('b');
  a.record('read', '/a', ['/a'], { dev: 1n, ino: 1n });
  b.record('write', '/b', ['/b'], { dev: 2n, ino: 2n });
  assert.deepEqual(a.take('read', '/a'), { kind: 'expired' });
  a.finish('error');
  b.finish('success');
});

test('a repeated record with missing identity cannot retain a prior identity', () => {
  const c = new PathApprovalCallOwner().begin('c');
  c.record('read', '/c', ['/c'], { dev: 1n, ino: 1n });
  c.record('read', '/c', ['/c']);
  assert.deepEqual(c.take('read', '/c'), { kind: 'expired' });
  c.finish('error');
});

test('identity pressure remains bounded across active calls', () => {
  const owner = new PathApprovalCallOwner(1, 0);
  const a = owner.begin('a');
  const b = owner.begin('b');
  a.record('read', '/a', ['/a'], { dev: 1n, ino: 1n });
  b.record('write', '/b', ['/b'], { dev: 2n, ino: 2n });
  const c = owner.begin('c');
  assert.throws(() => c.record('read', '/c', ['/c'], { dev: 3n, ino: 3n }), /capacity/);
  a.finish('error'); b.finish('error');
  c.record('read', '/c', ['/c'], { dev: 3n, ino: 3n });
  assert.deepEqual(c.take('read', '/c'), { kind: 'expired' });
  c.finish('error');
});

test('eviction and poison fail closed, and every terminal outcome releases its call', () => {
  const owner = new PathApprovalCallOwner(1, 0);
  const first = owner.begin('same');
  const second = owner.begin('same');
  first.record('read', '/one', ['/one']);
  second.record('read', '/two', ['/two']);
  assert.deepEqual(first.take('read', '/one'), { kind: 'expired' });
  assert.deepEqual(second.take('read', '/two'), { kind: 'saved', paths: ['/two'], identity: undefined });
  first.finish('denied');
  second.finish('cancelled');
  const third = owner.begin('same');
  third.record('write', '/three', ['/three']);
  assert.throws(() => third.record('write', '/four', ['/four']), /capacity/);
  third.finish('error');
  third.finish('success');
  assert.throws(() => third.take('write', '/three'), /ended/);
  const fourth = owner.begin('same');
  fourth.record('write', '/four', ['/four']);
  assert.deepEqual(fourth.take('write', '/four'), { kind: 'saved', paths: ['/four'], identity: undefined });
  fourth.finish('success');
  assert.equal(owner.activeCalls, 0);
});
