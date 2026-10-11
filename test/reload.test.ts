import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultConfig } from "../src/agent.js";
import { loadPathInstructions } from "../src/config.js";
import { reloadConfig } from "../src/reload.js";

test("nested instructions follow accessed ancestors and bounded workspace imports", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nested-instructions-")));
  try {
    fs.mkdirSync(path.join(root, "src/deep"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/AGENTS.md"), "Use local patterns.\n@./notes.md\n");
    fs.writeFileSync(path.join(root, "src/notes.md"), "Imported detail");
    fs.writeFileSync(path.join(root, "src/deep/HARNESS.md"), "Keep deep behavior");
    assert.equal(loadPathInstructions(root, "src/deep/new.ts").length, 3);
    fs.writeFileSync(path.join(root, "src/deep/HARNESS.md"), "Changed deep behavior");
    assert.equal(loadPathInstructions(root, "src/deep/new.ts").at(-1)?.content, "Changed deep behavior");
    assert.deepEqual(loadPathInstructions(root, "../escape.ts"), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("reload refreshes local catalogs and policy without mutating pinned provider configuration", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "reload-config-")));
  try {
    fs.mkdirSync(path.join(root, ".harness/skills/new"), { recursive: true });
    fs.mkdirSync(path.join(root, "user"));
    fs.writeFileSync(path.join(root, "HARNESS.md"), "Reloaded instruction");
    fs.writeFileSync(path.join(root, ".harness/skills/new/SKILL.md"), "---\nname: new\ndescription: new skill\n---\nSkill body");
    fs.writeFileSync(path.join(root, ".harness/settings.json"), JSON.stringify({ model: "other", autoMemory: true, features: { media: false }, stopHookBlockCap: 2 }));
    fs.writeFileSync(path.join(root, ".harness/keybindings.json"), JSON.stringify({ "\u0013": "submit" }));
    const current = defaultConfig(root, []); current.model = "pinned"; current.configSources = { userDir: path.join(root, "user") };
    const before = JSON.stringify(current); const next = reloadConfig(current);
    assert.equal(next.model, "pinned"); assert.equal(next.autoMemory, true); assert.equal(next.features?.media, false);
    assert.equal(next.stopHookBlockCap, 2);
    assert.equal(next.keybindings?.["\u0013"], "submit");
    assert.match(next.system, /Reloaded instruction/); assert.equal(next.skills?.[0]?.name, "new");
    assert.equal(JSON.stringify(current), before);
    const policy = path.join(root, "managed.json");
    fs.writeFileSync(path.join(root, ".harness/settings.json"), "{}");
    fs.writeFileSync(policy, JSON.stringify({ allowShell: false, permissions: { mode: "default", allow: [], deny: ["write_file"] },
      features: { subagents: false }, mcpClient: { roots: false } }));
    const managed = structuredClone(current);
    managed.configSources = { ...managed.configSources, managedSettingsFile: policy, overrides: { allowShell: true,
      permissions: { mode: "bypass", allow: ["write_file"], deny: [] }, subagents: true, mcpClient: { roots: true } } };
    const enforced = reloadConfig(managed);
    assert.equal(enforced.allowShell, false); assert.equal(enforced.permissions?.mode, "default");
    assert.deepEqual(enforced.permissions?.allow, []); assert.equal(enforced.features?.subagents, false);
    assert.equal(enforced.mcpClient?.roots, false);
    fs.writeFileSync(policy, "{"); assert.throws(() => reloadConfig(enforced), /JSON/);
    assert.equal(enforced.managedPolicy?.allowShell, false);
    fs.writeFileSync(path.join(root, ".harness/settings.json"), "{}");
    fs.unlinkSync(path.join(root, ".harness/keybindings.json"));
    const reset = reloadConfig(next);
    assert.equal(reset.autoMemory, false); assert.equal(reset.features?.media, true);
    assert.equal(reset.keybindings, undefined);
    assert.equal(reset.mcpClient?.sampling, undefined); assert.equal(reset.permissions?.mode, "default");
    fs.writeFileSync(path.join(root, ".harness/settings.json"), "{");
    assert.throws(() => reloadConfig(current), /JSON/);
    assert.equal(JSON.stringify(current), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
