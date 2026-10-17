import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  CONFIG_LIMITS,
  ConfigError,
  activateConditionalSkills,
  argumentNamesFrom,
  expandSkill,
  loadProjectConfig,
  matchesConditionalRule,
  parseFrontmatter,
  readBoundedBytes,
} from "../src/config.js";
import { createPluginTools } from "../src/plugins.js";

// Every test builds its own temporary tree and cleans it up. A `.git` marker at
// the temp root bounds ancestor traversal so results never depend on the real
// filesystem above the sandbox.

function sandbox(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-config-"));
  fs.mkdirSync(path.join(root, ".git"));
  return root;
}

function withSandbox(run: (root: string) => void): void {
  const root = sandbox();
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeFile(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function installFixturePlugin(workspace: string, source: string, skills: Record<string, string>): Promise<void> {
  writeFile(path.join(source, "plugin.json"), JSON.stringify({ name: "fixture", version: "1", skills: "skills" }));
  for (const [name, body] of Object.entries(skills)) {
    writeFile(path.join(source, "skills", name, "SKILL.md"), `---\nname: ${name}\n---\n${body}`);
  }
  const tool = createPluginTools({ enabled: true }).find(item => item.schema.name === "plugin_install")!;
  const response = JSON.parse(await tool.execute({ directory: fs.realpathSync(source) }, {
    workspace: fs.realpathSync(workspace), signal: new AbortController().signal,
    allowShell: false, maxOutputBytes: 100_000,
  }));
  assert.equal(response.status, "installed");
}

function names(files: { path: string }[]): string[] {
  return files.map(file => path.basename(file.path));
}

// ---------------------------------------------------------------------------
// Settings precedence and merge semantics
// ---------------------------------------------------------------------------

test("settings merge in user -> project -> local -> explicit order", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    const explicit = path.join(root, "explicit.json");

    writeFile(path.join(userDir, "settings.json"), JSON.stringify({
      alpha: 1, list: ["a", "b"], nested: { x: 1, shared: "user" }, keep: true, override: "user",
    }));
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({
      beta: 2, list: ["b", "c"], nested: { y: 2, shared: "project" }, override: "project",
    }));
    writeFile(path.join(workspace, ".harness", "settings.local.json"), JSON.stringify({
      gamma: 3, nested: { z: 3 },
    }));
    writeFile(explicit, JSON.stringify({ delta: 4, override: "explicit" }));

    const cfg = loadProjectConfig(workspace, { userDir, settingsFile: explicit });
    assert.deepEqual(cfg.settings, {
      alpha: 1,
      beta: 2,
      gamma: 3,
      delta: 4,
      keep: true,
      list: ["a", "b", "c"],
      nested: { x: 1, y: 2, z: 3, shared: "project" },
      override: "explicit",
    });
  });
});

test("later scalar or type-changed values replace earlier ones", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    writeFile(path.join(userDir, "settings.json"), JSON.stringify({ k: { a: 1 }, arr: ["x"], drop: 1 }));
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ k: [1, 2], arr: { b: 2 } }));
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.deepEqual(cfg.settings.k, [1, 2]);
    assert.deepEqual(cfg.settings.arr, { b: 2 });
    assert.equal(cfg.settings.drop, 1);
  });
});

test("explicit managed fields override authored settings without merging permission arrays", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj"), userDir = path.join(root, "user"), policy = path.join(root, "policy.json");
    writeFile(path.join(workspace, ".harness/settings.json"), JSON.stringify({ allowShell: true,
      permissions: { mode: "bypass", allow: ["write_file"], deny: [] }, features: { tasks: true, media: true } }));
    const managed = { allowShell: false, permissions: { mode: "default", allow: [], deny: ["write_file"] }, features: { tasks: false } };
    writeFile(policy, JSON.stringify(managed));
    const loaded = loadProjectConfig(workspace, { userDir, managedSettingsFile: policy });
    assert.deepEqual(loaded.managedSettings, managed);
    assert.deepEqual(loaded.settings.permissions, managed.permissions);
    assert.equal(loaded.settings.allowShell, false);
    assert.deepEqual(loaded.settings.features, { tasks: false, media: true });
    writeFile(policy, JSON.stringify({ model: "unexpected" }));
    assert.throws(() => loadProjectConfig(workspace, { userDir, managedSettingsFile: policy }), /managed settings accepts only/);
    writeFile(policy, JSON.stringify({ features: { invented: false } }));
    assert.throws(() => loadProjectConfig(workspace, { userDir, managedSettingsFile: policy }), /Unrecognized key/);
    fs.unlinkSync(policy);
    assert.throws(() => loadProjectConfig(workspace, { userDir, managedSettingsFile: policy }), /not found/);
  });
});

test("the OS-managed directory merges its base file and sorted drop-ins", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj"), userDir = path.join(root, "user"), managed = path.join(root, "managed");
    writeFile(path.join(workspace, ".harness/settings.json"), JSON.stringify({ allowShell: true,
      permissions: { mode: "default", allow: ["user_tool"], deny: [] }, features: { tasks: true, media: true } }));
    writeFile(path.join(managed, "managed-settings.json"), JSON.stringify({ allowShell: false,
      permissions: { mode: "default", allow: ["a"], deny: ["x"] }, features: { tasks: false }, model: "ignored" }));
    writeFile(path.join(managed, "managed-settings.d/10-allow.json"), JSON.stringify({
      permissions: { mode: "default", allow: ["b", "a"], deny: ["y"] }, model: "ignored" }));
    writeFile(path.join(managed, "managed-settings.d/20-shell.json"), JSON.stringify({ allowShell: true, features: { media: false } }));
    // Excluded by the source's rule: hidden name, non-JSON name, directory named *.json.
    writeFile(path.join(managed, "managed-settings.d/.hidden.json"), JSON.stringify({ allowShell: false }));
    writeFile(path.join(managed, "managed-settings.d/notes.txt"), JSON.stringify({ allowShell: false }));
    fs.mkdirSync(path.join(managed, "managed-settings.d/dir.json"));
    // A symlink is read, as the source's `isSymbolicLink` arm requires.
    const linked = path.join(root, "linked.json");
    writeFile(linked, JSON.stringify({ features: { workflow: false } }));
    fs.symlinkSync(linked, path.join(managed, "managed-settings.d/30-linked.json"));

    const loaded = loadProjectConfig(workspace, { userDir, managedSettingsDir: managed });
    assert.deepEqual(loaded.managedSettings, {
      allowShell: true,
      permissions: { mode: "default", allow: ["a", "b"], deny: ["x", "y"] },
      features: { tasks: false, workflow: false, media: false },
    });
    // Managed permission fields replace the authored object wholesale.
    assert.deepEqual(loaded.settings.permissions, { mode: "default", allow: ["a", "b"], deny: ["x", "y"] });
    assert.equal(loaded.settings.allowShell, true);
    assert.deepEqual(loaded.settings.features, { tasks: false, workflow: false, media: false });
    assert.deepEqual(loaded.managedSettingsReport, {
      source: "directory",
      directory: path.resolve(managed),
      documents: [path.join(managed, "managed-settings.json"), path.join(managed, "managed-settings.d/10-allow.json"),
        path.join(managed, "managed-settings.d/20-shell.json"), path.join(managed, "managed-settings.d/30-linked.json")],
      ignoredKeys: ["model"],
      errors: [],
    });
  });
});

test("a missing managed directory is absence and a broken document contributes nothing", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj"), userDir = path.join(root, "user"), managed = path.join(root, "managed");
    writeFile(path.join(workspace, ".harness/settings.json"), JSON.stringify({ allowShell: true }));
    const absent = loadProjectConfig(workspace, { userDir, managedSettingsDir: managed });
    assert.equal(absent.managedSettings, undefined);
    assert.equal(absent.managedSettingsReport, undefined);
    assert.equal(absent.settings.allowShell, true);

    writeFile(path.join(managed, "managed-settings.json"), "{not json");
    writeFile(path.join(managed, "managed-settings.d/50-valid.json"), JSON.stringify({ allowShell: false, features: { invented: true } }));
    const broken = loadProjectConfig(workspace, { userDir, managedSettingsDir: managed });
    // The invalid JSON document is reported and skipped; the valid document is
    // then rejected by the policy schema, so no policy reaches the session.
    assert.equal(broken.managedSettings, undefined);
    assert.equal(broken.managedSettingsReport?.source, "directory");
    assert.equal(broken.managedSettingsReport?.documents.length, 2);
    assert.match(broken.managedSettingsReport?.errors[0].message ?? "", /invalid JSON/);
    assert.match(broken.managedSettingsReport?.errors[1].message ?? "", /managed settings rejected/);
    assert.equal(broken.settings.allowShell, true);
  });
});

