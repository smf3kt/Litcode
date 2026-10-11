import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const automatic = process.argv.includes("--automatic");
const collision = process.argv.includes("--collision");
const compiled = process.argv.includes("--compiled");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "rewind-cli-")));
const requests = [];
let child, server;
try {
  fs.mkdirSync(path.join(workspace, "user"));
  if (automatic) {
    fs.mkdirSync(path.join(workspace, ".harness"));
    fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ automaticCheckpoints: true }));
  }
  server = http.createServer((req, res) => {
    const chunks = []; let bytes = 0;
    req.on("data", chunk => { bytes += chunk.length; if (bytes > 4 * 1024 * 1024) req.destroy(); else chunks.push(chunk); });
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const last = body.messages.at(-1);
      const tools = last.content === "first" ? [["file.txt", "first state"]]
        : last.content === "second" ? [["file.txt", "second state"], ["added.txt", "new file"]] : [];
      const blocks = tools.length ? tools.map(([file, content], index) => ({ type: "tool_use", id: `smoke-${requests.length}-${index}`,
        name: "write_file", input: { path: file, content } })) : [{ type: "text", text: "done" }];
      const events = [{ type: "message_start", message: { id: "smoke", type: "message", role: "assistant", model: body.model,
        content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } }];
      for (const [index, block] of blocks.entries()) {
        events.push({ type: "content_block_start", index, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } });
        events.push({ type: "content_block_delta", index, delta: block.type === "text" ? { type: "text_delta", text: block.text }
          : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
        events.push({ type: "content_block_stop", index });
      }
      events.push({ type: "message_delta", delta: { stop_reason: tools.length ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } }, { type: "message_stop" });
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]), "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--interactive"], {
    cwd: root, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, LLM_API_KEY: "local-smoke-key",
      LLM_MODEL: "smoke/rewind", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" },
  });
  let stdout = "", stderr = "", waiter;
  const update = () => waiter?.();
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-64_000); update(); });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64_000); update(); });
  const exited = new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
  const wait = predicate => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { waiter = undefined; reject(new Error(`CLI wait expired: ${stderr}`)); }, 10_000);
    waiter = () => { if (predicate()) { clearTimeout(timer); waiter = undefined; resolve(); } }; waiter();
  });
  const command = async (text, marker, stream = "stderr") => {
    const offset = (stream === "stdout" ? stdout : stderr).length;
    child.stdin.write(text + "\n");
    await wait(() => (stream === "stdout" ? stdout : stderr).slice(offset).includes(marker));
  };
  await wait(() => stderr.includes("Personal harness."));
  await command("first", "finished: end_turn");
  if (!automatic) {
    await command("/checkpoint first", "\"turn\": 1", "stdout");
    await command("/diff first", "current_digest", "stdout");
  }
  await command("/tasks", "[]", "stdout");
  await command("/workflows", "[]", "stdout");
  let orphanPath, orphanBytes;
  if (automatic && collision) {
    const id = /session: ([a-f0-9-]{36})/.exec(stderr)[1];
    const records = fs.readFileSync(path.join(workspace, ".agent", `${id}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
    const captured = records.filter(event => event.kind === "checkpoint");
    const template = JSON.parse(fs.readFileSync(path.join(workspace, ".agent/checkpoints/manifests", `${captured[0].name}.json`), "utf8"));
    template.name = `auto-${id}-${captured.length}`;
    orphanPath = path.join(workspace, ".agent/checkpoints/manifests", `${template.name}.json`);
    orphanBytes = Buffer.from(JSON.stringify(template)); fs.writeFileSync(orphanPath, orphanBytes);
  }
  await command("second", "finished: end_turn");
  if (automatic && collision) {
    assert.deepEqual(fs.readFileSync(orphanPath), orphanBytes);
    await command("/rewind 2 --files", "Apply:", "stdout");
  }
  await command("/rewind 1 --files", "Apply:", "stdout");
  const token = () => [...stdout.matchAll(/Apply: \/rewind 1 --files --apply ([a-f0-9]{64})/g)].at(-1)[1];
  const stale = token();
  fs.writeFileSync(path.join(workspace, "file.txt"), "external edit after preview");
  await command(`/rewind 1 --files --apply ${stale}`, "preview is stale");
  assert.equal(fs.readFileSync(path.join(workspace, "file.txt"), "utf8"), "external edit after preview");
  await command("/rewind 1 --files", "Apply:", "stdout");
  await command(`/rewind 1 --files --apply ${token()}`, "Rewound files and conversation", "stdout");
  assert.equal(fs.readFileSync(path.join(workspace, "file.txt"), "utf8"), "first state");
  assert.equal(fs.existsSync(path.join(workspace, "added.txt")), false);
  await command("verify restored history", "finished: end_turn");
  const final = requests.at(-1).messages;
  assert.equal(final.some(message => message.content === "second"), false);
  assert.ok(final.some(message => message.content === "first"));
  const originalId = [...stderr.matchAll(/session: ([a-f0-9-]{36})/g)][0][1];
  await command(`/resume ${originalId}`, "Session resumed.");
  await command("/status", "\"unfinished\": false", "stdout");
  child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).filter(name => name.endsWith(".jsonl")).length, 2);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  if (automatic) {
    const records = fs.readdirSync(path.join(workspace, ".agent")).filter(file => file.endsWith(".jsonl"))
      .flatMap(file => fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line)));
    assert.ok(records.some(event => event.kind === "checkpoint" && event.boundary === 0 && event.name.startsWith("auto-")));
    assert.ok(records.some(event => event.kind === "checkpoint" && event.boundary > 0 && event.name.startsWith("auto-")));
  }
  console.log(JSON.stringify({ cli: "passed", checkpoint: true, stalePreviewPreserved: true,
    changedFileRestored: true, addedFileRemoved: true, historyBranched: true, nextTask: true,
    locksReleased: true, ...(automatic ? { automaticBoundaries: true } : {}), ...(collision ? { oldManifestCollisionPreserved: true } : {}), ...(compiled ? { compiledCLI: true } : {}),
    modelRequests: requests.length, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
