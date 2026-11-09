import assert from 'node:assert/strict';
import { test } from 'node:test';
import Anthropic from '@anthropic-ai/sdk';
import { compactionFailure } from '../src/compaction-errors.js';
import { compactionPrompt } from '../src/compaction-prompt-source.js';
import { reactiveCompact, type CompactionAttempt, type CompactionRecord } from '../src/reactive-compaction-source.js';

const user = (uuid: string, content = uuid): CompactionRecord => ({ type: 'user', uuid, message: { role: 'user', content } });
const assistant = (uuid: string): CompactionRecord => ({ type: 'assistant', uuid,
  message: { role: 'assistant', id: uuid, content: [{ type: 'text', text: uuid }] } });
const successful = (): CompactionAttempt => ({ ok: true, summaryText: '<summary>owned summary</summary>', messages: [],
  totalUsage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    cache_creation: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null },
  forkAssistantMessageCount: 1 });

test('reactive compaction keeps the last assistant group and preserves original record identities', async () => {
  const prompt = compactionPrompt('Keep the active task');
  assert.match(prompt, /<summary>/);
  assert.match(prompt, /Additional Instructions:\nKeep the active task/);
  assert.match(prompt, /Only messages that actually came from the user/);
  const tooShort = await reactiveCompact([user('only')], { signal: new AbortController().signal, summarize: async () => {
    assert.fail('one-group history must not request a summary');
  } });
  assert.ok(!tooShort.ok && tooShort.reason === 'too_few_groups');
  const records = [user('request'), assistant('first'), user('result'), assistant('last'), { ...user('hook'), isMeta: true }];
  const inputs: string[][] = [];
  const result = await reactiveCompact(records, { signal: new AbortController().signal, summarize: async rows => {
    inputs.push(rows.map(row => row.uuid)); return successful();
  } });
  assert.ok(result.ok);
  assert.deepEqual(inputs, [['request', 'first', 'result']]);
  assert.deepEqual(result.result.messagesToPreserve.map(row => row.uuid), ['last', 'hook']);
  assert.equal(result.result.messagesToPreserve[1], records[4]);
  assert.equal(result.result.splitKind, 'round');
  assert.equal(result.result.groupsPreserved, 1);
});

test('reactive compaction expands the retained tail after prompt overflow and strips only summary media on retry', async () => {
  const signal = new AbortController().signal;
  const overflow = new Anthropic.APIError(400, undefined, 'prompt is too long: 250 tokens > 100 maximum', undefined);
  assert.deepEqual(compactionFailure(overflow, signal), { ok: false, reason: 'prompt_too_long', tokenGap: 150 });
  const mediaError = new Anthropic.APIError(400, undefined, 'capability_rejected: image_block', undefined);
  assert.deepEqual(compactionFailure(mediaError, signal), { ok: false, reason: 'media_too_large' });
  const unrelated = new Anthropic.APIError(400, undefined, 'capability_rejected: image_block_other', undefined);
  const rejected = compactionFailure(unrelated, signal);
  assert.ok(!rejected.ok);
  assert.equal(rejected.reason, 'error');
  const records = [user('request'), assistant('first'), user('r1'), assistant('second'), user('r2'), assistant('last'), user('r3')];
  const inputs: string[][] = [];
  const result = await reactiveCompact(records, { signal: new AbortController().signal, summarize: async rows => {
    inputs.push(rows.map(row => row.uuid)); return inputs.length === 1 ? { ok: false, reason: 'prompt_too_long' } : successful();
  } });
  assert.ok(result.ok);
  assert.equal(result.result.attempt, 2); assert.equal(result.result.groupsPreserved, 2);
  assert.deepEqual(inputs[1], ['request', 'first', 'r1']);
  assert.deepEqual(result.result.messagesToPreserve.map(row => row.uuid), ['second', 'r2', 'last', 'r3']);

  const image: CompactionRecord = { type: 'user', uuid: 'image', message: { role: 'user', content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'fixture' } }] } };
  const modes: boolean[] = [];
  const media = await reactiveCompact([image, assistant('one'), user('r'), assistant('two')], {
    signal: new AbortController().signal, summarize: async (rows, mode) => {
      modes.push(mode.stripMedia);
      if (!mode.stripMedia) return { ok: false, reason: 'media_too_large' };
      assert.deepEqual(rows[0]!.message.content, [{ type: 'text', text: '[image]' }]);
      return successful();
    } });
  assert.ok(media.ok); assert.equal(media.result.attempt, 1); assert.deepEqual(modes, [false, true]);
  assert.ok(JSON.stringify(image.message.content).includes('base64'));
});