test("prototype keys are never merged and cannot pollute Object.prototype", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    fs.mkdirSync(workspace, { recursive: true });
    // Raw JSON: an object literal cannot express a "__proto__" own key.
    writeFile(path.join(userDir, "settings.json"),
      '{"__proto__":{"polluted":true},"safe":{"__proto__":{"nested":true},"ok":1},"constructor":{"bad":true},"prototype":{"bad":true}}');
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.equal(({} as Record<string, unknown>).polluted, undefined);
    assert.equal(({} as Record<string, unknown>).nested, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(cfg.settings, "__proto__"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(cfg.settings, "constructor"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(cfg.settings, "prototype"), false);
    assert.deepEqual(cfg.settings.safe, { ok: 1 });
  });
});

// ---------------------------------------------------------------------------
// Settings validation
// ---------------------------------------------------------------------------

test("invalid settings JSON raises a ConfigError carrying the file path", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    fs.mkdirSync(workspace, { recursive: true });
    const file = path.join(userDir, "settings.json");
    writeFile(file, "{ not json ");
    assert.throws(
      () => loadProjectConfig(workspace, { userDir }),
      (error: unknown) => error instanceof ConfigError && /invalid JSON/.test(error.message) && error.path === file,
    );
  });
});

test("a non-object settings document is rejected", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    fs.mkdirSync(workspace, { recursive: true });
    writeFile(path.join(userDir, "settings.json"), "[]");
    assert.throws(
      () => loadProjectConfig(workspace, { userDir }),
      (error: unknown) => error instanceof ConfigError && /must contain a JSON object/.test(error.message),
    );
  });
});

test("an empty settings file is treated as no settings", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    fs.mkdirSync(workspace, { recursive: true });
    writeFile(path.join(userDir, "settings.json"), "\n  \n");
    assert.deepEqual(loadProjectConfig(workspace, { userDir }).settings, {});
  });
});

test("a missing explicit settings file is an error; a missing default layer is not", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    fs.mkdirSync(workspace, { recursive: true });
    assert.deepEqual(loadProjectConfig(workspace, { userDir: path.join(root, "absent") }).settings, {});
    assert.throws(
      () => loadProjectConfig(workspace, { userDir: path.join(root, "absent"), settingsFile: path.join(root, "nope.json") }),
      (error: unknown) => error instanceof ConfigError && /not found/.test(error.message),
    );
  });
});

test("settings reads are bounded by CONFIG_LIMITS.settingsBytes", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    fs.mkdirSync(workspace, { recursive: true });
    writeFile(path.join(userDir, "settings.json"), JSON.stringify({ pad: "x".repeat(CONFIG_LIMITS.settingsBytes) }));
    assert.throws(
      () => loadProjectConfig(workspace, { userDir }),
      (error: unknown) => error instanceof ConfigError && /byte limit/.test(error.message),
    );
  });
});

// ---------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------

test("instructions collect ancestor HARNESS.md/AGENTS.md and rules in order", () => {
  withSandbox(root => {
    const repo = path.join(root, "repo");
    const workspace = path.join(repo, "sub");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.mkdirSync(workspace, { recursive: true });

    // Above the git root, so these must NOT be read.
    writeFile(path.join(root, "HARNESS.md"), "root harness (excluded)");
    writeFile(path.join(root, "AGENTS.md"), "root agents (excluded)");

    writeFile(path.join(repo, "HARNESS.md"), "repo harness");
    writeFile(path.join(repo, "AGENTS.md"), "repo agents");
    writeFile(path.join(workspace, "AGENTS.md"), "workspace agents");
    writeFile(path.join(workspace, ".harness", "rules", "10-a.md"), "rule a");
    writeFile(path.join(workspace, ".harness", "rules", "02-b.md"), "rule b");
    writeFile(path.join(workspace, ".harness", "rules", "ignore.txt"), "not a rule");

    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.deepEqual(names(cfg.instructions), ["HARNESS.md", "AGENTS.md", "AGENTS.md", "02-b.md", "10-a.md"]);
    assert.equal(cfg.instructions[0]!.content, "repo harness");
    assert.equal(cfg.instructions[2]!.content, "workspace agents");
    assert.equal(cfg.instructions[3]!.content, "rule b");
    assert.ok(!cfg.instructions.some(file => file.content.includes("excluded")));
  });
});

test("rules load unconditionally even without any ancestor instruction file", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, ".harness", "rules", "only.md"), "the only rule");
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.deepEqual(names(cfg.instructions), ["only.md"]);
    assert.equal(cfg.instructions[0]!.content, "the only rule");
  });
});

test("nested rules are bounded, deterministic and retain conditional discovery", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness/rules");
    writeFile(path.join(rules, "a.md"), "Baseline");
    writeFile(path.join(rules, "nested/z.md"), '---\npaths: ["src/**"]\n---\nNested source rule');
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: [] });
    assert.deepEqual(names(cfg.instructions), ["a.md"]);
    assert.equal(cfg.conditionalRules?.[0]?.path, path.join(rules, "nested/z.md"));
    fs.symlinkSync(rules, path.join(rules, "nested/loop"));
    assert.equal(loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: [] }).conditionalRules?.length, 1);
    fs.mkdirSync(path.join(root, "outside"));
    fs.symlinkSync(path.join(root, "outside"), path.join(rules, "escape"));
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), /escapes its root/);
  });
});

test("an oversized rules directory fails loudly instead of silently omitting files", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rulesDir = path.join(workspace, ".harness", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    for (let i = 0; i <= CONFIG_LIMITS.dirEntries; i++) {
      fs.writeFileSync(path.join(rulesDir, `rule-${i}.md`), `rule ${i}`);
    }
    assert.throws(
      () => loadProjectConfig(workspace, { userDir: path.join(root, "user") }),
      (error: unknown) => error instanceof ConfigError && /rules directory exceeds/.test(error.message),
    );
  });
});

test("instruction and skill text share one aggregate budget and fail rather than emit partially", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rulesDir = path.join(workspace, ".harness", "rules");
    const skillDir = path.join(workspace, ".harness", "skills", "big");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(skillDir, { recursive: true });

    // Each file is under the per-file cap, but together they exceed the total.
    const chunk = "x".repeat(1_700_000);
    for (let i = 0; i < 4; i++) fs.writeFileSync(path.join(rulesDir, `rule-${i}.md`), chunk);
    const skillFile = path.join(skillDir, "SKILL.md");
    fs.writeFileSync(skillFile, `---\nname: big\n---\n${chunk}`);

    assert.ok(chunk.length < CONFIG_LIMITS.textBytes);
    assert.ok(4 * chunk.length + chunk.length > CONFIG_LIMITS.textBytesTotal);

    assert.throws(
      () => loadProjectConfig(workspace, { userDir: path.join(root, "user") }),
      (error: unknown) =>
        error instanceof ConfigError &&
        /aggregate budget/.test(error.message) &&
        error.path === skillFile,
    );
  });
});

test("instruction text within the aggregate budget loads completely", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rulesDir = path.join(workspace, ".harness", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    const chunk = "y".repeat(1_700_000);
    for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(rulesDir, `rule-${i}.md`), chunk);
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.equal(cfg.instructions.length, 3);
    assert.equal(cfg.instructions[0]!.content.length, chunk.length);
  });
});

// ---------------------------------------------------------------------------
// Bounded descriptor reads
// ---------------------------------------------------------------------------

