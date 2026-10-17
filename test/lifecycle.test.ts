import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import { Agent, assertPaired, defaultConfig } from '../src/agent.js';
import { Session } from '../src/session.js';
import type { ModelProvider } from '../src/provider.js';
import type { ToolDefinition } from '../src/tools.js';

function response(content: unknown[], stop: string): Anthropic.Message {
  return { id: 'fixture', model: 'fixture', type: 'message', role: 'assistant', content, stop_reason: stop,
    usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function command(output: unknown): string {
  return `${JSON.stringify(process.execPath)} -e ${"'process.stdout.write(" + JSON.stringify(JSON.stringify(output)) + ")'"}`;
}
function fixture() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'harness-lifecycle-')));
  const inputs: unknown[] = [];
  let execute: ToolDefinition['execute'] = async value => { inputs.push(value); return 'effect saved'; };
  const tool: ToolDefinition = { readOnly: false, schema: { name: 'mutate', input_schema: { type: 'object' } },
    execute: (value, context) => execute(value, context) };
  const config = defaultConfig(workspace, [tool]); config.model = 'fixture';
  const requests: Parameters<ModelProvider['complete']>[0][] = [];
  const script = [response([{ type: 'tool_use', id: 'call-1', name: 'mutate', input: { original: true } }], 'tool_use'),
    response([{ type: 'text', text: 'done' }], 'end_turn')];
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    requests.push(request); const reply = script.shift(); assert.ok(reply); return reply;
  } };
  return { workspace, config, tool, inputs, requests, provider,
    setExecute(value: ToolDefinition['execute']) { execute = value; },
    cleanup() { fs.rmSync(workspace, { recursive: true, force: true }); } };
}

test('hook inputs and feedback reach the loop without breaking immediate batch pairing', async () => {
  const f = fixture();
  f.config.hooks = {
    SessionStart: [{ command: command({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'startup context' } }) }],
    UserPromptSubmit: [{ command: command({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: 'prompt context' } }) }],
    PreToolUse: [{ command: command({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', updatedInput: { replaced: true }, additionalContext: 'pre context' } }) }],
    PostToolUse: [{ command: command({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 'post context' } }) }],
    Stop: [{ command: command({}) }],
  };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const agent = new Agent(session, f.provider, [f.tool]);
    await agent.startSession('startup');
    const result = await agent.run('task');
    assert.equal(result.reason, 'end_turn');
    assert.deepEqual(f.inputs, [{ replaced: true }]);
    assert.match(JSON.stringify(f.requests[0]!.messages), /startup context/);
    assert.match(JSON.stringify(f.requests[0]!.messages), /prompt context/);
    assert.match(JSON.stringify(f.requests[1]!.messages), /pre context/);
    assert.match(JSON.stringify(f.requests[1]!.messages), /post context/);
    const batch = session.messages[2]!.content; assert.ok(Array.isArray(batch));
    assert.equal(batch[0]!.type, 'tool_result');
    assert.equal(batch[1]!.type, 'text');
    const events = session.events.map(e => e.kind);
    const saved = events.indexOf('tool_result');
    assert.equal(events[saved + 1], 'hook_start');
    assertPaired(session.messages);
    const id = session.id; session.close();
    const restored = Session.open(f.workspace, { id });
    try { assert.deepEqual(restored.events, session.events); } finally { restored.close(); }
  } finally { session.close(); f.cleanup(); }
});

