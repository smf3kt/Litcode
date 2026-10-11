import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tsImport } from "tsx/esm/api";
import { setTimeout as delay } from "node:timers/promises";

const { watchProjectConfig } = await tsImport("../src/config-watch.ts", import.meta.url);
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-watch-smoke-")));
let notifications = 0;
const errors = [];
fs.mkdirSync(path.join(workspace, "user"));
fs.mkdirSync(path.join(workspace, ".harness"));
const watcher = watchProjectConfig(workspace, { userDir: path.join(workspace, "user") },
  () => notifications++, error => errors.push(error.message));
try {
  await delay(100);
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "Owned smoke instructions");
  fs.writeFileSync(path.join(workspace, "AGENTS.md"), "Owned smoke agents");
  fs.writeFileSync(path.join(workspace, ".harness/settings.json"), "{}");
  const deadline = Date.now() + 3000;
  while (notifications === 0 && Date.now() < deadline) await delay(20);
  assert.equal(notifications, 1);
  await delay(400);
  assert.equal(notifications, 1);
  watcher.close();
  fs.writeFileSync(path.join(workspace, "HARNESS.md"), "After close");
  await delay(400);
  assert.equal(notifications, 1);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ configWatch: "passed", backend: "actual fs.watch", notifications,
    debounceMs: 250, closeSilent: true, network: "none" }));
} finally {
  watcher.close();
  fs.rmSync(workspace, { recursive: true, force: true });
}
