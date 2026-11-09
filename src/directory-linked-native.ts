import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { boundDirectoryFileObservationSchema, directoryFileObservationFrame, parseDirectoryFileObservationFrame,
  type BoundDirectoryFileObservation } from './directory-file-state.js';

// Host retained-pair adaptation of RVr, sfn1dbxq
// 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
// UTF-16 [4740702,4743506), and sC f606a53w
// dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033,
// UTF-16 [12501,15618). The caller persists intent and binds current authority.
// A normalized result retains the old pair; it is not an ordinary write receipt.
export type LinkedNormalizationResult =
  | { kind: 'normalized'; transactionId: string; held: BoundDirectoryFileObservation; observation: BoundDirectoryFileObservation }
  | { kind: 'not_normalized'; detail: string }
  | { kind: 'unknown'; transactionId: string; detail: string };
const executable = fileURLToPath(new URL('../native/directory-write/write', import.meta.url));
const aliasSchema = z.string().regex(/^\.litcode-tmp-[0-9]+-[0-9]+$/);
const origin = (a: BoundDirectoryFileObservation, b: BoundDirectoryFileObservation) =>
  a.dev === b.dev && a.ino === b.ino && a.mode === b.mode && a.size === b.size && a.nlink === b.nlink &&
  a.mtimeSeconds === b.mtimeSeconds && a.mtimeNanoseconds === b.mtimeNanoseconds;
const parentMatches = (a: BoundDirectoryFileObservation['parent'], b: BoundDirectoryFileObservation['parent']) => a.dev === b.dev && a.ino === b.ino;

export function normalizeLinkedDirectoryFile(input: { fd: number; relative: string; alias: string;
  expected: BoundDirectoryFileObservation; originalFd: number; content: Uint8Array; transactionId: string; leaseFd?: number; receiptFd?: number }): LinkedNormalizationResult {
  const expected = boundDirectoryFileObservationSchema.parse(input.expected), alias = aliasSchema.parse(input.alias);
  const transactionId = z.string().uuid().parse(input.transactionId), content = Buffer.from(input.content);
  if (expected.nlink !== '2' || BigInt(expected.size) !== BigInt(content.length)) return { kind: 'not_normalized', detail: 'linked normalization: invalid pair or byte count' };
  if (process.platform !== 'darwin') return { kind: 'not_normalized', detail: 'linked normalization: unsupported platform' };
  const result = spawnSync(executable,
    [...(input.receiptFd === undefined ? [] : ['--receipt']), '--normalize-linked', input.relative, String(content.length),
      directoryFileObservationFrame(expected), transactionId, alias, '--execute'],
    { input: content, encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.originalFd, input.receiptFd ?? 'ignore'],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '';
  const complete = /^start\nstaging\nchecking\nlinked_alias ([^\n]+)\ncapturing\ncaptured\npublishing\nrenamed\nheld (v2:[^\n]+)\nlanded (v2:[^\n]+)\ndurable\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && complete?.[1] === alias) {
    try {
      const held = parseDirectoryFileObservationFrame(complete[2]!), observation = parseDirectoryFileObservationFrame(complete[3]!);
      if (origin(expected, held) && observation.nlink === '1' && observation.size === expected.size && observation.mode === expected.mode &&
          parentMatches(observation.parent, expected.parent) && (observation.dev !== held.dev || observation.ino !== held.ino))
        return { kind: 'normalized', transactionId, held, observation };
    } catch { /* Incomplete descriptor evidence remains unknown. */ }
  }
  const detail = `linked normalization: ${result.error?.message ?? (status.trim() || `native writer exit ${result.status ?? result.signal}`)}`;
  if (!result.error && result.signal === null && result.status !== 0 && /\nerror not_published [0-9]+\n$/.test(status))
    return { kind: 'not_normalized', detail };
  return { kind: 'unknown', transactionId, detail };
}

