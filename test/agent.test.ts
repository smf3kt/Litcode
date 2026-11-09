// Tests for the agent loop, session journal and provider boundary.
//
// The agent is driven entirely through a scripted in-process ModelProvider:
// no network, no credentials, no real models. Tool execution is observed with
// in-memory spies so every assertion about "side effects" is exact.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import type Anthropic from "@anthropic-ai/sdk";

import { Agent, assertPaired, defaultConfig, toolCalls, type AgentEvents } from "../src/agent.js";
import { fingerprint, Session, type SessionConfig } from "../src/session.js";
import { forkSession } from "../src/sessions.js";
import type { ModelProvider } from "../src/provider.js";
import type { ToolContext, ToolDefinition } from "../src/tools.js";
import { bindRuntimeTool } from '../src/tools.js';

// Derive fixture shapes from the provider interface so tests track its contract.
type Req = Parameters<ModelProvider["complete"]>[0];
type Res = Awaited<ReturnType<ModelProvider["complete"]>>;

// ---------------------------------------------------------------------------
// Scratch workspaces (removed after the whole file runs)
// ---------------------------------------------------------------------------

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-agent-")));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

// ---------------------------------------------------------------------------
// Scripted provider
// ---------------------------------------------------------------------------

type Scripted = Res | ((request: Req) => Res);

class FakeProvider implements ModelProvider {
  readonly requests: Req[] = [];
  readonly countRequests: Req[] = [];
  countFn: (request: Req) => number = () => 0;
  private script: Scripted[];

  constructor(script: Scripted[] = []) {
    this.script = [...script];
  }

  push(...replies: Scripted[]): void {
    this.script.push(...replies);
  }

  async complete(request: Req, signal: AbortSignal, onText?: (text: string) => void): Promise<Res> {
    signal.throwIfAborted();
    this.requests.push(request);
    const next = this.script.shift();
    if (!next) throw new Error("FakeProvider: no scripted model reply");
    const reply = typeof next === "function" ? next(request) : next;
    if (onText) {
      for (const block of reply.content) if (block.type === "text") onText(block.text);
    }
    return reply;
  }

  async count(request: Req, signal: AbortSignal): Promise<number> {
    signal.throwIfAborted();
    this.countRequests.push(request);
    return this.countFn(request);
  }
}

// ---------------------------------------------------------------------------
// Message fixtures
// ---------------------------------------------------------------------------

type Block = { type: string; [key: string]: unknown };

let messageSeq = 0;
function serverMessage(content: Block[], stop: Anthropic.StopReason | null): Res {
  return {
    id: `msg_${++messageSeq}`,
    type: "message",
    role: "assistant",
    model: "test-model",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 7 },
  } as unknown as Res;
}
const think = (thinking: string, signature: string): Block => ({ type: "thinking", thinking, signature });
const text = (value: string): Block => ({ type: "text", text: value });
const call = (id: string, name: string, input: unknown): Block => ({ type: "tool_use", id, name, input });

// Plain-object message params for journal seeding; cast once so the loose
// fixture blocks are not contextually checked against the SDK block union.
const assistantParam = (content: Block[]): Anthropic.MessageParam =>
  ({ role: "assistant", content }) as unknown as Anthropic.MessageParam;

function blocksOf(message: Anthropic.MessageParam | undefined): Block[] {
  const content = message?.content;
  return (typeof content === "string" ? [] : content ?? []) as unknown as Block[];
}

/** The most recent user message that is exactly a batch of tool results. */
function lastToolResults(session: Session): Anthropic.ToolResultBlockParam[] {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i]!;
    if (event.kind !== "message") continue;
    const blocks = blocksOf(event.message);
    if (blocks.length > 0 && blocks.every((block) => block.type === "tool_result")) {
      return blocks as unknown as Anthropic.ToolResultBlockParam[];
    }
  }
  throw new Error("no tool result message in session");
}

// ---------------------------------------------------------------------------
// Config + tool helpers
// ---------------------------------------------------------------------------

function makeConfig(workspace: string, tools: ToolDefinition[], overrides: Partial<SessionConfig> = {}): SessionConfig {
  const base: SessionConfig = {
    model: "test-model",
    system: "test-system",
    tools: tools.map((tool) => ({ ...tool.schema, eager_input_streaming: true })),
    workspace,
    allowShell: false,
    maxOutputBytes: 64_000,
    maxTokens: 1_024,
    contextTokens: 100_000,
    compactAt: 50_000,
    maxTurns: 30,
    thinking: true,
  };
  return Object.assign(base, overrides);
}

type Spy = { calls: unknown[]; definition: ToolDefinition };
function spyTool(name: string, impl?: (input: unknown, context: ToolContext) => Promise<string>): Spy {
  const calls: unknown[] = [];
  const definition: ToolDefinition = {
    readOnly: false,
    schema: {
      name,
      description: `${name} test tool`,
      input_schema: { type: "object", properties: {}, additionalProperties: false },
    },
    async execute(input, context) {
      calls.push(input);
      return impl ? impl(input, context) : `${name}:ok`;
    },
  };
  return { calls, definition };
}

// ---------------------------------------------------------------------------
// 1. Thinking/signature retention and immediate multi-tool pairing
// ---------------------------------------------------------------------------

