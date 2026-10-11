import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { defaultConfig } from "../src/agent.js";
import { AgentRegistry } from "../src/agent-registry.js";
import type { ModelProvider } from "../src/provider.js";
import { fingerprint } from "../src/session.js";
import { createTools } from "../src/tools.js";
import { createWorkflowTools, WorkflowRegistry } from "../src/workflow.js";
import { WorkflowStore, workflowDefinitionSchema, workflowDigest, workflowInputDigest } from "../src/workflow-store.js";

const response = (text: string) => ({ id: "fixture", model: "test", type: "message", role: "assistant",
  content: [{ type: "text", text }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }) as Anthropic.Message;
function fixture() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "workflow-resume-")));
  const owner = randomUUID(); const tools = createTools(); const config = defaultConfig(workspace, tools); config.model = "test";
  const registries: WorkflowRegistry[] = []; const children: AgentRegistry[] = [];
  const make = (complete: ModelProvider["complete"], settingsDigest = fingerprint(config), own = owner) => {
    const agents = new AgentRegistry({ source: config, tools, provider: { count: async () => 0, complete } });
    const workflows = new WorkflowRegistry({ agents, workspace, owner: own, settingsDigest });
    registries.push(workflows); children.push(agents); return { agents, workflows };
  };
  return { workspace, owner, make, async cleanup() {
    await Promise.all(registries.map(item => item.close())); await Promise.all(children.map(item => item.close()));
    fs.rmSync(workspace, { recursive: true, force: true });
  } };
}

test("reopen reuses completed DAG tasks, reruns failures/skips and rejects changed definitions/settings/owner", async () => {
  const f = fixture(); const seen: string[] = [];
  const input = { tasks: [{ id: "ok", prompt: "success" }, { id: "fail", prompt: "failure", depends_on: ["ok"] },
    { id: "later", prompt: "downstream", depends_on: ["fail"] }], max_parallel: 1 };
  const first = f.make(async request => {
    const prompt = String(request.messages.at(-1)?.content); seen.push(prompt);
    if (prompt.startsWith("failure")) throw new Error("fixture failure"); return response("cached success");
  });
  try {
    const original = await first.workflows.run(input);
    assert.deepEqual(original.tasks.map(task => task.status), ["completed", "failed", "skipped"]);
    await first.workflows.close(); await first.agents.close();
    const changed = f.make(async () => response("wrong"), workflowDigest("changed settings"));
    await assert.rejects(changed.workflows.run({ ...input, resume_from: original.id }), /identical/);
    await changed.workflows.close();
    const next = f.make(async request => { seen.push(String(request.messages.at(-1)?.content)); return response("new output"); });
    const before = seen.length;
    await assert.rejects(next.workflows.run({ ...input, resume_from: original.id, tasks: [{ ...input.tasks[0]!, model: "changed" }, ...input.tasks.slice(1)] }), /identical/);
    const outsider = f.make(async () => response("wrong"), undefined, randomUUID());
    await assert.rejects(outsider.workflows.get(original.id));
    assert.equal(seen.length, before);
    const resumed = await next.workflows.run({ ...input, resume_from: original.id });
    assert.equal(resumed.status, "completed"); assert.notEqual(resumed.id, original.id);
    assert.equal(resumed.resume_from, original.id); assert.deepEqual(resumed.reused_tasks, ["ok"]);
    assert.equal(resumed.tasks[0]?.session_id, original.tasks[0]?.session_id);
    assert.equal(seen.length - before, 2); assert.match(seen[before]!, /cached success/);
    assert.deepEqual(next.agents.list().map(item => item.session_id), resumed.tasks.slice(1).map(item => item.session_id));
    const raw = fs.readFileSync(path.join(f.workspace, ".agent", "workflows", f.owner, `${original.id}.json`), "utf8");
    assert.equal(raw.includes("messages"), false); assert.equal(raw.includes("gateway"), false);
  } finally { await f.cleanup(); }
});

