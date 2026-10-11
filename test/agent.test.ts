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

import { Agent, assertPaired, defaultConfig, toolCalls } from "../src/agent.js";
import { fingerprint, Session, type SessionConfig } from "../src/session.js";
import type { ModelProvider } from "../src/provider.js";
import type { ToolContext, ToolDefinition } from "../src/tools.js";

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
  const session = Session.open(ws, { config: cfg });
  try {
    const agent = new Agent(session, provider, tools, { text: (value) => streamed.push(value) });
    const result = await agent.run("go");

    assert.equal(result.reason, "end_turn");
    assert.equal(result.modelCalls, 2);
    assert.equal(alpha.calls.length, 1);
    assert.equal(beta.calls.length, 1);

    // The request carries the thinking config, tools with eager streaming, and the prompt.
    assert.deepEqual(provider.requests[0]!.thinking, { type: "adaptive" });
    assert.equal(provider.requests[0]!.max_tokens, cfg.maxTokens);
    assert.equal(provider.requests[0]!.system, cfg.system);
    assert.equal((provider.requests[0]!.tools as Anthropic.Tool[])[0]!.eager_input_streaming, true);
    assert.deepEqual(provider.requests[0]!.messages, [{ role: "user", content: "go" }]);
    assert.deepEqual(streamed, ["working on it", "done"]);

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
    assert.equal(results[0]!.is_error, undefined);
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
    assert.equal(session.events.at(-1)!.kind, "turn_end");
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

  const agent1 = new Agent(session, provider1, tools);
  await assert.rejects(agent1.run("go"), /no scripted model reply/);

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
    assert.match(cfg.system, /Do not automatically add co-author trailers/);
    assert.doesNotMatch(cfg.system, /[​‌‍⁠﻿]/);
  } finally {
    session.close();
  }
});
