import assert from "node:assert/strict";
import { mkdtemp, open, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readControlledHandleLines } from "../src/controlled-handle-lines.js";
import { createTools, type ToolContext } from "../src/tools.js";
import { createControlledSourceProjection, createControlledSourceReader, createSourceReadLimits, sourceFirstReadExcerpt, sourceReadTokenEstimate, SourceFileTokenLimitError, SourceFileTooLargeError, SourceSelectedRangeTooLargeError } from "../src/controlled-read-projection-source.js";

test("first read excerpt selects whole lines or a surrogate-safe character prefix", () => {
  assert.deepEqual(sourceFirstReadExcerpt("one\ntwo\nthree\nfour", 20, 10), { content: "one", lineCount: 1, byCharacters: false });
  const prefix = sourceFirstReadExcerpt("😀".repeat(100), 100, 10);
  assert.equal(prefix.byCharacters, true);
  assert.equal(prefix.content, "😀".repeat(8));
  assert.equal(prefix.lineCount, 1);
});

test("source read budget and token gates preserve the caller's room and counting decisions", async () => {
  let calls = 0;
  const limits = createSourceReadLimits({ normalizeUsage: (usage: unknown) => usage, inputTokens: (usage: { input_tokens: number }) => usage.input_tokens, bytesPerToken: () => 4, estimate: sourceReadTokenEstimate, count: async () => { calls++; return 12; }, defaultLimits: () => ({ maxTokens: 10 }), suffixes: { unavailable: " unavailable", tooLarge: " too large", canRaise: " can raise" }, record: () => {}, classify: (value: string) => value });
  const room = limits.XIr({ contextRoom: () => ({ threshold: 100, held: () => 20, claimed: () => 5 }), model: () => "test" }, { message: { usage: { input_tokens: 30, output_tokens: 10 } } }, { maxTokens: 10, maxSizeBytes: 100 });
  assert.deepEqual(room, { roomTokens: 38, raised: { maxTokens: 38, maxSizeBytes: 456 } });
  assert.equal(await limits.Shn("abcd", "txt", 10, undefined), 1);
  assert.equal(calls, 0);
  await assert.rejects(limits.Shn("x".repeat(44), "txt", 10, undefined), SourceFileTokenLimitError);
  assert.equal(calls, 1);
  const mapped = limits.khn(new SourceFileTooLargeError(200, 100), { room: () => room, optedIn: false, readMaxSizeBytes: 100, ext: undefined });
  assert.match(mapped.message, /can raise/);
  const other = new SourceFileTooLargeError(200, 99);
  assert.equal(limits.khn(other, { room: () => room, optedIn: false, readMaxSizeBytes: 100, ext: undefined }), other);
});

