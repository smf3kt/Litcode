import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import type { ModelProvider } from '../src/provider.js';
import { createSubagentTool, forkMessages, resolveChildLaunch } from '../src/subagents.js';
import { createTools } from '../src/tools.js';
import { listSessions } from '../src/sessions.js';

test('child explore receives only read-only tools and persists an isolated session', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-child-')));
  const tools = createTools(); const config = defaultConfig(workspace, tools); config.model = 'test'; config.allowShell = true;
  const provider: ModelProvider = {
    count: async () => 0,
    complete: async request => {
      assert.deepEqual(request.tools?.map(t => 'name' in t ? t.name : undefined), ['read_file', 'list_files', 'search']);
      assert.match(String(request.system), /child agent/);
      return { id: 'fixture', model: 'test', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'findings' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
    },
  };
  try {
    const result = JSON.parse(await createSubagentTool(config, provider, tools).execute({ prompt: 'inspect' }, { workspace, signal: new AbortController().signal, allowShell: true, maxOutputBytes: 1000 }));
    assert.equal(result.text, 'findings');
    assert.equal(result.reason, 'end_turn');
    assert.equal(listSessions(workspace).length, 1);
    assert.equal(listSessions(workspace)[0]?.active, false);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});

test('standalone advanced child copies fork context and rolls back a failed environment', async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-child-')));
  const tools = createTools(); const config = defaultConfig(workspace, tools); config.model = 'test';
  let closes = 0;
  const provider: ModelProvider = { count: async () => 0, complete: async request => {
    assert.equal(request.messages[0]!.content, 'earlier user');
    assert.equal(request.messages.at(-1)!.content, 'focused task');
    return { id: 'fixture', model: 'test', type: 'message', role: 'assistant', content: [{ type: 'text', text: 'findings' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
  } };
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 1000,
    conversation: [{ role: 'user' as const, content: 'earlier user' }, { role: 'assistant' as const, content: 'earlier response' }] };
  try {
    const tool = createSubagentTool(config, provider, tools, { enableAdvanced: true });
    const type = { name: "reviewer", aliases: ["quick"], description: "fixture", body: "review", path: "/fixture/reviewer.md", mode: "general" as const };
    assert.equal(resolveChildLaunch(config, { subagent_type: "quick" }, { enableAdvanced: true, agentTypes: [type] }).type, type);
    assert.throws(() => resolveChildLaunch(config, { subagent_type: "quick" }, { enableAdvanced: true, agentTypes: [type, { ...type, name: "other" }] }), /Ambiguous agent type alias/);
    const result = JSON.parse(await tool.execute({ prompt: 'focused task', subagent_type: 'fork' }, context));
    assert.equal(result.workspace, workspace); assert.equal(result.text, 'findings');
    const invalid = createSubagentTool(config, provider, tools, { enableAdvanced: true, childEnvironmentFactory: async request => ({
      config: { ...request.config, model: 'different' }, tools: [...request.tools], close: async () => { closes++; },
    }) });
    await assert.rejects(invalid.execute({ prompt: 'work', isolation: 'worktree' }, context), /inherited configuration/);
    assert.equal(closes, 1);
    assert.deepEqual(forkMessages(undefined, false), []);
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
});
