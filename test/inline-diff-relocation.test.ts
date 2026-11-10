// Relocated-session diff denial: the dialog's read-permission callback must use
// the diff project workspace, not the retained parent rule workspace.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";

import { Agent, defaultConfig } from "../src/agent.js";
import { InlineDiffDialog } from "../src/inline-diff.js";
import type { ModelProvider } from "../src/provider.js";
import { Session } from "../src/session.js";
import { relocateSession } from "../src/workspace-session.js";

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-inline-diff-relocation-")));
  tempDirs.push(dir);
  return dir;
}
after(() => { for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true }); });

test("the inline diff denial callback keeps a relocated rule root bound to the project workspace", async () => {
  const parent = tmpDir(), child = tmpDir();
  fs.mkdirSync(path.join(child, "protected"));
  fs.writeFileSync(path.join(child, "protected", "data.txt"), "PROTECTED_FIXTURE");
  fs.symlinkSync("protected/data.txt", path.join(child, "alias.txt"));
  const source = Session.open(parent, { config: { ...defaultConfig(parent, []), model: "fixture",
    permissions: { mode: "default", allow: [], deny: ["Read(protected/data.txt)"], ruleWorkspace: parent },
    features: { tasks: false, subagents: false, sourcePlanTools: true } } });
  const provider: ModelProvider = { count: async () => 1, complete: async () => ({ id: "fixture", model: "fixture",
    type: "message", role: "assistant", content: [{ type: "text", text: "ok" }], stop_reason: "end_turn",
    stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } }) as Anthropic.Message };
  let relocated: Session | undefined;
  try {
    await new Agent(source, provider, []).run("hello");
    relocated = relocateSession(source, child, () => []);
    const dialog = new InlineDiffDialog(relocated, () => {});
    try {
      assert.equal((dialog as unknown as { denied(file: string): boolean }).denied("alias.txt"), true);
    } finally { dialog.close(); }
  } finally { await source.close(); if (relocated) await relocated.close(); }
});
