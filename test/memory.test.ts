import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createMemoryTools } from "../src/memory.js";
import type { ToolContext } from "../src/tools.js";

const tools = new Map(createMemoryTools().map((tool) => [tool.schema.name, tool]));
const directories: string[] = [];
const MAX_FILE_BYTES = 2 * 1024 * 1024;
function workspace(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cc-memory-fixture-"));
  directories.push(directory);
  return directory;
}
after(() => {
  for (const directory of directories) fs.rmSync(directory, { recursive: true, force: true });
});
function context(directory: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return { workspace: directory, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000, ...overrides };
}
async function run(name: string, input: unknown, directory: string, overrides: Partial<ToolContext> = {}): Promise<Record<string, any>> {
  return JSON.parse(await tools.get(name)!.execute(input, context(directory, overrides)));
}
function store(directory: string): string { return path.join(directory, ".harness", "memory"); }
function sha(bytes: Buffer | string): string { return crypto.createHash("sha256").update(bytes).digest("hex"); }

// Unicode escapes keep the source ASCII while round-tripping Unicode bytes.
const unicode = "世界 \u{1F600} Café\n";

test("memory tools expose read-only catalogs and mutating write/delete schemas", () => {
  assert.deepEqual([...tools.keys()], ["memory_list", "memory_read", "memory_write", "memory_delete"]);
  assert.equal(tools.get("memory_list")!.readOnly, true);
  assert.equal(tools.get("memory_read")!.readOnly, true);
  assert.equal(tools.get("memory_write")!.readOnly, false);
  assert.equal(tools.get("memory_delete")!.readOnly, false);
  assert.deepEqual(tools.get("memory_delete")!.schema.input_schema.required, ["name", "expected_sha256"]);
  for (const tool of tools.values()) assert.equal(tool.schema.input_schema.additionalProperties, false);
});

test("empty list is side-effect free and absent entries report errors", async () => {
  const directory = workspace();
  assert.deepEqual(await run("memory_list", {}, directory), { memories: [], total_bytes: 0, truncated: false });
  await assert.rejects(run("memory_read", { name: "missing" }, directory), /does not exist/);
  await assert.rejects(run("memory_delete", { name: "missing", expected_sha256: "0".repeat(64) }, directory), /conflict/);
  assert.equal(fs.existsSync(path.join(directory, ".harness")), false);
});

