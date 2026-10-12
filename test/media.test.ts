import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, type TestContext } from "node:test";

import type { Anthropic } from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";

import { createMediaTools, IMAGE_MAX_BASE64_BYTES, IMAGE_MAX_HEIGHT, IMAGE_MAX_WIDTH, IMAGE_TARGET_RAW_BYTES,
  MEDIA_MAX_BYTES, parseMediaPages, readMedia, type MediaContext } from "../src/media.js";
import type { ToolContext } from "../src/tools.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
// JPEG fixture includes a legal one-component SOF header and marker framing.
const JPEG = Buffer.from([255,216,255,192,0,11,8,0,2,0,3,1,1,17,0,255,217]);
const WEBP = Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA", "base64");

function fixture(t: TestContext) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-media-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const context: MediaContext = { workspace, signal: new AbortController().signal };
  return { workspace, context, write(name: string, bytes: Uint8Array | string) { fs.writeFileSync(path.join(workspace, name), bytes); return name; } };
}
async function pdf(pages: number): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i++) document.addPage([100 + i, 200 + i]);
  return document.save();
}
function base64Block(result: Awaited<ReturnType<typeof readMedia>>): string {
  const block = result.blocks[0]!;
  assert.ok(block.type === "image" || block.type === "document");
  assert.equal(block.source.type, "base64");
  if (block.source.type !== "base64") assert.fail("base64 source required");
  return block.source.data;
}

test("PNG, JPEG, GIF and WebP header metadata and original base64 bytes", async (t) => {
  const f = fixture(t);
  for (const [name, bytes, mime, dimensions] of [
    ["one.png", PNG, "image/png", [1, 1]],
    ["one.jpeg", JPEG, "image/jpeg", [3, 2]],
    ["one.gif", GIF, "image/gif", [1, 1]],
    ["one.webp", WEBP, "image/webp", [1, 1]],
  ] as const) {
    const result = await readMedia(f.write(name, bytes), f.context);
    assert.equal(result.metadata.mediaType, mime);
    assert.deepEqual([result.metadata.width, result.metadata.height], dimensions);
    assert.equal(result.metadata.bytes, bytes.length);
    assert.deepEqual(Buffer.from(base64Block(result), "base64"), bytes);
    assert.equal(result.blocks[1]!.type, "text");
    assert.match(result.summary, /Image/);
  }
});

test("SDK-native media blocks fit tool results, user messages and token-count requests", async (t) => {
  const f = fixture(t);
  f.write("one.png", PNG);
  const result = await readMedia("one.png", f.context);
  const toolResult: Anthropic.ToolResultBlockParam = { type: "tool_result", tool_use_id: "tool-1", content: result.blocks };
  const request: Anthropic.MessageCountTokensParams = { model: "test-model", messages: [{ role: "user", content: [toolResult] }] };
  const wire = JSON.parse(JSON.stringify(request));
  assert.equal(wire.messages[0].content[0].content[0].source.media_type, "image/png");
  assert.equal(wire.messages[0].content[0].content[0].source.data, PNG.toString("base64"));
  const tool = createMediaTools()[0]!;
  const context: ToolContext = { ...f.context, allowShell: false, maxOutputBytes: 100000 };
  assert.equal(tool.schema.name, "read_media");
  assert.equal(tool.readOnly, true);
  assert.equal(await tool.execute({ path: "one.png" }, context), result.summary);
  assert.deepEqual(await tool.executeBlocks!({ path: "one.png" }, context), result.blocks);
  await assert.rejects(tool.execute({ path: "one.png", extra: true }, context));
});

test("PDF at most 10 pages preserves bytes and uses document base64 SDK shape", async (t) => {
  const f = fixture(t);
  const original = await pdf(3);
  const result = await readMedia(f.write("small.pdf", original), f.context);
  assert.equal(result.metadata.pageCount, 3);
  assert.deepEqual(result.metadata.selectedPages, [1, 2, 3]);
  assert.deepEqual(Buffer.from(base64Block(result), "base64"), Buffer.from(original));
  const block = result.blocks[0]!;
  assert.equal(block.type, "document");
  if (block.type !== "document") assert.fail();
  assert.equal(block.source.type, "base64");
  if (block.source.type !== "base64") assert.fail();
  assert.equal(block.source.media_type, "application/pdf");
  const params: Anthropic.MessageCountTokensParams = { model: "test-model", messages: [{ role: "user", content: result.blocks }] };
  assert.equal(JSON.parse(JSON.stringify(params)).messages[0].content[0].type, "document");
});

test("PDF explicit selection preserves requested ordering and enforces page limits", async (t) => {
  const f = fixture(t);
  const source = await pdf(25);
  f.write("large.pdf", source);
  await assert.rejects(readMedia("large.pdf", f.context), /over 10 pages/);
  const result = await readMedia("large.pdf", f.context, { pages: "5,2-3,25" });
  assert.deepEqual(result.metadata.selectedPages, [5, 2, 3, 25]);
  assert.equal(result.metadata.pageCount, 25);
  const selected = await PDFDocument.load(Buffer.from(base64Block(result), "base64"));
  assert.equal(selected.getPageCount(), 4);
  assert.deepEqual(selected.getPages().map((page) => page.getWidth()), [104, 101, 102, 124]);
  assert.equal((await readMedia("large.pdf", f.context, { pages: "1-20" })).metadata.selectedPages!.length, 20);
  for (const pages of ["", "0", "2-1", "1-21", "26", "1,1", "1-3,3", "-1", "1-", "1,,2", "1.5", "all", "99999999999999999999"]) {
    await assert.rejects(readMedia("large.pdf", f.context, { pages }), /page|selection|range/i, pages);
  }
  assert.deepEqual(parseMediaPages(" 1 - 3 , 5 ", 8), [1, 2, 3, 5]);
});

