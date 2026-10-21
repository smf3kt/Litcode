import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { classifierTranscript, serializeAutoTool } from '../src/auto-classifier-transcript.js';
import { classifierMessage } from '../src/message-origin.js';
import { after, test } from "node:test";
import { execFileSync } from 'node:child_process';
import type Anthropic from "@anthropic-ai/sdk";
import { Agent, assertPaired, defaultConfig, toolCalls } from "../src/agent.js";
import { loadProjectConfig } from "../src/config.js";
import { reloadConfig } from '../src/reload.js';
import { InteractivePlanResume, permissionModeCommand, permissionModeCommandSchema, planHistoryState, transitionPlanMode } from '../src/plan-resume.js';
import { forkSession } from '../src/sessions.js';
import { checkpointConversation, previewRewind, applyRewind } from '../src/rewind.js';
import { permissionDecision } from '../src/permissions.js';
import { executeSkill } from '../src/skill-runtime.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { createSubagentTool } from '../src/subagents.js';
import { Session, type SessionConfig, type ToolResult } from "../src/session.js";
import { listSessions } from "../src/sessions.js";
import type { ModelProvider, ModelRequest } from "../src/provider.js";
import { createTools, type ToolDefinition } from "../src/tools.js";
import { createTaskTools, readTaskRecord, readTaskRecords } from "../src/tasks.js";
import { StatusLine } from '../src/tui-statusline.js';
import { createNotebookTools } from '../src/notebooks.js';
import { createMediaTools } from '../src/media.js';

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

test("PermissionRequest deny with interrupt aborts the turn before the tool runs", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const statuses: string[] = [];
  const cfg = config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest",
      decision: { behavior: "deny", message: "stop the turn", interrupt: true } } }) }],
  } });
  const provider = new ScriptedProvider([response([call("one", "write_file", { path: "effect.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  const turn = new AbortController();
  try {
    const result = await new Agent(session, provider, [effect.tool], {
      status: text => statuses.push(text),
      interruptTurn: () => turn.abort(new Error("Hook interrupt")),
    }).run("write", turn.signal);
    assert.equal(result.reason, "aborted");
    assert.deepEqual(effect.inputs, []);
    assert.ok(statuses.includes("Hook interrupt: tool=write_file hookMessage=stop the turn"));
    const results = resultBatches(session)[0]!;
    assert.equal(results[0]!.is_error, true);
    assert.match(String(results[0]!.content), /stop the turn/);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("PermissionRequest allow applies session permission updates before the call runs", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const cfg = config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest",
      decision: { behavior: "allow", updatedPermissions: [{ type: "setMode", mode: "plan", destination: "session" }] } } }) }],
  } });
  const provider = new ScriptedProvider([
    response([call("one", "write_file", { path: "one.txt" })], "tool_use"),
    response([call("two", "write_file", { path: "two.txt" })], "tool_use"),
    done(),
  ]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [effect.tool]).run("write");
    // The first call was allowed by the answer and the adopted plan mode then
    // refuses the second before any hook or prompt.
    assert.deepEqual(effect.inputs, [{ path: "one.txt" }]);
    const batches = resultBatches(session);
    assert.equal(batches.length, 2);
    assert.equal(batches[0]![0]!.is_error, undefined);
    assert.match(String(batches[1]![0]!.content), /Plan mode permits read-only tools: write_file/);
  } finally { session.close(); }
});