test('policy denial precedes hooks and prevents both hook commands and tool effects', async () => {
  const f = fixture();
  f.config.permissions = { mode: 'plan', allow: ['*'], deny: [] };
  f.config.hooks = { PreToolUse: [{ command: 'exit 99' }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'end_turn');
    assert.equal(f.inputs.length, 0);
    assert.ok(!session.events.some(e => e.kind === 'tool_start' || e.kind === 'hook_start'));
    assert.match(JSON.stringify(f.requests[1]!.messages), /Plan mode permits read-only tools/);
    assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('prompt guard blocks before any model request and leaves a completed turn', async () => {
  const f = fixture(); f.config.hooks = { UserPromptSubmit: [{ command: 'exit 2' }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'hook_blocked'); assert.equal(result.modelCalls, 0);
    assert.equal(f.requests.length, 0); assert.equal(session.awaitingResponse, false);
    assert.equal(session.messages.length, 0);
  } finally { session.close(); f.cleanup(); }
});

test('prompt block messages carry the original prompt unless suppressed', async () => {
  const visible = fixture();
  visible.config.hooks = { UserPromptSubmit: [{ command: 'printf nope >&2; exit 2' }] };
  const first = Session.open(visible.workspace, { config: visible.config });
  try {
    const result = await new Agent(first, visible.provider, [visible.tool]).run('task');
    assert.equal(result.reason, 'hook_blocked'); assert.equal(result.modelCalls, 0);
    assert.equal(result.text, 'UserPromptSubmit operation blocked by hook:\nnope\n\nOriginal prompt: task');
  } finally { first.close(); visible.cleanup(); }

  const hidden = fixture();
  hidden.config.hooks = { UserPromptSubmit: [{ command: command({ decision: 'block', reason: 'not now',
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', suppressOriginalPrompt: true } }) }] };
  const second = Session.open(hidden.workspace, { config: hidden.config });
  try {
    const result = await new Agent(second, hidden.provider, [hidden.tool]).run('task');
    assert.equal(result.text, 'UserPromptSubmit operation blocked by hook:\nnot now');
  } finally { second.close(); hidden.cleanup(); }
});

test('expansion block messages carry the command unless suppressed', async () => {
  const expansion = { expansion_type: 'slash_command' as const, command_name: 'greet', command_args: 'x', prompt: '/greet x' };
  const visible = fixture();
  visible.config.hooks = { UserPromptExpansion: [{ command: 'printf nope >&2; exit 2' }] };
  const first = Session.open(visible.workspace, { config: visible.config });
  try {
    const result = await new Agent(first, visible.provider, [visible.tool]).run('expanded body', undefined, undefined, expansion);
    assert.equal(result.reason, 'hook_blocked'); assert.equal(result.modelCalls, 0);
    assert.equal(result.text, 'UserPromptExpansion operation blocked by hook:\nnope\n\nOriginal prompt: /greet x');
  } finally { first.close(); visible.cleanup(); }

  const hidden = fixture();
  hidden.config.hooks = { UserPromptExpansion: [{ command: command({ decision: 'block', reason: 'no expansion',
    hookSpecificOutput: { hookEventName: 'UserPromptExpansion', suppressOriginalPrompt: true } }) }] };
  const second = Session.open(hidden.workspace, { config: hidden.config });
  try {
    const result = await new Agent(second, hidden.provider, [hidden.tool]).run('expanded body', undefined, undefined, expansion);
    assert.equal(result.text, 'UserPromptExpansion operation blocked by hook:\nno expansion');
  } finally { second.close(); hidden.cleanup(); }
});

test('post hook stopping continuation pairs later skipped tools and preserves the first effect', async () => {
  const f = fixture();
  f.config.hooks = { PostToolUse: [{ command: command({ continue: false, stopReason: 'stop after effect' }) }] };
  f.provider.complete = async () => response([
    { type: 'tool_use', id: 'one', name: 'mutate', input: {} },
    { type: 'tool_use', id: 'two', name: 'mutate', input: {} },
  ], 'tool_use');
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'hook_blocked'); assert.equal(f.inputs.length, 1);
    const results = session.events.filter(e => e.kind === 'tool_result');
    assert.equal(results.length, 2);
    assert.equal(results[0]!.result.content, 'effect saved');
    assert.equal(results[1]!.result.is_error, true);
    assert.match(String(results[1]!.result.content), /stop after effect/);
    assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('cancelling inside a pre hook prevents tool start and still commits a paired error', async () => {
  const f = fixture();
  const controller = new AbortController();
  f.config.hooks = { PreToolUse: [{ command: 'while :; do :; done', timeout: 5 }] };
  const session = Session.open(f.workspace, { config: f.config });
  // Abort after the hook is actually journaled, so this exercises in-flight cancellation.
  const timer = setInterval(() => {
    if (session.events.some(e => e.kind === 'hook_start')) controller.abort();
  }, 10);
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task', controller.signal);
    assert.equal(result.reason, 'aborted'); assert.equal(f.inputs.length, 0);
    assert.ok(!session.events.some(e => e.kind === 'tool_start'));
    assert.ok(session.events.some(e => e.kind === 'tool_result'));
    assertPaired(session.messages);
  } finally { clearInterval(timer); session.close(); f.cleanup(); }
});

test('resume startup context follows recovered tool results without replaying effects', async () => {
  const f = fixture(); f.config.hooks = { SessionStart: [{ command: command({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'resume context' }
  }) }] };
  f.provider.complete = async request => { f.requests.push(request); return response([{ type: 'text', text: 'resumed' }], 'end_turn'); };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'task' } });
    const reply = response([{ type: 'tool_use', id: 'saved-call', name: 'mutate', input: {} }], 'tool_use');
    session.append({ kind: 'message', message: { role: 'assistant', content: reply.content }, response: reply });
    session.append({ kind: 'tool_start', id: 'saved-call', name: 'mutate' });
    const agent = new Agent(session, f.provider, [f.tool]); await agent.startSession('resume');
    const result = await agent.run();
    assert.equal(result.reason, 'end_turn'); assert.equal(f.inputs.length, 0);
    assert.match(JSON.stringify(f.requests[0]!.messages), /resume context/);
    assertPaired(session.messages);
    const batch = session.messages[2]!.content; assert.ok(Array.isArray(batch));
    assert.equal(batch[0]!.type, 'tool_result'); assert.equal(session.messages[3]!.role, 'user');
  } finally { session.close(); f.cleanup(); }
});

test('Stop feedback continues the task and marks the next Stop as active', async () => {
  const f = fixture();
  const seen = path.join(f.workspace, 'stop-inputs.jsonl');
  f.config.hooks = { Stop: [{ command: `${JSON.stringify(process.execPath)} -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const p=JSON.parse(s);require("fs").appendFileSync(${JSON.stringify(seen)},s);process.stdout.write(JSON.stringify(p.stop_hook_active?{}:{decision:"block",reason:"add verification"}));});'` }] };
  f.provider.complete = async request => { f.requests.push(request); return response([{ type: 'text', text: 'answer' }], 'end_turn'); };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'end_turn'); assert.equal(result.modelCalls, 2);
    assert.match(JSON.stringify(f.requests[1]!.messages), /add verification/);
    assert.deepEqual(fs.readFileSync(seen, 'utf8').trim().split('\n').map(line => JSON.parse(line).stop_hook_active), [false, true]);
    assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('an explicit Stop termination does not call the model again', async () => {
  const f = fixture(); f.config.hooks = { Stop: [{ command: command({ continue: false, stopReason: 'finished now' }) }] };
  f.provider.complete = async request => { f.requests.push(request); return response([{ type: 'text', text: 'answer' }], 'end_turn'); };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'hook_blocked'); assert.equal(result.modelCalls, 1);
    assert.ok(session.events.some(event => event.kind === 'hook_result' && event.stopRequested));
  } finally { session.close(); f.cleanup(); }
});

test('repeated Stop continuation respects the task model-call limit', async () => {
  const f = fixture(); f.config.maxTurns = 2;
  f.config.hooks = { Stop: [{ command: command({ decision: 'block', reason: 'continue' }) }] };
  f.provider.complete = async () => response([{ type: 'text', text: 'answer' }], 'end_turn');
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'turn_limit'); assert.equal(result.modelCalls, 2);
    assert.equal(session.awaitingResponse, false); assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('a saved Stop continuation resumes without replaying the command', async () => {
  const f = fixture(); f.config.hooks = { Stop: [{ command: 'exit 99' }] };
  f.provider.complete = async request => { f.requests.push(request); return response([{ type: 'text', text: 'resumed' }], 'end_turn'); };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'task' } });
    const reply = response([{ type: 'text', text: 'saved' }], 'end_turn');
    session.append({ kind: 'message', message: { role: 'assistant', content: reply.content }, response: reply });
    session.append({ kind: 'hook_start', id: 'saved-stop', event: 'Stop' });
    session.append({ kind: 'hook_result', id: 'saved-stop', event: 'Stop', blocked: true, reason: 'saved feedback', additionalContext: [] });
    const result = await new Agent(session, f.provider, [f.tool]).run();
    assert.equal(result.modelCalls, 1); assert.equal(result.reason, 'end_turn');
    assert.match(JSON.stringify(f.requests[0]!.messages), /saved feedback/);
    assert.equal(session.events.filter(event => event.kind === 'hook_start').length, 2);
    assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('failed tools and completed batches fire their own hooks after durable results', async () => {
  const f = fixture(); f.setExecute(async () => { throw new Error('tool fixture failed'); });
  f.config.hooks = {
    PostToolUse: [{ command: 'exit 99' }],
    PostToolUseFailure: [{ command: command({ additionalContext: 'failure feedback' }) }],
    PostToolBatch: [{ command: command({ additionalContext: 'batch feedback' }) }],
  };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    await new Agent(session, f.provider, [f.tool]).run('task');
    assert.deepEqual(session.events.filter(event => event.kind === 'hook_start').map(event => event.event), ['PostToolUseFailure', 'PostToolBatch']);
    assert.match(JSON.stringify(f.requests[1]!.messages), /failure feedback/);
    assert.match(JSON.stringify(f.requests[1]!.messages), /batch feedback/);
    const events = session.events;
    const batchHook = events.findIndex(event => event.kind === 'hook_start' && event.event === 'PostToolBatch');
    assert.equal(events[batchHook - 1]!.kind, 'message'); assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('PostToolBatch input carries every call with its response', async () => {
  const f = fixture();
  const input = path.join(f.workspace, 'batch.json');
  f.config.hooks = { PostToolBatch: [{ command: `cat > ${JSON.stringify(input)}` }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    await new Agent(session, f.provider, [f.tool]).run('task');
    const parsed = JSON.parse(fs.readFileSync(input, 'utf8')) as Record<string, unknown>;
    assert.equal(parsed.hook_event_name, 'PostToolBatch');
    assert.deepEqual(parsed.tool_calls, [{ tool_name: 'mutate', tool_input: { original: true },
      tool_use_id: 'call-1', tool_response: 'effect saved' }]);
    assert.equal('tool_use_ids' in parsed, false);
  } finally { session.close(); f.cleanup(); }
});

test('PostToolBatch blocking ends only after the entire batch is paired', async () => {
  const f = fixture(); f.config.hooks = { PostToolBatch: [{ command: 'printf %s "batch stop" >&2; exit 2' }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'hook_blocked'); assert.equal(result.modelCalls, 1);
    assert.equal(f.inputs.length, 1); assertPaired(session.messages);
    assert.equal(session.awaitingResponse, false);
  } finally { session.close(); f.cleanup(); }
});

test('failed-tool hook feedback preserves the error and continues the task', async () => {
  const f = fixture(); f.setExecute(async () => { throw new Error('original tool error'); });
  f.config.hooks = { PostToolUseFailure: [{ command: command({ continue: false, stopReason: 'failure wrapper feedback' }) }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.reason, 'end_turn'); assert.equal(result.modelCalls, 2);
    assert.match(JSON.stringify(f.requests[1]!.messages), /original tool error/);
    assert.match(JSON.stringify(f.requests[1]!.messages), /failure wrapper feedback/);
    assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
});

test('manual compaction consumes pre instructions and displays post output', async () => {
  for (const mode of ['visible', 'hidden', 'bounded', 'raw']) {
  const f = fixture();
  const context = mode === 'bounded' ? 'after\x1b[2J ' + '界'.repeat(100) : 'after summary context';
  if (mode === 'bounded') f.config.maxOutputBytes = 96;
  f.config.hooks = {
    PreCompact: [{ command: 'printf %s "pre summary context"' }],
    PostCompact: [{ command: mode === 'raw' ? 'printf %s "after summary context"' : command({ additionalContext: context, continue: false, suppressOutput: mode === 'hidden',
      ...(mode === 'bounded' ? { systemMessage: 'budget first' } : {}) }) }],
  };
  f.provider.complete = async request => { f.requests.push(request); return response([{ type: 'text', text: 'summary' }], 'end_turn'); };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'task' } });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
    const statuses: string[] = [];
    await new Agent(session, f.provider, [f.tool], { status: text => statuses.push(text) }).compactContext();
    assert.match(JSON.stringify(f.requests[0]!.messages), /pre summary context/);
    assert.doesNotMatch(JSON.stringify(session.messages), /after summary context/);
    const displayed = statuses.filter(text => text.startsWith('hook PostCompact: '));
    // The source renders each record's raw output with its labels; structured
    // fields (additionalContext, systemMessage, suppressOutput) are ignored.
    assert.match(displayed.join('\n'), /PostCompact \[/);
    if (mode !== 'bounded') assert.match(displayed.join('\n'), /after summary context/);
    if (mode === 'bounded') {
      assert.ok(displayed.reduce((bytes, text) => bytes + Buffer.byteLength(text) + 1, 0) <= 96);
      assert.doesNotMatch(displayed.join('\n'), /\x1b|�/);
    }
    const post = session.events.findLast(event => event.kind === 'hook_result' && event.event === 'PostCompact');
    assert.ok(post?.kind === 'hook_result'); assert.deepEqual(post.additionalContext, []);
    assert.match(post.userDisplayMessage ?? '', /PostCompact \[.+\] completed successfully/);
    assert.deepEqual(session.events.filter(event => event.kind === 'hook_start').map(event => event.event), ['PreCompact', 'PostCompact']);
    assert.equal(session.awaitingResponse, false); assertPaired(session.messages);
  } finally { session.close(); f.cleanup(); }
  }
});

test('PreCompact blocking prevents a summary request and preserves completed history', async () => {
  const f = fixture(); f.config.hooks = { PreCompact: [{ command: 'printf %s "retry later" >&2; exit 2' }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'task' } });
    session.append({ kind: 'turn_end', reason: 'end_turn' });
    await assert.rejects(new Agent(session, f.provider, [f.tool]).compactContext(), /retry later/);
    assert.equal(f.requests.length, 0); assert.equal(session.messages.length, 1);
    assert.equal(session.awaitingResponse, false);
  } finally { session.close(); f.cleanup(); }
});

test('notification and idle hook context shares the bounded display consumer', async () => {
  const f = fixture();
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const statuses: string[] = [];
    const agent = new Agent(session, f.provider, [f.tool], { status: text => statuses.push(text) });
    for (const event of ['Notification', 'TeammateIdle'] as const) {
      for (const hidden of [false, true]) {
        session.config.maxOutputBytes = 96;
        const context = 'event\x1b[2J ' + '界'.repeat(100);
        session.config.hooks = { [event]: [{ command: command({ additionalContext: context,
          systemMessage: 'budget first', suppressOutput: hidden }) }] };
        statuses.length = 0;
        await agent.emitHook(event, {});
        if (hidden) assert.deepEqual(statuses, []);
        else {
          assert.equal(statuses.length, 2);
          assert.ok(statuses.reduce((bytes, text) => bytes + Buffer.byteLength(text) + 1, 0) <= 96);
          assert.doesNotMatch(statuses.join('\n'), /\x1b|�/);
        }
        const record = session.events.findLast(item => item.kind === 'hook_result' && item.event === event);
        assert.ok(record?.kind === 'hook_result'); assert.deepEqual(record.additionalContext, [context]);
        assert.deepEqual(session.messages, []);
      }
    }
  } finally { session.close(); f.cleanup(); }
});

