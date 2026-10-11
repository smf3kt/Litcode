import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";
import {
  AGENT_TYPE_LIMITS,
  agentTypesSchema,
  loadAgentTypes,
  type AgentTypeInfo,
} from "../src/agent-types.js";
import { ConfigError } from "../src/config.js";

function fixture(t: TestContext): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-agent-types-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
function write(root: string, relative: string, text: string | Buffer): string {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}
function markdown(name: string, body = "Pinned instructions.\n", extra = ""): string {
  return `---\nname: ${name}\ndescription: Agent ${name}\n${extra}---\n${body}`;
}

test("no supplied directories means no discovery or filesystem reads", t => {
  t.mock.method(fs, "opendirSync", () => { throw new Error("unexpected directory discovery"); });
  t.mock.method(fs, "realpathSync", () => { throw new Error("unexpected path discovery"); });
  assert.deepEqual(loadAgentTypes(), { agentTypes: [], reports: [], bytes: 0 });
});

test("full YAML fields load into typed metadata and original CRLF body stays pinned", t => {
  const root = fixture(t);
  const body = "\r\n  Original body\r\n@../unread.md\r\n!`touch marker`\r\n$ARGUMENTS\r\n";
  const text = "---\r\nname: reviewer\r\ndescription: >-\r\n  Review code\r\n  thoroughly.\r\nmode: explore\r\ntools:\r\n  - read_file\r\n  - search_files\r\n  - read_file\r\nmodel: inherit\r\neffort: xhigh\r\nmaxTurns: 7\r\nisolation: worktree\r\n---\r\n" + body;
  const file = write(root, ".harness/agents/reviewer.md", text);
  const loaded = loadAgentTypes({ projectDir: path.dirname(file) });
  const agent: AgentTypeInfo = loaded.agentTypes[0]!;
  assert.deepEqual(agent, {
    name: "reviewer", description: "Review code thoroughly.", body,
    path: fs.realpathSync(file), mode: "explore", tools: ["read_file", "search_files"],
    model: "inherit", effort: "xhigh", maxTurns: 7, isolation: "worktree",
  });
  assert.equal(loaded.bytes, Buffer.byteLength(text));
  assert.equal(loaded.reports[0]?.status, "loaded");
  fs.writeFileSync(file, markdown("reviewer", "Changed body"));
  assert.equal(agent.body, body);
  assert.equal(fs.existsSync(path.join(root, "marker")), false);
  assert.deepEqual(agentTypesSchema.parse(loaded.agentTypes), loaded.agentTypes);
});

test("default general mode and comma-separated tool metadata retain empty allowlists", t => {
  const root = fixture(t);
  write(root, "agents/a.md", markdown("default_agent"));
  write(root, "agents/b.md", markdown("csv_agent", "body", "tools: read_file, search_files, read_file\naliases: quick fast\n"));
  write(root, "agents/c.md", markdown("empty_agent", "body", "tools: []\n"));
  const { agentTypes } = loadAgentTypes({ userDir: path.join(root, "agents") });
  assert.equal(agentTypes[0]?.mode, "general");
  assert.equal(agentTypes[0]?.tools, undefined);
  assert.deepEqual(agentTypes[1]?.tools, ["read_file", "search_files"]);
  assert.deepEqual(agentTypes[1]?.aliases, ["quick", "fast"]);
  assert.deepEqual(agentTypes[2]?.tools, []);
});

test("project beats user and plugins; stable filename and plugin order break ties", t => {
  const root = fixture(t);
  const files = [
    write(root, "project/agents/z.md", markdown("shared", "later project")),
    write(root, "project/agents/a.md", markdown("shared", "first project")),
    write(root, "user/agents/a.md", markdown("shared", "user")),
    write(root, "plugin1/agents/a.md", markdown("shared", "plugin")),
    write(root, "plugin1/agents/b.md", markdown("plugin_only", "first plugin")),
    write(root, "plugin2/agents/a.md", markdown("plugin_only", "later plugin")),
  ];
  const loaded = loadAgentTypes({
    projectDir: path.join(root, "project/agents"), userDir: path.join(root, "user/agents"),
    pluginDirs: [path.join(root, "plugin1/agents"), path.join(root, "plugin2/agents")],
  });
  assert.deepEqual(loaded.agentTypes.map(agent => agent.body), ["first project", "first plugin"]);
  assert.equal(loaded.reports.filter(report => report.status === "shadowed").length, 4);
  assert.equal(loaded.reports.find(report => report.source === "user")?.winnerPath, fs.realpathSync(files[1]!));
  assert.equal(loaded.bytes, files.reduce((sum, file) => sum + fs.statSync(file).size, 0));
});

