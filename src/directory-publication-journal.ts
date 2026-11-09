import { z } from 'zod';
import { publicationEditSchema } from './directory-publication-authorization.js';
import { boundDirectoryFileObservationSchema, directoryPublicationExpectedSchema } from './directory-file-state.js';

// Host journal rewrite: uno/Fet, sfn1dbxq [739599,743280)/[4731316,4732048),
// and pPe/sC, f606a53w [7111,7501)/[12501,15618), UTF-16, have no owner-bound receipt.
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const identity = z.string().regex(/^[0-9]+$/);
export const directoryPublicationIntentSchema = z.object({ kind: z.literal('directory_publication_intent'), id: z.string().uuid(),
  owner: z.string().uuid(), toolUseId: z.string().min(1).max(256),
  messageContext: z.object({ userMessageId: z.string().uuid(), parentMessageId: z.string().uuid() }).strict(),
  lexicalPath: z.string().min(1).max(4096), grant: z.object({ root: z.string().min(1).max(4096), incarnation: z.string().uuid(),
    dev: identity, ino: identity }).strict(), backupId: z.string().uuid(), expected: directoryPublicationExpectedSchema,
  content: z.object({ bytes: z.number().int().nonnegative().safe(), sha256: digest }).strict(), overwrite: z.boolean().optional(),
  edit: publicationEditSchema.optional(), strategy: z.literal('retained').optional() }).strict();
export const directoryPublicationResultSchema = z.object({ kind: z.literal('directory_publication_result'), id: z.string().uuid(),
  owner: z.string().uuid(), intent: digest, outcome: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('durable'), observation: boundDirectoryFileObservationSchema,
      retained: z.object({ held: boundDirectoryFileObservationSchema }).strict().optional() }).strict(),
    z.object({ kind: z.literal('not_published') }).strict(),
    z.object({ kind: z.literal('unknown') }).strict(),
  ]) }).strict();
export const directoryPublicationFailureSchema = z.object({ kind: z.literal('directory_publication_failed'), id: z.string().uuid(),
  owner: z.string().uuid(), intent: digest }).strict();
export const directoryPublicationReceiptSchema = z.object({ owner: z.string().uuid(), id: z.string().uuid(), intent: digest, result: digest,
  journal: z.object({ bytes: z.number().int().positive().safe(), sha256: digest }).strict() }).strict();
export type DirectoryPublicationIntentEvent = z.infer<typeof directoryPublicationIntentSchema>;
export type DirectoryPublicationResultEvent = z.infer<typeof directoryPublicationResultSchema>;
export type DirectoryPublicationFailureEvent = z.infer<typeof directoryPublicationFailureSchema>;
export type DirectoryPublicationRecord = { kind: 'unknown'; id: string } | { kind: 'not_published'; id: string } |
  { kind: 'durable'; id: string; observation: z.infer<typeof boundDirectoryFileObservationSchema>;
    retained?: { transactionId: string; held: z.infer<typeof boundDirectoryFileObservationSchema> } };
