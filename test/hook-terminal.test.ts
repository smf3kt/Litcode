import assert from "node:assert/strict";
import { test } from "node:test";
import { validateHookTerminalSequence, formatHookTerminalSequence } from "../src/hook-terminal.js";
import { runHooks, type HookDefinition } from "../src/hooks.js";

const ESC = "\x1b";
const BEL = "\x07";
const osc = (code: number | string, payload = "", ending = BEL) => `${ESC}]${code};${payload}${ending}`;
const normalizedOsc = (code: number, payload = "") => osc(code, payload, `${ESC}\\`);

test("terminalSequence validates complete bounded OSC/BEL fields and normalizes payloads", () => {
  for (const code of [0, 1, 2, 9, 99, 777]) {
    for (const ending of [BEL, `${ESC}\\`]) assert.equal(validateHookTerminalSequence(osc(code, "title", ending)), normalizedOsc(code, "title"));
  }
  assert.equal(validateHookTerminalSequence(`${BEL}${osc("0002", "hello\0\n\t\x7f\x80\x9f")}${BEL}`), `${BEL}${normalizedOsc(2, "hello")}${BEL}`);
  assert.equal(validateHookTerminalSequence(`${ESC}]2${BEL}`), normalizedOsc(2));
  for (const progress of ["4;0", "4;1;", "4;2;0", "4;3;99", "4;4;100", "4;1;01"]) {
    assert.equal(validateHookTerminalSequence(osc(9, progress)), normalizedOsc(9, progress));
  }
  for (const payload of ["0", "4;5;1", "4;1;101", "4;1;001", " +7;launch", "᠎​-8", "​+١", "\t\x80+9"]) {
    assert.equal(validateHookTerminalSequence(osc(9, payload)), undefined, JSON.stringify(payload));
  }
  for (const value of [undefined, null, 9, [], {}, "", "text", `${BEL}text`, `${ESC}[31m`, osc(52, "clipboard"), `${ESC}]2;x`, `${ESC}]2;x${ESC}bad${BEL}`, osc("+2"), osc("2x"), `${osc(2, "valid")}${osc(52, "invalid")}`]) {
    assert.equal(validateHookTerminalSequence(value), undefined, JSON.stringify(value));
  }
  const exact = normalizedOsc(2, "x".repeat(4090));
  assert.equal(Buffer.byteLength(exact), 4096);
  assert.equal(validateHookTerminalSequence(exact), exact);
  assert.equal(validateHookTerminalSequence(osc(2, "x".repeat(4091))), undefined, "BEL to ST expansion counts against the normalized cap");
  assert.equal(validateHookTerminalSequence(BEL.repeat(4096)), BEL.repeat(4096));
  assert.equal(validateHookTerminalSequence(BEL.repeat(4097)), undefined);
  assert.equal(validateHookTerminalSequence(osc(2, "中".repeat(1363))), normalizedOsc(2, "中".repeat(1363)));
  assert.equal(validateHookTerminalSequence(osc(2, "中".repeat(1364))), undefined);
  const sequence = normalizedOsc(2, "title"), escaped = sequence.replaceAll(ESC, ESC + ESC);
  assert.equal(formatHookTerminalSequence(sequence, {}), sequence);
  assert.equal(formatHookTerminalSequence(sequence, { TMUX: "fixture", STY: "fixture" }), `${ESC}Ptmux;${escaped}${ESC}\\`);
  assert.equal(formatHookTerminalSequence(sequence, { STY: "fixture" }), `${ESC}P${escaped}${ESC}\\`);
  assert.equal(formatHookTerminalSequence(osc(52), { TMUX: "fixture" }), undefined);
});

test("hook output preserves sequence order, PreCompact/suppression effects and aggregate bounds", async () => {
  const quote = String.fromCharCode(39);
  const command = (json: unknown): HookDefinition => ({ command: `printf "%s" ${quote}${JSON.stringify(json)}${quote}` });
  const first = osc(2, "first");
  const second = `${BEL}${osc(777, "notify;second")}`;
  const result = await runHooks({ SessionStart: [{ hooks: [command({ terminalSequence: first, suppressOutput: true }), command({ terminalSequence: osc(52) }), command({ terminalSequence: second })] }] }, "SessionStart");
  assert.deepEqual(result.terminalSequences, [normalizedOsc(2, "first"), `${BEL}${normalizedOsc(777, "notify;second")}`]);
  assert.equal(result.suppressOutput, true);
  assert.equal(result.blocked, false);
  const invalid = await runHooks({ SessionStart: [command({ terminalSequence: osc(52) }), command({ terminalSequence: 1 })] }, "SessionStart");
  assert.equal(Object.hasOwn(invalid, "terminalSequences"), false);
  const compactJson = { terminalSequence: first, continue: false, suppressOutput: true };
  const compact = await runHooks({ PreCompact: [command(compactJson)] }, "PreCompact");
  assert.deepEqual(compact.terminalSequences, [normalizedOsc(2, "first")]);
  assert.deepEqual(compact.additionalContext, [JSON.stringify(compactJson)]);
  assert.equal(compact.blocked, false);
  assert.equal(compact.stopRequested, undefined);
  const callbacks: HookDefinition[] = Array.from({ length: 130 }, (_, index) => ({ type: "callback", name: String(index) }));
  const count = await runHooks({ Stop: callbacks }, "Stop", {}, undefined, { resolveCallbackHook: async () => ({ terminalSequence: BEL, suppressOutput: true }) });
  assert.equal(count.terminalSequences?.length, 128);
  assert.equal(count.systemMessages?.length, 1);
  assert.match(count.systemMessages![0]!, /aggregate exceeded/);
  assert.equal(count.blocked, false, "terminal diagnostics do not request Stop continuation");
  const full = normalizedOsc(2, "x".repeat(4090));
  const bytes = await runHooks({ SessionStart: callbacks.slice(0, 10) }, "SessionStart", {}, undefined, { resolveCallbackHook: async () => ({ terminalSequence: full }) });
  assert.equal(bytes.terminalSequences?.length, 8);
  assert.equal(bytes.terminalSequences?.reduce((sum, value) => sum + Buffer.byteLength(value), 0), 32768);
  assert.equal(bytes.systemMessages?.length, 1);
});
