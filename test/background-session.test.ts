import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type { ChildProcess, spawn } from "node:child_process";
import type Anthropic from "@anthropic-ai/sdk";
import { defaultConfig } from "../src/agent.js";
import { Session } from "../src/session.js";
import { listSessions } from "../src/sessions.js";
import { backgroundSeed, startBackgroundSession, NOTHING_TO_BACKGROUND } from "../src/background-session.js";

const workspaces: string[] = [];
function workspace(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-background-")));
  workspaces.push(root);
  return root;
}
after(() => { for (const root of workspaces) fs.rmSync(root, { recursive: true, force: true }); });

function completedSession(root: string): Session {
  const config = { ...defaultConfig(root, []), model: "fixture" };
  const session = Session.open(root, { config });
  session.append({ kind: "message", message: { role: "user", content: "First real task" } });
  session.append({ kind: "message", message: { role: "assistant", content: [{ type: "text", text: "Working on it" }] } });
  session.append({ kind: "turn_end", reason: "end_turn" });
  return session;
}
const user = (text: string): Anthropic.MessageParam => ({ role: "user", content: text });
const assistant = (text: string): Anthropic.MessageParam =>
  ({ role: "assistant", content: [{ type: "text", text }] });

test("background seed takes the latest real user text and assistant line", () => {
  const messages = [user("older request"), assistant("older\nreply"), user("newest  request"), assistant("latest   line\nsecond")];
  assert.deepEqual(backgroundSeed(messages, ""), { intent: "newest  request", detail: "latest line second" });
  assert.deepEqual(backgroundSeed(messages, "explicit task"), { intent: "explicit task", detail: "latest line second" });
  assert.equal(backgroundSeed([assistant("no user yet")], ""), null);
  assert.deepEqual(backgroundSeed([assistant("no user yet")], "from the command"), { intent: "from the command", detail: "no user yet" });
});

test("background seed skips tool results, command records and local meta messages", () => {
  const toolResult: Anthropic.MessageParam = { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "x" }] };
  assert.deepEqual(backgroundSeed([toolResult, user("real request"), assistant("done")], ""), { intent: "real request", detail: "done" });
  assert.equal(backgroundSeed([user("<command-name>/model</command-name>")], ""), null);
  assert.deepEqual(backgroundSeed([user("<command-message>/model</command-message>")], ""), { intent: "(backgrounded)" });
  assert.deepEqual(backgroundSeed([user("Hook context:\nignore me"), user("the task")], ""), { intent: "the task" });
  assert.equal(backgroundSeed([user("Stop hook feedback:\nkeep going")], ""), null, "meta-only conversations have no seed");
});

test("background seed truncates in UTF-16 units without splitting a pair", () => {
  const line = "a".repeat(119) + "😀tail";
  const seed = backgroundSeed([user("task"), assistant(line)], "");
  assert.equal(seed?.detail?.length, 119, "the pair that straddles the boundary is dropped");
  const longIntent = "b".repeat(250);
  assert.equal(backgroundSeed([user(longIntent)], "")?.intent.length, 200);
});

test("startBackgroundSession forks the journal before spawning a detached headless child", () => {
  const root = workspace();
  const session = completedSession(root);
  const calls: { command: string; args: readonly string[]; options: Parameters<typeof spawn>[2] }[] = [];
  const fakeSpawn = ((command: string, args: readonly string[], options: Parameters<typeof spawn>[2]) => {
    calls.push({ command, args, options });
    return { pid: 4242, unref() {} } as unknown as ChildProcess;
  }) as unknown as typeof spawn;
  try {
    const started = startBackgroundSession({ session, prompt: "", entry: "/tmp/litcode-entry.js", executable: "/fake/node",
      execArgv: [], spawnProcess: fakeSpawn });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.command, "/fake/node");
    assert.deepEqual(calls[0]!.args, ["/tmp/litcode-entry.js", "--resume", started.sessionId, "First real task"]);
    assert.equal(calls[0]!.options?.cwd, root);
    assert.equal(calls[0]!.options?.detached, true);
    assert.equal((calls[0]!.options?.stdio as unknown[])[0], "ignore");
    assert.equal(started.pid, 4242);
    assert.equal(started.log, path.join(root, ".agent", "background", `${started.sessionId}.log`));
    assert.equal(fs.existsSync(started.log), true);
    const fork = Session.open(root, { id: started.sessionId });
    try {
      const branch = fork.events.find(event => event.kind === "branch");
      assert.deepEqual(branch, { kind: "branch", source: session.id, workspace: root,
        boundary: session.events.length - 1, reason: "fork" });
      assert.deepEqual(fork.messages, session.messages);
    } finally { fork.close(); }
  } finally { session.close(); }
});

test("a failed spawn removes the unused fork and reports the source failure text", () => {
  const root = workspace();
  const session = completedSession(root);
  const before = listSessions(root).length;
  const fakeSpawn = (() => { throw new Error("boom"); }) as unknown as typeof spawn;
  try {
    assert.throws(() => startBackgroundSession({ session, prompt: "", entry: "/tmp/litcode-entry.js", executable: "/fake/node", spawnProcess: fakeSpawn }),
      /Couldn't fork — boom/);
    assert.equal(listSessions(root).length, before);
  } finally { session.close(); }
});

test("an empty conversation without a prompt is refused with the source gate text", () => {
  const root = workspace();
  const config = { ...defaultConfig(root, []), model: "fixture" };
  const session = Session.open(root, { config });
  try {
    assert.throws(() => startBackgroundSession({ session, prompt: "" }), new RegExp(NOTHING_TO_BACKGROUND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(listSessions(root).length, 1);
  } finally { session.close(); }
});