test('reactive compaction preserves a pending user request in fallback and terminates abort, media and attempt limits', async () => {
  const many = [user('opening'), ...Array.from({ length: 10 }, (_, index) => assistant(`group-${index}`))];
  const truncated: CompactionRecord[][] = [];
  const headExhausted = await reactiveCompact(many, { signal: new AbortController().signal, summarize: async (rows, mode) => {
    if (mode.headTruncated) truncated.push(rows);
    return { ok: false, reason: 'prompt_too_long' };
  } });
  assert.ok(!headExhausted.ok && headExhausted.reason === 'exhausted');
  assert.equal(headExhausted.headTruncations, 3);
  assert.equal(truncated.length, 3);
  assert.match(String(truncated[0]![0]!.message.content), /earlier conversation truncated/);
  assert.ok(truncated[2]!.length < truncated[0]!.length);
  const opening = user('large-opening', 'x'.repeat(400000));
  const rescueInputs: string[][] = [];
  const rescued = await reactiveCompact([opening, assistant('first'), user('result'), assistant('last')], {
    signal: new AbortController().signal, summarize: async rows => {
      rescueInputs.push(rows.map(row => row.uuid));
      return rescueInputs.length === 1 ? { ok: false, reason: 'prompt_too_long', tokenGap: 100 } : successful();
    },
  });
  assert.ok(rescued.ok);
  assert.deepEqual(rescueInputs[1], ['large-opening']);
  assert.deepEqual(rescued.result.messagesToPreserve.map(row => row.uuid), ['first', 'result', 'last']);
  const records = [user('old'), assistant('answer'), user('pending')];
  const fallback = await reactiveCompact(records, { signal: new AbortController().signal, summarize: async rows => {
    assert.deepEqual(rows.map(row => row.uuid), ['old', 'answer']); return successful();
  } });
  assert.ok(fallback.ok); assert.equal(fallback.result.splitKind, 'summarize_all');
  assert.deepEqual(fallback.result.messagesToPreserve.map(row => row.uuid), ['pending']);
  const absent = await reactiveCompact(records, { signal: new AbortController().signal, allowFallback: false,
    summarize: async () => { throw Error('disabled fallback must not call the model'); } });
  assert.ok(!absent.ok); assert.equal(absent.reason, 'too_few_groups');
  const exhausted = await reactiveCompact(records, { signal: new AbortController().signal, apiAttemptsLeft: { count: 0 },
    summarize: async () => { throw Error('zero budget must not call the model'); } });
  assert.ok(!exhausted.ok); assert.equal(exhausted.reason, 'exhausted');
  const controller = new AbortController();
  const aborted = await reactiveCompact(records, { signal: controller.signal, summarize: async () => {
    controller.abort(); return { ok: false, reason: 'prompt_too_long' };
  } });
  assert.ok(!aborted.ok); assert.equal(aborted.reason, 'aborted');
  let calls = 0;
  const media = await reactiveCompact(records, { signal: new AbortController().signal, summarize: async () => {
    calls++; return { ok: false, reason: 'media_too_large' };
  } });
  assert.ok(!media.ok); assert.equal(media.reason, 'media_unstrippable'); assert.equal(calls, 2);
});
