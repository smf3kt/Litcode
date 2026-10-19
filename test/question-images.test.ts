import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { QUESTION_IMAGE_LIMITS, imageCodecBlock, imageResize, ImageResizeError } from '../src/image-codec.js';
import { QuestionImages, admittedImageBlock, questionImageBlocks } from '../src/question-images.js';

// A 1x1 PNG; the header probe reads it and the bytes stay untouched.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==', 'base64');
const context = { workspace: '/unused', signal: new AbortController().signal };

test('question images keep one map per question and flatten in question order', () => {
  const store = new QuestionImages();
  const first = store.add('second question', { content: PNG.toString('base64') });
  const second = store.add('first question', { content: PNG.toString('base64'), filename: 'shot.png' });
  assert.equal(first.mediaType, 'image/png');
  assert.equal(first.filename, 'Pasted image');
  assert.equal(second.filename, 'shot.png');
  assert.deepEqual(store.list('first question').map(image => image.id), [second.id]);
  assert.deepEqual(store.flatten().map(image => image.id), [first.id, second.id]);
  assert.equal(store.last('second question')?.id, first.id);
  assert.equal(store.remove('second question', first.id), true);
  assert.equal(store.remove('second question', first.id), false);
  assert.deepEqual(store.flatten().map(image => image.id), [second.id]);
});

test('removal leaves the private attachment to its caller and close unlinks the rest', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'question-image-'));
  const target = path.join(root, 'clipboard.png');
  fs.writeFileSync(target, PNG);
  const store = new QuestionImages();
  const image = store.add('question', { content: PNG.toString('base64'), path: target });
  assert.equal(store.remove('question', image.id), true);
  // Source removal is in-memory only; the dialog unlinks the file it removed.
  assert.equal(fs.existsSync(target), true);
  const second = path.join(root, 'second.png');
  fs.writeFileSync(second, PNG);
  store.add('question', { content: PNG.toString('base64'), path: second });
  await store.clear();
  assert.equal(fs.existsSync(second), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a fitting image converts to one native block with its bytes unchanged', async () => {
  const store = new QuestionImages();
  store.add('question', { content: PNG.toString('base64') });
  const blocks = await questionImageBlocks(store.flatten(), context);
  assert.equal(blocks?.length, 1);
  const block = blocks![0]!;
  assert.equal(block.type, 'image');
  if (block.type === 'image' && block.source.type === 'base64') {
    assert.equal(block.source.media_type, 'image/png');
    assert.equal(block.source.data, PNG.toString('base64'));
  }
  assert.equal(await questionImageBlocks([], context), undefined);
});

test('an empty image degrades to the recovered text block instead of throwing', () => {
  const empty = imageCodecBlock({ data: Buffer.alloc(0), mediaType: 'image/png' });
  assert.equal(empty.block.type, 'text');
  assert.match((empty.block as { text: string }).text, /^\[Image could not be processed: Image file is empty \(0 bytes\)\]$/);
  assert.throws(() => imageResize(Buffer.alloc(0), 'png'), ImageResizeError);
});

test('an image over the base64 budget degrades with the source limit message', () => {
  // The fast path only returns bytes that fit `targetRawSize`; a tighter pair
  // of limits forces the compression branch, which this host cannot run.
  const tiny = { ...QUESTION_IMAGE_LIMITS, targetRawSize: 10, maxBase64Size: 10 };
  const result = imageCodecBlock({ data: PNG, mediaType: 'image/png', limits: tiny });
  assert.equal(result.block.type, 'text');
  assert.match((result.block as { text: string }).text, /it is over the .* API limit .* so it cannot be sent\. Re-save it as a PNG or JPEG and try again\./);
});

test('a header-readable image over the pixel limit uses the recovery reason, not an unverified-dimensions claim', () => {
  // `WNe` only reaches "could not verify image dimensions" when the decoder
  // returns no dimensions; readable-but-over images fail in the resize step
  // and land in the recovery path with the over-dimension reason.
  const header = Buffer.alloc(40);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header, 0);
  header.writeUInt32BE(13, 8); header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(3000, 16); header.writeUInt32BE(3000, 20);
  const result = imageCodecBlock({ data: header, mediaType: 'image/png' });
  assert.equal(result.block.type, 'text');
  assert.match((result.block as { text: string }).text, /at 3000x3000px it is over the 2000x2000px limit, so it cannot be sent\./);
});

test('unreadable dimensions degrade instead of reaching the provider', () => {
  const result = imageCodecBlock({ data: Buffer.from('not an image'), mediaType: 'image/png' });
  assert.equal(result.block.type, 'text');
  assert.match((result.block as { text: string }).text, /image processing is unavailable and dimensions could not be read from the file header/);
});

test('the boundary admits a matching image block and rejects a mismatched one', () => {
  const block = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG.toString('base64') } };
  assert.deepEqual(admittedImageBlock(block), block);
  assert.equal(admittedImageBlock({ ...block, source: { ...block.source, media_type: 'image/jpeg' } }), undefined);
  assert.equal(admittedImageBlock({ type: 'text', text: 'not an image' }), undefined);
});
