import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";

import { Agent, assertPaired, defaultConfig } from "../src/agent.js";
import type { ModelProvider, ModelRequest } from "../src/provider.js";
import { Session as ParentSession, fingerprint, type SessionConfig, type SessionEvent } from "../src/session.js";
import { createTools } from "../src/tools.js";

type OpenOptions = Parameters<typeof ParentSession.open>[1];
type Step = Anthropic.Message | ((request: ModelRequest) => Anthropic.Message);
const JOURNAL_LIMIT = 64 * 1024;

class ScriptedProvider implements ModelProvider {
  readonly requests: ModelRequest[] = [];
  counts = 0;
  constructor(private readonly steps: Step[]) {}
  async count(request: ModelRequest, signal: AbortSignal): Promise<number> {
    signal.throwIfAborted();
    assertPaired(request.messages);
    assert.ok(++this.counts <= 8, "Fixture exceeded its model count budget");
    return 1;
  }
  async complete(request: ModelRequest, signal: AbortSignal): Promise<Anthropic.Message> {
    signal.throwIfAborted();
    assertPaired(request.messages);
    assert.ok(this.requests.length < 8, "Fixture exceeded its model request budget");
    this.requests.push(structuredClone(request));
    const step = this.steps.shift();
    assert.ok(step, "Unexpected model request");
    return typeof step === "function" ? step(request) : step;
  }
  assertConsumed(): void { assert.equal(this.steps.length, 0); }
}

function response(content: Anthropic.Message["content"], stop: Anthropic.StopReason = "end_turn"): Anthropic.Message {
  return { id: "storage-fixture", type: "message", role: "assistant", model: "fixture-model",
    content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } as Anthropic.Message;
}
function calls(...items: Array<{ id: string; name: string; input: unknown }>): Anthropic.Message {
  return response(items.map(item => ({ type: "tool_use", caller: { type: "direct" }, ...item })), "tool_use");
}
const done = () => response([{ type: "text", text: "done", citations: null }]);

function fixture(t: TestContext) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-session-storage-")));
  const workspace = path.join(root, "checkout");
  const storageRoot = path.join(root, "storage");
  const outside = path.join(root, "outside");
  for (const dir of [workspace, storageRoot, outside]) fs.mkdirSync(dir);
  const tools = createTools().filter(tool => ["read_file", "write_file"].includes(tool.schema.name));
  assert.deepEqual(tools.map(tool => tool.schema.name).sort(), ["read_file", "write_file"]);
  const config: SessionConfig = { ...defaultConfig(workspace, tools), model: "fixture-model",
    maxOutputBytes: 256, maxTokens: 1024, contextTokens: 16000, compactAt: 8000, maxTurns: 4 };
  const sessions = new Set<ParentSession>();
  t.after(() => {
    try { for (const session of sessions) session.close(); }
    finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  const open = (target = workspace, options: OpenOptions = { config, storageRoot }) => {
    const session = ParentSession.open(target, options);
    sessions.add(session);
    return session;
  };
  return { root, workspace, storageRoot, outside, tools, config, open };
}

function journal(file: string): { bytes: Buffer; events: SessionEvent[] } {
  assert.ok(fs.statSync(file).size <= JOURNAL_LIMIT, "Fixture journal exceeded its byte budget");
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.at(-1), 10);
  const events = bytes.toString("utf8").trimEnd().split("\n").map(line => JSON.parse(line) as SessionEvent);
  assert.ok(events.length <= 64, "Fixture journal exceeded its event budget");
  return { bytes, events };
}
function result(session: ParentSession, id: string): Anthropic.ToolResultBlockParam {
  const event = session.events.find(event => event.kind === "tool_result" && event.result.tool_use_id === id);
  assert.ok(event && event.kind === "tool_result", `Missing durable tool result ${id}`);
  return event.result;
}
function assertMetadata(session: ParentSession, config: SessionConfig): void {
  const records = journal(session.file).events;
  assert.deepEqual(records, session.events);
  const meta = records[0];
  assert.ok(meta && meta.kind === "metadata");
  assert.equal(meta.id, session.id);
  assert.deepEqual(meta.config, config);
  assert.equal(meta.fingerprint, fingerprint(config));
}
function assertNoCheckoutJournal(workspace: string): void {
  assert.equal(fs.existsSync(path.join(workspace, ".agent")), false);
}
function toolResultText(request: ModelRequest): string {
  return JSON.stringify(request.messages.at(-1)?.content);
}

