import { z } from 'zod';
import type Anthropic from '@anthropic-ai/sdk';

export const messageOriginSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('human') }).strict(),
  z.object({ kind: z.literal('generated'), source: z.string() }).strict(),
  z.object({ kind: z.literal('child'), source: z.string() }).strict(),
  z.object({ kind: z.literal('peer'), source: z.string() }).strict(),
  z.object({ kind: z.literal('summary') }).strict(),
  z.object({ kind: z.literal('unknown') }).strict(),
]);
export type MessageOrigin = z.infer<typeof messageOriginSchema>;
export const classifierMessageSchema = z.object({
  origin: messageOriginSchema,
  humanText: z.string().optional(),
  outcomes: z.record(z.enum(['ok', 'error', 'rejected-by-user', 'blocked-by-permissions', 'automode-blocked', 'automode-unavailable', 'automode-parsing-error'])).optional(),
}).strict();
export type ClassifierMessage = z.infer<typeof classifierMessageSchema>;
const provenance = new WeakMap<Anthropic.MessageParam, ClassifierMessage>();
export function classifierMessage(message: Anthropic.MessageParam): ClassifierMessage | undefined { return provenance.get(message); }
export function markClassifierMessage(message: Anthropic.MessageParam, value: ClassifierMessage): Anthropic.MessageParam {
  provenance.set(message, value); return message;
}
export function cloneClassifierMessages(messages: readonly Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  return messages.map(message => {
    const copy = structuredClone(message);
    const origin = provenance.get(message);
    if (origin) provenance.set(copy, structuredClone(origin));
    return copy;
  });
}
