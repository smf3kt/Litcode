import { z } from 'zod';

// Host lock record for Ole, sfn1dbxq [4694145,4697475), UTF-16; the source has no Session gate.
export const sessionGateIdentitySchema = z.object({ dev: z.string().regex(/^[0-9]+$/), ino: z.string().regex(/^[0-9]+$/) }).strict();
export const sessionLockSchema = z.object({ pid: z.number().int().positive(), token: z.string().uuid(), gate: sessionGateIdentitySchema }).strict();
export const recoverableSessionLockSchema = z.object({ pid: z.number().int().positive(), gate: sessionGateIdentitySchema.optional() }).passthrough();
export type SessionGateIdentity = z.infer<typeof sessionGateIdentitySchema>;