test("reserved runtime names report collisions for every source", t => {
  const root = fixture(t);
  write(root, "project/fork.md", markdown("fork"));
  write(root, "user/explore.md", markdown("Explore"));
  write(root, "plugin/general.md", markdown("general"));
  const loaded = loadAgentTypes({ projectDir: path.join(root, "project"), userDir: path.join(root, "user"), pluginDirs: [path.join(root, "plugin")] });
  assert.deepEqual(loaded.agentTypes, []);
  assert.deepEqual(loaded.reports.map(report => report.status), ["reserved", "reserved", "reserved"]);
});

test("invalid YAML and invalid known or unknown fields are reported without hiding valid entries", t => {
  const root = fixture(t);
  const invalid = [
    "---\nname: bad\ndescription: [unterminated\n---\nbody",
    "---\nname: bad\n",
    "Plain markdown without metadata",
    "---\nname: []\ndescription: bad\n---\nbody",
    markdown("missing_description").replace("description: Agent missing_description\n", ""),
    markdown("bad_mode", "body", "mode: fork\n"),
    markdown("bad_effort", "body", "effort: extreme\n"),
    markdown("bad_turns", "body", "maxTurns: 0\n"),
    markdown("fraction_turns", "body", "maxTurns: 1.5\n"),
    markdown("string_turns", "body", "maxTurns: \"5\"\n"),
    markdown("bad_isolation", "body", "isolation: remote\n"),
    markdown("bad_tools", "body", "tools: [read_file, 5]\n"),
    markdown("empty_tool", "body", "tools: [\"\"]\n"),
    markdown("bad_model", "body", "model: []\n"),
    markdown("unknown", "body", "hooks: {}\n"),
    markdown("bad_alias", "body", "aliases: [general]\n"),
    markdown("duplicate_alias", "body", "aliases: [quick, quick]\n"),
  ];
  invalid.forEach((text, index) => write(root, `agents/${index}.md`, text));
  write(root, "agents/valid.md", markdown("valid", "works"));
  const loaded = loadAgentTypes({ projectDir: path.join(root, "agents") });
  assert.deepEqual(loaded.agentTypes.map(agent => agent.name), ["valid"]);
  assert.equal(loaded.reports.filter(report => report.status === "invalid").length, invalid.length);
  assert.match(loaded.reports.find(report => report.path.endsWith("0.md"))!.message, /invalid YAML/);
});

test("all five effort values are preserved and exported schema validates full catalogs", t => {
  const root = fixture(t);
  const efforts = ["low", "medium", "high", "xhigh", "max"] as const;
  efforts.forEach((effort, index) => write(root, `agents/${index}.md`, markdown(`effort_${effort}`, "body", `effort: ${effort}\n`)));
  const loaded = loadAgentTypes({ projectDir: path.join(root, "agents") });
  assert.deepEqual(loaded.agentTypes.map(agent => agent.effort), efforts);
  assert.ok(agentTypesSchema.safeParse(loaded.agentTypes).success);
  for (const changed of [{ path: "relative.md" }, { body: 1 }, { tools: "read_file" }, { maxTurns: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.equal(agentTypesSchema.safeParse([{ ...loaded.agentTypes[0], ...changed }]).success, false);
  }
});

test("realpath dedup covers files and source directory aliases without double charging", t => {
  const root = fixture(t);
  const file = write(root, "project/a.md", markdown("shared", "original"));
  fs.symlinkSync(file, path.join(root, "project/b.md"));
  fs.mkdirSync(path.join(root, "user"));
  fs.symlinkSync(file, path.join(root, "user/a.md"));
  fs.symlinkSync(path.join(root, "project"), path.join(root, "alias"));
  const loaded = loadAgentTypes({ projectDir: path.join(root, "project"), userDir: path.join(root, "user"), pluginDirs: [path.join(root, "alias")] });
  assert.equal(loaded.agentTypes.length, 1);
  assert.equal(loaded.bytes, fs.statSync(file).size);
  assert.equal(loaded.reports.filter(report => report.status === "duplicate").length, 3);
  assert.equal(loaded.reports.find(report => report.status === "loaded")?.source, "project");
});

test("escaping file symlinks are reported before reading; nested directories stay unscanned", t => {
  const root = fixture(t);
  const outside = write(root, "outside.md", markdown("outside"));
  write(root, "agents/nested/hidden.md", markdown("hidden"));
  write(root, "agents/ignored.txt", markdown("ignored"));
  fs.symlinkSync(outside, path.join(root, "agents/escape.md"));
  const loaded = loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: 0 });
  assert.deepEqual(loaded.agentTypes, []);
  assert.equal(loaded.bytes, 0);
  assert.equal(loaded.reports[0]?.status, "invalid");
  assert.match(loaded.reports[0]!.message, /escapes/);
});

