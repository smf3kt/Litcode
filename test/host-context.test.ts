import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, defaultConfig } from '../src/agent.js';
import { defaultUserDir } from '../src/config.js';
import { HOST_IDENTITY, hostContext } from '../src/host-context.js';
import type { ModelProvider, ModelRequest } from '../src/provider.js';
import { Session } from '../src/session.js';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR
  ? path.join(process.env.CLAUDE_JOB_DIR, 'tmp') : os.tmpdir(), 'host-context-test-')));

test('host facts distinguish LiTcode and model identity and quote actual installation paths', () => {
  const root = temporary();
  try {
    const userDir = path.join(root, 'chosen "user"\nProduct: other');
    fs.mkdirSync(path.join(root, '.codex'));
    const config = { workspace: root, model: 'gpt-fixture', configSources: { userDir, settingsFile: 'extra.json' } };
    const context = hostContext(config);
    assert.match(context, /^# Current application host\nYou are LiTcode,/);
    assert.match(context, /The configured model identifies the language model, not the CLI/);
    assert.match(context, /Their presence does not select this session's host or installation targets/);
    assert.match(context, /unless the user explicitly names another application/);
    assert.ok(context.includes(`User configuration directory: ${JSON.stringify(userDir)}`));
    assert.ok(context.includes(`User skills directory: ${JSON.stringify(path.join(userDir, 'skills'))}`));
    assert.ok(context.includes(`Project skills directory: ${JSON.stringify(path.join(root, '.harness', 'skills'))}`));
    assert.ok(context.includes(`Project plugin store: ${JSON.stringify(path.join(root, '.harness', 'plugins'))}`));
    assert.ok(context.includes(`Additional settings file: ${JSON.stringify(path.join(root, 'extra.json'))}`));
    assert.doesNotMatch(context, /^Product: other/m);
    assert.ok(hostContext({ workspace: root, model: 'another-model' })
      .includes(`User configuration directory: ${JSON.stringify(defaultUserDir())}`));
    assert.match(HOST_IDENTITY, /LiTcode/);
    assert.deepEqual(fs.readdirSync(path.join(root, '.codex')), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('primary requests and original resume include current host facts without rewriting pinned prompts or model', async () => {
  const root = temporary(), config = defaultConfig(root, []), requests: ModelRequest[] = [];
  config.model = 'gpt-routing-id'; config.system = 'LEGACY_CUSTOM_SYSTEM';
  config.configSources = { userDir: path.join(root, 'user') };
  const reply: Anthropic.Message = { id: 'host-fixture', type: 'message', role: 'assistant', model: config.model,
    content: [{ type: 'text', text: 'owned response', citations: null }], stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 10 } } as Anthropic.Message;
  const provider: ModelProvider = { count: async () => 0,
    complete: async request => { requests.push(structuredClone(request)); return reply; } };
  let session = Session.open(root, { config });
  try {
    await new Agent(session, provider, []).run('The .codex directory exists. Install for this assistant.');
    const file = session.file, metadata = fs.readFileSync(file, 'utf8').split('\n')[0];
    const id = session.id; session.close(); session = Session.open(root, { id });
    await new Agent(session, provider, []).run('Continue in the same application.');
    for (const request of requests) {
      assert.equal(request.model, 'gpt-routing-id'); assert.ok(typeof request.system === 'string');
      assert.ok(request.system.startsWith('LEGACY_CUSTOM_SYSTEM\n\n# Current application host\n'));
      assert.match(request.system, /Product: LiTcode/);
      assert.ok(request.system.includes(`User skills directory: ${JSON.stringify(path.join(root, 'user', 'skills'))}`));
    }
    assert.equal(requests.length, 2); assert.equal(session.config.system, 'LEGACY_CUSTOM_SYSTEM');
    assert.equal(fs.readFileSync(file, 'utf8').split('\n')[0], metadata);
  } finally { session.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