test('Stop additional context requests a further turn without an error reason', async () => {
  const f = fixture(); f.config.hooks = { Stop: [{ command: command({ additionalContext: 'verify one more detail' }) }] };
  f.config.maxTurns = 2;
  f.provider.complete = async request => { f.requests.push(request); return response([{ type: 'text', text: 'answer' }], 'end_turn'); };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const result = await new Agent(session, f.provider, [f.tool]).run('task');
    assert.equal(result.modelCalls, 2); assert.equal(result.reason, 'turn_limit');
    assert.match(JSON.stringify(f.requests[1]!.messages), /verify one more detail/);
  } finally { session.close(); f.cleanup(); }
});

test('model errors fire StopFailure and keep the interrupted turn resumable', async () => {
  const f = fixture(); f.config.hooks = { StopFailure: [{ command: command({ additionalContext: 'service diagnostic' }) }] };
  f.provider.complete = async () => { throw new Error('model fixture failed'); };
  const session = Session.open(f.workspace, { config: f.config });
  const statuses: string[] = [];
  try {
    await assert.rejects(new Agent(session, f.provider, [f.tool], { status: line => statuses.push(line) }).run('task'), /model fixture failed/);
    assert.ok(session.events.some(event => event.kind === 'hook_result' && event.event === 'StopFailure'));
    assert.equal(statuses.some(line => line.includes('service diagnostic')), false);
    assert.equal(session.awaitingResponse, true);
  } finally { session.close(); f.cleanup(); }
});