test("readBoundedBytes reads a file at the cap and reports its exact original bytes", () => {
  withSandbox(root => {
    const file = path.join(root, "at-cap.bin");
    fs.writeFileSync(file, Buffer.alloc(1000, 0x41));
    const read = readBoundedBytes(file, 1000);
    assert.equal(read.overflow, false);
    assert.equal(read.bytes, 1000);
    assert.equal(read.buffer.length, 1000);
    assert.equal(read.buffer.toString("utf8"), "A".repeat(1000));
  });
});

test("readBoundedBytes handles empty and zero-cap boundaries", () => {
  withSandbox(root => {
    const empty = path.join(root, "empty.bin");
    fs.writeFileSync(empty, Buffer.alloc(0));
    const none = readBoundedBytes(empty, 10);
    assert.equal(none.bytes, 0);
    assert.equal(none.overflow, false);

    const one = path.join(root, "one.bin");
    fs.writeFileSync(one, Buffer.alloc(1, 0x5a));
    const overZero = readBoundedBytes(one, 0);
    assert.equal(overZero.overflow, true);
    // Detection stops after the single byte that exceeded the bound.
    assert.equal(overZero.buffer.length, 1);
  });
});

test("readBoundedBytes flags one byte past the cap without reading further", () => {
  withSandbox(root => {
    const file = path.join(root, "over.bin");
    fs.writeFileSync(file, Buffer.alloc(1001, 0x42));
    const read = readBoundedBytes(file, 1000);
    assert.equal(read.overflow, true);
    // cap + 1 bytes is the most that may be consumed to detect overflow.
    assert.equal(read.buffer.length, 1001);
  });
});

test("readBoundedBytes fails a file that grew past the bound (no stat window)", () => {
  withSandbox(root => {
    const file = path.join(root, "grown.bin");
    // A caller sizing this at 10 bytes would have seen 10; it is now 4096. The
    // bounded read still refuses to consume past the bound.
    fs.writeFileSync(file, Buffer.alloc(4096, 0x43));
    const read = readBoundedBytes(file, 10);
    assert.equal(read.overflow, true);
    assert.equal(read.buffer.length, 11);
  });
});

test("readBoundedBytes surfaces an unreadable file as a ConfigError carrying the path", () => {
  withSandbox(root => {
    const missing = path.join(root, "nope.bin");
    assert.throws(
      () => readBoundedBytes(missing, 10),
      (error: unknown) => error instanceof ConfigError && error.path === missing,
    );
  });
});

test("readBoundedBytes rejects a directory (regular-file check on the opened descriptor)", () => {
  withSandbox(root => {
    const dir = path.join(root, "a-directory");
    fs.mkdirSync(dir);
    // Whether the open itself fails or the fstat rejects the directory, the
    // result is a ConfigError carrying the offending path, not a blocked read.
    assert.throws(
      () => readBoundedBytes(dir, 1024),
      (error: unknown) => error instanceof ConfigError && error.path === dir,
    );
  });
});

test("readBoundedBytes rejects a non-integer, negative, or non-finite cap", () => {
  withSandbox(root => {
    const file = path.join(root, "data.bin");
    fs.writeFileSync(file, "abc");
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => readBoundedBytes(file, bad), RangeError);
    }
  });
});

test("an instruction file over the per-file cap is rejected on read", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rulesDir = path.join(workspace, ".harness", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "big.md"), Buffer.alloc(CONFIG_LIMITS.textBytes + 1, 0x61));
    assert.throws(
      () => loadProjectConfig(workspace, { userDir: path.join(root, "user") }),
      (error: unknown) => error instanceof ConfigError && /byte read limit/.test(error.message),
    );
  });
});

test("the aggregate budget is charged in original bytes, not decoded/re-encoded size", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rulesDir = path.join(workspace, ".harness", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    // Each 0xFF byte decodes to U+FFFD, which re-encodes to three UTF-8 bytes.
    // Three 1.5 MB files are 4.5 MB of *original* bytes (inside the 8 MB
    // budget) but 13.5 MB if the budget used the re-encoded size, so this only
    // loads once the budget is charged the bytes actually read.
    const per = 1_500_000;
    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(path.join(rulesDir, `bad-${i}.md`), Buffer.alloc(per, 0xff));
    }
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.equal(cfg.instructions.length, 3);
    // Every invalid byte decodes to exactly one U+FFFD replacement character.
    assert.equal(cfg.instructions[0]!.content.length, per);
  });
});

test("the aggregate read is bounded by the remaining budget and classified as such", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rulesDir = path.join(workspace, ".harness", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });

    // Drain the shared budget to a tiny remainder with four files that are each
    // just under the per-file cap, then add a small file that is over that
    // remainder but well under the per-file cap.
    const perFile = CONFIG_LIMITS.textBytes;
    const big = perFile - 152;
    for (let i = 0; i < 4; i++) fs.writeFileSync(path.join(rulesDir, `big-${i}.md`), Buffer.alloc(big, 0x61));
    const remaining = CONFIG_LIMITS.textBytesTotal - 4 * big;
    assert.ok(remaining > 0 && remaining < perFile);

    const over = path.join(rulesDir, "over.md");
    fs.writeFileSync(over, Buffer.alloc(remaining + 10, 0x62));
    assert.ok(remaining + 10 < perFile);

    // The file is under the per-file cap, so the overage must be attributed to
    // the aggregate budget (and the read bounded by the remainder, not 2 MiB).
    assert.throws(
      () => loadProjectConfig(workspace, { userDir: path.join(root, "user") }),
      (error: unknown) =>
        error instanceof ConfigError &&
        /aggregate budget/.test(error.message) &&
        error.path === over,
    );
  });
});

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

test("skills load from user and project dirs with frontmatter and project override", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");

    writeFile(path.join(userDir, "skills", "greet", "SKILL.md"),
      '---\nname: greet\ndescription: "Say hello"\nuser-invocable: false\n---\nHello $ARGUMENTS\n');
    writeFile(path.join(userDir, "skills", "quiet", "SKILL.md"),
      "---\nname: quiet\ndescription: 'Silent helper'\nuser-invocable: false\ndisable-model-invocation: true\n---\nQuiet body\n");
    writeFile(path.join(workspace, ".harness", "skills", "build", "SKILL.md"),
      '---\nname: build\ndescription: Build things\ndisable-model-invocation: true\nmetadata:\n  version: "2"\n---\nBuild body\n');
    writeFile(path.join(workspace, ".harness", "skills", "greet", "SKILL.md"),
      "---\nname: greet\ndescription: Project greet\n---\nProject hello\n");
    // A direct subdirectory without SKILL.md is not a skill.
    fs.mkdirSync(path.join(workspace, ".harness", "skills", "empty"), { recursive: true });

    const cfg = loadProjectConfig(workspace, { userDir });
    const byName = Object.fromEntries(cfg.skills.map(skill => [skill.name, skill]));
    assert.equal(cfg.skills.length, 3);
    assert.equal(byName.build!.disableModelInvocation, true);
    assert.equal(byName.build!.userInvocable, true);
    assert.match(byName.build!.body, /Build body/);
    assert.equal(byName.quiet!.userInvocable, false);
    assert.equal(byName.quiet!.disableModelInvocation, true);
    assert.equal(byName.quiet!.description, "Silent helper");
    // Project definition wins on a name collision.
    assert.equal(byName.greet!.description, "Project greet");
    assert.equal(byName.greet!.userInvocable, true);
    assert.match(byName.greet!.body, /Project hello/);
    assert.ok(byName.build!.path.endsWith(path.join("build", "SKILL.md")));
  });
});

test("symlinked skill directories are de-duplicated by realpath", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const skillsDir = path.join(workspace, ".harness", "skills");
    writeFile(path.join(skillsDir, "real", "SKILL.md"), "---\nname: real\ndescription: Real\n---\nbody\n");
    fs.symlinkSync(path.join(skillsDir, "real"), path.join(skillsDir, "alias"));
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.equal(cfg.skills.length, 1);
    assert.equal(cfg.skills[0]!.name, "real");
  });
});

