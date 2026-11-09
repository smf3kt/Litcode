import { z } from 'zod';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Host FD witness: T$n/EVr/RVr, sfn1dbxq SHA-256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739060,4739632)/[4739632,4740702)/[4740702,4743506), retain pathname mode/parent state.
const decimal = z.string().regex(/^[0-9]+$/);
const legacyObservation = z.object({ dev: decimal, ino: decimal, size: decimal,
  mtimeSeconds: z.string().regex(/^-?[0-9]+$/), mtimeNanoseconds: decimal,
  ctimeSeconds: z.string().regex(/^-?[0-9]+$/), ctimeNanoseconds: decimal }).strict();
export const boundDirectoryFileObservationSchema = legacyObservation.extend({
  mode: z.number().int().min(0).max(0o7777), nlink: z.string().regex(/^[1-9][0-9]*$/),
  parent: z.object({ dev: decimal, ino: decimal }).strict(),
}).strict();
export const directoryFileObservationSchema = z.union([boundDirectoryFileObservationSchema, legacyObservation]);
export type BoundDirectoryFileObservation = z.infer<typeof boundDirectoryFileObservationSchema>;
export const missingDirectoryPublicationSchema = z.object({ kind: z.literal('missing'),
  parent: z.object({ dev: decimal, ino: decimal }).strict(), mode: z.number().int().min(0).max(0o7777) }).strict();
export const directoryPublicationExpectedSchema = z.union([boundDirectoryFileObservationSchema, missingDirectoryPublicationSchema]);
export type DirectoryPublicationExpected = z.infer<typeof directoryPublicationExpectedSchema>;
export type DirectoryPublication =
  | { kind: 'durable'; observation: BoundDirectoryFileObservation }
  | { kind: 'not_published'; detail: string }
  | { kind: 'unknown'; detail: string };
export type DirectoryRemoval = { kind: 'quarantined'; transactionId: string; observation: BoundDirectoryFileObservation } | { kind: 'not_removed'; detail: string } |
  { kind: 'unknown'; transactionId: string; detail: string };
export type DirectoryRetainedPublication =
  | { kind: 'durable'; transactionId: string; observation: BoundDirectoryFileObservation; held: BoundDirectoryFileObservation }
  | { kind: 'not_published'; detail: string }
  | { kind: 'unknown'; transactionId: string; detail: string };
export type DirectoryRetainedObservation = { kind: 'observed'; observation: BoundDirectoryFileObservation } | { kind: 'unknown' };

function parseObservationFields(fields: readonly string[]): BoundDirectoryFileObservation {
  const parsed = boundDirectoryFileObservationSchema.safeParse({ dev: fields[0], ino: fields[1], size: fields[2],
    mtimeSeconds: fields[3], mtimeNanoseconds: fields[4], ctimeSeconds: fields[5], ctimeNanoseconds: fields[6],
    mode: Number(fields[7]), nlink: fields[8], parent: { dev: fields[9], ino: fields[10] } });
  if (fields.length !== 11 || !parsed.success || BigInt(parsed.data.mtimeNanoseconds) >= 1000000000n ||
      BigInt(parsed.data.ctimeNanoseconds) >= 1000000000n) throw new Error('directory file: invalid descriptor observation');
  return parsed.data;
}

export function directoryFileObservationFrame(input: BoundDirectoryFileObservation): string {
  const observed = boundDirectoryFileObservationSchema.parse(input);
  return ['v2', observed.dev, observed.ino, observed.size, observed.mtimeSeconds, observed.mtimeNanoseconds,
    observed.ctimeSeconds, observed.ctimeNanoseconds, observed.mode, observed.nlink, observed.parent.dev, observed.parent.ino].join(':');
}

export function parseDirectoryFileObservationFrame(frame: string): BoundDirectoryFileObservation {
  const [version, ...fields] = frame.split(':');
  if (version !== 'v2') throw new Error('directory file: invalid descriptor observation');
  return parseObservationFields(fields);
}