test("dead PID locks recover, live owners exclude writers, interrupted effects require explicit retry, corrupt and escaped snapshots fail", async () => {
  const f = fixture(); const registry = f.make(async () => response("done"));
  try {
    const original = await registry.workflows.run({ tasks: [{ id: "a", prompt: "work" }] });
    const directory = path.join(f.workspace, ".agent", "workflows", f.owner);
    const contender = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
      `import { WorkflowStore } from ${JSON.stringify(new URL("../src/workflow-store.ts", import.meta.url).href)};
       const store = new WorkflowStore(process.argv[1], process.argv[2]);
       try { store.load(process.argv[3]); process.exitCode = 2; }
       catch (error) { if (!/active in process/.test(error.message)) throw error; }
       finally { store.close(); }`, f.workspace, f.owner, original.id],
    { cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8" });
    assert.equal(contender.status, 0, contender.stderr);
    const exclusive = new WorkflowStore(f.workspace, f.owner);
    assert.throws(() => exclusive.load(original.id), /active/); exclusive.close();
    await registry.workflows.close(); await registry.agents.close();
    const file = path.join(directory, `${original.id}.json`);
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    raw.view.status = "running"; raw.view.ended_at = null; raw.view.tasks[0].status = "running";
    raw.view.tasks[0].summary = "";
    const { snapshot_digest: _old, ...content } = raw; raw.snapshot_digest = workflowDigest(content);
    fs.writeFileSync(file, JSON.stringify(raw));
    const dead = Number(spawnSync("/bin/sh", ["-c", "printf %s $$"], { encoding: "utf8" }).stdout);
    assert.ok(dead > 0); fs.writeFileSync(path.join(directory, "owner.lock"), JSON.stringify({ pid: dead, token: randomUUID() }));
    const recovery = path.join(directory, "owner.lock.recovery");
    fs.writeFileSync(recovery, JSON.stringify({ pid: process.pid, token: randomUUID() }));
    const guardProbe = new WorkflowStore(f.workspace, f.owner);
    assert.throws(() => guardProbe.load(original.id), /recovery is active/);
    guardProbe.close();
    fs.writeFileSync(recovery, JSON.stringify({ pid: dead, token: randomUUID() }));
    let calls = 0; const next = f.make(async () => { calls++; return response("retried"); });
    assert.equal((await next.workflows.get(original.id)).tasks[0]?.status, "running");
    assert.equal(fs.existsSync(recovery), false);
    assert.equal(fs.readdirSync(directory).some(name => name.endsWith(".claim")), false);
    await assert.rejects(next.workflows.run({ tasks: [{ id: "a", prompt: "work" }], resume_from: original.id }), /retry_interrupted: true/);
    assert.equal(calls, 0);
    const resumed = await next.workflows.run({ tasks: [{ id: "a", prompt: "work" }], resume_from: original.id, retry_interrupted: true });
    assert.equal(resumed.status, "completed"); assert.equal(calls, 1);
    fs.writeFileSync(file, "{broken");
    await assert.rejects(next.workflows.run({ tasks: [{ id: "a", prompt: "work" }], resume_from: original.id }));
    const target = path.join(f.workspace, "outside.json"); fs.writeFileSync(target, "{}");
    const escaped = randomUUID(); fs.symlinkSync(target, path.join(directory, `${escaped}.json`));
    await assert.rejects(next.workflows.get(escaped));
    const bounded = new WorkflowStore(f.workspace, randomUUID(), { maxSnapshotBytes: 8 });
    const definition = workflowDefinitionSchema.parse({ tasks: [{ id: "a", prompt: "work" }] });
    assert.throws(() => bounded.save(definition, workflowDigest("settings"), { ...original,
      persistence: { owner: bounded.owner, input_digest: workflowInputDigest(definition, workflowDigest("settings")), limitations: [] } }), /byte limit/);
    bounded.close();
  } finally { await f.cleanup(); }
});

test("persistence errors cancel current owned children, surface actionable failure and ephemeral schemas remain compatible", async t => {
  const f = fixture(); let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const next = f.make(async (_request, signal) => {
    started(); await new Promise<void>((_resolve, reject) => {
      if (signal.aborted) reject(signal.reason);
      else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }); return response("done");
  });
  const save = WorkflowStore.prototype.save; let writes = 0;
  t.mock.method(WorkflowStore.prototype, "save", function(this: WorkflowStore, ...args: Parameters<WorkflowStore["save"]>) {
    if (++writes === 4) throw new Error("fixture disk failure");
    return save.apply(this, args);
  });
  try {
    const sibling = await next.agents.launch({ prompt: "sibling", background: true }); await entered;
    await assert.rejects(next.workflows.run({ tasks: [{ id: "a", prompt: "hold" }, { id: "b", prompt: "later" }], max_parallel: 2 }), /persistence failed.*disk failure/);
    const children = next.agents.list().filter(item => item.id !== sibling.id);
    assert.equal(children.length, 2); assert.ok(children.every(item => item.status === "cancelled"));
    assert.equal((await next.agents.get(sibling.id)).status, "running");
    await next.agents.stop(sibling.id); t.mock.restoreAll();
    const ephemeral = new WorkflowRegistry({ agents: next.agents });
    assert.equal(Object.hasOwn(createWorkflowTools(ephemeral)[0]!.schema.input_schema.properties ?? {}, "resume_from"), false);
    assert.ok(Object.hasOwn(createWorkflowTools(ephemeral, { persistent: true })[0]!.schema.input_schema.properties ?? {}, "resume_from"));
    await assert.rejects(ephemeral.run({ tasks: [{ id: "a", prompt: "work" }], resume_from: randomUUID() }), /workspace/);
    await ephemeral.close();
  } finally { t.mock.restoreAll(); await f.cleanup(); }
});
