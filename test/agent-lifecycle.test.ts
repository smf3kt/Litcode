import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { Agent, assertPaired, defaultConfig, toolCalls } from "../src/agent.js";
import { loadProjectConfig } from "../src/config.js";
import { Session, type SessionConfig, type ToolResult } from "../src/session.js";
import { listSessions } from "../src/sessions.js";
import type { ModelProvider, ModelRequest } from "../src/provider.js";
import { createTools, type ToolDefinition } from "../src/tools.js";
import { createTaskTools, readTaskRecord, readTaskRecords } from "../src/tasks.js";

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
test("instruction and file events carry the recovered payload fields", async () => {
  const root = workspace();
  const captured = path.join(root, "captured");
  fs.mkdirSync(captured);
  const sink = (name: string) => [{ command: `cat > ${shellQuote(path.join(captured, name))}` }];
  const instructionsFile = path.join(root, "HARNESS.md");
  fs.writeFileSync(instructionsFile, "fixture instructions\n");
  const hooks = { Setup: sink("setup.json"), InstructionsLoaded: sink("instructions.json"), FileChanged: sink("filechanged.json") };
  const file = spy("write_file", false);
  const session = Session.open(root, { config: config(root, [file.tool], { hooks,
    instructionSources: [{ path: instructionsFile }] }) });
  try {
    const provider = new ScriptedProvider([
      response([call("write-1", "write_file", { path: "note.txt", content: "x" })], "tool_use"),
      done(),
    ]);
    const agent = new Agent(session, provider, [file.tool], {});
    await agent.startSession("startup");
    await agent.run("write");
    const setup = JSON.parse(fs.readFileSync(path.join(captured, "setup.json"), "utf8"));
    assert.equal(setup.hook_event_name, "Setup");
    assert.equal(setup.trigger, "init");
    const instructions = JSON.parse(fs.readFileSync(path.join(captured, "instructions.json"), "utf8"));
    assert.equal(instructions.hook_event_name, "InstructionsLoaded");
    assert.equal(instructions.file_path, instructionsFile);
    assert.equal(instructions.memory_type, "Project");
    assert.equal(instructions.load_reason, "session_start");
    assert.equal("parent_file_path" in instructions, false);
    assert.equal("model" in instructions, false);
    const changed = JSON.parse(fs.readFileSync(path.join(captured, "filechanged.json"), "utf8"));
    assert.equal(changed.hook_event_name, "FileChanged");
    assert.equal(changed.file_path, path.join(root, "note.txt"));
    assert.equal(changed.event, "change");
    assert.equal("tool_name" in changed, false);
  } finally { session.close(); }
});

