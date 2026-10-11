// Bounded local media intake. Only container metadata is inspected; pixels and
// PDF scripts are never rendered or executed.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import type { Anthropic } from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";

import type { ToolDefinition } from "./tools.js";

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_MAX_PAGES = 20;
export type MediaContext = { workspace: string; signal: AbortSignal };
export type MediaOptions = { pages?: string };
export const mediaInputSchema = z.object({ path: z.string().min(1).max(4096), pages: z.string().min(1).max(256).optional() }).strict();
export type MediaAttachment = z.infer<typeof mediaInputSchema>;

export function parseAttachmentCommand(input: string): { attachment: MediaAttachment; prompt: string } {
  const word = (text: string): { value: string; rest: string } => {
    text = text.trimStart();
    let value = "", quote = "", index = 0;
    for (; index < text.length; index++) {
      const character = text[index]!;
      if (!quote && /\s/.test(character)) break;
      if (character === quote) { quote = ""; continue; }
      if (!quote && (character === "\"" || character === String.fromCharCode(39))) { quote = character; continue; }
      if (character === "\\" && quote !== String.fromCharCode(39)) {
        if (++index >= text.length) throw new Error("Incomplete attachment path escape");
        value += text[index];
      } else value += character;
    }
    if (quote) throw new Error("Unclosed attachment path quote");
    return { value, rest: text.slice(index).trimStart() };
  };
  const file = word(input);
  let prompt = file.rest;
  let pages: string | undefined;
  if (/^--pages(?:\s|$)/.test(prompt)) {
    const selection = word(prompt.slice(7));
    pages = selection.value; prompt = selection.rest;
  }
  if (!prompt.trim()) throw new Error("Use /attach PATH [--pages RANGE] PROMPT");
  return { attachment: mediaInputSchema.parse({ path: file.value, ...(pages === undefined ? {} : { pages }) }), prompt };
}
export type MediaBlocks = Array<Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam | Anthropic.TextBlockParam>;
export type MediaResult = {
  blocks: MediaBlocks;
  summary: string;
  metadata: {
    mediaType: Anthropic.Base64ImageSource["media_type"] | "application/pdf";
    bytes: number;
    width?: number;
    height?: number;
    pageCount?: number;
    selectedPages?: number[];
  };
};

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw Object.assign(new Error("Media read aborted"), { name: "AbortError" });
}
function within(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${path.sep}`));
}
function reserved(root: string, target: string): boolean {
  return path.relative(root, target).split(path.sep).includes(".agent");
}
async function confine(root: string, userPath: string): Promise<string> {
  if (typeof userPath !== "string" || !userPath || userPath.length > 4096 || userPath.includes("\0") || path.isAbsolute(userPath)) {
    throw new Error("Media path must be workspace-relative");
  }
  if (userPath.split(/[\\/]/).includes(".agent")) throw new Error("Media path is inside reserved .agent directory");
  const target = path.resolve(root, userPath);
  if (!within(root, target)) throw new Error("Media path escapes the workspace");
  let current = root;
  for (const segment of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = await fsp.realpath(path.join(current, segment));
    if (!within(root, current)) throw new Error("Media path escapes the workspace through a symlink");
    if (reserved(root, current)) throw new Error("Media path aliases reserved .agent directory");
  }
  return current;
}
async function readBytes(userPath: string, context: MediaContext): Promise<Buffer> {
  checkAbort(context.signal);
  const root = await fsp.realpath(context.workspace);
  checkAbort(context.signal);
  const file = await confine(root, userPath);
  checkAbort(context.signal);
  const handle = await fsp.open(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error("Media path must be a regular file");
    if (stat.size > MEDIA_MAX_BYTES) throw new Error(`Media exceeds ${MEDIA_MAX_BYTES} byte limit`);
    const real = await confine(root, userPath);
    const current = await fsp.stat(real);
    if (real !== file || current.dev !== stat.dev || current.ino !== stat.ino) throw new Error("Media path changed during validation");
    checkAbort(context.signal);
    const buffer = Buffer.alloc(Math.min(stat.size + 1, MEDIA_MAX_BYTES + 1));
    let used = 0;
    while (used < buffer.length) {
      checkAbort(context.signal);
      const { bytesRead } = await handle.read(buffer, used, Math.min(64 * 1024, buffer.length - used), used);
      if (bytesRead === 0) break;
      used += bytesRead;
    }
    if (used > stat.size || used > MEDIA_MAX_BYTES) throw new Error("Media grew during bounded read; retry");
    checkAbort(context.signal);
    return buffer.subarray(0, used);
  } finally {
    await handle.close();
  }
}

type ImageInfo = { mediaType: Anthropic.Base64ImageSource["media_type"]; width: number; height: number };
function imageInfo(bytes: Buffer): ImageInfo {
  let info: ImageInfo | undefined;
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR") throw new Error("Invalid PNG header");
    info = { mediaType: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  } else if (bytes.length >= 13 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) {
    info = { mediaType: "image/gif", width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  } else if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    const riffEnd = bytes.readUInt32LE(4) + 8;
    if (riffEnd !== bytes.length) throw new Error("Invalid WebP RIFF length");
    let offset = 12;
    while (offset + 8 <= riffEnd) {
      const tag = bytes.toString("ascii", offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      const begin = offset + 8;
      if (size > riffEnd - begin) throw new Error("Truncated WebP chunk");
      if (tag === "VP8X" && size === 10) info = { mediaType: "image/webp", width: bytes.readUIntLE(begin + 4, 3) + 1, height: bytes.readUIntLE(begin + 7, 3) + 1 };
      else if (tag === "VP8 " && size >= 10 && bytes.subarray(begin + 3, begin + 6).equals(Buffer.from([157, 1, 42]))) {
        info ??= { mediaType: "image/webp", width: bytes.readUInt16LE(begin + 6) & 0x3fff, height: bytes.readUInt16LE(begin + 8) & 0x3fff };
      } else if (tag === "VP8L" && size >= 5 && bytes[begin] === 47) {
        const bits = bytes.readUInt32LE(begin + 1);
        info ??= { mediaType: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      offset = begin + size + (size % 2);
    }
    if (offset !== riffEnd) throw new Error("Invalid WebP chunk boundary");
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    const startOfFrames = new Set([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207]);
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error("Invalid JPEG marker");
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === undefined || marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) throw new Error("Truncated JPEG segment");
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error("Invalid JPEG segment length");
      if (startOfFrames.has(marker)) {
        if (length < 8 || length !== 8 + 3 * bytes[offset + 7]!) throw new Error("Invalid JPEG frame header");
        info = { mediaType: "image/jpeg", width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
        break;
      }
      offset += length;
    }
  }
  if (!info || info.width < 1 || info.height < 1) throw new Error("Unsupported or invalid image header/dimensions");
  return info;
}

/** Parse 1-based inclusive ranges, preserving requested order, with a 20-page cap. */
export function parseMediaPages(pages: string, pageCount: number): number[] {
  if (typeof pages !== "string" || pages.length > 256 || !pages.trim()) throw new Error("PDF pages must be a range such as 1-5,8");
  const selected: number[] = [];
  const seen = new Set<number>();
  for (const part of pages.split(",")) {
    const match = /^\s*([1-9][0-9]*)(?:\s*-\s*([1-9][0-9]*))?\s*$/.exec(part);
    if (!match) throw new Error("Invalid PDF page range");
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end > pageCount) throw new Error("PDF page range is outside document");
    if (end - start + 1 + selected.length > MEDIA_MAX_PAGES) throw new Error(`PDF selection exceeds ${MEDIA_MAX_PAGES} pages`);
    for (let page = start; page <= end; page++) {
      if (seen.has(page)) throw new Error("PDF page ranges overlap");
      seen.add(page);
      selected.push(page);
    }
  }
  return selected;
}

/** Return SDK-native image/document blocks and a short text summary for tool use. */
export async function readMedia(userPath: string, context: MediaContext, options: MediaOptions = {}): Promise<MediaResult> {
  checkAbort(context.signal);
  const bytes = await readBytes(userPath, context);
  const extension = path.extname(userPath).toLowerCase();
  const label = JSON.stringify(userPath.length > 200 ? `${userPath.slice(0, 200)}...` : userPath);
  if (extension === ".pdf") {
    if (!/^%PDF-[12]\.[0-9]/.test(bytes.subarray(0, 8).toString("ascii")) || !bytes.subarray(Math.max(0, bytes.length - 1024)).includes(Buffer.from("%%EOF"))) {
      throw new Error("Invalid PDF header or trailer");
    }
    checkAbort(context.signal);
    let original: PDFDocument;
    let pageCount: number;
    try {
      original = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
      pageCount = original.getPageCount();
    } catch { throw new Error("Invalid or encrypted PDF document"); }
    checkAbort(context.signal);
    if (pageCount < 1) throw new Error("PDF document has no pages");
    if (pageCount > 10 && options.pages === undefined) throw new Error("PDF documents over 10 pages require explicit pages");
    const selectedPages = options.pages === undefined ? Array.from({ length: pageCount }, (_, index) => index + 1) : parseMediaPages(options.pages, pageCount);
    let data: Uint8Array = bytes;
    if (options.pages !== undefined) {
      const selected = await PDFDocument.create();
      const pages = await selected.copyPages(original, selectedPages.map((page) => page - 1));
      checkAbort(context.signal);
      for (const page of pages) selected.addPage(page);
      data = await selected.save();
      checkAbort(context.signal);
      if (data.byteLength > MEDIA_MAX_BYTES) throw new Error("Selected PDF exceeds media byte limit");
    }
    const summary = `PDF ${label}: ${bytes.length} bytes, ${pageCount} pages; attached pages ${selectedPages.join(",")}.`;
    const document: Anthropic.DocumentBlockParam = {
      type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(data).toString("base64") },
    };
    return { blocks: [document, { type: "text", text: summary }], summary, metadata: { mediaType: "application/pdf", bytes: bytes.length, pageCount, selectedPages } };
  }
  if (options.pages !== undefined) throw new Error("Page selection applies to PDF documents");
  const expected: Record<string, Anthropic.Base64ImageSource["media_type"]> = {
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp",
  };
  if (!expected[extension]) throw new Error("Supported media extensions: png, jpg, jpeg, gif, webp, pdf");
  const info = imageInfo(bytes);
  if (info.mediaType !== expected[extension]) throw new Error("Media extension differs from detected image type");
  checkAbort(context.signal);
  const summary = `Image ${label}: ${info.mediaType}, ${info.width}x${info.height}, ${bytes.length} bytes.`;
  const image: Anthropic.ImageBlockParam = {
    type: "image", source: { type: "base64", media_type: info.mediaType, data: bytes.toString("base64") },
  };
  return { blocks: [image, { type: "text", text: summary }], summary, metadata: { ...info, bytes: bytes.length } };
}

export function createMediaTools(): ToolDefinition[] {
  return [{
    schema: {
      name: "read_media",
      description: "Read a workspace-relative PNG/JPEG/GIF/WebP image or PDF as native multimodal content, up to 10 MiB. Images include dimensions and preserve bytes. PDF documents over 10 pages require pages; page selection is 1-based inclusive ranges, at most 20 pages per call. Reserved .agent paths and symlink escapes are rejected.",
      input_schema: {
        type: "object", additionalProperties: false, required: ["path"],
        properties: {
          path: { type: "string", description: "Workspace-relative media file path." },
          pages: { type: "string", description: "PDF pages, e.g. 1-5,8; at most 20 pages." },
        },
      },
    },
    readOnly: true,
    async execute(input, context) {
      const parsed = mediaInputSchema.parse(input);
      return (await readMedia(parsed.path, context, { pages: parsed.pages })).summary;
    },
    async executeBlocks(input, context) {
      const parsed = mediaInputSchema.parse(input);
      return (await readMedia(parsed.path, context, { pages: parsed.pages })).blocks;
    },
  }];
}
