import { z } from 'zod';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';

// Host protocol rewrite: Axe, chunk-sfn1dbxq.js [82919,87427), UTF-16,
// distinguishes missing exit status; the native supervisor adds fd 3 records.
const record = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exit'), code: z.number().int().min(0).max(255) }).strict(),
  z.object({ kind: z.literal('signal'), signal: z.number().int().min(1).max(127) }).strict(),
  z.object({ kind: z.literal('cancelled') }).strict(),
  z.object({ kind: z.literal('error'), stage: z.enum(['arguments', 'signal', 'pipe', 'fcntl', 'fork', 'child_setup', 'exec', 'gate', 'waitid', 'poll', 'waitpid', 'status']), errno: z.number().int().positive() }).strict(),
]);

export type SupervisorOutcome =
  | { kind: 'exited'; code: number }
  | { kind: 'signalled'; signal: number }
  | { kind: 'cancelled' }
  | { kind: 'not-started'; stage: string; errno: number }
  | { kind: 'unknown'; reason: string };

/** Accumulate fd 3 without allowing an untrusted peer to grow caller memory. */
export class SupervisorStatusReader {
  private chunks: Buffer[] = [];
  private size = 0;
  private overflow = false;

  write(chunk: Uint8Array): void {
    if (this.overflow) return;
    this.size += chunk.byteLength;
    if (this.size > 1024) { this.chunks = []; this.overflow = true; return; }
    this.chunks.push(Buffer.from(chunk));
  }

  finish(exit: { code: number | null; signal: NodeJS.Signals | null }): SupervisorOutcome {
    return this.overflow ? { kind: 'unknown', reason: 'status exceeds byte limit' }
      : decodeSupervisorStatus(Buffer.concat(this.chunks), exit);
  }
}

/** Decode exactly one bounded newline-terminated record, checking the supervisor exit. */
export function decodeSupervisorStatus(data: Uint8Array, exit: { code: number | null; signal: NodeJS.Signals | null }): SupervisorOutcome {
  const unknown = (reason: string): SupervisorOutcome => ({ kind: 'unknown', reason });
  if (exit.signal !== null || exit.code === null) return unknown('supervisor terminated without a reliable exit');
  if (data.byteLength > 1024) return unknown('status exceeds byte limit');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch { return unknown('invalid status encoding'); }
  if (!text.endsWith('\n') || text.indexOf('\n') !== text.length - 1) return unknown('incomplete or multiple status records');
  let value: unknown;
  try { value = JSON.parse(text); } catch { return unknown('invalid status record'); }
  const parsed = record.safeParse(value);
  if (!parsed.success) return unknown('invalid status record');
  const status = parsed.data;
  switch (status.kind) {
    case 'exit': return exit.code === status.code ? { kind: 'exited', code: status.code } : unknown('exit status mismatch');
    case 'signal': return exit.code === (128 + status.signal) % 256 ? { kind: 'signalled', signal: status.signal } : unknown('signal status mismatch');
    case 'cancelled': return exit.code === 130 ? { kind: 'cancelled' } : unknown('cancellation status mismatch');
    case 'error':
      if (exit.code !== 125) return unknown('error status mismatch');
      if (['arguments', 'signal', 'pipe', 'fcntl', 'fork', 'exec'].includes(status.stage)) {
        return { kind: 'not-started', stage: status.stage, errno: status.errno };
      }
      return unknown(`supervisor ${status.stage} failed (errno ${status.errno})`);
  }
}

/** Map results without treating an unknown side effect as a completed failure. */
export function supervisorEffectDisposition(outcome: SupervisorOutcome): 'finished' | 'failed' | 'unknown' {
  switch (outcome.kind) {
    case 'exited': return outcome.code === 0 ? 'finished' : 'failed';
    case 'not-started': return 'failed';
    case 'signalled':
    case 'cancelled':
    case 'unknown': return 'unknown';
  }
}