test("a skill without a frontmatter name falls back to its directory name", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, ".harness", "skills", "nameless", "SKILL.md"), "Just a body\n");
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.equal(cfg.skills.length, 1);
    assert.equal(cfg.skills[0]!.name, "nameless");
    assert.equal(cfg.skills[0]!.description, "");
    assert.equal(cfg.skills[0]!.body, "Just a body\n");
  });
});

// ---------------------------------------------------------------------------
// Frontmatter subset
// ---------------------------------------------------------------------------

test("parseFrontmatter reads flat scalars and reports unsupported constructs", () => {
  const fm = parseFrontmatter(
    '---\nname: sample\ndescription: "quoted: value" # trailing\nflag: true\nmetadata:\n  version: "2"\nlist: [a, b]\n---\nBody line 1\nBody line 2\n',
  );
  assert.equal(fm.data.name, "sample");
  assert.equal(fm.data.description, "quoted: value");
  assert.equal(fm.data.flag, true);
  assert.equal(fm.data.metadata, undefined);
  assert.equal(fm.data.list, undefined);
  assert.ok(fm.limitations.some(line => /nested/.test(line)));
  assert.ok(fm.limitations.some(line => /complex/.test(line)));
  assert.equal(fm.body, "Body line 1\nBody line 2\n");
});

test("parseFrontmatter tolerates absent or unterminated frontmatter", () => {
  const none = parseFrontmatter("# Title\n\nBody\n");
  assert.deepEqual(none.data, {});
  assert.equal(none.body, "# Title\n\nBody\n");
  assert.deepEqual(none.limitations, []);

  const broken = parseFrontmatter("---\nname: x\nstill frontmatter\n");
  assert.deepEqual(broken.data, {});
  assert.match(broken.body, /still frontmatter/);
  assert.ok(broken.limitations.some(line => /unterminated/.test(line)));
});

// ---------------------------------------------------------------------------
// expandSkill
// ---------------------------------------------------------------------------

test("expandSkill substitutes $ARGUMENTS and $1..$9 without re-scanning", () => {
  assert.equal(expandSkill("Run $1 then $2. Args: $ARGUMENTS", "a b c"), "Run a then b. Args: a b c");
  assert.equal(expandSkill("x $3 y", "a b"), "x  y");
  assert.equal(expandSkill("no placeholders", "ignored"), "no placeholders");
  assert.equal(expandSkill({ body: "hi $1" }, "z"), "hi z");
  assert.equal(expandSkill("", "x"), "");
  // Only single-digit positions are supported: $10 stays literal.
  assert.equal(expandSkill("n $10 m", "a"), "n $10 m");
  // A replacement is never re-scanned.
  assert.equal(expandSkill("$ARGUMENTS", "$1 literal"), "$1 literal");
  assert.equal(expandSkill("$1", "   "), "");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]|$ARGUMENTS[12]|$1|$ARGUMENTS", "alpha beta"), "alpha|beta|$ARGUMENTS[12]|alpha|alpha beta");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[01]|$ARGUMENTS[999999999999999999999]|$ARGUMENTS[2]", "$1 literal"), "$1|literal|$ARGUMENTS[999999999999999999999]|$ARGUMENTS[2]");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]|$ARGUMENTS[2]", "alpha \"beta gamma\""), "alpha|\"beta|gamma\"");
  assert.equal(expandSkill("$ARGUMENTS[0]", ""), "$ARGUMENTS[0]");
  const quoted = { quotedArguments: true };
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]|$1|$ARGUMENTS", "\"alpha beta\" gamma", quoted), "alpha beta|gamma|alpha beta|\"alpha beta\" gamma");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]|$ARGUMENTS[2]", "pre\"alpha beta\" 'gamma delta' \\\"literal\\\"", quoted), "prealpha beta|gamma delta|\"literal\"");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]", "\"\" x", quoted), "|x");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]", "\"open quote", quoted), "\"open|quote");
  assert.equal(expandSkill("$ARGUMENTS[0]|$ARGUMENTS[1]", "alpha\\ beta $1", quoted), "alpha beta|$1");
  const append = { ...quoted, appendUnusedArguments: true };
  assert.equal(expandSkill("Task", "alpha $1", append), "Task\n\nARGUMENTS: alpha $1");
  assert.equal(expandSkill("$ARGUMENTS[12]", "alpha", append), "$ARGUMENTS[12]\n\nARGUMENTS: alpha");
  assert.equal(expandSkill("$ARGUMENTS[0]", "\"\"", append), "");
  assert.equal(expandSkill("Task $1", "alpha beta", append), "Task alpha");
  assert.equal(expandSkill("Task", "", append), "Task");
  const extended = { ...append, extendedArguments: true };
  assert.equal(expandSkill("$0|$1|$12|$1x|$ARGUMENTS[1]", "alpha beta", extended), "alpha|beta|$12|$1x|beta");
  assert.equal(expandSkill("\\$ARGUMENTS[0]|\\$1|$0", "$1 literal", extended), "$ARGUMENTS[0]|$1|$1");
  assert.equal(expandSkill("\\$ARGUMENTS", "alpha", extended), "$ARGUMENTS\n\nARGUMENTS: alpha");
  assert.equal(expandSkill("$12", "", extended), "$12");
  const named = { body: "$target|$target_long|$targetSuffix|$target[0]|\\$target|$ARGUMENTS", argumentNames: ["target", "target_long"] };
  assert.equal(expandSkill(named, "alpha 'beta gamma'", quoted), "alpha|beta gamma|$targetSuffix|$target[0]|$target|alpha 'beta gamma'");
  assert.equal(expandSkill({ body: "$target_long", argumentNames: named.argumentNames }, "alpha", append), "");
  assert.equal(expandSkill({ body: "$target", argumentNames: ["target"] }, "$1", extended), "$1");
  assert.deepEqual(argumentNamesFrom("a.b  2 x+y 名前"), ["a.b", "x+y", "名前"]);
  assert.deepEqual(argumentNamesFrom(["1", "", "a.b", 5, null]), ["a.b"]);
  assert.deepEqual(argumentNamesFrom({ name: "a" }), []);
  assert.equal(expandSkill({ body: "$a.b|$a_b|$a+b|$名前", argumentNames: ["a.b", "a_b", "a+b", "名前"] }, "X Y Z W"),
    "X|Y|Z|W");
  assert.equal(expandSkill({ body: "$x", argumentNames: ["x", "x"] }, "A B"), "A");
});

// ---------------------------------------------------------------------------
// Full YAML and local catalog migration
// ---------------------------------------------------------------------------

test("full YAML preserves collections, block scalars, aliases and JSON metadata", () => {
  const fm = parseFrontmatter('---\nname: sample\ndescription: |\n  First line\n  Second line\nallowed-tools: &tools [read_file, "Bash(npm test)"]\ncopy: *tools\nmetadata:\n  version: 2\n  flags: [true, false, null]\n---\nBody\n', { full: true });
  assert.equal(fm.data.description, "First line\nSecond line\n");
  assert.deepEqual(fm.data["allowed-tools"], ["read_file", "Bash(npm test)"]);
  assert.deepEqual(fm.data.copy, fm.data["allowed-tools"]);
  assert.deepEqual(fm.data.metadata, { version: 2, flags: [true, false, null] });
  assert.equal(fm.body, "Body\n");
  assert.deepEqual(fm.limitations, []);
});

test("malformed, tagged, cyclic and excessive-depth YAML preserve the original body explicitly", () => {
  for (const header of ["name: [", "name: a\nname: b", "value: !js/function x", "value: &loop [*loop]", `value: ${"[".repeat(70)}0${"]".repeat(70)}`]) {
    const text = `---\n${header}\n---\nBody\n`;
    const fm = parseFrontmatter(text, { full: true });
    assert.deepEqual(fm.data, {});
    assert.equal(fm.body, text);
    assert.match(fm.limitations[0]!, /invalid YAML/);
  }
});

