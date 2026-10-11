import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const launcher = compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")];
if (process.argv.includes("--crash")) { await crashAcceptance(); process.exit(0); }
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
  const child = spawn(process.execPath, [...launcher, "--workspace", workspace, ...args], {
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

async function crashAcceptance() {
  const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "workflow-crash-cli-")));
  const definition = { tasks: [{ id: "a", prompt: "CRASH completed task A" },
    { id: "b", prompt: "CRASH mutating task B", mode: "general", depends_on: ["a"] }], max_parallel: 1, background: true, timeout_ms: 30000 };
  const receipts = [], held = new Set();
  let phase = "start", runId, owner, child, exited, ended = false, stderr = "", mutations = 0, completedCalls = 0;
  const send = (res, body, blocks, reason) => {
    const events = [{ type: "message_start", message: { id: "crash", type: "message", role: "assistant", model: body.model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }];
    blocks.forEach((block, index) => {
      events.push({ type: "content_block_start", index, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } },
        { type: "content_block_delta", index, delta: block.type === "text" ? { type: "text_delta", text: block.text } : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
        { type: "content_block_stop", index });
    });
    events.push({ type: "message_delta", delta: { stop_reason: reason, stop_sequence: null }, usage: { output_tokens: 1 } }, { type: "message_stop" });
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
  };
  const server = http.createServer((req, res) => {
    void (async () => {
      let text = ""; for await (const chunk of req) { text += chunk; if (text.length > 4 * 1024 * 1024) throw Error("fixture body cap"); }
      const body = JSON.parse(text), last = body.messages.at(-1);
      const isChild = JSON.stringify(body.system).includes("You are a child agent assigned a focused task");
      if (isChild) {
        const assigned = body.messages.find(message => message.role === "user" && typeof message.content === "string")?.content;
        if (assigned.startsWith("CRASH completed task A")) { completedCalls++; send(res, body, [{ type: "text", text: "CRASH cached A output" }], "end_turn"); return; }
        if (typeof last.content === "string") {
          mutations++;
          send(res, body, [{ type: "tool_use", id: `mutation-${mutations}`, name: "write_file", input: { path: "effect.txt", content: `effect-${mutations}\n`, overwrite: true } }], "tool_use");
        } else if (phase === "start") { held.add(res); res.on("close", () => held.delete(res)); }
        else send(res, body, [{ type: "text", text: "CRASH retried B output" }], "end_turn");
        return;
      }
      if (phase === "continue") { send(res, body, [{ type: "text", text: "CRASH continued parent" }], "end_turn"); return; }
      if (Array.isArray(last.content) && last.content.some(block => block.type === "tool_result")) {
        const result = last.content.find(block => block.type === "tool_result");
        receipts.push({ phase, error: !!result.is_error, content: result.content });
        if (phase === "start" && !result.is_error) runId = JSON.parse(result.content).id;
        send(res, body, [{ type: "text", text: "CRASH parent finished" }], "end_turn"); return;
      }
      const userText = typeof last.content === "string" ? last.content : last.content.filter(block => block.type === "text").map(block => block.text).join("\n");
      if (userText !== `CRASH ${phase}`) {
        send(res, body, [{ type: "text", text: "CRASH event acknowledged" }], "end_turn"); return;
      }
      const get = phase === "inspect" || phase === "poll";
      send(res, body, [{ type: "tool_use", id: `parent-${phase}`, name: get ? "workflow_get" : "workflow_run",
        input: get ? { id: runId, ...(phase === "poll" ? { wait_ms: 10000 } : {}) } : { ...definition,
          ...(phase !== "start" ? { resume_from: runId } : {}), ...(phase === "explicit" ? { retry_interrupted: true } : {}) } }], "tool_use");
    })().catch(error => { stderr += `\nfixture: ${error.message}`; res.destroy(); });
  });
  const wait = async (predicate, label) => {
    const deadline = Date.now() + 12000;
    while (!predicate()) { if (ended || Date.now() > deadline) throw Error(`crash CLI ${label}: ${stderr}`); await new Promise(resolve => setTimeout(resolve, 20)); }
  };
  const journalEvents = () => fs.readdirSync(path.join(workspace, ".agent")).filter(file => file.endsWith(".jsonl"))
    .flatMap(file => fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line)));
  const start = async resume => {
    stderr = ""; ended = false;
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
    Object.assign(env, { LLM_API_KEY: "workflow-crash-fixture-key", LLM_MODEL: "fixture/workflow-crash", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" });
    child = spawn(process.execPath, [...launcher, "--workspace", workspace, ...(!resume ? ["--user-dir", path.join(workspace, "user")] : []), "--interactive",
      ...(resume ? ["--resume", owner, "--recover-lock"] : ["--allow-tool", "workflow_run", "--allow-tool", "workflow_get", "--allow-tool", "write_file"])], { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); });
    exited = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", (code, signal) => { ended = true; resolve({ code, signal }); }); });
    await wait(() => /commands\./.test(stderr), "ready");
  };
  const turn = async next => {
    phase = next; const offset = stderr.length, before = receipts.length;
    child.stdin.write(`CRASH ${next}\n`);
    await wait(() => receipts.length > before && receipts.at(-1).phase === next && stderr.slice(offset).includes("finished: end_turn"), next);
  };
  try {
    fs.mkdirSync(path.join(workspace, "user"));
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    await start(false); await turn("start");
    owner = /session: ([a-f0-9-]+)/.exec(stderr)?.[1]; assert.ok(owner); assert.ok(runId);
    const directory = path.join(workspace, ".agent", "workflows", owner), snapshotFile = path.join(directory, `${runId}.json`);
    await wait(() => held.size === 1 && fs.existsSync(path.join(workspace, "effect.txt")), "effect and held request");
    const snapshot = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
    assert.deepEqual(snapshot.view.tasks.map(task => task.status), ["completed", "running"]);
    assert.equal(snapshot.view.tasks[0].summary, "CRASH cached A output");
    assert.equal(fs.readFileSync(path.join(workspace, "effect.txt"), "utf8"), "effect-1\n");
    const priorTaskSession = snapshot.view.tasks[0].session_id;
    assert.equal(journalEvents().filter(event => event.kind === "tool_start" && event.name === "write_file").length, 1);
    child.kill("SIGKILL"); assert.equal((await exited).signal, "SIGKILL"); child = undefined;
    assert.ok(fs.existsSync(path.join(directory, "owner.lock")));
    for (const res of held) res.destroy();
    phase = "continue";
    await start(true);
    const parentEvents = fs.readFileSync(path.join(workspace, ".agent", `${owner}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
    const boundary = parentEvents.findLast(event => ["message", "compact", "turn_end", "metadata"].includes(event.kind));
    if (boundary.kind === "message" || boundary.kind === "compact") {
      const continuation = stderr.length; child.stdin.write("/continue\n");
      await wait(() => stderr.slice(continuation).includes("finished: end_turn"), "parent continuation");
    }
    await turn("inspect");
    assert.deepEqual(JSON.parse(receipts.at(-1).content).tasks.map(task => task.status), ["completed", "running"]);
    await turn("implicit"); assert.equal(receipts.at(-1).error, true); assert.match(String(receipts.at(-1).content), /retry_interrupted: true/);
    assert.equal(mutations, 1); assert.equal(completedCalls, 1);
    assert.equal(fs.readFileSync(path.join(workspace, "effect.txt"), "utf8"), "effect-1\n");
    await turn("explicit"); assert.equal(receipts.at(-1).error, false);
    const resumed = JSON.parse(receipts.at(-1).content); assert.deepEqual(resumed.reused_tasks, ["a"]); assert.equal(resumed.tasks[0].session_id, priorTaskSession);
    runId = resumed.id;
    await wait(() => JSON.parse(fs.readFileSync(path.join(directory, `${runId}.json`), "utf8")).view.status === "completed", "retried workflow completion");
    await turn("poll"); const complete = JSON.parse(receipts.at(-1).content);
    assert.equal(complete.status, "completed"); assert.equal(mutations, 2); assert.equal(completedCalls, 1);
    assert.equal(fs.readFileSync(path.join(workspace, "effect.txt"), "utf8"), "effect-2\n");
    assert.equal(journalEvents().filter(event => event.kind === "tool_start" && event.name === "write_file").length, 2);
    child.stdin.end("/exit\n"); assert.equal((await exited).code, 0); child = undefined;
    assert.equal(fs.existsSync(path.join(directory, "owner.lock")), false);
    assert.equal(fs.existsSync(path.join(workspace, ".agent", `${owner}.jsonl.lock`)), false);
    const interruptedChild = snapshot.view.tasks[1].session_id;
    assert.equal(fs.existsSync(path.join(workspace, ".agent", `${interruptedChild}.jsonl.lock`)), true);
    assert.equal(fs.readFileSync(path.join(workspace, ".agent", `${owner}.jsonl`), "utf8").includes("workflow-crash-fixture-key"), false);
    console.log(JSON.stringify({ cliWorkflowCrash: "passed", compiledCLI: compiled, sigkillObserved: true, runningEffectsUnknown: true,
      implicitRetryBlocked: true, completedTaskCalls: completedCalls, actualMutationToolStarts: 2, explicitRetryRequired: true,
      completedChildReused: true, staleOwnerRecovered: true, activeOwnerLocksReleased: true, interruptedChildLockPreserved: true, gateway: "owned loopback SSE" }));
  } finally {
    if (child) { child.kill("SIGKILL"); await exited.catch(() => undefined); }
    for (const res of held) res.destroy(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}
