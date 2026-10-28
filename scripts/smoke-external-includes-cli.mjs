import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// A project instruction that imports a file outside the workspace is not read
// until the user approves external includes (`t1` depth gate, chunk-sfn1dbxq.js
// 661767; `HXo` at 676557). The same workspace runs twice: once with no user
// settings, once with the user-layer switch, so the request text shows which
// side of the gate applied.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "external-includes-cli-")));
const compiled = process.argv.includes("--compiled");
let server, child, systems = [];
try {
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk)); req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      systems.push(typeof body.system === "string" ? body.system
        : Array.isArray(body.system) ? body.system.map(part => part.text ?? "").join("\n") : "");
      const events = [
        { type: "message_start", message: { id: "msg_external_fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  Object.assign(env, { LLM_API_KEY: "owned-includes", LLM_MODEL: "fixture/includes", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_THINKING: "false" });

  const run = async (label, approve) => {
    systems = [];
    const workspace = path.join(temporary, label), user = path.join(temporary, `${label}-user`);
    fs.mkdirSync(workspace); fs.mkdirSync(user);
    fs.writeFileSync(path.join(temporary, `${label}-outside.md`), "OUTSIDE_INCLUDE_TEXT");
    fs.writeFileSync(path.join(workspace, "HARNESS.md"), "PROJECT_INSTRUCTION_TEXT @../" + `${label}-outside.md`);
    if (approve) fs.writeFileSync(path.join(user, "settings.json"), JSON.stringify({ approveExternalIncludes: true }));
    child = spawn(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, "--user-dir", user, "--max-turns", "1", "--output-format", "json", "Say done"],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; }); child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => child?.kill("SIGKILL"), 20000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer); child = undefined;
    assert.equal(code, 0, stderr);
    assert.equal(systems.length, 1, stdout);
    return { system: systems[0], stderr };
  };

  const blocked = await run("blocked", false);
  assert.ok(blocked.system.includes("PROJECT_INSTRUCTION_TEXT"), "the workspace instruction is read");
  assert.equal(blocked.system.includes("OUTSIDE_INCLUDE_TEXT"), false, "the external import is not read");
  assert.match(blocked.stderr, /instructions: not reading .*blocked-outside\.md .*outside the workspace/);
  assert.match(blocked.stderr, /approveExternalIncludes/);

  const approved = await run("approved", true);
  assert.ok(approved.system.includes("PROJECT_INSTRUCTION_TEXT"));
  assert.ok(approved.system.includes("OUTSIDE_INCLUDE_TEXT"), "the approved external import reached the request");
  assert.doesNotMatch(approved.stderr, /instructions: not reading/);

  console.log(JSON.stringify({ cli: "passed", externalImportHeld: true, approvedImportRead: true, modelCallsPerCase: 1,
    ...(compiled ? { compiledCLI: true } : {}), gateway: "owned loopback SSE" }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(temporary, { recursive: true, force: true });
}