test("permission destination owner applies memory first, preserves files and drains only its writes", async () => {
  const root = workspace(), userDir = path.join(root, "user");
  const effect = spy("write_file");
  const cfg = config(root, [effect.tool], { configSources: { userDir }, permissions: { mode: "ask", allow: [], deny: [] } });
  const first = Session.open(root, { config: cfg }), second = Session.open(root, { config: cfg });
  const userFile = path.join(userDir, "settings.json");
  const projectFile = path.join(root, ".harness", "settings.json");
  const localFile = path.join(root, ".harness", "settings.local.json");
  write(root, "user/settings.json", JSON.stringify({ theme: "dark", permissions: { allow: ["existing"], deny: ["preserved"] } }));
  write(root, ".harness/settings.local.json", "{broken");
  try {
    first.adoptPermissionUpdates([
      { type: "addRules", behavior: "allow", destination: "userSettings", rules: [{ toolName: "write_file" }] },
      { type: "addRules", behavior: "deny", destination: "projectSettings", rules: [{ toolName: "read_file" }] },
      { type: "addRules", behavior: "ask", destination: "localSettings", rules: [{ toolName: "other" }] },
      { type: "addRules", behavior: "deny", destination: "session", rules: [{ toolName: "session_only" }] },
      { type: "addRules", behavior: "ask", destination: "cliArg", rules: [{ toolName: "cli_only" }] },
    ]);
    assert.deepEqual(first.permissionUpdates.alwaysAllowRules.userSettings, ["write_file"]);
    assert.equal(fs.existsSync(projectFile), false);
    const provider = new ScriptedProvider([response([call("current", "write_file", { path: "current" })], "tool_use"), done()]);
    await new Agent(first, provider, [effect.tool]).run("write");
    assert.deepEqual(effect.inputs, [{ path: "current" }]);
    const results = await first.drainPermissionWrites();
    assert.deepEqual(results.map(result => [result.destination, result.outcome]).sort(), [
      ["cliArg", "skipped"], ["localSettings", "error"], ["projectSettings", "written"],
      ["session", "skipped"], ["userSettings", "written"],
    ]);
    assert.deepEqual(JSON.parse(fs.readFileSync(userFile, "utf8")), {
      theme: "dark", permissions: { allow: ["existing", "write_file"], deny: ["preserved"] },
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(projectFile, "utf8")), { permissions: { deny: ["read_file"] } });
    assert.equal(fs.readFileSync(localFile, "utf8"), "{broken");
    assert.equal(results.find(result => result.outcome === "error")?.file, localFile);
    assert.match(results.find(result => result.outcome === "error")?.error ?? "", /JSON|position|property/i);
    assert.deepEqual(first.permissionUpdates.alwaysAskRules.localSettings, ["other"]);

    first.adoptPermissionUpdates([{ type: "addRules", behavior: "allow", destination: "userSettings", rules: [{ toolName: "first" }] }]);
    for (let index = 0; index < 20; index++) second.adoptPermissionUpdates([
      { type: "addRules", behavior: "allow", destination: "userSettings", rules: [{ toolName: `second_${index}` }] },
    ]);
    await first.drainPermissionWrites();
    assert.equal(second.permissionWriteResults.length < 20, true, "own drain leaves later unrelated owner writes pending");
    await second.close();
    const saved = JSON.parse(fs.readFileSync(userFile, "utf8"));
    assert.deepEqual(saved.permissions.allow, ["existing", "write_file", "first", ...Array.from({ length: 20 }, (_, index) => `second_${index}`)]);
    assert.deepEqual(saved.permissions.deny, ["preserved"]);
    assert.equal(second.permissionWriteResults.length, 20);
    const ignoreFixture = workspace();
    const ignoreEvidence = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
      import {execFileSync,spawnSync} from 'node:child_process';
      import {ignorePermissionSettings,persistPermissionUpdate} from './src/permission-settings.ts';
      import {Session} from './src/session.ts'; import {defaultConfig} from './src/agent.ts';
      const base=process.argv[1], git=(cwd,args)=>spawnSync('git',args,{cwd,encoding:'utf8'});
      const home=path.join(base,'home'); fs.mkdirSync(home);
      process.env.HOME=home; process.env.XDG_CONFIG_HOME=path.join(home,'xdg');
      process.env.GIT_CONFIG_GLOBAL=path.join(home,'gitconfig'); process.env.GIT_CONFIG_NOSYSTEM='1';
      process.env.GIT_CONFIG_SYSTEM=path.join(home,'absent');
      for(const key of Object.keys(process.env)) if(/^GIT_CONFIG_(COUNT|KEY_\\d+|VALUE_\\d+|PARAMETERS)$/.test(key)||
        ['GIT_DIR','GIT_WORK_TREE','GIT_COMMON_DIR','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES'].includes(key)) delete process.env[key];
      const update={type:'replaceRules',destination:'localSettings',behavior:'allow',rules:[]};
      const rows=[];
      for(const kind of ['default','explicit','tilde','relative','tracked','duplicate','already','error']) {
        const root=path.join(base,kind); fs.mkdirSync(root); assert.equal(git(root,['init','--quiet']).status,0);
        const xdg=path.join(home,kind); process.env.XDG_CONFIG_HOME=xdg;
        fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL,'');
        let file=path.join(xdg,'git','ignore');
        const configured=kind==='explicit'?path.join(home,'explicit-ignore'):kind==='tilde'?'~/tilde-ignore':kind==='relative'?'relative-ignore':undefined;
        if(configured) { assert.equal(git(root,['config','--global','core.excludesfile',configured]).status,0);
          if(kind!=='relative') file=kind==='tilde'?path.join(home,'tilde-ignore'):configured; }
        fs.mkdirSync(path.join(root,'.harness')); const local=path.join(root,'.harness/settings.local.json');
        fs.writeFileSync(local,JSON.stringify({future:1,permissions:{allow:[]}}));
        if(kind==='tracked'||kind==='duplicate') assert.equal(git(root,['add','--', '.harness/settings.local.json']).status,0);
        if(kind==='duplicate'||kind==='already') {fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,'**/.harness/settings.local.json\\n');}
        if(kind==='error') {fs.mkdirSync(xdg,{recursive:true});fs.writeFileSync(path.join(xdg,'git'),'blocked');}
        const cfg={...defaultConfig(root,[]),model:'fixture-model',configSources:{userDir:path.join(home,'user')}};
        const owner=Session.open(root,{config:cfg}), unrelated=Session.open(root,{config:cfg});
        owner.adoptPermissionUpdates([update]);
        assert.equal(owner.permissionIgnoreResults.length,0,'adoption stays asynchronous');
        await owner.close(); await unrelated.close();
        assert.equal(unrelated.permissionIgnoreResults.length,0);
        assert.equal(owner.permissionIgnoreResults.length,1);
        const result=owner.permissionIgnoreResults[0];
        assert.equal(JSON.parse(fs.readFileSync(local)).future,1);
        if(kind==='error') {assert.equal(result.written,false);assert.equal(result.effective,false);assert.match(result.error,/global gitignore/);}
        else {assert.equal(result.written,!['duplicate','already'].includes(kind));
          assert.equal(result.effective,!['relative','tracked','duplicate'].includes(kind));
          if(kind==='tracked'||kind==='duplicate') assert.equal(result.reason,'already_tracked');
          if(kind==='relative') assert.equal(result.reason,'excludesfile_not_read');
          assert.equal(fs.readFileSync(file,'utf8').split('**/.harness/settings.local.json').length-1,1);}
        const scheduled=[]; const context={workspace:root,schedule:p=>scheduled.push(p)};
        await persistPermissionUpdate({...update,type:'addRules',rules:[]},{localSettings:local},false,context);
        assert.equal(scheduled.length,0,'null transform skips ignore');
        await persistPermissionUpdate(update,{localSettings:local},false,context);
        assert.equal(scheduled.length,1,'non-null equal transform writes and schedules'); await Promise.all(scheduled);
        rows.push(kind);
      }
      const root=path.join(base,'default'), local=path.join(root,'.harness/settings.local.json');
      const legacy=path.join(root,'legacy.json');fs.writeFileSync(legacy,JSON.stringify({permissions:{allow:42}}));
      const scheduled=[], context={workspace:root,schedule:p=>scheduled.push(p)};
      const result=await persistPermissionUpdate({...update,type:'removeRules'},{localSettings:local,legacyLocalSettings:legacy},false,context);
      assert.equal(result.outcome,'error');assert.equal(scheduled.length,1);await Promise.all(scheduled);
      fs.writeFileSync(local,'{broken'); scheduled.length=0;
      assert.equal((await persistPermissionUpdate(update,{localSettings:local},false,context)).outcome,'error');
      assert.equal(scheduled.length,0,'outer failure skips ignore');
      fs.rmSync(path.join(base,'.git'),{recursive:true});
      const outside=path.join(base,'outside'); fs.mkdirSync(outside);
      assert.deepEqual(await ignorePermissionSettings('.harness/settings.local.json',outside),{written:false,effective:false});
      process.env.XDG_CONFIG_HOME=path.join(home,'directory'); fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL,'');
      assert.deepEqual(await ignorePermissionSettings('cache\\\\',root),{written:true,effective:true});
      const originalPath=process.env.PATH; process.env.PATH=path.join(base,'missing-bin');
      const gitError=await ignorePermissionSettings('other.json',root); process.env.PATH=originalPath;
      assert.equal(gitError.written,false);assert.equal(gitError.effective,false);assert.match(gitError.error,/ENOENT/);
      process.stdout.write(JSON.stringify(rows));
    `, ignoreFixture], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8', timeout: 20000 });
    assert.deepEqual(JSON.parse(ignoreEvidence), ['default', 'explicit', 'tilde', 'relative', 'tracked', 'duplicate', 'already', 'error']);
  } finally { await first.close(); await second.close(); }
});

test("permission layers remove and replace exact destinations across owners, reload and restart", async (t) => {
  const root = workspace(), userDir = path.join(root, 'user');
  const effect = spy('write_file');
  write(root, 'user/settings.json', JSON.stringify({ unknown: { retained: 1 }, permissions: { mode: 'ask', allow: [], deny: ['write_file'] } }));
  write(root, '.harness/settings.json', JSON.stringify({ permissions: { deny: ['write_file'] } }));
  const loaded = loadProjectConfig(root, { userDir });
  const cfg = config(root, [effect.tool], { configSources: { userDir }, permissions: {
    mode: 'ask', allow: [], deny: ['write_file'], layers: loaded.permissionLayers } });
  const first = Session.open(root, { config: cfg }), isolated = Session.open(root, { config: cfg });
  const remove = (destination: 'userSettings' | 'projectSettings') => first.adoptPermissionUpdates([
    { type: 'removeRules', destination, behavior: 'deny', rules: [{ toolName: 'write_file' }] }]);
  try {
    remove('userSettings');
    assert.equal(permissionDecision(first.config.permissions, effect.tool, {}).decision, 'deny');
    remove('projectSettings');
    assert.equal(permissionDecision(first.config.permissions, effect.tool, {}).decision, 'ask');
    assert.equal(permissionDecision(isolated.config.permissions, effect.tool, {}).decision, 'deny');
    first.adoptPermissionUpdates([{ type: 'replaceRules', destination: 'userSettings', behavior: 'allow', rules: [{ toolName: 'write_file' }] }]);
    const provider = new ScriptedProvider([response([call('current', 'write_file', { path: 'one' })], 'tool_use'),
      response([call('next', 'write_file', { path: 'two' })], 'tool_use'), done()]);
    await new Agent(first, provider, [effect.tool]).run('write twice');
    assert.deepEqual(effect.inputs, [{ path: 'one' }, { path: 'two' }]);
    await first.drainPermissionWrites();
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(userDir, 'settings.json'), 'utf8')).unknown, { retained: 1 });
    first.adoptPermissionUpdates([
      { type: 'addRules', destination: 'session', behavior: 'allow', rules: [{ toolName: 'session_kept' }] },
      { type: 'addRules', destination: 'cliArg', behavior: 'deny', rules: [{ toolName: 'cli_kept' }] },
    ]);
    const reloaded = reloadConfig(first.config);
    const next = Session.open(root, { config: reloaded });
    try {
      next.carryPermissions(first);
      assert.equal(permissionDecision(next.config.permissions, effect.tool, {}).decision, 'allow');
      assert.deepEqual(next.permissionUpdates.alwaysAllowRules.session, ['session_kept']);
      assert.deepEqual(next.permissionUpdates.alwaysDenyRules.cliArg, ['cli_kept']);
      const managedNext = Session.open(root, { config: { ...reloaded, permissions: { ...reloaded.permissions!, managedOnly: true } } });
      try {
        managedNext.carryPermissions(next);
        assert.deepEqual(managedNext.permissionUpdates.alwaysAllowRules.session, []);
        assert.deepEqual(managedNext.permissionUpdates.alwaysAllowRules.cliArg, []);
        assert.deepEqual(managedNext.permissionUpdates.alwaysDenyRules.cliArg, ['cli_kept']);
      } finally { managedNext.close(); }
    }
    finally { await next.close(); }
    const fresh = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
      import {reloadConfig} from './src/reload.ts';
      import {permissionDecision} from './src/permissions.ts';
      const cfg=reloadConfig(JSON.parse(process.argv[1]));
      const tool={schema:{name:'write_file'},readOnly:false};
      process.stdout.write(permissionDecision(cfg.permissions,tool,{}).decision);
    `, JSON.stringify(cfg)], { cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8' });
    assert.equal(fresh, 'allow');
    const linked = path.join(root, 'linked'), gitDir = path.join(root, '.git', 'worktrees', 'linked');
    fs.mkdirSync(linked); fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(linked, '.git'), `gitdir: ${gitDir}\n`);
    fs.writeFileSync(path.join(gitDir, 'commondir'), '../..\n');
    fs.writeFileSync(path.join(gitDir, 'gitdir'), path.join(linked, '.git') + '\n');
    write(root, '.harness/settings.local.json', JSON.stringify({ permissions: { ask: ['canonical'] } }));
    write(root, 'linked/.harness/settings.local.json', JSON.stringify({ permissions: { ask: ['legacy'] } }));
    const linkedConfig = loadProjectConfig(linked, { userDir });
    const local = linkedConfig.permissionLayers.find(layer => layer.source === 'localSettings');
    assert.equal(local?.file, path.join(root, '.harness/settings.local.json'));
    assert.deepEqual(local?.ask, ['legacy', 'canonical']);
    const linkedOwner = Session.open(linked, { config: config(linked, [effect.tool], { configSources: { userDir },
      permissions: { mode: 'ask', allow: [], deny: [], layers: linkedConfig.permissionLayers } }) });
    try {
      linkedOwner.adoptPermissionUpdates([{ type: 'replaceRules', destination: 'localSettings', behavior: 'ask', rules: [{ toolName: 'saved' }] }]);
      await linkedOwner.drainPermissionWrites();
      assert.deepEqual(JSON.parse(fs.readFileSync(local!.file!, 'utf8')).permissions.ask, ['saved']);
      const legacyFile = path.join(linked, '.harness/settings.local.json');
      assert.deepEqual(JSON.parse(fs.readFileSync(legacyFile, 'utf8')).permissions.ask, []);
      const { persistPermissionUpdate, permissionSettingsPaths } = await import('../src/permission-settings.js');
      const paths = permissionSettingsPaths(linked, userDir);
      const save = (update: Parameters<typeof persistPermissionUpdate>[0]) => persistPermissionUpdate(update, paths, false);
      for (const behavior of ['allow', 'deny', 'ask'] as const) {
        for (const type of ['removeRules', 'replaceRules'] as const) {
          const original = { unknown: { nested: ['keep'] }, permissions: { [behavior]: ['Read(secret)', 'Read(keep)'], future: { enabled: true } } };
          fs.writeFileSync(legacyFile, JSON.stringify(original));
          fs.writeFileSync(local!.file!, JSON.stringify({ permissions: { [behavior]: [] } }));
          const result = await save({ type, destination: 'localSettings', behavior,
            rules: type === 'removeRules' ? [{ toolName: 'Read', ruleContent: 'secret' }] : [] });
          assert.equal(result.outcome, 'written');
          const saved = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
          assert.deepEqual(saved, { ...original, permissions: { ...original.permissions,
            [behavior]: type === 'removeRules' ? ['Read(keep)'] : [] } });
          assert.deepEqual(loadProjectConfig(linked, { userDir }).permissionLayers.find(layer => layer.source === 'localSettings')?.[behavior],
            type === 'removeRules' ? ['Read(keep)'] : []);
        }
      }
      fs.writeFileSync(legacyFile, JSON.stringify({ permissions: { additionalDirectories: [root, userDir], defaultMode: 'ask' }, future: 1 }));
      assert.equal((await save({ type: 'removeDirectories', destination: 'localSettings', directories: [root] })).outcome, 'written');
      assert.deepEqual(JSON.parse(fs.readFileSync(legacyFile, 'utf8')).permissions.additionalDirectories, [userDir]);
      const legacyBeforeAdd = fs.readFileSync(legacyFile, 'utf8');
      await save({ type: 'addRules', destination: 'localSettings', behavior: 'allow', rules: [{ toolName: 'new_grant' }] });
      await save({ type: 'addDirectories', destination: 'localSettings', directories: [linked] });
      await save({ type: 'setMode', destination: 'localSettings', mode: 'dontAsk' });
      assert.equal(fs.readFileSync(legacyFile, 'utf8'), legacyBeforeAdd);
      fs.writeFileSync(local!.file!, JSON.stringify({ permissions: { allow: [] } }));
      for (const invalid of ['{broken', 'null', '[]']) {
        fs.writeFileSync(legacyFile, invalid);
        assert.equal((await save({ type: 'replaceRules', destination: 'localSettings', behavior: 'allow', rules: [] })).outcome, 'unchanged');
        assert.equal(fs.readFileSync(legacyFile, 'utf8'), invalid);
      }
      fs.writeFileSync(legacyFile, JSON.stringify({ permissions: { allow: 42 } }));
      const malformed = await save({ type: 'removeRules', destination: 'localSettings', behavior: 'allow', rules: [{ toolName: 'new_grant' }] });
      assert.equal(malformed.outcome, 'error');
      assert.match(malformed.error ?? '', /transform legacy/);
      fs.unlinkSync(legacyFile); fs.symlinkSync(local!.file!, legacyFile);
      const readError = await save({ type: 'replaceRules', destination: 'localSettings', behavior: 'allow', rules: [] });
      assert.equal(readError.outcome, 'error'); assert.match(readError.error ?? '', /read legacy/);
      const warning = await save({ type: 'setMode', destination: 'localSettings', mode: 'default' });
      assert.equal(warning.outcome, 'written'); assert.match(warning.warning ?? '', /read legacy/);
      fs.unlinkSync(legacyFile);
      fs.writeFileSync(legacyFile, JSON.stringify({ permissions: { allow: ['Read(secret)'] }, unknown: 'preserve' }));
      const rename = fs.renameSync;
      const mocked = t.mock.method(fs, 'renameSync', (from: fs.PathLike, to: fs.PathLike) => {
        if (to === legacyFile) throw new Error('fixture legacy publish failure');
        return rename(from, to);
      });
      try {
        const failed = await save({ type: 'replaceRules', destination: 'localSettings', behavior: 'allow', rules: [] });
        assert.equal(failed.outcome, 'error'); assert.match(failed.error ?? '', /revoke legacy.*fixture legacy publish failure/);
        assert.deepEqual(JSON.parse(fs.readFileSync(legacyFile, 'utf8')).permissions.allow, ['Read(secret)']);
      } finally { mocked.mock.restore(); }
      await Promise.all([
        save({ type: 'removeRules', destination: 'localSettings', behavior: 'allow', rules: [{ toolName: 'Read', ruleContent: 'secret' }] }),
        persistPermissionUpdate({ type: 'addRules', destination: 'userSettings', behavior: 'allow', rules: [{ toolName: 'parallel' }] },
          { userSettings: legacyFile }, false),
      ]);
      assert.deepEqual(JSON.parse(fs.readFileSync(legacyFile, 'utf8')).permissions.allow, ['parallel']);
    } finally { await linkedOwner.close(); }
    write(root, 'policy.json', JSON.stringify({ allowManagedPermissionRulesOnly: true,
      permissions: { mode: 'ask', allow: [], deny: ['write_file'] } }));
    const managed = reloadConfig({ ...cfg, configSources: { userDir, managedSettingsFile: path.join(root, 'policy.json'),
      overrides: { permissions: { mode: 'ask', allow: ['write_file'], deny: ['cli_denied'] } } } });
    const policyOwner = Session.open(root, { config: managed });
    try {
      assert.deepEqual(policyOwner.permissionUpdates.alwaysAllowRules.userSettings, []);
      assert.deepEqual(policyOwner.permissionUpdates.alwaysAllowRules.cliArg, []);
      assert.deepEqual(policyOwner.permissionUpdates.alwaysDenyRules.cliArg, ['cli_denied']);
      policyOwner.adoptPermissionUpdates([{ type: 'replaceRules', behavior: 'deny', destination: 'userSettings', rules: [] }]);
      assert.equal(permissionDecision(policyOwner.config.permissions, effect.tool, {}).decision, 'deny');
    } finally { await policyOwner.close(); }
  } finally { await first.close(); await isolated.close(); }
});

