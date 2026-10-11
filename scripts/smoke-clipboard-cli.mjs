import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Only the owned preload substitutes osascript. The CLI uses its production command and media path.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "clipboard-cli-smoke-")));
const workspace = path.join(temporary, "workspace");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const requests = [], gatewayErrors = [];
let server;

function run(preload) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", preload, "--import", "tsx", path.join(root, "src/cli.ts"),
      "--workspace", workspace, "--user-dir", path.join(workspace, "user"), "--interactive"], {
      cwd: root, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, LLM_API_KEY: "local-clipboard-smoke-key", LLM_MODEL: "smoke/clipboard",
        LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer",
        LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false", LLM_PROMPT_CACHE: "false",
        LLM_EAGER_TOOL_INPUT: "false", LLM_EFFORT: "medium" },
    });
    let stdout = "", stderr = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, 20_000);
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-20_000); });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-20_000); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || timedOut) reject(new Error(`Clipboard CLI exited ${code}: ${stderr}`));
      else resolve({ stdout, stderr });
    });
    child.stdin.end("/paste-image Inspect clipboard fixture\n/rename Clipboard fixture title\n/sessions Clipboard fixture\n/exit\n");
  });
}

try {
  assert.equal(process.platform, "darwin", "CLI clipboard fixture smoke exercises the macOS osascript path");
  fs.mkdirSync(workspace, { mode: 0o700 }); fs.mkdirSync(path.join(workspace, "user"), { mode: 0o700 });
  const fixture = path.join(temporary, "pngf-provider.mjs");
  const preload = path.join(temporary, "clipboard-preload.mjs");
  const calls = path.join(temporary, "clipboard-calls.jsonl");
  fs.writeFileSync(fixture, `process.stdout.write("\\u00abdata PNGf${png.toString("hex")}\\u00bb\\n");\n`, { mode: 0o700, flag: "wx" });
  fs.writeFileSync(preload, `import childProcess from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
const originalSpawn = childProcess.spawn;
childProcess.spawn = function(command, args, options) {
  if (command !== "/usr/bin/osascript") return originalSpawn(command, args, options);
  fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify({ command, args, shell: options.shell }) + "\\n", { mode: 0o600 });
  return originalSpawn(process.execPath, [${JSON.stringify(fixture)}], options);
};
syncBuiltinESMExports();
`, { mode: 0o600, flag: "wx" });
  server = http.createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/v1/messages") { res.writeHead(404).end(); return; }
    const chunks = []; let bytes = 0;
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) req.destroy(); else chunks.push(chunk);
    });
    req.on("end", () => {
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString("utf8")); requests.push(body);
        const image = body.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).find(block => block.type === "image");
        assert.equal(image.source.media_type, "image/png");
        assert.deepEqual(Buffer.from(image.source.data, "base64"), png);
      } catch (error) { gatewayErrors.push(String(error)); res.writeHead(500).end("Clipboard request assertion failed"); return; }
      const events = [
        { type: "message_start", message: { id: "clipboard-smoke", type: "message", role: "assistant", model: body.model,
          content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Clipboard image accepted." } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 4 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const result = await run(preload);
  assert.deepEqual(gatewayErrors, []); assert.equal(requests.length, 1);
  assert.match(result.stdout, /Clipboard image accepted/);
  assert.match(result.stdout, /"title": "Clipboard fixture title"/);
  assert.match(result.stderr, /finished: end_turn/); assert.match(result.stderr, /Session title: Clipboard fixture title/);
  assert.doesNotMatch(result.stderr, /(?:^|\n)error:|Clipboard cleanup error/);
  const invocations = fs.readFileSync(calls, "utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(invocations, [{ command: "/usr/bin/osascript", args: ["-e", "the clipboard as «class PNGf»"], shell: false }]);
  const sessionId = /session: ([a-f0-9-]{36})/.exec(result.stderr)?.[1]; assert.ok(sessionId);
  const agentDirectory = path.join(workspace, ".agent");
  const journal = fs.readFileSync(path.join(agentDirectory, `${sessionId}.jsonl`), "utf8").trim().split("\n").map(line => JSON.parse(line));
  const user = journal.find(event => event.kind === "message" && event.message.role === "user" && Array.isArray(event.message.content) && event.message.content.some(block => block.type === "image"));
  assert.ok(user);
  assert.deepEqual(Buffer.from(user.message.content.find(block => block.type === "image").source.data, "base64"), png);
  assert.ok(user.message.content.some(block => block.type === "text" && block.text.includes("Inspect clipboard fixture")));
  assert.ok(journal.some(event => event.kind === "title" && event.title === "Clipboard fixture title"));
  assert.ok(journal.some(event => event.kind === "turn_end"));
  assert.deepEqual(fs.readdirSync(path.join(workspace, ".harness", "attachments")), []);
  assert.equal(fs.readdirSync(agentDirectory).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", pasteImage: true, renameAndSessionQuery: true,
    imagePersistedInJournal: true, attachmentRemoved: true, locksReleased: true,
    clipboardProvider: "owned executable via preload", gateway: "owned loopback SSE", modelRequests: requests.length,
    hostClipboardReads: 0, upstreamRequests: 0 }));
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
