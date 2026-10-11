import assert from "node:assert/strict";
import { test } from "node:test";

import type { Anthropic } from "@anthropic-ai/sdk";

import { boundToolContent } from "../src/tool-output.js";

type ToolContent = Anthropic.ToolResultBlockParam['content'];

function textOf(content: ToolContent): string {
  if (typeof content === "string") return content;
  return content?.filter((block) => block.type === "text").map((block) => block.text).join("") ?? "";
}

const citation: Anthropic.TextCitationParam = {
  type: "char_location", cited_text: "source", document_index: 0,
  document_title: "fixture", start_char_index: 0, end_char_index: 6,
};

const image: Anthropic.ImageBlockParam = {
  type: "image", source: { type: "base64", media_type: "image/png", data: "a".repeat(10000) },
};
const document: Anthropic.DocumentBlockParam = {
  type: "document", source: { type: "base64", media_type: "application/pdf", data: "b".repeat(10000) },
};

test("giant multibyte text keeps a complete UTF-8 prefix with the marker inside the cap", () => {
  const original = "中🚀é".repeat(250000);
  for (const cap of [31, 32, 33, 255, 256, 257, 4096]) {
    const bounded = textOf(boundToolContent(original, cap));
    assert.ok(Buffer.byteLength(bounded, "utf8") <= cap);
    assert.equal(bounded.includes("�"), false);
    assert.match(bounded, /\[truncated\]$/);
    assert.ok(original.startsWith(bounded.replace(/\n?\[truncated\]$/, "")));
  }
});

test("oversized JSON remains parseable and honestly labels a bounded original preview", () => {
  const originals = [
    JSON.stringify({ payload: "中🚀\n\"\\".repeat(50000), complete: "unseen-tail" }),
    JSON.stringify(Array.from({ length: 1000 }, (_, index) => ({ index, value: "\\\"\n" }))),
    JSON.stringify("中🚀".repeat(50000)),
  ];
  for (const original of originals) {
    const result = textOf(boundToolContent(original, 256));
    const parsed = JSON.parse(result);
    assert.ok(Buffer.byteLength(result, "utf8") <= 256);
    assert.equal(parsed.truncated, true);
    assert.equal(parsed.originalBytes, Buffer.byteLength(original, "utf8"));
    assert.equal(typeof parsed.preview, "string");
    assert.ok(parsed.preview.length > 0);
    assert.ok(original.startsWith(parsed.preview));
    assert.equal(parsed.preview.includes("�"), false);
    assert.equal(Object.hasOwn(parsed, "complete"), false);
  }
});

test("two individually fitting text blocks share one byte budget and one omission marker", () => {
  const first: Anthropic.TextBlockParam = {
    type: "text", text: "first result\n", citations: [citation], cache_control: { type: "ephemeral" },
  };
  const second: Anthropic.TextBlockParam = {
    type: "text", text: "中".repeat(20), citations: [citation], cache_control: { type: "ephemeral" },
  };
  const tail: Anthropic.TextBlockParam = { type: "text", text: "omitted third result" };
  const content = [first, second, tail];
  const result = boundToolContent(content, 64);
  assert.ok(Array.isArray(result));
  assert.equal(result[0], first);
  assert.ok(Buffer.byteLength(textOf(result), "utf8") <= 64);
  assert.equal(textOf(result).match(/\[truncated\]/g)?.length, 1);
  assert.equal(textOf(result).includes(tail.text), false);
  assert.equal(result[1]?.type, "text");
  assert.equal(Object.hasOwn(result[1]!, "citations"), false);
  if (result[1]?.type === "text") assert.equal(result[1].cache_control, second.cache_control);
});

