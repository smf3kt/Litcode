import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { Agent, assertPaired, defaultConfig, toolCalls } from "../src/agent.js";
import { loadProjectConfig } from "../src/config.js";
import { Session, type SessionConfig, type ToolResult } from "../src/session.js";
import type { ModelProvider, ModelRequest } from "../src/provider.js";
import { createTools, type ToolDefinition } from "../src/tools.js";

const roots: string[] = [];
function workspace(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-agent-lifecycle-")));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".git")); // Config ancestor scanning stops at our fixture.
  return root;
}
after(() => { for (const root of roots) fs.rmSync(root, { recursive: true, force: true }); });
function response(content: unknown[], stop = "end_turn"): Anthropic.Message {
  return { id: "fixture", model: "fixture", type: "message", role: "assistant", content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
const call = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input });
const done = () => response([{ type: "text", text: "done" }]);
type Step = Anthropic.Message | ((request: ModelRequest) => Anthropic.Message);
class ScriptedProvider implements ModelProvider {
  readonly requests: ModelRequest[] = [];
  readonly counts: ModelRequest[] = [];
  countFn: (request: ModelRequest) => number = () => 1;
  constructor(private script: Step[]) {}
  async count(request: ModelRequest): Promise<number> {
    assertPaired(request.messages);
    this.counts.push(structuredClone(request));
    return this.countFn(request);
  }
  async complete(request: ModelRequest, signal: AbortSignal): Promise<Anthropic.Message> {
    signal.throwIfAborted();
    assertPaired(request.messages);
    this.requests.push(structuredClone(request));
    const next = this.script.shift();
    assert.ok(next, "Unexpected model request");
    return typeof next === "function" ? next(request) : next;
  }
}
function spy(name: string, readOnly = false): { tool: ToolDefinition; inputs: unknown[] } {
  const inputs: unknown[] = [];
  return { inputs, tool: { readOnly, schema: { name, input_schema: { type: "object", properties: { path: { type: "string" }, status: { type: "string" } } } }, execute: async input => { inputs.push(structuredClone(input)); return "original tool output"; } } };
}
function config(root: string, tools: ToolDefinition[], extra: Partial<SessionConfig> = {}): SessionConfig {
  return { ...defaultConfig(root, tools), model: "fixture-model", ...extra };
}
function shellQuote(value: string): string { return `'${value.replaceAll("'", `'"'"'`)}'`; }
function emit(value: unknown): string { return `printf '%s' ${shellQuote(JSON.stringify(value))}`; }
function resultBatches(session: Session): ToolResult[][] {
  return session.messages.flatMap(message => typeof message.content === "string" ? [] : message.content.some(block => block.type === "tool_result") ? [message.content.filter(block => block.type === "tool_result") as ToolResult[]] : []);
}
function assertBatchAdjacency(session: Session): void {
  assertPaired(session.messages);
  for (const [index, message] of session.messages.entries()) {
    const calls = toolCalls(message);
    if (!calls.length) continue;
    const next = session.messages[index + 1];
    assert.equal(next?.role, "user");
    assert.ok(next && Array.isArray(next.content));
    assert.deepEqual(next.content.slice(0, calls.length).map(block => block.type), calls.map(() => "tool_result"));
    assert.deepEqual((next.content.slice(0, calls.length) as ToolResult[]).map(block => block.tool_use_id), calls.map(tool => tool.id));
  }
}
function write(root: string, relative: string, text: string): void {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const verdict = (ok = true) => response([{ type: "text", text: JSON.stringify({ ok, ...(ok ? {} : { reason: "hook verdict blocked" }) }) }]);

test("hook display fields persist across resume and suppression preserves model context", async () => {
  const root = workspace();
  const hooks = { SessionStart: [{ command: emit({ systemMessage: "visible\u001b[31m", additionalContext: "model context" }) }],
    SessionEnd: [{ command: emit({ suppressOutput: true, systemMessage: "hidden", additionalContext: "hidden context", terminalSequence: "\u001b]2;fixture\u0007" }) }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  const status: string[] = [];
  const terminal: string[] = [];
  try {
    const agent = new Agent(session, new ScriptedProvider([]), [], { status: text => status.push(text), terminalSequence: sequence => terminal.push(sequence) });
    await agent.startSession("startup");
    await agent.endSession();
    assert.ok(status.some(text => text.includes("visible [31m")));
    assert.equal(status.some(text => text.includes("hidden")), false);
    assert.deepEqual(terminal, ["\u001b]2;fixture\u001b\\"]);
    const start = session.events.find(event => event.kind === "hook_result" && event.event === "SessionStart");
    assert.ok(start?.kind === "hook_result");
    assert.deepEqual(start.additionalContext, ["model context"]);
    session.close();
    const reopened = Session.open(root, { id: session.id });
    try {
      const end = reopened.events.find(event => event.kind === "hook_result" && event.event === "SessionEnd");
      assert.ok(end?.kind === "hook_result");
      assert.equal(end.suppressOutput, true); assert.deepEqual(end.systemMessages, ["hidden"]);
      assert.deepEqual(end.additionalContext, ["hidden context"]);
      assert.deepEqual(end.terminalSequences, terminal);
      const resumed = new Agent(reopened, new ScriptedProvider([]), [], { terminalSequence: sequence => terminal.push(sequence) });
      assert.ok(resumed); assert.equal(terminal.length, 1);
    } finally { reopened.close(); }
  } finally { session.close(); }
});
function hookRequest(request: ModelRequest): boolean {
  return typeof request.system === "string" && request.system.startsWith("Evaluate the configured lifecycle hook.");
}

test("prompt model hook stays a single counted call with no workspace tools", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const provider = new ScriptedProvider([request => {
    assert.equal(hookRequest(request), true);
    assert.equal(request.tools, undefined);
    assert.equal(request.model, "hook-model");
    assert.match(String(request.messages[0]!.content), /PROMPT_HOOK_FIXTURE/);
    return verdict();
  }]);
  const session = Session.open(root, { config: config(root, [effect.tool], { hooks: { PermissionRequest: [{ type: "prompt", prompt: "PROMPT_HOOK_FIXTURE", model: "hook-model" }] } }) });
  try {
    const result = await new Agent(session, provider, [effect.tool]).emitHook("PermissionRequest", { tool_name: "write_file" });
    assert.equal(result.blocked, false);
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.counts.length, 1);
    assert.equal(effect.inputs.length, 0);
    assertPaired(session.messages);
  } finally { session.close(); }
});

test("agent model hook reads real workspace evidence through exactly the read-tool allowlist", async () => {
  const root = workspace();
  write(root, "evidence.txt", "ACTUAL_WORKSPACE_EVIDENCE");
  const actual = createTools().find(tool => tool.schema.name === "read_file")!;
  assert.ok(actual);
  const allowedNames = ["list_files", "search", "notebook_read", "read_media", "memory_list", "memory_read", "lsp"];
  const other = allowedNames.map(name => spy(name, true));
  const readFalse = spy("read_file", false);
  const writeTool = spy("write_file");
  const fakeReadOnly = spy("custom_read_only", true);
  const tools = [actual, ...other.map(item => item.tool), writeTool.tool, fakeReadOnly.tool];
  const provider = new ScriptedProvider([request => {
    assert.equal(hookRequest(request), true);
    assert.deepEqual((request.tools as Anthropic.Tool[]).map(tool => tool.name).sort(), ["read_file", ...allowedNames].sort());
    assert.match(String(request.messages[0]!.content), /AGENT_HOOK_FIXTURE/);
    return response([call("read", "read_file", { path: "evidence.txt" })], "tool_use");
  }, request => {
    assert.equal(hookRequest(request), true);
    assertPaired(request.messages);
    assert.match(JSON.stringify(request.messages), /ACTUAL_WORKSPACE_EVIDENCE/);
    return verdict();
  }]);
  const session = Session.open(root, { config: config(root, tools, { hooks: { PermissionRequest: [{ type: "agent", prompt: "AGENT_HOOK_FIXTURE" }] } }) });
  try {
    const result = await new Agent(session, provider, tools).emitHook("PermissionRequest", {});
    assert.equal(result.blocked, false);
    assert.equal(provider.requests.length, 2);
    assert.equal(provider.counts.length, 2);
    assert.equal(writeTool.inputs.length, 0);
    assert.equal(fakeReadOnly.inputs.length, 0);
    assert.ok(other.every(item => item.inputs.length === 0));
    // A conventional read tool marked mutable also stays outside the hook set.
    const absentProvider = new ScriptedProvider([request => { assert.equal(request.tools, undefined); return verdict(); }]);
    const otherSession = Session.open(root, { config: config(root, [readFalse.tool], { hooks: { Notification: [{ type: "agent", prompt: "check" }] } }) });
    try { await new Agent(otherSession, absentProvider, [readFalse.tool]).emitHook("Notification", {}); } finally { otherSession.close(); }
    assert.equal(readFalse.inputs.length, 0);
  } finally { session.close(); }
});

test("agent hook pairs denied read input and attempted write as errors without effects", async () => {
  const root = workspace();
  write(root, "blocked.txt", "PRIVATE_FIXTURE_CONTENT");
  const actual = createTools().find(tool => tool.schema.name === "read_file")!;
  const mutable = spy("write_file");
  const safe = spy("list_files", true);
  const tools = [actual, safe.tool, mutable.tool];
  const provider = new ScriptedProvider([
    response([call("denied", "read_file", { path: "blocked.txt" }), call("write", "write_file", { path: "effect.txt", content: "effect" }), call("allowed", "list_files", { path: "." })], "tool_use"),
    request => {
      assertPaired(request.messages);
      const content = request.messages.at(-1)!.content;
      assert.ok(Array.isArray(content));
      const batch = content as ToolResult[];
      assert.deepEqual(batch.map(result => result.tool_use_id), ["denied", "write", "allowed"]);
      assert.equal(batch[0]!.is_error, true);
      assert.match(String(batch[0]!.content), /input denied/);
      assert.equal(batch[1]!.is_error, true);
      assert.match(String(batch[1]!.content), /unavailable/);
      assert.equal(batch[2]!.is_error, undefined);
      assert.doesNotMatch(JSON.stringify(request.messages), /PRIVATE_FIXTURE_CONTENT/);
      return verdict();
    },
  ]);
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: "default", allow: [], deny: [], inputRules: [{ tool: "read_file", path: "blocked.txt", decision: "deny" }] }, hooks: { PermissionRequest: [{ type: "agent", prompt: "check inputs" }] } }) });
  try {
    await new Agent(session, provider, tools).emitHook("PermissionRequest", {});
    assert.deepEqual(mutable.inputs, []);
    assert.deepEqual(safe.inputs, [{ path: "." }]);
    assert.equal(fs.existsSync(path.join(root, "effect.txt")), false);
    assert.equal(session.events.some(event => event.kind === "tool_start"), false);
    assertPaired(session.messages);
  } finally { session.close(); }
});

