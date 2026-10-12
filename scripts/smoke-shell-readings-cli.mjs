import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Owned loopback gateway that asks for one run_command call. The same permission
// policy denies `echo denied*`; the two cases differ only in the command the
// model asks for, so a blocked case proves the de-quoted reading was matched and
// the control case proves the block did not come from a blanket denial.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "shell-readings-cli-")));
const compiled = process.argv.includes("--compiled");
let server, child, calls = 0, commanded = "";
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); calls++;
      const events = calls === 1
        ? [
            { type: "message_start", message: { id: "msg_shell_fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
            { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "shell-call", name: "run_command", input: {} } },
            { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ command: commanded }) } },
            { type: "content_block_stop", index: 0 },
            { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 2 } },
            { type: "message_stop" },
          ]
        : [
            { type: "message_start", message: { id: "msg_shell_fixture_2", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  Object.assign(env, { LLM_API_KEY: "owned-shell", LLM_MODEL: "fixture/shell", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });

  const run = async (label, command, marker) => {
    commanded = command; calls = 0;
    const workspace = path.join(temporary, label), user = path.join(temporary, `${label}-user`);
    fs.mkdirSync(workspace); fs.mkdirSync(user); fs.mkdirSync(path.join(workspace, ".harness"));
    fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ allowShell: true,
      permissions: { mode: "default", allow: [], deny: [], inputRules: [{ tool: "run_command", command: "echo denied*", decision: "deny" }] } }));
    child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, "--user-dir", user, "--max-turns", "4", "--output-format", "json", "Run the fixture command"],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => child?.kill("SIGKILL"), 20000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer); child = undefined;
    assert.equal(code, 0, stderr);
    const file = fs.readdirSync(path.join(workspace, ".agent")).find(file => file.endsWith(".jsonl"));
    const records = fs.readFileSync(path.join(workspace, ".agent", file), "utf8").trim().split("\n").map(line => JSON.parse(line));
    const result = records.filter(record => record.kind === "tool_result").at(-1).result;
    return { workspace, marker: path.join(workspace, marker), result, calls, modelCalls: JSON.parse(stdout).model_calls };
  };

  const blocked = await run("blocked", "echo 'denied' > marker.txt", "marker.txt");
  assert.equal(blocked.result.is_error, true);
  assert.match(blocked.result.content, /denied for an alternate reading/);
  assert.equal(fs.existsSync(blocked.marker), false, "the denied command must not have run");
  assert.equal(blocked.calls, 2);

  const control = await run("control", "echo fine > marker.txt", "marker.txt");
  assert.equal(control.result.is_error, undefined);
  assert.equal(fs.existsSync(control.marker), true, "the allowed command must have run");
  assert.match(fs.readFileSync(control.marker, "utf8"), /fine/);
  assert.equal(control.calls, 2);

  console.log(JSON.stringify({ cli: "passed", quotedCommandDenied: true, controlCommandRan: true,
    denial: "alternate reading", modelCallsPerCase: 2, ...(compiled ? { compiledCLI: true } : {}), gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