test("create/read/list/update/delete preserves Unicode and enforces private permissions", async () => {
  const directory = workspace();
  const metadata = { title: "Project 世界", description: "Useful \u{1F600} facts" };
  const created = await run("memory_write", { name: "project-facts", content: unicode, ...metadata }, directory);
  assert.equal(created.created, true);
  assert.match(created.sha256, /^[a-f0-9]{64}$/);
  const filename = path.join(store(directory), "project-facts.md");
  assert.equal(fs.statSync(path.join(directory, ".harness")).mode & 0o777, 0o700);
  assert.equal(fs.statSync(store(directory)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  const bytes = fs.readFileSync(filename);
  assert.equal(created.sha256, sha(bytes));
  const read = await run("memory_read", { name: "project-facts" }, directory);
  assert.equal(read.content, unicode);
  assert.equal(read.title, metadata.title);
  assert.equal(read.description, metadata.description);
  assert.equal(read.truncated, false);
  assert.equal(read.sha256, created.sha256);
  const listed = await run("memory_list", {}, directory);
  assert.deepEqual(listed.memories, [{ name: "project-facts", sha256: created.sha256, bytes: bytes.length, ...metadata }]);
  assert.equal(listed.total_bytes, bytes.length);
  const updated = await run("memory_write", { name: "project-facts", content: "replacement", expected_sha256: read.sha256 }, directory);
  assert.equal(updated.created, false);
  assert.equal((await run("memory_read", { name: "project-facts" }, directory)).content, "replacement");
  assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  assert.deepEqual(await run("memory_delete", { name: "project-facts", expected_sha256: updated.sha256 }, directory), { name: "project-facts", deleted: true });
  assert.equal(fs.existsSync(filename), false);
  assert.deepEqual(fs.readdirSync(store(directory)), []);
});

test("create is exclusive and stale hashes conflict for overwrite and delete", async () => {
  const directory = workspace();
  const first = await run("memory_write", { name: "one", content: "first" }, directory);
  await assert.rejects(run("memory_write", { name: "one", content: "clobber" }, directory), /create conflict/);
  const current = await run("memory_write", { name: "one", content: "second", expected_sha256: first.sha256 }, directory);
  await assert.rejects(run("memory_write", { name: "one", content: "stale", expected_sha256: first.sha256 }, directory), /SHA-256 conflict/);
  await assert.rejects(run("memory_delete", { name: "one", expected_sha256: first.sha256 }, directory), /SHA-256 conflict/);
  await assert.rejects(run("memory_write", { name: "absent", content: "stale", expected_sha256: first.sha256 }, directory), /SHA-256 conflict/);
  assert.equal((await run("memory_read", { name: "one" }, directory)).sha256, current.sha256);
  assert.deepEqual(fs.readdirSync(store(directory)), ["one.md"]);
});

test("concurrent updates from one hash have exactly one winner", async () => {
  const directory = workspace();
  const first = await run("memory_write", { name: "one", content: "start" }, directory);
  const outcomes = await Promise.allSettled([
    run("memory_write", { name: "one", content: "left", expected_sha256: first.sha256 }, directory),
    run("memory_write", { name: "one", content: "right", expected_sha256: first.sha256 }, directory),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  const failure = outcomes.find((result) => result.status === "rejected");
  assert.ok(failure && failure.status === "rejected");
  assert.match(failure.reason.message, /conflict/);
  const read = await run("memory_read", { name: "one" }, directory);
  assert.ok(["left", "right"].includes(read.content));
  assert.deepEqual(fs.readdirSync(store(directory)), ["one.md"]);
});

test("cooperating process lock blocks mutation without deleting another lock", async () => {
  const directory = workspace();
  const first = await run("memory_write", { name: "one", content: "first" }, directory);
  const lock = path.join(store(directory), ".write.lock");
  fs.writeFileSync(lock, "fixture-owner", { mode: 0o600 });
  await assert.rejects(run("memory_write", { name: "one", content: "second", expected_sha256: first.sha256 }, directory), /store busy/);
  await assert.rejects(run("memory_delete", { name: "one", expected_sha256: first.sha256 }, directory), /store busy/);
  assert.equal(fs.readFileSync(lock, "utf8"), "fixture-owner");
  assert.equal((await run("memory_read", { name: "one" }, directory)).content, "first");
  fs.unlinkSync(lock);
});

test("external edits invalidate expected hashes", async () => {
  const directory = workspace();
  const first = await run("memory_write", { name: "one", content: "first" }, directory);
  fs.writeFileSync(path.join(store(directory), "one.md"), "external edit");
  await assert.rejects(run("memory_write", { name: "one", content: "second", expected_sha256: first.sha256 }, directory), /conflict/);
  assert.equal((await run("memory_read", { name: "one" }, directory)).content, "external edit");
});

test("slug traversal, absolute paths, unsupported keys and invalid digests fail", async () => {
  const directory = workspace();
  for (const name of ["../outside", "/absolute", "one.md", ".agent", "Upper", "a/b", "", "a".repeat(65), "one\u0000"]) {
    await assert.rejects(run("memory_write", { name, content: "data" }, directory));
    await assert.rejects(run("memory_read", { name }, directory));
  }
  await assert.rejects(run("memory_write", { name: "one", content: "data", metadata: { command: "run" } }, directory));
  await assert.rejects(run("memory_write", { name: "one", content: "data", expected_sha256: "bad" }, directory));
  await assert.rejects(run("memory_delete", { name: "one" }, directory));
  await assert.rejects(run("memory_list", { source: "other" }, directory));
  assert.equal(fs.existsSync(store(directory)), false);
});

test(".harness symlink aliases outside workspace and .agent are rejected", async () => {
  for (const destinationKind of ["outside", "agent"]) {
    const directory = workspace();
    const destination = destinationKind === "outside" ? workspace() : path.join(directory, ".agent");
    fs.mkdirSync(destination, { recursive: true });
    fs.symlinkSync(destination, path.join(directory, ".harness"));
    for (const [name, input] of [
      ["memory_list", {}], ["memory_read", { name: "one" }],
      ["memory_write", { name: "one", content: "data" }],
      ["memory_delete", { name: "one", expected_sha256: "0".repeat(64) }],
    ] as const) await assert.rejects(run(name, input, directory), /symlink|alias/);
    assert.deepEqual(fs.readdirSync(destination), []);
  }
});

test("memory directory aliases and file symlinks are rejected with targets preserved", async () => {
  const directory = workspace();
  const destination = workspace();
  fs.mkdirSync(path.join(directory, ".harness"));
  fs.symlinkSync(destination, store(directory));
  await assert.rejects(run("memory_write", { name: "one", content: "data" }, directory), /symlink|alias/);
  fs.unlinkSync(store(directory));
  fs.mkdirSync(store(directory));
  const target = path.join(destination, "original.md");
  fs.writeFileSync(target, "untouched");
  fs.symlinkSync(target, path.join(store(directory), "one.md"));
  await assert.rejects(run("memory_list", {}, directory), /symlink/);
  await assert.rejects(run("memory_read", { name: "one" }, directory), /symlink/);
  await assert.rejects(run("memory_write", { name: "one", content: "clobber", expected_sha256: sha("untouched") }, directory), /symlink/);
  await assert.rejects(run("memory_delete", { name: "one", expected_sha256: sha("untouched") }, directory), /symlink/);
  assert.equal(fs.readFileSync(target, "utf8"), "untouched");
});

test("hard-linked memory and a workspace aliased to .agent are rejected", async () => {
  const directory = workspace();
  await run("memory_write", { name: "one", content: "data" }, directory);
  fs.linkSync(path.join(store(directory), "one.md"), path.join(directory, "outside.md"));
  await assert.rejects(run("memory_read", { name: "one" }, directory), /linked|without links/);
  const agent = path.join(directory, ".agent");
  fs.mkdirSync(agent);
  const alias = path.join(directory, "workspace-alias");
  fs.symlinkSync(agent, alias);
  await assert.rejects(run("memory_write", { name: "one", content: "data" }, alias), /reserved .agent/);
  assert.deepEqual(fs.readdirSync(agent), []);
});

test("unexpected store entries and excessive entry counts fail closed", async () => {
  const directory = workspace();
  await run("memory_write", { name: "one", content: "data" }, directory);
  const unexpected = path.join(store(directory), "unexpected.txt");
  fs.writeFileSync(unexpected, "data");
  await assert.rejects(run("memory_list", {}, directory), /unexpected file/);
  fs.unlinkSync(unexpected);
  fs.mkdirSync(unexpected);
  await assert.rejects(run("memory_list", {}, directory), /non-file/);
  fs.rmdirSync(unexpected);
  const originalReaddir = fs.readdirSync;
  fs.readdirSync = (() => Array.from({ length: 4097 }, (_, index) => `${index}.md`)) as unknown as typeof fs.readdirSync;
  try {
    await assert.rejects(run("memory_list", {}, directory), /4096 directory entries/);
  } finally {
    fs.readdirSync = originalReaddir;
  }
});

test("frontmatter metadata remains quoted data even with multiline injection text", async () => {
  const directory = workspace();
  const title = 'Title\n---\ncommand: execute\n"\\';
  const description = '!tag &anchor\n---\n世界';
  const content = "Body remains body\n---\n";
  await run("memory_write", { name: "meta", content, title, description }, directory);
  const bytes = fs.readFileSync(path.join(store(directory), "meta.md"), "utf8");
  assert.equal(bytes, `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\n---\n${content}`);
  const read = await run("memory_read", { name: "meta" }, directory);
  assert.equal(read.title, title);
  assert.equal(read.description, description);
  assert.equal(read.content, content);
  assert.deepEqual(Object.keys(read).sort(), ["bytes", "content", "description", "name", "sha256", "title", "truncated"]);
});

test("existing simple frontmatter is inert and unknown fields stay out of metadata", async () => {
  const directory = workspace();
  fs.mkdirSync(store(directory), { recursive: true });
  fs.writeFileSync(path.join(store(directory), "existing.md"), "---\ntitle: Existing\ndescription: 'It''s data'\ncommand: dangerous\n__proto__: {polluted: true}\n---\nbody");
  const read = await run("memory_read", { name: "existing" }, directory);
  assert.equal(read.title, "Existing");
  assert.equal(read.description, "It's data");
  assert.equal(read.content, "body");
  assert.equal(read.command, undefined);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("per-file cap counts encoded UTF-8 bytes including frontmatter", async () => {
  const directory = workspace();
  await assert.rejects(run("memory_write", { name: "too-big", content: "x".repeat(MAX_FILE_BYTES + 1) }, directory), /exceeds/);
  await assert.rejects(run("memory_write", { name: "unicode-big", content: "\u{1F600}".repeat(MAX_FILE_BYTES / 4 + 1) }, directory), /exceeds/);
  await assert.rejects(run("memory_write", { name: "metadata-big", content: "x".repeat(MAX_FILE_BYTES), title: "adds bytes" }, directory), /exceeds/);
  const result = await run("memory_write", { name: "exact", content: "x".repeat(MAX_FILE_BYTES) }, directory);
  assert.equal(result.bytes, MAX_FILE_BYTES);
  assert.equal(fs.statSync(path.join(store(directory), "exact.md")).size, MAX_FILE_BYTES);
});

test("8 MiB aggregate cap allows replacement and deletion to release capacity", async () => {
  const directory = workspace();
  const content = "x".repeat(MAX_FILE_BYTES);
  const documents = [];
  for (const name of ["a", "b", "c", "d"]) documents.push(await run("memory_write", { name, content }, directory));
  assert.equal((await run("memory_list", {}, directory)).total_bytes, 8 * 1024 * 1024);
  await assert.rejects(run("memory_write", { name: "e", content: "x" }, directory), /store exceeds/);
  await run("memory_write", { name: "a", content: "short", expected_sha256: documents[0]!.sha256 }, directory);
  await run("memory_write", { name: "e", content: "x" }, directory);
  await run("memory_delete", { name: "b", expected_sha256: documents[1]!.sha256 }, directory);
  await run("memory_write", { name: "f", content }, directory);
  assert.equal(fs.existsSync(path.join(store(directory), "b.md")), false);
});

test("oversized external files and invalid UTF-8 are rejected during reads", async () => {
  const directory = workspace();
  fs.mkdirSync(store(directory), { recursive: true });
  const target = path.join(store(directory), "external.md");
  fs.writeFileSync(target, Buffer.alloc(MAX_FILE_BYTES + 1));
  await assert.rejects(run("memory_read", { name: "external" }, directory), /exceeds/);
  await assert.rejects(run("memory_list", {}, directory), /exceeds/);
  fs.writeFileSync(target, Buffer.from([0xff, 0xfe]));
  await assert.rejects(run("memory_read", { name: "external" }, directory), /invalid UTF-8/);
});

test("read output stays valid JSON below UTF-8 cap with hash and truncation metadata", async () => {
  const directory = workspace();
  const content = unicode.repeat(500);
  const created = await run("memory_write", { name: "unicode", content }, directory);
  const output = await tools.get("memory_read")!.execute({ name: "unicode" }, context(directory, { maxOutputBytes: 250 }));
  assert.ok(Buffer.byteLength(output) <= 250);
  const result = JSON.parse(output);
  assert.equal(result.sha256, created.sha256);
  assert.equal(result.truncated, true);
  assert.ok(content.startsWith(result.content));
  assert.doesNotMatch(result.content, /�/);
});

test("list cap retains valid sorted metadata and a truncation flag", async () => {
  const directory = workspace();
  for (const name of ["c", "a", "b"]) await run("memory_write", { name, content: "data" }, directory);
  const output = await tools.get("memory_list")!.execute({}, context(directory, { maxOutputBytes: 190 }));
  assert.ok(Buffer.byteLength(output) <= 190);
  const result = JSON.parse(output);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.memories.map((entry: Record<string, unknown>) => entry.name), ["a"]);
  assert.equal(result.total_bytes, 12);
});

test("tiny output budgets reject mutations before publishing or deleting", async () => {
  const directory = workspace();
  await assert.rejects(run("memory_write", { name: "one", content: "data" }, directory, { maxOutputBytes: 1 }), /budget/);
  assert.equal(fs.existsSync(path.join(store(directory), "one.md")), false);
  const first = await run("memory_write", { name: "one", content: "data" }, directory);
  await assert.rejects(run("memory_delete", { name: "one", expected_sha256: first.sha256 }, directory, { maxOutputBytes: 1 }), /budget/);
  assert.equal((await run("memory_read", { name: "one" }, directory)).content, "data");
  assert.deepEqual(fs.readdirSync(store(directory)), ["one.md"]);
});

test("pre-aborted signal prevents reads, writes, deletion and directory creation", async () => {
  const directory = workspace();
  const controller = new AbortController();
  controller.abort();
  for (const [name, input] of [
    ["memory_list", {}], ["memory_read", { name: "one" }],
    ["memory_write", { name: "one", content: "data" }],
    ["memory_delete", { name: "one", expected_sha256: "0".repeat(64) }],
  ] as const) await assert.rejects(run(name, input, directory, { signal: controller.signal }), { name: "AbortError" });
  assert.deepEqual(fs.readdirSync(directory), []);
});

test("failed atomic rename preserves old bytes and cleans temporary/lock files", async () => {
  const directory = workspace();
  const first = await run("memory_write", { name: "one", content: "original" }, directory);
  const originalRename = fs.renameSync;
  fs.renameSync = () => { throw new Error("fixture rename failure"); };
  try {
    await assert.rejects(run("memory_write", { name: "one", content: "replacement", expected_sha256: first.sha256 }, directory), /fixture rename failure/);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal((await run("memory_read", { name: "one" }, directory)).content, "original");
  assert.deepEqual(fs.readdirSync(store(directory)), ["one.md"]);
});