test("media survives text omission in order without consuming the text budget or mutating input", () => {
  const first: Anthropic.TextBlockParam = { type: "text", text: "head\n", citations: [citation] };
  const oversized: Anthropic.TextBlockParam = { type: "text", text: "payload ".repeat(10000), citations: [citation] };
  const late: Anthropic.TextBlockParam = { type: "text", text: "tail" };
  const content = [image, first, oversized, document, late];
  const before = structuredClone(content);
  for (const block of content) Object.freeze(block);
  Object.freeze(content);
  const result = boundToolContent(content, 64);
  assert.ok(Array.isArray(result));
  assert.deepEqual(result.filter((block) => block.type !== "text"), [image, document]);
  assert.equal(result[0], image);
  assert.equal(result.at(-1), document);
  assert.equal(result[1], first);
  assert.equal(Object.hasOwn(result[2]!, "citations"), false);
  assert.ok(Buffer.byteLength(textOf(result), "utf8") <= 64);
  assert.deepEqual(content, before);
  assert.equal(oversized.citations?.[0], citation);
});

test("underlimit content and media-only arrays retain identity and intact metadata", () => {
  const block: Anthropic.TextBlockParam = { type: "text", text: "中", citations: [citation] };
  const content = [block, image, document];
  assert.equal(boundToolContent(content, 3), content);
  assert.equal(boundToolContent(content, 100), content);
  const mediaOnly = [image, document];
  assert.equal(boundToolContent(mediaOnly, 1), mediaOnly);
  const empty: Anthropic.TextBlockParam[] = [];
  assert.equal(boundToolContent(empty, 1), empty);
  assert.equal(boundToolContent(undefined, 1), undefined);
  assert.equal(boundToolContent("abc", 3), "abc");
  assert.equal(boundToolContent('{"complete":true}', 100), '{"complete":true}');
});

test("tiny caps bound strings and arrays exactly, keeping JSON syntax where metadata cannot fit", () => {
  const original = "中🚀".repeat(1000);
  const json = JSON.stringify({ payload: original });
  for (const cap of [1, 2, 3, 4, 5, 10, 11, 12, 16, 17, 18, 32, 48, 64]) {
    const plain = textOf(boundToolContent(original, cap));
    assert.ok(plain.length > 0);
    assert.ok(Buffer.byteLength(plain, "utf8") <= cap);
    assert.equal(plain.includes("�"), false);
    assert.match(plain, /truncated|\.\.\.|~/);
    const structured = textOf(boundToolContent(json, cap));
    assert.ok(Buffer.byteLength(structured, "utf8") <= cap);
    JSON.parse(structured);
    const native = boundToolContent([{ type: "text", text: original }, image, { type: "text", text: original }], cap);
    assert.ok(Buffer.byteLength(textOf(native), "utf8") <= cap);
    assert.ok(Array.isArray(native));
    assert.equal(native.filter((block) => block.type === "image")[0], image);
  }
  assert.equal(textOf(boundToolContent(original, 1)), "~");
  assert.equal(textOf(boundToolContent(json, 1)), "0");
});

test("JSON text blocks obey the aggregate cap including envelope overhead", () => {
  const json = JSON.stringify({ values: "\\\"中".repeat(1000) });
  const result = boundToolContent([{ type: "text", text: "context\n" }, { type: "text", text: json }, document], 256);
  assert.ok(Array.isArray(result));
  assert.equal(result[0]?.type, "text");
  if (result[1]?.type !== "text") assert.fail("Expected JSON text block");
  const parsed = JSON.parse(result[1].text);
  assert.equal(parsed.truncated, true);
  assert.equal(parsed.originalBytes, Buffer.byteLength(json, "utf8"));
  assert.ok(json.startsWith(parsed.preview));
  assert.ok(Buffer.byteLength(textOf(result), "utf8") <= 256);
  assert.equal(result[2], document);
});

test("invalid byte budgets fail before even underlimit or media-only content is returned", () => {
  for (const cap of [0, -1, 0.5, 1.5, NaN, Infinity, -Infinity]) {
    assert.throws(() => boundToolContent("", cap), RangeError);
    assert.throws(() => boundToolContent([image], cap), RangeError);
  }
});
