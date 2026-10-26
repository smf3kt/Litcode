import { z } from 'zod';
import type { Anthropic } from '@anthropic-ai/sdk';
import { admittedImageBlock } from './question-images.js';

export const TOOL_FEEDBACK_LIMITS = Object.freeze({ blocks: 16, textChars: 4096 });
export type ToolFeedbackBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;

// P3/Qet, 24k7d6mw [1178668,1179811), UTF-16.
export function admitContentBlocks(value: unknown, tool = 'ask_user_question'): ToolFeedbackBlock[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > TOOL_FEEDBACK_LIMITS.blocks) {
    throw new Error(`${tool}: contentBlocks must be an array of at most ${TOOL_FEEDBACK_LIMITS.blocks} blocks`);
  }
  const blocks: ToolFeedbackBlock[] = [];
  for (const entry of value) {
    if (typeof entry === 'object' && entry !== null && !Array.isArray(entry) &&
      (Object.getPrototypeOf(entry) === Object.prototype || Object.getPrototypeOf(entry) === null) &&
      Object.hasOwn(entry, 'type') && 'type' in entry && entry.type === 'text') {
      const text = Object.hasOwn(entry, 'text') && 'text' in entry ? entry.text : undefined;
      if (typeof text !== 'string' || text.length === 0 || text.length > TOOL_FEEDBACK_LIMITS.textChars) {
        throw new Error(`${tool}: content block text is invalid`);
      }
      blocks.push({ type: 'text', text });
      continue;
    }
    const image = admittedImageBlock(entry);
    if (image === undefined) throw new Error(`${tool}: content block is not a valid image or text block`);
    blocks.push(image);
  }
  return blocks;
}

export const toolFeedbackBlocksSchema = z.array(z.unknown()).transform((value, context) => {
  try { return admitContentBlocks(value, 'tool feedback') ?? []; }
  catch (error) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : String(error) });
    return z.NEVER;
  }
});

// ro/g1t, 9c5se12s [56388,59378)/[5863,10103), UTF-16.
export class ToolFeedbackError extends Error {
  readonly blocks: ToolFeedbackBlock[];
  constructor(message: string, blocks: unknown) {
    super(message);
    this.blocks = toolFeedbackBlocksSchema.parse(blocks);
  }
}
