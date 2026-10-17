import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { watchProjectConfig } from "../src/config-watch.js";

function write(file: string, content = "changed"): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, "watch notification timed out");
    await delay(20);
  }
}

test("real config changes debounce, discover directories, survive replacement and close silently", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-watch-")));
  const workspace = path.join(root, "project"), userDir = path.join(root, "user");
  fs.mkdirSync(workspace);
  fs.mkdirSync(userDir);
  write(path.join(root, "explicit/settings.json"), "{}");
  const instructionPaths = [path.join(root, "HARNESS.md"), path.join(root, "imports/nested/context.md"),
    path.join(workspace, ".harness/rules/nested/imported.md")];
  const contentRoot = path.join(root, "plugin"); write(path.join(contentRoot, "skills/example/SKILL.md"));
  let count = 0;
  const errors: Error[] = [];
  const watcher = watchProjectConfig(workspace, { userDir, settingsFile: "../explicit/settings.json", instructionPaths, contentDirectories: [contentRoot] },
    () => count++, error => errors.push(error));
  try {
    await delay(100);
    write(path.join(workspace, "HARNESS.md"));
    write(path.join(workspace, "AGENTS.md"));
    write(path.join(workspace, ".harness/settings.local.json"), "{}");
    write(path.join(workspace, ".harness/skills/group/deep/example/SKILL.md"));
    await waitFor(() => count === 1);
    await delay(350);
    assert.equal(count, 1);
    const changes = [
      ".harness/settings.json", ".harness/settings.local.json", ".harness/keybindings.json", ".harness/rules/rule.md",
      ".harness/agents/agent.md", ".harness/plugins/.index.json",
      ".harness/skills/group/deep/example/SKILL.md",
    ];
    for (const file of changes) {
      const before = count;
      write(path.join(workspace, file));
      await waitFor(() => count > before);
    }
    for (const file of ["settings.json", "keybindings.json", "skills/example/SKILL.md", "agents/agent.md"]) {
      const before = count;
      write(path.join(userDir, file));
      await waitFor(() => count > before);
    }
    for (const file of instructionPaths) {
      const before = count;
      write(file, "new import");
      await waitFor(() => count > before);
      const created = count;
      write(file, "edited import");
      await waitFor(() => count > created);
    }
    const pluginBefore = count;
    write(path.join(contentRoot, "skills/example/helper.mjs"));
    await waitFor(() => count > pluginBefore);
    const pluginUpdated = count;
    write(path.join(contentRoot, "skills/example/helper.mjs"), "updated");
    await waitFor(() => count > pluginUpdated);
    const replacedBefore = count;
    write(path.join(root, "explicit/replacement.json"), "{}");
    fs.renameSync(path.join(root, "explicit/replacement.json"), path.join(root, "explicit/settings.json"));
    await waitFor(() => count > replacedBefore);
    await delay(350);
    const newRule = count;
    write(path.join(workspace, ".harness/rules/nested/unrelated.md"));
    await waitFor(() => count > newRule);
    await delay(350);
    const stable = count;
    const dynamic = path.join(workspace, "deep/discovered/detail.md"); write(dynamic, "initial");
    watcher.addInstructionPaths!([dynamic]);
    await delay(100); write(dynamic, "updated");
    await waitFor(() => count > stable);
    const newInstruction = count;
    write(path.join(path.dirname(dynamic), "AGENTS.md"), "new scoped instructions");
    await waitFor(() => count > newInstruction);
    const dynamicStable = count;
    for (const file of [".harness/memory/note.md", ".harness/attachments/file.md", ".harness/workflows/run.md",
      ".agent/session.json", ".harness/oauth/token.json", ".harness/plugins/fixture/skills/example/SKILL.md",
      ".harness/skills/group/deep/example/run.mjs", "result.txt"]) write(path.join(workspace, file));
    write(path.join(root, "explicit/unrelated.json"));
    write(path.join(root, "imports/nested/unrelated.md"));
    await delay(500);
    assert.equal(count, dynamicStable);
    write(path.join(workspace, "HARNESS.md"), "pending");
    await delay(40);
    watcher.close();
    watcher.close();
    write(path.join(workspace, "AGENTS.md"), "after close");
    await delay(400);
    assert.equal(count, dynamicStable);
    assert.deepEqual(errors, []);
  } finally { watcher.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("a file change gate delays or suppresses the reload fan-out", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-watch-gate-")));
  const workspace = path.join(root, "project");
  fs.mkdirSync(workspace);
  let count = 0;
  const gates: Array<(proceed: boolean) => void> = [];
  const errors: Error[] = [];
  const settle = (proceed: boolean): void => { while (gates.length) gates.shift()!(proceed); };
  const watcher = watchProjectConfig(workspace,
    { onFileChange: () => new Promise<boolean>(resolve => { gates.push(resolve); }) },
    () => count++, error => errors.push(error));
  try {
    await delay(100);
    write(path.join(workspace, "AGENTS.md"), "one");
    await waitFor(() => gates.length > 0);
    await delay(350);
    assert.equal(count, 0);
    settle(true);
    await waitFor(() => count === 1);
    const held = count;
    write(path.join(workspace, "AGENTS.md"), "two");
    await waitFor(() => gates.length > 0);
    settle(false);
    await delay(400);
    assert.equal(count, held);
    write(path.join(workspace, "AGENTS.md"), "three");
    await waitFor(() => gates.length > 0);
    settle(true);
    await waitFor(() => count > held);
    assert.deepEqual(errors, []);
  } finally { watcher.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("watcher reports each relevant file event with its path and kind", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-watch-events-")));
  const workspace = path.join(root, "project");
  fs.mkdirSync(workspace);
  const events: { file: string; kind: string }[] = [];
  const watcher = watchProjectConfig(workspace, { onFileChange: (file, kind) => { events.push({ file, kind }); } },
    () => {});
  try {
    await delay(100);
    const target = path.join(workspace, "AGENTS.md");
    write(target, "one");
    await waitFor(() => events.some(item => item.file === target && item.kind === "add"));
    events.length = 0;
    write(target, "two");
    await waitFor(() => events.some(item => item.file === target && (item.kind === "change" || item.kind === "add")));
    events.length = 0;
    fs.unlinkSync(target);
    await waitFor(() => events.some(item => item.file === target && item.kind === "unlink"));
    assert.ok(events.every(item => item.file === target));
  } finally { watcher.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test("watch bounds, symlink confinement, missing roots and optional error reporting", async t => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-watch-bounds-")));
  const workspace = path.join(root, "project"), userDir = path.join(root, "missing/user");
  fs.mkdirSync(workspace);
  write(path.join(root, "outside/SKILL.md"));
  write(path.join(workspace, ".harness/skills/local/SKILL.md"));
  fs.symlinkSync(path.join(root, "outside"), path.join(workspace, ".harness/skills/escape"));
  fs.symlinkSync(path.join(workspace, ".harness/skills"), path.join(workspace, ".harness/skills/loop"));
  for (let i = 0; i < 100; i++) write(path.join(workspace, `.harness/skills/skill-${i}/SKILL.md`));
  const original = fs.watch;
  let active = 0, maximum = 0;
  const watchMock = t.mock.method(fs, "watch", (...args: Parameters<typeof fs.watch>) => {
    const watcher = Reflect.apply(original, fs, args);
    active++;
    maximum = Math.max(maximum, active);
    const close = watcher.close.bind(watcher);
    let closed = false;
    watcher.close = () => { if (!closed) { active--; closed = true; } close(); };
    return watcher;
  });
  let count = 0;
  const errors: Error[] = [];
  const watcher = watchProjectConfig(workspace, { userDir,
    instructionPaths: Array.from({ length: 2049 }, () => path.join(workspace, "AGENTS.md")) },
    () => count++, error => errors.push(error));
  try {
    await delay(100);
    assert.ok(maximum <= 64 && maximum > 0);
    assert.ok(errors.some(error => error.message.includes("limit")));
    assert.ok(errors.some(error => error.message.includes("instruction path limit")));
    write(path.join(root, "outside/SKILL.md"), "external change");
    await delay(400);
    assert.equal(count, 0);
    write(path.join(userDir, "settings.json"), "{}");
    await waitFor(() => count > 0);
    const before = count;
    write(path.join(userDir, "settings.json"), "{\"changed\":true}");
    await waitFor(() => count > before);
    assert.ok(maximum <= 64);
    watcher.close();
    assert.equal(active, 0);
    let reported = false;
    watchProjectConfig(path.join(root, "absent"), undefined, () => assert.fail("unexpected change"), () => { reported = true; }).close();
    assert.equal(reported, true);
    watchMock.mock.restore();
  } finally { watcher.close(); fs.rmSync(root, { recursive: true, force: true }); }
});
