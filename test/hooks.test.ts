import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { after, test } from "node:test";

import {
  HOOK_EVENTS,
  hookDefinitionSchema,
  hookMatcherValue,
  hooksSchema,
  normalizeSessionTitle,
  runHooks,
  type CommandHookExecution,
  type HookDefinition,
  type HookEvent,
  type HooksConfig,
  type HookPayload,
} from "../src/hooks.js";

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-hooks-"));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
});

const signal = (): AbortSignal => new AbortController().signal;
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A command hook that prints a JSON object on stdout and exits 0. */
function emit(json: unknown): HookDefinition {
  return { command: `printf '%s' '${JSON.stringify(json)}'` };
}

function preTool(payload: Partial<HookPayload> = {}): HookPayload {
  return { session_id: "sess-1", cwd: process.cwd(), tool_name: "Bash", tool_input: { command: "ls" }, ...payload };
}

// ---------------------------------------------------------------------------
// Configuration shape and empty paths
// ---------------------------------------------------------------------------

test("HOOK_EVENTS lists every lifecycle event and the shared schemas map each one", () => {
  // The exported event list is the single source of truth for the session and
  // runtime schemas, so a new event must appear here exactly once, in order.
  assert.deepEqual([...HOOK_EVENTS], [
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "PostToolUseFailure",
    "PostToolBatch",
    "PreCompact",
    "PostCompact",
    "Stop",
    "StopFailure",
    "PermissionRequest", "PermissionDenied", "Notification", "UserPromptExpansion", "Setup",
    "SubagentStart", "SubagentStop", "PreModelSwitch", "PostModelSwitch", "TeammateIdle",
    "TaskCreated", "TaskCompleted", "Elicitation", "ElicitationResult", "ConfigChange",
    "InstructionsLoaded", "WorktreeCreate", "WorktreeRemove", "CwdChanged", "FileChanged",
    "DirectoryAdded", "MessageDisplay",
    "SessionEnd",
  ]);
  assert.equal(new Set(HOOK_EVENTS).size, HOOK_EVENTS.length, "events must be unique");

  // Every event is an optional list of command definitions.
  const full = Object.fromEntries(HOOK_EVENTS.map((event) => [event, [{ command: "true" }]]));
  assert.deepEqual(hooksSchema.parse(full), full);

  // The shared definition schema accepts the documented shape and rejects
  // unknown keys and a non-positive timeout.
  assert.deepEqual(hookDefinitionSchema.parse({ command: "true", matcher: "Bash", timeout: 5 }), {
    command: "true",
    matcher: "Bash",
    timeout: 5,
  });
  assert.throws(() => hookDefinitionSchema.parse({ command: "true", extra: 1 }));
  assert.throws(() => hookDefinitionSchema.parse({ command: "true", timeout: 0 }));
  assert.throws(() => hookDefinitionSchema.parse({ command: "" }));

  // The session schema is strict: an unknown event name is rejected, not dropped.
  assert.throws(() => hooksSchema.parse({ NotARealEvent: [{ command: "x" }] }));
});

