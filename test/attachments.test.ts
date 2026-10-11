import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { Agent, defaultConfig } from "../src/agent.js";
import { interactiveLoop } from "../src/interactive.js";
import { Session } from "../src/session.js";
import type { ModelProvider } from "../src/provider.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const reply = (): Anthropic.Message => ({ id: "fixture", model: "fixture", role: "assistant", type: "message",
  content: [{ type: "text", text: "done", citations: null }], stop_reason: "end_turn", stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message);
const sink = () => new Writable({ write(_chunk, _encoding, done) { done(); } });

test("interactive quoted PNG task passes expansion hooks and survives journal reopen", async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "attach-image-")));
  fs.writeFileSync(path.join(workspace, "screen shot.png"), png);
  const config = defaultConfig(workspace, []); config.model = "fixture";
  const hook = { hookSpecificOutput: { hookEventName: "UserPromptExpansion", updatedPrompt: "rewritten task", additionalContext: "extra context" } };
  config.hooks = { UserPromptExpansion: [{ command: `printf %s ${JSON.stringify(JSON.stringify(hook))}` }] };
  const session = Session.open(workspace, { config });
  let content: Anthropic.MessageParam["content"] | undefined;
  const provider: ModelProvider = { count: async () => 1, complete: async request => {
    content = request.messages.at(-1)!.content; return reply();
  } };
  try {
    await interactiveLoop(session, provider, { tools: [], buildTools: () => [], close: async () => {}, limits: [] }, {
      input: Readable.from(["/attach screen\\ shot.png inspect screenshot\n/exit\n"]),
      output: sink(), status: sink(), signal: new AbortController().signal,
    });
    assert.ok(Array.isArray(content));
    assert.deepEqual(content[0], { type: "text", text: "rewritten task" });
    const image = content.find(block => block.type === "image"); assert.ok(image && image.source.type === "base64");
    assert.deepEqual(Buffer.from(image.source.data, "base64"), png);
    assert.ok(content.some(block => block.type === "text" && block.text.includes("extra context")));
    const reopened = Session.open(workspace, { id: session.id });
    try { assert.deepEqual(reopened.messages[0]!.content, content); }
    finally { reopened.close(); }
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test("selected PDF remains attached after prior history compaction", async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "attach-pdf-")));
  const pdf = await PDFDocument.create(); pdf.addPage([100, 200]); pdf.addPage([300, 400]);
  fs.writeFileSync(path.join(workspace, "report.pdf"), await pdf.save());
  const config = defaultConfig(workspace, []); config.model = "fixture";
  const session = Session.open(workspace, { config });
  session.append({ kind: "message", message: { role: "user", content: "old history" } });
  session.append({ kind: "message", message: { role: "assistant", content: "old response" } });
  session.append({ kind: "turn_end", reason: "end_turn" });
  let calls = 0;
  const provider: ModelProvider = {
    count: async request => request.messages.some(message => message.content === "old history") ? config.compactAt : 1,
    complete: async request => {
      calls++;
      if (calls === 1) {
        assert.equal(JSON.stringify(request.messages).includes("application/pdf"), false);
      } else {
        const blocks = request.messages.at(-1)!.content; assert.ok(Array.isArray(blocks));
        const document = blocks.find(block => block.type === "document");
        assert.ok(document && document.source.type === "base64");
        const selected = await PDFDocument.load(Buffer.from(document.source.data, "base64"));
        assert.equal(selected.getPageCount(), 1); assert.equal(selected.getPage(0).getWidth(), 300);
      }
      return reply();
    },
  };
  try {
    await new Agent(session, provider, []).run("read second page", undefined, { path: "report.pdf", pages: "2" });
    assert.equal(calls, 2); assert.equal(session.awaitingResponse, false);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});

test("attachment overflow, invalid input and cancellation persist no user attachment", async () => {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "attach-reject-")));
  fs.writeFileSync(path.join(workspace, "one.png"), png);
  const config = defaultConfig(workspace, []); config.model = "fixture";
  const session = Session.open(workspace, { config });
  let completions = 0;
  const provider: ModelProvider = { count: async () => config.compactAt, complete: async () => { completions++; return reply(); } };
  const agent = new Agent(session, provider, []);
  try {
    await assert.rejects(agent.run("inspect", undefined, { path: "one.png" }), /context threshold/);
    await assert.rejects(agent.run("inspect", undefined, { path: "../one.png" }), /escapes/);
    await assert.rejects(agent.run("inspect", undefined, { path: "one.png", pages: "1" }), /PDF/);
    assert.equal((await agent.run("inspect", AbortSignal.abort(), { path: "one.png" })).reason, "aborted");
    assert.equal(completions, 0); assert.equal(session.messages.length, 0); assert.equal(session.awaitingResponse, false);
  } finally { session.close(); fs.rmSync(workspace, { recursive: true, force: true }); }
});