test("InstructionsLoaded reports imports and the path-access reasons", async () => {
  const root = workspace();
  const captured = path.join(root, "instructions.jsonl");
  const read = spy("read_file", true);
  write(root, "src/HARNESS.md", "See @imported.md\n");
  write(root, "src/imported.md", "IMPORTED");
  const rulePath = path.join(root, "rule.md");
  const importPath = path.join(root, "rule-import.md");
  fs.writeFileSync(rulePath, "RULE");
  fs.writeFileSync(importPath, "RULE_IMPORT");
  const session = Session.open(root, { config: config(root, [read.tool], {
    dynamicInstructions: true,
    hooks: { InstructionsLoaded: [{ command: `cat >> ${shellQuote(captured)}` }] },
    instructionSources: [{ path: path.join(root, "HARNESS.md") }],
    conditionalRules: [{ path: rulePath, content: "RULE", patterns: ["src/**/*.ts"],
      imports: [{ path: importPath, content: "RULE_IMPORT", parent: rulePath }] }],
  }) });
  try {
    const provider = new ScriptedProvider([response([call("one", "read_file", { path: "src/a.ts" })], "tool_use"), done()]);
    const agent = new Agent(session, provider, [read.tool]);
    await agent.startSession("startup");
    await agent.run("read");
    const events = fs.readFileSync(captured, "utf8").trim().split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(events.map(event => [path.basename(String(event.file_path)), event.load_reason]), [
      ["HARNESS.md", "session_start"],
      ["HARNESS.md", "nested_traversal"],
      ["imported.md", "include"],
      ["rule.md", "path_glob_match"],
      ["rule-import.md", "include"],
    ]);
    const [, nested, imported, rule, ruleImport] = events;
    assert.equal(nested!.trigger_file_path, path.join(root, "src", "a.ts"));
    assert.equal("parent_file_path" in nested!, false);
    assert.equal(imported!.parent_file_path, path.join(root, "src", "HARNESS.md"));
    assert.deepEqual(rule!.globs, ["src/**/*.ts"]);
    assert.equal(rule!.trigger_file_path, path.join(root, "src", "a.ts"));
    assert.equal(ruleImport!.parent_file_path, rulePath);
    assert.ok(events.every(event => event.memory_type === "Project"));
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
    assert.equal(session.messages.some(message => message.content === "The PermissionDenied hook indicated you may retry this tool call."), false);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("PermissionDenied retry adds the recovered hint after the denied tool result", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const cfg = config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [], inputRules: [{ tool: "write_file", path: "blocked.txt", decision: "deny" }] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: { path: "blocked.txt" } } } }) }],
    PermissionDenied: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionDenied", retry: true } }) }],
  } });
  const provider = new ScriptedProvider([response([call("one", "write_file", { path: "original.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [effect.tool]).run("write");
    assert.deepEqual(effect.inputs, []);
    const batchIndex = session.messages.findIndex(message => Array.isArray(message.content) && message.content.some(block => block.type === "tool_result"));
    const hintIndex = session.messages.findIndex(message => message.content === "The PermissionDenied hook indicated you may retry this tool call.");
    assert.equal(hintIndex, batchIndex + 1);
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
  const capture = path.join(root, "worktree-create.jsonl");
  const task = spy("task_update");
  const worktree = spy("worktree_create");
  const tools = [task.tool, worktree.tool];
  const provider = new ScriptedProvider([response([call("complete", "task_update", { status: "completed" }), call("tree", "worktree_create", { name: "worker" }), call("progress", "task_update", { status: "in_progress" })], "tool_use"), done()]);
  const session = Session.open(root, { config: config(root, tools, { hooks: { TaskCompleted: [{ command: "printf task-block >&2; exit 2" }], WorktreeCreate: [{ command: `cat >> ${shellQuote(capture)}; printf tree-block >&2; exit 2` }] } }) });
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
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.name, "worker");
    assert.equal(payload.hook_event_name, "WorktreeCreate");
    assert.equal("tool_name" in payload, false);
    assert.equal("tool_input" in payload, false);
  } finally { session.close(); }
});

test("WorktreeRemove receives the removed worktree path only", async () => {
  const root = workspace();
  const capture = path.join(root, "worktree-remove.jsonl");
  const remove = spy("worktree_remove");
  const tools = [remove.tool];
  const provider = new ScriptedProvider([response([call("prune", "worktree_remove", { name: "worker" })], "tool_use"), done()]);
  const session = Session.open(root, { config: config(root, tools, { hooks: {
    WorktreeRemove: [{ command: `cat >> ${shellQuote(capture)}` }] } }) });
  try {
    await new Agent(session, provider, tools).run("worktree removal");
    assert.deepEqual(remove.inputs, [{ name: "worker" }]);
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.worktree_path, path.join(root, ".harness-worktrees", "worker"));
    assert.equal(payload.hook_event_name, "WorktreeRemove");
    assert.equal("tool_name" in payload, false);
    assert.equal("tool_response" in payload, false);
  } finally { session.close(); }
});

test("MessageDisplay receives the recovered delta fields and rewrites only the displayed text", async () => {
  const root = workspace();
  const capture = path.join(root, "message-display.jsonl");
  const hooks = { MessageDisplay: [{ command: `cat >> ${shellQuote(capture)}; ${emit({ hookSpecificOutput: {
    hookEventName: "MessageDisplay", displayContent: "rewritten display" } })}` }] };
  const provider = new ScriptedProvider([response([{ type: "text", text: "original text" }])]);
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  try {
    const result = await new Agent(session, provider, []).run("say something");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.hook_event_name, "MessageDisplay");
    assert.match(String(payload.turn_id), /^[0-9a-f-]{36}$/);
    assert.match(String(payload.message_id), /^[0-9a-f-]{36}$/);
    assert.equal(payload.index, 0);
    assert.equal(payload.final, true);
    assert.equal(payload.delta, "original text");
    assert.equal(result.text, "rewritten display");
    assert.match(JSON.stringify(session.messages), /original text/);
    assert.doesNotMatch(JSON.stringify(session.messages), /rewritten display/);
  } finally { session.close(); }
});

