import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "stop-cap-cli-")));
const compiled = process.argv.includes("--compiled");
let server, child, calls = 0;
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); calls++;
      const events = [
        { type: "message_start", message: { id: "stop-fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "done" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-stop", LLM_MODEL: "fixture/stop", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  for (const cap of [undefined, 2, 0]) {
    const workspace = path.join(temporary, "workspace-" + (cap ?? "default")), user = path.join(temporary, "user-" + (cap ?? "default"));
    fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, ".harness"));
    fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ hooks: { Stop: [{ command: "printf continue >&2; exit 2" }] },
      ...(cap === undefined ? {} : { stopHookBlockCap: cap }) }));
    const baseline = calls;
    child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, "--user-dir", user, "--max-turns", cap === 0 ? "3" : "20", "--output-format", "json", "complete fixture"],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => child?.kill("SIGKILL"), 15000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer); child = undefined; assert.equal(code, 2, stderr);
    const output = JSON.parse(stdout);
    assert.equal(output.reason, cap === 0 ? "turn_limit" : "stop_hook_limit");
    assert.equal(calls - baseline, cap === undefined ? 9 : 3);
    const file = fs.readdirSync(path.join(workspace, ".agent")).find(file => file.endsWith(".jsonl"));
    const records = fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line));
    assert.equal(records[0].config.stopHookBlockCap, cap ?? 8);
    assert.equal(records.filter(event => event.kind === "stop_hook_count").length, cap ?? 8);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
  }
  console.log(JSON.stringify({ cli: "passed", defaultEight: true, customTwo: true, disabledRetainsTurnLimit: true, durableCounts: true,
    jsonParseable: true, locksReleased: true, ...(compiled ? { compiledCLI: true } : {}), modelCalls: calls, gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