test("recovered reader selects small and streaming paths for real files", async () => {
  const read = createControlledSourceReader({ _De: SourceFileTooLargeError, tVe: SourceSelectedRangeTooLargeError, G: (error: unknown) => error instanceof Error ? error : new Error(String(error)), Ye: Error });
  const dir = await mkdtemp(path.join(os.tmpdir(), "source-reader-"));
  try {
    const small = path.join(dir, "small");
    const large = path.join(dir, "large");
    await writeFile(small, "﻿a\r\né\nend");
    await writeFile(large, Buffer.concat([Buffer.from("﻿a\r\né\n"), Buffer.alloc(10485760 - 11, 120), Buffer.from("\nend")]));
    assert.equal((await read(small, 0, 2)).content, "a\né");
    await assert.rejects(read(small, 0, undefined, 3), (error: unknown) => error instanceof SourceFileTooLargeError && error.sizeInBytes === 12 && error.maxSizeBytes === 3 && error.message.includes("3 bytes"));
    const handle = await open(large, "r");
    try {
      const result = await read(large, 0, 2, undefined, undefined, { handle });
      assert.equal(result.content, "a\né");
      assert.equal(result.totalLines, 4);
      assert.equal(result.totalBytes, (await handle.stat()).size - 3);
      assert.ok((await handle.stat()).isFile());
      const truncated = await read(large, 0, 2, 3, undefined, { handle, truncateOnByteLimit: true });
      assert.equal(truncated.content, "a");
      assert.equal(truncated.truncatedByBytes, true);
      await assert.rejects(read(large, 0, 2, undefined, undefined, { handle, maxSelectedBytes: 3 }), (error: unknown) => error instanceof SourceSelectedRangeTooLargeError && error.selectedBytes === 4 && error.maxSelectedBytes === 3 && error.message.includes("3 bytes"));
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(read(large, 0, 2, undefined, controller.signal, { handle }));
    } finally { await handle.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("recovered small-file projection handles BOM, line endings and byte limits", async () => {
  class SelectedRangeTooLarge extends Error {
    constructor(readonly selectedBytes: number, readonly maxSelectedBytes: number) { super(); }
  }
  const project = createControlledSourceProjection(SelectedRangeTooLarge);
  const dir = await mkdtemp(path.join(os.tmpdir(), "source-projection-"));
  try {
    const filename = path.join(dir, "input");
    await writeFile(filename, Buffer.from("﻿a\r\né\r\nlast\r"));
    const handle = await open(filename, "r");
    try {
      const stat = await handle.stat();
      const text = (await handle.readFile()).toString("utf8");
      const all = project(text, stat.size, stat.mtimeMs, 0, undefined, undefined, undefined);
      assert.equal(all.content, "a\né\nlast");
      assert.equal(all.totalBytes, stat.size - 3);
      assert.equal(all.totalLines, 3);
      const truncated = project(text, stat.size, stat.mtimeMs, 0, 3, 3, undefined);
      assert.equal(truncated.content, "a");
      assert.equal(truncated.truncatedByBytes, true);
      assert.throws(() => project(text, stat.size, stat.mtimeMs, 0, 3, undefined, 3),
        (error: unknown) => error instanceof SelectedRangeTooLarge && error.selectedBytes === 4 && error.maxSelectedBytes === 3);
      assert.equal((await handle.stat()).size, stat.size);
    } finally { await handle.close(); }
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("controlled handle matches real read_file line windows and limits", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "controlled-lines-"));
  try {
    const tool = createTools().find((entry) => entry.schema.name === "read_file");
    assert.ok(tool);
    const cases = [
      { text: "", offset: 1, limit: 10, max: 100 },
      { text: "a\n", offset: 1, limit: 10, max: 100 },
      { text: "a\n", offset: 2, limit: 1, max: 100 },
      { text: "a\nb\nc\n", offset: 2, limit: 1, max: 100 },
      { text: "a\nb", offset: 8, limit: 2, max: 100 },
      { text: `${"x".repeat(65535)}😀\nnext\n`, offset: 1, limit: 2, max: 100000 },
      { text: `${"x".repeat(65535)}😀\nnext\n`, offset: 2, limit: 1, max: 100000 },
      { text: "abcdefghijk", offset: 1, limit: 2, max: 5 },
      { text: "ééé", offset: 1, limit: 1, max: 5 },
      { text: "aa\nbb\ncc", offset: 1, limit: 3, max: 5 },
      { text: "😀😀😀", offset: 1, limit: 2, max: 3 },
    ];
    for (const [index, item] of cases.entries()) {
      const filename = path.join(dir, `case-${index}`);
      await writeFile(filename, item.text);
      const signal = new AbortController().signal;
      const context: ToolContext = { workspace: dir, signal, allowShell: false, maxOutputBytes: item.max };
      const expected = await tool.execute({ path: `case-${index}`, offset: item.offset, limit: item.limit }, context);
      const handle = await open(filename, "r");
      try {
        assert.equal(await readControlledHandleLines(handle, item.offset, item.limit, item.max, signal), expected, `case ${index}`);
        assert.ok((await handle.stat()).isFile());
      } finally {
        await handle.close();
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("read_file records descriptor metadata and bounded visible content", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "read-record-"));
  try {
    const filename = path.join(dir, "input");
    await writeFile(filename, "abcdefghijk");
    const tool = createTools().find(entry => entry.schema.name === "read_file");
    assert.ok(tool);
    let record: unknown;
    const output = await tool.execute({ path: "input" }, { workspace: dir, signal: new AbortController().signal,
      allowShell: false, maxOutputBytes: 5, hostResult: value => { record = value; } });
    assert.deepEqual(record, { kind: "file_read", filePath: await realpath(filename), content: output,
      mtimeMs: (await stat(filename)).mtimeMs,
      offset: 1, limit: 2000, truncated: true });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("handle remains bound to opened file and stays open after early return or abort", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "controlled-lines-owner-"));
  try {
    const filename = path.join(dir, "file");
    await writeFile(filename, "first\nsecond\n");
    const handle = await open(filename, "r");
    try {
      await rename(filename, path.join(dir, "original"));
      await writeFile(filename, "replacement\n");
      assert.equal(await readControlledHandleLines(handle, 1, 1, 100, new AbortController().signal), "first");
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(readControlledHandleLines(handle, 1, 1, 100, controller.signal), { name: "AbortError" });
      assert.ok((await handle.stat()).isFile());
      const empty = path.join(dir, "empty");
      await writeFile(empty, "");
      const emptyHandle = await open(empty, "r");
      try {
        await assert.rejects(readControlledHandleLines(emptyHandle, 1, 1, 100, controller.signal), { name: "AbortError" });
      } finally {
        await emptyHandle.close();
      }
    } finally {
      await handle.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
