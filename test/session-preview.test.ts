import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { listSessions, readSessionPreview, renameStoredSession } from '../src/sessions.js';
import { Session } from '../src/session.js';

function response(content: unknown[]): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content, stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

function fixture(): { workspace: string; config: ReturnType<typeof defaultConfig>; id: string } {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'session-preview-')));
  const config = defaultConfig(workspace, []); config.model = 'test';
  const session = Session.open(workspace, { config });
  const id = session.id;
  session.append({ kind: 'message', message: { role: 'user', content: 'hello' } });
  const reply = response([{ type: 'text', text: 'the stored answer' }]);
  session.append({ kind: 'message', message: { role: 'assistant', content: reply.content }, response: reply });
  session.append({ kind: 'message', message: { role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'ok' }] } });
  session.close();
  return { workspace, config, id };
}

test('the preview reader returns stored user and assistant text only', () => {
  const { workspace, id } = fixture();
  try {
    assert.deepEqual(readSessionPreview(workspace, id).messages, [
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'the stored answer' },
    ]);
    assert.equal(readSessionPreview(workspace, id).messageCount, 2);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a rename appends the title to the target journal and the list shows it', () => {
  const { workspace, id } = fixture();
  try {
    renameStoredSession(workspace, id, '  Renamed session  ');
    assert.equal(listSessions(workspace).find(session => session.id === id)?.title, 'Renamed session');
    assert.throws(() => renameStoredSession(workspace, id, 'bad\x1b[31m'), /Invalid session title/);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('a locked target journal is not rewritten', () => {
  const { workspace, config, id } = fixture();
  const reopened = Session.open(workspace, { config, id });
  try {
    assert.throws(() => renameStoredSession(workspace, id, 'Renamed'), /active in another process/);
  } finally {
    reopened.close();
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
