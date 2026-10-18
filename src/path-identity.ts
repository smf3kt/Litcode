// Bounded symlink-chain resolution for the confined file tools.
//
// A workspace path is not one string to the filesystem either: every symlink on
// the way to the target is a hop the kernel takes on the caller's behalf, and a
// single `realpath` call hides how many there were. The recovered client
// resolves the chain itself — `ff` [63574, ...) and `NN` [63768, ...) walk it a
// segment at a time, bounded by `m=64` hops, and `lj` [69060, ...) returns the
// hops it followed together with a `dev`/`ino`/`ctimeNs` identity and, when only
// a link was ever seen, `noFileSeen`.
//
// Resolving here instead of delegating buys three things. A chain longer than
// the bound is refused by name rather than as a bare kernel `ELOOP`; an ancestor
// that exists but cannot be read is refused as unreadable rather than reported
// as a dangling link; and the caller gets the hops and the identity, so it can
// check that the file it resolved is the file it then reads.
//
// Not ported: the recovered module's Windows surface — drive-relative `C:foo`,
// root-relative `\foo`, `\\?\` device paths and UNC shares — is applied only
// when the platform's path syntax actually has those forms, and the recovered
// `launchAncestry` / `surfaceNetworkRaw` policy switches exist to serve a launch
// context this runtime does not have. The network-landing refusal it does keep.

import fs from "node:fs";
import path from "node:path";

/** The recovered client bounds a resolution at 64 hops (`m=64`). */
export const MAX_LINK_HOPS = 64;

export type PathErrorCode =
  | "non-canonical"
  | "ELOOP"
  | "unreadable-ancestry"
  | "network-path"
  | "changed";

export class PathResolutionError extends Error {
  readonly code: PathErrorCode;
  constructor(code: PathErrorCode, message: string) {
    super(message);
    this.name = "PathResolutionError";
    this.code = code;
  }
}

export interface ChainHop {
  /** The link that was followed, as it sat on disk. */
  readonly link: string;
  /** Its target, exactly as `readlink` returned it. */
  readonly target: string;
}

export interface FileIdentity {
  readonly dev: string;
  readonly ino: string;
  readonly ctimeMs: string;
  readonly size: number;
}

export interface ResolvedPath {
  /** The final path, with every link on the way already followed. */
  readonly path: string;
  /** Every link followed, in order. Empty when the path had none. */
  readonly hops: readonly ChainHop[];
  readonly spellings?: readonly string[];
  /** Present when the target exists. Absent for a path that does not. */
  readonly identity?: FileIdentity;
}

export type WorkingDirectories = readonly string[] & { readonly rootSpellings?: readonly string[] };

/** eNe [214841,215024), Yg [215388,215541), chunk-2bcyxj9q, UTF-16.
 * The session retains this observation until the grant is removed. */
export function observeWorkingDirectory(root: string, directory: string): readonly string[] {
  if (!path.isAbsolute(directory) || directory.includes('\0')) return [];
  try {
    const resolved = resolveChain(root, directory);
    if (!resolved.identity || !fs.statSync(resolved.path).isDirectory()) return [];
    verifyIdentity(resolved);
    return [...new Set([directory, ...(resolved.spellings ?? []), resolved.path])];
  } catch { return []; }
}

export interface ResolveOptions {
  /**
   * Read the filesystem type of the landing path to refuse a network mount.
   * Injectable so the refusal can be tested without one.
   */
  readonly fileSystemType?: (target: string) => number | undefined;
}

// The network filesystem magic numbers worth refusing on. A local mount's type
// is a magic number too, so this list can only be wrong by omission: an exotic
// network filesystem missing from it is not refused. The unit test pins the
// other direction — that the filesystem under the test's own temporary
// directory is not in the list — so a wrong entry that would refuse local work
// fails loudly instead of silently.
const NETWORK_FILE_SYSTEM_TYPES = new Set([
  0x6969, // nfs
  0x6e6673, // "nfs" as macOS reports it
  0x517b, // smb
  0x534d42, // "SMB" as macOS reports it
  0xff534d42, // cifs
  0xfe534d42, // smb2
  0xadf5, // afp
  0xadff, // afs
  0x01021997, // 9p
  0x564c, // ncp
  0x7461636f, // ocfs2
]);

export function isNetworkFileSystemType(type: number): boolean {
  return NETWORK_FILE_SYSTEM_TYPES.has(type);
}

function defaultFileSystemType(target: string): number | undefined {
  try {
    return fs.statfsSync(target).type;
  } catch {
    return undefined;
  }
}

/**
 * Reject text that cannot be trusted as written. The recovered client's `kzn`
 * [61366, ...) does the same: a replacement character means the string already
 * lost bytes, and the drive-relative, root-relative, device-path and
 * trailing-dot-or-space forms are only ambiguous on a platform that has them, so
 * they are checked only there.
 */