test("Agent main loop invokes configured model hook read loop and keeps hook tools out of durable batches", async () => {
  const root = workspace();
  write(root, "evidence.txt", "MAIN_LOOP_HOOK_EVIDENCE");
  const read = createTools().find(tool => tool.schema.name === "read_file")!;
  const effect = spy("mutate");
  const tools = [read, effect.tool];
  const provider = new ScriptedProvider([
    request => { assert.equal(hookRequest(request), false); return response([call("main-call", "mutate", { path: "a" })], "tool_use"); },
    request => {
      assert.equal(hookRequest(request), true);
      assert.match(String(request.messages[0]!.content), /CONFIGURED_PERMISSION_HOOK/);
      return response([call("hook-read", "read_file", { path: "evidence.txt" })], "tool_use");
    },
    request => { assert.equal(hookRequest(request), true); assert.match(JSON.stringify(request.messages), /MAIN_LOOP_HOOK_EVIDENCE/); return verdict(); },
    request => { assert.equal(hookRequest(request), false); return done(); },
  ]);
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: "ask", allow: [], deny: [] }, hooks: { PermissionRequest: [{ type: "agent", prompt: "CONFIGURED_PERMISSION_HOOK" }] } }) });
  let approved = 0;
  try {
    const result = await new Agent(session, provider, tools, { permission: async () => { approved++; return true; } }).run("main task");
    assert.equal(result.reason, "end_turn");
    assert.equal(result.modelCalls, 2);
    assert.equal(provider.requests.length, 4);
    assert.equal(provider.counts.length, 4);
    assert.equal(approved, 1);
    assert.deepEqual(effect.inputs, [{ path: "a" }]);
    assert.deepEqual(resultBatches(session).flat().map(result => result.tool_use_id), ["main-call"]);
    assert.equal(session.events.some(event => event.kind === "tool_start" && event.id === "hook-read"), false);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("agent hook accepts exactly 32 tool calls and counts the paired context again", async () => {
  const root = workspace();
  const read = spy("read_file", true);
  const provider = new ScriptedProvider([
    response(Array.from({ length: 32 }, (_, index) => call(`read-${index}`, "read_file", { path: "evidence.txt" })), "tool_use"),
    request => {
      assertPaired(request.messages);
      const content = request.messages.at(-1)!.content;
      assert.ok(Array.isArray(content));
      assert.equal(content.length, 32);
      return verdict();
    },
  ]);
  const session = Session.open(root, { config: config(root, [read.tool], { hooks: { PermissionRequest: [{ type: "agent", prompt: "batch boundary" }] } }) });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PermissionRequest", {});
    assert.equal(result.blocked, false);
    assert.equal(read.inputs.length, 32);
    assert.equal(provider.counts.length, 2);
    assert.equal(provider.requests.length, 2);
  } finally { session.close(); }
});