export function parseStableDirectoryBackupStatus(input: { status: string; bytes: number }): BoundDirectoryFileObservation {
  const lines = input.status.split('\n'), first = lines[0] ?? '';
  const match = /^v2 begin ([0-9]+) ([0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+)$/.exec(first);
  if (!match || lines.length !== 3 || lines[2] !== '' || lines[1] !== first.replace('v2 begin ', 'v2 stable '))
    throw new Error('directory backup: incomplete or unstable descriptor observation');
  const observed = parseObservationFields(match.slice(1));
  if (BigInt(observed.size) !== BigInt(input.bytes))
    throw new Error('directory backup: incomplete or unstable descriptor observation');
  return observed;
}

// T$n, sfn1dbxq [4739060,4739632), UTF-16; the host probes the pinned parent FD.
export function probeMissingDirectoryFile(directory: { fd: number; relative: string; sync?: boolean }): { dev: string; ino: string } | undefined {
  if (process.platform !== 'darwin' && process.platform !== 'linux') return;
  const result = spawnSync(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)), [directory.sync ? '--sync-probe-missing' : '--probe-missing', directory.relative],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore', directory.fd, 'pipe'], timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 4096 });
  if (result.error || result.status !== 0 || result.signal !== null) return;
  const match = /^v1 missing ([0-9]+) ([0-9]+) [0-9]+ -?[0-9]+ ([0-9]+) -?[0-9]+ ([0-9]+)\n$/.exec(result.output[4] ?? '');
  if (!match || BigInt(match[3]!) >= 1000000000n || BigInt(match[4]!) >= 1000000000n) return;
  return { dev: match[1]!, ino: match[2]! };
}

// Host rewrite: Mk/eNe/Yg, 2bcyxj9q [214762,215541), and T$n,
// sfn1dbxq [4739060,4739632), UTF-16, retain paths rather than this FD stream.
export async function copyStableDirectoryFile(
  directory: { readonly fd: number; readonly relative: string },
  destination: fsp.FileHandle,
  signal: AbortSignal,
): Promise<{ bytes: number; sha256: string; metadata: BoundDirectoryFileObservation }> {
  signal.throwIfAborted();
  if (process.platform !== 'darwin' && process.platform !== 'linux') throw new Error('directory backup: unsupported platform');
  const initialDestination = await destination.stat();
  signal.throwIfAborted();
  if (!initialDestination.isFile() || initialDestination.size !== 0) throw new Error('directory backup: destination must be an empty regular file');
  const child = spawn(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)), ['--backup', directory.relative],
    { stdio: ['ignore', 'pipe', 'ignore', directory.fd, 'pipe'] });
  const stdout = child.stdout, statusPipe = child.stdio[4];
  if (!stdout || !statusPipe || !('read' in statusPipe)) { child.kill(); throw new Error('directory backup: helper pipes unavailable'); }
  const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  void exited.catch(() => {});
  const onAbort = () => child.kill('SIGTERM');
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
  let status = '', statusOverflow = false, complete = false;
  statusPipe.on('data', chunk => {
    if (status.length + chunk.length > 2048) { statusOverflow = true; child.kill('SIGTERM'); }
    else status += String(chunk);
  });
  statusPipe.on('error', () => { statusOverflow = true; child.kill('SIGTERM'); });
  try {
    const digest = crypto.createHash('sha256');
    let bytes = 0;
    for await (const part of stdout) {
      signal.throwIfAborted();
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      let offset = 0;
      while (offset < chunk.length) {
        const { bytesWritten } = await destination.write(chunk, offset, chunk.length - offset, bytes + offset);
        signal.throwIfAborted();
        if (bytesWritten <= 0) throw new Error('directory backup: short write');
        offset += bytesWritten;
      }
      bytes += chunk.length;
      if (!Number.isSafeInteger(bytes)) throw new Error('directory backup: file too large');
      digest.update(chunk);
    }
    const code = await exited;
    signal.throwIfAborted();
    if (code !== 0 || statusOverflow) throw new Error('directory backup: incomplete or unstable descriptor observation');
    const metadata = parseStableDirectoryBackupStatus({ status, bytes });
    await destination.sync();
    signal.throwIfAborted();
    const landed = await destination.stat();
    signal.throwIfAborted();
    if (!landed.isFile() || landed.size !== bytes) throw new Error('directory backup: destination size mismatch');
    const expected = digest.digest('hex'), actual = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    for (let position = 0; position < bytes;) {
      const { bytesRead } = await destination.read(buffer, 0, Math.min(buffer.length, bytes - position), position);
      signal.throwIfAborted();
      if (bytesRead <= 0) throw new Error('directory backup: destination short read');
      actual.update(buffer.subarray(0, bytesRead)); position += bytesRead;
    }
    if (actual.digest('hex') !== expected) throw new Error('directory backup: destination digest mismatch');
    complete = true;
    return { bytes, sha256: expected, metadata };
  } finally {
    signal.removeEventListener('abort', onAbort);
    if (!complete) child.kill('SIGTERM');
    stdout.destroy(); statusPipe.destroy();
    await exited.catch(() => {});
  }
}