test("skills retain optional invocation fields and validated flat command hooks without executing shell", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const marker = path.join(root, "executed");
    writeFile(path.join(workspace, ".harness", "skills", "extended", "SKILL.md"), `---\nname: extended\nallowed-tools: [read_file, "Bash(npm test)"]\nmodel: fixture-model\neffort: high\ncontext: fork\nbackground: true\nhooks:\n  Stop:\n    - command: touch ${marker}\n      timeout: 2\ncommand: echo command\nshell: bash\nmetadata:\n  number: 2\n  tags: [one, two]\n---\nRun !\`touch ${marker}\`\n`);
    writeFile(path.join(workspace, ".harness", "skills", "minimal", "SKILL.md"), "Body");
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    const skill = cfg.skills.find(item => item.name === "extended")!;
    assert.deepEqual(skill.allowedTools, ["read_file", "Bash(npm test)"]);
    assert.equal(skill.model, "fixture-model");
    assert.equal(skill.effort, "high");
    assert.equal(skill.context, "fork");
    assert.equal(skill.background, true);
    assert.deepEqual(skill.hooks, { Stop: [{ command: `touch ${marker}`, timeout: 2 }] });
    assert.deepEqual(skill.metadata, { number: 2, tags: ["one", "two"] });
    assert.equal(skill.command, "echo command");
    assert.equal(skill.shell, "bash");
    assert.ok(skill.limitations?.some(value => /inline shell/.test(value)));
    assert.equal(fs.existsSync(marker), false);
    const minimal = cfg.skills.find(item => item.name === "minimal")!;
    assert.deepEqual(Object.keys(minimal).sort(), ["body", "description", "disableModelInvocation", "name", "path", "source", "userInvocable"].sort());
  });
});

test("known malformed skill fields fail with the manifest path", () => {
  for (const header of ["aliases: [quick, quick]", "aliases: [bad::alias]", "aliases: [1]", "allowed-tools: [1]", "model: [x]", "effort: 3", "effort: extreme", "context: shared", "background: maybe", "user-invocable: 1", "metadata: [x]", "hooks:\n  Stop:\n    - unsupported-field: command\n      command: x"]) {
    withSandbox(root => {
      const workspace = path.join(root, "proj");
      const manifest = path.join(workspace, ".harness", "skills", "bad", "SKILL.md");
      writeFile(manifest, `---\n${header}\n---\nBody`);
      assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), (error: unknown) => error instanceof ConfigError && error.path === manifest);
    });
  }
});

test("skill argument names follow the recovered permissive filter", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const manifest = path.join(workspace, ".harness", "skills", "names", "SKILL.md");
    for (const [header, expected] of [
      ["arguments: [target, target]", ["target", "target"]],
      ["arguments: [1]", []],
      ["arguments: [bad.name, 名前, a-b]", ["bad.name", "名前", "a-b"]],
      ["arguments: 2", []],
    ] as const) {
      writeFile(manifest, `---\n${header}\n---\nBody`);
      assert.deepEqual(loadProjectConfig(workspace, { userDir: path.join(root, "user") }).skills[0]!.argumentNames ?? [], expected);
    }
  });
});

test("scalar skill tool grants and quoted booleans remain compatible", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, ".harness", "skills", "scalar", "SKILL.md"), '---\nallowed-tools: read_file, Bash(npm test), read_file\nbackground: "false"\nuser-invocable: "false"\n---\nBody');
    const skill = loadProjectConfig(workspace, { userDir: path.join(root, "user") }).skills[0]!;
    assert.deepEqual(skill.allowedTools, ["read_file", "Bash(npm test)"]);
    assert.equal(skill.background, false);
    assert.equal(skill.userInvocable, false);
  });
});

test("instruction imports follow relative and absolute Markdown paths outside code and comments", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const absolute = path.join(root, "absolute.md");
    const main = path.join(workspace, "HARNESS.md");
    writeFile(absolute, "Absolute");
    writeFile(path.join(workspace, "relative.md"), "Relative @nested.md");
    writeFile(path.join(workspace, "nested.md"), "Nested");
    writeFile(main, `@relative.md#section\n@${absolute}\n\`@missing-inline.md\`\n\`\`@missing-double.md\`\`\n<!-- @missing-comment.md -->\n<!--\n@missing-multiline.md\n-->\n\`\`\`md\n@missing-fenced.md\n\`\`\`\n~~~\n@missing-tilde.md\n~~~\n\\@missing-escaped.md\nemail@example.md\n`);
    fs.symlinkSync(path.join(workspace, "nested.md"), path.join(workspace, "alias.md"));
    writeFile(path.join(workspace, "AGENTS.md"), "@alias.md @relative.md");
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.deepEqual(names(cfg.instructions), ["HARNESS.md", "relative.md", "nested.md", "absolute.md", "AGENTS.md"]);
    assert.equal(cfg.instructions[0]!.content, fs.readFileSync(main, "utf8"));
  });
});

test("home imports resolve against the home directory without reading host config", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const imported = path.join(root, "home-note.md");
    writeFile(imported, "Home note fixture");
    const homeRelative = path.relative(os.homedir(), imported).split(path.sep).join("/");
    writeFile(path.join(workspace, "HARNESS.md"), `@~/${homeRelative}`);
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.deepEqual(names(cfg.instructions), ["HARNESS.md", "home-note.md"]);
    assert.equal(cfg.instructions[1]!.content, "Home note fixture");
  });
});

test("Markdown comment delimiters inside code and fences inside comments retain outside imports", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, "import.md"), "Imported");
    writeFile(path.join(workspace, "HARNESS.md"), '`<!--` @import.md\n<!--\n```\n-->\n@import.md\n');
    assert.deepEqual(names(loadProjectConfig(workspace, { userDir: path.join(root, "user") }).instructions), ["HARNESS.md", "import.md"]);
  });
});

test("full YAML preserves original CRLF body bytes and strips prototype fields", () => {
  const fm = parseFrontmatter('---\r\nname: sample\r\nmetadata:\r\n  __proto__: {polluted: true}\r\n  safe: 1\r\n---\r\nBody\r\n', { full: true });
  assert.equal(fm.body, "Body\r\n");
  assert.deepEqual(fm.data.metadata, { safe: 1 });
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test("instruction import cycles deduplicate and depth five fails explicitly", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, "HARNESS.md"), "@one.md");
    writeFile(path.join(workspace, "one.md"), "@HARNESS.md");
    assert.equal(loadProjectConfig(workspace, { userDir: path.join(root, "user") }).instructions.length, 2);
    for (let i = 1; i <= 5; i++) writeFile(path.join(workspace, `${i === 1 ? "one" : i}.md`), i === 5 ? "end" : `@${i + 1}.md`);
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), (error: unknown) => error instanceof ConfigError && /depth 5/.test(error.message) && error.path === path.join(workspace, "5.md"));
  });
});

test("missing imported Markdown raises a path-bearing error", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, "HARNESS.md"), "@missing.md");
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), (error: unknown) => error instanceof ConfigError && error.path === path.join(workspace, "missing.md"));
  });
});

test("conditional rule globs select workspace paths and omitted paths preserve old behavior", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    writeFile(path.join(rules, "always.md"), "Always");
    writeFile(path.join(rules, "source.md"), '---\npaths: ["src/**/*.{ts,tsx}"]\n---\nSource');
    writeFile(path.join(rules, "tests.md"), '---\npathglob: "test/**"\n---\nTests');
    const userDir = path.join(root, "user");
    assert.deepEqual(names(loadProjectConfig(workspace, { userDir }).instructions), ["always.md", "source.md", "tests.md"]);
    assert.deepEqual(names(loadProjectConfig(workspace, { userDir, paths: [] }).instructions), ["always.md"]);
    assert.deepEqual(names(loadProjectConfig(workspace, { userDir, paths: [path.join(workspace, "src", "file.ts")] }).instructions), ["always.md", "source.md"]);
    assert.deepEqual(names(loadProjectConfig(workspace, { userDir, paths: ["test/file.test.ts"] }).instructions), ["always.md", "tests.md"]);
  });
});

