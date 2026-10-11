import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scheduler-cli-")));
const workspace = path.join(fixture, "workspace");
const clock = path.join(fixture, "clock");
const preload = path.join(fixture, "clock.mjs");
let child, server, wake, job;
let stderr = "", stdout = "", done = false;
const requests = [];
const initial = new Date(2024, 0, 1, 0, 0).getTime();
const wait = predicate => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { wake = undefined; reject(new Error(`CLI wait expired: ${stderr}`)); }, 10000);
  wake = () => {
    if (predicate()) { clearTimeout(timer); wake = undefined; resolve(); }
    else if (done) { clearTimeout(timer); wake = undefined; reject(new Error(`CLI exited: ${stderr}`)); }
  }; wake();
});
try {
  fs.mkdirSync(workspace); fs.mkdirSync(path.join(workspace, "user")); fs.mkdirSync(path.join(workspace, ".harness"));
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { schedulerJitter: true }, permissions: { mode: "bypass", allow: [], deny: [] } }));
  fs.writeFileSync(clock, String(initial));
  // Only this owned child process sees the controllable clock. Wall timers stay real.
  fs.writeFileSync(preload, `import fs from "node:fs";\nconst OriginalDate=Date;\nconst now=()=>Number(fs.readFileSync(process.env.SMOKE_CLOCK,"utf8"));\nglobalThis.Date=class extends OriginalDate { constructor(...args){super(...(args.length?args:[now()]));} static now(){return now();} };\n`);
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length;
      const block = index === 1 ? { type: "tool_use", id: "cron-create", name: "cron_create", input: { cron: "* * * * *", prompt: "scheduled fixture task", recurring: true } }
        : index === 2 ? { type: "tool_use", id: "cron-list", name: "cron_list", input: {} }
        : index === 5 ? { type: "tool_use", id: "cron-delete", name: "cron_delete", input: { id: job.id } }
        : { type: "text", text: index === 3 ? "armed" : "scheduled complete" };
      const events = [
        { type: "message_start", message: { id: `schedule-${index}`, type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} } },
        { type: "content_block_delta", index: 0, delta: block.type === "text" ? { type: "text_delta", text: block.text } : { type: "input_json_delta", partial_json: JSON.stringify(block.input) } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: block.type === "text" ? "end_turn" : "tool_use", stop_sequence: null }, usage: { output_tokens: 5 } },
        { type: "message_stop" },
      ];
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""));
      wake?.();
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  child = spawn(process.execPath, ["--import", preload, "--import", "tsx", path.join(root, "src/cli.ts"), "--workspace", workspace,
    "--user-dir", path.join(workspace, "user"), "--interactive"], { cwd: root, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, SMOKE_CLOCK: clock, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/scheduler", LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`,
      LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate", LLM_EFFORT: "medium", LLM_THINKING: "false" } });
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
  child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-32000); wake?.(); });
  const exited = new Promise((resolve, reject) => { child.on("error", reject); child.on("close", code => { done = true; wake?.(); resolve(code); }); });
  await wait(() => stderr.includes("Personal harness."));
  child.stdin.write("schedule fixture task\n");
  await wait(() => stderr.includes("finished: end_turn"));
  const inspectOffset = stdout.length;
  child.stdin.write("/cron\n");
  await wait(() => stdout.slice(inspectOffset).includes("humanSchedule"));
  const result = requests[2].messages.at(-1).content.find(block => block.type === "tool_result");
  const listed = JSON.parse(typeof result.content === "string" ? result.content : result.content[0].text).jobs;
  assert.equal(listed.length, 1);
  job = listed[0];
  assert.ok(job.nextAt >= initial + 60000 && job.nextAt < initial + 66000);
  fs.writeFileSync(clock, String(initial + 59999));
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(requests.length, 3);
  fs.writeFileSync(clock, String(job.nextAt));
  await wait(() => stderr.includes("event finished: end_turn"));
  assert.match(JSON.stringify(requests[3].messages.at(-1)), /scheduled fixture task/);
  const deleteOffset = stderr.length;
  child.stdin.write("cancel scheduled fixture\n");
  await wait(() => stderr.slice(deleteOffset).includes("finished: end_turn"));
  const removed = requests[5].messages.at(-1).content.find(block => block.type === "tool_result");
  assert.equal(JSON.parse(typeof removed.content === "string" ? removed.content : removed.content[0].text).deleted, true);
  child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  const journal = fs.readdirSync(path.join(workspace, ".agent")).find(name => name.endsWith(".jsonl"));
  const metadata = JSON.parse(fs.readFileSync(path.join(workspace, ".agent", journal), "utf8").split("\n")[0]);
  assert.equal(metadata.config.features.schedulerJitter, true);
  console.log(JSON.stringify({ cli: "passed", schedulerJitterPinned: true, cronTools: true, scheduledTurn: true,
    cronInspection: true,
    recurringJitterBounded: true, cancelled: true, modelRequests: requests.length, gateway: "owned loopback SSE", locksReleased: true }));
} finally {
  child?.kill("SIGKILL");
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(fixture, { recursive: true, force: true });
}
