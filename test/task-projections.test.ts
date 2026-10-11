import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { createTaskTools } from "../src/tasks.js";
import type { ToolContext } from "../src/tools.js";

function fixture() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "task-projections-")));
  const context: ToolContext = {
    workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 100_000,
  };
  const store = path.join(workspace, ".agent", "tasks.json");
  const execute = (name: string, input: unknown, reciprocal?: boolean) => {
    const tool = createTaskTools(workspace, reciprocal === undefined ? undefined : { reciprocal })
      .find((tool) => tool.schema.name === name)!;
    return tool.execute(input, context);
  };
  const call = async (name: string, input: unknown, reciprocal?: boolean) =>
    JSON.parse(await execute(name, input, reciprocal));
  return { workspace, store, execute, call,
    cleanup: () => fs.rmSync(workspace, { recursive: true, force: true }) };
}

test("legacy schemas and JSON stay exact when reciprocal projections are absent or false", async () => {
  const f = fixture();
  try {
    const hashes = [
      "98d871e2196210a3d7a2c848507e22bd959d754510ec4924ed28f996ed94e0f3",
      "089a3f649e3e94ea2fdb2f91af6de3b9bac3f713b4d4355ba8633d012cf586e8",
      "8fb784877a1dc99e339f8907a5bdc5789ffce83b0d7823ca09cd60a62c7992c4",
      "ae659d5be93794121607144b6a28353923c57233864a91fccc9f82eeb719fd43",
    ];
    for (const options of [undefined, {}, { reciprocal: false }]) {
      assert.deepEqual(createTaskTools(f.workspace, options).map((tool) =>
        crypto.createHash("sha256").update(JSON.stringify(tool.schema)).digest("hex")), hashes);
    }
    const a = await f.call("task_create", { subject: "A", description: "d" });
    const b = await f.call("task_create", { subject: "B", description: "d",
      metadata: { _internal: "hidden", shown: true } });
    await f.call("task_update", { id: b.id, addBlockedBy: [a.id] });
    await f.call("task_update", { id: a.id, status: "completed" });
    const viewA = { ...a, status: "completed" };
    const viewB = { ...b, metadata: { shown: true } };
    for (const reciprocal of [undefined, false]) {
      assert.equal(await f.execute("task_get", { id: a.id }, reciprocal), JSON.stringify(viewA, null, 2));
      assert.equal(await f.execute("task_get", { id: b.id }, reciprocal), JSON.stringify(viewB, null, 2));
      assert.equal(await f.execute("task_list", {}, reciprocal), JSON.stringify([viewA, viewB], null, 2));
      await assert.rejects(f.execute("task_update", { id: a.id, addBlocks: [b.id] }, reciprocal), /Unrecognized key/);
      await assert.rejects(f.execute("task_update", { id: a.id, removeBlocks: [b.id] }, reciprocal), /Unrecognized key/);
    }
    const raw = JSON.parse(fs.readFileSync(f.store, "utf8"));
    assert.equal(raw.version, 1);
    assert.deepEqual(raw.tasks[1].blockedBy, [a.id]);
    assert.deepEqual(raw.tasks.map((task: { id: string }) => task.id), [a.id, b.id]);
  } finally { f.cleanup(); }
});

