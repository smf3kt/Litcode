import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { loadProjectConfig } from "../src/config.js";
import type { McpServerConfig, McpStdioServerConfig } from "../src/mcp.js";
import {
  heldMcpServerNotice,
  mcpServerFingerprint,
  MCP_APPROVALS_FILE,
  readMcpApprovals,
  recordMcpApprovals,
  resolveMcpServers,
  workspaceApprovalKey,
} from "../src/mcp-approval.js";

// Each test builds its own workspace and user directory. A `.git` marker at the
// workspace root bounds ancestor traversal, so a result never depends on the
// real filesystem above the sandbox.

function sandbox(): { root: string; workspace: string; userDir: string; key: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "harness-mcp-approval-"));
  const workspace = path.join(root, "workspace");
  const userDir = path.join(root, "user");
  fs.mkdirSync(workspace);
  fs.mkdirSync(userDir);
  fs.mkdirSync(path.join(workspace, ".git"));
  fs.mkdirSync(path.join(workspace, ".harness"));
  return { root, workspace, userDir, key: workspaceApprovalKey(workspace) };
}

function writeSettings(file: string, body: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
}

const stdio: McpServerConfig = { type: "stdio", command: "node", args: ["server.js"] };
const other: McpServerConfig = { type: "stdio", command: "node", args: ["other.js"] };

function commandOf(config: McpServerConfig | undefined): string {
  assert.ok(config, "the server is declared");
  assert.ok(config.type !== "http", "the server is a stdio server");
  return (config as McpStdioServerConfig).command;
}

const names = (items: readonly { name: string }[]): string[] => items.map(item => item.name);

test("a project-declared server is assigned to the project set, not the user layer", () => {
  const { workspace, userDir } = sandbox();
  writeSettings(path.join(userDir, "settings.json"), { mcpServers: { mine: stdio } });
  writeSettings(path.join(workspace, ".harness", "settings.json"), { mcpServers: { theirs: stdio } });

  const loaded = loadProjectConfig(workspace, { userDir, paths: [] });

  assert.deepEqual(Object.keys(loaded.projectMcpServers ?? {}), ["theirs"]);
  assert.ok(loaded.settings.mcpServers, "both servers merge into the effective settings");
  assert.deepEqual(Object.keys(loaded.settings.mcpServers as object).sort(), ["mine", "theirs"]);
});

test("the project-local layer also counts as project-owned and wins over the project layer", () => {
  const { workspace, userDir } = sandbox();
  writeSettings(path.join(workspace, ".harness", "settings.json"), { mcpServers: { alpha: stdio } });
  writeSettings(path.join(workspace, ".harness", "settings.local.json"), {
    mcpServers: { alpha: { type: "stdio", command: "other", args: [] }, beta: stdio },
  });

  const loaded = loadProjectConfig(workspace, { userDir, paths: [] });

  assert.deepEqual(Object.keys(loaded.projectMcpServers ?? {}).sort(), ["alpha", "beta"]);
  assert.equal(commandOf(loaded.projectMcpServers?.alpha), "other");
});

test("an explicitly named settings file is the caller's own and is not held", () => {
  const { workspace, userDir } = sandbox();
  const explicit = path.join(workspace, "operator.json");
  writeSettings(explicit, { mcpServers: { chosen: stdio } });

  const loaded = loadProjectConfig(workspace, { userDir, settingsFile: explicit, paths: [] });

  assert.equal(loaded.projectMcpServers, undefined);
});