test("agent hook context budget is counted before any model request or tool effect", async () => {
  const root = workspace();
  const read = spy("read_file", true);
  const provider = new ScriptedProvider([]);
  const cfg = config(root, [read.tool], { hooks: { PermissionRequest: [{ type: "agent", prompt: "budget fixture" }] } });
  provider.countFn = () => cfg.compactAt;
  const session = Session.open(root, { config: cfg });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PermissionRequest", {});
    assert.equal(provider.counts.length, 1);
    assert.equal(provider.requests.length, 0);
    assert.deepEqual(read.inputs, []);
    assert.ok(result.additionalContext.some(text => text.includes("resolver failed")));
  } finally { session.close(); }
});

test("agent hook stops at eight counted calls even when model keeps requesting reads", async () => {
  const root = workspace();
  const read = spy("read_file", true);
  const provider = new ScriptedProvider(Array.from({ length: 8 }, (_, index) => request => {
    assert.equal(hookRequest(request), true);
    assertPaired(request.messages);
    return response([call(`read-${index}`, "read_file", { path: "evidence.txt" })], "tool_use");
  }));
  const session = Session.open(root, { config: config(root, [read.tool], { hooks: { PermissionRequest: [{ type: "agent", prompt: "call budget" }] } }) });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PermissionRequest", {});
    assert.equal(provider.requests.length, 8);
    assert.equal(provider.counts.length, 8);
    assert.equal(read.inputs.length, 8);
    assert.ok(result.additionalContext.some(text => text.includes("resolver failed")));
    assertPaired(session.messages);
  } finally { session.close(); }
});

