import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { Agent, defaultConfig, type AgentEvents } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';

test('throwing progress observers release the real Agent turn and permit a subsequent request', async () => {
  for (const mode of ['start-and-finish', 'phase-and-finish', 'finish']) {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'progress-cleanup-')));
    const session = Session.open(root, { config: { ...defaultConfig(root, []), model: 'fixture' } });
    let calls = 0;
    const provider: ModelProvider = { count: async () => 1, complete: async () => {
      calls++;
      return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', stop_sequence: null,
        container: null, diagnostics: null, stop_details: null,
        content: [{ type: 'text', text: 'done', citations: null }], stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1, cache_creation: null, cache_creation_input_tokens: null,
          cache_read_input_tokens: null, inference_geo: null, output_tokens_details: null, server_tool_use: null, service_tier: null } };
    } };
    const failure = Error('owned progress failure');
    const events: AgentEvents = { progress(event) {
      if (event.kind === 'finish' || mode === 'start-and-finish' && event.kind === 'start' ||
        mode === 'phase-and-finish' && event.kind === 'phase') throw failure;
    } };
    const agent = new Agent(session, provider, [], events);
    try {
      await assert.rejects(agent.run('first'), error => error === failure);
      assert.equal(agent.isRunning(), false);
      const before = calls, turnIds: string[] = [];
      events.progress = event => { if (event.kind === 'start') turnIds.push(event.uuid); };
      const result = await agent.run(session.awaitingResponse ? undefined : 'retry');
      assert.equal(result.reason, 'end_turn'); assert.equal(result.text, 'done');
      assert.equal(calls, before + 1); assert.equal(turnIds.length, 1); assert.equal(agent.isRunning(), false);
    } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
  }
});
