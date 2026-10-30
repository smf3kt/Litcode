import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { confineResolved, type ToolContext, type ToolDefinition } from './tools.js';
import { permissionDecision, type PermissionPolicy } from './permissions.js';
import { resolveChain, verifyIdentity, type ResolvedPath } from './path-identity.js';
import { Bn, Jy, yCo } from './peer-file-path-source.js';
import { refundablePeerSend, type LocalPeerTransport } from './local-peer.js';

// J9/XJ/BNn, edq7enfd [712,887), UTF-16.
export const PEER_FILE_MAX_BYTES = 30 * 1024 * 1024;
export const PEER_FILE_MAX_COUNT = 16;
const spoolName = 'file-transfers';
export const peerFileSchema = z.object({ path: z.string(), file_name: z.string(),
  file_size: z.number().int().nonnegative(), sha256: z.string().regex(/^[0-9a-f]{64}$/), media_type: z.string().optional() });
export type PeerFile = z.infer<typeof peerFileSchema>;
export type PeerFileHost = { workspace: string; sessionId: string };
export type PeerFileToolOptions = { userDir: string; enabled: () => boolean; permissions: () => PermissionPolicy | undefined };
const inputSchema = z.object({ address: z.string().min(1), files: z.preprocess(value => typeof value === 'string' ? [value] : value,
  z.array(z.string().min(1)).min(1).max(PEER_FILE_MAX_COUNT)), message: z.string().optional() }).strict();
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
// et, wh2vcbh8 [3533,4062), UTF-16; host confinement resolves the relative form.
function normalizePeerFilePath(value: string): string {
  const file = value.trim();
  return file === '~' ? os.homedir() : file.startsWith('~/') ? path.join(os.homedir(), file.slice(2)) : file;
}

// AGe/dEn/uEn/pEn, cyvb4eds [1601,2097), UTF-16.
export function sanitizePeerFileName(value: string): string {
  const name = path.basename(value).replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
  const index = name.lastIndexOf('.'), extension = index > 0 && name.length - index <= 16 ? name.slice(index) : '';
  const stem = extension ? name.slice(0, index) : name;
  const limit = 200 - extension.length;
  return (stem.length > limit ? stem.slice(0, limit) : stem) + extension;
}
export function peerFileFailureNote(file: string, reason: string): string {
  return `[SendFile: "${sanitizePeerFileName(file)}" was not delivered — ${reason}]`;
}
export function peerFileCountNote(count: number): string {
  return `[SendFile: ${count} additional attachment(s) were dropped — max ${PEER_FILE_MAX_COUNT} per message]`;
}
export function verifyPeerFileIntegrity(bytes: Buffer, file: PeerFile): boolean {
  if (typeof file.file_size === 'number' && bytes.length !== file.file_size) return false;
  return digest(bytes) === file.sha256;
}