export function nonCanonicalText(value: string): string | undefined {
  if (value.includes("�")) return "a replacement character";
  if (value.includes("\0")) return "a NUL byte";
  if (process.platform !== "win32") return undefined;
  if (/^[A-Za-z]:(?![\\/])/.test(value)) return "a drive-relative path";
  if (/^[\\/](?![\\/])/.test(value)) return "a root-relative path without a drive";
  if (/^[\\/]{2}\?[\\/]/.test(value) && !/^[\\/]{2}\?[\\/](?:[A-Za-z]:[\\/]|UNC[\\/])/i.test(value)) {
    return "a device path";
  }
  const segments = value.split(/[\\/]/);
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") continue;
    if (/[. ]$/.test(segment)) return "a path segment ending in a dot or a space";
  }
  return undefined;
}

/**
 * Resolve `userPath`, which is relative to `root`, following every link on the
 * way and refusing a chain that is too long, loops, has an unreadable ancestor
 * or lands on a network filesystem. A path that does not exist resolves to the
 * path it would have, with no identity, so a caller can still decide whether to
 * create it.
 */
export function resolveChain(root: string, userPath: string, options: ResolveOptions = {}): ResolvedPath {
  const nonCanonical = nonCanonicalText(userPath);
  if (nonCanonical !== undefined) {
    throw new PathResolutionError("non-canonical", `path contains ${nonCanonical}: ${userPath}`);
  }
  const absolute = path.resolve(root, userPath);
  const hops: ChainHop[] = [];
  const spellings = new Set([absolute]);
  const seen = new Set<string>();
  const parsed = path.parse(absolute);
  let current = parsed.root;
  let remaining = absolute.slice(parsed.root.length).split(path.sep).filter((segment) => segment !== "");

  while (remaining.length > 0) {
    const next = path.join(current, remaining[0]!);
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(next);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES") {
        throw new PathResolutionError("unreadable-ancestry", `path has an ancestor that cannot be read: ${userPath}`);
      }
      if (code === "ENOENT" || code === "ENOTDIR") {
        // Absent, not an error here: the caller decides whether that is allowed.
        return { path: path.join(current, ...remaining), hops, spellings: [...spellings] };
      }
      throw error;
    }
    if (!stat.isSymbolicLink()) {
      current = next;
      remaining = remaining.slice(1);
      continue;
    }
    // A link. The bound is on links followed, not on segments walked, so a deep
    // but link-free path is never refused.
    if (hops.length >= MAX_LINK_HOPS) {
      throw new PathResolutionError("ELOOP", `symbolic link chain too long to vet: ${userPath}`);
    }
    const key = `${next}\u0000${remaining.slice(1).join("\u0000")}`;
    if (seen.has(key)) {
      throw new PathResolutionError("ELOOP", `symbolic link chain loops: ${userPath}`);
    }
    seen.add(key);
    const target = fs.readlinkSync(next);
    hops.push({ link: next, target });
    // Continue from the target, which may itself pass through links, with the
    // unconsumed segments still to walk.
    const resolvedTarget = path.isAbsolute(target) ? path.normalize(target) : path.resolve(current, target);
    spellings.add(path.resolve(resolvedTarget, ...remaining.slice(1)));
    const targetParsed = path.parse(resolvedTarget);
    current = targetParsed.root;
    remaining = [
      ...resolvedTarget.slice(targetParsed.root.length).split(path.sep).filter((segment) => segment !== ""),
      ...remaining.slice(1),
    ];
  }

  const type = (options.fileSystemType ?? defaultFileSystemType)(current);
  if (type !== undefined && isNetworkFileSystemType(type)) {
    throw new PathResolutionError("network-path", `path resolves onto a network filesystem: ${userPath}`);
  }
  try {
    const stat = fs.statSync(current, { bigint: true });
    return {
      path: current,
      hops,
      spellings: [...spellings],
      identity: {
        dev: String(stat.dev),
        ino: String(stat.ino),
        ctimeMs: String(stat.ctimeMs),
        size: Number(stat.size),
      },
    };
  } catch {
    return { path: current, hops, spellings: [...spellings] };
  }
}

/**
 * Re-stat a resolved path and refuse when it is no longer the file that was
 * resolved. Call this between resolution and use: it is what makes the
 * resolution mean something for the bytes the caller is about to read or write.
 *
 * The comparison is the recovered `lj` identity — `dev`, `ino` and `ctimeNs`,
 * with the byte length added here. A substitution is caught by `dev`/`ino` on
 * every filesystem. An in-place rewrite is caught by the timestamps only as
 * finely as the filesystem records them: APFS on this host advances `ctime` in
 * whole seconds, so a same-size rewrite inside one tick is not detected. The
 * byte length closes the size-changing case regardless of the clock.
 */
export function verifyIdentity(resolved: ResolvedPath): void {
  if (resolved.identity === undefined) return;
  let stat: fs.BigIntStats;
  try {
    stat = fs.statSync(resolved.path, { bigint: true });
  } catch {
    throw new PathResolutionError("changed", `path disappeared after it was resolved: ${resolved.path}`);
  }
  if (
    String(stat.dev) !== resolved.identity.dev ||
    String(stat.ino) !== resolved.identity.ino ||
    String(stat.ctimeMs) !== resolved.identity.ctimeMs ||
    Number(stat.size) !== resolved.identity.size
  ) {
    throw new PathResolutionError("changed", `path changed after it was resolved: ${resolved.path}`);
  }
}