// All file effects below stay in the per-test temporary fixture; the provider is inert.
test("external journal preserves actual workspace config and real read/write tool routing", async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.workspace, "evidence.txt"), "ACTUAL_CHECKOUT_EVIDENCE\n");
  fs.writeFileSync(path.join(f.storageRoot, "evidence.txt"), "STORAGE_DECOY\n");
  const original = structuredClone(f.config);
  const session = f.open();
  assert.equal(session.file, path.join(f.storageRoot, ".agent", `${session.id}.jsonl`));
  assert.equal(fs.existsSync(session.file + ".lock"), true);
  assert.deepEqual(session.config, original);
  assert.deepEqual(f.config, original);
  assertNoCheckoutJournal(f.workspace);
  const provider = new ScriptedProvider([
    calls({ id: "read", name: "read_file", input: { path: "evidence.txt", limit: 1 } }),
    request => {
      assert.match(toolResultText(request), /ACTUAL_CHECKOUT_EVIDENCE/);
      assert.doesNotMatch(toolResultText(request), /STORAGE_DECOY/);
      return calls({ id: "write", name: "write_file", input: { path: "written.txt", content: "actual checkout write\n" } });
    }, done(),
  ]);
  const run = await new Agent(session, provider, f.tools).run("Read evidence and write the checkout fixture.");
  assert.equal(run.reason, "end_turn");
  assert.equal(run.modelCalls, 3);
  provider.assertConsumed();
  assert.equal(result(session, "read").is_error, undefined);
  assert.equal(result(session, "write").is_error, undefined);
  assert.equal(fs.readFileSync(path.join(f.workspace, "written.txt"), "utf8"), "actual checkout write\n");
  assert.equal(fs.existsSync(path.join(f.storageRoot, "written.txt")), false);
  assertMetadata(session, original);
  assertPaired(session.messages);
  assertNoCheckoutJournal(f.workspace);
  session.close();
  assert.deepEqual(fs.readdirSync(path.join(f.storageRoot, ".agent")), [`${session.id}.jsonl`]);
});

test("same id and storageRoot resume pinned actual workspace history and subsequent file tools", async t => {
  const f = fixture(t);
  const first = f.open();
  const initial = new ScriptedProvider([
    calls({ id: "before", name: "write_file", input: { path: "before.txt", content: "saved checkout state\n" } }), done(),
  ]);
  await new Agent(first, initial, f.tools).run("Persist a fixture file.");
  initial.assertConsumed();
  const instruction = path.join(f.workspace, "deep/AGENTS.md");
  first.append({ kind: "instruction_watch", workspace: f.workspace, paths: [instruction] });
  assert.throws(() => first.append({ kind: "instruction_watch", workspace: f.workspace, paths: ["relative"] }));
  const before = journal(first.file);
  const history = structuredClone(first.messages);
  first.close();
  const resumed = f.open(f.workspace, { id: first.id, storageRoot: f.storageRoot });
  assert.equal(resumed.id, first.id);
  assert.equal(resumed.file, first.file);
  assert.deepEqual(resumed.config, f.config);
  assert.deepEqual(resumed.messages, history);
  assert.deepEqual(resumed.events, before.events);
  assert.ok(resumed.events.some(event => event.kind === "instruction_watch" && event.paths.includes(instruction)));
  assert.equal(resumed.awaitingResponse, false);
  const provider = new ScriptedProvider([
    request => {
      assert.deepEqual(request.messages.slice(0, history.length), history);
      return calls({ id: "after-read", name: "read_file", input: { path: "before.txt", limit: 1 } });
    }, request => {
      assert.match(toolResultText(request), /saved checkout state/);
      return calls({ id: "after-write", name: "write_file", input: { path: "after.txt", content: "resumed checkout write\n" } });
    }, done(),
  ]);
  assert.equal((await new Agent(resumed, provider, f.tools).run("Continue in the actual checkout.")).reason, "end_turn");
  provider.assertConsumed();
  assert.equal(result(resumed, "after-read").is_error, undefined);
  assert.equal(result(resumed, "after-write").is_error, undefined);
  assert.equal(fs.readFileSync(path.join(f.workspace, "after.txt"), "utf8"), "resumed checkout write\n");
  assert.equal(fs.existsSync(path.join(f.storageRoot, "after.txt")), false);
  assert.deepEqual(journal(resumed.file).bytes.subarray(0, before.bytes.length), before.bytes);
  assertMetadata(resumed, f.config);
  assertNoCheckoutJournal(f.workspace);
  resumed.close();
  const pinned = f.open(f.workspace, { id: first.id, config: f.config, storageRoot: f.storageRoot });
  assert.deepEqual(pinned.config, f.config);
});

