import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SIDE_QUESTION_PROMPT, SIDE_QUESTION_REMINDER, SIDE_QUESTION_TOOL_HISTORY,
  SIDE_QUESTION_TOOL_NOTE, SIDE_QUESTION_TRUNCATED_HISTORY, SIDE_QUESTION_TRUNCATED_NOTE,
  SIDE_QUESTION_USAGE, classifySideQuestion, sideQuestionHasToolCalls, sideQuestionHistoryText,
  sideQuestionPanelText, sideQuestionUserContent,
} from '../src/side-question.js';

function message(content: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id: 'msg_test', type: 'message', role: 'assistant', model: 'fixture-model', content,
    stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    ...extra,
  } as never;
}

test('the reminder precedes the question as two text blocks', () => {
  const content = sideQuestionUserContent('why is the sky blue');
  assert.equal(content.length, 2);
  assert.equal(content[0]!.text, SIDE_QUESTION_REMINDER);
  assert.ok(content[0]!.text.startsWith('<system-reminder>This is a side question from the user.'));
  assert.ok(content[0]!.text.endsWith('Simply answer the question with the information you have.</system-reminder>\n\n'));
  assert.deepEqual(content[1], { type: 'text', text: 'why is the sky blue' });
});

test('the tool-call detector matches the copied markup forms only', () => {
  assert.equal(sideQuestionHasToolCalls('<function_calls>'), true);
  assert.equal(sideQuestionHasToolCalls('<antml:invoke name="x">'), true);
  assert.equal(sideQuestionHasToolCalls('</invoke>'), true);
  assert.equal(sideQuestionHasToolCalls('function_calls without angle brackets'), false);
});

test('history replaces tool-call and cut-off answers with their notes', () => {
  assert.equal(sideQuestionHistoryText('plain answer'), 'plain answer');
  assert.equal(sideQuestionHistoryText('<invoke name="bash">'), SIDE_QUESTION_TOOL_HISTORY);
  assert.equal(sideQuestionHistoryText(`answer\n\n${SIDE_QUESTION_TRUNCATED_NOTE}`), SIDE_QUESTION_TRUNCATED_HISTORY);
});

test('classify returns the joined text and appends the tool-call note', () => {
  const plain = classifySideQuestion([message([{ type: 'text', text: 'One.' }, { type: 'text', text: 'Two.' }])]);
  assert.deepEqual(plain, { response: 'One.\n\nTwo.', synthetic: false });
  const withCalls = classifySideQuestion([message([{ type: 'text', text: '<invoke name="bash">' }])]);
  assert.deepEqual(withCalls, { response: `<invoke name="bash">\n\n${SIDE_QUESTION_TOOL_NOTE}`, synthetic: false });
});

test('classify turns a bare tool call into the synthetic reply', () => {
  const outcome = classifySideQuestion([message([{ type: 'tool_use', id: 'toolu_1', name: 'bash', input: {} }])]);
  assert.deepEqual(outcome, {
    response: '(The model tried to call bash instead of answering directly. Try rephrasing or ask in the main conversation.)',
    synthetic: true,
  });
});

test('classify turns an API error message into the synthetic reply', () => {
  const outcome = classifySideQuestion([message([{ type: 'text', text: 'API Error: overloaded' }], { isApiErrorMessage: true })]);
  assert.deepEqual(outcome, { response: '(API error: overloaded)', synthetic: true });
  assert.deepEqual(classifySideQuestion([message([])]), { response: null, synthetic: false });
});

test('the panel body leads with the asked question', () => {
  assert.equal(sideQuestionPanelText('why', 'because'), '/btw why\n\nbecause');
  assert.equal(sideQuestionPanelText('why', null), '/btw why');
  assert.equal(sideQuestionPanelText('why', 'because', 'fallback'), '/btw why\n\n⚠ fallback\n\nbecause');
});

test('the host copies the recovered fixed lines', () => {
  assert.equal(SIDE_QUESTION_USAGE, 'Usage: /btw <question>');
  assert.equal(SIDE_QUESTION_PROMPT, 'Ask a quick side question without interrupting the main conversation.');
});