test("corrupt headers, mismatched media type, unsupported types and malformed PDF fail", async (t) => {
  const f = fixture(t);
  for (const [name, bytes] of [
    ["wrong.jpg", PNG], ["wrong.png", GIF], ["empty.png", Buffer.alloc(0)],
    ["short.png", PNG.subarray(0, 20)], ["short.gif", GIF.subarray(0, 8)],
    ["short.jpg", Buffer.from([255,216,255,192,255,255])],
    ["short.webp", WEBP.subarray(0, 20)], ["text.svg", "<svg/>"],
    ["invalid.pdf", "%PDF-1.7\nnot a pdf\n%%EOF"], ["missing.pdf", "random"],
  ] as const) {
    f.write(name, bytes);
    await assert.rejects(readMedia(name, f.context), /invalid|unsupported|supported|truncated|differs/i, name);
  }
  const zero = Buffer.from(PNG);
  zero.writeUInt32BE(0, 16);
  f.write("zero.png", zero);
  await assert.rejects(readMedia("zero.png", f.context), /dimensions/);
  f.write("image.png", PNG);
  await assert.rejects(readMedia("image.png", f.context, { pages: "1" }), /PDF/);
  f.write("zero.pdf", await pdf(0));
  // pdf-lib inserts a default blank page when saving an empty document.
  assert.equal((await readMedia("zero.pdf", f.context)).metadata.pageCount, 1);
});

test("media byte caps bound intake and the API base64 image limit is measured before encoding", async (t) => {
  const f = fixture(t);
  // The 2000x2000 downscale target and the 5 MiB base64 cap share one raw budget: 3932160 bytes.
  const boundary = Buffer.alloc(IMAGE_TARGET_RAW_BYTES);
  PNG.copy(boundary);
  f.write("boundary.png", boundary);
  const accepted = await readMedia("boundary.png", f.context);
  assert.equal(accepted.metadata.bytes, IMAGE_TARGET_RAW_BYTES);
  assert.equal(accepted.metadata.base64Bytes, IMAGE_MAX_BASE64_BYTES);
  assert.equal(accepted.metadata.exceedsDownscaleTarget, false);
  assert.doesNotMatch(accepted.summary, /downscale target/);
  const overImage = Buffer.alloc(IMAGE_TARGET_RAW_BYTES + 1);
  PNG.copy(overImage);
  f.write("over.png", overImage);
  await assert.rejects(readMedia("over.png", f.context), /base64 API limit/);
  const oversized = Buffer.alloc(MEDIA_MAX_BYTES + 1);
  f.write("large.png", oversized);
  await assert.rejects(readMedia("large.png", f.context), /byte limit/);
  f.write("large.pdf", oversized);
  await assert.rejects(readMedia("large.pdf", f.context), /byte limit/);
});

test("images over the downscale target are accepted and reported as not downscaled", async (t) => {
  const f = fixture(t);
  const header = Buffer.alloc(33);
  PNG.copy(header, 0, 0, 24);
  header.writeUInt32BE(IMAGE_MAX_WIDTH + 1, 16);
  header.writeUInt32BE(IMAGE_MAX_HEIGHT - 1, 20);
  f.write("wide.png", header);
  const wide = await readMedia("wide.png", f.context);
  assert.deepEqual([wide.metadata.width, wide.metadata.height], [IMAGE_MAX_WIDTH + 1, IMAGE_MAX_HEIGHT - 1]);
  assert.equal(wide.metadata.exceedsDownscaleTarget, true);
  assert.match(wide.summary, new RegExp(`${IMAGE_MAX_WIDTH}x${IMAGE_MAX_HEIGHT} downscale target this runtime cannot apply`));
  assert.deepEqual(Buffer.from(base64Block(wide), "base64"), header);
  header.writeUInt32BE(IMAGE_MAX_WIDTH, 16);
  header.writeUInt32BE(IMAGE_MAX_HEIGHT, 20);
  f.write("exact.png", header);
  assert.equal((await readMedia("exact.png", f.context)).metadata.exceedsDownscaleTarget, false);
});

test("relative path confinement rejects escapes, reserved aliases and nonfiles", async (t) => {
  const f = fixture(t);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "ccrev-media-out-"));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, "image.png"), PNG);
  f.write("image.png", PNG);
  fs.mkdirSync(path.join(f.workspace, ".agent"));
  fs.writeFileSync(path.join(f.workspace, ".agent", "image.png"), PNG);
  fs.symlinkSync(external, path.join(f.workspace, "escape"));
  fs.symlinkSync(path.join(f.workspace, ".agent"), path.join(f.workspace, "alias"));
  fs.symlinkSync(path.join(f.workspace, "image.png"), path.join(f.workspace, "local.png"));
  fs.mkdirSync(path.join(f.workspace, "directory.png"));
  for (const name of [path.join(f.workspace, "image.png"), "../image.png", ".agent/image.png", "alias/image.png", "escape/image.png", "directory.png", "missing.png", ".agent/../image.png"]) {
    await assert.rejects(readMedia(name, f.context), name);
  }
  assert.deepEqual(Buffer.from(base64Block(await readMedia("local.png", f.context)), "base64"), PNG);
});

test("pre-aborted reads fail before path access and release no child or timer resources", async (t) => {
  const f = fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(readMedia("missing.png", { ...f.context, signal: controller.signal }), { name: "AbortError" });
  const mid = new AbortController();
  f.write("image.png", PNG);
  const pending = readMedia("image.png", { ...f.context, signal: mid.signal });
  mid.abort();
  await assert.rejects(pending, { name: "AbortError" });
});