test("conditional rule catalogs pin source once while empty paths load only baseline instructions", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rule = path.join(workspace, ".harness", "rules", "conditional.md");
    const content = '---\npaths: ["src/**", "src/**", "test/**"]\n---\nPinned rule';
    writeFile(rule, content);
    writeFile(path.join(workspace, ".harness", "rules", "always.md"), "Baseline");
    fs.symlinkSync(rule, path.join(workspace, ".harness", "rules", "alias.md"));
    const userDir = path.join(root, "user");
    const cfg = loadProjectConfig(workspace, { userDir, paths: [] });
    assert.deepEqual(names(cfg.instructions), ["always.md"]);
    assert.equal(cfg.conditionalRules!.length, 1);
    const pinned = cfg.conditionalRules![0]!;
    assert.equal(pinned.content, content);
    assert.deepEqual(pinned.patterns, ["src/**", "test/**"]);
    fs.unlinkSync(rule);
    assert.equal(matchesConditionalRule(pinned, ["src/file.ts"]), true);
    assert.equal(matchesConditionalRule(pinned, ["docs/file.md"]), false);
    assert.equal(matchesConditionalRule(pinned, []), false);
    assert.equal(pinned.content, content);
  });
});

test("conditional rule source is charged once when both cataloged and selected", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    const chunk = "x".repeat(1_700_000);
    for (let i = 0; i < 4; i++) writeFile(path.join(rules, `${i}.md`), `---\npaths: "src/**"\n---\n${chunk}`);
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: ["src/file.ts"] });
    assert.equal(cfg.instructions.length, 4);
    assert.equal(cfg.conditionalRules!.length, 4);
    assert.equal(cfg.instructions[0]!.content, cfg.conditionalRules![0]!.content);
  });
});

test("conditional imports are pinned in DFS order, deduplicate cycles and inherit root conditions", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    const rootRule = path.join(rules, "source.md");
    const imports = path.join(root, "imported");
    const first = path.join(imports, "first.md");
    const second = path.join(imports, "second.md");
    writeFile(first, `First @second.md @${rootRule}`);
    writeFile(second, "Second @first.md");
    fs.symlinkSync(first, path.join(imports, "alias.md"));
    writeFile(rootRule, `---\npaths: "src/**"\n---\n@${first} @${path.join(imports, "alias.md")}\n\`@missing.md\``);
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: [] });
    assert.deepEqual(cfg.instructions, []);
    const pinned = cfg.conditionalRules![0]!;
    assert.deepEqual(names(pinned.imports!), ["first.md", "second.md"]);
    assert.equal(pinned.imports![1]!.content, "Second @first.md");
    assert.equal(matchesConditionalRule(pinned, ["src/file.ts"]), true);
    assert.equal(matchesConditionalRule(pinned, ["docs/file.md"]), false);
    fs.rmSync(imports, { recursive: true, force: true });
    assert.equal(pinned.imports![1]!.content, "Second @first.md");
  });
});

test("conditional imports enforce depth even when no baseline target selects their rule", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    writeFile(path.join(rules, "rule.md"), '---\npaths: "src/**"\n---\n@1.md');
    for (let i = 1; i <= 5; i++) writeFile(path.join(rules, `${i}.md`), i === 5 ? "End" : `@${i + 1}.md`);
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: [] }), (error: unknown) => error instanceof ConfigError && /depth 5/.test(error.message));
  });
});

test("conditional imports are charged once when shared by selected instructions and multiple catalog roots", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    const chunk = "x".repeat(1_700_000);
    for (let i = 0; i < 4; i++) writeFile(path.join(workspace, `${i}.md`), chunk);
    for (const name of ["a", "b"]) writeFile(path.join(rules, `${name}.md`), `---\npaths: "src/**"\n---\n@../../0.md @../../1.md @../../2.md @../../3.md`);
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: ["src/file.ts"] });
    assert.equal(cfg.instructions.length, 6);
    assert.deepEqual(cfg.conditionalRules!.map(rule => rule.imports!.length), [4, 4]);
  });
});

test("conditional catalogs obey the same aggregate limit even when baseline excludes rules", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    const chunk = "x".repeat(1_700_000);
    for (let i = 0; i < 5; i++) writeFile(path.join(rules, `${i}.md`), `---\npaths: "src/**"\n---\n${chunk}`);
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: [] }), (error: unknown) => error instanceof ConfigError && /aggregate budget/.test(error.message));
  });
});

test("conditional rules validate glob types and require complete imported snapshots when paths are supplied", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const file = path.join(workspace, ".harness", "rules", "conditional.md");
    writeFile(file, '---\npaths: "src/**"\n---\n@missing.md');
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user"), paths: [] }), (error: unknown) => error instanceof ConfigError && error.path === path.join(path.dirname(file), "missing.md"));
    writeFile(file, "---\npaths: [3]\n---\nBody");
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), (error: unknown) => error instanceof ConfigError && error.path === file);
  });
});

test("configured plugin skill directories obey project then user then plugin precedence and realpath identity", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    const plugin = path.join(root, "plugin-skills");
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ pluginDirs: [plugin, plugin] }));
    for (const [directory, label] of [[plugin, "plugin"], [path.join(userDir, "skills"), "user"], [path.join(workspace, ".harness", "skills"), "project"]]) {
      writeFile(path.join(directory!, "shared", "SKILL.md"), `---\nname: shared\n---\n${label}`);
    }
    writeFile(path.join(plugin, "plugin-only", "SKILL.md"), "Plugin only");
    writeFile(path.join(plugin, "user-wins", "SKILL.md"), "Plugin loses");
    writeFile(path.join(userDir, "skills", "user-wins", "SKILL.md"), "User wins");
    fs.symlinkSync(plugin, path.join(root, "plugin-alias"));
    writeFile(path.join(workspace, ".harness", "settings.local.json"), JSON.stringify({ pluginDirs: [path.join(root, "plugin-alias")] }));
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.equal(cfg.skills.length, 3);
    assert.equal(cfg.skills.find(skill => skill.name === "shared")!.body, "project");
    assert.equal(cfg.skills.find(skill => skill.name === "user-wins")!.body, "User wins");
    assert.equal(cfg.skills.find(skill => skill.name === "plugin-only")!.body, "Plugin only");
  });
});

test("installed plugin skills are pinned below project and user but above configured directories", async () => {
  const root = sandbox();
  try {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    const pluginDir = path.join(root, "configured-skills");
    const source = path.join(root, "plugin-source");
    const marker = path.join(root, "executed");
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ plugins: { enabled: true }, pluginDirs: [pluginDir] }));
    writeFile(path.join(source, "script.js"), `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')`);
    await installFixturePlugin(workspace, source, {
      shared: "Installed loses", user: "Installed loses to user", installed: "Installed wins", only: "Pinned plugin body",
    });
    writeFile(path.join(workspace, ".harness", "skills", "shared", "SKILL.md"), "Project wins");
    writeFile(path.join(userDir, "skills", "shared", "SKILL.md"), "User loses to project");
    writeFile(path.join(userDir, "skills", "user", "SKILL.md"), "User wins");
    writeFile(path.join(pluginDir, "installed", "SKILL.md"), "Configured loses");
    writeFile(path.join(pluginDir, "configured", "SKILL.md"), "Configured only");
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.deepEqual(Object.fromEntries(cfg.skills.map(skill => [skill.name, skill.body])), {
      shared: "Project wins", user: "User wins", installed: "Installed wins", only: "Pinned plugin body", configured: "Configured only",
    });
    assert.deepEqual(Object.fromEntries(cfg.skills.map(skill => [skill.name, skill.source])), {
      shared: "projectSettings", user: "userSettings", installed: "plugin", only: "plugin", configured: "plugin",
    });
    const pinned = cfg.skills.find(skill => skill.name === "only")!;
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ plugins: { enabled: true }, pluginDirs: [pluginDir], features: { pluginSkillNamespaces: true } }));
    const namespaced = loadProjectConfig(workspace, { userDir });
    assert.equal(namespaced.skills.find(skill => skill.name === "fixture:shared")!.body, "Installed loses");
    assert.deepEqual(namespaced.skills.find(skill => skill.name === "fixture:only")!.aliases, ["only"]);
    assert.equal(namespaced.skills.find(skill => skill.name === "shared")!.body, "Project wins");
    assert.equal(namespaced.skills.find(skill => skill.name === "installed")!.body, "Configured loses");
    assert.equal(pinned.path, path.join(fs.realpathSync(workspace), ".harness", "plugins", "fixture", "skills", "only", "SKILL.md"));
    fs.rmSync(path.join(workspace, ".harness", "plugins"), { recursive: true, force: true });
    assert.equal(pinned.body, "Pinned plugin body");
    assert.equal(fs.existsSync(marker), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("installed plugin discovery follows merged enabled settings and rejects edited installed content", async () => {
  const root = sandbox();
  try {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    fs.mkdirSync(workspace);
    await installFixturePlugin(workspace, path.join(root, "source"), { only: "Plugin" });
    assert.deepEqual(loadProjectConfig(workspace, { userDir }).skills, []);
    writeFile(path.join(userDir, "settings.json"), JSON.stringify({ plugins: { enabled: true } }));
    assert.equal(loadProjectConfig(workspace, { userDir }).skills[0]!.name, "only");
    writeFile(path.join(workspace, ".harness", "settings.local.json"), JSON.stringify({ plugins: { enabled: false } }));
    const installed = path.join(workspace, ".harness", "plugins", "fixture", "skills", "only", "SKILL.md");
    writeFile(installed, "Changed after install");
    assert.deepEqual(loadProjectConfig(workspace, { userDir }).skills, []);
    const explicit = path.join(root, "enabled.json");
    writeFile(explicit, JSON.stringify({ plugins: { enabled: true } }));
    assert.throws(() => loadProjectConfig(workspace, { userDir, settingsFile: explicit }),
      (error: unknown) => error instanceof ConfigError && /installed plugin catalog/.test(error.message)
        && error.path === path.join(workspace, ".harness", "plugins"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("settings.plugins validates the full plugin schema even while disabled", () => {
  for (const plugins of [null, [], true, { enabled: "yes" }, { enabled: false, maxBytes: 0 }, { enabled: false, unsupported: true }]) {
    withSandbox(root => {
      const workspace = path.join(root, "proj");
      writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ plugins }));
      assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }),
        (error: unknown) => error instanceof ConfigError && /invalid settings plugins/.test(error.message));
    });
  }
});

