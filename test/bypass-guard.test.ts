import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BYPASS_ROOT_REFUSAL,
  bypassRequested,
  CONTAINER_MARKERS,
  isRootOutsideDeliberateSandbox,
  refuseBypassUnderRoot,
  SANDBOX_OPT_IN,
} from "../src/bypass-guard.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const noMarkers = { exists: () => false };

test("only the mode that skips every check counts as a bypass request", () => {
  assert.equal(bypassRequested({ mode: "bypass" }), true);
  for (const mode of ["default", "plan", "acceptEdits", "ask", ""]) {
    assert.equal(bypassRequested({ mode }), false, mode);
  }
  assert.equal(bypassRequested({}), false);
  assert.equal(bypassRequested(undefined), false);
});

test("root outside a container is refused and everyone else is not", () => {
  assert.equal(isRootOutsideDeliberateSandbox({ uid: 0, env: {}, ...noMarkers }), true);
  assert.equal(isRootOutsideDeliberateSandbox({ uid: 1000, env: {}, ...noMarkers }), false);
  assert.equal(isRootOutsideDeliberateSandbox({ uid: undefined, env: {}, ...noMarkers }), false);
});

test("a container or the explicit opt-in is the deliberate sandbox", () => {
  for (const marker of CONTAINER_MARKERS) {
    assert.equal(isRootOutsideDeliberateSandbox({ uid: 0, env: {}, exists: file => file === marker }), false, marker);
  }
  assert.equal(isRootOutsideDeliberateSandbox({ uid: 0, env: { [SANDBOX_OPT_IN]: "1" }, ...noMarkers }), false);
  // The opt-in has to be the literal 1; anything else is not an opt-in.
  assert.equal(isRootOutsideDeliberateSandbox({ uid: 0, env: { [SANDBOX_OPT_IN]: "0" }, ...noMarkers }), true);
  assert.equal(isRootOutsideDeliberateSandbox({ uid: 0, env: { [SANDBOX_OPT_IN]: "yes" }, ...noMarkers }), true);
  // An unreadable marker is not evidence of a sandbox.
  assert.equal(isRootOutsideDeliberateSandbox({ uid: 0, env: {}, exists: () => { throw new Error("EACCES"); } }), true);
});

test("the refusal only fires for a bypass request made by root", () => {
  assert.deepEqual(refuseBypassUnderRoot({ mode: "default" }, { uid: 0, env: {}, ...noMarkers }), { refused: false });
  assert.deepEqual(refuseBypassUnderRoot({ mode: "bypass" }, { uid: 1000, env: {}, ...noMarkers }), { refused: false });
  assert.deepEqual(refuseBypassUnderRoot({ mode: "bypass" }, { uid: 0, env: { [SANDBOX_OPT_IN]: "1" }, ...noMarkers }),
    { refused: false });
  assert.deepEqual(refuseBypassUnderRoot({ mode: "bypass" }, { uid: 0, env: {}, ...noMarkers }),
    { refused: true, message: BYPASS_ROOT_REFUSAL });
  // The real environment is not root, so the default probe refuses nothing here.
  assert.deepEqual(refuseBypassUnderRoot({ mode: "bypass" }), { refused: false });
});

test("the CLI refuses the mode before it starts anything", async (t) => {
  // The guard reads the real uid, so the uid is replaced in the child before
  // the CLI is loaded. Nothing in the product is configurable to fake this.
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "harness-bypass-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const preload = "data:text/javascript," + encodeURIComponent("process.getuid=()=>0;\n");
  const run = (args: string[]): Promise<{ code: number | null; stderr: string }> =>
    new Promise(resolve => {
      const env: NodeJS.ProcessEnv = { ...process.env, LLM_API_KEY: "owned-bypass-fixture", LLM_MODEL: "fixture/bypass",
        LLM_BASE_URL: "http://127.0.0.1:1", LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate" };
      for (const marker of CONTAINER_MARKERS) delete env[marker];
      delete env[SANDBOX_OPT_IN];
      const child = spawn(process.execPath,
        ["--import", preload, "--import", "tsx", path.join(ROOT, "src/cli.ts"),
          "--workspace", workspace, ...args, "fixture task"],
        { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
      let stderr = "";
      child.stderr.on("data", chunk => { stderr += String(chunk); });
      child.once("close", code => resolve({ code, stderr }));
    });

  const refused = await run(["--permission-mode", "bypass"]);
  assert.equal(refused.code, 1, refused.stderr);
  assert.match(refused.stderr, /cannot be used with root\/sudo privileges outside a container/);
  // Nothing ran: the refusal is not a failed request.
  assert.doesNotMatch(refused.stderr, /ECONNREFUSED|fetch failed/);

  // The ordinary modes are untouched by the same uid.
  const plan = await run(["--permission-mode", "plan"]);
  assert.doesNotMatch(plan.stderr, /root\/sudo privileges/);
  assert.notEqual(plan.code, 1);
});
