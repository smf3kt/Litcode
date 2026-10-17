// Real multiplexer decoding: the product wrapper is emitted inside tmux/screen and a second,
// outer tmux parses the forwarded bytes as OSC 0 and reports the pane title.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const job = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "hook-mux-")));
const home = path.join(job, "home");
const baseEnv = { ...process.env };
delete baseEnv.TMUX; delete baseEnv.STY; delete baseEnv.ZELLIJ;
const env = { ...baseEnv, HOME: home, TERM: "xterm-256color" };
const modulePath = path.join(root, compiled ? "dist/hook-terminal.js" : "src/hook-terminal.ts");
const nodeArgs = [...(compiled ? [] : ["--import", "tsx"]), path.join(job, "emit.mjs")];
const have = (command) => !spawnSync(command, ["-V"], { encoding: "utf8", timeout: 5000 }).error;
const servers = new Set();
const tmux = (socket, ...args) => spawnSync("tmux", ["-L", socket, ...args], { encoding: "utf8", timeout: 10_000, env });
function kill() {
  for (const socket of servers) { try { tmux(socket, "kill-server"); } catch { /* already gone */ } }
  servers.clear();
}
function title(socket) {
  const result = tmux(socket, "display", "-p", "-t", "t", "#{pane_title}");
  return result.status === 0 ? result.stdout.trim() : undefined;
}
function waitFor(socket, expected, deadline) {
  while (Date.now() < deadline) {
    if (title(socket) === expected) return true;
    sleep(150);
  }
  return false;
}

let summary;
try {
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(job, "emit.mjs"), `
    import fs from "node:fs";
    import { pathToFileURL } from "node:url";
    const { formatHookTerminalSequence } = await import(pathToFileURL(process.env.HOOK_MODULE).href);
    const ESC = "\\x1b", title = process.env.HOOK_TITLE;
    const value = ESC + "]0;" + title + ESC + "\\\\";
    const sequence = formatHookTerminalSequence(value, process.env.HOOK_MUX === "tmux" ? { TMUX: "fixture" } : { STY: "fixture" });
    if (sequence === undefined) process.exit(3);
    fs.writeFileSync(process.env.HOOK_BYTES, Buffer.from(sequence));
    const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await pause(1200);
    process.stdout.write(sequence + "HOOK-MUX-MARKER\\n");
    await pause(1800);
  `);
  const emit = path.join(job, "emit.sh");
  fs.writeFileSync(emit, `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${nodeArgs.map((arg) => JSON.stringify(arg)).join(" ")}\n`, { mode: 0o700 });
  fs.writeFileSync(path.join(job, "outer.conf"), "set -g allow-rename on\nset -g automatic-rename off\n");
  fs.writeFileSync(path.join(job, "inner.conf"), "set -g allow-passthrough all\n");
  const results = [];
  if (have("tmux") && have("screen")) {
    const outer = `ccrev-hook-outer-${process.pid}`;
    servers.add(outer);
    tmux(outer, "start-server");
    for (const mux of ["tmux", "screen"]) {
      const inner = `ccrev-hook-inner-${mux}-${process.pid}`;
      const expected = `hook-mux-${mux}-${process.pid}`;
      const bytesFile = path.join(job, `${mux}.bin`);
      const run = path.join(job, `run-${mux}.sh`);
      const module = JSON.stringify(modulePath), bytes = JSON.stringify(bytesFile);
      const launch = mux === "tmux"
        ? `exec env -u TMUX -u STY HOOK_TITLE=${expected} HOOK_MUX=tmux HOOK_MODULE=${module} HOOK_BYTES=${bytes} tmux -L ${inner} -f ${JSON.stringify(path.join(job, "inner.conf"))} new-session -A -s t ${JSON.stringify(emit)}`
        : `exec env -u TMUX -u STY HOOK_TITLE=${expected} HOOK_MUX=screen HOOK_MODULE=${module} HOOK_BYTES=${bytes} screen -S ${inner} ${JSON.stringify(emit)}`;
      fs.writeFileSync(run, `#!/bin/sh\n${launch}\nsleep 4\n`, { mode: 0o700 });
      servers.add(inner);
      // The inner multiplexer runs inside the outer tmux pane, so its forwarded bytes are parsed
      // by a second, independent terminal implementation.
      tmux(outer, "kill-session", "-t", "t");
      tmux(outer, "-f", path.join(job, "outer.conf"), "new-session", "-d", "-s", "t", run);
      assert.equal(waitFor(outer, expected, Date.now() + 10_000), true, `${mux} did not forward a decodable OSC 0 (title=${title(outer)})`);
      const emitted = fs.readFileSync(bytesFile);
      if (mux === "tmux") assert.ok(emitted.subarray(0, 7).equals(Buffer.from("\x1bPtmux;")));
      else { assert.equal(emitted[0], 0x1b); assert.equal(emitted[1], 0x50); assert.ok(emitted.includes(Buffer.from("\x1b\x1b]0;"))); }
      results.push({ mux, expected, decoded: true, sequenceSha256: hash(emitted) });
    }
    summary = { result: "passed", compiled, results, job };
  } else summary = { result: "skipped", compiled, reason: "tmux and screen are required", job };
} catch (error) {
  kill();
  fs.rmSync(job, { recursive: true, force: true });
  throw error;
}
kill();
fs.rmSync(job, { recursive: true, force: true });
summary.fixturesRemoved = !fs.existsSync(job);
if (!summary.fixturesRemoved) throw new Error("fixture cleanup failed");
console.log(JSON.stringify(summary));