test("live directory grants affect current file execution, revocation and status payload without leaking owners", async () => {
  const root = workspace(), external = workspace(), denied = workspace();
  write(external, 'existing.txt', 'outside original');
  write(denied, 'secret.txt', 'ungranted');
  fs.symlinkSync(denied, path.join(external, 'escape'));
  write(root, 'status.cjs', `let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>{require('fs').appendFileSync('status.jsonl',s);process.stdout.write('live');});`);
  const tools = [...createTools(), ...createNotebookTools(), ...createMediaTools()];
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] },
    statusLine: { type: 'command', command: `${process.execPath} status.cjs` }, hooks: {
      PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow', updatedPermissions: [
        { type: 'addDirectories', directories: [external], destination: 'session' },
        { type: 'addRules', behavior: 'allow', destination: 'session', rules: [{ toolName: 'write_file' }] },
      ] } } }) }],
    } }) });
  const isolated = Session.open(root, { config: session.config }), status = new StatusLine();
  const context = { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000,
    workingDirectories: (readOnly: boolean) => session.workingDirectories(readOnly) };
  const tool = (name: string) => tools.find(value => value.schema.name === name)!;
  const payloads = () => fs.existsSync(path.join(root, 'status.jsonl')) ? fs.readFileSync(path.join(root, 'status.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
  const until = async (predicate: () => boolean) => { const end = Date.now() + 5000; while (!predicate()) {
    assert.ok(Date.now() < end, 'live status payload arrived'); await new Promise(resolve => setTimeout(resolve, 10));
  } };
  try {
    const planOwner = new InteractivePlanResume(session.id);
    const enter = permissionModeCommand('plan', 'plan', 'ask');
    const select = permissionModeCommand('permissions', 'ask', 'default');
    const exit = permissionModeCommand('permissions', 'ask', 'plan');
    assert.equal(permissionModeCommandSchema.safeParse({ ...enter, mode: 'ask' }).success, false);
    assert.equal(planHistoryState([enter, select]), 'none');
    assert.equal(planHistoryState([enter, exit]), 'exited');
    const live = { ...session.permissionOwner.state(), mode: 'ask' as const };
    const restored = planOwner.resume('fresh', live, 'plan', [enter, select]);
    assert.equal(restored.mode, 'plan'); assert.equal(restored.prePlanMode, 'default');
    assert.equal(restored.contentRuleOwner, live.contentRuleOwner);
    assert.equal(planOwner.resume('exit', live, 'plan', [enter, exit]), live);
    assert.equal(planOwner.resume('bypass', live, 'bypass', [enter]), live);
    assert.equal(planOwner.resume('legacy', live, undefined, [enter]).mode, 'plan');
    assert.equal(planOwner.resume('invalid', live, 'invalid-mode', [enter]).mode, 'plan');
    planOwner.accept('fresh'); assert.equal(planOwner.resume('fresh', live, 'plan', [enter]), live);
    planOwner.runtime.features.set('tengu_tranquil_fern', false);
    assert.equal(planOwner.resume('disabled', live, 'plan', [enter]), live);
    planOwner.runtime.features.set('tengu_tranquil_fern', true);
    for (const rule of ['ExitPlanMode', '*PlanMode', 'Ex*t*Mode']) {
      const blocked = { ...live, alwaysDenyRules: { session: [rule] }, deny: [rule] };
      assert.equal(planOwner.resume(rule, blocked, 'plan', [enter]), blocked);
    }
    for (const rule of ['submit_plan', 'ExitPlanMode(content)']) {
      assert.equal(planOwner.resume(rule, { ...live, alwaysDenyRules: { session: [rule] } }, 'plan', [enter]).mode, 'plan');
    }
    const autoPlan = transitionPlanMode({ ...live, mode: 'auto', strippedDangerousRules: { session: ['read_file'] } }, 'plan', planOwner.runtime);
    assert.equal(autoPlan.prePlanMode, 'auto'); assert.equal(autoPlan.autoDuringPlan, true);
    assert.deepEqual(autoPlan.strippedDangerousRules, { session: ['read_file'] });
    const history = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } }) });
    let rewound: Session | undefined, forked: Session | undefined;
    try {
      history.append(enter); history.append({ kind: 'turn_end', reason: 'fixture' });
      checkpointConversation(history, 'plan-retained', new AbortController().signal);
      const preview = previewRewind(history, 1, new AbortController().signal);
      history.append(exit);
      assert.throws(() => applyRewind(history, preview, preview.token, new AbortController().signal), /stale/);
      const fresh = previewRewind(history, 1, new AbortController().signal);
      rewound = applyRewind(history, fresh, fresh.token, new AbortController().signal);
      assert.equal(planHistoryState(rewound.events), 'open'); assert.equal(rewound.permissionOwner.state().mode, 'ask');
      forked = forkSession(history, history.events.findIndex(event => event.kind === 'turn_end'));
      assert.equal(planHistoryState(forked.events), 'open');
      history.append({ kind: 'compact', summary: 'ExitPlanMode', response: done() });
      history.append({ kind: 'turn_end', reason: 'compact' });
      assert.equal(planHistoryState(history.events), 'exited');
      assert.equal(history.awaitingResponse, false);
      const id = history.id; await history.close();
      const reopened = Session.open(root, { id });
      try { assert.equal(planHistoryState(reopened.events), 'exited'); } finally { await reopened.close(); }
    } finally { await history.close(); await rewound?.close(); await forked?.close(); }
    write(root, 'absolute-contract.txt', 'workspace file');
    for (const directories of [[], ['relative-invalid'], [path.join(external, 'absent')], [path.join(external, 'existing.txt')]]) {
      await assert.rejects(tool('read_file').execute({ path: path.join(root, 'absolute-contract.txt') }, {
        ...context, workingDirectories: () => directories }), /absolute|escapes/);
    }
    const alias = path.join(root, 'granted-alias');
    write(external, 'alias.txt', 'original landing');
    write(denied, 'alias.txt', 'ungranted landing');
    fs.symlinkSync(external, alias);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [alias], destination: 'session' }]);
    assert.match(await tool('read_file').execute({ path: path.join(alias, 'alias.txt') }, context), /original landing/);
    fs.unlinkSync(alias); fs.symlinkSync(denied, alias);
    await assert.rejects(tool('write_file').execute({ path: path.join(alias, 'alias.txt'), content: 'changed' }, context), /escapes/);
    await assert.rejects(tool('read_file').execute({ path: path.join(alias, 'alias.txt') }, context), /escapes/);
    assert.equal(fs.readFileSync(path.join(external, 'alias.txt'), 'utf8'), 'original landing');
    assert.equal(fs.readFileSync(path.join(denied, 'alias.txt'), 'utf8'), 'ungranted landing');
    assert.deepEqual(isolated.workingDirectories(false), []);
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [alias], destination: 'session' }]);
    await assert.rejects(tool('read_file').execute({ path: path.join(alias, 'alias.txt') }, context), /escapes/);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [alias], destination: 'session' }]);
    assert.match(await tool('read_file').execute({ path: path.join(alias, 'alias.txt') }, context), /ungranted landing/);
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [alias], destination: 'session' }]);
    for (const [mode, behavior] of [['bypass', 'deny'], ['ask', 'allow'], ['dontAsk', 'allow']] as const) {
      const skillRoot = workspace();
      const skillTools = createTools();
      const skillSession = Session.open(skillRoot, { config: config(skillRoot, skillTools, { allowShell: true,
        features: { tasks: true, subagents: true, skillInlineCommands: true }, permissions: { mode, allow: [], deny: [] } }) });
      try {
        skillSession.adoptPermissionUpdates([{ type: 'addRules', behavior, destination: 'session', rules: [{ toolName: 'run_command' }] }]);
        const execution = executeSkill({ name: 'fixture', path: path.join(skillRoot, 'SKILL.md'), description: 'fixture',
          body: '```!\nprintf owned > marker\n```', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false }, '', {
          config: skillSession.config, provider: new ScriptedProvider([]), tools: skillTools, signal: new AbortController().signal, source: 'user' });
        if (behavior === 'deny') await assert.rejects(execution, /denied/);
        else await execution;
        assert.equal(fs.existsSync(path.join(skillRoot, 'marker')), behavior === 'allow');
      } finally { await skillSession.drainPermissionWrites(); skillSession.close(); }
    }
    for (const lane of ['direct', 'foreground', 'background'] as const) {
      const childRoot = workspace(), childTools = createTools();
      const parent = Session.open(childRoot, { config: config(childRoot, childTools, {
        permissions: { mode: 'bypass', allow: [], deny: [] } }) });
      const provider = new ScriptedProvider([() => {
        parent.adoptPermissionUpdates([{ type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'write_file' }] }]);
        return response([call('live-deny', 'write_file', { path: 'blocked', content: 'blocked' })], 'tool_use');
      }, done()]);
      const registry = new AgentRegistry({ source: () => parent.config, provider, tools: childTools });
      try {
        if (lane === 'direct') await createSubagentTool(() => parent.config, provider, childTools).execute({ prompt: 'write', mode: 'general' }, {
          workspace: childRoot, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
        else {
          const child = await registry.launch({ prompt: 'write', mode: 'general', background: lane === 'background' });
          if (lane === 'background') await registry.get(child.id, { waitMs: 5000 });
        }
        assert.equal(fs.existsSync(path.join(childRoot, 'blocked')), false, lane);
      } finally { await registry.close(); await parent.drainPermissionWrites(); parent.close(); }
    }
    for (const lane of ['session', 'direct', 'foreground', 'background'] as const) for (const behavior of ['deny', 'allow'] as const) {
      const childRoot = workspace(), childTools = createTools();
      const parent = Session.open(childRoot, { config: config(childRoot, childTools, {
        permissions: { mode: 'ask', allow: [], deny: [] }, hooks: {
          PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: {
            behavior: 'allow', updatedPermissions: [{ type: 'addRules', behavior, destination: 'session', rules: [{ toolName: 'write_file' }] }],
          } } }) }],
        } }) });
      const provider = new ScriptedProvider([
        response([call('first', 'write_file', { path: 'first', content: 'first' })], 'tool_use'),
        response([call('second', 'write_file', { path: 'second', content: 'second' })], 'tool_use'), done(),
      ]);
      const registry = new AgentRegistry({ source: () => parent.config, provider, tools: childTools });
      let childSession: Session | undefined;
      try {
        if (lane === 'session') {
          childSession = Session.open(childRoot, { config: parent.config });
          childSession.inheritPermissions(parent.permissionOwner);
          await new Agent(childSession, provider, childTools).run('write twice');
          assert.equal(childSession.events.filter(event => event.kind === 'hook_start' && event.event === 'PermissionRequest').length, 1);
          assert.deepEqual(childSession.permissionUpdates[behavior], []);
        } else if (lane === 'direct') await createSubagentTool(() => parent.config, provider, childTools).execute({ prompt: 'write', mode: 'general' }, {
          workspace: childRoot, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
        else {
          const child = await registry.launch({ prompt: 'write twice', mode: 'general', background: lane === 'background' });
          if (lane === 'background') await registry.get(child.id, { waitMs: 5000 });
        }
        assert.equal(fs.readFileSync(path.join(childRoot, 'first'), 'utf8'), 'first');
        assert.equal(fs.existsSync(path.join(childRoot, 'second')), behavior === 'allow', lane);
        assert.deepEqual(parent.permissionOwner.state()[behavior], ['write_file']);
        await parent.drainPermissionWrites();
        assert.equal(parent.permissionWriteResults.length, 1);
        assert.equal(childSession?.permissionWriteResults.length ?? 0, 0);
      } finally { await childSession?.close(); await registry.close(); await parent.close(); }
    }
    for (const background of [false, true]) {
      const skillRoot = workspace(), skillTools = createTools();
      const parent = Session.open(skillRoot, { config: config(skillRoot, skillTools, {
        permissions: { mode: 'ask', allow: [], deny: [] } }) });
      const provider = new ScriptedProvider([
        response([call('first', 'write_file', { path: 'first', content: 'first' })], 'tool_use'),
        response([call('second', 'write_file', { path: 'second', content: 'second' })], 'tool_use'), done(),
      ]);
      const registry = new AgentRegistry({ source: () => parent.config, provider, tools: skillTools });
      let approvals = 0;
      try {
        const result = JSON.parse(await executeSkill({ name: 'fixture', path: path.join(skillRoot, 'SKILL.md'),
          description: 'fixture', body: 'write twice', context: 'fork', background,
          userInvocable: true, disableModelInvocation: false }, '', {
          config: parent.config, provider, tools: skillTools, registry, signal: new AbortController().signal, source: 'user',
          requestPermission: async () => {
            approvals++;
            parent.permissionOwner.adoptUpdates?.([{ type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'write_file' }] }]);
            return { decision: 'allow' };
          },
        }));
        if (background) await registry.get(result.id, { waitMs: 5000 });
        assert.equal(fs.readFileSync(path.join(skillRoot, 'first'), 'utf8'), 'first');
        assert.equal(fs.existsSync(path.join(skillRoot, 'second')), false);
        assert.equal(approvals, 1);
        assert.deepEqual(parent.permissionOwner.state().deny, ['write_file']);
      } finally { await registry.close(); await parent.close(); }
    }
    {
      const parent = Session.open(root, { config: config(root, tools, { configSources: { userDir: path.join(root, 'nested-user') },
        permissions: { mode: 'ask', allow: [], deny: [] } }) });
      const child = Session.open(root, { config: parent.config }), nested = Session.open(root, { config: parent.config });
      try {
        parent.adoptPermissionUpdates([{ type: 'addRules', behavior: 'allow', destination: 'session', rules: [{ toolName: 'stale' }] }]);
        child.inheritPermissions(parent.permissionOwner, ['read_file']); nested.inheritPermissions(child.permissionOwner);
        parent.adoptPermissionUpdates([{ type: 'replaceRules', behavior: 'allow', destination: 'session', rules: [] }]);
        nested.adoptPermissionUpdates([
          { type: 'addRules', behavior: 'allow', destination: 'session', rules: [{ toolName: 'write_file' }] },
          { type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'read_file' }] },
          { type: 'addDirectories', directories: [external], destination: 'session' },
          { type: 'setMode', mode: 'dontAsk', destination: 'session' },
          { type: 'addRules', behavior: 'ask', destination: 'userSettings', rules: [{ toolName: 'persisted_child' }] },
        ]);
        assert.deepEqual(parent.permissionOwner.state().allow, ['write_file']);
        assert.deepEqual(nested.permissionOwner.state().allow, ['read_file']);
        assert.deepEqual(nested.permissionOwner.state().deny, ['read_file']);
        assert.equal(nested.permissionOwner.state().mode, 'dontAsk');
        assert.deepEqual(nested.workingDirectories(false), [external]);
        parent.adoptPermissionUpdates([
          { type: 'removeRules', behavior: 'allow', destination: 'session', rules: [{ toolName: 'write_file' }] },
          { type: 'replaceRules', behavior: 'deny', destination: 'session', rules: [] },
          { type: 'removeDirectories', directories: [external], destination: 'session' },
        ]);
        nested.adoptPermissionUpdates([{ type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'later' }] }]);
        assert.deepEqual(parent.permissionOwner.state().allow, []);
        assert.deepEqual(nested.permissionOwner.state().deny, ['later']);
        assert.deepEqual(nested.workingDirectories(false), []);
        await parent.drainPermissionWrites();
        assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'nested-user', 'settings.json'), 'utf8')).permissions.ask, ['persisted_child']);
        assert.equal(child.permissionWriteResults.length, 0); assert.equal(nested.permissionWriteResults.length, 0);
      } finally { await nested.close(); await child.close(); await parent.close(); }
    }
    {
      const forkRoot = workspace(), landing = workspace(), retarget = workspace(), forkTools = createTools();
      const directoryAlias = path.join(forkRoot, 'directory-alias'), contentAlias = path.join(forkRoot, 'content-alias');
      write(landing, 'value', 'retained landing'); write(retarget, 'value', 'other landing');
      write(forkRoot, 'secret', 'retained content');
      fs.symlinkSync(landing, directoryAlias); fs.symlinkSync(path.join(forkRoot, 'secret'), contentAlias);
      const parent = Session.open(forkRoot, { config: config(forkRoot, forkTools, {
        permissions: { mode: 'ask', allow: [], deny: [] } }) });
      let ordinary: Session | undefined;
      const effect = async (owner: Session, name: string, input: unknown) => {
        await new Agent(owner, new ScriptedProvider([response([call(`fork-${owner.events.length}`, name, input)], 'tool_use'), done()]), forkTools).run('fork effect');
        return resultBatches(owner).at(-1)?.[0];
      };
      try {
        parent.adoptPermissionUpdates([
          { type: 'addRules', behavior: 'allow', destination: 'session', rules: [{ toolName: 'write_file' }, { toolName: 'read_file' }] },
          { type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'run_command' }, { toolName: 'Read', ruleContent: '/content-alias' }] },
          { type: 'addDirectories', destination: 'session', directories: [directoryAlias] },
        ]);
        assert.equal((await effect(parent, 'read_file', { path: 'content-alias' }))?.is_error, true);
        parent.permissionUpdates = { ...parent.permissionOwner.state(), mode: 'plan', prePlanMode: 'default' };
        ordinary = forkSession(parent);
        assert.equal(ordinary.permissionOwner.state().contentRuleOwner, parent.permissionOwner.state().contentRuleOwner);
        assert.notEqual(ordinary.permissionUpdates.alwaysAllowRules.session, parent.permissionUpdates.alwaysAllowRules.session);
        assert.notEqual(ordinary.permissionUpdates.additionalWorkingDirectories, parent.permissionUpdates.additionalWorkingDirectories);
        await parent.close();
        assert.equal((await effect(ordinary, 'write_file', { path: 'plan-blocked', content: 'blocked' }))?.is_error, true);
        assert.equal(fs.existsSync(path.join(forkRoot, 'plan-blocked')), false);
        ordinary.adoptPermissionUpdates([{ type: 'setMode', mode: 'default', destination: 'session' }]);
        assert.equal((await effect(ordinary, 'write_file', { path: 'allowed', content: 'fork owned' }))?.is_error, undefined);
        assert.equal(fs.readFileSync(path.join(forkRoot, 'allowed'), 'utf8'), 'fork owned');
        assert.equal((await effect(ordinary, 'run_command', { command: 'touch denied' }))?.is_error, true);
        assert.equal(fs.existsSync(path.join(forkRoot, 'denied')), false);
        ordinary.adoptPermissionUpdates([{ type: 'removeRules', behavior: 'allow', destination: 'session', rules: [{ toolName: 'write_file' }] }]);
        assert.equal((await effect(ordinary, 'write_file', { path: 'removed', content: 'blocked' }))?.is_error, true);
        assert.equal(fs.existsSync(path.join(forkRoot, 'removed')), false);
        assert.deepEqual(parent.permissionUpdates.alwaysAllowRules.session, ['write_file', 'read_file']);
        fs.unlinkSync(contentAlias);
        assert.equal((await effect(ordinary, 'read_file', { path: 'secret' }))?.is_error, true);
        assert.equal((await effect(ordinary, 'read_file', { path: path.join(directoryAlias, 'value') }))?.is_error, undefined);
        fs.unlinkSync(directoryAlias); fs.symlinkSync(retarget, directoryAlias);
        assert.equal((await effect(ordinary, 'read_file', { path: path.join(directoryAlias, 'value') }))?.is_error, true);
        ordinary.adoptPermissionUpdates([{ type: 'removeDirectories', destination: 'session', directories: [directoryAlias] }]);
        assert.equal((await effect(ordinary, 'read_file', { path: path.join(directoryAlias, 'value') }))?.is_error, true);
        ordinary.adoptPermissionUpdates([{ type: 'addDirectories', destination: 'session', directories: [directoryAlias] }]);
        assert.equal((await effect(ordinary, 'read_file', { path: path.join(directoryAlias, 'value') }))?.is_error, undefined);
        ordinary.adoptPermissionUpdates([{ type: 'removeDirectories', destination: 'session', directories: [directoryAlias] }]);
        assert.equal((await effect(ordinary, 'read_file', { path: path.join(directoryAlias, 'value') }))?.is_error, true);
        assert.equal(fs.readFileSync(path.join(landing, 'value'), 'utf8'), 'retained landing');
        assert.equal(fs.readFileSync(path.join(retarget, 'value'), 'utf8'), 'other landing');
      } finally { await ordinary?.close(); await parent.close(); }
    }
    status.bind(session, () => {}); status.setActive(true);
    await until(() => payloads().length > 0);
    const provider = new ScriptedProvider([response([call('grant', 'write_file', { path: path.join(external, 'current.txt'), content: 'current effect' })], 'tool_use'), done()]);
    await new Agent(session, provider, tools).run('write current');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined, JSON.stringify(resultBatches(session)));
    assert.equal(fs.readFileSync(path.join(external, 'current.txt'), 'utf8'), 'current effect');
    await tool('edit_file').execute({ path: path.join(external, 'existing.txt'), old_string: 'original', new_string: 'edited' }, context);
    assert.equal(fs.readFileSync(path.join(external, 'existing.txt'), 'utf8'), 'outside edited');
    assert.match(await tool('read_file').execute({ path: path.join(external, 'existing.txt') }, context), /outside edited/);
    assert.match(await tool('list_files').execute({ path: external }, context), /existing.txt/);
    assert.match(await tool('search').execute({ path: external, pattern: 'outside edited' }, context), /outside edited/);
    await assert.rejects(tool('read_file').execute({ path: path.join(external, 'escape', 'secret.txt') }, context), /escapes/);
    await assert.rejects(tool('read_file').execute({ path: path.join(external, '.agent', 'record') }, context), /reserved/);
    await assert.rejects(tool('read_file').execute({ path: path.join(external, 'existing.txt') }, { ...context,
      workingDirectories: readOnly => isolated.workingDirectories(readOnly) }), /absolute|escapes/);
    write(external, 'book.ipynb', JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [] }));
    write(external, 'pixel.png', '');
    fs.writeFileSync(path.join(external, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==', 'base64'));
    assert.match(await tool('read_media').execute({ path: path.join(external, 'pixel.png') }, context), /image|png/i);
    assert.match(await tool('notebook_read').execute({ path: path.join(external, 'book.ipynb') }, context), /cells|notebook/i);
    session.adoptPermissionUpdates([{ type: 'setMode', mode: 'plan', destination: 'session' }]);
    await until(() => payloads().some(value => value.permission_mode === 'plan' && value.workspace.added_dirs.includes(external)));
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [external], destination: 'cliArg' }]);
    await assert.rejects(tool('write_file').execute({ path: path.join(external, 'revoked.txt'), content: 'revoked' }, context), /absolute|escapes/);
    assert.equal(fs.existsSync(path.join(external, 'revoked.txt')), false);
    await until(() => payloads().some(value => value.permission_mode === 'plan' && value.workspace.added_dirs.length === 0));
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [path.join(external, 'missing'), path.join(external, 'existing.txt')], destination: 'session' }]);
    await assert.rejects(tool('write_file').execute({ path: path.join(external, 'missing', 'file'), content: 'invalid' }, context), /escapes/);
    assert.equal(fs.existsSync(path.join(external, 'missing')), false);
    status.close(); await status.flush(); const count = payloads().length;
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [external], destination: 'session' }]);
    await new Promise(resolve => setTimeout(resolve, 350)); assert.equal(payloads().length, count);
    const seeded = Session.open(root, { config: config(root, tools, { permissions: { mode: 'default', allow: [], deny: [],
      blockReadsOutsideWorkingDirectories: true, layers: [{ source: 'projectSettings', root, allow: [], deny: [], ask: [],
        additionalDirectories: [external, path.join(external, 'missing'), path.join(external, 'existing.txt')] }] } }) });
    try {
      assert.deepEqual(seeded.workingDirectories(true), []);
      assert.deepEqual(seeded.workingDirectories(false), [external]);
      await tool('edit_file').execute({ path: path.join(external, 'existing.txt'), old_string: 'edited', new_string: 'project edit' }, {
        ...context, workingDirectories: readOnly => seeded.workingDirectories(readOnly) });
      await assert.rejects(tool('read_file').execute({ path: path.join(external, 'existing.txt') }, {
        ...context, workingDirectories: readOnly => seeded.workingDirectories(readOnly) }), /absolute|escapes/);
      assert.match(fs.readFileSync(path.join(external, 'existing.txt'), 'utf8'), /project edit/);
    } finally { await seeded.close(); }
    const contentOwner = Session.open(root, { config: config(root, tools, { allowShell: true,
      permissions: { mode: 'dontAsk', allow: [], deny: [], layers: [
        { source: 'userSettings', root: external, allow: [], deny: [], ask: [], additionalDirectories: [] },
        { source: 'projectSettings', root, allow: [], deny: [], ask: [], additionalDirectories: [] },
      ] } }) });
    const run = async (name: string, input: unknown) => {
      await new Agent(contentOwner, new ScriptedProvider([response([call(`content-${contentOwner.events.length}`, name, input)], 'tool_use'), done()]), tools).run('content fixture');
      return resultBatches(contentOwner).at(-1)![0]!;
    };
    try {
      const update = (behavior: 'allow' | 'deny' | 'ask', toolName: string, ruleContent: string,
        destination: 'session' | 'userSettings' | 'projectSettings' = 'session', type: 'addRules' | 'removeRules' = 'addRules') =>
        contentOwner.adoptPermissionUpdates([{ type, behavior, destination, rules: [{ toolName, ruleContent }] }]);
      update('allow', 'Edit', '/content/**', 'projectSettings');
      assert.equal((await run('write_file', { path: 'content/allowed.txt', content: 'allowed' })).is_error, undefined);
      assert.equal(fs.readFileSync(path.join(root, 'content/allowed.txt'), 'utf8'), 'allowed');
      assert.equal((await run('write_file', { path: 'other.txt', content: 'unrelated' })).is_error, true);
      assert.equal(fs.existsSync(path.join(root, 'other.txt')), false);
      update('deny', 'Edit', '/content/blocked.txt', 'projectSettings');
      assert.equal((await run('write_file', { path: 'content/blocked.txt', content: 'blocked' })).is_error, true);
      update('deny', 'Edit', '/content/blocked.txt', 'projectSettings', 'removeRules');
      assert.equal((await run('write_file', { path: 'content/blocked.txt', content: 'now allowed' })).is_error, undefined);
      update('ask', 'Edit', '/content/asked.txt', 'projectSettings');
      assert.equal((await run('write_file', { path: 'content/asked.txt', content: 'asked' })).is_error, true);
      update('ask', 'Edit', '/content/asked.txt', 'projectSettings', 'removeRules');
      assert.equal((await run('write_file', { path: 'content/asked.txt', content: 'after remove' })).is_error, undefined);
      update('deny', 'Edit', '/content/allowed.txt', 'userSettings');
      assert.equal((await run('edit_file', { path: 'content/allowed.txt', old_string: 'allowed', new_string: 'edited' })).is_error, undefined);
      assert.equal(fs.readFileSync(path.join(root, 'content/allowed.txt'), 'utf8'), 'edited');
      const command = 'printf shell-content > content/shell.txt';
      update('allow', 'Bash', command);
      assert.equal((await run('run_command', { command })).is_error, undefined);
      assert.equal(fs.readFileSync(path.join(root, 'content/shell.txt'), 'utf8'), 'shell-content');
      update('deny', 'Bash', 'printf shell-content:*');
      assert.equal((await run('run_command', { command })).is_error, true);
      update('deny', 'Bash', 'printf shell-content:*', 'session', 'removeRules');
      update('ask', 'Bash', command);
      assert.equal((await run('run_command', { command })).is_error, true);
      update('ask', 'Bash', command, 'session', 'removeRules');
      assert.equal((await run('run_command', { command })).is_error, undefined);
      update('allow', 'Bash', 'printf:*');
      assert.equal((await run('run_command', { command: 'printf harmless; touch content/alternate.txt' })).is_error, true);
      assert.equal(fs.existsSync(path.join(root, 'content/alternate.txt')), false);
      update('allow', 'Bash', command, 'session', 'removeRules');
      update('allow', 'Bash', 'printf:*', 'session', 'removeRules');
      assert.equal((await run('run_command', { command })).is_error, true);
      assert.equal((await run('write_file', { path: 'content/escape\0.txt', content: 'bad' })).is_error, true);
      for (const behavior of ['deny', 'ask'] as const) {
        const landing = path.join(root, `content/${behavior}-landing`);
        const alias = path.join(root, `content/${behavior}-alias`);
        fs.mkdirSync(landing);
        fs.symlinkSync(landing, alias);
        update(behavior, 'Edit', `/content/${behavior}-alias/missing/*.txt`, 'projectSettings');
        assert.equal((await run('write_file', { path: `content/${behavior}-alias/missing/a.txt`, content: 'blocked' })).is_error, true);
        fs.unlinkSync(alias);
        fs.symlinkSync(external, alias);
        assert.equal((await run('write_file', { path: `content/${behavior}-landing/missing/a.txt`, content: 'old landing' })).is_error, true);
        assert.equal(fs.existsSync(path.join(landing, 'missing/a.txt')), false);
        update(behavior, 'Edit', `/content/${behavior}-alias/missing/*.txt`, 'projectSettings', 'removeRules');
        assert.equal((await run('write_file', { path: `content/${behavior}-landing/missing/a.txt`, content: 'removed' })).is_error, undefined);
      }
      const absentUser = path.join(external, 'absent-settings');
      const firstRoot = Session.open(root, { config: config(root, tools, { configSources: { userDir: absentUser },
        permissions: { mode: 'default', allow: [], deny: [], ask: [] } }) });
      try {
        assert.equal(fs.existsSync(path.join(absentUser, 'settings.json')), false);
        firstRoot.adoptPermissionUpdates([{ type: 'addRules', destination: 'userSettings', behavior: 'deny',
          rules: [{ toolName: 'Edit', ruleContent: '/first-root/**' }] }]);
        await new Agent(firstRoot, new ScriptedProvider([response([call('first-root', 'write_file',
          { path: 'first-root/project.txt', content: 'project root' })], 'tool_use'), done()]), tools).run('first root');
        assert.equal(fs.readFileSync(path.join(root, 'first-root/project.txt'), 'utf8'), 'project root');
        assert.equal(permissionDecision(firstRoot.config.permissions, tool('write_file'),
          { path: path.join(absentUser, 'first-root/user.txt') }).decision, 'deny');
      } finally { await firstRoot.close(); }
      for (const behavior of ['deny', 'ask'] as const) {
        const unknown = spy('custom_content');
        const startup = Session.open(root, { config: config(root, [unknown.tool], { permissions: { mode: 'bypass', allow: [],
          deny: behavior === 'deny' ? ['custom_content(private)'] : [], ask: behavior === 'ask' ? ['custom_content(private)'] : [] } }) });
        try {
          await new Agent(startup, new ScriptedProvider([response([call('unsupported', 'custom_content', { path: 'other' })], 'tool_use'), done()]), [unknown.tool]).run('startup');
          assert.deepEqual(unknown.inputs, []);
          assert.match(String(resultBatches(startup).at(-1)![0]!.content), /Unsupported restrictive permission content consumer/);
        } finally { await startup.close(); }
      }
    } finally { await contentOwner.close(); }
    const refreshRoot = workspace();
    const refresh = Session.open(refreshRoot, { config: config(refreshRoot, tools, { permissions: { mode: 'plan', allow: ['Bash(*)'], deny: [] } }) });
    const refreshChild = Session.open(refreshRoot, { config: refresh.config });
    refreshChild.inheritPermissions(refresh.permissionOwner);
    try {
      refresh.prepareAutoMode();
      assert.equal(refresh.permissionOwner.state().allow.some(rule => /^Bash/.test(rule)), false);
      refresh.permissionUpdates.useAutoModeDuringPlan = false;
      refreshChild.prepareAutoMode();
      assert.equal(refresh.permissionOwner.state().autoDuringPlan, false);
      assert.ok(refresh.permissionOwner.state().allow.includes('Bash'));
      refresh.permissionUpdates.mode = 'auto';
      refreshChild.prepareAutoMode();
      assert.equal(refresh.permissionOwner.state().allow.some(rule => /^Bash/.test(rule)), false);
      assert.equal(refreshChild.permissionOwner.state().allow.some(rule => /^Bash/.test(rule)), false);
    } finally { await refreshChild.close(); await refresh.close(); }
    const ruleLayer = (source: 'userSettings' | 'flagSettings' | 'policySettings', values: string[]) => ({ source, root,
      allow: [], deny: [], ask: [], additionalDirectories: [], autoMode: { allow: values, deny: ['legacy ignored'] } });
    const autoSettings = Session.open(root, { config: config(root, tools, { permissions: { mode: 'default', allow: [], deny: [],
      layers: [ruleLayer('policySettings', ['policy']), ruleLayer('userSettings', ['$defaults', 'user']), ruleLayer('flagSettings', [])] } }) });
    try { assert.deepEqual(autoSettings.permissionOwner.state().autoMode?.allow, ['$defaults', 'user', 'policy']); }
    finally { await autoSettings.close(); }
    assert.equal(permissionDecision({ mode: 'auto', allow: [], deny: [], ask: ['Bash(echo hi)'] },
      tools.find(value => value.schema.name === 'run_command')!, { command: 'echo "hi"' }).floor, 'rule');
    for (const outcome of ['allow', 'block', 'malformed', 'unavailable', 'refusal-error'] as const) {
      const autoRoot = workspace(), ownedTools = createTools();
      const cfg = config(autoRoot, ownedTools, { permissions: { mode: 'auto', allow: [], deny: [] }, hooks: {
        PermissionDenied: [{ command: emit({ hookSpecificOutput: { hookEventName: 'PermissionDenied', retry: true } }) }],
      } });
      let classifierCalls = 0, sent = false;
      const provider: ModelProvider = { count: async () => 1, complete: async request => {
        if (typeof request.system === 'string' && request.system.startsWith('You are a security monitor')) {
          classifierCalls++;
          assert.equal(request.tools, undefined);
          if (outcome === 'unavailable' || outcome === 'refusal-error' && classifierCalls === 2) throw new Error('owned unavailable');
          if (outcome === 'refusal-error') return response([], 'refusal');
          return response([{ type: 'text', text: outcome === 'allow' ? '<block>no</block>' : outcome === 'block'
            ? '<block>yes</block><category>Irreversible Local Destruction</category><reason>held</reason>'
            : '<block>yes</block><block>no</block>' }], 'end_turn');
        }
        if (!sent) { sent = true; return response([call('auto-owned', 'write_file', { path: 'marker', content: 'owned' })], 'tool_use'); }
        return done();
      } };
      const owned = Session.open(autoRoot, { config: cfg });
      try {
        await new Agent(owned, provider, ownedTools).run('write marker', undefined, undefined, undefined, ['generated consent']);
        assert.equal(fs.existsSync(path.join(autoRoot, 'marker')), outcome === 'allow');
        assert.equal(classifierCalls, outcome === 'malformed' ? 10 : outcome === 'block' || outcome === 'refusal-error' ? 2 : 1);
        const retry = owned.messages.some(message => message.content === 'The PermissionDenied hook indicated you may retry this tool call.');
        assert.equal(retry, outcome === 'block' || outcome === 'unavailable');
        // The `/permissions` `recent` list holds the classifier's own deny and nothing else.
        const denials = owned.autoModeDenials.denials;
        assert.equal(denials.length, outcome === 'block' ? 1 : 0);
        if (outcome === 'block') {
          assert.deepEqual(denials[0], { toolName: 'write_file', display: 'marker: owned',
            inputKey: '{"path":"marker","content":"owned"}', reason: 'held' });
        }
        const first = owned.messages[0]!;
        assert.equal(classifierMessage(first)?.humanText, 'write marker');
        const transcript = classifierTranscript(owned.messages, new Map(ownedTools.map(tool => [tool.schema.name, tool])),
          { name: 'write_file', input: { path: 'next', content: 'text' }, id: 'next' });
        assert.ok(transcript.includes('[MESSAGE FROM NON-USER SOURCE - NOT USER INPUT]'));
        assert.ok(transcript.includes('generated consent'));
        if (outcome === 'malformed') assert.ok(transcript.includes('automode-parsing-error'));
      } finally { await owned.close(); }
    }
    const serialized = serializeAutoTool({ schema: { name: 'custom', input_schema: { type: 'object' } }, readOnly: false,
      execute: async () => '', toAutoClassifierInput: () => { throw new Error('fallback'); } }, { command: 'whole command' }, 'call');
    assert.ok(serialized.includes('whole command'));
  } finally { status.close(); await status.flush(); await session.close(); await isolated.close(); }
});

