import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const creators = process.argv.includes("--creators");
const durable = creators || process.argv.includes("--durable");
const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "scheduler-cli-")));
const workspace = path.join(fixture, "workspace");
const clock = path.join(fixture, "clock");
const preload = path.join(fixture, "clock.mjs");
let child, creator, creatorExited, server, wake, job;
const birth = pid => execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
  timeout: 1000, encoding: "utf8", env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
}).trim();
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
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), JSON.stringify({ features: { schedulerJitter: true,
    ...(durable ? { schedulerDurable: true } : {}) }, permissions: { mode: "bypass", allow: [], deny: [] } }));
  const storeFile = path.join(workspace, ".harness/scheduled_tasks.json");
  if (durable) fs.writeFileSync(storeFile, JSON.stringify({ tasks: creators ? [] : [{ id: "deadbeef", cron: "0 0 * * *",
    prompt: "missed fixture task", createdAt: initial - 2 * 86400000 }] }));
  const replaceStore = tasks => {
    const staging = path.join(fixture, "store-next.json");
    fs.writeFileSync(staging, JSON.stringify({ tasks }));
    fs.renameSync(staging, storeFile);
  };
  fs.writeFileSync(clock, String(initial));
  // Only this owned child process sees the controllable clock. Wall timers stay real.
  fs.writeFileSync(preload, `import fs from "node:fs";\nconst OriginalDate=Date;\nlet stamp, anchor=OriginalDate.now();\nconst now=()=>{const next=Number(fs.readFileSync(process.env.SMOKE_CLOCK,"utf8"));if(next!==stamp){stamp=next;anchor=OriginalDate.now();}return stamp+OriginalDate.now()-anchor;};\nglobalThis.Date=class extends OriginalDate { constructor(...args){super(...(args.length?args:[now()]));} static now(){return now();} };\n`);
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length;
      const block = creators && /create owned fixture/.test(JSON.stringify(body.messages.at(-1)))
        ? { type: "tool_use", id: "owned-create", name: "cron_create", input: { cron: "* * * * *", prompt: "owned creator task", recurring: true, durable: true } }
        : durable ? { type: "text", text: "durable fixture complete" }
        : index === 1 ? { type: "tool_use", id: "cron-create", name: "cron_create", input: { cron: "* * * * *", prompt: "scheduled fixture task", recurring: true } }
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
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { SMOKE_CLOCK: clock, LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/scheduler",
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate",
    LLM_EFFORT: "medium", LLM_THINKING: "false" });
  const launch = (extra = []) => {
    stderr = ""; stdout = ""; done = false;
    child = spawn(process.execPath, ["--import", preload,
      ...(compiled ? [path.join(root, "bin/litcode.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
      "--workspace", workspace, ...(extra.includes("--resume") ? [] : ["--user-dir", path.join(workspace, "user")]), "--interactive", ...extra],
      { cwd: root, stdio: ["pipe", "pipe", "pipe"], env });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-32000); wake?.(); });
    return new Promise((resolve, reject) => { child.on("error", reject); child.on("close", code => { done = true; wake?.(); resolve(code); }); });
  };
  let exited = launch();
  await wait(() => stderr.includes("Personal harness."));
  const inspect = async expected => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const offset = stdout.length;
      child.stdin.write("/cron\n");
      await wait(() => stdout.slice(offset).includes('"jobs"'));
      const payload = stdout.slice(offset).split("\n").find(line => line.startsWith('{"jobs":'));
      if (payload) {
        const jobs = JSON.parse(payload).jobs;
        if (expected === undefined ? jobs.length === 0 : jobs.some(row => row.prompt === expected)) return jobs;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Cron inspection did not reach ${expected ?? "empty"}`);
  };
  if (creators) {
    creator = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
    await once(creator, "spawn");
    creatorExited = once(creator, "exit");
    const foreign = { id: "80000000", cron: "* * * * *", prompt: "live foreign task", createdAt: initial,
      recurring: true, permanent: true, createdBySessionId: randomUUID(), createdByPid: creator.pid,
      createdByProcStart: birth(creator.pid), createdInProject: workspace };
    replaceStore([foreign]);
    await inspect(foreign.prompt);
    fs.writeFileSync(clock, String(initial + 90_000));
    child.stdin.write("/cron\n");
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(requests.length, 0, "a live foreign creator remains silent even when this session holds the lease");
    assert.equal(JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks[0].lastFiredAt, undefined);
    creator.kill(); await creatorExited; creator = undefined;
    await wait(() => requests.length === 1 && stderr.includes("event finished: end_turn"));
    assert.match(JSON.stringify(requests[0].messages.at(-1)), /live foreign task/);
    child.stdin.write("create owned fixture\n");
    await wait(() => requests.length === 3 && stderr.includes("finished: end_turn"));
    const leaseFile = path.join(workspace, ".harness/scheduled_tasks.lock");
    const firstOwner = JSON.parse(fs.readFileSync(leaseFile, "utf8")).sessionId;
    const own = JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks.find(row => row.prompt === "owned creator task");
    assert.equal(own.createdBySessionId, firstOwner);
    assert.equal(own.createdByPid, child.pid);
    assert.equal(own.createdByProcStart, birth(child.pid));
    const clearOffset = stderr.length;
    child.stdin.write("/clear\n");
    await wait(() => stderr.slice(clearOffset).includes("session: "));
    const successor = JSON.parse(fs.readFileSync(leaseFile, "utf8")).sessionId;
    assert.notEqual(successor, firstOwner);
    const rows = await inspect("owned creator task");
    const ownedDeadline = rows.find(row => row.id === own.id).nextAt;
    fs.writeFileSync(clock, String(ownedDeadline));
    await wait(() => requests.some(body => /owned creator task/.test(JSON.stringify(body.messages.at(-1))))
      && JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks.some(row => row.id === own.id && row.lastFiredAt >= ownedDeadline));
    child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
    const restartAt = ownedDeadline + 1_000;
    fs.writeFileSync(clock, String(restartAt));
    exited = launch(["--resume", firstOwner]);
    await wait(() => stderr.includes("Personal harness."));
    const resumeDeadline = Date.now() + 5_000;
    while (JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks.find(row => row.id === own.id)?.createdByPid !== child.pid) {
      assert.ok(Date.now() < resumeDeadline, "original-session resume refreshes creator PID");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const refreshed = JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks.find(row => row.id === own.id);
    assert.equal(refreshed.createdByProcStart, birth(child.pid));
    const beforeResume = requests.length;
    const resumeJobs = await inspect("owned creator task");
    fs.writeFileSync(clock, String(Math.max(restartAt, resumeJobs.find(row => row.id === own.id).nextAt)));
    await wait(() => requests.slice(beforeResume).some(body => /owned creator task/.test(JSON.stringify(body.messages.at(-1))))
      && stderr.includes("event finished: end_turn"));
    child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
    assert.equal(fs.existsSync(leaseFile), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, creatorEligibility: true, liveCreatorExcluded: true,
      creatorExitTakeover: true, ownedBirthWritten: true, clearHistory: true, originalResumeRefresh: true,
      modelRequests: requests.length, gateway: "owned loopback SSE", locksReleased: true }));
  } else if (durable) {
    await wait(() => stderr.includes("event finished: end_turn"));
    assert.equal(requests.length, 1);
    assert.match(JSON.stringify(requests[0].messages.at(-1)), /missed fixture task/);
    assert.deepEqual(JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks, []);
    const scheduled = { id: "80000000", cron: "* * * * *", prompt: "external original",
      createdAt: initial, recurring: true, permanent: true, createdBySessionId: "previous-session", createdInProject: workspace };
    replaceStore([scheduled]);
    const jobs = await inspect("external original");
    assert.equal(jobs[0].nextAt, initial + 75_000);
    replaceStore([{ ...scheduled, prompt: "external updated" }]);
    assert.equal((await inspect("external updated"))[0].nextAt, jobs[0].nextAt);
    fs.unlinkSync(storeFile);
    await inspect(undefined);
    replaceStore([{ ...scheduled, prompt: "external recreated" }]);
    await inspect("external recreated");
    const fireAt = initial + 75_000;
    fs.writeFileSync(clock, String(fireAt));
    await wait(() => requests.length === 2 && stderr.split("event finished: end_turn").length === 3);
    assert.match(JSON.stringify(requests[1].messages.at(-1)), /external recreated/);
    const deadline = Date.now() + 5_000;
    while ((JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks[0]?.lastFiredAt ?? 0) < fireAt) {
      assert.ok(Date.now() < deadline, "the recurring fire is persisted");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const stored = JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks[0];
    assert.equal(stored.permanent, true);
    assert.equal(stored.createdBySessionId, "previous-session");
    const leaseFile = path.join(workspace, ".harness/scheduled_tasks.lock");
    const firstOwner = JSON.parse(fs.readFileSync(leaseFile, "utf8")).sessionId;
    const clearOffset = stderr.length;
    child.stdin.write("/clear\n");
    await wait(() => stderr.slice(clearOffset).includes("session: "));
    assert.notEqual(JSON.parse(fs.readFileSync(leaseFile, "utf8")).sessionId, firstOwner);
    const successorJobs = await inspect("external recreated");
    fs.writeFileSync(clock, String(successorJobs[0].nextAt));
    await wait(() => requests.length === 3 && stderr.split("event finished: end_turn").length === 4);
    assert.match(JSON.stringify(requests[2].messages.at(-1)), /external recreated/);
    child.stdin.end("/exit\n");
    assert.equal(await exited, 0);
    child = undefined;
    assert.equal(fs.existsSync(path.join(workspace, ".harness/scheduled_tasks.lock")), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, durableWatch: true, startupCatchupOnce: true,
      atomicReplacement: true, unlinkAndRecreate: true, metadataPreserved: true, locksReleased: true,
      modelRequests: requests.length, gateway: "owned loopback SSE" }));
  } else {
  child.stdin.write("schedule fixture task\n");
  await wait(() => stderr.includes("finished: end_turn"));
  const inspectOffset = stdout.length;
  child.stdin.write("/cron\n");
  await wait(() => stdout.slice(inspectOffset).includes("humanSchedule"));
  const result = requests[2].messages.at(-1).content.find(block => block.type === "tool_result");
  const listed = JSON.parse(typeof result.content === "string" ? result.content : result.content[0].text).jobs;
  assert.equal(listed.length, 1);
  job = listed[0];
  const fraction = parseInt(job.id.slice(0, 8), 16) / 0x100000000;
  assert.equal(job.nextAt, Math.floor(initial + 60000 + fraction * 30000));
  fs.writeFileSync(clock, String(initial + 58000));
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
  }
} finally {
  child?.kill("SIGKILL");
  if (creator && creator.exitCode === null && creator.signalCode === null) { creator.kill(); await creatorExited; }
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  fs.rmSync(fixture, { recursive: true, force: true });
}