test("reciprocal edges derive durable projections and commit graph edits atomically", async () => {
  const f = fixture();
  const call = (name: string, input: unknown) => f.call(name, input, true);
  const rejectsUnchanged = async (input: unknown, expected: RegExp) => {
    const before = fs.readFileSync(f.store, "utf8");
    await assert.rejects(f.execute("task_update", input, true), expected);
    assert.equal(fs.readFileSync(f.store, "utf8"), before);
    assert.equal(fs.existsSync(f.store + ".lock"), false);
  };
  try {
    const tools = createTaskTools(f.workspace, { reciprocal: true });
    const update = tools.find((tool) => tool.schema.name === "task_update")!.schema.input_schema;
    assert.deepEqual(update.required, ["id"]);
    assert.equal(update.additionalProperties, false);
    assert.deepEqual(Object.keys(update.properties!).slice(-2), ["addBlocks", "removeBlocks"]);
    const a = await call("task_create", { subject: "A", description: "d" });
    const b = await call("task_create", { subject: "B", description: "d", metadata: { _internal: true } });
    const c = await call("task_create", { subject: "C", description: "d" });
    assert.equal("ready" in a, false);
    assert.equal("blocks" in a, false);
    assert.equal((await call("task_get", { id: b.id })).ready, true);
    await call("task_update", { id: a.id, addBlocks: [b.id, b.id] });
    await call("task_update", { id: c.id, addBlockedBy: [a.id] });
    assert.deepEqual((await call("task_get", { id: a.id })).blocks, [b.id, c.id]);
    assert.deepEqual((await call("task_get", { id: b.id })).blockedBy, [a.id]);
    assert.equal((await call("task_get", { id: b.id })).ready, false);
    await rejectsUnchanged({ id: b.id, subject: "rollback", addBlocks: [c.id, a.id] }, /cycle/);
    await rejectsUnchanged({ id: a.id, addBlocks: [c.id, crypto.randomUUID()] }, /not found/);
    await rejectsUnchanged({ id: a.id, addBlocks: [a.id] }, /itself/);
    await rejectsUnchanged({ id: a.id, addBlocks: ["1"] }, /uuid/i);
    await call("task_update", { id: a.id, removeBlocks: [c.id] });
    assert.deepEqual((await call("task_get", { id: a.id })).blocks, [b.id]);
    assert.equal((await call("task_get", { id: c.id })).ready, true);
    await call("task_update", { id: c.id, status: "completed" });
    await rejectsUnchanged({ id: a.id, addBlocks: [c.id] }, /unfinished dependencies/);
    fs.writeFileSync(f.store + ".lock", "existing lock");
    const beforeLock = fs.readFileSync(f.store, "utf8");
    await assert.rejects(f.execute("task_update", { id: a.id, removeBlocks: [b.id] }, true), /locked/);
    assert.equal(fs.readFileSync(f.store, "utf8"), beforeLock);
    fs.rmSync(f.store + ".lock");
    await call("task_update", { id: a.id, status: "completed" });
    const pending = await call("task_list", { status: "pending" });
    assert.deepEqual(pending.map((task: { id: string }) => task.id), [b.id]);
    assert.equal(pending[0].ready, true);
    assert.deepEqual(pending[0].blockedBy, []);
    assert.deepEqual(pending[0].metadata, {});
    assert.deepEqual((await call("task_get", { id: a.id })).blocks, [b.id]);
    assert.equal((await call("task_get", { id: a.id })).ready, false);
    await call("task_update", { id: b.id, status: "in_progress" });
    assert.equal((await call("task_get", { id: b.id })).ready, false);
    await call("task_update", { id: b.id, status: "completed" });
    assert.equal((await call("task_get", { id: b.id })).ready, false);
    const raw = JSON.parse(fs.readFileSync(f.store, "utf8"));
    assert.deepEqual(raw.tasks[1].blockedBy, [a.id]);
    for (const task of raw.tasks) {
      assert.equal("blocks" in task, false);
      assert.equal("ready" in task, false);
    }
    assert.deepEqual(await call("task_update", { id: b.id, deleted: true }), { deleted: true, id: b.id });
    assert.deepEqual((await call("task_get", { id: a.id })).blocks, []);
    await call("task_update", { id: c.id, status: "pending", addBlockedBy: [a.id] });
    await call("task_update", { id: a.id, deleted: true });
    assert.deepEqual((await call("task_get", { id: c.id })).blockedBy, []);
    assert.equal((await call("task_get", { id: c.id })).ready, true);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.store, "utf8")).tasks[0].blockedBy, []);
  } finally { f.cleanup(); }
});
