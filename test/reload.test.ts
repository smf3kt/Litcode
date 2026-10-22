import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { defaultConfig, DEFAULT_SYSTEM } from "../src/agent.js";
import { loadPathInstructions } from "../src/config.js";
import { reloadConfig } from "../src/reload.js";
import { buildSystem } from "../src/runtime.js";
import { reloadSkills } from "../src/skill-catalog.js";
import { modelEffort } from '../src/effort-command.js';

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
    fs.writeFileSync(path.join(root, ".harness/settings.json"), JSON.stringify({ model: "other", autoMemory: true, features: { media: false }, stopHookBlockCap: 2, prefersReducedMotion: true, maxProseWidth: 60, askUserQuestionTimeout: '5m', dialogExpiry: '10m', syntaxHighlightingDisabled: true, theme: 'light', timeFormat:'24-hour-utc', timeZone:'Asia/Tokyo', spinnerVerbs:{mode:'replace',verbs:['Owned building']}, editorMode:'vim',vimInsertModeRemaps:{jj:'<Esc>',invalid:42} }));
    fs.writeFileSync(path.join(root, ".harness/keybindings.json"), JSON.stringify({ "\u0013": "submit" }));
    const current = defaultConfig(root, []); current.model = "pinned"; current.configSources = { userDir: path.join(root, "user") };
    const before = JSON.stringify(current); const next = reloadConfig(current);
    assert.equal(next.model, "pinned"); assert.equal(next.autoMemory, true); assert.equal(next.features?.media, false);
    const inherited = { ...current, effort: 'low' as const, effortSelection: { kind: 'inherit' as const },
      modelSettings: { pinned: { effortLevel: 'low' as const } } };
    fs.writeFileSync(path.join(root, 'user/settings.json'), JSON.stringify({
      modelSettings: { pinned: { effortLevel: 'xhigh' } } }));
    const inheritedNext = reloadConfig(inherited);
    assert.equal(inheritedNext.effort, 'xhigh');
    assert.equal(inheritedNext.effort, modelEffort(inheritedNext, 'pinned'));
    assert.equal(inherited.effort, 'low', 'reload preserves the previous owner snapshot');
    const manual = reloadConfig({ ...inherited, effortSelection: { kind: 'level' } });
    assert.equal(manual.effort, 'low', 'a manually selected effort stays pinned');
    const automatic = reloadConfig({ ...inherited, effort: undefined, effortSelection: { kind: 'default' } });
    assert.equal(automatic.effort, undefined, 'auto keeps the request default');
    fs.writeFileSync(path.join(root, 'user/settings.json'), '{}');
    const cleared = reloadConfig(inheritedNext);
    assert.equal(cleared.effort, undefined, 'removing a model default clears the derived request snapshot');
    fs.unlinkSync(path.join(root, 'user/settings.json'));
    assert.equal(next.stopHookBlockCap, 2);
    assert.equal(next.prefersReducedMotion, true);
    assert.equal(next.maxProseWidth, 60);
    assert.equal(next.askUserQuestionTimeout, '5m');
    assert.equal(next.dialogExpiry, '10m');
    assert.equal(next.syntaxHighlightingDisabled, true);
    assert.equal(next.theme, 'light');
    assert.equal(next.timeFormat, '24-hour-utc'); assert.equal(next.timeZone, 'Asia/Tokyo');
    assert.deepEqual(next.spinnerVerbs, {mode:'replace',verbs:['Owned building']});
    assert.equal(next.editorMode,'vim');assert.deepEqual(next.vimInsertModeRemaps,{jj:'<Esc>',invalid:42});
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
    assert.equal(reset.prefersReducedMotion, undefined);
    assert.equal(reset.maxProseWidth, undefined);
    assert.equal(reset.askUserQuestionTimeout, undefined);
    assert.equal(reset.dialogExpiry, undefined);
    assert.equal(reset.syntaxHighlightingDisabled, undefined);
    assert.equal(reset.theme, undefined);
    assert.equal(reset.timeFormat, undefined); assert.equal(reset.timeZone, undefined);
    assert.equal(reset.spinnerVerbs, undefined);
    assert.equal(reset.editorMode,undefined);assert.equal(reset.vimInsertModeRemaps,undefined);
    fs.writeFileSync(path.join(root,'.harness/settings.json'),JSON.stringify({editorMode:'bad',vimInsertModeRemaps:42}));
    assert.equal(reloadConfig(next).editorMode,undefined);assert.equal(reloadConfig(next).vimInsertModeRemaps,undefined);
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ theme: 'invalid' }));
    assert.equal(reloadConfig(next).theme, undefined);
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ syntaxHighlightingDisabled: false }));
    assert.equal(reloadConfig(next).syntaxHighlightingDisabled, false);
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ syntaxHighlightingDisabled: 'true' }));
    assert.throws(() => reloadConfig(next), /settings\.syntaxHighlightingDisabled/);
    assert.equal(next.syntaxHighlightingDisabled, true);
    assert.equal(next.theme, 'light');
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ maxProseWidth: 'bad' }));
    assert.equal(reloadConfig(next).maxProseWidth, undefined);
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ askUserQuestionTimeout: '1h' }));
    assert.equal(reloadConfig(next).askUserQuestionTimeout, undefined);
    fs.writeFileSync(path.join(root, '.harness/settings.json'), JSON.stringify({ dialogExpiry: 'default' }));
    assert.equal(reloadConfig(next).dialogExpiry, undefined);
    assert.equal(reset.keybindings, undefined);
    assert.equal(reset.mcpClient?.sampling, undefined); assert.equal(reset.permissions?.mode, "default");
    fs.writeFileSync(path.join(root, ".harness/settings.json"), "{");
    assert.throws(() => reloadConfig(current), /JSON/);
    assert.equal(JSON.stringify(current), before);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("a skill reload rescans directories in place without reloading settings", () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "reload-skills-")));
  const user = path.join(root, "user");
  try {
    fs.mkdirSync(user);
    for (const name of ["keep", "removed"]) fs.mkdirSync(path.join(root, ".harness/skills", name), { recursive: true });
    fs.writeFileSync(path.join(root, ".harness/skills/keep/SKILL.md"), "---\nname: keep\ndescription: kept skill\n---\nKeep body");
    fs.writeFileSync(path.join(root, ".harness/skills/removed/SKILL.md"), "---\nname: removed\ndescription: removed skill\n---\nRemoved body");
    const config = defaultConfig(root, []);
    config.model = "pinned";
    config.configSources = { userDir: user };
    config.skills = [
      { name: "keep", description: "kept skill", path: path.join(root, ".harness/skills/keep/SKILL.md"), body: "Keep body", userInvocable: true, disableModelInvocation: false },
      { name: "removed", description: "removed skill", path: path.join(root, ".harness/skills/removed/SKILL.md"), body: "Removed body", userInvocable: true, disableModelInvocation: false },
    ];
    config.system = buildSystem(DEFAULT_SYSTEM, [], config.skills);
    const live = config.skills;
    fs.writeFileSync(path.join(root, ".harness/settings.json"), JSON.stringify({ model: "other" }));
    fs.rmSync(path.join(root, ".harness/skills/removed"), { recursive: true });
    fs.mkdirSync(path.join(root, ".harness/skills/added"), { recursive: true });
    fs.writeFileSync(path.join(root, ".harness/skills/added/SKILL.md"), "---\nname: added\ndescription: added skill\n---\nAdded body");
    reloadSkills(config);
    // The skill tool captured this array; the rescan must keep the reference.
    assert.equal(config.skills, live);
    assert.deepEqual([...live.map(skill => skill.name)].sort(), ["added", "keep"]);
    assert.equal(config.model, "pinned");
    assert.match(config.system, /added skill/);
    assert.match(config.system, /kept skill/);
    assert.doesNotMatch(config.system, /removed skill/);
    config.skills = undefined;
    reloadSkills(config);
    assert.equal(config.skills, undefined);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
