import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { register } from "tsx/esm/api";

// Exercise the package source boundary with real registries and an offline provider.
const unregister = register();
const { defaultConfig } = await import("../src/agent.ts");
const { AgentRegistry } = await import("../src/agent-registry.ts");
const { WorkflowRegistry, createWorkflowTools } = await import("../src/workflow.ts");
const { createTools } = await import("../src/tools.ts");
const { fingerprint } = await import("../src/session.ts");
const workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "workflow-resume-smoke-")));
const owner = randomUUID(); const tools = createTools(); const config = defaultConfig(workspace, tools);
config.model = "scripted/workflow";
const requests = []; let fail = true;
const provider = { count: async () => 0, complete: async request => {
  const prompt = String(request.messages.at(-1)?.content); requests.push(prompt);
  if (fail && prompt.startsWith("retry task")) throw new Error("scripted first-run failure");
  return { id: "smoke", model: config.model, type: "message", role: "assistant", content: [{ type: "text", text: "durable task output" }],
    stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } };
} };
let agents, workflows;
const open = () => {
  agents = new AgentRegistry({ source: config, tools, provider });
  workflows = new WorkflowRegistry({ agents, workspace, owner, settingsDigest: fingerprint(config) });
};
const input = { tasks: [{ id: "success", prompt: "completed task" }, { id: "retry", prompt: "retry task", depends_on: ["success"] }], max_parallel: 1 };
const context = { workspace, signal: new AbortController().signal, allowShell: false, maxOutputBytes: 24_000 };
try {
  open();
  const original = JSON.parse(await createWorkflowTools(workflows, { persistent: true })[0].execute(input, context));
  assert.equal(original.status, "failed"); assert.deepEqual(original.tasks.map(task => task.status), ["completed", "failed"]);
  await workflows.close(); await agents.close(); fail = false; open();
  const restored = JSON.parse(await createWorkflowTools(workflows)[1].execute({ id: original.id }, context));
  assert.equal(restored.tasks[0].summary, "durable task output");
  const resumed = JSON.parse(await createWorkflowTools(workflows, { persistent: true })[0].execute({ ...input, resume_from: original.id }, context));
  assert.equal(resumed.status, "completed"); assert.notEqual(resumed.id, original.id);
  assert.deepEqual(resumed.reused_tasks, ["success"]); assert.equal(resumed.tasks[0].session_id, original.tasks[0].session_id);
  assert.equal(requests.filter(prompt => prompt === "completed task").length, 1);
  assert.equal(requests.length, 3); assert.equal(agents.list().length, 1);
  await workflows.close(); await agents.close();
  assert.equal(fs.existsSync(path.join(workspace, ".agent", "workflows", owner, "owner.lock")), false);
  console.log(JSON.stringify({ workflowResume: "passed", registryReopen: true, completedTaskCalls: 1, totalCalls: requests.length,
    provenance: true, ownedChildrenOnly: true, lockCleanup: true, provider: "offline scripted ModelProvider" }));
} finally {
  await workflows?.close(); await agents?.close(); fs.rmSync(workspace, { recursive: true, force: true });
  await unregister();
}
