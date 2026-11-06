import { createHash } from 'node:crypto';
import path from 'node:path';
import { types as utilTypes } from 'node:util';
import { z } from 'zod';
import type { Session } from './session.js';
import type { PathApprovalCall } from './path-approval-call-owner.js';

export const directoryWriteInputSchema = z.object({ path: z.string().min(1), content: z.string(), overwrite: z.boolean().optional() }).strict();
export type DirectoryPublicationAuthorization = object;
export type DirectoryWriteWitness = { lexicalPath: string; content: { bytes: number; sha256: string }; overwrite: boolean };
type Grant = { session: Session; toolUseId: string; lexicalPath: string; content: { bytes: number; sha256: string }; overwrite: boolean;
  signal: AbortSignal; authorizationSignal: AbortSignal; approvalCall: PathApprovalCall; retire: () => void };
const grants = new WeakMap<DirectoryPublicationAuthorization, Grant>();

export function describeDirectoryWriteInput(session: Session, value: unknown): DirectoryWriteWitness | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || utilTypes.isProxy(value)) return;
  const prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
  if ((prototype !== Object.prototype && prototype !== null) || Object.values(descriptors).some(descriptor => !('value' in descriptor))) return;
  const parsed = directoryWriteInputSchema.safeParse(value);
  if (!parsed.success) return;
  const content = Buffer.from(parsed.data.content);
  return { lexicalPath: path.resolve(session.config.workspace, parsed.data.path),
    content: { bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') }, overwrite: parsed.data.overwrite === true };
}

export function directoryWriteFingerprint(witness: DirectoryWriteWitness): string {
  return createHash('sha256').update(JSON.stringify(witness)).digest('hex');
}

// Host capability: uno and m_t/_Wo, sfn1dbxq [739599,743280)/[504681,505531)/[2237279,2239655), UTF-16.
export function issueDirectoryPublicationAuthorization(input: { session: Session; toolUseId: string; value: unknown;
  signal: AbortSignal; authorizationSignal: AbortSignal; approvalCall: PathApprovalCall }): DirectoryPublicationAuthorization | undefined {
  const witness = describeDirectoryWriteInput(input.session, input.value);
  if (!witness || !input.session.isOpen || input.session.isJournalFenced || input.signal.aborted || input.authorizationSignal.aborted ||
      !input.approvalCall.isActive || input.approvalCall.providerId !== input.toolUseId) return;
  const token = {};
  const retire = () => {
    grants.delete(token);
    input.signal.removeEventListener('abort', retire);
    input.authorizationSignal.removeEventListener('abort', retire);
    input.session.closeSignal.removeEventListener('abort', retire);
  };
  grants.set(token, { session: input.session, toolUseId: input.toolUseId, ...witness,
    signal: input.signal, authorizationSignal: input.authorizationSignal, approvalCall: input.approvalCall, retire });
  input.signal.addEventListener('abort', retire, { once: true });
  input.authorizationSignal.addEventListener('abort', retire, { once: true });
  input.session.closeSignal.addEventListener('abort', retire, { once: true });
  if (input.signal.aborted || input.authorizationSignal.aborted || input.session.closeSignal.aborted) retire();
  return token;
}

export function consumeDirectoryPublicationAuthorization(token: DirectoryPublicationAuthorization | undefined,
  input: { session: Session; toolUseId: string; lexicalPath: string; content: Uint8Array; signal: AbortSignal;
    authorizationSignal: AbortSignal; approvalCall: PathApprovalCall }): DirectoryWriteWitness {
  const grant = token && grants.get(token);
  if (grant) grant.retire();
  if (!grant || grant.session !== input.session || grant.toolUseId !== input.toolUseId || grant.lexicalPath !== input.lexicalPath ||
      grant.signal !== input.signal || grant.authorizationSignal !== input.authorizationSignal || grant.approvalCall !== input.approvalCall ||
      !input.session.isOpen || input.session.isJournalFenced || input.signal.aborted || input.authorizationSignal.aborted ||
      !input.approvalCall.isActive || input.approvalCall.providerId !== input.toolUseId || grant.content.bytes !== input.content.byteLength ||
      grant.content.sha256 !== createHash('sha256').update(input.content).digest('hex')) throw new Error('Directory publication authorization invalid');
  return { lexicalPath: grant.lexicalPath, content: grant.content, overwrite: grant.overwrite };
}