test("installed plugin skill text consumes the existing aggregate budget", async () => {
  const root = sandbox();
  try {
    const workspace = path.join(root, "proj");
    const rules = path.join(workspace, ".harness", "rules");
    const chunk = "x".repeat(1_700_000);
    for (let i = 0; i < 4; i++) writeFile(path.join(rules, `${i}.md`), chunk);
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ plugins: { enabled: true } }));
    await installFixturePlugin(workspace, path.join(root, "source"), { big: chunk });
    const manifest = path.join(fs.realpathSync(workspace), ".harness", "plugins", "fixture", "skills", "big", "SKILL.md");
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }),
      (error: unknown) => error instanceof ConfigError && /aggregate budget/.test(error.message) && error.path === manifest);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("pluginDirs must be an explicit array of local paths", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ pluginDirs: "plugin" }));
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), /pluginDirs must be an array/);
  });
});

test("local memory catalog loads only Markdown and preserves empty-config compatibility", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, ".harness", "memory", "10-note.md"), "Note");
    writeFile(path.join(workspace, ".harness", "memory", "02-summary.md"), "Summary");
    writeFile(path.join(workspace, ".harness", "memory", "ignored.txt"), "Ignored");
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.deepEqual(names(cfg.memories!), ["02-summary.md", "10-note.md"]);
    assert.deepEqual(cfg.instructions, []);
    assert.equal(cfg.memories![0]!.content, "Summary");
  });
});

test("imported text and local memory share the instruction budget", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, "HARNESS.md"), "@one.md @two.md @three.md @four.md");
    const chunk = "x".repeat(1_700_000);
    for (const file of ["one", "two", "three", "four"]) writeFile(path.join(workspace, `${file}.md`), chunk);
    const memory = path.join(workspace, ".harness", "memory", "note.md");
    writeFile(memory, chunk);
    assert.throws(() => loadProjectConfig(workspace, { userDir: path.join(root, "user") }), (error: unknown) => error instanceof ConfigError && /aggregate budget/.test(error.message) && error.path === memory);
  });
});

test("realpath aliases charge imported instruction bytes once and deduplicate memory catalog", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    writeFile(path.join(workspace, "HARNESS.md"), "@one.md @two.md @three.md @four.md @alias.md");
    const chunk = "x".repeat(1_700_000);
    for (const file of ["one", "two", "three", "four"]) writeFile(path.join(workspace, `${file}.md`), chunk);
    fs.symlinkSync(path.join(workspace, "one.md"), path.join(workspace, "alias.md"));
    const memoryDir = path.join(workspace, ".harness", "memory");
    writeFile(path.join(memoryDir, "note.md"), "Memory");
    fs.symlinkSync(path.join(memoryDir, "note.md"), path.join(memoryDir, "alias.md"));
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.equal(cfg.instructions.length, 5);
    assert.equal(cfg.memories!.length, 1);
  });
});

test("malformed skill YAML preserves the full source with a limitation", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const text = "---\nname: [\n---\nRetained body";
    writeFile(path.join(workspace, ".harness", "skills", "fallback", "SKILL.md"), text);
    const skill = loadProjectConfig(workspace, { userDir: path.join(root, "user") }).skills[0]!;
    assert.equal(skill.name, "fallback");
    assert.equal(skill.body, text);
    assert.ok(skill.limitations?.some(value => /invalid YAML/.test(value)));
  });
});

// ---------------------------------------------------------------------------
// Agent type configuration integration
// ---------------------------------------------------------------------------

test("agent types load project before the independent user directory and pin their bodies", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "independent-user");
    const project = path.join(workspace, ".harness", "agents", "reviewer.md");
    writeFile(project, "---\nname: reviewer\ndescription: Project review\nmode: explore\ntools: [read_file]\neffort: high\n---\nProject body\n");
    writeFile(path.join(userDir, "agents", "reviewer.md"), "---\nname: reviewer\ndescription: User review\n---\nUser loses");
    writeFile(path.join(userDir, "agents", "writer.md"), "---\nname: writer\ndescription: User writer\n---\nUser body");
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.deepEqual(cfg.agentTypes!.map(agent => [agent.name, agent.body]), [["reviewer", "Project body\n"], ["writer", "User body"]]);
    const reviewer = cfg.agentTypes![0]!;
    assert.equal(reviewer.path, fs.realpathSync(project));
    assert.equal(reviewer.mode, "explore");
    assert.deepEqual(reviewer.tools, ["read_file"]);
    assert.equal(reviewer.effort, "high");
    const shadowed = cfg.agentTypeReports!.find(report => report.status === "shadowed")!;
    assert.equal(shadowed.name, "reviewer");
    assert.equal(shadowed.source, "user");
    assert.equal(shadowed.winnerPath, reviewer.path);
    fs.unlinkSync(project);
    assert.equal(reviewer.body, "Project body\n");
  });
});

test("invalid and reserved agent definitions report diagnostics without running body text", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const dir = path.join(workspace, ".harness", "agents");
    const marker = path.join(root, "executed");
    writeFile(path.join(dir, "bad-yaml.md"), `---\nname: [\n---\n!\`touch ${marker}\``);
    writeFile(path.join(dir, "bad-schema.md"), `---\nname: invalid\ndescription: Invalid\neffort: extreme\n---\n!\`touch ${marker}\``);
    writeFile(path.join(dir, "reserved.md"), "---\nname: fork\ndescription: Reserved\n---\nBody");
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.equal(Object.hasOwn(cfg, "agentTypes"), false);
    assert.deepEqual(cfg.agentTypeReports!.map(report => report.status), ["invalid", "invalid", "reserved"]);
    assert.equal(fs.existsSync(marker), false);
  });
});

