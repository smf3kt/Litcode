import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { register } from "tsx/esm/api";

const unregister = register();
const { defaultConfig } = await import("../src/agent.ts");
const { createRuntime, pinToolSchemas } = await import("../src/runtime.ts");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "child-callback-smoke-")));
const callbacks = [], requests = [];
let runtime;
const provider = { count: async () => 1, complete: async request => {
  requests.push(request);
  return { id: "fixture", model: request.model, type: "message", role: "assistant", content: [{ type: "text", text: "child complete", citations: null }],
    stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } };
} };
try {
  const config = defaultConfig(workspace, []); config.model = "fixture/child";
  config.features = { tasks: false, subagents: true, agentMessaging: true };
  config.hooks = { SessionStart: [{ type: "callback", name: "owned", once: true }] };
  runtime = await createRuntime(config, provider, new AbortController().signal, { hookCallbacks: () => ({
    owned: async (_definition, event, payload) => { callbacks.push({ event, id: payload.session_id }); return { additionalContext: "OWNED_CHILD_CALLBACK" }; },
  }) });
  const tools = runtime.buildTools(config, "parent"); config.tools = pinToolSchemas(tools);
  const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24000 };
  const launched = JSON.parse(await tools.find(tool => tool.schema.name === "agent").execute({ prompt: "child task", mode: "general", background: false }, context));
  await tools.find(tool => tool.schema.name === "send_message").execute({ id: launched.id, message: "continue child" }, context);
  await tools.find(tool => tool.schema.name === "get_agent").execute({ id: launched.id, wait_ms: 1000 }, context);
  const skill = { name: "owned", description: "fixture", path: "/fixture/SKILL.md", body: "skill task", userInvocable: true, disableModelInvocation: false, context: "fork" };
  const foreground = JSON.parse(await runtime.runSkill(config, "parent", skill, "", context.signal));
  const background = JSON.parse(await runtime.runSkill(config, "parent", { ...skill, background: true }, "", context.signal));
  await tools.find(tool => tool.schema.name === "get_agent").execute({ id: background.id, wait_ms: 1000 }, context);
  await runtime.close(); runtime = undefined;
  assert.equal(callbacks.length, 3); assert.equal(new Set(callbacks.map(item => item.id)).size, 3);
  assert.equal(requests.length, 4);
  for (const item of callbacks) {
    const records = fs.readFileSync(path.join(workspace, ".agent", `${item.id}.jsonl`), "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(records.filter(record => record.kind === "hook_once").length, 1);
    assert.ok(records.some(record => record.kind === "hook_result" && record.additionalContext.includes("OWNED_CHILD_CALLBACK")));
  }
  assert.ok(callbacks.some(item => item.id === foreground.session_id));
  assert.equal(fs.readdirSync(path.join(workspace, ".agent")).some(name => name.endsWith(".lock")), false);
  console.log(JSON.stringify({ boundary: "passed", child: true, mailboxContinuationOnce: true, foregroundSkill: true, backgroundSkill: true,
    independentLifecycles: true, ownedProviderCalls: requests.length, locksReleased: true }));
} finally { await runtime?.close(); fs.rmSync(workspace, { recursive: true, force: true }); unregister(); }
