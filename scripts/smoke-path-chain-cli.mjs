import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Three reads through the real CLI against an owned loopback gateway: a short
// chain that must resolve, a chain longer than the resolver's bound that must be
// refused, and a link that leaves the workspace that must be refused. The first
// case is the control: without it, a blanket refusal would look the same as a
// bound that works.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "path-chain-cli-")));
const compiled = process.argv.includes("--compiled");
const MAX_LINK_HOPS = 64;
let server;
let child;
let calls = 0;

try {
  let toolPath = "";
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks));
      calls += 1;
      const events = calls === 1
        ? [
            { type: "message_start", message: { id: "msg_chain_fixture", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
            { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "read-call", name: "read_file", input: {} } },
            { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ path: toolPath }) } },
            { type: "content_block_stop", index: 0 },
            { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 2 } },
            { type: "message_stop" },
          ]
        : [
            { type: "message_start", message: { id: "msg_chain_fixture_2", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
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
    LLM_API_KEY: "owned-path-chain",
    LLM_MODEL: "fixture/path-chain",
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
    LLM_AUTH: "bearer",
    LLM_TOKEN_COUNTING: "estimate",
    LLM_THINKING: "false",
  });

  const read = async (label, build) => {
    calls = 0;
    const workspace = path.join(temporary, label);
    const user = path.join(temporary, `${label}-user`);
    fs.mkdirSync(workspace);
    fs.mkdirSync(user);
    fs.mkdirSync(path.join(workspace, ".harness"));
    toolPath = build(workspace);
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
    assert.equal(code, 0, stderr);
    const log = fs.readdirSync(path.join(workspace, ".agent")).find(file => file.endsWith(".jsonl"));
    const records = fs.readFileSync(path.join(workspace, ".agent", log), "utf8").trim().split("\n").map(line => JSON.parse(line));
    const result = records.filter(record => record.kind === "tool_result").at(-1).result;
    return { calls, isError: result.is_error === true, result: String(result.content) };
  };

  // Control: a three-link chain inside the workspace resolves to its target.
  const ok = await read("chain-ok", workspace => {
    fs.writeFileSync(path.join(workspace, "real.txt"), "chain content");
    fs.symlinkSync("real.txt", path.join(workspace, "one.txt"));
    fs.symlinkSync("one.txt", path.join(workspace, "two.txt"));
    fs.symlinkSync("two.txt", path.join(workspace, "three.txt"));
    return "three.txt";
  });
  assert.equal(ok.calls, 2, "two model requests for the control case");
  assert.equal(ok.isError, false, `control read failed: ${ok.result}`);
  assert.match(ok.result, /chain content/, `control read did not return the target: ${ok.result}`);

  // Refusal: the chain is longer than the bound, so it is refused by name rather
  // than by whatever the kernel would have said at its own limit.
  const tooLong = await read("chain-too-long", workspace => {
    fs.writeFileSync(path.join(workspace, "end.txt"), "unreachable");
    let previous = "end.txt";
    for (let index = 0; index < MAX_LINK_HOPS + 8; index += 1) {
      const link = `link-${index}.txt`;
      fs.symlinkSync(previous, path.join(workspace, link));
      previous = link;
    }
    return previous;
  });
  assert.equal(tooLong.calls, 2, "two model requests for the long-chain case");
  assert.equal(tooLong.isError, true, "a refused chain must be reported as a failed call");
  assert.match(tooLong.result, /too long to vet/, `long chain was not refused by name: ${tooLong.result}`);
  assert.doesNotMatch(tooLong.result, /unreachable/, "a refused chain must not have been read");

  // Refusal: a link that leaves the workspace is still refused, so the bound did
  // not replace the confinement check.
  const escape = await read("chain-escape", workspace => {
    const outside = path.join(temporary, "outside.txt");
    fs.writeFileSync(outside, "outside content");
    fs.symlinkSync(outside, path.join(workspace, "escape.txt"));
    return "escape.txt";
  });
  assert.equal(escape.calls, 2, "two model requests for the escape case");
  assert.equal(escape.isError, true, "a refused link must be reported as a failed call");
  assert.match(escape.result, /escapes the workspace/, `escaping link was not refused: ${escape.result}`);
  assert.doesNotMatch(escape.result, /outside content/, "a refused link must not have been read");

  console.log(JSON.stringify({
    control: ok.result.slice(0, 40),
    tooLong: tooLong.result.slice(0, 120),
    escape: escape.result.slice(0, 120),
  }));
} finally {
  if (child) child.kill("SIGKILL");
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(temporary, { recursive: true, force: true });
}
