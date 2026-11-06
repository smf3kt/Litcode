import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const executable = fileURLToPath(new URL("../native/shell-supervisor/supervisor", import.meta.url));
if (process.platform !== "darwin") {
  const result = spawn(executable, ["/bin/true"]);
  let stderr = "";
  result.stderr.on("data", chunk => { stderr += chunk; });
  const code = await new Promise(resolve => result.on("close", resolve));
  assert.equal(code, 125);
  assert.match(stderr, /unsupported platform/);
  process.exit(0);
}

function run(command, onData = () => {}, program = "/bin/sh") {
  const child = spawn(executable, program === "/bin/sh" ? [program, "-c", command] : [program], { stdio: ["pipe", "pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "", status = "";
  child.stdio[3].on("data", chunk => { status += chunk; });
  child.stdout.on("data", chunk => { stdout += chunk; onData(stdout, child); });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr, status: status ? JSON.parse(status) : null }));
  });
  return done;
}
function absentOrZombie(pid) {
  try {
    const state = execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return !state || state.startsWith("Z");
  } catch (error) {
    if (error.status === 1) return true;
    throw error;
  }
}
const fixtureDir = mkdtempSync(join(process.env.CLAUDE_JOB_DIR, "tmp", "supervisor-gate-"));
try {
  const testBinary = join(fixtureDir, "supervisor-test");
  execFileSync("cc", ["-Wall", "-Wextra", "-Werror", "-O2", "-DSUPERVISOR_TEST_GATE", fileURLToPath(new URL("../native/shell-supervisor/supervisor.c", import.meta.url)), "-o", testBinary]);
  for (const scenario of ["success", "control-eof", "supervisor-death", "watcher-death"]) {
    const marker = join(fixtureDir, scenario);
    const child = spawn(testBinary, ["/usr/bin/touch", marker], { env: { ...process.env, SUPERVISOR_TEST_GATE: "1" }, stdio: ["pipe", "ignore", "ignore", "pipe", "pipe", "pipe"] });
    let status = "";
    child.stdio[3].on("data", chunk => { status += chunk; });
    const exit = new Promise(resolve => child.once("close", (code, signal) => resolve({ code, signal })));
    const [worker, watcher] = await new Promise(resolve => child.stdio[4].once("data", chunk => resolve(String(chunk).trim().split(/\s+/).map(Number))));
    assert.ok(worker > 1 && watcher > 1);
    assert.equal(existsSync(marker), false);
    if (scenario === "control-eof") await new Promise(resolve => child.stdin.end(resolve));
    if (scenario === "supervisor-death") child.kill("SIGKILL");
    if (scenario === "watcher-death") {
      process.kill(watcher, "SIGKILL");
      const deadline = Date.now() + 5000;
      while (!absentOrZombie(watcher) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      assert.ok(absentOrZombie(watcher));
    }
    if (scenario !== "supervisor-death") child.stdio[5].end("release");
    const result = await exit;
    if (scenario === "success") { assert.equal(result.code, 0); assert.ok(existsSync(marker)); }
    else {
      assert.equal(result.code, scenario === "supervisor-death" ? null : scenario === "control-eof" ? 130 : 125);
      const deadline = Date.now() + 5000;
      while (!absentOrZombie(worker) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(absentOrZombie(worker));
      assert.equal(existsSync(marker), false);
      if (scenario === "control-eof") assert.equal(JSON.parse(status).kind, "cancelled");
      if (scenario === "watcher-death") assert.equal(JSON.parse(status).stage, "gate");
    }
  }
  const waitFor = async (predicate, description) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      if (Date.now() >= deadline) throw new Error(`timeout: ${description}`);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  const state = pid => {
    try { return execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
    catch (error) { if (error.status === 1) return ""; throw error; }
  };
  for (const phase of ["startup", "postgrant"]) {
    for (const trigger of ["control-eof", "supervisor-death", "watcher-death"]) {
      const marker = join(fixtureDir, `${phase}-${trigger}`);
      const child = spawn(testBinary, ["/bin/sh", "-c", 'printf executed > "$1"; printf ready; exec sleep 30', "sh", marker], {
        env: { ...process.env, SUPERVISOR_TEST_PHASE: phase }, stdio: ["pipe", "pipe", "pipe", "pipe", "pipe", "pipe"]
      });
      let status = "", barrier = "", output = "", exited = false;
      child.stdio[3].on("data", chunk => { status += chunk; });
      child.stdio[4].on("data", chunk => { barrier += chunk; });
      child.stdout.on("data", chunk => { output += chunk; });
      const closed = new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", () => { exited = true; });
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      let suspended = null;
      try {
        await waitFor(() => barrier.includes("\n"), `${phase} barrier`);
        const match = barrier.match(/^(startup|postgrant) (\d+)\n/);
        assert.equal(match?.[1], phase);
        const actor = Number(match[2]);
        assert.ok(actor > 1 && child.pid > 1 && actor !== child.pid);
        const worker = phase === "postgrant" ? actor : null;
        const watcher = phase === "startup" ? actor : Number(execFileSync("ps", ["-o", "ppid=", "-p", String(worker)], { encoding: "utf8" }).trim());
        assert.ok(watcher > 1 && watcher !== child.pid);
        assert.equal(existsSync(marker), false);
        if (phase === "postgrant") {
          suspended = trigger === "supervisor-death" ? watcher : child.pid;
          process.kill(suspended, "SIGSTOP");
          await waitFor(() => state(suspended).includes("T"), "owner stopped");
        }
        if (trigger === "control-eof") child.stdin.end();
        else if (trigger === "supervisor-death") child.kill("SIGKILL");
        else {
          process.kill(watcher, "SIGKILL");
          await waitFor(() => absentOrZombie(watcher), "watcher exit");
        }
        if (trigger === "supervisor-death") await waitFor(() => exited, "supervisor exit");
        if (phase !== "startup" || trigger !== "watcher-death") child.stdio[5].write("x");
        if (phase === "postgrant") {
          await waitFor(() => output.includes("ready"), "worker exec marker");
          assert.equal(existsSync(marker), true);
        }
        if (suspended !== null) { process.kill(suspended, "SIGCONT"); suspended = null; }
        const result = await closed;
        if (trigger === "supervisor-death") { assert.equal(result.signal, "SIGKILL"); assert.equal(status, ""); }
        else if (trigger === "control-eof") { assert.equal(result.code, 130); assert.deepEqual(JSON.parse(status), { kind: "cancelled" }); }
        else { assert.equal(result.code, 125); assert.equal(JSON.parse(status).stage, "gate"); }
        if (phase === "startup") assert.equal(existsSync(marker), false);
        if (worker) await waitFor(() => absentOrZombie(worker), "worker exit");
        await waitFor(() => absentOrZombie(watcher), "watcher cleanup");
      } finally {
        if (suspended !== null) { try { process.kill(suspended, "SIGCONT"); } catch {} }
        if (!exited) child.kill("SIGKILL");
        child.stdin.destroy(); child.stdio[5].destroy();
      }
    }
  }
} finally { rmSync(fixtureDir, { recursive: true, force: true }); }
const normal = await run("printf normal; printf error >&2; exit 7");
assert.deepEqual(normal, { code: 7, signal: null, stdout: "normal", stderr: "error", status: { kind: "exit", code: 7 } });
const exit125 = await run("exit 125");
assert.deepEqual(exit125.status, { kind: "exit", code: 125 });
const setup = await run("", () => {}, "/does-not-exist");
assert.equal(setup.status.kind, "error");
assert.equal(setup.status.stage, "exec");
const signalled = await run("kill -KILL $$");
assert.equal(signalled.code, 137);
assert.deepEqual(signalled.status, { kind: "signal", signal: 9 });

const descendant = await run("/bin/sh -c 'trap \"\" TERM; echo descendant:$$; exec sleep 30' & sleep 0.1");
assert.equal(descendant.code, 0);
const descendantPid = Number(descendant.stdout.match(/descendant:(\d+)/)?.[1]);
assert.ok(descendantPid > 1);
assert.ok(absentOrZombie(descendantPid), "descendant survived supervisor cleanup");

let sent = false;
const cancelled = await run("/bin/sh -c 'trap \"\" TERM; echo cancelled:$$; exec sleep 30' & wait", (output, child) => {
  if (!sent && /cancelled:\d+/.test(output)) { sent = true; child.stdin.write("cancel"); }
});
assert.equal(cancelled.code, 130);
const cancelledPid = Number(cancelled.stdout.match(/cancelled:(\d+)/)?.[1]);
assert.ok(cancelledPid > 1);
assert.ok(absentOrZombie(cancelledPid), "cancelled descendant survived supervisor cleanup");
assert.deepEqual(cancelled.status, { kind: "cancelled" });

const doomed = spawn(executable, ["/bin/sh", "-c", "echo shell:$$; exec sleep 30"], { stdio: ["pipe", "pipe", "pipe", "pipe"] });
let supervisorStatus = "";
doomed.stdio[3].on("data", chunk => { supervisorStatus += chunk; });
const killedExit = new Promise(resolve => doomed.once("exit", (code, signal) => resolve({ code, signal })));
const deadSupervisorPid = await new Promise((resolve, reject) => {
  let output = "";
  const timer = setTimeout(() => reject(new Error("supervisor did not report shell")), 5000);
  doomed.once("error", reject);
  doomed.stdout.on("data", chunk => {
    output += chunk;
    const match = output.match(/shell:(\d+)/);
    if (match) { clearTimeout(timer); resolve(Number(match[1])); }
  });
});
try {
  doomed.kill("SIGKILL");
  const killed = await killedExit;
  assert.equal(killed.signal, "SIGKILL");
  assert.equal(supervisorStatus, "");
  assert.ok(deadSupervisorPid > 1);
  const deadline = Date.now() + 5000;
  while (!absentOrZombie(deadSupervisorPid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
  assert.ok(absentOrZombie(deadSupervisorPid), "worker survived supervisor death");
} finally {
  doomed.kill("SIGKILL");
}

const parentScript = `
  const {spawn} = require('node:child_process');
  const child = spawn(process.argv[1], ['/bin/sh','-c','echo shell:$$; exec sleep 30'], {stdio:['pipe','pipe','inherit','pipe']});
  child.stdout.pipe(process.stdout);
`;
const parent = spawn(process.execPath, ["-e", parentScript, executable], { stdio: ["ignore", "pipe", "pipe"] });
const parentPid = await new Promise((resolve, reject) => {
  let output = "";
  const timer = setTimeout(() => reject(new Error("parent did not report shell")), 5000);
  parent.once("error", reject);
  parent.stdout.on("data", chunk => {
    output += chunk;
    const match = output.match(/shell:(\d+)/);
    if (match) { clearTimeout(timer); resolve(Number(match[1])); }
  });
});
try {
  parent.kill("SIGKILL");
  await new Promise(resolve => parent.once("exit", resolve));
  const deadline = Date.now() + 5000;
  while (!absentOrZombie(parentPid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(absentOrZombie(parentPid), "shell survived parent death and control EOF");
} finally {
  parent.kill("SIGKILL");
}
console.log("shell supervisor: status, exits, parent death, cancellation and SIGKILL boundary passed");