// Cwt/kVr/EVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4734814,4737243)/[4739632,4740702). The host reads through the
// same stable descriptor protocol as history capture, bounded for preview.
export function readStableDirectoryFile(directory: { fd: number; relative: string; sync?: boolean }, maxBytes: number,
  signal: AbortSignal): { bytes: Buffer; observation: BoundDirectoryFileObservation } | undefined {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('directory read: invalid byte budget');
  if (process.platform !== 'darwin' && process.platform !== 'linux') return;
  const result = spawnSync(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)), [directory.sync ? '--sync-backup' : '--backup', directory.relative],
    { stdio: ['ignore', 'pipe', 'ignore', directory.fd, 'pipe'], timeout: 30000, killSignal: 'SIGKILL', maxBuffer: maxBytes + 4096 });
  signal.throwIfAborted();
  const bytes = result.stdout, status = result.output[4];
  if (result.error || result.status !== 0 || result.signal !== null || !bytes || !status || bytes.length > maxBytes || status.length > 2048) return;
  try { return { bytes, observation: parseStableDirectoryBackupStatus({ status: status.toString('utf8'), bytes: bytes.length }) }; }
  catch { return; }
}

// EVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4740702). Named metadata under checked parent descriptors;
// this observes neither file bytes nor a pinned leaf FD and grants no mutation.
export function observeDirectoryFileMetadata(directory: { fd: number; relative: string }, signal: AbortSignal): BoundDirectoryFileObservation | undefined {
  signal.throwIfAborted();
  if (process.platform !== 'darwin' && process.platform !== 'linux') return;
  const result = spawnSync(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)), ['--sync-named-metadata', directory.relative],
    { stdio: ['ignore', 'ignore', 'ignore', directory.fd, 'pipe'], timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 4096 });
  signal.throwIfAborted();
  const status = result.output[4]?.toString('utf8');
  if (result.error || result.status !== 0 || result.signal !== null || !status) return;
  const lines = status.split('\n'), first = lines[0] ?? '';
  const match = /^v2 metadata_begin ([0-9]+) ([0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+) ([0-9]+)$/.exec(first);
  if (!match || lines.length !== 3 || lines[2] !== '' || lines[1] !== first.replace('metadata_begin', 'metadata_stable')) return;
  try { const observed = parseObservationFields(match.slice(1)); return observed.nlink === '1' ? observed : undefined; }
  catch { return; }
}

// Read-only host evidence for legacy link/unlink publication; EVr/RVr,
// sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4739632,4743506). This result is not a single-link backup or write authority.
export function readLinkedDirectoryPair(directory: { fd: number; relative: string; alias: string }, maxBytes: number,
  signal: AbortSignal): { kind: 'linked-pair'; bytes: Buffer; observation: BoundDirectoryFileObservation } | undefined {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('directory read: invalid byte budget');
  if (process.platform !== 'darwin' && process.platform !== 'linux') return;
  const result = spawnSync(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)),
    ['--sync-linked-pair', directory.relative, directory.alias, '--observe'],
    { stdio: ['ignore', 'pipe', 'ignore', directory.fd, 'pipe'], timeout: 30000, killSignal: 'SIGKILL', maxBuffer: maxBytes + 4096 });
  signal.throwIfAborted();
  const bytes = result.stdout, status = result.output[4];
  if (result.error || result.status !== 0 || result.signal !== null || !bytes || !status || bytes.length > maxBytes || status.length > 2048) return;
  const text = status.toString('utf8');
  if (!text.startsWith('v2 linked_begin ') || !text.includes('\nv2 linked_stable ')) return;
  try {
    const observation = parseStableDirectoryBackupStatus({
      status: text.replace('v2 linked_begin ', 'v2 begin ').replace('\nv2 linked_stable ', '\nv2 stable '), bytes: bytes.length });
    if (observation.nlink !== '2') return;
    return { kind: 'linked-pair', bytes, observation };
  } catch { return; }
}

