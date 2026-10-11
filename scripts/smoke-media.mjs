import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

// Drive the actual CLI against an owned Messages SSE endpoint; no upstream calls.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "harness-media-smoke-")));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const requests = [];
let server;

function run(args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", path.join(root, "src/cli.ts"),
      "--workspace", workspace, ...args], {
      cwd: root, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, LLM_API_KEY: "local-smoke-key", LLM_MODEL: "smoke/media",
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer",
        LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false", LLM_PROMPT_CACHE: "false",
        LLM_EAGER_TOOL_INPUT: "false", LLM_EFFORT: "medium" },
    });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 15_000);
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-12_000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-12_000); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || timedOut) reject(new Error(`CLI failed (${code}): ${stderr}`));
      else resolve({ stdout, stderr });
    });
    child.stdin.end(input ?? "");
  });
}

try {
  fs.mkdirSync(path.join(workspace, "user"));
  fs.writeFileSync(path.join(workspace, "screen shot.png"), png);
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 200]).drawText("First page");
  pdf.addPage([300, 400]).drawText("Second page");
  fs.writeFileSync(path.join(workspace, "report.pdf"), await pdf.save());
  server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/messages") { res.writeHead(404).end(); return; }
    const chunks = []; let bytes = 0;
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) req.destroy(); else chunks.push(chunk);
    });
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")); requests.push(body);
      const events = [
        { type: "message_start", message: { id: "smoke", type: "message", role: "assistant", model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Media wire accepted." } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 4 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const oneShot = await run(["--user-dir", path.join(workspace, "user"), "--attach", "screen shot.png", "Inspect screenshot"]);
  assert.match(oneShot.stdout, /Media wire accepted/);
  const image = requests[0].messages[0].content.find(block => block.type === "image");
  assert.deepEqual(Buffer.from(image.source.data, "base64"), png);
  const sessionId = /session: ([a-f0-9-]+)/.exec(oneShot.stderr)?.[1]; assert.ok(sessionId);
  fs.unlinkSync(path.join(workspace, "screen shot.png"));
  await run(["--resume", sessionId, "Continue discussing the screenshot"]);
  assert.deepEqual(requests[1].messages[0].content, requests[0].messages[0].content);
  const interactive = await run(["--user-dir", path.join(workspace, "user"), "--interactive"],
    "/attach missing.png inspect\n/attach report.pdf --pages 2 Explain second page\n/status\n/exit\n");
  assert.match(interactive.stderr, /error:/); assert.match(interactive.stderr, /finished: end_turn/);
  assert.match(interactive.stdout, /Media wire accepted/);
  assert.match(interactive.stdout, /\"unfinished\": false/);
  assert.equal(requests.length, 3);
  const document = requests[2].messages[0].content.find(block => block.type === "document");
  const selected = await PDFDocument.load(Buffer.from(document.source.data, "base64"));
  assert.equal(selected.getPageCount(), 1); assert.equal(selected.getPage(0).getWidth(), 300);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", oneShotImage: true, resumeWithoutSource: true,
    interactivePdfSelection: true, errorThenNextTask: true, locksReleased: true,
    gateway: "owned loopback SSE", modelRequests: requests.length }));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(workspace, { recursive: true, force: true });
}
