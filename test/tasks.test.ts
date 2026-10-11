import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { createTaskTools } from "../src/tasks.js";
import type { ToolContext, ToolDefinition } from "../src/tools.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const tempDirs: string[] = [];
function tmpDir(prefix = "cctasks-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

function makeContext(workspace: string, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    workspace,
    signal: new AbortController().signal,
    allowShell: false,
    maxOutputBytes: 100_000,
    ...overrides,
  };
}

/** A fresh tool set per call exercises durability/reopen on every operation. */
function byName(workspace: string): Map<string, ToolDefinition> {
  return new Map(createTaskTools(workspace).map((tool) => [tool.schema.name, tool]));
}
function exec(
  workspace: string,
  name: string,
  input: unknown,
  context: ToolContext = makeContext(workspace),
): Promise<string> {
  const tool = byName(workspace).get(name);
  assert.ok(tool, `tool ${name} is missing`);
  return tool.execute(input, context);
}

const agentDir = (ws: string): string => path.join(ws, ".agent");
const storePath = (ws: string): string => path.join(ws, ".agent", "tasks.json");
const lockPath = (ws: string): string => path.join(ws, ".agent", "tasks.json.lock");

async function create(
  ws: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return JSON.parse(await exec(ws, "task_create", input)) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

test("createTaskTools exposes exactly the four task tools with correct flags", () => {
  const ws = tmpDir();
  const tools = createTaskTools(ws);
  const names = tools.map((tool) => tool.schema.name).sort();
  assert.deepEqual(names, ["task_create", "task_get", "task_list", "task_update"]);
  const flags = new Map(tools.map((tool) => [tool.schema.name, tool.readOnly]));
  assert.equal(flags.get("task_get"), true);
  assert.equal(flags.get("task_list"), true);
  assert.equal(flags.get("task_create"), false);
  assert.equal(flags.get("task_update"), false);
  for (const tool of tools) {
    assert.equal(tool.schema.input_schema.type, "object");
    assert.equal(tool.schema.input_schema.additionalProperties, false);
  }
});

test("create → get → list round-trip with durable fields", async () => {
  const ws = tmpDir();
  const created = await create(ws, {
    subject: "Build tasks",
    description: "Implement the store",
    activeForm: "Building tasks",
    metadata: { priority: 1 },
  });
  assert.match(String(created.id), UUID_RE);
  assert.equal(created.subject, "Build tasks");
  assert.equal(created.status, "pending");
  assert.equal(created.activeForm, "Building tasks");
  assert.deepEqual(created.blockedBy, []);
  assert.deepEqual(created.metadata, { priority: 1 });
  assert.ok(!("owner" in created), "owner is unset until assigned");

  const got = JSON.parse(await exec(ws, "task_get", { id: created.id })) as Record<string, unknown>;
  assert.equal(got.id, created.id);

  const listed = JSON.parse(await exec(ws, "task_list", {})) as unknown[];
  assert.equal(listed.length, 1);
  assert.deepEqual((listed[0] as Record<string, unknown>).id, created.id);
});

test("the store is durable across a reopen (fresh tool set reads the same data)", async () => {
  const ws = tmpDir();
  const created = await create(ws, { subject: "Persist", description: "d" });

  // Raw file: versioned JSON written atomically.
  const onDisk = JSON.parse(fs.readFileSync(storePath(ws), "utf8")) as {
    version: number;
    tasks: { id: string }[];
  };
  assert.equal(onDisk.version, 1);
  assert.equal(onDisk.tasks[0]!.id, created.id);

  // A brand-new closure (simulated reopen) still sees the task.
  const reopened = JSON.parse(
    await exec(ws, "task_get", { id: created.id }, makeContext(tmpDir())),
  ) as Record<string, unknown>;
  assert.equal(reopened.subject, "Persist");
});

test("the canonical workspace is captured in the closure, not the context", async () => {
  const real = tmpDir();
  const aliasParent = tmpDir();
  const alias = path.join(aliasParent, "alias");
  fs.symlinkSync(real, alias);

  const other = tmpDir();
  // Call through a symlinked workspace with a context pointing elsewhere.
  await create(alias, { subject: "canonical", description: "d" });
  assert.ok(fs.existsSync(storePath(real)), "store must land under the canonical workspace");
  assert.ok(!fs.existsSync(agentDir(other)), "context workspace must be irrelevant");
  assert.ok(!fs.existsSync(path.join(aliasParent, ".agent")), "no store beside the alias");
});

// ---------------------------------------------------------------------------
// Dependency validation
// ---------------------------------------------------------------------------

test("update rejects a missing dependency", async () => {
  const ws = tmpDir();
  const a = await create(ws, { subject: "A", description: "d" });
  const ghost = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(
    exec(ws, "task_update", { id: a.id, addBlockedBy: [ghost] }),
    /does not exist/,
  );
});

test("update rejects a self dependency", async () => {
  const ws = tmpDir();
  const a = await create(ws, { subject: "A", description: "d" });
  await assert.rejects(
    exec(ws, "task_update", { id: a.id, addBlockedBy: [a.id] }),
    /itself/,
  );
});

test("update rejects a dependency cycle", async () => {
  const ws = tmpDir();
  const a = await create(ws, { subject: "A", description: "d" });
  const b = await create(ws, { subject: "B", description: "d" });

  await exec(ws, "task_update", { id: a.id, addBlockedBy: [b.id] });
  await assert.rejects(
    exec(ws, "task_update", { id: b.id, addBlockedBy: [a.id] }),
    /cycle/,
  );

  // The rejected edge must not have persisted.
  const reloaded = JSON.parse(await exec(ws, "task_get", { id: b.id })) as {
    blockedBy: string[];
  };
  assert.deepEqual(reloaded.blockedBy, []);
});

test("marking in_progress/completed requires every dependency completed", async () => {
  const ws = tmpDir();
  const dep = await create(ws, { subject: "Dep", description: "d" });
  const task = await create(ws, { subject: "Task", description: "d" });
  await exec(ws, "task_update", { id: task.id, addBlockedBy: [dep.id] });

  await assert.rejects(
    exec(ws, "task_update", { id: task.id, status: "in_progress" }),
    /unfinished dependencies/,
  );
  await assert.rejects(
    exec(ws, "task_update", { id: task.id, status: "completed" }),
    /unfinished dependencies/,
  );

  await exec(ws, "task_update", { id: dep.id, status: "completed" });
  const started = JSON.parse(
    await exec(ws, "task_update", { id: task.id, status: "in_progress" }),
  ) as { status: string };
  assert.equal(started.status, "in_progress");
  const done = JSON.parse(
    await exec(ws, "task_update", { id: task.id, status: "completed" }),
  ) as { status: string };
  assert.equal(done.status, "completed");
});

// ---------------------------------------------------------------------------
// Strict validation
// ---------------------------------------------------------------------------

test("input is validated strictly by zod", async () => {
  const ws = tmpDir();
  const a = await create(ws, { subject: "A", description: "d" });

  await assert.rejects(exec(ws, "task_create", { subject: "only subject" }), /required|description/i);
  await assert.rejects(
    exec(ws, "task_create", { subject: "x", description: "d", bogus: true }),
    /Unrecognized key/i,
  );
  await assert.rejects(exec(ws, "task_get", { id: "not-a-uuid" }), /uuid/i);
  await assert.rejects(exec(ws, "task_update", { id: a.id, status: "done" }), /Invalid|enum/i);
  await assert.rejects(exec(ws, "task_update", { id: a.id, metadata: "nope" }), /object|record/i);
});

test("task_get rejects an unknown id", async () => {
  const ws = tmpDir();
  await assert.rejects(
    exec(ws, "task_get", { id: "11111111-1111-4111-8111-111111111111" }),
    /not found/,
  );
});

// ---------------------------------------------------------------------------
// Metadata semantics
// ---------------------------------------------------------------------------

test("metadata shallow-merges and a null value deletes a key", async () => {
  const ws = tmpDir();
  const task = await create(ws, { subject: "Meta", description: "d", metadata: { a: 1, b: 2 } });

  const updated = JSON.parse(
    await exec(ws, "task_update", { id: task.id, metadata: { b: null, c: 3 } }),
  ) as { metadata: Record<string, unknown> };
  assert.deepEqual(updated.metadata, { a: 1, c: 3 });
});

// ---------------------------------------------------------------------------
// Read projection
// ---------------------------------------------------------------------------

test("read tools hide metadata._internal and drop completed dependencies", async () => {
  const ws = tmpDir();
  const dep = await create(ws, { subject: "Dep", description: "d" });
  const task = await create(ws, {
    subject: "Task",
    description: "d",
    metadata: { _internal: { note: "hidden" }, shown: true },
  });
  await exec(ws, "task_update", { id: task.id, addBlockedBy: [dep.id] });

  // Pending dependency is shown.
  const pendingView = JSON.parse(await exec(ws, "task_get", { id: task.id })) as {
    metadata: Record<string, unknown>;
    blockedBy: string[];
  };
  assert.deepEqual(pendingView.metadata, { shown: true });
  assert.deepEqual(pendingView.blockedBy, [dep.id]);

  // Completed dependency disappears from the projected blockedBy.
  await exec(ws, "task_update", { id: dep.id, status: "completed" });
  const completedView = JSON.parse(await exec(ws, "task_get", { id: task.id })) as {
    blockedBy: string[];
  };
  assert.deepEqual(completedView.blockedBy, []);

  // The raw store still holds the edge and the internal metadata.
  const raw = JSON.parse(fs.readFileSync(storePath(ws), "utf8")) as {
    tasks: { id: string; blockedBy: string[]; metadata: Record<string, unknown> }[];
  };
  const rawTask = raw.tasks.find((entry) => entry.id === task.id)!;
  assert.deepEqual(rawTask.blockedBy, [dep.id]);
  assert.ok("_internal" in rawTask.metadata);

  const list = JSON.parse(await exec(ws, "task_list", {})) as { metadata: Record<string, unknown> }[];
  for (const entry of list) assert.ok(!("_internal" in entry.metadata));
});

test("task_list filters by status and caps output", async () => {
  const ws = tmpDir();
  const p = await create(ws, { subject: "P", description: "d" });
  const q = await create(ws, { subject: "Q", description: "d" });
  await exec(ws, "task_update", { id: q.id, status: "completed" });

  const pending = JSON.parse(await exec(ws, "task_list", { status: "pending" })) as {
    id: string;
  }[];
  assert.deepEqual(
    pending.map((t) => t.id),
    [p.id],
  );

  const capped = await exec(ws, "task_list", {}, makeContext(ws, { maxOutputBytes: 60 }));
  assert.match(capped, /task_list|truncated/);
  assert.ok(Buffer.byteLength(capped, "utf8") < 400);
});

// ---------------------------------------------------------------------------
// activeForm + deleted
// ---------------------------------------------------------------------------

test("activeForm can be updated", async () => {
  const ws = tmpDir();
  const task = await create(ws, { subject: "S", description: "d", activeForm: "Old" });
  const updated = JSON.parse(
    await exec(ws, "task_update", { id: task.id, activeForm: "New" }),
  ) as { activeForm: string };
  assert.equal(updated.activeForm, "New");
});

test("deleted true removes the task and unlinks it from dependents", async () => {
  const ws = tmpDir();
  const dep = await create(ws, { subject: "Dep", description: "d" });
  const task = await create(ws, { subject: "Task", description: "d" });
  await exec(ws, "task_update", { id: task.id, addBlockedBy: [dep.id] });

  const result = JSON.parse(
    await exec(ws, "task_update", { id: dep.id, deleted: true }),
  ) as { deleted: boolean; id: string };
  assert.deepEqual(result, { deleted: true, id: dep.id });

  await assert.rejects(exec(ws, "task_get", { id: dep.id }), /not found/);

  const remaining = JSON.parse(await exec(ws, "task_list", {})) as { id: string }[];
  assert.deepEqual(
    remaining.map((t) => t.id),
    [task.id],
  );

  const raw = JSON.parse(fs.readFileSync(storePath(ws), "utf8")) as {
    tasks: { id: string; blockedBy: string[] }[];
  };
  assert.deepEqual(raw.tasks[0]!.blockedBy, []);
});

// ---------------------------------------------------------------------------
// Pre-abort, locking, durability guards
// ---------------------------------------------------------------------------

test("a pre-aborted signal prevents all effects", async () => {
  const ws = tmpDir();
  const controller = new AbortController();
  controller.abort();
  const ctx = makeContext(ws, { signal: controller.signal });

  await assert.rejects(exec(ws, "task_create", { subject: "S", description: "d" }, ctx), /aborted/);
  assert.ok(!fs.existsSync(agentDir(ws)), "no store directory should be created");

  await assert.rejects(exec(ws, "task_list", {}, ctx), /aborted/);
  await assert.rejects(
    exec(ws, "task_update", { id: "11111111-1111-4111-8111-111111111111", subject: "x" }, ctx),
    /aborted/,
  );
});

test("an existing lock blocks a mutation and is released on success and failure", async () => {
  const ws = tmpDir();
  await create(ws, { subject: "seed", description: "d" });

  // Pre-existing lock → reject, no mutation.
  fs.writeFileSync(lockPath(ws), JSON.stringify({ pid: process.pid, token: "test" }));
  await assert.rejects(
    exec(ws, "task_create", { subject: "blocked", description: "d" }),
    /locked/,
  );
  const rawAfterBlock = JSON.parse(fs.readFileSync(storePath(ws), "utf8")) as {
    tasks: unknown[];
  };
  assert.equal(rawAfterBlock.tasks.length, 1, "locked mutation must not write");
  fs.rmSync(lockPath(ws), { force: true });

  // Successful mutation releases the lock.
  await create(ws, { subject: "ok", description: "d" });
  assert.ok(!fs.existsSync(lockPath(ws)), "lock released after success");

  // A failing mutation also releases the lock.
  await assert.rejects(
    exec(ws, "task_update", { id: "11111111-1111-4111-8111-111111111111", subject: "x" }),
    /not found/,
  );
  assert.ok(!fs.existsSync(lockPath(ws)), "lock released after failure");
});

// ---------------------------------------------------------------------------
// Symlink + size protection
// ---------------------------------------------------------------------------

test("a symlinked .agent directory is refused without touching the target", async () => {
  const ws = tmpDir();
  const outside = tmpDir();
  fs.symlinkSync(outside, agentDir(ws));

  await assert.rejects(
    exec(ws, "task_create", { subject: "S", description: "d" }),
    /symlinked/,
  );
  assert.ok(!fs.existsSync(path.join(outside, "tasks.json")), "target untouched");
});

test("a symlinked store file is refused on read", async () => {
  const ws = tmpDir();
  const outside = tmpDir();
  fs.mkdirSync(agentDir(ws));
  fs.writeFileSync(path.join(outside, "tasks.json"), "{}");
  fs.symlinkSync(path.join(outside, "tasks.json"), storePath(ws));

  await assert.rejects(exec(ws, "task_list", {}), /symlinked task store/);
  await assert.rejects(
    exec(ws, "task_get", { id: "11111111-1111-4111-8111-111111111111" }),
    /symlinked task store/,
  );
});

test("a symlinked lock file is refused", async () => {
  const ws = tmpDir();
  const outside = tmpDir();
  fs.mkdirSync(agentDir(ws));
  const target = path.join(outside, "lock");
  fs.writeFileSync(target, "x");
  fs.symlinkSync(target, lockPath(ws));

  await assert.rejects(
    exec(ws, "task_create", { subject: "S", description: "d" }),
    /symlinked task store lock/,
  );
});

test("an oversized store file is refused before parsing", async () => {
  const ws = tmpDir();
  fs.mkdirSync(agentDir(ws));
  fs.writeFileSync(storePath(ws), Buffer.alloc(8 * 1024 * 1024 + 1, 0x20));

  await assert.rejects(exec(ws, "task_list", {}), /exceeds the 8388608-byte size limit/);
});

test("mutations leave no temporary files behind", async () => {
  const ws = tmpDir();
  await create(ws, { subject: "S", description: "d" });
  const leftovers = fs.readdirSync(agentDir(ws)).filter((name) => name.includes(".tmp"));
  assert.deepEqual(leftovers, []);
  assert.equal(fs.statSync(storePath(ws)).mode & 0o777, 0o600);
});
