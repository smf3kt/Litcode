import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

import { TuiTerminal } from "../src/tui.js";
import type { ClipboardSpawn } from "../src/clipboard.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const output = (value: Buffer): ClipboardSpawn => (_command, _args, options) =>
  spawn(process.execPath, ["-e", `process.stdout.write(${JSON.stringify(`«data PNGf${value.toString("hex")}»\n`)})`], options);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function terminal(root: string, clipboard: ClipboardSpawn) {
  const input = new PassThrough() as PassThrough & { isTTY: boolean; isRaw: boolean; setRawMode: (raw: boolean) => void };
  input.isTTY = true; input.isRaw = false; input.setRawMode = raw => { input.isRaw = raw; };
  const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
  Object.assign(sink, { isTTY: true, columns: 90, rows: 30 });
  const tui = new TuiTerminal({ input, output: sink, workspace: root, clipboard: { platform: "darwin", spawn: clipboard } }).start();
  const key = (text: string) => input.emit("data", text);
  return { tui, key };
}

const groups = [
  { key: "first", title: "First", message: "First question?", choices: [{ label: "A", value: "A" }, { label: "B", value: "B" }], multiple: false, allowText: true },
  { key: "second", title: "Second", message: "Second question?", choices: [{ label: "C", value: "C" }, { label: "D", value: "D" }], multiple: false, allowText: true },
];

test("question image paste attaches per question, submits native images and removes the focused one", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "question-tui-")));
  for (const directory of [".harness", ".harness/attachments"]) fs.mkdirSync(path.join(root, directory), { recursive: true });
  const { tui, key } = terminal(root, output(PNG));
  try {
    const pending = tui.prompt({ title: "Questions", message: "", allowClarification: true, groups }, new AbortController().signal);
    // Focus the Other input of the first question and paste one image.
    key("\x1b[B\x1b[B");
    key("\u0016");
    await delay(250);
    // An empty Backspace removes that image again, then a second paste restores it.
    key("\x7f");
    await delay(50);
    key("\u0016");
    await delay(250);
    // Back to the first choice and take it; then answer the second question.
    key("\x1b[A\x1b[A\r");
    key("\x1b[B\x1b[B");
    key("\u0016");
    await delay(250);
    key("\x1b[A\x1b[A\r");
    // Review page: submit the whole request.
    key("\r");
    const answer = await pending;
    assert.equal(answer?.groups?.length, 2);
    assert.equal(answer.groups[0]?.images?.length, 1);
    assert.equal(answer.groups[1]?.images?.length, 1);
    assert.equal(answer.groups[0]?.images?.[0]?.content, PNG.toString("base64"));
    assert.deepEqual(answer.groups.map(group => group.selected[0]), ["A", "C"]);
    // The dialog owns the private attachments and removes them when it closes.
    const attachments = fs.readdirSync(path.join(root, ".harness", "attachments"));
    assert.deepEqual(attachments, []);
  } finally {
    tui.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("cancelling a question dialog aborts an in-flight capture and leaves no attachment", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "question-cancel-")));
  for (const directory of [".harness", ".harness/attachments"]) fs.mkdirSync(path.join(root, directory), { recursive: true });
  let started = 0;
  const slow: ClipboardSpawn = (_command, _args, options) => {
    started += 1;
    return spawn(process.execPath, ["-e", "setTimeout(() => process.stdout.write(Buffer.from('"
      + PNG.toString("base64") + "', 'base64')), 400)"], options);
  };
  const { tui, key } = terminal(root, slow);
  try {
    const controller = new AbortController();
    const pending = tui.prompt({ title: "Questions", message: "", allowClarification: true, groups }, controller.signal);
    key("\x1b[B\x1b[B");
    key("\u0016");
    await delay(50);
    controller.abort();
    assert.equal(await pending, undefined);
    await delay(500);
    assert.equal(started, 1);
    assert.deepEqual(fs.readdirSync(path.join(root, ".harness", "attachments")), []);
  } finally {
    tui.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