test("HooksConfig accepts every event and an empty config blocks nothing", async () => {
  const config: HooksConfig = Object.fromEntries(
    HOOK_EVENTS.map((event) => [event, [{ command: "true" }]]),
  );
  assert.ok(config.PreToolUse);
  assert.ok(config.PostToolBatch);

  const empty = await runHooks({}, "PreToolUse", preTool(), signal());
  assert.deepEqual(empty, { blocked: false, additionalContext: [] });

  const missing = await runHooks({ PreToolUse: [] }, "SessionStart", {}, signal());
  assert.deepEqual(missing, { blocked: false, additionalContext: [] });

  // Definitions without a usable command are skipped.
  const skipped = await runHooks(
    { PreToolUse: [{ command: "" } as HookDefinition] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(skipped.blocked, false);
  assert.equal(skipped.additionalContext.length, 0);
});

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

test("matcher selects by tool_name with exact, alternation and wildcard forms", async () => {
  const context = (text: string): HookDefinition => emit({ additionalContext: text });

  const exact = await runHooks(
    { PreToolUse: [{ ...context("hit"), matcher: "Bash" }] },
    "PreToolUse",
    preTool({ tool_name: "Bash" }),
    signal(),
  );
  assert.deepEqual(exact.additionalContext, ["hit"]);

  const miss = await runHooks(
    { PreToolUse: [{ ...context("hit"), matcher: "Bash" }] },
    "PreToolUse",
    preTool({ tool_name: "Read" }),
    signal(),
  );
  assert.deepEqual(miss.additionalContext, []);

  const alternation = await runHooks(
    { PreToolUse: [{ ...context("alt"), matcher: "Edit|Write" }] },
    "PreToolUse",
    preTool({ tool_name: "Write" }),
    signal(),
  );
  assert.deepEqual(alternation.additionalContext, ["alt"]);

  const wildcard = await runHooks(
    { PreToolUse: [{ ...context("all"), matcher: "*" }] },
    "PreToolUse",
    preTool({ tool_name: "Anything" }),
    signal(),
  );
  assert.deepEqual(wildcard.additionalContext, ["all"]);

  const regex = await runHooks(
    { PreToolUse: [{ ...context("mcp"), matcher: "mcp__.*" }] },
    "PreToolUse",
    preTool({ tool_name: "mcp__server__tool" }),
    signal(),
  );
  assert.deepEqual(regex.additionalContext, ["mcp"]);

  // An event outside the recovered selector table has no matcher value, so
  // its configured matchers match every occurrence (`y5e` default branch).
  const noSelector = await runHooks(
    { UserPromptSubmit: [{ ...context("any"), matcher: "Bash" }] },
    "UserPromptSubmit",
    { prompt: "hi" },
    signal(),
  );
  assert.deepEqual(noSelector.additionalContext, ["any"]);
});

test("watchPaths are collected from matching hookSpecificOutput entries in order", async () => {
  const hook = (name: string, paths: unknown[]) => ({
    command: `printf '%s' '${JSON.stringify({ hookSpecificOutput: { hookEventName: name, watchPaths: paths } })}'`,
  });
  const result = await runHooks({ FileChanged: [
    hook("FileChanged", ["/a", "", 3, "/b"]),
    hook("PostToolUse", ["/wrong"]),
    hook("FileChanged", ["/c"]),
  ] }, "FileChanged", { file_path: "/w/f.md", event: "change" });
  assert.deepEqual(result.watchPaths, ["/a", "/b", "/c"]);
  const absent = await runHooks({ FileChanged: [{ command: `printf '%s' '{"additionalContext":"note"}'` }] },
    "FileChanged", { file_path: "/w/f.md", event: "change" });
  assert.equal(absent.watchPaths, undefined);
});

test("failed hook output is reported for watcher display without leaving context", async () => {
  const failed = await runHooks({ FileChanged: [{ command: "printf 'boom' >&2; exit 3" }] },
    "FileChanged", { file_path: "/w/f.md", event: "change" });
  assert.deepEqual(failed.failures, ["[FileChanged hook: exit code 3] boom"]);
  assert.deepEqual(failed.additionalContext, ["[FileChanged hook: exit code 3] boom"]);
  const clean = await runHooks({ FileChanged: [{ command: "true" }] },
    "FileChanged", { file_path: "/w/f.md", event: "change" });
  assert.equal(clean.failures, undefined);
});

test("ConfigChange exit 2 blocks the settings and skill reload gate", async () => {
  // `Zge`/`hX` make exit 2 blocking for ConfigChange; the watcher reloads only
  // when the gate does not block.
  const blocked = await runHooks({ ConfigChange: [{ command: "printf 'stop reload' >&2; exit 2" }] },
    "ConfigChange", { source: "user_settings", file_path: "/u/settings.json" });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "stop reload");
  const allowed = await runHooks({ ConfigChange: [{ command: "true" }] },
    "ConfigChange", { source: "skills", file_path: "/u/skills/x/SKILL.md" });
  assert.equal(allowed.blocked, false);
});

test("transition matchers follow the recovered per-event selector fields", async () => {
  const context = (text: string): HookDefinition => emit({ additionalContext: text });
  const run = (event: HookEvent, matcher: string, payload: HookPayload) =>
    runHooks({ [event]: [{ ...context("hit"), matcher }] } as HooksConfig, event, payload, signal());

  // FileChanged selects the file's basename (`h5e`, the path basename).
  assert.deepEqual((await run("FileChanged", "notes\\.md", { file_path: "/w/docs/notes.md" })).additionalContext, ["hit"]);
  assert.deepEqual((await run("FileChanged", "docs\\.md", { file_path: "/w/docs/notes.md" })).additionalContext, []);
  // DirectoryAdded and ConfigChange select `source`, not the directory.
  assert.deepEqual((await run("DirectoryAdded", "slash_command", { directory: "/w", source: "slash_command" })).additionalContext, ["hit"]);
  assert.deepEqual((await run("DirectoryAdded", "/w", { directory: "/w", source: "slash_command" })).additionalContext, []);
  // InstructionsLoaded selects the load reason; Setup selects the trigger.
  assert.deepEqual((await run("InstructionsLoaded", "session_start", { load_reason: "session_start" })).additionalContext, ["hit"]);
  assert.deepEqual((await run("InstructionsLoaded", "startup", { load_reason: "session_start" })).additionalContext, []);
  assert.deepEqual((await run("Setup", "init", { trigger: "init" })).additionalContext, ["hit"]);
  // CwdChanged has no selector, so a configured matcher matches it.
  assert.deepEqual((await run("CwdChanged", "never", { old_cwd: "/a", new_cwd: "/b" })).additionalContext, ["hit"]);
  // TaskCreated also has no selector, even when a tool name is present.
  assert.deepEqual((await run("TaskCreated", "Bash", { tool_name: "Bash" })).additionalContext, ["hit"]);

  assert.equal(hookMatcherValue("FileChanged", { file_path: "/w/a/b.md" }), "b.md");
  assert.equal(hookMatcherValue("Notification", { notification_type: "plugin_notification" }), "plugin_notification");
  assert.equal(hookMatcherValue("Elicitation", { mcp_server_name: "server" }), "server");
  assert.equal(hookMatcherValue("SessionEnd", { reason: "exit" }), "exit");
  assert.equal(hookMatcherValue("PreModelSwitch", { to_model: "second-model" }), "second-model");
  assert.equal(hookMatcherValue("PreModelSwitch", { model: "second-model" }), undefined);
  assert.equal(hookMatcherValue("TaskCreated", { tool_name: "Bash" }), undefined);
});

// ---------------------------------------------------------------------------
// stdin payload
// ---------------------------------------------------------------------------

test("the hook receives the contract JSON on stdin", async () => {
  const dir = tmpDir();
  const capture = path.join(dir, "payload.json");
  const payload = preTool({
    transcript_path: "/tmp/transcript.jsonl",
    tool_response: { ok: true, stdout: "result" },
  });
  const result = await runHooks(
    { PreToolUse: [{ command: `cat > ${JSON.stringify(capture)}` }] },
    "PreToolUse",
    payload,
    signal(),
  );
  assert.equal(result.blocked, false);
  const parsed = JSON.parse(fs.readFileSync(capture, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.hook_event_name, "PreToolUse");
  assert.equal(parsed.session_id, "sess-1");
  assert.equal(parsed.cwd, process.cwd());
  assert.equal(parsed.tool_name, "Bash");
  assert.deepEqual(parsed.tool_input, { command: "ls" });
  assert.deepEqual(parsed.tool_response, { ok: true, stdout: "result" });
  assert.equal(parsed.transcript_path, "/tmp/transcript.jsonl");
});

test("hook stdin is newline-terminated so a line reader can consume it", async () => {
  const dir = tmpDir();
  const out = path.join(dir, "line.json");
  // `head -n 1` is a line-oriented consumer: it emits the first newline-
  // terminated record and can finish without waiting for EOF.
  await runHooks(
    { PreToolUse: [{ command: `head -n 1 > ${JSON.stringify(out)}` }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  const raw = fs.readFileSync(out, "utf8");
  assert.ok(raw.endsWith("\n"), "hook stdin record must be newline-terminated");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(parsed.hook_event_name, "PreToolUse");
  assert.equal(parsed.tool_name, "Bash");
});

test("UserPromptSubmit payload serializes the prompt field", async () => {
  const dir = tmpDir();
  const capture = path.join(dir, "prompt.json");
  await runHooks(
    { UserPromptSubmit: [{ command: `cat > ${JSON.stringify(capture)}` }] },
    "UserPromptSubmit",
    { prompt: "do the thing" },
    signal(),
  );
  const parsed = JSON.parse(fs.readFileSync(capture, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.hook_event_name, "UserPromptSubmit");
  assert.equal(parsed.prompt, "do the thing");
});

test("the hook runs with the payload cwd", async () => {
  const dir = tmpDir();
  const out = path.join(dir, "pwd.txt");
  const result = await runHooks(
    { PreToolUse: [{ command: `printf '%s' "$PWD" > ${JSON.stringify(out)}` }] },
    "PreToolUse",
    preTool({ cwd: dir }),
    signal(),
  );
  assert.equal(result.blocked, false);
  assert.equal(fs.readFileSync(out, "utf8"), fs.realpathSync(dir));
});

test("new event payload fields serialize onto stdin", async () => {
  const dir = tmpDir();
  const cases: {
    event: HookEvent;
    payload: Partial<HookPayload>;
    check: (parsed: Record<string, unknown>) => void;
  }[] = [
    {
      event: "PostToolBatch",
      payload: { tool_calls: [{ tool_name: "Bash", tool_input: { command: "true" }, tool_use_id: "a", tool_response: "ok" }] },
      check: (p) => assert.deepEqual(p.tool_calls,
        [{ tool_name: "Bash", tool_input: { command: "true" }, tool_use_id: "a", tool_response: "ok" }]),
    },
    {
      event: "PostToolUseFailure",
      payload: { tool_name: "Bash", tool_use_id: "t1", error: "boom", is_interrupt: true },
      check: (p) => {
        assert.equal(p.error, "boom");
        assert.equal(p.is_interrupt, true);
      },
    },
    { event: "PreCompact", payload: { trigger: "auto" }, check: (p) => assert.equal(p.trigger, "auto") },
    {
      event: "PostCompact",
      payload: { trigger: "manual", compact_summary: "the summary" },
      check: (p) => {
        assert.equal(p.trigger, "manual");
        assert.equal(p.compact_summary, "the summary");
      },
    },
    {
      event: "StopFailure",
      payload: { error: "rate_limit", stop_reason: "max_tokens" },
      check: (p) => {
        assert.equal(p.error, "rate_limit");
        assert.equal(p.stop_reason, "max_tokens");
      },
    },
    { event: "SessionEnd", payload: { reason: "clear" }, check: (p) => assert.equal(p.reason, "clear") },
  ];
  for (const { event, payload, check } of cases) {
    const capture = path.join(dir, `${event}.json`);
    await runHooks(
      { [event]: [{ command: `cat > ${JSON.stringify(capture)}` }] } as HooksConfig,
      event,
      payload,
      signal(),
    );
    const parsed = JSON.parse(fs.readFileSync(capture, "utf8")) as Record<string, unknown>;
    assert.equal(parsed.hook_event_name, event);
    check(parsed);
  }
});

test("PreCompact turns raw stdout into context and PostCompact appends display context", async () => {
  // PreCompact is a raw-stdout contract: plain text becomes context verbatim,
  // and even raw JSON is appended as-is (it is not parsed for structured fields).
  const plain = await runHooks(
    { PreCompact: [{ command: "printf 'prefer a short summary'" }] },
    "PreCompact",
    { trigger: "auto" },
    signal(),
  );
  assert.equal(plain.blocked, false);
  assert.deepEqual(plain.additionalContext, ["prefer a short summary"]);

  const rawJson = await runHooks(
    { PreCompact: [emit({ hookSpecificOutput: { hookEventName: "PreCompact", additionalContext: "ignored" } })] },
    "PreCompact",
    { trigger: "manual" },
    signal(),
  );
  // The whole JSON blob is the context; the embedded additionalContext is not
  // extracted, so nothing here blocks or contributes a second entry.
  assert.equal(rawJson.blocked, false);
  assert.equal(rawJson.additionalContext.length, 1);
  assert.ok(rawJson.additionalContext[0]!.startsWith("{"));

  // PostCompact keeps the standard structured protocol.
  const post = await runHooks(
    { PostCompact: [emit({ hookSpecificOutput: { hookEventName: "PostCompact", additionalContext: "post note" } })] },
    "PostCompact",
    { trigger: "auto", compact_summary: "s" },
    signal(),
  );
  assert.equal(post.blocked, false);
  assert.deepEqual(post.additionalContext, ["post note"]);
  const postText = await runHooks({ PostCompact: [{ command: "printf '  ordinary compact output  '" }] },
    "PostCompact", { trigger: "manual", compact_summary: "s" }, signal());
  assert.deepEqual(postText.additionalContext, ["ordinary compact output"]);
  assert.equal(postText.blocked, false);
});

// ---------------------------------------------------------------------------
// Exit-code semantics
// ---------------------------------------------------------------------------

test("exit code 2 blocks PreToolUse with the stderr reason", async () => {
  const blocked = await runHooks(
    { PreToolUse: [{ command: "echo 'tool denied' 1>&2; exit 2" }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "tool denied");
});

test("exit code 2 blocks UserPromptSubmit", async () => {
  const blocked = await runHooks(
    { UserPromptSubmit: [{ command: "echo 'prompt rejected' 1>&2; exit 2" }] },
    "UserPromptSubmit",
    { prompt: "hi" },
    signal(),
  );
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "prompt rejected");
});

test("exit code 2 never blocks the display-only feedback events", async () => {
  const events = ["PostToolUse", "SessionStart", "SessionEnd", "StopFailure", "PostCompact"] as const;
  for (const event of events) {
    const result = await runHooks(
      { [event]: [{ command: "echo 'late failure' 1>&2; exit 2" }] } as HooksConfig,
      event,
      {},
      signal(),
    );
    assert.equal(result.blocked, false, `${event} must not block`);
    assert.equal(result.reason, undefined, `${event} must not carry a block reason`);
    assert.equal(result.stopRequested, undefined, `${event} must not request a stop`);
    assert.ok(
      result.additionalContext.some((entry) => entry.includes("exit code 2 is non-blocking")),
      `${event} should record a non-blocking note`,
    );
  }
});

test("exit code 2 blocks PreCompact, PostToolBatch and PostToolUseFailure", async () => {
  for (const event of ["PreCompact", "PostToolBatch", "PostToolUseFailure"] as const) {
    const result = await runHooks(
      { [event]: [{ command: "echo 'blocked here' 1>&2; exit 2" }] } as HooksConfig,
      event,
      {},
      signal(),
    );
    assert.equal(result.blocked, true, `${event} should block on exit 2`);
    assert.equal(result.reason, "blocked here");
    assert.equal(result.stopRequested, undefined, `${event} must not request a terminal stop`);
  }
});

test("exit code 2 on Stop requests continuation without requesting a terminal stop", async () => {
  const result = await runHooks(
    { Stop: [{ command: "echo 'keep going' 1>&2; exit 2" }] },
    "Stop",
    {},
    signal(),
  );
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "keep going");
  // A continuation request must not set the terminal stop flag.
  assert.equal(result.stopRequested, undefined);
});

test("a Stop decision:block JSON requests continuation", async () => {
  const result = await runHooks(
    { Stop: [emit({ decision: "block", reason: "run another turn" })] },
    "Stop",
    {},
    signal(),
  );
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "run another turn");
  assert.equal(result.stopRequested, undefined);
});

test("a top-level decision:block is ignored for events that do not support it", async () => {
  for (const event of ["PostToolUse", "SessionStart", "SessionEnd", "StopFailure", "PostCompact"] as const) {
    const result = await runHooks(
      { [event]: [emit({ decision: "block", reason: "nope" })] } as HooksConfig,
      event,
      {},
      signal(),
    );
    assert.equal(result.blocked, false, `${event} must ignore decision:block`);
    assert.equal(result.reason, undefined);
  }
});

test("a decision:block blocks PostToolBatch and PostToolUseFailure", async () => {
  for (const event of ["PostToolBatch", "PostToolUseFailure"] as const) {
    const result = await runHooks(
      { [event]: [emit({ decision: "block", reason: `${event} stop` })] } as HooksConfig,
      event,
      {},
      signal(),
    );
    assert.equal(result.blocked, true, `${event} should block on decision:block`);
    assert.equal(result.reason, `${event} stop`);
    assert.equal(result.stopRequested, undefined);
  }
});

test("a PreCompact decision:block blocks but continue:false is ignored", async () => {
  const blocked = await runHooks(
    { PreCompact: [emit({ decision: "block", reason: "do not compact" })] },
    "PreCompact",
    { trigger: "auto" },
    signal(),
  );
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "do not compact");
  assert.equal(blocked.stopRequested, undefined);

  // continue:false is not consumed for PreCompact: no block, no stop request.
  const ignored = await runHooks(
    { PreCompact: [emit({ continue: false, stopReason: "halt" })] },
    "PreCompact",
    { trigger: "auto" },
    signal(),
  );
  assert.equal(ignored.blocked, false);
  assert.equal(ignored.stopRequested, undefined);
  assert.equal(ignored.reason, undefined);
});

test("PostToolUseFailure carries feedback without blocking on context alone", async () => {
  const result = await runHooks(
    { PostToolUseFailure: [emit({ additionalContext: "retry without sudo" })] },
    "PostToolUseFailure",
    { tool_name: "Bash", tool_use_id: "t1", error: "permission denied", is_interrupt: false },
    signal(),
  );
  assert.equal(result.blocked, false);
  assert.deepEqual(result.additionalContext, ["retry without sudo"]);
});

test("a non-zero, non-2 exit is a recorded non-blocking error", async () => {
  const result = await runHooks(
    { PreToolUse: [{ command: "echo 'minor problem' 1>&2; exit 1" }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(result.blocked, false);
  assert.equal(result.reason, undefined);
  assert.ok(result.additionalContext.some((entry) => entry.includes("exit code 1") && entry.includes("minor problem")));
});

// ---------------------------------------------------------------------------
// stdout JSON: hookSpecificOutput validation
// ---------------------------------------------------------------------------

test("PreToolUse permissionDecision deny blocks and carries the reason", async () => {
  const result = await runHooks(
    {
      PreToolUse: [
        emit({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: "policy",
          },
        }),
      ],
    },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "policy");
});

test("PreToolUse permissionDecision allow returns updatedInput", async () => {
  const result = await runHooks(
    {
      PreToolUse: [
        emit({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "allow",
            updatedInput: { command: "echo safe" },
          },
        }),
      ],
    },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(result.blocked, false);
  assert.deepEqual(result.updatedInput, { command: "echo safe" });
});

test("hookSpecificOutput is ignored unless hookEventName matches the event", async () => {
  const mismatch = await runHooks(
    {
      PreToolUse: [
        emit({
          hookSpecificOutput: { hookEventName: "PostToolUse", permissionDecision: "deny", permissionDecisionReason: "no" },
        }),
      ],
    },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(mismatch.blocked, false);
  assert.equal(mismatch.reason, undefined);

  const missing = await runHooks(
    { PreToolUse: [emit({ hookSpecificOutput: { permissionDecision: "deny" } })] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(missing.blocked, false);
});

test("ask and defer are recorded and denied until a UI resolves them", async () => {
  for (const decision of ["ask", "defer"]) {
    const result = await runHooks(
      { PreToolUse: [emit({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision } })] },
      "PreToolUse",
      preTool(),
      signal(),
    );
    assert.equal(result.blocked, true, `${decision} should gate the call`);
    assert.match(result.reason ?? "", new RegExp(`"${decision}"`));
    assert.match(result.reason ?? "", /deny-until-UI/);
  }
});

test("an unknown permissionDecision is ignored and does not carry updatedInput", async () => {
  const result = await runHooks(
    {
      PreToolUse: [
        emit({
          hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "maybe", updatedInput: { x: 1 } },
        }),
      ],
    },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(result.blocked, false);
  assert.equal(result.updatedInput, undefined);
});

test("continue:false blocks and requests a terminal stop (PreCompact excepted)", async () => {
  const result = await runHooks(
    { PostToolUse: [emit({ continue: false, stopReason: "halt" })] },
    "PostToolUse",
    {},
    signal(),
  );
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "halt");
  // continue:false is the only output that requests termination.
  assert.equal(result.stopRequested, true);

  const onStop = await runHooks(
    { Stop: [emit({ continue: false, reason: "done" })] },
    "Stop",
    {},
    signal(),
  );
  assert.equal(onStop.blocked, true);
  assert.equal(onStop.reason, "done");
  assert.equal(onStop.stopRequested, true);
});

test("Stop additionalContext is a continuation request without a terminal stop", async () => {
  const result = await runHooks(
    { Stop: [emit({ additionalContext: "one more thing" })] },
    "Stop",
    {},
    signal(),
  );
  assert.equal(result.blocked, true, "Stop context should request continuation");
  assert.equal(result.stopRequested, undefined, "continuation is not a terminal stop");
  assert.deepEqual(result.additionalContext, ["one more thing"]);
  assert.match(result.reason ?? "", /additional context/);
});

test("additionalContext is appended from top level and hookSpecificOutput", async () => {
  const result = await runHooks(
    {
      PostToolUse: [
        emit({ additionalContext: "top-level" }),
        emit({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: ["one", "two"] } }),
      ],
    },
    "PostToolUse",
    {},
    signal(),
  );
  assert.deepEqual(result.additionalContext, ["top-level", "one", "two"]);
  assert.equal(result.blocked, false);
});

test("non-object or invalid stdout JSON is ignored", async () => {
  const text = await runHooks(
    { PreToolUse: [{ command: "echo not json" }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.deepEqual(text, { blocked: false, additionalContext: [] });

  const arr = await runHooks(
    { PreToolUse: [emit([1, 2, 3])] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.deepEqual(arr, { blocked: false, additionalContext: [] });
});

// ---------------------------------------------------------------------------
// Merging multiple hooks
// ---------------------------------------------------------------------------

test("every matching hook runs and a single block wins", async () => {
  const result = await runHooks(
    {
      PreToolUse: [
        emit({ additionalContext: "first" }),
        { command: "echo 'blocked here' 1>&2; exit 2" },
        emit({ additionalContext: "third" }),
      ],
    },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "blocked here");
  assert.deepEqual(result.additionalContext, ["first", "third"]);
});

// ---------------------------------------------------------------------------
// Timeout, abort and process-group cleanup
// ---------------------------------------------------------------------------

test("a timed-out hook is non-blocking and is killed promptly", async () => {
  const start = Date.now();
  const result = await runHooks(
    { PreToolUse: [{ command: "sleep 30", timeout: 1 }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  const elapsed = Date.now() - start;
  assert.equal(result.blocked, false);
  assert.ok(result.additionalContext.some((entry) => entry.includes("timed out")), result.additionalContext.join(" | "));
  assert.ok(elapsed < 4000, `expected prompt kill, took ${elapsed}ms`);
});

test("the whole process group is killed on timeout, including background children", async () => {
  const start = Date.now();
  const result = await runHooks(
    { PreToolUse: [{ command: "sleep 30 & wait", timeout: 1 }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  const elapsed = Date.now() - start;
  assert.equal(result.blocked, false);
  assert.ok(elapsed < 4000, `background child kept the pipe open: ${elapsed}ms`);
});

test("an already-aborted signal prevents the hook from starting", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await runHooks(
    { PreToolUse: [{ command: "echo should-not-run > /tmp/ccrev-should-not-exist" }] },
    "PreToolUse",
    preTool(),
    controller.signal,
  );
  assert.equal(result.blocked, false);
  assert.ok(result.additionalContext.some((entry) => entry.includes("cancelled before start")));
  assert.equal(fs.existsSync("/tmp/ccrev-should-not-exist"), false);
});

test("aborting mid-run kills the command group and resolves", async () => {
  const controller = new AbortController();
  const start = Date.now();
  const pending = runHooks(
    { PreToolUse: [{ command: "sleep 30" }] },
    "PreToolUse",
    preTool(),
    controller.signal,
  );
  await delay(100);
  controller.abort();
  const result = await pending;
  const elapsed = Date.now() - start;
  assert.equal(result.blocked, false);
  assert.ok(result.additionalContext.some((entry) => entry.includes("aborted")));
  assert.ok(elapsed < 3000, `abort did not kill promptly: ${elapsed}ms`);
});

// ---------------------------------------------------------------------------
// Explicit command execution only
// ---------------------------------------------------------------------------

test("command hooks perform only their explicit configured command", async () => {
  // A hook that produces no output and exits 0 contributes nothing beyond
  // having executed. The module itself performs no I/O other than the command.
  const result = await runHooks(
    { PreToolUse: [{ command: "exit 0" }] },
    "PreToolUse",
    preTool(),
    signal(),
  );
  assert.deepEqual(result, { blocked: false, additionalContext: [] });
});

async function localServer(handler: http.RequestListener): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}/hook`,
    close: () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }),
  };
}

test("hook transport definitions preserve legacy commands and reject ambiguous/credential shapes", () => {
  assert.deepEqual(hookDefinitionSchema.parse({ command: "true" }), { command: "true" });
  assert.deepEqual(hookDefinitionSchema.parse({ type: "command", command: "true", async: true }), { type: "command", command: "true", async: true });
  assert.deepEqual(hookDefinitionSchema.parse({ command: "true", asyncRewake: true, rewakeMessage: "prefix", rewakeSummary: "summary" }),
    { command: "true", asyncRewake: true, rewakeMessage: "prefix", rewakeSummary: "summary" });
  assert.throws(() => hookDefinitionSchema.parse({ command: "true", rewakeMessage: "" }));
  assert.deepEqual(hookDefinitionSchema.parse({ type: "http", url: "http://127.0.0.1/hook", headersEnv: { Authorization: "HOOK_TOKEN" } }), { type: "http", url: "http://127.0.0.1/hook", headersEnv: { Authorization: "HOOK_TOKEN" } });
  for (const invalid of [
    { type: "http", url: "file:///tmp/hook" },
    { type: "http", url: "https://user:secret@example.test/hook" },
    { type: "http", url: "https://example.test/hook", headers: { Authorization: "secret" } },
    { type: "http", url: "https://example.test/hook", command: "true" },
    { type: "http", url: "https://example.test/hook", headersEnv: { "X-Key": "secret value" } },
    { type: "prompt", command: "true" },
    { type: "agent", prompt: "check", extra: true },
  ]) assert.throws(() => hookDefinitionSchema.parse(invalid));
  assert.equal(HOOK_EVENTS.length, 33);
});

test("flat regex matcher preserves grouped alternation and transition-specific selector fields", async () => {
  const result = await runHooks({ PreToolUse: [{ ...emit({ additionalContext: "matched" }), matcher: "(Read|Write)File" }] }, "PreToolUse", preTool({ tool_name: "WriteFile" }));
  assert.deepEqual(result.additionalContext, ["matched"]);
  const started = await runHooks({ SubagentStart: [{ ...emit({ additionalContext: "worker" }), matcher: "research.*" }] }, "SubagentStart", { agent_type: "researcher" });
  assert.deepEqual(started.additionalContext, ["worker"]);
  const miss = await runHooks({ PreToolUse: [{ ...emit({ additionalContext: "bad" }), matcher: "(" }] }, "PreToolUse", preTool());
  assert.deepEqual(miss.additionalContext, []);
});

test("HTTP hook posts JSON and consumes structured output with ephemeral environment headers", async () => {
  let requestPayload: unknown;
  let token: string | undefined;
  const endpoint = await localServer((request, response) => {
    assert.equal(request.method, "POST");
    assert.equal(request.headers["content-type"], "application/json");
    token = request.headers["x-hook-token"] as string;
    const chunks: Buffer[] = [];
    request.on("data", chunk => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      requestPayload = JSON.parse(Buffer.concat(chunks).toString());
      response.end(JSON.stringify({ suppressOutput: true, systemMessage: "display note", hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", updatedInput: { command: "pwd" }, additionalContext: "HTTP context" } }));
    });
  });
  try {
    const definition: HookDefinition = { type: "http", url: endpoint.url, headersEnv: { "X-Hook-Token": "TEST_HOOK_TOKEN" } };
    const result = await runHooks({ PreToolUse: [definition] }, "PreToolUse", preTool(), signal(), { environment: { TEST_HOOK_TOKEN: "ephemeral-value" } });
    assert.equal(token, "ephemeral-value");
    assert.equal((requestPayload as any).hook_event_name, "PreToolUse");
    assert.deepEqual((requestPayload as any).tool_input, { command: "ls" });
    assert.equal(result.blocked, false);
    assert.equal(result.permissionDecision, "allow");
    assert.deepEqual(result.updatedInput, { command: "pwd" });
    assert.equal(result.suppressOutput, true);
    assert.deepEqual(result.systemMessages, ["display note"]);
    assert.deepEqual(result.additionalContext, ["HTTP context"]);
    assert.equal(JSON.stringify(definition).includes("ephemeral-value"), false);
    assert.equal(JSON.stringify(result).includes("ephemeral-value"), false);
  } finally { await endpoint.close(); }
});

test("HTTP hooks reject redirects, errors, malformed JSON and oversized response without interpreting them", async () => {
  let redirected = false;
  const destination = await localServer((_request, response) => { redirected = true; response.end("{}"); });
  const endpoint = await localServer((request, response) => {
    if (request.url === "/redirect") { response.writeHead(302, { location: destination.url }); response.end(); }
    else if (request.url === "/error") { response.writeHead(500); response.end("secret response"); }
    else if (request.url === "/huge") response.end(JSON.stringify({ additionalContext: "x".repeat(70_000) }));
    else response.end("{malformed");
  });
  try {
    for (const [route, diagnostic] of [["redirect", "redirect rejected"], ["error", "status 500"], ["huge", "output cap"], ["bad", "malformed JSON"]]) {
      const result = await runHooks({ PreToolUse: [{ type: "http", url: new URL(`/${route}`, endpoint.url).href }] }, "PreToolUse", preTool());
      assert.equal(result.blocked, false);
      assert.ok(result.additionalContext.some(text => text.includes(diagnostic!)));
      assert.equal(JSON.stringify(result).includes("secret response"), false);
      assert.ok(Buffer.byteLength(JSON.stringify(result)) < 1000);
    }
    assert.equal(redirected, false);
  } finally { await endpoint.close(); await destination.close(); }
});

test("HTTP hook cancellation, timeout and missing header variables prevent or end requests", async () => {
  let requests = 0;
  const endpoint = await localServer(() => { requests++; });
  try {
    const pre = new AbortController();
    pre.abort();
    const cancelled = await runHooks({ PreToolUse: [{ type: "http", url: endpoint.url }] }, "PreToolUse", preTool(), pre.signal);
    assert.equal(requests, 0);
    assert.ok(cancelled.additionalContext.some(text => text.includes("cancelled before start")));
    const missing = await runHooks({ PreToolUse: [{ type: "http", url: endpoint.url, headersEnv: { "X-Test": "MISSING_VAR" } }] }, "PreToolUse", preTool(), signal(), { environment: {} });
    assert.equal(requests, 0);
    assert.ok(missing.additionalContext.some(text => text.includes("missing or invalid")));
    const timeout = await runHooks({ PreToolUse: [{ type: "http", url: endpoint.url, timeout: 0.05 }] }, "PreToolUse", preTool());
    assert.ok(timeout.additionalContext.some(text => text.includes("timed out")));
    const controller = new AbortController();
    const pending = runHooks({ PreToolUse: [{ type: "http", url: endpoint.url }] }, "PreToolUse", preTool(), controller.signal);
    await delay(30);
    controller.abort();
    const aborted = await pending;
    assert.ok(aborted.additionalContext.some(text => text.includes("aborted")));
  } finally { await endpoint.close(); }
});

test("event output translation retains permission, updated result and general specific fields", async () => {
  const updates = [{ type: "addRules", rules: [{ toolName: "read_file" }], behavior: "allow", destination: "session" }];
  const permission = await runHooks({ PermissionRequest: [emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedInput: { path: "a" }, updatedPermissions: updates } } })] }, "PermissionRequest", { tool_name: "read_file" });
  assert.equal(permission.permissionDecision, "allow");
  assert.deepEqual(permission.updatedInput, { path: "a" });
  assert.deepEqual(permission.updatedPermissions, updates);
  // The stdout object is validated as a whole against the event schema
  // (chunk-n3ykh62m.js offset 395678): one malformed update entry makes every
  // field of that output unused, including the top-level ones.
  const malformed = await runHooks({ PermissionRequest: [emit({ systemMessage: "not shown", hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow", updatedPermissions: [{ type: "allow", tool: "read_file" }] } } })] }, "PermissionRequest", {});
  assert.equal(malformed.permissionDecision, undefined);
  assert.equal(malformed.updatedPermissions, undefined);
  assert.equal(malformed.systemMessages, undefined);
  const denied = await runHooks({ PermissionRequest: [emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "blocked" } } })] }, "PermissionRequest", {});
  assert.equal(denied.blocked, true);
  assert.equal(denied.reason, "blocked");
  const output = await runHooks({ PostToolUse: [emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedToolOutput: { replacement: true } } })] }, "PostToolUse", {});
  assert.deepEqual(output.updatedToolOutput, { replacement: true });
  const mcpOutput = await runHooks({ PostToolUse: [emit({ hookSpecificOutput: { hookEventName: "PostToolUse", updatedMCPToolOutput: { mcp: true } } })] }, "PostToolUse", {});
  assert.deepEqual(mcpOutput.updatedMCPToolOutput, { mcp: true });
  assert.equal("updatedToolOutput" in mcpOutput, false);
  const mcpElsewhere = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", updatedMCPToolOutput: "ignored" } })] }, "UserPromptSubmit", {});
  assert.equal("updatedMCPToolOutput" in mcpElsewhere, false);
  const expansion = await runHooks({ UserPromptExpansion: [emit({ hookSpecificOutput: { hookEventName: "UserPromptExpansion", updatedPrompt: "expanded" } })] }, "UserPromptExpansion", {});
  assert.equal("updatedPrompt" in expansion, false);
  const generic = await runHooks({ ElicitationResult: [emit({ hookSpecificOutput: { hookEventName: "ElicitationResult", action: "accept", content: { name: "x" } } })] }, "ElicitationResult", {});
  assert.deepEqual(generic.hookSpecificOutput, [{ hookEventName: "ElicitationResult", action: "accept", content: { name: "x" } }]);
  const startTitle = await runHooks({ SessionStart: [emit({ hookSpecificOutput: { hookEventName: "SessionStart", sessionTitle: "Start" } })] }, "SessionStart", {});
  assert.equal(startTitle.sessionTitle, "Start");
  const submitTitle = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", sessionTitle: "Submit" } })] }, "UserPromptSubmit", {});
  assert.equal(submitTitle.sessionTitle, "Submit");
  const ignored = await runHooks({ Stop: [emit({ hookSpecificOutput: { hookEventName: "Stop", sessionTitle: "Ignored" } })] }, "Stop", {});
  assert.equal("sessionTitle" in ignored, false);
  const initial = await runHooks({ SessionStart: [
    emit({ hookSpecificOutput: { hookEventName: "SessionStart", initialUserMessage: "first" } }),
    emit({ hookSpecificOutput: { hookEventName: "SessionStart", initialUserMessage: "second" } }),
  ] }, "SessionStart", {});
  assert.equal(initial.initialUserMessage, "second");
  const emptyInitial = await runHooks({ SessionStart: [emit({ hookSpecificOutput: { hookEventName: "SessionStart", initialUserMessage: "" } })] }, "SessionStart", {});
  assert.equal("initialUserMessage" in emptyInitial, false);
  const submitInitial = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", initialUserMessage: "not a start" } })] }, "UserPromptSubmit", {});
  assert.equal("initialUserMessage" in submitInitial, false);
  const reload = await runHooks({ SessionStart: [emit({ hookSpecificOutput: { hookEventName: "SessionStart", reloadSkills: true } })] }, "SessionStart", {});
  assert.equal(reload.reloadSkills, true);
  const noReload = await runHooks({ SessionStart: [emit({ hookSpecificOutput: { hookEventName: "SessionStart", reloadSkills: false } })] }, "SessionStart", {});
  assert.equal("reloadSkills" in noReload, false);
  const submitReload = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", reloadSkills: true } })] }, "UserPromptSubmit", {});
  assert.equal("reloadSkills" in submitReload, false);
  const suppress = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: true } })] }, "UserPromptSubmit", {});
  assert.equal(suppress.suppressOriginalPrompt, true);
  const suppressExpansion = await runHooks({ UserPromptExpansion: [emit({ hookSpecificOutput: { hookEventName: "UserPromptExpansion", suppressOriginalPrompt: true } })] }, "UserPromptExpansion", {});
  assert.equal(suppressExpansion.suppressOriginalPrompt, true);
  const notSuppressed = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", suppressOriginalPrompt: false } })] }, "UserPromptSubmit", {});
  assert.equal("suppressOriginalPrompt" in notSuppressed, false);
  const startSuppress = await runHooks({ SessionStart: [emit({ hookSpecificOutput: { hookEventName: "SessionStart", suppressOriginalPrompt: true } })] }, "SessionStart", {});
  assert.equal("suppressOriginalPrompt" in startSuppress, false);
  const retry = await runHooks({ PermissionDenied: [emit({ hookSpecificOutput: { hookEventName: "PermissionDenied", retry: true } })] }, "PermissionDenied", {});
  assert.equal(retry.retry, true);
  const noRetry = await runHooks({ PermissionDenied: [emit({ hookSpecificOutput: { hookEventName: "PermissionDenied", retry: false } })] }, "PermissionDenied", {});
  assert.equal("retry" in noRetry, false);
  const deniedElsewhere = await runHooks({ PermissionRequest: [emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", retry: true } })] }, "PermissionRequest", {});
  assert.equal("retry" in deniedElsewhere, false);
  const switchDeny = await runHooks({ PreModelSwitch: [emit({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "deny", permissionDecisionReason: "no" } })] }, "PreModelSwitch", {});
  assert.equal(switchDeny.permissionDecision, "deny");
  assert.equal(switchDeny.permissionDecisionReason, "no");
  assert.equal(switchDeny.blocked, false);
  const switchAsk = await runHooks({ PreModelSwitch: [
    emit({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "allow" } }),
    emit({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "ask" } }),
    emit({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "deny" } }),
  ] }, "PreModelSwitch", {});
  assert.equal(switchAsk.permissionDecision, "deny");
  const askOnly = await runHooks({ PreModelSwitch: [emit({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "ask" } })] }, "PreModelSwitch", {});
  assert.equal(askOnly.permissionDecision, "ask");
  assert.equal("permissionDecisionReason" in askOnly, false);
  const notModelSwitch = await runHooks({ UserPromptSubmit: [emit({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", permissionDecision: "deny" } })] }, "UserPromptSubmit", {});
  assert.equal("permissionDecision" in notModelSwitch, false);
});

test("WorktreeCreate reads worktreePath from hook JSON or command stdout only", async () => {
  const json = await runHooks({ WorktreeCreate: [emit({ hookSpecificOutput: { hookEventName: "WorktreeCreate", worktreePath: "/fixture/tree" } })] }, "WorktreeCreate", {});
  assert.equal(json.worktreePath, "/fixture/tree");
  // `cU`/`p7n`: a command hook supplies the trailing non-empty stdout line.
  const command = await runHooks({ WorktreeCreate: [{ hooks: [{ type: "command", command: "printf '%s\\n' /fixture/echoed" }] }] },
    "WorktreeCreate", { cwd: process.cwd() });
  assert.equal(command.worktreePath, "/fixture/echoed");
  // The first successful hook with a non-empty line wins; empty output is skipped.
  const ordered = await runHooks({ WorktreeCreate: [
    { hooks: [{ type: "command", command: "true" }] },
    { hooks: [{ type: "command", command: "printf '%s\\n' /fixture/second" }] },
  ] }, "WorktreeCreate", { cwd: process.cwd() });
  assert.equal(ordered.worktreePath, "/fixture/second");
  const mismatched = await runHooks({ WorktreeCreate: [emit({ hookSpecificOutput: { hookEventName: "PostToolUse", worktreePath: "/fixture/wrong-event" } })] }, "WorktreeCreate", {});
  assert.equal("worktreePath" in mismatched, false);
  const elsewhere = await runHooks({ PostToolUse: [emit({ hookSpecificOutput: { hookEventName: "PostToolUse", worktreePath: "/fixture/not-create" } })] }, "PostToolUse", {});
  assert.equal("worktreePath" in elsewhere, false);
});

test("Elicitation hooks answer with the last action and admit string or record content", async () => {
  const accept = await runHooks({ Elicitation: [emit({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { choice: "hook" } } })] }, "Elicitation", {});
  assert.deepEqual(accept.elicitationResponse, { action: "accept", content: { choice: "hook" } });
  const text = await runHooks({ Elicitation: [emit({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: "note" } })] }, "Elicitation", {});
  assert.deepEqual(text.elicitationResponse, { action: "accept", content: "note" });
  const last = await runHooks({ Elicitation: [
    emit({ hookSpecificOutput: { hookEventName: "Elicitation", action: "accept", content: { choice: "first" } } }),
    emit({ hookSpecificOutput: { hookEventName: "Elicitation", action: "decline" } }),
  ] }, "Elicitation", {});
  assert.deepEqual(last.elicitationResponse, { action: "decline" });
  const noAction = await runHooks({ Elicitation: [emit({ hookSpecificOutput: { hookEventName: "Elicitation", content: { choice: "no" } } })] }, "Elicitation", {});
  assert.equal("elicitationResponse" in noAction, false);
  const elsewhere = await runHooks({ Setup: [emit({ hookSpecificOutput: { hookEventName: "Setup", action: "accept" } })] }, "Setup", {});
  assert.equal("elicitationResponse" in elsewhere, false);
});

test("session titles normalize like the recovered ci helper", () => {
  assert.equal(normalizeSessionTitle("  a\u0000b\u2028c  "), "a b c");
  assert.equal(normalizeSessionTitle("\u0000\u0007"), "");
  assert.equal(normalizeSessionTitle("x".repeat(201)), "x".repeat(200));
  assert.equal(normalizeSessionTitle("\u{1F600}".repeat(200)).length, 200);
});

test("prompt/agent hooks require explicit injected resolvers and normalize model verdicts", async () => {
  const pending = await runHooks({ PreToolUse: [{ type: "prompt", prompt: "check" }] }, "PreToolUse", preTool());
  assert.equal(pending.blocked, true);
  assert.equal(pending.pendingHooks?.[0]?.type, "prompt");
  // A block that did not come from the hook's own verdict omits the prompt.
  const pendingSubmit = await runHooks({ UserPromptSubmit: [{ type: "prompt", prompt: "check" }] }, "UserPromptSubmit", {});
  assert.equal(pendingSubmit.blocked, true);
  assert.equal(pendingSubmit.suppressOriginalPrompt, true);
  const result = await runHooks({ Stop: [{ type: "agent", prompt: "verify", model: "fixture-model" }] }, "Stop", { marker: "retained" }, signal(), {
    resolveModelHook: async (definition, event, payload, hookSignal) => {
      assert.equal(definition.type, "agent");
      assert.equal(event, "Stop");
      assert.equal(payload.marker, "retained");
      assert.equal(hookSignal.aborted, false);
      return { ok: false, reason: "needs work" };
    },
  });
  assert.equal(result.blocked, true);
  assert.equal(result.reason, "needs work");
  assert.equal(result.stopRequested, undefined);
  const good = await runHooks({ TaskCompleted: [{ type: "prompt", prompt: "check" }] }, "TaskCompleted", {}, signal(), { resolveModelHook: async () => ({ ok: true, additionalContext: "checked" }) });
  assert.equal(good.blocked, false);
  assert.deepEqual(good.additionalContext, ["checked"]);
});

test("model hook timeout and malformed output remain explicit and bounded", async () => {
  let cancelled = false;
  const timeout = await runHooks({ PreToolUse: [{ type: "prompt", prompt: "check", timeout: 0.03 }] }, "PreToolUse", preTool(), signal(), { resolveModelHook: async (_definition, _event, _payload, hookSignal) => new Promise(resolve => { hookSignal.addEventListener("abort", () => { cancelled = true; resolve({ ok: true }); }); }) });
  assert.equal(cancelled, true);
  assert.ok(timeout.additionalContext.some(text => text.includes("timed out")));
  const malformed = await runHooks({ PreToolUse: [{ type: "agent", prompt: "check" }] }, "PreToolUse", preTool(), signal(), { resolveModelHook: async () => "bad JSON" });
  assert.ok(malformed.additionalContext.some(text => text.includes("malformed JSON")));
});

test("command output caps discard a truncated JSON verdict and report truncation", async () => {
  const command = `printf '%s' '{"continue":false}'; awk 'BEGIN { for (i = 0; i < 70000; i++) printf " " }'`;
  const result = await runHooks({ PreToolUse: [{ command }] }, "PreToolUse", preTool());
  assert.equal(result.blocked, false);
  assert.equal(result.stopRequested, undefined);
  assert.ok(result.additionalContext.some(text => text.includes("output truncated")));
});

test("oversized hook input prevents every transport from starting", async () => {
  let called = false;
  const result = await runHooks({ PreToolUse: [{ type: "prompt", prompt: "check" }] }, "PreToolUse", { prompt: "x".repeat(1024 * 1024) }, signal(), { resolveModelHook: async () => { called = true; return { ok: true }; } });
  assert.equal(called, false);
  assert.equal(result.blocked, true);
  assert.ok(result.additionalContext.some(text => text.includes("input exceeded")));
});

test("PermissionRequest interrupt is adopted only with the denying decision", async () => {
  const denied = await runHooks({ PermissionRequest: [emit({ hookSpecificOutput: { hookEventName: "PermissionRequest",
    decision: { behavior: "deny", message: "stop", interrupt: true } } })] }, "PermissionRequest", {});
  assert.equal(denied.blocked, true);
  assert.equal(denied.reason, "stop");
  assert.equal(denied.interrupt, true);
  // The source returns at the first non-allow result (`n2e`), so a later deny
  // cannot add an interrupt to the decision that was already adopted.
  const later = await runHooks({ PermissionRequest: [
    emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "first" } } }),
    emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "second", interrupt: true } } }),
  ] }, "PermissionRequest", {});
  assert.equal(later.reason, "first");
  assert.equal("interrupt" in later, false);
  const allowed = await runHooks({ PermissionRequest: [emit({ hookSpecificOutput: { hookEventName: "PermissionRequest",
    decision: { behavior: "allow", interrupt: true } } })] }, "PermissionRequest", {});
  assert.equal("interrupt" in allowed, false);
});

test("permission denial survives a later allowing hook and new lifecycle gate exit statuses work", async () => {
  const result = await runHooks({ PermissionRequest: [
    emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny", message: "first block" } } }),
    emit({ hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } }),
  ] }, "PermissionRequest", {});
  assert.equal(result.permissionDecision, "deny");
  assert.equal(result.reason, "first block");
  assert.equal(result.blocked, true);
  for (const event of ["SubagentStop", "TaskCompleted", "TeammateIdle", "WorktreeCreate", "UserPromptExpansion"] as const) {
    const gated = await runHooks({ [event]: [{ command: "exit 2" }] }, event, {});
    assert.equal(gated.blocked, true, event);
  }
  const display = await runHooks({ Notification: [{ command: "exit 2" }] }, "Notification", {});
  assert.equal(display.blocked, false);
});

test("script hooks are refused without executing their command", async () => {
  const marker = path.join(tmpDir(), "script-ran");
  const command = `printf ran > ${JSON.stringify(marker)}`;
  const blocked = await runHooks({ PreToolUse: [{ type: "script", command }] }, "PreToolUse", {}, signal());
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, "script hooks are not available in this build");
  assert.ok(blocked.additionalContext.some(text => text.includes("script hooks are not available in this build")));
  const passive = await runHooks({ PostToolUse: [{ type: "script", command }] }, "PostToolUse", {}, signal());
  assert.equal(passive.blocked, false);
  assert.ok(passive.additionalContext.some(text => text.includes("script hooks are not available in this build")));
  assert.equal(fs.existsSync(marker), false);
});

test("async command hooks explicitly require an owned registry and return registered task ids", async () => {
  const dir = tmpDir();
  const marker = path.join(dir, "async-marker");
  const definition: HookDefinition = { command: `printf x > '${marker}'`, async: true };
  const pending = await runHooks({ PreToolUse: [definition] }, "PreToolUse", preTool({ cwd: dir }));
  assert.equal(pending.pendingHooks?.[0]?.type, "command");
  assert.equal(fs.existsSync(marker), false);
  const result = await runHooks({ SessionStart: [definition] }, "SessionStart", { cwd: dir }, signal(), { startAsyncCommand: async request => {
    assert.equal(request.definition.command, definition.command);
    assert.equal(JSON.parse(request.input).hook_event_name, "SessionStart");
    assert.equal(request.cwd, dir);
    assert.equal(request.timeoutMs, 60_000);
    return "owned-hook-task";
  } });
  assert.deepEqual(result.backgroundTasks, ["owned-hook-task"]);
  assert.equal(fs.existsSync(marker), false);
});

test("asyncRewake implies the async owner and command results stay observable", async () => {
  const dir = tmpDir();
  const definition: HookDefinition = { command: "true", asyncRewake: true };
  const pending = await runHooks({ PostToolUse: [definition] }, "PostToolUse", { cwd: dir });
  assert.equal(pending.pendingHooks?.[0]?.type, "command");
  const registered = await runHooks({ PostToolUse: [definition] }, "PostToolUse", { cwd: dir }, signal(), {
    startAsyncCommand: async request => {
      assert.equal((request.definition as { asyncRewake?: boolean }).asyncRewake, true);
      return "rewake-task";
    },
  });
  assert.deepEqual(registered.backgroundTasks, ["rewake-task"]);
  let seen: CommandHookExecution | undefined;
  const result = await runHooks({ PostToolUse: [{ command: "printf out; printf err >&2; exit 2" }] }, "PostToolUse",
    { cwd: dir }, signal(), { onCommandResult: execution => { seen = execution; } });
  assert.equal(seen?.code, 2);
  assert.equal(seen?.stdout, "out");
  assert.equal(seen?.stderr, "err");
  assert.equal(result.blocked, false);
});
