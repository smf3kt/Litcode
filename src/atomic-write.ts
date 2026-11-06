import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Write workspace file content in one step: a temporary file beside the target,
 * flushed to the filesystem, checked, then renamed into place.
 *
 * An atomic rename is not the same thing as a write that happened. The rename
 * says the name now points at new bytes; it says nothing about how many of them
 * arrived, and a network drive or a sync client can accept a write, report
 * success and leave fewer bytes behind. So the file is measured after it is
 * written and before it is published, and a mismatch is refused rather than
 * renamed, because a half-written file under the real name is worse than no
 * write at all.
 *
 * The directory the temporary file was created in is identified before the
 * write and checked again before the rename, so a target directory that was
 * replaced or repointed while the write was in flight cannot receive it. When
 * the write fails after the temporary file holds the new content, that file is
 * kept and its path is named in the error: the work is not thrown away to keep
 * the directory tidy.
 */

export type DirectoryIdentity = { dev: number; ino: number };

export type AtomicWriteOptions = {
  /** Mode for a brand-new file. An existing target keeps the mode it had. */
  mode?: number;
  /** The tool name used in error text. */
  label?: string;
  /** Require file and containing-directory sync before reporting publication. */
  durable?: boolean;
};

export type AtomicWriteResult = {
  /** Bytes on disk, as measured after the write. */
  size: number;
  /** Modification time of the written file descriptor, before publication. */
  mtimeMs: number;
  identity: { dev: string; ino: string };
  /** The temporary file kept when the write failed; absent on success. */
  keptTemporary?: string;
};

/**
 * Filesystems that cannot flush are not a write failure.
 *
 * A network drive, a FUSE mount or a sync client can refuse `fsync` outright.
 * The recovered product notices and carries on, because the alternative is
 * refusing to write a file on a filesystem that simply has no concept of a
 * flush, and the verification below still measures what arrived.
 */
function isUnsupportedSync(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "ENOTSUP" || code === "EINVAL" || code === "ENOSYS" || code === "EOPNOTSUPP";
}

/** Strict sync for transaction metadata; unsupported filesystems report failure. */
export function syncDirectory(dir: string): void {
  const fd = fs.openSync(dir, fs.constants.O_RDONLY);
  try { fs.fsyncSync(fd); } catch (error) {
    try { fs.closeSync(fd); } catch { /* preserve the sync error */ }
    throw error;
  }
  fs.closeSync(fd);
}

/** The device and inode of a directory, as the filesystem currently reports it. */
export function directoryIdentity(dir: string): DirectoryIdentity {
  const stat = fs.statSync(dir);
  return { dev: stat.dev, ino: stat.ino };
}

/**
 * Refuse when `dir` is no longer the directory that was identified.
 *
 * `before` is the identity taken when the write began. A directory can be
 * replaced between two syscalls by another process or by a sync client, so the
 * check belongs immediately before the rename rather than only at the start.
 */
export function assertSameDirectory(dir: string, before: DirectoryIdentity): void {
  const now = directoryIdentity(dir);
  if (now.dev !== before.dev || now.ino !== before.ino) {
    throw new Error(
      `the directory ${dir} changed while the file was being written ` +
        `(identified ${before.dev}/${before.ino}, found ${now.dev}/${now.ino}); refusing to replace the file`,
    );
  }
}

/**
 * Write `content` to `real` atomically and return what is actually on disk.
 *
 * Throws, naming the kept temporary file, when the content was written but
 * could not be published or did not survive whole.
 */
export function atomicWriteFile(real: string, content: string | Uint8Array, options: AtomicWriteOptions = {}): AtomicWriteResult {
  const label = options.label ?? "atomicWriteFile";
  const expected = typeof content === 'string' ? Buffer.byteLength(content, "utf8") : content.byteLength;
  const dir = path.dirname(real);
  fs.mkdirSync(dir, { recursive: true });
  const identity = directoryIdentity(dir);
  const temporary = path.join(dir, `.${path.basename(real)}.${crypto.randomBytes(6).toString("hex")}.tmp`);

  let fd: number | undefined;
  let wrote = false;
  let published = false;
  try {
    fd = fs.openSync(temporary, "wx", options.mode ?? 0o644);
    if (options.durable) wrote = true;
    fs.writeFileSync(fd, content, "utf8");
    wrote = true;
    try {
      fs.fsyncSync(fd);
    } catch (error) {
      if (options.durable || !isUnsupportedSync(error)) throw error;
    }
    // Host adaptation of uno/sjr, sfn1dbxq [739599,743199)/[4167188,4170788), UTF-16:
    // bind the observation to the same descriptor that received the bytes.
    const metadata = fs.fstatSync(fd, { bigint: true });
    const actual = Number(metadata.size), mtimeMs = Number(metadata.mtimeNs) / 1e6;
    const landedIdentity = { dev: String(metadata.dev), ino: String(metadata.ino) };
    wrote = true;
    fs.closeSync(fd);
    fd = undefined;
    if (actual !== expected) {
      throw new Error(
        `${label}: ${real} is ${actual} bytes on disk, expected ${expected}. ` +
          "The filesystem may have silently truncated the write (network drive / cloud sync).",
      );
    }
    assertSameDirectory(dir, identity);
    fs.renameSync(temporary, real);
    published = true;
    if (options.durable) syncDirectory(dir);
    return { size: actual, mtimeMs, identity: landedIdentity };
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* the original failure is the one that matters */
      }
    }
    // The content only exists in the temporary file once it was written whole,
    // and keeping it is the difference between a retry and redoing the work.
    if (!wrote) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch {
        /* nothing to clean up */
      }
      throw error;
    }
    const detail = error instanceof Error ? error.message : String(error);
    if (published) throw new Error(`${detail} The new content is published at ${real}; directory sync failed.`, { cause: error });
    throw new Error(`${detail} The new content is kept at ${temporary}.`, { cause: error });
  }
}
