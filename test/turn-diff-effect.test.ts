// The file-effect row, end to end: a real write/edit lands a typed host result, the journal keeps
// it across a reopen, and the turn-diff walk turns it into a turn the dialog can show.
//
// The provider is scripted in process: no network, no model. The workspace is a real temporary
// directory, so the patch is computed from the bytes the tool actually put on disk.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import type Anthropic from "@anthropic-ai/sdk";

import { Agent } from "../src/agent.js";
import { Session, type SessionConfig } from "../src/session.js";
import { createTools, type ToolDefinition } from "../src/tools.js";
import type { ModelProvider } from "../src/provider.js";
import { turnDiffMessages } from "../src/turn-diff-messages.js";
import { TurnDiffAccumulator } from "../src/diff-turn.js";

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-effect-")));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

type Reply = Anthropic.Message;
function reply(content: Anthropic.Message["content"], stop: Anthropic.StopReason | null): Reply {
  return { id: `msg_${stop ?? "x"}`, type: "message", role: "assistant", model: "test-model",
    content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as unknown as Reply;
}
function use(id: string, name: string, input: unknown): Anthropic.ToolUseBlock {
  return { type: "tool_use", id, name, input } as unknown as Anthropic.ToolUseBlock;
}

class Scripted implements ModelProvider {
  #replies: Reply[];
  constructor(replies: Reply[]) { this.#replies = replies; }
  async complete(): Promise<Anthropic.Message> {
    const next = this.#replies.shift();
    if (next === undefined) throw new Error("script exhausted");
    return next;
  }
  async count(): Promise<number> { return 1; }
}

const fileTools: ToolDefinition[] = createTools().filter((tool) =>
  tool.schema.name === "write_file" || tool.schema.name === "edit_file");

function config(workspace: string): SessionConfig {
  return { model: "test-model", system: "test-system",
    tools: fileTools.map((tool) => ({ ...tool.schema, eager_input_streaming: true })),
    workspace, allowShell: false, maxOutputBytes: 64_000, maxTokens: 1_024, contextTokens: 100_000,
    compactAt: 50_000, maxTurns: 30, thinking: false };
}

test("a write and an edit become typed rows that survive a reopen and read back as one turn", async () => {
  const ws = tmpDir();
  const session = Session.open(ws, { config: config(ws) });
  const id = session.id;
  const provider = new Scripted([
    reply([use("t1", "write_file", { path: "notes.txt", content: "one\ntwo\nthree\n" })], "tool_use"),
    reply([use("t2", "edit_file", { path: "notes.txt", old_string: "two", new_string: "2" })], "tool_use"),
    reply([{ type: "text", text: "done" } as Anthropic.TextBlock], "end_turn"),
  ]);
  const agent = new Agent(session, provider, fileTools, {});
  await agent.run("keep notes");

  assert.equal(fs.readFileSync(path.join(ws, "notes.txt"), "utf8"), "one\n2\nthree\n");
  const hostRows = session.events.filter((event) => event.kind === "tool_result" && event.host !== undefined);
  assert.equal(hostRows.length, 2);
  assert.deepEqual(hostRows[0]!.kind === "tool_result" ? hostRows[0]!.host : undefined, {
    type: "create", filePath: "notes.txt", content: "one\ntwo\nthree\n", structuredPatch: [] });
  assert.deepEqual(hostRows[1]!.kind === "tool_result" ? hostRows[1]!.host : undefined, {
    filePath: "notes.txt", oldString: "two", newString: "2", replaceAll: false,
    structuredPatch: [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 3, lines: [" one", "-two", "+2", " three"] }] });
  await session.close();

  const reopened = Session.open(ws, { id, config: config(ws) });
  try {
    const turns = new TurnDiffAccumulator().update(turnDiffMessages(reopened.events));
    assert.equal(turns.length, 1);
    assert.equal(turns[0]!.userPromptPreview, "keep notes");
    // The create row contributes the whole body as added lines — the recovered synthesis splits on
    // the newline, so a trailing newline yields a final empty line — and the edit adds its own hunk.
    assert.deepEqual(turns[0]!.stats, { filesChanged: 1, linesAdded: 5, linesRemoved: 1 });
    const file = turns[0]!.files.get("notes.txt");
    assert.ok(file, "the turn carries the edited file");
    assert.equal(file.isNewFile, true);
    assert.deepEqual(file.hunks[1]!.lines, [" one", "-two", "+2", " three"]);
  } finally { await reopened.close(); }
});

test("a write over existing non-empty content is an update row with its patch and no body", async () => {
  const ws = tmpDir();
  fs.writeFileSync(path.join(ws, "kept.txt"), "alpha\nbeta\n");
  const session = Session.open(ws, { config: config(ws) });
  const provider = new Scripted([
    reply([use("t1", "write_file", { path: "kept.txt", content: "alpha\ngamma\n", overwrite: true })], "tool_use"),
    reply([{ type: "text", text: "done" } as Anthropic.TextBlock], "end_turn"),
  ]);
  const agent = new Agent(session, provider, fileTools, {});
  await agent.run("rewrite");
  const row = session.events.find((event) => event.kind === "tool_result" && event.host !== undefined);
  assert.ok(row?.kind === "tool_result");
  assert.deepEqual(row.host, { type: "update", filePath: "kept.txt",
    structuredPatch: [{ oldStart: 1, oldLines: 2, newStart: 1, newLines: 2, lines: [" alpha", "-beta", "+gamma"] }] });
  const turns = new TurnDiffAccumulator().update(turnDiffMessages(session.events));
  assert.deepEqual(turns[0]!.stats, { filesChanged: 1, linesAdded: 1, linesRemoved: 1 });
  assert.equal(turns[0]!.files.get("kept.txt")?.isNewFile, false);
  await session.close();
});

test("a failed write leaves no host row", async () => {
  const ws = tmpDir();
  fs.writeFileSync(path.join(ws, "exists.txt"), "keep me\n");
  const session = Session.open(ws, { config: config(ws) });
  const provider = new Scripted([
    reply([use("t1", "write_file", { path: "exists.txt", content: "replacement\n" })], "tool_use"),
    reply([{ type: "text", text: "done" } as Anthropic.TextBlock], "end_turn"),
  ]);
  const agent = new Agent(session, provider, fileTools, {});
  await agent.run("overwrite without the flag");
  assert.equal(fs.readFileSync(path.join(ws, "exists.txt"), "utf8"), "keep me\n");
  assert.equal(session.events.some((event) => event.kind === "tool_result" && event.host !== undefined), false);
  await session.close();
});