test("a permission retry appends a human-origin grant the classifier reads as the user", async () => {
  const root = workspace();
  const tools = createTools();
  const session = Session.open(root, { config: config(root, tools) });
  try {
    // Source `gR`/`Ets`: the grant is appended, then the panel exits with `shouldQuery: true`.
    session.appendPermissionRetry(['marker: owned']);
    assert.equal(session.awaitingResponse, true);
    assert.equal(session.messages.at(-1)!.content, 'Allowed marker: owned');
    // A human-origin message reaches the classifier as the user's own words, not as untrusted content.
    assert.equal(classifierMessage(session.messages.at(-1)!)?.origin.kind, 'human');
    const transcript = classifierTranscript(session.messages, new Map(tools.map(tool => [tool.schema.name, tool])),
      { name: 'write_file', input: { path: 'marker', content: 'owned' }, id: 'retry' });
    // `gm` indents a human turn, so the grant reaches the classifier as the user's own words.
    assert.ok(transcript.includes('"user":"  Allowed marker: owned"'));
    assert.ok(!transcript.includes('NON-USER SOURCE'));
  } finally { await session.close(); }
});

test("PermissionRequest allow adds a session deny rule that survives the answer", async () => {
  const root = workspace();
  const write = spy("write_file");
  const read = spy("read_file", true);
  const cfg = config(root, [write.tool, read.tool], { permissions: { mode: "ask", allow: [], deny: [] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest",
      decision: { behavior: "allow", updatedPermissions: [{ type: "addRules", rules: [{ toolName: "read_file" }],
        behavior: "deny", destination: "session" }] } } }) }],
  } });
  const provider = new ScriptedProvider([
    response([call("one", "write_file", { path: "one.txt" })], "tool_use"),
    response([call("two", "read_file", {})], "tool_use"),
    done(),
  ]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [write.tool, read.tool]).run("write");
    assert.deepEqual(write.inputs, [{ path: "one.txt" }]);
    assert.deepEqual(read.inputs, []);
    assert.match(String(resultBatches(session)[1]![0]!.content), /Tool denied by permission rule: read_file/);
  } finally { session.close(); }
});

