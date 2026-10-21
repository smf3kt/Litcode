import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  exportDefaultFilename, exportTargetPath, exportTranscriptText, writeConversationExport,
} from '../src/export-command.js';

const user = (content: unknown): Anthropic.MessageParam => ({ role: 'user', content: content as Anthropic.MessageParam['content'] });
const assistant = (content: unknown): Anthropic.MessageParam => ({ role: 'assistant', content: content as Anthropic.MessageParam['content'] });

test('the default filename carries the local timestamp and the slugged first request', () => {
  const now = new Date(2026, 9, 22, 15, 4, 5);
  assert.equal(exportDefaultFilename([user('Fix the Parser! (please)')], now),
    '2026-10-22-150405-fix-the-parser-please.txt');
  assert.equal(exportDefaultFilename([assistant('no request'), user([{ type: 'tool_result', tool_use_id: 't', content: 'ok' }])], now),
    'conversation-2026-10-22-150405.txt');
});

test('the first request uses its last text block and caps the slug source at 50 characters', () => {
  const now = new Date(2026, 9, 22, 15, 4, 5);
  const long = 'a'.repeat(60);
  const name = exportDefaultFilename([user([{ type: 'text', text: 'first' }, { type: 'text', text: long }])], now);
  assert.equal(name, `2026-10-22-150405-${'a'.repeat(49)}.txt`);
});

test('the transcript keeps user lines prefixed and drops non-text blocks', () => {
  const text = exportTranscriptText([
    user('first line\nsecond line'),
    assistant([{ type: 'text', text: 'an answer' }, { type: 'tool_use', id: 't', name: 'Read', input: {} }]),
    user([{ type: 'tool_result', tool_use_id: 't', content: 'ok' }]),
  ]);
  assert.equal(text, '> first line\n> second line\n\nan answer\n');
});

test('the target path appends .txt only without an extension and resolves against the workspace', () => {
  const base = path.join(path.sep, 'tmp', 'export-base');
  assert.equal(exportTargetPath('notes', base), path.join(base, 'notes.txt'));
  assert.equal(exportTargetPath('notes.md', base), path.join(base, 'notes.md'));
  assert.equal(exportTargetPath('nested/dir/notes', base), path.join(base, 'nested', 'dir', 'notes.txt'));
  assert.equal(exportTargetPath(path.join(base, 'abs'), base), path.join(base, 'abs.txt'));
  assert.ok(exportTargetPath('~/notes', base).startsWith(os.homedir()));
  assert.throws(() => exportTargetPath('bad\0name', base), /NUL/);
});

test('the writer creates parent directories and writes UTF-8 content', () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'export-command-')));
  try {
    const file = writeConversationExport('logs/notes', '> hello\n', workspace);
    assert.equal(file, path.join(workspace, 'logs', 'notes.txt'));
    assert.equal(fs.readFileSync(file, 'utf8'), '> hello\n');
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
