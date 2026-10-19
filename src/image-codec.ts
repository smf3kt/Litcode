// Question-image codec decision procedure. Ported from the recovered `mb` and
// `WNe` bodies (chunk-v96accjb.js [13222,14061) and [8222,12752)); the exact
// branch order and invariants are recorded in .audit/w187-c11-codec-oracle.md.
// The source encodes through Bun.Image, which this runtime does not have, so
// every encode step fails the way the source's own diskless stub fails
// (`ERR_IMAGE_DECODE_FAILED`) and the body lands on its documented fallback:
// original bytes are returned unchanged when they already satisfy the API
// contract, otherwise a precise `ImageResizeError` is thrown and `mb` degrades
// it to a text block. Nothing here decodes or re-encodes pixels.
import type { Anthropic } from "@anthropic-ai/sdk";

import { IMAGE_MAX_BASE64_BYTES, IMAGE_MAX_HEIGHT, IMAGE_MAX_WIDTH, IMAGE_TARGET_RAW_BYTES, base64Length, imageInfo } from "./media.js";

/** `r3` and `we`: the API pixel limit and the decode cost cap. */
export const IMAGE_MAX_PIXELS = 64_000_000;
/** `wZ`: the byte budget `mb` enforces on the encoded buffer. */
export const IMAGE_BYTE_BUDGET = 512_000;
export type ImageLimits = { maxWidth: number; maxHeight: number; targetRawSize: number; maxBase64Size: number };
/** The recovered API image contract the media reader already enforces. */
export const QUESTION_IMAGE_LIMITS: ImageLimits = Object.freeze({
  maxWidth: IMAGE_MAX_WIDTH, maxHeight: IMAGE_MAX_HEIGHT,
  targetRawSize: IMAGE_TARGET_RAW_BYTES, maxBase64Size: IMAGE_MAX_BASE64_BYTES,
});

/** Recovered `eO`: the resize error `mb` converts into a degraded text block. */
export class ImageResizeError extends Error {
  readonly code = "ERR_IMAGE_RESIZE";
}

/** Recovered `N`: the hard reject bounds default to the ordinary maxima. */
function rejectBounds(limits: ImageLimits): { rejectMaxWidth: number; rejectMaxHeight: number } {
  return { rejectMaxWidth: limits.maxWidth, rejectMaxHeight: limits.maxHeight };
}

/** Recovered `K1`/`P6`: dimensions and media type from the file header only. */
function headerProbe(bytes: Buffer): { width: number; height: number; mediaType: string } | undefined {
  try {
    const info = imageInfo(bytes);
    return { width: info.width, height: info.height, mediaType: info.mediaType };
  } catch { return undefined; }
}

function byteText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

/** Recovered `se` default guidance; the CMYK and animated-WebP cases need decoded metadata. */
function decodeAdvice(): { reason: string; advice: string } {
  return { reason: "its pixels could not be decoded (the file may be damaged, or use an encoding this runtime cannot read)",
    advice: "Re-save it as a PNG or JPEG and try again." };
}

const DECODE_FAILED = "decode-failed";
/** Recovered `BNe`: our host can only report the unavailable/failed-decode class. */
function classify(error: unknown): string {
  return (error as { code?: unknown }).code === "ERR_IMAGE_DECODE_FAILED" ? DECODE_FAILED : "other";
}

/** The error every encode step raises while no image codec is present. */
function encodingUnavailable(): Error {
  const error = new Error("Image processing is unavailable in this runtime");
  (error as Error & { code: string }).code = "ERR_IMAGE_DECODE_FAILED";
  return error;
}

export type ImageResizeResult = { buffer: Buffer; mediaType: string; dimensions?: { originalWidth: number; originalHeight: number; displayWidth: number; displayHeight: number } };

/**
 * Recovered `WNe` decision order for a host whose encode steps are unavailable.
 * Steps 1-3 run first, so an empty buffer and an unknown format keep their own
 * messages; every later step that needs an encoder falls to the recovery path.
 */
