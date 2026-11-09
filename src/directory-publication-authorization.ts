import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { types as utilTypes } from 'node:util';
import { z } from 'zod';
import type { Session } from './session.js';
import type { PathApprovalCall } from './path-approval-call-owner.js';
import { decodeFileBytes } from './path-approval-decoder-source.js';
import { ZMe, lns, Rnt } from './edit-match-source.js';
import { applyEdit } from './diff-patch.js';
import { notebookEditSchema, renderNotebookEdit, NOTEBOOK_MAX_BYTES } from './notebook-edit.js';

export const directoryWriteInputSchema = z.object({ path: z.string().min(1), content: z.string(), overwrite: z.boolean().optional() }).strict();
export const directoryEditInputSchema = z.object({
  path: z.string().min(1), old_string: z.string().min(1), new_string: z.string(), replace_all: z.boolean().optional(),
}).strict();
export type DirectoryPublicationAuthorization = object;
export type DirectoryWriteWitness = { lexicalPath: string; content: { bytes: number; sha256: string }; overwrite: boolean };
const notebookPublicationInput = notebookEditSchema.extend({ insertId: z.string().regex(/^[0-9a-f]{8}$/).optional() })
  .refine(value => (value.edit_mode === 'insert') === (value.insertId !== undefined));
export const publicationEditSchema = z.union([directoryEditInputSchema, notebookPublicationInput]);
type EditInput = z.infer<typeof publicationEditSchema>;
type Grant = { session: Session; toolUseId: string; lexicalPath: string; witness: DirectoryWriteWitness | { edit: EditInput };
  signal: AbortSignal; authorizationSignal: AbortSignal; approvalCall: PathApprovalCall; retire: () => void };
const grants = new WeakMap<DirectoryPublicationAuthorization, Grant>();

function isDataObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || utilTypes.isProxy(value) || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
  return (prototype === Object.prototype || prototype === null) && Object.values(descriptors).every(descriptor => 'value' in descriptor);
}

// sjr, sfn1dbxq [4167188,4171835), UTF-16: associate the actual Edit arguments
// with its resolved path. JSON also preserves unmatched UTF-16 surrogates.
export function prepareNotebookPublication(value: unknown) {
  if (!isDataObject(value)) return;
  const parsed = notebookEditSchema.safeParse(value);
  if (!parsed.success) return;
  return { ...parsed.data, ...(parsed.data.edit_mode === 'insert' ? { insertId: randomUUID().slice(0, 8) } : {}) };
}

export function describeDirectoryEditInput(session: Session, value: unknown) {
  if (!isDataObject(value)) return;
  const parsed = publicationEditSchema.safeParse(value);
  if (!parsed.success) return;
  if ('new_source' in parsed.data) {
    const {path: userPath, cell_id, new_source, cell_type, edit_mode = 'replace', insertId} = parsed.data;
    const lexicalPath = path.resolve(session.config.workspace, userPath);
    const digest = createHash('sha256').update(JSON.stringify(['notebook_edit', lexicalPath, cell_id, new_source, cell_type, edit_mode, insertId])).digest('hex');
    return { lexicalPath, digest, tool: 'notebook_edit' as const };
  }
  const { path: userPath, old_string, new_string, replace_all = false } = parsed.data;
  const lexicalPath = path.resolve(session.config.workspace, userPath);
  const digest = createHash('sha256').update(JSON.stringify(['edit_file', lexicalPath, old_string, new_string, replace_all])).digest('hex');
  return { lexicalPath, digest, tool: 'edit_file' as const };
}

