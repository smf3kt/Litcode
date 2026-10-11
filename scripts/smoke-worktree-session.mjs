import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compiled = process.argv.includes("--compiled");
const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "worktree-session-cli-")));
const workspace = path.join(fixture, "repo");
const userDir = path.join(fixture, "user");
const fixtureEnv = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(GIT_|LLM_|ANTHROPIC_)/.test(key))),
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.test",
  GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.test",
  LLM_API_KEY: "local-worktree-fixture", LLM_MODEL: "fixture/worktree",
  LLM_BASE_URL: "http://127.0.0.1:1", LLM_AUTH: "bearer", LLM_TOKEN_COUNTING: "estimate",
  LLM_THINKING: "false", LLM_EFFORT: "medium" };
const git = (...args) => execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
  cwd: workspace, env: fixtureEnv, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000,
}).trimEnd();
const journals = directory => fs.readdirSync(path.join(directory, ".agent")).filter(name => name.endsWith(".jsonl"))
  .map(name => fs.readFileSync(path.join(directory, ".agent", name), "utf8").trim().split("\n").map(line => JSON.parse(line)));

try {
  fs.mkdirSync(workspace); fs.mkdirSync(userDir);
  git("init", "--initial-branch=trunk");
  fs.writeFileSync(path.join(workspace, "file.txt"), "fixture baseline\n");
  git("add", "file.txt"); git("commit", "-m", "Disposable worktree CLI fixture");
  const head = git("rev-parse", "HEAD");
  fs.writeFileSync(path.join(workspace, "file.txt"), "source edit preserved\n");
  const run = spawnSync(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", userDir, "--interactive"], {
    cwd: root, env: fixtureEnv, encoding: "utf8", timeout: 30_000, maxBuffer: 1_000_000,
    input: "/worktree scratch\n/status\n/worktree-exit\n/status\n/worktree scratch\n/status\n/worktree-exit\n/status\n/exit\n",
  });
  if (run.error) throw run.error;
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stderr, /error:/i);
  const statuses = [...run.stdout.matchAll(/\{[\s\S]*?\n\}/g)].map(match => JSON.parse(match[0]));
  assert.equal(statuses.length, 4, run.stdout);
  assert.ok(statuses.every(status => status.modelCalls === 0 && status.unfinished === false));
  assert.equal(new Set(statuses.map(status => status.session)).size, 4);
  const checkout = path.join(workspace, ".harness-worktrees", "scratch");
  const byId = new Map([...journals(workspace), ...journals(checkout)].map(events => [events[0].id, events]));
  for (const [index, status] of statuses.entries()) {
    const events = byId.get(status.session); assert.ok(events);
    const config = events[0].config;
    assert.equal(config.workspace, index % 2 === 0 ? checkout : workspace);
    assert.equal(config.worktreeReturn, index % 2 === 0 ? workspace : undefined);
    assert.ok(events.some(event => event.kind === "turn_end" && event.reason === "workspace_relocated"));
    assert.ok(events.every(event => !event.response));
  }
  assert.equal(git("rev-parse", "harness/scratch"), head);
  assert.equal(git("symbolic-ref", "--short", "HEAD"), "trunk");
  assert.equal(fs.readFileSync(path.join(checkout, "file.txt"), "utf8"), "fixture baseline\n");
  assert.equal(fs.readFileSync(path.join(workspace, "file.txt"), "utf8"), "source edit preserved\n");
  const cli = input => spawnSync(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", userDir, "--interactive"], {
    cwd: root, env: fixtureEnv, encoding: "utf8", timeout: 30000, maxBuffer: 1000000, input,
  });
  const created = cli("/worktree dirty\n/exit\n");
  assert.equal(created.status, 0, created.stderr); assert.doesNotMatch(created.stderr, /error:/i);
  const dirty = path.join(workspace, ".harness-worktrees/dirty");
  fs.writeFileSync(path.join(dirty, "keep.txt"), "explicit discard fixture");
  const retained = cli("/worktree dirty\n/worktree-exit --remove\n/status\n/exit\n");
  assert.equal(retained.status, 0, retained.stderr); assert.match(retained.stderr, /Worktree removal error after return:.*dirty files/);
  assert.equal(fs.readFileSync(path.join(dirty, "keep.txt"), "utf8"), "explicit discard fixture");
  assert.ok(journals(dirty).length > 0);
  const discarded = cli("/worktree dirty\n/worktree-exit --remove --discard-changes\n/status\n/exit\n");
  assert.equal(discarded.status, 0, discarded.stderr); assert.doesNotMatch(discarded.stderr, /error:/i);
  assert.match(discarded.stdout, /Removed owned worktree; branch deleted: true/);
  assert.equal(fs.existsSync(dirty), false); assert.equal(git("branch", "--list", "harness/dirty"), "");
  const store = JSON.parse(fs.readFileSync(path.join(workspace, ".agent", "worktrees.json"), "utf8"));
  assert.equal(store.records.length, 1); assert.equal(store.records[0].state, "ready");
  for (const directory of [workspace, checkout]) {
    assert.equal(fs.readdirSync(path.join(directory, ".agent")).some(name => name.endsWith(".lock")), false);
  }
  const remove = spawnSync(process.execPath, [...(compiled ? [path.join(root, "bin/personal-harness.mjs")] : ["--import", "tsx", path.join(root, "src/cli.ts")]),
    "--workspace", workspace, "--user-dir", userDir, "--interactive"], {
    cwd: root, env: fixtureEnv, encoding: "utf8", timeout: 30000, maxBuffer: 1000000,
    input: "/worktree scratch\n/worktree-exit --remove\n/status\n/exit\n",
  });
  if (remove.error) throw remove.error;
  assert.equal(remove.status, 0, remove.stderr); assert.doesNotMatch(remove.stderr, /error:/i);
  assert.match(remove.stdout, /Removed owned worktree; branch deleted: true/);
  assert.equal(fs.existsSync(checkout), false); assert.equal(git("branch", "--list", "harness/scratch"), "");
  const archiveRoot = path.join(workspace, ".agent/worktree-history");
  const archives = fs.readdirSync(archiveRoot); assert.equal(archives.length, 2);
  assert.ok(fs.readdirSync(path.join(archiveRoot, archives[0])).some(file => file.endsWith(".jsonl")));
  assert.equal(fs.readFileSync(path.join(workspace, "file.txt"), "utf8"), "source edit preserved\n");
  console.log(JSON.stringify({ cli: "passed", entry: true, exit: true, reentry: true,
    checkoutAndBranchKept: true, explicitRemove: true, historyArchived: true, dirtyFailureReturned: true, dirtyHistoryRestored: true,
    explicitDiscard: true, sourceEditKept: true, localHEAD: true, modelCalls: 0, locksReleased: true,
    ...(compiled ? { compiledCLI: true } : {}) }));
} finally { fs.rmSync(fixture, { recursive: true, force: true }); }