test("agent hook rejects batches beyond 32 tool calls before executing any tool", async () => {
  const root = workspace();
  const read = spy("read_file", true);
  const provider = new ScriptedProvider([response(Array.from({ length: 33 }, (_, index) => call(`read-${index}`, "read_file", { path: "evidence.txt" })), "tool_use")]);
  const session = Session.open(root, { config: config(root, [read.tool], { hooks: { PermissionRequest: [{ type: "agent", prompt: "tool batch cap" }] } }) });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PermissionRequest", {});
    assert.equal(provider.requests.length, 1);
    assert.deepEqual(read.inputs, []);
    assert.ok(result.additionalContext.some(text => text.includes("resolver failed")));
  } finally { session.close(); }
});

test("prompt hook unexpected tool request terminates its single call without execution", async () => {
  const root = workspace();
  const read = spy("read_file", true);
  const mutable = spy("write_file");
  const tools = [read.tool, mutable.tool];
  const provider = new ScriptedProvider([response([call("write", "write_file", { path: "effect.txt" })], "tool_use")]);
  const session = Session.open(root, { config: config(root, tools, { hooks: { PermissionRequest: [{ type: "prompt", prompt: "single verdict" }] } }) });
  try {
    const result = await new Agent(session, provider, tools).emitHook("PermissionRequest", {});
    assert.equal(provider.requests.length, 1);
    assert.equal(provider.requests[0]!.tools, undefined);
    assert.deepEqual(mutable.inputs, []);
    assert.deepEqual(read.inputs, []);
    assert.ok(result.additionalContext.some(text => text.includes("resolver failed")));
  } finally { session.close(); }
});

