import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { defaultConfig } from '../src/agent.js';
import { AgentRegistry } from '../src/agent-registry.js';
import {
  checkBashCommandClamp, normalizeBashCommandClamp, normalizeDisallowedTools, parseToolRule,
  toolNameDenied, validateDisallowedTools,
} from '../src/agent-tool-restrictions.js';
import type { ModelProvider } from '../src/provider.js';
import { createTools } from '../src/tools.js';

function response(text = 'done', content?: Anthropic.ContentBlock[]): Anthropic.Message {
  return { id: 'fixture', model: 'test', type: 'message', role: 'assistant',
    content: content ?? [{ type: 'text', text }], stop_reason: content ? 'tool_use' : 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}

function fixture(run: ModelProvider['complete'] = async () => response()) {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-restrictions-')));
  const tools = createTools();
  const config = defaultConfig(workspace, tools); config.model = 'test'; config.allowShell = true;
  const provider: ModelProvider = { count: async () => 0, complete: run };
  const registry = new AgentRegistry({ source: () => config, tools, provider });
  return { registry, async cleanup() {
    await registry.close(); fs.rmSync(workspace, { recursive: true, force: true });
  } };
}

test('permission-rule text parses like the recovered Un, including escaped parens', () => {
  assert.deepEqual(parseToolRule('Bash'), { toolName: 'Bash' });
  assert.deepEqual(parseToolRule('Bash(git status)'), { toolName: 'Bash', ruleContent: 'git status' });
  assert.deepEqual(parseToolRule('Bash(git:*)'), { toolName: 'Bash', ruleContent: 'git:*' });
  assert.deepEqual(parseToolRule('Bash()'), { toolName: 'Bash' });
  assert.deepEqual(parseToolRule('Bash(*)'), { toolName: 'Bash' });
  assert.deepEqual(parseToolRule('Bash(echo \\(x\\))'), { toolName: 'Bash', ruleContent: 'echo (x)' });
  // A missing or unbalanced pair names the whole text, as Un does.
  assert.deepEqual(parseToolRule('Bash(git'), { toolName: 'Bash(git' });
  assert.deepEqual(parseToolRule('Bash)git('), { toolName: 'Bash)git(' });
});

test('disallowedTools normalization requires unpadded names and sorts the deny list', () => {
  assert.deepEqual(normalizeDisallowedTools(['Write', 'Bash', 'Write']), ['Bash', 'Write']);
  assert.equal(normalizeDisallowedTools([]), undefined);
  for (const bad of ['Bash', [1], [''], [' Bash'], ['Bash '], [null]]) {
    assert.throws(() => normalizeDisallowedTools(bad), /disallowedTools must be an array of non-empty tool-name strings/);
  }
});

test('bashCommandClamp normalization requires Bash(...) rules with plain content', () => {
  assert.deepEqual(normalizeBashCommandClamp(['Bash(git status)', 'Bash(git:*)', 'Bash(git status)']),
    [['Bash(git status)', 'Bash(git:*)']]);
  assert.equal(normalizeBashCommandClamp([]), undefined);
  for (const bad of ['Bash(git:*)', ['Bash'], ['Bash()'], ['Bash(*)'], ['Bash( git)'], ['bash(git)'], ['Bash(git) ']]) {
    assert.throws(() => normalizeBashCommandClamp(bad), /bashCommandClamp/);
  }
});

test('the clamp admits a command only when every reading matches in every group', () => {
  assert.equal(checkBashCommandClamp('git status', [['Bash(git status)']]), null);
  assert.equal(checkBashCommandClamp('git status', [['Bash(git:*)']]), null);
  assert.equal(checkBashCommandClamp('xargs git status', [['Bash(git:*)']]), null);
  assert.equal(checkBashCommandClamp('git log --oneline', [['Bash(git:*)']]), null);
  // A compound reading cannot satisfy a prefix rule, even when its first
  // segment would.
  assert.equal(checkBashCommandClamp('git status; rm -rf /', [['Bash(git:*)']])?.kind, 'unmatched');
  // The de-quoted reading has to match too.
  assert.equal(checkBashCommandClamp("echo 'denied'", [['Bash(echo denied)']])?.kind, 'unmatched');
  assert.equal(checkBashCommandClamp('echo denied', [['Bash(echo denied)']]), null);
  // An incomplete reading set can never be admitted.
  assert.equal(checkBashCommandClamp('echo $HOME', [['Bash(echo $HOME)']])?.kind, 'unverifiable');
  assert.equal(checkBashCommandClamp('echo $(cat key)', [['Bash(echo cat key)']])?.kind, 'unverifiable');
  // Every inherited group applies.
  assert.equal(checkBashCommandClamp('git status', [['Bash(git:*)'], ['Bash(ls:*)']])?.kind, 'unmatched');
  // A wildcard rule only matches when it is trailing.
  assert.equal(checkBashCommandClamp('echo hi', [['Bash(echo *)']]), null);
});

test('deny entries match exact tools and MCP server scopes; bad entries refuse the spawn', () => {
  assert.equal(toolNameDenied('run_command', ['run_command']), true);
  assert.equal(toolNameDenied('read_file', ['run_command']), false);
  assert.equal(toolNameDenied('mcp__srv__tool', ['mcp__*']), true);
  assert.equal(toolNameDenied('mcp__srv__tool', ['mcp__srv']), true);
  assert.equal(toolNameDenied('mcp__srv__tool', ['mcp__srv__other']), false);
  const pool = ['run_command', 'read_file', 'mcp__srv__tool'];
  assert.doesNotThrow(() => validateDisallowedTools(['run_command', 'missing_tool'], pool));
  assert.throws(() => validateDisallowedTools(['Run_command'], pool), /case-sensitive/);
  assert.throws(() => validateDisallowedTools(['run_*'], pool), /not a deny wildcard/);
  assert.throws(() => validateDisallowedTools(['mcp__'], pool), /server segment is empty/);
  assert.throws(() => validateDisallowedTools(['mcp__s*'], pool), /server names take no wildcard/);
  assert.throws(() => validateDisallowedTools(['mcp__srv__to*'], pool), /tool names take no wildcard/);
  assert.throws(() => validateDisallowedTools(['run command'], pool), /can never match a tool/);
});

test('a denied tool is removed from the child request pool before the first model call', async () => {
  let tools: string[] = [];
  const f = fixture(async request => {
    tools = request.tools?.map(tool => 'name' in tool ? tool.name : '') ?? [];
    return response();
  });
  try {
    const child = await f.registry.launch({ prompt: 'work', mode: 'general', disallowed_tools: ['run_command'] });
    assert.equal(child.status, 'completed', child.error ?? undefined);
    assert.equal(tools.includes('run_command'), false);
    assert.equal(tools.includes('read_file'), true);
  } finally { await f.cleanup(); }
});

test('schema mode refuses a spawn that denies StructuredOutput', async () => {
  let calls = 0;
  const f = fixture(async () => { calls += 1; return response(); });
  try {
    await assert.rejects(f.registry.launch({ prompt: 'work', mode: 'general', disallowed_tools: ['StructuredOutput'],
      structured_schema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } }),
    /schema mode needs the StructuredOutput tool/);
    assert.equal(calls, 0);
  } finally { await f.cleanup(); }
});