test("PermissionRequest tightening applies content without blocking unrelated input", async () => {
  const root = workspace();
  const effect = spy("write_file");
  const cfg = config(root, [effect.tool], { permissions: { mode: "ask", allow: [], deny: [] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: "PermissionRequest",
      decision: { behavior: "allow", updatedPermissions: [{ type: "addRules",
        rules: [{ toolName: "write_file", ruleContent: "private/*" }], behavior: "deny", destination: "session" }] } } }) }],
  } });
  const provider = new ScriptedProvider([response([call("one", "write_file", { path: "one.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [effect.tool]).run("write");
    assert.deepEqual(effect.inputs, [{ path: 'one.txt' }]);
    const result = resultBatches(session)[0]![0]!;
    assert.equal(result.is_error, undefined);
    assert.equal(permissionDecision(session.config.permissions, effect.tool, { path: 'private/a' }).decision, 'deny');
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
    assert.equal(session.events.some(event => event.kind === "hook_start" && event.event === "PermissionDenied"), false);
    const result = resultBatches(session)[0]![0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /input denied/);
    assert.equal(session.messages.some(message => message.content === "The PermissionDenied hook indicated you may retry this tool call."), false);
    assertBatchAdjacency(session);
  } finally { session.close(); }
});

test("ordinary permission denial ignores retry hooks reserved for classifier verdicts", async () => {
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
    assert.equal(hintIndex, -1);
    assert.ok(batchIndex >= 0);
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

test("SessionStart watchPaths are returned for the front-end watcher", async () => {
  const root = workspace();
  const hooks = { SessionStart: [{ command: emit({ hookSpecificOutput: { hookEventName: "SessionStart", watchPaths: ["/tmp/one.md", "/tmp/two.md"] } }) }] };
  const session = Session.open(root, { config: config(root, [], { hooks }) });
  try {
    const started = await new Agent(session, new ScriptedProvider([]), []).startSession("startup");
    assert.deepEqual(started.watchPaths, ["/tmp/one.md", "/tmp/two.md"]);
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

test("a touched path activates a held conditional skill before the next request", async () => {
  const root = workspace();
  write(root, "src/a.ts", "content\n");
  const read = spy("read_file", true);
  const scoped = { name: "scoped", description: "Scoped skill", path: path.join(root, ".harness/skills/scoped/SKILL.md"),
    body: "Scoped body", userInvocable: true, disableModelInvocation: false, paths: ["src"] };
  const cfg = config(root, [read.tool], { skills: [], heldSkills: [scoped] });
  const provider = new ScriptedProvider([
    response([call("one", "read_file", { path: "src/a.ts" })], "tool_use"),
    request => {
      // The activation reached the live catalog and the rendered prompt before this request.
      assert.deepEqual(session.config.skills?.map(skill => skill.name), ["scoped"]);
      assert.equal(session.config.heldSkills, undefined);
      assert.match(String(request.system), /Scoped skill/);
      return done();
    },
  ]);
  const session = Session.open(root, { config: cfg });
  const live = session.config.skills;
  try {
    await new Agent(session, provider, [read.tool]).run("read a source file");
    assert.deepEqual(read.inputs, [{ path: "src/a.ts" }]);
    assert.equal(session.config.skills, live, "the catalog array keeps its identity");
  } finally { session.close(); }
});

test("a touch outside a held skill's paths leaves it conditional", async () => {
  const root = workspace();
  write(root, "notes/a.txt", "content\n");
  const read = spy("read_file", true);
  const scoped = { name: "scoped", description: "Scoped skill", path: path.join(root, ".harness/skills/scoped/SKILL.md"),
    body: "Scoped body", userInvocable: true, disableModelInvocation: false, paths: ["src"] };
  const cfg = config(root, [read.tool], { skills: [], heldSkills: [scoped] });
  const provider = new ScriptedProvider([
    response([call("one", "read_file", { path: "notes/a.txt" })], "tool_use"),
    request => { assert.doesNotMatch(String(request.system), /Scoped skill/); assert.equal(session.config.heldSkills?.length, 1); return done(); },
  ]);
  const session = Session.open(root, { config: cfg });
  try { await new Agent(session, provider, [read.tool]).run("read a note"); }
  finally { session.close(); }
});

test("a touched path loads a nested skill directory before the next request", async () => {
  const root = workspace();
  write(root, "nested/a.ts", "content\n");
  write(root, "nested/.harness/skills/local/SKILL.md", "---\nname: local\ndescription: Local skill\n---\nLocal body\n");
  const read = spy("read_file", true);
  const cfg = config(root, [read.tool], { skills: [] });
  const provider = new ScriptedProvider([
    response([call("one", "read_file", { path: "nested/a.ts" })], "tool_use"),
    request => {
      // Discovery reached the live catalog and the rendered prompt before this request.
      assert.deepEqual(session.config.skills?.map(skill => skill.name), ["local"]);
      assert.match(String(request.system), /Local skill/);
      return done();
    },
  ]);
  const session = Session.open(root, { config: cfg });
  const live = session.config.skills;
  try {
    await new Agent(session, provider, [read.tool]).run("read a nested file");
    assert.equal(session.config.skills, live, "the catalog array keeps its identity");
    assert.ok(session.config.dynamicSkillDirs?.includes(path.join(root, "nested", ".harness", "skills")));
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

test("PostToolUse updatedMCPToolOutput rewrites only namespaced MCP tools", async () => {
  const run = async (name: string) => {
    const root = workspace();
    const effect = spy(name);
    const cfg = config(root, [effect.tool], { hooks: { PostToolUse: [{ command: emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedMCPToolOutput: "mcp replacement" } }) }] } });
    const provider = new ScriptedProvider([response([call("one", name, {})], "tool_use"), done()]);
    const session = Session.open(root, { config: cfg });
    try {
      await new Agent(session, provider, [effect.tool]).run("task");
      return String(resultBatches(session)[0]![0]!.content);
    } finally { session.close(); }
  };
  assert.equal(await run("mcp__fixture__read"), "mcp replacement");
  assert.equal(await run("mutate"), "original tool output");
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