// QX, cyvb4eds [2319,2639), Jv/Wrn, bf3z2ftn [6350,6642)/[6868,6932), UTF-16.
export async function readPeerFileBounded(file: string, limit = PEER_FILE_MAX_BYTES, resolved?: ResolvedPath): Promise<Buffer | null> {
  try { const stat = await fsp.stat(file); if (!stat.isFile() || stat.size > limit) return null; } catch { return null; }
  let handle;
  try { handle = await fsp.open(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW); } catch { return null; }
  try {
    const stat = await handle.stat({ bigint: true });
    if (!stat.isFile() || stat.size > limit) return null;
    // lj, gyf58rwf [69060,69737), UTF-16; keep the host Read identity on the opened handle.
    if (resolved !== undefined) {
      const identity = resolved.identity;
      if (identity === undefined || String(stat.dev) !== identity.dev || String(stat.ino) !== identity.ino
        || String(stat.ctimeMs) !== identity.ctimeMs || Number(stat.size) !== identity.size) return null;
      const current = resolveChain(path.parse(file).root, file);
      if (current.path !== resolved.path || current.hops.length !== resolved.hops.length
        || current.hops.some((hop, index) => hop.link !== resolved.hops[index]?.link || hop.target !== resolved.hops[index]?.target)) return null;
    }
    const cap = limit + 1;
    let bytes = Buffer.alloc(Math.min(Math.max(Number(stat.size) + 1, 1), cap)), offset = 0;
    while (offset < cap) {
      if (offset === bytes.length) { const grown = Buffer.alloc(cap); bytes.copy(grown); bytes = grown; }
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    return offset > limit ? null : bytes.subarray(0, offset);
  } catch { return null; } finally { await handle.close().catch(() => {}); }
}

// f3r/Bn/Jy, c38jjqy6 [3564,4269), ae84tp6z [7436,7484)/[11730,11779), UTF-16.
export function validatePeerFilePath(file: string): void {
  if (/^[a-z][a-z0-9+.-]+:\/\//i.test(file) || /^[\\/]{2}/.test(file) || file.includes('\0')) throw new Error('Expected an ordinary local file path');
  if (Bn(file) || Jy(file) || yCo(file, process.platform)) throw new Error('Peer files must use an ordinary local directory');
}

// J/OZe, c38jjqy6 [2121,3155), UTF-16.
const mediaTypes: Readonly<Record<string, string>> = {
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.bmp':'image/bmp','.ico':'image/x-icon','.heic':'image/heic','.heif':'image/heif','.avif':'image/avif','.tif':'image/tiff','.tiff':'image/tiff',
  '.mp4':'video/mp4','.m4v':'video/x-m4v','.mov':'video/quicktime','.webm':'video/webm','.avi':'video/x-msvideo','.mkv':'video/x-matroska','.mp3':'audio/mpeg','.m4a':'audio/mp4','.wav':'audio/wav','.ogg':'audio/ogg','.aac':'audio/aac','.flac':'audio/flac',
  '.pdf':'application/pdf','.txt':'text/plain','.log':'text/plain','.md':'text/markdown','.json':'application/json','.csv':'text/csv','.html':'text/html','.htm':'text/html','.xml':'application/xml',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.zip':'application/zip',
};
export function peerTransferSpool(userDir: string): string { return path.join(userDir, spoolName); }

// d3r/u3r, cyvb4eds [2977,3516), UTF-16.
export async function stageLocalPeerFile(file: string, userDir: string, resolved?: ResolvedPath): Promise<PeerFile> {
  const bytes = await readPeerFileBounded(file, PEER_FILE_MAX_BYTES, resolved);
  if (bytes === null) throw new Error(`File could not be read, is not regular, or exceeds the ${PEER_FILE_MAX_BYTES / 1048576} MiB transfer limit`);
  const sha256 = digest(bytes), directory = peerTransferSpool(userDir), name = path.basename(file);
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, `${sha256.slice(0, 8)}-${randomUUID().slice(0, 8)}-${sanitizePeerFileName(name)}`);
  await fsp.writeFile(target, bytes, { mode: 0o600 });
  return { path: target, file_name: name, file_size: bytes.length, sha256,
    ...(mediaTypes[path.extname(name).toLowerCase()] === undefined ? {} : { media_type: mediaTypes[path.extname(name).toLowerCase()] }) };
}
export async function sweepPeerFileSpool(userDir: string): Promise<void> {
  const directory = peerTransferSpool(userDir);
  try {
    const names = await fsp.readdir(directory), cutoff = Date.now() - 86400000;
    for (const name of names.slice(0, 200)) {
      const file = path.join(directory, name);
      try { const stat = await fsp.stat(file); if (stat.isFile() && stat.mtimeMs < cutoff) await fsp.unlink(file); } catch {}
    }
  } catch {}
}

// jL/G2s, prwvydmp [792,873), cyvb4eds [3556,4858), UTF-16; uploads stay in the host workspace.
export function peerUploadDirectory(host: PeerFileHost): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(host.sessionId)) throw new Error('Invalid peer upload session');
  return path.join(host.workspace, '.harness', 'peer-uploads', host.sessionId);
}
async function prepareUploads(host: PeerFileHost): Promise<string> {
  let current = fs.realpathSync(host.workspace);
  for (const segment of ['.harness', 'peer-uploads', host.sessionId]) {
    current = path.join(current, segment);
    await fsp.mkdir(current, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const stat = await fsp.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Peer uploads require regular workspace directories');
  }
  return current;
}
export async function materializeLocalPeerFiles(value: unknown, userDir: string, host: PeerFileHost): Promise<{ prefix: string; received: number; verified: number }> {
  const parsed = z.array(peerFileSchema).safeParse(value);
  if (!parsed.success || !parsed.data.length) return { prefix: '', received: 0, verified: 0 };
  const notes: string[] = [], references: string[] = [];
  let files = parsed.data, verified = 0, uploads: string | undefined;
  if (files.length > PEER_FILE_MAX_COUNT) { notes.push(peerFileCountNote(files.length - PEER_FILE_MAX_COUNT)); files = files.slice(0, PEER_FILE_MAX_COUNT); }
  const spool = peerTransferSpool(userDir);
  for (const file of files) {
    const fail = (reason: string) => { notes.push(peerFileFailureNote(file.file_name, reason)); };
    let target: string;
    try {
      validatePeerFilePath(file.path);
      if (!path.isAbsolute(file.path)) throw new Error('relative');
      target = path.resolve(file.path);
      validatePeerFilePath(target);
    } catch { fail('invalid transfer path'); continue; }
    const parent = path.dirname(target);
    if (path.basename(parent) !== spoolName) { fail('transfer path is outside the file-transfer spool'); continue; }
    try { if (!(await fsp.lstat(parent)).isDirectory() || !(await fsp.lstat(target)).isFile()) { fail('the transfer copy is not a regular file'); continue; } }
    catch { fail('the transfer copy could not be read (it may have expired)'); continue; }
    const bytes = await readPeerFileBounded(target);
    if (bytes === null) { fail('the transfer copy could not be read (it may have expired)'); continue; }
    if (!verifyPeerFileIntegrity(bytes, file)) { fail('it failed integrity verification'); continue; }
    let destination: string;
    try {
      peerUploadDirectory(host);
      uploads ??= await prepareUploads(host);
      destination = path.join(uploads, `${file.sha256.slice(0, 8)}-${randomUUID().slice(0, 8)}-${sanitizePeerFileName(file.file_name)}`);
      await fsp.writeFile(destination, bytes, { mode: 0o600, flag: 'wx' });
    } catch { fail('it could not be written to the uploads directory'); continue; }
    verified++;
    references.push(`@"${path.relative(host.workspace, destination)}"`);
    if (parent === spool) await fsp.unlink(target).catch(() => {});
  }
  const all = [...references, ...notes];
  return { prefix: all.length ? all.join(' ') + ' ' : '', received: files.length, verified };
}

// Per, cyvb4eds [2639,2764), UTF-16.
export function injectPeerFilePrefix(text: string, prefix: string): string {
  if (!prefix) return text;
  const opening = /^<cross-session-message\b[^>]*>\n?/.exec(text);
  return opening ? opening[0] + prefix + text.slice(opening[0].length) : prefix + text;
}

// sl, 08fpxsaf [615,846), UTF-16.
function stageLimiter(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <T>(run: () => Promise<T>): Promise<T> => {
    if (active < limit) active++; else await new Promise<void>(resolve => waiting.push(resolve));
    try { return await run(); } finally { const next = waiting.shift(); if (next) next(); else active--; }
  };
}

export const peerFileToolSchema: ToolDefinition['schema'] = {
  name: 'send_peer_files', description: 'Send up to 16 local files, each at most 30 MiB, to a same-host uds: session. Each file is checked against Read permissions and copied before delivery. The recipient may hold the message for approval.',
  input_schema: { type: 'object', properties: { address: { type: 'string', minLength: 1 }, files: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, maxItems: PEER_FILE_MAX_COUNT }, message: { type: 'string' } }, required: ['address', 'files'], additionalProperties: false },
};

