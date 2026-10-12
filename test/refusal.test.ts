import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

function refused(text: string, details: unknown, id = 'msg_refusal_fixture'): Anthropic.Message {
  return { id, type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text, citations: null }],
    stop_reason: 'refusal', stop_sequence: null, stop_details: details, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

async function runRefusal(t: { after(fn: () => void): void }, message: Anthropic.Message, tool?: ToolDefinition) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-refusal-')));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const tools = tool ? [tool] : [];
  const config = { ...defaultConfig(workspace, tools), model: 'fixture' };
  let calls = 0;
  const statuses: string[] = [];
  const provider: ModelProvider = {
    async count() { return 1; },
    async complete() { calls++; return message; },
  };
  const session = Session.open(workspace, { config });
  const agent = new Agent(session, provider, tools, { status: (line: string) => { statuses.push(line); } });
  const outcome = await agent.run('Fixture refusal turn.');
  return { workspace, config, session, calls, statuses, outcome };
}

test('a refused response records the policy category, explanation and request id without running tools', async t => {
  let executed = 0;
  const tool: ToolDefinition = {
    readOnly: true,
    schema: { name: 'fixture_probe', description: 'Fixture probe.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
    async execute() { executed++; return 'should not run'; },
  };
  const first = await runRefusal(t, { ...refused('I cannot help with that.', { type: 'refusal', category: 'cyber', explanation: 'Cyber policy.' }), content: [
    { type: 'tool_use', id: 'skipped', name: 'fixture_probe', input: {}, caller: { type: 'direct' } },
  ] } as Anthropic.Message, tool);
  try {
    assert.equal(first.calls, 1);
    assert.equal(executed, 0);
    assert.equal(first.outcome.reason, 'refusal');
    const refusals = first.session.events.filter(event => event.kind === 'refusal');
    assert.equal(refusals.length, 1);
    assert.deepEqual(refusals[0], { kind: 'refusal', model: 'fixture', category: 'cyber', explanation: 'Cyber policy.', requestId: 'msg_refusal_fixture' });
    assert.ok(first.statuses.some(line => line.includes('cyber') && line.includes('Cyber policy.')));
    // The refused turn still pairs its tool call so the journal stays replayable.
    const blocked = first.session.events.filter(event => event.kind === 'tool_result');
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0]!.result.is_error, true);
  } finally { first.session.close(); }
  const resumed = Session.open(first.workspace, { id: first.session.id, config: first.config });
  try {
    assert.equal(resumed.events.filter(event => event.kind === 'refusal').length, 1);
    assert.equal(resumed.awaitingResponse, false);
  } finally { resumed.close(); }
});

test('a refusal without stop details keeps the record and flattens a wrapped explanation', async t => {
  const bare = await runRefusal(t, { ...refused('Refused.', null), id: '' } as Anthropic.Message);
  try {
    assert.equal(bare.outcome.reason, 'refusal');
    assert.deepEqual(bare.session.events.filter(event => event.kind === 'refusal'), [{ kind: 'refusal', model: 'fixture' }]);
  } finally { bare.session.close(); }
  const wrapped = await runRefusal(t, refused('Refused.', { type: 'refusal', category: null, explanation: 'line one\nline two\t\u0000' }));
  try {
    assert.deepEqual(wrapped.session.events.filter(event => event.kind === 'refusal'),
      [{ kind: 'refusal', model: 'fixture', explanation: 'line one line two', requestId: 'msg_refusal_fixture' }]);
  } finally { wrapped.session.close(); }
  const resumed = Session.open(wrapped.workspace, { id: wrapped.session.id, config: wrapped.config });
  try { assert.equal(resumed.events.filter(event => event.kind === 'refusal').length, 1); }
  finally { resumed.close(); }
});
