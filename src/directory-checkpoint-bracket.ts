import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Duplex, Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parseDirectoryFileObservationFrame, type BoundDirectoryFileObservation } from './directory-file-state.js';
import type { DirectoryReadHandle } from './path-identity.js';

export type DirectoryCheckpointObservation =
  | { kind: 'present'; file: BoundDirectoryFileObservation }
  | { kind: 'missing'; parent: { dev: string; ino: string } };
export type DirectoryCheckpointBracketResult = { kind: 'stable'; observation: DirectoryCheckpointObservation } | { kind: 'unknown' };
export type DirectoryCheckpointBracket = { kind: 'unknown' } | {
  kind: 'ready'; observation: DirectoryCheckpointObservation;
  closed: Promise<void>;
  finish(): Promise<DirectoryCheckpointBracketResult>;
  cancel(): Promise<void>;
};

function parseReady(line: string): DirectoryCheckpointObservation | undefined {
  if (line.startsWith('v2 bracket-ready ')) {
    try {
      const frame = `v2:${line.slice('v2 bracket-ready '.length).split(' ').join(':')}`;
      const file = parseDirectoryFileObservationFrame(frame);
      if (file.nlink !== '1') return;
      return { kind: 'present', file };
    } catch { return; }
  }
  const match = /^v1 bracket-ready ([0-9]+) ([0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+) (-?[0-9]+) ([0-9]+)$/.exec(line);
  if (!match || BigInt(match[5]!) >= 1000000000n || BigInt(match[7]!) >= 1000000000n) return;
  return { kind: 'missing', parent: { dev: match[1]!, ino: match[2]! } };
}

function sameFile(a: fs.BigIntStats, b: fs.BigIntStats): boolean {
  return a.isFile() && b.isFile() && a.dev === b.dev && a.ino === b.ino && a.uid === b.uid && a.mode === b.mode &&
    a.nlink === b.nlink && a.size === b.size && a.mtimeNs === b.mtimeNs && a.ctimeNs === b.ctimeNs;
}

// Host rewrite: Tke/Cwt, sfn1dbxq [4732048,4733481)/[4734814,4735645), UTF-16.
// The caller owns the backup FD and locked Session gate, and must finish or cancel the handle.
export async function beginDirectoryCheckpointBracket(input: { grant: DirectoryReadHandle; relative: string;
  destinationFd: number; gateFd: number; signal: AbortSignal; isCurrent: () => boolean }): Promise<DirectoryCheckpointBracket> {
  const unknown: DirectoryCheckpointBracket = { kind: 'unknown' };
  const validGrant = (): boolean => {
    try {
      if (input.signal.aborted || input.grant.signal.aborted || !input.isCurrent()) return false;
      const named = fs.lstatSync(input.grant.root, { bigint: true }), opened = fs.fstatSync(input.grant.fd, { bigint: true });
      return named.isDirectory() && !named.isSymbolicLink() && opened.isDirectory() && opened.nlink > 0n &&
        named.dev === opened.dev && named.ino === opened.ino && opened.dev === input.grant.dev && opened.ino === input.grant.ino;
    } catch { return false; }
  };
  let initial: fs.BigIntStats;
  try {
    if ((process.platform !== 'darwin' && process.platform !== 'linux') || !input.relative || path.isAbsolute(input.relative) ||
        input.relative.includes('\0') || Buffer.byteLength(input.relative) > 4096 || !validGrant()) return unknown;
    initial = fs.fstatSync(input.destinationFd, { bigint: true });
    const gate = fs.fstatSync(input.gateFd, { bigint: true });
    if (!initial.isFile() || initial.size !== 0n || initial.nlink !== 1n || (initial.mode & 0o7777n) !== 0o600n ||
        (typeof process.getuid === 'function' && initial.uid !== BigInt(process.getuid())) ||
        !gate.isFile() || (gate.mode & 0o777n) !== 0o600n || (gate.dev === initial.dev && gate.ino === initial.ino)) return unknown;
  } catch { return unknown; }

  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(fileURLToPath(new URL('../native/directory-read/read', import.meta.url)),
      ['--checkpoint-bracket', input.relative, '--execute'],
      { stdio: ['ignore', 'ignore', 'ignore', input.grant.fd, 'pipe', 'pipe', input.gateFd, input.destinationFd] });
  } catch { return unknown; }
  const statusPipe: unknown = Reflect.get(child.stdio, 4), control: unknown = Reflect.get(child.stdio, 5);
  if (!(statusPipe instanceof Readable) || !(control instanceof Duplex)) {
    await new Promise<void>(resolve => { child.once('error', () => {}); child.once('close', () => resolve()); child.kill('SIGTERM'); });
    return unknown;
  }
  let status = '', overflow = false, closed = false, cancelled = false, spawnFailed = false;
  let resolveReady: ((ready: boolean) => void) | undefined;
  const ready = new Promise<boolean>(resolve => { resolveReady = resolve; });
  const markReady = (value: boolean) => { const resolve = resolveReady; resolveReady = undefined; resolve?.(value); };
  const stop = () => { if (!closed) child.kill('SIGTERM'); if (!control.destroyed) control.destroy(); };
  const onAbort = () => { cancelled = true; stop(); };
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('error', () => { spawnFailed = true; markReady(false); });
    child.once('close', (code, signal) => {
      closed = true; markReady(false); input.signal.removeEventListener('abort', onAbort); resolve({ code, signal });
    });
  });
  input.signal.addEventListener('abort', onAbort, { once: true });
  if (input.signal.aborted) onAbort();
  statusPipe.on('data', chunk => {
    status += String(chunk);
    if (Buffer.byteLength(status) > 4096) { overflow = true; stop(); markReady(false); }
    else if (status.includes('\n')) markReady(true);
  });
  statusPipe.on('error', () => { overflow = true; stop(); markReady(false); });
  control.on('error', () => { cancelled = true; stop(); });
  const timer = setTimeout(() => { cancelled = true; stop(); markReady(false); }, 30000);
  const received = await ready;
  clearTimeout(timer);
  const line = status.slice(0, status.indexOf('\n'));
  const observation = received && !overflow && !cancelled && !spawnFailed && !closed && status === `${line}\n` ? parseReady(line) : undefined;
  let readyBackup: fs.BigIntStats | undefined;
  try {
    const after = fs.fstatSync(input.destinationFd, { bigint: true });
    if (observation && validGrant() && after.isFile() && after.dev === initial.dev && after.ino === initial.ino &&
        after.uid === initial.uid && after.mode === initial.mode && after.nlink === initial.nlink &&
        (observation.kind === 'missing' ? after.size === 0n : after.size === BigInt(observation.file.size))) readyBackup = after;
  } catch { /* Unavailable descriptors leave the bracket unknown. */ }
  if (!observation || !readyBackup) {
    stop(); await exited; input.signal.removeEventListener('abort', onAbort); return unknown;
  }
  const baseline = readyBackup;

  let completion: Promise<DirectoryCheckpointBracketResult> | undefined;
  const finish = (): Promise<DirectoryCheckpointBracketResult> => {
    if (completion) return completion;
    completion = (async () => {
      if (cancelled || input.signal.aborted || !validGrant()) { cancelled = true; stop(); }
      else if (!control.destroyed) control.end('c');
      const exit = await exited;
      input.signal.removeEventListener('abort', onAbort);
      try {
        const after = fs.fstatSync(input.destinationFd, { bigint: true });
        const stableLine = line.replace('bracket-ready ', 'bracket-stable ');
        if (!cancelled && !overflow && !spawnFailed && exit.code === 0 && exit.signal === null &&
            status === `${line}\n${stableLine}\n` && sameFile(baseline, after) && validGrant())
          return { kind: 'stable', observation };
      } catch { /* An unavailable descriptor is unknown. */ }
      return { kind: 'unknown' };
    })();
    return completion;
  };
  const cancel = async (): Promise<void> => {
    if (!closed) { cancelled = true; stop(); }
    await finish();
  };
  return { kind: 'ready', observation, closed: exited.then(() => {}), finish, cancel };
}