test('SessionEnd displays failed hook output and not successful context', async () => {
  const f = fixture();
  const failing = "printf late 1>&2; exit 3";
  f.config.hooks = { SessionEnd: [
    { command: command({ additionalContext: 'cleanup' }) },
    { command: failing },
  ] };
  const session = Session.open(f.workspace, { config: f.config });
  const statuses: string[] = [];
  try {
    const agent = new Agent(session, f.provider, [f.tool], { status: line => statuses.push(line) });
    await agent.endSession('other');
    assert.equal(statuses.some(line => line.includes('cleanup')), false);
    assert.ok(statuses.includes(`SessionEnd hook [${failing}] failed: late`), statuses.join('\n'));
  } finally { session.close(); f.cleanup(); }
});

test('SessionEnd runs once even after the task signal was cancelled', async () => {
  const f = fixture(); f.config.hooks = { SessionEnd: [{ command: command({ additionalContext: 'cleanup' }) }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    const agent = new Agent(session, f.provider, [f.tool]);
    await agent.endSession('interrupt'); await agent.endSession('other');
    assert.equal(session.events.filter(event => event.kind === 'hook_start' && event.event === 'SessionEnd').length, 1);
    assert.equal(session.awaitingResponse, false);
  } finally { session.close(); f.cleanup(); }
});

test('resuming a final response never replays an interrupted Stop hook', async () => {
  const f = fixture(); f.config.hooks = { Stop: [{ command: 'exit 99' }] };
  const session = Session.open(f.workspace, { config: f.config });
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'task' } });
    const reply = response([{ type: 'text', text: 'saved final' }], 'end_turn');
    session.append({ kind: 'message', message: { role: 'assistant', content: reply.content }, response: reply });
    session.append({ kind: 'hook_start', id: 'interrupted-stop', event: 'Stop' });
    const result = await new Agent(session, f.provider, [f.tool]).run();
    assert.equal(result.text, 'saved final'); assert.equal(result.modelCalls, 0);
    assert.equal(session.events.filter(e => e.kind === 'hook_start').length, 1);
    assert.equal(f.requests.length, 0);
  } finally { session.close(); f.cleanup(); }
});
