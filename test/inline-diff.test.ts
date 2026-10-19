// The inline diff dialog without a terminal: the recovery of its list, the mount/dismiss/reopen
// cycle (the renderer must stay usable after an unmount), and the detail view's scroll box.
//
// The workspace is a real temporary git repository, so `open()` reads the same repository state the
// line-mode command reads. The dialog is built on the recovered element tree; no terminal is
// involved and nothing is drawn.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

import { InlineDiffDialog } from "../src/inline-diff.js";
import { Session, type SessionConfig } from "../src/session.js";
import { bindSettingsStore } from "../src/plugin-chain-settings-store.js";
import { bindWheelSettingsHost } from "../src/plugin-chain-wheel-glue-host.js";

const tempDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-inline-diff-")));
  tempDirs.push(dir);
  return dir;
}
after(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function config(workspace: string): SessionConfig {
  return { model: "test-model", system: "test-system", tools: [], workspace, allowShell: false,
    maxOutputBytes: 64_000, maxTokens: 1_024, contextTokens: 100_000, compactAt: 50_000,
    maxTurns: 30, thinking: false };
}

function git(workspace: string, args: string[]): void {
  execFileSync("git", args, { cwd: workspace });
}

const strip = (row: string): string => row.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");

function text(rows: string[]): string[] {
  return rows.map((row) => strip(row).trim()).filter(Boolean);
}

/** One update row for `file`, so the dialog's turn walk has a file to show. */
function updateRow(file: string, oldLines: number, lines: string[]) {
  return {
    kind: "tool_result" as const,
    result: { type: "tool_result" as const, tool_use_id: "t1", content: "ok" },
    host: { type: "update" as const, filePath: file,
      structuredPatch: [{ oldStart: 1, oldLines, newStart: 1, newLines: lines.length, lines }] },
  };
}

test("the dialog reopens after a dismissal", async () => {
  const ws = tmpDir();
  git(ws, ["init", "-q"]);
  git(ws, ["config", "user.email", "a@b.c"]);
  git(ws, ["config", "user.name", "a"]);
  fs.writeFileSync(path.join(ws, "sample.txt"), "one\ntwo\nthree\n");
  git(ws, ["add", "."]);
  git(ws, ["commit", "-qm", "base"]);
  fs.writeFileSync(path.join(ws, "sample.txt"), "one\nTWO\nthree\n");

  const session = Session.open(ws, { config: config(ws) });
  session.append({ kind: "message", message: { role: "user", content: "edit sample" } });
  session.append(updateRow("sample.txt", 3, [" one", "-two", "+TWO", " three"]));
  const dialog = new InlineDiffDialog(session, () => {});
  try {
    for (const attempt of [1, 2, 3]) {
      assert.equal(await dialog.open(), "", `open #${attempt} reports no message`);
      const rows = text(dialog.rowsFor(100, 30));
      assert.ok(rows.some((row) => row.includes("Uncommitted changes")), `open #${attempt} draws its title`);
      assert.ok(rows.some((row) => row.includes("sample.txt")), `open #${attempt} lists the file`);
      dialog.handleAction("diff:dismiss");
      assert.equal(dialog.visible, false, `dismiss #${attempt} hides the dialog`);
    }
  } finally {
    dialog.close();
    await session.close();
  }
});

test("the detail view scrolls through a hunk longer than the screen", async () => {
  const ws = tmpDir();
  git(ws, ["init", "-q"]);
  git(ws, ["config", "user.email", "a@b.c"]);
  git(ws, ["config", "user.name", "a"]);
  const body = Array.from({ length: 60 }, (_, index) => `line ${index + 1}`);
  fs.writeFileSync(path.join(ws, "big.txt"), body.join("\n") + "\n");
  git(ws, ["add", "."]);
  git(ws, ["commit", "-qm", "base"]);
  fs.writeFileSync(path.join(ws, "big.txt"),
    body.map((line, index) => (index >= 5 && index < 45 ? `${line} changed` : line)).join("\n") + "\n");

  const session = Session.open(ws, { config: config(ws) });
  session.append({ kind: "message", message: { role: "user", content: "edit big" } });
  session.append(updateRow("big.txt", 40, Array.from({ length: 40 }, (_, index) => `-line ${index + 6}`)
    .concat(Array.from({ length: 40 }, (_, index) => `+line ${index + 6} changed`))));
  const dialog = new InlineDiffDialog(session, () => {});
  // The scroll edge reads the wheel setting; a product host normally binds it.
  bindSettingsStore({ all: () => ({}), one: () => ({}) });
  bindWheelSettingsHost({ sourceOrder: () => [], projectSharesUserSettings: () => false,
    legacyConfig: () => ({}), legacyDefaults: () => ({}), parseLegacySetting: () => undefined });
  try {
    assert.equal(await dialog.open(), "");
    dialog.rowsFor(100, 30);
    // The untracked session file sorts first; step to the changed file before opening the detail.
    dialog.handleAction("diff:nextFile");
    dialog.rowsFor(100, 30);
    assert.equal(dialog.handleAction("select:accept"), true, "the detail view opens");

    const numbered = (rows: string[]): number => {
      const row = text(rows).find((line) => /^\d+\s/.test(line));
      return row === undefined ? Number.NaN : Number(row.split(/\s+/)[0]);
    };
    const before = numbered(dialog.rowsFor(100, 30));
    assert.ok(Number.isFinite(before), "the detail view shows numbered hunk lines");

    dialog.handleAction("scroll:pageDown");
    dialog.handleAction("scroll:pageDown");
    const after = numbered(dialog.rowsFor(100, 30));
    assert.ok(after > before, `the detail view scrolled (${before} -> ${after})`);

    dialog.handleAction("scroll:top");
    assert.equal(numbered(dialog.rowsFor(100, 30)), before, "scroll:top returns to the first lines");
  } finally {
    bindWheelSettingsHost(undefined);
    bindSettingsStore(undefined);
    dialog.close();
    await session.close();
  }
});
