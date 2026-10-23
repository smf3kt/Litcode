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
const deliveryFailure = process.argv.includes("--delivery-failure");
const idle = process.argv.includes("--idle");
const headlessIdle = process.argv.includes("--idle-headless");
const headlessWakeup = process.argv.includes("--wakeup-headless");
const headlessStop = process.argv.includes("--stop-pending");
const headlessInterrupt = process.argv.includes("--interrupt-wait");
const headlessBudget = process.argv.includes("--budget");
const headlessNoRearm = process.argv.includes("--no-rearm");
const headlessStream = process.argv.includes("--stream");
const headlessSchema = process.argv.includes("--schema");
const wakeupTiming = process.argv.includes("--wakeup-timing");
const keepalive = process.argv.includes("--keepalive");
const keepaliveDisabled = process.argv.includes("--keepalive-disabled");
const wakeupChain = wakeupTiming || process.argv.includes("--wakeup");
const durable = deliveryFailure || idle || headlessIdle || headlessWakeup || creators || process.argv.includes("--durable");
const fixture = fs.realpathSync(fs.mkdtempSync(path.join(process.env.CLAUDE_JOB_DIR ? path.join(process.env.CLAUDE_JOB_DIR, "tmp") : os.tmpdir(), "scheduler-cli-")));
const workspace = path.join(fixture, "workspace");
const clock = path.join(fixture, "clock");
const preload = path.join(fixture, "clock.mjs");
let child, creator, creatorExited, server, wake, job, releaseResponse, continueChain = true;
const birth = pid => execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
  timeout: 1000, encoding: "utf8", env: { ...process.env, LC_ALL: "C", TZ: "UTC" },
}).trim();
let stderr = "", stdout = "", done = false;
const requests = [];
const initial = new Date(2024, 0, 1, 0, 0, wakeupTiming ? 30 : 0).getTime();
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
  if (durable) fs.writeFileSync(storeFile, JSON.stringify({ tasks: headlessWakeup ? [{ id: "headless-cron", cron: "* * * * *",
    prompt: "ordinary cron must stay idle", createdAt: initial - 600_000 }] : deliveryFailure || creators || idle || headlessIdle ? [] : [{ id: "deadbeef", cron: "0 0 * * *",
    prompt: "missed fixture task", createdAt: initial - 2 * 86400000 }] }));
  const replaceStore = tasks => {
    const staging = path.join(fixture, "store-next.json");
    fs.writeFileSync(staging, JSON.stringify({ tasks }));
    fs.renameSync(staging, storeFile);
  };
  fs.writeFileSync(clock, String(initial));
  // Only this owned child process sees the controllable clock. Wall timers stay real.
  fs.writeFileSync(preload, `import fs from "node:fs";\nconst OriginalDate=Date;\nlet stamp, anchor=OriginalDate.now();\nconst now=()=>{const next=Number(fs.readFileSync(process.env.SMOKE_CLOCK,"utf8"));if(next!==stamp){stamp=next;anchor=OriginalDate.now();}return stamp+(process.env.SMOKE_CLOCK_FROZEN==="true"?0:OriginalDate.now()-anchor);};\nglobalThis.Date=class extends OriginalDate { constructor(...args){super(...(args.length?args:[now()]));} static now(){return now();} };\n`);
  const failurePreload = path.join(fixture, "delivery-failure.mjs");
  if (deliveryFailure) fs.writeFileSync(failurePreload, `import {LocalScheduler} from ${JSON.stringify(new URL(compiled ? "../dist/scheduler.js" : "../src/scheduler.ts", import.meta.url).href)};\nconst tick=LocalScheduler.prototype.tick;let armed=false,failed=false;LocalScheduler.prototype.tick=function(){if(!armed){armed=true;const original=this.onPrompt;this.onPrompt=(prompt,...args)=>{if(prompt===\"failed durable once\"&&!failed){failed=true;throw Error(\"\");}return original(prompt,...args);};}return tick.call(this);};\n`);
  server = http.createServer((req, res) => {
    const chunks = []; req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks)); requests.push(body);
      const index = requests.length;
      const latest = body.messages.at(-1)?.content;
      const resultTurn = Array.isArray(latest) && latest.some(block => block.type === "tool_result");
      const block = headlessWakeup
        ? index === 1 || index === 3 && !headlessNoRearm
          ? { type: "tool_use", id: `headless-wakeup-${index}`, name: "schedule_wakeup",
            input: { delaySeconds: 60, prompt: "headless dynamic fixture", reason: "Await owned headless fixture", noop: false } }
          : index === 4 && headlessStop
            ? { type: "tool_use", id: "headless-stop", name: "schedule_wakeup", input: { stop: true } }
            : { type: "text", text: headlessSchema ? '{"done":true}' : "headless dynamic complete" }
        : keepalive
        ? !resultTurn && /stop keepalive fixture/.test(JSON.stringify(latest))
          ? { type: "tool_use", id: `keepalive-stop-${index}`, name: "schedule_wakeup", input: { stop: true } }
          : !resultTurn && /arm keepalive fixture/.test(JSON.stringify(latest))
            ? { type: "tool_use", id: `keepalive-arm-${index}`, name: "schedule_wakeup",
              input: { delaySeconds: 60, prompt: "idle keepalive fixture", reason: "Await owned fixture", noop: false } }
            : { type: "text", text: "keepalive fixture complete" }
        : wakeupChain
        ? !resultTurn && /stop wakeup fixture/.test(JSON.stringify(latest))
          ? { type: "tool_use", id: `wakeup-stop-${index}`, name: "schedule_wakeup", input: { stop: true } }
          : !resultTurn && /(?:dynamic chain fixture|arm wakeup fixture)/.test(JSON.stringify(latest)) && continueChain
            ? { type: "tool_use", id: `wakeup-${index}`, name: "schedule_wakeup",
              input: { delaySeconds: wakeupTiming ? 300 : 3600, prompt: "dynamic chain fixture", reason: "Continue owned chain fixture", noop: true } }
            : { type: "text", text: "wakeup fixture complete" }
        : headlessIdle && index === 1
        ? { type: "tool_use", id: "headless-create", name: "cron_create", input: { cron: "* * * * *", prompt: "headless held task", recurring: true, durable: true } }
        : creators && /create owned fixture/.test(JSON.stringify(body.messages.at(-1)))
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
      const payload = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
      const respond = () => { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(payload); };
      if (idle && /hold idle fixture/.test(JSON.stringify(body.messages.at(-1))) || headlessIdle && index === 2) releaseResponse = respond;
      else respond();
      wake?.();
    });
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^(LLM_|ANTHROPIC_)/.test(key)) delete env[key];
  Object.assign(env, { SMOKE_CLOCK: clock, SMOKE_CLOCK_FROZEN: String(headlessWakeup || keepalive || wakeupChain && !wakeupTiming),
    HARNESS_LOOP_KEEPALIVE: keepaliveDisabled ? "off" : keepalive ? "on" : "off",
    LLM_API_KEY: "owned-fixture", LLM_MODEL: "smoke/scheduler",
    LLM_BASE_URL: `http://127.0.0.1:${server.address().port}`, LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate",
    LLM_EFFORT: "medium", LLM_THINKING: "false" });
  const launch = (extra = []) => {
    stderr = ""; stdout = ""; done = false;
    child = spawn(process.execPath, ["--import", preload,
      ...(!compiled ? ["--import", "tsx"] : []), ...(deliveryFailure ? ["--import", failurePreload] : []),
      path.join(root, compiled ? "bin/litcode.mjs" : "src/cli.ts"),
      "--workspace", workspace, ...(extra.includes("--resume") ? [] : ["--user-dir", path.join(workspace, "user")]), ...(headlessIdle ? ["hold headless fixture"] : headlessWakeup
        ? ["--output-format", headlessStream ? "stream-json" : "json",
          ...(headlessSchema ? ["--json-schema", '{"type":"object","properties":{"done":{"type":"boolean"}},"required":["done"],"additionalProperties":false}'] : []),
          ...(headlessBudget ? ["--max-model-calls", "2"] : []), "arm headless dynamic fixture"] : ["--interactive"]), ...extra],
      { cwd: root, stdio: ["pipe", "pipe", "pipe"], env });
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-64000); wake?.(); });
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-32000); wake?.(); });
    return new Promise((resolve, reject) => { child.on("error", reject); child.on("close", code => { done = true; wake?.(); resolve(code); }); });
  };
  let exited = launch();
  if (!headlessIdle && !headlessWakeup) await wait(() => stderr.includes("Personal harness."));
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
  if (headlessWakeup) {
    const beforeStore = fs.readFileSync(storeFile, "utf8");
    const resultAt = index => {
      const content = requests[index].messages.at(-1).content;
      const block = content.find(item => item.type === "tool_result");
      assert.equal(block.is_error, undefined);
      return JSON.parse(typeof block.content === "string" ? block.content : block.content[0].text);
    };
    child.stdin.end();
    await wait(() => requests.length >= 2);
    const first = resultAt(1);
    assert.equal(first.clampedDelaySeconds, 60);
    if (headlessInterrupt) {
      await new Promise(resolve => setTimeout(resolve, 150));
      child.kill("SIGINT");
      assert.equal(await exited, 130);
    } else if (headlessBudget) {
      assert.equal(await exited, 0, "an exactly exhausted budget permits the completed result and ends waiting");
    } else {
      await new Promise(resolve => setTimeout(resolve, 200));
      assert.equal(done, false, "the closed input retains a pending dynamic wakeup");
      fs.writeFileSync(clock, String(first.scheduledFor));
      await wait(() => requests.length >= (headlessNoRearm ? 3 : 4));
      assert.match(JSON.stringify(requests[2].messages.at(-1)), /headless dynamic fixture/);
      if (headlessStop) {
        await wait(() => requests.length === 5);
        assert.equal(resultAt(4).cancelledWakeups, 1);
        assert.equal(resultAt(4).stopped, true);
      } else if (!headlessNoRearm) {
        const second = resultAt(3);
        assert.equal(second.scheduledFor, first.scheduledFor + 60_000);
        fs.writeFileSync(clock, String(second.scheduledFor));
        await wait(() => requests.length === 5);
        assert.match(JSON.stringify(requests[4].messages.at(-1)), /headless dynamic fixture/);
      }
      assert.equal(await exited, 0);
    }
    child = undefined;
    const stream = headlessStream ? stdout.trim().split("\n").map(line => JSON.parse(line)) : [];
    const result = headlessStream ? stream.find(event => event.type === "result").result : JSON.parse(stdout.trim());
    if (headlessStream) assert.equal(stream.filter(event => event.type === "result").length, 1);
    if (headlessSchema) assert.deepEqual(result.structured_output, { done: true });
    assert.equal(result.reason, headlessInterrupt ? "aborted" : "end_turn");
    assert.equal(result.model_calls, requests.length);
    assert.equal(fs.readFileSync(storeFile, "utf8"), beforeStore, "ordinary file cron remains untouched at EOF");
    assert.equal(fs.existsSync(path.join(workspace, ".harness/scheduled_tasks.lock")), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, headlessWakeup: true, stopPending: headlessStop,
      interrupted: headlessInterrupt, exhaustedBudget: headlessBudget, omittedRearmEnds: headlessNoRearm,
      streamOutput: headlessStream, structuredOutput: headlessSchema,
      ordinaryCronUntouched: true, locksReleased: true, modelRequests: requests.length, gateway: "owned loopback SSE" }));
  } else if (keepalive) {
    let completed = 0;
    const waitTurn = async () => {
      completed++;
      await wait(() => stderr.split("finished: end_turn").length - 1 >= completed);
    };
    const lastResult = () => {
      const block = requests.at(-1).messages.at(-1).content.find(item => item.type === "tool_result");
      assert.equal(block.is_error, undefined);
      return JSON.parse(typeof block.content === "string" ? block.content : block.content[0].text);
    };
    const armAndFire = async () => {
      child.stdin.write("arm keepalive fixture\n");
      await waitTurn();
      const result = lastResult();
      assert.equal(result.clampedDelaySeconds, 60);
      fs.writeFileSync(clock, String(result.scheduledFor));
      await waitTurn();
      assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /idle keepalive fixture/);
      return result.scheduledFor;
    };
    let due = await armAndFire();
    if (keepaliveDisabled) {
      const before = requests.length;
      fs.writeFileSync(clock, String(due + 1_260_000));
      await new Promise(resolve => setTimeout(resolve, 1200));
      assert.equal(requests.length, before, "disabled keepalive leaves the loop idle");
    } else {
      const before = requests.length;
      fs.writeFileSync(clock, String(due + 1_140_000));
      await new Promise(resolve => setTimeout(resolve, 1200));
      assert.equal(requests.length, before, "fallback waits for its source 1200-second deadline");
      fs.writeFileSync(clock, String(due + 1_200_000));
      await waitTurn();
      assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /idle keepalive fixture/);
      const exhausted = requests.length;
      fs.writeFileSync(clock, String(due + 2_460_000));
      await new Promise(resolve => setTimeout(resolve, 1200));
      assert.equal(requests.length, exhausted, "a second omitted rearm ends the loop");
      due = await armAndFire();
      child.stdin.write("stop keepalive fixture\n");
      await waitTurn();
      assert.equal(lastResult().cancelledWakeups, 1, "explicit rearm restores one fallback budget");
      assert.equal(lastResult().stopped, true);
      const stopped = requests.length;
      fs.writeFileSync(clock, String(due + 1_260_000));
      await new Promise(resolve => setTimeout(resolve, 1200));
      assert.equal(requests.length, stopped, "stop clears the pending fallback");
    }
    child.stdin.end("/exit\n");
    assert.equal(await exited, 0); child = undefined;
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, keepalive: !keepaliveDisabled, disabledGate: keepaliveDisabled,
      fallbackSeconds: 1200, oneFallbackBudget: true, locksReleased: true, modelRequests: requests.length,
      gateway: "owned loopback SSE" }));
  } else if (wakeupChain) {
    let completed = 0;
    const results = () => requests.flatMap(request => {
      const content = request.messages.at(-1)?.content;
      return Array.isArray(content) ? content.filter(block => block.type === "tool_result").map(block => {
        assert.equal(block.is_error, undefined);
        return JSON.parse(typeof block.content === "string" ? block.content : block.content[0].text);
      }) : [];
    });
    const waitTurn = async () => {
      completed++;
      await wait(() => stderr.split("finished: end_turn").length - 1 >= completed);
      return results().at(-1);
    };
    child.stdin.write("arm wakeup fixture\n");
    let result = await waitTurn();
    if (wakeupTiming) {
      assert.equal(result.clampedDelaySeconds, 300);
      assert.equal(result.wasClamped, false);
      assert.equal(result.scheduledFor, initial + 270_000, "the source cache lead selects the earlier minute");
      const due = result.scheduledFor;
      const before = requests.length;
      fs.writeFileSync(clock, String(due - 1000));
      await new Promise(resolve => setTimeout(resolve, 350));
      assert.equal(requests.length, before);
      continueChain = false;
      fs.writeFileSync(clock, String(due));
      await waitTurn();
      assert.match(JSON.stringify(requests.at(-1).messages.at(-1)), /dynamic chain fixture/);
      continueChain = true;
      child.stdin.write("arm wakeup fixture\n");
      result = await waitTurn();
      assert.equal(result.scheduledFor, due + 240_000);
    } else {
      assert.ok(result.scheduledFor >= initial + 3_600_000);
      let lastFireAt;
      for (let hour = 1; hour <= 168; hour++) {
        lastFireAt = result.scheduledFor;
        fs.writeFileSync(clock, String(lastFireAt));
        result = await waitTurn();
        assert.equal(result.scheduledFor === 0, hour === 168, `chain age ${hour}h`);
      }
      const expiredRequests = requests.length;
      fs.writeFileSync(clock, String(lastFireAt + 60_001));
      await new Promise(resolve => setTimeout(resolve, 1100));
      assert.equal(requests.length, expiredRequests, "an expired chain has no armed wakeup");
      child.stdin.write("arm wakeup fixture\n");
      result = await waitTurn();
      assert.ok(result.scheduledFor > 0, "a stale aged-out tombstone permits a new chain");
    }
    const cancelledAt = result.scheduledFor;
    child.stdin.write("stop wakeup fixture\n");
    result = await waitTurn();
    assert.equal(result.stopped, true);
    assert.equal(result.cancelledWakeups, 1);
    const stoppedRequests = requests.length;
    fs.writeFileSync(clock, String(cancelledAt + 3_600_000));
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert.equal(requests.length, stoppedRequests);
    child.stdin.write("stop wakeup fixture\n");
    result = await waitTurn();
    assert.equal(result.stopped, true);
    assert.equal(result.cancelledWakeups, 0);
    continueChain = false;
    child.stdin.end("/exit\n");
    assert.equal(await exited, 0); child = undefined;
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, wakeupChain: true,
      ...(wakeupTiming ? { sourceTiming: true, minuteCeilingAndCacheLead: true } : { continuousHours: 168, expiredWithoutRearm: true }),
      stopAndRestart: true, noopAccepted: true, modelRequests: requests.length,
      gateway: "owned loopback SSE", locksReleased: true }));
  } else if (headlessIdle) {
    await wait(() => requests.length === 2 && releaseResponse !== undefined);
    const before = JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks;
    assert.equal(before.length, 1);
    assert.equal(before[0].prompt, "headless held task");
    fs.writeFileSync(clock, String(initial + 210_000));
    await new Promise(resolve => setTimeout(resolve, 2200));
    assert.deepEqual(JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks, before);
    releaseResponse(); releaseResponse = undefined;
    assert.equal(await exited, 0); child = undefined;
    assert.equal(requests.length, 2);
    assert.equal(fs.existsSync(path.join(workspace, ".harness/scheduled_tasks.lock")), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, headlessIdleDelivery: true, busyDiskUnchanged: true,
      modelRequests: requests.length, gateway: "owned loopback SSE", locksReleased: true }));
  } else if (idle) {
    const task = { id: "80000000", cron: "* * * * *", prompt: "idle recurring task", createdAt: initial,
      recurring: true, permanent: true };
    replaceStore([task]);
    const original = (await inspect(task.prompt))[0];
    const busyAt = initial + 210_000;
    child.stdin.write("hold idle fixture\n");
    await wait(() => requests.length === 1 && releaseResponse !== undefined);
    fs.writeFileSync(clock, String(busyAt));
    await new Promise(resolve => setTimeout(resolve, 2200));
    assert.equal(requests.length, 1, "a busy model does not receive another scheduled request");
    assert.deepEqual(JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks, [task], "busy ticks do not stamp a recurring file row");
    releaseResponse(); releaseResponse = undefined;
    await wait(() => requests.length === 2 && stderr.includes("event finished: end_turn"));
    assert.match(JSON.stringify(requests[1].messages.at(-1)), /idle recurring task/);
    const jobs = await inspect(task.prompt);
    assert.equal(original.nextAt, initial + 75_000);
    assert.equal(jobs[0].nextAt, initial + 255_000, "rescheduling starts from the actual idle fire time");
    const deadline = Date.now() + 5_000;
    while ((JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks[0]?.lastFiredAt ?? 0) < busyAt) {
      assert.ok(Date.now() < deadline, "idle delivery writes its actual fire time");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    fs.writeFileSync(clock, String(initial + 245_000));
    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(requests.length, 2, "elapsed busy occurrences produce one deferred turn");
    fs.writeFileSync(clock, String(jobs[0].nextAt));
    await wait(() => requests.length === 3 && stderr.split("event finished: end_turn").length === 3);
    child.stdin.end("/exit\n"); assert.equal(await exited, 0); child = undefined;
    assert.equal(fs.existsSync(path.join(workspace, ".harness/scheduled_tasks.lock")), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, idleDelivery: true, busyDiskUnchanged: true,
      oneDeferredFire: true, nextFromIdleFire: true, modelRequests: requests.length,
      gateway: "owned loopback SSE", locksReleased: true }));
  } else if (creators) {
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
  } else if (deliveryFailure) {
    const failed = { id: "bad00000", cron: "* * * * *", prompt: "failed durable once", createdAt: initial };
    const good = { id: "good0000", cron: "* * * * *", prompt: "other durable once", createdAt: initial };
    replaceStore([failed, good]);
    await inspect(failed.prompt);
    fs.writeFileSync(clock, String(initial + 60_000));
    await wait(() => requests.length === 1 && stderr.includes("event finished: end_turn"));
    assert.match(JSON.stringify(requests[0].messages.at(-1)), /other durable once/);
    const deadline = Date.now() + 5000;
    while (JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks.some(task => task.id === good.id)) {
      assert.ok(Date.now() < deadline, "successful sibling is removed from the file");
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.deepEqual(JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks, [failed], "an empty-message callback failure retains the durable row");
    replaceStore([{ ...failed, permanent: true }]);
    fs.writeFileSync(clock, String(initial + 120_000));
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(requests.length, 1, "same-session reload does not retry the failed one-shot");
    child.stdin.end("/exit\n"); await wait(() => done); assert.equal(await exited, 0); child = undefined;
    assert.equal(fs.existsSync(path.join(workspace, ".harness/scheduled_tasks.lock")), false);
    exited = launch();
    await wait(() => requests.length === 2 && stderr.includes("event finished: end_turn"));
    assert.match(JSON.stringify(requests[1].messages.at(-1)), /failed durable once/);
    assert.match(JSON.stringify(requests[1].messages.at(-1)), /First use the AskUserQuestion tool/);
    assert.deepEqual(JSON.parse(fs.readFileSync(storeFile, "utf8")).tasks, []);
    child.stdin.end("/exit\n"); await wait(() => done); assert.equal(await exited, 0); child = undefined;
    assert.equal(fs.existsSync(path.join(workspace, ".harness/scheduled_tasks.lock")), false);
    assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
    console.log(JSON.stringify({ cli: "passed", compiled, deliveryFailure: true, emptyErrorRetainsOneShot: true,
      successfulSiblingDelivered: true, reloadSuppressesRetry: true, restartCatchupOnce: true, modelRequests: requests.length,
      gateway: "owned loopback SSE", locksReleased: true }));
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
