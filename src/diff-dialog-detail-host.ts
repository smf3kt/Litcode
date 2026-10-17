// Host bindings for the diff dialog detail view (W168).
//
// `readFileBounded` stands in for the source's `r8e` (chunk-f606a53w.js sha256
// dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033, [5314,5397) 83 UTF-16 units,
// body sha256 f7220b7e04a6119f7acc2d58c5aa7d0f57a531984430170bd630a95fd652d3cc).
// The source body opens the file through `ih`fs.readBoundedSync(${path}, max ${maxBytes} bytes)``, a Bun
// runtime template builtin this host cannot execute. The Node implementation below keeps the observable
// contract: the same open flags for each symlink policy, the same regular-file check, and a read that
// refuses content past the byte limit. `pBe` passes `{maxBytes}` only.
//
// `isRemoteSession` stands in for the source's `Ht` (chunk-qr9z1wer.js sha256
// 7c4094d82563f8ebbee3405c7ba3cdb48d5eb7701e274c48c111eb1aefc587a3, [1303,1342) 39 units, body sha256
// 44668f063e24edb161db9540bcb530e71f24e1f78921432706ec53837c4ecf3c), which reports a remote or
// control-channel session. The product keeps local features only, so the binding answers false and every
// copied branch takes its local path ("Large file - diff exceeds 1 MB limit", the `git add` hint).
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';

export interface ReadFileBoundedOptions {
  maxBytes: number;
  symlinkAtPath?: 'follow' | 'refuse';
  regularFileOnly?: boolean;
}

export function readFileBounded(path: string, options: ReadFileBoundedOptions): string {
  const { maxBytes } = options;
  const symlinkAtPath = options.symlinkAtPath ?? 'follow';
  const regularFileOnly = options.regularFileOnly ?? symlinkAtPath === 'refuse';
  let flags = constants.O_RDONLY | constants.O_NONBLOCK;
  if (symlinkAtPath === 'refuse') flags |= constants.O_NOFOLLOW;
  const fd = openSync(path, flags);
  try {
    if (regularFileOnly && !fstatSync(fd).isFile()) {
      throw Object.assign(new Error('EINVAL: not a regular file'), { code: 'EINVAL' });
    }
    const chunks: Buffer[] = [];
    let total = 0;
    const buffer = Buffer.alloc(8192);
    for (;;) {
      const read = readSync(fd, buffer, 0, buffer.length, null);
      if (read === 0) return Buffer.concat(chunks).toString('utf8');
      total += read;
      if (total > maxBytes) {
        throw new Error(`refusing to read ${path}: content exceeds ${maxBytes} byte limit`);
      }
      chunks.push(Buffer.from(buffer.subarray(0, read)));
    }
  } finally {
    closeSync(fd);
  }
}

export function isRemoteSession(): boolean {
  return false;
}