// Host FD adaptation: US/Xr, bf3z2ftn [15698,15966)/[15966,20119), and
// pPe/sC, f606a53w [7111,7501)/[12501,15618), UTF-16; Session owns commit authority.
export function publishDirectoryFile(input: { fd: number; relative: string; expected: DirectoryPublicationExpected;
  content: Uint8Array; mode?: number; leaseFd?: number; receiptFd?: number }): DirectoryPublication {
  const expected = directoryPublicationExpectedSchema.parse(input.expected), content = Buffer.from(input.content);
  const missing = 'kind' in expected;
  const mode = input.mode === undefined ? expected.mode : boundDirectoryFileObservationSchema.shape.mode.parse(input.mode);
  const frame = missing ? `missing:${expected.parent.dev}:${expected.parent.ino}` : directoryFileObservationFrame(expected);
  if (process.platform !== 'darwin' && process.platform !== 'linux') return { kind: 'not_published', detail: 'directory write: unsupported platform' };
  const result = spawnSync(fileURLToPath(new URL('../native/directory-write/write', import.meta.url)),
    [...(input.receiptFd === undefined ? [] : ['--receipt']), input.relative, String(content.length), frame, ...(missing || input.mode !== undefined ? [String(mode)] : [])],
    { input: content, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', 'ignore', input.receiptFd ?? 'ignore'],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '';
  const complete = /^start\nstaging\npublishing\ncommitting\nrenamed\nlanded (v2:[^\n]+)\ndurable\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && complete) {
    try {
      const observation = parseDirectoryFileObservationFrame(complete[1] ?? '');
      if (BigInt(observation.size) === BigInt(content.length) && observation.mode === mode && observation.nlink === '1' &&
          observation.parent.dev === expected.parent.dev && observation.parent.ino === expected.parent.ino)
        return { kind: 'durable', observation };
    } catch { /* A successful exit without complete descriptor evidence remains unknown. */ }
  }
  const lines = status.split('\n');
  const detail = `directory write: ${result.error?.message ?? (status.trim() || `native writer exit ${result.status ?? result.signal}`)}`;
  if (result.status !== 0 && /(?:^|\n)error not_renamed [0-9]+\n$/.test(status) &&
      !lines.includes('committing') && !lines.includes('renamed') && !lines.some(line => line.startsWith('landed ')))
    return { kind: 'not_published', detail };
  return { kind: 'unknown', detail };
}

// Host rewrite: uno/pPe/sC, sfn1dbxq [739599,743280), f606a53w [7111,7501)/[12501,15618), UTF-16.
// Retained paths and observations must be revalidated by a later owner-bound transaction.
export function publishRetainedDirectoryFile(input: { fd: number; relative: string; expected: BoundDirectoryFileObservation;
  expectedFd: number; content: Uint8Array; transactionId: string; leaseFd?: number; restoreMode?: number; receiptFd?: number }): DirectoryRetainedPublication {
  const expected = boundDirectoryFileObservationSchema.parse(input.expected);
  // RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
  // UTF-16 [4740702,4743506): restoration uses backup mode, ordinary Write preserves target mode.
  const mode = input.restoreMode === undefined ? expected.mode : boundDirectoryFileObservationSchema.shape.mode.parse(input.restoreMode);
  const transactionId = z.string().uuid().parse(input.transactionId), content = Buffer.from(input.content);
  if (process.platform !== 'darwin') return { kind: 'not_published', detail: 'directory retained write: unsupported platform' };
  const result = spawnSync(fileURLToPath(new URL('../native/directory-write/write', import.meta.url)),
    [...(input.receiptFd === undefined ? [] : ['--receipt']), input.restoreMode === undefined ? '--replace-retained' : '--restore-retained', input.relative, String(content.length),
      directoryFileObservationFrame(expected), transactionId, ...(input.restoreMode === undefined ? [] : [String(mode)]), '--execute'],
    { input: content, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.expectedFd, input.receiptFd ?? 'ignore'],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '';
  const complete = /^start\nstaging\nchecking\ncapturing\ncaptured\npublishing\nrenamed\nheld (v2:[^\n]+)\nlanded (v2:[^\n]+)\ndurable\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && complete) {
    try {
      const held = parseDirectoryFileObservationFrame(complete[1] ?? ''), observation = parseDirectoryFileObservationFrame(complete[2] ?? '');
      if (held.dev === expected.dev && held.ino === expected.ino && held.size === expected.size && held.mode === expected.mode &&
          held.nlink === '1' && held.mtimeSeconds === expected.mtimeSeconds && held.mtimeNanoseconds === expected.mtimeNanoseconds &&
          BigInt(observation.size) === BigInt(content.length) && observation.mode === mode && observation.nlink === '1' &&
          observation.parent.dev === expected.parent.dev && observation.parent.ino === expected.parent.ino)
        return { kind: 'durable', transactionId, observation, held };
    } catch { /* An incomplete descriptor witness remains unknown. */ }
  }
  const detail = `directory retained write: ${result.error?.message ?? (status.trim() || `native writer exit ${result.status ?? result.signal}`)}`;
  if (result.status !== 0 && /(?:^|\n)error not_published [0-9]+\n$/.test(status) && !status.split('\n').includes('staging'))
    return { kind: 'not_published', detail };
  return { kind: 'unknown', transactionId, detail };
}

// Host rewrite: RVr, sfn1dbxq [4740702,4743506), UTF-16; the observation does not authorize a later effect.
export function observeRetainedDirectoryFile(input: { fd: number; relative: string; expected: BoundDirectoryFileObservation;
  expectedFd: number; transactionId: string; leaseFd?: number;
  archive?: { fd: number; parent: BoundDirectoryFileObservation['parent']; move: boolean; kind?: 'remove' | 'replace' } }): DirectoryRetainedObservation {
  const expected = directoryFileObservationFrame(input.expected), transactionId = z.string().uuid().parse(input.transactionId);
  if (process.platform !== 'darwin') return { kind: 'unknown' };
  const archiveTarget = input.archive?.kind === 'remove' ? 'removed' : 'retained';
  const command = input.archive ? `--${input.archive.move ? 'archive' : 'locate'}-${archiveTarget}`
    : input.leaseFd === undefined ? '--observe-retained' : '--observe-unarchived';
  const result = spawnSync(fileURLToPath(new URL('../native/directory-write/write', import.meta.url)),
    [command, input.relative, expected, transactionId,
      ...(input.archive ? [`missing:${input.archive.parent.dev}:${input.archive.parent.ino}`] : []), '--execute'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.expectedFd, 'ignore', input.archive?.fd ?? 'ignore'],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 4096 });
  const complete = `start\n${input.archive?.move ? 'archived' : 'observed'} ${expected}\n`;
  if (!result.error && result.status === 0 && result.signal === null && result.output[4] === complete)
    return { kind: 'observed', observation: parseDirectoryFileObservationFrame(expected) };
  return { kind: 'unknown' };
}

