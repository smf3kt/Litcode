import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import type Anthropic from "@anthropic-ai/sdk";
import { Agent, assertPaired, defaultConfig } from "../src/agent.js";
import { Session, fingerprint, type SessionConfig, type SessionEvent } from "../src/session.js";
import { createTools, type ToolDefinition } from "../src/tools.js";
import { relocateSession } from "../src/workspace-session.js";

const roots: string[] = [];
const sessions: Session[] = [];
function temp(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-relocate-")));
  roots.push(dir); return dir;
}
function source(config?: Partial<SessionConfig>): Session {
  const workspace = temp();
  const initial = { ...defaultConfig(workspace, []), model: "fixture-model", ...config };
  const session = Session.open(workspace, { config: initial });
  sessions.push(session); return session;
}
function completed(session: Session, text = "completed work"): void {
  session.append({ kind: "message", message: { role: "user", content: text } });
  session.append({ kind: "message", message: { role: "assistant", content: "done" } });
  session.append({ kind: "turn_end", reason: "end_turn" });
}
function relocate(session: Session, target: string, build = (_config: SessionConfig): ToolDefinition[] => []): Session {
  const next = relocateSession(session, target, build); sessions.push(next); return next;
}
const response = {
  id: "msg_fixture", type: "message", role: "assistant", model: "fixture-model",
  content: [{ type: "text", text: "summary" }], stop_reason: "end_turn", stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 2 },
} as Anthropic.Message;
after(() => {
  for (const session of sessions) session.close();
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

test("relocation copies completed epochs and records old/new path context without changing source", () => {
  const original = source(); completed(original, `${original.config.workspace}/file.txt`);
  const before = fs.readFileSync(original.file); const beforeEvents = structuredClone(original.events);
  const target = temp(); const next = relocate(original, target);
  assert.notEqual(next.id, original.id);
  assert.equal(next.config.workspace, target);
  assert.equal(next.awaitingResponse, false);
  assert.deepEqual(next.events.slice(1, 4), original.events.slice(1));
  const marker = next.messages.at(-1)!;
  assert.equal(marker.role, "user");
  assert.match(String(marker.content), /Workspace relocation context/);
  assert.ok(String(marker.content).includes(JSON.stringify(original.config.workspace)));
  assert.ok(String(marker.content).includes(JSON.stringify(target)));
  assert.equal(next.events.at(-1)!.kind, "turn_end");
  assertPaired(next.messages);
  assert.deepEqual(fs.readFileSync(original.file), before);
  assert.deepEqual(original.events, beforeEvents);
  assert.ok(fs.existsSync(original.file + ".lock"));
  original.append({ kind: "turn_end", reason: "source still open" });
});

test("model, pinned instructions, token settings and feature configuration survive relocation", () => {
  const original = source({
    system: "Pinned source instructions; file paths stay historical.", maxTokens: 1234,
    contextTokens: 22000, compactAt: 15000, maxTurns: 9, thinking: true, allowShell: false,
    maxOutputBytes: 12000, permissions: { mode: "plan", allow: ["read_file"], deny: ["run_command"] },
    skills: [{ name: "fixture", description: "inert source skill", path: "/old/fixture/SKILL.md", body: "pinned", userInvocable: true, disableModelInvocation: false }],
    features: { tasks: true, subagents: false, worktrees: true },
  });
  const target = temp(); let received: SessionConfig | undefined;
  const next = relocate(original, target, (config) => {
    received = config;
    config.system = "callback mutation"; config.features!.tasks = false;
    return createTools();
  });
  assert.equal(received!.workspace, target);
  assert.deepEqual({ ...next.config, workspace: original.config.workspace, tools: original.config.tools }, original.config);
  assert.deepEqual(next.config.skills, original.config.skills);
  assert.equal(next.config.system, "Pinned source instructions; file paths stay historical.");
  assert.equal(next.config.features!.tasks, true);
  const metadata = next.events[0]!;
  assert.equal(metadata.kind, "metadata");
  if (metadata.kind === "metadata") assert.equal(metadata.fingerprint, fingerprint(next.config));
});

test("tools are rebuilt for target and pinned independently; subsequent files stay in target", async () => {
  const original = source(); const target = temp();
  const definitions = createTools(); let rebuilt: ToolDefinition[] = [];
  const next = relocate(original, target, (config) => {
    assert.equal(config.workspace, target); rebuilt = definitions; return rebuilt;
  });
  const provider = { count: async () => 1, complete: async () => response };
  new Agent(next, provider, rebuilt);
  assert.deepEqual(next.config.tools, rebuilt.map((tool) => ({ ...tool.schema, eager_input_streaming: true })));
  const write = rebuilt.find((tool) => tool.schema.name === "write_file")!;
  await write.execute({ path: "new.txt", content: "new workspace\n" }, {
    workspace: next.config.workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 12000,
  });
  assert.equal(fs.readFileSync(path.join(target, "new.txt"), "utf8"), "new workspace\n");
  assert.equal(fs.existsSync(path.join(original.config.workspace, "new.txt")), false);
  definitions[0]!.schema.description = "mutated after creation";
  assert.notEqual(next.config.tools[0]!.description, "mutated after creation");
});

test("compaction epochs and assistant response metadata are preserved", () => {
  const original = source(); completed(original);
  original.append({ kind: "compact", summary: "old workspace summary", response });
  original.append({ kind: "turn_end", reason: "manual_compact" });
  original.append({ kind: "message", message: { role: "assistant", content: response.content }, response });
  original.append({ kind: "turn_end", reason: "end_turn" });
  const next = relocate(original, temp());
  assert.deepEqual(next.events.slice(1, -2).filter(event => event.kind !== "branch"), original.events.slice(1));
  assert.ok(next.events.some(event => event.kind === "branch" && event.source === original.id && event.reason === "relocation"));
  assert.match(String(next.messages[0]!.content), /old workspace summary/);
  const copied = next.events.find((event) => event.kind === "message" && event.response);
  assert.ok(copied && copied.kind === "message");
  assert.deepEqual(copied.response, response);
});

test("completed tool/hook effects remain history and never replay as journals or calls", () => {
  const original = source(); let effects = 0;
  original.append({ kind: "message", message: { role: "user", content: "write a file" } });
  original.append({ kind: "message", message: { role: "assistant", content: [{ type: "tool_use", id: "call", name: "write_file", input: { path: "old.txt" } }] } });
  original.append({ kind: "tool_start", id: "call", name: "write_file" });
  const result: Anthropic.ToolResultBlockParam = { type: "tool_result", tool_use_id: "call", content: "old output" };
  original.append({ kind: "tool_result", result });
  original.append({ kind: "message", message: { role: "user", content: [result] } });
  original.append({ kind: "hook_start", id: "hook", event: "Stop" });
  original.append({ kind: "hook_result", id: "hook", event: "Stop", blocked: false, additionalContext: ["old hook context"] });
  original.append({ kind: "message", message: { role: "assistant", content: "complete" } });
  original.append({ kind: "turn_end", reason: "end_turn" });
  const next = relocate(original, temp(), () => [{ schema: { name: "write_file", description: "fixture", input_schema: { type: "object", properties: {} } }, readOnly: false,
    execute: async () => { effects++; return "effect"; } }]);
  assert.equal(effects, 0);
  assert.ok(next.events.every((event) => !["tool_start", "tool_result", "hook_start", "hook_result"].includes(event.kind)));
  assert.ok(JSON.stringify(next.messages).includes("old output"));
  assertPaired(next.messages);
});

test("unfinished conversations, tools, hooks and unpaired calls are rejected before builder or target writes", () => {
  const cases: Array<(session: Session) => void> = [
    (session) => session.append({ kind: "message", message: { role: "user", content: "unfinished" } }),
    (session) => session.append({ kind: "tool_start", id: "running", name: "write_file" }),
    (session) => session.append({ kind: "hook_start", id: "running", event: "SessionStart" }),
    (session) => {
      session.append({ kind: "message", message: { role: "assistant", content: [{ type: "tool_use", id: "missing", name: "write_file", input: {} }] } });
      session.append({ kind: "turn_end", reason: "synthetic incomplete" });
    },
    (session) => {
      session.append({ kind: "tool_start", id: "running", name: "write_file" });
      session.append({ kind: "turn_end", reason: "synthetic incomplete" });
    },
  ];
  for (const setup of cases) {
    const original = source(); const target = temp(); setup(original);
    const before = fs.readFileSync(original.file); let calls = 0;
    assert.throws(() => relocate(original, target, () => { calls++; return []; }), /unfinished|Unanswered/);
    assert.equal(calls, 0); assert.deepEqual(fs.readdirSync(target), []);
    assert.deepEqual(fs.readFileSync(original.file), before);
  }
});

test("builder failures, duplicate schemas and invalid compaction budgets leave no target locks", () => {
  const original = source(); const target = temp();
  assert.throws(() => relocate(original, target, () => { throw new Error("builder fixture failure"); }), /builder fixture failure/);
  assert.deepEqual(fs.readdirSync(target), []);
  const definition: ToolDefinition = { schema: { name: "duplicate", input_schema: { type: "object" } }, readOnly: true, execute: async () => "" };
  assert.throws(() => relocate(original, target, () => [definition, definition]), /duplicate/);
  assert.deepEqual(fs.readdirSync(target), []);
  const badBudget = source({ compactAt: 90, maxTokens: 10, contextTokens: 100 });
  assert.throws(() => relocate(badBudget, target), /leave room/);
  assert.deepEqual(fs.readdirSync(target), []);
});

test("history append failure releases new session lock and removes partial journal", () => {
  const original = source(); completed(original); const target = temp();
  const before = fs.readFileSync(original.file);
  const append = Session.prototype.append;
  Session.prototype.append = function (event: Exclude<SessionEvent, { kind: "metadata" }>) {
    if (this.config.workspace === target && event.kind === "turn_end") throw new Error("synthetic append failure");
    return append.call(this, event);
  };
  try { assert.throws(() => relocateSession(original, target, () => []), /synthetic append failure/); }
  finally { Session.prototype.append = append; }
  assert.deepEqual(fs.readdirSync(path.join(target, ".agent")), []);
  assert.deepEqual(fs.readFileSync(original.file), before);
  assert.ok(fs.existsSync(original.file + ".lock"));
});

test("canonical target aliases succeed and same/missing/file/symlink metadata targets fail", () => {
  const original = source(); const target = temp(); const aliases = temp();
  const alias = path.join(aliases, "target"); fs.symlinkSync(target, alias);
  assert.equal(relocate(original, alias).config.workspace, target);
  assert.throws(() => relocate(original, original.config.workspace), /already/);
  assert.throws(() => relocate(original, path.join(target, "missing")), /ENOENT/);
  const file = path.join(target, "file"); fs.writeFileSync(file, "fixture");
  assert.throws(() => relocate(original, file), /directory/);
  const bad = temp(); fs.symlinkSync(temp(), path.join(bad, ".agent"));
  assert.throws(() => relocate(original, bad), /real directory/);
});

test("relocated journal resumes with pinned configuration and independent mutable history", () => {
  const original = source(); completed(original); const target = temp();
  const next = relocate(original, target, () => createTools());
  const expected = structuredClone(next.config); const nextId = next.id;
  next.close();
  const reopened = Session.open(target, { id: nextId, config: expected }); sessions.push(reopened);
  assert.equal(reopened.awaitingResponse, false);
  assert.equal(reopened.messages.at(-1)!.role, "user");
  reopened.append({ kind: "message", message: { role: "user", content: "new work" } });
  assert.equal(original.messages.at(-1)!.content, "done");
  assert.deepEqual(reopened.config, expected);
});

test("source pinned configuration changes fail before relocation", () => {
  const original = source(); const target = temp();
  original.config.system = "changed out of journal";
  assert.throws(() => relocate(original, target), /pinned configuration changed/);
  assert.deepEqual(fs.readdirSync(target), []);
});
