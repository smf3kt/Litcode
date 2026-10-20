import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { COPY_FILE_NAME, COPY_RESPONSE_LIMIT, copyBlockLabel, copyEmptyMessage,
  copyFileExtension, copyReport, copyResponses, copyTooManyMessage, copyUsageMessage,
  parseCopyArgument, writeCopyFile } from '../src/copy-command.js';

const assistant = (text: string) => ({ role: 'assistant', content: [{ type: 'text', text }] });

test('responses are collected newest first and skip what has no text', () => {
  const found = copyResponses([
    assistant('first'),
    { role: 'user', content: [{ type: 'text', text: 'a question' }] },
    assistant('second'),
    { role: 'assistant', content: [{ type: 'thinking', thinking: 'hidden' }] },
    assistant('third'),
  ]);
  assert.deepEqual(found, ['third', 'second', 'first']);
  assert.deepEqual(copyResponses([]), []);
  assert.deepEqual(copyResponses([{ role: 'assistant', content: 'a plain string' }]), []);
});

test('text blocks of one response join with a blank line', () => {
  const found = copyResponses([{ role: 'assistant', content: [
    { type: 'text', text: 'head' }, { type: 'tool_use', id: 't', name: 'n', input: {} },
    { type: 'text', text: 'tail' }] }]);
  assert.deepEqual(found, ['head\n\ntail']);
});

test('no more than the recovered twenty responses are reachable', () => {
  const many = Array.from({ length: 30 }, (_, index) => assistant(`r${index}`));
  const found = copyResponses(many);
  assert.equal(found.length, COPY_RESPONSE_LIMIT);
  assert.equal(found[0], 'r29');
  assert.equal(found.at(-1), 'r10');
});

test('the argument parses to the latest, an index, a usage error or an overrun', () => {
  assert.deepEqual(parseCopyArgument('', 3), { kind: 'latest' });
  assert.deepEqual(parseCopyArgument('  ', 3), { kind: 'latest' });
  assert.deepEqual(parseCopyArgument('2', 3), { kind: 'index', index: 1 });
  assert.deepEqual(parseCopyArgument('3', 3), { kind: 'index', index: 2 });
  assert.deepEqual(parseCopyArgument('4', 3), { kind: 'too-many', count: 3 });
  assert.deepEqual(parseCopyArgument('0', 3), { kind: 'usage', got: '0' });
  assert.deepEqual(parseCopyArgument('-1', 3), { kind: 'usage', got: '-1' });
  assert.deepEqual(parseCopyArgument('x', 3), { kind: 'usage', got: 'x' });
  assert.deepEqual(parseCopyArgument('1.5', 3), { kind: 'usage', got: '1.5' });
});

test('the report counts characters and lines exactly as the recovery does', () => {
  assert.equal(copyReport('one line', '/tmp/x'), 'Copied to clipboard (8 characters, 1 lines)\nAlso written to /tmp/x');
  assert.equal(copyReport('a\nb\nc', undefined), 'Copied to clipboard (5 characters, 3 lines)');
});

test('the empty, overrun and usage messages are the recovered wording', () => {
  assert.equal(copyEmptyMessage(), 'No assistant message to copy');
  assert.equal(copyTooManyMessage(1), 'Only 1 assistant message available to copy');
  assert.equal(copyTooManyMessage(2), 'Only 2 assistant messages available to copy');
  assert.equal(copyUsageMessage('x'), 'Usage: /copy [N] where N is 1 (latest), 2, 3, … Got: x');
});

test('the file extension drops a plaintext language and keeps the rest', () => {
  assert.equal(copyFileExtension(undefined), '.txt');
  assert.equal(copyFileExtension('plaintext'), '.txt');
  assert.equal(copyFileExtension('C++'), '.C');
  assert.equal(copyFileExtension('...'), '.txt');
});

test('a code block is labelled by its first non-empty line, cut at 120 units', () => {
  assert.equal(copyBlockLabel({ kind: 'code', text: '\n\nconst a = 1;\nconst b = 2;', lang: 'ts' }), 'const a = 1;');
  assert.equal(copyBlockLabel({ kind: 'code', text: '\n \n', lang: 'ts' }), '(code block)');
  assert.equal(copyBlockLabel({ kind: 'code', text: 'x'.repeat(200), lang: 'ts' }), `${'x'.repeat(120)}…`);
  assert.equal(copyBlockLabel({ kind: 'quote', text: 'a quoted line' }), 'a quoted line');
});

test('the scratch file carries the text under the recovered name', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-test-'));
  try {
    const file = writeCopyFile('the response body', directory);
    assert.equal(file, path.join(directory, COPY_FILE_NAME));
    assert.equal(fs.readFileSync(file, 'utf8'), 'the response body');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
