// Shared private attachment store for workspace-local binary artifacts. Callers
// decide what to keep; this module owns the directory contract, the shared
// file/byte caps and atomic publication inside the workspace.
import fs from "node:fs";
import path from "node:path";

export const ATTACHMENT_MAX_FILES = 128;
export const ATTACHMENT_STORE_MAX_BYTES = 64 * 1024 * 1024;
export const ATTACHMENT_DIRECTORY = path.join(".harness", "attachments");

export type AttachmentStore = { workspace: string; directory: string; verify: () => void };

/** Create and pin the store directories; any symlink or escape is refused. */
export function openAttachmentStore(workspace: string, label: string): AttachmentStore {
  const root = fs.realpathSync(workspace);
  const directories: Array<{ location: string; dev: number; ino: number }> = [];
  let directory = root;
  for (const segment of [".harness", "attachments"]) {
    directory = path.join(directory, segment);
    try { fs.mkdirSync(directory, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(directory) !== directory) {
      throw new Error(`${label} directory must be a regular directory inside workspace`);
    }
    directories.push({ location: directory, dev: stat.dev, ino: stat.ino });
  }
  const verify = () => {
    for (const entry of directories) {
      const stat = fs.lstatSync(entry.location);
      if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== entry.dev || stat.ino !== entry.ino || fs.realpathSync(entry.location) !== entry.location) {
        throw new Error(`${label} directory changed or escapes workspace`);
      }
    }
  };
  verify(); fs.chmodSync(directory, 0o700); verify();
  return { workspace: root, directory, verify };
}

/** Refuse the write when the shared store already holds too many files or bytes. */
export function checkAttachmentStore(directory: string, bytes: number, label: string): void {
  const handle = fs.opendirSync(directory);
  let count = 0, total = 0;
  try {
    let entry;
    while ((entry = handle.readSync())) {
      if (++count >= ATTACHMENT_MAX_FILES) throw new Error(`${label} store exceeds ${ATTACHMENT_MAX_FILES} file limit`);
      const stat = fs.lstatSync(path.join(directory, entry.name));
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} store contains a nonregular file`);
      total += stat.size;
      if (total + bytes > ATTACHMENT_STORE_MAX_BYTES) throw new Error(`${label} store exceeds ${ATTACHMENT_STORE_MAX_BYTES / (1024 * 1024)} MiB byte limit`);
    }
  } finally { handle.closeSync(); }
}

/** Write through an exclusive temporary file and publish it with one hard link. */
export function publishAttachment(store: AttachmentStore, name: string, bytes: Buffer, label: string,
  check?: () => void): { path: string; dev: number; ino: number } {
  const { directory, verify } = store;
  const target = path.join(directory, name), temporary = path.join(directory, `.${name}.tmp`);
  let temporaryOwned = false, targetOwned = false;
  let identity: fs.Stats | undefined;
  try {
    check?.(); verify();
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    temporaryOwned = true;
    try {
      identity = fs.fstatSync(fd);
      if (!identity.isFile()) throw new Error(`${label} must be a regular file`);
      fs.fchmodSync(fd, 0o600); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    verify(); check?.();
    const pending = fs.lstatSync(temporary);
    if (!pending.isFile() || pending.dev !== identity!.dev || pending.ino !== identity!.ino) throw new Error(`${label} changed during write`);
    fs.linkSync(temporary, target); targetOwned = true;
    fs.unlinkSync(temporary); temporaryOwned = false;
    const published = fs.lstatSync(target);
    if (!published.isFile() || published.dev !== identity!.dev || published.ino !== identity!.ino) throw new Error(`${label} changed during publication`);
    return { path: target, dev: published.dev, ino: published.ino };
  } catch (error) {
    verify();
    if (targetOwned) fs.unlinkSync(target);
    if (temporaryOwned) fs.unlinkSync(temporary);
    throw error;
  }
}

/** Workspace-relative reference for a stored attachment. */
export function attachmentPath(name: string): string { return path.join(ATTACHMENT_DIRECTORY, name); }
