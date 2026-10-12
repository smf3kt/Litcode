import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// The same policy helper configuration is used twice: once with no helper
// document, so the static default tier must govern and deny the write, and once
// with a valid document, so the helper tier must govern and allow it. That pair
// is what shows the tier actually decides, rather than a blanket rule.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "policy-helper-cli-")));
const compiled = process.argv.includes("--compiled");
let server, child, calls = 0;
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); calls++;
      const events = calls === 1
        ? [
            { type: "message_start", message: { id: "msg_policy_fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
            { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "write-call", name: "write_file", input: {} } },
            { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ path: "written.txt", content: "data" }) } },
            { type: "content_block_stop", index: 0 },
            { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 2 } },
            { type: "message_stop" },
          ]
        : [
            { type: "message_start", message: { id: "msg_policy_fixture_2", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  Object.assign(env, { LLM_API_KEY: "owned-policy", LLM_MODEL: "fixture/policy", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });

  const run = async (label, helperDocument) => {
    calls = 0;
    const workspace = path.join(temporary, label), user = path.join(temporary, `${label}-user`);
    fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, ".harness"));
    // The managed settings file is the static default payload the helper falls
    // back to, so it is the tier that denies the write when the helper is absent.
    fs.writeFileSync(path.join(workspace, ".harness/managed.json"), JSON.stringify({ permissions: { mode: "default", allow: [], deny: ["write_file"] } }));
    if (helperDocument !== undefined) fs.writeFileSync(path.join(workspace, "policy.json"), helperDocument);
    child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, "--user-dir", user, "--managed-settings", ".harness/managed.json", "--policy-helper", "policy.json",
      "--max-turns", "4", "--output-format", "json", "Write the fixture file"],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => child?.kill("SIGKILL"), 20000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer); child = undefined;
    assert.equal(code, 0, stderr);
    const file = fs.readdirSync(path.join(workspace, ".agent")).find(file => file.endsWith(".jsonl"));
    const records = fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line));
    return { stderr, result: records.filter(record => record.kind === "tool_result").at(-1).result, written: fs.existsSync(path.join(workspace, "written.txt")), calls };
  };

  // No document: the helper fails and the static default tier must govern.
  const degraded = await run("degraded", undefined);
  assert.match(degraded.stderr, /policy helper: policy helper refresh failed .*applying the static default settings payload/);
  assert.equal(degraded.result.is_error, true);
  assert.match(degraded.result.content, /permission/i);
  assert.equal(degraded.written, false, "the default tier denied the write");
  assert.equal(degraded.calls, 2);

  // A valid document: the helper tier governs, so its policy replaces the default.
  const served = await run("served", JSON.stringify({ permissions: { mode: "bypass", allow: [], deny: [] } }));
  assert.doesNotMatch(served.stderr, /applying the static default settings payload/);
  assert.equal(served.result.is_error, undefined);
  assert.equal(served.written, true, "the helper tier allowed the write");
  assert.equal(served.calls, 2);

  // A document that parses but is not a managed policy is refused: the tier that
  // was governing stays, so the default still denies and nothing is swapped in.
  const invalid = await run("invalid", JSON.stringify({ permissions: { mode: "plan" } }));
  assert.match(invalid.stderr, /policy helper: policy helper document is invalid .*not applied/);
  assert.doesNotMatch(invalid.stderr, /applying the static default settings payload/);
  assert.equal(invalid.written, false);

  console.log(JSON.stringify({ cli: "passed", defaultTierGoverned: true, helperTierGoverned: true, invalidDocumentRefused: true,
    modelCallsPerCase: 2, ...(compiled ? { compiledCLI: true } : {}), gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
