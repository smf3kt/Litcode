// Question images as native multimodal blocks. The recovered producer keeps one
// image map per question key, flattens every question's images in question order
// and converts them at submit or clarify time:
//   `hwe`/`Fo` (chunk-24k7d6mw.js [1168121,1177646)), removal [1169440,1169620),
//   `Bo` flatten [1169620,1169710) over `rmo`/`smo` [1163934,1164018),
//   `Jet` [1180182,1180348) and consumers `P3`/`Qet` [1178668,1179811).
// `Jet` converts through `mb` (chunk-v96accjb.js [13222,14061)), which may hand
// back the degraded text block instead of an image; see src/image-codec.ts.
import fsp from "node:fs/promises";

import type { Anthropic } from "@anthropic-ai/sdk";

import { imageCodecBlock } from "./image-codec.js";
import { IMAGE_MAX_BASE64_BYTES, base64Length, imageInfo, type MediaContext } from "./media.js";

export type QuestionImageDimensions = { width: number; height: number };

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw Object.assign(new Error("Question image read aborted"), { name: "AbortError" });
}

/** Recovered `Fo`: id, type, content, mediaType and filename defaults. */
export type QuestionImage = {
  id: string;
  type: "image";
  content: string;
  mediaType: string;
  filename: string;
  dimensions?: QuestionImageDimensions;
  /** Host addition: the private attachment this content was read from, removed on delete. */
  path?: string;
};

export class QuestionImages {
  private readonly byQuestion = new Map<string, Map<string, QuestionImage>>();
  private readonly order: string[] = [];
  private sequence = 0;

  /**
   * Recovered `Fo`. The store keeps no count cap of its own: the source bounds
   * the payload at the API byte contract, and the caller owns the
   * `wouldTakeAnswer` gate that decides whether an image may be attached.
   */
  add(questionKey: string, input: { content: string; mediaType?: string; filename?: string; dimensions?: QuestionImageDimensions; path?: string }): QuestionImage {
    let question = this.byQuestion.get(questionKey);
    if (question === undefined) { question = new Map(); this.byQuestion.set(questionKey, question); this.order.push(questionKey); }
    this.sequence += 1;
    const image: QuestionImage = { id: `image-${this.sequence}`, type: "image", content: input.content,
      mediaType: input.mediaType ?? "image/png", filename: input.filename ?? "Pasted image",
      ...(input.dimensions === undefined ? {} : { dimensions: input.dimensions }), ...(input.path === undefined ? {} : { path: input.path }) };
    question.set(image.id, image);
    return image;
  }

  /** Recovered removal [1169440,1169620): report whether the id was present. */
  remove(questionKey: string, id: string): boolean {
    const question = this.byQuestion.get(questionKey);
    if (question === undefined || !question.delete(id)) return false;
    if (question.size === 0) { this.byQuestion.delete(questionKey); this.order.splice(this.order.indexOf(questionKey), 1); }
    return true;
  }

  /** The last image of one question, for the empty-input Backspace action. */
  last(questionKey: string): QuestionImage | undefined {
    const question = this.byQuestion.get(questionKey);
    if (question === undefined) return undefined;
    return [...question.values()].at(-1);
  }

  list(questionKey: string): QuestionImage[] { return [...(this.byQuestion.get(questionKey)?.values() ?? [])]; }

  /** Recovered `Bo`: every question's images, flattened in question order. */
  flatten(): QuestionImage[] { return this.order.flatMap(key => this.list(key)); }

  /** Host cleanup: drop every entry and unlink its private attachment. */
  async clear(): Promise<void> {
    const paths = this.flatten().flatMap(image => image.path === undefined ? [] : [image.path]);
    this.byQuestion.clear(); this.order.length = 0;
    await Promise.all(paths.map(async target => { try { await fsp.unlink(target); } catch { /* already gone */ } }));
  }
}

/**
 * Recovered `Jet`: an empty list converts to undefined, otherwise every image
 * becomes one native block. A conversion failure degrades that entry to the
 * recovered text block, so callers must not read the result as images only.
 */
export async function questionImageBlocks(images: readonly QuestionImage[], context: MediaContext): Promise<Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> | undefined> {
  if (images.length === 0) return undefined;
  const blocks: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [];
  for (const image of images) {
    checkAbort(context.signal);
    blocks.push(imageCodecBlock({ data: image.content, mediaType: image.mediaType }).block);
  }
  return blocks;
}

/** Native block shape guard for a host-supplied block at the tool boundary. */
export function admittedImageBlock(value: unknown): Anthropic.ImageBlockParam | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const block = value as { type?: unknown; source?: { type?: unknown; media_type?: unknown; data?: unknown } };
  if (block.type !== "image" || block.source?.type !== "base64") return undefined;
  const mediaType = block.source.media_type;
  const data = block.source.data;
  if (typeof mediaType !== "string" || typeof data !== "string") return undefined;
  const bytes = Buffer.from(data, "base64");
  if (base64Length(bytes.length) > IMAGE_MAX_BASE64_BYTES) return undefined;
  try {
    if (imageInfo(bytes).mediaType !== mediaType) return undefined;
  } catch { return undefined; }
  return { type: "image", source: { type: "base64", media_type: mediaType as Anthropic.Base64ImageSource["media_type"], data } };
}

/** Recovered `K1` on a private attachment: dimensions and media type from its header. */
export async function readQuestionImage(target: string): Promise<{ content: string; mediaType: string; dimensions: QuestionImageDimensions }> {
  const bytes = await fsp.readFile(target);
  const info = imageInfo(bytes);
  return { content: bytes.toString("base64"), mediaType: info.mediaType, dimensions: { width: info.width, height: info.height } };
}
