import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { isCheckpointRecoveryTextTurn } from '../src/directory-checkpoint.js';

test('text recovery accepts only empty citation forms and exact matching message/response blocks', () => {
  const user = { kind: 'message', messageId: randomUUID(), message: { role: 'user', content: 'question' },
    classifier: { origin: { kind: 'human' }, humanText: 'question' } };
  const end = { kind: 'turn_end', reason: 'end_turn' };
  const assistant = (block: unknown) => ({ kind: 'message', messageId: randomUUID(),
    message: { role: 'assistant', content: [block] }, response: { role: 'assistant', content: [block], stop_reason: 'end_turn' } });
  for (const citations of [undefined, null, []]) {
    const block = { type: 'text', text: 'answer', ...(citations === undefined ? {} : { citations }) };
    assert.equal(isCheckpointRecoveryTextTurn(user, assistant(block), end), true);
  }
  for (const extra of [{ citations: [{}] }, { citations: '' }, { citations: false }, { citations: {} }, { unrecognized: true }])
    assert.equal(isCheckpointRecoveryTextTurn(user, assistant({ type: 'text', text: 'answer', ...extra }), end), false);
  const mismatch = assistant({ type: 'text', text: 'answer', citations: null });
  mismatch.response.content = [{ type: 'text', text: 'answer', citations: [] }];
  assert.equal(isCheckpointRecoveryTextTurn(user, mismatch, end), false);
  assert.equal(isCheckpointRecoveryTextTurn(user, assistant({ type: 'tool_use', id: 'call', name: 'write_file', input: {} }), end), false);
  assert.equal(isCheckpointRecoveryTextTurn(user, assistant({ type: 'text', text: 'answer', citations: null }), { kind: 'turn_end', reason: 'aborted' }), false);
});