test("resume rejects another actual workspace even when its config and shared storage are supplied", t => {
  const f = fixture(t);
  const session = f.open();
  session.close();
  // Invalid resumes must leave even an uncommitted tail untouched.
  fs.appendFileSync(session.file, '{"kind":"message"');
  const before = fs.readFileSync(session.file);
  for (const target of [f.outside, f.storageRoot]) {
    assert.throws(() => f.open(target, { id: session.id, config: { ...f.config, workspace: target }, storageRoot: f.storageRoot }), /identity or config mismatch/);
    assert.deepEqual(fs.readFileSync(session.file), before);
    assert.equal(fs.existsSync(session.file + ".lock"), false);
    assertNoCheckoutJournal(target === f.storageRoot ? f.workspace : target);
  }
});

test("resume checks original config fingerprint for model system tool schemas and runtime settings", t => {
  const f = fixture(t);
  const session = f.open();
  session.close();
  const before = journal(session.file).bytes;
  const variants: SessionConfig[] = [
    { ...f.config, model: "different-fixture-model" },
    { ...f.config, system: "different pinned instructions" },
    { ...f.config, tools: f.config.tools.map(tool => ({ ...tool, description: "different schema" })) },
    { ...f.config, maxOutputBytes: f.config.maxOutputBytes + 1 },
  ];
  for (const config of variants) {
    assert.throws(() => f.open(f.workspace, { id: session.id, config, storageRoot: f.storageRoot }), /Resume requires the original/);
    assert.deepEqual(journal(session.file).bytes, before);
    assert.equal(fs.existsSync(session.file + ".lock"), false);
  }
  assert.deepEqual(f.open(f.workspace, { id: session.id, config: f.config, storageRoot: f.storageRoot }).config, f.config);
  assertNoCheckoutJournal(f.workspace);
});

test("external journal metadata fingerprint is independently validated on resume", t => {
  const f = fixture(t);
  const session = f.open();
  session.close();
  const records = journal(session.file).events;
  const meta = records[0];
  assert.ok(meta && meta.kind === "metadata");
  meta.config.system = "tampered metadata fixture";
  fs.writeFileSync(session.file, records.map(event => JSON.stringify(event)).join("\n") + "\n");
  const before = fs.readFileSync(session.file);
  assert.throws(() => f.open(f.workspace, { id: session.id, storageRoot: f.storageRoot }), /identity or config mismatch/);
  assert.deepEqual(fs.readFileSync(session.file), before);
  assert.equal(fs.existsSync(session.file + ".lock"), false);
  assertNoCheckoutJournal(f.workspace);
});