// SendFileTool.we, 8t44px9f [22797,31590), UTF-16; only the local transport arm is admitted.
export function createLocalPeerFileTool(transport: LocalPeerTransport, options: PeerFileToolOptions): ToolDefinition {
  const stage = stageLimiter(4);
  const readProbe: ToolDefinition = { readOnly: true, schema: { name: 'read_file', input_schema: { type: 'object' } }, execute: async () => '' };
  return {
    readOnly: false,
    readPaths: input => inputSchema.parse(input).files.map(normalizePeerFilePath),
    schema: structuredClone(peerFileToolSchema),
    async execute(input, context) {
      context.signal.throwIfAborted();
      if (!options.enabled()) throw new Error('Local peer file transfer is disabled');
      const args = inputSchema.parse(input);
      const files = args.files.map(normalizePeerFilePath);
      if (!args.address.startsWith('uds:') || args.address === transport.address) throw new Error('Expected another same-host uds: session');
      for (const file of files) {
        validatePeerFilePath(file);
        const decision = permissionDecision(options.permissions(), readProbe, { path: file }, undefined, context.workspace);
        if (decision.decision === 'deny') throw new Error(decision.reason ?? 'Read denied');
      }
      const outcomes: Array<{ path: string; size?: number; sha256?: string; error?: string }> = Array(args.files.length);
      const staged = await Promise.all(files.map((file, index) => stage(async () => {
        const absolute = path.resolve(context.workspace, file);
        if (context.signal.aborted) { outcomes[index] = { path: absolute, error: 'aborted' }; return; }
        try {
          const resolved = confineResolved(context.workspace, path.isAbsolute(file) ? path.relative(context.workspace, file) : file, true, context.workingDirectories?.(true));
          validatePeerFilePath(resolved.path); verifyIdentity(resolved);
          const decision = permissionDecision(options.permissions(), readProbe, { path: resolved.path }, undefined, context.workspace);
          if (decision.decision === 'deny' || resolved.path !== absolute && decision.decision !== 'allow')
            throw new Error(decision.reason ?? 'Resolved file requires Read approval');
          const copy = await stageLocalPeerFile(absolute, options.userDir, resolved);
          outcomes[index] = { path: absolute, size: copy.file_size, sha256: copy.sha256 };
          return copy;
        } catch (error) { outcomes[index] = { path: absolute, error: error instanceof Error ? error.message : String(error) }; }
      })));
      void sweepPeerFileSpool(options.userDir);
      const copies = staged.filter((file): file is PeerFile => file !== undefined);
      const cleanup = async () => { await Promise.all(copies.map(file => fsp.unlink(file.path).catch(() => {}))); };
      if (context.signal.aborted) { await cleanup(); context.signal.throwIfAborted(); }
      if (!copies.length) return JSON.stringify({ success: false, message: `No files could be staged for transfer to ${args.address}.`, files: outcomes });
      const text = args.message?.trim() ? args.message : `Sent you ${copies.length} ${copies.length === 1 ? 'file' : 'files'}: ${copies.map(file => file.file_name).join(', ')}`;
      try {
        const sent = await transport.send(args.address, text, { signal: context.signal, fileAttachments: copies });
        return JSON.stringify({ success: true, message: `${copies.length} ${copies.length === 1 ? 'file' : 'files'} sent to ${args.address}`, msg_id: sent.msgId, files: outcomes });
      } catch (error) {
        if (refundablePeerSend(error)) await cleanup();
        return JSON.stringify({ success: false, message: `Failed to send to ${args.address}: ${error instanceof Error ? error.message : String(error)}`, files: outcomes });
      }
    },
  };
}