test('a clamp with no shell tool in the resolved pool refuses the spawn', async () => {
  let calls = 0;
  const f = fixture(async () => { calls += 1; return response(); });
  try {
    await assert.rejects(f.registry.launch({ prompt: 'work', mode: 'explore', bash_command_clamp: ['Bash(echo:*)'] }),
      /bashCommandClamp can bind nothing/);
    await assert.rejects(f.registry.launch({ prompt: 'work', mode: 'general', disallowed_tools: ['run_command', 'run_background'],
      bash_command_clamp: ['Bash(echo:*)'] }), /bashCommandClamp can bind nothing/);
    assert.equal(calls, 0);
  } finally { await f.cleanup(); }
});

test('the child permission gate denies a clamped command and reports the allowed forms', async () => {
  let calls = 0;
  const f = fixture(async request => {
    calls += 1;
    if (calls === 1) return response('', [{ type: 'tool_use', id: 'cmd-1', name: 'run_command',
      input: { command: 'rm -rf /tmp/never-created' } } as Anthropic.ContentBlock]);
    const result = request.messages.at(-1);
    const block = Array.isArray(result?.content)
      ? result.content.find(entry => entry.type === 'tool_result') : undefined;
    assert.equal(block?.type, 'tool_result');
    assert.match(String(block && 'content' in block ? block.content : ''), /clamped to a fixed set of command forms/);
    assert.match(String(block && 'content' in block ? block.content : ''), /Bash\(echo:\*\)/);
    return response('done');
  });
  try {
    const child = await f.registry.launch({ prompt: 'work', mode: 'general', bash_command_clamp: ['Bash(echo:*)'] });
    assert.equal(child.status, 'completed', child.error ?? undefined);
    assert.equal(calls, 2);
    assert.equal(fs.existsSync('/tmp/never-created'), false);
  } finally { await f.cleanup(); }
});

test('the child permission gate admits a command every clamp reading matches', async () => {
  let calls = 0;
  const f = fixture(async request => {
    calls += 1;
    if (calls === 1) return response('', [{ type: 'tool_use', id: 'cmd-1', name: 'run_command',
      input: { command: 'echo clamped-ok' } } as Anthropic.ContentBlock]);
    const result = request.messages.at(-1);
    const block = Array.isArray(result?.content)
      ? result.content.find(entry => entry.type === 'tool_result') : undefined;
    const content = String(block && 'content' in block ? block.content : '');
    assert.match(content, /clamped-ok/);
    assert.doesNotMatch(content, /has been denied/);
    return response('done');
  });
  try {
    const child = await f.registry.launch({ prompt: 'work', mode: 'general', bash_command_clamp: ['Bash(echo:*)'] });
    assert.equal(child.status, 'completed', child.error ?? undefined);
    assert.equal(calls, 2);
  } finally { await f.cleanup(); }
});