test("PermissionRequest allowing updatedInput executes the replacement and exposes it to PreToolUse", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const observed = path.join(root, "pre.json");
  const cfg = config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: { path: "replacement.txt", content: "replacement" } } } }) }],
    PreToolUse: [{ command: `cat > ${shellQuote(observed)}` }],
  } });
  const provider = new ScriptedProvider([response([call("one", "write_file", { path: "original.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    const result = await new Agent(session, provider, [effect.tool], { permission: async () => { throw new Error("Hook allow must resolve approval"); } }).run("write");
    assert.equal(result.reason, "end_turn");
    assert.deepEqual(effect.inputs, [{ path: "replacement.txt", content: "replacement" }]);
    assert.deepEqual(JSON.parse(fs.readFileSync(observed, "utf8")).tool_input, effect.inputs[0]);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("PermissionRequest replacement denied by input rules produces a paired error before tool effects", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const cfg = config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [], inputRules: [{ tool: "write_file", path: "blocked.txt", decision: "deny" }] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: { path: "blocked.txt" } } } }) }],
    PermissionDenied: [{ command: emit({ additionalContext: "denial recorded" }) }],
  } });
  const provider = new ScriptedProvider([response([call("one", "write_file", { path: "original.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [effect.tool]).run("write");
    assert.deepEqual(effect.inputs, []);
    assert.ok(session.events.some(event => event.kind === "hook_start" && event.event === "PermissionDenied"));
    const result = resultBatches(session)[0]![0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /input denied/);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("approval callback exceptions leave every call paired and later calls still execute", async () => {
  const root = workspace();
  const effect = spy("mutate");
  let approvals = 0;
  const provider = new ScriptedProvider([response([call("one", "mutate", { path: "a" }), call("two", "mutate", { path: "b" })], "tool_use"), done()]);
  const session = Session.open(root, { config: config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [] } }) });
  try {
    await new Agent(session, provider, [effect.tool], { permission: async () => { if (++approvals === 1) throw new Error("approval fixture failed"); return true; } }).run("batch");
    assert.deepEqual(effect.inputs, [{ path: "b" }]);
    const batch = resultBatches(session)[0]!;
    assert.deepEqual(batch.map(result => result.tool_use_id), ["one", "two"]);
    assert.equal(batch[0]!.is_error, true);
    assert.match(String(batch[0]!.content), /approval fixture failed/);
    assert.equal(batch[1]!.is_error, undefined);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

for (const decision of ["ask", "defer"] as const) for (const approved of [true, false]) {
  test(`PreToolUse ${decision} resolves through interactive approval ${approved}`, async () => {
    const root = workspace();
    const effect = spy("mutate");
    const provider = new ScriptedProvider([response([call("gate", "mutate", { path: "effect" })], "tool_use"), done()]);
    const session = Session.open(root, { config: config(root, [effect.tool], { hooks: { PreToolUse: [{ command:
      emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision } }) }] } }) });
    let requests = 0;
    try {
      await new Agent(session, provider, [effect.tool], { permission: async request => {
        requests++; assert.equal(request.tool, "mutate"); assert.deepEqual(request.input, { path: "effect" }); return approved;
      } }).run("resolve hook approval");
      assert.equal(requests, 1);
      assert.equal(effect.inputs.length, approved ? 1 : 0);
      assert.equal(resultBatches(session)[0]![0]!.is_error === true, !approved);
      assertBatchAdjacency(session);
    } finally { session.close(); }
  });
}

test("TaskCompleted and WorktreeCreate exit 2 gate tools before spy effects", async () => {
  const root = workspace();
  const task = spy("task_update");
  const worktree = spy("worktree_create");
  const tools = [task.tool, worktree.tool];
  const provider = new ScriptedProvider([response([call("complete", "task_update", { status: "completed" }), call("tree", "worktree_create", { name: "worker" }), call("progress", "task_update", { status: "in_progress" })], "tool_use"), done()]);
  const session = Session.open(root, { config: config(root, tools, { hooks: { TaskCompleted: [{ command: "printf task-block >&2; exit 2" }], WorktreeCreate: [{ command: "printf tree-block >&2; exit 2" }] } }) });
  try {
    await new Agent(session, provider, tools).run("lifecycle gates");
    assert.deepEqual(task.inputs, [{ status: "in_progress" }]);
    assert.deepEqual(worktree.inputs, []);
    const batch = resultBatches(session)[0]!;
    assert.match(String(batch[0]!.content), /task-block/);
    assert.match(String(batch[1]!.content), /tree-block/);
    assert.equal(batch[0]!.is_error, true);
    assert.equal(batch[1]!.is_error, true);
    assert.deepEqual(session.events.filter(event => event.kind === "tool_start").map(event => event.id), ["progress"]);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("child SubagentStop block continues with active marker and respects maxTurns", async () => {
  const root = workspace();
  const capture = path.join(root, "stops.jsonl");
  const cfg = config(root, [], { childMode: "general", maxTurns: 2, hooks: {
    SubagentStop: [{ command: `cat >> ${shellQuote(capture)}; printf child-feedback >&2; exit 2` }],
    Stop: [{ command: "printf parent-stop >&2; exit 2" }],
  } });
  const provider = new ScriptedProvider([done(), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    const result = await new Agent(session, provider, []).run("child work");
    assert.equal(result.modelCalls, 2);
    assert.equal(result.reason, "turn_limit");
    assert.match(JSON.stringify(provider.requests[1]!.messages), /child-feedback/);
    assert.doesNotMatch(JSON.stringify(provider.requests), /parent-stop/);
    const inputs = fs.readFileSync(capture, "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.deepEqual(inputs.map(input => input.stop_hook_active), [false, true, true]);
    assert.ok(inputs.every(input => input.agent_id === session.id && input.agent_type === "general"));
    assert.equal(session.awaitingResponse, false);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("Stop block counter survives interrupted feedback commit and child tool work resets it", async () => {
  const root = workspace(), effect = spy("read_file", true);
  const cfg = config(root, [effect.tool], { childMode: "general", maxTurns: 20, stopHookBlockCap: 1,
    hooks: { SubagentStop: [{ command: emit({ decision: "block", reason: "continue" }) }] } });
  let session = Session.open(root, { config: cfg });
  try {
    const provider = new ScriptedProvider([done(), request => {
      assert.match(JSON.stringify(request.messages), /Stop hook feedback/);
      throw new Error("interrupted after feedback");
    }]);
    await assert.rejects(new Agent(session, provider, [effect.tool]).run("task"), /interrupted after feedback/);
    const counted = session.events.findIndex(event => event.kind === "stop_hook_count" && event.count === 1);
    const prefix = session.events.slice(0, counted + 1), file = session.file, id = session.id;
    session.close(); fs.writeFileSync(file, prefix.map(event => JSON.stringify(event)).join("\n") + "\n");
    session = Session.open(root, { id });
    const resumed = new ScriptedProvider([response([call("work", "read_file", { path: "fixture" })], "tool_use"), done(), done()]);
    const result = await new Agent(session, resumed, [effect.tool]).run();
    assert.equal(result.reason, "stop_hook_limit"); assert.equal(result.modelCalls, 3); assert.equal(effect.inputs.length, 1);
    assert.deepEqual(session.events.filter(event => event.kind === "stop_hook_count").map(event => event.count), [1, 0, 1]);
    assert.equal(session.events.filter(event => event.kind === "hook_result" && event.event === "SubagentStop").length, 3);
    assert.equal(session.awaitingResponse, false); assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("durable transformed tool_output replays after interruption without rerunning tool or hook", async () => {
  const root = workspace();
  const effect = spy("mutate");
  const hookMarker = path.join(root, "post-count");
  const cfg = config(root, [effect.tool], { hooks: { PostToolUse: [{ command: `printf x >> ${shellQuote(hookMarker)}; ${emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: { transformed: true }, additionalContext: "post feedback" } })}` }] } });
  const provider = new ScriptedProvider([response([call("saved", "mutate", {})], "tool_use"), () => { throw new Error("model interruption"); }]);
  let session = Session.open(root, { config: cfg });
  const id = session.id;
  const file = session.file;
  try {
    await assert.rejects(new Agent(session, provider, [effect.tool]).run("task"), /model interruption/);
    const savedIndex = session.events.findIndex(event => event.kind === "tool_output");
    assert.ok(savedIndex > 0);
    const saved = session.events[savedIndex]!;
    assert.equal(saved.kind, "tool_output");
    assert.equal(resultBatches(session)[0]![0]!.content, '{"transformed":true}');
    const prefix = session.events.slice(0, savedIndex + 1);
    session.close();
    // Simulate a crash after durable transformed output, before batch commit.
    fs.writeFileSync(file, prefix.map(event => JSON.stringify(event)).join("\n") + "\n");
    session = Session.open(root, { id });
    const resumed = new ScriptedProvider([done()]);
    await new Agent(session, resumed, [effect.tool]).run();
    assert.equal(effect.inputs.length, 1);
    assert.equal(fs.readFileSync(hookMarker, "utf8"), "x");
    assert.equal(resultBatches(session)[0]![0]!.content, '{"transformed":true}');
    assert.match(JSON.stringify(resumed.requests[0]!.messages), /transformed/);
    assert.doesNotMatch(JSON.stringify(resumed.requests[0]!.messages), /original tool output/);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("conditional read rules match actual tool path and append context after the full result batch", async () => {
  const root = workspace();
  const read = spy("read_file", true);
  const cfg = config(root, [read.tool], { conditionalRules: [
    { path: path.join(root, "source-rule.md"), content: "SOURCE_RULE", patterns: ["src/**/*.ts"] },
    { path: path.join(root, "test-rule.md"), content: "TEST_RULE", patterns: ["test/**"] },
  ] });
  const provider = new ScriptedProvider([response([call("one", "read_file", { path: "src/a.ts" }), call("two", "read_file", { path: "other.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [read.tool]).run("read test/example.ts");
    assert.deepEqual(read.inputs, [{ path: "src/a.ts" }, { path: "other.txt" }]);
    const messages = provider.requests[1]!.messages;
    assert.match(JSON.stringify(messages), /SOURCE_RULE/);
    assert.doesNotMatch(JSON.stringify(messages), /TEST_RULE/);
    const batch = session.messages.find(message => Array.isArray(message.content) && message.content.some(block => block.type === "tool_result"))!;
    assert.ok(Array.isArray(batch.content));
    assert.deepEqual(batch.content.slice(0, 2).map(block => block.type), ["tool_result", "tool_result"]);
    assert.ok(batch.content.slice(2).every(block => block.type === "text"));
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("first mutable rule match returns retry context before write and the next informed call executes", async () => {
  const root = workspace();
  const writeTool = spy("write_file");
  const cfg = config(root, [writeTool.tool], { conditionalRules: [{ path: path.join(root, "rule.md"), content: "PINNED_WRITE_RULE", patterns: ["src/**"] }] });
  const provider = new ScriptedProvider([
    response([call("first", "write_file", { path: "src/a.ts", content: "before review" })], "tool_use"),
    request => {
      assert.deepEqual(writeTool.inputs, []);
      assert.match(JSON.stringify(request.messages), /PINNED_WRITE_RULE/);
      return response([call("retry", "write_file", { path: "src/a.ts", content: "after review" })], "tool_use");
    },
    done(),
  ]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [writeTool.tool]).run("write");
    assert.deepEqual(writeTool.inputs, [{ path: "src/a.ts", content: "after review" }]);
    assert.equal(resultBatches(session)[0]![0]!.is_error, true);
    assert.match(String(resultBatches(session)[0]![0]!.content), /Re-evaluate/);
    assert.equal(resultBatches(session)[1]![0]!.is_error, undefined);
    assert.equal(JSON.stringify(session.messages).split("PINNED_WRITE_RULE").length - 1, 1);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("conditional rule sources and imports remain pinned through durable resume", async () => {
  const root = workspace();
  const rule = ".harness/rules/source.md";
  const imported = ".harness/rules/imported.md";
  write(root, rule, "---\npaths: [src/**]\n---\nORIGINAL_RULE\n@imported.md\n");
  write(root, imported, "---\npaths: [never/**]\n---\nORIGINAL_IMPORT\n");
  const loaded = loadProjectConfig(root, { userDir: path.join(root, "fixture-user"), paths: [] });
  assert.deepEqual(loaded.instructions, []);
  assert.ok(loaded.conditionalRules?.find(entry => entry.path.endsWith("source.md"))?.imports?.some(entry => entry.content.includes("ORIGINAL_IMPORT")));
  const writeTool = spy("write_file");
  const cfg = config(root, [writeTool.tool], { conditionalRules: loaded.conditionalRules });
  const initial = new ScriptedProvider([response([call("first", "write_file", { path: "src/a.ts" })], "tool_use"), () => { throw new Error("pause fixture"); }]);
  let session = Session.open(root, { config: cfg });
  const id = session.id;
  try {
    await assert.rejects(new Agent(session, initial, [writeTool.tool]).run("write"), /pause fixture/);
    assert.deepEqual(writeTool.inputs, []);
    session.close();
    write(root, rule, "---\npaths: [src/**]\n---\nCHANGED_RULE\n");
    write(root, imported, "CHANGED_IMPORT\n");
    session = Session.open(root, { id });
    const resumed = new ScriptedProvider([request => {
      const history = JSON.stringify(request.messages);
      assert.match(history, /ORIGINAL_RULE/);
      assert.match(history, /ORIGINAL_IMPORT/);
      assert.doesNotMatch(history, /CHANGED_RULE|CHANGED_IMPORT/);
      return response([call("retry", "write_file", { path: "src/a.ts", content: "informed" })], "tool_use");
    }, done()]);
    await new Agent(session, resumed, [writeTool.tool]).run();
    assert.deepEqual(writeTool.inputs, [{ path: "src/a.ts", content: "informed" }]);
    assert.ok(session.config.conditionalRules?.some(entry => entry.content.includes("ORIGINAL_RULE")));
    assertBatchAdjacency(session);
  } finally { session.close(); }
});