test("an unapproved project server is held and an approved one is not", () => {
  const declared: Record<string, McpServerConfig> = { alpha: stdio, beta: stdio };
  const { userDir, key } = sandbox();

  const first = resolveMcpServers(declared, readMcpApprovals(userDir, key));
  assert.deepEqual(names(first.pending), ["alpha", "beta"]);
  assert.equal(first.pending[0].reason, "unapproved");
  assert.deepEqual(first.connect, []);

  recordMcpApprovals(userDir, key, [{ name: "alpha", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);
  const second = resolveMcpServers(declared, readMcpApprovals(userDir, key));
  assert.deepEqual(second.connect, ["alpha"]);
  assert.deepEqual(names(second.pending), ["beta"]);
});

test("a declined server is never connected and never asked about again", () => {
  const declared: Record<string, McpServerConfig> = { alpha: stdio, beta: stdio };
  const { userDir, key } = sandbox();
  recordMcpApprovals(userDir, key, [
    { name: "alpha", fingerprint: mcpServerFingerprint(stdio), decision: "rejected" },
    { name: "beta", fingerprint: mcpServerFingerprint(stdio), decision: "approved" },
  ]);

  const admission = resolveMcpServers(declared, readMcpApprovals(userDir, key));
  assert.deepEqual(admission.connect, ["beta"]);
  assert.deepEqual(admission.declined, ["alpha"]);
  assert.deepEqual(admission.pending, [], "a declined server raises no question");

  const notice = heldMcpServerNotice(admission.pending, admission.declined, "read");
  assert.match(notice ?? "", /declined: alpha/);
  assert.doesNotMatch(notice ?? "", /awaiting approval/);

  // A rejection is an answer for one declaration, not for the name: editing it
  // raises the question again rather than silently staying declined.
  const edited = resolveMcpServers({ alpha: other }, readMcpApprovals(userDir, key));
  assert.deepEqual(names(edited.pending), ["alpha"]);
  assert.equal(edited.pending[0].reason, "declaration-changed");
});

test("an answer covers the declaration it was granted for", () => {
  const { userDir, key } = sandbox();
  recordMcpApprovals(userDir, key, [{ name: "alpha", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);

  const held = resolveMcpServers({ alpha: other }, readMcpApprovals(userDir, key));
  assert.deepEqual(names(held.pending), ["alpha"]);
  assert.equal(held.pending[0].reason, "declaration-changed");

  // Key order is not a change: the fingerprint is canonical.
  const reordered: Record<string, McpServerConfig> = { alpha: { args: ["server.js"], command: "node", type: "stdio" } };
  assert.equal(resolveMcpServers(reordered, readMcpApprovals(userDir, key)).connect.length, 1);
});

test("an answer given in one checkout does not admit the same name in another", () => {
  const first = sandbox();
  const second = sandbox();
  recordMcpApprovals(first.userDir, first.key, [{ name: "alpha", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);

  // A different workspace reads the same user directory and still has to ask.
  const elsewhere = readMcpApprovals(first.userDir, second.key);
  assert.equal(elsewhere.state, "read");
  assert.deepEqual(names(resolveMcpServers({ alpha: stdio }, elsewhere).pending), ["alpha"]);
});

test("saving keeps the other workspaces' answers", () => {
  const first = sandbox();
  const second = sandbox();
  recordMcpApprovals(first.userDir, first.key, [{ name: "alpha", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);
  recordMcpApprovals(second.userDir, second.key, [{ name: "beta", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);
  // One shared user directory, two workspaces.
  recordMcpApprovals(first.userDir, second.key, [{ name: "beta", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);

  assert.deepEqual([...readMcpApprovals(first.userDir, first.key).decisions.keys()], ["alpha"]);
  assert.deepEqual([...readMcpApprovals(first.userDir, second.key).decisions.keys()], ["beta"]);
});

test("a missing store answers nothing and is not reported as a failed read", () => {
  const { userDir, key } = sandbox();
  const approvals = readMcpApprovals(userDir, key);
  assert.equal(approvals.state, "absent");
  assert.equal(approvals.decisions.size, 0);

  const admission = resolveMcpServers({ alpha: stdio }, approvals);
  const notice = heldMcpServerNotice(admission.pending, admission.declined, approvals.state);
  assert.match(notice ?? "", /1 project server\(s\) awaiting approval \(alpha\)/);
  assert.match(notice ?? "", /--approve-mcp-server NAME or decline with --reject-mcp-server NAME/);
  assert.doesNotMatch(notice ?? "", /could not be read/);
});

test("a damaged store answers nothing and says so", () => {
  const { userDir, key } = sandbox();
  fs.writeFileSync(path.join(userDir, MCP_APPROVALS_FILE), "{not json");

  const approvals = readMcpApprovals(userDir, key);
  assert.equal(approvals.state, "unreadable");
  assert.equal(approvals.decisions.size, 0);

  const admission = resolveMcpServers({ alpha: stdio }, approvals);
  assert.deepEqual(names(admission.pending), ["alpha"]);
  assert.match(heldMcpServerNotice(admission.pending, admission.declined, approvals.state) ?? "", /the approval store could not be read/);
});

test("a store whose entries are not decisions answers nothing", () => {
  const { userDir, key } = sandbox();
  const file = path.join(userDir, MCP_APPROVALS_FILE);
  const digest = mcpServerFingerprint(stdio);

  fs.writeFileSync(file, JSON.stringify({ version: 1, workspaces: { [key]: { alpha: "yes" } } }));
  assert.equal(readMcpApprovals(userDir, key).state, "unreadable");

  fs.writeFileSync(file, JSON.stringify({ version: 1, workspaces: { [key]: { alpha: { fingerprint: digest, decision: "maybe" } } } }));
  assert.equal(readMcpApprovals(userDir, key).state, "unreadable");
  assert.equal(resolveMcpServers({ alpha: stdio }, readMcpApprovals(userDir, key)).pending.length, 1);

  // A damaged entry for another workspace does not reach this one.
  fs.writeFileSync(file, JSON.stringify({ version: 1, workspaces: { ["0".repeat(32)]: { alpha: "yes" } } }));
  assert.equal(readMcpApprovals(userDir, key).state, "read");
});

test("recording an answer preserves the entries already there", () => {
  const { userDir, key } = sandbox();
  const digest = mcpServerFingerprint(stdio);
  recordMcpApprovals(userDir, key, [{ name: "alpha", fingerprint: digest, decision: "approved" }]);
  recordMcpApprovals(userDir, key, [{ name: "beta", fingerprint: digest, decision: "rejected" }]);

  const approvals = readMcpApprovals(userDir, key);
  assert.equal(approvals.state, "read");
  assert.deepEqual([...approvals.decisions.keys()].sort(), ["alpha", "beta"]);
  assert.equal(approvals.decisions.get("alpha")!.decision, "approved");
  assert.equal(approvals.decisions.get("beta")!.decision, "rejected");
  assert.equal(fs.statSync(path.join(userDir, MCP_APPROVALS_FILE)).mode & 0o777, 0o600);
});

test("the user's own switch admits every project declaration in that workspace", () => {
  const { workspace, userDir, key } = sandbox();
  writeSettings(path.join(workspace, ".harness", "settings.json"), { mcpServers: { alpha: stdio, beta: stdio } });

  assert.equal(loadProjectConfig(workspace, { userDir, paths: [] }).approveAllProjectMcpServers, undefined);

  writeSettings(path.join(userDir, "settings.json"), { approveAllProjectMcpServers: true });
  const loaded = loadProjectConfig(workspace, { userDir, paths: [] });
  assert.equal(loaded.approveAllProjectMcpServers, true);
  assert.equal("approveAllProjectMcpServers" in loaded.settings, false, "the switch is not part of the effective settings");

  const admission = resolveMcpServers(loaded.projectMcpServers ?? {}, readMcpApprovals(userDir, key), { approveAll: true });
  assert.deepEqual(admission.connect, ["alpha", "beta"]);
  assert.deepEqual(admission.pending, []);
  assert.equal(fs.existsSync(path.join(userDir, MCP_APPROVALS_FILE)), false, "the switch records no answers");
});

test("a checkout cannot approve its own MCP servers", () => {
  const { workspace, userDir } = sandbox();
  writeSettings(path.join(workspace, ".harness", "settings.json"),
    { mcpServers: { alpha: stdio }, approveAllProjectMcpServers: true });

  assert.throws(() => loadProjectConfig(workspace, { userDir, paths: [] }),
    /approveAllProjectMcpServers is a user setting; a checkout cannot approve its own MCP servers/);

  writeSettings(path.join(workspace, ".harness", "settings.local.json"), { approveAllProjectMcpServers: true });
  assert.throws(() => loadProjectConfig(workspace, { userDir, paths: [] }), /is a user setting/);

  writeSettings(path.join(userDir, "settings.json"), { approveAllProjectMcpServers: "yes" });
  assert.throws(() => loadProjectConfig(workspace, { userDir, paths: [] }), /must be true or false/);
});

test("a changed declaration reports itself as changed rather than unapproved", () => {
  const { userDir, key } = sandbox();
  recordMcpApprovals(userDir, key, [{ name: "alpha", fingerprint: mcpServerFingerprint(stdio), decision: "approved" }]);
  const edited: Record<string, McpServerConfig> = { alpha: { type: "http", url: "https://example.test/mcp" } };

  const admission = resolveMcpServers(edited, readMcpApprovals(userDir, key));
  const notice = heldMcpServerNotice(admission.pending, admission.declined, readMcpApprovals(userDir, key).state);

  assert.match(notice ?? "", /changed since approval: alpha/);
});

test("a save that cannot be written reports itself and keeps the old answers", () => {
  const { userDir, key } = sandbox();
  const digest = mcpServerFingerprint(stdio);
  recordMcpApprovals(userDir, key, [{ name: "alpha", fingerprint: digest, decision: "approved" }]);

  // A directory where the temporary file would go makes the rename impossible.
  const file = path.join(userDir, MCP_APPROVALS_FILE);
  fs.rmSync(file);
  fs.mkdirSync(file);
  assert.throws(() => recordMcpApprovals(userDir, key, [{ name: "beta", fingerprint: digest, decision: "approved" }]));

  fs.rmdirSync(file);
  assert.equal(readMcpApprovals(userDir, key).state, "absent", "nothing was written, so the question comes back");
});