test("PreCompact receives custom instructions and hook stdout becomes Additional Instructions", async () => {
  const root = workspace();
  const capture = path.join(root, "pre-compact.jsonl");
  const hooks = { PreCompact: [{ command: `cat >> ${shellQuote(capture)}; printf '%s' 'hook instruction'` }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  session.append({ kind: "message", message: { role: "user", content: "hello" } });
  session.append({ kind: "message", message: { role: "assistant", content: [{ type: "text", text: "hi" }] } });
  session.append({ kind: "turn_end", reason: "end_turn" });
  const provider = new ScriptedProvider([response([{ type: "text", text: "summary text" }])]);
  try {
    await new Agent(session, provider, []).compactContext(new AbortController().signal, "user instruction");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.hook_event_name, "PreCompact");
    assert.equal(payload.trigger, "manual");
    assert.equal(payload.custom_instructions, "user instruction");
    const last = provider.requests[0]!.messages.at(-1)!;
    const text = typeof last.content === "string" ? last.content :
      last.content.map(block => block.type === "text" ? block.text : "").join("");
    assert.ok(text.includes("Additional Instructions:\nhook instruction\n\nUser context: user instruction"));
    assert.ok(session.events.some(event => event.kind === "compact" && event.summary === "summary text"));
  } finally { session.close(); }
});

test("UserPromptSubmit omits source and carries the recorded session title", async () => {
  const root = workspace();
  const capture = path.join(root, "user-prompt-submit.jsonl");
  const hooks = { UserPromptSubmit: [{ command: `cat >> ${shellQuote(capture)}` }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  session.append({ kind: "title", title: "Recorded title" });
  try {
    await new Agent(session, new ScriptedProvider([done()]), []).run("hello");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.hook_event_name, "UserPromptSubmit");
    assert.equal(payload.prompt, "hello");
    assert.equal(payload.session_title, "Recorded title");
    assert.equal("source" in payload, false);
  } finally { session.close(); }
});

test("Stop carries the runtime-provided background jobs and session cron tasks", async () => {
  const root = workspace();
  const capture = path.join(root, "stop-runtime-state.jsonl");
  const hooks = { Stop: [{ command: `cat >> ${shellQuote(capture)}` }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  const cronPrompt = "x".repeat(1001);
  const agentEvents = { stopState: () => ({
    background_tasks: [{ id: "job-1", type: "shell", status: "running", description: "tail", command: "sleep 60" }],
    session_crons: [{ id: "cron-1", schedule: "*/5 * * * *", recurring: true, prompt: cronPrompt }],
  }) };
  try {
    await new Agent(session, new ScriptedProvider([done()]), [], agentEvents).run("hello");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.deepEqual(payload.background_tasks,
      [{ id: "job-1", type: "shell", status: "running", description: "tail", command: "sleep 60" }]);
    const crons = payload.session_crons as Array<Record<string, unknown>>;
    assert.equal(crons.length, 1);
    assert.equal(crons[0]!.id, "cron-1");
    assert.equal(crons[0]!.schedule, "*/5 * * * *");
    assert.equal(crons[0]!.recurring, true);
    assert.equal(crons[0]!.prompt, cronPrompt);
  } finally { session.close(); }
});

test("SubagentStart additional context reaches the child's first request", async () => {
  const root = workspace();
  const hooks = { SubagentStart: [{ command: emit({ hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: "child start context" } }) }] };
  const child = Session.open(root, { config: config(root, [], { childMode: "general", hooks }) });
  const childProvider = new ScriptedProvider([done()]);
  try {
    const agent = new Agent(child, childProvider, []);
    await agent.startSession("startup");
    await agent.run("hello");
    assert.match(JSON.stringify(childProvider.requests[0]!.messages), /Hook context:\\nchild start context/);
  } finally { child.close(); }
  const otherRoot = workspace();
  const top = Session.open(otherRoot, { config: config(otherRoot, [], { hooks }) });
  const topProvider = new ScriptedProvider([done()]);
  try {
    const agent = new Agent(top, topProvider, []);
    await agent.startSession("startup");
    await agent.run("hello");
    assert.equal(top.events.some(event => event.kind === "hook_start" && event.event === "SubagentStart"), false);
    assert.doesNotMatch(JSON.stringify(topProvider.requests[0]!.messages), /child start context/);
  } finally { top.close(); }
});

test("Setup additional context reaches the startup request", async () => {
  const root = workspace();
  const hooks = { Setup: [{ command: emit({ hookSpecificOutput: { hookEventName: "Setup", additionalContext: "setup context" } }) }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  const provider = new ScriptedProvider([done()]);
  try {
    const agent = new Agent(session, provider, []);
    await agent.startSession("startup");
    await agent.run("hello");
    assert.match(JSON.stringify(provider.requests[0]!.messages), /Hook context:\\nsetup context/);
  } finally { session.close(); }
  const otherRoot = workspace();
  const resumed = Session.open(otherRoot, { config: config(otherRoot, [], { hooks }) });
  try {
    await new Agent(resumed, new ScriptedProvider([]), []).startSession("resume");
    assert.equal(resumed.events.some(event => event.kind === "hook_start" && event.event === "Setup"), false);
  } finally { resumed.close(); }
});

test("PostModelSwitch additional context reaches exactly the next request", async () => {
  const root = workspace();
  const hooks = { PostModelSwitch: [{ command: emit({ hookSpecificOutput: { hookEventName: "PostModelSwitch", additionalContext: "model switched context" } }) }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  const provider = new ScriptedProvider([done(), done()]);
  try {
    const agent = new Agent(session, provider, []);
    await agent.emitHook("PostModelSwitch", { from_model: "a", to_model: "b", requested_model: "b" });
    await agent.run("first");
    assert.match(JSON.stringify(provider.requests[0]!.messages), /Hook context:\\nmodel switched context/);
    await agent.run("second");
    assert.equal(JSON.stringify(provider.requests[1]!.messages).split("model switched context").length - 1, 1);
  } finally { session.close(); }
});

test("SessionStart carries the child agent type and the recorded session title", async () => {
  const root = workspace();
  const capture = path.join(root, "session-start.jsonl");
  const hooks = { SessionStart: [{ command: `cat >> ${shellQuote(capture)}` }] };
  const session = Session.open(root, { config: config(root, [], { childMode: "general", hooks }) });
  session.append({ kind: "title", title: "Fixture title" });
  try {
    await new Agent(session, new ScriptedProvider([]), []).startSession("startup");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.hook_event_name, "SessionStart");
    assert.equal(payload.source, "startup");
    assert.equal(payload.model, "fixture-model");
    assert.equal(payload.agent_type, "general");
    assert.equal(payload.session_title, "Fixture title");
  } finally { session.close(); }
});

test("SessionStart and UserPromptSubmit hook titles are normalized and recorded", async () => {
  const root = workspace();
  const hooks = {
    SessionStart: [{ command: emit({ hookSpecificOutput: { hookEventName: "SessionStart", sessionTitle: "  Start\u0000 title  " } }) }],
    UserPromptSubmit: [{ command: emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", sessionTitle: "Submit\u2028title" } }) }],
  };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  try {
    await new Agent(session, new ScriptedProvider([done()]), []).startSession("startup");
    assert.deepEqual(session.events.filter(event => event.kind === "title").map(event => event.kind === "title" && event.title),
      ["Start  title"]);
    await new Agent(session, new ScriptedProvider([done()]), []).run("prompt");
    assert.deepEqual(session.events.filter(event => event.kind === "title").map(event => event.kind === "title" && event.title),
      ["Start  title", "Submit title"]);
  } finally { session.close(); }
  const resumed = Session.open(root, { id: session.id });
  try { assert.equal(listSessions(root).find(item => item.id === resumed.id)?.title, "Submit title"); }
  finally { resumed.close(); }
});

test("a clear start ignores the SessionStart hook title", async () => {
  const root = workspace();
  const hooks = { SessionStart: [{ command: emit({ hookSpecificOutput: { hookEventName: "SessionStart", sessionTitle: "Ignored" } }) }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  try {
    await new Agent(session, new ScriptedProvider([]), []).startSession("clear");
    assert.equal(session.events.some(event => event.kind === "title"), false);
  } finally { session.close(); }
});

test("SessionStart initialUserMessage is returned for the caller to queue", async () => {
  const root = workspace();
  const hooks = { SessionStart: [
    { command: emit({ hookSpecificOutput: { hookEventName: "SessionStart", initialUserMessage: "first message" } }) },
    { command: emit({ hookSpecificOutput: { hookEventName: "SessionStart", initialUserMessage: "second message" } }) },
  ] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  try {
    const agent = new Agent(session, new ScriptedProvider([done()]), []);
    assert.deepEqual(await agent.startSession("startup"), { initialUserMessage: "second message" });
    // The value stays out of the transcript until the caller starts the turn;
    // a lone stored user message would make the session look unfinished.
    assert.equal(session.events.some(event => event.kind === "message"), false);
    assert.equal(session.awaitingResponse, false);
    await agent.run("typed prompt");
    assert.equal(session.awaitingResponse, false);
  } finally { session.close(); }
});

test("SessionStart reloadSkills refreshes the live skill catalog", async () => {
  const root = workspace();
  const user = path.join(root, "user");
  fs.mkdirSync(user);
  const skillDir = path.join(root, ".harness/skills/hooked");
  const command = `mkdir -p ${shellQuote(skillDir)} && printf %s ` +
    `${shellQuote("---\nname: hooked\ndescription: Hooked skill\n---\nHooked body")} > ${shellQuote(path.join(skillDir, "SKILL.md"))} && ` +
    emit({ hookSpecificOutput: { hookEventName: "SessionStart", reloadSkills: true } });
  const hooks = { SessionStart: [{ command }] };
  const session = Session.open(root, { config: config(root, [], { hooks, skills: [], configSources: { userDir: user } }) });
  try {
    const live = session.config.skills;
    assert.ok(live);
    await new Agent(session, new ScriptedProvider([done()]), []).startSession("startup");
    // The skill tool captured the original array; it now sees the installed skill.
    assert.equal(session.config.skills, live);
    assert.deepEqual(live.map(target => target.name), ["hooked"]);
    assert.match(session.config.system, /Hooked skill/);
  } finally { session.close(); }
});

test("TaskCreated receives the created task's fields and a block rolls the task back", async () => {
  const root = workspace();
  const capture = path.join(root, "task-created.jsonl");
  const tools = createTaskTools(root);
  const provider = new ScriptedProvider([
    response([call("create", "task_create", { subject: "Created subject", description: "Created description" })], "tool_use"),
    done(),
  ]);
  const hooks = { TaskCreated: [{ command: `cat >> ${shellQuote(capture)}; printf created-block >&2; exit 2` }] };
  const session = Session.open(root, { config: config(root, tools, { hooks }) });
  try {
    await new Agent(session, provider, tools).run("create a task");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.hook_event_name, "TaskCreated");
    assert.match(String(payload.task_id), /^[0-9a-f-]{36}$/);
    assert.equal(payload.task_subject, "Created subject");
    assert.equal(payload.task_description, "Created description");
    assert.equal("tool_name" in payload, false);
    assert.equal("tool_input" in payload, false);
    assert.equal("tool_response" in payload, false);
    assert.deepEqual(readTaskRecords(root), []);
    const result = resultBatches(session)[0]![0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /TaskCreated hook feedback:\ncreated-block/);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("TaskCreated additional context leaves the created task in place", async () => {
  const root = workspace();
  const tools = createTaskTools(root);
  const provider = new ScriptedProvider([
    response([call("create", "task_create", { subject: "Kept subject", description: "Kept description" })], "tool_use"),
    done(),
  ]);
  const capture = path.join(root, "task-created-context.jsonl");
  const hooks = { TaskCreated: [{ command: `cat >> ${shellQuote(capture)}; ${emit({ hookSpecificOutput: { hookEventName: "TaskCreated", additionalContext: "created-context" } })}` }] };
  const session = Session.open(root, { config: config(root, tools, { hooks }) });
  try {
    await new Agent(session, provider, tools).run("create a task");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.task_subject, "Kept subject");
    assert.equal(payload.task_description, "Kept description");
    const records = readTaskRecords(root);
    assert.equal(records.length, 1);
    assert.equal(records[0]!.subject, "Kept subject");
    assert.equal(records[0]!.status, "pending");
    const batch = resultBatches(session)[0]![0]!;
    assert.equal(batch.is_error, undefined);
    assert.match(String(batch.content), /Kept subject/);
    const texts = session.messages.flatMap(message => typeof message.content === "string" ? [] :
      message.content.filter(block => block.type === "text").map(block => block.text));
    assert.ok(texts.includes("Hook context:\ncreated-context"));
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

async function createDirectTask(root: string, subject: string, description: string): Promise<string> {
  const create = createTaskTools(root)[0]!;
  const content = await create.execute({ subject, description }, {
    workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000,
  });
  return (JSON.parse(content) as { id: string }).id;
}

test("TaskCompleted receives the task metadata and blocks before the update", async () => {
  const root = workspace();
  const capture = path.join(root, "task-completed.jsonl");
  const tools = createTaskTools(root);
  const id = await createDirectTask(root, "Done subject", "Done description");
  const provider = new ScriptedProvider([
    response([call("complete", "task_update", { id, status: "completed" })], "tool_use"),
    done(),
  ]);
  const hooks = { TaskCompleted: [{ command: `cat >> ${shellQuote(capture)}; printf done-block >&2; exit 2` }] };
  const session = Session.open(root, { config: config(root, tools, { hooks }) });
  try {
    await new Agent(session, provider, tools).run("complete it");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.hook_event_name, "TaskCompleted");
    assert.equal(payload.task_id, id);
    assert.equal(payload.task_subject, "Done subject");
    assert.equal(payload.task_description, "Done description");
    assert.equal("teammate_name" in payload, false);
    assert.equal("tool_name" in payload, false);
    assert.equal("tool_input" in payload, false);
    assert.equal(readTaskRecord(root, id)?.status, "pending");
    const result = resultBatches(session)[0]![0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /done-block/);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("TaskCompleted teammate_name follows the task owner", async () => {
  const root = workspace();
  const capture = path.join(root, "task-completed-owner.jsonl");
  const tools = createTaskTools(root);
  const id = await createDirectTask(root, "Owned subject", "Owned description");
  await tools[3]!.execute({ id, owner: "alice" }, {
    workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000,
  });
  const provider = new ScriptedProvider([
    response([call("complete", "task_update", { id, status: "completed" })], "tool_use"),
    done(),
  ]);
  const hooks = { TaskCompleted: [{ command: `cat >> ${shellQuote(capture)}` }] };
  const session = Session.open(root, { config: config(root, tools, { hooks }) });
  try {
    await new Agent(session, provider, tools).run("complete it");
    const payload = JSON.parse(fs.readFileSync(capture, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.task_id, id);
    assert.equal(payload.task_subject, "Owned subject");
    assert.equal(payload.task_description, "Owned description");
    assert.equal(payload.teammate_name, "alice");
    assert.equal(readTaskRecord(root, id)?.status, "completed");
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
    assert.ok(inputs.every(input => input.agent_transcript_path === session.file));
    assert.ok(inputs.every(input => !("reason" in input)));
    assert.ok(inputs.every(input => input.last_assistant_message === "done"));
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

test("SessionEnd maps close causes onto the recovered reason enum", async () => {
  const root = workspace();
  const captured = path.join(root, "session-end.jsonl");
  const session = Session.open(root, { config: config(root, [], { hooks: {
    SessionEnd: [{ command: `cat >> ${shellQuote(captured)}` }] } }) });
  const cases = [["session_switch", "resume"], ["config_changed", "other"], ["interrupt", "other"],
    ["clear", "clear"], ["exit", "prompt_input_exit"], ["rewind", "other"]] as const;
  try {
    for (const [cause] of cases) await new Agent(session, new ScriptedProvider([]), []).endSession(cause);
    const reasons = fs.readFileSync(captured, "utf8").trim().split("\n").map(line => JSON.parse(line) as { reason?: string });
    assert.deepEqual(reasons.map(event => event.reason), cases.map(([, reason]) => reason));
  } finally { session.close(); }
});

test("StopFailure carries the recovered error fields without stop_reason", async () => {
  const root = workspace();
  const captured = path.join(root, "stop-failure.jsonl");
  const session = Session.open(root, { config: config(root, [], { hooks: {
    StopFailure: [{ command: `cat >> ${shellQuote(captured)}` }] } }) });
  try {
    const provider = new ScriptedProvider([response([{ type: "text", text: "partial text" }], "max_tokens")]);
    const result = await new Agent(session, provider, []).run("fail");
    assert.equal(result.reason, "max_tokens");
    const payload = JSON.parse(fs.readFileSync(captured, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.error, "max_tokens");
    assert.equal(payload.last_assistant_message, "partial text");
    assert.equal("stop_reason" in payload, false);
  } finally { session.close(); }
});

test("UserPromptExpansion is raised only for an expansion and carries its recovered fields", async () => {
  const root = workspace();
  const captured = path.join(root, "expansions.jsonl");
  const rewrite = JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptExpansion",
    updatedPrompt: "/greet rewritten", additionalContext: "expansion context" } });
  const session = Session.open(root, { config: config(root, [], { hooks: {
    UserPromptExpansion: [{ command: `cat >> ${shellQuote(captured)}; printf '%s' ${shellQuote(rewrite)}` }] } }) });
  try {
    await new Agent(session, new ScriptedProvider([done()]), []).run("plain prompt");
    assert.equal(fs.existsSync(captured), false);
    const provider = new ScriptedProvider([done()]);
    await new Agent(session, provider, []).run("expanded skill body",
      new AbortController().signal, undefined, { expansion_type: "slash_command",
        command_name: "greet", command_args: "world", command_source: "projectSettings", prompt: "/greet world" });
    const payload = JSON.parse(fs.readFileSync(captured, "utf8").trim()) as Record<string, unknown>;
    assert.equal(payload.expansion_type, "slash_command");
    assert.equal(payload.command_name, "greet");
    assert.equal(payload.command_args, "world");
    assert.equal(payload.command_source, "projectSettings");
    assert.equal(payload.prompt, "/greet world");
    const messages = JSON.stringify(provider.requests[0]!.messages);
    assert.match(messages, /expanded skill body/);
    assert.equal(messages.includes("/greet rewritten"), false);
    assert.match(messages, /expansion context/);
  } finally { session.close(); }
});
