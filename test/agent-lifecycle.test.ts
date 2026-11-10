import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash, randomUUID } from 'node:crypto';
import os from "node:os";
import path from "node:path";
import { classifierTranscript, serializeAutoTool } from '../src/auto-classifier-transcript.js';
import { classifierMessage } from '../src/message-origin.js';
import { after, test } from "node:test";
import { execFileSync, spawn } from 'node:child_process';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { Duplex, PassThrough, Writable } from 'node:stream';
import { getEventListeners } from 'node:events';
import type Anthropic from "@anthropic-ai/sdk";
import { Agent, assertPaired, defaultConfig, toolCalls } from "../src/agent.js";
import { loadProjectConfig } from "../src/config.js";
import { reloadConfig } from '../src/reload.js';
import { InteractivePlanResume, permissionModeCommand, permissionModeCommandSchema, planHistoryState, transitionPlanMode } from '../src/plan-resume.js';
import { forkSession } from '../src/sessions.js';
import { relocateSession } from '../src/workspace-session.js';
import { checkpointConversation, checkpointConversationWithDirectoryWitness, inspectDirectoryCheckpointWitness,
  readDirectoryCheckpointBackup, previewRewind, applyRewind, applyRewindAfterRelease } from '../src/rewind.js';
import { verifyDirectoryCheckpointTornCandidate } from '../src/directory-checkpoint.js';
import { planDirectoryRewind } from '../src/directory-rewind-plan.js';
import { directoryRewindEvidenceSchema, encodeDirectoryRewindPlan, verifyDirectoryRewindObjects } from '../src/directory-rewind-evidence.js';
import { readStableDirectoryFile } from '../src/directory-file-state.js';
import { recoverCheckpoint } from '../src/checkpoints.js';
import { permissionDecision } from '../src/permissions.js';
import { executeSkill } from '../src/skill-runtime.js';
import { interactiveLoop } from '../src/interactive.js';
import { createRuntime, pinToolSchemas, RuntimeHandoffCleanupError } from '../src/runtime.js';
import { issueHumanSkillAuthorization } from '../src/notification-authorization.js';
import { AgentRegistry } from '../src/agent-registry.js';
import { AsyncHookRegistry } from '../src/async-hooks.js';
import { createSubagentTool } from '../src/subagents.js';
import { Session, type SessionConfig, type ToolResult } from "../src/session.js";
import { listSessions } from "../src/sessions.js";
import type { ModelProvider, ModelRequest } from "../src/provider.js";
import { bindRuntimeTool, bindScopedChildTool, createTools, executeAgentTool, type ToolDefinition } from "../src/tools.js";
import { createTaskTools, readTaskRecord, readTaskRecords } from "../src/tasks.js";
import { StatusLine } from '../src/tui-statusline.js';
import { createNotebookTools } from '../src/notebooks.js';
import { createMediaTools } from '../src/media.js';
import { BackgroundRegistry, createBackgroundRegistry } from '../src/background.js';
import { SourceReadCache } from '../src/controlled-read-projection-source.js';
import { lock as lockFile } from '../src/skill-effects.js';
import { selectDirectoryRewindSnapshot, type DirectoryHistoryPath, type DirectoryHistoryReference,
  type DirectoryHistoryState, type DirectoryRewindEntry } from '../src/directory-file-history.js';

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
async function appendLaterTextFixture(session: Session, tools: ToolDefinition[], outside: string,
    mode: 'incomplete' | 'tool' | 'snapshot' | 'disabled'): Promise<string[]> {
  const before = session.events.length, prompt = 'ordinary later text';
  if (mode === 'incomplete') {
    session.append({ kind: 'message', message: { role: 'user', content: prompt }, messageId: randomUUID(),
      classifier: { origin: { kind: 'human' }, humanText: prompt } });
  } else {
    if (mode === 'snapshot') session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    if (mode === 'tool') fs.writeFileSync(path.join(session.config.workspace, 'later-read.txt'), 'LATER_READ');
    const provider = new ScriptedProvider(mode === 'tool' ? [response([call('later-read', 'read_file', { path: 'later-read.txt' })], 'tool_use'), done()] : [done()]);
    const features = session.config.features;
    if (mode === 'disabled') session.config.features = { tasks: true, subagents: true, ...features, checkpoints: false };
    try { await new Agent(session, provider, tools).run(prompt); }
    catch (error) { if (mode !== 'snapshot' || !session.isJournalFenced) throw error; }
    finally { if (mode === 'disabled') session.config.features = features; }
  }
  return session.events.slice(before).map(event => event.kind);
}
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
test("hook display stays inside the byte budget and keeps the raw PostCompact record", async () => {
  const root = workspace();
  fs.writeFileSync(path.join(root, "compact-output"), "RAW\u001b[2J " + "界".repeat(40));
  const hooks = {
    Notification: [{ command: emit({ systemMessage: "S".repeat(20) + "\u001b[31m", additionalContext: "C".repeat(60) }) }],
    PostCompact: [{ command: "cat compact-output" }],
  };
  const session = Session.open(root, { config: config(root, [], { hooks, maxOutputBytes: 96 }) });
  const status: string[] = [];
  try {
    const agent = new Agent(session, new ScriptedProvider([]), [], { status: text => status.push(text) });
    await agent.emitHook("Notification", {});
    assert.equal(status.length, 2);
    assert.ok(status.every(line => line.startsWith("hook Notification: ")));
    assert.ok(status[1]!.includes("[truncated]"));
    assert.equal(status.join("").includes("\u001b"), false);
    assert.equal(status.join("").includes("�"), false);
    assert.ok(status.reduce((bytes, line) => bytes + Buffer.byteLength(line) + 1, 0) <= 96);
    status.length = 0;
    await agent.emitHook("PostCompact", {});
    assert.equal(status.length, 1);
    assert.ok(status[0]!.startsWith("hook PostCompact: PostCompact [cat compact-output] completed successfully: RAW"), status[0]);
    assert.ok(status[0]!.includes("[truncated]"));
    assert.equal(status[0]!.includes("\u001b"), false);
    assert.ok(Buffer.byteLength(status[0]!) + 1 <= 96);
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
  const session = Session.open(root, { config: config(root, tools, { hooks: { PreToolUse: [{ type: "agent", prompt: "AGENT_HOOK_FIXTURE" }] } }) });
  try {
    const result = await new Agent(session, provider, tools).emitHook("PreToolUse", {});
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

test("agent model hook rejects a read handler replaced at hook-tool admission", async () => {
  const root = workspace();
  write(root, "evidence.txt", "ACTUAL_WORKSPACE_EVIDENCE");
  const actual = createTools().find(tool => tool.schema.name === "read_file")!;
  const original = actual.execute, marker = path.join(root, "hook-replacement");
  const provider = new ScriptedProvider([request => {
    assert.match(String(request.messages[0]!.content), /AGENT_HOOK_FIXTURE/);
    return response([call("read", "read_file", { path: "evidence.txt" })], "tool_use");
  }, request => {
    assert.match(JSON.stringify(request.messages), /Tool implementation changed after authorization/);
    return verdict();
  }]);
  const session = Session.open(root, { config: config(root, [actual], { hooks: { PreToolUse: [{ type: "agent", prompt: "AGENT_HOOK_FIXTURE" }] } }) });
  const append = session.append.bind(session);
  Object.defineProperty(session, "append", { configurable: true, value: (event: unknown, ...rest: unknown[]) => {
    const result = (append as (...args: unknown[]) => unknown)(event, ...rest);
    const row = event as { kind?: string; phase?: string } | undefined;
    if (row?.kind === "hook_tool" && row.phase === "admitted") {
      actual.execute = async () => { fs.writeFileSync(marker, "UNEXPECTED"); return "REPLACED"; };
    }
    return result;
  } });
  try {
    await new Agent(session, provider, [actual]).emitHook("PreToolUse", {});
    assert.equal(fs.existsSync(marker), false);
  } finally { actual.execute = original; session.close(); }
});

test("tool calls and nested model hooks own separate approval lifetimes", async () => {
  const root = workspace();
  const calls: NonNullable<import('../src/tools.js').ToolContext['pathApprovalCall']>[] = [];
  const tool: ToolDefinition = {
    readOnly: true,
    schema: { name: 'read_file', input_schema: { type: 'object', properties: {} } },
    async execute(input, context) {
      const owner = context.pathApprovalCall;
      assert.ok(owner);
      calls.push(owner);
      owner.record('read', 'fixture', ['fixture']);
      await Promise.resolve();
      assert.deepEqual(owner.take('read', 'fixture'), { kind: 'saved', paths: ['fixture'], identity: undefined });
      if ((input as { fail?: boolean }).fail) throw new Error('fixture failure');
      return 'ok';
    },
  };
  const provider = new ScriptedProvider([
    response([call('same', 'read_file', {}), call('failure', 'read_file', { fail: true })], 'tool_use'),
    response([call('same', 'read_file', {})], 'tool_use'), verdict(),
    response([call('same', 'read_file', {})], 'tool_use'), verdict(), done(),
  ]);
  const session = Session.open(root, { config: config(root, [tool], { hooks: { PreToolUse: [{ type: 'agent', prompt: 'inspect' }] } }) });
  try {
    await new Agent(session, provider, [tool]).run('exercise');
    assert.equal(calls.length, 4);
    assert.equal(new Set(calls).size, 4);
    for (const owner of calls) assert.throws(() => owner.record('read', 'later', ['later']), /call ended/);
    assert.deepEqual(resultBatches(session)[0]!.map(item => !!item.is_error), [false, true]);
  } finally { session.close(); }
});

test('hook tool approval calls retire on timeout and cancellation even when execution remains pending', async () => {
  for (const kind of ['mcp_tool', 'agent'] as const) for (const outcome of ['timeout', 'cancel'] as const) {
    const root = workspace();
    const controller = new AbortController();
    let rejectTool!: (error: Error) => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    let observed: NonNullable<import('../src/tools.js').ToolContext['pathApprovalCall']> | undefined;
    const name = kind === 'agent' ? 'read_file' : 'mcp__fixture__read';
    const tool: ToolDefinition = {
      readOnly: true,
      schema: { name, input_schema: { type: 'object', properties: {} } },
      execute(_input, context) {
        observed = context.pathApprovalCall;
        assert.ok(observed);
        observed.record('read', 'fixture', ['fixture']);
        started();
        return new Promise<string>((_resolve, reject) => { rejectTool = reject; });
      },
    };
    const definition = kind === 'agent'
      ? { type: 'agent' as const, prompt: 'inspect', timeout: 0.05 }
      : { type: 'mcp_tool' as const, tool: name, timeout: 0.05 };
    const session = Session.open(root, { config: config(root, [tool], { hooks: { Notification: [definition] } }) });
    const provider = new ScriptedProvider(kind === 'agent' ? [response([call('hook-call', name, {})], 'tool_use')] : []);
    const agent = new Agent(session, provider, [tool]);
    try {
      const result = agent.emitHook('Notification', {}, controller.signal).then(() => undefined, error => error);
      await entered;
      assert.equal(agent['pathApprovalOwner'].activeCalls, 1);
      if (outcome === 'cancel') controller.abort();
      await result;
      assert.equal(agent['pathApprovalOwner'].activeCalls, 0, `${kind} ${outcome}`);
      assert.ok(observed);
      const finished = observed;
      assert.throws(() => finished.record('read', 'later', ['later']), /call ended: cancelled/);
    } finally {
      rejectTool(new Error('late failure'));
      await new Promise(resolve => setImmediate(resolve));
      session.close();
    }
  }
});

test('main tool approval retires immediately on abort while the tool remains pending', async () => {
  for (const outcome of ['success', 'failure'] as const) {
    const root = workspace();
    const controller = new AbortController();
    let settle!: () => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    let observed: NonNullable<import('../src/tools.js').ToolContext['pathApprovalCall']> | undefined;
    let toolSignal: AbortSignal | undefined;
    const tool: ToolDefinition = {
      readOnly: true,
      schema: { name: 'read_file', input_schema: { type: 'object', properties: {} } },
      execute(_input, context) {
        toolSignal = context.signal;
        observed = context.pathApprovalCall;
        assert.ok(observed);
        observed.record('read', 'fixture', ['fixture'], { dev: 1n, ino: 2n });
        return new Promise<string>((resolve, reject) => {
          settle = () => outcome === 'success' ? resolve('late success') : reject(new Error('late failure'));
          started();
        });
      },
    };
    const session = Session.open(root, { config: config(root, [tool]) });
    const agent = new Agent(session, new ScriptedProvider([response([call('pending', 'read_file', {})], 'tool_use')]), [tool]);
    const run = agent.run('exercise', controller.signal);
    try {
      await entered;
      assert.equal(agent['pathApprovalOwner'].activeCalls, 1);
      const listenersBeforeAbort = getEventListeners(controller.signal, 'abort').length;
      const reason = new Error('owned cancellation');
      controller.abort(reason);
      assert.equal(toolSignal?.aborted, true);
      assert.equal(toolSignal?.reason, reason);
      assert.ok(getEventListeners(controller.signal, 'abort').length < listenersBeforeAbort);
      assert.equal(agent['pathApprovalOwner'].activeCalls, 0, outcome);
      assert.ok(observed);
      const finished = observed;
      assert.throws(() => finished.record('read', 'later', ['later']), /call ended: cancelled/);
      settle();
      assert.equal((await run).reason, 'aborted');
      assert.equal(agent['pathApprovalOwner'].activeCalls, 0);
      assert.throws(() => finished.take('read', 'fixture'), /call ended: cancelled/);
    } finally {
      settle?.();
      await run;
      session.close();
    }
  }
});

test('pre-aborted and concurrent Agent calls keep approval owners isolated', async () => {
  const root = workspace();
  const controllers = [new AbortController(), new AbortController()];
  const owners: NonNullable<import('../src/tools.js').ToolContext['pathApprovalCall']>[] = [];
  const releases: (() => void)[] = [];
  let notify!: () => void;
  const entered = new Promise<void>(resolve => { notify = resolve; });
  const tool: ToolDefinition = {
    readOnly: true,
    schema: { name: 'read_file', input_schema: { type: 'object', properties: {} } },
    execute(_input, context) {
      assert.ok(context.pathApprovalCall);
      owners.push(context.pathApprovalCall);
      context.pathApprovalCall.record('read', 'fixture', ['fixture']);
      return new Promise<string>(resolve => {
        releases.push(() => resolve('done'));
        if (owners.length === 2) notify();
      });
    },
  };
  const hookTool: ToolDefinition = { ...tool, schema: { ...tool.schema, name: 'mcp__fixture__read' } };
  const tools = [tool, hookTool];
  const session = Session.open(root, { config: config(root, tools, { hooks: {
    Notification: [{ type: 'mcp_tool', tool: 'mcp__fixture__read' }],
  } }) });
  const agent = new Agent(session, new ScriptedProvider([response([call('main', 'read_file', {})], 'tool_use')]), tools);
  const runs = [agent.run('exercise', controllers[0]!.signal), agent.emitHook('Notification', {}, controllers[1]!.signal)];
  try {
    await Promise.race([entered, new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('concurrent tools did not start')), 2000);
      timer.unref();
    })]);
    assert.equal(agent['pathApprovalOwner'].activeCalls, 2);
    controllers[0]!.abort();
    assert.equal(agent['pathApprovalOwner'].activeCalls, 1);
    const main = owners.find(owner => owner.providerId === 'main');
    const hook = owners.find(owner => owner.providerId !== 'main');
    assert.ok(main);
    assert.ok(hook);
    assert.throws(() => main.record('read', 'later', ['later']), /call ended: cancelled/);
    assert.deepEqual(hook.take('read', 'fixture'), { kind: 'saved', paths: ['fixture'], identity: undefined });
  } finally {
    for (const release of releases) release();
    await Promise.all(runs);
    session.close();
  }
  assert.equal(agent['pathApprovalOwner'].activeCalls, 0);

  const preAborted = new AbortController();
  preAborted.abort();
  const other = Session.open(root, { config: config(root, [tool]) });
  try {
    const preAgent = new Agent(other, new ScriptedProvider([]), [tool]);
    assert.equal((await preAgent.run('exercise', preAborted.signal)).reason, 'aborted');
    assert.equal(preAgent['pathApprovalOwner'].activeCalls, 0);
    assert.equal(owners.length, 2);
  } finally { other.close(); }
});

test("cancelled asynchronous tool retires its approval call", async () => {
  const root = workspace();
  const controller = new AbortController();
  let observed: NonNullable<import('../src/tools.js').ToolContext['pathApprovalCall']> | undefined;
  const tool: ToolDefinition = {
    readOnly: true,
    schema: { name: 'read_file', input_schema: { type: 'object', properties: {} } },
    async execute(_input, context) {
      observed = context.pathApprovalCall;
      assert.ok(observed);
      observed.record('read', 'fixture', ['fixture']);
      controller.abort();
      await Promise.resolve();
      context.signal.throwIfAborted();
      return 'unreachable';
    },
  };
  const session = Session.open(root, { config: config(root, [tool]) });
  try {
    await new Agent(session, new ScriptedProvider([response([call('cancel', 'read_file', {})], 'tool_use')]), [tool]).run('exercise', controller.signal);
    assert.ok(observed);
    const finished = observed;
    assert.throws(() => finished.record('read', 'later', ['later']), /call ended: cancelled/);
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
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: "default", allow: [], deny: [], inputRules: [{ tool: "read_file", path: "blocked.txt", decision: "deny" }] }, hooks: { PreToolUse: [{ type: "agent", prompt: "check inputs" }] } }) });
  try {
    await new Agent(session, provider, tools).emitHook("PreToolUse", {});
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
      assert.match(String(request.messages[0]!.content), /CONFIGURED_PRE_TOOL_HOOK/);
      return response([call("hook-read", "read_file", { path: "evidence.txt" })], "tool_use");
    },
    request => { assert.equal(hookRequest(request), true); assert.match(JSON.stringify(request.messages), /MAIN_LOOP_HOOK_EVIDENCE/); return verdict(); },
    request => { assert.equal(hookRequest(request), false); return done(); },
  ]);
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: "ask", allow: [], deny: [] }, hooks: { PreToolUse: [{ type: "agent", prompt: "CONFIGURED_PRE_TOOL_HOOK" }] } }) });
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

test('unsupported permission agent hook never calls the model and never replaces human approval', async () => {
  for (const allowed of [false, true]) {
    const root = workspace(), effect = spy('mutate');
    const provider = new ScriptedProvider([
      response([call('main-call', 'mutate', { path: 'a' })], 'tool_use'),
      request => { assert.equal(hookRequest(request), false); return done(); },
    ]);
    let session = Session.open(root, { config: config(root, [effect.tool], { permissions: { mode: 'ask', allow: [], deny: [] },
      hooks: { PermissionRequest: [{ type: 'agent', prompt: 'must not authorize this call' }] } }) });
    let approvals = 0;
    try {
      await new Agent(session, provider, [effect.tool], { permission: async () => { approvals++; return allowed; } }).run('task');
      assert.equal(approvals, 1); assert.equal(provider.requests.length, 2);
      assert.equal(effect.inputs.length, allowed ? 1 : 0);
      const id = session.id; session.close(); session = Session.open(root, { id });
      const result = session.events.find(event => event.kind === 'hook_result' && event.event === 'PermissionRequest');
      assert.ok(result?.kind === 'hook_result'); assert.equal(result.blocked, false);
      assert.ok(result.additionalContext.some(text => text.includes('agent-type hooks are not supported for PermissionRequest')));
      assert.equal(resultBatches(session)[0]?.[0]?.is_error, allowed ? undefined : true);
    } finally { session.close(); }
  }
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
  const session = Session.open(root, { config: config(root, [read.tool], { hooks: { PreToolUse: [{ type: "agent", prompt: "batch boundary" }] } }) });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PreToolUse", {});
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
  const cfg = config(root, [read.tool], { hooks: { PreToolUse: [{ type: "agent", prompt: "budget fixture" }] } });
  provider.countFn = () => cfg.compactAt;
  const session = Session.open(root, { config: cfg });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PreToolUse", {});
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
  const session = Session.open(root, { config: config(root, [read.tool], { hooks: { PreToolUse: [{ type: "agent", prompt: "call budget" }] } }) });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PreToolUse", {});
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
  const session = Session.open(root, { config: config(root, [read.tool], { hooks: { PreToolUse: [{ type: "agent", prompt: "tool batch cap" }] } }) });
  try {
    const result = await new Agent(session, provider, [read.tool]).emitHook("PreToolUse", {});
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

test('tool hook journal retains call correlation and actual async job ids without changing stdin', async () => {
  const root = workspace(), tools = createTools(), script = path.join(root, 'capture-hook.mjs'), capture = path.join(root, 'hook-input.jsonl');
  fs.writeFileSync(script, `import fs from 'node:fs';const input=JSON.parse(fs.readFileSync(0,'utf8'));
    fs.appendFileSync(${JSON.stringify(capture)},JSON.stringify(input)+'\\n');
    process.stdout.write(JSON.stringify(input.hook_event_name==='PermissionRequest'?{hookSpecificOutput:{hookEventName:'PermissionRequest',
      decision:{behavior:'allow',updatedInput:{path:'copy-'+input.tool_input.path,content:'HOOK_CORRELATED'}}}}:{}));`);
  const command = `${shellQuote(process.execPath)} ${shellQuote(script)}`;
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] }, hooks: {
    PermissionRequest: [{ command }], PreToolUse: [{ command }], PostToolUse: [{ command, async: true }], FileChanged: [{ command }],
  } }) });
  const jobs: string[] = [], hooks = new AsyncHookRegistry({ workspace: root });
  const provider = new ScriptedProvider(['one.txt', 'two.txt'].flatMap(file => [
    response([call('hook-correlated-write', 'write_file', { path: file, content: 'INITIAL' })], 'tool_use'), done(),
  ]));
  let parents: string[] = [];
  try {
    const agent = new Agent(session, provider, tools, { permission: async () => { throw new Error('hook should decide'); }, hookOptions: {
      startAsyncCommand: async request => { const id = await hooks.start(request); jobs.push(id); return id; },
    } });
    await agent.run('first hook correlation'); await agent.run('reuse the provider call id');
    for (const id of jobs) await hooks.wait(id);
    assert.equal(jobs.length, 2);
    for (const file of ['copy-one.txt', 'copy-two.txt']) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), 'HOOK_CORRELATED');
    parents = session.events.flatMap(event => event.kind === 'message' && event.message.role === 'assistant' && event.messageId &&
      Array.isArray(event.message.content) && event.message.content.some(block => block.type === 'tool_use') ? [event.messageId] : []);
    assert.equal(parents.length, 2); assert.notEqual(parents[0], parents[1]);
    const starts = session.events.filter(event => event.kind === 'hook_start')
      .filter(event => ['PermissionRequest', 'PreToolUse', 'PostToolUse', 'FileChanged'].includes(event.event));
    assert.deepEqual(starts.map(event => ({ call: event.toolUseId, parent: event.parentMessageId })),
      parents.flatMap(parent => Array.from({ length: 4 }, () => ({ call: 'hook-correlated-write', parent }))));
    const posts = session.events.filter(event => event.kind === 'hook_result').filter(event => event.event === 'PostToolUse');
    assert.deepEqual(posts.map(post => post.backgroundTasks), jobs.map(id => [id]));
    assert.equal(session.events.some(event => event.kind === 'hook_result' && event.event === 'PermissionRequest' && event.backgroundTasks !== undefined), false);
    const inputs = fs.readFileSync(capture, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    assert.equal(inputs.length, 8);
    const permissions = inputs.filter(input => input.hook_event_name === 'PermissionRequest');
    assert.ok(permissions.every(input => !Object.hasOwn(input, 'tool_use_id')));
    assert.deepEqual(permissions.map(input => input.tool_input.path), ['one.txt', 'two.txt']);
    assert.ok(inputs.filter(input => input.hook_event_name === 'FileChanged').every(input => !Object.hasOwn(input, 'tool_use_id')));
    for (const event of ['PreToolUse', 'PostToolUse']) {
      const selected = inputs.filter(input => input.hook_event_name === event);
      assert.ok(selected.every(input => input.tool_use_id === 'hook-correlated-write'));
      assert.deepEqual(selected.map(input => input.tool_input.path).sort(), ['copy-one.txt', 'copy-two.txt']);
    }
  } finally { await hooks.close(); await session.close(); }
  const reader = `import{Session}from'./src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({calls:s.events.filter(e=>e.kind==='hook_start').map(e=>({call:e.toolUseId,parent:e.parentMessageId})),
      jobs:s.events.filter(e=>e.kind==='hook_result'&&e.event==='PostToolUse').map(e=>e.backgroundTasks)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), {
      calls: parents.flatMap(parent => Array.from({ length: 4 }, () => ({ call: 'hook-correlated-write', parent }))), jobs: jobs.map(id => [id]),
    });
  }
});

test('compiled CLI preserves tool hook correlation and runtime async job ids across cold reads', { timeout: 30000 }, async () => {
  const root = workspace(), user = path.join(root, 'user'), settings = path.join(root, '.harness');
  const script = path.join(root, 'cli-hook.mjs'), capture = path.join(root, 'cli-hook-input.jsonl'), preload = path.join(root, 'hook-provider.mjs');
  fs.mkdirSync(user); fs.mkdirSync(settings);
  fs.writeFileSync(script, `import fs from 'node:fs';const input=JSON.parse(fs.readFileSync(0,'utf8'));
    fs.appendFileSync(${JSON.stringify(capture)},JSON.stringify(input)+'\\n');
    process.stdout.write(JSON.stringify(input.hook_event_name==='PermissionRequest'?{hookSpecificOutput:{hookEventName:'PermissionRequest',
      decision:{behavior:'allow',updatedInput:{path:'copy-'+input.tool_input.path,content:'CLI_HOOK_CORRELATED'}}}}:{}));`);
  const command = `${shellQuote(process.execPath)} ${shellQuote(script)}`;
  fs.writeFileSync(path.join(settings, 'settings.json'), JSON.stringify({ hooks: {
    PermissionRequest: [{ command }], PreToolUse: [{ command }], PostToolUse: [{ command, async: true }], FileChanged: [{ command }],
  } }));
  fs.writeFileSync(preload, `globalThis.fetch=()=>{throw Error('fixture network disabled')};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)}),sent=new Set;
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(request,_signal,onText)=>{
      const file=JSON.stringify(request.messages).includes('second CLI hook correlation')?'two.txt':'one.txt',first=!sent.has(file);sent.add(file);
      const content=first?[{type:'tool_use',id:'cli-correlated-write',name:'write_file',input:{path:file,content:'INITIAL'}}]:[{type:'text',text:'done'}];
      if(!first)onText?.('done');return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,
        stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', user,
    '--model', 'fixture-model', '--permission-mode', 'ask', '--interactive', '--no-tui', '--no-inherit-gateway'], {
    cwd: process.cwd(), input: 'first CLI hook correlation\nsecond CLI hook correlation\n/exit\n', encoding: 'utf8', timeout: 20000,
    env: { ...process.env, HOME: user, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` },
  });
  assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  for (const file of ['copy-one.txt', 'copy-two.txt']) assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), 'CLI_HOOK_CORRELATED');
  const directory = path.join(root, '.agent'), journal = fs.readdirSync(directory).find(file => file.endsWith('.jsonl')); assert.ok(journal);
  assert.equal(fs.existsSync(path.join(directory, `${journal.slice(0, -6)}.lock`)), false);
  const rows = fs.readFileSync(path.join(directory, journal), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const parents = rows.filter(row => row.kind === 'message' && row.message.role === 'assistant' &&
    Array.isArray(row.message.content) && row.message.content.some((block: { type: string }) => block.type === 'tool_use')).map(row => row.messageId);
  assert.equal(parents.length, 2); assert.notEqual(parents[0], parents[1]);
  const starts = rows.filter(row => row.kind === 'hook_start' && ['PermissionRequest', 'PreToolUse', 'PostToolUse', 'FileChanged'].includes(row.event));
  const calls = parents.flatMap(parent => Array.from({ length: 4 }, () => ({ call: 'cli-correlated-write', parent })));
  assert.deepEqual(starts.map(row => ({ call: row.toolUseId, parent: row.parentMessageId })), calls);
  const jobs = rows.filter(row => row.kind === 'hook_result' && row.event === 'PostToolUse').map(row => row.backgroundTasks);
  assert.equal(jobs.length, 2);
  for (const ids of jobs) { assert.equal(ids.length, 1); assert.match(ids[0], /^[0-9a-f-]{36}$/); }
  assert.notEqual(jobs[0][0], jobs[1][0]);
  const inputs = fs.readFileSync(capture, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  assert.equal(inputs.length, 8);
  for (const event of ['PermissionRequest', 'FileChanged']) assert.ok(inputs.filter(input => input.hook_event_name === event)
    .every(input => !Object.hasOwn(input, 'tool_use_id') && !Object.hasOwn(input, 'parentMessageId')));
  for (const event of ['PreToolUse', 'PostToolUse']) assert.deepEqual(inputs.filter(input => input.hook_event_name === event)
    .map(input => ({ call: input.tool_use_id, file: input.tool_input.path })).sort((a, b) => a.file.localeCompare(b.file)),
    ['copy-one.txt', 'copy-two.txt'].map(file => ({ call: 'cli-correlated-write', file })));
  const reader = `import{Session}from'./dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({calls:s.events.filter(e=>e.kind==='hook_start'&&e.toolUseId).map(e=>({call:e.toolUseId,parent:e.parentMessageId})),
      jobs:s.events.filter(e=>e.kind==='hook_result'&&e.event==='PostToolUse').map(e=>e.backgroundTasks)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold: childProcess.SpawnSyncReturns<string> = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, journal.slice(0, -6)],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { calls, jobs });
  }
});

test('built-in text and notebook edits recheck a hook-selected target before execution', async () => {
  for (const notebook of [false, true]) {
    const root = workspace(), tools = [...createTools(), ...createNotebookTools()];
    const name = notebook ? 'notebook_edit' : 'edit_file';
    const original = notebook ? 'original.ipynb' : 'original.txt';
    const selected = notebook ? 'selected.ipynb' : 'selected.txt';
    const initial = notebook ? JSON.stringify({ nbformat:4, nbformat_minor:5, cells:[{id:'a',cell_type:'markdown',source:'before'}] }) : 'before';
    for (const file of [original, selected]) fs.writeFileSync(path.join(root,file),initial);
    const args = (file: string) => notebook ? {path:file,cell_id:'a',new_source:'approved'} :
      {path:file,old_string:'before',new_string:'approved'};
    const session = Session.open(root,{config:config(root,tools,{
      permissions:{mode:'default',allow:[],ask:[name],deny:[]},
      hooks:{PreToolUse:[{matcher:name,command:emit({hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:args(selected)}})}]},
    })});
    const prompts: string[] = [];
    try {
      const provider = new ScriptedProvider([response([call('read','read_file',{path:selected})],'tool_use'),
        response([call('edit',name,args(original))],'tool_use'),done()]);
      await new Agent(session,provider,tools,{permissionPrompt:'interactive',permission:async request => {
        prompts.push((request.input as {path:string}).path);
        return true;
      }}).run('apply the selected edit');
      assert.deepEqual(prompts,[original,selected],JSON.stringify(resultBatches(session)));
      assert.equal(fs.readFileSync(path.join(root,original),'utf8'),initial);
      assert.match(fs.readFileSync(path.join(root,selected),'utf8'),/approved/);
    } finally { await session.close(); }
  }
});

test('interactive permission hook rewrites require approval of the current input', async () => {
  for (const scenario of ['allow', 'reject', 'abort', 'deny-change', 'ask-change', 'input-change', 'input-during-reprompt', 'input-after-approval', 'pre-deny', 'headless', 'resident'] as const) {
    const root = workspace();
    const effect = spy('write_file');
    const observed = path.join(root, 'pre.json');
    const hook = { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: {
      behavior: 'allow', updatedInput: { path: 'replacement.txt' },
      updatedPermissions: [{ type: 'addRules', rules: [{ toolName: 'hook-proposed' }], behavior: 'deny', destination: 'session' }],
    } } };
    const pre = scenario === 'pre-deny'
      ? `cat > ${shellQuote(observed)}; ${emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { path: 'blocked.txt' } } })}`
      : `${scenario === 'input-after-approval' ? 'sleep 0.2; ' : ''}cat > ${shellQuote(observed)}`;
    const session = Session.open(root, { config: config(root, [effect.tool], {
      permissions: { mode: 'default', allow: [], deny: ['Edit(blocked.txt)'], ask: ['write_file'] },
      hooks: { PermissionRequest: [{ command: emit(hook) }], PreToolUse: [{ command: pre }] },
    }) });
    const provider = new ScriptedProvider([response([call('one', 'write_file', { path: 'original.txt' })], 'tool_use'), done()]);
    const turn = new AbortController();
    const prompts: Array<{ input: unknown; reason: string }> = [];
    try {
      const agent = new Agent(session, provider, [effect.tool], {
        ...(scenario === 'headless' ? {} : { permissionPrompt: scenario === 'resident' ? 'unavailable' as const : 'interactive' as const }),
        permission: async request => {
          prompts.push({ input: structuredClone(request.input), reason: request.reason });
          if (scenario === 'abort') { turn.abort(); return true; }
          if (scenario === 'reject') return false;
          if (scenario === 'input-change') Object.assign(request.input as object, { path: 'changed.txt' });
          if (scenario === 'input-after-approval') setTimeout(() => Object.assign(request.input as object, { path: 'changed.txt' }), 40);
          if (scenario === 'deny-change') session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file' }], behavior: 'deny', destination: 'session' }]);
          if ((scenario === 'ask-change' || scenario === 'input-during-reprompt') && prompts.length === 1) {
            session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'write_file', ruleContent: 'replacement.txt' }], behavior: 'ask', destination: 'session' }]);
            if (scenario === 'input-during-reprompt') queueMicrotask(() => Object.assign(request.input as object, { path: 'changed.txt' }));
          }
          return true;
        },
      });
      await agent.run('exercise approval', turn.signal);
      const allowed = scenario === 'allow' || scenario === 'ask-change' || scenario === 'input-change' ||
        scenario === 'input-during-reprompt' || scenario === 'input-after-approval';
      assert.deepEqual(effect.inputs, allowed ? [{ path: 'replacement.txt' }] : [], scenario);
      assert.equal(prompts.length, scenario === 'headless' || scenario === 'resident' ? 0 :
        scenario === 'ask-change' || scenario === 'input-during-reprompt' ? 2 : 1, scenario);
      for (const prompt of prompts) {
        assert.deepEqual(prompt.input, { path: 'replacement.txt' }, scenario);
        assert.match(prompt.reason, /requires approval by permission rule/, scenario);
      }
      assert.equal(session.permissionOwner.state().deny.includes('hook-proposed'), false, scenario);
      const result = resultBatches(session)[0]?.[0];
      assert.ok(result, scenario);
      assert.equal(result.is_error === true, !allowed, scenario);
      assert.equal(fs.existsSync(observed), allowed || scenario === 'pre-deny', scenario);
      if (fs.existsSync(observed)) assert.deepEqual(JSON.parse(fs.readFileSync(observed, 'utf8')).tool_input, { path: 'replacement.txt' });
      assert.equal(session.events.filter(event => event.kind === 'hook_start' && event.event === 'PermissionRequest').length, 1, scenario);
      assertBatchAdjacency(session);
    } finally { session.close(); }
  }
});

test('interactive rewritten shell checks the HOME it executes after approval', async () => {
  const previous = process.env.HOME;
  const root = workspace(), tools = createTools();
  process.env.HOME = '/denied-fixture';
  const cfg = config(root, tools, { allowShell: true,
    permissions: { mode: 'default', allow: [], deny: [], ask: ['run_command'] },
    hooks: { PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: {
      behavior: 'allow', updatedInput: { command: 'X=old; X=new export Y; printf "$HOME" > marker.txt' },
    } } }) }] },
  });
  const session = Session.open(root, { config: cfg });
  const provider = new ScriptedProvider([response([call('one', 'run_command', { command: 'printf original' })], 'tool_use'), done()]);
  let prompts = 0;
  try {
    await new Agent(session, provider, tools, { permissionPrompt: 'interactive', permission: async () => {
      prompts++;
      process.env.HOME = '/allowed-fixture';
      session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'printf /denied-fixture' }], behavior: 'deny', destination: 'session' }]);
      return true;
    } }).run('check approved shell home');
    assert.equal(prompts, 1);
    const result = resultBatches(session)[0]?.[0];
    assert.equal(result?.is_error === true, true);
    assert.equal(fs.existsSync(path.join(root, 'marker.txt')), false);
  } finally {
    session.close();
    if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
  }
});

test('an identical PreToolUse rewrite repeats the explicit rule approval', async () => {
  const root = workspace(), effect = spy('write_file');
  const cfg = config(root, [effect.tool], { permissions: { mode: 'default', allow: [], deny: [], ask: ['write_file'] }, hooks: {
    PermissionRequest: [{ command: emit({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: {
      behavior: 'allow', updatedInput: { path: 'replacement.txt' },
    } } }) }],
    PreToolUse: [{ command: emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { path: 'replacement.txt' } } }) }],
  } });
  const session = Session.open(root, { config: cfg });
  const provider = new ScriptedProvider([response([call('one', 'write_file', { path: 'original.txt' })], 'tool_use'), done()]);
  const prompts: unknown[] = [];
  try {
    await new Agent(session, provider, [effect.tool], { permissionPrompt: 'interactive', permission: async request => {
      prompts.push(structuredClone(request.input)); return true;
    } }).run('check hook rewrite');
    assert.deepEqual(prompts, [{ path: 'replacement.txt' }, { path: 'replacement.txt' }]);
    assert.deepEqual(effect.inputs, [{ path: 'replacement.txt' }]);
    assert.deepEqual(session.events.filter(event => event.kind === 'hook_start' && (event.event === 'PermissionRequest' || event.event === 'PreToolUse'))
      .map(event => event.kind === 'hook_start' ? event.event : ''), ['PermissionRequest', 'PreToolUse', 'PermissionRequest']);
  } finally { session.close(); }
});

test('shell tools retain the HOME used by sampled permission checks', async () => {
  const previous = process.env.HOME;
  try {
    for (const name of ['run_command', 'run_background', 'monitor'] as const) {
      const root = workspace();
      const background = createBackgroundRegistry({ workspace: root });
      const tools = [...createTools(), ...background.tools];
      const cfg = config(root, tools, { allowShell: true,
        permissions: { mode: 'bypass', allow: [], deny: ['Bash(printf /denied-fixture)'] } });
      const input = { command: 'X=old; X=new export Y; printf "$HOME"',
        ...(name === 'run_command' ? {} : { description: 'owned fixture' }) };
      const provider = new ScriptedProvider([response([call('one', name, input)], 'tool_use'), done()]);
      process.env.HOME = '/allowed-fixture';
      const session = Session.open(root, { config: cfg });
      try {
        await new Agent(session, provider, tools, { status: text => {
          if (text === `tool: ${name}`) process.env.HOME = '/denied-fixture';
        } }).run('check shell home');
        const result = resultBatches(session)[0]?.[0];
        assert.equal(result?.is_error, undefined, name);
        const output = name === 'run_command' ? String(result?.content) :
          (await background.registry.waitFor(JSON.parse(String(result?.content)).id, 5000, new AbortController().signal)).stdout;
        assert.match(output, /\/allowed-fixture/, name);
        assert.doesNotMatch(output, /\/denied-fixture/, name);
      } finally { session.close(); await background.registry.close(); }
    }
  } finally {
    if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
  }
});

test('auto classification rechecks a changed HOME before accepting its verdict', async () => {
  const root = workspace();
  const tools = createTools();
  const cfg = config(root, tools, { allowShell: true,
    permissions: { mode: 'auto', allow: [], deny: ['Bash(printf /denied-fixture)'] } });
  let classifierCalls = 0;
  let sent = false;
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    if (typeof request.system === 'string' && request.system.startsWith('You are a security monitor')) {
      classifierCalls++;
      process.env.HOME = '/denied-fixture';
      return response([{ type: 'text', text: '<block>no</block>' }]);
    }
    if (!sent) {
      sent = true;
      return response([call('one', 'run_command', { command: 'X=old; X=new export Y; printf "$HOME" > marker.txt' })], 'tool_use');
    }
    return done();
  } };
  const previous = process.env.HOME;
  process.env.HOME = '/allowed-fixture';
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, tools).run('check shell home');
    assert.equal(classifierCalls, 1);
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, true);
    assert.equal(fs.existsSync(path.join(root, 'marker.txt')), false);
  } finally {
    if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
    await session.close();
  }
});

test('auto classification asks again when HOME changes but both decisions still ask', async () => {
  const root = workspace();
  const tools = createTools();
  const cfg = config(root, tools, { allowShell: true, permissions: { mode: 'auto', allow: [], deny: ['Bash(printf /never-match)'] } });
  const input = { command: 'X=old; X=new export Y; printf "$HOME" > marker.txt' };
  let classifierCalls = 0;
  let approvals = 0;
  let sent = false;
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    if (typeof request.system === 'string' && request.system.startsWith('You are a security monitor')) {
      classifierCalls++;
      process.env.HOME = '/second-fixture';
      return response([{ type: 'text', text: '<block>no</block>' }]);
    }
    if (!sent) {
      sent = true;
      return response([call('one', 'run_command', input)], 'tool_use');
    }
    return done();
  } };
  const previous = process.env.HOME;
  process.env.HOME = '/first-fixture';
  const session = Session.open(root, { config: cfg });
  try {
    assert.equal(permissionDecision(cfg.permissions, tools.find(tool => tool.schema.name === 'run_command')!, input).decision, 'ask');
    await new Agent(session, provider, tools, { permission: async () => { approvals++; return false; } }).run('check shell home');
    assert.equal(permissionDecision(cfg.permissions, tools.find(tool => tool.schema.name === 'run_command')!, input).decision, 'ask');
    assert.equal(classifierCalls, 1);
    assert.equal(approvals, 1);
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, true);
    assert.equal(fs.existsSync(path.join(root, 'marker.txt')), false);
  } finally {
    if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
    await session.close();
  }
});

test('a clamped shell rechecks the approved HOME after the permission callback changes it', async () => {
  const root = workspace();
  const tools = createTools();
  const cfg = config(root, tools, { allowShell: true, bashCommandClamp: [['Bash(printf:*)']],
    permissions: { mode: 'ask', allow: [], deny: [] } });
  const provider = new ScriptedProvider([response([call('one', 'run_command', { command: 'printf "%s" "$HOME"' })], 'tool_use'), done()]);
  const session = Session.open(root, { config: cfg });
  const previous = process.env.HOME;
  process.env.HOME = '/fixture/home-before';
  try {
    await new Agent(session, provider, tools, { permission: async () => {
      process.env.HOME = '/fixture/home-after';
      return true;
    } }).run('check shell home');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(result?.is_error, undefined);
    assert.match(String(result?.content), /^\/fixture\/home-before\n/);
    assert.doesNotMatch(String(result?.content), /\/fixture\/home-after/);
  } finally {
    if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
    await session.close();
  }
});

test('a clamped shell retains HOME across the final authorization and tool execution', async () => {
  const root = workspace();
  const tools = createTools();
  const cfg = config(root, tools, { allowShell: true, bashCommandClamp: [['Bash(printf:*)']] });
  const provider = new ScriptedProvider([response([call('one', 'run_command', { command: 'printf "%s" "$HOME"' })], 'tool_use'), done()]);
  const session = Session.open(root, { config: cfg });
  const previous = process.env.HOME;
  process.env.HOME = '/fixture/home-before';
  try {
    await new Agent(session, provider, tools, { status: text => {
      if (text === 'tool: run_command') process.env.HOME = '/fixture/home-after';
    } }).run('check shell home');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined);
    assert.match(String(resultBatches(session)[0]?.[0]?.content), /\/fixture\/home-before/);
    assert.doesNotMatch(String(resultBatches(session)[0]?.[0]?.content), /\/fixture\/home-after/);
  } finally {
    if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous;
    session.close();
  }
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

test("permission batches wait for their own primary writes across files", async () => {
  const root = workspace(), userDir = path.join(root,'user');
  const session = Session.open(root,{ config: config(root,[],{ configSources: { userDir } }) });
  const project = path.join(root,'.harness/settings.json');
  const { queuePermissionSettingsWrite } = await import('../src/permission-settings.js');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const blocked = queuePermissionSettingsWrite(project,() => gate);
  const rule = (toolName: string, destination: 'userSettings' | 'projectSettings'): import('../src/permissions.js').PermissionUpdate =>
    ({ type: 'addRules', behavior: 'deny', destination, rules: [{toolName}] });
  try {
    write(root,'.harness/settings.json','{broken');
    session.adoptPermissionUpdates([rule('first','projectSettings'),rule('second','userSettings')]);
    const independent: Promise<unknown>[] = [];
    session.adoptPermissionUpdates([rule('independent','userSettings')],{
      sessionId: session.id, onWrite: work => independent.push(work),
    });
    await Promise.all(independent);
    const userRules = () => JSON.parse(fs.readFileSync(path.join(userDir,'settings.json'),'utf8')).permissions.deny;
    assert.deepEqual(userRules(),['independent']);
    assert.deepEqual(session.permissionOwner.state().alwaysDenyRules.userSettings,['second','independent']);
    release();
    await session.drainPermissionWrites();
    assert.deepEqual(userRules(),['independent','second']);
    assert.deepEqual(session.permissionWriteResults.map(result => result.outcome),['written','error','written']);
  } finally { release(); await blocked; await session.close(); }
});

test("overlapping nested permission updates report only their own write to each caller", async () => {
  const root = workspace();
  const parent = Session.open(root, { config: config(root, []) });
  const child = Session.open(root, { config: parent.config }), nested = Session.open(root, { config: parent.config });
  try {
    child.inheritPermissionAdoption(parent.permissionOwner);
    nested.inheritPermissionAdoption(child.permissionOwner);
    write(root, ".harness/settings.local.json", "{broken");
    const apply = (session: Session, destination: 'projectSettings' | 'localSettings') => {
      const writes: Promise<import('../src/permission-settings.js').PermissionWriteResult>[] = [];
      session.adoptPermissionUpdates([{ type: 'addRules', behavior: 'deny', destination, rules: [{ toolName: 'fixture_rule' }] }],
        { sessionId: session.id, onWrite: write => writes.push(write) });
      return Promise.all(writes);
    };
    const [bad, good] = await Promise.all([apply(nested,'localSettings'),apply(parent,'projectSettings')]);
    assert.deepEqual(bad.map(result => result.outcome), ['error']);
    assert.deepEqual(good.map(result => result.outcome), ['written']);
    assert.equal(parent.permissionWriteResults.find(result => result.outcome === 'error')?.sessionId, nested.id);
    assert.equal(parent.permissionWriteResults.find(result => result.outcome === 'written')?.sessionId, parent.id);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'.harness/settings.json'),'utf8')).permissions.deny,['fixture_rule']);
  } finally { await nested.close(); await child.close(); await parent.close(); }
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

test('in-flight directory Read does not deliver bytes after grant revocation', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  write(outside, 'value', 'REVOKED_DIRECTORY_SECRET');
  const settings = config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } });
  const session = Session.open(root, { config: settings });
  const provider = new ScriptedProvider([
    response([call('read-revoked', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done(),
  ]);
  const originalSpawn = childProcess.spawn;
  let revoked = false;
  childProcess.spawn = ((...args: Parameters<typeof originalSpawn>) => {
    const child = originalSpawn(...args);
    if (String(args[0]).endsWith('/native/directory-read/read')) {
      const metadata = child.stdio[4];
      assert.ok(metadata && 'on' in metadata);
      metadata.once('data', () => {
        revoked = true;
        session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      });
    }
    return child;
  }) as typeof originalSpawn;
  syncBuiltinESMExports();
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, provider, tools).run('read the file');
    assert.equal(revoked, true, 'native helper opened the file');
    assert.doesNotMatch(JSON.stringify(provider.requests.at(-1)?.messages), /REVOKED_DIRECTORY_SECRET/);
  } finally {
    childProcess.spawn = originalSpawn;
    syncBuiltinESMExports();
    await session.close();
  }
});

test('completed directory Read revocation barriers isolate later delivery', async t => {
  for (const barrier of ['effect', 'hook', 'result', 'batch'] as const) await t.test(barrier, async () => {
    const root = workspace(), outside = workspace(), tools = createTools();
    const secret = 'COMPLETED_DIRECTORY_SECRET';
    write(outside, 'value', secret);
    const hooks = barrier === 'hook' ? { PostToolUse: [{ type: 'callback' as const, name: 'revoke' }] }
      : barrier === 'batch' ? { PostToolBatch: [{ type: 'callback' as const, name: 'revoke' }] } : undefined;
    const session = Session.open(root, { config: config(root, tools, {
      permissions: { mode: 'ask', allow: [], deny: [] }, ...(hooks ? { hooks } : {}),
    }) });
    const provider = new ScriptedProvider([response([call('read-revoked', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]);
    const displayed: string[] = [];
    let revoked = false;
    const revoke = () => {
      revoked = true;
      session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    };
    const append = session.append.bind(session);
    session.append = (event, authorization, backupToken) => {
      append(event, authorization, backupToken);
      if ((barrier === 'effect' && event.kind === 'tool_effect') || (barrier === 'result' && event.kind === 'tool_result')) revoke();
    };
    const id = session.id;
    let evidence = '', cold = '';
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, provider, tools, {
        toolResult: event => { if (revoked) displayed.push(event.content); },
        hookOptions: { resolveCallbackHook: async () => { revoke(); return { ok: true }; } },
      }).run('read fixture');
      evidence = fs.readFileSync(session.file, 'utf8');
    } finally { await session.close(); }
    cold = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      `import { Session } from './src/session.ts'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.messages)); } finally { await s.close(); }`,
      root, id], { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(revoked, true, `${barrier}: reached barrier`);
    assert.match(evidence, new RegExp(secret), `${barrier}: original audit evidence retained`);
    assert.deepEqual({
      model: JSON.stringify(provider.requests.at(-1)?.messages).includes(secret),
      terminalAfterRevocation: JSON.stringify(displayed).includes(secret),
      cold: cold.includes(secret),
    }, { model: false, terminalAfterRevocation: false, cold: false }, barrier);
  });
});

test('directory helper is cancelled across runtime release and same-ID rebind', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const secret = 'IN_FLIGHT_REBIND_SECRET';
  write(outside, 'value', secret + 'x'.repeat(8 * 1024 * 1024));
  write(outside, 'held', secret + 'y'.repeat(8 * 1024 * 1024));
  const settings = config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } });
  const provider = new ScriptedProvider([response([call('read-held', 'read_file', { path: path.join(outside, 'held') })], 'tool_use'), done()]);
  const runtime = await createRuntime(settings, provider, new AbortController().signal);
  const session = Session.open(root, { config: settings });
  const originalSpawn = childProcess.spawn;
  let helper: ReturnType<typeof originalSpawn> | undefined;
  let reached = () => {};
  const opened = new Promise<void>(resolve => { reached = resolve; });
  let reopened: Session | undefined;
  let fork: Session | undefined;
  let running: Promise<unknown> | undefined;
  const displayed: string[] = [];
  let released = false;
  childProcess.spawn = ((...args: Parameters<typeof originalSpawn>) => {
    const child = originalSpawn(...args);
    if (String(args[0]).endsWith('/native/directory-read/read')) {
      helper = child;
      child.stdout?.pause();
      const metadata = child.stdio[4];
      assert.ok(metadata && 'on' in metadata);
      metadata.once('data', reached);
    }
    return child;
  }) as typeof originalSpawn;
  syncBuiltinESMExports();
  try {
    await runtime.bindSession!(session);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const seed = new ScriptedProvider([response([call('read-seed', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]);
    childProcess.spawn = originalSpawn; syncBuiltinESMExports();
    await new Agent(session, seed, runtime.buildTools(session.config, session.id)).run('seed history');
    assert.match(JSON.stringify(seed.requests), new RegExp(secret));
    fork = forkSession(session);
    const coldFork = forkSession(session);
    const forkHandle = fork.workingDirectories(true).readHandle?.(outside);
    assert.ok(forkHandle);
    coldFork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    const coldId = coldFork.id;
    assert.match(fs.readFileSync(coldFork.file, 'utf8'), new RegExp(secret));
    coldFork.close();
    childProcess.spawn = ((...args: Parameters<typeof originalSpawn>) => {
      const child = originalSpawn(...args);
      if (String(args[0]).endsWith('/native/directory-read/read')) {
        helper = child; child.stdout?.pause();
        const metadata = child.stdio[4]; assert.ok(metadata && 'on' in metadata);
        metadata.once('data', reached);
      }
      return child;
    }) as typeof originalSpawn;
    syncBuiltinESMExports();
    const handle = session.workingDirectories(true).readHandle?.(outside);
    assert.ok(handle);
    running = new Agent(session, provider, runtime.buildTools(session.config, session.id), {
      toolResult: event => { if (released) displayed.push(event.content); },
    }).run('read fixture').catch(() => undefined);
    await opened;
    assert.ok(helper?.pid);
    const pid = helper.pid;
    assert.doesNotThrow(() => process.kill(pid, 0));
    for (let reader = 0; reader < 2; reader++) {
      const cold = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
        `import { Session } from './src/session.ts'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.messages)); } finally { s.close(); }`,
        root, coldId], { cwd: process.cwd(), encoding: 'utf8' });
      assert.doesNotMatch(cold, new RegExp(secret));
    }
    assert.doesNotThrow(() => process.kill(pid, 0));
    assert.match(JSON.stringify(fork.messages), new RegExp(secret));
    await runtime.releaseSession!(session.id);
    released = true;
    assert.equal(handle.signal.aborted, true);
    assert.throws(() => fs.fstatSync(handle.fd), { code: 'EBADF' });
    assert.equal(forkHandle.signal.aborted, false);
    assert.match(JSON.stringify(fork.messages), new RegExp(secret));
    fork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    assert.throws(() => fs.fstatSync(forkHandle.fd), { code: 'EBADF' });
    assert.doesNotMatch(JSON.stringify(fork.messages), new RegExp(secret));
    const forkProvider = new ScriptedProvider([done()]);
    await new Agent(fork, forkProvider, tools).run('continue fork');
    assert.doesNotMatch(JSON.stringify(forkProvider.requests), new RegExp(secret));
    session.close();
    reopened = Session.open(root, { id: session.id, config: settings });
    await runtime.bindSession!(reopened);
    const next = new ScriptedProvider([done()]);
    await new Agent(reopened, next, runtime.buildTools(reopened.config, reopened.id)).run();
    assert.doesNotMatch(JSON.stringify(next.requests), new RegExp(secret));
    const before = fs.readFileSync(session.file, 'utf8');
    await running;
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.equal(provider.requests.length, 1);
    assert.doesNotMatch(JSON.stringify(displayed), new RegExp(secret));
    assert.doesNotMatch(JSON.stringify(reopened.messages), new RegExp(secret));
    assert.equal(fs.readFileSync(session.file, 'utf8'), before);
  } finally {
    childProcess.spawn = originalSpawn; syncBuiltinESMExports();
    helper?.stdout?.resume(); await running; await runtime.close(); session.close(); reopened?.close(); fork?.close();
  }
});

test('directory Read held in hooks stays isolated across runtime release and same-ID rebind', { timeout: 30000 }, async t => {
  for (const barrier of ['PostToolUse', 'PostToolBatch', 'before-batch'] as const) await t.test(barrier, async () => {
    const root = workspace(), outside = workspace(), tools = createTools();
    const secret = `REBIND_DIRECTORY_SECRET_${barrier}`;
    write(outside, 'value', secret);
    const settings = config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] },
      hooks: { [barrier === 'before-batch' ? 'PostToolBatch' : barrier]: [{ type: 'callback' as const, name: 'hold' }] } });
    const provider = new ScriptedProvider([response([call('read-held', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]);
    const runtime = await createRuntime(settings, provider, new AbortController().signal);
    const session = Session.open(root, { config: settings });
    let reopened: Session | undefined;
    let release = () => {};
    let entered = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const reached = new Promise<void>(resolve => { entered = resolve; });
    const displayed: string[] = [];
    let afterRelease = false;
    let hookEntered = false;
    let running: Promise<unknown> | undefined;
    try {
      await runtime.bindSession!(session);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const handle = session.workingDirectories(true).readHandle?.(outside);
      assert.ok(handle);
      const agent = new Agent(session, provider, runtime.buildTools(session.config, session.id), {
        toolResult: event => { if (afterRelease) displayed.push(event.content); },
        hookOptions: { resolveCallbackHook: async () => { hookEntered = true; if (barrier !== 'before-batch') { entered(); await gate; } return { ok: true }; } },
      });
      if (barrier === 'before-batch') {
        const originalHook = Reflect.get(agent, 'hook');
        Reflect.set(agent, 'hook', async (...args: unknown[]) => {
          if (args[0] === 'PostToolBatch') { entered(); await gate; }
          return Reflect.apply(originalHook, agent, args);
        });
      }
      running = agent.run('read fixture').catch(() => undefined);
      await reached;
      if (barrier === 'before-batch') {
        assert.equal(hookEntered, false);
        assert.ok(session.events.some(event => event.kind === 'tool_result' && event.result.tool_use_id === 'read-held'));
      }
      assert.match(fs.readFileSync(session.file, 'utf8'), new RegExp(secret));
      await runtime.releaseSession!(session.id);
      afterRelease = true;
      assert.equal(handle.signal.aborted, true);
      assert.throws(() => fs.fstatSync(handle.fd), { code: 'EBADF' });
      session.close();
      reopened = Session.open(root, { id: session.id, config: settings });
      await runtime.bindSession!(reopened);
      const next = new ScriptedProvider([done()]);
      await new Agent(reopened, next, runtime.buildTools(reopened.config, reopened.id)).run();
      assert.doesNotMatch(JSON.stringify(next.requests), new RegExp(secret));
      const before = fs.readFileSync(session.file, 'utf8');
      release();
      await running;
      assert.equal(provider.requests.length, 1);
      assert.doesNotMatch(JSON.stringify(displayed), new RegExp(secret));
      assert.doesNotMatch(JSON.stringify(reopened.messages), new RegExp(secret));
      assert.equal(fs.readFileSync(session.file, 'utf8'), before);
      await runtime.releaseSession!(reopened.id);
      reopened.close(); reopened = undefined;
      for (let reader = 0; reader < 2; reader++) {
        const cold = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
          `import { Session } from './src/session.ts'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.messages)); } finally { s.close(); }`,
          root, session.id], { cwd: process.cwd(), encoding: 'utf8' });
        assert.doesNotMatch(cold, new RegExp(secret));
      }
      assert.match(fs.readFileSync(session.file, 'utf8'), new RegExp(secret));
    } finally {
      release(); await running; await runtime.close(); session.close(); reopened?.close();
    }
  });
});

test('real directory Read journals paired grant witnesses across regrant and cold open', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  write(outside, 'value', 'outside fixture');
  write(root, 'ordinary', 'ordinary fixture');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } }) });
  const id = session.id;
  const read = async (callId: string, file: string) => {
    const provider = new ScriptedProvider([response([call(callId, 'read_file', { path: file })], 'tool_use'), done()]);
    await new Agent(session, provider, tools).run('read fixture');
  };
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const first = session.workingDirectories(true).readHandle?.(outside);
    assert.ok(first);
    await read('grant-first', path.join(outside, 'value'));
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const second = session.workingDirectories(true).readHandle?.(outside);
    assert.ok(second);
    assert.notEqual(first.incarnation, second.incarnation);
    write(outside, 'value', 'outside fixture after regrant');
    await read('grant-second', path.join(outside, 'value'));
    assert.equal(resultBatches(session).find(batch => batch[0]?.tool_use_id === 'grant-first')?.[0]?.is_error, true);
    assert.match(String(resultBatches(session).find(batch => batch[0]?.tool_use_id === 'grant-second')?.[0]?.content), /outside fixture/);
    await read('ordinary', path.join(root, 'ordinary'));
    const result = { type: 'tool_result' as const, tool_use_id: 'schema-check', content: 'fixture' };
    for (const witness of [
      { owner: id, callId: 'schema-check' },
      { owner: id, incarnation: first.incarnation, callId: 'forged-call' },
      { owner: id, incarnation: first.incarnation, callId: 'schema-check', secret: 'unexpected' },
      { owner: 'forged', incarnation: first.incarnation, callId: 'schema-check' },
    ]) {
      assert.throws(() => session.append({ kind: 'tool_effect', result, readGrantWitness: witness } as never));
      assert.throws(() => session.append({ kind: 'tool_result', result, readGrantWitness: witness } as never));
    }
    // A legacy result remains accepted without a witness.
    session.append({ kind: 'tool_effect', result });
    const expected = [first, second].map((handle, index) => ({ owner: handle.owner, incarnation: handle.incarnation, callId: ['grant-first', 'grant-second'][index] }));
    await session.close();
    const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      `import { Session } from './src/session.ts'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.events.filter(e => e.kind === 'tool_effect' || e.kind === 'tool_result'))); } finally { await s.close(); }`,
      root, id], { cwd: process.cwd(), encoding: 'utf8' })) as Array<{ kind: string; result: ToolResult; readGrantWitness?: unknown }>;
    for (const [index, callId] of ['grant-first', 'grant-second'].entries()) {
      const rows = cold.filter(row => row.result.tool_use_id === callId);
      assert.deepEqual(rows.map(row => row.kind), ['tool_effect', 'tool_result']);
      assert.deepEqual(rows.map(row => row.readGrantWitness), [expected[index], expected[index]]);
    }
    assert.ok(cold.filter(row => row.result.tool_use_id === 'ordinary' || row.result.tool_use_id === 'schema-check').every(row => row.readGrantWitness === undefined));
    assert.doesNotMatch(JSON.stringify(cold.map(row => row.readGrantWitness)), /outside fixture|ordinary fixture|value/);
    const original = fs.readFileSync(session.file);
    try {
      for (const readGrantWitness of [
        { owner: id, callId: 'schema-check' },
        { owner: id, incarnation: first.incarnation, callId: 'forged-call' },
        { owner: id, incarnation: first.incarnation, callId: 'schema-check', secret: 'unexpected' },
      ]) {
        fs.writeFileSync(session.file, Buffer.concat([original, Buffer.from(`${JSON.stringify({ kind: 'tool_result', result, readGrantWitness })}\n`)]));
        const rejection = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
          `import { Session } from './src/session.ts'; try { const s = Session.open(process.argv[1], { id: process.argv[2] }); await s.close(); process.stdout.write('accepted'); } catch { process.stdout.write('rejected'); }`,
          root, id], { cwd: process.cwd(), encoding: 'utf8' });
        assert.equal(rejection, 'rejected');
      }
    } finally { fs.writeFileSync(session.file, original); }
  } finally { await session.close(); }
});

test('directory result projection isolates reused IDs, owners and pending recovery', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  write(outside, 'value', 'LIVE_GRANT_SECRET');
  const settings = config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } });
  const session = Session.open(root, { config: settings });
  const other = Session.open(root, { config: settings });
  const read = async () => {
    const provider = new ScriptedProvider([response([call('same-id', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]);
    await new Agent(session, provider, tools).run('read fixture');
  };
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    other.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await read();
    const first = session.events.find(event => event.kind === 'tool_result' && event.result.tool_use_id === 'same-id');
    assert.ok(first && first.kind === 'tool_result' && first.readGrantWitness);
    assert.equal(other.projectToolResult(first.result, first.readGrantWitness).is_error, true);
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    write(outside, 'value', 'LIVE_GRANT_SECRET after regrant');
    await read();
    const batches = resultBatches(session).filter(batch => batch[0]?.tool_use_id === 'same-id');
    assert.equal(batches[0]?.[0]?.is_error, true);
    assert.match(String(batches[1]?.[0]?.content), /LIVE_GRANT_SECRET/);
    const second = session.events.findLast(event => event.kind === 'tool_result' && event.result.tool_use_id === 'same-id');
    assert.ok(second && second.kind === 'tool_result' && second.readGrantWitness);
    const reusedFork = forkSession(session);
    try {
      const forkBatches = resultBatches(reusedFork).filter(batch => batch[0]?.tool_use_id === 'same-id');
      assert.equal(forkBatches[0]?.[0]?.is_error, true);
      assert.match(String(forkBatches[1]?.[0]?.content), /LIVE_GRANT_SECRET after regrant/);
      reusedFork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      reusedFork.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      assert.doesNotMatch(JSON.stringify(reusedFork.messages), /LIVE_GRANT_SECRET/);
    } finally { await reusedFork.close(); }
    // Exercise retained-history projection with the real read witness, then revoke it below.
    const preservedMessages = session.compactionRecords.slice(-3).map(entry => entry.reference);
    session.append({ kind: 'compact', summary: 'Earlier work', response: done(), preservedMessages });
    session.append({ kind: 'turn_end', reason: 'manual_compact' });
    assert.match(JSON.stringify(session.messages), /LIVE_GRANT_SECRET after regrant/);
    const compactFork = forkSession(session);
    try {
      assert.match(JSON.stringify(compactFork.messages), /LIVE_GRANT_SECRET after regrant/);
      compactFork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      assert.doesNotMatch(JSON.stringify(compactFork.messages), /LIVE_GRANT_SECRET/);
    } finally { await compactFork.close(); }
    session.append({ kind: 'message', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'pending', name: 'read_file', input: {} }] } });
    const pending = { type: 'tool_result' as const, tool_use_id: 'pending', content: 'PENDING_SECRET' };
    session.append({ kind: 'tool_result', result: pending, readGrantWitness: { ...second.readGrantWitness, callId: 'pending' } });
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    const provider = new ScriptedProvider([done()]);
    await new Agent(session, provider, tools).run();
    assert.doesNotMatch(JSON.stringify(provider.requests), /PENDING_SECRET/);
    assert.match(fs.readFileSync(session.file, 'utf8'), /PENDING_SECRET/);
    const id = session.id;
    await session.close();
    const reopened = Session.open(root, { id, config: settings });
    try {
      reopened.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      assert.doesNotMatch(JSON.stringify(reopened.messages), /LIVE_GRANT_SECRET|PENDING_SECRET/);
    } finally { await reopened.close(); }
  } finally { await session.close(); await other.close(); }
});

test('killed directory Read writer is recovered by independent processes', { timeout: 30000 }, async t => {
  for (const barrier of ['tool_effect', 'tool_result'] as const) await t.test(barrier, () => {
    const root = workspace(), outside = workspace();
    const secret = `PENDING_DIRECTORY_${barrier}_SECRET`;
    write(outside, 'value', secret);
    const marker = path.join(root, 'writer.json');
    const writer = `
      import fs from 'node:fs';
      import { Session } from './src/session.ts';
      import { Agent, defaultConfig } from './src/agent.ts';
      import { createTools } from './src/tools.ts';
      const [root, outside, marker, barrier] = process.argv.slice(1), tools = createTools();
      const config = { ...defaultConfig(root, tools), model:'fixture-model', permissions:{mode:'ask',allow:[],deny:[]} };
      const s = Session.open(root, {config});
      fs.writeFileSync(marker, JSON.stringify({id:s.id,file:s.file}));
      s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      const message = (content, stop_reason) => ({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
      const provider = {count:async()=>1, complete:async()=>message([{type:'tool_use',id:'pending-read',name:'read_file',input:{path:outside+'/value'}}],'tool_use')};
      const append = s.append.bind(s);
      s.append = (event, authorization, backupToken) => { append(event, authorization, backupToken); if(event.kind===barrier) {
        s.adoptPermissionUpdates([{type:'removeDirectories',directories:[outside],destination:'session'}]);
        process.kill(process.pid,'SIGKILL');
      } };
      await new Agent(s,provider,tools).run('read fixture');
      throw Error('barrier not reached');
    `;
    const killed = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer,
      root, outside, marker, barrier], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
    assert.equal(killed.signal, 'SIGKILL', killed.stderr);
    const { id, file } = JSON.parse(fs.readFileSync(marker, 'utf8')) as { id: string; file: string };
    const original = fs.readFileSync(file, 'utf8');
    assert.match(original, new RegExp(secret));
    assert.ok(fs.existsSync(`${file}.lock`));
    const reader = `
      import fs from 'node:fs';
      import { Session } from './src/session.ts';
      import { Agent } from './src/agent.ts';
      import { createTools } from './src/tools.ts';
      const [root,id,outside,receipt,killReader] = process.argv.slice(1);
      const s = Session.open(root,{id,recoverLock:true});
      s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      const requests=[], displayed=[];
      const provider={count:async()=>1,complete:async request=>{requests.push(request);return {id:'done',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}}};
      try { await new Agent(s,provider,createTools(),{toolResult:event=>displayed.push(event.content)}).run(s.awaitingResponse ? undefined : 'continue fixture');
        const result = JSON.stringify({messages:s.messages,requests,displayed});
        if (killReader === 'yes') { fs.writeFileSync(receipt,result); process.kill(process.pid,'SIGKILL'); }
        process.stdout.write(result);
      } finally { await s.close(); }
    `;
    for (let n = 0; n < 2; n++) {
      const receipt = path.join(root, `reader-${n}.json`);
      const readerProcess = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader,
        root, id, outside, receipt, n === 0 ? 'yes' : 'no'], { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
      assert.equal(n === 0 ? readerProcess.signal : readerProcess.status, n === 0 ? 'SIGKILL' : 0, readerProcess.stderr);
      const output = n === 0 ? fs.readFileSync(receipt, 'utf8') : readerProcess.stdout;
      assert.equal((JSON.parse(output) as { requests: unknown[] }).requests.length, 1);
      assert.doesNotMatch(output, new RegExp(secret), `${barrier}: recovery ${n}`);
      assert.ok(fs.readFileSync(file, 'utf8').startsWith(original), `${barrier}: original audit retained`);
    }
    assert.equal(fs.existsSync(`${file}.lock`), false);
  });
});

test('relocated directory history follows the successor grant', async () => {
  for (const carry of [false, true]) {
    const root = workspace(), outside = workspace(), target = workspace(), tools = createTools();
    const secret = `RELOCATED_DIRECTORY_SECRET_${carry}`;
    write(outside, 'value', secret);
    const source = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] },
      features: { tasks: false, subagents: false, sourcePlanTools: carry } }) });
    let next: Session | undefined;
    try {
      source.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const provider = new ScriptedProvider([response([call('relocated-read', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]);
      await new Agent(source, provider, tools).run('read fixture');
      next = relocateSession(source, target, () => createTools());
      assert.equal(JSON.stringify(next.messages).includes(secret), carry);
      if (carry) next.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      next.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const continuation = new ScriptedProvider([done()]);
      await new Agent(next, continuation, createTools()).run('continue after regrant');
      assert.doesNotMatch(JSON.stringify(continuation.requests), new RegExp(secret));
      const id = next.id;
      await next.close();
      for (let pass = 0; pass < 2; pass++) {
        const cold = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
          `import { Session } from './src/session.ts'; const s = Session.open(process.argv[1], { id: process.argv[2] }); try { process.stdout.write(JSON.stringify(s.messages)); } finally { await s.close(); }`,
          target, id], { cwd: process.cwd(), encoding: 'utf8' });
        assert.doesNotMatch(cold, new RegExp(secret));
      }
    } finally { await next?.close(); await source.close(); }
  }
});

for (const binding of ['inherited', 'adoption'] as const)
test(`ordinary fork of a child follows the ${binding} permission owner's directory lifetime`, async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const child = Session.open(root, { config: parent.snapshotConfig() });
  let fork: Session | undefined;
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    if (binding === 'inherited') child.inheritPermissions(parent.permissionOwner);
    else child.inheritPermissionAdoption(parent.permissionOwner);
    write(outside, 'read', 'SCOPED_FORK_READ');
    await new Agent(child, new ScriptedProvider([response([call('read', 'read_file', { path: path.join(outside, 'read') })], 'tool_use'), done()]), tools).run('read before fork');
    fork = forkSession(child);
    await child.close();
    const success = path.join(outside, 'permitted'), refused = path.join(outside, 'revoked');
    const provider = new ScriptedProvider([response([call('first', 'write_file', { path: success, content: 'allowed' })], 'tool_use'), done(),
      response([call('second', 'write_file', { path: refused, content: 'unexpected' })], 'tool_use'), done()]);
    const agent = new Agent(fork, provider, tools);
    await agent.run('write while granted');
    assert.equal(fs.readFileSync(success, 'utf8'), 'allowed');
    parent.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    await agent.run('write after revoke');
    assert.equal(fs.existsSync(refused), false);
    assert.match(JSON.stringify(provider.requests[0]?.messages), /SCOPED_FORK_READ/);
    assert.doesNotMatch(JSON.stringify(provider.requests.at(-1)?.messages), /SCOPED_FORK_READ/);
    assert.equal(fork.workingDirectories(false).readHandle?.(outside), undefined);
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    assert.ok(fork.workingDirectories(false).readHandle?.(outside));
    assert.doesNotMatch(JSON.stringify(fork.messages), /SCOPED_FORK_READ/);
    const id = fork.id;
    await fork.close();
    const cold = Session.open(root, { id });
    try {
      assert.equal(cold.workingDirectories(false).readHandle?.(outside), undefined);
      assert.doesNotMatch(JSON.stringify(cold.messages), /SCOPED_FORK_READ/);
    } finally { await cold.close(); }
  } finally { await fork?.close(); await child.close(); await parent.close(); }
});

test('forked directory history follows independent grant revocation', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const secret = 'FORK_DIRECTORY_SECRET';
  write(outside, 'value', secret);
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } }) });
  let fork: Session | undefined;
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const provider = new ScriptedProvider([response([call('fork-read', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]);
    await new Agent(parent, provider, tools).run('read fixture');
    fork = forkSession(parent);
    assert.match(JSON.stringify(fork.messages), new RegExp(secret));
    const grandchild = forkSession(fork);
    try {
      fork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      assert.match(JSON.stringify(grandchild.messages), new RegExp(secret));
    } finally { await grandchild.close(); }
    assert.doesNotMatch(JSON.stringify(fork.messages), new RegExp(secret));
    assert.match(JSON.stringify(parent.messages), new RegExp(secret));
    fork.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    assert.doesNotMatch(JSON.stringify(fork.messages), new RegExp(secret));
    const requests = new ScriptedProvider([done()]);
    await new Agent(fork, requests, tools).run('continue fixture');
    assert.doesNotMatch(JSON.stringify(requests.requests), new RegExp(secret));
    assert.match(fs.readFileSync(fork.file, 'utf8'), new RegExp(secret));
    const id = fork.id;
    await fork.close();
    const cold = Session.open(root, { id });
    try {
      cold.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      assert.doesNotMatch(JSON.stringify(cold.messages), new RegExp(secret));
    } finally { await cold.close(); }
    parent.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    const revokedFork = forkSession(parent);
    try { assert.doesNotMatch(JSON.stringify(revokedFork.messages), new RegExp(secret)); }
    finally { await revokedFork.close(); }
  } finally { await fork?.close(); await parent.close(); }
});

test('directory fork projects revoked history when parent grant is removed at copy barrier', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const secret = 'FORK_COPY_BARRIER_SECRET';
  write(outside, 'value', secret);
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } }) });
  let fork: Session | undefined;
  const carry = Session.prototype.carryForkPermissions;
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const parentHandle = parent.workingDirectories(true).readHandle?.(outside);
    assert.ok(parentHandle);
    await new Agent(parent, new ScriptedProvider([response([call('barrier-read', 'read_file', { path: path.join(outside, 'value') })], 'tool_use'), done()]), tools).run('read fixture');
    let copiedHandle: ReturnType<NonNullable<ReturnType<Session['workingDirectories']>['readHandle']>>;
    Session.prototype.carryForkPermissions = function (source) {
      carry.call(this, source);
      copiedHandle = this.workingDirectories(true).readHandle?.(outside);
      assert.ok(copiedHandle);
      assert.equal(copiedHandle.owner, this.id);
      assert.notEqual(copiedHandle.incarnation, parentHandle.incarnation);
      parent.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      assert.equal(parentHandle.signal.aborted, true);
      assert.throws(() => fs.fstatSync(parentHandle.fd), /EBADF/);
    };
    fork = forkSession(parent);
    assert.ok(copiedHandle!);
    assert.doesNotMatch(JSON.stringify(fork.messages), new RegExp(secret));
    assert.match(fs.readFileSync(fork.file, 'utf8'), new RegExp(secret));
    const requests = new ScriptedProvider([done()]);
    await new Agent(fork, requests, tools).run('continue fixture');
    assert.doesNotMatch(JSON.stringify(requests.requests), new RegExp(secret));
    await fork.close();
    assert.equal(copiedHandle.signal.aborted, true);
    assert.throws(() => fs.fstatSync(copiedHandle!.fd), /EBADF/);
  } finally {
    Session.prototype.carryForkPermissions = carry;
    await fork?.close();
    await parent.close();
  }
});

test('directory handles follow grant ownership and close on revoke and session close', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  write(outside, 'value', 'grant');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } }) });
  const child = Session.open(root, { config: parent.config });
  try {
    child.inheritPermissions(parent.permissionOwner);
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const inherited = child.workingDirectories(true);
    const handle = inherited.readHandle?.(outside);
    assert.ok(handle);
    const writeHandle = child.workingDirectories(false).readHandle?.(outside);
    assert.ok(writeHandle);
    assert.equal(writeHandle.owner, child.id);
    assert.notEqual(writeHandle.fd, handle.fd);
    assert.notEqual(writeHandle.incarnation, handle.incarnation);
    assert.equal(handle.owner, parent.id);
    assert.match(handle.incarnation, /^[0-9a-f-]{36}$/);
    assert.equal(fs.fstatSync(handle.fd, { bigint: true }).ino, fs.statSync(outside, { bigint: true }).ino);
    parent.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    assert.equal(handle.signal.aborted, true);
    assert.equal(inherited.readHandle?.(outside), undefined);
    assert.equal(writeHandle.signal.aborted, true);
    assert.throws(() => fs.fstatSync(writeHandle.fd), /EBADF/);
    assert.throws(() => fs.fstatSync(handle.fd), /EBADF/);
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const renewed = child.workingDirectories(true).readHandle?.(outside);
    assert.ok(renewed);
    const renewedWrite = child.workingDirectories(false).readHandle?.(outside);
    assert.ok(renewedWrite);
    assert.notEqual(renewedWrite.incarnation, writeHandle.incarnation);
    assert.equal(renewed.owner, parent.id);
    assert.notEqual(renewed.incarnation, handle.incarnation);
    await parent.close();
    assert.equal(renewed.signal.aborted, true);
    assert.equal(renewedWrite.signal.aborted, true);
    assert.throws(() => fs.fstatSync(renewedWrite.fd), /EBADF/);
    assert.equal(child.workingDirectories(true).readHandle?.(outside), undefined);
    assert.throws(() => fs.fstatSync(renewed.fd), /EBADF/);
  } finally { await child.close(); await parent.close(); }
  const settings = config(root, tools, { permissions: { mode: 'ask', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, new ScriptedProvider([]), new AbortController().signal);
  const owner = Session.open(root, { config: settings });
  try {
    await runtime.bindSession!(owner);
    owner.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const handles = owner.workingDirectories(true);
    const handle = handles.readHandle?.(outside);
    assert.ok(handle);
    await runtime.releaseSession!(owner.id);
    assert.equal(handle.signal.aborted, true);
    assert.equal(handles.readHandle?.(outside), undefined);
    assert.throws(() => fs.fstatSync(handle.fd), /EBADF/);
  } finally { await runtime.close(); await owner.close(); }
});

test('scoped edits reject the same directory regranted during child approval', async () => {
  const root = workspace(), outside = workspace();
  const tools = [...createTools(), ...createNotebookTools()];
  const session = Session.open(root, { config: config(root, tools) });
  const grant = (type: 'addDirectories' | 'removeDirectories') =>
    session.adoptPermissionUpdates([{ type, directories: [outside], destination: 'session' }]);
  try {
    grant('addDirectories');
    for (const name of ['edit_file', 'notebook_edit']) {
      const target = path.join(outside, name === 'edit_file' ? 'value.txt' : 'value.ipynb');
      const original = name === 'edit_file' ? 'before' : JSON.stringify({ nbformat: 4, nbformat_minor: 5,
        cells: [{id:'a', cell_type:'markdown', metadata:{}, source:'before'}], metadata:{} });
      fs.writeFileSync(target, original);
      const input = name === 'edit_file' ? {path:target, old_string:'before', new_string:'after'} :
        {path:target, cell_id:'a', new_source:'after'};
      const definition = tools.find(tool => tool.schema.name === name)!;
      let entered = 0;
      const execute = definition.execute;
      definition.execute = (input, context) => { entered++; return execute(input, context); };
      const scoped = bindScopedChildTool(definition, async (_input, context) => {
        const old = session.workingDirectories(false).readHandle?.(outside);
        assert.ok(old);
        grant('removeDirectories');
        grant('addDirectories');
        assert.equal(old.signal.aborted, true);
        assert.notEqual(session.workingDirectories(false).readHandle?.(outside)?.incarnation, old.incarnation);
        return context;
      });
      const context = {workspace:root, signal:new AbortController().signal, allowShell:false, maxOutputBytes:24000,
        workingDirectories: (readOnly: boolean) => session.workingDirectories(readOnly)};
      for (const invoke of [() => executeAgentTool(scoped, input, context), () => scoped.execute(input, context)]) {
        await assert.rejects(invoke, /directory grant changed during child approval/);
        assert.equal(entered, 0);
        assert.equal(fs.readFileSync(target, 'utf8'), original);
      }
    }
  } finally { await session.close(); }
});

test('fork skill does not write a replacement directory through an earlier approval', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const directory = path.join(outside, 'approved');
  fs.mkdirSync(directory);
  const skill = { name: 'directory-write-barrier', path: path.join(root, 'SKILL.md'), description: 'fixture',
    body: 'write fixture', context: 'fork' as const, userInvocable: true, disableModelInvocation: false };
  let childResult = '';
  const provider = new ScriptedProvider([
    response([call('directory-write', 'write_file', { path: path.join(directory, 'value'), content: 'WRITE_MARKER' })], 'tool_use'),
    request => { childResult = JSON.stringify(request.messages.at(-1)?.content); return done(); },
  ]);
  const controller = new AbortController();
  const settings = config(root, tools, { skills: [skill], permissions: { mode: 'ask', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, provider, controller.signal);
  settings.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(root, { config: settings });
  const registry = new AgentRegistry({ source: () => parent.config, provider, tools });
  let prompts = 0;
  try {
    await runtime.bindSession!(parent);
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [directory], destination: 'session' },
      { type: 'addRules', behavior: 'ask', destination: 'session', rules: [{ toolName: 'write_file' }] }]);
    const authorization = issueHumanSkillAuthorization(parent, skill.name, '', controller.signal, runtime.sessionLease!(parent));
    await executeSkill(skill, '', { config: parent.config, provider, tools, registry, signal: controller.signal,
      source: 'user', session: () => parent, humanAuthorization: authorization,
      requestPermission: async () => {
        prompts++;
        fs.renameSync(directory, `${directory}-original`);
        fs.mkdirSync(directory);
        return { decision: 'allow' };
      } });
    assert.equal(prompts, 1);
    assert.equal(fs.existsSync(path.join(directory, 'value')), false, 'replacement directory must not receive the write');
    assert.equal(fs.existsSync(path.join(`${directory}-original`, 'value')), false);
    assert.match(childResult, /directory grant changed during child approval/);
  } finally {
    await registry.close(); await runtime.close(); await parent.close();
  }
});

test('external Edit publishes a stable grant and refuses changed grants', async () => {
  const observed: { name: 'edit_file' | 'notebook_edit'; transition: 'stable' | 'revoke' | 'replace'; error: boolean }[] = [];
  const owners: { root: string; id: string }[] = [];
  for (const name of ['edit_file', 'notebook_edit'] as const) for (const transition of ['stable', 'revoke', 'replace'] as const) {
    const root = workspace(), outside = workspace(), moved = `${outside}-original`, tools = [...createTools(), ...createNotebookTools()];
    roots.push(moved);
    const target = path.join(outside, name === 'edit_file' ? 'value.txt' : 'value.ipynb');
    const original = name === 'edit_file' ? 'ORIGINAL_EXTERNAL_VALUE' : JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {},
      cells: [{ id: 'fixture', cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: 'ORIGINAL_EXTERNAL_VALUE' }] });
    fs.writeFileSync(target, original);
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' },
      ...(transition === 'replace' ? [{ type: 'addRules' as const, behavior: 'ask' as const, destination: 'session' as const, rules: [{ toolName: name }] }] : [])]);
    const tool = tools.find(tool => tool.schema.name === name)!;
    const execute = tool.execute;
    let effects = 0;
    tool.execute = (input, context) => execute(input, { ...context,
      hostResult: effect => { effects++; context.hostResult?.(effect); } });
    try {
      const input = name === 'edit_file' ? { path: target, old_string: 'ORIGINAL_EXTERNAL_VALUE', new_string: 'EDIT_MARKER' }
        : { path: target, cell_id: 'fixture', new_source: 'EDIT_MARKER' };
      const calls = name === 'edit_file' ? [call('external-edit', name, input)]
        : [call('external-read', 'notebook_read', { path: target }), call('external-edit', name, input)];
      let prompts = 0;
      await new Agent(session, new ScriptedProvider([response(calls, 'tool_use'), done()]), tools, {
        permissionPrompt: 'interactive', permission: async () => {
          prompts++;
          fs.renameSync(outside, moved); fs.mkdirSync(outside); fs.writeFileSync(target, original);
          return true;
        },
        status: message => {
          if (transition === 'revoke' && message === `tool: ${name}`)
            session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
        },
      }).run('edit external fixture');
      const result = resultBatches(session)[0]?.find(block => block.tool_use_id === 'external-edit');
      const error = result?.is_error === true;
      assert.equal(prompts, transition === 'replace' ? 1 : 0, `${name}/${transition} prompts`);
      if (transition === 'stable') {
        assert.equal(error, false, `${name}/stable: ${JSON.stringify(result)}`);
        assert.match(fs.readFileSync(target, 'utf8'), /EDIT_MARKER/);
        assert.equal(effects, 1, `${name}/stable effect`);
      } else {
        assert.equal(error, true, `${name}/${transition}: ${JSON.stringify(result)}`);
        assert.equal(fs.readFileSync(target, 'utf8'), original, `${name}/${transition} target`);
        if (transition === 'replace') assert.equal(fs.readFileSync(path.join(moved, path.basename(target)), 'utf8'), original);
        assert.equal(effects, 0, `${name}/${transition} effect`);
      }
      observed.push({ name, transition, error });
      owners.push({ root, id: session.id });
    } finally { await session.close(); }
  }
  const reader = `import {Session} from './src/session.ts'; const results=[]; for(const {root,id} of JSON.parse(process.argv[1])) {
    const s=Session.open(root,{id}); const row=s.events.find(e=>e.kind==='tool_result'&&e.result.tool_use_id==='external-edit');
    results.push({error:row?.result.is_error===true,success:s.events.some(e=>e.kind==='tool_effect'&&e.result.tool_use_id==='external-edit'&&!e.result.is_error),history:s.events.some(e=>e.kind==='file_history')});await s.close();}
    process.stdout.write(JSON.stringify(results));`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, JSON.stringify(owners)], { encoding: 'utf8' })),
    observed.map(row => ({ error: row.error, success: row.transition === 'stable', history: false })));
});

test('mutation directory gates preserve workspace and owned-plan edits', async () => {
  const root = workspace(), plans = workspace(), tools = [...createTools(), ...createNotebookTools()];
  const session = Session.open(root, { config: config(root, tools, { configSources: { userDir: plans }, features: { tasks: false, subagents: false, sourcePlanTools: true },
    permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    write(root, 'value.txt', 'ORIGINAL');
    write(root, 'value.ipynb', JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {},
      cells: [{ id: 'fixture', cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: 'ORIGINAL' }] }));
    assert.ok(session.planFilePath.startsWith(plans + path.sep));
    fs.mkdirSync(path.dirname(session.planFilePath), { recursive: true });
    fs.writeFileSync(session.planFilePath, 'ORIGINAL');
    await new Agent(session, new ScriptedProvider([response([
      call('workspace-edit', 'edit_file', { path: 'value.txt', old_string: 'ORIGINAL', new_string: 'WORKSPACE_EDITED' }),
      call('workspace-notebook-read', 'notebook_read', { path: 'value.ipynb' }),
      call('workspace-notebook', 'notebook_edit', { path: 'value.ipynb', cell_id: 'fixture', new_source: 'NOTEBOOK_EDITED' }),
      call('owned-plan-edit', 'edit_file', { path: session.planFilePath, old_string: 'ORIGINAL', new_string: 'PLAN_EDITED' }),
    ], 'tool_use'), done()]), tools).run('edit workspace and owned plan');
    assert.deepEqual(resultBatches(session)[0]?.map(result => result.is_error === true), [false, false, false, false]);
    assert.equal(fs.readFileSync(path.join(root, 'value.txt'), 'utf8'), 'WORKSPACE_EDITED');
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'value.ipynb'), 'utf8')).cells[0].source, 'NOTEBOOK_EDITED');
    assert.equal(fs.readFileSync(session.planFilePath, 'utf8'), 'PLAN_EDITED');
  } finally { await session.close(); }
});

test('Agent passes each actual Write call ID into its execution context', async () => {
  const root = workspace(), tools = createTools();
  const writeTool = tools.find(tool => tool.schema.name === 'write_file')!;
  const execute = writeTool.execute;
  const seen: (string | undefined)[] = [];
  writeTool.execute = async (input, context) => { seen.push(context.toolUseId); return execute(input, context); };
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    const provider = new ScriptedProvider([
      response([call('write-first', 'write_file', { path: 'one', content: '1' }),
        call('write-second', 'write_file', { path: 'two', content: '2' })], 'tool_use'), done(),
    ]);
    await new Agent(session, provider, tools).run('write two files');
    assert.deepEqual(seen, ['write-first', 'write-second']);
    assert.equal(session.events.some(event => event.kind === 'tool_start' && event.writeInputDigest !== undefined), false);
    assert.equal(fs.readFileSync(path.join(root, 'one'), 'utf8'), '1');
    assert.equal(fs.readFileSync(path.join(root, 'two'), 'utf8'), '2');
    await writeTool.execute({ path: 'direct', content: '3' }, { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 });
    assert.equal(seen.at(-1), undefined);
    assert.equal(fs.readFileSync(path.join(root, 'direct'), 'utf8'), '3');
  } finally { await session.close(); }
});

test('Agent rejects a raw Write handler introduced after authorization', async () => {
  const root = workspace(), tools = createTools();
  const write = tools.find(tool => tool.schema.name === 'write_file')!;
  const marker = path.join(root, 'getter-ran');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    const provider = new ScriptedProvider([response([call('raw-write', 'write_file', { path: 'target', content: 'value' })], 'tool_use'), done()]);
    await new Agent(session, provider, tools, { status(text) {
      if (text === 'tool: write_file') Object.defineProperty(write, 'executeBlocks', {
        get() { fs.writeFileSync(marker, 'unexpected'); return async () => 'replacement'; },
      });
    } }).run('write target');
    assert.equal(fs.existsSync(marker), false);
    assert.equal(fs.existsSync(path.join(root, 'target')), false);
    assert.match(String(resultBatches(session)[0]?.[0]?.content), /built-in write_file implementation changed/);
  } finally { await session.close(); }
});

test('Agent rejects a generic tool handler introduced after authorization', async () => {
  const root = workspace(), marker = path.join(root, 'generic-replacement');
  const probe: ToolDefinition = { readOnly: false, schema: { name: 'identity_probe', description: 'probe',
    input_schema: { type: 'object', properties: {} } }, async execute() { return 'ORIGINAL_RESULT'; } };
  const session = Session.open(root, { config: config(root, [probe], { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    const provider = new ScriptedProvider([response([call('generic-probe', 'identity_probe', {})], 'tool_use'), done()]);
    await new Agent(session, provider, [probe], { status(text) {
      if (text === 'tool: identity_probe') probe.execute = async () => {
        fs.writeFileSync(marker, 'UNEXPECTED'); return 'REPLACED_RESULT';
      };
    } }).run('run the identity probe');
    assert.equal(fs.existsSync(marker), false);
    assert.match(String(resultBatches(session)[0]?.[0]?.content), /Tool implementation changed after authorization/);
  } finally { await session.close(); }
});

test('Agent runs a stable generic tool implementation', async () => {
  const root = workspace();
  const probe: ToolDefinition = { readOnly: false, schema: { name: 'identity_probe', description: 'probe',
    input_schema: { type: 'object', properties: {} } }, async execute() { return 'ORIGINAL_RESULT'; } };
  const session = Session.open(root, { config: config(root, [probe], { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    const provider = new ScriptedProvider([response([call('generic-probe', 'identity_probe', {})], 'tool_use'), done()]);
    await new Agent(session, provider, [probe]).run('run the identity probe');
    assert.match(String(resultBatches(session)[0]?.[0]?.content), /ORIGINAL_RESULT/);
    assert.equal(session.events.some(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'generic-probe'), true);
  } finally { await session.close(); }
});

test('runtime wrapper rejects a substituted builtin Write before execution', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), file = path.join(outside, 'value'), marker = path.join(root, 'replacement-effect');
  fs.writeFileSync(file, 'ORIGINAL_DIRECTORY_BYTES');
  const builtin = createTools().find(tool => tool.schema.name === 'write_file'); assert.ok(builtin);
  const original = builtin.execute;
  const wrapper = bindRuntimeTool(builtin, { checkScope() {}, refresh() {
    builtin.execute = async () => { fs.writeFileSync(marker, 'UNEXPECTED_EFFECT');
      throw new Error('write_file: writes through additional directory grants are not implemented'); };
  }, checkJournal() {} });
  const session = Session.open(root, { config: config(root, [wrapper], { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('substituted-write', 'write_file',
      { path: file, content: 'NEVER_WRITTEN', overwrite: true })], 'tool_use'), done()]), [wrapper]).run('try substituted write');
    const result = resultBatches(session)[0]?.[0]; assert.equal(result?.is_error, true);
    assert.equal(fs.existsSync(marker), false); assert.equal(fs.readFileSync(file, 'utf8'), 'ORIGINAL_DIRECTORY_BYTES');
    assert.match(String(result?.content), /Runtime built-in write_file implementation changed/);
    assert.equal(session.events.some(event => event.kind === 'directory_backup'), false);
  } finally { builtin.execute = original; await session.close(); }
  const reader = `import {Session} from './src/session.ts';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
    const effect=s.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='substituted-write');
    process.stdout.write(JSON.stringify({error:effect?.result.content,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, outside],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { error: 'Runtime built-in write_file implementation changed', grant: false });
  }
  const context = { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
  const late = bindRuntimeTool(builtin, { checkScope() {}, refresh() {}, checkJournal() {} });
  try {
    builtin.execute = async () => { fs.writeFileSync(marker, 'LATE_REPLACEMENT'); return 'replacement'; };
    await assert.rejects(late.execute({ path: 'late.txt', content: 'NO' }, context), /Runtime built-in write_file implementation changed/);
    assert.equal(fs.existsSync(marker), false);
  } finally { builtin.execute = original; }
  const descriptor = Object.getOwnPropertyDescriptor(builtin, 'execute'); assert.ok(descriptor);
  const accessor = bindRuntimeTool(builtin, { checkScope() {}, refresh() {
    Object.defineProperty(builtin, 'execute', { configurable: true, get() { fs.writeFileSync(marker, 'GETTER_EFFECT'); return original; } });
  }, checkJournal() {} });
  try {
    await assert.rejects(accessor.execute({ path: 'accessor.txt', content: 'NO' }, context), /Runtime built-in write_file implementation changed/);
    assert.equal(fs.existsSync(marker), false);
  } finally { Object.defineProperty(builtin, 'execute', descriptor); }
  const safe = bindRuntimeTool(builtin, { checkScope() {}, refresh() {}, checkJournal() {} });
  assert.match(await safe.execute({ path: 'normal.txt', content: 'NORMAL' }, context), /wrote/);
  assert.equal(fs.readFileSync(path.join(root, 'normal.txt'), 'utf8'), 'NORMAL');
});

test('Agent rejects substituted builtin Write wrappers before dispatch', { timeout: 30000 }, async () => {
  const observed: Array<{ scenario: string; marker: boolean; error: string; backup: boolean; original: string }> = [];
  const readers: Array<{ root: string; id: string; outside: string; error: string }> = [];
  for (const scenario of ['execute', 'execute-getter', 'blocks', 'blocks-getter', 'prototype', 'normal', 'custom'] as const) {
    const root = workspace(), outside = workspace(), file = path.join(outside, 'value'), marker = path.join(root, 'outer-effect');
    fs.writeFileSync(file, 'OUTER_ORIGINAL');
    const builtin = createTools().find(tool => tool.schema.name === 'write_file'); assert.ok(builtin);
    const wrapper = bindRuntimeTool(builtin, { checkScope() {}, refresh() {}, checkJournal() {} });
    const tool = scenario === 'custom' ? { ...wrapper } : wrapper;
    const session = Session.open(root, { config: config(root, [tool], { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const replacement = async () => { fs.writeFileSync(marker, 'REPLACEMENT_EFFECT');
        throw new Error('write_file: writes through additional directory grants are not implemented'); };
      if (scenario === 'execute') tool.execute = replacement;
      if (scenario === 'execute-getter') Object.defineProperty(tool, 'execute', { configurable: true, get() {
        fs.writeFileSync(marker, 'GETTER_EFFECT'); return replacement;
      } });
      if (scenario === 'blocks') tool.executeBlocks = replacement;
      if (scenario === 'blocks-getter') Object.defineProperty(tool, 'executeBlocks', { configurable: true, get() {
        fs.writeFileSync(marker, 'GETTER_EFFECT'); return replacement;
      } });
      if (scenario === 'prototype') Object.setPrototypeOf(tool, { get executeBlocks() {
        fs.writeFileSync(marker, 'PROTOTYPE_EFFECT'); return replacement;
      } });
      if (scenario === 'custom') tool.executeBlocks = async () => { fs.writeFileSync(marker, 'CUSTOM_EFFECT'); return 'custom result'; };
      await new Agent(session, new ScriptedProvider([response([call('outer-write', 'write_file',
        { path: file, content: 'NOT_WRITTEN', overwrite: true })], 'tool_use'), done()]), [tool]).run('try wrapper write');
      const result = resultBatches(session)[0]?.[0];
      assert.equal(session.events.some(event => event.kind === 'tool_start' && event.runtimeWriteOwner !== undefined), false);
      observed.push({ scenario, marker: fs.existsSync(marker), error: String(result?.content),
        backup: session.events.some(event => event.kind === 'directory_backup'), original: fs.readFileSync(file, 'utf8') });
      if (scenario === 'blocks-getter' || scenario === 'normal') readers.push({ root, id: session.id, outside, error: String(result?.content) });
    } finally { await session.close(); }
  }
  const changed = 'Runtime built-in write_file wrapper changed';
  assert.deepEqual(observed, [
    ...['execute', 'execute-getter', 'blocks', 'blocks-getter', 'prototype'].map(scenario => ({ scenario, marker: false, error: changed, backup: false, original: 'OUTER_ORIGINAL' })),
    { scenario: 'normal', marker: false, error: 'File has not been read in full. Read it again before attempting to write it.', backup: true, original: 'OUTER_ORIGINAL' },
    { scenario: 'custom', marker: true, error: 'custom result', backup: false, original: 'OUTER_ORIGINAL' },
  ]);
  const reader = `import {Session} from './src/session.ts';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
    const effect=s.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='outer-write');
    process.stdout.write(JSON.stringify({error:effect?.result.content,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (const entry of readers) for (let i = 0; i < 2; i++) {
    const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, entry.root, entry.id, entry.outside],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { error: entry.error, grant: false });
  }
});

test('compiled CLI rejects swapped outer Write dispatch and retains normal writes', { timeout: 45000 }, async () => {
  for (const scenario of ['execute', 'blocks', 'normal'] as const) {
    const root = workspace(), outside = workspace(), userDir = path.join(root, 'user'), file = path.join(outside, 'value');
    const marker = path.join(root, 'outer-effect'), trace = path.join(root, 'outer-captured'), preload = path.join(root, 'outer-provider.mjs');
    fs.mkdirSync(userDir); fs.writeFileSync(file, 'CLI_OUTER_ORIGINAL');
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
      const {Agent}=await import(${JSON.stringify(new URL('../dist/agent.js', import.meta.url).href)}),run=Agent.prototype.run;let intercepted=false;
      Agent.prototype.run=async function(...args){if(!intercepted){intercepted=true;const wrapper=this.tools.get('write_file');
        if(!wrapper)throw Error('outer Write was not selected');fs.writeFileSync(${JSON.stringify(trace)},'captured');
        const replacement=async()=>{fs.writeFileSync(${JSON.stringify(marker)},'UNEXPECTED_EFFECT');throw Error('write_file: writes through additional directory grants are not implemented')};
        if(${JSON.stringify(scenario)}==='execute')wrapper.execute=replacement;if(${JSON.stringify(scenario)}==='blocks')wrapper.executeBlocks=replacement}return run.apply(this,args)};
      const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let calls=0;
      GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(_request,_signal,onText)=>{
        const first=calls++===0,scenario=${JSON.stringify(scenario)};
        const writes=[{type:'tool_use',id:'cli-outer-write',name:'write_file',input:{path:${JSON.stringify(file)},content:'NO',overwrite:true}}];
        if(scenario==='normal')writes.push({type:'tool_use',id:'cli-normal-workspace',name:'write_file',input:{path:'normal.txt',content:'NORMAL'}});
        const content=first?writes:[{type:'text',text:'done'}];if(!first)onText?.('done');
        return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
    const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', userDir,
      '--model', 'fixture-model', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'],
      { cwd: process.cwd(), input: `/add-dir ${outside}\ntry the directory write\n/exit\n`, encoding: 'utf8', timeout: 20000,
        env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    assert.equal(cli.status, 0, cli.stderr + cli.stdout); assert.equal(fs.readFileSync(trace, 'utf8'), 'captured');
    assert.equal(fs.existsSync(marker), false); assert.equal(fs.readFileSync(file, 'utf8'), scenario === 'normal' ? 'NO' : 'CLI_OUTER_ORIGINAL');
    if (scenario === 'normal') assert.equal(fs.readFileSync(path.join(root, 'normal.txt'), 'utf8'), 'NORMAL');
    const directory = path.join(root, '.agent'), journal = fs.readdirSync(directory).find(name => name.endsWith('.jsonl')); assert.ok(journal);
    const rows = fs.readFileSync(path.join(directory, journal), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const effect = rows.find(row => row.kind === 'tool_effect' && row.result.tool_use_id === 'cli-outer-write');
    const start = rows.find(row => row.kind === 'tool_start' && row.id === 'cli-outer-write');
    const runtimeOwner = start?.runtimeWriteOwner ?? null;
    if (scenario === 'normal') {
      assert.equal(runtimeOwner?.owner, journal.slice(0, -6)); assert.match(runtimeOwner?.incarnation ?? '', /^[0-9a-f-]{36}$/);
    } else assert.equal(runtimeOwner, null);
    const execution = rows.filter(row => row.kind === 'runtime_write_execution' && row.id === 'cli-outer-write');
    assert.deepEqual(execution.map(row => ({ phase: row.phase, outcome: row.outcome ?? null })), scenario === 'normal' ? [
      { phase: 'entered', outcome: null }, { phase: 'completed', outcome: 'returned' },
    ] : []);
    const expected = scenario === 'normal' ? `overwrote 2 bytes to ${path.relative(root, file)}` : 'Runtime built-in write_file wrapper changed';
    assert.equal(effect?.result?.content, expected); assert.equal(effect?.result?.is_error, scenario === 'normal' ? undefined : true);
    assert.equal(rows.some(row => row.kind === 'directory_backup'), scenario === 'normal');
    const reader = `import {Session} from './dist/session.js';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
      const effect=s.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='cli-outer-write');
      const start=s.events.find(event=>event.kind==='tool_start'&&event.id==='cli-outer-write');
      const execution=s.events.filter(event=>event.kind==='runtime_write_execution'&&event.id==='cli-outer-write');
      process.stdout.write(JSON.stringify({error:effect?.result.content,owner:start?.runtimeWriteOwner??null,execution,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold: childProcess.SpawnSyncReturns<string> = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, journal.slice(0, -6), outside],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { error: expected, owner: runtimeOwner, execution, grant: false });
    }
  }
});

test('compiled CLI rejects a swapped builtin Write and keeps the normal path', { timeout: 30000 }, async () => {
  for (const swapped of [true, false]) {
    const root = workspace(), outside = workspace(), userDir = path.join(root, 'user'), file = path.join(outside, 'value');
    const marker = path.join(root, 'replacement-effect'), trace = path.join(root, 'write-tool-captured'), preload = path.join(root, 'write-provider.mjs');
    fs.mkdirSync(userDir); fs.writeFileSync(file, 'CLI_DIRECTORY_ORIGINAL');
    fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
      const get=WeakMap.prototype.get;let builtin;
      WeakMap.prototype.get=function(key){const value=get.call(this,key);try{const schema=key&&Object.getOwnPropertyDescriptor(key,'schema'),execute=key&&Object.getOwnPropertyDescriptor(key,'execute');
        if(!builtin&&typeof value==='function'&&schema&&'value'in schema&&schema.value?.name==='write_file'&&execute&&'value'in execute&&execute.value===value){
          builtin=key;WeakMap.prototype.get=get;fs.writeFileSync(${JSON.stringify(trace)},'captured')}}catch{}return value};
      const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let calls=0;
      GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(_request,_signal,onText)=>{
        const first=calls++===0;if(first&&${JSON.stringify(swapped)}){if(!builtin)throw Error('builtin Write was not captured');
          builtin.execute=async()=>{fs.writeFileSync(${JSON.stringify(marker)},'UNEXPECTED_EFFECT');throw Error('write_file: writes through additional directory grants are not implemented')}}
        const content=first?[{type:'tool_use',id:'cli-swapped-write',name:'write_file',input:{path:${JSON.stringify(file)},content:'NO',overwrite:true}}]:[{type:'text',text:'done'}];
        if(!first)onText?.('done');return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,
          stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
    const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', userDir,
      '--model', 'fixture-model', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'],
      { cwd: process.cwd(), input: `/add-dir ${outside}\ntry the directory write\n/exit\n`, encoding: 'utf8', timeout: 20000,
        env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
    assert.equal(cli.status, 0, cli.stderr + cli.stdout); assert.equal(fs.readFileSync(trace, 'utf8'), 'captured');
    assert.equal(fs.existsSync(marker), false); assert.equal(fs.readFileSync(file, 'utf8'), swapped ? 'CLI_DIRECTORY_ORIGINAL' : 'NO');
    const directory = path.join(root, '.agent'), journal = fs.readdirSync(directory).find(name => name.endsWith('.jsonl')); assert.ok(journal);
    const rows = fs.readFileSync(path.join(directory, journal), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const effect = rows.find(row => row.kind === 'tool_effect' && row.result.tool_use_id === 'cli-swapped-write');
    const start = rows.find(row => row.kind === 'tool_start' && row.id === 'cli-swapped-write');
    if (swapped) assert.equal(start?.runtimeWriteOwner, undefined);
    else { assert.equal(start?.runtimeWriteOwner?.owner, journal.slice(0, -6)); assert.match(start?.runtimeWriteOwner?.incarnation ?? '', /^[0-9a-f-]{36}$/); }
    const expected = swapped ? 'Runtime built-in write_file implementation changed' : `overwrote 2 bytes to ${path.relative(root, file)}`;
    assert.equal(effect?.result?.content, expected); assert.equal(effect?.result?.is_error, swapped ? true : undefined);
    assert.equal(rows.some(row => row.kind === 'directory_backup'), !swapped);
    const reader = `import {Session} from './dist/session.js';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id});
      const effect=s.events.find(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='cli-swapped-write');
      process.stdout.write(JSON.stringify({error:effect?.result.content,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold: childProcess.SpawnSyncReturns<string> = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, journal.slice(0, -6), outside],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { error: expected, grant: false });
    }
  }
});

test('compiled CLI retains Write execution boundaries after process death', { timeout: 45000 }, async () => {
  for (const phase of ['start', 'entered', 'completed', 'partial-completion'] as const) {
  const root = workspace(), outside = workspace(), userDir = path.join(root, 'user'), file = path.join(outside, 'value');
  const preload = path.join(root, 'write-start-death.mjs');
  fs.mkdirSync(userDir); fs.writeFileSync(file, 'START_DEATH_ORIGINAL');
  fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
    const phase=${JSON.stringify(phase)};
    if(phase==='partial-completion'){const write=fs.writeSync;fs.writeSync=new Proxy(write,{apply(target,self,args){const [fd,bytes,offset,length]=args;
      if(Buffer.isBuffer(bytes)&&bytes.toString('utf8').startsWith('{"kind":"runtime_write_execution"')&&bytes.toString('utf8').includes('"phase":"completed"')){
        Reflect.apply(target,self,[fd,bytes,offset,Math.min(length,Math.floor(bytes.length/2))]);process.kill(process.pid,'SIGKILL')}
      return Reflect.apply(target,self,args)}})}
    const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),append=Session.prototype.append;
    Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
      if(event.id==='start-death-write'&&((phase==='start'&&event.kind==='tool_start')||
        (event.kind==='runtime_write_execution'&&event.phase===phase))){if(!event.runtimeWriteOwner)throw Error('runtime owner missing');process.kill(process.pid,'SIGKILL')}return result};
    const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let calls=0;
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{const first=calls++===0;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:first?[{type:'tool_use',id:'start-death-write',name:'write_file',
        input:{path:${JSON.stringify(file)},content:'NO',overwrite:true}}]:[{type:'text',text:'done'}],stop_reason:first?'tool_use':'end_turn',
        stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', userDir,
    '--model', 'fixture-model', '--permission-mode', 'bypass', '--interactive', '--no-tui', '--no-inherit-gateway'],
    { cwd: process.cwd(), input: `/add-dir ${outside}\ntry the directory write\n/exit\n`, encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
  assert.equal(cli.signal, 'SIGKILL', cli.stderr + cli.stdout);
  const directory = path.join(root, '.agent'), journal = fs.readdirSync(directory).find(name => name.endsWith('.jsonl')); assert.ok(journal);
  const raw = fs.readFileSync(path.join(directory, journal));
  const id = journal.slice(0, -6), rows = raw.subarray(0, raw.lastIndexOf(10) + 1).toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
  const start = rows.find(row => row.kind === 'tool_start' && row.id === 'start-death-write');
  assert.equal(start?.runtimeWriteOwner?.owner, id); assert.match(start?.runtimeWriteOwner?.incarnation ?? '', /^[0-9a-f-]{36}$/);
  assert.equal(rows.some(row => row.kind === 'tool_effect' && row.result.tool_use_id === 'start-death-write'), false);
  const execution = rows.filter(row => row.kind === 'runtime_write_execution');
  assert.deepEqual(execution.map(row => row.phase), phase === 'start' ? [] : phase === 'completed' ? ['entered', 'completed'] : ['entered']);
  assert.equal(rows.some(row => row.kind === 'directory_backup' && row.toolUseId === 'start-death-write'), phase === 'completed' || phase === 'partial-completion');
  // The completed boundary is recorded after the directory publication; killing there
  // leaves the new bytes but no tool_effect, so recovery must report no effect, not roll back.
  assert.equal(fs.readFileSync(file, 'utf8'), phase === 'start' || phase === 'entered' ? 'START_DEATH_ORIGINAL' : 'NO');
  const reader = `import {Session} from './dist/session.js';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:true});
    const start=s.events.find(event=>event.kind==='tool_start'&&event.id==='start-death-write');
    process.stdout.write(JSON.stringify({owner:start?.runtimeWriteOwner,effect:s.events.some(event=>event.kind==='tool_effect'&&event.result.tool_use_id==='start-death-write'),
      execution:s.events.filter(event=>event.kind==='runtime_write_execution'),
      grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, id, outside],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr);
    assert.deepEqual(JSON.parse(cold.stdout), { owner: start.runtimeWriteOwner, effect: false, execution, grant: false });
  }
  if (phase === 'partial-completion') {
    const torn = fs.readdirSync(directory).filter(name => name.startsWith(`${journal}.torn-`));
    assert.equal(torn.length, 1); assert.deepEqual(fs.readFileSync(path.join(directory, torn[0]!)), raw);
  }
  }
});

test('directory file history snapshots tracked bytes and modes at actual user turns', async () => {
  const root = workspace(), outside = workspace(), tools = createTools(), target = path.join(outside, 'value');
  fs.writeFileSync(target, 'FIRST_SNAPSHOT', { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let expected: { messageIds: string[]; backupIds: string[] };
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const callWrite = (id: string) => response([call(id, 'write_file', { path: target, content: 'NOT_PUBLISHED', overwrite: false })], 'tool_use');
    const agent = new Agent(session, new ScriptedProvider([callWrite('first-write'), done(), done(), callWrite('third-write'), done()]), tools);
    await agent.run('first turn');
    fs.writeFileSync(target, 'SECOND_SNAPSHOT'); fs.chmodSync(target, 0o640);
    await agent.run('second turn');
    await agent.run('third turn');
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind !== 'available') throw new Error('directory history unavailable');
    assert.equal(history.snapshots.length, 3);
    const references = history.snapshots.map(snapshot => snapshot.entries.find(entry => entry.path.lexicalPath === target)?.reference);
    assert.deepEqual(references.map(reference => reference?.kind), ['present', 'present', 'present']);
    if (references.some(reference => !reference || reference.kind !== 'present')) throw new Error('missing source history');
    const [first, second, third] = references;
    if (!first || first.kind !== 'present' || !second || second.kind !== 'present' || !third || third.kind !== 'present') throw new Error('invalid history');
    assert.deepEqual([first.version, second.version, third.version], [1, 2, 2]);
    assert.notEqual(first.backupId, second.backupId); assert.equal(second.backupId, third.backupId);
    assert.equal(session.readDirectoryHistoryBackup(first.backupId)?.bytes.toString(), 'FIRST_SNAPSHOT');
    assert.equal(session.readDirectoryHistoryBackup(first.backupId)?.observation.mode, 0o751);
    assert.equal(session.readDirectoryHistoryBackup(second.backupId)?.bytes.toString(), 'SECOND_SNAPSHOT');
    assert.equal(session.readDirectoryHistoryBackup(second.backupId)?.observation.mode, 0o640);
    assert.equal(fs.readFileSync(target, 'utf8'), 'SECOND_SNAPSHOT');
    expected = { messageIds: history.snapshots.map(snapshot => snapshot.messageId), backupIds: [first.backupId, second.backupId, third.backupId] };
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});const h=s.directoryFileHistory;
    if(h.kind!=='available')throw Error('history unavailable');const entries=h.snapshots.map(x=>x.entries.find(e=>e.path.lexicalPath===process.argv[3])?.reference);
    process.stdout.write(JSON.stringify({messageIds:h.snapshots.map(x=>x.messageId),backupIds:entries.map(x=>x?.backupId),versions:entries.map(x=>x?.version),
      contents:entries.map(x=>x?.kind==='present'?s.readDirectoryHistoryBackup(x.backupId)?.bytes.toString():null),
      modes:entries.map(x=>x?.kind==='present'?s.readDirectoryHistoryBackup(x.backupId)?.observation.mode:null)}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, target], { encoding: 'utf8' }));
    assert.deepEqual(cold, { ...expected, versions: [1, 2, 2], contents: ['FIRST_SNAPSHOT', 'SECOND_SNAPSHOT', 'SECOND_SNAPSHOT'], modes: [0o751, 0o640, 0o640] });
  }
  const snapshot = session.events.filter(event => event.kind === 'directory_snapshot')[2];
  assert.ok(snapshot && snapshot.kind === 'directory_snapshot');
  const receipt = `${session.file}.snapshot-commit-receipt-${snapshot.id}`, original = fs.readFileSync(receipt);
  try {
    const altered = JSON.parse(original.toString()); altered.witness = '0'.repeat(64);
    fs.writeFileSync(receipt, JSON.stringify(altered));
    const corruptReader = `import fs from 'node:fs';import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      const before=fs.readFileSync(s.file);s.recoverInterruptedDirectoryFileHistory(new AbortController().signal);
      process.stdout.write(JSON.stringify({kind:s.directoryFileHistory.kind,bytes:s.readDirectoryHistoryBackup(process.argv[3])?.bytes.toString(),unchanged:fs.readFileSync(s.file).equals(before)}));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', corruptReader, root, session.id, expected.backupIds[0]!], { encoding: 'utf8' })), { kind: 'unknown', unchanged: true });
  } finally { fs.writeFileSync(receipt, original); }
});

test('directory file history first tracks a missing Write target across cold opens', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'new-value'), tools = createTools();
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const stat = fs.statSync(outside, { bigint: true });
  const reference = { kind: 'missing', parent: { dev: String(stat.dev), ino: String(stat.ino) }, version: 1 };
  let witnessId = '';
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('missing-write', 'write_file', { path: target, content: 'NEW' })], 'tool_use'), done()]), tools).run('track absent target');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined);
    assert.equal(fs.readFileSync(target, 'utf8'), 'NEW');
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind === 'available') assert.deepEqual(history.snapshots[0]?.entries.find(entry => entry.path.lexicalPath === target)?.reference, reference);
    const witness = session.events.find(row => row.kind === 'directory_missing_backup');
    assert.ok(witness && witness.kind === 'directory_missing_backup');
    witnessId = witness.id;
    assert.equal(fs.existsSync(`${session.file}.backup-unknown-${witness.id}`), false);
    assert.throws(() => session.append(witness), /live transaction/);
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});const h=s.directoryFileHistory;
    process.stdout.write(JSON.stringify(h.kind==='available'?h.snapshots[0]?.entries.find(e=>e.path.lexicalPath===process.argv[3])?.reference:h));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, target], { encoding: 'utf8' })), reference);
  const receiptPath = `${session.file}.missing-backup-receipt-${witnessId}`, receiptBytes = fs.readFileSync(receiptPath);
  const unknown = { kind: 'unknown', lastKnownVersion: 0, reason: 'corrupt' };
  try {
    const receipt = JSON.parse(receiptBytes.toString()); receipt.witness = '0'.repeat(64);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, target], { encoding: 'utf8' })), unknown);
  } finally { fs.writeFileSync(receiptPath, receiptBytes); }
  const originalJournal = fs.readFileSync(session.file), lines = originalJournal.toString('utf8').trimEnd().split('\n');
  try {
    const index = lines.findIndex(line => { const row = JSON.parse(line); return row.kind === 'directory_missing_backup' && row.id === witnessId; });
    assert.ok(index >= 0);
    const row = JSON.parse(lines[index]!); row.writeInput.content.sha256 = createHash('sha256').update('OTHER').digest('hex');
    lines[index] = JSON.stringify(row);
    const prefix = Buffer.from(lines.slice(0, index + 1).join('\n') + '\n'), receipt = JSON.parse(receiptBytes.toString());
    receipt.witness = createHash('sha256').update(JSON.stringify(row)).digest('hex');
    receipt.journal = { bytes: prefix.length, sha256: createHash('sha256').update(prefix).digest('hex') };
    fs.writeFileSync(session.file, lines.join('\n') + '\n'); fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, target], { encoding: 'utf8' })), unknown);
  } finally { fs.writeFileSync(session.file, originalJournal); fs.writeFileSync(receiptPath, receiptBytes); }
});

test('directory file history leaves an interrupted first missing witness unknown', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'new-value'), tools = createTools();
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const id = session.id, journal = session.file;
  await session.close();
  const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const [root,outside,target,id]=process.argv.slice(1),s=Session.open(root,{id}),tools=createTools();
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const stat=fs.statSync(s.file),write=fs.writeSync;fs.writeSync=function(fd,bytes,...args){const n=write.call(this,fd,bytes,...args),f=fs.fstatSync(fd);
      if(f.dev===stat.dev&&f.ino===stat.ino&&Buffer.isBuffer(bytes)&&bytes.includes(Buffer.from('"kind":"directory_missing_backup"')))process.kill(process.pid,'SIGKILL');return n};
    let turn=0;const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:turn++?[{type:'text',text:'done'}]:[{type:'tool_use',id:'missing-write',name:'write_file',input:{path:target,content:'NEW'}}],stop_reason:turn===1?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    await new Agent(s,provider,tools).run('track absent target');`;
  const killed = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, outside, target, id], { encoding: 'utf8', timeout: 15000 });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr);
  const before = fs.readFileSync(journal); fs.writeFileSync(target, 'AFTER_CRASH');
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});const h=s.directoryFileHistory;
    process.stdout.write(JSON.stringify(h.kind==='available'?h.snapshots[0]?.entries.find(e=>e.path.lexicalPath===process.argv[3])?.reference:h));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, target], { encoding: 'utf8' })),
    { kind: 'unknown', lastKnownVersion: 0, reason: 'corrupt' });
  assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER_CRASH');
  assert.ok(fs.readFileSync(journal).subarray(0, before.length).equals(before));
});

test('directory rewind selects a later first-tracked version for an earlier user snapshot', async () => {
  const root = workspace(), outside = workspace(), present = path.join(outside, 'present'), missing = path.join(outside, 'missing'), tools = createTools();
  const original = Buffer.from([0, 255, 65, 128]); fs.writeFileSync(present, original, { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let firstMessage = '', secondMessage = '', backupId = '', expected: DirectoryRewindEntry[] = [];
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const provider = new ScriptedProvider([done(), response([
      call('track-present', 'write_file', { path: present, content: 'NOT_WRITTEN', overwrite: false }),
      call('track-missing', 'write_file', { path: missing, content: 'NOT_CREATED' }),
    ], 'tool_use'), done()]);
    const agent = new Agent(session, provider, tools);
    await agent.run('earlier user turn'); await agent.run('later user turn');
    const users = session.events.filter(row => row.kind === 'message' && row.message.role === 'user' && !row.isMeta && row.messageId);
    assert.equal(users.length, 2);
    firstMessage = users[0]?.kind === 'message' ? users[0].messageId ?? '' : '';
    secondMessage = users[1]?.kind === 'message' ? users[1].messageId ?? '' : '';
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind !== 'available') throw new Error('directory history unavailable');
    assert.deepEqual(history.snapshots[0]?.entries, []);
    const first = session.selectDirectoryRewindSnapshot(firstMessage);
    const second = session.selectDirectoryRewindSnapshot(secondMessage);
    assert.equal(first.kind, 'available'); assert.equal(second.kind, 'available');
    if (first.kind !== 'available' || second.kind !== 'available') throw new Error('directory selection unavailable');
    assert.deepEqual(first.entries, second.entries);
    const existing = first.entries.find(entry => entry.path.lexicalPath === present)?.reference;
    const absent = first.entries.find(entry => entry.path.lexicalPath === missing)?.reference;
    assert.equal(existing?.kind, 'present'); assert.equal(absent?.kind, 'missing');
    if (existing?.kind !== 'present' || absent?.kind !== 'missing') throw new Error('missing first-tracked references');
    assert.equal(existing.version, 1); assert.equal(absent.version, 1);
    assert.deepEqual(session.readDirectoryHistoryBackup(existing.backupId)?.bytes, original);
    const parent = fs.statSync(outside, { bigint: true });
    assert.deepEqual(absent.parent, { dev: String(parent.dev), ino: String(parent.ino) });
    backupId = existing.backupId;
    assert.deepEqual(session.selectDirectoryRewindSnapshot('f7d6970a-6c2e-4be7-9da9-064caf45a123'), { kind: 'not_found' });
    assert.deepEqual(fs.readFileSync(present), original); assert.equal(fs.readFileSync(missing, 'utf8'), 'NOT_CREATED');
    expected = first.entries;
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify(s.selectDirectoryRewindSnapshot(process.argv[3])));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, firstMessage], { encoding: 'utf8' })),
    { kind: 'available', messageId: firstMessage, entries: expected });
  const receiptPath = `${session.file}.backup-receipt-${backupId}`, receiptBytes = fs.readFileSync(receiptPath);
  try {
    const receipt = JSON.parse(receiptBytes.toString()); receipt.witness = '0'.repeat(64);
    fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    for (const messageId of [firstMessage, secondMessage]) for (let i = 0; i < 2; i++) {
      const selected = JSON.parse(execFileSync(process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, messageId], { encoding: 'utf8' }));
      assert.equal(selected.kind, 'available');
      assert.deepEqual(selected.entries.find((entry: DirectoryRewindEntry) => entry.path.lexicalPath === present)?.reference,
        { kind: 'unknown', lastKnownVersion: 0, reason: 'corrupt' });
      assert.equal(selected.entries.find((entry: DirectoryRewindEntry) => entry.path.lexicalPath === missing)?.reference.kind, 'missing');
    }
  } finally { fs.writeFileSync(receiptPath, receiptBytes); }
});

test('an actual checkpoint retains external present and missing witnesses', async () => {
  const root = workspace(), outside = workspace(), present = path.join(outside, 'present'), missing = path.join(outside, 'missing'), late = path.join(outside, 'late'), tools = createTools();
  fs.writeFileSync(present, 'AT_CHECKPOINT', { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let backupId = '';
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const provider = new ScriptedProvider([response([call('track-present', 'write_file', { path: present, content: 'BLOCKED', overwrite: false }),
      call('track-missing', 'write_file', { path: missing, content: 'BLOCKED' })], 'tool_use'), done()]);
    await new Agent(session, provider, tools).run('track both external paths');
    // The external Write now creates the previously missing target; remove it so
    // the checkpoint still exercises a missing-path observation.
    fs.rmSync(missing, { force: true });
    const captured = await checkpointConversationWithDirectoryWitness(session, 'external-boundary', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    assert.ok('external_tracked_paths' in captured); assert.equal(captured.external_tracked_paths, 2);
    assert.throws(() => session.append({ kind: 'directory_checkpoint_witness', id: 'f7d6970a-6c2e-4be7-9da9-064caf45a123',
      owner: session.id, name: 'external-boundary', witness: '0'.repeat(64) }), /requires a live transaction/);
    fs.writeFileSync(present, 'AFTER_CHECKPOINT'); fs.writeFileSync(missing, 'CREATED_AFTER');
    fs.writeFileSync(late, 'TRACKED_LATER');
    await new Agent(session, new ScriptedProvider([response([call('track-late', 'write_file',
      { path: late, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track the later external path');
    const witness = inspectDirectoryCheckpointWitness(session, 'external-boundary'); assert.equal(witness.kind, 'available');
    if (witness.kind !== 'available') throw new Error('checkpoint witness unavailable');
    const old = witness.entries.find(entry => entry.path.lexicalPath === present)?.observation;
    const absent = witness.entries.find(entry => entry.path.lexicalPath === missing)?.observation;
    const later = witness.entries.find(entry => entry.path.lexicalPath === late)?.observation;
    assert.equal(old?.kind, 'present'); assert.equal(absent?.kind, 'missing'); assert.deepEqual(later, { kind: 'unavailable' });
    if (old?.kind !== 'present') throw new Error('present checkpoint witness unavailable');
    assert.equal(old.file.mode, 0o751); backupId = old.backupId;
    assert.equal(readDirectoryCheckpointBackup(session, 'external-boundary', present)?.toString(), 'AT_CHECKPOINT');
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
    const [root,id,outside,present,missing,late]=process.argv.slice(1),s=Session.open(root,{id});const w=inspectDirectoryCheckpointWitness(s,'external-boundary');
    process.stdout.write(JSON.stringify({kind:w.kind,present:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===present)?.observation.kind,
      missing:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===missing)?.observation.kind,
      late:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===late)?.observation.kind,
      bytes:readDirectoryCheckpointBackup(s,'external-boundary',present)?.toString()??null,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  assert.ok(backupId);
  const cold = () => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, outside, present, missing, late], { encoding: 'utf8' }));
  for (let i = 0; i < 2; i++) assert.deepEqual(cold(),
    { kind: 'available', present: 'present', missing: 'missing', late: 'unavailable', bytes: 'AT_CHECKPOINT', grant: false });
  const backup = `${session.file}.snapshot-unknown-${backupId}`, original = fs.readFileSync(backup);
  try {
    fs.writeFileSync(backup, 'CORRUPT');
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { kind: 'unknown', present: false, missing: false, late: false, bytes: null, grant: false });
  } finally { fs.writeFileSync(backup, original); }
  assert.equal(cold().bytes, 'AT_CHECKPOINT');
  const receipt = fs.readdirSync(path.dirname(session.file)).find(name => name.startsWith(`${path.basename(session.file)}.checkpoint-witness-receipt-`));
  assert.ok(receipt); const receiptFile = path.join(path.dirname(session.file), receipt), receiptBytes = fs.readFileSync(receiptFile);
  const receiptValue = JSON.parse(receiptBytes.toString('utf8')), intentFile = `${session.file}.checkpoint-witness-intent-${receiptValue.id}`;
  const intentBytes = fs.readFileSync(intentFile);
  try {
    const forged = Buffer.alloc(original.length, 88), altered = JSON.parse(receiptBytes.toString('utf8'));
    const entry = altered.entries.find((value: { path: { lexicalPath: string } }) => value.path.lexicalPath === present);
    assert.ok(entry); entry.observation.backup.sha256 = createHash('sha256').update(forged).digest('hex');
    fs.writeFileSync(backup, forged); fs.writeFileSync(receiptFile, JSON.stringify(altered));
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { kind: 'unknown', present: false, missing: false, late: false, bytes: null, grant: false });
  } finally { fs.writeFileSync(backup, original); fs.writeFileSync(receiptFile, receiptBytes); }
  try {
    const intent = JSON.parse(intentBytes.toString('utf8')); intent.paths.reverse();
    const changed = Buffer.from(JSON.stringify(intent)); fs.writeFileSync(intentFile, changed);
    fs.writeFileSync(receiptFile, JSON.stringify({ ...receiptValue, intent: createHash('sha256').update(changed).digest('hex') }));
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { kind: 'unknown', present: false, missing: false, late: false, bytes: null, grant: false });
  } finally { fs.writeFileSync(intentFile, intentBytes); fs.writeFileSync(receiptFile, receiptBytes); }
  assert.equal(cold().bytes, 'AT_CHECKPOINT');
  if (process.platform === 'darwin' || process.platform === 'linux') {
    const race = `import fs from 'node:fs';import {spawnSync} from 'node:child_process';import {Session} from './src/session.ts';
      import {inspectDirectoryCheckpointWitness} from './src/rewind.ts';const [root,id,receipt,stage]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:stage==='fixed'}),lstat=fs.lstatSync,open=fs.openSync;let swapped=false;
      fs.openSync=function(file,flags,...args){return open.call(this,file,stage==='baseline'&&String(file)===receipt?flags&~fs.constants.O_NONBLOCK:flags,...args)};
      try{fs.lstatSync=function(file,...args){const value=lstat.call(this,file,...args);if(!swapped&&String(file)===receipt){
        swapped=true;fs.renameSync(receipt,receipt+'.held');const made=spawnSync('mkfifo',[receipt],{timeout:5000});if(made.status!==0)throw Error('mkfifo failed')}
        return value};const result=inspectDirectoryCheckpointWitness(s,'external-boundary');process.stdout.write(JSON.stringify({swapped,kind:result.kind}));}
      finally{fs.lstatSync=lstat;fs.openSync=open;if(swapped){fs.unlinkSync(receipt);fs.renameSync(receipt+'.held',receipt)}await s.close()}`;
    try {
      const baseline = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', race, root, session.id, receiptFile, 'baseline'],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 3000 });
      assert.ok(baseline.error && 'code' in baseline.error); assert.equal(baseline.error.code, 'ETIMEDOUT');
      assert.ok(fs.existsSync(`${receiptFile}.held`));
      fs.unlinkSync(receiptFile); fs.renameSync(`${receiptFile}.held`, receiptFile);
      const child = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', race, root, session.id, receiptFile, 'fixed'],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout), { swapped: true, kind: 'unknown' });
    } finally {
      if (fs.existsSync(`${receiptFile}.held`)) { fs.rmSync(receiptFile, { force: true }); fs.renameSync(`${receiptFile}.held`, receiptFile); }
    }
  }
});

test('checkpoint witness authorization binds the original commitment and Session once', async () => {
  const root = workspace(), outside = workspace(), otherRoot = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const other = Session.open(otherRoot, { config: config(otherRoot, tools) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('track-auth', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external path');
    const commit = session.commitDirectoryCheckpointWitness.bind(session);
    let reached = false;
    session.commitDirectoryCheckpointWitness = (input, authorization) => {
      reached = true;
      input.witness = '0'.repeat(64);
      commit(input, authorization);
    };
    const changed = await checkpointConversationWithDirectoryWitness(session, 'changed-commitment', new AbortController().signal);
    assert.equal(reached, true); assert.ok('external_witness' in changed); assert.equal(changed.external_witness, 'unknown');
    assert.equal(session.events.some(event => event.kind === 'directory_checkpoint_witness' && event.name === 'changed-commitment'), false);

    reached = false;
    session.commitDirectoryCheckpointWitness = (input, authorization) => {
      reached = true;
      other.commitDirectoryCheckpointWitness(input, authorization);
    };
    const wrongOwner = await checkpointConversationWithDirectoryWitness(session, 'wrong-owner', new AbortController().signal);
    assert.equal(reached, true); assert.ok('external_witness' in wrongOwner); assert.equal(wrongOwner.external_witness, 'unknown');
    assert.equal(other.events.some(event => event.kind === 'directory_checkpoint_witness'), false);
    assert.equal(session.events.some(event => event.kind === 'directory_checkpoint_witness' && event.name === 'wrong-owner'), false);

    const captured: { consumed?: { input: Parameters<typeof commit>[0]; authorization: symbol | undefined } } = {};
    session.commitDirectoryCheckpointWitness = (input, authorization) => {
      commit(input, authorization);
      captured.consumed = { input: { ...input }, authorization };
    };
    const valid = await checkpointConversationWithDirectoryWitness(session, 'valid-once', new AbortController().signal);
    assert.ok('external_witness' in valid); assert.equal(valid.external_witness, 'available');
    const consumed = captured.consumed; assert.ok(consumed);
    assert.throws(() => commit(consumed.input, consumed.authorization), /authorization/i);
    assert.equal(session.events.filter(event => event.kind === 'directory_checkpoint_witness' && event.name === 'valid-once').length, 1);
  } finally { await other.close(); await session.close(); }
});

test('fork descendants retain verified historical checkpoint witnesses', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), present = path.join(outside, 'present'), missing = path.join(outside, 'missing'), late = path.join(outside, 'late'), tools = createTools();
  fs.writeFileSync(present, 'ORIGINAL'); fs.writeFileSync(late, 'LATER');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let fork: Session | undefined, grandchild: Session | undefined, backupId = '', ids: string[] = [];
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('track-present', 'write_file', { path: present, content: 'BLOCKED', overwrite: false }),
      call('track-missing', 'write_file', { path: missing, content: 'BLOCKED' })], 'tool_use'), done()]), tools).run('track external paths');
    fs.rmSync(missing, { force: true });
    const captured = await checkpointConversationWithDirectoryWitness(parent, 'history-before-late', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    const original = inspectDirectoryCheckpointWitness(parent, 'history-before-late'); assert.equal(original.kind, 'available');
    if (original.kind !== 'available') throw new Error('original witness unavailable');
    const observation = original.entries.find(entry => entry.path.lexicalPath === present)?.observation;
    assert.ok(observation?.kind === 'present'); backupId = observation.backupId;
    await new Agent(parent, new ScriptedProvider([response([call('track-late', 'write_file',
      { path: late, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track later path');
    const append = Session.prototype.append;
    const capturedAuthorization: { event?: Extract<import('../src/session.js').SessionEvent, { kind: 'directory_checkpoint_inheritance' }>; token?: symbol } = {};
    try {
      Session.prototype.append = function(event, authorization, token) {
        if (event.kind === 'directory_checkpoint_inheritance') {
          const reference = event.references[0]; assert.ok(reference); assert.ok(!('kind' in reference.origin));
          reference.origin.receiptDigest = '0'.repeat(64);
        }
        return append.call(this, event, authorization, token);
      };
      assert.throws(() => forkSession(parent), /inheritance.*authorization/i);
    } finally { Session.prototype.append = append; }
    try {
      Session.prototype.append = function(event, authorization, token) {
        if (event.kind === 'directory_checkpoint_inheritance') { capturedAuthorization.event = structuredClone(event); capturedAuthorization.token = token; }
        return append.call(this, event, authorization, token);
      };
      fork = forkSession(parent);
    } finally { Session.prototype.append = append; }
    const inheritedEvent = capturedAuthorization.event; assert.ok(inheritedEvent);
    assert.throws(() => fork?.append(inheritedEvent), /inheritance.*authorization/i);
    assert.throws(() => fork?.append(inheritedEvent, undefined, capturedAuthorization.token), /inheritance.*authorization/i);
    grandchild = forkSession(fork); ids = [fork.id, grandchild.id];
    await new Agent(parent, new ScriptedProvider([done()]), tools).run('continue original session');
    for (const successor of [fork, grandchild]) {
      const inherited = inspectDirectoryCheckpointWitness(successor, 'history-before-late'); assert.equal(inherited.kind, 'available');
      if (inherited.kind !== 'available') throw new Error('inherited witness unavailable');
      assert.equal(inherited.entries.find(entry => entry.path.lexicalPath === present)?.observation.kind, 'present');
      assert.equal(inherited.entries.find(entry => entry.path.lexicalPath === missing)?.observation.kind, 'missing');
      assert.deepEqual(inherited.entries.find(entry => entry.path.lexicalPath === late)?.observation, { kind: 'unavailable' });
      assert.equal(readDirectoryCheckpointBackup(successor, 'history-before-late', present)?.toString(), 'ORIGINAL');
    }
  } finally { await grandchild?.close(); await fork?.close(); await parent.close(); }
  fs.writeFileSync(present, 'CHANGED!'); fs.writeFileSync(missing, 'CREATED');
  const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
    const [root,id,outside,present,missing,late]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'history-before-late');
    process.stdout.write(JSON.stringify({kind:w.kind,present:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===present)?.observation.kind,
      missing:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===missing)?.observation.kind,
      late:w.kind==='available'&&w.entries.find(e=>e.path.lexicalPath===late)?.observation.kind,
      bytes:readDirectoryCheckpointBackup(s,'history-before-late',present)?.toString()??null,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  const cold = (id: string) => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, present, missing, late], { encoding: 'utf8' }));
  for (const id of ids) for (let i = 0; i < 2; i++) assert.deepEqual(cold(id),
    { kind: 'available', present: 'present', missing: 'missing', late: 'unavailable', bytes: 'ORIGINAL', grant: false });
  const receiptName = fs.readdirSync(path.dirname(parent.file)).find(name => name.startsWith(`${path.basename(parent.file)}.checkpoint-witness-receipt-`));
  assert.ok(receiptName && backupId); const receipt = path.join(path.dirname(parent.file), receiptName), receiptBytes = fs.readFileSync(receipt);
  const backup = `${parent.file}.snapshot-unknown-${backupId}`, backupBytes = fs.readFileSync(backup);
  try {
    const forged = Buffer.alloc(backupBytes.length, 88), changed = JSON.parse(receiptBytes.toString('utf8'));
    const entry = changed.entries.find((value: { path: { lexicalPath: string } }) => value.path.lexicalPath === present); assert.ok(entry);
    entry.observation.backup.sha256 = createHash('sha256').update(forged).digest('hex');
    fs.writeFileSync(backup, forged); fs.writeFileSync(receipt, JSON.stringify(changed));
    for (const id of ids) assert.deepEqual(cold(id), { kind: 'unknown', present: false, missing: false, late: false, bytes: null, grant: false });
  } finally { fs.writeFileSync(backup, backupBytes); fs.writeFileSync(receipt, receiptBytes); }
  fs.renameSync(receipt, `${receipt}.held`);
  let missingAtFork = '';
  try {
    for (const id of ids) assert.deepEqual(cold(id), { kind: 'unknown', present: false, missing: false, late: false, bytes: null, grant: false });
    const reopened = Session.open(root, { id: parent.id }); let descendant: Session | undefined;
    try {
      descendant = forkSession(reopened); missingAtFork = descendant.id;
      assert.deepEqual(inspectDirectoryCheckpointWitness(descendant, 'history-before-late'), { kind: 'unknown' });
    } finally { await descendant?.close(); await reopened.close(); }
  }
  finally { fs.renameSync(`${receipt}.held`, receipt); }
  for (const id of ids) assert.equal(cold(id).bytes, 'ORIGINAL');
  assert.ok(missingAtFork); assert.deepEqual(cold(missingAtFork), { kind: 'unknown', present: false, missing: false, late: false, bytes: null, grant: false });
});

test('bounded conversation fork inherits checkpoints for its selected turns', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'FIRST');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let fork: Session | undefined, initialFork: Session | undefined, fullFork: Session | undefined, id = '';
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const initial = await checkpointConversationWithDirectoryWitness(parent, 'bounded-initial', new AbortController().signal);
    assert.ok('external_witness' in initial); assert.equal(initial.external_witness, 'available');
    await new Agent(parent, new ScriptedProvider([response([call('bounded-track', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('first turn');
    const boundary = parent.events.findIndex(event => event.kind === 'turn_end'); assert.ok(boundary > 0);
    const earlier = await checkpointConversationWithDirectoryWitness(parent, 'bounded-first', new AbortController().signal);
    assert.ok('external_witness' in earlier); assert.equal(earlier.external_witness, 'available');
    fs.writeFileSync(target, 'SECOND');
    await new Agent(parent, new ScriptedProvider([done()]), tools).run('second turn');
    const later = await checkpointConversationWithDirectoryWitness(parent, 'bounded-second', new AbortController().signal);
    assert.ok('external_witness' in later); assert.equal(later.external_witness, 'available');
    fork = forkSession(parent, boundary); id = fork.id;
    assert.equal(fork.events.filter(event => event.kind === 'checkpoint' && event.name === 'bounded-first').length, 1);
    assert.equal(fork.events.some(event => event.kind === 'checkpoint' && event.name === 'bounded-second'), false);
    assert.equal(inspectDirectoryCheckpointWitness(fork, 'bounded-first').kind, 'available');
    assert.equal(readDirectoryCheckpointBackup(fork, 'bounded-first', target)?.toString(), 'FIRST');
    initialFork = forkSession(parent, 0);
    assert.deepEqual(initialFork.events.filter(event => event.kind === 'checkpoint').map(event => event.name), ['bounded-initial']);
    assert.equal(inspectDirectoryCheckpointWitness(initialFork, 'bounded-initial').kind, 'available');
    const lastBoundary = parent.events.findLastIndex(event => event.kind === 'turn_end');
    fullFork = forkSession(parent, lastBoundary);
    assert.deepEqual(fullFork.events.filter(event => event.kind === 'checkpoint').map(event => event.name),
      ['bounded-initial', 'bounded-first', 'bounded-second']);
    assert.equal(readDirectoryCheckpointBackup(fullFork, 'bounded-first', target)?.toString(), 'FIRST');
    assert.equal(readDirectoryCheckpointBackup(fullFork, 'bounded-second', target)?.toString(), 'SECOND');
  } finally { await fork?.close(); await initialFork?.close(); await fullFork?.close(); await parent.close(); }
  const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
    const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'bounded-first');
    process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,'bounded-first',target)?.toString()??null,
      later:s.events.some(e=>e.kind==='checkpoint'&&e.name==='bounded-second'),grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, target], { encoding: 'utf8' })),
  { kind: 'available', bytes: 'FIRST', later: false, grant: false });
});

for (const gateOwner of ['source', 'target'] as const) test(`fork rejects a replaced ${gateOwner} Session gate before inheriting checkpoint witnesses`, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const appendBranch = Session.prototype.appendCheckpointBranch; let gate = '', returned: Session | undefined;
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('track-gate', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track before fork');
    const captured = await checkpointConversationWithDirectoryWitness(parent, 'gate-base', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    Session.prototype.appendCheckpointBranch = function(source, input) {
      appendBranch.call(this, source, input); gate = `${gateOwner === 'source' ? source.file : this.file}.lock.gate`;
      fs.renameSync(gate, `${gate}.held`); fs.writeFileSync(gate, 'replacement', { mode: 0o600 });
    };
    assert.throws(() => { returned = forkSession(parent); }, /Session lock changed/i);
  } finally {
    Session.prototype.appendCheckpointBranch = appendBranch;
    await returned?.close();
    if (gate && fs.existsSync(`${gate}.held`)) { fs.unlinkSync(gate); fs.renameSync(`${gate}.held`, gate); }
    await parent.close();
  }
});

test('a fork checkpoints inherited and newly tracked external files under its own grants', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), inherited = path.join(outside, 'inherited'), added = path.join(outside, 'added'), tools = createTools();
  fs.writeFileSync(inherited, 'BEFORE_FORK'); fs.writeFileSync(added, 'AFTER_FORK');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let fork: Session | undefined, forkId = '';
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('track-parent', 'write_file',
      { path: inherited, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track inherited file');
    const original = await checkpointConversationWithDirectoryWitness(parent, 'parent-witness', new AbortController().signal);
    assert.ok('external_witness' in original); assert.equal(original.external_witness, 'available');
    fork = forkSession(parent); forkId = fork.id;
    assert.equal(inspectDirectoryCheckpointWitness(fork, 'parent-witness').kind, 'available');
    assert.equal(readDirectoryCheckpointBackup(fork, 'parent-witness', inherited)?.toString(), 'BEFORE_FORK');
    await new Agent(fork, new ScriptedProvider([response([call('track-child', 'write_file',
      { path: added, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track new file');
    fork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    const revoked = await checkpointConversationWithDirectoryWitness(fork, 'fork-revoked', new AbortController().signal);
    assert.ok('external_witness' in revoked); assert.equal(revoked.external_witness, 'unknown');
    fork.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const captured = await checkpointConversationWithDirectoryWitness(fork, 'fork-witness', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    assert.ok('external_tracked_paths' in captured); assert.equal(captured.external_tracked_paths, 2);
    assert.equal(readDirectoryCheckpointBackup(fork, 'fork-witness', inherited)?.toString(), 'BEFORE_FORK');
    assert.equal(readDirectoryCheckpointBackup(fork, 'fork-witness', added)?.toString(), 'AFTER_FORK');
  } finally { await fork?.close(); await parent.close(); }
  fs.writeFileSync(inherited, 'CHANGED'); fs.writeFileSync(added, 'CHANGED');
  const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
    const [root,id,outside,inherited,added]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'fork-witness');
    process.stdout.write(JSON.stringify({kind:w.kind,count:w.kind==='available'?w.entries.length:null,
      inherited:readDirectoryCheckpointBackup(s,'fork-witness',inherited)?.toString()??null,
      added:readDirectoryCheckpointBackup(s,'fork-witness',added)?.toString()??null,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, forkId, outside, inherited, added], { encoding: 'utf8' })),
  { kind: 'available', count: 2, inherited: 'BEFORE_FORK', added: 'AFTER_FORK', grant: false });
});

test('rewind and relocation retain paths for new successor checkpoints', { timeout: 30000 }, async () => {
  for (const transition of ['rewind', 'rewind-recovered', 'relocation'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    fs.writeFileSync(target, 'TRACKED');
    const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    let next: Session | undefined, nextRoot = root, id = '';
    try {
      parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(parent, new ScriptedProvider([response([call('track-parent', 'write_file',
        { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
      const original = await checkpointConversationWithDirectoryWitness(parent, 'transition-base', new AbortController().signal);
      assert.ok('external_witness' in original); assert.equal(original.external_witness, 'available');
      if (transition === 'rewind' || transition === 'rewind-recovered') {
        const preview = previewRewind(parent, 1, new AbortController().signal);
        if (transition === 'rewind') next = applyRewind(parent, preview, preview.token, new AbortController().signal);
        else {
          const rename = fs.renameSync, transaction = path.join(root, '.agent/checkpoints/transaction.json');
          try {
            fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
              if (String(to) === transaction && JSON.parse(fs.readFileSync(from, 'utf8')).state === 'committed')
                throw new Error('injected committed marker failure');
              return rename(from, to);
            }) as typeof fs.renameSync;
            assert.throws(() => applyRewind(parent, preview, preview.token, new AbortController().signal), /history committed/);
          } finally { fs.renameSync = rename; }
          const saved = JSON.parse(fs.readFileSync(transaction, 'utf8'));
          assert.equal(saved.branch.checkpointPaths.kind, 'available');
          assert.equal(saved.branch.checkpointPaths.paths[0].lexicalPath, target);
          assert.deepEqual(recoverCheckpoint({ workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 }),
            { recovery: 'committed' });
          next = Session.open(root, { id: saved.branch.id });
          next.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
        }
      } else {
        nextRoot = workspace(); next = relocateSession(parent, nextRoot, () => createTools());
        next.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      }
      id = next.id;
      assert.equal(inspectDirectoryCheckpointWitness(next, 'transition-base').kind,
        transition === 'rewind' ? 'available' : 'unknown');
      if (transition === 'rewind') assert.equal(readDirectoryCheckpointBackup(next, 'transition-base', target)?.toString(), 'TRACKED');
      const captured = await checkpointConversationWithDirectoryWitness(next, `successor-${transition}`, new AbortController().signal);
      assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
      assert.equal(readDirectoryCheckpointBackup(next, `successor-${transition}`, target)?.toString(), 'TRACKED');
    } finally { await next?.close(); await parent.close(); }
    fs.writeFileSync(target, 'CHANGED');
    const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
      const [root,id,outside,target,name]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,name);
      process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,name,target)?.toString()??null,
        grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, nextRoot, id, outside, target, `successor-${transition}`], { encoding: 'utf8' })),
    { kind: 'available', bytes: 'TRACKED', grant: false });
  }
});

test('rewind reports committed history when inherited witness journal sync fails', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools(), workspaceFile = path.join(root, 'workspace.txt');
  fs.writeFileSync(target, 'EXTERNAL'); fs.writeFileSync(workspaceFile, 'BEFORE');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const sync = fs.fsyncSync; let injected = false, childId = '';
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('track-history', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
    const captured = await checkpointConversationWithDirectoryWitness(parent, 'inherit-fault-base', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    fs.writeFileSync(workspaceFile, 'AFTER');
    const preview = previewRewind(parent, 1, new AbortController().signal), directory = path.join(root, '.agent');
    try {
      fs.fsyncSync = (fd: number) => {
        const stat = fs.fstatSync(fd);
        for (const name of fs.readdirSync(directory).filter(value => value.endsWith('.jsonl') && value !== `${parent.id}.jsonl`)) {
          const file = path.join(directory, name), named = fs.lstatSync(file);
          if (stat.dev === named.dev && stat.ino === named.ino && fs.readFileSync(file, 'utf8').includes('"kind":"directory_checkpoint_inheritance"')) {
            injected = true; childId = name.slice(0, -6); throw new Error('injected inherited witness sync failure');
          }
        }
        return sync(fd);
      };
      assert.throws(() => applyRewind(parent, preview, preview.token, new AbortController().signal), /history committed.*inherited witness.*sync failure/i);
    } finally { fs.fsyncSync = sync; }
    assert.equal(injected, true); assert.ok(childId);
    assert.equal(fs.readFileSync(workspaceFile, 'utf8'), 'BEFORE');
    for (let i = 0; i < 2; i++) {
      const cold = Session.open(root, { id: childId });
      try {
        assert.equal(inspectDirectoryCheckpointWitness(cold, 'inherit-fault-base').kind, 'available');
        assert.equal(readDirectoryCheckpointBackup(cold, 'inherit-fault-base', target)?.toString(), 'EXTERNAL');
        assert.equal(!!cold.workingDirectories(false).readHandle?.(outside), false);
      } finally { await cold.close(); }
    }
  } finally { fs.fsyncSync = sync; await parent.close(); }
});

test('reconciles a torn direct checkpoint inheritance without deleting evidence', { timeout: 120000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), local = path.join(root, 'value'), tools = createTools();
  fs.writeFileSync(target, 'TORN_ORIGINAL'); fs.writeFileSync(local, 'BEFORE');
  const signal = new AbortController().signal, directory = path.join(root, '.agent');
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const deepRecoveredIds: string[] = [];
  const write = fs.writeSync; let child: Session | undefined, childId = '', recoveredForkId = '', recoveredGrandchildId = '', indirectId = '',
    intermediateId = '', indirectDescendantId = '', doubleTornId = '', doubleTornCleanId = '', doubleTornForkId = '',
    doubleTornGrandchildId = '', tripleTornId = '', injected = false, evidence = '', originalEvidence = Buffer.alloc(0);
  const interruptRecoveredFork = (source: Session): string => {
    let id = '';
    try {
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); id = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected recovered-origin inheritance tear');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => forkSession(source), /injected recovered-origin inheritance tear/);
    } finally { fs.writeSync = write; }
    assert.ok(id); return id;
  };
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('track-torn-reconcile', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
    const captured = await checkpointConversationWithDirectoryWitness(parent, 'torn-reconcile', signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    const second = await checkpointConversationWithDirectoryWitness(parent, 'torn-reconcile-second', signal);
    assert.ok('external_witness' in second); assert.equal(second.external_witness, 'available');
    fs.writeFileSync(local, 'AFTER'); const preview = previewRewind(parent, 1, signal);
    fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
      const [fd, bytes, offset, length] = args;
      if (!injected && Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
        const opened = fs.fstatSync(fd);
        const file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') && name !== `${parent.id}.jsonl` &&
          (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
        assert.ok(file); childId = file.slice(0, -6); injected = true; fs.writeSync = write;
        Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
        throw new Error('injected torn inheritance');
      }
      return Reflect.apply(targetFn, thisArg, args);
    } });
    assert.throws(() => applyRewind(parent, preview, preview.token, signal), /history committed.*inherited witness/i);
    fs.writeSync = write; assert.equal(injected, true); assert.ok(childId); assert.equal(fs.readFileSync(local, 'utf8'), 'BEFORE');
    child = Session.open(root, { id: childId });
    const name = fs.readdirSync(directory).find(value => value.startsWith(`${childId}.jsonl.torn-`)); assert.ok(name);
    evidence = path.join(directory, name); originalEvidence = fs.readFileSync(evidence);
    assert.equal(inspectDirectoryCheckpointWitness(child, 'torn-reconcile').kind, 'unknown');
    const extra = `${child.file}.torn-00000000-0000-4000-8000-000000000001`;
    fs.writeFileSync(extra, 'unrelated torn evidence', { mode: 0o600 });
    try { assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'unknown'); }
    finally { fs.unlinkSync(extra); }
    fs.writeFileSync(evidence, Buffer.concat([fs.readFileSync(child.file), Buffer.from('{')]));
    try { assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'unknown'); }
    finally { fs.writeFileSync(evidence, originalEvidence); }
    const changedEvidence = Buffer.from(originalEvidence); changedEvidence[changedEvidence.length - 1] ^= 1;
    fs.writeFileSync(evidence, changedEvidence);
    try { assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'unknown'); }
    finally { fs.writeFileSync(evidence, originalEvidence); }
    const sourceBefore = fs.readFileSync(parent.file);
    fs.writeFileSync(parent.file, sourceBefore.subarray(0, sourceBefore.length - 8));
    try { assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'unknown'); }
    finally { fs.writeFileSync(parent.file, sourceBefore); }
    const receiptName = fs.readdirSync(directory).find(value => value.startsWith(`${path.basename(parent.file)}.checkpoint-witness-receipt-`));
    assert.ok(receiptName); const receipt = path.join(directory, receiptName);
    fs.renameSync(receipt, `${receipt}.fixture-held`);
    try { assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'unknown'); }
    finally { fs.renameSync(`${receipt}.fixture-held`, receipt); }
    const append = Session.prototype.append;
    let savedEvent: Extract<import('../src/session.js').SessionEvent, { kind: 'directory_checkpoint_torn_recovery' }> | undefined, savedToken: symbol | undefined;
    try {
      Session.prototype.append = function(event, authorization, token) {
        if (event.kind === 'directory_checkpoint_torn_recovery') {
          const origin = event.candidate.references[0]!.origin; assert.ok(!('kind' in origin)); origin.receiptDigest = '0'.repeat(64);
        }
        return append.call(this, event, authorization, token);
      };
      assert.throws(() => child?.reconcileTornCheckpointInheritance(parent), /authorization/i);
    } finally { Session.prototype.append = append; }
    for (const owner of [parent, child]) {
      const gate = `${owner.file}.lock.gate`, held = `${gate}.fixture-held`; let exchanged = false;
      try {
        Session.prototype.append = function(event, authorization, token) {
          if (event.kind === 'directory_checkpoint_torn_recovery') {
            fs.renameSync(gate, held); fs.writeFileSync(gate, '', { mode: 0o600 }); exchanged = true;
          }
          return append.call(this, event, authorization, token);
        };
        assert.throws(() => child?.reconcileTornCheckpointInheritance(parent), /authorization/i); assert.equal(exchanged, true);
      } finally {
        Session.prototype.append = append;
        if (exchanged) { fs.unlinkSync(gate); fs.renameSync(held, gate); }
      }
    }
    try {
      Session.prototype.append = function(event, authorization, token) {
        if (event.kind === 'directory_checkpoint_torn_recovery') { savedEvent = structuredClone(event); savedToken = token; }
        return append.call(this, event, authorization, token);
      };
      assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'reconciled');
    } finally { Session.prototype.append = append; }
    assert.ok(savedEvent); assert.throws(() => child?.append(savedEvent!), /authorization/i);
    assert.throws(() => child?.append(savedEvent!, undefined, savedToken), /authorization/i);
    assert.equal(child.reconcileTornCheckpointInheritance(parent).kind, 'reconciled');
    assert.equal(readDirectoryCheckpointBackup(child, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
    assert.equal(readDirectoryCheckpointBackup(child, 'torn-reconcile-second', target)?.toString(), 'TORN_ORIGINAL');
    const secondReceiptName = fs.readdirSync(directory).find(value => value.startsWith(`${path.basename(parent.file)}.checkpoint-witness-receipt-`) &&
      JSON.parse(fs.readFileSync(path.join(directory, value), 'utf8')).checkpoint.name === 'torn-reconcile-second');
    assert.ok(secondReceiptName); const secondReceipt = path.join(directory, secondReceiptName), secondReceiptBytes = fs.readFileSync(secondReceipt);
    try { fs.writeFileSync(secondReceipt, '{}'); assert.equal(inspectDirectoryCheckpointWitness(child, 'torn-reconcile').kind, 'unknown'); }
    finally { fs.writeFileSync(secondReceipt, secondReceiptBytes); }
    assert.deepEqual(fs.readFileSync(evidence), originalEvidence);
    const sync = fs.fsyncSync, evidenceStat = fs.lstatSync(evidence); let failedSync = false;
    try {
      fs.fsyncSync = fd => {
        const opened = fs.fstatSync(fd);
        if (opened.dev === evidenceStat.dev && opened.ino === evidenceStat.ino) { failedSync = true; throw new Error('injected torn evidence sync failure'); }
        return sync(fd);
      };
      assert.equal(inspectDirectoryCheckpointWitness(child, 'torn-reconcile').kind, 'unknown'); assert.equal(failedSync, true);
    } finally { fs.fsyncSync = sync; }
    assert.equal(inspectDirectoryCheckpointWitness(child, 'torn-reconcile').kind, 'available');
    await new Agent(parent, new ScriptedProvider([done()]), tools).run('advance source after recovery');
    assert.equal(readDirectoryCheckpointBackup(child, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
    const recoveredFork = forkSession(child);
    try {
      recoveredForkId = recoveredFork.id;
      assert.equal(readDirectoryCheckpointBackup(recoveredFork, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      const grandchild = forkSession(recoveredFork);
      try {
        recoveredGrandchildId = grandchild.id;
        assert.equal(readDirectoryCheckpointBackup(grandchild, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      } finally { await grandchild.close(); }
    }
    finally { await recoveredFork.close(); }
    const recoveredSource = child;
    doubleTornId = interruptRecoveredFork(recoveredSource);
    const tornDescendant = Session.open(root, { id: doubleTornId });
    try {
      fs.writeFileSync(evidence, 'changed before second recovery');
      try {
        const before = tornDescendant.events.length;
        assert.equal(tornDescendant.reconcileTornCheckpointInheritance(child).kind, 'unknown');
        assert.equal(tornDescendant.events.length, before);
      } finally { fs.writeFileSync(evidence, originalEvidence); }
      for (const owner of [child, tornDescendant]) {
        const gate = `${owner.file}.lock.gate`, held = `${gate}.fixture-held`; let exchanged = false;
        try {
          Session.prototype.append = function(event, authorization, token) {
            if (event.kind === 'directory_checkpoint_torn_recovery') {
              fs.renameSync(gate, held); fs.writeFileSync(gate, '', { mode: 0o600 }); exchanged = true;
            }
            return append.call(this, event, authorization, token);
          };
          const before = tornDescendant.events.length;
          assert.throws(() => tornDescendant.reconcileTornCheckpointInheritance(recoveredSource), /authorization/i);
          assert.equal(exchanged, true); assert.equal(tornDescendant.events.length, before);
        } finally {
          Session.prototype.append = append;
          if (exchanged) { fs.unlinkSync(gate); fs.renameSync(held, gate); }
        }
      }
      try {
        Session.prototype.append = function(event, authorization, token) {
          if (event.kind === 'directory_checkpoint_torn_recovery') fs.writeFileSync(evidence, 'changed before authorized append');
          return append.call(this, event, authorization, token);
        };
        const before = tornDescendant.events.length;
        assert.throws(() => tornDescendant.reconcileTornCheckpointInheritance(recoveredSource), /authorization/i);
        assert.equal(tornDescendant.events.length, before);
      } finally { Session.prototype.append = append; fs.writeFileSync(evidence, originalEvidence); }
      assert.equal(tornDescendant.reconcileTornCheckpointInheritance(child).kind, 'reconciled');
      assert.equal(readDirectoryCheckpointBackup(tornDescendant, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      assert.deepEqual(fs.readFileSync(evidence), originalEvidence);
      const descendant = forkSession(tornDescendant);
      try {
        doubleTornForkId = descendant.id;
        const grandchild = forkSession(descendant);
        try {
          doubleTornGrandchildId = grandchild.id;
          assert.equal(readDirectoryCheckpointBackup(grandchild, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
        } finally { await grandchild.close(); }
      } finally { await descendant.close(); }
      tripleTornId = interruptRecoveredFork(tornDescendant);
      const third = Session.open(root, { id: tripleTornId });
      try {
        const before = third.events.length;
        assert.equal(third.reconcileTornCheckpointInheritance(tornDescendant).kind, 'reconciled');
        assert.equal(third.events.length, before + 1);
        assert.equal(inspectDirectoryCheckpointWitness(third, 'torn-reconcile').kind, 'available');
        assert.equal(readDirectoryCheckpointBackup(third, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
        const opened: Session[] = [];
        let previous = third, exhausted = false;
        try {
          for (let generation = 4; generation <= 10; generation++) {
            const next = Session.open(root, { id: interruptRecoveredFork(previous) }); opened.push(next);
            const count = next.events.length, result = next.reconcileTornCheckpointInheritance(previous);
            if (result.kind === 'unknown') {
              assert.equal(next.events.length, count, 'budget exhaustion must not publish a partial proof');
              assert.equal(inspectDirectoryCheckpointWitness(next, 'torn-reconcile').kind, 'unknown');
              exhausted = true; break;
            }
            assert.equal(result.kind, 'reconciled');
            assert.equal(readDirectoryCheckpointBackup(next, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
            deepRecoveredIds.push(next.id); previous = next;
          }
          assert.ok(deepRecoveredIds.length >= 1, 'fourth recovery must succeed within the shared budget');
          assert.equal(exhausted, true, 'branch revalidation must consume a shared finite budget');
        } finally { for (const next of opened.reverse()) await next.close(); }
      } finally { await third.close(); }
      tornDescendant.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const continued = new ScriptedProvider([done()]);
      await new Agent(tornDescendant, continued, tools).run('continue after second recovery');
      assert.equal(continued.requests.length, 1);
    } finally { await tornDescendant.close(); }
    const probe = Session.open(root, { id: interruptRecoveredFork(child) });
    try {
      let candidate: Extract<import('../src/session.js').SessionEvent, { kind: 'directory_checkpoint_torn_recovery' }> | undefined;
      try {
        Session.prototype.append = function(event, authorization, token) {
          if (event.kind === 'directory_checkpoint_torn_recovery') { candidate = structuredClone(event); throw new Error('captured recovery candidate'); }
          return append.call(this, event, authorization, token);
        };
        assert.throws(() => probe.reconcileTornCheckpointInheritance(recoveredSource), /captured recovery candidate/);
      } finally { Session.prototype.append = append; }
      assert.ok(candidate);
      const first = candidate.candidate.references[0]; assert.ok(first && 'kind' in first.origin);
      const tornName = fs.readdirSync(directory).find(name => name.startsWith(`${probe.id}.jsonl.torn-`)); assert.ok(tornName);
      const probeEvidence = path.join(directory, tornName), full = Buffer.from(JSON.stringify(candidate.candidate) + '\n'), marker = Buffer.from('"references":[');
      const markerEnd = full.indexOf(marker) + marker.length; assert.ok(markerEnd >= marker.length);
      const evidencePrefix = Buffer.concat([probe.checkpointJournalBytes(), full.subarray(0, markerEnd)]);
      fs.writeFileSync(probeEvidence, evidencePrefix); candidate.evidence.sha256 = createHash('sha256').update(evidencePrefix).digest('hex');
      candidate.candidate.references = Array.from({ length: 64 }, () => structuredClone(first));
      assert.equal(verifyDirectoryCheckpointTornCandidate(probe, candidate), true);
      candidate.candidate.references.push(structuredClone(first));
      assert.equal(verifyDirectoryCheckpointTornCandidate(probe, candidate), false);
      candidate.candidate.references = [structuredClone(first)];
      const cycle = candidate.candidate.references[0]!.origin; assert.ok('kind' in cycle);
      cycle.owner = probe.id; cycle.journal = probe.file;
      assert.equal(verifyDirectoryCheckpointTornCandidate(probe, candidate), false);
      candidate.candidate.references = [structuredClone(first)];
      const postRecovery = candidate.candidate.references[0]!.origin; assert.ok('kind' in postRecovery);
      postRecovery.kind = 'post-torn-checkpoint';
      assert.equal(verifyDirectoryCheckpointTornCandidate(probe, candidate), false);
      assert.equal(probe.events.some(event => event.kind === 'directory_checkpoint_torn_recovery'), false);
    } finally { await probe.close(); }
    const cleanSource = Session.open(root, { id: recoveredForkId });
    try {
      doubleTornCleanId = interruptRecoveredFork(cleanSource);
      const targetSession = Session.open(root, { id: doubleTornCleanId });
      try {
        assert.equal(targetSession.reconcileTornCheckpointInheritance(cleanSource).kind, 'reconciled');
        assert.equal(readDirectoryCheckpointBackup(targetSession, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      } finally { await targetSession.close(); }
    } finally { await cleanSource.close(); }
    const appendDescendant = Session.prototype.append; let changedLineage = false;
    try {
      Session.prototype.append = function(event, authorization, token) {
        const origin = event.kind === 'directory_checkpoint_inheritance' ? event.references[0]?.origin : undefined;
        if (origin && 'kind' in origin && origin.proof) {
          origin.proof.journal.sha256 = '0'.repeat(64); changedLineage = true;
        }
        return appendDescendant.call(this, event, authorization, token);
      };
      assert.throws(() => forkSession(child!), /authorization/i); assert.equal(changedLineage, true);
    } finally { Session.prototype.append = appendDescendant; }
    child.append({ kind: 'title', title: 'Recovered source later appended' });
    await child.close(); child = undefined;
    const intermediate = forkSession(parent); intermediateId = intermediate.id; let indirect: Session | undefined;
    try {
      const inherited = intermediate.events.find(event => event.kind === 'directory_checkpoint_inheritance');
      assert.ok(inherited && inherited.kind === 'directory_checkpoint_inheritance');
      assert.equal(inherited.references[0]?.origin.owner, parent.id);
      fs.writeFileSync(local, 'AGAIN'); const indirectPreview = previewRewind(intermediate, 1, signal);
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); indirectId = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected indirect torn inheritance');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => applyRewind(intermediate, indirectPreview, indirectPreview.token, signal), /history committed.*inherited witness/i);
      fs.writeSync = write; assert.ok(indirectId); indirect = Session.open(root, { id: indirectId });
      const heldOrigin = path.join(directory, 'fixture-held-origin-journal'), beforeRecovery = indirect.events.length;
      fs.renameSync(parent.file, heldOrigin);
      try {
        assert.equal(indirect.reconcileTornCheckpointInheritance(intermediate).kind, 'unknown');
        assert.equal(indirect.events.length, beforeRecovery);
      } finally { fs.renameSync(heldOrigin, parent.file); }
      let originSwapped = false;
      try {
        Session.prototype.append = function(event, authorization, token) {
          if (event.kind === 'directory_checkpoint_torn_recovery') { fs.renameSync(parent.file, heldOrigin); originSwapped = true; }
          return append.call(this, event, authorization, token);
        };
        assert.throws(() => indirect?.reconcileTornCheckpointInheritance(intermediate), /authorization/i);
        assert.equal(originSwapped, true); assert.equal(indirect.events.length, beforeRecovery);
      } finally { Session.prototype.append = append; if (originSwapped) fs.renameSync(heldOrigin, parent.file); }
      assert.equal(indirect.reconcileTornCheckpointInheritance(intermediate).kind, 'reconciled');
      intermediate.append({ kind: 'title', title: 'Indirect source later appended' });
      assert.equal(readDirectoryCheckpointBackup(indirect, 'torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      assert.equal(indirect.directoryFileHistory.kind, 'available');
      indirect.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const indirectProvider = new ScriptedProvider([done()]);
      await new Agent(indirect, indirectProvider, tools).run('continue after indirect recovery'); assert.equal(indirectProvider.requests.length, 1);
      const later = await checkpointConversationWithDirectoryWitness(indirect, 'indirect-after-torn', signal);
      assert.ok('external_witness' in later); assert.equal(later.external_witness, 'available');
      const descendant = forkSession(indirect);
      try {
        indirectDescendantId = descendant.id;
        for (const name of ['torn-reconcile', 'indirect-after-torn'])
          assert.equal(readDirectoryCheckpointBackup(descendant, name, target)?.toString(), 'TORN_ORIGINAL');
      } finally { await descendant.close(); }
    } finally { fs.writeSync = write; await indirect?.close(); await intermediate.close(); }
  } finally { fs.writeSync = write; await child?.close(); await parent.close(); }
  const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
    const [root,id,outside,target,name]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,name);
    process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,name,target)?.toString()??null,
      grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
  const cold = (id = childId, name = 'torn-reconcile') => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, target, name], { encoding: 'utf8' }));
  for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  assert.ok(recoveredForkId); assert.ok(recoveredGrandchildId);
  for (const id of [recoveredForkId, recoveredGrandchildId])
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(id), { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  assert.ok(indirectId); assert.ok(intermediateId); assert.ok(indirectDescendantId);
  for (const id of [doubleTornId, doubleTornCleanId, doubleTornForkId, doubleTornGrandchildId]) {
    assert.ok(id);
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(id), { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  }
  assert.ok(tripleTornId);
  for (const id of [tripleTornId, ...deepRecoveredIds]) for (let i = 0; i < 2; i++)
    assert.deepEqual(cold(id), { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  for (const id of [indirectId, indirectDescendantId]) for (const name of ['torn-reconcile', 'indirect-after-torn'])
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(id, name), { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  const intermediateFile = path.join(root, '.agent', `${intermediateId}.jsonl`), intermediateBytes = fs.readFileSync(intermediateFile);
  try {
    fs.writeFileSync(intermediateFile, intermediateBytes.subarray(0, intermediateBytes.length - 8));
    for (const id of [indirectId, indirectDescendantId]) for (const name of ['torn-reconcile', 'indirect-after-torn']) assert.equal(cold(id, name).kind, 'unknown');
  }
  finally { fs.writeFileSync(intermediateFile, intermediateBytes); }
  const indirectFile = path.join(root, '.agent', `${indirectId}.jsonl`), indirectBytes = fs.readFileSync(indirectFile);
  try {
    const sourceRows = intermediateBytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const sourceBranch = sourceRows.find(row => row.kind === 'branch'); assert.ok(sourceBranch);
    sourceBranch.source = '00000000-0000-4000-8000-000000000001';
    const altered = Buffer.from(sourceRows.map(row => JSON.stringify(row)).join('\n') + '\n'); fs.writeFileSync(intermediateFile, altered);
    const targetRows = indirectBytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const recovery = targetRows.find(row => row.kind === 'directory_checkpoint_torn_recovery'); assert.ok(recovery);
    recovery.sourceJournal.sha256 = createHash('sha256').update(altered.subarray(0, recovery.sourceJournal.bytes)).digest('hex');
    fs.writeFileSync(indirectFile, targetRows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.equal(cold(indirectId).kind, 'unknown');
  } finally { fs.writeFileSync(intermediateFile, intermediateBytes); fs.writeFileSync(indirectFile, indirectBytes); }
  const sourceTorn = `${intermediateFile}.torn-00000000-0000-4000-8000-000000000001`;
  fs.writeFileSync(sourceTorn, 'unrelated torn source', { mode: 0o600 });
  try { assert.equal(cold(indirectId).kind, 'unknown'); }
  finally { fs.unlinkSync(sourceTorn); }
  const targetJournal = path.join(root, '.agent', `${childId}.jsonl`), targetBytes = fs.readFileSync(targetJournal);
  const descendants = [recoveredForkId, recoveredGrandchildId].map(id => {
    const file = path.join(root, '.agent', `${id}.jsonl`); return { file, bytes: fs.readFileSync(file) };
  });
  try {
    const first = descendants[0]!;
    const rows = first.bytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const inherited = rows.find(row => row.kind === 'directory_checkpoint_inheritance'); assert.ok(inherited);
    for (const reference of inherited.references) delete reference.origin.proof;
    fs.writeFileSync(first.file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
    assert.equal(cold(recoveredForkId).kind, 'unknown');
  } finally { for (const descendant of descendants) fs.writeFileSync(descendant.file, descendant.bytes); }
  let sourceSnapshotBytes = 0;
  try {
    const rows = targetBytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
    const recovered = rows.find(row => row.kind === 'directory_checkpoint_torn_recovery'); assert.ok(recovered);
    sourceSnapshotBytes = recovered.sourceJournal.bytes; assert.ok(sourceSnapshotBytes > 8);
    recovered.evidence.sha256 = '0'.repeat(64);
    const altered = Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n'); fs.writeFileSync(targetJournal, altered);
    for (const descendant of descendants) {
      const inheritedRows = descendant.bytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      const inherited = inheritedRows.find(row => row.kind === 'directory_checkpoint_inheritance'); assert.ok(inherited);
      for (const reference of inherited.references) {
        assert.equal(reference.origin.owner, childId);
        reference.origin.proof.journal.sha256 = createHash('sha256').update(altered.subarray(0, reference.origin.proof.journal.bytes)).digest('hex');
      }
      fs.writeFileSync(descendant.file, inheritedRows.map(row => JSON.stringify(row)).join('\n') + '\n');
    }
    assert.equal(cold().kind, 'unknown');
    assert.equal(cold(recoveredForkId).kind, 'unknown'); assert.equal(cold(recoveredGrandchildId).kind, 'unknown');
  } finally { fs.writeFileSync(targetJournal, targetBytes); for (const descendant of descendants) fs.writeFileSync(descendant.file, descendant.bytes); }
  const sourceJournal = fs.readFileSync(parent.file);
  try {
    fs.writeFileSync(parent.file, sourceJournal.subarray(0, sourceJournal.length - 8));
    assert.equal(cold().kind, 'unknown'); assert.equal(cold(recoveredGrandchildId).kind, 'unknown'); assert.equal(cold(indirectId).kind, 'unknown');
  } finally { fs.writeFileSync(parent.file, sourceJournal); }
  try {
    fs.writeFileSync(parent.file, sourceJournal.subarray(0, sourceSnapshotBytes - 8));
    assert.equal(cold().kind, 'unknown'); assert.equal(cold(recoveredGrandchildId).kind, 'unknown'); assert.equal(cold(indirectId).kind, 'unknown');
  } finally { fs.writeFileSync(parent.file, sourceJournal); }
  try {
    fs.writeFileSync(evidence, Buffer.from('altered'));
    assert.equal(cold().kind, 'unknown'); assert.equal(cold(recoveredForkId).kind, 'unknown');
    assert.equal(cold(recoveredGrandchildId).kind, 'unknown');
    for (const id of [doubleTornId, doubleTornCleanId, doubleTornForkId, doubleTornGrandchildId]) assert.equal(cold(id).kind, 'unknown');
  } finally { fs.writeFileSync(evidence, originalEvidence); }
  for (const id of [doubleTornId, doubleTornCleanId]) {
    const tornName = fs.readdirSync(path.join(root, '.agent')).find(name => name.startsWith(`${id}.jsonl.torn-`)); assert.ok(tornName);
    const tornFile = path.join(root, '.agent', tornName), bytes = fs.readFileSync(tornFile);
    try {
      fs.writeFileSync(tornFile, 'altered second evidence'); assert.equal(cold(id).kind, 'unknown');
      if (id === doubleTornId) for (const descendant of [doubleTornForkId, doubleTornGrandchildId]) assert.equal(cold(descendant).kind, 'unknown');
    } finally { fs.writeFileSync(tornFile, bytes); }
    assert.equal(cold(id).bytes, 'TORN_ORIGINAL');
  }
  assert.equal(cold().bytes, 'TORN_ORIGINAL');
  const guarded = Session.open(root, { id: childId }), provider = new ScriptedProvider([done()]);
  let laterForkId = '', laterGrandchildId = '', postTornId = '', postCleanTornId = '';
  try {
    const historyKind = () => guarded.directoryFileHistory.kind;
    guarded.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const heldBeforeRun = path.join(root, '.agent', 'fixture-held-before-run'); fs.renameSync(evidence, heldBeforeRun);
    try { assert.equal(historyKind(), 'unknown'); }
    finally { fs.renameSync(heldBeforeRun, evidence); }
    await new Agent(guarded, provider, tools).run('continue after metadata-only recovery');
    assert.equal(provider.requests.length, 1); assert.equal(historyKind(), 'available');
    assert.deepEqual(fs.readFileSync(evidence), originalEvidence);
    const later = await checkpointConversationWithDirectoryWitness(guarded, 'after-torn-reconcile', signal);
    assert.ok('external_witness' in later); assert.equal(later.external_witness, 'available');
    assert.equal(readDirectoryCheckpointBackup(guarded, 'after-torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
    postTornId = interruptRecoveredFork(guarded);
    const postTorn = Session.open(root, { id: postTornId });
    try {
      const postReceiptName = fs.readdirSync(directory).find(value => value.startsWith(`${path.basename(guarded.file)}.checkpoint-witness-receipt-`) &&
        JSON.parse(fs.readFileSync(path.join(directory, value), 'utf8')).checkpoint.name === 'after-torn-reconcile');
      assert.ok(postReceiptName); const postReceipt = path.join(directory, postReceiptName), bytes = fs.readFileSync(postReceipt);
      const append = Session.prototype.append; let changedReceipt = false;
      try {
        Session.prototype.append = function(event, authorization, token) {
          if (event.kind === 'directory_checkpoint_torn_recovery') { fs.writeFileSync(postReceipt, '{}'); changedReceipt = true; }
          return append.call(this, event, authorization, token);
        };
        const before = postTorn.events.length;
        assert.throws(() => postTorn.reconcileTornCheckpointInheritance(guarded), /authorization/i);
        assert.equal(changedReceipt, true); assert.equal(postTorn.events.length, before);
      } finally { Session.prototype.append = append; fs.writeFileSync(postReceipt, bytes); }
      assert.equal(postTorn.reconcileTornCheckpointInheritance(guarded).kind, 'reconciled');
      for (const name of ['torn-reconcile', 'after-torn-reconcile'])
        assert.equal(readDirectoryCheckpointBackup(postTorn, name, target)?.toString(), 'TORN_ORIGINAL');
    } finally { await postTorn.close(); }
    const laterFork = forkSession(guarded);
    try {
      laterForkId = laterFork.id;
      assert.equal(readDirectoryCheckpointBackup(laterFork, 'after-torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      postCleanTornId = interruptRecoveredFork(laterFork);
      const postCleanTorn = Session.open(root, { id: postCleanTornId });
      try {
        assert.equal(postCleanTorn.reconcileTornCheckpointInheritance(laterFork).kind, 'reconciled');
        for (const name of ['torn-reconcile', 'after-torn-reconcile'])
          assert.equal(readDirectoryCheckpointBackup(postCleanTorn, name, target)?.toString(), 'TORN_ORIGINAL');
      } finally { await postCleanTorn.close(); }
      const laterGrandchild = forkSession(laterFork);
      try {
        laterGrandchildId = laterGrandchild.id;
        assert.equal(readDirectoryCheckpointBackup(laterGrandchild, 'after-torn-reconcile', target)?.toString(), 'TORN_ORIGINAL');
      } finally { await laterGrandchild.close(); }
      try { fs.writeFileSync(evidence, 'changed'); assert.equal(inspectDirectoryCheckpointWitness(laterFork, 'after-torn-reconcile').kind, 'unknown'); }
      finally { fs.writeFileSync(evidence, originalEvidence); }
    } finally { await laterFork.close(); }
    const extra = `${guarded.file}.torn-00000000-0000-4000-8000-000000000001`;
    fs.writeFileSync(extra, 'unrelated torn evidence', { mode: 0o600 });
    try { assert.equal(historyKind(), 'unknown'); }
    finally { fs.unlinkSync(extra); }
    try { fs.writeFileSync(evidence, 'changed'); assert.equal(historyKind(), 'unknown'); }
    finally { fs.writeFileSync(evidence, originalEvidence); }
    const snapshot = guarded.events.findLast(event => event.kind === 'directory_snapshot'); assert.ok(snapshot && snapshot.kind === 'directory_snapshot');
    const snapshotReceipt = fs.lstatSync(`${guarded.file}.snapshot-commit-receipt-${snapshot.id}`), sync = fs.fsyncSync; let changedDuringRead = false;
    try {
      fs.fsyncSync = fd => {
        const opened = fs.fstatSync(fd);
        if (!changedDuringRead && opened.dev === snapshotReceipt.dev && opened.ino === snapshotReceipt.ino) {
          changedDuringRead = true; fs.writeFileSync(evidence, 'changed during read');
        }
        return sync(fd);
      };
      assert.equal(historyKind(), 'unknown'); assert.equal(changedDuringRead, true);
    } finally { fs.fsyncSync = sync; fs.writeFileSync(evidence, originalEvidence); }
    const heldEvidence = path.join(root, '.agent', 'fixture-held-torn'); fs.renameSync(evidence, heldEvidence);
    try { assert.equal(historyKind(), 'unknown'); }
    finally { fs.renameSync(heldEvidence, evidence); }
    const sourceReceipt = fs.readdirSync(path.join(root, '.agent')).find(name => name.startsWith(`${parent.id}.jsonl.checkpoint-witness-receipt-`));
    assert.ok(sourceReceipt); const sourceReceiptPath = path.join(root, '.agent', sourceReceipt), heldReceipt = path.join(root, '.agent', 'fixture-held-receipt');
    fs.renameSync(sourceReceiptPath, heldReceipt);
    try { assert.equal(historyKind(), 'unknown'); }
    finally { fs.renameSync(heldReceipt, sourceReceiptPath); }
    const sourceReceiptData = JSON.parse(fs.readFileSync(sourceReceiptPath, 'utf8'));
    const sourceBackup = `${parent.file}.snapshot-unknown-${sourceReceiptData.entries[0].observation.backup.id}`;
    const sourceBackupBytes = fs.readFileSync(sourceBackup), changedBackup = Buffer.from(sourceBackupBytes); assert.ok(changedBackup.length);
    changedBackup[0] ^= 1;
    try { fs.writeFileSync(sourceBackup, changedBackup); assert.equal(historyKind(), 'unknown'); }
    finally { fs.writeFileSync(sourceBackup, sourceBackupBytes); }
    assert.equal(historyKind(), 'available');
  } finally { await guarded.close(); }
  for (let i = 0; i < 2; i++) assert.deepEqual(cold(childId, 'after-torn-reconcile'),
    { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  assert.ok(laterForkId); assert.ok(laterGrandchildId);
  for (const id of [laterForkId, laterGrandchildId]) for (let i = 0; i < 2; i++) assert.deepEqual(cold(id, 'after-torn-reconcile'),
    { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  for (const id of [postTornId, postCleanTornId]) for (const name of ['torn-reconcile', 'after-torn-reconcile'])
    for (let i = 0; i < 2; i++) assert.deepEqual(cold(id, name), { kind: 'available', bytes: 'TORN_ORIGINAL', grant: false });
  try {
    fs.writeFileSync(evidence, 'changed');
    for (const id of [laterForkId, laterGrandchildId, postTornId, postCleanTornId])
      assert.equal(cold(id, 'after-torn-reconcile').kind, 'unknown');
  } finally { fs.writeFileSync(evidence, originalEvidence); }
  for (const id of [postTornId, postCleanTornId]) {
    const tornName = fs.readdirSync(directory).find(name => name.startsWith(`${id}.jsonl.torn-`)); assert.ok(tornName);
    const tornFile = path.join(directory, tornName), bytes = fs.readFileSync(tornFile);
    try {
      fs.writeFileSync(tornFile, 'changed new checkpoint torn evidence');
      for (const name of ['torn-reconcile', 'after-torn-reconcile']) assert.equal(cold(id, name).kind, 'unknown');
    } finally { fs.writeFileSync(tornFile, bytes); }
  }
  const marker = path.join(root, 'later-snapshot-stopped');
  const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const [root,id,outside,marker]=process.argv.slice(1),s=Session.open(root,{id}),write=fs.writeSync;
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    fs.writeSync=function(fd,bytes,offset,length,...rest){if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_snapshot"')){
      const count=Math.max(1,Math.floor(length/2));if(write.call(fs,fd,bytes,offset,count,...rest)!==count)throw Error('short snapshot write');
      fs.writeFileSync(marker,'ready');process.kill(process.pid,'SIGSTOP')}return write.call(fs,fd,bytes,offset,length,...rest)};
    const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],
      stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    await new Agent(s,provider,createTools()).run('interrupt later snapshot');throw Error('snapshot barrier missed');`;
  const processOwner = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, childId, outside, marker],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = ''; processOwner.stderr!.on('data', chunk => { errors += String(chunk); });
  const exited = new Promise<void>((resolve, reject) => { processOwner.once('error', reject); processOwner.once('exit', () => resolve()); });
  try {
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(processOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
      assert.ok(Date.now() < deadline && processOwner.exitCode === null && processOwner.signalCode === null, errors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    processOwner.kill('SIGKILL'); await exited;
    const readerAfterCrash = `import fs from 'node:fs';import path from 'node:path';import {Session} from './src/session.ts';
      import {inspectDirectoryCheckpointWitness} from './src/rewind.ts';const [root,id,recover]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:recover==='yes'});
      process.stdout.write(JSON.stringify({history:s.directoryFileHistory.kind,checkpoint:inspectDirectoryCheckpointWitness(s,'after-torn-reconcile').kind,
        torn:fs.readdirSync(path.dirname(s.file)).filter(name=>name.startsWith(path.basename(s.file)+'.torn-')).length}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const result = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', readerAfterCrash,
        root, childId, i === 0 ? 'yes' : 'no'], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout), { history: 'unknown', checkpoint: 'unknown', torn: 2 });
    }
  } finally { if (processOwner.exitCode === null && processOwner.signalCode === null) { processOwner.kill('SIGKILL'); await exited; } }
});

test('torn checkpoint reconciliation remains verifiable across writer death', { timeout: 180000 }, async () => {
  for (const sourceKind of ['direct', 'indirect', 'recovered', 'recovered-indirect', 'post-recovered', 'post-recovered-indirect'] as const)
    for (const phase of ['before', 'partial', 'write', 'after'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), local = path.join(root, 'value'), tools = createTools();
    const marker = path.join(root, `.reconcile-${phase}`); fs.writeFileSync(target, 'RECOVERY_ORIGINAL'); fs.writeFileSync(local, 'BEFORE');
    const signal = new AbortController().signal, parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const write = fs.writeSync; let source: Session | undefined, prior: Session | undefined, childId = '', evidence = '', originalEvidence = Buffer.alloc(0);
    let priorEvidence = '', priorEvidenceBytes = Buffer.alloc(0);
    try {
      parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(parent, new ScriptedProvider([response([call('track-recovery-crash', 'write_file',
        { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
      const captured = await checkpointConversationWithDirectoryWitness(parent, 'recovery-crash', signal);
      assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
      if (sourceKind === 'recovered' || sourceKind === 'recovered-indirect' || sourceKind === 'post-recovered' || sourceKind === 'post-recovered-indirect') {
        const directory = path.join(root, '.agent'); let priorId = '';
        fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
          const [fd, bytes, offset, length] = args;
          if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
            const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
              (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
            assert.ok(file); priorId = file.slice(0, -6); fs.writeSync = write;
            Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
            throw new Error('injected earlier torn inheritance');
          }
          return Reflect.apply(targetFn, thisArg, args);
        } });
        assert.throws(() => forkSession(parent), /injected earlier torn inheritance/); fs.writeSync = write;
        prior = Session.open(root, { id: priorId });
        assert.equal(prior.reconcileTornCheckpointInheritance(parent).kind, 'reconciled');
        const priorName = fs.readdirSync(directory).find(name => name.startsWith(`${priorId}.jsonl.torn-`)); assert.ok(priorName);
        priorEvidence = path.join(directory, priorName); priorEvidenceBytes = fs.readFileSync(priorEvidence);
        if (sourceKind.startsWith('post-')) {
          prior.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
          const later = await checkpointConversationWithDirectoryWitness(prior, 'recovery-crash-post', signal);
          assert.ok('external_witness' in later); assert.equal(later.external_witness, 'available');
        }
        source = sourceKind === 'recovered' || sourceKind === 'post-recovered' ? prior : forkSession(prior);
      } else source = sourceKind === 'direct' ? parent : forkSession(parent);
      fs.writeFileSync(local, 'AFTER'); const preview = sourceKind.startsWith('post-') ? undefined : previewRewind(source, 1, signal);
      const directory = path.join(root, '.agent');
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') && name !== `${parent.id}.jsonl` &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); childId = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected torn inheritance');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      if (preview) assert.throws(() => applyRewind(source!, preview, preview.token, signal), /history committed.*inherited witness/i);
      else assert.throws(() => forkSession(source!), /injected torn inheritance/);
      fs.writeSync = write; assert.ok(childId);
      const child = Session.open(root, { id: childId });
      const name = fs.readdirSync(directory).find(value => value.startsWith(`${childId}.jsonl.torn-`)); assert.ok(name);
      evidence = path.join(directory, name); originalEvidence = fs.readFileSync(evidence); await child.close(); await source.close(); await prior?.close(); await parent.close();
      const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';
        const [root,sourceId,targetId,marker,phase]=process.argv.slice(1),source=Session.open(root,{id:sourceId}),target=Session.open(root,{id:targetId});
        const append=Session.prototype.append,write=fs.writeSync,stop=()=>{fs.writeFileSync(marker,'ready');process.kill(process.pid,'SIGSTOP')};
        Session.prototype.append=function(event,...args){if(event.kind==='directory_checkpoint_torn_recovery'){
          if(phase==='before')stop();if(phase==='partial'||phase==='write')fs.writeSync=function(fd,bytes,offset,length,...rest){
            if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_torn_recovery"')){
              fs.writeSync=write;const count=phase==='partial'?Math.max(1,Math.floor(length/2)):length;
              if(write.call(fs,fd,bytes,offset,count,...rest)!==count)throw Error('recovery barrier short write');stop()}
            return write.call(fs,fd,bytes,offset,length,...rest)};
          const result=append.call(this,event,...args);if(phase==='after')stop();return result}return append.call(this,event,...args)};
        target.reconcileTornCheckpointInheritance(source);throw Error('recovery barrier missed');`;
      const processOwner = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, source.id, childId, marker, phase],
        { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
      let errors = ''; processOwner.stderr!.on('data', chunk => { errors += String(chunk); });
      const exited = new Promise<void>((resolve, reject) => { processOwner.once('error', reject); processOwner.once('exit', () => resolve()); });
      try {
        const deadline = Date.now() + 10000;
        while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(processOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
          assert.ok(Date.now() < deadline && processOwner.exitCode === null && processOwner.signalCode === null, errors);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        processOwner.kill('SIGKILL'); await exited; assert.deepEqual(fs.readFileSync(evidence), originalEvidence);
        if (priorEvidence) assert.deepEqual(fs.readFileSync(priorEvidence), priorEvidenceBytes);
        const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
          const [root,id,outside,target,recover,name]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:recover==='yes'}),w=inspectDirectoryCheckpointWitness(s,name);
          process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,name,target)?.toString()??null,
            grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
        const names = sourceKind.startsWith('post-') ? ['recovery-crash', 'recovery-crash-post'] : ['recovery-crash'];
        for (const [index, name] of names.entries()) for (let i = 0; i < 2; i++) {
          const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader,
            root, childId, outside, target, index === 0 && i === 0 ? 'yes' : 'no', name], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
          assert.equal(cold.status, 0, cold.stderr);
          assert.deepEqual(JSON.parse(cold.stdout), { kind: phase === 'write' || phase === 'after' ? 'available' : 'unknown',
            bytes: phase === 'write' || phase === 'after' ? 'RECOVERY_ORIGINAL' : null, grant: false });
        }
        assert.deepEqual(fs.readFileSync(evidence), originalEvidence);
        if (priorEvidence) assert.deepEqual(fs.readFileSync(priorEvidence), priorEvidenceBytes);
      } finally { if (processOwner.exitCode === null && processOwner.signalCode === null) { processOwner.kill('SIGKILL'); await exited; } }
    } finally { fs.writeSync = write; await source?.close(); await prior?.close(); await parent.close(); }
  }
});

test('torn checkpoint reconciliation can follow original writer death', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'writer-stopped'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL_WRITER_BYTES');
  const source = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  source.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
  await new Agent(source, new ScriptedProvider([response([call('track-writer-death', 'write_file',
    { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
  const captured = await checkpointConversationWithDirectoryWitness(source, 'writer-death', new AbortController().signal);
  assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
  const sourceId = source.id; await source.close();
  const writer = `import fs from 'node:fs';import path from 'node:path';import {Session} from './src/session.ts';import {forkSession} from './src/sessions.ts';
    const [root,id,outside,marker]=process.argv.slice(1),source=Session.open(root,{id}),write=fs.writeSync,dir=path.join(root,'.agent');
    source.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    fs.writeSync=function(fd,bytes,offset,length,...rest){if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
      const stat=fs.fstatSync(fd),name=fs.readdirSync(dir).find(n=>n.endsWith('.jsonl')&&n!==id+'.jsonl'&&(()=>{const s=fs.lstatSync(path.join(dir,n));return s.dev===stat.dev&&s.ino===stat.ino})());
      if(!name)throw Error('target missing');const count=Math.max(1,Math.floor(length/2));if(write.call(fs,fd,bytes,offset,count,...rest)!==count)throw Error('partial write failed');
      fs.writeFileSync(marker,JSON.stringify({id:name.slice(0,-6)}));process.kill(process.pid,'SIGSTOP')}
      return write.call(fs,fd,bytes,offset,length,...rest)};forkSession(source);throw Error('writer barrier missed');`;
  const processOwner = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, sourceId, outside, marker],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = ''; processOwner.stderr!.on('data', chunk => { errors += String(chunk); });
  const exited = new Promise<void>((resolve, reject) => { processOwner.once('error', reject); processOwner.once('exit', () => resolve()); });
  try {
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(processOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
      assert.ok(Date.now() < deadline && processOwner.exitCode === null && processOwner.signalCode === null, errors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const { id } = JSON.parse(fs.readFileSync(marker, 'utf8')); processOwner.kill('SIGKILL'); await exited;
    const reopenedSource = Session.open(root, { id: sourceId, recoverLock: true }), reopenedTarget = Session.open(root, { id, recoverLock: true });
    try {
      assert.equal(inspectDirectoryCheckpointWitness(reopenedTarget, 'writer-death').kind, 'unknown');
      assert.equal(reopenedTarget.reconcileTornCheckpointInheritance(reopenedSource).kind, 'reconciled');
      assert.equal(readDirectoryCheckpointBackup(reopenedTarget, 'writer-death', target)?.toString(), 'ORIGINAL_WRITER_BYTES');
    } finally { await reopenedTarget.close(); await reopenedSource.close(); }
    const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
      const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'writer-death');
      process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,'writer-death',target)?.toString()??null,
        grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, target],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'ORIGINAL_WRITER_BYTES', grant: false });
    }
  } finally { if (processOwner.exitCode === null && processOwner.signalCode === null) { processOwner.kill('SIGKILL'); await exited; } }
});

test('indirect and recovered-origin torn checkpoint reconciliation can follow original writer death', { timeout: 90000 }, async () => {
  for (const sourceKind of ['indirect', 'recovered', 'recovered-indirect'] as const) {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'indirect-writer-stopped'), tools = createTools();
  fs.writeFileSync(target, 'INDIRECT_WRITER_BYTES');
  const origin = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  origin.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
  await new Agent(origin, new ScriptedProvider([response([call('track-indirect-writer-death', 'write_file',
    { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
  const captured = await checkpointConversationWithDirectoryWitness(origin, 'indirect-writer-death', new AbortController().signal);
  assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
  let source: Session, prior: Session | undefined, priorEvidence = '', priorBytes = Buffer.alloc(0);
  if (sourceKind === 'indirect') source = forkSession(origin);
  else {
    const directory = path.join(root, '.agent'), write = fs.writeSync; let priorId = '';
    try {
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); priorId = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected earlier torn inheritance');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => forkSession(origin), /injected earlier torn inheritance/);
    } finally { fs.writeSync = write; }
    prior = Session.open(root, { id: priorId });
    assert.equal(prior.reconcileTornCheckpointInheritance(origin).kind, 'reconciled');
    const priorName = fs.readdirSync(directory).find(name => name.startsWith(`${priorId}.jsonl.torn-`)); assert.ok(priorName);
    priorEvidence = path.join(directory, priorName); priorBytes = fs.readFileSync(priorEvidence);
    source = sourceKind === 'recovered' ? prior : forkSession(prior);
  }
  const sourceId = source.id; await source.close(); await prior?.close(); await origin.close();
  const writer = `import fs from 'node:fs';import path from 'node:path';import {Session} from './src/session.ts';import {forkSession} from './src/sessions.ts';
    const [root,id,outside,marker]=process.argv.slice(1),source=Session.open(root,{id}),write=fs.writeSync,dir=path.join(root,'.agent');
    source.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    fs.writeSync=function(fd,bytes,offset,length,...rest){if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
      const stat=fs.fstatSync(fd),name=fs.readdirSync(dir).find(n=>n.endsWith('.jsonl')&&n!==id+'.jsonl'&&(()=>{const s=fs.lstatSync(path.join(dir,n));return s.dev===stat.dev&&s.ino===stat.ino})());
      if(!name)throw Error('target missing');const count=Math.max(1,Math.floor(length/2));if(write.call(fs,fd,bytes,offset,count,...rest)!==count)throw Error('partial write failed');
      fs.writeFileSync(marker,JSON.stringify({id:name.slice(0,-6)}));process.kill(process.pid,'SIGSTOP')}
      return write.call(fs,fd,bytes,offset,length,...rest)};forkSession(source);throw Error('writer barrier missed');`;
  const processOwner = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, sourceId, outside, marker],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = ''; processOwner.stderr!.on('data', chunk => { errors += String(chunk); });
  const exited = new Promise<void>((resolve, reject) => { processOwner.once('error', reject); processOwner.once('exit', () => resolve()); });
  try {
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(processOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
      assert.ok(Date.now() < deadline && processOwner.exitCode === null && processOwner.signalCode === null, errors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const { id } = JSON.parse(fs.readFileSync(marker, 'utf8')); processOwner.kill('SIGKILL'); await exited;
    if (priorEvidence) assert.deepEqual(fs.readFileSync(priorEvidence), priorBytes);
    const reopenedSource = Session.open(root, { id: sourceId, recoverLock: true }), reopenedTarget = Session.open(root, { id, recoverLock: true });
    try {
      assert.equal(inspectDirectoryCheckpointWitness(reopenedTarget, 'indirect-writer-death').kind, 'unknown');
      assert.equal(reopenedTarget.reconcileTornCheckpointInheritance(reopenedSource).kind, 'reconciled');
      assert.equal(readDirectoryCheckpointBackup(reopenedTarget, 'indirect-writer-death', target)?.toString(), 'INDIRECT_WRITER_BYTES');
    } finally { await reopenedTarget.close(); await reopenedSource.close(); }
    const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
      const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'indirect-writer-death');
      process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,'indirect-writer-death',target)?.toString()??null,
        grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, target],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'INDIRECT_WRITER_BYTES', grant: false });
    }
    if (priorEvidence) assert.deepEqual(fs.readFileSync(priorEvidence), priorBytes);
  } finally { if (processOwner.exitCode === null && processOwner.signalCode === null) { processOwner.kill('SIGKILL'); await exited; } }
  }
});

test('CLI resume reconciles an inheritance torn by original writer death', { timeout: 120000 }, async t => {
  for (const sourceKind of ['direct', 'direct-suffix', 'direct-title', 'direct-text', 'direct-text-null-citations', 'direct-text-empty-citations', 'direct-text-observer', 'direct-text-incomplete', 'direct-text-tool', 'direct-text-snapshot', 'direct-text-disabled',
    'direct-history-untracked', 'direct-history-tracked', 'direct-history-touch', 'direct-history-external', 'direct-unsupported',
    'indirect', 'recovered', 'recovered-indirect', 'deep-recovered', 'post-recovered', 'post-recovered-indirect'] as const) {
  const textSuffix = ['direct-text', 'direct-text-null-citations', 'direct-text-empty-citations'].includes(sourceKind);
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'resume-writer-stopped');
  const userDir = path.join(root, 'fixture-user'), tools = createTools(); fs.mkdirSync(userDir); fs.writeFileSync(target, 'RESUMED_ORIGINAL');
  const origin = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] },
    ...(sourceKind === 'direct-history-tracked' ? { automaticCheckpoints: true } : {}) }) });
  origin.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
  await new Agent(origin, new ScriptedProvider([response([call('track-resume-writer', 'write_file',
    { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
  const captured = await checkpointConversationWithDirectoryWitness(origin, 'resume-writer', new AbortController().signal);
  assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
  let source: Session, prior: Session | undefined, priorEvidence = '', priorBytes = Buffer.alloc(0);
  if (sourceKind === 'direct' || sourceKind === 'direct-suffix' || sourceKind === 'direct-title' || sourceKind.startsWith('direct-text') || sourceKind.startsWith('direct-history-') || sourceKind === 'direct-unsupported') source = origin;
  else if (sourceKind === 'indirect') source = forkSession(origin);
  else {
    const directory = path.join(root, '.agent'), write = fs.writeSync; let priorId = '';
    let recoverySource = origin;
    for (let round = 0; round < (sourceKind === 'deep-recovered' ? 3 : 1); round++) {
    try {
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); priorId = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected earlier torn inheritance');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => forkSession(recoverySource), /injected earlier torn inheritance/);
    } finally { fs.writeSync = write; }
    const next = Session.open(root, { id: priorId }); assert.equal(next.reconcileTornCheckpointInheritance(recoverySource).kind, 'reconciled');
    await prior?.close(); prior = next; recoverySource = next;
    const priorName = fs.readdirSync(directory).find(name => name.startsWith(`${priorId}.jsonl.torn-`)); assert.ok(priorName);
    priorEvidence = path.join(directory, priorName); priorBytes = fs.readFileSync(priorEvidence);
    }
    assert.ok(prior);
    if (sourceKind.startsWith('post-')) {
      prior.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const later = await checkpointConversationWithDirectoryWitness(prior, 'resume-writer-post', new AbortController().signal);
      assert.ok('external_witness' in later); assert.equal(later.external_witness, 'available');
    }
    source = sourceKind === 'recovered' || sourceKind === 'deep-recovered' || sourceKind === 'post-recovered' ? prior : forkSession(prior);
  }
  const sourceId = source.id; await source.close(); await prior?.close(); await origin.close();
  const writer = `import fs from 'node:fs';import path from 'node:path';import {Session} from './src/session.ts';import {forkSession} from './src/sessions.ts';
    const [root,id,marker]=process.argv.slice(1),source=Session.open(root,{id}),write=fs.writeSync,dir=path.join(root,'.agent');
    fs.writeSync=function(fd,bytes,offset,length,...rest){if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_inheritance"')){
      const stat=fs.fstatSync(fd),name=fs.readdirSync(dir).find(n=>n.endsWith('.jsonl')&&n!==id+'.jsonl'&&(()=>{const s=fs.lstatSync(path.join(dir,n));return s.dev===stat.dev&&s.ino===stat.ino})());
      if(!name)throw Error('target missing');const count=Math.max(1,Math.floor(length/2));if(write.call(fs,fd,bytes,offset,count,...rest)!==count)throw Error('partial write failed');
      fs.writeFileSync(marker,JSON.stringify({id:name.slice(0,-6)}));process.kill(process.pid,'SIGSTOP')}
      return write.call(fs,fd,bytes,offset,length,...rest)};forkSession(source);throw Error('writer barrier missed');`;
  const processOwner = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, sourceId, marker],
    { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
  let errors = ''; processOwner.stderr!.on('data', chunk => { errors += String(chunk); });
  const exited = new Promise<void>((resolve, reject) => { processOwner.once('error', reject); processOwner.once('exit', () => resolve()); });
  try {
    const deadline = Date.now() + 10000;
    while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(processOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
      assert.ok(Date.now() < deadline && processOwner.exitCode === null && processOwner.signalCode === null, errors);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const { id } = JSON.parse(fs.readFileSync(marker, 'utf8')); processOwner.kill('SIGKILL'); await exited;
    const directory = path.join(root, '.agent'), tornOriginal = fs.readFileSync(path.join(directory, `${id}.jsonl`));
    let historySequence: number | undefined;
    const resume = (preload?: string, input = '/exit\n', fixtureKey = '') => childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root,
      '--resume', id, '--recover-lock', '--interactive', '--no-tui', '--no-inherit-gateway'],
      { cwd: process.cwd(), input, encoding: 'utf8', timeout: 15000,
        env: { ...process.env, HOME: userDir, LLM_API_KEY: fixtureKey, NODE_OPTIONS: preload ? `--import=${preload}` : '' } });
    if (sourceKind === 'direct-suffix' || sourceKind === 'direct-title' || sourceKind.startsWith('direct-text') || sourceKind.startsWith('direct-history-') || sourceKind === 'direct-unsupported') {
      const storeLock = path.join(directory, 'checkpoints', 'lock');
      fs.writeFileSync(storeLock, JSON.stringify({ pid: process.pid, token: randomUUID() }), { flag: 'wx', mode: 0o600 });
      try {
        const input = sourceKind === 'direct-suffix' ? '/color red\n/color default\n/color blue\n/exit\n' : '/rename retained-title\n/color blue\n/exit\n';
        const blocked = resume(undefined, input); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/); assert.equal(fs.existsSync(`${source.file}.lock`), true);
        const rows = fs.readFileSync(path.join(directory, `${id}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        assert.deepEqual(rows.at(-1), { kind: 'session_color', color: 'blue' });
        if (sourceKind.startsWith('direct-history-') || sourceKind === 'direct-unsupported') {
          const target = Session.open(root, { id });
          try {
            historySequence = target.fileHistory.trackSequence + 1;
            if (sourceKind === 'direct-history-external') target.touchFile(path.join(outside, 'later-external.txt'));
            else {
              const tool = tools.find(item => item.schema.name === (sourceKind === 'direct-history-touch' ? 'run_command' : 'write_file')); assert.ok(tool);
              const input = sourceKind === 'direct-history-touch' ? { command: `printf '%s' EXTERNAL_CHANGE > ${shellQuote(path.join(outside, 'shell-created.txt'))}` } :
                { path: 'later-workspace.txt', content: 'HISTORY_AFTER', overwrite: true };
              await tool.execute(input, { session: target, workspace: root, signal: new AbortController().signal, allowShell: true, maxOutputBytes: 24000,
                fileHistory: file => target.touchFile(file) });
            }
            assert.equal(target.fileHistory.trackSequence, historySequence);
            assert.equal(target.fileHistory.trackedFiles.has('later-workspace.txt'), sourceKind === 'direct-history-tracked');
            if (sourceKind === 'direct-unsupported') target.append(permissionModeCommand('permissions', 'ask', 'bypass'));
            target.append({ kind: 'session_color', color: 'blue' });
          }
          finally { await target.close(); }
        }
        if (textSuffix || sourceKind === 'direct-text-observer') {
          const targetJournal = path.join(directory, `${id}.jsonl`), before = fs.readFileSync(targetJournal, 'utf8').trimEnd().split('\n').length;
          const preload = path.join(root, 'text-provider-preload.mjs');
          fs.writeFileSync(preload, `globalThis.fetch=()=>{throw Error('fixture network disabled')};
            if(${JSON.stringify(sourceKind)}==='direct-text-observer'){
              const fs=await import('node:fs'),{Agent}=await import(${JSON.stringify(new URL('../dist/agent.js', import.meta.url).href)}),run=Agent.prototype.run;
              Agent.prototype.run=function(...args){Object.defineProperty(this.events,'progress',{configurable:true,get(){
                fs.writeFileSync(${JSON.stringify(path.join(outside, 'value'))},'DISPLAY_GETTER_EFFECT');return undefined;}});return Reflect.apply(run,this,args);};}
            const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
            GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(_request,_signal,onText)=>{
              onText?.('fixture reply');return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'fixture reply',
                ...${JSON.stringify(sourceKind === 'direct-text-null-citations' ? { citations: null } : sourceKind === 'direct-text-empty-citations' ? { citations: [] } : {})}}],
                stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
          const turn = resume(preload, 'ordinary later text\nsecond later text\n/exit\n', 'fixture-only');
          assert.equal(turn.status, 0, turn.stderr + turn.stdout); assert.doesNotMatch(turn.stderr, /Checkpoint witness reconciled/);
          const target = Session.open(root, { id });
          try {
            const suffix = target.events.slice(before); t.diagnostic(`later text suffix: ${JSON.stringify(suffix.map(event => event.kind === 'message' ? {
              kind: event.kind, role: event.message.role, keys: Object.keys(event), content: typeof event.message.content === 'string' ? 'string' : event.message.content.map(block => block.type),
              origin: event.classifier?.origin.kind, stop: event.response?.stop_reason } : { kind: event.kind, ...(event.kind === 'turn_end' ? { reason: event.reason } : {}) }))}`);
            assert.equal(suffix.some(event => event.kind === 'message' && event.message.role === 'user'), true);
            assert.equal(suffix.some(event => event.kind === 'message' && event.message.role === 'assistant'), true);
            assert.deepEqual(suffix.filter(event => event.kind !== 'agent_display_observer').map(event => event.kind),
              ['message', 'message', 'turn_end', 'message', 'message', 'turn_end']);
            assert.ok(suffix.some(event => event.kind === 'agent_display_observer'));
          } finally { await target.close(); }
        }
        if (sourceKind === 'direct-text-incomplete') {
          const stop = path.join(root, 'text-writer-stopped'), preload = path.join(root, 'text-writer-stop.mjs');
          fs.writeFileSync(preload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
            const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});
            GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{fs.writeFileSync(${JSON.stringify(stop)},'ready');
              process.kill(process.pid,'SIGSTOP');throw Error('unexpected continuation')};`);
          const owner = spawn(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--resume', id, '--recover-lock', '--interactive', '--no-tui', '--no-inherit-gateway'],
            { cwd: process.cwd(), env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` }, stdio: ['pipe', 'ignore', 'pipe'] });
          owner.stdin!.end('unfinished later text\n'); let ownerErrors = ''; owner.stderr!.on('data', chunk => { ownerErrors += String(chunk); });
          const ownerExit = new Promise<void>((resolve, reject) => { owner.once('error', reject); owner.once('exit', () => resolve()); });
          try {
            const deadline = Date.now() + 10000;
            while (!fs.existsSync(stop) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(owner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
              assert.ok(Date.now() < deadline && owner.exitCode === null && owner.signalCode === null, ownerErrors);
              await new Promise(resolve => setTimeout(resolve, 10));
            }
            owner.kill('SIGKILL'); await ownerExit;
            const target = Session.open(root, { id, recoverLock: true });
            try { assert.equal(target.events.findLast(event => event.kind !== 'agent_display_observer')?.kind, 'message'); assert.equal(target.awaitingResponse, true); }
            finally { await target.close(); }
          } finally { if (owner.exitCode === null && owner.signalCode === null) { owner.kill('SIGKILL'); await ownerExit; } }
        }
        if (sourceKind === 'direct-text-tool' || sourceKind === 'direct-text-snapshot' || sourceKind === 'direct-text-disabled') {
          const target = Session.open(root, { id });
          try {
            const mode = sourceKind === 'direct-text-tool' ? 'tool' : sourceKind === 'direct-text-snapshot' ? 'snapshot' : 'disabled';
            const kinds = await appendLaterTextFixture(target, tools, outside, mode);
            if (mode === 'tool') assert.equal(kinds.includes('tool_result'), true);
            if (mode === 'snapshot') assert.equal(kinds.includes('directory_snapshot_intent'), true);
            if (mode === 'disabled') assert.equal(target.events.some(event => event.kind === 'message' && event.directoryHistoryDisabled), true);
          } finally { await target.close(); }
        }
      } finally { fs.unlinkSync(storeLock); }
      if (sourceKind === 'direct-unsupported' || sourceKind === 'direct-history-touch' || sourceKind === 'direct-history-external' ||
          sourceKind === 'direct-text-incomplete' || sourceKind === 'direct-text-tool' || sourceKind === 'direct-text-snapshot' || sourceKind === 'direct-text-observer') {
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/); assert.equal(fs.existsSync(`${source.file}.lock`), true);
        const pending = Session.open(root, { id });
        try {
          assert.equal(pending.sessionColor, 'blue'); assert.equal(inspectDirectoryCheckpointWitness(pending, 'resume-writer').kind, 'unknown');
          assert.equal(pending.events.some(event => event.kind === 'title' && event.title === 'retained-title'), true);
          if (sourceKind === 'direct-unsupported' || sourceKind.startsWith('direct-history-')) assert.equal(pending.events.some(event => event.kind === 'file_history'), true);
          if (sourceKind === 'direct-unsupported') assert.equal(pending.events.some(event => event.kind === 'permission_mode_command'), true);
          if (sourceKind === 'direct-text-observer') {
            assert.equal(fs.readFileSync(target, 'utf8'), 'DISPLAY_GETTER_EFFECT');
            assert.ok(pending.agentDisplayObservations.some(row => row.callback === 'progress' &&
              row.transition.phase === 'returned' && row.transition.mode === 'absent'));
          }
          if (sourceKind === 'direct-history-touch') {
            assert.equal(pending.events.some(event => event.kind === 'file_history' && event.path === undefined), true);
            assert.equal(fs.readFileSync(path.join(outside, 'shell-created.txt'), 'utf8'), 'EXTERNAL_CHANGE');
          }
          if (sourceKind === 'direct-history-external')
            assert.equal(pending.events.some(event => event.kind === 'file_history' && event.path === path.relative(root, path.join(outside, 'later-external.txt'))), true);
          assert.equal(pending.events.some(event => event.kind === 'directory_checkpoint_torn_recovery'), false);
        } finally { await pending.close(); }
        continue;
      }
      if (textSuffix) {
        const journal = path.join(directory, `${id}.jsonl`), original = fs.readFileSync(journal);
        const rows = original.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const assistant = rows.findLast(row => row.kind === 'message' && row.message.role === 'assistant'); assert.ok(assistant?.response);
        assistant.response.content[0].text = 'mismatched fixture reply'; fs.writeFileSync(journal, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        try {
          const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
          assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/); assert.equal(fs.existsSync(`${source.file}.lock`), true);
        } finally { fs.writeFileSync(journal, original); }
      }
      if (sourceKind === 'direct-suffix' || sourceKind === 'direct-title' || textSuffix || sourceKind === 'direct-history-tracked') {
        const targetJournal = path.join(directory, `${id}.jsonl`), originalJournal = fs.readFileSync(targetJournal);
        const preload = path.join(root, 'suffix-tamper-preload.mjs');
        const originalField = sourceKind === 'direct-history-tracked' ? '"path":"later-workspace.txt"' :
          textSuffix ? '"humanText":"ordinary later text"' :
          sourceKind === 'direct-title' ? '"title":"retained-title"' : '"color":"blue"';
        const alteredField = sourceKind === 'direct-history-tracked' ? '"path":"changed-workspace.txt"' :
          textSuffix ? '"humanText":"changed later text"' :
          sourceKind === 'direct-title' ? '"title":"changed-title"' : '"color":"green"';
        fs.writeFileSync(preload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),append=Session.prototype.append;
          Session.prototype.append=function(event,...args){if(event.kind==='directory_checkpoint_torn_recovery'){
            const text=fs.readFileSync(this.file,'utf8'),changed=text.replace(${JSON.stringify(originalField)},${JSON.stringify(alteredField)});if(changed===text)throw Error('suffix not found');
            fs.writeFileSync(this.file,changed)}return append.call(this,event,...args)};`);
        try {
          const denied = resume(preload); assert.notEqual(denied.status, 0); assert.match(denied.stderr, /Torn checkpoint recovery authorization invalid/);
          const rows = fs.readFileSync(targetJournal, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
          assert.equal(rows.some(row => row.kind === 'directory_checkpoint_torn_recovery'), false);
        } finally { fs.writeFileSync(targetJournal, originalJournal); }
      }
    }
    if (sourceKind === 'direct') {
      const storeLock = path.join(directory, 'checkpoints', 'lock'), storeMarker = path.join(root, 'store-lock-stopped');
      const holderCode = `import fs from 'node:fs';import {randomUUID} from 'node:crypto';const [file,marker]=process.argv.slice(1),fd=fs.openSync(file,'wx',0o600);
        fs.writeFileSync(fd,JSON.stringify({pid:process.pid,token:randomUUID()}));fs.fsyncSync(fd);fs.closeSync(fd);
        fs.writeFileSync(marker,'ready');process.kill(process.pid,'SIGSTOP');fs.unlinkSync(file);`;
      const holder = spawn(process.execPath, ['--input-type=module', '-e', holderCode, storeLock, storeMarker],
        { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
      let holderErrors = ''; holder.stderr!.on('data', chunk => { holderErrors += String(chunk); });
      const holderExit = new Promise<void>((resolve, reject) => { holder.once('error', reject); holder.once('exit', () => resolve()); });
      try {
        const deadline = Date.now() + 10000;
        while (!fs.existsSync(storeMarker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(holder.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
          assert.ok(Date.now() < deadline && holder.exitCode === null && holder.signalCode === null, holderErrors);
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        assert.equal(fs.existsSync(path.join(directory, 'checkpoints', 'transaction.json')), false);
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/);
        assert.equal(fs.existsSync(`${source.file}.lock`), true); assert.equal(fs.existsSync(storeLock), true);
      } finally {
        if (holder.exitCode === null && holder.signalCode === null) { holder.kill('SIGCONT'); await holderExit; }
      }
      assert.equal(holder.exitCode, 0, holderErrors); assert.equal(fs.existsSync(storeLock), false);
      const denied = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--resume', id,
        '--recover-lock', '--resident-worker', '--no-inherit-gateway'],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, env: { ...process.env, HOME: userDir, LLM_API_KEY: '' } });
      assert.notEqual(denied.status, 0); assert.match(denied.stderr, /Resident worker requires pinned/);
      assert.equal(fs.existsSync(path.join(directory, `${sourceId}.jsonl.lock`)), true);
      const deniedTarget = Session.open(root, { id });
      try { assert.equal(deniedTarget.events.some(event => event.kind === 'directory_checkpoint_torn_recovery'), false); }
      finally { await deniedTarget.close(); }
      const noCredential = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--resume', id,
        '--recover-lock', '--no-inherit-gateway', 'fixture task'],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 15000, env: { ...process.env, HOME: userDir, LLM_API_KEY: '' } });
      assert.notEqual(noCredential.status, 0); assert.match(noCredential.stderr, /Set LLM_API_KEY/);
      assert.equal(fs.existsSync(path.join(directory, `${sourceId}.jsonl.lock`)), true);
      const unconfigured = Session.open(root, { id });
      try { assert.equal(unconfigured.events.some(event => event.kind === 'directory_checkpoint_torn_recovery'), false); }
      finally { await unconfigured.close(); }
      const liveSource = Session.open(root, { id: sourceId, recoverLock: true });
      try {
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/);
        assert.equal(fs.existsSync(`${liveSource.file}.lock`), true);
        const pending = Session.open(root, { id });
        try { assert.equal(inspectDirectoryCheckpointWitness(pending, 'resume-writer').kind, 'unknown'); }
        finally { await pending.close(); }
      } finally { await liveSource.close(); }
      const sourceFile = path.join(directory, `${sourceId}.jsonl`), sourceBytes = fs.readFileSync(sourceFile);
      const sourceGate = `${sourceFile}.lock.gate`, heldGate = `${sourceGate}.fixture-held`; fs.renameSync(sourceGate, heldGate);
      try {
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/); assert.equal(fs.existsSync(sourceGate), false);
        assert.deepEqual(fs.readFileSync(sourceFile), sourceBytes);
      } finally { if (fs.existsSync(sourceGate)) fs.unlinkSync(sourceGate); fs.renameSync(heldGate, sourceGate); }
      const transaction = path.join(directory, 'checkpoints', 'transaction.json'); assert.equal(fs.existsSync(transaction), false);
      fs.writeFileSync(transaction, '{}', { mode: 0o600 });
      try {
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/); assert.equal(fs.readFileSync(transaction, 'utf8'), '{}');
      } finally { fs.unlinkSync(transaction); }
      const incomplete = Buffer.concat([sourceBytes, Buffer.from('{')]); fs.writeFileSync(sourceFile, incomplete);
      try {
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/);
        assert.deepEqual(fs.readFileSync(sourceFile), incomplete);
        assert.equal(fs.readdirSync(directory).some(name => name.startsWith(`${sourceId}.jsonl.torn-`)), false);
      } finally { fs.writeFileSync(sourceFile, sourceBytes); }
      const retainedName = fs.readdirSync(directory).find(name => name.startsWith(`${id}.jsonl.torn-`)); assert.ok(retainedName);
      const retained = path.join(directory, retainedName), altered = Buffer.from(tornOriginal); altered[altered.length - 1] ^= 1;
      fs.writeFileSync(retained, altered);
      try {
        const blocked = resume(); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
        assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/);
        assert.deepEqual(fs.readFileSync(retained), altered); assert.deepEqual(fs.readFileSync(sourceFile), sourceBytes);
      } finally { fs.writeFileSync(retained, tornOriginal); }
    }
    let contenderPreload: string | undefined, contenderResult: string | undefined;
    if (sourceKind === 'direct') {
      contenderPreload = path.join(root, 'checkpoint-contender-preload.mjs'); contenderResult = path.join(root, 'checkpoint-contender-result.json');
      const contender = `import {restoreCheckpoint} from ${JSON.stringify(new URL('../dist/checkpoints.js', import.meta.url).href)};
        try{restoreCheckpoint({name:'resume-writer',expected_current_digest:'0'.repeat(64),dry_run:false},
          {workspace:process.argv[1],signal:new AbortController().signal,maxOutputBytes:24000,allowShell:false})}
        catch(error){process.stderr.write(String(error));process.exitCode=23}`;
      fs.writeFileSync(contenderPreload, `import fs from 'node:fs';import {spawnSync} from 'node:child_process';
        const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),append=Session.prototype.append;
        Session.prototype.append=function(event,...args){if(event.kind==='directory_checkpoint_torn_recovery'){
          const child=spawnSync(process.execPath,['--input-type=module','-e',${JSON.stringify(contender)},${JSON.stringify(root)}],
            {encoding:'utf8',timeout:10000,env:{...process.env,NODE_OPTIONS:''}});
          fs.writeFileSync(${JSON.stringify(contenderResult)},JSON.stringify({status:child.status,stderr:child.stderr}))}
          return append.call(this,event,...args)};`);
    }
    const cli = resume(contenderPreload); assert.equal(cli.status, 0, cli.stderr + cli.stdout);
    assert.match(cli.stderr, /Checkpoint witness reconciled/);
    if (contenderResult) {
      const contender = JSON.parse(fs.readFileSync(contenderResult, 'utf8'));
      assert.equal(contender.status, 23, contender.stderr); assert.match(contender.stderr, /Checkpoint owner is active in process/);
      assert.equal(fs.existsSync(path.join(directory, 'checkpoints', 'transaction.json')), false);
    }
    const tornName = fs.readdirSync(directory).find(name => name.startsWith(`${id}.jsonl.torn-`)); assert.ok(tornName);
    assert.deepEqual(fs.readFileSync(path.join(directory, tornName)), tornOriginal);
    if (priorEvidence) assert.deepEqual(fs.readFileSync(priorEvidence), priorBytes);
    assert.equal(fs.existsSync(path.join(directory, `${sourceId}.jsonl.lock`)), false);
    const again = resume(); assert.equal(again.status, 0, again.stderr + again.stdout);
    assert.doesNotMatch(again.stderr, /Checkpoint witness reconciled/);
    const resumed = Session.open(root, { id });
    try {
      if (sourceKind === 'direct-suffix' || sourceKind === 'direct-title' || sourceKind.startsWith('direct-history-')) assert.equal(resumed.sessionColor, 'blue');
      if (sourceKind === 'direct-title' || sourceKind.startsWith('direct-history-')) assert.equal(resumed.title, 'retained-title');
      if (textSuffix) {
        assert.equal(resumed.messages.some(message => message.role === 'user' && message.content === 'ordinary later text'), true);
        assert.equal(resumed.messages.some(message => message.role === 'user' && message.content === 'second later text'), true);
      }
      if (sourceKind === 'direct-text-disabled')
        assert.equal(resumed.events.some(event => event.kind === 'message' && event.directoryHistoryDisabled), true);
      if (sourceKind.startsWith('direct-history-')) {
        assert.equal(resumed.fileHistory.trackSequence, historySequence);
        assert.equal(resumed.fileHistory.trackedFiles.has('later-workspace.txt'), sourceKind === 'direct-history-tracked');
        if (sourceKind !== 'direct-history-touch') assert.equal(fs.readFileSync(path.join(root, 'later-workspace.txt'), 'utf8'), 'HISTORY_AFTER');
      }
      for (const name of sourceKind.startsWith('post-') ? ['resume-writer', 'resume-writer-post'] : ['resume-writer']) {
        assert.equal(inspectDirectoryCheckpointWitness(resumed, name).kind, 'available');
        assert.equal(readDirectoryCheckpointBackup(resumed, name, target)?.toString(), 'RESUMED_ORIGINAL');
      }
      assert.equal(!!resumed.workingDirectories(false).readHandle?.(outside), false);
      assert.equal(resumed.events.filter(event => event.kind === 'directory_checkpoint_torn_recovery').length, 1);
    } finally { await resumed.close(); }
    const reader = `import {Session} from './dist/session.js';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
      const [root,id,outside,target,name]=process.argv.slice(1),s=Session.open(root,{id});process.stdout.write(JSON.stringify({
        kind:inspectDirectoryCheckpointWitness(s,name).kind,bytes:readDirectoryCheckpointBackup(s,name,target)?.toString()??null,
        grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (const name of sourceKind.startsWith('post-') ? ['resume-writer', 'resume-writer-post'] : ['resume-writer']) for (let i = 0; i < 2; i++) {
      const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, id, outside, target, name],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'RESUMED_ORIGINAL', grant: false });
    }
    if (sourceKind === 'direct-history-tracked') {
      const source = Session.open(root, { id }), child = forkSession(source), childId = child.id;
      try {
        assert.equal(child.fileHistory.trackedFiles.has('later-workspace.txt'), true);
        assert.equal(inspectDirectoryCheckpointWitness(child, 'resume-writer').kind, 'available');
      } finally { await child.close(); await source.close(); }
      const childReader = `import {Session} from './dist/session.js';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
        const [root,id,target]=process.argv.slice(1),s=Session.open(root,{id});process.stdout.write(JSON.stringify({
          kind:inspectDirectoryCheckpointWitness(s,'resume-writer').kind,bytes:readDirectoryCheckpointBackup(s,'resume-writer',target)?.toString()??null,
          tracked:s.fileHistory.trackedFiles.has('later-workspace.txt')}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', childReader, root, childId, target],
          { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'available', bytes: 'RESUMED_ORIGINAL', tracked: true });
      }
    }
    if (sourceKind === 'direct-suffix' || sourceKind === 'direct-title' || textSuffix || sourceKind === 'direct-history-tracked') {
      const journal = path.join(directory, `${id}.jsonl`), original = fs.readFileSync(journal);
      const altered = sourceKind === 'direct-history-tracked' ? original.toString('utf8').replace('"path":"later-workspace.txt"', '"path":"changed-workspace.txt"') :
        textSuffix ? original.toString('utf8').replace('"humanText":"ordinary later text"', '"humanText":"changed later text"') :
        sourceKind === 'direct-title' ? original.toString('utf8').replace('"title":"retained-title"', '"title":"changed-title"') :
        original.toString('utf8').replace('"color":"blue"', '"color":"green"'); assert.notEqual(altered, original.toString('utf8'));
      fs.writeFileSync(journal, altered);
      try {
        const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, id, outside, target, 'resume-writer'],
          { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { kind: 'unknown', bytes: null, grant: false });
      } finally { fs.writeFileSync(journal, original); }
    }
  } finally { if (processOwner.exitCode === null && processOwner.signalCode === null) { processOwner.kill('SIGKILL'); await exited; } }
  }
});

test('CLI restart preserves recovery uncertainty across writer death', { timeout: 120000 }, async t => {
  let ordinaryNonemptyKinds: string[] | undefined;
  for (const scenario of ['write-nonempty-snapshot-cli-async', 'write-nonempty-snapshot-cli', 'write-nonempty-snapshot-runtime-wrapper', 'write-nonempty-snapshot-effect', 'write-nonempty-snapshot-hook', 'write-nonempty-snapshot', 'write-nonempty-snapshot-callback', 'before', 'partial', 'write', 'write-suffix', 'write-title', 'write-text', 'write-text-incomplete', 'write-text-tool',
    'write-text-snapshot', 'write-text-snapshot-repeated', 'write-text-snapshot-corrupt', 'write-text-snapshot-missing', 'write-text-snapshot-pending', 'write-text-snapshot-cleanup-death', 'write-text-disabled',
    'write-history', 'write-history-tracked', 'write-history-touch', 'write-history-external', 'write-unsupported', 'write-after-suffix', 'partial-after-suffix',
    'write-after-text', 'partial-after-text', 'after', 'write-live', 'write-replaced', 'write-cleanup-failure', 'write-cleanup-death',
    'before-store-release-failure', 'write-store-release-failure'] as const) {
    const phase = scenario.startsWith('write-') ? 'write' : scenario === 'before-store-release-failure' ? 'before' :
      scenario === 'partial-after-suffix' || scenario === 'partial-after-text' ? 'partial' : scenario;
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'resume-recovery-stopped');
    const userDir = path.join(root, 'fixture-user'), tools = createTools(), directory = path.join(root, '.agent');
    const asyncHook = path.join(root, 'async-failure-hook.mjs'), asyncRelease = path.join(root, 'async-hook-release');
    const hiddenEffect = path.join(root, 'hidden-tool-effect');
    fs.mkdirSync(userDir); fs.writeFileSync(target, 'RECOVERY_WRITER_ORIGINAL');
    if (scenario === 'write-nonempty-snapshot-cli-async') fs.writeFileSync(asyncHook, `import fs from 'node:fs';let data='';
      for await(const chunk of process.stdin)data+=chunk;if(JSON.parse(data).tool_use_id==='later-track'){
        const deadline=Date.now()+10000;while(!fs.existsSync(${JSON.stringify(asyncRelease)})&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
        if(!fs.existsSync(${JSON.stringify(asyncRelease)}))throw Error('tool result not committed');
        fs.writeFileSync(${JSON.stringify(hiddenEffect)},'ASYNC_HOOK_AFTER_RESULT')}`);
    const source = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] },
      ...(scenario === 'write-nonempty-snapshot-cli-async' ? { hooks: { PostToolUseFailure: [{ command: `${shellQuote(process.execPath)} ${shellQuote(asyncHook)}`, async: true }] } } : {}),
      ...(scenario === 'write-history-tracked' ? { automaticCheckpoints: true } : {}) }) });
    source.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(source, new ScriptedProvider([response([call('track-recovery-writer', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
    const captured = await checkpointConversationWithDirectoryWitness(source, 'resume-recovery', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    const write = fs.writeSync; let id = '';
    try {
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); id = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected pre-resume tear');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => forkSession(source), /injected pre-resume tear/);
    } finally { fs.writeSync = write; }
    const targetSession = Session.open(root, { id });
    const tornName = fs.readdirSync(directory).find(name => name.startsWith(`${id}.jsonl.torn-`)); assert.ok(tornName);
    const tornFile = path.join(directory, tornName), originalEvidence = fs.readFileSync(tornFile);
    await targetSession.close(); await source.close();
    const args = ['bin/litcode.mjs', '--workspace', root, '--resume', id, '--interactive', '--no-tui', '--no-inherit-gateway'];
    if (scenario === 'write-after-suffix' || scenario === 'partial-after-suffix' || scenario === 'write-after-text' || scenario === 'partial-after-text') {
      const storeLock = path.join(directory, 'checkpoints', 'lock');
      fs.writeFileSync(storeLock, JSON.stringify({ pid: process.pid, token: randomUUID() }), { flag: 'wx', mode: 0o600 });
      try {
        const blocked = childProcess.spawnSync(process.execPath, [...args, '--recover-lock'], { cwd: process.cwd(), input: '/rename retained-title\n/color blue\n/exit\n',
          encoding: 'utf8', timeout: 15000, env: { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: '' } });
        assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout); assert.doesNotMatch(blocked.stderr, /Checkpoint witness reconciled/);
        const target = Session.open(root, { id });
        try {
          target.touchFile(path.join(root, 'fixture-user', 'tracked')); target.append({ kind: 'session_color', color: 'blue' });
          if (scenario === 'write-after-text' || scenario === 'partial-after-text')
            await new Agent(target, new ScriptedProvider([done()]), tools).run('ordinary later text');
        }
        finally { await target.close(); }
      } finally { fs.unlinkSync(storeLock); }
    }
    const preload = path.join(root, 'resume-recovery-preload.mjs');
    fs.writeFileSync(preload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)});
      const append=Session.prototype.append,write=fs.writeSync,stop=()=>{fs.writeFileSync(${JSON.stringify(marker)},'ready');process.kill(process.pid,'SIGSTOP')};
      Session.prototype.append=function(event,...args){if(event.kind==='directory_checkpoint_torn_recovery'){
        if(${JSON.stringify(phase)}==='before')stop();if(${JSON.stringify(phase)}==='partial'||${JSON.stringify(phase)}==='write')fs.writeSync=function(fd,bytes,offset,length,...rest){
          if(Buffer.isBuffer(bytes)&&bytes.toString().startsWith('{"kind":"directory_checkpoint_torn_recovery"')){
            fs.writeSync=write;const count=${JSON.stringify(phase)}==='partial'?Math.max(1,Math.floor(length/2)):length;
            if(write.call(fs,fd,bytes,offset,count,...rest)!==count)throw Error('recovery barrier short write');stop()}
          return write.call(fs,fd,bytes,offset,length,...rest)};
        const result=append.call(this,event,...args);if(${JSON.stringify(phase)}==='after')stop();return result}return append.call(this,event,...args)};`);
    const env = { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: `--import=${preload}` };
    const processOwner = spawn(process.execPath, args, { cwd: process.cwd(), env, stdio: ['pipe', 'ignore', 'pipe'] });
    processOwner.stdin!.end('/exit\n'); let errors = ''; processOwner.stderr!.on('data', chunk => { errors += String(chunk); });
    const exited = new Promise<void>((resolve, reject) => { processOwner.once('error', reject); processOwner.once('exit', () => resolve()); });
    try {
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(processOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
        assert.ok(Date.now() < deadline && processOwner.exitCode === null && processOwner.signalCode === null, errors);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      processOwner.kill('SIGKILL'); await exited; assert.deepEqual(fs.readFileSync(tornFile), originalEvidence);
      const retry = (recover: boolean) => childProcess.spawnSync(process.execPath, [...args, ...(recover ? ['--recover-lock'] : [])],
        { cwd: process.cwd(), input: '/exit\n', encoding: 'utf8', timeout: 15000,
          env: { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: '' } });
      if (scenario === 'write') {
        const target = Session.open(root, { id, recoverLock: true }); await target.close();
        const storeLock = path.join(directory, 'checkpoints', 'lock'), heldStoreLock = `${storeLock}.fixture-held`;
        const sourceLock = `${source.file}.lock`, sourceLockBytes = fs.readFileSync(sourceLock);
        fs.renameSync(storeLock, heldStoreLock);
        fs.writeFileSync(storeLock, JSON.stringify({ pid: process.pid, token: randomUUID() }), { flag: 'wx', mode: 0o600 });
        try {
          const blocked = retry(true); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
          assert.doesNotMatch(blocked.stderr, /Checkpoint recovery source lock reclaimed/);
          assert.deepEqual(fs.readFileSync(sourceLock), sourceLockBytes); assert.equal(fs.existsSync(storeLock), true);
        } finally { fs.unlinkSync(storeLock); fs.renameSync(heldStoreLock, storeLock); }
        const noRecovery = retry(false); assert.equal(noRecovery.status, 0, noRecovery.stderr + noRecovery.stdout);
        assert.equal(fs.existsSync(`${source.file}.lock`), true);
        fs.writeFileSync(tornFile, 'damaged original torn evidence');
        try {
          const blocked = retry(true); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
          assert.equal(fs.existsSync(`${source.file}.lock`), true);
        } finally { fs.writeFileSync(tornFile, originalEvidence); }
        const journalFile = path.join(directory, `${id}.jsonl`), journalBytes = fs.readFileSync(journalFile);
        const rows = journalBytes.toString('utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const recovered = rows.find(row => row.kind === 'directory_checkpoint_torn_recovery'); assert.ok(recovered?.sourceLock);
        const token = JSON.parse(fs.readFileSync(`${source.file}.lock`, 'utf8')).token;
        assert.equal(JSON.stringify(recovered.sourceLock).includes(token), false);
        delete recovered.sourceLock; fs.writeFileSync(journalFile, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
        try {
          const blocked = retry(true); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
          assert.equal(fs.existsSync(`${source.file}.lock`), true);
        } finally { fs.writeFileSync(journalFile, journalBytes); }
        const lock = `${source.file}.lock`;
        const gate = `${lock}.gate`, held = `${gate}.fixture-held`; fs.renameSync(gate, held); fs.writeFileSync(gate, '', { mode: 0o600 });
        try {
          const blocked = retry(true); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
          assert.equal(fs.existsSync(lock), true);
        } finally { fs.unlinkSync(gate); fs.renameSync(held, gate); }
      }
      if (scenario === 'write-suffix' || scenario === 'write-title' || scenario.startsWith('write-text') || scenario.startsWith('write-nonempty-snapshot') || scenario === 'write-history' || scenario === 'write-history-tracked' || scenario === 'write-history-touch' || scenario === 'write-history-external' || scenario === 'write-unsupported') {
        const storeLock = path.join(directory, 'checkpoints', 'lock'), heldStoreLock = `${storeLock}.fixture-held`;
        const sourceLock = `${source.file}.lock`, sourceLockBytes = fs.readFileSync(sourceLock); fs.renameSync(storeLock, heldStoreLock);
        fs.writeFileSync(storeLock, JSON.stringify({ pid: process.pid, token: randomUUID() }), { flag: 'wx', mode: 0o600 });
        try {
          const input = scenario === 'write-suffix' ? '/color blue\n/exit\n' : '/rename retained-title\n/color blue\n/exit\n';
          const blocked = childProcess.spawnSync(process.execPath, [...args, '--recover-lock'], { cwd: process.cwd(), input,
            encoding: 'utf8', timeout: 15000, env: { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: '' } });
          assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout); assert.doesNotMatch(blocked.stderr, /Checkpoint recovery source lock reclaimed/);
          assert.deepEqual(fs.readFileSync(sourceLock), sourceLockBytes);
          const rows = fs.readFileSync(path.join(directory, `${id}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
          assert.deepEqual(rows.at(-1), { kind: 'session_color', color: 'blue' });
          if (scenario === 'write-history' || scenario === 'write-history-tracked' || scenario === 'write-history-touch' || scenario === 'write-history-external' || scenario === 'write-unsupported') {
            const target = Session.open(root, { id });
            try {
              target.touchFile(scenario === 'write-history-touch' ? undefined : scenario === 'write-history-external' ?
                path.join(outside, 'later-external.txt') : path.join(root, 'fixture-user', 'tracked'));
              assert.equal(target.fileHistory.trackedFiles.has(path.join('fixture-user', 'tracked')), scenario === 'write-history-tracked');
              if (scenario === 'write-unsupported') target.append(permissionModeCommand('permissions', 'ask', 'bypass'));
              target.append({ kind: 'session_color', color: 'blue' });
            }
            finally { await target.close(); }
          }
          if (scenario === 'write-text') {
            const target = Session.open(root, { id }), before = target.events.length;
            try {
              await new Agent(target, new ScriptedProvider([done()]), tools).run('ordinary later text');
              const suffix = target.events.slice(before); t.diagnostic(`completed fact text suffix: ${suffix.map(event => event.kind).join(',')}`);
              assert.equal(suffix.findLast(event => event.kind !== 'agent_display_observer')?.kind, 'turn_end');
              assert.ok(suffix.some(event => event.kind === 'agent_display_observer'));
            } finally { await target.close(); }
          }
          if (scenario === 'write-nonempty-snapshot-cli' || scenario === 'write-nonempty-snapshot-cli-async') {
            const providerPreload = path.join(root, 'nonempty-provider.mjs'), file = path.join(outside, 'value');
            fs.writeFileSync(providerPreload, `import fs from 'node:fs';globalThis.fetch=()=>{throw Error('fixture network disabled')};
              const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),append=Session.prototype.append;
              Session.prototype.append=function(event,...args){const result=append.call(this,event,...args);
                if(${JSON.stringify(scenario)}==='write-nonempty-snapshot-cli-async'&&event.kind==='tool_result'&&event.result.tool_use_id==='later-track')fs.writeFileSync(${JSON.stringify(asyncRelease)},'ready');return result};
              const {GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let calls=0;
              GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async(_request,_signal,onText)=>{
                const first=calls++===0,content=first?[{type:'tool_use',id:'later-track',name:'write_file',input:{path:${JSON.stringify(file)},content:'BLOCKED_LATER',overwrite: false}}]:[{type:'text',text:'fixture reply'}];
                if(!first&&${JSON.stringify(scenario)}==='write-nonempty-snapshot-cli-async'){const deadline=Date.now()+10000;
                  while(!fs.existsSync(${JSON.stringify(hiddenEffect)})&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
                  if(!fs.existsSync(${JSON.stringify(hiddenEffect)}))throw Error('async hook effect missing')}
                if(!first)onText?.('fixture reply');return{id:'fixture',model:'fixture',type:'message',role:'assistant',content,
                  stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
            const continued = childProcess.spawnSync(process.execPath, [...args, '--recover-lock'], { cwd: process.cwd(),
              input: `/add-dir ${outside}\ntrack later external file\nsnapshot later tracked file\n/exit\n`, encoding: 'utf8', timeout: 20000,
              env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${providerPreload}` } });
            assert.equal(continued.status, 0, continued.stderr + continued.stdout);
            assert.doesNotMatch(continued.stderr, /Checkpoint recovery source lock reclaimed/);
            assert.deepEqual(fs.readFileSync(sourceLock), sourceLockBytes);
          }
          if (scenario.startsWith('write-nonempty-snapshot')) {
            const target = Session.open(root, { id }), before = scenario.startsWith('write-nonempty-snapshot-cli') ? rows.length : target.events.length;
            const file = path.join(outside, 'value');
            try {
              if (!scenario.startsWith('write-nonempty-snapshot-cli')) {
                target.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
                if (scenario === 'write-nonempty-snapshot-hook') target.config.hooks = { ...target.config.hooks,
                  PostToolUseFailure: [{ command: `printf '%s' HOOK_EFFECT > ${shellQuote(hiddenEffect)}` }] };
                const fixtureTools = scenario === 'write-nonempty-snapshot-runtime-wrapper' ? tools.map(tool => tool.schema.name !== 'write_file' ? tool :
                  bindRuntimeTool(tool, { checkScope() {}, refresh() { fs.writeFileSync(hiddenEffect, 'WRAPPER_REFRESH_EFFECT'); }, checkJournal() {} })) :
                  scenario === 'write-nonempty-snapshot-callback' ? tools.map(tool => tool.schema.name !== 'write_file' ? tool :
                    bindRuntimeTool(tool, { checkScope() {}, refresh() {}, checkJournal() {} })) :
                  scenario === 'write-nonempty-snapshot-effect' ? tools.map(tool => tool.schema.name !== 'write_file' ? tool : {
                  ...tool, execute: async (input: unknown, context: Parameters<typeof tool.execute>[1]) => {
                    try { return await tool.execute(input, context); }
                    catch (error) { fs.writeFileSync(hiddenEffect, 'EFFECT_AFTER_BLOCK'); throw error; }
                  },
                }) : tools;
                await new Agent(target, new ScriptedProvider([response([call('later-track', 'write_file',
                  { path: file, content: 'BLOCKED_LATER', overwrite: false })], 'tool_use'), done()]), fixtureTools,
                  scenario === 'write-nonempty-snapshot-callback' ? { toolResult(result) {
                    if (result.id !== 'later-track') return;
                    const last = target.events.at(-1);
                    assert.ok(last?.kind === 'tool_result_observer' && last.toolUseId === result.id && last.transition.phase === 'admitted');
                    const committed = target.events[last.resultIndex];
                    assert.ok(committed?.kind === 'tool_result' && committed.result.tool_use_id === result.id);
                    fs.writeFileSync(hiddenEffect, 'RESULT_CALLBACK_AFTER_SYNC');
                  } } : {}).run('track later external file');
                await new Agent(target, new ScriptedProvider([done()]), tools).run('snapshot later tracked file');
              }
              const kinds = target.events.slice(before).map(event => event.kind);
              t.diagnostic(`completed fact nonempty snapshot suffix: ${kinds.join(',')}`);
              if (scenario === 'write-nonempty-snapshot') ordinaryNonemptyKinds = kinds;
              if (scenario === 'write-nonempty-snapshot-callback') {
                assert.deepEqual(kinds.filter(kind => kind !== 'runtime_wrapper_observer'), ordinaryNonemptyKinds);
                assert.deepEqual(target.runtimeWrapperObservations.map(row => [row.event.stage, row.state]),
                  [['checkScope', 'sync_returned'], ['refresh', 'sync_returned'], ['checkJournal', 'sync_returned']]);
                assert.equal(target.toolResultObservations.at(-1)?.state, 'sync_returned');
              }
              if (scenario === 'write-nonempty-snapshot') assert.equal(target.toolResultObservations.at(-1)?.state, 'absent');
              const effect = target.events.findLast(event => event.kind === 'tool_effect' && event.result.tool_use_id === 'later-track');
              assert.ok(effect && effect.kind === 'tool_effect');
              assert.equal(effect.result.is_error, true);
              assert.equal(effect.result.content, `write_file: file already exists (pass overwrite: true): ${file}`);
              assert.equal(fs.existsSync(hiddenEffect), scenario === 'write-nonempty-snapshot-effect' || scenario === 'write-nonempty-snapshot-runtime-wrapper' ||
                scenario === 'write-nonempty-snapshot-hook' || scenario === 'write-nonempty-snapshot-cli-async' || scenario === 'write-nonempty-snapshot-callback');
              if (scenario === 'write-nonempty-snapshot-runtime-wrapper') assert.equal(fs.readFileSync(hiddenEffect, 'utf8'), 'WRAPPER_REFRESH_EFFECT');
              if (scenario === 'write-nonempty-snapshot-callback') assert.equal(fs.readFileSync(hiddenEffect, 'utf8'), 'RESULT_CALLBACK_AFTER_SYNC');
              if (scenario === 'write-nonempty-snapshot-hook' || scenario === 'write-nonempty-snapshot-cli-async') {
                assert.equal(fs.readFileSync(hiddenEffect, 'utf8'), scenario === 'write-nonempty-snapshot-hook' ? 'HOOK_EFFECT' : 'ASYNC_HOOK_AFTER_RESULT');
                assert.equal(target.events.some(event => event.kind === 'hook_start' && event.event === 'PostToolUseFailure'), true);
                assert.equal(target.events.some(event => event.kind === 'hook_result' && event.event === 'PostToolUseFailure'), true);
              }
              assert.equal(fs.readFileSync(file, 'utf8'), 'RECOVERY_WRITER_ORIGINAL');
              const history = target.directoryFileHistory; assert.equal(history.kind, 'available');
              if (history.kind !== 'available') throw new Error('directory history unavailable');
              const entry = history.snapshots.at(-1)?.entries.find(item => item.path.lexicalPath === file);
              assert.equal(entry?.reference.kind, 'present');
              if (entry?.reference.kind === 'present')
                assert.equal(target.readDirectoryHistoryBackup(entry.reference.backupId)?.bytes.toString(), 'RECOVERY_WRITER_ORIGINAL');
            } finally { await target.close(); }
          }
          if (scenario === 'write-text-incomplete' || scenario === 'write-text-tool' || scenario.startsWith('write-text-snapshot') || scenario === 'write-text-disabled') {
            const target = Session.open(root, { id });
            try {
              const mode = scenario === 'write-text-incomplete' ? 'incomplete' : scenario === 'write-text-tool' ? 'tool' : scenario.startsWith('write-text-snapshot') ? 'snapshot' : 'disabled';
              const kinds = await appendLaterTextFixture(target, tools, outside, mode);
              if (mode === 'incomplete') assert.deepEqual(kinds, ['message']);
              if (mode === 'tool') assert.equal(kinds.includes('tool_result'), true);
              if (mode === 'snapshot') {
                t.diagnostic(`completed fact snapshot suffix: ${kinds.join(',')}`);
                assert.deepEqual(kinds.filter(kind => kind !== 'agent_display_observer'),
                  ['message', 'directory_snapshot_intent', 'directory_snapshot', 'message', 'turn_end']);
                if (scenario === 'write-text-snapshot-repeated') await new Agent(target, new ScriptedProvider([done()]), tools).run('second snapshot text');
                const history = target.directoryFileHistory; assert.equal(history.kind, 'available');
                if (history.kind === 'available') {
                  assert.deepEqual(history.snapshots.at(-1)?.entries, []);
                  assert.equal(history.snapshots.length, scenario === 'write-text-snapshot-repeated' ? 2 : 1);
                }
              }
              if (mode === 'disabled') assert.equal(target.events.some(event => event.kind === 'message' && event.directoryHistoryDisabled), true);
            } finally { await target.close(); }
          }
        } finally { fs.unlinkSync(storeLock); fs.renameSync(heldStoreLock, storeLock); }
      }
      if (scenario === 'write-live') {
        const lock = `${source.file}.lock`, live = JSON.parse(fs.readFileSync(lock, 'utf8')); live.pid = process.pid;
        fs.writeFileSync(lock, JSON.stringify(live));
      }
      if (scenario === 'write-replaced') {
        const lock = `${source.file}.lock`, bytes = fs.readFileSync(lock);
        fs.renameSync(lock, `${lock}.fixture-held`); fs.writeFileSync(lock, bytes, { mode: 0o600 });
      }
      if (scenario === 'write-text-snapshot-repeated' || scenario === 'write-text-snapshot-corrupt' || scenario === 'write-text-snapshot-missing' || scenario === 'write-text-snapshot-pending') {
        const journal = path.join(directory, `${id}.jsonl`), rows = fs.readFileSync(journal, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const snapshot = scenario === 'write-text-snapshot-repeated' ? rows.find(row => row.kind === 'directory_snapshot') :
          rows.findLast(row => row.kind === 'directory_snapshot'); assert.ok(snapshot?.id);
        const receipt = `${journal}.snapshot-commit-receipt-${snapshot.id}`, held = `${receipt}.fixture-held`;
        const pending = `${journal}.snapshot-commit-pending-${snapshot.id}`, original = fs.readFileSync(receipt), sourceLock = `${source.file}.lock`;
        const sourceLockBytes = fs.readFileSync(sourceLock);
        if (scenario === 'write-text-snapshot-corrupt' || scenario === 'write-text-snapshot-repeated') fs.writeFileSync(receipt, '{}');
        else if (scenario === 'write-text-snapshot-missing') fs.renameSync(receipt, held);
        else fs.writeFileSync(pending, '{}', { flag: 'wx', mode: 0o600 });
        try {
          const blocked = retry(true); assert.equal(blocked.status, 0, blocked.stderr + blocked.stdout);
          assert.doesNotMatch(blocked.stderr, /Checkpoint recovery source lock reclaimed/);
          assert.deepEqual(fs.readFileSync(sourceLock), sourceLockBytes);
          const target = Session.open(root, { id });
          try { assert.equal(target.directoryFileHistory.kind, 'unknown'); }
          finally { await target.close(); }
        } finally {
          if (scenario === 'write-text-snapshot-corrupt' || scenario === 'write-text-snapshot-repeated') fs.writeFileSync(receipt, original);
          else if (scenario === 'write-text-snapshot-missing') fs.renameSync(held, receipt);
          else fs.unlinkSync(pending);
        }
      }
      if (scenario === 'write-cleanup-failure') {
        const cleanupPreload = path.join(root, 'source-close-failure.mjs');
        fs.writeFileSync(cleanupPreload, `const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),close=Session.prototype.close;
          Session.prototype.close=function(){if(this.id===${JSON.stringify(source.id)})throw Error('injected source close failure');return close.call(this)};`);
        const failed = childProcess.spawnSync(process.execPath, [...args, '--recover-lock'], { cwd: process.cwd(), input: '/exit\n', encoding: 'utf8',
          timeout: 15000, env: { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: `--import=${cleanupPreload}` } });
        assert.notEqual(failed.status, 0); assert.match(failed.stderr, /injected source close failure/);
        assert.equal(fs.existsSync(`${source.file}.lock`), true);
      }
      if (scenario === 'write-cleanup-death' || scenario === 'write-text-snapshot-cleanup-death') {
        const cleanupMarker = path.join(root, 'source-close-stopped'), cleanupPreload = path.join(root, 'source-close-stop.mjs');
        fs.writeFileSync(cleanupPreload, `import fs from 'node:fs';const {Session}=await import(${JSON.stringify(new URL('../dist/session.js', import.meta.url).href)}),close=Session.prototype.close;
          Session.prototype.close=function(){if(this.id===${JSON.stringify(source.id)}){fs.writeFileSync(${JSON.stringify(cleanupMarker)},'ready');process.kill(process.pid,'SIGSTOP')}
            return close.call(this)};`);
        const cleanupOwner = spawn(process.execPath, [...args, '--recover-lock'], { cwd: process.cwd(), stdio: ['pipe', 'ignore', 'pipe'],
          env: { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: `--import=${cleanupPreload}` } });
        cleanupOwner.stdin!.end('/exit\n'); let cleanupErrors = ''; cleanupOwner.stderr!.on('data', chunk => { cleanupErrors += String(chunk); });
        const cleanupExit = new Promise<void>((resolve, reject) => { cleanupOwner.once('error', reject); cleanupOwner.once('exit', () => resolve()); });
        try {
          const deadline = Date.now() + 10000;
          while (!fs.existsSync(cleanupMarker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(cleanupOwner.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
            assert.ok(Date.now() < deadline && cleanupOwner.exitCode === null && cleanupOwner.signalCode === null, cleanupErrors);
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          cleanupOwner.kill('SIGKILL'); await cleanupExit; assert.equal(fs.existsSync(`${source.file}.lock`), true);
        } finally { if (cleanupOwner.exitCode === null && cleanupOwner.signalCode === null) { cleanupOwner.kill('SIGKILL'); await cleanupExit; } }
      }
      if (scenario === 'before-store-release-failure' || scenario === 'write-store-release-failure') {
        const storeLock = path.join(directory, 'checkpoints', 'lock'), cleanupPreload = path.join(root, 'store-close-failure.mjs');
        fs.writeFileSync(cleanupPreload, `import fs from 'node:fs';const unlink=fs.unlinkSync;
          fs.unlinkSync=function(file,...args){if(file===${JSON.stringify(storeLock)}&&JSON.parse(fs.readFileSync(file,'utf8')).pid===process.pid)
            throw Error('injected checkpoint store lock cleanup failure');return unlink.call(fs,file,...args)};`);
        const failed = childProcess.spawnSync(process.execPath, [...args, '--recover-lock'], { cwd: process.cwd(), input: '/exit\n', encoding: 'utf8',
          timeout: 15000, env: { ...process.env, HOME: userDir, LLM_API_KEY: '', NODE_OPTIONS: `--import=${cleanupPreload}` } });
        assert.notEqual(failed.status, 0); assert.match(failed.stderr, /injected checkpoint store lock cleanup failure/);
        assert.equal(fs.existsSync(storeLock), true); assert.equal(fs.existsSync(`${source.file}.lock`), false);
        const rows = fs.readFileSync(path.join(directory, `${id}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        assert.equal(rows.filter(row => row.kind === 'directory_checkpoint_torn_recovery').length, 1);
      }
      const retried = retry(true);
      assert.equal(retried.status, 0, retried.stderr + retried.stdout);
      const nonemptyProbe = (scenario === 'write-nonempty-snapshot' || scenario === 'write-nonempty-snapshot-cli') &&
        process.env.W385_NONEMPTY_SNAPSHOT_PROBE === '1';
      if (scenario === 'write' || scenario === 'write-suffix' || scenario === 'write-title' || scenario === 'write-text' || scenario === 'write-text-disabled' || nonemptyProbe ||
          (scenario.startsWith('write-text-snapshot') && scenario !== 'write-text-snapshot-cleanup-death') || scenario === 'write-history' || scenario === 'write-history-tracked' || scenario === 'write-after-suffix' || scenario === 'write-after-text' || scenario === 'after') assert.match(retried.stderr, /Checkpoint recovery source lock reclaimed/);
      else assert.doesNotMatch(retried.stderr, /Checkpoint recovery source lock reclaimed/);
      assert.equal(fs.existsSync(`${source.file}.lock`), phase === 'partial' || (scenario.startsWith('write-nonempty-snapshot') && !nonemptyProbe) || (scenario.startsWith('write-text-') && scenario !== 'write-text-disabled' &&
        (!scenario.startsWith('write-text-snapshot') || scenario === 'write-text-snapshot-cleanup-death')) || scenario === 'write-unsupported' || scenario === 'write-history-touch' || scenario === 'write-history-external' || scenario === 'write-live' || scenario === 'write-replaced' ||
        scenario === 'write-cleanup-failure' || scenario === 'write-cleanup-death');
      if (scenario === 'write-history-tracked') {
        const reopened = Session.open(root, { id });
        try { assert.equal(reopened.fileHistory.trackedFiles.has(path.join('fixture-user', 'tracked')), true); }
        finally { await reopened.close(); }
      }
      const reader = `import {Session} from './dist/session.js';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
        const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id});process.stdout.write(JSON.stringify({
          kind:inspectDirectoryCheckpointWitness(s,'resume-recovery').kind,bytes:readDirectoryCheckpointBackup(s,'resume-recovery',target)?.toString()??null,
          grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, id, outside, target],
          { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), {
          kind: phase === 'partial' ? 'unknown' : 'available', bytes: phase === 'partial' ? null : 'RECOVERY_WRITER_ORIGINAL', grant: false });
      }
      if (scenario.startsWith('write-nonempty-snapshot')) {
        const snapshotReader = `import {Session} from './dist/session.js';const [root,id,outside,file]=process.argv.slice(1),s=Session.open(root,{id}),history=s.directoryFileHistory;
          const ref=history.kind==='available'?history.snapshots.at(-1)?.entries.find(entry=>entry.path.lexicalPath===file)?.reference:undefined;
          process.stdout.write(JSON.stringify({history:history.kind,kind:ref?.kind??null,bytes:ref?.kind==='present'?s.readDirectoryHistoryBackup(ref.backupId)?.bytes.toString():null,
            grant:!!s.workingDirectories(false).readHandle?.(outside),hookConfigured:!!s.config.hooks?.PostToolUseFailure?.length}));await s.close();`;
        for (let i = 0; i < 2; i++) {
          const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', snapshotReader, root, id, outside, target],
            { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
          assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), {
            history: 'available', kind: 'present', bytes: 'RECOVERY_WRITER_ORIGINAL', grant: false,
            hookConfigured: scenario === 'write-nonempty-snapshot-cli-async' });
        }
      }
      if (scenario.startsWith('write-text-snapshot')) {
        const snapshotReader = `import {Session} from './dist/session.js';const [root,id,outside]=process.argv.slice(1),s=Session.open(root,{id}),history=s.directoryFileHistory;
          process.stdout.write(JSON.stringify({kind:history.kind,entries:history.kind==='available'?history.snapshots.at(-1)?.entries:null,
            count:history.kind==='available'?history.snapshots.length:null,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
        for (let i = 0; i < 2; i++) {
          const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', snapshotReader, root, id, outside],
            { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
          assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), {
            kind: 'available', entries: [], count: scenario === 'write-text-snapshot-repeated' ? 2 : 1, grant: false });
        }
      }
      assert.deepEqual(fs.readFileSync(tornFile), originalEvidence);
      const rows = fs.readFileSync(path.join(directory, `${id}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
      assert.equal(rows.filter(row => row.kind === 'directory_checkpoint_torn_recovery').length, phase === 'partial' ? 0 : 1);
      if (scenario === 'write-suffix' || scenario === 'write-title' || scenario === 'write-history' || scenario === 'write-history-tracked' || scenario === 'write-history-touch' || scenario === 'write-history-external' || scenario === 'write-unsupported' || scenario === 'write-after-suffix' || scenario === 'partial-after-suffix')
        assert.equal(rows.some(row => row.kind === 'session_color' && row.color === 'blue'), true);
      if (scenario === 'write-title' || scenario === 'write-history' || scenario === 'write-history-tracked' || scenario === 'write-history-touch' || scenario === 'write-history-external' || scenario === 'write-unsupported' || scenario === 'write-after-suffix' || scenario === 'partial-after-suffix')
        assert.equal(rows.some(row => row.kind === 'title' && row.title === 'retained-title'), true);
      if (scenario === 'write-history' || scenario === 'write-history-tracked' || scenario === 'write-history-touch' || scenario === 'write-history-external' || scenario === 'write-unsupported' || scenario === 'write-after-suffix' || scenario === 'partial-after-suffix')
        assert.equal(rows.some(row => row.kind === 'file_history'), true);
      if (scenario === 'write-after-text' || scenario === 'partial-after-text') {
        assert.equal(rows.some(row => row.kind === 'file_history'), true);
        assert.equal(rows.some(row => row.kind === 'message' && row.message.role === 'user' && row.message.content === 'ordinary later text'), true);
      }
    } finally { if (processOwner.exitCode === null && processOwner.signalCode === null) { processOwner.kill('SIGKILL'); await exited; } }
  }
});

test('CLI resume preserves a live recovery source lock', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), userDir = path.join(root, 'fixture-user'), tools = createTools();
  fs.mkdirSync(userDir); fs.writeFileSync(target, 'LIVE_RECOVERY_ORIGINAL');
  const source = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const write = fs.writeSync, directory = path.join(root, '.agent'); let id = '';
  try {
    source.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(source, new ScriptedProvider([response([call('track-live-source-lock', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
    const captured = await checkpointConversationWithDirectoryWitness(source, 'live-source-lock', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    try {
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); id = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected live source tear');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => forkSession(source), /injected live source tear/);
    } finally { fs.writeSync = write; }
    const child = Session.open(root, { id });
    try { assert.equal(child.reconcileTornCheckpointInheritance(source).kind, 'reconciled'); }
    finally { await child.close(); }
    const lock = `${source.file}.lock`, before = createHash('sha256').update(fs.readFileSync(lock)).digest('hex');
    const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--resume', id, '--recover-lock',
      '--interactive', '--no-tui', '--no-inherit-gateway'], { cwd: process.cwd(), input: '/exit\n', encoding: 'utf8', timeout: 15000,
        env: { ...process.env, HOME: userDir, LLM_API_KEY: '' } });
    assert.equal(cli.status, 0, cli.stderr + cli.stdout); assert.doesNotMatch(cli.stderr, /Checkpoint recovery source lock reclaimed/);
    assert.equal(createHash('sha256').update(fs.readFileSync(lock)).digest('hex'), before); assert.equal(source.isOpen, true);
    source.checkpointGateIdentity();
    const resumed = Session.open(root, { id });
    try { assert.equal(readDirectoryCheckpointBackup(resumed, 'live-source-lock', target)?.toString(), 'LIVE_RECOVERY_ORIGINAL'); }
    finally { await resumed.close(); }
  } finally { fs.writeSync = write; await source.close(); }
});

test('interactive resume reconciles a torn inheritance from its live source', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools(), input = new PassThrough();
  fs.writeFileSync(target, 'INTERACTIVE_RESUMED_ORIGINAL');
  const signal = new AbortController().signal, provider = new ScriptedProvider([]);
  const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, provider, signal); settings.tools = pinToolSchemas(runtime.tools);
  const source = Session.open(root, { config: settings }), directory = path.join(root, '.agent'), write = fs.writeSync;
  let id = '', status = '', timedOut = false;
  try {
    source.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(source, new ScriptedProvider([response([call('track-interactive-resume', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
    const captured = await checkpointConversationWithDirectoryWitness(source, 'interactive-resume', signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    try {
      fs.writeSync = new Proxy(write, { apply(targetFn, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const opened = fs.fstatSync(fd), file = fs.readdirSync(directory).find(name => name.endsWith('.jsonl') &&
            (() => { const named = fs.lstatSync(path.join(directory, name)); return named.dev === opened.dev && named.ino === opened.ino; })());
          assert.ok(file); id = file.slice(0, -6); fs.writeSync = write;
          Reflect.apply(targetFn, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected interactive resume tear');
        }
        return Reflect.apply(targetFn, thisArg, args);
      } });
      assert.throws(() => forkSession(source), /injected interactive resume tear/);
    } finally { fs.writeSync = write; }
    assert.ok(id);
    const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const errors = new Writable({ write(chunk, _encoding, done) {
      status += String(chunk); if (status.includes('Session resumed.')) setImmediate(() => input.write('/exit\n')); done();
    } });
    const timer = setTimeout(() => { timedOut = true; input.write('/exit\n'); }, 8000);
    try { input.write(`/resume ${id}\n`); await interactiveLoop(source, provider, runtime, { input, output, status: errors, signal }); }
    finally { clearTimeout(timer); }
    assert.equal(timedOut, false, status); assert.match(status, /Checkpoint witness reconciled/); assert.equal(provider.requests.length, 0);
  } finally { fs.writeSync = write; await runtime.close(); await source.close(); input.destroy(); }
  const resumed = Session.open(root, { id });
  try {
    assert.equal(readDirectoryCheckpointBackup(resumed, 'interactive-resume', target)?.toString(), 'INTERACTIVE_RESUMED_ORIGINAL');
    assert.equal(!!resumed.workingDirectories(false).readHandle?.(outside), false);
  } finally { await resumed.close(); }
});

test('interactive handles committed rewind witness failures', { timeout: 45000 }, async () => {
  for (const stage of ['sync', 'torn', 'cleanup-failure', 'pending', 'cancel', 'reopened-close-failure', 'reopened-gate-change'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), local = path.join(root, 'value');
    fs.writeFileSync(target, 'INHERITED_EXTERNAL'); fs.writeFileSync(local, 'BEFORE');
    const controller = new AbortController(), signal = controller.signal, input = new PassThrough(), tools = createTools();
    const provider = new ScriptedProvider([response([call('read-after-inheritance-failure', 'read_file', { path: target })], 'tool_use'),
      () => { setImmediate(() => input.write('/exit\n')); return done(); }]);
    const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } });
    const runtime = await createRuntime(settings, provider, signal); settings.tools = pinToolSchemas(runtime.tools);
    const parent = Session.open(root, { config: settings }), sync = fs.fsyncSync, write = fs.writeSync, open = Session.open, close = Session.prototype.close;
    let reopened: Session | undefined, closeFault = false, changedGate = '', savedLock: Buffer | undefined;
    let injected = false, recoveryAttempts = 0, childId = '', applied = false, regranted = false, continued = false, timedOut = false, text = '', status = '';
    try {
      parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(parent, new ScriptedProvider([response([call('track-inheritance-failure', 'write_file',
        { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
      const captured = await checkpointConversationWithDirectoryWitness(parent, 'inherit-interactive', signal);
      assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
      fs.writeFileSync(local, 'AFTER'); const directory = path.join(root, '.agent');
      const childForFd = (fd: number): string | undefined => {
        const stat = fs.fstatSync(fd);
        for (const name of fs.readdirSync(directory).filter(value => value.endsWith('.jsonl') && value !== `${parent.id}.jsonl`)) {
          const file = path.join(directory, name), named = fs.lstatSync(file);
          if (stat.dev === named.dev && stat.ino === named.ino) return name.slice(0, -6);
        }
      };
      if (stage === 'torn') fs.writeSync = new Proxy(write, { apply(target, thisArg, args) {
        const [fd, bytes, offset, length] = args;
        if (!injected && Buffer.isBuffer(bytes) && bytes.toString('utf8').startsWith('{"kind":"directory_checkpoint_inheritance"')) {
          const id = childForFd(fd); if (!id) throw new Error('inherited witness journal missing');
          injected = true; childId = id; fs.writeSync = write;
          Reflect.apply(target, thisArg, [fd, bytes, offset, Math.max(1, Math.floor(length / 2))]);
          throw new Error('injected inherited witness short write');
        }
        return Reflect.apply(target, thisArg, args);
      } });
      else fs.fsyncSync = (fd: number) => {
        const id = childForFd(fd);
        if (!injected && id && fs.readFileSync(path.join(directory, `${id}.jsonl`), 'utf8').includes('"kind":"directory_checkpoint_inheritance"')) {
          injected = true; childId = id; fs.fsyncSync = sync;
          if (stage === 'pending') fs.writeFileSync(path.join(directory, 'checkpoints/transaction.json'), '{}');
          if (stage === 'cancel') controller.abort();
          throw new Error('injected inherited witness sync failure');
        }
        return sync(fd);
      };
      if (stage === 'cleanup-failure') runtime.closeForHandoff = async () => { throw new Error('injected witness recovery cleanup failure'); };
      if (stage === 'reopened-close-failure' || stage === 'reopened-gate-change') {
        Session.open = (workspace, options) => {
          const candidate = open(workspace, options); if (options.id === childId) reopened = candidate; return candidate;
        };
        if (stage === 'reopened-close-failure') Session.prototype.close = function() {
          if (this === reopened && !closeFault) { closeFault = true; throw new Error('injected reopened Session close failure'); }
          return close.call(this);
        };
        runtime.reconfigure = async () => {
          if (stage === 'reopened-gate-change') {
            if (!reopened) throw new Error('reopened Session missing');
            const lock = `${reopened.file}.lock`; savedLock = fs.readFileSync(lock); changedGate = `${lock}.gate`;
            fs.renameSync(changedGate, `${changedGate}.original-test`); fs.writeFileSync(changedGate, '', { mode: 0o600 });
          }
          throw new Error('injected witness reconfiguration failure');
        };
      }
      if (stage === 'cancel') {
        const reconfigure = runtime.reconfigure!;
        runtime.reconfigure = async config => { recoveryAttempts++; return reconfigure(config); };
      }
      const output = new Writable({ write(chunk, _encoding, callback) {
        text += String(chunk); const token = /Apply: \/rewind 1 --files --apply ([a-f0-9]{64})/.exec(text)?.[1];
        if (token && !applied) { applied = true; setImmediate(() => input.write(`/rewind 1 --files --apply ${token}\n`)); }
        if (text.includes('Rewound files and conversation to turn 1') && !regranted) {
          regranted = true; setImmediate(() => input.write(`/add-dir ${outside}\n`));
        }
        if (regranted && text.includes(`Added ${outside}`) && !continued) {
          continued = true; setImmediate(() => input.write('continue after inheritance failure\n'));
        }
        callback();
      } });
      const errors = new Writable({ write(chunk, _encoding, callback) {
        status += String(chunk); if (status.includes('error: Checkpoint history committed;')) setImmediate(() => input.write('/exit\n'));
        callback();
      } });
      const deadline = setTimeout(() => { timedOut = true; input.write('/exit\n'); }, 10000);
      try {
        input.write('/rewind 1 --files\n');
        await interactiveLoop(parent, provider, runtime, { input, output, status: errors, signal });
        assert.equal(timedOut, false, `${stage}: ${status}`); assert.equal(injected, true); assert.ok(childId);
        assert.equal(fs.readFileSync(local, 'utf8'), 'BEFORE');
        if (stage === 'sync' || stage === 'torn') {
          assert.match(text, /Rewound files and conversation to turn 1/);
          assert.match(text, stage === 'torn' ? /checkpoint witness was reconciled/i : /checkpoint witness.*uncertain/i);
          assert.equal(provider.requests.length, 2); assert.match(JSON.stringify(provider.requests[1]?.messages), /INHERITED_EXTERNAL/);
        } else {
          assert.match(text, new RegExp(`Rewind committed in session ${childId}; checkpoint witness and runtime recovery are uncertain`));
          assert.equal(provider.requests.length, 0);
          if (stage === 'cancel') assert.equal(recoveryAttempts, 0);
          if (stage === 'reopened-close-failure') {
            assert.equal(closeFault, true); assert.match(text, /handoff cleanup is unconfirmed/); assert.ok(reopened?.isOpen);
            assert.throws(() => open(root, { id: childId }), /lock|active|EEXIST/i);
            Session.prototype.close = close; Session.open = open; await reopened.close();
          }
          if (stage === 'reopened-gate-change') {
            assert.match(text, /handoff cleanup is unconfirmed/); assert.ok(reopened && !reopened.isOpen);
            assert.deepEqual(fs.readFileSync(`${reopened.file}.lock`), savedLock);
            fs.unlinkSync(changedGate); fs.renameSync(`${changedGate}.original-test`, changedGate); changedGate = '';
            fs.unlinkSync(`${reopened.file}.lock`); Session.open = open;
          }
        }
      } finally { clearTimeout(deadline); }
      if (stage === 'pending') {
        const pending = path.join(directory, 'checkpoints/transaction.json'); assert.equal(fs.existsSync(pending), true); fs.unlinkSync(pending);
      }
      const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
        const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'inherit-interactive');
        process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,'inherit-interactive',target)?.toString()??null,
          grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
      for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', reader, root, childId, outside, target], { encoding: 'utf8' })),
      { kind: 'available', bytes: 'INHERITED_EXTERNAL', grant: false });
      if (stage === 'torn') assert.ok(fs.readdirSync(directory).some(name => name.startsWith(`${childId}.jsonl.torn-`)));
    } finally { fs.fsyncSync = sync; fs.writeSync = write; Session.open = open; Session.prototype.close = close;
      if (changedGate) { fs.unlinkSync(changedGate); fs.renameSync(`${changedGate}.original-test`, changedGate); }
      await reopened?.close(); await runtime.close(); await parent.close(); input.destroy(); }
  }
});

test('interactive recovers a committed rewind after marker publication fails', { timeout: 90000 }, async () => {
  for (const stage of ['normal', 'file-conflict', 'transaction-change', 'branch-change', 'gate-change', 'torn-evidence',
    'cleanup-failure', 'cancel', 'proof-sync-failure', 'proof-regressed', 'journal-race', 'inode-race', 'gate-race'] as const) {
  const root = workspace(), outside = workspace(), local = path.join(root, 'value'), target = path.join(outside, 'value');
  fs.writeFileSync(local, 'BEFORE'); fs.writeFileSync(target, 'EXTERNAL_BEFORE');
  const controller = new AbortController(), signal = controller.signal, input = new PassThrough(), tools = createTools();
  const provider = new ScriptedProvider([response([call('read-after-marker', 'read_file', { path: target })], 'tool_use'),
    () => { setImmediate(() => input.write('/exit\n')); return done(); }]);
  const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, provider, signal); settings.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(root, { config: settings }), rename = fs.renameSync, sync = fs.fsyncSync, lstat = fs.lstatSync, open = Session.open;
  let injected = false, extraFault = false, childId = '', applied = false, regranted = false, continued = false, timedOut = false, text = '', status = '';
  let pendingBytes = '', gatePath = '', movedJournal = '', stagingFile = '';
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('track-marker', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track external file');
    const captured = await checkpointConversationWithDirectoryWitness(session, 'marker-interactive', signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    fs.writeFileSync(local, 'AFTER');
    const transaction = path.join(root, '.agent/checkpoints/transaction.json');
    fs.renameSync = ((from: fs.PathLike, to: fs.PathLike) => {
      if (!injected && String(to) === transaction) {
        const saved = JSON.parse(fs.readFileSync(from, 'utf8'));
        if (saved.state === 'committed') {
          injected = true; childId = saved.branch.id; fs.renameSync = rename;
          if (stage === 'file-conflict') fs.writeFileSync(local, 'CONCURRENT');
          if (stage === 'transaction-change') {
            const changed = JSON.parse(fs.readFileSync(transaction, 'utf8'));
            changed.operations[0].before.mode ^= 1;
            fs.writeFileSync(transaction, JSON.stringify(changed));
          }
          if (['file-conflict', 'transaction-change', 'branch-change', 'proof-sync-failure', 'proof-regressed'].includes(stage)) {
            const tag = createHash('sha256').update(path.dirname(transaction)).digest('hex').slice(0, 12);
            stagingFile = path.join(root, `.checkpoint-${tag}-00000000-0000-4000-8000-000000000001.tmp`);
            fs.writeFileSync(stagingFile, 'RETAINED_STAGING');
          }
          pendingBytes = fs.readFileSync(transaction, 'utf8');
          if (stage === 'cancel') controller.abort();
          throw new Error('injected committed marker failure');
        }
      }
      return rename(from, to);
    }) as typeof fs.renameSync;
    if (stage === 'cleanup-failure') runtime.closeForHandoff = async () => { throw new Error('injected marker recovery cleanup failure'); };
    if (stage === 'branch-change' || stage === 'gate-change' || stage === 'proof-sync-failure' || stage === 'proof-regressed' || stage === 'torn-evidence') {
      const close = runtime.closeForHandoff!.bind(runtime);
      runtime.closeForHandoff = async () => {
        await close();
        const file = path.join(root, '.agent', `${childId}.jsonl`);
        if (stage === 'branch-change') { fs.appendFileSync(file, '{"kind":"title","title":"intervening"}\n'); extraFault = true; }
        if (stage === 'torn-evidence') { fs.writeFileSync(`${file}.torn-owned-test`, 'retained'); extraFault = true; }
        if (stage === 'gate-change') {
          gatePath = `${file}.lock.gate`; fs.renameSync(gatePath, `${gatePath}.original-test`);
          fs.writeFileSync(gatePath, '', { mode: 0o600 }); extraFault = true;
        }
        if (stage === 'proof-sync-failure') fs.fsyncSync = fd => {
          const opened = fs.fstatSync(fd), named = fs.lstatSync(file);
          if (!extraFault && opened.dev === named.dev && opened.ino === named.ino) {
            extraFault = true; fs.fsyncSync = sync; throw new Error('injected branch proof sync failure');
          }
          return sync(fd);
        };
        if (stage === 'proof-regressed') {
          let proofSynced = false;
          fs.fsyncSync = fd => {
            const opened = fs.fstatSync(fd), named = lstat(file);
            const result = sync(fd);
            if (opened.dev === named.dev && opened.ino === named.ino) { proofSynced = true; fs.fsyncSync = sync; }
            return result;
          };
          Object.defineProperty(fs, 'lstatSync', { value: new Proxy(lstat, { apply(target, thisArg, args) {
            const result = Reflect.apply(target, thisArg, args);
            if (proofSynced && !extraFault && String(args[0]) === file) {
              extraFault = true; Object.defineProperty(fs, 'lstatSync', { value: lstat });
              fs.truncateSync(file, JSON.parse(fs.readFileSync(transaction, 'utf8')).branch.prefixBytes);
            }
            return result;
          } }) });
        }
      };
    }
    if (stage === 'journal-race' || stage === 'inode-race' || stage === 'gate-race') Session.open = (workspace, options) => {
      if (options.id === childId && options.expectedJournal && !extraFault) {
        extraFault = true;
        const file = path.join(root, '.agent', `${childId}.jsonl`);
        if (stage === 'journal-race') fs.appendFileSync(file, '{"kind":"title","title":"intervening"}\n');
        if (stage === 'inode-race') {
          const bytes = fs.readFileSync(file); movedJournal = file; fs.renameSync(file, `${file}.original-test`);
          fs.writeFileSync(file, bytes, { mode: 0o600 });
        }
        if (stage === 'gate-race') {
          gatePath = `${file}.lock.gate`; fs.renameSync(gatePath, `${gatePath}.original-test`);
          fs.writeFileSync(gatePath, '', { mode: 0o600 });
        }
      }
      return open(workspace, options);
    };
    const output = new Writable({ write(chunk, _encoding, callback) {
      text += String(chunk); const token = /Apply: \/rewind 1 --files --apply ([a-f0-9]{64})/.exec(text)?.[1];
      if (token && !applied) { applied = true; setImmediate(() => input.write(`/rewind 1 --files --apply ${token}\n`)); }
      if (text.includes('Rewound files and conversation to turn 1') && !regranted) {
        regranted = true; setImmediate(() => input.write(`/add-dir ${outside}\n`));
      }
      if (regranted && text.includes(`Added ${outside}`) && !continued) {
        continued = true; setImmediate(() => input.write('continue after marker failure\n'));
      }
      callback();
    } });
    const errors = new Writable({ write(chunk, _encoding, callback) {
      status += String(chunk); if (status.includes('error: Checkpoint history committed;')) setImmediate(() => input.write('/exit\n'));
      callback();
    } });
    const deadline = setTimeout(() => { timedOut = true; input.write('/exit\n'); }, 10000);
    try {
      input.write('/rewind 1 --files\n');
      await interactiveLoop(session, provider, runtime, { input, output, status: errors, signal });
    } finally { clearTimeout(deadline); }
    fs.fsyncSync = sync; Object.defineProperty(fs, 'lstatSync', { value: lstat }); Session.open = open;
    assert.equal(timedOut, false, `${stage}: ${status}`); assert.equal(injected, true); assert.ok(childId);
    assert.equal(fs.readFileSync(local, 'utf8'), stage === 'file-conflict' ? 'CONCURRENT' : 'BEFORE');
    if (stage === 'normal') {
      assert.match(text, /Rewound files and conversation to turn 1/); assert.match(text, /checkpoint transaction was recovered/);
      assert.equal(fs.existsSync(transaction), false);
      assert.equal(provider.requests.length, 2); assert.match(JSON.stringify(provider.requests[1]?.messages), /EXTERNAL_BEFORE/);
    } else {
      assert.match(text, new RegExp(`Rewind committed in session ${childId}; checkpoint transaction and runtime recovery are uncertain`));
      assert.equal(provider.requests.length, 0);
      if (['journal-race', 'inode-race', 'gate-race'].includes(stage)) assert.equal(fs.existsSync(transaction), false);
      else assert.equal(fs.readFileSync(transaction, 'utf8'), pendingBytes);
      if (stagingFile) assert.equal(fs.readFileSync(stagingFile, 'utf8'), 'RETAINED_STAGING');
      if (['branch-change', 'gate-change', 'torn-evidence', 'proof-sync-failure', 'proof-regressed', 'journal-race', 'inode-race', 'gate-race'].includes(stage)) assert.equal(extraFault, true);
    }
    if (gatePath) { fs.unlinkSync(gatePath); fs.renameSync(`${gatePath}.original-test`, gatePath); gatePath = ''; }
    if (movedJournal) { fs.unlinkSync(movedJournal); fs.renameSync(`${movedJournal}.original-test`, movedJournal); movedJournal = ''; }
    const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
      const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,'marker-interactive');
      process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,'marker-interactive',target)?.toString()??null,
        grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, childId, outside, target], { encoding: 'utf8' })),
    { kind: stage === 'normal' ? 'available' : 'unknown', bytes: stage === 'normal' ? 'EXTERNAL_BEFORE' : null, grant: false });
  } finally {
    fs.renameSync = rename; fs.fsyncSync = sync; Object.defineProperty(fs, 'lstatSync', { value: lstat }); Session.open = open;
    if (gatePath) { fs.unlinkSync(gatePath); fs.renameSync(`${gatePath}.original-test`, gatePath); }
    if (movedJournal) { fs.unlinkSync(movedJournal); fs.renameSync(`${movedJournal}.original-test`, movedJournal); }
    await runtime.close(); await session.close(); input.destroy();
  }
  }
});

test('automatic checkpoints await external witnesses while the Agent remains busy', { timeout: 30000 }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'AUTOMATIC');
  const session = Session.open(root, { config: config(root, tools, { automaticCheckpoints: true, permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let release = () => {}, reached = () => {};
  const held = new Promise<void>(resolve => { release = resolve; }), ready = new Promise<void>(resolve => { reached = resolve; });
  let run: Promise<unknown> | undefined;
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const begin = session.beginDirectoryCheckpointBracket.bind(session);
    session.beginDirectoryCheckpointBracket = async input => {
      const result = await begin(input);
      if (result.kind === 'ready') { reached(); await held; }
      return result;
    };
    const agent = new Agent(session, new ScriptedProvider([response([call('track-auto', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools);
    run = agent.run('track for automatic checkpoint');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([ready, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('automatic witness did not begin')), 10000); })]); }
    finally { if (timer) clearTimeout(timer); }
    await assert.rejects(agent.run('overlap'), /already running/);
    release(); await run; run = undefined;
    const checkpoints = session.events.filter(event => event.kind === 'checkpoint');
    const initial = checkpoints.find(event => event.kind === 'checkpoint' && event.boundary === 0);
    const completed = checkpoints.findLast(event => event.kind === 'checkpoint' && event.boundary > 0);
    assert.ok(initial && initial.kind === 'checkpoint' && completed && completed.kind === 'checkpoint');
    const earlier = inspectDirectoryCheckpointWitness(session, initial.name), current = inspectDirectoryCheckpointWitness(session, completed.name);
    assert.equal(earlier.kind, 'available'); assert.equal(current.kind, 'available');
    if (earlier.kind !== 'available' || current.kind !== 'available') throw new Error('automatic witness unavailable');
    assert.deepEqual(earlier.entries.find(entry => entry.path.lexicalPath === target)?.observation, { kind: 'unavailable' });
    assert.equal(current.entries.find(entry => entry.path.lexicalPath === target)?.observation.kind, 'present');
    assert.equal(readDirectoryCheckpointBackup(session, completed.name, target)?.toString(), 'AUTOMATIC');
    const id = session.id, name = completed.name; await session.close();
    const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
      const [root,id,outside,target,name]=process.argv.slice(1),s=Session.open(root,{id}),w=inspectDirectoryCheckpointWitness(s,name);
      process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,name,target)?.toString()??null,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, target, name], { encoding: 'utf8' })),
    { kind: 'available', bytes: 'AUTOMATIC', grant: false });
  } finally { release(); await run?.catch(() => {}); await session.close(); }
});

test('directory checkpoint revocation leaves an unknown witness', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('track-revoke', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track before revocation');
    const begin = session.beginDirectoryCheckpointBracket.bind(session);
    session.beginDirectoryCheckpointBracket = async input => {
      const result = await begin(input);
      if (result.kind !== 'ready') return result;
      return { ...result, finish: async () => {
        session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
        return result.finish();
      } };
    };
    const captured = await checkpointConversationWithDirectoryWitness(session, 'revoked', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'unknown');
    assert.deepEqual(inspectDirectoryCheckpointWitness(session, 'revoked'), { kind: 'unknown' });
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL');
    const id = session.id; await session.close();
    const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness} from './src/rewind.ts';
      const s=Session.open(process.argv[1],{id:process.argv[2]});process.stdout.write(JSON.stringify(inspectDirectoryCheckpointWitness(s,'revoked')));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, id], { encoding: 'utf8' })), { kind: 'unknown' });
  } finally { await session.close(); }
});

test('inherited checkpoint references survive or remain unknown across writer death', { timeout: 30000 }, async () => {
  for (const phase of ['before', 'after'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, '.agent', `inherit-${phase}`), tools = createTools();
    fs.writeFileSync(target, 'BEFORE_CRASH');
    const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('track-inherit-crash', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track before fork crash');
    const captured = await checkpointConversationWithDirectoryWitness(parent, 'inherit-crash', new AbortController().signal);
    assert.ok('external_witness' in captured); assert.equal(captured.external_witness, 'available');
    const id = parent.id; await parent.close();
    const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {forkSession} from './src/sessions.ts';
      const [root,id,outside,marker,phase]=process.argv.slice(1),s=Session.open(root,{id}),append=Session.prototype.append;
      s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      const stop=child=>{fs.writeFileSync(marker,JSON.stringify({id:child.id}));process.kill(process.pid,'SIGSTOP')};
      Session.prototype.append=function(event,...args){if(event.kind==='directory_checkpoint_inheritance'&&phase==='before')stop(this);
        const result=append.call(this,event,...args);if(event.kind==='directory_checkpoint_inheritance'&&phase==='after')stop(this);return result};
      forkSession(s);throw Error('inheritance barrier missed');`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, id, outside, marker, phase],
      { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = ''; child.stderr!.on('data', chunk => { errors += String(chunk); });
    const exited = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('exit', () => resolve()); });
    try {
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(child.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
        assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, errors);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const descendant = JSON.parse(fs.readFileSync(marker, 'utf8')).id; child.kill('SIGKILL'); await exited;
      fs.writeFileSync(target, 'AFTER_CRASH');
      const reader = `import {Session} from './src/session.ts';import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
        const [root,id,outside,target,recover]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:recover==='yes'}),w=inspectDirectoryCheckpointWitness(s,'inherit-crash');
        process.stdout.write(JSON.stringify({kind:w.kind,bytes:readDirectoryCheckpointBackup(s,'inherit-crash',target)?.toString()??null,
          grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader,
          root, descendant, outside, target, i === 0 ? 'yes' : 'no'], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr);
        assert.deepEqual(JSON.parse(cold.stdout), { kind: phase === 'after' ? 'available' : 'unknown',
          bytes: phase === 'after' ? 'BEFORE_CRASH' : null, grant: false });
      }
    } finally { if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; } }
  }
});

test('external checkpoint witnesses survive or retain uncertainty across writer death', { timeout: 30000 }, async () => {
  for (const phase of ['checkpoint', 'prepared', 'commit', 'receipt'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, '.agent', `witness-${phase}`), tools = createTools();
    fs.writeFileSync(target, 'BEFORE_CRASH');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('track-crash', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track before checkpoint crash');
    const id = session.id; await session.close();
    const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {checkpointConversationWithDirectoryWitness} from './src/rewind.ts';
      const [root,id,outside,marker,phase]=process.argv.slice(1),s=Session.open(root,{id}),append=s.append.bind(s),rename=fs.renameSync;
      s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
      const stop=()=>{fs.writeFileSync(marker,'stopped');process.kill(process.pid,'SIGSTOP')};
      s.append=function(event,...args){const result=append(event,...args);if((phase==='checkpoint'&&event.kind==='checkpoint'&&event.name==='crash')||
        (phase==='commit'&&event.kind==='directory_checkpoint_witness'&&event.name==='crash'))stop();return result};
      fs.renameSync=function(from,to){const result=rename.apply(this,arguments);if((phase==='prepared'&&String(to).includes('.checkpoint-witness-prepared-'))||
        (phase==='receipt'&&String(to).includes('.checkpoint-witness-receipt-')))stop();return result};
      await checkpointConversationWithDirectoryWitness(s,'crash',new AbortController().signal);throw Error('witness barrier missed');`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, id, outside, marker, phase],
      { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = ''; child.stderr!.on('data', chunk => { errors += String(chunk); });
    const exited = new Promise<void>((resolve, reject) => { child.once('error', reject); child.once('exit', () => resolve()); });
    let reopened: Session | undefined;
    try {
      const deadline = Date.now() + 10000;
      while (!fs.existsSync(marker) || !childProcess.spawnSync('ps', ['-o', 'state=', '-p', String(child.pid)], { encoding: 'utf8', timeout: 5000 }).stdout.trim().startsWith('T')) {
        assert.ok(Date.now() < deadline && child.exitCode === null && child.signalCode === null, errors);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      child.kill('SIGKILL'); await exited;
      fs.writeFileSync(target, 'AFTER_CRASH');
      while (!reopened) {
        try { reopened = Session.open(root, { id, recoverLock: true }); }
        catch (error) { if (!String(error).includes('Session lock busy') || Date.now() >= deadline) throw error; await new Promise(resolve => setTimeout(resolve, 10)); }
      }
      for (let i = 0; i < 2; i++) {
        const current: Session | undefined = reopened; assert.ok(current);
        const witness = inspectDirectoryCheckpointWitness(current, 'crash');
        assert.equal(witness.kind, phase === 'commit' || phase === 'receipt' ? 'available' : 'unknown');
        assert.equal(readDirectoryCheckpointBackup(current, 'crash', target)?.toString() ?? null, phase === 'commit' || phase === 'receipt' ? 'BEFORE_CRASH' : null);
        assert.equal(!!current.workingDirectories(false).readHandle?.(outside), false);
        await current.close(); reopened = i === 0 ? Session.open(root, { id }) : undefined;
      }
      const userDir = path.join(root, 'checkpoint-cold-user'); fs.mkdirSync(userDir);
      const preload = path.join(root, 'checkpoint-offline.mjs');
      fs.writeFileSync(preload, "globalThis.fetch=()=>{throw Error('checkpoint recovery fixture forbids network')};");
      const journalBeforeCli = fs.readFileSync(session.file);
      const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root,
        '--resume', id, '--interactive', '--no-tui', '--no-inherit-gateway'], { cwd: process.cwd(), input: '/exit\n',
        encoding: 'utf8', timeout: 15000, env: { ...process.env, HOME: userDir, CLAUDE_CONFIG_DIR: userDir,
          LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
      assert.equal(cli.status, 0, cli.stderr + cli.stdout);
      assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER_CRASH');
      assert.ok(fs.readFileSync(session.file).subarray(0, journalBeforeCli.length).equals(journalBeforeCli));
      const reader = `import {Session} from './dist/session.js';import {forkSession} from './dist/sessions.js';
        import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './dist/rewind.js';
        const [root,id,outside,target,mode]=process.argv.slice(1),s=Session.open(root,{id}),fork=mode==='fork'?forkSession(s):undefined,current=fork??s;
        const w=inspectDirectoryCheckpointWitness(current,'crash');process.stdout.write(JSON.stringify({kind:w.kind,
          bytes:readDirectoryCheckpointBackup(current,'crash',target)?.toString()??null,grant:!!current.workingDirectories(false).readHandle?.(outside)}));
        await fork?.close();await s.close();`;
      const cold = (mode: string) => {
        const result = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader,
          root, id, outside, target, mode], { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout);
      };
      const available = phase === 'commit' || phase === 'receipt';
      for (const mode of ['source', 'fork']) for (let i = 0; i < 2; i++)
        assert.deepEqual(cold(mode), { kind: available ? 'available' : 'unknown', bytes: available ? 'BEFORE_CRASH' : null, grant: false });
      if (phase === 'prepared') {
        const prefix = `${path.basename(session.file)}.checkpoint-witness-prepared-`;
        const name = fs.readdirSync(path.dirname(session.file)).find(name => name.startsWith(prefix)); assert.ok(name);
        const prepared = path.join(path.dirname(session.file), name), final = prepared.replace('.checkpoint-witness-prepared-', '.checkpoint-witness-receipt-');
        const bytes = fs.readFileSync(prepared), journal = fs.readFileSync(session.file);
        fs.renameSync(prepared, final);
        try {
          for (const mode of ['source', 'fork']) assert.deepEqual(cold(mode), { kind: 'unknown', bytes: null, grant: false });
          assert.deepEqual(fs.readFileSync(final), bytes);
          assert.deepEqual(fs.readFileSync(session.file), journal);
          assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER_CRASH');
        } finally { fs.renameSync(final, prepared); }
      }
      if (phase === 'commit') {
        const prefix = `${path.basename(session.file)}.checkpoint-witness-prepared-`;
        const preparedName = fs.readdirSync(path.dirname(session.file)).find(name => name.startsWith(prefix)); assert.ok(preparedName);
        const prepared = path.join(path.dirname(session.file), preparedName), final = prepared.replace('.checkpoint-witness-prepared-', '.checkpoint-witness-receipt-');
        const original = fs.readFileSync(prepared), receipt = JSON.parse(original.toString('utf8'));
        fs.writeFileSync(final, '{}', { mode: 0o600 });
        assert.deepEqual(cold('source'), { kind: 'unknown', bytes: null, grant: false }); fs.unlinkSync(final);
        const backup = `${session.file}.snapshot-unknown-${receipt.entries[0].observation.backup.id}`;
        const altered = Buffer.alloc(receipt.entries[0].observation.backup.bytes, 88);
        fs.writeFileSync(backup, altered); receipt.entries[0].observation.backup.sha256 = createHash('sha256').update(altered).digest('hex');
        fs.writeFileSync(prepared, JSON.stringify(receipt));
        for (const mode of ['source', 'fork']) assert.deepEqual(cold(mode), { kind: 'unknown', bytes: null, grant: false });
      }
    } finally {
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
      await reopened?.close();
    }
  }
});

test('external checkpoint cancellation propagates after workspace capture', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('track-cancel', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track before cancellation');
    const controller = new AbortController(), begin = session.beginDirectoryCheckpointBracket.bind(session);
    session.beginDirectoryCheckpointBracket = async input => {
      const result = await begin(input);
      if (result.kind !== 'ready') return result;
      return { ...result, finish: async () => { controller.abort(new Error('checkpoint cancelled')); return result.finish(); } };
    };
    await assert.rejects(checkpointConversationWithDirectoryWitness(session, 'cancelled', controller.signal), /checkpoint cancelled/);
    assert.equal(session.isJournalFenced, false);
    assert.ok(session.events.some(event => event.kind === 'checkpoint' && event.name === 'cancelled'));
    assert.deepEqual(inspectDirectoryCheckpointWitness(session, 'cancelled'), { kind: 'unknown' });
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL');
  } finally { await session.close(); }
});

test('external checkpoint journal failure fences the owning Session', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const sync = fs.fsyncSync;
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('track-journal', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools).run('track before journal fault');
    const append = session.append.bind(session);
    session.append = (event, authorization, token) => {
      if (event.kind !== 'directory_checkpoint_witness') return append(event, authorization, token);
      fs.fsyncSync = () => { throw new Error('injected witness journal sync failure'); };
      try { return append(event, authorization, token); } finally { fs.fsyncSync = sync; }
    };
    await assert.rejects(checkpointConversationWithDirectoryWitness(session, 'journal-fault', new AbortController().signal), /injected witness journal sync failure/);
    assert.equal(session.isJournalFenced, true); assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL');
    const id = session.id; await session.close();
    const reader = `import fs from 'node:fs';import {Session} from './src/session.ts';
      import {inspectDirectoryCheckpointWitness,readDirectoryCheckpointBackup} from './src/rewind.ts';
      const s=Session.open(process.argv[1],{id:process.argv[2]}),sync=fs.fsyncSync;
      if(process.argv[5]==='fault')fs.fsyncSync=()=>{throw Error('injected recovery sync failure')};
      const w=inspectDirectoryCheckpointWitness(s,'journal-fault'),bytes=readDirectoryCheckpointBackup(s,'journal-fault',process.argv[4]);
      fs.fsyncSync=sync;process.stdout.write(JSON.stringify({kind:w.kind,bytes:bytes?.toString()??null,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
    const cold = (fault: string) => JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside, target, fault], { encoding: 'utf8' }));
    assert.deepEqual(cold('fault'), { kind: 'unknown', bytes: null, grant: false });
    for (let i = 0; i < 2; i++) assert.deepEqual(cold('clear'), { kind: 'available', bytes: 'ORIGINAL', grant: false });
  } finally { fs.fsyncSync = sync; await session.close(); }
});

test('automatic checkpoint honors cancellation after turn completion', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const session = Session.open(root, { config: config(root, tools, { automaticCheckpoints: true, permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const controller = new AbortController(), begin = session.beginDirectoryCheckpointBracket.bind(session);
    session.beginDirectoryCheckpointBracket = async input => {
      const result = await begin(input);
      if (result.kind !== 'ready') return result;
      return { ...result, finish: async () => { controller.abort(new Error('automatic checkpoint cancelled')); return result.finish(); } };
    };
    const agent = new Agent(session, new ScriptedProvider([response([call('track-auto-cancel', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools);
    await assert.rejects(agent.run('track before automatic cancellation', controller.signal), /automatic checkpoint cancelled/);
    assert.equal(session.events.filter(event => event.kind === 'turn_end').length, 1);
    assert.equal(session.isJournalFenced, false); assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL');
  } finally { await session.close(); }
});

test('automatic checkpoint journal failure does not return a successful turn', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL');
  const session = Session.open(root, { config: config(root, tools, { automaticCheckpoints: true, permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const sync = fs.fsyncSync;
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const append = session.append.bind(session);
    session.append = (event, authorization, token) => {
      if (event.kind !== 'directory_checkpoint_witness' || !session.events.some(row => row.kind === 'turn_end')) return append(event, authorization, token);
      fs.fsyncSync = () => { throw new Error('injected automatic witness journal failure'); };
      try { return append(event, authorization, token); } finally { fs.fsyncSync = sync; }
    };
    const provider = new ScriptedProvider([response([call('track-auto-fault', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]);
    await assert.rejects(new Agent(session, provider, tools).run('track before automatic journal fault'), /injected automatic witness journal failure/);
    assert.equal(session.isJournalFenced, true); assert.ok(provider.requests.length > 0);
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL');
  } finally { fs.fsyncSync = sync; await session.close(); }
});

test('automatic checkpoint ordinary failures remain best effort', async () => {
  const root = workspace(), tools = createTools();
  const session = Session.open(root, { config: config(root, tools, { automaticCheckpoints: true }) });
  try {
    const append = session.append.bind(session), statuses: string[] = [];
    session.append = (event, authorization, token) => {
      if (event.kind === 'checkpoint') throw new Error('ordinary checkpoint failure');
      return append(event, authorization, token);
    };
    const agent = new Agent(session, new ScriptedProvider([done()]), tools, { status: message => statuses.push(message) });
    const result = await agent.run('complete without checkpoint');
    assert.equal(result.reason, 'end_turn'); assert.equal(session.isJournalFenced, false);
    assert.ok(statuses.some(message => message.includes('Automatic checkpoint skipped: ordinary checkpoint failure')));
  } finally { await session.close(); }
});

test('directory message snapshots do not witness an earlier workspace checkpoint', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'AT_CHECKPOINT');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let messageId = '', checkpointName = '';
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const provider = new ScriptedProvider([response([call('track-boundary', 'write_file',
      { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done(), done()]);
    const agent = new Agent(session, provider, tools);
    await agent.run('track the external file');
    assert.match(JSON.stringify(resultBatches(session)[0]?.[0]), /file already exists/);
    checkpointName = 'before-outside-change';
    checkpointConversation(session, checkpointName, new AbortController().signal);
    const checkpoint = session.events.findLast(event => event.kind === 'checkpoint' && event.name === checkpointName);
    assert.ok(checkpoint && checkpoint.kind === 'checkpoint');
    assert.equal(fs.readFileSync(target, 'utf8'), 'AT_CHECKPOINT');
    fs.writeFileSync(target, 'AFTER_CHECKPOINT');
    await agent.run('capture the later user snapshot');
    const user = session.events.findLast(event => event.kind === 'message' && event.message.role === 'user' && !event.isMeta && event.messageId);
    assert.ok(user && user.kind === 'message' && user.messageId); messageId = user.messageId;
    const selected = session.selectDirectoryRewindSnapshot(messageId);
    assert.equal(selected.kind, 'available');
    if (selected.kind !== 'available') throw new Error('directory selection unavailable');
    const reference = selected.entries.find(entry => entry.path.lexicalPath === target)?.reference;
    assert.ok(reference && reference.kind === 'present');
    assert.equal(session.readDirectoryHistoryBackup(reference.backupId)?.bytes.toString(), 'AFTER_CHECKPOINT');
    assert.equal(session.events.slice(0, session.events.indexOf(checkpoint) + 1).some(event =>
      event.kind === 'directory_snapshot' && event.messageId === messageId), false);
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    const selected=s.selectDirectoryRewindSnapshot(process.argv[3]),ref=selected.kind==='available'&&selected.entries.find(e=>e.path.lexicalPath===process.argv[4])?.reference;
    const checkpoint=s.events.findLast(e=>e.kind==='checkpoint'&&e.name===process.argv[5]);
    process.stdout.write(JSON.stringify({bytes:ref?.kind==='present'?s.readDirectoryHistoryBackup(ref.backupId)?.bytes.toString():null,checkpoint:!!checkpoint}));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, messageId, target, checkpointName], { encoding: 'utf8' })),
  { bytes: 'AFTER_CHECKPOINT', checkpoint: true });
});

test('a first-tracked directory version does not prove an earlier checkpoint state', async () => {
  for (const initial of ['missing', 'present'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    if (initial === 'present') fs.writeFileSync(target, 'AT_CHECKPOINT');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    let messageId = ''; const successors: Array<{ workspace: string; id: string; preview: boolean; paths: string[] }> = [];
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const agent = new Agent(session, new ScriptedProvider([done(), response([call('track-later', 'write_file',
        { path: target, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]), tools);
      await agent.run('earlier user turn');
      const first = session.events.find(event => event.kind === 'message' && event.message.role === 'user' && event.messageId);
      assert.ok(first && first.kind === 'message' && first.messageId); messageId = first.messageId;
      checkpointConversation(session, `before-${initial}`, new AbortController().signal);
      assert.equal(fs.existsSync(target), initial === 'present');
      if (initial === 'present') fs.unlinkSync(target); else fs.writeFileSync(target, 'AFTER_CHECKPOINT');
      await agent.run('track the changed external file');
      const selected = session.selectDirectoryRewindSnapshot(messageId);
      assert.equal(selected.kind, 'available');
      if (selected.kind !== 'available') throw new Error('directory selection unavailable');
      const reference = selected.entries.find(entry => entry.path.lexicalPath === target)?.reference;
      assert.equal(reference?.kind, initial === 'present' ? 'missing' : 'present');
      if (reference?.kind === 'present') assert.equal(session.readDirectoryHistoryBackup(reference.backupId)?.bytes.toString(), 'AFTER_CHECKPOINT');
      const preview = previewRewind(session, 1, new AbortController().signal);
      assert.deepEqual(preview.external, { kind: 'unavailable', paths: [target] });
      const snapshot = session.events.find(event => event.kind === 'directory_snapshot');
      assert.ok(snapshot && snapshot.kind === 'directory_snapshot');
      const pending = `${session.file}.snapshot-commit-pending-${snapshot.id}`;
      fs.writeFileSync(pending, '', { flag: 'wx', mode: 0o600 });
      try {
        const uncertain = previewRewind(session, 1, new AbortController().signal);
        assert.deepEqual(uncertain.external, { kind: 'unknown' }); assert.notEqual(uncertain.token, preview.token);
        const uncertainFork = forkSession(session);
        try { assert.deepEqual(uncertainFork.rewindExternalState, { kind: 'unknown' });
          assert.deepEqual(uncertainFork.directoryCheckpointPathsAt(uncertainFork.events.length), { kind: 'unknown' }); }
        finally { await uncertainFork.close(); }
      } finally { fs.unlinkSync(pending); }
      const rewound = applyRewind(session, preview, preview.token, new AbortController().signal);
      try { assert.deepEqual(previewRewind(rewound, 1, new AbortController().signal).external, preview.external);
        successors.push({ workspace: root, id: rewound.id, preview: true, paths: [target] }); }
      finally { await rewound.close(); }
      const forked = forkSession(session);
      try {
        assert.deepEqual(previewRewind(forked, 1, new AbortController().signal).external, preview.external);
        const other = path.join(outside, 'other'); fs.writeFileSync(other, 'OTHER');
        const provider = new ScriptedProvider([response([call('track-other', 'write_file', { path: other, content: 'BLOCKED', overwrite: false })], 'tool_use'), done()]);
        await new Agent(forked, provider, tools).run('track another external file');
        const paths = [target, other].sort(); assert.deepEqual(forked.rewindExternalState, { kind: 'unavailable', paths });
        successors.push({ workspace: root, id: forked.id, preview: true, paths });
      }
      finally { await forked.close(); }
      const relocatedRoot = workspace(), relocated = relocateSession(session, relocatedRoot, () => createTools());
      try { assert.deepEqual(relocated.rewindExternalState, preview.external);
        successors.push({ workspace: relocatedRoot, id: relocated.id, preview: false, paths: [target] }); }
      finally { await relocated.close(); }
    } finally { await session.close(); }
    const reader = `import {Session} from './src/session.ts';import {previewRewind} from './src/rewind.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      const selected=s.selectDirectoryRewindSnapshot(process.argv[3]),ref=selected.kind==='available'&&selected.entries.find(e=>e.path.lexicalPath===process.argv[4])?.reference;
      const external=previewRewind(s,1,new AbortController().signal).external,grant=!!s.workingDirectories(false).readHandle?.(process.argv[5]);
      process.stdout.write(JSON.stringify({kind:ref?.kind,bytes:ref?.kind==='present'?s.readDirectoryHistoryBackup(ref.backupId)?.bytes.toString():null,external,grant}));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, messageId, target, outside], { encoding: 'utf8' })),
    { kind: initial === 'present' ? 'missing' : 'present', bytes: initial === 'present' ? null : 'AFTER_CHECKPOINT',
      external: { kind: 'unavailable', paths: [target] }, grant: false });
    const branchReader = `import {Session} from './src/session.ts';import {previewRewind} from './src/rewind.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      const external=process.argv[4]==='preview'?previewRewind(s,1,new AbortController().signal).external:s.rewindExternalState;
      process.stdout.write(JSON.stringify({external,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
    for (const successor of successors) for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', branchReader, successor.workspace, successor.id, outside, successor.preview ? 'preview' : 'state'], { encoding: 'utf8' })),
    { external: { kind: 'unavailable', paths: successor.paths }, grant: false });
  }
});

test('directory rewind preserves selected and earlier unknown references', () => {
  const target = (name: string): DirectoryHistoryPath => ({ trackingPath: name, lexicalPath: name, grant: { root: '/grant', dev: '1', ino: '2' } });
  const [selected, uncertain, lost, first] = ['selected', 'uncertain', 'lost', 'first'].map(target);
  if (!selected || !uncertain || !lost || !first) throw new Error('missing test paths');
  const version = (n: number): DirectoryHistoryReference => ({ kind: 'present', origin: 'tool', backupId: 'f7d6970a-6c2e-4be7-9da9-064caf45a123', version: n });
  const unknown: DirectoryHistoryReference = { kind: 'unknown', lastKnownVersion: 0, reason: 'interrupted' };
  const missing: DirectoryHistoryReference = { kind: 'missing', parent: { dev: '1', ino: '2' }, version: 1 };
  const state: DirectoryHistoryState = {
    trackedFiles: new Map([selected, uncertain, lost, first].map(item => [item.trackingPath, item])), trackSequence: 4, snapshotSequence: 5,
    snapshots: [
      { messageId: 'selected-message', timestamp: '', entries: [{ path: selected, reference: version(1) }] },
      { messageId: 'selected-message', timestamp: '', entries: [{ path: selected, reference: unknown }] },
      { messageId: 'other', timestamp: '', entries: [{ path: uncertain, reference: unknown }, { path: lost, reference: version(2) }] },
      { messageId: 'last', timestamp: '', entries: [{ path: uncertain, reference: version(1) }, { path: first, reference: missing }] },
    ],
  };
  assert.deepEqual(selectDirectoryRewindSnapshot(state, 'selected-message'), { kind: 'available', messageId: 'selected-message', entries: [
    { path: selected, reference: unknown }, { path: uncertain, reference: unknown },
    { path: lost, reference: { kind: 'unavailable' } }, { path: first, reference: missing },
  ] });
  assert.deepEqual(selectDirectoryRewindSnapshot(state, 'absent-message'), { kind: 'not_found' });
});

test('directory file history records missing leaves and a retired grant', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'FIRST');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const agent = new Agent(session, new ScriptedProvider([response([call('write', 'write_file', { path: target, content: 'NEW', overwrite: false })], 'tool_use'), done(), done(), done()]), tools);
    await agent.run('track'); fs.unlinkSync(target);
    await agent.run('missing');
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    fs.writeFileSync(target, 'LATER');
    await agent.run('retired');
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind !== 'available') throw new Error('directory history unavailable');
    const refs = history.snapshots.map(snapshot => snapshot.entries[0]?.reference);
    const stat = fs.statSync(outside, { bigint: true });
    assert.deepEqual(refs[1], { kind: 'missing', parent: { dev: String(stat.dev), ino: String(stat.ino) }, version: 2 });
    assert.deepEqual(refs[2], { kind: 'unknown', lastKnownVersion: 2, reason: 'grant-unavailable' });
    assert.equal(fs.readFileSync(target, 'utf8'), 'LATER');
    assert.throws(() => session.append({ kind: 'directory_snapshot_intent', id: 'b68d16f5-52de-43ce-b12d-04d6264889ca',
      owner: session.id, messageId: 'f127351f-ac66-4ba5-962b-8bce5fbe3c3c', paths: [], timestamp: new Date().toISOString() }), /live transaction/);
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});const h=s.directoryFileHistory;
    process.stdout.write(JSON.stringify(h.kind==='available'?h.snapshots.map(x=>x.entries[0]?.reference):h));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const refs = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
    assert.deepEqual(refs.slice(1).map((ref: { kind: string }) => ref.kind), ['missing', 'unknown']);
    assert.equal(refs[1].version, 2); assert.equal(refs[2].lastKnownVersion, 2);
  }
});

test('directory file history rejects a grant retired after the snapshot copy', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'UNCHANGED');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
  const agent = new Agent(session, new ScriptedProvider([response([call('write', 'write_file', { path: target, content: 'NEW', overwrite: false })], 'tool_use'), done(), done()]), tools);
  await agent.run('track');
  let enter!: () => void, release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; }), barrier = new Promise<void>(resolve => { release = resolve; });
  const open = fs.promises.open;
  Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: async (...args: unknown[]) => {
    const handle = await Reflect.apply(open, fs.promises, args);
    if (String(args[0]).includes('.snapshot-unknown-')) {
      const close = handle.close;
      Object.defineProperty(handle, 'close', { configurable: true, value: async () => { enter(); await barrier; return Reflect.apply(close, handle, []); } });
    }
    return handle;
  } });
  const run = agent.run('revoke after copy');
  try {
    await entered;
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    release(); await run;
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available', JSON.stringify(session.events.filter(event => event.kind.startsWith('directory_snapshot'))));
    if (history.kind === 'available') assert.deepEqual(history.snapshots[1]?.entries[0]?.reference,
      { kind: 'unknown', lastKnownVersion: 1, reason: 'grant-unavailable' });
    assert.equal(fs.readFileSync(target, 'utf8'), 'UNCHANGED');
  } finally {
    release(); await run.catch(() => {});
    Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: open });
    await session.close();
  }
});

test('directory file history honors checkpoint disable across user turns', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'FIRST');
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] },
    features: { tasks: false, subagents: false, checkpoints: false } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const agent = new Agent(session, new ScriptedProvider([done(), response([call('track', 'write_file',
      { path: target, content: 'NEW', overwrite: false })], 'tool_use'), done(), done(), done()]), tools);
    await agent.run('disabled first');
    let history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind === 'available') assert.equal(history.snapshots.length, 0);
    session.config.features!.checkpoints = true;
    await agent.run('enabled first');
    session.config.features!.checkpoints = false;
    fs.writeFileSync(target, 'DISABLED_CHANGE');
    await agent.run('disabled again');
    history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind === 'available') assert.equal(history.snapshots.length, 1);
    session.config.features!.checkpoints = true;
    fs.writeFileSync(target, 'ENABLED_CHANGE');
    await agent.run('enabled again');
    history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind !== 'available') throw new Error('directory history unavailable');
    const refs = history.snapshots.map(snapshot => snapshot.entries[0]?.reference);
    assert.deepEqual(refs.map(reference => reference?.kind === 'present' ? reference.version : null), [1, 2]);
    if (refs[1]?.kind === 'present') assert.equal(session.readDirectoryHistoryBackup(refs[1].backupId)?.bytes.toString(), 'ENABLED_CHANGE');
  } finally { await session.close(); }
  const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const s=Session.open(process.argv[1],{id:process.argv[2]}),stat=fs.statSync(s.file),write=fs.writeSync;
    fs.writeSync=function(fd,bytes,...args){const n=write.call(this,fd,bytes,...args),f=fs.fstatSync(fd);
      if(f.dev===stat.dev&&f.ino===stat.ino&&Buffer.isBuffer(bytes)&&bytes.includes(Buffer.from('"directoryHistoryDisabled":true')))process.kill(process.pid,'SIGKILL');return n};
    const provider={count:async()=>1,complete:async()=>{throw Error('unexpected model call')}};await new Agent(s,provider,createTools()).run('disabled crash');`;
  const killed = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, session.id], { encoding: 'utf8', timeout: 15000 });
  assert.equal(killed.signal, 'SIGKILL', killed.stderr);
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});const h=s.directoryFileHistory;
    process.stdout.write(JSON.stringify(h.kind==='available'?h.snapshots.map(x=>x.entries[0]?.reference?.version):h));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })), [1, 2]);
  const resume = `import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
    const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    await new Agent(s,provider,createTools()).run();const h=s.directoryFileHistory;process.stdout.write(JSON.stringify(h.kind==='available'?h.snapshots.map(x=>x.entries[0]?.reference?.version):h));await s.close();`;
  assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', resume, root, session.id], { encoding: 'utf8' })), [1, 2]);
});

test('directory file history never recaptures interrupted snapshots after writer death', { timeout: 60000 }, async () => {
  const writer = `import fs from 'node:fs';import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const [root,outside,id,phase,marker]=process.argv.slice(1),s=Session.open(root,{id}),tools=createTools();
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const stat=fs.statSync(s.file),write=fs.writeSync;let stopped=false;
    fs.writeSync=function(fd,bytes,...args){const n=write.call(this,fd,bytes,...args),f=fs.fstatSync(fd);
      if(!stopped&&f.dev===stat.dev&&f.ino===stat.ino&&Buffer.isBuffer(bytes)&&bytes.includes(Buffer.from('"kind":"'+phase+'"'))){stopped=true;fs.writeFileSync(marker,'ready');process.kill(process.pid,'SIGSTOP')}return n};
    const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    await new Agent(s,provider,tools).run('interrupted turn');await s.close();`;
  const recover = `import fs from 'node:fs';import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true}),tools=createTools();
    const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    await new Agent(s,provider,tools).run();const before=fs.readFileSync(s.file);s.recoverInterruptedDirectoryFileHistory(new AbortController().signal);
    if(!fs.readFileSync(s.file).equals(before))throw Error('recovery was not idempotent');const h=s.directoryFileHistory;process.stdout.write(JSON.stringify(h));await s.close();`;
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
    const h=s.directoryFileHistory;process.stdout.write(JSON.stringify(h));await s.close();`;
  const crashRecovery = `import fs from 'node:fs';import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true}),stat=fs.statSync(s.file),write=fs.writeSync;
    fs.writeSync=function(fd,bytes,...args){const n=write.call(this,fd,bytes,...args),f=fs.fstatSync(fd);
      if(f.dev===stat.dev&&f.ino===stat.ino&&Buffer.isBuffer(bytes)&&bytes.includes(Buffer.from('"kind":"directory_snapshot_recovery"')))process.kill(process.pid,'SIGKILL');return n};
    const provider={count:async()=>1,complete:async()=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}})};
    await new Agent(s,provider,createTools()).run();throw Error('recovery barrier not reached');`;
  for (const { phase, killRecovery } of [
    { phase: 'directory_snapshot_intent', killRecovery: false }, { phase: 'directory_snapshot_observation', killRecovery: false },
    { phase: 'directory_snapshot', killRecovery: false }, { phase: 'directory_snapshot', killRecovery: true },
  ]) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'barrier'), tools = createTools();
    fs.writeFileSync(target, 'FIRST');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, new ScriptedProvider([response([call('track', 'write_file', { path: target, content: 'NEW', overwrite: false })], 'tool_use'), done()]), tools).run('first turn');
    } finally { await session.close(); }
    fs.writeFileSync(target, 'AT_CAPTURE');
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, outside, session.id, phase, marker], { stdio: ['ignore', 'ignore', 'pipe'] });
    let diagnostics = ''; child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { diagnostics += text; });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    try {
      const until = Date.now() + 10000;
      while (!fs.existsSync(marker)) {
        assert.ok(Date.now() < until && child.exitCode === null && child.signalCode === null, `${phase}: ${diagnostics}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      if (phase === 'after_publish') {
        assert.equal(fs.readFileSync(target, 'utf8'), 'PUBLISHED');
        assert.equal(fs.statSync(target).nlink, 1);
      }
      assert.ok(child.pid); process.kill(child.pid, 'SIGKILL'); assert.equal((await exited).signal, 'SIGKILL');
      fs.writeFileSync(target, 'AFTER_CRASH');
      const cold = () => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
      assert.deepEqual(cold(), { kind: 'unknown' });
      const originalJournal = fs.readFileSync(session.file);
      if (killRecovery) {
        const killed = childProcess.spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', crashRecovery, root, session.id], { encoding: 'utf8', timeout: 15000 });
        assert.equal(killed.signal, 'SIGKILL', killed.stderr);
        for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { kind: 'unknown' });
      }
      const recovered = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', recover, root, session.id], { encoding: 'utf8' }));
      assert.ok(fs.readFileSync(session.file).subarray(0, originalJournal.length).equals(originalJournal));
      if (killRecovery) assert.deepEqual(recovered, { kind: 'unknown' });
      else {
        assert.equal(recovered.kind, 'available');
        assert.equal(recovered.snapshots[0].entries[0].reference.kind, 'present');
        assert.deepEqual(recovered.snapshots[1].entries[0].reference, { kind: 'unknown', lastKnownVersion: 1, reason: 'interrupted' });
      }
      for (let i = 0; i < 2; i++) assert.deepEqual(cold(), recovered);
      assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER_CRASH');
      if (phase === 'directory_snapshot' && !killRecovery) {
        const rows = fs.readFileSync(session.file, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const recovery = rows.find(row => row.kind === 'directory_snapshot_recovery');
        assert.ok(recovery);
        assert.ok(fs.existsSync(`${session.file}.snapshot-commit-pending-${recovery.id}`));
        const receipt = `${session.file}.snapshot-recovery-receipt-${recovery.id}`, bytes = fs.readFileSync(receipt);
        try {
          const altered = JSON.parse(bytes.toString()); altered.witness = '0'.repeat(64);
          fs.writeFileSync(receipt, JSON.stringify(altered));
          for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { kind: 'unknown' });
        } finally { fs.writeFileSync(receipt, bytes); }
        assert.deepEqual(cold(), recovered);
      }
    } finally { if (child.exitCode === null && child.signalCode === null && child.pid) { process.kill(child.pid, 'SIGKILL'); await exited; } }
  }
});

test('directory grant Write publishes with retained snapshot and mode', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  const original = Buffer.from([0, 255, 65, 10, 128]);
  fs.writeFileSync(target, original, { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('external-write', 'write_file',
      { path: target, content: 'PUBLISHED', overwrite: true })], 'tool_use'), done()]), tools).run('write fixture');
    assert.notEqual(resultBatches(session)[0]?.[0]?.is_error, true, JSON.stringify(resultBatches(session)));
    assert.equal(fs.readFileSync(target, 'utf8'), 'PUBLISHED');
    assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind !== 'available') throw new Error('directory history unavailable');
    const reference = history.snapshots[0]?.entries[0]?.reference;
    assert.equal(reference?.kind, 'present');
    if (reference?.kind === 'present') assert.deepEqual(session.readDirectoryHistoryBackup(reference.backupId)?.bytes, original);
  } finally { await session.close(); }
});

test('owned directory publication creates a missing target with the final Write options', async () => {
  for (const scenario of ['default', 'overwrite', 'stale', 'umask'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'created'), tools = createTools();
    const writeTool = tools.find(tool => tool.schema.name === 'write_file')!, execute = writeTool.execute;
    writeTool.execute = async (input, context) => {
      try { return await execute(input, { ...context, directoryPublicationAuthorization: undefined }); }
      catch (error) {
        if (!(error instanceof Error) || !error.message.includes('writes through additional directory grants are not implemented')) throw error;
        assert.ok(context.session && context.toolUseId && context.pathApprovalCall && context.authorizationIdentity);
        const missing = context.session.events.findLast(row => row.kind === 'directory_missing_backup');
        const grant = context.session.workingDirectories(false).readHandle?.(outside);
        assert.ok(missing && missing.kind === 'directory_missing_backup' && grant);
        if (scenario === 'stale') fs.writeFileSync(target, 'OTHER', { flag: 'wx' });
        if (scenario === 'umask') process.umask(0o077);
        const transaction = { toolUseId: context.toolUseId, backupId: missing.id, grant,
          lexicalPath: target, content: Buffer.from('CREATED'), signal: context.signal,
          authorizationSignal: context.authorizationIdentity.signal, approvalCall: context.pathApprovalCall,
          authorization: context.directoryPublicationAuthorization };
        const result = context.session.publishDirectoryFileTransaction(transaction);
        assert.throws(() => context.session!.publishDirectoryFileTransaction(transaction), /authorization|already attempted/);
        return JSON.stringify(result);
      }
    };
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const expectedContent = scenario === 'stale' ? 'OTHER' : 'CREATED';
    const expectedKind = scenario === 'stale' ? 'not_published' : 'durable';
    const originalMask = process.umask(), expectedMode = 0o666 & ~(scenario === 'umask' ? 0o027 : originalMask);
    try {
      if (scenario === 'umask') process.umask(0o027);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const input = { path: target, content: 'CREATED', ...(scenario === 'overwrite' ? { overwrite: true } : {}) };
      const agent = new Agent(session, new ScriptedProvider([response([call('missing-publish', 'write_file', input)], 'tool_use'), done(), done()]), tools);
      await agent.run('create fixture');
      assert.notEqual(resultBatches(session)[0]?.[0]?.is_error, true, JSON.stringify(resultBatches(session)));
      assert.equal(JSON.parse(String(resultBatches(session)[0]?.[0]?.content)).kind, expectedKind);
      assert.equal(fs.readFileSync(target, 'utf8'), expectedContent);
      assert.equal(fs.statSync(target).mode & 0o7777, expectedMode);
      assert.equal(session.directoryPublications[0]?.kind, expectedKind);
      await agent.run('snapshot created fixture');
      const history = session.directoryFileHistory;
      assert.equal(history.kind, 'available');
      if (history.kind !== 'available') throw new Error('directory history unavailable');
      const refs = history.snapshots.map(snapshot => snapshot.entries.find(entry => entry.path.lexicalPath === target)?.reference);
      assert.equal(refs[0]?.kind, 'missing'); assert.equal(refs[1]?.kind, 'present');
      if (refs[1]?.kind === 'present') {
        assert.equal(refs[1].version, 2);
        assert.equal(session.readDirectoryHistoryBackup(refs[1].backupId)?.bytes.toString(), expectedContent);
      }
    } finally { process.umask(originalMask); await session.close(); }
    const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});const h=s.directoryFileHistory;
      const refs=h.kind==='available'?h.snapshots.map(x=>x.entries.find(e=>e.path.lexicalPath===process.argv[3])?.reference):[];
      process.stdout.write(JSON.stringify({publications:s.directoryPublications.map(p=>p.kind),refs:refs.map(r=>({kind:r?.kind,version:r?.version})),
        contents:refs.map(r=>r?.kind==='present'?s.readDirectoryHistoryBackup(r.backupId)?.bytes.toString():null)}));await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, target], { encoding: 'utf8' })),
      { publications: [expectedKind], refs: [{ kind: 'missing', version: 1 }, { kind: 'present', version: 2 }], contents: [null, expectedContent] });
    if (scenario === 'default') {
      const original = fs.readFileSync(session.file), lines = original.toString('utf8').trimEnd().split('\n');
      const index = lines.findIndex(line => JSON.parse(line).kind === 'directory_publication_intent');
      const resultIndex = lines.findIndex(line => JSON.parse(line).kind === 'directory_publication_result');
      assert.ok(index >= 0 && resultIndex > index);
      const intent = JSON.parse(lines[index]!); intent.expected.mode = intent.expected.mode === 0o600 ? 0o644 : 0o600;
      lines[index] = JSON.stringify(intent);
      const result = JSON.parse(lines[resultIndex]!); result.intent = createHash('sha256').update(JSON.stringify(intent)).digest('hex');
      result.outcome.observation.mode = intent.expected.mode; lines[resultIndex] = JSON.stringify(result);
      const receiptPath = `${session.file}.publication-receipt-${intent.id}`, receiptBytes = fs.readFileSync(receiptPath);
      try {
        const prefix = Buffer.from(lines.slice(0, resultIndex + 1).join('\n') + '\n'), receipt = JSON.parse(receiptBytes.toString());
        receipt.intent = result.intent; receipt.result = createHash('sha256').update(JSON.stringify(result)).digest('hex');
        receipt.journal = { bytes: prefix.length, sha256: createHash('sha256').update(prefix).digest('hex') };
        fs.writeFileSync(session.file, lines.join('\n') + '\n'); fs.writeFileSync(receiptPath, JSON.stringify(receipt));
        const inspect = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
          process.stdout.write(JSON.stringify(s.directoryPublications.map(p=>p.kind)));await s.close();`;
        for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
          ['--import', 'tsx', '--input-type=module', '-e', inspect, root, session.id], { encoding: 'utf8' })), ['unknown']);
      } finally { fs.writeFileSync(session.file, original); fs.writeFileSync(receiptPath, receiptBytes); }
    }
  }
});

test('directory rewind handoff transfers only current authority and rejects stale handoffs', async () => {
  for (const scenario of ['success', 'revoked-before', 'identity-failure', 'copy-failure', 'permission', 'silent-permission', 'stale', 'failure', 'cancel'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), local = path.join(root, 'value');
    fs.writeFileSync(local, 'BEFORE'); fs.writeFileSync(path.join(outside, 'value'), 'EXTERNAL');
    const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } });
    const session = Session.open(root, { config: settings });
    const controller = new AbortController(), runtime = await createRuntime(settings, new ScriptedProvider([]), controller.signal);
    try {
      await runtime.bindSession!(session);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const original = session.workingDirectories(false).readHandle?.(outside);
      assert.ok(original);
      if (scenario === 'revoked-before') session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      checkpointConversation(session, 'before-handoff', controller.signal);
      const preview = previewRewind(session, 0, controller.signal);
      const before = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl')).sort();
      let releaseCalled = false;
      const release = async () => {
        releaseCalled = true;
        if (scenario === 'permission') session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
        if (scenario === 'silent-permission') session.permissionUpdates = { ...session.permissionUpdates, mode: 'ask' };
        if (scenario === 'stale') fs.writeFileSync(local, 'AFTER');
        if (scenario === 'failure') throw new Error('release failed');
        if (scenario === 'cancel') controller.abort();
        await runtime.releaseSession!(session.id);
      };
      if (scenario === 'success' || scenario === 'revoked-before') {
        const next = await applyRewindAfterRelease(session, preview, preview.token, controller.signal, release);
        try {
          assert.equal(original.signal.aborted, true);
          const carried = next.workingDirectories(false).readHandle?.(outside);
          if (scenario === 'success') {
            assert.ok(carried); assert.equal(carried.owner, next.id); assert.notEqual(carried.incarnation, original.incarnation);
            assert.equal(carried.ino, original.ino); assert.equal(carried.dev, original.dev); assert.equal(carried.signal.aborted, false);
            next.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
            assert.equal(carried.signal.aborted, true);
          } else assert.equal(carried, undefined);
        } finally { await next.close(); }
      } else {
        const open = fs.openSync, lstat = fs.lstatSync, lstatDescriptor = Object.getOwnPropertyDescriptor(fs, 'lstatSync'), openSession = Session.open;
        assert.ok(lstatDescriptor);
        let prepared: Session | undefined, identityFailed = false;
        if (scenario === 'identity-failure') {
          Session.open = new Proxy(openSession, { apply(target, thisArg, args) {
            prepared = Reflect.apply(target, thisArg, args); return prepared;
          } });
          Object.defineProperty(fs, 'lstatSync', { ...lstatDescriptor, value: new Proxy(lstat, { apply(target, thisArg, args) {
            if (!identityFailed && prepared && String(args[0]) === prepared.file) { identityFailed = true; throw new Error('injected branch identity failure'); }
            return Reflect.apply(target, thisArg, args);
          } }) });
        }
        if (scenario === 'copy-failure') fs.openSync = new Proxy(open, { apply(target, thisArg, args) {
          if (String(args[0]) === `${process.platform === 'linux' ? '/proc/self/fd' : '/dev/fd'}/${original.fd}`) throw new Error('injected duplicate failure');
          return Reflect.apply(target, thisArg, args);
        } });
        try {
          await assert.rejects(applyRewindAfterRelease(session, preview, preview.token, controller.signal, release),
            scenario === 'identity-failure' ? /injected branch identity failure/ : scenario === 'copy-failure' ? /directory grant handoff failed/ : scenario === 'permission' || scenario === 'silent-permission' ? /permission state changed/ : scenario === 'stale' ? /preview is stale/ : scenario === 'failure' ? /release failed/ : /abort/i);
        } finally { fs.openSync = open; Object.defineProperty(fs, 'lstatSync', lstatDescriptor); Session.open = openSession; }
        if (scenario === 'identity-failure') {
          try { assert.ok(identityFailed && prepared); assert.equal(prepared.isOpen, false); }
          finally { await prepared?.close(); }
        }
        if (scenario === 'copy-failure') assert.equal(releaseCalled, false);
        if (scenario !== 'identity-failure') assert.deepEqual(fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl')).sort(), before);
      }
      assert.equal(fs.readFileSync(local, 'utf8'), scenario === 'stale' ? 'AFTER' : 'BEFORE');
      assert.equal(fs.readFileSync(path.join(outside, 'value'), 'utf8'), 'EXTERNAL');
    } finally { await runtime.close(); await session.close(); }
  }
});

test('directory rewind failure keeps the prior session usable', async () => {
  const root = workspace(), outside = workspace(), tools = createTools(), local = path.join(root, 'value'), external = path.join(outside, 'value');
  fs.writeFileSync(local, 'BEFORE'); fs.writeFileSync(external, 'STILL_AVAILABLE');
  const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } });
  const controller = new AbortController(), session = Session.open(root, { config: settings });
  const runtime = await createRuntime(settings, new ScriptedProvider([]), controller.signal);
  let current = session, resumedRuntime: Awaited<ReturnType<typeof createRuntime>> | undefined;
  try {
    await runtime.bindSession!(session);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const originalLease = runtime.sessionLease!(session);
    assert.equal(originalLease(), true);
    const original = session.workingDirectories(false).readHandle?.(outside);
    assert.ok(original);
    await new Agent(session, new ScriptedProvider([response([call('read-before-failure', 'read_file', { path: external })], 'tool_use'), done()]), tools).run('read before rewind');
    assert.match(JSON.stringify(session.messages), /STILL_AVAILABLE/);
    checkpointConversation(session, 'before-failed-rewind', controller.signal);
    const preview = previewRewind(session, 1, controller.signal);
    await assert.rejects(applyRewindAfterRelease(session, preview, preview.token, controller.signal, async () => {
      await runtime.releaseSession!(session.id);
      fs.writeFileSync(local, 'AFTER');
    }, async recovered => {
      current = recovered;
      resumedRuntime = await runtime.reconfigure!(recovered.config);
      await resumedRuntime.bindSession!(recovered);
    }), /preview is stale/);
    assert.equal(fs.readFileSync(local, 'utf8'), 'AFTER');
    assert.equal(session.isOpen, false); assert.equal(current.id, session.id); assert.notEqual(current, session);
    assert.equal(originalLease(), false); assert.equal(resumedRuntime?.sessionLease!(current)(), true);
    assert.throws(() => session.append({ kind: 'message', message: { role: 'user', content: 'stale continuation' } }), /closed/i);
    const resumed = current.workingDirectories(false).readHandle?.(outside);
    assert.ok(resumed); assert.equal(original.signal.aborted, true); assert.notEqual(resumed.incarnation, original.incarnation);
    assert.match(JSON.stringify(current.messages), /STILL_AVAILABLE/);
    fs.writeFileSync(external, 'CHANGED_AFTER_RECOVERY'); fs.utimesSync(external, 1700000000, 1700000000);
    const provider = new ScriptedProvider([response([call('read-after-failure', 'read_file', { path: external })], 'tool_use'), done()]);
    await new Agent(current, provider, tools).run('continue after failed rewind');
    const result = current.events.find(row => row.kind === 'tool_result' && row.result.tool_use_id === 'read-after-failure');
    assert.ok(result && result.kind === 'tool_result');
    assert.notEqual(result.result.is_error, true, JSON.stringify(result.result));
    assert.match(JSON.stringify(result.result.content), /CHANGED_AFTER_RECOVERY/);
    const previous = current, previousRuntime = resumedRuntime;
    assert.ok(previousRuntime);
    const secondPreview = previewRewind(previous, 1, controller.signal);
    await assert.rejects(applyRewindAfterRelease(previous, secondPreview, secondPreview.token, controller.signal, async () => {
      await previousRuntime.releaseSession!(previous.id); fs.writeFileSync(local, 'AFTER_SECOND');
    }, async recovered => {
      current = recovered;
      resumedRuntime = await previousRuntime.reconfigure!(recovered.config);
      await resumedRuntime.bindSession!(recovered);
      await previousRuntime.close();
    }), /preview is stale/);
    assert.equal(previous.isOpen, false); assert.equal(current.id, session.id);
    const twiceResumed = current.workingDirectories(false).readHandle?.(outside);
    assert.ok(twiceResumed); assert.equal(resumed.signal.aborted, true); assert.notEqual(twiceResumed.incarnation, resumed.incarnation);
    assert.match(JSON.stringify(current.messages), /STILL_AVAILABLE/);
    assert.match(JSON.stringify(current.messages), /CHANGED_AFTER_RECOVERY/);
    const fork = forkSession(current);
    try {
      assert.match(JSON.stringify(fork.messages), /STILL_AVAILABLE/);
      assert.match(JSON.stringify(fork.messages), /CHANGED_AFTER_RECOVERY/);
    } finally { await fork.close(); }
    const forkReader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      process.stdout.write(JSON.stringify(s.messages));await s.close();`;
    for (let i = 0; i < 2; i++) assert.doesNotMatch(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', forkReader, root, fork.id], { encoding: 'utf8' }), /STILL_AVAILABLE|CHANGED_AFTER_RECOVERY/);
    assert.throws(() => Session.open(root, { id: session.id }), /Session lock|Session is active|EEXIST/);
    const lockReader = `import {Session} from './src/session.ts';try{const s=Session.open(process.argv[1],{id:process.argv[2]});await s.close();process.stdout.write('opened')}
      catch(error){if(!/Session lock|Session is active|EEXIST/.test(String(error)))throw error;process.stdout.write('blocked')}`;
    assert.equal(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', lockReader, root, session.id], { encoding: 'utf8' }), 'blocked');
    current.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    assert.doesNotMatch(JSON.stringify(current.messages), /STILL_AVAILABLE/);
    assert.doesNotMatch(JSON.stringify(current.messages), /CHANGED_AFTER_RECOVERY/);
    current.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    assert.doesNotMatch(JSON.stringify(current.messages), /STILL_AVAILABLE|CHANGED_AFTER_RECOVERY/);
    const regrantedFork = forkSession(current);
    try { assert.doesNotMatch(JSON.stringify(regrantedFork.messages), /STILL_AVAILABLE|CHANGED_AFTER_RECOVERY/); }
    finally { await regrantedFork.close(); }
    await resumedRuntime?.close(); resumedRuntime = undefined; await current.close();
    const coldReader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      process.stdout.write(JSON.stringify({messages:s.messages,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', coldReader, root, session.id, outside], { encoding: 'utf8' }));
      assert.equal(cold.grant, false); assert.doesNotMatch(JSON.stringify(cold.messages), /STILL_AVAILABLE|CHANGED_AFTER_RECOVERY/);
    }
  } finally { await resumedRuntime?.close(); await runtime.close(); await current.close(); await session.close(); }
});

test('directory rewind recovers only after release completed before a callback failure', async () => {
  for (const stage of ['before', 'after'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), local = path.join(root, 'value'), external = path.join(outside, 'value');
    fs.writeFileSync(local, 'BEFORE'); fs.writeFileSync(external, 'LIVE_AFTER_FAILURE');
    const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }), signal = new AbortController().signal;
    const session = Session.open(root, { config: settings }), runtime = await createRuntime(settings, new ScriptedProvider([]), signal);
    let current = session, resumedRuntime: Awaited<ReturnType<typeof createRuntime>> | undefined, recovered = false;
    try {
      await runtime.bindSession!(session);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      checkpointConversation(session, 'before-release-callback', signal);
      fs.writeFileSync(local, 'AFTER');
      const preview = previewRewind(session, 0, signal), lease = runtime.sessionLease!(session);
      await assert.rejects(applyRewindAfterRelease(session, preview, preview.token, signal, async completed => {
        if (stage === 'after') await runtime.releaseSession!(session.id, completed);
        throw new Error(`release callback failed ${stage}`);
      }, async next => {
        recovered = true; current = next;
        resumedRuntime = await runtime.reconfigure!(next.config); await resumedRuntime.bindSession!(next);
      }), new RegExp(`release callback failed ${stage}`));
      assert.equal(fs.readFileSync(local, 'utf8'), 'AFTER');
      assert.equal(recovered, stage === 'after');
      if (stage === 'before') {
        assert.equal(session.isOpen, true); assert.equal(lease(), true);
        assert.ok(session.workingDirectories(false).readHandle?.(outside));
      } else {
        assert.equal(session.isOpen, false); assert.equal(current.id, session.id); assert.equal(lease(), false);
        assert.equal(resumedRuntime?.sessionLease!(current)(), true); assert.ok(current.workingDirectories(false).readHandle?.(outside));
        const provider = new ScriptedProvider([response([call('read-after-release-callback', 'read_file', { path: external })], 'tool_use'), done()]);
        await new Agent(current, provider, tools).run('continue after release callback failure');
        assert.match(JSON.stringify(resultBatches(current)), /LIVE_AFTER_FAILURE/);
      }
    } finally { await resumedRuntime?.close(); await runtime.close(); await current.close(); await session.close(); }
  }
});

test('interactive handles a committed rewind when successor runtime binding fails', { timeout: 30000 }, async () => {
  for (const stage of ['before', 'after', 'reconfigure-failure', 'cleanup-failure', 'cleanup-rejection', 'second-bind-failure', 'nested-cleanup-unknown'] as const) {
    const root = workspace(), outside = workspace(), local = path.join(root, 'value'), external = path.join(outside, 'value');
    fs.writeFileSync(local, 'BEFORE'); fs.writeFileSync(external, 'REWIND_BIND_CONTENT');
    const signal = new AbortController().signal, input = new PassThrough();
    const provider = new ScriptedProvider([response([call('read-after-bind', 'read_file', { path: external })], 'tool_use'),
      () => { setImmediate(() => input.write('/exit\n')); return done(); }]);
    const settings = config(root, createTools(), { permissions: { mode: 'bypass', allow: [], deny: [] },
      ...(stage === 'cleanup-rejection' ? { allowShell: true, features: { tasks: false, subagents: false, background: true } } : {}) });
    const runtime = await createRuntime(settings, provider, signal); settings.tools = pinToolSchemas(runtime.tools);
    const session = Session.open(root, { config: settings });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    checkpointConversation(session, 'before-bind-failure', signal); fs.writeFileSync(local, 'AFTER');
    const bind = runtime.bindSession!, backgroundClose = BackgroundRegistry.prototype.close;
    let failed = false, fallbackClosed = false, reconfigured = false, sentApply = false, sentRegrant = false, sentContinuation = false, timedOut = false, text = '', status = '';
    runtime.bindSession = async next => {
      if (next.id !== session.id && !failed) {
        failed = true; if (stage === 'after' || stage === 'cleanup-rejection') await bind(next);
        if (stage === 'cleanup-rejection') {
          const start = runtime.buildTools(next.config, next.id).find(tool => tool.schema.name === 'run_background'); assert.ok(start);
          await start.execute({ command: 'printf bind-cleanup-fixture' }, { workspace: root, signal, allowShell: true, maxOutputBytes: 24000, session: next });
          BackgroundRegistry.prototype.close = async function() { await backgroundClose.call(this); throw new Error('injected bind cleanup rejection'); };
        }
        if (stage === 'nested-cleanup-unknown') throw new RuntimeHandoffCleanupError([new Error('injected nested cleanup failure')]);
        throw new Error('injected successor bind failure');
      }
      return bind(next);
    };
    if (stage === 'reconfigure-failure') runtime.reconfigure = async () => { throw new Error('injected reconfigure failure'); };
    if (stage === 'cleanup-failure') runtime.closeForHandoff = async () => { throw new Error('injected cleanup failure'); };
    if (stage === 'nested-cleanup-unknown') {
      const reconfigure = runtime.reconfigure!;
      runtime.reconfigure = async nextConfig => { reconfigured = true; return reconfigure(nextConfig); };
    }
    if (stage === 'second-bind-failure') {
      const reconfigure = runtime.reconfigure!;
      runtime.reconfigure = async nextConfig => {
        const fresh = await reconfigure(nextConfig), close = fresh.close.bind(fresh);
        fresh.bindSession = async () => { throw new Error('injected second bind failure'); };
        fresh.close = async () => { fallbackClosed = true; await close(); };
        return fresh;
      };
    }
    const output = new Writable({ write(chunk, _encoding, callback) {
      text += String(chunk); const token = /Apply: \/rewind 0 --files --apply ([a-f0-9]{64})/.exec(text)?.[1];
      if (token && !sentApply) { sentApply = true; setImmediate(() => input.write(`/rewind 0 --files --apply ${token}\n`)); }
      if (text.includes('Rewound files and conversation to turn 0') && stage === 'after' && !sentRegrant) {
        sentRegrant = true; setImmediate(() => input.write(`/add-dir ${outside}\n`));
      }
      if (text.includes('Rewound files and conversation to turn 0') && (stage !== 'after' || text.includes(`Added ${outside}`)) && !sentContinuation) {
        sentContinuation = true; setImmediate(() => input.write('continue after rewind\n'));
      }
      callback();
    } });
    const errors = new Writable({ write(chunk, _encoding, callback) {
      status += String(chunk); if (status.includes('error: injected successor bind failure')) setImmediate(() => input.write('/exit\n'));
      callback();
    } });
    const deadline = setTimeout(() => { timedOut = true; input.write('/exit\n'); }, 8000);
    try {
      input.write('/rewind 0 --files\n');
      await interactiveLoop(session, provider, runtime, { input, output, status: errors, signal });
      assert.equal(timedOut, false, `${stage}: ${status}`); assert.equal(failed, true); assert.equal(fs.readFileSync(local, 'utf8'), 'BEFORE');
      if (stage === 'before' || stage === 'after') {
        assert.match(text, /Rewound files and conversation to turn 0/);
        if (stage === 'after') assert.match(text, /add additional directories again/);
        assert.equal(provider.requests.length, 2); assert.match(JSON.stringify(provider.requests[1]?.messages), /REWIND_BIND_CONTENT/);
      } else {
        assert.match(status, /Rewind committed in session [0-9a-f-]{36}; runtime recovery failed/);
        assert.match(text, /Rewind committed in session [0-9a-f-]{36}; runtime recovery failed/);
        assert.equal(provider.requests.length, 0);
        if (stage === 'second-bind-failure') assert.equal(fallbackClosed, true);
        if (stage === 'nested-cleanup-unknown') assert.equal(reconfigured, false);
      }
      const dir = path.join(root, '.agent'), branch = fs.readdirSync(dir).filter(name => name.endsWith('.jsonl')).find(name =>
        fs.readFileSync(path.join(dir, name), 'utf8').includes('"reason":"rewind"'));
      assert.ok(branch); const id = JSON.parse(fs.readFileSync(path.join(dir, branch), 'utf8').split('\n')[0]!).id;
      const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
        process.stdout.write(JSON.stringify({branch:s.events.some(e=>e.kind==='branch'&&e.reason==='rewind'),messages:s.messages,
          grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, id, outside], { encoding: 'utf8' }));
        assert.equal(cold.branch, true); assert.equal(cold.grant, false); assert.doesNotMatch(JSON.stringify(cold.messages), /REWIND_BIND_CONTENT/);
      }
    } finally {
      clearTimeout(deadline); BackgroundRegistry.prototype.close = backgroundClose;
      try { await runtime.close(); } catch (error) { if (stage !== 'cleanup-rejection') throw error; }
      await session.close(); input.destroy();
    }
  }
});

test('interactive stops when a committed rewind fails during successor acceptance', { timeout: 30000 }, async () => {
  for (const stage of ['scheduler', 'source-close', 'source-unlink', 'tool-build', 'cleanup-failure', 'alternate-runtime', 'old-cleanup-failure'] as const) {
  const root = workspace(), local = path.join(root, 'value'), signal = new AbortController().signal, input = new PassThrough();
  fs.writeFileSync(local, 'BEFORE');
  const provider = new ScriptedProvider([() => { setImmediate(() => input.write('/exit\n')); return done(); }]);
  const settings = config(root, createTools(), { permissions: { mode: 'bypass', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, provider, signal); settings.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(root, { config: settings }), settle = runtime.settleScheduler!, bind = runtime.bindSession!;
  const build = runtime.buildTools.bind(runtime), close = Session.prototype.close, strictClose = runtime.closeForHandoff!, runtimeClose = runtime.close, unlink = fs.unlinkSync;
  const sourceLock = `${session.file}.lock`, sourceLockBytes = fs.readFileSync(sourceLock);
  let child: Session | undefined, freshRuntime: Awaited<ReturnType<typeof createRuntime>> | undefined;
  let injected = false, childId = '', applied = false, timedOut = false, text = '', status = '';
  try {
    checkpointConversation(session, 'before-accept-failure', signal); fs.writeFileSync(local, 'AFTER');
    const fail = (): never => {
      injected = true; setImmediate(() => input.write('continue despite failed handoff\n'));
      throw new Error(`injected committed accept ${stage} failure`);
    };
    runtime.bindSession = async next => {
      if (next.id === session.id) return bind(next);
      child = next; childId = next.id;
      if (stage === 'alternate-runtime' || stage === 'old-cleanup-failure') {
        freshRuntime = await runtime.reconfigure!(next.config);
        await freshRuntime.bindSession!(next);
        if (stage === 'alternate-runtime') freshRuntime.settleScheduler = async () => fail();
        return freshRuntime;
      }
      return bind(next);
    };
    runtime.settleScheduler = async (owner, ids, loading) => {
      if (owner !== session.id && !injected && (stage === 'scheduler' || stage === 'cleanup-failure')) return fail();
      return settle(owner, ids, loading);
    };
    if (stage === 'source-close') Session.prototype.close = function() {
      const result = close.call(this);
      if (this === session && child && !injected) fail();
      return result;
    };
    if (stage === 'source-unlink') fs.unlinkSync = target => {
      if (String(target) === sourceLock && child && !injected) { fs.unlinkSync = unlink; return fail(); }
      return unlink(target);
    };
    if (stage === 'tool-build') runtime.buildTools = (settings, owner) => {
      if (owner === childId && !session.isOpen && !injected) return fail();
      return build(settings, owner);
    };
    if (stage === 'cleanup-failure') runtime.closeForHandoff = async () => { throw new Error('injected handoff cleanup failure'); };
    if (stage === 'old-cleanup-failure') {
      const failedClose = async (): Promise<void> => { if (!injected) fail(); throw new Error('injected old runtime cleanup failure'); };
      runtime.close = failedClose; runtime.closeForHandoff = failedClose;
    }
    const output = new Writable({ write(chunk, _encoding, callback) {
      text += String(chunk); const token = /Apply: \/rewind 0 --files --apply ([a-f0-9]{64})/.exec(text)?.[1];
      if (token && !applied) { applied = true; setImmediate(() => input.write(`/rewind 0 --files --apply ${token}\n`)); }
      callback();
    } });
    const errors = new Writable({ write(chunk, _encoding, callback) { status += String(chunk); callback(); } });
    const deadline = setTimeout(() => { timedOut = true; input.write('/exit\n'); }, 10000);
    try { input.write('/rewind 0 --files\n'); await interactiveLoop(session, provider, runtime, { input, output, status: errors, signal }); }
    finally { clearTimeout(deadline); }
    assert.equal(timedOut, false, `${stage}: ${status}`); assert.equal(injected, true); assert.ok(childId); assert.ok(child);
    assert.equal(fs.readFileSync(local, 'utf8'), 'BEFORE');
    assert.equal(provider.requests.length, 0);
    assert.match(text, new RegExp(`Rewind committed in session ${childId}; session handoff is incomplete`));
    if (stage === 'source-unlink') {
      assert.match(text, /handoff cleanup is unconfirmed/); assert.equal(child.isOpen, false);
      assert.deepEqual(fs.readFileSync(sourceLock), sourceLockBytes); fs.unlinkSync(sourceLock);
    } else if (stage === 'cleanup-failure' || stage === 'old-cleanup-failure') {
      assert.match(text, /handoff cleanup is unconfirmed/); assert.equal(child.isOpen, true);
      assert.throws(() => Session.open(root, { id: childId }), /lock|active|EEXIST/i);
      runtime.closeForHandoff = strictClose; runtime.close = runtimeClose;
      await runtime.closeForHandoff();
      await freshRuntime?.close();
      await child.close();
    } else assert.equal(child.isOpen, false);
    const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      process.stdout.write(JSON.stringify({branch:s.events.some(e=>e.kind==='branch'&&e.reason==='rewind'),messages:s.messages}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, childId], { encoding: 'utf8' }));
      assert.equal(cold.branch, true); assert.doesNotMatch(JSON.stringify(cold.messages), /continue despite failed handoff/);
    }
  } finally {
    Session.prototype.close = close; runtime.closeForHandoff = strictClose; runtime.close = runtimeClose; fs.unlinkSync = unlink;
    await freshRuntime?.close(); await runtime.close(); await child?.close(); await session.close(); input.destroy();
  }
  }
});

test('compiled CLI clear waits for a concurrent owner release', { timeout: 30000 }, async () => {
  const root = workspace(), userDir = path.join(root, 'user'), preload = path.join(root, 'owner-release-provider.mjs');
  const held = path.join(root, 'release-held.json'), acknowledged = path.join(root, 'release-acknowledged');
  fs.mkdirSync(userDir);
  const runtimeUrl = new URL('../dist/runtime.js', import.meta.url).href;
  fs.writeFileSync(preload, `import fs from 'node:fs';import{registerHooks}from'node:module';globalThis.fetch=()=>{throw Error('fixture network disabled')};
    registerHooks({load(url,context,next){const loaded=next(url,context);if(url!==${JSON.stringify(runtimeUrl)})return loaded;
      const source=typeof loaded.source==='string'?loaded.source:Buffer.from(loaded.source).toString('utf8'),at=source.lastIndexOf('return runtime;');
      if(at<0)throw Error('runtime capture missing');return{...loaded,source:source.slice(0,at)+'globalThis.__ownerReleaseRuntime=runtime; '+source.slice(at)}}});
    const{Agent}=await import(${JSON.stringify(new URL('../dist/agent.js', import.meta.url).href)}),run=Agent.prototype.run;
    Agent.prototype.run=function(...args){if(this.session.config.workspace===${JSON.stringify(root)})globalThis.__ownerReleaseSession=this.session.id;return run.apply(this,args)};
    const{BackgroundRegistry}=await import(${JSON.stringify(new URL('../dist/background.js', import.meta.url).href)}),close=BackgroundRegistry.prototype.close;let tested=false;
    BackgroundRegistry.prototype.close=async function(){if(tested)return close.call(this);tested=true;
      const runtime=globalThis.__ownerReleaseRuntime,owner=globalThis.__ownerReleaseSession;if(!runtime||!owner)throw Error('release owner missing');
      let early=false;void runtime.releaseSession(owner,()=>{early=true;fs.writeFileSync(${JSON.stringify(acknowledged)},owner)}).catch(error=>{throw error});
      await new Promise(resolve=>setImmediate(resolve));
      fs.writeFileSync(${JSON.stringify(held)},JSON.stringify({owner,early}));await close.call(this)};
    const{GatewayProvider}=await import(${JSON.stringify(new URL('../dist/provider.js', import.meta.url).href)});let calls=0;
    GatewayProvider.prototype.count=async()=>1;GatewayProvider.prototype.complete=async()=>{const first=calls++===0;
      return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:first?[{type:'tool_use',id:'cli-release-background',name:'run_background',
        input:{command:'printf OWNER_RELEASE_CLI'}}]:[{type:'text',text:'done'}],stop_reason:first?'tool_use':'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}};`);
  const cli = childProcess.spawnSync(process.execPath, ['bin/litcode.mjs', '--workspace', root, '--user-dir', userDir,
    '--model', 'fixture-model', '--permission-mode', 'bypass', '--allow-shell', '--interactive', '--no-tui', '--no-inherit-gateway'],
    { cwd: process.cwd(), input: 'start a background task\n/clear\n/exit\n', encoding: 'utf8', timeout: 20000,
      env: { ...process.env, HOME: userDir, LLM_API_KEY: 'fixture-only', NODE_OPTIONS: `--import=${preload}` } });
  assert.equal(cli.status, 0, cli.stderr + cli.stdout);
  assert.equal(fs.existsSync(held), true, cli.stderr + cli.stdout + '\n' + fs.readdirSync(path.join(root, '.agent'))
    .filter(name => name.endsWith('.jsonl')).flatMap(name => fs.readFileSync(path.join(root, '.agent', name), 'utf8').trimEnd().split('\n')
      .map(line => JSON.parse(line)).filter(row => row.kind === 'tool_result').map(row => JSON.stringify(row))).join('\n'));
  const observed = JSON.parse(fs.readFileSync(held, 'utf8'));
  assert.equal(observed.early, false); assert.equal(fs.readFileSync(acknowledged, 'utf8'), observed.owner);
  const journals = fs.readdirSync(path.join(root, '.agent')).filter(name => name.endsWith('.jsonl'));
  assert.equal(journals.length, 2);
  assert.equal(fs.readdirSync(path.join(root, '.agent')).some(name => name.endsWith('.jsonl.lock')), false);
  const reader = `import{Session}from'./dist/session.js';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({starts:s.events.filter(e=>e.kind==='tool_start'&&e.id==='cli-release-background').length,
      results:s.events.filter(e=>e.kind==='tool_result'&&e.result.tool_use_id==='cli-release-background').length}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, observed.owner],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
    assert.equal(cold.status, 0, cold.stderr); assert.deepEqual(JSON.parse(cold.stdout), { starts: 1, results: 1 });
  }
});

test('runtime release does not acknowledge failed resource cleanup', async () => {
  const root = workspace(), signal = new AbortController().signal;
  const settings = config(root, [], { allowShell: true, features: { tasks: false, subagents: false, background: true }, permissions: { mode: 'bypass', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, new ScriptedProvider([]), signal);
  settings.tools = pinToolSchemas(runtime.tools);
  const session = Session.open(root, { config: settings }), close = BackgroundRegistry.prototype.close;
  let attempted = false, acknowledged = false;
  try {
    await runtime.bindSession!(session);
    const tools = runtime.buildTools(session.config, session.id), start = tools.find(tool => tool.schema.name === 'run_background');
    assert.ok(start);
    await start.execute({ command: 'printf cleanup-fixture' }, { workspace: root, signal, allowShell: true, maxOutputBytes: 24000, session });
    BackgroundRegistry.prototype.close = async function() { attempted = true; await close.call(this); throw new Error('injected background cleanup failure'); };
    await assert.rejects(runtime.releaseSession!(session.id, () => { acknowledged = true; }), /Runtime cleanup incomplete/);
    assert.equal(attempted, true); assert.equal(acknowledged, false);
  } finally { BackgroundRegistry.prototype.close = close; await runtime.close(); await session.close(); }
});

test('directory rewind resumes only after an uncommitted restore rolls back', async () => {
  for (const stage of ['rewind', 'branch', 'conflict'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), local = path.join(root, 'value'), external = path.join(outside, 'value');
    fs.writeFileSync(local, 'BEFORE'); fs.writeFileSync(external, 'ROLLBACK_GRANT_CONTENT');
    const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }), signal = new AbortController().signal;
    const session = Session.open(root, { config: settings }), runtime = await createRuntime(settings, new ScriptedProvider([]), signal);
    const append = Session.prototype.append;
    let current = session, resumedRuntime: Awaited<ReturnType<typeof createRuntime>> | undefined, recovered = false;
    try {
      await runtime.bindSession!(session);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, new ScriptedProvider([response([call('rollback-read', 'read_file', { path: external })], 'tool_use'), done()]), tools).run('read before rewind');
      checkpointConversation(session, 'before-restore-failure', signal);
      fs.writeFileSync(local, 'AFTER');
      const preview = previewRewind(session, 1, signal);
      Session.prototype.append = function(event, ...args) {
        append.call(this, event, ...args);
        if (this !== session && (event.kind === stage || stage === 'conflict' && event.kind === 'rewind')) {
          if (stage === 'conflict') fs.writeFileSync(local, 'CONCURRENT_CONFLICT');
          throw new Error(`injected ${stage} append failure`);
        }
      };
      await assert.rejects(applyRewindAfterRelease(session, preview, preview.token, signal,
        async () => runtime.releaseSession!(session.id), async next => {
          recovered = true; current = next;
          resumedRuntime = await runtime.reconfigure!(next.config); await resumedRuntime.bindSession!(next);
        }), /injected|history committed/);
      if (stage === 'rewind') {
        assert.equal(fs.readFileSync(local, 'utf8'), 'AFTER');
        assert.equal(recovered, true); assert.equal(session.isOpen, false); assert.equal(current.id, session.id);
        assert.ok(current.workingDirectories(false).readHandle?.(outside));
        assert.match(JSON.stringify(current.messages), /ROLLBACK_GRANT_CONTENT/);
        assert.equal(fs.existsSync(path.join(root, '.agent/checkpoints/transaction.json')), false);
      } else {
        assert.equal(fs.readFileSync(local, 'utf8'), stage === 'branch' ? 'BEFORE' : 'CONCURRENT_CONFLICT');
        assert.equal(recovered, false); assert.equal(session.isOpen, true);
        assert.equal(fs.existsSync(path.join(root, '.agent/checkpoints/transaction.json')), true);
      }
    } finally {
      Session.prototype.append = append;
      await resumedRuntime?.close(); await runtime.close(); await current.close(); await session.close();
    }
  }
});

test('directory rewind recovery retains the original lock on changed or unavailable evidence', async () => {
  for (const scenario of ['gate', 'journal', 'retained-revoked', 'config', 'pending-transaction'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } });
    const session = Session.open(root, { config: settings }), retained = Session.open(root, { config: settings });
    const runtime = await createRuntime(settings, new ScriptedProvider([]), new AbortController().signal);
    let gate: number | undefined, journal: Buffer | undefined;
    try {
      await runtime.bindSession!(session);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      retained.carryPermissions(session);
      const recovery = session.prepareRewindRecovery(retained);
      assert.ok(recovery);
      journal = fs.readFileSync(session.file);
      await runtime.releaseSession!(session.id);
      if (scenario === 'gate') {
        gate = fs.openSync(`${session.file}.lock.gate`, 'r+'); assert.equal(lockFile(gate, false), true);
      } else if (scenario === 'journal') fs.appendFileSync(session.file, '{}\n');
      else if (scenario === 'retained-revoked') retained.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      else if (scenario === 'config') session.config.verbose = !session.config.verbose;
      else {
        const checkpointStore = path.join(root, '.agent', 'checkpoints'); fs.mkdirSync(checkpointStore, { recursive: true });
        fs.writeFileSync(path.join(checkpointStore, 'transaction.json'), '{}');
      }
      await assert.rejects(recovery.restore(), scenario === 'gate' ? /gate unavailable/ : scenario === 'journal' ? /journal changed/ :
        scenario === 'retained-revoked' ? /grant mismatch/ : /authority changed/);
      assert.equal(session.isOpen, true); assert.equal(fs.existsSync(`${session.file}.lock`), true);
      await assert.rejects(recovery.restore(), /already consumed/);
      if (scenario === 'journal') fs.writeFileSync(session.file, journal);
      assert.deepEqual(fs.readFileSync(session.file), journal);
    } finally {
      if (gate !== undefined) fs.closeSync(gate);
      if (journal && fs.existsSync(session.file) && scenario === 'journal') fs.writeFileSync(session.file, journal);
      await retained.close(); await runtime.close(); await session.close();
    }
  }
});

test('directory rewind with changed permissions resumes without reviving earlier grants', async () => {
  const root = workspace(), outside = workspace(), tools = createTools(), external = path.join(outside, 'value');
  fs.writeFileSync(external, 'EARLIER_GRANT_CONTENT');
  const settings = config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }), signal = new AbortController().signal;
  const session = Session.open(root, { config: settings }), runtime = await createRuntime(settings, new ScriptedProvider([]), signal);
  let current = session, resumedRuntime: Awaited<ReturnType<typeof createRuntime>> | undefined;
  try {
    await runtime.bindSession!(session);
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('old-read', 'read_file', { path: external })], 'tool_use'), done()]), tools).run('read before change');
    checkpointConversation(session, 'before-permission-change', signal);
    const preview = previewRewind(session, 1, signal);
    await assert.rejects(applyRewindAfterRelease(session, preview, preview.token, signal, async () => {
      session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await runtime.releaseSession!(session.id);
    }, async recovered => {
      current = recovered; resumedRuntime = await runtime.reconfigure!(recovered.config); await resumedRuntime.bindSession!(recovered);
    }), /permission state changed/);
    assert.equal(session.isOpen, false); assert.equal(current.id, session.id); assert.notEqual(current, session);
    assert.equal(current.workingDirectories(false).readHandle?.(outside), undefined);
    assert.doesNotMatch(JSON.stringify(current.messages), /EARLIER_GRANT_CONTENT/);
    current.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    current.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    assert.ok(current.workingDirectories(false).readHandle?.(outside));
    assert.doesNotMatch(JSON.stringify(current.messages), /EARLIER_GRANT_CONTENT/);
    fs.writeFileSync(external, 'NEW_GRANT_CONTENT');
    await new Agent(current, new ScriptedProvider([response([call('new-read', 'read_file', { path: external })], 'tool_use'), done()]), tools).run('read after regrant');
    assert.match(JSON.stringify(current.messages), /NEW_GRANT_CONTENT/);
    await resumedRuntime?.close(); resumedRuntime = undefined; await current.close();
    const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
      process.stdout.write(JSON.stringify({messages:s.messages,grant:!!s.workingDirectories(false).readHandle?.(process.argv[3])}));await s.close();`;
    for (let i = 0; i < 2; i++) {
      const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id, outside], { encoding: 'utf8' }));
      assert.equal(cold.grant, false); assert.doesNotMatch(JSON.stringify(cold.messages), /EARLIER_GRANT_CONTENT|NEW_GRANT_CONTENT/);
    }
  } finally { await resumedRuntime?.close(); await runtime.close(); await current.close(); await session.close(); }
});

test('child workspace rewind still applies without a root recovery owner', async () => {
  const root = workspace(), tools = createTools(), settings = config(root, tools, { childMode: 'explore', permissions: { mode: 'bypass', allow: [], deny: [] } });
  const session = Session.open(root, { config: settings }), signal = new AbortController().signal;
  let next: Session | undefined;
  try {
    fs.writeFileSync(path.join(root, 'value'), 'BEFORE');
    checkpointConversation(session, 'child-rewind', signal);
    fs.writeFileSync(path.join(root, 'value'), 'AFTER');
    const preview = previewRewind(session, 0, signal);
    next = await applyRewindAfterRelease(session, preview, preview.token, signal,
      async () => session.releaseDirectoryAuthority(), async () => { throw new Error('unexpected recovery'); });
    assert.equal(fs.readFileSync(path.join(root, 'value'), 'utf8'), 'BEFORE');
    assert.notEqual(next.id, session.id);
  } finally { await next?.close(); await session.close(); }
});

test('directory rewind plan binds checkpoint bytes, modes, parents and live grants', async () => {
  const root = workspace(), outside = workspace(), parent = path.join(outside, 'nested'), target = path.join(parent, 'value'), tools = createTools();
  fs.mkdirSync(parent);
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const signal = new AbortController().signal, original = Buffer.from([0, 255, 65, 10, 128]);
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    checkpointConversation(session, 'before-tracking', signal);
    await new Agent(session, new ScriptedProvider([response([call('track-plan', 'write_file', { path: target, content: 'TRACKED' })], 'tool_use'), done()]), tools).run('track fixture');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined);
    fs.writeFileSync(target, original); fs.chmodSync(target, 0o751);
    await checkpointConversationWithDirectoryWitness(session, 'present-plan', signal);
    const journal = fs.readFileSync(session.file);
    const unchanged = planDirectoryRewind(session, 'present-plan', signal);
    assert.equal(unchanged.kind, 'available');
    if (unchanged.kind !== 'available') throw new Error('plan unavailable');
    assert.equal(unchanged.entries[0]?.action, 'unchanged');
    fs.chmodSync(target, 0o640);
    const mode = planDirectoryRewind(session, 'present-plan', signal);
    assert.equal(mode.kind, 'available');
    if (mode.kind !== 'available') throw new Error('mode plan unavailable');
    assert.equal(mode.entries[0]?.action, 'write'); assert.notEqual(mode.digest, unchanged.digest);
    fs.writeFileSync(target, 'AFTER');
    const changed = planDirectoryRewind(session, 'present-plan', signal);
    assert.equal(changed.kind, 'available');
    if (changed.kind !== 'available') throw new Error('changed plan unavailable');
    const entry = changed.entries[0]; assert.ok(entry && entry.before.kind === 'present' && entry.after.kind === 'present');
    assert.equal(entry.before.bytes.toString(), 'AFTER'); assert.deepEqual(entry.after.bytes, original);
    assert.equal(entry.after.observation.mode, 0o751); assert.equal(entry.action, 'write');
    const encoded = encodeDirectoryRewindPlan(changed); assert.ok(encoded);
    const originalBefore = entry.before;
    assert.throws(() => encodeDirectoryRewindPlan({ ...changed, entries: [{ ...entry,
      before: { ...originalBefore, bytes: Buffer.from('OTHER') } }] }), /plan changed before encoding/);
    assert.equal(encoded.record.owner, session.id); assert.equal(encoded.record.checkpoint.name, 'present-plan');
    assert.equal(encoded.record.plan, changed.digest); assert.equal(encoded.record.operations[0]?.stage.kind, 'prepared');
    assert.equal(verifyDirectoryRewindObjects(encoded.record, digest => {
      const bytes = encoded.objects.get(digest); assert.ok(bytes); return bytes;
    }).size, 2);
    assert.throws(() => verifyDirectoryRewindObjects(encoded.record, () => Buffer.from('CORRUPT')), /object changed/);
    assert.equal(directoryRewindEvidenceSchema.safeParse({ ...encoded.record, operations: [...encoded.record.operations, ...encoded.record.operations] }).success, false);
    assert.equal(directoryRewindEvidenceSchema.safeParse({ ...encoded.record, owner: randomUUID() }).success, false);
    const pending = path.join(root, '.agent/checkpoints/transaction.json'), workspaceTarget = path.join(root, 'pending-workspace');
    fs.writeFileSync(workspaceTarget, 'WORKSPACE_AFTER');
    const workspaceState = (value: string) => {
      const bytes = Buffer.from(value), sha256 = createHash('sha256').update(bytes).digest('hex');
      fs.writeFileSync(path.join(root, '.agent/checkpoints/objects', sha256), bytes);
      return { mode: fs.statSync(workspaceTarget).mode & 0o7777, size: bytes.length, sha256 };
    };
    const workspaceOperation = { path: 'pending-workspace', before: workspaceState('WORKSPACE_BEFORE'), after: workspaceState('WORKSPACE_AFTER') };
    const coldReader = `import fs from 'node:fs';import path from 'node:path';import {recoverCheckpoint} from './dist/checkpoints.js';
      const root=process.argv[1],pending=path.join(root,'.agent/checkpoints/transaction.json'),before=fs.readFileSync(pending);
      let error;try{recoverCheckpoint({workspace:root,signal:new AbortController().signal,allowShell:false,maxOutputBytes:24000})}catch(e){error=String(e)}
      process.stdout.write(JSON.stringify({error,retained:fs.readFileSync(pending).equals(before),workspace:fs.readFileSync(path.join(root,'pending-workspace'),'utf8')}));`;
    try {
      for (const state of ['pending', 'committed']) {
        fs.writeFileSync(pending, JSON.stringify({ version: 1, id: randomUUID(), workspace: root, state,
          operations: [workspaceOperation], directories: [], directory: encoded.record }));
        const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', coldReader, root],
          { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr);
        const result = JSON.parse(cold.stdout);
        assert.match(result.error, /external rewind requires live directory reconciliation/);
        assert.equal(result.retained, true); assert.equal(result.workspace, 'WORKSPACE_AFTER');
        assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER');
      }
    } finally { fs.rmSync(pending, { force: true }); fs.unlinkSync(workspaceTarget); }
    const grant = session.workingDirectories(false).readHandle?.(outside); assert.ok(grant);
    assert.equal(readStableDirectoryFile({ fd: grant.fd, relative: path.relative(outside, target) }, 2, signal), undefined);
    assert.notEqual(changed.digest, mode.digest);
    assert.deepEqual(planDirectoryRewind(session, 'before-tracking', signal), { kind: 'unknown' });
    fs.linkSync(target, path.join(outside, 'alias'));
    assert.deepEqual(planDirectoryRewind(session, 'present-plan', signal), { kind: 'unknown' });
    fs.unlinkSync(path.join(outside, 'alias')); fs.unlinkSync(target);
    const absent = planDirectoryRewind(session, 'present-plan', signal);
    assert.ok(absent.kind === 'available' && absent.entries[0]?.before.kind === 'missing' && absent.entries[0].action === 'write');
    assert.deepEqual(fs.readFileSync(session.file), journal);
    await checkpointConversationWithDirectoryWitness(session, 'missing-plan', signal);
    const missing = planDirectoryRewind(session, 'missing-plan', signal);
    assert.ok(missing.kind === 'available' && missing.entries[0]?.action === 'unchanged');
    fs.writeFileSync(target, 'NEW');
    const remove = planDirectoryRewind(session, 'missing-plan', signal);
    assert.ok(remove.kind === 'available' && remove.entries[0]?.action === 'remove' && remove.entries[0].after.kind === 'missing');
    const removal = encodeDirectoryRewindPlan(remove); assert.ok(removal);
    assert.equal(removal.record.operations[0]?.action, 'remove'); assert.equal(removal.objects.size, 1);
    fs.unlinkSync(target); fs.symlinkSync(session.file, target);
    assert.deepEqual(planDirectoryRewind(session, 'missing-plan', signal), { kind: 'unknown' });
    fs.unlinkSync(target); fs.writeFileSync(target, 'NEW');
    fs.renameSync(parent, `${parent}-retained`); fs.mkdirSync(parent); fs.writeFileSync(target, 'REPLACEMENT');
    assert.deepEqual(planDirectoryRewind(session, 'missing-plan', signal), { kind: 'unknown' });
    assert.equal(fs.readFileSync(path.join(`${parent}-retained`, 'value'), 'utf8'), 'NEW');
    fs.unlinkSync(target); fs.rmdirSync(parent); fs.renameSync(`${parent}-retained`, parent);
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    assert.deepEqual(planDirectoryRewind(session, 'missing-plan', signal), { kind: 'unknown' });
    assert.equal(fs.readFileSync(target, 'utf8'), 'NEW');
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const regranted = planDirectoryRewind(session, 'missing-plan', signal);
    assert.ok(regranted.kind === 'available'); assert.notEqual(regranted.digest, remove.digest);
    const cancelled = new AbortController(); cancelled.abort(new Error('cancel plan'));
    assert.throws(() => planDirectoryRewind(session, 'missing-plan', cancelled.signal), /cancel plan/);
    const successor = Session.open(root, { config: session.snapshotConfig() });
    try {
      assert.deepEqual(planDirectoryRewind(session, 'missing-plan', signal, successor), { kind: 'unknown' });
      successor.carryPermissions(session);
      session.releaseDirectoryAuthority();
      assert.deepEqual(planDirectoryRewind(session, 'missing-plan', signal), { kind: 'unknown' });
      const carried = planDirectoryRewind(session, 'missing-plan', signal, successor);
      assert.ok(carried.kind === 'available');
      const evidence = encodeDirectoryRewindPlan(carried); assert.ok(evidence);
      assert.equal(evidence.record.owner, successor.id); assert.equal(evidence.record.checkpoint.owner, session.id);
      assert.equal(evidence.record.operations[0]?.grant.owner, successor.id);
      assert.notEqual(carried.digest, regranted.digest);
    } finally { await successor.close(); }
  } finally { await session.close(); }
  const cold = Session.open(root, { id: session.id });
  try { assert.deepEqual(planDirectoryRewind(cold, 'missing-plan', signal), { kind: 'unknown' }); }
  finally { await cold.close(); }
});

test('directory rewind restores witnessed external and workspace files through default Write', async t => {
  for (const scenario of ['missing', 'present'] as const) await t.test(scenario, async () => {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    const workspaceTarget = path.join(root, 'workspace-value'), original = Buffer.from([0, 255, 65, 10, 128]);
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const signal = new AbortController().signal;
    let next: Session | undefined;
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      const provider = new ScriptedProvider([
        response([call('track-external', 'write_file', { path: target, content: 'TRACKED' })], 'tool_use'), done(),
        response([call('read-workspace', 'read_file', { path: 'workspace-value' }),
          ...(scenario === 'present' ? [call('read-external', 'read_file', { path: target })] : [])], 'tool_use'),
        response([call('change-external', 'write_file', { path: target, content: 'AFTER', overwrite: true }),
          call('change-workspace', 'write_file', { path: 'workspace-value', content: 'WORKSPACE_AFTER', overwrite: true })], 'tool_use'), done(),
      ]);
      const agent = new Agent(session, provider, tools);
      await agent.run('track external fixture');
      assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined);
      assert.equal(fs.readFileSync(target, 'utf8'), 'TRACKED');
      // Owned fixture setup establishes the actual state that the checkpoint must capture.
      if (scenario === 'missing') fs.unlinkSync(target);
      else { fs.writeFileSync(target, original); fs.chmodSync(target, 0o751); }
      fs.writeFileSync(workspaceTarget, 'WORKSPACE_BEFORE');
      const captured = await checkpointConversationWithDirectoryWitness(session, 'mixed-before', signal);
      assert.ok('external_witness' in captured);
      assert.equal(captured.external_witness, 'available');
      const witness = inspectDirectoryCheckpointWitness(session, 'mixed-before');
      assert.equal(witness.kind, 'available');
      if (witness.kind !== 'available') throw new Error('missing checkpoint witness');
      assert.equal(witness.entries.find(entry => entry.path.lexicalPath === target)?.observation.kind, scenario);
      if (scenario === 'present') assert.deepEqual(readDirectoryCheckpointBackup(session, 'mixed-before', target), original);
      await agent.run('change both files');
      assert.ok(resultBatches(session).at(-1)?.every(result => !result.is_error), JSON.stringify(resultBatches(session)));
      assert.equal(fs.readFileSync(target, 'utf8'), 'AFTER');
      assert.equal(fs.readFileSync(workspaceTarget, 'utf8'), 'WORKSPACE_AFTER');
      if (scenario === 'present') fs.chmodSync(target, 0o640);
      const preview = previewRewind(session, 1, signal);
      assert.deepEqual(preview.operations.find(operation => operation.path === 'workspace-value'), { path: 'workspace-value', action: 'write' });
      assert.deepEqual(preview.operations.find(operation => operation.path === target),
        { path: target, action: scenario === 'missing' ? 'remove' : 'write' });
      next = scenario === 'missing' ? applyRewind(session, preview, preview.token, signal) :
        await applyRewindAfterRelease(session, preview, preview.token, signal, async completed => { session.releaseDirectoryAuthority(); completed(); });
      assert.equal(fs.readFileSync(workspaceTarget, 'utf8'), 'WORKSPACE_BEFORE');
      if (scenario === 'missing') assert.equal(fs.existsSync(target), false);
      else { assert.deepEqual(fs.readFileSync(target), original); assert.equal(fs.statSync(target).mode & 0o7777, 0o751); }
      assert.notEqual(next.id, session.id);
      const store = path.join(root, '.agent/checkpoints');
      const receipts = fs.readdirSync(store).filter(name => /^directory-rewind-.*\.json$/.test(name));
      assert.equal(receipts.length, 1);
      const receipt = JSON.parse(fs.readFileSync(path.join(store, receipts[0]!), 'utf8'));
      assert.equal(receipt.state, 'committed'); assert.equal(receipt.branch.id, next.id);
      assert.equal(receipt.directory.owner, next.id);
      assert.equal(receipt.directory.operations[0].stage.kind, 'completed');
      assert.equal(fs.existsSync(path.join(store, 'transaction.json')), false);
      const nextId = next.id; await next.close(); next = undefined;
      const coldReader = `import fs from 'node:fs';import path from 'node:path';import {Session} from './dist/session.js';
        const [root,id,outside,target]=process.argv.slice(1),s=Session.open(root,{id});
        process.stdout.write(JSON.stringify({workspace:fs.readFileSync(path.join(root,'workspace-value'),'utf8'),
          external:fs.existsSync(target)?fs.readFileSync(target).toString('hex'):null,grant:!!s.workingDirectories(false).readHandle?.(outside)}));await s.close();`;
      const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', coldReader, root, nextId, outside, target],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
      assert.equal(cold.status, 0, cold.stderr);
      assert.deepEqual(JSON.parse(cold.stdout), { workspace: 'WORKSPACE_BEFORE', external: scenario === 'missing' ? null : original.toString('hex'), grant: false });
    } finally { await next?.close(); await session.close(); }
  });
});

test('mixed rewind rolls back workspace on refusal and retains uncertain effects', async t => {
  for (const fault of ['refused', 'unknown'] as const) await t.test(fault, async () => {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    const workspaceTarget = path.join(root, 'workspace-value'), pending = path.join(root, '.agent/checkpoints/transaction.json');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const signal = new AbortController().signal, native = childProcess.spawnSync;
    let attempted = false;
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, new ScriptedProvider([response([call('track-fault', 'write_file', { path: target, content: 'TRACKED' })], 'tool_use'), done()]), tools).run('track fixture');
      fs.writeFileSync(target, 'BEFORE'); fs.writeFileSync(workspaceTarget, 'WORKSPACE_BEFORE');
      await checkpointConversationWithDirectoryWitness(session, 'fault-before', signal);
      fs.writeFileSync(target, 'AFTER'); fs.writeFileSync(workspaceTarget, 'WORKSPACE_AFTER');
      const preview = previewRewind(session, 1, signal); assert.ok(preview.directory);
      Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        if (!Array.isArray(args[1]) || !args[1].includes('--restore-retained')) return Reflect.apply(native, childProcess, args);
        assert.equal(attempted, false); attempted = true;
        assert.equal(JSON.parse(fs.readFileSync(pending, 'utf8')).directory.operations[0].stage.kind, 'attempting');
        assert.equal(fs.readFileSync(workspaceTarget, 'utf8'), 'WORKSPACE_BEFORE');
        if (fault === 'refused') { fs.renameSync(target, `${target}-original`); fs.writeFileSync(target, 'REPLACEMENT'); }
        const result: unknown = Reflect.apply(native, childProcess, args);
        if (fault === 'refused') return result;
        const options = args[2];
        assert.ok(options && typeof options === 'object' && 'stdio' in options && Array.isArray(options.stdio) && typeof options.stdio[8] === 'number');
        fs.ftruncateSync(options.stdio[8], 0); // The unknown control loses both output channels.
        assert.ok(result && typeof result === 'object' && 'output' in result && Array.isArray(result.output));
        return { ...result, output: result.output.map((value, index) => index === 4 ? 'start\nrenamed\n' : value) };
      } });
      syncBuiltinESMExports();
      assert.throws(() => applyRewind(session, preview, preview.token, signal), /External rewind|rollback incomplete/);
      assert.equal(attempted, true);
      if (fault === 'refused') {
        assert.equal(fs.readFileSync(workspaceTarget, 'utf8'), 'WORKSPACE_AFTER');
        assert.equal(fs.readFileSync(target, 'utf8'), 'REPLACEMENT');
        assert.equal(fs.readFileSync(`${target}-original`, 'utf8'), 'AFTER');
        assert.equal(fs.existsSync(pending), false);
      } else {
        assert.equal(fs.readFileSync(workspaceTarget, 'utf8'), 'WORKSPACE_BEFORE');
        assert.equal(fs.readFileSync(target, 'utf8'), 'BEFORE');
        const before = fs.readFileSync(pending);
        assert.equal(JSON.parse(before.toString()).directory.operations[0].stage.kind, 'unknown');
        assert.throws(() => recoverCheckpoint({ workspace: root, signal, allowShell: false, maxOutputBytes: 24000 }), /requires live directory reconciliation/);
        assert.throws(() => recoverCheckpoint({ workspace: root, signal, allowShell: false, maxOutputBytes: 24000 }, session), /unresolved effects/);
        assert.deepEqual(fs.readFileSync(pending), before);
      }
    } finally {
      Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true, value: native }); syncBuiltinESMExports();
      await session.close();
    }
  });
});

test('mixed rewind compensates known external effects before a failed branch commit', async t => {
  for (const scenario of ['replace', 'remove', 'create', 'replaced', 'cancelled', 'rollback-unknown'] as const) await t.test(scenario, async () => {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    const local = path.join(root, 'value'), pending = path.join(root, '.agent/checkpoints/transaction.json');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const controller = new AbortController(), signal = controller.signal, append = Session.prototype.append, native = childProcess.spawnSync;
    const baseline = Buffer.from([0, 255, 7, 128]), changed = Buffer.from([1, 0, 128, 9]);
    let injected = false;
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, new ScriptedProvider([response([call('track-compensation', 'write_file', { path: target, content: 'TRACKED' })], 'tool_use'), done()]), tools).run('track fixture');
      if (scenario === 'remove') fs.unlinkSync(target);
      else { fs.writeFileSync(target, baseline); fs.chmodSync(target, 0o751); }
      fs.writeFileSync(local, 'LOCAL_BEFORE');
      await checkpointConversationWithDirectoryWitness(session, 'compensation-before', signal);
      if (scenario === 'create') fs.unlinkSync(target);
      else { fs.writeFileSync(target, changed); fs.chmodSync(target, 0o640); }
      fs.writeFileSync(local, 'LOCAL_AFTER');
      const preview = previewRewind(session, 1, signal); assert.ok(preview.directory);
      Session.prototype.append = function(event, ...args) {
        if (event.kind === 'rewind') {
          injected = true;
          const record = JSON.parse(fs.readFileSync(pending, 'utf8'));
          assert.equal(record.directory.operations[0].stage.kind, 'completed');
          assert.equal(fs.readFileSync(local, 'utf8'), 'LOCAL_BEFORE');
          if (scenario === 'remove') assert.equal(fs.existsSync(target), false);
          else assert.deepEqual(fs.readFileSync(target), baseline);
          if (scenario === 'replaced') { fs.renameSync(target, `${target}-landed`); fs.writeFileSync(target, 'OTHER_ACTOR'); }
          if (scenario === 'cancelled') controller.abort();
          if (scenario === 'rollback-unknown') {
            Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
              const result: unknown = Reflect.apply(native, childProcess, args);
              if (!Array.isArray(args[1]) || !args[1].includes('--restore-retained')) return result;
              const options = args[2];
              assert.ok(options && typeof options === 'object' && 'stdio' in options && Array.isArray(options.stdio) && typeof options.stdio[8] === 'number');
              fs.ftruncateSync(options.stdio[8], 0);
              assert.equal(JSON.parse(fs.readFileSync(pending, 'utf8')).directory.operations[0].rollback.kind, 'attempting');
              assert.ok(result && typeof result === 'object' && 'output' in result && Array.isArray(result.output));
              return { ...result, output: result.output.map((value, index) => index === 4 ? 'start\nrenamed\n' : value) };
            } });
            syncBuiltinESMExports();
          }
          throw new Error('fixture branch commit refused');
        }
        return append.call(this, event, ...args);
      };
      assert.throws(() => applyRewind(session, preview, preview.token, signal), /fixture branch commit refused|rollback incomplete/);
      assert.equal(injected, true);
      if (scenario === 'rollback-unknown') {
        assert.deepEqual(fs.readFileSync(target), changed);
        assert.equal(fs.readFileSync(local, 'utf8'), 'LOCAL_BEFORE');
        const bytes = fs.readFileSync(pending);
        assert.equal(JSON.parse(bytes.toString()).directory.operations[0].rollback.kind, 'unknown');
        assert.throws(() => recoverCheckpoint({ workspace: root, signal, allowShell: false, maxOutputBytes: 24000 }), /requires live directory reconciliation/);
        assert.throws(() => recoverCheckpoint({ workspace: root, signal, allowShell: false, maxOutputBytes: 24000 }, session), /unresolved effects/);
        assert.deepEqual(fs.readFileSync(pending), bytes);
      } else if (scenario === 'replaced') {
        assert.equal(fs.readFileSync(target, 'utf8'), 'OTHER_ACTOR');
        assert.equal(fs.readFileSync(local, 'utf8'), 'LOCAL_BEFORE');
        assert.deepEqual(fs.readFileSync(`${target}-landed`), baseline);
        assert.equal(JSON.parse(fs.readFileSync(pending, 'utf8')).directory.operations[0].rollback.kind, 'refused');
      } else {
        assert.equal(fs.readFileSync(local, 'utf8'), 'LOCAL_AFTER');
        if (scenario === 'create') assert.equal(fs.existsSync(target), false);
        else { assert.deepEqual(fs.readFileSync(target), changed); assert.equal(fs.statSync(target).mode & 0o7777, 0o640); }
        assert.equal(fs.existsSync(pending), false);
        const store = path.dirname(pending), receipts = fs.readdirSync(store).filter(name => name.startsWith('directory-rollback-'));
        assert.equal(receipts.length, 1);
        const receipt = JSON.parse(fs.readFileSync(path.join(store, receipts[0]!), 'utf8'));
        assert.equal(receipt.directory.operations[0].rollback.kind, 'completed');
        await session.close();
        const reader = `import fs from 'node:fs';import {Session} from './dist/session.js';
          const [root,id,outside,target,local]=process.argv.slice(1),s=Session.open(root,{id});
          process.stdout.write(JSON.stringify({grant:!!s.workingDirectories(false).readHandle?.(outside),
            local:fs.readFileSync(local,'utf8'),bytes:fs.existsSync(target)?fs.readFileSync(target).toString('hex'):null}));await s.close();`;
        const cold = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, session.id, outside, target, local],
          { cwd: process.cwd(), encoding: 'utf8', timeout: 10000 });
        assert.equal(cold.status, 0, cold.stderr);
        assert.deepEqual(JSON.parse(cold.stdout), { grant: false, local: 'LOCAL_AFTER', bytes: scenario === 'create' ? null : changed.toString('hex') });
      }
    } finally {
      Session.prototype.append = append;
      Object.defineProperty(childProcess, 'spawnSync', { configurable: true, writable: true, value: native }); syncBuiltinESMExports();
      await session.close();
    }
  });
});

test('cold mixed rewind requires regrant and verifies native effects before recovery', { timeout: 1200000 }, async t => {
  const helper = path.join(workspace(), 'directory-write-test');
  const nativeSource = fs.readFileSync('native/directory-write/write.c', 'utf8'), claim = 'if (rename_exclusive(dir, name, dir, part)) goto done;';
  assert.equal(nativeSource.split(claim).length, 2);
  // Owned fixture reproduces the retired host link/unlink crash window; the
  // production writer continues to use exclusive rename only.
  fs.writeFileSync(`${helper}.c`, nativeSource.replace(claim, `if (getenv("DIRECTORY_WRITE_TEST_LEGACY_LINK")) {
    if (linkat(dir, name, dir, part, 0) || test_point("legacy_after_link") || unlinkat(dir, name, 0)) goto done;
  } else ${claim}`));
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper, `${helper}.c`]);
  const cases = (['committed', 'prepared', 'compensated', 'forward', 'forward-receipt', 'reverse-receipt', 'forward-native', 'reverse-native', 'forward-captured', 'reverse-captured', 'forward-untouched', 'reverse-untouched', 'forward-linked', 'reverse-linked', 'forward-early', 'reverse-early'] as const)
    .map(phase => ({ phase, createPoint: '' }));
  for (const createPoint of ['create_attempt_persisted', 'create_publication_persisted', 'create_before_quarantine', 'create_quarantine', 'create_staging', 'create_writing', 'create_after_prepared'])
    for (const phase of ['forward-untouched', 'reverse-untouched'] as const) cases.push({ phase, createPoint });
  for (const createPoint of ['create_after_mode', 'create_after_recheck', 'error:create_before_quarantine', 'error:create_writing',
    'error:create_after_prepared', 'error:create_before_mode', 'error:create_after_mode', 'error:create_after_publish'])
    for (const phase of (createPoint.endsWith('after_publish') ? ['forward-native', 'reverse-native'] as const : ['forward-untouched', 'reverse-untouched'] as const))
      cases.push({ phase, createPoint });
  for (const createPoint of ['zero:create_after_mode', 'zero:error:create_after_mode']) cases.push({ phase: 'forward-untouched', createPoint });
  for (const phase of ['forward-native', 'reverse-native'] as const)
    cases.push({ phase, createPoint: 'zero:create_after_publish' });
  for (const createPoint of ['torn:0', 'torn:8', 'torn:12'])
    for (const phase of ['forward-untouched', 'reverse-untouched'] as const) cases.push({ phase, createPoint });
  cases.push({ phase: 'forward-untouched', createPoint: 'zero:torn:12' });
  for (const createPoint of ['partial:1:create_before_quarantine', 'partial:10:create_writing', 'partial:30:create_after_prepared',
    'partial:22:create_before_mode', 'partial:17:create_after_mode', 'partial:15:create_after_publish'])
    for (const phase of (createPoint.endsWith('after_publish') ? ['forward-native', 'reverse-native'] as const : ['forward-untouched', 'reverse-untouched'] as const))
      cases.push({ phase, createPoint });
  cases.push({ phase: 'forward-untouched', createPoint: 'zero:partial:17:create_after_mode' });
  for (const phase of ['forward-native', 'reverse-native'] as const) cases.push({ phase, createPoint: 'published-error' });
  for (const phase of ['forward-captured', 'reverse-captured'] as const) cases.push({ phase, createPoint: 'captured-error' });
  for (const phase of ['forward-untouched', 'reverse-untouched'] as const)
    for (const boundary of ['before', 'staging', 'intent']) cases.push({ phase, createPoint: `untouched-error:${boundary}` });
  for (const { phase, createPoint } of cases.filter(({ phase, createPoint }) =>
    (!process.env.W385_COMMITTED_ONLY || phase === 'committed') &&
    (!process.env.W385_LINKED_ONLY || phase.endsWith('-linked')) && (!process.env.W385_EARLY_ONLY || phase.endsWith('-early')) &&
    (!process.env.W385_CREATE_ONLY || !!createPoint) && (!process.env.W385_CREATE_PERSIST_ONLY || createPoint.endsWith('_persisted')) &&
    (!process.env.W385_CREATE_OUTCOME_ONLY || createPoint.startsWith('error:') || ['create_after_mode', 'create_after_recheck'].includes(createPoint)) &&
    (!process.env.W385_CREATE_ZERO_ONLY || createPoint.startsWith('zero:')) &&
    (!process.env.W385_CREATE_TORN_ONLY || createPoint.includes('torn:')) &&
    (!process.env.W385_CREATE_PARTIAL_ERROR_ONLY || createPoint.includes('partial:')) &&
    (!process.env.W385_PUBLISHED_ERROR_ONLY || createPoint === 'published-error') &&
    (!process.env.W385_CAPTURED_ERROR_ONLY || createPoint === 'captured-error') &&
    (!process.env.W385_UNTOUCHED_ERROR_ONLY || createPoint.startsWith('untouched-error:')) &&
    (!process.env.W385_ZERO_PUBLISHED_ONLY || createPoint === 'zero:create_after_publish')))
  for (const scenario of (createPoint.startsWith('untouched-error:') ? (phase === 'forward-untouched' ? ['replace', 'remove'] as const : ['replace', 'create'] as const) :
    createPoint === 'captured-error' ? ['replace', 'staged-conflict', 'held-conflict'] as const :
    createPoint === 'published-error' ? (phase === 'forward-native' ? ['replace', 'remove'] as const : ['replace', 'create'] as const) :
    createPoint ? (phase.startsWith('forward') ? ['create'] as const : ['remove'] as const) :
    phase === 'forward-linked' ? ['create'] as const : phase === 'reverse-linked' ? ['remove'] as const :
    phase === 'forward-early' ? ['replace', 'remove', 'replaced'] as const : phase === 'reverse-early' ? ['replace', 'create', 'replaced'] as const :
    phase.endsWith('-captured') ? ['replace', 'replaced', 'staged-conflict', 'held-conflict'] as const :
    phase.endsWith('-untouched') ? ['replace', 'remove', 'create', 'replaced', 'staged-conflict'] as const :
    phase === 'forward' ? ['replace', 'remove', 'create', 'replaced', 'multi'] as const : ['replace', 'remove', 'create', 'replaced'] as const)) await t.test(`${phase}/${scenario}${createPoint ? `/${createPoint}` : ''}`, async () => {
    const zeroCreate = createPoint.startsWith('zero:'), nativeCreatePoint = createPoint.replace(/^zero:/, '');
    const publicationCut = nativeCreatePoint.startsWith('torn:') || ['create_before_mode', 'create_after_mode', 'create_after_recheck', 'create_after_publish'].includes(nativeCreatePoint.replace(/^error:|^partial:[0-9]+:/, ''));
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    const other = path.join(outside, 'value-b');
    const local = path.join(root, 'value'), store = path.join(root, '.agent/checkpoints'), pending = path.join(store, 'transaction.json');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const signal = new AbortController().signal, baseline = Buffer.from([0, 255, 8, 128]);
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, new ScriptedProvider([response([call('track-cold-mixed', 'write_file', { path: target, content: 'TRACKED' }),
        ...(scenario === 'multi' ? [call('track-cold-mixed-b', 'write_file', { path: other, content: 'TRACKED' })] : [])], 'tool_use'), done()]), tools).run('track fixture');
      if (scenario === 'remove') fs.unlinkSync(target);
      else { fs.writeFileSync(target, baseline); fs.chmodSync(target, zeroCreate ? 0 : 0o751);
        if (zeroCreate) execFileSync('/bin/chmod', ['+a', `user:${os.userInfo().username} allow read,readattr,readextattr,readsecurity`, target]); }
      if (scenario === 'multi') { fs.writeFileSync(other, baseline); fs.chmodSync(other, 0o751); }
      fs.writeFileSync(local, 'LOCAL_BEFORE');
      await checkpointConversationWithDirectoryWitness(session, 'cold-mixed', signal);
      if (scenario === 'create') fs.unlinkSync(target);
      else {
        fs.writeFileSync(target, 'AFTER'); fs.chmodSync(target, zeroCreate ? 0 : 0o640);
        if (zeroCreate) execFileSync('/bin/chmod', ['+a', `user:${os.userInfo().username} allow read,readattr,readextattr,readsecurity`, target]);
      }
      if (scenario === 'multi') { fs.writeFileSync(other, 'AFTER'); fs.chmodSync(other, 0o640); }
      fs.writeFileSync(local, 'LOCAL_AFTER');
      await session.close();
      const crash = `import fs from 'node:fs';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
        import {Session} from './dist/session.js';import {previewRewind,applyRewind} from './dist/rewind.js';
        const [root,id,outside,pending,phase,local,helper,createPoint]=process.argv.slice(1),s=Session.open(root,{id}),signal=new AbortController().signal;
        const createKind=createPoint.replace(/^zero:/,''),tornMode=createKind.startsWith('torn:'),partialError=createKind.startsWith('partial:'),nativePoint=tornMode?'receipt_partial_intent':createKind.replace(/^error:|^partial:[0-9]+:/,''),nativeFailure=partialError||createKind.startsWith('error:'),publicationCut=tornMode||['create_before_mode','create_after_mode','create_after_recheck','create_after_publish'].includes(nativePoint);
        s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
        const unlink=fs.unlinkSync,rename=fs.renameSync,append=Session.prototype.append;
        if(phase.endsWith('-receipt')||phase.endsWith('-native')||phase.endsWith('-captured')||phase.endsWith('-untouched')||phase.endsWith('-linked')||phase.endsWith('-early')){const native=childProcess.spawnSync;let calls=0;
          childProcess.spawnSync=function(...args){
            // Manufacture an actual old native receipt for legacy-only cases.
            // This fixture migration is outside the production coordinator.
            if(Array.isArray(args[1])&&args[1].includes('--prepare-create')&&(phase.endsWith('-linked')||phase==='forward-receipt')){
              const transaction=JSON.parse(fs.readFileSync(pending,'utf8')),op=transaction.directory.operations[0],reverse=phase.startsWith('reverse-');
              const attempt=reverse?op.rollback:op.stage;
              delete op[reverse?'rollbackCreation':'creation'];fs.writeFileSync(pending,JSON.stringify(transaction));
              const receipt=fs.openSync(pending.replace('transaction.json','native-attempt-'+attempt.id+'.receipt'),'r+');
              args[2]={...args[2],stdio:args[2].stdio.map((fd,index)=>index===8?receipt:fd)};
              args[1]=['--receipt',args[1][2],String(args[2].input.length),args[1][3],args[1][6]];
            }
            const publishedError=createPoint==='published-error';
            const untouchedError=createPoint.startsWith('untouched-error:');
            const capturedError=createPoint==='captured-error',partialCapture=capturedError&&phase==='reverse-captured';
            const selected=!createPoint.endsWith('_persisted')&&Array.isArray(args[1])&&args[1].includes('--receipt')&&((createPoint&&!publicationCut&&!publishedError&&!untouchedError)||!args[1].includes('--prepare-create'))&&++calls===(phase.startsWith('forward-')?1:2);
            if(selected&&!phase.endsWith('-receipt')){args[0]=helper;args[2]={...args[2],env:{...process.env,
              DIRECTORY_WRITE_TEST_SELF_KILL:nativeFailure?undefined:'1',DIRECTORY_WRITE_TEST_FAIL:nativeFailure?'1':undefined,DIRECTORY_WRITE_TEST_SHORT_READ:'1',
              DIRECTORY_WRITE_TEST_RECEIPT_CUT:tornMode?createKind.split(':')[1]:undefined,
              DIRECTORY_WRITE_TEST_ERROR_CUT:partialError?createKind.split(':')[1]:undefined,
              ...(phase.endsWith('-linked')?{DIRECTORY_WRITE_TEST_LEGACY_LINK:'1'}:{}),
              DIRECTORY_WRITE_TEST_POINT:nativePoint|| (phase.endsWith('-early')?(args[1].includes('--remove')?'remove_quarantine':'replace_staging'):phase.endsWith('-linked')?'legacy_after_link':phase.endsWith('-untouched')?(args[1].includes('--remove')?'remove_after_recheck':args[1].includes('--restore-retained')?'replace_after_recheck':args[1].includes('--publish-prepared-create')?'create_before_mode':'after_recheck'):
                phase.endsWith('-captured')?'replace_after_capture':args[1].includes('--remove')?'remove_after_capture':args[1].includes('--restore-retained')?'replace_after_publish':args[1].includes('--publish-prepared-create')?'create_after_publish':'after_rename')}};}
            const remove=selected&&args[1].includes('--remove');
            if(selected&&publishedError) Object.assign(args[2].env,{
              DIRECTORY_WRITE_TEST_POINT:remove?'remove_after_capture':'replace_after_publish',
              DIRECTORY_WRITE_TEST_FAIL:'1',DIRECTORY_WRITE_TEST_SELF_KILL:undefined,DIRECTORY_WRITE_TEST_ERROR_CUT:remove?'17':undefined});
            if(selected&&capturedError) Object.assign(args[2].env,{
              DIRECTORY_WRITE_TEST_POINT:'replace_after_capture',DIRECTORY_WRITE_TEST_FAIL:'1',
              DIRECTORY_WRITE_TEST_SELF_KILL:undefined,DIRECTORY_WRITE_TEST_ERROR_CUT:partialCapture?'17':undefined});
            if(selected&&untouchedError){
              const points=remove?{before:'remove_before_recheck',staging:'remove_quarantine',intent:'remove_after_recheck'}:
                {before:'replace_before_quarantine',staging:'replace_writing',intent:'replace_after_recheck'};
              Object.assign(args[2].env,{DIRECTORY_WRITE_TEST_POINT:points[createPoint.split(':')[1]],DIRECTORY_WRITE_TEST_FAIL:'1',
                DIRECTORY_WRITE_TEST_SELF_KILL:undefined,DIRECTORY_WRITE_TEST_ERROR_CUT:phase==='reverse-untouched'?'10':undefined});
            }
            const result=native.apply(this,args);
            const fullError=(nativeFailure&&!partialError)||(publishedError&&!remove)||(capturedError&&!partialCapture)||(untouchedError&&phase==='forward-untouched');
            if(selected){if(!phase.endsWith('-receipt')&&(fullError?result.status!==1:result.signal!=='SIGKILL'))throw Error('native fixture did not fail as selected');process.exit(73);}
            return result;};syncBuiltinESMExports();}
        fs.unlinkSync=function(file){if(phase==='committed'&&file===pending)process.exit(73);return unlink.apply(this,arguments)};
        fs.renameSync=function(from,to){const result=rename.apply(this,arguments);
          if(createPoint.endsWith('_persisted')&&to===pending){
            const op=JSON.parse(fs.readFileSync(pending,'utf8')).directory?.operations[0],reverse=phase.startsWith('reverse-');
            const attempt=reverse?op?.rollback:op?.stage,creation=reverse?op?.rollbackCreation:op?.creation;
            if(attempt?.kind==='attempting'){
              if(!creation)throw Error('unbound create attempt persisted');
              if(creation.phase===(createPoint==='create_attempt_persisted'?'preparing':'publishing'))process.exit(73);
            }
          }
          if(phase==='prepared'&&to===local&&fs.existsSync(pending))process.exit(73);
          if(phase==='compensated'&&to===pending&&JSON.parse(fs.readFileSync(pending,'utf8')).directory?.operations.every(op=>op.rollback?.kind==='completed'))process.exit(73);
          return result;};
        Session.prototype.append=function(event,...args){if(event.kind==='rewind'){
          if(phase==='forward')process.exit(73);if(phase==='compensated'||phase.startsWith('reverse-'))throw Error('fixture precommit failure');}return append.call(this,event,...args)};
        const preview=previewRewind(s,1,signal);if(!preview.directory)throw Error('missing mixed plan');applyRewind(s,preview,preview.token,signal);`;
      const writer = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', crash, root, session.id, outside, pending, phase, local, helper, createPoint],
        { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
      assert.equal(writer.status, 73, writer.stderr);
      let original = fs.readFileSync(pending); const record = JSON.parse(original.toString());
      assert.equal(record.state, phase === 'committed' ? 'committed' : 'pending');
      assert.equal(record.directory.operations[0].stage.kind, phase === 'prepared' ? 'prepared' : phase.startsWith('forward-') ? 'attempting' : 'completed');
      if (phase === 'compensated') assert.equal(record.directory.operations[0].rollback.kind, 'completed');
      if (phase.startsWith('reverse-')) assert.equal(record.directory.operations[0].rollback.kind, 'attempting');
      assert.equal(fs.readFileSync(local, 'utf8'), 'LOCAL_BEFORE');
      const reader = `import fs from 'node:fs';import path from 'node:path';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
        import {Session} from './dist/session.js';import {recoverCheckpoint} from './dist/checkpoints.js';
        const [root,id,outside,regrant,cut,helper]=process.argv.slice(1),s=Session.open(root,{id,recoverLock:true});
        const context={workspace:root,signal:new AbortController().signal,allowShell:false,maxOutputBytes:24000};
        if(cut){const pending=path.join(root,'.agent/checkpoints/transaction.json'),transaction=JSON.parse(fs.readFileSync(pending,'utf8'));
          const branch=path.join(root,'.agent',transaction.branch.id+'.jsonl'),unlink=fs.unlinkSync,rename=fs.renameSync;
          fs.renameSync=function(from,to){const result=rename.apply(this,arguments);
            if(cut==='continuation-intent'&&to===pending&&JSON.parse(fs.readFileSync(pending,'utf8')).directory.operations.some(op=>op.continuation||op.rollbackContinuation))process.exit(74);
            if(cut==='after-inverse'&&to===pending){
            const ops=JSON.parse(fs.readFileSync(pending,'utf8')).directory.operations;
            if(ops.some(op=>op.rollback?.kind==='completed')&&ops.some(op=>!op.rollback))process.exit(74);}return result;};
          fs.unlinkSync=function(file){if(file===branch&&cut==='before-unlink')process.exit(74);
            const result=unlink.apply(this,arguments);if(file===branch&&cut==='after-unlink')process.exit(74);return result;};
          if(cut==='inverse-untouched'||cut.startsWith('inverse-early:')){const native=childProcess.spawnSync;
            childProcess.spawnSync=function(...args){const selected=Array.isArray(args[1])&&args[1].includes('--receipt')&&!args[1].includes('--prepare-create');
              if(selected){args[0]=helper;args[2]={...args[2],env:{...process.env,DIRECTORY_WRITE_TEST_SELF_KILL:'1',
                DIRECTORY_WRITE_TEST_RECEIPT_CUT:cut==='inverse-early:torn'?'12':undefined,
                DIRECTORY_WRITE_TEST_SHORT_READ:'1',DIRECTORY_WRITE_TEST_POINT:cut==='inverse-early:torn'?'receipt_partial_intent':cut.startsWith('inverse-early:')?
                  (args[1].includes('--remove')?(cut.endsWith('absent')?'remove_before_recheck':'remove_quarantine'):
                    cut.endsWith('absent')?'replace_before_quarantine':cut.endsWith('partial')?'replace_writing':'replace_before_intent'):
                  args[1].includes('--remove')?'remove_after_recheck':args[1].includes('--restore-retained')?'replace_after_recheck':args[1].includes('--publish-prepared-create')?'create_before_mode':'after_recheck'}};}
              const result=native.apply(this,args);if(selected){if(result.signal!=='SIGKILL')throw Error('inverse did not die');process.exit(74);}return result;};syncBuiltinESMExports();}
          if(cut.startsWith('linked-')){const native=childProcess.spawnSync;
            childProcess.spawnSync=function(...args){const selected=Array.isArray(args[1])&&args[1].includes(cut==='linked-capture'||cut==='linked-prepared'||cut.startsWith('linked-early:')?'--normalize-linked':'--publish-linked-captured');
              if(selected){args[0]=helper;args[2]={...args[2],env:{...process.env,DIRECTORY_WRITE_TEST_SELF_KILL:'1',
                DIRECTORY_WRITE_TEST_RECEIPT_CUT:cut.startsWith('linked-early:receipt-partial:')?cut.split(':')[2]:undefined,
                DIRECTORY_WRITE_TEST_SHORT_READ:'1',DIRECTORY_WRITE_TEST_POINT:cut.startsWith('linked-early:receipt-partial:')?'receipt_partial_intent':cut.startsWith('linked-early:')?cut.slice('linked-early:'.length):cut==='linked-prepared'?'replace_after_recheck':cut==='linked-capture'?'replace_after_capture':cut==='linked-resume-before'?'captured_before_publish':'captured_after_publish'}};}
              const injectError=selected&&process.env.W385_LINKED_ERRORS&&args[1].includes('--normalize-linked')&&!cut.includes('receipt-partial');
              const partial=${phase.startsWith('reverse-')};
              if(injectError) Object.assign(args[2].env,{DIRECTORY_WRITE_TEST_SELF_KILL:undefined,DIRECTORY_WRITE_TEST_FAIL:'1',DIRECTORY_WRITE_TEST_ERROR_CUT:partial?'10':undefined});
              const result=native.apply(this,args);if(selected){if(injectError&&!partial?result.status!==1:result.signal!=='SIGKILL')throw Error('linked fixture outcome differs');process.exit(74);}return result;};syncBuiltinESMExports();}
          if(cut==='continuation-before'||cut==='continuation-after'){const native=childProcess.spawnSync;
            childProcess.spawnSync=function(...args){const selected=Array.isArray(args[1])&&args[1].includes('--publish-captured');
              if(selected){args[0]=helper;args[2]={...args[2],env:{...process.env,DIRECTORY_WRITE_TEST_SELF_KILL:'1',
                DIRECTORY_WRITE_TEST_POINT:cut==='continuation-before'?'captured_before_publish':'captured_after_publish'}};}
              const result=native.apply(this,args);if(selected){if(result.signal!=='SIGKILL')throw Error('continuation did not die');process.exit(74);}return result;};syncBuiltinESMExports();}}
        try{if(regrant==='yes')s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
          console.log(JSON.stringify({first:recoverCheckpoint(context,s),second:recoverCheckpoint(context,s)}));}
        catch(error){console.log(JSON.stringify({error:String(error)}));}finally{await s.close();}`;
      const run = (grant: boolean, cut = '') => {
        const owner = phase === 'committed' && (scenario !== 'replace' || process.env.W385_SUCCESSOR_ONLY) ? record.branch.id : session.id;
        const result = childProcess.spawnSync(process.execPath, ['--input-type=module', '-e', reader, root, owner, outside, grant ? 'yes' : 'no', cut, helper],
          { cwd: process.cwd(), encoding: 'utf8', timeout: 15000 });
        assert.equal(result.status, cut ? 74 : 0, result.stderr || result.stdout);
        return cut ? undefined : JSON.parse(result.stdout);
      };
      assert.match(run(false).error, /explicit grant/);
      assert.deepEqual(fs.readFileSync(pending), original);
      if (phase === 'committed' && scenario === 'remove') {
        const activeSource = Session.open(root, { id: session.id, recoverLock: true });
        try {
          assert.match(run(true).error, /Session is active/);
          assert.deepEqual(fs.readFileSync(pending), original);
          activeSource.checkpointGateIdentity();
        } finally { await activeSource.close(); }
      }
      if (createPoint === 'zero:create_after_publish') {
        const inode = fs.statSync(target, { bigint: true });
        assert.throws(() => fs.readFileSync(target), { code: 'EACCES' });
        assert.match(run(true).error, /needs read access.*mode 0000/);
        assert.deepEqual(fs.readFileSync(pending), original);
        assert.equal(fs.statSync(target, { bigint: true }).ctimeNs, inode.ctimeNs);
        // The fixture owner grants access only after the cold reader returns.
        execFileSync('/bin/chmod', ['+a', `user:${os.userInfo().username} allow read,readattr,readextattr,readsecurity`, target]);
        assert.equal(fs.statSync(target, { bigint: true }).ino, inode.ino);
        assert.equal(fs.statSync(target).mode & 0o7777, 0);
      }
      const creation = phase.startsWith('reverse-') ? record.directory.operations[0].rollbackCreation : record.directory.operations[0].creation;
      if (creation) {
        const file = path.join(store, `native-attempt-${creation.id}.receipt`), bytes = fs.readFileSync(file);
        fs.renameSync(file, `${file}-original`); fs.writeFileSync(file, bytes, { mode: 0o600 });
        assert.match(run(true).error, /receipt identity changed/); assert.deepEqual(fs.readFileSync(pending), original);
        fs.unlinkSync(file); fs.renameSync(`${file}-original`, file);
        fs.appendFileSync(file, 'changed\n'); assert.match(run(true).error, /create preparation (receipt changed|prefix differs)/);
        assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(file, bytes);
        if (nativeCreatePoint.startsWith('error:')) {
          const failed = creation.phase === 'preparing' ? file : path.join(store, `native-attempt-${(phase.startsWith('reverse-') ? record.directory.operations[0].rollback : record.directory.operations[0].stage).id}.receipt`);
          const raw = fs.readFileSync(failed, 'utf8'); assert.match(raw, /error (not_prepared|preparation_incomplete|not_published|unknown) 5\nexit 1\n$/);
          fs.writeFileSync(failed, raw.replace(/\nerror [^ ]+ /, `\nerror ${creation.phase === 'preparing' ? 'not_published' : 'preparation_incomplete'} `));
          assert.match(run(true).error, /create error phase differs/); assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(failed, raw);
          fs.writeFileSync(failed, raw.replace(/exit 1\n$/, 'exit 0\n'));
          assert.match(run(true).error, /create .* (differs|changed|unresolved)|metadata-only creation unresolved/); assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(failed, raw);
        }
        if (nativeCreatePoint.startsWith('partial:')) {
          const attempt = phase.startsWith('reverse-') ? record.directory.operations[0].rollback : record.directory.operations[0].stage;
          const failed = creation.phase === 'preparing' ? file : path.join(store, `native-attempt-${attempt.id}.receipt`);
          const raw = fs.readFileSync(failed, 'utf8'), start = raw.indexOf('\ne');
          assert.ok(start >= 0); assert.equal(raw.slice(start + 1).length, Number(nativeCreatePoint.split(':')[1]));
          const invalid = nativeCreatePoint === 'partial:1:create_before_quarantine'
            ? ['error not_prepared -1\nexit 1\n', 'error not_prepared 2147483648\nexit 1\n', 'error not_prepared 05\nexit 1\n',
              'error not_prepared 5\nexit 0\n', 'error not_prepared 5\nexit 1\nextra\n'] : [raw.slice(start + 1) + 'X'];
          for (const suffix of invalid) {
            fs.writeFileSync(failed, raw.slice(0, start + 1) + suffix);
            assert.match(run(true).error, /create .* (differs|changed|unresolved)|metadata-only creation unresolved/);
            assert.deepEqual(fs.readFileSync(pending), original);
          }
          fs.writeFileSync(failed, raw);
        }
        if (nativeCreatePoint.startsWith('torn:')) {
          const attempt = phase.startsWith('reverse-') ? record.directory.operations[0].rollback : record.directory.operations[0].stage;
          const pub = path.join(store, `native-attempt-${attempt.id}.receipt`), raw = fs.readFileSync(pub, 'utf8');
          assert.match(raw, /mode_changing\nmode_applied v[^\n]*$/); assert.ok(!raw.includes('publishing\n'));
          fs.writeFileSync(pub, `${raw}X`);
          assert.match(run(true).error, /create staged identity changed|metadata-only creation unresolved/);
          assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(pub, raw);
        }
        if (createPoint.endsWith('create_after_mode')) {
          const staged = path.join(outside, `.litcode-create-${creation.id}`, 'staged'), content = zeroCreate ? baseline : fs.readFileSync(staged), mode = fs.statSync(staged).mode & 0o7777;
          if (zeroCreate) {
            assert.equal(mode, 0); assert.throws(() => fs.readFileSync(staged), { code: 'EACCES' });
            const pub = path.join(store, `native-attempt-${record.directory.operations[0].stage.id}.receipt`), raw = fs.readFileSync(pub, 'utf8');
            const before = fs.statSync(staged, { bigint: true });
            fs.writeFileSync(pub, raw.replace('mode_changing\n', 'mode_changing\npublishing\n'));
            assert.match(run(true).error, /metadata-only creation unresolved/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(pub, raw);
            const after = fs.statSync(staged, { bigint: true });
            for (const key of ['dev', 'ino', 'mode', 'size', 'mtimeNs', 'ctimeNs'] as const) assert.equal(after[key], before[key]);
          }
          fs.renameSync(staged, `${staged}-original`); fs.writeFileSync(staged, content, { mode });
          assert.match(run(true).error, /create staged identity changed|metadata-only creation unresolved/); assert.deepEqual(fs.readFileSync(pending), original);
          fs.unlinkSync(staged); fs.renameSync(`${staged}-original`, staged);
        }
      }
      if ((phase.endsWith('-receipt') || phase.endsWith('-native')) && scenario === 'replace') {
        const operation = record.directory.operations[0], attempt = phase.startsWith('forward-') ? operation.stage : operation.rollback;
        const receipt = path.join(store, `native-attempt-${attempt.id}.receipt`), bytes = fs.readFileSync(receipt);
        fs.renameSync(receipt, `${receipt}-original`); fs.writeFileSync(receipt, bytes, { mode: 0o600 });
        assert.match(run(true).error, /receipt identity changed/);
        assert.deepEqual(fs.readFileSync(pending), original);
        fs.unlinkSync(receipt); fs.renameSync(`${receipt}-original`, receipt);
        if (createPoint === 'published-error') {
          assert.match(bytes.toString(), /renamed\nerror unknown 5\nexit 1\n$/);
          fs.writeFileSync(receipt, bytes.toString().replace('error unknown', 'error not_published'));
        } else fs.writeFileSync(receipt, bytes.subarray(0, bytes.length - 3));
        assert.match(run(true).error, /unresolved effects/); assert.deepEqual(fs.readFileSync(pending), original);
        // A complete exit marker cannot authorize an inconsistent pre-effect inode.
        const changedIntent = bytes.toString().replace(/^(intent replace [^\n ]+ v2:[^:]+:)[^:]+/m, '$1999999999999999999');
        assert.notEqual(changedIntent, bytes.toString());
        fs.writeFileSync(receipt, changedIntent);
        assert.match(run(true).error, /unresolved effects/); assert.deepEqual(fs.readFileSync(pending), original);
        fs.writeFileSync(receipt, bytes);
      }
      if (phase.endsWith('-receipt') && scenario === 'create') {
        // Old complete receipts remain recoverable without V2 intent metadata.
        const operation = record.directory.operations[0], attempt = phase === 'forward-receipt' ? operation.stage : operation.rollback;
        const receipt = path.join(store, `native-attempt-${attempt.id}.receipt`);
        fs.writeFileSync(receipt, fs.readFileSync(receipt, 'utf8').replace('directory-write-receipt-v2\n', 'directory-write-receipt-v1\n').replace(/^intent [^\n]+\n/m, ''));
      }
      if (scenario === 'staged-conflict' || scenario === 'held-conflict') {
        const operation = record.directory.operations[0], attempt = phase.startsWith('forward-') ? operation.stage : operation.rollback;
        const file = path.join(outside, `.litcode-replace-${attempt.id}`, scenario === 'staged-conflict' ? 'staged' : 'held');
        const bytes = fs.readFileSync(file), mode = fs.statSync(file).mode & 0o7777;
        fs.renameSync(file, `${file}-bound`); fs.writeFileSync(file, bytes, { mode });
        const current = fs.existsSync(target) ? fs.readFileSync(target) : undefined;
        assert.match(run(true).error, phase.endsWith('-untouched') ? /no-effect staged file changed/ : /captured identity changed/);
        assert.deepEqual(fs.readFileSync(pending), original);
        if (current) assert.deepEqual(fs.readFileSync(target), current); else assert.equal(fs.existsSync(target), false);
      } else if (scenario === 'replaced') {
        const present = fs.existsSync(target), bytes = present ? fs.readFileSync(target) : phase.startsWith('forward-') ? baseline : Buffer.from('AFTER');
        const mode = present ? fs.statSync(target).mode & 0o7777 : 0o640;
        if (present) fs.renameSync(target, `${target}-landed`);
        fs.writeFileSync(target, bytes); fs.chmodSync(target, mode);
        assert.match(run(true).error, /identity or content changed|unresolved effects/);
        assert.deepEqual(fs.readFileSync(pending), original);
        assert.deepEqual(fs.readFileSync(target), bytes);
      } else {
        if (phase.endsWith('-untouched') || phase.endsWith('-early')) {
          if (createPoint.startsWith('untouched-error:')) {
            const op = record.directory.operations[0], attempt = phase === 'forward-untouched' ? op.stage : op.rollback;
            const receipt = path.join(store, `native-attempt-${attempt.id}.receipt`), raw = fs.readFileSync(receipt, 'utf8');
            const index = raw.indexOf('\nerror '); assert.ok(index > 0);
            const before = createPoint.endsWith(':before'), remove = scenario !== 'replace';
            const refused = remove ? 'not_removed' : 'not_published';
            const trailer = `error ${before ? refused : 'unknown'} 5\nexit 1\n`;
            assert.equal(raw.slice(index + 1), phase === 'forward-untouched' ? trailer : trailer.slice(0, 10));
            fs.writeFileSync(receipt, raw.slice(0, index + 1) + `error ${before ? 'unknown' : refused} 5\nexit 1\n`);
            assert.match(run(true).error, /no-effect error phase differs|unresolved effects/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, raw);
          }
          const current = fs.existsSync(target) ? fs.readFileSync(target) : undefined;
          fs.writeFileSync(local, 'OUTSIDE_WORKSPACE');
          assert.match(run(true).error, /recovery conflict/); assert.deepEqual(fs.readFileSync(pending), original);
          fs.writeFileSync(local, 'LOCAL_BEFORE');
          if (phase === 'reverse-untouched') {
            for (let retry = 0; retry < 2; retry++) {
              run(true, 'inverse-untouched'); original = fs.readFileSync(pending);
              const operation = JSON.parse(original.toString()).directory.operations[0];
              assert.equal(operation.noEffectAttempts.length, retry + 1);
              assert.equal(operation.rollback.kind, 'attempting');
              assert.ok(operation.noEffectAttempts.every((attempt: { id: string }) => attempt.id !== operation.rollback.id));
              if (current) assert.deepEqual(fs.readFileSync(target), current); else assert.equal(fs.existsSync(target), false);
            }
          }
          if (phase === 'reverse-early') {
            for (const [index, cut] of ['absent', 'partial', 'checking', 'torn'].entries()) {
              run(true, `inverse-early:${cut}`); original = fs.readFileSync(pending);
              const operation = JSON.parse(original.toString()).directory.operations[0];
              assert.equal(operation.noEffectAttempts.length, index + 1);
              assert.equal(operation.rollback.kind, 'attempting');
              assert.ok(operation.noEffectAttempts.every((attempt: { id: string }) => attempt.id !== operation.rollback.id));
              if (current) assert.deepEqual(fs.readFileSync(target), current); else assert.equal(fs.existsSync(target), false);
            }
          }
        }
        if (phase.endsWith('-linked')) {
          assert.equal(fs.statSync(target).nlink, 2);
          fs.writeFileSync(local, 'OUTSIDE_WORKSPACE'); assert.match(run(true).error, /recovery conflict/);
          assert.deepEqual(fs.readFileSync(pending), original); assert.equal(fs.statSync(target).nlink, 2);
          fs.writeFileSync(local, 'LOCAL_BEFORE');
          const pair = fs.statSync(target, { bigint: true });
          const preparationCuts = ['linked-prepared', 'linked-prepared', ...['replace_before_quarantine', 'replace_quarantine', 'replace_staging', 'replace_writing', 'replace_before_intent'].map(point => `linked-early:${point}`),
            ...Array.from({ length: 13 }, (_, field) => `linked-early:receipt-partial:${field}`)];
          for (const [retry, cut] of preparationCuts.entries()) {
            run(true, cut); original = fs.readFileSync(pending);
            const entry = JSON.parse(original.toString()).directory.operations[0];
            const preparation = phase.startsWith('forward-') ? entry.normalization : entry.rollbackNormalization;
            assert.equal(entry.abandonedNormalizations?.length ?? 0, retry);
            assert.ok((entry.abandonedNormalizations ?? []).every((old: { normalization: { id: string } }) => old.normalization.id !== preparation.id));
            assert.equal(fs.statSync(target, { bigint: true }).ino, pair.ino); assert.equal(fs.statSync(target, { bigint: true }).ctimeNs, pair.ctimeNs);
            const receipt = path.join(store, `native-attempt-${preparation.id}.receipt`), bytes = fs.readFileSync(receipt);
            assert.equal(fs.existsSync(path.join(outside, `.litcode-linked-${preparation.id}`, 'staged')), !['linked-early:replace_before_quarantine', 'linked-early:replace_quarantine'].includes(cut));
            assert.equal(fs.existsSync(path.join(outside, `.litcode-linked-${preparation.id}`, 'held')), false);
            if (process.env.W385_LINKED_ERRORS && !cut.includes('receipt-partial')) {
              const index = bytes.indexOf('\nerror '); assert.ok(index > 0);
              const family = cut.endsWith('replace_before_quarantine') ? 'unknown' : 'not_published';
              fs.writeFileSync(receipt, Buffer.concat([bytes.subarray(0, index + 1), Buffer.from(`error ${family} 5\nexit 1\n`)]));
              assert.match(run(true).error, /normalization error phase differs/);
              assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, bytes);
            }
            fs.appendFileSync(receipt, 'changed\n'); assert.match(run(true).error, /normalization (receipt unresolved|intent incomplete or changed)|invalid descriptor observation/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, bytes);
            if (cut.startsWith('linked-early:receipt-partial:')) {
              assert.equal(bytes.at(-1) === 10, false);
              fs.writeFileSync(receipt, Buffer.concat([bytes.subarray(0, -1), Buffer.from('?')]));
              assert.match(run(true).error, /normalization staged prefix changed/);
              assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, bytes);
            }
          }
          fs.writeFileSync(local, 'OUTSIDE_WORKSPACE'); assert.match(run(true).error, /recovery conflict/);
          assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(local, 'LOCAL_BEFORE');
          run(true, 'linked-capture'); original = fs.readFileSync(pending); assert.equal(fs.existsSync(target), false);
          const operation = JSON.parse(original.toString()).directory.operations[0];
          assert.equal(operation.abandonedNormalizations.length, 20);
          const normalization = phase.startsWith('forward-') ? operation.normalization : operation.rollbackNormalization;
          const held = path.join(outside, `.litcode-linked-${normalization.id}`, 'held');
          assert.equal(fs.statSync(held).nlink, 2); assert.equal(fs.statSync(path.join(outside, normalization.alias)).ino, fs.statSync(held).ino);
          const nativeReceipt = path.join(store, `native-attempt-${normalization.id}.receipt`), receiptBytes = fs.readFileSync(nativeReceipt);
          if (process.env.W385_LINKED_ERRORS) {
            const start = receiptBytes.indexOf('\nerror '); assert.ok(start > 0);
            fs.writeFileSync(nativeReceipt, Buffer.concat([receiptBytes.subarray(0, start + 1),
              Buffer.from('publishing\nrenamed\nheld v2:0\nlanded v2:0\nerror unknown 5\nexit 1\n')]));
            assert.match(run(true).error, /normalization error phase differs/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(nativeReceipt, receiptBytes);
          }
          fs.renameSync(nativeReceipt, `${nativeReceipt}-original`); fs.writeFileSync(nativeReceipt, receiptBytes, { mode: 0o600 });
          assert.match(run(true).error, /Native receipt identity changed/); assert.deepEqual(fs.readFileSync(pending), original);
          fs.unlinkSync(nativeReceipt); fs.renameSync(`${nativeReceipt}-original`, nativeReceipt);
          const corrupt = JSON.parse(original.toString()), entry = corrupt.directory.operations[0];
          (phase.startsWith('forward-') ? entry.normalization : entry.rollbackNormalization).pair.ino = '999999999999999999';
          fs.writeFileSync(pending, JSON.stringify(corrupt)); assert.match(run(true).error, /original linked identity changed/);
          fs.writeFileSync(pending, original);
          run(true, 'linked-resume-before'); original = fs.readFileSync(pending); assert.equal(fs.existsSync(target), false);
          const saved = JSON.parse(original.toString()).directory.operations[0];
          const captured = (phase.startsWith('forward-') ? saved.normalization : saved.rollbackNormalization).captured;
          assert.ok(captured);
          assert.equal(captured.receiptDigest, createHash('sha256').update(receiptBytes).digest('hex'));
          if (process.env.W385_LINKED_ERRORS) {
            const index = receiptBytes.indexOf('\nerror ');
            assert.ok(index > 0);
            const stripped = JSON.parse(original.toString()), op = stripped.directory.operations[0];
            delete (phase.startsWith('forward-') ? op.normalization : op.rollbackNormalization).captured.receiptDigest;
            fs.writeFileSync(pending, JSON.stringify(stripped));
            assert.match(run(true).error, /normalization capture receipt changed/);
            assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), stripped); fs.writeFileSync(pending, original);
            fs.writeFileSync(nativeReceipt, Buffer.concat([receiptBytes.subarray(0, index + 1), Buffer.from('error unknown 9\nexit 1\n')]));
            assert.match(run(true).error, /normalization capture receipt changed/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(nativeReceipt, receiptBytes);
          }
          run(true, 'linked-resume-after'); assert.deepEqual(fs.readFileSync(pending), original);
          assert.equal(fs.statSync(target).nlink, 1); assert.equal(String(fs.statSync(target).ino), captured.staged.ino);
        }
        if (phase.endsWith('-captured')) {
          assert.equal(fs.existsSync(target), false);
          fs.writeFileSync(local, 'OUTSIDE_WORKSPACE');
          assert.match(run(true).error, /recovery conflict/);
          assert.deepEqual(fs.readFileSync(pending), original); assert.equal(fs.existsSync(target), false);
          fs.writeFileSync(local, 'LOCAL_BEFORE');
          run(true, 'continuation-intent');
          original = fs.readFileSync(pending);
          const saved = JSON.parse(original.toString()).directory.operations[0];
          const continuation = phase.startsWith('forward-') ? saved.continuation : saved.rollbackContinuation;
          assert.equal(continuation.kind, 'publish-captured'); assert.equal(fs.existsSync(target), false);
          const corrupt = JSON.parse(original.toString()), entry = corrupt.directory.operations[0];
          (phase.startsWith('forward-') ? entry.continuation : entry.rollbackContinuation).staged.ino = '999999999999999999';
          fs.writeFileSync(pending, JSON.stringify(corrupt));
          assert.match(run(true).error, /captured continuation changed/);
          assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), corrupt); assert.equal(fs.existsSync(target), false);
          fs.writeFileSync(pending, original);
          run(true, 'continuation-before');
          assert.deepEqual(fs.readFileSync(pending), original); assert.equal(fs.existsSync(target), false);
          run(true, 'continuation-after');
          assert.deepEqual(fs.readFileSync(pending), original);
          assert.equal(fs.statSync(target, { bigint: true }).ino.toString(), continuation.staged.ino);
          if (createPoint === 'captured-error') {
            const copy = JSON.parse(original.toString()), op = copy.directory.operations[0];
            delete op[phase === 'forward-captured' ? 'continuation' : 'rollbackContinuation'];
            fs.writeFileSync(pending, JSON.stringify(copy));
            assert.match(run(true).error, /unresolved effects/);
            assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), copy);
            fs.writeFileSync(pending, original);
          }
        }
        if (phase !== 'committed') {
          const branch = path.join(root, '.agent', `${record.branch.id}.jsonl`);
          const archived = path.join(store, `rollback-branch-${record.id}.jsonl`), journal = fs.readFileSync(branch);
          if (scenario === 'multi') {
            run(true, 'after-inverse');
            original = fs.readFileSync(pending);
            assert.equal(JSON.parse(original.toString()).directory.operations.filter((operation: { rollback?: { kind: string } }) => operation.rollback?.kind === 'completed').length, 1);
            assert.equal(fs.readFileSync(local, 'utf8'), 'LOCAL_BEFORE');
            assert.deepEqual(fs.readFileSync(target), baseline); assert.equal(fs.readFileSync(other, 'utf8'), 'AFTER');
          }
          run(true, 'before-unlink');
          if (phase === 'forward' || phase.endsWith('-receipt') || phase.endsWith('-native') || phase.endsWith('-captured') || phase.endsWith('-untouched') || phase.endsWith('-linked') || phase.endsWith('-early')) {
            original = fs.readFileSync(pending);
            assert.equal(JSON.parse(original.toString()).directory.operations[0].stage.kind, phase === 'forward-untouched' || phase === 'forward-early' ? 'refused' : 'completed');
            if (phase !== 'forward-untouched' && phase !== 'forward-early') assert.equal(JSON.parse(original.toString()).directory.operations[0].rollback.kind, 'completed');
          }
          if (phase.endsWith('-untouched')) {
            const operation = JSON.parse(original.toString()).directory.operations[0];
            assert.equal(operation.noEffectAttempts.length, phase === 'forward-untouched' ? 1 : 3);
            const proof = operation.noEffectAttempts[0], receipt = path.join(store, `native-attempt-${proof.id}.receipt`), bytes = fs.readFileSync(receipt);
            assert.equal(proof.digest, createHash('sha256').update(bytes).digest('hex'));
            if (proof.creation) {
              assert.equal(proof.creation.evidence.phase, createPoint && createPoint !== 'create_publication_persisted' && !publicationCut ? 'preparing' : 'publishing');
              const preparationReceipt = path.join(store, `native-attempt-${proof.creation.evidence.id}.receipt`), prepBytes = fs.readFileSync(preparationReceipt);
              fs.appendFileSync(preparationReceipt, 'changed\n'); assert.match(run(true).error, /Abandoned create preparation changed/);
              assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(preparationReceipt, prepBytes);
              const corrupt = JSON.parse(original.toString()), snapshot = corrupt.directory.operations[0].noEffectAttempts[0].preparation;
              if (snapshot.kind === 'metadata') snapshot.observation.ino = '999999999999999999';
              else if (snapshot.kind === 'absent') snapshot.parent.ino = '999999999999999999';
              else if (snapshot.staged.kind === 'missing') snapshot.staged.parent.ino = '999999999999999999';
              else snapshot.staged.observation.ino = '999999999999999999';
              fs.writeFileSync(pending, JSON.stringify(corrupt)); assert.match(run(true).error, /retained creation changed|metadata-only creation unresolved|create (preparation prefix differs|staged identity changed)/);
              assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), corrupt); fs.writeFileSync(pending, original);
              if (zeroCreate) {
                assert.equal(proof.preparation.kind, 'metadata'); assert.equal(proof.preparation.content, 'unverified');
                const retained = path.join(outside, `.litcode-create-${proof.creation.evidence.id}`, 'staged');
                assert.equal(fs.statSync(retained).mode & 0o7777, 0); assert.throws(() => fs.readFileSync(retained), { code: 'EACCES' });
              }
            }
            fs.appendFileSync(receipt, 'changed\n'); assert.match(run(true).error, /No-effect native receipt changed/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, bytes);
            if (createPoint.startsWith('untouched-error:') && !createPoint.endsWith(':intent')) {
              assert.equal(proof.preparation.kind, createPoint.endsWith(':before') ? 'absent' : 'retained');
              if (createPoint.endsWith(':staging') && scenario === 'replace') assert.equal(proof.preparation.staged.content.bytes, 1);
            } else if (scenario === 'replace') {
              const changed = bytes.toString().replace(/^(intent replace [^\n ]+ v2:[^:]+:)[^:]+/m, '$1999999999999999999');
              const corrupt = JSON.parse(original.toString());
              corrupt.directory.operations[0].noEffectAttempts[0].digest = createHash('sha256').update(changed).digest('hex');
              fs.writeFileSync(receipt, changed); fs.writeFileSync(pending, JSON.stringify(corrupt));
              assert.match(run(true).error, /no-effect staged file changed/);
              assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), corrupt);
              fs.writeFileSync(receipt, bytes); fs.writeFileSync(pending, original);
            }
          }
          if (phase.endsWith('-early')) {
            const operation = JSON.parse(original.toString()).directory.operations[0];
            assert.equal(operation.noEffectAttempts.length, phase === 'forward-early' ? 1 : 5);
            const proof = operation.noEffectAttempts[0], receipt = path.join(store, `native-attempt-${proof.id}.receipt`), bytes = fs.readFileSync(receipt);
            fs.appendFileSync(receipt, 'changed\n'); assert.match(run(true).error, /No-effect native receipt changed/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, bytes);
            const altered = JSON.parse(original.toString()), staged = altered.directory.operations[0].noEffectAttempts[0].preparation.staged;
            if (staged.kind === 'present') staged.observation.ino = '999999999999999999'; else staged.parent.ino = '999999999999999999';
            fs.writeFileSync(pending, JSON.stringify(altered));
            assert.match(run(true).error, /early no-effect retained state changed/);
            assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), altered); fs.writeFileSync(pending, original);
            if (phase === 'reverse-early') {
              const torn = operation.noEffectAttempts[4], tornReceipt = path.join(store, `native-attempt-${torn.id}.receipt`), tornBytes = fs.readFileSync(tornReceipt);
              assert.notEqual(tornBytes.at(-1), 10);
              const changed = Buffer.concat([tornBytes.subarray(0, -1), Buffer.from('?')]), forged = JSON.parse(original.toString());
              forged.directory.operations[0].noEffectAttempts[4].digest = createHash('sha256').update(changed).digest('hex');
              fs.writeFileSync(tornReceipt, changed); fs.writeFileSync(pending, JSON.stringify(forged));
              assert.match(run(true).error, /early no-effect intent changed/);
              assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), forged);
              fs.writeFileSync(tornReceipt, tornBytes); fs.writeFileSync(pending, original);
            }
          }
          if (phase.endsWith('-linked')) {
            const operation = JSON.parse(original.toString()).directory.operations[0];
            assert.equal(operation.abandonedNormalizations.length, 20);
            const abandoned = operation.abandonedNormalizations[0], oldReceipt = path.join(store, `native-attempt-${abandoned.normalization.id}.receipt`);
            const oldBytes = fs.readFileSync(oldReceipt);
            assert.equal(abandoned.digest, createHash('sha256').update(oldBytes).digest('hex'));
            fs.appendFileSync(oldReceipt, 'changed\n'); assert.match(run(true).error, /Abandoned normalization receipt changed/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(oldReceipt, oldBytes);
            const forged = oldBytes.toString().replace(/^(intent normalize-linked [^\n ]+ v2:[^:]+:)[^:]+/m, '$1999999999999999999');
            const corrupt = JSON.parse(original.toString());
            corrupt.directory.operations[0].abandonedNormalizations[0].digest = createHash('sha256').update(forged).digest('hex');
            fs.writeFileSync(oldReceipt, forged); fs.writeFileSync(pending, JSON.stringify(corrupt));
            assert.match(run(true).error, /normalization preparation changed/);
            fs.writeFileSync(oldReceipt, oldBytes); fs.writeFileSync(pending, original);
            const early = operation.abandonedNormalizations[4];
            assert.equal(early.preparation.kind, 'retained'); assert.equal(early.preparation.staged.kind, 'present');
            assert.equal(early.preparation.staged.content.bytes, 0);
            assert.equal(operation.abandonedNormalizations[5].preparation.staged.content.bytes, 1);
            const altered = JSON.parse(original.toString());
            altered.directory.operations[0].abandonedNormalizations[4].preparation.staged.observation.ino = '999999999999999999';
            fs.writeFileSync(pending, JSON.stringify(altered));
            assert.match(run(true).error, /early normalization preparation changed/);
            assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), altered); fs.writeFileSync(pending, original);
            const torn = operation.abandonedNormalizations[7], tornReceipt = path.join(store, `native-attempt-${torn.normalization.id}.receipt`);
            const tornBytes = fs.readFileSync(tornReceipt), contradictory = Buffer.concat([tornBytes.subarray(0, -1), Buffer.from('?')]);
            const forgedPrefix = JSON.parse(original.toString());
            forgedPrefix.directory.operations[0].abandonedNormalizations[7].digest = createHash('sha256').update(contradictory).digest('hex');
            fs.writeFileSync(tornReceipt, contradictory); fs.writeFileSync(pending, JSON.stringify(forgedPrefix));
            assert.match(run(true).error, /normalization staged prefix changed/);
            assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), forgedPrefix);
            fs.writeFileSync(tornReceipt, tornBytes); fs.writeFileSync(pending, original);
            const normalization = phase.startsWith('forward-') ? operation.normalization : operation.rollbackNormalization;
            const receipt = path.join(store, `native-attempt-${normalization.id}.receipt`), bytes = fs.readFileSync(receipt);
            assert.equal(normalization.completedReceiptDigest, createHash('sha256').update(bytes).digest('hex'));
            fs.appendFileSync(receipt, 'changed\n'); assert.match(run(true).error, /Normalized native receipt changed/);
            assert.deepEqual(fs.readFileSync(pending), original); fs.writeFileSync(receipt, bytes);
            const held = path.join(outside, `.litcode-linked-${normalization.id}`, 'held');
            assert.equal(fs.statSync(held).nlink, 2); assert.equal(fs.statSync(path.join(outside, normalization.alias)).ino, fs.statSync(held).ino);
          }
          if (phase.endsWith('-native') || phase.endsWith('-captured')) {
            const operation = JSON.parse(original.toString()).directory.operations[0];
            const attempt = phase.startsWith('forward-') ? operation.stage : operation.rollback;
            const receipt = path.join(store, `native-attempt-${attempt.id}.receipt`), bytes = fs.readFileSync(receipt);
            assert.equal(attempt.reconciledReceipt, createHash('sha256').update(bytes).digest('hex'));
            fs.appendFileSync(receipt, 'changed\n');
            assert.match(run(true).error, /Reconciled native receipt changed/);
            assert.deepEqual(fs.readFileSync(pending), original);
            fs.writeFileSync(receipt, bytes);
            if (scenario === 'replace') {
              const changed = bytes.toString().replace(/^(intent replace [^\n ]+ v2:[^:]+:)[^:]+/m, '$1999999999999999999');
              const corrupt = JSON.parse(original.toString()), entry = corrupt.directory.operations[0];
              (phase.startsWith('forward-') ? entry.stage : entry.rollback).reconciledReceipt = createHash('sha256').update(changed).digest('hex');
              fs.writeFileSync(receipt, changed); fs.writeFileSync(pending, JSON.stringify(corrupt));
              assert.match(run(true).error, /Reconciled native receipt outcome differs/);
              assert.deepEqual(JSON.parse(fs.readFileSync(pending, 'utf8')), corrupt);
              fs.writeFileSync(receipt, bytes); fs.writeFileSync(pending, original);
            }
          }
          assert.ok(fs.existsSync(branch)); assert.deepEqual(fs.readFileSync(archived), journal);
          assert.equal(fs.statSync(archived).ino, record.branch.inode);
          assert.deepEqual(fs.readFileSync(pending), original);
          run(true, 'after-unlink');
          assert.equal(fs.existsSync(branch), false); assert.deepEqual(fs.readFileSync(archived), journal);
          assert.equal(fs.statSync(archived).ino, record.branch.inode);
          assert.deepEqual(fs.readFileSync(pending), original);
          assert.match(run(false).error, /explicit grant/);
          if (scenario === 'replace') {
            fs.renameSync(archived, `${archived}-original`); fs.writeFileSync(archived, journal);
            assert.match(run(true).error, /identity changed|archive changed/);
            assert.deepEqual(fs.readFileSync(pending), original);
            fs.unlinkSync(archived); fs.renameSync(`${archived}-original`, archived);
          }
        }
        assert.deepEqual(run(true), { first: { recovery: phase === 'committed' ? 'committed' : 'rolled_back' }, second: { recovery: 'none' } });
        assert.equal(fs.existsSync(pending), false);
        assert.equal(fs.readFileSync(local, 'utf8'), phase === 'committed' ? 'LOCAL_BEFORE' : 'LOCAL_AFTER');
        if (phase === 'committed' ? scenario === 'remove' : scenario === 'create') assert.equal(fs.existsSync(target), false);
        else {
          assert.deepEqual(fs.readFileSync(target), phase === 'committed' ? baseline : Buffer.from('AFTER'));
          assert.equal(fs.statSync(target).mode & 0o7777, zeroCreate ? 0 : phase === 'committed' ? 0o751 : 0o640);
        }
        if (scenario === 'multi') { assert.equal(fs.readFileSync(other, 'utf8'), 'AFTER'); assert.equal(fs.statSync(other).mode & 0o7777, 0o640); }
        if (phase !== 'prepared') {
          assert.ok(fs.existsSync(path.join(store, `directory-${phase === 'committed' ? 'rewind' : 'rollback'}-${record.id}.json`)));
          for (const operation of record.directory.operations) for (const state of [operation.before, operation.after])
            if (state.kind === 'present') assert.ok(fs.existsSync(path.join(store, 'objects', state.content.sha256)));
        }
      }
    } finally { await session.close(); }
  });
});

test('owned directory publication transaction preserves prior bytes and cold result', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  const original = Buffer.from([0, 255, 66, 10, 128]);
  let hookCalls = 0;
  fs.writeFileSync(target, original, { mode: 0o751 });
  const writeTool = tools.find(tool => tool.schema.name === 'write_file')!, execute = writeTool.execute;
  writeTool.execute = async (input, context) => {
    try { return await execute(input, { ...context, directoryPublicationAuthorization: undefined }); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes('writes through additional directory grants are not implemented')) throw error;
      assert.ok(context.session && context.toolUseId && context.pathApprovalCall && context.authorizationIdentity);
      const backup = context.session.directoryBackups.at(-1), grant = context.session.workingDirectories(false).readHandle?.(outside);
      assert.ok(backup && backup.kind === 'valid' && grant);
      const publish = Reflect.get(context.session, 'publishDirectoryFileTransaction');
      assert.equal(typeof publish, 'function');
      assert.ok(typeof input === 'object' && input !== null && 'path' in input && 'content' in input);
      assert.equal(input.path, target); assert.equal(input.content, hookCalls === 1 ? 'PUBLISHED' : 'SECOND');
      const transaction = { toolUseId: context.toolUseId, backupId: backup.id, grant,
        lexicalPath: target, content: Buffer.from(String(input.content)), signal: context.signal,
        authorizationSignal: context.authorizationIdentity.signal, approvalCall: context.pathApprovalCall,
        authorization: context.directoryPublicationAuthorization };
      const expired = new AbortController(); expired.abort();
      const previous = context.session.directoryPublications;
      assert.throws(() => Reflect.apply(publish, context.session, [{ ...transaction, authorization: {}, authorizationSignal: expired.signal }]));
      assert.deepEqual(context.session.directoryPublications, previous);
      const result = Reflect.apply(publish, context.session, [transaction]);
      assert.throws(() => Reflect.apply(publish, context.session, [transaction]), /authorization|already attempted/);
      return JSON.stringify(result);
    }
  };
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] },
    hooks: { PreToolUse: [{ type: 'callback', name: 'rewrite' }] } }) });
  let publicationIds: string[] = [];
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const write = () => response([call('external-write', 'write_file', { path: path.join(outside, 'requested'), content: 'ORIGINAL_REQUEST', overwrite: true })], 'tool_use');
    await new Agent(session, new ScriptedProvider([write(), write(), done()]), tools,
      { hookOptions: { resolveCallbackHook: async () => ({ hookSpecificOutput: { hookEventName: 'PreToolUse',
        updatedInput: { path: target, content: ++hookCalls === 1 ? 'PUBLISHED' : 'SECOND', overwrite: true } } }) } }).run('write fixture');
    const results = resultBatches(session).flat();
    assert.equal(results.length, 2);
    for (const result of results) { assert.notEqual(result.is_error, true, JSON.stringify(result)); assert.equal(JSON.parse(String(result.content)).kind, 'durable'); }
    assert.equal(fs.readFileSync(target, 'utf8'), 'SECOND'); assert.equal(fs.statSync(target).mode & 0o7777, 0o751);
    assert.equal(fs.existsSync(path.join(outside, 'requested')), false);
    const records = Reflect.get(session, 'directoryPublications') as { kind: string; id: string }[];
    assert.deepEqual(records.map(record => record.kind), ['durable', 'durable']); publicationIds = records.map(record => record.id);
    const intents = session.events.filter(row => row.kind === 'directory_publication_intent');
    assert.deepEqual(intents.map(intent => intent.kind === 'directory_publication_intent' && intent.content.sha256),
      ['PUBLISHED', 'SECOND'].map(value => createHash('sha256').update(value).digest('hex')));
    if (intents[0]?.kind === 'directory_publication_intent') assert.throws(() => session.append(intents[0]), /live transaction/);
    const history = session.directoryFileHistory;
    assert.equal(history.kind, 'available');
    if (history.kind !== 'available') throw new Error('directory history unavailable');
    const reference = history.snapshots[0]?.entries[0]?.reference;
    if (reference?.kind !== 'present') throw new Error('prior history missing');
    assert.deepEqual(session.readDirectoryHistoryBackup(reference.backupId)?.bytes, original);
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    const p=s.directoryPublications;process.stdout.write(JSON.stringify(p.map(x=>({id:x.id,kind:x.kind}))));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })), publicationIds.map(id => ({ id, kind: 'durable' })));
  const receipt = `${session.file}.publication-receipt-${publicationIds[0]}`, bytes = fs.readFileSync(receipt);
  try {
    const altered = JSON.parse(bytes.toString()); altered.result = '0'.repeat(64); fs.writeFileSync(receipt, JSON.stringify(altered));
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })),
      [{ id: publicationIds[0], kind: 'unknown' }, { id: publicationIds[1], kind: 'durable' }]);
  } finally { fs.writeFileSync(receipt, bytes); }
  const lastReceipt = `${session.file}.publication-receipt-${publicationIds[1]}`, lastReceiptBytes = fs.readFileSync(lastReceipt);
  const beforeForgery = fs.readFileSync(session.file), lines = beforeForgery.toString('utf8').trimEnd().split('\n');
  try {
    const intentIndex = lines.findIndex(line => { const row = JSON.parse(line); return row.kind === 'directory_publication_intent' && row.id === publicationIds[1]; });
    const resultIndex = lines.findIndex(line => { const row = JSON.parse(line); return row.kind === 'directory_publication_result' && row.id === publicationIds[1]; });
    assert.ok(intentIndex >= 0 && resultIndex > intentIndex);
    const intent = JSON.parse(lines[intentIndex]!); intent.content.sha256 = createHash('sha256').update('OTHER!').digest('hex');
    lines[intentIndex] = JSON.stringify(intent);
    const digest = createHash('sha256').update(JSON.stringify(intent)).digest('hex'), result = JSON.parse(lines[resultIndex]!);
    result.intent = digest; lines[resultIndex] = JSON.stringify(result);
    const prefix = Buffer.from(lines.slice(0, resultIndex + 1).join('\n') + '\n'), receipt = JSON.parse(lastReceiptBytes.toString());
    receipt.intent = digest; receipt.result = createHash('sha256').update(JSON.stringify(result)).digest('hex');
    receipt.journal = { bytes: prefix.length, sha256: createHash('sha256').update(prefix).digest('hex') };
    fs.writeFileSync(session.file, lines.join('\n') + '\n'); fs.writeFileSync(lastReceipt, JSON.stringify(receipt));
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })),
      [{ id: publicationIds[0], kind: 'durable' }, { id: publicationIds[1], kind: 'unknown' }]);
  } finally { fs.writeFileSync(session.file, beforeForgery); fs.writeFileSync(lastReceipt, lastReceiptBytes); }
  const journal = fs.readFileSync(session.file), orphanId = 'bd12c8e9-5d9a-42b4-8d58-c073ba95bb40';
  try {
    fs.appendFileSync(session.file, JSON.stringify({ kind: 'directory_publication_result', id: orphanId, owner: session.id,
      intent: '0'.repeat(64), outcome: { kind: 'unknown' } }) + '\n');
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })),
      [...publicationIds.map(id => ({ id, kind: 'durable' })), { id: orphanId, kind: 'unknown' }]);
  } finally { fs.writeFileSync(session.file, journal); }
});

test('retained directory publication binds its held inode across cold readers', { skip: process.platform !== 'darwin' }, async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  const original = Buffer.from([0, 255, 65, 10, 128]); fs.writeFileSync(target, original, { mode: 0o751 });
  const originalStat = fs.statSync(target, { bigint: true });
  const writeTool = tools.find(tool => tool.schema.name === 'write_file')!, execute = writeTool.execute;
  writeTool.execute = async (input, context) => {
    try { return await execute(input, { ...context, directoryPublicationAuthorization: undefined }); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes('writes through additional directory grants are not implemented')) throw error;
      assert.ok(context.session && context.toolUseId && context.pathApprovalCall && context.authorizationIdentity);
      const backup = context.session.directoryBackups.at(-1), grant = context.session.workingDirectories(false).readHandle?.(outside);
      assert.ok(backup && backup.kind === 'valid' && grant);
      const publish = Reflect.get(context.session, 'publishDirectoryFileTransaction');
      const result = Reflect.apply(publish, context.session, [{ toolUseId: context.toolUseId, backupId: backup.id, grant,
        lexicalPath: target, content: Buffer.from('PUBLISHED'), signal: context.signal,
        authorizationSignal: context.authorizationIdentity.signal, approvalCall: context.pathApprovalCall,
        authorization: context.directoryPublicationAuthorization, strategy: 'retained' }]);
      assert.equal(result.kind, 'durable'); assert.ok('held' in result && 'transactionId' in result);
      assert.equal(result.held.ino, String(originalStat.ino));
      assert.deepEqual(fs.readFileSync(path.join(outside, `.litcode-replace-${result.transactionId}`, 'held')), original);
      return 'retained publication';
    }
  };
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let id = '';
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('retained-write', 'write_file', { path: target, content: 'PUBLISHED', overwrite: true })], 'tool_use'), done()]), tools).run('write retained fixture');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined);
    assert.equal(fs.readFileSync(target, 'utf8'), 'PUBLISHED');
    const publication = session.directoryPublications[0];
    assert.ok(publication && publication.kind === 'durable' && 'retained' in publication && publication.retained);
    id = publication.id;
    const observe = Reflect.get(session, 'observeRetainedDirectoryPublication');
    assert.equal(typeof observe, 'function');
    let grant = session.workingDirectories(false).readHandle?.(outside);
    assert.ok(grant);
    const signal = new AbortController().signal;
    const inspect = () => Reflect.apply(observe, session, [{ id, grant, signal }]);
    assert.equal(inspect().kind, 'observed');
    const aborted = new AbortController(); aborted.abort();
    assert.equal(Reflect.apply(observe, session, [{ id, grant, signal: aborted.signal }]).kind, 'unknown');
    assert.equal(Reflect.apply(observe, session, [{ id, grant: { ...grant, incarnation: '00000000-0000-4000-8000-000000000000' }, signal }]).kind, 'unknown');
    session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    assert.equal(inspect().kind, 'unknown');
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    grant = session.workingDirectories(false).readHandle?.(outside); assert.ok(grant);
    assert.equal(inspect().kind, 'observed');
    const transaction = path.join(outside, `.litcode-replace-${id}`), moved = `${transaction}-moved`;
    fs.renameSync(transaction, moved);
    assert.equal(inspect().kind, 'unknown');
    fs.renameSync(moved, transaction);
    assert.equal(inspect().kind, 'observed');
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify(s.directoryPublications));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const records = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
    assert.equal(records[0]?.kind, 'durable'); assert.equal(records[0]?.id, id); assert.equal(records[0]?.retained?.held?.ino, String(originalStat.ino));
  }
  const observationReader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    const signal=new AbortController().signal,grant=()=>s.workingDirectories(false).readHandle?.(process.argv[3]);
    const before=s.observeRetainedDirectoryPublication({id:process.argv[4],grant:grant(),signal}).kind;
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[process.argv[3]],destination:'session'}]);
    const after=s.observeRetainedDirectoryPublication({id:process.argv[4],grant:grant(),signal}).kind;
    process.stdout.write(JSON.stringify({before,after}));await s.close();`;
  const coldObservation = () => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', observationReader, root, session.id, outside, id], { encoding: 'utf8' }));
  assert.deepEqual(coldObservation(), { before: 'unknown', after: 'observed' });
  const heldPath = path.join(outside, `.litcode-replace-${id}`, 'held');
  fs.renameSync(heldPath, `${heldPath}-original`); fs.writeFileSync(heldPath, original, { mode: 0o751 });
  assert.deepEqual(coldObservation(), { before: 'unknown', after: 'unknown' });
  fs.unlinkSync(heldPath); fs.renameSync(`${heldPath}-original`, heldPath);
  const receiptPath = `${session.file}.publication-receipt-${id}`, receiptBytes = fs.readFileSync(receiptPath), journalBytes = fs.readFileSync(session.file);
  try {
    const lines = journalBytes.toString('utf8').trimEnd().split('\n');
    const index = lines.findIndex(line => { const row = JSON.parse(line); return row.kind === 'directory_publication_result' && row.id === id; });
    assert.ok(index >= 0);
    const row = JSON.parse(lines[index]!); row.outcome.retained.held.ino = '0'; lines[index] = JSON.stringify(row);
    const prefix = Buffer.from(lines.slice(0, index + 1).join('\n') + '\n'), receipt = JSON.parse(receiptBytes.toString());
    receipt.result = createHash('sha256').update(JSON.stringify(row)).digest('hex');
    receipt.journal = { bytes: prefix.length, sha256: createHash('sha256').update(prefix).digest('hex') };
    fs.writeFileSync(session.file, lines.join('\n') + '\n'); fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    for (let i = 0; i < 2; i++) {
      const records = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
      assert.equal(records[0]?.kind, 'unknown');
    }
  } finally { fs.writeFileSync(session.file, journalBytes); fs.writeFileSync(receiptPath, receiptBytes); }
  const held = path.join(outside, `.litcode-replace-${id}`, 'held'); fs.writeFileSync(held, 'CHANGED AFTER RETURN');
  const records = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
  assert.equal(records[0]?.kind, 'durable'); assert.equal(records[0]?.retained?.held?.ino, String(originalStat.ino));
  assert.equal(fs.readFileSync(held, 'utf8'), 'CHANGED AFTER RETURN');
  assert.deepEqual(coldObservation(), { before: 'unknown', after: 'unknown' });
});

test('owned directory publication transaction preserves a replaced target', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'BEFORE');
  const writeTool = tools.find(tool => tool.schema.name === 'write_file')!, execute = writeTool.execute;
  writeTool.execute = async (input, context) => {
    try { return await execute(input, { ...context, directoryPublicationAuthorization: undefined }); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes('writes through additional directory grants are not implemented')) throw error;
      assert.ok(context.session && context.toolUseId && context.pathApprovalCall && context.authorizationIdentity);
      const backup = context.session.directoryBackups.at(-1), grant = context.session.workingDirectories(false).readHandle?.(outside);
      assert.ok(backup && backup.kind === 'valid' && grant);
      fs.renameSync(target, `${target}-original`); fs.writeFileSync(target, 'OTHER');
      const result = context.session.publishDirectoryFileTransaction({ toolUseId: context.toolUseId, backupId: backup.id, grant,
        lexicalPath: target, content: Buffer.from('NEW'), signal: context.signal,
        authorizationSignal: context.authorizationIdentity.signal, approvalCall: context.pathApprovalCall, authorization: context.directoryPublicationAuthorization });
      if (result.kind !== 'durable') throw new Error(`publication ${result.kind}`);
      return 'published';
    }
  };
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([response([call('external-write', 'write_file',
      { path: target, content: 'NEW', overwrite: true })], 'tool_use'), done()]), tools).run('write fixture');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, true);
    assert.deepEqual(session.directoryPublications.map(record => record.kind), ['not_published']);
    assert.equal(fs.readFileSync(target, 'utf8'), 'OTHER'); assert.equal(fs.readFileSync(`${target}-original`, 'utf8'), 'BEFORE');
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify(s.directoryPublications.map(x=>x.kind)));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })), ['not_published']);
});

test('owned directory publication rejects mismatched tool input or lifetime', async () => {
  for (const scenario of ['content', 'path', 'signal', 'authorization-signal', 'overwrite'] as const) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
    fs.writeFileSync(target, 'ORIGINAL');
    const writeTool = tools.find(tool => tool.schema.name === 'write_file')!, execute = writeTool.execute;
    writeTool.execute = async (input, context) => {
      try { return await execute(input, { ...context, directoryPublicationAuthorization: undefined }); }
      catch (error) {
        if (!(error instanceof Error) || !error.message.includes('writes through additional directory grants are not implemented')) throw error;
        assert.ok(context.session && context.toolUseId && context.pathApprovalCall && context.authorizationIdentity);
        const backup = context.session.directoryBackups.at(-1), grant = context.session.workingDirectories(false).readHandle?.(outside);
        assert.ok(backup && backup.kind === 'valid' && grant);
        assert.throws(() => context.session!.publishDirectoryFileTransaction({ toolUseId: context.toolUseId!, backupId: backup.id, grant,
          lexicalPath: scenario === 'path' ? path.join(outside, 'other') : target,
          content: Buffer.from(scenario === 'content' ? 'DIFFERENT' : 'AUTHORIZED'),
          signal: scenario === 'signal' ? new AbortController().signal : context.signal,
          authorizationSignal: scenario === 'authorization-signal' ? new AbortController().signal : context.authorizationIdentity!.signal,
          approvalCall: context.pathApprovalCall!, authorization: context.directoryPublicationAuthorization }), /authorization/i);
        return 'mismatched input rejected';
      }
    };
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    try {
      session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
      await new Agent(session, new ScriptedProvider([response([call('external-write', 'write_file',
        { path: target, content: 'AUTHORIZED', overwrite: scenario !== 'overwrite' })], 'tool_use'), done()]), tools).run('write fixture');
      assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL', scenario);
      assert.equal(resultBatches(session)[0]?.[0]?.is_error, undefined, scenario);
      assert.deepEqual(session.directoryPublications, [], scenario);
    } finally { await session.close(); }
  }
});

test('owned directory publication remains unknown across owner death at native commit barriers', { timeout: 60000 }, async () => {
  const helperRoot = workspace(), helper = path.join(helperRoot, 'write-test');
  execFileSync('cc', ['-std=c11', '-Wall', '-Wextra', '-Werror', '-O2', '-DDIRECTORY_WRITE_TEST', '-o', helper,
    path.resolve('native/directory-write/write.c')]);
  const writer = `import fs from 'node:fs';import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import path from 'node:path';
    import {Session} from './src/session.ts';import {Agent,defaultConfig} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const [root,outside,helper,phase,marker]=process.argv.slice(1),target=path.join(outside,'value'),tools=createTools(),tool=tools.find(x=>x.schema.name==='write_file'),execute=tool.execute;
    tool.execute=async(input,ctx)=>{try{return await execute(input,{...ctx,directoryPublicationAuthorization:undefined})}catch(error){
      if(!String(error).includes('writes through additional directory grants are not implemented'))throw error;
      const backup=phase==='after_publish'?ctx.session.events.findLast(row=>row.kind==='directory_missing_backup'):ctx.session.directoryBackups.at(-1),grant=ctx.session.workingDirectories(false).readHandle(outside),native=childProcess.spawnSync;
      childProcess.spawnSync=(file,args,options)=>{const stdio=[...options.stdio];stdio[5]=5;
        return native(helper,args,{...options,stdio,env:{...process.env,DIRECTORY_WRITE_TEST_POINT:phase,DIRECTORY_WRITE_TEST_CONTROL_STATUS:'1'}})};
      syncBuiltinESMExports();const result=ctx.session.publishDirectoryFileTransaction({toolUseId:ctx.toolUseId,backupId:backup.id,grant,lexicalPath:target,
        content:Buffer.from('PUBLISHED'),signal:ctx.signal,authorizationSignal:ctx.authorizationIdentity.signal,approvalCall:ctx.pathApprovalCall,authorization:ctx.directoryPublicationAuthorization,
        ...(phase.startsWith('replace_')?{strategy:'retained'}:{})});
      if(result.kind!=='durable')throw Error('publication '+result.kind);return 'published';}};
    const s=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture-model',permissions:{mode:'bypass',allow:[],deny:[]}}});
    s.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);fs.writeFileSync(marker,s.id);
    let n=0;const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    const provider={count:async()=>1,complete:async()=>n++?message([{type:'text',text:'done'}],'end_turn'):message([{type:'tool_use',id:'write',name:'write_file',input:{path:target,content:'PUBLISHED',overwrite:true}}],'tool_use')};
    await new Agent(s,provider,tools).run('write fixture');throw Error('writer barrier not reached');`;
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});
    process.stdout.write(JSON.stringify(s.directoryPublications.map(x=>x.kind)));await s.close();`;
  const resume = `import {Session} from './src/session.ts';import {Agent} from './src/agent.ts';import {createTools} from './src/tools.ts';
    const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true});let request;
    const provider={count:async()=>1,complete:async value=>{request=value;return{id:'fixture',model:'fixture',type:'message',role:'assistant',content:[{type:'text',text:'done'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}}}};
    await new Agent(s,provider,createTools()).run();process.stdout.write(JSON.stringify({publications:s.directoryPublications.map(x=>x.kind),unknown:JSON.stringify(request.messages).includes('effect is unknown')}));await s.close();`;
  for (const phase of ['after_recheck', 'after_rename', 'after_publish', ...(process.platform === 'darwin' ? ['replace_after_capture', 'replace_after_publish'] : [])]) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'owner-id');
    if (phase !== 'after_publish') fs.writeFileSync(target, 'ORIGINAL', { mode: 0o751 });
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, outside, helper, phase, marker],
      { stdio: ['ignore', 'ignore', 'pipe', 'ignore', 'ignore', 'pipe'] });
    const control = Array.from(child.stdio).at(5); assert.ok(control instanceof Duplex); assert.ok(child.stderr);
    let diagnostics = '', status = '', writerPid = 0;
    child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { diagnostics += text; });
    control.setEncoding('utf8'); control.on('data', text => { status += text; }); control.on('error', () => {});
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    try {
      const until = Date.now() + 10000;
      while (!new RegExp(`test ${phase} [0-9]+\\n`).test(status) || !fs.existsSync(marker)) {
        assert.ok(Date.now() < until && child.exitCode === null && child.signalCode === null, `${phase}: ${diagnostics}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      writerPid = Number(new RegExp(`test ${phase} ([0-9]+)\\n`).exec(status)![1]);
      assert.ok(child.pid); process.kill(child.pid, 'SIGKILL'); assert.equal((await exited).signal, 'SIGKILL');
      const id = fs.readFileSync(marker, 'utf8');
      assert.throws(() => Session.open(root, { id, recoverLock: true }), /Session lock busy/);
      control.end('c');
      let reopened: Session | undefined;
      const limit = Date.now() + 10000;
      while (!reopened) {
        try { reopened = Session.open(root, { id, recoverLock: true }); }
        catch (error) {
          if (!String(error).includes('Session lock busy') || Date.now() >= limit) throw error;
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      try { assert.deepEqual(reopened.directoryPublications.map(record => record.kind), ['unknown']); }
      finally { await reopened.close(); }
      writerPid = 0;
      if (phase.startsWith('replace_')) {
        const rows = fs.readFileSync(path.join(root, '.agent', `${id}.jsonl`), 'utf8').trimEnd().split('\n').map(line => JSON.parse(line));
        const intent = rows.find(row => row.kind === 'directory_publication_intent');
        assert.equal(intent?.strategy, 'retained');
        assert.equal(fs.readFileSync(path.join(outside, `.litcode-replace-${intent.id}`, 'held'), 'utf8'), 'ORIGINAL');
      }
      const expectedTarget = phase === 'after_recheck' ? 'ORIGINAL' : phase === 'replace_after_capture' ? undefined : 'PUBLISHED';
      if (expectedTarget === undefined) assert.equal(fs.existsSync(target), false);
      else assert.equal(fs.readFileSync(target, 'utf8'), expectedTarget);
      for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
        ['--import', 'tsx', '--input-type=module', '-e', reader, root, id], { encoding: 'utf8' })), ['unknown']);
      assert.deepEqual(JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', resume, root, id], { encoding: 'utf8' })),
        { publications: ['unknown'], unknown: true });
      if (expectedTarget === undefined) assert.equal(fs.existsSync(target), false);
      else assert.equal(fs.readFileSync(target, 'utf8'), expectedTarget);
    } finally {
      if (child.exitCode === null && child.signalCode === null && child.pid) { process.kill(child.pid, 'SIGKILL'); await exited; }
      if (writerPid) { try { process.kill(writerPid, 'SIGKILL'); } catch { /* writer exited */ } }
    }
  }
});

test('owned directory publication retains failure evidence when pending and receipt fences fail', async () => {
  const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), tools = createTools();
  fs.writeFileSync(target, 'ORIGINAL', { mode: 0o751 });
  const writeTool = tools.find(tool => tool.schema.name === 'write_file')!, execute = writeTool.execute;
  writeTool.execute = async (input, context) => {
    try { return await execute(input, { ...context, directoryPublicationAuthorization: undefined }); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.includes('writes through additional directory grants are not implemented')) throw error;
      assert.ok(context.session && context.toolUseId && context.pathApprovalCall && context.authorizationIdentity);
      const backup = context.session.directoryBackups.at(-1), grant = context.session.workingDirectories(false).readHandle?.(outside);
      assert.ok(backup && backup.kind === 'valid' && grant);
      const sync = fs.fsyncSync, unlink = fs.unlinkSync, open = fs.openSync, rename = fs.renameSync;
      let removed = false;
      Object.defineProperty(fs, 'unlinkSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        const result = Reflect.apply(unlink, fs, args); if (String(args[0]).includes('.publication-pending-')) removed = true; return result;
      } });
      Object.defineProperty(fs, 'fsyncSync', { configurable: true, writable: true, value: (fd: number) => {
        if (removed && fs.fstatSync(fd).isDirectory()) throw new Error('injected publication directory sync');
        return sync(fd);
      } });
      Object.defineProperty(fs, 'openSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        if (removed && String(args[0]).includes('.publication-pending-')) throw new Error('injected pending recreation');
        return Reflect.apply(open, fs, args);
      } });
      Object.defineProperty(fs, 'renameSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        if (String(args[1]).includes('.publication-unconfirmed-receipt-')) throw new Error('injected receipt isolation');
        return Reflect.apply(rename, fs, args);
      } });
      try {
        context.session.publishDirectoryFileTransaction({ toolUseId: context.toolUseId, backupId: backup.id, grant, lexicalPath: target,
          content: Buffer.from('PUBLISHED'), signal: context.signal, authorizationSignal: context.authorizationIdentity.signal,
          approvalCall: context.pathApprovalCall, authorization: context.directoryPublicationAuthorization });
        throw new Error('publication failure barrier not reached');
      } finally {
        Object.defineProperty(fs, 'fsyncSync', { configurable: true, writable: true, value: sync });
        Object.defineProperty(fs, 'unlinkSync', { configurable: true, writable: true, value: unlink });
        Object.defineProperty(fs, 'openSync', { configurable: true, writable: true, value: open });
        Object.defineProperty(fs, 'renameSync', { configurable: true, writable: true, value: rename });
      }
    }
  };
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await assert.rejects(new Agent(session, new ScriptedProvider([response([call('external-write', 'write_file',
      { path: target, content: 'PUBLISHED', overwrite: true })], 'tool_use')]), tools).run('write fixture'), /journal write failed/);
    assert.equal(fs.readFileSync(target, 'utf8'), 'PUBLISHED');
    assert.deepEqual(session.directoryPublications.map(record => record.kind), ['unknown']);
    assert.ok(session.events.some(row => row.kind === 'directory_publication_failed'));
    assert.ok(fs.readdirSync(path.dirname(session.file)).some(name => name.includes('.publication-receipt-')));
    assert.equal(fs.readdirSync(path.dirname(session.file)).some(name => name.includes('.publication-pending-')), false);
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify(s.directoryPublications.map(x=>x.kind)));await s.close();`;
  for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })), ['unknown']);
  assert.equal(fs.readFileSync(target, 'utf8'), 'PUBLISHED');
});

test('directory backup binds the issuing assistant and user turn despite reused tool IDs', async () => {
  const root = workspace(), outside = workspace(), tools = createTools(), target = path.join(outside, 'value');
  fs.writeFileSync(target, 'ORIGINAL_MESSAGE_CONTEXT', { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  let expected: { users: string[]; parents: string[]; contexts: { userMessageId: string; parentMessageId: string }[]; ids: string[] };
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const writeCall = () => response([call('reused-backup', 'write_file', { path: target, content: 'NEW', overwrite: false })], 'tool_use');
    const agent = new Agent(session, new ScriptedProvider([writeCall(), writeCall(), done(), writeCall(), done()]), tools);
    await agent.run('first user turn');
    await agent.run('second user turn');
    const users = session.events.flatMap(event => event.kind === 'message' && event.message.role === 'user' && event.messageId ? [event.messageId] : []);
    const parents = session.events.flatMap(event => event.kind === 'message' && event.message.role === 'assistant' && event.messageId &&
      Array.isArray(event.message.content) && event.message.content.some(block => block.type === 'tool_use' && block.id === 'reused-backup') ? [event.messageId] : []);
    const starts = session.events.filter(event => event.kind === 'tool_start' && event.id === 'reused-backup');
    const backups = session.directoryBackups;
    assert.equal(users.length, 2); assert.equal(parents.length, 3); assert.equal(new Set([...users, ...parents]).size, 5);
    assert.deepEqual(starts.map(event => event.kind === 'tool_start' && event.parentMessageId), parents);
    assert.deepEqual(backups.map(backup => backup.kind), ['valid', 'valid', 'valid']);
    const contexts = [{ userMessageId: users[0]!, parentMessageId: parents[0]! }, { userMessageId: users[0]!, parentMessageId: parents[1]! },
      { userMessageId: users[1]!, parentMessageId: parents[2]! }];
    assert.deepEqual(backups.map(backup => backup.kind === 'valid' && backup.witness.messageContext), contexts);
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL_MESSAGE_CONTEXT');
    expected = { users, parents, contexts, ids: backups.map(backup => backup.id) };
  } finally { await session.close(); }
  const reader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    const users=s.events.filter(e=>e.kind==='message'&&e.message.role==='user'&&e.messageId).map(e=>e.messageId);
    const parents=s.events.filter(e=>e.kind==='message'&&e.message.role==='assistant'&&e.messageId&&Array.isArray(e.message.content)&&e.message.content.some(b=>b.type==='tool_use'&&b.id==='reused-backup')).map(e=>e.messageId);
    const backups=s.directoryBackups;process.stdout.write(JSON.stringify({users,parents,contexts:backups.map(b=>b.kind==='valid'?b.witness.messageContext:null),ids:backups.map(b=>b.id),kinds:backups.map(b=>b.kind)}));await s.close();`;
  const cold = () => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
  for (let i = 0; i < 2; i++) assert.deepEqual(cold(), { ...expected, kinds: ['valid', 'valid', 'valid'] });
  const journal = fs.readFileSync(session.file), lines = journal.toString('utf8').trimEnd().split('\n');
  const id = expected.ids[2]!;
  const index = lines.findIndex(line => { const event = JSON.parse(line); return event.kind === 'directory_backup' && event.id === id; });
  assert.ok(index >= 0);
  const receiptPath = `${session.file}.backup-receipt-${id}`, receiptBytes = fs.readFileSync(receiptPath);
  try {
    const forged = JSON.parse(lines[index]!); forged.messageContext.userMessageId = expected.users[0];
    lines[index] = JSON.stringify(forged);
    const prefix = Buffer.from(lines.slice(0, index + 1).join('\n') + '\n');
    const receipt = JSON.parse(receiptBytes.toString('utf8'));
    receipt.witness = createHash('sha256').update(JSON.stringify(forged)).digest('hex');
    receipt.journal = { bytes: prefix.length, sha256: createHash('sha256').update(prefix).digest('hex') };
    fs.writeFileSync(session.file, lines.join('\n') + '\n'); fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    const altered = cold();
    assert.equal(altered.kinds[2], 'unknown');
  } finally { fs.writeFileSync(session.file, journal); fs.writeFileSync(receiptPath, receiptBytes); }
  assert.deepEqual(cold(), { ...expected, kinds: ['valid', 'valid', 'valid'] });
  const reopened = Session.open(root, { id: session.id });
  let forkId = '';
  try {
    const fork = forkSession(reopened);
    try {
      forkId = fork.id;
      const ids = fork.events.flatMap(event => event.kind === 'message' && event.messageId ? [event.messageId] : []);
      assert.ok([...expected.users, ...expected.parents].every(id => ids.includes(id)));
      assert.deepEqual(fork.directoryBackups, []);
    } finally { await fork.close(); }
  } finally { await reopened.close(); }
  const forkReader = `import {Session} from './src/session.ts';const s=Session.open(process.argv[1],{id:process.argv[2]});
    process.stdout.write(JSON.stringify({ids:s.events.filter(e=>e.kind==='message'&&e.messageId).map(e=>e.messageId),backups:s.directoryBackups}));await s.close();`;
  for (let i = 0; i < 2; i++) {
    const fork = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', forkReader, root, forkId], { encoding: 'utf8' }));
    assert.ok([...expected.users, ...expected.parents].every(id => fork.ids.includes(id)));
    assert.deepEqual(fork.backups, []);
  }
});

test('directory grant Write preserves binary backup evidence while refusing the write', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const target = path.join(outside, 'value');
  const original = Buffer.alloc(100_003);
  for (let i = 0; i < original.length; i++) original[i] = i % 256;
  fs.writeFileSync(target, original, { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(session, new ScriptedProvider([
      response([call('external-binary', 'write_file', { path: target, content: 'NEW', overwrite: false })], 'tool_use'), done(),
    ]), tools).run('attempt external write');
    assert.deepEqual(fs.readFileSync(target), original);
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, true);
    const names = fs.readdirSync(path.dirname(session.file)).filter(name => name.startsWith(`${path.basename(session.file)}.backup-unknown-`));
    assert.equal(names.length, 1);
    const evidence = path.join(path.dirname(session.file), names[0]!);
    assert.deepEqual(fs.readFileSync(evidence), original);
    assert.equal(fs.statSync(evidence).mode & 0o777, 0o600);
    const backup = session.directoryBackups[0];
    assert.equal(backup?.kind, 'valid');
    assert.deepEqual(session.readDirectoryBackup(backup!.id), original);
    if (backup?.kind === 'valid') {
      assert.equal(backup.witness.toolUseId, 'external-binary');
      assert.equal(backup.witness.lexicalPath, target);
      assert.equal(backup.witness.owner, session.id);
      assert.equal(backup.witness.bytes, original.length);
      assert.equal(backup.witness.sha256, createHash('sha256').update(original).digest('hex'));
      assert.deepEqual(backup.witness.source.begin, backup.witness.source.end);
      assert.equal(backup.witness.source.begin.size, String(original.length));
      assert.ok('mode' in backup.witness.source.begin);
      assert.equal(backup.witness.source.begin.mode, 0o751);
      assert.ok('parent' in backup.witness.source.begin);
      const parent = fs.statSync(outside, { bigint: true });
      assert.deepEqual(backup.witness.source.begin.parent, { dev: String(parent.dev), ino: String(parent.ino) });
      assert.equal(backup.witness.grant.incarnation.length, 36);
      assert.throws(() => session.append({ kind: 'directory_backup_failed', id: backup.id, owner: session.id, witness: '0'.repeat(64) }), /live transaction/);
      assert.equal(session.directoryBackups[0]?.kind, 'valid');
    }
    const lock = `${session.file}.lock`, lockBytes = fs.readFileSync(lock);
    try {
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token: '00000000-0000-4000-8000-000000000001' }));
      assert.equal(session.directoryBackups[0]?.kind, 'unknown');
      assert.equal(session.readDirectoryBackup(backup!.id), undefined);
    } finally { fs.writeFileSync(lock, lockBytes); }
    assert.equal(session.directoryBackups[0]?.kind, 'valid');
  } finally { await session.close(); }
});

test('directory grant Write records prior bytes before the external-write refusal', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const target = path.join(outside, 'value');
  fs.writeFileSync(target, 'ORIGINAL_BACKUP_CONTENT', { mode: 0o751 });
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'bypass', allow: [], deny: [] },
  }) });
  let liveBackup = false, backupId = '';
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const provider = new ScriptedProvider([
      response([call('external-backup', 'write_file', { path: target, content: 'NEW_CONTENT', overwrite: false })], 'tool_use'),
      done(),
    ]);
    await new Agent(session, provider, tools).run('attempt external write');
    assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL_BACKUP_CONTENT');
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, true);
    liveBackup = session.events.some(event => String(event.kind).includes('backup'));
    const backup = session.directoryBackups[0];
    assert.equal(backup?.kind, 'valid');
    backupId = backup!.id;
    assert.equal(session.readDirectoryBackup(backupId)?.toString(), 'ORIGINAL_BACKUP_CONTENT');
  } finally { await session.close(); }
  const reader = `import { Session } from './src/session.ts';
    const session = Session.open(process.argv[1], { id: process.argv[2] });
    const backup = session.directoryBackups[0];
    process.stdout.write(JSON.stringify({ event: session.events.some(event => String(event.kind).includes('backup')),
      kind: backup?.kind, id: backup?.id, mode: backup?.kind==='valid'&&backup.witness.source.begin.mode,
      parent: backup?.kind==='valid'&&backup.witness.source.begin.parent, content: backup && session.readDirectoryBackup(backup.id)?.toString() }));
    await session.close();`;
  const cold = Array.from({ length: 2 }, () => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })));
  assert.equal(liveBackup, true);
  const parent = fs.statSync(outside, { bigint: true });
  assert.deepEqual(cold, Array.from({ length: 2 }, () => ({ event: true, kind: 'valid', id: backupId, mode: 0o751,
    parent: { dev: String(parent.dev), ino: String(parent.ino) }, content: 'ORIGINAL_BACKUP_CONTENT' })));
});

test('directory backup cold readers reject missing, foreign and changed evidence', async () => {
  const root = workspace(), outside = workspace(), tools = createTools(), target = path.join(outside, 'value');
  const original = Buffer.from([0, 255, 65, 66, 10]);
  fs.writeFileSync(target, original);
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
  await new Agent(session, new ScriptedProvider([response([call('backup-evidence', 'write_file', { path: target, content: 'NEW', overwrite: false })], 'tool_use'), done()]), tools).run('attempt write');
  const backup = session.directoryBackups[0];
  assert.equal(backup?.kind, 'valid');
  assert.ok(backup && backup.kind === 'valid');
  const receipt = `${session.file}.backup-receipt-${backup.id}`, pending = `${session.file}.backup-pending-${backup.id}`;
  const receiptBytes = fs.readFileSync(receipt), journalBytes = fs.readFileSync(session.file);
  await session.close();
  const reader = `import { Session } from './src/session.ts'; const s=Session.open(process.argv[1],{id:process.argv[2]});
    const b=s.directoryBackups[0]; process.stdout.write(JSON.stringify({kind:b?.kind,bytes:b&&s.readDirectoryBackup(b.id)?.toString('hex')})); await s.close();`;
  const cold = () => JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
  const expectUnknown = () => assert.deepEqual([cold(), cold()], [{ kind: 'unknown' }, { kind: 'unknown' }]);
  fs.unlinkSync(receipt); expectUnknown(); fs.writeFileSync(receipt, receiptBytes, { mode: 0o600 });
  const foreign = JSON.parse(receiptBytes.toString()); foreign.owner = '00000000-0000-4000-8000-000000000001';
  fs.writeFileSync(receipt, JSON.stringify(foreign)); expectUnknown(); fs.writeFileSync(receipt, receiptBytes);
  const foreignRow = journalBytes.toString().replace(`"owner":"${session.id}","toolUseId":"backup-evidence"`, '"owner":"00000000-0000-4000-8000-000000000001","toolUseId":"backup-evidence"');
  assert.notEqual(foreignRow, journalBytes.toString());
  fs.writeFileSync(session.file, foreignRow); expectUnknown(); fs.writeFileSync(session.file, journalBytes);
  fs.writeFileSync(backup.sidecar, Buffer.from([1, 255, 65, 66, 10])); expectUnknown(); fs.writeFileSync(backup.sidecar, original);
  fs.writeFileSync(pending, '{}', { mode: 0o600 }); expectUnknown(); fs.unlinkSync(pending);
  assert.deepEqual(cold(), { kind: 'valid', bytes: original.toString('hex') });
  const other = Session.open(root, { config: config(root, tools) });
  try { assert.deepEqual(other.directoryBackups, []); assert.equal(other.readDirectoryBackup(backup.id), undefined); }
  finally { await other.close(); }
  assert.deepEqual(fs.readFileSync(target), original);
});

test('directory backup keeps interrupted journal and receipt transactions unknown', async () => {
  for (const fault of ['journal-short', 'journal-fsync', 'receipt-rename', 'receipt-dir-fsync', 'pending-remove-fsync', 'pending-recreate-open',
    'pending-recreate-and-isolate', 'pending-recreate-and-isolate-journal-fsync', 'pending-recreate-and-isolate-journal-short'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), target = path.join(outside, 'value');
    fs.writeFileSync(target, 'ORIGINAL_FAULT_BYTES');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const record = session.recordDirectoryBackup.bind(session);
    const combined = fault.startsWith('pending-recreate-and-isolate');
    let triggered = false, partialFd = -1, renamedReceipt = false, removedPending = false, pendingFailed = false, isolationFailed = false;
    let live: string | undefined;
    session.recordDirectoryBackup = input => {
      const originalWrite = fs.writeSync, originalSync = fs.fsyncSync, originalRename = fs.renameSync, originalUnlink = fs.unlinkSync, originalOpen = fs.openSync;
      const journal = fs.statSync(session.file);
      const isJournal = (fd: number) => { const stat = fs.fstatSync(fd); return stat.dev === journal.dev && stat.ino === journal.ino; };
      Object.defineProperty(fs, 'writeSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        const fd = args[0];
        if (typeof fd === 'number' && fd === partialFd) { triggered = true; return 0; }
        if (typeof fd === 'number' && isJournal(fd) && Buffer.isBuffer(args[1]) &&
            ((fault === 'journal-short' && args[1].includes(Buffer.from('"kind":"directory_backup"'))) ||
             (fault === 'pending-recreate-and-isolate-journal-short' && args[1].includes(Buffer.from('"kind":"directory_backup_failed"'))))) {
          partialFd = fd; args[3] = 12;
        }
        return Reflect.apply(originalWrite, fs, args);
      } });
      Object.defineProperty(fs, 'fsyncSync', { configurable: true, writable: true, value: (fd: number) => {
        if (removedPending && (fault === 'pending-remove-fsync' || fault === 'pending-recreate-open' ||
            fault === 'pending-recreate-and-isolate-journal-fsync' || (combined && fs.fstatSync(fd).isDirectory()))) {
          triggered = true; throw new Error(`injected ${fault}`);
        }
        if (!triggered && ((fault === 'journal-fsync' && isJournal(fd)) ||
            (fault === 'receipt-dir-fsync' && renamedReceipt && fs.fstatSync(fd).isDirectory()))) {
          triggered = true; throw new Error(`injected ${fault}`);
        }
        return originalSync(fd);
      } });
      Object.defineProperty(fs, 'renameSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        if (combined && String(args[1]).includes('.backup-unconfirmed-receipt-')) {
          isolationFailed = true; throw new Error('injected receipt isolation failure');
        }
        if (String(args[1]).includes('.backup-receipt-')) {
          if (fault === 'receipt-rename') { triggered = true; throw new Error(`injected ${fault}`); }
          const result = Reflect.apply(originalRename, fs, args); renamedReceipt = true; return result;
        }
        return Reflect.apply(originalRename, fs, args);
      } });
      Object.defineProperty(fs, 'unlinkSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        const result = Reflect.apply(originalUnlink, fs, args);
        if (String(args[0]).includes('.backup-pending-')) removedPending = true;
        return result;
      } });
      Object.defineProperty(fs, 'openSync', { configurable: true, writable: true, value: (...args: unknown[]) => {
        if ((fault === 'pending-recreate-open' || combined) && removedPending && String(args[0]).includes('.backup-pending-')) {
          pendingFailed = true; throw new Error('injected pending recreation failure');
        }
        return Reflect.apply(originalOpen, fs, args);
      } });
      try { record(input); }
      finally {
        Object.defineProperty(fs, 'writeSync', { configurable: true, writable: true, value: originalWrite });
        Object.defineProperty(fs, 'fsyncSync', { configurable: true, writable: true, value: originalSync });
        Object.defineProperty(fs, 'renameSync', { configurable: true, writable: true, value: originalRename });
        Object.defineProperty(fs, 'unlinkSync', { configurable: true, writable: true, value: originalUnlink });
        Object.defineProperty(fs, 'openSync', { configurable: true, writable: true, value: originalOpen });
      }
    };
    try {
      await assert.rejects(new Agent(session, new ScriptedProvider([response([call(`fault-${fault}`, 'write_file', { path: target, content: 'NEW', overwrite: true })], 'tool_use'), done()]), tools).run('attempt write'));
      assert.equal(triggered, true, fault);
      assert.equal(session.isJournalFenced, true, fault);
      live = session.directoryBackups[0]?.kind;
      if (combined) { assert.equal(pendingFailed, true, fault); assert.equal(isolationFailed, true, fault); }
      assert.equal(fs.readFileSync(target, 'utf8'), 'ORIGINAL_FAULT_BYTES');
    } finally { await session.close(); }
    const originalJournal = fs.readFileSync(session.file);
    const reader = `import { Session } from './src/session.ts'; const s=Session.open(process.argv[1],{id:process.argv[2]}); const b=s.directoryBackups[0]; process.stdout.write(JSON.stringify({kind:b?.kind,bytes:b&&s.readDirectoryBackup(b.id)?.toString()})); await s.close();`;
    const recovered = [];
    for (let i = 0; i < 2; i++) {
      const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' }));
      recovered.push(cold);
    }
    assert.deepEqual({ live, recovered }, { live: 'unknown', recovered: [{ kind: 'unknown' }, { kind: 'unknown' }] }, fault);
    if (fault === 'journal-short' || fault === 'pending-recreate-and-isolate-journal-short') {
      const torn = fs.readdirSync(path.dirname(session.file)).find(name => name.startsWith(`${path.basename(session.file)}.torn-`));
      assert.ok(torn); assert.deepEqual(fs.readFileSync(path.join(path.dirname(session.file), torn)), originalJournal);
    } else assert.deepEqual(fs.readFileSync(session.file), originalJournal);
    if (combined && fault !== 'pending-recreate-and-isolate-journal-short') {
      const rows = originalJournal.toString().trimEnd().split('\n').map(line => JSON.parse(line));
      const failure = rows.find(row => row.kind === 'directory_backup_failed');
      const witness = rows.find(row => row.kind === 'directory_backup');
      assert.deepEqual(failure, { kind: 'directory_backup_failed', id: witness.id, owner: session.id,
        witness: createHash('sha256').update(JSON.stringify(witness)).digest('hex') });
    }
    const evidence = fs.readdirSync(path.dirname(session.file)).find(name => name.startsWith(`${path.basename(session.file)}.backup-unknown-`));
    assert.ok(evidence); assert.equal(fs.readFileSync(path.join(path.dirname(session.file), evidence), 'utf8'), 'ORIGINAL_FAULT_BYTES');
    if (fault === 'pending-recreate-open') {
      const receipt = fs.readdirSync(path.dirname(session.file)).find(name => name.startsWith(`${path.basename(session.file)}.backup-unconfirmed-receipt-`));
      assert.ok(receipt); assert.ok(JSON.parse(fs.readFileSync(path.join(path.dirname(session.file), receipt), 'utf8')).journal.sha256);
    }
  }
});

test('directory backup survives independent writer death at ordered persistence barriers', async () => {
  const writer = `import fs from 'node:fs'; import path from 'node:path';
    import {Session} from './src/session.ts'; import {Agent,defaultConfig} from './src/agent.ts'; import {createTools} from './src/tools.ts';
    const [root,outside,phase,marker]=process.argv.slice(1), tools=createTools();
    const session=Session.open(root,{config:{...defaultConfig(root,tools),model:'fixture-model',permissions:{mode:'bypass',allow:[],deny:[]}}});
    session.adoptPermissionUpdates([{type:'addDirectories',directories:[outside],destination:'session'}]);
    const js=fs.statSync(session.file), ow=fs.writeSync, os=fs.fsyncSync, or=fs.renameSync, ou=fs.unlinkSync, oo=fs.openSync;
    const failurePhase=phase.startsWith('failure-');
    let row=false, receipt=false, stopped=false, removed=false, failure=false;
    const isJournal=fd=>{const s=fs.fstatSync(fd);return s.dev===js.dev&&s.ino===js.ino};
    const stop=()=>{if(stopped)return;stopped=true;fs.writeFileSync(marker,session.id);process.kill(process.pid,'SIGSTOP')};
    fs.writeSync=function(fd,bytes,...args){const n=ow.call(this,fd,bytes,...args);if(Buffer.isBuffer(bytes)&&isJournal(fd)){if(bytes.includes(Buffer.from('"kind":"directory_backup"'))){row=true;if(phase==='journal-write')stop()}if(bytes.includes(Buffer.from('"kind":"directory_backup_failed"'))){failure=true;if(phase==='failure-write')stop()}}return n};
    fs.fsyncSync=function(fd){if(failurePhase&&removed&&fs.fstatSync(fd).isDirectory())throw Error('injected pending removal sync');os.call(this,fd);if(phase==='failure-fsync'&&failure&&isJournal(fd))stop();if(phase==='journal-fsync'&&row&&isJournal(fd))stop();if(phase==='receipt-dir-fsync'&&receipt&&fs.fstatSync(fd).isDirectory())stop()};
    fs.renameSync=function(from,to){if(failurePhase&&String(to).includes('.backup-unconfirmed-receipt-'))throw Error('injected receipt isolation');or.call(this,from,to);if(String(to).includes('.backup-receipt-')){receipt=true;if(phase==='receipt-rename')stop()}};
    fs.unlinkSync=function(file){ou.call(this,file);if(String(file).includes('.backup-pending-')){removed=true;if(phase==='pending-unlink')stop()}};
    fs.openSync=function(file,...args){if(failurePhase&&removed&&String(file).includes('.backup-pending-'))throw Error('injected pending recreation');return oo.call(this,file,...args)};
    let n=0; const message=(content,stop_reason)=>({id:'fixture',model:'fixture',type:'message',role:'assistant',content,stop_reason,stop_sequence:null,usage:{input_tokens:1,output_tokens:1}});
    const provider={count:async()=>1,complete:async()=>n++===0?message([{type:'tool_use',id:'killed-write',name:'write_file',input:{path:path.join(outside,'value'),content:'NEW',overwrite:true}}],'tool_use'):message([{type:'text',text:'done'}],'end_turn')};
    await new Agent(session,provider,tools).run('attempt write'); await session.close();`;
  for (const phase of ['journal-write', 'journal-fsync', 'receipt-rename', 'receipt-dir-fsync', 'pending-unlink', 'failure-write', 'failure-fsync']) {
    const root = workspace(), outside = workspace(), target = path.join(outside, 'value'), marker = path.join(root, 'barrier');
    fs.writeFileSync(target, 'CRASH_BACKUP_BYTES');
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', writer, root, outside, phase, marker], { stdio: ['ignore', 'ignore', 'pipe'] });
    let diagnostics = '';
    child.stderr.setEncoding('utf8'); child.stderr.on('data', text => { diagnostics += text; });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    try {
      const until = Date.now() + 10000;
      while (!fs.existsSync(marker)) {
        assert.ok(Date.now() < until && child.exitCode === null, `${phase} barrier: ${diagnostics}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(child.pid); process.kill(child.pid, 'SIGKILL');
      assert.equal((await exited).signal, 'SIGKILL');
      const id = fs.readFileSync(marker, 'utf8'), journal = path.join(root, '.agent', `${id}.jsonl`), original = fs.readFileSync(journal);
      const reader = `import {Session} from './src/session.ts'; const s=Session.open(process.argv[1],{id:process.argv[2],recoverLock:true}); const b=s.directoryBackups[0]; process.stdout.write(JSON.stringify({kind:b?.kind,bytes:b&&s.readDirectoryBackup(b.id)?.toString()})); await s.close();`;
      for (let i = 0; i < 2; i++) {
        const cold = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', reader, root, id], { encoding: 'utf8' }));
        assert.deepEqual(cold, phase === 'pending-unlink' ? { kind: 'valid', bytes: 'CRASH_BACKUP_BYTES' } : { kind: 'unknown' }, `${phase} cold ${i}`);
      }
      assert.deepEqual(fs.readFileSync(journal), original);
      assert.equal(fs.readFileSync(target, 'utf8'), 'CRASH_BACKUP_BYTES');
    } finally { if (child.exitCode === null && child.signalCode === null && child.pid) { process.kill(child.pid, 'SIGKILL'); await exited; } }
  }
});

test('directory backup cannot cross grant revocation or a same-ID Session rebind', async () => {
  for (const transition of ['revoke', 'rebind'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), target = path.join(outside, 'value');
    fs.writeFileSync(target, 'BEFORE_TRANSITION');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const record = session.recordDirectoryBackup.bind(session);
    let replacement: Session | undefined;
    session.recordDirectoryBackup = input => {
      if (transition === 'revoke') session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      else { void session.close(); replacement = Session.open(root, { id: session.id }); }
      record(input);
    };
    try {
      const run = new Agent(session, new ScriptedProvider([response([call(`transition-${transition}`, 'write_file', { path: target, content: 'NEW', overwrite: true })], 'tool_use'), done()]), tools).run('attempt write');
      if (transition === 'rebind') await assert.rejects(run); else await run;
      assert.equal((replacement ?? session).directoryBackups[0]?.kind, 'unknown');
      assert.equal(fs.readFileSync(target, 'utf8'), 'BEFORE_TRANSITION');
    } finally { await replacement?.close(); await session.close(); }
    const reader = `import { Session } from './src/session.ts'; const s=Session.open(process.argv[1],{id:process.argv[2]}); process.stdout.write(JSON.stringify(s.directoryBackups.map(x=>x.kind))); await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })), ['unknown']);
  }
  for (const transition of ['revoke', 'rebind'] as const) {
    const root = workspace(), outside = workspace(), tools = createTools(), target = path.join(outside, 'value');
    fs.writeFileSync(target, 'COPY_IN_PROGRESS');
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    let entered!: () => void, release!: () => void;
    const held = new Promise<void>(resolve => { entered = resolve; });
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const open = fs.promises.open;
    let replacement: Session | undefined;
    Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: async (...args: unknown[]) => {
      const handle = await Reflect.apply(open, fs.promises, args);
      if (String(args[0]).includes('.backup-unknown-')) {
        const write = handle.write;
        Object.defineProperty(handle, 'write', { configurable: true, value: async (...parts: unknown[]) => {
          entered(); await barrier; return Reflect.apply(write, handle, parts);
        } });
      }
      return handle;
    } });
    try {
      const run = new Agent(session, new ScriptedProvider([response([call(`copy-${transition}`, 'write_file', { path: target, content: 'NEW', overwrite: true })], 'tool_use'), done()]), tools).run('attempt write');
      void run.catch(() => {});
      await held;
      if (transition === 'revoke') session.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
      else { void session.close(); replacement = Session.open(root, { id: session.id }); }
      release();
      if (transition === 'rebind') await assert.rejects(run); else await run;
      assert.equal((replacement ?? session).directoryBackups[0]?.kind, 'unknown');
      assert.equal(fs.readFileSync(target, 'utf8'), 'COPY_IN_PROGRESS');
    } finally {
      release(); Object.defineProperty(fs.promises, 'open', { configurable: true, writable: true, value: open });
      await replacement?.close(); await session.close();
    }
    const reader = `import { Session } from './src/session.ts'; const s=Session.open(process.argv[1],{id:process.argv[2]}); process.stdout.write(JSON.stringify(s.directoryBackups.map(x=>x.kind))); await s.close();`;
    for (let i = 0; i < 2; i++) assert.deepEqual(JSON.parse(execFileSync(process.execPath,
      ['--import', 'tsx', '--input-type=module', '-e', reader, root, session.id], { encoding: 'utf8' })), ['unknown']);
  }
  const root = workspace(), outside = workspace(), tools = createTools();
  fs.mkdirSync(path.join(outside, 'directory'));
  const owner = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const other = Session.open(root, { config: config(root, tools) });
  try {
    owner.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const writeTool = tools.find(tool => tool.schema.name === 'write_file')!;
    await assert.rejects(writeTool.execute({ path: path.join(outside, 'missing'), content: 'NEW' }, {
      session: other, toolUseId: 'wrong-owner', workspace: root, signal: new AbortController().signal,
      allowShell: false, maxOutputBytes: 24000, workingDirectories: readOnly => owner.workingDirectories(readOnly),
    }), /not implemented/);
    assert.deepEqual(other.directoryBackups, []);
    await new Agent(owner, new ScriptedProvider([response([
      call('missing-backup', 'write_file', { path: path.join(outside, 'missing'), content: 'NEW' }),
      call('directory-backup', 'write_file', { path: path.join(outside, 'directory'), content: 'NEW', overwrite: true }),
    ], 'tool_use'), done()]), tools).run('attempt missing and directory writes');
    const missing = owner.events.find(event => event.kind === 'directory_missing_backup' && event.lexicalPath === path.join(outside, 'missing'));
    const user = owner.events.findLast(event => event.kind === 'message' && event.message.role === 'user' && event.messageId);
    assert.ok(missing && missing.kind === 'directory_missing_backup' && user && user.kind === 'message' && user.messageId);
    const selected = owner.selectDirectoryRewindSnapshot(user.messageId);
    assert.equal(selected.kind, 'available');
    if (selected.kind !== 'available') throw new Error('missing directory history unavailable');
    assert.equal(selected.entries.find(entry => entry.path.lexicalPath === missing.lexicalPath)?.reference.kind, 'missing');
    assert.deepEqual(owner.directoryBackups.map(backup => backup.kind), ['unknown']);
    for (const backup of owner.directoryBackups) assert.equal(owner.readDirectoryBackup(backup.id), undefined);
    assert.equal(fs.readFileSync(path.join(outside, 'missing'), 'utf8'), 'NEW');
    assert.equal(fs.statSync(path.join(outside, 'directory')).isDirectory(), true);
  } finally { await other.close(); await owner.close(); }
});

test('directory grant Write refuses before history and cache; workspace Write succeeds', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const session = Session.open(root, { config: config(root, tools) });
  const cache = new SourceReadCache(10);
  const marker = { content: 'prior', timestamp: 1 };
  cache.set('prior', marker);
  const history: string[] = [], effects: unknown[] = [];
  const tool = tools.find(value => value.schema.name === 'write_file')!;
  const context = { workspace: root, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000,
    workingDirectories: (readOnly: boolean) => session.workingDirectories(readOnly), readFileCache: cache,
    fileHistory: (file?: string) => { if (file) history.push(file); }, hostResult: (effect: unknown) => effects.push(effect) };
  try {
    session.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await assert.rejects(tool.execute({ path: path.join(outside, 'value'), content: 'EXTERNAL' }, context), /not implemented/);
    assert.equal(fs.existsSync(path.join(outside, 'value')), false);
    assert.deepEqual(history, []); assert.deepEqual(effects, []); assert.equal(cache.get('prior').content, marker.content);
    await tool.execute({ path: 'workspace-value', content: 'WORKSPACE' }, context);
    assert.equal(fs.readFileSync(path.join(root, 'workspace-value'), 'utf8'), 'WORKSPACE');
    assert.equal(history.length, 1); assert.equal(effects.length, 1);
  } finally { await session.close(); }
});

test('fork skill does not read a replacement directory through an earlier approval', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  const directory = path.join(outside, 'approved');
  fs.mkdirSync(directory);
  write(directory, 'value', 'ORIGINAL_DIRECTORY_CONTENT');
  const skill = { name: 'directory-barrier', path: path.join(root, 'SKILL.md'), description: 'fixture',
    body: 'read fixture', context: 'fork' as const, userInvocable: true, disableModelInvocation: false };
  let childResult = '';
  const provider = new ScriptedProvider([
    response([call('directory-read', 'read_file', { path: path.join(directory, 'value') })], 'tool_use'),
    request => { childResult = JSON.stringify(request.messages.at(-1)?.content); return done(); },
  ]);
  const controller = new AbortController();
  const settings = config(root, tools, { skills: [skill], permissions: { mode: 'ask', allow: [], deny: [] } });
  const runtime = await createRuntime(settings, provider, controller.signal);
  settings.tools = pinToolSchemas(runtime.tools);
  const parent = Session.open(root, { config: settings });
  const registry = new AgentRegistry({ source: () => parent.config, provider, tools });
  let prompts = 0;
  try {
    await runtime.bindSession!(parent);
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [directory], destination: 'session' },
      { type: 'addRules', behavior: 'ask', destination: 'session', rules: [{ toolName: 'read_file' }] }]);
    const before = fs.statSync(directory, { bigint: true }).ino;
    const authorization = issueHumanSkillAuthorization(parent, skill.name, '', controller.signal, runtime.sessionLease!(parent));
    await executeSkill(skill, '', { config: parent.config, provider, tools, registry, signal: controller.signal,
      source: 'user', session: () => parent, humanAuthorization: authorization,
      requestPermission: async () => {
        prompts++;
        fs.renameSync(directory, `${directory}-original`);
        fs.mkdirSync(directory);
        write(directory, 'value', 'REPLACEMENT_DIRECTORY_CONTENT');
        assert.notEqual(fs.statSync(directory, { bigint: true }).ino, before);
        return { decision: 'allow' };
      } });
    assert.equal(prompts, 1);
    assert.doesNotMatch(childResult, /REPLACEMENT_DIRECTORY_CONTENT/);
    assert.equal(fs.readFileSync(path.join(directory, 'value'), 'utf8'), 'REPLACEMENT_DIRECTORY_CONTENT');
  } finally {
    await registry.close(); await runtime.close(); await parent.close();
  }
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
      const skill = { name: 'fixture', path: path.join(skillRoot, 'SKILL.md'), description: 'fixture',
        body: 'Skill result\n```!\nprintf owned > marker\n```', shell: '/bin/sh', userInvocable: true, disableModelInvocation: false };
      const input = new PassThrough(), controller = new AbortController();
      let output = '', exitSent = false;
      const exit = () => { if (!exitSent) { exitSent = true; input.write('/exit\n'); } };
      const sink = new Writable({ write(chunk, _encoding, done) {
        output += String(chunk);
        if (behavior === 'deny' && /denied/i.test(output)) setImmediate(exit);
        done();
      } });
      const provider = new ScriptedProvider([() => { setImmediate(exit); return done(); }]);
      const skillConfig = config(skillRoot, [], { allowShell: true, skills: [skill],
        features: { tasks: true, subagents: true, skillInlineCommands: true }, permissions: { mode, allow: [], deny: [] } });
      const runtime = await createRuntime(skillConfig, provider, controller.signal);
      skillConfig.tools = pinToolSchemas(runtime.tools);
      const skillSession = Session.open(skillRoot, { config: skillConfig });
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        await runtime.bindSession!(skillSession);
        skillSession.adoptPermissionUpdates([{ type: 'addRules', behavior, destination: 'session', rules: [{ toolName: 'run_command' }] }]);
        input.write('/fixture\n');
        await interactiveLoop(skillSession, provider, runtime, { input, output: sink, status: sink, signal: controller.signal });
        assert.equal(controller.signal.aborted, false, output);
        if (behavior === 'deny') assert.match(output, /denied/i);
        assert.equal(provider.requests.length, behavior === 'allow' ? 1 : 0, output);
        assert.equal(fs.existsSync(path.join(skillRoot, 'marker')), behavior === 'allow');
      } finally {
        clearTimeout(timeout); await runtime.close(); await skillSession.drainPermissionWrites();
        await skillSession.close(); input.destroy(); sink.destroy();
      }
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
      const skill = { name: 'fixture', path: path.join(skillRoot, 'SKILL.md'),
        description: 'fixture', body: 'write twice', context: 'fork' as const, background,
        userInvocable: true, disableModelInvocation: false };
      const provider = new ScriptedProvider([
        response([call('first', 'write_file', { path: 'first', content: 'first' })], 'tool_use'),
        response([call('second', 'write_file', { path: 'second', content: 'second' })], 'tool_use'), done(),
      ]);
      const controller = new AbortController();
      const skillConfig = config(skillRoot, skillTools, { skills: [skill], permissions: { mode: 'ask', allow: [], deny: [] } });
      const runtime = await createRuntime(skillConfig, provider, controller.signal);
      skillConfig.tools = pinToolSchemas(runtime.tools);
      const parent = Session.open(skillRoot, { config: skillConfig });
      const registry = new AgentRegistry({ source: () => parent.config, provider, tools: skillTools });
      let approvals = 0;
      try {
        await runtime.bindSession!(parent);
        const authorization = issueHumanSkillAuthorization(parent, skill.name, '', controller.signal, runtime.sessionLease!(parent));
        const result = JSON.parse(await executeSkill(skill, '', { config: parent.config, provider, tools: skillTools, registry,
          signal: controller.signal, source: 'user', session: () => parent, humanAuthorization: authorization,
          requestPermission: async () => {
            approvals++;
            parent.permissionOwner.adoptUpdates?.([{ type: 'addRules', behavior: 'deny', destination: 'session', rules: [{ toolName: 'write_file' }] }]);
            return { decision: 'allow' };
          } }));
        if (background) await registry.get(result.id, { waitMs: 5000 });
        assert.equal(fs.existsSync(path.join(skillRoot, 'first')), false);
        assert.equal(fs.existsSync(path.join(skillRoot, 'second')), false);
        assert.equal(approvals, 1);
        assert.deepEqual(parent.permissionOwner.state().deny, ['write_file']);
      } finally { await registry.close(); await runtime.close(); await parent.close(); }
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
        const movedLanding = `${landing}-moved`;
        fs.renameSync(landing, movedLanding); fs.symlinkSync(retarget, landing);
        assert.equal((await effect(ordinary, 'read_file', { path: path.join(directoryAlias, 'value') }))?.is_error, true);
        fs.unlinkSync(landing); fs.renameSync(movedLanding, landing);
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
    assert.equal(resultBatches(session)[0]?.[0]?.is_error, true, JSON.stringify(resultBatches(session)));
    assert.match(JSON.stringify(resultBatches(session)), /Directory publication snapshot unavailable/);
    assert.equal(fs.existsSync(path.join(external, 'current.txt')), false);
    await assert.rejects(tool('edit_file').execute({ path: path.join(external, 'existing.txt'), old_string: 'original', new_string: 'edited' }, context), /directory grant unavailable|edits through additional directory grants are not implemented/);
    assert.equal(fs.readFileSync(path.join(external, 'existing.txt'), 'utf8'), 'outside original');
    assert.match(await tool('read_file').execute({ path: path.join(external, 'existing.txt') }, context), /outside original/);
    assert.match(await tool('list_files').execute({ path: external }, context), /existing.txt/);
    assert.match(await tool('search').execute({ path: external, pattern: 'outside original' }, context), /outside original/);
    await assert.rejects(tool('read_file').execute({ path: path.join(external, 'escape', 'secret.txt') }, context), /escapes/);
    await assert.rejects(tool('read_file').execute({ path: path.join(external, '.agent', 'record') }, context), /reserved/);
    await assert.rejects(tool('read_file').execute({ path: path.join(external, 'existing.txt') }, { ...context,
      workingDirectories: readOnly => isolated.workingDirectories(readOnly) }), /absolute|escapes/);
    write(external, 'book.ipynb', JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {}, cells: [] }));
    write(external, 'pixel.png', '');
    fs.writeFileSync(path.join(external, 'pixel.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==', 'base64'));
    assert.match(await tool('read_media').execute({ path: path.join(external, 'pixel.png') }, context), /image|png/i);
    assert.match(await tool('notebook_read').execute({ path: path.join(external, 'book.ipynb') },
      { ...context, session, toolUseId: 'external-notebook-read' }), /cells|notebook/i);
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
      await assert.rejects(tool('edit_file').execute({ path: path.join(external, 'existing.txt'), old_string: 'original', new_string: 'project edit' }, {
        ...context, workingDirectories: readOnly => seeded.workingDirectories(readOnly) }), /directory grant unavailable|edits through additional directory grants are not implemented/);
      await assert.rejects(tool('read_file').execute({ path: path.join(external, 'existing.txt') }, {
        ...context, workingDirectories: readOnly => seeded.workingDirectories(readOnly) }), /absolute|escapes/);
      assert.equal(fs.readFileSync(path.join(external, 'existing.txt'), 'utf8'), 'outside original');
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

test('classifier sees preceding same-turn calls without uncommitted results', async () => {
  const root = workspace();
  const tools = createTools();
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'auto', allow: [], deny: [] } }) });
  let release = () => {};
  let entered = () => {};
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { entered = resolve; });
  const read = tools.find(tool => tool.schema.name === 'read_file');
  assert.ok(read);
  const wrapped = { ...read, async execute(input: unknown, context: Parameters<ToolDefinition['execute']>[1]) {
    entered();
    await barrier;
    return read.execute(input, context);
  } };
  let mainCalls = 0;
  let transcript = '';
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    if (typeof request.system === 'string' && request.system.startsWith('You are a security monitor')) {
      transcript = String(request.messages[0]?.content);
      return response([{ type: 'text', text: '<block>no</block>' }]);
    }
    return ++mainCalls === 1 ? response([call('prior-read', 'read_file', { path: 'missing.txt' }),
      call('next-write', 'write_file', { path: 'output.txt', content: 'done' })], 'tool_use') : done();
  } };
  try {
    const running = new Agent(session, provider, tools.map(tool => tool === read ? wrapped : tool)).run('perform both');
    await started;
    assert.equal(transcript, '');
    release();
    await running;
    assert.match(transcript, /"read_file"/);
    assert.match(transcript, /"write_file"/);
    assert.doesNotMatch(transcript, /"outcome":"error"/);
    assert.equal(resultBatches(session).at(-1)?.[0]?.is_error, true);
    assert.equal(fs.readFileSync(path.join(root, 'output.txt'), 'utf8'), 'done');
  } finally { release(); await session.close(); }
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

test('ordinary permission approval rechecks live rules', async () => {
  for (const scenario of ['allow', 'new-deny', 'new-ask', 'new-ask-reject', 'cancel'] as const) {
    const root = workspace();
    const tools = createTools();
    const session = Session.open(root, { config: config(root, tools, { allowShell: true,
      permissions: { mode: 'ask', allow: [], deny: [] } }) });
    const provider = new ScriptedProvider([response([call('one', 'run_command', { command: 'printf APPROVED > marker.txt' })], 'tool_use'), done()]);
    const turn = new AbortController();
    let prompts = 0;
    try {
      await new Agent(session, provider, tools, { permission: async () => {
        prompts++;
        if (scenario === 'new-deny' || scenario.startsWith('new-ask') && prompts === 1) {
          session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'printf APPROVED:*' }],
            behavior: scenario === 'new-deny' ? 'deny' : 'ask', destination: 'session' }]);
        }
        if (scenario === 'cancel') turn.abort();
        return scenario !== 'new-ask-reject' || prompts !== 2;
      } }).run('check live rules', turn.signal);
      const allowed = scenario === 'allow' || scenario === 'new-ask';
      assert.equal(prompts, scenario.startsWith('new-ask') ? 2 : 1, scenario);
      assert.equal(resultBatches(session)[0]?.[0]?.is_error === true, !allowed, scenario);
      assert.equal(fs.existsSync(path.join(root, 'marker.txt')), allowed, scenario);
      if (allowed) assert.equal(fs.readFileSync(path.join(root, 'marker.txt'), 'utf8'), 'APPROVED');
      assertBatchAdjacency(session);
    } finally { session.close(); }
  }
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

test('direct read approval check rejects link retargeting in the status callback', async () => {
  const root = workspace(), tools = createTools();
  write(root, 'public.txt', 'PUBLIC');
  write(root, 'protected.txt', 'FIXTURE_TARGET');
  fs.symlinkSync('public.txt', path.join(root, 'alias.txt'));
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'default', allow: [], deny: ['Read(protected.txt)'], ask: ['read_file'] },
  }) });
  const provider = new ScriptedProvider([response([call('read', 'read_file', { path: 'alias.txt' })], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(session, provider, tools, {
      permission: async () => true,
      status: message => {
        if (message === 'tool: read_file') {
          fs.unlinkSync(path.join(root, 'alias.txt'));
          fs.symlinkSync('protected.txt', path.join(root, 'alias.txt'));
          retargeted = true;
        }
      },
    }).run('read fixture');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(retargeted, true);
    assert.equal(result?.is_error, true);
    assert.match(String(result?.content), /read approval changed/);
    assert.doesNotMatch(String(result?.content), /FIXTURE_TARGET/);
  } finally { session.close(); }
});

test('read_media approval observation rejects status-callback retargeting', async () => {
  const root = workspace(), tools = createMediaTools();
  const media = tools.find(tool => tool.schema.name === 'read_media')!;
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(path.join(root, 'public.png'), image);
  fs.writeFileSync(path.join(root, 'protected.png'), Buffer.concat([image, Buffer.from('PROTECTED_FIXTURE')]));
  fs.symlinkSync('public.png', path.join(root, 'alias.png'));
  const session = Session.open(root, { config: config(root, [media], { permissions: { mode: 'ask', allow: [], deny: [] } }) });
  const provider = new ScriptedProvider([response([call('media', 'read_media', { path: 'alias.png' })], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(session, provider, [media], {
      permission: async () => true,
      status: message => {
        if (message === 'tool: read_media') {
          fs.unlinkSync(path.join(root, 'alias.png'));
          fs.symlinkSync('protected.png', path.join(root, 'alias.png'));
          retargeted = true;
        }
      },
    }).run('read media fixture');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(retargeted, true);
    assert.equal(result?.is_error, true);
    assert.match(String(result?.content), /read_media: read approval changed/);
  } finally { session.close(); }
});

test('write through a terminal symlink is denied by the source leaf check', async () => {
  const root = workspace(), tools = createTools();
  fs.writeFileSync(path.join(root, 'target.txt'), 'ORIGINAL');
  fs.symlinkSync('target.txt', path.join(root, 'alias.txt'));
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const provider = new ScriptedProvider([response([call('leaf-write', 'write_file',
    { path: 'alias.txt', content: 'CHANGED', overwrite: true })], 'tool_use'), done()]);
  try {
    await new Agent(session, provider, tools).run('write through the leaf');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(result?.is_error, true, JSON.stringify(result));
    assert.match(String(result?.content), /symbolic link/i);
    assert.equal(fs.readFileSync(path.join(root, 'target.txt'), 'utf8'), 'ORIGINAL');
    assert.equal(fs.lstatSync(path.join(root, 'alias.txt')).isSymbolicLink(), true);
  } finally { session.close(); }
});

test('edit and notebook writes through terminal symlinks are denied', async () => {
  for (const name of ['edit_file', 'notebook_edit'] as const) {
    const root = workspace(), tools = [...createTools(), ...createNotebookTools()];
    const target = name === 'edit_file' ? 'target.txt' : 'target.ipynb';
    const alias = name === 'edit_file' ? 'alias.txt' : 'alias.ipynb';
    const original = name === 'edit_file' ? 'ORIGINAL' : JSON.stringify({ nbformat: 4, nbformat_minor: 5, metadata: {},
      cells: [{ id: 'fixture', cell_type: 'code', metadata: {}, execution_count: null, outputs: [], source: 'ORIGINAL' }] });
    fs.writeFileSync(path.join(root, target), original);
    fs.symlinkSync(target, path.join(root, alias));
    const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
    const input = name === 'edit_file'
      ? { path: alias, old_string: 'ORIGINAL', new_string: 'CHANGED' }
      : { path: alias, cell_id: 'fixture', new_source: 'CHANGED' };
    try {
      await new Agent(session, new ScriptedProvider([response([call(`leaf-${name}`, name, input)], 'tool_use'), done()]), tools).run('write through the leaf');
      const result = resultBatches(session)[0]?.[0];
      assert.equal(result?.is_error, true, `${name}: ${JSON.stringify(result)}`);
      assert.match(String(result?.content), /symbolic link/i);
      assert.equal(fs.readFileSync(path.join(root, target), 'utf8'), original);
      assert.equal(fs.lstatSync(path.join(root, alias)).isSymbolicLink(), true);
    } finally { session.close(); }
  }
});

test('an edit ancestor retarget after approval is denied', async () => {
  const root = workspace(), tools = [...createTools(), ...createNotebookTools()];
  fs.mkdirSync(path.join(root, 'real'));
  fs.mkdirSync(path.join(root, 'protected'));
  fs.writeFileSync(path.join(root, 'real', 'file.txt'), 'ORIGINAL');
  fs.writeFileSync(path.join(root, 'protected', 'file.txt'), 'PROTECTED_FIXTURE');
  fs.symlinkSync('real', path.join(root, 'aliasdir'));
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'default', allow: [], deny: [], ask: ['edit_file'] },
  }) });
  const provider = new ScriptedProvider([response([call('ancestor-retarget-edit', 'edit_file',
    { path: 'aliasdir/file.txt', old_string: 'ORIGINAL', new_string: 'CHANGED' })], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(session, provider, tools, {
      permission: async () => true,
      status: message => {
        if (!retargeted && message === 'tool: edit_file') {
          retargeted = true;
          fs.unlinkSync(path.join(root, 'aliasdir'));
          fs.symlinkSync('protected', path.join(root, 'aliasdir'));
        }
      },
    }).run('edit through the ancestor link');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(retargeted, true);
    assert.equal(result?.is_error, true, JSON.stringify(result));
    assert.match(String(result?.content), /write approval changed/);
    assert.equal(fs.readFileSync(path.join(root, 'protected', 'file.txt'), 'utf8'), 'PROTECTED_FIXTURE');
    assert.equal(fs.readFileSync(path.join(root, 'real', 'file.txt'), 'utf8'), 'ORIGINAL');
  } finally { session.close(); }
});

test('per-call write approvals isolate an ancestor retarget from a sibling', async () => {
  const root = workspace(), tools = createTools();
  fs.mkdirSync(path.join(root, 'real'));
  fs.mkdirSync(path.join(root, 'protected'));
  fs.writeFileSync(path.join(root, 'real', 'file.txt'), 'ORIGINAL');
  fs.writeFileSync(path.join(root, 'protected', 'file.txt'), 'PROTECTED_FIXTURE');
  fs.symlinkSync('real', path.join(root, 'aliasdir'));
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'default', allow: [], deny: [], ask: ['write_file'] },
  }) });
  const provider = new ScriptedProvider([response([
    call('write-a', 'write_file', { path: 'aliasdir/file.txt', content: 'CHANGED', overwrite: true }),
    call('write-b', 'write_file', { path: 'sibling.txt', content: 'SIBLING_OK' }),
  ], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(session, provider, tools, {
      permission: async () => true,
      status: message => {
        if (!retargeted && message === 'tool: write_file') {
          retargeted = true;
          fs.unlinkSync(path.join(root, 'aliasdir'));
          fs.symlinkSync('protected', path.join(root, 'aliasdir'));
        }
      },
    }).run('write two paths');
    const results = resultBatches(session)[0] ?? [];
    const a = results.find(result => result.tool_use_id === 'write-a');
    const b = results.find(result => result.tool_use_id === 'write-b');
    assert.equal(retargeted, true);
    assert.equal(a?.is_error, true, JSON.stringify(a));
    assert.match(String(a?.content), /write approval changed/);
    assert.equal(b?.is_error, undefined, JSON.stringify(b));
    assert.equal(fs.readFileSync(path.join(root, 'protected', 'file.txt'), 'utf8'), 'PROTECTED_FIXTURE');
    assert.equal(fs.readFileSync(path.join(root, 'real', 'file.txt'), 'utf8'), 'ORIGINAL');
    assert.equal(fs.readFileSync(path.join(root, 'sibling.txt'), 'utf8'), 'SIBLING_OK');
  } finally { session.close(); }
});

test('a write ancestor retarget after approval is denied', async () => {
  const root = workspace(), tools = createTools();
  fs.mkdirSync(path.join(root, 'real'));
  fs.mkdirSync(path.join(root, 'protected'));
  fs.writeFileSync(path.join(root, 'real', 'file.txt'), 'ORIGINAL');
  fs.writeFileSync(path.join(root, 'protected', 'file.txt'), 'PROTECTED_FIXTURE');
  fs.symlinkSync('real', path.join(root, 'aliasdir'));
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'default', allow: [], deny: [], ask: ['write_file'] },
  }) });
  const provider = new ScriptedProvider([response([call('ancestor-retarget-write', 'write_file',
    { path: 'aliasdir/file.txt', content: 'CHANGED', overwrite: true })], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(session, provider, tools, {
      permission: async () => true,
      status: message => {
        if (!retargeted && message === 'tool: write_file') {
          retargeted = true;
          fs.unlinkSync(path.join(root, 'aliasdir'));
          fs.symlinkSync('protected', path.join(root, 'aliasdir'));
        }
      },
    }).run('write through the ancestor link');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(retargeted, true);
    assert.equal(result?.is_error, true, JSON.stringify(result));
    assert.match(String(result?.content), /approval changed|changed before/);
    assert.equal(fs.readFileSync(path.join(root, 'protected', 'file.txt'), 'utf8'), 'PROTECTED_FIXTURE');
    assert.equal(fs.readFileSync(path.join(root, 'real', 'file.txt'), 'utf8'), 'ORIGINAL');
  } finally { session.close(); }
});

test('a new file through an ancestor directory symlink is allowed inside the workspace', async () => {
  const root = workspace(), tools = createTools();
  fs.mkdirSync(path.join(root, 'real'));
  fs.symlinkSync('real', path.join(root, 'aliasdir'));
  const session = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const provider = new ScriptedProvider([response([call('ancestor-write', 'write_file',
    { path: 'aliasdir/file.txt', content: 'ANCESTOR_OK' })], 'tool_use'), done()]);
  try {
    await new Agent(session, provider, tools).run('write through an ancestor link');
    const result = resultBatches(session)[0]?.[0];
    assert.equal(result?.is_error, undefined, JSON.stringify(result));
    assert.equal(fs.readFileSync(path.join(root, 'real', 'file.txt'), 'utf8'), 'ANCESTOR_OK');
    assert.equal(fs.lstatSync(path.join(root, 'aliasdir')).isSymbolicLink(), true);
  } finally { session.close(); }
});

test('a fork inherits an external directory grant and revokes it independently', async () => {
  const root = workspace(), outside = workspace(), tools = createTools();
  fs.mkdirSync(outside, { recursive: true });
  const parent = Session.open(root, { config: config(root, tools, { permissions: { mode: 'bypass', allow: [], deny: [] } }) });
  const resultFor = (session: Session, id: string) => resultBatches(session).flat().find(block => block.tool_use_id === id);
  let fork: Session | undefined;
  try {
    parent.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    await new Agent(parent, new ScriptedProvider([response([call('parent-write', 'write_file',
      { path: path.join(outside, 'parent.txt'), content: 'parent' })], 'tool_use'), done()]), tools).run('write outside');
    assert.equal(resultFor(parent, 'parent-write')?.is_error, undefined);
    fork = forkSession(parent);
    const inherited = new ScriptedProvider([response([call('fork-write-inherited', 'write_file',
      { path: path.join(outside, 'fork-inherited.txt'), content: 'inherited' })], 'tool_use'), done()]);
    await new Agent(fork, inherited, tools).run('write with the inherited grant');
    assert.equal(resultFor(fork, 'fork-write-inherited')?.is_error, undefined, JSON.stringify(resultFor(fork, 'fork-write-inherited')));
    assert.equal(fs.readFileSync(path.join(outside, 'fork-inherited.txt'), 'utf8'), 'inherited');
    fork.adoptPermissionUpdates([{ type: 'removeDirectories', directories: [outside], destination: 'session' }]);
    const denied = new ScriptedProvider([response([call('fork-write-denied', 'write_file',
      { path: path.join(outside, 'fork-denied.txt'), content: 'denied' })], 'tool_use'), done()]);
    await new Agent(fork, denied, tools).run('write after revocation');
    assert.equal(resultFor(fork, 'fork-write-denied')?.is_error, true, JSON.stringify(resultFor(fork, 'fork-write-denied')));
    assert.equal(fs.existsSync(path.join(outside, 'fork-denied.txt')), false);
    fork.adoptPermissionUpdates([{ type: 'addDirectories', directories: [outside], destination: 'session' }]);
    const allowed = new ScriptedProvider([response([call('fork-write-allowed', 'write_file',
      { path: path.join(outside, 'fork-allowed.txt'), content: 'fork' })], 'tool_use'), done()]);
    await new Agent(fork, allowed, tools).run('write after regrant');
    assert.equal(resultFor(fork, 'fork-write-inherited')?.is_error, undefined, JSON.stringify(resultFor(fork, 'fork-write-inherited')));
    assert.equal(fs.readFileSync(path.join(outside, 'fork-allowed.txt'), 'utf8'), 'fork');
  } finally { fork?.close(); parent.close(); }
});

test('per-call read approvals isolate a retarget from a sibling', async () => {
  const root = workspace(), tools = createTools();
  write(root, 'public-a.txt', 'PUBLIC_A');
  write(root, 'public-b.txt', 'PUBLIC_B');
  write(root, 'protected-a.txt', 'PROTECTED_A');
  fs.symlinkSync('public-a.txt', path.join(root, 'alias-a.txt'));
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'default', allow: [], deny: [], ask: ['read_file'] },
  }) });
  const provider = new ScriptedProvider([response([
    call('call-a', 'read_file', { path: 'alias-a.txt' }),
    call('call-b', 'read_file', { path: 'public-b.txt' }),
  ], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(session, provider, tools, {
      permission: async () => true,
      status: message => {
        if (!retargeted && message === 'tool: read_file') {
          retargeted = true;
          fs.unlinkSync(path.join(root, 'alias-a.txt'));
          fs.symlinkSync('protected-a.txt', path.join(root, 'alias-a.txt'));
        }
      },
    }).run('read two paths');
    const results = resultBatches(session)[0] ?? [];
    const a = results.find(result => result.tool_use_id === 'call-a');
    const b = results.find(result => result.tool_use_id === 'call-b');
    assert.equal(retargeted, true);
    assert.equal(a?.is_error, true, JSON.stringify(a));
    assert.match(String(a?.content), /read approval changed/);
    assert.equal(b?.is_error, undefined, JSON.stringify(b));
    assert.match(String(b?.content), /PUBLIC_B/);
    assert.doesNotMatch(JSON.stringify(results), /PROTECTED_A/);
  } finally { session.close(); }
});

test('relocated write through a terminal symlink is denied', async () => {
  const parent = workspace(), child = workspace(), tools = createTools();
  fs.writeFileSync(path.join(child, 'target.txt'), 'ORIGINAL');
  fs.symlinkSync('target.txt', path.join(child, 'alias.txt'));
  const source = Session.open(parent, { config: config(parent, tools, {
    permissions: { mode: 'bypass', allow: [], deny: [] },
  }) });
  let relocated: Session | undefined;
  try {
    await new Agent(source, new ScriptedProvider([done()]), tools).run('hello');
    relocated = relocateSession(source, child, () => tools);
    const provider = new ScriptedProvider([response([call('relocated-leaf-write', 'write_file',
      { path: 'alias.txt', content: 'CHANGED', overwrite: true })], 'tool_use'), done()]);
    await new Agent(relocated, provider, tools).run('write through the relocated leaf');
    const result = resultBatches(relocated)[0]?.[0];
    assert.equal(result?.is_error, true, JSON.stringify(result));
    assert.match(String(result?.content), /symbolic link/i);
    assert.equal(fs.readFileSync(path.join(child, 'target.txt'), 'utf8'), 'ORIGINAL');
    assert.equal(fs.lstatSync(path.join(child, 'alias.txt')).isSymbolicLink(), true);
  } finally { await relocated?.close(); await source.close(); }
});

test('relocated read approval observation denies a status retarget', async () => {
  const parent = workspace(), child = workspace(), tools = createTools();
  write(child, 'public.txt', 'PUBLIC');
  write(child, 'protected.txt', 'PROTECTED');
  fs.symlinkSync('public.txt', path.join(child, 'alias.txt'));
  const source = Session.open(parent, { config: config(parent, tools, {
    permissions: { mode: 'default', allow: [], deny: [], ask: ['read_file'] },
  }) });
  const sourceProvider = new ScriptedProvider([done()]);
  let relocated: Session | undefined;
  try {
    await new Agent(source, sourceProvider, tools).run('hello');
    relocated = relocateSession(source, child, () => tools);
    const provider = new ScriptedProvider([response([call('relocated-read', 'read_file', { path: 'alias.txt' })], 'tool_use'), done()]);
    let retargeted = false;
    await new Agent(relocated, provider, tools, {
      permission: async () => true,
      status: message => {
        if (message === 'tool: read_file') {
          fs.unlinkSync(path.join(child, 'alias.txt'));
          fs.symlinkSync('protected.txt', path.join(child, 'alias.txt'));
          retargeted = true;
        }
      },
    }).run('read on the relocated session');
    const result = resultBatches(relocated)[0]?.[0];
    assert.equal(retargeted, true);
    assert.equal(result?.is_error, true);
    assert.match(String(result?.content), /read approval changed/);
    assert.doesNotMatch(String(result?.content), /PROTECTED/);
  } finally { await relocated?.close(); await source.close(); }
});

test('fork read approval observation denies a status retarget', async () => {
  const root = workspace(), tools = createTools();
  write(root, 'public.txt', 'PUBLIC');
  write(root, 'protected.txt', 'PROTECTED');
  fs.symlinkSync('public.txt', path.join(root, 'alias.txt'));
  const session = Session.open(root, { config: config(root, tools, {
    permissions: { mode: 'default', allow: [], deny: ['Read(protected.txt)'], ask: ['read_file'] },
  }) });
  session.append({ kind: 'message', message: { role: 'user', content: 'fork fixture' } });
  session.append({ kind: 'message', message: { role: 'assistant', content: 'done' } });
  session.append({ kind: 'turn_end', reason: 'end_turn' });
  const fork = forkSession(session);
  const provider = new ScriptedProvider([response([call('fork-read', 'read_file', { path: 'alias.txt' })], 'tool_use'), done()]);
  let retargeted = false;
  try {
    await new Agent(fork, provider, tools, {
      permission: async () => true,
      status: message => {
        if (message === 'tool: read_file') {
          fs.unlinkSync(path.join(root, 'alias.txt'));
          fs.symlinkSync('protected.txt', path.join(root, 'alias.txt'));
          retargeted = true;
        }
      },
    }).run('read on the fork');
    const result = resultBatches(fork)[0]?.[0];
    assert.equal(retargeted, true);
    assert.equal(result?.is_error, true);
    assert.match(String(result?.content), /read approval changed/);
    assert.doesNotMatch(String(result?.content), /PROTECTED/);
  } finally { fork.close(); session.close(); }
});

test('PreToolUse callback cannot change the authorized file through its event input', async () => {
  for (const scenario of ['stable', 'mutate', 'explicit-rewrite', 'direct-deny'] as const) {
    const root = workspace();
    const tools = createTools();
    const target = scenario === 'direct-deny' ? 'denied.txt' : 'approved.txt';
    const session = Session.open(root, { config: config(root, tools, {
      permissions: { mode: 'default', allow: [], deny: ['Write(denied.txt)'] },
      hooks: { PreToolUse: [{ type: 'callback', name: 'fixture' }] },
    }) });
    const provider = new ScriptedProvider([response([call('one', 'write_file', { path: target, content: 'DATA' })], 'tool_use'), done()]);
    let callbacks = 0;
    try {
      await new Agent(session, provider, tools, { hookOptions: { resolveCallbackHook: async (_definition, _event, payload) => {
        callbacks++;
        if (scenario === 'mutate' && typeof payload.tool_input === 'object' && payload.tool_input !== null) {
          Object.assign(payload.tool_input, { path: 'denied.txt' });
        }
        if (scenario === 'explicit-rewrite') return { hookSpecificOutput: {
          hookEventName: 'PreToolUse', updatedInput: { path: 'denied.txt', content: 'DATA' },
        } };
        return { ok: true };
      } } }).run('write fixture');
      assert.equal(callbacks, scenario === 'direct-deny' ? 0 : 1, scenario);
      assert.equal(fs.existsSync(path.join(root, 'denied.txt')), false, scenario);
      const permitted = scenario === 'stable' || scenario === 'mutate';
      assert.equal(fs.existsSync(path.join(root, 'approved.txt')), permitted, scenario);
      if (permitted) assert.equal(fs.readFileSync(path.join(root, 'approved.txt'), 'utf8'), 'DATA');
      assert.equal(resultBatches(session)[0]?.[0]?.is_error === true, !permitted, scenario);
    } finally { session.close(); }
  }
});


test('PermissionRequest callback cannot change the authorized tool input through its event input', async () => {
  for (const scenario of ['stable', 'mutate'] as const) {
    const root = workspace(), effect = spy('mutate');
    const session = Session.open(root, { config: config(root, [effect.tool], {
      permissions: { mode: 'ask', allow: [], deny: [] },
      hooks: { PermissionRequest: [{ type: 'callback', name: 'fixture' }] },
    }) });
    const provider = new ScriptedProvider([response([call('one', 'mutate', { path: 'original' })], 'tool_use'), done()]);
    let callbacks = 0, prompts = 0;
    try {
      await new Agent(session, provider, [effect.tool], {
        hookOptions: { resolveCallbackHook: async (_definition, _event, payload) => {
          callbacks++;
          if (scenario === 'mutate' && typeof payload.tool_input === 'object' && payload.tool_input !== null)
            Object.assign(payload.tool_input, { path: 'mutated' });
          return { ok: true };
        } },
        permission: async () => { prompts++; return true; },
      }).run('mutate fixture');
      assert.equal(callbacks, 1, scenario);
      assert.equal(prompts, 1, scenario);
      assert.deepEqual(effect.inputs, [{ path: 'original' }], scenario);
    } finally { session.close(); }
  }
});

test('PreToolUse approval retains the reviewed input and rechecks live denial', async () => {
  for (const scenario of ['unchanged', 'mutate', 'new-deny', 'new-ask', 'new-ask-reject', 'new-ask-cancel', 'cancel', 'mutation-handle'] as const) {
    const root = workspace();
    const tools = createTools();
    const command = 'printf APPROVED > marker.txt';
    const session = Session.open(root, { config: config(root, tools, { allowShell: true,
      permissions: { mode: 'default', allow: [], deny: ['Bash(printf BLOCKED:*)'] },
      hooks: { PreToolUse: [{ matcher: scenario === 'mutation-handle' ? 'write_file' : 'run_command', command: emit({ hookSpecificOutput: {
        hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: 'Confirm fixture command',
      } }) }] },
    }) });
    const original = scenario === 'mutation-handle' ? { path: 'original.txt', content: 'approved' } : { command };
    const provider = new ScriptedProvider([response([call('one', scenario === 'mutation-handle' ? 'write_file' : 'run_command', original)], 'tool_use'), done()]);
    const turn = new AbortController();
    let prompts = 0;
    try {
      await new Agent(session, provider, tools, { permissionPrompt: 'interactive', permission: async request => {
        prompts++;
        assert.deepEqual(request.input, original);
        if (scenario === 'mutate') Object.assign(request.input as object, { command: 'printf BLOCKED > marker.txt' });
        if (scenario === 'mutation-handle') Object.assign(request.input as object, { path: 'redirected.txt' });
        if (scenario === 'new-deny') session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'printf APPROVED:*' }], behavior: 'deny', destination: 'session' }]);
        if (scenario.startsWith('new-ask') && prompts === 1) session.adoptPermissionUpdates([{ type: 'addRules', rules: [{ toolName: 'Bash', ruleContent: 'printf APPROVED:*' }], behavior: 'ask', destination: 'session' }]);
        if (scenario === 'cancel' || scenario === 'new-ask-cancel' && prompts === 2) turn.abort();
        return scenario !== 'new-ask-reject' || prompts !== 2;
      } }).run('check PreToolUse approval', turn.signal);
      assert.equal(prompts, scenario.startsWith('new-ask') ? 2 : 1, scenario);
      const allowed = scenario === 'unchanged' || scenario === 'mutate' || scenario === 'new-ask' || scenario === 'mutation-handle';
      assert.equal(resultBatches(session)[0]?.[0]?.is_error === true, !allowed, scenario);
      if (scenario === 'mutation-handle') {
        assert.equal(fs.readFileSync(path.join(root, 'original.txt'), 'utf8'), 'approved');
        assert.equal(fs.existsSync(path.join(root, 'redirected.txt')), false);
      } else {
        assert.equal(fs.existsSync(path.join(root, 'marker.txt')), allowed, scenario);
        if (allowed) assert.equal(fs.readFileSync(path.join(root, 'marker.txt'), 'utf8'), 'APPROVED');
      }
      assertBatchAdjacency(session);
    } finally { session.close(); }
  }
});

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

test("tool result journal and display failures preserve the serial boundary", async () => {
  for (const failure of ["journal", "display"] as const) {
    const root = workspace();
    const effect = spy("mutate");
    const marker = path.join(root, "post-count");
    const cfg = config(root, [effect.tool], { hooks: { PostToolUse: [{ command: `printf x >> ${shellQuote(marker)}` }] } });
    const provider = new ScriptedProvider([response([call("first", "mutate", {}), call("second", "mutate", {})], "tool_use"), done()]);
    const session = Session.open(root, { config: cfg });
    const append = session.append.bind(session);
    session.append = (event, authorization, backupToken) => {
      if (failure === "journal" && event.kind === "tool_effect") throw new Error("journal fixture failure");
      return append(event, authorization, backupToken);
    };
    try {
      await assert.rejects(new Agent(session, provider, [effect.tool], {
        toolResult: () => { if (failure === "display") throw new Error("display fixture failure"); },
      }).run("task"), new RegExp(`${failure} fixture failure`));
      assert.equal(effect.inputs.length, 1);
      assert.equal(session.events.filter(event => event.kind === "tool_result").length, failure === "journal" ? 0 : 1);
      assert.equal(fs.existsSync(marker) ? fs.readFileSync(marker, "utf8") : "", failure === "display" ? "x" : "");
    } finally { session.close(); }
  }
});

test("post hook completes before final tool result is journaled and displayed", async () => {
  const root = workspace(), effect = spy("mutate");
  const cfg = config(root, [effect.tool], { hooks: { PostToolUse: [{ command: emit({ hookSpecificOutput: {
    hookEventName: "PostToolUse", updatedToolOutput: "rewritten", additionalContext: "hook context fixture",
  } }) }] } });
  const provider = new ScriptedProvider([response([call("one", "mutate", {})], "tool_use"), done()]);
  const displayed: string[] = [];
  let session = Session.open(root, { config: cfg });
  const id = session.id;
  try {
    await new Agent(session, provider, [effect.tool], { toolResult: event => displayed.push(event.content) }).run("task");
    const hook = session.events.findIndex(event => event.kind === "hook_result" && event.event === "PostToolUse");
    const result = session.events.findIndex(event => event.kind === "tool_result" && event.result.tool_use_id === "one");
    assert.ok(hook >= 0 && result > hook, `post hook index ${hook}, result index ${result}`);
    assert.deepEqual(displayed, ["rewritten"]);
    assert.equal(resultBatches(session)[0]![0]!.content, "rewritten");
    assert.match(JSON.stringify(provider.requests[1]!.messages), /hook context fixture/);
    session.close(); session = Session.open(root, { id });
    assert.equal(resultBatches(session)[0]![0]!.content, "rewritten");
  } finally { session.close(); }
});

test("cold recovery fences an effect interrupted before post-hook result commit", async () => {
  const root = workspace(), effect = spy("mutate");
  const cfg = config(root, [effect.tool], { hooks: { PostToolUse: [{ command: emit({ hookSpecificOutput: {
    hookEventName: "PostToolUse", updatedToolOutput: "rewritten",
  } }) }] } });
  let session = Session.open(root, { config: cfg });
  const id = session.id, file = session.file;
  try {
    await new Agent(session, new ScriptedProvider([response([call("one", "mutate", {})], "tool_use"), done()]), [effect.tool]).run("task");
    const at = session.events.findIndex(event => event.kind === "tool_effect");
    assert.ok(at > 0);
    const prefix = session.events.slice(0, at + 1);
    session.close();
    fs.writeFileSync(file, prefix.map(event => JSON.stringify(event)).join("\n") + "\n");
    session = Session.open(root, { id });
    const resumed = new ScriptedProvider([done()]);
    await new Agent(session, resumed, [effect.tool]).run();
    assert.equal(effect.inputs.length, 1);
    assert.match(JSON.stringify(resumed.requests[0]!.messages), /post-hook result was interrupted before commit/);
    assert.doesNotMatch(JSON.stringify(resumed.requests[0]!.messages), /original tool output|rewritten/);
    assert.equal(resultBatches(session)[0]![0]!.is_error, true);
  } finally { session.close(); }
});

test("post hook journal fsync failure fences the turn and cold recovery", async () => {
  const root = workspace(), effect = spy("mutate");
  const cfg = config(root, [effect.tool], { hooks: { PostToolUse: [{ command: emit({}) }] } });
  let session = Session.open(root, { config: cfg });
  const id = session.id, append = session.append.bind(session);
  session.append = (event, authorization, backupToken) => {
    if (event.kind !== "hook_start" || event.event !== "PostToolUse") return append(event, authorization, backupToken);
    const original = fs.fsyncSync;
    fs.fsyncSync = () => { throw new Error("hook fsync fixture failure"); };
    try { return append(event, authorization, backupToken); } finally { fs.fsyncSync = original; }
  };
  try {
    await assert.rejects(new Agent(session, new ScriptedProvider([response([call("one", "mutate", {})], "tool_use"), done()]), [effect.tool]).run("task"), /journal write failed/);
    assert.equal(effect.inputs.length, 1);
    session.close(); session = Session.open(root, { id });
    const resumed = new ScriptedProvider([done()]);
    await new Agent(session, resumed, [effect.tool]).run();
    assert.equal(effect.inputs.length, 1);
    assert.match(JSON.stringify(resumed.requests[0]!.messages), /post-hook result was interrupted before commit/);
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
  write(root, "src/a.ts", "FIRST_READ_CONTENT");
  write(root, "other.txt", "SECOND_READ_CONTENT");
  const actual = createTools().find(tool => tool.schema.name === "read_file")!;
  const completed: string[] = [];
  let releaseFirst!: () => void;
  const secondDone = new Promise<void>(resolve => { releaseFirst = resolve; });
  const read: ToolDefinition = { ...actual, execute: async (input, context) => {
    assert.ok(input && typeof input === "object" && "path" in input && typeof input.path === "string");
    const result = await actual.execute(input, context);
    if (input.path === "src/a.ts") await secondDone;
    completed.push(String(input.path));
    if (input.path === "other.txt") releaseFirst();
    return result;
  } };
  const cfg = config(root, [read], { conditionalRules: [
    { path: path.join(root, "source-rule.md"), content: "SOURCE_RULE", patterns: ["src/**/*.ts"] },
    { path: path.join(root, "test-rule.md"), content: "TEST_RULE", patterns: ["test/**"] },
  ] });
  const provider = new ScriptedProvider([response([call("one", "read_file", { path: "src/a.ts" }), call("two", "read_file", { path: "other.txt" })], "tool_use"), done()]);
  const session = Session.open(root, { config: cfg });
  try {
    await new Agent(session, provider, [read]).run("read test/example.ts");
    assert.deepEqual(completed, ["other.txt", "src/a.ts"]);
    const messages = provider.requests[1]!.messages;
    assert.match(JSON.stringify(messages), /SOURCE_RULE/);
    assert.doesNotMatch(JSON.stringify(messages), /TEST_RULE/);
    const batch = session.messages.find(message => Array.isArray(message.content) && message.content.some(block => block.type === "tool_result"))!;
    assert.ok(Array.isArray(batch.content));
    assert.deepEqual(batch.content.slice(0, 2).map(block => block.type), ["tool_result", "tool_result"]);
    const results = resultBatches(session)[0]!;
    assert.deepEqual(results.map(result => result.tool_use_id), ["one", "two"]);
    assert.match(String(results[0]!.content), /FIRST_READ_CONTENT/);
    assert.match(String(results[1]!.content), /SECOND_READ_CONTENT/);
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