export function observeLinkedRetainedDirectoryFile(input: { fd: number; relative: string; alias: string;
  parent: BoundDirectoryFileObservation['parent']; held: BoundDirectoryFileObservation; originalFd: number;
  transactionId: string; leaseFd?: number }): { kind: 'observed'; held: BoundDirectoryFileObservation } | { kind: 'unknown' } {
  const held = boundDirectoryFileObservationSchema.parse(input.held), parent = boundDirectoryFileObservationSchema.shape.parent.parse(input.parent);
  const alias = aliasSchema.parse(input.alias), transactionId = z.string().uuid().parse(input.transactionId), heldFrame = directoryFileObservationFrame(held);
  if (held.nlink !== '2' || process.platform !== 'darwin') return { kind: 'unknown' };
  const result = spawnSync(executable, ['--observe-linked-retained', input.relative, heldFrame, transactionId, alias, `missing:${parent.dev}:${parent.ino}`, '--execute'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.originalFd],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 4096 });
  if (!result.error && result.status === 0 && result.signal === null && result.output[4] === `start\nobserved_linked ${heldFrame}\n`)
    return { kind: 'observed', held };
  return { kind: 'unknown' };
}

export function publishLinkedCapturedDirectoryFile(input: { fd: number; relative: string; alias: string;
  parent: BoundDirectoryFileObservation['parent']; held: BoundDirectoryFileObservation; staged: BoundDirectoryFileObservation;
  originalFd: number; desiredFd: number; transactionId: string; leaseFd?: number; receiptFd?: number }): LinkedNormalizationResult {
  const held = boundDirectoryFileObservationSchema.parse(input.held), staged = boundDirectoryFileObservationSchema.parse(input.staged);
  const parent = boundDirectoryFileObservationSchema.shape.parent.parse(input.parent), alias = aliasSchema.parse(input.alias);
  const transactionId = z.string().uuid().parse(input.transactionId);
  if (held.nlink !== '2' || staged.nlink !== '1' || held.size !== staged.size || held.mode !== staged.mode || !parentMatches(held.parent, staged.parent) ||
      (held.dev === staged.dev && held.ino === staged.ino)) return { kind: 'not_normalized', detail: 'linked continuation: invalid retained identity' };
  if (process.platform !== 'darwin') return { kind: 'not_normalized', detail: 'linked continuation: unsupported platform' };
  const missing = `missing:${parent.dev}:${parent.ino}`, heldFrame = directoryFileObservationFrame(held), stageFrame = directoryFileObservationFrame(staged);
  const result = spawnSync(executable,
    [...(input.receiptFd === undefined ? [] : ['--receipt']), '--publish-linked-captured', input.relative, missing, heldFrame, stageFrame, transactionId, alias, '--execute'],
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.originalFd, input.receiptFd ?? 'ignore', input.desiredFd],
      timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '', prefix = `start\nchecking\nresume_linked ${alias} ${missing} ${heldFrame} ${stageFrame}\npublishing\nrenamed\nheld ${heldFrame}\n`;
  const complete = status.startsWith(prefix) ? /^landed (v2:[^\n]+)\ndurable\n$/.exec(status.slice(prefix.length)) : null;
  if (!result.error && result.status === 0 && result.signal === null && complete) {
    try {
      const observation = parseDirectoryFileObservationFrame(complete[1]!);
      if (origin(staged, observation) && parentMatches(observation.parent, parent)) return { kind: 'normalized', transactionId, held, observation };
    } catch { /* Incomplete descriptor evidence remains unknown. */ }
  }
  const detail = `linked continuation: ${result.error?.message ?? (status.trim() || `native writer exit ${result.status ?? result.signal}`)}`;
  if (!result.error && result.signal === null && result.status !== 0 && /\nerror not_published [0-9]+\n$/.test(status) && !status.split('\n').includes('renamed'))
    return { kind: 'not_normalized', detail };
  return { kind: 'unknown', transactionId, detail };
}
