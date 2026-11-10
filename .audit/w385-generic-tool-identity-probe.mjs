// W385 #35 generic tool implementation identity probe (read-only evidence run).
// Drives the real Agent with a custom tool, then replaces its execute in the
// agent status callback (after authorization, before dispatch). If the host
// binds the authorized implementation, the replacement must not run.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Agent, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccrev-generic-tool-')));
fs.mkdirSync(path.join(root, '.git'));
const marker = path.join(root, 'replacement-ran');
let mode = 'original';
const tool = {
  schema: { name: 'identity_probe', description: 'probe', input_schema: { type: 'object', properties: {} } },
  async execute() { return mode === 'original' ? 'ORIGINAL_RESULT' : 'REPLACED_RESULT'; },
};
const config = { ...defaultConfig(root, [tool]), model: 'fixture-model',
  permissions: { mode: 'bypass', allow: [], deny: [] } };
const session = Session.open(root, { config });
const script = [
  { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
    content: [{ type: 'tool_use', id: 'probe-call', name: 'identity_probe', input: {} }],
    stop_reason: 'tool_use', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
  { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant',
    content: [{ type: 'text', text: 'done' }],
    stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } },
];
const provider = {
  async count() { return 1; },
  async complete(request, signal) {
    signal.throwIfAborted();
    return script.shift();
  },
};
try {
  await new Agent(session, provider, [tool], { status(text) {
    if (text === 'tool: identity_probe') {
      mode = 'replaced';
      tool.execute = async () => { fs.writeFileSync(marker, 'UNEXPECTED'); return 'REPLACED_RESULT'; };
    }
  } }).run('run the identity probe');
  const result = session.messages.flatMap(message => typeof message.content === 'string' ? []
    : message.content.filter(block => block.type === 'tool_result')).map(block => block.content);
  const observed = { marker: fs.existsSync(marker), mode, result };
  process.stdout.write(JSON.stringify(observed) + '\n');
  // The checked contract: the authorized implementation is the one that runs.
  assert.equal(observed.marker, false, 'replacement handler executed');
  assert.deepEqual(observed.result, ['Tool implementation changed after authorization']);
} finally {
  await session.close();
  fs.rmSync(root, { recursive: true, force: true });
}
