import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "workflow-cli-smoke-")));
const input = { tasks: [{ id: "a", prompt: "workflow child A" },
  { id: "b", prompt: "workflow child B", depends_on: ["a"] }], max_parallel: 1, timeout_ms: 10_000 };
const results = []; const childPrompts = []; let attempt = 1; let processHandle;
const server = http.createServer((req, res) => {
  const chunks = []; let bytes = 0;
  req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
  req.on("end", () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks)); const last = body.messages.at(-1);
      const text = typeof last.content === "string" ? last.content : last.content.filter(block => block.type === "text").map(block => block.text).join("\n");
      const child = JSON.stringify(body.system).includes("You are a child agent assigned a focused task");
      let blocks, reason;
      if (child) {
        childPrompts.push(text); blocks = [{ type: "text", text: text.startsWith("workflow child A") ? "CLI durable A output" : "CLI B output" }];
        reason = attempt === 1 && text.startsWith("workflow child B") ? "max_tokens" : "end_turn";
      } else if (Array.isArray(last.content) && last.content.some(block => block.type === "tool_result")) {
        const result = last.content.find(block => block.type === "tool_result");
        if (result.is_error) throw new Error(String(result.content));
        results.push(JSON.parse(result.content)); blocks = [{ type: "text", text: "CLI workflow finished" }]; reason = "end_turn";
      } else {
        assert.ok(body.tools.some(tool => tool.name === "workflow_run" && tool.input_schema.properties.resume_from));
        blocks = [{ type: "tool_use", id: `workflow-${attempt}`, name: "workflow_run",
          input: { ...input, ...(attempt === 2 ? { resume_from: results[0].id } : {}) } }]; reason = "tool_use";
      }
      const events = [{ type: "message_start", message: { id: "smoke", type: "message", role: "assistant", model: body.model,
        content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }];
      for (const [index, block] of blocks.entries()) {
        events.push({ type: "content_block_start", index, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } });
        events.push({ type: "content_block_delta", index, delta: block.type === "text" ? { type: "text_delta", text: block.text }
          : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
        events.push({ type: "content_block_stop", index });
      }
      events.push({ type: "message_delta", delta: { stop_reason: reason, stop_sequence: null }, usage: { output_tokens: 5 } }, { type: "message_stop" });
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    } catch (error) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: error.message } }));
    }
  });
});
async function cli(args) {
  const child = spawn(process.execPath, ["--import", "tsx", path.join(root, "src/cli.ts"), "--workspace", workspace, ...args], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "local-workflow-smoke-key",
      LLM_MODEL: "smoke/workflow", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" },
  });
  processHandle = child; let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64_000); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64_000); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`CLI deadline: ${stderr}`)); }, 15_000);
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); processHandle = undefined;
      if (code === 0) resolve(); else reject(new Error(`CLI exited ${code}: ${stderr}`)); });
  });
  assert.match(stdout, /CLI workflow finished/); assert.match(stderr, /finished: end_turn/);
  return stderr.match(/session: ([a-f0-9-]+)/)[1];
}
try {
  fs.mkdirSync(path.join(workspace, "user"));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const owner = await cli(["--user-dir", path.join(workspace, "user"), "--allow-tool", "workflow_run", "run workflow fixture"]);
  assert.equal(results.length, 1); assert.equal(results[0].status, "failed");
  assert.deepEqual(results[0].tasks.map(task => task.status), ["completed", "failed"]);
  const directory = path.join(workspace, ".agent", "workflows", owner);
  assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
  const committed = JSON.parse(fs.readFileSync(path.join(directory, `${results[0].id}.json`), "utf8"));
  assert.equal(committed.owner, owner); assert.equal(committed.view.tasks[0].summary, "CLI durable A output");
  attempt = 2;
  assert.equal(await cli(["--resume", owner, "resume workflow fixture"]), owner);
  assert.equal(results.length, 2); assert.equal(results[1].status, "completed");
  assert.equal(results[1].resume_from, results[0].id); assert.notEqual(results[1].id, results[0].id);
  assert.deepEqual(results[1].reused_tasks, ["a"]); assert.equal(results[1].tasks[0].session_id, results[0].tasks[0].session_id);
  assert.equal(childPrompts.filter(text => text.startsWith("workflow child A")).length, 1);
  assert.equal(childPrompts.filter(text => text.startsWith("workflow child B")).length, 2);
  assert.match(childPrompts.at(-1), /CLI durable A output/);
  assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cliWorkflowResume: "passed", ownerSessionResumed: true, completedTaskCalls: 1, retriedTaskCalls: 2,
    fullSettingsCompatible: true, provenance: true, locksReleased: true, gateway: "owned loopback SSE", firstFailure: "max_tokens" }));
} finally {
  if (processHandle) {
    const child = processHandle; const exited = new Promise(resolve => child.once("close", resolve));
    child.kill("SIGKILL"); await exited;
  }
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  fs.rmSync(workspace, { recursive: true, force: true });
}