test("skill plugin directories do not implicitly become agent type catalogs", async () => {
  const root = sandbox();
  try {
    const workspace = path.join(root, "proj");
    const pluginDir = path.join(root, "configured");
    const source = path.join(root, "source");
    writeFile(path.join(workspace, ".harness", "settings.json"), JSON.stringify({ plugins: { enabled: true }, pluginDirs: [pluginDir] }));
    const agent = "---\nname: hidden\ndescription: Plugin agent file\n---\nBody";
    writeFile(path.join(pluginDir, "hidden.md"), agent);
    writeFile(path.join(pluginDir, "agents", "hidden.md"), agent);
    writeFile(path.join(source, "agents", "hidden.md"), agent);
    await installFixturePlugin(workspace, source, { visible: "Plugin skill" });
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "user") });
    assert.deepEqual(cfg.skills.map(skill => skill.name), ["visible"]);
    assert.equal(Object.hasOwn(cfg, "agentTypes"), false);
    assert.equal(Object.hasOwn(cfg, "agentTypeReports"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("agent definitions share exactly the remaining instruction, skill and memory budget", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    const skill = "Skill text";
    const memory = "Memory text";
    const agent = "---\nname: reviewer\ndescription: Review\n---\nAgent body";
    const agentFile = path.join(workspace, ".harness", "agents", "reviewer.md");
    writeFile(path.join(workspace, ".harness", "skills", "small", "SKILL.md"), skill);
    writeFile(path.join(workspace, ".harness", "memory", "small.md"), memory);
    writeFile(agentFile, agent);
    const remaining = CONFIG_LIMITS.textBytesTotal - Buffer.byteLength(skill + memory + agent);
    const chunk = Math.floor(remaining / 4);
    for (let i = 0; i < 4; i++) {
      writeFile(path.join(workspace, ".harness", "rules", `${i}.md`), "x".repeat(i === 3 ? remaining - 3 * chunk : chunk));
    }
    assert.equal(loadProjectConfig(workspace, { userDir }).agentTypes![0]!.body, "Agent body");
    writeFile(agentFile, agent + "x");
    assert.throws(() => loadProjectConfig(workspace, { userDir }),
      (error: unknown) => error instanceof ConfigError && /byte budget/.test(error.message) && error.path === fs.realpathSync(agentFile));
  });
});

test("invalid and shadowed agent bytes still consume the shared config budget", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    const project = "---\nname: reviewer\ndescription: Project\n---\nBody";
    const invalid = "---\nname: [\n---\nBody";
    const shadowed = "---\nname: reviewer\ndescription: User\n---\nBody";
    const finalFile = path.join(userDir, "agents", "reviewer.md");
    writeFile(path.join(workspace, ".harness", "agents", "a.md"), project);
    writeFile(path.join(workspace, ".harness", "agents", "invalid.md"), invalid);
    writeFile(finalFile, shadowed);
    const remaining = CONFIG_LIMITS.textBytesTotal - Buffer.byteLength(project + invalid + shadowed) + 1;
    const chunk = Math.floor(remaining / 4);
    for (let i = 0; i < 4; i++) {
      writeFile(path.join(workspace, ".harness", "rules", `${i}.md`), "x".repeat(i === 3 ? remaining - 3 * chunk : chunk));
    }
    assert.throws(() => loadProjectConfig(workspace, { userDir }),
      (error: unknown) => error instanceof ConfigError && /byte budget/.test(error.message) && error.path === fs.realpathSync(finalFile));
  });
});

// ---------------------------------------------------------------------------
// Empty workspace
// ---------------------------------------------------------------------------

test("an empty workspace yields empty settings, instructions and skills", () => {
  withSandbox(root => {
    const workspace = path.join(root, "empty");
    fs.mkdirSync(workspace, { recursive: true });
    const cfg = loadProjectConfig(workspace, { userDir: path.join(root, "absent") });
    assert.deepEqual(cfg.settings, {});
    assert.deepEqual(cfg.instructions, []);
    assert.deepEqual(cfg.skills, []);
  });
});

test("a missing workspace directory is an error", () => {
  withSandbox(root => {
    assert.throws(
      () => loadProjectConfig(path.join(root, "does-not-exist"), { userDir: path.join(root, "user") }),
      (error: unknown) => error instanceof ConfigError && /workspace directory not found/.test(error.message),
    );
  });
});

// ---------------------------------------------------------------------------
// Conditional skills (`paths`)
// ---------------------------------------------------------------------------

test("skill paths normalize like the recovered loader and hold the skill out of the catalog", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    writeFile(path.join(workspace, ".harness", "skills", "scoped", "SKILL.md"),
      "---\nname: scoped\ndescription: Scoped\npaths:\n  - src/**\n  - docs/**\n---\nScoped body\n");
    writeFile(path.join(workspace, ".harness", "skills", "broad", "SKILL.md"),
      "---\nname: broad\ndescription: Broad\npaths: ['**']\n---\nBroad body\n");
    writeFile(path.join(workspace, ".harness", "skills", "plain", "SKILL.md"),
      "---\nname: plain\ndescription: Plain\n---\nPlain body\n");
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.deepEqual(cfg.skills.map(skill => skill.name).sort(), ["broad", "plain"]);
    assert.deepEqual(cfg.conditionalSkills?.map(skill => skill.name), ["scoped"]);
    // `/**` is trimmed and `**` alone never makes a skill conditional.
    assert.deepEqual(cfg.conditionalSkills?.[0]?.paths, ["src", "docs"]);
    assert.equal(cfg.skills.find(skill => skill.name === "broad")?.paths, undefined);
  });
});

test("a string paths value and an empty list behave like the source", () => {
  withSandbox(root => {
    const workspace = path.join(root, "proj");
    const userDir = path.join(root, "user");
    writeFile(path.join(workspace, ".harness", "skills", "one", "SKILL.md"),
      "---\nname: one\ndescription: One\npaths: src/**\n---\nOne\n");
    writeFile(path.join(workspace, ".harness", "skills", "none", "SKILL.md"),
      "---\nname: none\ndescription: None\npaths: []\n---\nNone\n");
    const cfg = loadProjectConfig(workspace, { userDir });
    assert.deepEqual(cfg.skills.map(skill => skill.name), ["none"]);
    assert.deepEqual(cfg.conditionalSkills?.map(skill => [skill.name, skill.paths]), [["one", ["src"]]]);
    // A non-string pattern is a configuration error, not a silently dropped skill.
    writeFile(path.join(workspace, ".harness", "skills", "bad2", "SKILL.md"),
      "---\nname: bad2\ndescription: Bad\npaths:\n  - 3\n---\nBad\n");
    assert.throws(() => loadProjectConfig(workspace, { userDir }), /paths must be a string or array of strings/);
  });
});

test("activation matches gitignore-style patterns against workspace-relative touches", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-skill-paths-"));
  try {
    const workspace = path.join(root, "proj");
    fs.mkdirSync(workspace, { recursive: true });
    const held = new Map<string, { name: string; description: string; path: string; body: string;
      userInvocable: boolean; disableModelInvocation: boolean; paths: string[] }>([
      ["src", { name: "src", description: "", path: "s", body: "", userInvocable: true, disableModelInvocation: false, paths: ["src"] }],
      ["docs", { name: "docs", description: "", path: "d", body: "", userInvocable: true, disableModelInvocation: false, paths: ["docs/*.md"] }],
      ["any", { name: "any", description: "", path: "a", body: "", userInvocable: true, disableModelInvocation: false, paths: ["**"] }],
    ]);
    // A directory pattern covers everything under it; a `*.md` pattern stays one level.
    assert.deepEqual(activateConditionalSkills(held, workspace, ["src/deep/a.ts"]).map(skill => skill.name), ["src", "any"]);
    assert.deepEqual([...held.keys()], ["docs"]);
    assert.deepEqual(activateConditionalSkills(held, workspace, ["docs/sub/a.md"]), []);
    assert.deepEqual(activateConditionalSkills(held, workspace, ["docs/a.md"]).map(skill => skill.name), ["docs"]);
    // A path outside the workspace and an absolute path never activate anything.
    const outside = new Map<string, { name: string; description: string; path: string; body: string;
      userInvocable: boolean; disableModelInvocation: boolean; paths: string[] }>([
      ["x", { name: "x", description: "", path: "x", body: "", userInvocable: true, disableModelInvocation: false, paths: ["**"] }]]);
    assert.deepEqual(activateConditionalSkills(outside, workspace, ["../escape"]), []);
    assert.deepEqual(activateConditionalSkills(outside, workspace, [path.join(root, "proj/src/a.ts")]).map(skill => skill.name), ["x"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
