import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { boundDirectoryFileObservationSchema, directoryFileObservationFrame, parseDirectoryFileObservationFrame,
  type BoundDirectoryFileObservation } from './directory-file-state.js';

type Parent = BoundDirectoryFileObservation['parent'];
type Failure = { kind: 'unknown' | 'refused'; transactionId: string; detail: string };
export type DirectoryCreatePreparation = { kind: 'prepared'; transactionId: string; parent: Parent; mode: number; staged: BoundDirectoryFileObservation } | Failure;
export type DirectoryPreparedCreation = { kind: 'durable'; transactionId: string; observation: BoundDirectoryFileObservation } | Failure;
const executable = fileURLToPath(new URL('../native/directory-write/write', import.meta.url));
const sameParent = (left: Parent, right: Parent) => left.dev === right.dev && left.ino === right.ino;
const sameOrigin = (left: BoundDirectoryFileObservation, right: BoundDirectoryFileObservation) => left.dev === right.dev && left.ino === right.ino &&
  left.size === right.size && left.nlink === right.nlink && left.mtimeSeconds === right.mtimeSeconds && left.mtimeNanoseconds === right.mtimeNanoseconds;

// RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// UTF-16 [4740702,4743506); sC, f606a53w
// dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
// UTF-16 [12501,15618). Separate host preparation/publication receipts allow a
// durable caller to bind staging before it grants any target-effect authority.
export function prepareDirectoryCreation(input: { fd: number; relative: string; parent: Parent; mode: number;
  content: Uint8Array; desiredFd: number; transactionId: string; leaseFd?: number; receiptFd?: number }): DirectoryCreatePreparation {
  const parent = boundDirectoryFileObservationSchema.shape.parent.parse(input.parent);
  const mode = boundDirectoryFileObservationSchema.shape.mode.parse(input.mode), transactionId = z.string().uuid().parse(input.transactionId);
  const content = Buffer.from(input.content), missing = `missing:${parent.dev}:${parent.ino}`;
  if (process.platform !== 'darwin') return { kind: 'refused', transactionId, detail: 'create preparation: unsupported platform' };
  const result = spawnSync(executable, [...(input.receiptFd === undefined ? [] : ['--receipt']), '--prepare-create', input.relative,
    missing, transactionId, String(content.length), String(mode), '--execute'],
  { input: content, encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.desiredFd, input.receiptFd ?? 'ignore'],
    timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '', match = /^start\nstaging\nchecking\ncreate_mode ([0-9]+)\nprepared_create (missing:[0-9]+:[0-9]+) (v2:[^\n]+)\nprepared\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && match?.[1] === String(mode) && match[2] === missing) {
    try {
      const staged = parseDirectoryFileObservationFrame(match[3]!);
      if (staged.nlink === '1' && staged.mode === 0o600 && BigInt(staged.size) === BigInt(content.length) &&
          staged.parent.dev === parent.dev && !sameParent(staged.parent, parent)) return { kind: 'prepared', transactionId, parent, mode, staged };
    } catch { /* A status line without complete descriptor proof stays unknown. */ }
  }
  const refused = !result.error && result.signal === null && result.status !== 0 && /\nerror not_prepared [0-9]+\n$/.test(status) && !status.includes('staging\n');
  return { kind: refused ? 'refused' : 'unknown', transactionId, detail: `create preparation: ${result.error?.message ?? (status.trim() || String(result.status ?? result.signal))}` };
}

export function publishPreparedDirectoryCreation(input: { fd: number; relative: string; parent: Parent; staged: BoundDirectoryFileObservation; mode: number;
  desiredFd: number; transactionId: string; leaseFd?: number; receiptFd?: number }): DirectoryPreparedCreation {
  const parent = boundDirectoryFileObservationSchema.shape.parent.parse(input.parent), staged = boundDirectoryFileObservationSchema.parse(input.staged);
  const transactionId = z.string().uuid().parse(input.transactionId), mode = boundDirectoryFileObservationSchema.shape.mode.parse(input.mode);
  if (process.platform !== 'darwin' || staged.nlink !== '1' || staged.mode !== 0o600 || sameParent(parent, staged.parent) || parent.dev !== staged.parent.dev)
    return { kind: 'refused', transactionId, detail: 'prepared creation: unsupported platform or staging identity' };
  const result = spawnSync(executable, [...(input.receiptFd === undefined ? [] : ['--receipt']), '--publish-prepared-create', input.relative,
    `missing:${parent.dev}:${parent.ino}`, transactionId, directoryFileObservationFrame(staged), String(mode), '--execute'],
  { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore', input.fd, 'pipe', 'ignore', input.leaseFd ?? 'ignore', input.desiredFd, input.receiptFd ?? 'ignore'],
    timeout: 30000, killSignal: 'SIGKILL', maxBuffer: 24000 });
  const status = result.output[4] ?? '', match = /^start\nchecking\ncreate_mode ([0-9]+)\nmode_changing\nmode_applied (v2:[^\n]+)\npublishing\nrenamed\nlanded (v2:[^\n]+)\ndurable\n$/.exec(status);
  if (!result.error && result.status === 0 && result.signal === null && match?.[1] === String(mode)) {
    try {
      const applied = parseDirectoryFileObservationFrame(match[2]!), observation = parseDirectoryFileObservationFrame(match[3]!);
      if (sameOrigin(applied, staged) && applied.mode === mode && sameParent(applied.parent, staged.parent) &&
          sameOrigin(observation, applied) && observation.mode === mode &&
          sameParent(observation.parent, parent)) return { kind: 'durable', transactionId, observation };
    } catch { /* An incomplete publication outcome is not success. */ }
  }
  const refused = !result.error && result.signal === null && result.status !== 0 && /\nerror not_published [0-9]+\n$/.test(status) && !status.includes('renamed\n');
  return { kind: refused ? 'refused' : 'unknown', transactionId, detail: `prepared creation: ${result.error?.message ?? (status.trim() || String(result.status ?? result.signal))}` };
}
