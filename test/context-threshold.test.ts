import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import type { ModelProvider } from '../src/provider.js';
import { Session } from '../src/session.js';

for (const pressure of [511_999, 512_000]) test(`1M context compacts at the exact 512k input boundary (${pressure})`, async t => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-context-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const config = { ...defaultConfig(workspace, []), model: 'fixture' };
  const session = Session.open(workspace, { config });
  session.append({ kind: 'message', message: { role: 'user', content: 'Prior task' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'Prior result' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  let completions = 0;
  const provider: ModelProvider = {
    async count(request) {
      assertPaired(request.messages);
      return String(request.messages[0]?.content).startsWith('Session summary') ? 100 : pressure;
    },
    async complete(request) {
      assertPaired(request.messages);
      completions++;
      const summary = request.tool_choice?.type === 'none';
      if (summary) {
        assert.equal(pressure, 512_000);
        assert.equal(request.messages.length, 4);
        assert.equal(request.max_tokens, 8192);
      }
      return { id: `context-${completions}`, role: 'assistant', type: 'message', model: 'fixture',
        content: [{ type: 'text', text: summary ? 'Prior task is complete; continue current task.' : 'done', citations: null }],
        stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    },
  };
  try {
    assert.equal(config.contextTokens, 1_000_000);
    assert.equal(config.compactAt, 512_000);
    assert.equal((await new Agent(session, provider, []).run('Current task')).reason, 'end_turn');
    assert.equal(session.events.filter(event => event.kind === 'compact').length, pressure === 512_000 ? 1 : 0);
    assert.equal(completions, pressure === 512_000 ? 2 : 1);
    assertPaired(session.messages);
  } finally { session.close(); }
});