// Host captured-state continuation of RVr, sfn1dbxq
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4740702,4743506). The caller must durably bind this exact intermediate
// state and current authority before invoking native; this creates no grant.
export function publishCapturedDirectoryFile(input: { fd: number; relative: string;
  parent: BoundDirectoryFileObservation['parent']; held: BoundDirectoryFileObservation; staged: BoundDirectoryFileObservation;
  originalFd: number; desiredFd: number; transactionId: string; leaseFd?: number; receiptFd?: number }): DirectoryRetainedPublication {
  const parent = boundDirectoryFileObservationSchema.shape.parent.parse(input.parent);
  const held = boundDirectoryFileObservationSchema.parse(input.held), staged = boundDirectoryFileObservationSchema.parse(input.staged);
  const transactionId = z.string().uuid().parse(input.transactionId);
  if (held.nlink !== '1' || staged.nlink !== '1' || held.parent.dev !== staged.parent.dev || held.parent.ino !== staged.parent.ino ||
      (held.dev === staged.dev && held.ino === staged.ino)) return { kind: 'not_published', detail: 'captured publication: invalid retained identity' };
  if (process.platform !== 'darwin') return { kind: 'not_published', detail: 'captured publication: unsupported platform' };
  const missing = `missing:${parent.dev}:${parent.ino}`, heldFrame = directoryFileObservationFrame(held), stagedFrame = directoryFileObservationFrame(staged);
  const result = spawnSync(fileURLToPath(new URL('../native/directory-write/write', import.meta.url)),
    [...(input.receiptFd === undefined ? [] : ['--receipt']), '--publish-captured', input.relative, missing, heldFrame, stagedFrame, transactionId, '--execute'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.originalFd,
      input.receiptFd ?? 'ignore', input.desiredFd], timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '';
  const complete = /^start\nchecking\nresume ([^\n ]+) ([^\n ]+) ([^\n ]+)\npublishing\nrenamed\nheld (v2:[^\n]+)\nlanded (v2:[^\n]+)\ndurable\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && complete &&
      complete[1] === missing && complete[2] === heldFrame && complete[3] === stagedFrame && complete[4] === heldFrame) {
    try {
      const observation = parseDirectoryFileObservationFrame(complete[5]!);
      if (observation.dev === staged.dev && observation.ino === staged.ino && observation.size === staged.size && observation.mode === staged.mode &&
          observation.nlink === '1' && observation.mtimeSeconds === staged.mtimeSeconds && observation.mtimeNanoseconds === staged.mtimeNanoseconds &&
          observation.parent.dev === parent.dev && observation.parent.ino === parent.ino)
        return { kind: 'durable', transactionId, held, observation };
    } catch { /* A changed or incomplete native observation remains unknown. */ }
  }
  const detail = `captured publication: ${result.error?.message ?? (status.trim() || `native writer exit ${result.status ?? result.signal}`)}`;
  if (!result.error && result.signal === null && result.status !== 0 && /(?:^|\n)error not_published [0-9]+\n$/.test(status) &&
      !status.split('\n').includes('renamed')) return { kind: 'not_published', detail };
  return { kind: 'unknown', transactionId, detail };
}

