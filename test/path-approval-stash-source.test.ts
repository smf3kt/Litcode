import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Be, j8e } from '../src/path-approval-stash-source.js';
import { createPathApprovalConsumer } from '../src/path-approval-consumer-source.js';

test('approval snapshots intersect repeated checks and isolate call and operation lanes', () => {
  const stash = new Be();
  stash.stash('one', '/alias', ['/alias', '/first'], 'read');
  stash.stash('one', '/alias', ['/alias', '/second'], 'read');
  stash.stash('one', '/sibling', ['/sibling'], 'read');
  stash.stash('one', '/alias', ['/write'], 'write');
  stash.stash('two', '/alias', ['/other'], 'read');
  assert.equal(stash.holds('one', '/alias', 'read'), true);
  assert.deepEqual(stash.consume('one', '/alias', 'read'), ['/alias']);
  assert.equal(stash.holds('one', '/sibling', 'read'), false);
  assert.equal(stash.consume('one', '/sibling', 'read'), undefined);
  assert.deepEqual(stash.consume('one', '/alias', 'write'), ['/write']);
  assert.deepEqual(stash.consume('two', '/alias', 'read'), ['/other']);
  stash.stash(undefined, '/alias', ['/unused'], 'read');
  assert.equal(stash.consume(undefined, '/alias', 'read'), undefined);

  stash.stashIdentity('write-kept', '/alias', { dev: 1, ino: 2 });
  stash.stash('write-kept', '/alias', ['/write'], 'write');
  assert.deepEqual(stash.consume('write-kept', '/alias', 'write'), ['/write']);
  assert.deepEqual(stash.takeIdentity('write-kept', '/alias'), { dev: 1, ino: 2 });
  stash.stashIdentity('same', '/alias', { dev: 1, ino: 2 });
  stash.stashIdentity('same', '/alias', { dev: 1, ino: 2 });
  assert.deepEqual(stash.takeIdentity('same', '/alias'), { dev: 1, ino: 2 });
  stash.stashIdentity('changed', '/alias', { dev: 1, ino: 2 });
  stash.stashIdentity('changed', '/alias', { dev: 1, ino: 3 });
  assert.equal(stash.takeIdentity('changed', '/alias'), null);
  stash.stashIdentity('cleared', '/alias', { dev: 1, ino: 2 });
  stash.stash('cleared', '/alias', ['/alias'], 'read');
  assert.deepEqual(stash.consume('cleared', '/alias', 'read'), ['/alias']);
  assert.equal(stash.takeIdentity('cleared', '/alias'), undefined);
});

test('consumer takes the saved lane, reports expiry and falls back only for absent snapshots', () => {
  const resolutions: string[] = [];
  const messages: string[] = [];
  const take = createPathApprovalConsumer((file: string) => {
    resolutions.push(file);
    return [`fresh:${file}`];
  }, (message: string) => messages.push(message));
  const stash = new Be(1, 8);
  const context = (toolUseId?: string) => ({ session: { writePermissionStash: stash }, toolUseId });
  stash.stash('saved', '/alias', ['/alias', '/approved'], 'read');
  assert.deepEqual(take(context('saved'), '/alias', 'read'), ['/alias', '/approved']);
  assert.deepEqual(resolutions, []);
  assert.deepEqual(take(context('saved'), '/alias', 'read'), ['fresh:/alias']);
  assert.deepEqual(take(context(), '/without-id'), ['fresh:/without-id']);
  assert.deepEqual(resolutions, ['/alias', '/without-id']);
  assert.equal(messages.length, 1);
  assert.match(messages[0]!, /toolUseId=saved/);
  stash.stash('empty', '/alias', ['/first'], 'read');
  stash.stash('empty', '/alias', ['/second'], 'read');
  assert.deepEqual(take(context('empty'), '/alias', 'read'), []);
  assert.deepEqual(resolutions, ['/alias', '/without-id']);
  stash.stash('old-read', '/alias', ['/old'], 'read');
  stash.stash('new-read', '/alias', ['/new'], 'read');
  assert.throws(() => take(context('old-read'), '/alias', 'read'),
    (error: Error) => error.name === 'SymlinkReadRefusedError' && /expired/.test(error.message));
  assert.deepEqual(take(context('old-read'), '/alias', 'read'), ['fresh:/alias']);
  stash.stash('old-write', '/alias', ['/old']);
  stash.stash('new-write', '/alias', ['/new']);
  assert.throws(() => take(context('old-write'), '/alias'),
    (error: Error) => error.name === 'SymlinkWriteRefusedError' && /expired/.test(error.message));
  assert.deepEqual(resolutions, ['/alias', '/without-id', '/alias']);
});

test('bounded snapshots signal evicted paths and discard uncertain identities', () => {
  const stash = new Be(1, 1);
  stash.stash('first', '/file', ['/first'], 'read');
  stash.stash('second', '/file', ['/second'], 'read');
  assert.equal(stash.consume('first', '/file', 'read'), j8e);
  assert.deepEqual(stash.consume('second', '/file', 'read'), ['/second']);
  assert.equal(stash.consume('unknown', '/file', 'read'), undefined);
  stash.stash('one', '/file', ['/one'], 'write');
  stash.stash('two', '/file', ['/two'], 'write');
  stash.stash('three', '/file', ['/three'], 'write');
  assert.equal(stash.consume('one', '/file', 'write'), j8e);
  assert.equal(stash.consume('unknown', '/file', 'write'), j8e);
  assert.equal(stash.consume('unknown', '/file', 'read'), undefined);
  assert.deepEqual(stash.consume('three', '/file', 'write'), ['/three']);

  const identities = new Be(1, 1);
  identities.stashIdentity('first', '/file', { dev: 1, ino: 1 });
  identities.stashIdentity('second', '/file', { dev: 1, ino: 2 });
  identities.stashIdentity('first', '/file', { dev: 1, ino: 1 });
  assert.equal(identities.takeIdentity('first', '/file'), null);
  identities.stashIdentity('third', '/file', { dev: 1, ino: 3 });
  identities.stashIdentity('fourth', '/file', { dev: 1, ino: 4 });
  assert.equal(identities.takeIdentity('fourth', '/file'), null);
});