test("a thinking block with its signature is preserved and multi-tool results pair immediately in order", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const beta = spyTool("beta");
  const tools = [alpha.definition, beta.definition];
  const cfg = makeConfig(ws, tools);

  const provider = new FakeProvider([
    serverMessage(
      [think("deliberate plan", "sig-abc-123"), text("working on it"), call("t1", "alpha", { x: 1 }), call("t2", "beta", { y: 2 })],
      "tool_use",
    ),
    serverMessage([text("done")], "end_turn"),
  ]);

  const streamed: string[] = [];
  const lifecycle: string[] = [];
  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools, { textStart: () => lifecycle.push('start'),
      text: (value) => { streamed.push(value); lifecycle.push(value); }, textEnd: () => lifecycle.push('end') });
    const result = await agent.run("go");

    assert.equal(result.reason, "end_turn");
    assert.equal(result.modelCalls, 2);
    assert.equal(alpha.calls.length, 1);
    assert.equal(beta.calls.length, 1);

    // The request carries the thinking config, tools with eager streaming, and the prompt.
    assert.deepEqual(provider.requests[0]!.thinking, { type: "adaptive" });
    assert.equal(provider.requests[0]!.max_tokens, cfg.maxTokens);
    assert.ok(typeof provider.requests[0]!.system === 'string');
    assert.ok(provider.requests[0]!.system.startsWith(`${cfg.system}\n\n`));
    assert.match(provider.requests[0]!.system, /# Current application host\nYou are LiTcode,/);
    assert.equal((provider.requests[0]!.tools as Anthropic.Tool[])[0]!.eager_input_streaming, true);
    assert.deepEqual(provider.requests[0]!.messages, [{ role: "user", content: "go" }]);
    assert.deepEqual(streamed, ["working on it", "done"]);
    assert.deepEqual(lifecycle, ['start', 'working on it', 'end', 'start', 'done', 'end']);

    const messages = session.messages;
    assert.equal(messages.length, 4);

    // Thinking is emitted first and kept byte-for-byte with its signature.
    const assistantBlocks = blocksOf(messages[1]);
    assert.equal(assistantBlocks[0]!.type, "thinking");
    assert.equal(assistantBlocks[0]!.thinking, "deliberate plan");
    assert.equal(assistantBlocks[0]!.signature, "sig-abc-123");
    assert.deepEqual(toolCalls(messages[1]!).map((c) => c.id), ["t1", "t2"]);

    // Results land in a single user message, in call order, before any text.
    const results = lastToolResults(session);
    assert.deepEqual(results.map((r) => r.tool_use_id), ["t1", "t2"]);
    assert.ok(results.every((r) => r.is_error !== true && typeof r.content === "string"));
    assert.equal(messages[2]!.role, "user");
    assertPaired(messages);

    // The signature survives a journal round-trip.
    const id = session.id;
    const file = session.file;
    session.close();
    const reopened = Session.open(ws, { id, config: cfg });
    try {
      assert.equal(reopened.messages.length, 4);
      const roundTripped = blocksOf(reopened.messages[1]).find((block) => block.type === "thinking");
      assert.equal(roundTripped!.signature, "sig-abc-123");
      assertPaired(reopened.messages);
    } finally {
      reopened.close();
    }
    assert.ok(fs.existsSync(file));
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 2. Tool failure and unknown tool produce is_error results
// ---------------------------------------------------------------------------

test("a throwing tool and an unknown tool both produce is_error results without aborting the turn", async () => {
  const ws = tmpDir();
  const boom = spyTool("boom", async () => {
    throw new Error("kaboom");
  });
  const ok = spyTool("ok");
  const tools = [boom.definition, ok.definition];
  const cfg = makeConfig(ws, tools);

  const provider = new FakeProvider([
    serverMessage([call("u1", "boom", {}), call("u2", "ghost", {}), call("u3", "ok", {})], "tool_use"),
    serverMessage([text("recovered")], "end_turn"),
  ]);

  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run("go");
    assert.equal(result.reason, "end_turn");
    assert.equal(result.text, "recovered");

    const results = lastToolResults(session);
    assert.deepEqual(results.map((r) => r.tool_use_id), ["u1", "u2", "u3"]);
    assert.equal(results[0]!.is_error, true);
    assert.match(String(results[0]!.content), /kaboom/);
    assert.equal(results[1]!.is_error, true);
    assert.match(String(results[1]!.content), /Unknown tool: ghost/);
    assert.equal(results[2]!.is_error, undefined);

    const started = session.events.filter((e) => e.kind === "tool_start").map((e) => e.id);
    assert.deepEqual(started, ["u1", "u3"]);
    assertPaired(session.messages);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 3. Truncated (max_tokens) / malformed tool calls: no side effects, paired errors
// ---------------------------------------------------------------------------

test("a max_tokens response with malformed tool calls runs nothing but pairs error results", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const beta = spyTool("beta");
  const tools = [alpha.definition, beta.definition];
  const cfg = makeConfig(ws, tools);

  const provider = new FakeProvider([
    serverMessage(
      [call("m1", "alpha", { partially: "streamed" }), call("m2", "beta", "not-an-object-malformed-input")],
      "max_tokens",
    ),
  ]);

  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run("go");

    assert.equal(result.reason, "max_tokens");
    assert.equal(result.modelCalls, 1);
    // Zero side effects: the tools were never entered.
    assert.equal(alpha.calls.length, 0);
    assert.equal(beta.calls.length, 0);
    assert.equal(session.events.filter((e) => e.kind === "tool_start").length, 0);

    const results = lastToolResults(session);
    assert.deepEqual(results.map((r) => r.tool_use_id), ["m1", "m2"]);
    assert.ok(results.every((r) => r.is_error === true));
    assert.match(String(results[0]!.content), /Tools skipped because model stopped with max_tokens/);
    assertPaired(session.messages);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 4. Cancellation skips later tools and still pairs the batch
// ---------------------------------------------------------------------------

test("cancellation mid-batch skips the remaining tools and still pairs every call", async () => {
  const ws = tmpDir();
  const controller = new AbortController();
  const first = spyTool("first", async () => {
    controller.abort();
    return "first-done";
  });
  const second = spyTool("second");
  const third = spyTool("third");
  const tools = [first.definition, second.definition, third.definition];
  const cfg = makeConfig(ws, tools);

  const provider = new FakeProvider([
    serverMessage([text("starting"), call("c1", "first", {}), call("c2", "second", {}), call("c3", "third", {})], "tool_use"),
  ]);

  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run("go", controller.signal);

    assert.equal(result.reason, "aborted");
    assert.equal(first.calls.length, 1);
    assert.equal(second.calls.length, 0);
    assert.equal(third.calls.length, 0);

    const results = lastToolResults(session);
    assert.deepEqual(results.map((r) => r.tool_use_id), ["c1", "c2", "c3"]);
    assert.equal(results[0]!.is_error, undefined, JSON.stringify(results[0]));
    assert.equal(results[1]!.is_error, true);
    assert.match(String(results[1]!.content), /Cancelled before execution/);
    assert.equal(results[2]!.is_error, true);
    assertPaired(session.messages);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 5. Round limit produces a paired, terminal turn_end
// ---------------------------------------------------------------------------

test("hitting the round limit ends with a paired turn_end", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const tools = [alpha.definition];
  const cfg = makeConfig(ws, tools, { maxTurns: 2 });

  const provider = new FakeProvider([
    serverMessage([call("r1", "alpha", { n: 1 })], "tool_use"),
    serverMessage([call("r2", "alpha", { n: 2 })], "tool_use"),
  ]);

  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run("go");

    assert.equal(result.reason, "turn_limit");
    assert.equal(result.modelCalls, 2);
    assert.equal(alpha.calls.length, 2);

    const messages = session.events.filter((e) => e.kind === "message");
    assert.equal(messages.length, 5); // user + (assistant + results) x2
    assertPaired(session.messages);
    assert.equal(session.events.findLast(event => event.kind !== 'agent_display_observer')!.kind, "turn_end");
    assert.equal(session.awaitingResponse, false);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 6. Session lock is exclusive and released on close
// ---------------------------------------------------------------------------

test("a session file is exclusively locked until it is closed", () => {
  const ws = tmpDir();
  const tools = [spyTool("alpha").definition];
  const cfg = makeConfig(ws, tools);

  const session = Session.open(ws, { config: cfg });
  const id = session.id;
  const lockFile = path.join(ws, ".agent", `${id}.jsonl.lock`);
  assert.ok(fs.existsSync(lockFile));

  // A second open of the same id must fail while the first holds the lock.
  assert.throws(() => Session.open(ws, { id }), /EEXIST/);
  assert.ok(fs.existsSync(lockFile), "a failed open must not steal the holder's lock");

  session.close();
  assert.equal(fs.existsSync(lockFile), false, "close releases the lock");

  const reopened = Session.open(ws, { id, config: cfg });
  assert.equal(reopened.id, id);
  reopened.close();
});

// ---------------------------------------------------------------------------
// 7. Partial final JSONL record is dropped on recovery
// ---------------------------------------------------------------------------

test("resume keeps every complete event and drops an unterminated final record", () => {
  const ws = tmpDir();
  const tools = [spyTool("alpha").definition];
  const cfg = makeConfig(ws, tools);

  const session = Session.open(ws, { config: cfg });
  const id = session.id;
  const file = session.file;
  session.append({ kind: "message", message: { role: "user", content: "hello" } });
  session.append({ kind: "message", message: assistantParam([text("hi there")]) });
  session.close();

  const complete = fs.readFileSync(file, "utf8");
  // Simulate a process killed mid-write: a valid-looking record with no newline.
  fs.appendFileSync(file, '{"kind":"message","message":{"role":"user","content":"trunc');

  const reopened = Session.open(ws, { id, config: cfg });
  try {
    assert.equal(reopened.events.length, 3); // metadata + 2 complete messages
    assert.equal(reopened.events.at(-1)!.kind, "message");
    assert.deepEqual(reopened.messages, [
      { role: "user", content: "hello" },
      { role: "assistant", content: [text("hi there")] },
    ]);
    const onDisk = fs.readFileSync(file, "utf8");
    assert.equal(onDisk, complete, "the unterminated tail is truncated away");
    assert.ok(!onDisk.includes("trunc"));
  } finally {
    reopened.close();
  }
});

// ---------------------------------------------------------------------------
// 8. Crash recovery never replays: completed results reused, started/skipped paired
// ---------------------------------------------------------------------------

test("recovery pairs a started-but-unfinished call and a never-started call without replay", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const beta = spyTool("beta");
  const tools = [alpha.definition, beta.definition];
  const cfg = makeConfig(ws, tools);

  const crash = Session.open(ws, { config: cfg });
  const id = crash.id;
  crash.append({ kind: "message", message: { role: "user", content: "do it" } });
  crash.append({
    kind: "message",
    message: assistantParam([call("a1", "alpha", {}), call("b1", "beta", {})]),
    response: serverMessage([text("starting")], "tool_use"),
  });
  crash.append({ kind: "tool_start", id: "a1", name: "alpha" }); // crashed before any result
  crash.close();

  const provider = new FakeProvider([serverMessage([text("done")], "end_turn")]);
  const session = Session.open(ws, { id, config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run(); // continue the unfinished turn

    assert.equal(result.reason, "end_turn");
    assert.equal(alpha.calls.length, 0, "a started tool must never be replayed");
    assert.equal(beta.calls.length, 0);

    const results = lastToolResults(session);
    assert.deepEqual(results.map((r) => r.tool_use_id), ["a1", "b1"]);
    assert.equal(results[0]!.is_error, true);
    assert.match(String(results[0]!.content), /interrupted after it started/);
    assert.equal(results[1]!.is_error, true);
    assert.match(String(results[1]!.content), /skipped during recovery/);
    assertPaired(session.messages);
  } finally {
    session.close();
  }
});

test("recovery reuses a completed tool result verbatim instead of re-running it", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const beta = spyTool("beta");
  const tools = [alpha.definition, beta.definition];
  const cfg = makeConfig(ws, tools);

  const crash = Session.open(ws, { config: cfg });
  const id = crash.id;
  crash.append({ kind: "message", message: { role: "user", content: "do it" } });
  crash.append({
    kind: "message",
    message: assistantParam([call("a1", "alpha", {}), call("b1", "beta", {})]),
    response: serverMessage([text("starting")], "tool_use"),
  });
  crash.append({ kind: "tool_start", id: "a1", name: "alpha" });
  crash.append({ kind: "tool_result", result: { type: "tool_result", tool_use_id: "a1", content: "alpha:journaled" } });
  crash.close();

  const provider = new FakeProvider([serverMessage([text("done")], "end_turn")]);
  const session = Session.open(ws, { id, config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run();

    assert.equal(result.reason, "end_turn");
    assert.equal(alpha.calls.length, 0, "the completed tool must not be replayed");
    assert.equal(beta.calls.length, 0);

    const results = lastToolResults(session);
    assert.equal(results[0]!.content, "alpha:journaled");
    assert.equal(results[0]!.is_error, undefined);
    assert.match(String(results[1]!.content), /skipped during recovery/);

    // Exactly two tool_result events total: the journaled one plus b1's recovery.
    assert.equal(session.events.filter((e) => e.kind === "tool_result").length, 2);
    assertPaired(session.messages);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 9. Resume config/fingerprint and tool-schema mismatch are rejected
// ---------------------------------------------------------------------------

test("resume rejects a changed config fingerprint and a changed tool schema", () => {
  const ws = tmpDir();
  const tools = [spyTool("alpha").definition];
  const cfg = makeConfig(ws, tools);

  const session = Session.open(ws, { config: cfg });
  const id = session.id;
  session.close();

  assert.throws(
    () => Session.open(ws, { id, config: { ...cfg, model: "different-model" } }),
    /Resume requires the original model, system, tools and runtime settings/,
  );
  assert.equal(fs.existsSync(path.join(ws, ".agent", `${id}.jsonl.lock`)), false, "a rejected resume releases its lock");

  const resumed = Session.open(ws, { id, config: cfg });
  try {
    const changed = [
      { ...tools[0]!, schema: { ...tools[0]!.schema, description: "different description" } },
    ];
    assert.throws(() => new Agent(resumed, new FakeProvider([]), changed), /Session tool schemas changed/);
    assert.throws(
      () => new Agent(resumed, new FakeProvider([]), [tools[0]!, tools[0]!]),
      /Duplicate tool names/,
    );
  } finally {
    resumed.close();
  }

  // Compaction threshold must leave room for output.
  const bad = makeConfig(ws, tools, { compactAt: 99_500, maxTokens: 1_024, contextTokens: 100_000 });
  const other = Session.open(ws, { config: bad });
  try {
    assert.throws(() => new Agent(other, new FakeProvider([]), tools), /Compaction threshold must leave room/);
  } finally {
    other.close();
  }
});

// ---------------------------------------------------------------------------
// 10. A model failure after tool results keeps the journal append-only
// ---------------------------------------------------------------------------

test("a model failure after tool results resumes append-only without re-running tools", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const tools = [alpha.definition];
  const cfg = makeConfig(ws, tools);

  const provider1 = new FakeProvider([serverMessage([call("a1", "alpha", { v: 1 })], "tool_use")]);
  const session = Session.open(ws, { config: cfg });
  const id = session.id;

  const lifecycle: string[] = [];
  const agent1 = new Agent(session, provider1, tools, { textStart: () => lifecycle.push('start'),
    textEnd: () => lifecycle.push('end') });
  await assert.rejects(agent1.run("go"), /no scripted model reply/);
  assert.deepEqual(lifecycle, ['start', 'end', 'start', 'end']);

  assert.equal(alpha.calls.length, 1);
  assert.equal(session.messages.length, 3); // user, assistant(tool_use), user(results)
  assertPaired(session.messages);
  session.close();

  const provider2 = new FakeProvider([serverMessage([text("done")], "end_turn")]);
  const resumed = Session.open(ws, { id, config: cfg });
  try {
    const agent2 = new Agent(resumed, provider2, tools);
    const result = await agent2.run(); // continue the unfinished turn, no prompt

    assert.equal(result.reason, "end_turn");
    assert.equal(alpha.calls.length, 1, "the tool result is reused, not re-run");
    assert.equal(resumed.messages.length, 4); // + assistant(done)
    assertPaired(resumed.messages);
  } finally {
    resumed.close();
  }
});

// ---------------------------------------------------------------------------
// 11. Compaction starts a summary-only epoch without the old thinking
// ---------------------------------------------------------------------------

test("compaction starts a summary-only epoch that omits the old thinking block", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const tools = [alpha.definition];
  const cfg = makeConfig(ws, tools);

  const provider = new FakeProvider([
    serverMessage([think("old-reasoning", "old-signature"), call("c1", "alpha", {})], "tool_use"),
    serverMessage([text("SUMMARY: ran alpha once, nothing pending")], "end_turn"),
    serverMessage([text("final answer")], "end_turn"),
  ]);
  // Only the main loop sees real pressure; a fresh summary prefix must be small.
  provider.countFn = (request) => {
    const messages = request.messages;
    const only = messages.length === 1 ? messages[0] : undefined;
    const isSummary = typeof only?.content === "string" && only.content.startsWith("Session summary");
    if (isSummary) return 50;
    return messages.length >= 3 ? cfg.compactAt : 10;
  };

  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    const result = await agent.run("go");
    assert.equal(result.reason, "end_turn");

    const compact = session.events.find((e) => e.kind === "compact");
    assert.ok(compact && compact.kind === "compact");
    assert.match(compact.summary, /SUMMARY/);

    // The compaction request must not execute tools.
    const compactionRequest = provider.requests[1]!;
    assert.deepEqual(compactionRequest.tool_choice, { type: "none" });

    // The post-compaction model call saw only the summary prefix.
    const finalRequest = provider.requests.at(-1)!;
    assert.equal(finalRequest.messages.length, 1);
    assert.match(String(finalRequest.messages[0]!.content), /^Session summary \(prior conversation data\):/);

    // The live history is the fresh epoch plus the final answer; no old thinking.
    assert.equal(session.messages[0]!.role, "user");
    assert.match(String(session.messages[0]!.content), /^Session summary \(prior conversation data\):/);
    assert.equal(session.messages[1]!.role, "assistant");
    assert.ok(!JSON.stringify(session.messages).includes("old-signature"));
    assertPaired(session.messages);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 12. Rapid context refill after compaction trips the circuit breaker
// ---------------------------------------------------------------------------

test("compaction retains complete latest groups and startup provenance through forks and cold recovery", async () => {
  const ws = tmpDir(), cfg = makeConfig(ws, []);
  let session = Session.open(ws, { config: cfg });
  let fork: Session | undefined;
  try {
    session.append({ kind: 'message', message: { role: 'user', content: 'old request' } });
    const first = serverMessage([text('old answer')], 'end_turn');
    session.append({ kind: 'message', message: { role: 'assistant', content: first.content }, response: first });
    session.append({ kind: 'message', message: { role: 'user', content: 'next request' } });
    const last = serverMessage([think('retained reasoning', 'retained-signature'), call('retained-call', 'alpha', {})], 'tool_use');
    session.append({ kind: 'message', message: { role: 'assistant', content: last.content }, response: last });
    session.append({ kind: 'message', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'retained-call', content: 'retained result' }] } });
    session.append({ kind: 'message', isMeta: true, sessionStartContext: ['RETAINED_HOOK'],
      message: { role: 'user', content: [{ type: 'text', text: 'Hook context:\nRETAINED_HOOK' }] } });
    session.append({ kind: 'turn_end', reason: 'fixture' });
    const provider = new FakeProvider([serverMessage([text('SUMMARY')], 'end_turn')]);
    await new Agent(session, provider, []).compactContext();
    const summarized = JSON.stringify(provider.requests[0]!.messages);
    assert.match(summarized, /old answer/);
    assert.doesNotMatch(summarized, /retained-signature|RETAINED_HOOK|retained-call/);
    const visible = session.messages;
    assert.equal(visible.length, 4);
    assert.match(JSON.stringify(visible), /retained-signature/);
    assertPaired(visible);
    const attachments = session.sessionStartAttachments('any');
    assert.equal(attachments.length, 1);
    const compact = session.events.find(e => e.kind === 'compact');
    assert.ok(compact?.kind === 'compact' && compact.preservedMessages);
    assert.throws(() => session.append({ ...compact, preservedMessages: [{ index: 0, sha256: '0'.repeat(64) }] }), /no longer matches/);
    fork = forkSession(session);
    assert.deepEqual(fork.messages, visible);
    assert.deepEqual(fork.sessionStartAttachments('any'), attachments);
    const forkId = fork.id; fork.close();
    const forkFile = path.join(ws, '.agent', `${forkId}.jsonl`);
    const journal = fs.readFileSync(forkFile, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    journal.find(row => row.kind === 'compact').preservedMessages[0].sha256 = '0'.repeat(64);
    fs.writeFileSync(forkFile, journal.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.throws(() => Session.open(ws, { id: forkId }), /no longer matches/);
    const id = session.id; session.close(); session = Session.open(ws, { id, config: cfg });
    assert.deepEqual(session.messages, visible);
    assert.deepEqual(session.sessionStartAttachments('any'), attachments);
    const next = new FakeProvider([serverMessage([text('continued')], 'end_turn')]);
    await new Agent(session, next, []).run('continue');
    assert.match(JSON.stringify(next.requests[0]!.messages), /retained-signature/);
    assertPaired(next.requests[0]!.messages);
    next.push(serverMessage([text('SECOND SUMMARY')], 'end_turn'));
    await new Agent(session, next, []).compactContext();
    assert.equal(session.events.filter(row => row.kind === 'compact').length, 2);
    assert.match(JSON.stringify(session.messages), /SECOND SUMMARY/);
    assert.doesNotMatch(JSON.stringify(session.messages), /retained-signature|RETAINED_HOOK/);
    assert.deepEqual(session.sessionStartAttachments('any'), []);
    session.close(); session = Session.open(ws, { id, config: cfg });
    assert.match(JSON.stringify(session.messages), /SECOND SUMMARY/);
  } finally { session.close(); fork?.close(); }
});

test("context that refills immediately after compaction stops the loop", async () => {
  const ws = tmpDir();
  const alpha = spyTool("alpha");
  const tools = [alpha.definition];
  const cfg = makeConfig(ws, tools);

  const provider = new FakeProvider([
    serverMessage([call("c1", "alpha", {})], "tool_use"),
    serverMessage([text("SUMMARY: compacted")], "end_turn"),
    serverMessage([call("c2", "alpha", {})], "tool_use"),
  ]);
  provider.countFn = (request) => {
    const messages = request.messages;
    const only = messages.length === 1 ? messages[0] : undefined;
    const isSummary = typeof only?.content === "string" && only.content.startsWith("Session summary");
    if (isSummary) return 50;
    return messages.length >= 3 ? cfg.compactAt : 10;
  };

  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools);
    await assert.rejects(agent.run("go"), /Context refilled too quickly after compaction/);
  } finally {
    session.close();
  }
});

// ---------------------------------------------------------------------------
// 13. Pairing primitives and config fingerprinting
// ---------------------------------------------------------------------------

test('actual tool observers distinguish synchronous, Promise and detached work without changing scheduling', async () => {
  for (const mode of ['absent', 'sync', 'throw', 'promise', 'reject', 'detached', 'thenable', 'getter', 'cancel', 'close'] as const) {
    const ws = tmpDir(), tool = spyTool('observed'), cfg = makeConfig(ws, [tool.definition]);
    let session = Session.open(ws, { config: cfg });
    const controller = new AbortController();
    let release = () => {}, reject = (_reason: Error) => {}, effects = 0, selected = 0;
    const completion = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
    const events: AgentEvents = {};
    const callback = function(this: AgentEvents) {
      assert.equal(this, events);
      assert.equal(session.toolResultObservations.at(-1)?.state, 'admitted_unknown');
      if (mode === 'throw') throw Error('observer failure');
      if (mode === 'thenable') return Object.defineProperty({}, 'then', { get() { selected++; throw Error('must not assimilate'); } });
      if (mode === 'cancel') controller.abort();
      if (['promise', 'reject', 'cancel', 'close'].includes(mode)) return completion.then(() => { effects++; });
      if (mode === 'detached') { void completion.then(() => { effects++; }); return; }
      effects++;
    };
    if (mode === 'getter') Object.defineProperty(events, 'toolResult', { get() {
      selected++; assert.equal(session.toolResultObservations.at(-1)?.state, 'admitted_unknown'); return callback;
    } });
    else if (mode !== 'absent') events.toolResult = callback;
    const provider = new FakeProvider([serverMessage([call('same', 'observed', {})], 'tool_use'), serverMessage([text('done')], 'end_turn')]);
    try {
      const run = new Agent(session, provider, [tool.definition], events).run('task', controller.signal);
      if (mode === 'throw') { await assert.rejects(run, /observer failure/); assert.equal(session.toolResultObservations[0]?.state, 'threw'); continue; }
      const result = await run;
      assert.equal(result.reason, mode === 'cancel' ? 'aborted' : 'end_turn');
      if (['promise', 'reject', 'cancel', 'close'].includes(mode)) {
        assert.equal(session.toolResultObservations[0]?.state, 'promise_pending'); assert.equal(effects, 0);
        if (mode === 'close') { const id = session.id; session.close(); session = Session.open(ws, { id, config: cfg }); }
        if (mode === 'reject') reject(Error('async observer failure')); else release();
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.equal(session.toolResultObservations[0]?.state, mode === 'close' ? 'promise_pending' : mode === 'reject' ? 'rejected' : 'fulfilled');
      } else {
        assert.equal(session.toolResultObservations[0]?.state, mode === 'absent' ? 'absent' : 'sync_returned');
        if (mode === 'detached') { assert.equal(effects, 0); release(); await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(effects, 1); }
        assert.equal(selected, mode === 'getter' ? 1 : 0);
      }
      assert.equal(session.toolResultObservations.length, 1);
    } finally { release(); session.close(); }
  }
});

test('observer live authority, persistence failures and cold validation preserve unknown state without replay', async () => {
  for (const failure of ['none', 'admission', 'return'] as const) {
    const ws = tmpDir(), tool = spyTool('observed'), cfg = makeConfig(ws, [tool.definition]);
    let session = Session.open(ws, { config: cfg }); let calls = 0;
    const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        const bytes = args[1];
        if (Buffer.isBuffer(bytes) && bytes.includes('"kind":"tool_result_observer"') &&
            (failure === 'admission' && bytes.includes('"phase":"admitted"') || failure === 'return' && bytes.includes('"phase":"returned"')))
          throw Error('observer journal fixture');
        return Reflect.apply(target, receiver, args);
      } });
      const provider = new FakeProvider([serverMessage([call('reused', 'observed', {})], 'tool_use'), serverMessage([text('done')], 'end_turn')]);
      const run = new Agent(session, provider, [tool.definition], { toolResult: () => { calls++; } }).run('task');
      if (failure === 'none') await run; else await assert.rejects(run, /observer journal fixture/);
    } finally { fs.writeSync = write; }
    try {
      assert.equal(calls, failure === 'admission' ? 0 : 1);
      const id = session.id; session.close(); session = Session.open(ws, { id, config: cfg });
      assert.equal(session.toolResultObservations[0]?.state, failure === 'admission' ? undefined : failure === 'return' ? 'admitted_unknown' : 'sync_returned');
      const event = session.events.find(row => row.kind === 'tool_result_observer');
      if (event) assert.throws(() => session.append(structuredClone(event)), /observer authorization/);
      if (session.awaitingResponse) await new Agent(session, new FakeProvider([serverMessage([text('recovered')], 'end_turn')]), [tool.definition],
        { toolResult: () => { throw Error('observer replay'); } }).run();
      const fork = forkSession(session);
      try { assert.deepEqual(fork.toolResultObservations, []); } finally { fork.close(); }
      if (event) {
        const file = session.file; session.close();
        const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        rows.find(row => row.kind === 'tool_result_observer').resultSha256 = '0'.repeat(64);
        fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        assert.throws(() => Session.open(ws, { id }), /Invalid tool result observer history/);
      }
    } finally { session.close(); }
  }
});

test('runtime wrapper observes actual checks, Promise settlement and owner boundaries without replay', async () => {
  for (const mode of ['sync', 'getter', 'scope-throw', 'refresh-throw', 'journal-throw', 'promise', 'reject', 'close', 'blocks', 'detached'] as const) {
    const ws = tmpDir(), inner = spyTool('wrapped'), order: string[] = [];
    let release = () => {}, reject = (_reason: Error) => {}, late = 0;
    const pending = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
    const checks = {
      checkScope() { assert.equal(this, checks); order.push('scope'); if (mode === 'scope-throw') throw Error('scope failure'); },
      refresh() {
        assert.equal(this, checks); order.push('refresh');
        if (mode === 'refresh-throw') throw Error('refresh failure');
        if (['promise', 'reject', 'close'].includes(mode)) return pending;
        if (mode === 'detached') void pending.then(() => { late++; });
      },
      checkJournal() { assert.equal(this, checks); order.push('journal'); if (mode === 'journal-throw') throw Error('journal failure'); },
    };
    const tool = bindRuntimeTool(mode === 'blocks' ? { ...inner.definition, executeBlocks: async () => [{ type: 'text', text: 'blocks result' }] } : inner.definition, checks);
    const cfg = makeConfig(ws, [tool]); let session = Session.open(ws, { config: cfg });
    if (mode === 'getter') {
      const refresh = checks.refresh;
      Object.defineProperty(checks, 'refresh', { get() {
        assert.equal(session.runtimeWrapperObservations.at(-1)?.state, 'admitted_unknown'); return refresh;
      } });
    }
    try {
      await new Agent(session, new FakeProvider([serverMessage([call('wrapped-call', 'wrapped', {})], 'tool_use'), serverMessage([text('done')], 'end_turn')]), [tool]).run('task');
      const rows = session.runtimeWrapperObservations;
      const thrown = mode.endsWith('-throw');
      assert.equal(rows.at(-1)?.state, thrown ? 'threw' : 'sync_returned');
      assert.deepEqual(order, mode === 'blocks' ? ['scope', 'journal'] : mode === 'scope-throw' ? ['scope'] : mode === 'refresh-throw' ? ['scope', 'refresh'] : ['scope', 'refresh', 'journal']);
      assert.equal(inner.calls.length, thrown || mode === 'blocks' ? 0 : 1);
      const refresh = rows.find(row => row.event.stage === 'refresh');
      if (['promise', 'reject', 'close'].includes(mode)) {
        assert.equal(refresh?.state, 'promise_pending');
        if (mode === 'close') { const id = session.id; session.close(); session = Session.open(ws, { id }); }
        if (mode === 'reject') reject(Error('late failure')); else release();
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.equal(session.runtimeWrapperObservations.find(row => row.event.stage === 'refresh')?.state,
          mode === 'close' ? 'promise_pending' : mode === 'reject' ? 'rejected' : 'fulfilled');
      }
      if (mode === 'detached') { release(); await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(late, 1); assert.equal(refresh?.state, 'sync_returned'); }
      const last = session.runtimeWrapperObservations.at(-1); assert.ok(last);
      assert.throws(() => session.append(structuredClone(last.event)), /wrapper observer authorization/);
      const id = session.id; session.close(); session = Session.open(ws, { id });
      const fork = forkSession(session); try { assert.deepEqual(fork.runtimeWrapperObservations, []); } finally { fork.close(); }
      assert.deepEqual(order, mode === 'blocks' ? ['scope', 'journal'] : mode === 'scope-throw' ? ['scope'] : mode === 'refresh-throw' ? ['scope', 'refresh'] : ['scope', 'refresh', 'journal']);
    } finally { release(); session.close(); }
  }
});

test('wrapper persistence faults retain uncertainty and cold recovery never repeats checks', async () => {
  for (const failure of ['admitted', 'returned', 'settled'] as const) {
    const ws = tmpDir(), inner = spyTool('wrapped'); let effects = 0, release = () => {};
    const completion = new Promise<void>(resolve => { release = resolve; });
    const tool = bindRuntimeTool(inner.definition, { checkScope() {}, refresh() { effects++; return failure === 'settled' ? completion : undefined; }, checkJournal() {} });
    const cfg = makeConfig(ws, [tool]); let session = Session.open(ws, { config: cfg }); const write = fs.writeSync;
    try {
      fs.writeSync = new Proxy(write, { apply(target, receiver, args) {
        const bytes = args[1];
        if (Buffer.isBuffer(bytes) && bytes.includes('"kind":"runtime_wrapper_observer"') && bytes.includes('"stage":"refresh"') && bytes.includes(`"phase":"${failure}"`))
          throw Error('wrapper persistence fixture');
        return Reflect.apply(target, receiver, args);
      } });
      const run = new Agent(session, new FakeProvider([serverMessage([call('wrapped-call', 'wrapped', {})], 'tool_use'), serverMessage([text('done')], 'end_turn')]), [tool]).run('task');
      if (failure === 'settled') { await run; release(); await new Promise<void>(resolve => setImmediate(resolve)); }
      else await assert.rejects(run, /wrapper persistence fixture|journal write failed/);
      assert.equal(session.isJournalFenced, true);
    } finally { fs.writeSync = write; release(); }
    try {
      assert.equal(effects, failure === 'admitted' ? 0 : 1);
      assert.equal(inner.calls.length, failure === 'settled' ? 1 : 0);
      const id = session.id; session.close(); session = Session.open(ws, { id });
      assert.equal(session.runtimeWrapperObservations.find(row => row.event.stage === 'refresh')?.state,
        failure === 'admitted' ? undefined : failure === 'returned' ? 'admitted_unknown' : 'promise_pending');
      if (session.awaitingResponse) await new Agent(session, new FakeProvider([serverMessage([text('recovered')], 'end_turn')]), [tool]).run();
      assert.equal(effects, failure === 'admitted' ? 0 : 1);
      const file = session.file; session.close();
      const rows = fs.readFileSync(file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      rows.find(row => row.kind === 'runtime_wrapper_observer').startSha256 = '0'.repeat(64);
      fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
      assert.throws(() => Session.open(ws, { id }), /Invalid runtime wrapper observer history/);
    } finally { session.close(); }
  }
});

test("toolCalls, assertPaired and fingerprint behave as the loop depends on", () => {
  const tools = [spyTool("alpha").definition];
  const cfg = makeConfig(tmpDir(), tools);
  assert.equal(fingerprint(cfg), fingerprint({ ...cfg }));
  assert.notEqual(fingerprint(cfg), fingerprint({ ...cfg, model: "other" }));

  const assistant = {
    role: "assistant",
    content: [text("hi"), call("a", "alpha", {}), call("b", "alpha", {})],
  } as unknown as Anthropic.MessageParam;
  assert.deepEqual(toolCalls(assistant).map((c) => c.id), ["a", "b"]);
  assert.throws(() => assertPaired([assistant]), /Unanswered tool calls/);

  const paired = {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "a", content: "x" },
      { type: "tool_result", tool_use_id: "b", content: "y" },
    ],
  } as unknown as Anthropic.MessageParam;
  assertPaired([assistant, paired]);

  const outOfOrder = {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "b", content: "y" },
      { type: "tool_result", tool_use_id: "a", content: "x" },
    ],
  } as unknown as Anthropic.MessageParam;
  assert.throws(() => assertPaired([assistant, outOfOrder]), /immediately pair/);

  const orphan = {
    role: "user",
    content: [{ type: "tool_result", tool_use_id: "a", content: "x" }],
  } as unknown as Anthropic.MessageParam;
  assert.throws(() => assertPaired([orphan]), /Orphan tool result/);
});

// ---------------------------------------------------------------------------
// 14. The default config maps tools exactly as the agent expects
// ---------------------------------------------------------------------------

test("the default config is accepted by the agent without a schema mismatch", () => {
  const ws = tmpDir();
  const tools = [spyTool("alpha").definition];
  const cfg = defaultConfig(ws, tools);
  cfg.model = 'gateway/model-id';
  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, new FakeProvider([]), tools);
    assert.ok(agent instanceof Agent);
    assert.equal(session.config.thinking, false);
    assert.equal(session.config.contextTokens, 1_000_000);
    assert.equal(session.config.compactAt, 512_000);
    assert.equal(session.config.gateway?.baseURL, 'http://127.0.0.1:3425');
    assert.match(cfg.system, /^You are LiTcode,/);
    assert.match(cfg.system, /Do not automatically add co-author trailers/);
    assert.doesNotMatch(cfg.system, /[​‌‍⁠﻿]/);
  } finally {
    session.close();
  }
});
