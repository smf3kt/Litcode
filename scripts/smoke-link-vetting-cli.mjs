import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Two runs of the real CLI over an owned loopback gateway, both reading a target
// whose ancestor instruction file imports another file through a link. The
// control link stays inside its directory and its import must reach the request;
// the refused link enters a directory and climbs back out, and the run must stop
// with that reason. Without the control, a loader that never read the import
// would look the same as one that vetted it.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "link-vet-cli-")));
const compiled = process.argv.includes("--compiled");
let server;
let child;
let bodies = [];

try {
  let toolPath = "";
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      bodies.push(JSON.stringify(body.messages ?? []));
      const events = bodies.length === 1
        ? [
            { type: "message_start", message: { id: "msg_link_fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
            { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "read-call", name: "read_file", input: {} } },
            { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ path: toolPath }) } },
            { type: "content_block_stop", index: 0 },
            { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 2 } },
            { type: "message_stop" },
          ]
        : [
            { type: "message_start", message: { id: "msg_link_fixture_2", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
  Object.assign(env, {
    LLM_API_KEY: "owned-link-vet",
    LLM_MODEL: "fixture/link-vet",
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer",
    LLM_TOKEN_COUNTING: "estimate",
    LLM_THINKING: "false",
  });

  const run = async (label, body) => {
    bodies = [];
    const workspace = path.join(temporary, label);
    const user = path.join(temporary, `${label}-user`);
    fs.mkdirSync(workspace);
    fs.mkdirSync(user);
    fs.mkdirSync(path.join(workspace, ".harness"));
    fs.mkdirSync(path.join(workspace, "sub"));
    fs.mkdirSync(path.join(workspace, "docs"));
    fs.writeFileSync(path.join(workspace, "docs", "guide.md"), "# imported guide");
    fs.writeFileSync(path.join(workspace, "sub", "file.txt"), "target content");
    fs.writeFileSync(path.join(workspace, "sub", "HARNESS.md"), `# project\n@${body}\n`);
    fs.symlinkSync(body === "climb.md" ? "../docs/../docs/guide.md" : "../docs/guide.md", path.join(workspace, "sub", body));
    toolPath = path.join("sub", "file.txt");
    child = spawn(process.execPath, [
      ...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, "--user-dir", user,
      "--max-turns", "4", "--output-format", "json", "Read the fixture file",
    ], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    const timer = setTimeout(() => child?.kill("SIGKILL"), 20000);
    const code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve); });
    clearTimeout(timer);
    child = undefined;
    const log = fs.readdirSync(path.join(workspace, ".agent")).find(file => file.endsWith(".jsonl"));
    const records = fs.readFileSync(path.join(workspace, ".agent", log), "utf8").trim().split("\n").map(line => JSON.parse(line));
    const result = records.filter(record => record.kind === "tool_result").at(-1)?.result;
    return {
      code,
      stdout,
      stderr,
      requests: bodies.length,
      last: bodies.at(-1) ?? "",
      isError: result?.is_error === true,
      result: String(result?.content ?? ""),
    };
  };

  // Control: the import is reached through a link that stays inside `sub`, so it
  // is read and reaches the second request.
  const ok = await run("link-ok", "guide.md");
  assert.equal(ok.code, 0, `control run failed: ${ok.stderr}`);
  assert.equal(ok.requests, 2, "two model requests for the control case");
  assert.equal(ok.isError, false, `control read failed: ${ok.result}`);
  assert.match(ok.last, /imported guide/, "the imported instruction did not reach the request");

  // Refusal: the same import through a link that enters `docs` and climbs back
  // out fails the read it was loading instructions for, and the reason names the
  // link text.
  const climb = await run("link-climb", "climb.md");
  assert.equal(climb.code, 0, `a refused import must still end the turn cleanly: ${climb.stderr}`);
  assert.equal(climb.isError, true, "a refused import must be reported as a failed call");
  assert.match(climb.result, /climbs out of a directory it entered/, `refusal reason missing: ${climb.result}`);
  assert.doesNotMatch(climb.last, /imported guide/, "a refused link must not have been read as instructions");

  console.log(JSON.stringify({
    control: `exit ${ok.code}, ${ok.requests} requests, import reached the request`,
    refused: climb.result.slice(0, 140),
  }));
} finally {
  if (child) child.kill("SIGKILL");
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
