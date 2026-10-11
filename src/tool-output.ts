import type { Anthropic } from "@anthropic-ai/sdk";

type ToolContent = Anthropic.ToolResultBlockParam['content'];

function truncationMarker(maxBytes: number): string {
  for (const marker of ["\n[truncated]", "[truncated]", "[...]", "...", "~"]) {
    if (Buffer.byteLength(marker, "utf8") <= maxBytes) return marker;
  }
  return "";
}

function utf8Prefix(text: string, maxBytes: number): string {
  // Bound the temporary buffer too, and keep a surrogate pair across the slice edge.
  let chars = Math.min(text.length, maxBytes);
  if (chars > 0 && chars < text.length
      && text.charCodeAt(chars - 1) >= 0xd800 && text.charCodeAt(chars - 1) <= 0xdbff
      && text.charCodeAt(chars) >= 0xdc00 && text.charCodeAt(chars) <= 0xdfff) chars--;
  const bytes = Buffer.from(text.slice(0, chars), "utf8");
  let end = Math.min(bytes.length, maxBytes);
  while (end < bytes.length && end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return bytes.subarray(0, end).toString("utf8");
}

function boundedJson(text: string, originalBytes: number, maxBytes: number): string {
  const envelope = (preview: string) => JSON.stringify({ truncated: true, originalBytes, preview });
  const empty = envelope("");
  if (Buffer.byteLength(empty, "utf8") > maxBytes) {
    // Tiny caps cannot hold the full envelope; preserve JSON syntax at every size.
    for (const fallback of ['{"truncated":true}', '"[truncated]"', '"truncated"', '"..."', '"~"', '0']) {
      if (Buffer.byteLength(fallback, "utf8") <= maxBytes) return fallback;
    }
  }
  let low = 0;
  let high = maxBytes - Buffer.byteLength(empty, "utf8");
  let result = empty;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = envelope(utf8Prefix(text, mid));
    if (Buffer.byteLength(candidate, "utf8") <= maxBytes) {
      result = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

function truncatedText(text: string, maxBytes: number): string {
  try {
    JSON.parse(text);
  } catch {
    const marker = truncationMarker(maxBytes);
    return utf8Prefix(text, maxBytes - Buffer.byteLength(marker, "utf8")) + marker;
  }
  return boundedJson(text, Buffer.byteLength(text, "utf8"), maxBytes);
}

/** Bound final tool text, including omission metadata; media has its own factory limits. */
export function boundToolContent(content: ToolContent, maxBytes: number): ToolContent {
  if (!Number.isFinite(maxBytes) || !Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("maxBytes must be a finite integer greater than or equal to 1");
  }
  if (typeof content === "string") {
    return Buffer.byteLength(content, "utf8") <= maxBytes ? content : truncatedText(content, maxBytes);
  }
  if (content === undefined) return content;
  const totalBytes = content.reduce((total, block) =>
    total + (block.type === "text" ? Buffer.byteLength(block.text, "utf8") : 0), 0);
  if (totalBytes <= maxBytes) return content;

  const result: NonNullable<Exclude<ToolContent, string>> = [];
  const markerBytes = Buffer.byteLength(truncationMarker(maxBytes), "utf8");
  let remaining = maxBytes;
  let omitted = false;
  for (const block of content) {
    if (block.type !== "text" || block.text === "") {
      result.push(block);
      continue;
    }
    if (omitted) continue;
    const blockBytes = Buffer.byteLength(block.text, "utf8");
    if (blockBytes <= remaining - markerBytes) {
      result.push(block);
      remaining -= blockBytes;
      continue;
    }
    const { citations: _citations, ...fields } = block;
    result.push({ ...fields, text: truncatedText(block.text, remaining) });
    omitted = true;
  }
  return result;
}
