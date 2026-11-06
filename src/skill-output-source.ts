import { constants, lstatSync, openSync, closeSync, readlinkSync, realpathSync } from 'node:fs';
import { lstat, mkdir, open } from 'node:fs/promises';
import { join } from 'node:path';
import { createPathApprovalBinding } from './path-approval-binding-source.js';
import { lwe } from './path-approval-decoder-source.js';
import { createPathIdentity } from './path-approval-identity-source.js';
import { createPathOpenCapability, createPathOpenPrimitives } from './path-open-primitives-source.js';
import { toolResultsProjectDirectory } from './project-directory-source.js';
import type { Session } from './session.js';

// US/Xr, bf3z2ftn [15698,20119), and C, f0442373 [15460,17397),
// UTF-16: adapt the source directory pin to the host-owned result path.
export async function pinSkillResult(destination: string): Promise<{
  ioPath: string; recheckBeforeWrite: () => void | Promise<void>; close: () => Promise<void>;
}> {
  const api = {
    cwd: () => process.cwd(), lstatSync, readlinkSync,
    realpathSync: (file: string) => realpathSync(file).normalize('NFC'),
    openDirNoFollowSync(file: string) {
      const fd = openSync(file, constants.O_DIRECTORY | constants.O_NOFOLLOW);
      closeSync(fd);
    },
    async mkdir(file: string) { await mkdir(file, { recursive: true }); },
  };
  const identity = createPathIdentity({ ie: () => api, qpt: () => null });
  const ai = process.platform === 'darwin' ? 16777216 : 0;
  const zut = process.platform === 'darwin' ? 536870912 : 0;
  const capability = createPathOpenCapability({ X: open, m: constants, ai, zut,
    f: { noFollowAny: 'untried' }, E: (error: unknown) =>
      error instanceof Error && 'code' in error ? error.code : undefined });
  const opening = createPathOpenPrimitives({ Pe: open, T: constants, ai, zut, wGn: capability.wGn });
  const platform = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';
  const binding = createPathApprovalBinding({ ie: () => api, ...identity, O: () => platform,
    ...opening, ai, zut, lwe, t: () => {} });
  return binding.US(destination, [destination], { createParents: true });
}

// oh/En, bf3z2ftn [43591,43758), UTF-16; only a witnessed root owns this store.
export function skillResultsDirectory(session: Session | undefined): string | undefined {
  const root = session?.isOpen ? session.rootIdentity : undefined;
  return root && join(toolResultsProjectDirectory(root.originalCwd), root.rootSessionId, 'tool-results');
}

// oot, chunk-566cpr3w.js bcbbf0cd8b6c5132409afe2e38ac723d8dd65dc466aadb50e9f10ea2b1dc06e4,
// zero-based UTF-16 [6616,6768).
export function skillOutputPreview(text: string, limit: number): { preview: string; hasMore: boolean } {
  if (text.length <= limit) return { preview: text, hasMore: false };
  const newline = text.slice(0, limit).lastIndexOf('\n');
  return { preview: text.slice(0, newline > limit * 0.5 ? newline : limit), hasMore: true };
}

// jMn/IYt, chunk-f0442373.js ff76012ebdd7b6e01188c07575ffaab34311d83eeda08e3d47681da030c8a6e9,
// zero-based UTF-16 [18220,18910), [19346,19724); host errors retain filesystem codes.
export async function copySkillOutput(source: string, destination: string, limit: number): Promise<number> {
  const before = await lstat(source);
  if (!before.isFile() || before.nlink !== 1) throw new Error(`task output swap refused: ${source}`);
  const truncated = before.size > limit;
  const input = await open(source, (truncated ? constants.O_RDWR : constants.O_RDONLY) |
    (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const current = await input.stat();
    if (!current.isFile() || current.dev !== before.dev || current.ino !== before.ino || current.nlink !== 1) {
      throw new Error(`task output changed during open: ${source}`);
    }
    if (truncated && current.size > limit) await input.truncate(limit);
    const output = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | (constants.O_NOFOLLOW ?? 0));
    try {
      const buffer = Buffer.alloc(1048576);
      let position = 0;
      while (position < limit) {
        const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, limit - position), position);
        if (bytesRead === 0) break;
        let written = 0;
        while (written < bytesRead) {
          const result = await output.write(buffer, written, bytesRead - written, position + written);
          if (result.bytesWritten === 0) throw new Error('task output copy made no progress');
          written += result.bytesWritten;
        }
        position += bytesRead;
      }
    } finally { await output.close(); }
    return current.size;
  } finally { await input.close(); }
}