// Host FD adaptation: kVr/EVr, sfn1dbxq [4735645,4737243)/[4739632,4740702), UTF-16.
// The caller must persist the transaction ID and supply independently verified bytes.
// A quarantined inode remains mutable and must be revalidated before reconciliation.
export function removeDirectoryFile(input: { fd: number; relative: string; expected: BoundDirectoryFileObservation;
  expectedBytes: Uint8Array; transactionId: string; leaseFd?: number; receiptFd?: number }): DirectoryRemoval {
  const expected = boundDirectoryFileObservationSchema.parse(input.expected);
  const transactionId = z.string().uuid().parse(input.transactionId), bytes = Buffer.from(input.expectedBytes);
  if (BigInt(expected.size) !== BigInt(bytes.length)) return { kind: 'not_removed', detail: 'directory remove: witness size mismatch' };
  if (process.platform !== 'darwin' && process.platform !== 'linux') return { kind: 'not_removed', detail: 'directory remove: unsupported platform' };
  const result = spawnSync(fileURLToPath(new URL('../native/directory-write/write', import.meta.url)),
    [...(input.receiptFd === undefined ? [] : ['--receipt']), '--remove', input.relative, directoryFileObservationFrame(expected), transactionId, '--execute'],
    { input: bytes, encoding: 'utf8', stdio: ['pipe', 'ignore', 'pipe', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', 'ignore', input.receiptFd ?? 'ignore'],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '';
  const complete = /^start\nchecking\ncommitting\ncaptured\nheld (v2:[^\n]+)\nquarantined\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && complete) {
    try {
      const observation = parseDirectoryFileObservationFrame(complete[1] ?? '');
      if (observation.dev === expected.dev && observation.ino === expected.ino && observation.size === expected.size &&
          observation.mode === expected.mode && observation.nlink === '1' && observation.mtimeSeconds === expected.mtimeSeconds &&
          observation.mtimeNanoseconds === expected.mtimeNanoseconds) return { kind: 'quarantined', transactionId, observation };
    } catch { /* Incomplete descriptor evidence remains unknown. */ }
  }
  const detail = `directory remove: ${result.error?.message ?? (status.trim() || `native writer exit ${result.status ?? result.signal}`)}`;
  if (result.status !== 0 && /(?:^|\n)error not_removed [0-9]+\n$/.test(status) &&
      !status.split('\n').includes('committing') && !status.split('\n').includes('removed')) return { kind: 'not_removed', detail };
  return { kind: 'unknown', transactionId, detail };
}