test("storageRoot directory symlink uses its canonical anchor and resumes through either spelling", t => {
  const f = fixture(t);
  const alias = path.join(f.root, "storage-alias");
  fs.symlinkSync(f.storageRoot, alias, "dir");
  const session = f.open(f.workspace, { config: f.config, storageRoot: alias });
  assert.equal(session.file, path.join(fs.realpathSync(alias), ".agent", `${session.id}.jsonl`));
  assertMetadata(session, f.config);
  session.close();
  const canonical = f.open(f.workspace, { id: session.id, config: f.config, storageRoot: f.storageRoot });
  assert.equal(canonical.file, session.file);
  canonical.close();
  const aliased = f.open(f.workspace, { id: session.id, storageRoot: alias });
  assert.equal(aliased.file, session.file);
  assert.deepEqual(aliased.config, f.config);
  assertNoCheckoutJournal(f.workspace);
});

test("external storage rejects real and dangling .agent symlinks and non-directory .agent paths", async t => {
  for (const kind of ["symlink", "dangling", "file"] as const) await t.test(kind, t => {
    const f = fixture(t);
    const agentDir = path.join(f.storageRoot, ".agent");
    fs.writeFileSync(path.join(f.outside, "sentinel.txt"), "untouched\n");
    if (kind === "file") fs.writeFileSync(agentDir, "metadata directory decoy\n");
    else fs.symlinkSync(kind === "symlink" ? f.outside : path.join(f.outside, "missing"), agentDir, "dir");
    const before = fs.readdirSync(f.outside);
    assert.throws(() => f.open(), kind === "dangling" ? /EEXIST|real directory/ : /real directory/);
    assert.deepEqual(fs.readdirSync(f.outside), before);
    assert.equal(fs.readFileSync(path.join(f.outside, "sentinel.txt"), "utf8"), "untouched\n");
    assert.deepEqual(fs.readdirSync(f.storageRoot), [".agent"]);
    assertNoCheckoutJournal(f.workspace);
  });
});

test("missing or file storage roots fail before new-session or resume journal effects", t => {
  const f = fixture(t);
  const session = f.open();
  session.close();
  const before = journal(session.file).bytes;
  const file = path.join(f.root, "storage-file");
  const missing = path.join(f.root, "missing-storage");
  fs.writeFileSync(file, "storage file sentinel\n");
  for (const storageRoot of [missing, file]) for (const id of [undefined, session.id]) {
    assert.throws(() => f.open(f.workspace, { config: f.config, storageRoot, ...(id ? { id } : {}) }), storageRoot === missing ? /ENOENT/ : /storage root must be a directory/);
    assert.deepEqual(journal(session.file).bytes, before);
    assert.equal(fs.existsSync(session.file + ".lock"), false);
    assert.equal(fs.existsSync(missing), false);
    assert.equal(fs.readFileSync(file, "utf8"), "storage file sentinel\n");
    assert.deepEqual(fs.readdirSync(path.join(f.storageRoot, ".agent")), [`${session.id}.jsonl`]);
    assertNoCheckoutJournal(f.workspace);
  }
});

test("external storage still requires canonical actual workspace config", t => {
  const f = fixture(t);
  const alias = path.join(f.root, "checkout-alias");
  fs.symlinkSync(f.workspace, alias, "dir");
  for (const workspace of [f.storageRoot, alias]) {
    assert.throws(() => f.open(f.workspace, { config: { ...f.config, workspace }, storageRoot: f.storageRoot }), /Config workspace must use its canonical path/);
    assert.deepEqual(fs.readdirSync(path.join(f.storageRoot, ".agent")), []);
    assertNoCheckoutJournal(f.workspace);
  }
  const session = f.open(alias, { config: f.config, storageRoot: f.storageRoot });
  assertMetadata(session, f.config);
});

test("a missing actual workspace is rejected before creating external storage metadata", t => {
  const f = fixture(t);
  const missing = path.join(f.root, "missing-checkout");
  assert.throws(() => f.open(missing, { config: { ...f.config, workspace: missing }, storageRoot: f.storageRoot }), /ENOENT/);
  assert.deepEqual(fs.readdirSync(f.storageRoot), []);
  assert.equal(fs.existsSync(missing), false);
  assertNoCheckoutJournal(f.workspace);
});

