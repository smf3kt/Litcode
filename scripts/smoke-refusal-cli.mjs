import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Owned loopback gateway that answers with a refusal carrying structured stop
// details and a tool call, so the driver proves the SDK surfacing path, the
// journal record and the skipped tool end to end through the real CLI.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "refusal-cli-")));
const compiled = process.argv.includes("--compiled");
let server, child, calls = 0;
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); calls++;
      const events = [
        { type: "message_start", message: { id: "msg_refusal_fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "This request was refused." } },
        { type: "content_block_stop", index: 0 },
        { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "refused-call", name: "read_file", input: {} } },
        { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: JSON.stringify({ path: "secret.txt" }) } },
        { type: "content_block_stop", index: 1 },
        { type: "message_delta", delta: { stop_reason: "refusal", stop_sequence: null,
          stop_details: { type: "refusal", category: "cyber", explanation: "Cyber policy\ncategory." } }, usage: { output_tokens: 2 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { LLM_API_KEY: "owned-refusal", LLM_MODEL: "fixture/refusal", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });
  const workspace = path.join(temporary, "workspace"), user = path.join(temporary, "user");
  fs.mkdirSync(workspace); fs.mkdirSync(user);
  fs.writeFileSync(path.join(workspace, "secret.txt"), "never read\n");
  child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", user, "--max-turns", "4", "--output-format", "json", "Read secret.txt"],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
  const timer = setTimeout(() => child?.kill("SIGKILL"), 20000);
  const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
  clearTimeout(timer); child = undefined;
  // A refusal is not a successful turn, so the CLI keeps the generic non-end_turn code.
  assert.equal(code, 2, stderr);
  const output = JSON.parse(stdout);
  assert.equal(output.reason, "refusal");
  assert.equal(calls, 1, "a refusal ends the turn without another model request");
  assert.match(stderr, /model refused this request \(cyber\): Cyber policy category\./);
  const file = fs.readdirSync(path.join(workspace, ".agent")).find(file => file.endsWith(".jsonl"));
  const records = fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line));
  const refusals = records.filter(record => record.kind === "refusal");
  assert.equal(refusals.length, 1);
  assert.deepEqual(refusals[0], { kind: "refusal", model: "fixture/refusal", category: "cyber",
    explanation: "Cyber policy category.", requestId: "msg_refusal_fixture" });
  const skipped = records.filter(record => record.kind === "tool_result");
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].result.is_error, true);
  assert.match(skipped[0].result.content, /Tools skipped because model stopped with refusal/);
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(file => file.endsWith(".lock")), false);
  console.log(JSON.stringify({ cli: "passed", reason: output.reason, journalRecord: "refusal", toolSkipped: true,
    status: "carried category and explanation", modelCalls: calls, ...(compiled ? { compiledCLI: true } : {}), gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