export function describeDirectoryWriteInput(session: Session, value: unknown): DirectoryWriteWitness | undefined {
  if (!isDataObject(value)) return;
  const parsed = directoryWriteInputSchema.safeParse(value);
  if (!parsed.success) return;
  const content = Buffer.from(parsed.data.content);
  return { lexicalPath: path.resolve(session.config.workspace, parsed.data.path),
    content: { bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') }, overwrite: parsed.data.overwrite === true };
}

export function directoryWriteFingerprint(witness: DirectoryWriteWitness): string {
  return createHash('sha256').update(JSON.stringify(witness)).digest('hex');
}

// sjr [4167188,4171835), o8e/pPe [7016,7501), UTF-16. Replay against
// authenticated original bytes at the publication boundary and on cold recovery.
export function renderFileEdit(decoded: ReturnType<typeof decodeFileBytes>, input: z.infer<typeof directoryEditInputSchema>, match: string) {
  const replacement = lns(input.old_string, match, Rnt(input.old_string, match, input.new_string));
  const { updatedFile: updated, patch } = applyEdit(input.path, decoded.content, match, replacement, input.replace_all ?? false);
  const written = decoded.lineEndings === 'CRLF' ? updated.replaceAll('\r\n', '\n').split('\n').join('\r\n') : updated;
  return { updated, patch, bytes: Buffer.from(written, decoded.encoding === 'utf16le' ? 'utf16le' : 'utf8') };
}

export function directoryEditContent(original: Buffer, input: EditInput) {
  const decoded = decodeFileBytes(original);
  if ('new_source' in input) {
    if (original.length > NOTEBOOK_MAX_BYTES || !input.path.toLowerCase().endsWith('.ipynb')) throw new Error('Invalid notebook backup');
    return renderNotebookEdit(decoded, input, input.path, () => {
      if (!input.insertId) throw new Error('Missing authorized notebook cell ID');
      return input.insertId;
    }).serialized;
  }
  const match = ZMe(decoded.content, input.old_string);
  if (decoded.lossyDecode || !match || (!input.replace_all && decoded.content.indexOf(match, decoded.content.indexOf(match) + match.length) !== -1))
    throw new Error('Directory edit does not apply to backup');
  return renderFileEdit(decoded, input, match).bytes;
}

// Host capability: uno and m_t/_Wo, sfn1dbxq [739599,743280)/[504681,505531)/[2237279,2239655), UTF-16.
export function issueDirectoryPublicationAuthorization(input: { session: Session; toolUseId: string; value: unknown; tool?: 'edit_file' | 'notebook_edit';
  signal: AbortSignal; authorizationSignal: AbortSignal; approvalCall: PathApprovalCall }): DirectoryPublicationAuthorization | undefined {
  const edit = input.tool && describeDirectoryEditInput(input.session, input.value);
  const witness = edit && edit.tool === input.tool ? { lexicalPath: edit.lexicalPath, edit: publicationEditSchema.parse(input.value) }
    : input.tool === undefined ? describeDirectoryWriteInput(input.session, input.value) : undefined;
  if (!witness || !input.session.isOpen || input.session.isJournalFenced || input.signal.aborted || input.authorizationSignal.aborted ||
      !input.approvalCall.isActive || input.approvalCall.providerId !== input.toolUseId) return;
  const token = {};
  const retire = () => {
    grants.delete(token);
    input.signal.removeEventListener('abort', retire);
    input.authorizationSignal.removeEventListener('abort', retire);
    input.session.closeSignal.removeEventListener('abort', retire);
  };
  grants.set(token, { session: input.session, toolUseId: input.toolUseId, lexicalPath: witness.lexicalPath, witness,
    signal: input.signal, authorizationSignal: input.authorizationSignal, approvalCall: input.approvalCall, retire });
  input.signal.addEventListener('abort', retire, { once: true });
  input.authorizationSignal.addEventListener('abort', retire, { once: true });
  input.session.closeSignal.addEventListener('abort', retire, { once: true });
  if (input.signal.aborted || input.authorizationSignal.aborted || input.session.closeSignal.aborted) retire();
  return token;
}

export function consumeDirectoryPublicationAuthorization(token: DirectoryPublicationAuthorization | undefined,
  input: { session: Session; toolUseId: string; lexicalPath: string; content: Uint8Array; signal: AbortSignal; backupId?: string;
    authorizationSignal: AbortSignal; approvalCall: PathApprovalCall }): DirectoryWriteWitness & { edit?: EditInput } {
  const grant = token && grants.get(token);
  if (grant) grant.retire();
  if (!grant || grant.session !== input.session || grant.toolUseId !== input.toolUseId || grant.lexicalPath !== input.lexicalPath ||
      grant.signal !== input.signal || grant.authorizationSignal !== input.authorizationSignal || grant.approvalCall !== input.approvalCall ||
      !input.session.isOpen || input.session.isJournalFenced || input.signal.aborted || input.authorizationSignal.aborted ||
      !input.approvalCall.isActive || input.approvalCall.providerId !== input.toolUseId) throw new Error('Directory publication authorization invalid');
  const content = { bytes: input.content.byteLength, sha256: createHash('sha256').update(input.content).digest('hex') };
  if ('edit' in grant.witness) {
    const original = input.backupId && input.session.readDirectoryBackup(input.backupId);
    if (!original || !directoryEditContent(original, grant.witness.edit).equals(input.content)) throw new Error('Directory edit publication output mismatch');
    return { lexicalPath: grant.lexicalPath, content, overwrite: true, edit: grant.witness.edit };
  }
  if (grant.witness.content.bytes !== content.bytes || grant.witness.content.sha256 !== content.sha256) throw new Error('Directory publication authorization invalid');
  return grant.witness;
}