// Host rewrite for Axe/ale and Mw: chunk-sfn1dbxq.js [82919,87427),
// [3506526,3518705), chunk-25vrbr0v.js [943,3031), UTF-16. The source
// spawns directly and has no supervisor control or fd 3 protocol.
export function runShellSupervisor(options: {
  supervisor: string;
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  maxOutputBytes?: number;
  stopOnOutputLimit?: boolean;
  onOutput?: (stream: 'stdout' | 'stderr', chunk: Buffer) => void;
  stopGraceMs?: number;
  drainMs?: number;
}): Promise<{ outcome: SupervisorOutcome; effect: ReturnType<typeof supervisorEffectDisposition>; stdout: Buffer; stderr: Buffer; truncated: boolean; outputLimitExceeded: boolean }> {
  const limit = options.maxOutputBytes ?? 24000;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new RangeError('maxOutputBytes must be a nonnegative safe integer');
  const child = spawn(options.supervisor, [options.command, ...(options.args ?? [])], {
    cwd: options.cwd, env: options.env, stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
  });
  const reader = new SupervisorStatusReader();
  const status = child.stdio[3];
  let statusError = false;
  let outputBytes = 0;
  let truncated = false;
  let outputLimitExceeded = false;
  let stopTimer: NodeJS.Timeout | undefined;
  let forced = false;
  const cancel = () => {
    child.stdin.end();
    if (options.stopGraceMs !== undefined && !stopTimer && child.exitCode === null && child.signalCode === null) {
      stopTimer = setTimeout(() => { forced = true; child.kill('SIGKILL'); }, options.stopGraceMs);
      stopTimer.unref();
    }
  };
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  const collect = (stream: 'stdout' | 'stderr', chunks: Buffer[]) => (chunk: Buffer) => {
    options.onOutput?.(stream, chunk);
    const take = Math.min(chunk.length, Math.max(0, limit - outputBytes));
    if (take < chunk.length) {
      truncated = true;
      if (options.stopOnOutputLimit && !outputLimitExceeded) {
        outputLimitExceeded = true;
        cancel();
      }
    }
    if (take) chunks.push(Buffer.from(chunk.subarray(0, take)));
    outputBytes += take;
  };
  child.stdout.on('data', collect('stdout', stdout));
  child.stderr.on('data', collect('stderr', stderr));
  child.stdout.on('error', () => { truncated = true; });
  child.stderr.on('error', () => { truncated = true; });
  child.stdin.on('error', () => {});
  if (status instanceof Readable) {
    status.on('data', (chunk: Buffer) => reader.write(chunk));
    status.on('error', () => { statusError = true; });
  } else statusError = true;
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();

  return new Promise(resolve => {
    let error: Error | undefined;
    let drainTimer: NodeJS.Timeout | undefined;
    child.on('error', value => { error = value; });
    child.once('exit', () => {
      if (stopTimer) clearTimeout(stopTimer);
      child.stdin.destroy();
      // Descendants can retain any read descriptor after the supervisor exits.
      // An unfinished status stream may still contain another record.
      drainTimer = setTimeout(() => {
        for (const stream of [child.stdout, child.stderr]) {
          if (!stream.readableEnded) { truncated = true; stream.destroy(); }
        }
        if (status instanceof Readable && !status.readableEnded) {
          statusError = true;
          status.destroy();
        }
      }, options.drainMs ?? 250);
      drainTimer.unref();
    });
    child.once('close', (code, signal) => {
      if (drainTimer) clearTimeout(drainTimer);
      if (stopTimer) clearTimeout(stopTimer);
      options.signal?.removeEventListener('abort', cancel);
      child.stdin.destroy();
      const outcome: SupervisorOutcome = error ? { kind: 'unknown', reason: `${child.pid === undefined ? 'supervisor spawn failed' : 'supervisor error'}: ${error.message}` }
        : forced ? { kind: 'unknown', reason: 'supervisor cleanup deadline exceeded' }
        : statusError ? { kind: 'unknown', reason: 'status stream failed' }
          : reader.finish({ code, signal });
      resolve({ outcome, effect: outputLimitExceeded ? 'unknown' : supervisorEffectDisposition(outcome), stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), truncated, outputLimitExceeded });
    });
  });
}
