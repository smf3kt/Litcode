import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "task-projections-cli-")));
const store = path.join(workspace, ".agent", "tasks.json");
let a, b, beforeCycle, child, failure;
let step = 0;
const raw = () => fs.readFileSync(store, "utf8");
const plan = [
  { name: "task_create", input: () => ({ subject: "A", description: "Blocker" }),
    check: task => { a = task.id; assert.match(a, /^[a-f0-9-]{36}$/); assert.equal("ready" in task, false); } },
  { name: "task_create", input: () => ({ subject: "B", description: "Dependent" }),
    check: task => { b = task.id; assert.notEqual(a, b); } },
  { name: "task_update", input: () => ({ id: a, addBlocks: [b] }), check: task => {
    assert.equal(task.id, a);
    const disk = JSON.parse(raw()); assert.equal(disk.version, 1);
    assert.deepEqual(disk.tasks.find(task => task.id === b).blockedBy, [a]);
    assert.ok(disk.tasks.every(task => !("blocks" in task) && !("ready" in task)));
  } },
  { name: "task_list", input: () => ({}), check: tasks => {
    assert.deepEqual(tasks.map(task => task.id), [a, b]);
    assert.deepEqual(tasks[0].blocks, [b]); assert.equal(tasks[0].ready, true);
    assert.deepEqual(tasks[1].blockedBy, [a]); assert.equal(tasks[1].ready, false);
    beforeCycle = raw();
  } },
  { name: "task_update", input: () => ({ id: b, addBlocks: [a], subject: "Rollback" }), error: /cycle/,
    check: () => { assert.equal(raw(), beforeCycle); assert.equal(fs.existsSync(store + ".lock"), false); } },
  { name: "task_update", input: () => ({ id: a, status: "completed" }), check: task => assert.equal(task.status, "completed") },
  { name: "task_get", input: () => ({ id: b }), check: task => {
    assert.deepEqual(task.blockedBy, []); assert.deepEqual(task.blocks, []); assert.equal(task.ready, true);
    assert.equal(task.subject, "B");
  } },
  { name: "task_get", input: () => ({ id: a }), check: task => {
    assert.deepEqual(task.blocks, [b]); assert.equal(task.ready, false);
    assert.deepEqual(JSON.parse(raw()).tasks.find(task => task.id === b).blockedBy, [a]);
  } },
  { name: "task_list", input: () => ({ status: "pending" }), check: tasks => {
    assert.deepEqual(tasks.map(task => task.id), [b]); assert.equal(tasks[0].ready, true);
  } },
  { name: "task_update", input: () => ({ id: a, deleted: true }), check: result => {
    assert.deepEqual(result, { deleted: true, id: a });
    assert.deepEqual(JSON.parse(raw()).tasks[0].blockedBy, []);
  } },
  { name: "task_get", input: () => ({ id: b }), check: task => {
    assert.equal(task.ready, true); assert.deepEqual(task.blockedBy, []); assert.deepEqual(task.blocks, []);
  } },
  { name: "task_update", input: () => ({ id: b, status: "completed" }), check: task => assert.equal(task.status, "completed") },
  { name: "task_get", input: () => ({ id: b }), check: task => assert.equal(task.ready, false) },
  { name: "task_update", input: () => ({ id: b, deleted: true }), check: result => assert.equal(result.deleted, true) },
  { name: "task_list", input: () => ({}), check: tasks => assert.deepEqual(tasks, []) },
];

const server = http.createServer((req, res) => {
  const chunks = []; let bytes = 0;
  req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks));
      const update = body.tools.find(tool => tool.name === "task_update");
      assert.ok(update.input_schema.properties.addBlocks);
      assert.ok(update.input_schema.properties.removeBlocks);
      assert.deepEqual(update.input_schema.required, ["id"]);
      const last = body.messages.at(-1);
      const result = Array.isArray(last.content) && last.content.find(block => block.type === "tool_result");
      if (result) {
        const prior = plan[step - 1];
        if (prior.error) { assert.equal(result.is_error, true); assert.match(String(result.content), prior.error); prior.check(); }
        else { assert.ok(!result.is_error, String(result.content)); prior.check(JSON.parse(result.content)); }
      }
      const operation = plan[step];
      const block = operation ? { type: "tool_use", id: `task-${step++}`, name: operation.name, input: operation.input() }
        : { type: "text", text: "Task projections smoke passed" };
      const events = [
        { type: "message_start", message: { id: "smoke", type: "message", role: "assistant", model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: operation ? { ...block, input: {} } : { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: operation ? { type: "input_json_delta", partial_json: JSON.stringify(block.input) }
          : { type: "text_delta", text: block.text } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: operation ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    } catch (error) {
      failure ??= error;
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: error.message } }));
    }
  });
});

try {
  fs.mkdirSync(path.join(workspace, "user"));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  child = spawn(process.execPath, ["--import", "tsx", path.join(root, "src/cli.ts"), "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--max-turns", "25", "--allow-tool", "task_*", "Exercise task projections"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "local-task-smoke-key",
      LLM_MODEL: "smoke/tasks", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer",
      LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" },
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64_000); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64_000); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`CLI deadline: ${stderr}`)); }, 20_000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); child = undefined;
      if (failure) reject(failure);
      else if (code === 0) resolve();
      else reject(new Error(`CLI exited ${code}: ${stderr}`));
    });
  });
  assert.match(stdout, /Task projections smoke passed/);
  assert.match(stderr, /finished: end_turn/);
  assert.equal(step, plan.length);
  assert.deepEqual(JSON.parse(raw()).tasks, []);
  assert.equal(fs.existsSync(store + ".lock"), false);
  const owner = stderr.match(/session: ([a-f0-9-]+)/)[1];
  const header = JSON.parse(fs.readFileSync(path.join(workspace, ".agent", `${owner}.jsonl`), "utf8").split("\n")[0]);
  assert.equal(header.config.features.taskProjections, true);
  console.log(JSON.stringify({ cliTaskProjections: "passed", operations: step, reciprocalEdges: true,
    readyAfterCompletion: true, cycleRollback: true, deletionConsistency: true, UUIDStoreVersion: 1,
    gateway: "owned loopback SSE" }));
} finally {
  if (child) {
    const exited = new Promise(resolve => child.once("close", resolve));
    child.kill("SIGKILL"); await exited;
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(workspace, { recursive: true, force: true });
}