test("external storage requires actual workspace to remain a directory", t => {
  const f = fixture(t);
  const file = path.join(f.root, "checkout-file");
  fs.writeFileSync(file, "workspace file sentinel\n");
  assert.throws(() => f.open(file, { config: { ...f.config, workspace: file }, storageRoot: f.storageRoot }), /directory/);
  assert.deepEqual(fs.readdirSync(f.storageRoot), []);
  assert.equal(fs.readFileSync(file, "utf8"), "workspace file sentinel\n");
});

test("external storage grants no file-tool access through traversal absolute paths or symlinks", async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.storageRoot, "sentinel.txt"), "STORAGE_SENTINEL\n");
  fs.symlinkSync(f.storageRoot, path.join(f.workspace, "storage-link"), "dir");
  const session = f.open();
  const metadata = journal(session.file).events[0];
  const paths = [
    "../storage/sentinel.txt",
    path.join(f.storageRoot, "sentinel.txt"),
    "storage-link/sentinel.txt",
    `storage-link/.agent/${session.id}.jsonl`,
    `.agent/${session.id}.jsonl`,
  ];
  const attempted = paths.flatMap((target, index) => [
    { id: `blocked-read-${index}`, name: "read_file", input: { path: target, limit: 1 } },
    { id: `blocked-write-${index}`, name: "write_file", input: { path: target, content: "escaped write", overwrite: true } },
  ]);
  const provider = new ScriptedProvider([calls(...attempted), done()]);
  assert.equal((await new Agent(session, provider, f.tools).run("Exercise the confined fixture paths.")).reason, "end_turn");
  provider.assertConsumed();
  for (const attempt of attempted) {
    const output = result(session, attempt.id);
    assert.equal(output.is_error, true, attempt.id);
    assert.match(String(output.content), /escapes the workspace|reserved/);
  }
  assert.equal(fs.readFileSync(path.join(f.storageRoot, "sentinel.txt"), "utf8"), "STORAGE_SENTINEL\n");
  assert.deepEqual(journal(session.file).events[0], metadata);
  assertNoCheckoutJournal(f.workspace);
  assert.deepEqual(fs.readdirSync(f.workspace), ["storage-link"]);
  assertPaired(session.messages);
});

test("external journal records bounded real read output", async t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.workspace, "large.txt"), "x".repeat(4096) + "UNREAD_TAIL\n");
  const session = f.open();
  const provider = new ScriptedProvider([
    calls({ id: "bounded-read", name: "read_file", input: { path: "large.txt", limit: 1 } }), done(),
  ]);
  await new Agent(session, provider, f.tools).run("Read the bounded fixture.");
  provider.assertConsumed();
  const output = result(session, "bounded-read");
  assert.equal(output.is_error, undefined);
  assert.match(String(output.content), /truncated/);
  assert.doesNotMatch(String(output.content), /UNREAD_TAIL/);
  assert.ok(Buffer.byteLength(String(output.content)) < f.config.maxOutputBytes + 256);
  assertMetadata(session, f.config);
  assertNoCheckoutJournal(f.workspace);
});

test("omitted storageRoot keeps legacy checkout journal placement and resume behavior", t => {
  const f = fixture(t);
  const session = f.open(f.workspace, { config: f.config });
  assert.equal(session.file, path.join(f.workspace, ".agent", `${session.id}.jsonl`));
  session.append({ kind: "message", message: { role: "user", content: "legacy fixture history" } });
  session.append({ kind: "message", message: { role: "assistant", content: "legacy done" } });
  session.append({ kind: "turn_end", reason: "end_turn" });
  assertMetadata(session, f.config);
  session.close();
  const before = journal(session.file).bytes;
  assert.throws(() => f.open(f.workspace, { id: session.id, config: { ...f.config, model: "changed" } }), /Resume requires the original/);
  assert.deepEqual(journal(session.file).bytes, before);
  const resumed = f.open(f.workspace, { id: session.id, config: f.config });
  assert.equal(resumed.file, session.file);
  assert.equal(resumed.messages.at(-1)?.content, "legacy done");
  assert.deepEqual(fs.readdirSync(f.storageRoot), []);
});