export function imageResize(bytes: Buffer, format: string, limits: ImageLimits = QUESTION_IMAGE_LIMITS): ImageResizeResult {
  if (bytes.length === 0) throw new ImageResizeError("Image file is empty (0 bytes)");
  void format; // `WNe` reads the format from decoded metadata, which this host cannot decode.
  try {
    // Source `WNe` opens by decoding with `Bun.Image` (`metadata`, then the
    // unlisted-format re-encode and every resize/encode step). This runtime
    // lacks that engine, so the first decode step fails exactly like the
    // source's diskless stub and control reaches the recovery path below,
    // which measures the original bytes from the file header (`K1`).
    throw encodingUnavailable();
  } catch (error) {
    if (error instanceof ImageResizeError) throw error;
    const failure = classify(error);
    const probe = headerProbe(bytes);
    if (probe === undefined) {
      throw new ImageResizeError("Unable to resize image — image processing is unavailable and dimensions could not be read from the file header. "
        + "Please convert the image to PNG, JPEG, GIF, or WebP.");
    }
    const mediaType = probe.mediaType.slice("image/".length);
    const base64Size = Math.ceil((bytes.length * 4) / 3);
    const { rejectMaxWidth, rejectMaxHeight } = rejectBounds(limits);
    const overDimensions = probe.width > rejectMaxWidth || probe.height > rejectMaxHeight;
    // The source returns the original bytes when they already satisfy the API
    // contract; compression failure is not a reason to change an image that fits.
    if (base64Size <= limits.maxBase64Size && !overDimensions) return { buffer: bytes, mediaType };
    if (failure === DECODE_FAILED) {
      const { reason, advice } = decodeAdvice();
      const over = overDimensions
        ? `at ${probe.width}x${probe.height}px it is over the ${rejectMaxWidth}x${rejectMaxHeight}px limit`
        : `it is over the ${byteText(limits.maxBase64Size)} API limit (${byteText(bytes.length)} raw, ${byteText(base64Size)} base64)`;
      throw new ImageResizeError(`Unable to resize image — ${reason}, and ${over}, so it cannot be sent. ${advice}`);
    }
    throw new ImageResizeError(overDimensions
      ? `Unable to resize image — dimensions exceed the ${rejectMaxWidth}x${rejectMaxHeight}px limit and image processing failed. Please resize the image to reduce its pixel dimensions.`
      : `Unable to resize image (${byteText(bytes.length)} raw, ${byteText(base64Size)} base64). The image exceeds the ${byteText(limits.maxBase64Size)} API limit and compression failed. Please resize the image manually or use a smaller image.`);
  }
}

export type ImageCodecResult = {
  block: Anthropic.ImageBlockParam | Anthropic.TextBlockParam;
  dimensions?: { originalWidth: number; originalHeight: number; displayWidth: number; displayHeight: number };
  byteBudgetExceeded?: boolean;
};

/**
 * Recovered `mb`: base64 or buffer in, one native block out. A resize failure
 * becomes the recovered degraded `text` block rather than an exception, so a
 * consumer must not assume `contentBlocks` holds images only. The source's
 * byte-budget search (`Xuo`) and its WebP choice (`Juo`) both need an encoder
 * and stay unported; an over-budget buffer therefore passes through with the
 * flag set, as the source does when its own compression call fails.
 */
export function imageCodecBlock(input: { data: string | Buffer; mediaType?: string; limits?: ImageLimits }): ImageCodecResult {
  const bytes = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data, "base64");
  const limits = input.limits ?? QUESTION_IMAGE_LIMITS;
  const format = input.mediaType?.includes("/") ? input.mediaType.split("/")[1] || "png" : input.mediaType || "png";
  let resized: ImageResizeResult;
  try {
    resized = imageResize(bytes, format, limits);
  } catch (error) {
    if (error instanceof ImageResizeError) return { block: { type: "text", text: `[Image could not be processed: ${error.message}]` } };
    throw error;
  }
  const block: Anthropic.ImageBlockParam = { type: "image",
    source: { type: "base64", media_type: (headerProbe(resized.buffer)?.mediaType ?? `image/${resized.mediaType}`) as Anthropic.Base64ImageSource["media_type"],
      data: resized.buffer.toString("base64") } };
  const overBudget = resized.buffer.length > IMAGE_BYTE_BUDGET;
  return { block, ...(resized.dimensions === undefined ? {} : { dimensions: resized.dimensions }), ...(overBudget ? { byteBudgetExceeded: true } : {}) };
}