test("missing directories are explicit diagnostics and malformed options fail", t => {
  const root = fixture(t);
  const loaded = loadAgentTypes({ projectDir: path.join(root, "absent") });
  assert.equal(loaded.reports[0]?.status, "missing");
  assert.equal(loaded.bytes, 0);
  assert.throws(() => loadAgentTypes({ userDir: "relative" }), ConfigError);
  for (const remainingBudget of [-1, 1.5, Infinity, NaN]) assert.throws(() => loadAgentTypes({ remainingBudget }), ConfigError);
  const file = write(root, "file", "text");
  assert.throws(() => loadAgentTypes({ projectDir: file }), /directory/);
  assert.throws(() => loadAgentTypes({ pluginDirs: Array(AGENT_TYPE_LIMITS.directories + 1).fill(root) }), /count limit/);
});

test("budget uses original disk bytes including malformed UTF-8 and invalid definitions", t => {
  const root = fixture(t);
  const text = markdown("bytes", "prefix");
  const bytes = Buffer.concat([Buffer.from(text), Buffer.from([0xff, 0xff])]);
  write(root, "agents/a.md", bytes);
  const loaded = loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: bytes.length });
  assert.equal(loaded.bytes, bytes.length);
  assert.ok(Buffer.byteLength(loaded.agentTypes[0]!.body) > Buffer.byteLength("prefix") + 2);
  assert.throws(() => loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: bytes.length - 1 }), /byte budget/);
  const invalid = "invalid definition";
  write(root, "agents/b.md", invalid);
  assert.equal(loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: bytes.length + invalid.length }).bytes, bytes.length + invalid.length);
  assert.throws(() => loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: bytes.length }), /byte budget/);
});

test("per-file and standalone aggregate limits remain hard even with a larger caller budget", t => {
  const root = fixture(t);
  write(root, "oversized/a.md", "x".repeat(AGENT_TYPE_LIMITS.fileBytes + 1));
  assert.throws(() => loadAgentTypes({ projectDir: path.join(root, "oversized") }), /per-file/);
  for (let index = 0; index < 4; index++) write(root, `agents/${index}.md`, "x".repeat(AGENT_TYPE_LIMITS.fileBytes));
  const full = loadAgentTypes({ projectDir: path.join(root, "agents") });
  assert.equal(full.bytes, AGENT_TYPE_LIMITS.totalBytes);
  write(root, "agents/4.md", markdown("overflow"));
  assert.throws(() => loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: 2 * AGENT_TYPE_LIMITS.totalBytes }), /byte budget/);
});

test("bounded descriptor read catches a file growing after the stat precheck", t => {
  const root = fixture(t);
  const file = write(root, "agents/a.md", markdown("growing"));
  const original = fs.statSync;
  t.mock.method(fs, "statSync", (...args: Parameters<typeof fs.statSync>) => {
    const stat = original(...args);
    if (String(args[0]) === fs.realpathSync(file)) fs.appendFileSync(file, "x".repeat(500));
    return stat;
  });
  assert.throws(() => loadAgentTypes({ projectDir: path.dirname(file), remainingBudget: 100 }), /byte budget/);
});

test("directory entry ceiling applies before any definition bytes are read", t => {
  const root = fixture(t);
  for (let index = 0; index <= AGENT_TYPE_LIMITS.dirEntries; index++) write(root, `agents/${index}.txt`, "");
  assert.throws(() => loadAgentTypes({ projectDir: path.join(root, "agents"), remainingBudget: 0 }), /entry limit/);
});
